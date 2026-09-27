// Admin API client helper for 3D GLB/GLTF models and Character Art

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
// 3D Visual Socket & Pivot Calibrator Engine
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
    default: { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    thunder: { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    fire:    { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 },
    frost:   { handX: 0.65, handY: 0.85, handZ: 0.1, weaponAngle: -45 }
  },
  boss: {
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
export function initVisualSocketCalibrator({
  containerEl,
  selectTargetEl,
  sliderX, numX, valX,
  sliderY, numY, valY,
  sliderZ, numZ, valZ,
  groupAngle, sliderAngle, numAngle, valAngle,
  btnSave, btnReset, statusToast
}) {
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

  // Anchor Marker (Glowing Sphere + Rings)
  const markerGroup = new THREE.Group();
  markerGroup.name = 'AnchorMarkerGroup';

  const markerCore = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ff88 })
  );
  markerGroup.add(markerCore);

  const ringGeo = new THREE.RingGeometry(0.12, 0.16, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x00ff88, side: THREE.DoubleSide, transparent: true, opacity: 0.8 });
  const ringX = new THREE.Mesh(ringGeo, ringMat);
  ringX.rotation.x = Math.PI / 2;
  markerGroup.add(ringX);

  const ringY = new THREE.Mesh(ringGeo, ringMat);
  ringY.rotation.y = Math.PI / 2;
  markerGroup.add(ringY);

  scene.add(markerGroup);

  // Ghost preview weapon attached to marker
  const previewWeaponGroup = new THREE.Group();
  previewWeaponGroup.name = 'PreviewWeaponGroup';
  markerGroup.add(previewWeaponGroup);

  // Model Holder
  const modelHolder = new THREE.Group();
  modelHolder.name = 'ModelHolder';
  scene.add(modelHolder);

  let currentTargetKey = selectTargetEl ? selectTargetEl.value : 'player.default';
  let socketsData = JSON.parse(JSON.stringify(DEFAULT_SOCKETS_CONFIG));
  let isRaycasting = true;

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

  function getTargetConfig(targetStr) {
    const [cat, key] = targetStr.split('.');
    if (!socketsData[cat]) socketsData[cat] = {};
    if (!socketsData[cat][key]) {
      socketsData[cat][key] = (DEFAULT_SOCKETS_CONFIG[cat] && DEFAULT_SOCKETS_CONFIG[cat][key])
        ? { ...DEFAULT_SOCKETS_CONFIG[cat][key] }
        : { handX: 0, handY: 0, handZ: 0 };
    }
    return { cat, key, cfg: socketsData[cat][key] };
  }

  function updateControlsFromConfig() {
    const { cat, cfg } = getTargetConfig(currentTargetKey);

    const x = cat === 'weapon' ? (cfg.hiltX ?? 0) : (cfg.handX ?? 0.65);
    const y = cat === 'weapon' ? (cfg.hiltY ?? -0.5) : (cfg.handY ?? 0.85);
    const z = cat === 'weapon' ? (cfg.hiltZ ?? 0) : (cfg.handZ ?? 0.1);
    const angle = cfg.weaponAngle ?? -45;

    if (sliderX) sliderX.value = x;
    if (numX) numX.value = Number(x).toFixed(2);
    if (valX) valX.textContent = Number(x).toFixed(2);

    if (sliderY) sliderY.value = y;
    if (numY) numY.value = Number(y).toFixed(2);
    if (valY) valY.textContent = Number(y).toFixed(2);

    if (sliderZ) sliderZ.value = z;
    if (numZ) numZ.value = Number(z).toFixed(2);
    if (valZ) valZ.textContent = Number(z).toFixed(2);

    if (groupAngle) {
      if (cat === 'weapon' && currentTargetKey === 'weapon.boss_hammer') {
        groupAngle.style.display = 'none';
      } else {
        groupAngle.style.display = 'flex';
      }
    }
    if (sliderAngle) sliderAngle.value = angle;
    if (numAngle) numAngle.value = Math.round(angle);
    if (valAngle) valAngle.textContent = `${Math.round(angle)}°`;

    updateMarkerAndWeapon();
  }

  function updateMarkerAndWeapon() {
    const { cat, cfg } = getTargetConfig(currentTargetKey);

    const x = cat === 'weapon' ? (cfg.hiltX ?? 0) : (cfg.handX ?? 0.65);
    const y = cat === 'weapon' ? (cfg.hiltY ?? -0.5) : (cfg.handY ?? 0.85);
    const z = cat === 'weapon' ? (cfg.hiltZ ?? 0) : (cfg.handZ ?? 0.1);
    const angle = cfg.weaponAngle ?? -45;

    markerGroup.position.set(x, y, z);

    // Update ghost preview weapon rotation & offset
    if (cat === 'player') {
      previewWeaponGroup.visible = true;
      // Orient sword blade towards +X (Boss direction in game)
      previewWeaponGroup.rotation.set(0, Math.PI / 2, (angle * Math.PI) / 180);
    } else if (cat === 'boss') {
      previewWeaponGroup.visible = true;
      previewWeaponGroup.rotation.set(0, -Math.PI / 2, 0);
    } else {
      previewWeaponGroup.visible = false;
    }
  }

  function loadPreviewWeaponMesh(cat, key) {
    while (previewWeaponGroup.children.length) {
      previewWeaponGroup.remove(previewWeaponGroup.children[0]);
    }
    if (cat === 'player') {
      // Build sleek ghost sword
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 1.8, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x00ffff, emissive: 0x0066aa, transparent: true, opacity: 0.85 })
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
      previewWeaponGroup.add(blade, guard, grip);
      previewWeaponGroup.scale.set(1.4, 1.4, 1.4);
    } else if (cat === 'boss') {
      // Build ghost warhammer
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 3.2, 0.18),
        new THREE.MeshStandardMaterial({ color: 0x222222 })
      );
      handle.position.set(0, 0, 0);
      const hHead = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 1.4, 1.2),
        new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x882200, transparent: true, opacity: 0.85 })
      );
      hHead.position.set(0, 1.4, 0);
      previewWeaponGroup.add(handle, hHead);
      previewWeaponGroup.scale.set(0.9, 0.9, 0.9);
    }
  }

  // Build Procedural Fallback Mesh if 3D model file doesn't exist
  function buildFallbackModel(cat, key) {
    const grp = new THREE.Group();
    if (cat === 'player') {
      const colors = { default: 0x2255cc, thunder: 0x0088cc, fire: 0xcc2200, frost: 0x4499cc };
      const col = colors[key] || 0x2255cc;
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.5 });
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c4a0 });

      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.5), mat);
      torso.position.y = 1.3;
      grp.add(torso);

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat);
      head.position.y = 2.3;
      grp.add(head);

      // Left Arm (holding weapon)
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), skinMat);
      armL.position.set(-0.65, 1.2, 0);
      grp.add(armL);

      // Right Arm
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), skinMat);
      armR.position.set(0.65, 1.2, 0);
      grp.add(armR);

      // Legs
      const legL = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), mat);
      legL.position.set(-0.25, 0.5, 0);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.0, 0.4), mat);
      legR.position.set(0.25, 0.5, 0);
      grp.add(legL, legR);

    } else if (cat === 'boss') {
      const colors = { thunder: 0x3a3a4a, fire: 0x2a0a00, frost: 0x4488aa };
      const accents = { thunder: 0x00ffdd, fire: 0xff5500, frost: 0xbbeeff };
      const col = colors[key] || 0x3a3a4a;
      const acc = accents[key] || 0x00ffdd;
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 });
      const accMat = new THREE.MeshStandardMaterial({ color: acc, emissive: acc, emissiveIntensity: 0.4 });

      // Torso
      const torso = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 1.2), mat);
      torso.position.y = 2.2;
      grp.add(torso);

      // Head
      const head = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), mat);
      head.position.y = 4.3;
      grp.add(head);

      // Left arm (weapon arm)
      const armL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), mat);
      armL.position.set(-1.8, 2.2, 0);
      grp.add(armL);

      // Right arm
      const armR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), mat);
      armR.position.set(1.8, 2.2, 0);
      grp.add(armR);

      // Horns
      for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.2, 0.3), accMat);
        horn.position.set(s * 0.7, 5.4, 0);
        grp.add(horn);
      }
    } else {
      // Weapon model preview
      if (key === 'player_sword') {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.2, 0.08), new THREE.MeshStandardMaterial({ color: 0x00cfff, metalness: 0.9 }));
        blade.position.y = 1.1;
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.1), new THREE.MeshStandardMaterial({ color: 0xffcc00 }));
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), new THREE.MeshStandardMaterial({ color: 0x333333 }));
        grip.position.y = -0.25;
        grp.add(blade, guard, grip);
      } else {
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.4, 0.25), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.8, 1.6), new THREE.MeshStandardMaterial({ color: 0xff5500 }));
        head.position.y = 1.8;
        grp.add(handle, head);
      }
    }
    return grp;
  }

  // Load Model for selected target
  async function loadTargetModel() {
    while (modelHolder.children.length) {
      modelHolder.remove(modelHolder.children[0]);
    }

    const { cat, key } = getTargetConfig(currentTargetKey);
    loadPreviewWeaponMesh(cat, key);

    let modelUrl = null;
    if (cat === 'player') {
      modelUrl = `/assets/models/${key}_character.glb`;
    } else if (cat === 'boss') {
      modelUrl = `/assets/models/boss_${key}.glb`;
    } else if (cat === 'weapon') {
      modelUrl = key === 'player_sword' ? `/assets/models/default_weapon.glb` : `/assets/models/boss_hammer.glb`;
    }

    let loaded = false;
    if (modelUrl) {
      try {
        const gltf = await new Promise((resolve) => gltfLoader.load(modelUrl, resolve, undefined, () => resolve(null)));
        if (gltf && gltf.scene) {
          const model = gltf.scene;
          model.traverse(c => {
            if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
          });
          // Normalize model size
          const bBox = new THREE.Box3().setFromObject(model);
          const bSize = new THREE.Vector3();
          bBox.getSize(bSize);
          if (bSize.y > 0.01) {
            const targetH = (cat === 'boss') ? 4.0 : (cat === 'player') ? 2.8 : 2.0;
            const s = targetH / bSize.y;
            model.scale.setScalar(s);
          }
          const sBox = new THREE.Box3().setFromObject(model);
          model.position.x = - (sBox.min.x + sBox.max.x) / 2;
          model.position.z = - (sBox.min.z + sBox.max.z) / 2;
          model.position.y = - sBox.min.y;

          modelHolder.add(model);
          loaded = true;
        }
      } catch (e) {}
    }

    if (!loaded) {
      const fallback = buildFallbackModel(cat, key);
      modelHolder.add(fallback);
    }

    updateControlsFromConfig();
  }

  // Click on Model (Raycaster) to place anchor point
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

    // Only count as click if didn't drag camera
    if (elapsed < 300 && dist < 6) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(modelHolder.children, true);

      if (intersects.length > 0) {
        const hit = intersects[0];
        const pt = hit.point.clone();

        const { cat, cfg } = getTargetConfig(currentTargetKey);
        if (cat === 'weapon') {
          cfg.hiltX = Math.round(pt.x * 100) / 100;
          cfg.hiltY = Math.round(pt.y * 100) / 100;
          cfg.hiltZ = Math.round(pt.z * 100) / 100;
        } else {
          cfg.handX = Math.round(pt.x * 100) / 100;
          cfg.handY = Math.round(pt.y * 100) / 100;
          cfg.handZ = Math.round(pt.z * 100) / 100;
        }

        updateControlsFromConfig();
      }
    }
  });

  // Slider change listeners
  function onSliderChange() {
    const { cat, cfg } = getTargetConfig(currentTargetKey);
    const x = parseFloat(sliderX?.value || 0);
    const y = parseFloat(sliderY?.value || 0);
    const z = parseFloat(sliderZ?.value || 0);
    const angle = parseFloat(sliderAngle?.value || 0);

    if (cat === 'weapon') {
      cfg.hiltX = x;
      cfg.hiltY = y;
      cfg.hiltZ = z;
    } else {
      cfg.handX = x;
      cfg.handY = y;
      cfg.handZ = z;
    }
    cfg.weaponAngle = angle;

    if (numX) numX.value = x.toFixed(2);
    if (valX) valX.textContent = x.toFixed(2);
    if (numY) numY.value = y.toFixed(2);
    if (valY) valY.textContent = y.toFixed(2);
    if (numZ) numZ.value = z.toFixed(2);
    if (valZ) valZ.textContent = z.toFixed(2);
    if (numAngle) numAngle.value = Math.round(angle);
    if (valAngle) valAngle.textContent = `${Math.round(angle)}°`;

    updateMarkerAndWeapon();
  }

  function onNumChange() {
    if (sliderX && numX) sliderX.value = numX.value;
    if (sliderY && numY) sliderY.value = numY.value;
    if (sliderZ && numZ) sliderZ.value = numZ.value;
    if (sliderAngle && numAngle) sliderAngle.value = numAngle.value;
    onSliderChange();
  }

  sliderX?.addEventListener('input', onSliderChange);
  sliderY?.addEventListener('input', onSliderChange);
  sliderZ?.addEventListener('input', onSliderChange);
  sliderAngle?.addEventListener('input', onSliderChange);

  numX?.addEventListener('change', onNumChange);
  numY?.addEventListener('change', onNumChange);
  numZ?.addEventListener('change', onNumChange);
  numAngle?.addEventListener('change', onNumChange);

  // Model Selector change
  selectTargetEl?.addEventListener('change', () => {
    currentTargetKey = selectTargetEl.value;
    loadTargetModel();
  });

  // Reset to default button
  btnReset?.addEventListener('click', () => {
    const { cat, key } = getTargetConfig(currentTargetKey);
    if (DEFAULT_SOCKETS_CONFIG[cat] && DEFAULT_SOCKETS_CONFIG[cat][key]) {
      socketsData[cat][key] = { ...DEFAULT_SOCKETS_CONFIG[cat][key] };
      updateControlsFromConfig();
      if (statusToast) {
        statusToast.className = 'status-toast success';
        statusToast.textContent = `✓ Đã hoàn tác về giá trị chuẩn của ${currentTargetKey}`;
        setTimeout(() => { statusToast.style.display = 'none'; }, 3000);
      }
    }
  });

  // Save button
  btnSave?.addEventListener('click', async () => {
    try {
      btnSave.disabled = true;
      btnSave.textContent = '⏳ Đang lưu...';
      const res = await saveSockets(socketsData);
      btnSave.disabled = false;
      btnSave.innerHTML = '<span>💾</span> LƯU THIẾT LẬP KHỚP';

      if (statusToast) {
        statusToast.className = 'status-toast success';
        statusToast.textContent = '✓ Lưu cấu hình khớp tay & chuôi vũ khí thành công!';
        statusToast.style.display = 'block';
        setTimeout(() => { statusToast.style.display = 'none'; }, 4000);
      }

      // Notify any live scene listeners
      window.dispatchEvent(new CustomEvent('sockets-updated', { detail: socketsData }));
    } catch (err) {
      btnSave.disabled = false;
      btnSave.innerHTML = '<span>💾</span> LƯU THIẾT LẬP KHỚP';
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

    // Pulse marker ring
    const t = Date.now() * 0.003;
    ringX.scale.setScalar(1 + Math.sin(t) * 0.15);
    ringY.scale.setScalar(1 + Math.cos(t) * 0.15);

    renderer.render(scene, camera);
  }
  animate();

  // Resize handler
  const resizeObs = new ResizeObserver(() => {
    const w = containerEl.clientWidth || 600;
    const h = containerEl.clientHeight || 480;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
  resizeObs.observe(containerEl);

  // Initial load
  loadTargetModel();

  return {
    destroy: () => {
      cancelAnimationFrame(reqId);
      resizeObs.disconnect();
      renderer.dispose();
    },
    reload: loadTargetModel
  };
}

/**
 * Initializes the standalone calibrator on public/admin.html
 */
export function initStandaloneCalibrator() {
  const containerEl = document.getElementById('viewport-canvas-container');
  const selectTargetEl = document.getElementById('select-model-target');
  const sliderX = document.getElementById('slider-x');
  const numX = document.getElementById('num-x');
  const valX = document.getElementById('val-x');

  const sliderY = document.getElementById('slider-y');
  const numY = document.getElementById('num-y');
  const valY = document.getElementById('val-y');

  const sliderZ = document.getElementById('slider-z');
  const numZ = document.getElementById('num-z');
  const valZ = document.getElementById('val-z');

  const groupAngle = document.getElementById('group-angle');
  const sliderAngle = document.getElementById('slider-angle');
  const numAngle = document.getElementById('num-angle');
  const valAngle = document.getElementById('val-angle');

  const btnSave = document.getElementById('btn-save-sockets');
  const btnReset = document.getElementById('btn-reset-default');
  const statusToast = document.getElementById('status-toast');

  return initVisualSocketCalibrator({
    containerEl,
    selectTargetEl,
    sliderX, numX, valX,
    sliderY, numY, valY,
    sliderZ, numZ, valZ,
    groupAngle, sliderAngle, numAngle, valAngle,
    btnSave, btnReset, statusToast
  });
}



