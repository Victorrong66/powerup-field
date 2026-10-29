"""Cut the flag-placing animation (assets/flag-anim-source.png, 8 frames in
two rows of four, numbered underneath) into a sprite strip.

Each frame is cropped to its tile plus HEADROOM of extra height above it,
because the flag drops in from above the tile. Frames are bottom-aligned on
the tile so the strip plays without jitter, and the black sheet background
is made transparent (flood-filled from the edges, so dark outlines inside
the art are kept).

Writes assets/tiles/flag-anim.png (8 frames side by side, each SIZE wide and
SIZE * (1 + HEADROOM) tall) and replaces assets/tiles/flag.png with the
last frame's tile, so the animation ends on the resting flag tile. Run
tools/slice_tiles.py first; this overrides its flag tile.

Usage: python3 tools/slice_flag_anim.py   (needs Pillow)
"""
from collections import deque
from pathlib import Path

from PIL import Image

from slice_tiles import tint_greys

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'flag-anim-source.png'
OUT = ROOT / 'assets' / 'tiles'
SIZE = 96
HEADROOM = 0.45
FRAME_H = round(SIZE * (1 + HEADROOM))


def runs(values, gap=1):
    out, start, prev = [], values[0], values[0]
    for v in values[1:]:
        if v > prev + gap:
            out.append((start, prev))
            start = v
        prev = v
    out.append((start, prev))
    return out


def lit(p):
    return sum(p[:3]) > 150


def tile_boxes(im):
    """Find each frame's tile body (left, top, right, bottom) and the top of
    its row of art, row by row."""
    w, h = im.size
    px = im.load()
    # Row bands = the two rows of art (the number labels are short runs).
    rows = [y for y in range(h) if sum(lit(px[x, y]) for x in range(w)) > 30]
    bands = [r for r in runs(rows, gap=10) if r[1] - r[0] > 120]
    boxes = []
    for top, bottom in bands:
        # Columns lit across the lower half of the band = tile bodies only.
        lower = (top + bottom) // 2
        cols = [x for x in range(w) if sum(lit(px[x, y]) for y in range(lower, bottom)) > 20]
        for left, right in runs(cols, gap=20):
            width = right - left + 1
            # Tile rows are lit across most of the width; the flag isn't.
            body = [y for y in range(top, bottom + 1) if sum(lit(px[x, y]) for x in range(left, right + 1)) > width * 0.7]
            boxes.append(((left, body[0], right + 1, body[-1] + 1), top))
    return boxes


def clear_background(frame):
    """Flood-fill the black background from the frame edges to transparent."""
    frame = frame.convert('RGBA')
    w, h = frame.size
    px = frame.load()
    seen = set()
    queue = deque([(x, y) for x in range(w) for y in (0, h - 1)] + [(x, y) for y in range(h) for x in (0, w - 1)])
    while queue:
        x, y = queue.popleft()
        if (x, y) in seen or not (0 <= x < w and 0 <= y < h):
            continue
        seen.add((x, y))
        if sum(px[x, y][:3]) >= 60:
            continue
        px[x, y] = (0, 0, 0, 0)
        queue.extend([(x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)])
    return frame


def main():
    sheet = Image.open(SRC).convert('RGB')
    boxes = tile_boxes(sheet)
    assert len(boxes) == 8, boxes
    strip = Image.new('RGBA', (SIZE * len(boxes), FRAME_H), (0, 0, 0, 0))
    for i, ((left, top, right, bottom), row_top) in enumerate(boxes):
        tile_h = bottom - top
        # Headroom stops at the top of this row, so the row above stays out.
        crop = sheet.crop((left, max(row_top, round(top - tile_h * HEADROOM)), right, bottom))
        # Scale so the tile is SIZE x SIZE, then pin it to the frame bottom.
        frame = clear_background(crop).resize((SIZE, round(crop.height * SIZE / tile_h)), Image.LANCZOS)
        strip.alpha_composite(frame, (i * SIZE, FRAME_H - frame.height))
    strip.save(OUT / 'flag-anim.png', optimize=True)

    # The final frame's tile becomes the resting flag tile (and its green
    # "defused" variant), so the animation lands exactly on it.
    flag = strip.crop(((len(boxes) - 1) * SIZE, FRAME_H - SIZE, len(boxes) * SIZE, FRAME_H))
    flag.save(OUT / 'flag.png', optimize=True)
    tint_greys(flag, (120, 230, 120), dark=True).save(OUT / 'defused.png', optimize=True)
    print(f'wrote {len(boxes)}-frame flag-anim.png, flag.png and defused.png to {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
