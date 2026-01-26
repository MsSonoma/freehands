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
 */
export async function playSfx(nameOrUrl, options = {}) {
  const { volume = 0.4, rate = 1, loop = false, muted = false } = options;

  if (muted) return;
  if (typeof window === 'undefined') return;

  const src = DEFAULT_SFX[nameOrUrl] || nameOrUrl;
  if (!src || typeof src !== 'string') return;

  const mod = await getHowler();
  if (!mod || !mod.Howl) {
    // Last-ditch fallback if dynamic import fails for any reason.
    try {
      const a = new Audio(src);
      a.volume = Math.max(0, Math.min(1, volume));
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch {
      // ignore
    }
    return;
  }

  const key = cacheKey(src, { volume, rate, loop });
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

  try {
    howl.play();
  } catch {
    // ignore
  }
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
  howlerModulePromise = null;
}

export const SFX = DEFAULT_SFX;
