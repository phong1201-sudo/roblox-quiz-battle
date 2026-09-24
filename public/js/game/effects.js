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
  shakeTime = duration; shakeMagnitude = magnitude;
  if (cameraRef) camBasePos = cameraRef.position.clone();
}

// ── Screen flash overlay ──────────────────────────────────────────────────────
function screenFlash(color, opacity) {
  const f = document.createElement('div');
  f.style.cssText = `position:fixed;inset:0;background:${color};opacity:${opacity};pointer-events:none;z-index:9000;transition:opacity 0.35s`;
  document.body.appendChild(f);
  requestAnimationFrame(()=>{ f.style.opacity='0'; setTimeout(()=>f.remove(),380); });
}

// ── Popup text banner ─────────────────────────────────────────────────────────
function showBanner(text, color, bg) {
  const b = document.createElement('div');
  b.textContent = text;
  b.style.cssText = `position:fixed;top:30%;left:50%;transform:translate(-50%,-50%);font-family:'Press Start 2P',monospace;font-size:28px;color:${color};background:${bg};padding:10px 22px;border-radius:8px;pointer-events:none;z-index:9100;text-shadow:0 0 12px ${color};animation:damageFloat 1.6s ease-out forwards;`;
  document.body.appendChild(b);
  setTimeout(()=>b.remove(),1700);
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
  showBanner('🔥 BURNING!', '#ff8800', 'rgba(80,10,0,0.85)');
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
  showBanner('❄️ FROZEN!', '#88ddff', 'rgba(0,20,50,0.9)');
  const dp = bossPosition.clone(); dp.y += 5;
  spawnDamageNumber(dp, damageText||'❄️ -2', '#88ddff', 30);
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

  // Camera shake
  if (shakeTime > 0 && cameraRef && camBasePos) {
    shakeTime -= deltaTime;
    if (shakeTime > 0) {
      cameraRef.position.x = camBasePos.x+(Math.random()-0.5)*2*shakeMagnitude;
      cameraRef.position.y = camBasePos.y+(Math.random()-0.5)*2*shakeMagnitude;
    } else {
      cameraRef.position.copy(camBasePos);
    }
  }
}
