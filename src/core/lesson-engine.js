/**
 * 课程引擎。
 *
 * 负责一节课的按键练习状态：消费标准化音符事件，输出进度与中文反馈。
 * 节奏任务由 RhythmSession 驱动，通过 completeExternally() 回写结果。
 * 不引用 DOM，课程内容来自 src/data/lessons.js。
 */

import { createTaskMatcher, MATCH_STATUS } from './task-matcher.js';
import { EVENT_TYPES } from '../midi/midi-normalizer.js';
import { analyzePractice } from './practice-report.js';
import { melodyNotesWithBeats, buildNoteGrid, analyzePieceRhythm } from './piece-rhythm.js';
import { weakestMeasures } from './piece-weakness.js';

export function createLessonEngine({ lesson, onStatusChange = () => {}, forgiving = false } = {}) {
  if (!lesson) throw new Error('缺少课程数据');
  if (lesson.task.mode === 'rhythm') {
    return createRhythmLessonEngine({ lesson, onStatusChange });
  }
  const matcher = createTaskMatcher(lesson.task, { forgiving });
  // 记录正确按键（note / velocity / timestamp），用于完成时生成练习报告。
  let correctRecords = [];
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

  function recordCorrect(event) {
    correctRecords.push({
      note: event.note,
      velocity: event.velocity ?? 100,
      timestamp: event.timestamp ?? performance.now()
    });
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
    get practiceReport() {
      return analyzePractice(correctRecords, { tempoBpm: lesson.task.tempo ?? null });
    },
    get pieceRhythmReport() {
      // 曲目节奏：用 measures 时值 + 真实按键时间戳，计算每个音的节奏偏差。
      if (!lesson.measures || !correctRecords.length) return null;
      const melody = melodyNotesWithBeats(lesson.measures);
      if (!melody.length) return null;
      const bpm = lesson.task.tempo || 80;
      const grid = buildNoteGrid(melody, bpm);
      // 对齐到第一个正确按键的时间（忽略用户起手的延迟）。
      const firstRecord = correctRecords[0];
      const offsetMs = firstRecord.timestamp - grid[0].startMs;
      return analyzePieceRhythm(correctRecords, grid, { toleranceMs: 300, offsetMs });
    },
    get weakMeasures() {
      // 逐小节薄弱定位：找出命中率最低、误差最大的小节，供结束报告循环重练。
      if (!lesson.measures || !correctRecords.length) return [];
      const rhythm = this.pieceRhythmReport;
      if (!rhythm || !rhythm.entries) return [];
      const totalNotes = melodyNotesWithBeats(lesson.measures).length;
      const hits = rhythm.entries.filter(e => e.onTime).map((e, i) => ({ index: i, errorMs: e.errorMs }));
      return weakestMeasures(lesson.measures, hits, totalNotes, 3);
    },
    handleEvent(event) {
      if (!event || !Number.isInteger(event.note)) return status;
      if (event.type !== EVENT_TYPES.NOTE_ON && event.type !== EVENT_TYPES.NOTE_OFF) return status;
      if (status.complete) return status;
      const prevIndex = matcher.status().index;
      const result = matcher.accept(event);
      // 只有「推进了进度」的正确 Note On 才记为正确按键（弹错不计）。
      if (event.type === EVENT_TYPES.NOTE_ON && result.index > prevIndex && !result.complete) {
        recordCorrect(event);
      }
      const next = {
        index: result.index,
        total: result.total,
        complete: result.complete,
        feedback: result.feedback,
        wrongAttempts: matcher.status().wrongAttempts
      };
      if (result.complete) {
        // 完成时补记最后一个正确音（上面的条件排除了 complete 分支）。
        if (event.type === EVENT_TYPES.NOTE_ON && result.index === result.total) recordCorrect(event);
        next.practiceReport = this.practiceReport;
        next.pieceRhythmReport = this.pieceRhythmReport;
        next.weakMeasures = this.weakMeasures;
      }
      return emit(next);
    },
    reset() {
      matcher.reset();
      correctRecords = [];
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
