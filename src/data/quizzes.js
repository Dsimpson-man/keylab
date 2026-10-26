/**
 * 乐理题库。
 *
 * 题型：
 * - choice：四选一，答案与解释必须与音乐理论一致。
 * - play：在键盘上实际弹出（虚拟键盘或 MIDI 键盘均可），与课程共用规范化输入。
 */

export const QUIZ_CATEGORIES = Object.freeze([
  { id: 'notes', icon: '♫', title: '音符与音名', description: '七个音名、中央 C、音名顺序与 MIDI 编号。' },
  { id: 'intervals', icon: '↔', title: '音程与音高', description: '半音、全音、三度、五度与八度。' },
  { id: 'chords', icon: '▰', title: '音阶与和弦', description: 'C 大调、G 大调、大三和弦与小三和弦。' },
  { id: 'midi', icon: '⌁', title: 'MIDI 基础', description: 'Note On、Velocity、CC、通道与弯音。' }
]);

export const QUESTIONS = Object.freeze([
  // ---------- 音符与音名 ----------
  {
    id: 'notes-c-position',
    category: 'notes',
    type: 'choice',
    prompt: '两个黑键左侧紧挨着的白键是什么音？',
    options: ['A', 'C', 'E', 'G'],
    answer: 1,
    explanation: '两个黑键左侧的白键是 C。先找到黑键分组，就能定位整把键盘上的 C。'
  },
  {
    id: 'notes-order-a',
    category: 'notes',
    type: 'choice',
    prompt: 'C、D、E、F、G 后面接着是什么音名？',
    options: ['B', 'C', 'A', 'F'],
    answer: 2,
    explanation: '基本音名顺序是 C、D、E、F、G、A、B，然后进入下一个 C。'
  },
  {
    id: 'notes-solfege-mi',
    category: 'notes',
    type: 'choice',
    prompt: '在 C 大调中，唱名 Mi 对应哪个音名？',
    options: ['D', 'E', 'F', 'G'],
    answer: 1,
    explanation: 'C 大调的唱名顺序是 Do=C、Re=D、Mi=E、Fa=F、Sol=G、La=A、Si=B。'
  },
  {
    id: 'notes-middle-c',
    category: 'notes',
    type: 'choice',
    prompt: '按常见 MIDI 音高约定，中央 C（C4）是几号音？',
    options: ['48', '60', '69', '72'],
    answer: 1,
    explanation: '中央 C 通常对应 MIDI 60；A4 是 69，C5 是 72。个别设备的八度显示名称可能不同，但编号不变。'
  },
  {
    id: 'notes-after-b',
    category: 'notes',
    type: 'choice',
    prompt: 'B 右侧紧挨着的白键是哪个音？',
    options: ['A', 'C', 'D', 'F'],
    answer: 1,
    explanation: '音名到 B 之后回到 C。B 与右侧的 C 之间没有黑键，相差一个半音。'
  },
  {
    id: 'notes-solfege-sol',
    category: 'notes',
    type: 'choice',
    prompt: '在 C 大调中，唱名 Sol 对应哪个音名？',
    options: ['F', 'G', 'A', 'B'],
    answer: 1,
    explanation: 'C 大调中 Sol 对应 G。G 是 C 大调的第五级音，距离主音 C 七个半音。'
  },
  {
    id: 'play-notes-c',
    category: 'notes',
    type: 'play',
    mode: 'sequence',
    prompt: '在键盘上弹出 C4（中央 C）。',
    target: [60],
    labels: ['C4'],
    explanation: 'C4 就是中央 C，MIDI 编号 60。它是两个黑键左侧的白键。'
  },
  {
    id: 'play-notes-def',
    category: 'notes',
    type: 'play',
    mode: 'sequence',
    prompt: '按顺序弹出 D4、E4、F4。',
    target: [62, 64, 65],
    labels: ['D4', 'E4', 'F4'],
    explanation: 'D4、E4、F4 是 C4 右侧连续的白键；E 到 F 之间没有黑键，所以它们相差半音。'
  },

  // ---------- 音程与音高 ----------
  {
    id: 'intervals-c-csharp',
    category: 'intervals',
    type: 'choice',
    prompt: 'C 到 C♯ 相差多少？',
    options: ['半音', '全音', '纯五度', '八度'],
    answer: 0,
    explanation: '相邻琴键之间相差一个半音。C 到 C♯ 正好是一个半音。'
  },
  {
    id: 'intervals-e-f',
    category: 'intervals',
    type: 'choice',
    prompt: '以下哪一对自然音之间相差一个半音？',
    options: ['C 与 D', 'F 与 G', 'E 与 F', 'G 与 A'],
    answer: 2,
    explanation: 'E 与 F 之间没有黑键，所以相差一个半音。B 与 C 也是如此。'
  },
  {
    id: 'intervals-whole-tone',
    category: 'intervals',
    type: 'choice',
    prompt: '一个全音相当于多少个半音？',
    options: ['1 个', '2 个', '3 个', '12 个'],
    answer: 1,
    explanation: '一个全音等于两个半音。比如 C 到 D 会经过 C♯。'
  },
  {
    id: 'intervals-octave',
    category: 'intervals',
    type: 'choice',
    prompt: '从 C 到下一个 C 的距离称为什么？',
    options: ['半音', '全音', '八度', '三度'],
    answer: 2,
    explanation: '相邻两个同名音之间的距离叫八度，等于 12 个半音，频率比约为 2:1。'
  },
  {
    id: 'intervals-fifth',
    category: 'intervals',
    type: 'choice',
    prompt: 'C 到 G 是几个半音，叫什么音程？',
    options: ['5 个半音，纯四度', '7 个半音，纯五度', '4 个半音，大三度', '12 个半音，八度'],
    answer: 1,
    explanation: 'C 到 G 经过 7 个半音，是纯五度。它也是三和弦中根音到五音的距离。'
  },
  {
    id: 'intervals-major-third',
    category: 'intervals',
    type: 'choice',
    prompt: '大三度包含几个半音？',
    options: ['3 个', '4 个', '5 个', '7 个'],
    answer: 1,
    explanation: '大三度是 4 个半音，例如 C 到 E。小三度是 3 个半音，例如 A 到 C。'
  },
  {
    id: 'play-intervals-fifth',
    category: 'intervals',
    type: 'play',
    mode: 'sequence',
    prompt: '在键盘上依次弹出 C4 和 G4，听一听纯五度。',
    target: [60, 67],
    labels: ['C4', 'G4'],
    explanation: 'C4 到 G4 是 7 个半音，也就是纯五度。'
  },
  {
    id: 'play-intervals-third',
    category: 'intervals',
    type: 'play',
    mode: 'sequence',
    prompt: '在键盘上依次弹出 C4 和 E4，听一听大三度。',
    target: [60, 64],
    labels: ['C4', 'E4'],
    explanation: 'C4 到 E4 是 4 个半音，也就是大三度；它决定了大三和弦明亮的色彩。'
  },

  // ---------- 音阶与和弦 ----------
  {
    id: 'chords-c-major-triad',
    category: 'chords',
    type: 'choice',
    prompt: 'C 大三和弦由哪三个音组成？',
    options: ['C、D、G', 'C、E、G', 'C、F、A', 'A、C、E'],
    answer: 1,
    explanation: 'C 大三和弦的三个音是 C、E、G：根音、大三度、纯五度。'
  },
  {
    id: 'chords-a-minor-triad',
    category: 'chords',
    type: 'choice',
    prompt: 'A 小三和弦通常由哪三个音组成？',
    options: ['A、C、E', 'A、D、E', 'A、C♯、E', 'A、E、G♯'],
    answer: 0,
    explanation: 'A 小三和弦是 A、C、E。A、C♯、E 则是 A 大三和弦，区别只在三音。'
  },
  {
    id: 'chords-arpeggio',
    category: 'chords',
    type: 'choice',
    prompt: '把和弦中的音一个接一个弹出，通常叫什么？',
    options: ['颤音', '滑音', '琶音', '弯音'],
    answer: 2,
    explanation: '琶音是将和弦中的音按顺序依次演奏；同时按下则更接近柱式和弦。'
  },
  {
    id: 'chords-c-major-white',
    category: 'chords',
    type: 'choice',
    prompt: 'C 大调音阶主要使用哪些琴键？',
    options: ['所有黑键', '所有白键', '只用 C 和 G', '随机琴键'],
    answer: 1,
    explanation: 'C 大调音阶 C、D、E、F、G、A、B 在钢琴上全部是白键。'
  },
  {
    id: 'chords-a-major-third',
    category: 'chords',
    type: 'choice',
    prompt: 'A 大三和弦的中间音（三音）是哪一个？',
    options: ['C', 'C♯', 'E', 'F'],
    answer: 1,
    explanation: 'A 大三和弦是 A、C♯、E；A 小三和弦才是 A、C、E。三音相差一个半音。'
  },
  {
    id: 'chords-g-major-sharp',
    category: 'chords',
    type: 'choice',
    prompt: 'G 大调音阶中，哪一个音需要升高半音？',
    options: ['C', 'E', 'F', 'G'],
    answer: 2,
    explanation: 'G 大调是 G、A、B、C、D、E、F♯、G。为了保持「全全半全全全半」的结构，F 需要升高为 F♯。'
  },
  {
    id: 'play-chords-c-major',
    category: 'chords',
    type: 'play',
    mode: 'together',
    prompt: '同时按住 C4、E4、G4，弹出 C 大三和弦。',
    target: [60, 64, 67],
    labels: ['C4', 'E4', 'G4'],
    explanation: 'C、E、G 同时响起就是 C 大三和弦。'
  },
  {
    id: 'play-chords-a-minor',
    category: 'chords',
    type: 'play',
    mode: 'together',
    prompt: '同时按住 A3、C4、E4，弹出 A 小三和弦。',
    target: [57, 60, 64],
    labels: ['A3', 'C4', 'E4'],
    explanation: 'A、C、E 同时响起就是 A 小三和弦；把 C 换成 C♯ 会变成大三和弦。'
  },

  // ---------- MIDI 基础 ----------
  {
    id: 'midi-note-on',
    category: 'midi',
    type: 'choice',
    prompt: 'MIDI Note On 通常表示什么？',
    options: ['按下一个音符', '更换设备电池', '打开浏览器', '保存网页'],
    answer: 0,
    explanation: 'Note On 是一个音符开始演奏的事件。松开琴键通常会产生 Note Off。'
  },
  {
    id: 'midi-velocity',
    category: 'midi',
    type: 'choice',
    prompt: 'MIDI Velocity 通常描述什么？',
    options: ['键盘尺寸', '按键力度', '网络速度', '音符名称'],
    answer: 1,
    explanation: 'Velocity 通常代表按下琴键时的力度，常见值范围为 1–127；0 的 Note On 通常被视作 Note Off。'
  },
  {
    id: 'midi-cc-knob',
    category: 'midi',
    type: 'choice',
    prompt: '旋钮发送的 MIDI CC 常用于什么？',
    options: ['控制软件参数', '更改网页语言', '增加琴键数量', '自动安装驱动'],
    answer: 0,
    explanation: 'CC 是 Control Change，可用于表达旋钮、推子、延音踏板等控制器的变化。'
  },
  {
    id: 'midi-what',
    category: 'midi',
    type: 'choice',
    prompt: 'MIDI 通常传输的是什么？',
    options: ['完整录音波形', '演奏与控制事件', '扬声器电流', '视频帧'],
    answer: 1,
    explanation: 'MIDI 通常传输音符、力度、通道和控制器等事件，而不是录制好的音频波形。'
  },
  {
    id: 'midi-zero-velocity',
    category: 'midi',
    type: 'choice',
    prompt: '收到一个 Velocity 为 0 的 Note On，通常应当如何处理？',
    options: ['当作 Note Off', '忽略这个事件', '当作最大力度', '重启设备'],
    answer: 0,
    explanation: '许多设备用「Velocity 为 0 的 Note On」代替 Note Off，用来节省状态字节。解析时必须当作松开。'
  },
  {
    id: 'midi-channels',
    category: 'midi',
    type: 'choice',
    prompt: '标准 MIDI 一共有多少个通道？',
    options: ['4 个', '8 个', '16 个', '128 个'],
    answer: 2,
    explanation: 'MIDI 通道编号为 1–16，共 16 个。通道可以让同一个设备同时发送多个声部。'
  },
  {
    id: 'play-midi-c5',
    category: 'midi',
    type: 'play',
    mode: 'sequence',
    prompt: '在键盘上弹出 C5，并留意它的 MIDI 编号。',
    target: [72],
    labels: ['C5'],
    explanation: 'C5 是 MIDI 72。比中央 C（60）高一个八度，编号正好加 12。'
  },
  {
    id: 'play-midi-a4',
    category: 'midi',
    type: 'play',
    mode: 'sequence',
    prompt: '在键盘上弹出 A4（标准音高 440 Hz）。',
    target: [69],
    labels: ['A4'],
    explanation: 'A4 是 MIDI 69，频率 440 Hz。它是国际常用的调音基准。'
  }
]);

export function questionsForCategory(categoryId) {
  if (categoryId === 'all') return QUESTIONS.slice();
  return QUESTIONS.filter(question => question.category === categoryId);
}

export function findQuestion(id) {
  return QUESTIONS.find(question => question.id === id) || null;
}

export function questionCountText(categoryId) {
  const count = questionsForCategory(categoryId).length;
  return `${count} 道题`;
}
