/**
 * 音乐理论核心计算。
 *
 * 只处理 MIDI 音符编号（0–127）和纯数据，不依赖 DOM，因此可以直接在 Node 中测试。
 * 数据层始终以 MIDI 编号为标准，音名与八度显示只是可配置的表现层。
 */

export const NOTE_NAMES_SHARP = Object.freeze(['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']);
export const NOTE_NAMES_FLAT = Object.freeze(['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B']);
export const BLACK_KEY_PCS = Object.freeze([1, 3, 6, 8, 10]);
export const WHITE_KEY_PCS = Object.freeze([0, 2, 4, 5, 7, 9, 11]);

/** 两种常见的八度命名习惯。中央 C 都是 MIDI 60，只是显示名称不同。 */
export const NAMING_CONVENTIONS = Object.freeze({
  standard: Object.freeze({
    id: 'standard',
    label: '标准（中央 C = C4 = MIDI 60）',
    middleC: 60,
    octaveShift: 0
  }),
  yamaha: Object.freeze({
    id: 'yamaha',
    label: 'YAMAHA 习惯（中央 C = C3 = MIDI 60）',
    middleC: 60,
    octaveShift: -1
  })
});

export const MAJOR_SCALE_STEPS = Object.freeze([0, 2, 4, 5, 7, 9, 11, 12]);
export const NATURAL_MINOR_SCALE_STEPS = Object.freeze([0, 2, 3, 5, 7, 8, 10, 12]);

export const TRIAD_STEPS = Object.freeze({
  major: Object.freeze([0, 4, 7]),
  minor: Object.freeze([0, 3, 7]),
  diminished: Object.freeze([0, 3, 6]),
  augmented: Object.freeze([0, 4, 8])
});

export const TRIAD_LABELS = Object.freeze({
  major: '大三和弦',
  minor: '小三和弦',
  diminished: '减三和弦',
  augmented: '增三和弦'
});

const INTERVAL_NAMES = Object.freeze([
  '纯一度', '小二度', '大二度', '小三度', '大三度', '纯四度', '三全音',
  '纯五度', '小六度', '大六度', '小七度', '大七度', '纯八度'
]);

const LETTER_BASE_PC = Object.freeze({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 });

export function isValidMidiNote(note) {
  return Number.isInteger(note) && note >= 0 && note <= 127;
}

export function clampMidiNote(note) {
  if (!Number.isFinite(note)) return 60;
  return Math.max(0, Math.min(127, Math.round(note)));
}

export function isNamingConvention(naming) {
  return Object.prototype.hasOwnProperty.call(NAMING_CONVENTIONS, naming);
}

export function pitchClass(note) {
  return ((Math.round(note) % 12) + 12) % 12;
}

export function isBlackKey(note) {
  return BLACK_KEY_PCS.includes(pitchClass(note));
}

export function isWhiteKey(note) {
  return !isBlackKey(note);
}

/** 标准习惯下 MIDI 60 是 C4；YAMAHA 习惯下显示为 C3。 */
export function octaveOf(note, naming = 'standard') {
  const convention = NAMING_CONVENTIONS[naming] || NAMING_CONVENTIONS.standard;
  return Math.floor(note / 12) - 1 + convention.octaveShift;
}

export function noteName(note, { naming = 'standard', includeOctave = true, accidentals = 'sharp' } = {}) {
  if (!isValidMidiNote(note)) return '—';
  const names = accidentals === 'flat' ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  const name = names[pitchClass(note)];
  return includeOctave ? `${name}${octaveOf(note, naming)}` : name;
}

/** 带 MIDI 编号的完整说明，例如「C4 · MIDI 60」。 */
export function noteDescription(note, naming = 'standard') {
  if (!isValidMidiNote(note)) return '—';
  return `${noteName(note, { naming })} · MIDI ${note}`;
}

export function noteNumberFromName(input, naming = 'standard') {
  const match = /^([A-Ga-g])([#♯b♭]?)(-?\d+)$/.exec(String(input || '').trim());
  if (!match) return null;
  const letter = match[1].toUpperCase();
  const accidental = match[2];
  const octave = Number(match[3]);
  const semitone = accidental === '#' || accidental === '♯' ? 1 : accidental === 'b' || accidental === '♭' ? -1 : 0;
  const octaveOffset = naming === 'yamaha' ? 2 : 1;
  const note = (octave + octaveOffset) * 12 + LETTER_BASE_PC[letter] + semitone;
  return isValidMidiNote(note) ? note : null;
}

/** MIDI 69（A4）为 440 Hz。 */
export function midiToFrequency(note) {
  if (!isValidMidiNote(note)) return null;
  return 440 * Math.pow(2, (note - 69) / 12);
}

export function intervalSemitones(from, to) {
  return Math.round(to) - Math.round(from);
}

export function intervalName(semitones) {
  const distance = Math.abs(Math.round(semitones));
  if (distance <= 12) return INTERVAL_NAMES[distance];
  const octaves = Math.floor(distance / 12);
  const remainder = distance % 12;
  return remainder === 0
    ? `${octaves} 个八度`
    : `${octaves} 个八度 + ${INTERVAL_NAMES[remainder]}`;
}

/**
 * 描述两个音之间的关系，用于答题与课程反馈。
 * direction 为 same / up / down，distance 为半音数。
 */
export function describeRelation(from, to, { naming = 'standard' } = {}) {
  const distance = intervalSemitones(from, to);
  const fromName = noteName(from, { naming });
  const toName = noteName(to, { naming });
  const direction = distance === 0 ? 'same' : distance > 0 ? 'up' : 'down';
  let text;
  if (distance === 0) text = `${fromName} 与 ${toName} 是同一个音高。`;
  else if (distance > 0) text = `${fromName} 到 ${toName}：向上 ${distance} 个半音（${intervalName(distance)}）。`;
  else text = `${fromName} 到 ${toName}：向下 ${Math.abs(distance)} 个半音（${intervalName(distance)}）。`;
  return { distance, direction, interval: intervalName(distance), fromName, toName, text };
}

/**
 * 描述「用户实际弹了什么」与目标音的差距。
 * 这是课程与测验错误反馈的基础，避免只说「错了」。
 */
export function describePitchError(played, expected, { naming = 'standard' } = {}) {
  const expectedName = noteName(expected, { naming });
  if (!isValidMidiNote(played)) {
    return `还没有收到有效音符。正确答案是 ${expectedName}（MIDI ${expected}）。`;
  }
  const playedName = noteName(played, { naming });
  const distance = intervalSemitones(played, expected);
  if (distance === 0) return `你弹的是 ${playedName}，正是目标音。`;
  const direction = distance > 0 ? '低' : '高';
  return `你弹的是 ${playedName}，比目标 ${expectedName} ${direction} ${Math.abs(distance)} 个半音（${intervalName(distance)}）。`;
}

export function scaleNotes(rootNote, steps = MAJOR_SCALE_STEPS) {
  if (!isValidMidiNote(rootNote)) return [];
  return steps
    .map(step => rootNote + step)
    .filter(isValidMidiNote);
}

export function majorScale(rootNote) {
  return scaleNotes(rootNote, MAJOR_SCALE_STEPS);
}

export function naturalMinorScale(rootNote) {
  return scaleNotes(rootNote, NATURAL_MINOR_SCALE_STEPS);
}

export function triad(rootNote, quality = 'major') {
  const steps = TRIAD_STEPS[quality];
  if (!steps || !isValidMidiNote(rootNote)) return [];
  return steps.map(step => rootNote + step).filter(isValidMidiNote);
}

/** 例如「C 大三和弦」。 */
export function chordName(rootNote, quality = 'major') {
  if (!isValidMidiNote(rootNote)) return '—';
  return `${noteName(rootNote, { includeOctave: false })} ${TRIAD_LABELS[quality] || '和弦'}`;
}

export function scaleDegreeName(index) {
  const degrees = ['主音', '上主音', '中音', '下属音', '属音', '下中音', '导音', '高八度主音'];
  return Number.isInteger(index) && index >= 0 && index < degrees.length ? degrees[index] : `第 ${index + 1} 个音`;
}

/** 把半音差格式化为「高 2 个半音」这类短句。 */
export function describeOffset(semitones) {
  const distance = Math.round(semitones);
  if (distance === 0) return '同一音高';
  return `${distance > 0 ? '高' : '低'} ${Math.abs(distance)} 个半音`;
}
