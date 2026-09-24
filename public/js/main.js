import { socket, on, emit } from './socket.js';
import * as Auth   from './auth.js';
import * as lobby  from './ui/lobby.js';
import * as hud    from './ui/hud.js';
import * as results from './ui/results.js';
import * as scene  from './game/scene.js';

// ─── Track whether Three.js scene has been initialised yet ───────────────────
let sceneReady = false;

export function showScreen(name) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${name}`);
    if (target) target.classList.add('active');
}

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
    return {
        ...base,
        userId:       user?.id       || null,
        username:     user?.username || base.myName,
        role:         user?.role     || 'player',
        unlockedSets: user?.unlockedSets || [],
    };
}

document.addEventListener('DOMContentLoaded', () => {

    // ── Always activate menu screen first — auth modal overlays it ───────────
    showScreen('menu');

    // ── Auth gate — show login modal unless session is restored ───────────────
    const alreadyLoggedIn = Auth.init();
    if (!alreadyLoggedIn) {
        Auth.showAuthModal();
    }

    // When the user logs in (including auto-restore), ensure menu is visible
    window.addEventListener('auth:login', (e) => {
        const user = e.detail;
        // Pre-fill name field with authenticated username
        const nameInput = document.getElementById('player-name');
        if (nameInput && user.username) nameInput.value = user.username;
        // God Father flag driven purely by server role
        window._godFather = (user.role === 'admin');
        // CRITICAL: make sure menu screen is active after auth modal closes
        showScreen('menu');
    });

    // ── Menu buttons ──────────────────────────────────────────────────────────
    const btnCreate = document.getElementById('btn-create');
    btnCreate.addEventListener('click', () => {
        const user = Auth.getCurrentUser();
        if (!user) { Auth.showAuthModal(); return; }

        const playerName = user.username;   // always use auth username
        const color      = document.getElementById('player-color').value;

        // God Father flag from server role — no localStorage
        window._godFather = (user.role === 'admin');

        emit('create_room', { playerName, color, userId: user.id });
    });

    const btnJoinScreen = document.getElementById('btn-join-screen');
    btnJoinScreen.addEventListener('click', () => {
        if (!Auth.getCurrentUser()) { Auth.showAuthModal(); return; }
        showScreen('join');
    });

    const btnJoinRoom = document.getElementById('btn-join-room');
    btnJoinRoom.addEventListener('click', () => {
        const user = Auth.getCurrentUser();
        if (!user) { Auth.showAuthModal(); return; }
        const code = document.getElementById('room-code-input').value.trim().toUpperCase();
        if (code.length !== 4) { alert('Room code must be 4 characters'); return; }
        const color = document.getElementById('player-color').value;
        emit('join_room', { code, playerName: user.username, color, userId: user.id });
    });

    const btnBackJoin = document.getElementById('btn-back-join');
    btnBackJoin.addEventListener('click', () => showScreen('menu'));

    // ── Socket events ─────────────────────────────────────────────────────────
    on('connect', () => { window.myId = socket.id; });

    on('room_created', (data) => {
        const myColor = document.getElementById('player-color').value;
        const user    = Auth.getCurrentUser();
        window.gameState = makeGameState({
            myId: socket.id, myName: user?.username || '?', myColor,
            code: data.code, players: data.players,
            hostId: data.hostId, isHost: true,
            mode: 'pve', totalHp: 10,
        });
        if (lobby.init) lobby.init(window.gameState);
        showScreen('lobby');
    });

    on('room_joined', (data) => {
        const myColor = document.getElementById('player-color').value;
        const user    = Auth.getCurrentUser();
        window.gameState = makeGameState({
            myId: socket.id, myName: user?.username || '?', myColor,
            code: data.code, players: data.players,
            hostId: data.hostId, isHost: false,
            mode: 'pve', totalHp: 10,
        });
        if (lobby.init) lobby.init(window.gameState);
        showScreen('lobby');
    });

    on('player_joined', (data) => { if (lobby.updatePlayers) lobby.updatePlayers(data.players); });
    on('player_left',   (data) => { if (lobby.updatePlayers) lobby.updatePlayers(data.players); });

    on('game_started', () => {
        showScreen('game');
        requestAnimationFrame(() => {
            ensureSceneInit();
            if (hud.init)        hud.init(window.gameState);
            if (scene.startGame) scene.startGame(window.gameState);
        });
    });

    on('question', (data) => {
        if (hud.showQuestion)  hud.showQuestion(data);
        if (scene.onQuestion)  scene.onQuestion(data);
    });

    on('answer_result', (data) => {
        if (hud.showResult)       hud.showResult(data);
        if (scene.onAnswerResult) scene.onAnswerResult(data);
    });

    on('game_over', (data) => {
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

        showScreen('results');
        if (results.init) results.init(data, window.gameState);
    });

    on('player_moved', (data) => { if (scene.onPlayerMoved) scene.onPlayerMoved(data); });
    on('error',        (data) => { alert(data.message); });

    on('game_mode_set', (data) => {
        if (window.gameState) {
            window.gameState.mode      = data.mode;
            window.gameState.totalHp   = data.totalHp;
            window.gameState.bossIndex = data.bossIndex ?? 0;
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
