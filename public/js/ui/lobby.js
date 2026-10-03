import { socket } from '../socket.js';
import { showScreen } from '../main.js';
import * as Audio from '../audio.js';
import * as Multiplayer from '../multiplayer.js';
import * as hud from './hud.js';
import * as scene from '../game/scene.js';
import * as results from './results.js';
import * as Auth from '../auth.js';
import * as Armory from '../armory.js';
// THREE is available as a global from the CDN script tag

// ─────────────────────────────────────────────────────────────────────────────
// Equipment catalogue
// ─────────────────────────────────────────────────────────────────────────────
const EQUIPMENT_SLOTS = {
  outfit: {
    label: '👕 Trang phục',
    items: [
      { id: 'default', name: 'Mặc định', color: '#888888', el: null },
      { id: 'thunder', name: '⚡ Lôi Thần', color: '#00cfff', el: 'thunder' },
      { id: 'fire',    name: '🔥 Hỏa Thần', color: '#ff6b00', el: 'fire' },
      { id: 'frost',   name: '❄️ Băng Thần', color: '#88ddff', el: 'frost' },
    ]
  },
  weapon: {
    label: '⚔️ Vũ khí',
    items: [
      { id: 'default', name: 'Mặc định', color: '#8b6914', el: null },
      { id: 'thunder', name: '⚡ Lôi Kiếm', color: '#00cfff', el: 'thunder' },
      { id: 'fire',    name: '🔥 Hỏa Kiếm', color: '#ff6b00', el: 'fire' },
      { id: 'frost',   name: '❄️ Băng Kiếm', color: '#88ddff', el: 'frost' },
    ]
  },
};

const DEFAULT_EQUIPMENT = { outfit: 'default', weapon: 'default' };
const LS_EQUIPPED_KEY = 'player_equipped';

function _loadEquipped() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_EQUIPPED_KEY));
    if (saved && (saved.outfit || saved.weapon)) {
      return {
        outfit: saved.outfit || 'default',
        weapon: saved.weapon || 'default',
      };
    }
  } catch (e) {}
  return { ...DEFAULT_EQUIPMENT };
}

// Module-level equipment state (synced to window.gameState.equipped)
let equipment = _loadEquipped();

function _syncEquippedState() {
  const outfitName = equipment?.outfit || 'default';
  try {
    sessionStorage.setItem('selectedOutfit', outfitName);
    localStorage.setItem('selectedOutfit', outfitName);
  } catch (e) {}

  if (!window.gameState) return;
  window.gameState.equipped = { outfit: equipment.outfit, weapon: equipment.weapon };
  window.gameState.equipment = { ...window.gameState.equipped };

  const isFullSet = (equipment.outfit === equipment.weapon && equipment.outfit !== 'default');
  window.gameState.equippedSet = isFullSet ? equipment.outfit : null;
  window.gameState.thunderSet  = (isFullSet && equipment.outfit === 'thunder');
  window.gameState.damagePerHit = isFullSet ? 2 : 1;

  try {
    Multiplayer.updateEquipment(window.gameState.equipped);
  } catch(e) {}
}

function _isItemUnlocked(slot, itemId) {
  if (itemId === 'default') return true;
  if (window._godFather === true) return true;
  const user = window.gameState || {};
  const inv = user.inventory || {};
  const elInv = inv[itemId];
  if (!Array.isArray(elInv)) return false;
  return elInv.includes(slot);
}

// ─────────────────────────────────────────────────────────────────────────────
// Draw a small 80×96 character preview onto a canvas
// ─────────────────────────────────────────────────────────────────────────────
function drawWardrobePreview(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#0d0a1e';
  ctx.fillRect(0, 0, W, H);

  const outfitItem = EQUIPMENT_SLOTS.outfit.items.find(i => i.id === equipment.outfit) || EQUIPMENT_SLOTS.outfit.items[0];
  const weaponItem = EQUIPMENT_SLOTS.weapon.items.find(i => i.id === equipment.weapon) || EQUIPMENT_SLOTS.weapon.items[0];
  const outfitColor = outfitItem.color;
  const weaponColor = weaponItem.color;

  const skin = '#f5c4a0';

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(W/2, H-4, 14, 4, 0, 0, Math.PI*2); ctx.fill();

  // Boots/Legs (Outfit color darker)
  ctx.fillStyle = outfitColor;
  ctx.fillRect(W/2-11, H-28, 9, 22);
  ctx.fillRect(W/2+2,  H-28, 9, 22);

  // Torso / Outfit
  ctx.fillRect(W/2-13, H-48, 26, 21);

  // Arms (skin / sleeves)
  ctx.fillStyle = skin;
  ctx.fillRect(W/2-20, H-47, 8, 16);
  ctx.fillRect(W/2+12, H-47, 8, 16);

  // Head (skin)
  ctx.fillStyle = skin;
  ctx.fillRect(W/2-10, H-66, 20, 18);

  // Outfit collar/cap
  ctx.fillStyle = outfitColor;
  ctx.fillRect(W/2-11, H-70, 22, 6);

  // Eyes
  ctx.fillStyle = '#222';
  ctx.fillRect(W/2-6, H-60, 3, 3);
  ctx.fillRect(W/2+3, H-60, 3, 3);

  // Weapon (held in hand)
  ctx.fillStyle = weaponColor;
  ctx.fillRect(W/2-22, H-62, 5, 26);
  ctx.fillStyle = '#ffcc00';
  ctx.fillRect(W/2-24, H-46, 9, 3);

  // Full set glow outline if full set active
  const isFullSet = (equipment.outfit === equipment.weapon && equipment.outfit !== 'default');
  if (isFullSet || window.gameState?.thunderSet) {
    ctx.strokeStyle = outfitColor;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = outfitColor;
    ctx.strokeRect(2, 2, W-4, H-4);
    ctx.shadowBlur = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the wardrobe panel into a container element (Outfit & Weapon only)
// ─────────────────────────────────────────────────────────────────────────────
function buildWardrobeUI(container, previewCanvas) {
  container.innerHTML = '';
  _syncEquippedState();

  Object.entries(EQUIPMENT_SLOTS).forEach(([slot, def]) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; flex-direction:column; gap:4px; margin-bottom:8px;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';
    const label = document.createElement('span');
    label.textContent = def.label;
    label.style.cssText = 'font-size:11px; font-weight:700; color:#ffcc00; font-family:"Be Vietnam Pro",sans-serif;';
    header.appendChild(label);
    row.appendChild(header);

    const btnGrid = document.createElement('div');
    btnGrid.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:6px;';

    def.items.forEach(item => {
      const isUnlocked = _isItemUnlocked(slot, item.id);
      const isSelected = equipment[slot] === item.id;

      const btn = document.createElement('button');
      btn.dataset.slot = slot;
      btn.dataset.itemId = item.id;
      btn.style.cssText = `
        padding:6px 8px; font-size:10px; font-weight:700;
        font-family:'Be Vietnam Pro',sans-serif; cursor:${isUnlocked ? 'pointer' : 'not-allowed'};
        border-radius:6px; border:2px solid ${isSelected ? '#ffcc00' : 'rgba(255,255,255,0.1)'};
        background:${isSelected ? item.color + '44' : (isUnlocked ? item.color + '1a' : 'rgba(30,30,40,0.6)')};
        color:${isUnlocked ? '#eee' : '#666'};
        display:flex; align-items:center; gap:6px; opacity:${isUnlocked ? '1' : '0.5'};
        transition:all 0.15s;
      `;

      // Swatch
      const swatch = document.createElement('span');
      swatch.style.cssText = `width:10px;height:10px;border-radius:2px;background:${item.color};flex-shrink:0;${isUnlocked ? '' : 'filter:grayscale(1);'}`;
      btn.appendChild(swatch);

      const nameSpan = document.createElement('span');
      nameSpan.textContent = item.name + (isUnlocked ? '' : ' 🔒');
      nameSpan.style.cssText = 'flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
      btn.appendChild(nameSpan);

      if (isSelected) {
        btn.style.boxShadow = `0 0 8px ${item.color}88`;
      }

      if (isUnlocked) {
        btn.addEventListener('click', () => {
          container.querySelectorAll(`[data-slot="${slot}"]`).forEach(b => {
            const sibItem = def.items.find(i => i.id === b.dataset.itemId);
            b.style.borderColor = 'rgba(255,255,255,0.1)';
            b.style.background = (sibItem?.color || '#888') + '1a';
            b.style.boxShadow = 'none';
          });
          btn.style.borderColor = '#ffcc00';
          btn.style.background = item.color + '44';
          btn.style.boxShadow = `0 0 8px ${item.color}88`;

          equipment[slot] = item.id;
          if (slot === 'outfit') {
            try {
              sessionStorage.setItem('selectedOutfit', item.id);
              localStorage.setItem('selectedOutfit', item.id);
            } catch(e) {}
          }
          try {
            localStorage.setItem(LS_EQUIPPED_KEY, JSON.stringify(equipment));
          } catch(e) {}

          _syncEquippedState();

          if (previewCanvas) drawWardrobePreview(previewCanvas);

          const sec = document.getElementById('wardrobe-slots')?.parentElement?.parentElement;
          if (sec && window.__rebuildSetPicker) window.__rebuildSetPicker(sec);
        });
      }

      btnGrid.appendChild(btn);
    });

    row.appendChild(btnGrid);
    container.appendChild(row);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Thunder Set — called from hud.js milestone popup
// ─────────────────────────────────────────────────────────────────────────────
export function applyThunderSet() {
  equipment = { outfit: 'thunder', weapon: 'thunder' };
  try { localStorage.setItem(LS_EQUIPPED_KEY, JSON.stringify(equipment)); } catch(e) {}
  _syncEquippedState();
  const container = document.getElementById('wardrobe-slots');
  const preview   = document.getElementById('wardrobe-preview');
  if (container) buildWardrobeUI(container, preview);
  if (preview)   drawWardrobePreview(preview);
  if (preview) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,255,255,0.18);pointer-events:none;z-index:9999;transition:opacity 0.8s';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 900); });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// localStorage — Unlocked Elemental Sets
//   Normal players → 'player_unlockedSets'
//   God Father     → all sets, no localStorage write needed
// ─────────────────────────────────────────────────────────────────────────────
const LS_KEY = 'player_unlockedSets';   // key for normal player progress

function _readPlayerSets() {
  try { const v = JSON.parse(localStorage.getItem(LS_KEY) || '[]'); return Array.isArray(v) ? v : []; }
  catch(e) { return []; }
}

export function addUnlockedSet(setName) {
  if (window._godFather) return;   // admin unlocks are runtime-only
  // Update in-memory gameState so the picker reflects immediately
  if (window.gameState) {
    if (!Array.isArray(window.gameState.unlockedSets)) window.gameState.unlockedSets = [];
    if (!window.gameState.unlockedSets.includes(setName))
      window.gameState.unlockedSets.push(setName);
  }
  // Also persist locally as fallback (server-side persisted via main.js persistUnlockSet)
  const sets = _readPlayerSets();
  if (!sets.includes(setName)) { sets.push(setName); localStorage.setItem(LS_KEY, JSON.stringify(sets)); }
}

// Helper: is a given set unlocked for the current player?
// Source of truth = window.gameState.unlockedSets (populated by server after login)
function _isSetUnlocked(setId) {
  if (window._godFather === true) return true;          // admin → all unlocked
  const sets = window.gameState?.unlockedSets;
  return Array.isArray(sets) && sets.includes(setId);   // server-granted sets
}

const ALL_ELEMENTAL_SETS = [
  { id:'thunder', label:'⚡ Thunder', color:'#00ffcc', bg:'rgba(0,80,80,0.5)',  border:'#00ffcc' },
  { id:'fire',    label:'🔥 Fire',    color:'#ff6600', bg:'rgba(80,20,0,0.5)',  border:'#ff6600' },
  { id:'frost',   label:'❄️ Frost',   color:'#88ddff', bg:'rgba(0,30,60,0.5)', border:'#88ddff' },
];

function buildElementalSetPicker(avatarSection) {
  const existing = document.getElementById('elemental-set-picker');
  if (existing) existing.remove();

  const picker = document.createElement('div');
  picker.id = 'elemental-set-picker';
  picker.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:8px;';

  const lbl = document.createElement('div');
  lbl.textContent = '🗡️ Bộ Trang Bị Nguyên Tố:';
  lbl.style.cssText = 'font-size:11px;font-weight:700;color:#ffcc00;font-family:"Be Vietnam Pro",sans-serif;';
  picker.appendChild(lbl);

  const btnRow = document.createElement('div');
  btnRow.id = 'set-btn-row';
  btnRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start;';

  // ── All 3 elemental sets — lock state derived fresh each render ─────────────
  ALL_ELEMENTAL_SETS.forEach(s => {
    const isUnlocked = _isSetUnlocked(s.id);

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;display:inline-flex;flex-direction:column;align-items:center;gap:2px;';

    const btn = document.createElement('button');
    btn.className = 'btn locked-set-btn';
    btn.setAttribute('data-set-id', s.id);
    btn.textContent = s.label;

    if (isUnlocked) {
      // ── UNLOCKED ─────────────────────────────────────────────────────────
      btn.classList.remove('locked-set');
      btn.removeAttribute('disabled');
      btn.style.cssText = `
        font-size:10px;padding:4px 10px;
        border:2px solid ${s.border};background:${s.bg};
        color:${s.color};font-family:"Be Vietnam Pro",sans-serif;
        font-weight:700;text-shadow:0 0 6px ${s.color};cursor:pointer;
        opacity:1;filter:none;pointer-events:auto;
      `;
      if (window.gameState?.equippedSet === s.id) btn.style.boxShadow = `0 0 12px ${s.color}`;
      btn.onclick = () => {
        if (window.gameState) {
          if (window.gameState.equippedSet === s.id) {
            // Clicking already equipped set toggles off -> defaults to Admin's 3D default model
            window.gameState.equippedSet  = null;
            window.gameState.thunderSet   = false;
            window.gameState.damagePerHit = 1;
            equipment.outfit = 'default';
            equipment.weapon = 'default';
            try {
              sessionStorage.setItem('selectedOutfit', 'default');
              localStorage.setItem('selectedOutfit', 'default');
              localStorage.setItem(LS_EQUIPPED_KEY, JSON.stringify(equipment));
            } catch(e) {}
          } else {
            window.gameState.equippedSet  = s.id;
            window.gameState.thunderSet   = s.id === 'thunder';
            window.gameState.damagePerHit = 2;
            equipment.outfit = s.id;
            equipment.weapon = s.id;
            try {
              sessionStorage.setItem('selectedOutfit', s.id);
              localStorage.setItem('selectedOutfit', s.id);
              localStorage.setItem(LS_EQUIPPED_KEY, JSON.stringify(equipment));
            } catch(e) {}
          }
        }
        _highlightActiveSet(btnRow, window.gameState?.equippedSet);
        if (window.gameState?.equippedSet === s.id) {
          btn.style.boxShadow = `0 0 12px ${s.color}`;
        }
      };
    } else {
      // ── LOCKED — multiple layers of enforcement ───────────────────────────
      btn.classList.add('locked-set');
      btn.setAttribute('disabled', 'true');   // ← HTML disabled attr
      btn.onclick = null;                      // ← JS handler cleared
      btn.style.cssText = `
        font-size:10px;padding:4px 10px;
        border:2px solid ${s.border};background:${s.bg};
        color:${s.color};font-family:"Be Vietnam Pro",sans-serif;
        font-weight:700;
        opacity:0.38;filter:grayscale(85%);
        pointer-events:none;cursor:not-allowed;
      `;
      // Lock badge
      const lockBadge = document.createElement('div');
      lockBadge.textContent = '🔒 Khóa';
      lockBadge.style.cssText = 'font-size:9px;color:#888;font-family:"Be Vietnam Pro",sans-serif;text-align:center;user-select:none;';
      wrapper.appendChild(btn);
      wrapper.appendChild(lockBadge);
      btnRow.appendChild(wrapper);
      return;
    }

    wrapper.appendChild(btn);
    btnRow.appendChild(wrapper);
  });

  picker.appendChild(btnRow);

  // ── Unlock hint + Reset Progress button ──────────────────────────────────────
  if (!window._godFather) {
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;align-items:center;gap:8px;margin-top:3px;flex-wrap:wrap;';

    const unlockedCount = ALL_ELEMENTAL_SETS.filter(s => _isSetUnlocked(s.id)).length;
    if (unlockedCount < 3) {
      const hint = document.createElement('span');
      hint.textContent = `🔒 ${3 - unlockedCount} bộ chưa mở — Trả lời đúng 50 câu để mở khóa!`;
      hint.style.cssText = 'font-size:9px;color:#888;font-family:"Be Vietnam Pro",sans-serif;flex:1;';
      footer.appendChild(hint);
    }

    // Reset Progress button — clears earned sets from localStorage
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🗑 Xóa tiến trình';
    resetBtn.style.cssText = 'font-size:9px;padding:2px 7px;border:1px solid #555;background:rgba(40,0,0,0.6);color:#888;border-radius:3px;cursor:pointer;font-family:"Be Vietnam Pro",sans-serif;';
    resetBtn.onclick = () => {
      if (!confirm('Xóa toàn bộ tiến trình mở khóa bộ trang bị?')) return;
      localStorage.removeItem(LS_KEY);
      // Also purge legacy key from old sessions
      localStorage.removeItem('unlockedSets');
      if (window.gameState) { window.gameState.equippedSet = null; window.gameState.damagePerHit = 1; }
      equipment = { outfit: 'default', weapon: 'default' };
      try {
        sessionStorage.setItem('selectedOutfit', 'default');
        localStorage.setItem('selectedOutfit', 'default');
        localStorage.setItem(LS_EQUIPPED_KEY, JSON.stringify(equipment));
      } catch(e) {}
      buildElementalSetPicker(avatarSection);   // rebuild picker
    };
    footer.appendChild(resetBtn);
    picker.appendChild(footer);
  }

  avatarSection.appendChild(picker);
}

// Highlight selected set button, dim all others
function _highlightActiveSet(btnRow, activeId) {
  btnRow.querySelectorAll('button[data-set-id]').forEach(b => {
    const isAct = b.getAttribute('data-set-id') === activeId;
    b.style.boxShadow = isAct ? '0 0 14px currentColor' : 'none';
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// GOD FATHER ADMIN PANEL
// ─────────────────────────────────────────────────────────────────────────────
function _buildAdminPanel(container, gameState) {
  const existing = document.getElementById('admin-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'admin-panel';
  panel.style.cssText = `
    margin-top:10px; padding:10px 12px; border-radius:8px;
    background:linear-gradient(135deg,rgba(80,0,0,0.8),rgba(30,0,60,0.8));
    border:2px solid #ff2200; font-family:'Be Vietnam Pro',sans-serif;
    display:flex; flex-direction:column; gap:8px;
  `;

  // Badge
  const badge = document.createElement('div');
  badge.textContent = '⚡ GOD FATHER MODE — All Sets Unlocked';
  badge.style.cssText = 'font-size:11px;font-weight:900;color:#ff4444;text-shadow:0 0 8px #ff0000;letter-spacing:1px;';
  panel.appendChild(badge);

  // Instant gear selector
  const gearLabel = document.createElement('div');
  gearLabel.textContent = '🗡️ Instant Gear:';
  gearLabel.style.cssText = 'font-size:10px;color:#ffcc00;font-weight:700;';
  panel.appendChild(gearLabel);

  const gearRow = document.createElement('div');
  gearRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';

  const ADMIN_SETS = [
    { id:null,      label:'🧍 Default',  color:'#888',   glow:'#aaa' },
    { id:'thunder', label:'⚡ Thunder',  color:'#00ffcc', glow:'#00ffcc' },
    { id:'fire',    label:'🔥 Fire',     color:'#ff6600', glow:'#ff4400' },
    { id:'frost',   label:'❄️ Frost',    color:'#88ddff', glow:'#4499cc' },
  ];

  ADMIN_SETS.forEach(s => {
    const b = document.createElement('button');
    b.textContent = s.label;
    b.style.cssText = `font-size:10px;padding:4px 10px;border:2px solid ${s.color};background:rgba(0,0,0,0.5);color:${s.color};border-radius:4px;cursor:pointer;font-family:'Be Vietnam Pro',sans-serif;font-weight:700;`;
    b.onclick = () => {
      if (window.gameState) {
        window.gameState.equippedSet  = s.id;
        window.gameState.thunderSet   = s.id==='thunder';
        window.gameState.damagePerHit = s.id ? 2 : 1;
      }
      gearRow.querySelectorAll('button').forEach(x => { x.style.boxShadow='none'; x.style.borderWidth='2px'; });
      b.style.boxShadow = `0 0 10px ${s.glow}`;
      b.style.borderWidth = '3px';
    };
    if (!window.gameState?.equippedSet && !s.id) b.style.boxShadow=`0 0 10px ${s.glow}`;
    gearRow.appendChild(b);
  });
  panel.appendChild(gearRow);

  // Dev test: inject 5 questions directly
  if (gameState.isHost) {
    const devLabel = document.createElement('div');
    devLabel.textContent = '🧪 Dev Tools:';
    devLabel.style.cssText = 'font-size:10px;color:#ffcc00;font-weight:700;margin-top:4px;';
    panel.appendChild(devLabel);

    const devRow = document.createElement('div');
    devRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;align-items:center;';

    const devBtn = document.createElement('button');
    devBtn.textContent = '⚡ Dev Run (5 Questions)';
    devBtn.style.cssText = 'font-size:10px;padding:4px 12px;border:2px solid #ff4444;background:rgba(100,0,0,0.6);color:#ff4444;border-radius:4px;cursor:pointer;font-weight:700;font-family:"Be Vietnam Pro",sans-serif;';
    const devStatus = document.createElement('span');
    devStatus.style.cssText = 'font-size:9px;color:#aaa;';

    devBtn.onclick = async () => {
      devStatus.textContent = 'Đang tải…';
      try {
        const resp = await fetch(`/api/dev-questions?code=${gameState.code}`, {method:'POST'});
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error||'failed');
        devStatus.textContent = `✓ ${data.questionCount} câu hỏi dev đã tải!`;
        devStatus.style.color = '#06d6a0';
        if (window.gameState) { window.gameState.bossIndex=0; window.gameState.bossElement=null; }
      } catch(e) { devStatus.textContent='Lỗi: '+e.message; devStatus.style.color='#ef233c'; }
    };
    devRow.appendChild(devBtn);
    devRow.appendChild(devStatus);
    panel.appendChild(devRow);
  }

  container.appendChild(panel);
}

// ─────────────────────────────────────────────────────────────────────────────
let currentState;

export function init(gameState) {
  currentState = gameState;

  // Sync equipment and equipped state to gameState
  equipment = _loadEquipped();
  _syncEquippedState();

  // Room code display
  const roomCodeEl = document.getElementById('lobby-room-code');
  if (roomCodeEl) roomCodeEl.textContent = gameState.code;

  updatePlayers(gameState.players);

  // Hide HTML upload section for everyone — replaced by JS-built UI below
  const uploadSection = document.getElementById('upload-section');
  if (uploadSection) uploadSection.style.display = 'none';

  // Hide HTML mode selector — we build our own boss selector
  const modeSelector = document.getElementById('mode-selector');
  if (modeSelector) modeSelector.style.display = 'none';

  // Hide start button — we replace it
  const btnStart = document.getElementById('btn-start');
  if (btnStart) btnStart.style.display = 'none';

  // Cancel Room button (host only)
  const btnCancelRoom = document.getElementById('btn-cancel-room');
  if (btnCancelRoom) {
    btnCancelRoom.style.display = gameState.isHost ? 'inline-block' : 'none';
    btnCancelRoom.onclick = () => {
      try {
        sessionStorage.removeItem('hostedRoomCode');
        localStorage.removeItem('hostedRoomCode');
      } catch(e) {}
      Multiplayer.leaveRoom(gameState.code);
      showScreen('menu');
    };
  }

  // Back button
  const btnBack = document.getElementById('btn-back-menu');
  if (btnBack) {
    btnBack.textContent = gameState.isHost ? '❌ Hủy phòng & Quay lại' : '← Rời phòng & Quay lại';
    btnBack.onclick = () => {
      try {
        sessionStorage.removeItem('hostedRoomCode');
        localStorage.removeItem('hostedRoomCode');
      } catch(e) {}
      Multiplayer.leaveRoom(gameState.code);
      showScreen('menu');
    };
  }

  // avatarSection — main customizer target
  const avatarSection = document.getElementById('avatar-section');
  if (!avatarSection) return;
  avatarSection.innerHTML = '';

  // ══════════════════════════════════════════════════════════════════════════
  // ROLE SPLIT: Admin vs Student
  // ══════════════════════════════════════════════════════════════════════════
  if (window._godFather) {
    _buildAdminDashboard(avatarSection, gameState);
  } else {
    _buildStudentLobby(avatarSection, gameState);
  }

  // Socket listeners
  socket.on('mode_changed', ({ mode }) => {
    if (window.gameState) window.gameState.mode = mode;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE PLAYER MATCH CONTROLLER
// ─────────────────────────────────────────────────────────────────────────────
export async function startSinglePlayerMatch({ bossElement = 'thunder', difficulty = 'medium', outfit = 'default' } = {}) {
  try {
    const user = Auth.getCurrentUser ? Auth.getCurrentUser() : null;
    const myOutfit = outfit || (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('selectedOutfit')) || 'default';
    const isFullSet = (myOutfit !== 'default' && ['thunder', 'fire', 'frost'].includes(myOutfit));

    // 1. Fetch questions for the selected Boss element
    let questions = [];
    try {
      const res = await fetch(`/api/questions/${bossElement}`);
      const data = await res.json();
      if (data && data.questions && data.questions.length > 0) {
        questions = data.questions;
      }
    } catch (e) {
      console.warn('[SinglePlayer] Failed to fetch questions from API:', e);
    }
    if (!questions || questions.length === 0) {
      questions = window.activeQuestionBank?.[bossElement] || [];
    }
    if (!questions || questions.length === 0) {
      questions = [
        { question: 'Thủ đô của Việt Nam là thành phố nào?', options: ['Hà Nội', 'TP. Hồ Chí Minh', 'Đà Nẵng', 'Huế'], answer: 'A' },
        { question: 'Kim loại nào nhẹ nhất trong các kim loại sau?', options: ['Sắt', 'Nhôm', 'Liti', 'Vàng'], answer: 'C' },
        { question: 'Hành tinh nào gần Mặt Trời nhất trong Hệ Mặt Trời?', options: ['Sao Kim', 'Sao Thủy', 'Sao Hỏa', 'Trái Đất'], answer: 'B' },
      ];
    }

    // Shuffle questions
    questions = questions.slice().sort(() => Math.random() - 0.5);
    const limit = difficulty === 'easy' ? 20 : (difficulty === 'medium' ? 30 : 50);
    questions = questions.slice(0, Math.min(limit, questions.length));

    // 2. Build explicit single-player gameState
    window.gameState = {
      myId: 'single_player',
      myName: user?.username || 'Người chơi',
      myColor: '#ff6b35',
      code: null,
      isHost: true,
      isSinglePlayer: true,
      mode: 'single',
      stage: bossElement,
      bossElement: bossElement,
      difficulty: difficulty,
      totalHp: questions.length,
      totalQuestions: questions.length,
      currentQuestionIndex: 0,
      questions: questions,
      playerHp: questions.length,
      bossHp: questions.length,
      correctCount: 0,
      userId: user?.id || null,
      unlockedSets: user?.unlockedSets || [],
      inventory: user?.inventory || { thunder: [], fire: [], frost: [] },
      equipped: { outfit: myOutfit, weapon: myOutfit },
      equippedSet: isFullSet ? myOutfit : null,
      damagePerHit: isFullSet ? 2 : 1,
      hasFullSet: isFullSet,
      players: [
        {
          id: 'single_player',
          name: user?.username || 'Người chơi',
          color: '#ff6b35',
          hp: questions.length,
          ready: true,
          equipped: { outfit: myOutfit, weapon: myOutfit },
          equippedSet: isFullSet ? myOutfit : null
        }
      ]
    };

    // 3. Battle socket listeners are left registered (removing them here would break
    //    multiplayer until the page is reloaded). Not being in a room, this socket
    //    receives no battle events during a single-player match.

    // 4. Switch to battle screen
    showScreen('game');
    Audio.setInBattle(true);

    requestAnimationFrame(() => {
      const canvas = document.getElementById('game-canvas');
      if (canvas && scene.initScene) scene.initScene(canvas);
      if (hud.init) hud.init(window.gameState);
      if (scene.startGame) scene.startGame(window.gameState);

      // Start question 1 after arena transition
      setTimeout(() => {
        presentSinglePlayerQuestion(0);
      }, 1400);
    });

  } catch (err) {
    console.error('[startSinglePlayerMatch] Error launching match:', err);
    alert('Không thể khởi tạo trận đấu chơi đơn: ' + err.message);
  }
}

export function presentSinglePlayerQuestion(qIndex) {
  if (!window.gameState || !window.gameState.isSinglePlayer) return;
  const questions = window.gameState.questions || [];
  if (qIndex >= questions.length || window.gameState.bossHp <= 0 || window.gameState.playerHp <= 0) {
    finishSinglePlayerMatch();
    return;
  }

  window.gameState.currentQuestionIndex = qIndex;
  const q = questions[qIndex];

  let optionsObj = {};
  if (Array.isArray(q.options)) {
    ['A', 'B', 'C', 'D'].forEach((k, idx) => {
      optionsObj[k] = q.options[idx] || '';
    });
  } else {
    optionsObj = q.options || {};
  }

  const qData = {
    index: qIndex + 1,
    total: questions.length,
    question: q.question,
    options: optionsObj,
    timeLimit: 30,
  };

  if (hud.showQuestion) hud.showQuestion(qData);
  if (scene.onQuestion) scene.onQuestion(qData);
}

export function finishSinglePlayerMatch() {
  if (!window.gameState || !window.gameState.isSinglePlayer) return;
  const isVictory = (window.gameState.bossHp <= 0);
  const verdict = isVictory ? (window.gameState.playerHp === window.gameState.totalHp ? 'PERFECT' : 'VICTORY') : 'DEFEAT';

  const resultsData = {
    verdict,
    mode: 'pve',
    element: window.gameState.bossElement,
    difficulty: window.gameState.difficulty,
    scores: { single_player: window.gameState.playerHp * 100 },
    hp: { single_player: window.gameState.playerHp },
    bossHp: window.gameState.bossHp,
  };

  Audio.setInBattle(false);
  try {
    Audio.stopBGM();
    if (isVictory) Audio.playBGM('victory');
  } catch(e) {}

  saveSinglePlayerScore(window.gameState.bossElement, window.gameState.correctCount || 0);

  setTimeout(() => {
    showScreen('results');
    if (results.init) results.init(resultsData, window.gameState);
  }, 1200);
}

// Persist the single-player result to the account (best score per element).
// The server unlocks the elemental outfit once the score reaches 50.
function saveSinglePlayerScore(element, score) {
  const user = Auth.getCurrentUser ? Auth.getCurrentUser() : null;
  if (!user?.id || !element) return;
  fetch('/api/save-score', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id, element, score }),
  }).then(r => r.json()).then(data => {
    if (!data?.ok || !data.user) return;
    // Refresh the locally cached account so the armory shows the new progress
    Object.assign(user, {
      scores:          data.user.scores,
      unlockedSets:    data.user.unlockedSets,
      unlockedOutfits: data.user.unlockedOutfits,
      inventory:       data.user.inventory,
    });
    try {
      sessionStorage.setItem('qb3d_user', JSON.stringify(user));
      localStorage.setItem('qb3d_user', JSON.stringify(user));
    } catch (e) {}
    if (window.gameState) {
      window.gameState.unlockedSets = user.unlockedSets || [];
      window.gameState.inventory    = user.inventory || window.gameState.inventory;
    }
  }).catch(err => console.warn('[SinglePlayer] Could not save score:', err));
}

if (typeof window !== 'undefined') {
  window.startSinglePlayerMatch = startSinglePlayerMatch;
  window.presentSinglePlayerQuestion = presentSinglePlayerQuestion;
  window.finishSinglePlayerMatch = finishSinglePlayerMatch;
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT LOBBY
// ─────────────────────────────────────────────────────────────────────────────
function _buildStudentLobby(container, gameState) {
  const user = window.gameState || {};
  const inventory = user.inventory || { thunder: [], fire: [], frost: [] };
  const unlockedSets = user.unlockedSets || [];
  const FULL_PIECES = ['weapon', 'outfit'];

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

  // ── Section header helper ────────────────────────────────────────────────
  const mkHead = (text) => {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:11px;font-weight:800;color:#ffcc00;letter-spacing:1px;font-family:"Be Vietnam Pro",sans-serif;text-transform:uppercase;border-bottom:1px solid rgba(255,204,0,0.2);padding-bottom:4px;';
    h.textContent = text;
    return h;
  };

  const ELEMENTS = [
    { id: 'thunder', label: '⚡ Sét', boss: 'Lôi Quái', color: '#00cfff', glow: 'rgba(0, 207, 255, 0.35)' },
    { id: 'fire',    label: '🔥 Lửa', boss: 'Hỏa Ma Vương', color: '#ff6b00', glow: 'rgba(255, 107, 0, 0.35)' },
    { id: 'frost',   label: '❄️ Băng', boss: 'Băng Tinh', color: '#88ddff', glow: 'rgba(136, 221, 255, 0.35)' },
  ];

  const DIFFICULTIES = [
    { id: 'easy',   count: 20, label: 'Dễ (20 câu)',        color: '#06d6a0' },
    { id: 'medium', count: 30, label: 'Trung bình (30 câu)', color: '#ffcc00' },
    { id: 'hard',   count: 50, label: 'Khó (50 câu)',        color: '#ef233c' },
  ];

  let selectedBoss = gameState.stage || gameState.element || 'thunder';
  let selectedDiff = gameState.difficulty || 'medium';

  const isSinglePlayer = Boolean(gameState.isSinglePlayer);
  const isHost = Boolean(gameState.isHost);
  const isGuest = !isSinglePlayer && !isHost;

  if (isSinglePlayer) {
    // ── Single Player Entry Banner ──────────────────────────────────────────
    const singleHead = document.createElement('div');
    singleHead.style.cssText = 'background:rgba(15,23,42,0.85);border:2px solid #00cfff;border-radius:10px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 0 16px rgba(0,207,255,0.2);';
    singleHead.innerHTML = `
      <div>
        <div style="font-size:12px;font-weight:900;color:#00cfff;letter-spacing:1px;font-family:'Be Vietnam Pro',sans-serif;text-transform:uppercase;">
          ⚔️ ĐẤU TRƯỜNG CHƠI ĐƠN (1 VS 1 BOSS)
        </div>
        <div style="font-size:9px;color:#94a3b8;margin-top:2px;">
          Bản lĩnh một chọi một — Chọn Ải Nguyên Tố, Độ Khó và Trang Phục xuất trận!
        </div>
      </div>
    `;
    const backBtn = document.createElement('button');
    backBtn.className = 'btn btn-danger';
    backBtn.style.cssText = 'font-size:9px;padding:6px 12px;border-radius:6px;cursor:pointer;';
    backBtn.textContent = '🔙 Quay lại';
    backBtn.onclick = () => {
      showScreen('menu');
      try { Audio.playBGM('lobby'); } catch(e) {}
    };
    singleHead.appendChild(backBtn);
    wrap.appendChild(singleHead);

    // ── Unified Element Selector for Single Player ─────────────────────────
    const elemSection = document.createElement('div');
    elemSection.appendChild(mkHead('🎯 Chọn Ải Boss & Nguyên Tố'));
    const elemGrid = document.createElement('div');
    elemGrid.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
    ELEMENTS.forEach(el => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.cssText = 'flex:1;padding:10px 8px;border-radius:8px;border:2px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all .15s;font-family:"Be Vietnam Pro",sans-serif;';
      const updateVisual = () => {
        const active = (selectedBoss === el.id);
        btn.style.borderColor = active ? el.color : 'rgba(255,255,255,0.12)';
        btn.style.background = active ? el.glow : 'rgba(255,255,255,0.04)';
        btn.style.boxShadow = active ? `0 0 16px ${el.glow}` : 'none';
      };
      btn.innerHTML = `<span style="font-size:16px;">${el.label.split(' ')[0]}</span><span style="font-size:11px;font-weight:800;color:${el.color};">${el.label}</span><span style="font-size:9px;color:#aaa;">Boss ${el.boss}</span>`;
      btn.onclick = () => {
        selectedBoss = el.id;
        if (window.gameState) {
          window.gameState.selectedBoss = el.id;
          window.gameState.bossElement = el.id;
          window.gameState.stage = el.id;
        }
        Array.from(elemGrid.children).forEach((c, idx) => {
          const item = ELEMENTS[idx];
          const active = (selectedBoss === item.id);
          c.style.borderColor = active ? item.color : 'rgba(255,255,255,0.12)';
          c.style.background = active ? item.glow : 'rgba(255,255,255,0.04)';
          c.style.boxShadow = active ? `0 0 16px ${item.glow}` : 'none';
        });
      };
      updateVisual();
      elemGrid.appendChild(btn);
    });
    elemSection.appendChild(elemGrid);
    wrap.appendChild(elemSection);

    // ── Difficulty Selector for Single Player ───────────────────────────────
    const diffSection = document.createElement('div');
    diffSection.appendChild(mkHead('⚖️ Chọn Độ Khó'));
    const diffGrid = document.createElement('div');
    diffGrid.style.cssText = 'display:flex;gap:8px;margin-top:8px;';
    DIFFICULTIES.forEach(d => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.cssText = 'flex:1;padding:10px 8px;border-radius:8px;border:2px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all .15s;font-family:"Be Vietnam Pro",sans-serif;';
      const updateVisual = () => {
        const active = (selectedDiff === d.id);
        btn.style.borderColor = active ? d.color : 'rgba(255,255,255,0.12)';
        btn.style.background = active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
        btn.style.boxShadow = active ? `0 0 14px ${d.color}44` : 'none';
      };
      btn.innerHTML = `<span style="font-size:12px;font-weight:800;color:${d.color};">${d.label}</span><span style="font-size:9px;color:#aaa;">HP Boss: ${d.count}</span>`;
      btn.onclick = () => {
        selectedDiff = d.id;
        if (window.gameState) window.gameState.selectedDifficulty = d.id;
        Array.from(diffGrid.children).forEach((c, idx) => {
          const item = DIFFICULTIES[idx];
          const active = (selectedDiff === item.id);
          c.style.borderColor = active ? item.color : 'rgba(255,255,255,0.12)';
          c.style.background = active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
          c.style.boxShadow = active ? `0 0 14px ${item.color}44` : 'none';
        });
      };
      updateVisual();
      diffGrid.appendChild(btn);
    });
    diffSection.appendChild(diffGrid);
    wrap.appendChild(diffSection);
  } else if (isHost) {
    // ── Multiplayer Room Configuration (Creator/Host Only) ───────────────────
    const roomSection = document.createElement('div');
    roomSection.style.cssText = 'background:rgba(15,23,42,0.7);border:2px solid #00cfff;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:10px;box-shadow:0 0 16px rgba(0,207,255,0.15);';

    const roomHead = document.createElement('div');
    roomHead.style.cssText = 'display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(0,207,255,0.25);padding-bottom:6px;';
    roomHead.innerHTML = `
      <span style="font-size:11px;font-weight:800;color:#00cfff;letter-spacing:1px;font-family:'Be Vietnam Pro',sans-serif;text-transform:uppercase;">
        ⚙️ Cài Đặt Phòng (Chủ Phòng)
      </span>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:9px;color:#aaa;">Phòng: <b style="color:#ffcc00;letter-spacing:2px;">${gameState.code}</b></span>
      </div>
    `;
    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'btn btn-danger';
    leaveBtn.style.cssText = 'font-size:8px;padding:3px 8px;border-radius:4px;cursor:pointer;';
    leaveBtn.textContent = '❌ Hủy phòng';
    leaveBtn.onclick = () => {
      try { sessionStorage.removeItem('hostedRoomCode'); localStorage.removeItem('hostedRoomCode'); } catch(e) {}
      Multiplayer.leaveRoom(gameState.code);
      showScreen('menu');
    };
    roomHead.querySelector('div').appendChild(leaveBtn);
    roomSection.appendChild(roomHead);

    let curMode = gameState.mode || 'team_vs_boss';
    let curStage = gameState.stage || gameState.element || 'thunder';
    let curDiff = gameState.difficulty || 'medium';

    // Mode selection buttons for Host
    const modeRow = document.createElement('div');
    modeRow.style.cssText = 'display:flex;gap:8px;';
    const modes = [
      { id: 'team_vs_boss', label: '👥 Đồng Đội vs Boss', desc: '2 Người vs 1 Quái Vật' },
      { id: 'pvp_1v1',      label: '⚔️ Đấu Đơn 1v1',     desc: 'Đấu Kiếm Sinh Tử' },
    ];
    const modeBtnRefs = [];
    modes.forEach(m => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.cssText = `flex:1;padding:8px 6px;font-size:9px;border-radius:6px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:3px;`;
      btn.innerHTML = `<span style="font-weight:800;font-size:11px;">${m.label}</span><span style="font-size:8px;opacity:0.8;">${m.desc}</span>`;
      const updateVisual = () => {
        const active = (curMode === m.id);
        btn.style.background = active ? 'linear-gradient(135deg, #00cfff, #0284c7)' : 'rgba(255,255,255,0.05)';
        btn.style.color = active ? '#ffffff' : '#94a3b8';
        btn.style.borderColor = active ? '#ffffff' : '#334155';
        btn.style.boxShadow = active ? '0 0 12px rgba(0,207,255,0.4)' : 'none';
      };
      updateVisual();
      modeBtnRefs.push({ id: m.id, update: updateVisual });
      btn.onclick = () => {
        curMode = m.id;
        if (window.gameState) window.gameState.mode = m.id;
        Multiplayer.setRoomMode(m.id);
        modeBtnRefs.forEach(x => x.update());
      };
      modeRow.appendChild(btn);
    });
    roomSection.appendChild(modeRow);

    // Merged Unified Element Selector for Host
    const elemRow = document.createElement('div');
    elemRow.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
    const elemLabel = document.createElement('span');
    elemLabel.style.cssText = 'font-size:9px;color:#aaa;font-weight:700;width:100%;';
    elemLabel.textContent = '🎯 Chọn Ải Boss & Nguyên Tố:';
    elemRow.appendChild(elemLabel);

    const elemBtnRefs = [];
    ELEMENTS.forEach(el => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.cssText = `flex:1;min-width:85px;padding:8px 6px;font-size:9px;border-radius:6px;cursor:pointer;transition:all .15s;display:flex;flex-direction:column;align-items:center;gap:2px;`;
      btn.innerHTML = `<span style="font-size:13px;">${el.label}</span><span style="font-size:8px;color:#cbd5e1;">Boss ${el.boss}</span>`;
      const updateVisual = () => {
        const active = (curStage === el.id);
        btn.style.background = active ? el.color : 'rgba(255,255,255,0.05)';
        btn.style.color = active ? '#050712' : '#ffffff';
        btn.style.borderColor = active ? '#ffffff' : '#334155';
        btn.style.fontWeight = active ? '800' : '600';
        btn.style.boxShadow = active ? `0 0 12px ${el.glow}` : 'none';
      };
      updateVisual();
      elemBtnRefs.push({ id: el.id, update: updateVisual });
      btn.onclick = () => {
        curStage = el.id;
        selectedBoss = el.id;
        if (window.gameState) {
          window.gameState.stage = el.id;
          window.gameState.element = el.id;
          window.gameState.bossElement = el.id;
        }
        Multiplayer.setRoomStage(el.id);
        elemBtnRefs.forEach(x => x.update());
      };
      elemRow.appendChild(btn);
    });
    roomSection.appendChild(elemRow);

    // Difficulty Selector for Host
    const diffRow = document.createElement('div');
    diffRow.style.cssText = 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;';
    const diffLabel = document.createElement('span');
    diffLabel.style.cssText = 'font-size:9px;color:#aaa;font-weight:700;width:100%;';
    diffLabel.textContent = '⚖️ Chọn Độ Khó:';
    diffRow.appendChild(diffLabel);

    const diffBtnRefs = [];
    DIFFICULTIES.forEach(d => {
      const btn = document.createElement('button');
      btn.className = 'btn';
      btn.style.cssText = `flex:1;min-width:85px;padding:8px 6px;font-size:9px;border-radius:6px;cursor:pointer;transition:all .15s;`;
      btn.textContent = d.label;
      const updateVisual = () => {
        const active = (curDiff === d.id);
        btn.style.background = active ? d.color : 'rgba(255,255,255,0.05)';
        btn.style.color = active ? '#050712' : '#ffffff';
        btn.style.borderColor = active ? '#ffffff' : '#334155';
        btn.style.fontWeight = active ? '800' : '600';
      };
      updateVisual();
      diffBtnRefs.push({ id: d.id, update: updateVisual });
      btn.onclick = () => {
        curDiff = d.id;
        selectedDiff = d.id;
        if (window.gameState) window.gameState.difficulty = d.id;
        Multiplayer.setRoomDifficulty(d.id);
        diffBtnRefs.forEach(x => x.update());
      };
      diffRow.appendChild(btn);
    });
    roomSection.appendChild(diffRow);

    wrap.appendChild(roomSection);
  } else {
    // ── Guest / Joiner UI (STRICT LOCKOUT - Host settings hidden) ───────────
    const roomSection = document.createElement('div');
    roomSection.style.cssText = 'background:rgba(15,23,42,0.7);border:2px solid #00cfff;border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:10px;box-shadow:0 0 16px rgba(0,207,255,0.15);';

    const roomHead = document.createElement('div');
    roomHead.style.cssText = 'display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(0,207,255,0.25);padding-bottom:6px;';
    roomHead.innerHTML = `
      <span style="font-size:11px;font-weight:800;color:#00cfff;letter-spacing:1px;font-family:'Be Vietnam Pro',sans-serif;text-transform:uppercase;">
        🎮 Thông Tin Phòng Đấu
      </span>
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:9px;color:#aaa;">Phòng: <b style="color:#ffcc00;letter-spacing:2px;">${gameState.code}</b></span>
      </div>
    `;
    const leaveBtn = document.createElement('button');
    leaveBtn.className = 'btn btn-danger';
    leaveBtn.style.cssText = 'font-size:8px;padding:3px 8px;border-radius:4px;cursor:pointer;';
    leaveBtn.textContent = '🚪 Rời phòng';
    leaveBtn.onclick = () => {
      Multiplayer.leaveRoom(gameState.code);
      showScreen('menu');
    };
    roomHead.querySelector('div').appendChild(leaveBtn);
    roomSection.appendChild(roomHead);

    let curMode = gameState.mode || 'team_vs_boss';
    let curStage = gameState.stage || gameState.element || 'thunder';
    let curDiff = gameState.difficulty || 'medium';

    const lockedSettings = document.createElement('div');
    lockedSettings.style.cssText = 'background:rgba(255,204,0,0.08);border:1.5px solid #ffcc00;border-radius:8px;padding:12px;display:flex;flex-direction:column;gap:6px;';

    const getHostName = () => (window.gameState?.players?.find(p => p.id === (window.gameState?.hostId || gameState.hostId))?.name) || 'Chủ phòng';
    const getModeName = (m) => (m === 'pvp_1v1' ? '⚔️ Đấu Đơn 1v1 (PvP)' : '👥 Đồng Đội vs Boss (Team)');
    const getStageName = (s) => (s === 'fire' ? '🔥 Hỏa (Hỏa Ma Vương)' : (s === 'frost' ? '❄️ Băng (Băng Tinh)' : '⚡ Sét (Lôi Quái)'));
    const getDiffName = (d) => (d === 'easy' ? 'Dễ (20 câu)' : (d === 'hard' ? 'Khó (50 câu)' : 'Trung bình (30 câu)'));

    const updateGuestBanner = () => {
      lockedSettings.innerHTML = `
        <div style="font-size:11px;font-weight:800;color:#ffcc00;font-family:'Be Vietnam Pro',sans-serif;letter-spacing:0.5px;">
          🎯 Phòng do <span style="color:#00cfff;">${getHostName()}</span> thiết lập
        </div>
        <div id="guest-room-status" style="font-size:10px;color:#cbd5e1;font-family:'Be Vietnam Pro',sans-serif;margin-top:2px;">
          Chế độ: <b style="color:#00cfff;">${getModeName(curMode)}</b> | Ải Boss: <b style="color:#ffcc00;">${getStageName(curStage)}</b> | Độ khó: <b style="color:#34d399;">${getDiffName(curDiff)}</b>
        </div>
        <div style="font-size:9.5px;color:#94a3b8;font-style:italic;margin-top:2px;">
          (Bạn chỉ cần chọn Trang phục bên dưới và bấm Sẵn sàng để xuất trận!)
        </div>
      `;
    };
    updateGuestBanner();

    socket.on('mode_changed', ({ mode }) => { curMode = mode; updateGuestBanner(); });
    socket.on('stage_changed', ({ stage }) => { curStage = stage; selectedBoss = stage; updateGuestBanner(); });
    socket.on('difficulty_changed', ({ difficulty }) => { curDiff = difficulty; updateGuestBanner(); });
    socket.on('room_state_update', (d) => {
      if (d.mode) curMode = d.mode;
      if (d.stage) { curStage = d.stage; selectedBoss = d.stage; }
      if (d.difficulty) curDiff = d.difficulty;
      updateGuestBanner();
    });

    roomSection.appendChild(lockedSettings);
    wrap.appendChild(roomSection);
  }

  // ── Consolidated Armory: Kho Trang Phục Nguyên Tố ───────────────────────
  const armoryContainer = document.createElement('div');
  armoryContainer.id = 'armory-section-wrap';
  wrap.appendChild(armoryContainer);

  Armory.renderArmory(armoryContainer, user, (newOutfit) => {
    _syncEquippedState();
    if (typeof window.updateLobbyReadyUI === 'function') {
      window.updateLobbyReadyUI(window.gameState?.players);
    }
  });

  // ── 4. Ready & Battle Control Center (For BOTH Players) ──────────────────
  if (gameState.isSinglePlayer) {
    const singleActionSection = document.createElement('div');
    singleActionSection.id = 'single-action-section';
    singleActionSection.style.cssText = 'margin-top:10px;display:flex;flex-direction:column;gap:8px;';

    const launchBtn = document.createElement('button');
    launchBtn.id = 'btn-launch-single';
    launchBtn.className = 'btn btn-success';
    launchBtn.style.cssText = 'width:100%;padding:16px;font-size:14px;font-weight:900;letter-spacing:1px;border-radius:10px;cursor:pointer;background:linear-gradient(135deg, #06d6a0, #059669);box-shadow:0 0 20px rgba(6,214,160,0.5);border:2px solid #34d399;color:#ffffff;font-family:"Be Vietnam Pro",sans-serif;text-transform:uppercase;transition:all .2s;';
    launchBtn.innerHTML = '⚔️ VÀO TRẬN ĐẤU (CHƠI ĐƠN)!';
    launchBtn.onclick = () => {
      launchBtn.disabled = true;
      launchBtn.innerHTML = '⏳ Đang khởi tạo trận đấu...';
      const outfitName = equipment?.outfit || sessionStorage.getItem('selectedOutfit') || 'default';
      startSinglePlayerMatch({
        bossElement: selectedBoss || 'thunder',
        difficulty: selectedDiff || 'medium',
        outfit: outfitName
      });
    };
    singleActionSection.appendChild(launchBtn);
    wrap.appendChild(singleActionSection);
  } else {
    const readySection = document.createElement('div');
    readySection.id = 'lobby-ready-section';
    readySection.style.cssText = 'background:rgba(15,23,42,0.85);border:2px solid #00cfff;border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:12px;box-shadow:0 0 20px rgba(0,207,255,0.2);margin-top:6px;';

    const readyHead = document.createElement('div');
    readyHead.style.cssText = 'display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(0,207,255,0.25);padding-bottom:6px;';
    readyHead.innerHTML = `
      <span style="font-size:12px;font-weight:800;color:#ffcc00;font-family:'Be Vietnam Pro',sans-serif;text-transform:uppercase;letter-spacing:1px;">
        ⚡ Trạng Thái Sẵn Sàng (Cả 2 cùng sẵn sàng mới bắt đầu)
      </span>
    `;
    readySection.appendChild(readyHead);

    // Status cards for 2 players
    const statusRow = document.createElement('div');
    statusRow.id = 'ready-status-row';
    statusRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;';
    readySection.appendChild(statusRow);

    // Action button for local player
    let isLocalReady = false;
    const readyToggleBtn = document.createElement('button');
    readyToggleBtn.id = 'btn-toggle-ready';
    readyToggleBtn.className = 'btn';
    readyToggleBtn.style.cssText = 'width:100%;padding:14px;font-size:13px;font-weight:800;letter-spacing:1px;border-radius:8px;cursor:pointer;transition:all .2s;font-family:"Be Vietnam Pro",sans-serif;text-transform:uppercase;';

    const updateReadyButtonVisual = () => {
      if (!isLocalReady) {
        readyToggleBtn.style.background = 'linear-gradient(135deg, #06d6a0, #059669)';
        readyToggleBtn.style.color = '#ffffff';
        readyToggleBtn.style.border = '2px solid #34d399';
        readyToggleBtn.style.boxShadow = '0 0 16px rgba(6,214,160,0.5)';
        readyToggleBtn.innerHTML = '⚡ TÔI ĐÃ SẴN SÀNG CHIẾN ĐẤU!';
      } else {
        readyToggleBtn.style.background = 'linear-gradient(135deg, #ea580c, #c2410c)';
        readyToggleBtn.style.color = '#ffffff';
        readyToggleBtn.style.border = '2px solid #fb923c';
        readyToggleBtn.style.boxShadow = '0 0 16px rgba(234,88,12,0.5)';
        readyToggleBtn.innerHTML = '⏳ ĐÃ SẴN SÀNG (Bấm để HỦY & Đổi đồ)';
      }
    };
    updateReadyButtonVisual();

    readyToggleBtn.onclick = () => {
      isLocalReady = !isLocalReady;
      updateReadyButtonVisual();
      Multiplayer.setReady(isLocalReady);
      _syncEquippedState();
    };
    readySection.appendChild(readyToggleBtn);

    // Status cards renderer
    const updateStatusCards = (playersList) => {
      const pList = playersList || window.gameState?.players || [];
      const myId = socket.id || window.myId;
      statusRow.innerHTML = '';

      for (let i = 0; i < 2; i++) {
        const p = pList[i];
        const card = document.createElement('div');
        card.style.cssText = 'background:rgba(0,0,0,0.4);border-radius:8px;padding:10px;display:flex;flex-direction:column;gap:6px;border:1.5px solid #334155;';

        if (p) {
          const isMe = (p.id === myId);
          if (isMe && p.ready !== undefined) {
            isLocalReady = Boolean(p.ready);
            updateReadyButtonVisual();
          }
          const isReady = Boolean(p.ready);
          const roleLabel = (p.id === (window.gameState?.hostId || gameState.hostId)) ? '👑 Chủ phòng' : '⚔️ Khách';
          const outfitName = (p.equipped?.outfit || p.equippedSet || 'default').toUpperCase();

          card.style.borderColor = isReady ? '#06d6a0' : '#f59e0b';
          card.style.boxShadow = isReady ? '0 0 12px rgba(6,214,160,0.3)' : 'none';

          card.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;font-weight:800;color:${p.color || '#fff'};font-family:'Be Vietnam Pro',sans-serif;">
                ${p.name} ${isMe ? '(Bạn)' : ''}
              </span>
              <span style="font-size:9px;color:#aaa;">${roleLabel}</span>
            </div>
            <div style="font-size:9px;color:#88ddff;font-family:'Be Vietnam Pro',sans-serif;">
              Bộ đồ: <b>${outfitName}</b>
            </div>
            <div style="margin-top:4px;padding:5px 8px;border-radius:4px;text-align:center;font-size:10px;font-weight:800;font-family:'Be Vietnam Pro',sans-serif;background:${isReady ? 'rgba(6,214,160,0.15)' : 'rgba(245,158,11,0.15)'};color:${isReady ? '#06d6a0' : '#f59e0b'};border:1px solid ${isReady ? '#06d6a0' : '#f59e0b'};">
              ${isReady ? '✅ ĐÃ SẴN SÀNG' : '⏳ ĐANG CHỌN ĐỒ...'}
            </div>
          `;
        } else {
          card.innerHTML = `
            <div style="font-size:11px;font-weight:700;color:#64748b;font-family:'Be Vietnam Pro',sans-serif;">
              Người chơi 2
            </div>
            <div style="font-size:9px;color:#475569;margin-top:4px;">
              Chờ đối thủ nhập mã phòng...
            </div>
            <div style="margin-top:6px;padding:5px 8px;border-radius:4px;text-align:center;font-size:9px;color:#64748b;border:1px dashed #334155;">
              ⏳ ĐANG ĐỢI...
            </div>
          `;
        }
        statusRow.appendChild(card);
      }
    };

    updateStatusCards(window.gameState?.players);
    window.updateLobbyReadyUI = updateStatusCards;

    // Start battle button for host
    if (gameState.isHost) {
      const hostForceStartBtn = document.createElement('button');
      hostForceStartBtn.id = 'btn-host-start-battle';
      hostForceStartBtn.className = 'btn btn-primary';
      hostForceStartBtn.style.cssText = 'width:100%;padding:14px;font-size:13px;font-weight:800;border-radius:8px;cursor:pointer;background:linear-gradient(135deg, #00cfff, #0284c7);border:2px solid #38bdf8;color:#ffffff;font-family:"Be Vietnam Pro",sans-serif;letter-spacing:1px;text-transform:uppercase;box-shadow:0 0 16px rgba(0,207,255,0.4);';
      hostForceStartBtn.textContent = '⚔️ BẮT ĐẦU TRẬN ĐẤU (CHỦ PHÒNG)';
      hostForceStartBtn.onclick = () => {
        Multiplayer.launchBattle();
      };
      readySection.appendChild(hostForceStartBtn);
    }

    wrap.appendChild(readySection);
  }

  container.appendChild(wrap);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD (God Father only)
// ─────────────────────────────────────────────────────────────────────────────

// ── Toast notification ────────────────────────────────────────────────────────
function _showToast(msg, isError = false) {
  document.getElementById('admin-toast')?.remove();
  const t = document.createElement('div');
  t.id = 'admin-toast';
  t.style.cssText = `
    position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
    background:${isError ? '#3a0000' : '#002a1a'};
    border:1.5px solid ${isError ? '#ff4444' : '#06d6a0'};
    color:${isError ? '#ff8888' : '#06d6a0'};
    font-family:'Be Vietnam Pro',sans-serif;font-size:12px;font-weight:700;
    padding:10px 22px;border-radius:8px;z-index:99998;
    box-shadow:0 4px 24px rgba(0,0,0,0.7);
    max-width:88vw;text-align:center;pointer-events:none;
    animation:fadeInUp .25s ease;
  `;
  t.textContent = msg;
  // Add CSS animation once
  if (!document.getElementById('toast-style')) {
    const s = document.createElement('style');
    s.id = 'toast-style';
    s.textContent = `@keyframes fadeInUp{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}`;
    document.head.appendChild(s);
  }
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

// ── Dropped-questions warning modal ──────────────────────────────────────────
function _showDroppedWarning(totalInFile, parsedOk, dropped) {
  document.getElementById('dropped-warning')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'dropped-warning';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:rgba(5,3,20,0.88);
    display:flex;align-items:center;justify-content:center;
    font-family:'Be Vietnam Pro','Nunito',sans-serif;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background:linear-gradient(160deg,#1a0a00,#2a1000);
    border:2px solid #ffcc00;border-radius:12px;
    padding:24px 28px;max-width:500px;width:92vw;
    display:flex;flex-direction:column;gap:12px;
    box-shadow:0 0 40px rgba(255,204,0,0.2),0 8px 40px rgba(0,0,0,0.8);
  `;

  box.innerHTML = `
    <div style="font-size:22px;text-align:center;">⚠️</div>
    <div style="font-size:14px;font-weight:900;color:#ffcc00;text-align:center;">
      Cảnh báo: ${dropped.length} câu chưa nhận dạng được đáp án
    </div>
    <div style="font-size:12px;color:#ddd;line-height:1.6;">
      Đã tải thành công <strong style="color:#06d6a0">${parsedOk}/${totalInFile} câu</strong>.
      ${dropped.length} câu sau đây <em>không có dấu đáp án</em>
      (dấu <code>*</code>, chữ đậm, hoặc dòng <code>Đáp án: X</code>)
      — đã tự động đặt đáp án mặc định là <strong>A</strong>:
    </div>
    <div style="
      background:rgba(0,0,0,0.4);border:1px solid rgba(255,204,0,0.25);
      border-radius:6px;padding:10px 14px;
      font-size:11px;color:#ffcc00;line-height:1.8;word-break:break-word;
      max-height:120px;overflow-y:auto;
    ">${dropped.join(' • ')}</div>
    <div style="font-size:11px;color:#aaa;text-align:center;">
      Vui lòng kiểm tra định dạng A, B, C, D của các câu trên trong file .docx
      rồi tải lại.
    </div>
    <button id="dropped-ok-btn" style="
      margin-top:4px;padding:9px 0;border-radius:7px;border:none;cursor:pointer;
      background:linear-gradient(135deg,#ffcc00,#ff8800);
      color:#111;font-family:'Be Vietnam Pro',sans-serif;
      font-size:13px;font-weight:800;
    ">Đã hiểu — Đóng</button>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  box.querySelector('#dropped-ok-btn').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
}

function _buildAdminDashboard(container, gameState) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

  // ── Admin header badge ────────────────────────────────────────────────────
  const badge = document.createElement('div');
  badge.style.cssText = 'background:linear-gradient(135deg,#3a0000,#1a0000);border:2px solid #ff4444;border-radius:8px;padding:8px 14px;display:flex;align-items:center;gap:10px;';
  badge.innerHTML = `<span style="font-size:20px;">⚡</span><div><div style="font-weight:800;color:#ff6666;font-size:13px;font-family:'Be Vietnam Pro',sans-serif;">Admin Dashboard — God Father</div><div style="font-size:9px;color:#aa4444;font-family:'Be Vietnam Pro',sans-serif;">Full system access</div></div>`;
  wrap.appendChild(badge);

  // ── Section header helper ─────────────────────────────────────────────────
  const mkHead = (text) => {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:11px;font-weight:800;color:#ff6666;letter-spacing:1px;font-family:"Be Vietnam Pro",sans-serif;text-transform:uppercase;border-bottom:1px solid rgba(255,68,68,0.3);padding-bottom:4px;';
    h.textContent = text;
    return h;
  };

  // ── Question Bank Management ──────────────────────────────────────────────
  wrap.appendChild(mkHead('📚 Ngân hàng câu hỏi'));

  const BANK_DEFS = [
    { id:'thunder', label:'⚡ Kho Sét',  labelFull:'Kho Sét (Thunder)',  color:'#00cfff', rgb:'0,207,255' },
    { id:'fire',    label:'🔥 Kho Lửa', labelFull:'Kho Lửa (Fire)',    color:'#ff8c42', rgb:'255,140,66' },
    { id:'frost',   label:'❄️ Kho Băng', labelFull:'Kho Băng (Frost)',  color:'#88ddff', rgb:'136,221,255' },
  ];

  const bankGrid = document.createElement('div');
  bankGrid.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

  // ── Fetch & refresh all counts ────────────────────────────────────────────
  const refreshAllCounts = () => {
    fetch('/api/admin/questions/stats')
      .then(r => r.json())
      .then(info => {
        BANK_DEFS.forEach(b => {
          const el = document.getElementById(`adm-count-${b.id}`);
          if (el) el.textContent = `📊 Hiện có: ${info[b.id] ?? 0} câu`;
        });
      })
      .catch(() => {});
  };

  BANK_DEFS.forEach(b => {
    // ── Card ────────────────────────────────────────────────────────────────
    const card = document.createElement('div');
    card.style.cssText = `background:rgba(${b.rgb},0.06);border:1.5px solid rgba(${b.rgb},0.25);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:9px;`;

    // Row 1: label + live count badge
    const row1 = document.createElement('div');
    row1.style.cssText = 'display:flex;align-items:center;justify-content:space-between;';

    const lbl = document.createElement('span');
    lbl.style.cssText = `font-size:13px;font-weight:800;color:${b.color};font-family:'Be Vietnam Pro',sans-serif;`;
    lbl.textContent = b.label;

    const countBadge = document.createElement('span');
    countBadge.id = `adm-count-${b.id}`;
    countBadge.style.cssText = `font-size:10px;font-weight:700;color:${b.color};background:rgba(${b.rgb},0.12);border:1px solid rgba(${b.rgb},0.3);border-radius:20px;padding:2px 10px;font-family:'Be Vietnam Pro',sans-serif;`;
    countBadge.textContent = '📊 Hiện có: …';

    row1.appendChild(lbl);
    row1.appendChild(countBadge);
    card.appendChild(row1);

    // Row 2: file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file'; fileInput.accept = '.docx';
    fileInput.style.cssText = `width:100%;font-size:10px;color:#ccc;font-family:'Be Vietnam Pro',sans-serif;padding:4px 0;`;
    card.appendChild(fileInput);

    // Row 3: mode toggle (append / replace)
    const modeRow = document.createElement('div');
    modeRow.style.cssText = 'display:flex;gap:8px;align-items:center;';

    const mkModeBtn = (value, labelText, defaultActive) => {
      const btn = document.createElement('button');
      btn.dataset.mode = value;
      btn.style.cssText = `
        flex:1;padding:5px 4px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;
        font-family:'Be Vietnam Pro',sans-serif;transition:all .15s;
        border:1.5px solid rgba(${b.rgb},0.4);
        background:${defaultActive ? `rgba(${b.rgb},0.18)` : 'transparent'};
        color:${defaultActive ? b.color : '#777'};
      `;
      btn.textContent = labelText;
      btn.onclick = () => {
        modeRow.querySelectorAll('button').forEach(x => {
          x.style.background = 'transparent';
          x.style.color = '#777';
          x.style.borderColor = `rgba(${b.rgb},0.3)`;
        });
        btn.style.background = `rgba(${b.rgb},0.18)`;
        btn.style.color = b.color;
        btn.style.borderColor = `rgba(${b.rgb},0.6)`;
      };
      return btn;
    };

    const appendBtn  = mkModeBtn('append',  '[+] Bổ sung thêm đề', false);
    const replaceBtn = mkModeBtn('replace', '[↻] Ghi đè toàn bộ',  true);
    modeRow.appendChild(appendBtn);
    modeRow.appendChild(replaceBtn);
    card.appendChild(modeRow);

    // Row 4: action buttons
    const actionRow = document.createElement('div');
    actionRow.style.cssText = 'display:flex;gap:8px;';

    // Upload button
    const uploadBtn = document.createElement('button');
    uploadBtn.style.cssText = `
      flex:2;padding:7px 10px;border-radius:6px;font-size:11px;font-weight:800;cursor:pointer;
      background:linear-gradient(135deg,rgba(${b.rgb},0.5),rgba(${b.rgb},0.25));
      border:1.5px solid ${b.color};color:#fff;
      font-family:'Be Vietnam Pro',sans-serif;transition:opacity .15s;
    `;
    uploadBtn.textContent = '📤 Tải Lên Cập Nhật';

    // Clear (danger) button
    const clearBtn = document.createElement('button');
    clearBtn.style.cssText = `
      flex:1;padding:7px 8px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;
      background:rgba(200,0,0,0.15);border:1.5px solid #cc0000;color:#ff6666;
      font-family:'Be Vietnam Pro',sans-serif;transition:opacity .15s;
    `;
    clearBtn.textContent = '🗑 Xóa Trắng';

    actionRow.appendChild(uploadBtn);
    actionRow.appendChild(clearBtn);
    card.appendChild(actionRow);

    // Status text
    const statusEl = document.createElement('div');
    statusEl.style.cssText = `font-size:10px;color:#888;font-family:'Be Vietnam Pro',sans-serif;min-height:14px;`;
    card.appendChild(statusEl);

    bankGrid.appendChild(card);

    // ── Wire upload ──────────────────────────────────────────────────────────
    uploadBtn.addEventListener('click', async () => {
      if (!fileInput.files[0]) {
        statusEl.textContent = '⚠ Hãy chọn file .docx trước!';
        statusEl.style.color = '#ffcc00';
        return;
      }
      const selectedMode = modeRow.querySelector('button[data-mode]')
        ? [...modeRow.querySelectorAll('button')].find(x => x.style.color === b.color)?.dataset.mode || 'replace'
        : 'replace';

      statusEl.textContent = '⏳ Đang xử lý…'; statusEl.style.color = '#aaa';
      uploadBtn.disabled = clearBtn.disabled = true;
      uploadBtn.style.opacity = '0.5';

      try {
        const fd = new FormData();
        fd.append('file', fileInput.files[0]);
        fd.append('element', b.id);
        fd.append('mode', selectedMode);

        const r = await fetch('/api/admin/questions/upload', { method:'POST', body: fd });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Upload failed');

        const modeLabel = selectedMode === 'append' ? 'Bổ sung' : 'Ghi đè';
        statusEl.style.color = '#06d6a0';
        statusEl.textContent = `✓ ${modeLabel}: +${d.added} mới, bỏ qua ${d.skipped} trùng`;
        countBadge.textContent = `📊 Hiện có: ${d.total} câu`;
        _showToast(`Đã cập nhật thành công ${b.labelFull}: Hiện có ${d.total} câu hỏi`);

        // ── Show dropped-questions warning if any ────────────────────────
        if (d.dropped && d.dropped.length > 0) {
          _showDroppedWarning(d.total + d.dropped.length, d.total, d.dropped);
        }

        fileInput.value = '';
      } catch(e) {
        statusEl.style.color = '#ef233c';
        statusEl.textContent = '✗ Lỗi: ' + e.message;
        _showToast('Lỗi tải lên: ' + e.message, true);
      }
      uploadBtn.disabled = clearBtn.disabled = false;
      uploadBtn.style.opacity = '1';
    });

    // ── Wire clear ───────────────────────────────────────────────────────────
    clearBtn.addEventListener('click', async () => {
      const bankName = b.labelFull;
      if (!confirm(`Bạn có chắc muốn xóa toàn bộ đề của ${bankName}?\n\nHành động này không thể hoàn tác!`)) return;

      statusEl.textContent = '⏳ Đang xóa…'; statusEl.style.color = '#aaa';
      clearBtn.disabled = uploadBtn.disabled = true;

      try {
        const r = await fetch(`/api/admin/questions/clear?element=${b.id}`, { method:'DELETE' });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        countBadge.textContent = '📊 Hiện có: 0 câu';
        statusEl.style.color = '#ff8888';
        statusEl.textContent = `✓ Đã xóa toàn bộ ${bankName}`;
        _showToast(`Đã xóa toàn bộ câu hỏi trong ${bankName}`, true);
      } catch(e) {
        statusEl.style.color = '#ef233c';
        statusEl.textContent = '✗ Lỗi: ' + e.message;
      }
      clearBtn.disabled = uploadBtn.disabled = false;
    });
  });

  wrap.appendChild(bankGrid);
  // Fetch counts on mount
  refreshAllCounts();

  // ── Dev Quick Launch section ──────────────────────────────────────────────
  wrap.appendChild(mkHead('🧪 Dev Quick Launch'));

  const BOSSES = [
    { id:'thunder', label:'⚡ Sét', color:'#00cfff', rgb:'0,207,255' },
    { id:'fire',    label:'🔥 Lửa', color:'#ff8c42', rgb:'255,140,66' },
    { id:'frost',   label:'❄️ Băng', color:'#88ddff', rgb:'136,221,255' },
  ];
  const DIFFS = [
    { id:'easy',   label:'Dễ (20)',  color:'#06d6a0' },
    { id:'medium', label:'TB (30)',  color:'#ffcc00' },
    { id:'hard',   label:'Khó (50)', color:'#ef233c' },
  ];
  const GEARS = [
    { id:'normal',  label:'🔘 Đồ thường (Không hiệu ứng, 1 hit)', color:'#aaa', rgb:'170,170,170' },
    { id:'thunder', label:'⚡ Full Set Lôi (Thunder 2 hit)',      color:'#00cfff', rgb:'0,207,255' },
    { id:'fire',    label:'🔥 Full Set Hỏa (Fire 2 hit)',         color:'#ff8c42', rgb:'255,140,66' },
    { id:'frost',   label:'❄️ Full Set Băng (Frost 2 hit)',       color:'#88ddff', rgb:'136,221,255' },
  ];

  let adminBoss     = 'thunder';
  let adminDiff     = 'easy';
  const currentSaved = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('selectedOutfit'))
    || (typeof localStorage !== 'undefined' && localStorage.getItem('selectedOutfit'))
    || 'default';
  const cleanSaved = ['default', 'thunder', 'fire', 'frost'].includes(currentSaved.toLowerCase().trim()) ? currentSaved.toLowerCase().trim() : 'default';
  let adminTestGear = cleanSaved === 'default' ? 'normal' : cleanSaved;

  const devRow1 = document.createElement('div');
  devRow1.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  BOSSES.forEach((b, idx) => {
    const btn = document.createElement('button');
    btn.textContent = b.label;
    btn.style.cssText = `font-size:10px;padding:4px 10px;border:1.5px solid ${b.color};color:${b.color};background:${idx===0?`rgba(${b.rgb},0.15)`:'transparent'};border-radius:5px;cursor:pointer;font-family:'Be Vietnam Pro',sans-serif;`;
    btn.onclick = () => {
      devRow1.querySelectorAll('button').forEach(x => x.style.background='transparent');
      btn.style.background = `rgba(${b.rgb},0.15)`;
      adminBoss = b.id;
    };
    devRow1.appendChild(btn);
  });
  wrap.appendChild(devRow1);

  const devRow2 = document.createElement('div');
  devRow2.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
  DIFFS.forEach((d, idx) => {
    const btn = document.createElement('button');
    btn.textContent = d.label;
    btn.style.cssText = `font-size:10px;padding:4px 10px;border:1.5px solid ${d.color};color:${d.color};background:${idx===0?`rgba(6,214,160,0.12)`:'transparent'};border-radius:5px;cursor:pointer;font-family:'Be Vietnam Pro',sans-serif;`;
    btn.onclick = () => {
      devRow2.querySelectorAll('button').forEach(x => x.style.background='transparent');
      btn.style.background = `rgba(${d.id==='easy'?'6,214,160':d.id==='hard'?'239,35,60':'255,204,0'},0.12)`;
      adminDiff = d.id;
    };
    devRow2.appendChild(btn);
  });
  wrap.appendChild(devRow2);

  // Equipment toggle group: 4 granular options
  const devRow3 = document.createElement('div');
  devRow3.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;';
  GEARS.forEach((g) => {
    const btn = document.createElement('button');
    btn.textContent = g.label;
    const isSelected = g.id === adminTestGear;
    btn.style.cssText = `font-size:9.5px;padding:6px 8px;border:1.5px solid ${isSelected ? g.color : '#444'};color:${isSelected ? g.color : '#888'};background:${isSelected ? `rgba(${g.rgb},0.2)` : 'transparent'};border-radius:5px;cursor:pointer;font-family:'Be Vietnam Pro',sans-serif;font-weight:700;text-align:center;`;
    btn.onclick = () => {
      devRow3.querySelectorAll('button').forEach(x => {
        x.style.background = 'transparent';
        x.style.borderColor = '#444';
        x.style.color = '#888';
      });
      adminTestGear = g.id;
      const outfitToSave = g.id === 'normal' ? 'default' : g.id;
      try {
        sessionStorage.setItem('selectedOutfit', outfitToSave);
        localStorage.setItem('selectedOutfit', outfitToSave);
      } catch (e) {}
      btn.style.background = `rgba(${g.rgb},0.2)`;
      btn.style.borderColor = g.color;
      btn.style.color = g.color;
    };
    devRow3.appendChild(btn);
  });
  wrap.appendChild(devRow3);

  const launchBtn = document.createElement('button');
  launchBtn.style.cssText = 'background:linear-gradient(135deg,#ff4444,#aa0000);color:#fff;font-size:12px;font-weight:800;padding:10px;border:none;border-radius:7px;cursor:pointer;font-family:"Be Vietnam Pro",sans-serif;width:100%;';
  launchBtn.textContent = '⚡ Bắt Đầu (God Father Launch)';
  launchBtn.onclick = () => {
    socket.emit('set_mode', { code: gameState.code, mode: 'pve' });
    socket.emit('start_game', {
      code: gameState.code,
      element: adminBoss,
      difficulty: adminDiff,
      testGear: adminTestGear
    });
  };
  wrap.appendChild(launchBtn);

  // ── 5-question dev test ───────────────────────────────────────────────────
  const devBtn = document.createElement('button');
  devBtn.textContent = '🧪 Dev Run (5 câu test)';
  devBtn.style.cssText = 'font-size:10px;padding:4px 12px;border:1.5px solid #ff4444;background:rgba(100,0,0,0.6);color:#ff4444;border-radius:4px;cursor:pointer;font-weight:700;font-family:"Be Vietnam Pro",sans-serif;width:100%;margin-top:4px;';
  const devStatus = document.createElement('div');
  devStatus.style.cssText = 'font-size:9px;color:#888;text-align:center;font-family:"Be Vietnam Pro",sans-serif;';

  devBtn.onclick = () => {
    socket.emit('set_mode', { code: gameState.code, mode: 'pve' });
    socket.emit('start_game', {
      code:       gameState.code,
      element:    adminBoss,
      difficulty: 'dev',
      testGear:   adminTestGear
    });
    const gearLabel = GEARS.find(g => g.id === adminTestGear)?.label || adminTestGear;
    devStatus.textContent = `⚡ Dev launch: Boss ${adminBoss} / 5 câu / ${gearLabel}`;
    devStatus.style.color = '#ffcc00';
  };

  wrap.appendChild(devBtn);
  wrap.appendChild(devStatus);

  container.appendChild(wrap);


}



export function updatePlayers(players) {
  if (currentState) currentState.players = players;
  if (window.gameState) window.gameState.players = players;
  const playerList = document.getElementById('player-list');
  if (playerList) {
    playerList.innerHTML = '';
    players.forEach(p => {
      const li = document.createElement('li');
      li.style.cssText = 'display:flex;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.08);';
      const colorBox = document.createElement('div');
      colorBox.style.cssText = `width:18px;height:18px;background:${p.color};display:inline-block;margin-right:8px;border-radius:3px;flex-shrink:0;`;
      const nameSpan = document.createElement('span');
      nameSpan.textContent = p.name;
      nameSpan.style.fontFamily = "'Be Vietnam Pro', sans-serif";
      nameSpan.style.fontSize   = '13px';
      nameSpan.style.color      = '#f8fafc';
      li.appendChild(colorBox); li.appendChild(nameSpan);
      if (currentState && p.id === currentState.hostId) {
        const badge = document.createElement('span');
        badge.textContent = ' (HOST)';
        badge.style.cssText = 'color:gold;margin-left:6px;font-weight:800;font-size:11px;';
        li.appendChild(badge);
      }
      const readyBadge = document.createElement('span');
      readyBadge.style.cssText = `margin-left:auto;font-size:9px;font-weight:800;padding:2px 8px;border-radius:4px;background:${p.ready ? 'rgba(6,214,160,0.15)' : 'rgba(245,158,11,0.15)'};color:${p.ready ? '#06d6a0' : '#f59e0b'};border:1px solid ${p.ready ? '#06d6a0' : '#f59e0b'};`;
      readyBadge.textContent = p.ready ? '✓ Đã sẵn sàng' : '⏳ Đang chọn đồ';
      li.appendChild(readyBadge);
      playerList.appendChild(li);
    });
  }

  if (typeof window.updateLobbyReadyUI === 'function') {
    window.updateLobbyReadyUI(players);
  }
}

export function getSelectedPreset() { return null; }
export function getEquipment() { return { ...equipment }; }
export const PRESETS = {};
