/**
 * DAREMON Radio ETS - Non-blocking overlay and startup tweaks
 * - No loader on startup, no autoplay
 * - Overlay is purely visual: does not intercept clicks; "×" remains clickable
 * - Audio hooks: canplay/playing → hide; waiting/stalled/error → show; ended → enableUI (no overlay)
 * - Defer non-critical tasks via requestIdleCallback/setTimeout(0)
 * - Service Worker registers after window 'load'
 */

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const dom = {
    player: {
      cover: document.getElementById('track-cover'),
      title: document.getElementById('track-title'),
      artist: document.getElementById('track-artist'),
      trackInfo: document.getElementById('track-info'),
      progressContainer: document.getElementById('progress-container'),
      progressBar: document.getElementById('progress-bar'),
      stickyProgressBar: document.getElementById('sticky-progress-bar'),
      currentTime: document.getElementById('current-time'),
      timeRemaining: document.getElementById('time-remaining'),
      playPauseBtn: document.getElementById('play-pause-btn'),
      nextBtn: document.getElementById('next-btn'),
      likeBtn: document.getElementById('like-btn'),
      likeCount: document.getElementById('like-count'),
      volumeSlider: document.getElementById('volume-slider'),
      ratingSection: document.getElementById('rating-section'),
      starRatingContainer: document.querySelector('.star-rating'),
      commentForm: document.getElementById('comment-form'),
      commentInput: document.getElementById('comment-input'),
      averageRatingDisplay: document.getElementById('average-rating-display'),
    },
    stickyPlayer: {
      container: document.getElementById('sticky-player'),
      cover: document.getElementById('sticky-track-cover'),
      title: document.getElementById('sticky-track-title'),
      playPauseBtn: document.getElementById('sticky-play-pause-btn'),
      nextBtn: document.getElementById('sticky-next-btn'),
    },
    sidePanel: {
      panel: document.getElementById('side-panel'),
      menuToggle: document.getElementById('menu-toggle'),
      historyList: document.getElementById('history-list'),
      goldenRecordsList: document.getElementById('golden-records-list'),
      topRatedList: document.getElementById('top-rated-list'),
      messagesList: document.getElementById('messages-list'),
      djMessageForm: document.getElementById('dj-message-form'),
      djMessageInput: document.getElementById('dj-message-input'),
    },
    header: { listenerCount: document.getElementById('listener-count') },
    views: { radio: document.getElementById('radio-view'), calendar: document.getElementById('calendar-view') },
    navigation: {
      toCalendarBtn: document.getElementById('calendar-view-btn'),
      toRadioBtn: document.getElementById('radio-view-btn'),
    },
    calendar: {
      header: document.getElementById('month-year-display'),
      grid: document.getElementById('calendar-grid'),
      prevMonthBtn: document.getElementById('prev-month-btn'),
      nextMonthBtn: document.getElementById('next-month-btn'),
      modal: document.getElementById('event-modal'),
      modalDateDisplay: document.getElementById('modal-date-display'),
      eventForm: document.getElementById('modal-note-form'),
      machineSelect: document.getElementById('modal-name-input'),
      eventTypeSelect: document.getElementById('modal-note-input'),
      modalCancelBtn: document.getElementById('modal-cancel-btn'),
      modalFeedback: document.getElementById('modal-feedback'),
    },
    autoplayOverlay: document.getElementById('autoplay-overlay'),
    startBtn: document.getElementById('start-btn'),
    welcomeGreeting: document.getElementById('welcome-greeting'),
    visualizerCanvas: document.getElementById('visualizer-canvas'),
    offlineIndicator: document.getElementById('offline-indicator'),
    errorOverlay: document.getElementById('error-overlay'),
    errorMessage: document.getElementById('error-message'),
    errorCloseBtn: document.getElementById('error-close-btn'),
    errorRetryBtn: document.getElementById('error-retry-btn'),
    themeSwitcher: document.querySelector('.theme-switcher'),
  };

  // --- State ---
  let audioContext, analyser;
  const players = [new Audio(), new Audio()];
  let activePlayerIndex = 0;
  players.forEach((p) => {
    p.crossOrigin = 'anonymous';
    p.preload = 'auto';
  });

  let state = {
    playlist: [],
    config: {},
    history: [],
    messages: [],
    reviews: {},
    currentTrack: null,
    nextTrack: null,
    isPlaying: false,
    isInitialized: false,
    lastMessageTimestamp: 0,
    songsSinceJingle: 0,
    likes: {},
    tempBoosts: {},
    // Failures
    failedTracks: [],
    // Rotation & preferences
    recentRotation: [],
    recentTrackSet: new Set(),
    nextGroupPreference: 'recent',
    // Calendar data
    currentDate: new Date(),
    events: {},
    language: 'nl',
    translations: {},
    machines: ['CNC Alpha', 'Laser Cutter Pro', 'Assembly Line 3', 'Packaging Bot X', 'Welding Station Omega'],
  };

  let problematicTracks = new Set();

  // --- UI control ---
  function enableUI() {
    // Keep UI interactive
  }

  // --- i18n ---
  async function i18n_init() {
    const userLang = navigator.language.split('-')[0];
    state.language = ['nl', 'pl'].includes(userLang) ? userLang : 'nl';
    document.documentElement.lang = state.language;
    try {
      const response = await fetch(`locales/${state.language}.json`);
      if (!response.ok) throw new Error('Translation file not found');
      state.translations = await response.json();
      i18n_apply();
    } catch (error) {
      console.warn('Falling back to built-in translations:', error);
      state.translations = {
        loading: 'Loading...',
        startBtn: 'Start Radio',
        errorPlaylistLoad: 'Error loading playlist',
        errorTimeout: 'Timeout error',
        errorFetch: 'Fetch error',
        retryBtn: 'Retry',
        retrying: 'Retrying...',
        retryFailed: 'Retry failed',
        you: 'You',
        aiDjName: 'DJ Bot',
        aiResponses: ['Thanks for your message!', 'Glad you are listening!', 'Great music choice!'],
        trackTitleDefault: 'Welcome to DAREMON Radio ETS',
        trackArtistDefault: 'Best of technology and music',
        headerSubtitle: 'Official company radio station',
        listenersLabel: 'Listeners:',
        goldenRecords: 'Golden Records',
        topRated: 'Top Rated',
        recentlyPlayed: 'Recently Played',
        djMessages: 'DJ Messages',
        themes: 'Themes',
        tools: 'Tools',
        backToRadio: 'Back to Radio',
        sendBtn: 'Send',
        submitReview: 'Submit Review',
        hotkeysInfo: 'Hotkeys: Space = Play/Pause, N = Next, L = Like, ↑↓ = Volume',
        selectRating: 'Selecteer een beoordeling',
        ratingSubmitted: 'Bedankt voor je beoordeling!',
        noRatingsYet: 'Nog geen beoordelingen - wees de eerste!',
        yourRating: 'Jouw beoordeling',
        topTracksTitle: '🔥 Top Tracks',
      };
      i18n_apply();
    }
  }
  function t(key, replacements = {}) {
    let text = state.translations[key] || `[${key}]`;
    for (const [placeholder, value] of Object.entries(replacements)) {
      text = text.replace(`{{${placeholder}}}`, value);
    }
    return text;
  }
  function i18n_apply() {
    document.querySelectorAll('[data-i18n-key]').forEach((el) => {
      if (el && state.translations[el.dataset.i18nKey]) {
        el.textContent = t(el.dataset.i18nKey);
      }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      if (el && state.translations[el.dataset.i18nPlaceholder]) {
        el.placeholder = t(el.dataset.i18nPlaceholder);
      }
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      if (el && state.translations[el.dataset.i18nTitle]) {
        el.title = t(el.dataset.i18nTitle);
      }
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      if (el && state.translations[el.dataset.i18nAriaLabel]) {
        el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
      }
    });
  }

  // --- Initialize ---
  async function initialize() {
    await i18n_init();
    try {
      await loadPlaylist();
      loadStateFromLocalStorage();
      validatePlaylistStructure();
      setupEventListeners();
      updateWelcomeGreeting();
      updateOfflineStatus();
      renderMessages();
      renderGoldenRecords();
      renderTopRated();
      renderTopTracks();
      populateMachineSelect();
      renderCalendar();
      setInterval(updateListenerCount, 15000);
      updateListenerCount();
      if (dom.autoplayOverlay) {
        dom.autoplayOverlay.style.display = 'none';
        dom.autoplayOverlay.classList.add('hidden');
      }
      // NOTE: As per user request, DO NOT show loader at app start.
    } catch (error) {
      console.error('Initialization failed:', error);
      displayError(t('errorPlaylistLoad', { message: error.message }), true);
    }
  }

  async function loadPlaylist() {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error(t('errorTimeout'))), 10000));
    try {
      const response = await Promise.race([fetch('./playlist.json'), timeoutPromise]);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Received non-JSON content (first 200 chars):', text.substring(0, 200));
        throw new Error('Server returned HTML instead of JSON - check file path');
      }
      const data = await response.json();
      state.config = {
        audioBasePath: data?.config?.audioBasePath || './music/',
        quietHours: data?.config?.quietHours || { start: '22:00', end: '06:00' },
        jingle: data?.config?.jingle || { everySongs: 4, orMinutes: 15, enabled: true },
        recentMemory: data?.config?.recentMemory || 15,
        crossfadeSeconds: data?.config?.crossfadeSeconds || 2.0,
        topTracksConfig: data?.config?.topTracksConfig || { enabled: true, priorityWeight: 8, minPlayFrequency: 0.3 },
      };
      state.playlist = (data.tracks || []).map((track) => ({ ...track, src: normalizeSrc(track.src) }));
      if (state.playlist.length === 0) throw new Error('Playlist is empty');
      console.log(`Loaded ${state.playlist.length} tracks`);
    } catch (e) {
      console.error('Playlist load error:', e);
      throw new Error(`Failed to load playlist: ${e.message}`);
    }
  }

  function normalizeSrc(src) {
    if (!src) return '';
    let s = String(src).trim();
    if (/^https?:\/\//i.test(s)) return s;
    // FIX: correct regex to strip leading slashes from relative src
    s = s.replace(/^\/+/, '');
    const base = state.config?.audioBasePath || './music/';
    const baseFixed = base.endsWith('/') ? base : `${base}/`;
    if (s.startsWith('music/')) return `./${s}`;
    if (s.startsWith('./music/')) return s;
    if (s.startsWith('music/top/')) return `./${s}`;
    return `${baseFixed}${s}`;
  }

  function validatePlaylistStructure() {
    const ids = new Set();
    const duplicates = [];
    let invalidSrcCount = 0;
    state.playlist.forEach((tr) => {
      if (ids.has(tr.id)) duplicates.push(tr.id);
      ids.add(tr.id);
      if (!tr.src || typeof tr.src !== 'string') invalidSrcCount++;
    });
    if (duplicates.length > 0) console.warn('Duplicate track IDs:', duplicates);
    if (invalidSrcCount > 0) console.warn(`Tracks with invalid src: ${invalidSrcCount}`);
    console.log('Playlist validation done. Tracks:', state.playlist.length);
  }

  // --- Audio diagnostics ---
  function tryAlternativePaths(src) {
    const base = state.config?.audioBasePath || './music/';
    const baseFixed = base.endsWith('/') ? base : `${base}/`;
    const fileName = src.split('/').pop();
    const variants = [
      src,
      `${baseFixed}${fileName}`,
      `./music/${fileName}`,
      `music/${fileName}`,
      `/music/${fileName}`,
      `./music/top/${fileName}`,
      `music/top/${fileName}`,
      `/music/top/${fileName}`,
    ];
    return [...new Set(variants)];
  }
  async function pickFirstWorkingURL(candidates, timeoutMs = 4000) {
    for (const url of candidates) {
      const ok = await urlExists(url, timeoutMs);
      if (ok) return url;
    }
    return null;
  }
  async function urlExists(url, timeoutMs = 4000) {
    try {
      const ctrl = new AbortController();
      const id = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
      clearTimeout(id);
      return res.ok;
    } catch {
      return false;
    }
  }

  // --- AudioContext setup & visualizer ---
  function setupAudioContext() {
    if (audioContext) return;
    try {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      players.forEach((player) => {
        const source = audioContext.createMediaElementSource(player);
        source.connect(analyser);
      });
      analyser.connect(audioContext.destination);
      drawVisualizer();
    } catch (e) {
      console.error('AudioContext setup failed:', e);
    }
  }
  function drawVisualizer() {
    requestAnimationFrame(drawVisualizer);
    if (!analyser || !state.isPlaying || !dom.visualizerCanvas) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    const canvas = dom.visualizerCanvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const barWidth = (canvas.width / bufferLength) * 2.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = dataArray[i] * 1.5;
      const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
      gradient.addColorStop(0, '#008878');
      gradient.addColorStop(1, '#D4FF3D');
      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  }

  // --- Selection helpers ---
  function replenishRecentRotation() {
    const limit = state.config.recentMemory || 15;
    const recentIds = state.history.slice(0, limit);
    state.recentTrackSet = new Set(recentIds);
    state.recentRotation = recentIds.slice();
  }
  function drawRecentTrack(trackPool) {
    const recentCandidates = trackPool.filter((t) => state.recentTrackSet.has(t.id));
    if (recentCandidates.length === 0) return null;
    return recentCandidates[Math.floor(Math.random() * recentCandidates.length)];
  }
  function removeFromRecentRotation(trackId) {
    state.recentTrackSet.delete(trackId);
    state.recentRotation = state.recentRotation.filter((id) => id !== trackId);
  }
  function buildWeightedPool(trackPool) {
    const pool = [];
    trackPool.forEach((track) => {
      const w = Math.max(1, Math.ceil(track.weight || 1));
      for (let i = 0; i < w; i++) pool.push(track);
    });
    return pool;
  }

  // --- selectNextTrack ---
  function selectNextTrack(isPreload = false) {
    if (!state.playlist || state.playlist.length === 0) {
      console.error('Playlist is empty');
      return null;
    }

    const isTrackPlayable = (track) => !state.failedTracks.includes(track.id);

    // Jingle handling
    const jingleConfig = state.config.jingle || {};
    if (!isPreload && jingleConfig.enabled && state.songsSinceJingle >= (jingleConfig.everySongs || 4)) {
      const jingles = state.playlist.filter((t) => t.type === 'jingle' && isTrackPlayable(t));
      if (jingles.length > 0) {
        state.songsSinceJingle = 0;
        return jingles[Math.floor(Math.random() * jingles.length)];
      }
    }

    // Filter available songs
    const availableTracks = state.playlist.filter(
      (track) => !state.history.includes(track.id) && track.type === 'song' && isTrackPlayable(track)
    );

    let trackPool =
      availableTracks.length > 0
        ? availableTracks
        : state.playlist.filter((t) => t.type === 'song' && isTrackPlayable(t));

    if (trackPool.length === 0) {
      trackPool = state.playlist.filter((t) => t.type === 'song');
    }

    if (availableTracks.length === 0 && state.currentTrack) {
      state.history = [state.currentTrack.id];
    }

    // Prevent immediate repeats
    if (trackPool.length > 1 && state.currentTrack) {
      trackPool = trackPool.filter((track) => track.id !== state.currentTrack.id);
    }

    // TOP prioritization
    const topTracksConfig = state.config.topTracksConfig || { enabled: true, minPlayFrequency: 0.3 };

    if (topTracksConfig.enabled) {
      const topTracks = trackPool.filter((t) => t.isTopTrack === true);
      const shouldPlayTop = topTracks.length > 0 && Math.random() < topTracksConfig.minPlayFrequency;
      if (shouldPlayTop) {
        console.log('[TOP TRACK] Wybieram utwór priorytetowy');
        trackPool = topTracks;
      }
    }

    // Recent rotation
    if (!state.recentRotation.length && state.nextGroupPreference === 'recent') {
      replenishRecentRotation();
    }

    let nextTrack = null;
    if (state.recentRotation.length && state.nextGroupPreference === 'recent') {
      nextTrack = drawRecentTrack(trackPool);
    }

    // Weight system
    if (!nextTrack) {
      const weightedPool = buildWeightedPool(trackPool);
      if (weightedPool.length === 0) {
        console.warn('Weighted pool is empty, falling back to random selection.');
        nextTrack = trackPool[Math.floor(Math.random() * trackPool.length)];
      } else {
        nextTrack = weightedPool[Math.floor(Math.random() * weightedPool.length)];
      }
    }

    // Preference update
    if (nextTrack && state.recentTrackSet.has(nextTrack.id)) {
      removeFromRecentRotation(nextTrack.id);
      state.nextGroupPreference = 'older';
    } else if (state.recentTrackSet && state.recentTrackSet.size > 0) {
      state.nextGroupPreference = 'recent';
    }

    if (!isPreload && nextTrack && nextTrack.type === 'song') state.songsSinceJingle++;
    return nextTrack;
  }

  // --- Playback flow using selectNextTrack ---
  async function playNextTrack() {
    const nextTrack = state.nextTrack || selectNextTrack();
    if (!nextTrack) {
      console.error('No track to play');
      return;
    }
    await validateAndPlayTrack(nextTrack);
  }

  async function validateAndPlayTrack(track) {
    if (!track) return;
    const candidates = tryAlternativePaths(track.src);
    const workingURL = await pickFirstWorkingURL(candidates);
    if (!workingURL) {
      console.warn('No working URL for track:', track.id, candidates);
      markTrackAsProblematic(track.id, 'URL not reachable');
      state.nextTrack = null;
      await playNextTrack();
      return;
    }

    const activePlayer = players[activePlayerIndex];
    const baseVolume = dom.player.volumeSlider ? parseFloat(dom.player.volumeSlider.value) : 0.5;
    const finalVolume = isQuietHour() ? baseVolume * 0.5 : baseVolume;

    if (state.isPlaying && activePlayer.currentTime > 0) {
      const inactivePlayerIndex = 1 - activePlayerIndex;
      const nextPlayer = players[inactivePlayerIndex];
      nextPlayer.src = workingURL;
      state.nextTrack = track;
      proceedWithCrossfade(finalVolume);
    } else {
      proceedWithPlayback(workingURL, finalVolume, track);
    }
  }

  function proceedWithCrossfade(finalVolume) {
    const inactivePlayerIndex = 1 - activePlayerIndex;
    const activePlayer = players[activePlayerIndex];
    const nextPlayer = players[inactivePlayerIndex];

    activePlayerIndex = inactivePlayerIndex;

    nextPlayer.volume = 0;
    const playPromise = nextPlayer.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          state.currentTrack = state.nextTrack;
          state.nextTrack = null;
          updateUIForNewTrack();
          updateHistory();

          const fadeDuration = (state.config.crossfadeSeconds || 2) * 1000;
          const intervalTime = 50;
          const steps = Math.max(1, Math.floor(fadeDuration / intervalTime));
          const volumeStep = finalVolume / steps;

          let currentStep = 0;
          const fadeInterval = setInterval(() => {
            currentStep++;
            activePlayer.volume = Math.max(0, activePlayer.volume - volumeStep);
            nextPlayer.volume = Math.min(finalVolume, nextPlayer.volume + volumeStep);

            if (currentStep >= steps) {
              activePlayer.pause();
              activePlayer.volume = finalVolume;
              clearInterval(fadeInterval);
              preloadNextTrack();
            }
          }, intervalTime);
        })
        .catch(handleAudioError);
    }
  }

  function proceedWithPlayback(resolvedURL, finalVolume, track) {
    const activePlayer = players[activePlayerIndex];
    activePlayer.src = resolvedURL;
    activePlayer.volume = finalVolume;

    const playPromise = activePlayer.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          state.currentTrack = track;
          state.isPlaying = true;
          updateUIForNewTrack();
          updateHistory();
          preloadNextTrack();
        })
        .catch(handleAudioError);
    }
  }

  function markTrackAsProblematic(trackId, reason = '') {
    if (!trackId) return;
    problematicTracks.add(trackId);
    if (!state.failedTracks.includes(trackId)) state.failedTracks.push(trackId);
    saveProblematicTracks();
    console.warn(`Track marked problematic: ${trackId}`, reason ? `| Reason: ${reason}` : '');
  }

  function preloadNextTrack() {
    state.nextTrack = selectNextTrack(true);
    if (state.nextTrack) {
      const candidates = tryAlternativePaths(state.nextTrack.src);
      pickFirstWorkingURL(candidates)
        .then((url) => {
          if (url) {
            const inactivePlayerIndex = 1 - activePlayerIndex;
            players[inactivePlayerIndex].src = url;
          }
        })
        .catch(() => {});
    }
  }

  // --- Audio error handling ---
  function handleAudioError(e) {
    const err = e?.error || e;
    const activePlayer = players[activePlayerIndex];
    const src = activePlayer?.src;
    const tr = state.currentTrack;
    let name = '';
    let code = '';
    try {
      name = err?.name || '';
      code = err?.code || '';
    } catch {}
    console.error('Audio playback error:', { name, code, src, trackId: tr?.id, err });

    if (tr?.id) {
      markTrackAsProblematic(tr.id, name || code || 'Unknown audio error');
    }
    if (tr) {
      const candidates = tryAlternativePaths(tr.src);
      pickFirstWorkingURL(candidates)
        .then((url) => {
          if (url && url !== src) {
            console.log('Try alternative path for same track:', url);
            proceedWithPlayback(url, activePlayer.volume || 0.5, tr);
            return;
          }
          setTimeout(() => {
            playNextTrack();
          }, 500);
        })
        .catch(() => {
          setTimeout(() => playNextTrack(), 500);
        });
    } else {
      setTimeout(() => playNextTrack(), 500);
    }
  }

  function togglePlayPause() {
    if (!state.isInitialized) {
      startRadio();
      return;
    }
    const activePlayer = players[activePlayerIndex];
    if (activePlayer.paused) {
      if (audioContext && audioContext.state === 'suspended') audioContext.resume();
      activePlayer.play().catch(handleAudioError);
    } else {
      activePlayer.pause();
      updatePlayPauseButtons();
    }
  }

  function seekTrack(e) {
    const activePlayer = players[activePlayerIndex];
    if (!activePlayer.duration) return;
    const progressContainer = dom.player.progressContainer;
    if (!progressContainer) return;
    const width = progressContainer.clientWidth;
    const clickX = e.offsetX;
    activePlayer.currentTime = (clickX / width) * activePlayer.duration;
  }

  function isQuietHour() {
    try {
      if (!state.config.quietHours) return false;
      const now = new Date();
      const [startH, startM] = state.config.quietHours.start.split(':');
      const [endH, endM] = state.config.quietHours.end.split(':');
      const quietStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startH, startM);
      const quietEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endH, endM);
      if (quietEnd < quietStart) return now >= quietStart || now < quietEnd;
      else return now >= quietStart && now < quietEnd;
    } catch (e) {
      console.error('quietHours parse error:', e);
      return false;
    }
  }

  function switchView(viewName) {
    Object.values(dom.views).forEach((view) => {
      if (view) view.classList.add('hidden');
    });
    if (dom.views[viewName]) dom.views[viewName].classList.remove('hidden');
  }

  function updateUIForNewTrack() {
    if (!state.currentTrack) return;
    const { title, artist, cover, id, isTopTrack } = state.currentTrack;

    // TOP visual tag
    if (isTopTrack) {
      document.body.setAttribute('data-track-top', 'true');
      console.log('🔥 [TOP TRACK] Odtwarzam priorytetowy utwór:', title);
    } else {
      document.body.removeAttribute('data-track-top');
    }

    const elementsToFade = [dom.player.trackInfo, dom.player.cover].filter(Boolean);
    elementsToFade.forEach((el) => el.classList.add('fade-out'));

    setTimeout(() => {
      if (dom.player.title) dom.player.title.textContent = title;
      if (dom.player.artist) dom.player.artist.textContent = artist;
      if (dom.player.cover) dom.player.cover.src = cover || dom.player.cover.src;
      if (dom.stickyPlayer.title) dom.stickyPlayer.title.textContent = title;
      if (dom.stickyPlayer.cover) dom.stickyPlayer.cover.src = cover || dom.stickyPlayer.cover.src;
      document.title = `${title} - DAREMON Radio ETS`;

      renderRatingUI(id);
      elementsToFade.forEach((el) => el.classList.remove('fade-out'));
      updateLikes();
      updatePlayPauseButtons();
    }, 200);
  }

  function updatePlayPauseButtons() {
    state.isPlaying = !players[activePlayerIndex].paused;
    const icon = state.isPlaying ? '⏸️' : '▶️';
    if (dom.player.playPauseBtn) dom.player.playPauseBtn.textContent = icon;
    if (dom.stickyPlayer.playPauseBtn) dom.stickyPlayer.playPauseBtn.textContent = icon;
    const label = t(state.isPlaying ? 'playPauseLabel_pause' : 'playPauseLabel_play');
    if (dom.player.playPauseBtn) dom.player.playPauseBtn.setAttribute('aria-label', label);
    if (dom.stickyPlayer.playPauseBtn) dom.stickyPlayer.playPauseBtn.setAttribute('aria-label', label);
  }

  function updateProgressBar() {
    const audio = players[activePlayerIndex];
    if (!audio.duration || !state.isPlaying || !audio.currentTime) return;

    const crossfadeTime = state.config.crossfadeSeconds || 2;
    if (audio.duration - audio.currentTime < crossfadeTime) {
      if (state.nextTrack) {
        const baseVolume = dom.player.volumeSlider ? parseFloat(dom.player.volumeSlider.value) : 0.5;
        const finalVolume = isQuietHour() ? baseVolume * 0.5 : baseVolume;
        proceedWithCrossfade(finalVolume);
        return;
      }
    }

    const progress = (audio.currentTime / audio.duration) * 100;
    if (dom.player.progressBar) dom.player.progressBar.style.width = `${progress}%`;
    if (dom.player.stickyProgressBar) dom.player.stickyProgressBar.style.width = `${progress}%`;
    if (dom.player.currentTime) dom.player.currentTime.textContent = formatTime(audio.currentTime);
    if (dom.player.timeRemaining) dom.player.timeRemaining.textContent = `-${formatTime(audio.duration - audio.currentTime)}`;
  }

  function updateHistory() {
    if (!state.currentTrack || state.history[0] === state.currentTrack.id) return;
    state.history.unshift(state.currentTrack.id);
    state.history = state.history.slice(0, state.config.recentMemory || 15);
    saveHistory();
    if (dom.sidePanel.historyList) {
      dom.sidePanel.historyList.innerHTML = '';
      state.history.forEach((trackId) => {
        const track = state.playlist.find((t) => t.id === trackId);
        if (track) {
          const li = document.createElement('li');
          li.textContent = `${track.artist} - ${track.title}`;
          dom.sidePanel.historyList.appendChild(li);
        }
      });
    }
  }

  function updateWelcomeGreeting() {
    if (!dom.welcomeGreeting) return;
    const hour = new Date().getHours();
    let greeting = 'Welcome to DAREMON Radio ETS!';
    if (hour >= 6 && hour < 12) greeting = 'Good morning! Welcome to DAREMON Radio ETS!';
    else if (hour >= 12 && hour < 18) greeting = 'Good afternoon! Welcome to DAREMON Radio ETS!';
    else if (hour >= 18 && hour < 22) greeting = 'Good evening! Welcome to DAREMON Radio ETS!';
    else greeting = 'Good night! Welcome to DAREMON Radio ETS!';
    dom.welcomeGreeting.textContent = greeting;
  }

  function updateOfflineStatus() {
    if (dom.offlineIndicator) {
      dom.offlineIndicator.classList.toggle('hidden', navigator.onLine);
    }
  }

  function displayError(message, showRetry = false) {
    if (dom.errorMessage) dom.errorMessage.textContent = message;
    if (dom.errorRetryBtn) dom.errorRetryBtn.classList.toggle('hidden', !showRetry);
    if (dom.errorOverlay) dom.errorOverlay.classList.remove('hidden');
  }

  function displaySuccessMessage(message) {
    if (!dom.errorMessage || !dom.errorOverlay) return;
    dom.errorMessage.textContent = message;
    dom.errorMessage.style.color = 'var(--primary-accent)';
    if (dom.errorRetryBtn) dom.errorRetryBtn.classList.add('hidden');
    if (dom.errorCloseBtn) dom.errorCloseBtn.textContent = 'OK';
    dom.errorOverlay.classList.remove('hidden');
    setTimeout(() => {
      dom.errorOverlay.classList.add('hidden');
      dom.errorMessage.style.color = '';
    }, 2000);
  }

  // --- Storage ---
  function safeLocalStorage(key, value) {
    try {
      if (value === undefined) {
        const item = localStorage.getItem(`daremon_${key}`);
        return item ? JSON.parse(item) : null;
      }
      localStorage.setItem(`daremon_${key}`, JSON.stringify(value));
    } catch (e) {
      console.error(`localStorage error for key "${key}":`, e);
      return null;
    }
  }
  function loadStateFromLocalStorage() {
    state.likes = safeLocalStorage('likes') || {};
    state.messages = safeLocalStorage('messages') || [];
    state.history = safeLocalStorage('history') || [];
    state.reviews = safeLocalStorage('reviews') || {};
    state.events = safeLocalStorage('events') || {};
    const problematic = safeLocalStorage('problematicTracks') || [];
    problematicTracks = new Set(Array.isArray(problematic) ? problematic : []);
    state.failedTracks = safeLocalStorage('failedTracks') || [];
    applyTheme(safeLocalStorage('theme') || 'arburg');
  }
  function saveHistory() {
    safeLocalStorage('history', state.history);
  }
  function saveTheme(theme) {
    safeLocalStorage('theme', theme);
  }
  function saveLikes() {
    safeLocalStorage('likes', state.likes);
  }
  function saveMessages() {
    safeLocalStorage('messages', state.messages);
  }
  function saveReviews() {
    safeLocalStorage('reviews', state.reviews);
  }
  function saveEvents() {
    safeLocalStorage('events', state.events);
  }
  function saveProblematicTracks() {
    safeLocalStorage('problematicTracks', Array.from(problematicTracks));
    safeLocalStorage('failedTracks', state.failedTracks);
  }

  // --- Ratings ---
  function renderRatingUI(trackId) {
    if (!dom.player.starRatingContainer) return;
    dom.player.starRatingContainer.innerHTML = '';
    if (dom.player.commentForm) dom.player.commentForm.classList.add('hidden');
    let currentRating = 0;

    for (let i = 1; i <= 5; i++) {
      const star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      star.setAttribute('viewBox', '0 0 24 24');
      star.setAttribute('fill', 'currentColor');
      star.dataset.value = i;
      star.innerHTML = `<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>`;
      star.addEventListener('mouseover', () => highlightStars(i));
      star.addEventListener('mouseout', () => highlightStars(currentRating));
      star.addEventListener('click', () => {
        currentRating = i;
        highlightStars(i);
        if (dom.player.commentForm) dom.player.commentForm.classList.remove('hidden');
        if (trackId) saveRatingWithoutComment(trackId, i);
      });
      dom.player.starRatingContainer.appendChild(star);
    }

    const userRating = getUserRating(trackId);
    if (userRating > 0) {
      currentRating = userRating;
      highlightStars(currentRating);
    }
    updateAverageRatingDisplay(trackId);
  }

  function saveRatingWithoutComment(trackId, rating) {
    if (!state.reviews[trackId]) state.reviews[trackId] = [];
    const idx = state.reviews[trackId].findIndex((r) => r.userId === 'current-user');
    const reviewData = { rating, comment: '', timestamp: Date.now(), userId: 'current-user' };
    if (idx >= 0) {
      state.reviews[trackId][idx] = reviewData;
    } else {
      state.reviews[trackId].push(reviewData);
    }
    console.log(`[RATING] Upsert rating for ${trackId}: ${rating}⭐`);
    saveReviews();
    updateAverageRatingDisplay(trackId);
    renderTopRated();
    renderTopTracks();
  }

  function getUserRating(trackId) {
    if (!state.reviews[trackId]) return 0;
    const userReview = state.reviews[trackId].find((r) => r.userId === 'current-user');
    return userReview ? userReview.rating : 0;
  }

  function highlightStars(rating) {
    if (!dom.player.starRatingContainer) return;
    const stars = dom.player.starRatingContainer.querySelectorAll('svg');
    stars.forEach((star) => {
      star.classList.toggle('active', Number(star.dataset.value) <= rating);
    });
  }

  function handleRatingSubmit(e) {
    e.preventDefault();
    if (!dom.player.starRatingContainer || !dom.player.commentInput) return;
    const stars = dom.player.starRatingContainer.querySelectorAll('svg.active');
    const rating = stars.length;
    const comment = dom.player.commentInput.value.trim();
    const trackId = state.currentTrack?.id;
    if (!trackId) return;
    if (rating === 0) {
      displayError(t('selectRating') || 'Selecteer een beoordeling');
      return;
    }
    if (!state.reviews[trackId]) state.reviews[trackId] = [];
    const idx = state.reviews[trackId].findIndex((r) => r.userId === 'current-user');
    const reviewData = { rating, comment: sanitizeHTML(comment), timestamp: Date.now(), userId: 'current-user' };
    if (idx >= 0) {
      state.reviews[trackId][idx] = reviewData;
      console.log(`[RATING] Zaktualizowano recenzję dla ${trackId}`);
    } else {
      state.reviews[trackId].push(reviewData);
      console.log(`[RATING] Dodano nową recenzję dla ${trackId}`);
    }
    saveReviews();
    if (dom.player.commentForm) {
      dom.player.commentForm.reset();
      dom.player.commentForm.classList.add('hidden');
    }
    highlightStars(0);
    updateAverageRatingDisplay(trackId);
    renderTopRated();
    renderTopTracks();
    displaySuccessMessage(t('ratingSubmitted') || 'Bedankt voor je beoordeling!');
  }

  function calculateAverageRating(trackId) {
    const reviews = state.reviews[trackId];
    if (!reviews || reviews.length === 0) return 0;
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    const average = total / reviews.length;
    console.log(`[RATING] ${trackId}: ${average.toFixed(2)}⭐ (${reviews.length} ocen)`);
    return average;
  }

  function updateAverageRatingDisplay(trackId) {
    if (!dom.player.averageRatingDisplay) return;
    const avg = calculateAverageRating(trackId);
    const count = state.reviews[trackId]?.length || 0;
    const userRating = getUserRating(trackId);
    if (count > 0) {
      const starsDisplay = '⭐'.repeat(Math.round(avg));
      const userInfo = userRating > 0 ? ` | ${t('yourRating') || 'Jouw beoordeling'}: ${userRating}⭐` : '';
      dom.player.averageRatingDisplay.textContent = `${state.language === 'pl' ? 'Średnia' : 'Gemiddeld'}: ${avg.toFixed(1)} ${starsDisplay} (${count}${userInfo})`;
      dom.player.averageRatingDisplay.style.color = 'var(--primary-accent)';
    } else {
      dom.player.averageRatingDisplay.textContent = t('noRatingsYet') || 'Nog geen beoordelingen';
      dom.player.averageRatingDisplay.style.color = '#888';
    }
  }

  // --- Top Rated (sidebar) ---
  function renderTopRated() {
    if (!dom.sidePanel.topRatedList) return;
    const ratedTracks = Object.keys(state.reviews)
      .map((trackId) => {
        const track = state.playlist.find((t) => t.id === trackId);
        if (!track) return null;
        return { ...track, avgRating: calculateAverageRating(trackId), reviewCount: state.reviews[trackId].length };
      })
      .filter(Boolean)
      .sort((a, b) => b.avgRating - a.avgRating);
    dom.sidePanel.topRatedList.innerHTML = '';
    ratedTracks.slice(0, 5).forEach((track) => {
      const li = document.createElement('li');
      li.textContent = `${track.artist} - ${track.title} (${track.avgRating.toFixed(1)} ⭐)`;
      li.dataset.trackId = track.id;
      li.addEventListener('click', async () => {
        await validateAndPlayTrack(track);
      });
      dom.sidePanel.topRatedList.appendChild(li);
    });
  }

  // --- Top Tracks list (sidebar) ---
  function renderTopTracks() {
    const topTracksList = document.getElementById('top-tracks-list');
    if (!topTracksList) return;
    const topTracks = state.playlist.filter((t) => t.isTopTrack === true);
    topTracksList.innerHTML = '';
    topTracks.forEach((track) => {
      const li = document.createElement('li');
      const avgRating = calculateAverageRating(track.id);
      const ratingDisplay = avgRating > 0 ? ` (${avgRating.toFixed(1)}⭐)` : '';
      li.textContent = `🔥 ${track.artist} - ${track.title}${ratingDisplay}`;
      li.dataset.trackId = track.id;
      li.addEventListener('click', () => playTrackNow(track));
      topTracksList.appendChild(li);
    });
  }

  function playTrackNow(track) {
    if (!track) return;
    state.nextTrack = track;
    validateAndPlayTrack(track);
  }

  // --- Listener count simulation ---
  function updateListenerCount() {
    if (!dom.header.listenerCount) return;
    if (!navigator.onLine) {
      dom.header.listenerCount.textContent = 'Offline';
      return;
    }
    const base = 5 + (Object.keys(state.likes).length % 10);
    const avgRating = state.currentTrack ? calculateAverageRating(state.currentTrack.id) : 0;
    const ratingBonus = Math.floor(avgRating * 2);
    const variance = Math.floor(Math.random() * 7) - 3;
    dom.header.listenerCount.textContent = `${base + ratingBonus + variance}`;
  }

  // --- Golden Records ---
  function renderGoldenRecords() {
    if (!dom.sidePanel.goldenRecordsList) return;
    const goldenTracks = state.playlist.filter((t) => t.golden);
    dom.sidePanel.goldenRecordsList.innerHTML = '';
    goldenTracks.forEach((track) => {
      const li = document.createElement('li');
      li.textContent = `${track.artist} - ${track.title}`;
      li.dataset.trackId = track.id;
      li.addEventListener('click', async () => {
        await validateAndPlayTrack(track);
      });
      dom.sidePanel.goldenRecordsList.appendChild(li);
    });
  }

  function handleLike() {
    if (!state.currentTrack) return;
    const id = state.currentTrack.id;
    state.likes[id] = (state.likes[id] || 0) + 1;
    saveLikes();
    updateLikes();
    if (dom.player.likeBtn) {
      dom.player.likeBtn.classList.add('liked-animation');
      setTimeout(() => dom.player.likeBtn.classList.remove('liked-animation'), 400);
    }
  }
  function updateLikes() {
    const count = state.currentTrack ? state.likes[state.currentTrack.id] || 0 : 0;
    if (dom.player.likeCount) dom.player.likeCount.textContent = count;
  }

  function handleMessageSubmit(e) {
    e.preventDefault();
    const now = Date.now();
    if (now - state.lastMessageTimestamp < 30000) {
      displayError('Wacht 30 seconden tussen berichten');
      return;
    }
    if (!dom.sidePanel.djMessageInput) return;
    const message = dom.sidePanel.djMessageInput.value;
    if (!message.trim()) return;
    state.lastMessageTimestamp = now;
    addMessage('Jij', sanitizeHTML(message));
    if (dom.sidePanel.djMessageForm) dom.sidePanel.djMessageForm.reset();

    const keywords = { cleanroom: 'plasdan', plasdan: 'plasdan', bmw: 'bmw-kut' };
    Object.keys(keywords).forEach((key) => {
      if (message.toLowerCase().includes(key)) {
        const trackId = keywords[key];
        state.tempBoosts[trackId] = (state.tempBoosts[trackId] || 0) + 5;
        setTimeout(() => {
          state.tempBoosts[trackId] -= 5;
        }, 10 * 60 * 1000);
      }
    });

    setTimeout(() => {
      const aiResponses = [
        'Bedankt voor je bericht!',
        'Leuk dat je luistert!',
        'Geweldige muzykk keuze!',
        'Blijf genieten van de muziek!',
      ];
      const aiResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
      addMessage('DJ Bot', aiResponse, true);
    }, 1500);
  }
  function addMessage(author, text, isAI = false) {
    state.messages.push({ author, text, isAI, timestamp: new Date().toLocaleTimeString() });
    state.messages = state.messages.slice(-10);
    saveMessages();
    renderMessages();
  }
  function renderMessages() {
    if (!dom.sidePanel.messagesList) return;
    dom.sidePanel.messagesList.innerHTML = '';
    state.messages.forEach((msg) => {
      const li = document.createElement('li');
      if (msg.isAI) li.classList.add('ai-response');
      li.innerHTML = `<b>${msg.author}:</b> ${msg.text} <i>(${msg.timestamp})</i>`;
      dom.sidePanel.messagesList.appendChild(li);
    });
    if (dom.sidePanel.messagesList.lastChild) {
      dom.sidePanel.messagesList.lastChild.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // --- Calendar (noop if UI missing) ---
  function renderCalendar() {
    if (!dom.calendar.grid || !dom.calendar.header) return;
    dom.calendar.grid.innerHTML = '';
    const date = state.currentDate;
    const year = date.getFullYear();
    const month = date.getMonth();
    const monthNames = [
      'Januari',
      'Februari',
      'Maart',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Augustus',
      'September',
      'Oktober',
      'November',
      'December',
    ];
    dom.calendar.header.textContent = `${monthNames[month]} ${year}`;
    const dayHeaders = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
    dayHeaders.forEach((header) => {
      const headerEl = document.createElement('div');
      headerEl.classList.add('calendar-day-header');
      headerEl.textContent = header;
      dom.calendar.grid.appendChild(headerEl);
    });
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayOffset = firstDay === 0 ? 6 : firstDay - 1;
    for (let i = 0; i < dayOffset; i++) {
      const emptyCell = document.createElement('div');
      emptyCell.classList.add('calendar-day', 'other-month');
      dom.calendar.grid.appendChild(emptyCell);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dayCell = document.createElement('div');
      dayCell.classList.add('calendar-day');
      dayCell.innerHTML = `<div class="day-number">${day}</div><div class="day-events"></div>`;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      dayCell.dataset.date = dateStr;
      if (state.events[dateStr]) {
        const eventsContainer = dayCell.querySelector('.day-events');
        state.events[dateStr].forEach((event) => {
          const eventEl = document.createElement('div');
          eventEl.classList.add('day-event', event.eventType);
          eventEl.textContent = event.machine;
          eventsContainer.appendChild(eventEl);
        });
      }
      dayCell.addEventListener('click', () => openEventModal(dateStr));
      dom.calendar.grid.appendChild(dayCell);
    }
  }
  function populateMachineSelect() {
    if (!dom.calendar.machineSelect) return;
    dom.calendar.machineSelect.innerHTML = '';
    state.machines.forEach((machine) => {
      const option = document.createElement('option');
      option.value = machine;
      option.textContent = machine;
      dom.calendar.machineSelect.appendChild(option);
    });
  }
  function openEventModal(dateStr) {
    if (!dom.calendar.modal || !dom.calendar.modalDateDisplay || !dom.calendar.eventForm) return;
    dom.calendar.modal.classList.remove('hidden');
    dom.calendar.modalDateDisplay.textContent = dateStr;
    dom.calendar.eventForm.dataset.date = dateStr;
  }
  function handleEventSubmit(e) {
    e.preventDefault();
    if (!dom.calendar.machineSelect || !dom.calendar.eventTypeSelect) return;
    const date = e.target.dataset.date;
    const machine = dom.calendar.machineSelect.value;
    const eventType = dom.calendar.eventTypeSelect.value;
    if (!state.events[date]) state.events[date] = [];
    state.events[date].push({ machine, eventType });
    saveEvents();
    renderCalendar();
    if (dom.calendar.modal) dom.calendar.modal.classList.add('hidden');
    if (dom.calendar.modalFeedback) {
      dom.calendar.modalFeedback.textContent = `Event toegevoegd voor ${machine} op ${date}`;
      setTimeout(() => {
        if (dom.calendar.modalFeedback) dom.calendar.modalFeedback.textContent = '';
      }, 3000);
    }
  }

  function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  }
  function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
  }
  function applyTheme(theme) {
    document.body.dataset.theme = theme;
  }

  // --- Start Radio ---
  function startRadio() {
    if (state.isInitialized) return;
    state.isInitialized = true;
    setupAudioContext();
    if (dom.autoplayOverlay) {
      dom.autoplayOverlay.style.opacity = 0;
      dom.autoplayOverlay.style.display = 'none';
      dom.autoplayOverlay.classList.add('hidden');
    }
    // Do not show loader at start
    playNextTrack();
  }

  // --- Event listeners ---
  function setupEventListeners() {
    if (dom.player.playPauseBtn) dom.player.playPauseBtn.addEventListener('click', togglePlayPause);
    if (dom.player.nextBtn) dom.player.nextBtn.addEventListener('click', playNextTrack);
    if (dom.player.likeBtn) dom.player.likeBtn.addEventListener('click', handleLike);
    if (dom.player.volumeSlider) {
      dom.player.volumeSlider.addEventListener('input', (e) => {
        const newVolume = isQuietHour() ? e.target.value * 0.5 : e.target.value;
        players.forEach((p) => (p.volume = newVolume));
      });
    }
    if (dom.player.progressContainer) dom.player.progressContainer.addEventListener('click', seekTrack);
    if (dom.player.commentForm) dom.player.commentForm.addEventListener('submit', handleRatingSubmit);

    players.forEach((player) => {
      player.addEventListener('timeupdate', () => {
        if (player === players[activePlayerIndex]) updateProgressBar();
      });
      player.addEventListener('ended', () => {
        if (player === players[activePlayerIndex]) {
          enableUI();
          playNextTrack();
        }
      });
      player.addEventListener('pause', () => {
        if (player === players[activePlayerIndex]) {
          enableUI(); // overlay stays hidden; UI remains interactive
          updatePlayPauseButtons();
        }
      });
      player.addEventListener('play', () => {
        if (player === players[activePlayerIndex]) {
          updatePlayPauseButtons();
        }
      });
      player.addEventListener('error', () => {
        handleAudioError(new Error('Audio error'));
      });
    });

    if (dom.stickyPlayer.playPauseBtn) dom.stickyPlayer.playPauseBtn.addEventListener('click', togglePlayPause);
    if (dom.stickyPlayer.nextBtn) dom.stickyPlayer.nextBtn.addEventListener('click', playNextTrack);

    if (dom.themeSwitcher) {
      dom.themeSwitcher.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
          const theme = e.target.id.replace('theme-', '');
          applyTheme(theme);
          saveTheme(theme);
        }
      });
    }
    if (dom.sidePanel.djMessageForm) dom.sidePanel.djMessageForm.addEventListener('submit', handleMessageSubmit);
    if (dom.errorCloseBtn) dom.errorCloseBtn.addEventListener('click', () => {
      if (dom.errorOverlay) dom.errorOverlay.classList.add('hidden');
    });
    if (dom.errorRetryBtn) dom.errorRetryBtn.addEventListener('click', retryLoad);

    if (dom.navigation.toCalendarBtn) dom.navigation.toCalendarBtn.addEventListener('click', () => switchView('calendar'));
    if (dom.navigation.toRadioBtn) dom.navigation.toRadioBtn.addEventListener('click', () => switchView('radio'));

    if (dom.calendar.prevMonthBtn) {
      dom.calendar.prevMonthBtn.addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() - 1);
        renderCalendar();
      });
    }
    if (dom.calendar.nextMonthBtn) {
      dom.calendar.nextMonthBtn.addEventListener('click', () => {
        state.currentDate.setMonth(state.currentDate.getMonth() + 1);
        renderCalendar();
      });
    }
    if (dom.calendar.eventForm) dom.calendar.eventForm.addEventListener('submit', handleEventSubmit);
    if (dom.calendar.modalCancelBtn) {
      dom.calendar.modalCancelBtn.addEventListener('click', () => {
        if (dom.calendar.modal) dom.calendar.modal.classList.add('hidden');
      });
    }

    window.addEventListener('online', updateOfflineStatus);
    window.addEventListener('offline', updateOfflineStatus);

    const nowPlayingSection = document.getElementById('now-playing-section');
    if (nowPlayingSection && dom.stickyPlayer.container) {
      const observer = new IntersectionObserver(
        (entries) => {
          dom.stickyPlayer.container.classList.toggle('visible', !entries[0].isIntersecting);
        },
        { threshold: 0.1 }
      );
      observer.observe(nowPlayingSection);
    }

    window.addEventListener('keydown', (e) => {
      if (
        document.activeElement.tagName === 'TEXTAREA' ||
        (dom.errorOverlay && !dom.errorOverlay.classList.contains('hidden')) ||
        (dom.views.radio && dom.views.radio.classList.contains('hidden'))
      )
        return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlayPause();
      }
      if (e.code === 'KeyN') playNextTrack();
      if (e.code === 'KeyL') handleLike();
      if (e.code === 'ArrowUp' && dom.player.volumeSlider) {
        e.preventDefault();
        dom.player.volumeSlider.value = Math.min(1, parseFloat(dom.player.volumeSlider.value) + 0.05).toFixed(2);
        players.forEach((p) => (p.volume = dom.player.volumeSlider.value));
      }
      if (e.code === 'ArrowDown' && dom.player.volumeSlider) {
        e.preventDefault();
        dom.player.volumeSlider.value = Math.max(0, parseFloat(dom.player.volumeSlider.value) - 0.05).toFixed(2);
        players.forEach((p) => (p.volume = dom.player.volumeSlider.value));
      }
    });

    let touchStartX = 0;
    let touchEndX = 0;
    if (dom.sidePanel.menuToggle && dom.sidePanel.panel) {
      dom.sidePanel.menuToggle.addEventListener('click', () => dom.sidePanel.panel.classList.toggle('open'));
    }
    document.body.addEventListener(
      'touchstart',
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
      },
      { passive: true }
    );
    document.body.addEventListener(
      'touchend',
      (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const deltaX = touchEndX - touchStartX;
        if (Math.abs(deltaX) > 50) {
          if (deltaX < 0) {
            if (dom.sidePanel.panel && dom.sidePanel.panel.classList.contains('open')) {
              dom.sidePanel.panel.classList.remove('open');
            } else {
              playNextTrack();
            }
          } else {
            if (dom.sidePanel.panel) dom.sidePanel.panel.classList.add('open');
          }
        }
      },
      { passive: true }
    );
  }

  async function retryLoad() {
    if (dom.errorRetryBtn) dom.errorRetryBtn.disabled = true;
    if (dom.errorMessage) dom.errorMessage.textContent = t('retrying');
    try {
      await loadPlaylist();
      if (dom.errorOverlay) dom.errorOverlay.classList.add('hidden');
      if (state.isInitialized) {
        await playNextTrack();
      }
    } catch (err) {
      displayError(t('retryFailed', { message: err.message }), true);
    } finally {
      if (dom.errorRetryBtn) dom.errorRetryBtn.disabled = false;
    }
  }

  // --- Service Worker ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => console.log('Service Worker registered:', reg.scope))
        .catch((err) => console.error('Service Worker registration failed:', err));
    });
  }

  initialize();
});