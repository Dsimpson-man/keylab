import test from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultProgress, normalizeProgress, migrateFromV1, loadProgress, saveProgress, markActiveDay,
  calculateStreak, localDateKey, quizAccuracy, exportProgress, parseImport, summarizeImport,
  STORAGE_KEY, LEGACY_STORAGE_KEY, SCHEMA_VERSION
} from '../src/storage/progress-store.js';

function memoryStorage(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: key => { store.delete(key); },
    dump: () => Object.fromEntries(store)
  };
}

test('默认进度包含 v2 版本与设置', () => {
  const empty = defaultProgress();
  assert.equal(empty.version, SCHEMA_VERSION);
  assert.deepEqual(empty.completedLessons, []);
  assert.equal(empty.settings.naming, 'standard');
  assert.equal(empty.settings.keyboardStart, 48);
  assert.equal(empty.settings.keyboardCount, 37);
});

test('损坏或异常字段会被规范化', () => {
  const normalized = normalizeProgress({
    completedLessons: ['a', 'a', 3, null],
    quizAnswered: -4,
    quizCorrect: 999,
    settings: { keyboardStart: -50, keyboardCount: 9999, naming: 'unknown', metronomeBpm: 1 }
  });
  assert.deepEqual(normalized.completedLessons, ['a']);
  assert.equal(normalized.quizAnswered, 0);
  assert.equal(normalized.quizCorrect, 0);
  assert.ok(normalized.quizCorrect <= normalized.quizAnswered);
  assert.equal(normalized.settings.keyboardStart, 0);
  assert.equal(normalized.settings.keyboardCount, 88);
  assert.equal(normalized.settings.naming, 'standard');
  assert.equal(normalized.settings.metronomeBpm, 40);
});

test('v1 数据迁移为 v2 并保留统计', () => {
  const migrated = migrateFromV1({
    completedLessons: ['find-c'],
    quizAnswered: 10,
    quizCorrect: 8,
    practiceNotes: 120,
    practiceSessions: 4,
    lastActiveDate: '2026-10-20'
  });
  assert.equal(migrated.version, SCHEMA_VERSION);
  assert.deepEqual(migrated.completedLessons, ['find-c']);
  assert.equal(migrated.quizAnswered, 10);
  assert.equal(migrated.practiceNotes, 120);
  assert.deepEqual(migrated.activityDays, ['2026-10-20']);
  assert.equal(migrated.lastActiveDate, '2026-10-20');
});

test('loadProgress 读取 v2、迁移 v1、处理损坏 JSON', () => {
  const v2 = memoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 2, completedLessons: ['x'], practiceNotes: 7 }) });
  assert.deepEqual(loadProgress(v2).completedLessons, ['x']);

  const v1 = memoryStorage({ [LEGACY_STORAGE_KEY]: JSON.stringify({ completedLessons: ['legacy'], quizAnswered: 3 }) });
  const migrated = loadProgress(v1);
  assert.deepEqual(migrated.completedLessons, ['legacy']);
  assert.ok(v1.getItem(STORAGE_KEY), '迁移后应写入 v2 键');

  const broken = memoryStorage({ [STORAGE_KEY]: '{ not json' });
  assert.deepEqual(loadProgress(broken).completedLessons, []);
});

test('saveProgress 写入并可回读', () => {
  const storage = memoryStorage();
  const progress = defaultProgress();
  progress.completedLessons.push('a');
  const result = saveProgress(progress, storage);
  assert.equal(result.ok, true);
  const reloaded = loadProgress(storage);
  assert.deepEqual(reloaded.completedLessons, ['a']);
  assert.ok(reloaded.updatedAt);
});

test('本地日期键不是 UTC 截断', () => {
  const date = new Date(2026, 9, 26, 0, 30, 0);
  assert.equal(localDateKey(date), '2026-10-26');
});

test('连续学习天数计算', () => {
  const today = new Date(2026, 9, 26);
  assert.equal(calculateStreak([], today), 0);
  assert.equal(calculateStreak(['2026-10-26'], today), 1);
  assert.equal(calculateStreak(['2026-10-24', '2026-10-25', '2026-10-26'], today), 3);
  // 今天还没学，但昨天学过：连续天数仍然有效。
  assert.equal(calculateStreak(['2026-10-24', '2026-10-25'], today), 2);
  // 中断超过一天则清零。
  assert.equal(calculateStreak(['2026-10-20'], today), 0);
});

test('markActiveDay 去重并排序', () => {
  const progress = defaultProgress();
  markActiveDay(progress, new Date(2026, 9, 26));
  markActiveDay(progress, new Date(2026, 9, 25));
  markActiveDay(progress, new Date(2026, 9, 26));
  assert.deepEqual(progress.activityDays, ['2026-10-25', '2026-10-26']);
  assert.equal(progress.lastActiveDate, '2026-10-26');
});

test('正确率计算', () => {
  assert.equal(quizAccuracy(defaultProgress()), null);
  assert.equal(quizAccuracy({ quizAnswered: 4, quizCorrect: 3 }), 75);
});

test('导出与导入往返一致', () => {
  const progress = normalizeProgress({ completedLessons: ['a', 'b'], quizAnswered: 5, quizCorrect: 4, practiceNotes: 90 });
  const text = exportProgress(progress);
  const parsed = parseImport(text);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.progress.completedLessons, ['a', 'b']);
  assert.equal(parsed.progress.quizAnswered, 5);
  assert.deepEqual(parsed.warnings, []);
});

test('导入拒绝无效输入', () => {
  assert.equal(parseImport('').ok, false);
  assert.equal(parseImport('not json').ok, false);
  assert.equal(parseImport('[]').ok, false);
  assert.equal(parseImport('{"foo":1}').ok, false);
});

test('导入兼容裸进度对象并给出警告', () => {
  const parsed = parseImport(JSON.stringify({ version: 2, completedLessons: ['x'] }));
  assert.equal(parsed.ok, true);
  assert.ok(parsed.warnings.length > 0);
  assert.deepEqual(parsed.progress.completedLessons, ['x']);
});

test('导入更高版本给出警告但仍可解析', () => {
  const parsed = parseImport(JSON.stringify({ app: 'KeyLab', schemaVersion: 99, progress: { completedLessons: ['y'] } }));
  assert.equal(parsed.ok, true);
  assert.ok(parsed.warnings.some(item => item.includes('99')));
});

test('导入预览摘要', () => {
  const summary = summarizeImport(normalizeProgress({ completedLessons: ['a'], quizAnswered: 2, quizCorrect: 2 }));
  assert.equal(summary.completedLessons, 1);
  assert.equal(summary.quizAnswered, 2);
  assert.equal(summary.quizCorrect, 2);
});
