/**
 * 瀑布流（落球）跟弹引擎（纯逻辑，可单测）。
 *
 * 把曲目旋律转成「按时间依次落下」的音符序列，并把用户按键匹配到期望时间点。
 * 这是商业产品「不用识谱也能跟弹」的核心：音符到击打线时按对应的键即可。
 *
 * 与 piece-rhythm 的区别：这里是为「实时渲染瀑布流」设计的数据结构，
 * 输出每个音符的屏幕位置（相对时间）与命中判定。
 */

import { melodyNotesWithBeats } from './piece-rhythm.js';

/**
 * 由 measures + bpm 生成瀑布流音符序列。
 * @param {string[][]} measures Pianio 格式的 measures
 * @param {number} bpm 速度
 * @param {object} options
 * @param {number} options.leadInMs 第一个音之前的预留时间（毫秒）
 * @returns {Array<{note:number, timeMs:number, beat:number, beats:number}>}
 */
export function buildFallNotes(measures, bpm, { leadInMs = 2000 } = {}) {
  const melody = melodyNotesWithBeats(measures);
  const msPerBeat = 60000 / bpm;
  return melody.map((item, index) => ({
    note: item.note,
    beat: item.beat,
    beats: item.beats,
    timeMs: Math.round(leadInMs + index * msPerBeat * item.beats)
  }));
}

/**
 * 判定一个按键是否命中某个瀑布流音符。
 * @param {Array<{note:number, timeMs:number}>} fallNotes
 * @param {number} note 用户按下的 MIDI 编号
 * @param {number} timeMs 用户按下的时间（performance.now 毫秒）
 * @param {number} toleranceMs 容许误差（毫秒）
 * @returns {null | {index, note, hit:boolean, early:boolean, late:boolean, errorMs}}
 */
export function matchFallNote(fallNotes, note, timeMs, toleranceMs = 300) {
  if (!Array.isArray(fallNotes) || !fallNotes.length) return null;
  // 找到最近的、音符一致的、尚未被判定的候选。
  let best = null;
  for (let i = 0; i < fallNotes.length; i += 1) {
    const candidate = fallNotes[i];
    if (candidate.note !== note) continue;
    if (candidate.done) continue;
    const errorMs = timeMs - candidate.timeMs;
    if (Math.abs(errorMs) <= toleranceMs) {
      if (!best || Math.abs(errorMs) < Math.abs(best.errorMs)) {
        best = { index: i, note, errorMs: Math.round(errorMs) };
      }
    }
  }
  if (!best) return null;
  return {
    index: best.index,
    note,
    hit: true,
    early: best.errorMs < 0,
    late: best.errorMs > 0,
    errorMs: best.errorMs
  };
}

/** 计算当前时间点，某音符在瀑布流画面中的垂直位置（0=顶部，1=击打线）。 */
export function fallProgress(noteTimeMs, currentTimeMs, fallDurationMs) {
  if (!fallDurationMs) return 0;
  return Math.max(0, Math.min(1, (currentTimeMs - (noteTimeMs - fallDurationMs)) / fallDurationMs));
}

/**
 * 生成一次瀑布流练习的完整结果摘要。
 * @param {Array} fallNotes
 * @param {Array<{index:number, errorMs:number}>} hits 命中的音符
 * @param {number} toleranceMs
 */
export function summarizeFall(fallNotes, hits, toleranceMs = 300) {
  const hitSet = new Set(hits.map(h => h.index));
  const hitCount = hitSet.size;
  const errors = hits.map(h => h.errorMs);
  const meanAbsError = errors.length ? Math.round(errors.reduce((s, v) => s + Math.abs(v), 0) / errors.length) : null;
  return {
    total: fallNotes.length,
    hit: hitCount,
    missed: Math.max(0, fallNotes.length - hitCount),
    accuracyPercent: fallNotes.length ? Math.round((hitCount / fallNotes.length) * 100) : 0,
    meanAbsErrorMs: meanAbsError
  };
}
