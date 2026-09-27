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

// 2.5D Sprite Mesh state
let is2DMode = false;
let bodyMesh = null;                 // THREE.Mesh (PlaneGeometry 2.2 x 3.0)
let weaponMesh = null;               // THREE.Mesh (PlaneGeometry 0.8 x 2.2)
let weaponArmPivot = null;           // THREE.Group attached at opposite hand (-0.6, 0.9, 0.1)

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
    if (!element || !['thunder', 'fire', 'frost'].includes(element)) return resolve(null);
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
  let weapGltf = await _loadGLTFModel(`/assets/models/${el}_weapon.glb`);
  if (!weapGltf) {
    weapGltf = await _loadGLTFModel(`/assets/models/${el}_weapon.gltf`);
  }
  if (!weapGltf && el !== 'default') {
    weapGltf = await _loadGLTFModel(`/assets/models/default_weapon.glb`) ||
               await _loadGLTFModel(`/assets/models/default_weapon.gltf`);
  }

  weaponSocket = new THREE.Group();
  weaponSocket.name = 'WeaponSocket';

  if (weapGltf && weapGltf.scene) {
    weaponModel = weapGltf.scene.clone(true);
    weaponModel.traverse((c) => {
      if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
    });

    // Compute the bounding box of weaponModel:
    const box = new THREE.Box3().setFromObject(weaponModel);
    const size = new THREE.Vector3();
    box.getSize(size);
    // Auto-scale weapon if it's too giant:
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 2.5) {
      const scaleFactor = 1.8 / maxDim;
      weaponModel.scale.setScalar(scaleFactor);
    } else if (maxDim < 0.2 && maxDim > 0.01) {
      const scaleFactor = 1.5 / maxDim;
      weaponModel.scale.setScalar(scaleFactor);
    }

    // Normalize geometry offset inside weaponSocket so hilt/grip is at local (0, 0, 0)
    const scaledBox = new THREE.Box3().setFromObject(weaponModel);
    weaponModel.position.x = - (scaledBox.min.x + scaledBox.max.x) / 2;
    weaponModel.position.z = - (scaledBox.min.z + scaledBox.max.z) / 2;
    if (scaledBox.min.y > 0.1 || scaledBox.min.y < -0.3) {
      weaponModel.position.y = - scaledBox.min.y;
    }
    weaponSocket.add(weaponModel);
  } else {
    // Fallback procedural blade attached to bone socket
    const bladeColor = el === 'fire' ? 0xff4400 : el === 'frost' ? 0x88ddff : el === 'thunder' ? 0x00cfff : 0xddaa33;
    const blade = makeBox(0.12, 1.6, 0.08, bladeColor);
    blade.position.set(0, 0.8, 0);
    weaponSocket.add(blade);
  }

  // Socket to Opposite Hand Node (LeftHand / LeftArm):
  // Look for opposite hand/arm bone:
  handNode = characterModel.getObjectByName('LeftHand') ||
             characterModel.getObjectByName('LeftArm') ||
             characterModel.getObjectByName('Arm_L') ||
             _findHandBone(characterModel, 'left');

  if (handNode) {
    handNode.add(weaponSocket);
    weaponSocket.position.set(0, 0, 0); // Reset relative offset
    weaponSocket.rotation.set(0, 0, Math.PI / 4); // Angle blade forward and upward in ready combat stance
    console.log(`[player] 3D Weapon socketed to left hand bone: ${handNode.name}`);
  } else {
    // If NO hand bone exists (static single mesh):
    // Attach weapon to characterRoot with manual opposite hand coordinates:
    // Invert X coordinate so sword rests firmly in the other hand facing the arena/boss
    characterRoot.add(weaponSocket);
    weaponSocket.position.set(-0.7, 0.85, 0.2);
    weaponSocket.rotation.set(0, 0, Math.PI / 6); // Blade tilted forward and upward ready for combat
    console.log('[player] No hand bone found: attached weapon to opposite hand at (-0.7, 0.85, 0.2)');
  }

  if (activeElement) _buildElementalAura(activeElement);
  console.log(`[player] 3D GLB model loaded & socketed for ${el}`);
  return true;
}

/**
 * Main Player Mesh Constructor:
 * Priority 1: Native 3D GLTF/GLB models with Bone Socketing ([element]_character.glb & [element]_weapon.glb)
 * Priority 2: 2.5D Sprite Meshes from uploaded art ([element]_body.png & [element]_weapon.png)
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
  bodyMesh = null; weaponMesh = null; weaponArmPivot = null;
  characterModel = null; characterRoot = null; weaponModel = null; weaponSocket = null; handNode = null;
  is3DModelMode = false;
  is2DMode = false;

  // Case A: Specific Elemental Set equipped ('thunder' | 'fire' | 'frost')
  if (targetEl && targetEl !== 'default') {
    // 1. Native 3D Elemental GLB Model
    const loaded3D = await _tryLoad3DCharacterAndWeapon(targetEl);
    if (loaded3D) return;

    // 2. 2.5D Sprite Mesh (if custom 2D art exists)
    const [bTex, wTex] = await Promise.all([
      _loadArtTexture(targetEl, 'body'),
      _loadArtTexture(targetEl, 'weapon'),
    ]);

    if (bTex) {
      is2DMode = true;
      playerGroup.rotation.y = 0; // Face camera in 2.5D mode
      playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);

      const bGeo = new THREE.PlaneGeometry(2.2, 3.0);
      const bMat = new THREE.MeshBasicMaterial({
        map: bTex,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      bodyMesh = new THREE.Mesh(bGeo, bMat);
      bodyMesh.position.set(0, 0, 0); // Ground level
      bodyMesh.rotation.y = Math.PI / 6; // Angled 30° toward the Boss on the right
      playerGroup.add(bodyMesh);

      weaponArmPivot = new THREE.Group();
      weaponArmPivot.position.set(WEAPON_HAND_POS.x, WEAPON_HAND_POS.y, WEAPON_HAND_POS.z);
      weaponArmPivot.rotation.set(0, Math.PI / 6, WEAPON_READY_ROT_Z);

      if (wTex) {
        const wGeo = new THREE.PlaneGeometry(0.8, 2.2);
        wGeo.translate(0, 1.1, 0);
        const wMat = new THREE.MeshBasicMaterial({
          map: wTex,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        weaponMesh = new THREE.Mesh(wGeo, wMat);
        weaponArmPivot.add(weaponMesh);
      } else {
        const blade = makeBox(0.12, 1.6, 0.08, 0x00cfff);
        blade.position.set(0, 0.8, 0);
        weaponArmPivot.add(blade);
      }

      playerGroup.add(weaponArmPivot);

      if (activeElement) _buildElementalAura(activeElement);
      console.log(`[player] 2.5D sprite mesh constructed for ${targetEl}`);
      return;
    }
  }

  // Case B: No Elemental Set equipped (or 'default' active) -> Load Admin's Default 3D Model
  const loadedDefault3D = await _tryLoad3DCharacterAndWeapon('default');
  if (loadedDefault3D) return;

  // 3. Fallback: Only render basic geometric boxes if default_character.glb has not been uploaded yet
  is2DMode = false;
  playerGroup.rotation.y = FACE_Y;
  _build3DBoxCharacter();
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
  }
  to(values, duration) {
    this.toValues = values;
    this.duration = duration || 100;
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
    // Smooth quadratic ease
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
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
  if (is3DModelMode) {
    return handNode || weaponSocket;
  }
  if (is2DMode) {
    return weaponArmPivot;
  }
  return leftShoulderPivot || rightShoulderPivot;
}

/**
 * Dedicated weapon/arm swing Tween (slashMotion):
 * When reaching the Boss:
 * - Wind-up (Lấy đà): Quickly raise weapon hand up and back (+45 to +60 deg, ~80ms)
 * - Slash Strike (Chém dứt khoát): Violently swing weapon forward and downward across Boss (-60 deg, ~120ms)
 * - Hit Impact: Trigger damage effect (-1 HP, boss flinch/spark VFX) exactly at the lowest point of the swing
 * - Reset Stance: Return weapon hand smoothly back to idle combat stance (~100ms) as character steps back
 */
export function playSwordSlashAnimation(onHitCallback, onCompleteCallback) {
  const arm = getWeaponHandNode();
  if (!arm) {
    if (onHitCallback) onHitCallback();
    if (onCompleteCallback) onCompleteCallback();
    return;
  }

  const baseZ = arm._baseRotZ !== undefined ? arm._baseRotZ : arm.rotation.z;
  arm._baseRotZ = baseZ;

  const socket = (arm !== weaponSocket && weaponSocket) ? weaponSocket : null;
  const socketBaseZ = socket ? (socket._baseRotZ !== undefined ? socket._baseRotZ : socket.rotation.z) : 0;
  if (socket) socket._baseRotZ = socketBaseZ;

  // 1. Wind-up (Lấy đà): Quickly raise weapon hand up and back (+45°/+60°, ~80ms)
  new TWEEN.Tween(arm.rotation)
    .to({ z: baseZ + Math.PI / 3 }, 80)
    .onComplete(() => {
      // 2. Powerful forward slash (Chém dứt khoát): Violently swing forward and down (-60°, ~120ms)
      new TWEEN.Tween(arm.rotation)
        .to({ z: baseZ - Math.PI / 3 }, 120)
        .onComplete(() => {
          if (onHitCallback) onHitCallback(); // Boss takes damage at impact point

          // 3. Return to ready stance (~100ms)
          new TWEEN.Tween(arm.rotation)
            .to({ z: baseZ }, 100)
            .onComplete(() => {
              if (onCompleteCallback) onCompleteCallback();
            })
            .start();
        })
        .start();
    })
    .start();

  if (socket) {
    new TWEEN.Tween(socket.rotation)
      .to({ z: socketBaseZ + Math.PI / 4 }, 80)
      .onComplete(() => {
        new TWEEN.Tween(socket.rotation)
          .to({ z: socketBaseZ - Math.PI / 3 }, 120)
          .onComplete(() => {
            new TWEEN.Tween(socket.rotation)
              .to({ z: socketBaseZ }, 100)
              .start();
          })
          .start();
      })
      .start();
  }
}
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
           hitFired: false, _hitEmitted: false };
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
      if (weaponSocket) {
        const baseRot = Math.PI / 4;
        weaponSocket.rotation.z = baseRot + Math.sin(Date.now() * 0.002) * 0.03;
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
  const socket = (is3DModelMode && handNode && weaponSocket) ? weaponSocket : null;

  if (is3DModelMode || is2DMode) {
    const baseZ = (pivot && pivot._baseRotZ !== undefined) ? pivot._baseRotZ : (is2DMode ? WEAPON_READY_ROT_Z : (Math.PI / 4));
    if (pivot) pivot._baseRotZ = baseZ;
    const socketBaseZ = socket ? (socket._baseRotZ !== undefined ? socket._baseRotZ : (Math.PI / 4)) : 0;
    if (socket) socket._baseRotZ = socketBaseZ;

    if (prog < 0.32) {
      // 1. Dash to Boss + Wind-up (Lấy đà ~80ms): arm and weapon raise up and back (+45° to +60°)
      const t = prog / 0.32;
      playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, ATTACK_X, t);
      playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 0.25;
      playerGroup.rotation.y = 0;
      if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(baseZ, baseZ + Math.PI / 3, t);
      if (socket) socket.rotation.z = THREE.MathUtils.lerp(socketBaseZ, socketBaseZ + Math.PI / 4, t);

    } else if (prog < 0.52) {
      // 2. Powerful forward slash strike (Chém dứt khoát ~120ms): arm and weapon swing forward and downward across Boss (-60°)
      const t = (prog - 0.32) / 0.20;
      playerGroup.position.x = ATTACK_X;
      playerGroup.position.y = HOME_Y;
      playerGroup.rotation.y = 0;
      if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(baseZ + Math.PI / 3, baseZ - Math.PI / 3, t);
      if (socket) socket.rotation.z = THREE.MathUtils.lerp(socketBaseZ + Math.PI / 4, socketBaseZ - Math.PI / 3, t);

      // Hit impact: trigger damage effect (-1 HP, boss flinch/spark) exactly at lowest point of swing
      if (prog >= 0.44 && !anim._hitEmitted) {
        anim._hitEmitted = true;
        if (anim.onHit) anim.onHit();
      }
      const b = 1 + Math.sin(t * Math.PI) * 0.12;
      playerGroup.scale.set(b, 1 / b, 1);

    } else if (prog < 0.64) {
      // Hold impact pose briefly
      playerGroup.position.x = ATTACK_X;
      playerGroup.position.y = HOME_Y;
      playerGroup.rotation.y = 0;
      playerGroup.scale.set(1, 1, 1);
      if (pivot) pivot.rotation.z = baseZ - Math.PI / 3;
      if (socket) socket.rotation.z = socketBaseZ - Math.PI / 3;

    } else {
      // 3. Reset stance: return weapon hand smoothly back to idle combat stance (~100ms) as character steps back
      const t = (prog - 0.64) / 0.36;
      playerGroup.position.x = THREE.MathUtils.lerp(ATTACK_X, HOME_X, t);
      playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 0.25;
      playerGroup.rotation.y = 0;
      playerGroup.scale.set(1, 1, 1);
      if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(baseZ - Math.PI / 3, baseZ, t);
      if (socket) socket.rotation.z = THREE.MathUtils.lerp(socketBaseZ - Math.PI / 3, socketBaseZ, t);
    }
    return;
  }

  // 3D Box fallback
  const pivotArm = leftShoulderPivot || rightShoulderPivot;
  if (prog < 0.32) {
    const t = prog / 0.32;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, ATTACK_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 0.5;
    playerGroup.rotation.y = FACE_Y;
    _runLimbs(dt, 18);
    if (pivotArm) {
      pivotArm.rotation.x = THREE.MathUtils.lerp(-Math.PI / 6, -Math.PI / 1.2, t);
      pivotArm.rotation.z = THREE.MathUtils.lerp(0, 0.4, t);
    }
  } else if (prog < 0.52) {
    const t = (prog - 0.32) / 0.20;
    playerGroup.position.x = ATTACK_X;
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = FACE_Y;
    if (pivotArm) {
      pivotArm.rotation.x = THREE.MathUtils.lerp(-Math.PI / 1.2, Math.PI / 3, t);
      pivotArm.rotation.z = THREE.MathUtils.lerp(0.4, -0.3, t);
    }
    if (prog >= 0.44 && !anim._hitEmitted) {
      anim._hitEmitted = true;
      if (anim.onHit) anim.onHit();
    }
    const b = 1 + Math.sin(t * Math.PI) * 0.12;
    playerGroup.scale.set(b, 1 / b, 1);
  } else if (prog < 0.64) {
    playerGroup.position.x = ATTACK_X;
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = FACE_Y;
    playerGroup.scale.set(1, 1, 1);
    if (pivotArm) { pivotArm.rotation.x = Math.PI / 3; pivotArm.rotation.z = -0.3; }
  } else {
    const t = (prog - 0.64) / 0.36;
    playerGroup.position.x = THREE.MathUtils.lerp(ATTACK_X, HOME_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 0.8;
    playerGroup.rotation.y = FACE_Y;
    playerGroup.scale.set(1, 1, 1);
    if (pivotArm) {
      pivotArm.rotation.x = THREE.MathUtils.lerp(Math.PI / 3, -Math.PI / 6, t);
      pivotArm.rotation.z = THREE.MathUtils.lerp(-0.3, 0, t);
    }
    _runLimbs(dt, 12);
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
  const socket = (is3DModelMode && handNode && weaponSocket) ? weaponSocket : null;

  if (is3DModelMode || is2DMode) {
    const baseZ = (pivot && pivot._baseRotZ !== undefined) ? pivot._baseRotZ : (is2DMode ? WEAPON_READY_ROT_Z : (Math.PI / 4));
    if (pivot) pivot._baseRotZ = baseZ;
    const socketBaseZ = socket ? (socket._baseRotZ !== undefined ? socket._baseRotZ : (Math.PI / 4)) : 0;
    if (socket) socket._baseRotZ = socketBaseZ;

    if (prog < 0.43) {
      // 1. Bay lên cao + Lấy đà (350ms): leap high above Boss, weapon raised high
      const t = prog / 0.43;
      playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, APEX_X, t);
      playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI * 0.5) * 3.5;
      playerGroup.rotation.y = 0;
      if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(baseZ, baseZ + Math.PI / 2.2, t);
      if (socket) socket.rotation.z = THREE.MathUtils.lerp(socketBaseZ, socketBaseZ + Math.PI / 3, t);

    } else if (prog < 0.65) {
      // 2. Bổ xuống chém cực mạnh (180ms): dive straight down, slash downward across Boss head
      const t = (prog - 0.43) / 0.22;
      playerGroup.position.x = APEX_X;
      playerGroup.position.y = APEX_Y - t * 3.5;
      playerGroup.rotation.y = 0;
      if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(baseZ + Math.PI / 2.2, baseZ - Math.PI / 2.2, t);
      if (socket) socket.rotation.z = THREE.MathUtils.lerp(socketBaseZ + Math.PI / 3, socketBaseZ - Math.PI / 2.5, t);

      if (prog >= 0.58 && !anim._hitEmitted) {
        anim._hitEmitted = true;
        if (anim.onHit) anim.onHit();
      }
      const b = 1 + Math.sin(t * Math.PI) * 0.12;
      playerGroup.scale.set(b, 1 / b, 1);

    } else {
      // 3. Lùi về và trở về thế thủ (280ms): leap back to original spot
      const t = (prog - 0.65) / 0.35;
      playerGroup.position.x = THREE.MathUtils.lerp(APEX_X, HOME_X, t);
      playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 1.5;
      playerGroup.rotation.y = 0;
      playerGroup.scale.set(1, 1, 1);
      if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(baseZ - Math.PI / 2.2, baseZ, t);
      if (socket) socket.rotation.z = THREE.MathUtils.lerp(socketBaseZ - Math.PI / 2.5, socketBaseZ, t);
    }
    return;
  }

  // 3D Box fallback
  const pivotArm = leftShoulderPivot || rightShoulderPivot;
  if (prog < 0.43) {
    const t = prog / 0.43;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, APEX_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI * 0.5) * 4.5;
    playerGroup.rotation.y = FACE_Y;
    _runLimbs(dt, 10);
    if (pivotArm) {
      pivotArm.rotation.x = THREE.MathUtils.lerp(-Math.PI / 6, -Math.PI / 1.0, t);
      pivotArm.rotation.z = 0;
    }
  } else if (prog < 0.65) {
    const t = (prog - 0.43) / 0.22;
    playerGroup.position.x = APEX_X;
    playerGroup.position.y = (HOME_Y + 4.5) - t * 4.5;
    playerGroup.rotation.y = FACE_Y;
    if (pivotArm) {
      pivotArm.rotation.x = THREE.MathUtils.lerp(-Math.PI / 1.0, Math.PI / 2.5, t);
      pivotArm.rotation.z = 0;
    }
    if (prog >= 0.58 && !anim._hitEmitted) {
      anim._hitEmitted = true;
      if (anim.onHit) anim.onHit();
    }
    playerGroup.scale.set(1 + t * 0.10, 1 - t * 0.07, 1);
  } else {
    const t = (prog - 0.65) / 0.35;
    playerGroup.position.x = THREE.MathUtils.lerp(APEX_X, HOME_X, t);
    playerGroup.position.y = HOME_Y + Math.sin(t * Math.PI) * 2.0;
    playerGroup.rotation.y = FACE_Y;
    playerGroup.scale.set(1, 1, 1);
    if (pivotArm) pivotArm.rotation.x = THREE.MathUtils.lerp(Math.PI / 2.5, -Math.PI / 6, t);
    _runLimbs(dt, 14);
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
  const socket = (is3DModelMode && handNode && weaponSocket) ? weaponSocket : null;

  if (is3DModelMode || is2DMode) {
    const baseZ = (pivot && pivot._baseRotZ !== undefined) ? pivot._baseRotZ : (is2DMode ? WEAPON_READY_ROT_Z : (Math.PI / 4));
    if (pivot) pivot._baseRotZ = baseZ;
    const socketBaseZ = socket ? (socket._baseRotZ !== undefined ? socket._baseRotZ : (Math.PI / 4)) : 0;
    if (socket) socket._baseRotZ = socketBaseZ;

    if (prog < 0.36) {
      // 1. Lướt chém + Lấy đà (200ms)
      const t = prog / 0.36;
      playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, ATTACK_X, t);
      playerGroup.position.y = HOME_Y;
      playerGroup.rotation.y = 0;
      if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(baseZ, baseZ - 1.57, t);
      if (socket) socket.rotation.z = THREE.MathUtils.lerp(socketBaseZ, socketBaseZ - 1.2, t);

      if (prog >= 0.28 && !anim._hitEmitted) {
        anim._hitEmitted = true;
        if (anim.onHit) anim.onHit();
      }
      const b = 1 + Math.sin(t * Math.PI) * 0.08;
      playerGroup.scale.set(b, 1 / b, 1);
    } else if (prog < 0.54) {
      // 2. Hold pose (100ms)
      playerGroup.position.x = ATTACK_X;
      playerGroup.position.y = HOME_Y;
      playerGroup.rotation.y = 0;
      playerGroup.scale.set(1, 1, 1);
      if (pivot) pivot.rotation.z = baseZ - 1.57;
      if (socket) socket.rotation.z = socketBaseZ - 1.2;
    } else {
      // 3. Lùi lại về thế thủ (250ms)
      const t = (prog - 0.54) / 0.46;
      playerGroup.position.x = THREE.MathUtils.lerp(ATTACK_X, HOME_X, t);
      playerGroup.position.y = HOME_Y;
      playerGroup.rotation.y = 0;
      playerGroup.scale.set(1, 1, 1);
      if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(baseZ - 1.57, baseZ, t);
      if (socket) socket.rotation.z = THREE.MathUtils.lerp(socketBaseZ - 1.2, socketBaseZ, t);
    }
    return;
  }

  // 3D Box fallback
  const pivotArm = leftShoulderPivot || rightShoulderPivot;
  if (prog < 0.36) {
    const t = prog / 0.36;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X, ATTACK_X, t);
    playerGroup.position.y = HOME_Y - 0.2;
    playerGroup.rotation.y = FACE_Y;
    if (pivotArm) {
      pivotArm.rotation.x = THREE.MathUtils.lerp(-Math.PI / 6, -Math.PI / 2, t);
      pivotArm.rotation.z = THREE.MathUtils.lerp(0, -0.4, t);
    }
    if (prog >= 0.28 && !anim._hitEmitted) {
      anim._hitEmitted = true;
      if (anim.onHit) anim.onHit();
    }
  } else if (prog < 0.54) {
    playerGroup.position.x = ATTACK_X;
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = FACE_Y;
  } else {
    const t = (prog - 0.54) / 0.46;
    playerGroup.position.x = THREE.MathUtils.lerp(ATTACK_X, HOME_X, t);
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = FACE_Y;
    if (pivotArm) {
      pivotArm.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, -Math.PI / 6, t);
      pivotArm.rotation.z = THREE.MathUtils.lerp(-0.4, 0, t);
    }
    _runLimbs(dt, 14);
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// ④ FIRE — Hỏa Luân Trảm (Full Set Lửa)
//   1. Đứng tại chỗ: chém uy lực về phía trước (250ms)
//   2. Phóng kiếm khí hỏa diễm về phía Boss
//   3. Hồi phục về thế thủ (300ms)
// ═════════════════════════════════════════════════════════════════════════════
function _animFire(prog, dt) {
  const pivot = getWeaponHandNode();
  const socket = (is3DModelMode && handNode && weaponSocket) ? weaponSocket : null;

  if (is3DModelMode || is2DMode) {
    const baseZ = (pivot && pivot._baseRotZ !== undefined) ? pivot._baseRotZ : (is2DMode ? WEAPON_READY_ROT_Z : (Math.PI / 4));
    if (pivot) pivot._baseRotZ = baseZ;
    const socketBaseZ = socket ? (socket._baseRotZ !== undefined ? socket._baseRotZ : (Math.PI / 4)) : 0;
    if (socket) socket._baseRotZ = socketBaseZ;

    if (prog < 0.45) {
      // 1. Đứng tại chỗ (250ms): power swing forward
      playerGroup.position.x = HOME_X + Math.sin(prog / 0.45 * Math.PI) * 0.3;
      playerGroup.position.y = HOME_Y;
      playerGroup.rotation.y = 0;
      if (prog < 0.16) {
        const t = prog / 0.16;
        if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(baseZ, baseZ + 0.4, t);
        if (socket) socket.rotation.z = THREE.MathUtils.lerp(socketBaseZ, socketBaseZ + 0.3, t);
      } else {
        const t = (prog - 0.16) / 0.29;
        if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(baseZ + 0.4, baseZ - 1.4, t);
        if (socket) socket.rotation.z = THREE.MathUtils.lerp(socketBaseZ + 0.3, socketBaseZ - 1.2, t);
      }
      if (prog >= 0.38 && !anim._hitEmitted) {
        anim._hitEmitted = true;
        if (anim.onHit) anim.onHit();
      }
      const b = 1 + Math.sin(prog / 0.45 * Math.PI) * 0.08;
      playerGroup.scale.set(b, 1 / b, 1);
    } else {
      // 2. Hồi phục về thế thủ (300ms)
      const t = (prog - 0.45) / 0.55;
      playerGroup.position.x = THREE.MathUtils.lerp(HOME_X + 0.3, HOME_X, t);
      playerGroup.position.y = HOME_Y;
      playerGroup.scale.set(1, 1, 1);
      if (pivot) pivot.rotation.z = THREE.MathUtils.lerp(baseZ - 1.4, baseZ, t);
      if (socket) socket.rotation.z = THREE.MathUtils.lerp(socketBaseZ - 1.2, socketBaseZ, t);
    }
    return;
  }

  // 3D Box fallback
  const pivotArm = leftShoulderPivot || rightShoulderPivot;
  if (prog < 0.45) {
    playerGroup.position.x = HOME_X + Math.sin(prog / 0.45 * Math.PI) * 0.4;
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = FACE_Y;
    if (prog < 0.16) {
      const t = prog / 0.16;
      if (pivotArm) pivotArm.rotation.x = THREE.MathUtils.lerp(-Math.PI / 6, -Math.PI / 1.3, t);
    } else {
      const t = (prog - 0.16) / 0.29;
      if (pivotArm) pivotArm.rotation.x = THREE.MathUtils.lerp(-Math.PI / 1.3, Math.PI / 1.8, t);
    }
    if (prog >= 0.38 && !anim._hitEmitted) {
      anim._hitEmitted = true;
      if (anim.onHit) anim.onHit();
    }
  } else {
    const t = (prog - 0.45) / 0.55;
    playerGroup.position.x = THREE.MathUtils.lerp(HOME_X + 0.4, HOME_X, t);
    playerGroup.position.y = HOME_Y;
    playerGroup.rotation.y = FACE_Y;
    if (pivotArm) pivotArm.rotation.x = THREE.MathUtils.lerp(Math.PI / 1.8, -Math.PI / 6, t);
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
    if (weaponSocket) weaponSocket.rotation.set(0, 0, Math.PI / 4);
  } else if (is2DMode) {
    if (bodyMesh) {
      bodyMesh.position.set(0, 0, 0);
      bodyMesh.rotation.set(0, Math.PI / 6, 0);
    }
    if (weaponArmPivot) {
      weaponArmPivot.position.set(WEAPON_HAND_POS.x, WEAPON_HAND_POS.y, WEAPON_HAND_POS.z);
      weaponArmPivot.rotation.set(0, Math.PI / 6, WEAPON_READY_ROT_Z);
    }
  } else {
    if (leftLeg)            leftLeg.rotation.x            = 0;
    if (rightLeg)           rightLeg.rotation.x           = 0;
    if (rightArm)           rightArm.rotation.x           = 0;
    if (leftShoulderPivot)  { leftShoulderPivot.rotation.x = -Math.PI / 6; leftShoulderPivot.rotation.z = 0; }
  }
  walkCycle = 0;
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

