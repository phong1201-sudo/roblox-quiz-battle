// Admin API client helper for 3D GLB/GLTF models, Character Art and 3-Viewport Compound Rigging
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
// 3-VIEWPORT MESH SEGMENTER & SHOULDER-LOCKED COMPOUND RIGGING CALIBRATOR
// ─────────────────────────────────────────────────────────────────────────────
export function init3ViewportCalibrator() {
  const vpPlayerEl = document.getElementById('viewport-player');
  const vpBossEl   = document.getElementById('viewport-boss');
  const vpWeaponEl = document.getElementById('viewport-weapon');

  if (!vpPlayerEl || !vpBossEl || !vpWeaponEl) {
    console.warn('[calibrator] 3 viewports not found in DOM');
    return null;
  }

  // Active state
  let socketsData = JSON.parse(JSON.stringify(DEFAULT_SOCKETS_CONFIG));
  let currentBossElement = 'fire';
  let activeWeaponTarget = 'player'; // 'player' | 'boss'
  let isTestingSwing = false;

  // Selected Meshes
  let selectedPlayerArmMesh = null;
  let selectedBossArmMesh   = null;

  // Helper: Create a standard 3D viewport
  function createViewport(container, camPos, lookAt) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070a13);

    const w = container.clientWidth || 400;
    const h = container.clientHeight || 360;
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

    // Standard lighting
    const amb = new THREE.AmbientLight(0xffffff, 1.2);
    const dir = new THREE.DirectionalLight(0xffffff, 2.0);
    dir.position.set(5, 10, 7);
    const back = new THREE.DirectionalLight(0x00b4d8, 0.8);
    back.position.set(-5, 5, -5);
    scene.add(amb, dir, back);

    const grid = new THREE.GridHelper(8, 16, 0x00b4d8, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);

    const resizeObs = new ResizeObserver(() => {
      const rw = container.clientWidth || 400;
      const rh = container.clientHeight || 360;
      camera.aspect = rw / rh;
      camera.updateProjectionMatrix();
      renderer.setSize(rw, rh);
    });
    resizeObs.observe(container);

    return { scene, camera, renderer, controls, resizeObs };
  }

  // Create Shoulder Gizmo
  function createShoulderGizmo(colorHex = 0x00ff88) {
    const gizmo = new THREE.Group();
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

  // Helper: Find top-most vertex of a mesh in world coordinates
  function computeTopVertexWorld(mesh) {
    if (!mesh) return new THREE.Vector3(0, 0, 0);
    mesh.updateMatrixWorld(true);

    const geom = mesh.geometry;
    if (geom && geom.attributes && geom.attributes.position) {
      const posAttr = geom.attributes.position;
      const v = new THREE.Vector3();
      let maxWorldY = -Infinity;
      const topPt = new THREE.Vector3();

      for (let i = 0; i < posAttr.count; i++) {
        v.fromBufferAttribute(posAttr, i);
        v.applyMatrix4(mesh.matrixWorld);
        if (v.y > maxWorldY) {
          maxWorldY = v.y;
          topPt.copy(v);
        }
      }
      if (maxWorldY > -Infinity) return topPt;
    }

    const box = new THREE.Box3().setFromObject(mesh);
    return new THREE.Vector3((box.min.x + box.max.x) / 2, box.max.y, (box.min.z + box.max.z) / 2);
  }

  // ─── 1. Viewport 1: Player Viewport ──────────────────────────────────────────
  const vpPlayer = createViewport(vpPlayerEl, new THREE.Vector3(2.5, 2.2, 3.8), new THREE.Vector3(0, 1.2, 0));
  const playerModelHolder = new THREE.Group();
  playerModelHolder.name = 'PlayerModelHolder';
  vpPlayer.scene.add(playerModelHolder);

  const playerGizmoObj = createShoulderGizmo(0x00ff88);
  const playerGizmo = playerGizmoObj.gizmo;
  vpPlayer.scene.add(playerGizmo);

  // Player Compound Arm for Live Test Swing in Viewport 1
  const playerCompoundArm = new THREE.Group();
  playerCompoundArm.name = 'VP1_PlayerCompoundArm';
  vpPlayer.scene.add(playerCompoundArm);

  // ─── 2. Viewport 2: Boss Viewport ────────────────────────────────────────────
  const vpBoss = createViewport(vpBossEl, new THREE.Vector3(-3.5, 2.8, 5.0), new THREE.Vector3(0, 1.8, 0));
  const bossModelHolder = new THREE.Group();
  bossModelHolder.name = 'BossModelHolder';
  vpBoss.scene.add(bossModelHolder);

  const bossGizmoObj = createShoulderGizmo(0xffaa00);
  const bossGizmo = bossGizmoObj.gizmo;
  vpBoss.scene.add(bossGizmo);

  // Boss Compound Arm for Live Test Swing in Viewport 2
  const bossCompoundArm = new THREE.Group();
  bossCompoundArm.name = 'VP2_BossCompoundArm';
  vpBoss.scene.add(bossCompoundArm);

  // ─── 3. Viewport 3: Weapon Alignment & Slash Tuning ──────────────────────────
  const vpWeapon = createViewport(vpWeaponEl, new THREE.Vector3(0.0, 1.5, 3.8), new THREE.Vector3(0, 0.6, 0));
  const weaponCompoundHolder = new THREE.Group();
  weaponCompoundHolder.name = 'VP3_WeaponCompoundHolder';
  vpWeapon.scene.add(weaponCompoundHolder);

  // Arm Mesh Child & Weapon Mesh Child in VP3
  const vp3ArmHolder = new THREE.Group();
  const vp3WeaponHolder = new THREE.Group();
  weaponCompoundHolder.add(vp3ArmHolder, vp3WeaponHolder);

  // DOM Elements
  const elPlayerSegName = document.getElementById('player-segment-name');
  const elPlayerReadout = document.getElementById('player-shoulder-readout');
  const sliderPlayerSx  = document.getElementById('slider-player-sx');
  const numPlayerSx     = document.getElementById('num-player-sx');
  const valPlayerSx     = document.getElementById('val-player-sx');
  const sliderPlayerSy  = document.getElementById('slider-player-sy');
  const numPlayerSy     = document.getElementById('num-player-sy');
  const valPlayerSy     = document.getElementById('val-player-sy');
  const sliderPlayerSz  = document.getElementById('slider-player-sz');
  const numPlayerSz     = document.getElementById('num-player-sz');
  const valPlayerSz     = document.getElementById('val-player-sz');
  const btnQuickPlayer  = document.getElementById('btn-quick-arm-player');

  const elBossSegName = document.getElementById('boss-segment-name');
  const elBossReadout = document.getElementById('boss-shoulder-readout');
  const sliderBossSx  = document.getElementById('slider-boss-sx');
  const numBossSx     = document.getElementById('num-boss-sx');
  const valBossSx     = document.getElementById('val-boss-sx');
  const sliderBossSy  = document.getElementById('slider-boss-sy');
  const numBossSy     = document.getElementById('num-boss-sy');
  const valBossSy     = document.getElementById('val-boss-sy');
  const sliderBossSz  = document.getElementById('slider-boss-sz');
  const numBossSz     = document.getElementById('num-boss-sz');
  const valBossSz     = document.getElementById('val-boss-sz');
  const btnQuickBoss  = document.getElementById('btn-quick-arm-boss');

  const tabBossThunder = document.getElementById('tab-boss-thunder');
  const tabBossFire    = document.getElementById('tab-boss-fire');
  const tabBossFrost   = document.getElementById('tab-boss-frost');

  const btnTargetPlayer = document.getElementById('btn-mode-target-player');
  const btnTargetBoss   = document.getElementById('btn-mode-target-boss');

  const sliderWeaponOx    = document.getElementById('slider-weapon-ox');
  const numWeaponOx       = document.getElementById('num-weapon-ox');
  const valWeaponOx       = document.getElementById('val-weapon-ox');
  const sliderWeaponOy    = document.getElementById('slider-weapon-oy');
  const numWeaponOy       = document.getElementById('num-weapon-oy');
  const valWeaponOy       = document.getElementById('val-weapon-oy');
  const sliderWeaponOz    = document.getElementById('slider-weapon-oz');
  const numWeaponOz       = document.getElementById('num-weapon-oz');
  const valWeaponOz       = document.getElementById('val-weapon-oz');
  const sliderWeaponAngle = document.getElementById('slider-weapon-angle');
  const numWeaponAngle    = document.getElementById('num-weapon-angle');
  const valWeaponAngle    = document.getElementById('val-weapon-angle');

  const btnLockWeapon     = document.getElementById('btn-lock-weapon');
  const sliderIdleAngle   = document.getElementById('slider-idle-angle');
  const numIdleAngle      = document.getElementById('num-idle-angle');
  const valIdleAngle      = document.getElementById('val-idle-angle');
  const sliderSlashArc    = document.getElementById('slider-slash-arc');
  const numSlashArc       = document.getElementById('num-slash-arc');
  const valSlashArc       = document.getElementById('val-slash-arc');

  const btnTestSwing      = document.getElementById('btn-test-swing');
  const btnSaveRigging    = document.getElementById('btn-save-rigging');
  const statusToast       = document.getElementById('status-toast');

  // Build Preview Weapons
  function buildPreviewSword() {
    const grp = new THREE.Group();
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
    grp.add(blade, guard, grip);
    grp.scale.set(1.4, 1.4, 1.4);
    return grp;
  }

  function buildPreviewHammer() {
    const grp = new THREE.Group();
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 3.0, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 })
    );
    handle.position.set(0, 0, 0);
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 1.3, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0x882200, roughness: 0.4 })
    );
    head.position.set(0, 1.3, 0);
    grp.add(handle, head);
    grp.scale.set(0.9, 0.9, 0.9);
    return grp;
  }

  function buildPreviewArm(target) {
    const isPlayer = target === 'player';
    const geo = isPlayer ? new THREE.BoxGeometry(0.35, 1.0, 0.35) : new THREE.BoxGeometry(0.9, 2.2, 0.9);
    const mat = new THREE.MeshStandardMaterial({
      color: isPlayer ? 0x2255cc : 0x882200,
      roughness: 0.5
    });
    const arm = new THREE.Mesh(geo, mat);
    // Center arm top at local origin (0, 0, 0)
    arm.position.y = isPlayer ? -0.5 : -1.1;
    return arm;
  }

  // Update VP3 compound arm representation
  function refreshViewport3Compound() {
    while (vp3ArmHolder.children.length) vp3ArmHolder.remove(vp3ArmHolder.children[0]);
    while (vp3WeaponHolder.children.length) vp3WeaponHolder.remove(vp3WeaponHolder.children[0]);

    const isPlayer = (activeWeaponTarget === 'player');
    const armMesh = buildPreviewArm(activeWeaponTarget);
    vp3ArmHolder.add(armMesh);

    const weapon = isPlayer ? buildPreviewSword() : buildPreviewHammer();
    vp3WeaponHolder.add(weapon);

    updateVP3Transforms();
  }

  function updateVP3Transforms() {
    const isPlayer = (activeWeaponTarget === 'player');
    const targetKey = isPlayer ? 'player' : 'boss';
    const cfg = socketsData[targetKey] || {};
    const w = cfg.weapon || cfg.weaponOffset || {};

    const ox = w.offsetX ?? 0.0;
    const oy = w.offsetY ?? (isPlayer ? -0.4 : -0.6);
    const oz = w.offsetZ ?? (isPlayer ? 0.1 : 0.5);
    const angle = w.angle ?? (isPlayer ? -45 : 30);

    vp3WeaponHolder.position.set(ox, oy, oz);
    if (isPlayer) {
      vp3WeaponHolder.rotation.set(0, Math.PI / 2, (angle * Math.PI) / 180);
    } else {
      vp3WeaponHolder.rotation.set(0, -Math.PI / 2, (angle * Math.PI) / 180);
    }
  }

  // Fallback characters if GLB fails
  function buildProceduralPlayer() {
    const grp = new THREE.Group();
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.2, 0.5), new THREE.MeshStandardMaterial({ color: 0x2255cc }));
    torso.position.y = 1.3;
    torso.name = 'Torso';

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xf5c4a0 }));
    head.position.y = 2.3;
    head.name = 'Head';

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), new THREE.MeshStandardMaterial({ color: 0xf5c4a0 }));
    armL.position.set(-0.65, 1.2, 0);
    armL.name = 'Arm_L';

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.0, 0.35), new THREE.MeshStandardMaterial({ color: 0xf5c4a0 }));
    armR.position.set(0.65, 1.2, 0);
    armR.name = 'Arm_R';

    grp.add(torso, head, armL, armR);
    return grp;
  }

  function buildProceduralBoss(el) {
    const grp = new THREE.Group();
    const bodyCol = el === 'frost' ? 0x0088cc : el === 'thunder' ? 0x00aacc : 0x882200;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 1.2), new THREE.MeshStandardMaterial({ color: bodyCol }));
    torso.position.y = 2.2;
    torso.name = 'Boss_Torso';

    const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), new THREE.MeshStandardMaterial({ color: bodyCol }));
    head.position.y = 4.2;
    head.name = 'Boss_Head';

    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), new THREE.MeshStandardMaterial({ color: bodyCol }));
    armL.position.set(1.8, 2.2, 0);
    armL.name = 'Boss_Arm_L';

    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.4, 0.9), new THREE.MeshStandardMaterial({ color: bodyCol }));
    armR.position.set(-1.8, 2.2, 0);
    armR.name = 'Boss_Arm_R';

    grp.add(torso, head, armL, armR);
    return grp;
  }

  // Load 3D Models
  async function loadPlayerModel() {
    while (playerModelHolder.children.length) playerModelHolder.remove(playerModelHolder.children[0]);
    let loaded = false;
    try {
      const gltf = await new Promise(resolve => gltfLoader.load('/assets/models/default_character.glb', resolve, undefined, () => resolve(null)));
      if (gltf && gltf.scene) {
        const model = gltf.scene;
        model.traverse(c => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
            if (c.material) c.material = c.material.clone();
          }
        });
        const bBox = new THREE.Box3().setFromObject(model);
        const bSize = new THREE.Vector3();
        bBox.getSize(bSize);
        if (bSize.y > 0.01) {
          model.scale.setScalar(2.8 / bSize.y);
        }
        const sBox = new THREE.Box3().setFromObject(model);
        model.position.x = - (sBox.min.x + sBox.max.x) / 2;
        model.position.z = - (sBox.min.z + sBox.max.z) / 2;
        model.position.y = - sBox.min.y;
        playerModelHolder.add(model);
        loaded = true;
      }
    } catch (e) {}

    if (!loaded) {
      playerModelHolder.add(buildProceduralPlayer());
    }

    // Auto locate saved arm or LeftArm
    selectPlayerArmByName(socketsData.player?.armMeshName || 'Arm_L');
  }

  async function loadBossModel(element = 'fire') {
    currentBossElement = element;
    while (bossModelHolder.children.length) bossModelHolder.remove(bossModelHolder.children[0]);

    let loaded = false;
    try {
      const gltf = await new Promise(resolve => gltfLoader.load(`/assets/models/boss_${element}.glb`, resolve, undefined, () => resolve(null)));
      if (gltf && gltf.scene) {
        const model = gltf.scene;
        model.traverse(c => {
          if (c.isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
            if (c.material) c.material = c.material.clone();
          }
        });
        const bBox = new THREE.Box3().setFromObject(model);
        const bSize = new THREE.Vector3();
        bBox.getSize(bSize);
        if (bSize.y > 0.01) {
          model.scale.setScalar(4.0 / bSize.y);
        }
        const sBox = new THREE.Box3().setFromObject(model);
        model.position.x = - (sBox.min.x + sBox.max.x) / 2;
        model.position.z = - (sBox.min.z + sBox.max.z) / 2;
        model.position.y = - sBox.min.y;
        bossModelHolder.add(model);
        loaded = true;
      }
    } catch (e) {}

    if (!loaded) {
      bossModelHolder.add(buildProceduralBoss(element));
    }

    selectBossArmByName(socketsData.boss?.armMeshName || 'Arm_R');
  }

  // ─── Raycasting & Mesh Segment Highlighting ──────────────────────────────────
  function setupRaycasting(viewport, modelHolder, onMeshSelected) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredMesh = null;
    let prevEmissive = 0x000000;
    let pDownTime = 0;
    let pDownPos = { x: 0, y: 0 };

    viewport.renderer.domElement.addEventListener('pointermove', (e) => {
      const rect = viewport.renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, viewport.camera);
      const hits = raycaster.intersectObjects(modelHolder.children, true);

      if (hits.length > 0) {
        const hit = hits.find(h => h.object.isMesh);
        if (hit && hit.object !== hoveredMesh) {
          // Restore previous
          if (hoveredMesh && hoveredMesh.material && hoveredMesh.material.emissive) {
            hoveredMesh.material.emissive.setHex(prevEmissive);
          }
          hoveredMesh = hit.object;
          if (hoveredMesh.material && hoveredMesh.material.emissive) {
            prevEmissive = hoveredMesh.material.emissive.getHex();
            hoveredMesh.material.emissive.setHex(0x00d4ff);
          }
        }
      } else {
        if (hoveredMesh && hoveredMesh.material && hoveredMesh.material.emissive) {
          hoveredMesh.material.emissive.setHex(prevEmissive);
          hoveredMesh = null;
        }
      }
    });

    viewport.renderer.domElement.addEventListener('pointerdown', (e) => {
      pDownTime = performance.now();
      pDownPos = { x: e.clientX, y: e.clientY };
    });

    viewport.renderer.domElement.addEventListener('pointerup', (e) => {
      const elapsed = performance.now() - pDownTime;
      const dist = Math.hypot(e.clientX - pDownPos.x, e.clientY - pDownPos.y);

      if (elapsed < 320 && dist < 6) {
        const rect = viewport.renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, viewport.camera);
        const hits = raycaster.intersectObjects(modelHolder.children, true);
        const hit = hits.find(h => h.object.isMesh);
        if (hit) {
          onMeshSelected(hit.object);
        }
      }
    });
  }

  // Player Mesh Selection Handler
  function selectPlayerArm(mesh) {
    if (!mesh) return;
    if (selectedPlayerArmMesh && selectedPlayerArmMesh.material?.emissive) {
      selectedPlayerArmMesh.material.emissive.setHex(0x000000);
    }
    selectedPlayerArmMesh = mesh;
    if (mesh.material && mesh.material.emissive) {
      mesh.material.emissive.setHex(0x00ff88);
    }

    const topWorldPt = computeTopVertexWorld(mesh);
    const name = mesh.name || 'Arm_L';

    socketsData.player.armMeshName = name;
    socketsData.player.shoulderPivot = {
      x: Math.round(topWorldPt.x * 100) / 100,
      y: Math.round(topWorldPt.y * 100) / 100,
      z: Math.round(topWorldPt.z * 100) / 100
    };
    socketsData.player.shoulderX = socketsData.player.shoulderPivot.x;
    socketsData.player.shoulderY = socketsData.player.shoulderPivot.y;
    socketsData.player.shoulderZ = socketsData.player.shoulderPivot.z;

    updatePlayerControlsUI();
    updatePlayerGizmo();
  }

  function selectPlayerArmByName(name) {
    let match = null;
    playerModelHolder.traverse(c => {
      if (!match && c.isMesh) {
        const n = (c.name || '').toLowerCase();
        if (n.includes('arm_l') || n.includes('leftarm') || n.includes('hand_l') || n === name.toLowerCase()) {
          match = c;
        }
      }
    });
    if (match) selectPlayerArm(match);
    else updatePlayerGizmo();
  }

  // Boss Mesh Selection Handler
  function selectBossArm(mesh) {
    if (!mesh) return;
    if (selectedBossArmMesh && selectedBossArmMesh.material?.emissive) {
      selectedBossArmMesh.material.emissive.setHex(0x000000);
    }
    selectedBossArmMesh = mesh;
    if (mesh.material && mesh.material.emissive) {
      mesh.material.emissive.setHex(0xffaa00);
    }

    const topWorldPt = computeTopVertexWorld(mesh);
    const name = mesh.name || 'Arm_R';

    socketsData.boss.armMeshName = name;
    socketsData.boss.shoulderPivot = {
      x: Math.round(topWorldPt.x * 100) / 100,
      y: Math.round(topWorldPt.y * 100) / 100,
      z: Math.round(topWorldPt.z * 100) / 100
    };
    socketsData.boss.shoulderX = socketsData.boss.shoulderPivot.x;
    socketsData.boss.shoulderY = socketsData.boss.shoulderPivot.y;
    socketsData.boss.shoulderZ = socketsData.boss.shoulderPivot.z;

    updateBossControlsUI();
    updateBossGizmo();
  }

  function selectBossArmByName(name) {
    let match = null;
    bossModelHolder.traverse(c => {
      if (!match && c.isMesh) {
        const n = (c.name || '').toLowerCase();
        if (n.includes('arm_r') || n.includes('rightarm') || n.includes('hand_r') || n === name.toLowerCase()) {
          match = c;
        }
      }
    });
    if (match) selectBossArm(match);
    else updateBossGizmo();
  }

  // Gizmo & Transforms
  function updatePlayerGizmo() {
    const p = socketsData.player.shoulderPivot || { x: -0.65, y: 1.2, z: 0.0 };
    playerGizmo.position.set(p.x, p.y, p.z);
    playerCompoundArm.position.set(p.x, p.y, p.z);
  }

  function updateBossGizmo() {
    const p = socketsData.boss.shoulderPivot || { x: -1.8, y: 2.2, z: 0.2 };
    bossGizmo.position.set(p.x, p.y, p.z);
    bossCompoundArm.position.set(p.x, p.y, p.z);
  }

  // Update Controls UI from State
  function updatePlayerControlsUI() {
    const p = socketsData.player.shoulderPivot || { x: -0.65, y: 1.2, z: 0.0 };
    const name = socketsData.player.armMeshName || 'Arm_L';

    if (elPlayerSegName) elPlayerSegName.textContent = name;
    if (elPlayerReadout) elPlayerReadout.textContent = `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;

    if (sliderPlayerSx) sliderPlayerSx.value = p.x;
    if (numPlayerSx)    numPlayerSx.value = p.x.toFixed(2);
    if (valPlayerSx)    valPlayerSx.textContent = p.x.toFixed(2);

    if (sliderPlayerSy) sliderPlayerSy.value = p.y;
    if (numPlayerSy)    numPlayerSy.value = p.y.toFixed(2);
    if (valPlayerSy)    valPlayerSy.textContent = p.y.toFixed(2);

    if (sliderPlayerSz) sliderPlayerSz.value = p.z;
    if (numPlayerSz)    numPlayerSz.value = p.z.toFixed(2);
    if (valPlayerSz)    valPlayerSz.textContent = p.z.toFixed(2);
  }

  function updateBossControlsUI() {
    const p = socketsData.boss.shoulderPivot || { x: -1.8, y: 2.2, z: 0.2 };
    const name = socketsData.boss.armMeshName || 'Arm_R';

    if (elBossSegName) elBossSegName.textContent = name;
    if (elBossReadout) elBossReadout.textContent = `(${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)})`;

    if (sliderBossSx) sliderBossSx.value = p.x;
    if (numBossSx)    numBossSx.value = p.x.toFixed(2);
    if (valBossSx)    valBossSx.textContent = p.x.toFixed(2);

    if (sliderBossSy) sliderBossSy.value = p.y;
    if (numBossSy)    numBossSy.value = p.y.toFixed(2);
    if (valBossSy)    valBossSy.textContent = p.y.toFixed(2);

    if (sliderBossSz) sliderBossSz.value = p.z;
    if (numBossSz)    numBossSz.value = p.z.toFixed(2);
    if (valBossSz)    valBossSz.textContent = p.z.toFixed(2);
  }

  function updateWeaponControlsUI() {
    const targetKey = activeWeaponTarget;
    const cfg = socketsData[targetKey] || {};
    const w = cfg.weapon || cfg.weaponOffset || {};
    const s = cfg.slashArc || {};

    const ox = w.offsetX ?? 0.0;
    const oy = w.offsetY ?? (targetKey === 'player' ? -0.4 : -0.6);
    const oz = w.offsetZ ?? (targetKey === 'player' ? 0.1 : 0.5);
    const angle = w.angle ?? (targetKey === 'player' ? -45 : 30);

    const idle = s.idleAngle ?? 0;
    const arc  = s.arc ?? (targetKey === 'player' ? 135 : 160);

    if (sliderWeaponOx) sliderWeaponOx.value = ox;
    if (numWeaponOx)    numWeaponOx.value = ox.toFixed(2);
    if (valWeaponOx)    valWeaponOx.textContent = ox.toFixed(2);

    if (sliderWeaponOy) sliderWeaponOy.value = oy;
    if (numWeaponOy)    numWeaponOy.value = oy.toFixed(2);
    if (valWeaponOy)    valWeaponOy.textContent = oy.toFixed(2);

    if (sliderWeaponOz) sliderWeaponOz.value = oz;
    if (numWeaponOz)    numWeaponOz.value = oz.toFixed(2);
    if (valWeaponOz)    valWeaponOz.textContent = oz.toFixed(2);

    if (sliderWeaponAngle) sliderWeaponAngle.value = angle;
    if (numWeaponAngle)    numWeaponAngle.value = Math.round(angle);
    if (valWeaponAngle)    valWeaponAngle.textContent = `${Math.round(angle)}°`;

    if (sliderIdleAngle) sliderIdleAngle.value = idle;
    if (numIdleAngle)    numIdleAngle.value = Math.round(idle);
    if (valIdleAngle)    valIdleAngle.textContent = `${Math.round(idle)}°`;

    if (sliderSlashArc) sliderSlashArc.value = arc;
    if (numSlashArc)    numSlashArc.value = Math.round(arc);
    if (valSlashArc)    valSlashArc.textContent = `${Math.round(arc)}°`;

    refreshViewport3Compound();
  }

  // Setup raycasters
  setupRaycasting(vpPlayer, playerModelHolder, selectPlayerArm);
  setupRaycasting(vpBoss, bossModelHolder, selectBossArm);

  // Manual Player Shoulder Sliders
  function onPlayerSliderChanged() {
    const x = parseFloat(sliderPlayerSx.value || 0);
    const y = parseFloat(sliderPlayerSy.value || 0);
    const z = parseFloat(sliderPlayerSz.value || 0);

    socketsData.player.shoulderPivot = { x, y, z };
    socketsData.player.shoulderX = x;
    socketsData.player.shoulderY = y;
    socketsData.player.shoulderZ = z;

    updatePlayerControlsUI();
    updatePlayerGizmo();
  }

  sliderPlayerSx?.addEventListener('input', onPlayerSliderChanged);
  sliderPlayerSy?.addEventListener('input', onPlayerSliderChanged);
  sliderPlayerSz?.addEventListener('input', onPlayerSliderChanged);
  numPlayerSx?.addEventListener('change', () => { sliderPlayerSx.value = numPlayerSx.value; onPlayerSliderChanged(); });
  numPlayerSy?.addEventListener('change', () => { sliderPlayerSy.value = numPlayerSy.value; onPlayerSliderChanged(); });
  numPlayerSz?.addEventListener('change', () => { sliderPlayerSz.value = numPlayerSz.value; onPlayerSliderChanged(); });

  btnQuickPlayer?.addEventListener('click', () => selectPlayerArmByName('Arm_L'));

  // Manual Boss Shoulder Sliders
  function onBossSliderChanged() {
    const x = parseFloat(sliderBossSx.value || 0);
    const y = parseFloat(sliderBossSy.value || 0);
    const z = parseFloat(sliderBossSz.value || 0);

    socketsData.boss.shoulderPivot = { x, y, z };
    socketsData.boss.shoulderX = x;
    socketsData.boss.shoulderY = y;
    socketsData.boss.shoulderZ = z;

    updateBossControlsUI();
    updateBossGizmo();
  }

  sliderBossSx?.addEventListener('input', onBossSliderChanged);
  sliderBossSy?.addEventListener('input', onBossSliderChanged);
  sliderBossSz?.addEventListener('input', onBossSliderChanged);
  numBossSx?.addEventListener('change', () => { sliderBossSx.value = numBossSx.value; onBossSliderChanged(); });
  numBossSy?.addEventListener('change', () => { sliderBossSy.value = numBossSy.value; onBossSliderChanged(); });
  numBossSz?.addEventListener('change', () => { sliderBossSz.value = numBossSz.value; onBossSliderChanged(); });

  btnQuickBoss?.addEventListener('click', () => selectBossArmByName('Arm_R'));

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

  // Weapon Target Switcher
  function setWeaponTarget(target) {
    activeWeaponTarget = target;
    btnTargetPlayer?.classList.toggle('active', target === 'player');
    btnTargetBoss?.classList.toggle('active', target === 'boss');
    updateWeaponControlsUI();
  }
  btnTargetPlayer?.addEventListener('click', () => setWeaponTarget('player'));
  btnTargetBoss?.addEventListener('click', () => setWeaponTarget('boss'));

  // Weapon Offset & Slash Arc Sliders
  function onWeaponSliderChanged() {
    const targetKey = activeWeaponTarget;
    if (!socketsData[targetKey]) socketsData[targetKey] = {};
    if (!socketsData[targetKey].weapon) socketsData[targetKey].weapon = {};

    const ox = parseFloat(sliderWeaponOx.value || 0);
    const oy = parseFloat(sliderWeaponOy.value || 0);
    const oz = parseFloat(sliderWeaponOz.value || 0);
    const angle = parseFloat(sliderWeaponAngle.value || 0);

    socketsData[targetKey].weapon.offsetX = ox;
    socketsData[targetKey].weapon.offsetY = oy;
    socketsData[targetKey].weapon.offsetZ = oz;
    socketsData[targetKey].weapon.angle = angle;
    socketsData[targetKey].weapon.rotX = 0;
    socketsData[targetKey].weapon.rotY = targetKey === 'player' ? Math.PI / 2 : -Math.PI / 2;
    socketsData[targetKey].weapon.rotZ = (angle * Math.PI) / 180;
    socketsData[targetKey].weaponOffset = { ...socketsData[targetKey].weapon };

    if (valWeaponOx) valWeaponOx.textContent = ox.toFixed(2);
    if (numWeaponOx) numWeaponOx.value = ox.toFixed(2);
    if (valWeaponOy) valWeaponOy.textContent = oy.toFixed(2);
    if (numWeaponOy) numWeaponOy.value = oy.toFixed(2);
    if (valWeaponOz) valWeaponOz.textContent = oz.toFixed(2);
    if (numWeaponOz) numWeaponOz.value = oz.toFixed(2);
    if (valWeaponAngle) valWeaponAngle.textContent = `${Math.round(angle)}°`;
    if (numWeaponAngle) numWeaponAngle.value = Math.round(angle);

    updateVP3Transforms();
  }

  sliderWeaponOx?.addEventListener('input', onWeaponSliderChanged);
  sliderWeaponOy?.addEventListener('input', onWeaponSliderChanged);
  sliderWeaponOz?.addEventListener('input', onWeaponSliderChanged);
  sliderWeaponAngle?.addEventListener('input', onWeaponSliderChanged);

  numWeaponOx?.addEventListener('change', () => { sliderWeaponOx.value = numWeaponOx.value; onWeaponSliderChanged(); });
  numWeaponOy?.addEventListener('change', () => { sliderWeaponOy.value = numWeaponOy.value; onWeaponSliderChanged(); });
  numWeaponOz?.addEventListener('change', () => { sliderWeaponOz.value = numWeaponOz.value; onWeaponSliderChanged(); });
  numWeaponAngle?.addEventListener('change', () => { sliderWeaponAngle.value = numWeaponAngle.value; onWeaponSliderChanged(); });

  function onSlashTuningChanged() {
    const targetKey = activeWeaponTarget;
    if (!socketsData[targetKey]) socketsData[targetKey] = {};
    if (!socketsData[targetKey].slashArc) socketsData[targetKey].slashArc = {};

    const idle = parseFloat(sliderIdleAngle.value || 0);
    const arc  = parseFloat(sliderSlashArc.value || 135);

    const windup = idle + (targetKey === 'player' ? arc * 0.45 : arc * 0.5);
    const slash  = idle - (targetKey === 'player' ? arc * 0.55 : arc * 0.5);

    socketsData[targetKey].slashArc = {
      idleAngle: idle,
      windupAngle: windup,
      slashAngle: slash,
      arc: arc
    };

    if (valIdleAngle) valIdleAngle.textContent = `${Math.round(idle)}°`;
    if (numIdleAngle) numIdleAngle.value = Math.round(idle);
    if (valSlashArc) valSlashArc.textContent = `${Math.round(arc)}°`;
    if (numSlashArc) numSlashArc.value = Math.round(arc);
  }

  sliderIdleAngle?.addEventListener('input', onSlashTuningChanged);
  sliderSlashArc?.addEventListener('input', onSlashTuningChanged);
  numIdleAngle?.addEventListener('change', () => { sliderIdleAngle.value = numIdleAngle.value; onSlashTuningChanged(); });
  numSlashArc?.addEventListener('change', () => { sliderSlashArc.value = numSlashArc.value; onSlashTuningChanged(); });

  // Button: [🔒 Khóa Cứng Vũ Khí Vào Tay]
  btnLockWeapon?.addEventListener('click', () => {
    onWeaponSliderChanged();
    onSlashTuningChanged();

    // Visual feedback
    if (statusToast) {
      statusToast.className = 'status-toast success';
      statusToast.innerHTML = `🔒 <b>Đã khóa cứng vũ khí vào cánh tay</b> (${activeWeaponTarget === 'player' ? 'Nhân vật' : 'Boss'})!`;
      statusToast.style.display = 'block';
      setTimeout(() => { statusToast.style.display = 'none'; }, 3000);
    }
  });

  // Button: [⚔️ Vung Thử (Test Swing)]
  function playTestSwing() {
    if (isTestingSwing) return;
    isTestingSwing = true;

    const isPlayer = (activeWeaponTarget === 'player');
    const targetKey = isPlayer ? 'player' : 'boss';
    const s = socketsData[targetKey]?.slashArc || {};
    const idleAngleRad = ((s.idleAngle ?? 0) * Math.PI) / 180;
    const windupAngleRad = ((s.windupAngle ?? (isPlayer ? 60 : 80)) * Math.PI) / 180;
    const strikeAngleRad = ((s.slashAngle ?? (isPlayer ? -75 : -80)) * Math.PI) / 180;

    const startTime = performance.now();
    const dur1 = isPlayer ? 100 : 160;
    const dur2 = isPlayer ? 120 : 130;
    const dur3 = isPlayer ? 100 : 150;

    function step(now) {
      const elapsed = now - startTime;
      let curAngle = idleAngleRad;

      if (elapsed < dur1) {
        const t = elapsed / dur1;
        curAngle = THREE.MathUtils.lerp(idleAngleRad, windupAngleRad, t * t);
        requestAnimationFrame(step);
      } else if (elapsed < dur1 + dur2) {
        const t = (elapsed - dur1) / dur2;
        curAngle = THREE.MathUtils.lerp(windupAngleRad, strikeAngleRad, t * t);
        requestAnimationFrame(step);
      } else if (elapsed < dur1 + dur2 + dur3) {
        const t = (elapsed - (dur1 + dur2)) / dur3;
        curAngle = THREE.MathUtils.lerp(strikeAngleRad, idleAngleRad, 1 - (1 - t) * (1 - t));
        requestAnimationFrame(step);
      } else {
        curAngle = idleAngleRad;
        isTestingSwing = false;
      }

      // Rotate in Viewport 3
      weaponCompoundHolder.rotation.z = curAngle;

      // Rotate in Viewport 1 or 2
      if (isPlayer) {
        playerCompoundArm.rotation.z = curAngle;
      } else {
        bossCompoundArm.rotation.z = curAngle;
      }
    }
    requestAnimationFrame(step);
  }

  btnTestSwing?.addEventListener('click', playTestSwing);

  // Button: [💾 Lưu Cấu Hình Khớp & Đòn Chém]
  btnSaveRigging?.addEventListener('click', async () => {
    try {
      btnSaveRigging.disabled = true;
      btnSaveRigging.innerHTML = '<span>⏳</span> Đang lưu...';

      // Save active target rigging
      const targetKey = activeWeaponTarget;
      const targetConfig = socketsData[targetKey];

      const payload = {
        target: targetKey,
        armMeshName: targetConfig.armMeshName,
        shoulderPivot: targetConfig.shoulderPivot,
        weaponOffset: targetConfig.weapon,
        slashArc: targetConfig.slashArc
      };

      const res = await saveRigging(payload);
      btnSaveRigging.disabled = false;
      btnSaveRigging.innerHTML = '<span>💾</span> LƯU CẤU HÌNH KHỚP &amp; ĐÒN CHÉM';

      if (statusToast) {
        statusToast.className = 'status-toast success';
        statusToast.innerHTML = `✓ ${res.message || 'Đã lưu cấu hình khớp & đòn chém thành công!'}`;
        statusToast.style.display = 'block';
        setTimeout(() => { statusToast.style.display = 'none'; }, 4000);
      }

      window.dispatchEvent(new CustomEvent('sockets-updated', { detail: res.sockets || res.config }));
    } catch (err) {
      btnSaveRigging.disabled = false;
      btnSaveRigging.innerHTML = '<span>💾</span> LƯU CẤU HÌNH KHỚP &amp; ĐÒN CHÉM';
      if (statusToast) {
        statusToast.className = 'status-toast error';
        statusToast.textContent = 'Lỗi khi lưu: ' + err.message;
        statusToast.style.display = 'block';
      }
    }
  });

  // Animation Loop across all 3 viewports
  let animId = null;
  function animate() {
    animId = requestAnimationFrame(animate);

    vpPlayer.controls.update();
    vpBoss.controls.update();
    vpWeapon.controls.update();

    // Pulse gizmos subtly
    const t = Date.now() * 0.003;
    playerGizmoObj.ringX.scale.setScalar(1 + Math.sin(t) * 0.12);
    playerGizmoObj.ringY.scale.setScalar(1 + Math.cos(t) * 0.12);
    bossGizmoObj.ringX.scale.setScalar(1 + Math.sin(t) * 0.12);
    bossGizmoObj.ringY.scale.setScalar(1 + Math.cos(t) * 0.12);

    vpPlayer.renderer.render(vpPlayer.scene, vpPlayer.camera);
    vpBoss.renderer.render(vpBoss.scene, vpBoss.camera);
    vpWeapon.renderer.render(vpWeapon.scene, vpWeapon.camera);
  }
  animate();

  // Load configuration from backend
  fetchRigging().then(cfg => {
    if (cfg && typeof cfg === 'object') {
      socketsData = {
        player: { ...DEFAULT_SOCKETS_CONFIG.player, ...(cfg.player || {}) },
        boss:   { ...DEFAULT_SOCKETS_CONFIG.boss,   ...(cfg.boss || {}) },
        weapon: { ...DEFAULT_SOCKETS_CONFIG.weapon, ...(cfg.weapon || {}) },
      };
      updatePlayerControlsUI();
      updateBossControlsUI();
      updateWeaponControlsUI();
      updatePlayerGizmo();
      updateBossGizmo();
    }
  }).catch(() => {});

  loadPlayerModel();
  loadBossModel('fire');
  updateWeaponControlsUI();

  return {
    destroy: () => {
      cancelAnimationFrame(animId);
      vpPlayer.resizeObs.disconnect();
      vpBoss.resizeObs.disconnect();
      vpWeapon.resizeObs.disconnect();
      vpPlayer.renderer.dispose();
      vpBoss.renderer.dispose();
      vpWeapon.renderer.dispose();
    },
    playTestSwing
  };
}

// Backwards-compatible init functions
export function initVisualSocketCalibrator(opts = {}) {
  // If called without specific container or for standalone 3-viewport mode
  if (document.getElementById('viewport-player') && document.getElementById('viewport-boss')) {
    return init3ViewportCalibrator();
  }
  return null;
}

export function initStandaloneCalibrator() {
  return init3ViewportCalibrator();
}
