/**
 * 任务匹配器：课程和测验共用的按键判定。
 *
 * 输入永远是 MIDI 标准化事件，不关心来源是虚拟键盘、Web MIDI 还是未来原生桥接。
 * 输出包含状态与中文反馈，避免上层重复实现判分逻辑。
 *
 * mode:
 * - sequence：按顺序弹出 target。
 * - staff：与 sequence 相同，但界面显示谱面。
 * - together：同时按住 target 中的全部音（不允许额外音）。
 */

import { noteName, describePitchError, describeRelation } from './music-theory.js';
import { EVENT_TYPES } from '../midi/midi-normalizer.js';

const STATUS = Object.freeze({
  IGNORED: 'ignored',
  PROGRESS: 'progress',
  RESTART: 'restart',
  WRONG: 'wrong',
  COMPLETE: 'complete'
});

export function createTaskMatcher(task, { naming = 'standard' } = {}) {
  const target = Array.isArray(task?.target) ? task.target.slice() : [];
  const mode = task?.mode || 'sequence';
  if (!target.length) throw new Error('任务必须包含至少一个目标音');
  if (mode === 'together' && new Set(target).size !== target.length) {
    throw new Error('together 任务的目标音不能重复');
  }

  let index = 0;
  let complete = false;
  let waitingForRelease = null;
  let held = new Set();
  let feedback = '准备好后，按提示弹奏第一个音。';
  let lastEvent = null;
  let wrongAttempts = 0;

  function names(list) {
    return list.map(note => noteName(note, { naming })).join('、');
  }

  function resetInternal(message) {
    index = 0;
    waitingForRelease = null;
    complete = false;
    held = new Set();
    feedback = message;
  }

  function onNoteOn(event) {
    const note = event.note;
    if (mode === 'together') {
      held.add(note);
      const missing = target.filter(item => !held.has(item));
      const extras = Array.from(held).filter(item => !target.includes(item));
      if (extras.length) {
        const extraNote = extras[0];
        feedback = `多按了 ${noteName(extraNote, { naming })}。目标是 ${names(target)}，请只按这三个音。`;
        wrongAttempts += 1;
        return { status: STATUS.WRONG, feedback, index: 0, total: target.length, complete: false, extra: extras, missing };
      }
      if (missing.length === 0 && held.size === target.length) {
        complete = true;
        index = target.length;
        feedback = `完成！${names(target)} 同时响起，构成了目标和弦。`;
        return { status: STATUS.COMPLETE, feedback, index, total: target.length, complete: true, held: Array.from(held) };
      }
      const nextMissing = missing[0];
      feedback = `已按住 ${names(Array.from(held))}，还需要 ${noteName(nextMissing, { naming })}。`;
      return { status: STATUS.PROGRESS, feedback, index: target.length - missing.length, total: target.length, complete: false, missing };
    }

    // sequence / staff
    if (complete) return { status: STATUS.IGNORED, feedback, index, total: target.length, complete };
    if (waitingForRelease != null) {
      feedback = `收到 ${noteName(note, { naming })}。请先松开 ${noteName(waitingForRelease, { naming })}，再继续。`;
      return { status: STATUS.IGNORED, feedback, index, total: target.length, complete };
    }
    const expected = target[index];
    if (note === expected) {
      index += 1;
      if (task.needsRelease && index >= target.length) {
        waitingForRelease = note;
        feedback = `收到 ${noteName(note, { naming })} 的 Note On。现在松开琴键，观察 Note Off。`;
        return { status: STATUS.PROGRESS, feedback, index, total: target.length, complete: false, waitingForRelease: true };
      }
      if (index >= target.length) {
        complete = true;
        feedback = `完成！${names(target)} 的顺序正确。`;
        return { status: STATUS.COMPLETE, feedback, index, total: target.length, complete: true };
      }
      const next = target[index];
      feedback = `正确：${noteName(note, { naming })}。继续弹 ${noteName(next, { naming })}。`;
      return { status: STATUS.PROGRESS, feedback, index, total: target.length, complete: false };
    }

    wrongAttempts += 1;
    const relation = describeRelation(expected, note, { naming });
    const errorText = describePitchError(note, expected, { naming });
    if (note === target[0] && index > 0) {
      index = 1;
      feedback = `${errorText} 已从 ${noteName(target[0], { naming })} 重新开始，继续弹 ${noteName(target[1], { naming })}。`;
      return { status: STATUS.RESTART, feedback, index, total: target.length, complete: false, relation };
    }
    index = 0;
    feedback = `${errorText} 目标第一个音是 ${noteName(target[0], { naming })}。${relation.distance !== 0 ? relation.text : ''}`;
    return { status: STATUS.WRONG, feedback, index, total: target.length, complete: false, relation };
  }

  function onNoteOff(event) {
    const note = event.note;
    if (mode === 'together') {
      held.delete(note);
      if (!complete) {
        feedback = `松开了 ${noteName(note, { naming })}。需要同时按住 ${names(target)}。`;
      }
      return { status: STATUS.IGNORED, feedback, index, total: target.length, complete };
    }
    if (waitingForRelease != null && note === waitingForRelease) {
      waitingForRelease = null;
      complete = true;
      feedback = '完成！你观察到按下（Note On）和松开（Note Off）是两个独立事件。';
      return { status: STATUS.COMPLETE, feedback, index: target.length, total: target.length, complete: true };
    }
    return { status: STATUS.IGNORED, feedback, index, total: target.length, complete };
  }

  function accept(event) {
    if (!event || !Number.isInteger(event.note)) return { status: STATUS.IGNORED, feedback, index, total: target.length, complete };
    lastEvent = event;
    if (event.type === EVENT_TYPES.NOTE_ON) return onNoteOn(event);
    if (event.type === EVENT_TYPES.NOTE_OFF) return onNoteOff(event);
    return { status: STATUS.IGNORED, feedback, index, total: target.length, complete };
  }

  return {
    task,
    mode,
    target,
    accept,
    reset(message = '准备好后，按提示弹奏第一个音。') {
      resetInternal(message);
      wrongAttempts = 0;
      return this.status();
    },
    status() {
      return {
        index,
        total: target.length,
        complete,
        feedback,
        wrongAttempts,
        waitingForRelease: waitingForRelease != null,
        held: Array.from(held),
        lastEvent
      };
    },
    get progressRatio() {
      return target.length ? Math.min(index / target.length, 1) : 0;
    }
  };
}

export { STATUS as MATCH_STATUS };
