// server/db.js — JSON flat-file user database
// Adds: inventory (piece-by-piece set tracking), unlockPiece, hasFullSet

const path   = require('path');
const fs     = require('fs');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '../data');
const DB_FILE = path.join(dataDir, 'users.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function _load() {
  try {
    if (!fs.existsSync(DB_FILE)) return { nextId: 2, users: {} };
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch(e) { return { nextId: 2, users: {} }; }
}

function _save(data) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function _hash(plain) {
  return crypto.createHash('sha256').update('qb3d::' + plain).digest('hex');
}

// ── All 5 pieces required for a full elemental set ────────────────────────────
const FULL_SET_PIECES = ['hat', 'shirt', 'pants', 'shoes', 'weapon'];

// ── Seed admin ────────────────────────────────────────────────────────────────
(function seedAdmin() {
  const data = _load();
  const existing = Object.values(data.users).find(
    u => u.username.toLowerCase() === 'god father'
  );
  if (!existing) {
    data.users[1] = {
      id:           1,
      username:     'God Father',
      passwordHash: _hash('123'),
      role:         'admin',
      unlockedSets: ['thunder', 'fire', 'frost'],
      inventory:    {
        thunder: [...FULL_SET_PIECES],
        fire:    [...FULL_SET_PIECES],
        frost:   [...FULL_SET_PIECES],
      },
      highestStage: 4,
    };
    if (data.nextId <= 1) data.nextId = 2;
    _save(data);
    console.log('[db] Admin account "God Father" seeded.');
  } else if (!existing.inventory) {
    // Migrate old admin record
    existing.inventory = {
      thunder: [...FULL_SET_PIECES],
      fire:    [...FULL_SET_PIECES],
      frost:   [...FULL_SET_PIECES],
    };
    _save(data);
  }
})();

// ── Public API ────────────────────────────────────────────────────────────────

function register(username, password) {
  username = (username || '').trim();
  if (username.length < 2)
    return { ok: false, error: 'Tên người dùng phải có ít nhất 2 ký tự.' };
  if ((password || '').length < 3)
    return { ok: false, error: 'Mật khẩu phải có ít nhất 3 ký tự.' };
  if (username.toLowerCase() === 'god father')
    return { ok: false, error: 'Tên này đã được sử dụng.' };

  const data = _load();
  const taken = Object.values(data.users).some(
    u => u.username.toLowerCase() === username.toLowerCase()
  );
  if (taken) return { ok: false, error: 'Tên người dùng đã tồn tại.' };

  const id   = data.nextId++;
  const user = {
    id, username,
    passwordHash: _hash(password),
    role:         'player',
    unlockedSets: [],
    inventory:    { thunder: [], fire: [], frost: [] },
    highestStage: 1,
  };
  data.users[id] = user;
  _save(data);
  return { ok: true, user: _public(user) };
}

function login(username, password) {
  username = (username || '').trim();
  const data = _load();
  const user = Object.values(data.users).find(
    u => u.username.toLowerCase() === username.toLowerCase()
  );
  if (!user)
    return { ok: false, error: 'Tên người dùng không tồn tại.' };
  if (user.passwordHash !== _hash(password))
    return { ok: false, error: 'Mật khẩu không đúng.' };
  return { ok: true, user: _public(user) };
}

/**
 * Unlock a piece (or multiple pieces) for a given element.
 * pieces: string | string[]  e.g. 'weapon' or ['hat','shirt','pants','shoes']
 * Returns { ok, user, newPieces, fullSetUnlocked }
 */
function unlockPiece(userId, element, pieces) {
  const VALID_ELEMS  = ['thunder', 'fire', 'frost'];
  const VALID_PIECES = FULL_SET_PIECES;
  if (!VALID_ELEMS.includes(element))
    return { ok: false, error: 'Invalid element.' };

  const piecesToAdd = (Array.isArray(pieces) ? pieces : [pieces])
    .filter(p => VALID_PIECES.includes(p));
  if (piecesToAdd.length === 0)
    return { ok: false, error: 'No valid pieces specified.' };

  const data = _load();
  const user = data.users[userId];
  if (!user) return { ok: false, error: 'User not found.' };

  if (!user.inventory) user.inventory = { thunder: [], fire: [], frost: [] };
  if (!Array.isArray(user.inventory[element])) user.inventory[element] = [];

  const newPieces = [];
  for (const p of piecesToAdd) {
    if (!user.inventory[element].includes(p)) {
      user.inventory[element].push(p);
      newPieces.push(p);
    }
  }

  // Check if full set is now complete
  const fullSetUnlocked = FULL_SET_PIECES.every(
    p => user.inventory[element].includes(p)
  );

  // If full set: mark element as unlocked in unlockedSets
  if (fullSetUnlocked) {
    if (!Array.isArray(user.unlockedSets)) user.unlockedSets = [];
    if (!user.unlockedSets.includes(element)) {
      user.unlockedSets.push(element);
    }
  }

  _save(data);
  return { ok: true, user: _public(user), newPieces, fullSetUnlocked };
}

/** Legacy: unlock full set at once (keeps backward compat with old flow) */
function unlockSet(userId, setId) {
  return unlockPiece(userId, setId, [...FULL_SET_PIECES]);
}

function updateStage(userId, stage) {
  const data = _load();
  const user = data.users[userId];
  if (!user) return;
  if (stage > (user.highestStage || 1)) {
    user.highestStage = stage;
    _save(data);
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────
function _public(u) {
  return {
    id:           u.id,
    username:     u.username,
    role:         u.role,
    unlockedSets: Array.isArray(u.unlockedSets) ? [...u.unlockedSets] : [],
    inventory:    u.inventory || { thunder: [], fire: [], frost: [] },
    highestStage: u.highestStage || 1,
  };
}

module.exports = { register, login, unlockPiece, unlockSet, updateStage, FULL_SET_PIECES };
