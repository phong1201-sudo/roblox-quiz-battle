// server/db.js - Persistent User Database with MongoDB Atlas & Local JSON Fallback
// Supports permanent persistence across Render container spin-downs / redeploys.
// 2-piece inventory system: weapon (Vu khi) + outfit (Trang phuc)

const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');
const mongoose = require('mongoose');

const dataDir = path.join(__dirname, '../data');
const DB_FILE = path.join(dataDir, 'users.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// ── In-Memory Cache (Synced with MongoDB Atlas & data/users.json) ─────────────
let _cache = { nextId: 2, users: {} };
let _mongoConnected = false;

function _loadLocal() {
  try {
    if (!fs.existsSync(DB_FILE)) return { nextId: 2, users: {} };
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(content);
  } catch(e) {
    return { nextId: 2, users: {} };
  }
}

function _saveLocal(data) {
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmp, DB_FILE);
  } catch (err) {
    console.warn('[db] Local JSON write warning:', err.message);
  }
}

function _hash(plain) {
  return crypto.createHash('sha256').update('qb3d::' + plain).digest('hex');
}

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// 2-piece set: weapon (Vu khi) + outfit (Trang phuc)
const FULL_SET_PIECES = ['weapon', 'outfit'];

// ── Mongoose User Schema ──────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true, index: true },
  username: { type: String, required: true, unique: true, trim: true, index: true },
  passwordHash: { type: String, required: true },
  password: { type: String }, // For legacy/display compatibility
  role: { type: String, default: 'player' },
  scores: { type: mongoose.Schema.Types.Mixed, default: {} },
  unlockedOutfits: { type: [String], default: ['default'] },
  unlockedSets: { type: [String], default: [] },
  inventory: {
    type: mongoose.Schema.Types.Mixed,
    default: { thunder: [], fire: [], frost: [] }
  },
  highestStage: { type: Number, default: 1 },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true,
  collection: 'users'
});

const UserModel = mongoose.models.User || mongoose.model('User', userSchema);

// ── Generic key/value documents (question banks, admin settings) ─────────────
const kvSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true, index: true },
  value: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true, collection: 'gamedata', minimize: false });

const KvModel = mongoose.models.GameData || mongoose.model('GameData', kvSchema);

/** Read a stored value. Returns undefined when MongoDB is not connected or the key is absent. */
async function kvGet(key) {
  if (!_mongoConnected) return undefined;
  const doc = await KvModel.findOne({ key }).lean();
  return doc ? doc.value : undefined;
}

/** Store a value permanently. Returns false (and stores nothing) without MongoDB. */
async function kvSet(key, value) {
  if (!_mongoConnected) return false;
  await KvModel.findOneAndUpdate({ key }, { $set: { value } }, { upsert: true });
  return true;
}

// ── Seed Admin Account ("God Father") ─────────────────────────────────────────
async function ensureAdminSeeded() {
  const adminDoc = {
    id:           1,
    username:     'God Father',
    passwordHash: _hash('123'),
    password:     '123',
    role:         'admin',
    unlockedSets: ['thunder', 'fire', 'frost'],
    inventory:    {
      thunder: ['weapon', 'outfit'],
      fire:    ['weapon', 'outfit'],
      frost:   ['weapon', 'outfit'],
    },
    highestStage: 4,
    createdAt:    new Date().toISOString()
  };

  // Seed into local cache
  if (!_cache.users['1']) {
    _cache.users['1'] = adminDoc;
    if (_cache.nextId <= 1) _cache.nextId = 2;
    _saveLocal(_cache);
  }

  // Seed into MongoDB if connected
  if (_mongoConnected) {
    try {
      const existing = await UserModel.findOne({
        username: { $regex: new RegExp('^God Father$', 'i') }
      });
      if (!existing) {
        await UserModel.create(adminDoc);
        console.log('[db] Admin "God Father" seeded into MongoDB Atlas.');
      } else {
        // Ensure admin has full 2-piece sets
        existing.role = 'admin';
        existing.inventory = {
          thunder: ['weapon', 'outfit'],
          fire:    ['weapon', 'outfit'],
          frost:   ['weapon', 'outfit'],
        };
        existing.unlockedSets = ['thunder', 'fire', 'frost'];
        await existing.save();
      }
    } catch (err) {
      console.warn('[db] Admin seed in MongoDB warning:', err.message);
    }
  }
}

// ── Sync between MongoDB Atlas and Local Storage on Boot ─────────────────────
async function syncMongoWithLocal() {
  if (!_mongoConnected) return;
  try {
    const mongoUsers = await UserModel.find({}).lean();
    console.log(`[db] Loaded ${mongoUsers.length} user accounts from MongoDB Atlas.`);

    // 1. Populate MongoDB users into cache & local JSON
    for (const u of mongoUsers) {
      _cache.users[u.id] = {
        id:              u.id,
        username:        u.username,
        passwordHash:    u.passwordHash,
        password:        u.password,
        role:            u.role || 'player',
        scores:          u.scores || {},
        unlockedOutfits: u.unlockedOutfits || ['default'],
        unlockedSets:    u.unlockedSets || [],
        inventory:       u.inventory || { thunder: [], fire: [], frost: [] },
        highestStage:    u.highestStage || 1,
        createdAt:       u.createdAt || new Date().toISOString()
      };
      if (u.id >= _cache.nextId) {
        _cache.nextId = u.id + 1;
      }
    }

    // 2. Migrate any local users into MongoDB if missing
    const localUsers = Object.values(_cache.users);
    for (const lu of localUsers) {
      const existsInMongo = mongoUsers.some(
        mu => mu.username && mu.username.toLowerCase() === lu.username.toLowerCase()
      );
      if (!existsInMongo) {
        try {
          await UserModel.create(lu);
          console.log(`[db] Migrated local user "${lu.username}" to MongoDB Atlas.`);
        } catch (e) {}
      }
    }

    _saveLocal(_cache);
    await ensureAdminSeeded();
    console.log(`[db] User sync complete. Total active accounts: ${Object.keys(_cache.users).length}`);
  } catch (err) {
    console.error('[db] Error syncing MongoDB with local:', err.message);
  }
}

// ── Connect to MongoDB Atlas (if MONGODB_URI is provided) ─────────────────────
async function initDatabase() {
  // Load local file first for immediate availability
  _cache = _loadLocal();
  await ensureAdminSeeded();

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  if (!uri) {
    console.log('[db] MONGODB_URI is not set. Operating in local JSON mode (ephemeral on Render).');
    console.log('[db] TIP: Set MONGODB_URI in Render Environment tab for permanent cloud persistence across server spin-downs.');
    return;
  }

  try {
    console.log('[db] Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000
    });
    _mongoConnected = true;
    console.log('[db] ✓ Connected to MongoDB Atlas! Permanent user persistence is ACTIVE.');
    await syncMongoWithLocal();
  } catch (err) {
    console.error('[db] ✗ MongoDB Atlas connection failed:', err.message);
    console.log('[db] Falling back to local JSON mode.');
    _mongoConnected = false;
  }
}

// Automatically initiate database on module require.
// `ready` resolves once the user store is usable (MongoDB connected & synced, or
// local JSON fallback chosen). It never rejects. API routes must wait for it:
// answering before MongoDB is connected makes existing accounts look missing.
const ready = initDatabase().catch(err => console.error('[db] initDatabase exception:', err));

// ── Public Helper: Format user for client response (hide password) ───────────
function _public(u) {
  if (!u) return null;
  return {
    id:              u.id,
    username:        u.username,
    role:            u.role || 'player',
    scores:          u.scores || {},
    unlockedOutfits: u.unlockedOutfits || ['default'],
    unlockedSets:    Array.isArray(u.unlockedSets) ? [...u.unlockedSets] : [],
    inventory:       u.inventory || { thunder: [], fire: [], frost: [] },
    highestStage:    u.highestStage || 1,
    createdAt:       u.createdAt || null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC DATABASE API (ASYNC WITH SYNCHRONOUS CACHE FALLBACK)
// ═══════════════════════════════════════════════════════════════════════════════

async function register(username, password) {
  username = (username || '').trim();
  if (username.length < 2) {
    return { ok: false, error: 'Tên người dùng phải có ít nhất 2 ký tự.' };
  }
  if ((password || '').length < 3) {
    return { ok: false, error: 'Mật khẩu phải có ít nhất 3 ký tự.' };
  }
  if (username.toLowerCase() === 'god father') {
    return { ok: false, error: 'Tên tài khoản này đã có người đăng ký, vui lòng chọn tên khác!' };
  }

  // 1. Check uniqueness in MongoDB or cache
  let taken = false;
  if (_mongoConnected) {
    try {
      const existing = await UserModel.findOne({
        username: { $regex: new RegExp('^' + escapeRegex(username) + '$', 'i') }
      }).lean();
      if (existing) taken = true;
    } catch (err) {
      console.warn('[db] MongoDB register check error, using cache:', err.message);
    }
  }

  if (!taken) {
    taken = Object.values(_cache.users).some(
      u => u.username && u.username.toLowerCase() === username.toLowerCase()
    );
  }

  if (taken) {
    return { ok: false, error: 'Tên tài khoản này đã có người đăng ký, vui lòng chọn tên khác!' };
  }

  // 2. Generate unique numeric ID
  let nextId = _cache.nextId || 2;
  if (_mongoConnected) {
    try {
      const highest = await UserModel.findOne({}).sort({ id: -1 }).lean();
      if (highest && highest.id) {
        nextId = Math.max(nextId, highest.id + 1);
      }
    } catch (e) {}
  }

  _cache.nextId = nextId + 1;

  const newUser = {
    id:              nextId,
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

  // 3. Persist to MongoDB Atlas
  if (_mongoConnected) {
    try {
      await UserModel.create(newUser);
      console.log(`[db] Registered new user "${username}" (ID: ${nextId}) in MongoDB Atlas.`);
    } catch (err) {
      // Do not report success for an account that was not stored permanently.
      console.error('[db] Error creating user in MongoDB Atlas:', err.message);
      return { ok: false, error: 'Không lưu được tài khoản vào cơ sở dữ liệu, vui lòng thử lại.' };
    }
  }

  // 4. Update local cache & file
  _cache.users[nextId] = newUser;
  _saveLocal(_cache);

  return { ok: true, user: _public(newUser) };
}

async function login(username, password) {
  username = (username || '').trim();
  let user = null;

  // 1. Query from MongoDB Atlas first if connected
  if (_mongoConnected) {
    try {
      user = await UserModel.findOne({
        username: { $regex: new RegExp('^' + escapeRegex(username) + '$', 'i') }
      }).lean();
    } catch (err) {
      console.warn('[db] MongoDB login error, falling back to cache:', err.message);
    }
  }

  // Fallback to cache
  if (!user) {
    user = Object.values(_cache.users).find(
      u => u.username && u.username.toLowerCase() === username.toLowerCase()
    );
  }

  if (!user) {
    return { ok: false, error: 'Tên người dùng không tồn tại.' };
  }

  const matches = (user.passwordHash === _hash(password)) || (user.password === password);
  if (!matches) {
    return { ok: false, error: 'Mật khẩu không đúng.' };
  }

  return { ok: true, user: _public(user) };
}

async function changePassword(username, oldPassword, newPassword) {
  username = (username || '').trim();
  if (!username) return { ok: false, error: 'Thiếu tên người dùng.' };
  if (!oldPassword) return { ok: false, error: 'Vui lòng nhập mật khẩu hiện tại.' };
  if (!newPassword || newPassword.length < 4) {
    return { ok: false, error: 'Mật khẩu mới phải có ít nhất 4 ký tự.' };
  }

  let mongoDoc = null;
  let cachedUser = Object.values(_cache.users).find(
    u => u.username && u.username.toLowerCase() === username.toLowerCase()
  );

  if (_mongoConnected) {
    try {
      mongoDoc = await UserModel.findOne({
        username: { $regex: new RegExp('^' + escapeRegex(username) + '$', 'i') }
      });
    } catch (err) {
      console.warn('[db] MongoDB changePassword lookup warning:', err.message);
    }
  }

  const target = mongoDoc || cachedUser;
  if (!target) return { ok: false, error: 'Người dùng không tồn tại.' };

  // Verify old password against hash or legacy plaintext
  const validOld = (target.passwordHash === _hash(oldPassword)) || (target.password === oldPassword);
  if (!validOld) {
    return { ok: false, error: 'Mật khẩu hiện tại không chính xác!' };
  }

  const newHash = _hash(newPassword);

  // 1. Update in MongoDB Atlas
  if (mongoDoc) {
    try {
      mongoDoc.passwordHash = newHash;
      mongoDoc.password = newPassword;
      mongoDoc.updatedAt = new Date();
      await mongoDoc.save();
      console.log(`[db] Password permanently updated in MongoDB Atlas for user "${username}".`);
    } catch (err) {
      console.error('[db] Error updating password in MongoDB:', err.message);
    }
  }

  // 2. Update in cache & local JSON
  if (cachedUser) {
    cachedUser.passwordHash = newHash;
    cachedUser.password = newPassword;
    _saveLocal(_cache);
  }

  return { ok: true, message: 'Đổi mật khẩu thành công!' };
}

function getUser(userId) {
  const idNum = Number(userId);
  // Return immediately from synchronized in-memory cache
  const cached = _cache.users[idNum];
  if (cached) return _public(cached);

  // Async background refresh if missing from cache
  if (_mongoConnected) {
    UserModel.findOne({ id: idNum }).lean().then(doc => {
      if (doc) {
        _cache.users[doc.id] = doc;
        _saveLocal(_cache);
      }
    }).catch(() => {});
  }
  return null;
}

async function getUserAsync(userId) {
  const idNum = Number(userId);
  if (!idNum) return null;
  const cached = _cache.users[idNum];
  if (cached) return _public(cached);

  if (_mongoConnected) {
    try {
      const doc = await UserModel.findOne({ id: idNum }).lean();
      if (doc) {
        _cache.users[doc.id] = doc;
        _saveLocal(_cache);
        return _public(doc);
      }
    } catch (e) {}
  }
  return null;
}

function unlockOutfit(userId, outfitId) {
  const idNum = Number(userId);
  const user = _cache.users[idNum];
  if (!user) return { ok: false, error: 'User not found' };

  if (!Array.isArray(user.unlockedOutfits)) user.unlockedOutfits = ['default'];
  if (!user.unlockedOutfits.includes(outfitId)) {
    user.unlockedOutfits.push(outfitId);
  }
  if (!Array.isArray(user.unlockedSets)) user.unlockedSets = [];
  if (!user.unlockedSets.includes(outfitId)) {
    user.unlockedSets.push(outfitId);
  }
  user.updatedAt = new Date();
  _saveLocal(_cache);

  if (_mongoConnected) {
    UserModel.findOneAndUpdate(
      { id: idNum },
      { $set: { unlockedOutfits: user.unlockedOutfits, unlockedSets: user.unlockedSets, updatedAt: new Date() } }
    ).catch(err => console.warn('[db] MongoDB unlockOutfit update warning:', err.message));
  }
  return { ok: true, user: _public(user) };
}

function updateScores(userId, element, score) {
  const idNum = Number(userId);
  const user = _cache.users[idNum];
  if (!user) return { ok: false, error: 'User not found' };

  if (!user.scores || typeof user.scores !== 'object') user.scores = {};
  const currentMax = Number(user.scores[element] || 0);
  if (Number(score) > currentMax) {
    user.scores[element] = Number(score);
  }

  // If score reached 50, automatically unlock outfit!
  if (Number(score) >= 50 && ['thunder', 'fire', 'frost'].includes(element)) {
    if (!Array.isArray(user.unlockedOutfits)) user.unlockedOutfits = ['default'];
    if (!user.unlockedOutfits.includes(element)) user.unlockedOutfits.push(element);
    if (!Array.isArray(user.unlockedSets)) user.unlockedSets = [];
    if (!user.unlockedSets.includes(element)) user.unlockedSets.push(element);
  }

  user.updatedAt = new Date();
  _saveLocal(_cache);

  if (_mongoConnected) {
    UserModel.findOneAndUpdate(
      { id: idNum },
      { $set: { scores: user.scores, unlockedOutfits: user.unlockedOutfits, unlockedSets: user.unlockedSets, updatedAt: new Date() } }
    ).catch(err => console.warn('[db] MongoDB updateScores update warning:', err.message));
  }
  return { ok: true, user: _public(user) };
}

function unlockPiece(userId, element, pieces) {
  const VALID_ELEMS  = ['thunder', 'fire', 'frost'];
  const VALID_PIECES = FULL_SET_PIECES;   // ['weapon', 'outfit']
  if (!VALID_ELEMS.includes(element))
    return { ok: false, error: 'Invalid element.' };

  const piecesToAdd = (Array.isArray(pieces) ? pieces : [pieces])
    .filter(p => VALID_PIECES.includes(p));
  if (piecesToAdd.length === 0)
    return { ok: false, error: 'No valid pieces specified.' };

  const idNum = Number(userId);
  const user = _cache.users[idNum];
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

  const fullSetUnlocked = FULL_SET_PIECES.every(
    p => user.inventory[element].includes(p)
  );

  if (fullSetUnlocked) {
    if (!Array.isArray(user.unlockedSets)) user.unlockedSets = [];
    if (!user.unlockedSets.includes(element)) {
      user.unlockedSets.push(element);
    }
  }

  _saveLocal(_cache);

  // Persist to MongoDB Atlas asynchronously
  if (_mongoConnected) {
    UserModel.findOneAndUpdate(
      { id: idNum },
      {
        $set: {
          inventory: user.inventory,
          unlockedSets: user.unlockedSets,
          updatedAt: new Date()
        }
      }
    ).catch(err => console.warn('[db] MongoDB unlockPiece update warning:', err.message));
  }

  return { ok: true, user: _public(user), newPieces, fullSetUnlocked };
}

function unlockSet(userId, setId) {
  return unlockPiece(userId, setId, [...FULL_SET_PIECES]);
}

function updateStage(userId, stage) {
  const idNum = Number(userId);
  const user = _cache.users[idNum];
  if (!user) return;
  if (stage > (user.highestStage || 1)) {
    user.highestStage = stage;
    _saveLocal(_cache);

    if (_mongoConnected) {
      UserModel.findOneAndUpdate(
        { id: idNum, highestStage: { $lt: stage } },
        { $set: { highestStage: stage, updatedAt: new Date() } }
      ).catch(() => {});
    }
  }
}

// ── Diagnostic Helper for Verification & Admin Monitoring ────────────────────
async function getUsersCount() {
  let count = Object.keys(_cache.users).length;
  let usernames = Object.values(_cache.users).map(u => u.username);

  if (_mongoConnected) {
    try {
      const mongoDocs = await UserModel.find({}, 'username').lean();
      count = mongoDocs.length;
      usernames = mongoDocs.map(u => u.username);
    } catch (e) {}
  }

  return {
    count,
    storage: _mongoConnected ? 'mongodb' : 'local_json',
    mongoConnected: _mongoConnected,
    hasMongoUri: Boolean(process.env.MONGODB_URI || process.env.MONGO_URI),
    users: usernames,
  };
}

module.exports = {
  register,
  login,
  changePassword,
  getUser,
  getUserAsync,
  unlockPiece,
  unlockSet,
  unlockOutfit,
  updateScores,
  updateStage,
  getUsersCount,
  FULL_SET_PIECES,
  isMongoConnected: () => _mongoConnected,
  initDatabase,
  ready,
  kvGet,
  kvSet
};
