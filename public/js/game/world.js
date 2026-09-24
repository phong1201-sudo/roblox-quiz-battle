export function initWorld(scene) {
  // ─── Stage floor ──────────────────────────────────────────────────────────
  const stageMat = new THREE.MeshLambertMaterial({ color: 0x2a1a0a }); // dark wood
  const floor = new THREE.Mesh(new THREE.BoxGeometry(16, 0.8, 7), stageMat);
  floor.position.set(0, -0.4, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  // Gold trim border
  const trimMat = new THREE.MeshLambertMaterial({ color: 0xb8860b });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(16.4, 0.18, 7.4), trimMat);
  trim.position.set(0, 0.06, 0);
  scene.add(trim);

  // ─── Back wall ────────────────────────────────────────────────────────────
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x1a0a2e });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(18, 14, 0.5), wallMat);
  backWall.position.set(0, 6, -3.8);
  scene.add(backWall);

  // Decorative columns on back wall
  const colMat = new THREE.MeshLambertMaterial({ color: 0x3a1a5e });
  for (let x = -8; x <= 8; x += 4) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.55, 12, 0.28), colMat);
    col.position.set(x, 6, -3.6);
    scene.add(col);
  }

  // ─── Torches ─────────────────────────────────────────────────────────────
  const brazierMat = new THREE.MeshLambertMaterial({ color: 0x5a3a0a });
  const flameMat   = new THREE.MeshLambertMaterial({ color: 0xff6600 });
  const addTorch = (x) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.28, 2.4, 0.28), brazierMat);
    post.position.set(x, 1.2, -3.2); scene.add(post);
    const flame = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.55, 0.45), flameMat);
    flame.position.set(x, 2.65, -3.2); scene.add(flame);
    const light = new THREE.PointLight(0xff6600, 1.1, 8);
    light.position.set(x, 3.0, -2.8); scene.add(light);
  };
  // Torches flanking both fighters
  addTorch(-7); addTorch(-4); addTorch(4); addTorch(7);

  // ─── Audience voxel crowd ─────────────────────────────────────────────────
  const audColors = [0x2255aa, 0xaa2222, 0x22aa44, 0xaaaa22, 0x882288];
  const audMats   = audColors.map(c => new THREE.MeshLambertMaterial({ color: c }));
  for (let row = 0; row < 3; row++) {
    for (let col = -8; col <= 8; col += 2) {
      const mat  = audMats[Math.floor(Math.random() * audMats.length)];
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), mat);
      head.position.set(col+(Math.random()-0.5)*0.4, 1.4+row*1.1, -3.8-row*0.9);
      scene.add(head);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.1, 0.45), mat);
      body.position.set(col+(Math.random()-0.5)*0.4, 0.5+row*1.1, -3.8-row*0.9);
      scene.add(body);
    }
  }

  // ─── Side walls ───────────────────────────────────────────────────────────
  const sidewallMat = new THREE.MeshLambertMaterial({ color: 0x120820 });
  for (const s of [-1, 1]) {
    const sw = new THREE.Mesh(new THREE.BoxGeometry(0.4, 10, 8), sidewallMat);
    sw.position.set(s * 9, 5, 0);
    scene.add(sw);
  }

  // ─── Arena overhead light ─────────────────────────────────────────────────
  const arenaLight = new THREE.DirectionalLight(0xffd8b0, 0.45);
  arenaLight.position.set(0, 10, 5);
  scene.add(arenaLight);

  // Centre spot — highlights the arena floor between fighters
  const spotLight = new THREE.SpotLight(0xffffff, 0.8, 18, Math.PI/6, 0.5);
  spotLight.position.set(0, 12, 2);
  spotLight.target.position.set(0, 0, 0);
  scene.add(spotLight); scene.add(spotLight.target);
}
