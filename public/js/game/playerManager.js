// THREE is available as a global from the CDN script tag

let players = new Map();
let sceneRef;
let cameraRef;

export function initPlayerManager(scene, camera) {
    sceneRef = scene;
    cameraRef = camera;
}

export function addPlayer(playerData) {
    const playerGroup = new THREE.Group();
    playerGroup.position.set(playerData.position?.x || 0, playerData.position?.y || 1, playerData.position?.z || 0);
    
    const mat = new THREE.MeshLambertMaterial({ color: playerData.color || 0xcccccc });
    
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), mat);
    head.position.y = 1.3;
    
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1, 1.2, 0.5), mat);
    torso.position.y = 0.3;

    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1, 0.35), mat);
    leftArm.position.set(-0.7, 0.3, 0);

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1, 0.35), mat);
    rightArm.position.set(0.7, 0.3, 0);

    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 0.4), mat);
    leftLeg.position.set(-0.25, -0.8, 0);

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1, 0.4), mat);
    rightLeg.position.set(0.25, -0.8, 0);
    
    playerGroup.add(head);
    playerGroup.add(torso);
    playerGroup.add(leftArm);
    playerGroup.add(rightArm);
    playerGroup.add(leftLeg);
    playerGroup.add(rightLeg);
    
    sceneRef.add(playerGroup);
    
    const nameLabel = document.createElement('div');
    nameLabel.className = 'nametag';
    nameLabel.textContent = playerData.name || 'Player';
    nameLabel.style.position = 'absolute';
    nameLabel.style.background = 'rgba(0,0,0,0.5)';
    nameLabel.style.color = 'white';
    nameLabel.style.padding = '2px 5px';
    nameLabel.style.borderRadius = '3px';
    nameLabel.style.fontSize = '12px';
    nameLabel.style.pointerEvents = 'none';
    document.body.appendChild(nameLabel);
    
    players.set(playerData.id, {
        mesh: playerGroup,
        targetPos: playerGroup.position.clone(),
        targetRotY: playerData.rotation?.y || 0,
        nameLabel,
        animState: null,
        animTime: 0,
        animPhase: 'out',
        allMeshes: [head, torso, leftArm, rightArm, leftLeg, rightLeg],
        originalColors: [mat.color.getHex()],
        rightArm: rightArm,
        torso: torso,
        torsoMesh: torso,
        headMesh: head,
        dodgeDir: 1,
        hurtFlashTimer: 0
    });
}

export function removePlayer(playerId) {
    const p = players.get(playerId);
    if (p) {
        sceneRef.remove(p.mesh);
        p.nameLabel.remove();
        players.delete(playerId);
    }
}

export function updatePosition(data) {
    const p = players.get(data.playerId);
    if (p && data.position) {
        p.targetPos.set(data.position.x, data.position.y, data.position.z);
        if (data.rotation) p.targetRotY = data.rotation.y;
    }
}

export function playPunch(playerId) {
    const p = players.get(playerId);
    if (!p) return;
    if (p.animState === 'punch') return;
    p.animState = 'punch';
    p.animPhase = 'out';
    p.animTime = 0;
}

export function playHurt(playerId) {
    const p = players.get(playerId);
    if (!p) return;
    p.animState = 'hurt';
    p.animTime = 0;
    p.hurtFlashTimer = 0.25;
    p.allMeshes.forEach(m => {
        if(m.material && m.material.color) m.material.color.setHex(0xFF3333);
    });
}

export function playDodge(playerId) {
    const p = players.get(playerId);
    if (!p) return;
    p.animState = 'dodge';
    p.animTime = 0;
    p.dodgeDir = p.dodgeDir === 1 ? -1 : 1;
}

export function applySkin(playerId, skinUrl) {
    const p = players.get(playerId);
    if (!p) return;
    const loader = new THREE.TextureLoader();
    loader.load(
        skinUrl,
        (tex) => {
            const skinMat = new THREE.MeshLambertMaterial({
                map: tex,
                color: 0xffffff,
            });
            skinMat.needsUpdate = true;
            // Apply to torso and head meshes
            if (p.torsoMesh) {
                p.torsoMesh.material = skinMat;
                p.torsoMesh.material.needsUpdate = true;
            }
            if (p.headMesh) {
                p.headMesh.material = skinMat.clone();
                p.headMesh.material.needsUpdate = true;
            }
        },
        undefined,
        (err) => console.warn('[applySkin remote] failed', skinUrl, err)
    );
}

export function update(deltaTime) {
    players.forEach(p => {
        // Interpolate position and rotation
        p.mesh.position.lerp(p.targetPos, 0.15);
        
        let diff = p.targetRotY - p.mesh.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        p.mesh.rotation.y += diff * 0.15;
        
        // Process Animation State Machine
        if (p.animState === 'punch') {
            p.animTime += deltaTime;
            if (p.animPhase === 'out') {
                p.rightArm.rotation.x -= 8 * deltaTime;
                if (p.rightArm.rotation.x <= -Math.PI * 0.7) {
                    p.rightArm.rotation.x = -Math.PI * 0.7;
                    p.animPhase = 'return';
                }
            } else if (p.animPhase === 'return') {
                p.rightArm.rotation.x += 4 * deltaTime;
                if (p.rightArm.rotation.x >= 0) {
                    p.rightArm.rotation.x = 0;
                    p.animState = null;
                }
            }
        } else if (p.animState === 'hurt') {
            p.animTime += deltaTime;
            p.hurtFlashTimer -= deltaTime;
            
            if (p.hurtFlashTimer <= 0) {
                p.allMeshes.forEach(m => {
                    if(m.material && m.material.color) m.material.color.setHex(p.originalColors[0]);
                });
            }
            
            p.mesh.rotation.z = Math.sin(p.animTime * 40) * 0.15;
            
            if (p.animTime >= 0.3) {
                p.animState = null;
                p.mesh.rotation.z = 0;
                p.allMeshes.forEach(m => {
                    if(m.material && m.material.color) m.material.color.setHex(p.originalColors[0]);
                });
            }
        } else if (p.animState === 'dodge') {
            p.animTime += deltaTime;
            let speedX = 0;
            if (p.animTime < 0.15) {
                speedX = (2 / 0.15) * p.dodgeDir;
            } else if (p.animTime < 0.35) {
                speedX = (-2 / 0.2) * p.dodgeDir;
            } else {
                p.animState = null;
            }
            
            if (p.animState === 'dodge') {
                const dX = speedX * deltaTime;
                const localDodge = new THREE.Vector3(dX, 0, 0);
                localDodge.applyEuler(new THREE.Euler(0, p.mesh.rotation.y, 0));
                p.mesh.position.add(localDodge);
                // Also shift target pos so lerping doesn't fight it
                p.targetPos.add(localDodge);
            }
        } else {
            // Idle arms if no animation
            if (p.rightArm.rotation.x !== 0) {
                p.rightArm.rotation.x = 0;
            }
        }

        // Update Nametag Position
        if (cameraRef) {
            const pos = p.mesh.position.clone();
            pos.y += 2.5; // above head
            pos.project(cameraRef);
            
            const x = (pos.x * 0.5 + 0.5) * window.innerWidth;
            const y = (pos.y * -0.5 + 0.5) * window.innerHeight;
            
            if (pos.z < 1) {
                p.nameLabel.style.transform = `translate(-50%, -50%)`;
                p.nameLabel.style.left = `${x}px`;
                p.nameLabel.style.top = `${y}px`;
                p.nameLabel.style.display = 'block';
            } else {
                p.nameLabel.style.display = 'none';
            }
        }
    });
}
