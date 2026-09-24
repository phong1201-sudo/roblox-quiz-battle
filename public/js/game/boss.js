// THREE is available as a global from the CDN script tag

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
  trackBody(head); bossGroup.add(head);

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
  torso.position.set(0, 2.4, 0); trackBody(torso); bossGroup.add(torso);

  // Seam cracks on torso
  const tCrack = box(3.4,0.1,1.65, crack.clone());
  tCrack.position.set(0,0.4,0); torso.add(tCrack); accentParts.push(tCrack);
  const tCrack2 = box(3.4,0.1,1.65, crack.clone());
  tCrack2.position.set(0,-0.9,0); torso.add(tCrack2); accentParts.push(tCrack2);

  // Boulder shoulder pads with cyan trim
  for (const s of [-1,1]) {
    const pad = box(1.4,1.4,1.4, rock.clone());
    pad.position.set(s*2.6,3.6,0); bossGroup.add(pad); trackBody(pad);
    const trim = box(1.45,0.12,1.45, crack.clone());
    trim.position.set(0,0.65,0); pad.add(trim); accentParts.push(trim);
  }

  // Arms — thick rocky
  for (const s of [-1,1]) {
    const arm = box(1.2,3.2,1.2, rock.clone());
    arm.position.set(s*2.5,1.8,0); trackBody(arm); bossGroup.add(arm);
    // Seam on arm
    const aCrack = box(1.25,0.08,1.25, crack.clone());
    aCrack.position.set(0,0,0); arm.add(aCrack); accentParts.push(aCrack);
  }

  // Legs — stocky
  for (const s of [-1,1]) {
    const leg = box(1.3,2.8,1.3, rock.clone());
    leg.position.set(s*0.85,-1.4,0); trackBody(leg); bossGroup.add(leg);
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
  head.position.set(0,5.8,0); trackBody(head); bossGroup.add(head);

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
  torso.position.set(0,2.2,0); trackBody(torso); bossGroup.add(torso);

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
    pad.position.set(s*2.15,3.8,0); bossGroup.add(pad); accentParts.push(pad);
    // Molten surface dimple
    const core = box(0.6,0.4,0.6, eye.clone());
    core.position.set(0,0.35,0); pad.add(core); accentParts.push(core);
  }

  // Arms with claw tips
  for (const s of [-1,1]) {
    const arm = box(1.1,3.2,1.1, body.clone());
    arm.position.set(s*2.1,2.0,0); trackBody(arm); bossGroup.add(arm);
    for (const c of [-1,1]) {
      const claw = box(0.3,0.6,0.3, lava.clone());
      claw.position.set(c*0.25,-1.8,0); arm.add(claw); accentParts.push(claw);
    }
  }

  // Legs
  for (const s of [-1,1]) {
    const leg = box(1.2,3.0,1.2, body.clone());
    leg.position.set(s*0.75,-1.5,0); trackBody(leg); bossGroup.add(leg);
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
  head.position.set(0,5.9,0); trackBody(head); bossGroup.add(head);

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
  torso.position.set(0,2.2,0); trackBody(torso); bossGroup.add(torso);

  // Veins on torso
  const tv = box(3.25,0.06,1.55, vein.clone());
  tv.position.set(0,0.2,0); torso.add(tv); accentParts.push(tv);
  const tv2 = box(3.25,0.06,1.55, vein.clone());
  tv2.position.set(0,-0.8,0); torso.add(tv2); accentParts.push(tv2);

  // Jagged crystalline ice pauldrons
  for (const s of [-1,1]) {
    const base = box(1.6,1.0,1.6, ice.clone());
    base.position.set(s*2.3,3.6,0); bossGroup.add(base); trackBody(base);
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
    arm.position.set(s*2.15,2.0,0); trackBody(arm); bossGroup.add(arm);
    // Ice vein stripe
    const av = box(1.2,0.07,1.2, vein.clone());
    av.position.set(0,0,0); arm.add(av); accentParts.push(av);
  }

  // Legs
  for (const s of [-1,1]) {
    const leg = box(1.25,2.8,1.25, ice.clone());
    leg.position.set(s*0.82,-1.4,0); trackBody(leg); bossGroup.add(leg);
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
  head.position.set(0,5.8,0); trackBody(head); bossGroup.add(head);

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
  torso.position.set(0,2.0,0); trackBody(torso); bossGroup.add(torso);
  [[-2.05,0],[2.05,0]].forEach(([y,_])=>{ const t=box(3.4,0.3,1.5,gold.clone()); t.position.set(0,y,0); torso.add(t); accentParts.push(t); });

  for (const s of [-1,1]) {
    const arm = box(1.2,3.2,1.2, mat.clone());
    arm.position.set(s*2.2,2.0,0); trackBody(arm); bossGroup.add(arm);
  }
  const staffPole = box(0.2,5.0,0.2, gold.clone());
  staffPole.position.set(3.5,3.5,0); accentParts.push(staffPole); bossGroup.add(staffPole);
  const staffOrb = box(0.7,0.7,0.7, eyeM.clone());
  staffOrb.position.set(0,2.6,0); staffPole.add(staffOrb);

  for (const s of [-1,1]) {
    const leg = box(1.1,2.8,1.1, mat.clone());
    leg.position.set(s*0.7,-1.4,0); trackBody(leg); bossGroup.add(leg);
  }
}

// ─── HP bar ───────────────────────────────────────────────────────────────────
function buildHpBar() {
  hpCanvas = document.createElement('canvas');
  hpCanvas.width = 512; hpCanvas.height = 48;
  hpCtx = hpCanvas.getContext('2d');
  hpBarTexture = new THREE.CanvasTexture(hpCanvas);
  const hpMat = new THREE.MeshBasicMaterial({map:hpBarTexture,transparent:true,depthTest:false});
  const hpMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.5,0.7), hpMat);
  hpMesh.position.set(0,11.0,0);
  hpMesh.onBeforeRender = function(r,s,cam){ this.quaternion.copy(cam.quaternion); };
  bossGroup.add(hpMesh);
  setBossHp(1,1);
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function createBoss(scene, bossIndex=0) {
  if (bossGroup) removeBoss(scene);
  bossScene = scene;
  currentBossData = BOSS_ROSTER[Math.min(bossIndex, BOSS_ROSTER.length-1)];
  bossGroup = new THREE.Group();
  allBodyParts = []; originalColors = []; accentParts = [];
  bossSkinPlane = null; idleTime = 0; anim.active = false;

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
  // Face LEFT toward the player (player is at x:-3, boss is at x:+3)
  // rotation.y = Math.PI/2 means the character's +Z front faces -X (toward player)
  bossGroup.rotation.y = Math.PI / 2;
  scene.add(bossGroup);
  return currentBossData;
}

export function getBossObject()  { return bossGroup; }
export function getBossName()    { return currentBossData?.name||'Boss'; }
export function getBossStage()   { return currentBossData?.stage||1; }
export function getBossElement() { return currentBossData?.element||null; }

export function updateBoss(deltaTime) {
  if (!bossGroup) return;
  idleTime += deltaTime;

  // Elemental idle: accent parts pulse with emissive
  if (currentBossData.element && Math.floor(idleTime*10)%2===0) {
    const pulse = 0.5+0.5*Math.sin(idleTime*3.5);
    accentParts.forEach(p=>{ if(p.material?.emissive) p.material.emissive.setScalar(pulse*0.3); });
  }

  let baseY = BOSS_HOME.y + Math.sin(idleTime*1.2)*0.15;
  let posX  = BOSS_HOME.x;

  if (anim.active) {
    anim.t += deltaTime;
    const prog = Math.min(anim.t/anim.duration,1.0);
    if (anim.type==='hurt') {
      posX = prog<0.4 ? BOSS_HOME.x+prog/0.4*2.5 : BOSS_HOME.x+(1-(prog-0.4)/0.6)*2.5;
      if (prog>=1.0) { anim.active=false; restoreColors(); }
    } else if (anim.type==='dodge') {
      if (prog<0.5) { baseY=BOSS_HOME.y+Math.sin(prog/0.5*Math.PI)*3.0; posX=BOSS_HOME.x+prog/0.5*3.0*anim.dodgeDir; }
      else { posX=BOSS_HOME.x+(1-(prog-0.5)/0.5)*3.0*anim.dodgeDir; }
      if (prog>=1.0) anim.active=false;
    }
  }
  bossGroup.position.set(posX, baseY, BOSS_HOME.z);
}

function flashRed()     { allBodyParts.forEach(p=>{ if(p.material.color) p.material.color.setHex(0xFF2222); }); }
function restoreColors(){ allBodyParts.forEach((p,i)=>{ if(p.material.color) p.material.color.setHex(originalColors[i]); }); }

export function playBossHurt() {
  if (!bossGroup) return;
  flashRed();
  anim.active=true; anim.type='hurt'; anim.t=0; anim.duration=0.5;
}
export function playBossDodge() {
  if (!bossGroup) return;
  anim.active=true; anim.type='dodge'; anim.t=0; anim.duration=0.6; anim.dodgeDir=1;
}
export function setBossHp(current, max) {
  if (!hpCtx||!hpBarTexture) return;
  const W=512, H=48;
  hpCtx.clearRect(0,0,W,H);
  hpCtx.fillStyle='#111'; hpCtx.fillRect(0,0,W,H);
  const pct = Math.max(0,Math.min(1,current/Math.max(1,max)));
  const el = currentBossData?.element;
  const fillColor = el==='fire' ? (pct>0.5?'#ff6600':pct>0.25?'#cc2200':'#880000')
                  : el==='frost'? (pct>0.5?'#88ddff':pct>0.25?'#4499cc':'#224488')
                  : el==='thunder'? (pct>0.5?'#00ffcc':pct>0.25?'#ffcc00':'#ff4400')
                  : (pct>0.6?'#06d6a0':pct>0.3?'#ffbe0b':'#ef233c');
  hpCtx.fillStyle=fillColor;
  hpCtx.fillRect(2,2,(W-4)*pct,H-4);
  hpCtx.fillStyle='#fff'; hpCtx.font='bold 18px monospace';
  hpCtx.fillText(`${currentBossData?.name||'BOSS'}  ${current}/${max}`,8,H-9);
  hpBarTexture.needsUpdate=true;
}

export function removeBoss(scene) {
  if (bossGroup&&scene) scene.remove(bossGroup);
  if (elementalLightRef&&scene) scene.remove(elementalLightRef);
  bossGroup=null; bossScene=null; elementalLightRef=null;
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
