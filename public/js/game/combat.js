// THREE is available as a global from the CDN script tag
import * as Player  from './player.js';
import * as Boss    from './boss.js';
import * as Effects from './effects.js';
import * as Audio   from '../audio.js';

const BOSS_VFX_POS = new THREE.Vector3(3.0, 4.0, 0);

/**
 * Executes one of the 4 distinct combat attack sequences:
 * A. Normal / Incomplete Set (1-hit basic slash)
 * B. Full Set Thunder (dive slash + sky lightning bolt strike, 2-hit)
 * C. Full Set Fire (stand-firm power swing + flame projectile + burning burst, 2-hit)
 * D. Full Set Frost (glide horizontal slash + full ice encasement & shatter, 2-hit)
 *
 * @param {Object} ev - Combat event payload { damage, hasFullSet, equippedSet, element }
 * @param {Function} onDone - Callback to release combat turn lock
 */
export function runAttack(ev, onDone) {
  const hasFullSet  = ev.hasFullSet || false;
  const rawElement  = ev.equippedSet || Player.getActiveElement() || null;
  const isElemental = hasFullSet && ['thunder', 'fire', 'frost'].includes(rawElement);
  const element     = isElemental ? rawElement : null;

  if (!isElemental) {
    // ═════════════════════════════════════════════════════════════════════════
    // A. BỘ THƯỜNG / CHƯA ĐỦ BỘ (Normal / Incomplete Set)
    // 1. Lao vào: Character dashes straight up to Boss's front (250ms).
    // 2. Chém: Weapon pivot slashes down 75° into Boss's torso (150ms).
    // 3. Sát thương: Boss takes -1 HP. Play basic slash sound.
    // 4. Lùi về: Character dashes back to original position. Turn ends.
    // ═════════════════════════════════════════════════════════════════════════
    Player.playCombatAnimation('normal', {
      onHit: () => {
        try { Audio.playSlash(); } catch (e) {}
        Boss.playBossHurt();
        Effects.spawnHitSpark(BOSS_VFX_POS);
        Effects.spawnDamageNumber(BOSS_VFX_POS, '-1 HP', '#ffee44');
        Effects.triggerShake(0.18, 0.25);
      },
      onDone: () => {
        if (onDone) onDone();
      },
    });

  } else if (element === 'thunder') {
    // ═════════════════════════════════════════════════════════════════════════
    // B. FULL SET SÉT (Thunder Set)
    // 1. Bay lên cao: Leaps high into the air above Boss (y+3.5, bossX-0.5, 350ms).
    // 2. Bổ xuống: Dives straight down, sword onto Boss's head (180ms) -> Boss -1 HP.
    // 3. Lùi về: Leaps backward to original spot.
    // 4. Hiệu ứng Sét: Massive procedural lightning bolt strikes Boss -> Boss -1 HP (Total -2 HP).
    // ═════════════════════════════════════════════════════════════════════════
    Player.playCombatAnimation('thunder', {
      onHit: () => {
        try { Audio.playSlash(); } catch (e) {}
        Boss.playBossHurt();
        Effects.spawnHitSpark(BOSS_VFX_POS);
        Effects.spawnDamageNumber(BOSS_VFX_POS, '-1 HP', '#00ffff');
        Effects.triggerShake(0.25, 0.25);
      },
      onDone: () => {
        // Character has landed back at home position — now trigger sky lightning strike
        setTimeout(() => {
          try { Audio.playThunder(); } catch (e) {}
          Effects.triggerLightningSlash(BOSS_VFX_POS, '⚡ -1 HP');
          Boss.playBossHurt();
          setTimeout(() => {
            if (onDone) onDone();
          }, 550);
        }, 90);
      },
    });

  } else if (element === 'fire') {
    // ═════════════════════════════════════════════════════════════════════════
    // C. FULL SET LỬA (Fire Set)
    // 1. Đứng tại chỗ: Stands firmly, powerful sword swing forward (250ms).
    // 2. Hiệu ứng Lửa: Blazing flame projectile flies toward Boss. Fire burst surrounds Boss.
    // 3. Sát thương: Boss takes -1 HP, then fire continues burning for -1 HP (Total -2 HP).
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
        // Swing moment: launch flame projectile from character to Boss
        try { Audio.playFire(); } catch (e) {}
        const playerPos = Player.getPosition();
        const startPos  = new THREE.Vector3(playerPos.x + 0.8, playerPos.y + 0.5, playerPos.z);

        Effects.spawnFlameProjectile(startPos, BOSS_VFX_POS, () => {
          // Flame wave reaches Boss: Boss -1 HP
          Boss.playBossHurt();
          Effects.triggerFireBurst(BOSS_VFX_POS, '🔥 -1 HP');
          Effects.triggerShake(0.35, 0.35);

          // Fire continues burning: secondary explosion for second -1 HP
          setTimeout(() => {
            try { Audio.playFire(); } catch (e) {}
            Boss.playBossHurt();
            Effects.spawnDamageNumber(BOSS_VFX_POS, '🔥 -1 HP', '#ff3300', 26);
            Effects.triggerShake(0.25, 0.3);
            setTimeout(() => {
              finishOnce();
            }, 450);
          }, 400);
        });
      },
      onDone: () => {
        // Player returned to stance; flight & burn sequence will conclude via callbacks
      },
    });

  } else if (element === 'frost') {
    // ═════════════════════════════════════════════════════════════════════════
    // D. FULL SET BĂNG (Frost Set)
    // 1. Lướt chém: Glides forward right into Boss, horizontal slash (200ms) -> Boss -1 HP.
    // 2. Lùi lại: Slides backward to original stance.
    // 3. Hiệu ứng Băng: Blue crystalline ice grows from feet up, encasing Boss (400ms).
    // 4. Sát thương: Ice shatters -> Boss -1 HP (Total -2 HP). Play ice shatter SFX.
    // ═════════════════════════════════════════════════════════════════════════
    Player.playCombatAnimation('frost', {
      onHit: () => {
        try { Audio.playSlash(); } catch (e) {}
        Boss.playBossHurt();
        Effects.spawnHitSpark(BOSS_VFX_POS);
        Effects.spawnDamageNumber(BOSS_VFX_POS, '-1 HP', '#88ddff');
        Effects.triggerShake(0.2, 0.2);
      },
      onDone: () => {
        // Character slid back to original stance — encase Boss in ice
        setTimeout(() => {
          Effects.freezeBossInIce(BOSS_VFX_POS, 400, () => {
            // Ice shatters!
            try { Audio.playFrost(); } catch (e) {}
            Boss.playBossHurt();
            Effects.triggerFrostShatter(BOSS_VFX_POS, '❄️ -1 HP');
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
