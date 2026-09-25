/**
 * public/js/audio.js — Procedural Web Audio SFX + BGM
 * Zero external assets. All sounds synthesised with the Web Audio API.
 * Singleton pattern: import and call freely from any module.
 */

let _ctx = null;
let _bgmNodes = [];        // active BGM oscillator/gain refs
let _bgmRunning = false;
let _muted = false;
let _masterGain = null;

// ── Context bootstrap (call once on first interaction) ──────────────────────
function _getCtx() {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      _masterGain = _ctx.createGain();
      _masterGain.gain.value = _muted ? 0 : 1;
      _masterGain.connect(_ctx.destination);
    } catch (e) {
      console.warn('[audio] Web Audio API not available:', e.message);
    }
  }
  if (_ctx && _ctx.state === 'suspended') {
    _ctx.resume().catch(() => {});
  }
  return _ctx;
}

// ── Internal helpers ─────────────────────────────────────────────────────────
function _osc(type, freq, startTime, endTime, gainStart = 0.4, gainEnd = 0) {
  const ctx = _getCtx();
  if (!ctx) return null;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(gainStart, startTime);
  gain.gain.linearRampToValueAtTime(gainEnd, endTime);
  osc.connect(gain);
  gain.connect(_masterGain);
  osc.start(startTime);
  osc.stop(endTime + 0.01);
  return { osc, gain };
}

function _noise(startTime, duration, gainPeak = 0.3, filterFreq = 2000) {
  const ctx = _getCtx();
  if (!ctx) return;
  const bufLen = ctx.sampleRate * duration;
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(filterFreq, startTime);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainPeak, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(_masterGain);
  src.start(startTime);
  src.stop(startTime + duration + 0.01);
}

function _now() {
  const ctx = _getCtx();
  return ctx ? ctx.currentTime : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// SFX PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/** ✓ Correct answer — cheerful two-tone chime */
export function playCorrect() {
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  _osc('sine', 523.25, t,       t + 0.12, 0.35, 0.0);  // C5
  _osc('sine', 659.26, t + 0.1, t + 0.28, 0.35, 0.0);  // E5
  _osc('sine', 783.99, t + 0.2, t + 0.48, 0.35, 0.0);  // G5
  // Bright shimmer overtone
  _osc('triangle', 1046.5, t + 0.18, t + 0.5, 0.15, 0.0);
}

/** ✗ Wrong answer — low buzzing error */
export function playWrong() {
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  _osc('sawtooth', 110, t,       t + 0.12, 0.3, 0.0);
  _osc('sawtooth', 104, t + 0.1, t + 0.3,  0.3, 0.0);
  _osc('square',    80, t,       t + 0.35, 0.15, 0.0);
  _noise(t, 0.25, 0.1, 300);
}

/** ⚔ Default slash — whoosh + impact */
export function playSlash() {
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  // Whoosh: swept noise
  _noise(t, 0.18, 0.25, 4000);
  // Impact crack
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, t + 0.14);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.32);
  gain.gain.setValueAtTime(0.4, t + 0.14);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  osc.connect(gain); gain.connect(_masterGain);
  osc.start(t + 0.14); osc.stop(t + 0.33);
}

/** ⚡ Thunder — deep rumble + crack */
export function playThunder() {
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  // Lightning crack: high-pitched noise burst
  _noise(t, 0.08, 0.5, 8000);
  // Deep rumble
  _noise(t + 0.06, 0.7, 0.4, 200);
  // Electric buzz
  _osc('square', 60,  t,       t + 0.5,  0.3, 0.0);
  _osc('square', 120, t + 0.05,t + 0.45, 0.2, 0.0);
  // High shimmer
  _osc('sine', 2000, t, t + 0.1, 0.3, 0.0);
  _osc('sine', 1200, t + 0.08, t + 0.2, 0.2, 0.0);
}

/** 🔥 Fire — crackling explosion burst */
export function playFire() {
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  // Explosion thud
  _noise(t, 0.12, 0.55, 500);
  // Crackle: multi-burst noise
  for (let i = 0; i < 4; i++) {
    _noise(t + i * 0.06, 0.05, 0.2 - i * 0.03, 1200 + i * 400);
  }
  // Low boom
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.4);
  g.gain.setValueAtTime(0.5, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
  osc.connect(g); g.connect(_masterGain);
  osc.start(t); osc.stop(t + 0.42);
}

/** ❄️ Frost — high-pitched ice crystal shatter */
export function playFrost() {
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  // Ice crack — falling pitch
  _osc('sine',     1800, t,        t + 0.08, 0.35, 0.0);
  _osc('triangle', 2400, t + 0.04, t + 0.14, 0.25, 0.0);
  _osc('sine',     3200, t + 0.08, t + 0.2,  0.15, 0.0);
  // Sparkle tail
  for (let i = 0; i < 5; i++) {
    const freq = 1600 + Math.random() * 2400;
    _osc('sine', freq, t + 0.1 + i * 0.04, t + 0.28 + i * 0.04, 0.12, 0.0);
  }
  // Short high noise burst
  _noise(t, 0.12, 0.2, 6000);
}

/** 🏆 Victory fanfare jingle */
export function playVictory() {
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  // Ascending fanfare: C-E-G-C
  const notes = [261.63, 329.63, 392.0, 523.25, 659.26, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const s = t + i * 0.13;
    _osc('sine', freq, s, s + 0.22, 0.4, 0.0);
    _osc('triangle', freq * 2, s, s + 0.15, 0.1, 0.0);
  });
  // Final chord
  const end = t + notes.length * 0.13;
  [523.25, 659.26, 783.99].forEach(f => _osc('sine', f, end, end + 0.8, 0.3, 0.0));
  _noise(end, 0.3, 0.1, 4000);
}

// ═══════════════════════════════════════════════════════════════════════════
// BGM — Procedural retro arcade battle loop
// ═══════════════════════════════════════════════════════════════════════════

const BGM_TEMPO   = 0.22;   // seconds per 8th note at ~136 BPM
const BGM_MELODY  = [
  392.0, 392.0, 493.88, 523.25, 587.33, 523.25, 493.88, 392.0,
  349.23,349.23,392.0,  440.0,  493.88, 440.0,  392.0,  349.23,
  329.63,349.23,392.0,  440.0,  493.88, 523.25, 587.33, 659.26,
  587.33,523.25,493.88, 440.0,  392.0,  349.23, 329.63, 293.66,
];
const BGM_BASS    = [
  98, 98, 98, 98, 87.31, 87.31, 87.31, 87.31,
  77.78,77.78,77.78,77.78, 73.42,73.42,73.42,73.42,
  65.41,65.41,65.41,65.41, 69.30,69.30,69.30,69.30,
  73.42,73.42,73.42,73.42, 77.78,77.78,77.78,77.78,
];

let _bgmLoopTimeout = null;
let _bgmEnabled     = true;

function _scheduleBgmLoop(startAt) {
  if (!_bgmEnabled || _muted || !_bgmRunning) return;
  const ctx = _getCtx(); if (!ctx) return;

  const loopDur = BGM_MELODY.length * BGM_TEMPO;
  const melGain = ctx.createGain();
  const bassGain = ctx.createGain();
  melGain.gain.value  = 0.09;
  bassGain.gain.value = 0.12;
  melGain.connect(_masterGain);
  bassGain.connect(_masterGain);

  BGM_MELODY.forEach((freq, i) => {
    const s = startAt + i * BGM_TEMPO;
    const e = s + BGM_TEMPO * 0.8;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(1, s);
    g.gain.linearRampToValueAtTime(0, e);
    o.connect(g); g.connect(melGain);
    o.start(s); o.stop(e + 0.01);
  });

  BGM_BASS.forEach((freq, i) => {
    const s = startAt + i * BGM_TEMPO;
    const e = s + BGM_TEMPO;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.value = freq;
    g.gain.setValueAtTime(1, s);
    g.gain.linearRampToValueAtTime(0, e);
    o.connect(g); g.connect(bassGain);
    o.start(s); o.stop(e + 0.01);
  });

  // Kick drum on every 4th note
  for (let i = 0; i < BGM_MELODY.length; i += 4) {
    const s = startAt + i * BGM_TEMPO;
    const ko = ctx.createOscillator();
    const kg = ctx.createGain();
    ko.type = 'sine';
    ko.frequency.setValueAtTime(160, s);
    ko.frequency.exponentialRampToValueAtTime(40, s + 0.08);
    kg.gain.setValueAtTime(0.4, s);
    kg.gain.exponentialRampToValueAtTime(0.001, s + 0.09);
    ko.connect(kg); kg.connect(_masterGain);
    ko.start(s); ko.stop(s + 0.1);
  }

  // Schedule next loop ~50ms before end to avoid gaps
  const msUntilNext = Math.max(0, (startAt + loopDur - ctx.currentTime - 0.05) * 1000);
  _bgmLoopTimeout = setTimeout(() => _scheduleBgmLoop(startAt + loopDur), msUntilNext);
}

export function startBgm() {
  if (_bgmRunning) return;
  _bgmRunning = true;
  _bgmEnabled = true;
  const ctx = _getCtx(); if (!ctx) return;
  _scheduleBgmLoop(ctx.currentTime + 0.1);
}

export function stopBgm() {
  _bgmRunning = false;
  clearTimeout(_bgmLoopTimeout);
}

// ═══════════════════════════════════════════════════════════════════════════
// Mute / Unmute toggle
// ═══════════════════════════════════════════════════════════════════════════

export function setMuted(mute) {
  _muted = mute;
  const ctx = _getCtx();
  if (!ctx || !_masterGain) return;
  _masterGain.gain.cancelScheduledValues(ctx.currentTime);
  _masterGain.gain.setValueAtTime(mute ? 0 : 1, ctx.currentTime);
  if (mute) stopBgm();
}

export function isMuted() { return _muted; }

export function toggleMute() {
  setMuted(!_muted);
  if (!_muted && !_bgmRunning) startBgm();
  return _muted;
}

// ═══════════════════════════════════════════════════════════════════════════
// Audio Toggle Button — call once after DOMContentLoaded
// ═══════════════════════════════════════════════════════════════════════════

export function mountAudioToggle() {
  if (document.getElementById('audio-toggle-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'audio-toggle-btn';
  btn.title = 'Bật/Tắt âm thanh';
  btn.textContent = '🔊';
  btn.style.cssText = `
    position: fixed;
    top: 10px; left: 12px;
    z-index: 9100;
    background: rgba(10,8,28,0.85);
    border: 1.5px solid #ffcc00;
    border-radius: 20px;
    padding: 4px 10px;
    font-size: 16px;
    cursor: pointer;
    color: #ffcc00;
    font-family: 'Be Vietnam Pro', sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    line-height: 1.4;
    user-select: none;
  `;

  btn.onclick = () => {
    // First click: bootstrap AudioContext + start BGM
    _getCtx();
    const nowMuted = toggleMute();
    btn.textContent = nowMuted ? '🔇' : '🔊';
    btn.style.borderColor = nowMuted ? '#666' : '#ffcc00';
    btn.style.color       = nowMuted ? '#666' : '#ffcc00';
  };

  document.body.appendChild(btn);
}

// ── Bootstrap BGM on first user interaction (respects browser autoplay policy)
let _bootstrapped = false;
export function bootstrapOnInteraction() {
  if (_bootstrapped) return;
  _bootstrapped = true;
  const start = () => {
    _getCtx();
    if (!_muted) startBgm();
    document.removeEventListener('click', start, true);
    document.removeEventListener('keydown', start, true);
    document.removeEventListener('touchstart', start, true);
  };
  document.addEventListener('click',      start, { once: true, capture: true });
  document.addEventListener('keydown',    start, { once: true, capture: true });
  document.addEventListener('touchstart', start, { once: true, capture: true });
}
