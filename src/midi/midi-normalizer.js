/**
 * 统一输入事件模型 / MIDI 字节规范化。
 *
 * 所有来源（屏幕键盘、Web MIDI、未来原生 Core MIDI 桥接）都先转换成这里的标准事件，
 * 再交给课程引擎、测验引擎和 MIDI 实验室。判分逻辑因此不依赖具体设备或按钮。
 */

export const EVENT_TYPES = Object.freeze({
  NOTE_ON: 'note-on',
  NOTE_OFF: 'note-off',
  CONTROL_CHANGE: 'control-change',
  PITCH_BEND: 'pitch-bend',
  PROGRAM_CHANGE: 'program-change',
  CHANNEL_PRESSURE: 'channel-pressure',
  POLY_PRESSURE: 'poly-pressure',
  CLOCK: 'clock',
  UNKNOWN: 'unknown'
});

export const SOURCE_LABELS = Object.freeze({
  virtual: '屏幕键盘',
  computer: '电脑键盘（模拟）',
  webmidi: 'MIDI 设备',
  native: '原生 MIDI 桥接',
  unknown: '未知来源'
});

export function sourceLabel(source) {
  return SOURCE_LABELS[source] || SOURCE_LABELS.unknown;
}

/** 生成一个标准事件的基础字段，方便适配器复用。 */
export function createEvent(type, fields = {}) {
  const now = typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
  const source = fields.source || 'unknown';
  return {
    type,
    channel: 1,
    note: null,
    velocity: null,
    controller: null,
    value: null,
    bend: null,
    program: null,
    pressure: null,
    source,
    sourceLabel: SOURCE_LABELS[source] || SOURCE_LABELS.unknown,
    deviceId: null,
    deviceName: null,
    rawBytes: [],
    timestamp: fields.timestamp ?? now,
    wallTime: fields.wallTime ?? Date.now(),
    ...fields,
    source,
    sourceLabel: fields.sourceLabel || SOURCE_LABELS[source] || SOURCE_LABELS.unknown
  };
}

export function makeNoteEvent({ on, note, velocity = 0, channel = 1, source, deviceId = null, deviceName = null, rawBytes = [], timestamp, wallTime }) {
  const type = on ? EVENT_TYPES.NOTE_ON : EVENT_TYPES.NOTE_OFF;
  return createEvent(type, {
    note,
    velocity,
    channel,
    source,
    sourceLabel: sourceLabel(source),
    deviceId,
    deviceName,
    rawBytes,
    timestamp,
    wallTime
  });
}

/** 把 Velocity 为 0 的 Note On 归一化为 Note Off（保留原始字节与标记）。 */
export function normalizeNoteOnVelocity(noteOnEvent) {
  if (noteOnEvent.type !== EVENT_TYPES.NOTE_ON) return noteOnEvent;
  if (noteOnEvent.velocity !== 0) return noteOnEvent;
  return { ...noteOnEvent, type: EVENT_TYPES.NOTE_OFF, originalType: EVENT_TYPES.NOTE_ON };
}

/**
 * 解析一条 MIDI 消息（Uint8Array 或普通数组）。
 * 返回标准化事件；不完整或无法识别的消息返回 null 或 unknown 事件。
 */
export function parseMidiMessage(data, meta = {}) {
  if (!data || typeof data.length !== 'number' || data.length < 1) return null;
  const bytes = Array.from(data);
  const status = bytes[0];
  if (status >= 0xF8) return null; // 实时消息（时钟等）不进入事件日志。
  if (status >= 0xF0) {
    return createEvent(EVENT_TYPES.UNKNOWN, {
      ...meta,
      rawBytes: bytes,
      description: status === 0xF0 ? 'SysEx（未请求权限，通常不会收到）' : `系统消息 0x${status.toString(16).toUpperCase()}`
    });
  }
  const command = status & 0xF0;
  const channel = (status & 0x0F) + 1;
  const data1 = bytes.length > 1 ? bytes[1] : 0;
  const data2 = bytes.length > 2 ? bytes[2] : 0;
  const base = { ...meta, channel, rawBytes: bytes };

  switch (command) {
    case 0x80:
      return normalizeNoteOnVelocity(makeNoteEvent({ ...base, on: false, note: data1, velocity: data2 }));
    case 0x90: {
      const event = makeNoteEvent({ ...base, on: true, note: data1, velocity: data2 });
      return normalizeNoteOnVelocity(event);
    }
    case 0xA0:
      return createEvent(EVENT_TYPES.POLY_PRESSURE, { ...base, note: data1, pressure: data2, value: data2 });
    case 0xB0:
      return createEvent(EVENT_TYPES.CONTROL_CHANGE, { ...base, controller: data1, value: data2 });
    case 0xC0:
      return createEvent(EVENT_TYPES.PROGRAM_CHANGE, { ...base, program: data1, value: data1 });
    case 0xD0:
      return createEvent(EVENT_TYPES.CHANNEL_PRESSURE, { ...base, pressure: data1, value: data1 });
    case 0xE0: {
      const raw = (data2 << 7) | data1; // LSB 先到
      return createEvent(EVENT_TYPES.PITCH_BEND, {
        ...base,
        value: raw,
        bend: raw - 8192,
        bendNormalized: (raw - 8192) / 8192
      });
    }
    default:
      return createEvent(EVENT_TYPES.UNKNOWN, {
        ...base,
        description: `未识别的状态字节 0x${status.toString(16).toUpperCase()}`
      });
  }
}

/** 生成屏幕键盘对应的标准 MIDI 字节，便于教学时展示「如果是硬件会发什么」。 */
export function virtualNoteBytes(on, note, velocity, channel = 1) {
  const status = (on ? 0x90 : 0x80) | ((channel - 1) & 0x0F);
  return [status, note & 0x7F, on ? Math.max(1, Math.min(127, Math.round(velocity))) : 0];
}

export function eventTypeLabel(type) {
  return {
    'note-on': 'Note On',
    'note-off': 'Note Off',
    'control-change': 'Control Change',
    'pitch-bend': 'Pitch Bend',
    'program-change': 'Program Change',
    'channel-pressure': 'Channel Pressure',
    'poly-pressure': 'Poly Pressure',
    clock: 'Clock',
    unknown: 'Unknown'
  }[type] || type;
}

export function hexBytes(bytes) {
  if (!Array.isArray(bytes) || bytes.length === 0) return '';
  return bytes.map(byte => `0x${Number(byte).toString(16).toUpperCase().padStart(2, '0')}`).join(' ');
}

/** 把事件压缩成人类可读的一行摘要，UI 与导出共用。 */
export function describeEvent(event) {
  switch (event.type) {
    case EVENT_TYPES.NOTE_ON:
      return { name: event.note, detail: `力度 ${event.velocity} · CH ${event.channel}` };
    case EVENT_TYPES.NOTE_OFF:
      return { name: event.note, detail: `CH ${event.channel}` };
    case EVENT_TYPES.CONTROL_CHANGE:
      return { name: `CC ${event.controller}`, detail: `数值 ${event.value} · CH ${event.channel}` };
    case EVENT_TYPES.PITCH_BEND:
      return { name: '弯音', detail: `${event.bend} · CH ${event.channel}` };
    case EVENT_TYPES.PROGRAM_CHANGE:
      return { name: `音色 ${event.program}`, detail: `CH ${event.channel}` };
    case EVENT_TYPES.POLY_PRESSURE:
      return { name: `复音压力 ${event.note}`, detail: `数值 ${event.pressure} · CH ${event.channel}` };
    case EVENT_TYPES.CHANNEL_PRESSURE:
      return { name: '通道压力', detail: `数值 ${event.pressure} · CH ${event.channel}` };
    default:
      return { name: event.description || '其他事件', detail: `CH ${event.channel}` };
  }
}
