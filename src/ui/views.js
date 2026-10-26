/**
 * 页面视图（纯渲染）。
 *
 * 所有函数只读取传入的状态并返回 HTML 字符串，不修改状态、不绑定事件。
 * 事件统一由 src/app.js 通过 data-action / data-view 委托处理。
 */

import { LESSONS, LESSON_MODULES, nextLessonAfter, lessonsByModule, LESSON_COUNT } from '../data/lessons.js';
import { QUIZ_CATEGORIES, QUESTIONS, questionsForCategory, findQuestion } from '../data/quizzes.js';
import { noteName } from '../core/music-theory.js';
import { localDateKey, calculateStreak, quizAccuracy } from '../storage/progress-store.js';
import { renderPianoPanel, renderKeyboardMarkup } from './keyboard.js';
import { renderStaff } from './staff.js';
import { escapeHtml, percent, joinPills, formatDateTime } from './format.js';
import { eventTypeLabel, describeEvent, hexBytes, sourceLabel } from '../midi/midi-normalizer.js';

const VIEW_META = {
  home: ['YOUR MUSIC JOURNEY', '学习概览'],
  courses: ['LEARN STEP BY STEP', '互动课程'],
  lesson: ['LESSON IN PROGRESS', '课程学习'],
  practice: ['TRAIN YOUR EAR & MIND', '乐理练习'],
  midi: ['CONNECT · PLAY · UNDERSTAND', 'MIDI 实验室'],
  progress: ['YOUR PRACTICE HISTORY', '学习记录']
};

export function viewMeta(view) {
  return VIEW_META[view] || VIEW_META.home;
}

function naming(state) {
  return state.progress.settings.naming;
}

function completedSet(state) {
  return new Set(state.progress.completedLessons);
}

function moduleProgress(state, moduleId) {
  const lessons = lessonsByModule(moduleId);
  const done = lessons.filter(lesson => state.progress.completedLessons.includes(lesson.id)).length;
  return { done, total: lessons.length, percent: percent(done, lessons.length) };
}

function moduleById(id) {
  return LESSON_MODULES.find(module => module.id === id);
}

function nextIncomplete(state) {
  return LESSONS.find(lesson => !state.progress.completedLessons.includes(lesson.id)) || LESSONS[LESSONS.length - 1];
}

// ---------------------------------------------------------------- 首页

export function renderHome(state) {
  const progress = state.progress;
  const accuracy = quizAccuracy(progress);
  const next = nextIncomplete(state);
  const totalPercent = percent(progress.completedLessons.length, LESSON_COUNT);
  return `${renderHero(state)}
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon purple" aria-hidden="true">▤</div><div><div class="stat-value">${progress.completedLessons.length}<span class="stat-value-sub"> / ${LESSON_COUNT}</span></div><div class="stat-label">已完成课程</div></div></div>
      <div class="stat-card"><div class="stat-icon mint" aria-hidden="true">♫</div><div><div class="stat-value">${progress.practiceNotes}</div><div class="stat-label">练习按键次数</div></div></div>
      <div class="stat-card"><div class="stat-icon peach" aria-hidden="true">◎</div><div><div class="stat-value">${accuracy === null ? '—' : `${accuracy}%`}</div><div class="stat-label">乐理答题正确率</div></div></div>
    </div>
    <div class="home-columns">
      <section class="panel">
        <div class="panel-head"><div><h3>接下来学什么？</h3><p>沿着学习路径，一步步解锁音乐知识。</p></div><span class="tag purple">NEXT LESSON</span></div>
        <div class="current-lesson">
          <div class="lesson-number">${next.number}</div>
          <div class="current-lesson-copy"><strong>${escapeHtml(next.title)}</strong><p>${escapeHtml(next.summary)}</p><span class="lesson-meta">${escapeHtml(moduleById(next.module)?.name || '')} · ${escapeHtml(next.category)}</span></div>
          <button class="btn btn-primary btn-small" data-action="open-lesson" data-id="${next.id}">开始 <span aria-hidden="true">→</span></button>
        </div>
        <div class="section-head"><div><h2>学习路径</h2><p>${LESSON_MODULES.length} 个模块 · 共 ${LESSON_COUNT} 课 · 总进度 ${totalPercent}%</p></div><button class="text-link" data-view="courses">查看全部 →</button></div>
        <div class="module-strip">
          ${LESSON_MODULES.map(module => {
            const info = moduleProgress(state, module.id);
            return `<button class="module-chip ${info.done === info.total ? 'done' : ''}" data-view="courses" data-module="${module.id}">
              <span class="module-letter">${module.id}</span>
              <span class="module-chip-copy"><strong>${escapeHtml(module.short)}</strong><small>${info.done}/${info.total}</small></span>
              <span class="module-bar"><span style="width:${info.percent}%"></span></span>
            </button>`;
          }).join('')}
        </div>
        <div class="course-list">
          ${LESSONS.slice(0, 4).map(lesson => renderCourseRow(lesson, state)).join('')}
        </div>
      </section>
      <section class="panel">
        <div class="panel-head"><div><h3>随手练一练</h3><p>不用连接设备，也可以先熟悉键盘。</p></div><span class="tag mint">PLAYGROUND</span></div>
        <div class="piano-wrap piano-inline">
          <div class="piano-head"><strong>虚拟键盘 · 一个八度</strong><span>点击或触摸</span></div>
          <div class="piano-scroll">${renderKeyboardMarkup({ start: 60, count: 13, naming: naming(state), id: 'home-board', mini: true, label: '首页虚拟钢琴键盘' })}</div>
          <div class="piano-foot"><span>最近按下的音</span><strong data-last-note>等待输入</strong></div>
        </div>
        <div class="section-head"><div><h2>快速进入</h2><p>选择一个方向开始探索。</p></div></div>
        <div class="quick-actions">
          <button class="quick-action" data-view="practice"><span class="qa-icon" aria-hidden="true">✳</span><span><strong>乐理练习</strong><small>四选一或在键盘上弹出答案。</small></span></button>
          <button class="quick-action" data-view="midi"><span class="qa-icon" aria-hidden="true">⌁</span><span><strong>MIDI 实验室</strong><small>看看按键会发送什么。</small></span></button>
          <button class="quick-action" data-view="progress"><span class="qa-icon" aria-hidden="true">↗</span><span><strong>学习记录</strong><small>回顾进度并导出备份。</small></span></button>
        </div>
      </section>
    </div>`;
}

function renderHero(state) {
  const hasProgress = state.progress.completedLessons.length > 0;
  return `<section class="hero">
    <div class="hero-copy">
      <span class="hero-kicker">A SMALL STEP, A NEW SOUND</span>
      <h2>从按下第一个音开始，<br><em>真正理解音乐。</em></h2>
      <p>把乐理变成可以亲手验证的体验。学音符、练节奏、认识和弦，再连接你的 MIDI 键盘，逐步看懂声音背后的规则。</p>
      <div class="button-row">
        <button class="btn btn-primary" data-action="continue-learning">${hasProgress ? '继续上次学习' : '开始第一课'} <span aria-hidden="true">↗</span></button>
        <button class="btn btn-dark-ghost" data-view="midi">探索 MIDI 实验室 <span aria-hidden="true">⌁</span></button>
      </div>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="music-orbit">
        <div class="orbit one"></div><div class="orbit two"></div><div class="orbit three"></div>
        <span class="floating-note n1">♪</span><span class="floating-note n2">♫</span><span class="floating-note n3">♩</span><span class="floating-note n4">♬</span>
        <div class="mini-keys"><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>
      </div>
    </div>
  </section>`;
}

function renderCourseRow(lesson, state) {
  const done = state.progress.completedLessons.includes(lesson.id);
  return `<div class="course-row">
    <div class="course-symbol" aria-hidden="true">${lesson.icon}</div>
    <div class="course-row-copy"><strong>${escapeHtml(lesson.title)}</strong><span>${escapeHtml(lesson.category)} · ${lesson.duration}</span></div>
    <span class="row-status ${done ? 'done' : ''}">${done ? '✓ 已完成' : lesson.number}</span>
  </div>`;
}

// ---------------------------------------------------------------- 课程列表

export function renderCourses(state, activeModule = null) {
  const completed = completedSet(state);
  return `<div class="view-intro">
      <div><h2>互动课程</h2><p>从认识琴键开始，再学习音高、音阶、和弦、节奏、五线谱与 MIDI。每节课都包含讲解和可操作的练习，通过后自动保存进度。</p></div>
      <span class="tag purple">${completed.size}/${LESSON_COUNT} COMPLETED</span>
    </div>
    ${LESSON_MODULES.map(module => {
      const lessons = lessonsByModule(module.id);
      const info = moduleProgress(state, module.id);
      const dimmed = activeModule && activeModule !== module.id;
      return `<section class="module-block ${dimmed ? 'is-dimmed' : ''}" id="module-${module.id}">
        <div class="module-head">
          <span class="module-letter large">${module.id}</span>
          <div class="module-head-copy"><h3>模块 ${module.id} · ${escapeHtml(module.name)}</h3><p>${escapeHtml(module.description)}</p></div>
          <div class="module-head-progress"><strong>${info.done}/${info.total}</strong><div class="progress-track"><span style="width:${info.percent}%"></span></div></div>
        </div>
        <div class="course-grid">${lessons.map(lesson => {
          const done = completed.has(lesson.id);
          return `<article class="lesson-card ${done ? 'is-done' : ''}">
            <div class="lesson-card-top"><span class="lesson-badge">${lesson.number}</span><span class="tag ${done ? 'mint' : ''}">${done ? '✓ 已完成' : lesson.duration}</span></div>
            <h3>${escapeHtml(lesson.title)}</h3>
            <p>${escapeHtml(lesson.summary)}</p>
            <div class="lesson-card-foot"><span>${escapeHtml(lesson.category)}</span><button class="btn ${done ? 'btn-ghost' : 'btn-primary'} btn-small" data-action="open-lesson" data-id="${lesson.id}">${done ? '复习课程' : '开始学习'} →</button></div>
          </article>`;
        }).join('')}</div>
      </section>`;
    }).join('')}
    <div class="notice">课程练习可以使用屏幕虚拟键盘或电脑键盘。连接实体 MIDI 键盘后，在支持 Web MIDI 的浏览器里可以用真实琴键完成相同练习；iPhone / iPad 的 Safari 通常不支持 Web MIDI。</div>`;
}

// ---------------------------------------------------------------- 课程详情

export function renderLessonPage(state) {
  const lesson = LESSONS.find(item => item.id === state.lessonId) || LESSONS[0];
  const progress = state.progress;
  const done = progress.completedLessons.includes(lesson.id);
  const module = moduleById(lesson.module);
  const next = nextLessonAfter(lesson.id);
  const targetCount = lesson.task.target.length;
  const isStaff = lesson.task.mode === 'staff';
  const isRhythm = lesson.task.mode === 'rhythm';
  const demoNotes = lesson.demo?.notes || [];
  return `<div class="view-intro">
      <div>
        <button class="back-link" data-view="courses">← 返回课程列表</button>
        <div class="eyebrow">LESSON ${lesson.number} · ${escapeHtml(module?.name || '')} · ${escapeHtml(lesson.category)}</div>
        <h2>${escapeHtml(lesson.title)}</h2>
        <p>${escapeHtml(lesson.lead)}</p>
      </div>
      <span class="tag ${done ? 'mint' : 'purple'}">${done ? '✓ 已完成' : lesson.duration}</span>
    </div>
    <div class="lesson-detail">
      <section class="lesson-main-card">
        <div class="lesson-copy">
          ${lesson.sections.map(section => `<h3>${escapeHtml(section.title)}</h3><p>${escapeHtml(section.text)}</p>`).join('')}
          <div class="note-pills">${joinPills(lesson.examples)}</div>
          ${demoNotes.length ? `<div class="demo-row">
            <button class="btn btn-ghost btn-small" data-action="play-demo" data-notes="${demoNotes.join(',')}" data-label="${escapeHtml(lesson.demo.label || '示范')}">试听示范 ♪</button>
            <span>${escapeHtml(lesson.demo.label || '')} · ${demoNotes.map(note => escapeHtml(noteName(note, { naming: naming(state) }))).join(' · ')}</span>
          </div>` : ''}
          <div class="lesson-tip"><strong>小提示：</strong>${escapeHtml(lesson.tip)}</div>
        </div>
        <div class="exercise-box ${state.lessonStatus?.complete ? 'is-complete' : ''}" id="lesson-exercise" data-mode="${lesson.task.mode}">
          <span class="exercise-kicker">TRY IT YOURSELF · 练一练</span>
          <h3>${escapeHtml(lesson.task.prompt)}</h3>
          <p>${isRhythm ? '点击「开始节拍器」，在预备拍之后跟着节拍弹奏。评分依据是真实收到按键的时间戳，不是点击次数。' : '按照提示弹奏，系统会检查你的音符。你可以使用屏幕键盘、电脑键盘，或在支持的浏览器中连接真实 MIDI 键盘。'}</p>
          <div class="exercise-status">
            <span class="exercise-counter" id="lesson-exercise-counter">0/${targetCount}</span>
            <div class="exercise-progress"><span id="lesson-exercise-progress" style="width:0%"></span></div>
          </div>
          <div class="exercise-feedback" id="lesson-exercise-feedback" data-tone="${state.lessonStatus?.complete ? 'success' : 'default'}" role="status" aria-live="polite">${escapeHtml(state.lessonStatus?.feedback || (isRhythm ? '点击「开始节拍器」，听预备拍后开始演奏。' : '准备好后，按提示弹奏第一个音。'))}</div>
          <div class="rhythm-area" id="lesson-rhythm-area" ${isRhythm ? '' : 'hidden'}>
            <div class="rhythm-controls">
              <button class="btn btn-primary btn-small" data-action="toggle-lesson-metronome" id="lesson-metronome-button">开始节拍器 ▶</button>
              <span class="rhythm-tempo">${lesson.task.tempo || 80} BPM · ${lesson.task.beats || targetCount} 拍</span>
            </div>
            <div class="beat-dots" id="lesson-beat-dots">${Array.from({ length: lesson.task.beats || targetCount }, (_, index) => `<span class="beat-dot" data-beat="${index + 1}"></span>`).join('')}</div>
            <div class="rhythm-analysis" id="lesson-rhythm-analysis"></div>
          </div>
          <div class="button-row exercise-actions" id="lesson-exercise-actions"></div>
          <p class="exercise-note">${escapeHtml(lesson.passCriteria)}</p>
        </div>
        ${isStaff ? `<div class="staff-block">${renderStaff(lesson.task.target, { title: '本课谱面', showLabels: true })}<p class="staff-note">这是教学用简化的高音谱表。实际乐谱还会有调号、拍号与更复杂的节奏。</p></div>` : ''}
        ${renderPianoPanel({
          start: 48,
          count: 37,
          naming: naming(state),
          id: 'lesson-board',
          title: '互动虚拟键盘 · 37 键',
          subtitle: '屏幕琴键、电脑键盘（A–L / W E T Y U，Z X 移八度）或实体 MIDI'
        })}
      </section>
      <aside class="lesson-side-card">
        <span class="tag">LESSON MAP</span>
        <h3 class="side-title">本课学习目标</h3>
        <ul class="goal-list">${lesson.goals.map(goal => `<li>${escapeHtml(goal)}</li>`).join('')}</ul>
        <h3 class="side-title">先修知识</h3>
        <p class="side-note">${lesson.prerequisites.map(item => escapeHtml(item)).join(' · ')}</p>
        <h3 class="side-title">通过标准</h3>
        <p class="side-note">${escapeHtml(lesson.passCriteria)}</p>
        <h3 class="side-title">完成条件</h3>
        <p class="side-note">${escapeHtml(lesson.completion)}</p>
        <h3 class="side-title">复习提示</h3>
        <p class="side-note">${escapeHtml(lesson.reviewTip)}</p>
        <div class="side-progress"><div class="panel-head"><h3>课程进度</h3><span class="tag">${lesson.number}/${String(LESSON_COUNT).padStart(2, '0')}</span></div><div class="progress-track"><span id="lesson-side-progress" style="width:${done ? 100 : 0}%"></span></div><p class="side-note">${done ? '你已完成这节课。可以再次练习巩固记忆。' : '完成键盘练习后会自动记录本课完成。'}</p></div>
        ${next ? `<div class="side-next"><div class="panel-head"><h3>接下来</h3><span class="tag">NEXT</span></div><button class="side-next-button" data-action="open-lesson" data-id="${next.id}"><span><strong>${escapeHtml(next.title)}</strong><small>${escapeHtml(next.category)} · ${next.duration}</small></span><span aria-hidden="true">→</span></button></div>` : ''}
      </aside>
    </div>`;
}

// ---------------------------------------------------------------- 练习

export function renderPractice(state) {
  if (state.quizSession) return renderQuiz(state);
  const progress = state.progress;
  const accuracy = quizAccuracy(progress);
  return `<div class="view-intro">
      <div><h2>乐理练习</h2><p>把刚学到的知识变成反应。题目包含四选一和「在键盘上弹出」两种形式；答题后会解释原因，答错也能看到你实际弹了什么。</p></div>
      <span class="tag purple">${QUESTIONS.length} 道题</span>
    </div>
    <div class="practice-categories">
      <button class="practice-category featured" data-action="start-quiz" data-category="all">
        <span class="category-icon" aria-hidden="true">✳</span><h3>混合练习</h3><p>随机抽取各主题题目，包括键盘弹奏题。</p><span class="category-bottom">综合挑战 <span aria-hidden="true">→</span></span>
      </button>
      ${QUIZ_CATEGORIES.map(category => {
        const stats = progress.quizByCategory[category.id] || { answered: 0, correct: 0 };
        const rate = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : null;
        return `<button class="practice-category" data-action="start-quiz" data-category="${category.id}">
          <span class="category-icon" aria-hidden="true">${category.icon}</span>
          <h3>${escapeHtml(category.title)}</h3>
          <p>${escapeHtml(category.description)}</p>
          <span class="category-bottom">${questionsForCategory(category.id).length} 道题${rate === null ? '' : ` · 正确率 ${rate}%`} <span aria-hidden="true">→</span></span>
        </button>`;
      }).join('')}
    </div>
    <div class="section-head"><div><h2>答题记录</h2><p>本地保存，不需要注册账号。</p></div></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-icon purple" aria-hidden="true">✓</div><div><div class="stat-value">${progress.quizAnswered}</div><div class="stat-label">已答题数</div></div></div>
      <div class="stat-card"><div class="stat-icon mint" aria-hidden="true">◎</div><div><div class="stat-value">${accuracy === null ? '—' : `${accuracy}%`}</div><div class="stat-label">总体正确率</div></div></div>
      <div class="stat-card"><div class="stat-icon peach" aria-hidden="true">↻</div><div><div class="stat-value">${progress.practiceSessions}</div><div class="stat-label">练习轮次</div></div></div>
    </div>
    ${renderMostWrong(state)}`;
}

function renderMostWrong(state) {
  const entries = Object.entries(state.progress.wrongCounts)
    .map(([id, count]) => ({ question: findQuestion(id), count }))
    .filter(entry => entry.question)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  if (!entries.length) return '';
  return `<div class="section-head"><div><h2>最常答错的知识点</h2><p>根据本地答题记录统计，优先复习这些题目。</p></div></div>
    <section class="panel"><div class="wrong-list">${entries.map(entry => `<div class="wrong-row"><span class="wrong-count">×${entry.count}</span><div><strong>${escapeHtml(entry.question.prompt)}</strong><p>${escapeHtml(entry.question.explanation)}</p></div></div>`).join('')}</div></section>`;
}

export function renderQuiz(state) {
  const session = state.quizSession;
  const categoryName = QUIZ_CATEGORIES.find(category => category.id === session.category)?.title || '混合练习';
  if (session.done) {
    const total = session.questions.length;
    const rate = percent(session.score, total);
    return `<div class="view-intro"><div><h2>本轮练习结果</h2><p>每次练习都是一次反馈。查看结果，再决定要不要重新挑战。</p></div></div>
      <section class="quiz-card"><div class="quiz-result">
        <div class="result-mark" aria-hidden="true">${rate >= 75 ? '✓' : '↻'}</div>
        <span class="tag ${rate >= 75 ? 'mint' : 'purple'}">PRACTICE COMPLETE</span>
        <h2>${session.score} / ${total} 题答对</h2>
        <p>本轮正确率为 ${rate}%。${rate >= 75 ? '做得不错！你可以继续学习下一节，或选择其他主题挑战。' : '建议回到课程复习相关知识，再试一次。答错是学习的一部分。'}</p>
        ${session.wrongIds.length ? `<div class="quiz-review"><strong>需要复习：</strong><ul>${session.wrongIds.map(id => findQuestion(id)).filter(Boolean).map(question => `<li>${escapeHtml(question.prompt)} — ${escapeHtml(question.explanation)}</li>`).join('')}</ul></div>` : ''}
        <div class="button-row" style="justify-content:center"><button class="btn btn-primary" data-action="retry-quiz">再练一次 ↻</button><button class="btn btn-ghost" data-action="exit-quiz">返回练习菜单</button></div>
      </div></section>`;
  }
  const question = session.questions[session.index];
  const progressPercent = percent(session.index + (session.answered ? 1 : 0), session.questions.length);
  return `<div class="view-intro"><div><button class="back-link" data-action="exit-quiz">← 返回练习菜单</button><div class="eyebrow">${escapeHtml(categoryName)}</div><h2>${escapeHtml(categoryName)}</h2><p>先独立思考，再查看解释。你可以随时退出并重新练习。</p></div><span class="tag purple">${session.index + 1} / ${session.questions.length}</span></div>
    <section class="quiz-card">
      <div class="quiz-progress"><span style="width:${progressPercent}%"></span></div>
      <div class="quiz-top"><span class="tag">${question.type === 'play' ? '在键盘上弹出' : '四选一'}</span><span class="quiz-progress-text">${session.index + 1} / ${session.questions.length} · 已答对 ${session.score}</span></div>
      <h2 class="quiz-question">${escapeHtml(question.prompt)}</h2>
      ${question.type === 'choice' ? renderChoiceAnswers(state, question) : renderPlayAnswer(state, question)}
      <div class="quiz-bottom">
        <span class="quiz-score">本轮已答对 ${session.score} 题</span>
        ${session.answered ? `<button class="btn btn-primary" data-action="next-question">${session.index === session.questions.length - 1 ? '查看结果' : '下一题'} →</button>` : '<span class="tag">选择一个答案</span>'}
      </div>
    </section>`;
}

function renderChoiceAnswers(state, question) {
  const session = state.quizSession;
  return `<div class="answer-list">${question.options.map((option, index) => {
    let className = 'answer-option';
    if (session.answered && index === question.answer) className += ' correct';
    else if (session.answered && index === session.selected) className += ' wrong';
    return `<button class="${className}" data-action="answer" data-index="${index}" ${session.answered ? 'disabled' : ''}>
      <span class="answer-letter">${String.fromCharCode(65 + index)}</span><span>${escapeHtml(option)}</span>
    </button>`;
  }).join('')}</div>
  ${session.answered ? renderAnswerFeedback(state, question) : '<p class="quiz-hint">选择你认为正确的答案。答题后会看到解释。</p>'}`;
}

function renderPlayAnswer(state, question) {
  return `<p class="quiz-hint">${question.mode === 'together' ? '同时按住所有目标音。' : '按顺序弹出目标音。'}屏幕键盘、电脑键盘和实体 MIDI 都可以作答。</p>
    ${renderPianoPanel({
      start: 48,
      count: 37,
      naming: naming(state),
      id: 'quiz-board',
      title: '作答键盘',
      subtitle: '点击 / 触摸，或用电脑键盘 A–L 演奏'
    })}
    <div class="answer-feedback ${state.quizFeedback?.matched ? 'good' : ''}" id="quiz-play-feedback" role="status" aria-live="polite">${escapeHtml(state.quizFeedback?.feedback || '等待你在键盘上弹奏…')}</div>
    ${state.quizSession.answered ? `<div class="answer-feedback good"><strong>弹奏正确！</strong> ${escapeHtml(question.explanation)}</div>` : ''}`;
}

function renderAnswerFeedback(state, question) {
  const session = state.quizSession;
  const correct = session.selected === question.answer;
  const chosen = question.options[session.selected];
  return `<div class="answer-feedback ${correct ? 'good' : 'bad'}" role="status">
    <strong>${correct ? '回答正确！' : '还差一点。'}</strong>
    ${correct ? escapeHtml(question.explanation) : `你选择了「${escapeHtml(chosen)}」，正确答案是「${escapeHtml(question.options[question.answer])}」。${escapeHtml(question.explanation)}`}
  </div>`;
}

// ---------------------------------------------------------------- MIDI 实验室

export function renderMidiLab(state) {
  const midi = state.midi;
  const status = midi.statusSummary();
  const selected = midi.getSelected();
  const inputs = midi.getInputs();
  const settings = state.progress.settings;
  const held = midi.getHeldNotes();
  return `<div class="view-intro">
      <div><h2>MIDI 实验室</h2><p>观察演奏如何变成数字事件。没有实体键盘也可以先用屏幕键盘学习数据结构；支持 Web MIDI 的浏览器可以读取外接设备的按键、力度与控制器数据。</p></div>
      <span class="tag ${midi.isConnected() ? 'mint' : ''}">${midi.isConnected() ? 'LIVE INPUT' : 'SIMULATED INPUT'}</span>
    </div>
    <div class="midi-layout">
      <section class="midi-card">
        <h3>设备连接</h3>
        <p class="card-subtitle">尝试连接你的 M-VAVE SMK-37 PRO。首次连接时请确保设备已开机，并通过 USB 或兼容的蓝牙 MIDI 方式连接。iPhone / iPad 的 Safari 通常不提供 Web MIDI，这是系统限制。</p>
        <div class="midi-status-box ${status.tone === 'warn' ? 'unsupported' : status.tone === 'ok' ? 'connected' : ''}" id="midi-status-box" role="status" aria-live="polite">
          <div class="midi-status-icon" aria-hidden="true">⌁</div>
          <div class="midi-status-copy"><strong id="midi-status-title">${escapeHtml(status.title)}</strong><p id="midi-status-description">${escapeHtml(status.description)}</p></div>
        </div>
        <div class="midi-controls">
          <button class="btn btn-primary" data-action="connect-midi" id="connect-midi-button">连接 MIDI 设备 ↗</button>
          <button class="btn btn-ghost" data-action="refresh-midi">刷新设备</button>
        </div>
        <label class="field-label" for="midi-input-select">输入设备</label>
        <select class="select-field" id="midi-input-select" ${inputs.length ? '' : 'disabled'}>
          ${inputs.length ? inputs.map(input => `<option value="${escapeHtml(input.id)}" ${selected?.id === input.id ? 'selected' : ''}>${escapeHtml(input.name)}${input.state === 'connected' ? '' : '（已断开）'}</option>`).join('') : '<option value="">尚未检测到输入设备</option>'}
        </select>
        <label class="switch-row"><input type="checkbox" id="midi-monitor-sound" ${settings.monitorHardwareSound ? 'checked' : ''}> 收到实体 MIDI 音符时，由网页合成器同步发声</label>
        <label class="switch-row"><input type="checkbox" id="midi-naming-toggle" ${settings.naming === 'yamaha' ? 'checked' : ''}> 使用 YAMAHA 八度命名（中央 C 显示为 C3；MIDI 60 不变）</label>
        ${selected?.profile ? `<div class="device-note"><strong>${escapeHtml(selected.profile.name)}</strong><span class="tag ${selected.profile.verified ? 'mint' : 'purple'}">${escapeHtml(selected.profile.statusLabel)}</span><p>${escapeHtml(selected.profile.notes)}</p><button class="text-link" data-action="show-device-checklist">查看实机验证清单 →</button></div>` : ''}
        ${renderPianoPanel({
          start: 48,
          count: 37,
          naming: settings.naming,
          id: 'lab-board',
          title: '虚拟键盘 · 37 键',
          subtitle: '屏幕琴键会产生「模拟」事件；实体输入会高亮为另一种颜色'
        })}
        <div class="held-panel">
          <div class="held-head"><strong>当前按住</strong><span class="tag" id="held-count">${held.length} 个音</span></div>
          <div class="held-list" id="held-list">${renderHeldList(held, settings.naming)}</div>
        </div>
      </section>
      <section class="midi-card">
        <h3>事件监视器</h3>
        <p class="card-subtitle">最多保留 ${midi.maxEvents} 条事件。屏幕琴键的事件会标注来源「屏幕键盘（模拟）」，不会伪装成硬件输入。</p>
        <div class="lab-stats">
          <div class="stat-card"><div><div class="stat-value" id="midi-event-count">${midi.events.length}</div><div class="stat-label">事件数量</div></div></div>
          <div class="stat-card"><div><div class="stat-value" id="midi-last-value">${lastVelocity(midi.events)}</div><div class="stat-label">最近力度</div></div></div>
        </div>
        <div class="lab-toolbar">
          <div class="filter-group" role="group" aria-label="事件过滤">
            ${[['all', '全部'], ['note', '音符'], ['control', '控制器']].map(([id, label]) => `<button class="chip ${state.lab.filter === id ? 'active' : ''}" data-action="filter-events" data-filter="${id}">${label}</button>`).join('')}
          </div>
          <div class="toolbar-actions">
            <button class="chip ${state.lab.paused ? 'active' : ''}" data-action="toggle-log-pause" aria-pressed="${state.lab.paused}">${state.lab.paused ? '继续记录' : '暂停记录'}</button>
            <button class="chip" data-action="clear-events">清空</button>
          </div>
        </div>
        <div class="export-row">
          <button class="text-link" data-action="export-events-json">导出 JSON</button>
          <button class="text-link" data-action="export-events-csv">导出 CSV</button>
          <button class="text-link" data-action="export-device-report">设备观察报告</button>
        </div>
        <div class="event-log">
          <div class="event-log-head"><strong>实时 MIDI 事件</strong><span class="event-log-hint">点击一行查看原始字节</span></div>
          <div class="event-list" id="event-list">${renderEventList(state)}</div>
        </div>
        ${renderLearnPanel(state)}
        <div class="section-head"><div><h2>看懂这些数据</h2><p>常见 MIDI 信息速查。</p></div></div>
        <div class="info-list">
          <div class="info-row"><span class="info-icon" aria-hidden="true">↓</span><div><strong>Note On / Note Off</strong><p>按下和松开琴键是两个不同事件。Note On 携带音符编号与力度，Note Off 结束该音符。Velocity 为 0 的 Note On 会被当作 Note Off。</p></div></div>
          <div class="info-row"><span class="info-icon" aria-hidden="true">◉</span><div><strong>Velocity · 力度</strong><p>常见值范围为 1–127。数值越大通常代表演奏力度越强，但实际音量也取决于音源设置。</p></div></div>
          <div class="info-row"><span class="info-icon" aria-hidden="true">↔</span><div><strong>CC · 控制变化</strong><p>旋钮、推子或延音踏板可以发送控制变化信息。不同设备和预设可能使用不同的 CC 编号。</p></div></div>
          <div class="info-row"><span class="info-icon" aria-hidden="true">〜</span><div><strong>Pitch Bend · 弯音</strong><p>14 位数值，通常 0–16383，中心值 8192 表示不弯音。不同设备的弯音范围可能不同。</p></div></div>
        </div>
        <div class="notice">iPhone / iPad 提示：iOS / iPadOS Safari 通常不提供 Web MIDI API，因此本页无法直接读取实体键盘。虚拟键盘、课程、练习和进度仍可使用。若要稳定连接实体 MIDI，需要原生 iOS 外壳（Core MIDI）或专用桥接方案；相关适配器接口已预留，但原生端尚未实现。</div>
      </section>
    </div>
    <section class="midi-card lab-metronome">
      <div class="panel-head"><div><h3>节拍器与节奏工具</h3><p>使用真实时间戳评估你的击点，而不是点击次数。</p></div><span class="tag">${state.labMetronome.running ? 'RUNNING' : 'IDLE'}</span></div>
      <div class="lab-metronome-body">
        <label class="field-label" for="lab-bpm">速度</label>
        <input type="range" id="lab-bpm" min="40" max="240" step="1" value="${settings.metronomeBpm}">
        <div class="bpm-readout"><strong id="lab-bpm-value">${settings.metronomeBpm}</strong> BPM</div>
        <div class="beat-dots">${Array.from({ length: 4 }, (_, index) => `<span class="beat-dot" data-beat="${index + 1}"></span>`).join('')}</div>
        <button class="btn ${state.labMetronome.running ? 'btn-ghost' : 'btn-primary'}" data-action="toggle-lab-metronome">${state.labMetronome.running ? '停止节拍器 ■' : '开始节拍器 ▶'}</button>
        <p class="side-note">节拍器只提供听觉参考。要练习节奏评分，请进入课程「拍子与四分音符」。</p>
      </div>
    </section>`;
}

function lastVelocity(events) {
  const event = events.find(item => item.type === 'note-on');
  return event && event.velocity != null ? String(event.velocity) : '—';
}

export function renderHeldList(held, namingConvention = 'standard') {
  if (!held.length) return '<p class="held-empty">没有按住的音符。</p>';
  return held.map(item => `<span class="held-pill ${item.sources.some(source => source === 'webmidi' || source === 'native') ? 'hardware' : ''}">
    <strong>${escapeHtml(noteName(item.note, { naming: namingConvention }))}</strong>
    <span>MIDI ${item.note} · ${item.velocity} · ${escapeHtml(sourceLabel(item.sources[0]))}</span>
  </span>`).join('');
}

export function renderEventList(state) {
  const events = state.midi.events;
  const filter = state.lab.filter;
  const filtered = events.filter(event => {
    if (filter === 'note') return event.type === 'note-on' || event.type === 'note-off';
    if (filter === 'control') return event.type === 'control-change' || event.type === 'pitch-bend' || event.type === 'program-change';
    return true;
  }).slice(0, 80);
  if (!filtered.length) {
    return `<div class="empty-state"><strong>${state.lab.paused ? '事件记录已暂停' : '等待第一条事件'}</strong>${state.lab.paused ? '点击「继续记录」恢复；之前的记录仍然保留。' : '点击虚拟琴键，或在支持的浏览器里连接真实 MIDI 键盘。每次按下和松开都会生成事件。'}</div>`;
  }
  return filtered.map(event => {
    const summary = describeEvent(event);
    const name = summary.name;
    const expanded = state.lab.expanded.has(event);
    const isOff = event.type === 'note-off';
    return `<div class="event-row ${expanded ? 'expanded' : ''}">
      <button class="event-main" data-action="toggle-event" data-event-index="${events.indexOf(event)}" aria-expanded="${expanded}">
        <span class="event-type ${isOff ? 'off' : ''}">${escapeHtml(eventTypeLabel(event.type))}</span>
        <span class="event-copy"><strong>${escapeHtml(typeof name === 'number' ? `${noteName(name, { naming: state.progress.settings.naming })} · Note ${name}` : name)}</strong><span>${escapeHtml(summary.detail)} · ${escapeHtml(sourceLabel(event.source))} · ${escapeHtml(event.deviceName || '')}</span></span>
        <span class="event-value">${event.velocity != null ? event.velocity : event.value != null ? event.value : '—'}</span>
      </button>
      ${expanded ? `<div class="event-raw"><div><span>来源</span><strong>${escapeHtml(sourceLabel(event.source))}${event.deviceName ? ` · ${escapeHtml(event.deviceName)}` : ''}</strong></div><div><span>通道</span><strong>CH ${event.channel}</strong></div><div><span>时间</span><strong>${formatDateTime(new Date(event.wallTime).toISOString())}</strong></div><div><span>原始字节</span><code>${escapeHtml(hexBytes(event.rawBytes)) || '—'}</code></div></div>` : ''}
    </div>`;
  }).join('');
}

function renderLearnPanel(state) {
  const mappings = state.progress.ccMappings || {};
  const targets = [
    { id: 'volume', label: '主音量' },
    { id: 'metronome', label: '节拍器音量' }
  ];
  return `<div class="learn-panel">
    <div class="panel-head"><div><h3>MIDI Learn</h3><p>点击参数，然后转动键盘上的旋钮或推子，把 CC 编号映射到这里。</p></div><span class="tag ${state.lab.learnTarget ? 'mint' : ''}">${state.lab.learnTarget ? '正在监听 CC…' : 'READY'}</span></div>
    <div class="mapping-list">
      ${targets.map(target => {
        const mapped = Object.entries(mappings).find(([, value]) => value === target.id);
        return `<div class="mapping-row">
          <span class="mapping-name">${target.label}</span>
          <span class="mapping-cc">${mapped ? `CC ${mapped[0]}` : '未映射'}</span>
          <button class="chip ${state.lab.learnTarget === target.id ? 'active' : ''}" data-action="learn-cc" data-target="${target.id}">${state.lab.learnTarget === target.id ? '等待 CC…' : mapped ? '重新学习' : '学习'}</button>
          ${mapped ? `<button class="chip" data-action="remove-cc" data-controller="${mapped[0]}">取消</button>` : ''}
        </div>`;
      }).join('')}
    </div>
    <div class="mapping-foot"><button class="text-link" data-action="reset-cc">恢复默认映射（清空）</button><span class="mapping-hint">${Object.keys(mappings).length ? `已保存 ${Object.keys(mappings).length} 条映射` : '映射只保存在本设备'}</span></div>
  </div>`;
}

// ---------------------------------------------------------------- 学习记录

export function renderProgress(state) {
  const progress = state.progress;
  const accuracy = quizAccuracy(progress);
  const streak = calculateStreak(progress.activityDays);
  const lastSeven = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = localDateKey(date);
    return { key, label: '日一二三四五六'[date.getDay()], active: progress.activityDays.includes(key) };
  });
  return `<div class="view-intro">
      <div><h2>学习记录</h2><p>你的学习数据只保存在当前浏览器中。无需注册账号，也不会自动上传到服务器。可以导出 JSON 备份，换设备时再导入。</p></div>
      <button class="btn btn-ghost btn-small" data-action="reset-progress">重置数据 ↻</button>
    </div>
    <div class="progress-overview">
      <div class="big-stat"><span class="tag purple">COURSE PROGRESS</span><div class="stat-value">${percent(progress.completedLessons.length, LESSON_COUNT)}%</div><div class="progress-track"><span style="width:${percent(progress.completedLessons.length, LESSON_COUNT)}%"></span></div><p>已完成 ${progress.completedLessons.length} / ${LESSON_COUNT} 节课程。完成课程练习后，进度会自动保存在此设备。</p></div>
      <div class="big-stat"><span class="tag mint">PRACTICE ACCURACY</span><div class="stat-value">${accuracy === null ? '—' : `${accuracy}%`}</div><p>已回答 ${progress.quizAnswered} 道题，答对 ${progress.quizCorrect} 道。多做几轮练习，观察自己是否进步。</p></div>
      <div class="big-stat streak-stat"><span class="tag">STREAK</span><div class="stat-value">${streak}<small> 天</small></div><p>按本地日期统计连续学习天数。今天${progress.activityDays.includes(localDateKey()) ? '已记录' : '还没有练习记录'}。</p><div class="week-dots">${lastSeven.map(day => `<span class="week-dot ${day.active ? 'active' : ''}" title="${day.key}"><small>${day.label}</small></span>`).join('')}</div></div>
      <div class="big-stat"><span class="tag peach">PRACTICE VOLUME</span><div class="stat-value">${progress.practiceNotes}</div><p>累计按键次数。练习 ${progress.practiceSessions} 轮，最近记录：${progress.lastActiveDate || '—'}。</p></div>
    </div>
    <div class="section-head"><div><h2>模块进度</h2><p>按学习路径查看每个模块的完成情况。</p></div><button class="text-link" data-view="courses">打开课程 →</button></div>
    <section class="panel"><div class="module-progress-list">${LESSON_MODULES.map(module => {
      const info = moduleProgress(state, module.id);
      return `<div class="module-progress-row"><span class="module-letter">${module.id}</span><div class="module-progress-copy"><strong>${escapeHtml(module.name)}</strong><p>${info.done} / ${info.total} 课完成</p></div><div class="progress-track"><span style="width:${info.percent}%"></span></div><span class="module-percent">${info.percent}%</span></div>`;
    }).join('')}</div></section>
    <div class="section-head"><div><h2>分类正确率</h2><p>记录每类题目的答题情况，找出需要复习的方向。</p></div></div>
    <section class="panel"><div class="category-stats">${QUIZ_CATEGORIES.map(category => {
      const stats = progress.quizByCategory[category.id] || { answered: 0, correct: 0 };
      const rate = stats.answered ? Math.round((stats.correct / stats.answered) * 100) : null;
      return `<div class="category-stat"><span class="category-stat-icon" aria-hidden="true">${category.icon}</span><div class="category-stat-copy"><strong>${escapeHtml(category.title)}</strong><p>${stats.answered ? `答对 ${stats.correct} / ${stats.answered}` : '还没有答题记录'}</p><div class="progress-track"><span style="width:${rate || 0}%"></span></div></div><span class="category-stat-rate">${rate === null ? '—' : `${rate}%`}</span></div>`;
    }).join('')}</div></section>
    ${renderMostWrong(state)}
    <div class="section-head"><div><h2>本地数据</h2><p>备份、迁移或清理学习记录。</p></div></div>
    <section class="panel data-panel">
      <div class="data-actions">
        <button class="btn btn-primary btn-small" data-action="export-progress">导出进度 JSON ↓</button>
        <button class="btn btn-ghost btn-small" data-action="import-progress">导入进度…</button>
        <button class="btn btn-ghost btn-small" data-action="show-storage-info">数据说明</button>
      </div>
      <p class="data-note">存储键：<code>keylab.progress.v2</code>。旧版 <code>keylab.progress.v1</code> 会在首次加载时自动迁移。导入前会校验 JSON 结构并显示预览，不会执行文件中的任何代码。</p>
    </section>
    <div class="section-head"><div><h2>学习偏好</h2><p>这些设置同样保存在本设备。</p></div></div>
    <section class="panel settings-panel">
      <label class="setting-row"><span><strong>音名八度命名</strong><small>MIDI 编号不变，只改变显示的八度数字。</small></span>
        <select class="select-field" id="naming-select">
          <option value="standard" ${progress.settings.naming === 'standard' ? 'selected' : ''}>标准（中央 C = C4）</option>
          <option value="yamaha" ${progress.settings.naming === 'yamaha' ? 'selected' : ''}>YAMAHA（中央 C = C3）</option>
        </select>
      </label>
      <label class="setting-row"><span><strong>虚拟键盘音量</strong><small>只影响屏幕合成器。</small></span>
        <input type="range" id="volume-range" min="0" max="100" value="${Math.round(progress.settings.volume * 100)}">
      </label>
      <label class="setting-row"><span><strong>实体 MIDI 同步发声</strong><small>关闭时，真实键盘只记录事件，不由网页发声。</small></span>
        <input type="checkbox" id="monitor-sound-setting" ${progress.settings.monitorHardwareSound ? 'checked' : ''}>
      </label>
    </section>`;
}

// ---------------------------------------------------------------- 通用小部件

export function renderDeviceChecklist(profile) {
  return `<div class="checklist">
    <p>以下项目必须在真实设备上逐项记录，完成后才能把设备标记为「已验证」。当前状态：<strong>${escapeHtml(profile.statusLabel)}</strong>。</p>
    <ol>${profile.observationChecklist.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ol>
    <p class="side-note">${escapeHtml(profile.notes)}</p>
  </div>`;
}

export function renderImportPreview(progress, warnings) {
  return `<div class="import-preview">
    <p>以下数据将覆盖当前本地进度：</p>
    <ul class="import-list">
      <li><span>已完成课程</span><strong>${progress.completedLessons.length} 节</strong></li>
      <li><span>答题</span><strong>${progress.quizAnswered} 题 · 答对 ${progress.quizCorrect}</strong></li>
      <li><span>练习按键</span><strong>${progress.practiceNotes} 次</strong></li>
      <li><span>练习轮次</span><strong>${progress.practiceSessions} 轮</strong></li>
      <li><span>学习日</span><strong>${progress.activityDays.length} 天</strong></li>
      <li><span>备份时间</span><strong>${escapeHtml(formatDateTime(progress.updatedAt))}</strong></li>
    </ul>
    ${warnings.length ? `<div class="notice">${warnings.map(item => escapeHtml(item)).join('<br>')}</div>` : ''}
    <p class="side-note">导入不会删除当前数据，直到你确认覆盖。</p>
  </div>`;
}

export function renderStorageInfo() {
  return `<div class="storage-info">
    <p>KeyLab 默认只使用浏览器 <code>localStorage</code> 保存学习记录。清除站点数据、使用无痕模式或更换设备都会导致进度看不到。</p>
    <ul>
      <li>不会上传任何学习记录或个人信息。</li>
      <li>导出文件是可读 JSON，可以自行备份。</li>
      <li>导入时会校验结构；文件中的任何脚本都不会被执行。</li>
      <li>不同设备之间不会自动同步。</li>
    </ul>
  </div>`;
}
