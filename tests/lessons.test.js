import test from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, LESSON_MODULES, LESSON_COUNT, findLesson, lessonsByModule, nextLessonAfter, lessonIndex } from '../src/data/lessons.js';
import { isValidMidiNote, noteNumberFromName, isBlackKey, noteName } from '../src/core/music-theory.js';

test('课程数量与编号连续', () => {
  assert.equal(LESSONS.length, LESSON_COUNT);
  assert.ok(LESSONS.length >= 14);
  LESSONS.forEach((lesson, index) => {
    assert.equal(lesson.number, String(index + 1).padStart(2, '0'), `第 ${index + 1} 课编号不连续`);
  });
});

test('每节课程必备字段完整', () => {
  const required = ['id', 'number', 'module', 'title', 'category', 'duration', 'summary', 'lead', 'goals', 'prerequisites', 'sections', 'examples', 'tip', 'task', 'passCriteria', 'completion', 'reviewTip'];
  for (const lesson of LESSONS) {
    for (const field of required) {
      assert.ok(lesson[field] !== undefined, `${lesson.id} 缺少 ${field}`);
    }
    assert.ok(Array.isArray(lesson.goals) && lesson.goals.length > 0, `${lesson.id} 缺少学习目标`);
    assert.ok(Array.isArray(lesson.prerequisites) && lesson.prerequisites.length > 0, `${lesson.id} 缺少先修知识`);
    assert.ok(Array.isArray(lesson.sections) && lesson.sections.length > 0, `${lesson.id} 缺少讲解`);
    assert.ok(lesson.passCriteria.length > 0);
    assert.ok(lesson.task.prompt.length > 0);
    assert.ok(Array.isArray(lesson.task.target) && lesson.task.target.length > 0, `${lesson.id} 目标为空`);
  }
});

test('课程 ID 唯一，模块存在', () => {
  const ids = new Set();
  for (const lesson of LESSONS) {
    assert.ok(!ids.has(lesson.id), `重复课程 id: ${lesson.id}`);
    ids.add(lesson.id);
    assert.ok(LESSON_MODULES.some(module => module.id === lesson.module), `${lesson.id} 模块无效`);
  }
});

test('所有目标音都是合法 MIDI 编号，且在 37 键范围附近', () => {
  for (const lesson of LESSONS) {
    for (const note of lesson.task.target) {
      assert.ok(isValidMidiNote(note), `${lesson.id} 包含非法音符 ${note}`);
      assert.ok(note >= 24 && note <= 108, `${lesson.id} 目标音 ${note} 超出常见键盘范围`);
    }
  }
});

test('任务模式有效，节奏任务包含速度与拍数', () => {
  const modes = new Set(['sequence', 'together', 'rhythm', 'staff', 'wait']);
  for (const lesson of LESSONS) {
    assert.ok(modes.has(lesson.task.mode), `${lesson.id} 使用了未知模式 ${lesson.task.mode}`);
    if (lesson.task.mode === 'rhythm') {
      assert.ok(lesson.task.tempo >= 40 && lesson.task.tempo <= 240);
      assert.ok(lesson.task.beats >= 1);
      assert.ok(lesson.task.toleranceMs > 0);
      assert.equal(new Set(lesson.task.target).size, 1, '节奏任务应只弹同一个音');
    }
    if (lesson.task.mode === 'together') {
      assert.equal(new Set(lesson.task.target).size, lesson.task.target.length, `${lesson.id} 和弦目标重复`);
    }
    if (lesson.task.mode === 'wait') {
      assert.ok(lesson.task.target.length > 0, `${lesson.id} 等待任务目标为空`);
    }
  }
});

test('目标音与标签数量一致', () => {
  for (const lesson of LESSONS) {
    assert.equal(lesson.task.labels.length, lesson.task.target.length, `${lesson.id} 标签数量不一致`);
  }
});

test('标签与 MIDI 编号在标准命名下一致', () => {
  for (const lesson of LESSONS) {
    lesson.task.target.forEach((note, index) => {
      const label = lesson.task.labels[index];
      const parsed = noteNumberFromName(label.replace(/\s*=.*$/, ''));
      if (parsed === null) {
        // 节奏课使用「第 N 拍」这类标签，跳过音名校验。
        return;
      }
      assert.equal(parsed, note, `${lesson.id} 第 ${index + 1} 个标签 ${label} 与音符 ${note} 不一致`);
    });
  }
});

test('示范音与示例不包含非法值', () => {
  for (const lesson of LESSONS) {
    if (!lesson.demo) continue;
    for (const note of lesson.demo.notes) {
      assert.ok(isValidMidiNote(note), `${lesson.id} 示范包含非法音符`);
    }
  }
});

test('模块分组与查找函数', () => {
  assert.equal(lessonsByModule('A').length, 4);
  assert.equal(lessonsByModule('G').length, 2);
  assert.equal(findLesson('find-c').title, '找到 C 音');
  assert.equal(findLesson('不存在'), null);
  assert.equal(nextLessonAfter('find-c').id, 'note-order');
  assert.equal(nextLessonAfter(LESSONS[LESSONS.length - 1].id), null);
  assert.equal(lessonIndex('find-c'), 1);
});

test('C 大调音阶课只使用白键', () => {
  const lesson = findLesson('c-major');
  for (const note of lesson.task.target) assert.equal(isBlackKey(note), false);
  assert.equal(noteName(lesson.task.target[0]), 'C4');
  assert.equal(noteName(lesson.task.target[lesson.task.target.length - 1]), 'C5');
});

test('G 大调课包含 F♯', () => {
  const lesson = findLesson('g-major');
  assert.ok(lesson.task.target.includes(78));
  assert.equal(noteName(78), 'F♯5');
});
