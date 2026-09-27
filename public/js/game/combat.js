// THREE is available as a global from the CDN script tag
import * as Player  from './player.js';
import * as Boss    from './boss.js';
import * as Effects from './effects.js';
import * as Audio   from '../audio.js';
import * as hud     from '../ui/hud.js';

const BOSS_VFX_POS = new THREE.Vector3(3.0, 4.0, 0);

/**
 * Executes one of the 4 distinct combat attack sequences:
 * A. Normal / Incomplete Set (1-hit basic slash) -> Boss loses (100 / totalQuestions)%
 * B. Full Set Thunder (dive slash + sky lightning bolt strike, 2-hit) -> 2x (50 / totalQuestions)%
 * C. Full Set Fire (stand-firm power swing + flame projectile + burning burst, 2-hit) -> 2x (50 / totalQuestions)%
 * D. Full Set Frost (glide horizontal slash + full ice encasement & shatter, 2-hit) -> 2x (50 / totalQuestions)%
 *
 * @param {Object} ev - Combat event payload { damage, hasFullSet, equippedSet, element, totalQuestions, currentBossHp }
 * @param {Function} onDone - Callback to release combat turn lock
 */
export function runAttack(ev, onDone) {
  const hasFullSet  = ev.hasFullSet || false;
  const rawElement  = ev.equippedSet || Player.getActiveElement() || null;
  const isElemental = hasFullSet && ['thunder', 'fire', 'frost'].includes(rawElement);
  const element     = isElemental ? rawElement : null;

  // Percentage calculations based on total question count (e.g. 20 -> 5%, 30 -> 3.3%, 50 -> 2%, 5 -> 20%)
  const totalQ   = ev.totalQuestions || window.gameState?.totalHp || 20;
  const pctTotal = 100 / Math.max(1, totalQ);
  const pctHit1  = hasFullSet ? (pctTotal / 2) : pctTotal;
  const pctHit2  = hasFullSet ? (pctTotal / 2) : 0;

  const hit1Label = `-${Math.round(pctHit1 * 10) / 10}%`;
  const hit2Label = `-${Math.round(pctHit2 * 10) / 10}%`;

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

  if (!isElemental) {
    // ═════════════════════════════════════════════════════════════════════════
    // A. BỘ THƯỜNG / CHƯA ĐỦ BỘ (Normal / Incomplete Set: 1 hit)
    // 1. Lao vào: Character dashes straight up to Boss's front (250ms).
    // 2. Chém: Weapon pivot slashes down 75° into Boss's torso (150ms).
    // 3. Sát thương: Boss loses (100 / totalQuestions)% in 1 hit.
    // 4. Lùi về: Character dashes back to original position. Turn ends.
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

  } else if (element === 'thunder') {
    // ═════════════════════════════════════════════════════════════════════════
    // B. FULL SET SÉT (Thunder Set: 2 hits, (50/N)% + (50/N)%)
    // 1. Bay lên cao: Leaps high into the air above Boss (350ms).
    // 2. Bổ xuống: Dives straight down onto Boss -> Hit 1: (50 / totalQuestions)%.
    // 3. Lùi về: Leaps backward to original spot.
    // 4. Hiệu ứng Sét: Sky lightning bolt strikes Boss -> Hit 2: (50 / totalQuestions)%.
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
          Effects.triggerLightningSlash(BOSS_VFX_POS, `⚡ ${hit2Label}`);
          setTimeout(() => {
            if (onDone) onDone();
          }, 550);
        }, 90);
      },
    });

  } else if (element === 'fire') {
    // ═════════════════════════════════════════════════════════════════════════
    // C. FULL SET LỬA (Fire Set: 2 hits, (50/N)% + (50/N)%)
    // 1. Đứng tại chỗ: Power sword swing forward (250ms).
    // 2. Hiệu ứng Lửa: Blazing flame projectile flies toward Boss -> Hit 1: (50/N)%.
    // 3. Sát thương tiếp diễn: Flame burst explodes for Hit 2: (50/N)%.
    // ═════════════════════════════════════════════════════════════════════════
    let combatFinished = false;
    const finishOnce = () => {
      if (!combatFinished) {
        combatFinished = true;
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
          Effects.triggerFireBurst(BOSS_VFX_POS, `🔥 ${hit1Label}`);
          Effects.triggerShake(0.35, 0.35);

          // Fire continues burning: secondary burst for second hit
          setTimeout(() => {
            try { Audio.playFire(); } catch (e) {}
            applyHit2Damage();
            Effects.spawnDamageNumber(BOSS_VFX_POS, `🔥 ${hit2Label}`, '#ff3300', 26);
            Effects.triggerShake(0.25, 0.3);
            setTimeout(() => {
              finishOnce();
            }, 450);
          }, 400);
        });
      },
      onDone: () => {},
    });

  } else if (element === 'frost') {
    // ═════════════════════════════════════════════════════════════════════════
    // D. FULL SET BĂNG (Frost Set: 2 hits, (50/N)% + (50/N)%)
    // 1. Lướt chém: Glides forward right into Boss -> Hit 1: (50/N)%.
    // 2. Lùi lại: Slides backward to original stance.
    // 3. Hiệu ứng Băng: Encases Boss in ice (400ms).
    // 4. Băng vỡ: Ice shatters -> Hit 2: (50/N)%.
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
            Effects.triggerFrostShatter(BOSS_VFX_POS, `❄️ ${hit2Label}`);
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

/**
 * Dodge execution when player answers incorrectly
 */
export function runDodge(ev, onDone) {
  Boss.playBossDodge();
  Effects.spawnDamageNumber(new THREE.Vector3(3, 6, 0), 'DODGE!', '#ffbe0b');
  Player.playRushMiss(() => {
    if (onDone) onDone();
  });
}
