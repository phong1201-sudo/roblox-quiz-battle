// server/notebook.js
// "Sổ ghi nhớ" — every player's notebook of questions they answered wrong.
//
// Shared by every game of the hub: a game reports each answer with
// record(); a wrong answer writes (or re-opens) an entry, and an entry is
// ticked off ("mastered") once its question is answered right twice in a row,
// in any game or in the notebook's own review mode.
//
// One document per player in the generic key/value store (MongoDB), key
// "notebook:<userId>"; without MongoDB it falls back to data/notebooks.json.

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const LOCAL_FILE   = path.join(__dirname, '../data/notebooks.json');
const KEY_PREFIX   = 'notebook:';
const MAX_ENTRIES  = 400;          // per player; oldest mastered entries go first
const STREAK_TO_MASTER = 2;        // right answers in a row that clear an entry

let _store = null;                 // { kvGet, kvSet, kvList } from db.js
const _cache = new Map();          // userId -> entries[]
let _local = null;                 // fallback store contents

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
    console.warn('[notebook] Local write warning:', e.message);
  }
}

async function _load(userId) {
  const id = String(userId);
  if (_cache.has(id)) return _cache.get(id);
  let entries = null;
  if (_store && _store.kvGet) {
    try { entries = await _store.kvGet(KEY_PREFIX + id); } catch (e) { /* fall back */ }
  }
  if (!Array.isArray(entries)) entries = _readLocal()[id];
  if (!Array.isArray(entries)) entries = [];
  _cache.set(id, entries);
  return entries;
}

async function _save(userId, entries) {
  const id = String(userId);
  _cache.set(id, entries);
  let saved = false;
  if (_store && _store.kvSet) {
    try { saved = await _store.kvSet(KEY_PREFIX + id, entries); }
    catch (e) { console.warn('[notebook] Could not save to the database:', e.message); }
  }
  if (!saved) { _readLocal()[id] = entries; _writeLocal(); }
}

// ── helpers ───────────────────────────────────────────────────────────────────
function _norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

function keyOf(questionText) {
  return crypto.createHash('sha1').update(_norm(questionText)).digest('hex').slice(0, 16);
}

const _str = (v, max) => String(v ?? '').trim().slice(0, max);

function _trim(entries) {
  if (entries.length <= MAX_ENTRIES) return entries;
  const byAge = (a, b) => String(a.lastSeenAt).localeCompare(String(b.lastSeenAt));
  const mastered = entries.filter(e => e.mastered).sort(byAge);
  const drop = new Set(mastered.slice(0, entries.length - MAX_ENTRIES).map(e => e.key));
  let kept = entries.filter(e => !drop.has(e.key));
  if (kept.length > MAX_ENTRIES) kept = kept.sort(byAge).slice(kept.length - MAX_ENTRIES);
  return kept;
}

/**
 * Report one answer.
 * @param {number|string} userId
 * @param {{ element, game, question, options[], correctText, chosenText, explanation, subject, correct }} a
 * @returns {{ ok, changed, entry? }}
 */
async function record(userId, a) {
  const question = _str(a && a.question, 1200);
  if (!userId || !question) return { ok: false, error: 'userId and question required' };
  const entries = await _load(userId);
  const key = keyOf(question);
  const now = new Date().toISOString();
  let entry = entries.find(e => e.key === key);

  if (!a.correct) {
    if (!entry) {
      entry = { key, question, wrongCount: 0, streak: 0, firstWrongAt: now };
      entries.push(entry);
    }
    Object.assign(entry, {
      element:     _str(a.element, 20) || entry.element || '',
      game:        _str(a.game, 30) || entry.game || 'battle',
      subject:     _str(a.subject, 40) || entry.subject || '',
      options:     Array.isArray(a.options) ? a.options.slice(0, 4).map(o => _str(o, 400)) : (entry.options || []),
      correctText: _str(a.correctText, 400) || entry.correctText || '',
      explanation: _str(a.explanation, 600) || entry.explanation || '',
      lastChosen:  a.chosenText ? _str(a.chosenText, 400) : '(hết giờ)',
      wrongCount:  (entry.wrongCount || 0) + 1,
      streak:      0,
      mastered:    false,
      masteredAt:  null,
      lastWrongAt: now,
      lastSeenAt:  now,
    });
  } else {
    if (!entry || entry.mastered) return { ok: true, changed: false };
    entry.streak = (entry.streak || 0) + 1;
    entry.lastRightAt = now;
    entry.lastSeenAt = now;
    if (entry.streak >= STREAK_TO_MASTER) {
      entry.mastered = true;
      entry.masteredAt = now;
    }
  }

  const kept = _trim(entries);
  await _save(userId, kept);
  return { ok: true, changed: true, entry };
}

/** All entries of a player: still to review first (newest mistake first), then mastered. */
async function list(userId) {
  const entries = await _load(userId);
  const byWrong = (a, b) => String(b.lastWrongAt).localeCompare(String(a.lastWrongAt));
  return [
    ...entries.filter(e => !e.mastered).sort(byWrong),
    ...entries.filter(e => e.mastered).sort((a, b) => String(b.masteredAt).localeCompare(String(a.masteredAt))),
  ];
}

/** Every player's notebook, for the admin page. */
async function allNotebooks() {
  const out = new Map();
  if (_store && _store.kvList) {
    try {
      for (const { key, value } of await _store.kvList(KEY_PREFIX)) {
        if (Array.isArray(value)) out.set(key.slice(KEY_PREFIX.length), value);
      }
    } catch (e) { console.warn('[notebook] Could not list notebooks:', e.message); }
  }
  for (const [id, entries] of Object.entries(_readLocal())) if (!out.has(id)) out.set(id, entries);
  for (const [id, entries] of _cache) out.set(id, entries);
  return out;
}

module.exports = { init, record, list, allNotebooks, keyOf, STREAK_TO_MASTER };
