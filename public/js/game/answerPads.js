let pads = {};
let sceneRef;

export function initAnswerPads(scene) {
    sceneRef = scene;
    const configs = [
        { id: 'A', x: 0, z: -14, color: 0xe74c3c },
        { id: 'B', x: 14, z: 0, color: 0x2980b9 },
        { id: 'C', x: 0, z: 14, color: 0x27ae60 },
        { id: 'D', x: -14, z: 0, color: 0xf39c12 }
    ];
    
    configs.forEach(cfg => {
        const geo = new THREE.BoxGeometry(8, 0.3, 8);
        const mat = new THREE.MeshLambertMaterial({ color: cfg.color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(cfg.x, 0.15, cfg.z);
        scene.add(mesh);
        
        pads[cfg.id] = { mesh, color: cfg.color, x: cfg.x, z: cfg.z };
        
        const canvas = document.createElement('canvas');
        canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(cfg.id, 64, 64);
        
        const tex = new THREE.CanvasTexture(canvas);
        const labelGeo = new THREE.PlaneGeometry(6, 6);
        const labelMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        const labelMesh = new THREE.Mesh(labelGeo, labelMat);
        labelMesh.rotation.x = -Math.PI / 2;
        labelMesh.position.y = 0.16;
        mesh.add(labelMesh);
    });
}

export function reset() {
    Object.values(pads).forEach(p => {
        p.mesh.material.color.setHex(p.color);
        p.mesh.material.emissive.setHex(0x000000);
    });
}

export function showResult(correctAnswer) {
    Object.entries(pads).forEach(([id, p]) => {
        if (id === correctAnswer) {
            p.mesh.material.emissive.setHex(p.color);
        } else {
            p.mesh.material.color.setHex(0x555555);
        }
    });
}

export function checkProximity(playerPosition) {
    let nearest = null;
    let minDist = 4;
    
    Object.entries(pads).forEach(([id, p]) => {
        const dist = Math.hypot(playerPosition.x - p.x, playerPosition.z - p.z);
        if (dist < minDist) {
            minDist = dist;
            nearest = id;
            p.mesh.material.emissive.setHex(0x333333);
        } else {
            p.mesh.material.emissive.setHex(0x000000);
        }
    });
    
    return nearest;
}
