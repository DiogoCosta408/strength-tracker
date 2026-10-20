// Offline support: cache-first for built assets, network-first for the app shell.
// v2 — v1 poisoned its own shell entry, so the name change is what evicts it (see below).
// v3 — new icons.
const CACHE = 'strength-tracker-v3';
const SHELL = './index.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', SHELL, './manifest.webmanifest', './icon.svg'])));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

/**
 * The OAuth round trip comes back as a top-level navigation to oauth-callback.html. It must
 * never be cached, and must never be cached AS the shell: v1 stored every navigation
 * response under the shell key, so one Drive sign-in left the callback page standing in for
 * the whole app, and the next navigation that failed its network fetch — routine on mobile
 * data, near-never on desktop wi-fi — served that instead. It reads an empty hash, saves no
 * token and bounces back to './', which is exactly "Drive connection always fails on the
 * phone". Let it go straight to the network.
 */
const isAppShell = (url) => {
  const path = new URL(url).pathname;
  return path.endsWith('/') || path.endsWith('/index.html');
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    if (!isAppShell(req.url)) return; // oauth-callback.html and anything else: network only
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(SHELL, copy));
          }
          return res;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }
  // Built assets carry a content hash, so a cache hit is never stale and the network is never
  // needed. Everything else under public/ (icons, manifest) keeps its filename across releases,
  // so a plain cache-first would pin whatever shipped first: serve the hit, refresh behind it.
  const immutable = new URL(req.url).pathname.includes('/assets/');
  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit && immutable) return hit; // hashed name, so the cached copy is the right one
      const fresh = fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      });
      if (!hit) return fresh;
      fresh.catch(() => {}); // refreshing behind an already-served hit: failing is fine
      return hit;
    }),
  );
});
