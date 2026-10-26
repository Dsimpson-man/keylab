/**
 * 本地进度存储（v2）。
 *
 * - 版本化 schema，支持从 v1（0.1.0）迁移。
 * - 所有字段都做类型校验，损坏数据回退到默认值而不是崩溃。
 * - 导出 / 导入 JSON 时只解析数据，不执行任何代码。
 * - 本地日期键（不是 UTC），用于连续学习天数。
 */

export const STORAGE_KEY = 'keylab.progress.v2';
export const LEGACY_STORAGE_KEY = 'keylab.progress.v1';
export const SCHEMA_VERSION = 2;

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function defaultProgress() {
  return {
    version: SCHEMA_VERSION,
    completedLessons: [],
    lessonAttempts: {},
    quizAnswered: 0,
    quizCorrect: 0,
    quizByCategory: {},
    wrongCounts: {},
    practiceNotes: 0,
    practiceSessions: 0,
    earStats: { answered: 0, correct: 0 },
    pieceStats: {},
    activityDays: [],
    lastActiveDate: null,
    clockPractice: 0,
    settings: {
      naming: 'standard',
      keyboardStart: 48,
      keyboardCount: 37,
      monitorHardwareSound: false,
      metronomeBpm: 80,
      metronomeSound: true,
      volume: 0.8,
      metronomeVolume: 0.7,
      eventLogLimit: 300
    },
    ccMappings: {},
    updatedAt: null
  };
}

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const toFiniteInt = (value, fallback = 0) => (Number.isFinite(value) ? Math.max(0, Math.round(value)) : fallback);
const uniqueStrings = value => (Array.isArray(value) ? Array.from(new Set(value.filter(item => typeof item === 'string'))) : []);

export function normalizeProgress(input) {
  const base = defaultProgress();
  if (!isPlainObject(input)) return base;
  const settings = isPlainObject(input.settings) ? input.settings : {};
  const merged = {
    ...base,
    completedLessons: uniqueStrings(input.completedLessons),
    lessonAttempts: isPlainObject(input.lessonAttempts) ? { ...input.lessonAttempts } : {},
    quizAnswered: toFiniteInt(input.quizAnswered),
    quizCorrect: toFiniteInt(input.quizCorrect),
    quizByCategory: isPlainObject(input.quizByCategory) ? { ...input.quizByCategory } : {},
    wrongCounts: isPlainObject(input.wrongCounts)
      ? Object.fromEntries(Object.entries(input.wrongCounts).filter(([, value]) => Number.isFinite(value) && value > 0))
      : {},
    practiceNotes: toFiniteInt(input.practiceNotes),
    practiceSessions: toFiniteInt(input.practiceSessions),
    earStats: isPlainObject(input.earStats)
      ? { answered: toFiniteInt(input.earStats.answered), correct: toFiniteInt(input.earStats.correct) }
      : { answered: 0, correct: 0 },
    pieceStats: isPlainObject(input.pieceStats) ? { ...input.pieceStats } : {},
    activityDays: uniqueStrings(input.activityDays).sort(),
    lastActiveDate: typeof input.lastActiveDate === 'string' ? input.lastActiveDate : null,
    clockPractice: toFiniteInt(input.clockPractice),
    settings: {
      ...base.settings,
      ...(isPlainObject(settings.naming) ? {} : {}),
      naming: settings.naming === 'yamaha' ? 'yamaha' : 'standard',
      keyboardStart: Number.isFinite(settings.keyboardStart) ? Math.max(0, Math.min(115, Math.round(settings.keyboardStart))) : base.settings.keyboardStart,
      keyboardCount: Number.isFinite(settings.keyboardCount) ? Math.max(12, Math.min(88, Math.round(settings.keyboardCount))) : base.settings.keyboardCount,
      monitorHardwareSound: Boolean(settings.monitorHardwareSound),
      metronomeBpm: Number.isFinite(settings.metronomeBpm) ? Math.max(40, Math.min(240, Math.round(settings.metronomeBpm))) : base.settings.metronomeBpm,
      metronomeSound: settings.metronomeSound === undefined ? base.settings.metronomeSound : Boolean(settings.metronomeSound),
      volume: Number.isFinite(settings.volume) ? Math.max(0, Math.min(1, settings.volume)) : base.settings.volume,
      metronomeVolume: Number.isFinite(settings.metronomeVolume) ? Math.max(0, Math.min(1, settings.metronomeVolume)) : base.settings.metronomeVolume,
      eventLogLimit: Number.isFinite(settings.eventLogLimit) ? Math.max(50, Math.min(1000, Math.round(settings.eventLogLimit))) : base.settings.eventLogLimit
    },
    ccMappings: isPlainObject(input.ccMappings) ? { ...input.ccMappings } : {},
    updatedAt: typeof input.updatedAt === 'string' ? input.updatedAt : null
  };
  merged.quizCorrect = Math.min(merged.quizCorrect, merged.quizAnswered);
  return merged;
}

/** 0.1.0 的 v1 结构没有 version / activityDays / settings。 */
export function migrateFromV1(v1) {
  const base = defaultProgress();
  if (!isPlainObject(v1)) return base;
  const lastActiveDate = typeof v1.lastActiveDate === 'string' ? v1.lastActiveDate : null;
  return normalizeProgress({
    ...base,
    completedLessons: v1.completedLessons,
    quizAnswered: v1.quizAnswered,
    quizCorrect: v1.quizCorrect,
    practiceNotes: v1.practiceNotes,
    practiceSessions: v1.practiceSessions,
    lastActiveDate,
    activityDays: lastActiveDate ? [lastActiveDate] : [],
    updatedAt: new Date().toISOString()
  });
}

function safeStorage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch (_) {
    return null;
  }
}

export function loadProgress(storage = safeStorage()) {
  if (!storage) return defaultProgress();
  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch (_) {
    return defaultProgress();
  }
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isPlainObject(parsed) && parsed.version === SCHEMA_VERSION) return normalizeProgress(parsed);
      return normalizeProgress(parsed);
    } catch (_) {
      // 损坏的 v2 数据：尝试 v1，再回退默认值，绝不抛出。
    }
  }
  try {
    const legacy = storage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const migrated = migrateFromV1(JSON.parse(legacy));
      try { storage.setItem(STORAGE_KEY, JSON.stringify(migrated)); } catch (_) { /* ignore */ }
      return migrated;
    }
  } catch (_) { /* ignore */ }
  return defaultProgress();
}

export function saveProgress(progress, storage = safeStorage()) {
  const normalized = normalizeProgress(progress);
  normalized.updatedAt = new Date().toISOString();
  if (!storage) return { ok: false, reason: 'unavailable' };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: 'quota-or-blocked', error };
  }
}

/** 记录今天为学习日（本地时区）。返回进度是否改变。 */
export function markActiveDay(progress, date = new Date()) {
  const key = localDateKey(date);
  if (!progress.activityDays.includes(key)) progress.activityDays.push(key);
  progress.activityDays.sort();
  progress.lastActiveDate = key;
  return progress;
}

/** 连续学习天数：从今天（或昨天）往前数。 */
export function calculateStreak(activityDays, today = new Date()) {
  if (!Array.isArray(activityDays) || activityDays.length === 0) return 0;
  const set = new Set(activityDays);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!set.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(localDateKey(cursor))) return 0;
  }
  let streak = 0;
  while (set.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function quizAccuracy(progress) {
  if (!progress.quizAnswered) return null;
  return Math.round((progress.quizCorrect / progress.quizAnswered) * 100);
}

/** 导出为可读 JSON。不包含任何标识信息，只有学习统计。 */
export function exportProgress(progress, { appVersion = '0.2.0-beta' } = {}) {
  return JSON.stringify({
    app: 'KeyLab',
    appVersion,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    progress: normalizeProgress(progress)
  }, null, 2);
}

/**
 * 解析并校验导入文件，返回 { ok, progress, warnings, error }。
 * 只处理 JSON 数据；不要对导入内容执行 eval / Function。
 */
export function parseImport(text) {
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, error: '文件为空。' };
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (_) {
    return { ok: false, error: '不是有效的 JSON 文件，请选择 KeyLab 导出的备份。' };
  }
  if (!isPlainObject(parsed)) return { ok: false, error: '文件结构不正确：顶层必须是对象。' };
  const warnings = [];
  let rawProgress = null;
  if (isPlainObject(parsed.progress)) {
    rawProgress = parsed.progress;
    if (parsed.app !== 'KeyLab') warnings.push('文件未标注为 KeyLab 导出，仍按进度数据尝试导入。');
    if (Number(parsed.schemaVersion) > SCHEMA_VERSION) warnings.push(`备份版本（${parsed.schemaVersion}）高于当前支持的版本（${SCHEMA_VERSION}），未知字段会被忽略。`);
  } else if (parsed.version === SCHEMA_VERSION || Array.isArray(parsed.completedLessons)) {
    rawProgress = parsed;
    warnings.push('文件没有外层包装，已按原始进度数据解析。');
  } else {
    return { ok: false, error: '文件里没有找到可识别的 KeyLab 进度数据。' };
  }
  const progress = normalizeProgress(rawProgress);
  if (!Array.isArray(rawProgress.completedLessons)) warnings.push('缺少 completedLessons，将按空列表处理。');
  return { ok: true, progress, warnings, exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : null };
}

/** 导入前预览：只列出会覆盖的关键统计，便于用户确认。 */
export function summarizeImport(progress) {
  return {
    completedLessons: progress.completedLessons.length,
    quizAnswered: progress.quizAnswered,
    quizCorrect: progress.quizCorrect,
    practiceNotes: progress.practiceNotes,
    practiceSessions: progress.practiceSessions,
    activityDays: progress.activityDays.length,
    updatedAt: progress.updatedAt
  };
}
