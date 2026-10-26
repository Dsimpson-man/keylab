/**
 * 测验引擎。
 *
 * 四选一与「在键盘上弹出」共用同一会话结构；play 题直接消费标准化音符事件。
 */

import { createTaskMatcher, MATCH_STATUS } from './task-matcher.js';
import { EVENT_TYPES } from '../midi/midi-normalizer.js';

export function shuffle(array, random = Math.random) {
  const copy = array.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function createQuizSession({ pool, category = 'all', size = null, random = Math.random } = {}) {
  if (!Array.isArray(pool) || pool.length === 0) throw new Error('题库为空');
  const count = size == null ? pool.length : Math.min(size, pool.length);
  const questions = shuffle(pool, random).slice(0, count);
  return {
    category,
    questions,
    index: 0,
    score: 0,
    answered: false,
    selected: null,
    done: false,
    attempts: 0,
    wrongIds: []
  };
}

export function currentQuestion(session) {
  return session?.questions?.[session.index] || null;
}

/** 提交四选一答案，返回结果（含解释与实际选择）。 */
export function answerChoice(session, selectedIndex) {
  const question = currentQuestion(session);
  if (!question || question.type !== 'choice' || session.answered) return null;
  const correct = selectedIndex === question.answer;
  session.answered = true;
  session.selected = selectedIndex;
  session.attempts += 1;
  if (correct) session.score += 1;
  else session.wrongIds.push(question.id);
  return {
    correct,
    selectedIndex,
    answerIndex: question.answer,
    explanation: question.explanation,
    feedback: correct
      ? `回答正确！${question.explanation}`
      : `你选择了「${question.options[selectedIndex]}」，正确答案是「${question.options[question.answer]}」。${question.explanation}`
  };
}

/** 为 play 题建立匹配器。每次进入题目时调用。 */
export function createPlayMatcher(question) {
  return createTaskMatcher({ mode: question.mode || 'sequence', target: question.target, needsRelease: false });
}

/**
 * 处理 play 题的标准化音符事件。
 * 返回 { matched, complete, feedback, status }，complete 为 true 时题目通过。
 */
export function answerPlay(session, event, matcher) {
  const question = currentQuestion(session);
  if (!question || question.type !== 'play' || session.answered || !matcher) return null;
  if (event.type !== EVENT_TYPES.NOTE_ON && event.type !== EVENT_TYPES.NOTE_OFF) return null;
  const status = matcher.accept(event);
  if (status.status === MATCH_STATUS.COMPLETE) {
    session.answered = true;
    session.attempts += 1;
    session.score += 1;
    return {
      matched: true,
      complete: true,
      status,
      feedback: `弹奏正确！${question.explanation}`
    };
  }
  return { matched: false, complete: false, status, feedback: status.feedback };
}

export function nextQuestion(session) {
  if (!session) return null;
  if (session.index >= session.questions.length - 1) {
    session.done = true;
    return session;
  }
  session.index += 1;
  session.answered = false;
  session.selected = null;
  return session;
}

export function sessionSummary(session) {
  const total = session.questions.length;
  const percent = total ? Math.round((session.score / total) * 100) : 0;
  return {
    total,
    score: session.score,
    percent,
    passed: percent >= 75,
    wrongIds: session.wrongIds.slice(),
    attempts: session.attempts
  };
}
