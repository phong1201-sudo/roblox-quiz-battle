// Admin 3D GLB Model Viewer & Arm Rigging Calibrator
import * as Audio from './audio.js';

const THREE = (typeof window !== 'undefined' && window.THREE) ? window.THREE : null;
const OrbitControls = (typeof THREE !== 'undefined' && THREE.OrbitControls) ? THREE.OrbitControls : (typeof window !== 'undefined' ? window.THREE?.OrbitControls : null);
const GLTFLoader = (typeof THREE !== 'undefined' && THREE.GLTFLoader) ? THREE.GLTFLoader : (typeof window !== 'undefined' ? window.THREE?.GLTFLoader : null);

export const gltfLoader = (typeof THREE !== 'undefined' && THREE.GLTFLoader)
  ? new THREE.GLTFLoader()
  : (typeof window !== 'undefined' && window.THREE?.GLTFLoader ? new window.THREE.GLTFLoader() : null);

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

  // Stop Lobby BGM when entering Studio
  try {
    Audio.stopBGM?.();
  } catch (e) {}

  // Stop BGM when clicking "Quay lại trò chơi"
  document.querySelector('.back-btn')?.addEventListener('click', () => {
    try {
      Audio.stopBGM?.();
    } catch (e) {}
  });

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

  // Arm Shoulder Pivot: rotates the entire arm limb from the shoulder joint
  const armShoulderPivot = new THREE.Group();
  armShoulderPivot.position.set(0.65, 2.65, 0.0);
  characterRoot.add(armShoulderPivot);

  // Visual marker for shoulder pivot
  const shoulderMarkerGeo = new THREE.SphereGeometry(0.08, 16, 16);
  const shoulderMarkerMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  const shoulderMarker = new THREE.Mesh(shoulderMarkerGeo, shoulderMarkerMat);
  armShoulderPivot.add(shoulderMarker);

  // Selection & Raycasting state
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let boxHelper = null;
  let selectedMesh = null;
  let selectedRightArm = null;
  let selectedTorso = null;
  let selectedHead = null;

  // Build Procedural Sword Mesh
  function buildProceduralSword() {
    const sword = new THREE.Group();
    sword.name = 'Sword_Weapon';

    // Blade: points forward (+X)
    const bladeGeo = new THREE.BoxGeometry(1.6, 0.12, 0.03);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x00b4d8,
      emissiveIntensity: 0.2
    });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.x = 0.8;
    sword.add(blade);

    // Crossguard
    const guardGeo = new THREE.BoxGeometry(0.08, 0.4, 0.1);
    const guardMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.5 });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.x = 0.04;
    sword.add(guard);

    // Hilt / Grip
    const hiltGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8);
    const hiltMat = new THREE.MeshStandardMaterial({ color: 0x4a2e12 });
    const hilt = new THREE.Mesh(hiltGeo, hiltMat);
    hilt.rotation.z = Math.PI / 2;
    hilt.position.x = -0.175;
    sword.add(hilt);

    return sword;
  }

  // Build Procedural 3D Character with distinct, selectable parts
  function buildProceduralCharacter() {
    const group = new THREE.Group();
    group.name = 'ProceduralCharacter';

    const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c4a0 });
    const clothesMat = new THREE.MeshStandardMaterial({ color: 0x2255cc });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x222233 });

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), skinMat);
    head.name = 'Head';
    head.position.y = 3.2;
    group.add(head);

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, 0.6), clothesMat);
    torso.name = 'Torso';
    torso.position.y = 2.05;
    group.add(torso);

    // Left Arm
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, 0.4), skinMat.clone());
    leftArm.name = 'LeftArm';
    leftArm.position.set(-0.85, 2.0, 0);
    group.add(leftArm);

    // Right Arm (Weapon Arm)
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.3, 0.4), skinMat.clone());
    rightArm.name = 'RightArm';
    rightArm.position.set(0.85, 2.0, 0);
    group.add(rightArm);

    // Legs
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.45), pantsMat);
    lLeg.name = 'LeftLeg';
    lLeg.position.set(-0.3, 0.7, 0);
    group.add(lLeg);

    const rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.4, 0.45), pantsMat);
    rLeg.name = 'RightLeg';
    rLeg.position.set(0.3, 0.7, 0);
    group.add(rLeg);

    return group;
  }

  // Helper: check if obj is a descendant of parent
  function isDescendantOf(child, parent) {
    let curr = child.parent;
    while (curr) {
      if (curr === parent) return true;
      curr = curr.parent;
    }
    return false;
  }

  // Load 3D Character GLB or procedural fallback
  async function loadCharacter(element) {
    const el = element || 'default';
    const hudModel = document.getElementById('hud-player-model');
    if (hudModel) hudModel.textContent = `Loading ${el}...`;

    if (boxHelper) {
      scene.remove(boxHelper);
      boxHelper = null;
    }

    if (characterMesh) {
      characterRoot.remove(characterMesh);
      characterMesh = null;
    }

    // Reset arm pivot children
    while (armShoulderPivot.children.length > 0) {
      armShoulderPivot.remove(armShoulderPivot.children[0]);
    }
    armShoulderPivot.add(shoulderMarker);

    selectedMesh = null;
    selectedRightArm = null;
    selectedTorso = null;
    selectedHead = null;

    const candidateUrls = [
      `/assets/character/${el === 'fire' ? 'Fire%20player' : el === 'thunder' ? 'Lightning%20player' : el === 'frost' ? 'Ice%20player' : 'Player'}.glb`,
      `/assets/character/${el}_character.glb`,
      `/assets/character/default_character.glb`,
      `/assets/models/${el}_character.glb`,
      `/assets/models/default_character.glb`
    ];

    let loadedGltf = null;
    const loader = (typeof THREE !== 'undefined' && THREE.GLTFLoader)
      ? new THREE.GLTFLoader()
      : (typeof window !== 'undefined' && window.THREE?.GLTFLoader ? new window.THREE.GLTFLoader() : null);

    if (loader) {
      for (const url of candidateUrls) {
        try {
          loadedGltf = await new Promise((resolve) => {
            loader.load(url, resolve, undefined, () => resolve(null));
          });
          if (loadedGltf && loadedGltf.scene) break;
        } catch (e) {
          loadedGltf = null;
        }
      }
    }

    if (loadedGltf && loadedGltf.scene) {
      characterMesh = loadedGltf.scene;
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
      characterMesh = buildProceduralCharacter();
      characterRoot.add(characterMesh);
      if (hudModel) hudModel.textContent = `Procedural 3D: ${el}`;
    }

    if (!swordMesh) {
      swordMesh = buildProceduralSword();
    }

    // Auto-detect or select right arm
    autoDetectRightArm();
  }

  // Lock weapon directly to selected right arm mesh and setup shoulder pivot
  function lockWeaponToRightArm(armMesh) {
    if (!armMesh) return;
    selectedRightArm = armMesh;

    // 1. Calculate arm geometry bounding box
    const armBox = new THREE.Box3().setFromObject(armMesh);
    const armSize = new THREE.Vector3();
    armBox.getSize(armSize);
    const armCenter = new THREE.Vector3();
    armBox.getCenter(armCenter);

    // Shoulder Pivot is the top of the arm
    const shoulderX = armCenter.x;
    const shoulderY = armBox.max.y;
    const shoulderZ = armCenter.z;

    // Position the shoulder pivot group at the top vertex
    armShoulderPivot.position.set(shoulderX, shoulderY, shoulderZ);

    // 2. Wrap armMesh inside armShoulderPivot so rotating armShoulderPivot rotates the arm from the shoulder
    if (armMesh.parent !== armShoulderPivot) {
      // Reparent armMesh into armShoulderPivot
      characterRoot.add(armShoulderPivot);
      armShoulderPivot.add(armMesh);

      // Offset armMesh so its top aligns with the pivot origin (0, 0, 0)
      armMesh.position.set(0, -armSize.y / 2, 0);
      armMesh.rotation.set(0, 0, 0);
    }

    // 3. Add swordMesh as a DIRECT CHILD of the selected right arm
    if (swordMesh.parent) {
      swordMesh.parent.remove(swordMesh);
    }
    armMesh.add(swordMesh);

    // Align sword hilt inside the hand box, with blade pointing forward (+X) toward boss
    const handOffsetY = -armSize.y / 2;
    const swordAngleDeg = parseFloat(document.getElementById('slider-player-sword-angle')?.value || -45);
    swordMesh.position.set(0.0, handOffsetY, 0.1);
    swordMesh.rotation.set(0, 0, (swordAngleDeg * Math.PI) / 180);

    // 4. Update HUD and Badges
    const badgeSelected = document.getElementById('badge-selected-mesh');
    if (badgeSelected) {
      badgeSelected.textContent = `💪 Cánh tay: ${armMesh.name || 'RightArm'}`;
    }
    const valShoulder = document.getElementById('val-computed-shoulder');
    if (valShoulder) {
      valShoulder.textContent = `(${shoulderX.toFixed(2)}, ${shoulderY.toFixed(2)}, ${shoulderZ.toFixed(2)})`;
    }
    const hudShoulder = document.getElementById('hud-player-shoulder');
    if (hudShoulder) {
      hudShoulder.textContent = `(${shoulderX.toFixed(2)}, ${shoulderY.toFixed(2)}, ${shoulderZ.toFixed(2)})`;
    }
    const hudWrist = document.getElementById('hud-player-wrist');
    if (hudWrist) {
      hudWrist.textContent = `(${(shoulderX + swordMesh.position.x).toFixed(2)}, ${(shoulderY + handOffsetY).toFixed(2)}, ${(shoulderZ + swordMesh.position.z).toFixed(2)})`;
    }
    const valLockStatus = document.getElementById('val-arm-lock-status');
    if (valLockStatus) {
      valLockStatus.textContent = `Đã khóa kiếm vào: ${armMesh.name || 'RightArm'}`;
      valLockStatus.style.color = '#10b981';
    }

    // Update BoxHelper
    if (boxHelper) {
      scene.remove(boxHelper);
    }
    boxHelper = new THREE.BoxHelper(armMesh, 0x00e5ff);
    scene.add(boxHelper);
  }

  // Auto-detect right arm mesh inside characterRoot
  function autoDetectRightArm() {
    let candidate = null;

    characterRoot.traverse((obj) => {
      if (candidate || !obj.isMesh) return;
      if (obj === shoulderMarker || obj === swordMesh || isDescendantOf(obj, swordMesh)) return;

      const n = (obj.name || '').toLowerCase();
      if ((n.includes('arm') || n.includes('hand') || n.includes('tay')) && (n.includes('r') || n.includes('right') || n.includes('phai'))) {
        candidate = obj;
      }
    });

    if (!candidate) {
      // Find mesh with positive X > 0.3
      characterRoot.traverse((obj) => {
        if (candidate || !obj.isMesh) return;
        if (obj === shoulderMarker || obj === swordMesh || isDescendantOf(obj, swordMesh)) return;

        const b = new THREE.Box3().setFromObject(obj);
        const center = new THREE.Vector3();
        b.getCenter(center);
        if (center.x > 0.3 && center.y > 1.2) {
          candidate = obj;
        }
      });
    }

    if (candidate) {
      lockWeaponToRightArm(candidate);
    }
  }

  // Raycast click-to-select body parts
  let isDragging = false;
  let pointerStartX = 0, pointerStartY = 0;

  renderer.domElement.addEventListener('pointerdown', (e) => {
    pointerStartX = e.clientX;
    pointerStartY = e.clientY;
    isDragging = false;
  });

  renderer.domElement.addEventListener('pointermove', (e) => {
    if (Math.abs(e.clientX - pointerStartX) > 4 || Math.abs(e.clientY - pointerStartY) > 4) {
      isDragging = true;
    }
  });

  renderer.domElement.addEventListener('pointerup', (e) => {
    if (isDragging) return; // User was rotating camera

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(characterRoot.children, true);
    const validHits = intersects.filter(hit => {
      const obj = hit.object;
      if (!obj.isMesh) return false;
      if (obj === shoulderMarker || obj === boxHelper) return false;
      if (swordMesh && (obj === swordMesh || isDescendantOf(obj, swordMesh))) return false;
      return true;
    });

    if (validHits.length > 0) {
      const hitMesh = validHits[0].object;
      selectedMesh = hitMesh;

      // Update BoxHelper
      if (boxHelper) scene.remove(boxHelper);
      boxHelper = new THREE.BoxHelper(hitMesh, 0x00e5ff);
      scene.add(boxHelper);

      // Emissive pulse on clicked mesh
      if (hitMesh.material && hitMesh.material.emissive) {
        const prevHex = hitMesh.material.emissive.getHex();
        hitMesh.material.emissive.setHex(0x00e5ff);
        hitMesh.material.emissiveIntensity = 0.8;
        setTimeout(() => {
          if (hitMesh.material && hitMesh.material.emissive) {
            hitMesh.material.emissive.setHex(prevHex);
            hitMesh.material.emissiveIntensity = 0.15;
          }
        }, 400);
      }

      // Update badge
      const badgeSelected = document.getElementById('badge-selected-mesh');
      if (badgeSelected) {
        badgeSelected.textContent = `${hitMesh.name || 'SubMesh_' + hitMesh.id}`;
      }
    }
  });

  // Assign Buttons
  document.getElementById('btn-assign-right-arm')?.addEventListener('click', () => {
    if (selectedMesh) {
      lockWeaponToRightArm(selectedMesh);
    } else {
      autoDetectRightArm();
    }
  });

  document.getElementById('btn-assign-torso')?.addEventListener('click', () => {
    if (!selectedMesh) return;
    selectedTorso = selectedMesh;
    const badgeSelected = document.getElementById('badge-selected-mesh');
    if (badgeSelected) badgeSelected.textContent = `🥋 Thân: ${selectedMesh.name || 'Torso'}`;
  });

  document.getElementById('btn-assign-head')?.addEventListener('click', () => {
    if (!selectedMesh) return;
    selectedHead = selectedMesh;
    const badgeSelected = document.getElementById('badge-selected-mesh');
    if (badgeSelected) badgeSelected.textContent = `👤 Đầu: ${selectedMesh.name || 'Head'}`;
  });

  document.getElementById('btn-auto-detect-arm')?.addEventListener('click', () => {
    autoDetectRightArm();
  });

  // Weapon Snap / Alignment
  document.getElementById('btn-player-snap-weapon')?.addEventListener('click', () => {
    if (selectedRightArm) {
      lockWeaponToRightArm(selectedRightArm);
    }
  });

  document.getElementById('btn-player-reset-weapon')?.addEventListener('click', () => {
    if (swordMesh && selectedRightArm) {
      const armBox = new THREE.Box3().setFromObject(selectedRightArm);
      const armSize = new THREE.Vector3();
      armBox.getSize(armSize);
      swordMesh.position.set(0.0, -armSize.y / 2, 0.1);
      swordMesh.rotation.set(0, 0, (-45 * Math.PI) / 180);
      const sliderAngle = document.getElementById('slider-player-sword-angle');
      if (sliderAngle) sliderAngle.value = -45;
      const valAngle = document.getElementById('val-player-sword-angle');
      if (valAngle) valAngle.textContent = '-45°';
      if (boxHelper) boxHelper.update();
    }
  });

  // Weapon Blade Angle Slider
  const sliderSwordAngle = document.getElementById('slider-player-sword-angle');
  const valSwordAngle = document.getElementById('val-player-sword-angle');

  sliderSwordAngle?.addEventListener('input', () => {
    const deg = parseFloat(sliderSwordAngle.value || -45);
    if (swordMesh) {
      swordMesh.rotation.z = (deg * Math.PI) / 180;
    }
    if (valSwordAngle) valSwordAngle.textContent = `${Math.round(deg)}°`;
    if (boxHelper) boxHelper.update();
  });

  // Weapon Nudge buttons: finely move sword on the arm hand
  const nudgeStep = 0.05;
  document.getElementById('btn-nudge-x-neg')?.addEventListener('click', () => {
    if (swordMesh) swordMesh.position.x -= nudgeStep;
    if (boxHelper) boxHelper.update();
  });
  document.getElementById('btn-nudge-x-pos')?.addEventListener('click', () => {
    if (swordMesh) swordMesh.position.x += nudgeStep;
    if (boxHelper) boxHelper.update();
  });
  document.getElementById('btn-nudge-y-pos')?.addEventListener('click', () => {
    if (swordMesh) swordMesh.position.y += nudgeStep;
    if (boxHelper) boxHelper.update();
  });
  document.getElementById('btn-nudge-y-neg')?.addEventListener('click', () => {
    if (swordMesh) swordMesh.position.y -= nudgeStep;
    if (boxHelper) boxHelper.update();
  });
  document.getElementById('btn-nudge-z-neg')?.addEventListener('click', () => {
    if (swordMesh) swordMesh.position.z -= nudgeStep;
    if (boxHelper) boxHelper.update();
  });
  document.getElementById('btn-nudge-z-pos')?.addEventListener('click', () => {
    if (swordMesh) swordMesh.position.z += nudgeStep;
    if (boxHelper) boxHelper.update();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Section 4: 3-Pose Visual Slash Keyframe Recorder
  // Operates strictly on the Right Arm mesh (via armShoulderPivot)
  // ─────────────────────────────────────────────────────────────────────────
  let slashPoses = {
    pose1: { degZ: 60, rotZ: (60 * Math.PI) / 180 },
    pose2: { degZ: -72, rotZ: (-72 * Math.PI) / 180 },
    pose3: { degZ: 0, rotZ: 0 }
  };

  let activePoseZ = 0;

  const sliderPoseZ = document.getElementById('slider-player-pose-z');
  const valPoseZ = document.getElementById('val-player-pose-z');

  sliderPoseZ?.addEventListener('input', () => {
    const deg = parseFloat(sliderPoseZ.value || 0);
    activePoseZ = deg;
    armShoulderPivot.rotation.z = (deg * Math.PI) / 180;
    if (valPoseZ) valPoseZ.textContent = `${Math.round(deg)}°`;
    if (boxHelper) boxHelper.update();
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
    if (sliderPoseZ) sliderPoseZ.value = slashPoses.pose1.degZ;
    activePoseZ = slashPoses.pose1.degZ;
    armShoulderPivot.rotation.z = slashPoses.pose1.rotZ;
    if (valPoseZ) valPoseZ.textContent = `${Math.round(activePoseZ)}°`;
    if (boxHelper) boxHelper.update();
  });

  document.getElementById('btn-view-pose2')?.addEventListener('click', () => {
    if (sliderPoseZ) sliderPoseZ.value = slashPoses.pose2.degZ;
    activePoseZ = slashPoses.pose2.degZ;
    armShoulderPivot.rotation.z = slashPoses.pose2.rotZ;
    if (valPoseZ) valPoseZ.textContent = `${Math.round(activePoseZ)}°`;
    if (boxHelper) boxHelper.update();
  });

  document.getElementById('btn-view-pose3')?.addEventListener('click', () => {
    if (sliderPoseZ) sliderPoseZ.value = slashPoses.pose3.degZ;
    activePoseZ = slashPoses.pose3.degZ;
    armShoulderPivot.rotation.z = slashPoses.pose3.rotZ;
    if (valPoseZ) valPoseZ.textContent = `${Math.round(activePoseZ)}°`;
    if (boxHelper) boxHelper.update();
  });

  // Test 3-Pose Playback: Swings arm and sword together as one cohesive limb
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
        // Wind-up: swing arm up
        const t = elapsed / 100;
        armShoulderPivot.rotation.z = THREE.MathUtils.lerp(startRotZ, p1, t);
        if (boxHelper) boxHelper.update();
        requestAnimationFrame(stepTween);
      } else if (elapsed < 220) {
        // Strike: downward slash with arm and sword
        const t = (elapsed - 100) / 120;
        armShoulderPivot.rotation.z = THREE.MathUtils.lerp(p1, p2, t);
        if (boxHelper) boxHelper.update();
        requestAnimationFrame(stepTween);
      } else if (elapsed < 320) {
        // Return: back to ready stance
        const t = (elapsed - 220) / 100;
        armShoulderPivot.rotation.z = THREE.MathUtils.lerp(p2, p3, t);
        if (boxHelper) boxHelper.update();
        requestAnimationFrame(stepTween);
      } else {
        armShoulderPivot.rotation.z = p3;
        if (sliderPoseZ) sliderPoseZ.value = slashPoses.pose3.degZ;
        if (valPoseZ) valPoseZ.textContent = `${Math.round(slashPoses.pose3.degZ)}°`;
        if (boxHelper) boxHelper.update();
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

  // Model file upload
  document.getElementById('input-player-model-upload')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const toast = document.getElementById('toast-player');
    try {
      if (toast) {
        toast.className = 'status-toast';
        toast.textContent = 'Đang tải mô hình lên...';
        toast.style.display = 'block';
      }
      await upload3DModel('fire', 'character', file);
      await loadCharacter('fire');
      if (toast) {
        toast.className = 'status-toast success';
        toast.textContent = '✓ Tải mô hình 3D thành công!';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
      }
    } catch (err) {
      if (toast) {
        toast.className = 'status-toast';
        toast.style.color = '#ef4444';
        toast.textContent = 'Lỗi: ' + err.message;
      }
    }
  });

  // Save Rigging
  document.getElementById('btn-player-save')?.addEventListener('click', async () => {
    const toast = document.getElementById('toast-player');
    try {
      const armName = selectedRightArm ? selectedRightArm.name : 'RightArm';
      const payload = {
        target: 'player',
        armMeshName: armName,
        shoulderPivot: {
          x: armShoulderPivot.position.x,
          y: armShoulderPivot.position.y,
          z: armShoulderPivot.position.z,
        },
        weaponOffset: {
          offsetX: swordMesh ? swordMesh.position.x : 0.0,
          offsetY: swordMesh ? swordMesh.position.y : -0.5,
          offsetZ: swordMesh ? swordMesh.position.z : 0.1,
          angle: parseFloat(sliderSwordAngle?.value || -45)
        },
        slashPoses,
        player: {
          armMeshName: armName,
          shoulderPivot: {
            x: armShoulderPivot.position.x,
            y: armShoulderPivot.position.y,
            z: armShoulderPivot.position.z,
          },
          weaponOffset: {
            offsetX: swordMesh ? swordMesh.position.x : 0.0,
            offsetY: swordMesh ? swordMesh.position.y : -0.5,
            offsetZ: swordMesh ? swordMesh.position.z : 0.1,
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
    if (boxHelper) boxHelper.update();
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

// Compatibility aliases
export function initBrushCalibrator() {
  initModelCalibrator();
}

export function initVisualSocketCalibrator(opts) {
  initModelCalibrator(opts);
}
