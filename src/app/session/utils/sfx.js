// sfx.js
// Lightweight, client-safe sound effects helper.
// Uses Howler (lazy-loaded) to avoid SSR/runtime issues.

const DEFAULT_SFX = {
  click: '/sfx/click.mp3',
  success: '/sfx/success.mp3',
  error: '/sfx/error.mp3'
};

let howlerModulePromise = null;
let howlCache = new Map();
let fallbackAudioCache = new Map();
let playbackGeneration = new Map();

async function getHowler() {
  if (typeof window === 'undefined') return null;
  if (!howlerModulePromise) {
    howlerModulePromise = import('howler').catch(() => null);
  }
  return howlerModulePromise;
}

function cacheKey(src, { volume, rate, loop } = {}) {
  return JSON.stringify({ src, volume, rate, loop });
}

/**
 * Play a short sound effect.
 *
 * @param {string} nameOrUrl - Either a key in DEFAULT_SFX or a direct URL like `/sfx/click.mp3`.
 * @param {{ volume?: number, rate?: number, loop?: boolean, muted?: boolean }} options
 * @returns {Promise<{stop: function}|null>} A stoppable playback handle when audio starts.
 */
export async function playSfx(nameOrUrl, options = {}) {
  const { volume = 0.4, rate = 1, loop = false, muted = false } = options;

  if (muted) return null;
  if (typeof window === 'undefined') return null;

  const src = DEFAULT_SFX[nameOrUrl] || nameOrUrl;
  if (!src || typeof src !== 'string') return null;

  const key = cacheKey(src, { volume, rate, loop });
  const generation = Math.max(0, Number(playbackGeneration.get(key) || 0)) + 1;
  playbackGeneration.set(key, generation);

  const mod = await getHowler();
  if (playbackGeneration.get(key) !== generation) return null;

  if (!mod || !mod.Howl) {
    // Last-ditch fallback if dynamic import fails for any reason.
    try {
      const a = new Audio(src);
      a.volume = Math.max(0, Math.min(1, volume));
      fallbackAudioCache.set(key, a);
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
      return {
        stop() {
          try {
            a.pause();
            a.currentTime = 0;
          } catch {}
          if (fallbackAudioCache.get(key) === a) fallbackAudioCache.delete(key);
        }
      };
    } catch {
      // ignore
    }
    return null;
  }

  let howl = howlCache.get(key);
  if (!howl) {
    howl = new mod.Howl({
      src: [src],
      volume: Math.max(0, Math.min(1, volume)),
      rate,
      loop,
      preload: true
    });
    howlCache.set(key, howl);
  }

  if (playbackGeneration.get(key) !== generation) return null;

  try {
    const soundId = howl.play();
    return {
      stop() {
        try {
          howl.stop(soundId);
        } catch {}
      }
    };
  } catch {
    // ignore
    return null;
  }
}

/**
 * Stop active or pending playback for a sound using the same playback options.
 */
export function stopSfx(nameOrUrl, options = {}) {
  const { volume = 0.4, rate = 1, loop = false } = options;
  const src = DEFAULT_SFX[nameOrUrl] || nameOrUrl;
  if (!src || typeof src !== 'string') return;

  const key = cacheKey(src, { volume, rate, loop });
  playbackGeneration.set(key, Math.max(0, Number(playbackGeneration.get(key) || 0)) + 1);

  const howl = howlCache.get(key);
  try { howl?.stop?.(); } catch {}

  const fallback = fallbackAudioCache.get(key);
  try {
    fallback?.pause?.();
    if (fallback) fallback.currentTime = 0;
  } catch {}
  fallbackAudioCache.delete(key);
}

/**
 * Preload a set of SFX names/URLs.
 */
export async function preloadSfx(list = [], options = {}) {
  if (typeof window === 'undefined') return;

  const mod = await getHowler();
  if (!mod || !mod.Howl) return;

  const { volume = 0.4, rate = 1, loop = false } = options;

  (Array.isArray(list) ? list : []).forEach((nameOrUrl) => {
    const src = DEFAULT_SFX[nameOrUrl] || nameOrUrl;
    if (!src || typeof src !== 'string') return;

    const key = cacheKey(src, { volume, rate, loop });
    if (howlCache.has(key)) return;

    const howl = new mod.Howl({
      src: [src],
      volume: Math.max(0, Math.min(1, volume)),
      rate,
      loop,
      preload: true
    });
    howlCache.set(key, howl);
  });
}

export function resetSfxCache() {
  howlCache = new Map();
  fallbackAudioCache = new Map();
  playbackGeneration = new Map();
  howlerModulePromise = null;
}

export const SFX = DEFAULT_SFX;
