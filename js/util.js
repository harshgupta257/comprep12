// Small shared helpers: escaping, HTML sanitising, colours, dates, UI bits.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const arr = (v) => (Array.isArray(v) ? v : []);
export const str = (v) => (typeof v === 'string' ? v : v == null ? '' : String(v));

// ---------------------------------------------------------------------------
// Restricted-HTML sanitiser. Content comes from our own data files, but we
// still strip anything outside the contract so a typo can never break layout
// or run script.
const ALLOWED = new Set(['p', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'u', 'sup', 'sub', 'br', 'table', 'thead',
  'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'h4', 'h5', 'blockquote', 'span', 'small', 'hr', 'mark', 'code',
  'dl', 'dt', 'dd', 'colgroup', 'col']);
const DROP = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'img', 'video', 'audio',
  'svg', 'math', 'form', 'input', 'button', 'select', 'textarea', 'template', 'noscript', 'frame', 'frameset', 'base']);
const NUMERIC = /^[\s(₹$-]*[-+−]?[\d,]+(\.\d+)?[\s)%]*(Dr\.?|Cr\.?)?$/;

const cleanCache = new Map();
export function clean(html) {
  const src = str(html);
  if (!src) return '';
  if (cleanCache.has(src)) return cleanCache.get(src);
  const t = document.createElement('template');
  t.innerHTML = src;
  walk(t.content);
  // wrap tables so they scroll sideways inside their own box
  for (const table of t.content.querySelectorAll('table')) {
    const wrap = document.createElement('div');
    wrap.className = 'tbl';
    table.replaceWith(wrap);
    wrap.appendChild(table);
    for (const cell of table.querySelectorAll('td')) {
      const txt = cell.textContent.trim();
      if (txt && NUMERIC.test(txt)) cell.classList.add('num');
    }
  }
  const out = t.innerHTML;
  if (cleanCache.size > 3000) cleanCache.clear();
  cleanCache.set(src, out);
  return out;
}
function walk(node) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === 8) { child.remove(); continue; } // comments
    if (child.nodeType !== 1) continue;
    const tag = child.tagName.toLowerCase();
    if (DROP.has(tag)) { child.remove(); continue; }
    walk(child);
    if (!ALLOWED.has(tag)) {
      // unknown tag: keep its children, lose the wrapper
      child.replaceWith(...Array.from(child.childNodes));
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const n = attr.name.toLowerCase();
      if ((n === 'colspan' || n === 'rowspan' || n === 'span') && /^\d{1,2}$/.test(attr.value)) continue;
      child.removeAttribute(attr.name);
    }
  }
}

export function plain(html) {
  const t = document.createElement('template');
  t.innerHTML = str(html);
  return (t.content.textContent || '').replace(/\s+/g, ' ').trim();
}

export function clip(s, n = 110) {
  s = str(s);
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

// ---------------------------------------------------------------------------
// Colour: derive per-theme accents from a subject colour with good contrast.
function hexRgb(hex) {
  let h = str(hex).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
function lum([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const LIGHT_SURF = [255, 255, 255], LIGHT_BG = [245, 243, 238];
const DARK_SURF = [23, 28, 31], DARK_BG = [14, 18, 20];
function fit(rgb, surface, toward) {
  let c = rgb;
  for (let t = 0; t <= 1.0001 && contrast(c, surface) < 4.6; t += 0.04) c = mix(rgb, toward, t);
  return c;
}
const accentCache = new Map();
export function accentStyle(hex) {
  const key = str(hex);
  if (accentCache.has(key)) return accentCache.get(key);
  const rgb = hexRgb(hex) || [18, 81, 90];
  const light = fit(fit(rgb, LIGHT_SURF, [0, 0, 0]), LIGHT_BG, [0, 0, 0]);
  const dark = fit(fit(rgb, DARK_SURF, [255, 255, 255]), DARK_BG, [255, 255, 255]);
  const style = [
    `--al:${toHex(light)}`, `--ad:${toHex(dark)}`,
    `--tl:${toHex(mix(rgb, LIGHT_SURF, 0.86))}`, `--td:${toHex(mix(rgb, DARK_SURF, 0.78))}`,
    `--raw:${toHex(rgb)}`,
  ].join(';');
  accentCache.set(key, style);
  return style;
}

// ---------------------------------------------------------------------------
// Dates
export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function daysUntil(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(dateStr))) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / 86400000);
}
export function fmtDate(dateStr) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str(dateStr))) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
export function ago(ts) {
  if (!ts) return '';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const reducedMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

// ---------------------------------------------------------------------------
// UI bits
export function ring(pct, size = 52, stroke = 5, label = true) {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return `<span class="ring" style="width:${size}px;height:${size}px" role="img" aria-label="${p}% complete">
    <svg viewBox="0 0 ${size} ${size}" aria-hidden="true">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-track"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" class="ring-val"
        stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p / 100)).toFixed(2)}"/>
    </svg>${label ? `<b>${p}<small>%</small></b>` : ''}</span>`;
}

export function bar(pct, cls = '') {
  const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
  return `<span class="bar ${cls}" role="img" aria-label="${p}%"><i style="width:${p}%"></i></span>`;
}

export const ICONS = {
  bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4.5-6.5 4.5v-16a1 1 0 0 1 1-1z"/></svg>',
  gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5l5 5 10-11"/></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21c-4 0-6.5-2.7-6.5-6.2 0-3.6 2.8-5.6 3.8-9.3 2 1.3 3.2 3.2 3.4 5.3.9-.6 1.6-1.6 1.9-2.8 2 1.7 3.9 4.2 3.9 6.8 0 3.5-2.5 6.2-6.5 6.2z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3.5c2 0 3 1 4.5 3.5S14.5 17 16.5 17H20M4 17h3.5c1.3 0 2.2-.5 3-1.4M13.5 8.4c.8-.9 1.7-1.4 3-1.4H20M17.5 4.5L20 7l-2.5 2.5M17.5 14.5L20 17l-2.5 2.5"/></svg>',
  cards: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6.5" width="13" height="14" rx="2"/><path d="M7.5 3.5h11a2 2 0 0 1 2 2v11"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
};

// toast
let toastTimer = 0;
export function toast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// confirmation sheet (returns Promise<boolean>)
export function confirmSheet({ title, body = '', ok = 'Confirm', cancel = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const slot = document.getElementById('modal-slot');
    const prevFocus = document.activeElement;
    slot.innerHTML = `<div class="scrim" data-x="cancel"></div>
      <div class="sheet" role="alertdialog" aria-modal="true" aria-labelledby="sheet-t">
        <h2 id="sheet-t">${esc(title)}</h2>${body ? `<p>${esc(body)}</p>` : ''}
        <div class="sheet-actions">
          <button type="button" class="btn ${danger ? 'danger' : 'primary'}" data-x="ok">${esc(ok)}</button>
          <button type="button" class="btn ghost" data-x="cancel">${esc(cancel)}</button>
        </div></div>`;
    const done = (v) => { slot.innerHTML = ''; document.removeEventListener('keydown', onKey); try { prevFocus && prevFocus.focus(); } catch (e) { /* ignore */ } resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onKey);
    slot.addEventListener('click', function h(e) {
      const x = e.target.closest('[data-x]');
      if (!x) return;
      slot.removeEventListener('click', h);
      done(x.dataset.x === 'ok');
    });
    const btn = slot.querySelector('[data-x="cancel"].btn');
    btn && btn.focus();
  });
}
