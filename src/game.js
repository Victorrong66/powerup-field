// Core game rules. No DOM access here so the logic can be tested in Node
// and reused unchanged if the UI is ever rebuilt (e.g. native app shell).

export const DIFFICULTIES = {
  easy: { label: 'Easy', rows: 9, cols: 9, mines: 10 },
  medium: { label: 'Medium', rows: 16, cols: 12, mines: 32 },
  hard: { label: 'Hard', rows: 22, cols: 14, mines: 62 },
};

export const POWERUPS = {
  shield: {
    name: 'Shield',
    icon: '🛡️',
    description: 'Automatically absorbs the next mine you hit.',
    weight: 3,
    passive: true,
  },
  scan: {
    name: 'Scanner',
    icon: '📡',
    description: 'Pick a tile: safely clears its 3×3 area and flags any mines.',
    weight: 3,
    targeted: true,
  },
  defuse: {
    name: 'Defuser',
    icon: '🔧',
    description: 'Finds and flags one hidden mine.',
    weight: 2,
  },
  freeze: {
    name: 'Time Freeze',
    icon: '❄️',
    description: 'Stops the clock for 15 seconds.',
    weight: 2,
  },
};

export const FREEZE_SECONDS = 15;
export const DEFAULT_POWERUP_CHANCE = 0.12;

export class Game {
  constructor({ rows, cols, mines, rng = Math.random, powerupChance = DEFAULT_POWERUP_CHANCE }) {
    if (mines >= rows * cols) throw new Error('Too many mines for board size');
    this.rows = rows;
    this.cols = cols;
    this.mineCount = mines;
    this.rng = rng;
    this.powerupChance = powerupChance;
    this.state = 'ready'; // ready | playing | won | lost
    this.elapsed = 0;
    this.frozenFor = 0;
    this.revealedCount = 0;
    this.inventory = Object.fromEntries(Object.keys(POWERUPS).map((k) => [k, 0]));
    this.cells = Array.from({ length: rows * cols }, () => ({
      mine: false,
      adjacent: 0,
      revealed: false,
      flagged: false,
      defused: false, // mine neutralised by a shield or scanner; shown as safe-flagged
      exploded: false,
    }));
  }

  index(r, c) {
    return r * this.cols + c;
  }

  inBounds(r, c) {
    return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
  }

  neighbors(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if ((dr || dc) && this.inBounds(r + dr, c + dc)) out.push([r + dr, c + dc]);
      }
    }
    return out;
  }

  get flagsPlaced() {
    return this.cells.filter((cell) => cell.flagged).length;
  }

  get minesLeft() {
    return this.mineCount - this.flagsPlaced;
  }

  get isOver() {
    return this.state === 'won' || this.state === 'lost';
  }

  // Mines are placed on the first reveal so the opening tap is always safe
  // (and, when the board has room, always opens an area).
  placeMines(safeR, safeC) {
    const excluded = new Set([this.index(safeR, safeC)]);
    const area = this.neighbors(safeR, safeC).map(([r, c]) => this.index(r, c));
    if (this.rows * this.cols - (area.length + 1) >= this.mineCount) {
      area.forEach((i) => excluded.add(i));
    }
    const candidates = [];
    for (let i = 0; i < this.cells.length; i++) if (!excluded.has(i)) candidates.push(i);
    for (let n = 0; n < this.mineCount; n++) {
      const pick = n + Math.floor(this.rng() * (candidates.length - n));
      [candidates[n], candidates[pick]] = [candidates[pick], candidates[n]];
      this.cells[candidates[n]].mine = true;
    }
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.cells[this.index(r, c)].adjacent = this.neighbors(r, c).filter(
          ([nr, nc]) => this.cells[this.index(nr, nc)].mine,
        ).length;
      }
    }
    this.state = 'playing';
  }

  // Reveal a tile. Returns a summary the UI uses for feedback.
  reveal(r, c) {
    const result = emptyResult();
    if (this.isOver || !this.inBounds(r, c)) return result;
    if (this.state === 'ready') this.placeMines(r, c);
    const cell = this.cells[this.index(r, c)];
    if (cell.revealed || cell.flagged) return result;

    this.openCell(r, c, result);
    this.finishMove(result);
    return result;
  }

  // Tapping a revealed number whose flag count matches opens its other neighbours.
  chord(r, c) {
    const result = emptyResult();
    if (this.state !== 'playing' || !this.inBounds(r, c)) return result;
    const cell = this.cells[this.index(r, c)];
    if (!cell.revealed || cell.adjacent === 0) return result;
    const around = this.neighbors(r, c);
    const flags = around.filter(([nr, nc]) => this.cells[this.index(nr, nc)].flagged).length;
    if (flags !== cell.adjacent) return result;
    for (const [nr, nc] of around) {
      const n = this.cells[this.index(nr, nc)];
      if (!n.revealed && !n.flagged) this.openCell(nr, nc, result);
      if (this.state === 'lost') break;
    }
    this.finishMove(result);
    return result;
  }

  toggleFlag(r, c) {
    if (this.isOver || !this.inBounds(r, c)) return false;
    const cell = this.cells[this.index(r, c)];
    if (cell.revealed || cell.defused) return false;
    cell.flagged = !cell.flagged;
    return true;
  }

  // Opens one cell (flood-filling zeros) and handles mines / shields.
  openCell(r, c, result) {
    const cell = this.cells[this.index(r, c)];
    if (cell.mine) {
      if (this.inventory.shield > 0) {
        this.inventory.shield--;
        cell.flagged = true;
        cell.defused = true;
        result.shieldUsed = true;
        result.defused.push(this.index(r, c));
      } else {
        cell.exploded = true;
        this.state = 'lost';
        result.exploded = true;
      }
      return;
    }
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop();
      const cur = this.cells[this.index(cr, cc)];
      if (cur.revealed || cur.flagged || cur.mine) continue;
      cur.revealed = true;
      this.revealedCount++;
      result.revealed.push(this.index(cr, cc));
      if (cur.adjacent === 0) stack.push(...this.neighbors(cr, cc));
    }
  }

  finishMove(result) {
    if (this.state === 'lost') {
      this.cells.forEach((cell) => {
        if (cell.mine && !cell.defused) cell.revealed = true;
      });
      return;
    }
    if (this.checkWin()) {
      result.won = true;
      return;
    }
    // One roll per successful move (not per flood-filled tile), so big
    // openings don't shower the player with rewards.
    if (result.revealed.length > 0 && this.rng() < this.powerupChance) {
      const type = this.rollPowerup();
      this.inventory[type]++;
      result.powerup = type;
    }
  }

  checkWin() {
    if (this.revealedCount === this.cells.length - this.mineCount) {
      this.state = 'won';
      this.cells.forEach((cell) => {
        if (cell.mine) cell.flagged = true;
      });
      return true;
    }
    return false;
  }

  rollPowerup() {
    const entries = Object.entries(POWERUPS);
    const total = entries.reduce((sum, [, p]) => sum + p.weight, 0);
    let roll = this.rng() * total;
    for (const [type, p] of entries) {
      roll -= p.weight;
      if (roll < 0) return type;
    }
    return entries[entries.length - 1][0];
  }

  // Use a power-up from the inventory. Targeted power-ups need (r, c).
  usePowerup(type, r, c) {
    const result = emptyResult();
    if (this.state !== 'playing' || !this.inventory[type]) return { ...result, used: false };

    if (type === 'scan') {
      if (!this.inBounds(r, c)) return { ...result, used: false };
      for (const [sr, sc] of [[r, c], ...this.neighbors(r, c)]) {
        const cell = this.cells[this.index(sr, sc)];
        if (cell.mine) {
          if (!cell.defused) {
            cell.flagged = true;
            cell.defused = true;
            result.defused.push(this.index(sr, sc));
          }
        } else if (!cell.revealed) {
          cell.flagged = false;
          this.openCell(sr, sc, result);
        }
      }
      this.checkWin() && (result.won = true);
    } else if (type === 'defuse') {
      const hidden = [];
      this.cells.forEach((cell, i) => {
        if (cell.mine && !cell.defused && !cell.flagged) hidden.push(i);
      });
      // Prefer an unflagged mine; if every mine is already flagged, confirm one instead.
      const pool = hidden.length
        ? hidden
        : this.cells.flatMap((cell, i) => (cell.mine && !cell.defused ? [i] : []));
      if (!pool.length) return { ...result, used: false };
      const i = pool[Math.floor(this.rng() * pool.length)];
      this.cells[i].flagged = true;
      this.cells[i].defused = true;
      result.defused.push(i);
    } else if (type === 'freeze') {
      this.frozenFor += FREEZE_SECONDS;
    } else if (type === 'shield') {
      return { ...result, used: false }; // passive: triggers automatically
    }

    this.inventory[type]--;
    return { ...result, used: true };
  }

  // Called once per second by the UI while the game is running.
  tick() {
    if (this.state !== 'playing') return;
    if (this.frozenFor > 0) this.frozenFor--;
    else this.elapsed++;
  }
}

function emptyResult() {
  return {
    revealed: [],
    defused: [],
    exploded: false,
    shieldUsed: false,
    won: false,
    powerup: null,
  };
}
