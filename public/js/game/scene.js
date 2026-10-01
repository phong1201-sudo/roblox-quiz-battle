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

// ── Fighter positions — face-to-face stance ───────────────────────────────────
//   Player on left (x = -3), Boss on right (x = +3)
//   Camera sits slightly off-centre on the Z axis to show a nice 3/4 view
const PLAYER_HOME = new THREE.Vector3(-4.5, 0.0, 0);
const BOSS_HOME   = new THREE.Vector3( 4.8, 0.0, 0);

// ── Arena Center & Camera Focus Target ────────────────────────────────────────
export const ARENA_CENTER = new THREE.Vector3(0, 1.8, 0);

// ── Camera — balanced framing for both combatants head-to-feet on platform ────
const CAM_POS    = new THREE.Vector3(0, 3.8, 11.5);
const CAM_TARGET = ARENA_CENTER.clone();

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

export async function startGame(gameState) {
  window.gameScene = scene;
  currentGameState = gameState;
  gameMode = gameState.mode || 'pve';
  totalHp  = gameState.totalHp || 10;
  battleReady = false;
  isMatchInitiated = false;

  // Show Pre-battle Loading Gate Overlay
  const loadingOverlay = document.getElementById('battle-loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'flex';
    loadingOverlay.style.opacity = '1';
  }

  const activeElement = gameState.bossElement || gameState.element || 'thunder';
  Arena.setArenaTheme(activeElement);

  // Decouple Player Outfit from Boss Element: Strictly preserve player's independently selected outfit
  const playerOutfit = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('selectedOutfit'))
    || (typeof localStorage !== 'undefined' && localStorage.getItem('selectedOutfit'))
    || gameState.equipped?.outfit
    || gameState.equippedSet
    || 'default';
  if (playerOutfit) {
    Player.applyElementalSet(playerOutfit);
  }

  // Pre-battle Asset Loading Gate: Block Question 1 until Player and Boss are 100% loaded & mounted
  const bossTarget = gameState.bossElement || gameState.element || ((gameState.bossIndex !== undefined) ? gameState.bossIndex : 0);

  const loadTasks = [
    Player.loadPlayerOutfitPoses(scene, playerOutfit)
  ];
  if (gameMode === 'pve') {
    loadTasks.push(Boss.loadBossPoses(scene, bossTarget));
    bossActive = true;
  }

  try {
    await Promise.all(loadTasks);
    console.log('[scene] Pre-battle gate: All 3D fighter assets mounted successfully!');
  } catch (err) {
    console.error('[scene] Pre-battle gate loading error:', err);
  }

  // Position player
  const playerObj = Player.getPlayerObject();
  if (playerObj) {
    playerObj.position.copy(PLAYER_HOME);
    if (!scene.children.includes(playerObj)) scene.add(playerObj);
  }

  // Position boss & setup boss HUD
  if (gameMode === 'pve') {
    const bossObj = Boss.getBossObject?.();
    if (bossObj) {
      bossObj.position.copy(BOSS_HOME);
      if (!scene.children.includes(bossObj)) scene.add(bossObj);
    }

    const bossData = Boss.getCurrentBossData?.() || { name: 'Boss', stage: 1, element: bossTarget };
    const bossInfoEl = document.getElementById('boss-info');
    if (bossInfoEl) {
      const elemEmoji = { thunder:'⚡', fire:'🔥', frost:'❄️' }[bossData.element || activeElement] || '👾';
      bossInfoEl.innerHTML =
        `<span class="boss-stage">${elemEmoji} Stage ${bossData.stage || 1}</span>` +
        `<span class="boss-name">${bossData.name}</span>`;
      bossInfoEl.style.display = 'flex';
    }
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
    const track = (activeElement === 'thunder' || activeElement === 'fire' || activeElement === 'frost') ? activeElement : 'thunder';
    Audio.playBGM(track);
  } catch (e) {}

  // Consolidate game initiation into a single entry point: Strictly display Question 1 first!
  if (!isMatchInitiated && queuedQuestion) {
    isMatchInitiated = true;
    if (window.gameState) window.gameState.currentQuestionIndex = 0;
    displayQuestion(0);
  }

  // Elemental set unlock hook
  window.__onThunderSetUnlocked = () => {
    const bossEl  = Boss.getBossElement();
    const setName = bossEl || 'thunder';
    Player.applyElementalSet(setName);
    if (window.gameState) {
      window.gameState.thunderSet   = setName === 'thunder';
      window.gameState.equippedSet  = setName;
      window.gameState.damagePerHit = 2;
      window.gameState.bossMaxHp    = (window.gameState.totalHp || totalHp) * 2;
    }
    const lightCols = { thunder:0x00ffff, fire:0xff4400, frost:0x88ccff };
    const flair = new THREE.PointLight(lightCols[setName] || 0xffffff, 2.5, 16);
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
  // Shot 3: Over-the-Shoulder Boss Cam (looking down at incoming player leap)
  { start: { x: 6.5, y: 4.2, z: 3.0 }, end: { x: 5.5, y: 3.6, z: 2.0 }, duration: 2200 },
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

  activeCamTween = new TWEEN.Tween(posObj)
    .to({ x: CAM_POS.x, y: CAM_POS.y, z: CAM_POS.z }, duration)
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



