/**
 * 逐小节薄弱定位（纯逻辑，可单测）。
 *
 * 把整首曲目的命中结果按「小节」切分，找出哪些小节弹得最差（命中率最低、误差最大），
 * 供结束报告「一键循环重练薄弱小节」使用。
 */

import { melodyNotesWithBeats, parseCell } from './piece-rhythm.js';

/**
 * 为每个小节分配音符索引范围，以及每个小节的起始拍。
 * @param {string[][]} measures
 * @returns {Array<{measureIndex:number, noteRange:[number,number], startBeat:number, endBeat:number}>}
 */
export function buildMeasureRanges(measures) {
  const ranges = [];
  let beat = 0;
  let noteIndex = 0;
  for (let mi = 0; mi < (measures || []).length; mi += 1) {
    const measure = measures[mi];
    const startBeat = beat;
    let noteCount = 0;
    for (const cell of measure) {
      const parsed = parseCell(cell);
      if (!parsed) continue;
      if (!parsed.isRest && parsed.note != null) noteCount += 1;
      beat += parsed.beats;
    }
    ranges.push({
      measureIndex: mi,
      noteRange: noteCount ? [noteIndex, noteIndex + noteCount - 1] : null,
      startBeat,
      endBeat: beat
    });
    noteIndex += noteCount;
  }
  return ranges;
}

/**
 * 按小节统计命中情况，找出薄弱小节。
 * @param {Array<{measureIndex:number, noteRange:[number,number]}>} ranges
 * @param {Array<{index:number, errorMs:number}>} hits 命中的音符（index 为全局音符索引）
 * @param {number} totalNotes 全局音符总数
 * @returns {Array<{measureIndex:number, noteCount:number, hitCount:number, accuracyPercent:number, meanAbsErrorMs:number|null}>}
 */
export function analyzeByMeasure(ranges, hits, totalNotes) {
  const hitMap = new Map();
  for (const hit of hits || []) {
    if (Number.isInteger(hit?.index)) hitMap.set(hit.index, hit.errorMs ?? 0);
  }
  return (ranges || []).map(range => {
    if (!range.noteRange) {
      return { measureIndex: range.measureIndex, noteCount: 0, hitCount: 0, accuracyPercent: 100, meanAbsErrorMs: null };
    }
    const [start, end] = range.noteRange;
    const noteCount = end - start + 1;
    let hitCount = 0;
    let errorSum = 0;
    let errorCount = 0;
    for (let i = start; i <= end; i += 1) {
      if (hitMap.has(i)) {
        hitCount += 1;
        errorSum += Math.abs(hitMap.get(i));
        errorCount += 1;
      }
    }
    return {
      measureIndex: range.measureIndex,
      noteCount,
      hitCount,
      accuracyPercent: noteCount ? Math.round((hitCount / noteCount) * 100) : 100,
      meanAbsErrorMs: errorCount ? Math.round(errorSum / errorCount) : null
    };
  });
}

/** 找出最薄弱的 N 个小节（命中率最低，其次误差最大）。 */
export function weakestMeasures(measures, hits, totalNotes, count = 3) {
  const ranges = buildMeasureRanges(measures);
  const stats = analyzeByMeasure(ranges, hits, totalNotes);
  return stats
    .filter(s => s.noteCount > 0)
    .sort((a, b) => {
      if (a.accuracyPercent !== b.accuracyPercent) return a.accuracyPercent - b.accuracyPercent;
      return (b.meanAbsErrorMs ?? 0) - (a.meanAbsErrorMs ?? 0);
    })
    .slice(0, count);
}

/** 人类可读的薄弱小节提示。 */
export function describeWeakMeasures(weak) {
  if (!weak || !weak.length) return '没有明显的薄弱小节。';
  return weak.map(w => `第 ${w.measureIndex + 1} 小节（命中 ${w.accuracyPercent}%）`).join('、');
}
