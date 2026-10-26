/* 청진노트 · 앱 동작 (모든 과목 공통)
 * 과목 내용은 subjects 폴더에 있고, 이 파일은 고칠 일이 거의 없습니다.
 * 기록은 이 기기 브라우저(localStorage)와 IndexedDB(내 그림)에만 저장됩니다.
 */
(function(){
'use strict';

const appEl = document.getElementById('app');
const KEY = 'cheongjin-note.v2', KEY1 = 'cheongjin-note.v1', GKEY = 'cheongjin-note.gichul';
const DAY = 864e5, HOUR = 36e5, MIN = 6e4;
/* 복습 간격: 배운 직후 → 같은 날(3시간 뒤) → 1일 → 3일 → 7일 → 14일 → 30일 */
const SCHED = [{ h: 3 }, { d: 1 }, { d: 3 }, { d: 7 }, { d: 14 }, { d: 30 }];
const KNOWN = 2, MASTER = 3;
const CIRC = '①②③④⑤⑥⑦⑧⑨⑩'.split('');
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const ST_LABEL = { new: '새 개념', learned: '배움', known: '외움', master: '마스터' };
const LV_LABEL = ['설명', '요약', '암기', '떠올리기'];
const V = {}, ACT = {}, T = {};

/* ───────── 유틸 ───────── */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const bold = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const plain = s => String(s == null ? '' : s).replace(/\*\*/g, '');
const sod = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const dkey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const hhmm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const paras = t => String(t || '').split('\n').filter(Boolean).map(p => '<p>' + esc(p) + '</p>').join('');
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const mb = n => (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + 'MB';
const fmtMs = ms => { const s = Math.max(0, Math.round(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function hash(s){ let h = 0; s = String(s); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
let toastT;
function toast(m){ const t = $('#toast'); if (!t) return; t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2800); }
function nospace(s){ return String(s || '').replace(/\s+/g, ''); }

/* ───────── 저장 ───────── */
function freshSubj(){
  return { c: {}, q: {}, cw: {}, edits: {}, mine: {}, flags: {}, ill: {}, tbl: {}, ord: {}, exams: [], custom: [],
    mnr: {}, figTodo: {}, figAsked: {}, figp: {}, known: null, snap: {}, d: {}, ses: null, qz: null, scope: null, lastUse: 0,
    mode: 'all', noAdd: false, cramAt: 0, qe: {}, qh: {}, myc: [] };
}
function fresh(){
  return { v: 2, cur: null, route: null,
    set: { scale: 1, theme: '', figAsk: true, noteRange: 'all', noteMode: 'mn', noteView: 'sheet', noteZoom: 'fit', qAll: false, order: 'toc', hideSubj: {} },
    log: {}, subj: {}, gq: {}, gdraft: null, sums: {}, created: Date.now(), lastBackup: 0 };
}
function normalize(o){
  const f = fresh(); const set = Object.assign(f.set, o.set || {});
  o = Object.assign(f, o); o.set = set; o.subj = o.subj || {}; o.sums = o.sums || {}; set.hideSubj = set.hideSubj || {};
  Object.keys(o.subj).forEach(k => { o.subj[k] = Object.assign(freshSubj(), o.subj[k]); });
  return o;
}
function fromV1(o){
  const S2 = fresh(), s = freshSubj();
  s.c = o.c || {};
  Object.keys(s.c).forEach(k => { const x = s.c[k]; if (x && x.learned && x.step > SCHED.length) x.step = SCHED.length; });
  Object.keys(o.q || {}).forEach(k => {
    const r = o.q[k] || {};
    s.q[k] = { r: r.r || 0, w: r.w || 0, streak: r.streak || 0, last: r.last || 0, wrong: !!r.wrong, why: r.why || null, lastOk: !r.wrong && (r.r || 0) > 0 };
  });
  ['edits', 'mine', 'flags', 'ill', 'tbl', 'ord'].forEach(k => { s[k] = o[k] || {}; });
  s.exams = o.exams || []; s.custom = o.custom || []; s.migrated = 1;
  S2.subj['health-assessment'] = s;
  Object.keys(o.log || {}).forEach(d => { const L = o.log[d] || {}; S2.log[d] = { sec: (L.min || 0) * 60, ses: L.ses || 0, cards: L.cards || 0, qs: L.qs || 0, newC: L.newC || 0 }; });
  if (o.set) { S2.set.scale = o.set.scale || 1; S2.set.theme = o.set.theme || ''; }
  S2.created = o.created || Date.now(); S2.lastBackup = o.lastBackup || 0; S2.fromV1 = Date.now();
  return S2;
}
function load(){
  try { const raw = localStorage.getItem(KEY); if (raw) { const o = JSON.parse(raw); if (o && o.v === 2) return normalize(o); } } catch (e) {}
  try { const raw = localStorage.getItem(KEY1); if (raw) { const o = JSON.parse(raw); if (o && o.v === 1) return fromV1(o); } } catch (e) {}
  return fresh();
}
let S = load();
let canSave = true;
function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); canSave = true; } catch (e) { canSave = false; } }
/* 국시 기출은 크기가 커서 따로 저장합니다 (이 기기에만) */
function loadG(){ try { const raw = localStorage.getItem(GKEY); if (raw) { const o = JSON.parse(raw); if (o && Array.isArray(o.qs)) return o; } } catch (e) {} return { sets: [], qs: [] }; }
let G = loadG();
function saveG(){ try { localStorage.setItem(GKEY, JSON.stringify(G)); return true; } catch (e) { toast('저장 공간이 부족해서 기출을 저장하지 못했어요'); return false; } }

function logInc(k, n){ const d = dkey(Date.now()); const L = S.log[d] || (S.log[d] = { sec: 0, ses: 0, cards: 0, qs: 0, newC: 0 }); L[k] = (L[k] || 0) + (n == null ? 1 : n); }
const R = { sid: null, tab: 'study', stack: [], sheet: null, t: {}, lv: {}, viewMode: 'auto', lastAct: 0, pdf: null };
function tick(){
  const now = Date.now(); const d = now - (R.lastAct || now);
  if (d > 0 && d < 5 * MIN) logInc('sec', Math.round(d / 1000));
  R.lastAct = now;
}

/* ───────── 과목 내용 ───────── */
const SUB = {}; let ORDER = []; const LOADERR = [];
let X = null;
const clampPr = n => Math.min(3, Math.max(1, Math.round(+n) || 2));
/* 반영 파일(subjects/과목id-fix.js)의 고친 내용을 과목 내용에 먼저 적용 */
function patchDef(def, fx){
  if (!fx) return;
  (fx.add || []).forEach(a => {
    const u = (def.units || []).find(z => z.id === a.u); if (!u || !a.id) return;
    u.concepts = u.concepts || []; if (u.concepts.some(c => c.id === a.id)) return;
    u.concepts.push(Object.assign({}, a, { fixAdd: true }));
  });
  const cm = {}; (def.units || []).forEach(u => (u.concepts || []).forEach(c => { cm[c.id] = c; }));
  Object.keys(fx.concepts || {}).forEach(id => { if (cm[id]) Object.assign(cm[id], fx.concepts[id]); });
}
function buildSubject(def, fx){
  patchDef(def, fx);
  const af = +def.addFrom || 3; /* 이 차수부터 '추가' 표시 */
  const isNew = o => (+o.v || 0) >= af;
  const x = { id: def.id, title: def.title || def.id, def, fix: fx || null, version: def.version || 1, units: def.units || [], concepts: [], cmap: {}, umap: {}, qs: [], qmap: {},
    tables: def.tables || [], orders: def.orders || [], pairs: def.pairs || [], numbers: def.numbers || [] };
  x.units.forEach((u, ui) => {
    u.n = ui + 1; x.umap[u.id] = u; u.concepts = u.concepts || [];
    u.concepts.forEach((c, ci) => { c.u = u.id; c.n = ci + 1; c.sum = c.sum || []; c.mn = c.mn || []; c.cards = c.cards || []; c.pr = clampPr(c.pr || (c.imp ? 3 : 2)); c.add = isNew(c) || !!c.fixAdd; x.concepts.push(c); x.cmap[c.id] = c; });
  });
  x.tables.concat(x.orders, x.pairs).forEach(t => { t.add = isNew(t); });
  x.numbers.forEach(n => { n.add = !!n.v3 || (+n.ver || 0) >= af; });
  /* 표·순서·쌍·숫자는 단원 순서로 (추가된 것도 제 단원 자리에) */
  const ui = id => { const u = x.umap[id]; return u ? u.n : 99; };
  ['tables', 'orders', 'pairs', 'numbers'].forEach(k => { x[k] = x[k].slice().sort((a, b) => ui(a.u) - ui(b.u)); });
  x.concepts.forEach(c => (c.ox || []).forEach((o, i) => {
    const q = { id: c.id + '-ox' + (i + 1), type: 'ox', q: o[0], o: ['O', 'X'], a: o[1] ? 0 : 1, e: o[2], c: [c.id], u: c.u, lv: 1, v: c.v, add: c.add };
    x.qs.push(q); x.qmap[q.id] = q;
  }));
  const addMC = (q, uidd) => {
    if (!q || !q.id || x.qmap[q.id]) return;
    const y = Object.assign({ type: 'mc' }, q);
    y.u = q.u || uidd;
    y.c = (Array.isArray(q.c) ? q.c : (q.c ? [q.c] : [])).filter(id => x.cmap[id]).slice(0, 4);
    y.lv = q.lv || (q.case ? 2 : 1); y.add = isNew(q);
    if (!y.u && y.c.length) y.u = x.cmap[y.c[0]].u;
    x.qs.push(y); x.qmap[y.id] = y;
  };
  x.units.forEach(u => (u.qs || []).forEach(q => addMC(q, u.id)));
  (def.extraQs || []).forEach(q => addMC(q, q.u));
  if (fx) {
    Object.keys(fx.qs || {}).forEach(id => { if (x.qmap[id]) Object.assign(x.qmap[id], fx.qs[id]); });
    const hid = new Set(fx.hide || []); if (hid.size) x.qs = x.qs.filter(q => !hid.has(q.id)); /* 뺀 문제: 목록에서만 빼요 */
  }
  x.mcN = x.qs.filter(q => q.type === 'mc').length;
  return x;
}
function isAdd(o){ return !!(o && o.add); }

/* ───────── 과목 불러오기: 그 과목에 들어갈 때만 ───────── */
const LOADED = new Set(), LOADING = {};
function listItem(sid){ return (window.NSA_LIST || []).find(i => i && i.id === sid) || null; }
function subjFiles(it){ return Array.isArray(it.files) && it.files.length ? it.files : ['subjects/' + it.id + '.js']; }
function addErr(m){ if (!LOADERR.includes(m)) LOADERR.push(m); }
function ensureSubject(sid){
  if (SUB[sid]) return Promise.resolve(true);
  if (LOADING[sid]) return LOADING[sid];
  const it = listItem(sid); if (!it) return Promise.resolve(false);
  LOADING[sid] = (async () => {
    let miss = false;
    for (const f of subjFiles(it)) { if (LOADED.has(f)) continue; try { await loadScript(f); LOADED.add(f); } catch (e) { miss = true; addErr((it.title || sid) + ': ' + f + ' 파일을 찾지 못했어요 (GitHub에 올렸는지, 이름이 맞는지 확인)'); } }
    const fxf = 'subjects/' + sid + '-fix.js'; /* 고친 내용 반영 파일 (있을 때만) */
    if (it.fix !== false && !LOADED.has(fxf)) { LOADED.add(fxf); try { await loadScript(fxf); } catch (e) {} }
    const reg = window.NSA || {}; const d = reg.subjects && reg.subjects[sid];
    if (d && d.units && d.units.length) { try { const x = buildSubject(d, (reg.fixes || {})[sid]); x.meta = it; SUB[sid] = x; applyLocal(x); } catch (e) { try { console.error(e); } catch (z) {} } }
    if (!SUB[sid] && !miss) addErr((it.title || sid) + ' 과목 파일 (형식 오류가 있는지 확인)');
    delete LOADING[sid];
    return !!SUB[sid];
  })();
  return LOADING[sid];
}
async function ensureAll(){ for (const id of ORDER) await ensureSubject(id); }
function loadedIds(){ return ORDER.filter(id => SUB[id]); }

/* ───────── 이 기기에서 고친 내용 겹쳐 적용 (개념 제목·중요도, 내 개념, 문제) ───────── */
const same = (a, b) => JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b);
const mnKS = m => (m || []).map(z => [z.k || '', z.s || '']);
function cleanLocal(x, s){
  /* 반영 파일로 이미 모두에게 들어간 내 수정은 저절로 정리돼요 */
  s.myc = (s.myc || []).filter(m => !(x.cmap[m.id] && !x.cmap[m.id].mine));
  Object.keys(s.edits || {}).forEach(id => {
    const b = x.cmap[id]; if (!b || b.mine) return; const e = s.edits[id]; const o = b.o0 || b;
    const eq = (e.ex == null || e.ex === b.ex) && (e.sum == null || same(e.sum, b.sum)) && (e.mn == null || same(mnKS(e.mn), mnKS(b.mn))) &&
      (e.t == null || e.t === o.t) && (e.pr == null || +e.pr === o.pr) && (e.note == null || (e.note || '') === (b.note || ''));
    if (eq) delete s.edits[id];
  });
  Object.keys(s.qe || {}).forEach(id => { const b = (x.qbase && x.qbase[id]) || x.qmap[id]; if (!b) return; const e = s.qe[id]; if (Object.keys(e).every(k => same(e[k], b[k]))) delete s.qe[id]; });
  Object.keys(s.qh || {}).forEach(id => { if (x.qmap[id] && !x.qs.some(q => q.id === id && !q.mine)) delete s.qh[id]; });
}
function applyLocal(x){
  x = x || X; if (!x) return; const s = SS(x.id);
  x.qbase = x.qbase || {};
  Object.keys(x.qbase).forEach(id => { const b = x.qbase[id]; const i = x.qs.indexOf(x.qmap[id]); if (i >= 0) x.qs[i] = b; x.qmap[id] = b; });
  x.qbase = {};
  x.concepts.forEach(c => { if (c.o0) { c.t = c.o0.t; c.pr = c.o0.pr; delete c.o0; } });
  cleanLocal(x, s);
  /* 내 개념 */
  x.units.forEach(u => { u.concepts = u.concepts.filter(c => !c.mine); });
  Object.keys(x.cmap).forEach(k => { if (x.cmap[k].mine) delete x.cmap[k]; });
  x.qs = x.qs.filter(q => !q.mine); Object.keys(x.qmap).forEach(k => { if (x.qmap[k].mine) delete x.qmap[k]; });
  (s.myc || []).forEach(m => {
    const u = x.umap[m.u]; if (!u || x.cmap[m.id]) return;
    const c = { id: m.id, t: m.t || '내 개념', pr: clampPr(m.pr), ex: m.ex || '', sum: m.sum || [], mn: m.mn || [], cards: [], kw: m.kw || [], ox: m.ox || [], note: m.note || '', u: u.id, mine: true, add: false, ts: m.ts };
    u.concepts.push(c); x.cmap[c.id] = c;
    c.ox.forEach((o, i) => { const q = { id: c.id + '-ox' + (i + 1), type: 'ox', q: o[0], o: ['O', 'X'], a: o[1] ? 0 : 1, e: o[2] || '', c: [c.id], u: c.u, lv: 1, mine: true }; x.qs.push(q); x.qmap[q.id] = q; });
  });
  x.concepts = []; x.units.forEach(u => { u.concepts.forEach((c, i) => { c.n = i + 1; }); x.concepts.push.apply(x.concepts, u.concepts); });
  /* 개념 제목·중요도 */
  Object.keys(s.edits || {}).forEach(id => { const c = x.cmap[id], e = s.edits[id]; if (!c || c.mine || (e.t == null && e.pr == null)) return; c.o0 = { t: c.t, pr: c.pr }; if (e.t) c.t = e.t; if (e.pr) c.pr = clampPr(e.pr); });
  /* 문제 고치기 */
  Object.keys(s.qe || {}).forEach(id => { const b = x.qmap[id]; if (!b || b.mine) return; const y = Object.assign({}, b, s.qe[id], { edited: true }); x.qbase[id] = b; const i = x.qs.indexOf(b); if (i >= 0) x.qs[i] = y; x.qmap[id] = y; });
}

/* ───────── 공부 모드: 중요도 범위 + 추가 내용 ───────── */
const MODES = {
  cram: { min: 3, name: '당일치기', range: '★★★만', desc: '★★★ 자주 출제만 · 하루 안에 몰아서 복습' },
  core: { min: 2, name: '핵심', range: '★★ 이상', desc: '★★ 이상 · 중요한 것부터 · 날짜 간격 복습' },
  all: { min: 1, name: '전체', range: '전체', desc: '모든 개념 · 날짜 간격 복습' }
};
function modeOf(sid){ const s = S.subj[sid || (X && X.id)]; return s && MODES[s.mode] ? s.mode : 'all'; }
function addOff(sid){ const s = S.subj[sid || (X && X.id)]; return !!(s && s.noAdd); }
function inRange(c){ return !!c && c.pr >= MODES[modeOf()].min && !(c.add && addOff()); }
function CS(){ return X.concepts.filter(inRange); }
function UC(u){ return u.concepts.filter(inRange); }
function addVisible(c){ return !(c.add && addOff()); }
function scopeSet(){ const sc = scopeIds(); return sc ? new Set(sc) : null; }
function qIn(q){
  if (q.gc || q.src === 'custom') return true;
  if (SS().qh[q.id]) return false; if (q.add && addOff()) return false;
  return links(q).every(id => { const c = X.cmap[id]; return !c || inRange(c); });
}
/* 당일치기: 배운 직후 → 10분 → 1시간 → 3시간 → 다음 날 아침 */
const CRAM = [10 * MIN, HOUR, 3 * HOUR], DONE = 9e15;
function cramOn(){ return modeOf() === 'cram'; }
function cramDue(s){ return s.cr === (SS().cramAt || 0) ? (s.cd || 0) : 0; }
function cramNext(step, now){ if (step < CRAM.length) return now + CRAM[step]; if (step === CRAM.length) { const m = sod(now) + 7 * HOUR; return new Date(now).getHours() < 4 ? m : m + DAY; } return DONE; }
function cramSet(s, step, now){ s.cr = SS().cramAt || 0; s.cs = step; s.cd = cramNext(step, now); }
function dueAt(id){ const s = crec(id); if (!s) return 0; return cramOn() ? cramDue(s) : s.due; }
function SS(sid){ sid = sid || (X && X.id); return S.subj[sid] || (S.subj[sid] = freshSubj()); }
function cOf(sid, cid){
  const x = SUB[sid]; if (!x) return null; const b = x.cmap[cid]; if (!b) return null;
  const e = S.subj[sid] && S.subj[sid].edits[cid];
  return e ? Object.assign({}, b, { ex: e.ex != null ? e.ex : b.ex, sum: e.sum || b.sum, mn: e.mn || b.mn, note: e.note != null ? e.note : b.note, edited: true }) : b;
}
function C(id){ return cOf(X.id, id); }
function mnList(c, sid){
  const s = SS(sid || X.id); const r = s.mnr[c.id] || {}; const out = [];
  if (s.mine[c.id]) out.push({ k: '내 암기법', s: s.mine[c.id], mine: true });
  const def = (c.mn || []).map((m, i) => Object.assign({ idx: i, down: r[i] === 'down', up: r[i] === 'up' }, m));
  return out.concat(def.filter(m => !m.down), def.filter(m => m.down));
}

/* ───────── 간격 반복 ───────── */
function crec(id){ return SS().c[id]; }
function crecOf(sid, cid){ const s = S.subj[sid]; return s && s.c[cid]; }
function isLearned(id){ const s = crec(id); return !!(s && s.learned); }
function learnedAny(sid, cid){ const r = crecOf(sid, cid); return !!(r && r.learned); }
function status(id){ const s = crec(id); if (!s || !s.learned) return 'new'; if (s.step >= MASTER) return 'master'; if (s.step >= KNOWN) return 'known'; return 'learned'; }
function nextDue(step, now){ if (step >= SCHED.length) return sod(now) + 45 * DAY; const e = SCHED[step]; return e.h ? now + e.h * HOUR : sod(now) + e.d * DAY; }
function learnConcept(id){
  const now = Date.now(); const s = SS().c[id] || { seen: 0, ok: 0, ng: 0 };
  if (!s.learned) { s.learned = now; s.step = 0; s.due = nextDue(0, now); logInc('newC'); if (cramOn()) cramSet(s, 0, now); }
  SS().c[id] = s;
}
function grade(id, g){
  const now = Date.now(); const s = crec(id); if (!s || !s.learned) return;
  s.seen = (s.seen || 0) + 1; s.last = now;
  if (cramOn()) { /* 당일치기는 하루 몰아 복습 간격만 바꾸고, 평소 복습 일정은 그대로 둬요 */
    const st = s.cr === (SS().cramAt || 0) ? (s.cs || 0) : 0;
    if (g === 2) { s.ok = (s.ok || 0) + 1; cramSet(s, st + 1, now); s.lv0 = false; }
    else if (g === 1) { cramSet(s, st, now); s.cd = now + 10 * MIN; }
    else { s.ng = (s.ng || 0) + 1; cramSet(s, 0, now); s.lv0 = true; }
    logInc('cards'); return;
  }
  if (g === 2) { s.ok = (s.ok || 0) + 1; s.step = (s.step || 0) + 1; s.due = nextDue(s.step, now); s.lv0 = false; }
  else if (g === 1) { s.due = (s.step || 0) === 0 ? now + 3 * HOUR : sod(now) + DAY; }
  else { s.ng = (s.ng || 0) + 1; s.step = 0; s.due = now + 10 * MIN; s.lv0 = true; }
  logInc('cards');
}
function duePool(){ const sc = scopeSet(); return X.concepts.filter(c => inRange(c) || (sc && sc.has(c.id))); }
function dueList(now){
  now = now || Date.now();
  if (cramOn()) return duePool().filter(c => { const s = crec(c.id); return s && s.learned && cramDue(s) <= now; }).sort((a, b) => cramDue(crec(a.id)) - cramDue(crec(b.id)));
  return duePool().filter(c => { const s = crec(c.id); return s && s.learned && s.due <= now; }).sort((a, b) => crec(a.id).due - crec(b.id).due);
}
function pendingSame(now){
  now = now || Date.now();
  if (cramOn()) return duePool().filter(c => { const s = crec(c.id); if (!s || !s.learned) return false; const d = cramDue(s); return d > now && d < DONE; }).sort((a, b) => cramDue(crec(a.id)) - cramDue(crec(b.id)));
  return duePool().filter(c => { const s = crec(c.id); return s && s.learned && (s.step || 0) === 0 && s.due > now; }).sort((a, b) => crec(a.id).due - crec(b.id).due);
}
/* 공부 범위: 목차에서 고른 개념 (없으면 전체) */
function scopeIds(){ const sc = SS().scope; if (!sc || !sc.length) return null; const ids = sc.filter(id => X.cmap[id]); return ids.length ? ids : null; }
function nextNew(n){
  const set = scopeSet(); /* 목차에서 고른 범위가 있으면 그것이 먼저 */
  let l = set ? X.concepts.filter(c => !isLearned(c.id) && set.has(c.id)) : CS().filter(c => !isLearned(c.id));
  if (modeOf() !== 'all' || S.set.order === 'pr') l = l.slice().sort((a, b) => b.pr - a.pr); /* 같은 별 안에서는 목차 순 */
  return l.slice(0, Math.max(0, n));
}
function conceptQAcc(){
  const m = {};
  allQ().concat(gcQs()).forEach(q => { const r = qrec(q); if (!r || !(r.r + r.w)) return; links(q).forEach(cid => { const a = m[cid] || (m[cid] = { att: 0, ok: 0 }); a.att++; if (r.lastOk) a.ok++; }); });
  return m;
}
function scopeLabel(ids){
  const set = new Set(ids); const parts = [];
  X.units.forEach(u => { const n = u.concepts.filter(c => set.has(c.id)).length; if (!n) return; parts.push(u.n + '. ' + (u.short || u.title) + (n < u.concepts.length ? ' 일부(' + n + ')' : '')); });
  return parts.join(', ');
}

/* ───────── 문제 ───────── */
function customQs(){
  return (SS().custom || []).map(q => { const y = Object.assign({ type: 'mc', src: 'custom', lv: 1 }, q); y.c = Array.isArray(q.c) ? q.c.filter(id => X.cmap[id]) : []; return y; });
}
function setTitle(id){ const s = G.sets.find(x => x.id === id); return s ? s.title : '기출'; }
function gq(g){
  const lk = (g.lk || []).filter(l => SUB[l[0]] && SUB[l[0]].cmap[l[1]]);
  const mine = X ? lk.filter(l => l[0] === X.id).map(l => l[1]) : [];
  const u = mine.length && X ? X.cmap[mine[0]].u : null;
  return { id: g.id, type: 'mc', q: g.q, o: g.o, a: g.a, gc: true, set: g.set, no: g.no, setTitle: setTitle(g.set), lk, c: mine, u, e: '',
    my: g.my || '', img: g.img || null, sub: g.sub || '', tag: '실제 기출', lv: 2 };
}
function gcQs(){ return X ? G.qs.filter(g => g.a >= 0 && (g.lk || []).some(l => l[0] === X.id)).map(gq) : []; }
function allQ(){ return X.qs.filter(qIn).concat(customQs()); }
function allQx(){ return X.qs.filter(q => !SS().qh[q.id]).concat(customQs()); } /* 범위와 상관없이 (개념별 문제 등) */
function Q(id){
  if (!id) return null;
  if (X && X.qmap[id]) return X.qmap[id];
  if (id[0] === 'x' && X) return customQs().find(z => z.id === id) || null;
  if (id[0] === 'g') { const g = G.qs.find(z => z.id === id); return g ? gq(g) : null; }
  return null;
}
function links(q){ return q.c || []; }
function lkOf(q){ return q.gc ? (q.lk || []) : links(q).map(c => [X.id, c]); }
function unlocked(q){ if (q.gc) return (q.lk || []).length > 0 && q.lk.every(l => learnedAny(l[0], l[1])); return links(q).every(isLearned); }
function qstore(q){ return q.gc ? S.gq : SS().q; }
function qrec(q){ return qstore(q)[q.id]; }
function qrecMake(q){ const st = qstore(q); return st[q.id] || (st[q.id] = { r: 0, w: 0, streak: 0 }); }
const inPool = r => !!(r && (r.wrong || r.unsure || r.hint));
function noShuffle(q){ return q.type === 'ox' || q.gc || q.src === 'custom' || q.o.every(o => /^\d/.test(String(o).trim())); }
function permFor(q){ const p = q.o.map((_, i) => i); return noShuffle(q) ? p : shuffle(p); }
function cwInc(sid, cid, k){ const s = SS(sid); const a = s.cw[cid] || (s.cw[cid] = [0, 0]); a[k]++; }
function recordQ(q, ok, st){
  const now = Date.now(); const r = qrecMake(q);
  r.last = now; r.lastOk = ok;
  if (ok) {
    r.r++;
    if (st && st.hint) { r.hint = true; r.streak = 0; } else r.streak = (r.streak || 0) + 1;
    lkOf(q).forEach(l => cwInc(l[0], l[1], 0));
  } else { r.w++; r.streak = 0; r.wrong = true; }
  if (r.streak >= 2) { r.wrong = false; r.unsure = false; r.hint = false; }
  const d = SS().d; const k = dkey(now); const a = d[k] || (d[k] = [0, 0]); a[1]++; if (ok) a[0]++;
  logInc('qs');
  const acc = qStats(allQ()).acc; if (acc != null) { SS().snap[k] = acc; const ks = Object.keys(SS().snap).sort(); if (ks.length > 70) delete SS().snap[ks[0]]; }
}
/* 틀린 문제: 고른 개념만 (고르지 않으면 연결된 개념 모두) 다시 복습 */
function penalize(q, chosen){
  const now = Date.now(); let list = lkOf(q);
  if (chosen && chosen.length) list = list.filter(l => chosen.includes(l[0] + '|' + l[1]));
  list.forEach(l => {
    cwInc(l[0], l[1], 1);
    const s = crecOf(l[0], l[1]); if (!s || !s.learned) return;
    if (s.step >= KNOWN) SS(l[0]).ill[l[1]] = now;
    s.lv0 = true; s.step = Math.max(0, (s.step || 0) - 1); s.due = Math.min(s.due, sod(now) + DAY);
  });
}
function markUnsure(q){
  const r = qrecMake(q); r.unsure = true; r.streak = 0;
  lkOf(q).forEach(l => { const s = crecOf(l[0], l[1]); if (s && s.learned) s.due = Math.min(s.due, sod(Date.now()) + DAY); });
}
/* 답한 뒤 다음으로 넘어갈 때 한 번만 반영 */
function settleQ(q, st){
  if (!q || !st || !st.shown || st.settled || st.pick == null) return;
  st.settled = true;
  if (st.pick !== q.a) penalize(q, st.cs);
  else if (st.conf === 'unsure') markUnsure(q);
}
function reviewPool(){ return allQ().concat(gcQs()).filter(q => inPool(qrec(q))).sort((a, b) => (qrec(a).last || 0) - (qrec(b).last || 0)); }
function qStats(list){ let att = 0, ok = 0; list.forEach(q => { const r = qrec(q); if (r && (r.r + r.w) > 0) { att++; if (r.lastOk) ok++; } }); return { att, ok, acc: att ? Math.round(ok / att * 100) : null }; }
function weekDelta(acc){
  if (acc == null) return null; const s = SS().snap; const lim = dkey(sod(Date.now()) - 7 * DAY);
  const ks = Object.keys(s).filter(k => k <= lim).sort(); if (!ks.length) return null;
  return acc - s[ks[ks.length - 1]];
}
function subjStats(){
  const cs = CS(); const Tn = cs.length; let L = 0, K = 0, M = 0;
  cs.forEach(c => { const st = status(c.id); if (st !== 'new') L++; if (st === 'known' || st === 'master') K++; if (st === 'master') M++; });
  const every = X.concepts.filter(addVisible); const aL = every.filter(c => isLearned(c.id)).length;
  const qs = allQ(); const qa = qStats(qs); const gqs = gcQs(); const g = qStats(gqs);
  return { T: Tn, L, K, M, prog: pct(L, Tn), knownP: pct(K, Tn), masterP: pct(M, Tn), qN: qs.length, open: qs.filter(unlocked).length,
    att: qa.att, acc: qa.acc, delta: weekDelta(qa.acc), gN: gqs.length, gAtt: g.att, gAcc: g.acc,
    mode: modeOf(), allT: every.length, allL: aL, allProg: pct(aL, every.length), nAdd: X.concepts.filter(c => c.add).length };
}
function statsFor(sid){ const prev = X; X = SUB[sid]; try { return subjStats(); } finally { X = prev; } }
function weakTop(n){
  const m = SS().cw;
  return Object.keys(m).filter(k => inRange(X.cmap[k]) && m[k][1] > 0).map(k => ({ id: k, acc: m[k][0] / (m[k][0] + m[k][1]) }))
    .filter(w => w.acc < 0.85).sort((a, b) => a.acc - b.acc).slice(0, n);
}
function weakSet(){
  const set = new Set(); const m = SS().cw;
  Object.keys(m).forEach(k => { const a = m[k]; if (a[1] > 0 && a[0] / (a[0] + a[1]) < 0.7 && inRange(X.cmap[k])) set.add(k); });
  Object.keys(SS().ill).forEach(k => { if (inRange(X.cmap[k])) set.add(k); });
  CS().forEach(c => { const s = crec(c.id); if (s && s.lv0) set.add(c.id); });
  return set;
}
function unitStats(u){
  const cs = UC(u); const L = cs.filter(c => isLearned(c.id)).length;
  const qs = allQ().filter(q => q.u === u.id); const a = qStats(qs);
  return { n: cs.length, L, prog: pct(L, cs.length), acc: a.acc, att: a.att, qN: qs.length };
}

/* 새 내용 알림: 과목 파일이 바뀌면 새 개념·문제 수를 알려 주고, 바뀐 개념은 다시 복습에 넣어요 */
function chash(c){ return hash(JSON.stringify([c.sum, (c.mn || []).map(m => [m.k, m.s])])); }
function ensureKnown(){
  const s = SS(); const K = { concepts: X.concepts.filter(c => !c.mine), qs: X.qs.filter(q => !q.mine), cmap: X.cmap }; /* 내 개념은 빼고 비교 */
  if (!s.known) {
    if (s.migrated) s.known = { c: K.concepts.filter(c => !c.v).map(c => c.id), q: K.qs.filter(q => q.type === 'ox' ? !K.cmap[q.c[0]].v : !/-[na]\d/.test(q.id)).map(q => q.id), h: {} };
    else s.known = { c: K.concepts.map(c => c.id), q: K.qs.map(q => q.id), h: {} };
    K.concepts.forEach(c => { if (!s.known.h[c.id]) s.known.h[c.id] = chash(c); });
  }
  const kc = new Set(s.known.c), kq = new Set(s.known.q);
  const newC = K.concepts.filter(c => !kc.has(c.id)), newQ = K.qs.filter(q => !kq.has(q.id));
  const changed = K.concepts.filter(c => kc.has(c.id) && s.known.h[c.id] != null && s.known.h[c.id] !== chash(c));
  if (newC.length || newQ.length || changed.length) {
    const now = Date.now(); let re = 0;
    changed.forEach(c => { const r = s.c[c.id]; if (r && r.learned && !s.edits[c.id]) { r.due = Math.min(r.due, now); r.lv0 = true; re++; } });
    R.update = { c: newC.length, q: newQ.length, ch: changed.length, re };
    s.known = { c: K.concepts.map(c => c.id), q: K.qs.map(q => q.id), h: {} };
    K.concepts.forEach(c => { s.known.h[c.id] = chash(c); });
    save();
  }
}

/* ───────── 내 그림 (IndexedDB) ───────── */
const IMG = { db: null, ok: false, meta: [], urls: {} };
function idbOpen(){
  return new Promise(res => {
    try {
      const rq = indexedDB.open('cheongjin-img', 1);
      rq.onupgradeneeded = () => { const db = rq.result; if (!db.objectStoreNames.contains('imgs')) db.createObjectStore('imgs', { keyPath: 'id' }); };
      rq.onsuccess = () => { IMG.db = rq.result; IMG.ok = true; res(true); };
      rq.onerror = () => res(false); rq.onblocked = () => res(false);
    } catch (e) { res(false); }
  });
}
function idbReq(mode, fn){
  return new Promise((res, rej) => {
    try {
      const tx = IMG.db.transaction('imgs', mode); const r = fn(tx.objectStore('imgs'));
      tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    } catch (e) { rej(e); }
  });
}
function stripBlob(r){ const m = Object.assign({}, r); m.size = r.full ? r.full.size : 0; delete m.full; return m; }
async function imgLoadMeta(){ if (!IMG.ok) return; const all = await idbReq('readonly', st => st.getAll()); IMG.meta = (all || []).map(stripBlob); }
async function imgPut(rec){
  await idbReq('readwrite', st => st.put(rec));
  const m = stripBlob(rec); const i = IMG.meta.findIndex(x => x.id === rec.id);
  if (i >= 0) IMG.meta[i] = m; else IMG.meta.push(m);
  if (IMG.urls[rec.id]) { URL.revokeObjectURL(IMG.urls[rec.id]); delete IMG.urls[rec.id]; }
}
function imgGet(id){ return idbReq('readonly', st => st.get(id)); }
async function imgDel(id){
  await idbReq('readwrite', st => st.delete(id));
  IMG.meta = IMG.meta.filter(x => x.id !== id);
  if (IMG.urls[id]) { URL.revokeObjectURL(IMG.urls[id]); delete IMG.urls[id]; }
}
async function imgPatch(id, patch){ const r = await imgGet(id); if (!r) return; Object.assign(r, patch); await imgPut(r); }
function imgMeta(id){ return IMG.meta.find(m => m.id === id) || null; }
function imgsOf(sid, cid){ return IMG.meta.filter(m => m.sid === sid && m.cid === cid).sort((a, b) => (a.order || 0) - (b.order || 0) || a.ts - b.ts); }
async function fullURL(id){
  if (IMG.urls[id]) return IMG.urls[id];
  const r = await imgGet(id); if (!r || !r.full) return null;
  const u = URL.createObjectURL(r.full); IMG.urls[id] = u; return u;
}
function hydrate(){
  document.querySelectorAll('img[data-full]').forEach(el => {
    const id = el.dataset.full; if (el.dataset.done === id) return;
    const m = imgMeta(id); if (m && !el.getAttribute('src')) el.src = m.thumb;
    fullURL(id).then(u => { if (u && el.isConnected) { el.src = u; el.dataset.done = id; } }).catch(() => {});
  });
}
function figMarksOf(sid){ return IMG.meta.filter(m => m.sid === sid && (m.marks || []).length); }
function figMastery(sid){
  const p = SS(sid).figp; let n = 0, ok = 0;
  figMarksOf(sid).forEach(m => (m.marks || []).forEach(k => { n++; const r = p[m.id] && p[m.id][k.n]; if (r && r.streak >= 2) ok++; }));
  return { n, ok };
}

/* ───────── 아이콘 ───────── */
const SVG = (d, w) => '<svg viewBox="0 0 24 24" width="' + (w || 22) + '" height="' + (w || 22) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const ICON = {
  back: SVG('<path d="M15 5l-7 7 7 7"/>'),
  close: SVG('<path d="M6 6l12 12M18 6L6 18"/>'),
  chev: SVG('<path d="M9 6l6 6-6 6"/>', 18),
  down: SVG('<path d="M6 9l6 6 6-6"/>', 18),
  search: SVG('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>', 20),
  speak: SVG('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>', 20),
  edit: SVG('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>', 20),
  flag: SVG('<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>', 20),
  book: SVG('<path d="M4 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H4z"/><path d="M20 5h-6a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h6z"/>', 18),
  camera: SVG('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 20),
  image: SVG('<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M20 16l-5-5-8 8"/>', 20),
  share: SVG('<path d="M12 15V4M8 8l4-4 4 4"/><path d="M5 12v7h14v-7"/>', 20),
  save: SVG('<path d="M12 4v11M8 11l4 4 4-4"/><path d="M5 19h14"/>', 20),
  pdf: SVG('<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h4"/>', 20),
  rotL: SVG('<path d="M4 9a8 8 0 1 1 1.6 6"/><path d="M4 4v5h5"/>', 20),
  rotR: SVG('<path d="M20 9a8 8 0 1 0-1.6 6"/><path d="M20 4v5h-5"/>', 20),
  up: SVG('<path d="M6 15l6-6 6 6"/>', 18),
  trash: SVG('<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>', 20),
  home: SVG('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>'),
  pin: SVG('<circle cx="12" cy="10" r="3"/><path d="M12 21s-7-6.5-7-11a7 7 0 0 1 14 0c0 4.5-7 11-7 11z"/>', 20)
};
const ECG = '<svg class="ecg" viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" points="0,27 46,27 54,27 60,20 66,27 80,27 86,5 93,37 99,27 114,27 123,21 132,27 200,27"/></svg>';

/* ───────── 화면 이동 ───────── */
const FULL = new Set(['session', 'quiz', 'imgedit', 'imgmark', 'imgmask', 'imgprac', 'acro']);
const NORESTORE = new Set(['imgedit', 'imgmark', 'imgmask', 'imgprac', 'acro', 'listen']);
const ROOTOK = new Set(['settings', 'backup']);
function cur(){ return R.stack[R.stack.length - 1] || null; }
let guard = false;
function armGuard(){ if (guard) return; try { history.pushState({ g: 1 }, ''); guard = true; } catch (e) {} }
function enterSubject(sid, tab){
  X = SUB[sid]; R.sid = sid; S.cur = sid; SS().lastUse = Date.now(); applyLocal(X);
  R.tab = tab || 'study'; R.stack = []; R.t = {}; R.lv = {}; R.sheet = null; R.pdf = null; R.sheetCache = null; R.update = null;
  ensureKnown(); armGuard();
}
function leaveSubject(){ R.sid = null; X = null; R.stack = []; R.t = {}; R.sheet = null; R.pdf = null; }
function onLeave(top){
  if (!top) return;
  if (top.name === 'session') pauseSession();
  if (top.name === 'quiz') pauseQuiz();
  if (top.name === 'listen') stopListen();
  if (top.name === 'imgedit') clearEditor();
  R.t.peek = null; R.t.confirm = null;
}
function go(name, p){ R.stack.push({ name, p: p || {} }); armGuard(); render(true); }
function back(){
  if (R.sheet) { R.sheet = null; renderSheet(); persistRoute(); return; }
  if (R.stack.length) { onLeave(R.stack.pop()); render(true); return; }
  if (R.sid) { leaveSubject(); render(true); }
}
window.addEventListener('popstate', () => {
  guard = false;
  if (R.sheet || R.stack.length || R.sid) { back(); }
  if (R.sid || R.stack.length) armGuard();
});
function persistRoute(){
  S.route = { sid: R.sid, tab: R.tab, stack: R.stack.filter(x => !NORESTORE.has(x.name)).map(x => ({ name: x.name, p: x.p })) };
  save();
}
function restoreRoute(){
  const r = S.route;
  if (!r) return;
  if (!r.sid || !SUB[r.sid]) { R.stack = (r.stack || []).filter(x => ROOTOK.has(x.name)); if (R.stack.length) armGuard(); return; }
  enterSubject(r.sid, r.tab || 'study');
  R.stack = (r.stack || []).filter(x => V[x.name] && !NORESTORE.has(x.name)).filter(x => {
    if (x.name === 'session') return !!SS().ses;
    if (x.name === 'quiz') return !!SS().qz;
    if (x.name === 'gconfirm') return !!S.gdraft;
    return true;
  });
}

/* ───────── 공통 조각 ───────── */
function subjTop(){
  return '<header class="top"><button class="icon-btn" data-act="back" aria-label="이전 화면 (과목 선택)">' + ICON.back + '</button>' +
    '<button class="subj-pick" data-act="subjects" aria-label="과목 바꾸기"><b>' + esc(X.title) + '</b>' + ICON.down + '</button>' +
    '<button class="icon-btn" data-act="go" data-arg="search:" aria-label="검색">' + ICON.search + '</button></header>';
}
function subBar(title, right){
  return '<header class="top sub"><button class="backbtn" data-act="back" aria-label="이전 화면">' + ICON.back + '<span>이전</span></button><h2>' + esc(title) + '</h2><div class="r">' + (right || '') + '</div></header>';
}
const HOME_BTN = '<button class="icon-btn home-btn" data-act="home" aria-label="공부 홈으로" title="공부 홈으로">' + ICON.home + '</button>';
function fullBar(inner, act, noHome){
  return '<header class="ses-top"><button class="backbtn" data-act="' + (act || 'back') + '" aria-label="이전 화면">' + ICON.back + '<span>이전 화면</span></button>' + inner + (noHome || !R.sid ? '' : HOME_BTN) + '</header>';
}
function lrow(act, arg, title, meta, opt){
  opt = opt || {};
  return '<button class="lrow' + (opt.hl ? ' hl' : '') + '" data-act="' + act + '" data-arg="' + esc(arg) + '"' + (opt.dis ? ' disabled' : '') + '><span><b>' + esc(title) + (opt.tag || '') + '</b>' + (meta ? '<span class="meta">' + esc(meta) + '</span>' : '') + '</span>' + (opt.right || '') + ICON.chev + '</button>';
}
/* 중요도(★)와 추가 표시 */
const PR_LABEL = { 3: '자주 출제', 2: '중요', 1: '기본' };
const ADD_TAG = '<span class="addc">추가</span>';
const MINE_TAG = '<span class="addc mine">내 개념</span>';
function cTags(c){ return (c.add ? ADD_TAG : '') + (c.mine ? MINE_TAG : '') + (SS().edits[c.id] && !c.mine ? '<span class="addc ed">고침</span>' : ''); }
function starsHTML(n){ n = n || 2; return '★'.repeat(n) + (n < 3 ? '<i>' + '★'.repeat(3 - n) + '</i>' : ''); }
function prMark(c){ return '<span class="prs p' + c.pr + '" title="' + PR_LABEL[c.pr] + '" aria-label="중요도 별 ' + c.pr + '개, ' + PR_LABEL[c.pr] + '">' + starsHTML(c.pr) + '</span>'; }
function prChip(c){ return '<span class="chip c-pr p' + c.pr + '">' + starsHTML(c.pr) + ' ' + PR_LABEL[c.pr] + '</span>'; }
function sumHTML(c){ return '<ul class="sum">' + (c.sum || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>'; }
function mnHTML(m, opt){
  opt = opt || {};
  let h = '<div class="memo' + (m.mine ? ' mine' : '') + '">' + (m.k ? '<span class="memo-k">' + esc(m.k) + '</span>' : '') + '<span class="memo-s">' + bold(m.s) + '</span>';
  if (opt.map !== false && m.map && m.map.length) h += '<span class="memo-map">' + m.map.map(p => '<span><b>' + esc(p[0]) + '</b>' + esc(p[1]) + '</span>').join('') + '</span>';
  return h + '</div>';
}
function memoHTML(list, big, opt){
  if (!list || !list.length) return '';
  return '<div class="memos' + (big ? ' big' : '') + '">' + list.map(m => mnHTML(m, opt)).join('') + '</div>';
}
function mnBlock(c, o){
  const list = mnList(c); const s = SS();
  if (!list.length && !o.learn) return '';
  if (!o.learn) return memoHTML(list, false);
  const main = list[0], rest = list.slice(1);
  let h = '<div class="mn-main"><div class="eyebrow">외우는 요령</div>' + (main ? memoHTML([main], true) : '');
  if (main && !main.mine) h += '<div class="rate"><span>이 암기법, 도움이 되나요?</span><button class="chip-btn' + (main.up ? ' on' : '') + '" data-act="mnrate" data-arg="' + c.id + ':' + main.idx + ':up">도움 돼요</button><button class="chip-btn" data-act="mnrate" data-arg="' + c.id + ':' + main.idx + ':down">별로예요</button></div>';
  if (R.t.mnMine === c.id) {
    h += '<div class="mine-ed"><label class="lbl" for="mine-in">내 암기법<span>직접 만든 암기법이 가장 오래 남아요. **굵게** 쓰면 강조돼요</span></label><textarea id="mine-in" rows="2" placeholder="예: 기흉은 밀고, 무기폐는 당긴다">' + esc(s.mine[c.id] || '') + '</textarea>' +
      '<div class="row-btns"><button class="btn primary" data-act="mnsave" data-arg="' + c.id + '">저장</button>' + (s.mine[c.id] ? '<button class="btn" data-act="mndel" data-arg="' + c.id + '">지우기</button>' : '') + '<button class="btn" data-act="mncancel">닫기</button></div></div>';
  } else h += '<button class="btn ghost sm" data-act="mnmine" data-arg="' + c.id + '">' + ICON.edit + (s.mine[c.id] ? '내 암기법 고치기' : '내 암기법 만들기') + '</button>';
  h += '</div>';
  if (rest.length) h += '<details class="why"><summary>다른 암기법 ' + rest.length + '개</summary>' + memoHTML(rest, false) + '</details>';
  return h;
}
function figStrip(c){
  const imgs = imgsOf(X.id, c.id); if (!imgs.length) return '';
  return '<div class="figstrip">' + imgs.map(m => '<button class="fthumb" data-act="go" data-arg="imgview:' + m.id + '" aria-label="내 그림 보기"><img src="' + m.thumb + '" alt="">' + ((m.marks || []).length ? '<i>' + m.marks.length + '</i>' : '') + '</button>').join('') + '</div>';
}
function conceptHTML(c, lv, o){
  o = o || {};
  const u = X.umap[c.u], st = status(c.id), s = SS();
  const seg = o.inSession ? '' : '<div class="lvseg" role="tablist" aria-label="보기 단계">' + LV_LABEL.map((t, i) => '<button role="tab" aria-selected="' + (i === lv) + '" data-act="lv" data-arg="' + c.id + ':' + i + '">' + t + '</button>').join('') + '</div>';
  let body;
  if (lv === 0) {
    body = '<div class="ex">' + paras(c.ex) + '</div>' +
      (c.why ? '<details class="why"><summary>왜 그럴까?</summary><p>' + esc(c.why) + '</p></details>' : '') +
      mnBlock(c, { learn: o.learn }) + (c.note ? '<p class="c-note">' + esc(c.note) + '</p>' : '');
  } else if (lv === 1) body = sumHTML(c) + (c.note && c.edited ? '<p class="c-note">' + esc(c.note) + '</p>' : '');
  else if (lv === 2) body = memoHTML(mnList(c), true);
  else body = R.t.peek === c.id ? sumHTML(c) + memoHTML(mnList(c))
    : '<button class="recall" data-act="peek" data-arg="' + c.id + '"><span>' + esc(c.t) + '</span><em>핵심을 먼저 떠올려 보세요. 떠올린 다음 탭해서 확인</em></button>';
  const tapAttr = (!o.inSession && lv < 2) ? ' data-act="lvtap" data-arg="' + c.id + ':' + lv + '"' : '';
  const hint = o.inSession ? '' : (lv === 0 ? '본문을 탭하면 요약만 보여요' : lv === 1 ? '본문을 탭하면 다시 설명이 보여요' : '');
  return '<article class="concept paper">' +
    '<header class="c-head"><div class="c-eyebrow mono">' + u.n + '-' + c.n + ' · ' + esc(u.title) + '</div>' +
    '<h2 class="c-title">' + esc(c.t) + '</h2>' +
    '<div class="c-chips"><span class="chip st-' + st + '">' + ST_LABEL[st] + '</span>' + prChip(c) + (isAdd(c) ? '<span class="chip c-add">추가</span>' : '') + (c.mine ? '<span class="chip c-mine">내가 추가</span>' : '') + (c.edited || (SS().edits[c.id] && !c.mine) ? '<span class="chip c-edit">내가 수정함</span>' : '') + (!inRange(c) ? '<span class="chip c-out">' + MODES[modeOf()].name + ' 범위 밖</span>' : '') + (s.flags[c.id] ? '<span class="chip c-flag">확인 필요</span>' : '') + '</div>' +
    '<div class="c-tools"><button class="tool" data-act="speak" data-arg="' + c.id + ':' + lv + '" aria-label="읽어주기" title="읽어주기">' + ICON.speak + '</button>' +
    '<button class="tool" data-act="go" data-arg="edit:' + c.id + '" aria-label="내용 수정" title="수정">' + ICON.edit + '</button>' +
    '<button class="tool' + (s.flags[c.id] ? ' on' : '') + '" data-act="flag" data-arg="' + c.id + '" aria-label="확인 필요 표시" title="확인 필요">' + ICON.flag + '</button></div></header>' +
    seg + '<div class="c-body"' + tapAttr + '>' + body + '</div>' + figStrip(c) + (hint ? '<p class="taphint">' + hint + '</p>' : '') + '</article>';
}

/* ───────── 문제 카드 ───────── */
function qHead(q){
  const ch = [];
  if (q.gc) ch.push('<span class="chip c-gc">실제 기출 · ' + esc(q.setTitle) + ' ' + q.no + '번</span>');
  else if (q.src === 'custom') ch.push('<span class="chip c-src">' + esc(q.s || '내가 넣은 문제') + '</span>');
  if (q.type === 'ox') ch.push('<span class="chip c-lv">O / X</span>');
  else if (!q.gc && q.src !== 'custom') ch.push('<span class="chip c-lv' + (q.lv === 2 ? ' lv2' : '') + '">' + (q.lv === 2 ? '국시 수준' : '기본') + '</span>');
  if (q.tag && !q.gc) ch.push('<span class="chip c-case">' + esc(q.tag) + '</span>');
  else if (q.case && !q.tag) ch.push('<span class="chip c-case">사례형</span>');
  if (isAdd(q) && !q.gc) ch.push('<span class="chip c-add">추가</span>');
  if (q.edited) ch.push('<span class="chip c-edit">내가 고친 문제</span>');
  return ch.length ? '<div class="qchips">' + ch.join('') + '</div>' : '';
}
const emphQ = t => esc(t).replace(/(옳지 않은 것|적절하지 않은 것|해당하지 않는 것|해당되지 않는 것|아닌 것|틀린 것|가장 먼저|가장 우선)/g, '<u>$1</u>');
function needHTML(l){
  const c = cOf(l[0], l[1]); if (!c) return '';
  const m = mnList(c, l[0])[0];
  return '<div class="need-c"><b>' + esc(c.t) + (l[0] !== (X && X.id) ? ' <small>' + esc(SUB[l[0]].title) + '</small>' : '') + '</b>' + sumHTML(c) + (m ? memoHTML([m], false, { map: false }) : '') + '</div>';
}
function qHTML(q, st, ns){
  st = st || {};
  const isOX = q.type === 'ox'; const perm = st.perm || q.o.map((_, i) => i);
  const shown = !!st.shown && ns !== 'mk';
  const cls = oi => shown ? (oi === q.a ? 'right' : (oi === st.pick ? 'wrong' : '')) : (st.pick === oi ? 'picked' : '');
  let h = '<article class="qcard">' + qHead(q) + '<p class="qtext">' + emphQ(q.q) + '</p>';
  if (q.img) h += '<img class="qimg" data-full="' + esc(q.img) + '" alt="문제 그림">';
  h += '<div class="' + (isOX ? 'ox' : 'opts') + '">' + perm.map((oi, d) => '<button class="opt ' + cls(oi) + '" data-act="pick" data-arg="' + ns + ':' + oi + '"' + (shown ? ' disabled' : '') + ' aria-pressed="' + (st.pick === oi) + '">' +
    (isOX ? '<span class="ox-mark">' + q.o[oi] + '</span>' : '<span class="on">' + CIRC[d] + '</span><span>' + esc(q.o[oi]) + '</span>') + '</button>').join('') + '</div>';
  const lk = lkOf(q);
  if (!shown && ns !== 'mk' && ns !== 'rv' && lk.length) {
    h += st.hint ? '<div class="need"><div class="need-h">필요한 내용 <span>힌트를 봤으니 이 문제는 나중에 한 번 더 나와요</span></div>' + lk.map(needHTML).join('') + '</div>'
      : '<button class="btn ghost need-btn" data-act="hint" data-arg="' + ns + '">' + ICON.book + '필요한 내용 보기</button>';
  }
  if (shown) h += fbHTML(q, st, ns, perm);
  return h + '</article>';
}
function fbHTML(q, st, ns, perm){
  const ok = st.pick === q.a; const isOX = q.type === 'ox'; const dA = perm.indexOf(q.a);
  let h = '<div class="fb ' + (ok ? 'ok' : 'ng') + '"><b>' + (ok ? (st.hint ? '맞았어요 · 힌트를 봐서 한 번 더 나와요' : '맞았어요') : (st.pick == null ? '풀지 않은 문제' : '틀렸어요 · 다음에 다시 나와요')) + '</b>' +
    (!ok ? '<span>정답 ' + (isOX ? q.o[q.a] : CIRC[dA] + ' ' + esc(q.o[q.a])) + '</span>' : '') + '</div>';
  if (ns !== 'rv' && ns !== 'mk') {
    if (ok && !st.hint) h += '<div class="reasons conf"><span>얼마나 확실했나요?</span><button class="chip-btn' + (st.conf === 'sure' ? ' on' : '') + '" data-act="conf" data-arg="' + ns + ':sure">확실해요</button><button class="chip-btn' + (st.conf === 'unsure' ? ' on' : '') + '" data-act="conf" data-arg="' + ns + ':unsure">애매했어요</button>' + (st.conf === 'unsure' ? '<em>나중에 한 번 더 나와요</em>' : '') + '</div>';
    else if (!ok && st.pick != null) {
      const lk = lkOf(q);
      if (lk.length > 1) h += '<div class="reasons"><span>어느 내용이 헷갈렸나요?</span>' + lk.map(l => { const k = l[0] + '|' + l[1]; const c = cOf(l[0], l[1]); return c ? '<button class="chip-btn' + ((st.cs || []).includes(k) ? ' on' : '') + '" data-act="cpick" data-arg="' + ns + ':' + esc(k) + '">' + esc(c.t) + '</button>' : ''; }).join('') + '<em>고른 개념만 다시 복습해요. 안 고르면 모두</em></div>';
      h += '<div class="reasons"><span>틀린 이유</span>' + ['몰랐음', '헷갈림', '잘못 읽음', '실수'].map(r => '<button class="chip-btn' + (st.reason === r ? ' on' : '') + '" data-act="reason" data-arg="' + ns + ':' + r + '">' + r + '</button>').join('') + '</div>';
    }
  }
  return h + explainHTML(q, perm);
}
function explainHTML(q, perm){
  const lk = lkOf(q);
  let h = '<section class="expl"><h4>문제 해석</h4>';
  if (q.k) h += '<p class="erow"><b>묻는 것</b><span>' + esc(q.k) + '</span></p>';
  if (q.e) h += '<p class="erow"><b>정답 이유</b><span>' + esc(q.e) + '</span></p>';
  if (q.x && q.type !== 'ox') h += '<div class="erow"><b>보기 해설</b><ul class="ex-opts">' + perm.map((oi, d) => '<li class="' + (oi === q.a ? 'is-a' : '') + '"><span class="on">' + CIRC[d] + '</span><span>' + (oi === q.a ? '정답' : esc(q.x[oi] || '')) + '</span></li>').join('') + '</ul></div>';
  if (q.gc) {
    h += (lk.length ? '<p class="hint">공식 해설이 없어서 연결된 개념의 요약을 보여 줘요.</p>' + lk.map(needHTML).join('') : '<p class="hint">아직 연결된 개념이 없어요. 기출 화면의 ‘연결 다시 확인’에서 연결할 수 있어요.</p>') +
      '<label class="lbl" for="my-' + q.id + '">내 해설<span>왜 이게 답인지 내 말로 써 보면 오래 남아요</span></label><textarea id="my-' + q.id + '" rows="3">' + esc(q.my) + '</textarea>' +
      '<div class="row-btns"><button class="btn" data-act="gmy" data-arg="' + q.id + '">내 해설 저장</button><button class="btn" data-act="gcopy" data-arg="' + q.id + '">해설 질문 복사</button>' +
      (!q.img ? '<label class="btn"><input type="file" accept="image/*" data-pick="g:' + q.id + '" hidden>' + ICON.image + '문제 그림 붙이기</label>' : '') + '</div>' +
      '<p class="hint">‘해설 질문 복사’를 누르고 Claude에 붙여넣으면 자세한 해설을 받을 수 있어요.</p>';
  }
  if (lk.length) h += '<div class="rel-c"><span>관련 개념</span>' + lk.map(l => { const c = cOf(l[0], l[1]); return c ? '<button class="chip-btn" data-act="csheet" data-arg="' + esc(l[0] + '|' + l[1]) + '">' + esc(c.t) + '</button>' : ''; }).join('') + '</div>';
  if (!q.gc && q.src !== 'custom' && !q.mine && X && X.qmap[q.id]) h += '<div class="qfix"><button class="btn ghost sm" data-act="go" data-arg="qedit:' + q.id + '">' + ICON.edit + (q.edited ? '내가 고친 문제 · 다시 고치기' : '문제가 이상해요? 고치기 · 빼기') + '</button></div>';
  return h + '</section>';
}

/* ───────── 아래에서 올라오는 패널 ───────── */
const SHEETV = {};
SHEETV.concept = sh => {
  const c = cOf(sh.sid, sh.cid); if (!c) return '<p class="empty">개념을 찾을 수 없어요.</p>';
  const x = SUB[sh.sid]; const u = x.umap[c.u]; const own = X && sh.sid === X.id;
  const imgs = imgsOf(sh.sid, sh.cid);
  return '<div class="sh-head"><div><div class="eyebrow mono">' + u.n + '-' + c.n + ' · ' + esc(u.title) + '</div><h3>' + esc(c.t) + '</h3></div><button class="icon-btn" data-act="shclose" aria-label="닫기">' + ICON.close + '</button></div>' +
    '<div class="sh-body">' + sumHTML(c) + memoHTML(mnList(c, sh.sid)) +
    (sh.full ? '<div class="ex sh-ex">' + paras(c.ex) + '</div>' + (c.why ? '<p class="why-p"><b>왜 그럴까?</b> ' + esc(c.why) + '</p>' : '') + (c.note ? '<p class="c-note">' + esc(c.note) + '</p>' : '') : '') +
    (imgs.length ? '<div class="figstrip">' + imgs.map(m => '<button class="fthumb" data-act="shimg" data-arg="' + m.id + '"><img src="' + m.thumb + '" alt=""></button>').join('') + '</div>' : '') +
    '<div class="row-btns"><button class="btn primary" data-act="shfull">' + (sh.full ? '요약만 보기' : '전체 설명 보기') + '</button>' +
    (own ? '<button class="btn" data-act="shopen" data-arg="' + c.id + '">개념 카드 열기</button>' : '') + '</div></div>';
};
function openSheet(sh){ R.sheet = sh; armGuard(); renderSheet(); }
function renderSheet(){
  const el = $('#sheet'); if (!el) return;
  if (!R.sheet || !SHEETV[R.sheet.type]) { el.hidden = true; el.innerHTML = ''; document.body.classList.remove('sheet-open'); return; }
  el.hidden = false; document.body.classList.add('sheet-open');
  el.innerHTML = '<div class="sh-back" data-act="shclose"></div><div class="sh-panel" role="dialog" aria-modal="true" aria-label="자세히 보기">' + SHEETV[R.sheet.type](R.sheet) + '</div>';
  hydrate();
}

/* ───────── 첫 화면: 과목 ───────── */
function backupMeta(){ return S.lastBackup ? '마지막 백업 ' + new Date(S.lastBackup).toLocaleDateString('ko-KR') : '아직 백업하지 않았어요'; }
function termLabel(k){ const m = /^(\d)\s*-\s*(\d)$/.exec(k || ''); return m ? m[1] + '학년 ' + m[2] + '학기' : (k || '과목'); }
/* 첫 화면 요약: 불러온 과목은 새로 계산, 아직 안 불러온 과목은 지난번 값 */
function subjSum(sid){
  if (SUB[sid]) { const st = statsFor(sid); S.sums[sid] = { T: st.T, L: st.L, prog: st.prog, knownP: st.knownP, acc: st.acc, allT: st.allT, allProg: st.allProg, nAdd: st.nAdd, units: SUB[sid].units.length }; }
  return S.sums[sid] || null;
}
function modeSeg(sid, m){
  return '<div class="seg sm mode-seg" role="group" aria-label="공부 모드">' + ['cram', 'core', 'all'].map(k => '<button data-act="smode" data-arg="' + sid + ':' + k + '" aria-pressed="' + (m === k) + '"><b>' + MODES[k].name + '</b><small>' + (k === 'all' ? '모두' : MODES[k].range) + '</small></button>').join('') + '</div>';
}
function addSeg(sid){
  const off = addOff(sid);
  return '<div class="seg sm" role="group" aria-label="추가 내용"><button data-act="sadd" data-arg="' + sid + ':1" aria-pressed="' + !off + '">같이 공부</button><button data-act="sadd" data-arg="' + sid + ':0" aria-pressed="' + off + '">빼고 공부</button></div>';
}
function subjCard(it){
  const sid = it.id, sm = subjSum(sid), s = S.subj[sid], ses = s && s.ses, m = modeOf(sid);
  const title = (SUB[sid] && SUB[sid].title) || it.title || sid;
  const meta = [it.kind || ''].concat(sm ? [sm.units + '단원', '개념 ' + sm.allT + '개'] : ['처음 들어갈 때 내용을 내려받아요']).filter(Boolean).join(' · ');
  const rl = m === 'all' ? '진도' : MODES[m].range + ' 진도';
  return '<article class="subj-card"><button class="subj-main" data-act="enter" data-arg="' + sid + '">' +
    '<span class="subj-t">' + esc(title) + (m !== 'all' ? '<span class="chip c-mode m-' + m + '">' + MODES[m].name + '</span>' : '') + '</span><span class="subj-m">' + esc(meta) + '</span>' +
    (sm ? '<span class="subj-stats"><span><b class="mono">' + sm.prog + '<small>%</small></b><i>' + rl + '</i></span>' + (m !== 'all' ? '<span><b class="mono">' + sm.allProg + '<small>%</small></b><i>전체 진도</i></span>' : '') + '<span><b class="mono">' + (sm.acc == null ? '–' : sm.acc + '<small>%</small>') + '</b><i>정답률</i></span></span>' +
      '<span class="meter" aria-hidden="true"><i style="width:' + sm.prog + '%"></i><i class="m2" style="width:' + sm.knownP + '%"></i></span>' : '') + '</button>' +
    '<div class="subj-opts"><div class="so-row"><span class="lab">공부 모드</span>' + modeSeg(sid, m) + '</div>' +
    (sm && sm.nAdd ? '<div class="so-row"><span class="lab">추가 내용 ' + sm.nAdd + '개</span>' + addSeg(sid) + '</div>' : '') + '</div>' +
    '<button class="btn primary subj-go" data-act="enterGo" data-arg="' + sid + '">' + (ses ? '이어서 공부' : sm && sm.L ? '이어서 공부' : '공부 시작') + '</button></article>';
}
function vSubjects(){
  const list = (window.NSA_LIST || []).filter(it => it && it.id); const hide = S.set.hideSubj || {}; const picking = !!R.t.subjPick;
  let h = '<header class="top home-top"><div class="brand"><b>청진노트</b><span>간호학 시험공부</span></div></header><section class="stack">' +
    '<div><h1>어떤 과목을 공부할까요?</h1><p class="sub">과목마다 공부 모드를 고를 수 있어요. 시험이 코앞이면 <b>당일치기</b>(★★★만), 1~2주 남았으면 <b>핵심</b>(★★ 이상), 여유가 있으면 <b>전체</b>. 하던 곳은 자동으로 저장돼요.</p></div>';
  if (!list.length) h += '<p class="empty">과목 목록이 비어 있어요. subjects/list.js를 확인해 주세요.</p>';
  if (picking) {
    h += '<div class="notice"><b>내가 듣는 과목 고르기</b><p>체크를 끈 과목은 첫 화면에서 숨겨요. 기록은 그대로 남아요.</p></div><div class="list">' +
      list.map(it => '<button class="lrow pick-row" data-act="subjhide" data-arg="' + it.id + '"><span class="tck' + (hide[it.id] ? '' : ' on') + '" aria-hidden="true">' + (hide[it.id] ? '' : '✓') + '</span><span><b>' + esc(it.title || it.id) + '</b><span class="meta">' + esc([termLabel(it.term), it.kind].filter(Boolean).join(' · ')) + '</span></span></button>').join('') +
      '</div><button class="btn primary big" data-act="subjpick">다 골랐어요</button>';
  } else {
    const vis = list.filter(it => !hide[it.id]);
    if (list.length && !vis.length) h += '<p class="empty">보이는 과목이 없어요. 아래 ‘과목 고르기’에서 켜 주세요.</p>';
    const groups = [], gm = {};
    vis.forEach(it => { const k = it.term || ''; if (!gm[k]) { gm[k] = { k, items: [] }; groups.push(gm[k]); } gm[k].items.push(it); });
    groups.forEach(g => {
      g.items.sort((a, b) => ((S.subj[b.id] || {}).lastUse || 0) - ((S.subj[a.id] || {}).lastUse || 0));
      h += (groups.length > 1 || g.k ? '<h3 class="h3 term-h">' + esc(termLabel(g.k)) + ' <span>' + g.items.length + '과목</span></h3>' : '') + g.items.map(subjCard).join('');
    });
  }
  if (LOADERR.length) h += '<div class="notice"><b>일부 과목 파일을 불러오지 못했어요</b><p>' + LOADERR.map(esc).join(', ') + '</p><p>다른 과목은 그대로 쓸 수 있어요.</p></div>';
  h += '<div class="list">' + (picking ? '' : lrow('subjpick', '', '과목 고르기', '내가 듣는 과목만 첫 화면에 보이기' + (Object.keys(hide).filter(k => hide[k]).length ? ' · 숨긴 과목 ' + Object.keys(hide).filter(k => hide[k]).length + '개' : ''))) +
    lrow('go', 'settings:', '설정', '글자 크기 · 화면 · 그림 안내') + lrow('go', 'backup:', '기록 백업 · 불러오기', backupMeta(), { hl: !S.lastBackup || Date.now() - S.lastBackup > 7 * DAY }) + '</div>' +
    '<p class="note">과목은 계속 추가할 수 있어요. 학습 기록은 이 기기에만 저장되니 일주일에 한 번 백업하세요.</p></section>';
  return h;
}

/* ───────── 공부 탭 ───────── */
function newCount(due){ return cramOn() ? (due > 8 ? 2 : 4) : (due > 6 ? 1 : due > 2 ? 2 : 3); }
function chunkPreview(){
  const now = Date.now(); const due = dueList(now).length; const rev = Math.min(due, cramOn() ? 5 : 6);
  const left = nextNew(9999).length;
  const nNew = Math.min(left, newCount(due));
  const pool = Math.min(2, reviewPool().filter(q => (qrec(q).last || 0) < sod(now)).length);
  const q = pool + (nNew ? nNew + 2 : (rev ? 2 : 0));
  return { rev, nNew, q, pool, min: Math.max(3, Math.round(rev * 0.5 + nNew * 1.5 + q * 0.4)) };
}
function whenTxt(t){ const now = Date.now(); return (sod(t) > sod(now) ? (sod(t) - sod(now) === DAY ? '내일 ' : new Date(t).getDate() + '일 ') : '') + hhmm(t); }
function cramBox(st){
  const now = Date.now(); const cs = CS(); const newLeft = cs.filter(c => !isLearned(c.id)).length; const due = dueList(now).length; const pend = pendingSame(now);
  const done = cs.filter(c => { const r = crec(c.id); return r && r.learned && cramDue(r) >= DONE; }).length;
  const mins = Math.max(5, Math.ceil((newLeft * 2 + due * 0.5 + pend.length * 0.5) / 5) * 5);
  const tx = newLeft || due ? '끝까지 약 ' + mins + '분 (새 개념 1개에 2분쯤)' : pend.length ? '다음 몰아 복습 ' + pend.length + '개는 ' + whenTxt(cramDue(crec(pend[0].id))) + '부터' : '★★★ 몰아 복습을 모두 끝냈어요. 시험 잘 봐요!';
  return '<div class="cram-box"><div class="cb-h"><b>당일치기</b><span>★★★ ' + cs.length + '개 · 배운 직후 → 10분 → 1시간 → 3시간 → 다음 날 아침</span></div>' +
    '<div class="cb-n"><span><b class="mono">' + newLeft + '</b>안 본 개념</span><span><b class="mono">' + due + '</b>지금 복습</span><span><b class="mono">' + pend.length + '</b>이따 복습</span><span><b class="mono">' + done + '</b>다 외움</span></div>' +
    '<p class="cb-t">' + esc(tx) + '</p>' +
    '<div class="row-btns"><button class="btn sm" data-act="rangenote">★★★ 요약지 보기</button><button class="btn sm" data-act="quiz" data-arg="range:">★★★ 문제 테스트</button></div></div>';
}
function modeBox(st){
  const m = modeOf(), sid = X.id;
  let h = '<div class="mode-box"><div class="so-row"><span class="lab">공부 모드</span>' + modeSeg(sid, m) + '</div>' +
    '<p class="mb-d">' + esc(MODES[m].desc) + (m !== 'all' ? ' · 개념 ' + st.T + '개 (전체 ' + st.allT + '개 중)' : '') + '</p>';
  if (st.nAdd) h += '<div class="so-row"><span class="lab">추가 내용 ' + st.nAdd + '개</span>' + addSeg(sid) + '</div>';
  if (m === 'all') { const od = S.set.order === 'pr' ? 'pr' : 'toc'; h += '<div class="so-row"><span class="lab">새 개념 순서</span><div class="seg sm" role="group" aria-label="새 개념 순서"><button data-act="order" data-arg="toc" aria-pressed="' + (od === 'toc') + '">목차 순</button><button data-act="order" data-arg="pr" aria-pressed="' + (od === 'pr') + '">중요한 것 먼저</button></div></div>'; }
  return h + '</div>';
}
function updateNotice(){
  const u = R.update; if (!u) return '';
  const parts = []; if (u.c) parts.push('개념 ' + u.c + '개'); if (u.q) parts.push('문제 ' + u.q + '개');
  return '<div class="notice good"><b>새 내용이 추가됐어요</b><p>' + (parts.length ? parts.join(', ') + '가 새로 들어왔어요. 새 개념은 공부 순서에 맞춰 차례로 나오고, <b>추가</b> 표시가 붙어 있어요. 목차에서 ‘추가된 내용’만 골라 공부할 수도 있어요. ' : '') +
    (u.re ? '내용이 바뀐 개념 ' + u.re + '개는 다시 복습에 넣었어요. ' : '') + '지금까지의 기록은 그대로예요.</p><div class="row-btns"><button class="btn" data-act="updok">확인</button></div></div>';
}
function heroHTML(st){
  const d = st.delta;
  const dTxt = d == null ? (st.att ? '푼 문제 ' + st.att + '개 기준' : '문제를 풀면 나와요') : (d === 0 ? '지난주와 같아요' : '지난주보다 <b class="' + (d > 0 ? 'up' : 'dn') + '">' + (d > 0 ? '+' : '') + d + '%p</b>');
  return '<div class="hero"><div class="hero-row">' +
    '<div class="hero-big"><span class="lab">' + (st.mode && st.mode !== 'all' ? MODES[st.mode].range + ' 진도' : '전체 진도') + '</span><b class="mono">' + st.prog + '<small>%</small></b><span class="meta">배운 개념 ' + st.L + ' / ' + st.T + (st.mode && st.mode !== 'all' ? ' · 전체 ' + st.allProg + '%' : '') + '</span></div>' +
    '<div class="hero-big"><span class="lab">문제 정답률</span><b class="mono">' + (st.acc == null ? '–' : st.acc + '<small>%</small>') + '</b><span class="meta">' + dTxt + '</span></div></div>' +
    '<span class="meter" aria-label="진도 ' + st.prog + '%, 외움 ' + st.knownP + '%"><i style="width:' + st.prog + '%"></i><i class="m2" style="width:' + st.knownP + '%"></i></span>' +
    '<div class="hero-sub"><span><i class="lg l1"></i>배움 ' + st.prog + '%</span><span><i class="lg l2"></i>외움 ' + st.knownP + '%</span><span>푼 문제 ' + st.att + ' / ' + st.qN + '</span>' + (st.gN ? '<span>기출 정답률 ' + (st.gAcc == null ? '–' : st.gAcc + '%') + '</span>' : '') + '</div></div>';
}
function vStudy(){
  const st = subjStats(), now = Date.now(), s = SS(), ses = s.ses;
  let h = subjTop() + '<section class="stack">' + updateNotice() + heroHTML(st);
  const sc = scopeIds();
  if (sc) { const L = sc.filter(isLearned).length; h += '<div class="scope-box"><div class="sb-t"><span class="lab">공부 범위</span><b>' + esc(scopeLabel(sc)) + '</b><span class="meta">개념 ' + sc.length + '개 · 배움 ' + pct(L, sc.length) + '%</span></div><div class="sb-b"><button class="btn sm" data-act="go" data-arg="toc:">바꾸기</button><button class="btn sm ghost" data-act="scopeclear">전체로</button></div></div>'; }
  if (ses && ses.steps[ses.i] && ses.steps[ses.i].t !== 'done') {
    const n = ses.steps.length - 1;
    h += '<button class="start" data-act="cont"><span class="start-k">이어서 공부하기</span><span class="start-m mono">하던 곳부터 · ' + (ses.i + 1) + ' / ' + n + '</span>' + ECG + '</button>';
  } else {
    const p = chunkPreview();
    if (p.rev || p.nNew || p.pool) {
      const parts = []; if (p.rev) parts.push('복습 ' + p.rev); if (p.nNew) parts.push('새 개념 ' + p.nNew); if (p.q) parts.push('문제 ' + p.q);
      h += '<button class="start" data-act="cont"><span class="start-k">' + (st.L ? '이어서 공부하기' : '공부 시작하기') + '</span><span class="start-m mono">' + parts.join(' · ') + ' · 약 ' + p.min + '분</span>' + ECG + '</button>';
    } else {
      const pend = pendingSame(now);
      const msg = pend.length ? (cramOn() ? '몰아 복습 ' + pend.length + '개가 ' + whenTxt(dueAt(pend[0].id)) + '부터 열려요. 그 사이에 ★★★ 문제 테스트를 풀어 보세요.' : '같은 날 2회차 복습 ' + pend.length + '개가 ' + hhmm(dueAt(pend[0].id)) + '부터 열려요. 시간을 두고 다시 보는 게 기억에 좋아요.')
        : sc ? '고른 범위의 새 개념을 모두 배웠어요. 목차에서 범위를 바꾸거나, 문제로 다져 보세요.' : modeOf() !== 'all' ? MODES[modeOf()].range + ' 개념을 모두 배웠어요. 시간이 되면 공부 모드를 넓혀 보세요.' : '모든 개념을 배웠어요. 복습 날짜가 되면 여기에 나타나요.';
      h += '<div class="start idle"><span class="start-k">지금 할 공부 끝</span><span class="start-m">' + esc(msg) + '</span></div>' +
        '<button class="btn" data-act="start" data-arg="extra">그래도 더 하기 · 연습 카드와 문제</button>';
    }
  }
  h += '<button class="btn quick" data-act="start" data-arg="quick"' + (st.L ? '' : ' disabled') + '>3분만 · 복습 카드 5장</button>';
  h += (cramOn() ? cramBox(st) : '') + modeBox(st);
  const rows = [];
  rows.push(lrow('go', 'toc:', '목차에서 골라 공부하기', '단원·개념별 진도와 정답률 · 원하는 것만, 부족한 것만 다시'));
  const pool = reviewPool().length; if (pool) rows.push(lrow('quiz', 'pool:', '다시 풀 문제 ' + pool + '개', '틀렸거나 애매했던 문제 · 2번 연속 맞히면 졸업'));
  const wk = weakTop(1); if (wk.length) rows.push(lrow('start', 'weak', '약점 공부', '가장 많이 틀린 개념: ' + X.cmap[wk[0].id].t));
  const todo = figTodoList().length; if (todo) rows.push(lrow('go', 'figtodo:', '그림 넣을 개념 ' + todo + '개', '나중에 넣기로 한 그림'));
  const L = S.log[dkey(now)];
  const mins = L ? Math.round((L.sec || 0) / 60) : 0;
  rows.push('<div class="lrow static"><span><b>오늘 ' + mins + '분 공부</b><span class="meta">카드 ' + (L ? L.cards || 0 : 0) + '장 · 문제 ' + (L ? L.qs || 0 : 0) + '개 · 새 개념 ' + (L ? L.newC || 0 : 0) + '개</span></span></div>');
  h += '<div class="list">' + rows.join('') + '</div>';
  if (!canSave) h += '<div class="notice"><b>기록이 저장되지 않는 상태예요</b><p>브라우저의 저장 공간이 꽉 찼거나 막혀 있어요. 백업을 먼저 해 두세요.</p></div>';
  return h + '</section>';
}

/* ───────── 공부 세트 (약 5분) ───────── */
function oxOf(cid){ return X.qs.find(q => q.type === 'ox' && q.c[0] === cid); }
function cardStep(cid){
  const c = C(cid); const s = crec(cid);
  const hasMap = mnList(c).some(m => m.map && m.map.length);
  if (hasMap && ((s && s.seen) || 0) % 3 === 1) return { t: 'card', cid, v: 'mn' };
  return { t: 'card', cid };
}
function figQuestion(prefer){
  const pool = figMarksOf(X.id).filter(m => X.cmap[m.cid] && isLearned(m.cid));
  if (!pool.length) return null;
  let cand = pool.filter(m => prefer.includes(m.cid));
  if (!cand.length) { if (Math.random() > 0.35) return null; cand = pool; }
  const m = cand[Math.floor(Math.random() * cand.length)];
  const p = SS().figp[m.id] || {};
  const marks = (m.marks || []).slice().sort((a, b) => ((p[a.n] || {}).streak || 0) - ((p[b.n] || {}).streak || 0));
  return { t: 'figq', img: m.id, n: marks[0].n };
}
function mixedQs(n, exclude, extra){
  const ex = new Set(extra || []);
  const ready = q => {
    if (exclude.has(q.id) || q.type !== 'mc') return false;
    if (q.gc) return q.lk.length > 0 && q.lk.every(l => (l[0] === X.id && ex.has(l[1])) || learnedAny(l[0], l[1]));
    return links(q).length > 0 && links(q).every(c => ex.has(c) || isLearned(c));
  };
  const score = q => { const r = qrec(q); if (!r) return 0; if (inPool(r)) return 1; return 2 + (r.streak || 0); };
  const pool = shuffle(allQ().concat(gcQs()).filter(ready)).sort((a, b) => score(a) - score(b));
  const pick = [];
  const fresh = pool.find(q => links(q).some(c => ex.has(c))); if (fresh) pick.push(fresh);
  const g = pool.find(q => q.gc && !pick.includes(q)); if (g && pick.length < n) pick.push(g);
  const usedU = new Set(pick.map(q => q.u));
  for (const q of pool) { if (pick.length >= n) break; if (pick.includes(q) || usedU.has(q.u)) continue; pick.push(q); usedU.add(q.u); }
  for (const q of pool) { if (pick.length >= n) break; if (!pick.includes(q)) pick.push(q); }
  return pick;
}
function buildChunk(kind, arg){
  const now = Date.now(), steps = [], s = SS();
  const qStep = (q, tag) => steps.push({ t: 'q', qid: q.id, tag: q.gc ? '실제 기출' : tag });
  if (kind === 'main') {
    const due = dueList(now);
    const rev = due.slice(0, cramOn() ? 5 : 6);
    rev.forEach(c => steps.push(cardStep(c.id)));
    const fq = figQuestion(rev.map(c => c.id)); if (fq) steps.push(fq);
    const pool = reviewPool().filter(q => (qrec(q).last || 0) < sod(now)).slice(0, 2);
    pool.forEach(q => qStep(q, '다시 풀기'));
    const news = nextNew(newCount(due.length));
    let asks = 0;
    news.forEach(c => {
      steps.push({ t: 'learn', cid: c.id });
      const ox = oxOf(c.id); if (ox) steps.push({ t: 'q', qid: ox.id, tag: '바로 확인' });
      if (c.fig && S.set.figAsk && IMG.ok && !s.figAsked[c.id] && !imgsOf(X.id, c.id).length && asks < 2) { steps.push({ t: 'figask', cid: c.id }); asks++; }
    });
    shuffle(news).forEach(c => steps.push({ t: 'card', cid: c.id, fresh: true }));
    if (news.length || rev.length) {
      const used = new Set(steps.filter(x => x.qid).map(x => x.qid));
      mixedQs(2, used, news.map(c => c.id)).forEach(q => qStep(q, '섞어 풀기'));
    }
  } else if (kind === 'quick') {
    let rev = dueList(now).slice(0, 5).map(c => ({ t: 'card', cid: c.id }));
    if (rev.length < 5) {
      const have = new Set(rev.map(x => x.cid));
      shuffle(CS().filter(c => isLearned(c.id) && !have.has(c.id))).slice(0, 5 - rev.length).forEach(c => rev.push({ t: 'card', cid: c.id, practice: true }));
    }
    rev.forEach(x => steps.push(x));
    mixedQs(1, new Set(), []).forEach(q => qStep(q, '섞어 풀기'));
  } else if (kind === 'extra') {
    shuffle(CS().filter(c => isLearned(c.id))).slice(0, 5).forEach(c => steps.push({ t: 'card', cid: c.id, practice: true }));
    const fq = figQuestion([]); if (fq) steps.push(fq);
    mixedQs(3, new Set(), []).forEach(q => qStep(q, '섞어 풀기'));
  } else if (kind === 'weak') {
    weakTop(3).forEach(w => {
      steps.push({ t: 'learn', cid: w.id, relearn: true });
      allQ().concat(gcQs()).filter(q => links(q).includes(w.id) && unlocked(q)).sort((a, b) => (inPool(qrec(b)) ? 1 : 0) - (inPool(qrec(a)) ? 1 : 0)).slice(0, 2).forEach(q => qStep(q, '약점 문제'));
      steps.push({ t: 'card', cid: w.id, fresh: true });
    });
  } else if (kind === 'pick') {
    const ids = String(arg || '').split(',').filter(id => X.cmap[id]);
    const weak = weakSet(); const acc = conceptQAcc();
    const low = id => weak.has(id) || (acc[id] && acc[id].ok / acc[id].att < 0.6);
    const now6 = ids.slice(0, 6); const rest = ids.slice(6);
    const fresh = now6.filter(id => !isLearned(id));
    now6.forEach(id => {
      if (!isLearned(id)) { steps.push({ t: 'learn', cid: id }); const ox = oxOf(id); if (ox) steps.push({ t: 'q', qid: ox.id, tag: '바로 확인' }); }
      else if (low(id)) steps.push({ t: 'learn', cid: id, relearn: true });
      else steps.push({ t: 'card', cid: id, practice: true });
    });
    shuffle(fresh).forEach(id => steps.push({ t: 'card', cid: id, fresh: true }));
    const set = new Set(now6), fset = new Set(fresh);
    const qs = shuffle(allQ().concat(gcQs()).filter(q => q.type === 'mc' && links(q).some(c => set.has(c)) && links(q).every(c => isLearned(c) || fset.has(c))))
      .sort((a, b) => (inPool(qrec(b)) ? 1 : 0) - (inPool(qrec(a)) ? 1 : 0)).slice(0, Math.min(6, Math.max(2, now6.length)));
    qs.forEach(q => qStep(q, '고른 개념 문제'));
    if (steps.length) { steps.push({ t: 'done' }); steps.rest = rest; return steps; }
    return null;
  } else if (kind === 'review') {
    dueList(now).slice(0, 30).forEach(c => steps.push(cardStep(c.id)));
  } else if (kind === 'practice') {
    const u = X.umap[arg]; const uc = UC(u).length ? UC(u) : u.concepts; let cs = uc.filter(c => isLearned(c.id)); if (!cs.length) cs = uc;
    shuffle(cs).slice(0, 12).forEach(c => steps.push({ t: 'card', cid: c.id, practice: true }));
  }
  if (!steps.length) return null;
  steps.push({ t: 'done' });
  return steps;
}
function settleCurrentStep(){
  const s = SS().ses; if (!s) return;
  const st = s.steps[s.i];
  if (st && st.t === 'q' && s.q) settleQ(Q(st.qid), s.q);
}
function prepStep(){
  const s = SS().ses; const st = s.steps[s.i]; if (!st) return;
  if (st.t === 'q' && !s.q) { const q = Q(st.qid); s.q = q ? { perm: permFor(q) } : null; }
  if (st.t === 'figask') SS().figAsked[st.cid] = Date.now();
}
function startSession(kind, arg){
  const old = SS().ses; if (old) settleCurrentStep();
  const steps = buildChunk(kind, arg);
  if (!steps) { toast(kind === 'review' ? '지금 복습할 카드가 없어요' : kind === 'weak' ? '아직 약점 기록이 없어요' : '지금 할 항목이 없어요'); return; }
  SS().ses = { kind, arg: arg || '', steps, rest: steps.rest || [], i: 0, start: Date.now(), st: { rev: 0, newc: 0, qok: 0, qn: 0, again: 0 }, rq: {}, rev: false, q: null, fq: null };
  prepStep(); logInc('ses'); R.doneSes = null;
  R.stack = R.stack.filter(x => x.name !== 'session');
  go('session');
}
function contSession(){
  const s = SS().ses;
  if (s && s.steps[s.i] && s.steps[s.i].t !== 'done') { R.doneSes = null; R.stack = R.stack.filter(x => x.name !== 'session'); go('session'); }
  else startSession('main');
}
function pauseSession(){ save(); }
function finishSession(){
  const s = SS().ses; if (!s) return;
  s.mins = Math.max(1, Math.min(90, Math.round((Date.now() - s.start) / MIN)));
  R.doneSes = s; SS().ses = null;
}
function nextStep(){
  const s = SS().ses; if (!s) return;
  settleCurrentStep();
  s.i++; s.rev = false; s.q = null; s.fq = null;
  while (s.steps[s.i] && !stepValid(s.steps[s.i])) s.i++;
  if (!s.steps[s.i]) s.steps.push({ t: 'done' });
  prepStep();
  if (s.steps[s.i].t === 'done') finishSession();
  save(); render(true);
}
function stepValid(st){
  if (st.t === 'q') return !!Q(st.qid);
  if (st.t === 'figq') { const m = imgMeta(st.img); return !!(m && (m.marks || []).some(k => k.n === st.n)); }
  if (st.cid) return !!X.cmap[st.cid];
  return true;
}
function pickCard(c, st){ const n = (c.cards || []).length; if (!n) return null; const s = crec(c.id); const k = ((s && s.seen) || 0) + (st.again ? 1 : 0); return c.cards[k % n]; }

function vSession(){
  const s = SS().ses;
  if (!s) { if (R.doneSes) return vDoneWrap(R.doneSes); return vStudy(); }
  let st = s.steps[s.i];
  if (!st || !stepValid(st) || st.t === 'done') {
    while (s.steps[s.i] && !stepValid(s.steps[s.i])) s.i++;
    if (!s.steps[s.i]) s.steps.push({ t: 'done' });
    s.q = s.q && st === s.steps[s.i] ? s.q : null; prepStep();
    st = s.steps[s.i];
    if (st.t === 'done') { finishSession(); save(); return vDoneWrap(R.doneSes); }
  }
  const n = s.steps.length - 1;
  let body;
  if (st.t === 'card') body = vCardStep(st, s);
  else if (st.t === 'learn') body = '<div class="ses-tag">' + (st.relearn ? '약점 개념 · 설명부터 다시' : '새 개념 · 읽고 이해하기') + '</div>' + conceptHTML(C(st.cid), 0, { inSession: true, learn: true }) +
    '<button class="btn primary big" data-act="learned">이해했어요 · 다음</button>';
  else if (st.t === 'q') { const q = Q(st.qid); body = '<div class="ses-tag">' + esc(st.tag || '문제') + (q.u && X.umap[q.u] ? ' · ' + X.umap[q.u].n + '단원' : '') + '</div>' + qHTML(q, s.q || {}, 'sq') + (s.q && s.q.shown ? '<button class="btn primary big" data-act="snext">다음</button>' : ''); }
  else if (st.t === 'figask') body = vFigAsk(st);
  else if (st.t === 'figq') body = vFigQ(st, s);
  else body = vDone(s);
  return '<div>' + fullBar('<div class="pbar" role="progressbar" aria-valuenow="' + pct(s.i, n) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct(s.i, n) + '%"></i></div><span class="mono ses-n">' + Math.min(s.i + 1, n) + '/' + n + '</span>', 'exit') + body + '</div>';
}
function vCardStep(st, s){
  const c = C(st.cid), u = X.umap[c.u];
  const tag = st.practice ? '연습 · 떠올리기' : st.again ? '다시 한 번' : st.fresh ? '방금 배운 것 · 바로 다시 떠올리기' : '복습 · 떠올리기';
  const mns = mnList(c); const m0 = mns.find(m => m.map && m.map.length);
  let front, back;
  if (st.v === 'mn' && m0) {
    front = '<div class="flash-front acro">' + esc(m0.k) + '</div><p class="hint">머리글자 퀴즈 · 각 글자가 무엇의 첫 글자인지 떠올려 보세요</p>';
    back = mnHTML(m0, {});
  } else {
    const card = pickCard(c, st);
    if (card) { front = '<div class="flash-front">' + esc(card[0]) + '</div>'; back = '<div class="flash-back">' + esc(card[1]) + '</div>' + (mns[0] ? memoHTML([mns[0]]) : ''); }
    else { front = '<div class="flash-front">' + esc(c.t) + '</div><p class="hint">핵심 내용을 떠올려 보세요</p>'; back = sumHTML(c) + (mns[0] ? memoHTML([mns[0]]) : ''); }
  }
  const fresh = st.fresh || st.practice;
  return '<div class="ses-tag">' + tag + '</div><article class="flash paper"><div class="flash-meta">' + u.n + '. ' + esc(u.title) + ' · ' + esc(c.t) + '</div>' + front +
    (s.rev ? back + figStrip(c) : '<div class="think" aria-hidden="true"><i></i></div><p class="hint center">답을 보기 전에 먼저 머릿속으로 떠올려 보세요</p>') + '</article>' +
    (s.rev ? '<div class="grade"><button class="g g0" data-act="grade" data-arg="0">몰랐음<small>곧 다시</small></button><button class="g g1" data-act="grade" data-arg="1">헷갈림<small>' + (fresh ? '한 번 더' : '조금 뒤 다시') + '</small></button><button class="g g2" data-act="grade" data-arg="2">알았음<small>' + (fresh ? '다음으로' : '간격 늘리기') + '</small></button></div>'
      : '<button class="btn primary big" id="reveal" data-act="reveal" disabled>답 보기 <span class="mono" id="cd">3</span></button>');
}
function vFigAsk(st){
  const c = C(st.cid); const imgs = imgsOf(X.id, c.id);
  if (imgs.length) return '<div class="ses-tag">그림으로 외우기</div><article class="flash paper"><div class="flash-meta">' + esc(c.t) + '</div><div class="flash-front">그림을 넣었어요</div>' + figStrip(c) +
    '<p class="hint">그림을 누르면 번호를 찍거나 글자를 가릴 수 있어요. 복습할 때 같이 나와요.</p></article><button class="btn primary big" data-act="snext">다음</button>';
  return '<div class="ses-tag">그림으로 외우기</div><article class="flash paper figask"><div class="flash-meta">' + esc(c.t) + '</div><div class="flash-front">이 개념은 그림을 보면 훨씬 잘 외워져요</div>' +
    '<p>교과서 그림, 구글에서 찾은 그림, 직접 찍은 사진을 넣어 두면 복습할 때 같이 나와요. 그림 위에 번호를 찍어 위치를 문제로 연습할 수도 있어요.</p>' +
    addImgButtons('c:' + X.id + ':' + c.id, (c.fig && c.fig.q) || c.t) + '</article>' +
    '<div class="row-btns"><button class="btn" data-act="figlater" data-arg="' + c.id + '">나중에 · 목록에 담기</button><button class="btn ghost" data-act="figoff">그림 안내 그만 보기</button></div>';
}
function vFigQ(st, s){
  const m = imgMeta(st.img); const mk = (m.marks || []).find(k => k.n === st.n);
  const ans = s.fq;
  const state = k => !ans ? '' : (k.n === st.n ? 'right' : (k.n === ans.pick ? 'wrong' : 'dim'));
  return '<div class="ses-tag">그림 위치 문제 · ' + esc(X.cmap[m.cid].t) + '</div><p class="qtext">' + esc(mk.name) + '은(는) 몇 번일까요?</p>' +
    figStage(m, { pickAct: ans ? null : 'fqpick', state }) +
    (ans ? '<div class="fb ' + (ans.ok ? 'ok' : 'ng') + '"><b>' + (ans.ok ? '맞았어요' : '아쉬워요 · ' + st.n + '번이에요') + '</b>' + (!ans.ok ? '<span>고른 ' + ans.pick + '번은 ' + esc(((m.marks || []).find(k => k.n === ans.pick) || {}).name || '') + '</span>' : '') + '</div><button class="btn primary big" data-act="snext">다음</button>'
      : '<p class="hint center">그림에서 번호를 눌러 답하세요</p>');
}
function vDoneWrap(s){ return '<div>' + fullBar('<div class="pbar"><i style="width:100%"></i></div>', 'sesHome') + vDone(s) + '</div>'; }
function vDone(s){
  const now = Date.now(), pend = pendingSame(now), due = dueList(now).length;
  const left = nextNew(9999).length;
  const st = s.st;
  let next;
  if (pend.length) next = cramOn() ? '몰아 복습 ' + pend.length + '개가 ' + whenTxt(dueAt(pend[0].id)) + '부터 열려요. 그때 다시 보면 시험까지 남아요.' : '같은 날 2회차 복습 ' + pend.length + '개가 ' + hhmm(dueAt(pend[0].id)) + '부터 열려요. 한 번 더 보면 훨씬 오래 남아요.';
  else if (due) next = '지금 복습할 카드가 ' + due + '개 더 있어요.';
  else if (left) next = (modeOf() !== 'all' ? MODES[modeOf()].range + ' 중 ' : '') + '새 개념이 ' + left + '개 남았어요. 틈날 때 이어서 해요.';
  else next = modeOf() !== 'all' ? MODES[modeOf()].range + ' 개념을 모두 배웠어요.' : '모든 개념을 배웠어요. 복습 날짜가 되면 다시 알려 줘요.';
  const label = { main: '이어서 공부', quick: '3분 복습', weak: '약점 공부', practice: '카드 연습', review: '복습 카드', extra: '더 하기', pick: '고른 개념 공부' }[s.kind] || '공부';
  const rest = (s.rest || []).filter(id => X.cmap[id]);
  if (s.kind === 'pick') next = rest.length ? '고른 개념 중 ' + rest.length + '개가 남았어요. 이어서 하면 다음 개념들로 한 세트가 만들어져요.' : '고른 개념을 한 번씩 다 봤어요. 목차에서 정답률을 확인하고, 부족한 것만 골라 다시 해 보세요.';
  return '<div class="done-card"><div class="eyebrow">' + label + '</div><h2>한 세트 끝!</h2>' +
    '<div class="stats2"><div class="stat"><b>' + st.rev + '</b><span>복습한 카드</span></div><div class="stat"><b>' + st.newc + '</b><span>새로 배운 개념</span></div><div class="stat"><b>' + (st.qn ? st.qok + '/' + st.qn : '–') + '</b><span>문제 정답</span></div><div class="stat"><b>' + (s.mins || 1) + '분</b><span>걸린 시간</span></div></div>' +
    '<p>' + esc(next) + '</p>' + ((s.mins || 0) >= 25 ? '<p class="hint">25분 넘게 했어요. 5분 쉬면 다음 공부가 더 잘 들어와요.</p>' : '') +
    '<div class="row-btns">' + (s.kind === 'pick' && rest.length ? '<button class="btn primary" data-act="start" data-arg="pick:' + rest.join(',') + '">남은 ' + rest.length + '개 이어서</button>' : s.kind === 'pick' ? '<button class="btn primary" data-act="go" data-arg="toc:">목차로</button>' : '<button class="btn primary" data-act="cont">다음 5분 이어서</button>') + '<button class="btn" data-act="sesHome">공부 탭으로</button></div></div>';
}

async function openSubject(sid){
  if (SUB[sid]) return true;
  const tt = setTimeout(() => toast('과목 내용을 불러오는 중이에요…'), 400);
  const ok = await ensureSubject(sid); clearTimeout(tt);
  if (!ok) { render(true); toast('과목 파일을 불러오지 못했어요. 아래 알림을 확인하세요'); }
  return ok;
}
Object.assign(ACT, {
  enter: async a => { if (!(await openSubject(a))) return; enterSubject(a, 'study'); render(true); },
  enterGo: async a => { if (!(await openSubject(a))) return; enterSubject(a, 'study'); contSession(); },
  smode: a => {
    const i = a.lastIndexOf(':'); const sid = a.slice(0, i), m = a.slice(i + 1); if (!MODES[m]) return;
    const s = SS(sid); const prev = s.mode || 'all'; s.mode = m;
    if (m === 'cram' && (!s.cramAt || Date.now() - s.cramAt > 20 * HOUR)) s.cramAt = Date.now(); /* 새 당일치기 회차 */
    if (prev !== m) { s.scope = null; if (R.t) R.t.sel = null; S.set.noteRange = m === 'cram' ? 'top' : m === 'core' ? 'top2' : 'all'; R.sheetCache = null; }
    save(); render(); if (prev !== m) toast(MODES[m].name + ' 모드: ' + MODES[m].desc);
  },
  sadd: a => { const i = a.lastIndexOf(':'); const sid = a.slice(0, i); SS(sid).noAdd = a.slice(i + 1) === '0'; R.sheetCache = null; save(); render(); toast(SS(sid).noAdd ? '추가 내용은 빼고 공부해요. 기록은 그대로 남아요' : '추가 내용도 같이 공부해요'); },
  subjpick: () => { R.t.subjPick = !R.t.subjPick; render(true); },
  subjhide: a => { const h = S.set.hideSubj || (S.set.hideSubj = {}); if (h[a]) delete h[a]; else h[a] = 1; save(); render(); },
  rangenote: () => { S.set.noteRange = modeOf() === 'core' ? 'top2' : 'top'; R.sheetCache = null; save(); ACT.tab('note'); },
  subjects: () => { leaveSubject(); render(true); },
  updok: () => { R.update = null; render(); },
  order: a => { S.set.order = a === 'pr' ? 'pr' : 'toc'; save(); toast(a === 'pr' ? '★★★ 자주 출제 → ★★ 중요 → ★ 기본 순서로 새 개념이 나와요' : '목차 순서대로 새 개념이 나와요'); render(); },
  home: () => {
    const top = cur(); const busy = top && ((top.name === 'session' && SS().ses) || (top.name === 'quiz' && SS().qz && !SS().qz.done));
    R.sheet = null; while (R.stack.length) onLeave(R.stack.pop());
    R.doneSes = null; R.tab = 'study'; render(true);
    if (busy) toast('여기까지 저장했어요. 나중에 그 자리부터 이어서 할 수 있어요');
  },
  cont: () => contSession(),
  start: a => { const i = a.indexOf(':'); startSession(i < 0 ? a : a.slice(0, i), i < 0 ? '' : a.slice(i + 1)); },
  exit: () => {
    const s = SS().ses; const did = s && s.i > 0;
    R.stack.pop(); pauseSession(); R.doneSes = null; render(true);
    if (s && did) toast('여기까지 저장했어요. ‘이어서 공부하기’로 다시 시작해요');
  },
  sesHome: () => { R.doneSes = null; SS().ses = null; R.stack = []; R.tab = 'study'; render(true); },
  reveal: () => { SS().ses.rev = true; save(); render(); },
  grade: a => {
    const s = SS().ses, st = s.steps[s.i], g = +a;
    if (st.fresh || st.practice) { const x = crec(st.cid); if (x) x.seen = (x.seen || 0) + 1; logInc('cards'); }
    else { grade(st.cid, g); s.st.rev++; }
    if (g === 0 || (g === 1 && (st.fresh || st.practice))) {
      s.rq[st.cid] = (s.rq[st.cid] || 0) + 1;
      if (s.rq[st.cid] <= 3) { const pos = Math.min(s.i + (g === 0 ? 3 : 5), s.steps.length - 1); s.steps.splice(pos, 0, { t: 'card', cid: st.cid, fresh: true, again: true }); s.st.again++; }
    }
    nextStep();
  },
  learned: () => {
    const s = SS().ses, st = s.steps[s.i];
    if (!isLearned(st.cid)) { learnConcept(st.cid); s.st.newc++; } else if (st.relearn) { crec(st.cid).lv0 = false; }
    R.t.mnMine = null; nextStep();
  },
  snext: () => nextStep(),
  figlater: a => { SS().figTodo[a] = Date.now(); toast('‘그림 넣을 개념’ 목록에 담았어요'); nextStep(); },
  figoff: () => { S.set.figAsk = false; toast('그림 안내를 껐어요. 설정에서 다시 켤 수 있어요'); nextStep(); },
  fqpick: a => {
    const s = SS().ses, st = s.steps[s.i]; if (s.fq) return;
    const ok = +a === st.n; s.fq = { pick: +a, ok };
    figRecord(st.img, st.n, ok); save(); render();
  }
});

/* ───────── 문제 탭 ───────── */
function scoped(list){ return S.set.qAll ? list : list.filter(unlocked); }
function vQuizTab(){
  const all = allQ(); const qa = qStats(all); const pool = reviewPool().length; const z = SS().qz;
  const open = all.filter(unlocked).length; const mcs = all.filter(q => q.type === 'mc');
  const nNs = scoped(mcs.filter(q => q.lv === 2)).length, nCase = scoped(mcs.filter(q => q.case || q.tag === '사례형')).length, nMc = scoped(mcs).length;
  const nTop = scoped(mcs.filter(isTopQ)).length, nAddAll = all.filter(isAdd).length, nAdd = scoped(all.filter(isAdd)).length;
  let h = subjTop() + '<section><h1>문제</h1><p class="sub">문제는 관련 개념을 모두 배우면 열려요. 틀렸거나 애매했던 문제는 다시 나오고, 2번 연속 깔끔하게 맞히면 졸업해요.</p>' +
    (modeOf() !== 'all' ? '<p class="mode-note"><b>' + MODES[modeOf()].name + '</b> 모드라 ' + MODES[modeOf()].range + ' 개념의 문제만 나와요. 공부 탭이나 첫 화면에서 모드를 바꿀 수 있어요.</p>' : '') +
    (addOff() ? '<p class="mode-note">추가 내용은 빼고 공부하는 중이라 추가된 문제는 나오지 않아요.</p>' : '') +
    '<div class="stats3"><div><b>' + qa.att + '<small>/' + all.length + '</small></b><span>푼 문제</span></div><div><b>' + (qa.acc == null ? '–' : qa.acc + '%') + '</b><span>정답률</span></div><div><b>' + pool + '</b><span>다시 풀 문제</span></div></div>';
  if (z && !z.done) {
    const left = z.limit ? z.limit - z.used : 0;
    h += '<div class="notice resume"><b>풀던 문제가 있어요</b><p>' + esc(z.title) + ' · ' + (z.i + 1) + '/' + z.ids.length + (z.limit ? ' · 남은 시간 ' + fmtMs(left) : '') + '</p><div class="row-btns"><button class="btn primary" data-act="qresume">이어 풀기</button><button class="btn" data-act="qdrop">그만두기</button></div></div>';
  }
  h += '<div class="seg scope" role="group" aria-label="문제 범위"><button data-act="qscope" data-arg="0" aria-pressed="' + !S.set.qAll + '">배운 범위만 · 열린 ' + open + '문제</button><button data-act="qscope" data-arg="1" aria-pressed="' + !!S.set.qAll + '">전체 범위</button></div>' +
    '<div class="list">' +
    lrow('quiz', 'ns:', '국시형만 풀기', (nNs > 15 ? nNs + '문제 중 15문제' : nNs + '문제') + ' · 사례형, 우선순위, 부정형, 수치 해석', { dis: !nNs }) +
    (modeOf() !== 'all' ? lrow('quiz', 'range:', MODES[modeOf()].range + ' 범위 문제 테스트', '객관식 15 + O/X 5 · 지금 모드의 범위에서', { dis: !nMc }) : '') +
    lrow('quiz', 'top:', '자주 출제 개념 문제', (nTop > 15 ? nTop + '문제 중 15문제' : nTop + '문제') + ' · ★★★ 개념과 연결된 문제', { dis: !nTop, tag: ' <span class="prs p3">★★★</span>' }) +
    lrow('quiz', 'pool:', '다시 풀 문제', pool ? pool + '문제 · 틀렸거나 애매했거나 힌트를 본 문제' : '아직 없어요', { dis: !pool }) +
    lrow('quiz', 'case:', '사례형 집중', (nCase > 15 ? nCase + '문제 중 15문제' : nCase + '문제') + ' · 환자 상황 문제', { dis: !nCase }) +
    (nAddAll ? lrow('quiz', 'add:', '추가된 문제', (nAdd > 15 ? nAdd + '문제 중 15문제' : nAdd + '문제') + ' · 새로 추가된 개념의 문제', { dis: !nAdd, tag: ADD_TAG }) : '') + '</div>' +
    '<h3 class="h3">단원 테스트 <span>O/X 4개 + 객관식 8개</span></h3><div class="chips-wrap">' + X.units.map(u => { const n = scoped(all.filter(q => q.u === u.id)).length; return '<button class="chip-btn" data-act="quiz" data-arg="unit:' + u.id + '"' + (n ? '' : ' disabled') + '>' + u.n + '. ' + esc(u.short || u.title) + ' <span class="mono">' + n + '</span></button>'; }).join('') + '</div>' +
    '<h3 class="h3">실전 모의고사 <span>문제당 1분 · 해설은 끝나고 한꺼번에 · 중간에 나가도 이어서 풀 수 있어요</span></h3><div class="row-btns">' +
    '<button class="btn" data-act="quiz" data-arg="mock:20"' + (nMc ? '' : ' disabled') + '>20문제</button><button class="btn" data-act="quiz" data-arg="mock:40"' + (nMc ? '' : ' disabled') + '>40문제</button></div>' +
    (nMc < 20 && !S.set.qAll ? '<p class="hint">아직 열린 객관식이 ' + nMc + '문제라 모의고사가 짧아요. 개념을 더 배우거나 ‘전체 범위’를 고르세요.</p>' : '') +
    '<h3 class="h3">기출 · 내 문제</h3><div class="list">' +
    lrow('go', 'gichul:', '국시 기출 (내 폰에만 저장)', G.qs.length ? G.sets.length + '회차 · ' + G.qs.length + '문항 · ' + esc(X.title) + ' 연결 ' + gcQs().length + '문항' : '국시원 기출 PDF를 붙여넣어 풀기') +
    lrow('go', 'custom:', '내가 넣은 문제', (SS().custom || []).length + '문제 · 학교 기출, 교수님 문제 등') +
    lrow('go', 'wrongs:', '오답노트 보기', pool ? '정답과 해설 한 번에 보기' : '틀린 문제가 생기면 여기에 모여요', { dis: !pool }) + '</div>' +
    '<p class="note">간호사 국가시험은 8과목 295문항이고, 총점 60% 이상이면서 과목별 40% 이상이어야 합격해요. 기출문제는 저작권이 있어 개인 공부용으로만 쓰세요.</p></section>';
  return h;
}

/* ───────── 문제 풀기 ───────── */
function ensureAns(z, q){ return z.ans[q.id] || (z.ans[q.id] = { perm: permFor(q) }); }
function isTopQ(q){ return links(q).some(cid => X.cmap[cid] && X.cmap[cid].pr === 3); }
function startQuiz(mode, arg){
  const all = allQ(); let ids = [], title = '', instant = true, limit = 0, set = null;
  const mcs = all.filter(q => q.type === 'mc');
  const gReady = g => g.a >= 0 && g.o.length >= 2;
  if (mode === 'ns') { ids = shuffle(scoped(mcs.filter(q => q.lv === 2))).slice(0, 15).map(q => q.id); title = '국시형 문제'; }
  else if (mode === 'unit') {
    const pool = scoped(all.filter(q => q.u === arg));
    ids = shuffle(pool.filter(q => q.type === 'ox')).slice(0, 4).concat(shuffle(pool.filter(q => q.type === 'mc')).slice(0, 8)).map(q => q.id);
    title = X.umap[arg].n + '단원 테스트';
  } else if (mode === 'mock') {
    const pool = shuffle(scoped(mcs)); const n = Math.min(+arg || 20, pool.length);
    ids = pool.slice(0, n).map(q => q.id); instant = false; limit = n * MIN; title = '실전 모의고사 ' + n + '문제';
  } else if (mode === 'pool') { ids = reviewPool().map(q => q.id); title = '다시 풀 문제'; }
  else if (mode === 'range') { const pool = scoped(all); ids = shuffle(pool.filter(q => q.type === 'mc')).slice(0, 15).concat(shuffle(pool.filter(q => q.type === 'ox')).slice(0, 5)).map(q => q.id); title = MODES[modeOf()].range + ' 문제 테스트'; }
  else if (mode === 'top') { ids = shuffle(scoped(mcs.filter(isTopQ))).slice(0, 15).map(q => q.id); title = '★★★ 자주 출제 개념 문제'; }
  else if (mode === 'add') { const pool = scoped(all.filter(isAdd)); ids = shuffle(pool.filter(q => q.type === 'mc')).slice(0, 12).concat(shuffle(pool.filter(q => q.type === 'ox')).slice(0, 3)).map(q => q.id); title = '추가된 문제'; }
  else if (mode === 'case') { ids = shuffle(scoped(mcs.filter(q => q.case || q.tag === '사례형'))).slice(0, 15).map(q => q.id); title = '사례형 집중'; }
  else if (mode === 'custom') { ids = shuffle(customQs()).map(q => q.id); title = '내가 넣은 문제'; }
  else if (mode === 'sel') {
    const set = new Set(String(arg).split(','));
    const pool = scoped(all.concat(gcQs()).filter(q => links(q).some(c => set.has(c)) && (!q.gc || q.a >= 0)));
    ids = shuffle(pool.filter(q => q.type === 'mc')).slice(0, 15).concat(shuffle(pool.filter(q => q.type === 'ox')).slice(0, 5)).map(q => q.id);
    title = '고른 개념 문제';
    if (!ids.length) { toast('고른 개념을 아직 배우지 않아서 열린 문제가 없어요. ‘고른 것 공부’를 먼저 하거나 문제 탭에서 ‘전체 범위’를 고르세요'); return; }
  }
  else if (mode === 'cq') { ids = shuffle(allQx().concat(gcQs()).filter(q => links(q).includes(arg) && (!q.gc || q.a >= 0))).map(q => q.id); title = (X.cmap[arg] ? X.cmap[arg].t : '개념') + ' 문제'; }
  else if (mode === 'gset') {
    const qs = G.qs.filter(g => g.set === arg && gReady(g)).sort((a, b) => a.no - b.no);
    ids = qs.map(g => g.id); instant = false; limit = Math.round(qs.length * 0.9 * MIN); title = setTitle(arg) + ' · 실전처럼'; set = arg;
  }
  else if (mode === 'glearned') { ids = shuffle(G.qs.filter(gReady).map(gq).filter(unlocked)).slice(0, 20).map(q => q.id); title = '공부한 개념 관련 기출'; }
  else if (mode === 'gwrong') { ids = G.qs.filter(g => gReady(g) && inPool(S.gq[g.id])).map(g => g.id); title = '틀린 기출 다시'; }
  else if (mode === 'gmix') { ids = shuffle(G.qs.filter(gReady).map(gq).filter(q => q.c.length)).slice(0, 20).map(q => q.id); title = '기출 섞어 풀기'; }
  if (!ids.length) { toast(S.set.qAll || mode[0] === 'g' || mode === 'pool' || mode === 'custom' ? '풀 문제가 없어요' : '아직 열린 문제가 없어요. 개념을 먼저 배우세요'); return; }
  const old = SS().qz; if (old && !old.done) settleQuizCur(old);
  SS().qz = { mode, arg: arg || '', title, ids, i: 0, ans: {}, instant, limit, used: 0, t0: Date.now(), done: false, set };
  save(); R.stack = R.stack.filter(x => x.name !== 'quiz'); go('quiz');
}
function settleQuizCur(z){ const q = Q(z.ids[z.i]); if (q && z.instant) settleQ(q, z.ans[q.id]); }
function pauseQuiz(){
  const z = SS().qz; if (!z) return;
  clearInterval(T.quiz);
  if (z.done) SS().qz = null;
  else { if (z.t0) { z.used += Date.now() - z.t0; z.t0 = null; } settleQuizCur(z); }
  save();
}
function quizLeft(z){ return z.limit - z.used - (z.t0 ? Date.now() - z.t0 : 0); }
function submitQuiz(){
  const z = SS().qz; if (!z || z.done) return;
  clearInterval(T.quiz); if (z.t0) { z.used += Date.now() - z.t0; z.t0 = null; }
  z.ids.forEach(id => {
    const q = Q(id); if (!q) return; const a = ensureAns(z, q);
    if (!z.instant) { a.ok = a.pick === q.a; a.shown = true; recordQ(q, a.ok, a); if (!a.ok) penalize(q, null); a.settled = true; }
    else if (!a.shown) { a.ok = false; a.shown = true; a.skipped = true; }
    else settleQ(q, a);
  });
  z.done = true;
  const n = z.ids.length, ok = z.ids.filter(id => z.ans[id] && z.ans[id].ok).length;
  if (['mock', 'unit', 'gset', 'ns'].includes(z.mode)) { SS().exams.push({ ts: Date.now(), title: z.title, n, ok, by: quizBy(z), mode: z.mode, set: z.set }); SS().exams = SS().exams.slice(-60); }
  save(); render(true);
}
function quizBy(z){
  const by = {};
  z.ids.forEach(id => { const q = Q(id); if (!q) return; const k = z.mode === 'gset' ? (q.sub || '기타') : (q.u && X.umap[q.u] ? X.umap[q.u].n + '. ' + (X.umap[q.u].short || X.umap[q.u].title) : '기타'); by[k] = by[k] || [0, 0]; by[k][1]++; if (z.ans[id] && z.ans[id].ok) by[k][0]++; });
  return by;
}
function vQuiz(){
  const z = SS().qz; if (!z) return vQuizTab();
  z.ids = z.ids.filter(id => Q(id)); if (!z.ids.length) { SS().qz = null; return vQuizTab(); }
  if (z.i >= z.ids.length) z.i = z.ids.length - 1;
  if (z.done) return vQuizResult(z);
  const q = Q(z.ids[z.i]); const st = ensureAns(z, q); const n = z.ids.length;
  const ns = z.instant ? 'qz' : 'mk'; const canNext = z.instant ? !!st.shown : true;
  const answered = z.ids.filter(id => z.ans[id] && z.ans[id].pick != null).length;
  return '<div>' + fullBar('<div class="pbar"><i style="width:' + pct(z.i, n) + '%"></i></div><span class="mono ses-n">' + (z.i + 1) + '/' + n + '</span>' + (z.limit ? '<span class="mono timer" id="qtimer">' + fmtMs(quizLeft(z)) + '</span>' : ''), 'qexit') +
    '<div class="ses-tag">' + esc(z.title) + (q.u && X.umap[q.u] ? ' · ' + X.umap[q.u].n + '단원' : '') + '</div>' + qHTML(q, st, ns) +
    '<div class="qnav">' + (!z.instant && z.i > 0 ? '<button class="btn" data-act="qprev">이전 문제</button>' : '') + (canNext ? '<button class="btn primary big" data-act="qnext">' + (z.i === n - 1 ? (z.instant ? '결과 보기' : '제출하기') : '다음') + '</button>' : '') + '</div>' +
    (!z.instant ? '<p class="hint center">' + answered + '/' + n + '문제 답함 · 시간이 끝나면 자동 제출 · 중간에 나가도 이어서 풀 수 있어요</p>' + (z.i < n - 1 ? '<div class="row-btns"><button class="btn ghost" data-act="qsubmit">지금 제출하기</button></div>' : '') : '') + '</div>';
}
function vQuizResult(z){
  const n = z.ids.length; const ok = z.ids.filter(id => z.ans[id] && z.ans[id].ok).length; const pc = pct(ok, n);
  const by = quizBy(z); const wrongIds = z.ids.filter(id => !(z.ans[id] && z.ans[id].ok));
  const rs = {}; wrongIds.forEach(id => { const r = z.ans[id] && z.ans[id].reason; if (r) rs[r] = (rs[r] || 0) + 1; });
  const low = Object.keys(by).filter(k => by[k][1] >= 3 && pct(by[k][0], by[k][1]) < 40);
  const verdict = pc >= 60 ? (low.length ? '총점은 합격선(60%) 이상이지만 과락(40% 미만) 과목이 있어요: ' + low.join(', ') : '합격선(60%) 이상이에요') : pc >= 40 ? '과락선은 넘었지만 합격선(60%)까지 ' + (60 - pc) + '%p 남았어요' : '과락선(40%) 아래예요. 틀린 개념부터 다시 봐요';
  return '<div>' + subBar(z.title, HOME_BTN) + '<div class="done-card"><div class="eyebrow">결과</div><h2>' + ok + ' / ' + n + ' · ' + pc + '%</h2><p>' + esc(verdict) + '</p>' +
    '<h3 class="h3">' + (z.mode === 'gset' ? '과목별' : '단원별') + ' 정답률 <span>점선 40% 과락 · 실선 60% 합격</span></h3>' +
    Object.keys(by).map(k => { const v = by[k]; const p2 = pct(v[0], v[1]); return '<div class="ubar"><span>' + esc(k) + '</span><span class="ub"><i class="' + (p2 < 40 ? 'low' : '') + '" style="width:' + p2 + '%"></i></span><b>' + p2 + '%</b></div>'; }).join('') +
    (Object.keys(rs).length ? '<p class="hint">틀린 이유: ' + Object.keys(rs).map(k => k + ' ' + rs[k]).join(' · ') + (rs['잘못 읽음'] ? ' — 문제의 핵심어(옳지 않은 것, 가장 먼저)에 밑줄 긋는 습관을 들여 보세요.' : '') + '</p>' : '') +
    '<div class="row-btns">' + (wrongIds.length ? '<button class="btn primary" data-act="quiz" data-arg="pool:">다시 풀 문제 풀기</button>' : '') + '<button class="btn" data-act="qdone">닫기</button></div></div>' +
    (wrongIds.length ? '<h3 class="h3">틀린 문제 <span>' + wrongIds.length + '개 · 다시 풀 문제에 모였어요</span></h3>' + wrongIds.map(id => { const q = Q(id); return q ? qHTML(q, Object.assign({}, z.ans[id], { shown: true }), 'rv') : ''; }).join('<div class="gap"></div>') : '') + '</div>';
}
function poolWhy(r){ const w = []; if (!r) return ''; if (r.wrong) w.push('틀림'); if (r.unsure) w.push('애매'); if (r.hint) w.push('힌트 봄'); return w.join(' · '); }
V.wrongs = () => {
  const list = reviewPool();
  return subBar('오답노트') + '<section><p class="sub">틀렸거나, 맞혔지만 애매했거나, 힌트를 보고 푼 문제예요. 2번 연속 깔끔하게 맞히면 졸업해요.</p>' +
    (list.length ? '<button class="btn primary big" data-act="quiz" data-arg="pool:" style="margin:0 0 14px">다시 풀기 ' + list.length + '문제</button>' + list.map(q => '<p class="pool-why">' + esc(poolWhy(qrec(q))) + '</p>' + qHTML(q, { shown: true, perm: q.o.map((_, i) => i) }, 'rv')).join('<div class="gap"></div>') : '<p class="empty">다시 풀 문제가 없어요.</p>') + '</section>';
};
V.qview = p => {
  const q = Q(p.id); if (!q) return subBar('문제') + '<p class="empty">문제를 찾을 수 없어요.</p>';
  const st = (R.t.qv && R.t.qv.id === p.id) ? R.t.qv.st : (R.t.qv = { id: p.id, st: { perm: permFor(q) } }).st;
  return subBar('문제') + '<section>' + (!unlocked(q) ? '<p class="hint">아직 배우지 않은 개념이 연결된 문제예요.</p>' : '') + qHTML(q, st, 'qv') + '</section>';
};
function nsState(ns){
  if (ns === 'sq') { const s = SS().ses; const step = s && s.steps[s.i]; if (!step || step.t !== 'q') return null; const q = Q(step.qid); if (!s.q) s.q = { perm: permFor(q) }; return { q, st: s.q }; }
  if (ns === 'qz' || ns === 'mk') { const z = SS().qz; if (!z) return null; const q = Q(z.ids[z.i]); return q ? { q, st: ensureAns(z, q) } : null; }
  if (ns === 'qv') { const p = cur() && cur().p; const q = p && Q(p.id); if (!q) return null; if (!R.t.qv || R.t.qv.id !== p.id) R.t.qv = { id: p.id, st: { perm: permFor(q) } }; return { q, st: R.t.qv.st }; }
  return null;
}

/* ───────── 문제 고치기 · 빼기 (이 기기에만, 보내기로 공유) ───────── */
V.qedit = p => {
  const q = X.qmap[p.id]; const b = (X.qbase && X.qbase[p.id]) || q;
  if (!q || q.gc || q.src === 'custom' || q.mine) return subBar('문제 고치기') + '<p class="empty">여기서 고칠 수 없는 문제예요.</p>';
  const isOX = q.type === 'ox', hid = !!SS().qh[q.id], ed = !!SS().qe[q.id];
  if (R.t.qeId !== q.id) { R.t.qeId = q.id; R.t.qeA = q.a; }
  const a = R.t.qeA;
  return subBar('문제 고치기') + '<section><p class="sub">정답이 틀렸거나 보기·해설이 이상하면 고쳐요. 이 기기에만 저장되고, 진도 탭의 ‘고친 내용 모아 보기’에서 친구에게 보내거나 모두에게 반영할 수 있어요.</p>' +
    (hid ? '<div class="notice"><b>뺀 문제예요</b><p>문제 풀기와 복습에 나오지 않아요.</p></div>' : '') +
    '<label class="lbl" for="qe-q">문제</label><textarea id="qe-q" rows="3">' + esc(q.q) + '</textarea>' +
    (isOX ? '' : '<label class="lbl">보기</label>' + q.o.map((o, i) => '<div class="qe-o"><span class="on">' + CIRC[i] + '</span><input id="qe-o' + i + '" value="' + esc(o) + '" aria-label="보기 ' + (i + 1) + '"></div>').join('')) +
    '<label class="lbl">정답</label><div class="seg sm qe-a" role="group" aria-label="정답">' + q.o.map((o, i) => '<button data-act="qeA" data-arg="' + i + '" aria-pressed="' + (a === i) + '">' + (isOX ? esc(o) : CIRC[i]) + '</button>').join('') + '</div>' +
    (isOX ? '' : '<label class="lbl" for="qe-k">묻는 것<span>한 줄 핵심 (없어도 돼요)</span></label><input id="qe-k" value="' + esc(q.k || '') + '">') +
    '<label class="lbl" for="qe-e">정답 이유</label><textarea id="qe-e" rows="3">' + esc(q.e || '') + '</textarea>' +
    (isOX ? '' : '<details class="why"><summary>보기별 해설 (선택)</summary>' + q.o.map((o, i) => '<div class="qe-o"><span class="on">' + CIRC[i] + '</span><input id="qe-x' + i + '" value="' + esc((q.x || [])[i] || '') + '" aria-label="보기 ' + (i + 1) + ' 해설"></div>').join('') + '<p class="hint">정답 보기의 칸은 비워 둬도 돼요.</p></details>') +
    '<div class="row-btns"><button class="btn primary" data-act="qesave" data-arg="' + q.id + '">저장</button>' + (ed ? '<button class="btn" data-act="qereset" data-arg="' + q.id + '">원래대로 되돌리기</button>' : '') +
    '<button class="btn' + (hid ? '' : ' danger') + '" data-act="qehide" data-arg="' + q.id + '">' + (hid ? '다시 문제에 넣기' : '이 문제 빼기') + '</button></div>' +
    (ed ? '<details class="why"><summary>원래 문제 보기</summary><p>' + esc(b.q) + '</p><p>정답: ' + (isOX ? esc(b.o[b.a]) : CIRC[b.a] + ' ' + esc(b.o[b.a])) + '</p>' + (b.e ? '<p>' + esc(b.e) + '</p>' : '') + '</details>' : '') + '</section>';
};

/* ───────── 내가 넣은 문제 ───────── */
V.custom = () => {
  const list = SS().custom || [];
  return subBar('내가 넣은 문제') + '<section><div class="row-btns" style="margin-top:0"><button class="btn primary" data-act="go" data-arg="cadd:">하나씩 추가</button><button class="btn" data-act="go" data-arg="cpaste:">여러 개 붙여넣기</button></div>' +
    (list.length ? '<button class="btn big" data-act="quiz" data-arg="custom:">' + list.length + '문제 풀기</button>' : '') +
    '<h3 class="h3">목록 <span>' + list.length + '문제</span></h3>' +
    (list.length ? '<div class="list">' + list.slice().reverse().map(q => '<div class="cq"><p>' + esc(q.q) + '</p><span class="meta">' + (q.u && X.umap[q.u] ? X.umap[q.u].n + '단원 · ' : '') + esc(q.s || '출처 없음') + ' · 정답 ' + CIRC[q.a] + '</span><div class="row-btns"><button class="btn" data-act="cdel" data-arg="' + q.id + '">' + (R.t.confirm === 'del-' + q.id ? '한 번 더 누르면 삭제' : '삭제') + '</button></div></div>').join('') + '</div>'
      : '<p class="empty">아직 넣은 문제가 없어요. 학교 기출이나 교수님 문제를 넣어 보세요. 이 기기에만 저장돼요.</p>') + '</section>';
};
V.cadd = () => subBar('문제 추가') + '<section>' +
  '<label class="lbl" for="cq-q">문제</label><textarea id="cq-q" rows="3"></textarea>' +
  [0, 1, 2, 3, 4].map(i => '<label class="lbl" for="cq-o' + i + '">보기 ' + CIRC[i] + (i > 1 ? '<span>비워 두면 빠져요</span>' : '') + '</label><input id="cq-o' + i + '">').join('') +
  '<label class="lbl" for="cq-a">정답</label><select id="cq-a">' + [0, 1, 2, 3, 4].map(i => '<option value="' + i + '">' + CIRC[i] + '</option>').join('') + '</select>' +
  '<label class="lbl" for="cq-e">해설<span>직접 쓰면 더 잘 기억나요</span></label><textarea id="cq-e" rows="3"></textarea>' +
  '<label class="lbl" for="cq-u">단원</label><select id="cq-u"><option value="">선택 안 함</option>' + X.units.map(u => '<option value="' + u.id + '">' + u.n + '. ' + esc(u.title) + '</option>').join('') + '</select>' +
  '<label class="lbl" for="cq-s">출처<span>예: 2026-2학기 중간</span></label><input id="cq-s">' +
  '<button class="btn primary big" data-act="csave">저장</button></section>';
V.cpaste = () => subBar('여러 개 붙여넣기') + '<section><p class="sub">아래 형식으로 붙여넣으면 한 번에 추가돼요. 문제 사이는 --- 로 나눠요. 해설·단원·출처는 없어도 돼요.</p>' +
  '<pre class="fmt">Q: 흉골각과 같은 높이의 늑골은?\n1) 1번\n2) 2번\n3) 3번\n4) 4번\n5) 5번\nA: 2\nE: 흉골각에는 2번 늑골이 붙는다\nU: 5\nS: 2026-2학기 중간\n---\nQ: 다음 문제…</pre>' +
  '<label class="lbl" for="cp-txt">붙여넣기</label><textarea id="cp-txt" rows="10"></textarea>' +
  (R.t.pasteMsg ? '<p class="hint" role="status">' + esc(R.t.pasteMsg) + '</p>' : '') +
  '<button class="btn primary big" data-act="cparse">변환해서 추가</button></section>';
function parsePaste(txt){
  const blocks = txt.replace(/\r/g, '').split(/\n\s*-{3,}\s*(?:\n|$)/); const out = [], errs = [];
  blocks.forEach((b, bi) => {
    const lines = b.split('\n').map(l => l.trim()).filter(Boolean); if (!lines.length) return;
    let q = '', o = [], a = null, e = '', u = '', s = '', last = '';
    lines.forEach(l => {
      let m;
      if ((m = l.match(/^(?:Q|문제)\s*[:：.)]\s*(.*)$/i))) { q = m[1]; last = 'q'; }
      else if ((m = l.match(/^(?:A|정답|답)\s*[:：.)]\s*(.*)$/i))) { a = m[1]; last = 'a'; }
      else if ((m = l.match(/^(?:E|해설)\s*[:：.)]\s*(.*)$/i))) { e = m[1]; last = 'e'; }
      else if ((m = l.match(/^(?:U|단원)\s*[:：.)]\s*(.*)$/i))) { u = m[1]; last = 'u'; }
      else if ((m = l.match(/^(?:S|출처)\s*[:：.)]\s*(.*)$/i))) { s = m[1]; last = 's'; }
      else if ((m = l.match(/^(?:\(?([1-9])\s*[).]|([①-⑨]))\s*(.*)$/))) { o.push(m[3]); last = 'o'; }
      else if (last === 'q' || (!last && !q)) { q = q ? q + ' ' + l : l; last = 'q'; }
      else if (last === 'e') e += ' ' + l;
      else if (last === 'o' && o.length) o[o.length - 1] += ' ' + l;
    });
    let ai = null;
    if (a != null) {
      const t = String(a).trim(); const ci = '①②③④⑤⑥⑦⑧⑨'.indexOf(t[0]);
      if (ci >= 0) ai = ci; else if (/^\d/.test(t)) ai = parseInt(t, 10) - 1; else { const k = o.findIndex(x => x === t); if (k >= 0) ai = k; }
    }
    if (!q || o.length < 2 || ai == null || ai < 0 || ai >= o.length) { errs.push(bi + 1); return; }
    let uidd = '';
    if (u) { const nn = parseInt(u, 10); if (nn && X.units[nn - 1]) uidd = X.units[nn - 1].id; else { const f = X.units.find(x => x.title.indexOf(u) >= 0); if (f) uidd = f.id; } }
    out.push({ id: uid('x'), q, o, a: ai, e, u: uidd, s });
  });
  return { out, errs };
}

/* ───────── 국시 기출 (이 기기에만 저장) ───────── */
const KUKSI = { 1: [[1, 70, '성인간호학'], [71, 105, '모성간호학']], 2: [[1, 35, '아동간호학'], [36, 70, '지역사회간호학'], [71, 105, '정신간호학']], 3: [[1, 35, '간호관리학'], [36, 65, '기본간호학'], [66, 85, '보건의약관계법규']] };
const KSUBJ = ['성인간호학', '모성간호학', '아동간호학', '지역사회간호학', '정신간호학', '간호관리학', '기본간호학', '보건의약관계법규', '기타'];
function guessSub(period, no){ const m = KUKSI[period]; if (!m) return '기타'; const r = m.find(x => no >= x[0] && no <= x[1]); return r ? r[2] : '기타'; }
function gCleanLines(txt){
  const raw = String(txt || '').replace(/\r/g, '').replace(/[ 　]/g, ' ').split('\n').map(l => l.trim());
  const cnt = {}; raw.forEach(k => { if (k && k.length < 40) cnt[k] = (cnt[k] || 0) + 1; });
  return raw.filter(k => {
    if (!k) return false;
    if (/^[-–—(]?\s*\d{1,3}\s*[-–—)]?$/.test(k)) return false;
    if (/^\d{1,3}\s*\/\s*\d{1,3}$/.test(k)) return false;
    if (/^[①②③④⑤]/.test(k)) return true;
    if (cnt[k] >= 3) return false;
    return true;
  });
}
function gSplit(lines){
  const out = []; let curq = null; const re = /^(\d{1,3})\s*[.．]\s*(.*)$/;
  lines.forEach(l => {
    const m = l.match(re);
    if (m) { const n = +m[1]; if ((!curq && n >= 1 && n <= 150) || (curq && n === curq.no + 1)) { curq = { no: n, lines: [m[2]] }; out.push(curq); return; } }
    if (curq) curq.lines.push(l);
  });
  if (out.length >= 3) return out;
  const joined = lines.join(' '); const res = []; let expect = null, pos = 0;
  const re2 = /(?:^|\s)(\d{1,3})\s*[.．]\s/g; let m; const cuts = [];
  while ((m = re2.exec(joined))) { const n = +m[1]; if (expect == null ? (n >= 1 && n <= 150) : n === expect) { cuts.push({ n, at: m.index, start: re2.lastIndex }); expect = n + 1; } }
  cuts.forEach((c, i) => { res.push({ no: c.n, lines: [joined.slice(c.start, i + 1 < cuts.length ? cuts[i + 1].at : undefined)] }); });
  pos = 0;
  return res.length > out.length ? res : out;
}
function gOpts(text){
  const idx = []; let from = 0;
  for (let k = 0; k < 5; k++) { const j = text.indexOf(CIRC[k], from); if (j < 0) break; idx.push(j); from = j + 1; }
  if (idx.length >= 2) return { q: text.slice(0, idx[0]).trim(), o: idx.map((j, k) => text.slice(j + 1, k + 1 < idx.length ? idx[k + 1] : undefined).trim()) };
  const m = []; const re = /(?:^|\s)\(?([1-5])\)\s/g; let mm; let want = 1;
  while ((mm = re.exec(text))) { if (+mm[1] === want) { m.push({ at: mm.index, start: re.lastIndex }); want++; } }
  if (m.length >= 2) return { q: text.slice(0, m[0].at).trim(), o: m.map((x, k) => text.slice(x.start, k + 1 < m.length ? m[k + 1].at : undefined).trim()) };
  return { q: text.trim(), o: [] };
}
function gAnswers(txt, nos){
  const t = String(txt || '').replace(/\r/g, ' ');
  const conv = ch => { const i = CIRC.indexOf(ch); if (i >= 0 && i < 5) return i; const d = +ch; return d >= 1 && d <= 5 ? d - 1 : null; };
  const want = new Set(nos); const need = Math.max(1, Math.ceil(nos.length * 0.6));
  const pairs = re => { const pr = {}; let m; while ((m = re.exec(t))) { const n = +m[1]; if (want.has(n) && pr[n] == null) pr[n] = conv(m[2]); } return pr; };
  let pr = pairs(/(\d{1,3})\s*(?:번)?\s*[.:)\-]?\s*([①②③④⑤])/g);
  if (Object.keys(pr).length >= need) return pr;
  const circ = t.match(/[①②③④⑤]/g) || [];
  if (circ.length >= Math.ceil(nos.length * 0.5)) { const r = {}; nos.forEach((n, i) => { if (circ[i]) r[n] = conv(circ[i]); }); return r; }
  pr = pairs(/(\d{1,3})\s*(?:번)?\s*[.:)\-]\s*([1-5])(?!\d)/g);
  if (Object.keys(pr).length >= need) return pr;
  const tok = t.match(/\d+/g) || [];
  let alt = 0; for (let k = 0; k * 2 < tok.length && k < nos.length; k++) if (+tok[k * 2] === nos[k]) alt++;
  if (alt >= need) { const r = {}; nos.forEach((n, k) => { const v = tok[k * 2 + 1]; if (+tok[k * 2] === n && v && v.length === 1) r[n] = conv(v); }); return r; }
  const singles = tok.filter(x => /^[1-5]$/.test(x));
  if (singles.length >= Math.ceil(nos.length * 0.5)) { const r = {}; nos.forEach((n, i) => { if (singles[i]) r[n] = conv(singles[i]); }); return r; }
  return pr;
}
function autoLink(text, sids){
  const tx = nospace(text); const res = [];
  sids.forEach(sid => SUB[sid].concepts.forEach(c => {
    let sc = 0; const seen = new Set();
    (c.kw || []).forEach(k => { const kk = nospace(k); if (!kk || seen.has(kk)) return; seen.add(kk); if (tx.indexOf(kk) >= 0) sc += kk.length >= 4 ? 2 : 1; });
    if (sc >= 2) res.push({ sid, cid: c.id, sc });
  }));
  return res.sort((a, b) => b.sc - a.sc).slice(0, 4).map(r => [r.sid, r.cid]);
}
function gParse(round, period, qtxt, atxt){
  const blocks = gSplit(gCleanLines(qtxt));
  const items = blocks.map(b => { const o = gOpts(b.lines.join(' ').replace(/\s+/g, ' ')); return { no: b.no, q: o.q, o: o.o, a: null, sub: guessSub(period, b.no), lk: [] }; });
  const ans = gAnswers(atxt, items.map(x => x.no));
  items.forEach(it => { if (ans[it.no] != null && ans[it.no] < Math.max(it.o.length, 5)) it.a = ans[it.no]; it.lk = autoLink(it.q + ' ' + it.o.join(' '), loadedIds()); });
  return { round, period, items, ts: Date.now() };
}
function itemWarn(it){
  const w = [];
  if (!it.q) w.push('문제 글자가 비었어요');
  if (it.o.length !== 5) w.push('보기가 ' + it.o.length + '개로 나뉘었어요');
  if (it.a == null) w.push('정답을 골라 주세요');
  return w.join(' · ');
}
V.gichul = () => {
  const sets = G.sets.slice().sort((a, b) => b.ts - a.ts);
  const ready = G.qs.filter(g => g.a >= 0);
  const mine = ready.map(gq).filter(q => q.c.length).length;
  const learnedN = ready.map(gq).filter(unlocked).length; const wrongN = ready.filter(g => inPool(S.gq[g.id])).length;
  let h = subBar('국시 기출') + '<section><p class="sub">국시원에서 받은 기출문제 PDF의 글자를 복사해서 붙여넣으면 문제로 바꿔 줘요. 문제마다 관련 개념을 자동으로 연결하고, 확인 화면에서 고칠 수 있어요.</p>' +
    '<button class="btn primary big" style="margin-top:0" data-act="go" data-arg="gpaste:">기출 붙여넣기</button>';
  if (S.gdraft) h += '<div class="notice"><b>확인하던 기출이 있어요</b><p>' + esc(draftTitle(S.gdraft)) + ' · ' + S.gdraft.items.length + '문항</p><div class="row-btns"><button class="btn primary" data-act="go" data-arg="gconfirm:">이어서 확인</button></div></div>';
  if (sets.length) {
    h += '<h3 class="h3">골라 풀기 <span>' + esc(X.title) + ' 관련 ' + mine + '문항</span></h3><div class="list">' +
      lrow('quiz', 'glearned:', '공부한 개념 관련만', learnedN + '문항 · 연결된 개념을 모두 배운 문제', { dis: !learnedN }) +
      lrow('quiz', 'gwrong:', '틀린 기출만', wrongN ? wrongN + '문항' : '아직 없어요', { dis: !wrongN }) +
      lrow('quiz', 'gmix:', '섞어 풀기', esc(X.title) + ' 관련 기출 중 20문항', { dis: !mine }) + '</div>' +
      '<h3 class="h3">회차별 <span>실전처럼 시간 재고 풀기</span></h3><div class="list">' + sets.map(s => {
        const qs = G.qs.filter(g => g.set === s.id); const lk = qs.filter(g => (g.lk || []).some(l => l[0] === X.id)).length;
        const ex = SS().exams.filter(e => e.set === s.id).slice(-1)[0];
        return lrow('go', 'gset:' + s.id, s.title, qs.length + '문항 · ' + esc(X.title) + ' 연결 ' + lk + '문항' + (ex ? ' · 최근 ' + pct(ex.ok, ex.n) + '%' : ''));
      }).join('') + '</div>';
  }
  h += '<details class="why howto"><summary>기출 PDF 받는 법</summary><ol class="steps">' +
    '<li>국시원 누리집(kuksiwon.or.kr) → 시험정보 → 출제자료(기출문제)에서 ‘간호사’를 찾아 PDF를 받아요.</li>' +
    '<li>PDF를 열고 글자를 길게 눌러 전체 선택 → 복사해요. 한 교시씩 붙여넣는 게 가장 정확해요.</li>' +
    '<li>글자가 선택되지 않는 스캔 PDF는 폰의 글자 인식을 써요: 아이폰은 사진에서 ‘라이브 텍스트’, 안드로이드는 ‘Google 렌즈’ → 텍스트 복사.</li>' +
    '<li>정답표도 같은 방법으로 복사해서 정답 칸에 붙여넣어요.</li>' +
    '<li>그림이 있는 문제는 확인 화면이나 문제 화면에서 사진을 붙일 수 있어요.</li></ol>' +
    '<p class="hint">PDF를 Claude에게 주고 “문항 번호별로 건강사정의 어느 개념과 관련 있는지 목록으로 알려 줘”라고 부탁하면, 그 목록을 보고 연결을 빠르게 고칠 수 있어요.</p></details>' +
    '<p class="note">기출문제는 저작권이 있어요. 이 기기에만 저장되고, 공개 저장소(GitHub)에는 올라가지 않아요. 백업 파일에도 들어가니 다른 사람과 공유하지 마세요.</p></section>';
  return h;
};
function draftTitle(d){ return d.round ? '제' + d.round + '회 ' + d.period + '교시' : (d.period ? d.period + '교시 기출' : '기출'); }
V.gpaste = () => {
  const g = R.t.gp || {};
  return subBar('기출 붙여넣기') + '<section><div class="two"><div><label class="lbl" for="gp-round">회차</label><input id="gp-round" inputmode="numeric" placeholder="예: 66" value="' + esc(g.round || '') + '"></div>' +
    '<div><label class="lbl" for="gp-period">교시</label><select id="gp-period">' + [1, 2, 3].map(n => '<option value="' + n + '"' + (+(g.period || 1) === n ? ' selected' : '') + '>' + n + '교시</option>').join('') + '</select></div></div>' +
    '<label class="lbl" for="gp-q">문제<span>PDF에서 복사한 글자를 그대로 붙여넣으세요</span></label><textarea id="gp-q" rows="10" placeholder="1. 다음 중 …\n① …\n② …">' + esc(g.q || '') + '</textarea>' +
    '<label class="lbl" for="gp-a">정답<span>예: 1 ③ 2 ① … 또는 ③①⑤…</span></label><textarea id="gp-a" rows="4">' + esc(g.a || '') + '</textarea>' +
    (R.t.gpMsg ? '<p class="hint warn-t" role="status">' + esc(R.t.gpMsg) + '</p>' : '') +
    '<button class="btn primary big" data-act="gparse">문제로 나누기</button>' +
    '<p class="hint">과목은 교시와 문항 번호로 짐작해서 붙여요 (확인 화면에서 고칠 수 있어요). 1교시 1–70 성인, 71–105 모성 · 2교시 1–35 아동, 36–70 지역사회, 71–105 정신 · 3교시 1–35 간호관리, 36–65 기본간호, 66–85 법규</p></section>';
};
V.gconfirm = () => {
  const d = S.gdraft; if (!d) return subBar('기출 확인') + '<p class="empty">확인할 기출이 없어요.</p>';
  const f = R.t.gf || 'all'; const more = R.t.gmore || 30;
  const all = d.items.map((it, i) => ({ it, i }));
  const warnN = all.filter(x => itemWarn(x.it)).length, linkN = all.filter(x => x.it.lk.length).length, mineN = all.filter(x => x.it.lk.some(l => l[0] === X.id)).length;
  const list = all.filter(x => f === 'warn' ? itemWarn(x.it) : f === 'mine' ? x.it.lk.some(l => l[0] === X.id) : true);
  const row = x => {
    const it = x.it, i = x.i, w = itemWarn(it);
    return '<div class="gq-row' + (w ? ' warn' : '') + '"><div class="gq-h"><b class="mono">' + it.no + '번</b>' +
      '<select data-gf="sub" data-i="' + i + '" aria-label="과목">' + KSUBJ.map(s => '<option' + (it.sub === s ? ' selected' : '') + '>' + s + '</option>').join('') + '</select>' +
      '<select data-gf="a" data-i="' + i + '" aria-label="정답"><option value="">정답?</option>' + (it.o.length ? it.o : [0, 1, 2, 3, 4]).map((_, k) => '<option value="' + k + '"' + (it.a === k ? ' selected' : '') + '>' + CIRC[k] + '</option>').join('') + '</select></div>' +
      '<p class="gq-q">' + esc(it.q || '(문제 글자 없음)') + '</p>' +
      (it.o.length ? '<details class="gq-o"><summary>보기 ' + it.o.length + '개</summary><ol>' + it.o.map((o, k) => '<li' + (it.a === k ? ' class="is-a"' : '') + '><span class="on">' + CIRC[k] + '</span>' + esc(o) + '</li>').join('') + '</ol></details>' : '') +
      '<div class="gq-lk">' + (it.lk.length ? it.lk.map(l => { const c = cOf(l[0], l[1]); return c ? '<span class="chip c-link">' + esc(c.t) + '</span>' : ''; }).join('') : '<span class="hint">연결된 개념 없음</span>') +
      '<button class="chip-btn" data-act="gpick" data-arg="' + i + '">' + (it.lk.length ? '바꾸기' : '직접 고르기') + '</button></div>' + (w ? '<p class="warn-t">' + esc(w) + '</p>' : '') + '</div>';
  };
  return subBar('기출 확인') + '<section><h1 class="h-sm">' + esc(draftTitle(d)) + '</h1>' +
    '<div class="stats3"><div><b>' + d.items.length + '</b><span>문항</span></div><div><b>' + mineN + '</b><span>' + esc(X.title) + ' 연결</span></div><div><b class="' + (warnN ? 'warn-n' : '') + '">' + warnN + '</b><span>확인 필요</span></div></div>' +
    '<p class="hint">정답과 연결된 개념이 맞는지 확인하세요. 연결은 문제에 나온 낱말로 짐작한 거라 틀릴 수 있어요. 연결된 개념을 모두 배우면 ‘공부한 개념 관련만’에 나와요.</p>' +
    '<div class="seg" role="group"><button data-act="gfilter" data-arg="all" aria-pressed="' + (f === 'all') + '">전체 ' + d.items.length + '</button><button data-act="gfilter" data-arg="mine" aria-pressed="' + (f === 'mine') + '">' + esc(X.title) + ' ' + mineN + '</button><button data-act="gfilter" data-arg="warn" aria-pressed="' + (f === 'warn') + '">확인 필요 ' + warnN + '</button></div>' +
    (list.length ? list.slice(0, more).map(row).join('') : '<p class="empty">해당하는 문항이 없어요.</p>') +
    (list.length > more ? '<button class="btn big" data-act="gmore">더 보기 (' + (list.length - more) + '개 남음)</button>' : '') +
    '<div class="row-btns"><button class="btn primary" data-act="gsave">' + (d.editSet ? '고친 내용 저장' : '기출 저장') + '</button><button class="btn" data-act="gdraftdel">' + (R.t.confirm === 'gdraft' ? '한 번 더 누르면 버려요' : '버리기') + '</button></div>' +
    '<p class="hint">' + (linkN - mineN > 0 ? '다른 과목 개념에 연결된 문항 ' + (linkN - mineN) + '개 포함 · ' : '') + '정답이 없는 문항은 저장되지만 풀기에서는 빠져요.</p></section>';
};
V.gset = p => {
  const s = G.sets.find(x => x.id === p.id); if (!s) return subBar('기출') + '<p class="empty">회차를 찾을 수 없어요.</p>';
  const qs = G.qs.filter(g => g.set === s.id).sort((a, b) => a.no - b.no); const z = SS().qz;
  const resume = z && !z.done && z.set === s.id;
  const exs = SS().exams.filter(e => e.set === s.id).slice(-5).reverse();
  return subBar(s.title) + '<section><p class="sub">' + qs.length + '문항 · 문항당 약 54초(실제 시험 속도) · 해설은 끝나고 한꺼번에</p>' +
    '<div class="row-btns" style="margin-top:0">' + (resume ? '<button class="btn primary" data-act="qresume">이어 풀기 · ' + (z.i + 1) + '/' + z.ids.length + '</button>' : '') +
    '<button class="btn' + (resume ? '' : ' primary') + '" data-act="quiz" data-arg="gset:' + s.id + '">' + (resume ? '처음부터 다시' : '실전처럼 풀기') + '</button>' +
    '<button class="btn" data-act="gedit" data-arg="' + s.id + '">연결 다시 확인</button></div>' +
    (exs.length ? '<h3 class="h3">점수 <span>과락 40% · 합격 60%</span></h3><div class="list">' + exs.map(e => { const d = new Date(e.ts); const pc = pct(e.ok, e.n); return '<div class="exrow"><span class="mono">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span><span>' + e.ok + '/' + e.n + '</span><b class="' + (pc < 40 ? 'low' : pc >= 60 ? 'hi' : '') + '">' + pc + '%</b></div>'; }).join('') + '</div>' : '') +
    '<h3 class="h3">문항 <span>그림이 필요한 문항은 사진을 붙이세요</span></h3><div class="list">' + qs.map(g => {
      const r = S.gq[g.id]; const lk = (g.lk || []).map(l => cOf(l[0], l[1])).filter(Boolean);
      return '<div class="cq"><p><b class="mono">' + g.no + '.</b> ' + esc(g.q.length > 80 ? g.q.slice(0, 80) + '…' : g.q) + '</p><span class="meta">' + esc(g.sub || '') + (lk.length ? ' · ' + lk.map(c => c.t).join(', ') : ' · 연결 없음') + (r ? ' · ' + (r.lastOk ? '맞힘' : '틀림') : '') + (g.a < 0 ? ' · 정답 없음' : '') + '</span>' +
        '<div class="row-btns">' + (g.img ? '<button class="btn" data-act="go" data-arg="imgview:' + g.img + '">' + ICON.image + '그림 보기</button>' : '<label class="btn"><input type="file" accept="image/*" data-pick="g:' + g.id + '" hidden>' + ICON.image + '그림 붙이기</label>') + '<button class="btn" data-act="go" data-arg="qview:' + g.id + '">풀어 보기</button></div></div>';
    }).join('') + '</div>' +
    '<div class="row-btns"><button class="btn" data-act="gdel" data-arg="' + s.id + '">' + (R.t.confirm === 'gdel-' + s.id ? '한 번 더 누르면 삭제돼요' : '이 회차 삭제') + '</button></div></section>';
};
SHEETV.picker = sh => {
  const d = S.gdraft; const it = d && d.items[sh.i]; if (!it) return '<p class="empty">문항을 찾을 수 없어요.</p>';
  const sids = sh.other ? loadedIds() : [X.id];
  const qq = nospace(sh.q || ''); const sel = new Set(it.lk.map(l => l[0] + '|' + l[1]));
  let list = '';
  sids.forEach(sid => {
    const x = SUB[sid];
    x.units.forEach(u => {
      const cs = u.concepts.filter(c => !qq || nospace(c.t).indexOf(qq) >= 0 || (c.kw || []).some(k => nospace(k).indexOf(qq) >= 0) || (c.sum || []).some(s => nospace(s).indexOf(qq) >= 0));
      if (!cs.length) return;
      list += '<div class="pk-u">' + (sids.length > 1 ? esc(x.title) + ' · ' : '') + u.n + '. ' + esc(u.title) + '</div>' + cs.map(c => { const k = sid + '|' + c.id; return '<button class="pk-c' + (sel.has(k) ? ' on' : '') + '" data-act="pktoggle" data-arg="' + esc(k) + '" aria-pressed="' + sel.has(k) + '"><span class="ck">' + (sel.has(k) ? '✓' : '') + '</span>' + esc(c.t) + '</button>'; }).join('');
    });
  });
  return '<div class="sh-head"><div><div class="eyebrow">' + it.no + '번에 연결할 개념 · 최대 4개</div><h3>' + esc((it.q || '').slice(0, 60)) + (it.q.length > 60 ? '…' : '') + '</h3></div><button class="icon-btn" data-act="shclose" aria-label="닫기">' + ICON.close + '</button></div>' +
    '<div class="sh-body"><input id="pk-q" placeholder="개념 이름이나 낱말로 찾기" value="' + esc(sh.q || '') + '" autocomplete="off">' +
    (loadedIds().length > 1 ? '<label class="check"><input type="checkbox" id="pk-other"' + (sh.other ? ' checked' : '') + '> 다른 과목 내용 포함</label>' : '') +
    '<p class="hint">고른 개념 ' + it.lk.length + '개' + (it.lk.length ? ': ' + it.lk.map(l => (cOf(l[0], l[1]) || {}).t).join(', ') : '') + '</p>' +
    '<div class="pk-list">' + (list || '<p class="empty">찾는 개념이 없어요.</p>') + '</div>' +
    '<button class="btn primary big" data-act="shclose">완료</button></div>';
};
function gcopyText(q){
  return '[간호사 국가시험 기출 해설 부탁]\n' + q.setTitle + ' ' + q.no + '번' + (q.sub ? ' (' + q.sub + ')' : '') + '\n\n' + q.q + '\n' + q.o.map((o, i) => CIRC[i] + ' ' + o).join('\n') +
    '\n\n정답: ' + (q.a >= 0 ? CIRC[q.a] : '모름') + '\n\n간호학과 학생이 이해하기 쉽게 설명해 주세요.\n1. 이 문제가 묻는 것(핵심어)\n2. 정답인 이유\n3. 나머지 보기가 틀린 이유\n4. 같이 외워 두면 좋은 관련 개념과 암기법';
}
function copyText(txt, okMsg){
  const fallback = () => {
    const ta = document.createElement('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove(); toast(ok ? okMsg : '자동 복사가 안 돼요. 길게 눌러 직접 복사하세요');
  };
  try { navigator.clipboard.writeText(txt).then(() => toast(okMsg), fallback); } catch (e) { fallback(); }
}

Object.assign(ACT, {
  quiz: a => { const i = a.indexOf(':'); startQuiz(i < 0 ? a : a.slice(0, i), i < 0 ? '' : a.slice(i + 1)); },
  qscope: a => { S.set.qAll = a === '1'; save(); render(); },
  qresume: () => { const z = SS().qz; if (!z) return; z.t0 = Date.now(); R.stack = R.stack.filter(x => x.name !== 'quiz'); go('quiz'); },
  qdrop: () => { const z = SS().qz; if (z) settleQuizCur(z); SS().qz = null; save(); render(); },
  qnext: () => { const z = SS().qz; settleQuizCur(z); if (z.i >= z.ids.length - 1) submitQuiz(); else { z.i++; save(); render(true); } },
  qprev: () => { const z = SS().qz; if (z.i > 0) { z.i--; save(); render(true); } },
  qsubmit: () => { if (R.t.confirm !== 'qsubmit') { R.t.confirm = 'qsubmit'; toast('한 번 더 누르면 제출해요'); return; } R.t.confirm = null; submitQuiz(); },
  qexit: () => { R.stack.pop(); pauseQuiz(); render(true); const z = SS().qz; if (z && !z.done) toast('여기까지 저장했어요. 문제 탭에서 이어 풀 수 있어요'); },
  qdone: () => { SS().qz = null; R.stack.pop(); save(); render(true); },
  pick: a => {
    const parts = a.split(':'), ns = parts[0], i = +parts[1]; const x = nsState(ns); if (!x) return;
    const q = x.q, st = x.st;
    if (ns === 'mk') { st.pick = i; save(); render(); return; }
    if (st.shown) return;
    st.pick = i; st.shown = true; st.ok = i === q.a; recordQ(q, st.ok, st);
    if (ns === 'sq') { const s = SS().ses; s.st.qn++; if (st.ok) s.st.qok++; }
    save(); render();
  },
  hint: a => { const x = nsState(a); if (!x) return; x.st.hint = true; save(); render(); },
  conf: a => {
    const p = a.split(':'); const x = nsState(p[0]); if (!x) return;
    x.st.conf = x.st.conf === p[1] ? null : p[1]; save(); render();
  },
  cpick: a => {
    const i = a.indexOf(':'); const x = nsState(a.slice(0, i)); if (!x) return; const k = a.slice(i + 1);
    const cs = x.st.cs || (x.st.cs = []); const j = cs.indexOf(k); if (j >= 0) cs.splice(j, 1); else cs.push(k); save(); render();
  },
  reason: a => {
    const i = a.indexOf(':'); const x = nsState(a.slice(0, i)); if (!x) return; const r = a.slice(i + 1);
    x.st.reason = x.st.reason === r ? null : r; const rec = qrec(x.q); if (rec) rec.why = x.st.reason; save(); render();
  },
  csheet: a => { const p = a.split('|'); openSheet({ type: 'concept', sid: p[0], cid: p[1], full: false }); },
  csave: () => {
    const q = $('#cq-q').value.trim(); const o = [0, 1, 2, 3, 4].map(i => $('#cq-o' + i).value.trim()).filter(Boolean);
    const a = +$('#cq-a').value;
    if (!q || o.length < 2) { toast('문제와 보기를 2개 이상 써 주세요'); return; }
    if (a >= o.length) { toast('정답 번호가 보기 개수보다 커요'); return; }
    SS().custom.push({ id: uid('x'), q, o, a, e: $('#cq-e').value.trim(), u: $('#cq-u').value, s: $('#cq-s').value.trim() });
    save(); back(); toast('문제를 추가했어요');
  },
  cparse: () => {
    const r = parsePaste($('#cp-txt').value); r.out.forEach(q => SS().custom.push(q)); save();
    R.t.pasteMsg = r.out.length + '문제를 추가했어요.' + (r.errs.length ? ' ' + r.errs.join(', ') + '번째 묶음은 형식이 맞지 않아 건너뛰었어요 (문제, 보기 2개 이상, 정답 번호가 필요해요).' : '');
    render();
  },
  cdel: a => { if (R.t.confirm !== 'del-' + a) { R.t.confirm = 'del-' + a; render(); return; } SS().custom = SS().custom.filter(q => q.id !== a); delete SS().q[a]; R.t.confirm = null; save(); render(); },
  qeA: (a, el) => { R.t.qeA = +a; const g = el && el.closest('.qe-a'); if (g) g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.arg === a))); },
  qesave: a => {
    const q = X.qmap[a]; const b = (X.qbase && X.qbase[a]) || q; if (!q) return;
    const v = id => { const el = $('#' + id); return el ? el.value.trim() : null; };
    const isOX = q.type === 'ox'; const n = { q: v('qe-q') || b.q, a: R.t.qeA != null ? R.t.qeA : b.a, e: v('qe-e') || '' };
    if (!isOX) {
      n.o = b.o.map((o, i) => v('qe-o' + i)); if (n.o.some(o => !o)) { toast('보기를 비워 둘 수 없어요'); return; }
      n.k = v('qe-k') || ''; n.x = b.o.map((o, i) => (v('qe-x' + i) || '')); n.x[n.a] = '';
    }
    const e = {}; Object.keys(n).forEach(k => { if (!same(n[k], k === 'x' ? (b.x || n.x.map(() => '')) : (b[k] == null && (k === 'e' || k === 'k') ? '' : b[k]))) e[k] = n[k]; });
    if (e.a != null && !isOX && !e.x && b.x) e.x = n.x;
    if (Object.keys(e).length) SS().qe[a] = e; else delete SS().qe[a];
    applyLocal(X); R.t.qeId = null; save(); back(); toast(Object.keys(e).length ? '문제를 고쳤어요. 이 기기에서 바로 반영돼요' : '바뀐 내용이 없어요');
  },
  qereset: a => { delete SS().qe[a]; applyLocal(X); R.t.qeId = null; save(); render(); toast('원래 문제로 되돌렸어요'); },
  qehide: a => { const h = SS().qh; if (h[a]) delete h[a]; else h[a] = Date.now(); save(); render(); toast(h[a] ? '이 문제를 뺐어요. 다시 넣을 수도 있어요' : '문제를 다시 넣었어요'); },
  gparse: async () => {
    if (loadedIds().length < ORDER.length) { toast('과목 내용을 불러오는 중이에요…'); await ensureAll(); }
    const round = $('#gp-round').value.trim().replace(/[^0-9]/g, ''), period = +$('#gp-period').value, qt = $('#gp-q').value, at = $('#gp-a').value;
    R.t.gp = { round, period, q: qt, a: at };
    if (qt.trim().length < 20) { R.t.gpMsg = '문제 글자를 붙여넣어 주세요.'; render(); return; }
    const d = gParse(round, period, qt, at);
    if (!d.items.length) { R.t.gpMsg = '문항 번호(1. 2. 3. …)를 찾지 못했어요. PDF에서 복사한 글자를 그대로 붙여넣었는지 확인해 주세요.'; render(); return; }
    S.gdraft = d; R.t.gpMsg = ''; R.t.gp = null; R.t.gf = 'all'; R.t.gmore = 30; save();
    R.stack.pop(); go('gconfirm');
    const noA = d.items.filter(x => x.a == null).length;
    toast(d.items.length + '문항으로 나눴어요' + (noA ? ' · 정답 없는 문항 ' + noA + '개' : ''));
  },
  gfilter: a => { R.t.gf = a; R.t.gmore = 30; render(); },
  gmore: () => { R.t.gmore = (R.t.gmore || 30) + 30; render(); },
  gpick: a => openSheet({ type: 'picker', i: +a, q: '', other: false }),
  pktoggle: a => {
    const d = S.gdraft; const it = d.items[R.sheet.i]; const p = a.split('|');
    const j = it.lk.findIndex(l => l[0] === p[0] && l[1] === p[1]);
    if (j >= 0) it.lk.splice(j, 1); else { if (it.lk.length >= 4) { toast('최대 4개까지 연결할 수 있어요'); return; } it.lk.push([p[0], p[1]]); }
    save(); renderSheet(); render();
  },
  gsave: () => {
    const d = S.gdraft; if (!d) return;
    const title = draftTitle(d);
    if (d.editSet) {
      d.items.forEach(it => { const g = G.qs.find(x => x.id === it.gid); if (g) { g.a = it.a == null ? -1 : it.a; g.sub = it.sub; g.lk = it.lk; } });
    } else {
      const id = uid('gs');
      G.sets.push({ id, round: d.round, period: d.period, title, ts: Date.now(), n: d.items.length });
      d.items.forEach(it => G.qs.push({ id: uid('g'), set: id, no: it.no, q: it.q, o: it.o, a: it.a == null ? -1 : it.a, sub: it.sub, lk: it.lk, my: '', img: null }));
    }
    if (!saveG()) return;
    S.gdraft = null; save(); R.stack.pop(); render(true); toast(title + ' 기출을 저장했어요');
  },
  gdraftdel: () => { if (R.t.confirm !== 'gdraft') { R.t.confirm = 'gdraft'; render(); return; } S.gdraft = null; R.t.confirm = null; save(); R.stack.pop(); render(true); },
  gedit: a => {
    const s = G.sets.find(x => x.id === a); const qs = G.qs.filter(g => g.set === a).sort((x, y) => x.no - y.no);
    S.gdraft = { editSet: a, round: s.round, period: s.period, items: qs.map(g => ({ gid: g.id, no: g.no, q: g.q, o: g.o, a: g.a >= 0 ? g.a : null, sub: g.sub, lk: (g.lk || []).slice() })) };
    R.t.gf = 'all'; R.t.gmore = 30; save(); go('gconfirm');
  },
  gdel: a => {
    if (R.t.confirm !== 'gdel-' + a) { R.t.confirm = 'gdel-' + a; render(); return; }
    const ids = G.qs.filter(g => g.set === a).map(g => g.id);
    ids.forEach(id => { delete S.gq[id]; });
    IMG.meta.filter(m => m.sid === 'gichul' && ids.includes(m.cid)).forEach(m => imgDel(m.id).catch(() => {}));
    G.qs = G.qs.filter(g => g.set !== a); G.sets = G.sets.filter(s => s.id !== a);
    saveG(); R.t.confirm = null; save(); R.stack.pop(); render(true); toast('회차를 삭제했어요');
  },
  gmy: a => { const g = G.qs.find(x => x.id === a); const ta = $('#my-' + a); if (!g || !ta) return; g.my = ta.value.trim(); saveG(); toast('내 해설을 저장했어요'); },
  gcopy: a => { const q = Q(a); if (q) copyText(gcopyText(q), '복사했어요. Claude에 붙여넣으세요'); }
});

/* ───────── 암기노트: 한 장 요약지 ───────── */
const RANGE_LABEL = { all: '전체', learned: '배운 것만', weak: '약한 것만', scope: '공부 범위', top: '★★★만', top2: '★★ 이상' };
function XL(k){ return (X[k] || []).filter(addVisible); }
function sheetConcepts(){
  const r = S.set.noteRange; const weak = weakSet();
  const sc = r === 'scope' ? new Set(scopeIds() || X.concepts.map(c => c.id)) : null;
  return X.concepts.filter(addVisible).filter(c => r === 'all' ? true : r === 'learned' ? isLearned(c.id) : r === 'scope' ? sc.has(c.id) : r === 'top' ? c.pr === 3 : r === 'top2' ? c.pr >= 2 : weak.has(c.id)).map(c => ({ c: C(c.id), weak: weak.has(c.id) }));
}
function sheetItem(c, weak, mode){
  const m = mnList(c)[0];
  let h = '<div class="ni' + (weak ? ' weak' : '') + '" data-act="nsheet" data-arg="' + c.id + '"><div class="ni-t">' + (weak ? '<i>!</i>' : '') + '<span class="ns">' + '★'.repeat(c.pr || 2) + '</span>' + esc(c.t) + (isAdd(c) ? '<span class="na">추가</span>' : '') + '</div>';
  if (m) h += '<div class="ni-m">' + (m.k ? '<b class="ni-k">' + esc(m.k) + '</b> ' : '') + bold(m.s) + '</div>';
  if (mode === 'sum') {
    if (m && m.map && m.map.length) h += '<div class="ni-map">' + m.map.map(p => esc(p[0]) + '=' + esc(p[1])).join(' · ') + '</div>';
    h += '<ul class="ni-s">' + (c.sum || []).map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>';
  } else if (c.sum && c.sum[0]) h += '<div class="ni-1">' + esc(c.sum[0]) + '</div>';
  return h + '</div>';
}
function sheetBlocks(){
  const list = sheetConcepts(); const mode = S.set.noteMode; const blocks = []; const units = new Set();
  X.units.forEach(u => {
    const items = list.filter(x => x.c.u === u.id); if (!items.length) return;
    units.add(u.id);
    blocks.push('<div class="nu">' + u.n + '. ' + esc(u.title) + '</div>');
    items.forEach(x => blocks.push(sheetItem(x.c, x.weak, mode)));
  });
  const nums = XL('numbers').filter(n => units.has(n.u));
  if (nums.length) { blocks.push('<div class="nh">숫자 기준값</div>'); nums.forEach(n => blocks.push('<div class="nn"><span>' + esc(n.k) + '</span><b>' + esc(n.v) + '</b></div>')); }
  const prs = XL('pairs').filter(p => units.has(p.u));
  if (prs.length) { blocks.push('<div class="nh">헷갈리는 쌍</div>'); prs.forEach(p => blocks.push('<div class="np"><i>' + esc(p.t) + '</i><span>' + esc(p.a) + '</span><span>' + esc(p.b) + '</span></div>')); }
  return { blocks, n: list.length };
}
function sheetKey(){
  const s = SS();
  return JSON.stringify([X.id, S.set.noteRange, S.set.noteMode, hash(JSON.stringify(s.edits)), hash(JSON.stringify(s.mine)), hash(JSON.stringify(s.mnr)),
    S.set.noteRange === 'all' ? 0 : X.concepts.filter(c => isLearned(c.id)).length, (SS().scope || []).join(','), Array.from(weakSet()).join(','), addOff(), X.concepts.map(c => c.id + c.pr + c.t).join('|')]);
}
function paginate(blocks, head){
  let M = $('#measure'); if (!M) { M = document.createElement('div'); M.id = 'measure'; document.body.appendChild(M); }
  M.innerHTML = '';
  const pages = [];
  const mk = () => { const el = document.createElement('div'); el.className = 'a4'; el.innerHTML = '<div class="a4-h">' + head + '</div><div class="a4-b"></div><div class="a4-f"></div>'; M.appendChild(el); return el; };
  let pg = mk(), body = pg.querySelector('.a4-b');
  const over = () => body.scrollWidth > body.clientWidth + 1;
  for (const b of blocks) {
    body.insertAdjacentHTML('beforeend', b);
    if (over()) {
      const last = body.lastElementChild; last.remove();
      if (!body.children.length) { body.appendChild(last); continue; }
      const carry = [last]; const prev = body.lastElementChild;
      if (prev && (prev.classList.contains('nu') || prev.classList.contains('nh')) && body.children.length > 1) { prev.remove(); carry.unshift(prev); }
      pages.push(pg); pg = mk(); body = pg.querySelector('.a4-b'); carry.forEach(n => body.appendChild(n));
    }
  }
  pages.push(pg);
  const N = pages.length; pages.forEach((p, i) => { p.querySelector('.a4-f').textContent = (i + 1) + ' / ' + N; });
  const html = pages.map(p => p.outerHTML); M.innerHTML = '';
  return html;
}
function buildSheet(){
  const wrap = $('#a4wrap'); if (!wrap) return;
  const key = sheetKey();
  if (!R.sheetCache || R.sheetCache.key !== key) {
    const b = sheetBlocks();
    const d = new Date();
    const head = '<b>' + esc(X.title) + ' 암기노트</b><span>' + RANGE_LABEL[S.set.noteRange] + ' · ' + (S.set.noteMode === 'sum' ? '요약 포함' : '암기용') + ' · 개념 ' + b.n + '개 · ★★★ 자주 출제 ★★ 중요 ★ 기본 · ' + d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate() + '</span>';
    R.sheetCache = { key, pages: b.n ? paginate(b.blocks, head) : [], n: b.n };
    R.pdf = null;
  }
  showSheet();
}
function showSheet(){
  const wrap = $('#a4wrap'); if (!wrap || !R.sheetCache) return;
  const pages = R.sheetCache.pages; const info = $('#npages');
  if (info) info.textContent = '개념 ' + R.sheetCache.n + '개 · A4 ' + pages.length + '쪽';
  if (!pages.length) { wrap.innerHTML = '<p class="empty">' + (S.set.noteRange === 'learned' ? '아직 배운 개념이 없어요. 공부 탭에서 먼저 배워요.' : '약한 개념이 아직 없어요. 문제를 풀면 자주 틀리는 개념이 여기에 모여요.') + '</p>'; return; }
  const big = S.set.noteZoom === 'big';
  const W = Math.max(280, wrap.clientWidth); const s = big ? 1 : W / 794;
  wrap.innerHTML = pages.map(p => '<div class="a4-slot" style="width:' + Math.floor(794 * s) + 'px;height:' + Math.ceil(1123 * s) + 'px"><div class="a4-sc" style="transform:scale(' + s.toFixed(4) + ')">' + p + '</div></div>').join('');
}
function pdfBox(){
  const p = R.pdf;
  if (!p) return '<button class="btn primary big" data-act="pdfmake">' + ICON.pdf + 'PDF로 저장 · 보내기</button>';
  if (p.busy) return '<div class="pdfbox"><span class="spin" aria-hidden="true"></span><span id="pdfprog">PDF 만드는 중… ' + p.done + ' / ' + p.n + '쪽</span></div>';
  return '<div class="pdfbox ready"><div><b>PDF 준비됐어요</b><span class="meta">' + esc(p.name) + ' · ' + mb(p.size) + '</span></div><div class="row-btns">' +
    (canShareFiles() ? '<button class="btn primary" data-act="pdfshare">' + ICON.share + '보내기 (카카오톡·메일)</button>' : '') +
    '<button class="btn' + (canShareFiles() ? '' : ' primary') + '" data-act="pdfsave">' + ICON.save + '파일로 저장</button><button class="btn ghost" data-act="pdfclose">닫기</button></div>' +
    (canShareFiles() ? '' : '<p class="hint">이 화면에서는 바로 보내기가 안 돼요. 파일로 저장한 뒤 카카오톡이나 메일에 첨부하세요.</p>') + '</div>';
}
function sheetUI(){
  if (S.set.noteRange === 'scope' && !scopeIds()) S.set.noteRange = 'all';
  const r = S.set.noteRange, m = S.set.noteMode, z = S.set.noteZoom;
  const seg = (act, cur, opts) => '<div class="seg sm" role="group">' + opts.map(o => '<button data-act="' + act + '" data-arg="' + o[0] + '" aria-pressed="' + (cur === o[0]) + '">' + o[1] + '</button>').join('') + '</div>';
  const ro = [['all', '전체'], ['top', '★★★만'], ['top2', '★★ 이상'], ['learned', '배운 것만'], ['weak', '약한 것만']]; if (scopeIds()) ro.splice(1, 0, ['scope', '공부 범위']);
  return '<div class="ctl"><span class="ctl-l">범위</span>' + seg('nrange', r, ro) + '</div>' +
    '<div class="ctl"><span class="ctl-l">내용</span>' + seg('nmode', m, [['mn', '암기용만'], ['sum', '요약 포함']]) + '</div>' +
    '<div class="ctl"><span class="ctl-l">보기</span>' + seg('nzoom', z, [['fit', '한눈에'], ['big', '크게 읽기']]) + '</div>' +
    '<p class="hint"><span id="npages">요약지 만드는 중…</span> · 항목을 누르면 요약 → 전체 설명이 열려요. 제목 앞 ★은 시험 중요도, 약한 개념은 분홍 바탕에 ! 표시예요.</p>' +
    '<div id="pdfarea">' + pdfBox() + '</div>' +
    '<div id="a4wrap" class="a4wrap' + (z === 'big' ? ' big' : '') + '"></div>';
}
function toolsUI(){
  const fm = figMastery(X.id); const imgsN = IMG.meta.filter(m => m.sid === X.id).length; const todo = figTodoList().length;
  const acroN = acroList().length;
  return '<div class="list">' +
    lrow('go', 'figprac:', '그림 연습', imgsN ? '그림 ' + imgsN + '장 · 위치 ' + fm.n + '곳 중 ' + fm.ok + '곳 마스터' : '내 그림에 번호를 찍으면 위치 문제로 연습해요') +
    lrow('acro', '', '머리글자 퀴즈', acroN ? '배운 개념 ' + acroN + '개 · 첫 글자만 보고 뜻 떠올리기' : '개념을 배우면 열려요', { dis: !acroN }) +
    lrow('go', 'tables:', '빈칸 표', XL('tables').length + '개 · 칸을 가리고 떠올리기') +
    lrow('go', 'orders:', '순서 맞추기', XL('orders').length + '개 · 순서를 손으로 익히기') +
    lrow('go', 'pairs:', '헷갈리는 쌍', XL('pairs').length + '개 · 오른쪽을 가리고 떠올리기') +
    lrow('go', 'numbers:', '숫자 기준값', XL('numbers').length + '개 · 시험 직전용') +
    lrow('go', 'listen:', '듣기 모드', '이동 중에 귀로 복습') +
    lrow('go', 'figtodo:', '그림 넣을 개념', figConcepts().length + '개' + (todo ? ' · 나중에 넣기로 한 것 ' + todo + '개' : '')) + '</div>' +
    '<h3 class="h3">복습 카드 연습 <span>단원을 골라요 · 복습 일정은 바뀌지 않아요</span></h3><div class="chips-wrap">' + X.units.map(u => '<button class="chip-btn" data-act="start" data-arg="practice:' + u.id + '">' + u.n + '. ' + esc(u.short || u.title) + '</button>').join('') + '</div>' +
    '<div class="tile" style="margin-top:14px"><div><b>복습할 카드 전부</b><span>' + (dueList().length ? '지금 ' + dueList().length + '장' : '지금 복습할 카드가 없어요') + '</span></div><button class="btn" data-act="start" data-arg="review"' + (dueList().length ? '' : ' disabled') + '>시작</button></div>';
}
function vNote(){
  const view = S.set.noteView;
  return subjTop() + '<section><h1>암기노트</h1><div class="seg" role="group"><button data-act="nview" data-arg="sheet" aria-pressed="' + (view === 'sheet') + '">한 장 요약지</button><button data-act="nview" data-arg="tools" aria-pressed="' + (view !== 'sheet') + '">연습 도구</button></div>' +
    (view === 'sheet' ? sheetUI() : toolsUI()) + '</section>';
}

/* PDF 만들기: 화면의 요약지를 A4 그림으로 바꿔 PDF로 묶어요 (처음 한 번 인터넷 필요) */
const LIB = { h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js' };
function loadLib(url, test){
  return new Promise((res, rej) => {
    if (test()) return res();
    const s = document.createElement('script'); s.src = url; s.crossOrigin = 'anonymous';
    s.onload = () => test() ? res() : rej(new Error('lib')); s.onerror = () => rej(new Error('lib'));
    document.head.appendChild(s);
  });
}
function canShareFiles(){ try { return !!(navigator.canShare && navigator.share && navigator.canShare({ files: [new File(['x'], 'a.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; } }
async function makePDF(){
  if (R.pdf && R.pdf.busy) return;
  if (!R.sheetCache || !R.sheetCache.pages.length) { toast('요약지에 담을 개념이 없어요'); return; }
  const pages = R.sheetCache.pages.slice(); const sid = X.id; const name = X.title + '-암기노트-' + dkey(Date.now()) + '.pdf';
  R.pdf = { busy: true, done: 0, n: pages.length }; const area = $('#pdfarea'); if (area) area.innerHTML = pdfBox();
  let holder = null;
  try {
    await loadLib(LIB.h2c, () => window.html2canvas);
    await loadLib(LIB.jspdf, () => window.jspdf && window.jspdf.jsPDF);
    try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
    holder = document.createElement('div'); holder.className = 'pdf-holder'; document.body.appendChild(holder);
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    for (let i = 0; i < pages.length; i++) {
      holder.innerHTML = pages[i]; const el = holder.firstElementChild;
      const cv = await window.html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, width: 794, height: 1123, windowWidth: 900 });
      if (i) pdf.addPage();
      pdf.addImage(cv.toDataURL('image/jpeg', 0.88), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      R.pdf.done = i + 1; const pg = $('#pdfprog'); if (pg) pg.textContent = 'PDF 만드는 중… ' + (i + 1) + ' / ' + pages.length + '쪽';
    }
    const blob = pdf.output('blob');
    R.pdf = { blob, name, size: blob.size };
  } catch (e) { R.pdf = null; toast('PDF 도구를 불러오지 못했어요. 인터넷에 연결된 상태에서 다시 눌러 주세요'); }
  if (holder) holder.remove();
  if (R.sid === sid) { const a = $('#pdfarea'); if (a) a.innerHTML = pdfBox(); }
}
async function saveFile(name, data, mime){
  const viewer = window.claude && typeof window.claude.use === 'function';
  if (viewer) {
    let dl = null; try { dl = await window.claude.use('downloads'); } catch (e) {}
    if (dl) {
      try { await dl.save({ filename: name, data }); return true; }
      catch (err) { const c = err && err.code; toast(c === 'declined' ? '저장을 취소했어요' : c === 'rate_limited' ? '잠시 뒤 다시 눌러 주세요' : '이 화면에서는 파일 저장이 안 돼요'); return false; }
    }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000); return true;
  } catch (e) { toast('이 화면에서는 파일 저장이 안 돼요'); return false; }
}

/* ───────── 연습 도구 ───────── */
V.tables = () => subBar('빈칸 표') + '<section><p class="sub">칸을 가리고 떠올려요. 틀린 칸은 빨간 펜으로 표시해 두고 다시 연습해요.</p><div class="list">' +
  XL('tables').map(t => lrow('go', 'table:' + t.id, t.title, X.umap[t.u].n + '단원 · ' + t.rows.length + '줄' + ((SS().tbl[t.id] || []).length ? ' · 틀린 칸 ' + SS().tbl[t.id].length : ''), { tag: isAdd(t) ? ADD_TAG : '' })).join('') + '</div></section>';
V.orders = () => subBar('순서 맞추기') + '<section><p class="sub">순서가 중요한 것들이에요. 첫 번째부터 차례대로 탭해요.</p><div class="list">' +
  XL('orders').map(o => lrow('go', 'order:' + o.id, o.title, (X.umap[o.u] ? X.umap[o.u].n + '단원 · ' : '') + o.items.length + '단계' + (SS().ord[o.id] ? ' · 최근 실수 ' + SS().ord[o.id].miss + '번' : ''), { tag: isAdd(o) ? ADD_TAG : '' })).join('') + '</div></section>';
V.table = p => {
  const t = X.tables.find(x => x.id === p.id); if (!t) return subBar('빈칸 표') + '<p class="empty">표를 찾을 수 없어요.</p>';
  const mode = R.t.tmode || 'hide';
  const wrong = new Set(SS().tbl[t.id] || []); const rev = R.t.trev || (R.t.trev = {});
  const cell = (r, ci, v) => {
    const k = r + '-' + ci; const open = !!rev[t.id + '|' + k];
    const hidden = mode === 'show' ? false : mode === 'wrong' ? (wrong.has(k) && !open) : !open;
    if (hidden) return '<td><button class="cell-hide" data-act="cell" data-arg="' + t.id + '|' + k + '" aria-label="가려진 칸 보기">?</button></td>';
    return '<td class="' + (wrong.has(k) ? 'cell-wrong' : '') + '"><button class="cell-show" data-act="cellmark" data-arg="' + t.id + '|' + k + '">' + esc(v) + '</button></td>';
  };
  const modes = [['hide', '모두 가리기'], ['wrong', '틀린 칸만'], ['show', '모두 보기']];
  return subBar('빈칸 표') + '<section><h1 class="h-sm">' + esc(t.title) + '</h1><p class="sub">? 칸을 탭하면 답이 보여요. 떠올린 답이 틀렸으면 그 칸을 한 번 더 탭해서 빨간 펜으로 표시하세요.</p>' +
    '<div class="seg" role="group">' + modes.map(m => '<button data-act="tmode" data-arg="' + m[0] + '" aria-pressed="' + (mode === m[0]) + '">' + m[1] + '</button>').join('') + '</div>' +
    '<div class="tscroll"><table class="tq"><thead><tr>' + t.head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
    t.rows.map((row, r) => '<tr>' + row.map((v, ci) => ci === 0 ? '<td>' + esc(v) + '</td>' : cell(r, ci, v)).join('') + '</tr>').join('') + '</tbody></table></div>' +
    '<p class="hint">틀린 칸 ' + wrong.size + '개' + (wrong.size ? ' · ‘틀린 칸만’으로 다시 연습하세요' : '') + '</p>' +
    (wrong.size ? '<div class="row-btns"><button class="btn" data-act="tclear" data-arg="' + t.id + '">빨간 펜 표시 지우기</button></div>' : '') + '</section>';
};
V.order = p => {
  const o = X.orders.find(x => x.id === p.id); if (!o) return subBar('순서 맞추기') + '<p class="empty">찾을 수 없어요.</p>';
  let g = R.t.og;
  if (!g || g.id !== o.id) { let pool = shuffle(o.items.map((x, i) => i)); if (pool.every((x, i) => x === i)) pool = pool.reverse(); g = R.t.og = { id: o.id, pool, done: [], miss: 0, bad: null }; }
  const fin = g.done.length === o.items.length;
  const hint = o.hint ? memoHTML([{ k: '암기 요령', s: o.hint }]) : '';
  return subBar('순서 맞추기') + '<section><h1 class="h-sm">' + esc(o.title) + '</h1><p class="sub">' + (fin ? '완성했어요.' : '첫 번째부터 차례대로 탭하세요.') + '</p>' +
    '<ol class="ord-done">' + g.done.map(i => '<li><span class="mono">' + (i + 1) + '</span>' + esc(o.items[i]) + '</li>').join('') + (fin ? '' : '<li class="ph"><span class="mono">' + (g.done.length + 1) + '</span>다음은?</li>') + '</ol>' +
    (fin ? '<div class="fb ' + (g.miss ? 'ng' : 'ok') + '"><b>' + (g.miss ? '완성! 실수 ' + g.miss + '번' : '한 번에 완성!') + '</b></div>' + hint + '<div class="row-btns"><button class="btn primary" data-act="oreset">다시 하기</button><button class="btn" data-act="back">목록으로</button></div>'
      : '<div class="ord-pool">' + g.pool.filter(i => !g.done.includes(i)).map(i => '<button class="ochip' + (g.bad === i ? ' bad' : '') + '" data-act="opick" data-arg="' + i + '">' + esc(o.items[i]) + '</button>').join('') + '</div>' + (o.hint ? '<details class="why" style="margin-top:18px"><summary>막히면 힌트</summary>' + hint + '</details>' : '')) + '</section>';
};
V.pairs = () => {
  const hideAll = R.t.pairHide !== false; const rev = R.t.prev || (R.t.prev = {});
  return subBar('헷갈리는 쌍') + '<section><p class="sub">왼쪽을 보고 짝을 먼저 떠올린 다음, 탭해서 확인하세요.</p>' +
    '<div class="seg" role="group"><button data-act="pairall" data-arg="hide" aria-pressed="' + hideAll + '">짝 가리기</button><button data-act="pairall" data-arg="show" aria-pressed="' + !hideAll + '">모두 보기</button></div>' +
    '<div class="pairs">' + XL('pairs').map((x, i) => { const show = !hideAll || rev[i];
      return '<div class="pair"><b>' + X.umap[x.u].n + '단원 · ' + esc(x.t) + (isAdd(x) ? ADD_TAG : '') + '</b><div class="pa">' + esc(x.a) + '</div><button class="pb' + (show ? '' : ' hid') + '" data-act="pairrev" data-arg="' + i + '">' + (show ? esc(x.b) : '탭해서 짝 확인') + '</button></div>'; }).join('') + '</div></section>';
};
V.numbers = () => {
  const hideAll = R.t.numHide !== false; const rev = R.t.nrev || (R.t.nrev = {});
  return subBar('숫자 기준값') + '<section><p class="sub">시험 직전에 보는 숫자 모음이에요. 값을 가리고 떠올려 보세요.</p>' +
    '<div class="seg" role="group"><button data-act="numall" data-arg="hide" aria-pressed="' + hideAll + '">값 가리기</button><button data-act="numall" data-arg="show" aria-pressed="' + !hideAll + '">모두 보기</button></div>' +
    '<div class="list">' + XL('numbers').map((x, i) => { const show = !hideAll || rev[i];
      return '<div class="nrow"><span>' + esc(x.k) + (isAdd(x) ? ADD_TAG : '') + '</span><button class="pb' + (show ? '' : ' hid') + '" data-act="numrev" data-arg="' + i + '">' + (show ? esc(x.v) : '?') + '</button></div>'; }).join('') + '</div></section>';
};
/* 머리글자 퀴즈 */
function acroList(){ return CS().filter(c => isLearned(c.id) && mnList(C(c.id)).some(m => m.map && m.map.length)); }
V.acro = () => {
  const a = R.t.ac; if (!a) return V.tables();
  const n = a.list.length;
  if (a.i >= n) return '<div>' + fullBar('<div class="pbar"><i style="width:100%"></i></div>') + '<div class="done-card"><div class="eyebrow">머리글자 퀴즈</div><h2>' + a.ok + ' / ' + (a.ok + a.ng) + '</h2><p>' + (a.ng ? '몰랐던 머리글자는 공부할 때 다시 나와요.' : '모두 알고 있어요!') + '</p><div class="row-btns"><button class="btn primary" data-act="acro">한 번 더</button><button class="btn" data-act="back">닫기</button></div></div></div>';
  const c = C(a.list[a.i]); const m = mnList(c).find(x => x.map && x.map.length);
  return '<div>' + fullBar('<div class="pbar"><i style="width:' + pct(a.i, n) + '%"></i></div><span class="mono ses-n">' + (a.i + 1) + '/' + n + '</span>') +
    '<div class="ses-tag">머리글자 퀴즈</div><article class="flash paper"><div class="flash-meta">' + esc(c.t) + '</div><div class="flash-front acro">' + esc(m.k) + '</div>' +
    (a.rev ? mnHTML(m, {}) : '<div class="think" aria-hidden="true"><i></i></div><p class="hint center">각 글자가 무엇의 첫 글자인지 소리 내어 말해 보세요</p>') + '</article>' +
    (a.rev ? '<div class="grade two"><button class="g g0" data-act="acgrade" data-arg="0">몰랐음<small>조금 뒤 다시</small></button><button class="g g2" data-act="acgrade" data-arg="2">알았음<small>다음으로</small></button></div>'
      : '<button class="btn primary big" id="reveal" data-act="acrev" disabled>답 보기 <span class="mono" id="cd">3</span></button>') + '</div>';
};
/* 듣기 모드 */
V.listen = () => {
  const L = R.t.listen || (R.t.listen = { u: 'learned' });
  const ok = 'speechSynthesis' in window;
  return subBar('듣기 모드') + '<section><p class="sub">카드 앞면을 읽어 주고, 3초 뒤 답을 읽어 줘요. 듣기만 하지 말고 3초 안에 답을 떠올려 보세요.</p>' +
    '<div class="chips-wrap"><button class="chip-btn' + (L.u === 'learned' ? ' on' : '') + '" data-act="lsel" data-arg="learned">배운 개념 전체</button>' + X.units.map(u => '<button class="chip-btn' + (L.u === u.id ? ' on' : '') + '" data-act="lsel" data-arg="' + u.id + '">' + u.n + '단원</button>').join('') + '</div>' +
    '<div class="listen-box" style="margin-top:14px">' + (L.now ? '<span class="hint">' + esc(L.now.c) + '</span><div class="lf">' + esc(L.now.f) + '</div>' + (L.now.b ? '<div class="lb">' + esc(L.now.b) + '</div>' : '<div class="hint">떠올려 보세요…</div>') : '<div class="hint">' + (ok ? '시작을 누르면 읽기 시작해요. 이어폰을 쓰면 더 좋아요.' : '이 기기에서는 음성 읽기를 쓸 수 없어요.') + '</div>') + '</div>' +
    '<button class="btn primary big" data-act="' + (L.playing ? 'lstop' : 'lplay') + '"' + (ok ? '' : ' disabled') + '>' + (L.playing ? '멈추기' : '듣기 시작') + '</button></section>';
};
function wait(ms){ return new Promise(r => setTimeout(r, ms)); }
function say(t){
  return new Promise(res => {
    try {
      if (!('speechSynthesis' in window)) return res();
      const u = new SpeechSynthesisUtterance(plain(t)); u.lang = 'ko-KR'; u.rate = 0.95;
      let done = false; const fin = () => { if (!done) { done = true; res(); } };
      u.onend = fin; u.onerror = fin; speechSynthesis.speak(u); setTimeout(fin, 12000 + t.length * 120);
    } catch (e) { res(); }
  });
}
function stopListen(){ const L = R.t.listen; if (L) { L.token = null; L.playing = false; L.now = null; } try { speechSynthesis.cancel(); } catch (e) {} }
async function runListen(){
  const L = R.t.listen; const token = L.token = Math.random();
  const list = L.u === 'learned' ? CS().filter(c => isLearned(c.id)) : (UC(X.umap[L.u]).length ? UC(X.umap[L.u]) : X.umap[L.u].concepts);
  if (!list.length) { toast('먼저 개념을 배워야 들을 수 있어요'); return; }
  L.playing = true; render();
  const here = () => cur() && cur().name === 'listen';
  for (const c0 of list) {
    const c = C(c0.id);
    const cards = (c.cards || []).length ? c.cards : [[c.t, (c.sum || []).join('. ')]];
    for (const card of cards) {
      if (L.token !== token) return;
      L.now = { c: c.t, f: card[0], b: '' }; if (here()) render();
      await say(card[0]); if (L.token !== token) return;
      await wait(3000); if (L.token !== token) return;
      L.now.b = card[1]; if (here()) render();
      await say(card[1]); await wait(1200);
    }
  }
  if (L.token === token) { L.playing = false; L.now = null; if (here()) render(); }
}

Object.assign(ACT, {
  nview: a => { S.set.noteView = a; save(); render(); },
  nrange: a => { S.set.noteRange = a; save(); render(); },
  nmode: a => { S.set.noteMode = a; save(); render(); },
  nzoom: a => { S.set.noteZoom = a; save(); render(); },
  nsheet: a => openSheet({ type: 'concept', sid: X.id, cid: a, full: false }),
  pdfmake: () => makePDF(),
  pdfclose: () => { R.pdf = null; const a = $('#pdfarea'); if (a) a.innerHTML = pdfBox(); },
  pdfsave: async () => { if (R.pdf && R.pdf.blob) { const ok = await saveFile(R.pdf.name, R.pdf.blob, 'application/pdf'); if (ok) toast('PDF를 저장했어요'); } },
  pdfshare: async () => {
    if (!R.pdf || !R.pdf.blob) return;
    const f = new File([R.pdf.blob], R.pdf.name, { type: 'application/pdf' });
    try { await navigator.share({ files: [f], title: R.pdf.name }); }
    catch (e) { if (!e || e.name !== 'AbortError') toast('보내지 못했어요. ‘파일로 저장’을 써 보세요'); }
  },
  tmode: a => { R.t.tmode = a; R.t.trev = {}; render(); },
  cell: a => { (R.t.trev || (R.t.trev = {}))[a] = true; render(); },
  cellmark: a => { const p = a.split('|'), id = p[0], k = p[1]; const set = new Set(SS().tbl[id] || []); if (set.has(k)) set.delete(k); else set.add(k); SS().tbl[id] = Array.from(set); save(); render(); },
  tclear: a => { SS().tbl[a] = []; save(); render(); },
  opick: a => {
    const g = R.t.og, i = +a; const o = X.orders.find(x => x.id === g.id);
    if (i === g.done.length) { g.done.push(i); g.bad = null; if (g.done.length === o.items.length) { SS().ord[o.id] = { miss: g.miss, ts: Date.now() }; save(); } }
    else { g.miss++; g.bad = i; }
    render();
  },
  oreset: () => { R.t.og = null; render(); },
  pairall: a => { R.t.pairHide = a === 'hide'; R.t.prev = {}; render(); },
  pairrev: a => { const r = R.t.prev || (R.t.prev = {}); r[a] = !r[a]; render(); },
  numall: a => { R.t.numHide = a === 'hide'; R.t.nrev = {}; render(); },
  numrev: a => { const r = R.t.nrev || (R.t.nrev = {}); r[a] = !r[a]; render(); },
  acro: () => {
    const list = shuffle(acroList().map(c => c.id)).slice(0, 12);
    if (!list.length) { toast('머리글자가 있는 개념을 먼저 배워요'); return; }
    R.t.ac = { list, i: 0, ok: 0, ng: 0, rev: false, rq: {} };
    R.stack = R.stack.filter(x => x.name !== 'acro'); go('acro');
  },
  acrev: () => { R.t.ac.rev = true; render(); },
  acgrade: a => {
    const A = R.t.ac; const cid = A.list[A.i];
    if (a === '2') A.ok++; else { A.ng++; const x = crec(cid); if (x && x.learned) x.due = Math.min(x.due, sod(Date.now()) + DAY); A.rq[cid] = (A.rq[cid] || 0) + 1; if (A.rq[cid] <= 1) A.list.splice(Math.min(A.i + 3, A.list.length), 0, cid); }
    logInc('cards'); A.i++; A.rev = false; save(); render(true);
  },
  lsel: a => { stopListen(); R.t.listen = { u: a }; render(); },
  lplay: () => { try { speechSynthesis.cancel(); } catch (e) {} runListen(); },
  lstop: () => { stopListen(); render(); }
});

/* ───────── 내 그림 ───────── */
function figConcepts(){ return CS().filter(c => c.fig); }
function figTodoList(){ return Object.keys(SS().figTodo).filter(cid => X.cmap[cid] && !imgsOf(X.id, cid).length); }
function parseTarget(t){ const p = String(t).split(':'); return p[0] === 'g' ? { sid: 'gichul', cid: p[1], gq: p[1] } : { sid: p[1], cid: p[2] }; }
function ownerTitle(m){
  if (m.sid === 'gichul') { const g = G.qs.find(x => x.id === m.cid); return g ? setTitle(g.set) + ' ' + g.no + '번 문제 그림' : '기출 문제 그림'; }
  const c = cOf(m.sid, m.cid); return c ? c.t : '내 그림';
}
function addImgButtons(target, query){
  if (!IMG.ok) return '<p class="notice">이 브라우저에서는 그림을 저장할 수 없어요. 홈 화면에 설치한 앱이나 크롬·사파리에서 열어 주세요.</p>';
  const gurl = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query || '');
  return '<div class="img-add"><div class="gq-line"><input id="gq-in" value="' + esc(query || '') + '" aria-label="구글 검색어"><a class="btn" id="gq-a" href="' + esc(gurl) + '" target="_blank" rel="noopener" data-act="googled" data-arg="' + esc(target) + '">' + ICON.search + '구글에서 그림 찾기</a></div>' +
    (R.t.googled === target ? '<div class="gq-back"><label class="btn primary"><input type="file" accept="image/*" data-pick="' + esc(target) + '" hidden>' + ICON.image + '방금 저장한 그림 넣기</label><p class="hint">구글에서 그림을 길게 눌러 ‘이미지 저장’(사진에 저장)한 뒤 이 버튼을 누르세요.</p></div>' : '<p class="hint">검색어는 바꿔도 돼요. 그림을 길게 눌러 저장한 뒤 돌아오면 바로 넣을 수 있어요.</p>') +
    '<div class="row-btns"><label class="btn"><input type="file" accept="image/*" capture="environment" data-pick="' + esc(target) + '" hidden>' + ICON.camera + '사진 찍기</label>' +
    '<label class="btn"><input type="file" accept="image/*" multiple data-pick="' + esc(target) + '" hidden>' + ICON.image + '갤러리에서 선택</label></div></div>';
}
function figStage(m, o){
  o = o || {};
  let h = '<div class="fig-stage' + (o.cls ? ' ' + o.cls : '') + '"' + (o.id ? ' id="' + o.id + '"' : '') + '><img data-full="' + m.id + '" src="' + m.thumb + '" alt="' + esc(m.cap || '내 그림') + '" draggable="false">';
  if (o.masks !== false) h += (m.masks || []).map(r => '<i class="mask" style="left:' + r.x + '%;top:' + r.y + '%;width:' + r.w + '%;height:' + r.h + '%"></i>').join('');
  (m.marks || []).forEach(k => {
    if (o.only != null && k.n !== o.only) return;
    const state = o.state ? o.state(k) : ''; const btn = !!o.pickAct;
    h += '<' + (btn ? 'button' : 'span') + ' class="dot-n ' + state + '" style="left:' + k.x + '%;top:' + k.y + '%"' + (btn ? ' data-act="' + o.pickAct + '" data-arg="' + k.n + '" aria-label="' + k.n + '번"' : '') + '>' + (o.only != null && !o.reveal ? '?' : k.n) + '</' + (btn ? 'button' : 'span') + '>';
  });
  if (o.tmp) h += '<i class="mask tmp" id="' + o.tmp + '" hidden></i>';
  return h + '</div>';
}
function figRecord(img, n, ok){
  const m = imgMeta(img); const sid = m && m.sid !== 'gichul' ? m.sid : X.id;
  const p = SS(sid).figp; const r = (p[img] || (p[img] = {}))[n] || (p[img][n] = { ok: 0, ng: 0, streak: 0 });
  if (ok) { r.ok++; r.streak++; } else { r.ng++; r.streak = 0; }
  logInc('cards');
}
V.figtodo = () => {
  const todo = new Set(figTodoList());
  const cs = figConcepts().slice().sort((a, b) => (todo.has(b.id) ? 1 : 0) - (todo.has(a.id) ? 1 : 0));
  return subBar('그림 넣을 개념') + '<section><p class="sub">그림이 있으면 훨씬 외우기 쉬운 개념이에요. 교과서 그림을 찍거나 구글에서 찾아 넣으세요. 다른 개념에도 개념 카드에서 그림을 넣을 수 있어요.</p>' +
    '<div class="list">' + cs.map(c => { const im = imgsOf(X.id, c.id); return lrow('go', 'figs:' + c.id, c.t, (im.length ? '그림 ' + im.length + '장' : '그림 없음') + (todo.has(c.id) ? ' · 나중에 넣기로 함' : '') + (isLearned(c.id) ? '' : ' · 아직 안 배움'), { right: im.length ? '<img class="lthumb" src="' + im[0].thumb + '" alt="">' : '', hl: todo.has(c.id) }); }).join('') + '</div>' +
    '<h3 class="h3">그림 안내</h3><p class="hint">새 개념을 배울 때 그림 넣기 안내가 ' + (S.set.figAsk ? '나와요 (한 번에 1~2개까지).' : '나오지 않아요.') + '</p><div class="row-btns"><button class="btn" data-act="figtoggle">' + (S.set.figAsk ? '안내 끄기' : '안내 켜기') + '</button></div></section>';
};
V.figs = p => {
  const c = C(p.id); if (!c) return subBar('내 그림') + '<p class="empty">개념을 찾을 수 없어요.</p>';
  const imgs = imgsOf(X.id, c.id); const marked = imgs.filter(m => (m.marks || []).length).length;
  return subBar('내 그림') + '<section><h1 class="h-sm">' + esc(c.t) + '</h1>' +
    (imgs.length ? '<div class="fgrid">' + imgs.map(m => '<button class="fcard" data-act="go" data-arg="imgview:' + m.id + '"><img src="' + m.thumb + '" alt=""><span>' + esc(m.cap || '설명 없음') + '</span><i>' + ((m.marks || []).length ? '번호 ' + m.marks.length + '개' : '번호 없음') + '</i></button>').join('') + '</div>' : '<p class="hint">아직 그림이 없어요.</p>') +
    (marked ? '<button class="btn primary big" data-act="iprac" data-arg="c:' + c.id + '">이 개념 그림 연습</button>' : '') +
    '<h3 class="h3">그림 넣기 <span>큰 사진도 자동으로 줄여서 저장해요</span></h3>' + addImgButtons('c:' + X.id + ':' + c.id, (c.fig && c.fig.q) || c.t) + '</section>';
};
V.figprac = () => {
  const imgs = IMG.meta.filter(m => m.sid === X.id && X.cmap[m.cid]);
  const marked = imgs.filter(m => (m.marks || []).length); const fm = figMastery(X.id); const p = SS().figp;
  return subBar('그림 연습') + '<section><p class="sub">그림에 찍은 번호로 위치를 연습해요. ‘이름 → 번호’와 ‘번호 → 이름’이 섞여 나와요.</p>' +
    '<div class="stats3"><div><b>' + imgs.length + '</b><span>내 그림</span></div><div><b>' + fm.n + '</b><span>찍은 위치</span></div><div><b>' + fm.ok + '</b><span>마스터</span></div></div>' +
    (marked.length ? '<button class="btn primary big" data-act="iprac" data-arg="all">전체 연습 시작</button>' : '') +
    (imgs.length ? '<div class="fgrid" style="margin-top:14px">' + imgs.map(m => { const n = (m.marks || []).length; const ok = (m.marks || []).filter(k => p[m.id] && p[m.id][k.n] && p[m.id][k.n].streak >= 2).length;
      return '<button class="fcard" data-act="go" data-arg="imgview:' + m.id + '"><img src="' + m.thumb + '" alt=""><span>' + esc(ownerTitle(m)) + '</span><i>' + (n ? '위치 ' + n + '곳 중 ' + ok + '곳 마스터' : '번호를 찍으면 연습할 수 있어요') + '</i></button>'; }).join('') + '</div>'
      : '<p class="empty">아직 그림이 없어요. ‘그림 넣을 개념’에서 그림을 넣어 보세요.</p><div class="row-btns"><button class="btn" data-act="go" data-arg="figtodo:">그림 넣을 개념 보기</button></div>') + '</section>';
};

/* 편집: 돌리기 · 자르기 · 설명 · 고화질 */
function startEditor(files, target){
  const list = Array.from(files || []).filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name || ''));
  if (!list.length) { toast('그림 파일을 고르지 않았어요'); return; }
  clearEditor();
  R.ed = { files: list, idx: 0, target, rot: 0, crop: null };
  R.stack = R.stack.filter(x => x.name !== 'imgedit'); go('imgedit');
}
function clearEditor(){ if (R.ed && R.ed.url) URL.revokeObjectURL(R.ed.url); R.ed = null; }
function loadImgFile(file){
  return new Promise((res, rej) => { const url = URL.createObjectURL(file); const im = new Image(); im.onload = () => res({ im, url }); im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); }; im.src = url; });
}
function applyRot(ctx, rot, w, h){
  if (rot === 90) { ctx.translate(h, 0); ctx.rotate(Math.PI / 2); }
  else if (rot === 180) { ctx.translate(w, h); ctx.rotate(Math.PI); }
  else if (rot === 270) { ctx.translate(0, w); ctx.rotate(-Math.PI / 2); }
}
async function processImage(img, rot, crop, hq){
  const w = img.naturalWidth, h = img.naturalHeight; const rw = rot % 180 ? h : w, rh = rot % 180 ? w : h;
  const c = crop || { x: 0, y: 0, w: 1, h: 1 };
  const cx = c.x * rw, cy = c.y * rh, cw = Math.max(1, c.w * rw), ch = Math.max(1, c.h * rh);
  const L = hq ? 2400 : 1600; const s = Math.min(1, L / Math.max(cw, ch));
  const ow = Math.max(1, Math.round(cw * s)), oh = Math.max(1, Math.round(ch * s));
  const cv = document.createElement('canvas'); cv.width = ow; cv.height = oh; const ctx = cv.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, ow, oh);
  ctx.scale(s, s); ctx.translate(-cx, -cy); applyRot(ctx, rot, w, h); ctx.drawImage(img, 0, 0);
  const full = await new Promise(res => cv.toBlob(res, 'image/jpeg', hq ? 0.9 : 0.82));
  const t = document.createElement('canvas'); const ts = Math.min(1, 320 / Math.max(ow, oh));
  t.width = Math.max(1, Math.round(ow * ts)); t.height = Math.max(1, Math.round(oh * ts)); t.getContext('2d').drawImage(cv, 0, 0, t.width, t.height);
  return { full, thumb: t.toDataURL('image/jpeg', 0.72), w: ow, h: oh };
}
V.imgedit = () => {
  const ed = R.ed; if (!ed) return subBar('그림 편집') + '<p class="empty">편집할 그림이 없어요.</p>';
  const tgt = parseTarget(ed.target);
  return '<div>' + fullBar('<h2 class="fb-title">그림 편집' + (ed.files.length > 1 ? ' · ' + (ed.idx + 1) + '/' + ed.files.length : '') + '</h2>', null, true) +
    '<p class="eyebrow">' + esc(tgt.gq ? '기출 문제 그림' : (cOf(tgt.sid, tgt.cid) || {}).t || '') + '</p>' +
    '<div class="ed-stage" id="ed-stage"><div class="ed-box" id="ed-box"><canvas id="ed-cv"></canvas><i class="ed-crop" id="ed-crop" hidden></i></div>' + (ed.err ? '<p class="empty">' + esc(ed.err) + '</p>' : (!ed.img ? '<p class="hint center">그림을 여는 중…</p>' : '')) + '</div>' +
    '<p class="hint">손가락으로 끌어서 필요한 부분만 남길 수 있어요.</p>' +
    '<div class="row-btns"><button class="btn" data-act="edrot" data-arg="270">' + ICON.rotL + '왼쪽으로</button><button class="btn" data-act="edrot" data-arg="90">' + ICON.rotR + '오른쪽으로</button><button class="btn" data-act="edcrop"' + (ed.crop ? '' : ' disabled') + '>자르기 취소</button></div>' +
    '<label class="lbl" for="ed-cap">설명 한 줄<span>예: 교과서 152쪽 림프절 그림</span></label><input id="ed-cap" value="' + esc(ed.cap || '') + '">' +
    '<label class="check"><input type="checkbox" id="ed-hq"' + (ed.hq ? ' checked' : '') + '> 고화질로 저장 <span class="hint">글씨가 작은 그림일 때 (용량이 커요)</span></label>' +
    '<button class="btn primary big" data-act="edsave"' + (ed.img ? '' : ' disabled') + '>' + (ed.busy ? '저장하는 중…' : '저장') + '</button>' +
    (ed.files.length > 1 ? '<div class="row-btns"><button class="btn ghost" data-act="edskip">이 그림 건너뛰기</button></div>' : '') + '</div>';
};
function drawEditor(){
  const ed = R.ed, cv = $('#ed-cv'), stage = $('#ed-stage'), box = $('#ed-box'); if (!ed || !cv || !ed.img) return;
  const w = ed.img.naturalWidth, h = ed.img.naturalHeight; const rw = ed.rot % 180 ? h : w, rh = ed.rot % 180 ? w : h;
  const W = Math.max(200, stage.clientWidth); let dw = W, dh = Math.round(W * rh / rw); const maxH = Math.max(260, window.innerHeight * 0.58);
  if (dh > maxH) { dh = Math.round(maxH); dw = Math.round(maxH * rw / rh); }
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(dw * dpr); cv.height = Math.round(dh * dpr); cv.style.width = dw + 'px'; cv.style.height = dh + 'px';
  box.style.width = dw + 'px'; box.style.height = dh + 'px';
  const ctx = cv.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height);
  const s = cv.width / rw; ctx.scale(s, s); applyRot(ctx, ed.rot, w, h); ctx.drawImage(ed.img, 0, 0);
  showRect($('#ed-crop'), ed.crop);
}
function showRect(el, r){ if (!el) return; if (!r) { el.hidden = true; return; } el.hidden = false; el.style.left = (r.x * 100) + '%'; el.style.top = (r.y * 100) + '%'; el.style.width = (r.w * 100) + '%'; el.style.height = (r.h * 100) + '%'; }
const clamp01 = v => Math.max(0, Math.min(1, v));
function bindDrag(el, onMove, onEnd, onTap){
  if (!el) return; let st = null;
  const pos = e => { const r = el.getBoundingClientRect(); return { x: clamp01((e.clientX - r.left) / r.width), y: clamp01((e.clientY - r.top) / r.height) }; };
  const rect = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });
  el.onpointerdown = e => { if (e.target.closest('button')) return; st = pos(e); st.moved = false; try { el.setPointerCapture(e.pointerId); } catch (x) {} e.preventDefault(); };
  el.onpointermove = e => { if (!st) return; const p = pos(e); if (Math.abs(p.x - st.x) + Math.abs(p.y - st.y) > 0.015) st.moved = true; if (st.moved && onMove) onMove(rect(st, p)); };
  el.onpointerup = e => { if (!st) return; const p = pos(e); const s0 = st; st = null; if (!s0.moved) { if (onTap) onTap(p); return; } if (onEnd) onEnd(rect(s0, p)); };
  el.onpointercancel = () => { st = null; };
}
async function setupEditor(){
  const ed = R.ed; if (!ed) return;
  if (!ed.img && !ed.loading && !ed.err) {
    ed.loading = true;
    try { const r = await loadImgFile(ed.files[ed.idx]); if (R.ed !== ed) { URL.revokeObjectURL(r.url); return; } ed.img = r.im; ed.url = r.url; }
    catch (e) { ed.err = '이 그림을 열 수 없어요. 다른 그림을 골라 주세요.'; }
    ed.loading = false; if (cur() && cur().name === 'imgedit') render(); return;
  }
  drawEditor();
  bindDrag($('#ed-box'), r => showRect($('#ed-crop'), r), r => { if (r.w > 0.04 && r.h > 0.04) { ed.crop = r; } showRect($('#ed-crop'), ed.crop); const b = document.querySelector('[data-act="edcrop"]'); if (b) b.disabled = !ed.crop; });
}

/* 보기 · 정리 */
V.imgview = p => {
  const m = imgMeta(p.id); if (!m) return subBar('내 그림') + '<p class="empty">그림을 찾을 수 없어요. 지워졌을 수 있어요.</p>';
  const zoom = R.t.izoom === m.id; const marks = m.marks || []; const own = m.sid !== 'gichul';
  const sibs = own ? imgsOf(m.sid, m.cid) : []; const pos = sibs.findIndex(x => x.id === m.id);
  let h = subBar('내 그림') + '<section><p class="eyebrow">' + esc(ownerTitle(m)) + '</p>' + (m.cap ? '<p class="cap">' + esc(m.cap) + '</p>' : '');
  if (p.fresh && !marks.length && own) h += '<div class="notice good"><b>저장했어요 · ' + mb(m.size) + '</b><p>그림 위에 번호를 찍어 두면 ‘턱밑은 몇 번?’처럼 위치를 문제로 연습할 수 있어요. 그림에 이름이 적혀 있으면 ‘글자 가리기’로 가려요.</p><div class="row-btns"><button class="btn primary" data-act="go" data-arg="imgmark:' + m.id + '">' + ICON.pin + '번호 찍기</button></div></div>';
  h += '<div class="iv-wrap' + (zoom ? ' zoom' : '') + '"><div class="iv-btn" role="button" tabindex="0" data-act="izoom" data-arg="' + m.id + '" aria-label="' + (zoom ? '원래 크기로' : '크게 보기') + '">' + figStage(m, { cls: 'view' }) + '</div></div>' +
    '<p class="hint">그림을 누르면 ' + (zoom ? '원래 크기로 돌아가요' : '크게 볼 수 있어요') + ' · ' + m.w + '×' + m.h + ' · ' + mb(m.size) + (m.hq ? ' · 고화질' : '') + '</p>';
  if (marks.length) h += '<ol class="mk-list">' + marks.slice().sort((a, b) => a.n - b.n).map(k => '<li><span class="dot-n sm">' + k.n + '</span>' + esc(k.name) + '</li>').join('') + '</ol>';
  h += '<div class="row-btns"><button class="btn" data-act="go" data-arg="imgmark:' + m.id + '">' + ICON.pin + (marks.length ? '번호 다시 찍기' : '번호 찍기') + '</button><button class="btn" data-act="go" data-arg="imgmask:' + m.id + '">글자 가리기' + ((m.masks || []).length ? ' (' + m.masks.length + ')' : '') + '</button>' +
    (marks.length && own ? '<button class="btn primary" data-act="iprac" data-arg="i:' + m.id + '">연습하기</button>' : '') + '</div>' +
    '<label class="lbl" for="iv-cap">설명 한 줄</label><div class="inline"><input id="iv-cap" value="' + esc(m.cap || '') + '"><button class="btn" data-act="icap" data-arg="' + m.id + '">저장</button></div>';
  if (own) {
    h += (sibs.length > 1 ? '<label class="lbl">순서 <span>' + (pos + 1) + '/' + sibs.length + '</span></label><div class="row-btns" style="margin-top:0"><button class="btn" data-act="iorder" data-arg="' + m.id + ':-1"' + (pos > 0 ? '' : ' disabled') + '>' + ICON.up + '앞으로</button><button class="btn" data-act="iorder" data-arg="' + m.id + ':1"' + (pos < sibs.length - 1 ? '' : ' disabled') + '>' + ICON.down + '뒤로</button></div>' : '') +
      '<label class="lbl" for="iv-move">다른 개념으로 옮기기</label><div class="inline"><select id="iv-move">' + (SUB[m.sid] ? SUB[m.sid].units : []).map(u => '<optgroup label="' + u.n + '. ' + esc(u.title) + '">' + u.concepts.map(c => '<option value="' + c.id + '"' + (c.id === m.cid ? ' selected' : '') + '>' + esc(c.t) + '</option>').join('') + '</optgroup>').join('') + '</select><button class="btn" data-act="imove" data-arg="' + m.id + '">옮기기</button></div>';
  }
  h += '<div class="row-btns" style="margin-top:22px"><button class="btn" data-act="idel" data-arg="' + m.id + '">' + ICON.trash + (R.t.confirm === 'idel-' + m.id ? '한 번 더 누르면 지워요' : '그림 지우기') + '</button></div></section>';
  return h;
};
/* 번호 찍기: 위치 이름을 하나씩 안내 */
function defaultNames(m){
  if ((m.marks || []).length) return m.marks.slice().sort((a, b) => a.n - b.n).map(k => k.name);
  const c = m.sid !== 'gichul' ? cOf(m.sid, m.cid) : null;
  return c && c.fig && c.fig.pts ? c.fig.pts.slice() : [];
}
V.imgmark = p => {
  const m = imgMeta(p.id); if (!m) return subBar('번호 찍기') + '<p class="empty">그림을 찾을 수 없어요.</p>';
  let k = R.mk; if (!k || k.id !== m.id) k = R.mk = { id: m.id, phase: 'names', names: defaultNames(m), i: 0, marks: [] };
  if (k.phase === 'names') return subBar('번호 찍기') + '<section><p class="sub">찍을 위치의 이름이에요. 위에서부터 1, 2, 3… 번호가 붙어요. 고치거나 더해도 돼요 (한 줄에 하나).</p>' +
    figStage(m, { cls: 'view' }) +
    '<label class="lbl" for="mk-names">위치 이름</label><textarea id="mk-names" rows="7" placeholder="예:\n귀앞\n귀뒤\n후두">' + esc(k.names.join('\n')) + '</textarea>' +
    ((m.marks || []).length ? '<p class="hint">이미 찍은 번호 ' + m.marks.length + '개는 새로 찍은 것으로 바뀌어요.</p>' : '') +
    '<button class="btn primary big" data-act="mkstart">번호 찍기 시작</button></section>';
  const name = k.names[k.i];
  return '<div>' + fullBar('<div class="pbar"><i style="width:' + pct(k.i, k.names.length) + '%"></i></div><span class="mono ses-n">' + Math.min(k.i + 1, k.names.length) + '/' + k.names.length + '</span>', null, true) +
    '<p class="mk-prompt"><span class="dot-n">' + (k.i + 1) + '</span><span><b>' + esc(name) + '</b> 위치를 누르세요</span></p>' +
    figStage(Object.assign({}, m, { marks: k.marks }), { id: 'mk-stage', cls: 'tap' }) +
    '<div class="row-btns"><button class="btn" data-act="mkskip">건너뛰기</button><button class="btn" data-act="mkundo"' + (k.i ? '' : ' disabled') + '>이전 다시 찍기</button><button class="btn primary" data-act="mkfinish">여기까지 저장</button></div>' +
    '<p class="hint">글자가 적힌 곳을 찍었다면, 저장한 뒤 ‘글자 가리기’로 가려야 연습이 돼요.</p></div>';
};
function bindMark(){
  const st = $('#mk-stage'); const k = R.mk; if (!st || !k) return;
  const img = st.querySelector('img');
  bindDrag(img.parentNode, null, null, p => {
    const n = k.i + 1; k.marks = k.marks.filter(x => x.n !== n);
    k.marks.push({ n, name: k.names[k.i], x: +(p.x * 100).toFixed(2), y: +(p.y * 100).toFixed(2) });
    k.i++;
    if (k.i >= k.names.length) saveMarks(); else render();
  });
}
async function saveMarks(){
  const k = R.mk; if (!k) return;
  try { await imgPatch(k.id, { marks: k.marks.slice().sort((a, b) => a.n - b.n) }); toast('번호 ' + k.marks.length + '개를 저장했어요'); }
  catch (e) { toast('저장하지 못했어요'); }
  R.mk = null; if (cur() && cur().name === 'imgmark') { R.stack.pop(); render(true); }
}
/* 글자 가리기: 끌어서 네모로 가리기 */
V.imgmask = p => {
  const m = imgMeta(p.id); if (!m) return subBar('글자 가리기') + '<p class="empty">그림을 찾을 수 없어요.</p>';
  let k = R.mask; if (!k || k.id !== m.id) k = R.mask = { id: m.id, masks: (m.masks || []).slice() };
  return '<div>' + fullBar('<h2 class="fb-title">글자 가리기 · ' + k.masks.length + '곳</h2>', null, true) +
    '<p class="sub">그림에 적힌 이름을 손가락으로 끌어서 네모로 가리세요. 연습할 때 가린 곳은 안 보여요.</p>' +
    figStage(Object.assign({}, m, { masks: k.masks }), { id: 'mask-stage', cls: 'tap masking', tmp: 'mask-tmp' }) +
    '<div class="row-btns"><button class="btn" data-act="maskundo"' + (k.masks.length ? '' : ' disabled') + '>되돌리기</button><button class="btn" data-act="maskclear"' + (k.masks.length ? '' : ' disabled') + '>모두 지우기</button><button class="btn primary" data-act="masksave">저장</button></div></div>';
};
function bindMask(){
  const st = $('#mask-stage'); const k = R.mask; if (!st || !k) return;
  const tmp = $('#mask-tmp');
  bindDrag(st, r => showRect(tmp, r), r => { showRect(tmp, null); if (r.w > 0.01 && r.h > 0.01) { k.masks.push({ x: +(r.x * 100).toFixed(2), y: +(r.y * 100).toFixed(2), w: +(r.w * 100).toFixed(2), h: +(r.h * 100).toFixed(2) }); render(); } });
}
/* 그림 연습 */
function startPractice(arg){
  let imgs;
  if (arg === 'all') imgs = figMarksOf(X.id).filter(m => X.cmap[m.cid]);
  else if (arg.slice(0, 2) === 'c:') imgs = imgsOf(X.id, arg.slice(2)).filter(m => (m.marks || []).length);
  else imgs = [imgMeta(arg.slice(2))].filter(m => m && (m.marks || []).length);
  const p = SS().figp; const qs = [];
  imgs.forEach(m => (m.marks || []).forEach(k => {
    const r = p[m.id] && p[m.id][k.n];
    const mode = (m.marks.length >= 2 && Math.random() < 0.45) ? 'n1' : 'n2';
    let opts = null;
    if (mode === 'n1') { const others = shuffle(m.marks.filter(x => x.n !== k.n).map(x => x.name)).slice(0, 3); opts = shuffle(others.concat([k.name])); }
    qs.push({ img: m.id, n: k.n, mode, opts, w: r ? r.streak : 0 });
  }));
  if (!qs.length) { toast('번호를 찍은 그림이 없어요'); return; }
  const list = shuffle(qs).sort((a, b) => a.w - b.w).slice(0, 15);
  R.pr = { qs: shuffle(list), i: 0, ok: 0, ng: 0, ans: null };
  R.stack = R.stack.filter(x => x.name !== 'imgprac'); go('imgprac');
}
V.imgprac = () => {
  const P = R.pr; if (!P) return V.figprac();
  const n = P.qs.length;
  if (P.i >= n) return '<div>' + fullBar('<div class="pbar"><i style="width:100%"></i></div>') + '<div class="done-card"><div class="eyebrow">그림 연습</div><h2>' + P.ok + ' / ' + n + '</h2><p>' + (P.ng ? '틀린 위치는 다음 연습에 먼저 나와요.' : '모든 위치를 맞혔어요!') + '</p>' +
    '<div class="row-btns"><button class="btn primary" data-act="iprac" data-arg="all">한 번 더</button><button class="btn" data-act="back">닫기</button></div></div></div>';
  const q = P.qs[P.i]; const m = imgMeta(q.img); if (!m) { P.i++; return V.imgprac(); }
  const mk = (m.marks || []).find(k => k.n === q.n); if (!mk) { P.i++; return V.imgprac(); }
  const a = P.ans;
  let body;
  if (q.mode === 'n2') {
    const state = k => !a ? '' : (k.n === q.n ? 'right' : (k.n === a.pick ? 'wrong' : 'dim'));
    body = '<p class="qtext">' + esc(mk.name) + '은(는) 몇 번일까요?</p>' + figStage(m, { pickAct: a ? null : 'prpick', state });
  } else {
    body = '<p class="qtext">물음표 위치의 이름은?</p>' + figStage(m, { only: q.n, reveal: !!a, state: () => a ? (a.ok ? 'right' : 'wrong') : 'ask' }) +
      '<div class="opts">' + q.opts.map((o, i) => '<button class="opt ' + (a ? (o === mk.name ? 'right' : (i === a.pick ? 'wrong' : '')) : '') + '" data-act="prname" data-arg="' + i + '"' + (a ? ' disabled' : '') + '><span class="on">' + CIRC[i] + '</span><span>' + esc(o) + '</span></button>').join('') + '</div>';
  }
  return '<div>' + fullBar('<div class="pbar"><i style="width:' + pct(P.i, n) + '%"></i></div><span class="mono ses-n">' + (P.i + 1) + '/' + n + '</span>') +
    '<div class="ses-tag">그림 연습 · ' + esc(ownerTitle(m)) + '</div>' + body +
    (a ? '<div class="fb ' + (a.ok ? 'ok' : 'ng') + '"><b>' + (a.ok ? '맞았어요' : '아쉬워요 · ' + q.n + '번 ' + esc(mk.name)) + '</b></div><button class="btn primary big" data-act="prnext">다음</button>' : (q.mode === 'n2' ? '<p class="hint center">그림에서 번호를 눌러 답하세요</p>' : '')) + '</div>';
};

Object.assign(ACT, {
  googled: a => { setTimeout(() => { R.t.googled = a; render(); }, 400); },
  figtoggle: () => { S.set.figAsk = !S.set.figAsk; save(); render(); },
  edrot: a => { const ed = R.ed; if (!ed) return; ed.rot = (ed.rot + (+a)) % 360; ed.crop = null; ed.cap = ($('#ed-cap') || {}).value || ed.cap; ed.hq = !!($('#ed-hq') || {}).checked; render(); },
  edcrop: () => { if (R.ed) { R.ed.crop = null; showRect($('#ed-crop'), null); const b = document.querySelector('[data-act="edcrop"]'); if (b) b.disabled = true; } },
  edskip: () => nextEditFile(null),
  edsave: async () => {
    const ed = R.ed; if (!ed || !ed.img || ed.busy) return;
    ed.cap = ($('#ed-cap').value || '').trim(); ed.hq = $('#ed-hq').checked; ed.busy = true; render();
    try {
      const out = await processImage(ed.img, ed.rot, ed.crop, ed.hq);
      if (!out.full) throw new Error('blob');
      const tgt = parseTarget(ed.target);
      const rec = { id: uid('i'), sid: tgt.sid, cid: tgt.cid, full: out.full, thumb: out.thumb, w: out.w, h: out.h, cap: ed.cap, hq: ed.hq, ts: Date.now(), order: imgsOf(tgt.sid, tgt.cid).length, marks: [], masks: [] };
      await imgPut(rec);
      if (tgt.gq) { const g = G.qs.find(x => x.id === tgt.gq); if (g) { g.img = rec.id; saveG(); } }
      else if (S.subj[tgt.sid]) delete S.subj[tgt.sid].figTodo[tgt.cid];
      save(); nextEditFile(rec);
    } catch (e) { ed.busy = false; render(); toast('저장하지 못했어요. 저장 공간이 부족할 수 있어요'); }
  },
  izoom: a => { R.t.izoom = R.t.izoom === a ? null : a; render(); },
  icap: async a => { await imgPatch(a, { cap: ($('#iv-cap').value || '').trim() }); toast('설명을 저장했어요'); render(); },
  imove: async a => { const to = $('#iv-move').value; const m = imgMeta(a); if (!m || to === m.cid) return; await imgPatch(a, { cid: to, order: imgsOf(m.sid, to).length }); toast('‘' + X.cmap[to].t + '’로 옮겼어요'); render(); },
  iorder: async a => {
    const p = a.split(':'); const m = imgMeta(p[0]); const sibs = imgsOf(m.sid, m.cid); const i = sibs.findIndex(x => x.id === m.id); const j = i + (+p[1]);
    if (j < 0 || j >= sibs.length) return; const list = sibs.slice(); const t = list[i]; list[i] = list[j]; list[j] = t;
    for (let k = 0; k < list.length; k++) if ((list[k].order || 0) !== k) await imgPatch(list[k].id, { order: k });
    render();
  },
  idel: async a => {
    if (R.t.confirm !== 'idel-' + a) { R.t.confirm = 'idel-' + a; render(); return; }
    const m = imgMeta(a); await imgDel(a); R.t.confirm = null;
    if (m && m.sid === 'gichul') { const g = G.qs.find(x => x.id === m.cid); if (g && g.img === a) { g.img = null; saveG(); } }
    toast('그림을 지웠어요'); R.stack.pop(); render(true);
  },
  mkstart: () => { const k = R.mk; const names = ($('#mk-names').value || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 30); if (!names.length) { toast('위치 이름을 한 줄에 하나씩 써 주세요'); return; } k.names = names; k.phase = 'tap'; k.i = 0; k.marks = []; render(true); },
  mkskip: () => { const k = R.mk; k.i++; if (k.i >= k.names.length) saveMarks(); else render(); },
  mkundo: () => { const k = R.mk; if (k.i > 0) { k.i--; k.marks = k.marks.filter(x => x.n !== k.i + 1); render(); } },
  mkfinish: () => saveMarks(),
  maskundo: () => { R.mask.masks.pop(); render(); },
  maskclear: () => { R.mask.masks = []; render(); },
  masksave: async () => { const k = R.mask; try { await imgPatch(k.id, { masks: k.masks }); toast('가린 곳 ' + k.masks.length + '개를 저장했어요'); } catch (e) { toast('저장하지 못했어요'); } R.mask = null; R.stack.pop(); render(true); },
  iprac: a => startPractice(a),
  prpick: a => { const P = R.pr; if (P.ans) return; const q = P.qs[P.i]; const ok = +a === q.n; P.ans = { pick: +a, ok }; if (ok) P.ok++; else P.ng++; figRecord(q.img, q.n, ok); save(); render(); },
  prname: a => { const P = R.pr; if (P.ans) return; const q = P.qs[P.i]; const m = imgMeta(q.img); const mk = m.marks.find(k => k.n === q.n); const ok = q.opts[+a] === mk.name; P.ans = { pick: +a, ok }; if (ok) P.ok++; else P.ng++; figRecord(q.img, q.n, ok); save(); render(); },
  prnext: () => { const P = R.pr; P.i++; P.ans = null; render(true); }
});
function nextEditFile(rec){
  const ed = R.ed; if (!ed) return;
  if (ed.idx + 1 < ed.files.length) {
    if (ed.url) URL.revokeObjectURL(ed.url);
    Object.assign(ed, { idx: ed.idx + 1, img: null, url: null, rot: 0, crop: null, cap: '', busy: false, err: null, loading: false });
    if (rec) toast('저장했어요 · 다음 그림');
    render(true); return;
  }
  clearEditor(); R.stack.pop();
  if (rec) go('imgview', { id: rec.id, fresh: 1 }); else render(true);
}

/* ───────── 진도 탭 ───────── */
function weekDays(){
  const out = []; const now = Date.now();
  for (let i = 6; i >= 0; i--) { const t = sod(now) - i * DAY; const L = S.log[dkey(t)]; out.push({ t, min: L ? Math.round((L.sec || 0) / 60) : 0 }); }
  return out;
}
function vProg(){
  const st = subjStats(); const cnt = { new: 0, learned: 0, known: 0, master: 0 }; CS().forEach(c => cnt[status(c.id)]++); const fxn = fixCounts();
  const weak = weakTop(3); const ill = Object.keys(SS().ill).filter(k => X.cmap[k]).sort((a, b) => SS().ill[b] - SS().ill[a]);
  const wk = weekDays(); const maxMin = Math.max(15, ...wk.map(x => x.min));
  const ex = SS().exams.slice(-8).reverse(); const fm = figMastery(X.id); const imgsN = IMG.meta.filter(m => m.sid === X.id).length;
  const s = SS(); const nMine = Object.keys(s.mine).filter(k => s.mine[k]).length, nFlag = Object.keys(s.flags).filter(k => s.flags[k]).length;
  return subjTop() + '<section><h1>진도</h1>' + heroHTML(st) +
    '<div class="legend4"><span><i class="lg l0"></i>새 개념 <b class="mono">' + cnt.new + '</b></span><span><i class="lg l1"></i>배움 <b class="mono">' + cnt.learned + '</b></span><span><i class="lg l2"></i>외움 <b class="mono">' + cnt.known + '</b></span><span><i class="lg l3"></i>마스터 <b class="mono">' + cnt.master + '</b></span></div>' +
    '<h3 class="h3">단원별 <span>진도는 높은데 정답률이 낮으면 ‘복습 우선’</span></h3><div class="ulist">' + X.units.map(u => {
      const a = unitStats(u); const flag = a.prog >= 50 && a.acc != null && a.att >= 4 && a.acc < 60;
      return '<button class="urow" data-act="go" data-arg="unit:' + u.id + '"><span class="urow-h"><b>' + u.n + '. ' + esc(u.title) + '</b>' + (flag ? '<span class="chip c-imp">복습 우선</span>' : '') + '</span>' +
        '<span class="urow-b"><span class="lab">진도</span><span class="ub2"><i style="width:' + a.prog + '%"></i></span><b class="mono">' + a.prog + '%</b>' +
        '<span class="lab">정답률</span><span class="ub2 acc"><i class="' + (a.acc != null && a.acc < 40 ? 'low' : '') + '" style="width:' + (a.acc || 0) + '%"></i></span><b class="mono">' + (a.acc == null ? '–' : a.acc + '%') + '</b></span></button>';
    }).join('') + '</div>' +
    '<h3 class="h3">약점 TOP 3 <span>문제에서 자주 틀린 개념</span></h3>' + (weak.length ? '<div class="list">' + weak.map(w => lrow('go', 'concept:' + w.id, X.cmap[w.id].t, '정답률 ' + Math.round(w.acc * 100) + '%')).join('') + '</div><button class="btn primary big" data-act="start" data-arg="weak">약점 공부하기</button>' : '<p class="hint">문제를 풀면 자주 틀리는 개념이 여기에 나와요.</p>') +
    '<h3 class="h3">착각 목록 <span>외웠다고 생각했는데 틀린 개념</span></h3>' + (ill.length ? '<div class="list">' + ill.slice(0, 6).map(k => lrow('go', 'concept:' + k, X.cmap[k].t, '설명부터 다시 보기')).join('') + '</div>' : '<p class="hint">아직 없어요. 안다고 착각한 개념은 시험에서 가장 위험해서 따로 모아 둬요.</p>') +
    '<h3 class="h3">시험 기록 <span>모의고사 · 단원 테스트 · 기출 회차 · 과락 40% / 합격 60%</span></h3>' + (ex.length ? '<div class="list">' + ex.map(e => { const d = new Date(e.ts); const pc = pct(e.ok, e.n); return '<div class="exrow"><span class="mono">' + (d.getMonth() + 1) + '/' + d.getDate() + '</span><span>' + esc(e.title) + '</span><b class="' + (pc < 40 ? 'low' : pc >= 60 ? 'hi' : '') + '">' + pc + '%</b></div>'; }).join('') + '</div>' : '<p class="hint">단원 테스트, 모의고사, 기출을 풀면 점수가 쌓여요.</p>') +
    '<h3 class="h3">내 그림</h3><div class="list">' + lrow('go', 'figprac:', '그림 연습', imgsN ? '그림 ' + imgsN + '장 · 위치 ' + fm.n + '곳 중 ' + fm.ok + '곳 마스터' : '아직 그림이 없어요') + lrow('go', 'figtodo:', '그림 넣을 개념', figConcepts().length + '개' + (figTodoList().length ? ' · 나중에 넣기로 한 것 ' + figTodoList().length + '개' : '')) + '</div>' +
    '<h3 class="h3">이번 주 공부 시간</h3><div class="week" role="img" aria-label="최근 7일 공부 시간">' + wk.map((x, i) => '<div class="wb' + (x.min ? '' : ' zero') + (i === 6 ? ' today' : '') + '"><i style="height:' + Math.max(4, Math.round(x.min / maxMin * 56)) + 'px"></i><span>' + WD[new Date(x.t).getDay()] + (x.min ? ' ' + x.min + '분' : '') + '</span></div>').join('') + '</div>' +
    '<h3 class="h3">전체 내용</h3><div class="list">' + lrow('go', 'toc:', '목차 · 골라 공부하기', '단원·개념별 배움 표시와 정답률') + lrow('go', 'browse:', '전체 내용 미리 보기', X.units.length + '단원 · 개념 ' + X.concepts.length + '개 · 단원 → 개념 카드') + '</div>' +
    '<h3 class="h3">내 노트</h3><div class="list">' +
    lrow('go', 'wrongs:', '오답노트', reviewPool().length + '문제 · 틀렸거나 애매했던 문제') +
    lrow('go', 'mine:', '내 암기법', nMine + '개') +
    lrow('go', 'flags:', '확인 필요 표시', nFlag + '개 · 교수님 자료와 비교할 것') +
    lrow('go', 'fixes:', '고친 내용 · 내 개념', (fxn.ce + fxn.my + fxn.qe + fxn.qh ? '고친 개념 ' + fxn.ce + ' · 내 개념 ' + fxn.my + ' · 고친 문제 ' + fxn.qe + ' · 뺀 문제 ' + fxn.qh : '개념 추가, 친구에게 보내기, 모두에게 반영하기')) + '</div>' +
    '<h3 class="h3">설정</h3><div class="list">' + lrow('go', 'settings:', '설정', '글자 크기 · 화면 · 그림 안내 · 저장 공간') + lrow('go', 'backup:', '기록 백업 · 불러오기', backupMeta(), { hl: !S.lastBackup || Date.now() - S.lastBackup > 7 * DAY }) + '</div></section>';
}

/* ───────── 전체 내용 미리 보기 ───────── */
function viewLevel(id){
  if (R.lv[id] != null) return R.lv[id];
  if (R.viewMode !== 'auto') return +R.viewMode;
  const s = crec(id);
  if (!s || !s.learned || s.lv0) return 0;
  return status(id) === 'master' ? 2 : 1;
}
function viewSeg(){
  const modes = [['auto', '자동']].concat(LV_LABEL.map((l, i) => [String(i), l]));
  return '<div class="seg" role="group" aria-label="보기 방식">' + modes.map(m => '<button data-act="vmode" data-arg="' + m[0] + '" aria-pressed="' + (R.viewMode === m[0]) + '">' + m[1] + '</button>').join('') + '</div>';
}
V.browse = () => subBar('전체 내용') + '<section><p class="sub">단원을 골라 개념 카드를 봐요. 처음엔 설명, 익숙해지면 요약, 나중엔 암기 요령만 보여요. 카드를 탭하면 바뀌어요.</p>' + viewSeg() +
  '<div class="units">' + X.units.map(u => {
    const a = unitStats(u); const M = UC(u).filter(c => status(c.id) === 'master').length;
    return '<button class="unit" data-act="go" data-arg="unit:' + u.id + '"><span class="unit-n mono">' + u.n + '</span><span class="unit-b"><b>' + esc(u.title) + '</b><span class="meter"><i style="width:' + a.prog + '%"></i></span><span class="unit-m">개념 ' + a.n + '개 · 배움 ' + a.L + ' · 마스터 ' + M + ' · 정답률 ' + (a.acc == null ? '–' : a.acc + '%') + '</span></span></button>';
  }).join('') + '</div></section>';
V.unit = p => {
  const u = X.umap[p.id]; if (!u) return subBar('단원') + '<p class="empty">단원을 찾을 수 없어요.</p>';
  return subBar(u.n + '. ' + u.title) + '<section>' + viewSeg() +
    '<ol class="clist">' + u.concepts.map(c => {
      const st = status(c.id); const im = imgsOf(X.id, c.id).length;
      return '<li><button class="crow" data-act="go" data-arg="concept:' + c.id + '"><span class="mono cn">' + u.n + '-' + c.n + '</span><span class="ct">' + prMark(c) + esc(c.t) + cTags(c) + (inRange(c) ? '' : '<span class="outc">범위 밖</span>') + '</span><span class="chip st-' + st + '">' + ST_LABEL[st] + '</span>' + (im ? '<span class="chip c-edit">그림 ' + im + '</span>' : '') + (SS().flags[c.id] ? '<span class="chip c-flag">확인 필요</span>' : '') + '</button></li>';
    }).join('') + '</ol>' +
    '<div class="row-btns"><button class="btn" data-act="start" data-arg="practice:' + u.id + '">이 단원 카드 연습</button><button class="btn" data-act="quiz" data-arg="unit:' + u.id + '">이 단원 테스트</button></div>' +
    '<button class="btn ghost addc-btn" data-act="mycnew" data-arg="' + u.id + '">' + ICON.edit + '이 단원에 내 개념 추가</button></section>';
};
V.concept = p => {
  const c = C(p.id); if (!c) return subBar('개념') + '<p class="empty">개념을 찾을 수 없어요.</p>';
  const u = X.umap[c.u]; const i = u.concepts.findIndex(x => x.id === c.id);
  const prev = u.concepts[i - 1], next = u.concepts[i + 1]; const lv = viewLevel(c.id);
  const qs = allQx().concat(gcQs()).filter(q => links(q).includes(c.id)); const open = qs.filter(unlocked).length;
  const im = imgsOf(X.id, c.id).length;
  return subBar(u.n + '. ' + u.title) + '<section>' + conceptHTML(c, lv, { learn: lv === 0 }) +
    (!isLearned(c.id) ? '<button class="btn primary big" data-act="markLearned" data-arg="' + c.id + '">배운 것으로 표시 · 복습 일정에 넣기</button>' : '') +
    '<div class="row-btns"><button class="btn" data-act="go" data-arg="figs:' + c.id + '">' + ICON.image + (im ? '내 그림 ' + im + '장' : '그림 넣기') + '</button>' +
    '<button class="btn" data-act="quiz" data-arg="cq:' + c.id + '"' + (qs.length ? '' : ' disabled') + '>이 개념 문제 ' + qs.length + (open < qs.length ? ' (열림 ' + open + ')' : '') + '</button></div>' +
    '<nav class="pn" aria-label="이전·다음 개념">' + (prev ? '<button class="btn" data-act="swap" data-arg="' + prev.id + '"><span>← ' + esc(prev.t) + '</span></button>' : '<span></span>') + (next ? '<button class="btn" data-act="swap" data-arg="' + next.id + '"><span>' + esc(next.t) + ' →</span></button>' : '<span></span>') + '</nav></section>';
};
function prSeg(key, cur){
  if (R.t.prFor !== key) { R.t.prFor = key; R.t.prPick = cur; }
  return '<div class="seg sm pr-seg" role="group" aria-label="중요도">' + [3, 2, 1].map(n => '<button data-act="prset" data-arg="' + n + '" aria-pressed="' + (R.t.prPick === n) + '"><span class="prs p' + n + '">' + starsHTML(n) + '</span>' + PR_LABEL[n] + '</button>').join('') + '</div>';
}
V.edit = p => {
  const b0 = X.cmap[p.id]; if (!b0) return subBar('내용 수정') + '<p class="empty">개념을 찾을 수 없어요.</p>';
  if (b0.mine) return V.myc({ id: p.id });
  const c = C(p.id), b = b0, o = b.o0 || b, has = !!SS().edits[p.id];
  return subBar('내용 수정') + '<section><h1 class="h-sm">' + esc(c.t) + '</h1><p class="sub">고친 내용은 이 기기에만 저장되고, 원래 내용으로 언제든 되돌릴 수 있어요. 설명·요약·암기 요령을 고치면 이 개념의 복습을 처음부터 다시 해요. 진도 탭의 ‘고친 내용’에서 친구에게 보내거나 모두에게 반영할 수 있어요.</p>' +
    '<label class="lbl" for="ed-t">제목</label><input id="ed-t" value="' + esc(c.t) + '">' +
    '<label class="lbl">시험 중요도<span>교수님이 강조했으면 올리고, 덜 중요하면 내려요. 공부 모드 범위가 바로 바뀌어요</span></label>' + prSeg('ed:' + p.id, c.pr) +
    '<label class="lbl" for="ed-mine">내 암기법<span>직접 만든 암기법이 가장 오래 남아요. 가장 먼저 보여요</span></label><textarea id="ed-mine" rows="3" placeholder="예: 기흉은 밀고, 무기폐는 당긴다">' + esc(SS().mine[p.id] || '') + '</textarea>' +
    '<label class="lbl" for="ed-mn">암기 요령<span>한 줄에 하나 · 머리글자 | 문장 · **굵게**</span></label><textarea id="ed-mn" rows="4">' + esc(c.mn.map(m => (m.k ? m.k + ' | ' : '') + m.s).join('\n')) + '</textarea>' +
    '<label class="lbl" for="ed-sum">요약<span>한 줄에 하나</span></label><textarea id="ed-sum" rows="6">' + esc(c.sum.join('\n')) + '</textarea>' +
    '<label class="lbl" for="ed-ex">설명<span>줄을 바꾸면 문단이 나뉘어요</span></label><textarea id="ed-ex" rows="9">' + esc(c.ex) + '</textarea>' +
    '<label class="lbl" for="ed-note">보완 메모<span>수업에서 들은 것, 교수님이 강조한 것 (설명 아래에 보여요)</span></label><textarea id="ed-note" rows="3">' + esc(c.note || '') + '</textarea>' +
    '<div class="row-btns"><button class="btn primary" data-act="saveEdit" data-arg="' + p.id + '">저장</button>' +
    (has ? '<button class="btn" data-act="resetEdit" data-arg="' + p.id + '">' + (R.t.confirm === 'reset-' + p.id ? '한 번 더 누르면 되돌려요' : '원래 내용으로 되돌리기') + '</button>' : '') + '</div>' +
    (has ? '<details class="why" style="margin-top:20px"><summary>원래 내용 보기</summary><p><b>' + esc(o.t) + '</b> ' + starsHTML(o.pr) + '</p>' + sumHTML(b) + memoHTML(b.mn) + (b.note ? '<p class="c-note">' + esc(b.note) + '</p>' : '') + '</details>' : '') + '</section>';
};
/* ───────── 내 개념 추가 ───────── */
V.myc = p => {
  const isNew = !p.id || p.id === 'new' || /^new:/.test(p.id); const m = isNew ? null : (SS().myc || []).find(x => x.id === p.id);
  if (!isNew && !m) return subBar('내 개념') + '<p class="empty">개념을 찾을 수 없어요.</p>';
  const u0 = isNew && /^new:/.test(p.id) ? p.id.slice(4) : null;
  const d = m || { u: u0 && X.umap[u0] ? u0 : X.units[0].id, t: '', pr: 2, ex: '', sum: [], mn: [], note: '', ox: [] };
  const oxTxt = (d.ox || []).map(o => o[0] + ' | ' + (o[1] ? 'O' : 'X')).join('\n');
  return subBar(isNew ? '내 개념 추가' : '내 개념 고치기') + '<section><p class="sub">교재나 수업에서 빠진 내용을 직접 넣어요. 넣은 개념은 새 개념 순서, 복습, 목차, 암기노트에 들어가요. 이 기기에만 저장되고, 진도 탭의 ‘고친 내용’에서 친구에게 보내거나 모두에게 반영할 수 있어요.</p>' +
    '<label class="lbl" for="my-u">단원</label><select id="my-u">' + X.units.map(u => '<option value="' + u.id + '"' + (u.id === d.u ? ' selected' : '') + '>' + u.n + '. ' + esc(u.title) + '</option>').join('') + '</select>' +
    '<label class="lbl" for="my-t">제목</label><input id="my-t" value="' + esc(d.t) + '" placeholder="예: 쿠스마울 호흡이 생기는 이유">' +
    '<label class="lbl">시험 중요도<span>★★★이면 당일치기에도 들어가요</span></label>' + prSeg('my:' + (m ? m.id : 'new'), clampPr(d.pr)) +
    '<label class="lbl" for="my-sum">요약<span>한 줄에 하나 · 시험에 나올 핵심</span></label><textarea id="my-sum" rows="4" placeholder="예: 대사성 산증을 보상하려고 깊고 빠르게 숨 쉰다">' + esc((d.sum || []).join('\n')) + '</textarea>' +
    '<label class="lbl" for="my-mn">암기 요령<span>한 줄에 하나 · 머리글자 | 문장 · **굵게** (없어도 돼요)</span></label><textarea id="my-mn" rows="2">' + esc((d.mn || []).map(z => (z.k ? z.k + ' | ' : '') + z.s).join('\n')) + '</textarea>' +
    '<label class="lbl" for="my-ex">설명<span>없어도 돼요</span></label><textarea id="my-ex" rows="5">' + esc(d.ex || '') + '</textarea>' +
    '<label class="lbl" for="my-note">보완 메모<span>출처, 교수님 강조 등 (없어도 돼요)</span></label><input id="my-note" value="' + esc(d.note || '') + '">' +
    '<label class="lbl" for="my-ox">O/X 문제<span>배운 직후 바로 확인용 · 한 줄에 하나 · 문장 | O 또는 문장 | X (없어도 돼요)</span></label><textarea id="my-ox" rows="2" placeholder="예: 쿠스마울 호흡은 대사성 알칼리증에서 나타난다. | X">' + esc(oxTxt) + '</textarea>' +
    '<div class="row-btns"><button class="btn primary" data-act="mycsave" data-arg="' + (m ? m.id : 'new') + '">저장</button>' +
    (m ? '<button class="btn danger" data-act="mycdel" data-arg="' + m.id + '">' + (R.t.confirm === 'mycdel-' + m.id ? '한 번 더 누르면 지워요' : '이 개념 지우기') + '</button>' : '') + '</div>' +
    '<p class="note">교재나 교수님 자료 문장을 그대로 옮기지 말고 내 말로 정리하세요. 내 말로 쓰면 더 잘 외워지고, 나중에 모두와 나눌 때도 문제가 없어요.</p></section>';
};
V.mine = () => {
  const ids = Object.keys(SS().mine).filter(k => SS().mine[k] && X.cmap[k]);
  return subBar('내 암기법') + '<section>' + (ids.length ? ids.map(k => '<div class="mini"><h3>' + esc(X.cmap[k].t) + '</h3>' + memoHTML([{ k: '내 암기법', s: SS().mine[k], mine: true }]) + '<div class="row-btns"><button class="btn" data-act="go" data-arg="edit:' + k + '">수정</button></div></div>').join('') : '<p class="empty">개념 카드의 ‘내 암기법 만들기’나 수정 버튼에서 나만의 암기법을 쓸 수 있어요.</p>') + '</section>';
};
V.flags = () => {
  const ids = Object.keys(SS().flags).filter(k => SS().flags[k] && X.cmap[k]);
  return subBar('확인 필요') + '<section><p class="sub">공부하다 의심 가는 내용에 표시해 둔 개념이에요. 교수님 자료를 받으면 이것부터 비교하세요.</p>' + (ids.length ? '<div class="list">' + ids.map(k => lrow('go', 'concept:' + k, X.cmap[k].t, X.umap[X.cmap[k].u].n + '단원')).join('') + '</div>' : '<p class="empty">표시한 개념이 없어요. 개념 카드의 깃발 버튼으로 표시해요.</p>') + '</section>';
};

/* ───────── 고친 내용: 모아 보기 · 보내기 · 합치기 · 모두에게 반영 ───────── */
function fixCounts(){
  const s = SS();
  return { ce: Object.keys(s.edits || {}).filter(k => X.cmap[k] && !X.cmap[k].mine).length, my: (s.myc || []).length,
    qe: Object.keys(s.qe || {}).filter(k => X.qmap[k]).length, qh: Object.keys(s.qh || {}).filter(k => X.qmap[k]).length };
}
const FIELD_LABEL = { t: '제목', pr: '중요도', ex: '설명', sum: '요약', mn: '암기 요령', note: '보완 메모' };
function fixPayload(){ const s = SS(); return { app: 'cheongjin-note', kind: 'fixes', v: 1, sid: X.id, title: X.title, ts: Date.now(), edits: s.edits || {}, myc: s.myc || [], qe: s.qe || {}, qh: Object.keys(s.qh || {}) }; }
function buildFix(){
  const s = SS(); const fx = JSON.parse(JSON.stringify(X.fix || {}));
  fx.v = 1; fx.made = Date.now(); fx.concepts = fx.concepts || {}; fx.add = fx.add || []; fx.qs = fx.qs || {}; fx.hide = fx.hide || [];
  Object.keys(s.edits || {}).forEach(id => {
    const c = X.cmap[id]; if (!c || c.mine) return; const e = s.edits[id]; const o = {};
    Object.keys(FIELD_LABEL).forEach(k => { if (e[k] != null) o[k] = e[k]; });
    const ai = fx.add.findIndex(z => z.id === id);
    if (ai >= 0) Object.assign(fx.add[ai], o); else fx.concepts[id] = Object.assign(fx.concepts[id] || {}, o);
  });
  (s.myc || []).forEach(m => { if (fx.add.some(z => z.id === m.id)) return; fx.add.push({ id: m.id, u: m.u, t: m.t, pr: clampPr(m.pr), ex: m.ex || '', sum: m.sum || [], mn: m.mn || [], note: m.note || '', ox: m.ox || [], kw: m.kw || [m.t] }); });
  Object.keys(s.qe || {}).forEach(id => { fx.qs[id] = Object.assign(fx.qs[id] || {}, s.qe[id]); });
  fx.hide = Array.from(new Set(fx.hide.concat(Object.keys(s.qh || {}))));
  return fx;
}
async function shareText(name, text, mime){
  try {
    const f = new File([text], name, { type: mime });
    if (navigator.canShare && navigator.share && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  return saveFile(name, text, mime);
}
V.fixes = () => {
  const s = SS(), n = fixCounts(), tot = n.ce + n.my + n.qe + n.qh, fx = X.fix;
  let h = subBar('고친 내용 · 내 개념') + '<section><p class="sub">이 기기에서 고치고 보탠 내용이에요. 친구에게 보내거나, 받은 것을 합치거나, 모두의 앱에 반영할 파일을 만들 수 있어요.</p>' +
    '<div class="stats4">' + [['고친 개념', n.ce], ['내 개념', n.my], ['고친 문제', n.qe], ['뺀 문제', n.qh]].map(z => '<div><b class="mono">' + z[1] + '</b><span>' + z[0] + '</span></div>').join('') + '</div>' +
    '<button class="btn" data-act="mycnew" data-arg="">' + ICON.edit + '내 개념 추가하기</button>' +
    '<p class="hint">개념 고치기는 개념 카드의 연필 버튼, 문제 고치기는 문제를 푼 뒤 해설 아래 ‘문제가 이상해요?’에서 해요.</p>';
  if (n.my) h += '<h3 class="h3">내 개념 <span>' + n.my + '개</span></h3><div class="list">' + s.myc.map(m => lrow('go', 'concept:' + m.id, m.t, (X.umap[m.u] ? X.umap[m.u].n + '단원 · ' : '') + '★'.repeat(clampPr(m.pr)) + ' · ' + ST_LABEL[status(m.id)])).join('') + '</div>';
  if (n.ce) h += '<h3 class="h3">고친 개념 <span>' + n.ce + '개</span></h3><div class="list">' + Object.keys(s.edits).filter(k => X.cmap[k] && !X.cmap[k].mine).map(k => lrow('go', 'concept:' + k, X.cmap[k].t, X.umap[X.cmap[k].u].n + '단원 · 고친 곳: ' + Object.keys(s.edits[k]).map(f => FIELD_LABEL[f]).filter(Boolean).join(', '))).join('') + '</div>';
  const qids = Array.from(new Set(Object.keys(s.qe || {}).concat(Object.keys(s.qh || {})))).filter(id => X.qmap[id]);
  if (qids.length) h += '<h3 class="h3">고친 문제 · 뺀 문제 <span>' + qids.length + '개</span></h3><div class="list">' + qids.map(id => { const q = X.qmap[id]; return lrow('go', 'qedit:' + id, q.q.length > 50 ? q.q.slice(0, 50) + '…' : q.q, (s.qh[id] ? '뺀 문제' : '고친 문제') + (q.u && X.umap[q.u] ? ' · ' + X.umap[q.u].n + '단원' : '')); }).join('') + '</div>';
  h += '<h3 class="h3">친구에게 보내기 <span>고친 내용만 담긴 작은 파일 · 학습 기록은 안 들어가요</span></h3>' +
    '<div class="row-btns"><button class="btn primary" data-act="fxsend"' + (tot ? '' : ' disabled') + '>' + ICON.share + '고친 내용 보내기</button><button class="btn" data-act="fxcopy"' + (tot ? '' : ' disabled') + '>복사하기</button></div>' +
    '<h3 class="h3">받은 고친 내용 합치기 <span>내가 이미 고친 곳은 내 것을 그대로 둬요</span></h3>' +
    '<input type="file" id="fx-file" accept=".json,application/json,text/plain"><label class="lbl" for="fx-in">또는 받은 내용 붙여넣기</label><textarea id="fx-in" rows="3"></textarea>' +
    (R.t.fxPending ? '<div class="confirm"><p>' + esc(R.t.fxPending.info) + '</p><div class="row-btns"><button class="btn primary" data-act="fxapply">합치기</button><button class="btn" data-act="fxcancel">취소</button></div></div>' : '<div class="row-btns"><button class="btn" data-act="fxload">읽어 보기</button></div>') +
    '<h3 class="h3">모두의 앱에 반영하기 <span>앱을 GitHub에 올리는 사람용</span></h3>' +
    '<ol class="steps"><li>친구들에게 받은 고친 내용을 위에서 모두 합쳐요.</li><li><b>반영 파일 만들기</b>를 눌러 <code>' + esc(X.id) + '-fix.js</code> 파일을 받아요.</li><li>GitHub 저장소의 <b>subjects</b> 폴더 → <b>Add file → Upload files</b>로 올리고 <b>Commit changes</b>.</li><li>1~2분 뒤 모든 사람의 앱에 반영돼요. 바뀐 개념은 다시 복습에 들어가고, 내 기기의 같은 수정은 저절로 정리돼요.</li></ol>' +
    '<button class="btn primary big" data-act="fxmake"' + (tot || fx ? '' : ' disabled') + '>반영 파일 만들기</button>' +
    (fx ? '<p class="hint">지금 앱에는 ' + (fx.made ? new Date(fx.made).toLocaleDateString('ko-KR') + '에 만든 ' : '') + '반영 파일이 들어 있어요. 새로 만들면 그 내용까지 모두 담겨요.</p>' : '') +
    '<p class="note">교재나 교수님 자료 문장을 그대로 옮기지 말고 내 말로 고쳐 쓰세요. 반영 파일은 공개 저장소(GitHub)에 올라가요. 기출문제는 넣지 마세요.</p></section>';
  return h;
};

/* ───────── 목차: 골라 공부하기 ───────── */
V.toc = () => {
  if (!R.t.sel) R.t.sel = (scopeIds() || []).slice();
  const sel = new Set(R.t.sel); const acc = conceptQAcc(); const weak = weakSet();
  if (!R.t.tocOpen) { R.t.tocOpen = {}; const nx = X.concepts.find(c => sel.has(c.id)) || X.concepts.find(c => !isLearned(c.id)); if (nx) R.t.tocOpen[nx.u] = true; }
  const open = R.t.tocOpen;
  let h = subBar('목차') + '<section class="toc"><p class="sub">공부할 단원이나 개념을 고르세요. ‘고른 것 공부’를 누르면 그 범위 안에서 공부하고, 범위가 저장돼서 ‘이어서 공부하기’도 그 안에서 진행돼요.' + (modeOf() !== 'all' ? ' 지금은 <b>' + MODES[modeOf()].name + '</b> 모드라 ' + MODES[modeOf()].range + '가 아닌 개념은 흐리게 보여요. 골라서 공부할 수는 있어요.' : '') + '</p>' +
    '<div class="tlegend"><span><b class="tck on sm">✓</b>고름</span><span><i class="wk">!</i>약함 (정답률 낮음·착각)</span><span>괄호 = 푼 문제 수</span><span>' + ADD_TAG + '새로 추가된 내용</span></div>' +
    '<div class="tlegend prl"><span><span class="prs p3">★★★</span>자주 출제</span><span><span class="prs p2">' + starsHTML(2) + '</span>중요</span><span><span class="prs p1">' + starsHTML(1) + '</span>기본</span></div>' +
    '<div class="chips-wrap tsel"><button class="chip-btn" data-act="tselq" data-arg="all">전체 고르기</button><button class="chip-btn" data-act="tselq" data-arg="none">모두 해제</button><button class="chip-btn" data-act="tselq" data-arg="top"><span class="prs p3">★★★</span> 자주 출제</button><button class="chip-btn" data-act="tselq" data-arg="top2">★★ 이상</button>' + (X.concepts.some(c => c.add) && !addOff() ? '<button class="chip-btn" data-act="tselq" data-arg="add">추가된 내용</button>' : '') + (X.concepts.some(c => c.mine) ? '<button class="chip-btn" data-act="tselq" data-arg="mine">내 개념</button>' : '') + '<button class="chip-btn" data-act="tselq" data-arg="new">안 배운 것</button><button class="chip-btn" data-act="tselq" data-arg="weak">약한 것</button></div>';
  X.units.forEach(u => {
    const us = unitStats(u); const ids = u.concepts.filter(addVisible).map(c => c.id); const n = ids.filter(id => sel.has(id)).length;
    const st = n === 0 ? '' : n === ids.length ? 'on' : 'part';
    h += '<div class="tu"><div class="tu-h"><button class="tck ' + st + '" data-act="tunit" data-arg="' + u.id + '" aria-label="' + esc(u.title) + ' 단원 전체 고르기">' + (st === 'on' ? '✓' : st === 'part' ? '–' : '') + '</button>' +
      '<button class="tu-t" data-act="topen" data-arg="' + u.id + '" aria-expanded="' + !!open[u.id] + '"><b>' + u.n + '. ' + esc(u.title) + '</b>' +
      '<span class="tu-m">배움 ' + us.L + '/' + us.n + ' · 진도 ' + us.prog + '% · 정답률 ' + (us.acc == null ? '–' : us.acc + '%') + (n ? ' · <em>' + n + '개 고름</em>' : '') + '</span>' +
      '<span class="tu-bars"><span class="ub2"><i style="width:' + us.prog + '%"></i></span><span class="ub2 acc"><i class="' + (us.acc != null && us.acc < 40 ? 'low' : '') + '" style="width:' + (us.acc || 0) + '%"></i></span></span></button>' +
      '<span class="tu-chev' + (open[u.id] ? ' up' : '') + '" aria-hidden="true">' + ICON.down + '</span></div>';
    if (open[u.id]) h += '<ul class="tlist">' + u.concepts.filter(addVisible).map(c => {
      const s = status(c.id); const a = acc[c.id]; const ap = a ? Math.round(a.ok / a.att * 100) : null; const wk = weak.has(c.id) || (ap != null && ap < 60);
      return '<li class="tc' + (sel.has(c.id) ? ' sel' : '') + (inRange(c) ? '' : ' out') + '"><button class="tck' + (sel.has(c.id) ? ' on' : '') + '" data-act="tpick" data-arg="' + c.id + '" aria-pressed="' + sel.has(c.id) + '" aria-label="' + esc(c.t) + ' 고르기">' + (sel.has(c.id) ? '✓' : '') + '</button>' +
        '<button class="tc-t" data-act="go" data-arg="concept:' + c.id + '"><span class="tc-name"><span class="tc-n mono">' + u.n + '-' + c.n + '</span>' + prMark(c) + (wk ? '<i class="wk">!</i>' : '') + esc(c.t) + cTags(c) + '</span>' +
        '<span class="tc-m"><span class="chip st-' + s + '">' + (s === 'new' ? '안 배움' : ST_LABEL[s]) + '</span>' + (ap != null ? '<span class="' + (ap < 60 ? 'low' : '') + '">정답률 ' + ap + '% (' + a.att + ')</span>' : '<span>문제 기록 없음</span>') + (inRange(c) ? '' : '<span class="outc">' + MODES[modeOf()].name + ' 범위 밖</span>') + '</span></button></li>';
    }).join('') + '</ul>';
    h += '</div>';
  });
  h += '</section><div class="tbar"><span class="tb-n"><b class="mono">' + sel.size + '</b>개 고름</span><button class="btn" data-act="tquiz"' + (sel.size ? '' : ' disabled') + '>문제 풀기</button><button class="btn primary" data-act="tstudy"' + (sel.size ? '' : ' disabled') + '>고른 것 공부</button></div>';
  return h;
};
function tocOrdered(){ const sel = new Set(R.t.sel || []); return X.concepts.filter(c => sel.has(c.id)).map(c => c.id); }

/* ───────── 검색 ───────── */
function searchRes(q0){
  const q = nospace(q0); if (!q) return '<p class="hint">예: 웨버, 쿠스마울, 흉골각, 곤봉지, 수포음</p>';
  const cs = X.concepts.map(c => C(c.id)).filter(c => nospace(c.t).includes(q) || (c.kw || []).some(k => nospace(k).includes(q)) || (c.sum || []).some(s => nospace(s).includes(q)) || mnList(c).some(m => nospace(plain(m.s) + (m.k || '')).includes(q)) || nospace(c.ex).includes(q)).slice(0, 30);
  const qs = allQ().concat(gcQs()).filter(x => nospace(x.q).includes(q) || x.o.some(o => nospace(o).includes(q))).slice(0, 30);
  return (cs.length ? '<h3 class="h3">개념 <span>' + cs.length + '개</span></h3><div class="list">' + cs.map(c => lrow('go', 'concept:' + c.id, c.t, X.umap[c.u].n + '단원 · ' + '★'.repeat(c.pr) + ' ' + PR_LABEL[c.pr] + ' · ' + ST_LABEL[status(c.id)], { tag: cTags(c) })).join('') + '</div>' : '') +
    (qs.length ? '<h3 class="h3">문제 <span>' + qs.length + '개</span></h3><div class="list">' + qs.map(x => lrow('go', 'qview:' + x.id, x.q.length > 60 ? x.q.slice(0, 60) + '…' : x.q, (x.gc ? '실제 기출' : x.type === 'ox' ? 'O/X' : '객관식') + (unlocked(x) ? '' : ' · 아직 안 배운 내용'))).join('') + '</div>' : '') +
    (!cs.length && !qs.length ? '<p class="empty">찾는 내용이 없어요.</p>' : '');
}
V.search = () => subBar('검색') + '<section><input id="search-q" type="search" placeholder="개념, 낱말, 문제 찾기" value="' + esc(R.t.sq || '') + '" autocomplete="off" enterkeyhint="search"><div id="search-res">' + searchRes(R.t.sq || '') + '</div></section>';

/* ───────── 설정 · 백업 (과목 밖에서도 열림) ───────── */
V.settings = () => {
  const t = R.t.confirm;
  return subBar('설정') + '<section>' +
    '<h3 class="h3" style="margin-top:8px">글자 크기</h3><div class="seg" role="group">' + [[0.9, '작게'], [1, '보통'], [1.12, '크게'], [1.25, '아주 크게']].map(x => '<button data-act="scale" data-arg="' + x[0] + '" aria-pressed="' + (S.set.scale === x[0]) + '">' + x[1] + '</button>').join('') + '</div>' +
    '<h3 class="h3">화면</h3><div class="seg" role="group">' + [['', '기기 설정'], ['light', '밝게'], ['dark', '어둡게']].map(x => '<button data-act="theme" data-arg="' + x[0] + '" aria-pressed="' + (S.set.theme === x[0]) + '">' + x[1] + '</button>').join('') + '</div>' +
    '<h3 class="h3">그림 넣기 안내 <span>새 개념을 배울 때 그림을 넣을지 물어봐요</span></h3><div class="seg" role="group"><button data-act="figset" data-arg="1" aria-pressed="' + !!S.set.figAsk + '">켜기</button><button data-act="figset" data-arg="0" aria-pressed="' + !S.set.figAsk + '">끄기</button></div>' +
    '<h3 class="h3">저장 공간</h3><div class="note" id="stor" style="margin-top:0">계산하는 중…</div>' +
    '<h3 class="h3">기록 지우기 <span>먼저 백업하세요</span></h3>' +
    (X ? (t === 'wipeS' ? '<div class="confirm"><p>' + esc(X.title) + ' 과목의 학습 기록, 내 암기법, 내가 넣은 문제, 내 개념, 고친 내용을 지울까요? 그림과 기출은 남아요.</p><div class="row-btns"><button class="btn danger" data-act="wipeS">지우기</button><button class="btn" data-act="wipeNo">취소</button></div></div>' : '<div class="row-btns"><button class="btn" data-act="wipeSask">' + esc(X.title) + ' 기록만 지우기</button></div>') : '') +
    (t === 'wipe' ? '<div class="confirm"><p>모든 과목의 기록, 국시 기출, 내 그림까지 모두 지울까요?</p><div class="row-btns"><button class="btn danger" data-act="wipeYes">모두 지우기</button><button class="btn" data-act="wipeNo">취소</button></div></div>' : '<div class="row-btns"><button class="btn" data-act="wipe">모든 기록 지우기</button></div>') + '</section>';
};
async function fillStorage(){
  const el = $('#stor'); if (!el) return;
  let ls = 0; try { ls = ((localStorage.getItem(KEY) || '').length + (localStorage.getItem(GKEY) || '').length) * 2; } catch (e) {}
  const imgB = IMG.meta.reduce((a, m) => a + (m.size || 0) + (m.thumb ? m.thumb.length : 0), 0);
  let est = null; try { if (navigator.storage && navigator.storage.estimate) est = await navigator.storage.estimate(); } catch (e) {}
  if (!el.isConnected) return;
  el.innerHTML = '학습 기록·기출 <b>' + mb(ls) + '</b> · 내 그림 <b>' + IMG.meta.length + '장, ' + mb(imgB) + '</b>' +
    (est && est.quota ? '<br>이 앱이 쓸 수 있는 공간 약 ' + mb(est.quota) + ' 중 ' + mb(est.usage || 0) + ' 사용' : '') +
    '<br><span class="hint">그림은 긴 쪽 1600픽셀(고화질 2400)로 줄여서 장당 0.2~0.4MB 정도예요.</span>';
}
function backupPayload(){ return { app: 'cheongjin-note', v: 2, ts: Date.now(), S, G }; }
V.backup = () => {
  const imgB = IMG.meta.reduce((a, m) => a + (m.size || 0), 0);
  return subBar('기록 백업') + '<section><p class="sub">기록은 이 기기의 브라우저에만 저장돼요. 브라우저 데이터를 지우거나 폰을 바꾸면 사라지니 일주일에 한 번 백업하세요.</p>' +
    '<p class="hint">마지막 백업: ' + (S.lastBackup ? new Date(S.lastBackup).toLocaleString('ko-KR') : '아직 없음') + '</p>' +
    '<div class="row-btns"><button class="btn primary" data-act="bkfile" data-arg="rec">기록만 파일로 저장</button><button class="btn" data-act="bkfile" data-arg="img"' + (IMG.meta.length ? '' : ' disabled') + '>기록 + 그림 저장</button><button class="btn" data-act="bkcopy">기록 복사하기</button></div>' +
    '<p class="hint">기록에는 학습 기록, 내 암기법, 수정한 내용, 내가 넣은 문제, 국시 기출이 들어가요. 내 그림 ' + IMG.meta.length + '장(' + mb(imgB) + ')은 ‘기록 + 그림’에만 들어가요. 기출이 들어 있으니 백업 파일은 다른 사람과 공유하지 마세요.</p>' +
    '<p class="hint">파일 저장이 안 되는 화면에서는 ‘기록 복사하기’를 누른 뒤 메모 앱이나 카카오톡 나에게 보내기에 붙여넣어 보관하세요.</p>' +
    '<h3 class="h3">불러오기 <span>지금 기록이 백업 내용으로 바뀌어요 · 1차 버전 백업도 돼요</span></h3>' +
    '<input type="file" id="bk-file" accept=".json,application/json,text/plain">' +
    '<label class="lbl" for="bk-in">또는 복사해 둔 내용 붙여넣기</label><textarea id="bk-in" rows="4">' + esc(R.t.bkText || '') + '</textarea>' +
    (R.t.bkPending ? '<div class="confirm"><p>백업 내용(' + esc(R.t.bkPending.info) + ')으로 바꿀까요?</p><div class="row-btns"><button class="btn danger" data-act="bkapply">바꾸기</button><button class="btn" data-act="bkcancel">취소</button></div></div>' : '<div class="row-btns"><button class="btn" data-act="bkload">불러오기</button></div>') + '</section>';
};
function blobToDataURL(b){ return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); }); }
function dataURLToBlob(u){ const p = String(u).split(','); const mime = (p[0].match(/:(.*?);/) || [])[1] || 'image/jpeg'; const bin = atob(p[1] || ''); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: mime }); }
function parseBackup(txt){
  const o = JSON.parse(txt);
  if (o && o.app === 'cheongjin-note' && o.v === 2 && o.S) return { S: normalize(o.S), G: o.G && Array.isArray(o.G.qs) ? o.G : null, imgs: Array.isArray(o.imgs) ? o.imgs : null };
  if (o && o.v === 2 && o.subj) return { S: normalize(o), G: null, imgs: null };
  if (o && o.v === 1 && typeof o.c === 'object') return { S: fromV1(o), G: null, imgs: null, v1: true };
  throw new Error('format');
}

Object.assign(ACT, {
  tpick: a => { const s = R.t.sel || (R.t.sel = []); const i = s.indexOf(a); if (i >= 0) s.splice(i, 1); else s.push(a); render(); },
  tunit: a => { const s = R.t.sel || (R.t.sel = []); const ids = X.umap[a].concepts.filter(addVisible).map(c => c.id); const all = ids.every(id => s.includes(id)); R.t.sel = all ? s.filter(id => !ids.includes(id)) : Array.from(new Set(s.concat(ids))); render(); },
  topen: a => { const o = R.t.tocOpen || (R.t.tocOpen = {}); o[a] = !o[a]; render(); },
  tselq: a => {
    const acc = conceptQAcc(); const weak = weakSet();
    const pick = a === 'all' ? () => true : a === 'none' ? () => false : a === 'new' ? c => !isLearned(c.id)
      : a === 'top' ? c => c.pr === 3 : a === 'top2' ? c => c.pr >= 2 : a === 'add' ? c => isAdd(c)
      : c => weak.has(c.id) || (acc[c.id] && acc[c.id].ok / acc[c.id].att < 0.6);
    R.t.sel = X.concepts.filter(addVisible).filter(a === 'mine' ? c => c.mine : pick).map(c => c.id);
    if (a === 'add' && !R.t.sel.length) toast('추가된 내용이 아직 없어요');
    if (a === 'weak' && !R.t.sel.length) toast('아직 약한 개념이 없어요. 문제를 풀면 정답률이 낮은 개념이 여기에 잡혀요');
    if (a !== 'none') { const o = R.t.tocOpen || (R.t.tocOpen = {}); X.units.forEach(u => { if (u.concepts.some(c => R.t.sel.includes(c.id))) o[u.id] = true; }); }
    render();
  },
  tstudy: () => { const ids = tocOrdered(); if (!ids.length) return; SS().scope = ids.length === X.concepts.filter(addVisible).length ? null : ids; save(); startSession('pick', ids.join(',')); },
  tquiz: () => { const ids = tocOrdered(); if (!ids.length) return; startQuiz('sel', ids.join(',')); },
  scopeclear: () => { SS().scope = null; R.t.sel = null; save(); render(); toast('공부 범위를 전체로 바꿨어요'); },
  tab: a => { while (R.stack.length) onLeave(R.stack.pop()); R.sheet = null; R.tab = a; render(true); },
  go: a => { const i = a.indexOf(':'); const name = i < 0 ? a : a.slice(0, i), id = i < 0 ? '' : a.slice(i + 1); if (!V[name]) return; go(name, { id }); },
  back: () => back(),
  swap: a => { const top = cur(); if (top) top.p = { id: a }; R.t.peek = null; render(true); },
  vmode: a => { R.viewMode = a; R.lv = {}; render(); },
  lv: a => { const p = a.split(':'); R.lv[p[0]] = +p[1]; R.t.peek = null; render(); },
  lvtap: (a, el, e) => { if (e && e.target.closest('summary,details,a,input,textarea,button,label,.mn-main')) return; const p = a.split(':'); R.lv[p[0]] = +p[1] === 0 ? 1 : 0; render(); },
  peek: a => { R.t.peek = R.t.peek === a ? null : a; render(); },
  speak: a => {
    const p = a.split(':'); const c = C(p[0]); const lv = +p[1];
    if (!('speechSynthesis' in window)) { toast('이 기기에서는 음성 읽기를 쓸 수 없어요'); return; }
    const text = lv === 0 ? c.t + '. ' + c.ex.replace(/\n/g, ' ') : lv === 2 ? mnList(c).map(m => m.s).join('. ') : c.t + '. ' + c.sum.join('. ');
    try { speechSynthesis.cancel(); } catch (e) {} say(text);
  },
  flag: a => { const f = SS().flags; if (f[a]) delete f[a]; else f[a] = Date.now(); save(); render(); toast(f[a] ? '확인 필요로 표시했어요' : '표시를 지웠어요'); },
  markLearned: a => { learnConcept(a); save(); render(); toast('복습 일정에 넣었어요'); },
  mnrate: a => {
    const p = a.split(':'); const r = SS().mnr[p[0]] || (SS().mnr[p[0]] = {});
    if (p[2] === 'up') { r[p[1]] = r[p[1]] === 'up' ? null : 'up'; toast('좋아요. 이 암기법을 먼저 보여 줄게요'); }
    else { r[p[1]] = 'down'; R.t.mnMine = p[0]; toast('다른 암기법을 먼저 보여 줄게요. 내 암기법을 만들어도 좋아요'); }
    save(); render();
  },
  mnmine: a => { R.t.mnMine = a; render(); const t = $('#mine-in'); if (t) t.focus(); },
  mncancel: () => { R.t.mnMine = null; render(); },
  mnsave: a => { const v = ($('#mine-in').value || '').trim(); if (v) SS().mine[a] = v; else delete SS().mine[a]; R.t.mnMine = null; save(); render(); toast(v ? '내 암기법을 저장했어요. 가장 먼저 보여요' : '내 암기법을 지웠어요'); },
  mndel: a => { delete SS().mine[a]; R.t.mnMine = null; save(); render(); },
  saveEdit: a => {
    const b = X.cmap[a]; const o = b.o0 || b; const mine = $('#ed-mine').value.trim();
    const mn = $('#ed-mn').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const i = l.indexOf('|'); const m = i >= 0 ? { k: l.slice(0, i).trim(), s: l.slice(i + 1).trim() } : { k: '', s: l };
      const orig = (b.mn || []).find(z => z.k === m.k); if (orig && orig.map && orig.k) m.map = orig.map;
      return m;
    });
    const sum = $('#ed-sum').value.split('\n').map(l => l.trim()).filter(Boolean);
    const ex = $('#ed-ex').value.trim(), t = $('#ed-t').value.trim(), note = $('#ed-note').value.trim();
    const pr = R.t.prFor === 'ed:' + a ? R.t.prPick : o.pr;
    if (mine) SS().mine[a] = mine; else delete SS().mine[a];
    const e = {};
    if (ex && ex !== b.ex) e.ex = ex;
    if (sum.length && !same(sum, b.sum)) e.sum = sum;
    if (mn.length && !same(mnKS(mn), mnKS(b.mn))) e.mn = mn;
    if (t && t !== o.t) e.t = t;
    if (pr && pr !== o.pr) e.pr = pr;
    if (note !== (b.note || '')) e.note = note;
    const p0 = SS().edits[a] || {};
    const body = z => [z.ex || null, z.sum || null, z.mn ? mnKS(z.mn) : null];
    const changed = !same(body(p0), body(e));
    if (Object.keys(e).length) SS().edits[a] = e; else delete SS().edits[a];
    if (changed && isLearned(a)) { const s = crec(a); s.step = 0; s.due = nextDue(0, Date.now()); s.lv0 = true; }
    applyLocal(X); R.sheetCache = null; R.t.prFor = null; save(); back(); toast('저장했어요');
  },
  resetEdit: a => { if (R.t.confirm !== 'reset-' + a) { R.t.confirm = 'reset-' + a; render(); return; } delete SS().edits[a]; R.t.confirm = null; R.t.prFor = null; applyLocal(X); R.sheetCache = null; save(); render(); toast('원래 내용으로 되돌렸어요'); },
  prset: (a, el) => { R.t.prPick = +a; const g = el && el.closest('.pr-seg'); if (g) g.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.arg === a))); },
  mycnew: a => go('myc', { id: 'new:' + (a || '') }),
  mycsave: a => {
    const v = id => (($('#' + id) || {}).value || '').trim(); const lines = id => v(id).split('\n').map(l => l.trim()).filter(Boolean);
    const t = v('my-t'), sum = lines('my-sum'), ex = v('my-ex');
    if (!t) { toast('제목을 써 주세요'); return; }
    if (!sum.length && !ex) { toast('요약이나 설명 중 하나는 써 주세요'); return; }
    const mn = lines('my-mn').map(l => { const i = l.indexOf('|'); return i >= 0 ? { k: l.slice(0, i).trim(), s: l.slice(i + 1).trim() } : { k: '', s: l }; });
    const ox = lines('my-ox').map(l => { const m = /^(.*)\|\s*([OoXx○×])\s*$/.exec(l); return m ? [m[1].trim(), /[Oo○]/.test(m[2]), ''] : null; }).filter(Boolean);
    const key = 'my:' + a; const pr = R.t.prFor === key ? R.t.prPick : 2;
    const list = SS().myc || (SS().myc = []);
    const d = { u: v('my-u') || X.units[0].id, t, pr, sum: sum.length ? sum : [ex.split('\n')[0].slice(0, 80)], ex, mn, note: v('my-note'), ox, kw: [t] };
    let id = a;
    if (a === 'new') { id = uid('my'); list.push(Object.assign({ id, ts: Date.now() }, d)); }
    else { const m = list.find(x => x.id === a); if (!m) return; Object.assign(m, d); }
    applyLocal(X); R.sheetCache = null; R.t.prFor = null; save();
    R.stack.pop(); if (a === 'new') go('concept', { id }); else render(true);
    toast(a === 'new' ? (inRange(X.cmap[id]) ? '내 개념을 넣었어요. 새 개념 순서에 들어가요' : '내 개념을 넣었어요. 지금 공부 모드 범위 밖이라 목차에서 골라 공부할 수 있어요') : '고쳤어요');
  },
  mycdel: a => {
    if (R.t.confirm !== 'mycdel-' + a) { R.t.confirm = 'mycdel-' + a; render(); return; }
    SS().myc = (SS().myc || []).filter(x => x.id !== a); R.t.confirm = null;
    if (SS().scope) SS().scope = SS().scope.filter(x => x !== a);
    const z = SS().qz; if (z && z.ids) { z.ids = z.ids.filter(x => x.indexOf(a + '-') !== 0); if (!z.ids.length) SS().qz = null; else if (z.i >= z.ids.length) z.i = z.ids.length - 1; }
    applyLocal(X); R.sheetCache = null; save(); R.stack = R.stack.filter(x => !(x.p && (x.p.id === a))); render(true); toast('내 개념을 지웠어요');
  },
  shclose: () => { R.sheet = null; renderSheet(); },
  shfull: () => { R.sheet.full = !R.sheet.full; renderSheet(); },
  shopen: a => { R.sheet = null; renderSheet(); go('concept', { id: a }); },
  shimg: a => { R.sheet = null; renderSheet(); go('imgview', { id: a }); },
  scale: a => { S.set.scale = +a; save(); applySettings(); render(); },
  theme: a => { S.set.theme = a; save(); applySettings(); render(); },
  figset: a => { S.set.figAsk = a === '1'; save(); render(); },
  wipe: () => { R.t.confirm = 'wipe'; render(); },
  wipeSask: () => { R.t.confirm = 'wipeS'; render(); },
  wipeNo: () => { R.t.confirm = null; render(); },
  wipeS: () => { S.subj[X.id] = freshSubj(); SS().lastUse = Date.now(); SS().known = { c: X.concepts.map(c => c.id), q: X.qs.map(q => q.id), h: {} }; X.concepts.forEach(c => { SS().known.h[c.id] = chash(c); }); applyLocal(X); R.t = {}; save(); R.stack = []; R.tab = 'study'; render(true); toast(X.title + ' 기록을 지웠어요'); },
  wipeYes: async () => {
    S = fresh(); G = { sets: [], qs: [] }; save(); saveG();
    try { for (const m of IMG.meta.slice()) await imgDel(m.id); } catch (e) {}
    R.t = {}; leaveSubject(); applySettings(); render(true); toast('모든 기록을 지웠어요');
  },
  bkfile: async a => {
    const withImg = a === 'img'; const fname = '청진노트-백업-' + (withImg ? '그림포함-' : '') + dkey(Date.now()) + '.json';
    const pl = backupPayload();
    if (withImg) {
      toast('그림을 묶는 중이에요…');
      try { const all = await idbReq('readonly', st => st.getAll()); pl.imgs = []; for (const r of all || []) { const m = stripBlob(r); m.data = r.full ? await blobToDataURL(r.full) : null; delete m.size; pl.imgs.push(m); } }
      catch (e) { toast('그림을 읽지 못했어요'); return; }
    }
    const ok = await saveFile(fname, JSON.stringify(pl), 'application/json');
    if (ok) { S.lastBackup = Date.now(); save(); render(); toast('백업 파일을 저장했어요'); }
  },
  bkcopy: () => { copyText(JSON.stringify(backupPayload()), '복사했어요. 메모 앱 등에 붙여넣어 보관하세요'); S.lastBackup = Date.now(); save(); },
  bkload: () => {
    const txt = (R.t.bkRaw != null ? R.t.bkRaw : ($('#bk-in').value || '')).trim(); R.t.bkRaw = null; R.t.bkText = txt.length < 200000 ? txt : '';
    try {
      const d = parseBackup(txt);
      const subjN = Object.keys(d.S.subj).length; let learned = 0; Object.keys(d.S.subj).forEach(k => { const c = d.S.subj[k].c || {}; learned += Object.keys(c).filter(x => c[x] && c[x].learned).length; });
      R.t.bkPending = { data: d, info: (d.v1 ? '1차 버전 · ' : '') + '과목 ' + subjN + '개, 배운 개념 ' + learned + '개' + (d.G ? ', 기출 ' + d.G.qs.length + '문항' : '') + (d.imgs ? ', 그림 ' + d.imgs.length + '장' : '') }; render();
    } catch (e) { toast('백업 내용을 읽을 수 없어요. 전체를 빠짐없이 붙여넣었는지 확인하세요'); }
  },
  bkapply: async () => {
    const d = R.t.bkPending.data; S = d.S; save();
    if (d.G) { G = d.G; saveG(); }
    if (d.imgs && IMG.ok) { for (const m of d.imgs) { try { if (!m.data) continue; const rec = Object.assign({}, m); rec.full = dataURLToBlob(m.data); delete rec.data; await imgPut(rec); } catch (e) {} } }
    R.t = {}; leaveSubject(); applySettings(); await restoreRouteAsync(); render(true); toast('기록을 불러왔어요');
  },
  bkcancel: () => { R.t.bkPending = null; render(); },
  fxsend: async () => { const d = new Date(); const ok = await shareText('청진노트-고친내용-' + X.title + '-' + dkey(Date.now()) + '.json', JSON.stringify(fixPayload()), 'application/json'); if (ok) toast('보냈어요. 받은 사람은 ‘받은 고친 내용 합치기’에서 열면 돼요'); },
  fxcopy: () => copyText(JSON.stringify(fixPayload()), '복사했어요. 카카오톡에 붙여넣어 보내세요'),
  fxload: () => {
    const raw = (R.t.fxRaw != null ? R.t.fxRaw : (($('#fx-in') || {}).value || '')).trim(); R.t.fxRaw = null;
    let d; try { d = JSON.parse(raw); } catch (e) { toast('내용을 읽을 수 없어요. 받은 파일이나 글자를 빠짐없이 넣었는지 확인하세요'); return; }
    if (!d || d.app !== 'cheongjin-note' || d.kind !== 'fixes') { toast('청진노트 고친 내용이 아니에요'); return; }
    if (d.sid !== X.id) { toast('다른 과목(' + (d.title || d.sid) + ')의 고친 내용이에요. 그 과목에 들어가서 합쳐 주세요'); return; }
    const s = SS(); let nw = 0, keep = 0;
    Object.keys(d.edits || {}).forEach(k => { if (!X.cmap[k] || X.cmap[k].mine) return; if (!s.edits[k]) nw++; else if (!same(s.edits[k], d.edits[k])) keep++; });
    (d.myc || []).forEach(m => { if (!(s.myc || []).some(x => x.id === m.id) && !X.cmap[m.id]) nw++; });
    Object.keys(d.qe || {}).forEach(k => { if (!X.qmap[k]) return; if (!s.qe[k]) nw++; else if (!same(s.qe[k], d.qe[k])) keep++; });
    (d.qh || []).forEach(k => { if (X.qmap[k] && !s.qh[k]) nw++; });
    R.t.fxPending = { d, info: (d.title || '') + ' 고친 내용에서 새로 합칠 것 ' + nw + '개' + (keep ? ', 내가 이미 다르게 고친 곳 ' + keep + '개(내 것을 그대로 둬요)' : '') + '. 합칠까요?' };
    render();
  },
  fxapply: () => {
    const d = R.t.fxPending && R.t.fxPending.d; if (!d) return; const s = SS(); let n = 0;
    Object.keys(d.edits || {}).forEach(k => { if (X.cmap[k] && !X.cmap[k].mine && !s.edits[k]) { s.edits[k] = d.edits[k]; n++; } });
    (d.myc || []).forEach(m => { if (m && m.id && X.umap[m.u] && !(s.myc || []).some(x => x.id === m.id) && !X.cmap[m.id]) { (s.myc || (s.myc = [])).push(m); n++; } });
    Object.keys(d.qe || {}).forEach(k => { if (X.qmap[k] && !s.qe[k]) { s.qe[k] = d.qe[k]; n++; } });
    (d.qh || []).forEach(k => { if (X.qmap[k] && !s.qh[k]) { s.qh[k] = Date.now(); n++; } });
    R.t.fxPending = null; applyLocal(X); R.sheetCache = null; save(); render(); toast(n + '개를 합쳤어요');
  },
  fxcancel: () => { R.t.fxPending = null; render(); },
  fxmake: async () => {
    const fx = buildFix();
    const txt = '/* 청진노트 반영 파일: ' + X.title + ' (' + dkey(Date.now()) + ' 만듦)\n * 이 파일을 GitHub 저장소의 subjects 폴더에 올리면 모든 사용자의 앱에 반영돼요.\n * 앱의 진도 → 고친 내용 → 반영 파일 만들기로 다시 만들 수 있어요. 직접 고치지 않아도 돼요.\n */\nNSA.fix(' + JSON.stringify(X.id) + ', ' + JSON.stringify(fx, null, 1) + ');\n';
    const ok = await shareText(X.id + '-fix.js', txt, 'text/javascript');
    if (ok) toast('반영 파일을 만들었어요. GitHub의 subjects 폴더에 올리세요');
  }
});

/* ───────── 그리기 ───────── */
const TABV = { study: vStudy, note: vNote, quiz: vQuizTab, prog: vProg };
V.session = vSession; V.quiz = vQuiz;
function render(top){
  const sc = cur(); let html;
  try {
    if (!R.sid) html = sc && V[sc.name] && ROOTOK.has(sc.name) ? V[sc.name](sc.p) : vSubjects();
    else if (sc && V[sc.name]) html = V[sc.name](sc.p);
    else html = (TABV[R.tab] || vStudy)();
  } catch (e) {
    try { console.error(e); } catch (x) {}
    html = '<div class="notice" style="margin-top:24px"><b>화면을 그리다 문제가 생겼어요</b><p>' + esc(e && e.message) + '</p><div class="row-btns"><button class="btn" data-act="resetView">처음 화면으로</button></div></div>';
  }
  appEl.innerHTML = html;
  const full = !!(sc && FULL.has(sc.name));
  const tabs = $('#tabs'); if (tabs) {
    tabs.hidden = !R.sid || full;
    tabs.querySelectorAll('[data-act="tab"]').forEach(b => { if (b.dataset.arg === R.tab && !sc) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  }
  document.body.classList.toggle('full', full || !R.sid);
  renderSheet();
  if (top) window.scrollTo(0, 0);
  persistRoute();
  afterRender();
}
function afterRender(){
  clearInterval(T.rev);
  const b = $('#reveal');
  if (b) { let n = 3; const cd = $('#cd'); T.rev = setInterval(() => { n--; if (cd) cd.textContent = n > 0 ? n : ''; if (n <= 0) { clearInterval(T.rev); b.disabled = false; } }, 1000); }
  clearInterval(T.quiz);
  const sc = cur();
  if (R.sid && sc && sc.name === 'quiz') {
    const z = SS().qz;
    if (z && !z.done) {
      if (!z.t0 && !document.hidden) z.t0 = Date.now();
      if (z.limit) T.quiz = setInterval(() => {
        const left = quizLeft(z); const el = $('#qtimer');
        if (left <= 0) { clearInterval(T.quiz); toast('시간이 끝나서 제출했어요'); submitQuiz(); return; }
        if (el) el.textContent = fmtMs(left);
      }, 1000);
    }
  }
  hydrate();
  if ($('#a4wrap')) requestAnimationFrame(() => { try { buildSheet(); } catch (e) { const w = $('#a4wrap'); if (w) w.innerHTML = '<p class="empty">요약지를 만들지 못했어요.</p>'; } });
  if (sc && sc.name === 'imgedit') setupEditor();
  if (sc && sc.name === 'imgmark') bindMark();
  if (sc && sc.name === 'imgmask') bindMask();
  if ($('#stor')) fillStorage();
  if (sc && sc.name === 'search') { const i = $('#search-q'); if (i && document.activeElement !== i && !R.t.sq) i.focus(); }
}
function applySettings(){
  document.documentElement.style.setProperty('--scale', S.set.scale || 1);
  if (S.set.theme) document.documentElement.setAttribute('data-theme', S.set.theme);
  else document.documentElement.removeAttribute('data-theme');
  const mc = document.querySelector('meta[name="theme-color"]');
  if (mc) mc.setAttribute('content', getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#edf3f2');
}

/* ───────── 이벤트 ───────── */
ACT.resetView = () => { R.stack = []; leaveSubject(); render(true); };
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const f = ACT[el.dataset.act];
  if (f) { tick(); f(el.dataset.arg || '', el, e); }
});
document.addEventListener('keydown', e => {
  const t = e.target;
  if ((e.key === 'Enter' || e.key === ' ') && t.getAttribute && t.getAttribute('role') === 'button' && t.dataset.act) { e.preventDefault(); t.click(); return; }
  if (t.matches && t.matches('input,textarea,select')) return;
  const sc = cur(); if (!sc || !R.sid) return;
  if (sc.name === 'session' && SS().ses) {
    const s = SS().ses; const st = s.steps[s.i];
    if (st.t === 'card') {
      if (!s.rev && (e.key === ' ' || e.key === 'Enter')) { const b = $('#reveal'); if (b && !b.disabled) { e.preventDefault(); ACT.reveal(); } }
      else if (s.rev && ['1', '2', '3'].includes(e.key)) ACT.grade(String(+e.key - 1));
    } else if (st.t === 'q' && !(s.q && s.q.shown) && /^[1-5]$/.test(e.key)) {
      const q = Q(st.qid); const d = +e.key - 1; const perm = (s.q && s.q.perm) || q.o.map((_, i) => i);
      if (d < perm.length) ACT.pick('sq:' + perm[d]);
    } else if (st.t === 'q' && s.q && s.q.shown && e.key === 'Enter') { e.preventDefault(); nextStep(); }
  }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'search-q') { R.t.sq = t.value; const r = $('#search-res'); if (r) r.innerHTML = searchRes(t.value); }
  else if (t.id === 'gq-in') { const a = $('#gq-a'); if (a) a.href = 'https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(t.value); }
  else if (t.id === 'pk-q' && R.sheet) { R.sheet.q = t.value; renderSheet(); const i = $('#pk-q'); if (i) { i.focus(); try { i.setSelectionRange(i.value.length, i.value.length); } catch (x) {} } }
  else if (/^gp-/.test(t.id)) { R.t.gp = { round: ($('#gp-round') || {}).value, period: ($('#gp-period') || {}).value, q: ($('#gp-q') || {}).value, a: ($('#gp-a') || {}).value }; }
  else if (t.id === 'bk-in') { R.t.bkRaw = null; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.matches && t.matches('input[type=file][data-pick]')) { const files = Array.from(t.files || []); const tg = t.dataset.pick; t.value = ''; if (files.length) { tick(); startEditor(files, tg); } return; }
  if (t.id === 'fx-file' && t.files && t.files[0]) {
    const rd = new FileReader(); rd.onload = () => { R.t.fxRaw = String(rd.result || ''); ACT.fxload(); }; rd.readAsText(t.files[0]); return;
  }
  if (t.id === 'bk-file' && t.files && t.files[0]) {
    const rd = new FileReader();
    rd.onload = () => { const txt = String(rd.result || ''); R.t.bkRaw = txt; const ta = $('#bk-in'); if (ta) ta.value = txt.length < 200000 ? txt : '(큰 백업 파일을 읽었어요)'; ACT.bkload(); };
    rd.readAsText(t.files[0]); return;
  }
  if (t.dataset && t.dataset.gf) {
    const d = S.gdraft; const it = d && d.items[+t.dataset.i]; if (!it) return;
    if (t.dataset.gf === 'a') it.a = t.value === '' ? null : +t.value; else it.sub = t.value;
    save(); render(); return;
  }
  if (t.id === 'pk-other' && R.sheet) { R.sheet.other = t.checked; renderSheet(); }
  if (t.id === 'ed-hq' && R.ed) R.ed.hq = t.checked;
});
function pauseTimers(){
  if (!R.sid) return; const z = SS().qz;
  if (z && !z.done && z.t0) { z.used += Date.now() - z.t0; z.t0 = null; }
  save();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseTimers();
  else { R.lastAct = Date.now(); const sc = cur(); const z = R.sid && SS().qz; if (z && !z.done && sc && sc.name === 'quiz') z.t0 = Date.now(); }
});
window.addEventListener('pagehide', pauseTimers);
let rsT;
window.addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { if ($('#a4wrap') && R.sheetCache) showSheet(); if ($('#ed-cv')) drawEditor(); }, 200); });

/* ───────── 시작 ───────── */
function loadScript(src){
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.charset = 'utf-8'; s.onload = () => res(); s.onerror = () => rej(new Error(src)); document.head.appendChild(s); });
}
async function boot(){
  appEl.innerHTML = '<p class="empty">불러오는 중…</p>';
  const list = window.NSA_LIST;
  if (!list) { appEl.innerHTML = '<div class="notice" style="margin-top:24px"><b>과목 목록(subjects/list.js)을 불러오지 못했어요</b><p>index.html 옆에 subjects 폴더가 있는지 확인해 주세요.</p></div>'; return; }
  ORDER = list.filter(it => it && it.id).map(it => it.id);
  await idbOpen(); try { await imgLoadMeta(); } catch (e) {}
  Object.keys(S.subj).forEach(k => { const z = S.subj[k].qz; if (z && z.t0) z.t0 = null; });
  applySettings(); await restoreRouteAsync(); render(true);
  prefetchSums();
}
/* 마지막에 있던 화면의 과목만 먼저 불러와요 */
async function restoreRouteAsync(){ const r = S.route; if (r && r.sid && ORDER.includes(r.sid)) await ensureSubject(r.sid); restoreRoute(); }
/* 첫 화면 요약이 없는 과목은 뒤에서 조용히 한 번 불러와 둬요 */
async function prefetchSums(){
  const hide = S.set.hideSubj || {};
  for (const id of ORDER) {
    if (SUB[id] || S.sums[id] || hide[id]) continue;
    await ensureSubject(id);
    if (!R.sid) render();
  }
}
/* 폰에 앱으로 설치할 때만 */
(function(){
  let top = true; try { top = window.self === window.top; } catch (e) { top = false; }
  if (!top || location.protocol !== 'https:') return;
  const m = document.createElement('link'); m.rel = 'manifest'; m.href = 'manifest.json'; document.head.appendChild(m);
  const ic = document.createElement('link'); ic.rel = 'apple-touch-icon'; ic.href = 'icon-192.png'; document.head.appendChild(ic);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
window.__CJ = { S: () => S, G: () => G, R, ACT, SUB, X: () => X, IMG, render, gParse, gAnswers, gSplit, gCleanLines, autoLink, paginate, subjStats, reviewPool, Q, save, ensureSubject, applyLocal, allQ, CS, buildFix, nextNew, dueList, LOADERR };
boot();
})();
