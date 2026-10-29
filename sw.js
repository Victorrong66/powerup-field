// Cache-first service worker so the game works offline once loaded.
// Bump CACHE when shipping changes so players get the new files.
const CACHE = 'powerup-field-v3';
const TILES = ['hidden', 'open', 'flag', 'mine', 'exploded', 'wrong', 'defused', '1', '2', '3', '4', '5', '6', '7', '8'];
const ASSETS = ['./', 'index.html', 'style.css', 'src/main.js', 'src/game.js', 'src/sprites.js', 'manifest.webmanifest', 'icon.svg', ...TILES.map((t) => `assets/tiles/${t}.png`)];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});
