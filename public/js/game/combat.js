// THREE is available as a global from the CDN script tag
import * as Player  from './player.js';
import * as Boss    from './boss.js';
import * as Effects from './effects.js';
import * as VFX     from './vfx.js';
import * as Audio   from '../audio.js';
import * as hud     from '../ui/hud.js';
import { triggerCinematicShot, resetCameraToDefault, triggerCombatSlowMo, setCombatTimeScale, getFighterInstance, getFighters } from './scene.js';

export { playGuaranteedPlayerSlash, playArmSwingSlash, playSwordSlashAnimation, slashAnimation, getPlayerArmPivot, combatArmCompound, getCombatArmCompound } from './player.js';
export { playGuaranteedBossHammerSlam, getBossArmPivot, bossCombatArmCompound, getBossCombatArmCompound } from './boss.js';
export { PRESET_TRACKS, switchCombatBGM, handleCustomLocalFile } from '../audio.js';

// Normalize outfit key strictly to: 'default' | 'thunder' | 'fire' | 'frost'
export function getActivePlayerOutfit() {
  const raw = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('selectedOutfit'))
    || (typeof localStorage !== 'undefined' && localStorage.getItem('selectedOutfit'))
    || 'default';
  const clean = (typeof raw === 'string') ? raw.toLowerCase().trim() : 'default';
  if (['default', 'thunder', 'fire', 'frost'].includes(clean)) {
    return clean;
  }
  return 'default';
}

const BOSS_VFX_POS = new THREE.Vector3(4.8, 4.0, 0);

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// PROCEDURAL ANIME EYE GENERATORS (CRISP 800x200 VECTOR SVG)
// ─────────────────────────────────────────────────────────────────────────────
function generatePlayerAnimeEyeSVG(element) {
  const norm = (element || 'fire').toLowerCase();
  let irisGrad1 = '#ff0033';
  let irisGrad2 = '#ff6600';
  let irisGrad3 = '#ffee00';
  let emberColor = '#ff5500';
  let sparkColor = '#ffbb00';
  let glowColor = 'rgba(255, 69, 0, 0.8)';

  if (norm === 'frost' || norm === 'ice') {
    irisGrad1 = '#0052cc';
    irisGrad2 = '#00b4d8';
    irisGrad3 = '#e0f7ff';
    emberColor = '#00e5ff';
    sparkColor = '#90e0ef';
    glowColor = 'rgba(0, 229, 255, 0.8)';
  } else if (norm === 'thunder' || norm === 'lightning') {
    irisGrad1 = '#0044ff';
    irisGrad2 = '#00f0ff';
    irisGrad3 = '#ffffaa';
    emberColor = '#00e5ff';
    sparkColor = '#ffd700';
    glowColor = 'rgba(0, 240, 255, 0.85)';
  }

  return `
    <defs>
      <linearGradient id="pIrisGrad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="${irisGrad1}" />
        <stop offset="55%" stop-color="${irisGrad2}" />
        <stop offset="100%" stop-color="${irisGrad3}" />
      </linearGradient>
      <filter id="pBloom" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3.5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <rect width="800" height="200" fill="#080814" />
    <path d="M0,0 L800,200" stroke="rgba(255,255,255,0.04)" stroke-width="2" />
    <path d="M0,50 L800,150" stroke="rgba(255,255,255,0.04)" stroke-width="2" />

    <!-- Radiating Ember/Lightning particle trails -->
    <g filter="url(#pBloom)" stroke="${sparkColor}" stroke-width="2.5" fill="none">
      <path d="M60,100 L140,65 L200,85" opacity="0.8" />
      <path d="M580,80 L660,50 L740,95" opacity="0.8" />
      <path d="M180,155 L240,120 L300,135" opacity="0.7" />
      <path d="M480,135 L540,115 L600,165" opacity="0.7" />
      <circle cx="145" cy="60" r="4.5" fill="${sparkColor}" />
      <circle cx="655" cy="45" r="4.5" fill="${sparkColor}" />
      <circle cx="230" cy="165" r="3.5" fill="${emberColor}" />
      <circle cx="570" cy="170" r="3.5" fill="${emberColor}" />
      <circle cx="340" cy="45" r="2.5" fill="${sparkColor}" />
      <circle cx="450" cy="40" r="2.5" fill="${sparkColor}" />
    </g>

    <!-- Left Anime Eye -->
    <g transform="translate(230, 30)">
      <path d="M-85,18 Q0,45 70,60" stroke="#ffffff" stroke-width="8" stroke-linecap="round" fill="none" />
      <path d="M-85,18 Q0,45 70,60" stroke="${emberColor}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.8" />
      <path d="M-65,65 Q0,35 60,68 Q0,108 -65,65 Z" fill="#e2e8f0" />
      <path d="M-65,65 Q0,40 60,68 Q0,60 -65,65 Z" fill="rgba(0,0,0,0.35)" />
      <ellipse cx="-3" cy="68" rx="28" ry="34" fill="url(#pIrisGrad)" filter="url(#pBloom)" />
      <ellipse cx="-3" cy="68" rx="20" ry="26" fill="none" stroke="${sparkColor}" stroke-width="2" opacity="0.85" />
      <ellipse cx="-3" cy="68" rx="8" ry="17" fill="#050510" />
      <line x1="-3" y1="56" x2="-3" y2="80" stroke="${sparkColor}" stroke-width="2.5" />
      <circle cx="-10" cy="56" r="6" fill="#ffffff" />
      <circle cx="7" cy="80" r="3.2" fill="#ffffff" opacity="0.9" />
      <path d="M-74,62 Q-7,34 65,68" stroke="#0f172a" stroke-width="9" stroke-linecap="round" fill="none" />
      <path d="M58,66 L72,59" stroke="#0f172a" stroke-width="6" stroke-linecap="round" />
      <path d="M-42,95 Q0,106 36,97" stroke="#1e293b" stroke-width="3.5" stroke-linecap="round" fill="none" />
    </g>

    <!-- Right Anime Eye -->
    <g transform="translate(570, 30)">
      <path d="M-70,60 Q0,45 85,18" stroke="#ffffff" stroke-width="8" stroke-linecap="round" fill="none" />
      <path d="M-70,60 Q0,45 85,18" stroke="${emberColor}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.8" />
      <path d="M-60,68 Q0,35 65,65 Q0,108 -60,68 Z" fill="#e2e8f0" />
      <path d="M-60,68 Q0,40 65,65 Q0,60 -60,68 Z" fill="rgba(0,0,0,0.35)" />
      <ellipse cx="3" cy="68" rx="28" ry="34" fill="url(#pIrisGrad)" filter="url(#pBloom)" />
      <ellipse cx="3" cy="68" rx="20" ry="26" fill="none" stroke="${sparkColor}" stroke-width="2" opacity="0.85" />
      <ellipse cx="3" cy="68" rx="8" ry="17" fill="#050510" />
      <line x1="3" y1="56" x2="3" y2="80" stroke="${sparkColor}" stroke-width="2.5" />
      <circle cx="-5" cy="56" r="6" fill="#ffffff" />
      <circle cx="13" cy="80" r="3.2" fill="#ffffff" opacity="0.9" />
      <path d="M-65,68 Q7,34 74,62" stroke="#0f172a" stroke-width="9" stroke-linecap="round" fill="none" />
      <path d="M-58,66 L-72,59" stroke="#0f172a" stroke-width="6" stroke-linecap="round" />
      <path d="M-36,97 Q0,106 42,95" stroke="#1e293b" stroke-width="3.5" stroke-linecap="round" fill="none" />
    </g>`;
}

function generateBossAnimeEyeSVG(element) {
  const norm = (element || 'thunder').toLowerCase();
  let irisColor = '#ef233c';
  let slitGlow = '#ff0055';
  let auraColor = 'rgba(239, 35, 60, 0.55)';

  if (norm === 'frost' || norm === 'ice') {
    irisColor = '#00e5ff';
    slitGlow = '#80f4ff';
    auraColor = 'rgba(0, 229, 255, 0.55)';
  } else if (norm === 'thunder' || norm === 'lightning') {
    irisColor = '#ffd166';
    slitGlow = '#ffee33';
    auraColor = 'rgba(255, 209, 102, 0.55)';
  }

  return `
    <defs>
      <radialGradient id="bAuraGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${auraColor}" />
        <stop offset="100%" stop-color="rgba(10, 0, 15, 0)" />
      </radialGradient>
      <filter id="bDemonicGlow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <rect width="800" height="200" fill="#080106" />
    <circle cx="400" cy="100" r="180" fill="url(#bAuraGrad)" />

    <g stroke="rgba(239, 35, 60, 0.45)" stroke-width="2" fill="none">
      <path d="M90,60 L180,95 L240,90" />
      <path d="M710,60 L620,95 L560,90" />
      <path d="M150,150 L220,120 L270,135" />
      <path d="M650,150 L580,120 L530,135" />
      <circle cx="180" cy="95" r="3" fill="#ef233c" />
      <circle cx="620" cy="95" r="3" fill="#ef233c" />
    </g>

    <!-- Left Demonic Eye -->
    <g transform="translate(240, 35)">
      <path d="M-90,20 Q-15,55 65,65" stroke="#000000" stroke-width="12" stroke-linecap="round" fill="none" />
      <path d="M-85,25 Q-15,55 60,62" stroke="#4a0404" stroke-width="4.5" stroke-linecap="round" fill="none" />
      <path d="M-75,62 Q-15,48 50,65 Q-15,90 -75,62 Z" fill="#140204" stroke="#ef233c" stroke-width="1.5" />
      <ellipse cx="-15" cy="65" rx="25" ry="17" fill="${irisColor}" filter="url(#bDemonicGlow)" />
      <ellipse cx="-15" cy="65" rx="3.5" ry="15" fill="#000000" />
      <line x1="-15" y1="50" x2="-15" y2="80" stroke="${slitGlow}" stroke-width="2" />
    </g>

    <!-- Right Demonic Eye -->
    <g transform="translate(560, 35)">
      <path d="M-65,65 Q15,55 90,20" stroke="#000000" stroke-width="12" stroke-linecap="round" fill="none" />
      <path d="M-60,62 Q15,55 85,25" stroke="#4a0404" stroke-width="4.5" stroke-linecap="round" fill="none" />
      <path d="M-50,65 Q15,48 75,62 Q15,90 -50,65 Z" fill="#140204" stroke="#ef233c" stroke-width="1.5" />
      <ellipse cx="15" cy="65" rx="25" ry="17" fill="${irisColor}" filter="url(#bDemonicGlow)" />
      <ellipse cx="15" cy="65" rx="3.5" ry="15" fill="#000000" />
      <line x1="15" y1="50" x2="15" y2="80" stroke="${slitGlow}" stroke-width="2" />
    </g>`;
}

/**
 * Triggers the anime-style Eye Cut-In banner overlay (3.0s total duration with slow-mo freeze)
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
  }, 3500);

  const slashBar = document.getElementById('cutin-slash-bar');
  const eyeArt = document.getElementById('cutin-eye-art');
  const faction = document.getElementById('cutin-faction');
  const title = document.getElementById('cutin-title');

  const cleanup = () => {
    clearTimeout(bannerTimeout);
    banner.classList.remove('active', 'cutin-active', 'flash-active', 'cutin-player-milestone', 'cutin-boss-milestone', 'cutin-theme-fire', 'cutin-theme-ice', 'cutin-theme-lightning', 'cutin-theme-boss');
    banner.classList.add('cutin-hidden');
    banner.style.display = 'none';
    if (slashBar) slashBar.style.backgroundImage = '';
    if (eyeArt) eyeArt.style.backgroundImage = '';
    setCombatTimeScale(1.0);
  };

  banner.classList.remove('cutin-hidden', 'active', 'cutin-active', 'flash-active', 'cutin-player-milestone', 'cutin-boss-milestone');

  const normElem = (element || 'fire').toLowerCase();

  if (type === 'player') {
    // Sharp metallic slice sound effect
    try { Audio.playMetallicSlice?.(); } catch (e) {}

    const playerAsset = '/assets/ui/cutin_player.png';
    if (slashBar) slashBar.style.backgroundImage = `url('${playerAsset}')`;
    if (eyeArt) eyeArt.style.backgroundImage = `url('${playerAsset}')`;

    let titleText = 'DECISIVE HERO STRIKE';
    if (normElem === 'fire') {
      titleText = 'PURGATORY FIRE BLADE';
    } else if (normElem === 'frost' || normElem === 'ice') {
      titleText = 'GLACIAL ZERO SLASH';
    } else if (normElem === 'thunder' || normElem === 'lightning') {
      titleText = "THUNDER GOD'S JUDGMENT";
    }

    if (faction) faction.textContent = 'PLAYER AWAKENING';
    if (title) title.textContent = titleText;
    // Apply cyan/gold elemental glow border
    banner.classList.add('cutin-player-milestone');

  } else {
    // Boss menace milestone
    try { Audio.playMetallicSlice?.(); } catch (e) {}
    try { Audio.playBassDropRoar?.(); } catch (e) {}

    const bossAsset = '/assets/ui/cutin_boss.png';
    if (slashBar) slashBar.style.backgroundImage = `url('${bossAsset}')`;
    if (eyeArt) eyeArt.style.backgroundImage = `url('${bossAsset}')`;

    if (faction) faction.textContent = 'BOSS MENACE';
    if (title) title.textContent = 'WRATH OF THE TITAN';
    // Apply glowing crimson/purple ominous aura
    banner.classList.add('cutin-boss-milestone');
  }

  // Trigger slow-motion freeze during cut-in for 2.5s (ultra slow-mo timeScale = 0.08)
  setCombatTimeScale(0.08);

  banner.style.display = 'flex';
  banner.classList.add('cutin-overlay', 'cutin-active', 'active');

  // Force reflow for CSS transition
  void banner.offsetWidth;

  // Hold steadily across screen with subtle slow pan for 2.5s, then quick fade/slash out right at 2.8s
  setTimeout(() => {
    banner.classList.add('flash-active');
    setTimeout(() => {
      cleanup();
      finishOnce();
    }, 280);
  }, 2500);
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

// ─────────────────────────────────────────────────────────────────────────────
// OUTFIT-SPECIFIC COUNTER-ATTACK SLASH VFX HELPERS
// ─────────────────────────────────────────────────────────────────────────────
export function triggerIceSlashVFX(bossPosition) {
  VFX.spawnFrostSlashVFX(bossPosition);
  VFX.showCombatFloatingBanner('FROSTBITE!', '#38bdf8');
}

export function triggerThunderSlashVFX(bossPosition) {
  VFX.spawnThunderSlashVFX(bossPosition);
  VFX.showCombatFloatingBanner('SHOCKED!', '#facc15');
}

export function triggerFireSlashVFX(bossPosition) {
  VFX.spawnFireSlashVFX(bossPosition);
  VFX.showCombatFloatingBanner('BURNING!', '#f97316');
}

export function triggerNormalSlashVFX(bossPosition) {
  VFX.spawnPhysicalSlashVFX(bossPosition);
  VFX.showCombatFloatingBanner('CRITICAL HIT!', '#ffffff');
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
  }, 6000);

  const playerObj = Player.getPlayerObject();
  if (!playerObj || typeof TWEEN === 'undefined') {
    if (context.applyHit1Damage) context.applyHit1Damage();
    finishOnce();
    return;
  }

  // Ensure player starting position at (-4.5, 0, 0)
  playerObj.position.set(-4.5, 0.0, 0.0);

  // 1. Switch boss to angry pose: setBossPose('angry')
  Boss.setBossPose('angry');

  // 2. Tween playerGroup.position in a high leap toward the boss:
  //    In milestone hyper slow-mo (0.03x), player drifts upward in dodge pose over a full 2.8s (2800ms)
  const leapDuration = context.isMilestone ? 2800 : 450;
  Player.setPlayerPose('dodge');

  new TWEEN.Tween(playerObj.position)
    .to({ x: 1.5, y: 3.8, z: 0.0 }, leapDuration)
    .easing(context.isMilestone ? TWEEN.Easing.Sinusoidal.InOut : TWEEN.Easing.Quadratic.Out)
    .onComplete(() => {
      // 3. Exactly when strike starts at apex: Snap instantly back to timeScale = 1.0!
      if (context.isMilestone) {
        setCombatTimeScale(1.0);
      }
      // Switch pose: setPlayerPose('slash')
      Player.setPlayerPose('slash');

      // Fast downward strike tween to (3.2, 0.8, 0) in 150ms
      new TWEEN.Tween(playerObj.position)
        .to({ x: 3.2, y: 0.8, z: 0.0 }, 150)
        .easing(TWEEN.Easing.Quadratic.In)
        .onComplete(() => {
          const outfit = getActivePlayerOutfit();
          const bossObj = Boss.getBossObject?.();
          const targetPos = (bossObj && bossObj.position) ? bossObj.position : BOSS_VFX_POS;

          // 1. Apply Boss Damage & Procs based on equippedOutfit
          if (context.applyHit1Damage) context.applyHit1Damage();

          if (outfit === 'default') {
            // Default Outfit: 1 damage, physical metal spark VFX, CRITICAL HIT!
            Effects.triggerShake(context.isMilestone ? 0.65 : 0.25, context.isMilestone ? 0.5 : 0.25);
            Effects.spawnDamageNumber(targetPos, '-1 HP', '#ffffff', context.isMilestone ? 42 : 28);
            VFX.spawnPhysicalSlashVFX(targetPos);
            VFX.showCombatFloatingBanner('CRITICAL HIT!', '#ffffff');
          } else {
            // Elemental Outfits: 2 damage total (-1 slash, -1 elemental proc)
            Effects.triggerShake(context.isMilestone ? 0.65 : 0.35, context.isMilestone ? 0.5 : 0.3);
            const dmgColor = outfit === 'fire' ? '#ff4500' : (outfit === 'frost' ? '#38bdf8' : '#facc15');
            Effects.spawnDamageNumber(targetPos, '-2 HP', dmgColor, context.isMilestone ? 42 : 32);

            if (outfit === 'fire') {
              VFX.spawnFireSlashVFX(targetPos);
              VFX.showCombatFloatingBanner('BURNING! -1 HP', '#f97316');
              try { Audio.playFire?.(); } catch (e) {}
              setTimeout(() => {
                if (context.applyHit2Damage) context.applyHit2Damage();
                Effects.spawnFireVortexAroundBoss(targetPos);
                Effects.triggerFireBurst(targetPos, '-1 HP');
              }, 120);
            } else if (outfit === 'frost') {
              VFX.spawnFrostSlashVFX(targetPos);
              VFX.showCombatFloatingBanner('FROSTBITE! -1 HP', '#38bdf8');
              try { Audio.playFrost?.(); } catch (e) {}
              setTimeout(() => {
                if (context.applyHit2Damage) context.applyHit2Damage();
                Effects.triggerFrostShatter(targetPos, '-1 HP');
              }, 120);
            } else if (outfit === 'thunder') {
              VFX.spawnThunderSlashVFX(targetPos);
              VFX.showCombatFloatingBanner('SHOCKED! -1 HP', '#facc15');
              try { Audio.playThunder?.(); } catch (e) {}
              setTimeout(() => {
                if (context.applyHit2Damage) context.applyHit2Damage();
                Effects.triggerLightningSlash(targetPos, '-1 HP');
              }, 120);
            }
          }

          // 2. Boss takes hit reaction
          Boss.setBossPose('hit');
          Boss.playBossHurt();

          setTimeout(() => {
            Boss.setBossPose('angry');
            setTimeout(() => {
              Boss.setBossPose('idle');
            }, 1100);
          }, 300);

          // 3. Leap back: Tween playerGroup.position back to (-4.5, 0, 0) in 400ms -> setPlayerPose('idle')
          new TWEEN.Tween(playerObj.position)
            .to({ x: -4.5, y: 0.0, z: 0.0 }, 400)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onComplete(() => {
              Player.setPlayerPose('idle');
              clearTimeout(safetyTimeout);
              finishOnce();
            })
            .start();
        })
        .start();
    })
    .start();
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

  const mode = window.gameState?.mode || 'team_vs_boss';
  const isPvP = (mode === 'pvp_1v1' || mode === 'pvp' || (ev.victimId && ev.victimId !== 'boss' && ev.attackerId !== 'boss'));
  const { p1, p2 } = getFighters();
  const isMultiplayerTeam = (!isPvP && p1 && p2);

  if (isPvP) {
    if (ev.type === 'attack') {
      const attacker = getFighterInstance(ev.attackerId);
      const victim = getFighterInstance(ev.victimId);
      if (!attacker || !victim) {
        doneWrapper();
        return;
      }
      triggerCinematicShot();
      const targetX = victim.homePos.x * 0.45;
      const targetZ = victim.homePos.z;

      attacker.playSlash({
        targetX,
        targetZ,
        onHit: () => {
          try { Audio.playSlash?.(); } catch (e) {}
          try { Audio.playHit?.(); } catch (e) {}
          Effects.triggerShake(0.35, 0.25);
          Effects.spawnHitSpark(victim.group.position);

          const dmg = ev.damage || (ev.hasElemental ? 1 : 2);
          const hitColor = ev.hasElemental ? '#00cfff' : '#ef4444';
          const textPos = new THREE.Vector3(victim.group.position.x, victim.group.position.y + 2.0, victim.group.position.z);
          Effects.spawnDamageNumber(textPos, `-${dmg} HP`, hitColor, 32);

          const outfit = ev.attackerOutfit || attacker.outfit || 'default';
          if (outfit === 'fire') {
            VFX.spawnFireSlashVFX(victim.group.position);
            VFX.showCombatFloatingBanner(`BURNING! -${dmg} HP`, '#f97316');
            try { Audio.playFire?.(); } catch (e) {}
          } else if (outfit === 'frost') {
            VFX.spawnFrostSlashVFX(victim.group.position);
            VFX.showCombatFloatingBanner(`FROSTBITE! -${dmg} HP`, '#38bdf8');
            try { Audio.playFrost?.(); } catch (e) {}
          } else if (outfit === 'thunder') {
            VFX.spawnThunderSlashVFX(victim.group.position);
            VFX.showCombatFloatingBanner(`SHOCKED! -${dmg} HP`, '#facc15');
            try { Audio.playThunder?.(); } catch (e) {}
          } else {
            VFX.spawnPhysicalSlashVFX(victim.group.position);
            VFX.showCombatFloatingBanner(`CRITICAL HIT! -${dmg} HP`, '#ffffff');
          }

          victim.playHurt?.({ onDone: () => {} });

          if (ev.victimRemainingHp !== undefined && hud.updateHpBars) {
            const hpMap = {};
            hpMap[ev.victimId] = ev.victimRemainingHp;
            hud.updateHpBars(hpMap);
          }
        },
        onDone: () => {
          resetCameraToDefault(300, doneWrapper);
        }
      });
      return;
    } else {
      // Dodge / Miss in PvP
      const target = getFighterInstance(ev.targetId);
      if (target && target.playDodge) {
        const tPos = target.group ? target.group.position : (target.homePos || new THREE.Vector3(0, 0, 0));
        const textPos = new THREE.Vector3(tPos.x, tPos.y + 2.0, tPos.z);
        Effects.spawnDamageNumber(textPos, `NÉ ĐÒN!`, '#06d6a0', 36);
        VFX.showCombatFloatingBanner(`DODGE!`, '#06d6a0');
        try { Audio.playBlip?.(); } catch (e) {}
        target.playDodge({ onDone: doneWrapper });
      } else {
        doneWrapper();
      }
      return;
    }
  }

  if (isMultiplayerTeam) {
    if (ev.type === 'attack' && ev.victimId === 'boss') {
      const attacker = getFighterInstance(ev.attackerId);
      if (!attacker) {
        doneWrapper();
        return;
      }
      triggerCinematicShot();
      const targetX = 2.8;
      const targetZ = attacker.homePos.z * 0.4;
      const bossObj = Boss.getBossObject?.();
      const bossPos = (bossObj && bossObj.position) ? bossObj.position : BOSS_VFX_POS;

      attacker.playSlash({
        targetX,
        targetZ,
        onHit: () => {
          try { Audio.playSlash?.(); } catch (e) {}
          Effects.triggerShake(0.35, 0.3);

          const dmg = ev.damage || (ev.hasElemental ? 2 : 1);
          const outfit = ev.outfit || attacker.outfit || 'default';
          const dmgColor = outfit === 'fire' ? '#ff4500' : (outfit === 'frost' ? '#38bdf8' : (outfit === 'thunder' ? '#facc15' : '#ffffff'));
          Effects.spawnDamageNumber(bossPos, `-${dmg} HP`, dmgColor, 32);

          if (outfit === 'fire') {
            VFX.spawnFireSlashVFX(bossPos);
            VFX.showCombatFloatingBanner(`BURNING! -${dmg} HP`, '#f97316');
            try { Audio.playFire?.(); } catch (e) {}
          } else if (outfit === 'frost') {
            VFX.spawnFrostSlashVFX(bossPos);
            VFX.showCombatFloatingBanner(`FROSTBITE! -${dmg} HP`, '#38bdf8');
            try { Audio.playFrost?.(); } catch (e) {}
          } else if (outfit === 'thunder') {
            VFX.spawnThunderSlashVFX(bossPos);
            VFX.showCombatFloatingBanner(`SHOCKED! -${dmg} HP`, '#facc15');
            try { Audio.playThunder?.(); } catch (e) {}
          } else {
            VFX.spawnPhysicalSlashVFX(bossPos);
            VFX.showCombatFloatingBanner(`CRITICAL HIT! -${dmg} HP`, '#ffffff');
          }

          Boss.setBossPose('hit');
          Boss.playBossHurt();

          if (ev.currentBossHp !== undefined && ev.totalQuestions) {
            const pct = (ev.currentBossHp / ev.totalQuestions) * 100;
            Boss.setBossHpPercent(pct);
            if (hud.setBossVisualHpPercent) hud.setBossVisualHpPercent(pct);
          }

          setTimeout(() => {
            Boss.setBossPose('idle');
          }, 400);
        },
        onDone: () => {
          resetCameraToDefault(300, doneWrapper);
        }
      });
      return;
    } else if (ev.type === 'dodge') {
      const victim = getFighterInstance(ev.targetId || ev.victimId);
      const bElem = ev.element || ev.bossElement || Boss.getBossElement() || 'thunder';
      triggerCinematicShot();

      Boss.setBossPose('angry');
      setTimeout(() => {
        Boss.setBossPose('attack');
        Boss.playBossAttack(bElem, () => {
          Effects.triggerShake(0.2, 0.15);
          const vPos = victim ? victim.group.position : new THREE.Vector3(-4.5, 0, 0);
          const textPos = new THREE.Vector3(vPos.x, vPos.y + 2.0, vPos.z);
          Effects.spawnDamageNumber(textPos, `NÉ ĐÒN!`, '#06d6a0', 36);
          VFX.showCombatFloatingBanner(`DODGE! NÉ ĐÒN THÀNH CÔNG!`, '#06d6a0');
          try { Audio.playBlip?.(); } catch (e) {}

          victim?.playDodge?.({ onDone: () => {} });

          setTimeout(() => {
            Boss.setBossPose('idle');
            resetCameraToDefault(300, doneWrapper);
          }, 450);
        }, () => {});
      }, 400);
      return;
    } else if (ev.attackerId === 'boss' || ev.victimId) {
      const victim = getFighterInstance(ev.victimId || ev.targetId);
      const bElem = ev.element || ev.bossElement || Boss.getBossElement() || 'thunder';
      triggerCinematicShot();

      Boss.setBossPose('angry');
      setTimeout(() => {
        Boss.setBossPose('attack');
        Boss.playBossAttack(bElem, () => {
          try { Audio.playHit?.(); } catch (e) {}
          Effects.triggerShake(0.45, 0.35);
          Effects.screenFlash('rgba(239,35,60,0.4)', 0.3);

          const incomingDmg = (ev.damage !== undefined) ? ev.damage : (ev.hasElemental ? 1 : 2);
          const dmgLabel = `-${incomingDmg} HP`;
          const vPos = victim ? victim.group.position : new THREE.Vector3(-4.5, 0, 0);
          const textPos = new THREE.Vector3(vPos.x, vPos.y + 2.0, vPos.z);
          Effects.spawnDamageNumber(textPos, dmgLabel, incomingDmg === 1 ? '#00cfff' : '#ef4444', 32);

          Effects.triggerPlayerHitVFX(bElem, vPos);
          victim?.playHurt?.({ onDone: () => {} });

          if (ev.remainingPlayerHp !== undefined && hud.updateHpBars) {
            const hpMap = {};
            if (victim) hpMap[victim.id] = ev.remainingPlayerHp;
            hud.updateHpBars(hpMap, ev.currentBossHp);
          }

          setTimeout(() => {
            Boss.setBossPose('idle');
            resetCameraToDefault(300, doneWrapper);
          }, 450);
        }, () => {});
      }, 500);
      return;
    }
  }

  const activeOutfit = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('selectedOutfit'))
    || (typeof localStorage !== 'undefined' && localStorage.getItem('selectedOutfit'))
    || 'default';
  const playerOutfit = activeOutfit;
  const isFireSet = (playerOutfit === 'fire');
  const isFullSet = (playerOutfit !== 'default' && ['thunder', 'fire', 'frost'].includes(playerOutfit));
  const selectedElement = isFullSet ? playerOutfit : null;
  const bossElement = ev.element || Boss.getBossElement() || 'thunder';

  // Combat status determination
  const isCorrect = (ev.isCorrect !== undefined)
    ? ev.isCorrect
    : (ev.type === 'attack');

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

  // Floating text strictly '-2 HP' (or '⚡ -1 HP', '🔥 -1 HP', '❄️ -1 HP')
  const hit1Label = selectedElement
    ? (selectedElement === 'thunder' ? '⚡ -1 HP' : selectedElement === 'fire' ? '🔥 -1 HP' : '❄️ -1 HP')
    : '-2 HP';
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

  const questionNumber = (ev.questionNumber !== undefined)
    ? ev.questionNumber
    : (ev.index !== undefined ? ev.index : (qIdx + 1));
  const isPlayerMilestone = isCorrect && (questionNumber > 0 && questionNumber % 10 === 0);
  const isBossMilestone = !isCorrect && (questionNumber > 0 && questionNumber % 10 === 5);

  const executeCorrectBranch = () => {
    if (isPlayerMilestone) {
      // True Anime Hyper Slow-Motion Freeze-Frame Drift (timeScale = 0.03) for 2.8s
      setCombatTimeScale(0.03);
      // Shot 2: Low-Angle Hero Cam gliding slowly around the floating player in dodge pose
      triggerCinematicShot(2, 2800);
    } else {
      // Randomly select one of the 5 distinct cinematic camera angles
      triggerCinematicShot();
    }

    handleCorrectAnswer(selectedElement, isFullSet, () => {
      setCombatTimeScale(1.0);
      resetCameraToDefault(600, doneWrapper);
    }, { ...context, isMilestone: isPlayerMilestone });
  };

  const executeBossBranch = () => {
    const bossObj = Boss.getBossObject();
    const playerObj = Player.getPlayerObject();
    Boss.setBossPositionOverride(true);

    if (isBossMilestone) {
      // 1. True Anime Hyper Slow-Motion Freeze-Frame Drift (timeScale = 0.03) for 2.8s
      setCombatTimeScale(0.03);
      // Shot 3: Over-the-Shoulder Boss Cam looking down at player (doubled distance)
      triggerCinematicShot(3, 2800);

      // Player in dodge pose trying to evade
      Player.setPlayerPose('dodge');
      Boss.setBossPose('angry');

      // Spawn ground wave / projectile creeping toward player during the 2.8s hyper slow-mo!
      if (bossElement === 'frost') {
        Effects.spawnBossFrostSpikeWave(
          new THREE.Vector3(4.8 - 0.5, 0.05, 0),
          new THREE.Vector3(-4.5, 0.05, 0),
          2700,
          null
        );
      } else if (bossElement === 'fire') {
        Effects.spawnBossMoltenFlameWave(
          new THREE.Vector3(4.8 - 0.5, 0.05, 0),
          new THREE.Vector3(-4.5, 0.05, 0),
          2700,
          null
        );
      } else {
        Effects.spawnBossLightningBeam(
          new THREE.Vector3(4.8 - 0.5, 3.8, 0),
          new THREE.Vector3(-4.5, 1.5, 0),
          2700,
          null
        );
      }

      // Slow charge & projectile creep for 2800ms
      setTimeout(() => {
        // Exactly when the strike or projectile hits: snap instantly back to timeScale = 1.0!
        setCombatTimeScale(1.0);
        Boss.setBossPose('attack');

        try { Audio.playHit?.(); } catch (e) {}
        Effects.triggerShake(0.75, 0.6);
        Effects.screenFlash('rgba(239,35,60,0.6)', 0.4);

        const outfit = getActivePlayerOutfit();
        const incomingDamage = (outfit === 'default') ? 2 : 1;
        const dmgLabel = `💥 BARRAGE -${incomingDamage} HP`;
        const playerPos = Player.getPosition();
        const textPos = new THREE.Vector3(playerPos.x, playerPos.y + 2.0, playerPos.z);
        Effects.spawnDamageNumber(textPos, dmgLabel, '#ef4444', 40);

        // Full-body damage VFX upon hit (Fire: burning, Frost: frozen ice block, Thunder: lightning explosion)
        Effects.triggerPlayerHitVFX(bossElement, playerPos);

        Player.setPlayerPose('hit');
        if (playerObj && typeof TWEEN !== 'undefined') {
          new TWEEN.Tween(playerObj.position)
            .to({ x: -5.4, y: 0.0, z: 0.0 }, 150)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();
        }

        setTimeout(() => {
          if (playerObj && typeof TWEEN !== 'undefined') {
            new TWEEN.Tween(playerObj.position)
              .to({ x: -4.5, y: 0.0, z: 0.0 }, 250)
              .easing(TWEEN.Easing.Quadratic.Out)
              .onComplete(() => {
                Player.setPlayerPose('idle');
              })
              .start();
          } else {
            Player.setPlayerPose('idle');
          }

          Boss.setBossPositionOverride(false);
          Boss.setBossPose('idle');
          if (ev.remainingPlayerHp !== undefined && hud.updateHpBars) {
            const hpMap = {};
            if (window.gameState?.myId) hpMap[window.gameState.myId] = ev.remainingPlayerHp;
            hud.updateHpBars(hpMap, ev.currentBossHp);
          }
          resetCameraToDefault(500, doneWrapper);
        }, 500);

      }, 2800);

    } else {
      // Normal wrong answer:
      triggerCinematicShot();
      Boss.setBossPose('angry');

      setTimeout(() => {
        Boss.setBossPose('attack');
        if (bossObj && typeof TWEEN !== 'undefined') {
          new TWEEN.Tween(bossObj.position)
            .to({ x: 3.0, y: 0.0, z: 0.0 }, 300)
            .easing(TWEEN.Easing.Quadratic.Out)
            .start();
        }

        Boss.playBossAttack(bossElement, () => {
          try { Audio.playHit?.(); } catch (e) {}
          Effects.triggerShake(0.45, 0.35);
          Effects.screenFlash('rgba(239,35,60,0.4)', 0.3);

          const outfit = getActivePlayerOutfit();
          const incomingDamage = (outfit === 'default') ? 2 : 1;
          const dmgLabel = `-${incomingDamage} HP`;
          const playerPos = Player.getPosition();
          const textPos = new THREE.Vector3(playerPos.x, playerPos.y + 2.0, playerPos.z);
          Effects.spawnDamageNumber(textPos, dmgLabel, incomingDamage === 1 ? '#ffd166' : '#ef4444', 32);

          // Full-body damage VFX upon hit (Fire: burning, Frost: frozen ice block, Thunder: lightning explosion)
          Effects.triggerPlayerHitVFX(bossElement, playerPos);

          Player.setPlayerPose('hit');
          if (playerObj && typeof TWEEN !== 'undefined') {
            new TWEEN.Tween(playerObj.position)
              .to({ x: -5.2, y: 0.0, z: 0.0 }, 150)
              .easing(TWEEN.Easing.Quadratic.Out)
              .start();
          }

          setTimeout(() => {
            if (playerObj && typeof TWEEN !== 'undefined') {
              new TWEEN.Tween(playerObj.position)
                .to({ x: -4.5, y: 0.0, z: 0.0 }, 250)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onComplete(() => {
                  Player.setPlayerPose('idle');
                })
                .start();
            } else {
              Player.setPlayerPose('idle');
            }

            if (bossObj && typeof TWEEN !== 'undefined') {
              new TWEEN.Tween(bossObj.position)
                .to({ x: 4.5, y: 0.0, z: 0.0 }, 300)
                .easing(TWEEN.Easing.Quadratic.Out)
                .onComplete(() => {
                  Boss.setBossPositionOverride(false);
                  Boss.setBossPose('idle');
                  if (ev.remainingPlayerHp !== undefined && hud.updateHpBars) {
                    const hpMap = {};
                    if (window.gameState?.myId) hpMap[window.gameState.myId] = ev.remainingPlayerHp;
                    hud.updateHpBars(hpMap, ev.currentBossHp);
                  }
                  resetCameraToDefault(500, doneWrapper);
                })
                .start();
            } else {
              Boss.setBossPositionOverride(false);
              Boss.setBossPose('idle');
              resetCameraToDefault(500, doneWrapper);
            }
          }, 500);
        }, () => {});
      }, 1100);
    }
  };

  if (isCorrect) {
    // ═════════════════════════════════════════════════════════════════════════
    // BRANCH A: Player answered CORRECTLY
    // ═════════════════════════════════════════════════════════════════════════
    if (isPlayerMilestone) {
      playCutInBanner({
        type: 'player',
        element: (selectedElement && selectedElement !== 'default') ? selectedElement : 'fire',
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

