// server/questionBank.js
// Loads question banks from data/questions/{element}.json
// Samples N questions and shuffles options per question.

const path = require('path');
const fs   = require('fs');

const BANK_DIRS = [
  path.join(__dirname, '../data/question'),
  path.join(__dirname, '../data/questions')
];
const UNIFIED_BANK_FILE = path.join(__dirname, '../data/question_bank.json');

// ── Difficulty configuration ───────────────────────────────────────────────────
const DIFFICULTY_CONFIG = {
  easy:   { count: 20, bossHpMultiplier: 1 },
  medium: { count: 30, bossHpMultiplier: 1 },
  hard:   { count: 50, bossHpMultiplier: 1 },
  dev:    { count:  5, bossHpMultiplier: 1 },  // God Father quick test: 5 questions
};

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
  // 1. Check data/question/ directory first
  for (const dir of BANK_DIRS) {
    const file = _findElementFile(dir, el);
    if (file && fs.existsSync(file)) {
      try {
        const content = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (Array.isArray(content) && content.length > 0) return content;
      } catch (e) {}
    }
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

// ── Internal: save to all bank directories ──────────────────────────────────
function _saveToDirs(element, questionsArray) {
  const el = (element || '').toLowerCase();
  for (const dir of BANK_DIRS) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const existingFile = _findElementFile(dir, el);
    const targetFile = existingFile || path.join(dir, `${el}.json`);
    const tmp = targetFile + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(questionsArray, null, 2), 'utf8');
    fs.renameSync(tmp, targetFile);
    // Also ensure Capitalized file exists in data/question/ if applicable (e.g. Fire.json, Frost.json)
    if (dir.endsWith('question') || dir.includes('question\\') || dir.includes('question/')) {
      const capName = el.charAt(0).toUpperCase() + el.slice(1) + '.json';
      const capPath = path.join(dir, capName);
      if (capPath !== targetFile) {
        try { fs.writeFileSync(capPath, JSON.stringify(questionsArray, null, 2), 'utf8'); } catch (e) {}
      }
    }
  }
}

// ── Public: replace a bank atomically ────────────────────────────────────────
function replaceBank(element, questionsArray) {
  const numbered = questionsArray.map((q, i) => ({ ...q, id: i + 1 }));
  _saveToDirs(element, numbered);
  _syncUnifiedBankFile(element, numbered);
  return numbered.length;
}

// ── Public: append questions (skip duplicates by normalised text) ─────────────
function appendBank(element, newQuestions) {
  const existing = _loadBank(element);
  const seen = new Set(existing.map(q => _norm(q.text || q.question || '')));
  const toAdd = newQuestions.filter(q => !seen.has(_norm(q.text || q.question || '')));
  const merged = [...existing, ...toAdd].map((q, i) => ({ ...q, id: i + 1 }));
  _saveToDirs(element, merged);
  _syncUnifiedBankFile(element, merged);
  return { total: merged.length, added: toAdd.length, skipped: newQuestions.length - toAdd.length };
}

// ── Public: clear a bank completely ──────────────────────────────────────────
function clearBank(element) {
  _saveToDirs(element, []);
  _syncUnifiedBankFile(element, []);
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

// ── Internal: normalise text for dedup comparison ─────────────────────────────
function _norm(str) {
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

module.exports = {
  sampleQuestions,
  getBankSize,
  replaceBank,
  appendBank,
  clearBank,
  getActiveQuestionBank,
  DIFFICULTY_CONFIG
};
