// THREE is available as a global from the CDN script tag
import * as Player  from './player.js';
import * as Boss    from './boss.js';
import * as Effects from './effects.js';
import * as Audio   from '../audio.js';
import * as hud     from '../ui/hud.js';
import { triggerCinematicShot, resetCameraToDefault, triggerCombatSlowMo } from './scene.js';

export { playGuaranteedPlayerSlash, playArmSwingSlash, playSwordSlashAnimation, slashAnimation, getPlayerArmPivot, combatArmCompound, getCombatArmCompound } from './player.js';
export { playGuaranteedBossHammerSlam, getBossArmPivot, bossCombatArmCompound, getBossCombatArmCompound } from './boss.js';

const BOSS_VFX_POS = new THREE.Vector3(3.0, 4.0, 0);

// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL ANIME EYE GENERATORS (CRISP VECTOR SVG)
// ─────────────────────────────────────────────────────────────────────────────
function generatePlayerAnimeEyeSVG(element) {
  const norm = (element || 'fire').toLowerCase();
  let irisGrad1 = '#ff0033';
  let irisGrad2 = '#ff6600';
  let irisGrad3 = '#ffee00';
  let emberColor = '#ff5500';
  let sparkColor = '#ffbb00';
  let glowColor = 'rgba(255, 69, 0, 0.7)';

  if (norm === 'frost' || norm === 'ice') {
    irisGrad1 = '#0052cc';
    irisGrad2 = '#00b4d8';
    irisGrad3 = '#e0f7ff';
    emberColor = '#00e5ff';
    sparkColor = '#90e0ef';
    glowColor = 'rgba(0, 229, 255, 0.7)';
  } else if (norm === 'thunder' || norm === 'lightning') {
    irisGrad1 = '#0044ff';
    irisGrad2 = '#00f0ff';
    irisGrad3 = '#ffffaa';
    emberColor = '#00e5ff';
    sparkColor = '#ffd700';
    glowColor = 'rgba(0, 240, 255, 0.75)';
  }

  return `
  <svg viewBox="0 0 500 140" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="pIrisGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${irisGrad1}" />
        <stop offset="55%" stop-color="${irisGrad2}" />
        <stop offset="100%" stop-color="${irisGrad3}" />
      </linearGradient>
      <filter id="pBloom" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <rect width="500" height="140" fill="#080814" />
    <path d="M0,0 L500,140" stroke="rgba(255,255,255,0.04)" stroke-width="2" />
    <path d="M0,35 L500,105" stroke="rgba(255,255,255,0.04)" stroke-width="2" />

    <!-- Radiating Ember/Lightning sparks -->
    <g filter="url(#pBloom)" stroke="${sparkColor}" stroke-width="2" fill="none">
      <path d="M40,70 L90,45 L130,60" opacity="0.8" />
      <path d="M370,55 L420,35 L470,65" opacity="0.8" />
      <path d="M120,110 L160,85 L200,95" opacity="0.7" />
      <path d="M300,95 L340,80 L380,115" opacity="0.7" />
      <circle cx="95" cy="40" r="3" fill="${sparkColor}" />
      <circle cx="415" cy="30" r="3" fill="${sparkColor}" />
      <circle cx="150" cy="115" r="2.5" fill="${emberColor}" />
      <circle cx="360" cy="118" r="2.5" fill="${emberColor}" />
    </g>

    <!-- Left Anime Eye -->
    <g transform="translate(140, 20)">
      <path d="M-60,12 Q0,32 50,42" stroke="#ffffff" stroke-width="6" stroke-linecap="round" fill="none" />
      <path d="M-60,12 Q0,32 50,42" stroke="${emberColor}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.7" />
      <path d="M-45,45 Q0,25 40,48 Q0,75 -45,45 Z" fill="#e2e8f0" />
      <path d="M-45,45 Q0,28 40,48 Q0,42 -45,45 Z" fill="rgba(0,0,0,0.35)" />
      <ellipse cx="-2" cy="48" rx="20" ry="24" fill="url(#pIrisGrad)" filter="url(#pBloom)" />
      <ellipse cx="-2" cy="48" rx="14" ry="18" fill="none" stroke="${sparkColor}" stroke-width="1.5" opacity="0.8" />
      <ellipse cx="-2" cy="48" rx="6" ry="12" fill="#050510" />
      <line x1="-2" y1="40" x2="-2" y2="56" stroke="${sparkColor}" stroke-width="2" />
      <circle cx="-7" cy="40" r="4.5" fill="#ffffff" />
      <circle cx="5" cy="56" r="2.2" fill="#ffffff" opacity="0.9" />
      <path d="M-52,43 Q-5,24 45,47" stroke="#0f172a" stroke-width="6.5" stroke-linecap="round" fill="none" />
      <path d="M40,46 L50,41" stroke="#0f172a" stroke-width="4.5" stroke-linecap="round" />
      <path d="M-30,66 Q0,74 25,68" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round" fill="none" />
    </g>

    <!-- Right Anime Eye -->
    <g transform="translate(360, 20)">
      <path d="M-50,42 Q0,32 60,12" stroke="#ffffff" stroke-width="6" stroke-linecap="round" fill="none" />
      <path d="M-50,42 Q0,32 60,12" stroke="${emberColor}" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.7" />
      <path d="M-40,48 Q0,25 45,45 Q0,75 -40,48 Z" fill="#e2e8f0" />
      <path d="M-40,48 Q0,28 45,45 Q0,42 -40,48 Z" fill="rgba(0,0,0,0.35)" />
      <ellipse cx="2" cy="48" rx="20" ry="24" fill="url(#pIrisGrad)" filter="url(#pBloom)" />
      <ellipse cx="2" cy="48" rx="14" ry="18" fill="none" stroke="${sparkColor}" stroke-width="1.5" opacity="0.8" />
      <ellipse cx="2" cy="48" rx="6" ry="12" fill="#050510" />
      <line x1="2" y1="40" x2="2" y2="56" stroke="${sparkColor}" stroke-width="2" />
      <circle cx="-3" cy="40" r="4.5" fill="#ffffff" />
      <circle cx="9" cy="56" r="2.2" fill="#ffffff" opacity="0.9" />
      <path d="M-45,47 Q5,24 52,43" stroke="#0f172a" stroke-width="6.5" stroke-linecap="round" fill="none" />
      <path d="M-40,46 L-50,41" stroke="#0f172a" stroke-width="4.5" stroke-linecap="round" />
      <path d="M-25,68 Q0,74 30,66" stroke="#1e293b" stroke-width="2.5" stroke-linecap="round" fill="none" />
    </g>
  </svg>`;
}

function generateBossAnimeEyeSVG(element) {
  const norm = (element || 'thunder').toLowerCase();
  let irisColor = '#ef233c';
  let slitGlow = '#ff0055';
  let auraColor = 'rgba(239, 35, 60, 0.45)';

  if (norm === 'frost' || norm === 'ice') {
    irisColor = '#00e5ff';
    slitGlow = '#80f4ff';
    auraColor = 'rgba(0, 229, 255, 0.45)';
  } else if (norm === 'thunder' || norm === 'lightning') {
    irisColor = '#ffd166';
    slitGlow = '#ffee33';
    auraColor = 'rgba(255, 209, 102, 0.45)';
  }

  return `
  <svg viewBox="0 0 500 140" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bAuraGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${auraColor}" />
        <stop offset="100%" stop-color="rgba(10, 0, 15, 0)" />
      </radialGradient>
      <filter id="bDemonicGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <rect width="500" height="140" fill="#080106" />
    <circle cx="250" cy="70" r="130" fill="url(#bAuraGrad)" />

    <g stroke="rgba(239, 35, 60, 0.35)" stroke-width="1.5" fill="none">
      <path d="M60,40 L120,65 L160,60" />
      <path d="M440,40 L380,65 L340,60" />
      <path d="M100,105 L150,85 L180,95" />
      <path d="M400,105 L350,85 L320,95" />
    </g>

    <!-- Left Demonic Eye -->
    <g transform="translate(150, 25)">
      <path d="M-65,15 Q-10,38 45,46" stroke="#000000" stroke-width="9" stroke-linecap="round" fill="none" />
      <path d="M-60,18 Q-10,38 40,44" stroke="#4a0404" stroke-width="3" stroke-linecap="round" fill="none" />
      <path d="M-55,44 Q-10,34 35,46 Q-10,64 -55,44 Z" fill="#140204" stroke="#ef233c" stroke-width="1" />
      <ellipse cx="-10" cy="46" rx="18" ry="12" fill="${irisColor}" filter="url(#bDemonicGlow)" />
      <ellipse cx="-10" cy="46" rx="2.5" ry="11" fill="#000000" />
      <line x1="-10" y1="36" x2="-10" y2="56" stroke="${slitGlow}" stroke-width="1.5" />
    </g>

    <!-- Right Demonic Eye -->
    <g transform="translate(350, 25)">
      <path d="M-45,46 Q10,38 65,15" stroke="#000000" stroke-width="9" stroke-linecap="round" fill="none" />
      <path d="M-40,44 Q10,38 60,18" stroke="#4a0404" stroke-width="3" stroke-linecap="round" fill="none" />
      <path d="M-35,46 Q10,34 55,44 Q10,64 -35,46 Z" fill="#140204" stroke="#ef233c" stroke-width="1" />
      <ellipse cx="10" cy="46" rx="18" ry="12" fill="${irisColor}" filter="url(#bDemonicGlow)" />
      <ellipse cx="10" cy="46" rx="2.5" ry="11" fill="#000000" />
      <line x1="10" y1="36" x2="10" y2="56" stroke="${slitGlow}" stroke-width="1.5" />
    </g>
  </svg>`;
}

/**
 * Triggers the anime-style Eye Cut-In banner overlay
 * @param {Object} options
 * @param {'player'|'boss'} options.type
 * @param {string} options.element
 * @param {Function} options.onDone
 */
export function playCutInBanner({ type = 'player', element = 'fire', onDone }) {
  const banner = document.getElementById('cinematic-cutin-banner');
  if (!banner) {
    if (onDone) onDone();
    return;
  }

  let finished = false;
  const finishOnce = () => {
    if (!finished) {
      finished = true;
      if (onDone) onDone();
    }
  };

  const bannerTimeout = setTimeout(() => {
    console.warn('[combat] Cut-in banner safety timeout triggered');
    cleanup();
    finishOnce();
  }, 2500);

  const cleanup = () => {
    clearTimeout(bannerTimeout);
    banner.classList.remove('active', 'flash-active', 'cutin-theme-fire', 'cutin-theme-ice', 'cutin-theme-lightning', 'cutin-theme-boss');
    banner.style.display = 'none';
  };

  const portrait = document.getElementById('cutin-portrait');
  const faction = document.getElementById('cutin-faction');
  const title = document.getElementById('cutin-title');

  banner.classList.remove('active', 'flash-active', 'cutin-theme-fire', 'cutin-theme-ice', 'cutin-theme-lightning', 'cutin-theme-boss');

  const normElem = (element || 'fire').toLowerCase();

  if (type === 'player') {
    try { Audio.playMetallicSlice?.(); } catch (e) {}

    let themeClass = 'cutin-theme-lightning';
    let titleText = 'DECISIVE HERO STRIKE';

    if (normElem === 'fire') {
      themeClass = 'cutin-theme-fire';
      titleText = 'PURGATORY FIRE BLADE';
    } else if (normElem === 'frost' || normElem === 'ice') {
      themeClass = 'cutin-theme-ice';
      titleText = 'GLACIAL ZERO SLASH';
    } else if (normElem === 'thunder' || normElem === 'lightning') {
      themeClass = 'cutin-theme-lightning';
      titleText = "THUNDER GOD'S JUDGMENT";
    }

    if (portrait) {
      portrait.style.backgroundImage = 'none';
      portrait.innerHTML = generatePlayerAnimeEyeSVG(normElem);
    }
    if (faction) faction.textContent = 'PLAYER AWAKENING';
    if (title) title.textContent = titleText;
    banner.classList.add(themeClass);

  } else {
    // Boss menace
    try { Audio.playBassDropRoar?.(); } catch (e) {}

    if (portrait) {
      portrait.style.backgroundImage = 'none';
      portrait.innerHTML = generateBossAnimeEyeSVG(normElem);
    }
    if (faction) faction.textContent = 'BOSS MENACE';
    if (title) title.textContent = 'WRATH OF THE TITAN';
    banner.classList.add('cutin-theme-boss');
  }

  banner.style.display = 'flex';

  // Force reflow for CSS transition
  void banner.offsetWidth;
  banner.classList.add('active');

  // Slow-mo hold (~450ms), then flash and slice-out
  setTimeout(() => {
    banner.classList.add('flash-active');
    setTimeout(() => {
      banner.classList.remove('active');
      setTimeout(() => {
        cleanup();
        finishOnce();
      }, 200);
    }, 200);
  }, 450);
}


/**
 * Executes the counter-attack sequence after the player dodges.
 *
 * Case A: Normal / Incomplete Gear (isFullSet === false):
 * - Character dashes forward to Boss.
 * - Slashes Boss once: floats '-1 HP', Boss HP bar decreases by (100 / totalQuestions)%, Boss flinches.
 * - Character returns to origin position.
 * - Turn finishes.
 *
 * Case B: Full Elemental Set (isFullSet === true):
 * - Hit 1 (Weapon Slash):
 *   - Character performs weapon slash according to element (Thunder diving slash, Fire wave slash, Frost slide slash).
 *   - Floats damage text: '-1 HP' (with elemental icon).
 *   - Boss HP bar decreases by (50 / totalQuestions)%.
 *   - Boss flinches.
 *   - Character returns to origin position.
 * - Hit 2 (Elemental Follow-up AFTER returning):
 *   - Major elemental VFX on Boss (Thunder lightning bolt / Fire tornado & pillars / Frost ice crystal encasement & shatter).
 *   - Floats secondary damage text: '-1 HP' (Total 2x -1 HP).
 *   - Boss HP bar decreases by another (50 / totalQuestions)%.
 *   - Boss flinches.
 *   - Turn finishes.
 *
 * @param {string|null} selectedElement - 'thunder' | 'fire' | 'frost' | null
 * @param {boolean} isFullSet - Whether the full elemental set is equipped
 * @param {Function} onCounterDone - Callback when counter-attack sequence finishes
 * @param {Object} context - Calculation helpers and damage callbacks
 */
export function executePlayerCounterAttack(selectedElement, isFullSet, onCounterDone, context = {}) {
  const {
    applyHit1Damage,
    applyHit2Damage,
    hit1Label = '-1 HP',
    hit2Label = '-1 HP',
  } = context;

  let finished = false;
  const finishOnce = () => {
    if (!finished) {
      finished = true;
      if (onCounterDone) onCounterDone();
    }
  };

  // Safety fallback timer to prevent combat turn from ever hanging
  const safetyTimeout = setTimeout(() => {
    console.warn('[combat] Counter-attack safety timeout triggered');
    finishOnce();
  }, 4000);

  const doneCallback = () => {
    clearTimeout(safetyTimeout);
    finishOnce();
  };

  if (!isFullSet || !selectedElement) {
    // ═════════════════════════════════════════════════════════════════════════
    // CASE A: NORMAL / INCOMPLETE GEAR (1-hit slash)
    // ═════════════════════════════════════════════════════════════════════════
    Player.playCombatAnimation('normal', {
      onHit: () => {
        try { Audio.playSlash?.(); } catch (e) {}
        if (applyHit1Damage) applyHit1Damage();
        Effects.spawnHitSpark(BOSS_VFX_POS);
        if (context.isMilestone) {
          Effects.spawnHitSpark(new THREE.Vector3(BOSS_VFX_POS.x + 0.3, BOSS_VFX_POS.y + 0.3, BOSS_VFX_POS.z));
          Effects.triggerShake(0.35, 0.35);
        } else {
          Effects.triggerShake(0.18, 0.22);
        }
        Effects.spawnDamageNumber(BOSS_VFX_POS, '-1 HP', '#ffee44', context.isMilestone ? 36 : 28);
      },
      onDone: () => {
        // Character has returned to origin position -> turn finishes cleanly
        doneCallback();
      },
    });

  } else {
    // ═════════════════════════════════════════════════════════════════════════
    // CASE B: FULL ELEMENTAL SET (2-hit: Weapon Slash + Elemental Follow-up)
    // ═════════════════════════════════════════════════════════════════════════
    const animType = selectedElement; // 'thunder' | 'fire' | 'frost'
    const hit1Color = (selectedElement === 'thunder')
      ? '#00ffff'
      : (selectedElement === 'fire')
        ? '#ff8800'
        : '#88ddff';

    // Step 1: Weapon slash (Hit 1)
    Player.playCombatAnimation(animType, {
      onHit: () => {
        try { Audio.playSlash?.(); } catch (e) {}
        if (applyHit1Damage) applyHit1Damage(); // decreases HP bar by (50 / totalQuestions)%
        Effects.spawnHitSpark(BOSS_VFX_POS);
        if (context.isMilestone) {
          Effects.spawnHitSpark(new THREE.Vector3(BOSS_VFX_POS.x + 0.3, BOSS_VFX_POS.y + 0.3, BOSS_VFX_POS.z));
          Effects.triggerShake(0.35, 0.35);
        } else {
          Effects.triggerShake(0.2, 0.25);
        }
        Effects.spawnDamageNumber(BOSS_VFX_POS, hit1Label, hit1Color, context.isMilestone ? 36 : 28);
      },
      onDone: () => {
        // Step 2: Elemental Follow-up (Hit 2) AFTER character returns to origin position
        if (selectedElement === 'thunder') {
          setTimeout(() => {
            try { Audio.playThunder?.(); } catch (e) {}
            if (applyHit2Damage) applyHit2Damage(); // decreases HP bar by another (50 / totalQuestions)%
            Effects.triggerLightningSlash(BOSS_VFX_POS, hit2Label);
            setTimeout(doneCallback, 500);
          }, 100);

        } else if (selectedElement === 'fire') {
          setTimeout(() => {
            try { Audio.playFire?.(); } catch (e) {}
            if (applyHit2Damage) applyHit2Damage(); // decreases HP bar by another (50 / totalQuestions)%
            Effects.spawnFireVortexAroundBoss(BOSS_VFX_POS);
            Effects.triggerFireBurst(BOSS_VFX_POS, hit2Label);
            setTimeout(doneCallback, 500);
          }, 100);

        } else if (selectedElement === 'frost') {
          setTimeout(() => {
            Effects.freezeBossInIce(BOSS_VFX_POS, 400, () => {
              try { Audio.playFrost?.(); } catch (e) {}
              if (applyHit2Damage) applyHit2Damage(); // decreases HP bar by another (50 / totalQuestions)%
              Effects.triggerFrostShatter(BOSS_VFX_POS, hit2Label);
              setTimeout(doneCallback, 450);
            });
          }, 80);

        } else {
          if (applyHit2Damage) applyHit2Damage();
          doneCallback();
        }
      },
    });
  }
}

/**
 * Handles the complete correct answer combat sequence:
 * Step 1: Boss executes attack motion
 * Step 2: Player dodges evasively at attack peak
 * Step 3: CRITICAL - Player executes counter-attack immediately after dodge
 * Step 4: Turn finishes and loads next question
 */
export function handleCorrectAnswer(selectedElement, isFullSet, onTurnFinished, context = {}) {
  const bossElement = context.bossElement || Boss.getBossElement() || 'thunder';

  let finished = false;
  const finishOnce = () => {
    if (!finished) {
      finished = true;
      if (onTurnFinished) onTurnFinished();
    }
  };

  // Safety fallback timer to prevent combat turn freeze under any circumstance
  const safetyTimeout = setTimeout(() => {
    console.warn('[combat] handleCorrectAnswer safety timeout triggered');
    finishOnce();
  }, 5000);

  // Step 1: Boss executes attack motion
  Boss.playBossAttack(bossElement, () => {
    // Step 2: Player dodges
    Player.playDodge(() => {
      // Step 3: CRITICAL - Trigger player counter-attack immediately after dodge completes
      executePlayerCounterAttack(selectedElement, isFullSet, () => {
        // Step 4: Complete turn and load next question
        clearTimeout(safetyTimeout);
        finishOnce();
      }, context);
    });
  }, () => {
    // Boss attack action completed
  });
}

/**
 * Main combat turn entry point invoked by scene.js
 *
 * @param {Object} ev - Combat event payload
 * @param {Function} onDone - Callback to release combat turn lock
 */
export function executeCombatTurn(ev, onDone) {
  let doneHandled = false;
  const safeOnDone = () => {
    if (!doneHandled) {
      doneHandled = true;
      if (onDone) onDone();
    }
  };

  const turnSafetyTimer = setTimeout(() => {
    console.warn('[combat] executeCombatTurn safety timeout triggered');
    safeOnDone();
  }, 7000);

  const doneWrapper = () => {
    clearTimeout(turnSafetyTimer);
    safeOnDone();
  };

  const isCorrect = ev.isCorrect !== false && ev.type === 'attack';
  const rawElement = ev.equippedSet || Player.getActiveElement() || window.gameState?.equippedSet || null;
  const isFullSet = Boolean(
    ev.hasFullSet ||
    window.gameState?.damagePerHit === 2 ||
    (rawElement && ['thunder', 'fire', 'frost'].includes(rawElement))
  );
  const selectedElement = isFullSet && ['thunder', 'fire', 'frost'].includes(rawElement) ? rawElement : null;
  const bossElement = ev.element || Boss.getBossElement() || 'thunder';

  // Total questions in the match (N)
  const totalQ = ev.totalQuestions || window.gameState?.totalHp || 20;
  const qIdx = (ev.questionIndex !== undefined)
    ? ev.questionIndex
    : (window.gameState?.currentQuestionIndex ?? 0);
  const isFinalQuestion = (qIdx >= totalQ - 1);

  // Exact boss health remaining (0 to N)
  const bossHealthRemaining = (ev.currentBossHp !== undefined)
    ? ev.currentBossHp
    : Math.max(0, totalQ - (qIdx + 1));

  // Boss HP visual width: strictly (bossHealthRemaining / N) * 100%
  const targetPct = (bossHealthRemaining / totalQ) * 100;
  // If full set (2 hits): Hit 1 lands halfway: ((bossHealthRemaining + 0.5) / totalQ) * 100%
  const halfwayPct = ((bossHealthRemaining + 0.5) / totalQ) * 100;

  // Floating text strictly '-1 HP' (or '⚡ -1 HP', '🔥 -1 HP', '❄️ -1 HP')
  const hit1Label = selectedElement
    ? (selectedElement === 'thunder' ? '⚡ -1 HP' : selectedElement === 'fire' ? '🔥 -1 HP' : '❄️ -1 HP')
    : '-1 HP';
  const hit2Label = selectedElement
    ? (selectedElement === 'thunder' ? '⚡ -1 HP' : selectedElement === 'fire' ? '🔥 -1 HP' : '❄️ -1 HP')
    : '-1 HP';

  const applyHit1Damage = () => {
    Boss.playBossHurt();
    const pct = isFullSet ? halfwayPct : targetPct;
    Boss.setBossHpPercent(pct, isFinalQuestion && !isFullSet);
    if (hud.setBossVisualHpPercent) hud.setBossVisualHpPercent(pct);
    if (isFinalQuestion && !isFullSet && targetPct <= 0) {
      Boss.triggerBossDefeat(bossElement);
    }
  };

  const applyHit2Damage = () => {
    Boss.playBossHurt();
    Boss.setBossHpPercent(targetPct, isFinalQuestion);
    if (hud.setBossVisualHpPercent) hud.setBossVisualHpPercent(targetPct);
    if (isFinalQuestion && targetPct <= 0) {
      Boss.triggerBossDefeat(bossElement);
    }
  };

  const context = {
    bossElement,
    totalQ,
    qIdx,
    isFinalQuestion,
    targetPct,
    halfwayPct,
    hit1Label,
    hit2Label,
    applyHit1Damage,
    applyHit2Damage,
  };

  const qNum = qIdx + 1;
  const isPlayerMilestone = isCorrect && (qNum % 10 === 0);
  const isBossMilestone = !isCorrect && (qNum % 10 === 5);

  const executeCorrectBranch = () => {
    // Slow-Motion effect (40% speed for 0.8s, then snap to full impact)
    triggerCombatSlowMo(0.4, 800);

    if (isPlayerMilestone) {
      // Shot 2: Hero Low-Angle locked near floor looking up toward boss
      triggerCinematicShot(2, 2400, true);
    } else {
      // Dynamic camera cycling 1-5 (2.2s - 2.5s)
      triggerCinematicShot(null, 2300, true);
    }

    handleCorrectAnswer(selectedElement, isFullSet, () => {
      resetCameraToDefault(600, doneWrapper);
    }, { ...context, isMilestone: isPlayerMilestone });
  };

  const executeBossBranch = () => {
    // Slow-Motion effect (40% speed for 0.8s, then snap to full impact)
    triggerCombatSlowMo(0.4, 800);

    if (isBossMilestone) {
      // Shot 3: Over-the-Shoulder Boss View looking down at player
      triggerCinematicShot(3, 2400, false);
    } else {
      // Dynamic camera cycling 1-5 (2.2s - 2.5s)
      triggerCinematicShot(null, 2300, false);
    }

    Boss.playBossAttack(bossElement, () => {
      try { Audio.playHit?.(); } catch (e) {}
      const shakeAmt = isBossMilestone ? 0.55 : 0.35;
      Effects.triggerShake(shakeAmt, shakeAmt);

      const playerDmg = ev.playerDamage || (isFullSet ? 1 : 2);
      const dmgLabel = isBossMilestone ? `💥 BARRAGE -${playerDmg} HP` : `-${playerDmg} HP`;
      const dmgColor = isFullSet ? '#ffd166' : '#ef233c';

      const playerPos = Player.getPosition();
      const textPos = new THREE.Vector3(playerPos.x, playerPos.y + 2.0, playerPos.z);
      Effects.spawnDamageNumber(textPos, dmgLabel, dmgColor, isBossMilestone ? 38 : 32);

      // Player staggers and flashes red
      Player.playHurt(() => {
        if (ev.remainingPlayerHp !== undefined) {
          if (hud.updateHpBars) {
            const hpMap = {};
            if (window.gameState?.myId) hpMap[window.gameState.myId] = ev.remainingPlayerHp;
            hud.updateHpBars(hpMap, ev.currentBossHp);
          }
        }
      });
    }, () => {
      setTimeout(() => {
        resetCameraToDefault(500, doneWrapper);
      }, 150);
    });
  };

  if (isCorrect) {
    // ═════════════════════════════════════════════════════════════════════════
    // BRANCH A: Player answered CORRECTLY
    // ═════════════════════════════════════════════════════════════════════════
    if (isPlayerMilestone) {
      playCutInBanner({
        type: 'player',
        element: selectedElement || 'thunder',
        onDone: executeCorrectBranch,
      });
    } else {
      executeCorrectBranch();
    }

  } else {
    // ═════════════════════════════════════════════════════════════════════════
    // BRANCH B: Player INCORRECT or TIMEOUT -> Takes direct boss hit
    // ═════════════════════════════════════════════════════════════════════════
    if (isBossMilestone) {
      playCutInBanner({
        type: 'boss',
        element: bossElement,
        onDone: executeBossBranch,
      });
    } else {
      executeBossBranch();
    }
  }
}

// Backwards compatibility aliases
export function runAttack(ev, onDone) {
  executeCombatTurn(ev, onDone);
}

export function runDodge(ev, onDone) {
  executeCombatTurn(ev, onDone);
}

export { getWeaponHandNode } from './player.js';

