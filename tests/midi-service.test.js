import test from 'node:test';
import assert from 'node:assert/strict';
import { MidiService } from '../src/midi/midi-service.js';
import { SimulatedMidiAdapter } from '../src/midi/simulated-midi-adapter.js';
import { EventBus } from '../src/core/event-bus.js';
import { makeNoteEvent, EVENT_TYPES } from '../src/midi/midi-normalizer.js';

function setup() {
  const bus = new EventBus();
  const service = new MidiService({ bus, maxEvents: 5 });
  const simulated = new SimulatedMidiAdapter();
  service.registerAdapter(simulated);
  return { bus, service, simulated };
}

test('模拟适配器事件进入统一服务并广播', () => {
  const { bus, service, simulated } = setup();
  const received = [];
  bus.on('note:on', event => received.push(event));
  simulated.note(true, 60, 90);
  assert.equal(received.length, 1);
  assert.equal(received[0].source, 'virtual');
  assert.equal(service.events.length, 1);
});

test('同一音符的按住状态按来源隔离', () => {
  const { service, simulated } = setup();
  simulated.note(true, 60, 90);
  service.ingest(makeNoteEvent({ on: true, note: 60, velocity: 70, source: 'webmidi', deviceId: 'd1' }));
  const held = service.getHeldNotes();
  assert.equal(held.length, 1);
  assert.equal(held[0].note, 60);
  assert.deepEqual(held[0].sources.sort(), ['virtual', 'webmidi']);
  simulated.note(false, 60, 0);
  assert.equal(service.hasHeld(60), true, '硬件仍然按住');
  service.releaseAll({ source: 'webmidi' });
  assert.equal(service.hasHeld(60), false);
});

test('重复 Note On 计数，逐个 Note Off 递减', () => {
  const { service } = setup();
  const on = makeNoteEvent({ on: true, note: 60, velocity: 90, source: 'webmidi', deviceId: 'd1' });
  service.ingest(on);
  service.ingest({ ...on });
  assert.equal(service.hasHeld(60), true);
  service.ingest(makeNoteEvent({ on: false, note: 60, velocity: 0, source: 'webmidi', deviceId: 'd1' }));
  assert.equal(service.hasHeld(60), true);
  service.ingest(makeNoteEvent({ on: false, note: 60, velocity: 0, source: 'webmidi', deviceId: 'd1' }));
  assert.equal(service.hasHeld(60), false);
});

test('事件日志有上限', () => {
  const { service } = setup();
  for (let index = 0; index < 12; index += 1) {
    service.ingest(makeNoteEvent({ on: true, note: 60 + index, velocity: 90, source: 'virtual' }));
  }
  assert.equal(service.events.length, 5);
  assert.equal(service.events[0].note, 71);
});

test('暂停日志不会停止事件分发', () => {
  const { bus, service } = setup();
  let count = 0;
  bus.on('note:on', () => { count += 1; });
  service.setLogPaused(true);
  service.ingest(makeNoteEvent({ on: true, note: 60, velocity: 90, source: 'virtual' }));
  assert.equal(count, 1);
  assert.equal(service.events.length, 0);
  service.setLogPaused(false);
});

test('设备断开时释放该设备全部按音并广播事件', () => {
  const { bus, service } = setup();
  const disconnected = [];
  bus.on('device:disconnected', payload => disconnected.push(payload));
  service.setInputs([{ id: 'd1', name: 'SMK-37', state: 'connected' }]);
  service.selectInput('d1');
  service.ingest(makeNoteEvent({ on: true, note: 60, velocity: 90, source: 'webmidi', deviceId: 'd1' }));
  service.setInputs([{ id: 'd1', name: 'SMK-37', state: 'disconnected' }]);
  assert.equal(service.selectedId, null);
  assert.equal(service.hasHeld(60), false);
  assert.equal(disconnected.length, 1);
  assert.equal(disconnected[0].name, 'SMK-37');
});

test('切换设备会释放旧设备按音', () => {
  const { service } = setup();
  service.setInputs([
    { id: 'd1', name: 'A', state: 'connected' },
    { id: 'd2', name: 'B', state: 'connected' }
  ]);
  service.selectInput('d1');
  service.ingest(makeNoteEvent({ on: true, note: 60, velocity: 90, source: 'webmidi', deviceId: 'd1' }));
  service.selectInput('d2');
  assert.equal(service.hasHeld(60), false);
});

test('MIDI 状态摘要区分不支持 / 未连接 / 已连接', () => {
  const { service } = setup();
  service.status = 'unsupported';
  assert.match(service.statusSummary().title, /未开放/);
  service.status = 'ready';
  assert.match(service.statusSummary().title, /未发现/);
  service.setInputs([{ id: 'd1', name: 'M-VAVE SMK-37 PRO', state: 'connected' }]);
  service.selectInput('d1');
  const summary = service.statusSummary();
  assert.match(summary.title, /已连接/);
  assert.match(summary.description, /等待实机验证/);
  assert.equal(service.getSelected().profile?.id, 'm-vave-smk-37-pro');
});

test('设备观察报告只统计浏览器收到的数据', () => {
  const { service } = setup();
  service.setInputs([{ id: 'd1', name: 'M-VAVE SMK-37 PRO', state: 'connected' }]);
  service.selectInput('d1');
  service.ingest(makeNoteEvent({ on: true, note: 48, velocity: 90, source: 'webmidi', deviceId: 'd1' }));
  service.ingest(makeNoteEvent({ on: true, note: 72, velocity: 90, source: 'webmidi', deviceId: 'd1' }));
  service.ingest({ type: EVENT_TYPES.CONTROL_CHANGE, controller: 7, value: 100, source: 'webmidi', rawBytes: [0xB0, 7, 100], channel: 1 });
  service.ingest({ type: EVENT_TYPES.PITCH_BEND, bend: 1000, value: 9192, source: 'webmidi', rawBytes: [0xE0, 0, 0], channel: 1 });
  const report = service.deviceReport();
  assert.deepEqual(report.observedNoteRange, [48, 72]);
  assert.deepEqual(report.observedControllers, [7]);
  assert.deepEqual(report.observedPitchBend, { min: 1000, max: 1000 });
  assert.equal(report.verified, false);
  assert.match(report.disclaimer, /实机/);
});

test('EventBus 隔离监听器异常', () => {
  const bus = new EventBus();
  let reached = false;
  bus.on('x', () => { throw new Error('boom'); });
  bus.on('x', () => { reached = true; });
  const originalError = console.error;
  console.error = () => {};
  try {
    bus.emit('x', 1);
  } finally {
    console.error = originalError;
  }
  assert.equal(reached, true);
});
