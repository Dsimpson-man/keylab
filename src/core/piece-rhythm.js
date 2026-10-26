/**
 * 曲目节奏分析（纯逻辑，可单测）。
 *
 * 把 Pianio 的 measures（音名+时值）转成「旋律音符 + 起始拍点」的序列，
 * 再据此把真实按键时间戳匹配到期望拍点，输出每个音的节奏偏差。
 *
 * 与 rhythm-analyzer 的区别：那里是等间隔节拍（每个 beat 弹同一个音），
 * 这里是曲目的真实旋律——不同音符有不同时值（全/二分/四分/八分/附点）。
 */

/** 时值 token → 拍数（以四分音符为 1 拍）。 */
export const DURATION_BEATS = Object.freeze({
  w: 4,
  h: 2,
  q: 1,
  e: 0.5,
  dq: 1.5,
  dh: 3,
  de: 0.75
});

const LETTER_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

function midiFromName(name) {
  const match = /^([A-G])([#♯b♭]?)(-?\d+)$/.exec(name);
  if (!match) return null;
  const letter = match[1].toUpperCase();
  const accidental = match[2] === '#' || match[2] === '♯' ? 1 : match[2] === 'b' || match[2] === '♭' ? -1 : 0;
  const octave = Number(match[3]);
  const note = (octave + 1) * 12 + LETTER_BASE[letter] + accidental;
  return Number.isInteger(note) && note >= 0 && note <= 127 ? note : null;
}

/** 解析一个小节单元：返回 { note, beats, isRest }；无法解析返回 null。 */
export function parseCell(cell) {
  if (typeof cell !== 'string' || !cell) return null;
  if (cell.startsWith('R:')) {
    const beats = DURATION_BEATS[cell.slice(2)];
    if (beats == null) return null;
    return { note: null, beats, isRest: true };
  }
  const [body, durToken] = cell.split(':');
  const beats = DURATION_BEATS[durToken];
  if (beats == null) return null;
  const names = body.startsWith('[') ? body.slice(1, body.indexOf(']')).split(',') : [body];
  const notes = names.map(midiFromName).filter(Number.isInteger);
  if (!notes.length) return null;
  // 和弦取最高音作为旋律音（与导入时的 melodyOf 一致）。
  return { note: Math.max(...notes), beats, isRest: false };
}

/**
 * 从 measures 提取旋律音符序列，每个音带上「起始拍」与「时值（拍数）」。
 * 休止符不产生音符，但会推进累计拍数，从而拉长后续音符的间隔。
 *
 * @param {string[][]} measures
 * @returns {Array<{note:number, beat:number, beats:number}>}
 */
export function melodyNotesWithBeats(measures) {
  const result = [];
  let beat = 0;
  for (const measure of measures || []) {
    for (const cell of measure) {
      const parsed = parseCell(cell);
      if (!parsed) continue;
      if (!parsed.isRest && parsed.note != null) {
        result.push({ note: parsed.note, beat, beats: parsed.beats });
      }
      beat += parsed.beats;
    }
  }
  return result;
}

/**
 * 由旋律音符（含起始拍）生成期望时间点（毫秒）。
 * @param {Array<{note:number, beat:number}>} melody
 * @param {number} bpm 速度（每分钟四分音符数）
 * @returns {Array<{note:number, startMs:number}>}
 */
export function buildNoteGrid(melody, bpm) {
  const msPerBeat = 60000 / bpm;
  return melody.map(item => ({ note: item.note, startMs: Math.round(item.beat * msPerBeat) }));
}

/**
 * 把真实按键记录匹配到旋律网格（贪心顺序匹配，音符必须一致）。
 * @param {Array<{note:number, timestamp:number, velocity:number}>} records 按时间排序的正确按键
 * @param {Array<{note:number, startMs:number}>} grid
 * @param {object} options
 * @param {number} options.toleranceMs 容许偏差（毫秒）
 * @param {number} options.offsetMs 网格起点偏移（对齐到第一个音，默认 0）
 */
export function analyzePieceRhythm(records, grid, { toleranceMs = 300, offsetMs = 0 } = {}) {
  const validRecords = (records || []).filter(r => r && Number.isFinite(r.timestamp) && Number.isInteger(r.note));
  if (!validRecords.length || !grid.length) {
    return { entries: [], summary: null };
  }

  // 若给了 offset，网格整体平移。
  const shiftedGrid = offsetMs ? grid.map(g => ({ ...g, startMs: g.startMs + offsetMs })) : grid;

  // 贪心顺序匹配：records 与 grid 都按顺序（wait 模式保证音序正确）。
  const entries = [];
  let gi = 0;
  for (const rec of validRecords) {
    // 找到第一个 note 匹配的网格项。
    while (gi < shiftedGrid.length && shiftedGrid[gi].note !== rec.note) gi += 1;
    if (gi >= shiftedGrid.length) break;
    const target = shiftedGrid[gi];
    const errorMs = Math.round(rec.timestamp - target.startMs);
    entries.push({
      note: rec.note,
      expectedMs: target.startMs,
      actualMs: Math.round(rec.timestamp),
      errorMs,
      onTime: Math.abs(errorMs) <= toleranceMs,
      early: errorMs < -toleranceMs,
      late: errorMs > toleranceMs
    });
    gi += 1;
  }

  const onTimeCount = entries.filter(e => e.onTime).length;
  const errors = entries.filter(e => e.onTime).map(e => e.errorMs);
  const meanAbsError = errors.length ? Math.round(errors.reduce((s, v) => s + Math.abs(v), 0) / errors.length) : null;
  const summary = {
    expected: shiftedGrid.length,
    played: entries.length,
    onTime: onTimeCount,
    missed: Math.max(0, shiftedGrid.length - entries.length),
    accuracyPercent: shiftedGrid.length ? Math.round((onTimeCount / shiftedGrid.length) * 100) : 0,
    meanAbsErrorMs: meanAbsError
  };

  return { entries, summary };
}

/** 人类可读的曲目节奏结果。 */
export function describePieceRhythm(summary, toleranceMs = 300) {
  if (!summary) return '还没有节奏数据。';
  if (!summary.expected) return '没有可分析的音符。';
  const parts = [];
  parts.push(`节奏准确率 ${summary.accuracyPercent}%（${summary.onTime}/${summary.expected} 落在 ±${toleranceMs} 毫秒内）。`);
  if (summary.meanAbsErrorMs != null) parts.push(`平均偏差 ${summary.meanAbsErrorMs} 毫秒。`);
  if (summary.missed) parts.push(`${summary.missed} 个音符未匹配到期望拍点。`);
  return parts.join(' ');
}
