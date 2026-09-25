// server/questionBank.js
// Loads question banks from data/questions/{element}.json
// Samples N questions and shuffles options per question.

const path = require('path');
const fs   = require('fs');

const BANK_DIR = path.join(__dirname, '../data/questions');

// ── Difficulty configuration ───────────────────────────────────────────────────
const DIFFICULTY_CONFIG = {
  easy:   { count: 20, bossHpMultiplier: 1 },
  medium: { count: 30, bossHpMultiplier: 1 },
  hard:   { count: 50, bossHpMultiplier: 1 },
  dev:    { count:  5, bossHpMultiplier: 1 },  // God Father quick test: 5 questions
};

// ── Internal: load raw bank from disk ────────────────────────────────────────
function _loadBank(element) {
  const file = path.join(BANK_DIR, `${element}.json`);
  if (!fs.existsSync(file)) return [];
  try   { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return []; }
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

// ── Public: get question count for a bank ────────────────────────────────────
function getBankSize(element) {
  return _loadBank(element).length;
}

// ── Public: sample N questions & shuffle their options ───────────────────────
// Returns array of { question, options:[A,B,C,D], correctIndex, answer } — 
// the same shape roomManager.setQuestions() already stores.
function sampleQuestions(element, difficulty) {
  const cfg  = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const bank = _loadBank(element);

  if (bank.length === 0) {
    // Fallback: empty array — caller should handle
    return [];
  }

  // Sample up to cfg.count from the bank (without replacement)
  const pool     = _shuffle(bank);
  const selected = pool.slice(0, Math.min(cfg.count, pool.length));

  // For each question, shuffle its options & update correctIndex
  return selected.map((q, qIdx) => {
    const opts = Array.isArray(q.options)
      ? q.options
      : ['A','B','C','D'].map(k => q.options?.[k] ?? '');

    // Tag with correct flag
    const tagged = opts.map((text, i) => ({ text, isCorrect: i === (q.correctIndex ?? 0) }));
    const shuffledOpts = _shuffle(tagged);

    const newCorrectIndex = shuffledOpts.findIndex(o => o.isCorrect);
    return {
      id:           q.id ?? qIdx + 1,
      question:     q.text || q.question || '',
      options:      shuffledOpts.map(o => o.text),
      correctIndex: newCorrectIndex,
      answer:       ['A','B','C','D'][newCorrectIndex] || 'A',
    };
  });
}

// ── Public: replace a bank atomically ────────────────────────────────────────
function replaceBank(element, questionsArray) {
  if (!fs.existsSync(BANK_DIR)) fs.mkdirSync(BANK_DIR, { recursive: true });
  const file = path.join(BANK_DIR, `${element}.json`);
  const tmp  = file + '.tmp';
  // Re-number IDs sequentially
  const numbered = questionsArray.map((q, i) => ({ ...q, id: i + 1 }));
  fs.writeFileSync(tmp, JSON.stringify(numbered, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return numbered.length;
}

// ── Public: append questions (skip duplicates by normalised text) ─────────────
function appendBank(element, newQuestions) {
  if (!fs.existsSync(BANK_DIR)) fs.mkdirSync(BANK_DIR, { recursive: true });
  const existing = _loadBank(element);
  // Build a set of normalised existing texts for O(1) lookup
  const seen = new Set(existing.map(q => _norm(q.text || q.question || '')));
  const toAdd = newQuestions.filter(q => !seen.has(_norm(q.text || q.question || '')));
  const merged = [...existing, ...toAdd].map((q, i) => ({ ...q, id: i + 1 }));
  const file = path.join(BANK_DIR, `${element}.json`);
  const tmp  = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf8');
  fs.renameSync(tmp, file);
  return { total: merged.length, added: toAdd.length, skipped: newQuestions.length - toAdd.length };
}

// ── Public: clear a bank completely ──────────────────────────────────────────
function clearBank(element) {
  if (!fs.existsSync(BANK_DIR)) fs.mkdirSync(BANK_DIR, { recursive: true });
  const file = path.join(BANK_DIR, `${element}.json`);
  fs.writeFileSync(file, '[]', 'utf8');
}

// ── Internal: normalise text for dedup comparison ─────────────────────────────
function _norm(str) {
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

module.exports = { sampleQuestions, getBankSize, replaceBank, appendBank, clearBank, DIFFICULTY_CONFIG };
