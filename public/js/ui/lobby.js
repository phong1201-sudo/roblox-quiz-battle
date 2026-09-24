import { socket } from '../socket.js';
import { showScreen } from '../main.js';
// THREE is available as a global from the CDN script tag

// ─────────────────────────────────────────────────────────────────────────────
// Equipment catalogue
// ─────────────────────────────────────────────────────────────────────────────
const EQUIPMENT_SLOTS = {
  hat:    { label: '🎩 Hat',    items: [{ id:'cap',    name:'Classic Cap',    color:'#cc2222' }, { id:'helm',  name:'Knight Helm',  color:'#888899' }] },
  shirt:  { label: '👕 Shirt',  items: [{ id:'hoodie', name:'Blue Hoodie',    color:'#2255cc' }, { id:'vest',  name:'Leather Vest', color:'#8b5e3c' }] },
  pants:  { label: '👖 Pants',  items: [{ id:'jeans',  name:'Black Jeans',   color:'#222233' }, { id:'cargo', name:'Mil. Cargo',   color:'#556b2f' }] },
  shoes:  { label: '👟 Shoes',  items: [{ id:'sneak',  name:'Sneakers',      color:'#eeeeee' }, { id:'boots', name:'Combat Boots', color:'#3d2b1f' }] },
  weapon: { label: '⚔️  Weapon', items: [{ id:'sword',  name:'Wood Sword',   color:'#8b6914' }, { id:'glove', name:'Boxing Glove', color:'#cc4400' }] },
};

const DEFAULT_EQUIPMENT = { hat:'cap', shirt:'hoodie', pants:'jeans', shoes:'sneak', weapon:'sword' };

// Module-level equipment state (synced to window.gameState.equipment)
let equipment = { ...DEFAULT_EQUIPMENT };

// ─────────────────────────────────────────────────────────────────────────────
// Draw a small 80×80 character preview onto a canvas
// ─────────────────────────────────────────────────────────────────────────────
function drawWardrobePreview(canvas) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  ctx.fillStyle = '#0d0a1e';
  ctx.fillRect(0, 0, W, H);

  const get = (slot) => {
    const sel = equipment[slot] || DEFAULT_EQUIPMENT[slot];
    return EQUIPMENT_SLOTS[slot].items.find(i => i.id === sel)?.color || '#888';
  };

  const skin = '#f5c4a0';

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.ellipse(W/2, H-4, 14, 4, 0, 0, Math.PI*2); ctx.fill();

  // Shoes
  ctx.fillStyle = get('shoes');
  ctx.fillRect(W/2-14, H-16, 11, 8);
  ctx.fillRect(W/2+3,  H-16, 11, 8);

  // Pants
  ctx.fillStyle = get('pants');
  ctx.fillRect(W/2-11, H-28, 9, 14);
  ctx.fillRect(W/2+2,  H-28, 9, 14);

  // Shirt/torso
  ctx.fillStyle = get('shirt');
  ctx.fillRect(W/2-13, H-48, 26, 21);

  // Arms (skin)
  ctx.fillStyle = skin;
  ctx.fillRect(W/2-20, H-47, 8, 16);
  ctx.fillRect(W/2+12, H-47, 8, 16);

  // Head (skin)
  ctx.fillStyle = skin;
  ctx.fillRect(W/2-10, H-66, 20, 18);

  // Hat
  ctx.fillStyle = get('hat');
  ctx.fillRect(W/2-11, H-70, 22, 8);
  ctx.fillRect(W/2-9,  H-67, 18, 5);

  // Eyes
  ctx.fillStyle = '#222';
  ctx.fillRect(W/2-6, H-60, 3, 3);
  ctx.fillRect(W/2+3, H-60, 3, 3);

  // Weapon (right side)
  const wColor = get('weapon');
  ctx.fillStyle = wColor;
  if (equipment.weapon === 'glove') {
    ctx.fillRect(W/2+18, H-50, 10, 10);
  } else {
    ctx.fillRect(W/2+19, H-58, 4, 22);
    ctx.fillStyle = '#888';
    ctx.fillRect(W/2+17, H-43, 8, 3);
  }

  // Thunder glow outline if thunder set
  if (window.gameState?.thunderSet) {
    ctx.strokeStyle = 'rgba(0,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00ffff';
    ctx.strokeRect(2, 2, W-4, H-4);
    ctx.shadowBlur = 0;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Build the wardrobe panel into a container element
// ─────────────────────────────────────────────────────────────────────────────
function buildWardrobeUI(container, previewCanvas) {
  container.innerHTML = '';

  Object.entries(EQUIPMENT_SLOTS).forEach(([slot, def]) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:6px; margin-bottom:5px;';

    const label = document.createElement('span');
    label.textContent = def.label;
    label.style.cssText = 'font-size:11px; color:#aaa; width:76px; flex-shrink:0; font-family:"Be Vietnam Pro",sans-serif;';
    row.appendChild(label);

    def.items.forEach(item => {
      const btn = document.createElement('button');
      btn.dataset.slot   = slot;
      btn.dataset.itemId = item.id;
      btn.style.cssText = `
        flex:1; padding:4px 6px; font-size:10px; font-weight:700;
        font-family:'Be Vietnam Pro',sans-serif; cursor:pointer;
        border-radius:5px; border:2px solid transparent;
        background:${item.color}22; color:#eee;
        display:flex; align-items:center; gap:5px; transition:border-color 0.1s;
      `;

      // Color swatch
      const swatch = document.createElement('span');
      swatch.style.cssText = `width:10px;height:10px;border-radius:2px;background:${item.color};flex-shrink:0;`;
      btn.appendChild(swatch);
      btn.appendChild(document.createTextNode(item.name));

      // Selected state
      if (equipment[slot] === item.id) {
        btn.style.borderColor = '#ffcc00';
        btn.style.background  = item.color + '44';
      }

      btn.addEventListener('click', () => {
        // Deselect siblings
        container.querySelectorAll(`[data-slot="${slot}"]`).forEach(b => {
          const sibling = EQUIPMENT_SLOTS[slot].items.find(i => i.id === b.dataset.itemId);
          b.style.borderColor = 'transparent';
          b.style.background  = (sibling?.color || '#888') + '22';
        });
        // Select this
        btn.style.borderColor = '#ffcc00';
        btn.style.background  = item.color + '44';
        // Update state
        equipment[slot] = item.id;
        if (window.gameState) {
          window.gameState.equipment = { ...equipment };
          window.gameState.avatarPreset = null;
        }
        // Redraw preview
        if (previewCanvas) drawWardrobePreview(previewCanvas);
      });

      row.appendChild(btn);
    });

    container.appendChild(row);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Thunder Set — called from hud.js milestone popup
// ─────────────────────────────────────────────────────────────────────────────
export function applyThunderSet() {
  equipment = { hat:'helm', shirt:'vest', pants:'cargo', shoes:'boots', weapon:'sword' };
  if (window.gameState) {
    window.gameState.equipment    = { ...equipment };
    window.gameState.thunderSet   = true;
    window.gameState.damagePerHit = 2;
  }
  // Rebuild wardrobe UI to show Thunder colors
  const container = document.getElementById('wardrobe-slots');
  const preview   = document.getElementById('wardrobe-preview');
  if (container) buildWardrobeUI(container, preview);
  if (preview)   drawWardrobePreview(preview);
  // Flash the preview canvas gold
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

  // ── "None / Default" — always available ─────────────────────────────────────
  const noneBtn = document.createElement('button');
  noneBtn.className = 'btn';
  noneBtn.textContent = '🧍 Thường';
  noneBtn.style.cssText = `font-size:10px;padding:4px 10px;border:2px solid #888;background:rgba(30,30,30,0.6);color:#ccc;font-family:"Be Vietnam Pro",sans-serif;cursor:pointer;`;
  if (!window.gameState?.equippedSet) noneBtn.style.borderColor = '#fff';
  noneBtn.onclick = () => {
    if (window.gameState) { window.gameState.equippedSet = null; window.gameState.thunderSet = false; }
    _highlightActiveSet(btnRow, null, noneBtn);
  };
  btnRow.appendChild(noneBtn);

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
          window.gameState.equippedSet  = s.id;
          window.gameState.thunderSet   = s.id === 'thunder';
          window.gameState.damagePerHit = 2;
        }
        _highlightActiveSet(btnRow, s.id, noneBtn);
        btn.style.boxShadow = `0 0 12px ${s.color}`;
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
function _highlightActiveSet(btnRow, activeId, noneBtn) {
  btnRow.querySelectorAll('button[data-set-id]').forEach(b => { b.style.boxShadow='none'; });
  noneBtn.style.borderColor = activeId ? '#888' : '#fff';
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

  // Sync equipment to gameState
  if (!window.gameState.equipment) window.gameState.equipment = { ...equipment };
  else equipment = { ...window.gameState.equipment };

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
  const FULL_PIECES = ['hat','shirt','pants','shoes','weapon'];

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
      <span style="font-size:8px;color:${isFull ? b.color : '#555'};margin-top:2px;">${isFull ? '✦ Đầy bộ' : `${count}/5 mảnh`}</span>
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

  // Inventory pieces display
  const invEl = document.createElement('div');
  invEl.style.cssText = 'margin-top:8px;display:flex;flex-direction:column;gap:4px;';
  BOSSES.forEach(b => {
    const pieces  = inventory[b.id] || [];
    const isFull  = FULL_PIECES.every(p => pieces.includes(p));
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;';
    row.innerHTML = `
      <span style="font-size:10px;width:90px;color:${b.color};font-weight:700;font-family:'Be Vietnam Pro',sans-serif;">${b.label}</span>
      ${FULL_PIECES.map(p => `<span title="${p}" style="font-size:14px;opacity:${pieces.includes(p)?'1':'0.18'};">${{hat:'🎩',shirt:'👕',pants:'👖',shoes:'👟',weapon:'⚔️'}[p]}</span>`).join('')}
      ${isFull ? `<span style="font-size:9px;color:${b.color};font-weight:700;margin-left:4px;">✦ KỸ NĂNG</span>` : ''}
    `;
    invEl.appendChild(row);
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

  let adminBoss = 'thunder';
  let adminDiff = 'easy';

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

  const launchBtn = document.createElement('button');
  launchBtn.style.cssText = 'background:linear-gradient(135deg,#ff4444,#aa0000);color:#fff;font-size:12px;font-weight:800;padding:10px;border:none;border-radius:7px;cursor:pointer;font-family:"Be Vietnam Pro",sans-serif;width:100%;';
  launchBtn.textContent = '⚡ Bắt Đầu (God Father Launch)';
  launchBtn.onclick = () => {
    socket.emit('set_mode', { code: gameState.code, mode: 'pve' });
    socket.emit('start_game', { code: gameState.code, element: adminBoss, difficulty: adminDiff });
  };
  wrap.appendChild(launchBtn);

  // 5-question dev test
  const devBtn = document.createElement('button');
  devBtn.textContent = '🧪 Dev Run (5 câu test)';
  devBtn.style.cssText = 'font-size:10px;padding:4px 12px;border:1.5px solid #ff4444;background:rgba(100,0,0,0.6);color:#ff4444;border-radius:4px;cursor:pointer;font-weight:700;font-family:"Be Vietnam Pro",sans-serif;width:100%;';
  const devStatus = document.createElement('div');
  devStatus.style.cssText = 'font-size:9px;color:#888;text-align:center;font-family:"Be Vietnam Pro",sans-serif;';
  devBtn.onclick = async () => {
    devStatus.textContent = 'Đang tải…';
    try {
      const r = await fetch(`/api/dev-questions?code=${gameState.code}`, { method:'POST' });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'failed');
      devStatus.textContent = `✓ ${d.questionCount} câu hỏi dev đã tải!`;
      devStatus.style.color = '#06d6a0';
      if (window.gameState) { window.gameState.bossIndex=0; window.gameState.bossElement=null; }
    } catch(e) { devStatus.textContent='Lỗi: '+e.message; devStatus.style.color='#ef233c'; }
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
