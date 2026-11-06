// The lesson's regular music returns as soon as the work timer resumes.
export const PLAY_TIMER_MUSIC_SRC = '/media/Sunny%20Learning%20Groove.mp3';

export function lessonMusicTrackSrc(defaultSrc, playTimerActive = false) {
  return playTimerActive ? PLAY_TIMER_MUSIC_SRC : defaultSrc;
}

// Reuse one audio element so the two tracks cannot overlap.
export function switchLessonMusicTrack(audio, nextSrc, { muted = false, volume = 0.18 } = {}) {
  if (!audio) return;
  try { audio.pause(); } catch {}
  try {
    audio.src = nextSrc;
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = volume;
    audio.load();
  } catch {
    return;
  }
  if (muted) return;
  try {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {});
    }
  } catch {}
}
