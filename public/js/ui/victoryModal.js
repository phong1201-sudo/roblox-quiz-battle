/**
 * public/js/ui/victoryModal.js
 * Manages the Reward / Victory modal and audio handling
 */
import * as Audio from '../audio.js';

export function showRewardModal(onClaim) {
  const modal = document.getElementById('reward-modal');
  if (!modal) return;
  modal.style.display = 'flex';

  const closeBtn = document.getElementById('reward-modal-close');
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = 'none';
      try {
        // Stop Battle BGM and play Victory / Fanfare sound effect once
        Audio.stopBGM();
        Audio.playVictory();
      } catch (e) {}
      if (onClaim) onClaim();
    };
  }
}

export function hideRewardModal() {
  const modal = document.getElementById('reward-modal');
  if (modal) modal.style.display = 'none';
}
