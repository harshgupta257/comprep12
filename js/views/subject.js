import { esc, ring, accentStyle, ICONS } from '../util.js';
import { subject, resources, validId } from '../data.js';
import * as store from '../store.js';
import { subjectProgress } from './home.js';
import { hubHtml } from './resources.js';

const STATUS = { none: 'Not started', progress: 'In progress', done: 'Done' };

export async function subjectView(ctx) {
  const [sid] = ctx.params;
  const { page } = ctx;
  ctx.top({ title: 'Subject', back: '#/' });
  page.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  const [s, res] = validId(sid) ? await Promise.all([subject(sid), resources(sid).catch(() => null)]) : [null, null];
  if (!ctx.alive()) return;
  if (!s) {
    page.innerHTML = `<div class="empty"><div class="empty-ic">🔎</div><h2>Subject not found</h2><a class="btn primary" href="#/">Go home</a></div>`;
    return;
  }
  ctx.top({ title: s.shortName || s.name, back: '#/' });
  const p = subjectProgress(s);
  page.classList.add('acc');
  page.setAttribute('style', accentStyle(s.color));

  const head = `
    <section class="subj-head">
      <span class="subj-ic big" aria-hidden="true">${esc(s.icon)}</span>
      <div class="grow">
        <h2>${esc(s.name)}</h2>
        <p class="meta">${[s.code && `Code ${esc(s.code)}`, s.theoryMarks && `${esc(s.theoryMarks)} theory marks`, p.total && `${p.total} chapters`].filter(Boolean).join(' · ')}</p>
      </div>
      ${p.total ? ring(p.pct, 60, 6) : ''}
    </section>
    ${s.description ? `<p class="lead">${esc(s.description)}</p>` : ''}`;

  if (s.missing || !p.total) {
    page.innerHTML = head + `<div class="empty"><div class="empty-ic">🛠️</div><h2>Coming soon</h2>
      <p>Chapters for ${esc(s.name)} are being written. Check back shortly — new content appears automatically.</p>
      <a class="btn" href="#/">Back to home</a></div>`;
    return;
  }

  let n = 0;
  page.innerHTML = head + hubHtml(s, res) + `
    <h3 class="section-title chapters-title">Chapters <small>${p.total}</small></h3>
    ${s.units.map((u) => `
      <section class="unit">
        <div class="unit-head">
          <h3>${esc(u.title)}</h3>
          ${u.marks != null ? `<span class="pill acc-pill">${esc(u.marks)} marks</span>` : ''}
        </div>
        ${u.chapters.length ? `<ul class="rows">${u.chapters.map((c) => {
          n++;
          const st = store.chapStatus(s.id, c.id);
          const rec = store.chap(s.id, c.id);
          const best = rec && rec.best != null ? `<span class="best ${rec.best >= 60 ? 'ok' : 'low'}">Best ${rec.best}%</span>` : '';
          return `<li><a class="row" href="#/chapter/${encodeURIComponent(s.id)}/${encodeURIComponent(c.id)}">
            <span class="num-badge st-${st}" aria-hidden="true">${st === 'done' ? ICONS.check : n}</span>
            <span class="grow"><b>${esc(c.title)}</b>
              <small><span class="status st-${st}">${STATUS[st]}</span>${best}</small></span>
            <span class="chev">${ICONS.chev}</span></a></li>`;
        }).join('')}</ul>` : '<p class="muted small pad">Chapters coming soon.</p>'}
      </section>`).join('')}`;
}
