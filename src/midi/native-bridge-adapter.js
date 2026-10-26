/**
 * 原生 iOS / iPadOS 桥接适配器（预留）。
 *
 * iOS 的 WKWebView 可以通过 messageHandlers 把 Core MIDI 事件转成 JSON 发送给网页。
 * 本文件只定义协议与客户端注册逻辑；原生端尚未实现，因此：
 * - 在浏览器中默认不可用，状态为 unsupported；
 * - 绝不显示「已连接」除非原生端真正调用 window.KeyLabNativeMIDI.attach(port)；
 * - 协议文档见 docs/MIDI_ARCHITECTURE.md。
 *
 * 协议（原生 -> 网页）：
 *   window.KeyLabNativeMIDI.receive({ type: "note-on"|"note-off"|"control-change"|"pitch-bend"|...,
 *                                    note, velocity, channel, controller, value, bend,
 *                                    deviceId, deviceName, timestamp })
 * 网页 -> 原生（可选）：
 *   window.webkit.messageHandlers.keylabMidi.postMessage({ type: "request-devices" })
 */

import { parseMidiMessage, makeNoteEvent, EVENT_TYPES } from './midi-normalizer.js';

export const NATIVE_PROTOCOL_VERSION = 1;

export class NativeBridgeAdapter {
  constructor({ service, onStatusChange } = {}) {
    this.id = 'native-bridge';
    this.service = service;
    this.onStatusChange = onStatusChange || (() => {});
    this._handler = null;
    this._available = false;
    this._installed = false;
    this.connected = false;
    this.devices = [];
  }

  static isAvailable() {
    return typeof window !== 'undefined'
      && typeof window.KeyLabNativeMIDI !== 'undefined'
      && typeof window.webkit?.messageHandlers?.keylabMidi !== 'undefined';
  }

  attach(handler) {
    this._handler = handler;
    if (!this._installed) this.install();
  }

  /** 注册 receiver，供原生端调用。可重复调用，只会安装一次。 */
  install() {
    if (typeof window === 'undefined' || this._installed) return;
    this._installed = true;
    const self = this;
    window.KeyLabNativeMIDI = {
      protocolVersion: NATIVE_PROTOCOL_VERSION,
      receive(payload) {
        if (!payload || typeof payload !== 'object') return;
        const event = self._normalize(payload);
        if (event) self._handler?.(event);
      },
      listDevices(list) {
        self.devices = Array.isArray(list) ? list : [];
        self.service.setInputs(self.devices.map(device => ({
          id: device.id || device.uniqueId || device.name,
          name: device.name || '原生 MIDI 设备',
          manufacturer: device.manufacturer || '',
          state: device.state || 'connected',
          connection: 'native'
        })));
        self.onStatusChange();
      },
      setConnected(connected) {
        self.connected = Boolean(connected);
        self.service.status = connected ? 'ready' : 'idle';
        self.onStatusChange();
      }
    };
  }

  _normalize(payload) {
    const base = {
      source: 'native',
      deviceId: payload.deviceId || null,
      deviceName: payload.deviceName || '原生 MIDI 设备',
      channel: payload.channel || 1,
      timestamp: payload.timestamp,
      rawBytes: Array.isArray(payload.rawBytes) ? payload.rawBytes : []
    };
    if (payload.bytes) return parseMidiMessage(payload.bytes, base);
    switch (payload.type) {
      case EVENT_TYPES.NOTE_ON:
        return makeNoteEvent({ ...base, on: true, note: payload.note, velocity: payload.velocity ?? 100 });
      case EVENT_TYPES.NOTE_OFF:
        return makeNoteEvent({ ...base, on: false, note: payload.note, velocity: payload.velocity ?? 0 });
      case EVENT_TYPES.CONTROL_CHANGE:
      case EVENT_TYPES.PITCH_BEND:
      case EVENT_TYPES.PROGRAM_CHANGE:
      case EVENT_TYPES.CHANNEL_PRESSURE:
      case EVENT_TYPES.POLY_PRESSURE:
        return {
          type: payload.type,
          note: payload.note ?? null,
          velocity: payload.velocity ?? null,
          controller: payload.controller ?? null,
          value: payload.value ?? null,
          bend: payload.bend ?? null,
          program: payload.program ?? null,
          pressure: payload.pressure ?? null,
          sourceLabel: '原生 MIDI 桥接',
          wallTime: Date.now(),
          ...base
        };
      default:
        return null;
    }
  }

  /** 向原生端请求设备列表；没有原生端时返回 false，不伪装成功。 */
  requestDevices() {
    if (typeof window !== 'undefined' && window.webkit?.messageHandlers?.keylabMidi) {
      try {
        window.webkit.messageHandlers.keylabMidi.postMessage({ type: 'request-devices', protocolVersion: NATIVE_PROTOCOL_VERSION });
        return true;
      } catch (_) {
        return false;
      }
    }
    return false;
  }

  describeAvailability() {
    if (NativeBridgeAdapter.isAvailable()) {
      return { available: true, text: '检测到原生 MIDI 桥接，可使用 Core MIDI 输入。' };
    }
    return {
      available: false,
      text: '原生 Core MIDI 桥接尚未实现或未注入。iOS / iPadOS Safari 不提供 Web MIDI，因此当前网页无法直接读取实体键盘。'
    };
  }
}
