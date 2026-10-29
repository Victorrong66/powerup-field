import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, FREEZE_SECONDS } from '../src/game.js';

// Deterministic RNG so boards are reproducible.
function seeded(seed = 1) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

// Build a game with mines at fixed positions, skipping random placement.
function fixedBoard(rows, cols, minePositions, opts = {}) {
  const game = new Game({ rows, cols, mines: minePositions.length, rng: seeded(), ...opts });
  for (const [r, c] of minePositions) game.cells[game.index(r, c)].mine = true;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      game.cells[game.index(r, c)].adjacent = game
        .neighbors(r, c)
        .filter(([nr, nc]) => game.cells[game.index(nr, nc)].mine).length;
    }
  }
  game.state = 'playing';
  return game;
}

test('first reveal is always safe and opens an area', () => {
  for (let s = 1; s < 50; s++) {
    const game = new Game({ rows: 9, cols: 9, mines: 10, rng: seeded(s), dropChance: () => 0 });
    const res = game.reveal(4, 4);
    assert.equal(res.exploded, false);
    assert.equal(game.cells.filter((c) => c.mine).length, 10);
    for (const [r, c] of [[4, 4], ...game.neighbors(4, 4)]) {
      assert.equal(game.cells[game.index(r, c)].mine, false);
    }
  }
});

test('hitting a mine without a shield loses', () => {
  const game = fixedBoard(3, 3, [[0, 0]], { dropChance: () => 0 });
  const res = game.reveal(0, 0);
  assert.equal(res.exploded, true);
  assert.equal(game.state, 'lost');
});

test('shield absorbs a mine and is consumed', () => {
  const game = fixedBoard(3, 3, [[0, 0]], { dropChance: () => 0 });
  game.inventory.shield = 1;
  const res = game.reveal(0, 0);
  assert.equal(res.shieldUsed, true);
  assert.equal(game.state, 'playing');
  assert.equal(game.inventory.shield, 0);
  assert.equal(game.cells[0].defused, true);
});

test('revealing every safe tile wins', () => {
  const game = fixedBoard(3, 3, [[0, 0]], { dropChance: () => 0 });
  game.reveal(2, 2); // flood-fills everything except the mine
  assert.equal(game.state, 'won');
});

test('clearing an empty area drops a power-up onto a cleared blank tile', () => {
  // A wall of mines across row 2 stops the clearing, so the game isn't won.
  const wall = [0, 1, 2, 3, 4].map((c) => [2, c]);
  const game = fixedBoard(5, 5, wall, { dropChance: () => 1 });
  const res = game.reveal(0, 4); // a blank tile, so it opens an area
  assert.equal(game.state, 'playing');
  assert.ok(res.drop);
  const cell = game.cells[res.drop.index];
  assert.equal(cell.revealed, true);
  assert.equal(cell.adjacent, 0);
  assert.equal(cell.drop, res.drop.type);
  // It sits on the board until picked up.
  assert.equal(Object.values(game.inventory).reduce((a, b) => a + b, 0), 0);
  const r = Math.floor(res.drop.index / 5);
  const c = res.drop.index % 5;
  assert.equal(game.collect(r, c), res.drop.type);
  assert.equal(game.inventory[res.drop.type], 1);
  assert.equal(cell.drop, null);
  assert.equal(game.collect(r, c), null);
});

test('no drop from a single number tile, a failed move, or a losing roll', () => {
  const number = fixedBoard(4, 4, [[0, 0], [3, 3]], { dropChance: () => 1 });
  assert.equal(number.reveal(0, 1).drop, null); // a "1", nothing cleared
  const boom = fixedBoard(4, 4, [[0, 0], [3, 3]], { dropChance: () => 1 });
  assert.equal(boom.reveal(0, 0).drop, null);
  const unlucky = fixedBoard(4, 4, [[0, 0], [3, 3]], { dropChance: () => 0 });
  assert.equal(unlucky.reveal(0, 3).drop, null);
});

test('bigger clearings have better drop odds, capped', async () => {
  const { defaultDropChance } = await import('../src/game.js');
  assert.ok(defaultDropChance(30) > defaultDropChance(3));
  assert.equal(defaultDropChance(1000), 0.6);
});

test('scanner clears the 3x3 area and flags its mines', () => {
  const game = fixedBoard(5, 5, [[1, 1], [4, 4]], { dropChance: () => 0 });
  game.inventory.scan = 1;
  const res = game.usePowerup('scan', 1, 1);
  assert.equal(res.used, true);
  assert.equal(game.inventory.scan, 0);
  assert.equal(game.cells[game.index(1, 1)].defused, true);
  assert.equal(game.cells[game.index(0, 0)].revealed, true);
  assert.equal(game.cells[game.index(2, 2)].revealed, true);
  assert.equal(game.state, 'playing');
});

test('defuser flags a real mine', () => {
  const game = fixedBoard(5, 5, [[2, 3]], { dropChance: () => 0 });
  game.inventory.defuse = 1;
  assert.equal(game.usePowerup('defuse').used, true);
  assert.equal(game.cells[game.index(2, 3)].defused, true);
  assert.equal(game.cells[game.index(2, 3)].flagged, true);
});

test('time freeze pauses the clock', () => {
  const game = fixedBoard(3, 3, [[0, 0]], { dropChance: () => 0 });
  game.inventory.freeze = 1;
  game.usePowerup('freeze');
  for (let i = 0; i < FREEZE_SECONDS; i++) game.tick();
  assert.equal(game.elapsed, 0);
  game.tick();
  assert.equal(game.elapsed, 1);
});

test('cannot use a power-up you do not have', () => {
  const game = fixedBoard(3, 3, [[0, 0]], { dropChance: () => 0 });
  assert.equal(game.usePowerup('defuse').used, false);
  assert.equal(game.usePowerup('shield').used, false);
});

test('chord opens neighbours when flags match', () => {
  const game = fixedBoard(3, 3, [[0, 0]], { dropChance: () => 0 });
  game.reveal(1, 1);
  game.toggleFlag(0, 0);
  game.chord(1, 1);
  assert.equal(game.state, 'won');
});

test('fitBoard shapes the board to the screen and keeps mine density', async () => {
  const { fitBoard, DIFFICULTIES } = await import('../src/game.js');
  const square = fitBoard(DIFFICULTIES.easy, 1);
  assert.deepEqual([square.rows, square.cols], [9, 9]);
  const tall = fitBoard(DIFFICULTIES.hard, 0.6);
  assert.ok(tall.rows > tall.cols);
  const wide = fitBoard(DIFFICULTIES.hard, 2);
  assert.ok(wide.cols > wide.rows);
  const density = wide.mines / (wide.rows * wide.cols);
  assert.ok(Math.abs(density - DIFFICULTIES.hard.density) < 0.01);
  // Bad measurements fall back to a square board instead of breaking.
  assert.deepEqual(fitBoard(DIFFICULTIES.easy, NaN), square);
  assert.deepEqual(fitBoard(DIFFICULTIES.easy, Infinity), square);
});
