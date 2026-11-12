// All user state lives under ONE localStorage key. Every access is guarded.
import { todayKey } from './util.js';

export const KEY = 'comprep12.state.v1';

const defaults = () => ({
  v: 1,
  settings: { theme: 'system', textSize: 'm', examDate: '' },
  chapters: {},   // "sid/cid" -> { status: 'progress'|'done', seen, best, bestText, attempts, qa: { idx: 'knew'|'revise' } }
  mocks: {},      // sid -> [{ ts, score, total, secs, byChapter: { cid: [right, total] } }]
  bookmarks: {},  // "sid/cid/type/index" -> { sid, cid, type, index, title, text, ts }
  last: null,     // { sid, cid, ts }
  days: [],       // ISO local dates with study activity
  flags: {},      // misc UI flags (hint dismissed etc.)
});

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function load() {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const s = JSON.parse(raw);
    if (!isObj(s)) return d;
    for (const k of Object.keys(d)) {
      if (k === 'settings') d.settings = { ...d.settings, ...(isObj(s.settings) ? s.settings : {}) };
      else if (k === 'days') d.days = Array.isArray(s.days) ? s.days.filter((x) => typeof x === 'string') : [];
      else if (k === 'last') d.last = isObj(s.last) ? s.last : null;
      else if (k !== 'v' && isObj(s[k])) d[k] = s[k];
    }
  } catch (e) { /* corrupted or blocked storage: start fresh in memory */ }
  return d;
}

let state = load();
const listeners = new Set();

export const get = () => state;
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota / private mode */ }
}
export function update(fn) {
  fn(state);
  save();
  listeners.forEach((l) => { try { l(state); } catch (e) { /* ignore */ } });
}
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function reset() {
  const keepSettings = state.settings, flags = state.flags;
  state = defaults();
  state.settings = keepSettings;
  state.flags = flags;
  save();
}

// ---- chapters ------------------------------------------------------------
export const ck = (sid, cid) => `${sid}/${cid}`;
export const chap = (sid, cid) => state.chapters[ck(sid, cid)] || null;
export function chapStatus(sid, cid) {
  const c = chap(sid, cid);
  return c ? (c.status === 'done' ? 'done' : 'progress') : 'none';
}
function ensure(sid, cid) {
  const k = ck(sid, cid);
  if (!isObj(state.chapters[k])) state.chapters[k] = { status: 'progress', seen: Date.now(), best: null, attempts: 0, qa: {} };
  if (!isObj(state.chapters[k].qa)) state.chapters[k].qa = {};
  return state.chapters[k];
}
export function visitChapter(sid, cid) {
  update((s) => {
    const c = ensure(sid, cid);
    c.seen = Date.now();
    s.last = { sid, cid, ts: Date.now() };
    touchDay(s);
  });
}
export function setDone(sid, cid, done) {
  update(() => { ensure(sid, cid).status = done ? 'done' : 'progress'; });
}
export function recordQuiz(sid, cid, score, total) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  let improved = false;
  update((s) => {
    const c = ensure(sid, cid);
    c.attempts = (c.attempts || 0) + 1;
    c.last = pct;
    if (c.best == null || pct > c.best) { c.best = pct; c.bestText = `${score}/${total}`; improved = true; }
    touchDay(s);
  });
  return improved;
}
export function setQA(sid, cid, idx, val) {
  update((s) => {
    const c = ensure(sid, cid);
    if (val) c.qa[idx] = val; else delete c.qa[idx];
    touchDay(s);
  });
}
export function recordMock(sid, result) {
  update((s) => {
    const list = Array.isArray(s.mocks[sid]) ? s.mocks[sid] : [];
    list.push(result);
    s.mocks[sid] = list.slice(-20);
    touchDay(s);
  });
}

// ---- bookmarks -----------------------------------------------------------
export const bk = (sid, cid, type, index) => `${sid}/${cid}/${type}/${index}`;
export const isBookmarked = (key) => !!state.bookmarks[key];
export function toggleBookmark(entry) {
  const key = bk(entry.sid, entry.cid, entry.type, entry.index);
  let on = false;
  update((s) => {
    if (s.bookmarks[key]) delete s.bookmarks[key];
    else { s.bookmarks[key] = { ...entry, ts: Date.now() }; on = true; }
  });
  return on;
}

// ---- streak --------------------------------------------------------------
function touchDay(s) {
  const t = todayKey();
  if (!s.days.includes(t)) {
    s.days.push(t);
    s.days.sort();
    if (s.days.length > 400) s.days = s.days.slice(-400);
  }
}
export function markActive() { update(touchDay); }
export function streak() {
  const set = new Set(state.days);
  const d = new Date();
  if (!set.has(todayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (set.has(todayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function bestStreak() {
  const days = state.days.slice().sort();
  let best = 0, run = 0, prev = null;
  for (const k of days) {
    const [y, m, dd] = k.split('-').map(Number);
    const cur = new Date(y, m - 1, dd).getTime();
    run = prev != null && Math.round((cur - prev) / 86400000) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = cur;
  }
  return best;
}
export const activeToday = () => state.days.includes(todayKey());
