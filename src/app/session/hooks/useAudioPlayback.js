/**
 * useAudioPlayback.js
 * Custom hook managing all audio/video/TTS playback functionality:
 * - Audio playback (HTMLAudio and WebAudio paths)
 * - Caption scheduling and synchronization
 * - Video coordination
 * - Synthetic playback (when no audio asset)
 * - Mute/unmute controls
 * - Speech guard management
 */

import { useCallback, useRef, useEffect } from 'react';
import { 
  normalizeBase64Audio, 
  base64ToArrayBuffer, 
  makeSilentWavDataUrl,
  playVideoWithRetry
} from '../utils/audioUtils';
import { countWords } from '../utils/textProcessing';

// Inline utility functions (defined in page.js, duplicated here for independence)
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const waitForBeat = (ms = 240) => new Promise((resolve) => setTimeout(resolve, ms));

export function useAudioPlayback({
  // State setters
  setIsSpeaking,
  setShowOpeningActions,
  setCaptionIndex,
  setCaptionsDone,
  setCaptionSentences,
  setMuted,
  setUserPaused,
  setPlaybackIntent,
  setAudioUnlocked,
  setOfferResume,
  
  // State values
  muted,
  userPaused,
  loading,
  playbackIntent,
  captionIndex,
  audioUnlocked,
  phase,
  subPhase,
  askState,
  riddleState,
  poemState,
  
  // Refs
  audioRef,
  videoRef,
  mutedRef,
  audioUnlockedRef,
  userPausedRef,
  captionIndexRef,
  captionSentencesRef,
  captionTimersRef,
  captionBatchStartRef,
  captionBatchEndRef,
  lastAudioBase64Ref,
  lastSentencesRef,
  lastStartIndexRef,
  preferHtmlAudioOnceRef,
  forceNextPlaybackRef,
  htmlAudioPausedAtRef,
  speechGuardTimerRef,
  lastGuardArmAtRef,
  
  // Utility functions from parent (currently inline in page.js)
  scheduleCaptionsForAudioUtil,
  scheduleCaptionsForDurationUtil,
  clearSyntheticUtil,
  finishSyntheticUtil,
  pauseSyntheticUtil,
  resumeSyntheticUtil,
  clearCaptionTimers,
  clearSpeechGuard,
  armSpeechGuard: armSpeechGuardFromParent,
  armSpeechGuardThrottled: armSpeechGuardThrottledFromParent,
  forceStopSpeaking,
  showTipOverride,
  ensureAudioContext: ensureAudioContextFromParent,
  playViaWebAudio: playViaWebAudioFromParent
}) {
  
  // WebAudio refs for iOS fallback
  const audioCtxRef = useRef(null);
  const webAudioGainRef = useRef(null);
  const webAudioSourceRef = useRef(null);
  const webAudioBufferRef = useRef(null);
  const webAudioStartedAtRef = useRef(0);
  const webAudioPausedAtRef = useRef(0);
  
  // Synthetic playback state
  const syntheticRef = useRef({ active: false, duration: 0, elapsed: 0, startAtMs: 0, timerId: null });
  
  /**
   * Compute estimated duration for sentences based on word count
   */
  const computeHeuristicDuration = useCallback((sentences = []) => {
    try {
      const arr = Array.isArray(sentences) ? sentences : [];
      if (!arr.length) return 3.5;
      const totalWords = arr.reduce((sum, s) => sum + ((String(s).trim().split(/\s+/).filter(Boolean).length) || 1), 0) || arr.length;
      const base = Math.max(totalWords / 3.6, Math.min(arr.length * 1.5, 12));
      return clamp(base, 1.5, 300);
    } catch { return 6; }
  }, []);
  
  /**
   * Schedule captions based on audio duration
   */
  const scheduleCaptionsForAudio = useCallback((audio, sentences, startIndex = 0) => {
    const refs = { captionTimersRef, captionBatchEndRef };
    scheduleCaptionsForAudioUtil(audio, sentences, startIndex, refs, setCaptionIndex, setCaptionsDone);
  }, [scheduleCaptionsForAudioUtil, captionTimersRef, captionBatchEndRef, setCaptionIndex, setCaptionsDone]);
  
  /**
   * Schedule captions based on fixed duration (synthetic playback)
   */
  const scheduleCaptionsForDuration = useCallback((durationSeconds, sentences, startIndex = 0) => {
    const refs = { captionTimersRef, captionBatchEndRef };
    scheduleCaptionsForDurationUtil(durationSeconds, sentences, startIndex, refs, setCaptionIndex, setCaptionsDone);
  }, [scheduleCaptionsForDurationUtil, captionTimersRef, captionBatchEndRef, setCaptionIndex, setCaptionsDone]);
  
  /**
   * Synthetic playback helpers
   */
  const clearSynthetic = useCallback(() => {
    clearSyntheticUtil(syntheticRef);
  }, [clearSyntheticUtil]);
  
  const finishSynthetic = useCallback(() => {
    const phaseState = { phase, subPhase, askState, riddleState, poemState };
    finishSyntheticUtil(syntheticRef, videoRef, phaseState, setIsSpeaking, setShowOpeningActions, clearSpeechGuard);
  }, [finishSyntheticUtil, phase, subPhase, askState, riddleState, poemState, videoRef, setIsSpeaking, setShowOpeningActions, clearSpeechGuard]);
  
  const pauseSynthetic = useCallback(() => {
    pauseSyntheticUtil(syntheticRef, videoRef, clearCaptionTimers);
  }, [pauseSyntheticUtil, videoRef, clearCaptionTimers]);
  
  const resumeSynthetic = useCallback(() => {
    const refs = { videoRef, speechGuardTimerRef, captionBatchEndRef, captionSentencesRef };
    resumeSyntheticUtil(syntheticRef, refs, captionIndex, scheduleCaptionsForDuration, setIsSpeaking, finishSynthetic);
  }, [resumeSyntheticUtil, videoRef, speechGuardTimerRef, captionBatchEndRef, captionSentencesRef, captionIndex, scheduleCaptionsForDuration, setIsSpeaking, finishSynthetic]);
  
  /**
   * Main audio playback function
   * Handles both HTMLAudio and WebAudio paths, plus synthetic playback
   */
  const playAudioFromBase64 = useCallback(async (audioBase64, batchSentences = [], startIndex = 0, opts = {}) => {
    clearCaptionTimers();

    if (!audioBase64) {
      // Synthetic playback: drive captions + video without an audio asset
      const sentences = Array.isArray(batchSentences) ? batchSentences : [];
      // Track batch bounds for pause/resume
      try {
        const batchLen = sentences.length;
        captionBatchStartRef.current = startIndex;
        captionBatchEndRef.current = startIndex + batchLen;
        lastAudioBase64Ref.current = '';
        lastSentencesRef.current = sentences;
        lastStartIndexRef.current = startIndex;
      } catch {}
      // Compute pacing and arm synthetic state
      const totalWords = sentences.reduce((sum, s) => sum + (countWords(s) || 1), 0) || sentences.length || 1;
      const safeDuration = Math.max(totalWords / 3.6, Math.min(sentences.length * 1.5, 12));
      syntheticRef.current = { active: true, duration: safeDuration, elapsed: 0, startAtMs: 0, timerId: null };
      const allowAuto = (!userPaused || forceNextPlaybackRef.current);
      if (!allowAuto) {
        // Defer until user explicitly resumes
        return;
      }
      try { setIsSpeaking(true); } catch {}
      try { scheduleCaptionsForDuration(safeDuration, sentences, startIndex); } catch {}
      try {
        if (videoRef.current) {
          playVideoWithRetry(videoRef.current);
        }
      } catch {}
      try {
        syntheticRef.current.startAtMs = Date.now();
        syntheticRef.current.timerId = setTimeout(finishSynthetic, Math.round(safeDuration * 1000) + 50);
      } catch {}
      // Guard as additional safety to prevent UI lock
      try { armSpeechGuardFromParent(safeDuration, 'synthetic'); } catch {}
      return;
    }

    try {
      // Normalize and stash last audio payload in case we need to retry after an iOS unlock
      const normalizedB64 = normalizeBase64Audio(audioBase64 || '');
      lastAudioBase64Ref.current = normalizedB64 || null;
      lastSentencesRef.current = Array.isArray(batchSentences) ? batchSentences : [];
      lastStartIndexRef.current = Number.isFinite(startIndex) ? startIndex : 0;

      // If this is the very first playback after Begin (Opening), prefer HTMLAudio once.
      // Many browsers grant more permissive autoplay to HTMLMediaElement after a user gesture.
      const useHtmlFirst = !!preferHtmlAudioOnceRef.current;
      if (!useHtmlFirst) {
        // Prefer WebAudio path when the AudioContext is ready (more resilient to autoplay policies),
        // not only on iOS. We'll attempt it whenever a context exists; ensureAudioContext may resume if suspended.
        try {
          const ctx = ensureAudioContextFromParent();
          if (ctx) {
            try { console.info('[Session] playAudioFromBase64: using WebAudio path for playback'); } catch {}
            await playViaWebAudioFromParent(normalizedB64, batchSentences || [], startIndex);
            // First playback completed via WebAudio; clear the one-time preference if it was set accidentally
            if (preferHtmlAudioOnceRef.current) preferHtmlAudioOnceRef.current = false;
            return;
          }
        } catch {/* fall back to HTMLAudio below */}
      }

      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch (pauseError) {
          console.warn("[Session] Unable to pause existing audio.", pauseError);
        }
        audioRef.current.src = "";
        audioRef.current = null;
      }

      // HTMLAudio fallback path
      try { console.info('[Session] playAudioFromBase64: using HTMLAudio path for playback'); } catch {}
      const arrBuf = base64ToArrayBuffer(normalizedB64);
      const blob = new Blob([arrBuf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      await new Promise((resolve) => {
        const audio = new Audio(url);
        audioRef.current = audio;
        // Apply latest mute state immediately
        audio.muted = Boolean(mutedRef.current);
        audio.volume = mutedRef.current ? 0 : 1;
        // Arm a provisional guard immediately based on heuristic; refine once metadata is known
        try { armSpeechGuardFromParent(computeHeuristicDuration(batchSentences), 'html:provisional'); } catch {}
        {
          const allowAuto = (!userPaused || forceNextPlaybackRef.current);
          if (allowAuto) {
            const resumeAt = Number(opts?.resumeAtSeconds || 0);
            if (resumeAt > 0) {
              // Ensure metadata, then seek to resume position before scheduling captions
              const readyThenSchedule = () => {
                try {
                  if (Number.isFinite(audio.duration) && audio.duration > 0) {
                    const safeOffset = Math.max(0, Math.min(resumeAt, Math.max(0, audio.duration - 0.05)));
                    try { audio.currentTime = safeOffset; } catch {}
                  }
                } catch {}
                scheduleCaptionsForAudio(audio, batchSentences || [], startIndex);
                // Arm guard using precise remaining duration
                try {
                  if (Number.isFinite(audio.duration) && audio.duration > 0) {
                    const remaining = Math.max(0.1, (audio.duration || 0) - (audio.currentTime || 0));
                    armSpeechGuardFromParent(remaining, 'html:loaded-resume');
                  }
                } catch {}
              };
              if (Number.isFinite(audio.duration) && audio.duration > 0) {
                readyThenSchedule();
              } else {
                const once = () => { readyThenSchedule(); };
                audio.addEventListener('loadedmetadata', once, { once: true });
                audio.addEventListener('canplay', once, { once: true });
                // Fallback if metadata is slow
                const t = window.setTimeout(() => { try { readyThenSchedule(); } catch {} }, 400);
                captionTimersRef.current.push(t);
              }
            } else {
              // Track current caption batch boundaries for pause/resume and captions-done detection
              try {
                const batchLen = (batchSentences && batchSentences.length) || 0;
                captionBatchStartRef.current = startIndex;
                captionBatchEndRef.current = startIndex + batchLen;
              } catch {}
              scheduleCaptionsForAudio(audio, batchSentences || [], startIndex);
              const armOnLoaded = () => {
                try {
                  if (Number.isFinite(audio.duration) && audio.duration > 0) {
                    const remaining = Math.max(0.1, (audio.duration || 0) - (audio.currentTime || 0));
                    armSpeechGuardFromParent(remaining, 'html:loaded');
                  }
                } catch {}
              };
              audio.addEventListener('loadedmetadata', armOnLoaded, { once: true });
              audio.addEventListener('canplay', armOnLoaded, { once: true });
            }
          }
        }
        // Track current caption batch boundaries for pause/resume behavior
        try {
          const batchLen = (batchSentences && batchSentences.length) || 0;
          captionBatchStartRef.current = startIndex;
          captionBatchEndRef.current = startIndex + batchLen;
        } catch {}

        const cleanup = () => {
          try { URL.revokeObjectURL(url); } catch {}
          // Do not change caption on cleanup; keep the full text on screen
          try {
            audio.removeEventListener('loadedmetadata', onLoadedForGuard);
            audio.removeEventListener('canplay', onLoadedForGuard);
            audio.removeEventListener('timeupdate', onTimeUpdateGuard);
            audio.removeEventListener('pause', onPauseGuard);
          } catch {}
          audioRef.current = null;
          resolve();
        };

        // Guard helpers bound to this audio instance
        const onLoadedForGuard = () => {
          try {
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
              const remaining = Math.max(0.1, (audio.duration || 0) - (audio.currentTime || 0));
              armSpeechGuardFromParent(remaining, 'html:loaded');
            }
          } catch {}
        };
        const onTimeUpdateGuard = () => {
          // On some mobile browsers duration is undefined for a while; re-arm with a sliding window
          try {
            if (!(Number.isFinite(audio.duration) && audio.duration > 0)) {
              armSpeechGuardThrottledFromParent(2.5, 'html:tick');
            } else {
              const remaining = Math.max(0.1, (audio.duration || 0) - (audio.currentTime || 0));
              armSpeechGuardThrottledFromParent(remaining, 'html:tick-known');
            }
          } catch {}
        };
        const onPauseGuard = () => {
          try { clearSpeechGuard(); } catch {}
          // When HTMLAudio pauses, pause the video to stay in lockstep
          try { if (videoRef.current) videoRef.current.pause(); } catch {}
        };
        audio.addEventListener('timeupdate', onTimeUpdateGuard);
        audio.addEventListener('pause', onPauseGuard);

        audio.onplay = () => {
          try { setIsSpeaking(true); } catch {}
          // When duration is known on play, re-arm guard precisely
          try {
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
              const remaining = Math.max(0.1, (audio.duration || 0) - (audio.currentTime || 0));
              armSpeechGuardFromParent(remaining, 'html:onplay');
            }
          } catch {}
          // Start the video when audio starts; retry with robust mechanism (mobile quirk)
          try {
            if (videoRef.current) {
              playVideoWithRetry(videoRef.current);
            }
          } catch {}
        };
        audio.onended = () => {
          try {
            setIsSpeaking(false);
            // Pause video when the TTS finishes to surface controls
            if (videoRef.current) { try { videoRef.current.pause(); } catch {} }
            // Clear HTMLAudio paused offset on natural end
            try { htmlAudioPausedAtRef.current = 0; } catch {}
            // If we're in Discussion awaiting-learner, explicitly reveal Opening actions now
            try {
              if (
                phase === 'discussion' &&
                subPhase === 'awaiting-learner' &&
                askState === 'inactive' &&
                riddleState === 'inactive' &&
                poemState === 'inactive'
              ) {
                setShowOpeningActions(true);
              }
            } catch {}
          } catch {}
          clearSpeechGuard();
          cleanup();
        };
        audio.onerror = () => {
          try { setIsSpeaking(false); } catch {}
          clearSpeechGuard();
          // Try WebAudio fallback if available
          (async () => {
            try {
              await playViaWebAudioFromParent(normalizedB64, batchSentences || [], startIndex);
            } catch {
              /* final fallback: no audio */
            } finally {
              cleanup();
            }
          })();
        };

        {
          let playPromise;
          const allowAuto = (!userPaused || forceNextPlaybackRef.current);
          try { console.info('[Session] HTMLAudio: allowAuto=', allowAuto, 'muted=', !!mutedRef.current, 'userPaused=', !!userPaused, 'forceNext=', !!forceNextPlaybackRef.current); } catch {}
          if (allowAuto) {
            playPromise = audio.play();
            // Reset the force flag after first autoplay attempt
            try { if (forceNextPlaybackRef.current) forceNextPlaybackRef.current = false; } catch {}
            // Clear the first-playback HTMLAudio preference after attempting
            if (preferHtmlAudioOnceRef.current) preferHtmlAudioOnceRef.current = false;
          }
          if (playPromise && playPromise.catch) {
            playPromise.catch((err) => {
              console.warn('[Session] Audio autoplay blocked or failed. Falling back to WebAudio.', err);
              try { setIsSpeaking(false); } catch {}
              clearSpeechGuard();
              // If audio cannot start, pause the background video to avoid a perpetual "speaking" feel
              if (videoRef.current && (!userPaused || forceNextPlaybackRef.current)) {
                try { videoRef.current.pause(); } catch {}
              }
              // If this is the first auto-play attempt after restore, try a brief silent WAV unmuted to grant autoplay.
              (async () => {
                let retriedHtml = false;
                try {
                  const silentUrl = makeSilentWavDataUrl(120);
                  if (silentUrl) {
                    const a = new Audio(silentUrl);
                    a.muted = false; // Needs to be audible (tiny blip) for some browsers to grant autoplay
                    a.volume = 0.01; // inaudible to users but non-zero
                    try { await a.play(); } catch {}
                    try { a.pause(); } catch {}
                    retriedHtml = true;
                  }
                } catch {}
                if (retriedHtml) {
                  try {
                    // Retry HTMLAudio once after establishing permission
                    const retry = new Audio(url);
                    audioRef.current = retry;
                    retry.muted = Boolean(mutedRef.current);
                    retry.volume = mutedRef.current ? 0 : 1;
                    scheduleCaptionsForAudio(retry, batchSentences || [], startIndex);
                    await retry.play();
                    return; // success; do not fall back further
                  } catch {}
                }
                // If AudioContext cannot run without a gesture, surface prompt instead of futile fallback
                try {
                  const maybeCtx = ensureAudioContextFromParent();
                  if (!maybeCtx || maybeCtx.state !== 'running') {
                    try { showTipOverride('Tap Resume to start audio.', 4000); } catch {}
                    try { setOfferResume(true); } catch {}
                    return cleanup();
                  }
                } catch {}
                // Attempt WebAudio fallback using the same payload
                try {
                  try { console.info('[Session] HTMLAudio failed; retrying via WebAudio'); } catch {}
                  await playViaWebAudioFromParent(normalizedB64, batchSentences || [], startIndex);
                } catch {
                  /* give up silently */
                } finally {
                  cleanup();
                }
              })();
            });
          }
        }
        if (userPaused && !forceNextPlaybackRef.current) {
          // User paused: do not auto play; keep speaking state true so UI remains gated until TTS completes
          // setIsSpeaking(false);
        }
      });
    } catch (audioError) {
      console.error("[Session] Failed to play audio from base64.", audioError);
      const sentences = batchSentences || [];
      if (sentences.length) {
        setCaptionIndex(startIndex + sentences.length - 1);
      }
      await waitForBeat();
    }
  }, [
    userPaused,
    phase,
    subPhase,
    askState,
    riddleState,
    poemState,
    setIsSpeaking,
    setShowOpeningActions,
    setCaptionIndex,
    clearCaptionTimers,
    clearSpeechGuard,
    scheduleCaptionsForAudio,
    scheduleCaptionsForDuration,
    computeHeuristicDuration,
    finishSynthetic,
    armSpeechGuardFromParent,
    armSpeechGuardThrottledFromParent,
    ensureAudioContextFromParent,
    playViaWebAudioFromParent,
    showTipOverride,
    setOfferResume
  ]);
  
  /**
   * Toggle mute state
   */
  const toggleMute = useCallback(() => {
    setMuted((m) => !m);
  }, [setMuted]);
  
  // Keep audioUnlocked state synced with ref
  useEffect(() => {
    if (audioUnlockedRef.current && !audioUnlocked) {
      try { setAudioUnlocked(true); } catch {}
      try { if (typeof window !== 'undefined') localStorage.setItem('ms_audioUnlocked', 'true'); } catch {}
    }
  }, [audioUnlocked, setAudioUnlocked]);
  
  // React to mute toggle on current audio
  useEffect(() => {
    mutedRef.current = muted;
    if (audioRef.current) {
      try {
        audioRef.current.muted = muted;
        audioRef.current.volume = muted ? 0 : 1;
      } catch {}
    }
    // Propagate mute to WebAudio gain if present
    if (webAudioGainRef.current) {
      try { webAudioGainRef.current.gain.value = muted ? 0 : 1; } catch {}
    }
  }, [muted]);
  
  // Handle deferred playback intent when loading finishes
  useEffect(() => {
    if (!loading && playbackIntent) {
      const intent = playbackIntent;
      // Clear first to avoid re-entry loops
      setPlaybackIntent(null);
      if (intent === 'pause') {
        try { if (audioRef.current) audioRef.current.pause(); } catch {}
        try { if (videoRef.current) videoRef.current.pause(); } catch {}
        try { pauseSynthetic(); } catch {}
        clearCaptionTimers();
        // Ensure UI state reflects paused
        try { setUserPaused(true); } catch {}
      } else if (intent === 'play') {
        if (syntheticRef.current?.active) {
          try { resumeSynthetic(); } catch {}
        }
        const a = audioRef.current;
        if (a) {
          try {
            a.play();
            setIsSpeaking(true);
            const startAt = captionIndex;
            const batchEnd = captionBatchEndRef.current || captionSentencesRef.current.length;
            const slice = (captionSentencesRef.current || []).slice(startAt, batchEnd);
            if (slice.length) {
              try { scheduleCaptionsForAudio(a, slice, startAt); } catch {}
            }
          } catch {}
        }
        // Do not directly play the video here; let audio.onplay (or synthetic resume) start it
        try { setUserPaused(false); } catch {}
      }
    }
  }, [
    loading, 
    playbackIntent, 
    captionIndex, 
    scheduleCaptionsForAudio, 
    pauseSynthetic, 
    resumeSynthetic, 
    clearCaptionTimers, 
    setPlaybackIntent, 
    setIsSpeaking, 
    setUserPaused
  ]);
  
  return {
    playAudioFromBase64,
    scheduleCaptionsForAudio,
    scheduleCaptionsForDuration,
    computeHeuristicDuration,
    toggleMute,
    clearSynthetic,
    finishSynthetic,
    pauseSynthetic,
    resumeSynthetic,
    // Expose refs for external access if needed
    audioCtxRef,
    webAudioGainRef,
    webAudioSourceRef,
    webAudioBufferRef,
    webAudioStartedAtRef,
    webAudioPausedAtRef,
    syntheticRef
  };
}
