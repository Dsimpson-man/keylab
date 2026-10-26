# KeyLab 测试报告

- 测试日期：2026-10-27
- 测试版本：0.2.0-beta
- 测试方式：Node 内置 `node:test` + `node:assert/strict`，浏览器冒烟用 Playwright（MCP）。

## 1. 单元测试

运行命令：

```bash
npm test
# 等价于
node --test
```

结果：**103 通过 / 0 失败 / 0 跳过**。

| 测试文件 | 覆盖内容 | 结果 |
| --- | --- | --- |
| `tests/music-theory.test.js` | 音名、八度、命名习惯、音程、音阶、和弦、边界校验 | 通过 |
| `tests/task-matcher.test.js` | 顺序/同时按/观察松开任务、重启语义、错误反馈 | 通过 |
| `tests/lesson-engine.test.js` | 课程引擎状态流转与非节奏外壳 | 通过 |
| `tests/quiz-engine.test.js` | 洗牌、答题、播放题匹配、会话摘要 | 通过 |
| `tests/progress-store.test.js` | v1→v2 迁移、导出/导入校验、连续天数、正确率 | 通过 |
| `tests/midi-normalizer.test.js` | 字节解析、事件构造、来源标签、velocity-0 视为松开 | 通过 |
| `tests/midi-service.test.js` | 按音跟踪、设备断开释放、日志上限、报告 | 通过 |
| `tests/rhythm-analyzer.test.js` | 拍点网格、贪婪匹配、早/晚标记、误差与稳定性 | 通过 |
| `tests/lessons.test.js` | 课程数据完整性、模块分组、下一课查找 | 通过 |

完整输出（节选）：

```text
ℹ tests 103
ℹ pass 103
ℹ fail 0
```

## 2. 浏览器冒烟测试

通过 Playwright 访问本地静态服务，确认：

- 首页渲染 7 个模块芯片，导航计数为 `0/14`，标题为「学习概览」。
- 5 个视图（概览 / 课程 / 练习 / MIDI 实验室 / 学习记录）均可渲染，控制台 0 个 JS 错误。
- 唯一警告为弃用的 `apple-mobile-web-app-capable` meta（已在 `index.html` 中补充 `mobile-web-app-capable` 修正）。

## 3. 未验证项

- **SMK-37 PRO 实机**：音符范围、八度、力度、CC、Pitch Bend、USB/蓝牙均未验证。
- **iPad / iPhone 实机**：音频解锁、静音开关、后台切换、触控体验未验证。
- **原生 Core MIDI 桥接**：尚未实现，仅预留适配器。

## 4. 结论

0.2.0 的核心逻辑（乐理、判分、进度、MIDI 标准化、节奏分析）已由单元测试覆盖并通过；静态站点可在本地正常加载。实体 MIDI 与 iOS 实机能力仍需真机验证，不属于「已完成」范围。
