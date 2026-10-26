import test from 'node:test';
import assert from 'node:assert/strict';
import {
  noteName, octaveOf, noteNumberFromName, midiToFrequency, intervalSemitones, intervalName,
  isBlackKey, pitchClass, majorScale, naturalMinorScale, triad, chordName, describePitchError,
  describeRelation, isValidMidiNote, clampMidiNote, scaleDegreeName, NAMING_CONVENTIONS
} from '../src/core/music-theory.js';

test('中央 C 在标准命名下是 C4 / MIDI 60', () => {
  assert.equal(noteName(60), 'C4');
  assert.equal(octaveOf(60), 4);
  assert.equal(noteName(60, { naming: 'yamaha' }), 'C3');
  assert.equal(octaveOf(60, 'yamaha'), 3);
});

test('音名覆盖全部 12 个半音', () => {
  const names = Array.from({ length: 12 }, (_, index) => noteName(60 + index));
  assert.deepEqual(names, ['C4', 'C♯4', 'D4', 'D♯4', 'E4', 'F4', 'F♯4', 'G4', 'G♯4', 'A4', 'A♯4', 'B4']);
});

test('降号命名可用', () => {
  assert.equal(noteName(61, { accidentals: 'flat' }), 'D♭4');
  assert.equal(noteName(70, { accidentals: 'flat' }), 'B♭4');
});

test('黑键与白键判断', () => {
  assert.equal(isBlackKey(61), true);
  assert.equal(isBlackKey(60), false);
  assert.equal(isBlackKey(70), true);
  assert.equal(pitchClass(72), 0);
  assert.equal(pitchClass(-1), 11);
});

test('音符名称可反向解析，且两种命名习惯对应同一 MIDI 编号', () => {
  assert.equal(noteNumberFromName('C4'), 60);
  assert.equal(noteNumberFromName('C3', 'yamaha'), 60);
  assert.equal(noteNumberFromName('A4'), 69);
  assert.equal(noteNumberFromName('C♯4'), 61);
  assert.equal(noteNumberFromName('Db4'), 61, 'ASCII 降号 b 与 ♭ 等价');
  assert.equal(noteNumberFromName('D♭4'), 61);
  assert.equal(noteNumberFromName('D x4'), null);
  assert.equal(noteNumberFromName('无效'), null);
  assert.equal(noteNumberFromName('C10'), null);
});

test('A4 = 440 Hz，八度翻倍', () => {
  assert.equal(Math.round(midiToFrequency(69) * 1000) / 1000, 440);
  assert.equal(midiToFrequency(81), 880);
  assert.equal(Math.round(midiToFrequency(60)), 262);
  assert.equal(midiToFrequency(200), null);
});

test('音程计算与命名', () => {
  assert.equal(intervalSemitones(60, 67), 7);
  assert.equal(intervalSemitones(67, 60), -7);
  assert.equal(intervalName(1), '小二度');
  assert.equal(intervalName(2), '大二度');
  assert.equal(intervalName(4), '大三度');
  assert.equal(intervalName(7), '纯五度');
  assert.equal(intervalName(12), '纯八度');
  assert.equal(intervalName(14), '1 个八度 + 大二度');
});

test('错误反馈说明实际音与目标音的关系', () => {
  const message = describePitchError(62, 60);
  assert.match(message, /D4/);
  assert.match(message, /C4/);
  assert.match(message, /高 2 个半音/);
});

test('关系描述包含方向与距离', () => {
  const up = describeRelation(60, 67);
  assert.equal(up.distance, 7);
  assert.equal(up.direction, 'up');
  assert.match(up.text, /向上 7 个半音/);
  const down = describeRelation(67, 60);
  assert.equal(down.direction, 'down');
  assert.match(down.text, /向下 7 个半音/);
});

test('C 大调音阶全部是白键', () => {
  const scale = majorScale(60);
  assert.deepEqual(scale, [60, 62, 64, 65, 67, 69, 71, 72]);
  assert.ok(scale.every(note => !isBlackKey(note)));
});

test('A 自然小调', () => {
  assert.deepEqual(naturalMinorScale(57), [57, 59, 60, 62, 64, 65, 67, 69]);
});

test('三和弦组成音与名称', () => {
  assert.deepEqual(triad(60, 'major'), [60, 64, 67]);
  assert.deepEqual(triad(57, 'minor'), [57, 60, 64]);
  assert.deepEqual(triad(59, 'diminished'), [59, 62, 65]);
  assert.equal(chordName(60, 'major'), 'C 大三和弦');
  assert.equal(chordName(57, 'minor'), 'A 小三和弦');
});

test('音阶级数名称', () => {
  assert.equal(scaleDegreeName(0), '主音');
  assert.equal(scaleDegreeName(4), '属音');
  assert.equal(scaleDegreeName(6), '导音');
  assert.equal(scaleDegreeName(9), '第 10 个音');
});

test('MIDI 音符边界校验', () => {
  assert.equal(isValidMidiNote(0), true);
  assert.equal(isValidMidiNote(127), true);
  assert.equal(isValidMidiNote(128), false);
  assert.equal(isValidMidiNote(60.5), false);
  assert.equal(clampMidiNote(-5), 0);
  assert.equal(clampMidiNote(999), 127);
  assert.equal(noteName(128), '—');
});

test('命名习惯表结构完整', () => {
  assert.equal(NAMING_CONVENTIONS.standard.middleC, 60);
  assert.equal(NAMING_CONVENTIONS.yamaha.octaveShift, -1);
});
