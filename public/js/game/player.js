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

  // Elemental art: attach custom 2D body billboard if available
  _attachCharacterBodySprite();
}

// ─────────────────────────────────────────────────────────────────────────────
// ELEMENTAL 2D ART SYSTEM (BODY & WEAPON SPRITES)
// ─────────────────────────────────────────────────────────────────────────────
let _characterBodyMesh = null;

// Texture cache: { [element]: { body: THREE.CanvasTexture|null, weapon: THREE.CanvasTexture|null } }
const _artCache = {
  thunder: { body: null, weapon: null },
  fire:    { body: null, weapon: null },
  frost:   { body: null, weapon: null },
};

/**
 * Remove near-white background (#FFFFFF -> alpha transparent)
 */
function _removeWhiteBg(srcCanvas, threshold = 220) {
  const out = document.createElement('canvas');
  out.width  = srcCanvas.width;
  out.height = srcCanvas.height;
  const ctx   = out.getContext('2d');
  ctx.drawImage(srcCanvas, 0, 0);
  const id   = ctx.getImageData(0, 0, out.width, out.height);
  const data = id.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i+1], b = data[i+2];
    if (r > threshold && g > threshold && b > threshold) {
      data[i+3] = 0;   // transparent
    }
  }
  ctx.putImageData(id, 0, 0);
  return out;
}

/**
 * Load body or weapon texture for an element with fallback paths
 */
function _loadArtTexture(element, type) {
  return new Promise((resolve) => {
    if (!element || !['thunder', 'fire', 'frost'].includes(element)) return resolve(null);
    if (!['body', 'weapon'].includes(type)) return resolve(null);

    const urls = [];
    if (type === 'body') {
      urls.push(`/assets/characters/${element}_body.png`);
      urls.push(`/assets/characters/${element}.png`);
      urls.push(`/assets/characters/${element}.jpg`);
      if (element === 'fire') {
        urls.push('/assets/characters/fireblade.png');
        urls.push('/assets/characters/fireblade(cho%20game)_0.jpg');
      }
    } else {
      urls.push(`/assets/characters/${element}_weapon.png`);
      urls.push(`/assets/characters/${element}_weapon.jpg`);
    }

    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    let idx = 0;
    const tryNext = () => {
      if (idx >= urls.length) return resolve(null);
      img.src = urls[idx++];
    };

    img.onload = () => {
      try {
        const cleanCanvas = _cleanWhiteBackground(img);
        const tex = new THREE.CanvasTexture(cleanCanvas);
        tex.needsUpdate = true;
        if (!_artCache[element]) _artCache[element] = { body: null, weapon: null };
        _artCache[element][type] = tex;
        console.log(`[player] Loaded custom ${type} art for ${element}`);
        resolve(tex);
      } catch (err) {
        console.warn(`[player] Error processing art for ${element} ${type}:`, err);
        tryNext();
      }
    };
    img.onerror = tryNext;
    tryNext();
  });
}

function _cleanWhiteBackground(img) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, c.width, c.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i] > 220 && d[i + 1] > 220 && d[i + 2] > 220) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
}

function _attachCharacterBodySprite() {
  if (_characterBodyMesh && playerGroup) {
    playerGroup.remove(_characterBodyMesh);
    _characterBodyMesh = null;
  }
  if (!activeElement) {
    _set3DModelVisible(true);
    return;
  }

  const tex = _artCache[activeElement]?.body;
  if (tex) {
    const geo = new THREE.PlaneGeometry(3.0, 3.2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    _characterBodyMesh = new THREE.Mesh(geo, mat);
    _characterBodyMesh.position.set(0, 0.45, 0.2);
    playerGroup.add(_characterBodyMesh);
    _set3DModelVisible(false);
  } else {
    _set3DModelVisible(true);
    _loadArtTexture(activeElement, 'body').then(loadedTex => {
      if (loadedTex && activeElement && playerGroup) {
        _attachCharacterBodySprite();
      }
    });
  }
}

function _set3DModelVisible(vis) {
  if (headMesh)  headMesh.visible  = vis;
  if (torsoMesh) torsoMesh.visible = vis;
  if (leftArm)   leftArm.visible   = vis;
  if (leftLeg)   leftLeg.visible   = vis;
  if (rightLeg)  rightLeg.visible  = vis;
  if (rightShoulderPivot) {
    const armBox = rightShoulderPivot.children.find(c => c !== swordGroup);
    if (armBox) armBox.visible = vis;
  }
}

// Listen for admin hot-reload events
if (typeof window !== 'undefined') {
  const onArtUpdated = (ev) => {
    const { element, type } = ev.detail || {};
    if (!element) return;
    if (_artCache[element]) {
      if (type) _artCache[element][type] = null;
      else _artCache[element] = { body: null, weapon: null };
    }
    Promise.all([
      _loadArtTexture(element, 'body'),
      _loadArtTexture(element, 'weapon'),
    ]).then(() => {
      if (activeElement === element && playerGroup) {
        _buildEquippedCharacter();
      }
    });
  };
  window.addEventListener('character-art-updated', onArtUpdated);
  window.addEventListener('character-image-updated', onArtUpdated);

  // Pre-load existing textures on startup
  ['thunder', 'fire', 'frost'].forEach(el => {
    _loadArtTexture(el, 'body');
    _loadArtTexture(el, 'weapon');
  });
}




// ─── Sword builder ────────────────────────────────────────────────────────────
function _buildSword() {
  swordGroup = new THREE.Group();
  swordGroup.position.set(0, -0.9, 0.1);
  swordGroup.rotation.x = Math.PI / 6;

  // ── Custom 2D Weapon Sprite (if uploaded for this element) ─────────────────
  if (activeElement && _artCache[activeElement]?.weapon) {
    const wGeo = new THREE.PlaneGeometry(0.75, 1.8);
    wGeo.translate(0, 0.8, 0); // hilt at bottom (pivot at hand)
    const wMat = new THREE.MeshBasicMaterial({
      map: _artCache[activeElement].weapon,
      transparent: true,
      alphaTest: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const customSword = new THREE.Mesh(wGeo, wMat);
    customSword.rotation.y = Math.PI / 2; // face camera
    swordGroup.position.set(0, -0.9, 0.1);
    swordGroup.rotation.x = Math.PI / 5;  // point upward and forward
    swordGroup.add(customSword);
    swordGroup._customWeapon = customSword;
    rightShoulderPivot.add(swordGroup);
    return;
  }


  if (activeElement === 'thunder') {
    // ── Thunder Blade: jagged lightning katana ────────────────────────────
    // Blade: bright electric yellow-cyan, high emissive
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xeeffaa,
      emissive: 0x00ffff,
      emissiveIntensity: 2.5,
      roughness: 0.1, metalness: 0.9,
    });
    // Main blade shaft
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.35, 0.05), bladeMat);
    shaft.position.set(0, -0.67, 0);
    // Zigzag teeth: 3 small protrusions along the blade edge
    const toothMat = new THREE.MeshStandardMaterial({ color:0xffff00, emissive:0x00ccff, emissiveIntensity:3.0, roughness:0.0, metalness:1.0 });
    const teeth = [[-0.12,-0.3],[-0.12,-0.55],[-0.12,-0.80]].map(([dx,y]) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.14,0.11,0.05), toothMat);
      t.position.set(dx, y, 0); return t;
    });
    // Guard: wide flat crosspiece in cyan
    const guardMat = new THREE.MeshStandardMaterial({ color:0x00ffff, emissive:0x006666, emissiveIntensity:1.5, roughness:0.2, metalness:0.8 });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.10, 0.10), guardMat);
    guard.position.set(0, 0, 0);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.34, 0.09),
      new THREE.MeshStandardMaterial({ color:0x003366, roughness:0.8, metalness:0.3 }));
    grip.position.set(0, 0.20, 0);
    // Store flickering blade ref for update loop
    swordGroup._thunderBlade = [shaft, ...teeth];
    swordGroup._thunderT = 0;
    swordGroup.add(shaft, ...teeth, guard, grip);

  } else if (activeElement === 'fire') {
    // ── Fire Blade: glowing magma sword ──────────────────────────────────
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xff6600,
      emissive: 0xff3300,
      emissiveIntensity: 2.0,
      roughness: 0.25, metalness: 0.7,
    });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.30, 0.08), bladeMat);
    blade.position.set(0, -0.65, 0);
    // Wider tip that tapers (simulate taper with a box scaled)
    const tipMat = new THREE.MeshStandardMaterial({ color:0xff8800, emissive:0xffcc00, emissiveIntensity:3.0, roughness:0.1, metalness:0.8 });
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.30, 0.06), tipMat);
    tip.position.set(0, -1.30, 0);
    const guardMat = new THREE.MeshStandardMaterial({ color:0xff6600, emissive:0xff2200, emissiveIntensity:1.5, roughness:0.3, metalness:0.6 });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.12, 0.12), guardMat);
    guard.position.set(0, 0, 0);
    const gripMat = new THREE.MeshStandardMaterial({ color:0x661100, roughness:0.9, metalness:0.2 });
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.34, 0.12), gripMat);
    grip.position.set(0, 0.20, 0);
    // Store for pulsing update
    swordGroup._fireBlade = blade;
    swordGroup._fireTip   = tip;
    swordGroup.add(blade, tip, guard, grip);

  } else if (activeElement === 'frost') {
    // ── Frost Blade: crystalline ice spear ───────────────────────────────
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x88e5ff,
      emissive: 0x0088cc,
      emissiveIntensity: 1.2,
      roughness: 0.05, metalness: 0.0,
      transparent: true, opacity: 0.82,
    });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.10, 1.45, 0.10), iceMat);
    blade.position.set(0, -0.72, 0);
    // Crystal tip: sharper bright-white facets
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0x88ccff, emissiveIntensity: 2.0,
      roughness: 0.0, metalness: 0.0, transparent: true, opacity: 0.90,
    });
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.26, 0.18), crystalMat);
    tip.position.set(0, -1.45, 0);
    // Side crystal shards (decorative)
    const shard1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.06), crystalMat);
    shard1.position.set(0.09, -0.55, 0); shard1.rotation.z = 0.35;
    const shard2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.38, 0.06), crystalMat);
    shard2.position.set(-0.09, -0.80, 0); shard2.rotation.z = -0.35;
    const guardMat = new THREE.MeshStandardMaterial({ color:0x4499cc, emissive:0x002244, emissiveIntensity:0.8, roughness:0.3, metalness:0.5 });
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.10, 0.42), guardMat);
    guard.position.set(0, 0, 0);
    swordGroup._iceBlade = [blade, tip, shard1, shard2];
    swordGroup.add(blade, tip, shard1, shard2, guard);

  } else {
    // ── Default: wooden training sword ───────────────────────────────────
    const wColor = getEquipColor('weapon');
    const wM = new THREE.MeshLambertMaterial({ color: wColor });
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.13, 1.15, 0.08), wM);
    bl.position.set(0, -0.58, 0);
    const gu = makeBox(0.50, 0.11, 0.11, 0x555566); gu.position.set(0, 0, 0);
    const gr = makeBox(0.11, 0.36, 0.11, 0x6b3320); gr.position.set(0, 0.18, 0);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.06), wM);
    tip.position.set(0, -1.15, 0);
    swordGroup.add(bl, gu, gr, tip);
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
    window.gameState.equippedSet = element;
    window.gameState.thunderSet  = element === 'thunder';
    // damagePerHit determined server-side from inventory hasFullSet check
  }
  if (element) {
    Promise.all([
      _loadArtTexture(element, 'body'),
      _loadArtTexture(element, 'weapon'),
    ]).then(() => {
      if (activeElement === element && playerGroup) {
        _buildEquippedCharacter();
      }
    });
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
  // Safety: if scene not initialised, fire callbacks immediately so combatBusy never sticks
  if (!playerGroup) { if (onHitMoment) onHitMoment(); if (onDone) onDone(); return; }
  // STRICT SINGLE SLASH — always use 'default' clean forward chop (0.9s).
  // Elemental VFX is handled separately by scene.js after the hit moment.
  // Never use the old jump-slam / slide-uppercut / flame-wave anim types.
  const dur = 0.9;
  clearTimeout(window._combatSafetyTimer);
  window._combatSafetyTimer = setTimeout(() => {
    if (anim.active) {
      console.warn('[player] Combat safety timeout — releasing combatBusy');
      _resetAll(); anim.active = false;
      if (anim.onDone) { const cb = anim.onDone; anim.onDone = null; cb(); }
    }
  }, (dur + 1.5) * 1000);
  anim = { active:true, type:'default', t:0, duration: dur,
           onHit:onHitMoment||null, onDone:onDone||null,
           hitFired:false, _hitEmitted:false };
}

export function playRushMiss(onDone) {
  if (!playerGroup) { if (onDone) onDone(); return; }
  clearTimeout(window._combatSafetyTimer);
  window._combatSafetyTimer = setTimeout(() => {
    if (anim.active) {
      console.warn('[player] Combat safety timeout fired (miss) — releasing combatBusy');
      _resetAll(); anim.active = false;
      if (anim.onDone) { const cb = anim.onDone; anim.onDone = null; cb(); }
    }
  }, 2500);
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

    // Always use default slash — elemental anim types are retired
    switch (anim.type) {
      case 'default': _animDefault(prog, deltaTime); break;
      case 'miss':    _animMiss(prog, deltaTime);    break;
      // Legacy fallback — these should never trigger now
      case 'thunder': _animDefault(prog, deltaTime); break;
      case 'frost':   _animDefault(prog, deltaTime); break;
      case 'fire':    _animDefault(prog, deltaTime); break;
    }

    if (prog >= 1.0) { _resetAll(); anim.active = false; if (anim.onDone) anim.onDone(); }

  } else {
    // Idle bob
    playerGroup.position.x = HOME_X;
    playerGroup.position.y = HOME_Y + Math.sin(Date.now()*0.0018)*0.06;
    playerGroup.rotation.y = FACE_Y;
    if (leftArm)            leftArm.rotation.x            =  Math.sin(Date.now()*0.0015)*0.06;
    if (rightShoulderPivot) rightShoulderPivot.rotation.x = -Math.sin(Date.now()*0.0015)*0.06;
  }

  // ── Elemental sword glow pulse ─────────────────────────────────────────────
  if (swordGroup) {
    const now = Date.now();
    if (activeElement === 'thunder' && swordGroup._thunderBlade) {
      // Fast crackle flicker: rapid emissiveIntensity oscillation
      const flicker = 2.0 + 1.5 * Math.abs(Math.sin(now * 0.018));
      swordGroup._thunderBlade.forEach(m => {
        if (m.material) m.material.emissiveIntensity = flicker;
      });
    } else if (activeElement === 'fire' && swordGroup._fireBlade) {
      // Slow lava pulse
      const pulse = 1.8 + 0.6 * Math.sin(now * 0.003);
      if (swordGroup._fireBlade.material)  swordGroup._fireBlade.material.emissiveIntensity = pulse;
      if (swordGroup._fireTip?.material)   swordGroup._fireTip.material.emissiveIntensity   = pulse + 1.0;
    } else if (activeElement === 'frost' && swordGroup._iceBlade) {
      // Gentle ice shimmer
      const shimmer = 1.0 + 0.4 * Math.sin(now * 0.002);
      swordGroup._iceBlade.forEach(m => {
        if (m.material) m.material.emissiveIntensity = shimmer;
      });
    }
  }

  // Billboard custom character body plane to camera if present
  if (_characterBodyMesh && _characterBodyMesh.parent) {
    _characterBodyMesh.rotation.y = -playerGroup.rotation.y;
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
