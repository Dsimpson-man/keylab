# KeyLab 接下来要优化的东西（NEXT_UP）

> 更新日期：2026-10-27。对应版本：0.3.0-beta。本文是「接下来做什么」的活文档。

> **零基础优化专项**：见 [BEGINNER_PLAN.md](./BEGINNER_PLAN.md) —— 面向零基础用户的教学内容、教学方式（实践驱动、反馈、游戏化）与商业借鉴的完整方案。这是下一阶段（0.4.0）的核心方向。

## 一、当前已完成（0.3.0-beta）

- 阶段 A（Pianio CC0 内容导入）：课程 14 → 64 课，`wait` 判分模式，Claude 暖色 UI。
- 真实钢琴音色：Salamander Grand Piano V2 采样（CC-BY）。
- 真五线谱渲染：VexFlow，曲目/技巧练习页显示完整谱（拍号/时值/附点/休止符/和弦/低音谱号）。
- 延音踏板（CC64）。
- 练习报告：力度均匀度、节奏稳定度。
- 曲目节奏判分：`measures` 时值 + 真实时间戳，输出节奏准确率。
- 练耳训练：音程/和弦/旋律走向听辨。
- 曲目熟练度：每首曲目独立记录练习次数与最好成绩，1–5 星。
- 示范音完整播放。

## 二、待优化（按优先级）

### 第一梯队：需真机验证（当前无 SMK-37 PRO 与 iPad/iPhone）

| # | 问题 | 状态 |
| --- | --- | --- |
| 1 | SMK-37 PRO 实机：音符范围、八度、力度、CC、Pitch Bend、USB/蓝牙 | ⏳ 待实机 |
| 2 | iPad/iPhone 实机：音频解锁、静音开关、后台切换、触控 | ⏳ 待实机 |
| 3 | 原生 iOS Core MIDI 桥接（0.3.0 规划中的原生容器） | ⏳ 需 macOS+Xcode+实机 |

### 第二梯队：音乐性进阶（无需真机，可继续做）

| # | 问题 | 说明 |
| --- | --- | --- |
| 4 | tempoLadder（渐快阶梯） | dacapo 的进阶练习：从慢速逐步提速 |
| 5 | 分小节测量 | 当前节奏判分是整首的，可细化到逐小节 |
| 6 | 力度/时值纳入曲目判分 | 左手伴奏、和弦、节奏时值还未进判分逻辑 |

### 第三梯队：内容扩展

| # | 问题 | 说明 |
| --- | --- | --- |
| 7 | 更多曲目（folk/holiday/hymns/intermediate） | 已导入 165 首全量，当前只落地 beginner 30 首，可继续扩展 |
| 8 | 更多技巧（Level 2+） | 已导入 695 条全量，当前只落地 Level-1 20 条 |

### 明确不做（ROADMAP 已定）

MIDI 输出到硬件、麦克风音高识别、账号/云同步、MIDI 文件导入导出。

## 三、技术决策记录

- **VexFlow 4.2.5**（MIT，Mohit Muthanna Cheppudira 版权所有）：esbuild 打包 `build/esm/entry/vexflow-bravura.js` 为单文件 `vendor/vexflow.js`（~555KB），运行时零构建、零 npm install。
- **Salamander Grand Piano V2**（CC-BY 3.0，Alexander Holm）：采样打包进 `assets/piano/`。
- 后续引入任何第三方代码/字体，都先审许可证、记录到 `THIRD_PARTY_NOTICES.md`。
