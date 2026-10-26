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
  assert.match(result.feedback, /太棒了|完整弹出/);
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

test('等待任务：弹错不重置进度，弹对当前音再前进', () => {
  const matcher = createTaskMatcher({ mode: 'wait', target: [60, 62, 64] });
  matcher.accept(on(60));
  const wrong = matcher.accept(on(65));
  assert.equal(wrong.status, MATCH_STATUS.WRONG);
  assert.equal(wrong.index, 1, '弹错后应停留在当前位置');
  assert.match(wrong.feedback, /保持当前位置/);
  assert.match(wrong.feedback, /D4/);
  const recover = matcher.accept(on(62));
  assert.equal(recover.status, MATCH_STATUS.PROGRESS);
  assert.equal(recover.index, 2);
  const done = matcher.accept(on(64));
  assert.equal(done.status, MATCH_STATUS.COMPLETE);
});

test('等待任务：完整完成', () => {
  const matcher = createTaskMatcher({ mode: 'wait', target: [60, 62] });
  matcher.accept(on(60));
  const result = matcher.accept(on(62));
  assert.equal(result.status, MATCH_STATUS.COMPLETE);
  assert.match(result.feedback, /太棒了|完整弹出/);
});

test('顺序任务：弹回第一个音时从第二步继续', () => {
  const matcher = createTaskMatcher({ mode: 'sequence', target: [60, 62, 64] });
  matcher.accept(on(60));
  const result = matcher.accept(on(60));
  assert.equal(result.status, MATCH_STATUS.RESTART);
  assert.equal(result.index, 1);
});

test('连击：连续正确累加，弹错归零', () => {
  const matcher = createTaskMatcher({ mode: 'sequence', target: [60, 62, 64, 65] });
  matcher.accept(on(60));
  matcher.accept(on(62));
  assert.equal(matcher.status().combo, 2, '连续两个正确，combo=2');
  matcher.accept(on(99)); // 弹错
  assert.equal(matcher.status().combo, 0, '弹错后 combo 归零');
  assert.equal(matcher.status().maxCombo, 2, 'maxCombo 保留峰值');
  matcher.accept(on(60)); // 重新开始
  matcher.accept(on(62));
  matcher.accept(on(64));
  matcher.accept(on(65));
  assert.equal(matcher.status().combo, 4);
  assert.equal(matcher.status().maxCombo, 4);
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
