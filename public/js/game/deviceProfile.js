// public/js/game/deviceProfile.js — memory budget of the device
//
// iOS Safari gives a web page far less memory than Android or desktop browsers and
// simply reloads the page when the budget is exceeded. Some models are extremely
// dense (about 1.1 million triangles each: the four `player_default_*` poses and
// the three `boss_*_angry` poses, versus ~75,000 for the other outfits), and
// loading several of them at once is what kills the page on iPhones.
//
// On such devices only the idle pose of a dense outfit is loaded (the other poses
// fall back to it) and the dense boss pose is skipped.
// Test overrides: add ?lite=1 or ?lite=0 to the page address.

function detectLowMemoryDevice() {
  if (typeof navigator === 'undefined') return false;
  try {
    const forced = new URLSearchParams(window.location.search).get('lite');
    if (forced === '1') return true;
    if (forced === '0') return false;
  } catch (e) {}
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); // iPad in desktop mode
  const lowRam = typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 4;
  return isIOS || lowRam;
}

export const LOW_MEMORY_DEVICE = detectLowMemoryDevice();

// Outfits whose pose files are ~1.1 million triangles each
const DENSE_PLAYER_OUTFITS = ['default'];
// Boss poses that are ~1.1 million triangles for every element
const DENSE_BOSS_POSES = ['angry'];

const ALL_PLAYER_POSES = ['idle', 'dodge', 'slash', 'hit'];

/** Player pose files to load for an outfit on this device (idle is always first). */
export function playerPosesToLoad(outfit) {
  if (LOW_MEMORY_DEVICE && DENSE_PLAYER_OUTFITS.includes(outfit)) return ['idle'];
  return ALL_PLAYER_POSES;
}

/** Boss action poses to load in the background on this device. */
export function bossActionPosesToLoad() {
  const poses = ['angry', 'attack', 'hit'];
  return LOW_MEMORY_DEVICE ? poses.filter(p => !DENSE_BOSS_POSES.includes(p)) : poses;
}

/**
 * Run async loaders. Desktop / Android: all at once (fastest). Low-memory devices:
 * one after another, so the mesh decoders never run side by side.
 */
export async function loadPoses(poses, loadOne) {
  if (!LOW_MEMORY_DEVICE) {
    await Promise.all(poses.map(p => loadOne(p)));
    return;
  }
  for (const pose of poses) {
    await loadOne(pose);
  }
}
