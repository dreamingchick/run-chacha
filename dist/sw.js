'use strict';
const CACHE = 'chacha-release-1.0.0-b8263a294f8f';
const FILES = ['./', './index.html', './style.css', './chacha.js', './pwa.js', './manifest.webmanifest', './assets/chowRun.jpg', './assets/radish.jpg', './assets/cabbage.jpg', './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable.png', './assets/apple-touch-icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
  // Let an existing game finish. A new release activates after old tabs close.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith('chacha-release-') && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  // Serve a consistent release from one precache. Do not mix new JS with old HTML.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const path = new URL(request.url).pathname;
    const base = new URL('./', self.location.href).pathname;
    if (request.mode === 'navigate' && (path === base || path === base + 'index.html')) {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    return await cache.match(request, {ignoreSearch: false}) || fetch(request);
  })());
});
