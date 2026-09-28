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

  if (!canvasPlayerEl) {
    console.warn('[brush-calibrator] Canvas player container not found in DOM');
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
    }
  }).catch(() => {});

  // Navigation Tab switching between 3D Rigging and 2D Skeleton Rigging
  const btnTabPlayer   = document.getElementById('btn-tab-player');
  const btnTabSkeleton = document.getElementById('btn-tab-skeleton');
  const panePlayer     = document.getElementById('pane-player');
  const paneSkeleton   = document.getElementById('pane-skeleton');

  btnTabPlayer?.addEventListener('click', () => {
    btnTabPlayer.classList.add('active');
    btnTabSkeleton?.classList.remove('active');
    panePlayer?.classList.remove('hidden');
    paneSkeleton?.classList.add('hidden');
    vpPlayer.onResize();
  });

  btnTabSkeleton?.addEventListener('click', () => {
    btnTabSkeleton.classList.add('active');
    btnTabPlayer?.classList.remove('active');
    paneSkeleton?.classList.remove('hidden');
    panePlayer?.classList.add('hidden');
    window.dispatchEvent(new CustomEvent('skeleton-tab-activated'));
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

  let playerSlashPoses = {
    pose1: { degX: 0, degY: 0, degZ: 60, rotX: 0, rotY: 0, rotZ: (60 * Math.PI) / 180 },
    pose2: { degX: 0, degY: 0, degZ: -75, rotX: 0, rotY: 0, rotZ: (-75 * Math.PI) / 180 },
    pose3: { degX: 0, degY: 0, degZ: 0, rotX: 0, rotY: 0, rotZ: 0 },
  };
  let currentPoseRot = { degX: 0, degY: 0, degZ: 0, rotX: 0, rotY: 0, rotZ: 0 };

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

  // 3-Pose Visual Slash Keyframe Recorder DOM elements
  const sliderPoseZ = document.getElementById('slider-player-pose-z');
  const sliderPoseX = document.getElementById('slider-player-pose-x');
  const sliderPoseY = document.getElementById('slider-player-pose-y');
  const valPoseZ    = document.getElementById('val-player-pose-z');
  const valPoseX    = document.getElementById('val-player-pose-x');
  const valPoseY    = document.getElementById('val-player-pose-y');

  const badgePose1  = document.getElementById('badge-player-pose1');
  const badgePose2  = document.getElementById('badge-player-pose2');
  const badgePose3  = document.getElementById('badge-player-pose3');

  const btnRecordPose1 = document.getElementById('btn-record-pose1');
  const btnViewPose1   = document.getElementById('btn-view-pose1');
  const btnRecordPose2 = document.getElementById('btn-record-pose2');
  const btnViewPose2   = document.getElementById('btn-view-pose2');
  const btnRecordPose3 = document.getElementById('btn-record-pose3');
  const btnViewPose3   = document.getElementById('btn-view-pose3');
  const btnTest3Pose   = document.getElementById('btn-player-test-3pose');

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
    const rx = (currentPoseRot.degX * Math.PI) / 180;
    const ry = (currentPoseRot.degY * Math.PI) / 180;
    const rz = (currentPoseRot.degZ * Math.PI) / 180;

    const localOffset = new THREE.Vector3(
      playerSwordOffset.offsetX,
      playerSwordOffset.offsetY,
      playerSwordOffset.offsetZ
    );
    localOffset.applyEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));

    const worldHandPos = new THREE.Vector3(
      playerShoulderPivot.x + localOffset.x,
      playerShoulderPivot.y + localOffset.y,
      playerShoulderPivot.z + localOffset.z
    );

    inContextSword.position.copy(worldHandPos);
    inContextSword.rotation.set(
      rx,
      Math.PI / 2 + ry,
      (playerSwordOffset.angle * Math.PI) / 180 + rz
    );

    playerHandSocket.x = Math.round(worldHandPos.x * 100) / 100;
    playerHandSocket.y = Math.round(worldHandPos.y * 100) / 100;
    playerHandSocket.z = Math.round(worldHandPos.z * 100) / 100;
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

  // ── 3-Pose Visual Slash Keyframe Recorder Logic ────────────────────────────
  function updatePoseBadges() {
    if (badgePose1) badgePose1.textContent = `Z: ${Math.round(playerSlashPoses.pose1.degZ ?? 60)}° X: ${Math.round(playerSlashPoses.pose1.degX ?? 0)}° (80ms)`;
    if (badgePose2) badgePose2.textContent = `Z: ${Math.round(playerSlashPoses.pose2.degZ ?? -75)}° X: ${Math.round(playerSlashPoses.pose2.degX ?? 0)}° (120ms)`;
    if (badgePose3) badgePose3.textContent = `Z: ${Math.round(playerSlashPoses.pose3.degZ ?? 0)}° X: ${Math.round(playerSlashPoses.pose3.degX ?? 0)}° (100ms)`;
  }

  function applyPoseSliderInputs() {
    currentPoseRot.degZ = parseFloat(sliderPoseZ?.value || 0);
    currentPoseRot.degX = parseFloat(sliderPoseX?.value || 0);
    currentPoseRot.degY = parseFloat(sliderPoseY?.value || 0);
    currentPoseRot.rotZ = (currentPoseRot.degZ * Math.PI) / 180;
    currentPoseRot.rotX = (currentPoseRot.degX * Math.PI) / 180;
    currentPoseRot.rotY = (currentPoseRot.degY * Math.PI) / 180;

    if (valPoseZ) valPoseZ.textContent = `${Math.round(currentPoseRot.degZ)}°`;
    if (valPoseX) valPoseX.textContent = `${Math.round(currentPoseRot.degX)}°`;
    if (valPoseY) valPoseY.textContent = `${Math.round(currentPoseRot.degY)}°`;

    updateInContextSwordTransform();
  }

  sliderPoseZ?.addEventListener('input', applyPoseSliderInputs);
  sliderPoseX?.addEventListener('input', applyPoseSliderInputs);
  sliderPoseY?.addEventListener('input', applyPoseSliderInputs);

  function recordPose(poseKey) {
    playerSlashPoses[poseKey] = {
      degX: currentPoseRot.degX,
      degY: currentPoseRot.degY,
      degZ: currentPoseRot.degZ,
      rotX: currentPoseRot.rotX,
      rotY: currentPoseRot.rotY,
      rotZ: currentPoseRot.rotZ,
    };
    updatePoseBadges();
    const poseName = poseKey === 'pose1' ? 'Pose 1 (Giương Kiếm)' : poseKey === 'pose2' ? 'Pose 2 (Chém Trúng)' : 'Pose 3 (Thu Kiếm)';
    if (toastPlayer) {
      toastPlayer.className = 'status-toast success';
      toastPlayer.innerHTML = `🔴 <b>Đã ghi nhận ${poseName}!</b> (Z: ${Math.round(currentPoseRot.degZ)}°, X: ${Math.round(currentPoseRot.degX)}°, Y: ${Math.round(currentPoseRot.degY)}°)`;
      toastPlayer.style.display = 'block';
      setTimeout(() => { toastPlayer.style.display = 'none'; }, 3000);
    }
  }

  btnRecordPose1?.addEventListener('click', () => recordPose('pose1'));
  btnRecordPose2?.addEventListener('click', () => recordPose('pose2'));
  btnRecordPose3?.addEventListener('click', () => recordPose('pose3'));

  function viewPose(poseKey) {
    const p = playerSlashPoses[poseKey] || {};
    const dz = p.degZ ?? (poseKey === 'pose1' ? 60 : poseKey === 'pose2' ? -75 : 0);
    const dx = p.degX ?? 0;
    const dy = p.degY ?? 0;

    if (sliderPoseZ) sliderPoseZ.value = dz;
    if (sliderPoseX) sliderPoseX.value = dx;
    if (sliderPoseY) sliderPoseY.value = dy;

    applyPoseSliderInputs();
  }

  btnViewPose1?.addEventListener('click', () => viewPose('pose1'));
  btnViewPose2?.addEventListener('click', () => viewPose('pose2'));
  btnViewPose3?.addEventListener('click', () => viewPose('pose3'));

  // Test 3-Pose Keyframe Tween Playback
  let isPlaying3PoseTween = false;
  btnTest3Pose?.addEventListener('click', () => {
    if (isPlaying3PoseTween) return;
    isPlaying3PoseTween = true;

    const p1 = playerSlashPoses.pose1 || { degZ: 60, degX: 0, degY: 0 };
    const p2 = playerSlashPoses.pose2 || { degZ: -75, degX: 0, degY: 0 };
    const p3 = playerSlashPoses.pose3 || { degZ: 0, degX: 0, degY: 0 };

    const startRot = { ...currentPoseRot };
    const startTime = performance.now();
    let hitTriggered = false;

    function step3Pose(now) {
      const elapsed = now - startTime;

      if (elapsed < 80) {
        // Phase 1: To Pose 1 in 80ms (Quadratic.Out)
        const t = Math.min(1, elapsed / 80);
        const ease = t * (2 - t);
        currentPoseRot.degX = THREE.MathUtils.lerp(startRot.degX, p1.degX, ease);
        currentPoseRot.degY = THREE.MathUtils.lerp(startRot.degY, p1.degY, ease);
        currentPoseRot.degZ = THREE.MathUtils.lerp(startRot.degZ, p1.degZ, ease);
        updateInContextSwordTransform();
        requestAnimationFrame(step3Pose);
      } else if (elapsed < 200) {
        // Phase 2: To Pose 2 in 120ms (Quadratic.In) -> triggers Hit Impact
        const t = Math.min(1, (elapsed - 80) / 120);
        const ease = t * t;
        currentPoseRot.degX = THREE.MathUtils.lerp(p1.degX, p2.degX, ease);
        currentPoseRot.degY = THREE.MathUtils.lerp(p1.degY, p2.degY, ease);
        currentPoseRot.degZ = THREE.MathUtils.lerp(p1.degZ, p2.degZ, ease);
        updateInContextSwordTransform();

        if (t >= 0.95 && !hitTriggered) {
          hitTriggered = true;
          if (toastPlayer) {
            toastPlayer.className = 'status-toast success';
            toastPlayer.innerHTML = '💥 <b>TRÚNG ĐÍCH (HIT IMPACT)!</b> Điểm va chạm tại Pose 2.';
            toastPlayer.style.display = 'block';
            setTimeout(() => { toastPlayer.style.display = 'none'; }, 2000);
          }
        }
        requestAnimationFrame(step3Pose);
      } else if (elapsed < 300) {
        // Phase 3: To Pose 3 in 100ms (Quadratic.Out)
        const t = Math.min(1, (elapsed - 200) / 100);
        const ease = t * (2 - t);
        currentPoseRot.degX = THREE.MathUtils.lerp(p2.degX, p3.degX, ease);
        currentPoseRot.degY = THREE.MathUtils.lerp(p2.degY, p3.degY, ease);
        currentPoseRot.degZ = THREE.MathUtils.lerp(p2.degZ, p3.degZ, ease);
        updateInContextSwordTransform();
        requestAnimationFrame(step3Pose);
      } else {
        // Return to Pose 3 exactly
        currentPoseRot.degX = p3.degX;
        currentPoseRot.degY = p3.degY;
        currentPoseRot.degZ = p3.degZ;
        if (sliderPoseZ) sliderPoseZ.value = p3.degZ;
        if (sliderPoseX) sliderPoseX.value = p3.degX;
        if (sliderPoseY) sliderPoseY.value = p3.degY;
        if (valPoseZ) valPoseZ.textContent = `${Math.round(p3.degZ)}°`;
        if (valPoseX) valPoseX.textContent = `${Math.round(p3.degX)}°`;
        if (valPoseY) valPoseY.textContent = `${Math.round(p3.degY)}°`;
        updateInContextSwordTransform();
        isPlaying3PoseTween = false;
      }
    }

    requestAnimationFrame(step3Pose);
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
          idleAngle: playerSlashPoses.pose3.degZ ?? 0,
          windupAngle: playerSlashPoses.pose1.degZ ?? 60,
          slashAngle: playerSlashPoses.pose2.degZ ?? -75,
          arc: Math.abs((playerSlashPoses.pose1.degZ ?? 60) - (playerSlashPoses.pose2.degZ ?? -75))
        },
        slashPoses: playerSlashPoses
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
        updateInContextSwordTransform();
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

    if (pCfg.slashPoses) {
      if (pCfg.slashPoses.pose1) playerSlashPoses.pose1 = { ...playerSlashPoses.pose1, ...pCfg.slashPoses.pose1 };
      if (pCfg.slashPoses.pose2) playerSlashPoses.pose2 = { ...playerSlashPoses.pose2, ...pCfg.slashPoses.pose2 };
      if (pCfg.slashPoses.pose3) playerSlashPoses.pose3 = { ...playerSlashPoses.pose3, ...pCfg.slashPoses.pose3 };
    }
    updatePoseBadges();

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
  // ANIMATION LOOP (PLAYER VIEWPORT)
  // ═════════════════════════════════════════════════════════════════════════════
  let animId = null;
  function animate() {
    animId = requestAnimationFrame(animate);

    vpPlayer.controls.update();

    // Subtle pulsing for gizmo rings
    const t = Date.now() * 0.003;
    playerGizmoObj.ringX.scale.setScalar(1 + Math.sin(t) * 0.12);
    playerGizmoObj.ringY.scale.setScalar(1 + Math.cos(t) * 0.12);

    vpPlayer.renderer.render(vpPlayer.scene, vpPlayer.camera);
  }
  animate();

  loadPlayerModel();

  return {
    destroy: () => {
      cancelAnimationFrame(animId);
      vpPlayer.resizeObs.disconnect();
      vpPlayer.renderer.dispose();
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

// ─────────────────────────────────────────────────────────────────────────────
// 2D SKELETAL RIGGING UI (Meta Animated Drawings style)
// ─────────────────────────────────────────────────────────────────────────────
export function initSkeletonCalibrator() {
  const canvas = document.getElementById('skeleton-canvas');
  const img = document.getElementById('skeleton-target-img');
  if (!canvas || !img) return null;

  const ctx = canvas.getContext('2d');

  let skeletonData = {
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

  const DEFAULT_SKELETON = JSON.parse(JSON.stringify(skeletonData));

  let activeDragNode = null;
  let hoveredNode = null;
  let isTestingSlash = false;
  let testAnimOffset = { r_shoulder: { x: 0, y: 0 }, r_elbow: { x: 0, y: 0 }, r_hand: { x: 0, y: 0 } };

  const hudSelected = document.getElementById('hud-skel-selected');
  const hudRHand    = document.getElementById('hud-skel-rhand');
  const nodeListEl  = document.getElementById('skel-node-list');
  const btnSave     = document.getElementById('btn-skel-save');
  const btnReset    = document.getElementById('btn-skel-reset-default');
  const btnTestSlash= document.getElementById('btn-skel-test-slash');
  const btnAutoPose = document.getElementById('btn-skel-auto-pose');
  const poseStatus  = document.getElementById('skel-pose-status');
  const toastEl     = document.getElementById('toast-skeleton');
  const fileInput   = document.getElementById('input-skel-upload');

  // Load saved skeleton from server
  fetch('/api/admin/skeleton')
    .then(r => r.json())
    .then(data => {
      if (data && data.nodes) {
        skeletonData.nodes = { ...skeletonData.nodes, ...data.nodes };
        if (data.links) skeletonData.links = data.links;
        syncUI();
        redraw();
      }
    })
    .catch(() => {});

  function resizeCanvasToImage() {
    const rect = img.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      canvas.width = Math.round(rect.width);
      canvas.height = Math.round(rect.height);
      redraw();
    }
  }

  img.addEventListener('load', resizeCanvasToImage);
  window.addEventListener('resize', resizeCanvasToImage);
  window.addEventListener('skeleton-tab-activated', () => {
    setTimeout(resizeCanvasToImage, 60);
  });
  if (img.complete) setTimeout(resizeCanvasToImage, 50);

  function getNodeColor(name) {
    if (name === 'r_hand') return '#ff4500';
    if (name.startsWith('r_')) return '#f97316';
    if (name.startsWith('l_')) return '#a855f7';
    if (name === 'head' || name === 'neck') return '#fbbf24';
    return '#00e5ff';
  }

  function redraw() {
    if (!canvas.width || !canvas.height) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // Draw link bones
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [from, to] of skeletonData.links) {
      const n1 = skeletonData.nodes[from];
      const n2 = skeletonData.nodes[to];
      if (!n1 || !n2) continue;

      let p1x = n1.x * w;
      let p1y = n1.y * h;
      let p2x = n2.x * w;
      let p2y = n2.y * h;

      if (isTestingSlash) {
        if (testAnimOffset[from]) { p1x += testAnimOffset[from].x * w; p1y += testAnimOffset[from].y * h; }
        if (testAnimOffset[to])   { p2x += testAnimOffset[to].x * w;   p2y += testAnimOffset[to].y * h; }
      }

      // Outer bone glow
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Inner bone line
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Draw nodes
    for (const [name, node] of Object.entries(skeletonData.nodes)) {
      let nx = node.x * w;
      let ny = node.y * h;

      if (isTestingSlash && testAnimOffset[name]) {
        nx += testAnimOffset[name].x * w;
        ny += testAnimOffset[name].y * h;
      }

      const isHovered = (name === hoveredNode);
      const isDragged = (name === activeDragNode);
      const isWeaponHand = (name === 'r_hand');
      const baseColor = getNodeColor(name);
      const r = isWeaponHand ? (isDragged ? 12 : 9) : (isDragged ? 10 : (isHovered ? 8 : 6.5));

      // Outer ring for active or weapon hand
      if (isWeaponHand || isHovered || isDragged) {
        ctx.beginPath();
        ctx.arc(nx, ny, r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = isWeaponHand ? '#ff8c00' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Main node circle
      ctx.beginPath();
      ctx.arc(nx, ny, r, 0, Math.PI * 2);
      ctx.fillStyle = baseColor;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Node label
      ctx.font = 'bold 9px sans-serif';
      const label = isWeaponHand ? '⚔️ r_hand (Kiếm)' : name;
      const textMetrics = ctx.measureText(label);
      const bgW = textMetrics.width + 6;
      const bgH = 13;
      const textX = nx + r + 5;
      const textY = ny - 2;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(textX - 2, textY - 9, bgW, bgH, 3);
      else ctx.rect(textX - 2, textY - 9, bgW, bgH);
      ctx.fill();

      ctx.fillStyle = isHovered || isDragged ? '#38bdf8' : '#e2e8f0';
      ctx.fillText(label, textX + 1, textY + 1);
    }
  }

  function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top)
    };
  }

  function findNodeUnder(x, y) {
    const w = canvas.width;
    const h = canvas.height;
    let closestName = null;
    let minDist = 18;

    for (const [name, node] of Object.entries(skeletonData.nodes)) {
      const nx = node.x * w;
      const ny = node.y * h;
      const d = Math.hypot(x - nx, y - ny);
      if (d < minDist) {
        minDist = d;
        closestName = name;
      }
    }
    return closestName;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const { x, y } = getCanvasCoords(e);
    const hit = findNodeUnder(x, y);
    if (hit) {
      activeDragNode = hit;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
      if (hudSelected) hudSelected.textContent = hit;
      redraw();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const { x, y } = getCanvasCoords(e);
    if (activeDragNode) {
      const normX = Math.max(0.01, Math.min(0.99, x / canvas.width));
      const normY = Math.max(0.01, Math.min(0.99, y / canvas.height));
      skeletonData.nodes[activeDragNode] = {
        x: Math.round(normX * 1000) / 1000,
        y: Math.round(normY * 1000) / 1000
      };
      if (activeDragNode === 'r_hand' && hudRHand) {
        hudRHand.textContent = `(${skeletonData.nodes.r_hand.x.toFixed(2)}, ${skeletonData.nodes.r_hand.y.toFixed(2)})`;
      }
      syncNodeItem(activeDragNode);
      redraw();
    } else {
      const hit = findNodeUnder(x, y);
      if (hit !== hoveredNode) {
        hoveredNode = hit;
        canvas.style.cursor = hit ? 'grab' : 'crosshair';
        redraw();
      }
    }
  });

  const onPointerUp = (e) => {
    if (activeDragNode) {
      try { canvas.releasePointerCapture(e.pointerId); } catch(err) {}
      activeDragNode = null;
      canvas.style.cursor = hoveredNode ? 'grab' : 'crosshair';
      redraw();
    }
  };
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  function syncUI() {
    if (!nodeListEl) return;
    nodeListEl.innerHTML = '';
    for (const [name, node] of Object.entries(skeletonData.nodes)) {
      const item = document.createElement('div');
      item.id = `skel-node-item-${name}`;
      item.style.cssText = 'background:#1e293b; padding:4px 6px; border-radius:4px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; border:1px solid #334155;';
      item.innerHTML = `
        <span style="font-weight:700; color:${getNodeColor(name)};">${name}</span>
        <span style="font-family:monospace; color:#94a3b8;">(${node.x.toFixed(2)}, ${node.y.toFixed(2)})</span>
      `;
      item.addEventListener('mouseenter', () => { hoveredNode = name; redraw(); });
      item.addEventListener('mouseleave', () => { hoveredNode = null; redraw(); });
      item.addEventListener('click', () => {
        hoveredNode = name;
        if (hudSelected) hudSelected.textContent = name;
        redraw();
      });
      nodeListEl.appendChild(item);
    }
    if (hudRHand && skeletonData.nodes.r_hand) {
      hudRHand.textContent = `(${skeletonData.nodes.r_hand.x.toFixed(2)}, ${skeletonData.nodes.r_hand.y.toFixed(2)})`;
    }
  }

  function syncNodeItem(name) {
    const item = document.getElementById(`skel-node-item-${name}`);
    if (item && skeletonData.nodes[name]) {
      const n = skeletonData.nodes[name];
      item.querySelector('span:last-child').textContent = `(${n.x.toFixed(2)}, ${n.y.toFixed(2)})`;
    }
  }

  // Preset Buttons
  const presets = {
    fire: '/assets/characters/fireblade(cho%20game)_0.jpg',
    thunder: '/assets/characters/thunder_body.png',
    frost: '/assets/characters/frost_body.png'
  };

  ['fire', 'thunder', 'frost'].forEach(el => {
    const btn = document.getElementById(`btn-skel-preset-${el}`);
    btn?.addEventListener('click', () => {
      ['fire', 'thunder', 'frost'].forEach(k => document.getElementById(`btn-skel-preset-${k}`)?.classList.remove('active'));
      btn.classList.add('active');
      img.src = presets[el];
    });
  });

  // Custom Image Upload
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        img.src = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  // Reset to default
  btnReset?.addEventListener('click', () => {
    skeletonData.nodes = JSON.parse(JSON.stringify(DEFAULT_SKELETON.nodes));
    syncUI();
    redraw();
  });

  // Test Slash Animation in 2D
  btnTestSlash?.addEventListener('click', () => {
    if (isTestingSlash) return;
    isTestingSlash = true;

    let startTime = performance.now();
    const duration = 650;

    function animateSlash(now) {
      const elapsed = now - startTime;
      const prog = Math.min(1.0, elapsed / duration);

      if (prog < 0.3) {
        // Wind-up: shoulder back, elbow bent
        const t = prog / 0.3;
        testAnimOffset.r_shoulder = { x: -0.04 * t, y: -0.05 * t };
        testAnimOffset.r_elbow    = { x: -0.08 * t, y: -0.09 * t };
        testAnimOffset.r_hand     = { x: -0.14 * t, y: -0.15 * t };
      } else if (prog < 0.6) {
        // Strike: forward slash motion
        const t = (prog - 0.3) / 0.3;
        testAnimOffset.r_shoulder = { x: -0.04 + 0.10 * t, y: -0.05 + 0.08 * t };
        testAnimOffset.r_elbow    = { x: -0.08 + 0.18 * t, y: -0.09 + 0.14 * t };
        testAnimOffset.r_hand     = { x: -0.14 + 0.28 * t, y: -0.15 + 0.22 * t };
      } else {
        // Recover to rest position
        const t = (prog - 0.6) / 0.4;
        testAnimOffset.r_shoulder = { x: 0.06 * (1 - t), y: 0.03 * (1 - t) };
        testAnimOffset.r_elbow    = { x: 0.10 * (1 - t), y: 0.05 * (1 - t) };
        testAnimOffset.r_hand     = { x: 0.14 * (1 - t), y: 0.07 * (1 - t) };
      }

      redraw();

      if (prog < 1.0) {
        requestAnimationFrame(animateSlash);
      } else {
        isTestingSlash = false;
        testAnimOffset.r_shoulder = { x: 0, y: 0 };
        testAnimOffset.r_elbow    = { x: 0, y: 0 };
        testAnimOffset.r_hand     = { x: 0, y: 0 };
        redraw();
      }
    }
    requestAnimationFrame(animateSlash);
  });

  // Auto-Detect with MediaPipe Pose
  btnAutoPose?.addEventListener('click', async () => {
    if (poseStatus) {
      poseStatus.style.display = 'block';
      poseStatus.textContent = '⏳ Đang quét MediaPipe Pose từ ảnh nhân vật...';
    }
    btnAutoPose.disabled = true;

    try {
      if (typeof window !== 'undefined' && window.Pose) {
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

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.naturalWidth || img.width || 512;
        tempCanvas.height = img.naturalHeight || img.height || 512;
        const tCtx = tempCanvas.getContext('2d');
        tCtx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);

        let detectedLandmarks = null;
        await new Promise((resolve) => {
          const onResults = (results) => {
            if (results.poseLandmarks) detectedLandmarks = results.poseLandmarks;
            resolve();
          };
          pose.onResults(onResults);
          pose.send({ image: tempCanvas }).catch(resolve);
          setTimeout(resolve, 3500);
        });

        if (detectedLandmarks && detectedLandmarks.length >= 29) {
          const lm = detectedLandmarks;
          const clamp = (v) => Math.max(0.02, Math.min(0.98, Math.round(v * 1000) / 1000));

          skeletonData.nodes.head = { x: clamp(lm[0].x), y: clamp(lm[0].y) };
          skeletonData.nodes.neck = { x: clamp((lm[11].x + lm[12].x) / 2), y: clamp((lm[11].y + lm[12].y) / 2 - 0.03) };
          skeletonData.nodes.torso = { x: clamp((lm[11].x + lm[12].x + lm[23].x + lm[24].x) / 4), y: clamp((lm[11].y + lm[12].y + lm[23].y + lm[24].y) / 4) };
          skeletonData.nodes.hip = { x: clamp((lm[23].x + lm[24].x) / 2), y: clamp((lm[23].y + lm[24].y) / 2) };

          skeletonData.nodes.l_shoulder = { x: clamp(lm[11].x), y: clamp(lm[11].y) };
          skeletonData.nodes.l_elbow    = { x: clamp(lm[13].x), y: clamp(lm[13].y) };
          skeletonData.nodes.l_hand     = { x: clamp(lm[15].x), y: clamp(lm[15].y) };

          skeletonData.nodes.r_shoulder = { x: clamp(lm[12].x), y: clamp(lm[12].y) };
          skeletonData.nodes.r_elbow    = { x: clamp(lm[14].x), y: clamp(lm[14].y) };
          skeletonData.nodes.r_hand     = { x: clamp(lm[16].x), y: clamp(lm[16].y) };

          skeletonData.nodes.l_knee     = { x: clamp(lm[25].x), y: clamp(lm[25].y) };
          skeletonData.nodes.l_foot     = { x: clamp(lm[27].x), y: clamp(lm[27].y) };

          skeletonData.nodes.r_knee     = { x: clamp(lm[26].x), y: clamp(lm[26].y) };
          skeletonData.nodes.r_foot     = { x: clamp(lm[28].x), y: clamp(lm[28].y) };

          if (poseStatus) {
            poseStatus.style.color = '#06d6a0';
            poseStatus.textContent = '✓ Nhận diện 14 khớp xương thành công! Kéo các điểm để tinh chỉnh.';
          }
          syncUI();
          redraw();
        } else {
          throw new Error('Không nhận diện đủ các khớp trên ảnh');
        }
      } else {
        throw new Error('MediaPipe thư viện chưa sẵn sàng');
      }
    } catch (e) {
      if (poseStatus) {
        poseStatus.style.color = '#ef4444';
        poseStatus.textContent = 'Lỗi phát hiện dáng: ' + e.message;
      }
    } finally {
      btnAutoPose.disabled = false;
    }
  });

  // Save Rigging
  btnSave?.addEventListener('click', async () => {
    btnSave.disabled = true;
    toastEl.className = 'status-toast';
    toastEl.style.display = 'block';
    toastEl.textContent = '⏳ Đang lưu khung xương...';

    try {
      const res = await fetch('/api/admin/skeleton', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skeletonData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi server');

      toastEl.className = 'status-toast success';
      toastEl.textContent = '✓ Đã lưu khung xương 2D vào data/skeleton.json!';
      setTimeout(() => { toastEl.style.display = 'none'; }, 4000);
    } catch (e) {
      toastEl.className = 'status-toast error';
      toastEl.textContent = '❌ Lỗi: ' + e.message;
    } finally {
      btnSave.disabled = false;
    }
  });

  syncUI();
  return {
    redraw,
    resize: resizeCanvasToImage
  };
}
