// THREE is available as a global from the CDN script tag
import { initWorld }      from './world.js';
import * as Player        from './player.js';
import * as PlayerManager from './playerManager.js';
import * as AnswerPads    from './answerPads.js';
import * as Effects       from './effects.js';
import * as Boss          from './boss.js';
import { socket }         from '../socket.js';
import * as hud           from '../ui/hud.js';
import * as Audio         from '../audio.js';

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
const PLAYER_HOME = new THREE.Vector3(-3.0, 1.5, 0);
const BOSS_HOME   = new THREE.Vector3( 3.0, 0,   0);

// ── Camera — pulled back to show full fighters head-to-feet on platform ───────
const CAM_POS    = new THREE.Vector3(0, 4.8, 11.5);
const CAM_TARGET = new THREE.Vector3(0, 1.8, 0);

// ── Boss hit position for VFX ─────────────────────────────────────────────────
const BOSS_VFX_POS = new THREE.Vector3(3.0, 4.0, 0);

// ─────────────────────────────────────────────────────────────────────────────
// INIT SCENE
// ─────────────────────────────────────────────────────────────────────────────
export function initScene(canvas) {
  const vp = document.getElementById('arena-viewport') || document.body;
  const W  = vp.clientWidth  || window.innerWidth;
  const H  = vp.clientHeight || window.innerHeight * 0.75;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d0528);
  scene.fog = new THREE.FogExp2(0x0d0528, 0.022);

  camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 500);
  camera.position.copy(CAM_POS);
  camera.lookAt(CAM_TARGET);

  // ── Lighting ──
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
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

  initWorld(scene);
  Effects.initEffects(scene, camera);
  window.addEventListener('resize', onWindowResize, false);
  animate();
}

// ─────────────────────────────────────────────────────────────────────────────
// START GAME
// ─────────────────────────────────────────────────────────────────────────────
export function startGame(gameState) {
  currentGameState = gameState;
  gameMode = gameState.mode || 'pve';
  totalHp  = gameState.totalHp || 10;

  // Apply player's equipped elemental set
  const equippedSet = gameState.equippedSet || null;
  if (equippedSet) Player.applyElementalSet(equippedSet);

  // Create & place player — player.js sets rotation.y = -PI/2 (faces +X = toward boss)
  Player.createPlayer(gameState.myColor || '#f59e42', null, null);
  const playerObj = Player.getPlayerObject();
  if (playerObj) {
    // Ensure position matches our layout constants
    playerObj.position.copy(PLAYER_HOME);
    scene.add(playerObj);
  }

  if (gameMode === 'pve') {
    const bossIdx  = (gameState.bossIndex !== undefined) ? gameState.bossIndex : 0;
    const bossData = Boss.createBoss(scene, bossIdx);
    bossActive = true;

    // Boss spawns at BOSS_HOME and faces LEFT (-X) toward player
    // Boss.createBoss already calls rotation.y = Math.PI which means it faces -Z,
    // so we override here: face -X = rotation.y = Math.PI/2
    const bossObj = Boss.getBossObject?.();
    if (bossObj) {
      bossObj.position.copy(BOSS_HOME);
      bossObj.rotation.y = Math.PI / 2;   // face left toward player
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
}

export function onQuestion(data) {}
export function onAnswerResult(data) { if (hud.updateHpBars) hud.updateHpBars(data.hp, data.bossHp); }
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
  if      (ev.type === 'attack') runAttackSequence(ev);
  else if (ev.type === 'dodge')  runDodgeSequence(ev);
  else { combatBusy = false; processNextEvent(); }
}

function runAttackSequence(ev) {
  const dmg     = ev.damage || 1;
  // Element = PLAYER'S equipped set only — never the boss
  const element = Player.getActiveElement();

  Player.playAttack(
    () => {
      // ── Elemental SFX at hit impact moment ──────────────────────────────
      try {
        if      (element === 'thunder') Audio.playThunder();
        else if (element === 'fire')    Audio.playFire();
        else if (element === 'frost')   Audio.playFrost();
        else                            Audio.playSlash();
      } catch(e) {}

      // Basic hit sparks always
      Effects.spawnHitSpark(BOSS_VFX_POS);
      Boss.playBossHurt();

      // Elemental follow-up only if player has that set equipped
      if (element === 'thunder') {
        Effects.triggerLightningSlash(BOSS_VFX_POS, `⚡ -${dmg}`);
      } else if (element === 'fire') {
        Effects.triggerFireBurst(BOSS_VFX_POS, `🔥 -${dmg}`);
        Effects.triggerShake(0.4, 0.4);
      } else if (element === 'frost') {
        Effects.triggerFrostShatter(BOSS_VFX_POS, `❄️ -${dmg}`);
        Effects.triggerShake(0.35, 0.4);
      } else {
        Effects.spawnDamageNumber(BOSS_VFX_POS, `-${dmg} HP`, '#ffee44');
        Effects.triggerShake(0.18, 0.3);
      }
    },
    () => { combatBusy = false; processNextEvent(); }
  );
}

function runDodgeSequence(ev) {
  Boss.playBossDodge();
  Effects.spawnDamageNumber(new THREE.Vector3(3, 6, 0), 'DODGE!', '#ffbe0b');
  Player.playRushMiss(() => { combatBusy = false; processNextEvent(); });
}

// ─────────────────────────────────────────────────────────────────────────────
// HP UPDATE
// ─────────────────────────────────────────────────────────────────────────────
export function onHpUpdate({ hp, bossHp }) {
  if (gameMode === 'pve' && bossActive) {
    const max = window.gameState?.bossMaxHp || totalHp;
    Boss.setBossHp(bossHp, max);
    if (hud.updateHpBars) hud.updateHpBars(hp, bossHp);
  }
}

export function onSkinUploaded({ playerId, skinUrl, target }) {
  if (target === 'boss') Boss.applyBossSkin(skinUrl);
}

// ─────────────────────────────────────────────────────────────────────────────
// RESIZE
// ─────────────────────────────────────────────────────────────────────────────
function onWindowResize() {
  const vp = document.getElementById('arena-viewport') || document.body;
  const W = vp.clientWidth  || window.innerWidth;
  const H = vp.clientHeight || window.innerHeight * 0.75;
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  renderer.setSize(W, H);
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER LOOP
// ─────────────────────────────────────────────────────────────────────────────
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  Player.updatePlayer(dt, camera);
  Effects.update(dt);
  if (bossActive) Boss.updateBoss(dt);
  renderer.render(scene, camera);
}
