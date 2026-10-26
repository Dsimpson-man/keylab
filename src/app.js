/**
 * KeyLab 应用协调层。
 *
 * 结构：
 * - core/      乐理、判分、节奏、课程与测验引擎（纯逻辑，可单测）
 * - midi/      统一事件模型与适配器（模拟 / Web MIDI / 原生桥接预留）
 * - audio/     Web Audio 合成器与节拍器
 * - storage/   版本化本地进度、导入导出
 * - ui/        纯渲染视图、虚拟键盘、谱表、提示框
 * - data/      课程与题库
 *
 * 本文件只做三件事：维护页面状态、把统一输入分发给引擎、把结果渲染到界面。
 */

import { EventBus } from './core/event-bus.js';
import { createLessonEngine } from './core/lesson-engine.js';
import { createQuizSession, currentQuestion, answerChoice, createPlayMatcher, answerPlay, nextQuestion, sessionSummary } from './core/quiz-engine.js';
import { RhythmSession } from './core/rhythm-session.js';
import { MidiService } from './midi/midi-service.js';
import { SimulatedMidiAdapter } from './midi/simulated-midi-adapter.js';
import { WebMidiAdapter } from './midi/web-midi-adapter.js';
import { NativeBridgeAdapter } from './midi/native-bridge-adapter.js';
import { AudioEngine } from './audio/audio-engine.js';
import { Metronome } from './audio/metronome.js';
import {
  loadProgress, saveProgress, markActiveDay, exportProgress, parseImport, summarizeImport, defaultProgress
} from './storage/progress-store.js';
import {
  LESSONS, LESSON_COUNT, findLesson, nextLessonAfter
} from './data/lessons.js';
import { questionsForCategory } from './data/quizzes.js';
import { noteName } from './core/music-theory.js';
import { EVENT_TYPES, hexBytes, sourceLabel } from './midi/midi-normalizer.js';
import { $, $$, escapeHtml, downloadFile, timestampForFilename } from './ui/format.js';
import { renderHome, renderCourses, renderLessonPage, renderPractice, renderEar, renderMidiLab, renderProgress, renderEventList, renderHeldList, renderDeviceChecklist, renderImportPreview, renderStorageInfo, viewMeta } from './ui/views.js';
import { makeIntervalEarQuestion, makeChordEarQuestion, makeMelodyEarQuestion, judgeEar, earQuestionNotes } from './core/ear-engine.js';
import { recordPieceRun } from './core/piece-mastery.js';
import { KeyboardController } from './ui/keyboard.js';
import { showToast, openModal, confirmDialog, closeModal, initModalBindings } from './ui/notify.js';

const APP_VERSION = '0.3.0-beta';

const state = {
  currentView: 'home',
  lessonId: null,
  lessonEngine: null,
  lessonStatus: null,
  quizSession: null,
  quizMatcher: null,
  quizFeedback: null,
  earSession: null,
  practiceMode: false,
  activeModule: null,
  lab: { filter: 'all', paused: false, expanded: new Set(), learnTarget: null },
  labMetronome: { running: false, beat: 0 }
};

const bus = new EventBus();
const audio = new AudioEngine();
const metronome = new Metronome({ audio, onBeat: payload => handleMetronomeBeat(payload) });
const midi = new MidiService({ bus, maxEvents: 300 });
const simulated = new SimulatedMidiAdapter();
const webMidi = new WebMidiAdapter({ service: midi, onStatusChange: () => updateDeviceStatus(), onError: () => {} });
const nativeBridge = new NativeBridgeAdapter({ service: midi, onStatusChange: () => updateDeviceStatus() });

midi.registerAdapter(simulated);
midi.registerAdapter(webMidi);
midi.registerAdapter(nativeBridge);

let progress = loadProgress();
midi.maxEvents = progress.settings.eventLogLimit;
audio.setVolume(progress.settings.volume);
audio.setMetronomeVolume(progress.settings.metronomeVolume);
metronome.setBpm(progress.settings.metronomeBpm);

let saveTimer = null;
let rhythmSession = null;
let demoTimers = [];
let currentQuizQuestionId = null;
let waitingWorker = null;

// ---------------------------------------------------------------- 进度保存

function saveProgressDebounced() {
  if (saveTimer) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    persistNow();
  }, 300);
}

function persistNow() {
  if (saveTimer) {
    window.clearTimeout(saveTimer);
    saveTimer = null;
  }
  const result = saveProgress(progress);
  if (!result.ok && result.reason !== 'unavailable') {
    showToast('本地存储写入失败：可能是浏览器限制或空间不足。请导出进度备份。', { tone: 'warn', duration: 4200 });
  }
  updateChrome();
}

function recordActivity() {
  markActiveDay(progress);
  saveProgressDebounced();
}

// ---------------------------------------------------------------- 渲染

function render({ focusSelector = null } = {}) {
  const content = $('#app-content');
  if (!content) return;
  const [eyebrow, title] = viewMeta(viewForChrome());
  const eyebrowEl = $('#top-eyebrow');
  const titleEl = $('#top-title');
  if (eyebrowEl) eyebrowEl.textContent = eyebrow;
  if (titleEl) titleEl.textContent = title;

  const scrollY = window.scrollY;
  if (state.currentView === 'home') content.innerHTML = renderHome({ progress, midi });
  else if (state.currentView === 'courses') content.innerHTML = renderCourses({ progress, midi }, state.activeModule);
  else if (state.currentView === 'lesson') content.innerHTML = renderLessonPage({ progress, midi, lessonId: state.lessonId, lessonStatus: state.lessonStatus });
  else if (state.currentView === 'practice') content.innerHTML = renderPractice({ progress, midi, quizSession: state.quizSession, quizFeedback: state.quizFeedback });
  else if (state.currentView === 'ear') content.innerHTML = renderEar({ progress, earSession: state.earSession });
  else if (state.currentView === 'midi') content.innerHTML = renderMidiLab({ progress, midi, lab: state.lab, labMetronome: state.labMetronome });
  else if (state.currentView === 'progress') content.innerHTML = renderProgress({ progress, midi });

  updateNavActive();
  updateChrome();
  updateDeviceStatus();
  syncHeldHighlights();
  updateLastNoteLabels();
  if (state.currentView === 'lesson') {
    renderLessonActions();
    updateLessonUI();
  }
  if (state.currentView === 'practice' && state.quizSession) ensureQuizMatcher();
  if (state.currentView === 'midi') {
    // 事件列表由 renderMidiLab 直接渲染首屏；此处只同步数量。
    updateLabCounters();
  }
  if (focusSelector) {
    const target = $(focusSelector);
    if (target) target.focus({ preventScroll: true });
  }
  if (Math.abs(window.scrollY - scrollY) > 4) window.scrollTo({ top: scrollY });
}

/** 课程视图在导航上归属「互动课程」。 */
function viewForChrome() {
  return state.currentView === 'lesson' ? 'courses' : state.currentView;
}

function updateNavActive() {
  const view = viewForChrome();
  $$('[data-view]').forEach(button => {
    if (!button.classList.contains('nav-item') && !button.classList.contains('mobile-nav-item')) return;
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
}

function updateChrome() {
  const count = progress.completedLessons.length;
  const percent = Math.round((count / LESSON_COUNT) * 100);
  const sidePercent = $('#side-progress-percent');
  const sideBar = $('#side-progress-bar');
  const navCount = $('#nav-course-count');
  if (sidePercent) sidePercent.textContent = `${percent}%`;
  if (sideBar) sideBar.style.width = `${percent}%`;
  if (navCount) navCount.textContent = `${count}/${LESSON_COUNT}`;
}

function updateDeviceStatus() {
  const statusEl = $('#top-device-status');
  const pill = $('#connection-pill');
  const connected = midi.isConnected();
  if (statusEl) {
    if (connected) statusEl.textContent = `MIDI 已连接`;
    else if (midi.status === 'unsupported') statusEl.textContent = '浏览器 MIDI 受限';
    else if (midi.status === 'denied') statusEl.textContent = 'MIDI 权限被拒绝';
    else statusEl.textContent = '键盘未连接';
  }
  const led = pill?.querySelector('.status-led');
  if (led) led.classList.toggle('online', connected);
  if (pill) pill.title = midi.statusSummary().title;
}

// ---------------------------------------------------------------- 导航

function navigate(view, { pushHash = true } = {}) {
  if (!['home', 'courses', 'lesson', 'practice', 'ear', 'midi', 'progress'].includes(view)) view = 'home';
  if (view !== 'practice') {
    state.quizSession = null;
    state.quizFeedback = null;
    state.quizMatcher = null;
  }
  if (view !== 'ear') {
    state.earSession = null;
  }
  if (view !== 'lesson' && state.currentView === 'lesson') stopRhythm();
  if (view !== 'midi') {
    // 离开实验室时停止映射监听，避免在其他页面误捕获 CC。
    state.lab.learnTarget = null;
  }
  state.currentView = view;
  if (pushHash) setHash(view);
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setHash(view) {
  const hash = view === 'lesson' && state.lessonId ? `#lesson/${state.lessonId}` : `#${view}`;
  if (location.hash !== hash) {
    try { history.replaceState(null, '', hash); } catch (_) { /* file:// 等环境可能不允许 */ }
  }
}

function parseHash() {
  const hash = (location.hash || '').replace(/^#/, '');
  if (hash.startsWith('lesson/')) {
    const id = hash.slice('lesson/'.length);
    if (findLesson(id)) return { view: 'lesson', lessonId: id };
  }
  if (['home', 'courses', 'practice', 'ear', 'midi', 'progress'].includes(hash)) return { view: hash };
  return { view: 'home' };
}

function openLesson(id, { pushHash = true } = {}) {
  const lesson = findLesson(id) || LESSONS[0];
  if (state.lessonEngine && state.lessonEngine.lesson.id !== lesson.id) stopRhythm();
  state.lessonId = lesson.id;
  state.lessonEngine = createLessonEngine({
    lesson,
    forgiving: state.practiceMode,
    onStatusChange: status => {
      state.lessonStatus = status;
      updateLessonUI();
      if (status.complete) markLessonCompleted(lesson.id);
    }
  });
  state.lessonStatus = state.lessonEngine.status;
  state.currentView = 'lesson';
  progress.lessonAttempts[lesson.id] = (progress.lessonAttempts[lesson.id] || 0) + 1;
  recordActivity();
  if (pushHash) setHash('lesson');
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function markLessonCompleted(lessonId) {
  const firstTime = !progress.completedLessons.includes(lessonId);
  if (firstTime) progress.completedLessons.push(lessonId);
  // 曲目（H 模块）完成时，独立记录熟练度。
  const lesson = findLesson(lessonId);
  if (lesson?.module === 'H' && state.lessonStatus) {
    const report = state.lessonStatus.practiceReport;
    const rhythm = state.lessonStatus.pieceRhythmReport;
    progress.pieceStats = recordPieceRun(progress.pieceStats, lessonId, {
      accuracyPercent: rhythm?.summary?.accuracyPercent ?? null,
      evennessPercent: report?.evennessPercent ?? null
    });
  }
  recordActivity();
  persistNow();
  renderLessonActions();
  updateLessonUI();
  if (firstTime) {
    showToast(`🎉 你完成了「${lesson?.title || '课程'}」！${completionCheer(lesson)}`, { tone: 'success', duration: 3600 });
  }
}

/** 完成课程时的「能力感」反馈：说出用户刚刚掌握的具体能力，而不是泛泛的「已完成」。 */
function completionCheer(lesson) {
  if (!lesson) return '';
  const title = lesson.title;
  const byModule = {
    A: `你现在能在键盘上找到 ${title} 了。`,
    B: `你已经会用琴键听出音与音之间的距离了。`,
    C: `你刚刚亲手弹出了一条完整的音阶。`,
    D: `你已经能弹出真正的和弦了。`,
    E: `你能跟着节拍稳定地弹奏了。`,
    F: `你开始能看着五线谱弹琴了。`,
    G: `你理解了键盘背后的 MIDI 世界。`,
    H: `你现在能完整弹出一首曲子《${title}》了！`,
    I: `你的手指技巧又进一步：完成了「${title}」。`
  };
  return byModule[lesson.module] || `你刚刚掌握了「${title}」。`;
}

// ---------------------------------------------------------------- 课程界面更新

function renderLessonActions() {
  const box = $('#lesson-exercise-actions');
  if (!box) return;
  const lesson = findLesson(state.lessonId);
  if (!lesson) return;
  const done = progress.completedLessons.includes(lesson.id);
  const complete = Boolean(state.lessonStatus?.complete);
  const next = nextLessonAfter(lesson.id);
  box.innerHTML = `
    ${complete ? `<span class="exercise-done">✓ 练习已通过${done ? ' · 进度已保存' : ''}</span>` : ''}
    <button class="btn btn-dark-ghost btn-small" data-action="reset-lesson">${complete ? '再练一次 ↻' : '重新开始 ↻'}</button>
    <button class="btn btn-dark-ghost btn-small" data-action="toggle-practice-mode">${state.practiceMode ? '练习模式：开 ✓' : '练习模式'}</button>
    ${complete && next ? `<button class="btn btn-primary btn-small" data-action="next-lesson" data-id="${next.id}">下一课 →</button>` : ''}
    ${complete && !next ? `<button class="btn btn-primary btn-small" data-view="courses">返回课程列表 →</button>` : ''}`;
}

function updateLessonUI() {
  if (state.currentView !== 'lesson' || !state.lessonStatus) return;
  const status = state.lessonStatus;
  const lesson = findLesson(state.lessonId);
  const counter = $('#lesson-exercise-counter');
  const bar = $('#lesson-exercise-progress');
  const feedback = $('#lesson-exercise-feedback');
  const total = lesson?.task.target.length || 1;
  if (counter) counter.textContent = `${Math.min(status.index, total)}/${total}`;
  if (bar) bar.style.width = `${Math.min((status.index / total) * 100, 100)}%`;
  const comboEl = $('#lesson-combo');
  if (comboEl) {
    if (status.combo >= 2) {
      comboEl.textContent = `🔥 连击 ×${status.combo}`;
      comboEl.hidden = false;
    } else {
      comboEl.hidden = true;
    }
  }
  if (feedback && feedback.textContent !== status.feedback) {
    feedback.textContent = status.feedback;
    feedback.dataset.tone = status.complete ? 'success' : (status.wrongAttempts > 0 && status.index === 0 ? 'warn' : 'default');
  }
  const side = $('#lesson-side-progress');
  if (side) side.style.width = `${status.complete ? 100 : (status.index / total) * 100}%`;
  const exercise = $('#lesson-exercise');
  if (exercise) exercise.classList.toggle('is-complete', Boolean(status.complete));
  renderLessonActions();
}

function updateLastNoteLabels() {
  if (!state.lastNote) return;
  const text = noteName(state.lastNote, { naming: progress.settings.naming });
  $$('[data-last-note]').forEach(element => { element.textContent = text; });
}

// ---------------------------------------------------------------- 虚拟键盘 / 输入

const keyboard = new KeyboardController({
  onNoteOn: (note, velocity, meta) => {
    const source = meta.source || 'virtual';
    recordActivity();
    simulated.note(true, note, velocity, { source });
    progress.practiceNotes += 1;
    saveProgressDebounced();
  },
  onNoteOff: (note, meta) => {
    simulated.note(false, note, 0, { source: meta.source || 'virtual' });
  },
  getBaseNote: () => progress.settings.keyboardStart + 12
});

function pressVirtualNote(note) {
  simulated.note(true, note, 100);
  simulated.note(false, note, 0);
}

// ---------------------------------------------------------------- MIDI 事件分派

bus.on('note:on', event => {
  state.lastNote = event.note;
  updateLastNoteLabels();
  highlightKey(event.note, true, event.source);
  const shouldSound = event.source === 'virtual' || event.source === 'computer'
    ? true
    : progress.settings.monitorHardwareSound;
  if (shouldSound) audio.noteOn(event.note, event.velocity || 90, { source: event.source });
  routeNoteEvent(event);
});

bus.on('note:off', event => {
  const stillHeld = midi.hasHeld(event.note);
  if (!stillHeld) clearKeyHighlight(event.note);
  audio.noteOff(event.note, { source: event.source });
  routeNoteEvent(event);
});

bus.on('control:change', event => {
  // CC64 = 延音踏板：踩下时让音符保持，松开后释放。
  if (event.controller === 64) {
    audio.setSustain(event.value >= 64);
  }
  if (state.lab.learnTarget) {
    const target = state.lab.learnTarget;
    progress.ccMappings[event.controller] = target;
    state.lab.learnTarget = null;
    recordActivity();
    persistNow();
    if (state.currentView === 'midi') render();
    showToast(`已把 CC ${event.controller} 映射到${target === 'volume' ? '主音量' : '节拍器音量'}。`, { tone: 'success' });
    return;
  }
  for (const [controller, target] of Object.entries(progress.ccMappings)) {
    if (Number(controller) !== event.controller) continue;
    const normalized = event.value / 127;
    if (target === 'volume') {
      audio.setVolume(normalized);
      progress.settings.volume = normalized;
      const range = $('#volume-range');
      if (range) range.value = String(Math.round(normalized * 100));
    } else if (target === 'metronome') {
      audio.setMetronomeVolume(normalized);
      progress.settings.metronomeVolume = normalized;
    }
    saveProgressDebounced();
  }
  if (state.currentView === 'midi') refreshEventListOnly();
});

bus.on('pitch:bend', () => {
  if (state.currentView === 'midi') refreshEventListOnly();
});

bus.on('midi:event', event => {
  if (state.currentView === 'midi') {
    refreshEventListOnly();
    updateLabCounters();
    if (event.type === EVENT_TYPES.NOTE_ON || event.type === EVENT_TYPES.CONTROL_CHANGE) {
      refreshHeldList();
    }
  }
});

bus.on('held:change', () => {
  if (state.currentView === 'midi') refreshHeldList();
  syncHeldHighlights();
});

bus.on('device:disconnected', payload => {
  audio.allNotesOff();
  clearAllHighlights();
  showToast(`MIDI 设备「${payload.name || '未知设备'}」已断开，输入状态已重置。`, { tone: 'warn' });
  updateDeviceStatus();
  if (state.currentView === 'midi') render();
});

bus.on('selection:change', () => {
  clearAllHighlights();
  updateDeviceStatus();
  if (state.currentView === 'midi') render();
});

function routeNoteEvent(event) {
  if (state.currentView === 'lesson' && state.lessonEngine) {
    state.lessonEngine.handleEvent(event);
    if (rhythmSession && event.type === EVENT_TYPES.NOTE_ON) {
      rhythmSession.addHit(event.timestamp, event.note, event.velocity);
    }
  } else if (state.currentView === 'practice' && state.quizSession && !state.quizSession.done) {
    const question = currentQuestion(state.quizSession);
    if (question?.type === 'play') {
      const result = answerPlay(state.quizSession, event, state.quizMatcher);
      if (result) {
        state.quizFeedback = result;
        updateQuizPlayFeedback(result);
        if (result.complete) finishQuizAnswer(question, true);
      }
    }
  }
}

function highlightKey(note, active, source) {
  const hardware = source === 'webmidi' || source === 'native';
  $$(`.piano-key[data-note="${note}"]`).forEach(key => {
    if (active) {
      key.classList.add('is-active');
      if (hardware) key.classList.add('is-hardware');
    }
  });
}

function clearKeyHighlight(note) {
  $$(`.piano-key[data-note="${note}"]`).forEach(key => {
    key.classList.remove('is-active', 'is-hardware');
  });
}

function clearAllHighlights() {
  $$('.piano-key.is-active').forEach(key => key.classList.remove('is-active', 'is-hardware'));
}

function syncHeldHighlights() {
  const held = new Map(midi.getHeldNotes().map(item => [item.note, item]));
  $$('.piano-key').forEach(key => {
    const note = Number(key.dataset.note);
    const item = held.get(note);
    key.classList.toggle('is-active', Boolean(item));
    key.classList.toggle('is-hardware', Boolean(item && item.sources.some(source => source === 'webmidi' || source === 'native')));
  });
  $$('[data-last-note]').forEach(el => {
    if (state.lastNote) el.textContent = noteName(state.lastNote, { naming: progress.settings.naming });
  });
}

// ---------------------------------------------------------------- MIDI 实验室

function refreshEventListOnly() {
  const list = $('#event-list');
  if (!list) return;
  list.innerHTML = renderEventList({ midi, lab: state.lab, progress });
}

function updateLabCounters() {
  const count = $('#midi-event-count');
  if (count) count.textContent = String(midi.events.length);
  const last = midi.events.find(event => event.type === 'note-on');
  const value = $('#midi-last-value');
  if (value) value.textContent = last && last.velocity != null ? String(last.velocity) : '—';
}

function refreshHeldList() {
  const list = $('#held-list');
  const count = $('#held-count');
  const held = midi.getHeldNotes();
  if (list) list.innerHTML = renderHeldList(held, progress.settings.naming);
  if (count) count.textContent = `${held.length} 个音`;
}

async function connectMidi() {
  if (!WebMidiAdapter.isSupported()) {
    showToast('当前浏览器不支持 Web MIDI。虚拟键盘与课程仍可使用；iPhone / iPad 需要原生 MIDI 桥接。', { tone: 'warn', duration: 4200 });
    render();
    return;
  }
  const result = await webMidi.connect();
  if (!result.ok && result.reason === 'insecure-context') showToast('MIDI 需要 HTTPS 或 localhost 安全来源。', { tone: 'warn' });
  else if (!result.ok && result.reason === 'denied') showToast('MIDI 权限被拒绝，可以在浏览器设置中重新允许。', { tone: 'warn' });
  else if (!result.ok) showToast('无法访问 MIDI 设备。请检查浏览器权限与连接方式。', { tone: 'warn' });
  else if (!midi.getInputs().length) showToast('已开启 MIDI 访问，但暂时没有发现输入设备。');
  else showToast('MIDI 访问已开启。选择设备后按下琴键测试。', { tone: 'success' });
  if (state.currentView === 'midi') render();
}

function refreshMidi() {
  if (webMidi.access) {
    webMidi._syncInputs();
    render();
    showToast(midi.getInputs().length ? '设备列表已刷新。' : '仍然没有检测到输入设备。');
  } else {
    showToast('请先点击「连接 MIDI 设备」请求权限。');
  }
}

// ---------------------------------------------------------------- 节拍器

function handleMetronomeBeat(payload) {
  const dots = $$('#lesson-beat-dots .beat-dot, .lab-metronome .beat-dot');
  dots.forEach(dot => {
    const beat = Number(dot.dataset.beat);
    dot.classList.toggle('active', beat === payload.beatInBar);
  });
  if (payload.beatInBar === 1) {
    window.setTimeout(() => dots.forEach(dot => dot.classList.remove('active')), 90);
  }
  const labTag = $('.lab-metronome .tag');
  if (labTag && state.labMetronome.running) labTag.textContent = `BEAT ${payload.beat}`;
}

async function toggleLabMetronome() {
  if (state.labMetronome.running) {
    metronome.stop();
    state.labMetronome.running = false;
    if (state.currentView === 'midi') render();
    return;
  }
  const input = $('#lab-bpm');
  const bpm = Number(input?.value || progress.settings.metronomeBpm);
  progress.settings.metronomeBpm = bpm;
  metronome.setBpm(bpm);
  const started = await metronome.start({ countInBeats: 1 });
  state.labMetronome.running = started;
  if (!started) showToast('音频无法启动。请先点击页面任意位置，再试一次。', { tone: 'warn' });
  if (state.currentView === 'midi') render();
}

async function toggleLessonMetronome() {
  const lesson = findLesson(state.lessonId);
  if (!lesson || lesson.task.mode !== 'rhythm') return;
  if (rhythmSession?.running) {
    rhythmSession.stop();
    return;
  }
  rhythmSession = new RhythmSession({
    audio,
    metronome,
    bpm: lesson.task.tempo || 80,
    beats: lesson.task.beats || lesson.task.target.length,
    toleranceMs: lesson.task.toleranceMs ?? 200,
    countInBeats: 2,
    onUpdate: ({ feedback, analysis }) => {
      if (state.lessonStatus && !state.lessonStatus.complete) {
        state.lessonStatus = { ...state.lessonStatus, feedback };
        updateLessonUI();
        renderRhythmAnalysis(analysis);
      }
    },
    onComplete: ({ passed, feedback, analysis }) => {
      renderRhythmAnalysis(analysis);
      rhythmSession = null;
      const button = $('#lesson-metronome-button');
      if (button) { button.textContent = '开始节拍器 ▶'; button.disabled = false; }
      if (passed) {
        state.lessonEngine?.completeExternally(feedback);
        showToast('节奏练习通过！', { tone: 'success' });
      } else {
        state.lessonStatus = { ...state.lessonStatus, feedback };
        updateLessonUI();
      }
    },
    onBeat: payload => {
      $$('#lesson-beat-dots .beat-dot').forEach(dot => {
        const beat = Number(dot.dataset.beat);
        dot.classList.toggle('active', beat === payload.beatInBar);
      });
    }
  });
  const started = await rhythmSession.start();
  if (!started) {
    rhythmSession = null;
    showToast('音频无法启动。请先点击页面任意位置，再试一次。', { tone: 'warn' });
    return;
  }
  const button = $('#lesson-metronome-button');
  if (button) { button.textContent = '停止节拍器 ■'; }
  state.lessonStatus = { ...state.lessonStatus, feedback: '节拍器开始：预备两拍。每一拍弹一次 C4。' };
  updateLessonUI();
}

function stopRhythm() {
  if (rhythmSession) {
    rhythmSession.stop();
    rhythmSession = null;
  }
  metronome.stop();
  state.labMetronome.running = false;
}

function renderRhythmAnalysis(analysis) {
  const box = $('#lesson-rhythm-analysis');
  if (!box) return;
  if (!analysis) { box.innerHTML = ''; return; }
  box.innerHTML = analysis.entries.map(entry => `<div class="rhythm-bar ${entry.onTime ? (entry.early ? 'early' : entry.late ? 'late' : 'on') : 'missed'}">
    <span class="rhythm-beat">${entry.beat}</span>
    <span class="rhythm-track"><span class="rhythm-marker" style="left:${entry.onTime ? Math.max(0, Math.min(100, 50 + (entry.errorMs / 400) * 100)) : 50}%"></span></span>
    <span class="rhythm-error">${entry.onTime ? `${entry.errorMs > 0 ? '+' : ''}${entry.errorMs} ms` : '未命中'}</span>
  </div>`).join('');
}

// ---------------------------------------------------------------- 测验

function startQuiz(categoryId) {
  const pool = questionsForCategory(categoryId);
  const size = categoryId === 'all' ? Math.min(8, pool.length) : pool.length;
  state.quizSession = createQuizSession({ pool, category: categoryId, size });
  state.quizFeedback = null;
  state.quizMatcher = null;
  currentQuizQuestionId = null;
  progress.practiceSessions += 1;
  recordActivity();
  persistNow();
  navigate('practice');
}

function ensureQuizMatcher() {
  const question = currentQuestion(state.quizSession);
  if (!question || question.type !== 'play') {
    state.quizMatcher = null;
    currentQuizQuestionId = null;
    return;
  }
  if (currentQuizQuestionId !== question.id) {
    state.quizMatcher = createPlayMatcher(question);
    currentQuizQuestionId = question.id;
    state.quizFeedback = null;
  }
}

function updateQuizPlayFeedback(result) {
  const box = $('#quiz-play-feedback');
  if (!box) return;
  box.textContent = result.feedback;
  box.classList.toggle('good', Boolean(result.complete));
  box.classList.toggle('bad', !result.complete && result.status?.status === 'wrong');
}

function finishQuizAnswer(question, correct) {
  const session = state.quizSession;
  if (!session) return;
  progress.quizAnswered += 1;
  if (correct) progress.quizCorrect += 1;
  const stats = progress.quizByCategory[question.category] || { answered: 0, correct: 0 };
  stats.answered += 1;
  if (correct) stats.correct += 1;
  progress.quizByCategory[question.category] = stats;
  if (!correct) {
    progress.wrongCounts[question.id] = (progress.wrongCounts[question.id] || 0) + 1;
  }
  recordActivity();
  persistNow();
  render();
}

function handleQuizAnswer(index) {
  const session = state.quizSession;
  if (!session || session.answered) return;
  const question = currentQuestion(session);
  if (!question || question.type !== 'choice') return;
  const result = answerChoice(session, index);
  if (!result) return;
  finishQuizAnswer(question, result.correct);
}

function handleNextQuestion() {
  const session = state.quizSession;
  if (!session) return;
  if (session.index >= session.questions.length - 1) {
    session.done = true;
    render();
    return;
  }
  nextQuestion(session);
  state.quizFeedback = null;
  state.quizMatcher = null;
  currentQuizQuestionId = null;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ---------------------------------------------------------------- 练耳

function startEar(earType = 'mixed') {
  const count = 6;
  const questions = [];
  const rootNotes = [60, 62, 64, 65, 67, 69]; // C4 到 A4 的白键，听辨范围
  for (let i = 0; i < count; i += 1) {
    const root = rootNotes[i % rootNotes.length];
    const type = earType === 'mixed'
      ? ['interval', 'chord', 'melody'][i % 3]
      : earType;
    if (type === 'interval') questions.push(makeIntervalEarQuestion(root));
    else if (type === 'chord') questions.push(makeChordEarQuestion(root));
    else questions.push(makeMelodyEarQuestion(root));
  }
  state.earSession = {
    type: earType,
    questions,
    index: 0,
    score: 0,
    answered: false,
    selected: null,
    played: false,
    done: false
  };
  progress.practiceSessions += 1;
  recordActivity();
  persistNow();
  navigate('ear');
}

function playEarSound() {
  const session = state.earSession;
  if (!session) return;
  const question = session.questions[session.index];
  const notes = earQuestionNotes(question);
  if (!notes.length) return;
  session.played = true;
  // 依次播放（间隔 350ms），音程两音、和弦同响、旋律依次。
  demoTimers.forEach(timer => window.clearTimeout(timer));
  demoTimers = [];
  if (question.type === 'chord') {
    notes.forEach(note => audio.noteOn(note, 90, { source: 'ear' }));
    window.setTimeout(() => notes.forEach(note => audio.noteOff(note, { source: 'ear' })), 900);
  } else {
    notes.forEach((note, index) => {
      const timer = window.setTimeout(() => {
        audio.noteOn(note, 90, { source: 'ear' });
        const stop = window.setTimeout(() => audio.noteOff(note, { source: 'ear' }), 500);
        demoTimers.push(stop);
      }, index * 380);
      demoTimers.push(timer);
    });
  }
  render();
}

function handleEarAnswer(index) {
  const session = state.earSession;
  if (!session || session.answered) return;
  const question = session.questions[session.index];
  const result = judgeEar(question, index);
  if (!result) return;
  session.answered = true;
  session.selected = index;
  if (result.correct) session.score += 1;
  progress.earStats = progress.earStats || { answered: 0, correct: 0 };
  progress.earStats.answered += 1;
  if (result.correct) progress.earStats.correct += 1;
  recordActivity();
  persistNow();
  render();
}

function handleNextEar() {
  const session = state.earSession;
  if (!session) return;
  if (session.index >= session.questions.length - 1) {
    session.done = true;
    render();
    return;
  }
  session.index += 1;
  session.answered = false;
  session.selected = null;
  session.played = false;
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function exitEar() {
  state.earSession = null;
  navigate('ear');
}

// ---------------------------------------------------------------- 设置

function applySettingsFromProgress() {
  audio.setVolume(progress.settings.volume);
  audio.setMetronomeVolume(progress.settings.metronomeVolume);
  metronome.setBpm(progress.settings.metronomeBpm);
  midi.maxEvents = progress.settings.eventLogLimit;
}

function setNaming(naming) {
  progress.settings.naming = naming === 'yamaha' ? 'yamaha' : 'standard';
  recordActivity();
  persistNow();
  render();
}

// ---------------------------------------------------------------- 导出 / 导入

function downloadProgress() {
  const content = exportProgress(progress, { appVersion: APP_VERSION });
  downloadFile(`${timestampForFilename('keylab-progress')}.json`, content);
  showToast('进度已导出为 JSON 文件。', { tone: 'success' });
}

function beginImport() {
  const input = $('#import-file');
  if (!input) return;
  input.value = '';
  input.click();
}

async function handleImportFile(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    showToast('文件过大（超过 2 MB），不像是 KeyLab 进度备份。', { tone: 'warn' });
    return;
  }
  let text = '';
  try {
    text = await file.text();
  } catch (_) {
    showToast('无法读取文件。', { tone: 'warn' });
    return;
  }
  const parsed = parseImport(text);
  if (!parsed.ok) {
    await openModal({
      title: '无法导入',
      bodyHtml: `<p>${escapeHtml(parsed.error)}</p><p class="side-note">当前进度没有被修改。</p>`,
      confirmLabel: '知道了',
      showCancel: false
    });
    return;
  }
  const preview = summarizeImport(parsed.progress);
  const confirmed = await openModal({
    title: '导入进度预览',
    bodyHtml: renderImportPreview(parsed.progress, parsed.warnings),
    confirmLabel: '覆盖并导入',
    cancelLabel: '取消',
    wide: true
  });
  if (!confirmed) return;
  progress = parsed.progress;
  applySettingsFromProgress();
  markActiveDay(progress);
  persistNow();
  state.quizSession = null;
  state.lessonEngine = null;
  state.lessonStatus = null;
  state.lab.learnTarget = null;
  render();
  showToast(`导入成功：${preview.completedLessons} 节课程、${preview.quizAnswered} 道答题记录。`, { tone: 'success', duration: 3800 });
}

function exportEvents(format) {
  if (!midi.events.length) {
    showToast('还没有事件可以导出。');
    return;
  }
  const stamp = timestampForFilename('keylab-midi-events');
  if (format === 'json') {
    const payload = midi.events.map(event => ({
      type: event.type,
      channel: event.channel,
      note: event.note,
      velocity: event.velocity,
      controller: event.controller,
      value: event.value,
      bend: event.bend,
      program: event.program,
      pressure: event.pressure,
      source: event.source,
      sourceLabel: sourceLabel(event.source),
      deviceName: event.deviceName,
      rawBytes: hexBytes(event.rawBytes),
      wallTime: new Date(event.wallTime).toISOString()
    }));
    downloadFile(`${stamp}.json`, JSON.stringify({ app: 'KeyLab', exportedAt: new Date().toISOString(), events: payload }, null, 2));
  } else {
    const header = ['time', 'type', 'channel', 'note', 'velocity', 'controller', 'value', 'bend', 'source', 'device', 'rawBytes'];
    const escapeCsv = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = midi.events.map(event => [
      new Date(event.wallTime).toISOString(), event.type, event.channel, event.note ?? '', event.velocity ?? '',
      event.controller ?? '', event.value ?? '', event.bend ?? '', sourceLabel(event.source), event.deviceName || '', hexBytes(event.rawBytes)
    ].map(escapeCsv).join(','));
    downloadFile(`${stamp}.csv`, `${header.join(',')}\n${rows.join('\n')}`, 'text/csv');
  }
  showToast('事件日志已导出。', { tone: 'success' });
}

function exportDeviceReport() {
  const report = midi.deviceReport();
  downloadFile(`${timestampForFilename('keylab-device-report')}.json`, JSON.stringify(report, null, 2));
  showToast('设备观察报告已导出。请在实机上核对后再更新设备档案。', { duration: 3600 });
}

// ---------------------------------------------------------------- 动作分发

async function handleAction(button) {
  const action = button.dataset.action;
  if (!action) return;
  switch (action) {
    case 'continue-learning': {
      const next = LESSONS.find(lesson => !progress.completedLessons.includes(lesson.id)) || LESSONS[0];
      openLesson(next.id);
      break;
    }
    case 'open-lesson':
      openLesson(button.dataset.id);
      break;
    case 'next-lesson':
      openLesson(button.dataset.id);
      break;
    case 'complete-lesson': {
      const id = button.dataset.id || state.lessonId;
      if (!state.lessonStatus?.complete) {
        showToast('先完成本课的键盘练习，再标记完成。');
        return;
      }
      markLessonCompleted(id);
      showToast('已保存本课完成状态。', { tone: 'success' });
      break;
    }
    case 'open-course-view':
      navigate('courses');
      break;
    case 'reset-lesson':
      state.lessonEngine?.reset();
      state.lessonStatus = state.lessonEngine?.status || null;
      stopRhythm();
      render();
      break;
    case 'toggle-practice-mode': {
      state.practiceMode = !state.practiceMode;
      const lesson = findLesson(state.lessonId);
      if (lesson) openLesson(lesson.id, { pushHash: false });
      else render();
      showToast(state.practiceMode ? '练习模式已开启：弹错不会从头开始，慢慢来。' : '练习模式已关闭。', { tone: 'success' });
      break;
    }
    case 'start-quiz':
      startQuiz(button.dataset.category || 'all');
      break;
    case 'answer':
      handleQuizAnswer(Number(button.dataset.index));
      break;
    case 'next-question':
      handleNextQuestion();
      break;
    case 'retry-quiz':
      startQuiz(state.quizSession?.category || 'all');
      break;
    case 'exit-quiz':
      state.quizSession = null;
      state.quizMatcher = null;
      state.quizFeedback = null;
      navigate('practice');
      break;
    case 'start-ear':
      startEar(button.dataset.earType || 'mixed');
      break;
    case 'play-ear':
      playEarSound();
      break;
    case 'answer-ear':
      handleEarAnswer(Number(button.dataset.index));
      break;
    case 'next-ear':
      handleNextEar();
      break;
    case 'retry-ear':
      startEar(state.earSession?.type || 'mixed');
      break;
    case 'exit-ear':
      exitEar();
      break;
    case 'play-demo':
      playDemo(button.dataset.notes, button.dataset.label);
      break;
    case 'toggle-lesson-metronome':
      await toggleLessonMetronome();
      break;
    case 'toggle-lab-metronome':
      await toggleLabMetronome();
      break;
    case 'connect-midi':
      await connectMidi();
      break;
    case 'refresh-midi':
      refreshMidi();
      break;
    case 'clear-events':
      midi.clearEvents();
      state.lab.expanded.clear();
      if (state.currentView === 'midi') render();
      showToast('事件日志已清空。');
      break;
    case 'toggle-log-pause': {
      const paused = midi.setLogPaused(!midi.isLogPaused());
      state.lab.paused = paused;
      if (state.currentView === 'midi') render();
      showToast(paused ? '事件记录已暂停（事件仍会参与课程判分）。' : '已恢复事件记录。');
      break;
    }
    case 'filter-events':
      state.lab.filter = button.dataset.filter || 'all';
      if (state.currentView === 'midi') render();
      break;
    case 'toggle-event': {
      const index = Number(button.dataset.eventIndex);
      const event = midi.events[index];
      if (!event) return;
      if (state.lab.expanded.has(event)) state.lab.expanded.delete(event);
      else state.lab.expanded.add(event);
      refreshEventListOnly();
      break;
    }
    case 'export-events-json':
      exportEvents('json');
      break;
    case 'export-events-csv':
      exportEvents('csv');
      break;
    case 'export-device-report':
      exportDeviceReport();
      break;
    case 'show-device-checklist': {
      const selected = midi.getSelected();
      const profile = selected?.profile;
      if (!profile) {
        showToast('当前没有识别到专用设备档案。');
        return;
      }
      await openModal({
        title: `${profile.name} 实机验证清单`,
        bodyHtml: renderDeviceChecklist(profile),
        confirmLabel: '知道了',
        showCancel: false,
        wide: true
      });
      break;
    }
    case 'learn-cc':
      state.lab.learnTarget = state.lab.learnTarget === button.dataset.target ? null : button.dataset.target;
      if (state.currentView === 'midi') render();
      showToast(state.lab.learnTarget ? '请转动键盘上的旋钮或推子…' : '已取消 CC 学习。');
      break;
    case 'remove-cc':
      delete progress.ccMappings[button.dataset.controller];
      persistNow();
      render();
      break;
    case 'reset-cc':
      progress.ccMappings = {};
      persistNow();
      render();
      showToast('CC 映射已清空。');
      break;
    case 'reset-progress': {
      const confirmed = await confirmDialog({
        title: '重置所有本地学习记录？',
        bodyHtml: '<p>这会清除课程完成状态、答题统计、练习次数、CC 映射和设置。此操作无法撤销。</p><p class="side-note">建议先导出进度 JSON 作为备份。</p>',
        confirmLabel: '确认重置',
        cancelLabel: '取消',
        tone: 'danger'
      });
      if (!confirmed) return;
      const settings = progress.settings;
      progress = emptyProgress(settings);
      applySettingsFromProgress();
      state.quizSession = null;
      state.lessonEngine = null;
      state.lessonStatus = null;
      state.lab.learnTarget = null;
      persistNow();
      render();
      showToast('学习记录已重置（偏好设置已保留）。', { tone: 'success' });
      break;
    }
    case 'export-progress':
      downloadProgress();
      break;
    case 'import-progress':
      beginImport();
      break;
    case 'show-storage-info':
      await openModal({ title: '本地数据说明', bodyHtml: renderStorageInfo(), confirmLabel: '知道了', showCancel: false });
      break;
    case 'confirm-modal':
      closeModal(true);
      break;
    case 'cancel-modal':
    case 'close-modal':
      closeModal(false);
      break;
    case 'reload-app':
      window.__keylabReloading = true;
      waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
      window.setTimeout(() => window.location.reload(), 600);
      break;
    case 'dismiss-update':
      $('#update-banner')?.setAttribute('hidden', '');
      break;
    default:
      break;
  }
}

/** 重置为默认进度，但保留用户偏好设置（音量、命名等）。 */
function emptyProgress(settingsSnapshot) {
  const empty = defaultProgress();
  if (settingsSnapshot) empty.settings = { ...empty.settings, ...settingsSnapshot };
  return empty;
}

// ---------------------------------------------------------------- 演示音

function playDemo(notesText, label) {
  const notes = String(notesText || '').split(',').map(Number).filter(Number.isInteger);
  if (!notes.length) return;
  demoTimers.forEach(timer => window.clearTimeout(timer));
  demoTimers = [];
  showToast(`示范：${label || notes.map(note => noteName(note, { naming: progress.settings.naming })).join(' · ')}`);
  // 音多时压缩间隔，避免完整示范拖得太长（如 42 音的《小星星》）。
  const spacing = notes.length > 24 ? 300 : notes.length > 16 ? 380 : 520;
  const duration = spacing - 60;
  notes.forEach((note, index) => {
    const timer = window.setTimeout(async () => {
      await audio.noteOn(note, 96, { source: 'demo' });
      const stopTimer = window.setTimeout(() => audio.noteOff(note, { source: 'demo' }), duration);
      demoTimers.push(stopTimer);
    }, index * spacing);
    demoTimers.push(timer);
  });
}

// ---------------------------------------------------------------- Service Worker

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (!(location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) return;
  navigator.serviceWorker.register('./sw.js').then(registration => {
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && navigator.serviceWorker.controller) {
          showUpdateBanner(worker);
        }
      });
    });
    if (registration.waiting && navigator.serviceWorker.controller) showUpdateBanner(registration.waiting);
  }).catch(error => console.info('离线缓存不可用', error));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // 新版本接管后刷新一次，确保加载的模块与缓存一致。
    if (window.__keylabReloading) window.location.reload();
  });
}

function showUpdateBanner(worker) {
  const banner = $('#update-banner');
  if (!banner) return;
  waitingWorker = worker;
  banner.hidden = false;
  const reloadButton = banner.querySelector('[data-action="reload-app"]');
  if (reloadButton) {
    reloadButton.onclick = event => {
      event.stopPropagation();
      window.__keylabReloading = true;
      waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
      window.setTimeout(() => window.location.reload(), 600);
    };
  }
}

// ---------------------------------------------------------------- 初始化

function bindEvents() {
  document.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton && !viewButton.dataset.action) {
      const moduleId = viewButton.dataset.module || null;
      if (moduleId) {
        state.activeModule = state.activeModule === moduleId ? null : moduleId;
        if (state.currentView !== 'courses') navigate('courses');
        else render();
        return;
      }
      navigate(viewButton.dataset.view);
      return;
    }
    const actionButton = event.target.closest('[data-action]');
    if (actionButton) {
      const action = actionButton.dataset.action;
      if (action === 'close-modal' && event.target !== actionButton) return;
      void handleAction(actionButton);
    }
  });

  document.addEventListener('change', event => {
    const target = event.target;
    if (target.id === 'midi-input-select') {
      midi.selectInput(target.value, { reason: 'user' });
      if (state.currentView === 'midi') render();
    } else if (target.id === 'import-file' && target.files?.[0]) {
      void handleImportFile(target.files[0]);
    } else if (target.id === 'naming-select') {
      setNaming(target.value);
      showToast(`已切换为${target.value === 'yamaha' ? ' YAMAHA ' : '标准'}八度命名。MIDI 编号不变。`);
    } else if (target.id === 'volume-range') {
      const value = Number(target.value) / 100;
      progress.settings.volume = value;
      audio.setVolume(value);
      saveProgressDebounced();
    } else if (target.id === 'monitor-sound-setting') {
      progress.settings.monitorHardwareSound = target.checked;
      saveProgressDebounced();
    } else if (target.id === 'midi-monitor-sound') {
      progress.settings.monitorHardwareSound = target.checked;
      saveProgressDebounced();
    } else if (target.id === 'midi-naming-toggle') {
      setNaming(target.checked ? 'yamaha' : 'standard');
    }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'lab-bpm') {
      const bpm = Number(event.target.value);
      progress.settings.metronomeBpm = bpm;
      metronome.setBpm(bpm);
      const readout = $('#lab-bpm-value');
      if (readout) readout.textContent = String(bpm);
      saveProgressDebounced();
    }
  });

  window.addEventListener('pagehide', persistNow);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      persistNow();
      keyboard.releaseAll('hidden');
      audio.allNotesOff();
      if (state.labMetronome.running) {
        metronome.stop();
        state.labMetronome.running = false;
      }
    }
  });
  window.addEventListener('blur', () => {
    keyboard.releaseAll('blur');
  });
}

function init() {
  initModalBindings();
  bindEvents();
  keyboard.bind(document);
  markActiveDay(progress);
  persistNow();
  registerServiceWorker();

  const route = parseHash();
  if (route.view === 'lesson') {
    state.currentView = 'lesson';
    state.lessonId = route.lessonId;
    const lesson = findLesson(route.lessonId);
    state.lessonEngine = createLessonEngine({
      lesson,
      onStatusChange: status => {
        state.lessonStatus = status;
        updateLessonUI();
        if (status.complete) markLessonCompleted(lesson.id);
      }
    });
    state.lessonStatus = state.lessonEngine.status;
  } else {
    state.currentView = route.view;
  }

  if (nativeBridge.constructor.isAvailable()) {
    nativeBridge.install();
  }

  // 预加载真实钢琴采样（后台进行，失败会回退到振荡器合成音）。
  void audio.loadSamples();

  render();
  // 首次渲染后再同步一次输入状态（例如已经注入的原生桥接）。
  updateDeviceStatus();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
