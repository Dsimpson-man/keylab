/**
 * MIDI 服务：统一管理适配器、设备状态与标准事件分发。
 *
 * 适配器只负责「把某个来源的输入变成标准事件」，服务负责：
 * - 选择 / 取消选择输入
 * - 跟踪按住音符（按来源与设备隔离）
 * - 热插拔与断开清理
 * - 原始事件上限与历史
 * - 向事件总线广播
 *
 * 该类不依赖 DOM，可在 Node 中用模拟适配器测试。
 */

import { EventBus } from '../core/event-bus.js';
import { EVENT_TYPES, parseMidiMessage, makeNoteEvent } from './midi-normalizer.js';
import { matchProfile } from './device-profiles.js';
import { noteName } from '../core/music-theory.js';

export class MidiService {
  constructor({ bus = new EventBus(), maxEvents = 300 } = {}) {
    this.bus = bus;
    this.maxEvents = maxEvents;
    this.adapters = new Map();
    this.access = null;
    this.status = 'idle'; // idle | connecting | ready | unsupported | denied | error
    this.error = null;
    this.inputs = [];
    this.selectedId = null;
    this.events = [];
    this.held = new Map(); // key `${source}:${deviceId}:${note}` -> 事件
    this._started = false;
    this._logPaused = null;
  }

  registerAdapter(adapter) {
    this.adapters.set(adapter.id, adapter);
    adapter.attach?.(event => this.ingest(event));
    return adapter;
  }

  getAdapter(id) {
    return this.adapters.get(id) || null;
  }

  /** 统一入口：任何来源的事件最终都经过这里。 */
  ingest(rawEvent) {
    if (!rawEvent || !rawEvent.type) return null;
    const event = { ...rawEvent };
    if (event.type === EVENT_TYPES.NOTE_ON) this._trackHeld(event);
    else if (event.type === EVENT_TYPES.NOTE_OFF) this._releaseHeld(event);
    this._appendEvent(event);
    this.bus.emit('midi:event', event);
    if (event.type === EVENT_TYPES.NOTE_ON) this.bus.emit('note:on', event);
    if (event.type === EVENT_TYPES.NOTE_OFF) this.bus.emit('note:off', event);
    if (event.type === EVENT_TYPES.CONTROL_CHANGE) this.bus.emit('control:change', event);
    if (event.type === EVENT_TYPES.PITCH_BEND) this.bus.emit('pitch:bend', event);
    return event;
  }

  _trackHeld(event) {
    const key = this.heldKey(event);
    const existing = this.held.get(key);
    if (existing) {
      // 同一来源同一音符重复 Note On：更新力度与计数，不重复叠加。
      existing.count = (existing.count || 1) + 1;
      existing.velocity = event.velocity;
      existing.timestamp = event.timestamp;
    } else {
      this.held.set(key, { ...event, count: 1 });
    }
    this.bus.emit('held:change', this.getHeldNotes());
  }

  _releaseHeld(event) {
    const key = this.heldKey(event);
    const existing = this.held.get(key);
    if (existing && (existing.count || 1) > 1) {
      existing.count -= 1;
    } else {
      this.held.delete(key);
    }
    this.bus.emit('held:change', this.getHeldNotes());
  }

  heldKey(event) {
    return `${event.source || 'unknown'}:${event.deviceId || 'none'}:${event.note}`;
  }

  getHeldNotes() {
    const map = new Map();
    for (const event of this.held.values()) {
      const current = map.get(event.note);
      if (current) {
        current.sources.push(event.source);
        current.velocity = Math.max(current.velocity, event.velocity || 0);
      } else {
        map.set(event.note, {
          note: event.note,
          velocity: event.velocity || 0,
          sources: [event.source],
          sourceLabel: event.sourceLabel
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.note - b.note);
  }

  hasHeld(note) {
    for (const event of this.held.values()) if (event.note === note) return true;
    return false;
  }

  /** 释放某个来源（或全部）的按住音符，用于设备断开、页面隐藏。 */
  releaseAll({ source = null, deviceId = null, silent = false } = {}) {
    const released = [];
    for (const [key, event] of Array.from(this.held.entries())) {
      if (source && event.source !== source) continue;
      if (deviceId && event.deviceId !== deviceId) continue;
      this.held.delete(key);
      const off = makeNoteEvent({
        on: false,
        note: event.note,
        velocity: 0,
        channel: event.channel,
        source: event.source,
        deviceId: event.deviceId,
        deviceName: event.deviceName,
        rawBytes: [],
        timestamp: event.timestamp
      });
      released.push(off);
      if (!silent) {
        this._appendEvent(off);
        this.bus.emit('midi:event', off);
        this.bus.emit('note:off', off);
      }
    }
    if (released.length) this.bus.emit('held:change', this.getHeldNotes());
    return released;
  }

  _appendEvent(event) {
    if (this._logPaused) return;
    this.events.unshift(event);
    if (this.events.length > this.maxEvents) this.events.length = this.maxEvents;
  }

  clearEvents() {
    this.events = [];
  }

  setLogPaused(paused) {
    this._logPaused = Boolean(paused);
    return this._logPaused;
  }

  isLogPaused() {
    return Boolean(this._logPaused);
  }

  setInputs(inputs) {
    this.inputs = inputs.map(input => ({
      id: input.id,
      name: input.name || 'MIDI 输入',
      manufacturer: input.manufacturer || '',
      state: input.state || 'connected',
      connection: input.connection || 'unknown',
      profile: matchProfile(input.name || '')
    }));
    if (this.selectedId && !this.inputs.some(input => input.id === this.selectedId && input.state === 'connected')) {
      this.selectInput(null, { reason: 'disconnected' });
    }
    this.bus.emit('inputs:change', this.getInputs());
  }

  getInputs() {
    return this.inputs.slice();
  }

  selectInput(id, { reason = 'user' } = {}) {
    const input = this.inputs.find(item => item.id === id && item.state === 'connected') || null;
    const previousId = this.selectedId;
    const previousName = this.selectedName();
    // 切换或断开设备时，先释放旧设备仍按住的音符，避免卡音。
    if (previousId && previousId !== (input ? input.id : null)) {
      this.releaseAll({ deviceId: previousId });
    }
    this.selectedId = input ? input.id : null;
    const webMidi = this.getAdapter('web-midi');
    webMidi?.selectInput?.(this.selectedId);
    if (reason === 'disconnected' && previousId) {
      this.bus.emit('device:disconnected', { id: previousId, name: previousName });
    }
    this.bus.emit('selection:change', this.getSelected());
    return this.getSelected();
  }

  selectedName() {
    return this.inputs.find(input => input.id === this.selectedId)?.name || null;
  }

  getSelected() {
    const input = this.inputs.find(item => item.id === this.selectedId) || null;
    return input ? { ...input } : null;
  }

  isConnected() {
    const selected = this.getSelected();
    return Boolean(selected && selected.state === 'connected');
  }

  statusSummary() {
    if (this.status === 'unsupported') return { tone: 'warn', title: '当前浏览器未开放 Web MIDI', description: 'iOS / iPadOS Safari 通常不提供 Web MIDI，这是系统级限制，不代表键盘有问题。虚拟键盘、课程和进度仍可完整使用。' };
    if (this.status === 'denied') return { tone: 'warn', title: 'MIDI 权限被拒绝', description: '浏览器没有授予 MIDI 访问权限。你可以在浏览器设置中重新允许，或继续使用虚拟键盘。' };
    if (this.status === 'error') return { tone: 'warn', title: 'MIDI 连接失败', description: this.error || '无法访问 MIDI 设备。请检查浏览器权限与连接方式。' };
    if (this.status === 'connecting') return { tone: 'idle', title: '正在请求 MIDI 权限…', description: '浏览器会询问是否允许访问 MIDI 设备，请选择允许。' };
    if (this.status === 'idle') return { tone: 'idle', title: '尚未连接 MIDI', description: '点击「连接 MIDI 设备」请求权限。首次使用需要浏览器允许。' };
    const selected = this.getSelected();
    if (selected) {
      const profile = selected.profile;
      return {
        tone: 'ok',
        title: `已连接：${selected.name}`,
        description: profile
          ? `${profile.name} 档案：${profile.statusLabel}。${profile.notes}`
          : '按下琴键，事件会显示在事件监视器中。当前设备没有专用档案，使用通用 MIDI 解析。'
      };
    }
    if (!this.inputs.length) return { tone: 'idle', title: '已开启 MIDI 访问，但未发现输入设备', description: '请检查键盘电源、USB 数据线或蓝牙 MIDI 连接，然后点击「刷新设备」。' };
    return { tone: 'idle', title: '请选择一个输入设备', description: '在下方列表中选择你的键盘。' };
  }

  /** 生成一条可复制的设备观察摘要，方便实机测试时记录。 */
  deviceReport() {
    const selected = this.getSelected();
    const profile = selected?.profile || null;
    const notes = this.events.filter(event => event.type === EVENT_TYPES.NOTE_ON).map(event => event.note);
    return {
      generatedAt: new Date().toISOString(),
      verified: false,
      selected: selected
        ? { id: selected.id, name: selected.name, manufacturer: selected.manufacturer, state: selected.state, connection: selected.connection }
        : null,
      profile: profile
        ? { id: profile.id, name: profile.name, status: profile.status, assumptions: profile.assumptions, checklist: profile.observationChecklist }
        : null,
      observedNoteRange: notes.length ? [Math.min(...notes), Math.max(...notes)] : null,
      observedNotes: notes.slice(0, 60).map(note => ({ note, name: noteName(note) })),
      observedControllers: Array.from(new Set(this.events.filter(event => event.type === EVENT_TYPES.CONTROL_CHANGE).map(event => event.controller))).sort((a, b) => a - b),
      observedPitchBend: (() => {
        const bends = this.events.filter(event => event.type === EVENT_TYPES.PITCH_BEND).map(event => event.bend);
        return bends.length ? { min: Math.min(...bends), max: Math.max(...bends) } : null;
      })(),
      disclaimer: '本报告由网页事件日志生成，只代表浏览器收到的数据；必须与实机操作核对后才能作为设备档案依据。'
    };
  }
}

export function createMidiService(options) {
  return new MidiService(options);
}
