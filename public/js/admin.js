// Admin API client helper for 3D GLB/GLTF models, Character Art and 3D Compound Rigging

export async function upload3DModel(element, type, file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('element', element);
  fd.append('type', type); // 'character' or 'weapon'

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

// ─────────────────────────────────────────────────────────────────────────────
// 3D Visual Socket & Compound Rigging Calibrator Engine
// ─────────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

export const DEFAULT_SOCKETS_CONFIG = {
  player: {
    shoulderX: -0.65,
    shoulderY: 1.2,
    shoulderZ: 0.0,
    weapon: {
      offsetX: 0.0,
      offsetY: -0.4,
      offsetZ: 0.1,
      rotX: 0.0,
      rotY: 1.5708,
      rotZ: -0.7854,
      angle: -45
    },
    default: { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    thunder: { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    fire:    { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    frost:   { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 }
  },
  boss: {
    shoulderX: -1.8,
    shoulderY: 2.2,
    shoulderZ: 0.2,
    weapon: {
      offsetX: 0.0,
      offsetY: -0.6,
      offsetZ: 0.5,
      rotX: 0.0,
      rotY: -1.5708,
      rotZ: 0.5236,
      angle: 30
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

/**
 * Initializes the Visual Socket Calibrator on container elements
 */
export function initVisualSocketCalibrator(opts = {}) {
  const {
    containerEl,
    selectTargetEl,
    btnTabStep1, btnTabStep2, paneStep1, paneStep2,
    sliderShoulderX, numShoulderX, valShoulderX,
    sliderShoulderY, numShoulderY, valShoulderY,
    sliderShoulderZ, numShoulderZ, valShoulderZ,
    btnGotoStep2, btnGotoStep1,
    sliderOffsetX, numOffsetX, valOffsetX,
    sliderOffsetY, numOffsetY, valOffsetY,
    sliderOffsetZ, numOffsetZ, valOffsetZ,
    sliderTiltAngle, numTiltAngle, valTiltAngle,
    btnTestSwing,
    // Legacy fallback bindings
    sliderX, numX, valX,
    sliderY, numY, valY,
    sliderZ, numZ, valZ,
    groupAngle, sliderAngle, numAngle, valAngle,
    btnSave, btnReset, statusToast
  } = opts;

  if (!containerEl) return null;

  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a13);

  const width = containerEl.clientWidth || 600;
  const height = containerEl.clientHeight || 480;

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(2.5, 2.5, 4.0);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  containerEl.replaceChildren(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.target.set(0, 1.2, 0);

  // Lighting
  const ambLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
  dirLight.position.set(5, 10, 7);
  scene.add(dirLight);

  const backLight = new THREE.DirectionalLight(0x00b4d8, 1.0);
  backLight.position.set(-5, 5, -5);
  scene.add(backLight);

  // Grid
  const grid = new THREE.GridHelper(8, 16, 0x00b4d8, 0x1e293b);
  grid.position.y = 0;
  scene.add(grid);

  // Compound Arm-Weapon Container (combatArmCompound)
  const combatArmCompound = new THREE.Group();
  combatArmCompound.name = 'AdminCombatArmCompound';
  scene.add(combatArmCompound);

  // Step 1: Shoulder Pivot Gizmo
  const shoulderGizmo = new THREE.Group();
  shoulderGizmo.name = 'ShoulderGizmo';
  const sCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.10, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ff88 })
  );
  const sRingX = new THREE.Mesh(
    new THREE.RingGeometry(0.14, 0.18, 24),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  sRingX.rotation.x = Math.PI / 2;
  const sRingY = new THREE.Mesh(
    new THREE.RingGeometry(0.14, 0.18, 24),
    new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  sRingY.rotation.y = Math.PI / 2;
  shoulderGizmo.add(sCore, sRingX, sRingY);
  combatArmCompound.add(shoulderGizmo);

  // Step 2: Weapon Mounted Child Container
  const weaponContainer = new THREE.Group();
  weaponContainer.name = 'AdminWeaponContainer';
  combatArmCompound.add(weaponContainer);

  // Model Holder
  const modelHolder = new THREE.Group();
  modelHolder.name = 'ModelHolder';
  scene.add(modelHolder);

  let currentTargetKey = selectTargetEl ? selectTargetEl.value : 'player';
  let activeStep = 1; // 1: Shoulder Pivot, 2: Weapon Attach & Offset
  let socketsData = JSON.parse(JSON.stringify(DEFAULT_SOCKETS_CONFIG));

  // Fetch persisted sockets from server
  fetchSockets().then(cfg => {
    if (cfg && typeof cfg === 'object') {
      socketsData = {
        player: { ...DEFAULT_SOCKETS_CONFIG.player, ...(cfg.player || {}) },
        boss:   { ...DEFAULT_SOCKETS_CONFIG.boss,   ...(cfg.boss || {}) },
        weapon: { ...DEFAULT_SOCKETS_CONFIG.weapon, ...(cfg.weapon || {}) },
      };
      updateControlsFromConfig();
    }
  }).catch(() => {});

  function getActiveCategory() {
    return currentTargetKey.startsWith('boss') ? 'boss' : 'player';
  }

  function getCategoryConfig(cat) {
    if (!socketsData[cat]) socketsData[cat] = {};
    if (socketsData[cat].shoulderX === undefined) {
      const def = DEFAULT_SOCKETS_CONFIG[cat] || {};
      socketsData[cat].shoulderX = def.shoulderX ?? (cat === 'player' ? -0.65 : -1.8);
      socketsData[cat].shoulderY = def.shoulderY ?? (cat === 'player' ? 1.2 : 2.2);
      socketsData[cat].shoulderZ = def.shoulderZ ?? (cat === 'player' ? 0.0 : 0.2);
    }
    if (!socketsData[cat].weapon) {
      socketsData[cat].weapon = {
        offsetX: 0.0,
        offsetY: cat === 'player' ? -0.4 : -0.6,
        offsetZ: cat === 'player' ? 0.1 : 0.5,
        rotX: 0.0,
        rotY: cat === 'player' ? 1.5708 : -1.5708,
        rotZ: cat === 'player' ? -0.7854 : 0.5236,
        angle: cat === 'player' ? -45 : 30
      };
    }
    return socketsData[cat];
  }

  function updateControlsFromConfig() {
    const cat = getActiveCategory();
    const cfg = getCategoryConfig(cat);
    const w = cfg.weapon || {};

    const sx = cfg.shoulderX ?? (cat === 'player' ? -0.65 : -1.8);
    const sy = cfg.shoulderY ?? (cat === 'player' ? 1.2 : 2.2);
    const sz = cfg.shoulderZ ?? (cat === 'player' ? 0.0 : 0.2);

    const ox = w.offsetX ?? 0.0;
    const oy = w.offsetY ?? (cat === 'player' ? -0.4 : -0.6);
    const oz = w.offsetZ ?? (cat === 'player' ? 0.1 : 0.5);
    const angle = w.angle ?? (cat === 'player' ? -45 : 30);

    // Step 1 controls
    const sX = sliderShoulderX || sliderX;
    const nX = numShoulderX || numX;
    const vX = valShoulderX || valX;
    if (sX) sX.value = sx;
    if (nX) nX.value = Number(sx).toFixed(2);
    if (vX) vX.textContent = Number(sx).toFixed(2);

    const sY = sliderShoulderY || sliderY;
    const nY = numShoulderY || numY;
    const vY = valShoulderY || valY;
    if (sY) sY.value = sy;
    if (nY) nY.value = Number(sy).toFixed(2);
    if (vY) vY.textContent = Number(sy).toFixed(2);

    const sZ = sliderShoulderZ || sliderZ;
    const nZ = numShoulderZ || numZ;
    const vZ = valShoulderZ || valZ;
    if (sZ) sZ.value = sz;
    if (nZ) nZ.value = Number(sz).toFixed(2);
    if (vZ) vZ.textContent = Number(sz).toFixed(2);

    // Step 2 controls
    if (sliderOffsetX) sliderOffsetX.value = ox;
    if (numOffsetX) numOffsetX.value = Number(ox).toFixed(2);
    if (valOffsetX) valOffsetX.textContent = Number(ox).toFixed(2);

    if (sliderOffsetY) sliderOffsetY.value = oy;
    if (numOffsetY) numOffsetY.value = Number(oy).toFixed(2);
    if (valOffsetY) valOffsetY.textContent = Number(oy).toFixed(2);

    if (sliderOffsetZ) sliderOffsetZ.value = oz;
    if (numOffsetZ) numOffsetZ.value = Number(oz).toFixed(2);
    if (valOffsetZ) valOffsetZ.textContent = Number(oz).toFixed(2);

    const sA = sliderTiltAngle || sliderAngle;
    const nA = numTiltAngle || numAngle;
    const vA = valTiltAngle || valAngle;
    if (sA) sA.value = angle;
    if (nA) nA.value = Math.round(angle);
    if (vA) vA.textContent = `${Math.round(angle)}°`;

    updateCompoundTransforms();
  }

  function updateCompoundTransforms() {
    const cat = getActiveCategory();
    const cfg = getCategoryConfig(cat);
    const w = cfg.weapon || {};

    const sx = cfg.shoulderX ?? (cat === 'player' ? -0.65 : -1.8);
    const sy = cfg.shoulderY ?? (cat === 'player' ? 1.2 : 2.2);
    const sz = cfg.shoulderZ ?? (cat === 'player' ? 0.0 : 0.2);

    combatArmCompound.position.set(sx, sy, sz);

    const ox = w.offsetX ?? 0.0;
    const oy = w.offsetY ?? (cat === 'player' ? -0.4 : -0.6);
    const oz = w.offsetZ ?? (cat === 'player' ? 0.1 : 0.5);
    const angle = w.angle ?? (cat === 'player' ? -45 : 30);

    weaponContainer.position.set(ox, oy, oz);
    if (cat === 'player') {
      weaponContainer.rotation.set(0, Math.PI / 2, (angle * Math.PI) / 180);
    } else {
      weaponContainer.rotation.set(0, -Math.PI / 2, (angle * Math.PI) / 180);
    }

    // Step visibility
    if (activeStep === 1) {
      shoulderGizmo.visible = true;
      weaponContainer.visible = true;
    } else {
      shoulderGizmo.visible = false;
      weaponContainer.visible = true;
    }
  }

  function loadPreviewWeapon(cat) {
    while (weaponContainer.children.length) {
      weaponContainer.remove(weaponContainer.children[0]);
    }
    if (cat === 'player') {
      // Sleek Sword
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.8, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x0066aa, transparent: true, opacity: 0.9 })
      );
      blade.position.set(0, 0.9, 0);
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.06, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.8 })
      );
      guard.position.set(0, 0, 0);
      const grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.35, 0.07),
        new THREE.MeshStandardMaterial({ color: 0x333333 })
      );
      grip.position.set(0, -0.18, 0);
      weaponContainer.add(blade, guard, grip);
      weaponContainer.scale.set(1.4, 1.4, 1.4);
    } else {
      // Warhammer
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 3.2, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
      );
      handle.position.set(0, 0, 0);
      const hHead = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.4, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x882200, transparent: true, opacity: 0.9 })
      );
      hHead.position.set(0, 1.4, 0);
      weaponContainer.add(handle, hHead);
      weaponContainer.scale.set(0.9, 0.9, 0.9);
    }
  }

  function buildFallbackCharacter(cat) {
    const grp = new THREE.Group();
    if (cat === 'player') {
      const mat = new THREE.MeshStandardMaterial({ color: 0x2255cc, roughness: 0.5 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c4a0 });

      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.5), mat);
      torso.position.y = 1.3;
      grp.add(torso);

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat);
      head.position.y = 2.3;
      grp.add(head);

      // Left Arm (Outer weapon arm)
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), skinMat);
      armL.position.set(-0.65, 1.2, 0);
      grp.add(armL);

      // Right Arm
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), skinMat);
      armR.position.set(0.65, 1.2, 0);
      grp.add(armR);
    } else {
      // Boss
      const mat = new THREE.MeshStandardMaterial({ color: 0x882200, roughness: 0.5 });
      const accMat = new THREE.MeshStandardMaterial({ color: 0xff6600 });

      const torso = new THREE.Mesh(new THREE.BoxGeometry(2.0, 2.4, 1.2), mat);
      torso.position.y = 2.2;
      grp.add(torso);

      const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), mat);
      head.position.y = 4.2;
      grp.add(head);

      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), mat);
      armL.position.set(-1.8, 2.2, 0);
      grp.add(armL);

      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), mat);
      armR.position.set(1.8, 2.2, 0);
      grp.add(armR);
    }
    return grp;
  }

  async function loadTargetModel() {
    while (modelHolder.children.length) {
      modelHolder.remove(modelHolder.children[0]);
    }
    const cat = getActiveCategory();
    loadPreviewWeapon(cat);

    let modelUrl = (cat === 'player') ? '/assets/models/default_character.glb' : '/assets/models/boss_fire.glb';

    let loaded = false;
    try {
      const gltf = await new Promise(resolve => gltfLoader.load(modelUrl, resolve, undefined, () => resolve(null)));
      if (gltf && gltf.scene) {
        const model = gltf.scene;
        model.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
        const bBox = new THREE.Box3().setFromObject(model);
        const bSize = new THREE.Vector3();
        bBox.getSize(bSize);
        if (bSize.y > 0.01) {
          const targetH = (cat === 'boss') ? 4.0 : 2.8;
          model.scale.setScalar(targetH / bSize.y);
        }
        const sBox = new THREE.Box3().setFromObject(model);
        model.position.x = - (sBox.min.x + sBox.max.x) / 2;
        model.position.z = - (sBox.min.z + sBox.max.z) / 2;
        model.position.y = - sBox.min.y;
        modelHolder.add(model);
        loaded = true;
      }
    } catch (e) {}

    if (!loaded) {
      modelHolder.add(buildFallbackCharacter(cat));
    }

    updateControlsFromConfig();
  }

  // Switch between Step 1 and Step 2
  function setStep(stepNum) {
    activeStep = stepNum;
    if (btnTabStep1) btnTabStep1.classList.toggle('active', stepNum === 1);
    if (btnTabStep2) btnTabStep2.classList.toggle('active', stepNum === 2);
    if (paneStep1) paneStep1.classList.toggle('hidden', stepNum !== 1);
    if (paneStep2) paneStep2.classList.toggle('hidden', stepNum !== 2);
    updateCompoundTransforms();
  }

  btnTabStep1?.addEventListener('click', () => setStep(1));
  btnTabStep2?.addEventListener('click', () => setStep(2));
  btnGotoStep2?.addEventListener('click', () => setStep(2));
  btnGotoStep1?.addEventListener('click', () => setStep(1));

  // Raycaster to pick Shoulder Anchor on click (Step 1)
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let pointerDownTime = 0;
  let pointerDownPos = { x: 0, y: 0 };

  renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerDownTime = performance.now();
    pointerDownPos = { x: e.clientX, y: e.clientY };
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    const elapsed = performance.now() - pointerDownTime;
    const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);

    if (elapsed < 300 && dist < 5) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(modelHolder.children, true);

      if (hits.length > 0) {
        const pt = hits[0].point;
        const cat = getActiveCategory();
        const cfg = getCategoryConfig(cat);

        cfg.shoulderX = Math.round(pt.x * 100) / 100;
        cfg.shoulderY = Math.round(pt.y * 100) / 100;
        cfg.shoulderZ = Math.round(pt.z * 100) / 100;

        // Legacy compatibility
        cfg.handX = -cfg.shoulderX;
        cfg.handY = cfg.shoulderY;
        cfg.handZ = cfg.shoulderZ;

        updateControlsFromConfig();
      }
    }
  });

  // Slider change listeners
  function onStep1SliderChange() {
    const cat = getActiveCategory();
    const cfg = getCategoryConfig(cat);

    const sX = sliderShoulderX || sliderX;
    const sY = sliderShoulderY || sliderY;
    const sZ = sliderShoulderZ || sliderZ;

    const x = parseFloat(sX?.value || 0);
    const y = parseFloat(sY?.value || 0);
    const z = parseFloat(sZ?.value || 0);

    cfg.shoulderX = x;
    cfg.shoulderY = y;
    cfg.shoulderZ = z;

    // Legacy sync
    cfg.handX = -x;
    cfg.handY = y;
    cfg.handZ = z;

    const nX = numShoulderX || numX;
    const vX = valShoulderX || valX;
    if (nX) nX.value = x.toFixed(2);
    if (vX) vX.textContent = x.toFixed(2);

    const nY = numShoulderY || numY;
    const vY = valShoulderY || valY;
    if (nY) nY.value = y.toFixed(2);
    if (vY) vY.textContent = y.toFixed(2);

    const nZ = numShoulderZ || numZ;
    const vZ = valShoulderZ || valZ;
    if (nZ) nZ.value = z.toFixed(2);
    if (vZ) vZ.textContent = z.toFixed(2);

    updateCompoundTransforms();
  }

  function onStep2SliderChange() {
    const cat = getActiveCategory();
    const cfg = getCategoryConfig(cat);
    const w = cfg.weapon || {};

    const ox = parseFloat(sliderOffsetX?.value || 0);
    const oy = parseFloat(sliderOffsetY?.value || 0);
    const oz = parseFloat(sliderOffsetZ?.value || 0);
    const angle = parseFloat((sliderTiltAngle || sliderAngle)?.value || (cat === 'player' ? -45 : 30));

    w.offsetX = ox;
    w.offsetY = oy;
    w.offsetZ = oz;
    w.angle = angle;
    w.rotZ = (angle * Math.PI) / 180;
    cfg.weaponAngle = angle;

    if (numOffsetX) numOffsetX.value = ox.toFixed(2);
    if (valOffsetX) valOffsetX.textContent = ox.toFixed(2);
    if (numOffsetY) numOffsetY.value = oy.toFixed(2);
    if (valOffsetY) valOffsetY.textContent = oy.toFixed(2);
    if (numOffsetZ) numOffsetZ.value = oz.toFixed(2);
    if (valOffsetZ) valOffsetZ.textContent = oz.toFixed(2);

    const nA = numTiltAngle || numAngle;
    const vA = valTiltAngle || valAngle;
    if (nA) nA.value = Math.round(angle);
    if (vA) vA.textContent = `${Math.round(angle)}°`;

    updateCompoundTransforms();
  }

  (sliderShoulderX || sliderX)?.addEventListener('input', onStep1SliderChange);
  (sliderShoulderY || sliderY)?.addEventListener('input', onStep1SliderChange);
  (sliderShoulderZ || sliderZ)?.addEventListener('input', onStep1SliderChange);

  (numShoulderX || numX)?.addEventListener('change', () => {
    if (sliderShoulderX || sliderX) (sliderShoulderX || sliderX).value = (numShoulderX || numX).value;
    onStep1SliderChange();
  });
  (numShoulderY || numY)?.addEventListener('change', () => {
    if (sliderShoulderY || sliderY) (sliderShoulderY || sliderY).value = (numShoulderY || numY).value;
    onStep1SliderChange();
  });
  (numShoulderZ || numZ)?.addEventListener('change', () => {
    if (sliderShoulderZ || sliderZ) (sliderShoulderZ || sliderZ).value = (numShoulderZ || numZ).value;
    onStep1SliderChange();
  });

  sliderOffsetX?.addEventListener('input', onStep2SliderChange);
  sliderOffsetY?.addEventListener('input', onStep2SliderChange);
  sliderOffsetZ?.addEventListener('input', onStep2SliderChange);
  (sliderTiltAngle || sliderAngle)?.addEventListener('input', onStep2SliderChange);

  numOffsetX?.addEventListener('change', () => { if (sliderOffsetX) sliderOffsetX.value = numOffsetX.value; onStep2SliderChange(); });
  numOffsetY?.addEventListener('change', () => { if (sliderOffsetY) sliderOffsetY.value = numOffsetY.value; onStep2SliderChange(); });
  numOffsetZ?.addEventListener('change', () => { if (sliderOffsetZ) sliderOffsetZ.value = numOffsetZ.value; onStep2SliderChange(); });
  (numTiltAngle || numAngle)?.addEventListener('change', () => {
    if (sliderTiltAngle || sliderAngle) (sliderTiltAngle || sliderAngle).value = (numTiltAngle || numAngle).value;
    onStep2SliderChange();
  });

  selectTargetEl?.addEventListener('change', () => {
    currentTargetKey = selectTargetEl.value;
    loadTargetModel();
  });

  // Test single-rotation slash / slam motion
  let isTestingSwing = false;
  function playTestSwing() {
    if (isTestingSwing) return;
    isTestingSwing = true;
    const cat = getActiveCategory();

    if (cat === 'player') {
      const startRotZ = 0;
      const windupRotZ = (60 * Math.PI) / 180;
      const strikeRotZ = (-75 * Math.PI) / 180;
      const startTime = performance.now();

      function stepSwing(now) {
        const elapsed = now - startTime;
        if (elapsed < 100) {
          const t = elapsed / 100;
          combatArmCompound.rotation.z = THREE.MathUtils.lerp(startRotZ, windupRotZ, t * t);
          requestAnimationFrame(stepSwing);
        } else if (elapsed < 220) {
          const t = (elapsed - 100) / 120;
          combatArmCompound.rotation.z = THREE.MathUtils.lerp(windupRotZ, strikeRotZ, t * t);
          requestAnimationFrame(stepSwing);
        } else if (elapsed < 320) {
          const t = (elapsed - 220) / 100;
          combatArmCompound.rotation.z = THREE.MathUtils.lerp(strikeRotZ, startRotZ, 1 - (1 - t) * (1 - t));
          requestAnimationFrame(stepSwing);
        } else {
          combatArmCompound.rotation.z = startRotZ;
          isTestingSwing = false;
        }
      }
      requestAnimationFrame(stepSwing);
    } else {
      const startRotZ = 0;
      const raiseRotZ = (80 * Math.PI) / 180;
      const slamRotZ = (-80 * Math.PI) / 180;
      const startTime = performance.now();

      function stepSlam(now) {
        const elapsed = now - startTime;
        if (elapsed < 160) {
          const t = elapsed / 160;
          combatArmCompound.rotation.z = THREE.MathUtils.lerp(startRotZ, raiseRotZ, t * t);
          requestAnimationFrame(stepSlam);
        } else if (elapsed < 290) {
          const t = (elapsed - 160) / 130;
          combatArmCompound.rotation.z = THREE.MathUtils.lerp(raiseRotZ, slamRotZ, t * t);
          requestAnimationFrame(stepSlam);
        } else if (elapsed < 440) {
          const t = (elapsed - 290) / 150;
          combatArmCompound.rotation.z = THREE.MathUtils.lerp(slamRotZ, startRotZ, 1 - (1 - t) * (1 - t));
          requestAnimationFrame(stepSlam);
        } else {
          combatArmCompound.rotation.z = startRotZ;
          isTestingSwing = false;
        }
      }
      requestAnimationFrame(stepSlam);
    }
  }

  btnTestSwing?.addEventListener('click', playTestSwing);

  // Reset to default
  btnReset?.addEventListener('click', () => {
    const cat = getActiveCategory();
    if (DEFAULT_SOCKETS_CONFIG[cat]) {
      socketsData[cat] = JSON.parse(JSON.stringify(DEFAULT_SOCKETS_CONFIG[cat]));
      updateControlsFromConfig();
      if (statusToast) {
        statusToast.className = 'status-toast success';
        statusToast.textContent = `✓ Đã hoàn tác về giá trị chuẩn của ${cat === 'player' ? 'Nhân vật' : 'Boss'}`;
        statusToast.style.display = 'block';
        setTimeout(() => { statusToast.style.display = 'none'; }, 3000);
      }
    }
  });

  // Save compound transform offsets to server
  btnSave?.addEventListener('click', async () => {
    try {
      btnSave.disabled = true;
      btnSave.textContent = '⏳ Đang lưu...';

      // Ensure full sync across sets
      const pCfg = getCategoryConfig('player');
      const bCfg = getCategoryConfig('boss');

      ['default', 'thunder', 'fire', 'frost'].forEach(k => {
        if (!socketsData.player[k]) socketsData.player[k] = {};
        socketsData.player[k].handX = -pCfg.shoulderX;
        socketsData.player[k].handY = pCfg.shoulderY;
        socketsData.player[k].handZ = pCfg.shoulderZ;
        socketsData.player[k].weaponAngle = pCfg.weapon?.angle ?? -45;
      });

      ['thunder', 'fire', 'frost'].forEach(k => {
        if (!socketsData.boss[k]) socketsData.boss[k] = {};
        socketsData.boss[k].handX = bCfg.shoulderX;
        socketsData.boss[k].handY = bCfg.shoulderY;
        socketsData.boss[k].handZ = bCfg.shoulderZ;
      });

      const res = await saveSockets(socketsData);
      btnSave.disabled = false;
      btnSave.innerHTML = '<span>💾</span> KHÓA VŨ KHÍ VÀO TAY &amp; LƯU LẠI';

      if (statusToast) {
        statusToast.className = 'status-toast success';
        statusToast.textContent = '✓ Đã khóa vũ khí vào tay và lưu cấu hình thành công!';
        statusToast.style.display = 'block';
        setTimeout(() => { statusToast.style.display = 'none'; }, 4000);
      }

      window.dispatchEvent(new CustomEvent('sockets-updated', { detail: socketsData }));
    } catch (err) {
      btnSave.disabled = false;
      btnSave.innerHTML = '<span>💾</span> KHÓA VŨ KHÍ VÀO TAY &amp; LƯU LẠI';
      if (statusToast) {
        statusToast.className = 'status-toast error';
        statusToast.textContent = 'Lỗi khi lưu: ' + err.message;
        statusToast.style.display = 'block';
      }
    }
  });

  // Animation Loop
  let reqId = null;
  function animate() {
    reqId = requestAnimationFrame(animate);
    controls.update();

    if (activeStep === 1) {
      const t = Date.now() * 0.003;
      sRingX.scale.setScalar(1 + Math.sin(t) * 0.15);
      sRingY.scale.setScalar(1 + Math.cos(t) * 0.15);
    }

    renderer.render(scene, camera);
  }
  animate();

  const resizeObs = new ResizeObserver(() => {
    const w = containerEl.clientWidth || 600;
    const h = containerEl.clientHeight || 480;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObs.observe(containerEl);

  loadTargetModel();

  return {
    destroy: () => {
      cancelAnimationFrame(reqId);
      resizeObs.disconnect();
      renderer.dispose();
    },
    reload: loadTargetModel,
    playTestSwing
  };
}

/**
 * Initializes the standalone calibrator on public/admin.html
 */
export function initStandaloneCalibrator() {
  const containerEl = document.getElementById('viewport-canvas-container');
  const selectTargetEl = document.getElementById('select-model-target');

  const btnTabStep1 = document.getElementById('btn-tab-step1');
  const btnTabStep2 = document.getElementById('btn-tab-step2');
  const paneStep1 = document.getElementById('pane-step1');
  const paneStep2 = document.getElementById('pane-step2');

  const sliderShoulderX = document.getElementById('slider-shoulder-x');
  const numShoulderX = document.getElementById('num-shoulder-x');
  const valShoulderX = document.getElementById('val-shoulder-x');

  const sliderShoulderY = document.getElementById('slider-shoulder-y');
  const numShoulderY = document.getElementById('num-shoulder-y');
  const valShoulderY = document.getElementById('val-shoulder-y');

  const sliderShoulderZ = document.getElementById('slider-shoulder-z');
  const numShoulderZ = document.getElementById('num-shoulder-z');
  const valShoulderZ = document.getElementById('val-shoulder-z');

  const btnGotoStep2 = document.getElementById('btn-goto-step2');
  const btnGotoStep1 = document.getElementById('btn-goto-step1');

  const sliderOffsetX = document.getElementById('slider-offset-x');
  const numOffsetX = document.getElementById('num-offset-x');
  const valOffsetX = document.getElementById('val-offset-x');

  const sliderOffsetY = document.getElementById('slider-offset-y');
  const numOffsetY = document.getElementById('num-offset-y');
  const valOffsetY = document.getElementById('val-offset-y');

  const sliderOffsetZ = document.getElementById('slider-offset-z');
  const numOffsetZ = document.getElementById('num-offset-z');
  const valOffsetZ = document.getElementById('val-offset-z');

  const sliderTiltAngle = document.getElementById('slider-tilt-angle');
  const numTiltAngle = document.getElementById('num-tilt-angle');
  const valTiltAngle = document.getElementById('val-tilt-angle');

  const btnTestSwing = document.getElementById('btn-test-swing');
  const btnSave = document.getElementById('btn-save-sockets');
  const btnReset = document.getElementById('btn-reset-default');
  const statusToast = document.getElementById('status-toast');

  return initVisualSocketCalibrator({
    containerEl,
    selectTargetEl,
    btnTabStep1, btnTabStep2, paneStep1, paneStep2,
    sliderShoulderX, numShoulderX, valShoulderX,
    sliderShoulderY, numShoulderY, valShoulderY,
    sliderShoulderZ, numShoulderZ, valShoulderZ,
    btnGotoStep2, btnGotoStep1,
    sliderOffsetX, numOffsetX, valOffsetX,
    sliderOffsetY, numOffsetY, valOffsetY,
    sliderOffsetZ, numOffsetZ, valOffsetZ,
    sliderTiltAngle, numTiltAngle, valTiltAngle,
    btnTestSwing,
    btnSave, btnReset, statusToast
  });
}
