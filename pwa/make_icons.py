#!/usr/bin/env python3
# 生成 PWA 图标：等距三色魔方，放在蓝色圆角底上（全出血，无透明）。
# 输出到本脚本同目录：icon-512.png / icon-192.png / icon-180.png
import math, os
from PIL import Image, ImageDraw

OUT = os.path.dirname(os.path.abspath(__file__))
BG_TOP   = (74, 140, 255)   # 渐变上
BG_BOT   = (40, 98, 230)    # 渐变下
CUBE_TOP = (255, 213, 0)    # 黄
CUBE_L   = (232, 18, 29)    # 红（左前）
CUBE_R   = (20, 140, 255)   # 蓝（右前）
OUTLINE  = (24, 32, 50)     # 描边
GRID     = (255, 255, 255)   # 格子线（弱）


def round_rect(d, box, r, fill):
    d.rounded_rectangle(box, radius=r, fill=fill)


def gradient_bg(S):
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    px = img.load()
    for y in range(S):
        t = y / (S - 1)
        r = int(BG_TOP[0] + (BG_BOT[0] - BG_TOP[0]) * t)
        g = int(BG_TOP[1] + (BG_BOT[1] - BG_TOP[1]) * t)
        b = int(BG_TOP[2] + (BG_BOT[2] - BG_TOP[2]) * t)
        for x in range(S):
            px[x, y] = (r, g, b, 255)
    return img


def poly(d, pts, fill, outline=None, width=1):
    d.polygon(pts, fill=fill)
    if outline:
        d.line(pts + [pts[0]], fill=outline, width=width, joint="curve")


def draw_cube(d, cx, cy, w, v):
    # 等距三面体
    H = 2 * v  # 侧面高度
    Ttop    = (cx,      cy - v)
    Tright  = (cx + w,  cy)
    Tbot    = (cx,      cy + v)
    Tleft   = (cx - w,  cy)
    Bbot    = (cx,      cy + v + H)
    Bleft   = (cx - w,  cy + H)
    Bright  = (cx + w,  cy + H)

    ow = max(2, int(w * 0.045))
    # 左前面
    poly(d, [Tleft, Tbot, Bbot, Bleft], CUBE_L, OUTLINE, ow)
    # 右前面
    poly(d, [Tbot, Tright, Bright, Bbot], CUBE_R, OUTLINE, ow)
    # 顶面
    poly(d, [Ttop, Tright, Tbot, Tleft], CUBE_TOP, OUTLINE, ow)

    # 顶面 3×3 细线（弱）
    gw = max(1, int(w * 0.012))
    for i in range(1, 3):
        f = i / 3
        # 沿右方向细分
        x1 = Tleft[0] + (Tbot[0] - Tleft[0]) * f
        y1 = Tleft[1] + (Tbot[1] - Tleft[1]) * f
        x2 = Ttop[0] + (Tright[0] - Ttop[0]) * f
        y2 = Ttop[1] + (Tright[1] - Ttop[1]) * f
        d.line([(x1, y1), (x2, y2)], fill=(20, 32, 50, 90), width=gw)
        x3 = Ttop[0] + (Tleft[0] - Ttop[0]) * f
        y3 = Ttop[1] + (Tleft[1] - Ttop[1]) * f
        x4 = Tright[0] + (Tbot[0] - Tright[0]) * f
        y4 = Tright[1] + (Tbot[1] - Tright[1]) * f
        d.line([(x3, y3), (x4, y4)], fill=(20, 32, 50, 90), width=gw)


def make(S, name):
    img = gradient_bg(S)
    d = ImageDraw.Draw(img)
    # 轻微内描边光晕
    pad = int(S * 0.03)
    d.rounded_rectangle([pad, pad, S - pad, S - pad], radius=int(S * 0.22),
                        outline=(255, 255, 255, 60), width=max(2, int(S * 0.012)))
    w = S * 0.40
    v = S * 0.20
    cx = S * 0.5
    # 立方体垂直居中：顶 (cy - v) 底 (cy + 3v)；中心 = cy + v
    cy = S * 0.5 - v
    draw_cube(d, cx, cy, w, v)
    # 高光
    d.ellipse([S*0.18, S*0.16, S*0.40, S*0.34], fill=(255, 255, 255, 55))
    path = os.path.join(OUT, name)
    img.save(path, "PNG")
    print("✅", path, img.size)


if __name__ == "__main__":
    make(512, "icon-512.png")
    make(192, "icon-192.png")
    make(180, "icon-180.png")
