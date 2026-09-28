// Clean Admin Dashboard & Asset Manager
import * as Audio from './audio.js';

const THREE = (typeof window !== 'undefined' && window.THREE) ? window.THREE : null;
const OrbitControls = (typeof THREE !== 'undefined' && THREE.OrbitControls) ? THREE.OrbitControls : (typeof window !== 'undefined' ? window.THREE?.OrbitControls : null);
const GLTFLoader = (typeof THREE !== 'undefined' && THREE.GLTFLoader) ? THREE.GLTFLoader : (typeof window !== 'undefined' ? window.THREE?.GLTFLoader : null);

let scene, camera, renderer, controls;
let currentPreviewMesh = null;

// ─────────────────────────────────────────────────────────────────────────────
// 3D VIEWER INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
function initViewer() {
  const container = document.getElementById('admin-viewport');
  if (!container || !THREE) return;

  // Stop background music in Admin panel
  try { Audio.stopBGM?.(); } catch (e) {}

  const width = container.clientWidth || 700;
  const height = container.clientHeight || 580;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x070a13);

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.set(0, 2.0, 5.5);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  if (OrbitControls) {
    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 1.5, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
  }

  // Lighting
  const ambLight = new THREE.AmbientLight(0xffffff, 0.85);
  scene.add(ambLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(4, 8, 5);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0x00b4d8, 0.5);
  fillLight.position.set(-4, 3, -2);
  scene.add(fillLight);

  // Platform Grid
  const grid = new THREE.GridHelper(10, 10, 0x00b4d8, 0x1e293b);
  grid.position.y = 0;
  scene.add(grid);

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    if (controls) controls.update();
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }
  }
  animate();

  window.addEventListener('resize', () => {
    if (!container || !renderer || !camera) return;
    const w = container.clientWidth || 700;
    const h = container.clientHeight || 580;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // Load initial preview (Player Fire)
  loadPreviewModel('player', 'fire');
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW MODEL LOADER
// ─────────────────────────────────────────────────────────────────────────────
function loadPreviewModel(category, element) {
  const hudName = document.getElementById('hud-model-name');
  const hudStatus = document.getElementById('hud-model-status');

  if (currentPreviewMesh) {
    scene.remove(currentPreviewMesh);
    currentPreviewMesh = null;
  }

  const loader = GLTFLoader ? new GLTFLoader() : null;
  if (!loader) {
    if (hudStatus) { hudStatus.textContent = 'Thiếu GLTFLoader'; hudStatus.style.color = '#ef4444'; }
    return;
  }

  let modelUrl = '';
  let displayName = '';

  if (category === 'player') {
    modelUrl = `/assets/character/player_${element}.glb?t=${Date.now()}`;
    displayName = `Player Model [${element.toUpperCase()}]`;
  } else {
    // Boss
    modelUrl = `/assets/character/boss_${element}.glb?t=${Date.now()}`;
    displayName = `Boss Model [${element.toUpperCase()}]`;
  }

  if (hudName) hudName.textContent = displayName;
  if (hudStatus) { hudStatus.textContent = 'Đang tải GLB...'; hudStatus.style.color = '#38bdf8'; }

  loader.load(
    modelUrl,
    (gltf) => {
      const model = gltf.scene;

      // Safe bounding box scaling & centering
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const targetHeight = category === 'boss' ? 4.0 : 3.2;
      const scale = targetHeight / maxDim;
      model.scale.setScalar(scale);

      const scaledBox = new THREE.Box3().setFromObject(model);
      model.position.x = - (scaledBox.min.x + scaledBox.max.x) / 2;
      model.position.z = - (scaledBox.min.z + scaledBox.max.z) / 2;
      model.position.y = - scaledBox.min.y;

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(model);
      currentPreviewMesh = model;

      if (controls) {
        controls.target.set(0, targetHeight * 0.5, 0);
      }

      if (hudStatus) {
        hudStatus.textContent = `Tải thành công (Cao: ${targetHeight}u)`;
        hudStatus.style.color = '#10b981';
      }
    },
    undefined,
    (err) => {
      // Fallback placeholder box
      const placeholder = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 3.2, 1.2),
        new THREE.MeshStandardMaterial({ color: category === 'boss' ? 0xef233c : 0x00b4d8 })
      );
      placeholder.position.set(0, 1.6, 0);
      scene.add(placeholder);
      currentPreviewMesh = placeholder;

      if (hudStatus) {
        hudStatus.textContent = `Chưa có file GLB (Hiển thị khối mẫu)`;
        hudStatus.style.color = '#f59e0b';
      }
    }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TOAST HELPER
// ─────────────────────────────────────────────────────────────────────────────
function showToast(elemId, msg, isSuccess = true) {
  const el = document.getElementById(elemId);
  if (!el) return;
  el.textContent = msg;
  el.className = `status-toast ${isSuccess ? 'success' : 'error'}`;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, 4500);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. UPLOAD PLAYER MODEL
// ─────────────────────────────────────────────────────────────────────────────
function setupPlayerUpload() {
  const btn = document.getElementById('btn-upload-player');
  const fileInput = document.getElementById('player-upload-file');
  const selElement = document.getElementById('player-upload-element');

  btn?.addEventListener('click', async () => {
    const file = fileInput?.files?.[0];
    if (!file) {
      showToast('toast-player', 'Vui lòng chọn file mô hình hoặc ảnh', false);
      return;
    }
    const element = selElement?.value || 'fire';
    const isModel = /\.(glb|gltf)$/i.test(file.originalname);

    btn.disabled = true;
    btn.textContent = 'Đang tải lên...';

    const fd = new FormData();
    fd.append('file', file);
    fd.append('image', file);
    fd.append('element', element);
    fd.append('type', 'character');

    try {
      const endpoint = isModel ? '/api/admin/model/upload' : '/api/admin/art/upload';
      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Tải lên thất bại');

      showToast('toast-player', `✓ Đã lưu mô hình Player ${element.toUpperCase()} thành công!`, true);
      loadPreviewModel('player', element);
    } catch (e) {
      showToast('toast-player', `Lỗi: ${e.message}`, false);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>📤</span> Tải Lên Mô Hình Player';
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. UPLOAD BOSS MODEL (PERMANENT GLB)
// ─────────────────────────────────────────────────────────────────────────────
function setupBossUpload() {
  const btn = document.getElementById('btn-upload-boss');
  const fileInput = document.getElementById('boss-upload-file');
  const selElement = document.getElementById('boss-upload-element');

  btn?.addEventListener('click', async () => {
    const file = fileInput?.files?.[0];
    if (!file) {
      showToast('toast-boss', 'Vui lòng chọn file mô hình Boss (.glb / .gltf)', false);
      return;
    }
    const element = selElement?.value || 'thunder';

    btn.disabled = true;
    btn.textContent = 'Đang lưu vĩnh viễn...';

    const fd = new FormData();
    fd.append('file', file);
    fd.append('element', element);

    try {
      const res = await fetch('/api/admin/boss/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Lưu mô hình Boss thất bại');

      showToast('toast-boss', `✓ Đã lưu vĩnh viễn Boss ${element.toUpperCase()} vào public/assets/character/!`, true);
      loadPreviewModel('boss', element);
    } catch (e) {
      showToast('toast-boss', `Lỗi: ${e.message}`, false);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<span>💾</span> Lưu Vĩnh Viễn Mô Hình Boss';
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. UPLOAD & MANAGE QUESTION SETS
// ─────────────────────────────────────────────────────────────────────────────
async function refreshQuestionStats() {
  try {
    const res = await fetch('/api/admin/questions/stats');
    if (!res.ok) return;
    const data = await res.json();
    if (data.stats) {
      const elTh = document.getElementById('stat-thunder');
      const elFi = document.getElementById('stat-fire');
      const elFr = document.getElementById('stat-frost');
      if (elTh) elTh.textContent = `${data.stats.thunder || 0} câu`;
      if (elFi) elFi.textContent = `${data.stats.fire || 0} câu`;
      if (elFr) elFr.textContent = `${data.stats.frost || 0} câu`;
    }
  } catch (e) {}
}

function setupQuestionManager() {
  refreshQuestionStats();

  const btnUpload = document.getElementById('btn-upload-questions');
  const btnClear = document.getElementById('btn-clear-questions');
  const fileInput = document.getElementById('q-upload-file');
  const selElement = document.getElementById('q-upload-element');
  const selMode = document.getElementById('q-upload-mode');

  btnUpload?.addEventListener('click', async () => {
    const file = fileInput?.files?.[0];
    if (!file) {
      showToast('toast-questions', 'Vui lòng chọn file câu hỏi (.docx / .xlsx / .json)', false);
      return;
    }
    const element = selElement?.value || 'thunder';
    const mode = selMode?.value || 'replace';

    btnUpload.disabled = true;
    btnUpload.textContent = 'Đang nạp câu hỏi...';

    const fd = new FormData();
    fd.append('file', file);
    fd.append('element', element);
    fd.append('mode', mode);

    try {
      const res = await fetch('/api/admin/questions/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Nạp câu hỏi thất bại');

      showToast('toast-questions', `✓ Đã nạp thành công ${data.added || 0} câu hỏi (Tổng: ${data.total})!`, true);
      refreshQuestionStats();
    } catch (e) {
      showToast('toast-questions', `Lỗi: ${e.message}`, false);
    } finally {
      btnUpload.disabled = false;
      btnUpload.innerHTML = '<span>📥</span> Nạp Vào Ngân Hàng';
    }
  });

  btnClear?.addEventListener('click', async () => {
    const element = selElement?.value || 'thunder';
    if (!confirm(`Bạn có chắc chắn muốn xóa sạch ngân hàng câu hỏi của hệ ${element.toUpperCase()}?`)) return;

    try {
      const res = await fetch(`/api/admin/questions/clear?element=${element}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Xóa thất bại');
      showToast('toast-questions', `✓ Đã xóa sạch ngân hàng câu hỏi hệ ${element.toUpperCase()}!`, true);
      refreshQuestionStats();
    } catch (e) {
      showToast('toast-questions', `Lỗi: ${e.message}`, false);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. QUICK LAUNCH & DEV TEST
// ─────────────────────────────────────────────────────────────────────────────
function setupDevLaunch() {
  document.getElementById('btn-dev-test-match')?.addEventListener('click', async () => {
    try {
      const res = await fetch('/api/dev-questions?code=DEV99', { method: 'POST' });
      if (res.ok) {
        window.location.href = '/?dev=1&element=fire';
      } else {
        window.location.href = '/';
      }
    } catch (e) {
      window.location.href = '/';
    }
  });

  document.getElementById('btn-launch-thunder')?.addEventListener('click', () => {
    window.location.href = '/?element=thunder';
  });

  document.getElementById('btn-launch-fire')?.addEventListener('click', () => {
    window.location.href = '/?element=fire';
  });

  document.getElementById('btn-launch-frost')?.addEventListener('click', () => {
    window.location.href = '/?element=frost';
  });

  document.getElementById('btn-launch-lobby')?.addEventListener('click', () => {
    window.location.href = '/';
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PREVIEW TABS SETUP
// ─────────────────────────────────────────────────────────────────────────────
function setupPreviewTabs() {
  const tabs = [
    { id: 'tab-prev-player', cat: 'player', el: 'fire' },
    { id: 'tab-prev-boss-thunder', cat: 'boss', el: 'thunder' },
    { id: 'tab-prev-boss-fire', cat: 'boss', el: 'fire' },
    { id: 'tab-prev-boss-frost', cat: 'boss', el: 'frost' },
  ];

  tabs.forEach(t => {
    const el = document.getElementById(t.id);
    el?.addEventListener('click', () => {
      document.querySelectorAll('.model-tab-btn').forEach(b => b.classList.remove('active'));
      el.classList.add('active');
      loadPreviewModel(t.cat, t.el);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  initViewer();
  setupPreviewTabs();
  setupPlayerUpload();
  setupBossUpload();
  setupQuestionManager();
  setupDevLaunch();
});
