# 第三方声明（THIRD_PARTY_NOTICES）

本仓库 **不包含任何第三方运行时代码、字体或图标素材**。运行时仅使用浏览器内置 API（Web Audio、Web MIDI、`localStorage`、Service Worker、ES Module），无 `npm install`、无 CDN 依赖，代码均为 KeyLab 原创，受根目录 `LICENSE`（MIT）覆盖。

## 已引入的第三方代码（MIT）

### VexFlow 4.2.5

- **来源**：<https://github.com/0xfe/vexflow>
- **内容**：五线谱与吉他谱渲染库。本仓库引入 `build/esm/entry/vexflow-bravura.js` 经 esbuild 打包为单文件 `vendor/vexflow.js`（约 555 KB minified），仅用于曲目/技巧练习的真五线谱渲染。
- **作者**：Mohit Muthanna Cheppudira
- **许可**：**MIT**（<https://github.com/0xfe/vexflow/blob/master/LICENSE>）
- **打包方式**：`npx esbuild node_modules/vexflow/build/esm/entry/vexflow-bravura.js --bundle --format=esm --minify`。构建产物直接提交到仓库，运行时无 npm 依赖、无构建步骤。
- **字体**：VexFlow 内嵌 Bravura 音乐字体数据，无外部字体文件。

## 已引入的音频采样（CC-BY 3.0）

### Salamander Grand Piano V2

- **来源**：<https://github.com/Tonejs/audio/tree/master/salamander>
- **内容**：Yamaha C5 三角钢琴采样，30 个采样点（A0–C8，小三度间隔），mp3 格式，共约 2 MB。
- **作者**：Alexander Holm
- **许可**：**CC-BY 3.0**（<https://creativecommons.org/licenses/by/3.0/>）——使用时须署名作者。
- **本仓库使用**：仅采样音频文件，存放于 `assets/piano/`，由 `src/audio/audio-engine.js` 通过 Web Audio 播放。
- **降级策略**：采样加载失败或尚未就绪时，回退到振荡器合成音，不影响发声。

## 已引入的内容数据（CC0-1.0 公有领域）

以下内容数据来自开源项目的课程内容目录，其许可证为 CC0-1.0（作者放弃著作权、进入公有领域），因此可直接转写使用：

### Pianio

- **来源**：<https://github.com/ismaelponce/pianio>
- **许可**：代码为 MIT；`content/` 目录（课程与练习内容）为 **CC0-1.0（公有领域）**。
- **本仓库使用部分**：仅 `content/` 目录中练习的**结构化数据**（音名+时值的 `measures`、双手、谱号、拍号、BPM、力度、来源标注）。
- **导入方式**：`scripts/import-pianio.mjs` 读取后转写为 `src/data/pianio-content.js`；`scripts/build-curriculum.mjs` 从中精选曲目与技巧，转写为课程数据 `src/data/curriculum-extras.js`。中文名与教学文案为 KeyLab 原创。
- **未使用部分**：Pianio 的 React/TypeScript 代码、UI 均未引入（其钢琴采样来自 Salamander Grand Piano，KeyLab 直接从 Tonejs/audio 仓库引入，见上文）。

## 计划复用（尚未引入，需先审许可证）

以下项目的代码与素材尚未引入，若未来引入会在此处补充来源、版本、许可证与版权声明：

- [dacapo](https://github.com/ya-luotao/dacapo)（MIT 代码；依赖 Verovio / VexFlow / Bravura 等各自带许可）
- [Pianio](https://github.com/ismaelponce/pianio) 的代码（MIT）

在完成审查前，**不会**把它们的任何代码、字体、音频、乐谱或图标复制进本仓库。
