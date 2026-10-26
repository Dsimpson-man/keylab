/**
 * 瀑布流（落球）跟弹视图。
 *
 * 用 <canvas> 渲染「音符下落 + 击打线」，配合真实按键判定。
 * 这是零基础「不用识谱也能跟弹」的可视化形态。
 *
 * 本文件只负责渲染与动画循环，判定逻辑在 src/core/piece-fall.js。
 */

import { buildFallNotes, matchFallNote, fallProgress, summarizeFall } from '../core/piece-fall.js';
import { noteName } from '../core/music-theory.js';

/**
 * @param {object} options
 * @param {HTMLElement} options.host 容器元素
 * @param {string[][]} options.measures 曲目 measures
 * @param {number} options.bpm 速度
 * @param {(note:number, result:object)=>void} options.onHit 命中回调
 * @param {(summary:object)=>void} options.onComplete 完成回调
 */
export function createFallView({ host, measures, bpm = 80, onHit = () => {}, onComplete = () => {} }) {
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const notes = buildFallNotes(measures, bpm, { leadInMs: 2500 });
  const fallDurationMs = 2000; // 音符从顶部到底部（击打线）的时长
  const hitLineY = () => canvas.height - 60;

  let running = false;
  let rafId = null;
  let startPerf = null;
  let hits = [];

  function resize() {
    const rect = host.getBoundingClientRect();
    const width = Math.max(320, rect.width);
    canvas.width = width;
    canvas.height = 280;
  }

  function start() {
    resize();
    running = true;
    startPerf = performance.now();
    loop();
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function loop() {
    if (!running) return;
    const now = performance.now() - startPerf;
    draw(now);
    // 全部音符已过击打线后结束。
    const lastNoteTime = notes.length ? notes[notes.length - 1].timeMs : 0;
    if (now > lastNoteTime + fallDurationMs + 800) {
      finish();
      return;
    }
    rafId = requestAnimationFrame(loop);
  }

  function draw(now) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const lineY = hitLineY();

    // 击打线
    ctx.strokeStyle = '#d97757';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(20, lineY);
    ctx.lineTo(canvas.width - 20, lineY);
    ctx.stroke();

    // 音符（用圆形表示，按音高映射横向位置）
    const minNote = 48, maxNote = 84;
    for (const n of notes) {
      const progress = fallProgress(n.timeMs, now, fallDurationMs);
      if (progress <= 0 || progress > 1.2) continue;
      const x = 20 + ((n.note - minNote) / (maxNote - minNote)) * (canvas.width - 40);
      const y = lineY - progress * (lineY - 20);
      const done = n.done;
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = done ? '#b8f2d5' : '#d97757';
      ctx.fill();
      ctx.strokeStyle = '#29261b';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 音名
      ctx.fillStyle = done ? '#1f6b52' : '#fff';
      ctx.font = '10px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(noteName(n.note, { includeOctave: false }), x, y + 3);
    }
  }

  function finish() {
    stop();
    onComplete(summarizeFall(notes, hits, 300));
  }

  /** 用户按键，尝试匹配一个下落音符。 */
  function press(note) {
    if (!running) return null;
    const now = performance.now() - startPerf;
    const result = matchFallNote(notes, note, now, 300);
    if (result) {
      notes[result.index].done = true;
      hits.push(result);
      onHit(note, result);
    }
    return result;
  }

  return { start, stop, press, resize, get notes() { return notes; } };
}
