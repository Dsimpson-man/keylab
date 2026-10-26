import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePractice, describePractice } from '../src/core/practice-report.js';

test('空记录返回 null', () => {
  assert.equal(analyzePractice([]), null);
  assert.equal(analyzePractice(null), null);
});

test('力度完全一致时均匀度为 100', () => {
  const records = [
    { note: 60, velocity: 90, timestamp: 0 },
    { note: 62, velocity: 90, timestamp: 500 },
    { note: 64, velocity: 90, timestamp: 1000 }
  ];
  const report = analyzePractice(records);
  assert.equal(report.noteCount, 3);
  assert.equal(report.meanVelocity, 90);
  assert.equal(report.velocityStddev, 0);
  assert.equal(report.evennessPercent, 100);
});

test('力度波动大会降低均匀度', () => {
  const records = [
    { note: 60, velocity: 40, timestamp: 0 },
    { note: 62, velocity: 120, timestamp: 500 },
    { note: 64, velocity: 40, timestamp: 1000 },
    { note: 65, velocity: 120, timestamp: 1500 }
  ];
  const report = analyzePractice(records);
  assert.ok(report.evennessPercent < 80, `均匀度应低于 80，实际 ${report.evennessPercent}`);
});

test('节奏稳定：等间隔时 tempoStabilityMs 为 0', () => {
  const records = [
    { note: 60, velocity: 90, timestamp: 0 },
    { note: 62, velocity: 90, timestamp: 500 },
    { note: 64, velocity: 90, timestamp: 1000 },
    { note: 65, velocity: 90, timestamp: 1500 }
  ];
  const report = analyzePractice(records, { tempoBpm: 120 });
  assert.equal(report.tempoStabilityMs, 0);
  assert.equal(report.meanIntervalMs, 500);
  assert.equal(report.expectedIntervalMs, 500);
  assert.equal(report.meanTempoErrorMs, 0);
});

test('节奏不稳定会体现为 tempoStabilityMs 增大', () => {
  const records = [
    { note: 60, velocity: 90, timestamp: 0 },
    { note: 62, velocity: 90, timestamp: 300 },
    { note: 64, velocity: 90, timestamp: 900 },
    { note: 65, velocity: 90, timestamp: 1100 }
  ];
  const report = analyzePractice(records);
  assert.ok(report.tempoStabilityMs > 0);
});

test('单音记录只有力度，无节奏指标', () => {
  const report = analyzePractice([{ note: 60, velocity: 90, timestamp: 0 }]);
  assert.equal(report.noteCount, 1);
  assert.equal(report.meanVelocity, 90);
  assert.equal(report.meanIntervalMs, null);
  assert.equal(report.tempoStabilityMs, null);
});

test('describePractice 输出中文反馈', () => {
  const report = analyzePractice([
    { note: 60, velocity: 90, timestamp: 0 },
    { note: 62, velocity: 90, timestamp: 500 }
  ]);
  const text = describePractice(report);
  assert.match(text, /2 个音/);
  assert.match(text, /均匀度|节奏/);
});
