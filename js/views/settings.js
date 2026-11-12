import { esc, bar, confirmSheet, toast, daysUntil, todayKey } from '../util.js';
import { downloadAll } from '../data.js';
import * as store from '../store.js';
import { applyAppearance } from '../theme.js';

const VERSION = '1.0.0';

function seg(name, value, options) {
  return `<div class="seg wide" role="radiogroup" aria-label="${esc(name)}">${options.map(([v, label]) =>
    `<button type="button" role="radio" data-set="${esc(name)}" data-v="${esc(v)}" aria-checked="${v === value}">${label}</button>`).join('')}</div>`;
}

export async function settingsView(ctx) {
  const { page } = ctx;
  ctx.top({ title: 'Settings', back: '#/' });
  const s = store.get().settings;
  const left = daysUntil(s.examDate);

  page.innerHTML = `
    <section class="card setting">
      <h3 class="card-title">Appearance</h3>
      <label class="lbl">Theme</label>
      ${seg('theme', s.theme, [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']])}
      <label class="lbl">Text size</label>
      ${seg('textSize', s.textSize, [['s', '<span style="font-size:.8em">A</span>'], ['m', 'A'], ['l', '<span style="font-size:1.2em">A</span>'], ['xl', '<span style="font-size:1.4em">A</span>']])}
      <p class="muted small preview">Notes, answers and questions will use this size.</p>
    </section>

    <section class="card setting">
      <h3 class="card-title">Board exam date</h3>
      <label class="lbl" for="exam">First exam day</label>
      <div class="date-row">
        <input type="date" id="exam" value="${esc(s.examDate)}" min="${todayKey(new Date(Date.now() - 365 * 86400000))}">
        <button type="button" class="btn ghost" data-act="clear-date" ${s.examDate ? '' : 'hidden'}>Clear</button>
      </div>
      <p class="muted small" id="exam-note">${left == null ? 'Optional — shows a countdown on the home screen.' : left >= 0 ? `${left} day${left === 1 ? '' : 's'} to go.` : 'This date has passed.'}</p>
    </section>

    <section class="card setting">
      <h3 class="card-title">Offline</h3>
      <p class="muted small">Download every chapter so the whole app works without internet — handy before travelling or when data is patchy.</p>
      <div id="dl-prog" hidden>${bar(0, 'brand-bar')}<p class="muted small" id="dl-text" aria-live="polite"></p></div>
      <button type="button" class="btn primary wide" data-act="download">Download all for offline</button>
    </section>

    <section class="card setting">
      <h3 class="card-title">Your data</h3>
      <p class="muted small">Progress, quiz scores, bookmarks and streaks are stored only on this device.</p>
      <button type="button" class="btn danger wide" data-act="reset">Reset progress…</button>
    </section>

    <section class="about">
      <img src="icons/icon-192.png" alt="" width="48" height="48">
      <p><b>ComPrep 12</b> · version ${VERSION}</p>
      <p class="muted small">Study companion for CBSE Class 12 Commerce with Maths. Notes follow the current syllabus; always cross-check with your NCERT textbook.</p>
    </section>`;

  const exam = page.querySelector('#exam');
  const note = page.querySelector('#exam-note');
  const clearBtn = page.querySelector('[data-act="clear-date"]');
  const setExam = (v) => {
    store.update((st) => { st.settings.examDate = v; });
    const d = daysUntil(v);
    note.textContent = d == null ? 'Optional — shows a countdown on the home screen.' : d >= 0 ? `${d} day${d === 1 ? '' : 's'} to go.` : 'This date has passed.';
    clearBtn.hidden = !v;
  };
  exam.addEventListener('change', () => setExam(/^\d{4}-\d{2}-\d{2}$/.test(exam.value) ? exam.value : ''));

  let downloading = false;
  page.addEventListener('click', async (e) => {
    const opt = e.target.closest('[data-set]');
    if (opt) {
      const key = opt.dataset.set, v = opt.dataset.v;
      store.update((st) => { st.settings[key] = v; });
      for (const b of page.querySelectorAll(`[data-set="${key}"]`)) b.setAttribute('aria-checked', String(b === opt));
      applyAppearance();
      return;
    }
    const act = e.target.closest('[data-act]');
    if (!act) return;
    const a = act.dataset.act;
    if (a === 'clear-date') { exam.value = ''; setExam(''); toast('Exam date cleared'); }
    else if (a === 'download' && !downloading) {
      downloading = true;
      act.disabled = true;
      act.textContent = 'Downloading…';
      const wrap = page.querySelector('#dl-prog');
      const fill = wrap.querySelector('.bar i');
      const text = page.querySelector('#dl-text');
      wrap.hidden = false;
      try {
        const r = await downloadAll((done, total, failed) => {
          fill.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
          text.textContent = `${done} of ${total} files${failed ? ` · ${failed} unavailable` : ''}`;
        });
        const ok = r.total - r.failed;
        text.textContent = r.failed
          ? `Saved ${ok} of ${r.total} files. ${r.failed} aren't published yet or couldn't be reached — try again later.`
          : `All ${r.total} files saved. ComPrep 12 now works fully offline.`;
        if (!r.cached) text.textContent += ' (Offline storage isn’t available in this browser mode.)';
        toast(r.failed ? 'Download finished with gaps' : 'Ready for offline use');
      } catch (err) {
        text.textContent = 'Download failed — check your connection and try again.';
      }
      act.disabled = false;
      act.textContent = 'Download again';
      downloading = false;
    } else if (a === 'reset') {
      const ok = await confirmSheet({
        title: 'Reset all progress?',
        body: 'This clears chapter status, quiz and mock scores, Q&A marks, bookmarks and your streak on this device. It cannot be undone. Settings are kept.',
        ok: 'Reset progress', danger: true,
      });
      if (ok) { store.reset(); toast('Progress reset'); }
    }
  });
}
