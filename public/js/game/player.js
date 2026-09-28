// THREE is available as a global from the CDN script tag, GLTFLoader & DRACOLoader from three/addons
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

export const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

if (typeof window !== 'undefined' && window.THREE && !window.THREE.GLTFLoader) {
  window.THREE.GLTFLoader = GLTFLoader;
}

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
let rightArm = null;                // plain right arm mesh
let leftArm = null;                 // left arm ref
let leftShoulderPivot = null;       // shoulder joint Group (holds weapon on opposite hand)
let rightShoulderPivot = null;       // shoulder joint Group alias for backwards compatibility
let leftLeg, rightLeg;
let leftShoe, rightShoe;
let swordGroup = null;               // weapon, child of leftShoulderPivot

// Native 3D GLB Model state
let is3DModelMode = false;
let characterModel = null;           // Root scene of loaded character GLB
let characterRoot = null;            // THREE.Group containing characterModel
let weaponModel = null;              // Root scene of loaded weapon GLB
let weaponSocket = null;             // THREE.Group attached to character hand bone
let handNode = null;                 // Left-hand bone or arm node

// Universal Procedural Player Arm Pivot & Compound Limb Hierarchy
export let combatArmCompound = null;
export let playerArmPivot = null;
export function getCombatArmCompound() {
  return combatArmCompound || playerArmPivot || getWeaponHandNode();
}
export function getPlayerArmPivot() {
  return combatArmCompound || playerArmPivot || getWeaponHandNode();
}

// ── Visual Socket & Pivot Calibration Configuration ───────────────────────────
const DEFAULT_PLAYER_SOCKETS = {
  player: {
    shoulderX: -0.65,
    shoulderY: 1.2,
    shoulderZ: 0.0,
    shoulderPivot: { x: -0.65, y: 1.2, z: 0.0 },
    weapon: {
      offsetX: 0.0,
      offsetY: -0.4,
      offsetZ: 0.1,
      rotX: 0.0,
      rotY: 1.5708,
      rotZ: -0.7854,
      angle: -45
    },
    weaponOffset: {
      offsetX: 0.0,
      offsetY: -0.4,
      offsetZ: 0.1,
      rotX: 0.0,
      rotY: 1.5708,
      rotZ: -0.7854,
      angle: -45
    },
    slashArc: {
      idleAngle: 0,
      windupAngle: 60,
      slashAngle: -75,
      arc: 135
    },
    slashPoses: {
      pose1: { degX: 0, degY: 0, degZ: 60, rotX: 0, rotY: 0, rotZ: 1.0472 },
      pose2: { degX: 0, degY: 0, degZ: -75, rotX: 0, rotY: 0, rotZ: -1.309 },
      pose3: { degX: 0, degY: 0, degZ: 0, rotX: 0, rotY: 0, rotZ: 0 }
    },
    default: { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    thunder: { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    fire:    { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    frost:   { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
  },
  weapon: {
    player_sword: { hiltX: 0.0, hiltY: -0.5, hiltZ: 0.0 },
  }
};

let _socketsConfig = JSON.parse(JSON.stringify(DEFAULT_PLAYER_SOCKETS));

export async function loadSocketsConfig() {
  try {
    const res = await fetch('/api/admin/sockets');
    if (res.ok) {
      const data = await res.json();
      if (data && data.sockets) {
        _socketsConfig = data.sockets;
      }
    }
  } catch (e) {
    // fallback to defaults
  }
  return _socketsConfig;
}

if (typeof window !== 'undefined') {
  loadSocketsConfig();
  window.addEventListener('sockets-updated', (ev) => {
    if (ev.detail) {
      _socketsConfig = ev.detail;
      if (playerGroup && activeElement !== undefined) {
        createPlayerMesh(activeElement, window.gameState?.equipment);
      }
    }
  });
}

// 2.5D Sprite Mesh state & Skeletal Rigging state (Meta Animated Drawings style)
let is2DMode = false;
let isSkinned2DMode = false;
let skinnedCharacterMesh = null;     // THREE.SkinnedMesh
let skinnedSkeleton = null;          // THREE.Skeleton
let skinnedBones = null;             // Bone map { hip, torso, neck, head, l_shoulder, l_elbow, l_hand, r_shoulder, r_elbow, r_hand, l_knee, l_foot, r_knee, r_foot }
let bodyMesh = null;                 // THREE.Mesh / THREE.SkinnedMesh (PlaneGeometry 2.4 x 3.2)
let weaponMesh = null;               // THREE.Mesh (PlaneGeometry 0.85 x 2.2)
let weaponArmPivot = null;           // THREE.Group attached at hand / r_hand
let _skeletonConfig = null;

const DEFAULT_SKELETON_CONFIG = {
  nodes: {
    head: { x: 0.5, y: 0.1 },
    neck: { x: 0.5, y: 0.2 },
    torso: { x: 0.5, y: 0.5 },
    l_shoulder: { x: 0.3, y: 0.25 },
    l_elbow: { x: 0.2, y: 0.4 },
    l_hand: { x: 0.1, y: 0.5 },
    r_shoulder: { x: 0.7, y: 0.25 },
    r_elbow: { x: 0.8, y: 0.4 },
    r_hand: { x: 0.9, y: 0.5 },
    hip: { x: 0.5, y: 0.7 },
    l_knee: { x: 0.4, y: 0.85 },
    l_foot: { x: 0.4, y: 1.0 },
    r_knee: { x: 0.6, y: 0.85 },
    r_foot: { x: 0.6, y: 1.0 }
  },
  links: [
    ['head', 'neck'],
    ['neck', 'torso'],
    ['torso', 'hip'],
    ['neck', 'l_shoulder'],
    ['l_shoulder', 'l_elbow'],
    ['l_elbow', 'l_hand'],
    ['neck', 'r_shoulder'],
    ['r_shoulder', 'r_elbow'],
    ['r_elbow', 'r_hand'],
    ['hip', 'l_knee'],
    ['l_knee', 'l_foot'],
    ['hip', 'r_knee'],
    ['r_knee', 'r_foot']
  ]
};

export async function _getSkeletonConfig() {
  if (_skeletonConfig) return _skeletonConfig;
  try {
    const res = await fetch('/api/skeleton');
    if (res.ok) {
      const data = await res.json();
      if (data && data.nodes) {
        _skeletonConfig = data;
        return _skeletonConfig;
      }
    }
  } catch (e) {
    // fallback
  }
  _skeletonConfig = DEFAULT_SKELETON_CONFIG;
  return _skeletonConfig;
}

if (typeof window !== 'undefined') {
  window.addEventListener('skeleton-updated', (ev) => {
    if (ev.detail) {
      _skeletonConfig = ev.detail;
      if (playerGroup && activeElement !== undefined) {
        createPlayerMesh(activeElement, window.gameState?.equipment);
      }
    }
  });
}

const WEAPON_HAND_POS = { x: -0.6, y: 0.9, z: 0.1 };
const WEAPON_READY_ROT_Z = Math.PI / 6; // blade pointing forward/upward in ready combat stance

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
  createPlayerMesh(activeElement, window.gameState?.equipment);
}

function _build3DBoxCharacter() {
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

  // ── Left arm — shoulder pivot rig (holds weapon on opposite hand) ─────────
  //   leftShoulderPivot sits at shoulder joint (top-left of torso)
  //   Rotating pivot.rotation swings the whole arm+sword facing the arena/boss
  leftShoulderPivot = new THREE.Group();
  leftShoulderPivot.position.set(-0.65, 1.8, 0);   // shoulder position on opposite side

  const lArmGeo = new THREE.BoxGeometry(0.34,0.9,0.34);
  lArmGeo.translate(0, -0.45, 0);
  const lArmMesh = new THREE.Mesh(lArmGeo, new THREE.MeshLambertMaterial({ color: SKIN_TONE }));
  leftShoulderPivot.add(lArmMesh);

  // Weapon attached at hand (bottom of arm, y = -0.9)
  _buildSword();   // creates swordGroup and adds to leftShoulderPivot

  playerGroup.leftArmPivot = leftShoulderPivot;
  playerGroup.rightArmPivot = leftShoulderPivot;  // alias

  // ── Right arm (plain — no weapon) ─────────────────────────────────────────
  const rArmGeo = new THREE.BoxGeometry(0.34,0.9,0.34);
  rArmGeo.translate(0, -0.45, 0);
  rightArm = new THREE.Mesh(rArmGeo, new THREE.MeshLambertMaterial({ color: SKIN_TONE }));
  rightArm.position.set(0.65, 1.8, 0);

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
  playerGroup.add(headMesh, torsoMesh, rightArm, leftShoulderPivot,
                  leftLeg, rightLeg);

  // ── Elemental aura ────────────────────────────────────────────────────────
  if (activeElement) _buildElementalAura(activeElement);

}

// ─────────────────────────────────────────────────────────────────────────────
// 2.5D SPRITE CHARACTER BUILDER & ART SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const _artCache = {
  thunder: { body: null, weapon: null },
  fire:    { body: null, weapon: null },
  frost:   { body: null, weapon: null },
};

/**
 * Chroma-key: removes near-white backgrounds from images
 */
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
      d[i + 3] = 0; // Transparent
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
}

/**
 * Load body or weapon texture from /assets/characters/${element}_${type}.png
 */
function _loadArtTexture(element, type) {
  return new Promise((resolve) => {
    if (!element || !['thunder', 'fire', 'frost', 'default'].includes(element)) return resolve(null);
    if (!['body', 'weapon'].includes(type)) return resolve(null);

    if (_artCache[element]?.[type]) return resolve(_artCache[element][type]);

    const urls = [
      `/assets/characters/${element}_${type}.png`,
    ];
    if (type === 'body') {
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
        console.log(`[player] Loaded ${element}_${type} texture`);
        resolve(tex);
      } catch (err) {
        console.warn(`[player] Texture processing error for ${element}_${type}:`, err);
        tryNext();
      }
    };
    img.onerror = tryNext;
    tryNext();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D GLB/GLTF MODEL LOADER & BONE SOCKETING SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const _modelCache = {
  default: { character: null, weapon: null },
  thunder: { character: null, weapon: null },
  fire:    { character: null, weapon: null },
  frost:   { character: null, weapon: null },
};

function _findHandBone(root, side = 'left') {
  if (!root) return null;
  const isLeft = (side === 'left');
  const candidateNames = isLeft ? [
    'LeftHand', 'Hand_L', 'mixamorigLeftHand', 'mixamorig:LeftHand',
    'hand.L', 'Left_Hand', 'hand_l', 'leftHandBone', 'LeftHandAttachment',
    'Hand.L', 'LeftArm', 'Arm_L', 'mixamorigLeftArm', 'mixamorig:LeftArm'
  ] : [
    'RightHand', 'Hand_R', 'mixamorigRightHand', 'mixamorig:RightHand',
    'hand.R', 'Right_Hand', 'hand_r', 'rightHandBone', 'RightHandAttachment',
    'Hand.R', 'RightArm', 'Arm_R'
  ];
  for (const name of candidateNames) {
    const obj = root.getObjectByName(name);
    if (obj) return obj;
  }
  let found = null;
  root.traverse((child) => {
    if (found) return;
    const n = (child.name || '').toLowerCase();
    if (isLeft) {
      if (n.includes('lefthand') || n.includes('hand_l') || n.includes('hand.l') ||
          (n.includes('hand') && (n.includes('left') || n.endsWith('_l') || n.endsWith('.l')))) {
        found = child;
      }
    } else {
      if (n.includes('righthand') || n.includes('hand_r') || n.includes('hand.r') ||
          (n.includes('hand') && (n.includes('right') || n.endsWith('_r') || n.endsWith('.r')))) {
        found = child;
      }
    }
  });
  return found;
}

function _loadGLTFModel(url) {
  return new Promise((resolve) => {
    try {
      gltfLoader.load(
        url,
        (gltf) => {
          console.log('[player] Successfully loaded 3D model:', url);
          resolve(gltf);
        },
        undefined,
        () => resolve(null) // Return null on 404/failure without error
      );
    } catch (e) {
      console.warn('[player] GLTFLoader error for', url, e);
      resolve(null);
    }
  });
}

/**
 * Loads a 3D GLB Character and sockets its weapon into RightHand node
 */
async function _tryLoad3DCharacterAndWeapon(elementKey) {
  const el = elementKey || 'default';

  // Load Character model
  let charGltf = await _loadGLTFModel(`/assets/models/${el}_character.glb`);
  if (!charGltf) {
    charGltf = await _loadGLTFModel(`/assets/models/${el}_character.gltf`);
  }
  if (!charGltf && el !== 'default') {
    // If elemental 3D model not found, try fallback to default 3D model
    charGltf = await _loadGLTFModel(`/assets/models/default_character.glb`) ||
               await _loadGLTFModel(`/assets/models/default_character.gltf`);
  }
  if (!charGltf || !charGltf.scene) return false;

  is3DModelMode = true;
  playerGroup.rotation.set(0, 0, 0);
  playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);

  characterRoot = new THREE.Group();
  characterRoot.name = 'CharacterRoot';

  characterModel = charGltf.scene.clone(true);
  characterModel.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  // Normalize character model scale to ~2.8 units height
  const bBox = new THREE.Box3().setFromObject(characterModel);
  const bSize = new THREE.Vector3();
  bBox.getSize(bSize);
  if (bSize.y > 0.01) {
    const targetHeight = 2.8;
    const scaleFactor = targetHeight / bSize.y;
    characterModel.scale.setScalar(scaleFactor);
  }

  // Center horizontally and align base/feet at y = 0
  const scaledBox = new THREE.Box3().setFromObject(characterModel);
  characterModel.position.x = - (scaledBox.min.x + scaledBox.max.x) / 2;
  characterModel.position.z = - (scaledBox.min.z + scaledBox.max.z) / 2;
  characterModel.position.y = - scaledBox.min.y;

  // Face towards Boss on the right (+X)
  characterRoot.rotation.y = Math.PI / 2;
  characterRoot.add(characterModel);
  playerGroup.add(characterRoot);

  // Load 3D Weapon Model (try element weapon, then default weapon)
  const weapEl = window.gameState?.equipped?.weapon || el;
  let weapGltf = await _loadGLTFModel(`/assets/models/${weapEl}_weapon.glb`);
  if (!weapGltf) {
    weapGltf = await _loadGLTFModel(`/assets/models/${weapEl}_weapon.gltf`);
  }
  if (!weapGltf && weapEl !== 'default') {
    weapGltf = await _loadGLTFModel(`/assets/models/default_weapon.glb`) ||
               await _loadGLTFModel(`/assets/models/default_weapon.gltf`);
  }

  // Read compound limb and weapon transform configuration
  const savedPivot = _socketsConfig?.player || {};
  const sPivot = savedPivot.shoulderPivot || {};
  const shoulderX = sPivot.x ?? savedPivot.shoulderX ?? (savedPivot.default?.handX ? -Math.abs(savedPivot.default.handX) : -0.65);
  const shoulderY = sPivot.y ?? savedPivot.shoulderY ?? (savedPivot.default?.handY ?? 1.2);
  const shoulderZ = sPivot.z ?? savedPivot.shoulderZ ?? (savedPivot.default?.handZ ?? 0.0);

  const savedWeapon = savedPivot.weaponOffset || savedPivot.weapon || {};
  const wOffsetX = savedWeapon.offsetX ?? 0.0;
  const wOffsetY = savedWeapon.offsetY ?? -0.4;
  const wOffsetZ = savedWeapon.offsetZ ?? 0.1;
  const wAngle = savedWeapon.angle ?? (savedPivot[el]?.weaponAngle ?? -45);
  const wRotX = savedWeapon.rotX ?? 0.0;
  const wRotY = savedWeapon.rotY ?? (Math.PI / 2);
  const wRotZ = savedWeapon.rotZ ?? ((wAngle * Math.PI) / 180);

  // Compound arm container centered at calibrated shoulderPivot
  combatArmCompound = new THREE.Group();
  combatArmCompound.name = 'PlayerCombatArmCompound';
  combatArmCompound.position.set(shoulderX, shoulderY, shoulderZ);
  const initialIdleAngle = ((savedPivot.slashArc?.idleAngle ?? 0) * Math.PI) / 180;
  combatArmCompound.rotation.set(0, 0, initialIdleAngle);
  playerArmPivot = combatArmCompound;

  if (weapGltf && weapGltf.scene) {
    weaponModel = weapGltf.scene.clone(true);
    weaponModel.traverse((c) => {
      if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
    });

    // Scale weapon to match blocky character proportions
    weaponModel.scale.set(2.2, 2.2, 2.2);

    const scaledBox = new THREE.Box3().setFromObject(weaponModel);
    const localHiltX = - (scaledBox.min.x + scaledBox.max.x) / 2;
    const localHiltY = - scaledBox.min.y;
    const localHiltZ = - (scaledBox.min.z + scaledBox.max.z) / 2;

    // Mount weapon as locked child with saved local offset (blade tip points towards Boss +X)
    weaponModel.position.set(localHiltX + wOffsetX, localHiltY + wOffsetY, localHiltZ + wOffsetZ);
    weaponModel.rotation.set(wRotX, wRotY, wRotZ);

    combatArmCompound.add(weaponModel);
  } else {
    // Fallback procedural blade
    const bladeColor = el === 'fire' ? 0xff4400 : el === 'frost' ? 0x88ddff : el === 'thunder' ? 0x00cfff : 0xddaa33;
    const blade = makeBox(0.2, 2.2, 0.12, bladeColor);
    blade.position.set(wOffsetX, 0.8 + wOffsetY, wOffsetZ);
    blade.rotation.set(wRotX, wRotY, wRotZ);
    combatArmCompound.add(blade);
  }

  // Attach combatArmCompound directly to playerGroup
  playerGroup.add(combatArmCompound);
  weaponSocket = combatArmCompound;
  console.log(`[player] Unified combatArmCompound mounted at (${shoulderX.toFixed(2)}, ${shoulderY.toFixed(2)}, ${shoulderZ.toFixed(2)}) with weapon offset (${wOffsetX}, ${wOffsetY}, ${wOffsetZ}) at ${wAngle}°`);

  if (activeElement) _buildElementalAura(activeElement);
  console.log(`[player] 3D GLB model loaded & socketed for ${el}`);
  return true;
}

/**
 * 2D Skeletal SkinnedMesh Builder (Meta Animated Drawings style)
 * Creates a dense PlaneGeometry (16x16 segments) deformed by a 14-bone skeleton hierarchy.
 * Uses Linear Blend Skinning (LBS) assigning skinIndex and skinWeight based on inverse distance.
 */
export async function build2DSkinnedMesh(bodyTexture, weaponTexture, targetEl) {
  const skel = await _getSkeletonConfig();
  const nodes = { ...DEFAULT_SKELETON_CONFIG.nodes, ...(skel?.nodes || {}) };

  const width = 2.4;
  const height = 3.2;

  // 1. Create dense plane geometry (16x16 segments for smooth bone bending)
  const geometry = new THREE.PlaneGeometry(width, height, 16, 16);

  // 2. Bone hierarchy keys
  const BONE_KEYS = [
    'hip',
    'torso',
    'neck',
    'head',
    'l_shoulder',
    'l_elbow',
    'l_hand',
    'r_shoulder',
    'r_elbow',
    'r_hand',
    'l_knee',
    'l_foot',
    'r_knee',
    'r_foot'
  ];

  // Map 2D normalized coordinates (0..1) to local 3D Plane coordinates (-width/2..width/2, height/2..-height/2)
  const boneLocs = {};
  for (const k of BONE_KEYS) {
    const n = nodes[k] || DEFAULT_SKELETON_CONFIG.nodes[k] || { x: 0.5, y: 0.5 };
    boneLocs[k] = {
      x: (n.x - 0.5) * width,
      y: (0.5 - n.y) * height,
      z: 0
    };
  }

  // Create THREE.Bone instances
  const boneMap = {};
  const bonesArray = [];
  for (const k of BONE_KEYS) {
    const bone = new THREE.Bone();
    bone.name = 'Bone_' + k;
    boneMap[k] = bone;
    bonesArray.push(bone);
  }

  // Assemble hierarchy rooted at hip:
  boneMap.hip.position.set(boneLocs.hip.x, boneLocs.hip.y, 0);

  function attachChild(parentKey, childKey) {
    const pBone = boneMap[parentKey];
    const cBone = boneMap[childKey];
    cBone.position.set(
      boneLocs[childKey].x - boneLocs[parentKey].x,
      boneLocs[childKey].y - boneLocs[parentKey].y,
      0
    );
    pBone.add(cBone);
  }

  // Spine & Head
  attachChild('hip', 'torso');
  attachChild('torso', 'neck');
  attachChild('neck', 'head');

  // Left Arm
  attachChild('neck', 'l_shoulder');
  attachChild('l_shoulder', 'l_elbow');
  attachChild('l_elbow', 'l_hand');

  // Right Arm (Weapon Arm facing Boss)
  attachChild('neck', 'r_shoulder');
  attachChild('r_shoulder', 'r_elbow');
  attachChild('r_elbow', 'r_hand');

  // Left Leg
  attachChild('hip', 'l_knee');
  attachChild('l_knee', 'l_foot');

  // Right Leg
  attachChild('hip', 'r_knee');
  attachChild('r_knee', 'r_foot');

  // 3. Compute Linear Blend Skinning (LBS) for all vertices using 4 closest bones
  const posAttr = geometry.attributes.position;
  const skinIndices = [];
  const skinWeights = [];

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);

    // Compute distance to each bone rest position in plane space
    const distList = [];
    for (let b = 0; b < BONE_KEYS.length; b++) {
      const k = BONE_KEYS[b];
      const loc = boneLocs[k];
      const d = Math.hypot(vx - loc.x, vy - loc.y);
      distList.push({ index: b, dist: d });
    }

    // Sort ascending by distance
    distList.sort((a, b) => a.dist - b.dist);

    // Top 4 bones
    const top4 = distList.slice(0, 4);
    let totalWeight = 0;
    const rawWeights = [];
    for (let j = 0; j < 4; j++) {
      const clampedDist = Math.max(top4[j].dist, 0.08);
      const w = 1.0 / Math.pow(clampedDist, 2.2);
      rawWeights.push(w);
      totalWeight += w;
    }

    if (totalWeight <= 0) totalWeight = 1.0;
    for (let j = 0; j < 4; j++) {
      skinIndices.push(top4[j].index);
      skinWeights.push(rawWeights[j] / totalWeight);
    }
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  // 4. Skinned Material & Mesh binding
  const material = new THREE.MeshBasicMaterial({
    map: bodyTexture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    alphaTest: 0.05
  });

  const skinnedMesh = new THREE.SkinnedMesh(geometry, material);
  skinnedMesh.add(boneMap.hip);
  skinnedMesh.updateMatrixWorld(true);

  const skeleton = new THREE.Skeleton(bonesArray);
  skeleton.calculateInverses();
  skinnedMesh.bind(skeleton);

  // 5. Attach Weapon directly to r_hand bone so it naturally follows arm movement
  const weaponMount = new THREE.Group();
  weaponMount.name = 'SkinnedWeaponMount';

  if (weaponTexture) {
    const wGeo = new THREE.PlaneGeometry(0.85, 2.2);
    wGeo.translate(0, 0.95, 0); // blade extends from hand hilt
    const wMat = new THREE.MeshBasicMaterial({
      map: weaponTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      alphaTest: 0.05
    });
    const wMesh = new THREE.Mesh(wGeo, wMat);
    // Orient weapon blade forward toward Boss (+X)
    wMesh.position.set(0.05, 0, 0.05);
    wMesh.rotation.set(0, 0, -Math.PI / 4);
    weaponMount.add(wMesh);
  } else {
    // Procedural fallback blade
    const bladeColor = targetEl === 'fire' ? 0xff4400 : targetEl === 'frost' ? 0x88ddff : targetEl === 'thunder' ? 0x00cfff : 0xddaa33;
    const blade = makeBox(0.12, 1.6, 0.08, bladeColor);
    blade.position.set(0.2, 0.6, 0.05);
    blade.rotation.set(0, 0, -Math.PI / 4);
    weaponMount.add(blade);
  }

  boneMap.r_hand.add(weaponMount);

  return {
    skinnedMesh,
    skeleton,
    bones: boneMap,
    weaponMount
  };
}

/**
 * Main Player Mesh Constructor:
 * Priority 1: Native 3D GLTF/GLB models with Bone Socketing ([element]_character.glb & [element]_weapon.glb)
 * Priority 2: 2D Skeletal SkinnedMesh from uploaded art ([element]_body.png & [element]_weapon.png)
 * Priority 3: Admin Default 3D Model (default_character.glb & default_weapon.glb)
 * Priority 4: Procedural 3D Voxel Box Model (fallback if default 3D model not uploaded yet)
 */
export async function createPlayerMesh(element, equippedGear) {
  if (!playerGroup) return;
  const targetEl = element || activeElement;

  // Clear existing meshes & state
  while (playerGroup.children.length) playerGroup.remove(playerGroup.children[0]);
  headMesh = hatMesh = torsoMesh = pantsMesh = null;
  leftArm = null; rightShoulderPivot = null; swordGroup = null;
  leftLeg = rightLeg = null; leftShoe = rightShoe = null;
  elementalAura = null; elementalParticles = [];
  bodyMesh = null; weaponMesh = null; weaponArmPivot = null; playerArmPivot = null;
  characterModel = null; characterRoot = null; weaponModel = null; weaponSocket = null; handNode = null;
  is3DModelMode = false;
  is2DMode = false;
  isSkinned2DMode = false;
  skinnedCharacterMesh = null;
  skinnedSkeleton = null;
  skinnedBones = null;

  // Case A: Specific Elemental Set equipped ('thunder' | 'fire' | 'frost')
  if (targetEl && targetEl !== 'default') {
    // 1. Native 3D Elemental GLB Model
    const loaded3D = await _tryLoad3DCharacterAndWeapon(targetEl);
    if (loaded3D) return;

    // 2. 2D Skeletal SkinnedMesh (if custom 2D art exists)
    const [bTex, wTex] = await Promise.all([
      _loadArtTexture(targetEl, 'body'),
      _loadArtTexture(targetEl, 'weapon'),
    ]);

    if (bTex) {
      is2DMode = true;
      isSkinned2DMode = true;
      playerGroup.rotation.y = 0; // Face camera in 2D mode
      playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);

      try {
        const skinnedRig = await build2DSkinnedMesh(bTex, wTex, targetEl);
        skinnedCharacterMesh = skinnedRig.skinnedMesh;
        skinnedSkeleton = skinnedRig.skeleton;
        skinnedBones = skinnedRig.bones;
        bodyMesh = skinnedCharacterMesh;
        weaponArmPivot = skinnedRig.weaponMount;
        playerArmPivot = skinnedBones.r_shoulder;

        skinnedCharacterMesh.position.set(0, 0, 0);
        skinnedCharacterMesh.rotation.y = Math.PI / 6; // Angled 30° toward the Boss on the right
        playerGroup.add(skinnedCharacterMesh);

        if (activeElement) _buildElementalAura(activeElement);
        console.log(`[player] 2D SkinnedMesh constructed with 14 bones for ${targetEl}`);
        return;
      } catch (err) {
        console.warn(`[player] Failed to build 2D SkinnedMesh for ${targetEl}, falling back:`, err);
      }
    }
  }

  // Case B: No Elemental Set equipped (or 'default' active) -> Load Admin's Default 3D Model
  const loadedDefault3D = await _tryLoad3DCharacterAndWeapon('default');
  if (loadedDefault3D) return;

  // Check if 2D default art exists
  const [defBTex, defWTex] = await Promise.all([
    _loadArtTexture('default', 'body'),
    _loadArtTexture('default', 'weapon'),
  ]);
  if (defBTex) {
    is2DMode = true;
    isSkinned2DMode = true;
    playerGroup.rotation.y = 0;
    playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);

    try {
      const skinnedRig = await build2DSkinnedMesh(defBTex, defWTex, 'default');
      skinnedCharacterMesh = skinnedRig.skinnedMesh;
      skinnedSkeleton = skinnedRig.skeleton;
      skinnedBones = skinnedRig.bones;
      bodyMesh = skinnedCharacterMesh;
      weaponArmPivot = skinnedRig.weaponMount;
      playerArmPivot = skinnedBones.r_shoulder;

      skinnedCharacterMesh.position.set(0, 0, 0);
      skinnedCharacterMesh.rotation.y = Math.PI / 6;
      playerGroup.add(skinnedCharacterMesh);

      console.log(`[player] 2D SkinnedMesh constructed with 14 bones for default`);
      return;
    } catch (err) {
      console.warn('[player] Failed to build default 2D SkinnedMesh:', err);
    }
  }

  // 3. Fallback: Only render basic geometric boxes if default_character.glb has not been uploaded yet
  is2DMode = false;
  isSkinned2DMode = false;
  playerGroup.rotation.y = FACE_Y;
  _build3DBoxCharacter();
  playerArmPivot = leftShoulderPivot || rightShoulderPivot;
}

// Hot-reload listener for admin uploads
if (typeof window !== 'undefined') {
  const onArtUpdated = (ev) => {
    const { element, type } = ev.detail || {};
    if (!element) return;
    if (_artCache[element]) {
      if (type) _artCache[element][type] = null;
      else _artCache[element] = { body: null, weapon: null };
    }
    createPlayerMesh(activeElement, window.gameState?.equipment);
  };
  window.addEventListener('character-art-updated', onArtUpdated);
  window.addEventListener('character-image-updated', onArtUpdated);
  window.addEventListener('character-model-updated', onArtUpdated);

  // Pre-load existing textures on startup
  ['thunder', 'fire', 'frost'].forEach(el => {
    _loadArtTexture(el, 'body');
    _loadArtTexture(el, 'weapon');
  });
}





// ─── Sword builder ────────────────────────────────────────────────────────────
function _buildSword() {
  swordGroup = new THREE.Group();
  const savedPivot = _socketsConfig?.player || {};
  const savedWeapon = savedPivot.weaponOffset || savedPivot.weapon || {};
  const wOffsetX = savedWeapon.offsetX ?? 0.0;
  const wOffsetY = savedWeapon.offsetY ?? -0.4;
  const wOffsetZ = savedWeapon.offsetZ ?? 0.1;
  const wAngle = savedWeapon.angle ?? -45;
  const wRotX = savedWeapon.rotX ?? 0.0;
  const wRotY = savedWeapon.rotY ?? (Math.PI / 2);
  const wRotZ = savedWeapon.rotZ ?? ((wAngle * Math.PI) / 180);

  swordGroup.position.set(wOffsetX, -0.9 + wOffsetY, wOffsetZ);
  swordGroup.rotation.set(wRotX, wRotY, wRotZ);
  swordGroup.scale.set(1.6, 1.6, 1.6);

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
    swordGroup.add(customSword);
    swordGroup._customWeapon = customSword;
    if (leftShoulderPivot) leftShoulderPivot.add(swordGroup);
    else if (rightShoulderPivot) rightShoulderPivot.add(swordGroup);
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

  if (leftShoulderPivot) leftShoulderPivot.add(swordGroup);
  else if (rightShoulderPivot) rightShoulderPivot.add(swordGroup);
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
  createPlayerMesh(element, window.gameState?.equipment);
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

// ─────────────────────────────────────────────────────────────────────────────
// Dedicated Sword Slashing Arm Motion Tween (slashMotion)
// ─────────────────────────────────────────────────────────────────────────────
const _activeTweens = [];

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
    _activeTweens.push(this);
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

export const TWEEN = {
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
    for (let i = _activeTweens.length - 1; i >= 0; i--) {
      if (_activeTweens[i].update(now)) {
        _activeTweens.splice(i, 1);
      }
    }
  },
  removeAll() {
    _activeTweens.length = 0;
  }
};
if (typeof window !== 'undefined') window.TWEEN = TWEEN;

export function getWeaponHandNode() {
  if (isSkinned2DMode && skinnedBones?.r_shoulder) {
    return skinnedBones.r_shoulder;
  }
  if (combatArmCompound) {
    return combatArmCompound;
  }
  if (playerArmPivot) {
    return playerArmPivot;
  }
  if (is3DModelMode) {
    return handNode || weaponSocket;
  }
  if (is2DMode) {
    return weaponArmPivot;
  }
  return leftShoulderPivot || rightShoulderPivot;
}

/**
 * 2D Skeletal Slash Animation (Meta Animated Drawings style)
 * Animates r_shoulder and r_elbow bones with forward slashing arc.
 * Weapon mounted to r_hand naturally traces the full swinging path.
 */
export function slashAnimation(onHit, onComplete) {
  let hitCalled = false;
  let completeCalled = false;
  const safeOnHit = () => {
    if (!hitCalled) {
      hitCalled = true;
      if (onHit) onHit();
    }
  };
  const safeOnComplete = () => {
    if (!completeCalled) {
      completeCalled = true;
      safeOnHit();
      if (onComplete) onComplete();
    }
  };

  const rShoulder = skinnedBones?.r_shoulder;
  const rElbow = skinnedBones?.r_elbow;

  if (!rShoulder || !rElbow) {
    safeOnComplete();
    return;
  }

  const safetyTimer = setTimeout(() => {
    console.warn('[player] Skeletal slash animation safety timeout');
    safeOnComplete();
  }, 600);

  // Phase 1: Wind-up (Giương kiếm) - 90ms: shoulder swings back/up, elbow flexes
  new TWEEN.Tween(rShoulder.rotation)
    .to({ z: 0.95 }, 90)
    .easing(TWEEN.Easing.Quadratic.Out)
    .start();

  new TWEEN.Tween(rElbow.rotation)
    .to({ z: 0.65 }, 90)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onComplete(() => {
      // Phase 2: Slash Strike (Chém bổ cực mạnh) - 120ms: shoulder whips forward/down, elbow extends
      new TWEEN.Tween(rShoulder.rotation)
        .to({ z: -1.25 }, 120)
        .easing(TWEEN.Easing.Quadratic.In)
        .start();

      new TWEEN.Tween(rElbow.rotation)
        .to({ z: -0.25 }, 120)
        .easing(TWEEN.Easing.Quadratic.In)
        .onComplete(() => {
          safeOnHit();

          // Phase 3: Recover (Thu kiếm về thế thủ) - 100ms: return to base rotation
          new TWEEN.Tween(rShoulder.rotation)
            .to({ z: 0 }, 100)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();

          new TWEEN.Tween(rElbow.rotation)
            .to({ z: 0 }, 100)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
              clearTimeout(safetyTimer);
              safeOnComplete();
            })
            .start();
        })
        .start();
    })
    .start();
}

/**
 * Bulletproof 3-Pose Slash Motion (playGuaranteedPlayerSlash):
 * - If 2D Skeletal Rig is active -> delegates to slashAnimation()
 * - Otherwise:
 *   - Pose 1: Wind-up (Giương kiếm) -> 80ms (Quadratic.Out)
 *   - Pose 2: Strike Impact (Chém trúng) -> 120ms (Quadratic.In) -> triggers onHit()
 *   - Pose 3: Idle Guard (Thu kiếm về thế thủ) -> 100ms (Quadratic.Out) -> triggers onComplete()
 */
export function playGuaranteedPlayerSlash(arg1, arg2, arg3) {
  let pivot = combatArmCompound || playerArmPivot || getWeaponHandNode();
  let onHit = null;
  let onComplete = null;

  if (arg1 && (arg1.isObject3D || arg1.rotation)) {
    pivot = arg1;
    onHit = arg2;
    onComplete = arg3;
  } else {
    onHit = arg1;
    onComplete = arg2;
  }

  let hitCalled = false;
  let completeCalled = false;
  const safeOnHit = () => {
    if (!hitCalled) {
      hitCalled = true;
      if (onHit) onHit();
    }
  };
  const safeOnComplete = () => {
    if (!completeCalled) {
      completeCalled = true;
      safeOnHit();
      if (onComplete) onComplete();
    }
  };

  // If 2D skeletal skinned mesh is active, execute skeletal slash animation directly!
  if (isSkinned2DMode && skinnedBones?.r_shoulder) {
    return slashAnimation(safeOnHit, safeOnComplete);
  }

  if (!pivot) {
    safeOnComplete();
    return;
  }

  // Safety fallback timer to prevent combat turn from ever locking
  const safetyTimer = setTimeout(() => {
    console.warn('[player] Slash animation safety timeout triggered');
    safeOnComplete();
  }, 600);

  const poses = _socketsConfig?.player?.slashPoses || _socketsConfig?.player?.slashKeyframes || {};

  // Built-in fallback swing values in radians if custom poses do not exist
  const FALLBACK_POSES = {
    pose1: { x: -0.5, y: 0, z: 0.8 },
    pose2: { x: 0.6, y: 0, z: -1.0 },
    pose3: { x: 0, y: 0, z: -0.3 },
  };

  const getPoseRot = (p, fallback) => {
    if (!p || (p.x === undefined && p.rotX === undefined && p.degX === undefined && p.z === undefined && p.rotZ === undefined && p.degZ === undefined)) {
      return { ...fallback };
    }
    const rx = p.rotX ?? (p.x !== undefined ? p.x : ((p.degX ?? 0) * Math.PI / 180));
    const ry = p.rotY ?? (p.y !== undefined ? p.y : ((p.degY ?? 0) * Math.PI / 180));
    const rz = p.rotZ ?? (p.z !== undefined ? p.z : ((p.degZ ?? 0) * Math.PI / 180));
    return { x: rx, y: ry, z: rz };
  };

  const rotPose1 = getPoseRot(poses.pose1, FALLBACK_POSES.pose1);
  const rotPose2 = getPoseRot(poses.pose2, FALLBACK_POSES.pose2);
  const rotPose3 = getPoseRot(poses.pose3, FALLBACK_POSES.pose3);

  // Phase 1: Wind-up (Giương kiếm) - 80ms
  new TWEEN.Tween(pivot.rotation)
    .to(rotPose1, 80)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onComplete(() => {
      // Phase 2: Slash Strike (Chém bổ trúng) - 120ms -> Deal damage
      new TWEEN.Tween(pivot.rotation)
        .to(rotPose2, 120)
        .easing(TWEEN.Easing.Quadratic.In)
        .onComplete(() => {
          safeOnHit();

          // Phase 3: Recover / Idle Guard (Thu kiếm về thế thủ) - 100ms
          new TWEEN.Tween(pivot.rotation)
            .to(rotPose3, 100)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
              clearTimeout(safetyTimer);
              safeOnComplete();
            })
            .start();
        })
        .start();
    })
    .start();
}
export const playArmSwingSlash = playGuaranteedPlayerSlash;
export const playSwordSlashAnimation = playGuaranteedPlayerSlash;
export function playDodge(onDone) {
  if (!playerGroup) { if (onDone) onDone(); return; }
  clearTimeout(window._combatSafetyTimer);
  window._combatSafetyTimer = setTimeout(() => {
    if (anim.active && anim.type === 'dodge') {
      console.warn('[player] Combat safety timeout — releasing dodge');
      _resetAll();
      const cb = anim.onDone;
      anim.active = false;
      anim.onDone = null;
      if (cb) cb();
    }
  }, 1200);

  anim = {
    active: true,
    type: 'dodge',
    t: 0,
    duration: 0.45,
    onHit: null,
    onDone: onDone || null,
    hitFired: false,
    _hitEmitted: false,
  };
}
export function playPunch()        { playAttack(null,null); }

// ─────────────────────────────────────────────────────────────────────────────
// COMBAT — 4 distinct animation sequences
// ─────────────────────────────────────────────────────────────────────────────
export function playCombatAnimation(type = 'normal', { onHit, onDone } = {}) {
  if (!playerGroup) { if (onHit) onHit(); if (onDone) onDone(); return; }
  const durations = { normal: 0.73, default: 0.73, thunder: 0.81, fire: 0.55, frost: 0.55 };
  const dur = durations[type] || 0.73;

  clearTimeout(window._combatSafetyTimer);
  window._combatSafetyTimer = setTimeout(() => {
    if (anim.active) {
      console.warn('[player] Combat safety timeout — releasing combatBusy');
      _resetAll();
      const cb = anim.onDone;
      anim.active = false;
      anim.onDone = null;
      if (cb) cb();
    }
  }, (dur + 1.5) * 1000);

  anim = { active: true, type, t: 0, duration: dur,
           onHit: onHit || null, onDone: onDone || null,
           hitFired: false, _hitEmitted: false, _slashTriggered: false };
}

export function playAttack(onHitMoment, onDone) {
  playCombatAnimation('normal', { onHit: onHitMoment, onDone });
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

export function playHurt(onDone) {
  if (!playerGroup) { if (onDone) onDone(); return; }
  if (is3DModelMode) {
    if (characterModel) {
      characterModel.traverse((c) => {
        if (c.isMesh && c.material) {
          if (c._origColor === undefined && c.material.color) c._origColor = c.material.color.getHex();
          if (c.material.color) c.material.color.setHex(0xFF3333);
        }
      });
    }
  } else if (is2DMode) {
    if (bodyMesh?.material) bodyMesh.material.color.setHex(0xFF3333);
  } else {
    [headMesh, torsoMesh, leftArm].filter(Boolean).forEach(m => {
      if (m?.material) m.material.color.setHex(0xFF3333);
    });
  }

  // Stagger backward
  playerGroup.position.x = HOME_X - 0.7;

  let shakes = 0;
  const iv = setInterval(() => {
    if (playerGroup) playerGroup.position.x = (HOME_X - 0.7) + (Math.random()-0.5)*0.3;
    if (++shakes >= 6) {
      clearInterval(iv);
      if (playerGroup) playerGroup.position.x = HOME_X;
    }
  }, 45);

  setTimeout(() => {
    if (is3DModelMode) {
      if (characterModel) {
        characterModel.traverse((c) => {
          if (c.isMesh && c.material && c._origColor !== undefined) {
            c.material.color.setHex(c._origColor);
          }
        });
      }
    } else if (is2DMode) {
      if (bodyMesh?.material) bodyMesh.material.color.setHex(0xFFFFFF);
    } else {
      [headMesh, torsoMesh, leftArm].filter(Boolean).forEach(m => {
        if (m?.material) m.material.color.setHex(SKIN_TONE);
      });
      if (hatMat)   hatMat.color.setHex(getEquipColor('hat'));
      if (shirtMat) shirtMat.color.setHex(getEquipColor('shirt'));
    }
    if (playerGroup) playerGroup.position.x = HOME_X;
    if (onDone) onDone();
  }, 350);
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

  // Tick active sword slash tweens
  TWEEN.update();

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
      case 'normal':  _animNormal(prog, deltaTime);  break;
      case 'default': _animNormal(prog, deltaTime);  break;
      case 'thunder': _animThunder(prog, deltaTime); break;
      case 'frost':   _animFrost(prog, deltaTime);   break;
      case 'fire':    _animFire(prog, deltaTime);    break;
      case 'miss':    _animMiss(prog, deltaTime);    break;
      case 'dodge':   _animDodge(prog, deltaTime);   break;
      default:        _animNormal(prog, deltaTime);  break;
    }

    if (prog >= 1.0) {
      _resetAll();
      const cb = anim.onDone;
      anim.active = false;
      anim.onDone = null;
      if (cb) cb();
    }

  } else {
    if (is3DModelMode) {
      playerGroup.position.x = HOME_X;
      playerGroup.position.y = HOME_Y + Math.sin(Date.now() * 0.002) * 0.04;
      playerGroup.rotation.y = 0;
      if (playerArmPivot && !anim.active) {
        playerArmPivot.rotation.set(0, 0, Math.sin(Date.now() * 0.002) * 0.03);
      }
    } else if (is2DMode) {
      playerGroup.position.x = HOME_X;
      playerGroup.position.y = HOME_Y;
      playerGroup.rotation.y = 0;
      const breath = Math.sin(Date.now() * 0.003) * 0.05;
      if (bodyMesh) {
        bodyMesh.position.y = breath;
        bodyMesh.rotation.y = Math.PI / 6;
      }
      if (weaponArmPivot) {
        weaponArmPivot.position.set(WEAPON_HAND_POS.x, WEAPON_HAND_POS.y + breath, WEAPON_HAND_POS.z);
        weaponArmPivot.rotation.set(0, Math.PI / 6, WEAPON_READY_ROT_Z);
      }
    } else {
      // Idle bob
      playerGroup.position.x = HOME_X;
      playerGroup.position.y = HOME_Y + Math.sin(Date.now()*0.0018)*0.06;
      playerGroup.rotation.y = FACE_Y;
      if (rightArm)           rightArm.rotation.x           =  Math.sin(Date.now()*0.0015)*0.06;
      if (leftShoulderPivot)  leftShoulderPivot.rotation.x  = -Math.PI / 6 + Math.sin(Date.now()*0.0015)*0.06;
    }
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
}

// ═════════════════════════════════════════════════════════════════════════════
// ① NORMAL — Basic Slash (Chém Thường / Chưa đủ bộ)
//   1. Lao vào (250ms, boss front)
//   2. Chém xuống 75° (150ms, boss torso, -1 HP)
//   3. Lùi về (250ms)
// ═════════════════════════════════════════════════════════════════════════════
function _animNormal(prog, dt) {
  const ATTACK_X = BOSS_X - 1.2;
  const pivot = getWeaponHandNode();

  // 1. Dash to Boss (prog < 0.32)
  if (prog < 0.32) {
    const t = prog / 0.32;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, ATTACK_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 0.25;
    playerGroup.rotation.y = (is3DModelMode || is2DMode) ? 0 : FACE_Y;
    if (!is3DModelMode && !is2DMode) _runLimbs(dt, 18);
  } else if (prog < 0.64) {
    // 2. Strike moment at Boss: trigger dedicated arm slashing swing
    playerGroup.position.x = ATTACK_X;
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = (is3DModelMode || is2DMode) ? 0 : FACE_Y;
    if (!anim._slashTriggered) {
      anim._slashTriggered = true;
      playArmSwingSlash(pivot, () => {
        if (!anim._hitEmitted) {
          anim._hitEmitted = true;
          if (anim.onHit) anim.onHit();
        }
      });
    }
    const b = 1 + Math.sin((prog - 0.32) / 0.32 * Math.PI) * 0.12;
    playerGroup.scale.set(b, 1 / b, 1);
  } else {
    // 3. Step back to origin
    const t = (prog - 0.64) / 0.36;
    playerGroup.position.x = THREE.MathUtils.lerp(ATTACK_X, HOME_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 0.25;
    playerGroup.rotation.y = (is3DModelMode || is2DMode) ? 0 : FACE_Y;
    playerGroup.scale.set(1, 1, 1);
    if (!is3DModelMode && !is2DMode) _runLimbs(dt, 12);
  }
}
function _animDefault(prog, dt) { _animNormal(prog, dt); }

// ═════════════════════════════════════════════════════════════════════════════
// ② THUNDER — Lôi Long Trảm (Full Set Sét)
//   1. Bay lên cao (350ms, y+3.5, bossX-0.5)
//   2. Bổ xuống (180ms, sword onto boss head, hit)
//   3. Lùi về (280ms)
// ═════════════════════════════════════════════════════════════════════════════
function _animThunder(prog, dt) {
  const APEX_X = BOSS_X - 0.5;
  const APEX_Y = HOME_Y + 3.5;
  const pivot = getWeaponHandNode();

  if (prog < 0.43) {
    // 1. Bay lên cao (350ms): leap high above Boss
    const t = prog / 0.43;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, APEX_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI * 0.5) * 3.5;
    playerGroup.rotation.y = (is3DModelMode || is2DMode) ? 0 : FACE_Y;
    if (!is3DModelMode && !is2DMode) _runLimbs(dt, 10);
  } else if (prog < 0.65) {
    // 2. Bổ xuống chém cực mạnh (180ms): dive straight down, trigger arm swing slash onto boss head
    const t = (prog - 0.43) / 0.22;
    playerGroup.position.x = APEX_X;
    playerGroup.position.y = APEX_Y - t * 3.5;
    playerGroup.rotation.y = (is3DModelMode || is2DMode) ? 0 : FACE_Y;
    if (!anim._slashTriggered) {
      anim._slashTriggered = true;
      playArmSwingSlash(pivot, () => {
        if (!anim._hitEmitted) {
          anim._hitEmitted = true;
          if (anim.onHit) anim.onHit();
        }
      });
    }
    const b = 1 + Math.sin(t * Math.PI) * 0.12;
    playerGroup.scale.set(b, 1 / b, 1);
  } else {
    // 3. Lùi về và trở về thế thủ (280ms)
    const t = (prog - 0.65) / 0.35;
    playerGroup.position.x = THREE.MathUtils.lerp(APEX_X, HOME_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 1.5;
    playerGroup.rotation.y = (is3DModelMode || is2DMode) ? 0 : FACE_Y;
    playerGroup.scale.set(1, 1, 1);
    if (!is3DModelMode && !is2DMode) _runLimbs(dt, 14);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ③ FROST — Băng Tinh Trượt Trảm (Full Set Băng)
//   1. Lướt chém: Glides quickly forward into Boss, slashes horizontally (200ms)
//   2. Hold ngang kiếm (100ms)
//   3. Lùi lại: Slides backward to original stance (250ms)
// ═════════════════════════════════════════════════════════════════════════════
function _animFrost(prog, dt) {
  const ATTACK_X = BOSS_X - 0.8;
  const pivot = getWeaponHandNode();

  if (prog < 0.36) {
    // 1. Lướt chém vào Boss (200ms)
    const t = prog / 0.36;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, ATTACK_X, t);
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = (is3DModelMode || is2DMode) ? 0 : FACE_Y;
    // Trigger arm slashing swing right as cutting through boss
    if (!anim._slashTriggered && prog >= 0.18) {
      anim._slashTriggered = true;
      playArmSwingSlash(pivot, () => {
        if (!anim._hitEmitted) {
          anim._hitEmitted = true;
          if (anim.onHit) anim.onHit();
        }
      });
    }
    const b = 1 + Math.sin(t * Math.PI) * 0.08;
    playerGroup.scale.set(b, 1 / b, 1);
  } else if (prog < 0.54) {
    // 2. Hold pose (100ms)
    playerGroup.position.x = ATTACK_X;
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = (is3DModelMode || is2DMode) ? 0 : FACE_Y;
    playerGroup.scale.set(1, 1, 1);
  } else {
    // 3. Lùi lại về thế thủ (250ms)
    const t = (prog - 0.54) / 0.46;
    playerGroup.position.x = THREE.MathUtils.lerp(ATTACK_X, HOME_X, t);
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = (is3DModelMode || is2DMode) ? 0 : FACE_Y;
    playerGroup.scale.set(1, 1, 1);
    if (!is3DModelMode && !is2DMode) _runLimbs(dt, 14);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ④ FIRE — Hỏa Luân Trảm (Full Set Lửa)
//   1. Lướt tới Boss: Dash forward to Boss (ATTACK_X = BOSS_X - 1.2)
//   2. Chém kiếm 3-pose slash strike
//   3. Lùi về vị trí ban đầu
// ═════════════════════════════════════════════════════════════════════════════
function _animFire(prog, dt) {
  const ATTACK_X = BOSS_X - 1.2;
  const pivot = getWeaponHandNode();

  if (prog < 0.35) {
    // 1. Dash to Boss (ATTACK_X = BOSS_X - 1.2)
    const t = prog / 0.35;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, ATTACK_X, t);
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = (is3DModelMode || is2DMode) ? 0 : FACE_Y;
    if (!is3DModelMode && !is2DMode) _runLimbs(dt, 14);
  } else if (prog < 0.65) {
    // 2. Play 3-pose slash strike at Boss
    playerGroup.position.x = ATTACK_X;
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = (is3DModelMode || is2DMode) ? 0 : FACE_Y;
    if (!anim._slashTriggered) {
      anim._slashTriggered = true;
      _spawnFlameWave();
      playArmSwingSlash(pivot, () => {
        if (!anim._hitEmitted) {
          anim._hitEmitted = true;
          if (anim.onHit) anim.onHit();
        }
      });
    }
    const b = 1 + Math.sin((prog - 0.35) / 0.30 * Math.PI) * 0.12;
    playerGroup.scale.set(b, 1 / b, 1);
  } else {
    // 3. Dash back to origin
    const t = (prog - 0.65) / 0.35;
    playerGroup.position.x = THREE.MathUtils.lerp(ATTACK_X, HOME_X, t);
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = (is3DModelMode || is2DMode) ? 0 : FACE_Y;
    playerGroup.scale.set(1, 1, 1);
    if (!is3DModelMode && !is2DMode) _runLimbs(dt, 12);
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
  waveGroup.position.set(BOSS_X - 0.7, HOME_Y+0.6, 0);
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
  if (is3DModelMode || is2DMode) {
    const pivot = is3DModelMode ? weaponSocket : weaponArmPivot;
    if (prog < 0.40) {
      const t = prog / 0.40;
      playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, RUSH_X, t);
      playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 0.4;
      playerGroup.rotation.y = 0;
      if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(WEAPON_READY_ROT_Z, 0.35, t);
    } else if (prog < 0.56) {
      playerGroup.position.x = RUSH_X;
      playerGroup.position.y = HOME_Y;
      playerGroup.rotation.y = 0;
      if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(0.35, -80 * Math.PI / 180, (prog - 0.40) / 0.16);
    } else {
      const t = (prog - 0.56) / 0.44;
      playerGroup.position.x = THREE.MathUtils.lerp(RUSH_X, HOME_X, t);
      playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 0.6;
      playerGroup.rotation.y = 0;
      if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(-80 * Math.PI / 180, WEAPON_READY_ROT_Z, t);
    }
    return;
  }
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

// ═════════════════════════════════════════════════════════════════════════════
// ⑥ DODGE — Evasive Leap Back
// ═════════════════════════════════════════════════════════════════════════════
function _animDodge(prog, dt) {
  const LEAP_BACK = -1.6;
  const LEAP_UP   =  1.5;
  const t = Math.sin(prog * Math.PI);
  playerGroup.position.x = HOME_X + LEAP_BACK * t;
  playerGroup.position.y = HOME_Y + LEAP_UP * t;
  playerGroup.rotation.z = -0.35 * Math.sin(prog * Math.PI * 2);
  if (is3DModelMode || is2DMode) {
    playerGroup.rotation.y = 0;
  } else {
    playerGroup.rotation.y = FACE_Y;
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
  playerGroup.rotation.set(0, (is3DModelMode || is2DMode) ? 0 : FACE_Y, 0);
  playerGroup.scale.set(1, 1, 1);
  if (is3DModelMode) {
    if (characterRoot) characterRoot.rotation.set(0, Math.PI / 2, 0);
    if (handNode && handNode._baseRotZ !== undefined) handNode.rotation.z = handNode._baseRotZ;
    if (playerArmPivot) playerArmPivot.rotation.set(0, 0, 0);
  } else if (is2DMode) {
    if (bodyMesh) {
      bodyMesh.position.set(0, 0, 0);
      bodyMesh.rotation.set(0, Math.PI / 6, 0);
    }
    if (weaponArmPivot) {
      weaponArmPivot.position.set(WEAPON_HAND_POS.x, WEAPON_HAND_POS.y, WEAPON_HAND_POS.z);
      weaponArmPivot.rotation.set(0, Math.PI / 6, WEAPON_READY_ROT_Z);
    }
    if (skinnedBones) {
      if (skinnedBones.r_shoulder) skinnedBones.r_shoulder.rotation.set(0, 0, 0);
      if (skinnedBones.r_elbow) skinnedBones.r_elbow.rotation.set(0, 0, 0);
    }
  } else {
    if (leftLeg)            leftLeg.rotation.x            = 0;
    if (rightLeg)           rightLeg.rotation.x           = 0;
    if (rightArm)           rightArm.rotation.x           = 0;
    if (leftShoulderPivot)  { leftShoulderPivot.rotation.x = -Math.PI / 6; leftShoulderPivot.rotation.z = 0; }
  }
  walkCycle = 0;
  if (anim) anim._slashTriggered = false;
  // Clean up stray flame wave
  if (flameWave && flameWave.parent) { flameWave.parent.remove(flameWave); }
  flameWave = null; flameWaveActive = false; flameWaveDX = 0;
}

export function resetPlayerState() {
  anim.active = false;
  anim.type = null;
  anim.t = 0;
  anim.duration = 0;
  anim._hitEmitted = false;
  if (playerGroup) _resetAll();
}

