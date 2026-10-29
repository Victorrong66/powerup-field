# Power-Up Field

Minesweeper with a twist: every time you successfully uncover safe tiles there's a
random chance (12% per move) to find a **power-up**.

| Power-up | What it does |
| --- | --- |
| 🛡️ Shield | Passive. Automatically absorbs the next mine you hit. |
| 📡 Scanner | Tap it, then tap a tile: safely clears that 3×3 area and flags any mines in it. |
| 🔧 Defuser | Finds and flags one hidden mine. |
| ❄️ Time Freeze | Stops the clock for 15 seconds. |

## Controls

- **Tap / click**: dig a tile
- **Long-press / right-click**: flag a tile
- **⛏️/🚩 button** (or `F` key): switch between dig and flag mode (long-press then does the opposite)
- **Tap a number** whose flags are all placed: opens the remaining neighbours (chording)
- The first tap is always safe.

## Run it

No build step. Serve the folder with any static server:

```sh
npm start              # uses `npx serve` on http://localhost:5173
# or
python3 -m http.server 5173
```

To try it on your phone, open the same address using your computer's LAN IP
(e.g. `http://192.168.1.20:5173`), or deploy the folder to any static host
(GitHub Pages, Netlify, Vercel). Over HTTPS it's an installable PWA: use "Add to
Home Screen" and it runs full-screen and offline.

Add `?debug` to the URL to get `window.pwf` in the console (e.g.
`pwf.game.inventory.scan = 3; pwf.render()`) for testing power-ups.

## Tests

```sh
npm test
```

## Project layout

```
index.html          page shell
style.css           styles (mobile-first, safe-area aware)
src/game.js         game rules, no DOM: board, mines, power-ups, timer
src/main.js         UI: rendering, touch/mouse input, toasts, best times
src/sprites.js      pixel-art icons (faces, power-ups) as character grids
assets/tiles/       board tile images, cut from assets/tiles-source.png
tools/slice_tiles.py  re-cuts the tiles after editing the sheet (needs Pillow)
sw.js               offline cache (bump CACHE when releasing)
manifest.webmanifest, icon.svg   PWA metadata
test/               node:test unit tests for src/game.js
```

## Tuning

- Board tiles: edit `assets/tiles-source.png` (4×3 grid: hidden, open, flag, mine, then 1–8) and run `python3 tools/slice_tiles.py`
- Pixel-art icons: the character grids in `src/sprites.js` (one character per pixel)
- Power-up odds: `DEFAULT_POWERUP_CHANCE` in `src/game.js`
- Which power-ups show up more often: each one's `weight` in `POWERUPS`
- Board sizes: `DIFFICULTIES` sets each level's tile count and mine density; `fitBoard` picks rows and columns to fill the screen

## Turning it into an app

Because this is a standard web app, it can be wrapped for the App Store / Play
Store with [Capacitor](https://capacitorjs.com/) without rewriting the game:

```sh
npm i @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
npx cap init "Power-Up Field" com.example.powerupfield --web-dir .
npx cap add ios && npx cap add android
npx cap open ios   # or android
```

(Before shipping, move the web files into a `www/` folder and point `--web-dir`
there, and add PNG icons, which the stores require.)
