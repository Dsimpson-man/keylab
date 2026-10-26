/**
 * 课程引擎。
 *
 * 负责一节课的按键练习状态：消费标准化音符事件，输出进度与中文反馈。
 * 节奏任务由 RhythmSession 驱动，通过 completeExternally() 回写结果。
 * 不引用 DOM，课程内容来自 src/data/lessons.js。
 */

import { createTaskMatcher, MATCH_STATUS } from './task-matcher.js';
import { EVENT_TYPES } from '../midi/midi-normalizer.js';

export function createLessonEngine({ lesson, onStatusChange = () => {} } = {}) {
  if (!lesson) throw new Error('缺少课程数据');
  if (lesson.task.mode === 'rhythm') {
    return createRhythmLessonEngine({ lesson, onStatusChange });
  }
  const matcher = createTaskMatcher(lesson.task);
  let status = {
    index: 0,
    total: lesson.task.target.length,
    complete: false,
    feedback: '准备好后，按提示弹奏第一个音。',
    wrongAttempts: 0
  };

  function emit(next) {
    status = { ...status, ...next };
    onStatusChange(status);
    return status;
  }

  function completeExternally(feedback) {
    matcher.reset(feedback);
    return emit({ index: lesson.task.target.length, complete: true, feedback, external: true });
  }

  return {
    lesson,
    get enablesKeyboard() {
      return true;
    },
    get status() {
      return status;
    },
    get complete() {
      return status.complete;
    },
    handleEvent(event) {
      if (!event || !Number.isInteger(event.note)) return status;
      if (event.type !== EVENT_TYPES.NOTE_ON && event.type !== EVENT_TYPES.NOTE_OFF) return status;
      if (status.complete) return status;
      const result = matcher.accept(event);
      return emit({
        index: result.index,
        total: result.total,
        complete: result.complete,
        feedback: result.feedback,
        wrongAttempts: matcher.status().wrongAttempts
      });
    },
    reset() {
      matcher.reset();
      return emit({ index: 0, total: lesson.task.target.length, complete: false, feedback: '准备好后，按提示弹奏第一个音。', wrongAttempts: 0, external: false });
    },
    completeExternally
  };
}

/** 节奏课程的引擎：只负责完成状态与反馈，时间分析在 RhythmSession 中。 */
function createRhythmLessonEngine({ lesson, onStatusChange }) {
  let status = {
    index: 0,
    total: lesson.task.target.length,
    complete: false,
    feedback: '点击「开始节拍器」，听预备拍后开始演奏。',
    wrongAttempts: 0
  };
  function emit(next) {
    status = { ...status, ...next };
    onStatusChange(status);
    return status;
  }
  return {
    lesson,
    get enablesKeyboard() {
      return true;
    },
    get status() {
      return status;
    },
    get complete() {
      return status.complete;
    },
    handleEvent() {
      // 节奏任务由 RhythmSession 直接处理，不使用逐音匹配器。
      return status;
    },
    reset() {
      return emit({ index: 0, complete: false, feedback: '点击「开始节拍器」，听预备拍后开始演奏。', wrongAttempts: 0 });
    },
    progress(index, feedback) {
      return emit({ index, complete: false, feedback });
    },
    completeExternally(feedback) {
      return emit({ index: lesson.task.target.length, complete: true, feedback });
    }
  };
}

export { MATCH_STATUS };
