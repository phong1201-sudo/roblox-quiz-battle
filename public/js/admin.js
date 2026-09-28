// Admin API client helper for 3D GLB/GLTF models, Character Art and 3D Brush Highlighter Calibrator
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

export async function upload3DModel(element, type, file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('element', element);
  fd.append('type', type);

  const res = await fetch('/api/admin/model/upload', {
    method: 'POST',
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Tải mô hình 3D thất bại');
  return data;
}

export async function fetchModelStatus() {
  const res = await fetch('/api/admin/model/status');
  return res.json();
}

export async function fetchModelList() {
  const res = await fetch('/api/admin/model/list');
  return res.json();
}

export async function uploadCharacterArt(element, type, file) {
  const fd = new FormData();
  fd.append('image', file);
  fd.append('element', element);
  fd.append('type', type);

  const res = await fetch('/api/admin/art/upload', {
    method: 'POST',
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Tải ảnh thất bại');
  return data;
}

export async function fetchArtStatus() {
  const res = await fetch('/api/admin/art/status');
  return res.json();
}

export async function fetchArtList() {
  const res = await fetch('/api/admin/art/list');
  return res.json();
}

export async function uploadBossAsset(element, file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('element', element);

  const res = await fetch('/api/admin/boss/upload', {
    method: 'POST',
    body: fd,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Tải mô hình Boss thất bại');
  return data;
}

export async function fetchBossStatus() {
  const res = await fetch('/api/admin/boss/status');
  return res.json();
}

export async function fetchSockets() {
  const res = await fetch('/api/admin/sockets');
  const data = await res.json();
  return data.sockets || data;
}

export async function saveSockets(socketsConfig) {
  const res = await fetch('/api/admin/sockets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(socketsConfig),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Lưu cấu hình khớp thất bại');
  return data;
}

export async function fetchRigging() {
  const res = await fetch('/api/admin/rigging');
  const data = await res.json();
  return data.sockets || data.rigging || data;
}

export async function saveRigging(payload) {
  const res = await fetch('/api/admin/rigging/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Lưu cấu hình rigging thất bại');
  return data;
}

export async function saveBrushRigging(payload) {
  const res = await fetch('/api/admin/rigging/brush-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Lưu cấu hình bút tô thất bại');
  return data;
}

export const DEFAULT_SOCKETS_CONFIG = {
  player: {
    armMeshName: 'Arm_L',
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
    default: { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    thunder: { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    fire:    { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    frost:   { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 }
  },
  boss: {
    armMeshName: 'Arm_R',
    shoulderX: -1.8,
    shoulderY: 2.2,
    shoulderZ: 0.2,
    shoulderPivot: { x: -1.8, y: 2.2, z: 0.2 },
    weapon: {
      offsetX: 0.0,
      offsetY: -0.6,
      offsetZ: 0.5,
      rotX: 0.0,
      rotY: -1.5708,
      rotZ: 0.5236,
      angle: 30
    },
    weaponOffset: {
      offsetX: 0.0,
      offsetY: -0.6,
      offsetZ: 0.5,
      rotX: 0.0,
      rotY: -1.5708,
      rotZ: 0.5236,
      angle: 30
    },
    slashArc: {
      idleAngle: 0,
      windupAngle: 80,
      slashAngle: -80,
      arc: 160
    },
    thunder: { handX: -0.8, handY: 1.2, handZ: 0.1 },
    fire:    { handX: -0.9, handY: 1.3, handZ: 0.1 },
    frost:   { handX: -0.9, handY: 1.3, handZ: 0.1 }
  },
  weapon: {
    player_sword: { hiltX: 0.0, hiltY: -0.5, hiltZ: 0.0 },
    boss_hammer:  { hiltX: 0.0, hiltY: -0.6, hiltZ: 0.0 }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3D BRUSH HIGHLIGHTER & IN-CONTEXT WEAPON CALIBRATOR ENGINE
// ─────────────────────────────────────────────────────────────────────────────
export function initBrushCalibrator() {
  const canvasPlayerEl = document.getElementById('canvas-player');
  const canvasBossEl   = document.getElementById('canvas-boss');

  if (!canvasPlayerEl || !canvasBossEl) {
    console.warn('[brush-calibrator] Canvas containers not found in DOM');
    return null;
  }

  // Persistent sockets data
  let socketsData = JSON.parse(JSON.stringify(DEFAULT_SOCKETS_CONFIG));
  fetchRigging().then(cfg => {
    if (cfg && typeof cfg === 'object') {
      socketsData = {
        player: { ...DEFAULT_SOCKETS_CONFIG.player, ...(cfg.player || {}) },
        boss:   { ...DEFAULT_SOCKETS_CONFIG.boss,   ...(cfg.boss || {}) },
        weapon: { ...DEFAULT_SOCKETS_CONFIG.weapon, ...(cfg.weapon || {}) },
      };
      syncPlayerUI();
      syncBossUI();
    }
  }).catch(() => {});

  // Navigation Tab switching
  const btnTabPlayer = document.getElementById('btn-tab-player');
  const btnTabBoss   = document.getElementById('btn-tab-boss');
  const panePlayer   = document.getElementById('pane-player');
  const paneBoss     = document.getElementById('pane-boss');

  btnTabPlayer?.addEventListener('click', () => {
    btnTabPlayer.classList.add('active');
    btnTabBoss?.classList.remove('active');
    panePlayer?.classList.remove('hidden');
    paneBoss?.classList.add('hidden');
    vpPlayer.onResize();
  });

  btnTabBoss?.addEventListener('click', () => {
    btnTabBoss.classList.add('active');
    btnTabPlayer?.classList.remove('active');
    paneBoss?.classList.remove('hidden');
    panePlayer?.classList.add('hidden');
    vpBoss.onResize();
  });

  // Helper: Setup a 3D Scene Viewport with OrbitControls
  function setupScene(container, camPos, lookAt) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a13);

    const w = container.clientWidth || 640;
    const h = container.clientHeight || 580;
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.copy(camPos);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.replaceChildren(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.copy(lookAt);
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.NONE, // Left click reserved for brush painting / weapon snap!
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE
    };

    // Lighting
    const amb = new THREE.AmbientLight(0xffffff, 1.2);
    const dir = new THREE.DirectionalLight(0xffffff, 2.0);
    dir.position.set(5, 10, 7);
    const back = new THREE.DirectionalLight(0x00b4d8, 0.9);
    back.position.set(-5, 5, -5);
    scene.add(amb, dir, back);

    const grid = new THREE.GridHelper(8, 16, 0x00b4d8, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    const onResize = () => {
      const rw = container.clientWidth || 640;
      const rh = container.clientHeight || 580;
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
      renderer.setSize(rw, rh);
    };

    const resizeObs = new ResizeObserver(onResize);
    resizeObs.observe(container);

    return { scene, camera, renderer, controls, onResize, resizeObs };
  }

  // Create Shoulder Gizmo
  function createShoulderGizmo(colorHex = 0x00ff88) {
    const gizmo = new THREE.Group();
    gizmo.name = 'ShoulderGizmo';
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 16, 16),
      new THREE.MeshBasicMaterial({ color: colorHex })
    );
    const ringX = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.22, 24),
      new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    ringX.rotation.x = Math.PI / 2;
    const ringY = new THREE.Mesh(
      new THREE.RingGeometry(0.16, 0.22, 24),
      new THREE.MeshBasicMaterial({ color: colorHex, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    ringY.rotation.y = Math.PI / 2;
    gizmo.add(core, ringX, ringY);
    return { gizmo, ringX, ringY };
  }

  // Visual Point Cloud Renderer for Painted Vertices
  function createPointManager(scene) {
    const group = new THREE.Group();
    group.name = 'PaintedPointsGroup';
    scene.add(group);

    // Spherical markers
    const sphereGeo = new THREE.SphereGeometry(0.045, 8, 8);
    const cyanMat   = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
    const orangeMat = new THREE.MeshBasicMaterial({ color: 0xff9900 });

    let points = []; // Array of { pos: Vector3, type: 'arm' | 'weapon', mesh: THREE.Mesh }

    function addPoint(pos, type = 'arm') {
      // Check minimum spacing (0.05 units) to prevent dense stacking
      for (const p of points) {
        if (p.pos.distanceTo(pos) < 0.05) return false;
      }
      const m = new THREE.Mesh(sphereGeo, type === 'arm' ? cyanMat : orangeMat);
      m.position.copy(pos);
      group.add(m);
      points.push({ pos: pos.clone(), type, mesh: m });
      return true;
    }

    function eraseWithin(pos, radius) {
      const remaining = [];
      let erasedCount = 0;
      for (const p of points) {
        if (p.pos.distanceTo(pos) <= radius) {
          group.remove(p.mesh);
          erasedCount++;
        } else {
          remaining.push(p);
        }
      }
      points = remaining;
      return erasedCount;
    }

    function clear() {
      points.forEach(p => group.remove(p.mesh));
      points = [];
    }

    function getArmPoints() {
      return points.filter(p => p.type === 'arm');
    }

    function getWeaponPoints() {
      return points.filter(p => p.type === 'weapon');
    }

    return {
      group,
      addPoint,
      eraseWithin,
      clear,
      getArmPoints,
      getWeaponPoints,
      getAllPoints: () => points
    };
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // TAB 1: PLAYER VIEWPORT & IN-CONTEXT WEAPON CALIBRATION
  // ═════════════════════════════════════════════════════════════════════════════
  const vpPlayer = setupScene(canvasPlayerEl, new THREE.Vector3(2.6, 2.0, 4.0), new THREE.Vector3(0, 1.2, 0));
  const playerModelHolder = new THREE.Group();
  playerModelHolder.name = 'PlayerModelHolder';
  vpPlayer.scene.add(playerModelHolder);

  const playerGizmoObj = createShoulderGizmo(0x00e5ff);
  vpPlayer.scene.add(playerGizmoObj.gizmo);

  const playerPoints = createPointManager(vpPlayer.scene);

  // In-Context Sword Mesh spawned directly inside Player Viewport
  const inContextSword = new THREE.Group();
  inContextSword.name = 'InContextSword';
  vpPlayer.scene.add(inContextSword);

  function buildSwordMesh() {
    while (inContextSword.children.length) inContextSword.remove(inContextSword.children[0]);
    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.8, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x0066aa, roughness: 0.3 })
    );
    blade.position.set(0, 0.9, 0);
    const guard = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.06, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0.2 })
    );
    guard.position.set(0, 0, 0);
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.35, 0.07),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 })
    );
    grip.position.set(0, -0.18, 0);
    inContextSword.add(blade, guard, grip);
    inContextSword.scale.set(1.4, 1.4, 1.4);
  }
  buildSwordMesh();

  // Load 3D Character Model for Tab 1
  async function loadPlayerModel() {
    while (playerModelHolder.children.length) playerModelHolder.remove(playerModelHolder.children[0]);
    let loaded = false;
    try {
      const gltf = await new Promise(resolve => gltfLoader.load('/assets/models/default_character.glb', resolve, undefined, () => resolve(null)));
      if (gltf && gltf.scene) {
        const model = gltf.scene;
        model.traverse(c => {
          if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
        });
        const bBox = new THREE.Box3().setFromObject(model);
        const bSize = new THREE.Vector3();
        bBox.getSize(bSize);
        if (bSize.y > 0.01) model.scale.setScalar(2.8 / bSize.y);
        const sBox = new THREE.Box3().setFromObject(model);
        model.position.x = - (sBox.min.x + sBox.max.x) / 2;
        model.position.z = - (sBox.min.z + sBox.max.z) / 2;
        model.position.y = - sBox.min.y;
        playerModelHolder.add(model);
        loaded = true;
      }
    } catch (e) {}

    if (!loaded) {
      // Procedural Blocky Character
      const grp = new THREE.Group();
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x2255cc }));
      torso.position.y = 1.3;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xf5c4a0 }));
      head.position.y = 2.3;
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), new THREE.MeshStandardMaterial({ color: 0xf5c4a0 }));
      armL.position.set(-0.65, 1.2, 0);
      armL.name = 'Arm_L';
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), new THREE.MeshStandardMaterial({ color: 0xf5c4a0 }));
      armR.position.set(0.65, 1.2, 0);
      grp.add(torso, head, armL, armR);
      playerModelHolder.add(grp);
    }
  }

  // Tab 1 State & Controls
  let playerBrushMode = 'paint_arm'; // 'paint_arm' | 'erase'
  let playerBrushSize = 0.25;
  let playerShoulderPivot = { x: -0.65, y: 1.2, z: 0.0 };
  let playerSwordOffset = { offsetX: 0.0, offsetY: -0.4, offsetZ: 0.1, angle: -45 };

  const hudPlayerShoulder   = document.getElementById('hud-player-shoulder');
  const hudPlayerPoints     = document.getElementById('hud-player-points');
  const btnPlayerBrushPaint = document.getElementById('btn-player-brush-paint');
  const btnPlayerBrushErase = document.getElementById('btn-player-brush-erase');
  const sliderPlayerBrushSz = document.getElementById('slider-player-brush-size');
  const valPlayerBrushSz    = document.getElementById('val-player-brush-size');
  const btnPlayerQuickFill  = document.getElementById('btn-player-quick-fill');
  const btnPlayerClearPts   = document.getElementById('btn-player-clear-points');

  const btnPlayerSnapSword  = document.getElementById('btn-player-snap-weapon');
  const sliderPlayerAngle   = document.getElementById('slider-player-sword-angle');
  const valPlayerAngle      = document.getElementById('val-player-sword-angle');
  const btnPlayerLockSword  = document.getElementById('btn-player-lock-weapon');
  const btnPlayerTestSwing  = document.getElementById('btn-player-test-swing');
  const btnPlayerSave       = document.getElementById('btn-player-save');
  const toastPlayer         = document.getElementById('toast-player');

  // Directional Nudge Buttons
  const btnNudgeXNeg = document.getElementById('btn-nudge-x-neg');
  const btnNudgeXPos = document.getElementById('btn-nudge-x-pos');
  const btnNudgeYPos = document.getElementById('btn-nudge-y-pos');
  const btnNudgeYNeg = document.getElementById('btn-nudge-y-neg');
  const btnNudgeZNeg = document.getElementById('btn-nudge-z-neg');
  const btnNudgeZPos = document.getElementById('btn-nudge-z-pos');

  // Brush Mode Toggling
  btnPlayerBrushPaint?.addEventListener('click', () => {
    playerBrushMode = 'paint_arm';
    btnPlayerBrushPaint.classList.add('active', 'arm-cyan');
    btnPlayerBrushErase.classList.remove('active', 'eraser');
  });

  btnPlayerBrushErase?.addEventListener('click', () => {
    playerBrushMode = 'erase';
    btnPlayerBrushErase.classList.add('active', 'eraser');
    btnPlayerBrushPaint.classList.remove('active', 'arm-cyan');
  });

  sliderPlayerBrushSz?.addEventListener('input', () => {
    playerBrushSize = parseFloat(sliderPlayerBrushSz.value || 0.25);
    if (valPlayerBrushSz) valPlayerBrushSz.textContent = playerBrushSize.toFixed(2);
  });

  // Calculate Shoulder Pivot from top edge of painted arm points
  function recalculatePlayerPivot() {
    const armPts = playerPoints.getArmPoints();
    if (hudPlayerPoints) hudPlayerPoints.textContent = `${armPts.length} điểm`;

    if (armPts.length > 0) {
      let topPt = armPts[0].pos;
      let sumX = 0, sumZ = 0;
      for (const p of armPts) {
        if (p.pos.y > topPt.y) topPt = p.pos;
        sumX += p.pos.x;
        sumZ += p.pos.z;
      }
      playerShoulderPivot = {
        x: Math.round(topPt.x * 100) / 100,
        y: Math.round(topPt.y * 100) / 100,
        z: Math.round(topPt.z * 100) / 100
      };
    } else {
      playerShoulderPivot = socketsData.player.shoulderPivot || { x: -0.65, y: 1.2, z: 0.0 };
    }

    playerGizmoObj.gizmo.position.set(playerShoulderPivot.x, playerShoulderPivot.y, playerShoulderPivot.z);
    if (hudPlayerShoulder) {
      hudPlayerShoulder.textContent = `(${playerShoulderPivot.x.toFixed(2)}, ${playerShoulderPivot.y.toFixed(2)}, ${playerShoulderPivot.z.toFixed(2)})`;
    }
  }

  // Update In-Context Sword Position in Viewport
  function updateInContextSwordTransform() {
    const pos = new THREE.Vector3(
      playerShoulderPivot.x + playerSwordOffset.offsetX,
      playerShoulderPivot.y + playerSwordOffset.offsetY,
      playerShoulderPivot.z + playerSwordOffset.offsetZ
    );
    inContextSword.position.copy(pos);
    inContextSword.rotation.set(0, Math.PI / 2, (playerSwordOffset.angle * Math.PI) / 180);
  }

  // Quick fill Left Arm preset
  btnPlayerQuickFill?.addEventListener('click', () => {
    playerPoints.clear();
    // Fill vertical column for Left Arm around x=-0.65, y=0.7 to 1.25, z=0
    for (let y = 0.70; y <= 1.26; y += 0.06) {
      for (let x = -0.78; x <= -0.52; x += 0.08) {
        for (let z = -0.12; z <= 0.12; z += 0.08) {
          playerPoints.addPoint(new THREE.Vector3(x, y, z), 'arm');
        }
      }
    }
    recalculatePlayerPivot();
    updateInContextSwordTransform();
  });

  btnPlayerClearPts?.addEventListener('click', () => {
    playerPoints.clear();
    recalculatePlayerPivot();
  });

  // Snap Sword to Hand (lowest / grip point of painted arm)
  btnPlayerSnapSword?.addEventListener('click', () => {
    const armPts = playerPoints.getArmPoints();
    if (armPts.length > 0) {
      let lowestPt = armPts[0].pos;
      for (const p of armPts) {
        if (p.pos.y < lowestPt.y) lowestPt = p.pos;
      }
      playerSwordOffset.offsetX = Math.round((lowestPt.x - playerShoulderPivot.x) * 100) / 100;
      playerSwordOffset.offsetY = Math.round((lowestPt.y - playerShoulderPivot.y) * 100) / 100;
      playerSwordOffset.offsetZ = Math.round((lowestPt.z - playerShoulderPivot.z + 0.08) * 100) / 100;
    } else {
      playerSwordOffset.offsetX = 0.0;
      playerSwordOffset.offsetY = -0.4;
      playerSwordOffset.offsetZ = 0.1;
    }
    updateInContextSwordTransform();

    if (toastPlayer) {
      toastPlayer.className = 'status-toast success';
      toastPlayer.innerHTML = `🎯 <b>Đã hút chuôi kiếm vào bàn tay</b> (${playerSwordOffset.offsetX.toFixed(2)}, ${playerSwordOffset.offsetY.toFixed(2)}, ${playerSwordOffset.offsetZ.toFixed(2)})`;
      toastPlayer.style.display = 'block';
      setTimeout(() => { toastPlayer.style.display = 'none'; }, 3000);
    }
  });

  // Nudge Sword Position
  const STEP = 0.04;
  btnNudgeXNeg?.addEventListener('click', () => { playerSwordOffset.offsetX -= STEP; updateInContextSwordTransform(); });
  btnNudgeXPos?.addEventListener('click', () => { playerSwordOffset.offsetX += STEP; updateInContextSwordTransform(); });
  btnNudgeYPos?.addEventListener('click', () => { playerSwordOffset.offsetY += STEP; updateInContextSwordTransform(); });
  btnNudgeYNeg?.addEventListener('click', () => { playerSwordOffset.offsetY -= STEP; updateInContextSwordTransform(); });
  btnNudgeZNeg?.addEventListener('click', () => { playerSwordOffset.offsetZ -= STEP; updateInContextSwordTransform(); });
  btnNudgeZPos?.addEventListener('click', () => { playerSwordOffset.offsetZ += STEP; updateInContextSwordTransform(); });

  sliderPlayerAngle?.addEventListener('input', () => {
    playerSwordOffset.angle = parseFloat(sliderPlayerAngle.value || -45);
    if (valPlayerAngle) valPlayerAngle.textContent = `${Math.round(playerSwordOffset.angle)}°`;
    updateInContextSwordTransform();
  });

  btnPlayerLockSword?.addEventListener('click', () => {
    if (toastPlayer) {
      toastPlayer.className = 'status-toast success';
      toastPlayer.innerHTML = `🔒 <b>Đã khóa kiếm vào tay!</b> Chuôi kiếm đã được cố định theo cánh tay.`;
      toastPlayer.style.display = 'block';
      setTimeout(() => { toastPlayer.style.display = 'none'; }, 3000);
    }
  });

  // Test Slash Swing Animation in Tab 1
  let isSwingingPlayer = false;
  btnPlayerTestSwing?.addEventListener('click', () => {
    if (isSwingingPlayer) return;
    isSwingingPlayer = true;

    // We animate a temporary Compound Arm containing inContextSword and painted points around shoulderPivot
    const compoundGrp = new THREE.Group();
    compoundGrp.position.set(playerShoulderPivot.x, playerShoulderPivot.y, playerShoulderPivot.z);
    vpPlayer.scene.add(compoundGrp);

    // Reparent sword and points relative to pivot
    inContextSword.position.set(playerSwordOffset.offsetX, playerSwordOffset.offsetY, playerSwordOffset.offsetZ);
    compoundGrp.add(inContextSword);

    const relPts = playerPoints.getAllPoints().map(p => {
      const origPos = p.mesh.position.clone();
      p.mesh.position.sub(new THREE.Vector3(playerShoulderPivot.x, playerShoulderPivot.y, playerShoulderPivot.z));
      compoundGrp.add(p.mesh);
      return { mesh: p.mesh, origPos };
    });

    const startTime = performance.now();
    const windupAngle = (60 * Math.PI) / 180;
    const strikeAngle = (-75 * Math.PI) / 180;

    function stepSwing(now) {
      const elapsed = now - startTime;
      if (elapsed < 100) {
        const t = elapsed / 100;
        compoundGrp.rotation.z = THREE.MathUtils.lerp(0, windupAngle, t * t);
        requestAnimationFrame(stepSwing);
      } else if (elapsed < 220) {
        const t = (elapsed - 100) / 120;
        compoundGrp.rotation.z = THREE.MathUtils.lerp(windupAngle, strikeAngle, t * t);
        requestAnimationFrame(stepSwing);
      } else if (elapsed < 320) {
        const t = (elapsed - 220) / 100;
        compoundGrp.rotation.z = THREE.MathUtils.lerp(strikeAngle, 0, 1 - (1 - t) * (1 - t));
        requestAnimationFrame(stepSwing);
      } else {
        compoundGrp.rotation.z = 0;
        // Restore sword and points to scene
        vpPlayer.scene.add(inContextSword);
        updateInContextSwordTransform();
        relPts.forEach(item => {
          playerPoints.group.add(item.mesh);
          item.mesh.position.copy(item.origPos);
        });
        vpPlayer.scene.remove(compoundGrp);
        isSwingingPlayer = false;
      }
    }
    requestAnimationFrame(stepSwing);
  });

  // Save Player Calibration via brush-save
  btnPlayerSave?.addEventListener('click', async () => {
    try {
      btnPlayerSave.disabled = true;
      btnPlayerSave.innerHTML = '<span>⏳</span> Đang lưu...';

      const payload = {
        target: 'player',
        shoulderPivot: playerShoulderPivot,
        weaponOffset: {
          offsetX: playerSwordOffset.offsetX,
          offsetY: playerSwordOffset.offsetY,
          offsetZ: playerSwordOffset.offsetZ,
          angle: playerSwordOffset.angle
        },
        paintedArm: {
          count: playerPoints.getArmPoints().length,
          topY: playerShoulderPivot.y
        },
        slashArc: {
          idleAngle: 0,
          windupAngle: 60,
          slashAngle: -75,
          arc: 135
        }
      };

      const res = await saveBrushRigging(payload);
      btnPlayerSave.disabled = false;
      btnPlayerSave.innerHTML = '<span>💾</span> LƯU CẤU HÌNH NHÂN VẬT';

      if (toastPlayer) {
        toastPlayer.className = 'status-toast success';
        toastPlayer.innerHTML = `✓ ${res.message || 'Lưu cấu hình thành công!'}`;
        toastPlayer.style.display = 'block';
        setTimeout(() => { toastPlayer.style.display = 'none'; }, 4000);
      }
    } catch (err) {
      btnPlayerSave.disabled = false;
      btnPlayerSave.innerHTML = '<span>💾</span> LƯU CẤU HÌNH NHÂN VẬT';
      if (toastPlayer) {
        toastPlayer.className = 'status-toast error';
        toastPlayer.textContent = 'Lỗi khi lưu: ' + err.message;
        toastPlayer.style.display = 'block';
      }
    }
  });

  // 3D Painting Raycaster on Player Viewport
  let isPointerDownPlayer = false;
  const raycasterPlayer = new THREE.Raycaster();
  const mousePlayer = new THREE.Vector2();

  function paintOnPlayerCanvas(e) {
    const rect = vpPlayer.renderer.domElement.getBoundingClientRect();
    mousePlayer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mousePlayer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterPlayer.setFromCamera(mousePlayer, vpPlayer.camera);
    const hits = raycasterPlayer.intersectObjects(playerModelHolder.children, true);

    if (hits.length > 0) {
      const hitPt = hits[0].point;
      if (playerBrushMode === 'paint_arm') {
        playerPoints.addPoint(hitPt, 'arm');
        recalculatePlayerPivot();
        updateInContextSwordTransform();
      } else if (playerBrushMode === 'erase') {
        playerPoints.eraseWithin(hitPt, playerBrushSize);
        recalculatePlayerPivot();
      }
    }
  }

  vpPlayer.renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button === 0) { // Left click = Paint/Erase
      isPointerDownPlayer = true;
      paintOnPlayerCanvas(e);
    }
  });

  vpPlayer.renderer.domElement.addEventListener('pointermove', (e) => {
    if (isPointerDownPlayer) {
      paintOnPlayerCanvas(e);
    }
  });

  window.addEventListener('pointerup', () => {
    isPointerDownPlayer = false;
  });

  function syncPlayerUI() {
    const pCfg = socketsData.player || {};
    const sPivot = pCfg.shoulderPivot || {};
    playerShoulderPivot.x = sPivot.x ?? pCfg.shoulderX ?? -0.65;
    playerShoulderPivot.y = sPivot.y ?? pCfg.shoulderY ?? 1.2;
    playerShoulderPivot.z = sPivot.z ?? pCfg.shoulderZ ?? 0.0;

    const w = pCfg.weaponOffset || pCfg.weapon || {};
    playerSwordOffset.offsetX = w.offsetX ?? 0.0;
    playerSwordOffset.offsetY = w.offsetY ?? -0.4;
    playerSwordOffset.offsetZ = w.offsetZ ?? 0.1;
    playerSwordOffset.angle   = w.angle ?? -45;

    if (valPlayerAngle) valPlayerAngle.textContent = `${Math.round(playerSwordOffset.angle)}°`;
    if (sliderPlayerAngle) sliderPlayerAngle.value = playerSwordOffset.angle;

    playerGizmoObj.gizmo.position.set(playerShoulderPivot.x, playerShoulderPivot.y, playerShoulderPivot.z);
    if (hudPlayerShoulder) {
      hudPlayerShoulder.textContent = `(${playerShoulderPivot.x.toFixed(2)}, ${playerShoulderPivot.y.toFixed(2)}, ${playerShoulderPivot.z.toFixed(2)})`;
    }
    updateInContextSwordTransform();
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // TAB 2: BOSS VIEWPORT & DUAL BRUSH MODE (ARM & WEAPON)
  // ═════════════════════════════════════════════════════════════════════════════
  const vpBoss = setupScene(canvasBossEl, new THREE.Vector3(-3.5, 2.5, 4.8), new THREE.Vector3(0, 1.8, 0));
  const bossModelHolder = new THREE.Group();
  bossModelHolder.name = 'BossModelHolder';
  vpBoss.scene.add(bossModelHolder);

  const bossGizmoObj = createShoulderGizmo(0xf59e0b);
  vpBoss.scene.add(bossGizmoObj.gizmo);

  const bossPoints = createPointManager(vpBoss.scene);

  let currentBossElement = 'fire';
  let bossBrushMode = 'paint_arm'; // 'paint_arm' | 'paint_weapon' | 'erase'
  let bossBrushSize = 0.45;
  let bossShoulderPivot = { x: -1.8, y: 2.2, z: 0.2 };
  let bossWeaponOffset  = { offsetX: 0.0, offsetY: -0.6, offsetZ: 0.5, angle: 30 };

  const hudBossShoulder     = document.getElementById('hud-boss-shoulder');
  const hudBossArmPts       = document.getElementById('hud-boss-arm-pts');
  const hudBossWeapPts      = document.getElementById('hud-boss-weap-pts');

  const tabBossThunder      = document.getElementById('tab-boss-thunder');
  const tabBossFire         = document.getElementById('tab-boss-fire');
  const tabBossFrost        = document.getElementById('tab-boss-frost');

  const btnBossBrushArm     = document.getElementById('btn-boss-brush-arm');
  const btnBossBrushWeapon  = document.getElementById('btn-boss-brush-weapon');
  const btnBossBrushErase   = document.getElementById('btn-boss-brush-erase');
  const sliderBossBrushSz   = document.getElementById('slider-boss-brush-size');
  const valBossBrushSz      = document.getElementById('val-boss-brush-size');
  const btnBossQuickFill    = document.getElementById('btn-boss-quick-fill');
  const btnBossClearPts     = document.getElementById('btn-boss-clear-points');

  const btnBossTestSlam     = document.getElementById('btn-boss-test-slam');
  const btnBossSave         = document.getElementById('btn-boss-save');
  const toastBoss           = document.getElementById('toast-boss');

  // Load Boss 3D Models
  async function loadBossModel(el = 'fire') {
    currentBossElement = el;
    while (bossModelHolder.children.length) bossModelHolder.remove(bossModelHolder.children[0]);

    let loaded = false;
    try {
      const gltf = await new Promise(resolve => gltfLoader.load(`/assets/models/boss_${el}.glb`, resolve, undefined, () => resolve(null)));
      if (gltf && gltf.scene) {
        const model = gltf.scene;
        model.traverse(c => {
          if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
        });
        const bBox = new THREE.Box3().setFromObject(model);
        const bSize = new THREE.Vector3();
        bBox.getSize(bSize);
        if (bSize.y > 0.01) model.scale.setScalar(4.0 / bSize.y);
        const sBox = new THREE.Box3().setFromObject(model);
        model.position.x = - (sBox.min.x + sBox.max.x) / 2;
        model.position.z = - (sBox.min.z + sBox.max.z) / 2;
        model.position.y = - sBox.min.y;
        bossModelHolder.add(model);
        loaded = true;
      }
    } catch (e) {}

    if (!loaded) {
      // Procedural Boss with holding hammer
      const grp = new THREE.Group();
      const bodyCol = el === 'frost' ? 0x0088cc : el === 'thunder' ? 0x00aacc : 0x882200;
      const torso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 1.2), new THREE.MeshStandardMaterial({ color: bodyCol }));
      torso.position.y = 2.2;
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshStandardMaterial({ color: bodyCol }));
      head.position.y = 4.2;
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), new THREE.MeshStandardMaterial({ color: bodyCol }));
      armR.position.set(-1.8, 2.2, 0);
      armR.name = 'Boss_Arm_R';

      // Hammer attached to arm
      const hammer = new THREE.Group();
      const hHandle = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.2, 0.18), new THREE.MeshStandardMaterial({ color: 0x222222 }));
      const hHead = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 1.2), new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x882200 }));
      hHead.position.y = 1.4;
      hammer.add(hHandle, hHead);
      hammer.position.set(-1.8, 1.6, 0.5);
      hammer.name = 'Boss_Hammer';

      grp.add(torso, head, armR, hammer);
      bossModelHolder.add(grp);
    }
  }

  // Boss element switcher tabs
  function setBossTab(el) {
    [tabBossThunder, tabBossFire, tabBossFrost].forEach(btn => {
      btn?.classList.toggle('active', btn?.dataset.boss === el);
    });
    loadBossModel(el);
  }
  tabBossThunder?.addEventListener('click', () => setBossTab('thunder'));
  tabBossFire?.addEventListener('click', () => setBossTab('fire'));
  tabBossFrost?.addEventListener('click', () => setBossTab('frost'));

  // Dual Brush Tool Selection
  btnBossBrushArm?.addEventListener('click', () => {
    bossBrushMode = 'paint_arm';
    btnBossBrushArm.classList.add('active', 'arm-cyan');
    btnBossBrushWeapon?.classList.remove('active', 'weapon-orange');
    btnBossBrushErase?.classList.remove('active', 'eraser');
  });

  btnBossBrushWeapon?.addEventListener('click', () => {
    bossBrushMode = 'paint_weapon';
    btnBossBrushWeapon.classList.add('active', 'weapon-orange');
    btnBossBrushArm?.classList.remove('active', 'arm-cyan');
    btnBossBrushErase?.classList.remove('active', 'eraser');
  });

  btnBossBrushErase?.addEventListener('click', () => {
    bossBrushMode = 'erase';
    btnBossBrushErase.classList.add('active', 'eraser');
    btnBossBrushArm?.classList.remove('active', 'arm-cyan');
    btnBossBrushWeapon?.classList.remove('active', 'weapon-orange');
  });

  sliderBossBrushSz?.addEventListener('input', () => {
    bossBrushSize = parseFloat(sliderBossBrushSz.value || 0.45);
    if (valBossBrushSz) valBossBrushSz.textContent = bossBrushSize.toFixed(2);
  });

  // Calculate Boss Pivot & Weapon offset from painted points
  function recalculateBossPivot() {
    const armPts = bossPoints.getArmPoints();
    const weapPts = bossPoints.getWeaponPoints();

    if (hudBossArmPts)  hudBossArmPts.textContent  = `${armPts.length} điểm`;
    if (hudBossWeapPts) hudBossWeapPts.textContent = `${weapPts.length} điểm`;

    if (armPts.length > 0) {
      let topPt = armPts[0].pos;
      for (const p of armPts) {
        if (p.pos.y > topPt.y) topPt = p.pos;
      }
      bossShoulderPivot = {
        x: Math.round(topPt.x * 100) / 100,
        y: Math.round(topPt.y * 100) / 100,
        z: Math.round(topPt.z * 100) / 100
      };
    } else {
      bossShoulderPivot = socketsData.boss.shoulderPivot || { x: -1.8, y: 2.2, z: 0.2 };
    }

    if (weapPts.length > 0) {
      const avg = new THREE.Vector3();
      weapPts.forEach(p => avg.add(p.pos));
      avg.divideScalar(weapPts.length);
      bossWeaponOffset.offsetX = Math.round((avg.x - bossShoulderPivot.x) * 100) / 100;
      bossWeaponOffset.offsetY = Math.round((avg.y - bossShoulderPivot.y) * 100) / 100;
      bossWeaponOffset.offsetZ = Math.round((avg.z - bossShoulderPivot.z) * 100) / 100;
    }

    bossGizmoObj.gizmo.position.set(bossShoulderPivot.x, bossShoulderPivot.y, bossShoulderPivot.z);
    if (hudBossShoulder) {
      hudBossShoulder.textContent = `(${bossShoulderPivot.x.toFixed(2)}, ${bossShoulderPivot.y.toFixed(2)}, ${bossShoulderPivot.z.toFixed(2)})`;
    }
  }

  // Quick fill Arm & Weapon for Boss
  btnBossQuickFill?.addEventListener('click', () => {
    bossPoints.clear();
    // Arm points (x ~ -1.8, y=1.2 to 2.3, z=0.0)
    for (let y = 1.2; y <= 2.3; y += 0.12) {
      for (let x = -2.1; x <= -1.5; x += 0.15) {
        for (let z = -0.3; z <= 0.3; z += 0.15) {
          bossPoints.addPoint(new THREE.Vector3(x, y, z), 'arm');
        }
      }
    }
    // Weapon / Hammer points (x ~ -1.8, y=0.8 to 2.8, z=0.5)
    for (let y = 0.8; y <= 2.8; y += 0.15) {
      for (let x = -2.2; x <= -1.4; x += 0.2) {
        for (let z = 0.35; z <= 0.65; z += 0.15) {
          bossPoints.addPoint(new THREE.Vector3(x, y, z), 'weapon');
        }
      }
    }
    recalculateBossPivot();
  });

  btnBossClearPts?.addEventListener('click', () => {
    bossPoints.clear();
    recalculateBossPivot();
  });

  // Test Slam Animation in Tab 2
  let isSlammingBoss = false;
  btnBossTestSlam?.addEventListener('click', () => {
    if (isSlammingBoss) return;
    isSlammingBoss = true;

    // Temporary Compound Group containing all painted arm + weapon points
    const compoundGrp = new THREE.Group();
    compoundGrp.position.set(bossShoulderPivot.x, bossShoulderPivot.y, bossShoulderPivot.z);
    vpBoss.scene.add(compoundGrp);

    const relPts = bossPoints.getAllPoints().map(p => {
      const origPos = p.mesh.position.clone();
      p.mesh.position.sub(new THREE.Vector3(bossShoulderPivot.x, bossShoulderPivot.y, bossShoulderPivot.z));
      compoundGrp.add(p.mesh);
      return { mesh: p.mesh, origPos };
    });

    const startTime = performance.now();
    const raiseAngle = (80 * Math.PI) / 180;
    const slamAngle  = (-80 * Math.PI) / 180;

    function stepSlam(now) {
      const elapsed = now - startTime;
      if (elapsed < 160) {
        const t = elapsed / 160;
        compoundGrp.rotation.z = THREE.MathUtils.lerp(0, raiseAngle, t * t);
        requestAnimationFrame(stepSlam);
      } else if (elapsed < 290) {
        const t = (elapsed - 160) / 130;
        compoundGrp.rotation.z = THREE.MathUtils.lerp(raiseAngle, slamAngle, t * t);
        requestAnimationFrame(stepSlam);
      } else if (elapsed < 440) {
        const t = (elapsed - 290) / 150;
        compoundGrp.rotation.z = THREE.MathUtils.lerp(slamAngle, 0, 1 - (1 - t) * (1 - t));
        requestAnimationFrame(stepSlam);
      } else {
        compoundGrp.rotation.z = 0;
        relPts.forEach(item => {
          bossPoints.group.add(item.mesh);
          item.mesh.position.copy(item.origPos);
        });
        vpBoss.scene.remove(compoundGrp);
        isSlammingBoss = false;
      }
    }
    requestAnimationFrame(stepSlam);
  });

  // Save Boss Calibration
  btnBossSave?.addEventListener('click', async () => {
    try {
      btnBossSave.disabled = true;
      btnBossSave.innerHTML = '<span>⏳</span> Đang lưu...';

      const payload = {
        target: 'boss',
        shoulderPivot: bossShoulderPivot,
        weaponOffset: {
          offsetX: bossWeaponOffset.offsetX,
          offsetY: bossWeaponOffset.offsetY,
          offsetZ: bossWeaponOffset.offsetZ,
          angle: bossWeaponOffset.angle || 30
        },
        paintedArm: {
          count: bossPoints.getArmPoints().length,
          topY: bossShoulderPivot.y
        },
        paintedWeapon: {
          count: bossPoints.getWeaponPoints().length
        },
        slashArc: {
          idleAngle: 0,
          windupAngle: 80,
          slashAngle: -80,
          arc: 160
        }
      };

      const res = await saveBrushRigging(payload);
      btnBossSave.disabled = false;
      btnBossSave.innerHTML = '<span>💾</span> LƯU CẤU HÌNH BOSS';

      if (toastBoss) {
        toastBoss.className = 'status-toast success';
        toastBoss.innerHTML = `✓ ${res.message || 'Lưu cấu hình Boss thành công!'}`;
        toastBoss.style.display = 'block';
        setTimeout(() => { toastBoss.style.display = 'none'; }, 4000);
      }
    } catch (err) {
      btnBossSave.disabled = false;
      btnBossSave.innerHTML = '<span>💾</span> LƯU CẤU HÌNH BOSS';
      if (toastBoss) {
        toastBoss.className = 'status-toast error';
        toastBoss.textContent = 'Lỗi khi lưu: ' + err.message;
        toastBoss.style.display = 'block';
      }
    }
  });

  // 3D Painting Raycaster on Boss Viewport
  let isPointerDownBoss = false;
  const raycasterBoss = new THREE.Raycaster();
  const mouseBoss = new THREE.Vector2();

  function paintOnBossCanvas(e) {
    const rect = vpBoss.renderer.domElement.getBoundingClientRect();
    mouseBoss.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseBoss.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycasterBoss.setFromCamera(mouseBoss, vpBoss.camera);
    const hits = raycasterBoss.intersectObjects(bossModelHolder.children, true);

    if (hits.length > 0) {
      const hitPt = hits[0].point;
      if (bossBrushMode === 'paint_arm') {
        bossPoints.addPoint(hitPt, 'arm');
        recalculateBossPivot();
      } else if (bossBrushMode === 'paint_weapon') {
        bossPoints.addPoint(hitPt, 'weapon');
        recalculateBossPivot();
      } else if (bossBrushMode === 'erase') {
        bossPoints.eraseWithin(hitPt, bossBrushSize);
        recalculateBossPivot();
      }
    }
  }

  vpBoss.renderer.domElement.addEventListener('pointerdown', (e) => {
    if (e.button === 0) {
      isPointerDownBoss = true;
      paintOnBossCanvas(e);
    }
  });

  vpBoss.renderer.domElement.addEventListener('pointermove', (e) => {
    if (isPointerDownBoss) {
      paintOnBossCanvas(e);
    }
  });

  window.addEventListener('pointerup', () => {
    isPointerDownBoss = false;
  });

  function syncBossUI() {
    const bCfg = socketsData.boss || {};
    const sPivot = bCfg.shoulderPivot || {};
    bossShoulderPivot.x = sPivot.x ?? bCfg.shoulderX ?? -1.8;
    bossShoulderPivot.y = sPivot.y ?? bCfg.shoulderY ?? 2.2;
    bossShoulderPivot.z = sPivot.z ?? bCfg.shoulderZ ?? 0.2;

    const w = bCfg.weaponOffset || bCfg.weapon || {};
    bossWeaponOffset.offsetX = w.offsetX ?? 0.0;
    bossWeaponOffset.offsetY = w.offsetY ?? -0.6;
    bossWeaponOffset.offsetZ = w.offsetZ ?? 0.5;
    bossWeaponOffset.angle   = w.angle ?? 30;

    bossGizmoObj.gizmo.position.set(bossShoulderPivot.x, bossShoulderPivot.y, bossShoulderPivot.z);
    if (hudBossShoulder) {
      hudBossShoulder.textContent = `(${bossShoulderPivot.x.toFixed(2)}, ${bossShoulderPivot.y.toFixed(2)}, ${bossShoulderPivot.z.toFixed(2)})`;
    }
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // ANIMATION LOOP
  // ═════════════════════════════════════════════════════════════════════════════
  let animId = null;
  function animate() {
    animId = requestAnimationFrame(animate);

    vpPlayer.controls.update();
    vpBoss.controls.update();

    // Subtle pulsing for gizmo rings
    const t = Date.now() * 0.003;
    playerGizmoObj.ringX.scale.setScalar(1 + Math.sin(t) * 0.12);
    playerGizmoObj.ringY.scale.setScalar(1 + Math.cos(t) * 0.12);
    bossGizmoObj.ringX.scale.setScalar(1 + Math.sin(t) * 0.12);
    bossGizmoObj.ringY.scale.setScalar(1 + Math.cos(t) * 0.12);

    vpPlayer.renderer.render(vpPlayer.scene, vpPlayer.camera);
    vpBoss.renderer.render(vpBoss.scene, vpBoss.camera);
  }
  animate();

  loadPlayerModel();
  loadBossModel('fire');

  return {
    destroy: () => {
      cancelAnimationFrame(animId);
      vpPlayer.resizeObs.disconnect();
      vpBoss.resizeObs.disconnect();
      vpPlayer.renderer.dispose();
      vpBoss.renderer.dispose();
    }
  };
}

// Backwards-compatible init functions
export function init3ViewportCalibrator() {
  return initBrushCalibrator();
}

export function initVisualSocketCalibrator(opts = {}) {
  return initBrushCalibrator();
}

export function initStandaloneCalibrator() {
  return initBrushCalibrator();
}
