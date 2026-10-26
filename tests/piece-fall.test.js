import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildFallNotes,
  matchFallNote,
  fallProgress,
  summarizeFall
} from '../src/core/piece-fall.js';

const measures = [
  ['C4:q', 'D4:q', 'E4:q', 'F4:q'],
  ['G4:q', 'F4:q', 'E4:q', 'D4:q']
];

test('buildFallNotes 生成带时间戳的音符序列', () => {
  const notes = buildFallNotes(measures, 60, { leadInMs: 2000 }); // 60 BPM = 1000ms/拍
  assert.equal(notes.length, 8);
  assert.equal(notes[0].note, 60); // C4
  assert.equal(notes[0].timeMs, 2000);
  assert.equal(notes[1].note, 62); // D4
  assert.equal(notes[1].timeMs, 3000, '每四分音符间隔 1000ms');
});

test('matchFallNote 命中正确音符', () => {
  const notes = buildFallNotes(measures, 60, { leadInMs: 2000 });
  const hit = matchFallNote(notes, 60, 2050, 300); // C4 在 2000ms，2050 命中
  assert.ok(hit);
  assert.equal(hit.index, 0);
  assert.equal(hit.hit, true);
  assert.equal(hit.late, true, '晚 50ms');
  assert.equal(hit.errorMs, 50);
});

test('matchFallNote 超出容差不算命中', () => {
  const notes = buildFallNotes(measures, 60, { leadInMs: 2000 });
  const miss = matchFallNote(notes, 60, 2500, 300); // 差 500ms，超出 300ms
  assert.equal(miss, null);
});

test('matchFallNote 音符不匹配不命中', () => {
  const notes = buildFallNotes(measures, 60, { leadInMs: 2000 });
  const wrong = matchFallNote(notes, 99, 2000, 300); // 没有这个音
  assert.equal(wrong, null);
});

test('fallProgress 计算垂直位置', () => {
  // 音符 timeMs=3000，fallDuration=1000，则 2000 时开始出现（0），3000 到击打线（1）
  assert.equal(fallProgress(3000, 2000, 1000), 0);
  assert.equal(fallProgress(3000, 2500, 1000), 0.5);
  assert.equal(fallProgress(3000, 3000, 1000), 1);
  assert.equal(fallProgress(3000, 2500, 0), 0, 'fallDuration 为 0 返回 0');
});

test('summarizeFall 汇总命中', () => {
  const notes = buildFallNotes(measures, 60, { leadInMs: 2000 });
  const hits = [{ index: 0, errorMs: 10 }, { index: 1, errorMs: -20 }, { index: 2, errorMs: 5 }];
  const summary = summarizeFall(notes, hits, 300);
  assert.equal(summary.total, 8);
  assert.equal(summary.hit, 3);
  assert.equal(summary.missed, 5);
  assert.equal(summary.accuracyPercent, 38);
});
