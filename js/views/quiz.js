import { esc, clean, ring, bar, accentStyle, shuffle, confirmSheet, toast, ICONS, $$ } from '../util.js';
import { subject, chapter, chapterMeta, chaptersOf, validId } from '../data.js';
import * as store from '../store.js';

const L = ['A', 'B', 'C', 'D', 'E', 'F'];
const MOCK_SIZE = 20;
const MOCK_SECS = 20 * 60;
const WEAK = 60;

function reviewList(items) {
  if (!items.length) return '';
  return `<details class="card review"><summary><span class="grow">Review ${items.length} wrong or skipped answer${items.length === 1 ? '' : 's'}</span><span class="chev" aria-hidden="true">${ICONS.chev}</span></summary>
    ${items.map(({ m, pick, ctitle }) => `<div class="review-item">
      ${ctitle ? `<p class="eyebrow">${esc(ctitle)}</p>` : ''}
      <div class="q rich">${clean(m.q)}</div>
      ${pick != null ? `<p class="ans bad">${ICONS.cross}<span>Your answer: <b>${L[pick]}.</b> <span class="rich inline">${clean(m.options[pick])}</span></span></p>` : '<p class="ans bad">' + ICONS.cross + '<span>Not answered</span></p>'}
      <p class="ans good">${ICONS.check}<span>Correct: <b>${L[m.answer]}.</b> <span class="rich inline">${clean(m.options[m.answer])}</span></span></p>
      ${m.explanation ? `<div class="rich explain-box">${clean(m.explanation)}</div>` : ''}
    </div>`).join('')}</details>`;
}

// ===========================================================================
// Chapter quiz: one question at a time, instant feedback.
export async function quizView(ctx) {
  const [sid, cid] = ctx.params;
  const { page } = ctx;
  const back = `#/chapter/${encodeURIComponent(sid)}/${encodeURIComponent(cid)}`;
  ctx.top({ title: 'Quiz', back });
  page.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  const s = validId(sid) ? await subject(sid) : null;
  const c = s ? await chapter(sid, cid) : null;
  if (!ctx.alive()) return;
  if (s) { page.classList.add('acc'); page.setAttribute('style', accentStyle(s.color)); }
  const meta = s && chapterMeta(s, cid);
  const title = (c && c.title) || (meta && meta.title) || 'Chapter';
  ctx.top({ title: `Quiz · ${s ? s.shortName : ''}`, back });

  if (!c || !c.mcqs.length) {
    page.innerHTML = `<div class="empty"><div class="empty-ic">🧩</div><h2>No quiz yet</h2>
      <p>MCQs for ${esc(title)} are coming soon.</p><a class="btn primary" href="${back}">Back to chapter</a></div>`;
    return;
  }

  let items, i, score, wrong, answered;
  const start = () => { items = c.mcqs.slice(); i = 0; score = 0; wrong = []; answered = false; draw(); };

  function draw() {
    const m = items[i];
    answered = false;
    page.innerHTML = `
      <div class="quiz-head">
        <p class="eyebrow acc-text">${esc(title)}</p>
        <div class="quiz-prog"><span>Question ${i + 1} of ${items.length}</span><span>Score ${score}</span></div>
        ${bar(((i) / items.length) * 100, 'acc-bar')}
      </div>
      <div class="card qcard">
        <div class="q rich big">${clean(m.q)}</div>
        <div class="opts">${m.options.map((o, j) => `<button type="button" class="opt" data-opt="${j}">
          <span class="letter">${L[j]}</span><span class="grow rich">${clean(o)}</span></button>`).join('')}</div>
        <div class="explain" aria-live="polite" hidden></div>
      </div>
      <div class="dock"><button type="button" class="btn primary wide" data-act="next" hidden>${i + 1 < items.length ? 'Next question' : 'See result'}</button></div>`;
    page.querySelector('.opt')?.focus({ preventScroll: true });
  }

  function finish() {
    const total = items.length;
    const pct = Math.round((score / total) * 100);
    const prevBest = (store.chap(sid, cid) || {}).best;
    const improved = store.recordQuiz(sid, cid, score, total);
    const best = (store.chap(sid, cid) || {}).best;
    const msg = pct >= 90 ? 'Outstanding! 🌟' : pct >= 75 ? 'Great work! 💪' : pct >= 50 ? 'Good effort — review the misses.' : 'Keep going — revise the notes and retry.';
    page.innerHTML = `
      <section class="result card">
        ${ring(pct, 120, 10)}
        <h2>${score} / ${total} correct</h2>
        <p>${esc(msg)}</p>
        <p class="muted small">${improved && prevBest != null ? `New best! Previous best was ${prevBest}%.` : `Best score: ${best}%`}</p>
        <div class="row-btns">
          <button type="button" class="btn primary" data-act="retry">Try again</button>
          <a class="btn" href="${back}">Back to chapter</a>
        </div>
      </section>
      ${reviewList(wrong)}`;
  }

  page.addEventListener('click', (e) => {
    const opt = e.target.closest('.opt');
    if (opt && !answered) {
      answered = true;
      const m = items[i];
      const pick = Number(opt.dataset.opt);
      const ok = pick === m.answer;
      if (ok) score++; else wrong.push({ m, pick });
      $$('.opt', page).forEach((b, j) => {
        b.disabled = true;
        if (j === m.answer) b.classList.add('right');
        else if (j === pick) b.classList.add('wrong');
      });
      const ex = page.querySelector('.explain');
      ex.innerHTML = `<p class="verdict ${ok ? 'good' : 'bad'}">${ok ? ICONS.check + ' Correct!' : ICONS.cross + ` Incorrect — the answer is ${L[m.answer]}`}</p>
        ${m.explanation ? `<div class="rich">${clean(m.explanation)}</div>` : ''}`;
      ex.hidden = false;
      page.querySelector('.quiz-prog span:last-child').textContent = `Score ${score}`;
      const next = page.querySelector('[data-act="next"]');
      next.hidden = false;
      next.focus({ preventScroll: true });
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    if (act.dataset.act === 'next') {
      if (i + 1 < items.length) { i++; draw(); window.scrollTo(0, 0); } else { finish(); window.scrollTo(0, 0); }
    } else if (act.dataset.act === 'retry') { start(); window.scrollTo(0, 0); }
  });

  ctx.top({
    title: `Quiz · ${s.shortName}`, back,
    onBack: () => (i > 0 && page.querySelector('.qcard') ? confirmSheet({ title: 'Leave this quiz?', body: 'Your answers so far will not be saved.', ok: 'Leave', danger: true }) : true),
  });
  start();
}

// ===========================================================================
// Mock test: 20 random MCQs across a subject, 20-minute timer.
export async function mockView(ctx) {
  const [sid] = ctx.params;
  const { page } = ctx;
  const back = `#/subject/${encodeURIComponent(sid)}`;
  ctx.top({ title: 'Mock test', back });
  page.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
  const s = validId(sid) ? await subject(sid) : null;
  if (!ctx.alive()) return;
  if (!s) { page.innerHTML = `<div class="empty"><h2>Subject not found</h2><a class="btn primary" href="#/">Home</a></div>`; return; }
  page.classList.add('acc'); page.setAttribute('style', accentStyle(s.color));
  ctx.top({ title: `Mock · ${s.shortName}`, back });
  const chs = chaptersOf(s);
  const history = (store.get().mocks[sid] || []).slice(-3).reverse();

  page.innerHTML = `
    <section class="card mock-intro">
      <span class="subj-ic big" aria-hidden="true">${esc(s.icon)}</span>
      <h2>${esc(s.name)} mock test</h2>
      <ul class="facts">
        <li><b>${MOCK_SIZE}</b><span>random MCQs</span></li>
        <li><b>20</b><span>minutes</span></li>
        <li><b>${chs.length}</b><span>chapters</span></li>
      </ul>
      <p class="muted small">Answers are revealed at the end, with a chapter-wise breakdown so you can spot weak chapters. The test submits automatically when time runs out.</p>
      <div id="mock-load" class="muted small" aria-live="polite"></div>
      <button type="button" class="btn primary wide" data-act="begin" ${chs.length ? '' : 'disabled'}>Start mock test</button>
    </section>
    ${history.length ? `<h3 class="section-title">Recent attempts</h3><ul class="rows">${history.map((h) => `<li class="row static">
      <span class="grow"><b>${h.score}/${h.total}</b><small>${new Date(h.ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · ${Math.round(h.secs / 60)} min</small></span>
      ${bar(h.total ? (h.score / h.total) * 100 : 0, 'acc-bar small')}</li>`).join('')}</ul>` : ''}`;

  let timer = 0, running = false;
  ctx.cleanup(() => clearInterval(timer));

  async function begin() {
    const btn = page.querySelector('[data-act="begin"]');
    if (btn) btn.disabled = true;
    const status = page.querySelector('#mock-load') || document.createElement('div');
    const pool = [];
    let n = 0;
    const titles = {};
    await Promise.all(chs.map(async (meta) => {
      const c = await chapter(sid, meta.id);
      n++;
      if (ctx.alive()) status.textContent = `Loading chapters… ${n}/${chs.length}`;
      titles[meta.id] = (c && c.title) || meta.title;
      if (c) c.mcqs.forEach((m) => pool.push({ m, cid: meta.id }));
    }));
    if (!ctx.alive()) return;
    if (!pool.length) {
      status.textContent = 'No MCQs are available for this subject yet — check back soon.';
      return;
    }
    run(shuffle(pool).slice(0, MOCK_SIZE), titles);
  }

  function run(qs, titles) {
    running = true;
    const picks = new Array(qs.length).fill(null);
    let i = 0;
    const started = Date.now();
    const ends = started + MOCK_SECS * 1000;

    ctx.top({
      title: `Mock · ${s.shortName}`, back,
      actions: `<span class="timer" id="timer" role="timer" aria-label="Time left">20:00</span>`,
      onBack: () => (running ? confirmSheet({ title: 'Leave the mock test?', body: 'This attempt will be discarded.', ok: 'Leave', danger: true }) : true),
    });
    const timerEl = document.getElementById('timer');
    const tick = () => {
      const left = Math.max(0, Math.round((ends - Date.now()) / 1000));
      if (timerEl) {
        timerEl.textContent = `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`;
        timerEl.classList.toggle('low', left <= 120);
      }
      if (left <= 0 && running) { toast('Time is up — test submitted'); submit(); }
    };
    timer = setInterval(tick, 1000);
    tick();

    function draw() {
      const { m } = qs[i];
      page.innerHTML = `
        <div class="quiz-head">
          <div class="quiz-prog"><span>Question ${i + 1} of ${qs.length}</span><span>${picks.filter((p) => p != null).length} answered</span></div>
          ${bar(((i + 1) / qs.length) * 100, 'acc-bar')}
        </div>
        <div class="card qcard">
          <p class="eyebrow">${esc(titles[qs[i].cid] || '')}</p>
          <div class="q rich big">${clean(m.q)}</div>
          <div class="opts">${m.options.map((o, j) => `<button type="button" class="opt ${picks[i] === j ? 'picked' : ''}" data-opt="${j}" aria-pressed="${picks[i] === j}">
            <span class="letter">${L[j]}</span><span class="grow rich">${clean(o)}</span></button>`).join('')}</div>
        </div>
        <div class="dock split">
          <button type="button" class="btn" data-act="prev" ${i === 0 ? 'disabled' : ''}>‹ Prev</button>
          ${i + 1 < qs.length ? '<button type="button" class="btn primary" data-act="next">Next ›</button>' : '<button type="button" class="btn primary" data-act="submit">Submit</button>'}
        </div>
        <h3 class="section-title">Jump to question</h3>
        <div class="palette">${qs.map((_, k) => `<button type="button" data-jump="${k}" class="${picks[k] != null ? 'done' : ''} ${k === i ? 'cur' : ''}"
          aria-label="Question ${k + 1}${picks[k] != null ? ', answered' : ''}">${k + 1}</button>`).join('')}</div>
        <button type="button" class="btn danger-ghost wide" data-act="submit">Submit test</button>`;
    }

    async function confirmSubmit() {
      const left = picks.filter((p) => p == null).length;
      const ok = await confirmSheet({
        title: 'Submit the test?',
        body: left ? `${left} question${left === 1 ? ' is' : 's are'} unanswered.` : 'All questions answered.',
        ok: 'Submit',
      });
      if (ok && running && ctx.alive()) submit();
    }

    function submit() {
      running = false;
      clearInterval(timer);
      const secs = Math.min(MOCK_SECS, Math.round((Date.now() - started) / 1000));
      const by = {};
      let score = 0;
      const wrong = [];
      qs.forEach(({ m, cid }, k) => {
        by[cid] = by[cid] || [0, 0];
        by[cid][1]++;
        if (picks[k] === m.answer) { score++; by[cid][0]++; } else wrong.push({ m, pick: picks[k], ctitle: titles[cid] });
      });
      store.recordMock(sid, { ts: Date.now(), score, total: qs.length, secs, byChapter: by });
      const pct = Math.round((score / qs.length) * 100);
      const rows = Object.entries(by).map(([cid, [r, t]]) => ({ cid, r, t, p: Math.round((r / t) * 100) })).sort((a, b) => a.p - b.p || b.t - a.t);
      const weak = rows.filter((x) => x.p < WEAK);
      ctx.top({ title: `Mock · ${s.shortName}`, back });
      page.innerHTML = `
        <section class="result card">
          ${ring(pct, 120, 10)}
          <h2>${score} / ${qs.length} correct</h2>
          <p class="muted">Time taken ${Math.floor(secs / 60)}m ${secs % 60}s</p>
          <div class="row-btns">
            <button type="button" class="btn primary" data-act="again">New mock test</button>
            <a class="btn" href="${back}">Back to subject</a>
          </div>
        </section>
        <h3 class="section-title">Chapter-wise breakdown</h3>
        ${weak.length ? `<p class="callout warn">Weak chapters: ${weak.map((w) => `<b>${esc(titles[w.cid])}</b>`).join(', ')}. Revise these first.</p>` : '<p class="callout good">No weak chapters in this attempt — nice!</p>'}
        <ul class="rows breakdown">${rows.map((x) => `<li><a class="row" href="#/chapter/${encodeURIComponent(sid)}/${encodeURIComponent(x.cid)}">
          <span class="grow"><b>${esc(titles[x.cid])}</b>
            <small>${x.r}/${x.t} correct ${x.p < WEAK ? '<span class="tag weak">Weak</span>' : ''}</small>
            ${bar(x.p, x.p < WEAK ? 'bad-bar' : 'good-bar')}</span>
          <span class="chev">${ICONS.chev}</span></a></li>`).join('')}</ul>
        ${reviewList(wrong)}`;
      window.scrollTo(0, 0);
    }

    page.onclick = (e) => {
      const opt = e.target.closest('.opt');
      if (opt && running) {
        const j = Number(opt.dataset.opt);
        picks[i] = picks[i] === j ? null : j;
        $$('.opt', page).forEach((b, k) => { b.classList.toggle('picked', picks[i] === k); b.setAttribute('aria-pressed', String(picks[i] === k)); });
        $$('.palette button', page)[i].classList.toggle('done', picks[i] != null);
        page.querySelector('.quiz-prog span:last-child').textContent = `${picks.filter((p) => p != null).length} answered`;
        return;
      }
      const jump = e.target.closest('[data-jump]');
      if (jump && running) { i = Number(jump.dataset.jump); draw(); window.scrollTo(0, 0); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'next' && running) { i = Math.min(qs.length - 1, i + 1); draw(); window.scrollTo(0, 0); }
      else if (a === 'prev' && running) { i = Math.max(0, i - 1); draw(); window.scrollTo(0, 0); }
      else if (a === 'submit' && running) confirmSubmit();
      else if (a === 'again') {
        page.onclick = null;
        page.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';
        window.scrollTo(0, 0);
        begin();
      }
    };
    draw();
    window.scrollTo(0, 0);
  }

  page.addEventListener('click', (e) => {
    if (e.target.closest('[data-act="begin"]') && !running) begin();
  });
}
