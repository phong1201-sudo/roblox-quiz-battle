// public/js/armory.js — Consolidated Armory with 2D Idle Poster Previews & Progression
// Consolidates "Trang Bị & Bộ Kỹ Năng" into a single clean "Kho Trang Phục Nguyên Tố"

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
    desc: 'Tích tụ điện năng, chém sấm sét giáng thế. Sát thương nguyên tố cao.',
    damage: '2 HP / đòn (Sét)',
    defense: 'Kháng Sét',
    reqScore: 50,
    lore: 'Mở khóa khi đạt 50/50 điểm ải Lôi Quái (Khó).'
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
    desc: 'Lửa địa ngục thiêu đốt vạn vật, đòn chém bốc cháy cuồng nộ.',
    damage: '2 HP / đòn (Lửa)',
    defense: 'Kháng Lửa',
    reqScore: 50,
    lore: 'Mở khóa khi đạt 50/50 điểm ải Hỏa Ma Vương (Khó).'
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
    desc: 'Hàn băng ngưng đọng, lưỡi kiếm đóng băng boss trên từng nhát chém.',
    damage: '2 HP / đòn (Băng)',
    defense: 'Kháng Băng',
    reqScore: 50,
    lore: 'Mở khóa khi đạt 50/50 điểm ải Băng Tinh (Khó).'
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
  return saved || 'default';
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

/**
 * Render the Consolidated Armory UI into the target container
 */
export function renderArmory(container, user = null, onChange = null) {
  if (!container) return;
  container.innerHTML = '';

  const equipped = getEquippedOutfit();

  const wrap = document.createElement('div');
  wrap.className = 'armory-consolidated-wrap';
  wrap.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: 'Be Vietnam Pro', sans-serif;
  `;

  // Header
  const head = document.createElement('div');
  head.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1.5px solid rgba(0, 207, 255, 0.3);
    padding-bottom: 8px;
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
    <div style="font-size: 10px; font-weight: 700; color: #00cfff; background: rgba(0,207,255,0.1); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(0,207,255,0.25);">
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

    // Top Header in card
    const cardTop = document.createElement('div');
    cardTop.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';
    cardTop.innerHTML = `
      <span style="font-size: 12px; font-weight: 800; color: ${outfit.color};">${outfit.name}</span>
      <span style="font-size: 9px; font-weight: 700; color: #aaa; text-transform: uppercase;">${outfit.subTitle}</span>
    `;
    card.appendChild(cardTop);

    // 2D Artwork Poster Preview
    const imgWrap = document.createElement('div');
    imgWrap.style.cssText = `
      width: 100%;
      height: 180px;
      border-radius: 8px;
      overflow: hidden;
      background: #070913;
      border: 1.5px solid ${isEquipped ? '#06d6a0' : 'rgba(255,255,255,0.1)'};
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const img = document.createElement('img');
    img.src = outfit.preview;
    img.alt = outfit.name;
    img.loading = 'lazy';
    img.style.cssText = `
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center top;
      transition: transform .3s ease;
      filter: ${status.isUnlocked ? 'none' : 'grayscale(70%) brightness(0.6)'};
    `;

    // If locked, overlay lock icon
    if (!status.isUnlocked) {
      const lockOverlay = document.createElement('div');
      lockOverlay.style.cssText = `
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 6px;
      `;
      lockOverlay.innerHTML = `
        <span style="font-size: 28px;">🔒</span>
        <span style="font-size: 10px; font-weight: 800; color: #ffcc00; background: rgba(0,0,0,0.8); padding: 3px 8px; border-radius: 4px; border: 1px solid #ffcc00;">
          ${status.badgeText}
        </span>
      `;
      imgWrap.appendChild(img);
      imgWrap.appendChild(lockOverlay);
    } else {
      imgWrap.appendChild(img);
    }

    card.appendChild(imgWrap);

    // Stats specs row
    const statsRow = document.createElement('div');
    statsRow.style.cssText = 'display:flex; justify-content:space-between; font-size:10px; font-weight:700; background:rgba(0,0,0,0.3); padding:6px 8px; border-radius:6px;';
    statsRow.innerHTML = `
      <span style="color:#ffcc00;">⚔️ ${outfit.damage}</span>
      <span style="color:${outfit.color};">🛡️ ${outfit.defense}</span>
    `;
    card.appendChild(statsRow);

    // Action button or lock badge
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

    // Lore note
    const lore = document.createElement('div');
    lore.style.cssText = 'font-size: 8.5px; color: #64748b; text-align: center; font-style: italic;';
    lore.textContent = outfit.lore;
    card.appendChild(lore);

    grid.appendChild(card);
  });

  wrap.appendChild(grid);
  container.appendChild(wrap);
}
