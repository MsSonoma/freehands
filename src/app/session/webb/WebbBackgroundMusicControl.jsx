"use client";

import { useCallback, useEffect, useRef, useState } from 'react';

const TRACK_SRC = '/media/Almost%20There.wav';
const DEFAULT_VOLUME = 0.18;
const LONG_PRESS_MS = 550;
const VOLUME_STORAGE_KEY = 'mrs_webb_background_music_volume';
const MUTED_STORAGE_KEY = 'mrs_webb_background_music_muted';

function clampVolume(value) {
  if (value === null || value === undefined || value === '') return DEFAULT_VOLUME;
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_VOLUME;
  return Math.min(1, Math.max(0, number));
}

export default function WebbBackgroundMusicControl({ compact = false }) {
  const audioRef = useRef(null);
  const controlRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const suppressNextClickRef = useRef(false);
  const mutedRef = useRef(false);
  const volumeRef = useRef(DEFAULT_VOLUME);

  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [showVolume, setShowVolume] = useState(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    let storedVolume = DEFAULT_VOLUME;
    let storedMuted = false;

    try {
      storedVolume = clampVolume(window.localStorage.getItem(VOLUME_STORAGE_KEY));
      const mutedValue = window.localStorage.getItem(MUTED_STORAGE_KEY);
      storedMuted = mutedValue === '1' || mutedValue === 'true';
    } catch {}

    volumeRef.current = storedVolume;
    mutedRef.current = storedMuted;
    setVolume(storedVolume);
    setIsMuted(storedMuted);

    const audio = new Audio(TRACK_SRC);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = storedVolume;
    audioRef.current = audio;

    const ensurePlayback = () => {
      if (audioRef.current !== audio || mutedRef.current || !audio.paused) return;
      try {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } catch {}
    };

    document.addEventListener('pointerdown', ensurePlayback, true);
    document.addEventListener('keydown', ensurePlayback, true);
    ensurePlayback();

    return () => {
      document.removeEventListener('pointerdown', ensurePlayback, true);
      document.removeEventListener('keydown', ensurePlayback, true);
      try { audio.pause(); } catch {}
      try { audio.src = ''; } catch {}
      if (audioRef.current === audio) audioRef.current = null;
    };
  }, []);

  useEffect(() => () => clearLongPress(), [clearLongPress]);

  useEffect(() => {
    if (!showVolume) return undefined;

    const handleOutsidePointer = (event) => {
      if (!controlRef.current?.contains(event.target)) {
        setShowVolume(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setShowVolume(false);
    };

    document.addEventListener('pointerdown', handleOutsidePointer);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showVolume]);

  const persistMuted = (muted) => {
    try {
      window.localStorage.setItem(MUTED_STORAGE_KEY, muted ? '1' : '0');
    } catch {}
  };

  const persistVolume = (nextVolume) => {
    try {
      window.localStorage.setItem(VOLUME_STORAGE_KEY, String(nextVolume));
    } catch {}
  };

  const toggleMusic = () => {
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }

    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    persistMuted(nextMuted);

    const audio = audioRef.current;
    if (!audio) return;

    if (nextMuted) {
      try { audio.pause(); } catch {}
      return;
    }

    audio.volume = volumeRef.current;
    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {});
      }
    } catch {}
  };

  const handleVolumeChange = (event) => {
    const nextVolume = clampVolume(event.target.value);
    volumeRef.current = nextVolume;
    setVolume(nextVolume);
    persistVolume(nextVolume);

    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = nextVolume;

    if (!mutedRef.current && audio.paused) {
      try {
        const playPromise = audio.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      } catch {}
    }
  };

  const handleContextMenu = (event) => {
    event.preventDefault();
    clearLongPress();
    suppressNextClickRef.current = false;
    setShowVolume(true);
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;
    clearLongPress();
    suppressNextClickRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      longPressTimerRef.current = null;
      suppressNextClickRef.current = true;
      setShowVolume(true);
    }, LONG_PRESS_MS);
  };

  const buttonSize = compact ? 34 : 'clamp(34px, 6.2vw, 52px)';

  return (
    <div ref={controlRef} style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
      {showVolume ? (
        <div
          role="dialog"
          aria-label="Background music volume"
          onContextMenu={(event) => event.preventDefault()}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 'calc(100% + 10px)',
            width: 210,
            padding: '12px 14px',
            background: '#ffffff',
            color: '#111827',
            border: '1px solid #d1d5db',
            borderRadius: 12,
            boxShadow: '0 10px 28px rgba(0,0,0,0.22)',
            zIndex: 30,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>Music volume</span>
            <span style={{ fontSize: 12, color: '#6b7280', fontVariantNumeric: 'tabular-nums' }}>
              {Math.round(volume * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            aria-label="Background music volume"
            style={{ width: '100%', accentColor: '#0d9488', cursor: 'pointer' }}
          />
          <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.35, color: '#6b7280' }}>
            Right-click or press and hold the music button to open this control.
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggleMusic}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerUp={clearLongPress}
        onPointerCancel={clearLongPress}
        onPointerLeave={clearLongPress}
        aria-pressed={isMuted}
        aria-haspopup="dialog"
        aria-expanded={showVolume}
        aria-label={isMuted ? 'Turn background music on' : 'Turn background music off'}
        title={isMuted
          ? 'Turn background music on. Right-click or hold for volume.'
          : 'Turn background music off. Right-click or hold for volume.'}
        style={{
          background: '#1f2937',
          color: '#fff',
          border: 'none',
          width: buttonSize,
          height: buttonSize,
          display: 'grid',
          placeItems: 'center',
          borderRadius: '50%',
          cursor: 'pointer',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
          WebkitTouchCallout: 'none',
          userSelect: 'none',
          touchAction: 'manipulation',
        }}
      >
        <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18V5l10-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="16" cy="16" r="3" />
          {isMuted ? <line x1="3" y1="3" x2="21" y2="21" /> : null}
        </svg>
      </button>
    </div>
  );
}
