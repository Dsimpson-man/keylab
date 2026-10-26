#!/usr/bin/env python3
"""
KeyLab UI 配色迁移：冷紫灰系 → Claude 暖色系（米白底 + 陶土橙主色 + 暖棕黑文字）。
只做精确的 hex 替换，class 名与结构不变。未映射的颜色会打印出来，便于补齐。
"""
import re, sys

# 设计系统目标值
BG          = '#faf9f5'   # 主背景 暖米白
PAPER       = '#ffffff'
INK         = '#29261b'   # 主文字 暖棕黑
INK2        = '#3d3929'
INK3        = '#4a4636'
MUTED       = '#6e6a5e'
MUTED_SOFT  = '#8a8574'
MUTED_FAINT = '#a09b8a'
LINE        = '#e8e4d8'
LINE_SOFT   = '#ece8dc'
LINE_FAINT  = '#f0ece3'
SURFACE     = '#f5f3ee'
SURFACE_2   = '#f8f6f1'
ACCENT      = '#d97757'   # terracotta
ACCENT_DARK = '#c15f3c'
ACCENT_LIGHT= '#e08a68'
ACCENT_PALE = '#f0b899'
ACCENT_PALER= '#f5d8c8'
ACCENT_SOFT = '#fbf0e9'
ACCENT_SOFT2= '#f5e9e0'
DARK        = '#2b2923'   # 深色面板/hero
DARKER      = '#262219'
BLACK_KEY   = '#1f1d18'
BLACK_KEY2  = '#14120e'

# 保留的绿色（成功/完成）与警告红橙黄 语义色，这里列出来防止误改
KEEP = set()

M = {
    # 背景 / 纸面
    '#f7f7fb': BG, '#fbfbfe': BG, '#fcfcff': BG, '#fcfefd': BG,
    '#f8f8fd': SURFACE, '#f8f8ff': SURFACE, '#f7f7ff': SURFACE, '#f7f7fd': SURFACE, '#f7f7fc': SURFACE,
    '#fafaff': SURFACE_2, '#fafafe': SURFACE_2, '#fbfbff': SURFACE_2, '#f9f9ff': SURFACE_2,
    '#fbfbfe': BG, '#fbfbff': SURFACE_2,
    '#fff': PAPER, '#ffffff': PAPER,

    # 边框
    '#e8e9f1': LINE, '#ebecf4': LINE, '#e9eaf4': LINE,
    '#ececf6': LINE_SOFT, '#eeeef8': LINE_SOFT,
    '#f0f0f6': LINE_FAINT, '#f0f0f7': LINE_FAINT,
    '#e2e3ef': '#e3ded1', '#e2e3f0': '#e3ded1', '#e2e4ef': '#e3ded1',
    '#dcdef0': '#ded9cc', '#dfe1f0': '#ded9cc',
    '#d9dbeb': '#d8d3c6', '#dcdcf3': '#ded9cc', '#d3d5e8': '#d4cec1',
    '#c1c4d4': '#b8b2a0', '#d5d8f4': '#ded9cc', '#b9bccd': '#b8b2a0',

    # 文字 ink
    '#20223f': INK, '#242646': INK, '#34364f': INK2, '#43465f': INK3,
    '#282b55': DARK, '#292c57': DARK, '#2b2d4a': DARK, '#5f6280': MUTED,

    # 文字 muted
    '#6f7390': MUTED, '#6f7288': MUTED, '#6c7089': MUTED, '#666a83': MUTED,
    '#64677e': MUTED, '#62657d': MUTED, '#73768f': MUTED_SOFT, '#74778f': MUTED_SOFT,
    '#757890': MUTED_SOFT, '#767a92': MUTED_SOFT, '#7c7f97': MUTED_SOFT, '#7d8098': MUTED_SOFT,
    '#7b7e96': MUTED_SOFT, '#85889f': MUTED_SOFT, '#85899f': MUTED_SOFT, '#8b8ea6': MUTED_SOFT,
    '#8a8da6': MUTED_SOFT, '#8d90a8': MUTED_SOFT, '#8d90aa': MUTED_SOFT, '#9a9cb1': MUTED_FAINT,
    '#a3a6bb': MUTED_FAINT, '#a9abc6': MUTED_FAINT, '#b9bbd8': MUTED_FAINT,

    # 主色 紫 → 橙
    '#5053d8': ACCENT, '#4b4ecb': ACCENT, '#3d40bd': ACCENT_DARK, '#3c3fbd': ACCENT_DARK,
    '#5c60e8': ACCENT_DARK, '#7476f3': ACCENT_LIGHT, '#b4b6ff': ACCENT_PALE,
    '#b3b5f2': ACCENT_PALE, '#c5c6f5': ACCENT_PALE, '#c8caf0': ACCENT_PALE, '#c0c2f0': ACCENT_PALE,
    '#b9bbf5': ACCENT_PALE, '#9a9df5': ACCENT_LIGHT, '#ccd0f8': ACCENT_PALER,
    '#8f7bf0': ACCENT, '#6550c9': ACCENT_DARK, '#bdb6f3': ACCENT_PALE,
    '#ddd9ff': ACCENT_PALER, '#d8d9ff': ACCENT_PALER, '#e4e4ff': ACCENT_PALER,
    '#eeedff': ACCENT_SOFT, '#eef0ff': ACCENT_SOFT, '#f0f0ff': ACCENT_SOFT2,
    '#f0eeff': ACCENT_SOFT2, '#f4f4ff': ACCENT_SOFT2, '#f0f2ff': ACCENT_SOFT2,
    '#e7e7fb': ACCENT_SOFT2, '#edecfa': LINE_FAINT,
    '#c2c4ff': ACCENT_LIGHT, '#c6c7ff': ACCENT_LIGHT, '#bfc0ff': ACCENT_LIGHT,
    '#c3c5e0': '#d8d3c6', '#c3c5df': '#d8d3c6', '#c9cae1': '#d8d3c6', '#c9caff': ACCENT_LIGHT, '#c9cbe3': '#d8d3c6',

    # 深色面板/黑键 冷黑 → 暖黑棕
    '#080915': BLACK_KEY2, '#101126': BLACK_KEY, '#14152a': BLACK_KEY2,
    '#1f4b3f': '#1f4b3f',  # 完成态深绿保留
    '#3f6f5c': '#3f6f5c',
    '#1d5b8a': '#1d5b8a',  # 蓝色保留（hold 面板硬件蓝，少用）
    '#5f7c93': '#5f7c93',
    '#6d6798': MUTED_SOFT, '#4b3fb0': ACCENT_DARK, '#43389f': ACCENT_DARK,

    # 其它近白/浅面
    '#f2f2f9': '#f0ece3', '#f4f4fb': SURFACE_2, '#f5f5fc': SURFACE,
    '#f1f1f8': LINE_FAINT, '#c3f2da': '#c3f2da',  # 绿

    # 漏补的紫灰 / 浅紫 / 蓝 → 暖色
    '#ddd9fb': ACCENT_PALER, '#c5c7ef': ACCENT_PALE, '#7b7e9e': MUTED_SOFT,
    '#8f92b4': MUTED_SOFT, '#eef0f7': LINE_FAINT,
    '#d9ebfb': '#e6dfd1', '#eef7ff': '#f5f1ea',
}

def main(path):
    text = open(path, encoding='utf-8').read()
    missing = set()
    def repl(m):
        h = m.group(0).lower()
        if h in M:
            return M[h]
        missing.add(h)
        return m.group(0)
    out = re.sub(r'#[0-9a-fA-F]{6}\b', repl, text)
    open(path, 'w', encoding='utf-8').write(out)
    if missing:
        print('未映射的颜色（保持原样）：')
        for h in sorted(missing):
            print('  ', h)
    else:
        print('全部颜色已映射。')

if __name__ == '__main__':
    main(sys.argv[1])
