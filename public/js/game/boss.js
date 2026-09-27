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
let hpMesh = null;

let allBodyParts = [], originalColors = [], accentParts = [];
let hpCanvas, hpCtx, hpBarTexture;
let idleTime = 0;
let currentBossData = BOSS_ROSTER[0];
let bossSkinPlane = null;
let elementalLightRef = null;

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

  // Arms with claw tips
  for (const s of [-1,1]) {
    const arm = box(1.1,3.2,1.1, body.clone());
    arm.position.set(s*2.1,2.0,0); trackBody(arm); addToBoss(arm);
    for (const c of [-1,1]) {
      const claw = box(0.3,0.6,0.3, lava.clone());
      claw.position.set(c*0.25,-1.8,0); arm.add(claw); accentParts.push(claw);
    }
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

  // Arms — icy, thick
  for (const s of [-1,1]) {
    const arm = box(1.15,3.0,1.15, ice.clone());
    arm.position.set(s*2.15,2.0,0); trackBody(arm); addToBoss(arm);
    // Ice vein stripe
    const av = box(1.2,0.07,1.2, vein.clone());
    av.position.set(0,0,0); arm.add(av); accentParts.push(av);
  }

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

// ─── HP bar ───────────────────────────────────────────────────────────────────
function buildHpBar() {
  hpCanvas = document.createElement('canvas');
  hpCanvas.width = 512; hpCanvas.height = 48;
  hpCtx = hpCanvas.getContext('2d');
  hpBarTexture = new THREE.CanvasTexture(hpCanvas);
  const hpMat = new THREE.MeshBasicMaterial({map:hpBarTexture,transparent:true,depthTest:false});
  hpMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5,0.7), hpMat);
  hpMesh.position.set(0, isCustomBoss ? 5.2 : 11.0, 0);
  hpMesh.onBeforeRender = function(r,s,cam){ this.quaternion.copy(cam.quaternion); };
  bossGroup.add(hpMesh);
  setBossHp(1,1);
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

    if (hpMesh) hpMesh.position.set(0, 5.2, 0);
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
      if (hpMesh) hpMesh.position.set(0, 5.2, 0);
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

  // Elemental ambient light on boss
  if (elementalLightRef) scene.remove(elementalLightRef);
  if (el) {
    const lightCol = { thunder:0x00ffee, fire:0xff4400, frost:0x88ccff }[el] || 0xffffff;
    elementalLightRef = new THREE.PointLight(lightCol, 1.6, 14);
    elementalLightRef.position.set(BOSS_HOME.x, 5, 2);
    scene.add(elementalLightRef);
  }

  buildHpBar();
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
    } else if (anim.type==='defeat') {
      baseY = BOSS_HOME.y - prog * 2.5;
      bossGroup.rotation.z = - prog * (Math.PI / 3);
      const s = Math.max(0.01, 1 - prog * 0.6);
      bossGroup.scale.set(s, s, s);
      if (prog >= 1.0) {
        anim.active = false;
        bossGroup.visible = false;
      }
    } else if (anim.type==='dodge') {
      if (prog<0.5) { baseY=BOSS_HOME.y+Math.sin(prog/0.5*Math.PI)*3.0; posX=BOSS_HOME.x+prog/0.5*3.0*anim.dodgeDir; }
      else { posX=BOSS_HOME.x+(1-(prog-0.5)/0.5)*3.0*anim.dodgeDir; }
      if (prog>=1.0) anim.active=false;
    } else if (anim.type==='attack') {
      const el = anim.attackElement || 'thunder';
      if (el === 'frost') {
        // ❄️ Frost Boss: Leaps forward across arena and slams down towards player
        if (prog < 0.25) {
          // Windup: crouch back
          const t = prog / 0.25;
          posX = BOSS_HOME.x + 0.5 * t;
          baseY = BOSS_HOME.y - 0.2 * t;
          bossGroup.rotation.z = 0.12 * t;
        } else if (prog < 0.55) {
          // Leap across arena to x = -0.8
          const t = (prog - 0.25) / 0.30;
          posX = THREE.MathUtils.lerp(BOSS_HOME.x + 0.5, -0.8, t);
          baseY = BOSS_HOME.y + Math.sin(t * Math.PI) * 3.4;
          bossGroup.rotation.z = -0.25 * Math.sin(t * Math.PI);
        } else if (prog < 0.70) {
          // Impact / slam pose on ground
          posX = -0.8;
          baseY = BOSS_HOME.y;
          bossGroup.rotation.z = 0;
          if (!anim.peakFired) {
            anim.peakFired = true;
            Effects.spawnBossFrostSlam(new THREE.Vector3(-0.8, 0.2, 0));
            try { Audio.playSlash?.(); } catch (e) {}
            if (anim.onPeak) anim.onPeak();
          }
        } else {
          // Leap back to BOSS_HOME
          const t = (prog - 0.70) / 0.30;
          posX = THREE.MathUtils.lerp(-0.8, BOSS_HOME.x, t);
          baseY = BOSS_HOME.y + Math.sin(t * Math.PI) * 1.8;
          bossGroup.rotation.z = 0.15 * Math.sin(t * Math.PI);
        }
        if (prog >= 1.0) {
          anim.active = false;
          bossGroup.rotation.z = 0;
          if (anim.onComplete) anim.onComplete();
        }
      } else if (el === 'fire') {
        // 🔥 Fire Boss: Slams hammer hard into ground; wave of erupting fire geysers shoots across floor
        if (prog < 0.30) {
          // Windup raise hammer
          const t = prog / 0.30;
          baseY = BOSS_HOME.y + 0.5 * t;
          bossGroup.rotation.z = -0.18 * t;
        } else if (prog < 0.45) {
          // Slam down
          const t = (prog - 0.30) / 0.15;
          baseY = BOSS_HOME.y + 0.5 * (1 - t) - 0.2 * Math.sin(t * Math.PI);
          bossGroup.rotation.z = 0.22 * t;
          if (!anim.vfxFired && prog >= 0.36) {
            anim.vfxFired = true;
            try { Audio.playFire?.(); } catch(e) {}
            Effects.triggerShake(0.3, 0.3);
            Effects.spawnBossFireWave(new THREE.Vector3(BOSS_HOME.x, 0, 0), new THREE.Vector3(-2.8, 0, 0), () => {
              if (!anim.peakFired) {
                anim.peakFired = true;
                if (anim.onPeak) anim.onPeak();
              }
            });
          }
        } else {
          // Recovery
          const t = (prog - 0.45) / 0.55;
          baseY = BOSS_HOME.y;
          bossGroup.rotation.z = THREE.MathUtils.lerp(0.22, 0, t);
        }
        if (prog >= 0.70 && !anim.peakFired) {
          anim.peakFired = true;
          if (anim.onPeak) anim.onPeak();
        }
        if (prog >= 1.0) {
          anim.active = false;
          bossGroup.rotation.z = 0;
          if (anim.onComplete) anim.onComplete();
        }
      } else {
        // ⚡ Thunder Boss: Raises staff and shoots directed beam/stream of crackling lightning
        if (prog < 0.30) {
          // Windup raise staff
          const t = prog / 0.30;
          baseY = BOSS_HOME.y + 0.4 * t;
          bossGroup.rotation.z = -0.12 * t;
        } else if (prog < 0.65) {
          // Firing beam
          baseY = BOSS_HOME.y + 0.4;
          bossGroup.rotation.z = -0.12;
          if (!anim.vfxFired) {
            anim.vfxFired = true;
            try { Audio.playThunder?.(); } catch(e) {}
            Effects.spawnBossLightningBeam(
              new THREE.Vector3(BOSS_HOME.x - 0.5, 4.0, 0),
              new THREE.Vector3(-3.0, 1.5, 0),
              350,
              () => {
                if (!anim.peakFired) {
                  anim.peakFired = true;
                  if (anim.onPeak) anim.onPeak();
                }
              }
            );
          }
        } else {
          // Lower staff
          const t = (prog - 0.65) / 0.35;
          baseY = BOSS_HOME.y + 0.4 * (1 - t);
          bossGroup.rotation.z = -0.12 * (1 - t);
        }
        if (prog >= 0.65 && !anim.peakFired) {
          anim.peakFired = true;
          if (anim.onPeak) anim.onPeak();
        }
        if (prog >= 1.0) {
          anim.active = false;
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
  anim.duration = (el === 'frost') ? 1.05 : (el === 'fire') ? 0.95 : 0.88;
  anim.onPeak = onPeak || null;
  anim.onComplete = onComplete || null;
  anim.peakFired = false;
  anim.vfxFired = false;
}

let currentHpPercent = 100;

export function setBossHpPercent(pct) {
  currentHpPercent = Math.max(0, Math.min(100, pct));
  if (!hpCtx || !hpBarTexture) return;
  const W = 512, H = 48;
  hpCtx.clearRect(0, 0, W, H);
  hpCtx.fillStyle = '#111';
  hpCtx.fillRect(0, 0, W, H);

  const ratio = currentHpPercent / 100;
  const el = currentBossData?.element;
  const fillColor = el === 'fire' ? (ratio > 0.5 ? '#ff6600' : ratio > 0.25 ? '#cc2200' : '#880000')
                  : el === 'frost'? (ratio > 0.5 ? '#88ddff' : ratio > 0.25 ? '#4499cc' : '#224488')
                  : el === 'thunder'? (ratio > 0.5 ? '#00ffcc' : ratio > 0.25 ? '#ffcc00' : '#ff4400')
                  : (ratio > 0.6 ? '#06d6a0' : ratio > 0.3 ? '#ffbe0b' : '#ef233c');
  hpCtx.fillStyle = fillColor;
  hpCtx.fillRect(2, 2, (W - 4) * ratio, H - 4);
  hpCtx.fillStyle = '#fff';
  hpCtx.font = 'bold 20px monospace';
  // Pure clean name, no percentages or numbers
  hpCtx.fillText(`${currentBossData?.name || 'BOSS'}`, 12, H - 14);
  hpBarTexture.needsUpdate = true;

  if (currentHpPercent <= 0 && !isDefeated) {
    isDefeated = true;
    anim.active = true;
    anim.type = 'defeat';
    anim.t = 0;
    anim.duration = 1.5;
  }
}

export function deductBossHpPercent(amount) {
  setBossHpPercent(currentHpPercent - amount);
}

export function setBossHp(current, max) {
  const pct = Math.max(0, Math.min(1, current / Math.max(1, max))) * 100;
  setBossHpPercent(pct);
}

export function resetBossState() {
  isDefeated = false;
  anim.active = false;
  anim.type = null;
  anim.t = 0;
  currentHpPercent = 100;
  if (bossGroup) {
    bossGroup.position.set(BOSS_HOME.x, BOSS_HOME.y, BOSS_HOME.z);
    bossGroup.scale.set(1, 1, 1);
    bossGroup.visible = true;
    if (customBossRoot) {
      customBossRoot.position.set(0, 0, 0);
      customBossRoot.rotation.set(0, -Math.PI / 2, 0);
    }
  }
  setBossHpPercent(100);
}

export function removeBoss(scene) {
  if (bossGroup&&scene) scene.remove(bossGroup);
  if (elementalLightRef&&scene) scene.remove(elementalLightRef);
  bossGroup=null; bossScene=null; elementalLightRef=null;
  proceduralRoot = null; customBossRoot = null; customBossModel = null;
  hpMesh = null;
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
