// Service worker for offline play. tools/deploy-web.mjs stamps the cache name with the build id,
// so every deploy starts a fresh cache and drops the previous one.
// Pages: network first (a new build is picked up as soon as you're online), cache as fallback.
// Everything else: cache first — Cocos names its files by content hash (md5Cache).

const CACHE = 'spaceflight-__BUILD__';
// Absolute URLs only: md5Cache rewrites relative path literals in template files (even in
// comments), so the scope root is taken from the registration.
const ROOT = self.registration.scope;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([ROOT, ROOT + 'index.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('spaceflight-') && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match(ROOT + 'index.html'))),
    );
    return;
  }
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
