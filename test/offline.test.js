import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

// The service worker precaches the app for offline play; every file it
// lists has to exist or installing it fails.
test('service worker lists only files that exist', () => {
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const tiles = JSON.parse(sw.match(/const TILES = (\[.*?\]);/)[1].replace(/'/g, '"'));
  const assets = sw
    .match(/const ASSETS = \[(.*?)\];/)[1]
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.startsWith("'"))
    .map((s) => s.slice(1, -1))
    .filter((p) => p !== './');
  assert.ok(assets.includes('index.html'));
  for (const path of [...assets, ...tiles.map((t) => `assets/tiles/${t}.png`)]) {
    assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), `missing ${path}`);
  }
});
