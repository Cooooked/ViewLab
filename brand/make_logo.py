#!/usr/bin/env python3
"""Generate the ViewLab logo: SVG masters + transparent PNGs.

Mark: six-blade aperture iris (the ViewLab "view" motif) with a red pupil.
Wordmark: "ViewLab" set in Segoe UI Semibold (the app's UI font), converted
to real vector outlines via fontTools so the SVG needs no fonts at render time.
"""
import io
import math

import resvg_py
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.ttLib import TTFont
from PIL import Image

FONT = r"C:\Windows\Fonts\segoeuib.ttf"
OUT = r"F:\AI-Projects\ViewLab-Website\brand"
INK = "#E8E8E8"      # app theme text colour (light variant)
INK_DARK = "#17191C" # near-black for light backgrounds
ACCENT = "#C90012"   # app theme accent red

font = TTFont(FONT)
UPM = font["head"].unitsPerEm
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
hmtx = font["hmtx"]

TEXT = "ViewLab"
TRACK = 2.0  # px tracking between glyphs

bp = BoundsPen(glyphs)
glyphs[cmap[ord("V")]].draw(bp)
cap_h = bp.bounds[3] - bp.bounds[1]
SCALE = 56.0 / cap_h          # px per font unit
CAP_PX = cap_h * SCALE
BASELINE_Y = (76 + CAP_PX) / 2

parts = []
pen_x = 14 + 66 + 18  # mark width + gap
for c in TEXT:
    gname = cmap[ord(c)]
    pen = SVGPathPen(glyphs)
    glyphs[gname].draw(pen)
    d = pen.getCommands()
    if d:
        parts.append(
            f'<path d="{d}" transform="translate({pen_x:.2f} {BASELINE_Y:.2f}) '
            f'scale({SCALE:.6f} {-SCALE:.6f})"/>'
        )
    pen_x += hmtx[gname][0] * SCALE + TRACK

text_svg = "\n  ".join(parts)


def iris_svg(cx, cy, R, stroke, fill, pupil_r, ring_w):
    """Six-blade aperture centred at (cx, cy)."""
    inner = R * 0.34
    orad = R - 3
    out = [f'<circle cx="{cx}" cy="{cy}" r="{R}" fill="none" stroke="{stroke}" stroke-width="{ring_w}"/>']
    for i in range(6):
        a = math.radians(i * 60 + 30)
        tip_r = inner * 0.92
        tx, ty = cx + tip_r * math.cos(a), cy + tip_r * math.sin(a)
        b1a, b2a = a - math.radians(26), a + math.radians(26)
        bx1, by1 = cx + orad * math.cos(b1a), cy + orad * math.sin(b1a)
        bx2, by2 = cx + orad * math.cos(b2a), cy + orad * math.sin(b2a)
        c1x = cx + orad * 0.55 * math.cos(a - math.radians(20))
        c1y = cy + orad * 0.55 * math.sin(a - math.radians(20))
        c2x = cx + orad * 0.55 * math.cos(a + math.radians(20))
        c2y = cy + orad * 0.55 * math.sin(a + math.radians(20))
        out.append(
            f'<path d="M {tx:.1f} {ty:.1f} Q {c2x:.1f} {c2y:.1f} {bx2:.1f} {by2:.1f} '
            f'A {orad:.1f} {orad:.1f} 0 0 1 {bx1:.1f} {by1:.1f} '
            f'Q {c1x:.1f} {c1y:.1f} {tx:.1f} {ty:.1f} Z" fill="{fill}"/>'
        )
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{pupil_r:.2f}" fill="{ACCENT}"/>')
    out.append(f'<circle cx="{cx}" cy="{cy}" r="{inner:.2f}" fill="none" stroke="{stroke}" stroke-width="3"/>')
    return "\n  ".join(out)


MARK_LIGHT = iris_svg(14 + 33, 38, 27, INK, INK, 27 * 0.34 * 0.92 * 0.5, 5)
MARK_DARK = iris_svg(14 + 33, 38, 27, INK_DARK, INK_DARK, 27 * 0.34 * 0.92 * 0.5, 5)


def logo_svg(mark, ink):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 450 76" width="450" height="76">\n'
        f"  {mark}\n"
        f'  <g fill="{ink}">\n  {text_svg}\n  </g>\n'
        "</svg>\n"
    )


def emit(svg_text, prefix):
    with open(f"{OUT}/{prefix}.svg", "w", encoding="utf-8") as f:
        f.write(svg_text)
    for w, h, suf in [(450, 76, "450x76"), (225, 38, "225x38"), (113, 19, "113x19")]:
        png = resvg_py.svg_to_bytes(svg_text, width=w, height=h)
        im = Image.open(io.BytesIO(png)).convert("RGBA")
        if im.size != (w, h):
            im = im.crop((0, 0, w, h))
        im.save(f"{OUT}/{prefix}-{suf}.png")
        print(prefix, suf, im.size)


emit(logo_svg(MARK_LIGHT, INK), "viewlab-logo")
emit(logo_svg(MARK_DARK, INK_DARK), "viewlab-logo-dark")

# Mark-only favicon on a dark rounded tile.
fav = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 76" width="76" height="76">\n'
    '  <rect width="76" height="76" rx="14" fill="#101114"/>\n'
    f"  {iris_svg(38, 38, 30, INK, INK, 30 * 0.34 * 0.92 * 0.5, 5)}\n"
    "</svg>\n"
)
with open(f"{OUT}/favicon.svg", "w", encoding="utf-8") as f:
    f.write(fav)
for s in [16, 32, 64, 180]:
    png = resvg_py.svg_to_bytes(fav, width=s, height=s)
    with open(f"{OUT}/favicon-{s}.png", "wb") as f:
        f.write(png)
print("favicon done")
