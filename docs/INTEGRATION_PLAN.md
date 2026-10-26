# KeyLab 与 dacapo / Pianio 结合方案

> 本文记录「吸收 dacapo 与 Pianio 的长处、但保留 KeyLab 自己的 UI 与特色」的结论与执行计划。
> 更新日期：2026-10-27。对应版本：0.2.0-beta → 0.3.0。

## 1. 许可证结论（决定「能拿什么」）

| 项目 | 仓库 | 代码许可 | 内容/素材许可 | 结论 |
| --- | --- | --- | --- | --- |
| dacapo | `ya-luotao/dacapo` | MIT | 乐谱用公有领域曲目 + 开源库（Verovio/VexFlow，均自有许可） | 可复用代码，保留版权声明；**乐谱渲染技术可学，但库许可需单独审** |
| Pianio | `ismaelponce/pianio` | MIT（代码） | **`content/` 目录 CC0-1.0（公有领域）** | **课程内容可直接、无限制使用，连署名都非必需** |

**关键判断**：

- Pianio 的 `content/`（method + technique + songs 共 1557 题）是**公有领域**，可以直接转写进 KeyLab。这是「可以直接拿来用」的部分。
- dacapo 的**代码**是 MIT，可以借鉴算法与结构；但它依赖 Verovio / VexFlow / Bravura 字体等第三方库（各自带 LGPL/MIT/自有许可），**引入这些库前必须单独过一遍许可证**，并记录到 `THIRD_PARTY_NOTICES.md`。
- 三者都是「数据在本地、不上传」的产品观，与 KeyLab 一致，无理念冲突。

## 2. 三者的定位差异

| 维度 | KeyLab（0.2.0-beta） | dacapo（0.2.0） | Pianio |
| --- | --- | --- | --- |
| 目标 | 中文优先、移动端优先的乐理 + MIDI 入门 | 真五线谱上的钢琴练习（识谱优先） | 免费钢琴学习（课程内容库） |
| 乐谱 | 只有 1 课看谱，简单谱面 | **真五线谱**（Verovio/VexFlow 雕刻） | 结构化 measures（音名+时值），无雕刻 |
| 判分 | sequence/together/rhythm/staff，正确性为主 | 正确性 + **力度、时值、踏板、均匀度** | 无判分（纯内容） |
| 内容量 | 14 课 | 15 课 + 31 首曲目 | **1557 题**（教程/技巧/曲目） |
| 特色 | MIDI 实验室、CC Learn、设备档案 | **弱点热力图**、练耳、音阶均匀度、教师作业 | 分级课程路径 |
| 技术栈 | 零依赖 ES Module，无构建 | React + Vite + TS + Verovio/VexFlow | React + Vite + TS |

## 3. 结合思路：各取所长，KeyLab 做壳

**一句话**：Pianio 的内容（CC0 题库）填进 KeyLab，dacapo 的能力（真谱渲染 + 测量判分）作为 KeyLab 的「下一步能力」逐步学过来，但 UI、交互、中文、移动端、MIDI 实验室、设备档案等 KeyLab 已有的特色全部保留并继续强化。

### 3.1 从 Pianio 直接拿（CC0，可直接转写）

- **曲目库**：`content/songs` 8 个分类 165 题（入门/民谣/节日/赞美诗/中级/爵士蓝调/进阶/专业），含《欢乐颂》《小星星》等。
- **技巧练习**：`content/technique` 695 题（音阶、琶音，Level 1–6，含左右手、力度、BPM）。
- **方法教程**：`content/method` 697 题（分级识谱、节奏训练）。
- 数据形态是 `measures: [["C4:q","C4:q",...], ...]`，可直接映射到 KeyLab 的 `task` 结构。

### 3.2 从 dacapo 学（MIT，借鉴算法与结构，不抄库）

- **真五线谱渲染**：KeyLab 的 `src/ui/staff.js` 目前是简化谱面，可评估引入 VexFlow（MIT）实现真谱。
- **测量判分**：dacapo 的 `evenness`（力度/时值/连奏均匀度）、`expression`（踏板）、`tempoLadder`（渐快阶梯）等，是把「弹对了」升级为「弹得好」的关键。
- **弱点热力图**：把练错的音在谱面/键盘上高亮，是识谱学习的杀手级反馈。
- **练耳**：音程/和弦/旋律/节奏听辨，KeyLab 目前没有。

### 3.3 KeyLab 自己的特色（保留并强化）

- 中文优先、移动端优先、零依赖可离线、MIDI 实验室、CC Learn、设备档案、来源显式标注——这些是 KeyLab 的护城河，**不被 dacapo 的 React 技术栈替代**。

## 4. 优化点（当前 KeyLab 的问题，结合后要一起解）

1. **识谱是最大短板**：F 模块只有 1 课。结合后应引入低音谱号、升降号、拍号、附点、休止符，并用 Pianio 的分级曲目做实谱练习。
2. **谱面渲染**：`src/ui/staff.js` 太简化，无法承载 Pianio 的真实曲目。需升级（VexFlow 或自绘 SVG）。
3. **判分维度**：只有正确/错误，没有力度、时值、均匀度。学 dacapo 加「弹得准不准、稳不稳」。
4. **音色**：Web Audio 合成音无力度分级。可评估引入真实钢琴采样（如 Pianio 用的 Salamander Grand，CC-BY）。
5. **内容组织**：14 课是「散点」，缺一条像 Pianio 那样的分级学习路径（Level 1–6）。

## 5. 执行阶段

### 阶段 A（纯本地、无真机、无第三方库，立即可做）—— ✅ 已完成（2026-10-27）

1. **建 Pianio 题库导入器**：`scripts/import-pianio.mjs` 读取 Pianio `content/*.json`，转写为 `src/data/pianio-content.js`（165 首曲目 + 695 条技巧）。
2. **新增「曲目」与「技巧」两大模块**：`scripts/build-curriculum.mjs` 精选 30 首入门曲（H）+ 20 条 Level-1 技巧（I），转写为课程数据 `src/data/curriculum-extras.js`，合并进 `LESSONS`，课程总数 14 → 64。
3. **判分 `wait` 模式**：新增到 `task-matcher.js`，弹错不重置、弹对当前音再前进，用于曲目跟弹。
4. **UI Claude 暖色系迁移**：暖米白底 + 陶土橙主色，更新 manifest、图标、Service Worker 缓存版本。
5. 更新 `THIRD_PARTY_NOTICES.md`、`README`、`CHANGELOG`、`ROADMAP`，注明 CC0 来源。
6. **扩充五线谱模块（F）**：低音谱号、升降号、拍号——并入阶段 B（需真谱渲染支持）。

### 阶段 B（引入 VexFlow，真谱渲染，无真机）

### 阶段 B（引入 VexFlow，真谱渲染，无真机）

5. 引入 VexFlow（MIT，审许可后记录），重写 `src/ui/staff.js` 支持真实谱面。
6. 把 Pianio 的 `measures` 渲染成真谱，曲目练习升级为「等待模式」（弹对才前进）。

### 阶段 C（测量判分，学 dacapo，无真机）

7. 力度、时值、均匀度测量；弱点热力图；练耳模块。

### 阶段 D（需真机，不在本阶段）

8. SMK-37 PRO 实机验证；iOS 原生 Core MIDI 桥接。

## 6. 明确不做 / 需谨慎

- **不直接复制 dacapo 的 React 代码**：技术栈不同，只借鉴算法思路，重写进 KeyLab 的零依赖架构。
- **不引入第三方库而不审许可**：VexFlow、钢琴采样等都要先看许可证，记录到 `THIRD_PARTY_NOTICES.md`。
- **不声称已支持未验证的硬件**：延续 KeyLab「来源显式标注、不伪装连接」的原则。
