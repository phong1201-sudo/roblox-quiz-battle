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
      element: normalizedStage,
      bossElement: normalizedStage,
      difficulty: 'medium',
      totalHp: 30,
      bossHp: 30,
      bossHpMultiplier: 1,
      packIndex: 0,
      bossIndex: ['thunder', 'fire', 'frost'].indexOf(normalizedStage),
    };

    const playerOutfit = equipped?.outfit || equippedSet || 'default';
    const hasElemental = ['thunder', 'fire', 'frost'].includes(playerOutfit.toLowerCase());

    room.host = {
      socketId,
      username: playerName,
      outfit: playerOutfit,
      isReady: false,
      color,
      userId: userId || null
    };
    room.guest = null;

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
      ready: false,
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

    room.guest = {
      socketId,
      username: playerName,
      outfit: playerOutfit,
      isReady: false,
      color,
      userId: userId || null
    };

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
      ready: false,
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

  setPlayerReady(code, socketId, ready, equippedSet, equipped) {
    const cleanCode = (code || '').trim().toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (!room) throw new Error('Phòng không tồn tại!');
    const player = room.players.get(socketId);
    if (!player) throw new Error('Người chơi không tồn tại!');

    player.ready = Boolean(ready);

    const playerOutfit = (equipped?.outfit || equippedSet || player.equippedSet || 'default').toLowerCase();
    const hasElemental = ['thunder', 'fire', 'frost'].includes(playerOutfit);
    player.equippedSet = playerOutfit;
    player.equipped = equipped || { outfit: playerOutfit, weapon: playerOutfit };
    player.damagePerHit = hasElemental ? 2 : 1;
    player.hasElemental = hasElemental;

    if (room.host && room.host.socketId === socketId) {
      room.host.isReady = Boolean(ready);
      room.host.outfit = playerOutfit;
    } else if (room.guest && room.guest.socketId === socketId) {
      room.guest.isReady = Boolean(ready);
      room.guest.outfit = playerOutfit;
    }

    const players = Array.from(room.players.values());
    const allReady = (room.host && room.host.isReady) && (room.guest && room.guest.isReady);

    return { allReady, players, room };
  }

  updatePlayerEquipment(code, socketId, equippedSet, equipped) {
    const cleanCode = (code || '').trim().toUpperCase();
    const room = this.rooms.get(cleanCode);
    if (!room) return;
    const player = room.players.get(socketId);
    if (!player) return;
    const playerOutfit = (equipped?.outfit || equippedSet || 'default').toLowerCase();
    const hasElemental = ['thunder', 'fire', 'frost'].includes(playerOutfit);
    player.equippedSet = playerOutfit;
    player.equipped = equipped || { outfit: playerOutfit, weapon: playerOutfit };
    player.damagePerHit = hasElemental ? 2 : 1;
    player.hasElemental = hasElemental;
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
          const newHostPlayer = room.players.get(newHostId);
          if (newHostPlayer) {
            room.host = {
              socketId: newHostId,
              username: newHostPlayer.name,
              outfit: newHostPlayer.equippedSet || 'default',
              isReady: Boolean(newHostPlayer.ready),
              color: newHostPlayer.color,
              userId: newHostPlayer.userId || null
            };
          }
          room.guest = null;
        } else if (room.guest && room.guest.socketId === socketId) {
          room.guest = null;
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

  setMode(code, mode, socketId) {
    const room = this.rooms.get(code);
    if (room && room.phase === 'LOBBY') {
      if (socketId && room.hostId !== socketId) {
        throw new Error('Cài đặt do Chủ phòng quyết định! Bạn không có quyền thay đổi chế độ.');
      }
      room.mode = (mode === 'pvp_1v1' || mode === 'pvp') ? 'pvp_1v1' : 'team_vs_boss';
    }
  }

  setStage(code, stage, socketId) {
    const room = this.rooms.get(code);
    if (room && room.phase === 'LOBBY') {
      if (socketId && room.hostId !== socketId) {
        throw new Error('Cài đặt do Chủ phòng quyết định! Bạn không có quyền thay đổi màn chơi.');
      }
      const clean = ['thunder', 'fire', 'frost'].includes(stage) ? stage : 'thunder';
      room.stage = clean;
      room.element = clean;
      room.bossElement = clean;
      room.bossIndex = ['thunder', 'fire', 'frost'].indexOf(clean);
    }
  }

  setDifficulty(code, difficulty, socketId) {
    const room = this.rooms.get(code);
    if (room && room.phase === 'LOBBY') {
      if (socketId && room.hostId !== socketId) {
        throw new Error('Cài đặt do Chủ phòng quyết định! Bạn không có quyền thay đổi độ khó.');
      }
      const map = { 'easy': 'easy', '20': 'easy', 'medium': 'medium', '30': 'medium', 'hard': 'hard', '50': 'hard' };
      const diff = map[String(difficulty).toLowerCase()] || 'hard';
      room.difficulty = diff;
      const countMap = { easy: 20, medium: 30, hard: 50 };
      room.totalHp = countMap[diff] || 50;
      room.bossHp = room.totalHp;
      return diff;
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
    const total = room.questions.length > 0 ? room.questions.length : 50;
    room.bossHpMultiplier = 1;
    room.totalHp = total;

    // Boss HP: every correct answer removes 1. In Team vs Boss with two players
    // BOTH attack on every question, so the boss has 2 HP per question
    // (it reaches 0 only if both players answer everything correctly).
    const isTeam = !(room.mode === 'pvp_1v1' || room.mode === 'pvp');
    room.bossMaxHp = (isTeam && room.players.size >= 2) ? total * 2 : total;
    room.bossHp    = room.bossMaxHp;

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
    const players = Array.from(room.players.values());

    if (!isPvP) {
      // ═════════════════════════════════════════════════════════════════════════
      // MODE A: Team vs Boss (2 Players vs 1 Elemental Boss)
      // ═════════════════════════════════════════════════════════════════════════
      if (players.length >= 2) {
        const p1 = players[0];
        const p2 = players[1];

        // Determine "Người nhanh" (faster) vs "Người chậm" (slower)
        let faster = p1;
        let slower = p2;

        if (p1.answerTime && p2.answerTime) {
          if (p2.answerTime < p1.answerTime) {
            faster = p2;
            slower = p1;
          }
        } else if (!p1.answerTime && p2.answerTime) {
          faster = p2;
          slower = p1;
        }

        const fasterCorrect = isCorrect(faster.answer);
        const slowerCorrect = isCorrect(slower.answer);

        const fasterHasElem = checkHasElemental(faster);
        const slowerHasElem = checkHasElemental(slower);

        const fasterOutfit = (faster.equipped?.outfit || faster.equippedSet || 'default').toLowerCase();
        const slowerOutfit = (slower.equipped?.outfit || slower.equippedSet || 'default').toLowerCase();

        const bossEl = room.bossElement || room.stage || 'thunder';
        const outfitOf = (p) => (p.equipped?.outfit || p.equippedSet || 'default').toLowerCase();
        const order = [faster, slower];   // the faster player always acts first
        const correctOf = new Map([[faster.id, fasterCorrect], [slower.id, slowerCorrect]]);

        // Mỗi người một lượt, người nhanh trước — giống hệt chơi đơn:
        //   Đúng -> người đó chém Boss, Boss mất đúng 1 HP ẩn, Boss KHÔNG phản đòn.
        //   Sai / hết giờ -> Boss tấn công người đó (-1 đồ bộ, -2 đồ thường).
        for (const p of order) {
          const hasElem = checkHasElemental(p);
          if (correctOf.get(p.id)) {
            room.bossHp = Math.max(0, room.bossHp - 1);
            p.correctAnswerCount = (p.correctAnswerCount || 0) + 1;
            combatEvents.push({
              type: 'attack',
              isCorrect: true,
              attackerId: p.id,
              victimId: 'boss',
              damage: 1,
              hasElemental: hasElem,
              outfit: outfitOf(p),
              element: hasElem ? outfitOf(p) : null,
              bossElement: bossEl,
              questionIndex: room.currentIndex,
              totalQuestions: room.totalHp,
              bossMaxHp: room.bossMaxHp,
              currentBossHp: room.bossHp,
              remainingPlayerHp: p.hp,
            });
          } else {
            const damageTaken = hasElem ? 1 : 2;
            p.hp = Math.max(0, p.hp - damageTaken);
            combatEvents.push({
              type: 'attack',
              isCorrect: false,
              attackerId: 'boss',
              victimId: p.id,
              targetId: p.id,
              damage: damageTaken,
              playerDamage: damageTaken,
              hasElemental: hasElem,
              outfit: outfitOf(p),
              element: bossEl,
              bossElement: bossEl,
              questionIndex: room.currentIndex,
              remainingPlayerHp: p.hp,
              currentBossHp: room.bossHp,
              totalQuestions: room.totalHp,
              bossMaxHp: room.bossMaxHp,
            });
          }
        }
      } else {
        // Fallback for single player
        const p = players[0];
        if (p) {
          const hasElemental = checkHasElemental(p);
          const outfit = (p.equipped?.outfit || p.equippedSet || 'default').toLowerCase();
          if (isCorrect(p.answer)) {
            const damageDealt = 1; // outfit does not change boss damage (the 2nd hit is visual only)
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
            const damageTaken = hasElemental ? 1 : 2;
            p.hp = Math.max(0, p.hp - damageTaken);
            combatEvents.push({
              type: 'attack',
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
      }
    } else {
      // ═════════════════════════════════════════════════════════════════════════
      // MODE B: 1 vs 1 PvP (Duels on Elemental Arena)
      // ═════════════════════════════════════════════════════════════════════════
      if (players.length >= 2) {
        const p1 = players[0];
        const p2 = players[1];

        // Determine "Người nhanh" (faster) vs "Người chậm" (slower)
        let faster = p1;
        let slower = p2;

        if (p1.answerTime && p2.answerTime) {
          if (p2.answerTime < p1.answerTime) {
            faster = p2;
            slower = p1;
          }
        } else if (!p1.answerTime && p2.answerTime) {
          faster = p2;
          slower = p1;
        }

        const fasterCorrect = isCorrect(faster.answer);
        const slowerCorrect = isCorrect(slower.answer);

        const fasterHasElem = checkHasElemental(faster);
        const slowerHasElem = checkHasElemental(slower);

        // Defense Scaling:
        // Đồ nguyên tố: nhận -1 HP
        // Đồ mặc định: nhận -2 HP
        const fasterDamageTaken = fasterHasElem ? 1 : 2;
        const slowerDamageTaken = slowerHasElem ? 1 : 2;

        if (fasterCorrect && slowerCorrect) {
          // Cả hai cùng ĐÚNG -> Người nhanh đánh trước, người chậm né được: không ai mất máu
          faster.correctAnswerCount = (faster.correctAnswerCount || 0) + 1;
          slower.correctAnswerCount = (slower.correctAnswerCount || 0) + 1;
          combatEvents.push({
            type: 'dodge',
            targetId: slower.id,
            attackerId: faster.id,
          });
        } else if (fasterCorrect) {
          // Người nhanh ĐÚNG, người chậm SAI -> Người chậm trúng đòn (-HP theo bộ đồ người chậm)
          slower.hp = Math.max(0, slower.hp - slowerDamageTaken);
          faster.correctAnswerCount = (faster.correctAnswerCount || 0) + 1;

          combatEvents.push({
            type: 'attack',
            attackerId: faster.id,
            victimId: slower.id,
            damage: slowerDamageTaken,
            hasElemental: slowerHasElem,
            attackerOutfit: faster.equipped?.outfit || 'default',
            victimRemainingHp: slower.hp,
          });
        } else {
          // Trường hợp 2: Người nhanh trả lời SAI -> Người chậm né được
          combatEvents.push({
            type: 'dodge',
            targetId: slower.id,
            attackerId: faster.id,
          });

          // Có 2 trường hợp tiếp theo:
          if (!slowerCorrect) {
            // Trường hợp 2a: Người chậm trả lời SAI -> Người nhanh né được, CẢ 2 ĐỀU KHÔNG MẤT MÁU!
            combatEvents.push({
              type: 'dodge',
              targetId: faster.id,
              attackerId: slower.id,
            });
          } else {
            // Trường hợp 2b: Người chậm trả lời ĐÚNG -> Người nhanh trúng đòn (-HP theo bộ đồ người nhanh)
            faster.hp = Math.max(0, faster.hp - fasterDamageTaken);
            slower.correctAnswerCount = (slower.correctAnswerCount || 0) + 1;

            combatEvents.push({
              type: 'attack',
              attackerId: slower.id,
              victimId: faster.id,
              damage: fasterDamageTaken,
              hasElemental: fasterHasElem,
              attackerOutfit: slower.equipped?.outfit || 'default',
              victimRemainingHp: faster.hp,
            });
          }
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
      bossMaxHp: room.bossMaxHp || room.totalHp,
      questionIndex: room.currentIndex,
      totalQuestions: room.totalHp,
    };
  }

  /**
   * MVP Determination for Team vs Boss:
   * Total Score = Correct Answers + Remaining HP
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
      const score = correct + remainingHp;
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
    if (room.bossHp <= Math.floor((room.bossMaxHp || room.totalHp) * 0.5)) return 'VICTORY';
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
