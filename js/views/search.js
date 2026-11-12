import { esc, plain, accentStyle, ICONS } from '../util.js';
import { allSubjects, chaptersOf, forEachChapter } from '../data.js';

// ---------------------------------------------------------------------------
// Background search index. Built once, lazily, the first time Search opens.
const idx = { entries: [], done: 0, total: 0, ready: false, started: false, subjects: [] };
const listeners = new Set();
const notify = () => listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });

const KIND = { chapter: 'Chapter', term: 'Key term', note: 'Notes', question: 'Q&A', mcq: 'MCQ' };
const WEIGHT = { chapter: 6, term: 5, note: 3, question: 2, mcq: 1 };

function add(e) {
  e.hay = `${e.title} ${e.body}`.toLowerCase();
  e.tl = e.title.toLowerCase();
  idx.entries.push(e);
}

export function buildIndex() {
  if (idx.started) return;
  idx.started = true;
  (async () => {
    const subs = (await allSubjects()).filter((s) => s && !s.missing);
    idx.subjects = subs;
    for (const s of subs) for (const c of chaptersOf(s)) {
      add({ kind: 'chapter', s, cid: c.id, ctitle: c.title, title: c.title, body: c.unit.title, href: chHref(s.id, c.id) });
    }
    notify();
    await forEachChapter((s, meta, c) => {
      if (!c) return;
      const ct = c.title || meta.title;
      const chap = idx.entries.find((e) => e.kind === 'chapter' && e.s.id === s.id && e.cid === meta.id);
      if (chap && c.summary) { chap.body += ' ' + c.summary; chap.hay = `${chap.title} ${chap.body}`.toLowerCase(); }
      c.keyTerms.forEach((t, i) => add({ kind: 'term', s, cid: meta.id, ctitle: ct, title: t.term, body: plain(t.definition), href: chHref(s.id, meta.id, 'terms', i) }));
      c.notes.forEach((n, i) => add({ kind: 'note', s, cid: meta.id, ctitle: ct, title: n.heading, body: plain(n.html), href: chHref(s.id, meta.id, 'notes', i) }));
      c.questions.forEach((q, i) => add({ kind: 'question', s, cid: meta.id, ctitle: ct, title: plain(q.q), body: plain(q.answerHtml), href: chHref(s.id, meta.id, 'qa', i) }));
      c.mcqs.forEach((m, i) => add({ kind: 'mcq', s, cid: meta.id, ctitle: ct, title: plain(m.q), body: m.options.map(plain).join(' · '), href: chHref(s.id, meta.id, 'mcqs', i) }));
    }, (done, total) => { idx.done = done; idx.total = total; notify(); });
    idx.ready = true;
    notify();
  })().catch((err) => { console.warn('index failed', err); idx.ready = true; notify(); });
}

const chHref = (sid, cid, tab, i) => `#/chapter/${encodeURIComponent(sid)}/${encodeURIComponent(cid)}${tab ? `/${tab}/${i}` : ''}`;

function find(q, sid) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const phrase = words.join(' ');
  const out = [];
  for (const e of idx.entries) {
    if (sid && e.s.id !== sid) continue;
    if (!words.every((w) => e.hay.includes(w))) continue;
    let score = WEIGHT[e.kind];
    if (e.tl.includes(phrase)) score += 8;
    if (e.tl.startsWith(phrase)) score += 4;
    if (words.every((w) => e.tl.includes(w))) score += 3;
    out.push([score, e]);
  }
  out.sort((a, b) => b[0] - a[0]);
  return out.slice(0, 80).map((x) => x[1]);
}

// Highlight words in raw text, escaping everything else.
function hl(text, words) {
  if (!text) return '';
  const lower = text.toLowerCase();
  const marks = [];
  for (const w of words) {
    let p = lower.indexOf(w);
    while (p >= 0 && marks.length < 40) { marks.push([p, p + w.length]); p = lower.indexOf(w, p + w.length); }
  }
  marks.sort((a, b) => a[0] - b[0]);
  let out = '', pos = 0;
  for (const [a, b] of marks) {
    if (a < pos) continue;
    out += esc(text.slice(pos, a)) + '<mark>' + esc(text.slice(a, b)) + '</mark>';
    pos = b;
  }
  return out + esc(text.slice(pos));
}

function snippet(body, words, n = 150) {
  if (!body) return '';
  const lower = body.toLowerCase();
  let at = -1;
  for (const w of words) { const p = lower.indexOf(w); if (p >= 0 && (at < 0 || p < at)) at = p; }
  if (at < 0) return body.length > n ? body.slice(0, n) + '…' : body;
  const start = Math.max(0, at - 50);
  const s = body.slice(start, start + n);
  return (start > 0 ? '…' : '') + s + (start + n < body.length ? '…' : '');
}

// ---------------------------------------------------------------------------
export async function searchView(ctx) {
  const { page } = ctx;
  ctx.top({ title: 'Search' });
  let q = ctx.query.get('q') || '';
  let sid = ctx.query.get('s') || '';
  page.innerHTML = `
    <form class="search-box" role="search" action="#" autocomplete="off">
      <span class="search-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg></span>
      <input type="search" id="q" enterkeyhint="search" placeholder="Search notes, terms, questions…" aria-label="Search all subjects" value="${esc(q)}" autocapitalize="off" spellcheck="false">
    </form>
    <div class="chips-scroll" id="chips"></div>
    <p class="muted small" id="idx-status" aria-live="polite"></p>
    <div id="results"></div>`;
  const input = page.querySelector('#q');
  const results = page.querySelector('#results');
  const statusEl = page.querySelector('#idx-status');
  const chipsEl = page.querySelector('#chips');

  const drawChips = () => {
    if (!idx.subjects.length) { chipsEl.innerHTML = ''; return; }
    chipsEl.innerHTML = [['', 'All']].concat(idx.subjects.map((s) => [s.id, s.shortName]))
      .map(([id, name]) => `<button type="button" class="chip-btn" data-s="${esc(id)}" aria-pressed="${id === sid}">${esc(name)}</button>`).join('');
  };
  const drawStatus = () => {
    statusEl.textContent = idx.ready ? '' : idx.total ? `Building search index… ${idx.done}/${idx.total} chapters` : 'Preparing search…';
  };
  const draw = () => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) {
      results.innerHTML = `<div class="empty small"><div class="empty-ic">🔍</div><p>Search across every subject — chapter titles, key terms, notes and questions.</p>
        <div class="suggest">${['depreciation', 'demand', 'matrix', 'marketing', 'partnership'].map((w) => `<button type="button" class="chip-btn" data-q="${w}">${w}</button>`).join('')}</div></div>`;
      return;
    }
    const hits = find(q, sid);
    if (!hits.length) {
      results.innerHTML = `<div class="empty small"><div class="empty-ic">🤔</div><p>No results for “${esc(q)}”${idx.ready ? '' : ' yet — still indexing'}.</p></div>`;
      return;
    }
    results.innerHTML = `<p class="muted small">${hits.length}${hits.length === 80 ? '+' : ''} result${hits.length === 1 ? '' : 's'}</p><ul class="rows results">` +
      hits.map((e) => `<li><a class="row acc" style="${accentStyle(e.s.color)}" href="${e.href}">
        <span class="grow">
          <small class="res-meta"><span class="tag acc-tag">${KIND[e.kind]}</span> ${esc(e.s.shortName)} · ${esc(e.ctitle)}</small>
          <b>${hl(e.title.length > 160 ? e.title.slice(0, 160) + '…' : e.title, words)}</b>
          ${e.kind !== 'chapter' && e.body ? `<small class="snip">${hl(snippet(e.body, words), words)}</small>` : ''}
        </span><span class="chev">${ICONS.chev}</span></a></li>`).join('') + '</ul>';
  };

  let t = 0;
  const sync = () => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (sid) p.set('s', sid);
    const qs = p.toString();
    ctx.replaceHash('#/search' + (qs ? '?' + qs : ''));
  };
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => { q = input.value.trim(); sync(); draw(); }, 140);
  });
  page.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); input.blur(); });
  page.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-s]');
    if (chip) { sid = chip.dataset.s; drawChips(); sync(); draw(); return; }
    const sug = e.target.closest('[data-q]');
    if (sug) { input.value = q = sug.dataset.q; sync(); draw(); }
  });

  let lastDraw = 0;
  const onIdx = () => {
    if (!ctx.alive()) return;
    drawStatus();
    if (!chipsEl.children.length) drawChips();
    const now = Date.now();
    if (idx.ready || now - lastDraw > 600) { lastDraw = now; draw(); }
  };
  listeners.add(onIdx);
  ctx.cleanup(() => { listeners.delete(onIdx); clearTimeout(t); });

  drawChips(); drawStatus(); draw();
  buildIndex();
  if (!q) setTimeout(() => { if (ctx.alive() && !('ontouchstart' in window)) input.focus(); }, 50);
}
