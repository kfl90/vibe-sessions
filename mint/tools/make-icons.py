#!/usr/bin/env python3
"""Regenerate Mint's app and extension icons.

Requires Pillow (`pip install pillow`). Only needs re-running if the mark or
palette changes — the PNGs it writes are committed.

    python3 tools/make-icons.py
"""
import math
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
EXT_IMAGES = os.path.join(PROJECT, "Extension", "Resources", "images")
APPICON = os.path.join(PROJECT, "App", "Assets.xcassets", "AppIcon.appiconset")

BASE = 1024
TILE = (14, 34, 28, 255)        # deep green-charcoal
COOKIE = (224, 178, 116, 255)   # warm biscuit — the thing being blocked
COOKIE_EDGE = (168, 122, 66, 255)
CHIP = (74, 48, 30, 255)
MINT = (61, 220, 151, 255)      # brand mint: the prohibition ring and slash


def draw_icon(opaque_tile: bool) -> Image.Image:
    img = Image.new("RGBA", (BASE, BASE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # iOS app icons must be opaque; Apple applies the rounded mask itself.
    if opaque_tile:
        d.rectangle([0, 0, BASE, BASE], fill=TILE)

    cx = cy = BASE // 2
    r = int(BASE * 0.34)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=COOKIE,
              outline=COOKIE_EDGE, width=int(BASE * 0.015))

    chip_r = int(BASE * 0.045)
    for dx, dy in [(-0.14, -0.12), (0.10, -0.18), (0.16, 0.08),
                   (-0.05, 0.16), (-0.20, 0.05), (0.02, -0.02)]:
        x, y = cx + int(dx * BASE), cy + int(dy * BASE)
        d.ellipse([x - chip_r, y - chip_r, x + chip_r, y + chip_r], fill=CHIP)

    # Prohibition ring + diagonal: the circle-and-slash reads as "no"
    # regardless of hue, so mint carries the brand without losing the meaning.
    ring_r = int(BASE * 0.42)
    stroke = int(BASE * 0.07)
    d.ellipse([cx - ring_r, cy - ring_r, cx + ring_r, cy + ring_r],
              outline=MINT, width=stroke)
    off = ring_r / math.sqrt(2)
    d.line([cx - off, cy - off, cx + off, cy + off], fill=MINT, width=stroke)
    return img


os.makedirs(EXT_IMAGES, exist_ok=True)
os.makedirs(APPICON, exist_ok=True)

extension_icon = draw_icon(opaque_tile=False)
for size in (48, 96, 128, 256, 512):
    extension_icon.resize((size, size), Image.LANCZOS).save(
        os.path.join(EXT_IMAGES, f"icon-{size}.png")
    )

draw_icon(opaque_tile=True).convert("RGB").save(os.path.join(APPICON, "icon-1024.png"))
print(f"wrote extension icons to {EXT_IMAGES} and app icon to {APPICON}")
