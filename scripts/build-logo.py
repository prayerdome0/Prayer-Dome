#!/usr/bin/env python3
"""
Prayer Dome — official logo renderer
====================================

Recreates the official Prayer Dome mark (royal-blue gothic arch, gold "PD",
layered gold/blue chevron wings, letterspaced PRAYER DOME wordmark and the
gold/blue swoosh) as a crisp transparent-background PNG set:

    assets/logo.png        512 px  (site, certificate, PWA 512)
    assets/logo-192.png    192 px  (PWA)
    assets/logo-256.png    256 px  (guide PDF cover banner)
    assets/logo-source.png 1024 px (design source)

Run (needs pillow + numpy):

    python3 scripts/build-logo.py
"""
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
S = 2048  # working canvas

GOLD      = (222, 176, 53, 255)
GOLD_HI   = (246, 220, 119, 255)
GOLD_LO   = (184, 134, 11, 255)
PALE_GOLD = (240, 216, 120, 255)
BLUE      = (53, 87, 168, 255)
BLUE_HI   = (79, 111, 196, 255)
BLUE_LO   = (31, 50, 110, 255)
CYAN_BLUE = (63, 127, 212, 255)

FONT_SERIF_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
FONT_SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3)) + (255,)


def bezier(p0, p1, p2, n=220):
    """Quadratic bezier sampled into n points; also returns t values."""
    pts = []
    for i in range(n + 1):
        t = i / n
        x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0]
        y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1]
        pts.append((x, y, t))
    return pts


def paint_path(draw, pts, width, col_a, col_b, taper=None):
    """Stroke sampled points with per-segment interpolated colour.

    taper: optional (start, end) pair of width multipliers so strokes can
    thin out toward their tips.
    """
    for i in range(len(pts) - 1):
        x, y, t = pts[i]
        w = width
        if taper:
            mul = taper[0] + (taper[1] - taper[0]) * t
            w = max(2.0, width * mul)
        c = lerp(col_a, col_b, t)
        r = w / 2
        draw.ellipse([x - r, y - r, x + r, y + r], fill=c)


def draw_spaced_text(img, text, center_x, top_y, size, fill, track=0.0):
    """Letterspaced text, individually drawn, centred at (center_x, top_y)."""
    font = ImageFont.truetype(FONT_SERIF if fill == PALE_GOLD else FONT_SERIF_BOLD, size)
    d = ImageDraw.Draw(img)
    widths, heights = [], []
    for ch in text:
        b = d.textbbox((0, 0), ch, font=font)
        widths.append(b[2] - b[0])
        heights.append((b[1], b[3]))
    gap = int(size * track)
    total = sum(widths) + gap * (len(text) - 1)
    x = center_x - total / 2
    for ch, w, (t0, b0) in zip(text, widths, heights):
        d.text((x, top_y), ch, font=font, fill=fill)
        x += w + gap


def draw_centered(img, text, center_x, center_y, size, fill):
    font = ImageFont.truetype(FONT_SERIF_BOLD, size)
    d = ImageDraw.Draw(img)
    b = d.textbbox((0, 0), text, font=font)
    w, h = b[2] - b[0], b[3] - b[1]
    d.text((center_x - w / 2 - b[0], center_y - h / 2 - b[1]), text, font=font, fill=fill)


def render(size=S):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    k = size / 1024  # coordinates below are authored on a 1024 grid

    # ------------------------------------------------------------------ arch
    apex = (512 * k, 58 * k)
    left = bezier((178 * k, 470 * k), (150 * k, 170 * k), apex)
    right = bezier((846 * k, 470 * k), (874 * k, 170 * k), apex)
    pts = left + right[::-1][1:]
    paint_path(d, pts, 30 * k, BLUE_HI, BLUE_LO, taper=(1.05, 1.05))
    # brighten the very apex
    ax, ay = apex
    d.ellipse([ax - 15 * k, ay - 15 * k, ax + 15 * k, ay + 15 * k], fill=BLUE_HI)

    # ------------------------------------------------------------- PD letters
    draw_centered(img, 'PD', 512 * k, 236 * k, int(128 * k), PALE_GOLD)

    # -------------------------------------------------------------- chevrons
    center_dip = (512 * k, 562 * k)
    # 1) thin gold accent chevron (top) — sits clearly above the gold band
    acc_dip = (512 * k, 528 * k)
    t1 = bezier((306 * k, 392 * k), (408 * k, 418 * k), acc_dip)
    t2 = bezier((718 * k, 392 * k), (616 * k, 418 * k), acc_dip)
    paint_path(d, t1 + t2[::-1][1:], 7 * k, GOLD_HI, GOLD, taper=(0.8, 1.0))
    # 2) main gold band chevron
    g1 = bezier((236 * k, 415 * k), (370 * k, 470 * k), center_dip)
    g2 = bezier((788 * k, 415 * k), (654 * k, 470 * k), center_dip)
    paint_path(d, g1 + g2[::-1][1:], 26 * k, GOLD_HI, GOLD_LO)
    # 3) outer blue band chevron (lower dip)
    dip_b = (512 * k, 600 * k)
    b1 = bezier((186 * k, 435 * k), (340 * k, 505 * k), dip_b)
    b2 = bezier((838 * k, 435 * k), (684 * k, 505 * k), dip_b)
    paint_path(d, b1 + b2[::-1][1:], 24 * k, BLUE_HI, BLUE_LO)

    # ---------------------------------------------------------- wordmark
    draw_spaced_text(img, 'PRAYER', 322 * k, 690 * k, int(54 * k), GOLD, track=0.5)
    draw_spaced_text(img, 'DOME', 712 * k, 690 * k, int(54 * k), GOLD, track=0.5)

    # -------------------------------------------------------------- swoosh
    gold_s = bezier((978 * k, 816 * k), (700 * k, 902 * k), (62 * k, 946 * k))
    paint_path(d, gold_s, 14 * k, GOLD_HI, GOLD_LO, taper=(0.35, 1.05))
    blue_s = bezier((956 * k, 852 * k), (680 * k, 934 * k), (66 * k, 978 * k))
    paint_path(d, blue_s, 10 * k, CYAN_BLUE, BLUE_LO, taper=(0.3, 0.95))
    return img


def main():
    img = render()
    # trim transparent margins, pad square
    a = np.asarray(img)
    ys, xs = np.where(a[..., 3] > 8)
    pad = 30
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad, img.width)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad, img.height)
    img = img.crop((x0, y0, x1, y1))
    side = max(img.width, img.height)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    square.save(ROOT / 'assets' / 'logo-source.png')
    for px, name in [(512, 'logo.png'), (256, 'logo-256.png'), (192, 'logo-192.png')]:
        v = square.resize((px, px), Image.LANCZOS)
        v.save(ROOT / 'assets' / name, optimize=True)
        print('wrote assets/' + name, v.size)
    print('wrote assets/logo-source.png', square.size)


if __name__ == '__main__':
    main()
