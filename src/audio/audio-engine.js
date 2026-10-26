/**
 * 音频引擎。
 *
 * - 需要用户手势后才能稳定启动（iOS / iPadOS 限制）。
 * - 每个「来源 + 音符」只维持一个 voice，重复 Note On 不会叠加爆音。
 * - 松开后 280ms 内淡出并停止振荡器。
 * - 页面隐藏或设备断开时统一 allNotesOff，避免卡音。
 * - 不播放任何外部音频文件，完全由振荡器合成。
 */

import { midiToFrequency } from '../core/music-theory.js';

export class AudioEngine {
  constructor({ volume = 0.8, metronomeVolume = 0.7 } = {}) {
    this.context = null;
    this.master = null;
    this.metronomeGain = null;
    this.voices = new Map();
    this.volume = volume;
    this.metronomeVolume = metronomeVolume;
    this.unlocked = false;
    this._unlockError = null;
  }

  isSupported() {
    return typeof window !== 'undefined' && Boolean(window.AudioContext || window.webkitAudioContext);
  }

  async unlock() {
    if (!this.isSupported()) {
      this._unlockError = '当前浏览器不支持 Web Audio。';
      return false;
    }
    if (!this.context) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.context = new Ctx();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.context.destination);
      this.metronomeGain = this.context.createGain();
      this.metronomeGain.gain.value = this.metronomeVolume;
      this.metronomeGain.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') {
      try {
        await this.context.resume();
      } catch (error) {
        this._unlockError = error?.message || '音频上下文无法启动。';
      }
    }
    this.unlocked = this.context.state === 'running';
    return this.unlocked;
  }

  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.02);
    }
  }

  setMetronomeVolume(value) {
    this.metronomeVolume = Math.max(0, Math.min(1, Number(value) || 0));
    if (this.metronomeGain && this.context) {
      this.metronomeGain.gain.setTargetAtTime(this.metronomeVolume, this.context.currentTime, 0.02);
    }
  }

  voiceKey(note, source = 'default') {
    return `${source}:${note}`;
  }

  /**
   * 播放一个音符。返回 Promise<boolean> 表示是否成功启动。
   * velocity 为 1–127；source 用于区分同一音高的不同来源（虚拟/硬件），
   * 避免一个来源松开就掐掉另一个来源仍在按住的音。
   */
  async noteOn(note, velocity = 100, { source = 'virtual', voiceKey = null } = {}) {
    const frequency = midiToFrequency(note);
    if (!frequency) return false;
    const key = voiceKey || this.voiceKey(note, source);
    if (this.voices.has(key)) this._fadeOut(key);
    const ready = await this.unlock();
    if (!ready || !this.context) return false;
    // 异步解锁期间可能已经被 noteOff / allNotesOff 取消。
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    // 叠一层轻微的正弦，让音色不那么单薄。
    const osc2 = this.context.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = frequency * 2;
    const gain2 = this.context.createGain();
    gain2.gain.value = 0.18;
    const now = this.context.currentTime;
    const peak = Math.max(0.02, Math.min(0.22, (velocity / 127) * 0.2));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(peak * 0.65, now + 0.18);
    osc.connect(gain);
    osc2.connect(gain2).connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc2.start(now);
    this.voices.set(key, { osc, osc2, gain, note, source });
    return true;
  }

  noteOff(note, { source = 'virtual', voiceKey = null } = {}) {
    const key = voiceKey || this.voiceKey(note, source);
    this._fadeOut(key);
  }

  _fadeOut(key) {
    const voice = this.voices.get(key);
    if (!voice || !this.context) return;
    this.voices.delete(key);
    const now = this.context.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0.0001, now, 0.05);
      voice.osc.stop(now + 0.3);
      voice.osc2.stop(now + 0.3);
    } catch (_) {
      // 已经停止的振荡器会抛错，忽略即可。
    }
  }

  allNotesOff() {
    for (const key of Array.from(this.voices.keys())) this._fadeOut(key);
  }

  /** 节拍器提示音。accent 用于每小节第一拍。 */
  click(when = null, { accent = false } = {}) {
    if (!this.context || this.context.state !== 'running') return false;
    const time = when == null ? this.context.currentTime : when;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = 'square';
    osc.frequency.value = accent ? 1760 : 1180;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(accent ? 0.12 : 0.07, time + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    osc.connect(gain).connect(this.metronomeGain || this.master);
    osc.start(time);
    osc.stop(time + 0.08);
    return true;
  }

  /** 页面隐藏时挂起，避免后台持续发声；返回时由用户手势恢复。 */
  async suspend() {
    this.allNotesOff();
    if (this.context && this.context.state === 'running') {
      try { await this.context.suspend(); } catch (_) { /* ignore */ }
    }
  }

  async resume() {
    if (!this.context) return false;
    if (this.context.state === 'suspended') {
      try { await this.context.resume(); } catch (_) { return false; }
    }
    return this.context.state === 'running';
  }

  get errorMessage() {
    return this._unlockError;
  }
}
