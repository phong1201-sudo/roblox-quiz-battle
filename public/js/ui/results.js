import { socket } from '../socket.js';
import * as effects from '../game/effects.js';

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
        document.getElementById('reward-modal-close')?.addEventListener('click', () => {
            modal.style.display = 'none';
        });
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

    // Remove old PvP winner div if any
    const oldWinner = document.querySelector('.pvp-winner');
    if (oldWinner) oldWinner.remove();

    if (data.mode === 'pvp' && data.winner) {
        const winnerDiv = document.createElement('div');
        winnerDiv.className = 'pvp-winner';
        winnerDiv.innerHTML = `🏆 <span>${data.winner.name}</span> WINS! (${data.winner.hp} HP left)`;
        document.getElementById('screen-results')?.prepend(winnerDiv);
    }

    const btnPlayAgain = document.getElementById('btn-play-again');
    if (btnPlayAgain) {
        btnPlayAgain.onclick = () => {
            socket.emit('join_room', {
                code: gameState.code,
                playerName: gameState.myName,
                color: gameState.myColor
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
