import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMidiMessage, makeNoteEvent, normalizeNoteOnVelocity, virtualNoteBytes, hexBytes,
  describeEvent, eventTypeLabel, EVENT_TYPES, createEvent
} from '../src/midi/midi-normalizer.js';

const meta = { source: 'webmidi', deviceId: 'dev-1', deviceName: 'SMK-37' };

test('Note On 解析出音符、力度与通道', () => {
  const event = parseMidiMessage([0x90, 60, 100], meta);
  assert.equal(event.type, EVENT_TYPES.NOTE_ON);
  assert.equal(event.note, 60);
  assert.equal(event.velocity, 100);
  assert.equal(event.channel, 1);
  assert.equal(event.source, 'webmidi');
  assert.equal(event.sourceLabel, 'MIDI 设备');
  assert.deepEqual(event.rawBytes, [0x90, 60, 100]);
});

test('Velocity 0 的 Note On 被视作 Note Off', () => {
  const event = parseMidiMessage([0x90, 64, 0], meta);
  assert.equal(event.type, EVENT_TYPES.NOTE_OFF);
  assert.equal(event.originalType, EVENT_TYPES.NOTE_ON);
});

test('Note Off 与通道编号', () => {
  const event = parseMidiMessage([0x85, 64, 40], meta);
  assert.equal(event.type, EVENT_TYPES.NOTE_OFF);
  assert.equal(event.channel, 6);
  assert.equal(event.velocity, 40);
});

test('16 个通道都能正确解析', () => {
  for (let channel = 1; channel <= 16; channel += 1) {
    const event = parseMidiMessage([0x90 | (channel - 1), 60, 80], meta);
    assert.equal(event.channel, channel);
  }
});

test('Control Change 解析控制器与数值', () => {
  const event = parseMidiMessage([0xB3, 7, 64], meta);
  assert.equal(event.type, EVENT_TYPES.CONTROL_CHANGE);
  assert.equal(event.controller, 7);
  assert.equal(event.value, 64);
  assert.equal(event.channel, 4);
});

test('Pitch Bend 组合 14 位数值', () => {
  const center = parseMidiMessage([0xE0, 0x00, 0x40], meta);
  assert.equal(center.bend, 0);
  const max = parseMidiMessage([0xE0, 0x7F, 0x7F], meta);
  assert.equal(max.bend, 8191);
  const min = parseMidiMessage([0xE0, 0x00, 0x00], meta);
  assert.equal(min.bend, -8192);
});

test('Program Change 与通道压力', () => {
  const program = parseMidiMessage([0xC0, 42], meta);
  assert.equal(program.type, EVENT_TYPES.PROGRAM_CHANGE);
  assert.equal(program.program, 42);
  const pressure = parseMidiMessage([0xD0, 90], meta);
  assert.equal(pressure.type, EVENT_TYPES.CHANNEL_PRESSURE);
  assert.equal(pressure.pressure, 90);
  const poly = parseMidiMessage([0xA0, 60, 77], meta);
  assert.equal(poly.type, EVENT_TYPES.POLY_PRESSURE);
  assert.equal(poly.note, 60);
  assert.equal(poly.pressure, 77);
});

test('实时消息被忽略，系统消息标记为 unknown', () => {
  assert.equal(parseMidiMessage([0xF8]), null);
  assert.equal(parseMidiMessage([0xFE]), null);
  const sysex = parseMidiMessage([0xF0, 0x7E], meta);
  assert.equal(sysex.type, EVENT_TYPES.UNKNOWN);
});

test('空或不完整消息返回 null / 安全默认值', () => {
  assert.equal(parseMidiMessage(null), null);
  assert.equal(parseMidiMessage([]), null);
  const short = parseMidiMessage([0x90], meta);
  assert.equal(short.note, 0);
  assert.equal(short.velocity, 0);
  assert.equal(short.type, EVENT_TYPES.NOTE_OFF);
});

test('虚拟音符字节与硬件格式一致', () => {
  assert.deepEqual(virtualNoteBytes(true, 60, 100), [0x90, 60, 100]);
  assert.deepEqual(virtualNoteBytes(false, 60, 0), [0x80, 60, 0]);
  assert.deepEqual(virtualNoteBytes(true, 60, 0), [0x90, 60, 1], '力度至少为 1，避免被当作 Note Off');
  assert.deepEqual(virtualNoteBytes(true, 60, 200), [0x90, 60, 127]);
  assert.deepEqual(virtualNoteBytes(true, 60, 90, 16), [0x9F, 60, 90]);
});

test('十六进制格式化', () => {
  assert.equal(hexBytes([0x90, 0x3C, 0x64]), '0x90 0x3C 0x64');
  assert.equal(hexBytes([]), '');
  assert.equal(hexBytes(null), '');
});

test('事件摘要与类型标签', () => {
  const noteOn = makeNoteEvent({ on: true, note: 60, velocity: 100, source: 'virtual' });
  const summary = describeEvent(noteOn);
  assert.equal(summary.name, 60);
  assert.match(summary.detail, /力度 100/);
  assert.equal(eventTypeLabel('note-on'), 'Note On');
  assert.equal(eventTypeLabel('pitch-bend'), 'Pitch Bend');
});

test('来源标签覆盖所有已定义来源', () => {
  for (const [source, label] of Object.entries({ virtual: '屏幕键盘', computer: '电脑键盘（模拟）', webmidi: 'MIDI 设备', native: '原生 MIDI 桥接' })) {
    const event = createEvent(EVENT_TYPES.NOTE_ON, { source });
    assert.equal(event.sourceLabel, label);
  }
});

test('normalizeNoteOnVelocity 不改变非零力度', () => {
  const event = makeNoteEvent({ on: true, note: 60, velocity: 1, source: 'virtual' });
  assert.equal(normalizeNoteOnVelocity(event).type, EVENT_TYPES.NOTE_ON);
});
