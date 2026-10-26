/**
 * 曲目熟练度（纯逻辑，可单测）。
 *
 * 独立于通用课程进度，为每首曲目记录练习次数、最好节奏准确率与最好力度均匀度，
 * 并据此计算一个「熟练度」等级（1–5 星）。
 */

/**
 * 记录一次曲目练习，返回更新后的 pieceStats。
 * @param {object} stats 当前的 pieceStats（pieceId -> { plays, bestAccuracy, bestEvenness }）
 * @param {string} pieceId
 * @param {object} result 本次结果 { accuracyPercent?, evennessPercent? }
 */
export function recordPieceRun(stats, pieceId, result) {
  const next = { ...(stats || {}) };
  const prev = next[pieceId] || { plays: 0, bestAccuracy: null, bestEvenness: null };
  const updated = {
    plays: prev.plays + 1,
    bestAccuracy: result?.accuracyPercent != null
      ? Math.max(prev.bestAccuracy ?? 0, result.accuracyPercent)
      : prev.bestAccuracy,
    bestEvenness: result?.evennessPercent != null
      ? Math.max(prev.bestEvenness ?? 0, result.evennessPercent)
      : prev.bestEvenness
  };
  next[pieceId] = updated;
  return next;
}

/** 由最好成绩计算熟练度等级（1–5 星）。 */
export function masteryLevel(stat) {
  if (!stat) return 0;
  const accuracy = stat.bestAccuracy ?? 0;
  const evenness = stat.bestEvenness ?? 0;
  const score = Math.min(accuracy, evenness);
  if (score >= 90) return 5;
  if (score >= 75) return 4;
  if (score >= 60) return 3;
  if (score >= 40) return 2;
  return 1;
}

/** 熟练度等级的中文标签与说明。 */
export function masteryLabel(level) {
  const labels = {
    0: '未练习',
    1: '初学',
    2: '熟悉',
    3: '掌握',
    4: '熟练',
    5: '精通'
  };
  return labels[level] || '未练习';
}

/** 生成曲目熟练度摘要（供 UI 展示）。 */
export function pieceMasterySummary(pieceId, stat) {
  return {
    pieceId,
    plays: stat?.plays ?? 0,
    bestAccuracy: stat?.bestAccuracy ?? null,
    bestEvenness: stat?.bestEvenness ?? null,
    level: masteryLevel(stat),
    label: masteryLabel(masteryLevel(stat))
  };
}
