import { socket, emit, on } from './socket.js';
import * as Auth from './auth.js';
import * as Audio from './audio.js';

let roomState = {
  code: null,
  mode: 'team_vs_boss', // 'team_vs_boss' | 'pvp_1v1'
  stage: 'thunder',     // 'thunder' | 'fire' | 'frost'
  players: [],
  hostId: null,
  isHost: false,
  isHostingActive: false,
};

let countdownInterval = null;

export function getRoomState() {
  return roomState;
}

export function isTeamVsBoss() {
  return roomState.mode === 'team_vs_boss' || roomState.mode === 'pve';
}

export function isPvP() {
  return roomState.mode === 'pvp_1v1' || roomState.mode === 'pvp';
}

export function isHost() {
  return Boolean(roomState.isHost);
}

export function getLocalPlayer() {
  const myId = socket.id || window.myId;
  return roomState.players.find(p => p.id === myId) || null;
}

export function getOtherPlayer() {
  const myId = socket.id || window.myId;
  return roomState.players.find(p => p.id !== myId) || null;
}

/**
 * Host creates a room with chosen mode and stage
 */
export function createMultiplayerRoom({ mode = 'team_vs_boss', stage = 'thunder' } = {}) {
  const user = Auth.getCurrentUser();
  if (!user) {
    Auth.showAuthModal();
    return;
  }

  const color = document.getElementById('player-color')?.value || '#ff6b35';
  let equipped = { outfit: 'default', weapon: 'default' };
  try {
    const saved = JSON.parse(localStorage.getItem('player_equipped'));
    if (saved) equipped = { outfit: saved.outfit || 'default', weapon: saved.weapon || 'default' };
  } catch (e) {}

  const savedOutfit = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('selectedOutfit'))
    || (typeof localStorage !== 'undefined' && localStorage.getItem('selectedOutfit'))
    || equipped.outfit;
  equipped.outfit = savedOutfit;
  equipped.weapon = savedOutfit;

  const isFullSet = (equipped.outfit !== 'default');
  const equippedSet = isFullSet ? equipped.outfit : null;

  roomState.mode = mode;
  roomState.stage = stage;
  roomState.isHostingActive = true;

  emit('create_room', {
    playerName: user.username,
    color,
    userId: user.id,
    equippedSet,
    equipped,
    inventory: user.inventory || { thunder: [], fire: [], frost: [] },
    mode,
    stage,
  });
}

/**
 * Guest joins room with 4-character code
 */
export function joinMultiplayerRoom(code) {
  const user = Auth.getCurrentUser();
  if (!user) {
    Auth.showAuthModal();
    return;
  }

  const cleanCode = (code || '').trim().toUpperCase();
  if (cleanCode.length !== 4) {
    alert('Mã phòng phải có đúng 4 ký tự!');
    return;
  }

  // Smoothly clean up any previous room hosted by this player
  if (roomState.isHostingActive && roomState.code) {
    console.log(`[Multiplayer] Auto-dismantling previous room ${roomState.code} before joining ${cleanCode}`);
    emit('leave_room', { code: roomState.code });
  }
  cancelHosting();

  const color = document.getElementById('player-color')?.value || '#00b4d8';
  let equipped = { outfit: 'default', weapon: 'default' };
  try {
    const saved = JSON.parse(localStorage.getItem('player_equipped'));
    if (saved) equipped = { outfit: saved.outfit || 'default', weapon: saved.weapon || 'default' };
  } catch (e) {}

  const savedOutfit = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('selectedOutfit'))
    || (typeof localStorage !== 'undefined' && localStorage.getItem('selectedOutfit'))
    || equipped.outfit;
  equipped.outfit = savedOutfit;
  equipped.weapon = savedOutfit;

  const isFullSet = (equipped.outfit !== 'default');
  const equippedSet = isFullSet ? equipped.outfit : null;

  emit('join_room', {
    code: cleanCode,
    playerName: user.username,
    color,
    userId: user.id,
    equippedSet,
    equipped,
    inventory: user.inventory || { thunder: [], fire: [], frost: [] },
  });
}

/**
 * Host updates room game mode ('team_vs_boss' vs 'pvp_1v1')
 */
export function setRoomMode(mode) {
  if (!roomState.code || !roomState.isHost) return;
  roomState.mode = mode;
  emit('set_mode', { code: roomState.code, mode });
}

/**
 * Host updates room stage / elemental question bank
 */
export function setRoomStage(stage) {
  if (!roomState.code || !roomState.isHost) return;
  roomState.stage = stage;
  emit('set_stage', { code: roomState.code, stage });
}

/**
 * Host or guest leaves room cleanly
 */
export function leaveRoom(code) {
  const targetCode = code || roomState.code;
  if (targetCode) {
    emit('leave_room', { code: targetCode });
  }
  cancelHosting();
}

/**
 * Player toggles ready state in room
 */
export function setReady(ready) {
  if (!roomState.code) return;
  const myId = socket.id || window.myId;
  const localP = roomState.players.find(p => p.id === myId);
  if (localP) localP.ready = Boolean(ready);

  let equipped = { outfit: 'default', weapon: 'default' };
  try {
    const saved = JSON.parse(localStorage.getItem('player_equipped'));
    if (saved) equipped = { outfit: saved.outfit || 'default', weapon: saved.weapon || 'default' };
  } catch (e) {}

  const savedOutfit = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('selectedOutfit'))
    || (typeof localStorage !== 'undefined' && localStorage.getItem('selectedOutfit'))
    || equipped.outfit;
  equipped.outfit = savedOutfit;
  equipped.weapon = savedOutfit;

  const isFullSet = (equipped.outfit !== 'default');
  const equippedSet = isFullSet ? equipped.outfit : null;

  emit('set_ready', {
    code: roomState.code,
    ready: Boolean(ready),
    equippedSet,
    equipped,
  });
}

export function togglePlayerReady(ready) {
  setReady(ready);
}

/**
 * Host requests to start battle (validates ready states)
 */
export function requestStartGame() {
  if (!roomState.code || !roomState.isHost) return;
  emit('host_launch_battle', { roomCode: roomState.code });
}

export function launchBattle() {
  requestStartGame();
}

/**
 * Host selects room difficulty
 */
export function setRoomDifficulty(difficulty) {
  if (!roomState.code || !roomState.isHost) return;
  roomState.difficulty = difficulty;
  emit('set_difficulty', { code: roomState.code, difficulty });
}

/**
 * Player syncs equipment in lobby
 */
export function updateEquipment(equipped) {
  if (!roomState.code) return;
  const isFullSet = (equipped?.outfit && equipped.outfit !== 'default');
  const equippedSet = isFullSet ? equipped.outfit : null;
  emit('update_equipment', {
    code: roomState.code,
    equippedSet,
    equipped,
  });
}

/**
 * Cancel active countdown overlay
 */
export function cancelCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
  const overlay = document.getElementById('match-countdown-overlay');
  if (overlay) {
    overlay.style.display = 'none';
    overlay.style.opacity = '1';
  }
}

/**
 * Host cancels hosting
 */
export function cancelHosting() {
  cancelCountdown();
  roomState.isHostingActive = false;
  roomState.code = null;
  roomState.players = [];
  roomState.isHost = false;
  try {
    sessionStorage.removeItem('hostedRoomCode');
    localStorage.removeItem('hostedRoomCode');
  } catch (e) {}
  if (window.gameState) {
    window.gameState.code = null;
    window.gameState.isHost = false;
  }
}

/**
 * Display arcade countdown overlay when 2 players connect
 */
export function triggerCountdownOverlay(seconds = 3, { mode, stage, players } = {}) {
  let overlay = document.getElementById('match-countdown-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'match-countdown-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(5, 7, 18, 0.92);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      font-family: 'Press Start 2P', cursive;
      color: #fff;
      backdrop-filter: blur(8px);
      text-align: center;
    `;
    document.body.appendChild(overlay);
  }

  const modeTitle = (mode === 'pvp_1v1' || mode === 'pvp')
    ? '⚔️ ĐẤU ĐƠN 1 VS 1'
    : '👥 ĐỒNG ĐỘI VS BOSS THẦN';
  const stageName = {
    thunder: '⚡ ĐẤU TRƯỜNG LÔI QUÁI',
    fire: '🔥 ĐẤU TRƯỜNG HỎA MA VƯƠNG',
    frost: '❄️ ĐẤU TRƯỜNG BĂNG TINH',
  }[stage] || '⚡ ĐẤU TRƯỜNG LÔI QUÁI';

  let remaining = seconds;

  const renderCountdown = (num) => {
    overlay.innerHTML = `
      <div style="font-size: 14px; color: #00cfff; letter-spacing: 2px;">2/2 NGƯỜI CHƠI ĐÃ SẴN SÀNG!</div>
      <div style="font-size: 16px; color: #ffcc00; margin: 4px 0;">${modeTitle}</div>
      <div style="font-size: 11px; color: #aaa; margin-bottom: 12px;">${stageName}</div>
      <div style="font-size: 64px; color: #ea580c; text-shadow: 0 0 20px #f59e0b, 4px 4px 0 #000; animation: pulse 0.5s ease-in-out;">
        ${num > 0 ? num : 'CHIẾN!'}
      </div>
      <div style="font-size: 10px; color: #06d6a0; margin-top: 10px;">Đang đồng bộ đấu trường 3D...</div>
    `;
  };

  overlay.style.display = 'flex';
  renderCountdown(remaining);

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    remaining--;
    if (remaining >= 0) {
      renderCountdown(remaining);
      try { Audio.playBlip(); } catch(e) {}
    } else {
      clearInterval(countdownInterval);
      countdownInterval = null;
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.4s ease';
      setTimeout(() => {
        overlay.style.display = 'none';
        overlay.style.opacity = '1';
      }, 400);
    }
  }, 1000);
}

// ── Socket event bindings ───────────────────────────────────────────────────
on('room_created', (data) => {
  roomState.code = data.code;
  roomState.players = data.players || [];
  roomState.hostId = data.hostId;
  roomState.isHost = true;
  roomState.mode = data.mode || 'team_vs_boss';
  roomState.stage = data.stage || 'thunder';
  roomState.isHostingActive = true;
  try {
    sessionStorage.setItem('hostedRoomCode', data.code);
    localStorage.setItem('hostedRoomCode', data.code);
  } catch(e) {}
});

on('room_closed', ({ reason } = {}) => {
  cancelHosting();
  if (reason) alert(reason);
  const show = window.showScreen || ((s) => {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(`screen-${s}`)?.classList.add('active');
  });
  show('menu');
});

on('room_left', () => {
  cancelHosting();
  const show = window.showScreen || ((s) => {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(`screen-${s}`)?.classList.add('active');
  });
  show('menu');
});

on('room_joined', (data) => {
  roomState.code = data.code;
  roomState.players = data.players || [];
  roomState.hostId = data.hostId;
  roomState.isHost = (socket.id === data.hostId);
  roomState.mode = data.mode || 'team_vs_boss';
  roomState.stage = data.stage || 'thunder';
});

on('player_joined', (data) => {
  roomState.players = data.players || [];
});

on('mode_changed', ({ mode }) => {
  roomState.mode = mode;
});

on('stage_changed', ({ stage }) => {
  roomState.stage = stage;
});

on('match_countdown', (data) => {
  roomState.mode = data.mode;
  roomState.stage = data.stage;
  roomState.players = data.players || roomState.players;
  triggerCountdownOverlay(data.seconds || 3, data);
});

on('player_ready_changed', (data) => {
  roomState.players = data.players || roomState.players;
  if (window.gameState) {
    window.gameState.players = roomState.players;
  }
  if (typeof window.updateLobbyReadyUI === 'function') {
    window.updateLobbyReadyUI(roomState.players);
  }
});

on('room_state_update', (data) => {
  if (!data) return;
  roomState.mode = data.mode || roomState.mode;
  roomState.stage = data.stage || roomState.stage;
  roomState.players = data.players || roomState.players;
  roomState.host = data.host;
  roomState.guest = data.guest;
  if (window.gameState) {
    window.gameState.mode = roomState.mode;
    window.gameState.stage = roomState.stage;
    window.gameState.players = roomState.players;
  }
  if (typeof window.updateLobbyReadyUI === 'function') {
    window.updateLobbyReadyUI(roomState.players);
  }
});

on('start_error', ({ message } = {}) => {
  const msg = message || 'Cả hai người chơi đều phải bấm Sẵn sàng!';
  alert(`⚠️ ${msg}`);
  const toast = document.getElementById('admin-toast');
  if (toast) toast.remove();
  const t = document.createElement('div');
  t.id = 'admin-toast';
  t.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:rgba(239,35,60,0.95);border:2px solid #fff;
    color:#fff;font-family:'Press Start 2P',sans-serif;font-size:10px;
    padding:10px 20px;border-radius:6px;z-index:99999;text-align:center;
  `;
  t.textContent = `⚠️ ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
});

on('match_start', (data) => {
  console.log('[match_start] Both players ready! Match launched by server:', data);
  if (window.gameState) {
    window.gameState.mode = data.mode || window.gameState.mode;
    window.gameState.stage = data.stage || window.gameState.stage;
    window.gameState.bossElement = data.stage || window.gameState.bossElement;
  }
});

on('launch_error', ({ message } = {}) => {
  const msg = message || 'Cả hai người chơi đều phải bấm Sẵn sàng!';
  alert(`⚠️ ${msg}`);
  const toast = document.getElementById('admin-toast');
  if (toast) toast.remove();
  const t = document.createElement('div');
  t.id = 'admin-toast';
  t.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:rgba(239,35,60,0.95);border:2px solid #fff;
    color:#fff;font-family:'Press Start 2P',sans-serif;font-size:10px;
    padding:10px 20px;border-radius:6px;z-index:99999;text-align:center;
  `;
  t.textContent = `⚠️ ${msg}`;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
});

on('difficulty_changed', ({ difficulty }) => {
  roomState.difficulty = difficulty;
  if (window.gameState) window.gameState.difficulty = difficulty;
});

on('match_initialized', (data) => {
  console.log('[match_initialized] Match launched by server:', data);
  cancelCountdown();

  // 1. Set match parameters in sessionStorage
  try {
    sessionStorage.setItem('match_mode', data.mode);
    sessionStorage.setItem('match_element', data.element);
    sessionStorage.setItem('match_difficulty', data.difficulty);
    sessionStorage.setItem('selectedStage', data.element);
  } catch (e) {}

  // 2. Sync to window.gameState
  if (window.gameState) {
    window.gameState.mode = data.mode || window.gameState.mode;
    window.gameState.stage = data.element || data.stage || window.gameState.stage;
    window.gameState.bossElement = data.element || data.stage || window.gameState.bossElement;
    window.gameState.difficulty = data.difficulty || window.gameState.difficulty || 'hard';
  }

  // 3. Smooth transition to arena scene
  const show = window.showScreen || ((s) => {
    document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
    document.getElementById(`screen-${s}`)?.classList.add('active');
  });
  show('game');

  Audio.setInBattle(true);
  try {
    Audio.stopBGM();
    Audio.playBGM('battle');
  } catch (e) {}

  requestAnimationFrame(() => {
    const canvas = document.getElementById('game-canvas');
    if (canvas && window.scene?.initScene) window.scene.initScene(canvas);
    if (window.hud?.init) window.hud.init(window.gameState);
    if (window.scene?.startGame) window.scene.startGame(window.gameState);
  });
});


