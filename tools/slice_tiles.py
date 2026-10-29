"""Cut the tile sheet (assets/tiles-source.png) into individual tile PNGs.

Sheet layout, 4 columns x 3 rows (the second tile is a spare copy of the
hidden block and is skipped):
  hidden  hidden  flag  mine
  1       2       3     4
  5       6       7     8

The sheet has no blank "open" tile, so one is built from the flag tile's
frame with its face refilled from a clean patch of background. Also derives exploded mine (red), wrong flag (mine with a red cross)
and defused mine (flag on green).

Usage: python3 tools/slice_tiles.py   (needs Pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'tiles-source.png'
OUT = ROOT / 'assets' / 'tiles'
SIZE = 96
NAMES = ['hidden', None, 'flag', 'mine', '1', '2', '3', '4', '5', '6', '7', '8']


def bright(p):
    return sum(p[:3]) > 150


def find_runs(values):
    runs, start, prev = [], values[0], values[0]
    for v in values[1:]:
        if v != prev + 1:
            runs.append((start, prev))
            start = v
        prev = v
    runs.append((start, prev))
    return runs


def grid_boxes(im):
    w, h = im.size
    px = im.load()
    cols = [x for x in range(w) if sum(bright(px[x, y]) for y in range(h)) > 50]
    rows = [y for y in range(h) if sum(bright(px[x, y]) for x in range(w)) > 50]
    return find_runs(rows), find_runs(cols)


def tight_box(im, box):
    """Shrink a grid cell to the bounding box of the tile drawn inside it."""
    left, top, right, bottom = box
    px = im.load()
    xs, ys = [], []
    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            if bright(px[x, y]):
                xs.append(x)
                ys.append(y)
    return (min(xs), min(ys), max(xs) + 1, max(ys) + 1)


def plain(c):
    return max(c[:3]) - min(c[:3]) < 40 and sum(c[:3]) > 450


def blank_tile(flag):
    """Keep the flag tile's frame and refill its face with a clean patch of
    the same background texture, found by searching the face for a square
    window with nothing drawn in it."""
    out = flag.copy()
    lo, hi = SIZE * 12 // 96, SIZE * 86 // 96  # face inside the bevel
    px = flag.load()
    ok = [[plain(px[x, y]) for x in range(SIZE)] for y in range(SIZE)]
    patch = None
    for n in (28, 24, 20, 16, 12):
        for y0 in range(lo + 2, hi - 2 - n):
            for x0 in range(lo + 2, hi - 2 - n):
                if all(ok[y][x] for y in range(y0, y0 + n) for x in range(x0, x0 + n)):
                    patch = flag.crop((x0, y0, x0 + n, y0 + n))
                    break
            if patch:
                break
        if patch:
            break
    assert patch, 'no clean background patch found on the flag tile'
    for y in range(lo, hi, patch.height):
        for x in range(lo, hi, patch.width):
            w, h = min(patch.width, hi - x), min(patch.height, hi - y)
            out.paste(patch.crop((0, 0, w, h)), (x, y))
    return out


def clear_dark_corners(tile):
    """Make the black sheet background showing at the tile's edges transparent."""
    tile = tile.convert('RGBA')
    w, h = tile.size
    px = tile.load()
    edge = max(2, w // 12)
    for y in range(h):
        for x in range(w):
            near_edge = x < edge or y < edge or x >= w - edge or y >= h - edge
            if near_edge and sum(px[x, y][:3]) < 120:
                px[x, y] = (0, 0, 0, 0)
    return tile


def tint_greys(tile, rgb):
    """Recolour the light-grey face of a tile, keeping its shading."""
    tile = tile.copy()
    px = tile.load()
    for y in range(tile.height):
        for x in range(tile.width):
            r, g, b, a = px[x, y]
            if a and min(r, g, b) > 140 and max(r, g, b) - min(r, g, b) < 24:
                k = (r + g + b) / 3 / 255
                px[x, y] = (int(rgb[0] * k), int(rgb[1] * k), int(rgb[2] * k), a)
    return tile


def main():
    sheet = Image.open(SRC).convert('RGB')
    rows, cols = grid_boxes(sheet)
    assert len(rows) == 3 and len(cols) == 4, (rows, cols)
    OUT.mkdir(parents=True, exist_ok=True)
    tiles = {}
    i = 0
    for top, bottom in rows:
        for left, right in cols:
            name = NAMES[i]
            i += 1
            if name is None:
                continue
            tile = sheet.crop(tight_box(sheet, (left, top, right, bottom)))
            tiles[name] = clear_dark_corners(tile.resize((SIZE, SIZE), Image.LANCZOS))

    tiles['open'] = blank_tile(tiles['flag'])

    tiles['exploded'] = tint_greys(tiles['mine'], (255, 70, 60))
    tiles['defused'] = tint_greys(tiles['flag'], (150, 225, 150))
    wrong = tiles['mine'].copy()
    d = ImageDraw.Draw(wrong)
    m, wdt = SIZE * 0.22, max(4, SIZE // 14)
    d.line((m, m, SIZE - m, SIZE - m), fill=(230, 0, 0, 255), width=wdt)
    d.line((SIZE - m, m, m, SIZE - m), fill=(230, 0, 0, 255), width=wdt)
    tiles['wrong'] = wrong

    for name, tile in tiles.items():
        tile.save(OUT / f'{name}.png', optimize=True)
    print(f'wrote {len(tiles)} tiles to {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
