import test from 'node:test';
import assert from 'node:assert/strict';
import { recordPieceRun, masteryLevel, masteryLabel, pieceMasterySummary } from '../src/core/piece-mastery.js';

test('首次记录建立 stats', () => {
  const next = recordPieceRun({}, 'songs-b-001', { accuracyPercent: 80, evennessPercent: 90 });
  assert.equal(next['songs-b-001'].plays, 1);
  assert.equal(next['songs-b-001'].bestAccuracy, 80);
  assert.equal(next['songs-b-001'].bestEvenness, 90);
});

test('多次练习取最好成绩', () => {
  let stats = recordPieceRun({}, 'songs-b-001', { accuracyPercent: 60, evennessPercent: 70 });
  stats = recordPieceRun(stats, 'songs-b-001', { accuracyPercent: 95, evennessPercent: 80 });
  stats = recordPieceRun(stats, 'songs-b-001', { accuracyPercent: 40, evennessPercent: 99 });
  assert.equal(stats['songs-b-001'].plays, 3);
  assert.equal(stats['songs-b-001'].bestAccuracy, 95, '应保留最高的 accuracy');
  assert.equal(stats['songs-b-001'].bestEvenness, 99, '应保留最高的 evenness');
});

test('熟练度等级按最低分档', () => {
  assert.equal(masteryLevel({ bestAccuracy: 95, bestEvenness: 92 }), 5);
  assert.equal(masteryLevel({ bestAccuracy: 80, bestEvenness: 60 }), 3, '取两者较低者');
  assert.equal(masteryLevel({ bestAccuracy: 30, bestEvenness: 90 }), 1);
  assert.equal(masteryLevel(null), 0);
});

test('熟练度标签', () => {
  assert.equal(masteryLabel(5), '精通');
  assert.equal(masteryLabel(0), '未练习');
  assert.equal(masteryLabel(99), '未练习');
});

test('摘要', () => {
  const summary = pieceMasterySummary('songs-b-001', { plays: 2, bestAccuracy: 88, bestEvenness: 85 });
  assert.equal(summary.plays, 2);
  assert.equal(summary.level, 4);
  assert.equal(summary.label, '熟练');
});
