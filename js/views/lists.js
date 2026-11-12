import { esc, ring, bar, accentStyle, todayKey, ICONS, toast } from '../util.js';
import { allSubjects, chaptersOf } from '../data.js';
import * as store from '../store.js';
import { subjectProgress } from './home.js';

const TYPE = { note: ['Note', 'notes'], mcq: ['MCQ', 'mcqs'], question: ['Q&A', 'qa'] };

// ===========================================================================
export async function savedView(ctx) {
  const { page } = ctx;
  ctx.top({ title: 'Saved' });
  const subs = (await allSubjects()).filter(Boolean);
  if (!ctx.alive()) return;
  const byId = Object.fromEntries(subs.map((s) => [s.id, s]));

  const draw = () => {
    const items = Object.entries(store.get().bookmarks).map(([key, b]) => ({ key, ...b })).filter((b) => b && b.sid && b.cid && TYPE[b.type]);
    if (!items.length) {
      page.innerHTML = `<div class="empty"><div class="empty-ic">🔖</div><h2>Nothing saved yet</h2>
        <p>Tap the bookmark icon on any note section, MCQ or question to keep it here for quick revision.</p>
        <a class="btn primary" href="#/">Browse subjects</a></div>`;
      return;
    }
    const groups = new Map();
    for (const b of items.sort((a, c) => (c.ts || 0) - (a.ts || 0))) {
      if (!groups.has(b.sid)) groups.set(b.sid, []);
      groups.get(b.sid).push(b);
    }
    page.innerHTML = `<p class="muted small">${items.length} saved item${items.length === 1 ? '' : 's'}</p>` +
      [...groups.entries()].map(([sid, list]) => {
        const s = byId[sid];
        return `<section class="acc" style="${accentStyle(s ? s.color : '')}">
          <h3 class="section-title"><span aria-hidden="true">${esc(s ? s.icon : '📘')}</span> ${esc(s ? s.name : sid)} <small>${list.length}</small></h3>
          <ul class="rows">${list.map((b) => `<li class="saved-item">
            <a class="row" href="#/chapter/${encodeURIComponent(b.sid)}/${encodeURIComponent(b.cid)}/${TYPE[b.type][1]}/${Number(b.index) || 0}">
              <span class="grow"><small class="res-meta"><span class="tag acc-tag">${TYPE[b.type][0]}</span> ${esc(b.ctitle || b.cid)}</small>
              <b>${esc(b.title || 'Saved item')}</b>${b.text ? `<small class="snip">${esc(b.text)}</small>` : ''}</span>
            </a>
            <button type="button" class="icon-btn" data-del="${esc(b.key)}" aria-label="Remove bookmark">${ICONS.cross}</button>
          </li>`).join('')}</ul></section>`;
      }).join('');
  };
  draw();
  page.addEventListener('click', (e) => {
    const del = e.target.closest('[data-del]');
    if (!del) return;
    store.update((s) => { delete s.bookmarks[del.dataset.del]; });
    toast('Bookmark removed');
    draw();
  });
}

// ===========================================================================
export async function progressView(ctx) {
  const { page } = ctx;
  ctx.top({ title: 'Progress' });
  page.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  const subs = (await allSubjects()).filter(Boolean);
  if (!ctx.alive()) return;
  const st = store.get();

  let totalCh = 0, doneCh = 0;
  const bests = [];
  const weak = [];
  const cards = subs.map((s) => {
    const p = subjectProgress(s);
    totalCh += p.total; doneCh += p.done;
    const chs = chaptersOf(s);
    const sb = chs.map((c) => store.chap(s.id, c.id)).filter((r) => r && r.best != null).map((r) => r.best);
    bests.push(...sb);
    const avg = sb.length ? Math.round(sb.reduce((a, b) => a + b, 0) / sb.length) : null;
    const mocks = Array.isArray(st.mocks[s.id]) ? st.mocks[s.id] : [];
    const lastMock = mocks[mocks.length - 1];
    // weak chapters: low best quiz score, or low in the latest mock test
    for (const c of chs) {
      const r = store.chap(s.id, c.id);
      const reasons = [];
      if (r && r.best != null && r.best < 60) reasons.push(`quiz best ${r.best}%`);
      const m = lastMock && lastMock.byChapter && lastMock.byChapter[c.id];
      if (m && m[1] >= 2 && m[0] / m[1] < 0.5) reasons.push(`mock ${m[0]}/${m[1]}`);
      const rev = r && r.qa ? Object.values(r.qa).filter((v) => v === 'revise').length : 0;
      if (rev >= 3) reasons.push(`${rev} Q&A to revise`);
      if (reasons.length) weak.push({ s, c, reasons });
    }
    return `<a class="card prog-card acc" style="${accentStyle(s.color)}" href="#/subject/${encodeURIComponent(s.id)}">
      <div class="prog-top">
        <span class="subj-ic" aria-hidden="true">${esc(s.icon)}</span>
        <span class="grow"><b>${esc(s.name)}</b><small>${p.total ? `${p.done}/${p.total} chapters done · ${p.started} opened` : 'Coming soon'}</small></span>
        ${ring(p.pct, 48, 5)}
      </div>
      <dl class="mini-stats">
        <div><dt>Quiz average</dt><dd>${avg != null ? avg + '%' : '—'}</dd></div>
        <div><dt>Quizzes taken</dt><dd>${sb.length}</dd></div>
        <div><dt>Last mock</dt><dd>${lastMock ? `${lastMock.score}/${lastMock.total}` : '—'}</dd></div>
      </dl></a>`;
  });

  const avgAll = bests.length ? Math.round(bests.reduce((a, b) => a + b, 0) / bests.length) : null;
  const days = new Set(st.days);
  const cells = [];
  const d = new Date();
  d.setDate(d.getDate() - 27);
  for (let k = 0; k < 28; k++) {
    const key = todayKey(d);
    cells.push(`<span class="${days.has(key) ? 'on' : ''}" title="${key}"></span>`);
    d.setDate(d.getDate() + 1);
  }

  page.innerHTML = `
    <div class="stat-grid">
      <div class="card stat"><span class="flame">${ICONS.flame}</span><b>${store.streak()}</b><small>day streak</small></div>
      <div class="card stat"><b>${store.bestStreak()}</b><small>best streak</small></div>
      <div class="card stat"><b>${doneCh}<small>/${totalCh}</small></b><small>chapters done</small></div>
      <div class="card stat"><b>${avgAll != null ? avgAll + '%' : '—'}</b><small>quiz average</small></div>
    </div>
    <div class="card">
      <h3 class="card-title">Last 4 weeks</h3>
      <div class="heat" role="img" aria-label="${cells.filter((c) => c.includes('on')).length} active days in the last 4 weeks">${cells.join('')}</div>
      <p class="muted small">Each square is a day you studied. Overall: ${bar(totalCh ? (doneCh / totalCh) * 100 : 0, 'brand-bar inline')} ${totalCh ? Math.round((doneCh / totalCh) * 100) : 0}% of chapters done.</p>
    </div>
    <h3 class="section-title">Weak chapters</h3>
    ${weak.length ? `<ul class="rows">${weak.slice(0, 15).map(({ s, c, reasons }) => `<li><a class="row acc" style="${accentStyle(s.color)}" href="#/chapter/${encodeURIComponent(s.id)}/${encodeURIComponent(c.id)}">
        <span class="grow"><small class="res-meta"><span class="tag acc-tag">${esc(s.shortName)}</span></small><b>${esc(c.title)}</b><small>${esc(reasons.join(' · '))}</small></span>
        <span class="chev">${ICONS.chev}</span></a></li>`).join('')}</ul>`
      : '<p class="callout">No weak chapters flagged yet. Take chapter quizzes or a mock test and chapters scoring under 60% will show up here.</p>'}
    <h3 class="section-title">By subject</h3>
    <div class="prog-list">${cards.join('')}</div>`;
}
