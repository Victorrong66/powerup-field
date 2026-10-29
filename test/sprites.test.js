import test from 'node:test';
import assert from 'node:assert/strict';
import { sprite, SPRITE_NAMES } from '../src/sprites.js';

test('every sprite has a rectangular grid and renders to SVG', () => {
  for (const name of SPRITE_NAMES) {
    assert.match(sprite(name), /^<svg class="sprite"/, name);
  }
});

test('faces share the same 16x16 size', () => {
  for (const name of ['smile', 'dead', 'cool']) {
    assert.match(sprite(name), /viewBox="0 0 16 16"/, name);
  }
});
