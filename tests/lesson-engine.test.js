import test from 'node:test';
import assert from 'node:assert/strict';
import { createLessonEngine } from '../src/core/lesson-engine.js';
import { findLesson } from '../src/data/lessons.js';
import { makeNoteEvent } from '../src/midi/midi-normalizer.js';

const on = note => makeNoteEvent({ on: true, note, velocity: 90, source: 'virtual' });
const off = note => makeNoteEvent({ on: false, note, velocity: 0, source: 'virtual' });

function engineFor(id) {
  const updates = [];
  const engine = createLessonEngine({ lesson: findLesson(id), onStatusChange: status => updates.push(status) });
  return { engine, updates };
}

test('顺序课程在弹完后自动完成', () => {
  const { engine, updates } = engineFor('find-c');
  assert.equal(engine.complete, false);
  engine.handleEvent(on(60));
  assert.equal(engine.complete, true);
  assert.equal(engine.status.index, 1);
  assert.ok(updates.length >= 1);
});

test('弹错重置并保留反馈', () => {
  const { engine } = engineFor('note-order');
  engine.handleEvent(on(60));
  engine.handleEvent(on(64));
  assert.equal(engine.status.index, 0);
  assert.match(engine.status.feedback, /E4/);
  assert.ok(engine.status.wrongAttempts >= 1);
});

test('和弦课程需要同时按住', () => {
  const { engine } = engineFor('triads');
  engine.handleEvent(on(60));
  engine.handleEvent(on(64));
  assert.equal(engine.complete, false);
  engine.handleEvent(on(67));
  assert.equal(engine.complete, true);
});

test('MIDI 课程需要按下再松开', () => {
  const { engine } = engineFor('midi-basics');
  engine.handleEvent(on(60));
  assert.equal(engine.complete, false);
  engine.handleEvent(off(60));
  assert.equal(engine.complete, true);
});

test('完成后忽略额外事件，reset 恢复', () => {
  const { engine } = engineFor('find-c');
  engine.handleEvent(on(60));
  const before = engine.status;
  engine.handleEvent(on(62));
  assert.equal(engine.status, before);
  engine.reset();
  assert.equal(engine.complete, false);
  assert.equal(engine.status.index, 0);
});

test('节奏课程可由外部完成', () => {
  const { engine } = engineFor('rhythm-basics');
  assert.equal(engine.complete, false);
  engine.completeExternally('4 拍全部命中');
  assert.equal(engine.complete, true);
  assert.match(engine.status.feedback, /4 拍/);
  engine.reset();
  assert.equal(engine.complete, false);
});

test('节奏课程不走逐音匹配器', () => {
  const { engine } = engineFor('rhythm-basics');
  engine.handleEvent(on(60));
  assert.equal(engine.complete, false);
});
