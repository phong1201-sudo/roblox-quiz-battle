// ─────────────────────────────────────────────────────────────────────────────
// Three Rich Thematic Arenas: Thunder Cloud Sanctuary, Frost, and Fire
// ─────────────────────────────────────────────────────────────────────────────

let sceneRef = null;
let lightsRef = null;
let currentElement = 'thunder';

// Mesh groups for dynamic cleanup
let arenaGroup = null;
let sceneryGroup = null;
let floorMesh = null;
let trimMesh = null;
let backWallMesh = null;

// Dynamic particle / scenery arrays
let flameParticles = [];
let emberParticles = [];
let snowflakeParticles = [];
let cloudClusters = [];
let lightningRods = [];
let circuitLines = [];
let runeCracks = [];
let lavaCracks = [];

// Arena Platform Dimensions
const ARENA_WIDTH  = 16;
const ARENA_DEPTH  = 7;
const ARENA_HEIGHT = 0.8;

/**
 * Initializes the base arena container in the Three.js scene
 * @param {THREE.Scene} scene
 * @param {Object} [lights] Optional reference to scene lights: { ambient, keyLight, fillLight, rimLight }
 */
export function initArena(scene, lights = null) {
  sceneRef = scene;
  lightsRef = lights;

  if (arenaGroup && arenaGroup.parent) {
    arenaGroup.parent.remove(arenaGroup);
  }

  arenaGroup = new THREE.Group();
  arenaGroup.name = 'ElementalArena';
  scene.add(arenaGroup);

  // 1. Stage floor (base)
  const floorGeo = new THREE.BoxGeometry(ARENA_WIDTH, ARENA_HEIGHT, ARENA_DEPTH);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2, metalness: 0.1 });
  floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.set(0, -ARENA_HEIGHT / 2, 0);
  floorMesh.receiveShadow = true;
  arenaGroup.add(floorMesh);

  // 2. Trim border
  const trimGeo = new THREE.BoxGeometry(ARENA_WIDTH + 0.4, 0.18, ARENA_DEPTH + 0.4);
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.3, metalness: 0.8 });
  trimMesh = new THREE.Mesh(trimGeo, trimMat);
  trimMesh.position.set(0, 0.06, 0);
  arenaGroup.add(trimMesh);

  // 3. Back wall (optional, hidden on open sky arenas)
  const wallGeo = new THREE.BoxGeometry(ARENA_WIDTH + 2, 14, 0.5);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x100820, roughness: 0.8, metalness: 0.1 });
  backWallMesh = new THREE.Mesh(wallGeo, wallMat);
  backWallMesh.position.set(0, 6, -ARENA_DEPTH / 2 - 0.4);
  backWallMesh.visible = false;
  arenaGroup.add(backWallMesh);

  // 4. Scenery group for element-specific decorations
  sceneryGroup = new THREE.Group();
  sceneryGroup.name = 'ElementalScenery';
  arenaGroup.add(sceneryGroup);

  // Default theme: Thunder
  setArenaTheme('thunder');
}

/**
 * Updates the arena theme based on active element ('thunder' | 'frost' | 'fire')
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
  emberParticles = [];
  snowflakeParticles = [];
  cloudClusters = [];
  lightningRods = [];
  circuitLines = [];
  runeCracks = [];
  lavaCracks = [];

  if (currentElement === 'frost') {
    _applyFrostTheme();
  } else if (currentElement === 'fire') {
    _applyFireTheme();
  } else {
    _applyThunderTheme();
  }
}

/**
 * ⚡ THUNDER BOSS ARENA (HIGH-CONTRAST TWILIGHT STORM SANCTUARY)
 * - Skybox: Deep Twilight Storm Violet / Charcoal Slate (0x15182e)
 * - Fog: Atmospheric slate-violet fog (0x191c33)
 * - Lighting: Directional moonlight/stormlight (0xe0e7ff, 1.8) + warm electric cyan rim light (0x38bdf8, 2.0)
 * - Platform: Dark slate stone tiles (0x1e2235, roughness 0.65, metalness 0.35)
 * - Circuits: Etched conductive energy circuit lines (0x00ffff & 0xfbbf24) with pulsing glow
 * - Clouds: Rolling dark storm cloud clusters beneath and around platform (0x283046)
 */
function _applyThunderTheme() {
  // 1. Atmosphere: Deep Twilight Storm Violet
  sceneRef.background = new THREE.Color(0x15182e);
  sceneRef.fog = new THREE.FogExp2(0x191c33, 0.012);

  // 2. High-contrast storm & rim illumination
  if (lightsRef) {
    if (lightsRef.ambient) {
      lightsRef.ambient.color.setHex(0x1e293b);
      lightsRef.ambient.intensity = 0.9;
    }
    if (lightsRef.keyLight) {
      lightsRef.keyLight.color.setHex(0xe0e7ff);
      lightsRef.keyLight.intensity = 1.8;
      lightsRef.keyLight.position.set(6, 20, 10);
    }
    if (lightsRef.fillLight) {
      lightsRef.fillLight.color.setHex(0x334155);
      lightsRef.fillLight.intensity = 0.8;
      lightsRef.fillLight.position.set(0, 6, 8);
    }
    if (lightsRef.rimLight) {
      lightsRef.rimLight.color.setHex(0x38bdf8);
      lightsRef.rimLight.intensity = 2.0;
      lightsRef.rimLight.position.set(0, 8, -8);
    }
  }

  // 3. Dark slate stone floor & electric cyan/gold trim
  floorMesh.visible = true;
  floorMesh.material = new THREE.MeshStandardMaterial({
    color: 0x1e2235,
    roughness: 0.65,
    metalness: 0.35,
  });

  trimMesh.visible = true;
  trimMesh.material = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    roughness: 0.3,
    metalness: 0.8,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.4,
  });

  backWallMesh.visible = false;

  // 4. Etched conductive energy circuit lines (pulsing neon cyan & gold)
  const cyanCircuitMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.9,
  });
  const goldCircuitMat = new THREE.MeshBasicMaterial({
    color: 0xfbbf24,
    transparent: true,
    opacity: 0.85,
  });

  const circuitSegments = [
    // Main power lines (cyan)
    { x: -5.0, z:  0.0, w: 4.5, d: 0.08, mat: cyanCircuitMat, baseOp: 0.9, r: 0 },
    { x:  5.0, z:  0.0, w: 4.5, d: 0.08, mat: cyanCircuitMat, baseOp: 0.9, r: 0 },
    { x:  0.0, z: -1.8, w: 8.0, d: 0.08, mat: cyanCircuitMat, baseOp: 0.85, r: 0 },
    { x:  0.0, z:  1.8, w: 8.0, d: 0.08, mat: cyanCircuitMat, baseOp: 0.85, r: 0 },
    // Cross-connecting branches
    { x: -3.2, z: -0.9, w: 0.08, d: 1.8, mat: cyanCircuitMat, baseOp: 0.9, r: 0 },
    { x:  3.2, z:  0.9, w: 0.08, d: 1.8, mat: cyanCircuitMat, baseOp: 0.9, r: 0 },
    { x: -1.5, z:  0.9, w: 0.08, d: 1.8, mat: cyanCircuitMat, baseOp: 0.8, r: 0 },
    { x:  1.5, z: -0.9, w: 0.08, d: 1.8, mat: cyanCircuitMat, baseOp: 0.8, r: 0 },
    // Golden conduits & power nodes
    { x: -2.0, z:  0.0, w: 2.2, d: 0.06, mat: goldCircuitMat, baseOp: 0.85, r: 0.4 },
    { x:  2.0, z:  0.0, w: 2.2, d: 0.06, mat: goldCircuitMat, baseOp: 0.85, r: -0.4 },
    { x:  0.0, z:  0.0, w: 0.5, d: 0.5,  mat: goldCircuitMat, baseOp: 0.95, r: Math.PI / 4 },
    { x: -6.0, z: -1.2, w: 1.8, d: 0.06, mat: goldCircuitMat, baseOp: 0.8, r: 0.25 },
    { x:  6.0, z:  1.2, w: 1.8, d: 0.06, mat: goldCircuitMat, baseOp: 0.8, r: -0.25 },
  ];

  circuitSegments.forEach(s => {
    const geo = new THREE.BoxGeometry(s.w, 0.015, s.d);
    const m = new THREE.Mesh(geo, s.mat.clone());
    m.position.set(s.x, 0.015, s.z);
    m.rotation.y = s.r;
    sceneryGroup.add(m);
    m.baseOpacity = s.baseOp;
    circuitLines.push(m);
  });

  // 5. Rolling dark storm cloud clusters beneath platform (0x283046)
  const stormCloudMat = new THREE.MeshLambertMaterial({
    color: 0x283046,
    transparent: true,
    opacity: 0.85,
  });

  const cloudConfigs = [
    // Low floating storm cloud bed below stage
    { x: -14, y: -2.2, z: -4.0, scale: 1.6, vx: 0.35 },
    { x:  -7, y: -2.5, z:  2.0, scale: 1.4, vx: 0.45 },
    { x:   0, y: -2.2, z: -2.0, scale: 1.7, vx: 0.40 },
    { x:   7, y: -2.6, z:  2.0, scale: 1.5, vx: 0.38 },
    { x:  14, y: -2.2, z: -4.5, scale: 1.8, vx: 0.42 },
    // Surrounding horizon storm clouds
    { x: -16, y:  3.5, z: -9.0, scale: 2.2, vx: 0.25 },
    { x:  -5, y:  5.0, z: -10.0, scale: 2.5, vx: 0.28 },
    { x:   8, y:  4.5, z: -9.5, scale: 2.3, vx: 0.30 },
    { x:  16, y:  3.0, z: -9.0, scale: 2.4, vx: 0.26 },
    { x: -10, y: -1.2, z:  5.0, scale: 1.5, vx: 0.35 },
    { x:   9, y: -1.2, z:  5.5, scale: 1.6, vx: 0.37 },
  ];

  cloudConfigs.forEach(cfg => {
    const cluster = new THREE.Group();
    const puffs = [
      { x: 0,    y: 0,    z: 0,   w: 3.2, h: 1.5, d: 2.4 },
      { x: 1.3,  y: 0.3,  z: 0.2, w: 2.4, h: 1.3, d: 1.9 },
      { x: -1.2, y: 0.2,  z: -0.1,w: 2.2, h: 1.2, d: 1.7 },
      { x: 0.3,  y: 0.7,  z: 0.1, w: 2.0, h: 1.4, d: 1.6 },
      { x: -0.5, y: -0.2, z: 0.3, w: 2.6, h: 1.1, d: 1.8 },
    ];

    puffs.forEach(p => {
      const geo = new THREE.BoxGeometry(p.w * cfg.scale, p.h * cfg.scale, p.d * cfg.scale);
      const m = new THREE.Mesh(geo, stormCloudMat);
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

  // 5. Floating Ancient Greek/Marble Cloud Pillars with Crackling Blue Lightning Rods
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.25,
    metalness: 0.05,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xeab308,
    roughness: 0.2,
    metalness: 0.9,
    emissive: 0x854d0e,
    emissiveIntensity: 0.3,
  });
  const gemMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
  });

  const pillarCoords = [
    { x: -7.5, z: -3.0 },
    { x:  7.5, z: -3.0 },
    { x: -7.5, z:  2.8 },
    { x:  7.5, z:  2.8 },
  ];

  pillarCoords.forEach(pos => {
    const pillarGroup = new THREE.Group();
    pillarGroup.position.set(pos.x, 0, pos.z);

    // Fluted Column Base & Shaft
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.4, 1.2), pillarMat);
    base.position.y = 0.2;
    pillarGroup.add(base);

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 3.8, 12), pillarMat);
    shaft.position.y = 2.3;
    pillarGroup.add(shaft);

    // Capital & Golden Crown
    const capital = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.35, 1.15), goldMat);
    capital.position.y = 4.3;
    pillarGroup.add(capital);

    // Lightning Rod Needle
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 1.4, 8), goldMat);
    rod.position.y = 5.1;
    pillarGroup.add(rod);

    // Glowing Cyan Energy Crystal at tip
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), gemMat);
    crystal.position.y = 5.9;
    pillarGroup.add(crystal);

    // Cyan point light for crystal glow
    const rodLight = new THREE.PointLight(0x00e5ff, 1.0, 5);
    rodLight.position.y = 5.9;
    pillarGroup.add(rodLight);

    // Crackling mini electric line segments
    const lineGeom = new THREE.BufferGeometry();
    const linePos = new Float32Array(18); // 3 line segments
    lineGeom.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x88ffff,
      transparent: true,
      opacity: 0.9,
    });
    const sparks = new THREE.LineSegments(lineGeom, lineMat);
    sparks.position.y = 5.9;
    pillarGroup.add(sparks);

    sceneryGroup.add(pillarGroup);

    lightningRods.push({
      crystal,
      sparks,
      light: rodLight,
      timer: Math.random() * 5,
    });
  });
}

/**
 * ❄️ FROST ARENA UPGRADE
 * - Skybox: Deep glacial twilight
 * - Floor: Crystalline ice floor with glowing cyan rune cracks
 * - Decor: Giant sharp ice crystals protruding from the ground around perimeter
 * - Weather: Constant falling snowflakes drifting and swaying downward
 */
function _applyFrostTheme() {
  sceneRef.background = new THREE.Color(0x040d1a);
  sceneRef.fog = new THREE.FogExp2(0x051329, 0.016);

  if (lightsRef) {
    if (lightsRef.ambient) {
      lightsRef.ambient.color.setHex(0xa5f3fc);
      lightsRef.ambient.intensity = 0.85;
    }
    if (lightsRef.keyLight) {
      lightsRef.keyLight.color.setHex(0xe0f2fe);
      lightsRef.keyLight.intensity = 1.4;
      lightsRef.keyLight.position.set(4, 16, 8);
    }
    if (lightsRef.fillLight) {
      lightsRef.fillLight.color.setHex(0x38bdf8);
      lightsRef.fillLight.intensity = 0.7;
    }
    if (lightsRef.rimLight) {
      lightsRef.rimLight.color.setHex(0x00ffff);
      lightsRef.rimLight.intensity = 0.9;
    }
  }

  // 1. Floor & Trim: Translucent ice
  floorMesh.visible = true;
  floorMesh.material = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    roughness: 0.08,
    metalness: 0.2,
    transparent: true,
    opacity: 0.96,
  });

  trimMesh.visible = true;
  trimMesh.material = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.2,
    metalness: 0.8,
    emissive: 0x0369a1,
    emissiveIntensity: 0.4,
  });

  backWallMesh.visible = false;

  // 2. Glowing Cyan Floor Rune Cracks
  const runeMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.85,
  });

  const runeSegments = [
    { x: -4.0, z: 0.0, l: 3.5, r: 0.35 },
    { x: -2.0, z: -1.2, l: 2.8, r: -0.6 },
    { x:  0.0, z: 0.0, l: 4.0, r: 0.0 },
    { x:  2.0, z: 1.2, l: 2.8, r: 0.7 },
    { x:  4.0, z: 0.0, l: 3.5, r: -0.35 },
    { x: -5.5, z: 1.4, l: 2.2, r: 0.9 },
    { x:  5.5, z: -1.4, l: 2.2, r: -0.9 },
  ];

  runeSegments.forEach(s => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s.l, 0.02, 0.12), runeMat);
    mesh.position.set(s.x, 0.02, s.z);
    mesh.rotation.y = s.r;
    sceneryGroup.add(mesh);
    runeCracks.push(mesh);
  });

  // 3. Giant Sharp Ice Crystals protruding around perimeter
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0xcffafe,
    emissive: 0x00e5ff,
    emissiveIntensity: 0.55,
    roughness: 0.05,
    metalness: 0.15,
    transparent: true,
    opacity: 0.88,
  });

  const crystalSpikes = [
    { x: -7.6, z: -3.0, h: 5.2, r: 0.85, tiltX: 0.15, tiltZ: -0.2 },
    { x: -4.5, z: -3.3, h: 3.8, r: 0.65, tiltX: -0.1, tiltZ: -0.15 },
    { x:  0.0, z: -3.4, h: 5.6, r: 0.95, tiltX: 0.05, tiltZ: -0.25 },
    { x:  4.5, z: -3.3, h: 4.2, r: 0.70, tiltX: 0.1,  tiltZ: -0.15 },
    { x:  7.6, z: -3.0, h: 5.4, r: 0.90, tiltX: -0.15, tiltZ: -0.2 },
    { x: -7.8, z:  2.6, h: 4.0, r: 0.65, tiltX: 0.1,  tiltZ: 0.2 },
    { x:  7.8, z:  2.6, h: 4.4, r: 0.70, tiltX: -0.1, tiltZ: 0.2 },
    { x: -3.0, z:  3.2, h: 3.5, r: 0.55, tiltX: -0.05, tiltZ: 0.2 },
    { x:  3.0, z:  3.2, h: 3.6, r: 0.55, tiltX: 0.05, tiltZ: 0.2 },
  ];

  crystalSpikes.forEach(p => {
    const spike = new THREE.Mesh(new THREE.ConeGeometry(p.r, p.h, 6), crystalMat);
    spike.position.set(p.x, p.h / 2 - 0.2, p.z);
    spike.rotation.x = p.tiltZ;
    spike.rotation.z = p.tiltX;
    spike.rotation.y = Math.random() * Math.PI;
    sceneryGroup.add(spike);

    const pLight = new THREE.PointLight(0x00e5ff, 0.7, 6);
    pLight.position.set(p.x, 1.8, p.z);
    sceneryGroup.add(pLight);
  });

  // 4. Constant Falling Snowflakes
  const snowMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
  });

  for (let i = 0; i < 90; i++) {
    const s = 0.08 + Math.random() * 0.12;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), snowMat);
    const x = (Math.random() - 0.5) * 22;
    const y = Math.random() * 14;
    const z = (Math.random() - 0.5) * 12;
    mesh.position.set(x, y, z);
    sceneryGroup.add(mesh);

    snowflakeParticles.push({
      mesh,
      x,
      y,
      z,
      vy: 1.2 + Math.random() * 1.6,
      swaySpeed: 2.0 + Math.random() * 3.0,
      swayAmp: 0.4 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

/**
 * 🔥 FIRE ARENA UPGRADE
 * - Skybox: Dark infernal volcanic abyss
 * - Floor: Dark jagged obsidian with glowing molten lava cracks
 * - Decor: Jagged obsidian spires with glowing fissures & braziers
 * - Particles: Rising heat distortion particles & floating embers
 */
function _applyFireTheme() {
  sceneRef.background = new THREE.Color(0x160404);
  sceneRef.fog = new THREE.FogExp2(0x160404, 0.022);

  if (lightsRef) {
    if (lightsRef.ambient) {
      lightsRef.ambient.color.setHex(0x450a0a);
      lightsRef.ambient.intensity = 0.9;
    }
    if (lightsRef.keyLight) {
      lightsRef.keyLight.color.setHex(0xffaa44);
      lightsRef.keyLight.intensity = 1.6;
      lightsRef.keyLight.position.set(0, 16, 8);
    }
    if (lightsRef.fillLight) {
      lightsRef.fillLight.color.setHex(0xf97316);
      lightsRef.fillLight.intensity = 0.75;
    }
    if (lightsRef.rimLight) {
      lightsRef.rimLight.color.setHex(0xef4444);
      lightsRef.rimLight.intensity = 1.1;
    }
  }

  // 1. Dark obsidian floor & burnished bronze trim
  floorMesh.visible = true;
  floorMesh.material = new THREE.MeshStandardMaterial({
    color: 0x1c1917,
    roughness: 0.75,
    metalness: 0.3,
  });

  trimMesh.visible = true;
  trimMesh.material = new THREE.MeshStandardMaterial({
    color: 0x7c2d12,
    roughness: 0.35,
    metalness: 0.75,
    emissive: 0x431407,
    emissiveIntensity: 0.5,
  });

  backWallMesh.visible = false;

  // 2. Glowing Molten Lava Cracks beneath floor
  const lavaMat = new THREE.MeshBasicMaterial({
    color: 0xff3b00,
    transparent: true,
    opacity: 0.9,
  });

  const lavaVeins = [
    { x: -5.0, z: -0.5, l: 4.2, r: 0.25 },
    { x: -2.5, z:  1.0, l: 3.2, r: -0.4 },
    { x:  0.0, z: -0.8, l: 3.8, r: 0.5 },
    { x:  2.8, z:  0.6, l: 4.0, r: -0.3 },
    { x:  5.5, z: -0.4, l: 3.6, r: 0.35 },
  ];

  lavaVeins.forEach(v => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(v.l, 0.02, 0.16), lavaMat.clone());
    mesh.position.set(v.x, 0.02, v.z);
    mesh.rotation.y = v.r;
    sceneryGroup.add(mesh);
    lavaCracks.push(mesh);
  });

  // 3. Jagged Obsidian Spires with glowing fissures
  const spireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.8,
    metalness: 0.4,
  });

  const spireCoords = [
    { x: -7.6, z: -3.0, h: 5.5, r: 0.9, tiltZ: -0.2 },
    { x: -4.0, z: -3.3, h: 4.0, r: 0.7, tiltZ: -0.15 },
    { x:  4.0, z: -3.3, h: 4.2, r: 0.7, tiltZ: -0.15 },
    { x:  7.6, z: -3.0, h: 5.8, r: 0.9, tiltZ: -0.2 },
    { x: -7.6, z:  2.8, h: 4.4, r: 0.75, tiltZ: 0.2 },
    { x:  7.6, z:  2.8, h: 4.6, r: 0.8,  tiltZ: 0.2 },
  ];

  spireCoords.forEach(p => {
    const spire = new THREE.Mesh(new THREE.ConeGeometry(p.r, p.h, 5), spireMat);
    spire.position.set(p.x, p.h / 2 - 0.2, p.z);
    spire.rotation.x = p.tiltZ;
    spire.rotation.y = Math.random() * Math.PI;
    sceneryGroup.add(spire);

    // Warm fire light
    const fLight = new THREE.PointLight(0xff4400, 1.2, 7);
    fLight.position.set(p.x, 2.2, p.z);
    sceneryGroup.add(fLight);
  });

  // 4. Rising Heat Distortion Particles and Floating Embers
  const emberMat = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    transparent: true,
    opacity: 0.9,
  });

  for (let i = 0; i < 75; i++) {
    const s = 0.08 + Math.random() * 0.14;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(s, s * 1.5, s), emberMat.clone());
    const x = (Math.random() - 0.5) * 16;
    const y = Math.random() * 6;
    const z = (Math.random() - 0.5) * 7;
    mesh.position.set(x, y, z);
    sceneryGroup.add(mesh);

    emberParticles.push({
      mesh,
      originX: x,
      originZ: z,
      x,
      y,
      z,
      vy: 1.4 + Math.random() * 2.2,
      vx: (Math.random() - 0.5) * 0.4,
      life: Math.random(),
      maxLife: 1.5 + Math.random() * 1.0,
    });
  }
}

/**
 * Updates dynamic scenery animations each frame
 * @param {number} dt Delta time in seconds
 */
export function updateArena(dt) {
  if (!sceneryGroup) return;

  // 1. Thunder Theme Animations
  if (currentElement === 'thunder') {
    // Drifting 3D clouds
    cloudClusters.forEach(c => {
      c.group.position.x += c.vx * dt;
      c.group.position.y = c.baseY + Math.sin(Date.now() * 0.001 + c.seed) * 0.18;
      if (c.group.position.x > 22) {
        c.group.position.x = -22;
      }
    });

    // Pulsing conductive energy circuit lines
    const circuitPulse = 0.75 + 0.25 * Math.sin(Date.now() * 0.005);
    circuitLines.forEach(c => {
      if (c.material) c.material.opacity = circuitPulse * (c.baseOpacity || 0.85);
    });

    // Lightning rod crystal pulses and crackling arcs
    lightningRods.forEach(r => {
      r.timer += dt;
      if (r.crystal) {
        r.crystal.rotation.y += dt * 2.0;
        const pulse = 0.8 + 0.4 * Math.sin(r.timer * 6.0);
        if (r.light) r.light.intensity = pulse * 1.5;
      }
      if (r.sparks) {
        const arr = r.sparks.geometry.attributes.position.array;
        for (let i = 0; i < 18; i += 3) {
          arr[i]     = (Math.random() - 0.5) * 0.7;
          arr[i + 1] = (Math.random() - 0.5) * 0.7;
          arr[i + 2] = (Math.random() - 0.5) * 0.7;
        }
        r.sparks.geometry.attributes.position.needsUpdate = true;
      }
    });
  }

  // 2. Frost Theme Animations
  if (currentElement === 'frost') {
    // Falling snowflakes
    snowflakeParticles.forEach(p => {
      p.y -= p.vy * dt;
      p.phase += p.swaySpeed * dt;
      p.mesh.position.set(p.x + Math.sin(p.phase) * p.swayAmp, p.y, p.z);
      if (p.y < -1.0) {
        p.y = 12.0 + Math.random() * 2.0;
        p.x = (Math.random() - 0.5) * 22;
      }
    });

    // Pulsing cyan rune cracks
    const runeGlow = 0.7 + 0.3 * Math.sin(Date.now() * 0.003);
    runeCracks.forEach(r => {
      if (r.material) r.material.opacity = runeGlow;
    });
  }

  // 3. Fire Theme Animations
  if (currentElement === 'fire') {
    // Floating embers
    emberParticles.forEach(p => {
      p.life += dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;

      const progress = p.life / p.maxLife;
      if (progress < 0.3) {
        p.mesh.material.color.setHex(0xffff44);
      } else if (progress < 0.7) {
        p.mesh.material.color.setHex(0xff6600);
      } else {
        p.mesh.material.color.setHex(0xdd1100);
      }
      p.mesh.material.opacity = Math.max(0, 1 - progress);
      p.mesh.position.set(p.x, p.y, p.z);

      if (p.life >= p.maxLife) {
        p.life = 0;
        p.x = p.originX + (Math.random() - 0.5) * 0.4;
        p.y = 0.05 + Math.random() * 0.3;
        p.z = p.originZ + (Math.random() - 0.5) * 0.4;
      }
    });

    // Pulsing molten lava cracks
    const lavaPulse = 0.75 + 0.25 * Math.sin(Date.now() * 0.004);
    lavaCracks.forEach(l => {
      if (l.material) l.material.opacity = lavaPulse;
    });
  }
}

export function getFloorMesh() {
  return floorMesh;
}
