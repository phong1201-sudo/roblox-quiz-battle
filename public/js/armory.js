// public/js/armory.js — 3D Interactive GLB Outfit Preview & Consolidated Armory
// Supports real-time 3D idle .glb preview, 360° touch/mouse rotation, studio lighting, glowing pedestal, and outfit unlocking

import { socket } from './socket.js';
import * as Multiplayer from './multiplayer.js';

export const OUTFITS = [
  {
    id: 'default',
    element: null,
    name: 'Mặc Định',
    subTitle: 'Chiến Binh Sơ Cấp',
    color: '#94a3b8',
    glow: 'rgba(148, 163, 184, 0.35)',
    borderGlow: '0 0 16px rgba(148, 163, 184, 0.4)',
    preview: '/assets/character/player_default_preview.png',
    glb: '/assets/character/player_default_idle.glb',
    desc: 'Trang phục tân thủ Roblox tiêu chuẩn. Tấn công vật lý chuẩn xác.',
    damage: '1 HP / đòn',
    defense: 'Chuẩn',
    reqScore: 0,
    lore: 'Khởi đầu cuộc phiêu lưu săn Boss ma thần.'
  },
  {
    id: 'thunder',
    element: 'thunder',
    name: '⚡ Lôi Thần',
    subTitle: 'Chiến Giáp Sấm Sét',
    color: '#00cfff',
    glow: 'rgba(0, 207, 255, 0.35)',
    borderGlow: '0 0 20px rgba(0, 207, 255, 0.6)',
    preview: '/assets/character/idle_thunder.png',
    glb: '/assets/character/player_thunder_idle.glb',
    desc: 'Tích tụ điện năng, chém sấm sét giáng thế. Sát thương nguyên tố cao.',
    damage: '2 HP / đòn (Sét)',
    defense: 'Kháng Sét',
    reqScore: 50,
    lore: 'Mở khóa: PERFECT ải Lôi Quái mức Khó, hoặc PERFECT cả Dễ và Trung bình.'
  },
  {
    id: 'fire',
    element: 'fire',
    name: '🔥 Hỏa Thần',
    subTitle: 'Áo Choàng Hỏa Ma',
    color: '#ff6b00',
    glow: 'rgba(255, 107, 0, 0.35)',
    borderGlow: '0 0 20px rgba(255, 107, 0, 0.6)',
    preview: '/assets/character/idle_fire.jpg',
    glb: '/assets/character/player_fire_idle.glb',
    desc: 'Lửa địa ngục thiêu đốt vạn vật, đòn chém bốc cháy cuồng nộ.',
    damage: '2 HP / đòn (Lửa)',
    defense: 'Kháng Lửa',
    reqScore: 50,
    lore: 'Mở khóa: PERFECT ải Hỏa Ma Vương mức Khó, hoặc PERFECT cả Dễ và Trung bình.'
  },
  {
    id: 'frost',
    element: 'frost',
    name: '❄️ Băng Thần',
    subTitle: 'Băng Giáp Tinh Thể',
    color: '#88ddff',
    glow: 'rgba(136, 221, 255, 0.35)',
    borderGlow: '0 0 20px rgba(136, 221, 255, 0.6)',
    preview: '/assets/character/idle_frost.png',
    glb: '/assets/character/player_frost_idle.glb',
    desc: 'Hàn băng ngưng đọng, lưỡi kiếm đóng băng boss trên từng nhát chém.',
    damage: '2 HP / đòn (Băng)',
    defense: 'Kháng Băng',
    reqScore: 50,
    lore: 'Mở khóa: PERFECT ải Băng Tinh mức Khó, hoặc PERFECT cả Dễ và Trung bình.'
  }
];

// ─────────────────────────────────────────────────────────────────────────────
// 3D Preview Scene & Render State
// ─────────────────────────────────────────────────────────────────────────────
let previewScene = null;
let previewCamera = null;
let previewRenderer = null;
let currentPreviewMesh = null;
let previewAnimId = null;
let previewPedestal = null;
let previewRing = null;
let isPreviewInitialized = false;

let userInteracting = false;
let interactionTimeout = null;
let currentRequestedOutfitKey = null;

// One shared <canvas> (declared in index.html) is moved between the lobby's inline
// preview box and the armory modal; the WebGL renderer stays bound to it.
let previewCanvas = null;
let previewKey = null;             // outfit currently shown in the lobby preview
const previewMeshCache = new Map(); // outfit id -> loaded idle model
let lastCanvasW = 0, lastCanvasH = 0;

function getPreviewCanvas() {
  if (!previewCanvas) previewCanvas = document.getElementById('armory-preview-canvas');
  return previewCanvas;
}

/** Move the shared preview canvas into `holder` (lobby preview box or modal). */
function mountPreviewCanvas(holder) {
  const canvas = getPreviewCanvas();
  if (!canvas || !holder) return;
  if (canvas.parentElement !== holder) holder.insertBefore(canvas, holder.firstChild);
  const statusEl = document.getElementById('armory-preview-status');
  if (statusEl && statusEl.parentElement !== holder) holder.appendChild(statusEl);
  lastCanvasW = lastCanvasH = 0; // force a resize on the next frame
}

/**
 * Get current equipped outfit ID from storage or gameState
 */
export function getEquippedOutfit() {
  let saved = null;
  try {
    saved = sessionStorage.getItem('selectedOutfit') || localStorage.getItem('selectedOutfit');
  } catch (e) {}
  if (!saved && window.gameState?.equipped?.outfit) {
    saved = window.gameState.equipped.outfit;
  }
  return (saved || 'default').toLowerCase();
}

/**
 * Check outfit unlock progression status
 * Returns: { isUnlocked, score, badgeText, canEquip }
 */
export function getOutfitStatus(outfitId, user = null) {
  if (outfitId === 'default') {
    return { isUnlocked: true, score: 50, badgeText: '✓ Sẵn sàng', canEquip: true };
  }

  // Admin God Father has everything unlocked
  if (window._godFather === true || user?.role === 'admin' || window.gameState?.role === 'admin') {
    return { isUnlocked: true, score: 50, badgeText: '👑 Đã mở (Admin)', canEquip: true };
  }

  const u = user || window.gameState || {};
  const unlockedList = u.unlockedOutfits || u.unlockedSets || [];
  const inventory = u.inventory?.[outfitId] || [];

  // Check explicit unlock list or full 2-piece inventory
  if (unlockedList.includes(outfitId) || inventory.length >= 2) {
    return { isUnlocked: true, score: 50, badgeText: '✓ Đã mở khóa', canEquip: true };
  }

  // Check stored scores
  const scoresObj = u.scores || {};
  let currentScore = 0;
  if (typeof scoresObj[outfitId] === 'number') {
    currentScore = scoresObj[outfitId];
  } else if (inventory.includes('outfit')) {
    currentScore = 30;
  } else if (inventory.includes('weapon')) {
    currentScore = 20;
  }

  if (currentScore >= 50) {
    return { isUnlocked: true, score: 50, badgeText: '✓ Đã mở khóa (50/50)', canEquip: true };
  }

  if (currentScore >= 30) {
    return { isUnlocked: false, score: 30, badgeText: '30/50 [Chưa mở khóa]', canEquip: false };
  }

  if (currentScore >= 20) {
    return { isUnlocked: false, score: 20, badgeText: '20/50 [Chưa mở khóa]', canEquip: false };
  }

  return { isUnlocked: false, score: currentScore, badgeText: `${currentScore}/50 [Chưa mở khóa]`, canEquip: false };
}

/**
 * Equip an outfit and synchronize locally, with server, and in gameState
 */
export function equipOutfit(outfitId, onEquippedCallback) {
  const cleanId = (outfitId || 'default').toLowerCase();

  try {
    sessionStorage.setItem('selectedOutfit', cleanId);
    localStorage.setItem('selectedOutfit', cleanId);
    localStorage.setItem('player_equipped', JSON.stringify({ outfit: cleanId, weapon: cleanId }));
  } catch (e) {}

  window.currentEquippedOutfit = cleanId;

  if (window.gameState) {
    window.gameState.equipped = { outfit: cleanId, weapon: cleanId };
    window.gameState.equipment = { ...window.gameState.equipped };
    const isFull = (cleanId !== 'default');
    window.gameState.equippedSet = isFull ? cleanId : null;
    window.gameState.damagePerHit = isFull ? 2 : 1;
    window.gameState.hasFullSet = isFull;
  }

  // Sync to multiplayer room if connected
  try {
    Multiplayer.updateEquipment({ outfit: cleanId, weapon: cleanId });
  } catch (e) {}

  // Sync to server profile if logged in
  const userId = window.gameState?.userId;
  if (userId) {
    fetch('/api/unlock-outfit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, outfitId: cleanId })
    }).catch(() => {});
  }

  if (typeof onEquippedCallback === 'function') {
    onEquippedCallback(cleanId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3D Preview Viewport Setup (Three.js + GLTFLoader)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialize the dedicated lightweight Three.js preview viewport
 */
export function initArmoryPreview() {
  const canvas = getPreviewCanvas();
  if (!canvas) return;

  const currentTHREE = (typeof THREE !== 'undefined') ? THREE : window.THREE;
  if (!currentTHREE) {
    console.warn('[armory] THREE.js is not loaded yet');
    return;
  }

  const container = canvas.parentElement || document.querySelector('.armory-preview-container');
  const width = canvas.clientWidth || (container ? container.clientWidth : 340) || 340;
  const height = canvas.clientHeight || (container ? container.clientHeight : 380) || 380;

  if (isPreviewInitialized && previewRenderer) {
    handleCanvasResize();
    return;
  }

  // 1. Scene
  previewScene = new currentTHREE.Scene();

  // 2. Camera
  previewCamera = new currentTHREE.PerspectiveCamera(45, width / height, 0.1, 100);
  // Far enough back that the whole character and pedestal fit in a narrow box too
  previewCamera.position.set(0, 1.7, 5.4);
  previewCamera.lookAt(0, 1.5, 0);

  // 3. Renderer (alpha: true, antialias: true) sized specifically to #armory-preview-canvas
  previewRenderer = new currentTHREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  previewRenderer.setSize(width, height, false);
  previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  if (currentTHREE.sRGBEncoding) {
    previewRenderer.outputEncoding = currentTHREE.sRGBEncoding;
  }

  // 4. Soft Studio Lighting
  // AmbientLight (intensity: 1.6)
  const ambientLight = new currentTHREE.AmbientLight(0xffffff, 1.6);
  previewScene.add(ambientLight);

  // Key DirectionalLight (color: 0xffffff, intensity: 2.2, position: (3, 5, 4))
  const keyLight = new currentTHREE.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(3, 5, 4);
  previewScene.add(keyLight);

  // Accent RimLight from behind (color: 0x38bdf8, intensity: 1.8, position: (-3, 3, -4))
  const rimLight = new currentTHREE.DirectionalLight(0x38bdf8, 1.8);
  rimLight.position.set(-3, 3, -4);
  previewScene.add(rimLight);

  // 5. Glowing cylindrical pedestal/base at y = 0 beneath the character
  const pedestalGeo = new currentTHREE.CylinderGeometry(1.6, 1.8, 0.2, 32);
  const pedestalMat = new currentTHREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0x00cfff,
    emissiveIntensity: 0.35,
    roughness: 0.4,
    metalness: 0.7
  });
  previewPedestal = new currentTHREE.Mesh(pedestalGeo, pedestalMat);
  previewPedestal.position.set(0, -0.1, 0);
  previewScene.add(previewPedestal);

  const ringGeo = new currentTHREE.RingGeometry(1.5, 1.68, 32);
  const ringMat = new currentTHREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: currentTHREE.DoubleSide,
    transparent: true,
    opacity: 0.85
  });
  previewRing = new currentTHREE.Mesh(ringGeo, ringMat);
  previewRing.rotation.x = -Math.PI / 2;
  previewRing.position.set(0, 0.01, 0);
  previewScene.add(previewRing);

  // 6. Touch and mouse drag orbit listeners to let player spin the 3D model left/right
  bindCanvasDragControls(canvas);

  // Handle window resizing
  window.addEventListener('resize', handleCanvasResize);

  isPreviewInitialized = true;
}

/**
 * Handle canvas resize
 */
function handleCanvasResize() {
  const canvas = getPreviewCanvas();
  if (!canvas || !previewRenderer || !previewCamera) return;
  const container = canvas.parentElement;
  const width = canvas.clientWidth || (container ? container.clientWidth : 340);
  const height = canvas.clientHeight || (container ? container.clientHeight : 380);
  if (width > 0 && height > 0) {
    lastCanvasW = width;
    lastCanvasH = height;
    previewCamera.aspect = width / height;
    previewCamera.updateProjectionMatrix();
    previewRenderer.setSize(width, height, false);
  }
}

/**
 * Basic touch and mouse drag listeners to spin model 360 degrees
 */
function bindCanvasDragControls(canvas) {
  let isDragging = false;
  let prevPos = { x: 0, y: 0 };

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    userInteracting = true;
    clearTimeout(interactionTimeout);
    prevPos = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      clearTimeout(interactionTimeout);
      interactionTimeout = setTimeout(() => {
        userInteracting = false;
      }, 1500);
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging || !currentPreviewMesh) return;
    const dx = e.clientX - prevPos.x;
    currentPreviewMesh.rotation.y += dx * 0.015;
    prevPos = { x: e.clientX, y: e.clientY };
    userInteracting = true;
  });

  // Touch controls
  canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      userInteracting = true;
      clearTimeout(interactionTimeout);
      prevPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }, { passive: true });

  window.addEventListener('touchend', () => {
    if (isDragging) {
      isDragging = false;
      clearTimeout(interactionTimeout);
      interactionTimeout = setTimeout(() => {
        userInteracting = false;
      }, 1500);
    }
  });

  canvas.addEventListener('touchmove', (e) => {
    if (!isDragging || !currentPreviewMesh || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - prevPos.x;
    currentPreviewMesh.rotation.y += dx * 0.02;
    prevPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    userInteracting = true;
  }, { passive: true });
}

/**
 * Load corresponding idle GLB file on outfit selection
 */
export function loadPreviewOutfit(outfitKey) {
  const cleanKey = (outfitKey || 'default').toLowerCase();
  currentRequestedOutfitKey = cleanKey;

  if (!previewScene) {
    initArmoryPreview();
  }
  if (!previewScene) return;

  const currentTHREE = (typeof THREE !== 'undefined') ? THREE : window.THREE;

  // Already showing this outfit: nothing to reload
  if (currentPreviewMesh && currentPreviewMesh.userData.outfitKey === cleanKey) {
    startPreviewLoop();
    return;
  }

  // Clear previous preview meshes from the preview scene:
  if (currentPreviewMesh) {
    previewScene.remove(currentPreviewMesh);
    currentPreviewMesh = null;
  }

  // Update pedestal/ring glow color
  const outfitData = OUTFITS.find(o => o.id === cleanKey) || OUTFITS[0];
  if (previewPedestal && previewPedestal.material) {
    const colHex = parseInt((outfitData.color || '#94a3b8').replace('#', '0x'), 16);
    previewPedestal.material.emissive.setHex(colHex);
    if (previewRing && previewRing.material) {
      previewRing.material.color.setHex(colHex);
    }
  }

  const cached = previewMeshCache.get(cleanKey);
  if (cached) {
    previewScene.add(cached);
    currentPreviewMesh = cached;
    updatePreviewStatus('');
    startPreviewLoop();
    return;
  }

  updatePreviewStatus(`Đang tải 3D ${outfitData.name}...`);

  const GLTFLoaderClass = (typeof THREE !== 'undefined' && THREE.GLTFLoader)
    ? THREE.GLTFLoader
    : (typeof window !== 'undefined' ? window.THREE?.GLTFLoader : null);

  if (!GLTFLoaderClass) {
    console.warn('[armory] GLTFLoader not available');
    updatePreviewStatus('Lỗi: Chưa nạp xong GLTFLoader');
    return;
  }

  const loader = new GLTFLoaderClass();
  const url = `/assets/character/player_${cleanKey}_idle.glb`;

  loader.load(
    url,
    (gltf) => {
      // Discard if user clicked another outfit while downloading
      if (currentRequestedOutfitKey !== cleanKey) return;

      if (currentPreviewMesh) {
        previewScene.remove(currentPreviewMesh);
        currentPreviewMesh = null;
      }

      const mesh = gltf.scene || gltf.scenes[0];

      // Traverse mesh to setup materials and shadows
      mesh.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            child.material.needsUpdate = true;
          }
        }
      });

      // Normalize scale and floor position (Exact spec formula):
      const box = new currentTHREE.Box3().setFromObject(mesh);
      const size = box.getSize(new currentTHREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;
      const scale = 3.2 / maxDim; // Standardized height
      mesh.scale.set(scale, scale, scale);

      const scaledBox = new currentTHREE.Box3().setFromObject(mesh);
      mesh.position.y = -scaledBox.min.y;
      mesh.position.x = 0;
      mesh.position.z = 0;

      mesh.userData.outfitKey = cleanKey;
      previewMeshCache.set(cleanKey, mesh);
      previewScene.add(mesh);
      currentPreviewMesh = mesh;

      updatePreviewStatus('');
      startPreviewLoop();
    },
    undefined,
    (err) => {
      console.warn(`[armory] Could not load GLB from ${url}`, err);
      updatePreviewStatus(`Không thể tải mô hình (${cleanKey})`);
    }
  );
}

/**
 * Display a small status overlay badge on the 3D preview
 */
function updatePreviewStatus(msg) {
  let statusEl = document.getElementById('armory-preview-status');
  if (!statusEl) {
    const container = getPreviewCanvas()?.parentElement;
    if (container) {
      statusEl = document.createElement('div');
      statusEl.id = 'armory-preview-status';
      statusEl.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);font-size:10px;color:#38bdf8;background:rgba(15,23,42,0.85);padding:4px 12px;border-radius:6px;pointer-events:none;font-weight:700;border:1px solid rgba(56,189,248,0.3);';
      container.appendChild(statusEl);
    }
  }
  if (statusEl) {
    statusEl.textContent = msg;
    statusEl.style.display = msg ? 'block' : 'none';
  }
}

/**
 * Render animation loop
 * Only run preview animation loop while #armory-modal has display: block / active
 */
export function startPreviewLoop() {
  if (previewAnimId) return;

  function animate() {
    const canvas = getPreviewCanvas();
    // Canvas removed from the page (lobby rebuilt): stop until it is mounted again
    if (!canvas || !canvas.isConnected) {
      previewAnimId = null;
      return;
    }

    // Draw only while the preview is actually visible (lobby screen or modal open)
    if (canvas.offsetParent !== null) {
      if (canvas.clientWidth !== lastCanvasW || canvas.clientHeight !== lastCanvasH) {
        handleCanvasResize();
      }

      // Slow auto-rotation around the Y axis when the user is not dragging
      if (currentPreviewMesh && !userInteracting) {
        currentPreviewMesh.rotation.y += 0.008;
      }

      if (previewRenderer && previewScene && previewCamera) {
        previewRenderer.render(previewScene, previewCamera);
      }
    }

    previewAnimId = requestAnimationFrame(animate);
  }

  previewAnimId = requestAnimationFrame(animate);
}

export function stopPreviewLoop() {
  if (previewAnimId) {
    cancelAnimationFrame(previewAnimId);
    previewAnimId = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Armory Modal Control & Cards Renderer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Open the 3D Armory Preview Modal
 */
export function openArmoryModal(initialOutfitId = null, user = null, onChange = null) {
  const modal = document.getElementById('armory-modal');
  if (!modal) return;

  const currentOutfit = initialOutfitId || getEquippedOutfit();
  modal.style.display = 'flex';

  // Render cards into modal right-hand pane
  const cardsWrap = document.getElementById('armory-modal-cards-wrap');
  if (cardsWrap) {
    renderModalCards(cardsWrap, currentOutfit, user, (newOutfit) => {
      loadPreviewOutfit(newOutfit);
      if (typeof onChange === 'function') onChange(newOutfit);
    });
  }

  mountPreviewCanvas(modal.querySelector('.armory-preview-container'));

  setTimeout(() => {
    initArmoryPreview();
    handleCanvasResize();
    loadPreviewOutfit(currentOutfit);
    startPreviewLoop();
  }, 60);
}

/**
 * Close the 3D Armory Preview Modal and stop animation loop
 */
export function closeArmoryModal() {
  const modal = document.getElementById('armory-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  stopPreviewLoop();
  const inlineHolder = document.getElementById('armory-inline-preview');
  if (inlineHolder) {
    mountPreviewCanvas(inlineHolder);
    loadPreviewOutfit(previewKey || getEquippedOutfit());
    startPreviewLoop();
  }
}

/**
 * Bind modal backdrop and close button listeners
 */
export function bindArmoryModalEvents() {
  const modal = document.getElementById('armory-modal');
  const closeBtn = document.getElementById('armory-modal-close');
  if (closeBtn) {
    closeBtn.onclick = () => closeArmoryModal();
  }
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) closeArmoryModal();
    };
  }
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && (modal.style.display === 'flex' || modal.style.display === 'block')) {
      closeArmoryModal();
    }
  });
}

/**
 * Render compact outfit cards inside the Armory Modal pane
 */
function renderModalCards(container, selectedId, user, onSelect) {
  container.innerHTML = '';
  const equipped = getEquippedOutfit();

  OUTFITS.forEach((outfit) => {
    const isSelected = (selectedId === outfit.id);
    const isEquipped = (equipped === outfit.id);
    const status = getOutfitStatus(outfit.id, user);

    const card = document.createElement('div');
    card.className = `armory-modal-card-item ${isSelected ? 'active' : ''}`;
    card.style.cssText = `
      background: ${isSelected ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.7)'};
      border: 2px solid ${isSelected ? outfit.color : (isEquipped ? '#06d6a0' : 'rgba(255,255,255,0.1)')};
      border-radius: 10px;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      cursor: pointer;
      transition: all .2s ease;
      box-shadow: ${isSelected ? `0 0 16px ${outfit.glow}` : 'none'};
    `;

    card.onclick = () => {
      renderModalCards(container, outfit.id, user, onSelect);
      if (typeof onSelect === 'function') onSelect(outfit.id);
    };

    // Header
    const rowTop = document.createElement('div');
    rowTop.style.cssText = 'display:flex;justify-content:space-between;align-items:center;';
    rowTop.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:12px;font-weight:900;color:${outfit.color};">${outfit.name}</span>
        ${isEquipped ? '<span style="font-size:8px;font-weight:800;background:#059669;color:#fff;padding:2px 6px;border-radius:4px;">ĐANG MẶC</span>' : ''}
      </div>
      <span style="font-size:9px;font-weight:700;color:${status.isUnlocked ? '#06d6a0' : '#ffcc00'};">
        ${status.badgeText}
      </span>
    `;
    card.appendChild(rowTop);

    // Specs
    const rowSpecs = document.createElement('div');
    rowSpecs.style.cssText = 'display:flex;justify-content:space-between;font-size:9.5px;font-weight:700;color:#94a3b8;background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:4px;';
    rowSpecs.innerHTML = `
      <span>⚔️ ${outfit.damage}</span>
      <span style="color:${outfit.color};">🛡️ ${outfit.defense}</span>
    `;
    card.appendChild(rowSpecs);

    // Equip button inside card
    const actionRow = document.createElement('div');
    actionRow.style.cssText = 'display:flex;gap:6px;margin-top:2px;';

    const equipBtn = document.createElement('button');
    equipBtn.className = 'btn';
    equipBtn.style.cssText = 'flex:1;padding:6px;font-size:10px;font-weight:800;border-radius:6px;cursor:pointer;font-family:"Be Vietnam Pro",sans-serif;text-transform:uppercase;';

    if (isEquipped) {
      equipBtn.style.background = 'linear-gradient(135deg, #06d6a0, #059669)';
      equipBtn.style.color = '#fff';
      equipBtn.style.border = '1px solid #34d399';
      equipBtn.textContent = '✅ ĐANG MẶC';
    } else if (status.isUnlocked) {
      equipBtn.style.background = `linear-gradient(135deg, ${outfit.color}, #0284c7)`;
      equipBtn.style.color = '#fff';
      equipBtn.style.border = '1px solid #fff';
      equipBtn.textContent = '⚡ MẶC TRANG PHỤC';
      equipBtn.onclick = (e) => {
        e.stopPropagation();
        equipOutfit(outfit.id, () => {
          renderModalCards(container, outfit.id, user, onSelect);
          const lobbyArmoryWrap = document.getElementById('armory-section-wrap');
          if (lobbyArmoryWrap) renderArmory(lobbyArmoryWrap, user);
          if (typeof onSelect === 'function') onSelect(outfit.id);
        });
      };
    } else {
      equipBtn.disabled = true;
      equipBtn.style.background = 'rgba(255, 255, 255, 0.05)';
      equipBtn.style.color = '#94a3b8';
      equipBtn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      equipBtn.style.cursor = 'not-allowed';
      equipBtn.textContent = `🔒 ${status.badgeText}`;
    }

    actionRow.appendChild(equipBtn);
    card.appendChild(actionRow);

    container.appendChild(card);
  });
}

/**
 * Render the Consolidated Armory UI into the target container (e.g. Lobby section).
 * Left: a live 3D preview of the idle model, slowly rotating. Right: the 4 outfits.
 */
export function renderArmory(container, user = null, onChange = null) {
  previewKey = getEquippedOutfit(); // a fresh render always starts on the worn outfit
  _renderArmory(container, user, onChange);
}

function _renderArmory(container, user, onChange) {
  if (!container) return;

  // Keep the shared canvas alive while the section is rebuilt
  const canvas = getPreviewCanvas();
  if (canvas && container.contains(canvas)) canvas.remove();
  container.innerHTML = '';

  bindArmoryModalEvents();
  const equipped = getEquippedOutfit();
  if (!OUTFITS.some(o => o.id === previewKey)) previewKey = equipped;
  const shown = OUTFITS.find(o => o.id === previewKey) || OUTFITS[0];
  const shownStatus = getOutfitStatus(shown.id, user);

  const wrap = document.createElement('div');
  wrap.className = 'armory-consolidated-wrap';
  wrap.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: 'Be Vietnam Pro', sans-serif;
  `;

  const head = document.createElement('div');
  head.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid rgba(0, 207, 255, 0.3);
    padding-bottom: 8px;
    flex-wrap: wrap;
    gap: 8px;
  `;
  head.innerHTML = `
    <div>
      <span style="font-size: 13px; font-weight: 800; color: #ffcc00; letter-spacing: 1px; text-transform: uppercase;">
        🎒 Kho Trang Phục Nguyên Tố
      </span>
      <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
        Chọn trang phục xuất trận — bấm vào một bộ để xem mẫu 3D
      </div>
    </div>
    <div style="font-size: 10px; font-weight: 700; color: #06d6a0; background: rgba(6,214,160,0.1); padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(6,214,160,0.3);">
      Đang mặc: <b style="color:#fff; text-transform: uppercase;">${equipped}</b>
    </div>
  `;
  wrap.appendChild(head);

  const body = document.createElement('div');
  body.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;align-items:stretch;';

  // ── 3D preview box (idle .glb of the selected outfit, auto-rotating) ─────────
  const previewCol = document.createElement('div');
  previewCol.style.cssText = 'flex:1 1 240px;min-width:220px;display:flex;flex-direction:column;gap:6px;';

  const holder = document.createElement('div');
  holder.id = 'armory-inline-preview';
  holder.className = 'armory-preview-container';
  holder.style.height = '340px';
  holder.style.borderColor = shown.color;
  const hint = document.createElement('div');
  hint.className = 'preview-hint';
  hint.textContent = 'Vuốt hoặc kéo chuột để xoay 360°';
  holder.appendChild(hint);
  previewCol.appendChild(holder);

  const caption = document.createElement('div');
  caption.style.cssText = 'text-align:center;font-size:11px;font-weight:800;';
  caption.innerHTML = `
    <span style="color:${shown.color};">${shown.name}</span>
    <span style="color:#94a3b8;font-weight:700;"> — ${shown.subTitle}</span>
    <div style="font-size:9px;font-weight:700;margin-top:2px;color:${shownStatus.isUnlocked ? '#06d6a0' : '#ffcc00'};">
      ${shown.id === equipped ? '✅ Đang mặc' : (shownStatus.isUnlocked ? shownStatus.badgeText : '🔒 ' + shownStatus.badgeText)}
    </div>
  `;
  previewCol.appendChild(caption);
  body.appendChild(previewCol);

  // ── Outfit cards ─────────────────────────────────────────────────────────────
  const grid = document.createElement('div');
  grid.style.cssText = `
    flex: 2 1 300px;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
    align-content: start;
  `;

  OUTFITS.forEach((outfit) => {
    const isEquipped = (equipped === outfit.id);
    const isShown = (shown.id === outfit.id);
    const status = getOutfitStatus(outfit.id, user);

    const card = document.createElement('div');
    card.className = `armory-card ${isEquipped ? 'equipped' : ''} ${status.isUnlocked ? 'unlocked' : 'locked'}`;
    card.style.cssText = `
      background: ${isShown ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.7)'};
      border: 2px solid ${isShown ? outfit.color : (isEquipped ? '#06d6a0' : 'rgba(255,255,255,0.12)')};
      border-radius: 10px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      cursor: pointer;
      transition: all .25s ease;
      box-shadow: ${isShown ? outfit.borderGlow : 'none'};
      opacity: ${status.isUnlocked ? '1' : '0.8'};
    `;
    card.title = 'Bấm để xem mẫu 3D';
    card.onclick = () => {
      if (previewKey === outfit.id) return;
      previewKey = outfit.id;
      _renderArmory(container, user, onChange);
    };

    const cardTop = document.createElement('div');
    cardTop.style.cssText = 'display:flex; flex-direction:column; gap:2px;';
    cardTop.innerHTML = `
      <span style="font-size: 12px; font-weight: 800; color: ${outfit.color};">${outfit.name}</span>
      <span style="font-size: 9px; font-weight: 700; color: #aaa; text-transform: uppercase;">${outfit.subTitle}</span>
    `;
    card.appendChild(cardTop);

    const statsRow = document.createElement('div');
    statsRow.style.cssText = 'display:flex; justify-content:space-between; gap:6px; font-size:10px; font-weight:700; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:6px;';
    statsRow.innerHTML = `
      <span style="color:#ffcc00;">⚔️ ${outfit.damage}</span>
      <span style="color:${outfit.color};">🛡️ ${outfit.defense}</span>
    `;
    card.appendChild(statsRow);

    const actionBtn = document.createElement('button');
    actionBtn.className = 'btn';
    actionBtn.style.cssText = `
      padding: 9px;
      font-size: 11px;
      font-weight: 800;
      border-radius: 6px;
      cursor: pointer;
      font-family: 'Be Vietnam Pro', sans-serif;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      transition: all .2s;
    `;

    if (isEquipped) {
      actionBtn.style.background = 'linear-gradient(135deg, #06d6a0, #059669)';
      actionBtn.style.color = '#fff';
      actionBtn.style.border = '2px solid #34d399';
      actionBtn.style.cursor = 'default';
      actionBtn.innerHTML = '✅ ĐANG MẶC';
    } else if (status.isUnlocked) {
      actionBtn.style.background = `linear-gradient(135deg, ${outfit.color}, #0284c7)`;
      actionBtn.style.color = '#fff';
      actionBtn.style.border = '1px solid #fff';
      actionBtn.innerHTML = '⚡ MẶC TRANG PHỤC';
      actionBtn.onclick = (e) => {
        e.stopPropagation();
        equipOutfit(outfit.id, () => {
          previewKey = outfit.id;
          _renderArmory(container, user, onChange);
          if (typeof onChange === 'function') onChange(outfit.id);
        });
      };
    } else {
      actionBtn.disabled = true;
      actionBtn.style.background = 'rgba(255, 255, 255, 0.05)';
      actionBtn.style.color = '#94a3b8';
      actionBtn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      // Let clicks fall through to the card so a locked outfit can still be previewed
      actionBtn.style.pointerEvents = 'none';
      actionBtn.innerHTML = `🔒 ${status.badgeText}`;
    }
    card.appendChild(actionBtn);

    const lore = document.createElement('div');
    lore.style.cssText = 'font-size: 8.5px; color: #64748b; text-align: center; font-style: italic;';
    lore.textContent = outfit.lore;
    card.appendChild(lore);

    grid.appendChild(card);
  });

  body.appendChild(grid);
  wrap.appendChild(body);
  container.appendChild(wrap);

  // Mount the shared canvas in the preview box and show the selected idle model
  mountPreviewCanvas(holder);
  initArmoryPreview();
  loadPreviewOutfit(shown.id);
  startPreviewLoop();
}

// Attach helper functions to window for global access
if (typeof window !== 'undefined') {
  window.openArmoryModal = openArmoryModal;
  window.closeArmoryModal = closeArmoryModal;
  window.loadPreviewOutfit = loadPreviewOutfit;
}
