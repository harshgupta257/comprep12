// Per-subject "Downloads" (official external links) and "Resources" (built from
// the app's own chapter content): revision notes, case studies, important and
// practice questions, generated test papers, mock tests and online MCQ tests.
import { esc, clean, plain, accentStyle, fmtDate, ICONS, $$ } from '../util.js';
import { subject, chapter, chaptersOf, resources, papers, validId } from '../data.js';
import * as store from '../store.js';

const L = ['A', 'B', 'C', 'D', 'E', 'F'];
const CASE_RE = /case study|case-based|case:|read the following|situation/i;
const SIZES = [20, 40, 80];
const LOADING = '<div class="loading"><span></span><span></span><span></span></div>';
const STATUS = { none: 'Not started', progress: 'In progress', done: 'Done' };

const ic = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const RI = {
  syllabus: ic('M7 3.5h7l4.5 4.5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15.5a1 1 0 0 1 1-1zM14 3.5V8h4.5M9 12.5h6M9 16h6'),
  paper: ic('M6 3.5h12a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1zM8.5 8h7M8.5 11.5h7M8.5 15h4'),
  archive: ic('M3.5 5h17v4h-17zM5 9v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9M10 13h4'),
  book: ic('M4 5.5c2.5-1.3 5.5-1.3 8 0v14c-2.5-1.3-5.5-1.3-8 0zM12 5.5c2.5-1.3 5.5-1.3 8 0v14c-2.5-1.3-5.5-1.3-8 0z'),
  notes: ic('M5.5 4h13v16h-13zM8.5 8.5h7M8.5 12h7M8.5 15.5h4'),
  case: ic('M4 8h16v11H4zM9 8V5.5h6V8M4 13h16'),
  star: ic('M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.8l-5.1 2.7 1-5.7-4.1-4 5.7-.8z'),
  practice: ic('M4.5 6.5l1.5 1.5 2.5-2.5M4.5 12.5l1.5 1.5 2.5-2.5M11 7h8.5M11 13h8.5M11 18.5h8.5M5 18.5h2'),
  test: ic('M9 3.5h6v3H9zM7 5H5.5v15.5h13V5H17M8.5 12l2 2 4-4M8.5 17h7'),
  online: ic('M4 5h16v11H4zM9 20h6M12 16v4M8.5 10.5l2 2 4-4'),
  ext: ic('M14 4.5h5.5V10M19.5 4.5L11 13M17 14v4.5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1H10'),
  print: ic('M7 9V3.5h10V9M7 17H4.5v-7a1 1 0 0 1 1-1h13a1 1 0 0 1 1 1v7H17M7 14h10v6.5H7z'),
  globe: ic('M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5c2.3 2.3 3.4 5.2 3.4 8.5s-1.1 6.2-3.4 8.5c-2.3-2.3-3.4-5.2-3.4-8.5s1.1-6.2 3.4-8.5z'),
};

const DL = {
  syllabus: { title: 'CBSE Syllabus', short: 'Syllabus', icon: RI.syllabus },
  samplePapers: { title: 'CBSE Sample Papers', short: 'Sample papers', icon: RI.paper },
  lastYearPapers: { title: 'CBSE Last Year Papers', short: 'Past papers', icon: RI.archive },
  ncert: { title: 'NCERT Textbooks', short: 'NCERT', icon: RI.book },
};
const RS = {
  notes: { title: 'Revision Notes', short: 'Notes', icon: RI.notes },
  case: { title: 'Case Study Questions', short: 'Case studies', icon: RI.case },
  important: { title: 'Important Questions', short: 'Important Qs', icon: RI.star },
  practice: { title: 'Practice Questions', short: 'Practice', icon: RI.practice },
  test: { title: 'Test Papers', short: 'Test paper', icon: RI.test },
  mock: { title: 'Mock Tests', short: 'Mock', icon: ICONS.clock },
  online: { title: 'Online Tests (MCQ)', short: 'Online tests', icon: RI.online },
};

const enc = encodeURIComponent;
const resHref = (sid, kind) => `#/resources/${enc(sid)}/${kind}`;
const marksLabel = (m) => `${m} mark${m === 1 ? '' : 's'}`;

// ---------------------------------------------------------------------------
// Subject screen hub (rendered by views/subject.js above the chapter list)
export function hubHtml(s, res) {
  const row = (href, icon, title, sub) => `<li><a class="row" href="${href}">
      <span class="count-ic" aria-hidden="true">${icon}</span>
      <span class="grow"><b>${esc(title)}</b><small>${sub}</small></span>
      <span class="chev">${ICONS.chev}</span></a></li>`;
  const chs = chaptersOf(s);
  const tried = chs.filter((c) => (store.chap(s.id, c.id) || {}).best != null).length;
  const mocks = store.get().mocks[s.id];
  const lastMock = Array.isArray(mocks) && mocks.length ? mocks[mocks.length - 1] : null;
  const dl = Object.entries(DL).map(([k, d]) => {
    const n = res && Array.isArray(res[k]) ? res[k].length : 0;
    return row(resHref(s.id, k), d.icon, d.title, n ? `${n} official link${n === 1 ? '' : 's'}` : 'Links coming soon');
  }).join('');
  const sub = {
    notes: `${chs.length} chapters · open any chapter's notes`,
    case: 'Case-based questions with answers',
    important: 'Highest-mark questions of every chapter',
    practice: 'All Q&amp;A · filter by chapter and marks',
    test: '20 / 40 / 80-mark papers · printable',
    mock: lastMock ? `Last score ${esc(lastMock.score)}/${esc(lastMock.total)} · 20 MCQs · 20 min` : '20 random MCQs · 20 minutes',
    online: `Chapter quizzes · ${tried}/${chs.length} attempted`,
  };
  const rs = Object.entries(RS).map(([k, d]) => row(k === 'mock' ? `#/mock/${enc(s.id)}` : resHref(s.id, k), d.icon, d.title, sub[k])).join('');
  return `<h3 class="section-title">Downloads</h3><ul class="rows hub">${dl}</ul>
    <h3 class="section-title">Resources</h3><ul class="rows hub">${rs}</ul>`;
}

// ---------------------------------------------------------------------------
// Route: #/resources/<sid>/<kind>[?query]
export async function resourcesView(ctx) {
  const [sid, kind] = ctx.params;
  const { page } = ctx;
  const subjHref = `#/subject/${enc(sid)}`;
  ctx.top({ title: 'Resources', back: subjHref });
  page.innerHTML = LOADING;
  const s = validId(sid) ? await subject(sid) : null;
  if (!ctx.alive()) return;
  if (!s || s.missing) {
    page.innerHTML = `<div class="empty"><div class="empty-ic">🔎</div><h2>Subject not found</h2><a class="btn primary" href="#/">Go home</a></div>`;
    return;
  }
  page.classList.add('acc');
  page.setAttribute('style', accentStyle(s.color));
  const K = DL[kind] || RS[kind];
  if (!K) {
    ctx.top({ title: s.shortName, back: subjHref });
    page.innerHTML = `<div class="empty"><div class="empty-ic">🧭</div><h2>Page not found</h2><a class="btn primary" href="${subjHref}">Back to ${esc(s.name)}</a></div>`;
    return;
  }
  ctx.top({ title: `${K.short} · ${s.shortName}`, back: subjHref });
  const head = `<section class="chap-head res-head no-print"><p class="eyebrow acc-text">${esc(s.name)}</p><h2>${esc(K.title)}</h2></section>`;

  if (DL[kind]) return downloads(ctx, s, kind, head);
  if (kind === 'mock') { location.replace(`#/mock/${enc(s.id)}`); return; }
  if (kind === 'notes') return notesPicker(ctx, s, head);

  const { list, missing } = await loadAll(ctx, s);
  if (!ctx.alive()) return;
  const gap = missing ? `<p class="callout warn small">${missing} chapter${missing === 1 ? '' : 's'} couldn't be loaded${navigator.onLine === false ? ' offline' : ''} and ${missing === 1 ? 'is' : 'are'} left out.</p>` : '';
  if (kind === 'online') return onlinePicker(ctx, s, list, head + gap);
  if (kind === 'case') return caseView(ctx, s, list, head + gap);
  if (kind === 'important') return importantView(ctx, s, list, head + gap);
  if (kind === 'practice') return practiceView(ctx, s, list, head + gap);
  if (kind === 'test') return testView(ctx, s, list, head + gap);
}

async function loadAll(ctx, s) {
  const chs = chaptersOf(s);
  ctx.page.innerHTML = `${LOADING}<p class="muted small ld-note" aria-live="polite">Loading chapters… 0/${chs.length}</p>`;
  let n = 0;
  const out = await Promise.all(chs.map(async (meta) => {
    const c = await chapter(s.id, meta.id);
    n++;
    const el = ctx.alive() && ctx.page.querySelector('.ld-note');
    if (el) el.textContent = `Loading chapters… ${n}/${chs.length}`;
    return { meta, c };
  }));
  return { list: out.filter((x) => x.c), missing: out.filter((x) => !x.c).length };
}

function emptyBlock(icon, title, msg, s) {
  return `<div class="empty"><div class="empty-ic">${icon}</div><h2>${esc(title)}</h2><p>${esc(msg)}</p>
    <a class="btn" href="#/subject/${enc(s.id)}">Back to ${esc(s.name)}</a></div>`;
}

// ---------------------------------------------------------------- downloads
async function downloads(ctx, s, kind, head) {
  const d = DL[kind];
  const res = await resources(s.id).catch(() => null);
  if (!ctx.alive()) return;
  const items = res ? res[kind] : [];
  const pdfs = kind === 'lastYearPapers' ? await papers(s.id).catch(() => []) : [];
  if (!ctx.alive()) return;
  if (pdfs.length) {
    const years = [...new Set(pdfs.map((p) => p.year))];
    head += `
    <p class="callout net"><span class="count-ic" aria-hidden="true">${d.icon}</span><span>Official CBSE board question papers, stored in the app. A paper you have opened once stays available offline.</span></p>` +
      years.map((y) => `<section class="unit"><div class="unit-head"><h3>Board Examination ${esc(y)}</h3></div>
      <ul class="rows links">${pdfs.filter((p) => p.year === y).map((p) => `<li><a class="row" href="${esc(p.file)}" target="_blank" rel="noopener">
        <span class="count-ic" aria-hidden="true">${d.icon}</span>
        <span class="grow"><b>${esc(s.name)} ${esc(y)}</b><small>Question paper${p.set ? ` · Set ${esc(p.set)}` : ''}</small>
          <small><span class="pill acc-pill">PDF</span><span class="host">${(p.kb / 1024).toFixed(1)} MB</span></small></span>
        <span class="chev" aria-hidden="true">${RI.ext}</span><span class="sr">(opens the PDF)</span></a></li>`).join('')}</ul></section>`).join('') +
      (items.length ? `<div class="unit-head"><h3>More on the CBSE website</h3></div>` : '');
    if (!items.length) { ctx.page.innerHTML = head; return; }
  }
  if (!items.length) {
    ctx.page.innerHTML = head + emptyBlock('🔗', 'Links coming soon',
      `Official ${d.title} links for ${s.name} will appear here as soon as they're added.`, s);
    return;
  }
  ctx.page.innerHTML = head + `
    <p class="callout net"><span class="count-ic" aria-hidden="true">${RI.globe}</span><span>These open the official CBSE / NCERT website in a new tab and need internet.</span></p>
    <ul class="rows links">${items.map((it) => `<li><a class="row" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">
      <span class="count-ic" aria-hidden="true">${d.icon}</span>
      <span class="grow"><b>${esc(it.title)}</b>${it.note ? `<small>${esc(it.note)}</small>` : ''}
        <small>${it.source ? `<span class="pill acc-pill">${esc(it.source)}</span>` : ''}<span class="host">${esc(it.host)}</span></small></span>
      <span class="chev" aria-hidden="true">${RI.ext}</span><span class="sr">(opens in a new tab)</span></a></li>`).join('')}</ul>
    ${res.updated ? `<p class="muted small pad">Links last checked ${esc(fmtDate(res.updated))}.</p>` : ''}`;
}

// ---------------------------------------------------------- chapter pickers
function notesPicker(ctx, s, head) {
  let n = 0;
  ctx.page.innerHTML = head + `<p class="lead">Pick a chapter to open its revision notes.</p>` +
    s.units.filter((u) => u.chapters.length).map((u) => `<section class="unit">
      <div class="unit-head"><h3>${esc(u.title)}</h3>${u.marks != null ? `<span class="pill acc-pill">${esc(u.marks)} marks</span>` : ''}</div>
      <ul class="rows">${u.chapters.map((c) => {
        n++;
        const st = store.chapStatus(s.id, c.id);
        return `<li><a class="row" href="#/chapter/${enc(s.id)}/${enc(c.id)}/notes">
          <span class="num-badge st-${st}" aria-hidden="true">${st === 'done' ? ICONS.check : n}</span>
          <span class="grow"><b>${esc(c.title)}</b><small><span class="status st-${st}">${STATUS[st]}</span></small></span>
          <span class="chev">${ICONS.chev}</span></a></li>`;
      }).join('')}</ul></section>`).join('');
}

function onlinePicker(ctx, s, list, head) {
  const withQ = list.filter((x) => x.c.mcqs.length);
  if (!withQ.length) { ctx.page.innerHTML = head + emptyBlock('🧩', 'No online tests yet', `MCQs for ${s.name} are on their way.`, s); return; }
  const recs = withQ.map((x) => store.chap(s.id, x.meta.id) || {});
  const tried = recs.filter((r) => r.best != null);
  const avg = tried.length ? Math.round(tried.reduce((a, r) => a + r.best, 0) / tried.length) : null;
  ctx.page.innerHTML = head + `
    <p class="lead">One quiz per chapter with instant feedback. Your best score is kept.</p>
    <div class="qa-stats"><span class="chip">${tried.length}/${withQ.length} attempted</span>${avg != null ? `<span class="chip ${avg >= 60 ? 'good' : 'warn'}">Average best ${avg}%</span>` : ''}</div>
    <ul class="rows">${withQ.map((x, i) => {
      const r = recs[i];
      const best = r.best != null ? `<span class="best ${r.best >= 60 ? 'ok' : 'low'}">Best ${esc(r.best)}%${r.bestText ? ` (${esc(r.bestText)})` : ''}</span>` : '<span>Not attempted</span>';
      return `<li><a class="row" href="#/quiz/${enc(s.id)}/${enc(x.meta.id)}">
        <span class="num-badge ${r.best != null ? 'st-progress' : ''}" aria-hidden="true">${i + 1}</span>
        <span class="grow"><b>${esc(x.c.title || x.meta.title)}</b><small><span>${x.c.mcqs.length} MCQs</span>${best}</small></span>
        <span class="chev">${ICONS.chev}</span></a></li>`;
    }).join('')}</ul>`;
}

// ------------------------------------------------------------ question cards
function qCard(sid, cid, q, i) {
  const v = ((store.chap(sid, cid) || {}).qa || {})[i] || '';
  return `<div class="card qa-card" data-cid="${esc(cid)}" data-idx="${i}" data-state="${v || 'unseen'}">
    <div class="q-top"><span class="qno">${q.marks ? `${q.marks}M` : 'Q'}</span></div>
    <div class="q rich">${clean(q.q)}</div>
    <button type="button" class="btn small reveal" data-act="reveal" aria-expanded="false">Show answer</button>
    <div class="answer" hidden>
      <div class="rich">${clean(q.answerHtml) || '<p class="muted">Answer coming soon.</p>'}</div>
      <div class="self">
        <button type="button" class="btn small ${v === 'knew' ? 'sel-good' : ''}" data-qa="knew" aria-pressed="${v === 'knew'}">${ICONS.check} I knew this</button>
        <button type="button" class="btn small ${v === 'revise' ? 'sel-warn' : ''}" data-qa="revise" aria-pressed="${v === 'revise'}">↻ Revise again</button>
      </div>
    </div></div>`;
}
function mcqCard(m) {
  return `<div class="card qa-card mcq-card">
    <div class="q-top"><span class="qno">MCQ · 1M</span></div>
    <div class="q rich">${clean(m.q)}</div>
    <ol class="opts static">${m.options.map((o, j) => `<li class="opt" ${j === m.answer ? 'data-right' : ''}>
      <span class="letter">${L[j]}</span><span class="grow rich">${clean(o)}</span></li>`).join('')}</ol>
    <button type="button" class="btn small reveal" data-act="reveal" aria-expanded="false">Show answer</button>
    <div class="answer" hidden><p class="verdict good">${ICONS.check} Answer: ${L[m.answer]}</p>
      ${m.explanation ? `<div class="rich">${clean(m.explanation)}</div>` : ''}</div></div>`;
}
const chapHead = (x, n) => `<h3 class="section-title">${esc(x.c.title || x.meta.title)} <small>${n}</small></h3>`;

// shared click handling for reveal + self-marking (same store keys as the chapter Q&A tab)
function bindCards(ctx, sid, onMark) {
  ctx.page.addEventListener('click', (e) => {
    const rv = e.target.closest('[data-act="reveal"]');
    if (rv) {
      const card = rv.closest('.qa-card');
      const ans = card.querySelector('.answer');
      ans.hidden = !ans.hidden;
      rv.textContent = ans.hidden ? 'Show answer' : 'Hide answer';
      rv.setAttribute('aria-expanded', String(!ans.hidden));
      for (const li of $$('.opt[data-right]', card)) li.classList.toggle('right', !ans.hidden);
      return;
    }
    const qaBtn = e.target.closest('[data-qa]');
    if (qaBtn) {
      const card = qaBtn.closest('.qa-card');
      const cid = card.dataset.cid, i = Number(card.dataset.idx);
      if (!validId(cid) || !Number.isInteger(i)) return;
      const val = card.dataset.state === qaBtn.dataset.qa ? '' : qaBtn.dataset.qa;
      store.setQA(sid, cid, i, val);
      card.dataset.state = val || 'unseen';
      for (const b of $$('[data-qa]', card)) {
        const on = b.dataset.qa === val;
        b.classList.toggle('sel-good', on && val === 'knew');
        b.classList.toggle('sel-warn', on && val === 'revise');
        b.setAttribute('aria-pressed', String(on));
      }
      onMark && onMark();
    }
  });
}

function caseView(ctx, s, list, head) {
  let total = 0;
  const groups = list.map((x) => {
    const qs = x.c.questions.map((q, i) => [q, i]).filter(([q]) => CASE_RE.test(plain(q.q)));
    const ms = x.c.mcqs.filter((m) => CASE_RE.test(plain(m.q)));
    total += qs.length + ms.length;
    return { x, html: qs.map(([q, i]) => qCard(s.id, x.meta.id, q, i)).join('') + ms.map(mcqCard).join(''), n: qs.length + ms.length };
  }).filter((g) => g.n);
  if (!total) {
    ctx.page.innerHTML = head + emptyBlock('🗂️', 'No case studies yet',
      `There are no case-based questions in ${s.name} yet. Try Important Questions or Practice Questions meanwhile.`, s);
    return;
  }
  ctx.page.innerHTML = head + `<p class="lead">${total} case-based question${total === 1 ? '' : 's'} from ${groups.length} chapter${groups.length === 1 ? '' : 's'}. Read the passage, answer, then reveal.</p>` +
    groups.map((g) => chapHead(g.x, g.n) + g.html).join('');
  bindCards(ctx, s.id);
}

function importantView(ctx, s, list, head) {
  let total = 0;
  const groups = list.map((x) => {
    const top = [...new Set(x.c.questions.map((q) => q.marks).filter((m) => m > 0))].sort((a, b) => b - a).slice(0, 2);
    const qs = x.c.questions.map((q, i) => [q, i]).filter(([q]) => top.includes(q.marks)).sort((a, b) => b[0].marks - a[0].marks || a[1] - b[1]);
    total += qs.length;
    return { x, n: qs.length, top, html: qs.map(([q, i]) => qCard(s.id, x.meta.id, q, i)).join('') };
  }).filter((g) => g.n);
  if (!total) { ctx.page.innerHTML = head + emptyBlock('⭐', 'No questions yet', `Questions for ${s.name} are on their way.`, s); return; }
  ctx.page.innerHTML = head + `<p class="lead">The highest-mark questions of every chapter (its top two mark values) — ${total} in all.</p>` +
    groups.map((g) => chapHead(g.x, g.top.map((m) => `${m}M`).join(' + ')) + g.html).join('');
  bindCards(ctx, s.id);
}

function practiceView(ctx, s, list, head) {
  const all = [];
  list.forEach((x) => x.c.questions.forEach((q, i) => all.push({ x, q, i })));
  if (!all.length) { ctx.page.innerHTML = head + emptyBlock('📝', 'No questions yet', `Practice questions for ${s.name} are on their way.`, s); return; }
  const qp = ctx.query;
  let ch = list.some((x) => x.meta.id === qp.get('ch')) ? qp.get('ch') : '';
  let mk = Number(qp.get('m')) || 0;

  ctx.page.innerHTML = head + `
    <div class="card res-form">
      <label class="lbl" for="pf-ch">Chapter</label>
      <select id="pf-ch" class="field">
        <option value="">All chapters (${all.length})</option>
        ${list.filter((x) => x.c.questions.length).map((x) => `<option value="${esc(x.meta.id)}" ${x.meta.id === ch ? 'selected' : ''}>${esc(x.c.title || x.meta.title)} (${x.c.questions.length})</option>`).join('')}
      </select>
      <span class="lbl" id="pf-m-l">Marks</span>
      <div class="seg mini" role="group" aria-labelledby="pf-m-l" id="pf-m"></div>
    </div>
    <div class="qa-stats" id="pf-stats"></div>
    <div id="pf-list"></div>`;
  const segEl = ctx.page.querySelector('#pf-m'), listEl = ctx.page.querySelector('#pf-list'), statsEl = ctx.page.querySelector('#pf-stats');

  const scoped = () => all.filter((it) => !ch || it.x.meta.id === ch);
  const shown = () => scoped().filter((it) => !mk || it.q.marks === mk);
  function stats() {
    const items = shown();
    let knew = 0, rev = 0;
    for (const it of items) {
      const v = ((store.chap(s.id, it.x.meta.id) || {}).qa || {})[it.i];
      if (v === 'knew') knew++; else if (v === 'revise') rev++;
    }
    statsEl.innerHTML = `<span class="chip">${items.length} question${items.length === 1 ? '' : 's'}</span>
      <span class="chip good">${ICONS.check} Knew ${knew}</span><span class="chip warn">↻ Revise ${rev}</span>`;
  }
  function draw() {
    const marks = [...new Set(scoped().map((it) => it.q.marks))].sort((a, b) => a - b);
    if (!marks.includes(mk)) mk = 0;
    segEl.innerHTML = [0, ...marks].map((m) => `<button type="button" data-m="${m}" aria-pressed="${m === mk}">${m ? `${m}M` : 'All'}</button>`).join('');
    const items = shown();
    const byCh = new Map();
    for (const it of items) { if (!byCh.has(it.x)) byCh.set(it.x, []); byCh.get(it.x).push(it); }
    listEl.innerHTML = items.length ? [...byCh].map(([x, its]) => chapHead(x, its.length) + its.map((it) => qCard(s.id, x.meta.id, it.q, it.i)).join('')).join('')
      : '<div class="empty small"><div class="empty-ic">🌱</div><p>No questions match these filters.</p></div>';
    stats();
    const p = new URLSearchParams();
    if (ch) p.set('ch', ch);
    if (mk) p.set('m', String(mk));
    const qs = p.toString();
    ctx.replaceHash(`${resHref(s.id, 'practice')}${qs ? `?${qs}` : ''}`);
  }
  ctx.page.querySelector('#pf-ch').addEventListener('change', (e) => { ch = e.target.value; draw(); });
  segEl.addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) { mk = Number(b.dataset.m); draw(); } });
  bindCards(ctx, s.id, stats);
  draw();
}

// ------------------------------------------------------------- test papers
function rng(seed) { // mulberry32
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function sshuffle(a, rnd) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const newSeed = () => 1 + Math.floor(Math.random() * 2147483646);
function fmtMins(m) {
  const h = Math.floor(m / 60), r = m % 60;
  return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`;
}

export function buildPaper(chosen, size, seed) {
  const rnd = rng(seed);
  const groups = new Map();
  const push = (m, it) => { if (!groups.has(m)) groups.set(m, []); groups.get(m).push(it); };
  for (const x of chosen) {
    x.c.mcqs.forEach((m) => push(1, { type: 'mcq', m, x }));
    x.c.questions.forEach((q) => { if (q.marks > 0) push(q.marks, { type: 'q', q, x }); });
  }
  const marks = [...groups.keys()].sort((a, b) => a - b);
  for (const m of marks) groups.set(m, sshuffle(groups.get(m), rnd));
  const cnt = new Map(marks.map((m) => [m, 0]));
  const others = marks.filter((m) => m > 1);
  if (groups.has(1)) cnt.set(1, Math.min(groups.get(1).length, others.length ? Math.round(size * 0.25) : size));
  const per = others.length ? (size - (cnt.get(1) || 0)) / others.length : 0;
  for (const m of others) cnt.set(m, Math.min(groups.get(m).length, Math.floor(per / m)));
  let total = marks.reduce((a, m) => a + m * cnt.get(m), 0);
  // top up: always the mark value whose section is currently lightest
  for (;;) {
    const d = size - total;
    const cand = marks.filter((m) => m <= d && cnt.get(m) < groups.get(m).length);
    if (!d || !cand.length) break;
    cand.sort((a, b) => a * cnt.get(a) - b * cnt.get(b) || b - a);
    cnt.set(cand[0], cnt.get(cand[0]) + 1);
    total += cand[0];
  }
  const sections = marks.filter((m) => cnt.get(m)).map((m) => {
    const items = groups.get(m).slice(0, cnt.get(m));
    if (m === 1) items.sort((a, b) => (a.type === 'mcq' ? 0 : 1) - (b.type === 'mcq' ? 0 : 1));
    return { marks: m, items };
  });
  return { sections, total, mins: Math.max(5, Math.round((total * 2.25) / 5) * 5) };
}

function testView(ctx, s, list, head) {
  if (!list.some((x) => x.c.mcqs.length || x.c.questions.some((q) => q.marks > 0))) {
    ctx.page.innerHTML = head + emptyBlock('🧾', 'No question bank yet', `Questions for ${s.name} are on their way.`, s);
    return;
  }
  const qp = ctx.query;
  const units = s.units.filter((u) => list.some((x) => x.meta.unit === u));
  const scopeOk = (v) => v === 'all' || (v.startsWith('u:') && units.some((u) => `u:${u.id}` === v)) || (v.startsWith('c:') && list.some((x) => `c:${x.meta.id}` === v));
  let scope = scopeOk(qp.get('scope') || '') ? qp.get('scope') : 'all';
  let size = SIZES.includes(Number(qp.get('size'))) ? Number(qp.get('size')) : 40;
  let seed = /^\d{1,10}$/.test(qp.get('seed') || '') ? Number(qp.get('seed')) : newSeed();
  let ans = qp.get('ans') === '1';

  const scopeLabel = () => scope === 'all' ? 'Whole syllabus'
    : scope.startsWith('u:') ? units.find((u) => `u:${u.id}` === scope).title
      : (() => { const x = list.find((y) => `c:${y.meta.id}` === scope); return x.c.title || x.meta.title; })();
  const chosen = () => scope === 'all' ? list : scope.startsWith('u:') ? list.filter((x) => `u:${x.meta.unit.id}` === scope) : list.filter((x) => `c:${x.meta.id}` === scope);

  ctx.page.innerHTML = head + `
    <div class="card res-form no-print">
      <label class="lbl" for="tp-scope">Scope</label>
      <select id="tp-scope" class="field">
        <option value="all">Whole subject</option>
        ${units.length > 1 ? `<optgroup label="Units">${units.map((u) => `<option value="u:${esc(u.id)}">${esc(u.title)}</option>`).join('')}</optgroup>` : ''}
        <optgroup label="Chapters">${list.map((x) => `<option value="c:${esc(x.meta.id)}">${esc(x.c.title || x.meta.title)}</option>`).join('')}</optgroup>
      </select>
      <span class="lbl" id="tp-size-l">Paper size</span>
      <div class="seg wide" role="group" aria-labelledby="tp-size-l" id="tp-size">${SIZES.map((n) => `<button type="button" data-paper-size="${n}">${n} marks</button>`).join('')}</div>
      <div class="row-btns tp-btns">
        <button type="button" class="btn" data-act="answers"></button>
        <button type="button" class="btn" data-act="new">${ICONS.shuffle} New paper</button>
        <button type="button" class="btn primary" data-act="print">${RI.print} Print</button>
      </div>
    </div>
    <div id="tp-paper"></div>`;
  const sel = ctx.page.querySelector('#tp-scope');
  sel.value = scope;
  const slot = ctx.page.querySelector('#tp-paper');

  function draw() {
    for (const b of $$('[data-paper-size]', ctx.page)) b.setAttribute('aria-pressed', String(Number(b.dataset.paperSize) === size));
    const ab = ctx.page.querySelector('[data-act="answers"]');
    ab.textContent = ans ? 'Hide answers' : 'Show answers / marking scheme';
    ab.setAttribute('aria-pressed', String(ans));
    const p = buildPaper(chosen(), size, seed);
    let qn = 0;
    slot.innerHTML = `<article class="card paper ${ans ? 'show-ans' : ''}">
      <header class="paper-head">
        <p class="eyebrow">Practice test paper · ComPrep 12</p>
        <h2>${esc(s.name)}${s.code ? ` <small>(${esc(s.code)})</small>` : ''}</h2>
        <p class="meta">${esc(scopeLabel())}</p>
        <div class="paper-facts"><span>Maximum marks <b>${p.total}</b></span><span>Suggested time <b>${fmtMins(p.mins)}</b></span></div>
      </header>
      ${p.total < size ? `<p class="callout warn small no-print">This scope's question bank has ${p.total} mark${p.total === 1 ? '' : 's'} of questions that fit, so the paper totals ${p.total} instead of ${size}. Widen the scope for a full paper.</p>` : ''}
      <p class="paper-instr"><b>General instructions:</b> All questions are compulsory. Marks are shown against each question. Section A has multiple-choice and one-mark questions; later sections carry more marks — answer them in proportion to their marks.</p>
      ${p.sections.map((sec, si) => `<section class="paper-sec">
        <h3>Section ${String.fromCharCode(65 + si)} <small>${sec.marks === 1 ? (sec.items.some((it) => it.type === 'q') ? 'Objective &amp; very short answer' : 'Multiple choice') : `${sec.marks}-mark questions`} · ${sec.items.length} × ${sec.marks} = ${sec.items.length * sec.marks} marks</small></h3>
        ${sec.items.map((it) => {
          qn++;
          const body = it.type === 'mcq'
            ? `<div class="q rich">${clean(it.m.q)}</div><ol class="pq-opts">${it.m.options.map((o, j) => `<li><span class="letter">(${L[j].toLowerCase()})</span> <span class="rich inline">${clean(o)}</span></li>`).join('')}</ol>`
            : `<div class="q rich">${clean(it.q.q)}</div>`;
          const key = it.type === 'mcq'
            ? `<p class="verdict good">${ICONS.check} (${L[it.m.answer].toLowerCase()}) <span class="rich inline">${clean(it.m.options[it.m.answer])}</span></p>${it.m.explanation ? `<div class="rich">${clean(it.m.explanation)}</div>` : ''}`
            : `<div class="rich">${clean(it.q.answerHtml) || '<p class="muted">Answer coming soon.</p>'}</div>`;
          return `<div class="pq">
            <div class="pq-top"><span class="pq-no">${qn}.</span><div class="grow">${body}</div><span class="pq-m" aria-label="${marksLabel(sec.marks)}">[${sec.marks}]</span></div>
            <div class="pq-ans"><p class="eyebrow">Marking scheme · ${esc(it.x.c.title || it.x.meta.title)}</p>${key}</div></div>`;
        }).join('')}</section>`).join('')}
      <p class="paper-end muted small">— End of paper · ${qn} questions —</p>
    </article>`;
    const q = new URLSearchParams({ scope, size: String(size), seed: String(seed) });
    if (ans) q.set('ans', '1');
    ctx.replaceHash(`${resHref(s.id, 'test')}?${q}`);
  }

  sel.addEventListener('change', () => { scope = scopeOk(sel.value) ? sel.value : 'all'; draw(); });
  ctx.page.addEventListener('click', (e) => {
    const sz = e.target.closest('[data-paper-size]');
    if (sz && SIZES.includes(Number(sz.dataset.paperSize))) { size = Number(sz.dataset.paperSize); draw(); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'answers') { ans = !ans; draw(); }
    else if (a.dataset.act === 'new') { seed = newSeed(); draw(); }
    else if (a.dataset.act === 'print') window.print();
  });
  draw();
}
