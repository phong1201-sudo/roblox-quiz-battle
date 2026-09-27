import { socket } from '../socket.js';
import { showScreen } from '../main.js';
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
  if (!window.gameState) return;
  window.gameState.equipped = { outfit: equipment.outfit, weapon: equipment.weapon };
  window.gameState.equipment = { ...window.gameState.equipped };

  const isFullSet = (equipment.outfit === equipment.weapon && equipment.outfit !== 'default');
  window.gameState.equippedSet = isFullSet ? equipment.outfit : null;
  window.gameState.thunderSet  = (isFullSet && equipment.outfit === 'thunder');
  window.gameState.damagePerHit = isFullSet ? 2 : 1;
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
          } else {
            window.gameState.equippedSet  = s.id;
            window.gameState.thunderSet   = s.id === 'thunder';
            window.gameState.damagePerHit = 2;
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

  // Back button
  const btnBack = document.getElementById('btn-back-menu');
  if (btnBack) btnBack.onclick = () => showScreen('menu');

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
// STUDENT LOBBY
// ─────────────────────────────────────────────────────────────────────────────
function _buildStudentLobby(container, gameState) {
  const user = window.gameState || {};
  const inventory = user.inventory || { thunder: [], fire: [], frost: [] };
  const unlockedSets = user.unlockedSets || [];
  const FULL_PIECES = ['weapon', 'outfit'];

  const BOSSES = [
    { id:'thunder', label:'⚡ Lôi Quái',    sub:'Sét thần',    color:'#00cfff', glow:'rgba(0,200,255,0.35)' },
    { id:'fire',    label:'🔥 Hỏa Ma Vương', sub:'Lửa thiêu',   color:'#ff6b00', glow:'rgba(255,80,0,0.35)' },
    { id:'frost',   label:'❄️ Băng Tinh',   sub:'Băng tuyết',  color:'#88ddff', glow:'rgba(100,180,255,0.35)' },
  ];
  const DIFFICULTIES = [
    { id:'easy',   label:'Dễ',        sub:'20 câu',  color:'#06d6a0' },
    { id:'medium', label:'Trung bình', sub:'30 câu',  color:'#ffcc00' },
    { id:'hard',   label:'Khó',        sub:'50 câu',  color:'#ef233c' },
  ];

  let selectedBoss   = null;
  let selectedDiff   = 'medium';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:14px;';

  // ── Section header helper ────────────────────────────────────────────────
  const mkHead = (text) => {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:11px;font-weight:800;color:#ffcc00;letter-spacing:1px;font-family:"Be Vietnam Pro",sans-serif;text-transform:uppercase;border-bottom:1px solid rgba(255,204,0,0.2);padding-bottom:4px;';
    h.textContent = text;
    return h;
  };

  // ── 1. Boss selector ──────────────────────────────────────────────────────
  const bossSection = document.createElement('div');
  bossSection.appendChild(mkHead('🎯 Chọn Mục Tiêu Boss'));
  const bossGrid = document.createElement('div');
  bossGrid.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;';

  BOSSES.forEach(b => {
    const pieces = inventory[b.id] || [];
    const count  = pieces.length;
    const isFull = FULL_PIECES.every(p => pieces.includes(p));

    const btn = document.createElement('button');
    btn.dataset.boss = b.id;
    btn.style.cssText = `flex:1;min-width:80px;padding:10px 6px;border-radius:8px;border:2px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);cursor:pointer;font-family:"Be Vietnam Pro",sans-serif;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all .15s;`;
    btn.innerHTML = `
      <span style="font-size:18px;">${b.label.split(' ')[0]}</span>
      <span style="font-size:11px;font-weight:700;color:${b.color};">${b.label.slice(b.label.indexOf(' ')+1)}</span>
      <span style="font-size:9px;color:#888;">${b.sub}</span>
      <span style="font-size:8px;color:${isFull ? b.color : '#555'};margin-top:2px;">${isFull ? '✦ Đầy bộ' : `${count}/2 món`}</span>
    `;
    btn.addEventListener('click', () => {
      bossGrid.querySelectorAll('button').forEach(x => {
        x.style.borderColor = 'rgba(255,255,255,0.12)';
        x.style.background  = 'rgba(255,255,255,0.04)';
        x.style.boxShadow   = 'none';
      });
      btn.style.borderColor = b.color;
      btn.style.background  = b.glow;
      btn.style.boxShadow   = `0 0 16px ${b.glow}`;
      selectedBoss = b.id;
      if (window.gameState) window.gameState.selectedBoss = b.id;
      // Update start button
      startBtn.disabled = false;
      startBtn.style.opacity = '1';
    });
    bossGrid.appendChild(btn);
  });
  bossSection.appendChild(bossGrid);
  wrap.appendChild(bossSection);

  // ── 2. Difficulty selector ────────────────────────────────────────────────
  const diffSection = document.createElement('div');
  diffSection.appendChild(mkHead('⚖️ Chọn Độ Khó'));
  const diffGrid = document.createElement('div');
  diffGrid.style.cssText = 'display:flex;gap:8px;margin-top:8px;';

  DIFFICULTIES.forEach(d => {
    const btn = document.createElement('button');
    btn.dataset.diff = d.id;
    btn.style.cssText = `flex:1;padding:8px 4px;border-radius:7px;border:2px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);cursor:pointer;font-family:"Be Vietnam Pro",sans-serif;display:flex;flex-direction:column;align-items:center;gap:2px;transition:all .15s;`;
    btn.innerHTML = `<span style="font-size:12px;font-weight:800;color:${d.color};">${d.label}</span><span style="font-size:9px;color:#888;">${d.sub}</span>`;
    btn.addEventListener('click', () => {
      diffGrid.querySelectorAll('button').forEach(x => {
        x.style.borderColor = 'rgba(255,255,255,0.12)';
        x.style.background  = 'rgba(255,255,255,0.04)';
      });
      btn.style.borderColor = d.color;
      btn.style.background  = `rgba(${d.id==='easy'?'6,214,160':'hard'===d.id?'239,35,60':'255,204,0'},0.1)`;
      selectedDiff = d.id;
      if (window.gameState) window.gameState.selectedDifficulty = d.id;
    });
    // Pre-select medium
    if (d.id === 'medium') setTimeout(() => btn.click(), 0);
    diffGrid.appendChild(btn);
  });
  diffSection.appendChild(diffGrid);
  wrap.appendChild(diffSection);

  // ── 3. Wardrobe + inventory ───────────────────────────────────────────────
  const wardSection = document.createElement('div');
  wardSection.appendChild(mkHead('🎒 Trang Bị & Bộ Kỹ Năng'));

  const wardRow = document.createElement('div');
  wardRow.style.cssText = 'display:flex;gap:12px;align-items:flex-start;margin-top:8px;';

  // Slots
  const slotsWrap = document.createElement('div');
  slotsWrap.id = 'wardrobe-slots';
  slotsWrap.style.flex = '1';
  wardRow.appendChild(slotsWrap);

  // Preview canvas
  const previewCol = document.createElement('div');
  previewCol.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;';
  const previewCanvas = document.createElement('canvas');
  previewCanvas.id = 'wardrobe-preview';
  previewCanvas.width = 80; previewCanvas.height = 96;
  previewCanvas.style.cssText = 'border:2px solid #ffcc00;border-radius:6px;background:#0d0a1e;image-rendering:pixelated;';
  previewCol.appendChild(previewCanvas);
  previewCol.innerHTML += '<span style="font-size:9px;color:#888;font-family:\'Be Vietnam Pro\',sans-serif;">Preview</span>';
  wardRow.appendChild(previewCol);
  wardSection.appendChild(wardRow);

  buildWardrobeUI(slotsWrap, previewCanvas);
  drawWardrobePreview(previewCanvas);

  // Inventory cards display (2 cards per element: Trang Phục & Vũ Khí)
  const invEl = document.createElement('div');
  invEl.style.cssText = 'margin-top:10px; display:flex; flex-direction:column; gap:10px;';

  const invTitle = document.createElement('div');
  invTitle.textContent = '💎 Bộ Sưu Tập Trang Bị Nguyên Tố:';
  invTitle.style.cssText = 'font-size:11px; font-weight:700; color:#ffcc00; font-family:"Be Vietnam Pro",sans-serif;';
  invEl.appendChild(invTitle);

  BOSSES.forEach(b => {
    const pieces = inventory[b.id] || [];
    const hasOutfit = pieces.includes('outfit') || window._godFather;
    const hasWeapon = pieces.includes('weapon') || window._godFather;
    const isFull = hasOutfit && hasWeapon;

    const elemGroup = document.createElement('div');
    elemGroup.style.cssText = `
      background:rgba(255,255,255,0.03); border:1.5px solid ${isFull ? b.color : 'rgba(255,255,255,0.08)'};
      border-radius:8px; padding:10px; display:flex; flex-direction:column; gap:8px;
      ${isFull ? `box-shadow:0 0 12px ${b.glow};` : ''}
    `;

    // Element header
    const elemHeader = document.createElement('div');
    elemHeader.style.cssText = 'display:flex; align-items:center; justify-content:space-between;';
    elemHeader.innerHTML = `
      <span style="font-size:12px; font-weight:800; color:${b.color}; font-family:'Be Vietnam Pro',sans-serif;">${b.label}</span>
      <span style="font-size:10px; font-weight:700; color:${isFull ? b.color : '#888'}; font-family:'Be Vietnam Pro',sans-serif;">
        ${isFull ? '✦ ĐỦ BỘ (Sát thương x2)' : `${(hasOutfit?1:0)+(hasWeapon?1:0)}/2 Món`}
      </span>
    `;
    elemGroup.appendChild(elemHeader);

    // 2 Cards container
    const cardsRow = document.createElement('div');
    cardsRow.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:8px;';

    // Card 1: Trang Phục
    const cardOutfit = document.createElement('div');
    cardOutfit.style.cssText = `
      background:${hasOutfit ? b.glow : 'rgba(0,0,0,0.3)'};
      border:1.5px solid ${hasOutfit ? b.color : 'rgba(255,255,255,0.1)'};
      border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:3px;
    `;
    cardOutfit.innerHTML = `
      <div style="font-size:11px; font-weight:700; color:${hasOutfit ? '#fff' : '#aaa'}; font-family:'Be Vietnam Pro',sans-serif;">
        👕 Trang Phục ${b.label.split(' ')[1] || ''}
      </div>
      <div style="font-size:9px; color:${hasOutfit ? '#06d6a0' : '#888'}; font-weight:600; font-family:'Be Vietnam Pro',sans-serif;">
        ${hasOutfit ? '✓ Đã mở khóa' : '🔒 Đạt 30/30 hoặc 50/50'}
      </div>
    `;
    cardsRow.appendChild(cardOutfit);

    // Card 2: Vũ Khí
    const cardWeapon = document.createElement('div');
    cardWeapon.style.cssText = `
      background:${hasWeapon ? b.glow : 'rgba(0,0,0,0.3)'};
      border:1.5px solid ${hasWeapon ? b.color : 'rgba(255,255,255,0.1)'};
      border-radius:6px; padding:8px; display:flex; flex-direction:column; gap:3px;
    `;
    cardWeapon.innerHTML = `
      <div style="font-size:11px; font-weight:700; color:${hasWeapon ? '#fff' : '#aaa'}; font-family:'Be Vietnam Pro',sans-serif;">
        ⚔️ Vũ Khí ${b.label.split(' ')[1] || ''}
      </div>
      <div style="font-size:9px; color:${hasWeapon ? '#06d6a0' : '#888'}; font-weight:600; font-family:'Be Vietnam Pro',sans-serif;">
        ${hasWeapon ? '✓ Đã mở khóa' : '🔒 Đạt 20/20 hoặc 50/50'}
      </div>
    `;
    cardsRow.appendChild(cardWeapon);

    elemGroup.appendChild(cardsRow);
    invEl.appendChild(elemGroup);
  });
  wardSection.appendChild(invEl);

  // Elemental set picker
  buildElementalSetPicker(wardSection);
  window.__rebuildSetPicker = (sec) => buildElementalSetPicker(sec || wardSection);

  wrap.appendChild(wardSection);

  // ── 4. Start button (host only) ───────────────────────────────────────────
  const startBtn = document.createElement('button');
  startBtn.className = 'btn btn-success';
  startBtn.style.cssText = 'width:100%;padding:12px;font-size:14px;font-weight:800;letter-spacing:1px;margin-top:4px;';
  startBtn.textContent = '⚔️ Vào trận!';
  startBtn.disabled = true;
  startBtn.style.opacity = '0.4';

  if (gameState.isHost) {
    startBtn.addEventListener('click', () => {
      if (!selectedBoss) { alert('Hãy chọn Boss trước!'); return; }
      socket.emit('start_game', {
        code:       gameState.code,
        element:    selectedBoss,
        difficulty: selectedDiff,
      });
    });
    wrap.appendChild(startBtn);
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

  // ── Character & Weapon Art Upload section ─────────────────────────────────
  // ── Character & Weapon Art & 3D Models Upload section ──────────────────────
  wrap.appendChild(mkHead('📦 Mô Hình 3D & Ảnh Nhân Vật (3D GLB & Art Upload)'));

  const charNote = document.createElement('div');
  charNote.style.cssText = 'font-size:10px;color:#888;font-family:"Be Vietnam Pro",sans-serif;line-height:1.6;padding:4px 0;';
  charNote.innerHTML = 'Tải file mô hình 3D (<b>.glb / .gltf</b>) hoặc ảnh (<b>.png, .jpg</b>) cho Nhân Vật và Vũ Khí từng hệ. Khi có file 3D, game sẽ tự động gán vũ khí vào xương tay phải (Right Hand Socketing).';
  wrap.appendChild(charNote);

  const charGrid = document.createElement('div');
  charGrid.style.cssText = 'display:flex;flex-direction:column;gap:12px;';

  const CHAR_DEFS = [
    { id:'default', label:'🧍 Bộ Đồ Mặc Định (Thường)', color:'#ffffff', rgb:'200,200,200' },
    { id:'thunder', label:'⚡ Hệ Sét (Thunder)', color:'#00cfff', rgb:'0,207,255' },
    { id:'fire',    label:'🔥 Hệ Lửa (Fire)',    color:'#ff8c42', rgb:'255,140,66' },
    { id:'frost',   label:'❄️ Hệ Băng (Frost)',   color:'#88ddff', rgb:'136,221,255' },
  ];

  const artPreviews = {
    default: { body: null, weapon: null },
    thunder: { body: null, weapon: null },
    fire:    { body: null, weapon: null },
    frost:   { body: null, weapon: null },
  };
  const modelBadges = {
    default: { character: null, weapon: null },
    thunder: { character: null, weapon: null },
    fire:    { character: null, weapon: null },
    frost:   { character: null, weapon: null },
  };

  // Fetch current art & 3D model list on mount
  const refreshArtAndModels = () => {
    fetch('/api/admin/art/list').then(r => r.json()).then(list => {
      for (const [el, data] of Object.entries(list)) {
        if (data?.body && artPreviews[el]?.body) {
          artPreviews[el].body.src = data.body + '?t=' + Date.now();
          artPreviews[el].body.style.display = 'block';
        }
        if (data?.weapon && artPreviews[el]?.weapon) {
          artPreviews[el].weapon.src = data.weapon + '?t=' + Date.now();
          artPreviews[el].weapon.style.display = 'block';
        }
      }
    }).catch(() => {});

    fetch('/api/admin/model/status').then(r => r.json()).then(status => {
      for (const [el, s] of Object.entries(status)) {
        if (modelBadges[el]?.character) {
          modelBadges[el].character.textContent = s.character ? '📦 3D Model: Sẵn sàng' : '📦 3D: Chưa có';
          modelBadges[el].character.style.color = s.character ? '#06d6a0' : '#888';
          modelBadges[el].character.style.borderColor = s.character ? 'rgba(6,214,160,0.4)' : 'rgba(255,255,255,0.1)';
        }
        if (modelBadges[el]?.weapon) {
          modelBadges[el].weapon.textContent = s.weapon ? '⚔️ 3D Kiếm: Sẵn sàng' : '⚔️ 3D: Chưa có';
          modelBadges[el].weapon.style.color = s.weapon ? '#06d6a0' : '#888';
          modelBadges[el].weapon.style.borderColor = s.weapon ? 'rgba(6,214,160,0.4)' : 'rgba(255,255,255,0.1)';
        }
      }
    }).catch(() => {});
  };

  refreshArtAndModels();

  CHAR_DEFS.forEach(c => {
    const card = document.createElement('div');
    card.style.cssText = `background:rgba(${c.rgb},0.06);border:1.5px solid rgba(${c.rgb},0.3);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:10px;`;

    // Element Header
    const cardTitle = document.createElement('div');
    cardTitle.style.cssText = `font-size:12px;font-weight:900;color:${c.color};font-family:'Be Vietnam Pro',sans-serif;`;
    cardTitle.textContent = c.label;
    card.appendChild(cardTitle);

    // Two upload rows: 1. Character/Body, 2. Weapon
    const isDef = c.id === 'default';
    const TYPES = [
      {
        type: 'body',
        modelType: 'character',
        name: isDef ? '👤 Model Nhân Vật Mặc Định (default_character.glb)' : '👤 Model Nhân Vật (3D .glb / Ảnh Thân)',
        btnText: isDef ? 'Tải NV Mặc Định' : 'Tải Nhân Vật'
      },
      {
        type: 'weapon',
        modelType: 'weapon',
        name: isDef ? '⚔️ Model Vũ Khí Mặc Định (default_weapon.glb)' : '⚔️ Model Vũ Khí (3D .glb / Ảnh Kiếm)',
        btnText: isDef ? 'Tải Kiếm Mặc Định' : 'Tải Vũ Khí'
      },
    ];

    TYPES.forEach(t => {
      const rowBox = document.createElement('div');
      rowBox.style.cssText = 'background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;';

      const rowTop = document.createElement('div');
      rowTop.style.cssText = 'display:flex;align-items:center;gap:10px;';

      const typeLabel = document.createElement('span');
      typeLabel.style.cssText = 'font-size:11px;font-weight:700;color:#ddd;font-family:"Be Vietnam Pro",sans-serif;flex:1;';
      typeLabel.textContent = t.name;

      const badge3D = document.createElement('span');
      badge3D.style.cssText = 'font-size:9px;font-weight:700;color:#888;padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.1);font-family:"Be Vietnam Pro",sans-serif;white-space:nowrap;';
      badge3D.textContent = '📦 3D: Đang tải…';
      modelBadges[c.id][t.modelType] = badge3D;

      const thumb = document.createElement('img');
      thumb.style.cssText = 'width:36px;height:36px;object-fit:contain;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:#050510;display:none;';
      artPreviews[c.id][t.type] = thumb;

      rowTop.appendChild(typeLabel);
      rowTop.appendChild(badge3D);
      rowTop.appendChild(thumb);
      rowBox.appendChild(rowTop);

      const fileInp = document.createElement('input');
      fileInp.type = 'file';
      fileInp.accept = '.glb,.gltf,image/*';
      fileInp.style.cssText = 'font-size:10px;color:#aaa;font-family:"Be Vietnam Pro",sans-serif;width:100%;';
      rowBox.appendChild(fileInp);

      const actionRow = document.createElement('div');
      actionRow.style.cssText = 'display:flex;gap:8px;align-items:center;';

      const upBtn = document.createElement('button');
      upBtn.style.cssText = `flex:1;padding:5px 8px;border-radius:5px;font-size:10px;font-weight:700;cursor:pointer;background:linear-gradient(135deg,rgba(${c.rgb},0.45),rgba(${c.rgb},0.2));border:1px solid ${c.color};color:#fff;font-family:'Be Vietnam Pro',sans-serif;`;
      upBtn.textContent = `📤 ${t.btnText}`;

      const statusEl = document.createElement('span');
      statusEl.style.cssText = 'font-size:10px;color:#888;font-family:"Be Vietnam Pro",sans-serif;';

      actionRow.appendChild(upBtn);
      actionRow.appendChild(statusEl);
      rowBox.appendChild(actionRow);

      upBtn.addEventListener('click', async () => {
        const file = fileInp.files[0];
        if (!file) {
          statusEl.textContent = '⚠ Chọn file .glb hoặc ảnh!';
          statusEl.style.color = '#ffcc00';
          return;
        }
        const is3D = /\.(glb|gltf)$/i.test(file.name);
        statusEl.textContent = is3D ? '⏳ Đang tải mô hình 3D…' : '⏳ Đang tải ảnh…';
        statusEl.style.color = '#aaa';
        upBtn.disabled = true;

        try {
          let d;
          if (is3D) {
            const fd = new FormData();
            fd.append('file', file);
            fd.append('element', c.id);
            fd.append('type', t.modelType);
            const r = await fetch('/api/admin/model/upload', { method: 'POST', body: fd });
            d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Upload model failed');
            statusEl.textContent = '✓ Đã lưu 3D (.glb)!';
            statusEl.style.color = '#06d6a0';

            window.dispatchEvent(new CustomEvent('character-model-updated', {
              detail: { element: c.id, type: t.modelType, url: d.url }
            }));
            _showToast(`Đã lưu mô hình 3D ${t.name} cho ${c.label}`);
          } else {
            const fd = new FormData();
            fd.append('image', file);
            fd.append('element', c.id);
            fd.append('type', t.type);
            const r = await fetch('/api/admin/art/upload', { method: 'POST', body: fd });
            d = await r.json();
            if (!r.ok) throw new Error(d.error || 'Upload art failed');
            statusEl.textContent = '✓ Đã lưu ảnh!';
            statusEl.style.color = '#06d6a0';
            thumb.src = d.url + '?t=' + Date.now();
            thumb.style.display = 'block';

            window.dispatchEvent(new CustomEvent('character-art-updated', {
              detail: { element: c.id, type: t.type, url: d.url }
            }));
            _showToast(`Đã cập nhật ảnh ${t.name} cho ${c.label}`);
          }
          refreshArtAndModels();
        } catch (e) {
          statusEl.textContent = '✗ ' + e.message;
          statusEl.style.color = '#ef233c';
        }
        upBtn.disabled = false;
      });

      card.appendChild(rowBox);
    });

    charGrid.appendChild(card);
  });

  wrap.appendChild(charGrid);

  // ── Quản Lý Mô Hình Boss (Trùm Cuối) ──────────────────────────────────
  wrap.appendChild(mkHead('👾 Quản Lý Mô Hình Boss (Trùm Cuối)'));

  const bossNote = document.createElement('div');
  bossNote.style.cssText = 'font-size:10px;color:#888;font-family:"Be Vietnam Pro",sans-serif;line-height:1.6;padding:4px 0;';
  bossNote.innerHTML = 'Tải mô hình 3D (<b>.glb / .gltf</b>) hoặc ảnh (<b>.png, .jpg</b>) cho từng Boss nguyên tố để thay thế khối hình mặc định. Khi có file, game sẽ tự động tải và hiển thị trong trận đấu.';
  wrap.appendChild(bossNote);

  const bossGrid = document.createElement('div');
  bossGrid.style.cssText = 'display:grid;grid-template-columns:1fr;gap:12px;';

  const BOSS_MANAGERS = [
    { id: 'thunder', label: '⚡ Boss Sét (Thunder Boss)', color: '#00cfff', rgb: '0,207,255', target: 'boss_thunder.glb' },
    { id: 'fire',    label: '🔥 Boss Lửa (Fire Boss)',    color: '#ff8c42', rgb: '255,140,66',  target: 'boss_fire.glb' },
    { id: 'frost',   label: '❄️ Boss Băng (Frost Boss)',   color: '#88ddff', rgb: '136,221,255', target: 'boss_frost.glb' },
  ];

  const bossBadges = {};

  const refreshBossStatus = () => {
    fetch('/api/admin/boss/status').then(r => r.json()).then(status => {
      for (const [el, s] of Object.entries(status)) {
        const badge = bossBadges[el];
        if (badge) {
          if (s.exists) {
            const typeLabel = s.type === '3d' ? `📦 3D (${s.ext})` : `🖼️ Ảnh 2.5D (${s.ext})`;
            badge.textContent = `✓ Đã có file: ${typeLabel}`;
            badge.style.color = '#06d6a0';
            badge.style.borderColor = 'rgba(6,214,160,0.4)';
          } else {
            badge.textContent = 'Chưa có file';
            badge.style.color = '#888';
            badge.style.borderColor = 'rgba(255,255,255,0.1)';
          }
        }
      }
    }).catch(() => {});
  };

  refreshBossStatus();

  BOSS_MANAGERS.forEach(b => {
    const card = document.createElement('div');
    card.style.cssText = `background:rgba(${b.rgb},0.06);border:1.5px solid rgba(${b.rgb},0.3);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:10px;`;

    // Header with status badge
    const cardTitle = document.createElement('div');
    cardTitle.style.cssText = `font-size:12px;font-weight:900;color:${b.color};font-family:'Be Vietnam Pro',sans-serif;display:flex;justify-content:space-between;align-items:center;`;

    const titleSpan = document.createElement('span');
    titleSpan.textContent = b.label;

    const badge = document.createElement('span');
    badge.textContent = 'Đang kiểm tra...';
    badge.style.cssText = 'font-size:9px;padding:2px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);color:#888;font-weight:600;';
    bossBadges[b.id] = badge;

    cardTitle.appendChild(titleSpan);
    cardTitle.appendChild(badge);
    card.appendChild(cardTitle);

    // Upload box
    const uploadBox = document.createElement('div');
    uploadBox.style.cssText = 'background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;';

    const infoText = document.createElement('div');
    infoText.style.cssText = 'font-size:10px;color:#aaa;font-family:"Be Vietnam Pro",sans-serif;';
    infoText.textContent = `Upload file .glb/.gltf (hoặc .png/.jpg): lưu vào /assets/models/${b.target}`;
    uploadBox.appendChild(infoText);

    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.glb,.gltf,.png,.jpg,.jpeg,.webp';
    fileInput.style.cssText = 'font-size:10px;color:#ddd;flex:1;min-width:180px;';

    const upBtn = document.createElement('button');
    upBtn.textContent = 'Tải Lên Cập Nhật';
    upBtn.style.cssText = `font-size:10px;font-weight:700;padding:5px 12px;background:rgba(${b.rgb},0.2);color:${b.color};border:1.5px solid ${b.color};border-radius:6px;cursor:pointer;font-family:'Be Vietnam Pro',sans-serif;`;

    const statusEl = document.createElement('span');
    statusEl.style.cssText = 'font-size:10px;font-family:"Be Vietnam Pro",sans-serif;';

    upBtn.addEventListener('click', async () => {
      const file = fileInput.files?.[0];
      if (!file) {
        statusEl.textContent = 'Chưa chọn file!';
        statusEl.style.color = '#ef233c';
        return;
      }
      upBtn.disabled = true;
      statusEl.textContent = 'Đang tải lên...';
      statusEl.style.color = '#ffcc00';

      const fd = new FormData();
      fd.append('file', file);
      fd.append('element', b.id);

      try {
        const res = await fetch('/api/admin/boss/upload', {
          method: 'POST',
          body: fd,
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Upload thất bại');
        statusEl.textContent = `✓ Đã cập nhật (${data.filename})!`;
        statusEl.style.color = '#06d6a0';
        _showToast(`Đã cập nhật mô hình cho ${b.label}`);
        refreshBossStatus();
      } catch (err) {
        statusEl.textContent = '✗ ' + err.message;
        statusEl.style.color = '#ef233c';
      } finally {
        upBtn.disabled = false;
      }
    });

    inputRow.appendChild(fileInput);
    inputRow.appendChild(upBtn);
    uploadBox.appendChild(inputRow);
    uploadBox.appendChild(statusEl);

    card.appendChild(uploadBox);
    bossGrid.appendChild(card);
  });

  wrap.appendChild(bossGrid);

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
  let adminTestGear = 'thunder'; // Default to thunder full set

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
  const playerList = document.getElementById('player-list');
  if (!playerList) return;

  playerList.innerHTML = '';
  players.forEach(p => {
    const li = document.createElement('li');
    const colorBox = document.createElement('div');
    colorBox.style.cssText = `width:18px;height:18px;background:${p.color};display:inline-block;margin-right:8px;border-radius:3px;flex-shrink:0;`;
    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    nameSpan.style.fontFamily = "'Be Vietnam Pro', sans-serif";
    nameSpan.style.fontSize   = '14px';
    li.appendChild(colorBox); li.appendChild(nameSpan);
    if (currentState && p.id === currentState.hostId) {
      const badge = document.createElement('span');
      badge.textContent = ' (HOST)';
      badge.style.cssText = 'color:gold;margin-left:8px;font-weight:800;font-size:12px;';
      li.appendChild(badge);
    }
    playerList.appendChild(li);
  });
}

export function getSelectedPreset() { return null; }
export function getEquipment() { return { ...equipment }; }
export const PRESETS = {};
