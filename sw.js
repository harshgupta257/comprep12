/* ComPrep 12 service worker.
 * - Shell: precached, cache-first, versioned cache name (bump VERSION on every release).
 * - data/: stale-while-revalidate in a separate cache that survives shell updates.
 */
const VERSION = 'v1.2.0';
const SHELL_CACHE = `comprep-shell-${VERSION}`;
const DATA_CACHE = 'comprep-data-v1'; // must match js/data.js
const PAPERS_CACHE = 'comprep-papers-v1';

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/util.js',
  'js/store.js',
  'js/data.js',
  'js/theme.js',
  'js/views/home.js',
  'js/views/subject.js',
  'js/views/chapter.js',
  'js/views/quiz.js',
  'js/views/search.js',
  'js/views/lists.js',
  'js/views/settings.js',
  'js/views/resources.js',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-192.png',
  'icons/icon-maskable-512.png',
  'data/subjects.json',
];

const scoped = (p) => new URL(p, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL.map((p) => new Request(scoped(p), { cache: 'reload' }))))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, DATA_CACHE, PAPERS_CACHE]);
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.startsWith('comprep-') && !keep.has(n)).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope);
  const rel = url.pathname.startsWith(scope.pathname) ? url.pathname.slice(scope.pathname.length) : url.pathname;

  if (rel.startsWith('data/')) {
    event.respondWith(staleWhileRevalidate(req, event));
    return;
  }
  if (rel.startsWith('papers/')) {
    // bundled PDFs: cached on first open, kept across shell updates; range requests go to the network
    if (req.headers.has('range')) return;
    event.respondWith((async () => {
      const cache = await caches.open(PAPERS_CACHE);
      const hit = await cache.match(url.pathname);
      if (hit) return hit;
      try {
        const res = await fetch(url.pathname);
        if (res.ok && res.status === 200) cache.put(url.pathname, res.clone());
        return res;
      } catch (e) {
        return new Response('This paper has not been saved for offline use yet. Open it once while online.', { status: 504, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }
  if (req.mode === 'navigate') {
    // hash routing: every navigation is the shell page
    event.respondWith(
      caches.match(scoped('index.html'), { ignoreSearch: true }).then((hit) => hit || fetch(req))
        .catch(() => caches.match(scoped('./')))
    );
    return;
  }
  event.respondWith(cacheFirst(req));
});

async function cacheFirst(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (e) {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

async function staleWhileRevalidate(req, event) {
  const cache = await caches.open(DATA_CACHE);
  const hit = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  }).catch(() => null);
  if (hit) {
    event.waitUntil(network);
    return hit;
  }
  const res = await network;
  if (res) return res;
  // also look in the shell cache (data/subjects.json is precached there)
  const shellHit = await caches.match(req, { ignoreSearch: true });
  return shellHit || new Response('null', { status: 504, headers: { 'Content-Type': 'application/json' } });
}
