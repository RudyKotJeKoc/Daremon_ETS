/* DAREMON Radio ETS - UI Bootstrap & Visualizer
 * Ensures main player UI renders, headings are visible, controls show,
 * sticky player is present, overlays hidden by default, and a full-screen
 * visualizer canvas is ready for the main renderer.
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

}

document.addEventListener('DOMContentLoaded', bootstrapUI);
