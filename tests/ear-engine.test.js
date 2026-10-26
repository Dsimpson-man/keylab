import test from 'node:test';
import assert from 'node:assert/strict';
import {
  makeIntervalEarQuestion,
  makeChordEarQuestion,
  makeMelodyEarQuestion,
  judgeEar,
  earQuestionNotes
} from '../src/core/ear-engine.js';

test('音程题：有 4 个选项且答案在范围内', () => {
  const q = makeIntervalEarQuestion(60, () => 0.5);
  assert.equal(q.type, 'interval');
  assert.equal(q.options.length, 4);
  assert.ok(q.answer >= 0 && q.answer < 4);
  assert.ok(q.targetNote > q.rootNote);
});

test('音程题：答案对应正确的音程', () => {
  // 用固定随机，让它选中第 5 个音程（纯四度，semitones 5）。
  const q = makeIntervalEarQuestion(60, () => 0.55);
  assert.equal(q.targetNote - q.rootNote, 5);
  assert.equal(q.options[q.answer], '纯四度');
});

test('和弦题：生成三个音', () => {
  const q = makeChordEarQuestion(60, () => 0.5);
  assert.equal(q.type, 'chord');
  assert.equal(q.notes.length, 3);
  assert.equal(q.notes[0], 60);
  assert.equal(q.options.length, 4);
});

test('旋律题：上行/下行二选一', () => {
  const qUp = makeMelodyEarQuestion(60, () => 0.1); // < 0.5 => up
  assert.equal(qUp.options[0], '上行');
  assert.ok(qUp.notes[0] < qUp.notes[qUp.notes.length - 1]);

  const qDown = makeMelodyEarQuestion(60, () => 0.9); // > 0.5 => down
  assert.ok(qDown.notes[0] > qDown.notes[qDown.notes.length - 1]);
});

test('判分正确/错误', () => {
  const q = makeIntervalEarQuestion(60, () => 0.5);
  const right = judgeEar(q, q.answer);
  assert.equal(right.correct, true);
  assert.match(right.feedback, /回答正确/);

  const wrongIndex = (q.answer + 1) % 4;
  const wrong = judgeEar(q, wrongIndex);
  assert.equal(wrong.correct, false);
  assert.match(wrong.feedback, /答案是/);
});

test('earQuestionNotes 返回播放用的音符', () => {
  const interval = makeIntervalEarQuestion(60, () => 0.5);
  assert.equal(earQuestionNotes(interval).length, 2);

  const chord = makeChordEarQuestion(60, () => 0.5);
  assert.equal(earQuestionNotes(chord).length, 3);

  const melody = makeMelodyEarQuestion(60, () => 0.5);
  assert.ok(earQuestionNotes(melody).length >= 3);
});
