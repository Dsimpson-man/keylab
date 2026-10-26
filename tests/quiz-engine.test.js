import test from 'node:test';
import assert from 'node:assert/strict';
import { createQuizSession, currentQuestion, answerChoice, createPlayMatcher, answerPlay, nextQuestion, sessionSummary, shuffle } from '../src/core/quiz-engine.js';
import { QUESTIONS, QUIZ_CATEGORIES, questionsForCategory, findQuestion } from '../src/data/quizzes.js';
import { makeNoteEvent } from '../src/midi/midi-normalizer.js';

const on = note => makeNoteEvent({ on: true, note, velocity: 90, source: 'virtual' });

test('题库结构完整、答案与解释一致', () => {
  assert.ok(QUESTIONS.length >= 30);
  const ids = new Set();
  for (const question of QUESTIONS) {
    assert.ok(!ids.has(question.id), `重复 id: ${question.id}`);
    ids.add(question.id);
    assert.ok(QUIZ_CATEGORIES.some(category => category.id === question.category), `未知分类: ${question.category}`);
    assert.ok(question.prompt.length > 0);
    assert.ok(question.explanation.length > 0);
    if (question.type === 'choice') {
      assert.equal(question.options.length, 4);
      assert.ok(Number.isInteger(question.answer) && question.answer >= 0 && question.answer < 4);
    } else {
      assert.equal(question.type, 'play');
      assert.ok(Array.isArray(question.target) && question.target.length > 0);
      assert.ok(['sequence', 'together', 'staff'].includes(question.mode || 'sequence'));
    }
  }
});

test('每个分类至少 6 道题，混合练习包含弹奏题', () => {
  for (const category of QUIZ_CATEGORIES) {
    assert.ok(questionsForCategory(category.id).length >= 6, `${category.id} 题量不足`);
  }
  assert.ok(questionsForCategory('all').some(question => question.type === 'play'));
  assert.equal(questionsForCategory('all').length, QUESTIONS.length);
});

test('固定随机函数可复现洗牌与抽题', () => {
  const pool = QUESTIONS.slice(0, 6);
  const a = shuffle(pool, () => 0.42);
  const b = shuffle(pool, () => 0.42);
  assert.deepEqual(a.map(q => q.id), b.map(q => q.id));
  const session = createQuizSession({ pool, category: 'all', size: 4, random: () => 0.3 });
  assert.equal(session.questions.length, 4);
});

test('混合练习最多 8 题，单类练习使用全部题目', () => {
  const all = createQuizSession({ pool: questionsForCategory('all'), size: 8 });
  assert.equal(all.questions.length, 8);
  const notes = createQuizSession({ pool: questionsForCategory('notes') });
  assert.equal(notes.questions.length, questionsForCategory('notes').length);
});

test('四选一答题记录正确与错误', () => {
  const question = findQuestion('notes-middle-c');
  const session = createQuizSession({ pool: [question] });
  const result = answerChoice(session, 1);
  assert.equal(result.correct, true);
  assert.equal(session.score, 1);
  assert.equal(session.answered, true);

  const wrongSession = createQuizSession({ pool: [question] });
  const wrong = answerChoice(wrongSession, 0);
  assert.equal(wrong.correct, false);
  assert.match(wrong.feedback, /正确答案/);
  assert.deepEqual(wrongSession.wrongIds, ['notes-middle-c']);
  assert.equal(wrongSession.answered, true);
});

test('已答题目不能重复作答', () => {
  const question = findQuestion('notes-middle-c');
  const session = createQuizSession({ pool: [question] });
  answerChoice(session, 1);
  assert.equal(answerChoice(session, 0), null);
  assert.equal(session.score, 1);
});

test('弹奏题：正确顺序通过并计分', () => {
  const question = findQuestion('play-notes-c');
  const session = createQuizSession({ pool: [question] });
  const matcher = createPlayMatcher(question);
  const result = answerPlay(session, on(60), matcher);
  assert.equal(result.complete, true);
  assert.equal(session.answered, true);
  assert.equal(session.score, 1);
  assert.match(result.feedback, /正确/);
});

test('弹奏题：错误音符不通过，但给出反馈', () => {
  const question = findQuestion('play-notes-def');
  const session = createQuizSession({ pool: [question] });
  const matcher = createPlayMatcher(question);
  const result = answerPlay(session, on(65), matcher);
  assert.equal(result.complete, false);
  assert.equal(session.answered, false);
  assert.ok(result.feedback.length > 0);
});

test('弹奏题：同时按住的和弦题', () => {
  const question = findQuestion('play-chords-c-major');
  const session = createQuizSession({ pool: [question] });
  const matcher = createPlayMatcher(question);
  answerPlay(session, on(60), matcher);
  answerPlay(session, on(64), matcher);
  const result = answerPlay(session, on(67), matcher);
  assert.equal(result.complete, true);
});

test('下一题与结束状态', () => {
  const session = createQuizSession({ pool: QUESTIONS.slice(0, 2) });
  assert.equal(currentQuestion(session).id, session.questions[0].id);
  nextQuestion(session);
  assert.equal(session.index, 1);
  assert.equal(session.answered, false);
  nextQuestion(session);
  assert.equal(session.done, true);
});

test('结果摘要计算百分比与通过线', () => {
  const session = createQuizSession({ pool: QUESTIONS.slice(0, 4) });
  session.score = 3;
  session.wrongIds = ['x'];
  const summary = sessionSummary(session);
  assert.equal(summary.percent, 75);
  assert.equal(summary.passed, true);
  session.score = 2;
  assert.equal(sessionSummary(session).passed, false);
});

test('空题库抛出异常', () => {
  assert.throws(() => createQuizSession({ pool: [] }), /题库为空/);
});
