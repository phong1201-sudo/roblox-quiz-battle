// public/js/auth.js — Client-side authentication module
// Handles login/register modal, session persistence, and user state.

// ── Session state (persisted in sessionStorage for tab lifetime) ──────────────
let _currentUser = null;   // { id, username, role, unlockedSets, highestStage }

function _saveSession(user) {
  _currentUser = user;
  try { sessionStorage.setItem('qb3d_user', JSON.stringify(user)); } catch(e) {}
  // Keep window.gameState in sync
  if (window.gameState) {
    window.gameState.userId      = user.id;
    window.gameState.username    = user.username;
    window.gameState.role        = user.role;
    window.gameState.unlockedSets = user.unlockedSets || [];
  }
  window._godFather = (user.role === 'admin');
}

function _clearSession() {
  _currentUser = null;
  try { sessionStorage.removeItem('qb3d_user'); } catch(e) {}
  window._godFather = false;
  if (window.gameState) {
    window.gameState.userId = null;
    window.gameState.username = null;
    window.gameState.unlockedSets = [];
  }
}

export function getCurrentUser() { return _currentUser; }

export function getUnlockedSets() {
  if (!_currentUser) return [];
  return Array.isArray(_currentUser.unlockedSets) ? _currentUser.unlockedSets : [];
}

export function isAdmin() { return _currentUser?.role === 'admin'; }

// ── Server calls ──────────────────────────────────────────────────────────────
async function _post(url, body) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

export async function loginUser(username, password) {
  const data = await _post('/api/login', { username, password });
  if (data.ok) _saveSession(data.user);
  return data;
}

export async function registerUser(username, password) {
  const data = await _post('/api/register', { username, password });
  if (data.ok) _saveSession(data.user);
  return data;
}

export function logoutUser() {
  _clearSession();
  // Rebuild the auth modal
  showAuthModal();
}

/** Call after earning a Perfect to permanently unlock a set. */
export async function persistUnlockSet(setId) {
  if (!_currentUser) return;
  const data = await _post('/api/unlock-set', { userId: _currentUser.id, setId });
  if (data.ok) {
    _currentUser.unlockedSets = data.user.unlockedSets;
    try { sessionStorage.setItem('qb3d_user', JSON.stringify(_currentUser)); } catch(e) {}
    if (window.gameState) window.gameState.unlockedSets = _currentUser.unlockedSets;
  }
  return data;
}

// ── Auth Modal UI ─────────────────────────────────────────────────────────────
export function showAuthModal() {
  // Remove any existing modal
  document.getElementById('auth-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'auth-modal';
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:99999;
    background:rgba(5,3,20,0.96);
    display:flex;align-items:center;justify-content:center;
    font-family:'Be Vietnam Pro','Nunito',sans-serif;
  `;

  const box = document.createElement('div');
  box.style.cssText = `
    background:linear-gradient(160deg,#0d0a24,#1a0a2e);
    border:2px solid #ffcc00;border-radius:14px;
    padding:32px 36px;width:320px;max-width:92vw;
    display:flex;flex-direction:column;gap:14px;
    box-shadow:0 0 60px rgba(255,204,0,0.15),0 8px 40px rgba(0,0,0,0.8);
  `;

  // Title
  const title = document.createElement('div');
  title.innerHTML = `<div style="font-size:28px;text-align:center;">⚔️</div>
    <div style="font-size:16px;font-weight:900;color:#ffcc00;text-align:center;letter-spacing:1px;">Quiz Battle 3D</div>
    <div id="auth-mode-label" style="font-size:11px;color:#aaa;text-align:center;margin-top:2px;">Đăng nhập để tiếp tục</div>`;
  box.appendChild(title);

  // Fields
  const mkInput = (id, placeholder, type='text') => {
    const el = document.createElement('input');
    el.id = id; el.type = type; el.placeholder = placeholder;
    el.style.cssText = `width:100%;box-sizing:border-box;padding:9px 12px;border-radius:7px;border:1.5px solid #333;background:#0a0820;color:#fff;font-family:'Be Vietnam Pro',sans-serif;font-size:13px;outline:none;`;
    el.addEventListener('focus', ()=>{ el.style.borderColor='#ffcc00'; });
    el.addEventListener('blur',  ()=>{ el.style.borderColor='#333'; });
    return el;
  };

  const usernameInput = mkInput('auth-username', '👤 Tên đăng nhập');
  const passwordInput = mkInput('auth-password', '🔑 Mật khẩu', 'password');
  box.appendChild(usernameInput);
  box.appendChild(passwordInput);

  // Error/status
  const statusEl = document.createElement('div');
  statusEl.id = 'auth-status';
  statusEl.style.cssText = 'font-size:11px;color:#ef233c;text-align:center;min-height:16px;';
  box.appendChild(statusEl);

  // Buttons
  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;flex-direction:column;gap:8px;';

  const mkBtn = (text, primary) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.style.cssText = `
      padding:10px;border-radius:7px;border:none;cursor:pointer;
      font-family:'Be Vietnam Pro',sans-serif;font-size:13px;font-weight:700;
      ${primary
        ? 'background:linear-gradient(135deg,#ffcc00,#ff6b35);color:#111;'
        : 'background:rgba(255,255,255,0.07);color:#aaa;border:1.5px solid #444;'}
    `;
    return b;
  };

  const loginBtn    = mkBtn('🔑 Đăng nhập', true);
  const registerBtn = mkBtn('📝 Đăng ký tài khoản mới', false);
  btnRow.appendChild(loginBtn);
  btnRow.appendChild(registerBtn);
  box.appendChild(btnRow);

  // Divider hint
  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:9px;color:#555;text-align:center;';
  hint.textContent = 'Admin: God Father / 123';
  box.appendChild(hint);

  overlay.appendChild(box);
  document.body.appendChild(overlay);

  // Focus username
  setTimeout(() => usernameInput.focus(), 50);

  const setStatus = (msg, color='#ef233c') => {
    statusEl.textContent = msg;
    statusEl.style.color = color;
  };

  const setLoading = (busy) => {
    loginBtn.disabled = registerBtn.disabled = busy;
    loginBtn.style.opacity = registerBtn.style.opacity = busy ? '0.6' : '1';
  };

  loginBtn.onclick = async () => {
    const u = usernameInput.value.trim();
    const p = passwordInput.value;
    if (!u || !p) { setStatus('Vui lòng nhập tên đăng nhập và mật khẩu.'); return; }
    setLoading(true); setStatus('Đang đăng nhập…', '#aaa');
    const res = await loginUser(u, p);
    setLoading(false);
    if (res.ok) {
      overlay.remove();
      _onLoginSuccess(res.user);
    } else {
      setStatus(res.error || 'Đăng nhập thất bại.');
      passwordInput.value = '';
      passwordInput.focus();
    }
  };

  registerBtn.onclick = async () => {
    const u = usernameInput.value.trim();
    const p = passwordInput.value;
    if (!u || !p) { setStatus('Vui lòng nhập tên và mật khẩu.'); return; }
    setLoading(true); setStatus('Đang đăng ký…', '#aaa');
    const res = await registerUser(u, p);
    setLoading(false);
    if (res.ok) {
      overlay.remove();
      _onLoginSuccess(res.user);
    } else {
      setStatus(res.error || 'Đăng ký thất bại.');
    }
  };

  // Allow Enter key
  [usernameInput, passwordInput].forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') loginBtn.click(); });
  });
}

// ── Post-login setup ──────────────────────────────────────────────────────────
function _onLoginSuccess(user) {
  // ── 1. Show menu screen — critical: auth modal was covering a blank page ──
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const menuScreen = document.getElementById('screen-menu');
  if (menuScreen) menuScreen.classList.add('active');

  // ── 2. Render top-right user badge ────────────────────────────────────────
  _renderUserBadge(user);

  // ── 3. Pre-fill name field ────────────────────────────────────────────────
  const nameInput = document.getElementById('player-name');
  if (nameInput) nameInput.value = user.username;

  // ── 4. Sync gameState if it already exists ────────────────────────────────
  if (window.gameState) {
    window.gameState.userId       = user.id;
    window.gameState.username     = user.username;
    window.gameState.role         = user.role;
    window.gameState.unlockedSets = user.unlockedSets || [];
  }

  // ── 5. Rebuild elemental set picker if lobby is already open ─────────────
  const avatarSection = document.getElementById('avatar-section');
  if (avatarSection && typeof window.__rebuildSetPicker === 'function')
    window.__rebuildSetPicker(avatarSection);

  // ── 6. Dispatch event so main.js can do its own sync ─────────────────────
  window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
}

function _renderUserBadge(user) {
  document.getElementById('user-badge')?.remove();

  const badge = document.createElement('div');
  badge.id = 'user-badge';
  const isAdmin = user.role === 'admin';
  badge.style.cssText = `
    position:fixed;top:10px;right:12px;z-index:9000;
    display:flex;align-items:center;gap:8px;
    background:rgba(10,8,28,0.92);
    border:1.5px solid ${isAdmin ? '#ff4444' : '#ffcc00'};
    border-radius:20px;padding:5px 12px 5px 8px;
    font-family:'Be Vietnam Pro',sans-serif;font-size:11px;
    box-shadow:0 2px 12px rgba(0,0,0,0.5);
    cursor:default;
  `;
  badge.innerHTML = `
    <span style="font-size:14px;">${isAdmin ? '⚡' : '👤'}</span>
    <span style="color:${isAdmin ? '#ff6666' : '#ffcc00'};font-weight:700;">${user.username}</span>
    <span style="color:#666;font-size:9px;">${isAdmin ? 'ADMIN' : `${(user.unlockedSets||[]).length}/3 bộ`}</span>
    <button id="btn-logout" style="margin-left:4px;font-size:9px;padding:2px 7px;border:1px solid #444;background:rgba(255,255,255,0.06);color:#aaa;border-radius:10px;cursor:pointer;font-family:'Be Vietnam Pro',sans-serif;">Đăng xuất</button>
  `;
  document.body.appendChild(badge);

  badge.querySelector('#btn-logout').onclick = () => {
    if (!confirm('Đăng xuất?')) return;
    logoutUser();
    badge.remove();
  };
}

// ── Auto-restore session ──────────────────────────────────────────────────────
export function init() {
  try {
    const saved = sessionStorage.getItem('qb3d_user');
    if (saved) {
      const user = JSON.parse(saved);
      if (user?.id && user?.username) {
        _saveSession(user);
        // Use _onLoginSuccess so screen activation + badge fire consistently
        // Defer so DOMContentLoaded finishes wiring event listeners first
        setTimeout(() => _onLoginSuccess(user), 0);

        // ── Validate session against server in background ──────────────────
        // If server restarted (Render ephemeral DB), user won't exist → force re-login
        fetch('/api/auth/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id }),
        }).then(r => r.json()).then(data => {
          if (!data.ok) {
            console.warn('[auth] Server session invalid — re-login required:', data.error);
            _clearSession();
            document.getElementById('user-badge')?.remove();
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            showAuthModal();
          } else {
            // Refresh user data from server (unlockedSets may have changed)
            _saveSession(data.user);
            if (window.__rebuildSetPicker) {
              const avatarSection = document.getElementById('avatar-section');
              if (avatarSection) window.__rebuildSetPicker(avatarSection);
            }
          }
        }).catch(() => {
          // Network error — keep local session, don't disrupt UX
        });

        return true;   // already logged in (pending server confirmation)
      }
    }
  } catch(e) {}
  return false;   // need to log in
}
