import { esc, ring, accentStyle, daysUntil, fmtDate, ago, ICONS } from '../util.js';
import { allSubjects, chaptersOf, subject, chapterMeta } from '../data.js';
import * as store from '../store.js';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Burning the midnight oil' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function subjectProgress(s) {
  const chs = chaptersOf(s);
  const done = chs.filter((c) => store.chapStatus(s.id, c.id) === 'done').length;
  const started = chs.filter((c) => store.chapStatus(s.id, c.id) !== 'none').length;
  return { total: chs.length, done, started, pct: chs.length ? (done / chs.length) * 100 : 0 };
}

function countdownCard() {
  const { examDate } = store.get().settings;
  const d = daysUntil(examDate);
  if (d == null) {
    return `<a class="card count-card muted-card" href="#/settings">
      <span class="count-ic">${ICONS.clock}</span>
      <span class="grow"><b>Set your exam date</b><small>See a countdown to your board exams here.</small></span>
      <span class="chev">${ICONS.chev}</span></a>`;
  }
  const big = d > 0 ? d : d === 0 ? '0' : '✓';
  const label = d > 1 ? 'days to your exam' : d === 1 ? 'day to your exam' : d === 0 ? 'Exam day — you’ve got this!' : 'Exam date has passed';
  return `<a class="card count-card" href="#/settings">
    <span class="count-num">${esc(big)}</span>
    <span class="grow"><b>${esc(label)}</b><small>${esc(fmtDate(examDate))}</small></span>
    <span class="chev">${ICONS.chev}</span></a>`;
}

function streakCard() {
  const n = store.streak();
  const today = store.activeToday();
  return `<div class="card streak-card ${today ? 'lit' : ''}">
    <span class="flame">${ICONS.flame}</span>
    <span class="grow"><b>${n} day${n === 1 ? '' : 's'}</b>
    <small>${today ? 'Studied today — streak safe' : n ? 'Study today to keep your streak' : 'Open any chapter to start a streak'}</small></span></div>`;
}

export async function homeView(ctx) {
  const { page } = ctx;
  ctx.top({ actions: `<a class="icon-btn" href="#/settings" aria-label="Settings">${ICONS.gear}</a>` });

  page.innerHTML = `
    <section class="hello">
      <p class="eyebrow">${esc(new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      <h2>${esc(greeting())} 👋</h2>
    </section>
    <div class="duo">${countdownCard()}${streakCard()}</div>
    <div id="continue"></div>
    <h3 class="section-title">Subjects</h3>
    <div class="subject-grid" id="subjects">${'<div class="card skel"></div>'.repeat(5)}</div>`;

  const subs = await allSubjects();
  if (!ctx.alive()) return;

  page.querySelector('#subjects').innerHTML = subs.map((s) => {
    const p = subjectProgress(s);
    const soon = s.missing || !p.total;
    return `<a class="card subject-card acc" style="${accentStyle(s.color)}" href="#/subject/${encodeURIComponent(s.id)}">
      <span class="subj-ic" aria-hidden="true">${esc(s.icon)}</span>
      <span class="grow">
        <b>${esc(s.name)}</b>
        <small>${soon ? 'Coming soon' : `${s.code ? esc(s.code) + ' · ' : ''}${p.done}/${p.total} chapters done`}</small>
      </span>
      ${soon ? '<span class="pill">Soon</span>' : ring(p.pct, 48, 5)}
    </a>`;
  }).join('');

  const last = store.get().last;
  if (last && last.sid && last.cid) {
    const s = await subject(last.sid);
    if (!ctx.alive()) return;
    const meta = s && chapterMeta(s, last.cid);
    if (meta) {
      page.querySelector('#continue').innerHTML = `
        <h3 class="section-title">Continue where you left off</h3>
        <a class="card continue-card acc" style="${accentStyle(s.color)}" href="#/chapter/${encodeURIComponent(s.id)}/${encodeURIComponent(meta.id)}">
          <span class="subj-ic" aria-hidden="true">${esc(s.icon)}</span>
          <span class="grow"><small class="acc-text">${esc(s.shortName)} · ${esc(ago(last.ts))}</small><b>${esc(meta.title)}</b></span>
          <span class="chev">${ICONS.chev}</span>
        </a>`;
    }
  }
}
