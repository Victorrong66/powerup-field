"""Cut the tile sheet (assets/tiles-source.png) into individual tile PNGs.

Sheet layout, 4 columns x 3 rows:
  hidden  open  flag  mine
  1       2     3     4
  5       6     7     8

Also derives the extra tiles the game needs: exploded mine (red), wrong flag
(mine with a red cross) and defused mine (flag on green).

Usage: python3 tools/slice_tiles.py   (needs Pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / 'tiles-source.png'
OUT = ROOT / 'assets' / 'tiles'
SIZE = 96
NAMES = ['hidden', 'open', 'flag', 'mine', '1', '2', '3', '4', '5', '6', '7', '8']


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
            tile = sheet.crop((left, top, right + 1, bottom + 1))
            tile = clear_dark_corners(tile.resize((SIZE, SIZE), Image.LANCZOS))
            tiles[NAMES[i]] = tile
            i += 1

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
