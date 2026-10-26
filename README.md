# KeyLab · 互动音乐与 MIDI 学习平台

一个中文优先、免费、开源、移动端优先（iPad / iPhone 优先）的互动音乐学习网站，覆盖音乐乐理与 MIDI 学习。当前版本零构建依赖、无第三方 JavaScript，可直接部署到 GitHub Pages。

> **当前版本：0.3.0-beta（测试版）**。64 节课程（14 节基础 + 30 首入门曲目 + 20 条手指技巧）、真五线谱、真实钢琴采样、曲目节奏判分、练耳训练、曲目熟练度、统一 MIDI 事件管线与 132 项单元测试已完成；SMK-37 PRO 与 iPad / iPhone 尚未实机验证，原生 Core MIDI 桥接仅预留适配器、未实现。详见 [CHANGELOG](CHANGELOG.md)。

## 功能

- **64 节互动课程**：A 认识键盘、B 音高与音程、C 音阶、D 和弦、E 节奏、F 五线谱、G MIDI 入门 7 个基础模块，加 H 入门曲目（30 首经典曲）、I 手指技巧（20 条），共 9 个模块。曲目与技巧采用「等待模式」判分（弹错不重置、弹对当前音再前进）。
- **五种任务类型**：顺序按键（sequence）、同时按住（together）、节奏跟随（rhythm）、看谱弹奏（staff）、曲目跟弹（wait）；答错会说明实际音与目标音的关系。
- **可交互虚拟键盘**：37 键可视化键盘，真实钢琴采样发声（Salamander Grand Piano）；方向键可演奏，空格/回车触发。
- **乐理练习**：音符、音程、音阶与和弦、MIDI 四类加混合练习，含「在键盘上弹出」的题目；答题后显示解释。
- **练耳训练**：音程、和弦、旋律走向三类听辨，播放声音后四选一作答，独立记录听辨正确率。
- **曲目完整五线谱**：真五线谱（拍号/调号/小节线/时值/附点/休止符/升降号/和弦/低音谱号），曲目练习页直接看谱弹奏。
- **曲目节奏判分与熟练度**：按 `measures` 时值 + 真实时间戳判节奏准确率；每首曲目独立记录练习次数与最好成绩，显示 1–5 星熟练度。
- **延音踏板与练习报告**：CC64 延音踏板支持；完成练习后显示力度均匀度、节奏稳定度等测量报告。
- **MIDI 实验室**：能力检测、设备选择、事件日志（含原始字节）、按音状态面板、CC Learn、设备观察清单、JSON/CSV 导出。
- **统一 MIDI 事件管线**：虚拟键盘、计算机键盘、Web MIDI 与未来原生桥接先规范化为统一事件再判分；来源被显式标注，不伪装连接状态。
- **本地优先**：进度保存在 `localStorage`（v2 schema），支持 JSON 导出/导入与校验，无需账号、不上传数据。
- **PWA / 离线缓存**：Service Worker 版本化缓存全部模块；HTTPS 首次打开后可离线使用。
- **自动化测试**：132 项单元测试；GitHub Pages 部署前先跑测试。

## 本地运行

Web MIDI 与 Service Worker 需要安全上下文，推荐通过 localhost 运行，不要直接双击 `index.html`。

```bash
cd keylab
python -m http.server 4173
```

然后访问 <http://localhost:4173>。

也可以运行测试：

```bash
node --test        # 或 npm test
node --check src/app.js
```

本项目没有 `npm install` 步骤，也不需要构建。

## 部署到 GitHub Pages

1. 新建 GitHub 仓库（如 `keylab`），把本目录所有文件提交到 `main` 分支。
2. 在仓库 Settings → Pages 中，把 Build and deployment 的来源设为 **GitHub Actions**。
3. 推送到 `main` 后，`.github/workflows/pages.yml` 会先运行 `node --test`，通过后自动部署。
4. 从 Pages 设置页面打开站点。HTTPS 是 Web MIDI（支持的浏览器）与 PWA 缓存的必要条件。

## iPad / iPhone 现在可用什么

- ✅ 课程、乐理测验、虚拟键盘发声（真实钢琴采样）、节奏练习、本地进度与导出/导入。
- ✅ 添加主屏幕（PWA）后的离线缓存。

## 真实 MIDI 连接还缺什么

- ❌ **iOS / iPadOS Safari 不提供 Web MIDI API**，网页无法直接读取 SMK-37 PRO 的 USB/蓝牙 MIDI 输入；「添加到主屏幕」不会获得原生 MIDI 能力。
- ❌ 页面会做能力检测：浏览器没有 `navigator.requestMIDIAccess` 时，MIDI 实验室会明确显示限制，不会伪装成已连接。
- ✅ 在支持 Web MIDI 的桌面浏览器中，可用 MIDI 实验室测试真实输入。
- ⏳ **SMK-37 PRO 尚未实机验证**：音符范围、八度、力度、CC、Pitch Bend、USB/蓝牙行为均待实测。
- 下一阶段若要让 iPad 稳定连接实体键盘，需要原生 iOS / iPadOS 容器或 Core MIDI 桥接层；当前纯静态网页尚未实现此能力（仅预留适配器）。

## 技术结构

```text
index.html
├── src/core/      纯逻辑（乐理、判分、课程引擎、测验、节奏分析）
├── src/data/      课程与题库数据
├── src/midi/      MIDI 标准化、服务、设备档案、适配器
├── src/audio/     真实钢琴采样播放与节拍器（Salamander Grand Piano，CC-BY）
├── src/storage/   本地进度 v2 schema、迁移、导出/导入
├── src/ui/        纯渲染（视图、键盘、谱面、弹窗、格式化）
├── src/app.js     应用协调层
├── src/styles.css 响应式 UI
├── tests/         node:test 单元测试（132 项）
├── sw.js          版本化 Service Worker 缓存
├── manifest.webmanifest
├── assets/        图标资源
├── docs/          审计、路线图、MIDI 架构、测试报告
└── .github/workflows/pages.yml
```

- **Web Audio API**：播放真实钢琴采样（Salamander Grand Piano V2，Yamaha C5，CC-BY 3.0，作者 Alexander Holm）；采样未就绪时回退到振荡器合成。全部本地打包，无远程服务。
- **Web MIDI API**：能力检测后启用，`requestMIDIAccess({ sysex: false })`，不请求 SysEx 权限。
- **LocalStorage**：保存完成课程、答题统计、练习次数、连续天数与设置。

## MIDI 事件说明

- `Note On`：按下音符。
- `Note Off`：松开音符；部分设备发送 Velocity 为 0 的 Note On 表示松开（已统一处理）。
- `Velocity`：力度 1–127。
- `CC`：Control Change，常用于旋钮、推子、踏板。
- `Pitch Bend`：弯音。
- `Program Change` / 通道压力 / 复音压力 / 实时消息 / SysEx：已解析并在日志中展示。

## 36 / 37 键设备适配

KeyLab 虚拟键盘默认显示 37 键（C3–C6）。实际 SMK-37 PRO 的音高范围受设备当前八度设置影响，真实输入以 MIDI 音符编号为准。设备档案位于 `src/midi/device-profiles.js`，标注「等待实机验证」。

## 边界与免责

- 当前是基础课程原型，不是完整传统钢琴教材。
- 没有麦克风音高识别；没有 MIDI 输出到硬件、MIDI 文件导入/导出、云同步、账号系统。
- 虚拟键盘事件来源标为 `virtual`，不代表实体键盘已连接。
- 详细架构与限制见 `docs/MIDI_ARCHITECTURE.md`，路线见 `docs/ROADMAP.md`，测试见 `docs/TEST_REPORT.md`。

## 开源项目复用计划

建议先审查许可证再选择性复用：

- [dacapo](https://github.com/ya-luotao/dacapo)：参考乐理/识谱练习结构与中文学习路径。
- [Pianio](https://git.mitgai.net/ismaelponce/pianio)：评估课程引擎、练习判分与 MIDI 交互设计。

**不要把外部仓库的代码直接复制进来而不保留许可证和版权声明。** 当前仓库未引入任何第三方代码，MIT 许可证只覆盖本仓库原创内容。第三方声明见 `THIRD_PARTY_NOTICES.md`。
