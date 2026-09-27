/**
 * public/js/audio.js  — v2.1
 *
 * BGM  : Single HTMLAudioElement plays static .mp3 files.
 *        All paths lowercase — matches Linux (Render) filesystem exactly.
 *        NO oscillator fallback. Missing file → console.error only.
 *
 * SFX  : Web Audio API procedural sounds (sword slash, thunder, fire, frost).
 *        SFX are silenced when the user mutes via the toggle button.
 */

// ── BGM track map (all lowercase — Linux-safe) ──────────────────────────────
const BGM_TRACKS = {
  lobby:   '/audio/bgm/lobby.mp3',
  thunder: '/audio/bgm/thunder.mp3',
  fire:    '/audio/bgm/fire.mp3',
  frost:   '/audio/bgm/frost.mp3',
  victory: '/audio/bgm/victory.mp3',
};

const BGM_VOLUME = 0.4;   // balanced so SFX cuts above it

// ── Single global Audio instance ─────────────────────────────────────────────
let _bgmAudio  = null;    // the ONE <audio> element — never duplicated
let _bgmTrack  = null;    // key currently loaded/playing
let _muted     = false;
let _inBattle  = false;   // true during active match — prevents accidental lobby BGM switch

export function setInBattle(inBattle) {
  _inBattle = Boolean(inBattle);
}

export function isInBattle() {
  return _inBattle;
}

function _ensureAudio() {
  if (_bgmAudio) return _bgmAudio;
  _bgmAudio = new window.Audio();
  _bgmAudio.preload = 'auto';
  _bgmAudio.addEventListener('error', (e) => {
    const src = _bgmAudio.src || '(unknown)';
    console.error(`[audio] BGM load error for "${src}":`, e.message || 'media error code ' + _bgmAudio.error?.code);
    // NO oscillator fallback — just log the error
  });
  return _bgmAudio;
}

/**
 * Play a BGM track.
 * - Same track already playing → no-op.
 * - Different track → pause, swap src, play.
 */
export function playBGM(trackKey) {
  // Guard: Battle BGM must loop continuously throughout the entire fight
  if (_inBattle && trackKey === 'lobby') {
    console.log('[audio] Blocked switching to lobby music while in battle.');
    return;
  }

  const src = BGM_TRACKS[trackKey];
  if (!src) {
    console.warn('[audio] Unknown BGM track key:', trackKey);
    return;
  }

  // Already playing this exact track → nothing to do
  if (_bgmTrack === trackKey && _bgmAudio && !_bgmAudio.paused) return;

  const audio   = _ensureAudio();
  const fullSrc = window.location.origin + src;

  if (audio.src !== fullSrc) {
    audio.pause();
    audio.src          = src;           // relative path — browser resolves it
    audio.currentTime  = 0;
  }

  audio.loop   = (trackKey !== 'victory');
  audio.volume = _muted ? 0 : BGM_VOLUME;
  _bgmTrack    = trackKey;

  const promise = audio.play();
  if (promise && typeof promise.catch === 'function') {
    promise.catch(e => {
      // Autoplay blocked by browser — queue for first user gesture
      console.log('[audio] BGM autoplay deferred until user gesture:', e.message);
      _pendingTrack = trackKey;
    });
  }
}

/** Stop BGM immediately. */
export function stopBGM() {
  if (_bgmAudio) {
    _bgmAudio.pause();
    _bgmAudio.currentTime = 0;
  }
  _bgmTrack = null;
}

// ── Legacy aliases ────────────────────────────────────────────────────────────
export function startBgm()       { /* no-op — driven by playBGM() */ }
export function stopBgm()        { stopBGM(); }
export function playLobbyMusic() { playBGM('lobby'); }
export function switchTrack(key) { playBGM(key); }

// ── Pending track (deferred until user gesture) ───────────────────────────────
let _pendingTrack = null;

// ── Mute / unmute ─────────────────────────────────────────────────────────────
export function setMuted(mute) {
  _muted = mute;
  if (_bgmAudio) _bgmAudio.volume = mute ? 0 : BGM_VOLUME;
}

export function isMuted() { return _muted; }

export function toggleMute() {
  setMuted(!_muted);
  if (!_muted && _pendingTrack) {
    // User interacted — now we can play
    const key     = _pendingTrack;
    _pendingTrack = null;
    _bgmTrack     = null;   // force re-start
    playBGM(key);
  }
  return _muted;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audio Toggle Button  🔊 / 🔇
// ═══════════════════════════════════════════════════════════════════════════════

export function mountAudioToggle() {
  if (document.getElementById('audio-toggle-btn')) return;

  // Create (or reuse) the shared top-right bar
  let bar = document.querySelector('.top-user-bar');
  if (!bar) {
    bar            = document.createElement('div');
    bar.className  = 'top-user-bar';
    document.body.appendChild(bar);
  }

  const btn        = document.createElement('button');
  btn.id           = 'audio-toggle-btn';
  btn.title        = 'Bật/Tắt nhạc nền';
  btn.textContent  = '🔊';

  btn.onclick = () => {
    // First click also satisfies browser autoplay gesture requirement
    if (_pendingTrack && (!_bgmAudio || _bgmAudio.paused)) {
      const key     = _pendingTrack;
      _pendingTrack = null;
      _bgmTrack     = null;
      playBGM(key);
      return;
    }
    const nowMuted   = toggleMute();
    btn.textContent  = nowMuted ? '🔇' : '🔊';
  };

  bar.prepend(btn);
}

// ── Bootstrap BGM on first user gesture ──────────────────────────────────────
let _bootstrapped = false;
export function bootstrapOnInteraction() {
  if (_bootstrapped) return;
  _bootstrapped = true;
  const tryPlay = () => {
    if (_pendingTrack && !_muted) {
      const key     = _pendingTrack;
      _pendingTrack = null;
      _bgmTrack     = null;
      playBGM(key);
    }
  };
  document.addEventListener('click',      tryPlay, { once: true, capture: true });
  document.addEventListener('keydown',    tryPlay, { once: true, capture: true });
  document.addEventListener('touchstart', tryPlay, { once: true, capture: true });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SFX  — Web Audio API  (no oscillator BGM here — SFX only)
// ═══════════════════════════════════════════════════════════════════════════════

let _ctx     = null;
let _sfxGain = null;

function _getCtx() {
  if (!_ctx) {
    try {
      _ctx     = new (window.AudioContext || window.webkitAudioContext)();
      _sfxGain = _ctx.createGain();
      _sfxGain.gain.value = 1.0;
      _sfxGain.connect(_ctx.destination);
    } catch (e) { console.warn('[audio] Web Audio unavailable:', e.message); }
  }
  if (_ctx?.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

function _now() { const c = _getCtx(); return c ? c.currentTime : 0; }

function _osc(type, freq, s, e, g0 = 0.35, g1 = 0) {
  const ctx = _getCtx(); if (!ctx || _muted) return;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, s);
  gain.gain.setValueAtTime(g0, s);
  gain.gain.linearRampToValueAtTime(g1, e);
  osc.connect(gain); gain.connect(_sfxGain);
  osc.start(s); osc.stop(e + 0.01);
}

function _noise(s, dur, gainPeak = 0.3, filterHz = 2000) {
  const ctx = _getCtx(); if (!ctx || _muted) return;
  const len  = Math.ceil(ctx.sampleRate * dur);
  const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src    = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain   = ctx.createGain();
  src.buffer   = buf;
  filter.type  = 'lowpass';
  filter.frequency.value = filterHz;
  gain.gain.setValueAtTime(gainPeak, s);
  gain.gain.exponentialRampToValueAtTime(0.001, s + dur);
  src.connect(filter); filter.connect(gain); gain.connect(_sfxGain);
  src.start(s); src.stop(s + dur + 0.01);
}

export function playCorrect() {
  const t = _now();
  _osc('sine', 523.25, t,       t + 0.12, 0.35, 0);
  _osc('sine', 659.26, t + 0.1, t + 0.28, 0.35, 0);
  _osc('sine', 783.99, t + 0.2, t + 0.48, 0.35, 0);
  _osc('triangle', 1046.5, t + 0.18, t + 0.5, 0.15, 0);
}

export function playWrong() {
  const t = _now();
  _osc('sawtooth', 110, t,       t + 0.12, 0.3, 0);
  _osc('sawtooth', 104, t + 0.1, t + 0.3,  0.3, 0);
  _osc('square',    80, t,       t + 0.35, 0.15, 0);
  _noise(t, 0.25, 0.1, 300);
}

export function playSlash() {
  const ctx = _getCtx(); if (!ctx || _muted) return;
  const t = _now();
  _noise(t, 0.18, 0.25, 4000);
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, t + 0.14);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.32);
  g.gain.setValueAtTime(0.4, t + 0.14);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  osc.connect(g); g.connect(_sfxGain);
  osc.start(t + 0.14); osc.stop(t + 0.33);
}

export function playThunder() {
  const t = _now();
  _noise(t, 0.08, 0.5, 8000);
  _noise(t + 0.06, 0.7, 0.4, 200);
  _osc('square', 60,   t,        t + 0.5,  0.3, 0);
  _osc('square', 120,  t + 0.05, t + 0.45, 0.2, 0);
  _osc('sine',   2000, t,        t + 0.1,  0.3, 0);
  _osc('sine',   1200, t + 0.08, t + 0.2,  0.2, 0);
}

export function playFire() {
  const ctx = _getCtx(); if (!ctx || _muted) return;
  const t = _now();
  _noise(t, 0.12, 0.55, 500);
  for (let i = 0; i < 4; i++) _noise(t + i * 0.06, 0.05, 0.2 - i * 0.03, 1200 + i * 400);
  const osc = ctx.createOscillator();
  const g   = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(g); g.connect(_sfxGain);
  osc.start(t); osc.stop(t + 0.42);
}

export function playFrost() {
  const t = _now();
  _osc('sine',     1800, t,        t + 0.08, 0.35, 0);
  _osc('triangle', 2400, t + 0.04, t + 0.14, 0.25, 0);
  _osc('sine',     3200, t + 0.08, t + 0.2,  0.15, 0);
  for (let i = 0; i < 5; i++) {
    _osc('sine', 1600 + Math.random() * 2400,
         t + 0.1 + i * 0.04, t + 0.28 + i * 0.04, 0.12, 0);
  }
  _noise(t, 0.12, 0.2, 6000);
}

export function playVictory() {
  const t     = _now();
  const notes = [261.63, 329.63, 392.0, 523.25, 659.26, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const s = t + i * 0.13;
    _osc('sine',     freq,     s, s + 0.22, 0.4, 0);
    _osc('triangle', freq * 2, s, s + 0.15, 0.1, 0);
  });
  const end = t + notes.length * 0.13;
  [523.25, 659.26, 783.99].forEach(f => _osc('sine', f, end, end + 0.8, 0.3, 0));
  _noise(end, 0.3, 0.1, 4000);
}
