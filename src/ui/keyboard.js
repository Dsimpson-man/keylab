/**
 * 虚拟键盘渲染与指针/键盘交互控制器。
 *
 * 渲染只产出 HTML；交互由 KeyboardController 管理，并保证：
 * - 同一琴键被多个手指按住时，只在第一个按下时发 Note On、最后一个松开时发 Note Off。
 * - 页面失焦、指针取消、切换视图时释放所有按音。
 * - 键盘用户可用方向键在琴键间移动，用空格 / 回车演奏。
 */

import { escapeHtml } from './format.js';
import { noteName, isBlackKey, pitchClass } from '../core/music-theory.js';

export function renderKeyboardMarkup({ start = 48, count = 37, naming = 'standard', id = 'board', mini = false, label = '虚拟钢琴键盘' } = {}) {
  const notes = Array.from({ length: count }, (_, index) => start + index).filter(note => note >= 0 && note <= 127);
  const whiteCount = notes.filter(note => !isBlackKey(note)).length || 1;
  let whiteBefore = 0;
  const keys = [];
  for (const note of notes) {
    const pc = pitchClass(note);
    const name = noteName(note, { naming });
    if (isBlackKey(note)) {
      const left = (whiteBefore / whiteCount) * 100;
      keys.push(`<button type="button" class="piano-key black" style="left:${left}%" data-note="${note}" tabindex="-1" aria-label="${escapeHtml(name)}，MIDI ${note}"><span>${mini ? escapeHtml(noteName(note, { includeOctave: false })) : ''}</span></button>`);
    } else {
      const showLabel = mini || pc === 0;
      const labelText = mini ? noteName(note, { includeOctave: false }) : (pc === 0 ? name : '');
      keys.push(`<button type="button" class="piano-key ${pc === 0 ? 'is-c' : ''}" data-note="${note}" tabindex="-1" aria-label="${escapeHtml(name)}，MIDI ${note}" ${showLabel ? '' : 'data-unlabeled="true"'}><span>${escapeHtml(labelText)}</span></button>`);
      whiteBefore += 1;
    }
  }
  const minWidth = Math.round(Math.max(mini ? 330 : 420, whiteCount * (mini ? 28 : 36)));
  return `<div class="piano-keyboard ${mini ? 'mini-keyboard' : ''}" style="min-width:${minWidth}px" data-keyboard="${escapeHtml(id)}" data-start="${start}" data-count="${count}" role="group" aria-label="${escapeHtml(label)}。使用左右方向键选择琴键，空格或回车演奏。" tabindex="0">${keys.join('')}</div>`;
}

export function renderPianoPanel({ start, count, naming, id, title = '互动虚拟键盘', subtitle = null, mini = false, extraClass = '' } = {}) {
  const end = noteName(start + count - 1, { naming });
  return `<div class="piano-wrap ${extraClass}">
    <div class="piano-head"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(noteName(start, { naming }))} – ${escapeHtml(end)}</span></div>
    <div class="piano-scroll">${renderKeyboardMarkup({ start, count, naming, id, mini })}</div>
    <div class="piano-foot"><span>${escapeHtml(subtitle || '点击 / 触摸演奏，或用电脑键盘 A–L 弹奏白键、W E T Y U 弹奏黑键')}</span><strong data-last-note>等待输入</strong></div>
  </div>`;
}

const QWERTY_MAP = Object.freeze({
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12, l: 14
});

export class KeyboardController {
  /**
   * @param {object} options
   * @param {(note:number, velocity:number, meta:object)=>void} options.onNoteOn
   * @param {(note:number, meta:object)=>void} options.onNoteOff
   * @param {()=>number} options.getBaseNote 返回电脑键盘映射的起始音（例如 C4=60）
   */
  constructor({ onNoteOn, onNoteOff, getBaseNote = () => 60 } = {}) {
    this.onNoteOn = onNoteOn;
    this.onNoteOff = onNoteOff;
    this.getBaseNote = getBaseNote;
    this.pointerNotes = new Map(); // pointerId -> note
    this.notePointers = new Map(); // note -> Set<pointerId>
    this.computerNotes = new Map(); // physical key -> note
    this.octaveShift = 0;
    this.focusNote = null;
    this._bound = false;
    this._root = null;
  }

  bind(root = document) {
    if (this._bound) return;
    this._bound = true;
    this._root = root;
    root.addEventListener('pointerdown', event => this._handlePointerDown(event), { passive: false });
    window.addEventListener('pointerup', event => this._handlePointerUp(event));
    window.addEventListener('pointercancel', event => this._handlePointerUp(event));
    window.addEventListener('blur', () => this.releaseAll('blur'));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll('hidden');
    });
    root.addEventListener('keydown', event => this._handleKeyDown(event));
    root.addEventListener('keyup', event => this._handleKeyUp(event));
    root.addEventListener('focusin', event => {
      const board = event.target.closest?.('.piano-keyboard');
      if (board) {
        this._root.board = board;
        if (this.focusNote == null) this._syncFocus(board, Number(board.dataset.start));
      }
    });
    root.addEventListener('contextmenu', event => {
      if (event.target.closest?.('.piano-key')) event.preventDefault();
    });
  }

  _velocityFromPointer(key, event) {
    const rect = key.getBoundingClientRect();
    if (!rect.height) return 96;
    const ratio = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    // 越靠下代表击键越深，力度越大（这是学习用的模拟值，不是真实力度）。
    return Math.round(38 + ratio * 89);
  }

  _handlePointerDown(event) {
    const key = event.target.closest?.('.piano-key');
    if (!key) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (key.disabled) return;
    const note = Number(key.dataset.note);
    if (!Number.isInteger(note)) return;
    // 触摸时不要阻止默认行为，否则键盘容器无法横向滚动；
    // 拖动滚动会触发 pointercancel，由释放逻辑收尾。
    if (event.pointerType === 'mouse') event.preventDefault();
    try { key.closest('.piano-keyboard')?.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
    const velocity = this._velocityFromPointer(key, event);
    this.press(note, { pointerId: event.pointerId, pointerType: event.pointerType || 'mouse', velocity });
  }

  _handlePointerUp(event) {
    if (this.pointerNotes.has(event.pointerId)) {
      this.release(event.pointerId);
    }
  }

  press(note, { pointerId = null, velocity = 96, pointerType = 'mouse' } = {}) {
    const id = pointerId ?? `synthetic-${note}`;
    if (this.pointerNotes.has(id)) return;
    this.pointerNotes.set(id, note);
    if (!this.notePointers.has(note)) this.notePointers.set(note, new Set());
    const set = this.notePointers.get(note);
    const first = set.size === 0;
    set.add(id);
    if (first) {
      this.onNoteOn?.(note, velocity, { source: 'virtual', pointerType, pointerId: id });
    }
  }

  release(pointerId) {
    const note = this.pointerNotes.get(pointerId);
    if (note == null) return;
    this.pointerNotes.delete(pointerId);
    const set = this.notePointers.get(note);
    if (!set) return;
    set.delete(pointerId);
    if (set.size === 0) {
      this.notePointers.delete(note);
      this.onNoteOff?.(note, { source: 'virtual', pointerId });
    }
  }

  releaseAll(reason = 'manual') {
    for (const note of Array.from(this.notePointers.keys())) {
      for (const pointerId of Array.from(this.notePointers.get(note) || [])) {
        this.onNoteOff?.(note, { source: 'virtual', pointerId, reason });
      }
    }
    this.pointerNotes.clear();
    this.notePointers.clear();
    for (const [physical, note] of Array.from(this.computerNotes.entries())) {
      this.computerNotes.delete(physical);
      this.onNoteOff?.(note, { source: 'computer', reason });
    }
  }

  _handleKeyDown(event) {
    if (document.body?.classList.contains('modal-open')) return;
    const board = event.target.closest?.('.piano-keyboard');
    if (board) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const keys = Array.from(board.querySelectorAll('.piano-key'));
        if (!keys.length) return;
        const currentNote = Number(board.dataset.focusNote ?? keys[0].dataset.note);
        let index = keys.findIndex(key => Number(key.dataset.note) === currentNote);
        if (index < 0) index = 0;
        index = Math.max(0, Math.min(keys.length - 1, index + (event.key === 'ArrowRight' ? 1 : -1)));
        this._syncFocus(board, Number(keys[index].dataset.note));
        return;
      }
      if (event.key === ' ' || event.key === 'Enter') {
        if (event.repeat) return;
        event.preventDefault();
        const note = Number(board.dataset.focusNote ?? board.dataset.start);
        this.press(note, { pointerId: `kbd-${note}`, velocity: 96 });
        return;
      }
    }
    if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
    const active = document.activeElement;
    if (active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)) return;
    if (event.key === 'z' || event.key === 'Z') { this.octaveShift = Math.max(-2, this.octaveShift - 1); return; }
    if (event.key === 'x' || event.key === 'X') { this.octaveShift = Math.min(2, this.octaveShift + 1); return; }
    const offset = QWERTY_MAP[event.key.toLowerCase()];
    if (offset == null) return;
    const note = this.getBaseNote() + offset + this.octaveShift * 12;
    if (note < 0 || note > 127 || this.computerNotes.has(event.key.toLowerCase())) return;
    event.preventDefault();
    this.computerNotes.set(event.key.toLowerCase(), note);
    this.onNoteOn?.(note, 96, { source: 'computer', key: event.key.toLowerCase() });
  }

  _handleKeyUp(event) {
    const physical = event.key.toLowerCase();
    if (this.computerNotes.has(physical)) {
      const note = this.computerNotes.get(physical);
      this.computerNotes.delete(physical);
      this.onNoteOff?.(note, { source: 'computer', key: physical });
      return;
    }
    if (event.key === ' ' || event.key === 'Enter') {
      const board = event.target.closest?.('.piano-keyboard');
      if (!board) return;
      const note = Number(board.dataset.focusNote ?? board.dataset.start);
      this.release(`kbd-${note}`);
    }
  }

  _syncFocus(board, note) {
    board.dataset.focusNote = String(note);
    this.focusNote = note;
    board.querySelectorAll('.piano-key').forEach(key => {
      key.classList.toggle('is-focus', Number(key.dataset.note) === note);
    });
  }
}
