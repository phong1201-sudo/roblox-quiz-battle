/**
 * public/js/ui/bgmSelector.js
 *
 * Custom Battle BGM Selector modal controller.
 * Supports preset battle tracks and local custom MP3 file upload with instant playback.
 */

import {
  PRESET_TRACKS,
  switchCombatBGM,
  handleCustomLocalFile,
  setBgmVolume,
  getBgmVolume,
  isInBattle,
  customBlobUrl
} from '../audio.js';

let modalElement = null;
let customFileLabel = null;

export function openBgmSelector() {
  if (!modalElement) {
    modalElement = document.getElementById('bgm-selector-modal');
  }
  if (modalElement) {
    modalElement.style.display = 'flex';
    syncUIState();
  }
}

export function closeBgmSelector() {
  if (!modalElement) {
    modalElement = document.getElementById('bgm-selector-modal');
  }
  if (modalElement) {
    modalElement.style.display = 'none';
  }
}

function syncUIState() {
  const currentVol = Math.round(getBgmVolume() * 100);
  const slider = document.getElementById('bgm-volume-slider');
  const volVal = document.getElementById('bgm-volume-val');
  if (slider) slider.value = currentVol;
  if (volVal) volVal.textContent = `${currentVol}%`;

  const savedTrackId = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('selectedCombatBgm'))
    || (typeof localStorage !== 'undefined' && localStorage.getItem('selectedCombatBgm'))
    || 'default';

  const radios = document.querySelectorAll('input[name="bgm-preset-choice"]');
  radios.forEach(radio => {
    radio.checked = !customBlobUrl && (radio.value === savedTrackId);
  });

  if (customFileLabel) {
    if (customBlobUrl) {
      customFileLabel.textContent = '🎵 Đang dùng file tải lên cá nhân';
      customFileLabel.style.color = '#06d6a0';
    } else {
      customFileLabel.textContent = 'Chưa chọn file local';
      customFileLabel.style.color = '#94a3b8';
    }
  }
}

export function initBgmSelector() {
  modalElement = document.getElementById('bgm-selector-modal');
  window.openBgmSelector = openBgmSelector;
  window.closeBgmSelector = closeBgmSelector;

  // Render presets
  const presetsContainer = document.getElementById('bgm-presets-container');
  if (presetsContainer) {
    presetsContainer.innerHTML = '';
    const savedTrackId = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('selectedCombatBgm'))
      || (typeof localStorage !== 'undefined' && localStorage.getItem('selectedCombatBgm'))
      || 'default';

    PRESET_TRACKS.forEach(track => {
      const item = document.createElement('label');
      item.className = 'bgm-preset-item';
      item.innerHTML = `
        <input type="radio" name="bgm-preset-choice" value="${track.id}" ${track.id === savedTrackId ? 'checked' : ''}>
        <div class="bgm-preset-info">
          <span class="bgm-preset-name">${track.name}</span>
          <span class="bgm-preset-id">#${track.id}</span>
        </div>
        <span class="bgm-preset-icon">▶</span>
      `;

      item.querySelector('input').addEventListener('change', () => {
        try {
          sessionStorage.setItem('selectedCombatBgm', track.id);
          localStorage.setItem('selectedCombatBgm', track.id);
        } catch (e) {}

        if (customFileLabel) {
          customFileLabel.textContent = 'Chưa chọn file local';
          customFileLabel.style.color = '#94a3b8';
        }

        // If currently in battle, immediately hot-swap track
        if (isInBattle()) {
          switchCombatBGM(track.url);
        }
      });

      presetsContainer.appendChild(item);
    });
  }

  // Local file input
  const localInput = document.getElementById('local-audio-input');
  customFileLabel = document.getElementById('local-audio-status');
  const uploadBtn = document.getElementById('btn-pick-local-audio');

  if (uploadBtn && localInput) {
    uploadBtn.onclick = () => localInput.click();
  }

  if (localInput) {
    localInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      handleCustomLocalFile(file);

      // Uncheck preset radios
      const radios = document.querySelectorAll('input[name="bgm-preset-choice"]');
      radios.forEach(r => { r.checked = false; });

      if (customFileLabel) {
        customFileLabel.textContent = `✓ ${file.name.slice(0, 25)}${file.name.length > 25 ? '...' : ''}`;
        customFileLabel.style.color = '#06d6a0';
      }
    });
  }

  // Volume slider
  const slider = document.getElementById('bgm-volume-slider');
  const volVal = document.getElementById('bgm-volume-val');
  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      if (volVal) volVal.textContent = `${val}%`;
      setBgmVolume(val / 100);
    });
  }

  // Close handlers
  const closeBtn = document.getElementById('bgm-modal-close');
  if (closeBtn) {
    closeBtn.onclick = closeBgmSelector;
  }

  if (modalElement) {
    modalElement.addEventListener('click', (e) => {
      if (e.target === modalElement) {
        closeBgmSelector();
      }
    });
  }

  // Arena music button if present
  const arenaMusicBtn = document.getElementById('arena-music-btn');
  if (arenaMusicBtn) {
    arenaMusicBtn.onclick = openBgmSelector;
  }
}
