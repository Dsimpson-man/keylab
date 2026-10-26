# KeyLab MIDI 架构

> 本文说明 KeyLab 0.2.0 的 MIDI 输入架构、事件模型、设备档案与原生桥接预留，以及哪些能力尚未实机验证。

## 1. 设计原则

1. **单一事件管线**：无论输入来自虚拟键盘、计算机键盘、Web MIDI 还是未来的原生桥接，都先规范化为统一事件，再进入判分与 UI。
2. **来源显式标注**：每个事件都带 `source`（`virtual` / `computer` / `webmidi` / `native` / `unknown`），UI 据此区分「本机模拟」与「实体硬件」，绝不伪装连接状态。
3. **能力检测优先**：先检测 `navigator.requestMIDIAccess`，不支持时明确说明限制，不显示虚假的连接。

## 2. 目录与职责

```text
src/midi/
├── midi-normalizer.js      解析 MIDI 字节、构造统一事件、描述事件与来源
├── midi-service.js         事件汇入、按音状态跟踪、设备选择、日志、报告
├── device-profiles.js      设备档案（SMK-37 PRO 等）与默认键盘范围
├── web-midi-adapter.js     浏览器 Web MIDI 适配器（能力检测、权限、设备同步）
├── simulated-midi-adapter.js 虚拟/计算机键盘输入的模拟事件源
└── native-bridge-adapter.js  原生 Core MIDI 桥接预留（未实现）
```

## 3. 统一事件模型

`midi-normalizer.js` 定义：

- `EVENT_TYPES`：`note-on`、`note-off`、`control-change`、`pitch-bend`、`program-change`、`channel-pressure`、`poly-pressure`、`realtime`、`sysex`、`unknown`。
- `SOURCE_LABELS`：把 `virtual` / `computer` / `webmidi` / `native` / `unknown` 映射为中文标签。
- `createEvent` / `makeNoteEvent`：构造事件，`makeNoteEvent` 统一处理 `velocity === 0` 的 Note On 视为 Note Off。
- `parseMidiMessage(data)`：解析 `[status, ...]` 字节流，覆盖 Note On/Off、CC、Pitch Bend、Program Change、通道压力、复音压力、实时消息（0xF8+）与 SysEx。
- `virtualNoteBytes`：虚拟输入生成的规范字节（便于教学展示，来源仍标 `virtual`）。
- `describeEvent` / `eventTypeLabel` / `hexBytes`：日志与展示。

## 4. 事件服务（`midi-service.js`）

`MidiService` 负责：

- `ingest(event)`：统一入口，按 `source:device:note` 跟踪按音状态。
- `getHeldNotes()` / `hasHeld()`：当前按住列表。
- `releaseAll(source?)` / `selectInput()`：设备切换或断开时，释放旧来源的全部按音，避免卡音/卡高亮。
- `setLogPaused` / `setInputs` / `clearEvents` / `setEventLogLimit`：日志控制。
- `statusSummary()` / `deviceReport()`：连接状态与设备报告。
- 通过 `EventBus` 发出 `midi:event`、`note:on`、`note:off`、`control:change`、`pitch:bend`、`held:change`、`device:disconnected`、`inputs:change`、`selection:change`。

## 5. 设备档案（`device-profiles.js`）

- `DEVICE_PROFILES` 目前包含 `m-vave-smk-37-pro`，字段含 `verified: false`、`statusLabel: '等待实机验证'`、`assumptions`（常见假设）、`observationChecklist`（实机观察清单）、`notes`。
- `matchProfile(name)`：按设备名子串匹配档案。
- `DEFAULT_KEYBOARD_RANGE`：默认 37 键范围。

> **重要**：SMK-37 PRO 尚未实机验证。37 键与 C3–C6 只是常见假设；实际音符范围受设备当前八度设置影响，真实输入以 MIDI 音符编号为准。

## 6. 适配器

### 6.1 Web MIDI（`web-midi-adapter.js`）

- `connect()`：调用 `navigator.requestMIDIAccess({ sysex: false })`，处理拒绝与不安全上下文。
- `_syncInputs()`：同步输入设备列表与连接状态。
- `selectInput(id)`：切换输入；切换会释放旧设备按音。
- `_handleMessage()`：把原始字节交给 `parseMidiMessage`，再 `ingest`。
- `dispose()` / `isSupported()`。

### 6.2 模拟输入（`simulated-midi-adapter.js`）

- `note()` / `controlChange()` / `pitchBend()`：虚拟键盘与计算机键盘使用，来源固定为 `virtual` / `computer`。

### 6.3 原生桥接（`native-bridge-adapter.js`，预留）

- 安装 `window.KeyLabNativeMIDI` 接收入口。
- `NATIVE_PROTOCOL_VERSION = 1`。
- `describeAvailability()`：报告当前不可用。
- **尚未实现**真实 Core MIDI 数据通路；仅作为 iOS / iPadOS 原生容器的接入点预留。

## 7. 关键限制

1. **iOS / iPadOS Safari 不提供 Web MIDI**：系统级限制，网页代码无法绕过。0.2.0 只保证虚拟键盘、课程、测验、进度可用，并预留原生桥接，不显示虚假连接。
2. **无 SMK-37 PRO 实机**：音符范围、八度、力度曲线、CC、Pitch Bend、USB/蓝牙行为均未验证。
3. **音频需用户手势解锁**：首次触摸后稳定发声；iOS 静音与后台切换影响需实机确认。
4. **无 MIDI 输出**：当前只做输入监听与教学判分，不向硬件发送数据。
