/**
 * public/js/audio.js — BGM (static MP3 files) + SFX (Web Audio API)
 *
 * BGM: A single <Audio> instance plays the .mp3 files from public/Audio/Bgm/.
 *      Switching tracks fades out the old one before starting the new one.
 *      Volume is kept at 0.4 so SFX cuts clearly above it.
 *
 * SFX: Procedural Web Audio API — zero external files, instant.
 */

// ── BGM: static MP3 tracks ─────────────────────────────────────────────────
// Paths match the exact on-disk casing committed to git (Linux-safe)
const BGM_TRACKS = {
  lobby:   '/Audio/Bgm/Lobby.mp3',
  thunder: '/Audio/Bgm/thunder.mp3',
  fire:    '/Audio/Bgm/fire.mp3',
  frost:   '/Audio/Bgm/frost.mp3',
  victory: '/Audio/Bgm/victory.mp3',
};

const BGM_VOLUME  = 0.4;
const FADE_MS     = 350;   // crossfade duration in ms

let _bgmAudio     = null;     // the ONE global Audio element for BGM
let _bgmTrack     = null;     // key of currently-playing track
let _bgmMuted     = false;
let _fadeTimer    = null;

/** Stop BGM with a quick fade-out. */
export function stopBGM() {
  if (!_bgmAudio) return;
  _bgmTrack = null;
  clearInterval(_fadeTimer);
  const audio = _bgmAudio;
  const step  = BGM_VOLUME / (FADE_MS / 30);
  _fadeTimer = setInterval(() => {
    if (audio.volume > step) {
      audio.volume -= step;
    } else {
      audio.pause();
      audio.volume = BGM_VOLUME;
      clearInterval(_fadeTimer);
    }
  }, 30);
}

/** Play a BGM track, crossfading from the current one. */
export function playBGM(trackKey) {
  const src = BGM_TRACKS[trackKey];
  if (!src) return;

  // Already playing this track — don't restart
  if (_bgmTrack === trackKey && _bgmAudio && !_bgmAudio.paused) return;

  // Create the element once
  if (!_bgmAudio) {
    _bgmAudio = new window.Audio();
    _bgmAudio.addEventListener('ended', () => {
      // Only re-loop non-victory tracks (belt-and-suspenders — loop attr handles it normally)
      if (_bgmTrack && _bgmTrack !== 'victory') {
        _bgmAudio.currentTime = 0;
        _bgmAudio.play().catch(() => {});
      }
    });
  }

  const fullSrc = window.location.origin + src;

  // Helper: actually start the new track
  const _start = () => {
    clearInterval(_fadeTimer);
    _bgmTrack = trackKey;
    if (_bgmAudio.src !== fullSrc) {
      _bgmAudio.src = fullSrc;
    }
    _bgmAudio.loop   = (trackKey !== 'victory');
    _bgmAudio.volume = _bgmMuted ? 0 : BGM_VOLUME;
    _bgmAudio.currentTime = 0;
    _bgmAudio.play().catch(e => {
      // Browser blocked autoplay — queue for next interaction
      console.log('[audio] BGM autoplay deferred:', e.message);
      _pendingTrack = trackKey;
    });
  };

  // If something is already playing, fade it out first
  if (!_bgmAudio.paused && _bgmAudio.src && _bgmAudio.src !== fullSrc) {
    clearInterval(_fadeTimer);
    const audio = _bgmAudio;
    const startVol = audio.volume;
    const step = (startVol || BGM_VOLUME) / (FADE_MS / 30);
    _fadeTimer = setInterval(() => {
      if (audio.volume > step) {
        audio.volume -= step;
      } else {
        audio.pause();
        audio.volume = BGM_VOLUME;
        clearInterval(_fadeTimer);
        _start();
      }
    }, 30);
  } else {
    _start();
  }
}

// ── Legacy compat aliases ──────────────────────────────────────────────────
export function startBgm() { /* no-op — BGM now driven by playBGM() */ }
export function stopBgm()  { stopBGM(); }

// Pending track for pre-interaction calls
let _pendingTrack = null;

// ── Mute / Unmute ──────────────────────────────────────────────────────────
export function setMuted(mute) {
  _bgmMuted = mute;
  if (_bgmAudio) _bgmAudio.volume = mute ? 0 : BGM_VOLUME;
}

export function isMuted() { return _bgmMuted; }

export function toggleMute() {
  setMuted(!_bgmMuted);
  // If unmuting and a track was pending, try to play it now
  if (!_bgmMuted && _pendingTrack) {
    const key = _pendingTrack;
    _pendingTrack = null;
    _bgmTrack = null;   // force re-start
    playBGM(key);
  }
  return _bgmMuted;
}

// ═══════════════════════════════════════════════════════════════════════════
// Audio Toggle Button
// ═══════════════════════════════════════════════════════════════════════════

export function mountAudioToggle() {
  if (document.getElementById('audio-toggle-btn')) return;

  // Create the shared top-right bar (user badge will also append into this)
  let bar = document.querySelector('.top-user-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'top-user-bar';
    bar.style.cssText = `
      position: fixed;
      top: 10px; right: 12px;
      z-index: 9100;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    document.body.appendChild(bar);
  }

  const btn = document.createElement('button');
  btn.id    = 'audio-toggle-btn';
  btn.title = 'Bật/Tắt nhạc nền';
  btn.textContent = '🔊';
  btn.style.cssText = `
    width: 32px; height: 32px;
    border-radius: 50%;
    cursor: pointer;
    background: rgba(255,255,255,0.15);
    border: 1.5px solid rgba(255,255,255,0.35);
    font-size: 15px;
    flex-shrink: 0;
    line-height: 1;
    padding: 0;
    color: #fff;
    transition: background 0.2s;
  `;

  btn.onclick = () => {
    if (_pendingTrack && _bgmAudio?.paused) {
      const key = _pendingTrack;
      _pendingTrack = null;
      _bgmTrack = null;
      playBGM(key);
      return;
    }
    const nowMuted = toggleMute();
    btn.textContent = nowMuted ? '🔇' : '🔊';
    btn.style.background = nowMuted
      ? 'rgba(100,0,0,0.4)'
      : 'rgba(255,255,255,0.15)';
  };

  bar.prepend(btn);
}

// ── Bootstrap on first interaction ─────────────────────────────────────────
let _bootstrapped = false;
export function bootstrapOnInteraction() {
  if (_bootstrapped) return;
  _bootstrapped = true;
  const tryPlay = () => {
    if (_pendingTrack && !_bgmMuted) {
      const key = _pendingTrack;
      _pendingTrack = null;
      _bgmTrack = null;
      playBGM(key);
    }
  };
  document.addEventListener('click',      tryPlay, { once: true, capture: true });
  document.addEventListener('keydown',    tryPlay, { once: true, capture: true });
  document.addEventListener('touchstart', tryPlay, { once: true, capture: true });
}

// ═══════════════════════════════════════════════════════════════════════════
// SFX — Web Audio API (unchanged, works perfectly)
// ═══════════════════════════════════════════════════════════════════════════

let _ctx        = null;
let _sfxGain    = null;
let _sfxMuted   = false;   // follows _bgmMuted (shared mute toggle)

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

function _now()  { const ctx = _getCtx(); return ctx ? ctx.currentTime : 0; }

function _osc(type, freq, s, e, g0 = 0.35, g1 = 0) {
  const ctx = _getCtx(); if (!ctx || _bgmMuted) return;
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
  const ctx = _getCtx(); if (!ctx || _bgmMuted) return;
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
  const ctx = _getCtx(); if (!ctx || _bgmMuted) return;
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
  const ctx = _getCtx(); if (!ctx || _bgmMuted) return;
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
  const t = _now();
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
