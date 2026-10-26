/**
 * 节奏分析。
 *
 * 只使用真实收到的时间戳（performance.now 或 MIDI 事件的 timestamp），
 * 不根据点击次数评分。可用于课程节奏任务、节拍器练习和测验。
 */

/** 依据开始时间、速度和拍数生成每个拍点的时间（毫秒）。 */
export function buildBeatGrid(startTimeMs, bpm, beats) {
  if (!Number.isFinite(startTimeMs) || !Number.isFinite(bpm) || bpm <= 0 || beats <= 0) return [];
  const interval = 60000 / bpm;
  return Array.from({ length: Math.round(beats) }, (_, index) => startTimeMs + index * interval);
}

/** 找到离给定时间最近的拍点。 */
export function nearestBeat(timeMs, grid) {
  if (!grid.length) return null;
  let best = null;
  grid.forEach((targetTime, index) => {
    const errorMs = timeMs - targetTime;
    if (!best || Math.abs(errorMs) < Math.abs(best.errorMs)) best = { index, targetTime, errorMs };
  });
  return best;
}

/**
 * 将演奏击点匹配到拍点。
 * 每个拍点只匹配一次，优先使用误差最小的击点；超出容差的击点不匹配。
 */
export function analyzeRhythm({ hits = [], grid = [], toleranceMs = 200 } = {}) {
  const sortedHits = hits
    .filter(hit => Number.isFinite(hit.timeMs ?? hit.time ?? hit.timestamp))
    .map((hit, order) => ({
      timeMs: hit.timeMs ?? hit.time ?? hit.timestamp,
      order,
      velocity: hit.velocity ?? null
    }))
    .sort((a, b) => a.timeMs - b.timeMs);

  const candidates = [];
  for (const hit of sortedHits) {
    for (let index = 0; index < grid.length; index += 1) {
      const errorMs = hit.timeMs - grid[index];
      if (Math.abs(errorMs) <= toleranceMs) candidates.push({ index, hit, errorMs: Math.round(errorMs * 10) / 10 });
    }
  }
  candidates.sort((a, b) => Math.abs(a.errorMs) - Math.abs(b.errorMs));

  const usedBeats = new Set();
  const usedHits = new Set();
  const matched = new Map();
  for (const candidate of candidates) {
    if (usedBeats.has(candidate.index) || usedHits.has(candidate.hit.order)) continue;
    usedBeats.add(candidate.index);
    usedHits.add(candidate.hit.order);
    matched.set(candidate.index, { ...candidate.hit, errorMs: candidate.errorMs });
  }

  const entries = grid.map((targetTime, index) => {
    const hit = matched.get(index);
    return {
      beat: index + 1,
      targetTime: Math.round(targetTime),
      actualTime: hit ? Math.round(hit.timeMs) : null,
      errorMs: hit ? hit.errorMs : null,
      onTime: Boolean(hit),
      early: Boolean(hit && hit.errorMs < 0),
      late: Boolean(hit && hit.errorMs > 0)
    };
  });

  const matchedEntries = entries.filter(entry => entry.onTime);
  const errors = matchedEntries.map(entry => entry.errorMs);
  const meanError = errors.length ? errors.reduce((sum, value) => sum + value, 0) / errors.length : 0;
  const meanAbsError = errors.length ? errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length : null;
  const variance = errors.length ? errors.reduce((sum, value) => sum + (value - meanError) ** 2, 0) / errors.length : 0;
  const extraHits = sortedHits.length - usedHits.size;

  return {
    entries,
    summary: {
      beats: grid.length,
      hits: sortedHits.length,
      matched: matchedEntries.length,
      missed: grid.length - matchedEntries.length,
      extraHits: Math.max(0, extraHits),
      meanErrorMs: Math.round(meanError),
      meanAbsErrorMs: meanAbsError === null ? null : Math.round(meanAbsError),
      stabilityMs: errors.length ? Math.round(Math.sqrt(variance)) : null,
      accuracyPercent: grid.length ? Math.round((matchedEntries.length / grid.length) * 100) : 0,
      passed: grid.length > 0 && matchedEntries.length === grid.length
    }
  };
}

/** 人类可读的节奏结果说明。 */
export function describeRhythmResult(summary, toleranceMs = 200) {
  if (!summary || !summary.beats) return '还没有开始节奏练习。';
  if (summary.passed) {
    return `4 拍全部落在 ±${toleranceMs} 毫秒内，平均偏差 ${summary.meanAbsErrorMs} 毫秒。节奏稳定性约 ±${summary.stabilityMs} 毫秒。`;
  }
  if (summary.matched === 0) {
    return `没有击点落在拍点 ±${toleranceMs} 毫秒内。先听两拍，再尝试跟着节拍器弹奏。`;
  }
  return `${summary.matched} / ${summary.beats} 拍准确。${summary.missed} 拍没有在容许范围内收到击点。平均偏差 ${summary.meanAbsErrorMs} 毫秒，可以放慢速度再试。`;
}
