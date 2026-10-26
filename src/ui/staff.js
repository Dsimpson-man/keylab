/**
 * 简易高音谱表渲染（SVG）。
 *
 * 只支持入门课程需要的音域（C4–F5）。这是教学示意图，不是完整制谱引擎。
 * 音符位置按「全音阶步数」计算：E4 在最下面一条线，向上每两步行进一个线/间。
 */

import { pitchClass, octaveOf } from '../core/music-theory.js';
import { escapeHtml } from './format.js';

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_STEPS = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
const SHARP_TO_LETTER = { 0: 'C', 1: 'C', 2: 'D', 3: 'D', 4: 'E', 5: 'F', 6: 'F', 7: 'G', 8: 'G', 9: 'A', 10: 'A', 11: 'B' };
const SHARP_PCS = new Set([1, 3, 6, 8, 10]);

const TOP_LINE_Y = 40;
const LINE_GAP = 10;
const BOTTOM_LINE_Y = TOP_LINE_Y + LINE_GAP * 4; // 80，对应 E4
const E4_STEP = 4 * 7 + LETTER_STEPS.E;

function diatonicStep(note) {
  const pc = pitchClass(note);
  const letter = SHARP_TO_LETTER[pc];
  const octave = octaveOf(note, 'standard');
  let step = octave * 7 + LETTER_STEPS[letter];
  // 升号音在同一线/间上，但音高实际高半音；显示上仍放在本位位置并加升号。
  return { step, letter, accidental: SHARP_PCS.has(pc) ? '♯' : '' };
}

function yForStep(step) {
  return BOTTOM_LINE_Y - (step - E4_STEP) * (LINE_GAP / 2);
}

function ledgerLines(step) {
  const lines = [];
  if (step <= E4_STEP - 2) {
    for (let current = E4_STEP - 2; current >= step; current -= 2) {
      lines.push(yForStep(current));
    }
  }
  if (step >= E4_STEP + 10) {
    for (let current = E4_STEP + 10; current <= step; current += 2) {
      lines.push(yForStep(current));
    }
  }
  return lines;
}

/**
 * @param {number[]} notes
 * @param {{title?: string, showLabels?: boolean}} options
 */
export function renderStaff(notes, { title = '高音谱表', showLabels = false } = {}) {
  if (!Array.isArray(notes) || notes.length === 0) return '';
  const width = Math.max(220, notes.length * 46 + 90);
  const height = 132;
  const startX = 76;
  const spacing = 46;
  const staffLines = [0, 1, 2, 3, 4].map(index => {
    const y = TOP_LINE_Y + index * LINE_GAP;
    return `<line x1="20" y1="${y}" x2="${width - 12}" y2="${y}" class="staff-line" />`;
  }).join('');

  const noteMarkup = notes.map((note, index) => {
    const { step, accidental } = diatonicStep(note);
    const x = startX + index * spacing;
    const y = yForStep(step);
    const ledgers = ledgerLines(step).map(lineY => `<line x1="${x - 14}" y1="${lineY}" x2="${x + 14}" y2="${lineY}" class="staff-ledger" />`).join('');
    const head = `<ellipse cx="${x}" cy="${y}" rx="6.6" ry="4.8" transform="rotate(-18 ${x} ${y})" class="staff-note-head" />`;
    // 符干方向：中线（B4）以上向下，以下向上。
    const stemUp = step <= E4_STEP + 4;
    const stem = stemUp
      ? `<line x1="${x + 6}" y1="${y}" x2="${x + 6}" y2="${y - 30}" class="staff-stem" />`
      : `<line x1="${x - 6}" y1="${y}" x2="${x - 6}" y2="${y + 30}" class="staff-stem" />`;
    const accidentalMark = accidental
      ? `<text x="${x - 17}" y="${y + 4}" class="staff-accidental">♯</text>`
      : '';
    const label = showLabels
      ? `<text x="${x}" y="${height - 8}" class="staff-label">${escapeHtml(noteLabel(note))}</text>`
      : '';
    return `<g>${ledgers}${head}${stem}${accidentalMark}${label}</g>`;
  }).join('');

  return `<figure class="staff-figure" role="img" aria-label="${escapeHtml(title)}：${escapeHtml(notes.map(noteLabel).join('、'))}">
    <svg viewBox="0 0 ${width} ${height}" class="staff-svg" preserveAspectRatio="xMinYMid meet">
      <text x="18" y="66" class="staff-clef" aria-hidden="true">𝄞</text>
      ${staffLines}
      ${noteMarkup}
    </svg>
    <figcaption>${escapeHtml(title)} · 高音谱号</figcaption>
  </figure>`;
}

function noteLabel(note) {
  const { letter, accidental } = diatonicStep(note);
  return `${letter}${accidental}${octaveOf(note, 'standard')}`;
}
