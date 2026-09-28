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

  // ───────────────────────────────────────────────────────────────────────────
  // MEDIAPIPE POSE & VISUAL SKELETON RIGGING (Meta Animated Drawings Style)
  // ───────────────────────────────────────────────────────────────────────────
  let poseInstance = null;
  let poseInitPromise = null;

  async function getMediaPipePose() {
    if (poseInstance) return poseInstance;
    if (poseInitPromise) return poseInitPromise;

    poseInitPromise = (async () => {
      if (typeof window !== 'undefined' && window.Pose) {
        try {
          const pose = new window.Pose({
            locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
          });
          pose.setOptions({
            modelComplexity: 1,
            smoothLandmarks: true,
            enableSegmentation: false,
            smoothSegmentation: false,
            minDetectionConfidence: 0.4,
            minTrackingConfidence: 0.4,
          });
          await pose.initialize();
          poseInstance = pose;
          return poseInstance;
        } catch (e) {
          console.warn('[MediaPipe] Init warning, falling back to heuristics:', e);
          return null;
        }
      }
      return null;
    })();

    return poseInitPromise;
  }

  function createPoseRigVisuals(scene, isBoss = false) {
    const group = new THREE.Group();
    group.name = isBoss ? 'BossPoseRig' : 'PlayerPoseRig';

    const shoulderColor = isBoss ? 0xf59e0b : 0x00e5ff;
    const wristColor = isBoss ? 0xef4444 : 0xff9900;
    const boneColor = isBoss ? 0xfbbf24 : 0x06d6a0;

    // Shoulder marker sphere
    const shoulderGeo = new THREE.SphereGeometry(isBoss ? 0.22 : 0.14, 16, 16);
    const shoulderMat = new THREE.MeshBasicMaterial({ color: shoulderColor, depthTest: false, transparent: true, opacity: 0.95 });
    const shoulderMesh = new THREE.Mesh(shoulderGeo, shoulderMat);
    shoulderMesh.renderOrder = 999;
    shoulderMesh.userData = { type: 'shoulder', isBoss };

    const sHaloGeo = new THREE.RingGeometry(isBoss ? 0.24 : 0.16, isBoss ? 0.34 : 0.24, 24);
    const sHaloMat = new THREE.MeshBasicMaterial({ color: shoulderColor, side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthTest: false });
    const sHalo = new THREE.Mesh(sHaloGeo, sHaloMat);
    sHalo.renderOrder = 999;
    shoulderMesh.add(sHalo);

    // Wrist / Grip marker sphere
    const wristGeo = new THREE.SphereGeometry(isBoss ? 0.20 : 0.12, 16, 16);
    const wristMat = new THREE.MeshBasicMaterial({ color: wristColor, depthTest: false, transparent: true, opacity: 0.95 });
    const wristMesh = new THREE.Mesh(wristGeo, wristMat);
    wristMesh.renderOrder = 999;
    wristMesh.userData = { type: 'wrist', isBoss };

    const wHaloGeo = new THREE.RingGeometry(isBoss ? 0.22 : 0.14, isBoss ? 0.32 : 0.22, 24);
    const wHaloMat = new THREE.MeshBasicMaterial({ color: wristColor, side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthTest: false });
    const wHalo = new THREE.Mesh(wHaloGeo, wHaloMat);
    wHalo.renderOrder = 999;
    wristMesh.add(wHalo);

    // Connecting Bone Cylinder
    const boneRadius = isBoss ? 0.07 : 0.04;
    const boneGeo = new THREE.CylinderGeometry(boneRadius, boneRadius, 1, 12);
    boneGeo.translate(0, 0.5, 0);
    boneGeo.rotateX(Math.PI / 2);
    const boneMat = new THREE.MeshBasicMaterial({ color: boneColor, transparent: true, opacity: 0.85, depthTest: false });
    const boneMesh = new THREE.Mesh(boneGeo, boneMat);
    boneMesh.renderOrder = 998;

    group.add(shoulderMesh, wristMesh, boneMesh);
    scene.add(group);

    function updateBone(p1, p2) {
      const v1 = new THREE.Vector3(p1.x, p1.y, p1.z);
      const v2 = new THREE.Vector3(p2.x, p2.y, p2.z);
      shoulderMesh.position.copy(v1);
      wristMesh.position.copy(v2);

      const dist = v1.distanceTo(v2);
      boneMesh.position.copy(v1);
      boneMesh.lookAt(v2);
      boneMesh.scale.set(1, 1, Math.max(dist, 0.01));
    }

    return {
      group,
      shoulderMesh,
      wristMesh,
      boneMesh,
      updateBone,
      setVisible: (v) => { group.visible = v; }
    };
  }

  async function runPoseDetectionOnCanvas(vp, modelHolder, isBoss = false) {
    vp.renderer.render(vp.scene, vp.camera);
    const canvas = vp.renderer.domElement;

    let landmarks = null;
    try {
      const pose = await getMediaPipePose();
      if (pose) {
        landmarks = await new Promise((resolve) => {
          let done = false;
          const timer = setTimeout(() => {
            if (!done) { done = true; resolve(null); }
          }, 3500);

          pose.onResults((results) => {
            if (!done) {
              done = true;
              clearTimeout(timer);
              if (results && results.poseLandmarks && results.poseLandmarks.length > 0) {
                resolve(results.poseLandmarks);
              } else {
                resolve(null);
              }
            }
          });

          pose.send({ image: canvas }).catch((err) => {
            if (!done) {
              done = true;
              clearTimeout(timer);
              resolve(null);
            }
          });
        });
      }
    } catch (err) {
      console.warn('[runPoseDetectionOnCanvas] Pose inference note:', err);
    }

    const bBox = new THREE.Box3().setFromObject(modelHolder);
    const bCenter = new THREE.Vector3();
    bBox.getCenter(bCenter);

    function unprojectLandmark(lm) {
      if (!lm) return null;
      const ndc = new THREE.Vector2(lm.x * 2 - 1, -(lm.y * 2 - 1));
      const ray = new THREE.Raycaster();
      ray.setFromCamera(ndc, vp.camera);

      const hits = ray.intersectObjects(modelHolder.children, true);
      if (hits.length > 0) {
        return hits[0].point.clone();
      }
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -bCenter.z);
      const pt = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, pt)) {
        return pt;
      }
      return null;
    }

    let shoulderPt = null;
    let wristPt = null;
    let rawPoseData = null;

    if (landmarks) {
      const lShoulder = landmarks[11];
      const rShoulder = landmarks[12];
      const lWrist = landmarks[15] || landmarks[19];
      const rWrist = landmarks[16] || landmarks[20];

      const chosenShoulder = lShoulder || rShoulder;
      const chosenWrist = lWrist || rWrist;

      if (chosenShoulder) shoulderPt = unprojectLandmark(chosenShoulder);
      if (chosenWrist) wristPt = unprojectLandmark(chosenWrist);

      rawPoseData = {
        shoulder: chosenShoulder ? { x: chosenShoulder.x, y: chosenShoulder.y, z: chosenShoulder.z, visibility: chosenShoulder.visibility } : null,
        wrist: chosenWrist ? { x: chosenWrist.x, y: chosenWrist.y, z: chosenWrist.z, visibility: chosenWrist.visibility } : null,
        method: 'mediapipe'
      };
    }

    if (!shoulderPt || Math.abs(shoulderPt.x) > 10 || isNaN(shoulderPt.x)) {
      shoulderPt = isBoss ? new THREE.Vector3(-1.80, 2.20, 0.20) : new THREE.Vector3(-0.65, 1.20, 0.00);
      rawPoseData = { method: 'heuristic_geometry' };
    }

    if (!wristPt || Math.abs(wristPt.x) > 10 || isNaN(wristPt.x)) {
      wristPt = isBoss ? new THREE.Vector3(-1.80, 1.20, 0.20) : new THREE.Vector3(-0.65, 0.80, 0.10);
    }

    return {
      shoulder: {
        x: Math.round(shoulderPt.x * 100) / 100,
        y: Math.round(shoulderPt.y * 100) / 100,
        z: Math.round(shoulderPt.z * 100) / 100
      },
      wrist: {
        x: Math.round(wristPt.x * 100) / 100,
        y: Math.round(wristPt.y * 100) / 100,
        z: Math.round(wristPt.z * 100) / 100
      },
      rawPose: rawPoseData
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
    syncPlayerUI();
  }

  // Tab 1 State & Controls
  let playerBrushMode = 'paint_arm'; // 'paint_arm' | 'erase'
  let playerBrushSize = 0.25;
  let playerShoulderPivot = { x: -0.65, y: 1.2, z: 0.0 };
  let playerHandSocket    = { x: -0.65, y: 0.8, z: 0.1 };
  let playerNormalizedPose = null;
  let playerSwordOffset = { offsetX: 0.0, offsetY: -0.4, offsetZ: 0.1, angle: -45 };

  const playerPoseRig       = createPoseRigVisuals(vpPlayer.scene, false);
  const hudPlayerShoulder   = document.getElementById('hud-player-shoulder');
  const hudPlayerWrist      = document.getElementById('hud-player-wrist');
  const hudPlayerPoints     = document.getElementById('hud-player-points');
  const btnPlayerAutoPose   = document.getElementById('btn-player-auto-pose');
  const playerPoseStatus    = document.getElementById('player-pose-status');

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

  // Auto-Detect Pose Button Click
  btnPlayerAutoPose?.addEventListener('click', async () => {
    if (playerPoseStatus) {
      playerPoseStatus.style.display = 'block';
      playerPoseStatus.style.color = '#00e5ff';
      playerPoseStatus.innerHTML = '⏳ <i>Đang quét ảnh mô hình &amp; phát hiện khớp (MediaPipe Pose)...</i>';
    }
    btnPlayerAutoPose.disabled = true;

    try {
      const res = await runPoseDetectionOnCanvas(vpPlayer, playerModelHolder, false);
      playerShoulderPivot = res.shoulder;
      playerHandSocket = res.wrist;
      playerNormalizedPose = res.rawPose;

      playerSwordOffset.offsetX = Math.round((playerHandSocket.x - playerShoulderPivot.x) * 100) / 100;
      playerSwordOffset.offsetY = Math.round((playerHandSocket.y - playerShoulderPivot.y) * 100) / 100;
      playerSwordOffset.offsetZ = Math.round((playerHandSocket.z - playerShoulderPivot.z) * 100) / 100;

      playerGizmoObj.gizmo.position.set(playerShoulderPivot.x, playerShoulderPivot.y, playerShoulderPivot.z);
      playerPoseRig.updateBone(playerShoulderPivot, playerHandSocket);
      updateInContextSwordTransform();

      if (hudPlayerShoulder) hudPlayerShoulder.textContent = `(${playerShoulderPivot.x.toFixed(2)}, ${playerShoulderPivot.y.toFixed(2)}, ${playerShoulderPivot.z.toFixed(2)})`;
      if (hudPlayerWrist) hudPlayerWrist.textContent = `(${playerHandSocket.x.toFixed(2)}, ${playerHandSocket.y.toFixed(2)}, ${playerHandSocket.z.toFixed(2)})`;

      if (playerPoseStatus) {
        playerPoseStatus.style.color = '#06d6a0';
        playerPoseStatus.innerHTML = `✓ <b>Bắt khớp thành công!</b> Vai: (${playerShoulderPivot.x.toFixed(2)}, ${playerShoulderPivot.y.toFixed(2)}), Tay: (${playerHandSocket.x.toFixed(2)}, ${playerHandSocket.y.toFixed(2)}). Hãy kéo thả các điểm Marker để tinh chỉnh nếu cần!`;
      }
    } catch (e) {
      if (playerPoseStatus) {
        playerPoseStatus.style.color = '#ef4444';
        playerPoseStatus.textContent = 'Lỗi phát hiện dáng: ' + e.message;
      }
    } finally {
      btnPlayerAutoPose.disabled = false;
    }
  });

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
    playerPoseRig.updateBone(playerShoulderPivot, playerHandSocket);
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

    playerHandSocket.x = Math.round(pos.x * 100) / 100;
    playerHandSocket.y = Math.round(pos.y * 100) / 100;
    playerHandSocket.z = Math.round(pos.z * 100) / 100;
    playerPoseRig.updateBone(playerShoulderPivot, playerHandSocket);
    if (hudPlayerWrist) {
      hudPlayerWrist.textContent = `(${playerHandSocket.x.toFixed(2)}, ${playerHandSocket.y.toFixed(2)}, ${playerHandSocket.z.toFixed(2)})`;
    }
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
        handSocket: playerHandSocket,
        normalizedPose: playerNormalizedPose,
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

  // 3D Painting & Interactive Skeleton Dragging on Player Viewport
  let isPointerDownPlayer = false;
  let activeDragMarkerPlayer = null;
  const dragPlanePlayer = new THREE.Plane();
  const planeIntersectPtPlayer = new THREE.Vector3();
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
    if (e.button === 0) { // Left click
      const rect = vpPlayer.renderer.domElement.getBoundingClientRect();
      mousePlayer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mousePlayer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterPlayer.setFromCamera(mousePlayer, vpPlayer.camera);
      const markerHits = raycasterPlayer.intersectObjects([playerPoseRig.shoulderMesh, playerPoseRig.wristMesh], true);

      if (markerHits.length > 0) {
        let hitObj = markerHits[0].object;
        while (hitObj && !hitObj.userData?.type && hitObj.parent) hitObj = hitObj.parent;
        if (hitObj?.userData?.type) {
          activeDragMarkerPlayer = hitObj;
          vpPlayer.controls.enabled = false;
          const camDir = vpPlayer.camera.getWorldDirection(new THREE.Vector3());
          dragPlanePlayer.setFromNormalAndCoplanarPoint(camDir.negate(), activeDragMarkerPlayer.position);
          return;
        }
      }

      isPointerDownPlayer = true;
      paintOnPlayerCanvas(e);
    }
  });

  vpPlayer.renderer.domElement.addEventListener('pointermove', (e) => {
    const rect = vpPlayer.renderer.domElement.getBoundingClientRect();
    mousePlayer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mousePlayer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (activeDragMarkerPlayer) {
      raycasterPlayer.setFromCamera(mousePlayer, vpPlayer.camera);
      if (raycasterPlayer.ray.intersectPlane(dragPlanePlayer, planeIntersectPtPlayer)) {
        const type = activeDragMarkerPlayer.userData.type;
        if (type === 'shoulder') {
          playerShoulderPivot.x = Math.round(planeIntersectPtPlayer.x * 100) / 100;
          playerShoulderPivot.y = Math.round(planeIntersectPtPlayer.y * 100) / 100;
          playerShoulderPivot.z = Math.round(planeIntersectPtPlayer.z * 100) / 100;
          playerGizmoObj.gizmo.position.set(playerShoulderPivot.x, playerShoulderPivot.y, playerShoulderPivot.z);
          if (hudPlayerShoulder) hudPlayerShoulder.textContent = `(${playerShoulderPivot.x.toFixed(2)}, ${playerShoulderPivot.y.toFixed(2)}, ${playerShoulderPivot.z.toFixed(2)})`;
        } else if (type === 'wrist') {
          playerHandSocket.x = Math.round(planeIntersectPtPlayer.x * 100) / 100;
          playerHandSocket.y = Math.round(planeIntersectPtPlayer.y * 100) / 100;
          playerHandSocket.z = Math.round(planeIntersectPtPlayer.z * 100) / 100;
          playerSwordOffset.offsetX = Math.round((playerHandSocket.x - playerShoulderPivot.x) * 100) / 100;
          playerSwordOffset.offsetY = Math.round((playerHandSocket.y - playerShoulderPivot.y) * 100) / 100;
          playerSwordOffset.offsetZ = Math.round((playerHandSocket.z - playerShoulderPivot.z) * 100) / 100;
          if (hudPlayerWrist) hudPlayerWrist.textContent = `(${playerHandSocket.x.toFixed(2)}, ${playerHandSocket.y.toFixed(2)}, ${playerHandSocket.z.toFixed(2)})`;
        }
        playerPoseRig.updateBone(playerShoulderPivot, playerHandSocket);
        const pos = new THREE.Vector3(
          playerShoulderPivot.x + playerSwordOffset.offsetX,
          playerShoulderPivot.y + playerSwordOffset.offsetY,
          playerShoulderPivot.z + playerSwordOffset.offsetZ
        );
        inContextSword.position.copy(pos);
        inContextSword.rotation.set(0, Math.PI / 2, (playerSwordOffset.angle * Math.PI) / 180);
      }
      return;
    }

    if (isPointerDownPlayer) {
      paintOnPlayerCanvas(e);
    }
  });

  window.addEventListener('pointerup', () => {
    isPointerDownPlayer = false;
    if (activeDragMarkerPlayer) {
      activeDragMarkerPlayer = null;
      vpPlayer.controls.enabled = true;
    }
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

    if (pCfg.handSocket) {
      playerHandSocket.x = pCfg.handSocket.x ?? (playerShoulderPivot.x + playerSwordOffset.offsetX);
      playerHandSocket.y = pCfg.handSocket.y ?? (playerShoulderPivot.y + playerSwordOffset.offsetY);
      playerHandSocket.z = pCfg.handSocket.z ?? (playerShoulderPivot.z + playerSwordOffset.offsetZ);
    } else {
      playerHandSocket.x = playerShoulderPivot.x + playerSwordOffset.offsetX;
      playerHandSocket.y = playerShoulderPivot.y + playerSwordOffset.offsetY;
      playerHandSocket.z = playerShoulderPivot.z + playerSwordOffset.offsetZ;
    }

    if (valPlayerAngle) valPlayerAngle.textContent = `${Math.round(playerSwordOffset.angle)}°`;
    if (sliderPlayerAngle) sliderPlayerAngle.value = playerSwordOffset.angle;

    playerGizmoObj.gizmo.position.set(playerShoulderPivot.x, playerShoulderPivot.y, playerShoulderPivot.z);
    playerPoseRig.updateBone(playerShoulderPivot, playerHandSocket);
    if (hudPlayerShoulder) {
      hudPlayerShoulder.textContent = `(${playerShoulderPivot.x.toFixed(2)}, ${playerShoulderPivot.y.toFixed(2)}, ${playerShoulderPivot.z.toFixed(2)})`;
    }
    if (hudPlayerWrist) {
      hudPlayerWrist.textContent = `(${playerHandSocket.x.toFixed(2)}, ${playerHandSocket.y.toFixed(2)}, ${playerHandSocket.z.toFixed(2)})`;
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
  let bossHandSocket    = { x: -1.8, y: 1.2, z: 0.2 };
  let bossNormalizedPose = null;
  let bossWeaponOffset  = { offsetX: 0.0, offsetY: -0.6, offsetZ: 0.5, angle: 30 };

  const bossPoseRig         = createPoseRigVisuals(vpBoss.scene, true);
  const hudBossShoulder     = document.getElementById('hud-boss-shoulder');
  const hudBossWrist        = document.getElementById('hud-boss-wrist');
  const hudBossArmPts       = document.getElementById('hud-boss-arm-pts');
  const hudBossWeapPts      = document.getElementById('hud-boss-weap-pts');
  const btnBossAutoPose     = document.getElementById('btn-boss-auto-pose');
  const bossPoseStatus      = document.getElementById('boss-pose-status');

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

  // Auto-Detect Pose Button Click for Boss
  btnBossAutoPose?.addEventListener('click', async () => {
    if (bossPoseStatus) {
      bossPoseStatus.style.display = 'block';
      bossPoseStatus.style.color = '#fbbf24';
      bossPoseStatus.innerHTML = '⏳ <i>Đang quét ảnh mô hình Boss &amp; phát hiện khớp (MediaPipe Pose)...</i>';
    }
    btnBossAutoPose.disabled = true;

    try {
      const res = await runPoseDetectionOnCanvas(vpBoss, bossModelHolder, true);
      bossShoulderPivot = res.shoulder;
      bossHandSocket = res.wrist;
      bossNormalizedPose = res.rawPose;

      bossWeaponOffset.offsetX = Math.round((bossHandSocket.x - bossShoulderPivot.x) * 100) / 100;
      bossWeaponOffset.offsetY = Math.round((bossHandSocket.y - bossShoulderPivot.y) * 100) / 100;
      bossWeaponOffset.offsetZ = Math.round((bossHandSocket.z - bossShoulderPivot.z) * 100) / 100;

      bossGizmoObj.gizmo.position.set(bossShoulderPivot.x, bossShoulderPivot.y, bossShoulderPivot.z);
      bossPoseRig.updateBone(bossShoulderPivot, bossHandSocket);

      if (hudBossShoulder) hudBossShoulder.textContent = `(${bossShoulderPivot.x.toFixed(2)}, ${bossShoulderPivot.y.toFixed(2)}, ${bossShoulderPivot.z.toFixed(2)})`;
      if (hudBossWrist) hudBossWrist.textContent = `(${bossHandSocket.x.toFixed(2)}, ${bossHandSocket.y.toFixed(2)}, ${bossHandSocket.z.toFixed(2)})`;

      if (bossPoseStatus) {
        bossPoseStatus.style.color = '#06d6a0';
        bossPoseStatus.innerHTML = `✓ <b>Bắt khớp Boss thành công!</b> Vai: (${bossShoulderPivot.x.toFixed(2)}, ${bossShoulderPivot.y.toFixed(2)}), Chuôi Búa: (${bossHandSocket.x.toFixed(2)}, ${bossHandSocket.y.toFixed(2)}). Có thể kéo thả các điểm Marker để tinh chỉnh!`;
      }
    } catch (e) {
      if (bossPoseStatus) {
        bossPoseStatus.style.color = '#ef4444';
        bossPoseStatus.textContent = 'Lỗi phát hiện dáng Boss: ' + e.message;
      }
    } finally {
      btnBossAutoPose.disabled = false;
    }
  });

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
    syncBossUI();
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
    bossPoseRig.updateBone(bossShoulderPivot, bossHandSocket);
    if (hudBossShoulder) {
      hudBossShoulder.textContent = `(${bossShoulderPivot.x.toFixed(2)}, ${bossShoulderPivot.y.toFixed(2)}, ${bossShoulderPivot.z.toFixed(2)})`;
    }
    if (hudBossWrist) {
      hudBossWrist.textContent = `(${bossHandSocket.x.toFixed(2)}, ${bossHandSocket.y.toFixed(2)}, ${bossHandSocket.z.toFixed(2)})`;
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
        handSocket: bossHandSocket,
        normalizedPose: bossNormalizedPose,
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

  // 3D Painting & Interactive Skeleton Dragging on Boss Viewport
  let isPointerDownBoss = false;
  let activeDragMarkerBoss = null;
  const dragPlaneBoss = new THREE.Plane();
  const planeIntersectPtBoss = new THREE.Vector3();
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
    if (e.button === 0) { // Left click
      const rect = vpBoss.renderer.domElement.getBoundingClientRect();
      mouseBoss.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseBoss.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterBoss.setFromCamera(mouseBoss, vpBoss.camera);
      const markerHits = raycasterBoss.intersectObjects([bossPoseRig.shoulderMesh, bossPoseRig.wristMesh], true);

      if (markerHits.length > 0) {
        let hitObj = markerHits[0].object;
        while (hitObj && !hitObj.userData?.type && hitObj.parent) hitObj = hitObj.parent;
        if (hitObj?.userData?.type) {
          activeDragMarkerBoss = hitObj;
          vpBoss.controls.enabled = false;
          const camDir = vpBoss.camera.getWorldDirection(new THREE.Vector3());
          dragPlaneBoss.setFromNormalAndCoplanarPoint(camDir.negate(), activeDragMarkerBoss.position);
          return;
        }
      }

      isPointerDownBoss = true;
      paintOnBossCanvas(e);
    }
  });

  vpBoss.renderer.domElement.addEventListener('pointermove', (e) => {
    const rect = vpBoss.renderer.domElement.getBoundingClientRect();
    mouseBoss.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseBoss.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (activeDragMarkerBoss) {
      raycasterBoss.setFromCamera(mouseBoss, vpBoss.camera);
      if (raycasterBoss.ray.intersectPlane(dragPlaneBoss, planeIntersectPtBoss)) {
        const type = activeDragMarkerBoss.userData.type;
        if (type === 'shoulder') {
          bossShoulderPivot.x = Math.round(planeIntersectPtBoss.x * 100) / 100;
          bossShoulderPivot.y = Math.round(planeIntersectPtBoss.y * 100) / 100;
          bossShoulderPivot.z = Math.round(planeIntersectPtBoss.z * 100) / 100;
          bossGizmoObj.gizmo.position.set(bossShoulderPivot.x, bossShoulderPivot.y, bossShoulderPivot.z);
          if (hudBossShoulder) hudBossShoulder.textContent = `(${bossShoulderPivot.x.toFixed(2)}, ${bossShoulderPivot.y.toFixed(2)}, ${bossShoulderPivot.z.toFixed(2)})`;
        } else if (type === 'wrist') {
          bossHandSocket.x = Math.round(planeIntersectPtBoss.x * 100) / 100;
          bossHandSocket.y = Math.round(planeIntersectPtBoss.y * 100) / 100;
          bossHandSocket.z = Math.round(planeIntersectPtBoss.z * 100) / 100;
          bossWeaponOffset.offsetX = Math.round((bossHandSocket.x - bossShoulderPivot.x) * 100) / 100;
          bossWeaponOffset.offsetY = Math.round((bossHandSocket.y - bossShoulderPivot.y) * 100) / 100;
          bossWeaponOffset.offsetZ = Math.round((bossHandSocket.z - bossShoulderPivot.z) * 100) / 100;
          if (hudBossWrist) hudBossWrist.textContent = `(${bossHandSocket.x.toFixed(2)}, ${bossHandSocket.y.toFixed(2)}, ${bossHandSocket.z.toFixed(2)})`;
        }
        bossPoseRig.updateBone(bossShoulderPivot, bossHandSocket);
      }
      return;
    }

    if (isPointerDownBoss) {
      paintOnBossCanvas(e);
    }
  });

  window.addEventListener('pointerup', () => {
    isPointerDownBoss = false;
    if (activeDragMarkerBoss) {
      activeDragMarkerBoss = null;
      vpBoss.controls.enabled = true;
    }
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

    if (bCfg.handSocket) {
      bossHandSocket.x = bCfg.handSocket.x ?? (bossShoulderPivot.x + bossWeaponOffset.offsetX);
      bossHandSocket.y = bCfg.handSocket.y ?? (bossShoulderPivot.y + bossWeaponOffset.offsetY);
      bossHandSocket.z = bCfg.handSocket.z ?? (bossShoulderPivot.z + bossWeaponOffset.offsetZ);
    } else {
      bossHandSocket.x = bossShoulderPivot.x + bossWeaponOffset.offsetX;
      bossHandSocket.y = bossShoulderPivot.y + bossWeaponOffset.offsetY;
      bossHandSocket.z = bossShoulderPivot.z + bossWeaponOffset.offsetZ;
    }

    bossGizmoObj.gizmo.position.set(bossShoulderPivot.x, bossShoulderPivot.y, bossShoulderPivot.z);
    bossPoseRig.updateBone(bossShoulderPivot, bossHandSocket);
    if (hudBossShoulder) {
      hudBossShoulder.textContent = `(${bossShoulderPivot.x.toFixed(2)}, ${bossShoulderPivot.y.toFixed(2)}, ${bossShoulderPivot.z.toFixed(2)})`;
    }
    if (hudBossWrist) {
      hudBossWrist.textContent = `(${bossHandSocket.x.toFixed(2)}, ${bossHandSocket.y.toFixed(2)}, ${bossHandSocket.z.toFixed(2)})`;
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
