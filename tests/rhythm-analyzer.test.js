import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBeatGrid, nearestBeat, analyzeRhythm, describeRhythmResult } from '../src/core/rhythm-analyzer.js';

test('拍点网格按 BPM 生成', () => {
  const grid = buildBeatGrid(1000, 60, 4);
  assert.deepEqual(grid, [1000, 2000, 3000, 4000]);
  assert.deepEqual(buildBeatGrid(0, 120, 2), [0, 500]);
  assert.deepEqual(buildBeatGrid(NaN, 120, 4), []);
  assert.deepEqual(buildBeatGrid(0, 0, 4), []);
});

test('最近拍点查找', () => {
  const grid = [0, 500, 1000];
  assert.equal(nearestBeat(520, grid).index, 1);
  assert.equal(nearestBeat(980, grid).index, 2);
  assert.equal(nearestBeat(100, grid).index, 0);
  assert.equal(nearestBeat(100, []), null);
});

test('全部命中时通过，并计算平均误差与稳定性', () => {
  const grid = buildBeatGrid(1000, 60, 4);
  const hits = [{ timeMs: 1010 }, { timeMs: 1990 }, { timeMs: 3012 }, { timeMs: 3998 }];
  const analysis = analyzeRhythm({ hits, grid, toleranceMs: 200 });
  assert.equal(analysis.summary.matched, 4);
  assert.equal(analysis.summary.missed, 0);
  assert.equal(analysis.summary.passed, true);
  assert.equal(analysis.summary.accuracyPercent, 100);
  assert.equal(analysis.summary.extraHits, 0);
  assert.ok(analysis.summary.meanAbsErrorMs <= 15);
  assert.ok(analysis.summary.stabilityMs >= 0);
});

test('超出容差的击点不算命中', () => {
  const grid = buildBeatGrid(0, 60, 2);
  const analysis = analyzeRhythm({ hits: [{ timeMs: 1080 }], grid, toleranceMs: 100 });
  assert.equal(analysis.summary.matched, 1);
  assert.equal(analysis.summary.missed, 1);
  assert.equal(analysis.summary.passed, false);
  assert.equal(analysis.entries[0].onTime, false);
  assert.equal(analysis.entries[1].onTime, true);
});

test('离所有拍点都太远的击点完全不命中', () => {
  const grid = buildBeatGrid(0, 60, 2);
  const analysis = analyzeRhythm({ hits: [{ timeMs: 400 }], grid, toleranceMs: 100 });
  assert.equal(analysis.summary.matched, 0);
  assert.equal(analysis.summary.missed, 2);
  assert.equal(analysis.summary.extraHits, 1);
});

test('早 / 晚标记', () => {
  const grid = buildBeatGrid(0, 60, 2);
  const analysis = analyzeRhythm({ hits: [{ timeMs: -50 }, { timeMs: 1080 }], grid, toleranceMs: 200 });
  assert.equal(analysis.entries[0].early, true);
  assert.equal(analysis.entries[1].late, true);
});

test('多出的击点被计入 extraHits 且不打乱匹配', () => {
  const grid = buildBeatGrid(0, 60, 2);
  const analysis = analyzeRhythm({
    hits: [{ timeMs: 0 }, { timeMs: 20 }, { timeMs: 1000 }],
    grid,
    toleranceMs: 200
  });
  assert.equal(analysis.summary.matched, 2);
  assert.equal(analysis.summary.extraHits, 1);
});

test('同一击点不会被两个拍点重复使用', () => {
  const grid = buildBeatGrid(0, 100, 3);
  const analysis = analyzeRhythm({ hits: [{ timeMs: 300 }], grid, toleranceMs: 700 });
  assert.equal(analysis.summary.matched, 1);
});

test('结果说明文本区分通过、部分命中与全部错过', () => {
  const passed = describeRhythmResult({ beats: 4, hits: 4, matched: 4, missed: 0, extraHits: 0, meanAbsErrorMs: 12, stabilityMs: 8, accuracyPercent: 100, passed: true }, 200);
  assert.match(passed, /4 拍全部/);
  const partial = describeRhythmResult({ beats: 4, hits: 2, matched: 2, missed: 2, extraHits: 0, meanAbsErrorMs: 90, stabilityMs: 30, accuracyPercent: 50, passed: false }, 200);
  assert.match(partial, /2 \/ 4/);
  const none = describeRhythmResult({ beats: 4, hits: 2, matched: 0, missed: 4, extraHits: 2, meanAbsErrorMs: null, stabilityMs: null, accuracyPercent: 0, passed: false }, 200);
  assert.match(none, /没有击点/);
  assert.match(describeRhythmResult(null), /还没有开始/);
});
