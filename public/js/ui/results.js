import { socket } from '../socket.js';
import * as effects from '../game/effects.js';
import * as hud from './hud.js';
import * as scene from '../game/scene.js';
import * as Audio from '../audio.js';

export function resetGameMatch() {
    const modal = document.getElementById('reward-modal');
    if (modal) modal.style.display = 'none';

    if (hud.resetHudState) hud.resetHudState();
    if (scene.resetGameMatch) scene.resetGameMatch();
}

export function init(data, gameState) {
    const verdictBanner = document.getElementById('verdict-banner');
    if (verdictBanner && data.mode === 'pve') {
        verdictBanner.textContent = data.verdict || 'GAME OVER';
        verdictBanner.className = 'verdict-banner verdict-' + (data.verdict || 'defeat').toLowerCase();
        verdictBanner.style.display = 'block';
    } else if (verdictBanner) {
        verdictBanner.style.display = 'none';
    }

    if (data.verdict === 'PERFECT') {
        const modal = document.getElementById('reward-modal');
        if (modal) modal.style.display = 'flex';
        const closeBtn = document.getElementById('reward-modal-close');
        if (closeBtn) {
            closeBtn.onclick = () => {
                modal.style.display = 'none';
                try {
                    Audio.stopBGM();
                    Audio.playVictory();
                } catch (e) {}
            };
        }
        // Extra confetti
        for (let i = 0; i < 5; i++) {
            setTimeout(() => effects.celebrateCorrect && effects.celebrateCorrect(), i * 300);
        }
    }

    // Build sorted player list by HP descending
    const playersList = gameState.players.map(p => ({
        ...p,
        hp: data.hp?.[p.id] ?? 0
    })).sort((a, b) => b.hp - a.hp);

    const podiumContainer = document.getElementById('podium');
    const leaderboardBody = document.getElementById('leaderboard-body');
    
    if (podiumContainer) {
        podiumContainer.innerHTML = '';
        const top3 = playersList.slice(0, 3);
        
        // Classic podium order: 2nd, 1st, 3rd
        const order = [1, 0, 2];
        order.forEach(index => {
            if (top3[index]) {
                const p = top3[index];
                const block = document.createElement('div');
                block.className = `podium-block rank-${index + 1}`;
                block.innerHTML = `
                    <div class="rank-num">${index + 1}</div>
                    <div class="player-name">${p.name}</div>
                    <div class="player-score">${p.hp} HP</div>
                `;
                block.style.backgroundColor = p.color;
                podiumContainer.appendChild(block);
            }
        });
    }

    if (leaderboardBody) {
        leaderboardBody.innerHTML = '';
        playersList.forEach((p, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td style="color: ${p.color}">${p.name}</td>
                <td>${p.hp}</td>
            `;
            leaderboardBody.appendChild(tr);
        });
    }

    // Remove old PvP / MVP winner divs if any
    const oldWinner = document.querySelector('.pvp-winner');
    if (oldWinner) oldWinner.remove();
    const oldMvp = document.querySelector('.mvp-banner');
    if (oldMvp) oldMvp.remove();

    const isPvP = (data.mode === 'pvp_1v1' || data.mode === 'pvp');
    if (isPvP && data.winner) {
        const winnerDiv = document.createElement('div');
        winnerDiv.className = 'pvp-winner';
        winnerDiv.innerHTML = `🏆 CHIẾN THẮNG 1V1: <span>${data.winner.name}</span> (${data.winner.hp} HP còn lại)`;
        document.getElementById('screen-results')?.prepend(winnerDiv);
    } else if (!isPvP && data.mvp) {
        const mvpDiv = document.createElement('div');
        mvpDiv.className = 'mvp-banner pvp-winner';
        mvpDiv.style.borderColor = '#00cfff';
        mvpDiv.style.background = 'rgba(0, 207, 255, 0.15)';
        mvpDiv.innerHTML = `👑 MVP CHIẾN ĐỘI: <span style="color:#00cfff; font-weight:800;">${data.mvp.name}</span> — <b>${data.mvp.score} Điểm</b> <span style="font-size:10px; color:#aaa;">(${data.mvp.correct} câu đúng • ${data.mvp.remainingHp} HP)</span>`;
        document.getElementById('screen-results')?.prepend(mvpDiv);
    }

    // ── 🔁 Play Again: Re-initialize match with current element and question set cleanly ──
    const btnPlayAgain = document.getElementById('btn-play-again');
    if (btnPlayAgain) {
        btnPlayAgain.onclick = () => {
            resetGameMatch();
            const currentEl = window.gameState?.bossElement || 'thunder';
            const diff      = window.gameState?.difficulty  || 'medium';
            const testGear  = window.gameState?.testGear    || null;

            if (window.gameState?.isSinglePlayer) {
                window.startSinglePlayerMatch?.({
                    bossElement: currentEl,
                    difficulty: diff,
                    outfit: window.gameState?.equipped?.outfit
                });
                return;
            }

            socket.emit('start_game', {
                code: window.gameState.code,
                element: currentEl,
                difficulty: diff,
                testGear
            });
        };
    }

    // ── ➡️ Next Boss: Switch element in line (thunder -> fire -> frost -> thunder) ──
    const btnNextBoss = document.getElementById('btn-next-boss');
    if (btnNextBoss) {
        btnNextBoss.onclick = () => {
            resetGameMatch();
            const BOSS_CYCLE = ['thunder', 'fire', 'frost'];
            const currentEl  = window.gameState?.bossElement || 'thunder';
            const curIdx     = BOSS_CYCLE.indexOf(currentEl);
            const nextIdx    = (curIdx >= 0 ? curIdx + 1 : 0) % BOSS_CYCLE.length;
            const nextEl     = BOSS_CYCLE[nextIdx];

            window.gameState.bossElement = nextEl;
            const diff     = window.gameState?.difficulty || 'medium';
            const testGear = window.gameState?.testGear ? nextEl : null;

            if (window.gameState?.isSinglePlayer) {
                window.startSinglePlayerMatch?.({
                    bossElement: nextEl,
                    difficulty: diff,
                    outfit: window.gameState?.equipped?.outfit
                });
                return;
            }

            socket.emit('start_game', {
                code: window.gameState.code,
                element: nextEl,
                difficulty: diff,
                testGear
            });
        };
    }

    const btnBackMenu = document.getElementById('btn-back-menu-results');
    if (btnBackMenu) {
        btnBackMenu.onclick = () => {
            window.location.reload();
        };
    }

    if (data.verdict !== 'DEFEAT' || data.mode === 'pvp') {
        setTimeout(() => effects.celebrateCorrect?.(), 100);
        setTimeout(() => effects.celebrateCorrect?.(), 600);
        setTimeout(() => effects.celebrateCorrect?.(), 1200);
    }
}
