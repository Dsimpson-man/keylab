/**
 * 练耳引擎（纯逻辑，可单测）。
 *
 * 生成听辨题目：音程、和弦、旋律。题目只描述「听什么、选什么」，
 * 具体发声由 audio 层播放，判分在这里完成。
 */

import { shuffle } from './quiz-engine.js';
import { NOTE_NAMES_SHARP, pitchClass, intervalName } from './music-theory.js';

// 音程题目：从根音出发的常见音程（半音数）。
const INTERVAL_OPTIONS = [
  { semitones: 1, label: '小二度' },
  { semitones: 2, label: '大二度' },
  { semitones: 3, label: '小三度' },
  { semitones: 4, label: '大三度' },
  { semitones: 5, label: '纯四度' },
  { semitones: 7, label: '纯五度' },
  { semitones: 8, label: '小六度' },
  { semitones: 9, label: '大六度' },
  { semitones: 12, label: '纯八度' }
];

// 和弦题目：常见三和弦音程结构。
const CHORD_OPTIONS = [
  { name: '大三和弦', steps: [0, 4, 7], label: '明亮' },
  { name: '小三和弦', steps: [0, 3, 7], label: '忧伤' },
  { name: '增三和弦', steps: [0, 4, 8], label: '紧张' },
  { name: '减三和弦', steps: [0, 3, 6], label: '不安' }
];

const SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11, 12];

/**
 * 生成一道音程听辨题。
 * @param {number} rootNote 根音 MIDI 编号（默认 60）。
 * @param {function} random 随机函数（默认 Math.random）。
 */
export function makeIntervalEarQuestion(rootNote = 60, random = Math.random) {
  const picked = INTERVAL_OPTIONS[Math.floor(random() * INTERVAL_OPTIONS.length)];
  // 候选答案：正确答案 + 3 个干扰项。
  const others = INTERVAL_OPTIONS.filter(opt => opt.semitones !== picked.semitones);
  const distractors = shuffle(others, random).slice(0, 3).map(opt => opt.label);
  const options = shuffle([picked.label, ...distractors], random);
  return {
    type: 'interval',
    rootNote,
    targetNote: rootNote + picked.semitones,
    answer: options.indexOf(picked.label),
    options,
    explanation: `从根音向上 ${picked.semitones} 个半音是${picked.label}。`
  };
}

/** 生成一道和弦听辨题。 */
export function makeChordEarQuestion(rootNote = 60, random = Math.random) {
  const picked = CHORD_OPTIONS[Math.floor(random() * CHORD_OPTIONS.length)];
  const others = CHORD_OPTIONS.filter(opt => opt.name !== picked.name);
  const distractors = shuffle(others, random).slice(0, 3).map(opt => opt.name);
  const options = shuffle([picked.name, ...distractors], random);
  return {
    type: 'chord',
    rootNote,
    notes: picked.steps.map(step => rootNote + step),
    answer: options.indexOf(picked.name),
    options,
    explanation: `${picked.name}（${picked.label}）由根音向上 ${picked.steps[1]}、${picked.steps[2]} 个半音的三个音组成。`
  };
}

/** 生成一道旋律听辨题（从根音开始弹一个音阶片段，问是「上行」还是「下行」）。 */
export function makeMelodyEarQuestion(rootNote = 60, random = Math.random) {
  const direction = random() < 0.5 ? 'up' : 'down';
  // 取 3–5 个音的音阶片段。
  const length = 3 + Math.floor(random() * 3);
  const notes = [];
  if (direction === 'up') {
    for (let i = 0; i < length; i += 1) notes.push(rootNote + SCALE_STEPS[i % SCALE_STEPS.length]);
  } else {
    for (let i = length - 1; i >= 0; i -= 1) notes.push(rootNote + SCALE_STEPS[i % SCALE_STEPS.length]);
  }
  return {
    type: 'melody',
    rootNote,
    notes,
    answer: direction === 'up' ? 0 : 1,
    options: ['上行', '下行'],
    explanation: direction === 'up' ? '旋律音高逐渐升高，是上行。' : '旋律音高逐渐降低，是下行。'
  };
}

/** 判分：options[selectedIndex] 是否等于正确答案。 */
export function judgeEar(question, selectedIndex) {
  if (!question || !Array.isArray(question.options)) return null;
  const correct = selectedIndex === question.answer;
  return {
    correct,
    selectedIndex,
    answerIndex: question.answer,
    explanation: question.explanation,
    feedback: correct
      ? `回答正确！${question.explanation}`
      : `答案是「${question.options[question.answer]}」。${question.explanation}`
  };
}

/** 由题目类型返回一个用于播放的音符序列。 */
export function earQuestionNotes(question) {
  if (!question) return [];
  if (question.type === 'interval') return [question.rootNote, question.targetNote];
  if (question.type === 'chord') return question.notes;
  if (question.type === 'melody') return question.notes;
  return [];
}
