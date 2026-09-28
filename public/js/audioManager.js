/**
 * public/js/audioManager.js
 * Comprehensive Audio Manager singleton & proxy for audio.js
 */
import * as Audio from './audio.js';

class AudioManager {
  constructor() {
    this.currentBgm = null;
  }

  stopBgm() {
    Audio.stopBGM();
    if (this.currentBgm) {
      try {
        this.currentBgm.pause();
        this.currentBgm.currentTime = 0;
      } catch (e) {}
      this.currentBgm = null;
    }
  }

  stopBGM() {
    this.stopBgm();
  }

  playBgm(trackKey = 'lobby') {
    this.stopBgm();
    Audio.playBGM(trackKey);
  }

  playBGM(trackKey = 'lobby') {
    this.playBgm(trackKey);
  }
}

export const audioManager = new AudioManager();
export default audioManager;
export * from './audio.js';
