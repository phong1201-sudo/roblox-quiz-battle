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

  createRoom(socketId, playerName, color, userId) {
    let code;
    do { code = this.generateCode(); } while (this.rooms.has(code));

    const room = {
      code,
      hostId: socketId,
      players: new Map(),
      questions: [],
      currentIndex: -1,
      phase: 'LOBBY',
      timer: null,
      mode: 'pve',
      totalHp: null,
      bossHp: null,
      bossHpMultiplier: 1,
      packIndex: 0,
      bossIndex: 0,
    };

    room.players.set(socketId, {
      id: socketId, name: playerName, color,
      userId: userId || null,
      hp: null, score: 0,
      answer: null, answerTime: null, hasSubmitted: false,
      position: null, rotation: null,
      correctAnswerCount: 0,
      damagePerHit: 1,
      thunderSetUnlocked: false,
    });

    this.rooms.set(code, room);
    return { code, players: Array.from(room.players.values()), hostId: socketId };
  }

  joinRoom(code, socketId, playerName, color, userId) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');
    if (room.phase !== 'LOBBY') throw new Error('Game already in progress');

    room.players.set(socketId, {
      id: socketId, name: playerName, color,
      userId: userId || null,
      hp: null, score: 0,
      answer: null, answerTime: null, hasSubmitted: false,
      position: null, rotation: null,
      correctAnswerCount: 0,
      damagePerHit: 1,
      thunderSetUnlocked: false,
    });

    return { code, players: Array.from(room.players.values()), hostId: room.hostId };
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
    room.bossIndex = (room.packIndex - 1) % 4;
  }

  setQuestions(code, questions) {
    const room = this.rooms.get(code);
    if (!room) return;

    // ── Fisher-Yates shuffle (in-place) ──────────────────────────────────────
    function shuffleArray(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    // 1. Shuffle question order
    shuffleArray(questions);

    // 2. For each question, shuffle its option choices & remap correctIndex
    questions.forEach(q => {
      // Build tagged option list
      //  q.options may be an object {A,B,C,D} or an array ['optA','optB','optC','optD']
      let optArr;
      if (Array.isArray(q.options)) {
        optArr = q.options.map((text, idx) => ({ text, isCorrect: idx === q.correctIndex }));
      } else {
        // Object form {A, B, C, D}
        const keys = ['A','B','C','D'];
        optArr = keys.map((k, idx) => ({ text: q.options[k] ?? '', isCorrect: idx === q.correctIndex }));
      }

      shuffleArray(optArr);

      // Re-assign options as plain array and update correctIndex
      q.options      = optArr.map(o => o.text);
      q.correctIndex = optArr.findIndex(o => o.isCorrect);
      // Also update answer letter to match new position
      q.answer       = ['A','B','C','D'][q.correctIndex] || 'A';
    });

    room.questions = questions;
  }

  setMode(code, mode) {
    const room = this.rooms.get(code);
    if (room && room.phase === 'LOBBY') {
      room.mode = mode === 'pvp' ? 'pvp' : 'pve';
    }
  }

  setBossHpMultiplier(code, multiplier) {
    const room = this.rooms.get(code);
    if (room) room.bossHpMultiplier = multiplier;
  }

  startGame(code, socketId) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');
    if (room.hostId !== socketId) throw new Error('Only host can start the game');
    room.phase = 'QUESTION';
    return room;
  }

  /** Initialise HP. Boss HP = total * bossHpMultiplier. Player HP = total. */
  initHp(code) {
    const room = this.rooms.get(code);
    if (!room) return;
    const total = Math.max(1, room.questions.length);
    room.bossHpMultiplier = room.bossHpMultiplier || 1;
    room.totalHp = total;
    room.bossHp  = total * room.bossHpMultiplier;
    for (const p of room.players.values()) {
      p.hp = total;
    }
  }

  submitAnswer(code, socketId, answer) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');
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

  // ── Milestone item names ───────────────────────────────────────────────────
  static MILESTONE_ITEMS = {
    10: 'Boots of Thunder',
    20: 'Lightning Greaves',
    30: 'Thunder Armor',
    40: 'Lightning Helm',
    50: 'Lightning Katana — FULL THUNDER SET!',
  };

  scoreQuestion(code) {
    const room = this.rooms.get(code);
    if (!room) throw new Error('Room not found');

    const question    = room.questions[room.currentIndex];
    const correct     = question.answer;
    const OPTS        = ['A','B','C','D'];
    const milestones  = [];

    const isCorrect = (playerAnswer) => {
      if (!playerAnswer) return false;
      const ans = playerAnswer.toUpperCase();
      if (ans === correct) return true;
      if (question.correctIndex !== undefined) return OPTS.indexOf(ans) === question.correctIndex;
      return false;
    };

    const answerCounts = { A:0, B:0, C:0, D:0 };
    const combatEvents = [];

    for (const p of room.players.values()) {
      if (p.answer && answerCounts[p.answer] !== undefined) answerCounts[p.answer]++;
    }

    if (room.mode === 'pve') {
      // ── PvE ───────────────────────────────────────────────────────────────
      for (const p of room.players.values()) {
        if (isCorrect(p.answer)) {
          const dmg = p.damagePerHit || 1;
          room.bossHp = Math.max(0, room.bossHp - dmg);

          p.correctAnswerCount = (p.correctAnswerCount || 0) + 1;
          const count = p.correctAnswerCount;
          if (RoomManager.MILESTONE_ITEMS[count]) {
            const milestone = { playerId: p.id, count, itemName: RoomManager.MILESTONE_ITEMS[count] };
            milestones.push(milestone);
            if (count === 50 && !p.thunderSetUnlocked) {
              p.thunderSetUnlocked = true;
              p.damagePerHit = 2;
              if (room.bossHpMultiplier < 2) {
                room.bossHpMultiplier = 2;
                const remaining = room.questions.length - room.currentIndex - 1;
                room.bossHp += remaining;
              }
            }
          }

          combatEvents.push({
            type: 'attack',
            attackerId: p.id,
            victimId: 'boss',
            damage: dmg,
            lightning: p.thunderSetUnlocked,
            element: room.bossElement || null,   // current boss element (thunder/fire/frost)
          });
        } else {
          combatEvents.push({ type: 'dodge', targetId: 'boss' });
        }
      }
    } else {
      // ── PvP 1v1 ───────────────────────────────────────────────────────────
      const players = Array.from(room.players.values());

      const pairDuel = (pa, pb) => {
        const aCorrect = isCorrect(pa.answer);
        const bCorrect = isCorrect(pb.answer);

        if (aCorrect && bCorrect) {
          const aTime = pa.answerTime ?? Infinity;
          const bTime = pb.answerTime ?? Infinity;
          if (aTime <= bTime) {
            const dmg = pa.damagePerHit || 1;
            pb.hp = Math.max(0, pb.hp - dmg);
            combatEvents.push({ type:'attack', attackerId:pa.id, victimId:pb.id, damage:dmg });
          } else {
            const dmg = pb.damagePerHit || 1;
            pa.hp = Math.max(0, pa.hp - dmg);
            combatEvents.push({ type:'attack', attackerId:pb.id, victimId:pa.id, damage:dmg });
          }
        } else if (aCorrect && !bCorrect) {
          const dmg = pa.damagePerHit || 1;
          pb.hp = Math.max(0, pb.hp - dmg);
          pa.correctAnswerCount = (pa.correctAnswerCount || 0) + 1;
          combatEvents.push({ type:'attack', attackerId:pa.id, victimId:pb.id, damage:dmg });
        } else if (!aCorrect && bCorrect) {
          const dmg = pb.damagePerHit || 1;
          pa.hp = Math.max(0, pa.hp - dmg);
          pb.correctAnswerCount = (pb.correctAnswerCount || 0) + 1;
          combatEvents.push({ type:'attack', attackerId:pb.id, victimId:pa.id, damage:dmg });
        } else {
          combatEvents.push({ type:'dodge', targetId:pa.id });
          combatEvents.push({ type:'dodge', targetId:pb.id });
        }
      };

      for (let i = 0; i < players.length - 1; i++) {
        for (let j = i + 1; j < players.length; j++) pairDuel(players[i], players[j]);
      }
    }

    const hp = {};
    for (const p of room.players.values()) hp[p.id] = p.hp;

    room.phase = 'REVIEW';
    return { correctAnswer: correct, answerCounts, combatEvents, hp, bossHp: room.bossHp, milestones };
  }

  nextQuestion(code) {
    const room = this.rooms.get(code);
    if (!room) return null;
    room.currentIndex++;
    if (room.currentIndex >= room.questions.length) return null;
    room.phase = 'QUESTION';
    for (const p of room.players.values()) {
      p.answer = null; p.answerTime = null; p.hasSubmitted = false;
    }
    return room.questions[room.currentIndex];
  }

  getPveVerdict(code) {
    const room = this.rooms.get(code);
    if (!room) return 'DEFEAT';
    const bossHpPct = (room.bossHp / room.bossHp + room.totalHp) * 100;
    if (room.bossHp === 0)  return 'PERFECT';
    if (room.bossHp < room.totalHp * room.bossHpMultiplier * 0.5) return 'VICTORY';
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
