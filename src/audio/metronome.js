/**
 * 节拍器。
 *
 * 使用 Web Audio 的时间轴提前调度提示音（lookahead），比 setInterval 逐拍播放更稳定。
 * 同时向界面广播每一拍的视觉时间，便于用户跟随。
 *
 * 注意：节奏评分不使用这里的调度时间，而是使用真实收到按键事件的时间戳。
 */

export class Metronome {
  constructor({ audio, onBeat = () => {}, onStop = () => {}, bpm = 80, beatsPerBar = 4 } = {}) {
    this.audio = audio;
    this.onBeat = onBeat;
    this.onStop = onStop;
    this.bpm = bpm;
    this.beatsPerBar = beatsPerBar;
    this.running = false;
    this._timer = null;
    this._nextNoteTime = 0;
    this._beatIndex = 0;
    this._startedAt = 0;
    this._lookahead = 25;
    this._scheduleAhead = 0.12;
  }

  setBpm(bpm) {
    this.bpm = Math.max(40, Math.min(240, Math.round(Number(bpm) || 80)));
    return this.bpm;
  }

  /**
   * @param {{countInBeats?: number, firstBeatTime?: number}} options
   * firstBeatTime 为 AudioContext 时间轴上的第一拍时间；
   * 传入它可以让学生端用同一个时钟计算拍点网格。
   */
  async start({ countInBeats = 2, firstBeatTime = null } = {}) {
    if (this.running) return false;
    const ready = await this.audio.unlock();
    if (!ready || !this.audio.context) return false;
    this.running = true;
    this._beatIndex = 0;
    this._startedAt = this.audio.context.currentTime;
    this._nextNoteTime = firstBeatTime != null
      ? firstBeatTime
      : this._startedAt + countInBeats * (60 / this.bpm);
    this._tick();
    this._timer = window.setInterval(() => this._tick(), this._lookahead);
    return true;
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    if (this._timer) window.clearInterval(this._timer);
    this._timer = null;
    this.onStop();
  }

  _tick() {
    if (!this.running || !this.audio.context) return;
    const ctx = this.audio.context;
    while (this._nextNoteTime < ctx.currentTime + this._scheduleAhead) {
      const beatInBar = this._beatIndex % this.beatsPerBar;
      const delayMs = Math.max(0, (this._nextNoteTime - ctx.currentTime) * 1000);
      this.audio.click(this._nextNoteTime, { accent: beatInBar === 0 });
      window.setTimeout(() => {
        if (this.running) this.onBeat({ beat: this._beatIndex + 1, beatInBar: beatInBar + 1, time: this._nextNoteTime });
      }, delayMs);
      this._nextNoteTime += 60 / this.bpm;
      this._beatIndex += 1;
    }
  }
}
