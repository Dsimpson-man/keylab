/**
 * 设备档案。
 *
 * 重要：M-VAVE SMK-37 PRO 的档案目前是「待实机验证」的观察模板，不是已确认的映射。
 * 不得据此硬编码音符范围或 CC 编号去替用户做判断；它们只用于界面提示和记录建议。
 *
 * 实机验证后，应把 observed 字段填成真实测量结果，并在 docs/ 中记录测试环境。
 */

export const DEVICE_PROFILES = Object.freeze([
  {
    id: 'm-vave-smk-37-pro',
    match: /SMK[\s-]?37|M-?VAVE/i,
    name: 'M-VAVE SMK-37 PRO',
    keys: 37,
    verified: false,
    status: 'pending-hardware',
    statusLabel: '等待实机验证',
    // 以下为「待验证假设」，不是已确认事实。
    assumptions: {
      noteRange: [48, 84],
      noteRangeLabel: 'C3–C6（假设，未验证）',
      defaultChannel: 1,
      pitchBendRangeSemitones: 2
    },
    observationChecklist: [
      '按下最低键与最高键，记录实际 MIDI 音符编号',
      '检查八度按钮是否改变发送的音符编号',
      '轻按与重按同一个键，记录 Velocity 范围',
      '依次转动每个旋钮、推动推子，记录 CC 编号与数值范围',
      '左右推动 Pitch Bend，记录数值与是否回中',
      '拔插 USB 数据线，观察设备枚举与断开行为',
      '如果支持蓝牙 MIDI，重复以上项目'
    ],
    notes: '设备到货前，任何「SMK-37 PRO 已适配」的说法都不成立。当前只提供通用 Web MIDI 支持与观察记录工具。'
  }
]);

export function matchProfile(deviceName = '') {
  return DEVICE_PROFILES.find(profile => profile.match.test(deviceName)) || null;
}

export const DEFAULT_KEYBOARD_RANGE = Object.freeze({ start: 48, count: 37 });
