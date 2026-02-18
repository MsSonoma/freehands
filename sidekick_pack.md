# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Video loop first attempt plays ~0.5s then stops after landing/refresh; second attempt works. Find videoRef.current play/pause logic and how it syncs with TTS audio (AudioContext permissions, autoplay).
```

Filter terms used:
```text
TTS
videoRef.current
AudioContext
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

TTS videoRef.current AudioContext

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/page.js (69753b375f4d2cb4fc49cc16d8e27b4821c2bc10af77bfe4da4993eada08aab9)
- bm25: -14.5147 | entity_overlap_w: 3.70 | adjusted: -15.4397 | relevance: 1.0000

const startDiscussionStep = async () => {
    // CRITICAL: Unlock audio during user gesture (Begin click) - required for Chrome
    try {
      await unlockAudioPlaybackWrapped();
    } catch (e) {
      // Silent error handling
    }
    
    // Ensure we are not starting in a muted state
    try { setMuted(false); } catch {}
    try { mutedRef.current = false; } catch {}
    try { forceNextPlaybackRef.current = true; } catch {}
    
    // CRITICAL for Chrome: Preload video during user gesture but don't play yet
    // The video will start when TTS actually begins playing
    try {
      if (videoRef.current) {
        if (videoRef.current.readyState < 2) {
          videoRef.current.load();
          // Wait a moment for load to register
          await new Promise(r => setTimeout(r, 100));
        }
        // Just seek to first frame to unlock autoplay, but don't start playing yet
        try {
          videoRef.current.currentTime = 0;
        } catch (e) {
          // Fallback: briefly play then pause to unlock autoplay
          const playPromise = videoRef.current.play();
          if (playPromise && playPromise.then) {
            await playPromise.then(() => {
              try { videoRef.current.pause(); } catch {}
            });
          }
        }
      }
    } catch (e) {
      // Silent error handling
    }
    
  // Unified discussion is now generated locally: Greeting + Encouragement + next-step prompt (no joke/silly question)
    setCanSend(false);
    // Compose the opening text using local pools (no API/TTS for this step)
    const learnerName = (typeof window !== 'undefined' ? (localStorage.getItem('learner_name') || '') : '').trim();
    const lessonTitleExact = (effectiveLessonTitle && typeof effectiveLessonTitle === 'string' && effectiveLes

### 2. src/app/facilitator/generator/counselor/CounselorClient.jsx (de21c11e882e7f1248c295cc627f3d36724db7c0cfab4b802af2b65e83bf0946)
- bm25: -10.5725 | entity_overlap_w: 3.30 | adjusted: -11.3975 | relevance: 1.0000

// Save audio for repeat functionality
      lastAudioRef.current = base64Audio

const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`)
      audio.muted = muted
      audio.volume = muted ? 0 : 1
      audioRef.current = audio

audio.onended = () => {
        setIsSpeaking(false)
        if (videoRef.current) {
          videoRef.current.pause()
        }
        if (buttonVideoRef.current) {
          buttonVideoRef.current.pause()
        }
        audioRef.current = null
      }

audio.onerror = () => {
        setIsSpeaking(false)
        audioRef.current = null
      }

setIsSpeaking(true)
      await audio.play()
      
      // Start video if available
      if (videoRef.current) {
        try {
          videoRef.current.play().catch(() => {})
        } catch {}
      }
      
      // Start button video if available
      if (buttonVideoRef.current) {
        try {
          buttonVideoRef.current.play().catch(() => {})
        } catch {}
      }
    } catch (err) {
      // Silent error handling
      setIsSpeaking(false)
    }
  }, [muted])

// Skip speech: stop audio and video, jump to end of response
  const handleSkipSpeech = useCallback(() => {
    // Stop audio
    if (audioRef.current) {
      try {
        audioRef.current.pause()
        audioRef.current = null
      } catch {}
    }
    
    // Pause video
    if (videoRef.current) {
      try {
        videoRef.current.pause()
      } catch {}
    }
    
    // Pause button video
    if (buttonVideoRef.current) {
      try {
        buttonVideoRef.current.pause()
      } catch {}
    }
    
    // Set speaking to false
    setIsSpeaking(false)
  }, [])

### 3. src/app/session/page.js (21af47a7adae65c61aad1fd0bbaa1d40a8af4580215607352bdf3914f775e04c)
- bm25: -10.4919 | entity_overlap_w: 1.10 | adjusted: -10.7669 | relevance: 1.0000

useEffect(() => {
    return () => {
      clearCaptionTimers();
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch {
          /* ignore */
        }
      }
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

### 4. src/app/session/v2/SessionPageV2.jsx (f058302a65c1a731031e6e0466f5bc1e0659f4fe87cb6bf5599d0192d512dc66)
- bm25: -10.1307 | entity_overlap_w: 1.10 | adjusted: -10.4057 | relevance: 1.0000

if (options?.ignoreResume) {
      resetTranscriptState();
    }
    
    // Start teaching prefetch in the background (needs to be ready by Teaching phase).
    // Defer off the Begin click call stack so the "Loading..." state can render immediately.
    if (teachingControllerRef.current) {
      setTimeout(() => {
        try {
          teachingControllerRef.current?.prefetchAll?.();
          addEvent('📄 Started background prefetch of teaching content');
        } catch {
          // Silent
        }
      }, 0);
    }
    
    // Prep video element (load + seek to first frame). The actual iOS autoplay unlock
    // is handled inside AudioEngine.initialize() (play() during gesture, pause on 'playing').
    try {
      if (videoRef.current) {
        try { videoRef.current.muted = true; } catch {}
        if (videoRef.current.readyState < 2) {
          try { videoRef.current.load(); } catch {}
        }
        try { videoRef.current.currentTime = 0; } catch {}
      }
    } catch {}
    
    const normalizeResumePhase = (phase) => {
      // Defensive: old snapshots may contain sub-phases that aren't valid orchestrator phases.
      if (!phase) return null;
      if (phase === 'grading' || phase === 'congrats') return 'test';
      if (phase === 'complete') return 'closing';
      return phase;
    };

### 5. src/app/session/page.js (03b556b4081da922358ddd942575334dec7f4d59a50b3cb83de1ccc3f4ae0fdd)
- bm25: -9.8393 | entity_overlap_w: 2.20 | adjusted: -10.3893 | relevance: 1.0000

// Preload video on mount to avoid race condition on Begin
  useEffect(() => {
    try {
      if (videoRef.current) {
        // Trigger video load immediately
        videoRef.current.load();
        
        // Track video playing state for Chrome autoplay coordination
        const video = videoRef.current;
        const onPlay = () => {
          videoPlayingRef.current = true;
        };
        const onPause = () => {
          videoPlayingRef.current = false;
        };
        const onEnded = () => {
          videoPlayingRef.current = false;
        };
        
        video.addEventListener('play', onPlay);
        video.addEventListener('playing', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);
        
        return () => {
          video.removeEventListener('play', onPlay);
          video.removeEventListener('playing', onPlay);
          video.removeEventListener('pause', onPause);
          video.removeEventListener('ended', onEnded);
        };
      }
    } catch (e) {
      // Silent error handling
    }
  }, []);

### 6. src/app/session/page.js (df9788fcf3d8a451ee6730b44593b0670d7e3844110c56f24d473caa04751eb2)
- bm25: -8.3101 | entity_overlap_w: 5.20 | adjusted: -9.6101 | relevance: 1.0000

// Helper: speak arbitrary frontend text via unified captions + TTS
  // (defined here after playAudioFromBase64 is available, and updates the ref for early callbacks)
  const speakFrontendImpl = useCallback(async (text, opts = {}) => {
    try {
      const mcLayout = opts && typeof opts === 'object' ? (opts.mcLayout || 'inline') : 'inline';
      const noCaptions = !!(opts && typeof opts === 'object' && opts.noCaptions);
      let sentences = splitIntoSentences(text);
      sentences = mergeMcChoiceFragments(sentences, mcLayout).map((s) => enforceNbspAfterMcLabels(s));
      const assistantSentences = mapToAssistantCaptionEntries(sentences);
      // When noCaptions is set (e.g., resume after refresh), do not mutate caption state
      // so the transcript on screen does not duplicate. Still play TTS.
      let startIndexForBatch = 0;
      if (!noCaptions) {
        const prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), ...assistantSentences];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
        startIndexForBatch = prevLen;
      } else {
        // Keep current caption index; batch will be empty so no scheduling occurs
        try { startIndexForBatch = Number(captionIndexRef.current || 0); } catch { startIndexForBatch = 0; }
      }
      let dec = false;
      try {
        // Check cache first
        let b64 = ttsCache.get(text);
        
        if (b64) {
          console.log('[TTS CACHE HIT]', text.substring(0, 50));
        } else {
          console.log('[TTS CACHE MISS]', text.substring(0, 50));
        }
        
        if (!b64) {
          // Cache miss - fetch from API
          setTtsLoadingCount((c) => c + 1

### 7. src/app/session/page.js (f04141bbd72ef78879c8f3412f66a9b4f76631a4c255e1b96958ea72d90a6fbd)
- bm25: -9.1398 | entity_overlap_w: 1.10 | adjusted: -9.4148 | relevance: 1.0000

// New unified pause implementation
  const pauseAll = useCallback(() => {
    try { pauseSynthetic(); } catch {}
    if (audioRef.current) {
      try {
        try { htmlAudioPausedAtRef.current = Number(audioRef.current.currentTime || 0); } catch {}
        audioRef.current.pause();
      } catch {}
    }
    // Record WebAudio pause offset and stop source
    try {
      const ctx = audioCtxRef.current;
      if (ctx && webAudioBufferRef.current && webAudioSourceRef.current) {
        const elapsed = Math.max(0, (ctx.currentTime || 0) - (webAudioStartedAtRef.current || 0));
        webAudioPausedAtRef.current = elapsed;
      }
    } catch {}
    try {
      if (webAudioSourceRef.current) {
        try { webAudioSourceRef.current.stop(); } catch {}
        try { webAudioSourceRef.current.disconnect(); } catch {}
        webAudioSourceRef.current = null;
      }
    } catch {}
    try { if (videoRef.current) videoRef.current.pause(); } catch {}
    try { clearCaptionTimers(); } catch {}
    try { clearSpeechGuard(); } catch {}
  }, []);

### 8. src/app/session/page.js (3759a02343969a963fa17d4c9d201ecbd4f5b3369e9fb240662e078ee35f70c7)
- bm25: -8.7348 | entity_overlap_w: 1.30 | adjusted: -9.0598 | relevance: 1.0000

// (moved lower originally) placeholder: title dispatch effect defined after manifestInfo/effectiveLessonTitle
  // Fixed scale factor to avoid any auto-shrinking behavior
  const snappedScale = 1;
  // (footer height measurement moved above stacked caption sizing effect)
  // Media & caption refs (restored after refactor removal)
  const videoRef = useRef(null); // controls lesson video playback synchrony with TTS
  const videoPlayingRef = useRef(false); // track if video is currently playing to avoid duplicate play calls
  const audioRef = useRef(null); // active Audio element for synthesized speech
  const captionTimersRef = useRef([]); // active timers advancing captionIndex
  const captionSentencesRef = useRef([]); // accumulated caption sentences for full transcript persistence
  // Track re-joins: begin timestamp when the user hits Begin
  useEffect(() => {
    if (showBegin === false && !sessionStartRef.current) {
      sessionStartRef.current = new Date().toISOString();
      // Start a fresh transcript segment at the current caption length
      try { transcriptSegmentStartIndexRef.current = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current.length : 0; } catch {}
    }
  }, [showBegin]);
  // Track current caption batch boundaries for accurate resume scheduling
  const captionBatchStartRef = useRef(0);
  const captionBatchEndRef = useRef(0);
  // Playback controls
  const [muted, setMuted] = useState(false);
  const isSpeakingRef = useRef(false);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  // Mirror latest mute state for async callbacks (prevents stale closures)
  const mutedRef = useRef(false);
  // When true, the next play attempt ignores gating (used for Opening begin)
  const forceNextPlaybackRef = use

### 9. src/app/session/page.js (59f0630a0b46dced619eee0c9612af55bfa0697b3d15f90deb1293c3b7149a64)
- bm25: -8.7293 | entity_overlap_w: 1.30 | adjusted: -9.0543 | relevance: 1.0000

// Audio playback hook - manages all TTS audio, video sync, and caption scheduling
  const {
    playAudioFromBase64: playAudioFromBase64Hook,
    scheduleCaptionsForAudio: scheduleCaptionsForAudioHook,
    scheduleCaptionsForDuration: scheduleCaptionsForDurationHook,
    computeHeuristicDuration: computeHeuristicDurationHook,
    toggleMute: toggleMuteHook,
    clearSynthetic: clearSyntheticHook,
    finishSynthetic: finishSyntheticHook,
    pauseSynthetic: pauseSyntheticHook,
    resumeSynthetic: resumeSyntheticHook,
    // Refs from the hook
    audioCtxRef,
    webAudioGainRef,
    webAudioSourceRef,
    webAudioBufferRef,
    webAudioStartedAtRef,
    webAudioPausedAtRef,
    syntheticRef
  } = useAudioPlayback({
  // State setters
  setIsSpeaking,
  setShowRepeatButton,
  setShowOpeningActions,
    setCaptionIndex,
    setCaptionsDone,
    setCaptionSentences,
    setMuted,
    setAudioUnlocked,
    setOfferResume,
    
    // State values
    muted,
    loading,
    captionIndex,
    audioUnlocked,
    phase,
    subPhase,
    askState,
    riddleState,
    poemState,
    
    // Refs passed to hook
    audioRef,
    videoRef,
    mutedRef,
    audioUnlockedRef,
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
    
    // Utility functions from utils and inline functions
    scheduleCaptionsForAudioUtil,
    scheduleCaptionsForDurationUtil,
    clearSyntheticUtil,
    finishSyntheticUtil,
    pauseSyntheticUtil,
    resumeSyntheticUtil,
    clearCaptionTimers,
    clearSpeechGuard,
    armSpeechGuard,

### 10. src/app/session/page.js (d6d20109e37b6d839636505f837977fbf6ab49a0eecf697e8c8a03b3e7846dc8)
- bm25: -8.7582 | entity_overlap_w: 1.10 | adjusted: -9.0332 | relevance: 1.0000

const innerVideoWrapperStyle = isMobileLandscape
    ? { position: 'relative', overflow: 'hidden', aspectRatio: '16 / 7.2', minHeight: 200, width: '100%', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000', '--ctrlSize': 'clamp(34px, 6.2vw, 52px)', ...dynamicHeightStyle }
    : { position: 'relative', overflow: 'hidden', height: `${portraitSvH}svh`, width: '92%', margin: '0 auto', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000', '--ctrlSize': 'clamp(34px, 6.2vw, 52px)' };
  return (
    <div style={outerWrapperStyle}>
      <div style={innerVideoWrapperStyle}>
        <video
          ref={videoRef}
          src="/media/ms-sonoma-3.mp4"
          autoPlay
          muted
          loop
          playsInline
          webkit-playsinline="true"
          preload="auto"
          onLoadedMetadata={() => {
            try {
              // Seek to first frame without pausing to keep video ready for immediate playback
              if (videoRef.current && videoRef.current.paused) {
                try { videoRef.current.currentTime = 0; } catch {}
              }
            } catch {}
          }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
        />
        {/* Session Timer - overlay in top left */}
        {/* Phase-based timer: Show when phaseTimers loaded and in an active phase */}
        {phaseTimers && !showBegin && getCurrentPhaseName() && currentTimerMode[getCurrentPhaseName()] && (
          <div style={{ 
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10001
          }}>
            <SessionTimer
              key={(() => {
                const phaseName = getCurre

### 11. src/app/session/page.js (2bd193e0789b44a479865fc597d941b6c2ebe143079c6b1e9f8d195a5eec5d0b)
- bm25: -8.1509 | entity_overlap_w: 1.10 | adjusted: -8.4259 | relevance: 1.0000

// Centralized abort/cleanup: stop audio, captions, mic/STT, and in-flight requests
  // keepCaptions: when true, do NOT wipe captionSentences so on-screen transcript remains continuous across handoffs
  const abortAllActivity = useCallback((keepCaptions = false) => {
    // Abort in-flight Ms. Sonoma
    try { if (sonomaAbortRef.current) sonomaAbortRef.current.abort('skip'); } catch {}
    // Stop audio playback
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      try { audioRef.current.src = ''; } catch {}
      audioRef.current = null;
    }
    // Pause video as well on abort
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch {}
    }
    // Stop synthetic playback timers/state
    try { clearSynthetic(); } catch {}
    // Clear any deferred playback intent so it does not apply after abort
    try { setPlaybackIntent(null); } catch {}
    // Clear captions timers and optionally content
    try {
      clearCaptionTimers();
      captionBatchStartRef.current = 0;
      captionBatchEndRef.current = 0;
      if (!keepCaptions) {
        captionSentencesRef.current = [];
        setCaptionSentences([]);
        setCaptionIndex(0);
      }
    } catch {}
    // Reset transcript, speaking state, and input
    setTranscript('');
    setIsSpeaking(false);
    setLearnerInput('');
    // Notify children (InputPanel) to stop mic and cancel STT
    setAbortKey((k) => k + 1);
  }, []);

### 12. src/app/session/v2/SessionPageV2.jsx (bb342f1e310d51453efe399caa9a1a4e597dae8cf97834c5446a3471da2fe038)
- bm25: -7.9965 | entity_overlap_w: 1.10 | adjusted: -8.2715 | relevance: 1.0000

// Measure the fixed footer height so portrait caption sizing can reserve exact space (V1 parity)
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const measure = () => {
      try {
        const h = Math.ceil(el.getBoundingClientRect().height);
        if (Number.isFinite(h) && h >= 0) setFooterHeight(h);
      } catch {}
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      try { ro.observe(el); } catch {}
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
    }
    return () => {
      try { ro && ro.disconnect(); } catch {}
      if (typeof window !== 'undefined') window.removeEventListener('resize', measure);
    };
  }, []);

// Set portrait caption height to 35vh
  useEffect(() => {
    if (isMobileLandscape) {
      setStackedCaptionHeight(null);
    } else {
      // 35vh for portrait mode
      const vh = window.innerHeight;
      const targetHeight = Math.floor(vh * 0.35);
      setStackedCaptionHeight(targetHeight);
    }
  }, [isMobileLandscape]);
  
  // Initialize AudioEngine
  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

const tryInit = () => {
      if (cancelled) return;

const videoEl = videoRef.current;
      if (!videoEl) {
        // videoRef is a ref, so changes won't retrigger this effect.
        // Retry until the video element is mounted so the Begin button
        // doesn't get stuck in "Loading...".
        console.log('[SessionPageV2] VideoRef not ready yet');
        retryTimer = setTimeout(tryInit, 50);
        return;
      }

if (audioEngineRef.current) {
        console.log('[SessionPageV2] AudioEngine already initialized');
        return;
      }

### 13. src/app/session/v2/SessionPageV2.jsx (87c2d954a33e025feccd5c4d34574c1a91c8043e3be00db290e40081dab1d365)
- bm25: -8.1122 | relevance: 1.0000

{showVisualAids && planEnt?.visualAids && Array.isArray(visualAidsData) && visualAidsData.length > 0 && (
        <SessionVisualAidsCarousel
          visualAids={visualAidsData}
          onClose={() => setShowVisualAids(false)}
          onExplain={handleExplainVisualAid}
          videoRef={videoRef}
          isSpeaking={engineState === 'playing'}
        />
      )}
      
      {showGames && planEnt?.games && (() => {
        const phaseName = getCurrentPhaseName();
        const timerType = phaseName ? currentTimerMode[phaseName] : null;
        const timerNode = (phaseTimers && phaseName && timerType === 'play') ? (
          <SessionTimer
            key={`games-timer-${phaseName}-${timerType}-${timerRefreshKey}`}
            phase={phaseName}
            timerType={timerType}
            totalMinutes={getCurrentPhaseTimerDuration(phaseName, timerType)}
            goldenKeyBonus={timerType === 'play' && goldenKeysEnabledRef.current !== false ? goldenKeyBonus : 0}
            isPaused={timerPaused}
            lessonKey={lessonKey}
            lessonProgress={calculateLessonProgress()}
            onTimerClick={handleTimerClick}
          />
        ) : null;

return (
          <GamesOverlay
            onClose={() => setShowGames(false)}
            playTimer={timerNode}
          />
        );
      })()}

### 14. src/app/session/page.js (24d0ad1fca5c4d9e137faf448d67edbdd18d815a89dd1d4902030a56f456fcba)
- bm25: -7.0755 | entity_overlap_w: 3.90 | adjusted: -8.0505 | relevance: 1.0000

// isSpeaking/phase/subPhase defined earlier; do not redeclare here
  const [transcript, setTranscript] = useState("");
  // Start with loading=true so the existing overlay spinner shows during initial restore
  const [loading, setLoading] = useState(true);
  // TTS overlay: track TTS fetch activity separately; overlay shows when either API or TTS is loading
  const [ttsLoadingCount, setTtsLoadingCount] = useState(0);
  const overlayLoading = loading || (ttsLoadingCount > 0);

### 15. src/app/session/v2/SessionPageV2.jsx (83f260f98e1e2ff0f95333709788a05eae63a3645329eff6bfcbf89038e243dc)
- bm25: -7.3242 | entity_overlap_w: 2.60 | adjusted: -7.9742 | relevance: 1.0000

const playEnabledForPhase = (p) => {
      if (!p) return true;
      if (p === 'comprehension') return playPortionsEnabledRef.current?.comprehension !== false;
      if (p === 'exercise') return playPortionsEnabledRef.current?.exercise !== false;
      if (p === 'worksheet') return playPortionsEnabledRef.current?.worksheet !== false;
      if (p === 'test') return playPortionsEnabledRef.current?.test !== false;
      return true;
    };
    const skipPlayPortion = ['comprehension', 'exercise', 'worksheet', 'test'].includes(phaseName)
      ? !playEnabledForPhase(phaseName)
      : false;
    
    // Special handling for discussion: prefetch greeting TTS before starting
    if (phaseName === 'discussion') {
      setDiscussionState('loading');
      const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || 'friend';
      const lessonTitle = lessonData?.title || lessonId || 'this topic';
      const greetingText = `Hi ${learnerName}, ready to learn about ${lessonTitle}?`;
      
      try {
        // Prefetch greeting TTS
        await fetchTTS(greetingText);
      } catch (err) {
        console.error('[SessionPageV2] Failed to prefetch greeting:', err);
      }
      
      // Discussion work timer starts when Begin is clicked, not here
    }
    
    const ref = getPhaseRef(phaseName);
    if (ref?.current?.start) {
      if (skipPlayPortion) {
        transitionToWorkTimer(phaseName);
        // Start work timer immediately when skipping play portion (unless timeline jump already started it)
        if (timerServiceRef.current && timelineJumpTimerStartedRef.current !== phaseName) {
          timerServiceRef.current.startWorkPhaseTimer(phaseName);
        }
        await ref.current.start({ skipPlayPortion: true });
      }

### 16. src/app/session/page.js (5081bab5884e02689acef54dcbfce6800c4856f78c451b0a67136e3e40d1fded)
- bm25: -6.9208 | entity_overlap_w: 1.30 | adjusted: -7.2458 | relevance: 1.0000

// Request TTS for the local opening and play it using the same pipeline as API replies.
      setLoading(true);
      setTtsLoadingCount((c) => c + 1);
  const replyStartIndex = prevLen; // we appended opening sentences at the end
      let res;
      try {
        res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: replyText }) });
        var data = await res.json().catch(() => ({}));
        var audioB64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
        // Dev warm-up: if route wasn't ready (404) or no audio returned, pre-warm and retry once
        if ((!res.ok && res.status === 404) || !audioB64) {
          try { await fetch('/api/tts', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(() => {}); } catch {}
          try { await waitForBeat(400); } catch {}
          res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: replyText }) });
          data = await res.json().catch(() => ({}));
          audioB64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
        }
      } finally {
        setTtsLoadingCount((c) => Math.max(0, c - 1));
      }
      if (audioB64) audioB64 = normalizeBase64Audio(audioB64);
      // Match API flow: stop showing loading before kicking off audio
      setLoading(false);
      if (audioB64) {
        // Stash payload so gesture-based unlock can retry immediately if needed
        try { lastAudioBase64Ref.current = audioB64; } catch {}
        setIsSpeaking(true);
        // CRITICAL: Also update the ref immediately to prevent double-playback in recovery timeout

### 17. src/app/session/page.js (1ad0d1d16447dcb7806046a0c5f1693bad1f87161d396cc55ffaa04b934e6876)
- bm25: -6.7163 | entity_overlap_w: 1.30 | adjusted: -7.0413 | relevance: 1.0000

const lastAudioBase64Ref = useRef(null);
  // Track HTMLAudio paused position so we can reconstruct/resume after long idle or GC
  const htmlAudioPausedAtRef = useRef(0);
  // Prefer HTMLAudio for the very first TTS playback (Opening) to satisfy stricter autoplay policies.
  // We reset this after the first attempt so subsequent replies can use WebAudio-first as usual.
  const preferHtmlAudioOnceRef = useRef(false);
  // Prevent multiple recovery attempts for the Opening playback
  const openingReattemptedRef = useRef(false);
  // Guard: if audio stalls or never ends on mobile, auto-release the speaking lock so controls do not hang
  const speechGuardTimerRef = useRef(null);
  const clearSpeechGuard = useCallback(() => {
    clearSpeechGuardUtil(speechGuardTimerRef);
  }, []);
  const forceStopSpeaking = useCallback((reason = 'timeout') => {
    forceStopSpeakingUtil(
      reason,
      { audioRef, videoRef, speechGuardTimerRef },
      { phase, subPhase, askState, riddleState, poemState },
      setIsSpeaking,
      setShowOpeningActions,
      stopWebAudioSource
    );
  }, [phase, subPhase, askState, riddleState, poemState]);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  // Track last arm time to avoid spamming guard while we get metadata/ticks
  const lastGuardArmAtRef = useRef(0);
  const armSpeechGuard = useCallback((seconds, label = '') => {
    armSpeechGuardUtil(seconds, label, speechGuardTimerRef, forceStopSpeaking);
  }, [forceStopSpeaking]);
  const armSpeechGuardThrottled = useCallback((seconds, label = '') => {
    armSpeechGuardThrottledUtil(seconds, label, lastGuardArmAtRef, armSpeechGuard);
  }, [armSpeechGuard]);
  const lastSentencesRef = useRef([]);
  const lastStartIndexRef = useRef(0);
  // Test phase state
  const [testActiv

### 18. src/app/api/counselor/route.js (c6e5dea03f1201bb587f695d4f32d8a7dc08671babcbe1d3cdfae68114474706)
- bm25: -6.2980 | entity_overlap_w: 2.60 | adjusted: -6.9480 | relevance: 1.0000

function loadTtsCredentials() {
  const inline = process.env.GOOGLE_TTS_CREDENTIALS
  const inlineCreds = decodeCredentials(inline)
  if (inlineCreds) return inlineCreds

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'google-tts-key.json')
  try {
    if (credentialPath && fs.existsSync(credentialPath)) {
      const raw = fs.readFileSync(credentialPath, 'utf8').trim()
      if (raw) return decodeCredentials(raw) || JSON.parse(raw)
    }
  } catch (fileError) {
    // Credentials load failed - TTS will be unavailable
  }
  return null
}

async function getTtsClient() {
  if (ttsClientPromise) return ttsClientPromise

const credentials = loadTtsCredentials()
  if (!credentials) {
    // No credentials - voice playback disabled
    return null
  }

ttsClientPromise = (async () => {
    try {
      return new TextToSpeechClient({ credentials })
    } catch (error) {
      // TTS client init failed
      ttsClientPromise = undefined
      return null
    }
  })()

ttsClientPromise.catch(() => { ttsClientPromise = undefined })
  return ttsClientPromise
}

function createCallId() {
  const timePart = Date.now().toString(36)
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${timePart}-${randomPart}`
}

function pushToolLog(toolLog, entry) {
  if (!Array.isArray(toolLog)) return
  const message = buildToolLogMessage(entry?.name, entry?.phase, entry?.context)
  if (!message) return
  toolLog.push({
    id: entry?.id || createCallId(),
    timestamp: Date.now(),
    name: entry?.name,
    phase: entry?.phase,
    message,
    context: entry?.context || {}
  })
}

### 19. sidekick_pack_takeover.md (376cf1a07dfa6f6120fc79857838fadc2dc9ac44fac46c335e3387cc01d643db)
- bm25: -5.9770 | entity_overlap_w: 2.60 | adjusted: -6.6270 | relevance: 1.0000

interceptResult.response = `Ok. I\'m opening the Lesson Planner and generating a ${action.durationMonths}-month plan starting ${action.startDate}.`
          }
        }
        
        // Add interceptor response to conversation
        const finalHistory = [
          ...updatedHistory,
          { role: 'assistant', content: interceptResult.response }
        ]
        setConversationHistory(finalHistory)
        
        // Display interceptor response in captions
        setCaptionText(interceptResult.response)
        const sentences = splitIntoSentences(interceptResult.response)
        setCaptionSentences(sentences)
        setCaptionIndex(0)
        
        // Play TTS for interceptor response (Mr. Mentor's voice)
        setLoadingThought("Preparing response...")
        try {
          const ttsResponse = await fetch('/api/mentor-tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: interceptResult.response })
          })
          
          if (ttsResponse.ok) {
            const ttsData = await ttsResponse.json()
            if (ttsData.audio) {
              await playAudio(ttsData.audio)
            }
          }
        } catch (err) {
          // Silent TTS error - don't block UX
        }
        
        setLoading(false)
        setLoadingThought(null)
        return
      }
      
      // Interceptor didn't handle - forward to API
      setLoadingThought("Consulting my knowledge base...")
      const forwardMessage = interceptResult.apiForward?.message || message
      const finalForwardMessage = declineNote ? `${forwardMessage}\n\n${declineNote}` : forwardMessage
      const forwardContext = interceptResult.apiForward?.context || {}

### 20. src/app/session/page.js (20f28cc40796da60b2e4929c581ce87da889d1e2554cd6cbe429b0db4867f718)
- bm25: -6.2672 | entity_overlap_w: 1.30 | adjusted: -6.5922 | relevance: 1.0000

// Inject into transcript and captions locally (isolate errors so TTS still proceeds)
      setTranscript(replyText);
      setError("");
      let prevLen = 0;
      let newSentences = [];
      try {
        // Prepare captions from the full reply
        newSentences = splitIntoSentences(replyText);
        newSentences = mergeMcChoiceFragments(newSentences);
        newSentences = newSentences.map((s) => enforceNbspAfterMcLabels(s));
        const normalizedOriginal = replyText.replace(/\s+/g, ' ').trim();
        const normalizedJoined = newSentences.join(' ').replace(/\s+/g, ' ').trim();
        if (normalizedJoined.length < Math.floor(0.9 * normalizedOriginal.length)) {
          newSentences = [normalizedOriginal];
        }
        const assistantSentences = mapToAssistantCaptionEntries(newSentences);
        prevLen = captionSentencesRef.current?.length || 0;
        let nextAll = [...(captionSentencesRef.current || [])];
        nextAll = [...nextAll, ...assistantSentences];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
      } catch (capErr) {
        // Keep minimal single-sentence caption
        newSentences = [replyText];
        const assistantSentences = mapToAssistantCaptionEntries(newSentences);
        prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), ...assistantSentences];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
      }

### 21. src/app/session/page.js (efdfcbdfbc261d3a54e33f865800bfa92ec154f43e042ece0fcb411f896e8ec6)
- bm25: -6.5593 | relevance: 1.0000

{/* Visual Aids Carousel - for displaying lesson visual aids */}
    {showVisualAidsCarousel && visualAidsData && (
      <SessionVisualAidsCarousel
        visualAids={visualAidsData}
        onClose={() => setShowVisualAidsCarousel(false)}
        onExplain={handleExplainVisualAid}
        videoRef={videoRef}
        isSpeaking={isSpeaking}
      />
    )}

{/* Games overlay - moved outside container to fix z-index stacking */}
    {showGames && (
      <GamesOverlay
        onClose={() => setShowGames(false)}
        playTimer={phaseTimers && getCurrentPhaseName() && currentTimerMode[getCurrentPhaseName()] === 'play' ? (
          <SessionTimer
            phase={getCurrentPhaseName()}
            timerType="play"
            totalMinutes={getCurrentPhaseTimerDuration(getCurrentPhaseName(), 'play')}
            goldenKeyBonus={goldenKeyBonus}
            lessonProgress={calculateLessonProgress()}
            isPaused={timerPaused}
            onTimeUp={handlePhaseTimerTimeUp}
            onPauseToggle={handleTimerPauseToggle}
            lessonKey={lessonKey}
            onTimerClick={handleTimerClick}
          />
        ) : null}
      />
    )}

{/* Session takeover dialog - outside container to avoid header/footer clipping */}
    {showTakeoverDialog && conflictingSession && (
      <SessionTakeoverDialog
        existingSession={conflictingSession}
        onTakeover={handleSessionTakeover}
        onCancel={handleCancelTakeover}
      />
    )}

### 22. src/app/facilitator/generator/counselor/CounselorClient.jsx (308d5449116cb51de7d8566acac623f39d47bdbdd34a35804bfe1d289da9aafd)
- bm25: -5.8920 | entity_overlap_w: 2.60 | adjusted: -6.5420 | relevance: 1.0000

interceptResult.response = `Ok. I\'m opening the Lesson Planner and generating a ${action.durationMonths}-month plan starting ${action.startDate}.`
          }
        }
        
        // Add interceptor response to conversation
        const finalHistory = [
          ...updatedHistory,
          { role: 'assistant', content: interceptResult.response }
        ]
        setConversationHistory(finalHistory)
        
        // Display interceptor response in captions
        setCaptionText(interceptResult.response)
        const sentences = splitIntoSentences(interceptResult.response)
        setCaptionSentences(sentences)
        setCaptionIndex(0)
        
        // Play TTS for interceptor response (Mr. Mentor's voice)
        setLoadingThought("Preparing response...")
        try {
          const ttsResponse = await fetch('/api/mentor-tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: interceptResult.response })
          })
          
          if (ttsResponse.ok) {
            const ttsData = await ttsResponse.json()
            if (ttsData.audio) {
              // Never block the UI on audio playback.
              void playAudio(ttsData.audio)
            }
          }
        } catch (err) {
          // Silent TTS error - don't block UX
        }
        
        setLoading(false)
        setLoadingThought(null)
        return
      }
      
      // Interceptor didn't handle - forward to API
      setLoadingThought("Consulting my knowledge base...")
      const forwardMessage = interceptResult.apiForward?.message || message
      const finalForwardMessage = declineNote ? `${forwardMessage}\n\n${declineNote}` : forwardMessage
      const forwardContext = interceptResult

### 23. src/app/session/page.js (99920f8f6d876fe97afeaca35410ae6d45b9d8163f6a8cd9698629b230fe2951)
- bm25: -6.2060 | entity_overlap_w: 1.30 | adjusted: -6.5310 | relevance: 1.0000

// Speak congrats summary once upon entering congrats
  const congratsSpokenRef = useRef(false);
  // Defer auto-review transitions while final TTS feedback is playing
  const reviewDeferRef = useRef(false);
  const [congratsSpeaking, setCongratsSpeaking] = useState(false);
  useEffect(() => {
    if (phase === 'congrats' && typeof testFinalPercent === 'number' && congratsStarted && !congratsSpokenRef.current) {
      const learnerName = (typeof window !== 'undefined' ? (localStorage.getItem('learner_name') || '') : '').trim();
      const closing = generateClosing({
        conceptLearned: 'today\'s test',
        engagementLevel: 'focused',
        learnerName: learnerName || null
      });
      const lines = [
        `Your score is ${testFinalPercent}%.`,
        closing
      ].join(' ');
      (async () => {
        setCongratsSpeaking(true);
        setCongratsDone(false);
        try { await speakFrontend(lines); } catch {}
        setCongratsSpeaking(false);
        setCongratsDone(true);
      })();
      congratsSpokenRef.current = true;
    }
    if (phase !== 'congrats') {
      congratsSpokenRef.current = false;
      setCongratsStarted(false);
      setCongratsSpeaking(false);
      setCongratsDone(false);
    }
  }, [phase, testFinalPercent, congratsStarted]);

### 24. src/app/session/v2/SessionPageV2.jsx (cfbddb35459087742584099746e54514ea5fc6a2a1ca1a8df7165066a9edf019)
- bm25: -6.1688 | entity_overlap_w: 1.30 | adjusted: -6.4938 | relevance: 1.0000

// Allow early-declared callbacks to invoke startSession without TDZ issues.
  startSessionRef.current = startSession;
  
  const startTeaching = async (options = {}) => {
    if (!teachingControllerRef.current) return;
    await teachingControllerRef.current.startTeaching(options);
  };
  
  const nextSentence = async () => {
    if (!teachingControllerRef.current) return;
    
    // Show loading if GPT content isn't ready
    setTeachingLoading(true);
    try {
      await teachingControllerRef.current.nextSentence();
    } finally {
      setTeachingLoading(false);
    }
  };
  
  const repeatSentence = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.repeatSentence();
  };
  
  const skipToExamples = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.skipToExamples();
  };
  
  const restartStage = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.restartStage();
  };
  
  const stopAudio = () => {
    if (!audioEngineRef.current) return;
    stopAudioSafe();
  };
  
  const pauseAudio = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.pause();
  };
  
  const resumeAudio = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.resume();
  };
  
  const toggleMute = () => {
    if (!audioEngineRef.current) return;
    const newMuted = !audioEngineRef.current.isMuted;
    audioEngineRef.current.setMuted(newMuted);
    setIsMuted(newMuted);
  };
  
  // Skip current TTS playback
  const skipTTS = () => {
    if (!audioEngineRef.current) return;
    if (askExitSpeechLockRef.current) return;
    stopAudioSafe();
    
    // If we're in a phase with a skip handler, call it to transition state properly

### 25. src/app/api/counselor/route.js (ae56bfb45792f94ba0e24339febbe103db9c5d2b873b9f69dcc8f6616b636b5c)
- bm25: -5.8093 | entity_overlap_w: 2.60 | adjusted: -6.4593 | relevance: 1.0000

// Helper function to synthesize audio with caching
async function synthesizeAudio(text, logPrefix) {
  let audioContent = undefined
  
  // Strip markdown formatting for TTS (keep text readable but remove syntax)
  // Remove **bold**, *italic*, and other markdown markers
  const cleanTextForTTS = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')  // Remove **bold**
    .replace(/\*([^*]+)\*/g, '$1')      // Remove *italic*
    .replace(/_([^_]+)_/g, '$1')        // Remove _underline_
    .replace(/`([^`]+)`/g, '$1')        // Remove `code`
    .replace(/^#+\s+/gm, '')            // Remove # headers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // Remove [links](url)
  
  // Check cache first (use cleaned text as key)
  if (ttsCache.has(cleanTextForTTS)) {
    audioContent = ttsCache.get(cleanTextForTTS)
  } else {
    const ttsClient = await getTtsClient()
    if (ttsClient) {
      try {
        const ssml = toSsml(cleanTextForTTS)
        const [ttsResponse] = await ttsClient.synthesizeSpeech({
          input: { ssml },
          voice: MENTOR_VOICE,
          audioConfig: MENTOR_AUDIO_CONFIG
        })
        
        if (ttsResponse?.audioContent) {
          audioContent = typeof ttsResponse.audioContent === 'string'
            ? ttsResponse.audioContent
            : Buffer.from(ttsResponse.audioContent).toString('base64')
          
          // Cache with naive LRU
          ttsCache.set(cleanTextForTTS, audioContent)
          if (ttsCache.size > TTS_CACHE_MAX) {
            const firstKey = ttsCache.keys().next().value
            ttsCache.delete(firstKey)
          }
        }
      } catch (ttsError) {
        // TTS synthesis failed - will return undefined
      }
    }
  }
  
  return audioContent
}

### 26. src/app/session/page.js (5ebfc03af0ee8e5b408f25599d22b5cc33578df677f5614a757547f3ec5f5c1d)
- bm25: -6.0912 | entity_overlap_w: 1.30 | adjusted: -6.4162 | relevance: 1.0000

// Repeat speech: replay the last TTS audio without updating captions
  const handleRepeatSpeech = useCallback(async () => {
    // Check if we have audio to replay
    if (!lastAudioBase64Ref.current) {
      return;
    }
    
    // Hide repeat button while playing
    setShowRepeatButton(false);
    
    // Set speaking state
    setIsSpeaking(true);
    
    try {
      // Replay audio without updating captions (pass empty array for sentences)
      await playAudioFromBase64(lastAudioBase64Ref.current, [], 0);
    } catch (err) {
      setIsSpeaking(false);
      // Show repeat button again since replay failed
      if (lastAudioBase64Ref.current) {
        setShowRepeatButton(true);
      }
    }
  }, [playAudioFromBase64]);

// Show visual aids carousel
  const handleShowVisualAids = useCallback(() => {
    setShowVisualAidsCarousel(true);
  }, []);

// Explain visual aid via Ms. Sonoma
  const handleExplainVisualAid = useCallback(async (visualAid) => {
    if (!visualAid || !visualAid.description) {
      return;
    }

// Read the pre-generated description (created during image generation)
    await speakFrontendImpl(visualAid.description, {});
  }, []);

### 27. src/app/session/page.js (fc0201f776b61ad3a0bb0d6843c5e5a2f1665e32c2bb762a1c7006264f6cf47d)
- bm25: -5.8365 | entity_overlap_w: 1.30 | adjusted: -6.1615 | relevance: 1.0000

// Skip speech: stop TTS, video, captions and jump to end of current response turn
  const skipJustFiredRef = useRef(false);

const handleSkipSpeech = useCallback(() => {
    // Mark that skip just fired to prevent Begin hotkey from auto-triggering
    skipJustFiredRef.current = true;
    setTimeout(() => { skipJustFiredRef.current = false; }, 300);

// Abort everything but keep existing transcript/captions on screen
    abortAllActivity(true);

// Explicitly stop any pending WebAudio source and guard timers
    try {
      if (webAudioSourceRef.current) {
        try { webAudioSourceRef.current.stop(); } catch {}
        try { webAudioSourceRef.current.disconnect(); } catch {}
        webAudioSourceRef.current = null;
      }
      clearSpeechGuard();
    } catch {}

// Hide repeat button during the skip action
    try { setShowRepeatButton(false); } catch {}

// Enable input immediately when skipping
    try { setCanSend(true); } catch {}

// Scroll transcript to bottom
    try {
      if (captionBoxRef.current) {
        captionBoxRef.current.scrollTop = captionBoxRef.current.scrollHeight;
      }
    } catch {}

// Show opening actions if in the right phase/state
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

// Reset playback state refs
    webAudioStartedAtRef.current = 0;
    webAudioPausedAtRef.current = 0;
    htmlAudioPausedAtRef.current = 0;

// Restore repeat button so the learner can hear the last line again
    try {
      if (lastAudioBase64Ref.current) {
        setShowRepeatButton(true);
      }
    } catch {}

### 28. src/app/session/page.js (31d0fe7aac77163820e24cc78058f4c0ced354b2e2f524e4763c66f78c86a7dd)
- bm25: -5.9398 | relevance: 1.0000

{/* Video + captions: stack normally; side-by-side on mobile landscape */}
  <div style={isMobileLandscape ? { display:'flex', alignItems:'stretch', width:'100%', paddingBottom:4, '--msSideBySideH': (videoEffectiveHeight ? `${videoEffectiveHeight}px` : (sideBySideHeight ? `${sideBySideHeight}px` : 'auto')) } : {}}>
    <div ref={videoColRef} style={isMobileLandscape ? { flex:`0 0 ${videoColPercent}%`, display:'flex', flexDirection:'column', minWidth:0, minHeight:0, height: 'var(--msSideBySideH)' } : {}}>
  {/* Shared Complete Lesson handler */}
  { /* define once; stable ref for consumers */ }
  <VideoPanel
        isMobileLandscape={isMobileLandscape}
        isShortHeight={isShortHeight}
  videoMaxHeight={videoEffectiveHeight || videoMaxHeight}
        videoRef={videoRef}
        showBegin={showBegin}
        isSpeaking={isSpeaking}
        phase={phase}
  ticker={ticker}
    currentWorksheetIndex={currentWorksheetIndex}
        onBegin={beginSession}
        onBeginComprehension={beginComprehensionPhase}
        onBeginWorksheet={beginWorksheetPhase}
        onBeginTest={beginTestPhase}
        onBeginSkippedExercise={beginSkippedExercise}
        subPhase={subPhase}
        testCorrectCount={testCorrectCount}
        testFinalPercent={testFinalPercent}
        lessonParam={lessonParam}
        lessonKey={lessonKey}
        muted={muted}
        onToggleMute={toggleMute}
        onSkip={handleSkipSpeech}
  loading={loading}
  overlayLoading={overlayLoading}
        exerciseSkippedAwaitBegin={exerciseSkippedAwaitBegin}
        skipPendingLessonLoad={skipPendingLessonLoad}
  currentCompProblem={currentCompProblem}
  testActiveIndex={testActiveIndex}
  testList={Array.isArray(generatedTest) ? generatedTest : []}
        onCompleteLesson={onCompleteLesson}
        sessio

### 29. src/app/session/page.js (de41b4cf0f59d1cc74aaec328e8c6cee81d5ea392fcce2f705add468e116e5d2)
- bm25: -5.5021 | entity_overlap_w: 1.30 | adjusted: -5.8271 | relevance: 1.0000

const prevLen = captionSentencesRef.current?.length || 0;
  let nextAll = [...(captionSentencesRef.current || [])];
  // If user provided input (innertext), insert it ABOVE Ms. Sonoma's reply as its own line,
  // adding a newline before and after so it stands on its own line.
  // These pre-reply items are NOT included in TTS scheduling.
  let preReplyExtra = 0;
  try {
    if (typeof innertext === 'string') {
      const it = innertext.trim();
      if (it) {
        nextAll.push('\n'); // ensure user text starts on a new line
        preReplyExtra += 1;
        nextAll.push({ text: it, role: 'user' }); // styled in CaptionPanel
        preReplyExtra += 1;
        nextAll.push('\n'); // ensure reply starts on a new line after user text
        preReplyExtra += 1;
      }
    }
  } catch { /* non-fatal */ }
      // Network + processing complete; stop showing loading placeholder BEFORE or while starting audio
      setLoading(false);
      
  nextAll = [...nextAll, ...assistantSentences];
  captionSentencesRef.current = nextAll;
  setCaptionSentences(nextAll);
  // Set selection to the first reply sentence (skip the inserted items before reply)
  setCaptionIndex(prevLen + preReplyExtra);

### 30. src/app/session/page.js (d4c78ce46e98d574727e4d8fdeac3e472cf0c55ca7eeec8f3145e2606d62ed8d)
- bm25: -5.3130 | entity_overlap_w: 1.30 | adjusted: -5.6380 | relevance: 1.0000

// Poem: topic input ? generate poem, then await Ok
    if (poemState === 'awaiting-topic') {
      setCanSend(false);
      setShowPoemSuggestions(false);
      // Echo the user's topic to captions as user line
      try {
        const prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), { text: trimmed, role: 'user' }];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
      } catch {}
      // Ask backend to write a 16-line rhyming poem about the specific user topic; then read via unified TTS/captions
      const topic = (trimmed || '').replace(/["��]/g, "'");
      const instruction = [
        'You are Ms. Sonoma.',
        `Write a rhyming poem with exactly 16 lines about the topic: "${topic}".`,
        'Use simple, warm language for kids, one short idea per line.',
        'Keep the poem clearly about that topic throughout.',
        'Do not add a title or extra commentary.'
      ].join(' ');
      const result = await callMsSonoma(instruction, '', { phase: 'discussion', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, step: 'poem' }).catch(() => null);
      // callMsSonoma handles audio playback internally, so no need to call speakFrontend
      setPoemState('awaiting-ok');
      setCanSend(false);
      setShowOpeningActions(true);
      return;
    }

### 31. src/app/facilitator/generator/counselor/CounselorClient.jsx (81e9ad76449bbdfb2603315d42fe5021e0cdab4861cd298963b24e2c04a2615d)
- bm25: -5.4324 | relevance: 1.0000

const cohereChronographEnabled = useCohereChronograph && chronographReady
  
  // Conversation state
  const [conversationHistory, setConversationHistory] = useState([])
  const [userInput, setUserInput] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pendingConfirmationTool, setPendingConfirmationTool] = useState(null)
  
  // MentorInterceptor instance
  const interceptorRef = useRef(null)
  if (!interceptorRef.current) {
    interceptorRef.current = new MentorInterceptor()
  }
  
  // Draft summary state
  const [draftSummary, setDraftSummary] = useState('')
  const [showClipboard, setShowClipboard] = useState(false)
  const [clipboardInstructions, setClipboardInstructions] = useState(false)
  const [clipboardForced, setClipboardForced] = useState(false)
  const [turnWarningShown, setTurnWarningShown] = useState(false)
  const lastLocalUpdateTimestamp = useRef(Date.now())
  const realtimeChannelRef = useRef(null)
  
  // Goals clipboard state
  const [showGoalsClipboard, setShowGoalsClipboard] = useState(false)
  
  // Caption state (similar to session page)
  const [captionText, setCaptionText] = useState('')
  const [captionSentences, setCaptionSentences] = useState([])
  const [captionIndex, setCaptionIndex] = useState(0)
  
  // Screen overlay state
  const [activeScreen, setActiveScreen] = useState('mentor') // 'mentor' | 'calendar' | 'lessons' | 'maker'
  
  // Audio/Video refs
  const videoRef = useRef(null)
  const buttonVideoRef = useRef(null)
  const audioRef = useRef(null)
  const captionBoxRef = useRef(null)
  const lastAudioRef = useRef(null)
  
  // Mute state - persisted in localStorage
  const [muted, setMuted] = useState(() => {

### 32. src/app/session/page.js (d33285c0d1ff9bf6cb3e3d620c60c0de63dd6218dd13e9350bee0a7789a4c5f7)
- bm25: -4.7498 | entity_overlap_w: 1.30 | adjusted: -5.0748 | relevance: 1.0000

useEffect(() => {
    try {
      // Do not retrigger if we're already in test-review or in congrats
      if (phase === 'congrats') return;
      if (phase === 'test' && typeof subPhase === 'string' && subPhase.startsWith('review')) return;
      if (reviewDeferRef.current) return; // Hold while we intentionally speak final feedback
      if (isSpeaking) return; // Wait until TTS feedback is finished
      if (phase !== 'test') return; // Treat test as the authoritative phase
      const list = Array.isArray(generatedTest) ? generatedTest : [];
      const limit = Math.min((typeof TEST_TARGET === 'number' && TEST_TARGET > 0) ? TEST_TARGET : list.length, list.length);
      const answeredCount = Array.isArray(testUserAnswers) ? testUserAnswers.filter(v => typeof v === 'string' && v.length > 0).length : 0;
      const judgedCount = Array.isArray(testCorrectByIndex) ? testCorrectByIndex.filter(v => typeof v !== 'undefined').length : 0;
      const idxDone = (typeof testActiveIndex === 'number' ? testActiveIndex : 0) >= limit;
      const finished = limit > 0 && (answeredCount >= limit || judgedCount >= limit || idxDone);
      if (finished) {
        enterTestReview({ disableSending: true });
      }
    } catch {}
  }, [phase, subPhase, generatedTest, testUserAnswers, testCorrectByIndex, testActiveIndex, isSpeaking, enterTestReview]);

### 33. src/app/session/page.js (16341cbce15ef1ea0ae1e7a1ecc05557917a4f637b16a1ad0b1368065b4fd39b)
- bm25: -4.7920 | relevance: 1.0000

// Create inline wrappers for audio utility functions using hook-provided refs
  const ensureAudioContextWrapped = useCallback(() => {
    return ensureAudioContext({ audioCtxRef, webAudioGainRef, mutedRef });
  }, [audioCtxRef, webAudioGainRef, mutedRef]);
  
  const playViaWebAudioWrapped = useCallback(async (b64, sentences, startIndex) => {
    return playViaWebAudio(
      b64,
      sentences,
      startIndex,
      { audioCtxRef, webAudioGainRef, webAudioSourceRef, webAudioBufferRef, webAudioStartedAtRef, webAudioPausedAtRef, mutedRef },
      scheduleCaptionsForDurationUtil,
      setIsSpeaking,
      armSpeechGuard,
      clearSpeechGuard,
      videoRef,
      videoPlayingRef,
      { captionBatchStartRef, captionBatchEndRef },
      forceNextPlaybackRef,
      phase,
      subPhase,
      askState,
      riddleState,
      poemState,
      setShowOpeningActions
    );
  }, [audioCtxRef, webAudioGainRef, webAudioSourceRef, webAudioBufferRef, webAudioStartedAtRef, webAudioPausedAtRef, mutedRef, phase, subPhase, askState, riddleState, poemState, armSpeechGuard, clearSpeechGuard]);
  
  const stopWebAudioSourceWrapped = useCallback(() => {
    return stopWebAudioSource(webAudioSourceRef);
  }, [webAudioSourceRef]);
  
  const unlockAudioPlaybackWrapped = useCallback(async () => {
    return unlockAudioPlayback({ audioCtxRef, webAudioGainRef, mutedRef }, audioUnlockedRef, setAudioUnlocked);
  }, [audioCtxRef, webAudioGainRef, mutedRef]);

### 34. src/app/session/page.js (7fa8eb8f66431b47fd4758b85a63ce5dee92fb4c4b60328e1ea1ed49bd260a01)
- bm25: -4.2143 | entity_overlap_w: 1.30 | adjusted: -4.5393 | relevance: 1.0000

// Direct trigger: when target is met during test (by answers or judged), enter Review after TTS completes
  useEffect(() => {
    try {
      if (phase !== 'test') return;
      if (reviewDeferRef.current) return; // Hold while final feedback is speaking
      if (isSpeaking) return; // Do not transition mid-speech
      if (typeof subPhase === 'string' && subPhase.startsWith('review')) return; // Already in review subphase
      const list = Array.isArray(generatedTest) ? generatedTest : [];
      const limit = Math.min((typeof TEST_TARGET === 'number' && TEST_TARGET > 0) ? TEST_TARGET : list.length, list.length);
      if (limit <= 0) return;
      const answeredCount = Array.isArray(testUserAnswers) ? testUserAnswers.filter(v => typeof v === 'string' && v.length > 0).length : 0;
      const judgedCount = Array.isArray(testCorrectByIndex) ? testCorrectByIndex.filter(v => typeof v !== 'undefined').length : 0;
      const idxDone = (typeof testActiveIndex === 'number' ? testActiveIndex : 0) >= limit;
      if (answeredCount >= limit || judgedCount >= limit || idxDone || (typeof ticker === 'number' && ticker >= limit)) {
        enterTestReview({ disableSending: true });
      }
    } catch {}
  }, [phase, generatedTest, testUserAnswers, testCorrectByIndex, testActiveIndex, ticker, isSpeaking, subPhase, enterTestReview]);
  const finalizeTestAndFarewell = async ({ correctCount, total, percent } = {}) => {
    if (!generatedTest || !generatedTest.length) return;
    const fallbackTotal = generatedTest.length;
    const safeTotal = total || fallbackTotal;
    const safeCorrect = (typeof correctCount === 'number') ? correctCount : testCorrectCount;
    const safePercent = (typeof percent === 'number') ? percent : Math.round((safeCorrect / Math.max(1, safeTotal)) * 100);

### 35. src/app/session/page.js (99c26b3cd8ebe716f779b277f904b0f633948a578b357f981ee03f2839d3d049)
- bm25: -4.2137 | entity_overlap_w: 1.30 | adjusted: -4.5387 | relevance: 1.0000

// Also reveal Opening actions when the captions finish (even if audio is still playing)
  useEffect(() => {
    if (
      captionsDone &&
      phase === 'discussion' &&
      subPhase === 'awaiting-learner' &&
      askState === 'inactive' &&
      riddleState === 'inactive' &&
      poemState === 'inactive' &&
      storyState === 'inactive' &&
      fillInFunState === 'inactive'
    ) {
      setShowOpeningActions(true);
    }
  }, [captionsDone, phase, subPhase, askState, riddleState, poemState, storyState, fillInFunState]);

// If Ask, Riddle, Poem, Story, or Fill-in-Fun becomes active, immediately hide Opening actions
  useEffect(() => {
    if (askState !== 'inactive' || riddleState !== 'inactive' || poemState !== 'inactive' || storyState !== 'inactive' || fillInFunState !== 'inactive') {
      try { setShowOpeningActions(false); } catch {}
    }
  }, [askState, riddleState, poemState, storyState, fillInFunState]);

// Clear TTS cache on phase transitions to prevent stale audio from previous phases
  useEffect(() => {
    try { ttsCache.clear(); } catch {}
  }, [phase]);

### 36. src/app/session/page.js (2d82e2a5c1efa4e3fe3319e01e1cfbff9ca2d04ce4008a06e005e90552cad013)
- bm25: -4.0058 | entity_overlap_w: 1.30 | adjusted: -4.3308 | relevance: 1.0000

// If user hits Enter or Send while recording, stop first
  const handleSend = useCallback(() => {
    if (isRecording) stopRecording();
    onSend();
  }, [isRecording, stopRecording, onSend]);
  // Auto-focus when the field becomes actionable (enabled and allowed to send)
  // Add a tiny retry window to avoid races right after TTS ends or layout settles
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (sendDisabled || !canSend) return;
    let rafId = null;
    let t0 = null;
    let t1 = null;
    const doFocus = () => {
      try {
        el.focus({ preventScroll: true });
        const len = el.value.length;
        el.setSelectionRange(len, len);
      } catch {/* ignore focus errors */}
    };
    // Initial microtask/next-tick
    t0 = setTimeout(() => {
      if (document.activeElement !== el) doFocus();
    }, 0);
    // After a frame, try again if something stole focus
    rafId = requestAnimationFrame(() => {
      if (document.activeElement !== el) doFocus();
    });
    // One last short retry
    t1 = setTimeout(() => {
      if (document.activeElement !== el) doFocus();
    }, 120);
    return () => {
      if (t0) clearTimeout(t0);
      if (t1) clearTimeout(t1);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [sendDisabled, canSend]);
  const computePlaceholder = () => {
    if (tipOverride) return tipOverride;
    if (showBegin) return 'Press "Begin"';
    if (phase === 'congrats') return 'Press "Complete Lesson"';
    if (loading) return 'loading...';
    if (isSpeaking) return 'Ms. Sonoma is talking...';
    // During Fill-in-Fun word collection
    if (fillInFunState === 'collecting-words') return 'Type your word and press Send';
    // During Ask sequence: prompt for question input
    if (askState === 'a

### 37. src/app/session/page.js (7a98822e7630410bfa6bd1db4fcdd903cac2ab647fdeb6728e354c5c223f0e41)
- bm25: -3.6676 | entity_overlap_w: 1.30 | adjusted: -3.9926 | relevance: 1.0000

{/* Congrats footer row with Complete Lesson and medal (only after congrats TTS finishes) */}
          {(() => {
            if (phase !== 'congrats') return null;
            if (!congratsDone) return null;
            const percent = typeof testFinalPercent === 'number' ? testFinalPercent : null;
            const tier = (percent != null) ? tierForPercent(percent) : null;
            const medal = tier ? emojiForTier(tier) : '';
            const btnStyle = { 
              background: completingLesson ? '#999' : '#c7442e', 
              color:'#fff', 
              borderRadius:10, 
              padding:'12px 20px', 
              fontWeight:800, 
              fontSize:'clamp(1.05rem, 2.4vw, 1.25rem)', 
              border:'none', 
              boxShadow: completingLesson ? 'none' : '0 4px 16px rgba(199,68,46,0.35)', 
              cursor: completingLesson ? 'not-allowed' : 'pointer',
              opacity: completingLesson ? 0.6 : 1
            };
            return (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, padding:'10px 12px 8px' }}>
                <button type="button" style={btnStyle} disabled={completingLesson} onClick={() => {
                  try { onCompleteLesson && onCompleteLesson(); } catch {}
                }}>{completingLesson ? 'Completing...' : 'Complete Lesson'}</button>
                <div aria-label="Medal" style={{ fontSize:'clamp(1.3rem, 2.6vw, 1.65rem)' }}>{medal}</div>
              </div>
            );
          })()}

### 38. src/app/session/page.js (11b809efc3ba83c587f7f14b8e4579ec8c1069c0bd5f7538411a0c8e29c7d6db)
- bm25: -3.8454 | relevance: 1.0000

function VideoPanel({ isMobileLandscape, isShortHeight, videoMaxHeight, videoRef, showBegin, isSpeaking, onBegin, onBeginComprehension, onBeginWorksheet, onBeginTest, onBeginSkippedExercise, phase, subPhase, ticker, currentWorksheetIndex, testCorrectCount, testFinalPercent, lessonParam, lessonKey, muted, onToggleMute, onSkip, loading, overlayLoading, exerciseSkippedAwaitBegin, skipPendingLessonLoad, currentCompProblem, onCompleteLesson, testActiveIndex, testList, sessionTimerMinutes, timerPaused, calculateLessonProgress, handleTimeUp, handleTimerPauseToggle, handleTimerClick, phaseTimers, currentTimerMode, getCurrentPhaseName, getCurrentPhaseTimerDuration, goldenKeyBonus, showPlayTimeExpired, playExpiredPhase, handlePlayExpiredComplete, handlePhaseTimerTimeUp, showRepeatButton, handleRepeatSpeech, visualAids, onShowVisualAids, showGames, setShowGames, timerRefreshKey, showTakeoverDialog, conflictingSession, handleSessionTakeover, handleCancelTakeover, askState, setAskState, setAskOriginalQuestion, setShowOpeningActions, setCanSend }) {
  // Reduce horizontal max width in mobile landscape to shrink vertical footprint (height scales with width via aspect ratio)
  // Remove horizontal clamp: let the video occupy the full available width of its column
  const containerMaxWidth = 'none';
  const dynamicHeightStyle = (isMobileLandscape && videoMaxHeight) ? { maxHeight: videoMaxHeight, height: videoMaxHeight, minHeight: 0 } : {};
  // Responsive control sizing: derive a target size from container width via CSS clamp.
  // We'll expose a CSS variable --ctrlSize and reuse for skip + play/pause/mute for symmetry.
  const controlClusterStyle = {
    position: 'absolute',
    bottom: 16,
    right: 16,
    display: 'flex',
    gap: 12,
    zIndex: 10,
    // size calculation moved

### 39. src/app/session/page.js (d15c891f42b4529573645b977449f51ddace3b12c5d60af1a1e79a01ef843cc2)
- bm25: -3.4606 | entity_overlap_w: 1.30 | adjusted: -3.7856 | relevance: 1.0000

// Disable sending when the UI is not ready or while Ms. Sonoma is speaking
  const comprehensionAwaitingBegin = (phase === 'comprehension' && subPhase === 'comprehension-start');
  // Allow answering Test items while TTS is still playing so buttons appear immediately
  const speakingLock = (phase === 'test' && subPhase === 'test-active') ? false : !!isSpeaking;
  // Derived gating: when Opening/Go buttons are visible, keep input inactive without mutating canSend
  const discussionButtonsVisible = (
    phase === 'discussion' &&
    subPhase === 'awaiting-learner' &&
    (!isSpeaking || captionsDone) &&
    showOpeningActions &&
    askState === 'inactive' &&
    riddleState === 'inactive' &&
    poemState === 'inactive' &&
    fillInFunState === 'inactive'
  );
  const inQnAForButtons = (
    (phase === 'comprehension' && subPhase === 'comprehension-active') ||
    (phase === 'exercise' && (subPhase === 'exercise-start' || subPhase === 'exercise-active')) ||
    (phase === 'worksheet' && subPhase === 'worksheet-active') ||
    (phase === 'test' && subPhase === 'test-active')
  );
  const qnaButtonsVisible = (
    inQnAForButtons && !isSpeaking && showOpeningActions &&
    askState === 'inactive' && riddleState === 'inactive' && poemState === 'inactive' && storyState === 'inactive' && fillInFunState === 'inactive'
  );
  const buttonsGating = discussionButtonsVisible || qnaButtonsVisible;
  // Story and Fill-in-Fun input should also respect the speaking lock
  const storyInputActive = (storyState === 'awaiting-turn' || storyState === 'awaiting-setup');
  const fillInFunInputActive = (fillInFunState === 'collecting-words');
  const sendDisabled = (storyInputActive || fillInFunInputActive) ? (!canSend || loading || speakingLock) : (!canSend || loading || comprehensionAwai

### 40. src/app/session/page.js (ed4716fef4536f0d4576c463b479be76fdd1c69df5e19e6bc044e080dd74f070)
- bm25: -3.4606 | entity_overlap_w: 1.30 | adjusted: -3.7856 | relevance: 1.0000

// Global hotkeys for mute toggle, skip, and repeat
  useEffect(() => {
    const onKeyDown = (e) => {
      // Disable hotkeys when games overlay is active
      if (showGames) return;
      
      const code = e.code || e.key;
      const target = e.target;
      const targetIsInput = isTextEntryTarget(target);
      if (!hotkeys) return;

const { muteToggle, skip, repeat } = { ...DEFAULT_HOTKEYS, ...hotkeys };

if (muteToggle && code === muteToggle) {
        e.preventDefault();
        toggleMute?.();
        return;
      }

const nextSentence = hotkeys?.nextSentence || DEFAULT_HOTKEYS.nextSentence;
      const isNextSentenceKey = nextSentence && code === nextSentence;

// Prioritize Next Sentence behavior during the teaching gate (handles custom overlaps)
      if (
        isNextSentenceKey &&
        phase === 'teaching' &&
        subPhase === 'awaiting-gate' &&
        typeof handleGateNo === 'function'
      ) {
        // Only fire after TTS finishes (and loading completes) or has been skipped
        if (isSpeaking || teachingGateLocked) return;
        e.preventDefault();
        handleGateNo();
        return;
      }

if (skip && code === skip) {
        // Always stop default PageDown behavior so inputs don't hijack the key
        e.preventDefault();
        // Skip speech when speaking
        if (isSpeaking && typeof handleSkipSpeech === 'function') {
          handleSkipSpeech();
        }
        return;
      }

// Next Sentence hotkey (non-teaching contexts fall back to default behavior blocker only)
      if (isNextSentenceKey) {
        e.preventDefault();
        return;
      }
