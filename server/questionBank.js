// server/questionBank.js
// Question banks, one per element, stored in data/question/{element}.json.
//
// Questions accumulate in numbered batches ("đợt", e.g. one per school chapter):
//   - every upload in "append" mode adds a new batch on top of the existing bank
//   - the admin chooses per element what a battle draws from:
//       scope 'latest' -> only the newest batch   (practise the new chapter)
//       scope 'all'    -> the whole bank          (revision before an exam)
//
// Render's disk is wiped on every restart, so when MongoDB is connected the
// banks and the scope settings are mirrored there and restored on boot.

const path = require('path');
const fs   = require('fs');

const BANK_DIR = path.join(__dirname, '../data/question');
const UNIFIED_BANK_FILE = path.join(__dirname, '../data/question_bank.json');
const SETTINGS_FILE = path.join(__dirname, '../data/question_settings.json');

const ELEMENTS = ['thunder', 'fire', 'frost'];
const SCOPES = ['all', 'latest'];
const LETTERS = ['A', 'B', 'C', 'D'];

// ── Difficulty configuration ───────────────────────────────────────────────────
const DIFFICULTY_CONFIG = {
  easy:   { count: 20, bossHpMultiplier: 1 },
  medium: { count: 30, bossHpMultiplier: 1 },
  hard:   { count: 50, bossHpMultiplier: 1 },
  dev:    { count:  5, bossHpMultiplier: 1 },  // God Father quick test: 5 questions
};

// Set by hydrate(): the db module, used to mirror changes to MongoDB
let _store = null;

function _persist(key, value) {
  if (!_store || !_store.kvSet) return;
  Promise.resolve(_store.kvSet(key, value))
    .catch(err => console.warn(`[questionBank] Could not save "${key}" to the database:`, err.message));
}

// ── Internal: sync unified question_bank.json on disk ──────────────────────────
function _syncUnifiedBankFile(element, questionsArray) {
  try {
    let current = {};
    if (fs.existsSync(UNIFIED_BANK_FILE)) {
      try { current = JSON.parse(fs.readFileSync(UNIFIED_BANK_FILE, 'utf8')); } catch(e) {}
    }
    current[element] = questionsArray;
    const tmp = UNIFIED_BANK_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(current, null, 2), 'utf8');
    fs.renameSync(tmp, UNIFIED_BANK_FILE);
  } catch (err) {
    console.error('[questionBank] Failed to sync unified bank file:', err.message);
  }
}

// ── Internal: find element file in directory case-insensitively ───────────────
function _findElementFile(dir, element) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  const target = `${element.toLowerCase()}.json`;
  const match = files.find(f => f.toLowerCase() === target);
  return match ? path.join(dir, match) : null;
}

// ── Internal: load raw bank from disk ────────────────────────────────────────
function _loadBank(element) {
  const el = (element || '').toLowerCase();
  // 1. Check data/question/ directory
  const file = _findElementFile(BANK_DIR, el);
  if (file && fs.existsSync(file)) {
    try {
      const content = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(content) && content.length > 0) return content;
    } catch (e) {}
  }

  // 2. Check unified bank file
  if (fs.existsSync(UNIFIED_BANK_FILE)) {
    try {
      const all = JSON.parse(fs.readFileSync(UNIFIED_BANK_FILE, 'utf8'));
      if (Array.isArray(all[el]) && all[el].length > 0) {
        return all[el];
      }
    } catch(e) {}
  }

  return [];
}

// ── Internal: Fisher-Yates shuffle (returns new array) ───────────────────────
function _shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Internal: normalise text for dedup comparison ─────────────────────────────
function _norm(str) {
  return String(str || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// ── Public: index (0-3) of the correct option, whatever format the item uses ──
// Accepts correctIndex, a numeric answer (0-3) or a letter answer ('A'-'D').
function resolveCorrectIndex(q) {
  const inRange = n => Number.isInteger(n) && n >= 0 && n <= 3;
  if (inRange(q.correctIndex)) return q.correctIndex;
  if (inRange(q.answer)) return q.answer;
  if (typeof q.answer === 'string') {
    const s = q.answer.trim().toUpperCase();
    const letter = LETTERS.indexOf(s);
    if (letter !== -1) return letter;
    if (/^[0-3]$/.test(s)) return Number(s);
  }
  return 0;
}

function _batchOf(q) {
  return Number.isInteger(q.batch) && q.batch > 0 ? q.batch : 1;
}

// ── Internal: one shape for every consumer ────────────────────────────────────
// (the seed files use {question, answer:<index>}, uploads use {text, correctIndex})
function _normalise(q, i) {
  const options = Array.isArray(q.options)
    ? q.options
    : LETTERS.map(k => q.options?.[k] ?? '');
  const correctIndex = resolveCorrectIndex(q);
  const text = q.text || q.question || '';
  return {
    id:           q.id ?? i + 1,
    question:     text,
    text,
    options,
    answer:       correctIndex,
    correctIndex,
    batch:        _batchOf(q),
    batchLabel:   q.batchLabel || '',
  };
}

// ── Settings: which part of the bank a battle draws from ─────────────────────
function _loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {}
  return {};
}

function getScope(element) {
  const scope = _loadSettings()[(element || '').toLowerCase()]?.scope;
  return SCOPES.includes(scope) ? scope : 'all';
}

function setScope(element, scope) {
  const el = (element || '').toLowerCase();
  if (!ELEMENTS.includes(el)) throw new Error('element phải là thunder | fire | frost');
  if (!SCOPES.includes(scope)) throw new Error('scope phải là all | latest');
  const settings = _loadSettings();
  settings[el] = { ...(settings[el] || {}), scope };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
  _persist('question_settings', settings);
  return scope;
}

// ── Public: batches of a bank, oldest first ──────────────────────────────────
function getBatches(element) {
  const byBatch = new Map();
  _loadBank(element).forEach((q) => {
    const b = _batchOf(q);
    const entry = byBatch.get(b) || { batch: b, label: '', count: 0 };
    entry.count++;
    if (!entry.label && q.batchLabel) entry.label = q.batchLabel;
    byBatch.set(b, entry);
  });
  return [...byBatch.values()].sort((a, b) => a.batch - b.batch);
}

// ── Public: everything the admin screens need about one bank ─────────────────
function getOverview(element) {
  const batches = getBatches(element);
  const latest = batches[batches.length - 1] || null;
  return {
    total:       batches.reduce((sum, b) => sum + b.count, 0),
    scope:       getScope(element),
    batches,
    latestBatch: latest ? latest.batch : 0,
    latestCount: latest ? latest.count : 0,
    latestLabel: latest ? latest.label : '',
  };
}

// ── Public: the questions battles may use, per the admin's scope ─────────────
function getPlayableQuestions(element) {
  const bank = _loadBank(element).map(_normalise);
  if (getScope(element) !== 'latest' || bank.length === 0) return bank;
  const latest = Math.max(...bank.map(q => q.batch));
  return bank.filter(q => q.batch === latest);
}

// ── Public: the whole bank (admin explorer) ───────────────────────────────────
function getAllQuestions(element) {
  return _loadBank(element).map(_normalise);
}

// ── Public: get question count for a bank ────────────────────────────────────
function getBankSize(element) {
  return _loadBank(element).length;
}

// ── Public: sample N questions & shuffle their options ───────────────────────
// Returns array of { question, options:[A,B,C,D], correctIndex, answer } —
// the same shape roomManager.setQuestions() already stores.
function sampleQuestions(element, difficulty) {
  const cfg  = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const pool = getPlayableQuestions(element);
  if (pool.length === 0) return [];   // caller falls back to demo questions

  // Sample up to cfg.count from the pool (without replacement)
  const selected = _shuffle(pool).slice(0, Math.min(cfg.count, pool.length));

  // For each question, shuffle its options & update correctIndex
  return selected.map((q, qIdx) => {
    const tagged = q.options.map((text, i) => ({ text, isCorrect: i === q.correctIndex }));
    const shuffledOpts = _shuffle(tagged);
    const newCorrectIndex = shuffledOpts.findIndex(o => o.isCorrect);
    return {
      id:           q.id ?? qIdx + 1,
      question:     q.question,
      options:      shuffledOpts.map(o => o.text),
      correctIndex: newCorrectIndex,
      answer:       LETTERS[newCorrectIndex] || 'A',
    };
  });
}

// ── Internal: save to data/question directory ────────────────────────────────
function _saveToDirs(element, questionsArray) {
  const el = (element || '').toLowerCase();
  if (!fs.existsSync(BANK_DIR)) fs.mkdirSync(BANK_DIR, { recursive: true });
  const existingFile = _findElementFile(BANK_DIR, el);
  const targetFile = existingFile || path.join(BANK_DIR, `${el}.json`);
  const tmp = targetFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(questionsArray, null, 2), 'utf8');
  fs.renameSync(tmp, targetFile);

  // Also ensure capitalized version exists if applicable (e.g. Fire.json, Frost.json)
  const capName = el.charAt(0).toUpperCase() + el.slice(1) + '.json';
  const capPath = path.join(BANK_DIR, capName);
  if (capPath !== targetFile) {
    try { fs.writeFileSync(capPath, JSON.stringify(questionsArray, null, 2), 'utf8'); } catch (e) {}
  }
}

function _save(element, questionsArray) {
  const el = (element || '').toLowerCase();
  _saveToDirs(el, questionsArray);
  _syncUnifiedBankFile(el, questionsArray);
  _persist(`questions:${el}`, questionsArray);
}

// ── Public: replace a bank atomically (everything becomes batch 1) ───────────
function replaceBank(element, questionsArray, label = '') {
  const numbered = questionsArray.map((q, i) => ({ ...q, id: i + 1, batch: 1, batchLabel: label || '' }));
  _save(element, numbered);
  return numbered.length;
}

// ── Public: add questions as a NEW batch (skip duplicates by normalised text) ─
function appendBank(element, newQuestions, label = '') {
  const existing = _loadBank(element).map(q => ({ ...q, batch: _batchOf(q) }));
  const seen = new Set(existing.map(q => _norm(q.text || q.question)));
  const toAdd = [];
  newQuestions.forEach((q) => {
    const key = _norm(q.text || q.question);
    if (!key || seen.has(key)) return;
    seen.add(key);
    toAdd.push(q);
  });

  const batch = existing.reduce((max, q) => Math.max(max, q.batch), 0) + 1;
  const merged = [
    ...existing,
    ...toAdd.map(q => ({ ...q, batch, batchLabel: label || '' })),
  ].map((q, i) => ({ ...q, id: i + 1 }));

  if (toAdd.length > 0) _save(element, merged);
  return {
    total:   merged.length,
    added:   toAdd.length,
    skipped: newQuestions.length - toAdd.length,
    batch:   toAdd.length > 0 ? batch : null,
  };
}

// ── Public: clear a bank completely ──────────────────────────────────────────
function clearBank(element) {
  _save(element, []);
}

// ── Public: get active questions directly from permanent bank ────────────────
function getActiveQuestionBank(element) {
  if (element) return _loadBank(element);
  return {
    thunder: _loadBank('thunder'),
    fire: _loadBank('fire'),
    frost: _loadBank('frost'),
  };
}

// ── Public: restore banks & settings saved in MongoDB (call once at boot) ────
// Uploaded questions live on Render's ephemeral disk; without this they would
// fall back to the files shipped in the repository after every restart.
async function hydrate(store) {
  _store = store;
  if (!store || !store.kvGet) return;
  try {
    for (const el of ELEMENTS) {
      const saved = await store.kvGet(`questions:${el}`);
      if (Array.isArray(saved)) {
        _saveToDirs(el, saved);
        _syncUnifiedBankFile(el, saved);
        console.log(`[questionBank] Restored ${saved.length} "${el}" questions from the database.`);
      }
    }
    const settings = await store.kvGet('question_settings');
    if (settings && typeof settings === 'object') {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    }
  } catch (err) {
    console.warn('[questionBank] Could not restore banks from the database:', err.message);
  }
}

module.exports = {
  sampleQuestions,
  getBankSize,
  getBatches,
  getOverview,
  getScope,
  setScope,
  getPlayableQuestions,
  getAllQuestions,
  resolveCorrectIndex,
  replaceBank,
  appendBank,
  clearBank,
  getActiveQuestionBank,
  hydrate,
  ELEMENTS,
  DIFFICULTY_CONFIG
};
