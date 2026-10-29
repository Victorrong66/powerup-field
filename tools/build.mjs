// Copies just the files the game needs into dist/, which Cloudflare serves
// (see wrangler.jsonc). Tests, tools and the tile source sheet stay out.
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const FILES = ['index.html', 'style.css', 'sw.js', 'manifest.webmanifest', 'icon.svg', 'src', 'assets/tiles', 'assets/icons', 'assets/fonts'];

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/assets', { recursive: true });
for (const path of FILES) cpSync(path, `dist/${path}`, { recursive: true });
console.log(`Built dist/ (${FILES.length} entries)`);
