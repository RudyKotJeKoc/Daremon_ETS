/**
 * Service Worker for DAREMON Radio ETS
 * Non-blocking: no heavy pre-cache on install; runtime caching for audio.
 */

self.addEventListener('install', (event) => {
  // Skip heavy precaching to avoid blocking; immediate activation optional
  // event.waitUntil(Promise.resolve());
});

self.addEventListener('activate', (event) => {
  // Clean up old caches lightly if needed
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !['radio-audio-v1'].includes(k))
          .map((k) => caches.delete(k))
      );
    })()
  );
});

const AUDIO_CACHE = 'radio-audio-v1';

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Runtime cache only for audio paths; avoid blocking render assets
  const isAudio =
    req.destination === 'audio' ||
    url.pathname.startsWith('/music/') ||
    url.pathname.startsWith('/music/top/');

  if (isAudio) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(AUDIO_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;

        try {
          const res = await fetch(req);
          // Cache only successful audio responses
          if (res.ok) {
            cache.put(req, res.clone());
          }
          return res;
        } catch (err) {
          // Fallback: return cached if any, otherwise propagate error
          if (cached) return cached;
          throw err;
        }
      })()
    );
  }
  // Default: let requests go to network without interception
});