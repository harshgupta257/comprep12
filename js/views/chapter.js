import { esc, clean, plain, clip, accentStyle, shuffle, reducedMotion, toast, ICONS, $$ } from '../util.js';
import { subject, chapter, chapterMeta, validId } from '../data.js';
import * as store from '../store.js';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

function bmBtn(key, label) {
  const on = store.isBookmarked(key);
  return `<button type="button" class="icon-btn bm ${on ? 'on' : ''}" data-bm="${esc(key)}"
    aria-pressed="${on}" aria-label="${on ? 'Remove bookmark' : 'Bookmark'}: ${esc(clip(label, 60))}">${ICONS.bookmark}</button>`;
}

export async function chapterView(ctx) {
  const [sid, cid, tabParam, idxParam] = ctx.params;
  const { page } = ctx;
  const subjHref = `#/subject/${encodeURIComponent(sid)}`;
  ctx.top({ title: 'Chapter', back: subjHref });
  page.innerHTML = '<div class="loading"><span></span><span></span><span></span></div>';

  const s = validId(sid) ? await subject(sid) : null;
  const c = s && validId(cid) ? await chapter(sid, cid) : null;
  if (!ctx.alive()) return;
  const meta = s && chapterMeta(s, cid);
  if (s) { page.classList.add('acc'); page.setAttribute('style', accentStyle(s.color)); }
  ctx.top({ title: s ? s.shortName : 'Chapter', back: subjHref });

  if (!s || !c) {
    page.innerHTML = `<div class="empty"><div class="empty-ic">📝</div>
      <h2>${esc(meta ? meta.title : 'Chapter')} — coming soon</h2>
      <p>This chapter's notes aren't available yet${navigator.onLine === false ? ' offline. Connect once to download it' : ''}. Try again a little later.</p>
      <a class="btn primary" href="${s ? subjHref : '#/'}">Back to ${esc(s ? s.name : 'home')}</a></div>`;
    return;
  }

  store.visitChapter(sid, cid);
  const title = c.title || (meta && meta.title) || cid;
  const base = `#/chapter/${encodeURIComponent(sid)}/${encodeURIComponent(cid)}`;

  const tabs = [
    ['notes', 'Notes', c.notes.length],
    ['terms', 'Key terms', c.keyTerms.length],
    c.formulas.length ? ['formulas', 'Formulas', c.formulas.length] : null,
    ['mcqs', 'MCQs', c.mcqs.length],
    ['qa', 'Q&A', c.questions.length],
  ].filter(Boolean);
  let tab = tabs.some((t) => t[0] === tabParam) ? tabParam : (tabs.find((t) => t[2]) || tabs[0])[0];
  let focusIdx = idxParam != null ? Number(idxParam) : null;

  const doneBtn = () => {
    const done = store.chapStatus(sid, cid) === 'done';
    return `<button type="button" class="btn ${done ? 'done-on' : ''}" data-act="done" aria-pressed="${done}">
      ${done ? ICONS.check + ' Done' : 'Mark as done'}</button>`;
  };

  page.innerHTML = `
    <section class="chap-head">
      <p class="eyebrow acc-text">${esc(meta && meta.unit ? meta.unit.title : s.name)}</p>
      <h2>${esc(title)}</h2>
      ${c.summary ? `<p class="lead">${esc(c.summary)}</p>` : ''}
      <div class="head-actions" id="head-actions">${doneBtn()}
        ${c.mcqs.length ? `<a class="btn primary" href="#/quiz/${encodeURIComponent(sid)}/${encodeURIComponent(cid)}">Start quiz</a>` : ''}</div>
    </section>
    <div class="seg-wrap"><div class="seg" role="tablist" aria-label="Chapter sections">
      ${tabs.map(([id, label, n]) => `<button type="button" role="tab" id="tab-${id}" data-tab="${id}" aria-controls="panel"
        aria-selected="${id === tab}">${esc(label)}${n ? `<small>${n}</small>` : ''}</button>`).join('')}
    </div></div>
    <div id="panel" role="tabpanel" class="panel"></div>
    <div class="chap-foot">
      <p class="muted small">Finished revising this chapter?</p>
      <div id="foot-actions">${doneBtn()}</div>
    </div>`;

  const panel = page.querySelector('#panel');
  const refreshDone = () => {
    page.querySelector('#head-actions .btn[data-act="done"]').outerHTML = doneBtn();
    page.querySelector('#foot-actions').innerHTML = doneBtn();
  };

  // ------------------------------------------------------------------ panels
  const renderers = {
    notes() {
      if (!c.notes.length) return emptyPanel('Notes for this chapter are on their way.');
      return `<div class="tools-row"><button type="button" class="btn small ghost" data-act="expand">Expand all</button></div>` +
        c.notes.map((n, i) => {
          const key = store.bk(sid, cid, 'note', i);
          return `<details class="note card" data-idx="${i}" ${i === 0 || c.notes.length <= 2 ? 'open' : ''}>
            <summary><span class="grow">${esc(n.heading)}</span>${bmBtn(key, n.heading)}<span class="chev" aria-hidden="true">${ICONS.chev}</span></summary>
            <div class="rich">${clean(n.html) || '<p class="muted">—</p>'}</div>
          </details>`;
        }).join('');
    },
    terms() {
      if (!c.keyTerms.length) return emptyPanel('Key terms for this chapter are on their way.');
      return `<div class="tools-row">
          <div class="seg mini" role="group" aria-label="View">
            <button type="button" data-view="list" aria-pressed="true">${ICONS.list} List</button>
            <button type="button" data-view="cards" aria-pressed="false">${ICONS.cards} Flashcards</button>
          </div></div>
        <div id="terms-body">${termList()}</div>`;
    },
    formulas() {
      return c.formulas.map((f, i) => `<div class="card formula" data-idx="${i}">
        ${f.name ? `<h4>${esc(f.name)}</h4>` : ''}<div class="formula-body rich">${clean(f.html)}</div></div>`).join('');
    },
    mcqs() {
      if (!c.mcqs.length) return emptyPanel('MCQs for this chapter are on their way.');
      const rec = store.chap(sid, cid);
      return `<a class="card quiz-cta" href="#/quiz/${encodeURIComponent(sid)}/${encodeURIComponent(cid)}">
          <span class="grow"><b>Take the chapter quiz</b>
          <small>${c.mcqs.length} questions · one at a time${rec && rec.best != null ? ` · best ${rec.best}%` : ''}</small></span>
          <span class="btn primary small" aria-hidden="true">Start</span></a>
        <p class="muted small">Or practise below — tap an option to check it.</p>` +
        c.mcqs.map((m, i) => `<div class="card mcq" data-idx="${i}">
          <div class="mcq-top"><span class="qno">Q${i + 1}</span>${bmBtn(store.bk(sid, cid, 'mcq', i), plain(m.q))}</div>
          <div class="q rich">${clean(m.q)}</div>
          <div class="opts">${m.options.map((o, j) => `<button type="button" class="opt" data-opt="${j}">
            <span class="letter">${LETTERS[j]}</span><span class="grow rich">${clean(o)}</span></button>`).join('')}</div>
          <div class="explain" hidden></div>
        </div>`).join('');
    },
    qa() {
      if (!c.questions.length) return emptyPanel('Practice questions for this chapter are on their way.');
      const qa = (store.chap(sid, cid) || {}).qa || {};
      const knew = Object.values(qa).filter((v) => v === 'knew').length;
      const rev = Object.values(qa).filter((v) => v === 'revise').length;
      const groups = new Map();
      c.questions.forEach((q, i) => {
        const k = q.marks || 0;
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push([q, i]);
      });
      const keys = [...groups.keys()].sort((a, b) => a - b);
      return `<div class="qa-stats">
          <span class="chip good">${ICONS.check} Knew ${knew}</span>
          <span class="chip warn">↻ Revise ${rev}</span>
          <span class="chip">${c.questions.length - knew - rev} unseen</span></div>
        <div class="tools-row"><div class="seg mini" role="group" aria-label="Filter questions">
          <button type="button" data-filter="all" aria-pressed="true">All</button>
          <button type="button" data-filter="revise" aria-pressed="false">Revise again</button>
          <button type="button" data-filter="unseen" aria-pressed="false">Unseen</button></div></div>` +
        keys.map((k) => `<h3 class="section-title">${k ? `${k} mark${k === 1 ? '' : 's'}` : 'Questions'} <small>${groups.get(k).length}</small></h3>` +
          groups.get(k).map(([q, i]) => {
            const v = qa[i] || '';
            return `<div class="card qa-card" data-idx="${i}" data-state="${v || 'unseen'}">
              <div class="mcq-top"><span class="qno">${q.marks ? `${q.marks}M` : 'Q'}</span>${bmBtn(store.bk(sid, cid, 'question', i), plain(q.q))}</div>
              <div class="q rich">${clean(q.q)}</div>
              <button type="button" class="btn small reveal" data-act="reveal" aria-expanded="false">Show answer</button>
              <div class="answer" hidden>
                <div class="rich">${clean(q.answerHtml) || '<p class="muted">Answer coming soon.</p>'}</div>
                <div class="self">
                  <button type="button" class="btn small ${v === 'knew' ? 'sel-good' : ''}" data-qa="knew" aria-pressed="${v === 'knew'}">${ICONS.check} I knew this</button>
                  <button type="button" class="btn small ${v === 'revise' ? 'sel-warn' : ''}" data-qa="revise" aria-pressed="${v === 'revise'}">↻ Revise again</button>
                </div>
              </div></div>`;
          }).join('')).join('');
    },
  };

  function emptyPanel(msg) {
    return `<div class="empty small"><div class="empty-ic">🌱</div><p>${esc(msg)}</p></div>`;
  }
  function termList() {
    return `<dl class="terms">${c.keyTerms.map((t, i) => `<div class="card term" data-idx="${i}">
      <dt>${esc(t.term)}</dt><dd class="rich">${clean(t.definition)}</dd></div>`).join('')}</dl>`;
  }

  // flashcards
  let deck = c.keyTerms.map((_, i) => i), cardPos = 0, flipped = false;
  function cardsHtml() {
    const t = c.keyTerms[deck[cardPos]];
    return `<div class="flash-wrap">
      <button type="button" class="flash ${flipped ? 'flipped' : ''} ${reducedMotion() ? 'no-anim' : ''}" data-act="flip"
        aria-label="${flipped ? 'Showing definition' : 'Showing term'}. Tap to flip.">
        <span class="flash-in">
          <span class="face front"><small>Term</small><b>${esc(t.term)}</b><em>Tap to see definition</em></span>
          <span class="face back"><small>${esc(t.term)}</small><span class="rich">${clean(t.definition)}</span></span>
        </span>
      </button>
      <div class="flash-nav">
        <button type="button" class="btn" data-act="prev" ${cardPos === 0 ? 'disabled' : ''} aria-label="Previous card">‹ Prev</button>
        <span class="muted" aria-live="polite">${cardPos + 1} / ${deck.length}</span>
        <button type="button" class="btn" data-act="next" ${cardPos === deck.length - 1 ? 'disabled' : ''} aria-label="Next card">Next ›</button>
      </div>
      <div class="tools-row center"><button type="button" class="btn small ghost" data-act="shuffle">${ICONS.shuffle} Shuffle</button></div>
    </div>`;
  }

  function showTab(id, push = true) {
    tab = id;
    for (const b of $$('.seg[role="tablist"] button', page)) b.setAttribute('aria-selected', String(b.dataset.tab === id));
    panel.setAttribute('aria-labelledby', `tab-${id}`);
    panel.innerHTML = renderers[id]();
    if (push) ctx.replaceHash(`${base}/${id}`);
  }
  showTab(tab, false);

  // scroll to a deep-linked item (from search / saved)
  if (focusIdx != null && Number.isFinite(focusIdx)) {
    const el = panel.querySelector(`[data-idx="${focusIdx}"]`);
    if (el) {
      if (el.tagName === 'DETAILS') el.open = true;
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: 'start', behavior: reducedMotion() ? 'auto' : 'smooth' });
        el.classList.add('flash-hl');
      });
    }
  }

  // ------------------------------------------------------------------ events
  page.addEventListener('click', (e) => {
    const t = e.target;
    const tabBtn = t.closest('.seg[role="tablist"] button');
    if (tabBtn) {
      showTab(tabBtn.dataset.tab);
      // if the user had scrolled into the old panel, bring the new panel's top into view
      const seg = page.querySelector('.seg-wrap');
      const bar = document.getElementById('topbar');
      const y = panel.getBoundingClientRect().top + window.scrollY - seg.offsetHeight - bar.offsetHeight - 8;
      if (window.scrollY > y) window.scrollTo(0, Math.max(0, y));
      return;
    }
    const bm = t.closest('[data-bm]');
    if (bm) {
      e.preventDefault(); e.stopPropagation();
      const [, , type, idx] = bm.dataset.bm.split('/');
      const i = Number(idx);
      const item = type === 'note' ? c.notes[i] : type === 'mcq' ? c.mcqs[i] : c.questions[i];
      if (!item) return;
      const on = store.toggleBookmark({
        sid, cid, type, index: i, sname: s.shortName, ctitle: title,
        title: type === 'note' ? item.heading : clip(plain(item.q), 140),
        text: clip(plain(type === 'note' ? item.html : type === 'mcq' ? item.explanation : item.answerHtml), 140),
      });
      bm.classList.toggle('on', on);
      bm.setAttribute('aria-pressed', String(on));
      toast(on ? 'Saved to bookmarks' : 'Removed from bookmarks');
      return;
    }
    const act = t.closest('[data-act]');
    const a = act && act.dataset.act;
    if (a === 'done') {
      const now = store.chapStatus(sid, cid) !== 'done';
      store.setDone(sid, cid, now);
      refreshDone();
      toast(now ? 'Chapter marked as done 🎉' : 'Marked as in progress');
      return;
    }
    if (a === 'expand') {
      const ds = $$('details.note', panel);
      const open = ds.some((d) => !d.open);
      ds.forEach((d) => { d.open = open; });
      act.textContent = open ? 'Collapse all' : 'Expand all';
      return;
    }
    if (a === 'flip') { flipped = !flipped; act.classList.toggle('flipped', flipped); act.setAttribute('aria-label', `${flipped ? 'Showing definition' : 'Showing term'}. Tap to flip.`); return; }
    if (a === 'prev' || a === 'next') {
      cardPos = Math.max(0, Math.min(deck.length - 1, cardPos + (a === 'next' ? 1 : -1)));
      flipped = false;
      panel.querySelector('#terms-body').innerHTML = cardsHtml();
      panel.querySelector(`[data-act="${a}"]:not([disabled])`)?.focus();
      return;
    }
    if (a === 'shuffle') { deck = shuffle(deck); cardPos = 0; flipped = false; panel.querySelector('#terms-body').innerHTML = cardsHtml(); toast('Shuffled'); return; }
    if (a === 'reveal') {
      const card = act.closest('.qa-card');
      const ans = card.querySelector('.answer');
      ans.hidden = !ans.hidden;
      act.textContent = ans.hidden ? 'Show answer' : 'Hide answer';
      act.setAttribute('aria-expanded', String(!ans.hidden));
      return;
    }
    const view = t.closest('[data-view]');
    if (view) {
      for (const b of $$('[data-view]', panel)) b.setAttribute('aria-pressed', String(b === view));
      flipped = false; cardPos = 0;
      panel.querySelector('#terms-body').innerHTML = view.dataset.view === 'cards' ? cardsHtml() : termList();
      return;
    }
    const filt = t.closest('[data-filter]');
    if (filt) {
      for (const b of $$('[data-filter]', panel)) b.setAttribute('aria-pressed', String(b === filt));
      const f = filt.dataset.filter;
      for (const card of $$('.qa-card', panel)) card.hidden = f !== 'all' && card.dataset.state !== f;
      return;
    }
    const qaBtn = t.closest('[data-qa]');
    if (qaBtn) {
      const card = qaBtn.closest('.qa-card');
      const i = Number(card.dataset.idx);
      const cur = card.dataset.state;
      const val = cur === qaBtn.dataset.qa ? '' : qaBtn.dataset.qa;
      store.setQA(sid, cid, i, val);
      card.dataset.state = val || 'unseen';
      for (const b of $$('[data-qa]', card)) {
        const on = b.dataset.qa === val;
        b.classList.toggle('sel-good', on && val === 'knew');
        b.classList.toggle('sel-warn', on && val === 'revise');
        b.setAttribute('aria-pressed', String(on));
      }
      // refresh the counters only
      const qa = (store.chap(sid, cid) || {}).qa || {};
      const knew = Object.values(qa).filter((v) => v === 'knew').length;
      const rev = Object.values(qa).filter((v) => v === 'revise').length;
      const chips = $$('.qa-stats .chip', panel);
      chips[0].innerHTML = `${ICONS.check} Knew ${knew}`;
      chips[1].textContent = `↻ Revise ${rev}`;
      chips[2].textContent = `${c.questions.length - knew - rev} unseen`;
      return;
    }
    const opt = t.closest('.mcq .opt');
    if (opt) {
      const card = opt.closest('.mcq');
      if (card.classList.contains('answered')) return;
      const m = c.mcqs[Number(card.dataset.idx)];
      const pick = Number(opt.dataset.opt);
      card.classList.add('answered');
      $$('.opt', card).forEach((b, j) => {
        b.disabled = true;
        if (j === m.answer) b.classList.add('right');
        else if (j === pick) b.classList.add('wrong');
      });
      const ex = card.querySelector('.explain');
      const ok = pick === m.answer;
      ex.innerHTML = `<p class="verdict ${ok ? 'good' : 'bad'}">${ok ? ICONS.check + ' Correct' : ICONS.cross + ` Not quite — answer: ${LETTERS[m.answer]}`}</p>
        ${m.explanation ? `<div class="rich">${clean(m.explanation)}</div>` : ''}`;
      ex.hidden = false;
      store.markActive();
    }
  });

  // keyboard support for flashcards on desktop
  const onKey = (e) => {
    if (tab !== 'terms' || !panel.querySelector('.flash')) return;
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') panel.querySelector('[data-act="next"]:not([disabled])')?.click();
    else if (e.key === 'ArrowLeft') panel.querySelector('[data-act="prev"]:not([disabled])')?.click();
  };
  document.addEventListener('keydown', onKey);
  ctx.cleanup(() => document.removeEventListener('keydown', onKey));
}
