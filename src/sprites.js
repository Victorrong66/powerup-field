// 8-bit sprites drawn as character grids. Each character is one pixel and
// maps to a colour in PALETTE ('.' is transparent). Rendered as crisp SVG so
// they stay sharp at any tile size.

const PALETTE = {
  k: '#000000',
  w: '#ffffff',
  y: '#ffff00',
  r: '#ff0000',
  R: '#a00000',
  b: '#2050ff',
  B: '#0a2a99',
  s: '#e8e8e8',
  S: '#7a7a7a',
  n: '#8b4a14',
  c: '#00b8ff',
  d: '#003d10',
  g: '#30ff60',
};

const FACE_TOP = [
  '.....kkkkkk.....',
  '...kkyyyyyykk...',
  '..kyyyyyyyyyyk..',
  '.kyyyyyyyyyyyyk.',
];
const FACE_BOTTOM = [
  '.kyyyyyyyyyyyyk.',
  '..kyyyyyyyyyyk..',
  '...kkyyyyyykk...',
  '.....kkkkkk.....',
  '................',
];
const SMILE = [
  'kyyyyyyyyyyyyyyk',
  'kyykyyyyyyyykyyk',
  'kyyykyyyyyykyyyk',
  '.kyyykkkkkkyyyk.',
];

const GRIDS = {
  mine: [
    '......k......',
    '......k......',
    '..k.kkkkk.k..',
    '...kkkkkkk...',
    '..kkwwkkkkk..',
    '..kkwwkkkkk..',
    'kkkkkkkkkkkkk',
    '..kkkkkkkkk..',
    '..kkkkkkkkk..',
    '...kkkkkkk...',
    '..k.kkkkk.k..',
    '......k......',
    '......k......',
  ],
  flag: [
    '............',
    '.....rr.....',
    '...rrrr.....',
    '..rrrrr.....',
    '...rrrr.....',
    '.....rr.....',
    '......k.....',
    '......k.....',
    '....kkkk....',
    '..kkkkkkkk..',
    '..kkkkkkkk..',
    '............',
  ],
  shield: [
    '.kkkkkkkkkk.',
    '.kbbbbbbbbk.',
    '.kbwwbbbbBk.',
    '.kbwbbbbbBk.',
    '.kbbbbbbbBk.',
    '.kbbbbbbbBk.',
    '.kbbbbbbbBk.',
    '..kbbbbbBk..',
    '..kbbbbbBk..',
    '...kbbbBk...',
    '....kbBk....',
    '.....kk.....',
  ],
  scan: [
    '...kkkkkk...',
    '..kddddddk..',
    '.kddddddgdk.',
    'kddddddgdddk',
    'kdddddgddddk',
    'kddddggddddk',
    'kddddddddddk',
    'kddwdddddddk',
    'kddddddddddk',
    '.kddddddddk.',
    '..kddddddk..',
    '...kkkkkk...',
  ],
  defuse: [
    '...s....s...',
    '...ss..sS...',
    '...ssssSS...',
    '....ssSS....',
    '.....sS.....',
    '.....sS.....',
    '.....sS.....',
    '.....sS.....',
    '....rrRR....',
    '....rrRR....',
    '....rrRR....',
    '.....RR.....',
  ],
  freeze: [
    '.....c.....',
    '.c...c...c.',
    '..c..c..c..',
    '...c.c.c...',
    '....ccc....',
    'ccccccccccc',
    '....ccc....',
    '...c.c.c...',
    '..c..c..c..',
    '.c...c...c.',
    '.....c.....',
  ],
  dig: [
    '.....nn.....',
    '....n..n....',
    '.....nn.....',
    '.....nn.....',
    '.....nn.....',
    '.....nn.....',
    '...sssssS...',
    '...sssssS...',
    '...sssssS...',
    '...sssssS...',
    '....sssS....',
    '.....sS.....',
  ],
  smile: [
    ...FACE_TOP,
    '.kyyykkyykkyyyk.',
    'kyyyykkyykkyyyyk',
    'kyyyyyyyyyyyyyyk',
    ...SMILE,
    ...FACE_BOTTOM,
  ],
  dead: [
    ...FACE_TOP.slice(0, 3),
    '.kyykykyykykyyk.',
    '.kyyykyyyykyyyk.',
    'kyyykykyykykyyyk',
    'kyyyyyyyyyyyyyyk',
    'kyyyyyyyyyyyyyyk',
    'kyyyyyyyyyyyyyyk',
    'kyyyykkkkkkyyyyk',
    '.kyykyyyyyykyyk.',
    ...FACE_BOTTOM,
  ],
  cool: [
    ...FACE_TOP,
    '.kkkkkkkkkkkkkk.',
    'kyykkkkyykkkkyyk',
    'kyyykkyyyykkyyyk',
    ...SMILE,
    ...FACE_BOTTOM,
  ],
};

const cache = new Map();

export function sprite(name) {
  if (cache.has(name)) return cache.get(name);
  const grid = GRIDS[name];
  if (!grid) throw new Error(`Unknown sprite: ${name}`);
  const w = grid[0].length;
  let rects = '';
  grid.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Sprite ${name} row ${y} has width ${row.length}, expected ${w}`);
    // Merge horizontal runs of the same colour into one rect.
    for (let x = 0; x < w; ) {
      const ch = row[x];
      let end = x + 1;
      while (end < w && row[end] === ch) end++;
      if (ch !== '.') rects += `<rect x="${x}" y="${y}" width="${end - x}" height="1" fill="${PALETTE[ch]}"/>`;
      x = end;
    }
  });
  const svg = `<svg class="sprite" viewBox="0 0 ${w} ${grid.length}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  cache.set(name, svg);
  return svg;
}

export const SPRITE_NAMES = Object.keys(GRIDS);
