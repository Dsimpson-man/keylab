/**
 * 课程数据。
 *
 * 与页面渲染分离：这里只描述「教什么、练什么、怎样算通过」，
 * 具体如何显示由 src/app.js 与 src/ui 负责。
 *
 * task.mode：
 * - sequence：按顺序弹出一组音（每个音一次）。
 * - together：同时按住一组音（和弦）。
 * - rhythm：跟随节拍器，在指定拍点弹同一个音。
 * - staff：看着五线谱按顺序弹出音符（判分逻辑同 sequence）。
 * - wait：按顺序弹出（弹错不重置，弹对当前音再前进），用于曲目跟弹。
 */

import { EXTRA_LESSONS } from './curriculum-extras.js';

export const LESSON_MODULES = Object.freeze([
  { id: 'A', name: '认识键盘', short: '键盘', description: '从黑键分组开始，找到 C，认识七个音名与不同八度。' },
  { id: 'B', name: '音高与音程', short: '音程', description: '理解半音、全音与音符之间的距离。' },
  { id: 'C', name: '音阶', short: '音阶', description: '把音符组织成音阶，理解大调的结构。' },
  { id: 'D', name: '和弦', short: '和弦', description: '同时按下多个音，认识大三和弦与小三和弦。' },
  { id: 'E', name: '节奏', short: '节奏', description: '跟随节拍器，理解拍子与音符时值。' },
  { id: 'F', name: '五线谱', short: '识谱', description: '认识高音谱号，把谱面音符对应到琴键。' },
  { id: 'G', name: 'MIDI 入门', short: 'MIDI', description: '理解 Note On / Note Off、力度、编号与通道。' },
  { id: 'H', name: '入门曲目', short: '曲目', description: '30 首入门经典曲，跟着旋律一步步弹出来。' },
  { id: 'I', name: '手指技巧', short: '技巧', description: '入门级手指与音阶技巧，建立稳定的触键。' }
]);

export const LESSONS = Object.freeze([
  {
    id: 'black-groups',
    number: '01',
    module: 'A',
    title: '黑键的分组规律',
    category: '键盘基础',
    duration: '5 分钟',
    icon: '▥',
    summary: '先观察两个一组、三个一组的黑键，建立整把键盘的「地图」。',
    lead: '不要把键盘看成 37 个互不相关的按键。黑键的排列有固定规律，学会这个规律，你就能快速定位任何音。',
    goals: ['看出黑键「两个一组、三个一组」的重复规律', '在两组黑键上实际按下对应的音'],
    prerequisites: ['不需要任何基础'],
    sections: [
      { title: '两个一组，三个一组', text: '从任意一个 C 向右看，黑键会先出现两个一组，再出现三个一组，然后不断重复。整把键盘都遵循这个规律。' },
      { title: '黑键也有音名', text: '黑键不是「没有名字的键」。它们用升号（♯）或降号（♭）表示，例如 C 右边的黑键是 C♯，也可以叫 D♭。' }
    ],
    examples: ['C♯ · D♯', 'F♯ · G♯ · A♯'],
    tip: '先用眼睛找出所有的「两个一组」，再找出所有的「三个一组」。',
    demo: { label: '两个一组的黑键', notes: [61, 63] },
    task: {
      mode: 'sequence',
      prompt: '找到任意「两个一组」的黑键，依次按下这两个黑键（C♯4、D♯4）。',
      target: [61, 63],
      labels: ['C♯4', 'D♯4']
    },
    passCriteria: '依次按对这两个黑键，就完成了你的第一课。',
    completion: '完成后，你已经在琴键上验证了黑键的分组规律。',
    reviewTip: '隔天再随机找三个不同的 C，并说出它右侧黑键的分组。'
  },
  {
    id: 'find-c',
    number: '02',
    module: 'A',
    title: '找到 C 音',
    category: '键盘基础',
    duration: '5 分钟',
    icon: '⌑',
    summary: '利用两个黑键的排列，在键盘上快速定位所有 C。',
    lead: '先认识键盘的地图。你不需要背下每一个琴键的位置，只要学会观察黑键的规律，就能找到所有 C。',
    goals: ['用黑键分组定位 C', '知道中央 C 是 MIDI 60'],
    prerequisites: ['黑键的分组规律'],
    sections: [
      { title: '观察黑键分组', text: '黑键会重复以「两个一组、三个一组」的方式排列。每一组两个黑键左侧紧挨着的白键，就是 C。这个规律在整把键盘上不断重复。' },
      { title: '认出中央 C', text: '在常见的音名标记中，中央 C 也叫 C4，对应 MIDI 音符编号 60。不同设备的八度标记偶尔会有差异，但 MIDI 编号是明确的。' }
    ],
    examples: ['C3', 'C4', 'C5'],
    tip: '先找到一组两个黑键，再按它左边的白键。不要急着记所有音名。',
    demo: { label: '两个 C', notes: [60, 72] },
    task: {
      mode: 'sequence',
      prompt: '请在下方键盘找到并按下 C4。',
      target: [60],
      labels: ['C4']
    },
    passCriteria: '按下 C4（MIDI 60）。',
    completion: '你已经能用黑键分组定位中央 C。',
    reviewTip: '在琴键上找出 C3、C4、C5，并说出它们的 MIDI 编号。'
  },
  {
    id: 'note-order',
    number: '03',
    module: 'A',
    title: '七个基本音名',
    category: '音符与音名',
    duration: '7 分钟',
    icon: '♫',
    summary: '熟悉 C、D、E、F、G、A、B 的顺序，以及音名与唱名的关系。',
    lead: '音乐中的基本音名只有七个。顺序到 B 后就会回到下一个 C，只是音高进入了新的八度。',
    goals: ['记住七个基本音名的顺序', '知道 C 大调中音名与唱名的对应'],
    prerequisites: ['找到 C 音'],
    sections: [
      { title: '音名的顺序', text: '从 C 开始依次是 C、D、E、F、G、A、B，再回到 C。你可以把它当作一个循环，而不是一条没有尽头的字母表。' },
      { title: '音名与唱名', text: '在 C 大调中，C、D、E、F、G、A、B 通常对应 Do、Re、Mi、Fa、Sol、La、Si。音名是固定的字母名称，唱名用于唱出音阶中的音。' }
    ],
    examples: ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    tip: '每天从任意一个 C 开始，慢慢弹过七个白键，再回到下一个 C。',
    demo: { label: 'C 到 B', notes: [60, 62, 64, 65, 67, 69, 71] },
    task: {
      mode: 'sequence',
      prompt: '从 C4 开始，依次弹 C、D、E、F、G、A、B。',
      target: [60, 62, 64, 65, 67, 69, 71],
      labels: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4']
    },
    passCriteria: '按 C–B 的顺序弹完 7 个白键。',
    completion: '你已经走完一个完整的音名循环。',
    reviewTip: '不看琴键，说出 B 右边是什么音，并在琴上验证。'
  },
  {
    id: 'octaves',
    number: '04',
    module: 'A',
    title: '不同的八度',
    category: '音高关系',
    duration: '6 分钟',
    icon: '㊂',
    summary: '同一个音名会在不同高度重复出现，距离一个八度时频率正好翻倍。',
    lead: 'C 不只一个。每 12 个半音，音名就会重复一次，音高则升高一个八度。',
    goals: ['理解八度是 12 个半音', '在琴键上找出同一个音名的不同八度'],
    prerequisites: ['七个基本音名'],
    sections: [
      { title: '音名重复，音高不同', text: 'C3、C4、C5 都叫 C，但一个比一个高。它们之间的距离都是 12 个半音，也就是一个八度。' },
      { title: '频率翻倍', text: '一个音升高八度，振动频率正好变为原来的两倍。例如 A4 是 440 Hz，A5 就是 880 Hz。声音听起来「同类」，但更高。' }
    ],
    examples: ['C3 = MIDI 48', 'C4 = MIDI 60', 'C5 = MIDI 72'],
    tip: '在 37 键键盘上找到三个相邻的 C，注意它们与两个黑键的位置关系完全一样。',
    demo: { label: '三个八度的 C', notes: [48, 60, 72] },
    task: {
      mode: 'sequence',
      prompt: '依次按下 C3、C4、C5，感受同一个音名在不同高度的重复。',
      target: [48, 60, 72],
      labels: ['C3', 'C4', 'C5']
    },
    passCriteria: '按从低到高的顺序弹完三个 C。',
    completion: '你已经亲手验证了八度的重复规律。',
    reviewTip: '计算 C4 到 C6 相差多少个半音，并在键盘上数一数。'
  },
  {
    id: 'semitones',
    number: '05',
    module: 'B',
    title: '半音与全音',
    category: '音高关系',
    duration: '8 分钟',
    icon: '↔',
    summary: '理解相邻琴键为什么相差半音，以及全音由两个半音组成。',
    lead: '音程描述的是两个音之间的距离。先从最小的常用距离——半音——开始。',
    goals: ['判断两个音之间是半音还是全音', '知道 E–F、B–C 之间没有黑键'],
    prerequisites: ['七个基本音名'],
    sections: [
      { title: '半音', text: '钢琴上相邻的两个琴键（无论白键还是黑键）相差一个半音。例如 C 到 C♯ 是半音，E 到 F 也是半音。' },
      { title: '全音', text: '全音等于两个半音。例如 C 到 D 中间经过 C♯，所以 C 到 D 是一个全音。B 到 C、E 到 F 则没有夹在中间的琴键。' }
    ],
    examples: ['C → C♯  半音', 'C → D  全音', 'E → F  半音', 'B → C  半音'],
    tip: '不要只记黑键。判断距离时，数的是琴键之间经过了几个半音。',
    demo: { label: '半音与全音', notes: [60, 61, 62] },
    task: {
      mode: 'sequence',
      prompt: '按顺序弹出这组关系：C4、C♯4（半音），然后 E4、F4（半音）。',
      target: [60, 61, 64, 65],
      labels: ['C4', 'C♯4', 'E4', 'F4']
    },
    passCriteria: '按顺序弹完 4 个音。',
    completion: '你已经用琴键验证了两组半音关系。',
    reviewTip: '找出键盘上所有「相邻但没有黑键」的白键对。'
  },
  {
    id: 'intervals',
    number: '06',
    module: 'B',
    title: '音程：音符之间的距离',
    category: '音高关系',
    duration: '8 分钟',
    icon: '⋯',
    summary: '从半音数出发，认识三度、五度和八度这些常见音程。',
    lead: '音程就是两个音之间的距离。数清楚半音，你就能判断任何两个音的关系。',
    goals: ['按半音数识别常见音程', '在琴键上弹出纯五度'],
    prerequisites: ['半音与全音'],
    sections: [
      { title: '用半音数说话', text: '两个半音是大二度，三个半音是小三度，四个半音是大三度，七个半音是纯五度，十二个半音是纯八度。这些名字描述的是「听起来有多远」。' },
      { title: '在琴键上验证', text: 'C 到 G 是纯五度（7 个半音）。先弹 C，再弹 G，仔细听这个距离。它是很多和弦与旋律的骨架。' }
    ],
    examples: ['C → E  大三度', 'C → G  纯五度', 'C → C  纯八度'],
    tip: '先弹下面的音，再弹上面的音，让两个音都响足够长。',
    demo: { label: '纯五度', notes: [60, 67] },
    task: {
      mode: 'sequence',
      prompt: '依次弹出 C4 和 G4，听一听纯五度。',
      target: [60, 67],
      labels: ['C4', 'G4']
    },
    passCriteria: '按顺序弹完 C4、G4。',
    completion: '你已经弹出了一个纯五度。',
    reviewTip: '在键盘上找出 D 到 A，判断它是不是也是纯五度。'
  },
  {
    id: 'c-major',
    number: '07',
    module: 'C',
    title: 'C 大调音阶',
    category: '音阶与旋律',
    duration: '8 分钟',
    icon: '⌁',
    summary: '把七个基本音名组织成一个音阶，练习从低到高完整弹奏。',
    lead: '音阶是按照特定音程关系排列的一组音。C 大调是最适合入门的音阶之一，因为它只使用白键。',
    goals: ['完整弹出 C 大调音阶', '听出主音回到高八度的稳定感'],
    prerequisites: ['七个基本音名', '半音与全音'],
    sections: [
      { title: 'C 大调的音', text: 'C 大调音阶是 C、D、E、F、G、A、B、C。最后一个 C 比第一个 C 高一个八度。' },
      { title: '大调的结构', text: '大调音阶的半音结构是：全全半全全全半。C 大调刚好全部落在白键上，所以最适合用来观察这个结构。' }
    ],
    examples: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C'],
    tip: '先用一个手指慢慢弹，熟悉音高顺序后再练习手指分配。',
    demo: { label: 'C 大调', notes: [60, 62, 64, 65, 67, 69, 71, 72] },
    task: {
      mode: 'sequence',
      prompt: '从 C4 开始，完整弹出 C 大调音阶到 C5。',
      target: [60, 62, 64, 65, 67, 69, 71, 72],
      labels: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5']
    },
    passCriteria: '按顺序弹完 8 个音，最后回到高八度 C。',
    completion: '你已经完整弹出一个八度的 C 大调音阶。',
    reviewTip: '再反向从 C5 弹回 C4，速度保持稳定。'
  },
  {
    id: 'g-major',
    number: '08',
    module: 'C',
    title: 'G 大调与升 F',
    category: '音阶与旋律',
    duration: '9 分钟',
    icon: '♯',
    summary: '把大调结构平移到 G，理解为什么 G 大调需要一个 F♯。',
    lead: '大调的结构「全全半全全全半」在每一个调都一样。为了保持这个结构，有时必须使用黑键。',
    goals: ['理解大调结构可以平移到不同主音', '知道 G 大调为什么有 F♯'],
    prerequisites: ['C 大调音阶'],
    sections: [
      { title: '从 G 开始数', text: '从 G 开始套用全全半全全全半：G–A（全）、A–B（全）、B–C（半）、C–D（全）、D–E（全）、E–F♯（全）、F♯–G（半）。' },
      { title: 'F 必须升高', text: '如果使用还原 F，E 到 F 只有半音，结构就不对了。因此 G 大调使用 F♯，让第六级到第七级保持全音。' }
    ],
    examples: ['G', 'A', 'B', 'C', 'D', 'E', 'F♯', 'G'],
    tip: '注意 G 大调里只有一个黑键：F♯。弹的时候留意它出现的位置。',
    demo: { label: 'G 大调', notes: [67, 69, 71, 72, 74, 76, 78, 79] },
    task: {
      mode: 'sequence',
      prompt: '从 G4 开始，弹出 G 大调音阶到 G5，注意 F♯5。',
      target: [67, 69, 71, 72, 74, 76, 78, 79],
      labels: ['G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F♯5', 'G5']
    },
    passCriteria: '按顺序弹完 8 个音，包括 F♯5。',
    completion: '你已经把大调结构平移到了 G。',
    reviewTip: '试着从 D 开始数一个大调音阶，看看需要升高哪些音。'
  },
  {
    id: 'triads',
    number: '09',
    module: 'D',
    title: '大三和弦',
    category: '和弦基础',
    duration: '8 分钟',
    icon: '▰',
    summary: '同时按住 C、E、G，听出大三和弦明亮的色彩。',
    lead: '当几个不同的音同时响起，就可能形成和弦。先从最常见的三和弦入门。',
    goals: ['说出 C 大三和弦的三个组成音', '同时按住三个音完成和弦'],
    prerequisites: ['音程：音符之间的距离'],
    sections: [
      { title: 'C 大三和弦', text: 'C 大三和弦由 C、E、G 三个音组成。它们可以一起按下，也可以依次弹奏；依次弹奏时通常称为琶音。' },
      { title: '根音、三音、五音', text: 'C 是根音，E 是三音，G 是五音。根音到三音是大三度（4 个半音），根音到五音是纯五度（7 个半音）。' }
    ],
    examples: ['C + E + G', '根音 C · 三音 E · 五音 G'],
    tip: '本课需要同时按住三个键。可以先逐个确认位置，再一起按下。',
    demo: { label: 'C 大三和弦', notes: [60, 64, 67] },
    task: {
      mode: 'together',
      prompt: '同时按住 C4、E4、G4，组成 C 大三和弦。',
      target: [60, 64, 67],
      labels: ['C4', 'E4', 'G4']
    },
    passCriteria: '三个目标音同时处于按下状态，不包含额外的音。',
    completion: '你已经亲手按出了一个完整的大三和弦。',
    reviewTip: '松开后重新按一次，试着听出它和单个音的区别。'
  },
  {
    id: 'minor-chords',
    number: '10',
    module: 'D',
    title: '小三和弦',
    category: '和弦基础',
    duration: '8 分钟',
    icon: '▱',
    summary: '把三音降低一个半音，从大三和弦得到小三和弦。',
    lead: '大三和弦和小三和弦只差一个音，却会带来明显不同的情绪色彩。',
    goals: ['比较 A 小三和弦与 A 大三和弦', '同时按住 A、C、E'],
    prerequisites: ['大三和弦'],
    sections: [
      { title: 'A 小三和弦', text: 'A 小三和弦由 A、C、E 组成。根音到三音是小三度（3 个半音），比大三和弦的三音低一个半音。' },
      { title: '只差一个半音', text: 'A 大三和弦是 A、C♯、E；把 C♯ 降低半音变成 C，就得到 A 小三和弦。听一听两种和弦的色彩差别。' }
    ],
    examples: ['A + C + E', 'A + C♯ + E（对比）'],
    tip: '先弹 A 小三和弦，再弹 A 大三和弦，来回比较。',
    demo: { label: 'A 小三和弦', notes: [57, 60, 64] },
    task: {
      mode: 'together',
      prompt: '同时按住 A3、C4、E4，组成 A 小三和弦。',
      target: [57, 60, 64],
      labels: ['A3', 'C4', 'E4']
    },
    passCriteria: '三个目标音同时按住，不包含额外的音。',
    completion: '你已经按出了一个小三和弦。',
    reviewTip: '把 C4 换成 C♯4，听听变成了什么和弦。'
  },
  {
    id: 'rhythm-basics',
    number: '11',
    module: 'E',
    title: '拍子与四分音符',
    category: '节奏基础',
    duration: '8 分钟',
    icon: '♩',
    summary: '跟随节拍器，在每一拍准确弹下 C4，建立稳定感。',
    lead: '节奏不是「弹得快」，而是在正确的时间点发出声音。先跟着节拍器，一拍一个音。',
    goals: ['理解拍子与 BPM', '跟随节拍器稳定弹奏四分音符'],
    prerequisites: ['找到 C 音'],
    sections: [
      { title: 'BPM 是什么', text: 'BPM（Beats Per Minute）表示每分钟多少拍。80 BPM 时，每 0.75 秒一拍。节拍器会在这个时间点发出提示音。' },
      { title: '四分音符', text: '在常见的 4/4 拍中，四分音符占一拍。跟着节拍器每拍弹一个音，就是最基础的节奏练习。' }
    ],
    examples: ['80 BPM', '每拍 0.75 秒', '共 4 拍'],
    tip: '先听两拍再开始弹。不要追求音量，追求落点准确。',
    demo: { label: '节拍器示范', notes: [60] },
    task: {
      mode: 'rhythm',
      prompt: '点击「开始节拍器」，在预备拍之后，每一拍弹一次 C4。',
      target: [60, 60, 60, 60],
      labels: ['第 1 拍', '第 2 拍', '第 3 拍', '第 4 拍'],
      tempo: 80,
      beats: 4,
      toleranceMs: 200
    },
    passCriteria: '4 次按键都落在节拍点 ±200 毫秒以内。',
    completion: '你已经能在真实时间轴上稳定演奏四分音符。',
    reviewTip: '把速度降到 60 BPM 再练一次，然后升到 100 BPM。'
  },
  {
    id: 'staff-basics',
    number: '12',
    module: 'F',
    title: '高音谱号与五线四间',
    category: '五线谱基础',
    duration: '9 分钟',
    icon: '𝄞',
    summary: '把五线谱上的位置对应到琴键，从 E4、G4、B4 开始。',
    lead: '五线谱不是另一套音乐，它只是另一种写法。看谱、找键、发声，这三步可以逐步建立。',
    goals: ['知道高音谱号五条线对应的音', '看谱弹出简单音符'],
    prerequisites: ['七个基本音名', '找到 C 音'],
    sections: [
      { title: '记住 3 个地标，别逐线数', text: '不要从最下面一条线往上「数格子」——那是 90% 的人放弃识谱的原因。只记 3 个「地标」：中央 C 在下加一线；G 在第二线（它围住 G 那个圈）；高音谱号最下面一条线是 E。其余音看它离哪个地标近、距离多远，一眼估出来。' },
      { title: '看距离，不看格子', text: '相邻的线或间，音高只差「一步」。地标往上一步是下一个音，往下一步是上一个音。你练的是「看形状和距离」，不是数线。' },
      { title: '线与间', text: '高音谱号从下往上，五条线分别是 E4、G4、B4、D5、F5。线与线之间的「间」是 F4、A4、C5、E5。' }
    ],
    examples: ['地标：中央 C（下加一线）', '地标：G（第二线）', '地标：E（最下面的线）'],
    tip: '中央 C（C4）在五线谱下方的第一条加线上。先认准这个地标，其他音往它附近靠。',
    demo: { label: 'E4 · G4 · B4', notes: [64, 67, 71] },
    task: {
      mode: 'staff',
      prompt: '看谱上依次出现的音符，在键盘上按顺序弹出。',
      target: [64, 67, 71, 65],
      labels: ['E4', 'G4', 'B4', 'F4']
    },
    passCriteria: '看谱按顺序弹完 4 个音。',
    completion: '你已经把谱面位置和琴键对应起来。',
    reviewTip: '把本课四个音的位置画出来，再闭眼说出对应的线或间。'
  },
  {
    id: 'midi-basics',
    number: '13',
    module: 'G',
    title: 'MIDI 是什么？',
    category: 'MIDI 入门',
    duration: '10 分钟',
    icon: '⌘',
    summary: '通过真实按键或虚拟键盘，理解 Note On、Note Off 和力度值。',
    lead: 'MIDI 通常不直接传送录制好的声音，而是传送演奏事件。软件收到事件后，再决定如何发声。',
    goals: ['区分 Note On 与 Note Off', '理解 Velocity 与 CC 的含义'],
    prerequisites: ['找到 C 音'],
    sections: [
      { title: 'Note On / Note Off', text: '按下琴键会触发 Note On，松开琴键会触发 Note Off。事件中会带有音符编号和 MIDI 通道等信息。' },
      { title: 'Velocity 与 CC', text: 'Velocity 通常描述按下琴键时的力度。CC（Control Change）则用于表达控制器变化，例如旋钮、推子或延音踏板发送的参数变化。' }
    ],
    examples: ['Note On', 'Note Off', 'Velocity', 'CC'],
    tip: '按住 C4 一秒再松开，观察事件日志中的 Note On 和 Note Off。若使用 iPad 浏览器，Web MIDI 连接可能受限，但本页虚拟键盘依然可用。',
    demo: { label: '按下与松开', notes: [60] },
    task: {
      mode: 'sequence',
      prompt: '按住 C4，再松开。留意按下与松开是两个不同的事件。',
      target: [60],
      labels: ['C4'],
      needsRelease: true
    },
    passCriteria: '按下并松开 C4。',
    completion: '你已经观察到 Note On 与 Note Off 是两个独立事件。',
    reviewTip: '到 MIDI 实验室切换力度，比较不同 Velocity 的数值。'
  },
  {
    id: 'midi-numbers',
    number: '14',
    module: 'G',
    title: 'MIDI 编号与通道',
    category: 'MIDI 入门',
    duration: '9 分钟',
    icon: '⌗',
    summary: '用琴键验证 MIDI 编号的规律：每升高一个半音，编号加一。',
    lead: 'MIDI 编号是音乐的「门牌号」。知道编号，就能精确描述任何一个音，不受设备八度标签影响。',
    goals: ['知道 C4 = 60、C5 = 72', '理解通道 1–16 的作用'],
    prerequisites: ['MIDI 是什么？'],
    sections: [
      { title: '编号的规律', text: 'MIDI 音符编号从 0 到 127。每升高一个半音，编号加 1；每升高一个八度，编号加 12。中央 C 通常是 60。' },
      { title: '通道', text: 'MIDI 有 16 个通道（1–16），可以理解为 16 条并行的线路。同一个设备可以在不同通道上发送不同的声部，事件日志会显示通道编号。' }
    ],
    examples: ['C4 = 60', 'C♯4 = 61', 'C5 = 72'],
    tip: '观察 MIDI 实验室日志里的「Note 60」和「CH 1」。',
    demo: { label: '60 → 61 → 72', notes: [60, 61, 72] },
    task: {
      mode: 'sequence',
      prompt: '依次按下 C4、C♯4、C5，观察它们的 MIDI 编号。',
      target: [60, 61, 72],
      labels: ['C4 = 60', 'C♯4 = 61', 'C5 = 72']
    },
    passCriteria: '按顺序弹完三个音。',
    completion: '你已经验证了半音加 1、八度加 12 的编号规律。',
    reviewTip: '不查表，算出 A4 的 MIDI 编号，并在实验室里验证。'
  },
  ...EXTRA_LESSONS
]);

export function findLesson(id) {
  return LESSONS.find(lesson => lesson.id === id) || null;
}

export function lessonsByModule(moduleId) {
  return LESSONS.filter(lesson => lesson.module === moduleId);
}

export function nextLessonAfter(id) {
  const index = LESSONS.findIndex(lesson => lesson.id === id);
  if (index < 0) return LESSONS[0] || null;
  return LESSONS[index + 1] || null;
}

export function lessonIndex(id) {
  return LESSONS.findIndex(lesson => lesson.id === id);
}

export const LESSON_COUNT = LESSONS.length;
