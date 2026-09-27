/**
 * public/js/audio.js — NES Chiptune BGM + Web Audio SFX
 *
 * Procedurally synthesises all sounds — zero external assets.
 * NES accuracy: square-wave melody (pulse 12.5%), triangle bass, white-noise drum.
 *
 * BGM tracks:
 *   'lobby'   — upbeat title screen tune
 *   'thunder' — tense electric battle march
 *   'fire'    — blazing aggressive combat theme
 *   'frost'   — eerie, crystalline dungeon theme
 *   'victory' — classic win fanfare jingle (plays once, no loop)
 */

// ── Audio context singleton ──────────────────────────────────────────────────
let _ctx        = null;
let _masterGain = null;   // controls SFX + BGM together (mute target)
let _bgmGain    = null;   // controls BGM volume independently
let _sfxGain    = null;   // controls SFX volume independently
let _muted      = false;

// BGM state
let _currentTrack   = null;   // key of currently-playing track
let _bgmScheduleId  = null;   // setTimeout id for next loop
let _bgmStartAt     = 0;      // Web Audio clock time the current loop started

const BGM_VOLUME = 0.45;   // BGM channel level — keeps SFX crisp above it

// ── Context bootstrap ────────────────────────────────────────────────────────
function _getCtx() {
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
      _masterGain       = _ctx.createGain();
      _bgmGain          = _ctx.createGain();
      _sfxGain          = _ctx.createGain();
      _masterGain.gain.value = _muted ? 0 : 1;
      _bgmGain.gain.value    = BGM_VOLUME;
      _sfxGain.gain.value    = 1.0;
      _bgmGain.connect(_masterGain);
      _sfxGain.connect(_masterGain);
      _masterGain.connect(_ctx.destination);
    } catch (e) {
      console.warn('[audio] Web Audio unavailable:', e.message);
    }
  }
  if (_ctx?.state === 'suspended') _ctx.resume().catch(() => {});
  return _ctx;
}

function _now() { const ctx = _getCtx(); return ctx ? ctx.currentTime : 0; }

// ── Low-level helpers ────────────────────────────────────────────────────────
function _oscSFX(type, freq, s, e, g0 = 0.35, g1 = 0) {
  const ctx = _getCtx(); if (!ctx) return;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, s);
  gain.gain.setValueAtTime(g0, s);
  gain.gain.linearRampToValueAtTime(g1, e);
  osc.connect(gain); gain.connect(_sfxGain);
  osc.start(s); osc.stop(e + 0.01);
}

function _noiseSFX(s, dur, gainPeak = 0.3, filterHz = 2000) {
  const ctx = _getCtx(); if (!ctx) return;
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

// NES-style square wave for BGM (approximated with 'square' oscillator)
function _bgmNote(freq, s, dur, vol = 0.7, type = 'square') {
  const ctx = _getCtx(); if (!ctx || !_bgmGain) return;
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, s);
  gain.gain.setValueAtTime(vol, s);
  gain.gain.setValueAtTime(vol, s + dur * 0.85);
  gain.gain.linearRampToValueAtTime(0, s + dur);
  osc.connect(gain); gain.connect(_bgmGain);
  osc.start(s); osc.stop(s + dur + 0.01);
}

function _bgmNoise(s, dur, vol = 0.3, filterHz = 800) {
  const ctx = _getCtx(); if (!ctx || !_bgmGain) return;
  const len  = Math.ceil(ctx.sampleRate * dur);
  const buf  = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src    = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain   = ctx.createGain();
  src.buffer   = buf;
  filter.type  = 'highpass';
  filter.frequency.value = filterHz;
  gain.gain.setValueAtTime(vol, s);
  gain.gain.linearRampToValueAtTime(0, s + dur);
  src.connect(filter); filter.connect(gain); gain.connect(_bgmGain);
  src.start(s); src.stop(s + dur + 0.01);
}

// ═══════════════════════════════════════════════════════════════════════════════
// NES CHIPTUNE TRACK DEFINITIONS
// Each track returns: { scheduleLoop(startAt) → loopDuration }
// ═══════════════════════════════════════════════════════════════════════════════

// Musical helper
const NOTE = {
  C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.0, A3:220.0, B3:246.94,
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.0, A4:440.0, B4:493.88,
  C5:523.25, D5:587.33, E5:659.26, F5:698.46, G5:783.99, A5:880.0, B5:987.77,
  C6:1046.5, D6:1174.7, E6:1318.5, Bb4:466.16, Bb3:233.08,
  Ab4:415.30, Ab3:207.65, Eb4:311.13, Eb5:622.25,
};
const R = 0; // rest

/** ── LOBBY BGM: Cheerful 8-bit title theme ───────────────────────────────── */
function _trackLobby(startAt) {
  // 120 BPM, 16th-note = 0.125s
  const q = 0.25, e = 0.125, h = 0.5;
  let t = startAt;

  // 4-bar melody (square, channel 1)
  const mel = [
    NOTE.E5,e,  NOTE.E5,e,  NOTE.E5,e,  R,e,
    NOTE.E5,e,  NOTE.E5,e,  NOTE.G5,e,  NOTE.C5,e,
    NOTE.D5,e,  NOTE.E5,h,  R,e,        R,e,
    NOTE.F5,e,  NOTE.F5,e,  NOTE.F5,e,  NOTE.F5,e,
    NOTE.F5,e,  NOTE.E5,e,  NOTE.E5,e,  NOTE.E5,e,
    NOTE.E5,e,  NOTE.D5,e,  NOTE.D5,e,  NOTE.E5,e,
    NOTE.D5,h,  NOTE.G5,h,
    // bar 3
    NOTE.E5,e,  NOTE.E5,e,  NOTE.E5,e,  R,e,
    NOTE.E5,e,  NOTE.E5,e,  NOTE.G5,e,  NOTE.C5,e,
    NOTE.D5,e,  NOTE.E5,h,  R,e,        R,e,
    NOTE.F5,e,  NOTE.F5,e,  NOTE.F5,e,  NOTE.F5,e,
    NOTE.F5,e,  NOTE.E5,e,  NOTE.E5,e,  NOTE.G5,e,
    NOTE.G5,e,  NOTE.G5,e,  NOTE.A5,q,  NOTE.G5,h,
  ];
  for (let i = 0; i < mel.length; i += 2) {
    const f = mel[i], d = mel[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.88, 0.55, 'square');
    t += d;
  }
  const loopDur = t - startAt;

  // Harmony (pulse, channel 2) — thirds below
  t = startAt;
  const har = [
    NOTE.C5,e,  NOTE.C5,e,  NOTE.C5,e,  R,e,
    NOTE.C5,e,  NOTE.C5,e,  NOTE.E5,e,  NOTE.A4,e,
    NOTE.B4,e,  NOTE.C5,h,  R,e,        R,e,
    NOTE.A4,e,  NOTE.A4,e,  NOTE.A4,e,  NOTE.A4,e,
    NOTE.A4,e,  NOTE.G4,e,  NOTE.G4,e,  NOTE.G4,e,
    NOTE.G4,e,  NOTE.F4,e,  NOTE.F4,e,  NOTE.G4,e,
    NOTE.G4,h,  NOTE.B4,h,
    NOTE.C5,e,  NOTE.C5,e,  NOTE.C5,e,  R,e,
    NOTE.C5,e,  NOTE.C5,e,  NOTE.E5,e,  NOTE.A4,e,
    NOTE.B4,e,  NOTE.C5,h,  R,e,        R,e,
    NOTE.A4,e,  NOTE.A4,e,  NOTE.A4,e,  NOTE.A4,e,
    NOTE.A4,e,  NOTE.G4,e,  NOTE.G4,e,  NOTE.B4,e,
    NOTE.B4,e,  NOTE.B4,e,  NOTE.C5,q,  NOTE.E5,h,
  ];
  for (let i = 0; i < har.length; i += 2) {
    const f = har[i], d = har[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.75, 0.30, 'square');
    t += d;
  }

  // Triangle bass
  t = startAt;
  const bass = [
    NOTE.C3,q, NOTE.C3,q, NOTE.C3,q, NOTE.C3,q,
    NOTE.G3,q, NOTE.G3,q, NOTE.G3,q, NOTE.G3,q,
    NOTE.A3,q, NOTE.A3,q, NOTE.A3,q, NOTE.A3,q,
    NOTE.F3,q, NOTE.F3,q, NOTE.G3,q, NOTE.G3,q,
    NOTE.C3,q, NOTE.C3,q, NOTE.C3,q, NOTE.C3,q,
    NOTE.G3,q, NOTE.G3,q, NOTE.G3,q, NOTE.G3,q,
    NOTE.A3,q, NOTE.A3,q, NOTE.F3,q, NOTE.G3,q,
  ];
  for (let i = 0; i < bass.length; i += 2) {
    const f = bass[i], d = bass[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.95, 0.55, 'triangle');
    t += d;
  }

  // Noise hi-hat + kick
  for (let i = 0; i < Math.ceil(loopDur / e); i++) {
    const s = startAt + i * e;
    if (i % 8 === 0) _bgmNoise(s, 0.05, 0.35, 200);   // kick
    else _bgmNoise(s, 0.04, 0.10, 3000);                // hi-hat
  }

  return loopDur;
}

/** ── THUNDER BGM: Tense electric battle march ────────────────────────────── */
function _trackThunder(startAt) {
  const e = 0.125, q = 0.25, h = 0.5;
  let t = startAt;

  // Aggressive descending arpeggio melody
  const mel = [
    NOTE.A5,e, NOTE.G5,e, NOTE.E5,e, NOTE.C5,e,
    NOTE.A4,e, NOTE.B4,e, NOTE.C5,e, NOTE.D5,e,
    NOTE.E5,q, NOTE.E5,e, NOTE.G5,e, NOTE.F5,e, NOTE.E5,e,
    NOTE.D5,q, NOTE.D5,q,
    NOTE.A5,e, NOTE.G5,e, NOTE.E5,e, NOTE.C5,e,
    NOTE.A4,e, NOTE.B4,e, NOTE.D5,e, NOTE.E5,e,
    NOTE.F5,e, NOTE.G5,e, NOTE.A5,e, NOTE.G5,e,
    NOTE.E5,h,
    // repeat
    NOTE.G5,e, NOTE.F5,e, NOTE.Eb5,e, NOTE.C5,e,
    NOTE.Bb4,e, NOTE.C5,e, NOTE.D5,e, NOTE.Eb5,e,
    NOTE.F5,q, NOTE.F5,e, NOTE.Ab4,e, NOTE.G4,e, NOTE.F4,e,
    NOTE.Eb4,q,NOTE.Eb4,q,
    NOTE.G5,e, NOTE.F5,e, NOTE.Eb5,e, NOTE.C5,e,
    NOTE.Bb4,e,NOTE.C5,e, NOTE.Eb5,e, NOTE.F5,e,
    NOTE.G5,e, NOTE.Ab4,e,NOTE.Bb4,e, NOTE.G5,e,
    NOTE.C5,h,
  ];
  for (let i = 0; i < mel.length; i += 2) {
    const f = mel[i], d = mel[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.8, 0.65, 'square');
    t += d;
  }
  const loopDur = t - startAt;

  // Harmony — power-chord style
  t = startAt;
  const har = [
    NOTE.E5,e, NOTE.D5,e, NOTE.B4,e, NOTE.G4,e,
    NOTE.E4,e, NOTE.F4,e, NOTE.G4,e, NOTE.A4,e,
    NOTE.B4,q, NOTE.B4,e, NOTE.D5,e, NOTE.C5,e, NOTE.B4,e,
    NOTE.A4,q, NOTE.A4,q,
    NOTE.E5,e, NOTE.D5,e, NOTE.B4,e, NOTE.G4,e,
    NOTE.E4,e, NOTE.F4,e, NOTE.A4,e, NOTE.B4,e,
    NOTE.C5,e, NOTE.D5,e, NOTE.E5,e, NOTE.D5,e,
    NOTE.B4,h,
    NOTE.D5,e, NOTE.C5,e, NOTE.Bb4,e,NOTE.G4,e,
    NOTE.F4,e, NOTE.G4,e, NOTE.A4,e, NOTE.Bb4,e,
    NOTE.C5,q, NOTE.C5,e, NOTE.Eb4,e,NOTE.D4,e, NOTE.C4,e,
    NOTE.Bb3,q,NOTE.Bb3,q,
    NOTE.D5,e, NOTE.C5,e, NOTE.Bb4,e,NOTE.G4,e,
    NOTE.F4,e, NOTE.G4,e, NOTE.Bb4,e,NOTE.C5,e,
    NOTE.D5,e, NOTE.Eb4,e,NOTE.F4,e, NOTE.D5,e,
    NOTE.G4,h,
  ];
  for (let i = 0; i < har.length; i += 2) {
    const f = har[i], d = har[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.7, 0.35, 'square');
    t += d;
  }

  // Triangle bass — stomping quarter notes
  t = startAt;
  const bass = [
    NOTE.A3,q, NOTE.A3,q, NOTE.A3,q, NOTE.G3,q,
    NOTE.E3,q, NOTE.F3,q, NOTE.G3,q, NOTE.A3,q,
    NOTE.A3,q, NOTE.A3,q, NOTE.G3,q, NOTE.E3,q,
    NOTE.D3,q, NOTE.D3,q, NOTE.E3,q, NOTE.D3,q,
    NOTE.A3,q, NOTE.A3,q, NOTE.A3,q, NOTE.G3,q,
    NOTE.E3,q, NOTE.F3,q, NOTE.A3,q, NOTE.B3,q,
    NOTE.C4,q, NOTE.Ab3,q,NOTE.Bb3,q,NOTE.A3,q,
    NOTE.E3,q, NOTE.E3,q, NOTE.E3,q, NOTE.E3,q,
  ];
  for (let i = 0; i < bass.length; i += 2) {
    const f = bass[i], d = bass[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.9, 0.60, 'triangle');
    t += d;
  }

  // Aggressive kick every beat + snare on 2&4
  for (let i = 0; i < Math.ceil(loopDur / q); i++) {
    const s = startAt + i * q;
    _bgmNoise(s, 0.06, 0.50, 150);          // kick
    if (i % 2 === 1) _bgmNoise(s, 0.06, 0.40, 4000);  // snare
  }

  return loopDur;
}

/** ── FIRE BGM: Blazing aggressive fast-tempo combat ─────────────────────── */
function _trackFire(startAt) {
  const s16 = 0.09375, e = 0.125, q = 0.25;
  let t = startAt;

  // Fast, frantic ascending theme
  const mel = [
    NOTE.C5,e,  NOTE.E5,e,  NOTE.G5,e,  NOTE.A5,e,
    NOTE.G5,e,  NOTE.E5,e,  NOTE.C5,e,  NOTE.B4,e,
    NOTE.C5,e,  NOTE.G5,e,  NOTE.E5,e,  NOTE.G5,e,
    NOTE.A5,e,  NOTE.G5,e,  NOTE.F5,e,  NOTE.E5,e,
    NOTE.D5,e,  NOTE.F5,e,  NOTE.A5,e,  NOTE.C6,e,
    NOTE.Bb4,e, NOTE.A4,e,  NOTE.G4,e,  NOTE.F4,e,
    NOTE.E4,e,  NOTE.G4,e,  NOTE.B4,e,  NOTE.D5,e,
    NOTE.C5,q,  NOTE.C5,q,
    // phrase 2
    NOTE.E5,e,  NOTE.G5,e,  NOTE.B5,e,  NOTE.D6,e,
    NOTE.C6,e,  NOTE.B5,e,  NOTE.A5,e,  NOTE.G5,e,
    NOTE.F5,e,  NOTE.A5,e,  NOTE.C6,e,  NOTE.A5,e,
    NOTE.G5,e,  NOTE.F5,e,  NOTE.E5,e,  NOTE.D5,e,
    NOTE.C5,e,  NOTE.E5,e,  NOTE.G5,e,  NOTE.B5,e,
    NOTE.A5,e,  NOTE.G5,e,  NOTE.F5,e,  NOTE.E5,e,
    NOTE.D5,e,  NOTE.C5,e,  NOTE.B4,e,  NOTE.A4,e,
    NOTE.G4,q,  NOTE.G4,q,
  ];
  for (let i = 0; i < mel.length; i += 2) {
    const f = mel[i], d = mel[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.75, 0.70, 'square');
    t += d;
  }
  const loopDur = t - startAt;

  // Bass pulse — on every beat
  t = startAt;
  const bass = [
    NOTE.C3,q, NOTE.C3,q, NOTE.C3,q, NOTE.C3,q,
    NOTE.G3,q, NOTE.G3,q, NOTE.A3,q, NOTE.G3,q,
    NOTE.F3,q, NOTE.F3,q, NOTE.F3,q, NOTE.F3,q,
    NOTE.G3,q, NOTE.G3,q, NOTE.E3,q, NOTE.G3,q,
    NOTE.C3,q, NOTE.C3,q, NOTE.C3,q, NOTE.C3,q,
    NOTE.G3,q, NOTE.G3,q, NOTE.A3,q, NOTE.G3,q,
    NOTE.F3,q, NOTE.F3,q, NOTE.G3,q, NOTE.G3,q,
    NOTE.C3,q, NOTE.C3,q, NOTE.C3,q, NOTE.C3,q,
  ];
  for (let i = 0; i < bass.length; i += 2) {
    const f = bass[i], d = bass[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.85, 0.65, 'triangle');
    t += d;
  }

  // Fast hi-hat every 16th, kick on 1&3
  for (let i = 0; i < Math.ceil(loopDur / s16); i++) {
    const ts = startAt + i * s16;
    _bgmNoise(ts, 0.035, 0.12, 4000);           // hi-hat
    if (i % 8 === 0) _bgmNoise(ts, 0.07, 0.55, 120);  // kick
    if (i % 8 === 4) _bgmNoise(ts, 0.06, 0.40, 5000); // snare
  }

  return loopDur;
}

/** ── FROST BGM: Eerie slow crystalline dungeon theme ──────────────────────── */
function _trackFrost(startAt) {
  const e = 0.15, q = 0.30, h = 0.60, dq = 0.45;
  let t = startAt;

  // Slow, haunting descending melody
  const mel = [
    NOTE.A5,dq,  NOTE.G5,e,   NOTE.F5,h,
    NOTE.E5,q,   NOTE.Eb5,q,  NOTE.D5,q,   NOTE.C5,q,
    NOTE.B4,dq,  NOTE.A4,e,   NOTE.G4,h,
    NOTE.F4,q,   NOTE.G4,q,   NOTE.A4,q,   NOTE.B4,q,
    NOTE.C5,dq,  NOTE.D5,e,   NOTE.Eb5,h,
    NOTE.F5,q,   NOTE.G5,q,   NOTE.Ab4,q,  NOTE.Bb4,q,
    NOTE.C5,h,   NOTE.B4,q,   NOTE.A4,q,
    NOTE.G4,h,   NOTE.F4,h,
  ];
  for (let i = 0; i < mel.length; i += 2) {
    const f = mel[i], d = mel[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.9, 0.55, 'square');
    t += d;
  }
  const loopDur = t - startAt;

  // Harmony — parallel 5ths
  t = startAt;
  const har = [
    NOTE.E5,dq,  NOTE.D5,e,   NOTE.C5,h,
    NOTE.B4,q,   NOTE.Bb4,q,  NOTE.A4,q,   NOTE.G4,q,
    NOTE.F4,dq,  NOTE.E4,e,   NOTE.D4,h,
    NOTE.C4,q,   NOTE.D4,q,   NOTE.E4,q,   NOTE.F4,q,
    NOTE.G4,dq,  NOTE.A4,e,   NOTE.Bb4,h,
    NOTE.C5,q,   NOTE.D5,q,   NOTE.Eb4,q,  NOTE.F4,q,
    NOTE.G4,h,   NOTE.F4,q,   NOTE.E4,q,
    NOTE.D4,h,   NOTE.C4,h,
  ];
  for (let i = 0; i < har.length; i += 2) {
    const f = har[i], d = har[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.85, 0.28, 'square');
    t += d;
  }

  // Slow triangle bass
  t = startAt;
  const bass = [
    NOTE.A3,h,  NOTE.A3,h,
    NOTE.E3,h,  NOTE.E3,h,
    NOTE.G3,h,  NOTE.G3,h,
    NOTE.F3,h,  NOTE.G3,h,
    NOTE.A3,h,  NOTE.Ab3,h,
    NOTE.F3,h,  NOTE.Bb3,h,
    NOTE.C4,h,  NOTE.B3,h,
    NOTE.A3,h,  NOTE.F3,h,
  ];
  for (let i = 0; i < bass.length; i += 2) {
    const f = bass[i], d = bass[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.95, 0.65, 'triangle');
    t += d;
  }

  // Sparse ice-crystal noise hits
  for (let i = 0; i < 8; i++) {
    const ts = startAt + i * (loopDur / 8);
    _bgmNoise(ts, 0.04, 0.18, 6000);     // ice sparkle
    _bgmNoise(ts + h, 0.06, 0.25, 200);  // deep thud
  }

  return loopDur;
}

/** ── VICTORY BGM: Classic win fanfare (plays once) ────────────────────────── */
function _trackVictory(startAt) {
  const e = 0.12, q = 0.24, h = 0.48, dq = 0.36;
  let t = startAt;

  // Triumphant rising fanfare
  const mel = [
    NOTE.C5,e,  NOTE.C5,e,  NOTE.C5,e,  NOTE.C5,q, NOTE.G4,e,
    NOTE.A4,q,  NOTE.C5,e,  NOTE.A4,e,  NOTE.C5,h,
    NOTE.D5,e,  NOTE.D5,e,  NOTE.D5,e,  NOTE.D5,q, NOTE.B4,e,
    NOTE.C5,q,  NOTE.D5,e,  NOTE.C5,e,  NOTE.D5,h,
    NOTE.E5,e,  NOTE.E5,e,  NOTE.E5,e,  NOTE.E5,q, NOTE.C5,e,
    NOTE.D5,q,  NOTE.E5,e,  NOTE.D5,e,  NOTE.E5,h,
    NOTE.G5,e,  NOTE.G5,e,  NOTE.A5,e,  NOTE.G5,e,
    NOTE.F5,e,  NOTE.E5,e,  NOTE.D5,e,  NOTE.C5,e,
    NOTE.C5,dq, NOTE.E5,e,  NOTE.G5,q,
    NOTE.C6,h,  NOTE.G5,q,  NOTE.C6,h,
  ];
  for (let i = 0; i < mel.length; i += 2) {
    const f = mel[i], d = mel[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.88, 0.65, 'square');
    t += d;
  }
  const loopDur = t - startAt;

  // Harmonics
  t = startAt;
  const har = [
    NOTE.E4,e,  NOTE.E4,e,  NOTE.E4,e,  NOTE.E4,q, NOTE.C4,e,
    NOTE.F4,q,  NOTE.A4,e,  NOTE.F4,e,  NOTE.G4,h,
    NOTE.G4,e,  NOTE.G4,e,  NOTE.G4,e,  NOTE.G4,q, NOTE.F4,e,
    NOTE.E4,q,  NOTE.G4,e,  NOTE.E4,e,  NOTE.G4,h,
    NOTE.G4,e,  NOTE.G4,e,  NOTE.G4,e,  NOTE.G4,q, NOTE.E4,e,
    NOTE.G4,q,  NOTE.G4,e,  NOTE.F4,e,  NOTE.G4,h,
    NOTE.B4,e,  NOTE.B4,e,  NOTE.C5,e,  NOTE.B4,e,
    NOTE.A4,e,  NOTE.G4,e,  NOTE.F4,e,  NOTE.E4,e,
    NOTE.E4,dq, NOTE.G4,e,  NOTE.B4,q,
    NOTE.C5,h,  NOTE.B4,q,  NOTE.C5,h,
  ];
  for (let i = 0; i < har.length; i += 2) {
    const f = har[i], d = har[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.85, 0.35, 'square');
    t += d;
  }

  // Bass
  t = startAt;
  const bass = [
    NOTE.C3,q,NOTE.C3,q, NOTE.F3,q,NOTE.C3,q,
    NOTE.G3,q,NOTE.G3,q, NOTE.C3,q,NOTE.G3,q,
    NOTE.G3,q,NOTE.G3,q, NOTE.C4,q,NOTE.G3,q,
    NOTE.E3,q,NOTE.E3,q, NOTE.G3,q,NOTE.E3,q,
    NOTE.C3,q,NOTE.C3,q, NOTE.G3,q,NOTE.C3,q,
    NOTE.F3,q,NOTE.G3,q, NOTE.C4,q,NOTE.C4,q,
    NOTE.C3,q,NOTE.C3,q,
  ];
  for (let i = 0; i < bass.length; i += 2) {
    const f = bass[i], d = bass[i+1];
    if (f !== R) _bgmNote(f, t, d * 0.95, 0.65, 'triangle');
    t += d;
  }

  // Drum fills
  for (let i = 0; i < Math.ceil(loopDur / q); i++) {
    const ts = startAt + i * q;
    if (i % 4 === 0) _bgmNoise(ts, 0.06, 0.45, 150);
    if (i % 4 === 2) _bgmNoise(ts, 0.06, 0.35, 5000);
    _bgmNoise(ts + q * 0.5, 0.03, 0.12, 4000);
  }

  return loopDur;  // caller uses this but won't re-schedule (no loop)
}

// ── Track registry ───────────────────────────────────────────────────────────
const TRACK_FNS = {
  lobby:   _trackLobby,
  thunder: _trackThunder,
  fire:    _trackFire,
  frost:   _trackFrost,
  victory: _trackVictory,
};

// ═══════════════════════════════════════════════════════════════════════════════
// BGM PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════════

/** Stop whatever BGM is playing, fade out quickly. */
export function stopBGM() {
  _currentTrack = null;
  clearTimeout(_bgmScheduleId);
  // Fade out master BGM gain briefly
  const ctx = _getCtx();
  if (ctx && _bgmGain) {
    _bgmGain.gain.cancelScheduledValues(ctx.currentTime);
    _bgmGain.gain.setValueAtTime(_bgmGain.gain.value, ctx.currentTime);
    _bgmGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
    setTimeout(() => {
      if (_bgmGain && _currentTrack === null) {
        _bgmGain.gain.setValueAtTime(BGM_VOLUME, ctx.currentTime);
      }
    }, 400);
  }
}

/**
 * Play a BGM track. Crossfades from whatever is currently playing.
 * @param {'lobby'|'thunder'|'fire'|'frost'|'victory'} trackKey
 */
export function playBGM(trackKey) {
  const fn = TRACK_FNS[trackKey];
  if (!fn) return;
  if (_currentTrack === trackKey) return;   // already playing

  const ctx = _getCtx();
  if (!ctx) {
    // Not yet unlocked — queue for first interaction
    _pendingBgmKey = trackKey;
    return;
  }
  if (_muted) {
    _currentTrack = trackKey;  // remember so unmute can start it
    return;
  }

  // Stop current track
  clearTimeout(_bgmScheduleId);
  const isVictory = (trackKey === 'victory');

  // Fade out, then start new track
  if (_bgmGain) {
    _bgmGain.gain.cancelScheduledValues(ctx.currentTime);
    _bgmGain.gain.setValueAtTime(_bgmGain.gain.value, ctx.currentTime);
    _bgmGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
  }

  setTimeout(() => {
    if (_currentTrack !== trackKey && trackKey !== _currentTrack) {
      // Already switched again, abort
    }
    _currentTrack = trackKey;
    if (!_bgmGain) return;
    _bgmGain.gain.cancelScheduledValues(ctx.currentTime);
    _bgmGain.gain.setValueAtTime(0, ctx.currentTime);
    _bgmGain.gain.linearRampToValueAtTime(BGM_VOLUME, ctx.currentTime + 0.35);

    const _loop = (at) => {
      if (_currentTrack !== trackKey) return;  // track changed, stop
      const dur = fn(at);
      if (!isVictory) {
        const msUntilNext = Math.max(50, (at + dur - ctx.currentTime - 0.08) * 1000);
        _bgmScheduleId = setTimeout(() => _loop(at + dur), msUntilNext);
      }
    };
    _loop(ctx.currentTime + 0.1);
  }, 280);
}

let _pendingBgmKey = null;

// ── Legacy compat: startBgm / stopBgm ───────────────────────────────────────
export function startBgm() { playBGM('lobby'); }
export function stopBgm()  { stopBGM(); }

// ═══════════════════════════════════════════════════════════════════════════════
// SFX PUBLIC API (unchanged from previous session)
// ═══════════════════════════════════════════════════════════════════════════════

export function playCorrect() {
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  _oscSFX('sine', 523.25, t,       t + 0.12, 0.35, 0.0);
  _oscSFX('sine', 659.26, t + 0.1, t + 0.28, 0.35, 0.0);
  _oscSFX('sine', 783.99, t + 0.2, t + 0.48, 0.35, 0.0);
  _oscSFX('triangle', 1046.5, t + 0.18, t + 0.5, 0.15, 0.0);
}

export function playWrong() {
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  _oscSFX('sawtooth', 110, t,       t + 0.12, 0.3, 0.0);
  _oscSFX('sawtooth', 104, t + 0.1, t + 0.3,  0.3, 0.0);
  _oscSFX('square',    80, t,       t + 0.35, 0.15, 0.0);
  _noiseSFX(t, 0.25, 0.1, 300);
}

export function playSlash() {
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  _noiseSFX(t, 0.18, 0.25, 4000);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(400, t + 0.14);
  osc.frequency.exponentialRampToValueAtTime(60, t + 0.32);
  gain.gain.setValueAtTime(0.4, t + 0.14);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
  osc.connect(gain); gain.connect(_sfxGain);
  osc.start(t + 0.14); osc.stop(t + 0.33);
}

export function playThunder() {
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  _noiseSFX(t, 0.08, 0.5, 8000);
  _noiseSFX(t + 0.06, 0.7, 0.4, 200);
  _oscSFX('square', 60,   t,        t + 0.5,  0.3, 0.0);
  _oscSFX('square', 120,  t + 0.05, t + 0.45, 0.2, 0.0);
  _oscSFX('sine',   2000, t,        t + 0.1,  0.3, 0.0);
  _oscSFX('sine',   1200, t + 0.08, t + 0.2,  0.2, 0.0);
}

export function playFire() {
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  _noiseSFX(t, 0.12, 0.55, 500);
  for (let i = 0; i < 4; i++) _noiseSFX(t + i * 0.06, 0.05, 0.2 - i * 0.03, 1200 + i * 400);
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
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  _oscSFX('sine',     1800, t,        t + 0.08, 0.35, 0.0);
  _oscSFX('triangle', 2400, t + 0.04, t + 0.14, 0.25, 0.0);
  _oscSFX('sine',     3200, t + 0.08, t + 0.2,  0.15, 0.0);
  for (let i = 0; i < 5; i++) {
    const f = 1600 + Math.random() * 2400;
    _oscSFX('sine', f, t + 0.1 + i * 0.04, t + 0.28 + i * 0.04, 0.12, 0.0);
  }
  _noiseSFX(t, 0.12, 0.2, 6000);
}

export function playVictory() {
  // SFX stinger — short ascending chime (separate from BGM track)
  const ctx = _getCtx(); if (!ctx) return;
  const t = _now();
  const notes = [261.63, 329.63, 392.0, 523.25, 659.26, 783.99, 1046.5];
  notes.forEach((freq, i) => {
    const s = t + i * 0.13;
    _oscSFX('sine', freq, s, s + 0.22, 0.4, 0.0);
    _oscSFX('triangle', freq * 2, s, s + 0.15, 0.1, 0.0);
  });
  const end = t + notes.length * 0.13;
  [523.25, 659.26, 783.99].forEach(f => _oscSFX('sine', f, end, end + 0.8, 0.3, 0.0));
  _noiseSFX(end, 0.3, 0.1, 4000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mute / Unmute
// ═══════════════════════════════════════════════════════════════════════════════

export function setMuted(mute) {
  _muted = mute;
  const ctx = _getCtx();
  if (!ctx || !_masterGain) return;
  _masterGain.gain.cancelScheduledValues(ctx.currentTime);
  _masterGain.gain.setValueAtTime(mute ? 0 : 1, ctx.currentTime);
  if (!mute && _currentTrack) {
    // Restore BGM gain and resume current track
    if (_bgmGain) {
      _bgmGain.gain.cancelScheduledValues(ctx.currentTime);
      _bgmGain.gain.setValueAtTime(BGM_VOLUME, ctx.currentTime);
    }
  }
}

export function isMuted() { return _muted; }

export function toggleMute() {
  setMuted(!_muted);
  return _muted;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Audio Toggle Button (🎵 BGM: Bật / 🔇 BGM: Tắt) — top right
// ═══════════════════════════════════════════════════════════════════════════════

export function mountAudioToggle() {
  if (document.getElementById('audio-toggle-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'audio-toggle-btn';
  btn.title = 'Bật/Tắt nhạc nền';
  btn.innerHTML = '🎵 <span>BGM: Bật</span>';
  btn.style.cssText = `
    position: fixed;
    top: 10px; right: 12px;
    z-index: 9100;
    background: rgba(10,8,28,0.88);
    border: 1.5px solid #ffcc00;
    border-radius: 20px;
    padding: 4px 12px;
    font-size: 13px;
    cursor: pointer;
    color: #ffcc00;
    font-family: 'Be Vietnam Pro', sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    line-height: 1.5;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 4px;
  `;

  const label = btn.querySelector('span');

  btn.onclick = () => {
    _getCtx();   // ensure context is created on first interaction
    const nowMuted = toggleMute();
    if (nowMuted) {
      btn.innerHTML = '🔇 <span>BGM: Tắt</span>';
    } else {
      btn.innerHTML = '🎵 <span>BGM: Bật</span>';
      // Resume current track from the top
      if (_currentTrack) {
        const key = _currentTrack;
        _currentTrack = null;    // force re-trigger
        playBGM(key);
      }
    }
    const sp = btn.querySelector('span');
    const onColor  = '#ffcc00';
    const offColor = '#666';
    btn.style.borderColor = nowMuted ? offColor : onColor;
    btn.style.color       = nowMuted ? offColor : onColor;
  };

  document.body.appendChild(btn);
}

// ── Bootstrap BGM on first user interaction ──────────────────────────────────
let _bootstrapped = false;
export function bootstrapOnInteraction() {
  if (_bootstrapped) return;
  _bootstrapped = true;

  const start = () => {
    _getCtx();
    // Play pending track (set by playBGM before context was ready)
    if (_pendingBgmKey && !_muted) {
      const key = _pendingBgmKey;
      _pendingBgmKey = null;
      playBGM(key);
    }
  };
  document.addEventListener('click',      start, { once: true, capture: true });
  document.addEventListener('keydown',    start, { once: true, capture: true });
  document.addEventListener('touchstart', start, { once: true, capture: true });
}
