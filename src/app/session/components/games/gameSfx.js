"use client";

const GAME_SFX = {
  memory: {
    start: { files: ['/sfx/games/memory-start.ogg'], volume: 0.18 },
    flip: { files: ['/sfx/games/memory-flip.ogg'], volume: 0.14 },
    match: { files: ['/sfx/games/memory-match.ogg'], volume: 0.24 },
    miss: { files: ['/sfx/games/memory-miss.ogg'], volume: 0.18 },
    win: { files: ['/sfx/games/memory-win.ogg'], volume: 0.28 },
  },
  snake: {
    start: { files: ['/sfx/games/snake-start.ogg'], volume: 0.18 },
    eat: { files: ['/sfx/games/snake-eat.ogg'], volume: 0.24 },
    crash: { files: ['/sfx/games/snake-crash.ogg'], volume: 0.30 },
  },
  catch: {
    start: { files: ['/sfx/games/catch-start.ogg'], volume: 0.16 },
    collect: { files: ['/sfx/games/catch-item.ogg'], volume: 0.20 },
    miss: { files: ['/sfx/games/catch-miss.ogg'], volume: 0.16 },
    gameOver: { files: ['/sfx/games/catch-game-over.ogg'], volume: 0.26 },
  },
  maze: {
    start: { files: ['/sfx/games/maze-start.ogg'], volume: 0.16 },
    step: {
      files: [
        '/sfx/games/maze-step-1.ogg',
        '/sfx/games/maze-step-2.ogg',
        '/sfx/games/maze-step-3.ogg',
        '/sfx/games/maze-step-4.ogg',
        '/sfx/games/maze-step-5.ogg',
      ],
      volume: 0.08,
    },
    blocked: { files: ['/sfx/games/maze-block.ogg'], volume: 0.12 },
    goal: { files: ['/sfx/games/maze-goal.ogg'], volume: 0.26 },
  },
  whack: {
    start: { files: ['/sfx/games/whack-start.ogg'], volume: 0.16 },
    hit: {
      files: [
        '/sfx/games/whack-hit-1.ogg',
        '/sfx/games/whack-hit-2.ogg',
        '/sfx/games/whack-hit-3.ogg',
        '/sfx/games/whack-hit-4.ogg',
        '/sfx/games/whack-hit-5.ogg',
      ],
      volume: 0.22,
    },
    end: { files: ['/sfx/games/whack-end.ogg'], volume: 0.24 },
  },
  platform: {
    start: { files: ['/sfx/games/platform-start.ogg'], volume: 0.14 },
    jump: { files: ['/sfx/games/platform-jump.ogg'], volume: 0.16 },
    trampoline: { files: ['/sfx/games/platform-trampoline.ogg'], volume: 0.22 },
    land: { files: ['/sfx/games/platform-land.ogg'], volume: 0.08 },
    fall: { files: ['/sfx/games/platform-fall.ogg'], volume: 0.22 },
    goal: { files: ['/sfx/games/platform-goal.ogg'], volume: 0.28 },
  },
  flood: {
    start: { files: ['/sfx/games/flood-start.ogg'], volume: 0.14 },
    correct: { files: ['/sfx/games/flood-correct.ogg'], volume: 0.20 },
    wrong: { files: ['/sfx/games/flood-wrong.ogg'], volume: 0.17 },
    win: { files: ['/sfx/games/flood-win.ogg'], volume: 0.27 },
    lose: { files: ['/sfx/games/flood-lose.ogg'], volume: 0.22 },
  },
  flash: {
    start: { files: ['/sfx/games/flash-start.ogg'], volume: 0.13 },
    correct: { files: ['/sfx/games/flash-correct.ogg'], volume: 0.17 },
    wrong: { files: ['/sfx/games/flash-wrong.ogg'], volume: 0.15 },
    stage: { files: ['/sfx/games/flash-stage.ogg'], volume: 0.24 },
    topic: { files: ['/sfx/games/flash-topic.ogg'], volume: 0.27 },
  },
};

const howlCache = new Map();
const lastVariantByEvent = new Map();
let howlConstructorPromise = null;

function loadHowlConstructor() {
  if (typeof window === 'undefined') return Promise.resolve(null);

  if (!howlConstructorPromise) {
    howlConstructorPromise = import('howler')
      .then((module) => module.Howl || module.default?.Howl || null)
      .catch(() => null);
  }

  return howlConstructorPromise;
}

function chooseFile(gameId, eventName, files) {
  if (files.length <= 1) return files[0];

  const key = `${gameId}:${eventName}`;
  const previous = lastVariantByEvent.get(key);
  let index = Math.floor(Math.random() * files.length);

  if (index === previous) {
    index = (index + 1 + Math.floor(Math.random() * (files.length - 1))) % files.length;
  }

  lastVariantByEvent.set(key, index);
  return files[index];
}

async function getHowl(src, volume) {
  let howl = howlCache.get(src);
  if (howl) return howl;

  const Howl = await loadHowlConstructor();
  if (!Howl) return null;

  howl = new Howl({
    src: [src],
    preload: true,
    volume,
    pool: 4,
  });
  howlCache.set(src, howl);
  return howl;
}

export function preloadGameSfx(gameId) {
  if (typeof window === 'undefined') return;

  const game = GAME_SFX[gameId];
  if (!game) return;

  Object.values(game).forEach((entry) => {
    entry.files.forEach((src) => {
      void getHowl(src, entry.volume).then((howl) => {
        if (howl?.state?.() === 'unloaded') howl.load();
      });
    });
  });
}

export function playGameSfx(gameId, eventName) {
  if (typeof window === 'undefined') return;

  const entry = GAME_SFX[gameId]?.[eventName];
  if (!entry?.files?.length) return;

  const src = chooseFile(gameId, eventName, entry.files);
  void getHowl(src, entry.volume).then((howl) => {
    if (!howl) return;
    try {
      howl.volume(entry.volume);
      howl.play();
    } catch {}
  });
}
