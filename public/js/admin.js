// Admin 3D GLB Model Viewer & Arm Rigging Calibrator
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
export const gltfLoader = new GLTFLoader();
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

export async function fetchSockets() {
  const res = await fetch('/api/admin/sockets');
  const data = await res.json();
  return data.sockets || data;
}

export async function saveRigging(payload) {
  const res = await fetch('/api/admin/rigging/brush-save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'Lưu cấu hình rigging thất bại');
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D MODEL VIEWER & RIGGING CALIBRATOR
// ─────────────────────────────────────────────────────────────────────────────
export function initModelCalibrator() {
  const container = document.getElementById('canvas-player');
  if (!container) return;

  const width = container.clientWidth || 700;
  const height = container.clientHeight || 580;

  // Scene, Camera, Renderer
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a13);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 1.8, 5.0);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.6, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;

  // Lighting
  const ambLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(4, 8, 5);
  scene.add(dirLight);

  const grid = new THREE.GridHelper(10, 10, 0x00b4d8, 0x1e293b);
  grid.position.y = 0;
  scene.add(grid);

  // Character Root & Arm Compound
  const characterRoot = new THREE.Group();
  scene.add(characterRoot);

  let characterMesh = null;
  let swordMesh = null;

  // Arm Shoulder Pivot & Weapon Mount
  const armShoulderPivot = new THREE.Group();
  armShoulderPivot.position.set(0.65, 1.10, 0.0);
  characterRoot.add(armShoulderPivot);

  const weaponSocket = new THREE.Group();
  weaponSocket.position.set(0.0, -0.4, 0.1);
  weaponSocket.rotation.set(0, 0, -Math.PI / 4);
  armShoulderPivot.add(weaponSocket);

  // Visual marker for shoulder pivot
  const shoulderMarkerGeo = new THREE.SphereGeometry(0.08, 16, 16);
  const shoulderMarkerMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const shoulderMarker = new THREE.Mesh(shoulderMarkerGeo, shoulderMarkerMat);
  armShoulderPivot.add(shoulderMarker);

  // Build Procedural Sword Mesh
  function buildProceduralSword() {
    const sword = new THREE.Group();

    // Blade
    const bladeGeo = new THREE.BoxGeometry(0.12, 1.6, 0.03);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x00b4d8,
      emissiveIntensity: 0.2
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.8;
    sword.add(blade);

    // Crossguard
    const guardGeo = new THREE.BoxGeometry(0.4, 0.08, 0.1);
    const guardMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.5 });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.y = 0.04;
    sword.add(guard);

    // Hilt / Grip
    const hiltGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
    const hiltMat = new THREE.MeshStandardMaterial({ color: 0x4a2e12 });
    const hilt = new THREE.Mesh(hiltGeo, hiltMat);
    hilt.position.y = -0.175;
    sword.add(hilt);

    return sword;
  }

  // Build Procedural 3D Character Fallback
  function buildProceduralCharacter() {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c4a0 });
    const clothesMat = new THREE.MeshStandardMaterial({ color: 0x2255cc });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x222233 });

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat);
    head.position.y = 3.2;
    group.add(head);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.6), clothesMat);
    torso.position.y = 2.05;
    group.add(torso);

    // Left Arm
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, 0.4), skinMat);
    leftArm.position.set(-0.85, 2.0, 0);
    group.add(leftArm);

    // Legs
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.45), pantsMat);
    lLeg.position.set(-0.3, 0.7, 0);
    group.add(lLeg);

    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.45), pantsMat);
    rLeg.position.set(0.3, 0.7, 0);
    group.add(rLeg);

    return group;
  }

  // Load 3D Character GLB
  async function loadCharacter(element) {
    const el = element || 'default';
    const hudModel = document.getElementById('hud-player-model');
    if (hudModel) hudModel.textContent = `Loading ${el}...`;

    if (characterMesh) {
      characterRoot.remove(characterMesh);
      characterMesh = null;
    }

    const candidateUrls = [
      `/assets/character/${el === 'fire' ? 'Fire%20player' : el === 'thunder' ? 'Lightning%20player' : el === 'frost' ? 'Ice%20player' : 'Player'}.glb`,
      `/assets/character/${el}_character.glb`,
      `/assets/character/default_character.glb`,
      `/assets/models/${el}_character.glb`,
      `/assets/models/default_character.glb`
    ];

    let loadedGltf = null;
    for (const url of candidateUrls) {
      try {
        loadedGltf = await new Promise((resolve) => {
          gltfLoader.load(url, resolve, undefined, () => resolve(null));
        });
        if (loadedGltf && loadedGltf.scene) break;
      } catch (e) {
        loadedGltf = null;
      }
    }

    if (loadedGltf && loadedGltf.scene) {
      characterMesh = loadedGltf.scene;
      // Bounding Box Normalization
      const box = new THREE.Box3().setFromObject(characterMesh);
      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      const targetHeight = 3.8;
      const scale = size.y > 0 ? (targetHeight / size.y) : 1.0;
      characterMesh.scale.set(scale, scale, scale);
      characterMesh.position.x = -center.x * scale;
      characterMesh.position.y = -box.min.y * scale;
      characterMesh.position.z = -center.z * scale;

      characterRoot.add(characterMesh);
      if (hudModel) hudModel.textContent = `3D GLB: ${el}`;
    } else {
      // Procedural 3D humanoid fallback
      characterMesh = buildProceduralCharacter();
      characterRoot.add(characterMesh);
      if (hudModel) hudModel.textContent = `Procedural 3D: ${el}`;
    }

    // Attach sword
    if (!swordMesh) {
      swordMesh = buildProceduralSword();
      weaponSocket.add(swordMesh);
    }
  }

  // Poses State
  let slashPoses = {
    pose1: { degZ: 60, rotZ: Math.PI / 3 },
    pose2: { degZ: -72, rotZ: -Math.PI / 2.5 },
    pose3: { degZ: 0, rotZ: 0 }
  };

  let activePoseZ = 0;

  // DOM Elements
  const sliderShoulderX = document.getElementById('slider-shoulder-x');
  const sliderShoulderY = document.getElementById('slider-shoulder-y');
  const sliderShoulderZ = document.getElementById('slider-shoulder-z');
  const valShoulderX = document.getElementById('val-shoulder-x');
  const valShoulderY = document.getElementById('val-shoulder-y');
  const valShoulderZ = document.getElementById('val-shoulder-z');

  const hudShoulder = document.getElementById('hud-player-shoulder');
  const hudWrist = document.getElementById('hud-player-wrist');

  function updateShoulderFromSliders() {
    const x = parseFloat(sliderShoulderX?.value || 0.65);
    const y = parseFloat(sliderShoulderY?.value || 1.10);
    const z = parseFloat(sliderShoulderZ?.value || 0.00);

    armShoulderPivot.position.set(x, y, z);
    if (valShoulderX) valShoulderX.textContent = x.toFixed(2);
    if (valShoulderY) valShoulderY.textContent = y.toFixed(2);
    if (valShoulderZ) valShoulderZ.textContent = z.toFixed(2);
    if (hudShoulder) hudShoulder.textContent = `(${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`;
  }

  sliderShoulderX?.addEventListener('input', updateShoulderFromSliders);
  sliderShoulderY?.addEventListener('input', updateShoulderFromSliders);
  sliderShoulderZ?.addEventListener('input', updateShoulderFromSliders);

  // Weapon angle
  const sliderSwordAngle = document.getElementById('slider-player-sword-angle');
  const valSwordAngle = document.getElementById('val-player-sword-angle');

  sliderSwordAngle?.addEventListener('input', () => {
    const deg = parseFloat(sliderSwordAngle.value || -45);
    weaponSocket.rotation.z = (deg * Math.PI) / 180;
    if (valSwordAngle) valSwordAngle.textContent = `${Math.round(deg)}°`;
  });

  // Nudge buttons
  const nudgeStep = 0.05;
  document.getElementById('btn-nudge-x-neg')?.addEventListener('click', () => { weaponSocket.position.x -= nudgeStep; updateWristHud(); });
  document.getElementById('btn-nudge-x-pos')?.addEventListener('click', () => { weaponSocket.position.x += nudgeStep; updateWristHud(); });
  document.getElementById('btn-nudge-y-pos')?.addEventListener('click', () => { weaponSocket.position.y += nudgeStep; updateWristHud(); });
  document.getElementById('btn-nudge-y-neg')?.addEventListener('click', () => { weaponSocket.position.y -= nudgeStep; updateWristHud(); });
  document.getElementById('btn-nudge-z-neg')?.addEventListener('click', () => { weaponSocket.position.z -= nudgeStep; updateWristHud(); });
  document.getElementById('btn-nudge-z-pos')?.addEventListener('click', () => { weaponSocket.position.z += nudgeStep; updateWristHud(); });

  document.getElementById('btn-player-snap-weapon')?.addEventListener('click', () => {
    weaponSocket.position.set(0.0, -0.4, 0.1);
    weaponSocket.rotation.set(0, 0, -Math.PI / 4);
    if (sliderSwordAngle) sliderSwordAngle.value = -45;
    if (valSwordAngle) valSwordAngle.textContent = '-45°';
    updateWristHud();
  });

  function updateWristHud() {
    if (hudWrist) {
      hudWrist.textContent = `(${(armShoulderPivot.position.x + weaponSocket.position.x).toFixed(2)}, ${(armShoulderPivot.position.y + weaponSocket.position.y).toFixed(2)}, ${(armShoulderPivot.position.z + weaponSocket.position.z).toFixed(2)})`;
    }
  }

  // 3-Pose Keyframe Recorders
  const sliderPoseZ = document.getElementById('slider-player-pose-z');
  const valPoseZ = document.getElementById('val-player-pose-z');

  sliderPoseZ?.addEventListener('input', () => {
    const deg = parseFloat(sliderPoseZ.value || 0);
    activePoseZ = deg;
    armShoulderPivot.rotation.z = (deg * Math.PI) / 180;
    if (valPoseZ) valPoseZ.textContent = `${Math.round(deg)}°`;
  });

  document.getElementById('btn-record-pose1')?.addEventListener('click', () => {
    slashPoses.pose1 = { degZ: activePoseZ, rotZ: (activePoseZ * Math.PI) / 180 };
    const badge = document.getElementById('badge-player-pose1');
    if (badge) badge.textContent = `Z: ${Math.round(activePoseZ)}° (100ms)`;
  });

  document.getElementById('btn-record-pose2')?.addEventListener('click', () => {
    slashPoses.pose2 = { degZ: activePoseZ, rotZ: (activePoseZ * Math.PI) / 180 };
    const badge = document.getElementById('badge-player-pose2');
    if (badge) badge.textContent = `Z: ${Math.round(activePoseZ)}° (120ms)`;
  });

  document.getElementById('btn-record-pose3')?.addEventListener('click', () => {
    slashPoses.pose3 = { degZ: activePoseZ, rotZ: (activePoseZ * Math.PI) / 180 };
    const badge = document.getElementById('badge-player-pose3');
    if (badge) badge.textContent = `Z: ${Math.round(activePoseZ)}° (100ms)`;
  });

  document.getElementById('btn-view-pose1')?.addEventListener('click', () => {
    sliderPoseZ.value = slashPoses.pose1.degZ;
    sliderPoseZ.dispatchEvent(new Event('input'));
  });

  document.getElementById('btn-view-pose2')?.addEventListener('click', () => {
    sliderPoseZ.value = slashPoses.pose2.degZ;
    sliderPoseZ.dispatchEvent(new Event('input'));
  });

  document.getElementById('btn-view-pose3')?.addEventListener('click', () => {
    sliderPoseZ.value = slashPoses.pose3.degZ;
    sliderPoseZ.dispatchEvent(new Event('input'));
  });

  // Test 3-Pose Playback
  let isPlayingTween = false;
  document.getElementById('btn-player-test-3pose')?.addEventListener('click', () => {
    if (isPlayingTween) return;
    isPlayingTween = true;

    const p1 = slashPoses.pose1.rotZ;
    const p2 = slashPoses.pose2.rotZ;
    const p3 = slashPoses.pose3.rotZ;
    const startRotZ = armShoulderPivot.rotation.z;

    const startTime = performance.now();

    function stepTween(now) {
      const elapsed = now - startTime;
      if (elapsed < 100) {
        // Wind-up (100ms)
        const t = elapsed / 100;
        armShoulderPivot.rotation.z = THREE.MathUtils.lerp(startRotZ, p1, t);
        requestAnimationFrame(stepTween);
      } else if (elapsed < 220) {
        // Slash strike (120ms)
        const t = (elapsed - 100) / 120;
        armShoulderPivot.rotation.z = THREE.MathUtils.lerp(p1, p2, t);
        requestAnimationFrame(stepTween);
      } else if (elapsed < 320) {
        // Return (100ms)
        const t = (elapsed - 220) / 100;
        armShoulderPivot.rotation.z = THREE.MathUtils.lerp(p2, p3, t);
        requestAnimationFrame(stepTween);
      } else {
        armShoulderPivot.rotation.z = p3;
        sliderPoseZ.value = slashPoses.pose3.degZ;
        if (valPoseZ) valPoseZ.textContent = `${Math.round(slashPoses.pose3.degZ)}°`;
        isPlayingTween = false;
      }
    }
    requestAnimationFrame(stepTween);
  });

  // Element Set Buttons
  ['fire', 'thunder', 'frost', 'default'].forEach(el => {
    const btn = document.getElementById(`btn-player-set-${el}`);
    btn?.addEventListener('click', () => {
      document.querySelectorAll('[id^=btn-player-set-]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadCharacter(el);
    });
  });

  // Save Rigging
  document.getElementById('btn-player-save')?.addEventListener('click', async () => {
    const toast = document.getElementById('toast-player');
    try {
      const payload = {
        player: {
          shoulderPivot: {
            x: armShoulderPivot.position.x,
            y: armShoulderPivot.position.y,
            z: armShoulderPivot.position.z,
          },
          weaponOffset: {
            offsetX: weaponSocket.position.x,
            offsetY: weaponSocket.position.y,
            offsetZ: weaponSocket.position.z,
            angle: parseFloat(sliderSwordAngle?.value || -45)
          },
          slashPoses
        }
      };
      await saveRigging(payload);
      if (toast) {
        toast.className = 'status-toast success';
        toast.textContent = '✓ Lưu cấu hình nhân vật 3D thành công!';
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
      }
    } catch (e) {
      if (toast) {
        toast.className = 'status-toast';
        toast.style.color = '#ef4444';
        toast.textContent = 'Lỗi lưu: ' + e.message;
        toast.style.display = 'block';
      }
    }
  });

  // Initial load
  loadCharacter('fire');

  // Animation Loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Resize listener
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w && h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
  });
}

// Compatibility alias
export function initBrushCalibrator() {
  initModelCalibrator();
}
export function initSkeletonCalibrator() {
  initModelCalibrator();
}
