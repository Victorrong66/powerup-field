"""Build the home-screen / app icons from the bomb tile in the tile sheet.

Writes assets/icons/icon-192.png, icon-512.png (also used as maskable, so the
tile sits inside the central safe zone) and apple-touch-icon.png (180px,
opaque, which iOS requires).

Usage: python3 tools/make_icons.py   (needs Pillow)
"""
from pathlib import Path

from PIL import Image

from slice_tiles import NAMES, SRC, clear_dark_corners, grid_boxes, tight_box

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'icons'
BACKGROUND = (0, 0, 128, 255)  # the title-bar navy


def main():
    sheet = Image.open(SRC).convert('RGB')
    rows, cols = grid_boxes(sheet)
    i = NAMES.index('mine')
    top, bottom = rows[i // len(cols)]
    left, right = cols[i % len(cols)]
    tile = clear_dark_corners(sheet.crop(tight_box(sheet, (left, top, right, bottom))))
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)]:
        icon = Image.new('RGBA', (size, size), BACKGROUND)
        inner = round(size * 0.66)  # inside the 80% maskable safe zone
        art = tile.resize((inner, inner), Image.LANCZOS)
        icon.alpha_composite(art, ((size - inner) // 2, (size - inner) // 2))
        icon.convert('RGB').save(OUT / name, optimize=True)
    print(f'wrote icons to {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
