// Pure 3D GLB Character & Combat Pipeline with 4-Pose Swapping
// Uses global window.THREE loaded via CDN
const THREE = (typeof window !== 'undefined' && window.THREE) ? window.THREE : null;

// Multi-Mesh Pose State & Group Exports (Required by Arena Architecture)
export const playerPoses = { idle: null, dodge: null, slash: null, hit: null };
export let playerGroup = (typeof THREE !== 'undefined' && THREE) ? new THREE.Group() : null;

// Backwards-compatible aliases
export const poseMeshes = playerPoses;
let activeElement = 'default';
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
let weaponOffsetPos  = { offsetX: 0.0, offsetY: -0.4, offsetZ: 0.1, angle: -64 };

// Active Animation Flags
let isDashing = false;
let isSlashing = false;
let isDodging = false;
let isHurt = false;

export function getPlayerPose() {
  for (const k in playerPoses) {
    if (playerPoses[k] && playerPoses[k].visible) return k;
  }
  return 'idle';
}

export function setPlayerPose(poseName = 'idle') {
  // poseName: 'idle' | 'dodge' | 'slash' | 'hit'
  Object.keys(playerPoses).forEach((key) => {
    if (playerPoses[key]) {
      playerPoses[key].visible = (key === poseName);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EMERGENCY FALLBACK BLOCK AVATAR (Guarantees visible character on stage)
// ─────────────────────────────────────────────────────────────────────────────
export function createFallbackBlockCharacter(outfit = 'default') {
  const currentTHREE = THREE || (typeof window !== 'undefined' ? window.THREE : null);
  const group = new currentTHREE.Group();

  const colors = {
    fire: 0xff4400,
    frost: 0x00cfff,
    thunder: 0xffd700,
    default: 0xff6b35
  };
  const bodyColor = colors[outfit] || colors.default;
  const mat = new currentTHREE.MeshLambertMaterial({ color: bodyColor });
  const darkMat = new currentTHREE.MeshLambertMaterial({ color: 0x222233 });
  const skinMat = new currentTHREE.MeshLambertMaterial({ color: 0xffddbb });

  // Torso
  const torso = new currentTHREE.Mesh(new currentTHREE.BoxGeometry(1.2, 1.4, 0.6), mat);
  torso.position.y = 1.9;
  group.add(torso);

  // Head
  const head = new currentTHREE.Mesh(new currentTHREE.BoxGeometry(0.85, 0.85, 0.85), skinMat);
  head.position.y = 3.0;
  group.add(head);

  // Hair / Helmet
  const hair = new currentTHREE.Mesh(new currentTHREE.BoxGeometry(0.9, 0.35, 0.9), mat);
  hair.position.y = 3.35;
  group.add(hair);

  // Left Arm
  const leftArm = new currentTHREE.Mesh(new currentTHREE.BoxGeometry(0.38, 1.3, 0.38), mat);
  leftArm.position.set(-0.85, 1.85, 0);
  group.add(leftArm);

  // Right Arm
  const rightArm = new currentTHREE.Mesh(new currentTHREE.BoxGeometry(0.38, 1.3, 0.38), mat);
  rightArm.position.set(0.85, 1.85, 0);
  group.add(rightArm);

  // Left Leg
  const leftLeg = new currentTHREE.Mesh(new currentTHREE.BoxGeometry(0.44, 1.2, 0.44), darkMat);
  leftLeg.position.set(-0.32, 0.6, 0);
  group.add(leftLeg);

  // Right Leg
  const rightLeg = new currentTHREE.Mesh(new currentTHREE.BoxGeometry(0.44, 1.2, 0.44), darkMat);
  rightLeg.position.set(0.32, 0.6, 0);
  group.add(rightLeg);

  return group;
}

/**
 * Loads the 4 distinct pose meshes directly for the active outfit:
 * idle, dodge, slash, hit with robust multi-step fallback chain
 */
export async function loadPlayerOutfitPoses(scene, outfit = 'fire') {
  activeElement = outfit || 'fire';
  const currentTHREE = THREE || (typeof window !== 'undefined' ? window.THREE : null);
  if (!currentTHREE) {
    console.error('[Player Loader] THREE not available');
    return null;
  }

  if (!playerGroup) {
    playerGroup = new currentTHREE.Group();
  }

  // Clear any existing models
  while (playerGroup.children.length > 0) {
    playerGroup.remove(playerGroup.children[0]);
  }

  const GLTFLoaderClass = currentTHREE.GLTFLoader || (typeof window !== 'undefined' ? window.THREE?.GLTFLoader : null);
  const DracoLoaderClass = currentTHREE.DRACOLoader || (typeof window !== 'undefined' ? window.THREE?.DRACOLoader : null);
  const loader = GLTFLoaderClass ? new GLTFLoaderClass() : null;
  if (loader && DracoLoaderClass) {
    try {
      const dracoLoader = new DracoLoaderClass();
      dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
      loader.setDRACOLoader(dracoLoader);
    } catch (e) {
      console.warn('[Player] DRACOLoader init warning:', e);
    }
  }
  if (loader && !loader.loadAsync) {
    loader.loadAsync = function(url) {
      return new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
    };
  }

  const poseKeys = ['idle', 'dodge', 'slash', 'hit'];

  for (const pose of poseKeys) {
    // Primary path: specific pose file
    const primaryUrl = `/assets/character/player_${activeElement}_${pose}.glb`;
    // Fallback: idle pose file of the same outfit
    const fallbackUrl = `/assets/character/player_${activeElement}_idle.glb`;
    const emergencyUrl = `/assets/character/player_fire_idle.glb`;

    let gltf = null;
    if (loader) {
      try {
        gltf = await loader.loadAsync(primaryUrl);
        console.log(`[Asset Success] Loaded model: ${primaryUrl}`);
      } catch (err) {
        console.error(`[Asset Error] FAILED loading ${primaryUrl}:`, err.message || err);
        try {
          gltf = await loader.loadAsync(fallbackUrl);
          console.log(`[Asset Success] Loaded fallback model: ${fallbackUrl}`);
        } catch (err2) {
          console.error(`[Asset Error] FAILED loading fallback ${fallbackUrl}:`, err2.message || err2);
          try {
            gltf = await loader.loadAsync(emergencyUrl);
            console.log(`[Asset Success] Loaded emergency model: ${emergencyUrl}`);
          } catch (err3) {
            console.error(`[Asset Error] FAILED loading emergency ${emergencyUrl}:`, err3.message || err3);
          }
        }
      }
    }

    if (gltf && gltf.scene) {
      const mesh = gltf.scene;
      mesh.traverse((c) => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
          if (c.material) {
            c.material.transparent = false;
            c.material.opacity = 1.0;
          }
        }
      });

      // Auto-normalize bounding box to standard height = 3.6
      const box = new currentTHREE.Box3().setFromObject(mesh);
      const size = box.getSize(new currentTHREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 3.6 / maxDim;
      mesh.scale.set(scale, scale, scale);

      // Center horizontally & base at y = 0
      const scaledBox = new currentTHREE.Box3().setFromObject(mesh);
      const centerX = (scaledBox.min.x + scaledBox.max.x) / 2;
      const centerZ = (scaledBox.min.z + scaledBox.max.z) / 2;
      const minY = scaledBox.min.y;
      mesh.position.set(-centerX, -minY, -centerZ);

      mesh.visible = (pose === 'idle');
      playerPoses[pose] = mesh;
      playerGroup.add(mesh);
    }
  }

  // Fallbacks: if any pose is missing, fallback to idle GLB mesh
  if (playerPoses.idle) {
    for (const p of poseKeys) {
      if (!playerPoses[p]) {
        playerPoses[p] = playerPoses.idle;
      }
    }
  }

  // Set explicit initial visibility
  if (playerPoses['idle']) playerPoses['idle'].visible = true;
  if (playerPoses['dodge']) playerPoses['dodge'].visible = false;
  if (playerPoses['slash']) playerPoses['slash'].visible = false;
  if (playerPoses['hit']) playerPoses['hit'].visible = false;

  playerGroup.position.set(-4.5, 0, 0);
  playerGroup.rotation.y = Math.PI / 2; // Facing Boss (+X)

  const targetScene = scene || (typeof window !== 'undefined' ? window.gameScene : null);
  if (targetScene && !targetScene.children.includes(playerGroup)) {
    targetScene.add(playerGroup);
  }

  window.playerModel = playerGroup;
  console.log(`[Player Loader] Outfit poses successfully loaded for ${activeElement}:`, playerPoses);
  return playerGroup;
}

export function loadPlayerModel(targetScene, outfitElement = 'default', onLoaded) {
  return loadPlayerOutfitPoses(targetScene, outfitElement).then((group) => {
    if (onLoaded) onLoaded(group);
    return group;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PERSISTENT ELEMENTAL WEAPON AURA PARTICLE VFX (FIRE, FROST, THUNDER)
// ─────────────────────────────────────────────────────────────────────────────
let currentWeaponAura = null;

function getOrCreateParticleTexture(type = 'glow') {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');

  if (type === 'spark') {
    // Sharp diamond sparkle for electric sparks & frost crystals
    const grad = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.3, 'rgba(200, 245, 255, 0.85)');
    grad.addColorStop(1, 'rgba(0, 180, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    // Cross rays
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(32, 2); ctx.lineTo(32, 62);
    ctx.moveTo(2, 32); ctx.lineTo(62, 32);
    ctx.stroke();
  } else {
    // Soft radial glow for fire embers and cold mist
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

export function disposeWeaponAura() {
  if (!currentWeaponAura) return;
  try {
    if (currentWeaponAura.parent) {
      currentWeaponAura.parent.remove(currentWeaponAura);
    }
    if (currentWeaponAura.light && currentWeaponAura.light.parent) {
      currentWeaponAura.light.parent.remove(currentWeaponAura.light);
    }
    if (currentWeaponAura.particles && currentWeaponAura.particles.geometry) {
      currentWeaponAura.particles.geometry.dispose();
    }
    if (currentWeaponAura.particles && currentWeaponAura.particles.material) {
      currentWeaponAura.particles.material.dispose();
    }
    if (currentWeaponAura.lightningLines) {
      currentWeaponAura.lightningLines.geometry.dispose();
      currentWeaponAura.lightningLines.material.dispose();
    }
  } catch (e) {
    console.warn('[player] Error disposing weapon aura:', e);
  }
  currentWeaponAura = null;
}

export function attachElementalAura(swordMesh, element = activeElement) {
  disposeWeaponAura();
  if (!swordMesh || !THREE) return;

  const normElem = (element || '').toLowerCase();
  if (!['fire', 'frost', 'thunder'].includes(normElem)) {
    // Default outfit: Clean metallic sheen without elemental particle glow
    return;
  }

  const auraGroup = new THREE.Group();
  auraGroup.name = 'ElementalWeaponAura';

  let auraLight = null;
  let particleMesh = null;
  let particleData = [];
  let lightningMesh = null;
  let lightningTimer = 0;
  let auraClock = 0;

  const BLADE_MIN_Y = 0.25;
  const BLADE_MAX_Y = 1.95;

  if (normElem === 'fire') {
    // 🔥 Kiếm Lửa (Fire Sword):
    // Subdued pulsating orange point light (color: 0xff5500, intensity: 1.5, distance: 3.0) mounted at center of blade
    auraLight = new THREE.PointLight(0xff5500, 1.5, 3.0);
    auraLight.position.set(0, 1.0, 0);
    auraGroup.add(auraLight);

    // Continuous rising flame particles and glowing orange/red embers floating upwards from blade length
    const count = 40;
    const geom = new THREE.BufferGeometry();
    const posArray = new Float32Array(count * 3);
    const colArray = new Float32Array(count * 3);

    const baseCols = [
      new THREE.Color(0xff4400),
      new THREE.Color(0xff7700),
      new THREE.Color(0xffbb00),
      new THREE.Color(0xff2200),
    ];

    for (let i = 0; i < count; i++) {
      const y = BLADE_MIN_Y + Math.random() * (BLADE_MAX_Y - BLADE_MIN_Y);
      const x = (Math.random() - 0.5) * 0.12;
      const z = (Math.random() - 0.5) * 0.08;
      posArray[i * 3]     = x;
      posArray[i * 3 + 1] = y;
      posArray[i * 3 + 2] = z;

      const c = baseCols[Math.floor(Math.random() * baseCols.length)];
      colArray[i * 3]     = c.r;
      colArray[i * 3 + 1] = c.g;
      colArray[i * 3 + 2] = c.b;

      particleData.push({
        baseX: x,
        baseZ: z,
        y: y,
        vy: 0.9 + Math.random() * 1.4, // Rising speed
        jitterPhase: Math.random() * Math.PI * 2,
        jitterSpeed: 6.0 + Math.random() * 8.0,
        life: Math.random() * 1.0,
        maxLife: 0.6 + Math.random() * 0.6,
      });
    }

    geom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colArray, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.18,
      vertexColors: true,
      map: getOrCreateParticleTexture('glow'),
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    particleMesh = new THREE.Points(geom, mat);
    auraGroup.add(particleMesh);

  } else if (normElem === 'frost') {
    // ❄️ Kiếm Băng (Frost Sword):
    // Cool cyan point light (color: 0x88eeff, intensity: 1.2, distance: 3.0)
    auraLight = new THREE.PointLight(0x88eeff, 1.2, 3.0);
    auraLight.position.set(0, 1.0, 0);
    auraGroup.add(auraLight);

    // Shimmering ice crystals and cold cyan/white mist particles slowly radiating outwards from blade
    const count = 36;
    const geom = new THREE.BufferGeometry();
    const posArray = new Float32Array(count * 3);
    const colArray = new Float32Array(count * 3);

    const baseCols = [
      new THREE.Color(0x88eeff),
      new THREE.Color(0x00d4ff),
      new THREE.Color(0xffffff),
      new THREE.Color(0xccf5ff),
    ];

    for (let i = 0; i < count; i++) {
      const y = BLADE_MIN_Y + Math.random() * (BLADE_MAX_Y - BLADE_MIN_Y);
      const x = (Math.random() - 0.5) * 0.08;
      const z = (Math.random() - 0.5) * 0.06;
      posArray[i * 3]     = x;
      posArray[i * 3 + 1] = y;
      posArray[i * 3 + 2] = z;

      const c = baseCols[Math.floor(Math.random() * baseCols.length)];
      colArray[i * 3]     = c.r;
      colArray[i * 3 + 1] = c.g;
      colArray[i * 3 + 2] = c.b;

      const radAngle = Math.random() * Math.PI * 2;
      particleData.push({
        baseY: y,
        x: x,
        y: y,
        z: z,
        vx: Math.cos(radAngle) * (0.08 + Math.random() * 0.14),
        vz: Math.sin(radAngle) * (0.08 + Math.random() * 0.14),
        vy: 0.05 + Math.random() * 0.2, // Gentle cold mist drift
        life: Math.random() * 1.2,
        maxLife: 0.9 + Math.random() * 0.8,
        twinklePhase: Math.random() * Math.PI * 2,
      });
    }

    geom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colArray, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.14,
      vertexColors: true,
      map: getOrCreateParticleTexture('spark'),
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    particleMesh = new THREE.Points(geom, mat);
    auraGroup.add(particleMesh);

  } else if (normElem === 'thunder') {
    // ⚡ Kiếm Sét (Thunder Sword):
    // Vibrant blue/electric-violet point light (color: 0x00d4ff, intensity: 1.6, distance: 3.5) flashing randomly
    auraLight = new THREE.PointLight(0x00d4ff, 1.6, 3.5);
    auraLight.position.set(0, 1.0, 0);
    auraGroup.add(auraLight);

    // Crackling electric sparks dancing along blade ridge
    const count = 30;
    const geom = new THREE.BufferGeometry();
    const posArray = new Float32Array(count * 3);
    const colArray = new Float32Array(count * 3);

    const baseCols = [
      new THREE.Color(0x00ffff),
      new THREE.Color(0x88eeff),
      new THREE.Color(0xffffff),
      new THREE.Color(0x3399ff),
    ];

    for (let i = 0; i < count; i++) {
      const y = BLADE_MIN_Y + Math.random() * (BLADE_MAX_Y - BLADE_MIN_Y);
      const x = (Math.random() - 0.5) * 0.14;
      const z = (Math.random() - 0.5) * 0.08;
      posArray[i * 3]     = x;
      posArray[i * 3 + 1] = y;
      posArray[i * 3 + 2] = z;

      const c = baseCols[Math.floor(Math.random() * baseCols.length)];
      colArray[i * 3]     = c.r;
      colArray[i * 3 + 1] = c.g;
      colArray[i * 3 + 2] = c.b;

      particleData.push({
        y: y,
        life: Math.random() * 0.4,
        maxLife: 0.15 + Math.random() * 0.25,
      });
    }

    geom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colArray, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.20,
      vertexColors: true,
      map: getOrCreateParticleTexture('spark'),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    particleMesh = new THREE.Points(geom, mat);
    auraGroup.add(particleMesh);

    // Jittery lightning arcs (THREE.LineSegments) dancing along the blade ridge
    const lineSegCount = 8;
    const lineGeom = new THREE.BufferGeometry();
    const linePositions = new Float32Array(lineSegCount * 2 * 3);
    lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x88eeff,
      linewidth: 2,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    lightningMesh = new THREE.LineSegments(lineGeom, lineMat);
    auraGroup.add(lightningMesh);
  }

  // Update routine executed every frame in updatePlayer
  auraGroup.update = (dt) => {
    auraClock += dt;

    if (normElem === 'fire') {
      // Subdued pulsating orange point light
      if (auraLight) {
        auraLight.intensity = 1.5 + Math.sin(auraClock * 8.0) * 0.45;
      }

      // Rising flame particles & edge jitter
      if (particleMesh) {
        const positions = particleMesh.geometry.attributes.position.array;
        for (let i = 0; i < particleData.length; i++) {
          const p = particleData[i];
          p.life += dt;
          p.y += p.vy * dt;

          if (p.life >= p.maxLife || p.y > BLADE_MAX_Y + 0.3) {
            // Respawn along blade edge
            p.y = BLADE_MIN_Y + Math.random() * 0.4;
            p.life = 0;
            p.baseX = (Math.random() - 0.5) * 0.12;
            p.baseZ = (Math.random() - 0.5) * 0.08;
            p.vy = 0.9 + Math.random() * 1.4;
          }

          // Edge jitter
          const jitterX = Math.sin(auraClock * p.jitterSpeed + p.jitterPhase) * 0.04;
          const jitterZ = Math.cos(auraClock * p.jitterSpeed + p.jitterPhase) * 0.03;

          positions[i * 3]     = p.baseX + jitterX;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.baseZ + jitterZ;
        }
        particleMesh.geometry.attributes.position.needsUpdate = true;
      }

    } else if (normElem === 'frost') {
      // Cool cyan point light
      if (auraLight) {
        auraLight.intensity = 1.2 + Math.sin(auraClock * 4.0) * 0.25;
      }

      // Shimmering ice crystals radiating outwards & sparkle twinkle
      if (particleMesh) {
        const positions = particleMesh.geometry.attributes.position.array;
        for (let i = 0; i < particleData.length; i++) {
          const p = particleData[i];
          p.life += dt;
          p.x += p.vx * dt;
          p.z += p.vz * dt;
          p.y += p.vy * dt;

          if (p.life >= p.maxLife || Math.abs(p.x) > 0.35 || Math.abs(p.z) > 0.35) {
            // Respawn near blade center
            p.y = BLADE_MIN_Y + Math.random() * (BLADE_MAX_Y - BLADE_MIN_Y);
            p.x = (Math.random() - 0.5) * 0.08;
            p.z = (Math.random() - 0.5) * 0.06;
            p.life = 0;
            const radAngle = Math.random() * Math.PI * 2;
            p.vx = Math.cos(radAngle) * (0.08 + Math.random() * 0.14);
            p.vz = Math.sin(radAngle) * (0.08 + Math.random() * 0.14);
          }

          positions[i * 3]     = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;
        }
        particleMesh.geometry.attributes.position.needsUpdate = true;
        // Subtle frost sparkle twinkle effect
        particleMesh.material.opacity = 0.65 + Math.sin(auraClock * 6.0) * 0.25;
      }

    } else if (normElem === 'thunder') {
      // Vibrant blue/electric-violet point light flashing randomly to mimic electric current
      if (auraLight) {
        auraLight.intensity = (Math.random() > 0.3) ? (1.5 + Math.random() * 0.8) : 0.5;
        if (Math.random() < 0.15) {
          auraLight.color.setHex(0xa855f7); // Flash electric-violet
        } else {
          auraLight.color.setHex(0x00d4ff); // Vibrant electric blue
        }
      }

      // Crackling electric sparks dancing along the blade ridge
      if (particleMesh) {
        const positions = particleMesh.geometry.attributes.position.array;
        for (let i = 0; i < particleData.length; i++) {
          const p = particleData[i];
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.life = 0;
            p.y = BLADE_MIN_Y + Math.random() * (BLADE_MAX_Y - BLADE_MIN_Y);
            positions[i * 3]     = (Math.random() - 0.5) * 0.14;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 0.08;
          }
        }
        particleMesh.geometry.attributes.position.needsUpdate = true;
      }

      // Jittery lightning arcs (THREE.LineSegments) dancing along the blade ridge
      if (lightningMesh) {
        lightningTimer += dt;
        if (lightningTimer > 0.05) { // Retrigger jagged arcs every ~50ms
          lightningTimer = 0;
          const linePos = lightningMesh.geometry.attributes.position.array;
          for (let s = 0; s < 8; s++) {
            const y1 = BLADE_MIN_Y + Math.random() * (BLADE_MAX_Y - BLADE_MIN_Y);
            const y2 = y1 + (Math.random() - 0.3) * 0.4;
            const x1 = (Math.random() - 0.5) * 0.08;
            const x2 = (Math.random() - 0.5) * 0.14;
            const z1 = (Math.random() - 0.5) * 0.06;
            const z2 = (Math.random() - 0.5) * 0.10;

            const idx = s * 6;
            linePos[idx]     = x1;
            linePos[idx + 1] = y1;
            linePos[idx + 2] = z1;
            linePos[idx + 3] = x2;
            linePos[idx + 4] = y2;
            linePos[idx + 5] = z2;
          }
          lightningMesh.geometry.attributes.position.needsUpdate = true;
          lightningMesh.visible = (Math.random() > 0.15);
        }
      }
    }
  };

  currentWeaponAura = auraGroup;
  currentWeaponAura.light = auraLight;
  currentWeaponAura.particles = particleMesh;
  currentWeaponAura.lightningLines = lightningMesh;
  swordMesh.add(auraGroup);
}

/**
 * Standardized Hand Grip & Blade Direction across all 4 outfits
 * @param {THREE.Object3D} targetModel 
 * @param {THREE.Object3D} swordMesh 
 * @param {string} [outfitElement]
 * @returns {THREE.Group}
 */
export function mountWeaponUniformly(targetModel, swordMesh, outfitElement = activeElement) {
  if (!targetModel || !swordMesh) return null;

  // Clean up any existing anchor
  const existingAnchor = targetModel.getObjectByName('RightHandAnchor');
  if (existingAnchor && existingAnchor.parent) {
    existingAnchor.parent.remove(existingAnchor);
  }

  const handAnchor = new THREE.Group();
  handAnchor.name = 'RightHandAnchor';
  // Target wrist/hand base coordinates
  handAnchor.position.set(0.65, 0.85, 0.25);

  // Position sword so hilt sits firmly inside handAnchor
  swordMesh.position.set(0, 0, 0);

  // Orient sword blade pointing forward towards Boss (+X axis) at a ready 45-60 degree tilt
  swordMesh.rotation.set(0, 0, -Math.PI / 3.2);

  handAnchor.add(swordMesh);
  targetModel.add(handAnchor);

  combatArmCompound = handAnchor;
  playerArmPivot = handAnchor;
  currentWeaponMesh = swordMesh;

  // Attach persistent elemental aura to the sword blade
  attachElementalAura(swordMesh, outfitElement);

  return handAnchor;
}

/**
 * Loads the 3D GLB sword or falls back cleanly to procedural sword
 */
function loadAndMountWeapon(targetModel, outfitElement) {
  // Mount procedural sword immediately so model is NEVER weaponless
  const procSword = createProceduralSword(outfitElement);
  const anchor = mountWeaponUniformly(targetModel, procSword, outfitElement);

  const GLTFLoaderClass = (typeof THREE !== 'undefined' && THREE.GLTFLoader)
    ? THREE.GLTFLoader
    : (typeof window !== 'undefined' ? window.THREE?.GLTFLoader : null);

  if (!GLTFLoaderClass) return anchor;

  const swordPath = `/assets/character/sword_${outfitElement}.glb`;
  console.log(`[GLTF Load Attempt] Requesting model: ${swordPath}`);
  const loader = new GLTFLoaderClass();
  loader.load(
    swordPath,
    (gltf) => {
      try {
        const sword = gltf.scene;
        sword.traverse((child) => {
          if (child.isMesh) {
            child.visible = true;
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
              child.material.transparent = false;
              child.material.opacity = 1.0;
              child.material.depthWrite = true;
            }
          }
        });

        const box = new THREE.Box3().setFromObject(sword);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const scale = (maxDim > 0.01 && !isNaN(maxDim)) ? (1.9 / maxDim) : 1.0;
        sword.scale.set(scale, scale, scale);

        mountWeaponUniformly(targetModel, sword, outfitElement);
        console.log(`[GLTF Success] Weapon model mounted uniformly from ${swordPath} at scale ${scale}`);
      } catch (e) {
        console.warn('[player] Error scaling GLB sword:', e);
      }
    },
    undefined,
    (err) => {
      console.error(`[GLTF Error] Failed to load model at ${swordPath}:`, err);
    }
  );
  return anchor;
}

function createEmergencyPlaceholder(targetParent, onLoaded) {
  if (!THREE) return null;
  // Emergency Fallback: Obvious stylized colored block puppet so model is NEVER invisible
  const placeholder = new THREE.Group();
  placeholder.name = 'PlayerEmergencyPlaceholder';

  const torsoColor = activeElement === 'fire' ? 0xef233c : activeElement === 'thunder' ? 0x00b4d8 : activeElement === 'frost' ? 0x48cae4 : 0x2b6cb0;
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.6, 0.7),
    new THREE.MeshStandardMaterial({ color: torsoColor, roughness: 0.5, metalness: 0.2 })
  );
  torso.position.y = 1.8;
  torso.castShadow = true;
  torso.receiveShadow = true;
  placeholder.add(torso);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.8, 0.8),
    new THREE.MeshStandardMaterial({ color: 0xffd166, roughness: 0.7 })
  );
  head.position.y = 3.0;
  head.castShadow = true;
  head.receiveShadow = true;
  placeholder.add(head);

  for (const s of [-0.3, 0.3]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 1.0, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x1a202c, roughness: 0.7 })
    );
    leg.position.set(s, 0.5, 0);
    leg.castShadow = true;
    leg.receiveShadow = true;
    placeholder.add(leg);
  }

  const anchor = loadAndMountWeapon(placeholder, activeElement);
  combatArmCompound = anchor;
  playerArmPivot = anchor;

  if (characterRoot) {
    while (characterRoot.children.length > 0) {
      characterRoot.remove(characterRoot.children[0]);
    }
    characterRoot.add(placeholder);
  } else if (targetParent) {
    placeholder.position.set(-4.5, 0.0, 0.0);
    placeholder.rotation.y = Math.PI / 2;
    targetParent.add(placeholder);
  }

  currentCharacterMesh = placeholder;
  window.playerModel = playerGroup || placeholder;
  if (onLoaded) onLoaded(placeholder);
  return placeholder;
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

export function createPlayer(color = '#ff6b35', element = 'default', equippedGear = null) {
  if (!THREE) {
    console.error('[player] THREE is not loaded in window!');
    return null;
  }

  activeElement = element || 'default';

  if (!playerGroup) {
    playerGroup = new THREE.Group();
  }

  // Clear existing children
  while (playerGroup.children.length > 0) {
    playerGroup.remove(playerGroup.children[0]);
  }

  playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
  playerGroup.rotation.y = FACE_ROT_Y; // Face +X (Boss)

  // Asynchronously load the 4 multi-mesh poses directly
  loadPlayerOutfitPoses(null, activeElement);

  return playerGroup;
}

export function createPlayerMesh(element, equippedGear) {
  activeElement = element || 'default';
  if (playerGroup) {
    loadPlayerOutfitPoses(null, activeElement);
  }
}

export function applyElementalSet(element) {
  if (!element) return;
  activeElement = element;
  if (playerGroup) {
    loadPlayerOutfitPoses(null, activeElement);
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
  return activeElement || 'default';
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
  if (currentWeaponAura && typeof currentWeaponAura.update === 'function') {
    try {
      currentWeaponAura.update(deltaTime || 0.016);
    } catch (e) {
      console.warn('[player] Error updating weapon aura:', e);
    }
  }
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
  const targetX = 2.0; // Forward near Boss (at x = 4.5)
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
  setPlayerPose('dodge'); // Leap forward into combat

  function stepCombat(now) {
    const elapsed = now - startTime;

    // 1. Dash Forward
    if (elapsed < t1) {
      const p = elapsed / DASH_FWD_MS;
      const ease = p * (2 - p); // QuadOut
      playerGroup.position.x = THREE.MathUtils.lerp(startX, targetX, ease);
    }
    // 2. Wind-up Arm -> Swap to Slash Pose
    else if (elapsed < t2) {
      setPlayerPose('slash');
      playerGroup.position.x = targetX;
      const p = (elapsed - t1) / WINDUP_MS;
      if (arm) arm.rotation.z = THREE.MathUtils.lerp(0, Math.PI / 3, p);
    }
    // 3. Slash Down Across -> Trigger Hit
    else if (elapsed < t3) {
      setPlayerPose('slash');
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
      setPlayerPose('idle');
      const p = (elapsed - t4) / DASH_BACK_MS;
      const ease = p * (2 - p);
      playerGroup.position.x = THREE.MathUtils.lerp(targetX, startX, ease);
    }
    // 6. Complete
    else {
      playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
      if (arm) arm.rotation.z = 0;
      setPlayerPose('idle');
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
  setPlayerPose('slash');
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
              setPlayerPose('idle');
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
  setPlayerPose('dodge');
  const startTime = performance.now();
  const DURATION = 380; // ms
  const startX = HOME_X;
  const targetX = 1.8; // Apex near Boss

  function stepDodge(now) {
    const elapsed = now - startTime;
    const p = Math.min(1.0, elapsed / DURATION);

    // Arc leap forward over boss spell
    const jumpY = Math.sin(p * Math.PI) * 2.2;
    const currentX = THREE.MathUtils.lerp(startX, targetX, p);

    playerGroup.position.set(currentX, HOME_Y + jumpY, HOME_Z);

    if (p < 1.0) {
      requestAnimationFrame(stepDodge);
    } else {
      playerGroup.position.set(targetX, HOME_Y, HOME_Z);
      isDodging = false;
      if (onDone) onDone();
    }
  }

  requestAnimationFrame(stepDodge);
}

export function playLeapBack(onDone) {
  if (!playerGroup || !THREE) {
    if (onDone) onDone();
    return;
  }

  const startTime = performance.now();
  const DURATION = 350; // ms
  const startX = playerGroup.position.x;
  const targetX = HOME_X;

  function stepLeapBack(now) {
    const elapsed = now - startTime;
    const p = Math.min(1.0, elapsed / DURATION);

    // Arc leap back to origin
    const jumpY = Math.sin(p * Math.PI) * 1.8;
    const currentX = THREE.MathUtils.lerp(startX, targetX, p);

    playerGroup.position.set(currentX, HOME_Y + jumpY, HOME_Z);

    if (p < 1.0) {
      requestAnimationFrame(stepLeapBack);
    } else {
      playerGroup.position.set(HOME_X, HOME_Y, HOME_Z);
      setPlayerPose('idle');
      if (onDone) onDone();
    }
  }

  requestAnimationFrame(stepLeapBack);
}

export function playHurt(onDone) {
  if (!playerGroup || !THREE) {
    if (onDone) onDone();
    return;
  }

  isHurt = true;
  setPlayerPose('hit');
  const startTime = performance.now();
  const DURATION = 320;

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
      setPlayerPose('idle');
      isHurt = false;
      if (onDone) onDone();
    }
  }

  requestAnimationFrame(stepHurt);
}
