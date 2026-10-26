/**
 * 音频引擎。
 *
 * - 真实钢琴采样（Salamander Grand Piano V2，CC-BY 3.0，作者 Alexander Holm），
 *   打包在 assets/piano/；采样点按小三度分布（A0–C8，30 个点），
 *   音符通过 playbackRate 做半音移调。
 * - 采样尚未加载或解码失败时，回退到振荡器合成（triangle + sine），保证任何环境都能发声。
 * - 需要用户手势后才能稳定启动（iOS / iPadOS 限制）。
 * - 每个「来源 + 音符」只维持一个 voice，重复 Note On 不会叠加爆音。
 * - 松开后快速淡出（模拟制音器落下），页面隐藏或设备断开时统一 allNotesOff。
 */

import { midiToFrequency } from '../core/music-theory.js';

// 采样点音名（小三度间隔，A0 到 C8），对应 MIDI 21 起、步长 3。
const SAMPLE_NAMES = Object.freeze([
  'A0', 'C1', 'Ds1', 'Fs1', 'A1', 'C2', 'Ds2', 'Fs2', 'A2', 'C3',
  'Ds3', 'Fs3', 'A3', 'C4', 'Ds4', 'Fs4', 'A4', 'C5', 'Ds5', 'Fs5',
  'A5', 'C6', 'Ds6', 'Fs6', 'A6', 'C7', 'Ds7', 'Fs7', 'A7', 'C8'
]);

const SAMPLE_BASE_MIDI = 21; // A0
const SAMPLE_STEP = 3;

export class AudioEngine {
  constructor({ volume = 0.8, metronomeVolume = 0.7, sampleBaseUrl = null } = {}) {
    this.context = null;
    this.master = null;
    this.metronomeGain = null;
    this.voices = new Map();
    this.volume = volume;
    this.metronomeVolume = metronomeVolume;
    this.unlocked = false;
    this._unlockError = null;
    // 采样：Map<midi, AudioBuffer>；加载完成后按需填充。
    this.samples = new Map();
    this.samplesReady = false;
    this._loading = null;
    this.sampleBaseUrl = sampleBaseUrl || new URL('../../assets/piano/', import.meta.url).href;
    // 延音踏板：sustain=true 时，noteOff 不立即停音，而是挂起等踏板松开。
    this.sustain = false;
    this._sustained = new Set(); // voice key 集合，踏板期间收到 noteOff 的音。
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

  /** 采样点对应的 MIDI 编号。 */
  sampleMidiForName(name) {
    return SAMPLE_BASE_MIDI + SAMPLE_NAMES.indexOf(name) * SAMPLE_STEP;
  }

  /** 返回 ≤ note 的最近采样点（向下取，移调不超过 +2 半音）。 */
  nearestSampleMidi(note) {
    const index = Math.max(0, Math.min(SAMPLE_NAMES.length - 1, Math.round((note - SAMPLE_BASE_MIDI) / SAMPLE_STEP)));
    return SAMPLE_BASE_MIDI + index * SAMPLE_STEP;
  }

  /**
   * 加载全部采样（首次调用时进行，结果缓存）。失败时静默回退到振荡器。
   * 浏览器环境下 fetch + decodeAudioData。
   */
  async loadSamples() {
    if (this.samplesReady) return true;
    if (this._loading) return this._loading;
    if (typeof fetch !== 'function' || !this.isSupported()) return false;
    this._loading = (async () => {
      // 解码不需要 AudioContext 处于 running，只要 context 存在即可。
      if (!this.context) {
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          this.context = new Ctx();
          this.master = this.context.createGain();
          this.master.gain.value = this.volume;
          this.master.connect(this.context.destination);
          this.metronomeGain = this.context.createGain();
          this.metronomeGain.gain.value = this.metronomeVolume;
          this.metronomeGain.connect(this.context.destination);
        } catch (_) {
          this._loading = null;
          return false;
        }
      }
      const names = SAMPLE_NAMES.map(name => `${this.sampleBaseUrl}${name}.mp3`);
      const results = await Promise.all(names.map(async (url, index) => {
        try {
          const response = await fetch(url);
          if (!response.ok) return null;
          const arrayBuffer = await response.arrayBuffer();
          const buffer = await this.context.decodeAudioData(arrayBuffer);
          return { midi: this.sampleMidiForName(SAMPLE_NAMES[index]), buffer };
        } catch (_) {
          return null;
        }
      }));
      let loaded = 0;
      for (const item of results) {
        if (item && item.buffer) {
          this.samples.set(item.midi, item.buffer);
          loaded += 1;
        }
      }
      this.samplesReady = loaded > 0;
      this._loading = null;
      return this.samplesReady;
    })();
    return this._loading;
  }

  /**
   * 播放一个音符。返回 Promise<boolean> 表示是否成功启动。
   * velocity 为 1–127；source 用于区分同一音高的不同来源。
   */
  async noteOn(note, velocity = 100, { source = 'virtual', voiceKey = null } = {}) {
    if (!midiToFrequency(note)) return false;
    const key = voiceKey || this.voiceKey(note, source);
    if (this.voices.has(key)) this._fadeOut(key);
    const ready = await this.unlock();
    if (!ready || !this.context) return false;

    // 优先采样，其次振荡器。
    const sampleMidi = this.nearestSampleMidi(note);
    const buffer = this.samples.get(sampleMidi);
    if (buffer) {
      return this._playSample(note, sampleMidi, buffer, velocity, key, source);
    }
    this._playOscillator(note, velocity, key, source);
    return true;
  }

  _playSample(note, sampleMidi, buffer, velocity, key, source) {
    const ctx = this.context;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    // 半音移调：sampleMidi 到 note 的距离。
    src.playbackRate.value = Math.pow(2, (note - sampleMidi) / 12);
    const gain = ctx.createGain();
    // 采样已含完整起音与延音，只做力度缩放。
    const peak = Math.max(0.02, Math.min(1, (velocity / 127) * 0.85));
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.006);
    src.connect(gain);
    gain.connect(this.master);
    src.start(now);
    this.voices.set(key, { src, gain, note, source, isSample: true });
    return true;
  }

  _playOscillator(note, velocity, key, source) {
    const frequency = midiToFrequency(note);
    const ctx = this.context;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = frequency * 2;
    const gain2 = ctx.createGain();
    gain2.gain.value = 0.18;
    const now = ctx.currentTime;
    const peak = Math.max(0.02, Math.min(0.22, (velocity / 127) * 0.2));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(peak * 0.65, now + 0.18);
    osc.connect(gain);
    osc2.connect(gain2).connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc2.start(now);
    this.voices.set(key, { osc, osc2, gain, note, source, isSample: false });
  }

  noteOff(note, { source = 'virtual', voiceKey = null } = {}) {
    const key = voiceKey || this.voiceKey(note, source);
    if (this.sustain) {
      // 延音踏板踩下时，先挂起，等踏板松开再淡出。
      this._sustained.add(key);
      return;
    }
    this._fadeOut(key);
  }

  /** 设置延音踏板状态（CC64，值 ≥64 为踩下）。松开踏板时释放所有挂起的音。 */
  setSustain(on) {
    const next = Boolean(on);
    if (next === this.sustain) return;
    this.sustain = next;
    if (!next) {
      for (const key of Array.from(this._sustained)) this._fadeOut(key);
      this._sustained.clear();
    }
  }

  _fadeOut(key) {
    const voice = this.voices.get(key);
    if (!voice || !this.context) return;
    this.voices.delete(key);
    const now = this.context.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(0.0001, now, 0.05);
      if (voice.isSample) {
        // 采样源直接停止即可（制音器效果），stop 前给它一点淡出余量。
        voice.src.stop(now + 0.3);
      } else {
        voice.osc.stop(now + 0.3);
        voice.osc2.stop(now + 0.3);
      }
    } catch (_) {
      // 已经停止的源会抛错，忽略即可。
    }
  }

  allNotesOff() {
    for (const key of Array.from(this.voices.keys())) this._fadeOut(key);
    this._sustained.clear();
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
