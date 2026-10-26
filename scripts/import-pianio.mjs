/**
 * KeyLab · Pianio 题库导入器
 *
 * 读取 Pianio 仓库的 content/ 目录（CC0-1.0 公有领域），转写成 KeyLab 运行时可用的
 * JS 数据模块（src/data/pianio-content.js）。
 *
 * 用法：
 *   node scripts/import-pianio.mjs /path/to/pianio/content
 *
 * 说明：
 * - 只做「数据转写」，不复制 Pianio 的代码（其代码是 MIT，内容才是 CC0）。
 * - 完整保留 measures（音名+时值）、双手、谱号、拍号、BPM、力度与许可证来源，
 *   供后续真谱渲染使用。
 * - 派生 melody（右手旋律音序列）用于当前 sequence 判分；休止符被跳过，
 *   和弦取最高音（通常即旋律音）。
 * - 生成的 pianio-content.js 头部会标注来源，严禁手改（改动应回到本脚本重跑）。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LETTER_BASE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 把 Pianio 的音名（如 C4 / G#4 / Bb4）转成 MIDI 编号；无法解析返回 null。 */
function noteNameToMidi(token) {
  const match = /^([A-G])([#b]?)(-?\d+)$/.exec(token);
  if (!match) return null;
  const letter = match[1];
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const octave = Number(match[3]);
  const midi = (octave + 1) * 12 + LETTER_BASE[letter] + accidental;
  return Number.isInteger(midi) && midi >= 0 && midi <= 127 ? midi : null;
}

/** 从一个小节单元（单音 / 和弦 / 休止符）提取旋律音编号列表（休止符为空）。 */
function cellNotes(cell) {
  if (typeof cell !== 'string') return [];
  if (cell.startsWith('R:')) return [];
  const body = cell.startsWith('[') ? cell.slice(1, cell.indexOf(']')) : cell.split(':')[0];
  return body.split(',').map(noteNameToMidi).filter(Number.isInteger);
}

/** 整首练习的旋律音序列（跳过休止符，和弦取最高音）。 */
function melodyOf(exercise) {
  const result = [];
  for (const measure of exercise.measures || []) {
    for (const cell of measure) {
      const notes = cellNotes(cell);
      if (notes.length) result.push(Math.max(...notes));
    }
  }
  return result;
}

function courseCategory(courseId) {
  // 例如 songs-beginner -> beginner；technique-level-1a -> level-1a
  const parts = courseId.split('-');
  parts.shift();
  return parts.join('-');
}

function readCourses(contentDir) {
  const out = { songs: [], technique: [] };
  for (const kind of ['songs', 'technique']) {
    const root = path.join(contentDir, kind);
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root).sort()) {
      const file = path.join(root, entry, 'course.json');
      if (!fs.existsSync(file)) continue;
      const course = JSON.parse(fs.readFileSync(file, 'utf8'));
      const category = courseCategory(course.courseId);
      for (const ex of course.exercises || []) {
        out[kind].push({
          id: ex.id,
          slug: ex.slug || '',
          title: ex.title || '',
          summary: ex.summary || '',
          goal: ex.goal || '',
          category,
          level: ex.level ?? course.level ?? null,
          hands: ex.hands || 'right',
          clef: ex.clef || 'G',
          tempoBpm: ex.tempoBpm ?? null,
          timeSignature: Array.isArray(ex.timeSignature) ? ex.timeSignature : [4, 4],
          dynamics: Array.isArray(ex.dynamics) ? ex.dynamics : [],
          sourceKind: ex.sourceKind || 'original',
          license: ex.license || { type: 'CC0-1.0', attribution: 'Pianio original curriculum' },
          measures: Array.isArray(ex.measures) ? ex.measures : [],
          melody: melodyOf(ex)
        });
      }
    }
  }
  return out;
}

function emitModule(items, kind) {
  const lines = items.map(item => {
    const fields = [
      `id: ${JSON.stringify(item.id)}`,
      `slug: ${JSON.stringify(item.slug)}`,
      `title: ${JSON.stringify(item.title)}`,
      `summary: ${JSON.stringify(item.summary)}`,
      `goal: ${JSON.stringify(item.goal)}`,
      `category: ${JSON.stringify(item.category)}`,
      `level: ${JSON.stringify(item.level)}`,
      `hands: ${JSON.stringify(item.hands)}`,
      `clef: ${JSON.stringify(item.clef)}`,
      `tempoBpm: ${JSON.stringify(item.tempoBpm)}`,
      `timeSignature: ${JSON.stringify(item.timeSignature)}`,
      `dynamics: ${JSON.stringify(item.dynamics)}`,
      `sourceKind: ${JSON.stringify(item.sourceKind)}`,
      `license: ${JSON.stringify(item.license)}`,
      `measures: ${JSON.stringify(item.measures)}`,
      `melody: ${JSON.stringify(item.melody)}`
    ];
    return `  {\n    ${fields.join(',\n    ')}\n  }`;
  });
  return `export const ${kind} = Object.freeze([\n${lines.join(',\n')}\n]);`;
}

function main() {
  const contentDir = process.argv[2];
  if (!contentDir || !fs.existsSync(contentDir)) {
    console.error('用法：node scripts/import-pianio.mjs /path/to/pianio/content');
    process.exit(1);
  }
  const { songs, technique } = readCourses(contentDir);

  const header = [
    '// 本文件由 scripts/import-pianio.mjs 自动生成，请勿手改（改动请回到脚本重跑）。',
    '// 数据来源：Pianio（https://github.com/ismaelponce/pianio）content/ 目录，CC0-1.0 公有领域。',
    '// 详见 docs/INTEGRATION_PLAN.md 与 THIRD_PARTY_NOTICES.md。',
    `// 生成时间：${new Date().toISOString()}`,
    ''
  ].join('\n');

  const body = [
    header,
    emitModule(songs, 'PIECES'),
    '',
    emitModule(technique, 'TECHNIQUE'),
    ''
  ].join('\n');

  const here = path.dirname(fileURLToPath(import.meta.url));
  const outFile = path.resolve(here, '../src/data/pianio-content.js');
  fs.writeFileSync(outFile, body, 'utf8');

  const midiOk = [...songs, ...technique].every(item => item.melody.every(n => n >= 0 && n <= 127));
  console.log(`✓ 已生成 ${outFile}`);
  console.log(`  PIECES（曲目）: ${songs.length} 首`);
  console.log(`  TECHNIQUE（技巧）: ${technique.length} 条`);
  console.log(`  旋律音编号合法性: ${midiOk ? '通过' : '存在非法音符，请检查'}`);
}

main();
