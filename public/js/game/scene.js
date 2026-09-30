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
const BOSS_HOME   = new THREE.Vector3( 4.5, 0.0, 0);

// ── Camera — pulled back to show full fighters head-to-feet on platform ───────
const CAM_POS    = new THREE.Vector3(0, 4.8, 11.5);
const CAM_TARGET = new THREE.Vector3(0, 1.8, 0);

// ── Boss hit position for VFX ─────────────────────────────────────────────────
const BOSS_VFX_POS = new THREE.Vector3(4.5, 4.0, 0);

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
  camera.position.set(0, 4, 12);
  camera.lookAt(0, 1.5, 0);

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

  try {
    Arena.initArena(scene);
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
export function startGame(gameState) {
  window.gameScene = scene;
  currentGameState = gameState;
  gameMode = gameState.mode || 'pve';
  totalHp  = gameState.totalHp || 10;

  const activeElement = gameState.bossElement || gameState.element || 'thunder';
  Arena.setArenaTheme(activeElement);

  // Apply player's equipped elemental set
  const playerOutfit = gameState.equipped?.outfit || gameState.equippedSet || 'default';
  if (playerOutfit && playerOutfit !== 'default') {
    Player.applyElementalSet(playerOutfit);
  }

  // Create & place player — faces +X toward boss
  Player.createPlayer(gameState.myColor || '#f59e42', playerOutfit, gameState.equipped);
  const playerObj = Player.getPlayerObject();
  if (playerObj) {
    // Ensure position matches our layout constants
    playerObj.position.copy(PLAYER_HOME);
    scene.add(playerObj);
  }

  if (gameMode === 'pve') {
    const bossTarget = gameState.bossElement || gameState.element || ((gameState.bossIndex !== undefined) ? gameState.bossIndex : 0);
    const bossData = Boss.createBoss(scene, bossTarget);
    bossActive = true;

    // Boss spawns at BOSS_HOME (boss.js handles facing angle for procedural and custom models)
    const bossObj = Boss.getBossObject?.();
    if (bossObj) {
      bossObj.position.copy(BOSS_HOME);
    }

    const bossInfoEl = document.getElementById('boss-info');
    if (bossInfoEl) {
      const elemEmoji = { thunder:'⚡', fire:'🔥', frost:'❄️' }[bossData.element] || '👾';
      bossInfoEl.innerHTML =
        `<span class="boss-stage">${elemEmoji} Stage ${bossData.stage}</span>` +
        `<span class="boss-name">${bossData.name}</span>`;
      bossInfoEl.style.display = 'flex';
    }
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
// 5-ANGLE SMOOTH CINEMATIC CAMERA SYSTEM (GROUNDED & NON-DIZZY)
// ─────────────────────────────────────────────────────────────────────────────
let activeCamTween = null;
let activeTargetTween = null;
const GROUNDED_CENTER = new THREE.Vector3(0, 1.5, 0);
let currentCamTarget = GROUNDED_CENTER.clone();
let shotCycleIndex = 0;

/**
 * Triggers one of 5 choreographed dynamic cinematic camera shots:
 * Transit duration 2.2s - 2.5s with smooth sinusoidal easing.
 * The focus point (lookAt) stays strictly grounded at arena center (0, 1.5, 0)
 * to prevent dizziness and disorientation.
 *
 * @param {number|null} shotNum - 1 to 5 (or null to cycle sequentially)
 * @param {number} [duration=2400] - Duration in ms (2.2s - 2.5s)
 * @param {boolean} [isPlayerAttack=true] - Direction flag for tracking shots
 */
export function triggerCinematicShot(shotNum = null, duration = 3000, isPlayerAttack = true) {
  if (!camera || typeof TWEEN === 'undefined') return;

  if (activeCamTween) { activeCamTween.stop(); activeCamTween = null; }
  if (activeTargetTween) { activeTargetTween.stop(); activeTargetTween = null; }

  const shot = shotNum || ((shotCycleIndex % 5) + 1);
  shotCycleIndex = (shotCycleIndex % 5) + 1;

  const easeFunc = (TWEEN.Easing?.Cubic?.InOut) || (TWEEN.Easing?.Sinusoidal?.InOut) || (TWEEN.Easing?.Quadratic?.InOut);

  // Keep target grounded at arena center
  currentCamTarget.copy(GROUNDED_CENTER);

  if (shot === 1) {
    // Shot 1: Gentle Sweeping Arc (~60° sweep) around arena center at height 4.2
    const radius = 11.0;
    const startAngle = isPlayerAttack ? -0.45 : 0.45;
    const endAngle = isPlayerAttack ? 0.45 : -0.45;
    const orbitObj = { angle: startAngle };

    camera.position.set(Math.sin(startAngle) * radius, 4.2, Math.cos(startAngle) * radius);
    camera.lookAt(GROUNDED_CENTER);

    activeCamTween = new TWEEN.Tween(orbitObj)
      .to({ angle: endAngle }, duration)
      .easing(easeFunc)
      .onUpdate(() => {
        const a = orbitObj.angle;
        camera.position.set(Math.sin(a) * radius, 4.2, Math.cos(a) * radius);
        camera.lookAt(GROUNDED_CENTER);
      })
      .start();

  } else if (shot === 2) {
    // Shot 2: Hero Low-Angle locked near floor behind player looking toward arena center (smooth 3s dolly)
    const startPos = camera.position.clone();
    const targetPos = new THREE.Vector3(-5.5, 1.6, 2.2);
    const endPos = new THREE.Vector3(-5.0, 1.8, 2.0);

    const posObj = { x: startPos.x, y: startPos.y, z: startPos.z };

    activeCamTween = new TWEEN.Tween(posObj)
      .to({ x: endPos.x, y: endPos.y, z: endPos.z }, duration)
      .easing(easeFunc)
      .onUpdate(() => {
        camera.position.set(posObj.x, posObj.y, posObj.z);
        camera.lookAt(GROUNDED_CENTER);
      })
      .start();

  } else if (shot === 3) {
    // Shot 3: Over-the-Shoulder Boss View peering toward arena center (smooth 3s dolly)
    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(3.8, 3.4, 2.0);

    const posObj = { x: startPos.x, y: startPos.y, z: startPos.z };

    activeCamTween = new TWEEN.Tween(posObj)
      .to({ x: endPos.x, y: endPos.y, z: endPos.z }, duration)
      .easing(easeFunc)
      .onUpdate(() => {
        camera.position.set(posObj.x, posObj.y, posObj.z);
        camera.lookAt(GROUNDED_CENTER);
      })
      .start();

  } else if (shot === 4) {
    // Shot 4: High Aerial Dolly looking gently down at arena center (smooth 3s crane)
    const startPos = camera.position.clone();
    const endPos = new THREE.Vector3(0.0, 7.8, 8.0);

    const posObj = { x: startPos.x, y: startPos.y, z: startPos.z };

    activeCamTween = new TWEEN.Tween(posObj)
      .to({ x: endPos.x, y: endPos.y, z: endPos.z }, duration)
      .easing(easeFunc)
      .onUpdate(() => {
        camera.position.set(posObj.x, posObj.y, posObj.z);
        camera.lookAt(GROUNDED_CENTER);
      })
      .start();

  } else if (shot === 5) {
    // Shot 5: Side-Action Tracking gliding horizontally at height 3.0
    const startX = isPlayerAttack ? -3.0 : 2.5;
    const endX   = isPlayerAttack ? 2.0 : -2.5;

    const trackObj = { x: startX };
    camera.position.set(startX, 3.0, 8.5);
    camera.lookAt(GROUNDED_CENTER);

    activeCamTween = new TWEEN.Tween(trackObj)
      .to({ x: endX }, duration)
      .easing(easeFunc)
      .onUpdate(() => {
        camera.position.set(trackObj.x, 3.0, 8.5);
        camera.lookAt(GROUNDED_CENTER);
      })
      .start();
  }
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

  if (activeCamTween) { activeCamTween.stop(); activeCamTween = null; }
  if (activeTargetTween) { activeTargetTween.stop(); activeTargetTween = null; }

  const startPos = camera.position.clone();
  const posObj = { x: startPos.x, y: startPos.y, z: startPos.z };

  const easeFunc = (TWEEN.Easing?.Sinusoidal?.InOut) || (TWEEN.Easing?.Quadratic?.Out);

  activeCamTween = new TWEEN.Tween(posObj)
    .to({ x: CAM_POS.x, y: CAM_POS.y, z: CAM_POS.z }, duration)
    .easing(easeFunc)
    .onUpdate(() => {
      camera.position.set(posObj.x, posObj.y, posObj.z);
      camera.lookAt(GROUNDED_CENTER);
    })
    .onComplete(() => {
      if (onDone) onDone();
    })
    .start();
}



