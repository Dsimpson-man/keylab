import test from 'node:test';
import assert from 'node:assert/strict';
import { createTaskMatcher, MATCH_STATUS } from '../src/core/task-matcher.js';
import { makeNoteEvent } from '../src/midi/midi-normalizer.js';

const on = (note, velocity = 90) => makeNoteEvent({ on: true, note, velocity, source: 'virtual' });
const off = (note) => makeNoteEvent({ on: false, note, velocity: 0, source: 'virtual' });

test('顺序任务：正确音符按顺序推进', () => {
  const matcher = createTaskMatcher({ mode: 'sequence', target: [60, 62, 64] });
  assert.equal(matcher.accept(on(60)).status, MATCH_STATUS.PROGRESS);
  assert.equal(matcher.status().index, 1);
  assert.equal(matcher.accept(on(62)).status, MATCH_STATUS.PROGRESS);
  const result = matcher.accept(on(64));
  assert.equal(result.status, MATCH_STATUS.COMPLETE);
  assert.equal(result.complete, true);
  assert.match(result.feedback, /完成/);
});

test('顺序任务：弹错后重来并说明实际音', () => {
  const matcher = createTaskMatcher({ mode: 'sequence', target: [60, 62, 64] });
  matcher.accept(on(60));
  const result = matcher.accept(on(65));
  assert.equal(result.status, MATCH_STATUS.WRONG);
  assert.equal(result.index, 0);
  assert.match(result.feedback, /F4/);
  assert.match(result.feedback, /D4/);
});

test('顺序任务：弹回第一个音时从第二步继续', () => {
  const matcher = createTaskMatcher({ mode: 'sequence', target: [60, 62, 64] });
  matcher.accept(on(60));
  const result = matcher.accept(on(60));
  assert.equal(result.status, MATCH_STATUS.RESTART);
  assert.equal(result.index, 1);
});

test('一起按任务：全部按住才完成', () => {
  const matcher = createTaskMatcher({ mode: 'together', target: [60, 64, 67] });
  assert.equal(matcher.accept(on(60)).status, MATCH_STATUS.PROGRESS);
  assert.equal(matcher.accept(on(64)).status, MATCH_STATUS.PROGRESS);
  const result = matcher.accept(on(67));
  assert.equal(result.status, MATCH_STATUS.COMPLETE);
  assert.match(result.feedback, /和弦/);
});

test('一起按任务：额外音会报错', () => {
  const matcher = createTaskMatcher({ mode: 'together', target: [60, 64, 67] });
  matcher.accept(on(60));
  const result = matcher.accept(on(62));
  assert.equal(result.status, MATCH_STATUS.WRONG);
  assert.match(result.feedback, /多按了/);
});

test('一起按任务：松开后不计为完成', () => {
  const matcher = createTaskMatcher({ mode: 'together', target: [60, 64] });
  matcher.accept(on(60));
  matcher.accept(off(60));
  const result = matcher.accept(on(64));
  assert.notEqual(result.status, MATCH_STATUS.COMPLETE);
});

test('需要观察松开的任务：Note Off 才完成', () => {
  const matcher = createTaskMatcher({ mode: 'sequence', target: [60], needsRelease: true });
  const press = matcher.accept(on(60));
  assert.notEqual(press.status, MATCH_STATUS.COMPLETE);
  assert.match(press.feedback, /松开/);
  const release = matcher.accept(off(60));
  assert.equal(release.status, MATCH_STATUS.COMPLETE);
});

test('任务完成后忽略后续事件', () => {
  const matcher = createTaskMatcher({ mode: 'sequence', target: [60] });
  matcher.accept(on(60));
  const later = matcher.accept(on(62));
  assert.equal(later.status, MATCH_STATUS.IGNORED);
  assert.equal(later.complete, true);
});

test('空目标或重复目标被拒绝', () => {
  assert.throws(() => createTaskMatcher({ mode: 'sequence', target: [] }), /至少一个目标音/);
  assert.throws(() => createTaskMatcher({ mode: 'together', target: [60, 60] }), /不能重复/);
});

test('reset 清空进度', () => {
  const matcher = createTaskMatcher({ mode: 'sequence', target: [60, 62] });
  matcher.accept(on(60));
  matcher.reset('重新开始');
  const status = matcher.status();
  assert.equal(status.index, 0);
  assert.equal(status.complete, false);
  assert.equal(status.feedback, '重新开始');
});

test('非音符事件被忽略', () => {
  const matcher = createTaskMatcher({ mode: 'sequence', target: [60] });
  const result = matcher.accept({ type: 'control-change', controller: 1, value: 20, note: null });
  assert.equal(result.status, MATCH_STATUS.IGNORED);
});
