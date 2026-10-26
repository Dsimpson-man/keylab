/**
 * KeyLab · 课程扩展生成器
 *
 * 从 scripts/import-pianio.mjs 生成的 src/data/pianio-content.js 中，精选曲目与技巧，
 * 转写成符合 KeyLab LESSONS 结构（与 src/data/lessons.js 同构）的课程数据，
 * 输出到 src/data/curriculum-extras.js（由 lessons.js 合并进 LESSONS）。
 *
 * 用法：
 *   node scripts/build-curriculum.mjs
 *
 * 说明：
 * - 曲目/技巧的旋律音来自 Pianio content/（CC0-1.0），中文名与教学文案为 KeyLab 原创。
 * - 全部使用 task.mode = 'wait'（弹错不重置、弹对当前音再前进），适配曲目跟弹。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { noteName } from '../src/core/music-theory.js';

const PIECE_NAMES = {
  'songs-b-001': '欢乐颂',
  'songs-b-002': '小星星',
  'songs-b-003': '玛丽有只小羊羔',
  'songs-b-004': '热十字面包',
  'songs-b-005': '铃儿响叮当',
  'songs-b-006': '老麦克唐纳有个农场',
  'songs-b-007': '噢，苏珊娜',
  'songs-b-008': '生日快乐',
  'songs-b-009': '奇异恩典',
  'songs-b-010': '伦敦桥要倒了',
  'songs-b-011': '跳向我的露',
  'songs-b-012': '康城赛马',
  'songs-b-013': '简单的礼物',
  'songs-b-014': '两只老虎',
  'songs-b-015': '扬基歌',
  'songs-b-016': '咩咩黑绵羊',
  'songs-b-017': '划呀划小船',
  'songs-b-018': '这个老人',
  'songs-b-019': '鼬鼠钻出来',
  'songs-b-020': '筷子圆舞曲',
  'songs-b-021': '轻轻划',
  'songs-b-022': '去告诉罗迪姑妈',
  'songs-b-023': '公交车轮子转',
  'songs-b-024': '滴答滴答钟',
  'songs-b-025': '杰克和吉尔',
  'songs-b-026': '迈克尔划船上岸',
  'songs-b-027': '圣徒行进',
  'songs-b-028': '嘘，小宝贝',
  'songs-b-029': '我这小小的光',
  'songs-b-030': '祖姆加利加利'
};

const TECHNIQUE_NAMES = {
  'technique-001': 'C 大调右手上行',
  'technique-002': 'C 大调右手下行',
  'technique-003': 'C 大调左手上行',
  'technique-004': 'C 大调左手下行',
  'technique-005': '右手五指抬指',
  'technique-006': '左手五指抬指',
  'technique-007': '右手分解三度',
  'technique-008': '左手分解三度',
  'technique-009': 'C 和弦右手分解',
  'technique-010': 'C 和弦左手分解',
  'technique-011': '右手二指重复',
  'technique-012': '左手二指重复',
  'technique-013': '右手反向触键',
  'technique-014': '左手反向触键',
  'technique-015': '技巧检查点',
  'technique-016': 'G 大调右手上行',
  'technique-017': 'G 大调右手下行',
  'technique-018': '右手移位',
  'technique-019': '右手断奏触键',
  'technique-020': '技巧终章'
};

function labelsFor(notes) {
  return notes.map(note => noteName(note, { naming: 'standard' }));
}

function pieceLesson(item, number) {
  const cn = PIECE_NAMES[item.id] || item.title;
  const bpm = item.tempoBpm || 80;
  const beats = Array.isArray(item.timeSignature) ? item.timeSignature.join('/') : '4/4';
  return {
    id: item.id,
    number,
    module: 'H',
    title: cn,
    category: item.title,
    duration: '随速度而定',
    icon: '♪',
    summary: `经典入门曲目，旋律共 ${item.melody.length} 个音。`,
    lead: `跟着谱面和示范，完整弹出《${cn}》的旋律。弹错不会从头开始，弹对当前音再继续。`,
    goals: [`完整弹出《${cn}》的旋律`],
    prerequisites: ['完成基础课程（A–G 模块）'],
    sections: [
      { title: '曲目背景', text: `${item.title}（原文简介：${item.summary}）` },
      { title: '怎么练', text: '先听示范熟悉旋律，再放慢速度一个音一个音弹。休止符处不需要按键，只弹旋律音。' }
    ],
    examples: [item.title, `${beats} 拍`, `${bpm} BPM`],
    tip: '先听示范，再慢慢跟弹；弹错不重置，弹对当前音才前进。',
    demo: { label: `${cn} 示范`, notes: item.melody.slice(0, 12) },
    task: {
      mode: 'wait',
      prompt: `弹出《${cn}》的旋律（共 ${item.melody.length} 个音）。`,
      target: item.melody,
      labels: labelsFor(item.melody)
    },
    passCriteria: `按顺序弹完 ${item.melody.length} 个旋律音。`,
    completion: `你已经完整弹出《${cn}》。`,
    reviewTip: `跟着节拍器（${bpm} BPM）再弹一遍，追求每个音都落在拍点上。`
  };
}

function techniqueLesson(item, number) {
  const cn = TECHNIQUE_NAMES[item.id] || item.title;
  const bpm = item.tempoBpm || 72;
  const hand = item.hands === 'left' ? '左手' : item.hands === 'together' ? '双手' : '右手';
  return {
    id: item.id,
    number,
    module: 'I',
    title: cn,
    category: item.title,
    duration: '约 2 分钟',
    icon: '⧉',
    summary: `入门手指技巧 · ${hand} · ${item.melody.length} 个音。`,
    lead: `用 ${hand} 稳定地弹出这段技巧练习，关注手指的独立与放松。`,
    goals: [`用 ${hand} 完整弹出「${cn}」`],
    prerequisites: ['完成基础课程（A–G 模块）'],
    sections: [
      { title: '练习要点', text: `${item.title}（原文：${item.summary}）` },
      { title: '怎么练', text: '先慢后快，保持每个音力度均匀、节奏稳定。不要为了速度牺牲准确。' }
    ],
    examples: [item.title, `${bpm} BPM`, hand],
    tip: '手腕放松，手指主动。弹错不重置，弹对当前音再继续。',
    demo: { label: `${cn} 示范`, notes: item.melody.slice(0, 10) },
    task: {
      mode: 'wait',
      prompt: `弹出「${cn}」（共 ${item.melody.length} 个音）。`,
      target: item.melody,
      labels: labelsFor(item.melody)
    },
    passCriteria: `按顺序弹完 ${item.melody.length} 个音。`,
    completion: `你已完成「${cn}」。`,
    reviewTip: `把速度逐步提升到 ${bpm} BPM，保持稳定后再加快。`
  };
}

async function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const contentPath = path.resolve(here, '../src/data/pianio-content.js');
  const { PIECES, TECHNIQUE } = await import(contentPath);

  const beginnerIds = new Set(Object.keys(PIECE_NAMES));
  const pieces = PIECES.filter(piece => beginnerIds.has(piece.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const techniqueIds = new Set(Object.keys(TECHNIQUE_NAMES));
  const techniques = TECHNIQUE.filter(item => techniqueIds.has(item.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const lessons = [];
  let number = 15; // 基础课程 14 课之后继续编号
  for (const piece of pieces) lessons.push(pieceLesson(piece, String(number++).padStart(2, '0')));
  for (const item of techniques) lessons.push(techniqueLesson(item, String(number++).padStart(2, '0')));

  const header = [
    '// 本文件由 scripts/build-curriculum.mjs 自动生成，请勿手改。',
    '// 曲目/技巧旋律数据来自 Pianio content/（CC0-1.0）；中文名与教学文案为 KeyLab 原创。',
    '// 详见 docs/INTEGRATION_PLAN.md 与 THIRD_PARTY_NOTICES.md。',
    `// 生成时间：${new Date().toISOString()}`,
    ''
  ].join('\n');

  const body = `${header}export const EXTRA_LESSONS = Object.freeze([\n${lessons.map(lesson => JSON.stringify(lesson, null, 2)).join(',\n')}\n]);\n`;

  const outFile = path.resolve(here, '../src/data/curriculum-extras.js');
  fs.writeFileSync(outFile, body, 'utf8');
  console.log(`✓ 已生成 ${outFile}`);
  console.log(`  曲目（H）: ${pieces.length} 首`);
  console.log(`  技巧（I）: ${techniques.length} 条`);
  console.log(`  课程总数: 14 + ${lessons.length} = ${14 + lessons.length}`);
}

main();
