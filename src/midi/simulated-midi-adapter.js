/**
 * 模拟 MIDI 适配器。
 *
 * 用于没有实体键盘时的学习：屏幕键盘产生的输入也走同一条规范化管线，
 * 但来源永远标记为 virtual，界面也必须显示「模拟输入」，不能伪装成硬件事件。
 */

import { makeNoteEvent, virtualNoteBytes, createEvent, EVENT_TYPES } from './midi-normalizer.js';

export class SimulatedMidiAdapter {
  constructor({ handler = null } = {}) {
    this.id = 'simulated';
    this._handler = handler;
    this.channel = 1;
    this.deviceName = '屏幕键盘（模拟）';
  }

  attach(handler) {
    this._handler = handler;
  }

  /** 由虚拟键盘调用：产生和硬件一致结构的 Note On / Note Off。 */
  note(on, note, velocity = 100, { channel = this.channel, rawBytes, source = 'virtual' } = {}) {
    const event = makeNoteEvent({
      on,
      note,
      velocity: on ? Math.max(1, Math.min(127, Math.round(velocity))) : 0,
      channel,
      source,
      deviceId: source === 'computer' ? 'computer-keyboard' : 'virtual-keyboard',
      deviceName: source === 'computer' ? '电脑键盘（模拟）' : this.deviceName,
      rawBytes: rawBytes || virtualNoteBytes(on, note, velocity, channel)
    });
    this._handler?.(event);
    return event;
  }

  controlChange(controller, value, { channel = this.channel } = {}) {
    const bytes = [0xB0 | ((channel - 1) & 0x0F), controller & 0x7F, value & 0x7F];
    const event = createEvent(EVENT_TYPES.CONTROL_CHANGE, {
      controller,
      value,
      channel,
      source: 'virtual',
      sourceLabel: '屏幕键盘',
      deviceId: 'virtual-keyboard',
      deviceName: this.deviceName,
      rawBytes: bytes
    });
    this._handler?.(event);
    return event;
  }

  pitchBend(value, { channel = this.channel } = {}) {
    const raw = Math.max(0, Math.min(16383, Math.round(value)));
    const bytes = [0xE0 | ((channel - 1) & 0x0F), raw & 0x7F, (raw >> 7) & 0x7F];
    const event = createEvent(EVENT_TYPES.PITCH_BEND, {
      value: raw,
      bend: raw - 8192,
      channel,
      source: 'virtual',
      sourceLabel: '屏幕键盘',
      deviceId: 'virtual-keyboard',
      deviceName: this.deviceName,
      rawBytes: bytes
    });
    this._handler?.(event);
    return event;
  }
}
