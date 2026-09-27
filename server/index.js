const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');
const multer  = require('multer');
const fs      = require('fs');

const roomManager    = require('./roomManager');
const questionParser = require('./questionParser');
const db             = require('./db');
const questionBank   = require('./questionBank');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server);
const PORT   = process.env.PORT || 3000;

// ── Static / middleware ───────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Alias: serve kid drawing as a clean /assets/characters/fireblade.png URL ──
app.get('/assets/characters/fireblade.png', (req, res) => {
  const src = path.join(__dirname, '../public/assets/characters/fireblade(cho game)_0.jpg');
  if (fs.existsSync(src)) {
    res.setHeader('Content-Type', 'image/jpeg');
    res.sendFile(src);
  } else {
    res.status(404).end();
  }
});

// ── Admin: character image upload (thunder.png / fire.png / frost.png) ────────
const charImgStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../public/assets/characters');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const element = (req.body?.element || req.query?.element || 'unknown').toLowerCase();
    const ext     = /\.(png|jpg|jpeg|gif|webp)$/i.test(file.originalname) ? file.originalname.match(/\.[^.]+$/)[0] : '.png';
    cb(null, `${element}${ext}`);
  },
});
const charImgUpload = multer({
  storage: charImgStorage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files accepted'));
  },
});

app.post('/api/admin/character/upload', charImgUpload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
    const element = (req.body?.element || '').toLowerCase();
    if (!['thunder', 'fire', 'frost'].includes(element))
      return res.status(400).json({ error: 'Invalid element' });
    const ext = path.extname(req.file.filename);
    res.json({ ok: true, url: `/assets/characters/${element}${ext}`, element, filename: req.file.filename });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/character/list', (req, res) => {
  const dir = path.join(__dirname, '../public/assets/characters');
  const result = {};
  for (const el of ['thunder', 'fire', 'frost']) {
    const found = ['.png', '.jpg', '.jpeg'].map(ext => path.join(dir, `${el}${ext}`)).find(f => fs.existsSync(f));
    result[el] = found ? `/assets/characters/${path.basename(found)}` : null;
  }
  res.json(result);
});

// ── Admin: dual art upload — body + weapon per element (Persistent Overwrite) ─
// POST /api/admin/art/upload  { element, type:'body'|'weapon', image }
// ALWAYS saves and overwrites directly to public/assets/characters/${element}_${type}.png
// Also accepts .glb / .gltf files and routes them to public/assets/models/
const artUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const isModelExt = /\.(glb|gltf)$/i.test(file.originalname);
    if (file.mimetype.startsWith('image/') || isModelExt || ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh hoặc mô hình 3D (.glb, .gltf)'));
    }
  },
});

app.post('/api/admin/art/upload', artUpload.single('image'), (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const element = (req.body?.element || req.query?.element || '').toLowerCase();
    const rawType = (req.body?.type    || req.query?.type    || '').toLowerCase();
    if (!['thunder', 'fire', 'frost', 'default'].includes(element))
      return res.status(400).json({ success: false, error: 'Invalid element' });
    if (!['body', 'character', 'weapon'].includes(rawType))
      return res.status(400).json({ success: false, error: 'Invalid type (must be body, character, or weapon)' });

    const isModel = /\.(glb|gltf)$/i.test(file.originalname) || ['model/gltf-binary', 'model/gltf+json'].includes(file.mimetype);
    if (isModel) {
      const ext = path.extname(file.originalname).toLowerCase() || '.glb';
      const modelType = (rawType === 'weapon') ? 'weapon' : 'character';
      const modelsDir = path.join(__dirname, '../public/assets/models');
      if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });
      const targetPath = path.join(modelsDir, `${element}_${modelType}${ext}`);
      fs.writeFileSync(targetPath, file.buffer);
      const url = `/assets/models/${element}_${modelType}${ext}?t=${Date.now()}`;
      console.log(`[model] Saved 3D model: ${targetPath}`);
      return res.json({ success: true, url, element, type: modelType, is3DModel: true });
    }

    const type = rawType === 'character' ? 'body' : rawType;
    const dir = path.join(__dirname, '../public/assets/characters');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Always overwrite exact filename: ${element}_${type}.png
    const targetPath = path.join(dir, `${element}_${type}.png`);
    fs.writeFileSync(targetPath, file.buffer);

    const url = `/assets/characters/${element}_${type}.png?t=${Date.now()}`;
    console.log(`[art] Saved & overwritten: ${targetPath}`);
    res.json({ success: true, url, element, type, is3DModel: false });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Admin: Dedicated 3D GLB/GLTF Model Upload ────────────────────────────────
// POST /api/admin/models/upload and /api/admin/model/upload { element, type:'character'|'weapon', model/file }
const modelUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const isModel = /\.(glb|gltf)$/i.test(file.originalname) ||
      ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream', 'application/json'].includes(file.mimetype);
    if (isModel) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file định dạng .glb hoặc .gltf'));
  },
});

const handleModelUpload = (req, res) => {
  modelUpload.any()(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    try {
      const file = req.files?.[0];
      if (!file) return res.status(400).json({ success: false, error: 'Chưa chọn file mô hình 3D (.glb / .gltf)' });
      const element = (req.body?.element || req.query?.element || '').toLowerCase();
      let type      = (req.body?.type    || req.query?.type    || '').toLowerCase();
      if (!['thunder', 'fire', 'frost', 'default'].includes(element))
        return res.status(400).json({ success: false, error: 'Invalid element' });
      if (type === 'body') type = 'character';
      if (!['character', 'weapon'].includes(type))
        return res.status(400).json({ success: false, error: 'Type phải là character hoặc weapon' });

      const modelsDir = path.join(__dirname, '../public/assets/models');
      if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

      const ext = path.extname(file.originalname).toLowerCase() || '.glb';
      const targetFilename = `${element}_${type}${ext}`;
      const targetPath = path.join(modelsDir, targetFilename);
      fs.writeFileSync(targetPath, file.buffer);

      const url = `/assets/models/${targetFilename}?t=${Date.now()}`;
      console.log(`[model] Saved 3D model: ${targetPath}`);
      res.json({ success: true, url, element, type, filename: targetFilename });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
};

app.post('/api/admin/model/upload', handleModelUpload);
app.post('/api/admin/models/upload', handleModelUpload);

// GET /api/admin/model/status & /api/admin/models/status: checks 3D models on disk
const handleModelStatus = (req, res) => {
  const dir = path.join(__dirname, '../public/assets/models');
  const result = {};
  for (const el of ['default', 'thunder', 'fire', 'frost']) {
    result[el] = {
      character: ['.glb', '.gltf'].some(ext => fs.existsSync(path.join(dir, `${el}_character${ext}`))),
      weapon:    ['.glb', '.gltf'].some(ext => fs.existsSync(path.join(dir, `${el}_weapon${ext}`))),
    };
  }
  res.json(result);
};

app.get('/api/admin/model/status', handleModelStatus);
app.get('/api/admin/models/status', handleModelStatus);

// GET /api/admin/model/list & /api/admin/models/list: returns URLs for existing 3D models
const handleModelList = (req, res) => {
  const dir = path.join(__dirname, '../public/assets/models');
  const result = {};
  for (const el of ['default', 'thunder', 'fire', 'frost']) {
    const charExt = ['.glb', '.gltf'].find(ext => fs.existsSync(path.join(dir, `${el}_character${ext}`)));
    const weapExt = ['.glb', '.gltf'].find(ext => fs.existsSync(path.join(dir, `${el}_weapon${ext}`)));
    result[el] = {
      character: charExt ? `/assets/models/${el}_character${charExt}` : null,
      weapon:    weapExt ? `/assets/models/${el}_weapon${weapExt}` : null,
    };
  }
  res.json(result);
};

app.get('/api/admin/model/list', handleModelList);
app.get('/api/admin/models/list', handleModelList);

// ── Admin: 3D Elemental Boss Upload (boss_thunder, boss_fire, boss_frost) ───
// POST /api/admin/boss/upload { element: 'thunder'|'fire'|'frost', file }
const bossUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const isModel = /\.(glb|gltf|png|jpg|jpeg|webp)$/i.test(file.originalname) ||
      file.mimetype.startsWith('image/') ||
      ['model/gltf-binary', 'model/gltf+json', 'application/octet-stream', 'application/json'].includes(file.mimetype);
    if (isModel) cb(null, true);
    else cb(new Error('Chỉ chấp nhận file định dạng 3D (.glb, .gltf) hoặc ảnh (.png, .jpg, .webp)'));
  },
});

app.post('/api/admin/boss/upload', (req, res) => {
  bossUpload.any()(req, res, (err) => {
    if (err) return res.status(400).json({ success: false, error: err.message });
    try {
      const file = req.files?.[0];
      if (!file) return res.status(400).json({ success: false, error: 'Chưa chọn file mô hình Boss' });
      const element = (req.body?.element || req.query?.element || '').toLowerCase();
      if (!['thunder', 'fire', 'frost'].includes(element))
        return res.status(400).json({ success: false, error: 'Hệ không hợp lệ (phải là thunder, fire hoặc frost)' });

      const modelsDir = path.join(__dirname, '../public/assets/models');
      if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

      const ext = path.extname(file.originalname).toLowerCase() || '.glb';
      const targetFilename = `boss_${element}${ext}`;
      const targetPath = path.join(modelsDir, targetFilename);

      // Overwrite file
      fs.writeFileSync(targetPath, file.buffer);

      const url = `/assets/models/${targetFilename}?t=${Date.now()}`;
      console.log(`[boss-model] Saved Boss asset: ${targetPath}`);
      res.json({
        success: true,
        message: `Đã cập nhật mô hình Boss ${element}`,
        filePath: targetPath,
        url,
        element,
        filename: targetFilename
      });
    } catch (e) {
      res.status(500).json({ success: false, error: e.message });
    }
  });
});

app.get('/api/admin/boss/status', (req, res) => {
  const dir = path.join(__dirname, '../public/assets/models');
  const result = {};
  for (const el of ['thunder', 'fire', 'frost']) {
    const glbExt = ['.glb', '.gltf'].find(ext => fs.existsSync(path.join(dir, `boss_${el}${ext}`)));
    const imgExt = ['.png', '.jpg', '.jpeg', '.webp'].find(ext => fs.existsSync(path.join(dir, `boss_${el}${ext}`)));
    if (glbExt) {
      result[el] = { exists: true, type: '3d', ext: glbExt, url: `/assets/models/boss_${el}${glbExt}` };
    } else if (imgExt) {
      result[el] = { exists: true, type: 'image', ext: imgExt, url: `/assets/models/boss_${el}${imgExt}` };
    } else {
      result[el] = { exists: false, type: null, ext: null, url: null };
    }
  }
  res.json(result);
});

// GET /api/admin/art/status: checks physical existence on disk
app.get('/api/admin/art/status', (req, res) => {
  const dir = path.join(__dirname, '../public/assets/characters');
  const result = {};
  for (const el of ['thunder', 'fire', 'frost']) {
    result[el] = {
      body:   fs.existsSync(path.join(dir, `${el}_body.png`)),
      weapon: fs.existsSync(path.join(dir, `${el}_weapon.png`)),
    };
  }
  res.json(result);
});

app.get('/api/admin/art/list', (req, res) => {
  const dir = path.join(__dirname, '../public/assets/characters');
  const result = {};
  for (const el of ['thunder', 'fire', 'frost']) {
    result[el] = {
      body:   fs.existsSync(path.join(dir, `${el}_body.png`))   ? `/assets/characters/${el}_body.png`   : null,
      weapon: fs.existsSync(path.join(dir, `${el}_weapon.png`)) ? `/assets/characters/${el}_weapon.png` : null,
    };
  }
  res.json(result);
});

// ── Admin: Visual Socket & Pivot Calibration System ────────────────────────
const socketsFilePath = path.join(__dirname, '../data/sockets.json');

const DEFAULT_SOCKETS = {
  player: {
    shoulderX: -0.65,
    shoulderY: 1.2,
    shoulderZ: 0.0,
    weapon: {
      offsetX: 0.0,
      offsetY: -0.4,
      offsetZ: 0.1,
      rotX: 0.0,
      rotY: 1.5708,
      rotZ: -0.7854,
      angle: -45
    },
    default: { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    thunder: { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    fire:    { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    frost:   { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 }
  },
  boss: {
    shoulderX: -1.8,
    shoulderY: 2.2,
    shoulderZ: 0.2,
    weapon: {
      offsetX: 0.0,
      offsetY: -0.6,
      offsetZ: 0.5,
      rotX: 0.0,
      rotY: -1.5708,
      rotZ: 0.5236,
      angle: 30
    },
    thunder: { handX: -0.8, handY: 1.2, handZ: 0.1 },
    fire:    { handX: -0.9, handY: 1.3, handZ: 0.1 },
    frost:   { handX: -0.9, handY: 1.3, handZ: 0.1 }
  },
  weapon: {
    player_sword: { hiltX: 0.0, hiltY: -0.5, hiltZ: 0.0 },
    boss_hammer:  { hiltX: 0.0, hiltY: -0.6, hiltZ: 0.0 }
  }
};

function readSocketsConfig() {
  try {
    if (!fs.existsSync(socketsFilePath)) {
      const dataDir = path.dirname(socketsFilePath);
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      fs.writeFileSync(socketsFilePath, JSON.stringify(DEFAULT_SOCKETS, null, 2), 'utf8');
      return DEFAULT_SOCKETS;
    }
    const raw = fs.readFileSync(socketsFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    console.error('[sockets] Error reading sockets.json:', e);
    return DEFAULT_SOCKETS;
  }
}

app.get(['/api/admin/sockets', '/api/sockets'], (req, res) => {
  const config = readSocketsConfig();
  res.json({ success: true, sockets: config });
});

app.post('/api/admin/sockets', (req, res) => {
  try {
    const newConfig = req.body;
    if (!newConfig || typeof newConfig !== 'object') {
      return res.status(400).json({ success: false, error: 'Invalid sockets configuration' });
    }
    const current = readSocketsConfig();
    const merged = {
      player: { ...(current.player || {}), ...(newConfig.player || {}) },
      boss:   { ...(current.boss || {}),   ...(newConfig.boss || {}) },
      weapon: { ...(current.weapon || {}), ...(newConfig.weapon || {}) },
    };
    const dataDir = path.dirname(socketsFilePath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(socketsFilePath, JSON.stringify(merged, null, 2), 'utf8');
    console.log('[sockets] Successfully updated sockets.json');
    res.json({ success: true, message: 'Cập nhật cấu hình khớp tay & chuôi vũ khí thành công', sockets: merged });
  } catch (e) {
    console.error('[sockets] Error writing sockets.json:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Ensure runtime directories exist (important for Render ephemeral FS) ─────
const uploadDir     = path.join(__dirname, 'uploads');
const skinsDir      = path.join(__dirname, '../public/skins');
const questionsDir  = path.join(__dirname, '../data/questions');
const charactersDir = path.join(__dirname, '../public/assets/characters');
const modelsDir     = path.join(__dirname, '../public/assets/models');
[uploadDir, skinsDir, questionsDir, charactersDir, modelsDir].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});


// Multer for .docx question files (temp dest, then deleted)
const docxUpload = multer({ dest: uploadDir });

// Multer for skin images (permanent, saved to public/skins with socket-id name)
const skinStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, skinsDir),
  filename: (req, file, cb) => {
    const ext = file.originalname.toLowerCase().endsWith('.png') ? '.png' : '.jpg';
    cb(null, `${req.query.playerId || 'unknown'}${ext}`);
  },
});
const skinUpload = multer({
  storage: skinStorage,
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB max
  fileFilter: (req, file, cb) => {
    const ok = ['image/png', 'image/jpeg', 'image/jpg'].includes(file.mimetype);
    cb(null, ok);
  },
});

// ── Auth Endpoints ────────────────────────────────────────────────────────────
// NOTE: data/users.json is ephemeral on Render (wiped on redeploy).
// Admin "God Father" is re-seeded automatically by db.js on every startup.
// Regular player accounts must re-register after a server restart on Render.

/** POST /api/register  { username, password } → { ok, user } */
app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  const result = db.register(username, password);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});
app.post('/api/auth/register', (req, res) => {   // alias
  const { username, password } = req.body || {};
  const result = db.register(username, password);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

/** POST /api/login  { username, password } → { ok, user } */
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const result = db.login(username, password);
  if (!result.ok) return res.status(401).json(result);
  res.json(result);
});
app.post('/api/auth/login', (req, res) => {      // alias
  const { username, password } = req.body || {};
  const result = db.login(username, password);
  if (!result.ok) return res.status(401).json(result);
  res.json(result);
});

/** POST /api/auth/check  { userId } → { ok, user } — validate a cached session */
app.post('/api/auth/check', (req, res) => {
  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });
  const result = db.getUser(Number(userId));
  if (!result) return res.status(404).json({ ok: false, error: 'Session expired — please log in again.' });
  res.json({ ok: true, user: result });
});

/** POST /api/unlock-set  { userId, setId } → { ok, user } (full set, legacy) */
app.post('/api/unlock-set', (req, res) => {
  const { userId, setId } = req.body || {};
  if (!userId || !setId) return res.status(400).json({ ok: false, error: 'userId and setId required' });
  const result = db.unlockSet(Number(userId), setId);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

/** POST /api/unlock-piece  { userId, element, pieces: str|str[] } → { ok, user, newPieces, fullSetUnlocked } */
app.post('/api/unlock-piece', (req, res) => {
  const { userId, element, pieces } = req.body || {};
  if (!userId || !element || !pieces)
    return res.status(400).json({ ok: false, error: 'userId, element, pieces required' });
  const result = db.unlockPiece(Number(userId), element, pieces);
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
});

/** POST /api/update-stage  { userId, stage } → { ok } */
app.post('/api/update-stage', (req, res) => {
  const { userId, stage } = req.body || {};
  if (userId && stage) db.updateStage(Number(userId), Number(stage));
  res.json({ ok: true });
});

// ── Admin Question Bank Endpoints ─────────────────────────────────────────────

const VALID_ELEMENTS = ['thunder', 'fire', 'frost'];

/** GET /api/admin/questions/stats  — question counts per element */
app.get('/api/admin/questions/stats', (req, res) => {
  res.json({
    thunder: questionBank.getBankSize('thunder'),
    fire:    questionBank.getBankSize('fire'),
    frost:   questionBank.getBankSize('frost'),
  });
});

/** Legacy alias kept for existing client code */
app.get('/api/bank-info', (req, res) => {
  res.json({
    thunder: questionBank.getBankSize('thunder'),
    fire:    questionBank.getBankSize('fire'),
    frost:   questionBank.getBankSize('frost'),
  });
});

/**
 * POST /api/admin/questions/upload
 * Multipart form fields:
 *   file    – .docx question file
 *   element – 'thunder' | 'fire' | 'frost'
 *   mode    – 'replace' (default) | 'append'
 */
app.post('/api/admin/questions/upload', docxUpload.single('file'), async (req, res) => {
  const { element, mode = 'replace' } = req.body || {};
  if (!VALID_ELEMENTS.includes(element))
    return res.status(400).json({ ok: false, error: 'element phải là thunder | fire | frost' });
  if (!['replace', 'append'].includes(mode))
    return res.status(400).json({ ok: false, error: 'mode phải là replace | append' });
  if (!req.file)
    return res.status(400).json({ ok: false, error: 'Không có file được tải lên' });

  try {
    // parseDocx now returns { questions, dropped } instead of bare array
    const { questions: parsed, dropped } = await questionParser.parseDocx(req.file.path);
    fs.unlinkSync(req.file.path);

    // Convert to bank format { id, text, options[], correctIndex }
    const incoming = parsed.map((q, i) => ({
      id:           i + 1,
      text:         q.question,
      options:      Array.isArray(q.options)
                      ? q.options
                      : ['A','B','C','D'].map(k => q.options?.[k] || ''),
      correctIndex: q.correctIndex ?? 0,
    }));

    let result;
    if (mode === 'append') {
      result = questionBank.appendBank(element, incoming);
    } else {
      const total = questionBank.replaceBank(element, incoming);
      result = { total, added: incoming.length, skipped: 0 };
    }

    res.json({
      ok: true, mode, element,
      total:   result.total,
      added:   result.added,
      skipped: result.skipped,
      dropped: dropped || [],          // list of "Câu X" labels with no answer marker
    });
  } catch (e) {
    console.error('[admin/upload]', e.message);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * DELETE /api/admin/questions/clear?element=thunder
 * Wipes all questions from the specified bank.
 */
app.delete('/api/admin/questions/clear', (req, res) => {
  const { element } = req.query;
  if (!VALID_ELEMENTS.includes(element))
    return res.status(400).json({ ok: false, error: 'element phải là thunder | fire | frost' });
  questionBank.clearBank(element);
  res.json({ ok: true, element, total: 0 });
});

// ── Game Endpoints ────────────────────────────────────────────────────────────

/** POST /api/dev-questions?code=XXXX — God Father admin: inject 5 sample questions */
app.post('/api/dev-questions', (req, res) => {
  const { code } = req.query;
  const room = roomManager.getRoom(code);
  if (!room) return res.status(400).json({ error: 'Room not found' });

  const DEV_QUESTIONS = [
    { question:'1 + 1 = ?', options:{ A:'1', B:'2', C:'3', D:'4' }, correctIndex:1, answer:'B' },
    { question:'Thủ đô của Việt Nam là?', options:{ A:'TP.HCM', B:'Đà Nẵng', C:'Hà Nội', D:'Huế' }, correctIndex:2, answer:'C' },
    { question:'Màu của trời là?', options:{ A:'Đỏ', B:'Xanh lá', C:'Vàng', D:'Xanh dương' }, correctIndex:3, answer:'D' },
    { question:'2 × 3 = ?', options:{ A:'5', B:'6', C:'7', D:'8' }, correctIndex:1, answer:'B' },
    { question:'Con mèo kêu như thế nào?', options:{ A:'Gâu', B:'Meo', C:'Oink', D:'Moo' }, correctIndex:1, answer:'B' },
  ];

  roomManager.setQuestions(code, DEV_QUESTIONS);
  room.bossElement = null;
  res.json({ questionCount: DEV_QUESTIONS.length, bossIndex: 0 });
});

/** POST /upload?code=XXXX  — upload .docx question set */
app.post('/upload', docxUpload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.originalname.endsWith('.docx')) {
      return res.status(400).json({ error: 'Only .docx files are supported' });
    }
    const { code: roomCode } = req.query;
    if (!roomCode || !roomManager.getRoom(roomCode)) {
      return res.status(400).json({ error: 'Invalid room code' });
    }

    const { questions, dropped } = await questionParser.parseDocx(req.file.path);
    roomManager.setQuestions(roomCode, questions);
    roomManager.incrementPackIndex(roomCode);
    const room2 = roomManager.getRoom(roomCode);
    fs.unlinkSync(req.file.path);

    // Map bossIndex → element name for client-side awareness
    const BOSS_ELEMENTS = ['thunder', 'fire', 'frost', null];
    const bossIdx = room2 ? room2.bossIndex : 0;
    const bossElement = BOSS_ELEMENTS[bossIdx] || null;

    // Store bossElement in room for combat event emission
    if (room2) room2.bossElement = bossElement;

    res.json({
      questionCount: questions.length,
      dropped: dropped || [],
      bossIndex: bossIdx,
      bossElement,
      packNumber: room2 ? room2.packIndex : 1,
    });
  } catch (error) {
    console.error('[upload]', error.message);
    res.status(500).json({ error: error.message || 'Failed to process file' });
  }
});

/** POST /api/upload-skin?code=XXXX&playerId=socketId&target=player|boss — upload hand-drawn skin */
app.post('/api/upload-skin', skinUpload.single('skin'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file provided' });

    const { code: roomCode, playerId, target = 'player' } = req.query;
    if (!roomCode || !roomManager.getRoom(roomCode)) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Invalid room code' });
    }

    const skinUrl = `/skins/${req.file.filename}`;
    // Notify everyone in the room — include target so clients know where to apply it
    io.to(roomCode).emit('skin_uploaded', { playerId, skinUrl, target });
    res.json({ skinUrl, target });
  } catch (err) {
    console.error('[upload-skin]', err.message);
    res.status(500).json({ error: 'Failed to save skin' });
  }
});

/** POST /api/parse-text?code=XXXX — parse pasted raw text and load into room */
app.post('/api/parse-text', express.text({ type: '*/*', limit: '1mb' }), (req, res) => {
  try {
    const { code: roomCode, preview } = req.query;
    const rawText = req.body;
    if (!rawText || typeof rawText !== 'string' || rawText.trim().length < 5) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const questions = questionParser.parseText(rawText);
    if (questions.length < 1) {
      return res.status(400).json({ error: 'No questions could be parsed from the pasted text.' });
    }

    // preview=1 → just return parsed questions without loading them into the room
    if (preview === '1') {
      return res.json({ questionCount: questions.length, questions });
    }

    if (!roomCode || !roomManager.getRoom(roomCode)) {
      return res.status(400).json({ error: 'Invalid room code' });
    }
    roomManager.setQuestions(roomCode, questions);
    roomManager.incrementPackIndex(roomCode);
    const r3 = roomManager.getRoom(roomCode);
    res.json({ questionCount: questions.length, bossIndex: r3 ? r3.bossIndex : 0 });
  } catch (err) {
    console.error('[parse-text]', err.message);
    res.status(500).json({ error: err.message || 'Failed to parse text' });
  }
});


// ── Game helpers ──────────────────────────────────────────────────────────────

/** Broadcast the current question and start the server-side countdown. */
const sendQuestion = (code) => {
  const room = roomManager.getRoom(code);
  if (!room) return;

  const question  = room.questions[room.currentIndex];
  if (!question) return;

  const timeLimit = 30; // 30 seconds per question for both PvE and PvP

  io.to(code).emit('question', {
    index:    room.currentIndex + 1,          // 1-based for display
    total:    room.questions.length,
    question: question.question,
    options:  question.options,
    timeLimit,
  });

  if (room.timer) clearTimeout(room.timer);
  room.timer = setTimeout(() => resolveQuestion(code), timeLimit * 1000);
};

/** Evaluate answers, emit combat events, then advance or end the game. */
const resolveQuestion = (code) => {
  const room = roomManager.getRoom(code);
  if (!room || room.phase === 'REVIEW' || room.phase === 'GAME_OVER') return;
  if (room.timer) clearTimeout(room.timer);

  // Mark any player who never answered as timed-out
  roomManager.finaliseAnswers(code);

  const { correctAnswer, answerCounts, combatEvents, hp, bossHp, questionIndex, totalQuestions } =
    roomManager.scoreQuestion(code);

  // ① Result + counts (existing flow)
  io.to(code).emit('answer_result', { correctAnswer, answerCounts, hp, bossHp, questionIndex, totalQuestions });

  // ② Combat animations
  if (combatEvents.length > 0) {
    io.to(code).emit('combat_event', { events: combatEvents });
  }

  // ③ HP snapshot
  io.to(code).emit('hp_update', { hp, bossHp, questionIndex, totalQuestions });

  setTimeout(() => {
    const allDead = room.mode === 'pve' && Array.from(room.players.values()).every(p => (p.hp ?? 0) <= 0);
    const nextQ = allDead ? null : roomManager.nextQuestion(code);
    if (nextQ) {
      sendQuestion(code);
    } else {
      // Build final payload
      const finalHp = {};
      for (const p of room.players.values()) finalHp[p.id] = p.hp;

      let winner     = null;
      let maxHp      = -1;
      for (const p of room.players.values()) {
        if ((p.hp ?? 0) > maxHp) {
          maxHp  = p.hp ?? 0;
          winner = { id: p.id, name: p.name, hp: p.hp };
        }
      }

      const verdict = room.mode === 'pve' ? roomManager.getPveVerdict(code) : null;

      // ── PERFECT loot grants ────────────────────────────────────────────────
      const lootGrants = [];   // { playerId, element, newPieces, fullSetUnlocked }
      if (verdict === 'PERFECT' && room.bossElement) {
        const elem       = room.bossElement;
        const difficulty = room.difficulty || 'medium';

        for (const p of room.players.values()) {
          if (!p.userId) continue;   // unauthenticated player — skip

          // 2-piece system: weapon + outfit
          // Easy (20/20):   grants weapon
          // Medium (30/30): grants outfit (if already has outfit, grants weapon instead)
          // Hard (50/50):   grants BOTH weapon + outfit (full set)
          let piecesToGrant;
          if (difficulty === 'easy') {
            piecesToGrant = ['weapon'];
          } else if (difficulty === 'medium') {
            const existUser = db.getUser(p.userId);
            const owned     = existUser?.inventory?.[elem] || [];
            piecesToGrant   = owned.includes('outfit') ? ['weapon'] : ['outfit'];
          } else {
            // hard or dev: full 2-piece set
            piecesToGrant = ['weapon', 'outfit'];
          }

          const grant = db.unlockPiece(p.userId, elem, piecesToGrant);
          if (grant.ok && grant.newPieces.length > 0) {
            lootGrants.push({
              playerId:        p.id,
              element:         elem,
              newPieces:       grant.newPieces,
              fullSetUnlocked: grant.fullSetUnlocked,
              updatedUser:     grant.user,
            });
          }
        }
      }

      io.to(code).emit('game_over', {
        hp:        finalHp,
        bossHp:    room.bossHp,
        totalHp:   room.totalHp,
        winner,
        verdict,
        mode:      room.mode,
        element:   room.bossElement || null,
        difficulty: room.difficulty || null,
        lootGrants,
      });
      room.phase = 'GAME_OVER';
    }
  }, 5000);
};

// ── Socket.io ─────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  socket.on('create_room', ({ playerName, color, userId, equippedSet, inventory, equipped }) => {
    try {
      // Server-side inventory lookup as source of truth (fallback to client-sent)
      let serverInventory = inventory || { thunder: [], fire: [], frost: [] };
      if (userId) {
        try {
          const u = db.getUser(userId);
          if (u?.inventory) serverInventory = u.inventory;
        } catch(e) {}
      }
      const { code, players, hostId } = roomManager.createRoom(
        socket.id, playerName, color, userId, equippedSet || null, serverInventory, equipped || null
      );
      socket.join(code);
      socket.emit('room_created', { code, players, hostId });
    } catch (e) { console.error('[create_room]', e.message); }
  });

  socket.on('join_room', ({ code, playerName, color, userId, equippedSet, inventory, equipped }) => {
    try {
      let serverInventory = inventory || { thunder: [], fire: [], frost: [] };
      if (userId) {
        try {
          const u = db.getUser(userId);
          if (u?.inventory) serverInventory = u.inventory;
        } catch(e) {}
      }
      const { players, hostId } = roomManager.joinRoom(
        code, socket.id, playerName, color, userId, equippedSet || null, serverInventory, equipped || null
      );
      socket.join(code);
      socket.to(code).emit('player_joined', { players });
      socket.emit('room_joined', { code, players, hostId });
    } catch (e) {
      console.error('[join_room]', e.message);
      socket.emit('error', { message: e.message });
    }
  });

  /** Host selects game mode before starting */
  socket.on('set_mode', ({ code, mode }) => {
    try {
      roomManager.setMode(code, mode);
      io.to(code).emit('mode_changed', { mode });
    } catch (e) { console.error('[set_mode]', e.message); }
  });

  socket.on('start_game', ({ code, element, difficulty, testGear }) => {
    try {
      const room = roomManager.startGame(code, socket.id);

      // ── Load questions from bank if element + difficulty provided ──────────
      const BOSS_ELEMENTS = ['thunder', 'fire', 'frost'];
      const VALID_DIFFS   = ['easy', 'medium', 'hard', 'dev'];
      const bossIdx = BOSS_ELEMENTS.indexOf(element);

      if (element && VALID_DIFFS.includes(difficulty) && questionBank.getBankSize(element) > 0) {
        const bankQuestions = questionBank.sampleQuestions(element, difficulty);
        if (bankQuestions.length > 0) {
          room.questions   = bankQuestions;
          room.bossElement = element;
          room.bossIndex   = bossIdx >= 0 ? bossIdx : 0;
          room.difficulty  = difficulty;
        }
      } else if (difficulty === 'dev') {
        const demo = questionParser.getDemoQuestions().slice(0, 5);
        room.questions   = demo;
        room.bossElement = element || null;
        room.bossIndex   = bossIdx >= 0 ? bossIdx : 0;
        room.difficulty  = 'dev';
      } else if (element && bossIdx >= 0) {
        room.bossElement = element;
        room.bossIndex   = bossIdx;
        room.difficulty  = difficulty || 'medium';
      }

      if (!room.questions || room.questions.length === 0) {
        room.questions = questionParser.getDemoQuestions();
      }

      // ── Dev gear override: specific element full-set or normal ────────────
      if (testGear) {
        let activeGear = null;
        let isFull = false;

        if (['thunder', 'fire', 'frost'].includes(testGear)) {
          activeGear = testGear;
          isFull = true;
        } else if (testGear === 'full') {
          activeGear = element || 'thunder';
          isFull = true;
        } else if (testGear === 'normal') {
          activeGear = null;
          isFull = false;
        }

        for (const p of room.players.values()) {
          if (!p.inventory) p.inventory = { thunder: [], fire: [], frost: [] };
          if (isFull && activeGear) {
            p.inventory[activeGear] = ['weapon', 'outfit'];
            p.equippedSet = activeGear;
            p.damagePerHit = 2;
            console.log(`[testGear] Player ${p.name} equipped full ${activeGear} set (2-hit)`);
          } else {
            p.inventory = { thunder: [], fire: [], frost: [] };
            p.equippedSet = null;
            p.damagePerHit = 1;
            console.log(`[testGear] Player ${p.name} equipped normal gear (1-hit)`);
          }
        }

        room.devEquippedSet = activeGear;
      }

      // Initialise HP from question count
      roomManager.initHp(code);

      io.to(code).emit('game_started');
      io.to(code).emit('game_mode_set', {
        mode: room.mode,
        totalHp: room.totalHp,
        bossIndex: room.bossIndex || 0,
        testGear: testGear || null,
        equippedSet: testGear ? (room.devEquippedSet || null) : undefined,
      });


      const nextQ = roomManager.nextQuestion(code);
      if (nextQ) sendQuestion(code);
    } catch (e) {
      console.error('[start_game]', e.message);
      socket.emit('error', { message: e.message });
    }
  });


  socket.on('submit_answer', ({ code, answer }) => {
    try {
      const { allAnswered } = roomManager.submitAnswer(code, socket.id, answer);
      if (allAnswered) resolveQuestion(code);
    } catch (e) { console.error('[submit_answer]', e.message); }
  });

  socket.on('player_move', ({ code, position, rotation }) => {
    try {
      socket.to(code).emit('player_moved', { playerId: socket.id, position, rotation });
    } catch (e) { console.error('[player_move]', e.message); }
  });

  socket.on('disconnect', () => {
    try {
      const result = roomManager.removePlayer(socket.id);
      if (result) {
        const { code, players, newHostId } = result;
        io.to(code).emit('player_left', { playerId: socket.id, players, newHostId });
      }
    } catch (e) { console.error('[disconnect]', e.message); }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const HOST = '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`[Quiz-Battle 3D] Server listening on ${HOST}:${PORT}`);
});
