// public/js/splash.js — Epic Splash Intro Screen (Roblox vs Monster)
import * as Audio from './audio.js';

let _particleReq = null;
let _hasStarted = false;

export function initSplashScreen(onStart) {
  const splash = document.getElementById('game-splash-screen');
  if (!splash) {
    if (onStart) onStart();
    return;
  }

  // ── 1. Curved / Arched Title Effect ──────────────────────────────────────
  const titleEl = splash.querySelector('.splash-curved-title');
  if (titleEl && !titleEl.dataset.curved) {
    titleEl.dataset.curved = 'true';
    const text = titleEl.textContent.trim();
    titleEl.innerHTML = '';

    const chars = Array.from(text);
    const total = chars.length;
    const mid = (total - 1) / 2;

    chars.forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'splash-title-char';
      span.textContent = ch === ' ' ? '\u00A0' : ch;

      // Parabolic curve calculation
      const norm = (i - mid) / (mid || 1); // -1.0 to +1.0
      const rotDeg = norm * 14;            // -14deg to +14deg
      const offsetY = Math.pow(norm, 2) * 16; // dip sides down, apex in center

      span.style.display = 'inline-block';
      span.style.transform = `translateY(${offsetY}px) rotate(${rotDeg}deg)`;
      span.style.transformOrigin = 'center 120%';
      titleEl.appendChild(span);
    });
  }

  // ── 2. Floating Atmospheric Ember Particle Canvas ─────────────────────────
  const canvas = document.getElementById('splash-particles-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', onResize);

    const colors = [
      'rgba(255, 107, 53, ', // Ember orange
      'rgba(255, 204, 0, ',  // Gold spark
      'rgba(0, 229, 255, ',  // Cyan lightning
      'rgba(239, 35, 60, ',  // Crimson flame
      'rgba(147, 197, 253, ', // Frost shimmer
    ];

    const particleCount = Math.min(65, Math.floor(window.innerWidth / 20));
    const particles = Array.from({ length: particleCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: 1.5 + Math.random() * 3.5,
      speedY: 0.35 + Math.random() * 0.9,
      speedX: (Math.random() - 0.5) * 0.5,
      colorPrefix: colors[Math.floor(Math.random() * colors.length)],
      alpha: 0.2 + Math.random() * 0.7,
      pulseSpeed: 0.015 + Math.random() * 0.03,
      pulse: Math.random() * Math.PI,
    }));

    function renderParticles() {
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.pulse += p.pulseSpeed;
        p.y -= p.speedY;
        p.x += Math.sin(p.pulse) * 0.6 + p.speedX;

        // Wrap around bounds
        if (p.y < -10) {
          p.y = height + 10;
          p.x = Math.random() * width;
        }
        if (p.x < -10) p.x = width + 10;
        if (p.x > width + 10) p.x = -10;

        const currentAlpha = Math.max(0.1, p.alpha * (0.6 + 0.4 * Math.sin(p.pulse)));

        ctx.fillStyle = p.colorPrefix + currentAlpha + ')';
        ctx.shadowColor = p.colorPrefix + '0.8)';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      _particleReq = requestAnimationFrame(renderParticles);
    }

    renderParticles();
  }

  // ── 3. Tap to Start Interaction ───────────────────────────────────────────
  const startFlow = () => {
    if (_hasStarted) return;
    _hasStarted = true;

    // 1. Play intro sound effect / UI swoosh
    try {
      if (Audio.playIntroSwoosh) Audio.playIntroSwoosh();
      else if (Audio.playSlash) Audio.playSlash();
    } catch (e) {
      console.warn('[splash] SFX error:', e);
    }

    // 2. Smoothly fade out #game-splash-screen (opacity transition: 0.5s)
    splash.classList.add('splash-fade-out');

    setTimeout(() => {
      splash.style.display = 'none';
      if (_particleReq) {
        cancelAnimationFrame(_particleReq);
        _particleReq = null;
      }

      // 3. Reveal Login or Room Selection screen
      if (onStart) onStart();
    }, 500);
  };

  splash.addEventListener('click', startFlow);
  splash.addEventListener('touchstart', startFlow, { passive: true });
}
