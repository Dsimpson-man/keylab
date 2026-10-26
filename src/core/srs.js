/**
 * SRS 间隔重复调度器（纯逻辑，可单测）。
 *
 * 用于「符号记忆」类内容的复习排程（练耳、识谱、音符卡）。
 * 采用简化的 SM-2 式算法：答对间隔翻倍、答错回退到最短间隔。
 *
 * 注意：钢琴的「运动技能」（曲目、指法）不用间隔重复，用「短时高频」；
 * 这里只服务「符号记忆」（哪个音程、哪个音符）。
 */

// 间隔阶梯（天）：首次复习 0 天（当天再复习一次），然后 1、2、4、7、15、30 天。
export const INTERVAL_DAYS = Object.freeze([0, 1, 2, 4, 7, 15, 30]);

/**
 * 计算下一次复习时间。
 * @param {object} card 当前卡片状态 { level, dueAt }
 * @param {boolean} correct 是否答对
 * @param {Date} now 当前时间
 * @returns {object} 更新后的卡片 { level, dueAt }
 */
export function scheduleReview(card, correct, now = new Date()) {
  const level = Math.max(0, Math.min(INTERVAL_DAYS.length - 1, card?.level ?? 0));
  const nextLevel = correct ? Math.min(INTERVAL_DAYS.length - 1, level + 1) : 0;
  const days = INTERVAL_DAYS[nextLevel];
  const due = new Date(now.getTime());
  due.setHours(0, 0, 0, 0);
  due.setDate(due.getDate() + days);
  return { level: nextLevel, dueAt: due.toISOString() };
}

/** 卡片是否到期需要复习。 */
export function isDue(card, now = new Date()) {
  if (!card?.dueAt) return true;
  return new Date(card.dueAt).getTime() <= now.getTime();
}

/** 从一组卡片里选出到期需要复习的。 */
export function dueCards(cards, now = new Date()) {
  return (cards || []).filter(card => isDue(card, now));
}

/** 生成一张新卡片的初始状态。 */
export function newCard(id) {
  return { id, level: 0, dueAt: null, correct: 0, wrong: 0 };
}

/** 记录一次作答并返回更新后的卡片。 */
export function reviewCard(card, correct, now = new Date()) {
  const base = card || newCard();
  const updated = scheduleReview(base, correct, now);
  return {
    ...base,
    ...updated,
    correct: (base.correct || 0) + (correct ? 1 : 0),
    wrong: (base.wrong || 0) + (correct ? 0 : 1)
  };
}
