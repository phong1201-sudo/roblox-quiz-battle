// server/db.js - JSON flat-file user database
// 2-piece inventory system: weapon (Vu khi) + outfit (Trang phuc)

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

// 2-piece set: weapon (Vu khi) + outfit (Trang phuc)
// Full Set = has BOTH pieces
const FULL_SET_PIECES = ['weapon', 'outfit'];

// Seed admin
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
        thunder: ['weapon', 'outfit'],
        fire:    ['weapon', 'outfit'],
        frost:   ['weapon', 'outfit'],
      },
      highestStage: 4,
    };
    if (data.nextId <= 1) data.nextId = 2;
    _save(data);
    console.log('[db] Admin account "God Father" seeded (2-piece system).');
  } else {
    // Migrate existing admin to 2-piece system
    let changed = false;
    if (!existing.inventory) {
      existing.inventory = {
        thunder: ['weapon', 'outfit'],
        fire:    ['weapon', 'outfit'],
        frost:   ['weapon', 'outfit'],
      };
      changed = true;
    } else {
      const OLD_PIECES = ['hat', 'shirt', 'pants', 'shoes', 'weapon'];
      for (const el of ['thunder', 'fire', 'frost']) {
        if (!Array.isArray(existing.inventory[el])) {
          existing.inventory[el] = ['weapon', 'outfit'];
          changed = true;
        } else {
          // If has any old 5-piece items, migrate: having any old piece = has full 2-piece set
          const hasOld = OLD_PIECES.some(p => existing.inventory[el].includes(p));
          if (hasOld) {
            existing.inventory[el] = ['weapon', 'outfit'];
            changed = true;
          }
          // Ensure admin always has full set
          if (!FULL_SET_PIECES.every(p => existing.inventory[el].includes(p))) {
            existing.inventory[el] = ['weapon', 'outfit'];
            changed = true;
          }
        }
      }
    }
    if (changed) {
      _save(data);
      console.log('[db] Admin inventory migrated to 2-piece system.');
    }
  }
})();

// Public API

function register(username, password) {
  username = (username || '').trim();
  if (username.length < 2)
    return { ok: false, error: 'Tên người dùng phải có ít nhất 2 ký tự.' };
  if ((password || '').length < 3)
    return { ok: false, error: 'Mật khẩu phải có ít nhất 3 ký tự.' };
  if (username.toLowerCase() === 'god father')
    return { ok: false, error: 'Tên tài khoản này đã có người đăng ký, vui lòng chọn tên khác!' };

  const data = _load();
  const taken = Object.values(data.users).some(
    u => u.username && u.username.toLowerCase() === username.toLowerCase()
  );
  if (taken) return { ok: false, error: 'Tên tài khoản này đã có người đăng ký, vui lòng chọn tên khác!' };

  const id   = data.nextId++;
  const user = {
    id,
    username,
    passwordHash:    _hash(password),
    password:        password,
    role:            'player',
    scores:          {},
    unlockedOutfits: ['default'],
    unlockedSets:    [],
    inventory:       { thunder: [], fire: [], frost: [] },
    highestStage:    1,
    createdAt:       new Date().toISOString(),
  };
  data.users[id] = user;
  _save(data);
  return { ok: true, user: _public(user) };
}

function login(username, password) {
  username = (username || '').trim();
  const data = _load();
  const user = Object.values(data.users).find(
    u => u.username && u.username.toLowerCase() === username.toLowerCase()
  );
  if (!user)
    return { ok: false, error: 'Tên người dùng không tồn tại.' };
  if (user.passwordHash !== _hash(password) && user.password !== password)
    return { ok: false, error: 'Mật khẩu không đúng.' };
  return { ok: true, user: _public(user) };
}

function changePassword(username, oldPassword, newPassword) {
  username = (username || '').trim();
  if (!username) return { ok: false, error: 'Thiếu tên người dùng.' };
  if (!oldPassword) return { ok: false, error: 'Vui lòng nhập mật khẩu hiện tại.' };
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' };
  }

  const data = _load();
  const user = Object.values(data.users).find(
    u => u.username && u.username.toLowerCase() === username.toLowerCase()
  );
  if (!user) return { ok: false, error: 'Người dùng không tồn tại.' };

  // Verify oldPassword matches passwordHash or legacy plaintext password
  if (user.passwordHash !== _hash(oldPassword) && user.password !== oldPassword) {
    return { ok: false, error: 'Mật khẩu hiện tại không chính xác!' };
  }

  // Update password field
  user.passwordHash = _hash(newPassword);
  user.password = newPassword;

  _save(data);
  console.log(`[db] Password successfully changed on disk for user "${user.username}".`);
  return { ok: true, message: 'Đổi mật khẩu thành công!' };
}

/**
 * Unlock a piece for a given element.
 * pieces: string | string[]  - must be 'weapon' or 'outfit'
 * Returns { ok, user, newPieces, fullSetUnlocked }
 */
function unlockPiece(userId, element, pieces) {
  const VALID_ELEMS  = ['thunder', 'fire', 'frost'];
  const VALID_PIECES = FULL_SET_PIECES;   // ['weapon', 'outfit']
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

  // Full set = has both weapon AND outfit
  const fullSetUnlocked = FULL_SET_PIECES.every(
    p => user.inventory[element].includes(p)
  );

  if (fullSetUnlocked) {
    if (!Array.isArray(user.unlockedSets)) user.unlockedSets = [];
    if (!user.unlockedSets.includes(element)) {
      user.unlockedSets.push(element);
    }
  }

  _save(data);
  return { ok: true, user: _public(user), newPieces, fullSetUnlocked };
}

/** Legacy: unlock full set at once */
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

function _public(u) {
  return {
    id:              u.id,
    username:        u.username,
    role:            u.role,
    scores:          u.scores || {},
    unlockedOutfits: u.unlockedOutfits || ['default'],
    unlockedSets:    Array.isArray(u.unlockedSets) ? [...u.unlockedSets] : [],
    inventory:       u.inventory || { thunder: [], fire: [], frost: [] },
    highestStage:    u.highestStage || 1,
    createdAt:       u.createdAt || null,
  };
}

function getUser(userId) {
  const data = _load();
  const user = data.users[userId];
  if (!user) return null;
  return _public(user);
}

module.exports = { register, login, changePassword, getUser, unlockPiece, unlockSet, updateStage, FULL_SET_PIECES };
