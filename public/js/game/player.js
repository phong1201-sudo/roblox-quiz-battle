// THREE is available as a global from the CDN script tag (window.THREE)
// 2D Rigged Sprite Puppet Engine (Meta Animated Drawings style)

// ─────────────────────────────────────────────────────────────────────────────
// Colour maps & constants
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

// 2D Skinned Sprite Puppet state
let is2DMode = true;
let isSkinned2DMode = true;
let is3DModelMode = false;
let skinnedCharacterMesh = null;     // THREE.SkinnedMesh
let skinnedSkeleton = null;          // THREE.Skeleton
let skinnedBones = null;             // Bone map { hip, torso, neck, head, l_shoulder, l_elbow, l_hand, r_shoulder, r_elbow, r_hand, l_knee, l_foot, r_knee, r_foot }
let bodyMesh = null;                 // THREE.SkinnedMesh
let weaponMesh = null;               // THREE.Mesh (PlaneGeometry for 2D sword)
let weaponArmPivot = null;           // alias to r_hand
let _skeletonConfig = null;

// Universal Procedural Player Arm Pivot & Compound Limb Hierarchy
export let combatArmCompound = null;
export let playerArmPivot = null;
export function getCombatArmCompound() {
  return skinnedBones?.r_shoulder || playerArmPivot || combatArmCompound || getWeaponHandNode();
}
export function getPlayerArmPivot() {
  return skinnedBones?.r_shoulder || playerArmPivot || combatArmCompound || getWeaponHandNode();
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
  } catch (e) {}
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
  // 1. Check localStorage first for instant sync across tabs & admin saves
  try {
    const cached = localStorage.getItem('rigged_skeleton');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.nodes) {
        _skeletonConfig = parsed;
        return _skeletonConfig;
      }
    }
  } catch (e) {}

  // 2. Fetch from server endpoint
  try {
    const res = await fetch('/api/skeleton');
    if (res.ok) {
      const data = await res.json();
      if (data && data.nodes) {
        _skeletonConfig = data;
        return _skeletonConfig;
      }
    }
  } catch (e) {}

  _skeletonConfig = DEFAULT_SKELETON_CONFIG;
  return _skeletonConfig;
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'rigged_skeleton' && ev.newValue) {
      try {
        const data = JSON.parse(ev.newValue);
        if (data && data.nodes) {
          _skeletonConfig = data;
          if (playerGroup && activeElement !== undefined) {
            createPlayerMesh(activeElement, window.gameState?.equipment);
          }
        }
      } catch (err) {}
    }
  });

  window.addEventListener('skeleton-updated', (ev) => {
    if (ev.detail) {
      _skeletonConfig = ev.detail;
      if (playerGroup && activeElement !== undefined) {
        createPlayerMesh(activeElement, window.gameState?.equipment);
      }
    }
  });

  window.addEventListener('message', (ev) => {
    if (ev.data && ev.data.type === 'skeleton-updated' && ev.data.skeleton) {
      _skeletonConfig = ev.data.skeleton;
      if (playerGroup && activeElement !== undefined) {
        createPlayerMesh(activeElement, window.gameState?.equipment);
      }
    }
  });
}

// Elemental aura
let elementalAura = null;
let elementalParticles = [];

// Flame wave projectile (Fire set)
let flameWave = null;
let flameWaveActive = false;
let flameWaveDX = 0;

// Combat animation state
let anim = { active:false, type:'default', t:0, duration:1.0,
             onHit:null, onDone:null, hitFired:false, _hitEmitted:false };
let walkCycle = 0;

// ─── Spatial constants ────────────────────────────────────────────────────────
// Player positioned on Left side of arena (x: -4.5, y: 2.0, z: 0) facing +X Boss
const HOME_X  = -4.5;
const HOME_Y  =  2.0;
const HOME_Z  =  0;
const BOSS_X  =  3.0;
const BOSS_Y  =  4.0;
const FACE_Y  =  0;

// Character & Weapon Scale (Proportional height ~3.8 units to match Boss scale)
const CHAR_HEIGHT   = 3.8;
const CHAR_WIDTH    = 3.08; // 3.8 * 0.81 aspect ratio
const WEAPON_HEIGHT = 2.6;
const WEAPON_WIDTH  = 0.55;

// ─────────────────────────────────────────────────────────────────────────────
// 2D Character & Sword Assets mapping directly from public/assets/character/
// ─────────────────────────────────────────────────────────────────────────────
const ELEMENT_SPRITES = {
  fire: {
    body: '/assets/character/Fire%20player.png',
    weapon: '/assets/character/Fire%20sword.png'
  },
  thunder: {
    body: '/assets/character/Lightning%20player.png',
    weapon: '/assets/character/Lightning%20sword.png'
  },
  frost: {
    body: '/assets/character/Ice%20player.png',
    weapon: '/assets/character/Ice%20sword.png'
  },
  default: {
    body: '/assets/character/Player.png',
    weapon: '/assets/character/Normal%20Sword.png'
  }
};

const _artCache = {
  default: { body: null, weapon: null },
  thunder: { body: null, weapon: null },
  fire:    { body: null, weapon: null },
  frost:   { body: null, weapon: null },
};

function _loadArtTexture(element, type) {
  return new Promise((resolve) => {
    const el = element || 'default';
    const entry = ELEMENT_SPRITES[el] || ELEMENT_SPRITES['default'];
    const url = type === 'weapon' ? entry.weapon : entry.body;

    if (_artCache[el]?.[type]) return resolve(_artCache[el][type]);

    const texLoader = new THREE.TextureLoader();
    texLoader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        if (!_artCache[el]) _artCache[el] = { body: null, weapon: null };
        _artCache[el][type] = tex;
        console.log(`[player] Loaded 2D sprite: ${url}`);
        resolve(tex);
      },
      undefined,
      (err) => {
        console.warn(`[player] Failed to load ${url}, trying fallback`, err);
        const fbUrl = type === 'weapon' ? ELEMENT_SPRITES.default.weapon : ELEMENT_SPRITES.default.body;
        texLoader.load(fbUrl, (fbTex) => {
          if (fbTex) fbTex.colorSpace = THREE.SRGBColorSpace;
          resolve(fbTex);
        }, undefined, () => resolve(null));
      }
    );
  });
}

function _createFallbackCharacterTexture(element) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 680;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = element === 'fire' ? '#ff4400' : element === 'thunder' ? '#00e5ff' : '#00b4d8';
  ctx.fillRect(196, 60, 120, 120); // Head
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(260, 100, 30, 20); // Eye
  ctx.fillStyle = element === 'fire' ? '#cc2200' : '#0077b6';
  ctx.fillRect(166, 180, 180, 240); // Torso
  ctx.fillStyle = '#f5c4a0';
  ctx.fillRect(346, 200, 60, 160); // Right arm
  ctx.fillRect(106, 200, 60, 160); // Left arm
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(176, 420, 70, 220); // Left leg
  ctx.fillRect(266, 420, 70, 220); // Right leg
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2D Skeletal SkinnedMesh Builder (Meta Animated Drawings style)
// ─────────────────────────────────────────────────────────────────────────────
export async function build2DSkinnedMesh(bodyTexture, weaponTexture, targetEl) {
  const skel = await _getSkeletonConfig();
  const nodes = { ...DEFAULT_SKELETON_CONFIG.nodes, ...(skel?.nodes || {}) };

  const characterWidth = CHAR_WIDTH;
  const characterHeight = CHAR_HEIGHT;

  // 1. Create dense plane geometry (32x32 segments for high-fidelity deformation)
  const geometry = new THREE.PlaneGeometry(characterWidth, characterHeight, 32, 32);

  // 2. Bone hierarchy keys
  const BONE_KEYS = [
    'hip', 'torso', 'neck', 'head',
    'l_shoulder', 'l_elbow', 'l_hand',
    'r_shoulder', 'r_elbow', 'r_hand',
    'l_knee', 'l_foot', 'r_knee', 'r_foot'
  ];

  // Map 2D normalized coordinates (0..1) to local 3D Plane coordinates
  const boneLocs = {};
  for (const k of BONE_KEYS) {
    const n = nodes[k] || DEFAULT_SKELETON_CONFIG.nodes[k] || { x: 0.5, y: 0.5 };
    boneLocs[k] = {
      x: (n.x - 0.5) * characterWidth,
      y: (0.5 - n.y) * characterHeight,
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

  // Helper for segment distance
  function distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }

  function getDistToBone(boneKey, vx, vy) {
    switch (boneKey) {
      case 'r_shoulder':
        return distToSegment(vx, vy, boneLocs.r_shoulder.x, boneLocs.r_shoulder.y, boneLocs.r_elbow.x, boneLocs.r_elbow.y);
      case 'r_elbow':
        return distToSegment(vx, vy, boneLocs.r_elbow.x, boneLocs.r_elbow.y, boneLocs.r_hand.x, boneLocs.r_hand.y);
      case 'r_hand':
        return Math.hypot(vx - boneLocs.r_hand.x, vy - boneLocs.r_hand.y);
      case 'l_shoulder':
        return distToSegment(vx, vy, boneLocs.l_shoulder.x, boneLocs.l_shoulder.y, boneLocs.l_elbow.x, boneLocs.l_elbow.y);
      case 'l_elbow':
        return distToSegment(vx, vy, boneLocs.l_elbow.x, boneLocs.l_elbow.y, boneLocs.l_hand.x, boneLocs.l_hand.y);
      case 'l_hand':
        return Math.hypot(vx - boneLocs.l_hand.x, vy - boneLocs.l_hand.y);
      case 'head':
        return distToSegment(vx, vy, boneLocs.neck.x, boneLocs.neck.y, boneLocs.head.x, boneLocs.head.y);
      case 'neck':
        return Math.hypot(vx - boneLocs.neck.x, vy - boneLocs.neck.y);
      case 'torso':
        return Math.min(
          distToSegment(vx, vy, boneLocs.hip.x, boneLocs.hip.y, boneLocs.torso.x, boneLocs.torso.y),
          distToSegment(vx, vy, boneLocs.torso.x, boneLocs.torso.y, boneLocs.neck.x, boneLocs.neck.y)
        );
      case 'hip':
        return Math.hypot(vx - boneLocs.hip.x, vy - boneLocs.hip.y);
      case 'l_knee':
        return distToSegment(vx, vy, boneLocs.hip.x, boneLocs.hip.y, boneLocs.l_knee.x, boneLocs.l_knee.y);
      case 'l_foot':
        return distToSegment(vx, vy, boneLocs.l_knee.x, boneLocs.l_knee.y, boneLocs.l_foot.x, boneLocs.l_foot.y);
      case 'r_knee':
        return distToSegment(vx, vy, boneLocs.hip.x, boneLocs.hip.y, boneLocs.r_knee.x, boneLocs.r_knee.y);
      case 'r_foot':
        return distToSegment(vx, vy, boneLocs.r_knee.x, boneLocs.r_knee.y, boneLocs.r_foot.x, boneLocs.r_foot.y);
      default:
        return Math.hypot(vx - boneLocs[boneKey].x, vy - boneLocs[boneKey].y);
    }
  }

  // 3. Compute Linear Blend Skinning (LBS) for every vertex with closest 2 bones
  const posAttr = geometry.attributes.position;
  const skinIndices = [];
  const skinWeights = [];

  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);

    const distList = [];
    for (let b = 0; b < BONE_KEYS.length; b++) {
      const k = BONE_KEYS[b];
      const d = getDistToBone(k, vx, vy);
      distList.push({ index: b, dist: d });
    }

    distList.sort((a, b) => a.dist - b.dist);

    const b0 = distList[0].index;
    const d0 = distList[0].dist;
    const b1 = distList[1].index;
    const d1 = distList[1].dist;

    const w0 = 1.0 / Math.pow(Math.max(d0, 0.025), 3.0);
    const w1 = 1.0 / Math.pow(Math.max(d1, 0.025), 3.0);
    const sum = w0 + w1;

    skinIndices.push(b0, b1, 0, 0);
    skinWeights.push(w0 / sum, w1 / sum, 0, 0);
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

  // 5. Attach 2D Weapon Sprite directly to r_hand bone so it naturally follows arm movement
  let weaponMesh = null;
  const wGeo = new THREE.PlaneGeometry(WEAPON_WIDTH, WEAPON_HEIGHT);
  wGeo.translate(0, WEAPON_HEIGHT / 2, 0); // hilt is at (0, 0) of the geometry

  if (weaponTexture) {
    const wMat = new THREE.MeshBasicMaterial({
      map: weaponTexture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      alphaTest: 0.05
    });
    weaponMesh = new THREE.Mesh(wGeo, wMat);
  } else {
    const bladeColor = targetEl === 'fire' ? 0xff4400 : targetEl === 'frost' ? 0x88ddff : targetEl === 'thunder' ? 0x00cfff : 0xddaa33;
    const bladeMat = new THREE.MeshBasicMaterial({ color: bladeColor, side: THREE.DoubleSide });
    weaponMesh = new THREE.Mesh(wGeo, bladeMat);
  }

  // Mount weapon with hilt right at hand node, pointed forward (+X) toward the Boss
  weaponMesh.position.set(0, 0, 0.02);
  weaponMesh.rotation.set(0, 0, -Math.PI / 4);

  boneMap.r_hand.add(weaponMesh);

  return {
    skinnedMesh,
    skeleton,
    bones: boneMap,
    weaponMesh
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILD CHARACTER
// ─────────────────────────────────────────────────────────────────────────────
export function createPlayer(color, avatarPreset, cutoutUrl) {
  activeElement = window.gameState?.equippedSet || null;
  if (playerGroup) return;
  playerGroup = new THREE.Group();
  playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
  createPlayerMesh(activeElement, window.gameState?.equipment);
}

export async function createPlayerMesh(element, equippedGear) {
  if (!playerGroup) return;
  const targetEl = element || activeElement || window.gameState?.equippedSet || 'default';

  // Clear existing children
  while (playerGroup.children.length) playerGroup.remove(playerGroup.children[0]);
  elementalAura = null;
  elementalParticles = [];
  bodyMesh = null;
  weaponMesh = null;
  weaponArmPivot = null;
  playerArmPivot = null;
  is3DModelMode = false;
  is2DMode = true;
  isSkinned2DMode = true;
  skinnedCharacterMesh = null;
  skinnedSkeleton = null;
  skinnedBones = null;

  // 1. Load textures directly from public/assets/character/
  let bTex = await _loadArtTexture(targetEl, 'body');
  if (!bTex) bTex = await _loadArtTexture('default', 'body');
  if (!bTex) bTex = _createFallbackCharacterTexture(targetEl);

  let wTex = await _loadArtTexture(targetEl, 'weapon');
  if (!wTex) wTex = await _loadArtTexture('default', 'weapon');

  // Place player on Left side of arena facing Boss (+X)
  playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
  playerGroup.rotation.set(0, 0, 0);

  try {
    const skinnedRig = await build2DSkinnedMesh(bTex, wTex, targetEl);
    skinnedCharacterMesh = skinnedRig.skinnedMesh;
    skinnedSkeleton = skinnedRig.skeleton;
    skinnedBones = skinnedRig.bones;
    bodyMesh = skinnedCharacterMesh;
    weaponMesh = skinnedRig.weaponMesh;
    playerArmPivot = skinnedBones.r_shoulder;
    weaponArmPivot = skinnedBones.r_hand;

    skinnedCharacterMesh.position.set(0, 0, 0);
    // Face toward Boss (+X) while remaining clearly visible in 3/4 camera view
    skinnedCharacterMesh.rotation.y = Math.PI / 8;
    playerGroup.add(skinnedCharacterMesh);

    if (activeElement) _buildElementalAura(activeElement);
    console.log(`[player] 2D Rigged Sprite Puppet successfully mounted at (${HOME_X}, ${HOME_Y}, ${HOME_Z}) for ${targetEl}`);
  } catch (err) {
    console.error('[player] Failed to build 2D SkinnedMesh:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Elemental aura
// ─────────────────────────────────────────────────────────────────────────────
function _buildElementalAura(element) {
  if (elementalAura && playerGroup) playerGroup.remove(elementalAura);
  elementalAura = null;
  elementalParticles = [];

  const auraGroup = new THREE.Group();
  const auraColors = { thunder: 0x00cfff, fire: 0xff4400, frost: 0x88ddff };
  const auraColor = auraColors[element] || 0xffffff;

  for (let i = 0; i < 8; i++) {
    const pGeo = new THREE.PlaneGeometry(0.18, 0.18);
    const pMat = new THREE.MeshBasicMaterial({ color: auraColor, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const p = new THREE.Mesh(pGeo, pMat);
    p.position.set((Math.random() - 0.5) * 1.8, Math.random() * 3.0, (Math.random() - 0.5) * 0.5);
    p._speedY = 0.5 + Math.random() * 1.0;
    auraGroup.add(p);
    elementalParticles.push(p);
  }
  elementalAura = auraGroup;
  playerGroup.add(elementalAura);
}

// ─────────────────────────────────────────────────────────────────────────────
// Getters and Compatibility exports
// ─────────────────────────────────────────────────────────────────────────────
export function applyElementalSet(element) {
  activeElement = element;
  if (window.gameState) {
    window.gameState.equippedSet = element;
    window.gameState.thunderSet  = element === 'thunder';
  }
  createPlayerMesh(element, window.gameState?.equipment);
}
export function applyThunderSet() { applyElementalSet('thunder'); }

export function getPlayerObject()  { return playerGroup; }
export function getPosition()      { return playerGroup ? playerGroup.position.clone() : new THREE.Vector3(HOME_X,HOME_Y,HOME_Z); }
export function getRotation()      { return { y: playerGroup ? playerGroup.rotation.y : 0 }; }
export function getActiveElement() { return activeElement; }
export function applySkin()        {}
export function switchToCutout()   {}
export function getWeaponHandNode(){ return skinnedBones?.r_hand || weaponArmPivot; }

// ─────────────────────────────────────────────────────────────────────────────
// 3-Phase Slash Animation: Wind-up (100ms) -> Strike (120ms) -> Recover (100ms)
// ─────────────────────────────────────────────────────────────────────────────
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
    safeOnComplete();
  }, 500);

  // Phase 1: Lift arm up & back (Wind-up: 100ms)
  new TWEEN.Tween(rShoulder.rotation)
    .to({ z: 1.05 }, 100)
    .easing(TWEEN.Easing.Quadratic.Out)
    .start();

  new TWEEN.Tween(rElbow.rotation)
    .to({ z: 0.75 }, 100)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onComplete(() => {
      // Phase 2: Slash arm forward & down across (Strike: 120ms -> Deal damage to boss)
      new TWEEN.Tween(rShoulder.rotation)
        .to({ z: -1.35 }, 120)
        .easing(TWEEN.Easing.Quadratic.In)
        .start();

      new TWEEN.Tween(rElbow.rotation)
        .to({ z: -0.35 }, 120)
        .easing(TWEEN.Easing.Quadratic.In)
        .onComplete(() => {
          safeOnHit();

          // Phase 3: Return to combat ready pose (100ms)
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

export function playArmSwingSlash(pivot, onHit, onComplete) {
  slashAnimation(onHit, onComplete);
}
export function playSwordSlashAnimation(pivot, onHit, onComplete) {
  slashAnimation(onHit, onComplete);
}
export function playGuaranteedPlayerSlash(arg1, arg2, arg3) {
  let onHit = typeof arg1 === 'function' ? arg1 : arg2;
  let onComplete = typeof arg1 === 'function' ? arg2 : arg3;
  slashAnimation(onHit, onComplete);
}

// ─────────────────────────────────────────────────────────────────────────────
// Combat Animation triggers
// ─────────────────────────────────────────────────────────────────────────────
export function playDodge(onDone) {
  if (!playerGroup) { if (onDone) onDone(); return; }
  anim = { active: true, type: 'dodge', t: 0, duration: 0.45,
           onHit: null, onDone: onDone || null, hitFired: false, _hitEmitted: false };
}

export function playPunch() { playAttack(null, null); }

export function playCombatAnimation(type = 'normal', { onHit, onDone } = {}) {
  if (!playerGroup) { if (onHit) onHit(); if (onDone) onDone(); return; }
  const dur = 0.75;

  clearTimeout(window._combatSafetyTimer);
  window._combatSafetyTimer = setTimeout(() => {
    if (anim.active) {
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
  anim = { active: true, type: 'miss', t: 0, duration: 0.75,
           onHit: null, onDone: onDone || null, hitFired: false, _hitEmitted: false };
}

export function playHurt(onDone) {
  if (!playerGroup) { if (onDone) onDone(); return; }
  if (skinnedCharacterMesh?.material) {
    skinnedCharacterMesh.material.color.setHex(0xFF3333);
    setTimeout(() => {
      if (skinnedCharacterMesh?.material) skinnedCharacterMesh.material.color.setHex(0xFFFFFF);
    }, 250);
  }
  let shakeTime = 0;
  const origX = playerGroup.position.x;
  const shakeInterval = setInterval(() => {
    shakeTime += 0.05;
    playerGroup.position.x = origX + (Math.random() - 0.5) * 0.35;
    if (shakeTime >= 0.3) {
      clearInterval(shakeInterval);
      playerGroup.position.x = origX;
      if (onDone) onDone();
    }
  }, 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// Frame update
// ─────────────────────────────────────────────────────────────────────────────
export function updatePlayer(deltaTime, camera) {
  if (!playerGroup) return;

  // Update elemental particles
  if (elementalParticles.length > 0) {
    elementalParticles.forEach(p => {
      p.position.y += p._speedY * deltaTime;
      if (p.position.y > 3.5) p.position.y = 0;
    });
  }

  // Update flame wave if active
  if (flameWaveActive && flameWave) {
    flameWaveDX += 14 * deltaTime;
    flameWave.position.x = HOME_X + flameWaveDX;
    flameWave.scale.x = 1.0 + flameWaveDX * 0.2;
    flameWave.scale.y = 1.0 + flameWaveDX * 0.15;
    if (flameWaveDX > (BOSS_X - HOME_X + 2)) {
      flameWaveActive = false;
      if (flameWave.parent) flameWave.parent.remove(flameWave);
    }
  }

  if (anim.active) {
    anim.t += deltaTime;
    const prog = Math.min(anim.t / anim.duration, 1.0);

    switch (anim.type) {
      case 'normal':
      case 'default':
      case 'thunder':
      case 'frost':
      case 'fire':
        _animNormal(prog, deltaTime);
        break;
      case 'miss':
        _animMiss(prog, deltaTime);
        break;
      case 'dodge':
        _animDodge(prog, deltaTime);
        break;
      default:
        _animNormal(prog, deltaTime);
        break;
    }

    if (prog >= 1.0) {
      _resetAll();
      const cb = anim.onDone;
      anim.active = false;
      anim.onDone = null;
      if (cb) cb();
    }
  } else {
    // Idle stance: Left side of arena standing tall, slight breathing bob
    playerGroup.position.x = HOME_X;
    playerGroup.position.y = HOME_Y + Math.sin(Date.now() * 0.002) * 0.04;
    playerGroup.position.z = HOME_Z;
    playerGroup.rotation.y = 0;
  }
}

function _animNormal(prog, dt) {
  const ATTACK_X = BOSS_X - 2.8;
  // 1. Dash to Boss (prog < 0.3)
  if (prog < 0.3) {
    const t = prog / 0.3;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, ATTACK_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 0.25;
  } else if (prog < 0.7) {
    // 2. Strike moment at Boss: trigger 3-phase slash animation
    playerGroup.position.x = ATTACK_X;
    playerGroup.position.y = HOME_Y;
    if (!anim._slashTriggered) {
      anim._slashTriggered = true;
      slashAnimation(
        () => {
          if (!anim._hitEmitted) {
            anim._hitEmitted = true;
            if (anim.onHit) anim.onHit();
          }
        },
        () => {}
      );
    }
  } else {
    // 3. Step back to origin
    const t = (prog - 0.7) / 0.3;
    playerGroup.position.x = THREE.MathUtils.lerp(ATTACK_X, HOME_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 0.25;
  }
}

function _animMiss(prog, dt) {
  const ATTACK_X = BOSS_X - 2.8;
  if (prog < 0.4) {
    const t = prog / 0.4;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, ATTACK_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 0.3;
  } else {
    const t = (prog - 0.4) / 0.6;
    playerGroup.position.x = THREE.MathUtils.lerp(ATTACK_X, HOME_X, t);
    playerGroup.position.y = HOME_Y;
  }
}

function _animDodge(prog, dt) {
  if (prog < 0.5) {
    const t = prog / 0.5;
    playerGroup.position.x = HOME_X - Math.sin(t * Math.PI) * 1.5;
    playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 0.8;
  } else {
    const t = (prog - 0.5) / 0.5;
    playerGroup.position.x = HOME_X - (1 - t) * 1.5;
    playerGroup.position.y = HOME_Y + (1 - t) * 0.8;
  }
}

function _resetAll() {
  if (playerGroup) {
    playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
    playerGroup.rotation.set(0, 0, 0);
  }
  if (skinnedBones?.r_shoulder) skinnedBones.r_shoulder.rotation.set(0, 0, 0);
  if (skinnedBones?.r_elbow) skinnedBones.r_elbow.rotation.set(0, 0, 0);
  if (skinnedCharacterMesh) skinnedCharacterMesh.updateMatrixWorld(true);
}

export function resetPlayerState() {
  anim.active = false;
  anim.type = null;
  anim.t = 0;
  anim.duration = 0;
  anim._hitEmitted = false;
  _resetAll();
}
