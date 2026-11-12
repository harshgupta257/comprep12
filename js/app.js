// ComPrep 12 — app shell: router, top bar, theme, service worker, install hint.
import { $, esc, toast, ICONS } from './util.js';
import * as store from './store.js';
import { homeView } from './views/home.js';
import { subjectView } from './views/subject.js';
import { chapterView } from './views/chapter.js';
import { quizView, mockView } from './views/quiz.js';
import { searchView } from './views/search.js';
import { savedView, progressView } from './views/lists.js';
import { settingsView } from './views/settings.js';
import { resourcesView } from './views/resources.js';

import { applyAppearance } from './theme.js';

// ---------------------------------------------------------------------------
// Router
const routes = [
  [/^\/?$/, homeView, 'home'],
  [/^\/subject\/([^/]+)$/, subjectView, 'home'],
  [/^\/chapter\/([^/]+)\/([^/]+)(?:\/([a-z]+))?(?:\/(\d+))?$/, chapterView, 'home'],
  [/^\/quiz\/([^/]+)\/([^/]+)$/, quizView, 'focus'],
  [/^\/mock\/([^/]+)$/, mockView, 'focus'],
  [/^\/resources\/([^/]+)\/([A-Za-z]+)$/, resourcesView, 'home'],
  [/^\/search$/, searchView, 'search'],
  [/^\/saved$/, savedView, 'saved'],
  [/^\/progress$/, progressView, 'progress'],
  [/^\/settings$/, settingsView, 'home'],
];

const stack = [];               // our own view of history, to detect "back"
const scrollMem = new Map();    // hash -> scrollY
let current = null;             // { hash, cleanups, token, onBack, fallback }
let token = 0;

const curHash = () => location.hash || '#/';
const splitHash = (h) => {
  const raw = h.replace(/^#/, '') || '/';
  const qi = raw.indexOf('?');
  return { path: qi < 0 ? raw : raw.slice(0, qi), query: new URLSearchParams(qi < 0 ? '' : raw.slice(qi + 1)) };
};

// Replace the current hash without creating a history entry or re-rendering.
export function replaceHash(h) {
  try { history.replaceState(history.state, '', h); } catch (e) { /* ignore */ }
  if (stack.length) stack[stack.length - 1] = h;
  if (current) current.hash = h;
}
export function go(h) { location.hash = h; }

function setTop({ title = null, back = null, actions = '', onBack = null } = {}) {
  const t = $('#top-title'), brand = $('#brand'), b = $('#back-btn');
  if (title) { t.textContent = title; t.hidden = false; brand.hidden = true; }
  else { t.hidden = true; brand.hidden = false; }
  b.hidden = !back;
  $('#top-actions').innerHTML = actions;
  if (current) { current.fallback = back; current.onBack = onBack; }
  document.title = title ? `${title} · ComPrep 12` : 'ComPrep 12';
}

function goBack() {
  if (stack.length > 1) history.back();
  else if (current && current.fallback) { location.replace(current.fallback); }
}

$('#back-btn').addEventListener('click', async () => {
  if (current && current.onBack) {
    const ok = await current.onBack();
    if (!ok) return;
  }
  goBack();
});

async function render(isBack) {
  const hash = curHash();
  const { path, query } = splitHash(hash);
  // tear down previous view
  if (current) for (const fn of current.cleanups) { try { fn(); } catch (e) { /* ignore */ } }
  const my = ++token;
  current = { hash, cleanups: [], token: my, onBack: null, fallback: null };

  let match = null, view = null, tab = 'home';
  for (const [re, fn, t] of routes) { const m = path.match(re); if (m) { match = m; view = fn; tab = t; break; } }

  document.body.classList.toggle('focus-mode', tab === 'focus');
  for (const a of document.querySelectorAll('.tabbar a')) {
    const on = a.dataset.tab === tab;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  }

  const page = document.createElement('div');
  page.className = 'page';
  const viewEl = $('#view');
  viewEl.replaceChildren(page);
  if (!isBack) window.scrollTo(0, 0);

  const ctx = {
    page, query, hash,
    params: match ? match.slice(1).map((x) => (x ? decodeURIComponent(x) : x)) : [],
    top: setTop,
    alive: () => token === my,
    cleanup: (fn) => current.cleanups.push(fn),
    replaceHash,
  };
  setTop({ title: null });
  try {
    if (!view) notFound(ctx);
    else await view(ctx);
  } catch (err) {
    console.error(err);
    if (ctx.alive()) {
      page.innerHTML = `<div class="empty"><div class="empty-ic">⚠️</div><h2>Something went wrong</h2>
        <p>This screen couldn't be shown. Your progress is safe.</p><a class="btn primary" href="#/">Go home</a></div>`;
    }
  }
  if (!ctx.alive()) return;
  if (isBack && scrollMem.has(hash)) {
    const y = scrollMem.get(hash);
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
  maybeShowHint();
}

function notFound(ctx) {
  ctx.top({ title: 'Not found', back: '#/' });
  ctx.page.innerHTML = `<div class="empty"><div class="empty-ic">🧭</div><h2>Page not found</h2>
    <p>That link doesn't lead anywhere in ComPrep 12.</p><a class="btn primary" href="#/">Go home</a></div>`;
}

window.addEventListener('hashchange', (e) => {
  const oldHash = e.oldURL && e.oldURL.includes('#') ? e.oldURL.slice(e.oldURL.indexOf('#')) : '#/';
  scrollMem.set(current ? current.hash : oldHash, window.scrollY);
  const h = curHash();
  let isBack = false;
  if (stack.length > 1 && stack[stack.length - 2] === h) { stack.pop(); isBack = true; }
  else stack.push(h);
  if (stack.length > 200) stack.splice(0, stack.length - 200);
  render(isBack);
});

// ---------------------------------------------------------------------------
// "Add to Home Screen" hint for iOS Safari when not installed
function maybeShowHint() {
  const slot = $('#hint-slot');
  if (slot.dataset.shown) return;
  const ua = navigator.userAgent || '';
  const iOS = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua);
  const standalone = navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  if (!iOS || !safari || standalone || store.get().flags.hintDismissed) return;
  slot.dataset.shown = '1';
  slot.innerHTML = `<div class="hint" role="dialog" aria-label="Install ComPrep 12">
      <img src="icons/icon-192.png" alt="" width="40" height="40">
      <p><b>Install ComPrep 12</b>Tap <span class="share-ic" aria-label="Share">${ICONS.share}</span> Share, then <b class="inline">Add to Home Screen</b> to study offline, full screen.</p>
      <button type="button" class="icon-btn" aria-label="Dismiss">${ICONS.cross}</button>
    </div>`;
  slot.querySelector('button').addEventListener('click', () => {
    slot.innerHTML = '';
    store.update((s) => { s.flags.hintDismissed = true; });
  });
}

// ---------------------------------------------------------------------------
// Service worker
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!secure) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (worker) => {
      if (!worker || !navigator.serviceWorker.controller) return;
      showUpdate(() => worker.postMessage({ type: 'SKIP_WAITING' }));
    };
    if (reg.waiting) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w); });
    });
  }).catch((err) => console.warn('SW registration failed', err));
}
function showUpdate(apply) {
  const slot = $('#modal-slot');
  if (slot.querySelector('.update')) return;
  const el = document.createElement('div');
  el.className = 'update';
  el.innerHTML = `<span>A new version of ComPrep 12 is ready.</span><button type="button" class="btn small primary">Reload</button>`;
  el.querySelector('button').addEventListener('click', apply);
  slot.appendChild(el);
}

// ---------------------------------------------------------------------------
// Boot
try { history.scrollRestoration = 'manual'; } catch (e) { /* ignore */ }
applyAppearance();
stack.push(curHash());
render(false);
registerSW();
window.addEventListener('pageshow', (e) => { if (e.persisted) applyAppearance(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') applyAppearance();
});
// expose for debugging in dev tools
window.__comprep = { store, toast, esc };
