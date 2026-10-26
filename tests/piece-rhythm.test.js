import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCell,
  melodyNotesWithBeats,
  buildNoteGrid,
  analyzePieceRhythm,
  describePieceRhythm,
  DURATION_BEATS
} from '../src/core/piece-rhythm.js';

test('时值映射正确', () => {
  assert.equal(DURATION_BEATS.w, 4);
  assert.equal(DURATION_BEATS.h, 2);
  assert.equal(DURATION_BEATS.q, 1);
  assert.equal(DURATION_BEATS.e, 0.5);
  assert.equal(DURATION_BEATS.dq, 1.5);
  assert.equal(DURATION_BEATS.dh, 3);
  assert.equal(DURATION_BEATS.de, 0.75);
});

test('parseCell 解析单音', () => {
  assert.deepEqual(parseCell('C4:q'), { note: 60, beats: 1, isRest: false });
  assert.deepEqual(parseCell('G#4:q'), { note: 68, beats: 1, isRest: false });
});

test('parseCell 解析和弦（取最高音）', () => {
  assert.deepEqual(parseCell('[C4,E4,G4]:h'), { note: 67, beats: 2, isRest: false });
});

test('parseCell 解析休止符', () => {
  assert.deepEqual(parseCell('R:q'), { note: null, beats: 1, isRest: true });
  assert.deepEqual(parseCell('R:h'), { note: null, beats: 2, isRest: true });
});

test('melodyNotesWithBeats 跳过休止符但推进拍数', () => {
  const measures = [
    ['C4:q', 'D4:q', 'R:q', 'E4:q']
  ];
  const melody = melodyNotesWithBeats(measures);
  assert.equal(melody.length, 3);
  assert.equal(melody[0].note, 60);
  assert.equal(melody[0].beat, 0);
  assert.equal(melody[1].note, 62);
  assert.equal(melody[1].beat, 1);
  assert.equal(melody[2].note, 64);
  assert.equal(melody[2].beat, 3, '休止符应推进拍数，使 E4 落在第 3 拍');
});

test('buildNoteGrid 按时值生成期望时间点', () => {
  const melody = melodyNotesWithBeats([
    ['C4:q', 'D4:q', 'E4:h']
  ]);
  const grid = buildNoteGrid(melody, 60); // 60 BPM = 1000ms/拍
  assert.equal(grid[0].startMs, 0);
  assert.equal(grid[1].startMs, 1000);
  assert.equal(grid[2].startMs, 2000);
});

test('analyzePieceRhythm 匹配正确且计算偏差', () => {
  const grid = [
    { note: 60, startMs: 0 },
    { note: 62, startMs: 1000 },
    { note: 64, startMs: 2000 }
  ];
  const records = [
    { note: 60, timestamp: 50, velocity: 90 },
    { note: 62, timestamp: 1050, velocity: 90 },
    { note: 64, timestamp: 1990, velocity: 90 }
  ];
  const result = analyzePieceRhythm(records, grid, { toleranceMs: 300 });
  assert.equal(result.entries.length, 3);
  assert.equal(result.summary.onTime, 3);
  assert.equal(result.summary.accuracyPercent, 100);
  assert.equal(result.summary.meanAbsErrorMs, Math.round((50 + 50 + 10) / 3));
});

test('analyzePieceRhythm 标记早/晚/未命中', () => {
  const grid = [{ note: 60, startMs: 0 }, { note: 62, startMs: 1000 }];
  const records = [{ note: 60, timestamp: -500 }, { note: 62, timestamp: 2000 }];
  const result = analyzePieceRhythm(records, grid, { toleranceMs: 300 });
  assert.equal(result.entries[0].early, true);
  assert.equal(result.entries[1].late, true);
  assert.equal(result.summary.onTime, 0);
});

test('describePieceRhythm 输出中文', () => {
  const text = describePieceRhythm({ expected: 3, played: 3, onTime: 3, missed: 0, accuracyPercent: 100, meanAbsErrorMs: 20 }, 300);
  assert.match(text, /100%/);
  assert.match(text, /平均偏差 20 毫秒/);
});
