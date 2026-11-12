// Data loading with in-memory caching and tolerant normalisation.
import { arr, str } from './util.js';

export const DATA_CACHE = 'comprep-data-v1'; // must match sw.js
const DEFAULT_SUBJECTS = ['accountancy', 'bst', 'english', 'maths', 'economics'];
const FALLBACK_META = {
  accountancy: { name: 'Accountancy', shortName: 'Accounts', icon: '📒', color: '#2F6FB2' },
  bst: { name: 'Business Studies', shortName: 'BST', icon: '💼', color: '#B5531F' },
  english: { name: 'English Core', shortName: 'English', icon: '📖', color: '#7A3FA0' },
  maths: { name: 'Mathematics', shortName: 'Maths', icon: '📐', color: '#1F7A5A' },
  economics: { name: 'Economics', shortName: 'Eco', icon: '📊', color: '#A8325E' },
};

const ID = /^[a-z0-9][a-z0-9_-]{0,80}$/i;
const FILE = /^[a-z0-9][a-z0-9._-]{0,120}\.json$/i;
export const validId = (s) => ID.test(str(s));

const mem = new Map();
async function getJSON(url) {
  if (mem.has(url)) return mem.get(url);
  const p = fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  mem.set(url, p);
  const v = await p;
  if (v == null) mem.delete(url); // allow a retry later (e.g. file added since)
  return v;
}

let subjectIds = null;
export async function subjectIds_() {
  if (subjectIds) return subjectIds;
  const list = await getJSON('data/subjects.json');
  subjectIds = Array.isArray(list) ? list.filter(validId) : DEFAULT_SUBJECTS;
  if (!subjectIds.length) subjectIds = DEFAULT_SUBJECTS;
  return subjectIds;
}
export { subjectIds_ as subjectIds };

export function fallbackSubject(id) {
  const f = FALLBACK_META[id] || {};
  return {
    id, name: f.name || id, shortName: f.shortName || f.name || id, code: '', color: f.color || '#12515A',
    icon: f.icon || '📘', theoryMarks: null, description: '', units: [], missing: true,
  };
}

const subjCache = new Map();
export async function subject(id) {
  if (!validId(id)) return null;
  if (subjCache.has(id)) return subjCache.get(id);
  const raw = await getJSON(`data/${id}/index.json`);
  if (!raw || typeof raw !== 'object') return fallbackSubject(id);
  const fb = fallbackSubject(id);
  const s = {
    id,
    name: str(raw.name) || fb.name,
    shortName: str(raw.shortName) || str(raw.name) || fb.shortName,
    code: str(raw.code),
    color: /^#[0-9a-f]{3,8}$/i.test(str(raw.color)) ? raw.color : fb.color,
    icon: str(raw.icon) || fb.icon,
    theoryMarks: Number.isFinite(raw.theoryMarks) ? raw.theoryMarks : null,
    description: str(raw.description),
    units: arr(raw.units).filter((u) => u && typeof u === 'object').map((u, ui) => ({
      id: str(u.id) || `u${ui + 1}`,
      title: str(u.title) || `Unit ${ui + 1}`,
      marks: Number.isFinite(u.marks) ? u.marks : null,
      chapters: arr(u.chapters).filter((c) => c && validId(c.id)).map((c) => ({
        id: c.id,
        title: str(c.title) || c.id,
        file: FILE.test(str(c.file)) ? c.file : `${c.id}.json`,
      })),
    })),
    missing: false,
  };
  subjCache.set(id, s);
  return s;
}

export async function allSubjects() {
  const ids = await subjectIds_();
  return Promise.all(ids.map((id) => subject(id)));
}

export function chaptersOf(s) {
  const out = [];
  for (const u of arr(s && s.units)) for (const c of u.chapters) out.push({ ...c, unit: u });
  return out;
}

export function chapterMeta(s, cid) {
  return chaptersOf(s).find((c) => c.id === cid) || null;
}

export const chapterUrl = (sid, meta) => `data/${sid}/${meta.file}`;

const chapCache = new Map();
export async function chapter(sid, cid) {
  if (!validId(sid) || !validId(cid)) return null;
  const key = `${sid}/${cid}`;
  if (chapCache.has(key)) return chapCache.get(key);
  const s = await subject(sid);
  const meta = chapterMeta(s, cid) || { id: cid, title: cid, file: `${cid}.json` };
  const raw = await getJSON(chapterUrl(sid, meta));
  if (!raw || typeof raw !== 'object') return null;
  const c = {
    id: cid,
    title: str(raw.title) || meta.title,
    summary: str(raw.summary),
    notes: arr(raw.notes).filter((n) => n && typeof n === 'object').map((n, i) => ({ heading: str(n.heading) || `Section ${i + 1}`, html: str(n.html) })),
    keyTerms: arr(raw.keyTerms).filter((t) => t && str(t.term)).map((t) => ({ term: str(t.term), definition: str(t.definition) })),
    formulas: arr(raw.formulas).filter((f) => f && (str(f.name) || str(f.html))).map((f) => ({ name: str(f.name), html: str(f.html) })),
    mcqs: arr(raw.mcqs).filter((m) => m && str(m.q) && Array.isArray(m.options) && m.options.length >= 2)
      .map((m) => ({
        q: str(m.q), options: m.options.map(str),
        answer: Number.isInteger(m.answer) && m.answer >= 0 && m.answer < m.options.length ? m.answer : 0,
        explanation: str(m.explanation),
      })),
    questions: arr(raw.questions).filter((q) => q && str(q.q)).map((q) => ({
      q: str(q.q), marks: Number.isFinite(+q.marks) && +q.marks > 0 ? Math.round(+q.marks) : 0, answerHtml: str(q.answerHtml),
    })),
  };
  chapCache.set(key, c);
  return c;
}

// Official external links (syllabus, papers, textbooks) from data/resources.json.
// Tolerates a missing file or missing keys; only https links survive.
export const RES_URL = 'data/resources.json';
export const RES_KEYS = ['syllabus', 'samplePapers', 'lastYearPapers', 'ncert'];
function normLink(it) {
  if (!it || typeof it !== 'object') return null;
  let u;
  try { u = new URL(str(it.url).trim()); } catch (e) { return null; }
  if (u.protocol !== 'https:' || !u.hostname) return null;
  return {
    title: str(it.title).trim() || u.hostname, url: u.href, host: u.hostname.replace(/^www\./i, ''),
    source: str(it.source).trim(), note: str(it.note).trim(),
  };
}
export async function resources(sid) {
  const raw = await getJSON(RES_URL);
  const subs = raw && typeof raw === 'object' && raw.subjects && typeof raw.subjects === 'object' ? raw.subjects : null;
  const own = validId(sid) && subs && Object.prototype.hasOwnProperty.call(subs, sid) && subs[sid] && typeof subs[sid] === 'object' ? subs[sid] : null;
  const out = { ok: !!raw, updated: /^\d{4}-\d{2}-\d{2}$/.test(str(raw && raw.updated)) ? raw.updated : '' };
  for (const k of RES_KEYS) out[k] = arr(own && own[k]).map(normLink).filter(Boolean);
  return out;
}

// Official CBSE board papers bundled with the app (data/papers.json → papers/<subject>/*.pdf).
export async function papers(sid) {
  const raw = await getJSON('data/papers.json');
  const subs = raw && typeof raw === 'object' && raw.subjects && typeof raw.subjects === 'object' ? raw.subjects : null;
  const own = validId(sid) && subs && Object.prototype.hasOwnProperty.call(subs, sid) ? subs[sid] : null;
  return arr(own).filter((p) => p && /^papers\/[a-z]+\/[\w.-]+\.pdf$/.test(str(p.file))).map((p) => ({
    year: Math.round(+p.year) || 0, set: str(p.set).trim(), file: str(p.file), kb: Math.round(+p.kb) || 0,
  }));
}

// Fetch every chapter of every subject, reporting progress. Used by
// "Download all for offline" and the search indexer.
export async function forEachChapter(onChapter, onProgress) {
  const subs = (await allSubjects()).filter(Boolean);
  const jobs = [];
  for (const s of subs) for (const c of chaptersOf(s)) jobs.push([s, c]);
  let done = 0;
  onProgress && onProgress(0, jobs.length);
  const queue = jobs.slice();
  const worker = async () => {
    while (queue.length) {
      const [s, meta] = queue.shift();
      const c = await chapter(s.id, meta.id);
      done++;
      try { onChapter && onChapter(s, meta, c); } catch (e) { console.warn(e); }
      onProgress && onProgress(done, jobs.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return { total: jobs.length, subjects: subs };
}

// Explicitly store every data file in the cache used by the service worker.
export async function downloadAll(onProgress) {
  const subs = (await allSubjects()).filter(Boolean);
  const urls = ['data/subjects.json', RES_URL];
  for (const s of subs) {
    urls.push(`data/${s.id}/index.json`);
    for (const c of chaptersOf(s)) urls.push(chapterUrl(s.id, c));
  }
  let cache = null;
  try { if ('caches' in window) cache = await caches.open(DATA_CACHE); } catch (e) { cache = null; }
  let done = 0, failed = 0;
  onProgress(0, urls.length, 0);
  const queue = urls.slice();
  const worker = async () => {
    while (queue.length) {
      const url = queue.shift();
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res.ok) { if (cache) await cache.put(url, res.clone()); } else failed++;
      } catch (e) { failed++; }
      done++;
      onProgress(done, urls.length, failed);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { total: urls.length, failed, cached: !!cache };
}
