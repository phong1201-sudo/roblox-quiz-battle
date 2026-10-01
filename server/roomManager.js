class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  generateCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Find any room currently hosted by this socket ID
   */
  findRoomByHost(socketId) {
    for (const room of this.rooms.values()) {
      if (room.hostId === socketId) return room;
    }
    return null;
  }

  createRoom(socketId, playerName, color, userId, equippedSet, inventory, equipped, mode = 'team_vs_boss', stage = 'thunder') {
    // If socket is already hosting a room, clean up the previous room first
    const existingHostedRoom = this.findRoomByHost(socketId);
    if (existingHostedRoom) {
      if (existingHostedRoom.timer) clearTimeout(existingHostedRoom.timer);
      this.rooms.delete(existingHostedRoom.code);
    }

    let code;
    do { code = this.generateCode(); } while (this.rooms.has(code));

    // Normalize mode: 'team_vs_boss' (or 'pve') vs 'pvp_1v1' (or 'pvp')
    const normalizedMode = (mode === 'pvp_1v1' || mode === 'pvp') ? 'pvp_1v1' : 'team_vs_boss';
    const normalizedStage = ['fire', 'frost', 'thunder'].includes(stage) ? stage : 'thunder';

    const room = {
      code,
      hostId: socketId,
      players: new Map(),
      questions: [],
      currentIndex: -1,
      phase: 'LOBBY',
      timer: null,
      mode: normalizedMode,
      stage: normalizedStage,
      bossElement: normalizedStage,
      totalHp: 50,
      bossHp: 50,
      bossHpMultiplier: 1,
      packIndex: 0,
      bossIndex: ['thunder', 'fire', 'frost'].indexOf(normalizedStage),
    };

    const playerOutfit = equipped?.outfit || equippedSet || 'default';
    const hasElemental = ['thunder', 'fire', 'frost'].includes(playerOutfit.toLowerCase());

    room.players.set(socketId, {
      id: socketId,
      name: playerName,
      color,
      userId: userId || null,
      hp: 50,
      score: 0,
      answer: null,
      answerTime: null,
      hasSubmitted: false,
      position: null,
      rotation: null,
      correctAnswerCount: 0,
      damagePerHit: hasElemental ? 2 : 1,
      equippedSet: playerOutfit,
      equipped: equipped || { outfit: playerOutfit, weapon: playerOutfit },
      inventory: inventory || { thunder: [], fire: [], frost: [] },
      hasElemental,
    });

    this.rooms.set(code, room);
    return {
      code,
      players: Array.from(room.players.values()),
      hostId: socketId,
      mode: room.mode,
      stage: room.stage
    };
  }

  dismantleRoom(code) {
    const room = this.rooms.get(code);
    if (!room) return null;
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    this.rooms.delete(code);
    return room;
  }

  joinRoom(code, socketId, playerName, color, userId, equippedSet, inventory, equipped) {
    const cleanCode = (code || '').trim().toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (!room) throw new Error('Phòng không tồn tại hoặc đã bị hủy!');

    // Auto-dismantle any previous room hosted by this socket/user when joining another room
    for (const [rCode, r] of this.rooms.entries()) {
      if (rCode !== cleanCode) {
        let isHost = (r.hostId === socketId);
        if (!isHost) {
          for (const p of r.players.values()) {
            if (p.name === playerName || (userId && p.userId === userId)) {
              if (r.hostId === p.id) { isHost = true; break; }
            }
          }
        }
        if (isHost) {
          console.log(`[Room Cleanup] Auto-dismantling previous room ${rCode} for host ${playerName}`);
          if (r.timer) clearTimeout(r.timer);
          this.rooms.delete(rCode);
        }
      }
    }

    if (room.phase !== 'LOBBY' && room.phase !== 'GAME_OVER' && !room.players.has(socketId)) {
      throw new Error('Trận đấu đang diễn ra, không thể tham gia!');
    }

    // Maximum 2 players per match (Team vs Boss or 1v1 PvP)
    if (room.players.size >= 2 && !room.players.has(socketId)) {
      throw new Error('Phòng đã đầy (tối đa 2 người chơi)!');
    }

    if (room.phase === 'GAME_OVER') {
      room.phase = 'LOBBY';
      room.currentIndex = -1;
    }

    const playerOutfit = equipped?.outfit || equippedSet || 'default';
    const hasElemental = ['thunder', 'fire', 'frost'].includes(playerOutfit.toLowerCase());

    room.players.set(socketId, {
      id: socketId,
      name: playerName,
      color,
      userId: userId || null,
      hp: 50,
      score: 0,
      answer: null,
      answerTime: null,
      hasSubmitted: false,
      position: null,
      rotation: null,
      correctAnswerCount: 0,
      damagePerHit: hasElemental ? 2 : 1,
      equippedSet: playerOutfit,
      equipped: equipped || { outfit: playerOutfit, weapon: playerOutfit },
      inventory: inventory || { thunder: [], fire: [], frost: [] },
      hasElemental,
    });

    const isFull = room.players.size === 2;
    return {
      code,
      players: Array.from(room.players.values()),
      hostId: room.hostId,
      isFull,
      mode: room.mode,
      stage: room.stage
    };
  }

  removePlayer(socketId) {
    for (const [code, room] of this.rooms.entries()) {
      if (room.players.has(socketId)) {
        room.players.delete(socketId);
        if (room.players.size === 0) {
          if (room.timer) clearTimeout(room.timer);
          this.rooms.delete(code);
          return null;
        }
        let newHostId = null;
        if (room.hostId === socketId) {
          newHostId = room.players.keys().next().value;
          room.hostId = newHostId;
        }
        return { code, players: Array.from(room.players.values()), newHostId };
      }
    }
    return null;
  }

  incrementPackIndex(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    room.packIndex++;
    room.bossIndex = (room.packIndex - 1) % 3;
  }

  setQuestions(code, questions) {
    const room = this.rooms.get(code);
    if (!room) return;

    function shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    shuffleArray(questions);

    questions.forEach(q => {
      let rawCorrect = (q.correctIndex !== undefined)
        ? q.correctIndex
        : (typeof q.answer === 'number' ? q.answer : ['A','B','C','D'].indexOf(String(q.answer || 'A').toUpperCase()));
      const targetCorrectIdx = rawCorrect >= 0 ? rawCorrect : 0;

      let optArr;
      if (Array.isArray(q.options)) {
        optArr = q.options.map((text, idx) => ({ text, isCorrect: idx === targetCorrectIdx }));
      } else {
        const keys = ['A','B','C','D'];
        optArr = keys.map((k, idx) => ({ text: q.options[k] ?? '', isCorrect: idx === targetCorrectIdx }));
      }

      shuffleArray(optArr);

      q.options      = optArr.map(o => o.text);
      q.correctIndex = optArr.findIndex(o => o.isCorrect);
      q.answer       = ['A','B','C','D'][q.correctIndex] || 'A';
    });

    room.questions = questions;
  }

  setMode(code, mode) {
    const room = this.rooms.get(code);
    if (room && room.phase === 'LOBBY') {
      room.mode = (mode === 'pvp_1v1' || mode === 'pvp') ? 'pvp_1v1' : 'team_vs_boss';
    }
  }

  setStage(code, stage) {
    const room = this.rooms.get(code);
    if (room && room.phase === 'LOBBY') {
      const clean = ['thunder', 'fire', 'frost'].includes(stage) ? stage : 'thunder';
      room.stage = clean;
      room.bossElement = clean;
      room.bossIndex = ['thunder', 'fire', 'frost'].indexOf(clean);
    }
  }

  setBossHpMultiplier(code, multiplier) {
    const room = this.rooms.get(code);
    if (room) room.bossHpMultiplier = multiplier;
  }

  startGame(code, socketId) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Phòng không tồn tại!');
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    room.currentIndex = -1;
    room.phase = 'QUESTION';
    return room;
  }

  /**
   * Initialise HP:
   * Both Team vs Boss and 1v1 PvP start with 50 HP for players and 50 HP for boss.
   */
  initHp(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    const total = Math.max(50, room.questions.length);
    room.bossHpMultiplier = 1;
    room.totalHp = total;
    room.bossHp  = total;

    for (const p of room.players.values()) {
      p.hp = total;
      p.correctAnswerCount = 0;
      p.hasSubmitted = false;
      p.answer = null;
      p.answerTime = null;
    }
  }

  submitAnswer(code, socketId, answer) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Phòng không tồn tại!');
    const player = room.players.get(socketId);
    if (player && !player.hasSubmitted) {
      player.answer       = answer;
      player.answerTime   = (answer !== null) ? Date.now() : null;
      player.hasSubmitted = true;
    }
    const allAnswered = Array.from(room.players.values()).every(p => p.hasSubmitted);
    return { allAnswered };
  }

  finaliseAnswers(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    for (const p of room.players.values()) {
      if (!p.hasSubmitted) {
        p.answer       = null;
        p.answerTime   = null;
        p.hasSubmitted = true;
      }
    }
  }

  scoreQuestion(code) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');

    const question    = room.questions[room.currentIndex];
    const correct     = question.answer;
    const OPTS        = ['A','B','C','D'];

    const isCorrect = (playerAnswer) => {
      if (!playerAnswer) return false;
      const ans = playerAnswer.toUpperCase();
      if (ans === correct) return true;
      if (question.correctIndex !== undefined) return OPTS.indexOf(ans) === question.correctIndex;
      return false;
    };

    /**
     * Check if player is wearing Full Elemental Armor (fire, frost, thunder)
     */
    const checkHasElemental = (p) => {
      const outfit = (p.equipped?.outfit || p.equippedSet || '').toLowerCase().trim();
      return ['thunder', 'fire', 'frost'].includes(outfit);
    };

    const answerCounts = { A:0, B:0, C:0, D:0 };
    const combatEvents = [];

    for (const p of room.players.values()) {
      if (p.answer && answerCounts[p.answer] !== undefined) answerCounts[p.answer]++;
    }

    const isPvP = (room.mode === 'pvp_1v1' || room.mode === 'pvp');

    if (!isPvP) {
      // ═════════════════════════════════════════════════════════════════════════
      // MODE A: Team vs Boss (2 Players vs 1 Elemental Boss)
      // ═════════════════════════════════════════════════════════════════════════
      for (const p of room.players.values()) {
        const hasElemental = checkHasElemental(p);
        const outfit = (p.equipped?.outfit || p.equippedSet || 'default').toLowerCase();

        if (isCorrect(p.answer)) {
          // Player Attack on Boss:
          // Equipped Elemental outfit: Boss loses -2 HP (-1 slash + -1 elemental proc with matching VFX)
          // Equipped Default outfit: Boss loses -1 HP (no elemental proc)
          const damageDealt = hasElemental ? 2 : 1;
          room.bossHp = Math.max(0, room.bossHp - damageDealt);
          p.correctAnswerCount = (p.correctAnswerCount || 0) + 1;

          combatEvents.push({
            type: 'attack',
            isCorrect: true,
            attackerId: p.id,
            victimId: 'boss',
            damage: damageDealt,
            hasElemental,
            outfit,
            element: hasElemental ? outfit : null,
            bossElement: room.bossElement || room.stage || 'thunder',
            questionIndex: room.currentIndex,
            totalQuestions: room.totalHp,
            currentBossHp: room.bossHp,
            remainingPlayerHp: p.hp,
          });
        } else {
          // Boss Counterattack:
          // Player answers wrong: Boss casts elemental attack hitting that specific player
          // Elemental outfit: Player takes only -1 HP
          // Default outfit: Player takes -2 HP
          const damageTaken = hasElemental ? 1 : 2;
          p.hp = Math.max(0, p.hp - damageTaken);

          combatEvents.push({
            type: 'dodge',
            isCorrect: false,
            attackerId: 'boss',
            victimId: p.id,
            targetId: p.id,
            damage: damageTaken,
            playerDamage: damageTaken,
            hasElemental,
            outfit,
            element: room.bossElement || room.stage || 'thunder',
            bossElement: room.bossElement || room.stage || 'thunder',
            questionIndex: room.currentIndex,
            remainingPlayerHp: p.hp,
            currentBossHp: room.bossHp,
            totalQuestions: room.totalHp,
          });
        }
      }
    } else {
      // ═════════════════════════════════════════════════════════════════════════
      // MODE B: 1 vs 1 PvP (Duels on Elemental Arena)
      // ═════════════════════════════════════════════════════════════════════════
      const players = Array.from(room.players.values());
      const p1 = players[0];
      const p2 = players[1];

      if (p1 && p2) {
        const p1Correct = isCorrect(p1.answer);
        const p2Correct = isCorrect(p2.answer);
        const p1HasElem = checkHasElemental(p1);
        const p2HasElem = checkHasElemental(p2);

        // Defense Scaling:
        // Opponent wearing Full Elemental Armor: Takes -1 HP
        // Opponent wearing Default Outfit: Takes -2 HP
        const p1DamageTaken = p1HasElem ? 1 : 2;
        const p2DamageTaken = p2HasElem ? 1 : 2;

        if (p1Correct && p2Correct) {
          // Both answer correctly: Both leap forward and strike opponent!
          p1.hp = Math.max(0, p1.hp - p1DamageTaken);
          p2.hp = Math.max(0, p2.hp - p2DamageTaken);
          p1.correctAnswerCount = (p1.correctAnswerCount || 0) + 1;
          p2.correctAnswerCount = (p2.correctAnswerCount || 0) + 1;

          combatEvents.push({
            type: 'attack',
            attackerId: p1.id,
            victimId: p2.id,
            damage: p2DamageTaken,
            hasElemental: p2HasElem,
            attackerOutfit: p1.equipped?.outfit || 'default',
            victimRemainingHp: p2.hp,
          });
          combatEvents.push({
            type: 'attack',
            attackerId: p2.id,
            victimId: p1.id,
            damage: p1DamageTaken,
            hasElemental: p1HasElem,
            attackerOutfit: p2.equipped?.outfit || 'default',
            victimRemainingHp: p1.hp,
          });
        } else if (p1Correct && !p2Correct) {
          p2.hp = Math.max(0, p2.hp - p2DamageTaken);
          p1.correctAnswerCount = (p1.correctAnswerCount || 0) + 1;

          combatEvents.push({
            type: 'attack',
            attackerId: p1.id,
            victimId: p2.id,
            damage: p2DamageTaken,
            hasElemental: p2HasElem,
            attackerOutfit: p1.equipped?.outfit || 'default',
            victimRemainingHp: p2.hp,
          });
        } else if (!p1Correct && p2Correct) {
          p1.hp = Math.max(0, p1.hp - p1DamageTaken);
          p2.correctAnswerCount = (p2.correctAnswerCount || 0) + 1;

          combatEvents.push({
            type: 'attack',
            attackerId: p2.id,
            victimId: p1.id,
            damage: p1DamageTaken,
            hasElemental: p1HasElem,
            attackerOutfit: p2.equipped?.outfit || 'default',
            victimRemainingHp: p1.hp,
          });
        } else {
          // Neither answered correctly
          combatEvents.push({ type: 'dodge', targetId: p1.id });
          combatEvents.push({ type: 'dodge', targetId: p2.id });
        }
      }
    }

    const hp = {};
    for (const p of room.players.values()) hp[p.id] = p.hp;

    room.phase = 'REVIEW';
    return {
      correctAnswer: correct,
      answerCounts,
      combatEvents,
      hp,
      bossHp: room.bossHp,
      questionIndex: room.currentIndex,
      totalQuestions: room.totalHp,
    };
  }

  /**
   * MVP Determination for Team vs Boss:
   * Total Score = (Correct Answers * 10) + (Remaining HP * 5)
   */
  calculateMvp(code) {
    const room = this.rooms.get(code);
    if (!room) return null;

    const players = Array.from(room.players.values());
    if (players.length === 0) return null;

    let bestPlayer = null;
    let highestScore = -1;
    const scores = {};

    for (const p of players) {
      const correct = p.correctAnswerCount || 0;
      const remainingHp = Math.max(0, p.hp || 0);
      const score = (correct * 10) + (remainingHp * 5);
      scores[p.id] = score;

      if (score > highestScore) {
        highestScore = score;
        bestPlayer = {
          id: p.id,
          name: p.name,
          score,
          correct,
          remainingHp,
          color: p.color
        };
      }
    }

    return { mvp: bestPlayer, scores };
  }

  nextQuestion(code) {
    const room = this.rooms.get(code);
    if (!room) return null;
    room.currentIndex++;
    if (room.currentIndex >= room.questions.length) return null;
    room.phase = 'QUESTION';
    for (const p of room.players.values()) {
      p.answer = null;
      p.answerTime = null;
      p.hasSubmitted = false;
    }
    return room.questions[room.currentIndex];
  }

  getPveVerdict(code) {
    const room = this.rooms.get(code);
    if (!room) return 'DEFEAT';
    const allDead = Array.from(room.players.values()).every(p => (p.hp ?? 0) <= 0);
    if (allDead) return 'DEFEAT';
    if (room.bossHp === 0) return 'PERFECT';
    if (room.bossHp <= Math.floor(room.totalHp * 0.5)) return 'VICTORY';
    return 'DEFEAT';
  }

  getPlayers(code) {
    const room = this.rooms.get(code);
    return room ? Array.from(room.players.values()) : [];
  }

  getRoom(code) { return this.rooms.get(code) || null; }

  findRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.has(socketId)) return room;
    }
    return null;
  }
}

module.exports = new RoomManager();
