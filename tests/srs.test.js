import test from 'node:test';
import assert from 'node:assert/strict';
import {
  scheduleReview,
  isDue,
  dueCards,
  newCard,
  reviewCard,
  INTERVAL_DAYS
} from '../src/core/srs.js';

const DAY = 24 * 60 * 60 * 1000;
const fixedNow = new Date('2026-10-27T12:00:00Z');

/** 计算两个 ISO 时间戳之间相差的天数（忽略时区，按本地日期 0 点差）。 */
function daysBetween(aIso, bIso) {
  const a = new Date(aIso);
  const b = new Date(bIso);
  const aDay = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bDay = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bDay - aDay) / 86400000);
}

test('间隔阶梯', () => {
  assert.deepEqual(INTERVAL_DAYS, [0, 1, 2, 4, 7, 15, 30]);
});

test('答对间隔递增', () => {
  const c1 = scheduleReview({ level: 0, dueAt: null }, true, fixedNow);
  assert.equal(c1.level, 1);
  assert.equal(daysBetween(fixedNow.toISOString(), c1.dueAt), 1, 'level1 = 1 天后');

  const c2 = scheduleReview(c1, true, fixedNow);
  assert.equal(c2.level, 2);
  assert.equal(daysBetween(fixedNow.toISOString(), c2.dueAt), 2, 'level2 = 2 天后');
});

test('答错回退到最短间隔', () => {
  const c = scheduleReview({ level: 3, dueAt: null }, false, fixedNow);
  assert.equal(c.level, 0);
  assert.equal(daysBetween(fixedNow.toISOString(), c.dueAt), 0, 'level0 = 当天再复习');
});

test('isDue 判断到期', () => {
  const due = isDue({ dueAt: new Date(fixedNow.getTime() - DAY).toISOString() }, fixedNow);
  assert.equal(due, true);
  const notDue = isDue({ dueAt: new Date(fixedNow.getTime() + DAY).toISOString() }, fixedNow);
  assert.equal(notDue, false);
  const noDueAt = isDue({ dueAt: null }, fixedNow);
  assert.equal(noDueAt, true);
});

test('dueCards 筛出到期卡片', () => {
  const cards = [
    { id: 'a', dueAt: new Date(fixedNow.getTime() - DAY).toISOString() },
    { id: 'b', dueAt: new Date(fixedNow.getTime() + DAY).toISOString() },
    { id: 'c', dueAt: null }
  ];
  const due = dueCards(cards, fixedNow);
  assert.deepEqual(due.map(c => c.id), ['a', 'c']);
});

test('reviewCard 记录正确/错误次数并更新排程', () => {
  const card = newCard('interval-3');
  assert.equal(card.level, 0);
  assert.equal(card.correct, 0);

  const afterCorrect = reviewCard(card, true, fixedNow);
  assert.equal(afterCorrect.correct, 1);
  assert.equal(afterCorrect.level, 1);

  const afterWrong = reviewCard(afterCorrect, false, fixedNow);
  assert.equal(afterWrong.wrong, 1);
  assert.equal(afterWrong.level, 0);
});
