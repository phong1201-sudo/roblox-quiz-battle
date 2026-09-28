// THREE is available as a global from the CDN script tag
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as Effects from './effects.js';
import * as Audio from '../audio.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

// ─────────────────────────────────────────────────────────────────────────────
// Boss Roster — 3 elemental stages + 1 bonus
// ─────────────────────────────────────────────────────────────────────────────
const BOSS_ROSTER = [
  // Stage 1 — Thunder Golem: dark rocky body, cyan/yellow seam cracks, lightning rod horns
  {
    name: 'Thunder Golem',
    element: 'thunder',
    stage: 1,
    bodyColor:   0x3a3a4a,   // dark slate-grey rock
    accentColor: 0x00ffdd,   // cyan seam glow
    eyeColor:    0xffee00,   // yellow lightning iris
    crackColor:  0x00ffff,   // electric seam crack
    emissive:    0x001010,
    scaleX:1.3, scaleY:1.0, scaleZ:1.1,
  },
  // Stage 2 — Flame Demon: fiery crimson/charcoal, magma shoulders, lava horns
  {
    name: 'Inferno Demon',
    element: 'fire',
    stage: 2,
    bodyColor:   0x2a0a00,   // charcoal-black
    accentColor: 0xff5500,   // lava orange
    eyeColor:    0xffee00,   // yellow inferno
    crackColor:  0xff2200,   // magma red
    emissive:    0x220500,
    scaleX:1.0, scaleY:1.05, scaleZ:1.0,
  },
  // Stage 3 — Frost Titan: glacial light-blue, semi-transparent ice pauldrons
  {
    name: 'Frost Titan',
    element: 'frost',
    stage: 3,
    bodyColor:   0x4488aa,   // glacial blue
    accentColor: 0xbbeeFF,   // ice crystal
    eyeColor:    0xffffff,   // blizzard white
    crackColor:  0x88ccff,   // ice vein blue
    emissive:    0x000818,
    scaleX:1.1, scaleY:1.1, scaleZ:1.0,
  },
  // Stage 4 — Shadow King (unchanged)
  {
    name: 'Shadow King',
    element: null,
    stage: 4,
    bodyColor:   0x1a0030,
    accentColor: 0xdaa520,
    eyeColor:    0x9b30ff,
    crackColor:  0x9b30ff,
    emissive:    0x0a0015,
    scaleX:1.0, scaleY:1.15, scaleZ:0.9,
  },
];

// ─── Module state ─────────────────────────────────────────────────────────────
let bossGroup = null;
let bossScene = null;
let proceduralRoot = null;
let customBossModel = null;
let customBossRoot = null;
let isCustomBoss = false;
let is2DBoss = false;
let isDefeated = false;
let customBossMaterials = [];
let customBossOrigColors = [];
let customBossOrigEmissives = [];

let allBodyParts = [], originalColors = [], accentParts = [];
let idleTime = 0;
let currentBossData = BOSS_ROSTER[0];
let bossSkinPlane = null;
let elementalLightRef = null;
let bossArmLeftPivot = null;
let bossArmRightPivot = null;
let bossHammer = null;
let customBossBone = null;
let defeatCompleteCallbacks = [];

// Universal Procedural Boss Arm Pivot & Compound Limb Hierarchy
export let bossCombatArmCompound = null;
export let bossArmPivot = null;
export function getBossCombatArmCompound() {
  return bossCombatArmCompound || bossArmPivot || getBossArmPivot();
}
export function getBossArmPivot() {
  return bossCombatArmCompound || bossArmPivot || bossArmRightPivot || customBossBone;
}

// ── Visual Socket & Pivot Calibration Configuration ───────────────────────────
const DEFAULT_BOSS_SOCKETS = {
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
    boss_hammer: { hiltX: 0.0, hiltY: -0.6, hiltZ: 0.0 }
  }
};

let _bossSocketsConfig = JSON.parse(JSON.stringify(DEFAULT_BOSS_SOCKETS));

export async function loadBossSocketsConfig() {
  try {
    const res = await fetch('/api/admin/sockets');
    if (res.ok) {
      const data = await res.json();
      if (data && data.sockets) {
        _bossSocketsConfig = data.sockets;
      }
    }
  } catch (e) {
    // fallback to defaults
  }
  return _bossSocketsConfig;
}

if (typeof window !== 'undefined') {
  loadBossSocketsConfig();
  window.addEventListener('sockets-updated', (ev) => {
    if (ev.detail) {
      _bossSocketsConfig = ev.detail;
      const el = currentBossData?.element || 'fire';
      if (bossGroup) {
        _setupBossArmPivot(el);
      }
    }
  });
}

// Internal Tween engine for bulletproof hammer slam kinematics
const _bossActiveTweens = [];
class MiniTween {
  constructor(target) {
    this.target = target;
    this.toValues = {};
    this.fromValues = {};
    this.duration = 100;
    this.onCompleteCb = null;
    this.onUpdateCb = null;
    this.startTime = null;
    this._easing = null;
  }
  to(values, duration) {
    this.toValues = values;
    this.duration = duration || 100;
    return this;
  }
  easing(fn) {
    this._easing = fn;
    return this;
  }
  onUpdate(cb) {
    this.onUpdateCb = cb;
    return this;
  }
  onComplete(cb) {
    this.onCompleteCb = cb;
    return this;
  }
  start() {
    this.startTime = performance.now();
    for (const k in this.toValues) {
      if (this.target && this.target[k] !== undefined) {
        this.fromValues[k] = this.target[k];
      }
    }
    _bossActiveTweens.push(this);
    return this;
  }
  update(now) {
    const elapsed = now - this.startTime;
    const t = Math.min(1, Math.max(0, elapsed / Math.max(1, this.duration)));
    const ease = this._easing ? this._easing(t) : (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t);
    for (const k in this.toValues) {
      if (this.target && this.fromValues[k] !== undefined) {
        this.target[k] = this.fromValues[k] + (this.toValues[k] - this.fromValues[k]) * ease;
      }
    }
    if (this.onUpdateCb) this.onUpdateCb(ease);
    if (t >= 1) {
      if (this.onCompleteCb) this.onCompleteCb();
      return true;
    }
    return false;
  }
}

const TWEEN = {
  Tween: MiniTween,
  Easing: {
    Quadratic: {
      In: (t) => t * t,
      Out: (t) => t * (2 - t),
      InOut: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    }
  },
  update() {
    const now = performance.now();
    for (let i = _bossActiveTweens.length - 1; i >= 0; i--) {
      if (_bossActiveTweens[i].update(now)) {
        _bossActiveTweens.splice(i, 1);
      }
    }
  }
};

let anim = { active:false, type:null, t:0, duration:0, dodgeDir:1 };
const BOSS_HOME = { x:3.0, y:0, z:0 };   // face-to-face with player at x:-3

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeMat(color, emissive) {
  return new THREE.MeshLambertMaterial({ color, emissive: emissive||0 });
}
function box(w,h,d,mat) { return new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat); }
function trackBody(mesh) { allBodyParts.push(mesh); originalColors.push(mesh.material.color.getHex()); }
function addToBoss(mesh) {
  if (proceduralRoot) proceduralRoot.add(mesh);
  else if (bossGroup) bossGroup.add(mesh);
}

// ─── Procedural Warhammer Builder & Arm Pivot Mounting ────────────────────────
function _createBossHammerMesh(element) {
  const hammer = new THREE.Group();
  hammer.name = element === 'frost' ? 'FrostWarhammer' : 'FireWarhammer';

  if (element === 'frost') {
    const dark = makeMat(0x223344);
    const ice = makeMat(0x4488aa, 0x000818);
    const shard = makeMat(0xbbeeFF, 0x003366);
    const fHandle = box(0.25, 4.4, 0.25, dark);
    fHandle.position.set(0, 0, 0);
    hammer.add(fHandle);

    const fHead = box(1.6, 2.0, 1.6, ice);
    fHead.position.set(0, 1.8, 0);
    hammer.add(fHead);

    const fCore = box(1.66, 0.9, 1.66, shard);
    fCore.position.set(0, 1.8, 0);
    hammer.add(fCore);

    for (let j = 0; j < 4; j++) {
      const angle = (j / 4) * Math.PI * 2;
      const spk = box(0.3, 0.8, 0.3, shard);
      spk.position.set(Math.cos(angle) * 0.95, 1.8, Math.sin(angle) * 0.95);
      spk.rotation.z = Math.cos(angle) * 0.4;
      hammer.add(spk);
    }
  } else {
    // Fire warhammer
    const dark = makeMat(0x1a0a00);
    const magma = makeMat(0x2a0a00, 0x220500);
    const lava = makeMat(0xff5500, 0x331000);
    const eye = makeMat(0xffee00, 0x332200);

    const handle = box(0.24, 4.4, 0.24, dark);
    handle.position.set(0, 0, 0);
    hammer.add(handle);

    const hHead = box(1.6, 1.8, 1.6, magma);
    hHead.position.set(0, 1.8, 0);
    hammer.add(hHead);

    const coreBand = box(1.66, 0.8, 1.66, lava);
    coreBand.position.set(0, 1.8, 0);
    hammer.add(coreBand);

    for (const s of [-1, 1]) {
      const spk = box(0.4, 0.7, 0.4, eye);
      spk.position.set(s * 0.95, 1.8, 0);
      spk.rotation.z = -s * Math.PI / 2;
      hammer.add(spk);
    }
  }

  hammer.rotation.z = Math.PI / 6;
  return hammer;
}

function _setupBossArmPivot(element) {
  if (bossArmPivot && bossArmPivot.parent) {
    bossArmPivot.parent.remove(bossArmPivot);
  }
  bossArmPivot = null;
  bossCombatArmCompound = null;

  if (element !== 'fire' && element !== 'frost') return;
  if (!bossGroup) return;

  const savedPivot = _bossSocketsConfig?.boss || {};
  const sPivot = savedPivot.shoulderPivot || {};
  let shoulderX = sPivot.x ?? savedPivot.shoulderX ?? -1.8;
  let shoulderY = sPivot.y ?? savedPivot.shoulderY ?? 2.2;
  let shoulderZ = sPivot.z ?? savedPivot.shoulderZ ?? 0.2;

  // If using procedural boss (height ~6.0 vs custom GLB 4.0), scale if in normalized 4.0 units
  if (!isCustomBoss && shoulderY < 2.0) {
    shoulderX = shoulderX * 2.0;
    shoulderY = shoulderY * 2.46;
    shoulderZ = shoulderZ * 2.0;
  }

  const savedWeapon = savedPivot.weaponOffset || savedPivot.weapon || {};
  const wOffsetX = savedWeapon.offsetX ?? 0.0;
  const wOffsetY = savedWeapon.offsetY ?? -0.6;
  const wOffsetZ = savedWeapon.offsetZ ?? 0.5;
  const wAngle = savedWeapon.angle ?? 30;
  const wRotX = savedWeapon.rotX ?? 0.0;
  const wRotY = savedWeapon.rotY ?? (-Math.PI / 2);
  const wRotZ = savedWeapon.rotZ ?? ((wAngle * Math.PI) / 180);

  // Compound arm container
  bossCombatArmCompound = new THREE.Group();
  bossCombatArmCompound.name = 'BossCombatArmCompound';
  bossCombatArmCompound.position.set(shoulderX, shoulderY, shoulderZ);
  const initialIdleAngle = ((savedPivot.slashArc?.idleAngle ?? 0) * Math.PI) / 180;
  bossCombatArmCompound.rotation.set(0, 0, initialIdleAngle);
  bossArmPivot = bossCombatArmCompound;

  const hammer = _createBossHammerMesh(element);
  hammer.position.set(wOffsetX, wOffsetY, wOffsetZ);
  hammer.rotation.set(wRotX, wRotY, wRotZ);

  bossCombatArmCompound.add(hammer);
  bossGroup.add(bossCombatArmCompound);
  console.log(`[boss] Unified bossCombatArmCompound mounted for ${element} boss at (${shoulderX.toFixed(2)}, ${shoulderY.toFixed(2)}, ${shoulderZ.toFixed(2)}) with hammer offset (${wOffsetX}, ${wOffsetY}, ${wOffsetZ}) at ${wAngle}°`);
}

/**
 * Bulletproof Single-Rotation Boss Hammer Slam:
 * - Giơ búa: Rotate compound arm backward/overhead theo windupAngle trong 160ms (Quadratic.Out)
 * - Đập búa: Rotate compound arm đập mạnh xuống sàn theo slashAngle trong 130ms (Quadratic.In) -> Screen shake + lửa/băng phun trào
 * - Hồi thế: Reset về idleAngle trong 150ms (Quadratic.Out)
 */
export function playGuaranteedBossHammerSlam(element, onImpact, onComplete) {
  const pivot = bossCombatArmCompound || bossArmPivot || getBossArmPivot();
  if (!pivot) {
    if (onImpact) onImpact();
    if (onComplete) onComplete();
    return;
  }

  const arcCfg = _bossSocketsConfig?.boss?.slashArc || {};
  const idleDeg = arcCfg.idleAngle ?? 0;
  const raiseDeg = arcCfg.windupAngle ?? (idleDeg + (arcCfg.arc ? arcCfg.arc * 0.5 : 80));
  const smashDeg = arcCfg.slashAngle ?? (idleDeg - (arcCfg.arc ? arcCfg.arc * 0.5 : 80));

  const idleAngle = (idleDeg * Math.PI) / 180;
  const raiseAngle = (raiseDeg * Math.PI) / 180;  // backward/overhead
  const smashAngle = (smashDeg * Math.PI) / 180; // slam into floor

  // Phase 1 (Giơ búa overhead trong 160ms)
  new TWEEN.Tween(pivot.rotation)
    .to({ z: raiseAngle }, 160)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onComplete(() => {
      // Phase 2 (Đập búa slam xuống sàn trong 130ms) -> Screen shake + lửa/băng phun trào
      new TWEEN.Tween(pivot.rotation)
        .to({ z: smashAngle }, 130)
        .easing(TWEEN.Easing.Quadratic.In)
        .onComplete(() => {
          if (onImpact) onImpact();

          // Phase 3 (Hồi thế về idleAngle trong 150ms)
          new TWEEN.Tween(pivot.rotation)
            .to({ z: idleAngle }, 150)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
              if (onComplete) onComplete();
            })
            .start();
        })
        .start();
    })
    .start();
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 1 — Thunder Golem
// Dark slate-grey rocky body, glowing cyan seam cracks, twin lightning-rod horns
// ─────────────────────────────────────────────────────────────────────────────
function buildThunderGolem(d) {
  const rock  = makeMat(d.bodyColor, d.emissive);
  const crack = makeMat(d.crackColor);
  const eye   = makeMat(d.eyeColor);
  const dark  = makeMat(0x111111);

  // Head — square and massive
  const head = box(2.8, 2.6, 2.6, rock.clone());
  head.position.set(0, 6.2, 0);
  trackBody(head); addToBoss(head);

  // Lightning-rod horns (tall thin prisms, yellow tips)
  for (const s of [-1,1]) {
    const rod = box(0.22, 2.2, 0.22, makeMat(0x555566));
    rod.position.set(s*0.7, 2.1, 0); head.add(rod);
    const tip = box(0.32, 0.5, 0.32, makeMat(d.eyeColor));
    tip.position.set(0, 1.3, 0); rod.add(tip);
    // Electric arc connector between horns
    if (s===1) {
      const arc = box(1.4*2, 0.1, 0.1, makeMat(d.crackColor));
      arc.position.set(0, 2.2, 0); head.add(arc); accentParts.push(arc);
    }
  }

  // V-brow (angry)
  for (const s of [-1,1]) {
    const brow = box(1.1,0.45,0.55, dark.clone());
    brow.position.set(s*0.6, 0.72, 1.36); brow.rotation.z = s*-0.35;
    head.add(brow);
  }

  // Glowing eyes — cyan/yellow
  for (const s of [-1,1]) {
    const e = box(0.55,0.42,0.15, eye.clone());
    e.position.set(s*0.7, 0.12, 1.35); head.add(e);
  }

  // Seam cracks on face
  const crackH = box(2.0,0.08,0.12, crack.clone());
  crackH.position.set(0,0,1.35); head.add(crackH); accentParts.push(crackH);
  const crackV = box(0.08,1.4,0.12, crack.clone());
  crackV.position.set(0,0.1,1.35); head.add(crackV); accentParts.push(crackV);

  // Angry mouth — dark slit
  const mouth = box(1.6,0.22,0.12, dark.clone());
  mouth.position.set(0,-0.62,1.35); head.add(mouth);
  for (let i=-1;i<=1;i++) {
    const tooth = box(0.26,0.28,0.12, makeMat(0xddddcc));
    tooth.position.set(i*0.44,-0.44,1.35); head.add(tooth);
  }

  // Torso — heavy, with glowing seam stripes
  const torso = box(3.4, 3.8, 1.6, rock.clone());
  torso.position.set(0, 2.4, 0); trackBody(torso); addToBoss(torso);

  // Seam cracks on torso
  const tCrack = box(3.4,0.1,1.65, crack.clone());
  tCrack.position.set(0,0.4,0); torso.add(tCrack); accentParts.push(tCrack);
  const tCrack2 = box(3.4,0.1,1.65, crack.clone());
  tCrack2.position.set(0,-0.9,0); torso.add(tCrack2); accentParts.push(tCrack2);

  // Boulder shoulder pads with cyan trim
  for (const s of [-1,1]) {
    const pad = box(1.4,1.4,1.4, rock.clone());
    pad.position.set(s*2.6,3.6,0); addToBoss(pad); trackBody(pad);
    const trim = box(1.45,0.12,1.45, crack.clone());
    trim.position.set(0,0.65,0); pad.add(trim); accentParts.push(trim);
  }

  // Arms — thick rocky
  for (const s of [-1,1]) {
    const arm = box(1.2,3.2,1.2, rock.clone());
    arm.position.set(s*2.5,1.8,0); trackBody(arm); addToBoss(arm);
    // Seam on arm
    const aCrack = box(1.25,0.08,1.25, crack.clone());
    aCrack.position.set(0,0,0); arm.add(aCrack); accentParts.push(aCrack);
  }

  // Legs — stocky
  for (const s of [-1,1]) {
    const leg = box(1.3,2.8,1.3, rock.clone());
    leg.position.set(s*0.85,-1.4,0); trackBody(leg); addToBoss(leg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 2 — Inferno Demon
// Fiery charcoal/crimson body, magma-glow shoulders, curved lava horns
// ─────────────────────────────────────────────────────────────────────────────
function buildInfernoDemon(d) {
  const body  = makeMat(d.bodyColor, d.emissive);
  const magma = makeMat(d.crackColor);
  const lava  = makeMat(d.accentColor);
  const eye   = makeMat(d.eyeColor);
  const dark  = makeMat(0x100000);

  // Head
  const head = box(2.4,2.4,2.4, body.clone());
  head.position.set(0,5.8,0); trackBody(head); addToBoss(head);

  // Curved lava horns — two segments each
  for (const s of [-1,1]) {
    const h1 = box(0.5,1.6,0.5, lava.clone());
    h1.position.set(s*0.8,1.7,0); h1.rotation.z = s*0.45; head.add(h1); accentParts.push(h1);
    const h2 = box(0.32,1.0,0.32, eye.clone());
    h2.position.set(0,0.95,0); h1.add(h2); accentParts.push(h2);
    // Ember tip
    const tip = box(0.2,0.3,0.2, makeMat(0xffffff));
    tip.position.set(0,0.6,0); h2.add(tip);
  }

  // V-brow (dark)
  for (const s of [-1,1]) {
    const brow = box(0.85,0.3,0.14, dark.clone());
    brow.position.set(s*0.48,0.55,1.27); brow.rotation.z = -s*0.45;
    head.add(brow);
  }

  // Glowing eyes
  for (const s of [-1,1]) {
    const e = box(0.6,0.5,0.15, eye.clone());
    e.position.set(s*0.6,0.12,1.25); head.add(e);
    // Inner pupil slit
    const sl = box(0.12,0.55,0.1, dark.clone());
    sl.position.set(0,0,0.05); e.add(sl);
  }

  // Angry mouth + flame fangs
  const mouthBg = box(1.7,0.55,0.12, dark.clone());
  mouthBg.position.set(0,-0.55,1.27); head.add(mouthBg);
  for (let i=-1;i<=1;i++) {
    const fang = box(0.22,0.35,0.1, lava.clone());
    fang.position.set(i*0.5,-0.32,1.28); head.add(fang); accentParts.push(fang);
  }

  // Torso — charcoal with magma lines
  const torso = box(3.0,3.6,1.5, body.clone());
  torso.position.set(0,2.2,0); trackBody(torso); addToBoss(torso);

  // Magma crack lines on torso
  for (const yOff of [0.5,-0.5]) {
    const mc = box(3.05,0.1,1.55, magma.clone());
    mc.position.set(0,yOff,0); torso.add(mc); accentParts.push(mc);
  }
  // Magma chest glow
  const chest = box(1.4,1.4,0.2, makeMat(0xff3300));
  chest.position.set(0,0.4,0.8); torso.add(chest); accentParts.push(chest);

  // Magma shoulders (glowing rounded pads)
  for (const s of [-1,1]) {
    const pad = box(1.3,0.9,1.3, lava.clone());
    pad.position.set(s*2.15,3.8,0); addToBoss(pad); accentParts.push(pad);
    // Molten surface dimple
    const core = box(0.6,0.4,0.6, eye.clone());
    core.position.set(0,0.35,0); pad.add(core); accentParts.push(core);
  }

  // Dynamic Shoulders & Arms with hammer kinematics
  bossArmLeftPivot = new THREE.Group();
  bossArmLeftPivot.name = 'BossArmLeftPivot';
  bossArmLeftPivot.position.set(-2.15, 3.4, 0);

  bossArmRightPivot = new THREE.Group();
  bossArmRightPivot.name = 'BossArmRightPivot';
  bossArmRightPivot.position.set(2.15, 3.4, 0);

  addToBoss(bossArmLeftPivot);
  addToBoss(bossArmRightPivot);

  // Left arm
  const armL = box(1.1, 3.2, 1.1, body.clone());
  armL.position.set(0, -1.4, 0);
  trackBody(armL);
  bossArmLeftPivot.add(armL);
  for (const c of [-1, 1]) {
    const claw = box(0.3, 0.6, 0.3, lava.clone());
    claw.position.set(c * 0.25, -1.8, 0); armL.add(claw); accentParts.push(claw);
  }

  // Right arm holding Fire Warhammer
  const armR = box(1.1, 3.2, 1.1, body.clone());
  armR.position.set(0, -1.4, 0);
  trackBody(armR);
  bossArmRightPivot.add(armR);
  for (const c of [-1, 1]) {
    const claw = box(0.3, 0.6, 0.3, lava.clone());
    claw.position.set(c * 0.25, -1.8, 0); armR.add(claw); accentParts.push(claw);
  }

  // Legs
  for (const s of [-1,1]) {
    const leg = box(1.2,3.0,1.2, body.clone());
    leg.position.set(s*0.75,-1.5,0); trackBody(leg); addToBoss(leg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 3 — Frost Titan
// Glacial light-blue body, jagged crystalline ice pauldrons, cold-white eyes
// ─────────────────────────────────────────────────────────────────────────────
function buildFrostTitan(d) {
  const ice    = makeMat(d.bodyColor, d.emissive);
  const shard  = makeMat(d.accentColor);
  const vein   = makeMat(d.crackColor);
  const eye    = makeMat(d.eyeColor);
  const dark   = makeMat(0x001828);

  // Head — slightly wider, glacial
  const head = box(2.5,2.4,2.4, ice.clone());
  head.position.set(0,5.9,0); trackBody(head); addToBoss(head);

  // Ice crown — jagged crystal spikes
  for (let i=0;i<5;i++) {
    const angle = (i/5)*Math.PI*2;
    const cr = box(0.28, 0.7+Math.random()*0.8, 0.28, shard.clone());
    cr.position.set(Math.cos(angle)*0.9, 1.5+Math.random()*0.4, Math.sin(angle)*0.5);
    cr.rotation.z = (Math.random()-0.5)*0.4;
    head.add(cr); accentParts.push(cr);
  }

  // Ice-blue vein lines on face
  const vH = box(2.0,0.07,0.1, vein.clone());
  vH.position.set(0,0.05,1.26); head.add(vH); accentParts.push(vH);

  // V-brow (dark ice)
  for (const s of [-1,1]) {
    const brow = box(0.9,0.28,0.14, dark.clone());
    brow.position.set(s*0.48,0.52,1.27); brow.rotation.z = -s*0.42; head.add(brow);
  }

  // Eyes — white, cold, piercing
  for (const s of [-1,1]) {
    const e = box(0.55,0.48,0.15, eye.clone());
    e.position.set(s*0.62,0.1,1.26); head.add(e);
    // Ice-blue pupil
    const pu = box(0.2,0.48,0.1, vein.clone());
    pu.position.set(0,0,0.05); e.add(pu);
  }

  // Icy snarl mouth
  const mBar = box(1.5,0.2,0.1, dark.clone());
  mBar.position.set(0,-0.5,1.27); head.add(mBar);
  for (let i=-2;i<=2;i++) {
    if(i===0) continue;
    const tooth = box(0.18,0.3,0.1, shard.clone());
    tooth.position.set(i*0.28,-0.32,1.28); head.add(tooth); accentParts.push(tooth);
  }

  // Torso — glacial with ice vein lines
  const torso = box(3.2,3.6,1.5, ice.clone());
  torso.position.set(0,2.2,0); trackBody(torso); addToBoss(torso);

  // Veins on torso
  const tv = box(3.25,0.06,1.55, vein.clone());
  tv.position.set(0,0.2,0); torso.add(tv); accentParts.push(tv);
  const tv2 = box(3.25,0.06,1.55, vein.clone());
  tv2.position.set(0,-0.8,0); torso.add(tv2); accentParts.push(tv2);

  // Jagged crystalline ice pauldrons
  for (const s of [-1,1]) {
    const base = box(1.6,1.0,1.6, ice.clone());
    base.position.set(s*2.3,3.6,0); addToBoss(base); trackBody(base);
    // Crystal spikes on pauldrons
    for (let j=0;j<4;j++) {
      const sp = box(0.22,0.55+j*0.18,0.22, shard.clone());
      sp.position.set((j%2-0.5)*0.6, 0.6+j*0.1, (j<2?0.5:-0.5));
      sp.rotation.z = s*(0.2+j*0.1);
      base.add(sp); accentParts.push(sp);
    }
  }

  // Dynamic Shoulders & Arms with hammer kinematics
  bossArmLeftPivot = new THREE.Group();
  bossArmLeftPivot.name = 'BossArmLeftPivot';
  bossArmLeftPivot.position.set(-2.15, 3.4, 0);

  bossArmRightPivot = new THREE.Group();
  bossArmRightPivot.name = 'BossArmRightPivot';
  bossArmRightPivot.position.set(2.15, 3.4, 0);

  addToBoss(bossArmLeftPivot);
  addToBoss(bossArmRightPivot);

  // Left arm
  const armL = box(1.15, 3.0, 1.15, ice.clone());
  armL.position.set(0, -1.4, 0);
  trackBody(armL);
  bossArmLeftPivot.add(armL);
  const avL = box(1.2, 0.07, 1.2, vein.clone());
  avL.position.set(0, 0, 0); armL.add(avL); accentParts.push(avL);

  // Right arm holding Glacial Frost Warhammer
  const armR = box(1.15, 3.0, 1.15, ice.clone());
  armR.position.set(0, -1.4, 0);
  trackBody(armR);
  bossArmRightPivot.add(armR);
  const avR = box(1.2, 0.07, 1.2, vein.clone());
  avR.position.set(0, 0, 0); armR.add(avR); accentParts.push(avR);

  // Legs
  for (const s of [-1,1]) {
    const leg = box(1.25,2.8,1.25, ice.clone());
    leg.position.set(s*0.82,-1.4,0); trackBody(leg); addToBoss(leg);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STAGE 4 — Shadow King (preserved)
// ─────────────────────────────────────────────────────────────────────────────
function buildShadowKing(d) {
  const mat  = makeMat(d.bodyColor, d.emissive);
  const gold = makeMat(d.accentColor);
  const eyeM = makeMat(d.eyeColor);
  const dark = makeMat(0x050008);

  const head = box(2.4,2.4,2.4, mat.clone());
  head.position.set(0,5.8,0); trackBody(head); addToBoss(head);

  const hood = box(2.8,1.0,2.8, mat.clone());
  hood.position.set(0,1.6,0); head.add(hood); trackBody(hood);

  for (let i=-1;i<=1;i++) {
    const spike = box(0.4,0.9,0.4, gold.clone());
    spike.position.set(i*0.75,2.2,0); head.add(spike); accentParts.push(spike);
  }
  for (const s of [-1,1]) {
    const brow = box(0.8,0.22,0.14, gold.clone());
    brow.position.set(s*0.46,0.44,1.27); brow.rotation.z = -s*0.5;
    head.add(brow); accentParts.push(brow);
    const eye2 = box(0.55,0.55,0.15, eyeM.clone());
    eye2.position.set(s*0.55,0.12,1.25); head.add(eye2);
  }
  const smirkL = box(0.7,0.18,0.1, dark.clone()); smirkL.position.set(-0.32,-0.48,1.27); smirkL.rotation.z=0.25; head.add(smirkL);
  const smirkR = box(0.5,0.14,0.1, dark.clone()); smirkR.position.set(0.36,-0.4,1.27); smirkR.rotation.z=-0.1; head.add(smirkR);
  const fang = box(0.16,0.28,0.1, gold.clone()); fang.position.set(-0.16,-0.32,1.28); head.add(fang); accentParts.push(fang);

  const torso = box(3.2,4.0,1.4, mat.clone());
  torso.position.set(0,2.0,0); trackBody(torso); addToBoss(torso);
  [[-2.05,0],[2.05,0]].forEach(([y,_])=>{ const t=box(3.4,0.3,1.5,gold.clone()); t.position.set(0,y,0); torso.add(t); accentParts.push(t); });

  for (const s of [-1,1]) {
    const arm = box(1.2,3.2,1.2, mat.clone());
    arm.position.set(s*2.2,2.0,0); trackBody(arm); addToBoss(arm);
  }
  const staffPole = box(0.2,5.0,0.2, gold.clone());
  staffPole.position.set(3.5,3.5,0); accentParts.push(staffPole); addToBoss(staffPole);
  const staffOrb = box(0.7,0.7,0.7, eyeM.clone());
  staffOrb.position.set(0,2.6,0); staffPole.add(staffOrb);

  for (const s of [-1,1]) {
    const leg = box(1.1,2.8,1.1, mat.clone());
    leg.position.set(s*0.7,-1.4,0); trackBody(leg); addToBoss(leg);
  }
}



// ─── 3D Model & 2.5D Asset Loader for Bosses ─────────────────────────────────
function _loadGLTF(url) {
  return new Promise((resolve) => {
    try {
      gltfLoader.load(
        url,
        (gltf) => {
          console.log('[boss] Loaded GLTF model:', url);
          resolve(gltf);
        },
        undefined,
        () => resolve(null)
      );
    } catch (e) {
      resolve(null);
    }
  });
}

function _checkImageExists(el) {
  return new Promise((resolve) => {
    const exts = ['.png', '.jpg', '.jpeg', '.webp'];
    let idx = 0;
    const tryNext = () => {
      if (idx >= exts.length) return resolve(null);
      const url = `/assets/models/boss_${el}${exts[idx++]}`;
      const img = new window.Image();
      img.onload = () => resolve(url);
      img.onerror = tryNext;
      img.src = url;
    };
    tryNext();
  });
}

async function _loadCustomBoss(el) {
  if (!el || !bossGroup) return;

  // 1. Attempt Native 3D GLB/GLTF Boss
  let gltf = await _loadGLTF(`/assets/models/boss_${el}.glb`);
  if (!gltf) gltf = await _loadGLTF(`/assets/models/boss_${el}.gltf`);

  if (gltf && gltf.scene && bossGroup) {
    if (proceduralRoot) proceduralRoot.visible = false;
    isCustomBoss = true;
    is2DBoss = false;

    customBossRoot = new THREE.Group();
    customBossRoot.name = 'CustomBossRoot';

    customBossModel = gltf.scene.clone(true);
    customBossMaterials = [];
    customBossOrigColors = [];
    customBossOrigEmissives = [];

    customBossBone = null;
    customBossModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (child.material) {
          customBossMaterials.push(child.material);
          if (child.material.color) customBossOrigColors.push(child.material.color.getHex());
          if (child.material.emissive) customBossOrigEmissives.push(child.material.emissive.getHex());
        }
      }
      if (!customBossBone && (child.isBone || child.type === 'Bone')) {
        const name = (child.name || '').toLowerCase();
        if (name.includes('righthand') || name.includes('hand_r') || name.includes('rightarm') || name.includes('arm_r')) {
          customBossBone = child;
          customBossBone._baseRotX = child.rotation.x;
          customBossBone._baseRotZ = child.rotation.z;
        }
      }
    });

    // Scale appropriately (1.3x to 1.6x player size to look imposing, e.g. ~4.0 units height)
    const bBox = new THREE.Box3().setFromObject(customBossModel);
    const bSize = new THREE.Vector3();
    bBox.getSize(bSize);
    if (bSize.y > 0.01) {
      const targetHeight = 4.0;
      const scaleFactor = targetHeight / bSize.y;
      customBossModel.scale.setScalar(scaleFactor);
    }

    // Center horizontally and align base at y = 0
    const scaledBox = new THREE.Box3().setFromObject(customBossModel);
    customBossModel.position.x = - (scaledBox.min.x + scaledBox.max.x) / 2;
    customBossModel.position.z = - (scaledBox.min.z + scaledBox.max.z) / 2;
    customBossModel.position.y = - scaledBox.min.y;

    // Face the player on the left (-X):
    customBossRoot.rotation.y = -Math.PI / 2;
    customBossRoot.add(customBossModel);
    bossGroup.add(customBossRoot);

    // Mount universal procedural bossArmPivot for Fire/Frost hammer
    _setupBossArmPivot(el);

    console.log(`[boss] Successfully mounted custom 3D model for Boss ${el}`);
    return;
  }

  // 2. Attempt 2.5D Billboard Sprite Boss (boss_${el}.png, .jpg, .webp)
  const imgUrl = await _checkImageExists(el);
  if (imgUrl && bossGroup) {
    if (proceduralRoot) proceduralRoot.visible = false;
    isCustomBoss = true;
    is2DBoss = true;

    new THREE.TextureLoader().load(imgUrl, (tex) => {
      if (!bossGroup) return;
      tex.colorSpace = THREE.SRGBColorSpace;
      const planeGeo = new THREE.PlaneGeometry(3.6, 4.8);
      const planeMat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const planeMesh = new THREE.Mesh(planeGeo, planeMat);
      planeMesh.position.set(0, 2.4, 0);
      planeMesh.rotation.y = -Math.PI / 6; // Angled toward player/camera
      customBossRoot = new THREE.Group();
      customBossRoot.add(planeMesh);
      bossGroup.add(customBossRoot);
      _setupBossArmPivot(el);
      console.log(`[boss] Successfully mounted 2.5D billboard sprite for Boss ${el}`);
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function createBoss(scene, bossIdentifier = 0) {
  if (bossGroup) removeBoss(scene);
  bossScene = scene;

  if (typeof bossIdentifier === 'string') {
    currentBossData = BOSS_ROSTER.find(b => b.element === bossIdentifier) || BOSS_ROSTER[0];
  } else if (typeof bossIdentifier === 'number') {
    currentBossData = BOSS_ROSTER[Math.min(bossIdentifier, BOSS_ROSTER.length - 1)];
  } else {
    currentBossData = BOSS_ROSTER[0];
  }

  bossGroup = new THREE.Group();
  proceduralRoot = new THREE.Group();
  proceduralRoot.name = 'ProceduralRoot';
  proceduralRoot.rotation.y = Math.PI / 2; // Procedural boss front faces -X (toward player)
  bossGroup.add(proceduralRoot);

  allBodyParts = []; originalColors = []; accentParts = [];
  customBossMaterials = []; customBossOrigColors = []; customBossOrigEmissives = [];
  customBossModel = null; customBossRoot = null;
  isCustomBoss = false; is2DBoss = false; isDefeated = false;
  bossSkinPlane = null; idleTime = 0; anim.active = false;
  bossGroup.scale.set(1, 1, 1);
  bossGroup.visible = true;

  const el = currentBossData.element;
  if      (el==='thunder') buildThunderGolem(currentBossData);
  else if (el==='fire')    buildInfernoDemon(currentBossData);
  else if (el==='frost')   buildFrostTitan(currentBossData);
  else                     buildShadowKing(currentBossData);

  // Mount universal procedural bossArmPivot for Fire and Frost bosses
  _setupBossArmPivot(el);

  // Elemental ambient light on boss
  if (elementalLightRef) scene.remove(elementalLightRef);
  if (el) {
    const lightCol = { thunder:0x00ffee, fire:0xff4400, frost:0x88ccff }[el] || 0xffffff;
    elementalLightRef = new THREE.PointLight(lightCol, 1.6, 14);
    elementalLightRef.position.set(BOSS_HOME.x, 5, 2);
    scene.add(elementalLightRef);
  }

  bossGroup.position.set(BOSS_HOME.x, BOSS_HOME.y, BOSS_HOME.z);
  bossGroup.rotation.y = 0;
  scene.add(bossGroup);

  // Attempt to load Admin custom 3D model or 2.5D sprite for this element
  if (el) {
    _loadCustomBoss(el);
  }

  return currentBossData;
}

export function getBossObject()  { return bossGroup; }
export function getBossName()    { return currentBossData?.name||'Boss'; }
export function getBossStage()   { return currentBossData?.stage||1; }
export function getBossElement() { return currentBossData?.element||null; }

export function updateBoss(deltaTime) {
  if (!bossGroup) return;
  TWEEN.update();
  idleTime += deltaTime;

  // Elemental idle: accent parts pulse with emissive (procedural)
  if (!isCustomBoss && currentBossData.element && Math.floor(idleTime*10)%2===0) {
    const pulse = 0.5+0.5*Math.sin(idleTime*3.5);
    accentParts.forEach(p=>{ if(p.material?.emissive) p.material.emissive.setScalar(pulse*0.3); });
  }

  let baseY = BOSS_HOME.y + Math.sin(idleTime*1.2)*0.15;
  let posX  = BOSS_HOME.x;

  if (anim.active) {
    anim.t += deltaTime;
    const prog = Math.min(anim.t/anim.duration,1.0);
    if (anim.type==='hurt') {
      const flinch = Math.sin(prog * Math.PI * 4) * 0.08;
      posX = prog<0.4 ? BOSS_HOME.x+prog/0.4*2.2 : BOSS_HOME.x+(1-(prog-0.4)/0.6)*2.2;
      bossGroup.rotation.z = flinch;
      if (prog>=1.0) {
        anim.active = false;
        bossGroup.rotation.z = 0;
        restoreColors();
      }
    } else if (anim.type === 'defeat') {
      const el = anim.defeatElement || currentBossData?.element || 'thunder';

      if (el === 'frost') {
        // ❄️ Boss Băng (Shatter into Ice Shards):
        // 1. Freezes solid and turns into bright white-cyan crystal (~200ms)
        if (prog < 0.15) {
          if (!anim.crystalized) {
            anim.crystalized = true;
            turnBossToCrystal();
            try { Audio.playIceShatter?.(); } catch (e) {}
            Effects.screenFlash('rgba(180,240,255,0.5)', 0.25);
          }
          posX = BOSS_HOME.x + (Math.random() - 0.5) * 0.05;
        } else {
          // 2. Hide original boss mesh instantly & spawn crystalline ice shard meshes scattering outward
          if (!anim.shattered) {
            anim.shattered = true;
            bossGroup.visible = false;
            Effects.spawnIceShardsExplosion(new THREE.Vector3(BOSS_HOME.x, 2.5, BOSS_HOME.z));
          }
        }
      } else if (el === 'fire') {
        // 🔥 Boss Lửa (Flame Engulf & Explosive Detonation):
        // 1. Staggers in place + massive swirling fire tornado wraps around body (~600ms)
        if (prog < 0.40) {
          posX = BOSS_HOME.x + (Math.random() - 0.5) * 0.35;
          bossGroup.position.z = BOSS_HOME.z + (Math.random() - 0.5) * 0.35;
          bossGroup.rotation.z = Math.sin(prog * 40) * 0.14;
          if (!anim.vortexFired) {
            anim.vortexFired = true;
            try { Audio.playFire?.(); } catch (e) {}
            Effects.spawnFireVortexAroundBoss(new THREE.Vector3(BOSS_HOME.x, 2.5, BOSS_HOME.z));
          }
        } else {
          // 2. Big flash of light + spherical explosion burst + boss scales down to 0
          if (!anim.exploded) {
            anim.exploded = true;
            try { Audio.playExplosion?.(); } catch (e) {}
            Effects.screenFlash('rgba(255,120,0,0.7)', 0.4);
            Effects.triggerShake(0.55, 0.45);
            Effects.spawnFireExplosionBurst(new THREE.Vector3(BOSS_HOME.x, 2.5, BOSS_HOME.z));
          }
          const s = Math.max(0, 1 - (prog - 0.40) / 0.25);
          bossGroup.scale.set(s, s, s);
          if (s <= 0.01) bossGroup.visible = false;
        }
      } else {
        // ⚡ Boss Sét (Sky Lightning Strike, Charred & Burst):
        // 1. Locks in place, trembling (~400ms)
        if (prog < 0.28) {
          posX = BOSS_HOME.x + (Math.random() - 0.5) * 0.16;
          bossGroup.position.z = BOSS_HOME.z + (Math.random() - 0.5) * 0.16;
          if (Math.random() < 0.35) {
            Effects.triggerElectricSparks(new THREE.Vector3(BOSS_HOME.x, 3.2, 0));
          }
        } else {
          // 2. Giant vertical thunderbolt strikes down + pitch black charred material
          if (!anim.struck) {
            anim.struck = true;
            Effects.spawnSkyThunderbolt(new THREE.Vector3(BOSS_HOME.x, 3.5, BOSS_HOME.z));
            Effects.screenFlash('rgba(255,255,255,0.92)', 0.35);
            try { Audio.playHeavyThunder?.(); } catch (e) {}
            Effects.triggerShake(0.65, 0.45);
            turnBossCharred();
            Effects.spawnCharredBurst(new THREE.Vector3(BOSS_HOME.x, 2.5, BOSS_HOME.z));
          }
          // 3. Charred remains crumble, sink down, dissolve into thin air
          if (prog >= 0.42) {
            baseY = BOSS_HOME.y - (prog - 0.42) * 2.8;
            const s = Math.max(0, 1 - (prog - 0.42) / 0.58);
            bossGroup.scale.set(s, s, s);
            if (s <= 0.01) bossGroup.visible = false;
          }
        }
      }

      if (prog >= 1.0) {
        anim.active = false;
        bossGroup.visible = false;
        if (anim.onComplete) {
          const cb = anim.onComplete;
          anim.onComplete = null;
          cb();
        }
        defeatCompleteCallbacks.forEach(cb => { try { cb(); } catch (e) {} });
        defeatCompleteCallbacks = [];
      }
    } else if (anim.type==='dodge') {
      if (prog<0.5) { baseY=BOSS_HOME.y+Math.sin(prog/0.5*Math.PI)*3.0; posX=BOSS_HOME.x+prog/0.5*3.0*anim.dodgeDir; }
      else { posX=BOSS_HOME.x+(1-(prog-0.5)/0.5)*3.0*anim.dodgeDir; }
      if (prog>=1.0) anim.active=false;
    } else if (anim.type==='attack') {
      const el = anim.attackElement || 'thunder';
      // ALL BOSSES REMAIN STATIONARY AT BOSS_HOME (NO PHYSICAL RUSH / LEAP SLAM)
      posX = BOSS_HOME.x;
      posZ = BOSS_HOME.z;

      if (el === 'frost') {
        // ❄️ Boss Băng (Crawling Frost Trail & Ice Spikes)
        // 1. Windup & Channel on ground (prog < 0.35): channels frost energy at ground level
        if (prog < 0.35) {
          const t = prog / 0.35;
          baseY = BOSS_HOME.y - 0.25 * t; // subtle ground channel crouch
          bossGroup.rotation.z = -0.15 * t;
          if (bossArmRightPivot) bossArmRightPivot.rotation.x = THREE.MathUtils.lerp(-Math.PI / 4, 0.35, t);
          if (bossArmLeftPivot) bossArmLeftPivot.rotation.x = THREE.MathUtils.lerp(0, 0.35, t);
        } else if (prog < 0.70) {
          // 2. Frost trail rapidly crawls along floor to player's feet & erupts ice spikes
          baseY = BOSS_HOME.y - 0.25;
          bossGroup.rotation.z = -0.15;
          if (!anim.vfxFired) {
            anim.vfxFired = true;
            try { Audio.playFrost?.(); } catch(e) {}
            Effects.spawnBossFrostTrailAndSpikes(
              new THREE.Vector3(BOSS_HOME.x - 0.5, 0.05, 0),
              new THREE.Vector3(-3.0, 0, 0),
              () => {
                if (!anim.peakFired) {
                  anim.peakFired = true;
                  if (anim.onPeak) anim.onPeak();
                }
              }
            );
          }
        } else {
          // 3. Return smoothly to ready stance
          const t = (prog - 0.70) / 0.30;
          baseY = THREE.MathUtils.lerp(BOSS_HOME.y - 0.25, BOSS_HOME.y, t);
          bossGroup.rotation.z = THREE.MathUtils.lerp(-0.15, 0, t);
          if (bossArmRightPivot) bossArmRightPivot.rotation.x = THREE.MathUtils.lerp(0.35, -Math.PI / 4, t);
          if (bossArmLeftPivot) bossArmLeftPivot.rotation.x = THREE.MathUtils.lerp(0.35, 0, t);
        }

        if (prog >= 0.70 && !anim.peakFired) {
          anim.peakFired = true;
          if (anim.onPeak) anim.onPeak();
        }

        if (prog >= 1.0) {
          anim.active = false;
          baseY = BOSS_HOME.y;
          bossGroup.rotation.z = 0;
          if (bossArmRightPivot) bossArmRightPivot.rotation.x = -Math.PI / 4;
          if (bossArmLeftPivot) bossArmLeftPivot.rotation.x = 0;
          if (anim.onComplete) anim.onComplete();
        }

      } else if (el === 'fire') {
        // 🔥 Boss Hỏa (Meteor Shower)
        // 1. Windup & Summon Sky Aura (prog < 0.35): raises arms summoning fiery aura above
        if (prog < 0.35) {
          const t = prog / 0.35;
          baseY = BOSS_HOME.y + 0.35 * t;
          bossGroup.rotation.z = -0.15 * t;
          if (bossArmRightPivot) bossArmRightPivot.rotation.x = THREE.MathUtils.lerp(-Math.PI / 4, -Math.PI * 0.75, t);
          if (bossArmLeftPivot) bossArmLeftPivot.rotation.x = THREE.MathUtils.lerp(0, -Math.PI * 0.75, t);
        } else if (prog < 0.70) {
          // 2. Meteors rain down diagonally from top sky onto player position
          baseY = BOSS_HOME.y + 0.35;
          bossGroup.rotation.z = -0.15;
          if (!anim.vfxFired) {
            anim.vfxFired = true;
            try { Audio.playFire?.(); } catch(e) {}
            Effects.spawnBossMeteorShower(
              new THREE.Vector3(-3.0, 0.5, 0),
              () => {
                if (!anim.peakFired) {
                  anim.peakFired = true;
                  if (anim.onPeak) anim.onPeak();
                }
              }
            );
          }
        } else {
          // 3. Return smoothly to ready stance
          const t = (prog - 0.70) / 0.30;
          baseY = THREE.MathUtils.lerp(BOSS_HOME.y + 0.35, BOSS_HOME.y, t);
          bossGroup.rotation.z = THREE.MathUtils.lerp(-0.15, 0, t);
          if (bossArmRightPivot) bossArmRightPivot.rotation.x = THREE.MathUtils.lerp(-Math.PI * 0.75, -Math.PI / 4, t);
          if (bossArmLeftPivot) bossArmLeftPivot.rotation.x = THREE.MathUtils.lerp(-Math.PI * 0.75, 0, t);
        }

        if (prog >= 0.70 && !anim.peakFired) {
          anim.peakFired = true;
          if (anim.onPeak) anim.onPeak();
        }

        if (prog >= 1.0) {
          anim.active = false;
          baseY = BOSS_HOME.y;
          bossGroup.rotation.z = 0;
          if (bossArmRightPivot) bossArmRightPivot.rotation.x = -Math.PI / 4;
          if (bossArmLeftPivot) bossArmLeftPivot.rotation.x = 0;
          if (anim.onComplete) anim.onComplete();
        }

      } else {
        // ⚡ Thunder Boss: Stationary charge and shoots direct linear lightning beam
        if (prog < 0.30) {
          // Windup raise staff/arm
          const t = prog / 0.30;
          baseY = BOSS_HOME.y + 0.35 * t;
          bossGroup.rotation.z = -0.12 * t;
        } else if (prog < 0.65) {
          // Firing crackling beam directly across arena hitting player
          baseY = BOSS_HOME.y + 0.35;
          bossGroup.rotation.z = -0.12;
          if (!anim.vfxFired) {
            anim.vfxFired = true;
            try { Audio.playThunder?.(); } catch(e) {}
            Effects.spawnBossLightningBeam(
              new THREE.Vector3(BOSS_HOME.x - 0.5, 3.8, 0),
              new THREE.Vector3(-3.0, 1.5, 0),
              380,
              () => {
                if (!anim.peakFired) {
                  anim.peakFired = true;
                  if (anim.onPeak) anim.onPeak();
                }
              }
            );
          }
        } else {
          // Return
          const t = (prog - 0.65) / 0.35;
          baseY = THREE.MathUtils.lerp(BOSS_HOME.y + 0.35, BOSS_HOME.y, t);
          bossGroup.rotation.z = THREE.MathUtils.lerp(-0.12, 0, t);
        }

        if (prog >= 0.65 && !anim.peakFired) {
          anim.peakFired = true;
          if (anim.onPeak) anim.onPeak();
        }

        if (prog >= 1.0) {
          anim.active = false;
          baseY = BOSS_HOME.y;
          bossGroup.rotation.z = 0;
          if (anim.onComplete) anim.onComplete();
        }
      }
    }
  }
  bossGroup.position.set(posX, baseY, BOSS_HOME.z);
}

function flashRed() {
  allBodyParts.forEach(p => { if (p.material?.color) p.material.color.setHex(0xFF2222); });
}

function restoreColors() {
  if (isCustomBoss && customBossMaterials.length > 0) {
    customBossMaterials.forEach((m, i) => {
      if (m.emissive && customBossOrigEmissives[i] !== undefined) {
        m.emissive.setHex(customBossOrigEmissives[i]);
      } else if (m.color && customBossOrigColors[i] !== undefined) {
        m.color.setHex(customBossOrigColors[i]);
      }
    });
  } else {
    allBodyParts.forEach((p, i) => {
      if (p.material?.color) p.material.color.setHex(originalColors[i]);
    });
  }
}

function turnBossToCrystal() {
  allBodyParts.forEach(p => {
    if (p.material) {
      if (p.material.color) p.material.color.setHex(0xd0f0ff);
      if (p.material.emissive) p.material.emissive.setHex(0x00e5ff);
      p.material.transparent = true;
      p.material.opacity = 0.95;
    }
  });
  if (customBossMaterials.length > 0) {
    customBossMaterials.forEach(m => {
      if (m.color) m.color.setHex(0xd0f0ff);
      if (m.emissive) m.emissive.setHex(0x00e5ff);
      m.transparent = true;
      m.opacity = 0.95;
    });
  }
}

function turnBossCharred() {
  allBodyParts.forEach(p => {
    if (p.material) {
      if (p.material.color) p.material.color.setHex(0x111111);
      if (p.material.emissive) p.material.emissive.setHex(0x000000);
      p.material.roughness = 1.0;
    }
  });
  if (customBossMaterials.length > 0) {
    customBossMaterials.forEach(m => {
      if (m.color) m.color.setHex(0x111111);
      if (m.emissive) m.emissive.setHex(0x000000);
      m.roughness = 1.0;
    });
  }
}

export function playBossHurt() {
  if (!bossGroup) return;
  if (isCustomBoss && customBossMaterials.length > 0) {
    customBossMaterials.forEach(m => {
      if (m.emissive) {
        m.emissive.setHex(0xff2222);
      } else if (m.color) {
        m.color.setHex(0xff2222);
      }
    });
  } else {
    flashRed();
  }
  anim.active = true;
  anim.type = 'hurt';
  anim.t = 0;
  anim.duration = 0.5;
}

export function playBossDodge() {
  if (!bossGroup) return;
  anim.active=true; anim.type='dodge'; anim.t=0; anim.duration=0.6; anim.dodgeDir=1;
}

export function playBossAttack(element, onPeak, onComplete) {
  if (!bossGroup) {
    if (onPeak) onPeak();
    if (onComplete) onComplete();
    return;
  }
  const el = element || currentBossData?.element || 'thunder';
  anim.active = true;
  anim.type = 'attack';
  anim.attackElement = el;
  anim.t = 0;
  anim.duration = (el === 'frost') ? 0.95 : (el === 'fire') ? 0.95 : 0.90;
  anim.onPeak = onPeak || null;
  anim.onComplete = onComplete || null;
  anim.peakFired = false;
  anim.vfxFired = false;
}

let currentHpPercent = 100;

export function triggerBossDefeat(element, onComplete) {
  if (isDefeated) {
    if (onComplete) {
      if (!anim.active || anim.type !== 'defeat') onComplete();
      else defeatCompleteCallbacks.push(onComplete);
    }
    return;
  }
  isDefeated = true;
  const el = element || currentBossData?.element || 'thunder';
  anim.active = true;
  anim.type = 'defeat';
  anim.defeatElement = el;
  anim.t = 0;
  anim.duration = 1.5;
  anim.onComplete = onComplete || null;
  anim.crystalized = false;
  anim.shattered = false;
  anim.vortexFired = false;
  anim.exploded = false;
  anim.struck = false;
}
export const onBossDefeat = triggerBossDefeat;

export function onBossDefeatDone(cb) {
  if (!isDefeated || !anim.active || anim.type !== 'defeat') {
    if (cb) cb();
  } else {
    defeatCompleteCallbacks.push(cb);
  }
}

export function isDefeatAnimating() {
  return isDefeated && anim.active && anim.type === 'defeat';
}

export function setBossHpPercent(pct, isFinalQuestion = false) {
  // CRITICAL: Under NO circumstances should defeat animations trigger while currentQuestionIndex < N - 1.
  if (!isFinalQuestion) {
    currentHpPercent = Math.max(1, Math.min(100, pct));
  } else {
    currentHpPercent = Math.max(0, Math.min(100, pct));
  }

  if (isFinalQuestion && currentHpPercent <= 0 && !isDefeated) {
    triggerBossDefeat(currentBossData?.element);
  }
}

export function deductBossHpPercent(amount, isFinalQuestion = false) {
  setBossHpPercent(currentHpPercent - amount, isFinalQuestion);
}

export function setBossHp(current, max, isFinalQuestion = false) {
  const pct = Math.max(0, Math.min(1, current / Math.max(1, max))) * 100;
  setBossHpPercent(pct, isFinalQuestion);
}

export function resetBossState() {
  isDefeated = false;
  anim.active = false;
  anim.type = null;
  anim.t = 0;
  currentHpPercent = 100;
  defeatCompleteCallbacks = [];
  if (bossArmPivot) bossArmPivot.rotation.set(0, 0, 0);
  if (bossArmRightPivot) bossArmRightPivot.rotation.set(-Math.PI / 4, 0, 0);
  if (bossArmLeftPivot) bossArmLeftPivot.rotation.set(0, 0, 0);
  if (customBossBone && customBossBone._baseRotX !== undefined) {
    customBossBone.rotation.x = customBossBone._baseRotX;
  }
  if (bossGroup) {
    bossGroup.position.set(BOSS_HOME.x, BOSS_HOME.y, BOSS_HOME.z);
    bossGroup.rotation.set(0, 0, 0);
    bossGroup.scale.set(1, 1, 1);
    bossGroup.visible = true;
    if (customBossRoot) {
      customBossRoot.position.set(0, 0, 0);
      customBossRoot.rotation.set(0, -Math.PI / 2, 0);
    }
  }
  restoreColors();
  setBossHpPercent(100, false);
}

export function removeBoss(scene) {
  if (bossGroup&&scene) scene.remove(bossGroup);
  if (elementalLightRef&&scene) scene.remove(elementalLightRef);
  bossGroup=null; bossScene=null; elementalLightRef=null;
  proceduralRoot = null; customBossRoot = null; customBossModel = null;
  bossArmPivot = null;
  bossArmLeftPivot = null; bossArmRightPivot = null; bossHammer = null;
  customBossBone = null; defeatCompleteCallbacks = [];
}

export function applyBossSkin(imageUrl) {
  if (!bossGroup) return;
  new THREE.TextureLoader().load(imageUrl,(tex)=>{
    tex.colorSpace=THREE.SRGBColorSpace;
    if(bossSkinPlane) bossGroup.remove(bossSkinPlane);
    const geo=new THREE.PlaneGeometry(2.8,3.4);
    const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false});
    bossSkinPlane=new THREE.Mesh(geo,mat);
    bossSkinPlane.position.set(0,2.4,-0.76);
    bossGroup.add(bossSkinPlane);
  });
}
