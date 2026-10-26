# Changelog

## 0.2.1-beta — 2026-10-27（测试版）

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
