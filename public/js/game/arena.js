// ─────────────────────────────────────────────────────────────────────────────
// Three Distinct Elemental Arenas: Frost, Fire, and Thunder
// ─────────────────────────────────────────────────────────────────────────────

let sceneRef = null;
let currentElement = 'thunder';

// Mesh groups for dynamic cleanup
let arenaGroup = null;
let sceneryGroup = null;
let flameParticles = [];
let cloudClusters = [];
let lightningLight = null;
let lightningFlashTimer = 0;
let lightningNextFlash = 3.5;
let floorMesh = null;
let trimMesh = null;
let backWallMesh = null;

const ARENA_WIDTH  = 16;
const ARENA_DEPTH  = 7;
const ARENA_HEIGHT = 0.8;

/**
 * Initializes the base arena container in the Three.js scene
 * @param {THREE.Scene} scene
 */
export function initArena(scene) {
  sceneRef = scene;

  if (arenaGroup && arenaGroup.parent) {
    arenaGroup.parent.remove(arenaGroup);
  }

  arenaGroup = new THREE.Group();
  arenaGroup.name = 'ElementalArena';
  scene.add(arenaGroup);

  // 1. Stage floor (base)
  const floorGeo = new THREE.BoxGeometry(ARENA_WIDTH, ARENA_HEIGHT, ARENA_DEPTH);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5, metalness: 0.2 });
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.set(0, -ARENA_HEIGHT / 2, 0);
  floorMesh.receiveShadow = true;
  arenaGroup.add(floorMesh);

  // 2. Trim border
  const trimGeo = new THREE.BoxGeometry(ARENA_WIDTH + 0.4, 0.18, ARENA_DEPTH + 0.4);
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xb8860b, roughness: 0.3, metalness: 0.8 });
  trimMesh = new THREE.Mesh(trimGeo, trimMat);
  trimMesh.position.set(0, 0.06, 0);
  arenaGroup.add(trimMesh);

  // 3. Back wall
  const wallGeo = new THREE.BoxGeometry(ARENA_WIDTH + 2, 14, 0.5);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x100820, roughness: 0.8, metalness: 0.1 });
  backWallMesh = new THREE.Mesh(wallGeo, wallMat);
  backWallMesh.position.set(0, 6, -ARENA_DEPTH / 2 - 0.4);
  arenaGroup.add(backWallMesh);

  // 4. Scenery group for element-specific decorations
  sceneryGroup = new THREE.Group();
  sceneryGroup.name = 'ElementalScenery';
  arenaGroup.add(sceneryGroup);

  // 5. Lightning flash light for Thunder arena
  lightningLight = new THREE.DirectionalLight(0x88ffff, 0);
  lightningLight.position.set(2, 18, 5);
  arenaGroup.add(lightningLight);

  // Default theme
  setArenaTheme('thunder');
}

/**
 * Updates the arena theme based on active element ('frost' | 'fire' | 'thunder')
 * @param {string} element
 */
export function setArenaTheme(element) {
  currentElement = (element || 'thunder').toLowerCase();
  if (!arenaGroup || !sceneRef) return;

  // Clear previous dynamic scenery
  while (sceneryGroup.children.length) {
    const child = sceneryGroup.children[0];
    sceneryGroup.remove(child);
  }
  flameParticles = [];
  cloudClusters = [];
  if (lightningLight) lightningLight.intensity = 0;
  lightningFlashTimer = 0;
  lightningNextFlash = 2.5 + Math.random() * 2.0;

  if (currentElement === 'frost') {
    _applyFrostTheme();
  } else if (currentElement === 'fire') {
    _applyFireTheme();
  } else {
    _applyThunderTheme();
  }
}

/**
 * ❄️ SÀN ĐẤU BĂNG (FROST ARENA)
 * - Floor: Pure icy white / pale blue material (color: 0xe0f7fa, roughness: 0.1, metalness: 0.1).
 * - Scenery: 6-8 sharp crystalline ice pillars/spikes around the edges of the platform
 *   with cyan emissive glow.
 */
function _applyFrostTheme() {
  sceneRef.background = new THREE.Color(0x061124);
  sceneRef.fog = new THREE.FogExp2(0x061124, 0.022);

  // 1. Floor & Trim
  floorMesh.visible = true;
  floorMesh.material = new THREE.MeshStandardMaterial({
    color: 0xe0f7fa,
    roughness: 0.1,
    metalness: 0.1,
  });

  trimMesh.visible = true;
  trimMesh.material = new THREE.MeshStandardMaterial({
    color: 0x88ddff,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x004466,
    emissiveIntensity: 0.4,
  });

  backWallMesh.visible = true;
  backWallMesh.material = new THREE.MeshStandardMaterial({
    color: 0x0c1b33,
    roughness: 0.6,
    metalness: 0.3,
  });

  // 2. 6-8 Sharp crystalline ice pillars / spikes around edges
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xd0f8ff,
    emissive: 0x00cfff,
    emissiveIntensity: 0.5,
    roughness: 0.05,
    metalness: 0.15,
    transparent: true,
    opacity: 0.88,
  });

  const spikePositions = [
    { x: -7.5, z: -3.0, h: 4.2, r: 0.75 },
    { x: -5.0, z: -3.2, h: 3.2, r: 0.60 },
    { x:  0.0, z: -3.3, h: 4.8, r: 0.85 },
    { x:  5.0, z: -3.2, h: 3.5, r: 0.65 },
    { x:  7.5, z: -3.0, h: 4.5, r: 0.80 },
    { x: -7.6, z:  2.8, h: 3.0, r: 0.55 },
    { x:  7.6, z:  2.8, h: 3.6, r: 0.60 },
  ];

  spikePositions.forEach(p => {
    // Sharp cone prism
    const spikeGeo = new THREE.ConeGeometry(p.r, p.h, 5);
    const spike = new THREE.Mesh(spikeGeo, iceMat);
    spike.position.set(p.x, p.h / 2, p.z);
    spike.rotation.y = Math.random() * Math.PI;
    spike.rotation.z = (Math.random() - 0.5) * 0.15;
    sceneryGroup.add(spike);

    // Subtle cyan point light near base
    const pLight = new THREE.PointLight(0x00e1ff, 0.6, 6);
    pLight.position.set(p.x, 1.5, p.z);
    sceneryGroup.add(pLight);
  });
}

/**
 * 🔥 SÀN ĐẤU LỬA (FIRE ARENA)
 * - Floor: Dark obsidian / red magma tint (color: 0x4a0e0e, subtle red point lights).
 * - Scenery: 4-6 fire pillars or braziers around the perimeter with animated rising flame particle sprites.
 */
function _applyFireTheme() {
  sceneRef.background = new THREE.Color(0x180404);
  sceneRef.fog = new THREE.FogExp2(0x180404, 0.024);

  // 1. Floor & Trim
  floorMesh.visible = true;
  floorMesh.material = new THREE.MeshStandardMaterial({
    color: 0x4a0e0e,
    roughness: 0.7,
    metalness: 0.25,
    emissive: 0x220505,
    emissiveIntensity: 0.3,
  });

  trimMesh.visible = true;
  trimMesh.material = new THREE.MeshStandardMaterial({
    color: 0x882200,
    roughness: 0.4,
    metalness: 0.7,
    emissive: 0x440e00,
    emissiveIntensity: 0.5,
  });

  backWallMesh.visible = true;
  backWallMesh.material = new THREE.MeshStandardMaterial({
    color: 0x1f0808,
    roughness: 0.8,
    metalness: 0.2,
  });

  // 2. 6 Fire pillars / braziers around the perimeter
  const brazierMat = new THREE.MeshStandardMaterial({ color: 0x2a1510, roughness: 0.8, metalness: 0.6 });
  const brazierPositions = [
    { x: -7.2, z: -2.8 },
    { x: -3.6, z: -3.1 },
    { x:  3.6, z: -3.1 },
    { x:  7.2, z: -2.8 },
    { x: -7.2, z:  2.8 },
    { x:  7.2, z:  2.8 },
  ];

  brazierPositions.forEach(p => {
    // Post base
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.2, 0.5), brazierMat);
    base.position.set(p.x, 1.1, p.z);
    sceneryGroup.add(base);

    // Brazier bowl
    const bowl = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.35, 0.8), brazierMat);
    bowl.position.set(p.x, 2.2, p.z);
    sceneryGroup.add(bowl);

    // Warm fire point light
    const fireLight = new THREE.PointLight(0xff6600, 1.2, 7);
    fireLight.position.set(p.x, 2.7, p.z);
    sceneryGroup.add(fireLight);

    // Create a burst of rising flame particles per brazier
    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff7700,
      transparent: true,
      opacity: 0.85,
    });

    for (let i = 0; i < 6; i++) {
      const pMesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), flameMat.clone());
      const particle = {
        mesh: pMesh,
        originX: p.x,
        originZ: p.z,
        baseY: 2.3,
        x: p.x + (Math.random() - 0.5) * 0.3,
        y: 2.3 + Math.random() * 1.2,
        z: p.z + (Math.random() - 0.5) * 0.3,
        vy: 1.2 + Math.random() * 1.4,
        vx: (Math.random() - 0.5) * 0.3,
        life: Math.random(),
        maxLife: 1.0 + Math.random() * 0.5,
      };
      sceneryGroup.add(pMesh);
      flameParticles.push(particle);
    }
  });
}

/**
 * ⚡ SÀN ĐẤU SÉT (THUNDER ARENA)
 * - Floor: INVISIBLE / REMOVED (floorMesh.visible = false; trimMesh.visible = false).
 * - Atmosphere: Character and Boss stand/levitate in mid-air.
 * - Animated volumetric 3D cloud clusters drifting slowly across the void.
 * - Occasional ambient lightning flash pulses.
 */
function _applyThunderTheme() {
  sceneRef.background = new THREE.Color(0x060714);
  sceneRef.fog = new THREE.FogExp2(0x060714, 0.020);

  // 1. Floor is INVISIBLE
  floorMesh.visible = false;
  trimMesh.visible = false;
  backWallMesh.visible = false;

  // 2. Animated volumetric 3D cloud clusters drifting slowly across the void
  const cloudMat = new THREE.MeshLambertMaterial({
    color: 0x223655,
    transparent: true,
    opacity: 0.72,
  });

  const clusterConfigs = [
    { x: -14, y: -1.2, z: -4.0, scale: 1.4, vx: 0.35 },
    { x:  -7, y: -2.0, z:  2.0, scale: 1.2, vx: 0.45 },
    { x:   0, y: -1.5, z: -2.0, scale: 1.5, vx: 0.40 },
    { x:   8, y: -2.2, z:  1.5, scale: 1.3, vx: 0.38 },
    { x:  14, y: -1.0, z: -5.0, scale: 1.6, vx: 0.42 },
    { x:  -4, y:  6.5, z: -8.0, scale: 2.0, vx: 0.25 },
    { x:   6, y:  7.0, z: -7.5, scale: 2.2, vx: 0.28 },
    { x: -12, y:  5.5, z: -6.5, scale: 1.8, vx: 0.30 },
  ];

  clusterConfigs.forEach(cfg => {
    const cluster = new THREE.Group();
    // Assemble volumetric cloud puff out of 5 overlapping rounded boxes
    const puffs = [
      { x: 0,    y: 0,    z: 0,   w: 3.0, h: 1.4, d: 2.2 },
      { x: 1.2,  y: 0.3,  z: 0.2, w: 2.2, h: 1.2, d: 1.8 },
      { x: -1.1, y: 0.2,  z: -0.1,w: 2.0, h: 1.1, d: 1.6 },
      { x: 0.3,  y: 0.7,  z: 0.1, w: 1.8, h: 1.3, d: 1.5 },
      { x: -0.4, y: -0.3, z: 0.3, w: 2.4, h: 1.0, d: 1.7 },
    ];

    puffs.forEach(p => {
      const geo = new THREE.BoxGeometry(p.w * cfg.scale, p.h * cfg.scale, p.d * cfg.scale);
      const m = new THREE.Mesh(geo, cloudMat);
      m.position.set(p.x * cfg.scale, p.y * cfg.scale, p.z * cfg.scale);
      cluster.add(m);
    });

    cluster.position.set(cfg.x, cfg.y, cfg.z);
    sceneryGroup.add(cluster);

    cloudClusters.push({
      group: cluster,
      vx: cfg.vx,
      baseY: cfg.y,
      seed: Math.random() * 10,
    });
  });
}

/**
 * Updates dynamic scenery animations each frame
 * @param {number} dt Delta time in seconds
 */
export function updateArena(dt) {
  if (!sceneryGroup) return;

  // 1. Animate Fire Particles
  if (currentElement === 'fire' && flameParticles.length > 0) {
    flameParticles.forEach(p => {
      p.life += dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;

      // Color transition orange -> yellow -> red -> fade
      const progress = p.life / p.maxLife;
      if (progress < 0.3) {
        p.mesh.material.color.setHex(0xffff44); // yellow
      } else if (progress < 0.7) {
        p.mesh.material.color.setHex(0xff6600); // orange
      } else {
        p.mesh.material.color.setHex(0xdd1100); // red ember
      }

      p.mesh.material.opacity = Math.max(0, 1 - progress);
      p.mesh.position.set(p.x, p.y, p.z);

      // Reset when particle expires
      if (p.life >= p.maxLife) {
        p.life = 0;
        p.x = p.originX + (Math.random() - 0.5) * 0.3;
        p.y = p.baseY;
        p.z = p.originZ + (Math.random() - 0.5) * 0.3;
      }
    });
  }

  // 2. Animate Drifting 3D Cloud Clusters
  if (currentElement === 'thunder' && cloudClusters.length > 0) {
    cloudClusters.forEach(c => {
      c.group.position.x += c.vx * dt;
      // Gentle floating bob
      c.group.position.y = c.baseY + Math.sin(Date.now() * 0.001 + c.seed) * 0.2;

      // Seamless wrap around arena horizontal bounds
      if (c.group.position.x > 22) {
        c.group.position.x = -22;
      }
    });

    // 3. Occasional Ambient Lightning Flash Pulses
    lightningFlashTimer += dt;
    if (lightningFlashTimer >= lightningNextFlash) {
      lightningFlashTimer = 0;
      lightningNextFlash = 3.0 + Math.random() * 3.5;
      _triggerLightningPulse();
    }
  }
}

/**
 * Triggers a sudden realistic double lightning flash pulse
 */
function _triggerLightningPulse() {
  if (!lightningLight || !sceneRef) return;

  // Flash 1: Sudden spike
  lightningLight.color.setHex(0xccffff);
  lightningLight.intensity = 3.6;
  if (sceneRef.background) sceneRef.background.setHex(0x182544);

  setTimeout(() => {
    if (!lightningLight) return;
    lightningLight.intensity = 0.5;

    // Flash 2: Secondary pulse
    setTimeout(() => {
      if (!lightningLight) return;
      lightningLight.intensity = 2.8;

      // Decay back to darkness
      setTimeout(() => {
        if (!lightningLight) return;
        lightningLight.intensity = 0;
        if (sceneRef.background) sceneRef.background.setHex(0x060714);
      }, 90);
    }, 60);
  }, 70);
}

export function getFloorMesh() {
  return floorMesh;
}
