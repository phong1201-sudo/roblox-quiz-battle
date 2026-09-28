// Admin API client helper for 3D GLB/GLTF models, Character Art and 3D Brush Highlighter Calibrator
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

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
export function initBrushCalibrator() { return null; }
export function init3ViewportCalibrator() { return null; }
export function initVisualSocketCalibrator(opts = {}) { return null; }
export function initStandaloneCalibrator() { return null; }

// ─────────────────────────────────────────────────────────────────────────────
// 2D SKELETAL RIGGING UI (META ANIMATED DRAWINGS STYLE)
// ─────────────────────────────────────────────────────────────────────────────
export function initSkeletonCalibrator() {
  const container = document.getElementById('skeleton-three-container');
  const canvas = document.getElementById('skeleton-canvas');
  const img = document.getElementById('skeleton-target-img');
  if (!canvas || !img || !container) return null;

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

  const BONE_KEYS = [
    'hip', 'torso', 'neck', 'head',
    'l_shoulder', 'l_elbow', 'l_hand',
    'r_shoulder', 'r_elbow', 'r_hand',
    'l_knee', 'l_foot', 'r_knee', 'r_foot'
  ];

  const characterWidth = 2.4;
  const characterHeight = 3.2;

  let activeDragNode = null;
  let hoveredNode = null;
  let isTestingSlash = false;

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

  // ── Three.js Scene Setup ─────────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a13);

  const initW = container.clientWidth || 480;
  const initH = container.clientHeight || 580;

  const camera = new THREE.PerspectiveCamera(45, initW / initH, 0.1, 100);
  camera.position.set(0, 0, 5.2);
  camera.lookAt(0, 0, 0);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambientLight);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(initW, initH);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  let currentTexture = null;
  let skinnedMesh = null;
  let skeleton = null;
  let boneMap = {};
  let weaponMesh = null;

  function normToLocal(nx, ny) {
    return {
      x: (nx - 0.5) * characterWidth,
      y: (0.5 - ny) * characterHeight,
      z: 0
    };
  }

  const _vProj = new THREE.Vector3();
  function worldToCanvas(worldPos) {
    _vProj.copy(worldPos);
    _vProj.project(camera);
    return {
      x: (_vProj.x * 0.5 + 0.5) * canvas.width,
      y: (-_vProj.y * 0.5 + 0.5) * canvas.height
    };
  }

  const _raycaster = new THREE.Raycaster();
  const _planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const _mouseNDC = new THREE.Vector2();
  const _intersectPoint = new THREE.Vector3();

  function canvasToNorm(cx, cy) {
    const rect = canvas.getBoundingClientRect();
    _mouseNDC.x = (cx / rect.width) * 2 - 1;
    _mouseNDC.y = - (cy / rect.height) * 2 + 1;
    _raycaster.setFromCamera(_mouseNDC, camera);
    if (_raycaster.ray.intersectPlane(_planeZ, _intersectPoint)) {
      const nx = _intersectPoint.x / characterWidth + 0.5;
      const ny = 0.5 - _intersectPoint.y / characterHeight;
      return {
        x: Math.max(0.01, Math.min(0.99, Math.round(nx * 1000) / 1000)),
        y: Math.max(0.01, Math.min(0.99, Math.round(ny * 1000) / 1000))
      };
    }
    return {
      x: Math.max(0.01, Math.min(0.99, cx / rect.width)),
      y: Math.max(0.01, Math.min(0.99, cy / rect.height))
    };
  }

  // ── 2D SkinnedMesh Builder with Linear Blend Skinning (LBS) ───────────────────
  function buildSkinnedMesh(texture, weaponTex) {
    if (skinnedMesh) {
      scene.remove(skinnedMesh);
      if (skinnedMesh.geometry) skinnedMesh.geometry.dispose();
      skinnedMesh = null;
    }

    const geometry = new THREE.PlaneGeometry(characterWidth, characterHeight, 32, 32);

    const boneLocs = {};
    for (const k of BONE_KEYS) {
      const n = skeletonData.nodes[k] || DEFAULT_SKELETON.nodes[k] || { x: 0.5, y: 0.5 };
      boneLocs[k] = normToLocal(n.x, n.y);
    }

    boneMap = {};
    const bonesArray = [];
    for (const k of BONE_KEYS) {
      const bone = new THREE.Bone();
      bone.name = 'Bone_' + k;
      boneMap[k] = bone;
      bonesArray.push(bone);
    }

    boneMap.hip.position.set(boneLocs.hip.x, boneLocs.hip.y, 0);

    function attachChild(parentKey, childKey) {
      const pBone = boneMap[parentKey];
      const cBone = boneMap[childKey];
      cBone.position.set(
        boneLocs[childKey].x - boneLocs[parentKey].x,
        boneLocs[childKey].y - boneLocs[parentKey].y,
        0
      );
      pBone.add(cBone);
    }

    attachChild('hip', 'torso');
    attachChild('torso', 'neck');
    attachChild('neck', 'head');

    attachChild('neck', 'l_shoulder');
    attachChild('l_shoulder', 'l_elbow');
    attachChild('l_elbow', 'l_hand');

    attachChild('neck', 'r_shoulder');
    attachChild('r_shoulder', 'r_elbow');
    attachChild('r_elbow', 'r_hand');

    attachChild('hip', 'l_knee');
    attachChild('l_knee', 'l_foot');

    attachChild('hip', 'r_knee');
    attachChild('r_knee', 'r_foot');

    function distToSegment(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq === 0) return Math.hypot(px - x1, py - y1);
      let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    function getDistToBone(boneKey, vx, vy) {
      switch (boneKey) {
        case 'r_shoulder':
          return distToSegment(vx, vy, boneLocs.r_shoulder.x, boneLocs.r_shoulder.y, boneLocs.r_elbow.x, boneLocs.r_elbow.y);
        case 'r_elbow':
          return distToSegment(vx, vy, boneLocs.r_elbow.x, boneLocs.r_elbow.y, boneLocs.r_hand.x, boneLocs.r_hand.y);
        case 'r_hand':
          return Math.hypot(vx - boneLocs.r_hand.x, vy - boneLocs.r_hand.y);
        case 'l_shoulder':
          return distToSegment(vx, vy, boneLocs.l_shoulder.x, boneLocs.l_shoulder.y, boneLocs.l_elbow.x, boneLocs.l_elbow.y);
        case 'l_elbow':
          return distToSegment(vx, vy, boneLocs.l_elbow.x, boneLocs.l_elbow.y, boneLocs.l_hand.x, boneLocs.l_hand.y);
        case 'l_hand':
          return Math.hypot(vx - boneLocs.l_hand.x, vy - boneLocs.l_hand.y);
        case 'head':
          return distToSegment(vx, vy, boneLocs.neck.x, boneLocs.neck.y, boneLocs.head.x, boneLocs.head.y);
        case 'neck':
          return Math.hypot(vx - boneLocs.neck.x, vy - boneLocs.neck.y);
        case 'torso':
          return Math.min(
            distToSegment(vx, vy, boneLocs.hip.x, boneLocs.hip.y, boneLocs.torso.x, boneLocs.torso.y),
            distToSegment(vx, vy, boneLocs.torso.x, boneLocs.torso.y, boneLocs.neck.x, boneLocs.neck.y)
          );
        case 'hip':
          return Math.hypot(vx - boneLocs.hip.x, vy - boneLocs.hip.y);
        case 'l_knee':
          return distToSegment(vx, vy, boneLocs.hip.x, boneLocs.hip.y, boneLocs.l_knee.x, boneLocs.l_knee.y);
        case 'l_foot':
          return distToSegment(vx, vy, boneLocs.l_knee.x, boneLocs.l_knee.y, boneLocs.l_foot.x, boneLocs.l_foot.y);
        case 'r_knee':
          return distToSegment(vx, vy, boneLocs.hip.x, boneLocs.hip.y, boneLocs.r_knee.x, boneLocs.r_knee.y);
        case 'r_foot':
          return distToSegment(vx, vy, boneLocs.r_knee.x, boneLocs.r_knee.y, boneLocs.r_foot.x, boneLocs.r_foot.y);
        default:
          return Math.hypot(vx - boneLocs[boneKey].x, vy - boneLocs[boneKey].y);
      }
    }

    const posAttr = geometry.attributes.position;
    const skinIndices = [];
    const skinWeights = [];

    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);

      const distList = [];
      for (let b = 0; b < BONE_KEYS.length; b++) {
        const k = BONE_KEYS[b];
        const d = getDistToBone(k, vx, vy);
        distList.push({ index: b, dist: d });
      }
      distList.sort((a, b) => a.dist - b.dist);

      const b0 = distList[0].index;
      const d0 = distList[0].dist;
      const b1 = distList[1].index;
      const d1 = distList[1].dist;

      const w0 = 1.0 / Math.pow(Math.max(d0, 0.025), 3.0);
      const w1 = 1.0 / Math.pow(Math.max(d1, 0.025), 3.0);
      const sum = w0 + w1;

      skinIndices.push(b0, b1, 0, 0);
      skinWeights.push(w0 / sum, w1 / sum, 0, 0);
    }

    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      alphaTest: 0.05
    });

    skinnedMesh = new THREE.SkinnedMesh(geometry, material);
    skinnedMesh.add(boneMap.hip);
    skinnedMesh.updateMatrixWorld(true);

    skeleton = new THREE.Skeleton(bonesArray);
    skeleton.calculateInverses();
    skinnedMesh.bind(skeleton);

    // Attach 2D sword to r_hand
    const weaponWidth = 0.85;
    const weaponHeight = 2.2;
    const wGeo = new THREE.PlaneGeometry(weaponWidth, weaponHeight);
    wGeo.translate(0, weaponHeight / 2, 0);
    const wMat = new THREE.MeshBasicMaterial({
      color: 0xff4400,
      transparent: true,
      side: THREE.DoubleSide
    });
    new THREE.TextureLoader().load('/assets/characters/fireblade(cho%20game)_weapon.png', (wTex) => {
      wMat.map = wTex;
      wMat.color.setHex(0xffffff);
      wMat.needsUpdate = true;
    }, undefined, () => {});

    weaponMesh = new THREE.Mesh(wGeo, wMat);
    weaponMesh.position.set(0, 0, 0.02);
    weaponMesh.rotation.set(0, 0, -Math.PI / 4);
    boneMap.r_hand.add(weaponMesh);

    scene.add(skinnedMesh);
    skinnedMesh.updateMatrixWorld(true);
  }

  const texLoader = new THREE.TextureLoader();
  function loadTexture(url) {
    texLoader.load(url, (tex) => {
      currentTexture = tex;
      buildSkinnedMesh(tex);
      redraw();
    }, undefined, () => {
      const c = document.createElement('canvas');
      c.width = 512; c.height = 680;
      const ctx2 = c.getContext('2d');
      ctx2.fillStyle = '#ff4400';
      ctx2.fillRect(166, 180, 180, 240);
      const fallbackTex = new THREE.CanvasTexture(c);
      currentTexture = fallbackTex;
      buildSkinnedMesh(fallbackTex);
      redraw();
    });
  }

  // Load initial texture
  loadCharacterAndWeapon('/assets/character/Fire%20player.png', '/assets/character/Fire%20sword.png');

  // Load saved skeleton from localStorage or server
  try {
    const cached = localStorage.getItem('rigged_skeleton');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.nodes) {
        skeletonData.nodes = { ...skeletonData.nodes, ...parsed.nodes };
        if (parsed.links) skeletonData.links = parsed.links;
        syncUI();
      }
    }
  } catch (e) {}

  fetch('/api/admin/skeleton')
    .then(r => r.json())
    .then(data => {
      if (data && data.nodes) {
        skeletonData.nodes = { ...skeletonData.nodes, ...data.nodes };
        if (data.links) skeletonData.links = data.links;
        syncUI();
        if (currentTexture) buildSkinnedMesh(currentTexture);
        redraw();
      }
    })
    .catch(() => {});

  function resizeViewport() {
    const wrap = document.getElementById('skeleton-stage-wrap');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const w = Math.round(rect.width) || 480;
    const h = Math.round(rect.height) || 580;
    if (w > 0 && h > 0) {
      canvas.width = w;
      canvas.height = h;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (skinnedMesh) skinnedMesh.updateMatrixWorld(true);
      redraw();
    }
  }

  window.addEventListener('resize', resizeViewport);
  window.addEventListener('skeleton-tab-activated', () => {
    setTimeout(resizeViewport, 60);
  });
  setTimeout(resizeViewport, 80);

  function getNodeColor(name) {
    if (name === 'r_hand') return '#ff4500';
    if (name.startsWith('r_')) return '#f97316';
    if (name.startsWith('l_')) return '#a855f7';
    if (name === 'head' || name === 'neck') return '#fbbf24';
    return '#00e5ff';
  }

  const _boneWorldPos = new THREE.Vector3();
  function getBoneCanvasCoords(name) {
    if (boneMap[name] && skinnedMesh) {
      skinnedMesh.updateMatrixWorld(true);
      boneMap[name].getWorldPosition(_boneWorldPos);
      return worldToCanvas(_boneWorldPos);
    }
    const n = skeletonData.nodes[name] || { x: 0.5, y: 0.5 };
    return { x: n.x * canvas.width, y: n.y * canvas.height };
  }

  function redraw() {
    if (!canvas.width || !canvas.height) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw link bones
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const [from, to] of skeletonData.links) {
      const p1 = getBoneCanvasCoords(from);
      const p2 = getBoneCanvasCoords(to);

      // Outer bone glow
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Inner bone line
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }

    // Draw joints
    for (const [name, node] of Object.entries(skeletonData.nodes)) {
      const pt = getBoneCanvasCoords(name);
      const nx = pt.x;
      const ny = pt.y;

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
    let closestName = null;
    let minDist = 22;

    for (const name of Object.keys(skeletonData.nodes)) {
      const pt = getBoneCanvasCoords(name);
      const d = Math.hypot(x - pt.x, y - pt.y);
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
      const norm = canvasToNorm(x, y);
      skeletonData.nodes[activeDragNode] = norm;

      if (activeDragNode === 'r_hand' && hudRHand) {
        hudRHand.textContent = `(${norm.x.toFixed(2)}, ${norm.y.toFixed(2)})`;
      }
      syncNodeItem(activeDragNode);

      // Rebuild skinned mesh in real time so vertices update dynamically
      if (currentTexture) {
        buildSkinnedMesh(currentTexture);
      }
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
      if (currentTexture) {
        buildSkinnedMesh(currentTexture);
      }
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
      item.style.cssText = 'background:#1e293b; padding:4px 6px; border-radius:4px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; border:1px solid #344155;';
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
      loadTexture(presets[el]);
    });
  });

  // Custom Image Upload
  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        img.src = evt.target.result;
        loadTexture(evt.target.result);
      };
      reader.readAsDataURL(file);
    }
  });

  // Reset to default
  btnReset?.addEventListener('click', () => {
    skeletonData.nodes = JSON.parse(JSON.stringify(DEFAULT_SKELETON.nodes));
    syncUI();
    if (currentTexture) buildSkinnedMesh(currentTexture);
    redraw();
  });

  // Test Slash Animation in 3D WebGL SkinnedMesh
  btnTestSlash?.addEventListener('click', () => {
    if (isTestingSlash || !boneMap.r_shoulder || !boneMap.r_elbow) return;
    isTestingSlash = true;

    const startTime = performance.now();
    const duration = 320;

    const origShoulderZ = boneMap.r_shoulder.rotation.z;
    const origElbowZ = boneMap.r_elbow.rotation.z;

    function animateSlash(now) {
      const elapsed = now - startTime;
      const prog = Math.min(1.0, elapsed / duration);

      if (prog < 0.3) {
        // Wind-up: shoulder raises back, elbow bends
        const t = prog / 0.3;
        boneMap.r_shoulder.rotation.z = origShoulderZ + 0.8 * t;
        boneMap.r_elbow.rotation.z    = origElbowZ + 0.5 * t;
      } else if (prog < 0.6) {
        // Strike: forward slash motion!
        const t = (prog - 0.3) / 0.3;
        boneMap.r_shoulder.rotation.z = origShoulderZ + 0.8 - 2.0 * t;
        boneMap.r_elbow.rotation.z    = origElbowZ + 0.5 - 1.2 * t;
      } else {
        // Recover to rest position
        const t = (prog - 0.6) / 0.4;
        boneMap.r_shoulder.rotation.z = origShoulderZ - 1.2 * (1 - t);
        boneMap.r_elbow.rotation.z    = origElbowZ - 0.7 * (1 - t);
      }

      if (skinnedMesh) skinnedMesh.updateMatrixWorld(true);
      redraw();

      if (prog < 1.0) {
        requestAnimationFrame(animateSlash);
      } else {
        boneMap.r_shoulder.rotation.z = origShoulderZ;
        boneMap.r_elbow.rotation.z    = origElbowZ;
        if (skinnedMesh) skinnedMesh.updateMatrixWorld(true);
        isTestingSlash = false;
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
          if (currentTexture) buildSkinnedMesh(currentTexture);
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
      // 1. POST to server
      const res = await fetch('/api/admin/skeleton', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(skeletonData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi server');

      // 2. Save to localStorage for instant cross-tab sync
      try {
        localStorage.setItem('rigged_skeleton', JSON.stringify(skeletonData));
      } catch (err) {}

      // 3. Dispatch window events for live sync
      window.dispatchEvent(new CustomEvent('skeleton-updated', { detail: skeletonData }));
      try {
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'skeleton-updated', skeleton: skeletonData }, '*');
        }
        if (window.opener) {
          window.opener.postMessage({ type: 'skeleton-updated', skeleton: skeletonData }, '*');
        }
      } catch (err) {}

      toastEl.className = 'status-toast success';
      toastEl.textContent = '✓ Đã lưu khung xương thành công!';
      setTimeout(() => { toastEl.style.display = 'none'; }, 4000);
    } catch (e) {
      toastEl.className = 'status-toast error';
      toastEl.textContent = '❌ Lỗi: ' + e.message;
    } finally {
      btnSave.disabled = false;
    }
  });

  // Continuous WebGL Render Loop
  let reqId = null;
  function renderLoop() {
    reqId = requestAnimationFrame(renderLoop);
    renderer.render(scene, camera);
  }
  renderLoop();

  syncUI();
  return {
    redraw,
    resize: resizeViewport,
    destroy: () => {
      if (reqId) cancelAnimationFrame(reqId);
      renderer.dispose();
    }
  };
}
