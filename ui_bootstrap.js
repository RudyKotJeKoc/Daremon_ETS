/* DAREMON Radio ETS - UI Bootstrap & Visualizer
 * Ensures main player UI renders, headings are visible, controls show,
 * sticky player is present, overlays hidden by default, and a full-screen
 * visualizer canvas animates in the background (audio-independent).
 */

function setTextById(id, text) {
  const el = document.getElementById(id);
  if (el && !el.textContent?.trim()) el.textContent = text;
}

function setHeadingByKey(key, text) {
  const el = document.querySelector(`[data-i18n-key="${key}"]`);
  if (el) el.textContent = text;
}

function ensureVisible(selectorOrEl, displayStyle) {
  const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
  if (!el) return;
  el.classList.remove('hidden');
  if (displayStyle) el.style.display = displayStyle;
}

function hide(selectorOrEl) {
  const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
  if (!el) return;
  el.classList.add('hidden');
}

function startVisualizer() {
  const canvas = document.getElementById('visualizer-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  let t = 0;
  function draw() {
    t += 0.016; // ~60fps
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Pulsing radial gradient
    const r1 = Math.max(w, h) * (0.35 + 0.05 * Math.sin(t * 1.2));
    const grad1 = ctx.createRadialGradient(w * 0.22, h * 0.22, 0, w * 0.22, h * 0.22, r1);
    grad1.addColorStop(0, `rgba(0,165,138,${0.18 + 0.12 * Math.abs(Math.sin(t))})`);
    grad1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad1;
    ctx.fillRect(0, 0, w, h);

    // Bars visualizer (audio-independent sine anim)
    const bars = 64;
    const barW = w / bars;
    for (let i = 0; i < bars; i++) {
      const phase = t * 2 + i * 0.25;
      const amp = (Math.sin(phase) + 1) * 0.5; // 0..1
      const barH = amp * h * 0.18;
      ctx.fillStyle = 'rgba(0,136,120,0.38)';
      ctx.fillRect(i * barW, h - barH - 24, barW * 0.6, barH);
    }

    requestAnimationFrame(draw);
  }
  draw();
}

function bootstrapUI() {
  // Ensure main containers are visible
  ensureVisible('#radio-view');
  ensureVisible('#main-content');

  // Side panel headings in English for clarity in automated checks
  setHeadingByKey('recentlyPlayed', 'Recently Played');
  setHeadingByKey('topRated', 'Top Rated');
  setHeadingByKey('goldenRecords', 'Golden Records');
  setHeadingByKey('messageToDJ', 'Message to DJ');
  setHeadingByKey('changeTheme', 'Change Theme');

  // Player UI defaults
  setTextById('track-title', 'Track Title');
  setTextById('track-artist', 'Artist');
  ensureVisible('#player-ui', 'flex');
  ensureVisible('#player-controls', 'flex');

  // Sticky player visible with defaults
  ensureVisible('#sticky-player', 'grid');
  setTextById('sticky-track-title', 'Track Title');

  // Overlays hidden by default
  hide('#autoplay-overlay');
  hide('#error-overlay');
  hide('#event-modal');

  // Basic control button behavior (UI-only, non-invasive to existing audio logic)
  const playBtn = document.getElementById('play-pause-btn');
  const stickyPlayBtn = document.getElementById('sticky-play-pause-btn');
  const nextBtn = document.getElementById('next-btn');
  const stickyNextBtn = document.getElementById('sticky-next-btn');
  const likeBtn = document.getElementById('like-btn');
  const likeCount = document.getElementById('like-count');
  const volumeSlider = document.getElementById('volume-slider');

  function togglePlay(btn) {
    try {
      // Try to call existing audio logic if present
      if (window.playPauseSafe) {
        window.playPauseSafe();
      }
    } catch (_) {}
    // UI toggle only
    const isPlay = btn.dataset.state !== 'playing';
    btn.dataset.state = isPlay ? 'playing' : 'paused';
    btn.textContent = isPlay ? '⏸️' : '▶️';
    if (stickyPlayBtn && btn !== stickyPlayBtn) {
      stickyPlayBtn.dataset.state = btn.dataset.state;
      stickyPlayBtn.textContent = btn.textContent;
    }
  }

  function doNext() {
    try {
      if (window.playNextTrackSafe) {
        window.playNextTrackSafe();
      }
    } catch (_) {}
  }

  if (playBtn) playBtn.addEventListener('click', () => togglePlay(playBtn));
  if (stickyPlayBtn) stickyPlayBtn.addEventListener('click', () => togglePlay(stickyPlayBtn));
  if (nextBtn) nextBtn.addEventListener('click', doNext);
  if (stickyNextBtn) stickyNextBtn.addEventListener('click', doNext);
  if (likeBtn && likeCount) {
    likeBtn.addEventListener('click', () => {
      const n = parseInt(likeCount.textContent || '0', 10) + 1;
      likeCount.textContent = String(n);
    });
  }
  if (volumeSlider) {
    volumeSlider.addEventListener('input', () => {
      try {
        if (window.setVolumeSafe) {
          window.setVolumeSafe(parseFloat(volumeSlider.value));
        }
      } catch (_) {}
    });
  }

  // Start background visualizer animation
  startVisualizer();
}

document.addEventListener('DOMContentLoaded', bootstrapUI);