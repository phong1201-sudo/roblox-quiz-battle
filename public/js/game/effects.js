import * as Audio from '../audio.js';

let particles = [];
let sceneRef, cameraRef;
let shakeTime = 0, shakeMagnitude = 0;
let camBasePos = null;

export function initEffects(scene, camera) {
  sceneRef   = scene;
  cameraRef  = camera;
  camBasePos = camera.position.clone();
}

// ── Confetti ──────────────────────────────────────────────────────────────────
export function celebrateCorrect(position) {
  if (!sceneRef) return;
  const pos = position ? new THREE.Vector3(position.x, position.y+1, position.z) : new THREE.Vector3(0,4,0);
  for (let i = 0; i < 28; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.2,0.2,0.2), new THREE.MeshBasicMaterial({color: Math.random()*0xffffff}));
    m.position.copy(pos);
    sceneRef.add(m);
    particles.push({ mesh:m, velocity:new THREE.Vector3((Math.random()-0.5)*10, Math.random()*12+4, (Math.random()-0.5)*4), life:1.6, maxLife:1.6 });
  }
}

// ── Hit spark ─────────────────────────────────────────────────────────────────
export function spawnHitSpark(position) {
  if (!sceneRef) return;
  const cols = [0xffffff, 0xffff00, 0xff8800, 0xff4400];
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.22,0.22,0.22), new THREE.MeshBasicMaterial({color: cols[Math.floor(Math.random()*cols.length)]}));
    m.position.copy(position);
    sceneRef.add(m);
    const angle = Math.random()*Math.PI*2, speed = 4+Math.random()*10;
    particles.push({ mesh:m, velocity:new THREE.Vector3(Math.cos(angle)*speed,(Math.random()-0.3)*speed,(Math.random()-0.5)*3), life:0.55, maxLife:0.55 });
  }
}

// ── Damage number ─────────────────────────────────────────────────────────────
export function spawnDamageNumber(worldPos, text, color, size) {
  if (!cameraRef) return;
  const sp = worldPos.clone().project(cameraRef);
  const sx = (sp.x*0.5+0.5)*window.innerWidth;
  const sy = (-sp.y*0.5+0.5)*window.innerHeight*0.75;
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:fixed;left:${sx}px;top:${sy}px;color:${color||'#fff'};font-family:'Press Start 2P',monospace;font-size:${size||22}px;pointer-events:none;z-index:60;text-shadow:2px 2px 0 #000;transform:translate(-50%,-50%);animation:damageFloat 1.1s ease-out forwards;white-space:nowrap;`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(),1300);
}

// ── Camera shake ──────────────────────────────────────────────────────────────
export function triggerShake(magnitude, duration) {
  shakeTime = duration;
  shakeMagnitude = magnitude;
}

// ── Screen flash overlay ──────────────────────────────────────────────────────
export function screenFlash(color, opacity) {
  const f = document.createElement('div');
  f.style.cssText = `position:fixed;inset:0;background:${color};opacity:${opacity};pointer-events:none;z-index:9000;transition:opacity 0.35s`;
  document.body.appendChild(f);
  requestAnimationFrame(()=>{ f.style.opacity='0'; setTimeout(()=>f.remove(),380); });
}

// ── Popup text banner ─────────────────────────────────────────────────────────
export function showBanner(text, color, bg) {
  const existing = document.getElementById('elemental-status-banner');
  if (existing) existing.remove();

  const b = document.createElement('div');
  b.id = 'elemental-status-banner';
  b.textContent = text;
  b.style.cssText = `position:fixed;top:28%;left:50%;transform:translate(-50%,-50%);font-family:'Press Start 2P',monospace;font-size:22px;color:${color};background:${bg};padding:12px 26px;border:3px solid ${color};border-radius:6px;pointer-events:none;z-index:9100;text-shadow:0 0 16px ${color}, 2px 2px 0 #000;box-shadow:0 0 25px ${color};animation:damageFloat 1.4s ease-out forwards;letter-spacing:2px;`;
  document.body.appendChild(b);
  setTimeout(()=>b.remove(),1500);
}

export function showCombatFloatingBanner(text, color = '#ffffff') {
  showBanner(text, color, 'rgba(10, 10, 20, 0.88)');
}

// ─────────────────────────────────────────────────────────────────────────────
// 🗡️ OUTFIT-SPECIFIC WEAPON SLASH VFX (STRICTLY INDEPENDENT OF BOSS ELEMENT)
// ─────────────────────────────────────────────────────────────────────────────
export function spawnFrostSlashVFX(bossPosition) {
  if (!sceneRef) return;
  try { (Audio.playIceShatter || Audio.playFrost)?.(); } catch (e) {}
  screenFlash('rgba(180,230,255,0.45)', 0.45);
  triggerShake(0.35, 0.35);

  const frostCols = [0x38bdf8, 0x88ddff, 0xcceeFF, 0xffffff];
  for (let i = 0; i < 28; i++) {
    const isShard = Math.random() > 0.4;
    const geo = isShard
      ? new THREE.ConeGeometry(0.12 + Math.random() * 0.18, 0.6 + Math.random() * 0.8, 4)
      : new THREE.BoxGeometry(0.2, 0.2, 0.2);
    const m = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: frostCols[Math.floor(Math.random() * frostCols.length)],
        transparent: true,
        opacity: 0.85,
      })
    );
    m.position.copy(bossPosition);
    m.position.x += (Math.random() - 0.5) * 2.2;
    m.position.y += Math.random() * 2.2;
    m.position.z += (Math.random() - 0.5) * 1.2;
    sceneRef.add(m);

    const angle = Math.random() * Math.PI * 2;
    const sp = 3.0 + Math.random() * 8.0;
    particles.push({
      mesh: m,
      velocity: new THREE.Vector3(Math.cos(angle) * sp, (Math.random() - 0.2) * 6.0, Math.sin(angle) * sp * 0.5),
      life: 0.7,
      maxLife: 0.7,
    });
  }

  // Frost shockwave ring
  const rg = new THREE.RingGeometry(0.4, 1.8, 16);
  const rm = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(rg, rm);
  ring.position.copy(bossPosition);
  ring.position.y += 0.2;
  ring.rotation.x = -Math.PI / 2;
  sceneRef.add(ring);
  particles.push({ mesh: ring, life: 0.55, maxLife: 0.55, isRing: true });
}

export function spawnFireSlashVFX(bossPosition) {
  if (!sceneRef) return;
  try { Audio.playFire?.(); } catch (e) {}
  screenFlash('rgba(255,80,0,0.45)', 0.45);
  triggerShake(0.35, 0.35);

  const fireCols = [0xf97316, 0xff4400, 0xffaa00, 0xffdd00];
  for (let i = 0; i < 32; i++) {
    const s = 0.15 + Math.random() * 0.35;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(s, s * 1.8, s),
      new THREE.MeshBasicMaterial({ color: fireCols[Math.floor(Math.random() * fireCols.length)] })
    );
    m.position.copy(bossPosition);
    m.position.x += (Math.random() - 0.5) * 2.2;
    m.position.y += Math.random() * 2.0;
    m.position.z += (Math.random() - 0.5) * 1.2;
    sceneRef.add(m);

    const angle = Math.random() * Math.PI * 2;
    const sp = 3.0 + Math.random() * 8.0;
    const vy = 3.5 + Math.random() * 8.0;
    particles.push({
      mesh: m,
      velocity: new THREE.Vector3(Math.cos(angle) * sp, vy, Math.sin(angle) * sp * 0.5),
      life: 0.75,
      maxLife: 0.75,
    });
  }

  // Flame shockwave ring
  const rg = new THREE.RingGeometry(0.5, 1.8, 24);
  const rm = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(rg, rm);
  ring.position.copy(bossPosition);
  ring.position.y += 0.15;
  ring.rotation.x = -Math.PI / 2;
  sceneRef.add(ring);
  particles.push({ mesh: ring, life: 0.55, maxLife: 0.55, isRing: true });
}

export function spawnThunderSlashVFX(bossPosition) {
  if (!sceneRef) return;
  try { Audio.playThunder?.(); } catch (e) {}
  screenFlash('rgba(200,245,255,0.5)', 0.5);
  triggerShake(0.4, 0.4);

  const bx = bossPosition.x, bz = bossPosition.z;
  const startY = bossPosition.y + 12, endY = bossPosition.y + 1.2;

  function buildBolt(ox, oz) {
    const steps = 10, pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = startY + (endY - startY) * t;
      const dx = (i > 0 && i < steps) ? (Math.random() - 0.5) * 1.4 : 0;
      const dz = (i > 0 && i < steps) ? (Math.random() - 0.5) * 0.7 : 0;
      pts.push(bx + ox + dx, y, bz + oz + dz);
    }
    return new Float32Array(pts);
  }

  [[0, 0, 0xfacc15, 0.35], [-0.3, 0.1, 0x00ffff, 0.3], [0.3, -0.1, 0xffffff, 0.28]].forEach(([ox, oz, col, life]) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(buildBolt(ox, oz), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: col, linewidth: 2 }));
    sceneRef.add(line);
    particles.push({ mesh: line, life, maxLife: life, isLine: true });
  });

  // Electric spark burst
  const thunderCols = [0xfacc15, 0x00ffff, 0xffffff];
  for (let i = 0; i < 30; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.16),
      new THREE.MeshBasicMaterial({ color: thunderCols[Math.floor(Math.random() * thunderCols.length)] })
    );
    m.position.copy(bossPosition);
    m.position.x += (Math.random() - 0.5) * 2.0;
    m.position.y += Math.random() * 2.2;
    m.position.z += (Math.random() - 0.5) * 1.2;
    sceneRef.add(m);

    const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 9;
    particles.push({
      mesh: m,
      velocity: new THREE.Vector3(Math.cos(a) * sp, Math.random() * 6 + 1.5, Math.sin(a) * sp * 0.4),
      life: 0.6,
      maxLife: 0.6,
    });
  }

  // Expanding ring
  const rg = new THREE.RingGeometry(0.5, 1.6, 24);
  const rm = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
  const r = new THREE.Mesh(rg, rm);
  r.position.copy(bossPosition);
  r.position.y += 1.0;
  r.rotation.x = -Math.PI / 2;
  sceneRef.add(r);
  particles.push({ mesh: r, life: 0.45, maxLife: 0.45, isRing: true });
}

export function spawnPhysicalSlashVFX(bossPosition) {
  if (!sceneRef) return;
  try { Audio.playSlash?.(); } catch (e) {}
  triggerShake(0.25, 0.25);

  // Sharp golden & pure white sparks (steel impact, NO elemental magic)
  const sparkCols = [0xffffff, 0xffd700, 0xffea75, 0xfafafa];
  for (let i = 0; i < 28; i++) {
    const s = 0.12 + Math.random() * 0.14;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(s, s * 1.4, s),
      new THREE.MeshBasicMaterial({ color: sparkCols[Math.floor(Math.random() * sparkCols.length)] })
    );
    m.position.copy(bossPosition);
    m.position.x += (Math.random() - 0.5) * 1.4;
    m.position.y += 0.8 + Math.random() * 1.5;
    m.position.z += (Math.random() - 0.5) * 1.0;
    sceneRef.add(m);

    const angle = Math.random() * Math.PI * 2;
    const sp = 4.0 + Math.random() * 7.0;
    particles.push({
      mesh: m,
      velocity: new THREE.Vector3(Math.cos(angle) * sp, (Math.random() - 0.2) * 5.0, Math.sin(angle) * sp * 0.5),
      life: 0.45,
      maxLife: 0.45,
    });
  }

  // Double spark bursts at hit points
  spawnHitSpark(bossPosition);
  spawnHitSpark(new THREE.Vector3(bossPosition.x + 0.3, bossPosition.y + 0.3, bossPosition.z));
  spawnHitSpark(new THREE.Vector3(bossPosition.x - 0.3, bossPosition.y - 0.2, bossPosition.z));
}

// ─────────────────────────────────────────────────────────────────────────────
// 🌟 ELEMENTAL STATUS EFFECT (MATCHING ACTIVE STAGE/BOSS ELEMENT)
// ─────────────────────────────────────────────────────────────────────────────
export function triggerElementalStatus(bossPosition, stageElement = 'thunder', damageLabel = null) {
  if (!sceneRef) return;
  const norm = (stageElement || 'thunder').toLowerCase();

  if (norm === 'fire') {
    // Fire Stage: Banner BURNING! with blazing fire embers and orange explosion
    showBanner('🔥 BURNING!', '#ff6600', 'rgba(80,10,0,0.88)');
    screenFlash('rgba(255,80,0,0.35)', 0.35);
    triggerShake(0.35, 0.35);

    // Blazing fire embers & orange explosion burst
    const fireCols = [0xff2200, 0xff5500, 0xffaa00, 0xffdd00];
    for (let i = 0; i < 35; i++) {
      const s = 0.15 + Math.random() * 0.3;
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(s, s * 1.8, s),
        new THREE.MeshBasicMaterial({ color: fireCols[Math.floor(Math.random() * fireCols.length)] })
      );
      m.position.copy(bossPosition);
      m.position.x += (Math.random() - 0.5) * 2.2;
      m.position.y += Math.random() * 2.0;
      m.position.z += (Math.random() - 0.5) * 1.5;
      sceneRef.add(m);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.5 + Math.random() * 7.0;
      const vy = 3.5 + Math.random() * 8.0;
      particles.push({
        mesh: m,
        velocity: new THREE.Vector3(Math.cos(angle) * speed, vy, Math.sin(angle) * speed * 0.5),
        life: 0.75,
        maxLife: 0.75,
      });
    }

  } else if (norm === 'frost' || norm === 'ice') {
    // Frost Stage: Banner FROSTBITE! with freezing ice shards and cyan smoke
    showBanner('❄️ FROSTBITE!', '#00e5ff', 'rgba(0,30,60,0.9)');
    screenFlash('rgba(180,240,255,0.4)', 0.4);
    triggerShake(0.35, 0.35);

    // Freezing ice shards & cyan cold mist
    const frostCols = [0x00e5ff, 0x88ddff, 0xcceeFF, 0xffffff];
    for (let i = 0; i < 30; i++) {
      const isShard = Math.random() > 0.4;
      const geo = isShard
        ? new THREE.ConeGeometry(0.12 + Math.random() * 0.18, 0.6 + Math.random() * 0.8, 4)
        : new THREE.BoxGeometry(0.2, 0.2, 0.2);
      const m = new THREE.Mesh(
        geo,
        new THREE.MeshBasicMaterial({
          color: frostCols[Math.floor(Math.random() * frostCols.length)],
          transparent: true,
          opacity: 0.85,
        })
      );
      m.position.copy(bossPosition);
      m.position.x += (Math.random() - 0.5) * 2.0;
      m.position.y += Math.random() * 2.2;
      m.position.z += (Math.random() - 0.5) * 1.2;
      sceneRef.add(m);

      const angle = Math.random() * Math.PI * 2;
      const sp = 2.0 + Math.random() * 8.0;
      particles.push({
        mesh: m,
        velocity: new THREE.Vector3(Math.cos(angle) * sp, (Math.random() - 0.2) * 5.0, Math.sin(angle) * sp * 0.5),
        life: 0.7,
        maxLife: 0.7,
      });
    }

  } else if (norm === 'thunder' || norm === 'lightning') {
    // Thunder Stage: Banner SHOCKED! with electric spark bursts and neon blue arcs
    showBanner('⚡ SHOCKED!', '#00ffff', 'rgba(10,20,60,0.9)');
    screenFlash('rgba(200,245,255,0.45)', 0.45);
    triggerShake(0.4, 0.4);

    // Electric spark bursts & neon blue lightning lines
    const thunderCols = [0x00ffff, 0xffff00, 0x88ffff, 0xffffff];
    for (let i = 0; i < 35; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.16, 0.16),
        new THREE.MeshBasicMaterial({ color: thunderCols[Math.floor(Math.random() * thunderCols.length)] })
      );
      m.position.copy(bossPosition);
      m.position.x += (Math.random() - 0.5) * 2.0;
      m.position.y += Math.random() * 2.5;
      m.position.z += (Math.random() - 0.5) * 1.2;
      sceneRef.add(m);

      const angle = Math.random() * Math.PI * 2;
      const sp = 4.0 + Math.random() * 10.0;
      particles.push({
        mesh: m,
        velocity: new THREE.Vector3(Math.cos(angle) * sp, Math.random() * 7.0 + 1.0, Math.sin(angle) * sp * 0.4),
        life: 0.65,
        maxLife: 0.65,
      });
    }

  } else {
    // Default / Normal: Standard CRITICAL HIT! with neutral impact stars
    showBanner('💥 CRITICAL HIT!', '#ffd700', 'rgba(30,30,40,0.88)');
    triggerShake(0.25, 0.25);

    const neutralCols = [0xffd700, 0xffffff, 0xffaa00];
    for (let i = 0; i < 25; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.18, 0.18),
        new THREE.MeshBasicMaterial({ color: neutralCols[Math.floor(Math.random() * neutralCols.length)] })
      );
      m.position.copy(bossPosition);
      m.position.x += (Math.random() - 0.5) * 1.8;
      m.position.y += Math.random() * 1.8;
      m.position.z += (Math.random() - 0.5) * 1.0;
      sceneRef.add(m);

      const angle = Math.random() * Math.PI * 2;
      const sp = 3.0 + Math.random() * 6.0;
      particles.push({
        mesh: m,
        velocity: new THREE.Vector3(Math.cos(angle) * sp, Math.random() * 5.0 + 1.0, Math.sin(angle) * sp * 0.5),
        life: 0.55,
        maxLife: 0.55,
      });
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ⚡ BOSS "SUPER SAIYAN" ANGRY AURA & ROAR
// ─────────────────────────────────────────────────────────────────────────────
export function createBossSuperSaiyanAura(bossGroup, element = 'thunder') {
  if (!sceneRef || !bossGroup) return null;
  const norm = (element || 'thunder').toLowerCase();

  const auraGroup = new THREE.Group();
  auraGroup.name = 'BossSuperSaiyanAura';

  // Subtle sustained rumble during roar (1.1s)
  triggerShake(0.24, 1.1);

  let auraLight = null;
  let particleMesh = null;
  let particleData = [];
  let lightningMesh = null;
  let pillarMeshes = [];
  let mainAuraCone = null;
  let innerAuraCone = null;
  let flameTex = null;
  let flameMat = null;
  let clock = 0;

  if (norm === 'fire') {
    // 🔥 DRAGON BALL SUPER SAIYAN KI / FLAME AURA FOR FIRE BOSS
    // 1. High-intensity point light centered at the boss torso (color: 0xff3b00, intensity: 4.5, distance: 15)
    auraLight = new THREE.PointLight(0xff3b00, 4.5, 15);
    auraLight.position.set(0, 3.2, 0);
    auraGroup.add(auraLight);

    // 2. Procedural flaming Ki Canvas Texture with vertical animated UV scrolling
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 512, 0, 0);
    grad.addColorStop(0.0, 'rgba(255, 235, 60, 0.98)');  // Core Ki golden yellow
    grad.addColorStop(0.22, 'rgba(255, 90, 0, 0.90)');   // Blazing Super Saiyan orange
    grad.addColorStop(0.60, 'rgba(255, 30, 0, 0.70)');   // Fiery red
    grad.addColorStop(0.92, 'rgba(180, 0, 0, 0.25)');   // Dissipating crimson
    grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');        // Top fade
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 512);

    // Vertical jagged Ki flame spikes
    ctx.fillStyle = 'rgba(255, 255, 190, 0.85)';
    for (let i = 0; i < 30; i++) {
      const x = (i / 30) * 256 + (Math.random() - 0.5) * 6;
      const w = 4 + Math.random() * 8;
      const h = 220 + Math.random() * 260;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, 512);
      ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 24, 512 - h * 0.5, x, 512 - h);
      ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 24, 512 - h * 0.5, x + w / 2, 512);
      ctx.fill();
    }

    flameTex = new THREE.CanvasTexture(canvas);
    flameTex.wrapS = THREE.RepeatWrapping;
    flameTex.wrapT = THREE.RepeatWrapping;

    // 3. Expanding vertical cylinder/cone mesh wrapping the boss (radiusBottom: 2.2, radiusTop: 3.5, height: 7.5)
    // CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, heightSegments, openEnded)
    const coneGeo = new THREE.CylinderGeometry(3.5, 2.2, 7.5, 32, 8, true);
    flameMat = new THREE.MeshBasicMaterial({
      map: flameTex,
      color: 0xff4500,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    mainAuraCone = new THREE.Mesh(coneGeo, flameMat);
    mainAuraCone.position.set(0, 3.75, 0);
    auraGroup.add(mainAuraCone);

    // Inner core blinding Ki cone (radiusBottom: 1.6, radiusTop: 2.6, height: 7.0, core yellow 0xffd700)
    const innerConeGeo = new THREE.CylinderGeometry(2.6, 1.6, 7.0, 24, 6, true);
    const innerFlameMat = new THREE.MeshBasicMaterial({
      map: flameTex,
      color: 0xffd700,
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    innerAuraCone = new THREE.Mesh(innerConeGeo, innerFlameMat);
    innerAuraCone.position.set(0, 3.5, 0);
    auraGroup.add(innerAuraCone);

    // 4. Core ground fire bursts: ring of rising jagged fire pillars erupting from the boss's feet
    const pillarCount = 8;
    for (let i = 0; i < pillarCount; i++) {
      const angle = (i / pillarCount) * Math.PI * 2;
      const radius = 2.4 + (i % 2) * 0.4;
      const pGeo = new THREE.ConeGeometry(0.38, 3.6, 4);
      const pMat = new THREE.MeshBasicMaterial({
        color: (i % 2 === 0) ? 0xff4500 : 0xffd700,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const pillar = new THREE.Mesh(pGeo, pMat);
      pillar.position.set(Math.cos(angle) * radius, 1.8, Math.sin(angle) * radius);
      auraGroup.add(pillar);
      pillarMeshes.push({ mesh: pillar, baseAngle: angle, radius, phase: i * 0.8 });
    }
    // ❄️ Frost Boss: Violent swirling blizzard vortex with cold white/cyan mist & radiating sharp icicles
    auraLight = new THREE.PointLight(0x00e5ff, 2.8, 12);
    auraLight.position.set(0, 2.5, 0);
    auraGroup.add(auraLight);

    // Radiating sharp icicles
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 2.0;
      const geo = new THREE.ConeGeometry(0.18, 1.8, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x88eeff,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const icicle = new THREE.Mesh(geo, mat);
      icicle.position.set(Math.cos(angle) * radius, 1.2 + (i % 2) * 1.5, Math.sin(angle) * radius);
      icicle.rotation.z = Math.cos(angle) * 0.5;
      icicle.rotation.x = Math.sin(angle) * 0.5;
      auraGroup.add(icicle);
      pillarMeshes.push({ mesh: icicle, baseAngle: angle, radius });
    }

    // Swirling blizzard vortex
    const count = 45;
    const geom = new THREE.BufferGeometry();
    const posArray = new Float32Array(count * 3);
    const colArray = new Float32Array(count * 3);
    const frostCols = [new THREE.Color(0x00e5ff), new THREE.Color(0x88ddff), new THREE.Color(0xffffff)];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.8 + Math.random() * 2.2;
      const y = Math.random() * 4.5;
      posArray[i * 3]     = Math.cos(angle) * r;
      posArray[i * 3 + 1] = y;
      posArray[i * 3 + 2] = Math.sin(angle) * r;

      const c = frostCols[Math.floor(Math.random() * frostCols.length)];
      colArray[i * 3]     = c.r;
      colArray[i * 3 + 1] = c.g;
      colArray[i * 3 + 2] = c.b;

      particleData.push({
        angle,
        r,
        y,
        vy: 2.2 + Math.random() * 3.0,
        rotSpeed: 5.0 + Math.random() * 3.0,
      });
    }

    geom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colArray, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.32,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    particleMesh = new THREE.Points(geom, pMat);
    auraGroup.add(particleMesh);

  } else {
    // ⚡ Thunder Boss: Chaotic electric bolts crackling around entire body with rapid flashing point lights (intensity 3.0)
    auraLight = new THREE.PointLight(0x00ffff, 3.0, 14);
    auraLight.position.set(0, 2.5, 0);
    auraGroup.add(auraLight);

    // Chaotic electric bolt line segments
    const segCount = 16;
    const lineGeom = new THREE.BufferGeometry();
    const linePositions = new Float32Array(segCount * 2 * 3);
    lineGeom.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x88ffff,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    lightningMesh = new THREE.LineSegments(lineGeom, lineMat);
    auraGroup.add(lightningMesh);

    // Crackling sparks
    const count = 40;
    const geom = new THREE.BufferGeometry();
    const posArray = new Float32Array(count * 3);
    const colArray = new Float32Array(count * 3);
    const thunderCols = [new THREE.Color(0x00ffff), new THREE.Color(0xffffaa), new THREE.Color(0x00e5ff)];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.6 + Math.random() * 1.8;
      const y = Math.random() * 4.5;
      posArray[i * 3]     = Math.cos(angle) * r;
      posArray[i * 3 + 1] = y;
      posArray[i * 3 + 2] = Math.sin(angle) * r;

      const c = thunderCols[Math.floor(Math.random() * thunderCols.length)];
      colArray[i * 3]     = c.r;
      colArray[i * 3 + 1] = c.g;
      colArray[i * 3 + 2] = c.b;

      particleData.push({
        angle,
        r,
        y,
        vy: 3.5 + Math.random() * 4.0,
        rotSpeed: 6.0 + Math.random() * 4.0,
      });
    }

    geom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colArray, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    particleMesh = new THREE.Points(geom, pMat);
    auraGroup.add(particleMesh);
  }

  bossGroup.add(auraGroup);

  return {
    group: auraGroup,
    update: (dt) => {
      clock += dt;
      // Pulse light
      if (auraLight) {
        if (norm === 'thunder') {
          // Rapid strobe
          auraLight.intensity = (Math.random() > 0.3) ? 3.0 : 1.2;
        } else if (norm === 'fire') {
          // High-intensity flame core light pulsating around 4.5
          auraLight.intensity = 4.2 + Math.sin(clock * 18) * 1.2;
        } else {
          auraLight.intensity = 2.4 + Math.sin(clock * 10) * 0.6;
        }
      }

      // Update fire-specific Dragon Ball Super Saiyan Ki effects
      if (norm === 'fire') {
        if (flameTex) {
          flameTex.offset.y -= dt * 4.5;
        }
        if (flameMat) {
          const pulse = 0.5 + 0.5 * Math.sin(clock * 14);
          const col = new THREE.Color(0xff4500).lerp(new THREE.Color(0xffd700), pulse * 0.8);
          flameMat.color.copy(col);
        }
        if (mainAuraCone) {
          const vib = 1.0 + Math.sin(clock * 24) * 0.05;
          mainAuraCone.scale.set(vib, 1.0 + Math.sin(clock * 16) * 0.02, vib);
          mainAuraCone.rotation.y += dt * 1.6;
        }
        if (innerAuraCone) {
          const innerVib = 1.0 + Math.cos(clock * 28) * 0.04;
          innerAuraCone.scale.set(innerVib, 1.0, innerVib);
          innerAuraCone.rotation.y -= dt * 2.2;
        }
        pillarMeshes.forEach((p) => {
          const sy = 0.6 + 0.7 * Math.abs(Math.sin(clock * 14 + p.phase));
          p.mesh.scale.set(1.0, sy, 1.0);
          p.mesh.rotation.y += dt * 3.5;
        });
      } else {
        // Rotate & wobble pillars for non-fire elements
        pillarMeshes.forEach((p, idx) => {
          p.baseAngle += dt * 1.8;
          p.mesh.position.x = Math.cos(p.baseAngle) * p.radius;
          p.mesh.position.z = Math.sin(p.baseAngle) * p.radius;
          p.mesh.rotation.y += dt * 2.5;
        });
      }

      // Update swirling particles
      if (particleMesh) {
        const pos = particleMesh.geometry.attributes.position.array;
        for (let i = 0; i < particleData.length; i++) {
          const d = particleData[i];
          d.angle += d.rotSpeed * dt;
          d.y += d.vy * dt;
          if (d.y > 4.8) {
            d.y = 0.2 + Math.random() * 0.4;
          }
          pos[i * 3]     = Math.cos(d.angle) * d.r;
          pos[i * 3 + 1] = d.y;
          pos[i * 3 + 2] = Math.sin(d.angle) * d.r;
        }
        particleMesh.geometry.attributes.position.needsUpdate = true;
      }

      // Chaotic lightning lines for thunder
      if (lightningMesh) {
        const lpos = lightningMesh.geometry.attributes.position.array;
        const segCount = lpos.length / 6;
        for (let i = 0; i < segCount; i++) {
          const startR = 0.8 + Math.random() * 1.0;
          const a1 = Math.random() * Math.PI * 2;
          const y1 = Math.random() * 4.2;
          const a2 = a1 + (Math.random() - 0.5) * 1.2;
          const y2 = y1 + (Math.random() - 0.5) * 1.5;
          const endR = 0.8 + Math.random() * 1.2;

          lpos[i * 6]     = Math.cos(a1) * startR;
          lpos[i * 6 + 1] = y1;
          lpos[i * 6 + 2] = Math.sin(a1) * startR;

          lpos[i * 6 + 3] = Math.cos(a2) * endR;
          lpos[i * 6 + 4] = y2;
          lpos[i * 6 + 5] = Math.sin(a2) * endR;
        }
        lightningMesh.geometry.attributes.position.needsUpdate = true;
      }
    },
    dispose: () => {
      if (flameTex) {
        try { flameTex.dispose(); } catch (e) {}
      }
      if (auraGroup.parent) {
        auraGroup.parent.remove(auraGroup);
      }
      auraGroup.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          if (Array.isArray(c.material)) c.material.forEach(m => m.dispose());
          else c.material.dispose();
        }
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ⚡ LIGHTNING SLASH
// ─────────────────────────────────────────────────────────────────────────────
export function triggerLightningSlash(bossPosition, damageText) {
  if (!sceneRef) return;
  screenFlash('rgba(200,240,255,0.72)', 0.72);

  const bx = bossPosition.x, bz = bossPosition.z;
  const startY = bossPosition.y + 15, endY = bossPosition.y + 1.5;

  function buildBolt(ox, oz) {
    const steps = 12, pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i/steps;
      const y = startY+(endY-startY)*t;
      const dx = (i>0&&i<steps)?(Math.random()-0.5)*1.6:0;
      const dz = (i>0&&i<steps)?(Math.random()-0.5)*0.8:0;
      pts.push(bx+ox+dx, y, bz+oz+dz);
    }
    return new Float32Array(pts);
  }

  [[0,0,0x00ffff,0.45],[-0.35,0.1,0xffff00,0.38],[0.35,-0.1,0x88ffff,0.32]].forEach(([ox,oz,col,life])=>{
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(buildBolt(ox,oz),3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({color:col,linewidth:2}));
    sceneRef.add(line);
    particles.push({mesh:line,life,maxLife:life,isLine:true});
  });

  // Electric sparks
  [0x00ffff,0xffff00,0x88ffff,0xffffaa].forEach((c,ci)=>{
    for (let i=0; i<10; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.18,0.18,0.18),new THREE.MeshBasicMaterial({color:c}));
      m.position.copy(bossPosition); m.position.y += 1+Math.random()*2;
      sceneRef.add(m);
      const a=Math.random()*Math.PI*2,sp=5+Math.random()*12;
      particles.push({mesh:m,velocity:new THREE.Vector3(Math.cos(a)*sp,Math.random()*6+2,Math.sin(a)*sp*0.4),life:0.6,maxLife:0.6});
    }
  });

  // Expanding ring
  [[0x00ffff,1.1,0.5],[0xffee00,0.5,0.45]].forEach(([col,radius,life])=>{
    const rg=new THREE.RingGeometry(radius*0.7,radius,32);
    const rm=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.85,side:THREE.DoubleSide,depthWrite:false});
    const r=new THREE.Mesh(rg,rm);
    r.position.copy(bossPosition); r.position.y+=1.2; r.rotation.x=-Math.PI/2;
    sceneRef.add(r);
    particles.push({mesh:r,life,maxLife:life,isRing:true});
  });

  triggerShake(0.65, 0.55);
  showBanner('⚡ SHOCKED!', '#00ffff', 'rgba(10,20,60,0.9)');
  const dp=bossPosition.clone(); dp.y+=4;
  spawnDamageNumber(dp, damageText||'⚡ -2','#00ffff',32);
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 FIRE BURST
// ─────────────────────────────────────────────────────────────────────────────
export function triggerFireBurst(bossPosition, damageText) {
  if (!sceneRef) return;
  screenFlash('rgba(255,80,0,0.45)', 0.45);

  // Fire column — rising orange/red/yellow boxes
  const fireCols = [0xff4400, 0xff8800, 0xffcc00, 0xff2200];
  for (let i = 0; i < 40; i++) {
    const s = 0.15+Math.random()*0.35;
    const m = new THREE.Mesh(new THREE.BoxGeometry(s,s*2,s), new THREE.MeshBasicMaterial({color:fireCols[Math.floor(Math.random()*fireCols.length)]}));
    m.position.copy(bossPosition);
    m.position.x += (Math.random()-0.5)*2.5;
    m.position.y += Math.random()*1.5;
    m.position.z += (Math.random()-0.5)*1.0;
    sceneRef.add(m);
    const vy = 4+Math.random()*10;
    particles.push({ mesh:m, velocity:new THREE.Vector3((Math.random()-0.5)*3, vy, (Math.random()-0.5)*2), life:0.8, maxLife:0.8 });
  }

  // Glowing ring on ground
  const rg = new THREE.RingGeometry(0.6, 1.8, 32);
  const rm = new THREE.MeshBasicMaterial({color:0xff6600,transparent:true,opacity:0.9,side:THREE.DoubleSide,depthWrite:false});
  const ring = new THREE.Mesh(rg, rm);
  ring.position.copy(bossPosition); ring.position.y += 0.15; ring.rotation.x = -Math.PI/2;
  sceneRef.add(ring);
  particles.push({mesh:ring, life:0.6, maxLife:0.6, isRing:true});

  triggerShake(0.45, 0.45);
  showBanner('🔥 BURNING!', '#ff6600', 'rgba(80,10,0,0.88)');
  const dp = bossPosition.clone(); dp.y += 5;
  spawnDamageNumber(dp, damageText||'🔥 -2', '#ff6600', 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// ❄️ FROST SHATTER
// ─────────────────────────────────────────────────────────────────────────────
export function triggerFrostShatter(bossPosition, damageText) {
  if (!sceneRef) return;
  screenFlash('rgba(180,230,255,0.55)', 0.55);

  // Ice crystal spikes rising around boss
  const frostCols = [0x88ddff, 0xcceeFF, 0x4499cc, 0xffffff];
  for (let i = 0; i < 12; i++) {
    const angle = (i/12)*Math.PI*2;
    const r = 0.8+Math.random()*1.2;
    const h = 1.0+Math.random()*2.5;
    const geo = new THREE.ConeGeometry(0.2+Math.random()*0.25, h, 4);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:frostCols[Math.floor(Math.random()*frostCols.length)],transparent:true,opacity:0.85}));
    m.position.copy(bossPosition);
    m.position.x += Math.cos(angle)*r;
    m.position.z += Math.sin(angle)*r*0.6;
    m.position.y += h*0.5;
    sceneRef.add(m);
    // After 0.25s, shatter into shards
    particles.push({ mesh:m, life:0.28, maxLife:0.28, frozenSpike:true });
    // Shatter shards
    setTimeout(()=>{
      if (!sceneRef) return;
      for (let j=0;j<5;j++){
        const sh=new THREE.Mesh(new THREE.BoxGeometry(0.14,0.14,0.14),new THREE.MeshBasicMaterial({color:0xcceeFF,transparent:true}));
        sh.position.copy(m.position);
        sceneRef.add(sh);
        const a2=Math.random()*Math.PI*2,sp=3+Math.random()*8;
        particles.push({mesh:sh,velocity:new THREE.Vector3(Math.cos(a2)*sp,(Math.random()-0.2)*sp*0.8,Math.sin(a2)*sp*0.5),life:0.55,maxLife:0.55});
      }
    }, 260);
  }

  // Frost ring
  const rg = new THREE.RingGeometry(0.5, 2.2, 6);
  const rm = new THREE.MeshBasicMaterial({color:0x88ddff,transparent:true,opacity:0.8,side:THREE.DoubleSide,depthWrite:false});
  const ring = new THREE.Mesh(rg, rm);
  ring.position.copy(bossPosition); ring.position.y += 0.2; ring.rotation.x = -Math.PI/2;
  sceneRef.add(ring);
  particles.push({mesh:ring, life:0.7, maxLife:0.7, isRing:true});

  triggerShake(0.35, 0.4);
  showBanner('❄️ FROSTBITE!', '#00e5ff', 'rgba(0,30,60,0.9)');
  const dp = bossPosition.clone(); dp.y += 5;
  spawnDamageNumber(dp, damageText||'❄️ -2', '#00e5ff', 30);
}

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 FLAME PROJECTILE / WAVE
// ─────────────────────────────────────────────────────────────────────────────
export function spawnFlameProjectile(startPos, targetPos, onImpact) {
  if (!sceneRef) { if (onImpact) onImpact(); return; }
  const group = new THREE.Group();
  group.position.copy(startPos);

  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffaa00 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), coreMat);
  group.add(core);

  const waveMat = new THREE.MeshBasicMaterial({
    color: 0xff4400,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const waveGeo = new THREE.TorusGeometry(0.7, 0.18, 6, 16, Math.PI);
  const wave = new THREE.Mesh(waveGeo, waveMat);
  wave.rotation.y = Math.PI / 2;
  wave.rotation.z = -Math.PI / 2;
  group.add(wave);

  sceneRef.add(group);

  const startTime = performance.now();
  const duration = 1800; // ~1.8s flight duration for cinematic clarity
  const sx = startPos.x, sy = startPos.y, sz = startPos.z;
  const tx = targetPos.x, ty = targetPos.y, tz = targetPos.z;

  const animInterval = setInterval(() => {
    const elapsed = performance.now() - startTime;
    const t = Math.min(1.0, elapsed / duration);
    group.position.x = sx + (tx - sx) * t;
    group.position.y = sy + (ty - sy) * t + Math.sin(t * Math.PI) * 0.8;
    group.position.z = sz + (tz - sz) * t;
    group.rotation.x += 0.08;
    group.rotation.z += 0.12;

    if (sceneRef && Math.random() < 0.6) {
      const ember = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.14, 0.14),
        new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xff4400 : 0xffcc00 })
      );
      ember.position.copy(group.position);
      sceneRef.add(ember);
      particles.push({
        mesh: ember,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 1.5, (Math.random() - 0.2) * 1.5, (Math.random() - 0.5) * 1.5),
        life: 0.6,
        maxLife: 0.6,
      });
    }

    if (t >= 1.0) {
      clearInterval(animInterval);
      if (sceneRef) sceneRef.remove(group);
      group.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
      if (onImpact) onImpact();
    }
  }, 16);
}

// ─────────────────────────────────────────────────────────────────────────────
// ❄️ ICE ENCASEMENT
// ─────────────────────────────────────────────────────────────────────────────
export function freezeBossInIce(bossPosition, duration = 400, onShatter) {
  if (!sceneRef) { if (onShatter) onShatter(); return; }

  const iceGroup = new THREE.Group();
  iceGroup.position.copy(bossPosition);

  const iceMat = new THREE.MeshBasicMaterial({
    color: 0x88ddff,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const blockGeo = new THREE.BoxGeometry(3.6, 5.4, 3.6);
  const block = new THREE.Mesh(blockGeo, iceMat);
  block.position.set(0, 0.2, 0);
  block.scale.set(0.2, 0.05, 0.2);
  iceGroup.add(block);

  const spikes = [];
  const spikeMat = new THREE.MeshBasicMaterial({ color: 0xcceeFF, transparent: true, opacity: 0.85 });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.2, 4), spikeMat);
    spike.position.set(Math.cos(angle) * 1.5, -2.0, Math.sin(angle) * 1.2);
    spike.rotation.z = Math.cos(angle) * 0.2;
    spike.scale.set(0.1, 0.1, 0.1);
    iceGroup.add(spike);
    spikes.push(spike);
  }

  sceneRef.add(iceGroup);

  const growStart = performance.now();
  const growDur = 120;
  const growInterval = setInterval(() => {
    const elapsed = performance.now() - growStart;
    const t = Math.min(1.0, elapsed / growDur);
    block.scale.set(0.2 + 0.8 * t, 0.05 + 0.95 * t, 0.2 + 0.8 * t);
    spikes.forEach(sp => sp.scale.set(t, t, t));
    if (t >= 1.0) clearInterval(growInterval);
  }, 16);

  setTimeout(() => {
    clearInterval(growInterval);
    if (sceneRef) sceneRef.remove(iceGroup);
    iceGroup.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });

    if (sceneRef) {
      for (let i = 0; i < 40; i++) {
        const shard = new THREE.Mesh(
          new THREE.BoxGeometry(0.18 + Math.random() * 0.15, 0.18 + Math.random() * 0.15, 0.18),
          new THREE.MeshBasicMaterial({
            color: Math.random() > 0.4 ? 0x88ddff : 0xffffff,
            transparent: true,
            opacity: 0.9,
          })
        );
        shard.position.copy(bossPosition);
        shard.position.x += (Math.random() - 0.5) * 2.5;
        shard.position.y += (Math.random() - 0.5) * 3.5;
        shard.position.z += (Math.random() - 0.5) * 2.0;
        sceneRef.add(shard);
        const a = Math.random() * Math.PI * 2;
        const sp = 5 + Math.random() * 12;
        particles.push({
          mesh: shard,
          velocity: new THREE.Vector3(Math.cos(a) * sp, (Math.random() - 0.2) * sp + 3, Math.sin(a) * sp * 0.5),
          life: 0.65,
          maxLife: 0.65,
        });
      }
    }

    if (onShatter) onShatter();
  }, duration);
}

// ─────────────────────────────────────────────────────────────────────────────
// 👾 BOSS ATTACK VFX
// ─────────────────────────────────────────────────────────────────────────────
export function spawnBossFrostSlam(slamPos) {
  if (!sceneRef) return;
  triggerShake(0.4, 0.35);
  screenFlash('rgba(180,230,255,0.4)', 0.4);
  const cols = [0x88ddff, 0xcceeff, 0xffffff];
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const sp = 4 + Math.random() * 8;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 0.25, 0.25),
      new THREE.MeshBasicMaterial({ color: cols[i % cols.length], transparent: true, opacity: 0.9 })
    );
    m.position.copy(slamPos);
    sceneRef.add(m);
    particles.push({
      mesh: m,
      velocity: new THREE.Vector3(Math.cos(angle) * sp, 2.5 + Math.random() * 5, Math.sin(angle) * sp * 0.5),
      life: 0.55,
      maxLife: 0.55,
    });
  }
}

export function spawnBossFireWave(startPos, targetPos, onImpact) {
  if (!sceneRef) { if (onImpact) onImpact(); return; }
  const steps = 16;
  const dx = (targetPos.x - startPos.x) / steps;
  for (let i = 0; i <= steps; i++) {
    const delay = i * 110; // ~1.8s total wave travel
    setTimeout(() => {
      if (!sceneRef) return;
      const x = startPos.x + dx * i;
      const cols = [0xff2200, 0xff6600, 0xffcc00];
      for (let k = 0; k < 6; k++) {
        const h = 0.6 + Math.random() * 1.6;
        const m = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, h, 0.35),
          new THREE.MeshBasicMaterial({ color: cols[k % cols.length], transparent: true, opacity: 0.9 })
        );
        m.position.set(x + (Math.random() - 0.5) * 0.4, h / 2, (Math.random() - 0.5) * 0.5);
        sceneRef.add(m);
        particles.push({
          mesh: m,
          life: 0.6,
          maxLife: 0.6,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 1.5, 3 + Math.random() * 4, (Math.random() - 0.5) * 1.5),
        });
      }
      if (i === steps && onImpact) {
        onImpact();
      }
    }, delay);
  }
}

export function spawnBossLightningBeam(startPos, targetPos, duration = 480, onImpact) {
  if (typeof duration === 'function') {
    onImpact = duration;
    duration = 480;
  }
  if (!sceneRef) { if (onImpact) onImpact(); return; }

  const sPos = startPos ? startPos.clone() : new THREE.Vector3(4.3, 3.8, 0);
  const tPos = targetPos ? targetPos.clone() : new THREE.Vector3(-4.5, 1.2, 0);

  // Group to hold all active bolt meshes & lights
  const beamGroup = new THREE.Group();
  sceneRef.add(beamGroup);

  const activeMeshes = [];
  const activeGeometries = [];
  const activeMaterials = [];
  const activeLights = [];

  // Core white material
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });
  activeMaterials.push(coreMat);

  // Outer glowing neon cyan bloom material (radius 0.28 - 0.35)
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 3.0,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  activeMaterials.push(outerMat);

  // Secondary arc material (cyan/electric blue)
  const secondaryMat = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  activeMaterials.push(secondaryMat);

  // 1. Pulsing point lights along the bolt path
  const lightCount = 3;
  for (let l = 0; l < lightCount; l++) {
    const lt = (l + 1) / (lightCount + 1);
    const pLight = new THREE.PointLight(0x38bdf8, 5.0, 15);
    pLight.position.set(
      sPos.x + (tPos.x - sPos.x) * lt,
      sPos.y + (tPos.y - sPos.y) * lt + 0.3,
      sPos.z + (tPos.z - sPos.z) * lt
    );
    beamGroup.add(pLight);
    activeLights.push(pLight);
  }

  // Helper to build a cylinder between two 3D points
  const addCylinderSegment = (p1, p2, radius, mat, targetGroup = beamGroup) => {
    const dist = p1.distanceTo(p2);
    if (dist < 0.01) return null;
    const geo = new THREE.CylinderGeometry(radius, radius, dist, 6, 1, false);
    activeGeometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((p1.x + p2.x) * 0.5, (p1.y + p2.y) * 0.5, (p1.z + p2.z) * 0.5);
    const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    targetGroup.add(mesh);
    activeMeshes.push(mesh);
    return mesh;
  };

  // Helper to generate a multi-segment zigzag bolt from A to B
  const generateZigzagBolt = (fromPos, toPos, segments, spreadY, spreadZ, outerR, innerR, targetGroup) => {
    const pts = [fromPos.clone()];
    for (let i = 1; i < segments; i++) {
      const frac = i / segments;
      const base = new THREE.Vector3().lerpVectors(fromPos, toPos, frac);
      const jy = (Math.random() - 0.5) * spreadY;
      const jz = (Math.random() - 0.5) * spreadZ;
      const jx = (Math.random() - 0.5) * 0.35;
      pts.push(new THREE.Vector3(base.x + jx, base.y + jy, base.z + jz));
    }
    pts.push(toPos.clone());

    for (let i = 0; i < pts.length - 1; i++) {
      const pA = pts[i];
      const pB = pts[i + 1];
      // Outer neon cyan sleeve (radius ~ 0.28 - 0.35)
      addCylinderSegment(pA, pB, outerR, outerMat, targetGroup);
      // Inner blinding white core (radius ~ 0.14 - 0.18)
      addCylinderSegment(pA, pB, innerR, coreMat, targetGroup);
    }
    return pts;
  };

  // Sub-container for dynamic crackling meshes so we can refresh them
  let crackleGroup = new THREE.Group();
  beamGroup.add(crackleGroup);

  const rebuildBarrage = () => {
    // Clear previous crackle meshes
    while (crackleGroup.children.length > 0) {
      const child = crackleGroup.children[0];
      crackleGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }

    // Flicker point lights along bolt path
    for (const pLight of activeLights) {
      pLight.intensity = 3.5 + Math.random() * 4.0;
    }

    // Discharge a cluster of 4 to 6 violent, zigzagging main bolts
    const boltConfigs = [
      { offsetStart: new THREE.Vector3(0, 0, 0), offsetEnd: new THREE.Vector3(0, 0, 0), spreadY: 1.4, spreadZ: 0.9, outerR: 0.32, innerR: 0.17 },
      { offsetStart: new THREE.Vector3(0, 0.4, 0.3), offsetEnd: new THREE.Vector3(0, 0.2, 0.2), spreadY: 1.8, spreadZ: 1.2, outerR: 0.28, innerR: 0.15 },
      { offsetStart: new THREE.Vector3(0, -0.4, -0.3), offsetEnd: new THREE.Vector3(0, -0.2, -0.2), spreadY: 1.6, spreadZ: 1.1, outerR: 0.28, innerR: 0.15 },
      { offsetStart: new THREE.Vector3(0.2, 0.6, -0.4), offsetEnd: new THREE.Vector3(0, 0.3, 0.4), spreadY: 2.0, spreadZ: 1.5, outerR: 0.26, innerR: 0.14 },
      { offsetStart: new THREE.Vector3(-0.2, -0.5, 0.4), offsetEnd: new THREE.Vector3(0, -0.3, -0.3), spreadY: 1.9, spreadZ: 1.4, outerR: 0.26, innerR: 0.14 },
    ];

    const mainPtsList = [];
    for (const cfg of boltConfigs) {
      const pFrom = sPos.clone().add(cfg.offsetStart);
      const pTo = tPos.clone().add(cfg.offsetEnd);
      const pts = generateZigzagBolt(pFrom, pTo, 9, cfg.spreadY, cfg.spreadZ, cfg.outerR, cfg.innerR, crackleGroup);
      mainPtsList.push(pts);
    }

    // Chaotic secondary crackling arcs branching off
    for (let b = 0; b < 6; b++) {
      const randomMain = mainPtsList[Math.floor(Math.random() * mainPtsList.length)];
      if (!randomMain || randomMain.length < 4) continue;
      const forkIdx = 2 + Math.floor(Math.random() * (randomMain.length - 4));
      const forkOrigin = randomMain[forkIdx].clone();
      const branchDir = new THREE.Vector3(
        (Math.random() - 0.5) * 2.5 - 1.0,
        (Math.random() - 0.5) * 2.8,
        (Math.random() - 0.5) * 2.5
      );
      const forkMid = forkOrigin.clone().add(branchDir);
      const forkEnd = forkMid.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        (Math.random() - 0.5) * 1.8,
        (Math.random() - 0.5) * 1.5
      ));

      addCylinderSegment(forkOrigin, forkMid, 0.14, secondaryMat, crackleGroup);
      addCylinderSegment(forkMid, forkEnd, 0.09, secondaryMat, crackleGroup);
    }

    // Sparks at target during attack
    if (Math.random() < 0.75) {
      const spk = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.24, 0.24),
        new THREE.MeshBasicMaterial({ color: Math.random() > 0.4 ? 0x00f0ff : 0xffffff })
      );
      spk.position.set(
        tPos.x + (Math.random() - 0.5) * 0.8,
        tPos.y + (Math.random() - 0.5) * 1.0,
        tPos.z + (Math.random() - 0.5) * 0.8
      );
      sceneRef.add(spk);
      particles.push({
        mesh: spk,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 5, (Math.random() - 0.5) * 5),
        life: 0.35,
        maxLife: 0.35,
      });
    }
  };

  // Initial build
  rebuildBarrage();

  // Charred scorch mark on floor helper
  const spawnScorchMark = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');

      const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 60);
      grad.addColorStop(0.0, 'rgba(10, 10, 15, 0.95)');
      grad.addColorStop(0.4, 'rgba(25, 20, 30, 0.85)');
      grad.addColorStop(0.8, 'rgba(40, 35, 45, 0.45)');
      grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(64, 64, 60, 0, Math.PI * 2);
      ctx.fill();

      // Jagged radial charred fractures
      ctx.strokeStyle = 'rgba(10, 10, 15, 0.9)';
      ctx.lineWidth = 3;
      for (let a = 0; a < 14; a++) {
        const ang = (a / 14) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
        const len = 35 + Math.random() * 25;
        ctx.beginPath();
        ctx.moveTo(64, 64);
        ctx.lineTo(64 + Math.cos(ang) * len, 64 + Math.sin(ang) * len);
        ctx.stroke();
      }

      const scorchTex = new THREE.CanvasTexture(canvas);
      const scorchGeo = new THREE.PlaneGeometry(3.0, 3.0);
      scorchGeo.rotateX(-Math.PI / 2);
      const scorchMat = new THREE.MeshBasicMaterial({
        map: scorchTex,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
      });
      const scorchMesh = new THREE.Mesh(scorchGeo, scorchMat);
      scorchMesh.position.set(tPos.x, 0.035, tPos.z);
      sceneRef.add(scorchMesh);

      // Linger for 3.5s then fade out
      setTimeout(() => {
        let fadeT = 0;
        const fadeInt = setInterval(() => {
          fadeT += 0.05;
          if (scorchMesh && scorchMat) {
            scorchMat.opacity = Math.max(0, 0.88 * (1.0 - fadeT));
          }
          if (fadeT >= 1.0) {
            clearInterval(fadeInt);
            if (sceneRef) sceneRef.remove(scorchMesh);
            scorchGeo.dispose();
            scorchMat.dispose();
            scorchTex.dispose();
          }
        }, 50);
      }, 2500);
    } catch (e) {
      console.warn('[spawnScorchMark] err', e);
    }
  };

  let elapsed = 0;
  let impactFired = false;
  const tickInterval = 40;
  const interval = setInterval(() => {
    elapsed += tickInterval;

    if (elapsed >= 80 && !impactFired) {
      impactFired = true;
      if (onImpact) onImpact();
      triggerShake(0.55, 0.4);
      screenFlash('rgba(56, 189, 248, 0.45)', 0.25);
      try { (Audio.playHeavyThunder || Audio.playThunder)?.(); } catch (e) {}
      spawnScorchMark();
    }

    rebuildBarrage();

    if (elapsed >= duration) {
      clearInterval(interval);
      if (sceneRef) sceneRef.remove(beamGroup);
      while (crackleGroup.children.length > 0) {
        const c = crackleGroup.children[0];
        crackleGroup.remove(c);
        if (c.geometry) c.geometry.dispose();
      }
      activeGeometries.forEach(g => g.dispose());
      activeMaterials.forEach(m => m.dispose());
      activeLights.forEach(l => l.dispose?.());
    }
  }, tickInterval);
}

// ─────────────────────────────────────────────────────────────────────────────
// ❄️ FROST BOSS: ICE SPIKE GROUND WAVE
// ─────────────────────────────────────────────────────────────────────────────
export function spawnBossFrostSpikeWave(startPos, targetPos, duration = 480, onImpact) {
  if (typeof duration === 'function') {
    onImpact = duration;
    duration = 480;
  }
  if (!sceneRef) { if (onImpact) onImpact(); return; }

  const sPos = startPos || new THREE.Vector3(4.3, 0.05, 0);
  const tPos = targetPos || new THREE.Vector3(-4.5, 0.05, 0);
  const segments = 14;
  const dx = (tPos.x - sPos.x) / segments;
  const dz = (tPos.z - sPos.z) / segments;
  const stepDelay = duration / segments;
  const allMeshes = [];
  let impactFired = false;

  for (let i = 0; i <= segments; i++) {
    const delay = i * stepDelay;
    setTimeout(() => {
      if (!sceneRef) return;
      const x = sPos.x + dx * i;
      const z = sPos.z + dz * i + (Math.random() - 0.5) * 0.35;
      const progress = i / segments;

      // 1. Frosty ground trail segment
      const trailGeo = new THREE.PlaneGeometry(Math.abs(dx) * 1.4, 0.9 + progress * 0.6);
      trailGeo.rotateX(-Math.PI / 2);
      const trailMat = new THREE.MeshBasicMaterial({
        color: 0x93c5fd,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const trailSeg = new THREE.Mesh(trailGeo, trailMat);
      trailSeg.position.set(x, 0.04, z);
      sceneRef.add(trailSeg);
      allMeshes.push(trailSeg);

      // 2. Jagged icicle spike thrusting upward out of the floor
      const spikeH = 1.6 + Math.random() * 0.8 + (progress > 0.8 ? 0.8 : 0);
      const spikeR = 0.28 + Math.random() * 0.12;
      const spikeGeo = new THREE.ConeGeometry(spikeR, spikeH, 4);
      spikeGeo.translate(0, spikeH / 2, 0);
      const spikeMat = new THREE.MeshStandardMaterial({
        color: 0x93c5fd,
        emissive: 0x00d4ff,
        emissiveIntensity: 0.85,
        roughness: 0.1,
        metalness: 0.2,
        transparent: true,
        opacity: 0.92,
      });
      const spike = new THREE.Mesh(spikeGeo, spikeMat);
      spike.position.set(x, -0.6, z);
      spike.rotation.y = Math.random() * Math.PI;
      spike.rotation.z = (Math.random() - 0.5) * 0.25;
      sceneRef.add(spike);
      allMeshes.push(spike);

      // Rapid upward thrust
      let thrustT = 0;
      const thrustInt = setInterval(() => {
        thrustT += 0.25;
        spike.position.y = THREE.MathUtils.lerp(-0.6, 0.0, Math.min(1.0, thrustT));
        if (thrustT >= 1.0) clearInterval(thrustInt);
      }, 16);

      // 3. Rising cold mist particles
      for (let p = 0; p < 2; p++) {
        const mist = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.18, 0.18),
          new THREE.MeshBasicMaterial({ color: 0xccf2ff, transparent: true, opacity: 0.8 })
        );
        mist.position.set(x + (Math.random() - 0.5) * 0.4, 0.2, z + (Math.random() - 0.5) * 0.4);
        sceneRef.add(mist);
        particles.push({
          mesh: mist,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 0.6, 1.2 + Math.random() * 1.5, (Math.random() - 0.5) * 0.6),
          life: 0.5,
          maxLife: 0.5
        });
      }

      // Reaching player endpoint
      if (i === segments && !impactFired) {
        impactFired = true;
        if (onImpact) onImpact();
        triggerShake(0.45, 0.35);
        try { (Audio.playIceShatter || Audio.playFrost)?.(); } catch (e) {}

        // Shatter burst on impact
        for (let s = 0; s < 16; s++) {
          const shard = new THREE.Mesh(
            new THREE.BoxGeometry(0.2, 0.2, 0.2),
            new THREE.MeshBasicMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.9 })
          );
          shard.position.set(tPos.x + (Math.random() - 0.5) * 0.8, 1.0 + Math.random() * 1.2, tPos.z + (Math.random() - 0.5) * 0.8);
          sceneRef.add(shard);
          particles.push({
            mesh: shard,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 5, 2 + Math.random() * 4, (Math.random() - 0.5) * 5),
            life: 0.45,
            maxLife: 0.45
          });
        }
      }
    }, delay);
  }

  // Cleanup lingering frost after 1.4s
  setTimeout(() => {
    allMeshes.forEach(m => {
      if (sceneRef) sceneRef.remove(m);
      if (m.geometry) m.geometry.dispose();
      if (m.material) m.material.dispose();
    });
  }, duration + 1400);
}

export const spawnBossFrostTrailAndSpikes = spawnBossFrostSpikeWave;

// ─────────────────────────────────────────────────────────────────────────────
// 🔥 FIRE BOSS: MOLTEN FLAME GROUND WAVE
// ─────────────────────────────────────────────────────────────────────────────
export function spawnBossMoltenFlameWave(startPos, targetPos, duration = 480, onImpact) {
  if (typeof duration === 'function') {
    onImpact = duration;
    duration = 480;
  }
  if (!sceneRef) { if (onImpact) onImpact(); return; }

  const sPos = startPos || new THREE.Vector3(4.3, 0.05, 0);
  const tPos = targetPos || new THREE.Vector3(-4.5, 0.05, 0);
  const segments = 14;
  const dx = (tPos.x - sPos.x) / segments;
  const dz = (tPos.z - sPos.z) / segments;
  const stepDelay = duration / segments;
  const allMeshes = [];
  const allGeos = [];
  const allMats = [];
  const allTextures = [];
  const allLights = [];
  let impactFired = false;

  // 1. Procedural Billboard Flame Texture (billowing fire tongues)
  const flameCanvas = document.createElement('canvas');
  flameCanvas.width = 128;
  flameCanvas.height = 256;
  const flameCtx = flameCanvas.getContext('2d');
  const flameGrad = flameCtx.createLinearGradient(0, 256, 0, 0);
  flameGrad.addColorStop(0.0, 'rgba(255, 255, 220, 0.98)'); // Core white-hot
  flameGrad.addColorStop(0.18, 'rgba(255, 190, 40, 0.95)'); // Yellow
  flameGrad.addColorStop(0.45, 'rgba(255, 80, 0, 0.88)');  // Intense fire orange
  flameGrad.addColorStop(0.72, 'rgba(210, 20, 0, 0.65)');  // Deep crimson
  flameGrad.addColorStop(0.92, 'rgba(120, 0, 0, 0.25)');   // Dissipating tip
  flameGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');       // Top transparent
  flameCtx.fillStyle = flameGrad;
  flameCtx.fillRect(0, 0, 128, 256);

  flameCtx.fillStyle = 'rgba(255, 255, 180, 0.9)';
  for (let i = 0; i < 18; i++) {
    const fx = 20 + Math.random() * 88;
    const fw = 8 + Math.random() * 16;
    const fh = 120 + Math.random() * 110;
    flameCtx.beginPath();
    flameCtx.moveTo(fx - fw / 2, 256);
    flameCtx.quadraticCurveTo(fx + (Math.random() - 0.5) * 30, 256 - fh * 0.55, fx, 256 - fh);
    flameCtx.quadraticCurveTo(fx + (Math.random() - 0.5) * 30, 256 - fh * 0.55, fx + fw / 2, 256);
    flameCtx.fill();
  }
  const flameTex = new THREE.CanvasTexture(flameCanvas);
  allTextures.push(flameTex);

  // 2. Procedural Lava Fissure Texture for the arena floor
  const fissureCanvas = document.createElement('canvas');
  fissureCanvas.width = 256;
  fissureCanvas.height = 128;
  const fisCtx = fissureCanvas.getContext('2d');
  fisCtx.fillStyle = 'rgba(25, 6, 2, 0.92)';
  fisCtx.fillRect(0, 0, 256, 128);

  // Molten glowing crack
  fisCtx.strokeStyle = 'rgba(255, 60, 0, 0.9)';
  fisCtx.lineWidth = 14;
  fisCtx.shadowColor = '#ff4400';
  fisCtx.shadowBlur = 16;
  fisCtx.beginPath();
  let fcy = 64;
  fisCtx.moveTo(0, fcy);
  for (let fx = 15; fx <= 256; fx += 20) {
    fcy = 64 + Math.sin(fx * 0.08) * 16 + (Math.random() - 0.5) * 10;
    fisCtx.lineTo(fx, fcy);
  }
  fisCtx.stroke();

  // White-hot molten core
  fisCtx.strokeStyle = 'rgba(255, 235, 100, 0.98)';
  fisCtx.lineWidth = 4;
  fisCtx.shadowColor = '#ffee66';
  fisCtx.shadowBlur = 8;
  fisCtx.stroke();

  const fissureTex = new THREE.CanvasTexture(fissureCanvas);
  allTextures.push(fissureTex);

  // Shared Materials
  const flameQuadMat = new THREE.MeshBasicMaterial({
    map: flameTex,
    color: 0xff4500,
    transparent: true,
    opacity: 0.92,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  allMats.push(flameQuadMat);

  const flameCoreMat = new THREE.MeshBasicMaterial({
    map: flameTex,
    color: 0xffd700,
    transparent: true,
    opacity: 0.98,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  allMats.push(flameCoreMat);

  const fissureMat = new THREE.MeshBasicMaterial({
    map: fissureTex,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  allMats.push(fissureMat);

  for (let i = 0; i <= segments; i++) {
    const delay = i * stepDelay;
    setTimeout(() => {
      if (!sceneRef) return;
      const x = sPos.x + dx * i;
      const z = sPos.z + dz * i + (Math.random() - 0.5) * 0.35;
      const progress = i / segments;

      // 1. Intense floor lava fissure: emissive molten red-orange crack
      const fissGeo = new THREE.PlaneGeometry(Math.abs(dx) * 1.5, 1.4 + progress * 0.6);
      fissGeo.rotateX(-Math.PI / 2);
      allGeos.push(fissGeo);
      const fissMesh = new THREE.Mesh(fissGeo, fissureMat);
      fissMesh.position.set(x, 0.038, z);
      sceneRef.add(fissMesh);
      allMeshes.push(fissMesh);

      // 2. Fluid, roaring flame geyser (Layered vertical flame billboards/quads)
      const geyserGroup = new THREE.Group();
      geyserGroup.position.set(x, 0.0, z);

      const baseH = 2.6 + Math.random() * 1.2 + (progress > 0.8 ? 1.0 : 0);
      const baseW = 1.4 + Math.random() * 0.5;

      // 3 crossed vertical flame quads at 0, 60, and 120 degrees
      const angles = [0, Math.PI / 3, (Math.PI * 2) / 3];
      angles.forEach((angle) => {
        const qGeo = new THREE.PlaneGeometry(baseW, baseH);
        qGeo.translate(0, baseH / 2, 0);
        allGeos.push(qGeo);
        const qMesh = new THREE.Mesh(qGeo, flameQuadMat);
        qMesh.rotation.y = angle + (Math.random() - 0.5) * 0.2;
        geyserGroup.add(qMesh);
      });

      // 4th inner core quad (golden yellow)
      const coreGeo = new THREE.PlaneGeometry(baseW * 0.7, baseH * 0.8);
      coreGeo.translate(0, (baseH * 0.8) / 2, 0);
      allGeos.push(coreGeo);
      const coreMesh = new THREE.Mesh(coreGeo, flameCoreMat);
      coreMesh.rotation.y = Math.PI / 4;
      geyserGroup.add(coreMesh);

      // Initial compact scale
      geyserGroup.scale.set(0.3, 0.08, 0.3);
      sceneRef.add(geyserGroup);
      allMeshes.push(geyserGroup);

      // Point light on eruption
      const pLight = new THREE.PointLight(0xff4500, 3.5, 7);
      pLight.position.set(x, 1.2, z);
      sceneRef.add(pLight);
      allLights.push(pLight);

      // Turbulent upward scaling and fluid vortex rotation
      let eruptTime = 0;
      const maxEruptTime = 0.55;
      const eruptInterval = setInterval(() => {
        eruptTime += 0.032;
        const p = Math.min(1.0, eruptTime / 0.18); // Rapid rise in 180ms
        const scaleY = THREE.MathUtils.lerp(0.08, 1.15, p) + Math.sin(eruptTime * 25) * 0.08;
        const scaleXZ = THREE.MathUtils.lerp(0.3, 1.0, p);
        geyserGroup.scale.set(scaleXZ, scaleY, scaleXZ);
        geyserGroup.rotation.y += 0.09; // Fluid vortex spin

        if (eruptTime >= maxEruptTime) {
          clearInterval(eruptInterval);
        }
      }, 32);

      // 3. Swarms of rising embers, turbulent dark smoke plumes, and fiery sparks swirling upward
      // Rising embers
      for (let p = 0; p < 4; p++) {
        const ember = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.18, 0.18),
          new THREE.MeshBasicMaterial({ color: Math.random() > 0.4 ? 0xffaa00 : 0xff3b00, transparent: true, opacity: 0.9 })
        );
        ember.position.set(x + (Math.random() - 0.5) * 0.5, 0.2, z + (Math.random() - 0.5) * 0.5);
        sceneRef.add(ember);
        particles.push({
          mesh: ember,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 1.5, 3.2 + Math.random() * 3.5, (Math.random() - 0.5) * 1.5),
          life: 0.65,
          maxLife: 0.65,
        });
      }

      // Turbulent dark smoke plumes
      for (let s = 0; s < 2; s++) {
        const smoke = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.35, 0.35),
          new THREE.MeshBasicMaterial({ color: 0x221111, transparent: true, opacity: 0.45, depthWrite: false })
        );
        smoke.position.set(x + (Math.random() - 0.5) * 0.4, 1.8 + Math.random() * 0.8, z + (Math.random() - 0.5) * 0.4);
        sceneRef.add(smoke);
        particles.push({
          mesh: smoke,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.8 + Math.random() * 1.5, (Math.random() - 0.5) * 0.8),
          life: 0.8,
          maxLife: 0.8,
        });
      }

      // Fiery sparks
      for (let sp = 0; sp < 2; sp++) {
        const spark = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.12, 0.12),
          new THREE.MeshBasicMaterial({ color: 0xffdd44 })
        );
        spark.position.set(x, 0.5, z);
        sceneRef.add(spark);
        particles.push({
          mesh: spark,
          velocity: new THREE.Vector3((Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4),
          life: 0.4,
          maxLife: 0.4,
        });
      }

      // Reaching player endpoint
      if (i === segments && !impactFired) {
        impactFired = true;
        if (onImpact) onImpact();
        triggerShake(0.55, 0.4);
        try { Audio.playFire?.(); } catch (e) {}

        // Fire explosion burst
        for (let s = 0; s < 24; s++) {
          const flamePuff = new THREE.Mesh(
            new THREE.BoxGeometry(0.25, 0.25, 0.25),
            new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xff3b00 : 0xffcc00, transparent: true, opacity: 0.9 })
          );
          flamePuff.position.set(tPos.x + (Math.random() - 0.5) * 0.9, 0.8 + Math.random() * 1.4, tPos.z + (Math.random() - 0.5) * 0.9);
          sceneRef.add(flamePuff);
          particles.push({
            mesh: flamePuff,
            velocity: new THREE.Vector3((Math.random() - 0.5) * 6, 2.5 + Math.random() * 4.5, (Math.random() - 0.5) * 6),
            life: 0.55,
            maxLife: 0.55,
          });
        }
      }
    }, delay);
  }

  // Cleanup lingering ground fire and all resources after duration + 1400ms
  setTimeout(() => {
    allMeshes.forEach(m => {
      if (sceneRef) sceneRef.remove(m);
    });
    allLights.forEach(l => {
      if (sceneRef) sceneRef.remove(l);
      l.dispose?.();
    });
    allGeos.forEach(g => g.dispose());
    allMats.forEach(m => m.dispose());
    allTextures.forEach(t => t.dispose());
  }, duration + 1400);
}

export const spawnBossMeteorShower = spawnBossMoltenFlameWave;

// ─────────────────────────────────────────────────────────────────────────────
// 💥 FULL-BODY PLAYER DAMAGE VFX UPON GETTING HIT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fire Boss Impact: Wrap player's entire body in raging flames for 1.2s (BURNING!)
 */
export function triggerPlayerFireImpact(playerPos) {
  if (!sceneRef) return;
  const p = playerPos || new THREE.Vector3(-4.5, 0, 0);

  const group = new THREE.Group();
  group.position.set(p.x, p.y + 1.6, p.z);

  // Outer blazing flame pillar
  const flameGeo = new THREE.CylinderGeometry(0.9, 1.15, 3.4, 16, 4, true);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0xff3b00,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const flamePillar = new THREE.Mesh(flameGeo, flameMat);
  group.add(flamePillar);

  // Inner core yellow flame cylinder
  const innerGeo = new THREE.CylinderGeometry(0.65, 0.85, 3.1, 12, 4, true);
  const innerMat = new THREE.MeshBasicMaterial({
    color: 0xffd700,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const innerPillar = new THREE.Mesh(innerGeo, innerMat);
  group.add(innerPillar);

  sceneRef.add(group);

  // Status pop & shake
  spawnDamageNumber(new THREE.Vector3(p.x, p.y + 3.4, p.z), '🔥 BURNING!', '#ff4500', 34);
  triggerShake(0.35, 0.45);
  screenFlash('rgba(255, 60, 0, 0.4)', 0.35);
  try { Audio.playFire?.(); } catch (e) {}

  // Spawn rising embers around player throughout 1.2s
  let emberCount = 0;
  const emberInterval = setInterval(() => {
    if (!sceneRef || emberCount > 24) {
      clearInterval(emberInterval);
      return;
    }
    emberCount++;
    const ember = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.2, 0.2),
      new THREE.MeshBasicMaterial({ color: Math.random() > 0.4 ? 0xff4500 : 0xffd700, transparent: true, opacity: 0.9 })
    );
    const angle = Math.random() * Math.PI * 2;
    const r = 0.4 + Math.random() * 0.7;
    ember.position.set(p.x + Math.cos(angle) * r, p.y + 0.2 + Math.random() * 0.5, p.z + Math.sin(angle) * r);
    sceneRef.add(ember);
    particles.push({
      mesh: ember,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.8, 2.2 + Math.random() * 2.0, (Math.random() - 0.5) * 0.8),
      life: 0.4,
      maxLife: 0.4
    });
  }, 45);

  // Animate pillar wobble
  let aliveTime = 0;
  const animInterval = setInterval(() => {
    aliveTime += 0.03;
    const vib = 1.0 + Math.sin(aliveTime * 28) * 0.08;
    flamePillar.scale.set(vib, 1.0 + Math.sin(aliveTime * 18) * 0.04, vib);
    flamePillar.rotation.y += 0.08;
    innerPillar.rotation.y -= 0.1;
    if (aliveTime >= 1.2) {
      clearInterval(animInterval);
      if (sceneRef) sceneRef.remove(group);
      flameGeo.dispose();
      flameMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
    }
  }, 30);
}

/**
 * Frost Boss Impact: Encase player in a full-body translucent jagged ice block (color: 0x67e8f9, opacity: 0.85)
 */
export function triggerPlayerFrostImpact(playerPos) {
  if (!sceneRef) return;
  const p = playerPos || new THREE.Vector3(-4.5, 0, 0);

  const group = new THREE.Group();
  group.position.set(p.x, p.y + 1.6, p.z);

  // Translucent jagged ice block
  const iceGeo = new THREE.BoxGeometry(1.6, 3.4, 1.6);
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x00b4d8,
    emissiveIntensity: 0.6,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const iceBlock = new THREE.Mesh(iceGeo, iceMat);
  group.add(iceBlock);

  // Jagged icicle spikes jutting diagonally out of ice block
  for (let s of [-1, 1]) {
    const spkGeo = new THREE.ConeGeometry(0.28, 1.4, 4);
    spkGeo.translate(0, 0.7, 0);
    const spkMat = iceMat.clone();
    const spkMesh = new THREE.Mesh(spkGeo, spkMat);
    spkMesh.position.set(s * 0.85, (s > 0 ? 0.4 : -0.3), 0);
    spkMesh.rotation.z = s * -1.1;
    group.add(spkMesh);
  }

  sceneRef.add(group);

  // Status pop & shake
  spawnDamageNumber(new THREE.Vector3(p.x, p.y + 3.4, p.z), '❄️ FROSTBITE!', '#67e8f9', 34);
  triggerShake(0.35, 0.45);
  screenFlash('rgba(103, 232, 249, 0.4)', 0.35);
  try { (Audio.playIceShatter || Audio.playFrost)?.(); } catch (e) {}

  // Frost mist swirling around character
  let mistCount = 0;
  const mistInterval = setInterval(() => {
    if (!sceneRef || mistCount > 18) {
      clearInterval(mistInterval);
      return;
    }
    mistCount++;
    const mist = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.18),
      new THREE.MeshBasicMaterial({ color: 0xccf2ff, transparent: true, opacity: 0.8 })
    );
    const angle = Math.random() * Math.PI * 2;
    const r = 0.5 + Math.random() * 0.6;
    mist.position.set(p.x + Math.cos(angle) * r, p.y + 0.3 + Math.random() * 1.8, p.z + Math.sin(angle) * r);
    sceneRef.add(mist);
    particles.push({
      mesh: mist,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.8 + Math.random() * 1.2, (Math.random() - 0.5) * 0.4),
      life: 0.5,
      maxLife: 0.5
    });
  }, 50);

  // Shatter after 1.2s
  setTimeout(() => {
    if (sceneRef) sceneRef.remove(group);
    group.traverse(c => {
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    });
    try { Audio.playIceShatter?.(); } catch (e) {}

    // Shattering fragments explosion
    for (let s = 0; s < 22; s++) {
      const frag = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.22, 0.22),
        new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.85 })
      );
      frag.position.set(p.x + (Math.random() - 0.5) * 1.2, p.y + 0.5 + Math.random() * 2.2, p.z + (Math.random() - 0.5) * 1.2);
      sceneRef.add(frag);
      particles.push({
        mesh: frag,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, (Math.random() - 0.5) * 6),
        life: 0.5,
        maxLife: 0.5
      });
    }
  }, 1200);
}

/**
 * Thunder Boss Impact: Dramatic high-voltage lightning strike down from sky onto player with neon explosion
 */
export function triggerPlayerThunderImpact(playerPos) {
  if (!sceneRef) return;
  const p = playerPos || new THREE.Vector3(-4.5, 0, 0);

  // High-voltage lightning strike down from y=18
  const startY = 18;
  const endY = p.y + 1.5;
  const segs = 10;
  const lineGeom = new THREE.BufferGeometry();
  const linePos = new Float32Array(segs * 2 * 3);
  let curY = startY;
  const dy = (endY - startY) / segs;
  let curX = p.x;
  let curZ = p.z;

  for (let i = 0; i < segs; i++) {
    linePos[i * 6]     = curX;
    linePos[i * 6 + 1] = curY;
    linePos[i * 6 + 2] = curZ;

    const nextY = (i === segs - 1) ? endY : curY + dy;
    const nextX = (i === segs - 1) ? p.x : p.x + (Math.random() - 0.5) * 1.2;
    const nextZ = (i === segs - 1) ? p.z : p.z + (Math.random() - 0.5) * 1.2;

    linePos[i * 6 + 3] = nextX;
    linePos[i * 6 + 4] = nextY;
    linePos[i * 6 + 5] = nextZ;

    curX = nextX;
    curY = nextY;
    curZ = nextZ;
  }
  lineGeom.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x88ffff,
    linewidth: 3,
    transparent: true,
    opacity: 0.95,
  });
  const lightningLine = new THREE.LineSegments(lineGeom, lineMat);
  sceneRef.add(lightningLine);

  // Electric shockwave ring on floor
  const ringGeo = new THREE.RingGeometry(0.3, 2.4, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.set(p.x, 0.05, p.z);
  sceneRef.add(ring);

  // Status pop & shake
  spawnDamageNumber(new THREE.Vector3(p.x, p.y + 3.4, p.z), '⚡ SHOCKED!', '#00ffff', 34);
  triggerShake(0.45, 0.45);
  screenFlash('rgba(200, 245, 255, 0.7)', 0.35);
  try { Audio.playThunder?.(); } catch (e) {}

  // Electric sparks radiating outward
  for (let i = 0; i < 24; i++) {
    const spark = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.18),
      new THREE.MeshBasicMaterial({ color: Math.random() > 0.4 ? 0x00ffff : 0xffffff, transparent: true, opacity: 0.95 })
    );
    spark.position.set(p.x, p.y + 1.2, p.z);
    sceneRef.add(spark);
    particles.push({
      mesh: spark,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 4, (Math.random() - 0.5) * 7),
      life: 0.45,
      maxLife: 0.45
    });
  }

  // Flash line & expand ring
  let flashT = 0;
  const flashInt = setInterval(() => {
    flashT += 0.15;
    lightningLine.visible = (Math.random() > 0.3);
    ring.scale.set(1 + flashT * 1.5, 1, 1 + flashT * 1.5);
    ringMat.opacity = Math.max(0, 0.9 - flashT * 0.9);
    if (flashT >= 1.0) {
      clearInterval(flashInt);
      if (sceneRef) {
        sceneRef.remove(lightningLine);
        sceneRef.remove(ring);
      }
      lineGeom.dispose();
      lineMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    }
  }, 35);
}

/**
 * Dispatcher: triggers full-body player damage VFX matching boss element
 */
export function triggerPlayerHitVFX(bossElement, playerPos) {
  const el = (bossElement || 'thunder').toLowerCase();
  if (el === 'fire') {
    triggerPlayerFireImpact(playerPos);
  } else if (el === 'frost') {
    triggerPlayerFrostImpact(playerPos);
  } else {
    triggerPlayerThunderImpact(playerPos);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 💀 3 UNIQUE ELEMENTAL BOSS DEATH VFX
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ❄️ FROST BOSS DEATH: 25-35 crystalline ice shard meshes scattering outward
 * with high velocity, gravity, and tumbling rotation over 1.2s.
 */
export function spawnIceShardsExplosion(pos) {
  if (!sceneRef) return;
  const count = 32;
  const cols = [0xa0e8ff, 0xd0f0ff, 0xffffff, 0x80d4ff];
  for (let i = 0; i < count; i++) {
    const size = 0.35 + Math.random() * 0.45;
    const geo = new THREE.TetrahedronGeometry(size, 0);
    const mat = new THREE.MeshLambertMaterial({
      color: cols[i % cols.length],
      emissive: 0x00e5ff,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.95,
      roughness: 0.1,
    });
    const shard = new THREE.Mesh(geo, mat);
    shard.position.set(
      pos.x + (Math.random() - 0.5) * 1.5,
      pos.y + (Math.random() - 0.5) * 2.5,
      pos.z + (Math.random() - 0.5) * 1.5
    );
    sceneRef.add(shard);

    const sp = 6 + Math.random() * 10;
    const angle = Math.random() * Math.PI * 2;
    particles.push({
      mesh: shard,
      velocity: new THREE.Vector3(
        Math.cos(angle) * sp,
        3 + Math.random() * 9,
        Math.sin(angle) * sp
      ),
      rotVel: new THREE.Vector3(
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 16
      ),
      life: 1.2,
      maxLife: 1.2,
    });
  }
}

/**
 * 🔥 FIRE BOSS DEATH (Phase 1): Swirling tornado vortex of fire wrapping around Boss
 */
export function spawnFireVortexAroundBoss(centerPos) {
  if (!sceneRef) return;
  const cols = [0xff2200, 0xff6600, 0xffcc00];
  for (let i = 0; i < 40; i++) {
    const delay = i * 15;
    setTimeout(() => {
      if (!sceneRef) return;
      const angle = Math.random() * Math.PI * 2;
      const r = 1.4 + Math.random() * 1.2;
      const geo = new THREE.BoxGeometry(0.35, 0.55, 0.35);
      const mat = new THREE.MeshBasicMaterial({
        color: cols[Math.floor(Math.random() * cols.length)],
        transparent: true,
        opacity: 0.95
      });
      const m = new THREE.Mesh(geo, mat);
      m.position.set(
        centerPos.x + Math.cos(angle) * r,
        centerPos.y - 1.5 + Math.random() * 1.0,
        centerPos.z + Math.sin(angle) * r
      );
      sceneRef.add(m);

      particles.push({
        mesh: m,
        velocity: new THREE.Vector3(
          -Math.sin(angle) * 7,
          6 + Math.random() * 5,
          Math.cos(angle) * 7
        ),
        rotVel: new THREE.Vector3(5, 5, 0),
        life: 0.6,
        maxLife: 0.6
      });
    }, delay);
  }
}

/**
 * 🔥 FIRE BOSS DEATH (Phase 2): Big spherical explosion burst & expanding shockwave ring
 */
export function spawnFireExplosionBurst(centerPos) {
  if (!sceneRef) return;
  // Expanding shockwave ring
  const ringGeo = new THREE.RingGeometry(0.5, 1.2, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff6600,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(centerPos.x, 0.2, centerPos.z);
  sceneRef.add(ring);
  particles.push({
    mesh: ring,
    isRing: true,
    life: 0.7,
    maxLife: 0.7,
  });

  // Spherical explosion burst
  const cols = [0xff1100, 0xff4400, 0xffaa00, 0xffffff, 0x333333];
  for (let i = 0; i < 45; i++) {
    const size = 0.3 + Math.random() * 0.4;
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshBasicMaterial({
      color: cols[Math.floor(Math.random() * cols.length)],
      transparent: true,
      opacity: 0.95
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.copy(centerPos);
    sceneRef.add(m);

    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const sp = 7 + Math.random() * 11;
    particles.push({
      mesh: m,
      velocity: new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta) * sp,
        Math.cos(phi) * sp * 0.8 + 2.0,
        Math.sin(phi) * Math.sin(theta) * sp
      ),
      rotVel: new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10),
      life: 0.9,
      maxLife: 0.9
    });
  }
}

/**
 * ⚡ THUNDER BOSS DEATH (Phase 2): Gigantic vertical thunderbolt from sky
 */
export function spawnSkyThunderbolt(targetPos) {
  if (!sceneRef) return;
  const startPos = new THREE.Vector3(targetPos.x, 32, targetPos.z);
  const segments = 16;
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const x = startPos.x + (targetPos.x - startPos.x) * t + (i > 0 && i < segments ? (Math.random() - 0.5) * 1.5 : 0);
    const y = startPos.y + (targetPos.y - startPos.y) * t;
    const z = startPos.z + (targetPos.z - startPos.z) * t + (i > 0 && i < segments ? (Math.random() - 0.5) * 1.5 : 0);
    pts.push(x, y, z);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts), 3));
  const mat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 4 });
  const bolt = new THREE.Line(geo, mat);
  sceneRef.add(bolt);

  const pLight = new THREE.PointLight(0x00ffff, 4, 25);
  pLight.position.set(targetPos.x, targetPos.y + 2, targetPos.z);
  sceneRef.add(pLight);

  setTimeout(() => {
    if (sceneRef) {
      sceneRef.remove(bolt);
      sceneRef.remove(pLight);
    }
    geo.dispose();
    mat.dispose();
    pLight.dispose();
  }, 250);
}

/**
 * ⚡ THUNDER BOSS DEATH (Phase 3): Dark electric sparks and smoke bursting outward
 */
export function spawnCharredBurst(pos) {
  if (!sceneRef) return;
  const cols = [0x111111, 0x222222, 0x00ffff, 0xffff00, 0x333333];
  for (let i = 0; i < 35; i++) {
    const geo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
    const mat = new THREE.MeshBasicMaterial({
      color: cols[Math.floor(Math.random() * cols.length)],
      transparent: true,
      opacity: 0.9
    });
    const m = new THREE.Mesh(geo, mat);
    m.position.set(
      pos.x + (Math.random() - 0.5) * 1.5,
      pos.y + (Math.random() - 0.5) * 2.0,
      pos.z + (Math.random() - 0.5) * 1.5
    );
    sceneRef.add(m);

    const angle = Math.random() * Math.PI * 2;
    const sp = 4 + Math.random() * 8;
    particles.push({
      mesh: m,
      velocity: new THREE.Vector3(
        Math.cos(angle) * sp,
        2 + Math.random() * 6,
        Math.sin(angle) * sp
      ),
      life: 0.8,
      maxLife: 0.8
    });
  }
}

/**
 * Crackling electric sparks around target
 */
export function triggerElectricSparks(pos) {
  if (!sceneRef) return;
  for (let i = 0; i < 8; i++) {
    const spk = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, 0.15),
      new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x00ffff : 0xffff00 })
    );
    spk.position.set(
      pos.x + (Math.random() - 0.5) * 1.8,
      pos.y + (Math.random() - 0.5) * 2.2,
      pos.z + (Math.random() - 0.5) * 1.8
    );
    sceneRef.add(spk);
    particles.push({
      mesh: spk,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3),
      life: 0.25,
      maxLife: 0.25
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy
// ─────────────────────────────────────────────────────────────────────────────
export function punishWrong() {
  triggerShake(0.3, 0.35);
  screenFlash('rgba(255,0,0,0.35)', 0.35);
}

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE
// ─────────────────────────────────────────────────────────────────────────────
export function update(deltaTime) {
  for (let i = particles.length-1; i >= 0; i--) {
    const p = particles[i];
    p.life -= deltaTime;
    if (p.life <= 0) {
      sceneRef.remove(p.mesh);
      if (p.mesh.geometry) p.mesh.geometry.dispose();
      if (p.mesh.material) p.mesh.material.dispose();
      particles.splice(i,1);
      continue;
    }
    const frac = p.life / p.maxLife;

    // Apply tumbling rotation if defined
    if (p.rotVel) {
      p.mesh.rotation.x += p.rotVel.x * deltaTime;
      p.mesh.rotation.y += p.rotVel.y * deltaTime;
      p.mesh.rotation.z += p.rotVel.z * deltaTime;
    }

    if (p.isRing) {
      const t = 1-frac;
      const s = 1+t*3.5;
      p.mesh.scale.set(s,s,s);
      if (p.mesh.material) p.mesh.material.opacity = frac*0.85;
    } else if (p.isLine) {
      if (p.mesh.material) p.mesh.material.opacity = frac;
      if (Math.random()<0.45) p.mesh.visible = !p.mesh.visible;
    } else if (p.frozenSpike) {
      // Spike just stays visible until it shatters
      if (p.mesh.material) p.mesh.material.opacity = frac;
    } else {
      p.velocity.y -= 18*deltaTime;
      p.mesh.position.addScaledVector(p.velocity, deltaTime);
      if (p.mesh.material) { p.mesh.material.opacity = frac; p.mesh.material.transparent = true; }
    }
  }

  // Camera shake (relative jitter that decays smoothly without corrupting camera position)
  if (shakeTime > 0 && cameraRef) {
    shakeTime -= deltaTime;
    const factor = Math.max(0, shakeTime);
    cameraRef.position.x += (Math.random() - 0.5) * 1.2 * shakeMagnitude * factor;
    cameraRef.position.y += (Math.random() - 0.5) * 1.2 * shakeMagnitude * factor;
  }
}

