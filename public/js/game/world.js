// ─────────────────────────────────────────────────────────────────────────────
// World / Arena delegate to arena.js
// ─────────────────────────────────────────────────────────────────────────────
import * as Arena from './arena.js';

export function initWorld(scene) {
  Arena.initArena(scene);
}

export function setWorldTheme(element) {
  Arena.setArenaTheme(element);
}

export function updateWorld(deltaTime) {
  Arena.updateArena(deltaTime);
}

export { Arena };
