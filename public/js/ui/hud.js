import { socket } from '../socket.js';
import { applyThunderSet, addUnlockedSet } from './lobby.js';
import * as Audio from '../audio.js';

let currentState;
let currentTimer = null;
let timerInterval = null;
let myAnswer = null;

// Helper: fade quiz card after answering
function collapseQuizCard() {
  const card = document.getElementById('quiz-card');
  if (card) card.classList.add('answered');
}
function restoreQuizCard() {
  const card = document.getElementById('quiz-card');
  if (card) card.classList.remove('answered');
}

// ── Module-level answer lock: prevents double submission within one question cycle ──
let _answerLock = false;

export function init(gameState) {
  currentState = gameState;
  myAnswer = null;
  _answerLock = false;
  restoreQuizCard();

  const buttons = ['A', 'B', 'C', 'D'];
  buttons.forEach(opt => {
    const btn = document.getElementById(`btn-answer-${opt.toLowerCase()}`);
    if (btn) {
      // Use .onclick (direct assignment) — guarantees exactly ONE handler, never stacks
      btn.onclick = () => {
        if (_answerLock || btn.disabled) return;   // guard: block any double-tap/race
        _answerLock = true;

        // Immediately freeze ALL buttons (pointer-events:none on entire container too)
        ['a','b','c','d'].forEach(l => {
          const b = document.getElementById(`btn-answer-${l}`);
          if (b) { b.style.pointerEvents = 'none'; b.disabled = true; }
        });
        const container = document.getElementById('answer-btns') || document.getElementById('quiz-options');
        if (container) container.style.pointerEvents = 'none';

        // Bootstrap BGM on first player interaction (browser autoplay policy)
        try { if (typeof Audio !== 'undefined' && Audio.startBgm) Audio.startBgm(); } catch(e) {}

        myAnswer = opt;
        socket.emit('submit_answer', { code: currentState.code, answer: opt });
        btn.classList.add('selected');
        collapseQuizCard();
      };
    }
  });

  initHpBars(gameState);
}


let visualBossHpPercent = 100;

function initHpBars(gameState) {
  const isTeam = (gameState.mode === 'team_vs_boss' || gameState.mode === 'pve');
  const isPvP = (gameState.mode === 'pvp_1v1' || gameState.mode === 'pvp');
  const players = gameState.players || [];
  const p1 = players[0] || { name: gameState.myName, id: gameState.myId };
  const p2 = players[1] || null;

  const totalHp = gameState.totalHp || 50;

  // Setup Player 1
  const labelP1 = document.getElementById('hp-label-player');
  const valP1   = document.getElementById('hp-val-player');
  const fillP1  = document.getElementById('hp-fill-player');
  if (labelP1) labelP1.textContent = p1.name || 'PLAYER 1';
  if (valP1)   valP1.textContent = `${totalHp}/${totalHp}`;
  if (fillP1)  { fillP1.style.width = '100%'; fillP1.style.backgroundColor = '#06d6a0'; }

  // Elements for Mode Switching
  const barP2Team = document.getElementById('hp-bar-player2-team');
  const barEnemy  = document.getElementById('hp-bar-enemy');
  const barP2PvP  = document.getElementById('hp-bar-player2-pvp');
  const vsBadge   = document.getElementById('hp-vs-badge') || document.querySelector('.hp-vs');

  if (isPvP) {
    // ⚔️ 1v1 PvP Mode
    if (barP2Team) barP2Team.style.display = 'none';
    if (barEnemy)  barEnemy.style.display = 'none';
    if (barP2PvP)  barP2PvP.style.display = 'flex';
    if (vsBadge)   vsBadge.style.display = 'block';

    const labelP2PvP = document.getElementById('hp-label-player2-pvp');
    const valP2PvP   = document.getElementById('hp-val-player2-pvp');
    const fillP2PvP  = document.getElementById('hp-fill-player2-pvp');
    if (labelP2PvP) labelP2PvP.textContent = p2 ? p2.name : 'PLAYER 2';
    if (valP2PvP)   valP2PvP.textContent = `${totalHp}/${totalHp}`;
    if (fillP2PvP)  { fillP2PvP.style.width = '100%'; fillP2PvP.style.backgroundColor = '#ef233c'; }
  } else if (isTeam && p2) {
    // 👥 Team vs Boss Mode (Stacked 2 players on left)
    if (barP2Team) barP2Team.style.display = 'flex';
    if (barEnemy)  barEnemy.style.display = 'flex';
    if (barP2PvP)  barP2PvP.style.display = 'none';
    if (vsBadge)   vsBadge.style.display = 'block';

    const labelP2Team = document.getElementById('hp-label-player2-team');
    const valP2Team   = document.getElementById('hp-val-player2-team');
    const fillP2Team  = document.getElementById('hp-fill-player2-team');
    if (labelP2Team) labelP2Team.textContent = p2.name || 'PLAYER 2';
    if (valP2Team)   valP2Team.textContent = `${totalHp}/${totalHp}`;
    if (fillP2Team)  { fillP2Team.style.width = '100%'; fillP2Team.style.backgroundColor = '#00cfff'; }

    // Boss Bar
    const labelEnemy = document.getElementById('hp-label-enemy');
    const valEnemy   = document.getElementById('hp-val-enemy');
    const fillEnemy  = document.getElementById('hp-fill-enemy');
    if (labelEnemy) labelEnemy.textContent = 'BOSS';
    if (valEnemy)   valEnemy.textContent = '';
    if (fillEnemy)  { fillEnemy.style.width = '100%'; fillEnemy.style.backgroundColor = '#ef233c'; }
  } else {
    // Single player vs Boss
    if (barP2Team) barP2Team.style.display = 'none';
    if (barEnemy)  barEnemy.style.display = 'flex';
    if (barP2PvP)  barP2PvP.style.display = 'none';
    if (vsBadge)   vsBadge.style.display = 'block';

    const labelEnemy = document.getElementById('hp-label-enemy');
    const valEnemy   = document.getElementById('hp-val-enemy');
    const fillEnemy  = document.getElementById('hp-fill-enemy');
    if (labelEnemy) labelEnemy.textContent = 'BOSS';
    if (valEnemy)   valEnemy.textContent = '';
    if (fillEnemy)  { fillEnemy.style.width = '100%'; fillEnemy.style.backgroundColor = '#ef233c'; }
  }

  visualBossHpPercent = 100;
}

export function setBossVisualHpPercent(pct) {
  visualBossHpPercent = Math.max(0, Math.min(100, pct));
  const hpFillEnemy = document.getElementById('hp-fill-enemy');
  const hpValEnemy  = document.getElementById('hp-val-enemy');
  if (hpFillEnemy) {
    hpFillEnemy.style.transition = 'width 0.4s ease';
    hpFillEnemy.style.width = `${visualBossHpPercent}%`;
    hpFillEnemy.style.backgroundColor = visualBossHpPercent > 60 ? '#06d6a0' : visualBossHpPercent > 30 ? '#ffbe0b' : '#ef233c';
  }
  if (hpValEnemy) {
    hpValEnemy.textContent = ''; // Clean visual bar for Boss
  }
}

export function deductBossHpPercent(amount) {
  setBossVisualHpPercent(visualBossHpPercent - amount);
}

export function updateHpBars(hp, bossHp) {
  const gs = window.gameState;
  const totalHp = gs?.totalHp || 50;
  const players = gs?.players || [];
  const p1 = players[0] || { id: gs?.myId };
  const p2 = players[1] || null;

  const isPvP = (gs?.mode === 'pvp_1v1' || gs?.mode === 'pvp');

  // Update Player 1 HP
  if (p1 && hp && hp[p1.id] !== undefined) {
    const p1Hp = hp[p1.id];
    const fillP1 = document.getElementById('hp-fill-player');
    const valP1  = document.getElementById('hp-val-player');
    if (fillP1) {
      const pct = Math.max(0, Math.min(100, (p1Hp / totalHp) * 100));
      fillP1.style.transition = 'width 0.5s ease';
      fillP1.style.width = `${pct}%`;
      fillP1.style.backgroundColor = pct > 60 ? '#06d6a0' : pct > 30 ? '#ffbe0b' : '#ef233c';
    }
    if (valP1) valP1.textContent = `${p1Hp}/${totalHp}`;
  }

  // Update Player 2 HP (Stacked in Team, or right header in PvP)
  if (p2 && hp && hp[p2.id] !== undefined) {
    const p2Hp = hp[p2.id];
    const pct = Math.max(0, Math.min(100, (p2Hp / totalHp) * 100));
    const barCol = pct > 60 ? '#06d6a0' : pct > 30 ? '#ffbe0b' : '#ef233c';

    if (isPvP) {
      const fillP2PvP = document.getElementById('hp-fill-player2-pvp');
      const valP2PvP  = document.getElementById('hp-val-player2-pvp');
      if (fillP2PvP) {
        fillP2PvP.style.transition = 'width 0.5s ease';
        fillP2PvP.style.width = `${pct}%`;
        fillP2PvP.style.backgroundColor = barCol;
      }
      if (valP2PvP) valP2PvP.textContent = `${p2Hp}/${totalHp}`;
    } else {
      const fillP2Team = document.getElementById('hp-fill-player2-team');
      const valP2Team  = document.getElementById('hp-val-player2-team');
      if (fillP2Team) {
        fillP2Team.style.transition = 'width 0.5s ease';
        fillP2Team.style.width = `${pct}%`;
        fillP2Team.style.backgroundColor = pct > 60 ? '#00cfff' : pct > 30 ? '#ffbe0b' : '#ef233c';
      }
      if (valP2Team) valP2Team.textContent = `${p2Hp}/${totalHp}`;
    }
  }

  // Update Boss HP in Team vs Boss mode
  if (!isPvP && bossHp !== undefined && bossHp !== null) {
    const pct = Math.max(0, Math.min(100, (bossHp / totalHp) * 100));
    setBossVisualHpPercent(pct);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Show question
// ─────────────────────────────────────────────────────────────────────────────
export function showQuestion(data) {
  try {
    myAnswer     = null;
    _answerLock  = false;   // ← reset lock for new question
    restoreQuizCard();

    // ── Hard-reset all buttons: override any lingering disabled/opacity state ──
    const container = document.getElementById('answer-btns') || document.getElementById('quiz-options');
    if (container) container.style.pointerEvents = 'auto';
    ['a','b','c','d'].forEach(l => {
      const btn = document.getElementById(`btn-answer-${l}`);
      if (!btn) return;
      btn.disabled = false;
      btn.style.pointerEvents = 'auto';
      btn.style.opacity = '1';
      btn.className = 'answer-btn';
    });

    const qNum = document.getElementById('question-number');
    if (qNum) qNum.textContent = `Q ${data.index ?? '?'} / ${data.total ?? '?'}`;

    const qText = document.getElementById('question-text');
    if (qText) qText.textContent = data.question || '(Câu hỏi không có nội dung)';

    const LABELS  = ['A', 'B', 'C', 'D'];
    const CLASSES = ['opt-a', 'opt-b', 'opt-c', 'opt-d'];

    // data.options is a plain array after shuffle: ["text0","text1","text2","text3"]
    // Fallback to object form {A,B,C,D} for any unshuffled edge case
    const optsArray = Array.isArray(data.options)
      ? data.options
      : LABELS.map(l => (data.options && data.options[l]) || '');

    LABELS.forEach((opt, i) => {
      const btn = document.getElementById(`btn-answer-${opt.toLowerCase()}`);
      if (!btn) return;
      const rawText = (optsArray[i] != null ? String(optsArray[i]) : '') || `—`;
      btn.innerHTML = '';
      const badge = document.createElement('span');
      badge.className = `opt-badge ${CLASSES[i]}`;
      badge.textContent = opt;
      const content = document.createElement('span');
      content.className = 'opt-text';
      content.textContent = rawText;
      btn.appendChild(badge);
      btn.appendChild(content);
      btn.disabled = false;
      btn.style.pointerEvents = 'auto';
      btn.style.opacity = '1';
      btn.className = 'answer-btn';
    });

    clearFeedback();
    startTimer(data.timeLimit || 30, () => {
      if (!myAnswer) {
        socket.emit('submit_answer', { code: currentState.code, answer: null });
        disableButtons();
      }
    });
  } catch(err) {
    console.error('[hud] showQuestion error:', err);
    // Fallback: force-enable all buttons so player isn't stuck
    enableButtons();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Show answer result + milestone drops
// ─────────────────────────────────────────────────────────────────────────────
export function showResult(data) {
  stopTimer();
  const opts = ['A', 'B', 'C', 'D'];
  opts.forEach(opt => {
    const btn = document.getElementById(`btn-answer-${opt.toLowerCase()}`);
    if (!btn) return;
    if (opt === data.correctAnswer) btn.classList.add('correct');
    else btn.classList.add('dimmed');
  });

  if (data.hp) updateHpBars(data.hp, null);

  const isThunder = window.gameState?.thunderSet;
  const dmg       = window.gameState?.damagePerHit || 1;

  if (myAnswer === data.correctAnswer) {
    showFeedback(true);
    try { Audio.playCorrect(); } catch(e) {}
    if (isThunder) {
      showCombatText(`⚡ CHÉM SÉT! -${dmg}`, '#00ffff');
    } else {
      showCombatText(`⚔ HIT! -${dmg}`, '#06d6a0');
    }
  } else {
    showFeedback(false);
    try { Audio.playWrong(); } catch(e) {}
    showCombatText('💥 MISS', '#ef233c');
  }

  // Victory fanfare ONLY when boss is defeated on final question
  const isFinal = data.questionIndex !== undefined && data.totalQuestions !== undefined
    ? (data.questionIndex >= data.totalQuestions - 1)
    : false;
  if (data.bossHp === 0 && isFinal) {
    setTimeout(() => {
      try {
        Audio.stopBGM();
        Audio.playVictory();
      } catch (e) {}
    }, 400);
  }

  // Handle milestone loot drops
  if (data.milestones && data.milestones.length > 0) {
    // Delay slightly so combat animation can play first
    setTimeout(() => {
      data.milestones.forEach(ms => {
        if (ms.playerId === window.gameState?.myId || data.milestones.length === 1) {
          showMilestoneDrop(ms);
        }
      });
    }, 900);
  }
}

export function getMyAnswer() { return myAnswer; }

// ─────────────────────────────────────────────────────────────────────────────
// ⚡ MILESTONE LOOT DROP POPUP
// ─────────────────────────────────────────────────────────────────────────────
export function showMilestoneDrop(milestone) {
  const isFullSet = milestone.count === 50;
  const popup = document.createElement('div');

  popup.style.cssText = `
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9500;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    background: rgba(10, 8, 28, 0.96);
    border: 3px solid ${isFullSet ? '#00ffff' : '#ffcc00'};
    border-radius: 12px;
    padding: 24px 32px;
    box-shadow: 0 0 40px ${isFullSet ? 'rgba(0,255,255,0.7)' : 'rgba(255,204,0,0.6)'}, 0 8px 32px rgba(0,0,0,0.8);
    pointer-events: none;
    font-family: 'Be Vietnam Pro', 'Nunito', sans-serif;
    text-align: center;
    animation: milestoneIn 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both;
    min-width: 300px;
  `;

  const bigIcon = document.createElement('div');
  bigIcon.textContent = isFullSet ? '⚡' : '🎁';
  bigIcon.style.cssText = `font-size: 52px; line-height: 1; ${isFullSet ? 'filter: drop-shadow(0 0 16px #00ffff);' : ''}`;

  const titleEl = document.createElement('div');
  titleEl.textContent = isFullSet ? '🏆 FULL THUNDER SET!' : '🎁 LOOT DROP!';
  titleEl.style.cssText = `font-size: 18px; font-weight: 900; color: ${isFullSet ? '#00ffff' : '#ffcc00'}; text-shadow: 0 0 12px currentColor; letter-spacing: 1px;`;

  const itemEl = document.createElement('div');
  itemEl.textContent = milestone.itemName;
  itemEl.style.cssText = `font-size: ${isFullSet ? '15px' : '14px'}; font-weight: 700; color: #fff; padding: 6px 14px; background: rgba(255,255,255,0.07); border-radius: 6px; border: 1px solid rgba(255,255,255,0.15);`;

  const countEl = document.createElement('div');
  countEl.textContent = `${milestone.count} câu đúng liên tiếp!`;
  countEl.style.cssText = `font-size: 11px; color: #aaa; margin-top: 2px;`;

  popup.appendChild(bigIcon);
  popup.appendChild(titleEl);
  popup.appendChild(itemEl);
  popup.appendChild(countEl);

  if (isFullSet) {
    const unlockEl = document.createElement('div');
    unlockEl.textContent = '⚡ Lightning Slash — CHÉM SÉT — Unlocked!';
    unlockEl.style.cssText = 'font-size:13px; font-weight:800; color:#00ffff; text-shadow:0 0 10px #00ffff; margin-top:4px;';
    popup.appendChild(unlockEl);
    const dmgEl = document.createElement('div');
    dmgEl.textContent = 'Sát thương x2 | Boss HP x2';
    dmgEl.style.cssText = 'font-size:12px; color:#ffcc00; font-weight:700;';
    popup.appendChild(dmgEl);
  }

  // Inject keyframe if not already there
  if (!document.getElementById('milestone-style')) {
    const style = document.createElement('style');
    style.id = 'milestone-style';
    style.textContent = `
      @keyframes milestoneIn {
        0%   { opacity:0; transform:translate(-50%,-50%) scale(0.5); }
        100% { opacity:1; transform:translate(-50%,-50%) scale(1); }
      }
      @keyframes milestoneOut {
        0%   { opacity:1; transform:translate(-50%,-50%) scale(1); }
        100% { opacity:0; transform:translate(-50%,-60%) scale(0.9); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(popup);

  // If full Thunder Set, activate after a short delay
  if (isFullSet) {
    setTimeout(() => {
      const element = window.gameState?.bossElement || 'thunder';
      window.__onThunderSetUnlocked?.();
      try { addUnlockedSet(element); } catch(e) {}
      if (window.gameState) {
        window.gameState.damagePerHit = 2;
        window.gameState.bossMaxHp    = (window.gameState.totalHp || 10) * 2;
      }
    }, 600);
  }

  // Fade out and remove after 3.5s
  setTimeout(() => {
    popup.style.animation = 'milestoneOut 0.5s ease-in forwards';
    setTimeout(() => popup.remove(), 520);
  }, 3500);
}

// ─────────────────────────────────────────────────────────────────────────────
// Timer
// ─────────────────────────────────────────────────────────────────────────────
export function startTimer(seconds, onExpire) {
  stopTimer();
  const timerFill = document.getElementById('timer-fill');
  if (!timerFill) return;

  timerFill.style.transition = 'none';
  timerFill.style.width = '100%';
  timerFill.style.backgroundColor = '#00ff00';

  currentTimer = Date.now() + seconds * 1000;
  const totalTime = seconds;

  timerInterval = setInterval(() => {
    const remaining = (currentTimer - Date.now()) / 1000;
    if (remaining <= 0) {
      stopTimer();
      timerFill.style.width = '0%';
      if (onExpire) onExpire();
      return;
    }
    const pct = (remaining / totalTime) * 100;
    timerFill.style.width = `${pct}%`;
    timerFill.style.backgroundColor = pct > 50 ? '#00ff00' : pct > 20 ? '#ffff00' : '#ff0000';
  }, 50);
}

function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function disableButtons() {
  ['a','b','c','d'].forEach(l => {
    const btn = document.getElementById(`btn-answer-${l}`);
    if (btn) btn.disabled = true;
  });
}

function enableButtons() {
  ['a','b','c','d'].forEach(l => {
    const btn = document.getElementById(`btn-answer-${l}`);
    if (!btn) return;
    btn.disabled = false;
    btn.style.pointerEvents = 'auto';
    btn.style.opacity = '1';
  });
}

function clearFeedback() {
  const overlay = document.getElementById('answer-feedback');
  if (overlay) { overlay.style.display = 'none'; overlay.className = ''; overlay.textContent = ''; }
}

function showFeedback(isCorrect) {
  const overlay = document.getElementById('answer-feedback');
  if (overlay) {
    overlay.style.display = 'flex';
    overlay.className = isCorrect ? 'correct' : 'wrong';
    overlay.textContent = isCorrect ? '✓ ĐÚNG!' : '✗ SAI';
    setTimeout(() => { overlay.style.display = 'none'; }, 1100);
  }
}

function showCombatText(text, color) {
  const pop = document.createElement('div');
  pop.className = 'score-pop';
  pop.textContent = text;
  pop.style.cssText = `color:${color}; position:fixed; top:35%; left:50%; transform:translate(-50%,-50%);
      font-family:'Be Vietnam Pro',sans-serif; font-size:28px; font-weight:900;
      text-shadow:2px 2px 0 #000,0 0 12px ${color}; pointer-events:none; z-index:80;
      animation:damageFloat 1.3s ease-out forwards;`;
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1400);
}

export function resetHudState() {
  stopTimer();
  clearFeedback();
  enableButtons();
  _answerLock = false;
  ['a', 'b', 'c', 'd'].forEach(l => {
    const btn = document.getElementById(`btn-answer-${l}`);
    if (btn) {
      btn.classList.remove('selected', 'correct', 'wrong', 'dim');
    }
  });
  restoreQuizCard();
  visualBossHpPercent = 100;
  const hpFillPlayer = document.getElementById('hp-fill-player');
  const hpFillEnemy  = document.getElementById('hp-fill-enemy');
  if (hpFillPlayer) { hpFillPlayer.style.width = '100%'; hpFillPlayer.style.backgroundColor = '#06d6a0'; }
  if (hpFillEnemy)  { hpFillEnemy.style.width  = '100%'; hpFillEnemy.style.backgroundColor  = '#ef233c'; }
  const hpValPlayer = document.getElementById('hp-val-player');
  const hpValEnemy  = document.getElementById('hp-val-enemy');
  if (hpValPlayer) hpValPlayer.textContent = '100%';
  if (hpValEnemy)  hpValEnemy.textContent  = '100%';
}

