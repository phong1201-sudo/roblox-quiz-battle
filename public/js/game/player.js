// Pure 3D GLB Character & Combat Pipeline with Fail-Safe Fallbacks
// Uses global window.THREE loaded via CDN
const THREE = (typeof window !== 'undefined' && window.THREE) ? window.THREE : null;

// Module state
let playerGroup = null;
let activeElement = null; // 'thunder' | 'fire' | 'frost' | 'default'

let characterRoot = null;
let currentCharacterMesh = null;
let currentWeaponMesh = null;

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
const FACE_ROT_Y = Math.PI / 2; // Face towards Boss (+X)

// Default shoulder and weapon offsets
let shoulderPivotPos = { x: 0.65, y: 1.10, z: 0.0 };
let weaponOffsetPos  = { offsetX: 0.0, offsetY: -0.4, offsetZ: 0.1, angle: -45 };

// Active Animation Flags
let isDashing = false;
let isSlashing = false;
let isDodging = false;
let isHurt = false;

// ─────────────────────────────────────────────────────────────────────────────
// FAIL-SAFE 3D CHARACTER LOADING (EXACT SPECIFICATION)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads a 3D player GLB model with automatic bounding-box scaling and emergency fallback.
 * @param {THREE.Scene|THREE.Group} targetScene 
 * @param {string} outfitElement 
 * @param {Function} [onLoaded] 
 */
export function loadPlayerModel(targetScene, outfitElement = 'fire', onLoaded) {
  const scene = targetScene || playerGroup;
  const GLTFLoaderClass = (typeof THREE !== 'undefined' && THREE.GLTFLoader)
    ? THREE.GLTFLoader
    : (typeof window !== 'undefined' ? window.THREE?.GLTFLoader : null);

  const modelPath = `/assets/character/player_${outfitElement}.glb`;

  // Candidate URLs in priority order
  const candidateUrls = [
    modelPath,
    `/assets/character/${outfitElement === 'fire' ? 'Fire%20player' : outfitElement === 'thunder' ? 'Lightning%20player' : outfitElement === 'frost' ? 'Ice%20player' : 'Player'}.glb`,
    `/assets/character/${outfitElement}_character.glb`,
    `/assets/character/Player.glb`,
    `/assets/models/${outfitElement}_character.glb`,
    `/assets/models/default_character.glb`
  ];

  if (!GLTFLoaderClass) {
    console.warn('[player] THREE.GLTFLoader not available, using emergency placeholder');
    createEmergencyPlaceholder(scene, onLoaded);
    return;
  }

  const loader = new GLTFLoaderClass();

  function tryLoadIndex(idx) {
    if (idx >= candidateUrls.length) {
      console.warn(`[player] Failed to load GLB at ${modelPath}, using emergency placeholder`);
      createEmergencyPlaceholder(scene, onLoaded);
      return;
    }

    const currentUrl = candidateUrls[idx];
    loader.load(
      currentUrl,
      (gltf) => {
        try {
          const model = gltf.scene;

          // Safe bounding box calculation
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;
          const scale = 3.5 / maxDim;
          model.scale.set(scale, scale, scale);

          // Positioning on arena floor
          model.position.set(-4.5, 0, 0);
          model.rotation.y = Math.PI / 2; // Face towards Boss (+X)

          // Enable shadows
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          // Replace placeholder if characterRoot exists
          if (characterRoot) {
            while (characterRoot.children.length > 0) {
              characterRoot.remove(characterRoot.children[0]);
            }
            // If mounted inside playerGroup, offset relative to group
            model.position.set(0, 0, 0);
            model.rotation.y = 0;
            characterRoot.add(model);
          } else if (scene) {
            scene.add(model);
          }

          // Proven Static Weapon Attachment: find or create right-hand anchor point
          let handAnchor = model.getObjectByName('RightHand') ||
                           model.getObjectByName('hand_r') ||
                           model.getObjectByName('mixamorigRightHand') ||
                           model.getObjectByName('RightArm') ||
                           model.getObjectByName('arm_r');

          if (!handAnchor) {
            handAnchor = new THREE.Group();
            handAnchor.name = 'RightHandAnchor';
            handAnchor.position.set(0.55, 1.05, 0.15); // Coordinates previously validated
            model.add(handAnchor);
          }

          // Attach the sword mesh as a child of this hand anchor
          if (currentWeaponMesh && currentWeaponMesh.parent) {
            currentWeaponMesh.parent.remove(currentWeaponMesh);
          }
          currentWeaponMesh = createProceduralSword(outfitElement);
          // Orient blade forward pointing at Boss (+X axis)
          currentWeaponMesh.rotation.set(0, 0, -Math.PI / 4);
          handAnchor.add(currentWeaponMesh);

          combatArmCompound = handAnchor;
          playerArmPivot = handAnchor;

          currentCharacterMesh = model;
          console.log(`[player] 3D GLB successfully loaded with static weapon mount from ${currentUrl}`);
          if (onLoaded) onLoaded(model);
        } catch (err) {
          console.error('[player] Error processing GLB mesh:', err);
          createEmergencyPlaceholder(scene, onLoaded);
        }
      },
      undefined,
      (error) => {
        // Try next candidate or fallback
        tryLoadIndex(idx + 1);
      }
    );
  }

  tryLoadIndex(0);
}

function createEmergencyPlaceholder(scene, onLoaded) {
  if (!THREE) return;
  // Emergency Fallback: Blocky placeholder so the screen NEVER goes black
  const placeholder = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 3.5, 1.2),
    new THREE.MeshStandardMaterial({
      color: activeElement === 'fire' ? 0xff4400 : activeElement === 'thunder' ? 0x00cfff : activeElement === 'frost' ? 0x00b4d8 : 0x2255cc,
      metalness: 0.2,
      roughness: 0.5
    })
  );

  const handAnchor = new THREE.Group();
  handAnchor.name = 'RightHandAnchor';
  handAnchor.position.set(0.55, 1.05, 0.15);
  placeholder.add(handAnchor);

  if (currentWeaponMesh && currentWeaponMesh.parent) {
    currentWeaponMesh.parent.remove(currentWeaponMesh);
  }
  currentWeaponMesh = createProceduralSword(activeElement);
  currentWeaponMesh.rotation.set(0, 0, -Math.PI / 4);
  handAnchor.add(currentWeaponMesh);

  combatArmCompound = handAnchor;
  playerArmPivot = handAnchor;

  if (characterRoot) {
    while (characterRoot.children.length > 0) {
      characterRoot.remove(characterRoot.children[0]);
    }
    placeholder.position.set(0, 1.75, 0);
    characterRoot.add(placeholder);
  } else if (scene) {
    placeholder.position.set(-4.5, 1.75, 0);
    placeholder.rotation.y = Math.PI / 2;
    scene.add(placeholder);
  }

  currentCharacterMesh = placeholder;
  if (onLoaded) onLoaded(placeholder);
}

// ─────────────────────────────────────────────────────────────────────────────
// WEAPON & ARM COMPOUND SETUP
// ─────────────────────────────────────────────────────────────────────────────

function createProceduralSword(element) {
  if (!THREE) return new THREE.Group();
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

  // Blade (tall and sharp, pointing +Y along group)
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
  blade.castShadow = true;
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

  return group;
}

function buildArmAndWeapon(element) {
  if (!THREE) return;
  if (combatArmCompound && playerGroup) {
    playerGroup.remove(combatArmCompound);
    combatArmCompound = null;
  }

  combatArmCompound = new THREE.Group();
  combatArmCompound.position.set(shoulderPivotPos.x, shoulderPivotPos.y, shoulderPivotPos.z);

  // Right arm representation
  const rightArmGeo = new THREE.BoxGeometry(0.38, 1.3, 0.38);
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c4a0, roughness: 0.6 });
  const rightArmMesh = new THREE.Mesh(rightArmGeo, skinMat);
  rightArmMesh.position.set(0, -0.65, 0); // Hangs down from shoulder pivot
  rightArmMesh.castShadow = true;
  combatArmCompound.add(rightArmMesh);

  // Weapon socket inside arm, pointing forward toward Boss
  const weaponSocket = new THREE.Group();
  weaponSocket.position.set(weaponOffsetPos.offsetX, weaponOffsetPos.offsetY, weaponOffsetPos.offsetZ);
  weaponSocket.rotation.set(0, 0, (weaponOffsetPos.angle * Math.PI) / 180);

  currentWeaponMesh = createProceduralSword(element);
  weaponSocket.add(currentWeaponMesh);

  combatArmCompound.add(weaponSocket);
  playerGroup.add(combatArmCompound);

  playerArmPivot = combatArmCompound;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API: CREATE & MANAGE PLAYER
// ─────────────────────────────────────────────────────────────────────────────

export function createPlayer(color = '#ff6b35', element = 'fire', equippedGear = null) {
  if (!THREE) {
    console.error('[player] THREE is not loaded in window!');
    return null;
  }

  activeElement = element || 'fire';

  if (!playerGroup) {
    playerGroup = new THREE.Group();
  }

  // Clear existing children
  while (playerGroup.children.length > 0) {
    playerGroup.remove(playerGroup.children[0]);
  }

  playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
  playerGroup.rotation.y = FACE_ROT_Y; // Face +X (Boss)

  characterRoot = new THREE.Group();
  playerGroup.add(characterRoot);

  // Create immediate visual placeholder so the scene NEVER starts black
  createEmergencyPlaceholder(characterRoot);

  // Asynchronously attempt to load 3D GLB model
  loadPlayerModel(characterRoot, activeElement, (loadedModel) => {
    // Model loaded and mounted seamlessly
  });

  return playerGroup;
}

export function createPlayerMesh(element, equippedGear) {
  activeElement = element || 'fire';
  if (playerGroup) {
    loadPlayerModel(characterRoot, activeElement);
    buildArmAndWeapon(activeElement);
  }
}

export function applyElementalSet(element) {
  if (!element) return;
  activeElement = element;
  if (playerGroup) {
    loadPlayerModel(characterRoot, activeElement);
    buildArmAndWeapon(activeElement);
  }
}

export function getPlayerObject() {
  return playerGroup;
}

export function getPosition() {
  return playerGroup ? playerGroup.position : (THREE ? new THREE.Vector3(HOME_X, HOME_Y, HOME_Z) : { x: HOME_X, y: HOME_Y, z: HOME_Z });
}

export function getRotation() {
  return playerGroup ? playerGroup.rotation : (THREE ? new THREE.Euler(0, FACE_ROT_Y, 0) : { x: 0, y: FACE_ROT_Y, z: 0 });
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
  // Safe tick
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D COMBAT SLASHING ANIMATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pure 3D combat slashing animation:
 * 1. Dash forward to Boss.
 * 2. Rotate 3D arm pivot:
 *    - Wind-up: rotation.z = Math.PI / 3 (~100ms)
 *    - Slash: rotation.z = -Math.PI / 2.5 (~120ms) -> Triggers onHit()
 *    - Return: rotation.z = 0 (~100ms)
 * 3. Dash back to initial position.
 * 4. Call onDone() when back at home.
 */
export function playCombatAnimation(animType, { onHit, onDone } = {}) {
  if (!playerGroup || !THREE) {
    if (onHit) onHit();
    if (onDone) onDone();
    return;
  }

  const arm = combatArmCompound;
  const startX = HOME_X;
  const targetX = 0.5; // Forward near Boss
  let hitTriggered = false;

  const DASH_FWD_MS  = 160;
  const WINDUP_MS    = 100;
  const SLASH_MS     = 120;
  const RETURN_MS    = 100;
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
    // 3. Slash Down Across -> Trigger Hit
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

/**
 * Executes the sword slashing motion for player
 */
export function playSwordSlashAnimation(onHit, onComplete) {
  if (typeof playGuaranteedPlayerSlash === 'function') {
    return playGuaranteedPlayerSlash(onHit, onComplete);
  }

  // Fallback safe implementation
  const arm = combatArmCompound || playerArmPivot || (typeof window !== 'undefined' ? (window.playerArmPivot || window.playerModel) : null);
  if (!arm || typeof TWEEN === 'undefined') {
    if (onHit) onHit();
    if (onComplete) onComplete();
    return;
  }

  // 1. Wind-up
  new TWEEN.Tween(arm.rotation)
    .to({ z: Math.PI / 3, x: -Math.PI / 6 }, 100)
    .easing(TWEEN.Easing.Quadratic.Out)
    .onComplete(() => {
      // 2. Downward Slash Strike
      new TWEEN.Tween(arm.rotation)
        .to({ z: -Math.PI / 3, x: Math.PI / 4 }, 120)
        .easing(TWEEN.Easing.Quadratic.In)
        .onComplete(() => {
          if (onHit) onHit();

          // 3. Return to ready stance
          new TWEEN.Tween(arm.rotation)
            .to({ z: 0, x: 0 }, 100)
            .onComplete(() => {
              if (onComplete) onComplete();
            })
            .start();
        })
        .start();
    })
    .start();
}

export function playAttack(onDone) {
  playCombatAnimation(activeElement || 'normal', { onDone });
}

export function playDodge(onDone) {
  if (!playerGroup || !THREE) {
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

export function playHurt(onDone) {
  if (!playerGroup || !THREE) {
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
