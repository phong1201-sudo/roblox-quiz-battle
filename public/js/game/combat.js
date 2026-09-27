// THREE is available as a global from the CDN script tag
import * as Player  from './player.js';
import * as Boss    from './boss.js';
import * as Effects from './effects.js';
import * as Audio   from '../audio.js';
import * as hud     from '../ui/hud.js';

const BOSS_VFX_POS = new THREE.Vector3(3.0, 4.0, 0);

/**
 * Overhauled Combat Turn Sequence:
 * 1. Boss pre-attacks FIRST (Frost hammer leap & slam / Fire ground slam & fire wave / Thunder lightning beam).
 * 2. At attack peak:
 *    - Branch A (Player CORRECT): Player performs quick evasive dodge, then counter-attacks:
 *      - Normal / Incomplete set (1-hit slash): Boss shrinks by (100 / N)%, floats -1 HP.
 *      - Full set (2-hit elemental): Hit 1 shrinks (50 / N)%, floats -1 HP; Hit 2 shrinks (50 / N)%, floats -1 HP.
 *    - Branch B (Player INCORRECT / TIMEOUT): Player fails to dodge, takes direct impact:
 *      - Normal / Incomplete set: -2 HP (floats -2 HP).
 *      - Full set: -1 HP (floats -1 HP).
 *      - Player plays hurt stagger + red flash.
 *
 * @param {Object} ev - Combat event payload
 * @param {Function} onDone - Callback to release combat turn lock
 */
export function executeCombatTurn(ev, onDone) {
  const isCorrect   = ev.isCorrect !== false && ev.type === 'attack';
  const hasFullSet  = ev.hasFullSet || false;
  const rawElement  = ev.equippedSet || Player.getActiveElement() || null;
  const isElemental = hasFullSet && ['thunder', 'fire', 'frost'].includes(rawElement);
  const playerElement = isElemental ? rawElement : null;
  const bossElement   = ev.element || Boss.getBossElement() || 'thunder';

  // Percentage calculations based on total question count N (e.g. 5, 20, 30, 50)
  const totalQ   = ev.totalQuestions || window.gameState?.totalHp || 20;
  const pctTotal = 100 / Math.max(1, totalQ);
  const pctHit1  = hasFullSet ? (pctTotal / 2) : pctTotal;
  const pctHit2  = hasFullSet ? (pctTotal / 2) : 0;

  // CRITICAL: Floating text must strictly be '-1 HP' (or '⚡ -1 HP', '🔥 -1 HP', '❄️ -1 HP'), NOT percentage numbers!
  const hit1Label = isElemental
    ? (playerElement === 'thunder' ? '⚡ -1 HP' : playerElement === 'fire' ? '🔥 -1 HP' : '❄️ -1 HP')
    : '-1 HP';
  const hit2Label = isElemental
    ? (playerElement === 'thunder' ? '⚡ -1 HP' : playerElement === 'fire' ? '🔥 -1 HP' : '❄️ -1 HP')
    : '-1 HP';

  const applyHit1Damage = () => {
    Boss.playBossHurt();
    Boss.deductBossHpPercent(pctHit1);
    if (hud.deductBossHpPercent) hud.deductBossHpPercent(pctHit1);
  };

  const applyHit2Damage = () => {
    Boss.playBossHurt();
    Boss.deductBossHpPercent(pctHit2);
    if (hud.deductBossHpPercent) hud.deductBossHpPercent(pctHit2);
  };

  // STEP 1: Boss attacks FIRST!
  Boss.playBossAttack(bossElement, () => {
    // ── ON PEAK OF BOSS ATTACK ──
    if (isCorrect) {
      // ═══════════════════════════════════════════════════════════════════════
      // BRANCH A: Player is CORRECT -> Quick evasive dodge + counter-attack
      // ═══════════════════════════════════════════════════════════════════════
      Player.playDodge(() => {
        // Counter-attack after dodging
        _executePlayerCounterAttack({
          hasFullSet,
          playerElement,
          pctHit1,
          pctHit2,
          hit1Label,
          hit2Label,
          applyHit1Damage,
          applyHit2Damage,
          onDone,
        });
      });

    } else {
      // ═══════════════════════════════════════════════════════════════════════
      // BRANCH B: Player is INCORRECT or TIMEOUT -> Takes direct impact
      // ═══════════════════════════════════════════════════════════════════════
      try { Audio.playHit?.(); } catch (e) {}
      Effects.triggerShake(0.35, 0.35);

      // Damage: Normal/Incomplete set: -2 HP, Full set: -1 HP
      const playerDmg = ev.playerDamage || (hasFullSet ? 1 : 2);
      const dmgLabel = `-${playerDmg} HP`;
      const dmgColor = hasFullSet ? '#ffd166' : '#ef233c';

      const playerPos = Player.getPosition();
      const textPos = new THREE.Vector3(playerPos.x, playerPos.y + 2.0, playerPos.z);
      Effects.spawnDamageNumber(textPos, dmgLabel, dmgColor, 32);

      // Player staggers and flashes red
      Player.playHurt(() => {
        // Update player HP display in HUD
        if (ev.remainingPlayerHp !== undefined) {
          if (hud.updateHpBars) {
            const hpMap = {};
            if (window.gameState?.myId) hpMap[window.gameState.myId] = ev.remainingPlayerHp;
            hud.updateHpBars(hpMap, ev.currentBossHp);
          }
        }
      });
    }
  }, () => {
    // ── ON COMPLETE OF BOSS ATTACK ──
    if (!isCorrect) {
      setTimeout(() => {
        if (onDone) onDone();
      }, 150);
    }
  });
}

function _executePlayerCounterAttack({
  hasFullSet,
  playerElement,
  hit1Label,
  hit2Label,
  applyHit1Damage,
  applyHit2Damage,
  onDone,
}) {
  if (!playerElement) {
    // ═════════════════════════════════════════════════════════════════════════
    // NORMAL / INCOMPLETE SET (1-hit basic slash) -> Boss loses (100 / N)%
    // ═════════════════════════════════════════════════════════════════════════
    Player.playCombatAnimation('normal', {
      onHit: () => {
        try { Audio.playSlash(); } catch (e) {}
        applyHit1Damage();
        Effects.spawnHitSpark(BOSS_VFX_POS);
        Effects.spawnDamageNumber(BOSS_VFX_POS, hit1Label, '#ffee44');
        Effects.triggerShake(0.18, 0.25);
      },
      onDone: () => {
        if (onDone) onDone();
      },
    });

  } else if (playerElement === 'thunder') {
    // ═════════════════════════════════════════════════════════════════════════
    // FULL SET THUNDER (2 hits: dive slash + sky lightning bolt strike)
    // ═════════════════════════════════════════════════════════════════════════
    Player.playCombatAnimation('thunder', {
      onHit: () => {
        try { Audio.playSlash(); } catch (e) {}
        applyHit1Damage();
        Effects.spawnHitSpark(BOSS_VFX_POS);
        Effects.spawnDamageNumber(BOSS_VFX_POS, hit1Label, '#00ffff');
        Effects.triggerShake(0.25, 0.25);
      },
      onDone: () => {
        setTimeout(() => {
          try { Audio.playThunder(); } catch (e) {}
          applyHit2Damage();
          Effects.triggerLightningSlash(BOSS_VFX_POS, hit2Label);
          setTimeout(() => {
            if (onDone) onDone();
          }, 550);
        }, 90);
      },
    });

  } else if (playerElement === 'fire') {
    // ═════════════════════════════════════════════════════════════════════════
    // FULL SET FIRE (2 hits: power swing + flame projectile + burning burst)
    // ═════════════════════════════════════════════════════════════════════════
    let counterDone = false;
    const finish = () => {
      if (!counterDone) {
        counterDone = true;
        if (onDone) onDone();
      }
    };

    Player.playCombatAnimation('fire', {
      onHit: () => {
        try { Audio.playFire(); } catch (e) {}
        applyHit1Damage();
        const playerPos = Player.getPosition();
        const startPos  = new THREE.Vector3(playerPos.x + 0.8, playerPos.y + 0.5, playerPos.z);

        Effects.spawnFlameProjectile(startPos, BOSS_VFX_POS, () => {
          Effects.triggerFireBurst(BOSS_VFX_POS, hit1Label);
          Effects.triggerShake(0.35, 0.35);

          setTimeout(() => {
            try { Audio.playFire(); } catch (e) {}
            applyHit2Damage();
            Effects.spawnDamageNumber(BOSS_VFX_POS, hit2Label, '#ff3300', 26);
            Effects.triggerShake(0.25, 0.3);
            setTimeout(finish, 450);
          }, 400);
        });
      },
      onDone: () => {},
    });

  } else if (playerElement === 'frost') {
    // ═════════════════════════════════════════════════════════════════════════
    // FULL SET FROST (2 hits: glide slash + ice freeze & shatter)
    // ═════════════════════════════════════════════════════════════════════════
    Player.playCombatAnimation('frost', {
      onHit: () => {
        try { Audio.playSlash(); } catch (e) {}
        applyHit1Damage();
        Effects.spawnHitSpark(BOSS_VFX_POS);
        Effects.spawnDamageNumber(BOSS_VFX_POS, hit1Label, '#88ddff');
        Effects.triggerShake(0.2, 0.2);
      },
      onDone: () => {
        setTimeout(() => {
          Effects.freezeBossInIce(BOSS_VFX_POS, 400, () => {
            try { Audio.playFrost(); } catch (e) {}
            applyHit2Damage();
            Effects.triggerFrostShatter(BOSS_VFX_POS, hit2Label);
            Effects.triggerShake(0.35, 0.4);
            setTimeout(() => {
              if (onDone) onDone();
            }, 450);
          });
        }, 70);
      },
    });
  }
}

// Backwards compatibility wrappers
export function runAttack(ev, onDone) {
  executeCombatTurn(ev, onDone);
}

export function runDodge(ev, onDone) {
  executeCombatTurn(ev, onDone);
}
