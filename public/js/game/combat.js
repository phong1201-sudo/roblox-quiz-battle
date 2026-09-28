// THREE is available as a global from the CDN script tag
import * as Player  from './player.js';
import * as Boss    from './boss.js';
import * as Effects from './effects.js';
import * as Audio   from '../audio.js';
import * as hud     from '../ui/hud.js';
import { triggerCinematicShot, resetCameraToDefault } from './scene.js';

export { playGuaranteedPlayerSlash, playArmSwingSlash, playSwordSlashAnimation, slashAnimation, getPlayerArmPivot, combatArmCompound, getCombatArmCompound } from './player.js';
export { playGuaranteedBossHammerSlam, getBossArmPivot, bossCombatArmCompound, getBossCombatArmCompound } from './boss.js';

const BOSS_VFX_POS = new THREE.Vector3(3.0, 4.0, 0);

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

    let img = '/assets/character/Player.png';
    let themeClass = 'cutin-theme-lightning';
    let titleText = 'DECISIVE HERO STRIKE';

    if (normElem === 'fire') {
      img = '/assets/character/Fire player.png';
      themeClass = 'cutin-theme-fire';
      titleText = 'PURGATORY FIRE BLADE';
    } else if (normElem === 'frost' || normElem === 'ice') {
      img = '/assets/character/Ice player.png';
      themeClass = 'cutin-theme-ice';
      titleText = 'GLACIAL ZERO SLASH';
    } else if (normElem === 'thunder' || normElem === 'lightning') {
      img = '/assets/character/Lightning player.png';
      themeClass = 'cutin-theme-lightning';
      titleText = "THUNDER GOD'S JUDGMENT";
    }

    if (portrait) portrait.style.backgroundImage = `url("${img}")`;
    if (faction) faction.textContent = 'PLAYER AWAKENING';
    if (title) title.textContent = titleText;
    banner.classList.add(themeClass);

  } else {
    // Boss menace
    try { Audio.playBassDropRoar?.(); } catch (e) {}

    let img = '/assets/character/Lightning boss.png';
    if (normElem === 'fire') {
      img = '/assets/character/Fire boss.png';
    } else if (normElem === 'frost' || normElem === 'ice') {
      img = '/assets/character/Ice boss.png';
    }

    if (portrait) portrait.style.backgroundImage = `url("${img}")`;
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
    if (isPlayerMilestone) {
      // Shot 2: Hero Low-Angle locked near floor looking up toward boss
      triggerCinematicShot(2, 2400, true);
    } else {
      // Dynamic camera cycling 1-5
      triggerCinematicShot(null, 1800, true);
    }

    handleCorrectAnswer(selectedElement, isFullSet, () => {
      resetCameraToDefault(500, doneWrapper);
    }, { ...context, isMilestone: isPlayerMilestone });
  };

  const executeBossBranch = () => {
    if (isBossMilestone) {
      // Shot 3: Over-the-Shoulder Boss View looking down at player
      triggerCinematicShot(3, 2400, false);
    } else {
      // Dynamic camera cycling 1-5
      triggerCinematicShot(null, 1800, false);
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

