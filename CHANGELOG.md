# Changelog

## 0.4.0-beta — 2026-10-27（测试版）

**主题：面向零基础的教学优化——实践驱动、手把手、不劝退。**

- **反馈升级**：错误提示从「高 N 个半音」术语堆砌，改为「往左/往右找（离目标很近）」的空间方向引导（`friendlyPitchHint`）；正确反馈「对！X」、完成反馈「太棒了！你完整弹出了 X」。
- **连击统计**：连续正确累加、弹错归零、保留峰值；练习界面显示「🔥 连击 ×N」。
- **实践优先**：课程详情页「练一练」移到最前，讲解折叠为「为什么」放后面——先弹后懂。
- **首课即胜**：第 1 课「黑键分组」从 5 音精简到 2 音，保证 10 分钟内一次通过。
- **三档难度**：青铜（练习，弹错不重置）/ 白银（标准）/ 黄金（挑战，争取一次通过），默认青铜。
- **键盘引导跟弹**：下一个要弹的音在虚拟键盘上脉冲高亮，按对自动移到下一个——不用看谱也能跟弹（瀑布流核心价值）。
- **识谱地标法**：五线谱课改为「记 3 个地标，别逐线数」，治「数格子」这个 90% 成人弃学主因。
- **能力感里程碑**：首页 hero 根据进度显示「你现在能弹出和弦了」等能力反馈，而非干巴巴的完成数。
- **乐理准确性核查**：音程/音阶/和弦/MIDI 编号/频率/黑键全部核对正确。
- 新增 `docs/BEGINNER_PLAN.md`（零基础优化方案：现状诊断 + 商业借鉴 + 教学法研究 + 分阶段执行）。

## 0.3.0-beta — 2026-10-27（测试版）

**主题：从「弹对」到「弹好」，并补齐听辨与曲目熟练度。**

- **真五线谱渲染**：引入 VexFlow 4.2.5（MIT，esbuild 打包为 `vendor/vexflow.js` 单文件），重写 `src/ui/staff.js`。曲目/技巧练习页显示完整五线谱（拍号/调号/小节线/时值/附点/休止符/升降号/和弦/低音谱号），`measures`/`clef`/`timeSignature` 完整接入。
- **真实钢琴音色**：Salamander Grand Piano V2 采样（Yamaha C5，CC-BY 3.0，作者 Alexander Holm），打包进 `assets/piano/`，采样播放 + `playbackRate` 移调，未就绪回退振荡器。
- **延音踏板（CC64）**：踩下踏板时音符保持，松开后释放。
- **练习报告**：`src/core/practice-report.js` 输出力度均匀度、平均力度、节奏稳定度（±毫秒）。
- **曲目节奏判分**：`src/core/piece-rhythm.js` 用 `measures` 时值 + 真实按键时间戳，输出每个音的节奏偏差与节奏准确率。
- **练耳训练**：新增「练耳」视图（音程/和弦/旋律走向听辨，带播放与四选一判分），`src/core/ear-engine.js`。
- **曲目熟练度**：`src/core/piece-mastery.js` 独立记录每首曲目的练习次数、最好节奏准确率与最好力度均匀度，计算 1–5 星熟练度，显示在曲目列表与练习页。
- **示范音不再截断**：完整播放 + 自适应间隔。
- 单元测试 105 → 132（新增 practice-report 7、piece-rhythm 9、ear-engine 6、piece-mastery 5）。

## 0.2.2-beta — 2026-10-27（测试版）

- **真五线谱渲染**：引入 VexFlow 4.2.5（MIT，打包为 `vendor/vexflow.js` 单文件），重写 `src/ui/staff.js`。
  - 曲目/技巧练习页现在显示完整五线谱：拍号、调号、小节线、时值、附点、休止符、升降号、和弦、低音谱号。
  - 曲目 `measures` / `clef` / `timeSignature` 完整数据接入（之前只取了旋律音）。
- `scripts/build-curriculum.mjs` 补充 `measures`/`clef`/`timeSignature` 字段。
- Service Worker 缓存版本升到 v5（预缓存 `vendor/vexflow.js`）。
- 新增 `docs/NEXT_UP.md`（后续优化清单）。

## 0.2.1-beta — 2026-10-27（测试版）

- **真实钢琴音色**：引入 Salamander Grand Piano V2 采样（Yamaha C5，CC-BY 3.0，作者 Alexander Holm，30 个采样点约 2 MB），打包进 `assets/piano/`，重写 `audio-engine.js` 用采样播放 + `playbackRate` 移调；采样未就绪时回退到振荡器合成音。
- 新增 `loadSamples()` 后台预加载，`init()` 时自动启动。
- Service Worker 缓存版本升到 v4；`THIRD_PARTY_NOTICES.md` 记录采样来源与 CC-BY 署名。

## 0.2.1-beta — 2026-10-27（测试版，阶段 A）

- 新增 H「入门曲目」模块（30 首经典曲）与 I「手指技巧」模块（20 条 Level-1 技巧），课程总数 14 → 64。
- 曲目与技巧数据转写自 Pianio 的 `content/` 目录（CC0-1.0 公有领域）；中文名与教学文案为 KeyLab 原创。
- 判分引擎新增 `wait` 模式：弹错只提示实际音与目标音的关系、不重置进度，弹对当前音再前进，用于曲目跟弹。
- 新增 `scripts/import-pianio.mjs`（题库导入）与 `scripts/build-curriculum.mjs`（课程生成）。
- UI 配色迁移为 Claude 暖色系：暖米白底 + 陶土橙主色 + 暖棕黑文字，收敛圆角与阴影。
- 单元测试 103 → 105 项（新增 wait 模式测试）。
- 更新 `THIRD_PARTY_NOTICES.md`，记录 Pianio CC0 内容来源。

## 0.2.0-beta — 2026-10-27（测试版）

> 测试版说明：14 节课程、统一 MIDI 事件管线、进度 v2 schema 与 103 项单元测试已完成；SMK-37 PRO 与 iPad / iPhone 尚未实机验证，原生 Core MIDI 桥接仅预留适配器、未实现。

- 课程从 6 节扩展到 14 节，覆盖 A–G 七个模块（键盘、音程、音阶、和弦、节奏、五线谱、MIDI）。
- 任务类型扩展为 sequence / together / rhythm / staff，答错说明实际音与目标音的关系。
- 重写为模块化架构：`src/core`（纯逻辑）、`src/data`、`src/midi`、`src/audio`、`src/storage`、`src/ui`、`src/app.js` 协调层。
- 统一 MIDI 事件管线：虚拟键盘、计算机键盘、Web MIDI、未来原生桥接走同一判分路径，来源显式标注。
- 新增设备档案（SMK-37 PRO，标记「等待实机验证」）、按音状态面板、CC Learn、设备观察清单、日志导出。
- 新增节拍器与真实时间戳节奏分析。
- 进度升级到 v2 schema，含 v1 自动迁移、连续学习天数、JSON 导出/导入（校验 + 预览）。
- 无障碍与移动端：跳过链接、方向键演奏、局部 live region、44px 触摸目标、safe-area、prefers-reduced-motion。
- 新增 103 项单元测试；`pages.yml` 部署前先运行 `node --test`。
- Service Worker 版本化缓存，预缓存全部模块；新增更新提示条。
- 新增文档：`docs/PROJECT_AUDIT.md`、`docs/ROADMAP.md`、`docs/MIDI_ARCHITECTURE.md`、`docs/TEST_REPORT.md`、`THIRD_PARTY_NOTICES.md`。

## 0.1.0 — 2026-10-26

- Initial mobile-first Chinese MVP.
- Added six interactive beginner lessons and lesson completion tracking.
- Added quiz categories for notes, intervals, chords/scales and MIDI.
- Added a 37-key virtual keyboard with Web Audio synthesis.
- Added feature-detected Web MIDI input, event log and CC / Pitch Bend display.
- Added local progress storage, PWA metadata, service-worker caching and GitHub Pages workflow.
- Documented iOS/iPadOS Safari Web MIDI limitations and future native bridge requirements.
