// THREE is available as a global from the CDN script tag

// ─────────────────────────────────────────────────────────────────────────────
// Colour maps
// ─────────────────────────────────────────────────────────────────────────────
const EQUIP_COLORS = {
  hat:    { cap:0xcc2222,  helm:0x888899  },
  shirt:  { hoodie:0x2255cc, vest:0x8b5e3c },
  pants:  { jeans:0x222233, cargo:0x556b2f },
  shoes:  { sneak:0xeeeeee, boots:0x3d2b1f },
  weapon: { sword:0x8b6914, glove:0xcc4400 },
};
const ELEMENTAL_PALETTES = {
  thunder: { hat:0x00ffff, shirt:0x0088cc, pants:0xffcc00, shoes:0x00cccc, weapon:0xffee00 },
  fire:    { hat:0xff4400, shirt:0xcc2200, pants:0x882200, shoes:0xff6600, weapon:0xff8800 },
  frost:   { hat:0x88ddff, shirt:0x4499cc, pants:0x224466, shoes:0x99ccff, weapon:0xcceeff },
};
const SKIN_TONE   = 0xf5c4a0;
const LEG_TONE    = 0xe8b490;
const DEFAULT_EQUIP = { hat:'cap', shirt:'hoodie', pants:'jeans', shoes:'sneak', weapon:'sword' };

// ─────────────────────────────────────────────────────────────────────────────
// Module state
// ─────────────────────────────────────────────────────────────────────────────
let playerGroup = null;
let activeElement = null;   // player's OWN equippedSet — never boss element

// Body-part mesh references
let headMesh, hatMesh, torsoMesh, pantsMesh;
let leftArm;                         // plain left arm mesh
let rightShoulderPivot = null;       // shoulder joint Group (rArmPivot)
let leftLeg, rightLeg;
let leftShoe, rightShoe;
let swordGroup = null;               // weapon, child of rightShoulderPivot

// Material refs for hurt recolor
let hatMat, shirtMat, pantsMat;

// Elemental aura
let elementalAura = null;
let elementalParticles = [];

// Flame wave projectile (Fire set)
let flameWave = null;
let flameWaveActive = false;
let flameWaveDX = 0;                 // accumulated X travel from spawn point

// Combat animation state
let anim = { active:false, type:'default', t:0, duration:1.0,
             onHit:null, onDone:null, hitFired:false, _hitEmitted:false };
let walkCycle = 0;

// ─── Spatial constants ────────────────────────────────────────────────────────
// Player faces +X (toward boss on the right); rotation.y = -Math.PI/2
const HOME_X  = -3.0;
const HOME_Y  =  1.5;
const HOME_Z  =  0;
const BOSS_X  =  3.0;
const BOSS_Y  =  4.0;
const FACE_Y  = -Math.PI / 2;   // player faces right (+X direction)

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function makeBox(w, h, d, color) {
  return new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
         new THREE.MeshLambertMaterial({ color }));
}

function getEquipColor(slot) {
  if (activeElement && ELEMENTAL_PALETTES[activeElement])
    return ELEMENTAL_PALETTES[activeElement][slot];
  const eq = window.gameState?.equipment || DEFAULT_EQUIP;
  return EQUIP_COLORS[slot][eq[slot] || DEFAULT_EQUIP[slot]] || 0x888888;
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD CHARACTER
// ─────────────────────────────────────────────────────────────────────────────
export function createPlayer(color, avatarPreset, cutoutUrl) {
  // Element strictly from player's own equippedSet
  activeElement = window.gameState?.equippedSet || null;
  if (playerGroup) return;
  playerGroup = new THREE.Group();
  playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
  playerGroup.rotation.y = FACE_Y;   // ← face toward boss (+X)
  _buildEquippedCharacter();
}

function _buildEquippedCharacter() {
  // Clear old children
  while (playerGroup.children.length) playerGroup.remove(playerGroup.children[0]);
  headMesh = hatMesh = torsoMesh = pantsMesh = null;
  leftArm = null; rightShoulderPivot = null; swordGroup = null;
  leftLeg = rightLeg = null; leftShoe = rightShoe = null;
  elementalAura = null; elementalParticles = [];

  // ── Head ──────────────────────────────────────────────────────────────────
  headMesh = makeBox(0.9,0.9,0.9, SKIN_TONE);
  headMesh.position.set(0, 1.4, 0);
  headMesh.castShadow = true;

  // Eyes (visible from front face = +Z in local space)
  const eyeW = new THREE.MeshLambertMaterial({ color:0xffffff });
  const eyeD = new THREE.MeshLambertMaterial({ color:0x111111 });
  for (const s of [-1,1]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.22,0.05), eyeW);
    w.position.set(s*0.2, 0.07, 0.47); headMesh.add(w);
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.1,0.1,0.05), eyeD);
    p.position.set(s*0.2, 0.05, 0.50); headMesh.add(p);
  }
  // Hat
  hatMat  = new THREE.MeshLambertMaterial({ color: getEquipColor('hat') });
  hatMesh = new THREE.Mesh(new THREE.BoxGeometry(1.0,0.45,1.0), hatMat);
  hatMesh.position.set(0, 0.62, 0);
  headMesh.add(hatMesh);

  // ── Torso / shirt ─────────────────────────────────────────────────────────
  shirtMat  = new THREE.MeshLambertMaterial({ color: getEquipColor('shirt') });
  torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.95,0.55), shirtMat);
  torsoMesh.position.set(0, 0.35, 0);
  torsoMesh.castShadow = true;

  // Pants
  pantsMat  = new THREE.MeshLambertMaterial({ color: getEquipColor('pants') });
  pantsMesh = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.55,0.55), pantsMat);
  pantsMesh.position.set(0,-0.3,0);
  torsoMesh.add(pantsMesh);

  // ── Left arm (plain — no weapon) ──────────────────────────────────────────
  // Geometry offset so top edge is at local (0,0,0) → pivot = shoulder
  const lArmGeo = new THREE.BoxGeometry(0.34,0.9,0.34);
  lArmGeo.translate(0, -0.45, 0);
  leftArm = new THREE.Mesh(lArmGeo, new THREE.MeshLambertMaterial({ color: SKIN_TONE }));
  leftArm.position.set(-0.65, 1.8, 0);   // shoulder joint at top-left torso

  // ── Right arm — shoulder pivot rig ────────────────────────────────────────
  //   rightShoulderPivot sits at shoulder joint (top-right of torso)
  //   Rotating pivot.rotation.x swings the whole arm+sword like a real shoulder
  rightShoulderPivot = new THREE.Group();
  rightShoulderPivot.position.set(0.65, 1.8, 0);   // shoulder position

  // Arm mesh: geometry offset down so pivot is at top (shoulder)
  const rArmGeo = new THREE.BoxGeometry(0.34,0.9,0.34);
  rArmGeo.translate(0, -0.45, 0);   // top edge of geo == (0,0,0) of pivot
  const rArmMesh = new THREE.Mesh(rArmGeo,
    new THREE.MeshLambertMaterial({ color: SKIN_TONE }));
  rightShoulderPivot.add(rArmMesh);

  // Weapon attached at hand (bottom of arm, y = -0.9)
  _buildSword();   // creates swordGroup and adds to rightShoulderPivot

  playerGroup.rightArmPivot = rightShoulderPivot;  // expose for external access

  // ── Legs ──────────────────────────────────────────────────────────────────
  const legMat = new THREE.MeshLambertMaterial({ color: LEG_TONE });
  leftLeg  = new THREE.Mesh(new THREE.BoxGeometry(0.42,1.0,0.42), legMat.clone());
  leftLeg.position.set(-0.28,-1.05,0);
  rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.42,1.0,0.42), legMat.clone());
  rightLeg.position.set(0.28,-1.05,0);

  // ── Shoes ─────────────────────────────────────────────────────────────────
  const shoeMat = new THREE.MeshLambertMaterial({ color: getEquipColor('shoes') });
  leftShoe = new THREE.Mesh(new THREE.BoxGeometry(0.46,0.28,0.56), shoeMat.clone());
  leftShoe.position.set(0,-0.62,0.06); leftLeg.add(leftShoe);
  rightShoe = new THREE.Mesh(new THREE.BoxGeometry(0.46,0.28,0.56), shoeMat.clone());
  rightShoe.position.set(0,-0.62,0.06); rightLeg.add(rightShoe);

  // ── Assemble ──────────────────────────────────────────────────────────────
  playerGroup.add(headMesh, torsoMesh, leftArm, rightShoulderPivot,
                  leftLeg, rightLeg);

  // ── Elemental aura ────────────────────────────────────────────────────────
  if (activeElement) _buildElementalAura(activeElement);
}

// ─── Sword builder ────────────────────────────────────────────────────────────
function _buildSword() {
  swordGroup = new THREE.Group();
  // Hand position = 0.9 below shoulder pivot
  swordGroup.position.set(0, -0.9, 0.1);
  // Slight forward angle in rest pose
  swordGroup.rotation.x = Math.PI / 6;

  const wColor = getEquipColor('weapon');

  if (activeElement === 'thunder') {
    // Lightning Katana
    const blMat = new THREE.MeshLambertMaterial({ color:0xffee00, emissive:0x443300 });
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.10,1.4,0.06), blMat);
    bl.position.set(0,-0.7,0);
    const gu = makeBox(0.52,0.10,0.10, 0x00ffff); gu.position.set(0,0,0);
    const gr = makeBox(0.10,0.32,0.10, 0x003366); gr.position.set(0,0.18,0);
    swordGroup.add(bl,gu,gr);
  } else if (activeElement === 'fire') {
    // Flame Sword
    const b  = makeBox(0.14,1.3,0.09, 0xff3300); b.position.set(0,-0.65,0);
    const gu = makeBox(0.50,0.12,0.12, 0xff6600); gu.position.set(0,0,0);
    const gr = makeBox(0.12,0.32,0.12, 0x661100); gr.position.set(0,0.18,0);
    swordGroup.add(b,gu,gr);
  } else if (activeElement === 'frost') {
    // Ice Spear
    const b   = makeBox(0.10,1.45,0.10, 0x88ddff); b.position.set(0,-0.72,0);
    const tip = makeBox(0.18,0.24,0.18, 0xffffff); tip.position.set(0,-1.44,0);
    const gu  = makeBox(0.40,0.10,0.40, 0x4499cc); gu.position.set(0,0,0);
    swordGroup.add(b,tip,gu);
  } else {
    // Wooden sword (default)
    const wM = new THREE.MeshLambertMaterial({ color: wColor });
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.13,1.15,0.08), wM);
    bl.position.set(0,-0.58,0);
    const gu = makeBox(0.50,0.11,0.11, 0x555566); gu.position.set(0,0,0);
    const gr = makeBox(0.11,0.36,0.11, 0x6b3320); gr.position.set(0,0.18,0);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08,0.16,0.06), wM);
    tip.position.set(0,-1.15,0);
    swordGroup.add(bl,gu,gr,tip);
  }
  rightShoulderPivot.add(swordGroup);
}

// ─── Elemental aura ───────────────────────────────────────────────────────────
function _buildElementalAura(element) {
  if (elementalAura) playerGroup.remove(elementalAura);
  elementalParticles.forEach(p => playerGroup.remove(p));
  elementalParticles = [];
  const cols = {
    thunder:{ ring:0x00ffff, spark:0xffcc00 },
    fire:   { ring:0xff4400, spark:0xff8800 },
    frost:  { ring:0x88ddff, spark:0xffffff },
  };
  const c = cols[element]; if (!c) return;
  const ringGeo = new THREE.TorusGeometry(1.3,0.06,8,32);
  elementalAura  = new THREE.Mesh(ringGeo,
    new THREE.MeshBasicMaterial({ color:c.ring, transparent:true, opacity:0.7 }));
  elementalAura.rotation.x = Math.PI/2;
  elementalAura.position.set(0,-0.3,0);
  playerGroup.add(elementalAura);
  for (let i=0;i<6;i++) {
    const sp = makeBox(0.1,0.1,0.1, i%2===0 ? c.ring : c.spark);
    playerGroup.add(sp); elementalParticles.push(sp);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ELEMENTAL SET API
// ─────────────────────────────────────────────────────────────────────────────
export function applyElementalSet(element) {
  activeElement = element;
  if (window.gameState) {
    window.gameState.equippedSet  = element;
    window.gameState.thunderSet   = element === 'thunder';
    window.gameState.damagePerHit = element ? 2 : 1;
  }
  if (playerGroup) _buildEquippedCharacter();
}
export function applyThunderSet() { applyElementalSet('thunder'); }

// ─────────────────────────────────────────────────────────────────────────────
// Getters / stubs
// ─────────────────────────────────────────────────────────────────────────────
export function getPlayerObject()  { return playerGroup; }
export function getPosition()      { return playerGroup ? playerGroup.position.clone() : new THREE.Vector3(HOME_X,HOME_Y,HOME_Z); }
export function getRotation()      { return { y: playerGroup ? playerGroup.rotation.y : 0 }; }
export function getActiveElement() { return activeElement; }
export function applySkin()        {}
export function switchToCutout()   {}
export function playDodge()        {}
export function playPunch()        { playAttack(null,null); }

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT — dispatch by player's equipped element
// ─────────────────────────────────────────────────────────────────────────────
export function playAttack(onHitMoment, onDone) {
  if (!playerGroup) return;
  const el  = activeElement || null;
  const dur = el==='thunder'?1.1 : el==='frost'?1.05 : el==='fire'?1.0 : 0.9;
  anim = { active:true, type:el||'default', t:0, duration:dur,
           onHit:onHitMoment||null, onDone:onDone||null,
           hitFired:false, _hitEmitted:false };
}

export function playRushMiss(onDone) {
  if (!playerGroup) return;
  anim = { active:true, type:'miss', t:0, duration:0.85,
           onHit:null, onDone:onDone||null, hitFired:false, _hitEmitted:false };
}

export function playHurt() {
  if (!playerGroup) return;
  [headMesh, torsoMesh, leftArm].filter(Boolean).forEach(m => {
    if (m?.material) m.material.color.setHex(0xFF3333);
  });
  let shakes = 0;
  const iv = setInterval(() => {
    if (playerGroup) playerGroup.position.x = HOME_X + (Math.random()-0.5)*0.4;
    if (++shakes >= 6) { clearInterval(iv); if (playerGroup) playerGroup.position.x = HOME_X; }
  }, 40);
  setTimeout(() => {
    [headMesh, torsoMesh, leftArm].filter(Boolean).forEach(m => {
      if (m?.material) m.material.color.setHex(SKIN_TONE);
    });
    if (hatMat)   hatMat.color.setHex(getEquipColor('hat'));
    if (shirtMat) shirtMat.color.setHex(getEquipColor('shirt'));
  }, 300);
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE LOOP
// ─────────────────────────────────────────────────────────────────────────────
export function updatePlayer(deltaTime, camera) {
  if (!playerGroup) return;

  // Elemental aura
  if (elementalAura) {
    elementalAura.rotation.z += deltaTime * (activeElement==='frost' ? 1.5 : 2.8);
    elementalAura.material.opacity = 0.5 + 0.25 * Math.sin(Date.now()*0.004);
  }
  elementalParticles.forEach((sp,i) => {
    const t = Date.now()*0.002 + i*1.1;
    sp.position.x = Math.cos(t)*1.2;
    sp.position.z = Math.sin(t)*0.5;
    sp.position.y = Math.sin(t*0.8+i)*1.3;
    sp.visible = Math.sin(t*3+i) > -0.3;
  });

  // Flame wave projectile travel
  if (flameWaveActive && flameWave && flameWave.parent) {
    flameWaveDX += deltaTime * 18;
    // World X = HOME_X + fwd direction (player faces +X, so wave goes +X in world)
    flameWave.position.x = HOME_X + 3.5 + flameWaveDX;
    flameWave.rotation.z += deltaTime * 8;
    if (!flameWave._hit && flameWave.position.x >= BOSS_X - 0.5) {
      flameWave._hit = true;
      if (!anim._hitEmitted) { anim._hitEmitted = true; if (anim.onHit) anim.onHit(); }
    }
    if (flameWave.position.x > BOSS_X + 5) {
      flameWave.parent.remove(flameWave); flameWave = null; flameWaveActive = false;
    }
  }

  if (anim.active) {
    anim.t += deltaTime;
    const prog = Math.min(anim.t / anim.duration, 1.0);

    switch (anim.type) {
      case 'default': _animDefault(prog, deltaTime); break;
      case 'thunder': _animThunder(prog, deltaTime); break;
      case 'frost':   _animFrost(prog, deltaTime);   break;
      case 'fire':    _animFire(prog, deltaTime);    break;
      case 'miss':    _animMiss(prog, deltaTime);    break;
    }

    if (prog >= 1.0) { _resetAll(); anim.active = false; if (anim.onDone) anim.onDone(); }

  } else {
    // Idle bob
    playerGroup.position.x = HOME_X;
    playerGroup.position.y = HOME_Y + Math.sin(Date.now()*0.0018)*0.06;
    playerGroup.rotation.y = FACE_Y;   // always face boss
    // Gentle idle arm sway
    if (leftArm)            leftArm.rotation.x            =  Math.sin(Date.now()*0.0015)*0.06;
    if (rightShoulderPivot) rightShoulderPivot.rotation.x = -Math.sin(Date.now()*0.0015)*0.06;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ① DEFAULT — Basic Slash (Chém Thường)
//   Dash → wind-up arm high → chop down → hit-stop → hop back
// ═════════════════════════════════════════════════════════════════════════════
function _animDefault(prog, dt) {
  // Player advances along +X (already facing that direction)
  const ATTACK_X = HOME_X + (BOSS_X - HOME_X) * 0.80;

  if (prog < 0.28) {
    // Phase 1 — dash forward + hop + wind up arm
    const t = prog/0.28;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, ATTACK_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t*Math.PI)*0.6;
    playerGroup.rotation.y = FACE_Y;
    _runLimbs(dt, 18);
    // Wind-up: arm raised back high
    if (rightShoulderPivot) {
      rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(0,   -Math.PI/1.2, t);
      rightShoulderPivot.rotation.z = THREE.MathUtils.lerp(0,   -0.3,          t);
    }

  } else if (prog < 0.44) {
    // Phase 2 — chop / downward swing
    const t = (prog-0.28)/0.16;
    playerGroup.position.x = ATTACK_X;
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = FACE_Y;
    // Slam arm forward and down
    if (rightShoulderPivot) {
      rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(-Math.PI/1.2, Math.PI/3, t);
      rightShoulderPivot.rotation.z = THREE.MathUtils.lerp(-0.3,          0.2,       t);
    }
    // Emit hit at midpoint of chop
    if (prog >= 0.36 && !anim._hitEmitted) { anim._hitEmitted=true; if (anim.onHit) anim.onHit(); }
    // Hit-stop scale squeeze
    const b = 1 + Math.sin(t*Math.PI)*0.10;
    playerGroup.scale.set(b, 1/b, 1);

  } else if (prog < 0.56) {
    // Phase 3 — hold / freeze
    playerGroup.position.x = ATTACK_X; playerGroup.rotation.y=FACE_Y; playerGroup.scale.set(1,1,1);
    if (rightShoulderPivot) { rightShoulderPivot.rotation.x=Math.PI/3; rightShoulderPivot.rotation.z=0.2; }

  } else {
    // Phase 4 — hop back + reset arm
    const t = (prog-0.56)/0.44;
    playerGroup.position.x = THREE.MathUtils.lerp(ATTACK_X, HOME_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t*Math.PI)*1.0;
    playerGroup.rotation.y = FACE_Y; playerGroup.scale.set(1,1,1);
    if (rightShoulderPivot) {
      rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(Math.PI/3, 0, t);
      rightShoulderPivot.rotation.z = THREE.MathUtils.lerp(0.2,       0, t);
    }
    _runLimbs(dt, 12);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ② THUNDER — Lôi Long Không Trảm (Airborne Dive Slash)
//   Leap high → flip → plunge sword-first → backflip away
// ═════════════════════════════════════════════════════════════════════════════
function _animThunder(prog, dt) {
  const ATTACK_X = HOME_X + (BOSS_X - HOME_X) * 0.85;
  const PEAK_Y   = HOME_Y + 6.0;

  if (prog < 0.25) {
    // Rising leap — move forward partially while soaring up
    const t = prog/0.25;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, HOME_X+(ATTACK_X-HOME_X)*0.5, t);
    playerGroup.position.y = HOME_Y + Math.sin(t*Math.PI*0.5)*6.0;
    playerGroup.rotation.y = FACE_Y;
    _runLimbs(dt, 10);
    if (rightShoulderPivot) {
      rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(0, -Math.PI/1.0, t); // raise overhead
      rightShoulderPivot.rotation.z = 0;
    }

  } else if (prog < 0.45) {
    // At apex — forward flip, continuing advance
    const t = (prog-0.25)/0.20;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X+(ATTACK_X-HOME_X)*0.5, ATTACK_X, t);
    playerGroup.position.y = PEAK_Y - t*t*(PEAK_Y-HOME_Y-0.8);
    // Full forward tumble
    playerGroup.rotation.y = FACE_Y - Math.PI*2*t;  // 360° flip
    if (rightShoulderPivot) rightShoulderPivot.rotation.x = -Math.PI/1.0; // overhead, sword pointing down

  } else if (prog < 0.56) {
    // Plunge — slam down onto boss
    const t = (prog-0.45)/0.11;
    playerGroup.position.x = ATTACK_X;
    playerGroup.position.y = HOME_Y + 1.0 - t*1.0;
    playerGroup.rotation.y = FACE_Y;
    if (rightShoulderPivot) {
      rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(-Math.PI/1.0, Math.PI/2.5, t);
      rightShoulderPivot.rotation.z = 0;
    }
    if (!anim._hitEmitted) { anim._hitEmitted=true; if (anim.onHit) anim.onHit(); }
    playerGroup.scale.set(1+t*0.10, 1-t*0.07, 1);

  } else if (prog < 0.66) {
    // Land freeze
    playerGroup.position.x=ATTACK_X; playerGroup.position.y=HOME_Y;
    playerGroup.rotation.y=FACE_Y; playerGroup.scale.set(1,1,1);
    if (rightShoulderPivot) { rightShoulderPivot.rotation.x=Math.PI/2.5; rightShoulderPivot.rotation.z=0; }

  } else {
    // Backflip return
    const t = (prog-0.66)/0.34;
    playerGroup.position.x = THREE.MathUtils.lerp(ATTACK_X, HOME_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t*Math.PI)*2.2;
    playerGroup.rotation.y = FACE_Y; playerGroup.scale.set(1,1,1);
    if (rightShoulderPivot) rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(Math.PI/2.5, 0, t);
    _runLimbs(dt, 14);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ③ FROST — Băng Tinh Trượt Trảm (Slide Uppercut)
//   Slide low leaning back → upward crescent slash → slide back
// ═════════════════════════════════════════════════════════════════════════════
function _animFrost(prog, dt) {
  const ATTACK_X = HOME_X + (BOSS_X - HOME_X) * 0.90;

  if (prog < 0.30) {
    // Slide forward, body leans back 30° (tilt away from direction of travel = +Z rotation since facing +X)
    const t = prog/0.30;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, ATTACK_X, t);
    playerGroup.position.y = HOME_Y - 0.35;
    playerGroup.rotation.y = FACE_Y;
    // Lean: tilt top of body backward (negative body rotation around Z — leans backward in screen space)
    playerGroup.rotation.z = THREE.MathUtils.lerp(0, 0.52, t); // 30° lean
    _runLimbs(dt, 22);
    // Arm cocked down-back for upswing
    if (rightShoulderPivot) {
      rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(0, Math.PI/1.6, t);
      rightShoulderPivot.rotation.z = 0;
    }

  } else if (prog < 0.52) {
    // Upward crescent slash — arm sweeps from below all the way overhead
    const t = (prog-0.30)/0.22;
    playerGroup.position.x = ATTACK_X;
    playerGroup.position.y = HOME_Y - 0.35 + t*0.35;
    playerGroup.rotation.z = THREE.MathUtils.lerp(0.52, 0, t);
    playerGroup.rotation.y = FACE_Y;
    if (rightShoulderPivot) {
      rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(Math.PI/1.6, -Math.PI/1.1, t); // full upswing
      rightShoulderPivot.rotation.z = THREE.MathUtils.lerp(0, -0.25, t);
    }
    if (prog >= 0.41 && !anim._hitEmitted) { anim._hitEmitted=true; if (anim.onHit) anim.onHit(); }
    playerGroup.scale.set(1, 1+Math.sin(t*Math.PI)*0.10, 1);

  } else if (prog < 0.62) {
    // Hold
    playerGroup.position.x=ATTACK_X; playerGroup.position.y=HOME_Y;
    playerGroup.rotation.y=FACE_Y; playerGroup.rotation.z=0; playerGroup.scale.set(1,1,1);
    if (rightShoulderPivot) { rightShoulderPivot.rotation.x=-Math.PI/1.1; rightShoulderPivot.rotation.z=-0.25; }

  } else {
    // Slide back
    const t = (prog-0.62)/0.38;
    playerGroup.position.x = THREE.MathUtils.lerp(ATTACK_X, HOME_X, t);
    playerGroup.position.y = HOME_Y - 0.18*(1-t);
    playerGroup.rotation.z = THREE.MathUtils.lerp(0, 0, t);
    playerGroup.rotation.y = FACE_Y; playerGroup.scale.set(1,1,1);
    if (rightShoulderPivot) {
      rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(-Math.PI/1.1, 0, t);
      rightShoulderPivot.rotation.z = THREE.MathUtils.lerp(-0.25, 0, t);
    }
    _runLimbs(dt, 14);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ④ FIRE — Hỏa Luân Kiếm Khí (Sword Wave Projectile)
//   Step forward → heavy slash → release spinning crescent flame wave
// ═════════════════════════════════════════════════════════════════════════════
function _animFire(prog, dt) {
  const STEP_X = HOME_X + (BOSS_X-HOME_X)*0.4;

  if (prog < 0.20) {
    // Step forward
    const t = prog/0.20;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, STEP_X, t);
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = FACE_Y;
    if (rightShoulderPivot) {
      rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(0, -Math.PI/1.3, t); // wind up
      rightShoulderPivot.rotation.z = THREE.MathUtils.lerp(0, -0.2, t);
    }

  } else if (prog < 0.40) {
    // Heavy vertical slam
    const t = (prog-0.20)/0.20;
    playerGroup.position.x = STEP_X;
    playerGroup.rotation.y = FACE_Y;
    if (rightShoulderPivot) {
      rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(-Math.PI/1.3, Math.PI/1.8, t);
      rightShoulderPivot.rotation.z = THREE.MathUtils.lerp(-0.2, 0.15, t);
    }
    // Release flame wave at midpoint
    if (prog >= 0.30 && !anim.hitFired) { anim.hitFired=true; _spawnFlameWave(); }
    playerGroup.scale.set(1+Math.sin(t*Math.PI)*0.11, 1, 1);

  } else {
    // Hold stance + return
    playerGroup.position.y = HOME_Y + Math.sin((prog-0.40)/0.60*Math.PI)*0.15;
    playerGroup.rotation.y = FACE_Y; playerGroup.scale.set(1,1,1);
    if (rightShoulderPivot) {
      rightShoulderPivot.rotation.x = THREE.MathUtils.lerp(Math.PI/1.8, 0, (prog-0.40)/0.60);
      rightShoulderPivot.rotation.z = THREE.MathUtils.lerp(0.15, 0, (prog-0.40)/0.60);
    }
    if (prog > 0.75) {
      const t=(prog-0.75)/0.25;
      playerGroup.position.x = THREE.MathUtils.lerp(STEP_X, HOME_X, t);
    } else {
      playerGroup.position.x = STEP_X;
    }
  }
}

function _spawnFlameWave() {
  const waveGroup = new THREE.Group();
  const waveCols  = [0xff4400, 0xff8800, 0xffcc00, 0xff2200];
  for (let i=0; i<8; i++) {
    const a = (i/8)*Math.PI;
    const seg = makeBox(0.22,0.22,0.15, waveCols[i%waveCols.length]);
    seg.position.set(Math.cos(a-Math.PI/2)*0.55, Math.sin(a-Math.PI/2)*0.55, 0);
    waveGroup.add(seg);
  }
  waveGroup.add(makeBox(0.18,0.18,0.18, 0xffff00));
  waveGroup.position.set(HOME_X+3.5, HOME_Y+0.6, 0);
  // Add to scene (player's parent)
  const sceneRef = playerGroup.parent;
  if (sceneRef) sceneRef.add(waveGroup);
  flameWave = waveGroup; flameWave._hit = false;
  flameWaveDX = 0; flameWaveActive = true;
}

// ═════════════════════════════════════════════════════════════════════════════
// ⑤ MISS
// ═════════════════════════════════════════════════════════════════════════════
function _animMiss(prog, dt) {
  const RUSH_X = HOME_X + (BOSS_X-HOME_X)*0.75;
  if (prog < 0.40) {
    const t=prog/0.40;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X,RUSH_X,t);
    playerGroup.position.y = HOME_Y+Math.sin(t*Math.PI)*0.8;
    playerGroup.rotation.y = FACE_Y;
    _runLimbs(dt,18);
    if (rightShoulderPivot) { rightShoulderPivot.rotation.x=THREE.MathUtils.lerp(0,-Math.PI/1.2,t); rightShoulderPivot.rotation.z=THREE.MathUtils.lerp(0,-0.3,t); }
  } else if (prog < 0.56) {
    playerGroup.position.x=RUSH_X; playerGroup.rotation.y=FACE_Y;
    if (rightShoulderPivot) { rightShoulderPivot.rotation.x=Math.PI/3; rightShoulderPivot.rotation.z=0.2; }
  } else {
    const t=(prog-0.56)/0.44;
    playerGroup.position.x=THREE.MathUtils.lerp(RUSH_X,HOME_X,t);
    playerGroup.position.y=HOME_Y+Math.sin(t*Math.PI)*1.0;
    playerGroup.rotation.y=FACE_Y;
    if (rightShoulderPivot) { rightShoulderPivot.rotation.x=THREE.MathUtils.lerp(Math.PI/3,0,t); rightShoulderPivot.rotation.z=THREE.MathUtils.lerp(0.2,0,t); }
    _runLimbs(dt,12);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────
function _runLimbs(dt, speed) {
  walkCycle += dt*speed;
  if (leftLeg)  leftLeg.rotation.x  =  Math.sin(walkCycle)*0.65;
  if (rightLeg) rightLeg.rotation.x = -Math.sin(walkCycle)*0.65;
  if (leftArm)  leftArm.rotation.x  = -Math.sin(walkCycle)*0.45;
}

function _resetAll() {
  playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
  playerGroup.rotation.set(0, FACE_Y, 0);
  playerGroup.scale.set(1,1,1);
  if (leftLeg)            leftLeg.rotation.x            = 0;
  if (rightLeg)           rightLeg.rotation.x           = 0;
  if (leftArm)            leftArm.rotation.x            = 0;
  if (rightShoulderPivot) { rightShoulderPivot.rotation.x = 0; rightShoulderPivot.rotation.z = 0; }
  walkCycle = 0;
  // Clean up stray flame wave
  if (flameWave && flameWave.parent) { flameWave.parent.remove(flameWave); }
  flameWave = null; flameWaveActive = false; flameWaveDX = 0;
}
