import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMeasureRanges,
  analyzeByMeasure,
  weakestMeasures,
  describeWeakMeasures
} from '../src/core/piece-weakness.js';

// 4 小节，每小节 4 个四分音符
const measures = [
  ['C4:q', 'D4:q', 'E4:q', 'F4:q'],
  ['G4:q', 'F4:q', 'E4:q', 'D4:q'],
  ['C4:q', 'D4:q', 'E4:q', 'F4:q'],
  ['G4:q', 'F4:q', 'E4:q', 'D4:q']
];

test('buildMeasureRanges 正确划分小节音符范围', () => {
  const ranges = buildMeasureRanges(measures);
  assert.equal(ranges.length, 4);
  assert.deepEqual(ranges[0].noteRange, [0, 3]);
  assert.deepEqual(ranges[1].noteRange, [4, 7]);
  assert.deepEqual(ranges[2].noteRange, [8, 11]);
  assert.deepEqual(ranges[3].noteRange, [12, 15]);
});

test('analyzeByMeasure 统计每小节命中率', () => {
  const ranges = buildMeasureRanges(measures);
  // 命中第 0 小节全部 4 个音，第 1 小节只 1 个
  const hits = [
    { index: 0, errorMs: 10 }, { index: 1, errorMs: 20 }, { index: 2, errorMs: 15 }, { index: 3, errorMs: 25 },
    { index: 4, errorMs: 30 }
  ];
  const stats = analyzeByMeasure(ranges, hits, 16);
  assert.equal(stats[0].accuracyPercent, 100);
  assert.equal(stats[1].accuracyPercent, 25);
});

test('weakestMeasures 找出命中率最低的小节', () => {
  const hits = [
    { index: 0, errorMs: 10 }, { index: 1, errorMs: 20 }, { index: 2, errorMs: 15 }, { index: 3, errorMs: 25 }, // 小节0 全中 100%
    { index: 4, errorMs: 30 }, // 小节1 中1/4 = 25%
    { index: 8, errorMs: 40 } // 小节2 中1/4 = 25%
  ];
  const weak = weakestMeasures(measures, hits, 16, 3);
  assert.equal(weak[0].measureIndex, 3, '小节3（索引3）命中率 0% 最弱');
  // 小节1 和 2 都是 25%，误差大的排前面（小节2 误差 40ms > 小节1 30ms）
  assert.equal(weak[1].measureIndex, 2, '小节2（误差40ms）排第2');
  assert.equal(weak[2].measureIndex, 1, '小节1（误差30ms）排第3');
});

test('describeWeakMeasures 输出中文', () => {
  const text = describeWeakMeasures([{ measureIndex: 1, accuracyPercent: 25 }]);
  assert.match(text, /第 2 小节/);
  assert.match(text, /25%/);
});
