# 第三方声明（THIRD_PARTY_NOTICES）

本仓库当前 **不包含任何第三方代码、字体、音频样本、乐谱或图标素材**。全部代码与素材均为 KeyLab 原创，受根目录 `LICENSE`（MIT License）覆盖。

## 说明

- KeyLab 0.2.0 是零构建依赖的静态站点，没有 `npm install` 步骤，也不通过 CDN 引入脚本、样式或字体。
- 运行时仅使用浏览器内置 API：Web Audio、Web MIDI（能力检测）、`localStorage`、Service Worker、ES Module。
- 开发依赖仅使用 Node.js 内置的 `node:test` 与 `node:assert/strict`，无第三方测试框架。

## 计划复用（尚未引入）

以下开源项目在路线图中被列为「待许可证审查后选择性复用」：

- [dacapo](https://github.com/ya-luotao/dacapo)
- [Pianio](https://git.mitgai.net/ismaelponce/pianio)

在完成许可证与素材授权审查前，**不会**把它们的任何代码、课程、乐谱、字体、音频或图标复制进本仓库。若未来引入，会在此文件中补充每个来源的名称、版本、许可证类型与版权声明，并确保与 `LICENSE` 的 MIT 覆盖边界清晰区分。
