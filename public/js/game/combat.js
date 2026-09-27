// THREE is available as a global from the CDN script tag
import * as Player  from './player.js';
import * as Boss    from './boss.js';
import * as Effects from './effects.js';
import * as Audio   from '../audio.js';
import * as hud     from '../ui/hud.js';

export { playGuaranteedPlayerSlash, playArmSwingSlash, playSwordSlashAnimation, getPlayerArmPivot } from './player.js';
export { playGuaranteedBossHammerSlam, getBossArmPivot } from './boss.js';

const BOSS_VFX_POS = new THREE.Vector3(3.0, 4.0, 0);

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
        Effects.spawnDamageNumber(BOSS_VFX_POS, '-1 HP', '#ffee44', 28);
        Effects.triggerShake(0.18, 0.22);
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
        Effects.spawnDamageNumber(BOSS_VFX_POS, hit1Label, hit1Color, 28);
        Effects.triggerShake(0.2, 0.25);
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

  // Step 1: Boss executes attack motion
  Boss.playBossAttack(bossElement, () => {
    // Step 2: Player dodges
    Player.playDodge(() => {
      // Step 3: CRITICAL - Trigger player counter-attack immediately after dodge completes
      executePlayerCounterAttack(selectedElement, isFullSet, () => {
        // Step 4: Complete turn and load next question
        if (onTurnFinished) onTurnFinished();
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

  if (isCorrect) {
    // ═════════════════════════════════════════════════════════════════════════
    // BRANCH A: Player answered CORRECTLY
    // ═════════════════════════════════════════════════════════════════════════
    handleCorrectAnswer(selectedElement, isFullSet, onDone, context);

  } else {
    // ═════════════════════════════════════════════════════════════════════════
    // BRANCH B: Player INCORRECT or TIMEOUT -> Takes direct boss hit
    // ═════════════════════════════════════════════════════════════════════════
    Boss.playBossAttack(bossElement, () => {
      try { Audio.playHit?.(); } catch (e) {}
      Effects.triggerShake(0.35, 0.35);

      // Damage: Normal/Incomplete set: -2 HP, Full set: -1 HP
      const playerDmg = ev.playerDamage || (isFullSet ? 1 : 2);
      const dmgLabel = `-${playerDmg} HP`;
      const dmgColor = isFullSet ? '#ffd166' : '#ef233c';

      const playerPos = Player.getPosition();
      const textPos = new THREE.Vector3(playerPos.x, playerPos.y + 2.0, playerPos.z);
      Effects.spawnDamageNumber(textPos, dmgLabel, dmgColor, 32);

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
        if (onDone) onDone();
      }, 150);
    });
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

