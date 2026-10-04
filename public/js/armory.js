// public/js/armory.js — Consolidated Armory with live 3D outfit cards
// Every outfit card shows the idle .glb of that outfit, slowly rotating on a glowing pedestal.

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
// Live 3D card previews
// One hidden WebGL renderer draws each outfit's idle model in turn and the
// picture is copied into the small 2D canvas of its card. This gives four
// rotating models with a single WebGL context (phones allow only a few).
// ─────────────────────────────────────────────────────────────────────────────
const VIEW = {
  renderer: null,
  scene: null,
  camera: null,
  pedestal: null,
  ring: null,
  models: new Map(),     // outfit id -> loaded idle model
  requested: new Set(),  // outfit ids already queued for download
  queue: Promise.resolve(),
  slots: [],             // { key, color, canvas, ctx, statusEl } for the cards on screen
  raf: null,
  angle: 0,
  unavailable: false,
  generation: 0,         // bumped by releasePreviews(); late model loads are discarded
};

function disposeObject3D(root) {
  root?.traverse?.((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : (child.material ? [child.material] : []);
    materials.forEach((mat) => {
      Object.keys(mat).forEach((key) => { if (mat[key] && mat[key].isTexture) mat[key].dispose(); });
      mat.dispose?.();
    });
  });
}

/**
 * Free everything the card previews hold (models, textures, the WebGL context).
 * Called when a match starts: the arena needs that memory, and phones — iPhones
 * above all — reload the page when a tab uses too much. The previews are rebuilt
 * the next time the armory is rendered.
 */
export function releasePreviews() {
  VIEW.generation++;
  if (VIEW.raf) { cancelAnimationFrame(VIEW.raf); VIEW.raf = null; }
  VIEW.slots = [];
  VIEW.models.forEach((model) => { VIEW.scene?.remove(model); disposeObject3D(model); });
  VIEW.models.clear();
  VIEW.requested.clear();
  VIEW.queue = Promise.resolve();
  disposeObject3D(VIEW.pedestal);
  disposeObject3D(VIEW.ring);
  if (VIEW.renderer) {
    try {
      VIEW.renderer.dispose();
      VIEW.renderer.forceContextLoss?.();
    } catch (e) {
      console.warn('[armory] Could not release the preview renderer:', e);
    }
  }
  VIEW.renderer = VIEW.scene = VIEW.camera = VIEW.pedestal = VIEW.ring = null;
}

function getTHREE() {
  return (typeof THREE !== 'undefined') ? THREE : window.THREE;
}

function ensurePreviewEngine() {
  if (VIEW.renderer) return true;
  if (VIEW.unavailable) return false;
  const T = getTHREE();
  if (!T || !T.WebGLRenderer) return false; // library not loaded yet: retried on next render

  try {
    VIEW.renderer = new T.WebGLRenderer({
      canvas: document.createElement('canvas'),
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
  } catch (err) {
    console.warn('[armory] WebGL is not available for outfit previews:', err);
    VIEW.unavailable = true;
    return false;
  }
  VIEW.renderer.setClearColor(0x000000, 0);
  if (T.sRGBEncoding) VIEW.renderer.outputEncoding = T.sRGBEncoding;

  VIEW.scene = new T.Scene();

  // The model is normalised to 3.2 units tall, standing on y = 0
  VIEW.camera = new T.PerspectiveCamera(40, 1, 0.1, 100);
  VIEW.camera.position.set(0, 1.9, 5.8);
  VIEW.camera.lookAt(0, 1.55, 0);

  // Soft studio lighting
  VIEW.scene.add(new T.AmbientLight(0xffffff, 1.6));
  const keyLight = new T.DirectionalLight(0xffffff, 2.2);
  keyLight.position.set(3, 5, 4);
  VIEW.scene.add(keyLight);
  const rimLight = new T.DirectionalLight(0x38bdf8, 1.8);
  rimLight.position.set(-3, 3, -4);
  VIEW.scene.add(rimLight);

  // Glowing pedestal under the character
  VIEW.pedestal = new T.Mesh(
    new T.CylinderGeometry(1.6, 1.8, 0.2, 32),
    new T.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x00cfff, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.7 })
  );
  VIEW.pedestal.position.set(0, -0.1, 0);
  VIEW.scene.add(VIEW.pedestal);

  VIEW.ring = new T.Mesh(
    new T.RingGeometry(1.5, 1.68, 32),
    new T.MeshBasicMaterial({ color: 0x38bdf8, side: T.DoubleSide, transparent: true, opacity: 0.85 })
  );
  VIEW.ring.rotation.x = -Math.PI / 2;
  VIEW.ring.position.set(0, 0.01, 0);
  VIEW.scene.add(VIEW.ring);

  return true;
}

function setSlotStatus(key, msg) {
  VIEW.slots.forEach((slot) => {
    if (slot.key !== key || !slot.statusEl) return;
    slot.statusEl.textContent = msg;
    slot.statusEl.style.display = msg ? 'block' : 'none';
  });
}

/** Download the idle model of one outfit: /assets/character/player_<id>_idle.glb */
function loadIdleModel(key) {
  return new Promise((resolve) => {
    const T = getTHREE();
    const GLTFLoaderClass = T?.GLTFLoader || window.THREE?.GLTFLoader;
    if (!GLTFLoaderClass) {
      setSlotStatus(key, 'Chưa nạp xong thư viện 3D');
      VIEW.requested.delete(key);
      return resolve();
    }

    const loader = new GLTFLoaderClass();
    // Some models (player_default_idle.glb) are Draco-compressed: without a
    // decoder the loader rejects them, so configure it exactly like the arena does.
    const DracoLoaderClass = T.DRACOLoader || window.THREE?.DRACOLoader;
    if (DracoLoaderClass) {
      try {
        const dracoLoader = new DracoLoaderClass();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        loader.setDRACOLoader(dracoLoader);
      } catch (e) {
        console.warn('[armory] DRACOLoader init warning:', e);
      }
    }

    const url = `/assets/character/player_${key}_idle.glb`;
    const generation = VIEW.generation;
    loader.load(
      url,
      (gltf) => {
        const mesh = gltf.scene || gltf.scenes[0];
        if (generation !== VIEW.generation || !VIEW.scene) {
          // The previews were released (a match started) while this file was downloading
          disposeObject3D(mesh);
          return resolve();
        }

        // Normalise height and stand the model on the pedestal
        const box = new T.Box3().setFromObject(mesh);
        const size = box.getSize(new T.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;
        const scale = 3.2 / maxDim;
        mesh.scale.set(scale, scale, scale);
        const scaledBox = new T.Box3().setFromObject(mesh);
        const center = scaledBox.getCenter(new T.Vector3());
        mesh.position.set(-center.x, -scaledBox.min.y, -center.z);

        // Spin around the model's own centre
        const pivot = new T.Group();
        pivot.add(mesh);
        pivot.visible = false;
        VIEW.scene.add(pivot);
        VIEW.models.set(key, pivot);

        setSlotStatus(key, '');
        resolve();
      },
      undefined,
      (err) => {
        console.warn(`[armory] Could not load GLB from ${url}`, err);
        if (generation === VIEW.generation) {
          setSlotStatus(key, 'Không tải được mô hình 3D');
          VIEW.requested.delete(key); // allow a retry on the next render
        }
        resolve();
      }
    );
  });
}

/** Queue the download of an outfit's model (one at a time, to spare mobile data and memory). */
function requestIdleModel(key) {
  if (VIEW.models.has(key)) { setSlotStatus(key, ''); return; }
  setSlotStatus(key, 'Đang tải mô hình 3D…');
  if (VIEW.requested.has(key)) return;
  VIEW.requested.add(key);
  VIEW.queue = VIEW.queue.then(() => loadIdleModel(key));
}

function drawPreviewFrame() {
  const slots = VIEW.slots.filter(slot => slot.canvas.isConnected);
  if (slots.length === 0 || !VIEW.renderer) {
    VIEW.raf = null; // armory no longer on the page: stop until it is rendered again
    return;
  }

  VIEW.angle += 0.008; // slow turn, about 13 s per revolution
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  for (const slot of slots) {
    if (slot.canvas.offsetParent === null) continue; // lobby hidden
    const model = VIEW.models.get(slot.key);
    if (!model) continue;

    const w = Math.round(slot.canvas.clientWidth * dpr);
    const h = Math.round(slot.canvas.clientHeight * dpr);
    if (!w || !h) continue;
    if (slot.canvas.width !== w || slot.canvas.height !== h) {
      slot.canvas.width = w;
      slot.canvas.height = h;
    }

    VIEW.renderer.setSize(w, h, false);
    VIEW.camera.aspect = w / h;
    VIEW.camera.updateProjectionMatrix();

    VIEW.models.forEach((m) => { m.visible = (m === model); });
    model.rotation.y = VIEW.angle;
    VIEW.pedestal.material.emissive.set(slot.color);
    VIEW.ring.material.color.set(slot.color);

    VIEW.renderer.render(VIEW.scene, VIEW.camera);
    slot.ctx.clearRect(0, 0, w, h);
    slot.ctx.drawImage(VIEW.renderer.domElement, 0, 0, w, h);
  }

  VIEW.raf = requestAnimationFrame(drawPreviewFrame);
}

function startPreviewLoop() {
  if (!VIEW.raf) VIEW.raf = requestAnimationFrame(drawPreviewFrame);
}

/** Kept for main.js: the separate 3D modal no longer exists, cards show the model directly. */
export function bindArmoryModalEvents() {}

/**
 * Render the Consolidated Armory UI into the target container (e.g. Lobby section).
 * Each of the 4 outfit cards shows its idle 3D model, slowly rotating.
 */
export function renderArmory(container, user = null, onChange = null) {
  if (!container) return;
  container.innerHTML = '';
  VIEW.slots = [];

  const engineReady = ensurePreviewEngine();
  const equipped = getEquippedOutfit();

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
        Chọn trang phục xuất trận — Sát thương &amp; Kháng thuộc tính tương ứng
      </div>
    </div>
    <div style="font-size: 10px; font-weight: 700; color: #06d6a0; background: rgba(6,214,160,0.1); padding: 5px 10px; border-radius: 6px; border: 1px solid rgba(6,214,160,0.3);">
      Đang mặc: <b style="color:#fff; text-transform: uppercase;">${equipped}</b>
    </div>
  `;
  wrap.appendChild(head);

  // 4 Outfit Cards Grid
  const grid = document.createElement('div');
  grid.style.cssText = `
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  `;

  OUTFITS.forEach((outfit) => {
    const isEquipped = (equipped === outfit.id);
    const status = getOutfitStatus(outfit.id, user);

    const card = document.createElement('div');
    card.className = `armory-card ${isEquipped ? 'equipped' : ''} ${status.isUnlocked ? 'unlocked' : 'locked'}`;
    card.style.cssText = `
      background: ${isEquipped ? 'rgba(15, 23, 42, 0.95)' : 'rgba(15, 23, 42, 0.7)'};
      border: 2px solid ${isEquipped ? '#06d6a0' : (status.isUnlocked ? outfit.color : 'rgba(255,255,255,0.12)')};
      border-radius: 10px;
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      position: relative;
      transition: all .25s ease;
      box-shadow: ${isEquipped ? '0 0 20px rgba(6, 214, 160, 0.45)' : (status.isUnlocked ? outfit.borderGlow : 'none')};
    `;

    const cardTop = document.createElement('div');
    cardTop.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
    cardTop.innerHTML = `
      <span style="font-size: 12px; font-weight: 800; color: ${outfit.color};">${outfit.name}</span>
      <span style="font-size: 9px; font-weight: 700; color: #aaa; text-transform: uppercase;">${outfit.subTitle}</span>
    `;
    card.appendChild(cardTop);

    // Live 3D picture of the outfit (idle .glb, rotating)
    const viewWrap = document.createElement('div');
    viewWrap.className = 'armory-card-3d';
    viewWrap.style.cssText = `
      width: 100%;
      height: 220px;
      border-radius: 8px;
      overflow: hidden;
      background: radial-gradient(circle at center 65%, #1e293b 0%, #070a14 75%);
      border: 1.5px solid ${isEquipped ? '#06d6a0' : 'rgba(255,255,255,0.1)'};
      position: relative;
    `;

    const viewCanvas = document.createElement('canvas');
    viewCanvas.style.cssText = `
      width: 100%;
      height: 100%;
      display: block;
      filter: ${status.isUnlocked ? 'none' : 'grayscale(70%) brightness(0.6)'};
    `;
    viewWrap.appendChild(viewCanvas);

    const statusEl = document.createElement('div');
    statusEl.style.cssText = 'position:absolute;left:50%;bottom:8px;transform:translateX(-50%);font-size:9px;color:#38bdf8;background:rgba(15,23,42,0.85);padding:3px 10px;border-radius:6px;pointer-events:none;font-weight:700;border:1px solid rgba(56,189,248,0.3);white-space:nowrap;display:none;';
    viewWrap.appendChild(statusEl);

    // If locked, overlay lock icon on top of the (dimmed) model
    if (!status.isUnlocked) {
      const lockOverlay = document.createElement('div');
      lockOverlay.style.cssText = `
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.35);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
        pointer-events: none;
      `;
      lockOverlay.innerHTML = `
        <span style="font-size: 28px;">🔒</span>
        <span style="font-size: 10px; font-weight: 800; color: #ffcc00; background: rgba(0,0,0,0.8); padding: 3px 8px; border-radius: 4px; border: 1px solid #ffcc00;">
          ${status.badgeText}
        </span>
      `;
      viewWrap.appendChild(lockOverlay);
    }

    card.appendChild(viewWrap);
    VIEW.slots.push({
      key: outfit.id,
      color: outfit.color,
      canvas: viewCanvas,
      ctx: viewCanvas.getContext('2d'),
      statusEl,
    });

    const statsRow = document.createElement('div');
    statsRow.style.cssText = 'display:flex; justify-content:space-between; font-size:10px; font-weight:700; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:6px;';
    statsRow.innerHTML = `
      <span style="color:#ffcc00;">⚔️ ${outfit.damage}</span>
      <span style="color:${outfit.color};">🛡️ ${outfit.defense}</span>
    `;
    card.appendChild(statsRow);

    const actionBtn = document.createElement('button');
    actionBtn.className = 'btn';
    actionBtn.style.cssText = `
      width: 100%;
      padding: 10px;
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
      actionBtn.onclick = () => {
        equipOutfit(outfit.id, () => {
          renderArmory(container, user, onChange);
          if (typeof onChange === 'function') onChange(outfit.id);
        });
      };
    } else {
      actionBtn.disabled = true;
      actionBtn.style.background = 'rgba(255, 255, 255, 0.05)';
      actionBtn.style.color = '#94a3b8';
      actionBtn.style.border = '1px solid rgba(255, 255, 255, 0.1)';
      actionBtn.style.cursor = 'not-allowed';
      actionBtn.innerHTML = `🔒 ${status.badgeText}`;
    }
    card.appendChild(actionBtn);

    const lore = document.createElement('div');
    lore.style.cssText = 'font-size: 8.5px; color: #64748b; text-align: center; font-style: italic;';
    lore.textContent = outfit.lore;
    card.appendChild(lore);

    grid.appendChild(card);
  });

  wrap.appendChild(grid);
  container.appendChild(wrap);

  if (engineReady) {
    // The worn outfit first, then the others
    [equipped, ...OUTFITS.map(o => o.id).filter(id => id !== equipped)].forEach(requestIdleModel);
    startPreviewLoop();
  } else {
    VIEW.slots.forEach(slot => setSlotStatus(slot.key, 'Thiết bị không hiển thị được mô hình 3D'));
  }
}
