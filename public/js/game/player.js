// THREE is available as a global from CDN or importmap
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// Setup DRACOLoader and GLTFLoader
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
export const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

if (typeof window !== 'undefined' && window.THREE && !window.THREE.GLTFLoader) {
  window.THREE.GLTFLoader = GLTFLoader;
}

// ─────────────────────────────────────────────────────────────────────────────
// Module state
// ─────────────────────────────────────────────────────────────────────────────
let playerGroup = null;
let activeElement = null; // 'thunder' | 'fire' | 'frost' | 'default'

// Root container for 3D character mesh
let characterRoot = null;
let characterMesh = null;
let weaponMesh = null;

// Universal 3D Arm Pivot & Compound Limb Hierarchy
export let combatArmCompound = null;
export let playerArmPivot = null;

export function getCombatArmCompound() {
  return combatArmCompound || playerArmPivot;
}
export function getPlayerArmPivot() {
  return combatArmCompound || playerArmPivot;
}
export function getWeaponHandNode() {
  return combatArmCompound || playerArmPivot;
}

// Layout constants
const HOME_X = -4.5;
const HOME_Y = 0.0;
const HOME_Z = 0.0;
const FACE_ROT_Y = Math.PI / 2; // Face +X axis towards Boss

// Socket & Pivot defaults
let shoulderPivotPos = { x: 0.65, y: 1.10, z: 0.0 };
let weaponOffsetPos  = { offsetX: 0.0, offsetY: -0.4, offsetZ: 0.1, angle: -45 };

// Active Animation Flags
let isDashing = false;
let isSlashing = false;
let isDodging = false;
let isHurt = false;

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL 3D MESH BUILDERS (ROBUST FALLBACK IF GLB NOT ON DISK)
// ─────────────────────────────────────────────────────────────────────────────

function createProceduralSword(element) {
  const group = new THREE.Group();

  let bladeColor = 0xdddddd;
  let emissiveColor = 0x00b4d8;
  if (element === 'fire') {
    bladeColor = 0xff6600;
    emissiveColor = 0xff3300;
  } else if (element === 'thunder') {
    bladeColor = 0x00ffff;
    emissiveColor = 0x00e5ff;
  } else if (element === 'frost') {
    bladeColor = 0x99ddff;
    emissiveColor = 0x00aaff;
  }

  // Blade (tall and sharp)
  const bladeGeo = new THREE.BoxGeometry(0.14, 1.8, 0.04);
  const bladeMat = new THREE.MeshStandardMaterial({
    color: bladeColor,
    metalness: 0.85,
    roughness: 0.2,
    emissive: emissiveColor,
    emissiveIntensity: 0.35,
  });
  const blade = new THREE.Mesh(bladeGeo, bladeMat);
  blade.position.y = 0.9;
  group.add(blade);

  // Crossguard
  const guardGeo = new THREE.BoxGeometry(0.45, 0.08, 0.12);
  const guardMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6, roughness: 0.3 });
  const guard = new THREE.Mesh(guardGeo, guardMat);
  guard.position.y = 0.04;
  group.add(guard);

  // Hilt
  const hiltGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8);
  const hiltMat = new THREE.MeshStandardMaterial({ color: 0x3d2b1f, roughness: 0.8 });
  const hilt = new THREE.Mesh(hiltGeo, hiltMat);
  hilt.position.y = -0.2;
  group.add(hilt);

  // Pommel
  const pommelGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const pommelMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.6 });
  const pommel = new THREE.Mesh(pommelGeo, pommelMat);
  pommel.position.y = -0.42;
  group.add(pommel);

  return group;
}

function createProceduralHumanoid(element, playerColor) {
  const group = new THREE.Group();

  let bodyColor = playerColor ? new THREE.Color(playerColor).getHex() : 0x2255cc;
  let accentColor = 0xff6b35;

  if (element === 'fire') {
    bodyColor = 0xcc2200;
    accentColor = 0xff6600;
  } else if (element === 'thunder') {
    bodyColor = 0x0088cc;
    accentColor = 0x00ffff;
  } else if (element === 'frost') {
    bodyColor = 0x4499cc;
    accentColor = 0x88ddff;
  }

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c4a0, roughness: 0.6 });
  const clothMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.5 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x222233, roughness: 0.7 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.4, emissive: accentColor, emissiveIntensity: 0.2 });

  // Head (height: ~3.2, size: 0.9)
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), skinMat);
  head.position.y = 3.25;
  head.castShadow = true;
  group.add(head);

  // Face / Eyes
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), eyeMat);
  leftEye.position.set(-0.2, 3.3, 0.46);
  group.add(leftEye);

  const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.05), eyeMat);
  rightEye.position.set(0.2, 3.3, 0.46);
  group.add(rightEye);

  // Torso (height: ~2.1, size: 1.2 x 1.4 x 0.6)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.6), clothMat);
  torso.position.y = 2.1;
  torso.castShadow = true;
  group.add(torso);

  // Chest emblem
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.05), accentMat);
  chest.position.set(0, 2.2, 0.32);
  group.add(chest);

  // Left Arm
  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, 0.4), skinMat);
  lArm.position.set(-0.85, 2.05, 0);
  lArm.castShadow = true;
  group.add(lArm);

  // Left Leg & Right Leg
  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.45), pantsMat);
  lLeg.position.set(-0.3, 0.7, 0);
  lLeg.castShadow = true;
  group.add(lLeg);

  const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.45), pantsMat);
  rLeg.position.set(0.3, 0.7, 0);
  rLeg.castShadow = true;
  group.add(rLeg);

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D GLTF MODEL LOADING & BOUNDING BOX NORMALIZATION
// ─────────────────────────────────────────────────────────────────────────────

async function loadGLTFModel(url) {
  return new Promise((resolve) => {
    try {
      gltfLoader.load(
        url,
        (gltf) => resolve(gltf),
        undefined,
        () => resolve(null)
      );
    } catch (e) {
      resolve(null);
    }
  });
}

async function loadPlayer3DCharacterAndWeapon(element, playerColor) {
  const el = element || 'default';

  // 1. Candidate paths for Character GLB
  const charCandidates = [
    `/assets/character/${el === 'fire' ? 'Fire%20player' : el === 'thunder' ? 'Lightning%20player' : el === 'frost' ? 'Ice%20player' : 'Player'}.glb`,
    `/assets/character/${el}_character.glb`,
    `/assets/character/Player.glb`,
    `/assets/character/default_character.glb`,
    `/assets/models/${el}_character.glb`,
    `/assets/models/default_character.glb`,
  ];

  let charGltf = null;
  for (const url of charCandidates) {
    charGltf = await loadGLTFModel(url);
    if (charGltf && charGltf.scene) {
      console.log('[player] Successfully loaded 3D character GLB:', url);
      break;
    }
  }

  // Clear previous mesh in characterRoot
  while (characterRoot.children.length > 0) {
    characterRoot.remove(characterRoot.children[0]);
  }

  if (charGltf && charGltf.scene) {
    characterMesh = charGltf.scene;

    // Compute bounding box & normalize to human scale (~3.8 units tall)
    const box = new THREE.Box3().setFromObject(characterMesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const targetHeight = 3.8;
    const scale = size.y > 0 ? (targetHeight / size.y) : 1.0;
    characterMesh.scale.set(scale, scale, scale);

    // Center horizontally and align feet directly to floor (y = 0.0)
    characterMesh.position.x = -center.x * scale;
    characterMesh.position.y = -box.min.y * scale;
    characterMesh.position.z = -center.z * scale;

    characterMesh.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    characterRoot.add(characterMesh);
  } else {
    // Fallback: Procedural 3D box humanoid standing tall on floor
    console.log('[player] Using procedural 3D humanoid model for', el);
    characterMesh = createProceduralHumanoid(el, playerColor);
    characterRoot.add(characterMesh);
  }

  // 2. Candidate paths for Weapon GLB
  const weaponCandidates = [
    `/assets/character/${el === 'fire' ? 'Fire%20sword' : el === 'thunder' ? 'Lightning%20sword' : el === 'frost' ? 'Ice%20sword' : 'Normal%20Sword'}.glb`,
    `/assets/character/${el}_weapon.glb`,
    `/assets/character/Normal Sword.glb`,
    `/assets/character/default_weapon.glb`,
    `/assets/models/${el}_weapon.glb`,
    `/assets/models/default_weapon.glb`,
  ];

  let weaponGltf = null;
  for (const url of weaponCandidates) {
    weaponGltf = await loadGLTFModel(url);
    if (weaponGltf && weaponGltf.scene) {
      console.log('[player] Successfully loaded 3D weapon GLB:', url);
      break;
    }
  }

  // Mount arm compound
  buildArmAndWeaponCompound(weaponGltf ? weaponGltf.scene : null, el);
}

function buildArmAndWeaponCompound(loadedWeaponScene, element) {
  // Remove previous arm compound
  if (combatArmCompound && characterRoot) {
    characterRoot.remove(combatArmCompound);
    combatArmCompound = null;
  }

  combatArmCompound = new THREE.Group();
  combatArmCompound.position.set(shoulderPivotPos.x, shoulderPivotPos.y, shoulderPivotPos.z);

  // Right arm representation
  const rightArmGeo = new THREE.BoxGeometry(0.38, 1.3, 0.38);
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c4a0, roughness: 0.6 });
  const rightArmMesh = new THREE.Mesh(rightArmGeo, skinMat);
  rightArmMesh.position.set(0, -0.65, 0); // Hang down from shoulder pivot
  rightArmMesh.castShadow = true;
  combatArmCompound.add(rightArmMesh);

  // Weapon socket mounted into arm
  const weaponSocket = new THREE.Group();
  weaponSocket.position.set(weaponOffsetPos.offsetX, weaponOffsetPos.offsetY, weaponOffsetPos.offsetZ);
  weaponSocket.rotation.set(0, 0, (weaponOffsetPos.angle * Math.PI) / 180);

  if (loadedWeaponScene) {
    weaponMesh = loadedWeaponScene;
    // Normalize weapon bounding box
    const wBox = new THREE.Box3().setFromObject(weaponMesh);
    const wSize = new THREE.Vector3();
    wBox.getSize(wSize);
    const wTargetLength = 2.2;
    const wScale = wSize.y > 0 ? (wTargetLength / wSize.y) : 1.0;
    weaponMesh.scale.set(wScale, wScale, wScale);
    weaponSocket.add(weaponMesh);
  } else {
    weaponMesh = createProceduralSword(element);
    weaponSocket.add(weaponMesh);
  }

  combatArmCompound.add(weaponSocket);
  characterRoot.add(combatArmCompound);

  playerArmPivot = combatArmCompound;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: CREATE & UPDATE PLAYER
// ─────────────────────────────────────────────────────────────────────────────

export function createPlayer(color = '#ff6b35', element = 'fire', equippedGear = null) {
  activeElement = element || 'fire';

  if (!playerGroup) {
    playerGroup = new THREE.Group();
  }

  // Clear existing children
  while (playerGroup.children.length > 0) {
    playerGroup.remove(playerGroup.children[0]);
  }

  // Character root sits at home position facing +X towards Boss
  characterRoot = new THREE.Group();
  playerGroup.add(characterRoot);

  playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
  playerGroup.rotation.y = FACE_ROT_Y; // Face +X (Boss)

  // Load 3D model with fallback
  loadPlayer3DCharacterAndWeapon(activeElement, color);

  return playerGroup;
}

export function createPlayerMesh(element, equippedGear) {
  activeElement = element || 'fire';
  if (playerGroup) {
    loadPlayer3DCharacterAndWeapon(activeElement);
  }
}

export function applyElementalSet(element) {
  if (!element) return;
  activeElement = element;
  if (playerGroup) {
    loadPlayer3DCharacterAndWeapon(activeElement);
  }
}

export function getPlayerObject() {
  return playerGroup;
}

export function getPosition() {
  return playerGroup ? playerGroup.position : new THREE.Vector3(HOME_X, HOME_Y, HOME_Z);
}

export function getRotation() {
  return playerGroup ? playerGroup.rotation : new THREE.Euler(0, FACE_ROT_Y, 0);
}

export function getActiveElement() {
  return activeElement || 'fire';
}

export function resetPlayerState() {
  if (playerGroup) {
    playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
    playerGroup.rotation.y = FACE_ROT_Y;
  }
  if (combatArmCompound) {
    combatArmCompound.rotation.set(0, 0, 0);
  }
  isDashing = false;
  isSlashing = false;
  isDodging = false;
  isHurt = false;
}

export function updatePlayer(deltaTime) {
  // Can be used for idle floating or breathing
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D COMBAT SLASHING & DODGE ANIMATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Executes pure 3D combat slashing animation:
 * 1. Dash forward to Boss.
 * 2. Rotate 3D arm pivot:
 *    - Wind-up: rotation.z = Math.PI / 3 (~100ms)
 *    - Slash: rotation.z = -Math.PI / 2.5 (~120ms) -> Triggers onHit()
 *    - Return: rotation.z = 0 (~100ms)
 * 3. Dash back to initial position.
 * 4. Call onDone() when back at home.
 */
export function playCombatAnimation(animType, { onHit, onDone } = {}) {
  if (!playerGroup) {
    if (onHit) onHit();
    if (onDone) onDone();
    return;
  }

  const arm = combatArmCompound;
  const startX = HOME_X;
  const targetX = 0.5; // Forward near Boss
  let hitTriggered = false;

  const DASH_FWD_MS = 160;
  const WINDUP_MS   = 100;
  const SLASH_MS    = 120;
  const RETURN_MS   = 100;
  const DASH_BACK_MS = 160;

  const t0 = 0;
  const t1 = t0 + DASH_FWD_MS;                     // 160
  const t2 = t1 + WINDUP_MS;                       // 260
  const t3 = t2 + SLASH_MS;                        // 380 (Strike)
  const t4 = t3 + RETURN_MS;                       // 480
  const tTotal = t4 + DASH_BACK_MS;                // 640

  const startTime = performance.now();
  isSlashing = true;

  function stepCombat(now) {
    const elapsed = now - startTime;

    // 1. Dash Forward
    if (elapsed < t1) {
      const p = elapsed / DASH_FWD_MS;
      const ease = p * (2 - p); // QuadOut
      playerGroup.position.x = THREE.MathUtils.lerp(startX, targetX, ease);
    }
    // 2. Wind-up Arm
    else if (elapsed < t2) {
      playerGroup.position.x = targetX;
      const p = (elapsed - t1) / WINDUP_MS;
      if (arm) arm.rotation.z = THREE.MathUtils.lerp(0, Math.PI / 3, p);
    }
    // 3. Slash Down Across -> Hit
    else if (elapsed < t3) {
      playerGroup.position.x = targetX;
      const p = (elapsed - t2) / SLASH_MS;
      const ease = p * p; // QuadIn
      if (arm) arm.rotation.z = THREE.MathUtils.lerp(Math.PI / 3, -Math.PI / 2.5, ease);
      if (p >= 0.85 && !hitTriggered) {
        hitTriggered = true;
        if (onHit) onHit();
      }
    }
    // 4. Return Arm to Idle
    else if (elapsed < t4) {
      playerGroup.position.x = targetX;
      if (!hitTriggered) {
        hitTriggered = true;
        if (onHit) onHit();
      }
      const p = (elapsed - t3) / RETURN_MS;
      if (arm) arm.rotation.z = THREE.MathUtils.lerp(-Math.PI / 2.5, 0, p);
    }
    // 5. Dash Back to Home
    else if (elapsed < tTotal) {
      if (arm) arm.rotation.z = 0;
      const p = (elapsed - t4) / DASH_BACK_MS;
      const ease = p * (2 - p);
      playerGroup.position.x = THREE.MathUtils.lerp(targetX, startX, ease);
    }
    // 6. Complete
    else {
      playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
      if (arm) arm.rotation.z = 0;
      isSlashing = false;
      if (onDone) onDone();
      return;
    }

    requestAnimationFrame(stepCombat);
  }

  requestAnimationFrame(stepCombat);
}

export function slashAnimation(onHit, onDone) {
  playCombatAnimation(activeElement || 'normal', { onHit, onDone });
}

export function playGuaranteedPlayerSlash(onHit, onDone) {
  playCombatAnimation(activeElement || 'normal', { onHit, onDone });
}

export function playArmSwingSlash(onHit, onDone) {
  playCombatAnimation(activeElement || 'normal', { onHit, onDone });
}

export function playAttack(onDone) {
  playCombatAnimation(activeElement || 'normal', { onDone });
}

/**
 * Player executes evasive dodge roll / hop
 */
export function playDodge(onDone) {
  if (!playerGroup) {
    if (onDone) onDone();
    return;
  }

  isDodging = true;
  const startTime = performance.now();
  const DURATION = 320; // ms

  function stepDodge(now) {
    const elapsed = now - startTime;
    const p = Math.min(1.0, elapsed / DURATION);

    // Hop up and back
    const jumpY = Math.sin(p * Math.PI) * 1.4;
    const slideX = -Math.sin(p * Math.PI) * 0.8;

    playerGroup.position.set(HOME_X + slideX, HOME_Y + jumpY, HOME_Z);

    if (p < 1.0) {
      requestAnimationFrame(stepDodge);
    } else {
      playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
      isDodging = false;
      if (onDone) onDone();
    }
  }

  requestAnimationFrame(stepDodge);
}

/**
 * Player flinches and flashes red on taking damage
 */
export function playHurt(onDone) {
  if (!playerGroup) {
    if (onDone) onDone();
    return;
  }

  isHurt = true;
  const startTime = performance.now();
  const DURATION = 300;

  // Flash materials
  const originalEmissives = [];
  playerGroup.traverse((child) => {
    if (child.isMesh && child.material) {
      originalEmissives.push({
        mesh: child,
        color: child.material.emissive ? child.material.emissive.getHex() : 0,
        intensity: child.material.emissiveIntensity || 0,
      });
      if (child.material.emissive) {
        child.material.emissive.setHex(0xff2222);
        child.material.emissiveIntensity = 0.8;
      }
    }
  });

  function stepHurt(now) {
    const elapsed = now - startTime;
    const p = Math.min(1.0, elapsed / DURATION);

    // Stagger back slightly
    const recoilX = -Math.sin(p * Math.PI) * 0.7;
    const shakeZ = Math.sin(p * Math.PI * 4) * 0.15;
    playerGroup.position.set(HOME_X + recoilX, HOME_Y, HOME_Z + shakeZ);

    if (p < 1.0) {
      requestAnimationFrame(stepHurt);
    } else {
      // Restore emissive
      originalEmissives.forEach(({ mesh, color, intensity }) => {
        if (mesh.material && mesh.material.emissive) {
          mesh.material.emissive.setHex(color);
          mesh.material.emissiveIntensity = intensity;
        }
      });
      playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
      isHurt = false;
      if (onDone) onDone();
    }
  }

  requestAnimationFrame(stepHurt);
}
