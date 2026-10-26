/**
 * 节奏练习会话。
 *
 * 负责在音频时钟上安排拍点，并把真实按键时间戳映射到同一条时间轴，
 * 因此评分依据是真实演奏时间，而不是「点了几次按钮」。
 *
 * 使用方式：
 *   const session = new RhythmSession({ audio, metronome, bpm, beats, toleranceMs, onUpdate, onComplete });
 *   await session.start();
 *   session.addHit(performance.now(), note);
 *   session.stop();
 */

import { buildBeatGrid, analyzeRhythm, describeRhythmResult } from './rhythm-analyzer.js';

export class RhythmSession {
  constructor({ audio, metronome, bpm = 80, beats = 4, toleranceMs = 200, countInBeats = 2, onUpdate = () => {}, onComplete = () => {}, onBeat = () => {} } = {}) {
    this.audio = audio;
    this.metronome = metronome;
    this.bpm = bpm;
    this.beats = beats;
    this.toleranceMs = toleranceMs;
    this.countInBeats = countInBeats;
    this.onUpdate = onUpdate;
    this.onComplete = onComplete;
    this.onBeat = onBeat;
    this.running = false;
    this.grid = [];
    this.hits = [];
    this._firstBeatAudioTime = 0;
    this._perfStart = 0;
    this._interval = 60 / bpm;
    this.analysis = null;
    this._finishTimer = null;
  }

  /** 把 performance.now() 时间戳换算为 AudioContext 时间轴（秒）。 */
  toTimeline(timestampMs) {
    return this._firstBeatAudioTime + (timestampMs - this._perfStart) / 1000;
  }

  async start() {
    if (this.running) return false;
    const ready = await this.audio.unlock();
    if (!ready || !this.audio.context) return false;
    const ctx = this.audio.context;
    this._interval = 60 / this.bpm;
    this._perfStart = performance.now();
    this._firstBeatAudioTime = ctx.currentTime + this.countInBeats * this._interval;
    this.grid = buildBeatGrid(this._firstBeatAudioTime, this.bpm, this.beats);
    this.hits = [];
    this.analysis = null;
    if (this.metronome) {
      this.metronome.setBpm(this.bpm);
      this.metronome.onBeat = payload => this.onBeat({ ...payload, countIn: payload.time < this._firstBeatAudioTime });
      await this.metronome.start({ firstBeatTime: this._firstBeatAudioTime, countInBeats: 0 });
    }
    this.running = true;
    const sessionDuration = (this._firstBeatAudioTime + (this.beats - 1) * this._interval + this.toleranceMs / 1000 - ctx.currentTime) * 1000;
    this._finishTimer = window.setTimeout(() => this._finish(), Math.max(500, sessionDuration + 80));
    this.onUpdate({ running: true, feedback: `节拍器开始：${this.bpm} BPM，预备 ${this.countInBeats} 拍。`, analysis: null });
    return true;
  }

  addHit(timestampMs, note = null, velocity = null) {
    if (!this.running) return null;
    const timeline = this.toTimeline(timestampMs);
    if (timeline < this.grid[0] - this.toleranceMs / 1000) {
      this.onUpdate({ running: true, feedback: '还在预备拍中，先听节拍器。', analysis: null });
      return null;
    }
    if (timeline > this.grid[this.grid.length - 1] + this.toleranceMs / 1000) return null;
    this.hits.push({ timeMs: timeline, note, velocity, perfTime: timestampMs });
    this.analysis = analyzeRhythm({ hits: this.hits, grid: this.grid, toleranceMs: this.toleranceMs });
    const latest = this.analysis.entries
      .filter(entry => entry.onTime)
      .sort((a, b) => Math.abs(a.actualTime - timeline) - Math.abs(b.actualTime - timeline))[0];
    const feedback = latest
      ? `第 ${latest.beat} 拍：${latest.errorMs > 0 ? '偏晚' : latest.errorMs < 0 ? '偏早' : '正好'} ${Math.abs(latest.errorMs)} 毫秒。`
      : `这次击点不在拍点 ±${this.toleranceMs} 毫秒内。`;
    this.onUpdate({ running: true, feedback, analysis: this.analysis });
    if (this.analysis.summary.passed) this._finish({ passed: true });
    return this.analysis;
  }

  _finish(explicit = null) {
    if (!this.running) return;
    this.running = false;
    window.clearTimeout(this._finishTimer);
    this._finishTimer = null;
    this.metronome?.stop();
    if (!this.analysis) this.analysis = analyzeRhythm({ hits: this.hits, grid: this.grid, toleranceMs: this.toleranceMs });
    const summary = this.analysis.summary;
    const feedback = describeRhythmResult(summary, this.toleranceMs);
    this.onUpdate({ running: false, feedback, analysis: this.analysis });
    this.onComplete({ passed: summary.passed || Boolean(explicit?.passed), summary, analysis: this.analysis, feedback });
  }

  stop() {
    if (this.running) this._finish();
    else this.metronome?.stop();
  }
}
