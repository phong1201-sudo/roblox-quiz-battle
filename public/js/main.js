import { socket, on, emit } from './socket.js';
import * as Auth   from './auth.js';
import * as lobby  from './ui/lobby.js';
import * as hud    from './ui/hud.js';
import * as results from './ui/results.js';
import * as scene  from './game/scene.js';
import * as Audio  from './audio.js';
import * as Multiplayer from './multiplayer.js';
import { initSplashScreen } from './splash.js';
import { initBgmSelector } from './ui/bgmSelector.js';
import * as Armory from './armory.js';

// ─── Track whether Three.js scene has been initialised yet ───────────────────
let sceneReady = false;

export function showScreen(name) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${name}`);
    if (target) target.classList.add('active');
}
window.showScreen = showScreen;

// ─── Lazy-init Three.js scene AFTER #screen-game is visible ──────────────────
function ensureSceneInit() {
    if (sceneReady) return;
    sceneReady = true;
    const canvas = document.getElementById('game-canvas');
    if (canvas && scene.initScene) scene.initScene(canvas);
}

// ─── Build / merge gameState with current auth user ───────────────────────────
function makeGameState(base) {
    const user = Auth.getCurrentUser();
    let equipped = { outfit: 'default', weapon: 'default' };
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlOutfit = urlParams.get('outfit');
        const urlElement = urlParams.get('element');
        if (urlElement) {
            base.bossElement = urlElement;
        }
        if (urlOutfit) {
            equipped = { outfit: urlOutfit, weapon: urlOutfit };
            try {
                localStorage.setItem('player_equipped', JSON.stringify(equipped));
                sessionStorage.setItem('selectedOutfit', urlOutfit);
                localStorage.setItem('selectedOutfit', urlOutfit);
            } catch (e) {}
        } else {
            const savedOutfit = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('selectedOutfit'))
                || (typeof localStorage !== 'undefined' && localStorage.getItem('selectedOutfit'));
            if (savedOutfit) {
                equipped = { outfit: savedOutfit, weapon: savedOutfit };
                try {
                    sessionStorage.setItem('selectedOutfit', savedOutfit);
                    localStorage.setItem('selectedOutfit', savedOutfit);
                } catch (e) {}
            } else {
                const saved = JSON.parse(localStorage.getItem('player_equipped'));
                if (saved) {
                    equipped = { outfit: saved.outfit || 'default', weapon: saved.weapon || 'default' };
                    try {
                        sessionStorage.setItem('selectedOutfit', equipped.outfit);
                        localStorage.setItem('selectedOutfit', equipped.outfit);
                    } catch (e) {}
                }
            }
        }
    } catch(e) {}

    const isFullSet = (equipped.outfit === equipped.weapon && equipped.outfit !== 'default');

    return {
        ...base,
        userId:       user?.id       || null,
        username:     user?.username || base.myName,
        role:         user?.role     || 'player',
        unlockedSets: user?.unlockedSets || [],
        inventory:    user?.inventory || { thunder: [], fire: [], frost: [] },
        equipped,
        equipment:    { ...equipped },
        equippedSet:  isFullSet ? equipped.outfit : (user?.equippedSet || null),
        thunderSet:   isFullSet && equipped.outfit === 'thunder',
        damagePerHit: isFullSet ? 2 : 1,
    };
}

document.addEventListener('DOMContentLoaded', () => {

    // ── Sync URL outfit params to storage if present ─────────────────────────
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlOutfit = urlParams.get('outfit');
        if (urlOutfit) {
            const clean = urlOutfit.toLowerCase().trim();
            if (['default', 'thunder', 'fire', 'frost'].includes(clean)) {
                sessionStorage.setItem('selectedOutfit', clean);
                localStorage.setItem('selectedOutfit', clean);
                localStorage.setItem('player_equipped', JSON.stringify({ outfit: clean, weapon: clean }));
            }
        }
    } catch(e) {}

    // ── Audio: mount toggle button + register first-interaction bootstrap ──
    Audio.mountAudioToggle();
    Audio.bootstrapOnInteraction();
    initBgmSelector();
    Armory.bindArmoryModalEvents();

    // ── Always activate menu screen first — auth modal overlays it ───────────
    try {
        sessionStorage.removeItem('hostedRoomCode');
        localStorage.removeItem('hostedRoomCode');
    } catch(e) {}
    Multiplayer.cancelHosting();
    showScreen('menu');

    // ── Dismiss initial app loading screen smoothly ───────────────────────────
    const loadingScreen = document.getElementById('app-loading-screen');
    if (loadingScreen) {
        loadingScreen.style.opacity = '0';
        loadingScreen.style.transition = 'opacity 0.3s ease';
        setTimeout(() => {
            try { loadingScreen.remove(); } catch(e) {}
        }, 350);
    }

    // ── Sync active question bank from server ────────────────────────────────
    function syncActiveQuestions() {
        fetch('/api/questions/active')
            .then(r => r.json())
            .then(data => {
                if (data && data.success) {
                    window.activeQuestionBank = data.bank;
                    console.log(`[QuestionBank] Active questions synced: ${data.total} questions loaded across ${Object.keys(data.bank || {}).length} elements`);
                }
            })
            .catch(err => console.warn('[QuestionBank] Could not fetch active questions:', err));
    }
    syncActiveQuestions();

    // ── Auth session restore in background ────────────────────────────────────
    Auth.init();

    // ── Epic Splash Intro Screen (Roblox vs Monster) with Tap-to-Start ───────
    initSplashScreen(() => {
        const user = Auth.getCurrentUser();
        try {
            sessionStorage.removeItem('hostedRoomCode');
            localStorage.removeItem('hostedRoomCode');
        } catch(e) {}
        Multiplayer.cancelHosting();

        if (!user) {
            Auth.showAuthModal();
        } else {
            showScreen('menu');
            try { Audio.playBGM('lobby'); } catch(e) {}
        }
    });

    // When the user logs in (including auto-restore), ensure menu is visible
    window.addEventListener('auth:login', (e) => {
        const user = e.detail;
        // Pre-fill name field with authenticated username
        const nameInput = document.getElementById('player-name');
        if (nameInput && user.username) nameInput.value = user.username;
        // God Father flag driven purely by server role
        window._godFather = (user.role === 'admin');

        // Clear any leftover room code upon login/menu entry
        try {
            sessionStorage.removeItem('hostedRoomCode');
            localStorage.removeItem('hostedRoomCode');
        } catch(e) {}
        Multiplayer.cancelHosting();
        if (window.gameState) {
            window.gameState.code = null;
            window.gameState.isHost = false;
        }

        // CRITICAL: make sure menu screen is active after auth modal closes
        showScreen('menu');
        // Start lobby music now that we have a user interaction (login click)
        try { Audio.playBGM('lobby'); } catch(e) {}
        // Sync questions on login
        syncActiveQuestions();
    });

    // ── Primary Navigation: Single Player vs Multiplayer Hub ────────────────
    const btnModeSingle = document.getElementById('btn-mode-single');
    if (btnModeSingle) {
        btnModeSingle.addEventListener('click', () => {
            const user = Auth.getCurrentUser();
            if (!user) { Auth.showAuthModal(); return; }

            const myColor = document.getElementById('player-color')?.value || '#ff6b35';
            window.gameState = makeGameState({
                myId: 'single_player',
                myName: user.username,
                myColor,
                code: null,
                isHost: true,
                isSinglePlayer: true,
                mode: 'single',
                totalHp: 50,
                stage: 'thunder',
                bossElement: 'thunder',
                players: [{
                    id: 'single_player',
                    name: user.username,
                    color: myColor,
                    hp: 50,
                    ready: true,
                }]
            });

            Multiplayer.cancelHosting();
            // Strictly unbind any old multiplayer combat listeners in single mode
            try {
                socket.off('damage_dealt');
                socket.off('combat_event');
                socket.off('hp_update');
                socket.off('question');
                socket.off('answer_result');
            } catch(e) {}

            if (lobby.init) lobby.init(window.gameState);
            showScreen('lobby');
            try { Audio.playBGM('lobby'); } catch(e) {}
        });
    }

    const btnModeMulti = document.getElementById('btn-mode-multi');
    if (btnModeMulti) {
        btnModeMulti.addEventListener('click', () => {
            if (!Auth.getCurrentUser()) { Auth.showAuthModal(); return; }
            showScreen('multi-hub');
        });
    }

    const btnHubCreate = document.getElementById('btn-hub-create');
    if (btnHubCreate) {
        btnHubCreate.addEventListener('click', () => {
            Multiplayer.createMultiplayerRoom({ mode: 'team_vs_boss', stage: 'thunder' });
        });
    }

    const btnHubJoin = document.getElementById('btn-hub-join');
    if (btnHubJoin) {
        btnHubJoin.addEventListener('click', () => {
            showScreen('join');
        });
    }

    const btnBackHub = document.getElementById('btn-back-hub');
    if (btnBackHub) {
        btnBackHub.addEventListener('click', () => {
            showScreen('menu');
        });
    }

    // ── Legacy menu buttons fallback ──────────────────────────────────────────
    const btnCreate = document.getElementById('btn-create');
    btnCreate?.addEventListener('click', () => {
        Multiplayer.createMultiplayerRoom({ mode: 'team_vs_boss', stage: 'thunder' });
    });

    const btnJoinScreen = document.getElementById('btn-join-screen');
    btnJoinScreen?.addEventListener('click', () => {
        if (!Auth.getCurrentUser()) { Auth.showAuthModal(); return; }
        showScreen('join');
    });

    const btnJoinRoom = document.getElementById('btn-join-room');
    btnJoinRoom?.addEventListener('click', () => {
        const code = document.getElementById('room-code-input').value.trim().toUpperCase();
        Multiplayer.joinMultiplayerRoom(code);
    });

    const btnBackJoin = document.getElementById('btn-back-join');
    btnBackJoin?.addEventListener('click', () => {
        Multiplayer.cancelHosting();
        showScreen('menu');
    });

    // ── Socket events ─────────────────────────────────────────────────────────
    on('connect', () => { window.myId = socket.id; });

    on('room_created', (data) => {
        const myColor = document.getElementById('player-color').value;
        const user    = Auth.getCurrentUser();
        window.gameState = makeGameState({
            myId: socket.id, myName: user?.username || '?', myColor,
            code: data.code, players: data.players,
            hostId: data.hostId, isHost: true,
            mode: data.mode || 'team_vs_boss', totalHp: 50,
            stage: data.stage || 'thunder', bossElement: data.stage || 'thunder',
        });
        if (lobby.init) lobby.init(window.gameState);
        showScreen('lobby');
        try { Audio.playBGM('lobby'); } catch(e) {}
    });

    on('room_joined', (data) => {
        const myColor = document.getElementById('player-color').value;
        const user    = Auth.getCurrentUser();
        window.gameState = makeGameState({
            myId: socket.id, myName: user?.username || '?', myColor,
            code: data.code, players: data.players,
            hostId: data.hostId, isHost: false,
            mode: data.mode || 'team_vs_boss', totalHp: 50,
            stage: data.stage || 'thunder', bossElement: data.stage || 'thunder',
        });
        if (lobby.init) lobby.init(window.gameState);
        showScreen('lobby');
        try { Audio.playBGM('lobby'); } catch(e) {}
    });

    on('player_joined', (data) => {
        if (window.gameState) window.gameState.players = data.players;
        if (lobby.updatePlayers) lobby.updatePlayers(data.players);
    });
    on('player_ready_changed', (data) => {
        if (window.gameState) window.gameState.players = data.players;
        if (lobby.updatePlayers) lobby.updatePlayers(data.players);
    });
    on('player_left',   (data) => {
        if (window.gameState) window.gameState.players = data.players;
        if (lobby.updatePlayers) lobby.updatePlayers(data.players);
    });

    on('game_started', () => {
        showScreen('game');
        Audio.setInBattle(true);
        requestAnimationFrame(() => {
            ensureSceneInit();
            if (hud.init)        hud.init(window.gameState);
            if (scene.startGame) scene.startGame(window.gameState);
        });
    });

    on('question', (data) => {
        if (scene.onQuestion) {
            scene.onQuestion(data);
        } else if (hud.showQuestion) {
            hud.showQuestion(data);
        }
    });

    on('answer_result', (data) => {
        if (hud.showResult)       hud.showResult(data);
        if (scene.onAnswerResult) scene.onAnswerResult(data);
    });

    on('game_over', (data) => {
        Audio.setInBattle(false);
        // ── Server already handled loot persistence — just sync client state ──
        const user = Auth.getCurrentUser();
        const myGrant = data.lootGrants?.find(g => g.playerId === socket.id);
        if (myGrant && user) {
            // Update local session inventory
            user.unlockedSets = myGrant.updatedUser?.unlockedSets || user.unlockedSets;
            user.inventory    = myGrant.updatedUser?.inventory    || user.inventory;
            try { sessionStorage.setItem('qb3d_user', JSON.stringify(user)); } catch(e) {}
            if (window.gameState) {
                window.gameState.unlockedSets = user.unlockedSets;
                window.gameState.inventory    = user.inventory;
            }
        }
        // Store element/difficulty in gameState for results screen
        if (window.gameState) {
            window.gameState.bossElement = data.element;
            window.gameState.difficulty  = data.difficulty;
        }

        const isVictory = (data.verdict !== 'DEFEAT' || data.mode === 'pvp');
        const showVictoryScreen = () => {
            // Stop battle BGM and play Victory fanfare once — DO NOT auto-chain to lobby
            try {
                Audio.stopBGM();
                if (isVictory) {
                    Audio.playBGM('victory');
                }
            } catch(e) {}

            showScreen('results');
            if (results.init) results.init(data, window.gameState);
        };

        // Only display the Victory Modal (Play Again / Next Boss) AFTER the boss death animation has completed (~1.5s delay)
        if (isVictory) {
            setTimeout(showVictoryScreen, 1500);
        } else {
            showVictoryScreen();
        }
    });

    on('player_moved', (data) => { if (scene.onPlayerMoved) scene.onPlayerMoved(data); });
    on('error',        (data) => { alert(data.message); });

    on('game_mode_set', (data) => {
        if (window.gameState) {
            window.gameState.mode      = data.mode;
            window.gameState.totalHp   = data.totalHp;
            window.gameState.bossIndex = data.bossIndex ?? 0;
            // Derive bossElement from bossIndex so BGM can pick the right track
            const BOSS_ELEMENTS = ['thunder', 'fire', 'frost'];
            window.gameState.bossElement = data.bossElement || data.element || BOSS_ELEMENTS[data.bossIndex] || 'thunder';

            window.gameState.testGear = data.testGear;
            const isFull = data.testGear === 'full' || ['thunder', 'fire', 'frost'].includes(data.testGear);
            const activeSet = data.equippedSet || (['thunder', 'fire', 'frost'].includes(data.testGear) ? data.testGear : null);

            if (activeSet || data.equippedSet !== undefined || isFull) {
                window.gameState.equippedSet = activeSet;
                if (!window.gameState.inventory) window.gameState.inventory = {};
                if (isFull && activeSet) {
                    window.gameState.inventory[activeSet] = ['weapon', 'outfit'];
                    window.gameState.hasFullSet = true;
                    window.gameState.damagePerHit = 2;
                } else if (data.testGear === 'normal') {
                    if (activeSet) window.gameState.inventory[activeSet] = [];
                    window.gameState.hasFullSet = false;
                    window.gameState.damagePerHit = 1;
                }
            }
        }
    });


    on('combat_event', (data) => { if (scene.onCombatEvent) scene.onCombatEvent(data); });

    on('hp_update', (data) => {
        if (hud.updateHpBars)  hud.updateHpBars(data.hp, data.bossHp);
        if (scene.onHpUpdate)  scene.onHpUpdate(data);
    });

    on('skin_uploaded', (data) => { if (scene.onSkinUploaded) scene.onSkinUploaded(data); });
    on('mode_changed',  (data) => { if (window.gameState) window.gameState.mode = data.mode; });
});
