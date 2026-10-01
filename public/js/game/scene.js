import * as Arena         from './arena.js';
import * as Player        from './player.js';
import * as PlayerManager from './playerManager.js';
import * as AnswerPads    from './answerPads.js';
import * as Effects       from './effects.js';
import * as Boss          from './boss.js';
import { socket }         from '../socket.js';
import * as hud           from '../ui/hud.js';
import * as Audio         from '../audio.js';
import * as Combat        from './combat.js';

let scene, camera, renderer;
let clock    = new THREE.Clock();
let socketMoveInterval = null;

let gameMode   = 'pve';
let totalHp    = 10;
let bossActive = false;
let currentGameState = null;

let combatBusy    = false;
let pendingEvents = [];

// ── Fighter instances & positions ─────────────────────────────────────────────
let player1Instance = null;
let player2Instance = null;

const PLAYER_HOME = new THREE.Vector3(-4.5, 0.0, 0);
const BOSS_HOME   = new THREE.Vector3( 4.8, 0.0, 0);

// ── Arena Center & Camera Focus Target ────────────────────────────────────────
export const ARENA_CENTER = new THREE.Vector3(0, 1.8, 0);

// ── Camera Positions for Modes ───────────────────────────────────────────────
const CAM_POS_SINGLE = new THREE.Vector3(0, 3.8, 11.5);
const CAM_POS_TEAM   = new THREE.Vector3(0, 4.5, 14.5);
const CAM_POS_PVP    = new THREE.Vector3(0, 3.8, 12.0);
const CAM_POS        = CAM_POS_SINGLE.clone();

export function getDefaultCamPos() {
  const isTeam = (gameMode === 'team_vs_boss' || (gameMode === 'pve' && player2Instance));
  const isPvP  = (gameMode === 'pvp_1v1' || gameMode === 'pvp');
  if (isTeam) return CAM_POS_TEAM.clone();
  if (isPvP)  return CAM_POS_PVP.clone();
  return CAM_POS_SINGLE.clone();
}

export function getFighterInstance(playerId) {
  if (player2Instance && player2Instance.id === playerId) return player2Instance;
  if (player1Instance && (player1Instance.id === playerId || !playerId)) return player1Instance;
  return player1Instance;
}

export function getFighters() {
  return { p1: player1Instance, p2: player2Instance };
}

// ── Scene Lights Reference ───────────────────────────────────────────────────
let sceneLights = null;

// ── Boss hit position for VFX ─────────────────────────────────────────────────
const BOSS_VFX_POS = new THREE.Vector3(4.8, 4.0, 0);

// ─────────────────────────────────────────────────────────────────────────────
// INIT SCENE
// ─────────────────────────────────────────────────────────────────────────────
function getViewportDimensions() {
  const vp = document.getElementById('arena-viewport') || document.body;
  const W  = Math.max(320, vp.clientWidth  || window.innerWidth  || 800);
  const H  = Math.max(240, vp.clientHeight || Math.floor((window.innerHeight || 600) * 0.75));
  return { W, H };
}

export function initScene(canvas) {
  const { W, H } = getViewportDimensions();

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  window.gameScene = scene;
  scene.background = new THREE.Color(0x0d0528);
  scene.fog = new THREE.FogExp2(0x0d0528, 0.022);

  camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 500);
  camera.position.set(CAM_POS.x, CAM_POS.y, CAM_POS.z);
  camera.lookAt(ARENA_CENTER);

  // ── Lighting ──
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff4cc, 1.0);
  keyLight.position.set(0, 15, 8); keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024; keyLight.shadow.mapSize.height = 1024;
  scene.add(keyLight);

  // Fill light from camera side to illuminate both fighters' faces
  const fillLight = new THREE.DirectionalLight(0x88aaff, 0.5);
  fillLight.position.set(0, 5, 8);
  scene.add(fillLight);

  // Rim light from behind for silhouette pop
  const rimLight = new THREE.DirectionalLight(0x4466ff, 0.35);
  rimLight.position.set(0, 6, -8);
  scene.add(rimLight);

  sceneLights = { ambient, keyLight, fillLight, rimLight };

  try {
    Arena.initArena(scene, sceneLights);
  } catch (err) {
    console.warn('[scene] initArena warning:', err);
  }
  try {
    Effects.initEffects(scene, camera);
  } catch (err) {
    console.warn('[scene] initEffects warning:', err);
  }

  window.addEventListener('resize', onWindowResize, false);
  animate();
}

// ─────────────────────────────────────────────────────────────────────────────
// START GAME
// ─────────────────────────────────────────────────────────────────────────────
let battleReady = false;
let isMatchInitiated = false;
let queuedQuestion = null;

export function isBattleReady() {
  return battleReady;
}

export function queueFirstQuestion(data) {
  queuedQuestion = data;
}

export function displayQuestion(idx = 0) {
  if (queuedQuestion) {
    const qData = queuedQuestion;
    queuedQuestion = null;
    if (window.gameState) {
      window.gameState.currentQuestionIndex = (qData.index !== undefined ? qData.index - 1 : idx);
    }
    if (hud.showQuestion) hud.showQuestion(qData);
    internalOnQuestion(qData);
  }
}

// Normalize outfit key strictly to: 'default' | 'thunder' | 'fire' | 'frost'
export function getActivePlayerOutfit() {
  const raw = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('selectedOutfit'))
    || (typeof localStorage !== 'undefined' && localStorage.getItem('selectedOutfit'))
    || 'default';
  const clean = raw.toLowerCase().trim();
  if (['default', 'thunder', 'fire', 'frost'].includes(clean)) {
    return clean;
  }
  return 'default';
}

export async function startGame(gameState) {
  window.gameScene = scene;
  currentGameState = gameState;
  gameMode = gameState.mode || 'team_vs_boss';
  totalHp  = gameState.totalHp || 50;
  battleReady = false;
  isMatchInitiated = false;

  const isPvP  = (gameMode === 'pvp_1v1' || gameMode === 'pvp');
  const isTeam = (gameMode === 'team_vs_boss' || gameMode === 'pve');

  // Show Pre-battle Loading Gate Overlay
  const loadingOverlay = document.getElementById('battle-loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.opacity = '1';
  }

  // 1. Players & Outfits setup
  const players = gameState.players || [];
  const myId    = socket.id || window.myId || gameState.myId;
  const p1Data  = players[0] || { name: gameState.myName, id: myId };
  const p2Data  = players[1] || null;

  const myOutfit = getActivePlayerOutfit();
  const p1Outfit = (p1Data.id === myId)
    ? myOutfit
    : (p1Data.equipped?.outfit || p1Data.equippedSet || 'default');
  const p2Outfit = (p2Data && p2Data.id === myId)
    ? myOutfit
    : (p2Data?.equipped?.outfit || p2Data?.equippedSet || 'default');

  // 2. Fighter Positions & Facing
  let p1Home, p2Home, p1Facing, p2Facing;
  if (isPvP) {
    // Mode B: 1 vs 1 PvP (Duels on Elemental Arena)
    // Player 1 at (-4.5, 0, 0) facing right (Math.PI / 2)
    // Player 2 at (4.5, 0, 0) facing left (-Math.PI / 2)
    p1Home   = { x: -4.5, y: 0, z: 0 };
    p1Facing = Math.PI / 2;
    p2Home   = { x: 4.5, y: 0, z: 0 };
    p2Facing = -Math.PI / 2;
  } else if (isTeam && p2Data) {
    // Mode A: Team vs Boss (2 Players vs 1 Elemental Boss)
    // Player 1 (Host) at (-4.5, 0, 1.6)
    // Player 2 (Guest) at (-4.5, 0, -1.6)
    p1Home   = { x: -4.5, y: 0, z: 1.6 };
    p1Facing = Math.PI / 2;
    p2Home   = { x: -4.5, y: 0, z: -1.6 };
    p2Facing = Math.PI / 2;
  } else {
    // Single Player vs Boss
    p1Home   = { x: -4.5, y: 0, z: 0 };
    p1Facing = Math.PI / 2;
    p2Home   = null;
    p2Facing = null;
  }

  // 3. Boss element determination
  const stageBossSelection = gameState.bossElement || gameState.stage || gameState.element || ((gameState.bossIndex !== undefined) ? gameState.bossIndex : 0);
  const activeBossType = (typeof stageBossSelection === 'string')
    ? stageBossSelection
    : (['thunder', 'fire', 'frost'][stageBossSelection] || 'thunder');

  console.log(`[BATTLE INIT] Mode: "${gameMode}" | P1: "${p1Outfit}" | P2: "${p2Outfit}" | Stage: "${activeBossType}"`);

  Arena.setArenaTheme(activeBossType);

  // Position Camera according to mode
  const defaultCam = getDefaultCamPos();
  camera.position.copy(defaultCam);
  camera.lookAt(ARENA_CENTER);

  // Clear old fighter instances
  if (player1Instance?.group) scene.remove(player1Instance.group);
  if (player2Instance?.group) scene.remove(player2Instance.group);
  player1Instance = null;
  player2Instance = null;

  const loadTasks = [];

  // Load Player 1
  loadTasks.push(
    Player.createPlayerInstance(scene, p1Outfit, p1Home, p1Facing).then(inst => {
      player1Instance = inst;
      player1Instance.id = p1Data.id;
      player1Instance.name = p1Data.name;
      return inst;
    })
  );

  // Load Player 2 (if present)
  if (p2Data && p2Home) {
    loadTasks.push(
      Player.createPlayerInstance(scene, p2Outfit, p2Home, p2Facing).then(inst => {
        player2Instance = inst;
        player2Instance.id = p2Data.id;
        player2Instance.name = p2Data.name;
        return inst;
      })
    );
  }

  // Load Boss (strictly if not PvP)
  if (!isPvP) {
    loadTasks.push(Boss.loadBossPoses(scene, activeBossType));
    bossActive = true;
  } else {
    bossActive = false;
    const oldBoss = Boss.getBossObject?.();
    if (oldBoss && scene.children.includes(oldBoss)) scene.remove(oldBoss);
  }

  try {
    await Promise.all(loadTasks);
    console.log('[scene] Pre-battle gate: All 3D fighter assets mounted successfully!');
  } catch (err) {
    console.error('[scene] Pre-battle gate loading error:', err);
  }

  // Position boss & setup boss HUD
  if (!isPvP) {
    const bossObj = Boss.getBossObject?.();
    if (bossObj) {
      // Boss positioned at (5.0, 0, 0) and scaled 2.0x in Team vs Boss
      const bossPos = (isTeam && p2Data) ? new THREE.Vector3(5.0, 0, 0) : BOSS_HOME;
      bossObj.position.copy(bossPos);
      if (isTeam && p2Data) {
        bossObj.scale.set(2.0, 2.0, 2.0);
      } else {
        bossObj.scale.set(1.0, 1.0, 1.0);
      }
      if (!scene.children.includes(bossObj)) scene.add(bossObj);
    }

    const bossData = Boss.getCurrentBossData?.() || { name: 'Boss', stage: 1, element: activeBossType };
    const bossInfoEl = document.getElementById('boss-info');
    if (bossInfoEl) {
      const elemEmoji = { thunder:'⚡', fire:'🔥', frost:'❄️' }[bossData.element || activeBossType] || '👾';
      bossInfoEl.innerHTML =
        `<span class="boss-stage">${elemEmoji} Stage ${bossData.stage || 1}</span>` +
        `<span class="boss-name">${bossData.name}</span>`;
      bossInfoEl.style.display = 'flex';
    }
  } else {
    const bossInfoEl = document.getElementById('boss-info');
    if (bossInfoEl) bossInfoEl.style.display = 'none';
  }

  // Fade out loading overlay
  battleReady = true;
  if (loadingOverlay) {
    loadingOverlay.style.opacity = '0';
    setTimeout(() => {
      loadingOverlay.style.display = 'none';
    }, 500);
  }

  // Start combat BGM once models are mounted in memory
  try {
    const combatBgmUrl = Audio.getActiveCombatBGMUrl(activeBossType);
    Audio.switchCombatBGM(combatBgmUrl);
  } catch (e) {}

  // Consolidate game initiation into a single entry point: Strictly display Question 1 first!
  if (!isMatchInitiated && queuedQuestion) {
    isMatchInitiated = true;
    if (window.gameState) window.gameState.currentQuestionIndex = 0;
    displayQuestion(0);
  }

  // Elemental set unlock hook - preserves chosen player outfit!
  window.__onThunderSetUnlocked = () => {
    if (window.gameState) {
      window.gameState.damagePerHit = 2;
      window.gameState.bossMaxHp    = (window.gameState.totalHp || totalHp) * 2;
    }
    const lightCols = { thunder:0x00ffff, fire:0xff4400, frost:0x88ccff };
    const flair = new THREE.PointLight(lightCols[activeBossType] || 0xffffff, 2.5, 16);
    flair.position.copy(PLAYER_HOME); flair.position.y = 3;
    scene.add(flair);
    setTimeout(() => scene.remove(flair), 4000);
    try {
      const saved = JSON.parse(localStorage.getItem('unlockedSets') || '[]');
      if (!saved.includes(setName)) { saved.push(setName); localStorage.setItem('unlockedSets', JSON.stringify(saved)); }
    } catch(e) {}
  };

  socketMoveInterval = setInterval(() => {
    const pos = Player.getPosition();
    socket.emit('player_move', { code: gameState.code, position:{x:pos.x,y:pos.y,z:pos.z}, rotation:{y:0} });
  }, 200);

  setTimeout(() => onWindowResize(), 60);
}

export function onQuestion(data) {
  queuedQuestion = data;
  if (!battleReady) {
    console.log('[scene] Pre-battle gate active: Queuing Question 1 until models are ready');
    return;
  }
  if (!isMatchInitiated) {
    isMatchInitiated = true;
    if (window.gameState) window.gameState.currentQuestionIndex = 0;
    displayQuestion(0); // Strictly display Question 1 first!
    return;
  }
  if (hud.showQuestion) hud.showQuestion(data);
  internalOnQuestion(data);
}

function internalOnQuestion(data) {
  // Flush any stale combat events from the previous question cycle
  pendingEvents.length = 0;
  combatBusy = false;
  if (window.gameState) {
    window.gameState.currentQuestionIndex = (data.index !== undefined ? data.index - 1 : 0);
    window.gameState.totalQuestions = data.total || window.gameState.totalHp;
  }
}
export function onAnswerResult(data) {
  if (hud.updateHpBars && data.hp) hud.updateHpBars(data.hp, null);
}
export function onPlayerMoved(data) {}


// ─────────────────────────────────────────────────────────────────────────────
// COMBAT ORCHESTRATION
// ─────────────────────────────────────────────────────────────────────────────
export function onCombatEvent({ events }) {
  pendingEvents.push(...events);
  if (!combatBusy) processNextEvent();
}

function processNextEvent() {
  if (pendingEvents.length === 0) { combatBusy = false; return; }
  combatBusy = true;
  const ev = pendingEvents.shift();
  if (ev && ev.questionNumber === undefined) {
    ev.questionNumber = window.gameState?.currentQuestionIndex !== undefined ? window.gameState.currentQuestionIndex + 1 : 1;
  }
  Combat.executeCombatTurn(ev, () => {
    combatBusy = false;
    processNextEvent();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// HP UPDATE
// ─────────────────────────────────────────────────────────────────────────────
export function onHpUpdate({ hp, bossHp }) {
  if (hud.updateHpBars && hp) {
    hud.updateHpBars(hp, null);
  }
}

export function onSkinUploaded({ playerId, skinUrl, target }) {
  if (target === 'boss') Boss.applyBossSkin(skinUrl);
}

// ─────────────────────────────────────────────────────────────────────────────
// RESIZE
// ─────────────────────────────────────────────────────────────────────────────
export function onWindowResize() {
  if (!camera || !renderer) return;
  const { W, H } = getViewportDimensions();
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOW-MOTION & TIME SCALING
// ─────────────────────────────────────────────────────────────────────────────
let combatTimeScale = 1.0;
let slowMoTimer = null;

export function triggerCombatSlowMo(scale = 0.18, durationMs = 800) {
  combatTimeScale = scale;
  if (slowMoTimer) clearTimeout(slowMoTimer);
  slowMoTimer = setTimeout(() => {
    combatTimeScale = 1.0;
    slowMoTimer = null;
  }, durationMs);
}

export function setCombatTimeScale(scale = 1.0) {
  combatTimeScale = scale;
  if (slowMoTimer) {
    clearTimeout(slowMoTimer);
    slowMoTimer = null;
  }
}

export function getCombatTimeScale() {
  return combatTimeScale;
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER LOOP
// ─────────────────────────────────────────────────────────────────────────────
function animate(time) {
  requestAnimationFrame(animate);
  if (typeof TWEEN !== 'undefined' && TWEEN.update) {
    try {
      TWEEN.update(time);
    } catch (e) {
      console.warn("TWEEN update error:", e);
    }
  }

  let dt = 0.016;
  try {
    if (clock) dt = Math.min(clock.getDelta(), 0.1) * combatTimeScale;
  } catch (e) {}

  try {
    if (Player.updatePlayer) Player.updatePlayer(dt, camera);
    if (Effects.update) Effects.update(dt);
    if (Arena.updateArena) Arena.updateArena(dt);
    if (bossActive && Boss.updateBoss) Boss.updateBoss(dt);
  } catch (err) {
    console.warn("[scene] Subsystem update error:", err);
  }

  try {
    if (camera) {
      camera.lookAt(ARENA_CENTER);
    }
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  } catch (err) {
    console.error("Render loop error:", err);
  }
}

export function resetGameMatch() {
  pendingEvents = [];
  combatBusy = false;
  isMatchInitiated = false;
  battleReady = false;
  queuedQuestion = null;
  if (socketMoveInterval) {
    clearInterval(socketMoveInterval);
    socketMoveInterval = null;
  }
  combatTimeScale = 1.0;
  if (slowMoTimer) clearTimeout(slowMoTimer);
  resetCameraToDefault(300);
  Player.resetPlayerState?.();
  Boss.resetBossState?.();
}

// ─────────────────────────────────────────────────────────────────────────────
// 5 DISTINCT CINEMATIC CAMERA SHOTS (PERFECT ARENA FOCUS & ZERO DRIFT)
// ─────────────────────────────────────────────────────────────────────────────
let activeCamTween = null;

export const CINEMATIC_SHOTS = [
  // Shot 1: Wide Orbit Sweep (210°) from Player to Boss
  { start: { x: -8.5, y: 4.2, z: 7.5 }, end: { x: 7.5, y: 3.8, z: -6.5 }, duration: 2500 },
  // Shot 2: Low-Angle Hero Cam (looking up from behind player towards boss)
  { start: { x: -6.8, y: 1.5, z: 3.2 }, end: { x: -5.8, y: 1.8, z: 2.2 }, duration: 2200 },
  // Shot 3: Over-the-Shoulder Boss Cam (looking down at incoming player leap, doubled distance for 2.0x boss)
  { start: { x: 12.0, y: 6.5, z: 5.5 }, end: { x: 10.0, y: 5.5, z: 3.5 }, duration: 2500 },
  // Shot 4: High Oblique Isometric Aerial (epic grand arena view)
  { start: { x: 0, y: 10.5, z: 10.5 }, end: { x: 2, y: 9.5, z: 9.5 }, duration: 2500 },
  // Shot 5: Side Action Tracking (gliding horizontally alongside combatants)
  { start: { x: -3.5, y: 3.2, z: 9.5 }, end: { x: 3.5, y: 3.2, z: 9.5 }, duration: 2200 }
];

let lastShotIndex = -1;

/**
 * Triggers one of 5 distinct cinematic camera shots.
 * When called with null, randomly picks one of the 5 shots (guaranteeing variety).
 * The focus target MUST ALWAYS stay locked to ARENA_CENTER (0, 1.8, 0)
 * so both Player and Boss NEVER leave the frame!
 *
 * @param {number|null} [shotNum=null] - 1 to 5 (or null for random)
 * @param {number|null} [durationOverride=null] - Custom duration in ms
 */
export function triggerCinematicShot(shotNum = null, durationOverride = null) {
  if (!camera || typeof TWEEN === 'undefined') return;

  if (activeCamTween) {
    activeCamTween.stop();
    activeCamTween = null;
  }

  let shot;
  if (shotNum !== null && shotNum >= 1 && shotNum <= CINEMATIC_SHOTS.length) {
    shot = CINEMATIC_SHOTS[shotNum - 1];
    lastShotIndex = shotNum - 1;
  } else {
    let idx = Math.floor(Math.random() * CINEMATIC_SHOTS.length);
    if (idx === lastShotIndex && CINEMATIC_SHOTS.length > 1) {
      idx = (idx + 1) % CINEMATIC_SHOTS.length;
    }
    lastShotIndex = idx;
    shot = CINEMATIC_SHOTS[idx];
  }

  const duration = durationOverride || shot.duration;
  const posObj = { x: shot.start.x, y: shot.start.y, z: shot.start.z };

  camera.position.set(posObj.x, posObj.y, posObj.z);
  camera.lookAt(ARENA_CENTER);

  const easeFunc = (TWEEN.Easing?.Sinusoidal?.InOut) || (TWEEN.Easing?.Quadratic?.InOut) || (TWEEN.Easing?.Linear?.None);

  activeCamTween = new TWEEN.Tween(posObj)
    .to({ x: shot.end.x, y: shot.end.y, z: shot.end.z }, duration)
    .easing(easeFunc)
    .onUpdate(() => {
      camera.position.set(posObj.x, posObj.y, posObj.z);
      camera.lookAt(ARENA_CENTER);
    })
    .onComplete(() => {
      activeCamTween = null;
    })
    .start();
}

/**
 * Smoothly interpolates the camera back to default arena viewing angle
 * @param {number} [duration=600]
 * @param {Function} [onDone]
 */
export function resetCameraToDefault(duration = 600, onDone = null) {
  if (!camera || typeof TWEEN === 'undefined') {
    if (onDone) onDone();
    return;
  }

  if (activeCamTween) {
    activeCamTween.stop();
    activeCamTween = null;
  }

  const startPos = camera.position.clone();
  const posObj = { x: startPos.x, y: startPos.y, z: startPos.z };
  const easeFunc = (TWEEN.Easing?.Sinusoidal?.InOut) || (TWEEN.Easing?.Quadratic?.Out);

  const targetCam = getDefaultCamPos();
  activeCamTween = new TWEEN.Tween(posObj)
    .to({ x: targetCam.x, y: targetCam.y, z: targetCam.z }, duration)
    .easing(easeFunc)
    .onUpdate(() => {
      camera.position.set(posObj.x, posObj.y, posObj.z);
      camera.lookAt(ARENA_CENTER);
    })
    .onComplete(() => {
      activeCamTween = null;
      if (onDone) onDone();
    })
    .start();
}



