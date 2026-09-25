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
app.use(express.json());


// ── Ensure runtime directories exist (important for Render ephemeral FS) ─────
const uploadDir   = path.join(__dirname, 'uploads');
const skinsDir    = path.join(__dirname, '../public/skins');
const questionsDir = path.join(__dirname, '../data/questions');
[uploadDir, skinsDir, questionsDir].forEach(d => {
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

  const { correctAnswer, answerCounts, combatEvents, hp, bossHp } =
    roomManager.scoreQuestion(code);

  // ① Result + counts (existing flow)
  io.to(code).emit('answer_result', { correctAnswer, answerCounts, hp, bossHp });

  // ② Combat animations
  if (combatEvents.length > 0) {
    io.to(code).emit('combat_event', { events: combatEvents });
  }

  // ③ HP snapshot
  io.to(code).emit('hp_update', { hp, bossHp });

  // ④ Advance after review delay
  setTimeout(() => {
    const nextQ = roomManager.nextQuestion(code);
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

          // Determine which pieces to grant based on difficulty
          let piecesToGrant;
          if (difficulty === 'easy') {
            piecesToGrant = ['weapon'];
          } else if (difficulty === 'medium') {
            // Check if player already has the 4 defensive pieces
            const result0 = db.unlockPiece(p.userId, elem, []);  // read-only probe
            const owned   = result0.user?.inventory?.[elem] || [];
            const defPieces = ['hat','shirt','pants','shoes'];
            const hasAll4 = defPieces.every(pc => owned.includes(pc));
            piecesToGrant = hasAll4 ? ['weapon'] : defPieces;
          } else {
            // hard
            piecesToGrant = ['hat','shirt','pants','shoes','weapon'];
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

  socket.on('create_room', ({ playerName, color, userId }) => {
    try {
      const { code, players, hostId } = roomManager.createRoom(socket.id, playerName, color, userId);
      socket.join(code);
      socket.emit('room_created', { code, players, hostId });
    } catch (e) { console.error('[create_room]', e.message); }
  });

  socket.on('join_room', ({ code, playerName, color, userId }) => {
    try {
      const { players, hostId } = roomManager.joinRoom(code, socket.id, playerName, color, userId);
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

  socket.on('start_game', ({ code, element, difficulty }) => {
    try {
      const room = roomManager.startGame(code, socket.id);

      // ── Load questions from bank if element + difficulty provided ──────────
      const BOSS_ELEMENTS = ['thunder', 'fire', 'frost'];
      const bossIdx = BOSS_ELEMENTS.indexOf(element);

      if (element && difficulty && questionBank.getBankSize(element) > 0) {
        // Sample from bank — already shuffled with randomized options
        const bankQuestions = questionBank.sampleQuestions(element, difficulty);
        if (bankQuestions.length > 0) {
          room.questions   = bankQuestions;
          room.bossElement = element;
          room.bossIndex   = bossIdx >= 0 ? bossIdx : 0;
          room.difficulty  = difficulty;
        }
      } else if (element && bossIdx >= 0) {
        // Element chosen but bank empty — use existing uploaded questions or demo
        room.bossElement = element;
        room.bossIndex   = bossIdx;
        room.difficulty  = difficulty || 'medium';
      }

      // Fallback to uploaded questions or demo
      if (!room.questions || room.questions.length === 0) {
        room.questions = questionParser.getDemoQuestions();
      }

      // Initialise HP from question count
      roomManager.initHp(code);

      io.to(code).emit('game_started');
      io.to(code).emit('game_mode_set', { mode: room.mode, totalHp: room.totalHp, bossIndex: room.bossIndex || 0 });

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
