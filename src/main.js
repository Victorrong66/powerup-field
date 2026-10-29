import { DIFFICULTIES, POWERUPS, Game, fitBoard } from './game.js';
import { sprite } from './sprites.js';

const LONG_PRESS_MS = 420;
const $ = (id) => document.getElementById(id);

const els = {
  board: $('board'),
  boardWrap: $('board-wrap'),
  difficulty: $('difficulty'),
  size: $('size'),
  minesLeft: $('mines-left'),
  timer: $('timer'),
  face: $('new-game'),
  flagMode: $('flag-mode'),
  inventory: $('inventory'),
  toast: $('toast'),
  dialog: $('result-dialog'),
  resultTitle: $('result-title'),
  resultBody: $('result-body'),
  playAgain: $('play-again'),
};

let game;
// 'fit' shapes the board to the screen; a number is an N×N square board.
const SIZES = ['fit', '8', '10', '12', '16', '20', '24'];
let difficulty = loadSetting('difficulty', 'easy');
if (!DIFFICULTIES[difficulty]) difficulty = 'easy';
let size = loadSetting('size', 'fit');
if (!SIZES.includes(size)) size = 'fit';
let flagMode = false;
let targeting = null; // power-up type awaiting a tile choice
let cellEls = [];
let toastTimer;

// ---------- setup ----------

for (const [key, d] of Object.entries(DIFFICULTIES)) {
  els.difficulty.add(new Option(d.label, key, false, key === difficulty));
}
els.difficulty.addEventListener('change', () => {
  difficulty = els.difficulty.value;
  saveSetting('difficulty', difficulty);
  newGame();
});

for (const key of SIZES) {
  els.size.add(new Option(key === 'fit' ? 'Fit screen' : `${key}×${key}`, key, false, key === size));
}
els.size.addEventListener('change', () => {
  size = els.size.value;
  saveSetting('size', size);
  newGame();
});

for (const [type, p] of Object.entries(POWERUPS)) {
  const btn = document.createElement('button');
  btn.className = 'power raised';
  btn.dataset.type = type;
  btn.title = `${p.name}: ${p.description}`;
  btn.innerHTML = `<span class="icon">${sprite(type)}</span><span class="name">${p.name}</span><span class="count">0</span>`;
  btn.addEventListener('click', () => onPowerupClick(type));
  els.inventory.append(btn);
}

els.face.addEventListener('click', newGame);
els.playAgain.addEventListener('click', () => {
  els.dialog.close();
  newGame();
});
els.flagMode.addEventListener('click', () => setFlagMode(!flagMode));
new ResizeObserver(sizeBoard).observe(els.boardWrap);
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') setFlagMode(!flagMode);
  if (e.key === 'Escape') cancelTargeting();
});

setInterval(() => {
  if (!game || game.state !== 'playing' || document.hidden) return;
  game.tick();
  renderHud();
}, 1000);

attachBoardInput();
setFlagMode(false);
newGame();
// Dev helper: open with ?debug to poke at state from the console,
// e.g. `pwf.game.inventory.scan = 3; pwf.render()`.
if (new URLSearchParams(location.search).has('debug')) {
  window.pwf = { get game() { return game; }, render };
}
registerServiceWorker();

// ---------- game flow ----------

function newGame() {
  const level = DIFFICULTIES[difficulty];
  let board;
  if (size === 'fit') {
    board = fitBoard(level, els.boardWrap.clientWidth / els.boardWrap.clientHeight);
  } else {
    const n = Number(size);
    board = { rows: n, cols: n, mines: Math.max(1, Math.round(n * n * level.density)) };
  }
  game = new Game(board);
  targeting = null;
  buildBoard();
  render();
}

function buildBoard() {
  els.board.innerHTML = '';
  els.board.style.setProperty('--cols', game.cols);
  cellEls = game.cells.map((_, i) => {
    const b = document.createElement('button');
    b.className = 'cell';
    b.dataset.i = i;
    b.setAttribute('role', 'gridcell');
    els.board.append(b);
    return b;
  });
  sizeBoard();
}

function sizeBoard() {
  if (!game) return;
  // The board area flexes to fill the space between scoreboard and power-ups;
  // make the square tiles as big as that space allows (minus the bevel).
  const frame = 6;
  const byW = (els.boardWrap.clientWidth - frame) / game.cols;
  const byH = (els.boardWrap.clientHeight - frame) / game.rows;
  const size = Math.max(16, Math.floor(Math.min(byW, byH)));
  document.documentElement.style.setProperty('--cell', `${size}px`);
}

function handleTap(i, alternate) {
  if (game.isOver) return;
  const r = Math.floor(i / game.cols);
  const c = i % game.cols;

  if (targeting) {
    const type = targeting;
    cancelTargeting();
    const res = game.usePowerup(type, r, c);
    if (res.used) {
      vibrate(30);
      afterMove(res);
      showToast(`${POWERUPS[type].name} used!`);
    }
    return;
  }

  const cell = game.cells[i];
  const wantsFlag = flagMode !== alternate;
  if (cell.drop) {
    const type = game.collect(r, c);
    if (type) {
      const p = POWERUPS[type];
      vibrate([20, 30, 20]);
      showToast(`Picked up ${p.name}! ${p.description}`);
      flash(els.inventory.querySelector(`[data-type="${type}"]`), 'bump');
      render();
    }
  } else if (cell.revealed) {
    afterMove(game.chord(r, c));
  } else if (wantsFlag) {
    if (game.toggleFlag(r, c)) vibrate(15);
    render();
  } else {
    afterMove(game.reveal(r, c));
  }
}

function afterMove(res) {
  render();
  if (res.shieldUsed) {
    vibrate([40, 40, 40]);
    showToast('Your shield absorbed a mine!');
  }
  if (res.drop) {
    vibrate([20, 30, 20]);
    showToast(`Clean clear! A ${POWERUPS[res.drop.type].name} dropped. Tap it to pick it up.`);
    flash(cellEls[res.drop.index], 'lucky');
  }
  if (game.state === 'lost') {
    vibrate(200);
    setTimeout(() => showResult(false), 600);
  } else if (game.state === 'won') {
    setTimeout(() => showResult(true), 300);
  }
}

function onPowerupClick(type) {
  if (game.state !== 'playing') {
    showToast(game.state === 'ready' ? 'Dig a tile first to start the game.' : 'Start a new game to use power-ups.');
    return;
  }
  const p = POWERUPS[type];
  if (p.passive) {
    showToast(`${p.name} is automatic. It saves you from your next mine.`);
    return;
  }
  if (p.targeted) {
    if (targeting === type) return cancelTargeting();
    targeting = type;
    els.board.classList.add('targeting');
    showToast(`Tap a tile to use ${p.name}. Tap the button again to cancel.`);
    renderInventory();
    return;
  }
  const res = game.usePowerup(type);
  if (res.used) {
    vibrate(30);
    showToast(`${p.name} used!`);
    afterMove(res);
  }
}

function cancelTargeting() {
  targeting = null;
  els.board.classList.remove('targeting');
  renderInventory();
}

function setFlagMode(on) {
  flagMode = on;
  els.flagMode.setAttribute('aria-pressed', String(on));
  els.flagMode.querySelector('.mode-icon').innerHTML = sprite(on ? 'flag' : 'dig');
  els.flagMode.querySelector('.mode-label').textContent = on ? 'Flag' : 'Dig';
}

function showResult(won) {
  els.resultTitle.textContent = won ? 'You cleared the field!' : 'Game over';
  let body = won ? `Time: ${game.elapsed}s.` : 'Boom! You hit a mine. Grab a shield next time!';
  if (won) {
    const key = `best-${difficulty}-${size}`;
    const best = Number(loadSetting(key, 0));
    if (!best || game.elapsed < best) {
      saveSetting(key, game.elapsed);
      body += ' New best time!';
    } else {
      body += ` Best: ${best}s.`;
    }
  }
  els.resultBody.textContent = body;
  if (els.dialog.showModal) els.dialog.showModal();
}

// ---------- rendering ----------

function render() {
  const lost = game.state === 'lost';
  game.cells.forEach((cell, i) => {
    const el = cellEls[i];
    let tile = 'hidden';
    if (cell.defused) tile = 'defused';
    else if (cell.revealed && cell.mine) tile = cell.exploded ? 'exploded' : 'mine';
    else if (cell.revealed) tile = cell.adjacent ? String(cell.adjacent) : 'open';
    else if (cell.flagged) tile = lost && !cell.mine ? 'wrong' : 'flag';
    el.dataset.tile = tile;
    el.classList.toggle('open', cell.revealed);
    // Power-ups lying on the board are drawn on top of the tile.
    const drop = game.isOver ? null : cell.drop;
    if (el._drop !== drop) {
      el.innerHTML = drop ? sprite(drop) : '';
      el.classList.toggle('has-drop', Boolean(drop));
      el._drop = drop;
    }
    el.setAttribute(
      'aria-label',
      drop
        ? `${POWERUPS[drop].name} power-up, tap to pick up`
        : cell.revealed
          ? cell.mine
            ? 'mine'
            : `${cell.adjacent} adjacent mines`
          : cell.flagged
            ? 'flagged'
            : 'hidden',
    );
  });
  renderHud();
  renderInventory();
}

function renderHud() {
  els.minesLeft.textContent = led(game.minesLeft);
  els.timer.textContent = led(game.elapsed);
  els.timer.parentElement.classList.toggle('frozen', game.frozenFor > 0);
  const face = game.state === 'lost' ? 'dead' : game.state === 'won' ? 'cool' : 'smile';
  if (els.face.dataset.face !== face) {
    els.face.innerHTML = sprite(face);
    els.face.dataset.face = face;
  }
}

// Three-digit counter like the classic scoreboard (negative when over-flagged).
function led(n) {
  const clamped = Math.max(-99, Math.min(999, n));
  return clamped < 0 ? '-' + String(-clamped).padStart(2, '0') : String(clamped).padStart(3, '0');
}

function renderInventory() {
  for (const btn of els.inventory.children) {
    const type = btn.dataset.type;
    const n = game.inventory[type];
    btn.querySelector('.count').textContent = n;
    btn.querySelector('.count').hidden = n === 0;
    btn.disabled = n === 0;
    btn.classList.toggle('active', targeting === type);
  }
}

function flash(el, cls) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth; // restart the animation
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 1000);
}

function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  els.toast.style.animation = 'none';
  void els.toast.offsetWidth;
  els.toast.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (els.toast.hidden = true), 2600);
}

// ---------- input ----------

// Tap = primary action, long-press (touch) or right-click (mouse) = the
// alternate action. With flag mode on, the two are swapped.
function attachBoardInput() {
  let pressTimer = null;
  let pressed = null; // { i, x, y, fired }

  const cellIndex = (e) => {
    const el = e.target.closest('.cell');
    return el ? Number(el.dataset.i) : null;
  };

  els.board.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const i = cellIndex(e);
    if (i === null) return;
    pressed = { i, x: e.clientX, y: e.clientY, fired: false };
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      if (!pressed) return;
      pressed.fired = true;
      handleTap(pressed.i, true);
    }, LONG_PRESS_MS);
  });

  els.board.addEventListener('pointermove', (e) => {
    if (pressed && Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > 10) {
      clearTimeout(pressTimer);
      pressed = null;
    }
  });

  els.board.addEventListener('pointerup', (e) => {
    clearTimeout(pressTimer);
    if (!pressed) return;
    const { i, fired } = pressed;
    pressed = null;
    if (!fired && cellIndex(e) === i) handleTap(i, false);
  });

  const cancel = () => {
    clearTimeout(pressTimer);
    pressed = null;
  };
  els.board.addEventListener('pointercancel', cancel);
  els.board.addEventListener('pointerleave', cancel);

  // Right-click on desktop. Touch long-press is handled by the timer above,
  // so ignore the contextmenu that some mobile browsers fire for it.
  els.board.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (e.pointerType === 'touch' || e.pointerType === 'pen' || pressed?.fired) return;
    const i = cellIndex(e);
    if (i !== null) handleTap(i, true);
  });

  // Keyboard: Enter/Space digs, F (global) toggles flag mode.
  els.board.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const i = cellIndex(e);
    if (i === null) return;
    e.preventDefault();
    handleTap(i, false);
  });
}

// ---------- platform helpers ----------

function vibrate(pattern) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

function loadSetting(key, fallback) {
  try {
    return localStorage.getItem(`pwf:${key}`) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveSetting(key, value) {
  try {
    localStorage.setItem(`pwf:${key}`, value);
  } catch {
    /* storage unavailable */
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (location.protocol !== 'https:' && !local) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
