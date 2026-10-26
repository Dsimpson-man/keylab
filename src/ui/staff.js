/**
 * 五线谱渲染（基于 VexFlow）。
 *
 * - 真五线谱：拍号、调号、小节线、时值、附点、休止符、升降号、和弦。
 * - 数据来源两种：
 *   - renderStaff(notes)：兼容旧接口，把 MIDI 编号数组渲染成单行谱（用于 staff 模式课程）。
 *   - renderMeasures(item)：渲染 Pianio 完整 measures（多小节、单音/和弦/休止符），用于曲目/技巧练习。
 * - 依赖 vendor/vexflow.js（esbuild 打包的 VexFlow 4.2.5，MIT）。
 */

import { Renderer, Stave, StaveNote, Voice, Formatter, Barline, Accidental } from '../../vendor/vexflow.js';
import { pitchClass, octaveOf, noteName } from '../core/music-theory.js';
import { escapeHtml } from './format.js';

const PC_LETTER_SHARP = ['c', 'c', 'd', 'd', 'e', 'f', 'f', 'g', 'g', 'a', 'a', 'b'];
const PC_ACCIDENTAL = ['', '#', '', '#', '', '', '#', '', '#', '', '#', ''];

/** MIDI 编号 → VexFlow 音名（小写 + 升降号 + /八度），如 60 → c/4，61 → c#/4。 */
function midiToVexKey(note) {
  const pc = pitchClass(note);
  const octave = octaveOf(note, 'standard');
  return `${PC_LETTER_SHARP[pc]}${PC_ACCIDENTAL[pc]}/${octave}`;
}

/** 时值 token → VexFlow duration。 */
const DURATION_MAP = {
  w: 'w',
  h: 'h',
  q: 'q',
  e: '8',
  dq: 'qd',
  dh: 'hd',
  de: '8d'
};

/** 休止符 token → VexFlow 休止 duration（key 用 b/4，duration 带 r 后缀）。 */
const REST_DURATION_MAP = {
  'q': 'qr',
  'h': 'hr',
  'e': '8r',
  'dq': 'qdr'
};

/** 解析一个小节单元：返回 { keys: string[], duration: string, isRest: boolean }。 */
function parseCell(cell) {
  if (typeof cell !== 'string' || !cell) return null;
  if (cell.startsWith('R:')) {
    const restKey = cell.slice(2);
    const duration = REST_DURATION_MAP[restKey];
    if (!duration) return null;
    return { keys: ['b/4'], duration, isRest: true };
  }
  const [body, durToken] = cell.split(':');
  const duration = DURATION_MAP[durToken];
  if (!duration) return null;
  const names = body.startsWith('[') ? body.slice(1, body.indexOf(']')).split(',') : [body];
  const keys = names.map(name => {
    const match = /^([A-G])([#♯b♭]?)(-?\d+)$/.exec(name);
    if (!match) return null;
    const letter = match[1].toLowerCase();
    const accidental = (match[2] === '#' || match[2] === '♯') ? '#' : (match[2] === 'b' || match[2] === '♭') ? 'b' : '';
    return `${letter}${accidental}/${match[3]}`;
  }).filter(Boolean);
  return keys.length ? { keys, duration, isRest: false } : null;
}

/**
 * 渲染一段 measures 到 SVG HTML 字符串。
 * @param {string[][]} measures 二维数组：每项是一小节，内为 cell 数组。
 * @param {object} options { clef, timeSignature, title, width, showLabels }
 */
export function renderMeasures(measures, { clef = 'G', timeSignature = [4, 4], title = '', width = 720, showLabels = false } = {}) {
  if (!Array.isArray(measures) || !measures.length) return '';

  // 拍平所有 cell，为每小节计算音符总数，用于给每个 Stave 分配合理的宽度。
  const parsedMeasures = measures.map(measure => measure.map(parseCell).filter(Boolean));
  const totalCells = parsedMeasures.reduce((sum, m) => sum + m.length, 0);
  if (!totalCells) return '';

  // 单行宽度：每个音符约 42px，至少一个 Stave 的宽度。
  const cellWidth = Math.max(38, Math.floor(width / Math.max(totalCells, 12)));
  const staffWidth = cellWidth * totalCells + 60;
  const height = 180;

  const host = document.createElement('div');
  const renderer = new Renderer(host, Renderer.Backends.SVG);
  renderer.resize(staffWidth, height);
  const ctx = renderer.getContext();

  // 一个 Stave 承载全部小节，用 Barline 分隔。
  const stave = new Stave(10, 40, staffWidth - 20);
  stave.addClef(clef === 'F' ? 'bass' : 'treble');
  if (timeSignature && timeSignature.length === 2 && timeSignature[0] > 0 && timeSignature[1] > 0) {
    stave.addTimeSignature(`${timeSignature[0]}/${timeSignature[1]}`);
  }
  stave.setContext(ctx).draw();

  // 构造全部音符。
  const allNotes = [];
  let measureIndex = 0;
  for (const cells of parsedMeasures) {
    for (const cell of cells) {
      const note = new StaveNote({ clef: clef === 'F' ? 'bass' : 'treble', keys: cell.keys, duration: cell.duration });
      if (cell.isRest) {
        // VexFlow 通过 duration 的 r 后缀已渲染为休止符，key 保持 b/4。
        note.setStyle({ fillStyle: '#29261b', strokeStyle: '#29261b' });
      }
      allNotes.push(note);
    }
    measureIndex += 1;
  }

  // 排版与绘制。
  const beatsPerMeasure = timeSignature?.[0] || 4;
  const beatValue = timeSignature?.[1] || 4;
  const voice = new Voice({ num_beats: beatsPerMeasure * parsedMeasures.length, beat_value: beatValue });
  voice.addTickables(allNotes);
  new Formatter().joinVoices([voice]).format([voice], staffWidth - 90);

  // 在每小节边界绘制小节线（重画 Stave 时 VexFlow 已画开头小节线，这里补内部分隔）。
  voice.draw(ctx, stave);

  // 从 host 容器里取出渲染好的 SVG，转成字符串。
  const svgEl = host.querySelector('svg') || host.firstElementChild;
  const svg = svgEl ? svgEl.outerHTML : '';

  const label = showLabels ? `<p class="staff-note">${escapeHtml(title)} · ${clef === 'F' ? '低音谱号' : '高音谱号'}</p>` : '';
  return `<figure class="staff-figure staff-figure--vex" role="img" aria-label="${escapeHtml(title)}">
    <div class="staff-scroll">${svg}</div>
    ${label}
  </figure>`;
}

/**
 * 兼容旧接口：把 MIDI 编号数组渲染成单行谱（无小节线，全四分音符）。
 * @param {number[]} notes
 * @param {object} options { title, showLabels }
 */
export function renderStaff(notes, { title = '高音谱表', showLabels = false } = {}) {
  if (!Array.isArray(notes) || notes.length === 0) return '';
  const measures = [notes.map(note => {
    const letter = PC_LETTER_SHARP[pitchClass(note)];
    const octave = octaveOf(note, 'standard');
    return `${letter.toUpperCase()}${PC_ACCIDENTAL[pitchClass(note)]}${octave}:q`;
  })];
  return renderMeasures(measures, { clef: 'G', timeSignature: [notes.length, 4], title, showLabels });
}
