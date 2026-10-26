# 第三方声明（THIRD_PARTY_NOTICES）

本仓库 **不包含任何第三方运行时代码、字体、音频样本或图标素材**。运行时仅使用浏览器内置 API（Web Audio、Web MIDI、`localStorage`、Service Worker、ES Module），无 `npm install`、无 CDN 依赖，代码均为 KeyLab 原创，受根目录 `LICENSE`（MIT）覆盖。

## 已引入的内容数据（CC0-1.0 公有领域）

以下内容数据来自开源项目的课程内容目录，其许可证为 CC0-1.0（作者放弃著作权、进入公有领域），因此可直接转写使用：

### Pianio

- **来源**：<https://github.com/ismaelponce/pianio>
- **许可**：代码为 MIT；`content/` 目录（课程与练习内容）为 **CC0-1.0（公有领域）**。
- **本仓库使用部分**：仅 `content/` 目录中练习的**结构化数据**（音名+时值的 `measures`、双手、谱号、拍号、BPM、力度、来源标注）。
- **导入方式**：`scripts/import-pianio.mjs` 读取后转写为 `src/data/pianio-content.js`；`scripts/build-curriculum.mjs` 从中精选曲目与技巧，转写为课程数据 `src/data/curriculum-extras.js`。中文名与教学文案为 KeyLab 原创。
- **未使用部分**：Pianio 的 React/TypeScript 代码、UI、音频采样均未引入。

## 计划复用（尚未引入，需先审许可证）

以下项目的代码与素材尚未引入，若未来引入会在此处补充来源、版本、许可证与版权声明：

- [dacapo](https://github.com/ya-luotao/dacapo)（MIT 代码；依赖 Verovio / VexFlow / Bravura 等各自带许可）
- [Pianio](https://github.com/ismaelponce/pianio) 的代码（MIT）与音频采样

在完成审查前，**不会**把它们的任何代码、字体、音频、乐谱或图标复制进本仓库。
