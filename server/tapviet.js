// server/tapviet.js
// "Rồng Con Tập Viết" — handwriting progress of each child, shared account with
// the quiz games of the hub.
//
// One document per player in the generic key/value store (MongoDB), key
// "tapviet:<userId>"; without MongoDB it falls back to data/tapviet.json.
//
// Progress shape (sent by the client, merged here so a stale device can never
// erase what another device already earned):
//   { v: 1,
//     items: { "<char>": { stars: 1..3, times: n, at: iso } },   // letters + digits
//     words: [ "con cá", ... ],                                  // collected words
//     stages: { ghepvan: {...}, gheptu: {...} },                 // later game stages
//     updatedAt: iso }

const path = require('path');
const fs   = require('fs');

const LOCAL_FILE = path.join(__dirname, '../data/tapviet.json');
const KEY_PREFIX = 'tapviet:';
const MAX_BYTES  = 64 * 1024;

let _store = null;                 // { kvGet, kvSet } from db.js
const _cache = new Map();          // userId -> progress
let _local = null;

function init(store) { _store = store || null; }

// ── storage ───────────────────────────────────────────────────────────────────
function _readLocal() {
  if (_local) return _local;
  try { _local = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8')) || {}; }
  catch (e) { _local = {}; }
  return _local;
}

function _writeLocal() {
  try {
    const tmp = LOCAL_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(_local || {}, null, 1), 'utf8');
    fs.renameSync(tmp, LOCAL_FILE);
  } catch (e) {
    console.warn('[tapviet] Local write warning:', e.message);
  }
}

function empty() { return { v: 1, items: {}, words: [], stages: {}, updatedAt: null }; }

async function get(userId) {
  const id = String(userId);
  if (_cache.has(id)) return _cache.get(id);
  let data = null;
  if (_store && _store.kvGet) {
    try { data = await _store.kvGet(KEY_PREFIX + id); } catch (e) { /* fall back */ }
  }
  if (!data || typeof data !== 'object') data = _readLocal()[id];
  data = clean(data);
  _cache.set(id, data);
  return data;
}

async function _put(userId, data) {
  const id = String(userId);
  _cache.set(id, data);
  let saved = false;
  if (_store && _store.kvSet) {
    try { saved = await _store.kvSet(KEY_PREFIX + id, data); }
    catch (e) { console.warn('[tapviet] Could not save to the database:', e.message); }
  }
  if (!saved) { _readLocal()[id] = data; _writeLocal(); }
}

// ── validation & merge ────────────────────────────────────────────────────────
const _str = (v, max) => String(v ?? '').trim().slice(0, max);

function clean(p) {
  const out = empty();
  if (!p || typeof p !== 'object') return out;
  if (p.items && typeof p.items === 'object') {
    for (const [ch, it] of Object.entries(p.items)) {
      const key = _str(ch, 4);
      if (!key || !it || typeof it !== 'object') continue;
      out.items[key] = {
        stars: Math.max(1, Math.min(3, Math.round(Number(it.stars) || 1))),
        times: Math.max(1, Math.min(9999, Math.round(Number(it.times) || 1))),
        at:    _str(it.at, 40) || null,
      };
    }
  }
  if (Array.isArray(p.words)) {
    out.words = [...new Set(p.words.map(w => _str(w, 60)).filter(Boolean))].slice(0, 2000);
  }
  if (p.stages && typeof p.stages === 'object') out.stages = p.stages;
  out.updatedAt = _str(p.updatedAt, 40) || null;
  return out;
}

/** Union of two progress records: best stars, most practice, every word. */
function merge(a, b) {
  a = clean(a); b = clean(b);
  const out = empty();
  for (const src of [a, b]) {
    for (const [ch, it] of Object.entries(src.items)) {
      const cur = out.items[ch];
      out.items[ch] = cur ? {
        stars: Math.max(cur.stars, it.stars),
        times: Math.max(cur.times, it.times),
        at:    String(cur.at || '') > String(it.at || '') ? cur.at : it.at,
      } : { ...it };
    }
  }
  out.words  = [...new Set([...a.words, ...b.words])];
  out.stages = { ...a.stages, ...b.stages };
  out.updatedAt = new Date().toISOString();
  return out;
}

/** Merge what the client sends into what is stored; returns the stored result. */
async function save(userId, incoming) {
  if (!userId) return { ok: false, error: 'userId required' };
  if (JSON.stringify(incoming || {}).length > MAX_BYTES) {
    return { ok: false, error: 'Dữ liệu tiến trình quá lớn.' };
  }
  const merged = merge(await get(userId), incoming);
  await _put(userId, merged);
  return { ok: true, progress: merged };
}

/** Wipe one child's progress (parent-confirmed reset in the game). */
async function reset(userId) {
  const fresh = empty();
  fresh.updatedAt = new Date().toISOString();
  await _put(userId, fresh);
  return { ok: true, progress: fresh };
}

module.exports = { init, get, save, reset, merge, clean };
