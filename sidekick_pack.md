# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Regression: video starts playing immediately before any TTS. Find where session video element is configured (autoPlay/muted/loop) and what code starts/stops it.
```

Filter terms used:
```text
/muted/loop
TTS
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/muted/loop TTS

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack.md (8b3fee75590a5196e380fcbe676a65a4f863f53dcbf173efd79d23a391c3d32c)
- bm25: -10.9881 | entity_overlap_w: 3.90 | adjusted: -11.9631 | relevance: 1.0000

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

### 2. sidekick_pack.md (8c271ad26d18bbdc67502c8458c58f8bb04cdbc2e2af9295f63cb8a4545a1604)
- bm25: -7.8218 | entity_overlap_w: 1.30 | adjusted: -8.1468 | relevance: 1.0000

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

### 3. src/app/session/page.js (59f0630a0b46dced619eee0c9612af55bfa0697b3d15f90deb1293c3b7149a64)
- bm25: -7.7633 | entity_overlap_w: 1.30 | adjusted: -8.0883 | relevance: 1.0000

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

### 4. sidekick_pack.md (7c5c6b399b3216526ba6b73172632206e4ee0cc3bf3238b862cdb209c2c95504)
- bm25: -7.9665 | relevance: 1.0000

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

### 5. src/app/session/page.js (d6d20109e37b6d839636505f837977fbf6ab49a0eecf697e8c8a03b3e7846dc8)
- bm25: -7.9194 | relevance: 1.0000

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

### 6. sidekick_pack.md (adc85cd11b23adb325f235657d173326d652167cc37cbc2b408feb9dfb2c43b8)
- bm25: -7.1236 | entity_overlap_w: 2.60 | adjusted: -7.7736 | relevance: 1.0000

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

### 7. src/app/session/page.js (69753b375f4d2cb4fc49cc16d8e27b4821c2bc10af77bfe4da4993eada08aab9)
- bm25: -7.0892 | entity_overlap_w: 2.60 | adjusted: -7.7392 | relevance: 1.0000

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

### 8. src/app/session/page.js (59b6452c9ba763a9edf5b6933eefe2e8bc9c522b8fc23246da082e3e83a28807)
- bm25: -7.6672 | relevance: 1.0000

// React to mute toggle on current audio and keep a ref for async use
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

// Stable refs for state/functions used by audio playback
  const captionIndexRef = useRef(captionIndex);
  useEffect(() => { captionIndexRef.current = captionIndex; }, [captionIndex]);
  // These refs will be populated after useAudioPlayback hook provides the functions
  const scheduleCaptionsForAudioRef = useRef(null);
  const scheduleCaptionsForDurationRef = useRef(null);
  const computeHeuristicDurationRef = useRef(null);
  const armSpeechGuardRef = useRef(armSpeechGuard); // armSpeechGuard exists early
  const playAudioFromBase64Ref = useRef(null);
  const startThreeStageTeachingRef = useRef(null); // will be populated after function is defined

### 9. src/app/session/page.js (6729c16c5c8195b5d18ada600c1770926ded6fed3685266df918f279d1486c2b)
- bm25: -7.3402 | relevance: 1.0000

{/* Play time expired overlay - outside container to avoid z-index conflicts */}
    {showPlayTimeExpired && playExpiredPhase && (
      <PlayTimeExpiredOverlay
        isOpen={showPlayTimeExpired}
        phase={playExpiredPhase}
        muted={muted}
        onComplete={handlePlayExpiredComplete}
        onStartNow={handlePlayExpiredStartNow}
      />
    )}

### 10. sidekick_pack.md (b71c44ec08f71346b2067dca394f747cc857fe8cb6baaf816ea312e341943c4c)
- bm25: -7.0581 | relevance: 1.0000

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

### 11. sidekick_pack.md (497814e5404cf7beac4298c43cf20066f39b8470de2e77c49f3ccb80f6922534)
- bm25: -5.9604 | entity_overlap_w: 3.90 | adjusted: -6.9354 | relevance: 1.0000

// isSpeaking/phase/subPhase defined earlier; do not redeclare here
  const [transcript, setTranscript] = useState("");
  // Start with loading=true so the existing overlay spinner shows during initial restore
  const [loading, setLoading] = useState(true);
  // TTS overlay: track TTS fetch activity separately; overlay shows when either API or TTS is loading
  const [ttsLoadingCount, setTtsLoadingCount] = useState(0);
  const overlayLoading = loading || (ttsLoadingCount > 0);

### 12. src/app/session/page.js (24d0ad1fca5c4d9e137faf448d67edbdd18d815a89dd1d4902030a56f456fcba)
- bm25: -5.9350 | entity_overlap_w: 3.90 | adjusted: -6.9100 | relevance: 1.0000

// isSpeaking/phase/subPhase defined earlier; do not redeclare here
  const [transcript, setTranscript] = useState("");
  // Start with loading=true so the existing overlay spinner shows during initial restore
  const [loading, setLoading] = useState(true);
  // TTS overlay: track TTS fetch activity separately; overlay shows when either API or TTS is loading
  const [ttsLoadingCount, setTtsLoadingCount] = useState(0);
  const overlayLoading = loading || (ttsLoadingCount > 0);

### 13. src/app/facilitator/generator/counselor/CounselorClient.jsx (de21c11e882e7f1248c295cc627f3d36724db7c0cfab4b802af2b65e83bf0946)
- bm25: -6.6976 | relevance: 1.0000

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

### 14. sidekick_pack.md (d870cafc36a3193a72560e682f5b9ce54450dc5896b09ac669891e88ab45b021)
- bm25: -5.2102 | entity_overlap_w: 5.20 | adjusted: -6.5102 | relevance: 1.0000

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

### 15. src/app/session/page.js (df9788fcf3d8a451ee6730b44593b0670d7e3844110c56f24d473caa04751eb2)
- bm25: -5.1956 | entity_overlap_w: 5.20 | adjusted: -6.4956 | relevance: 1.0000

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

### 16. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (dfbb3558e72ced0320373c589408b2d68ec2e7d797dfd38e31be1a4f949f277b)
- bm25: -6.3738 | relevance: 1.0000

// Build a context string so Redo doesn't loop the same topics.
      let contextText = ''

const LOW_SCORE_REVIEW_THRESHOLD = 70
      const HIGH_SCORE_AVOID_REPEAT_THRESHOLD = 85

const lowScoreNames = new Set()
      const highScoreNames = new Set()

const [historyRes, medalsRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, {
          headers: { 'authorization': `Bearer ${token}` }
        }),
        fetch(`/api/medals?learnerId=${learnerId}`, {
          headers: { 'authorization': `Bearer ${token}` }
        })
      ])

let medals = {}
      if (medalsRes.ok) {
        medals = (await medalsRes.json().catch(() => ({}))) || {}
      }

### 17. src/app/facilitator/generator/counselor/CounselorClient.jsx (597432c0f9fd42256ca20f07370a3b7ea754dea3e1ea4e3ffd691887afccb3ee)
- bm25: -6.1256 | relevance: 1.0000

{/* Mute button overlay - matches Ms. Sonoma's style */}
              <button
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                title={muted ? 'Unmute' : 'Mute'}
                style={{
                  position: 'absolute',
                  bottom: 16,
                  right: 16,
                  background: '#1f2937',
                  color: '#fff',
                  border: 'none',
                  width: 'clamp(48px, 10vw, 64px)',
                  height: 'clamp(48px, 10vw, 64px)',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                  zIndex: 10
                }}
              >
                {muted ? (
                  <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M23 9l-6 6" />
                    <path d="M17 9l6 6" />
                  </svg>
                ) : (
                  <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M19 8a5 5 0 010 8" />
                    <path d="M15 11a2 2 0 010 2" />
                  </svg>
                )}
              </button>
            </>
          )}

### 18. sidekick_pack.md (c30249345654aa700125f977d5698f541b589aec7d5a24a69cf7ce11b2eee727)
- bm25: -5.4472 | entity_overlap_w: 2.60 | adjusted: -6.0972 | relevance: 1.0000

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

### 19. sidekick_pack.md (a5061f8b940336dd5c2a0be942b55c716d7982e4d666b387ae575c69bc97c3c8)
- bm25: -5.7438 | entity_overlap_w: 1.30 | adjusted: -6.0688 | relevance: 1.0000

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

### 20. scripts/backfill-thought-hub-from-mentor-conversation-threads.sql (ba6a9f7d8cb6a57e0fe76b16a00901274c1f3716fadec03d2b5f6b8fe15d1e64)
- bm25: -6.0467 | relevance: 1.0000

-- ThoughtHub one-time backfill
--
-- Migrates legacy Mr. Mentor history stored in public.mentor_conversation_threads.conversation_history
-- into ThoughtHub (public.events) as append-only events, then clears the legacy JSON once ingestion
-- is verified.
--
-- Prereqs (run first):
-- - scripts/add-cohere-style-chronograph.sql
-- - scripts/add-cohere-style-rls-and-rpcs.sql
-- - scripts/add-thought-hub-dedupe-key.sql (or equivalent dedupe_key + unique index)
--
-- Notes:
-- - Creates a tenant + owner membership for any facilitator lacking one.
-- - Creates ThoughtHub threads at sector='both' for each (facilitator_id, subject_key).
-- - Inserts events with a stable per-message timestamp order.
-- - Uses dedupe_key = legacy:<subject_key>:<index> so reruns are safe.

begin;

-- 1) Ensure every facilitator in mentor_conversation_threads has a ThoughtHub tenant + membership.
do $$
declare
  u record;
  tid uuid;
begin
  for u in (
    select distinct facilitator_id as user_id
    from public.mentor_conversation_threads
    where facilitator_id is not null
  ) loop
    select m.tenant_id into tid
    from public.tenant_memberships m
    where m.user_id = u.user_id
    order by m.created_at asc
    limit 1;

if tid is null then
      insert into public.tenants (name)
      values ('Household')
      returning tenant_id into tid;

insert into public.tenant_memberships (tenant_id, user_id, role)
      values (tid, u.user_id, 'owner');
    end if;
  end loop;
end $$;

### 21. src/app/session/page.js (3759a02343969a963fa17d4c9d201ecbd4f5b3369e9fb240662e078ee35f70c7)
- bm25: -5.7122 | entity_overlap_w: 1.30 | adjusted: -6.0372 | relevance: 1.0000

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

### 22. src/app/api/counselor/route.js (c6e5dea03f1201bb587f695d4f32d8a7dc08671babcbe1d3cdfae68114474706)
- bm25: -5.2844 | entity_overlap_w: 2.60 | adjusted: -5.9344 | relevance: 1.0000

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

### 23. sidekick_pack.md (226e2fb4b1d7ec6058bee835c174eb594c1b51fa0eb3fb110fcecd9de4c4f454)
- bm25: -5.0245 | entity_overlap_w: 2.60 | adjusted: -5.6745 | relevance: 1.0000

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

### 24. sidekick_pack_takeover.md (376cf1a07dfa6f6120fc79857838fadc2dc9ac44fac46c335e3387cc01d643db)
- bm25: -5.0154 | entity_overlap_w: 2.60 | adjusted: -5.6654 | relevance: 1.0000

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

### 25. sidekick_pack.md (569d37063c9c4e1de9df07ab6fb5ae273a0300ddd2fad5788cad4ba6fcb86a59)
- bm25: -4.9795 | entity_overlap_w: 2.60 | adjusted: -5.6295 | relevance: 1.0000

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

### 26. sidekick_pack_takeover.md (8ec8e3fd187ee65a646a3c733c9c3016591af8a1092f6b005071ea3c557dbf12)
- bm25: -5.6160 | relevance: 1.0000

const sessionsWithEvents = sessions.map((session) => ({
      ...session,
      events: eventsBySession.get(session.id) || [],
    }))

const summary = buildSummary(sessionsWithEvents, events)

return NextResponse.json({
      learnerId,
      sessions: sessionsWithEvents,
      events,
      summary
    })
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 })
  }
}

### 17. src/app/facilitator/generator/counselor/CounselorClient.jsx (7e2394688c0d22ab1829158645bcb07ad43816da501e12bd9f1612d42563f365)
- bm25: -6.0364 | relevance: 1.0000

setConversationHistory([])
    setCaptionText('')
    setCaptionSentences([])
    setCaptionIndex(0)
    setUserInput('')
    setError('')
    setSessionStarted(false)
    setCurrentSessionTokens(0)
    setDraftSummary('')
    setConflictingSession(null)
    setShowTakeoverDialog(false)

// Don't generate new session ID yet - wait until user actually starts typing
    clearPersistedSessionIdentifier()
    initializedSessionIdRef.current = null
  }

// Toggle mute
  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      if (audioRef.current) {
        audioRef.current.muted = next
        audioRef.current.volume = next ? 0 : 1
      }
      // Persist to localStorage
      try {
        localStorage.setItem('mr_mentor_muted', String(next))
      } catch {}
      return next
    })
  }, [])

### 27. src/app/facilitator/generator/counselor/CounselorClient.jsx (308d5449116cb51de7d8566acac623f39d47bdbdd34a35804bfe1d289da9aafd)
- bm25: -4.9441 | entity_overlap_w: 2.60 | adjusted: -5.5941 | relevance: 1.0000

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

### 28. sidekick_pack.md (26de259aec4e52bcfd85481b488d0906c04cfcc8d7254bdccecbfd8c14052f58)
- bm25: -5.5751 | relevance: 1.0000

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

### 29. sidekick_pack.md (d15f6b6e7a708fc65737e3cdb8f5feeff488f5ed973b5ca8974e4bcc9ee0f75b)
- bm25: -4.9006 | entity_overlap_w: 2.60 | adjusted: -5.5506 | relevance: 1.0000

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

### 30. src/app/session/page.js (31d0fe7aac77163820e24cc78058f4c0ced354b2e2f524e4763c66f78c86a7dd)
- bm25: -5.5481 | relevance: 1.0000

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

### 31. src/app/api/counselor/route.js (ae56bfb45792f94ba0e24339febbe103db9c5d2b873b9f69dcc8f6616b636b5c)
- bm25: -4.8749 | entity_overlap_w: 2.60 | adjusted: -5.5249 | relevance: 1.0000

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

### 32. sidekick_pack.md (a056807a97872f093f25af93e917a8d25b3da16aac40caf74c04c9f499df21cd)
- bm25: -5.0199 | entity_overlap_w: 1.30 | adjusted: -5.3449 | relevance: 1.0000

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

### 33. src/app/session/page.js (5081bab5884e02689acef54dcbfce6800c4856f78c451b0a67136e3e40d1fded)
- bm25: -5.0064 | entity_overlap_w: 1.30 | adjusted: -5.3314 | relevance: 1.0000

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

### 34. src/app/session/v2/AudioEngine.jsx (2b96796d357f824d0a416914bae7489014ff777978fa0efbf7e4778f99d99c00)
- bm25: -4.9286 | relevance: 1.0000

// Resume AudioContext, but never let this hang indefinitely on mobile browsers.
      if (this.#audioContext && this.#audioContext.state === 'suspended') {
        try {
          await withTimeout(this.#audioContext.resume(), 1000, 'AudioContext.resume');
        } catch {
          // Ignore - some browsers will reject/resume later; initialization should not deadlock.
        }
      }

// Play silent audio to unlock HTMLAudio on iOS.
      // IMPORTANT: do not await play(); on iOS/Safari it can remain pending and deadlock UI.
      try {
        const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
        silentAudio.muted = true;
        silentAudio.volume = 0;
        const p = silentAudio.play();
        if (p && typeof p.catch === 'function') p.catch(() => {});
      } catch {
        // Ignore errors from silent audio
      }

// Video unlock (must happen inside user gesture; pause can happen later).
      // IMPORTANT: Do NOT play-and-immediately-pause in the same tick; on some browsers
      // (notably iOS Safari) that can prevent the play() call from "unlocking" future playback.
      this.#requestVideoUnlock();

this.#initialized = true;
    })().finally(() => {
      this.#initializePromise = null;
    });

return this.#initializePromise;
  }

#requestVideoUnlock() {
    if (this.#videoUnlockRequested) return;
    this.#videoUnlockRequested = true;

const video = this.#videoElement;
    if (!video) return;

try { video.muted = true; } catch {}
    try { video.playsInline = true; } catch {}
    try { video.preload = 'auto'; } catch {}

### 35. src/app/facilitator/generator/counselor/CounselorClient.jsx (7c682929b00f94d4c3b6d17b9d23d9cabf909ff6a4c95eca3c4215b7a4010aa5)
- bm25: -4.9286 | relevance: 1.0000

setConversationHistory([])
    setCaptionText('')
    setCaptionSentences([])
    setCaptionIndex(0)
    setUserInput('')
    setError('')
    setSessionStarted(false)
    setCurrentSessionTokens(0)
    setDraftSummary('')
    setConflictingSession(null)
    setShowTakeoverDialog(false)

// Don't generate new session ID yet - wait until user actually starts typing
    clearPersistedSessionIdentifier()
    initializedSessionIdRef.current = null
  }

// Toggle mute
  const toggleMute = useCallback(() => {
    setMuted(prev => {
      const next = !prev
      if (audioRef.current) {
        audioRef.current.muted = next
        audioRef.current.volume = next ? 0 : 1
      }
      // Persist to localStorage
      try {
        localStorage.setItem('mr_mentor_muted', String(next))
      } catch {}
      return next
    })
  }, [])

// Simple markdown renderer for bold text
  const renderMarkdown = (text) => {
    if (!text) return null
    
    // Split by **bold** markers
    const parts = text.split(/(\*\*[^*]+\*\*)/)
    
    return parts.map((part, idx) => {
      // Check if this part is bold
      if (part.startsWith('**') && part.endsWith('**')) {
        const boldText = part.slice(2, -2)
        return <strong key={idx}>{boldText}</strong>
      }
      return <span key={idx}>{part}</span>
    })
  }

// Export conversation
  const exportConversation = useCallback(() => {
    if (conversationHistory.length === 0) {
      alert('No conversation to export.')
      return
    }

const timestamp = new Date().toISOString().split('T')[0]
    let content = `Mr. Mentor Conversation - ${timestamp}\n\n`
    
    conversationHistory.forEach((msg, idx) => {
      const label = msg.role === 'user' ? 'You' : 'Mr. Mentor'
      content += `${label}:\n${msg.content}\n\n`
    })

### 36. src/app/session/v2/AudioEngine.jsx (bed4b96439e1d30f0a5b1d216834205045a7703c4a54276fea998b7e9dd361ed)
- bm25: -4.1733 | entity_overlap_w: 2.60 | adjusted: -4.8233 | relevance: 1.0000

// Pause as soon as playback actually starts (playing event), so we end in a paused state
    // while still getting the autoplay "unlock" side effect from play().
    // IMPORTANT: If unlock playback never starts during the gesture, do not leave a stale
    // 'playing' handler around — it can pause the first real TTS video playback later.
    this.#videoUnlockPlayingHandler = () => {
      // Never pause the real TTS video playback.
      if (this.#isPlaying) {
        clearUnlockHandler();
        return;
      }
      try { video.pause(); } catch {}
      try { video.currentTime = 0; } catch {}
      clearUnlockHandler();
    };

try {
      video.addEventListener('playing', this.#videoUnlockPlayingHandler);
    } catch {}

// Cleanup even if 'playing' never fires (e.g., autoplay blocked).
    try {
      this.#videoUnlockCleanupTimer = setTimeout(() => {
        clearUnlockHandler();
      }, 1500);
    } catch {}

try {
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          clearUnlockHandler();
        });
      }
    } catch {
      clearUnlockHandler();
    }
  }
  
  // Public API: Playback control
  async playAudio(base64Audio, sentences = [], startIndex = 0, options = {}) {
    this.#lastAudioBase64 = base64Audio;
    this.#lastSentences = sentences;
    
    // Stop any existing playback
    this.stop();
    
    // Validate
    if (!Array.isArray(sentences) || sentences.length === 0) {
      console.warn('[AudioEngine] No sentences provided');
      return;
    }

### 37. sidekick_pack.md (1a00b08652d00013c4b6b0b76b39608099752e8ee5b549d4826db04bddb52a01)
- bm25: -4.1361 | entity_overlap_w: 2.60 | adjusted: -4.7861 | relevance: 1.0000

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

### 38. src/app/session/v2/SessionPageV2.jsx (83f260f98e1e2ff0f95333709788a05eae63a3645329eff6bfcbf89038e243dc)
- bm25: -4.1086 | entity_overlap_w: 2.60 | adjusted: -4.7586 | relevance: 1.0000

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

### 39. sidekick_pack.md (b8b40176ebfd717fcf0edfabba4fc2ff3bdb2044e1785068f179f4215db9c45d)
- bm25: -4.0815 | entity_overlap_w: 2.60 | adjusted: -4.7315 | relevance: 1.0000

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

### 40. src/app/session/v2/AudioEngine.jsx (b00f8222e6f278ea9df16d8ae24a4c45803094c441a9567d00c67743b3de523d)
- bm25: -3.8768 | entity_overlap_w: 2.60 | adjusted: -4.5268 | relevance: 1.0000

// If a video-unlock handler is still attached (e.g., autoplay was blocked during
    // initialize()), clear it so it cannot pause the first real TTS playback.
    try {
      if (this.#videoUnlockCleanupTimer) {
        clearTimeout(this.#videoUnlockCleanupTimer);
        this.#videoUnlockCleanupTimer = null;
      }
    } catch {}
    try {
      if (this.#videoUnlockPlayingHandler) {
        this.#videoElement.removeEventListener('playing', this.#videoUnlockPlayingHandler);
        this.#videoUnlockPlayingHandler = null;
      }
    } catch {}
    
    // Use robust retry mechanism from audioUtils (handles iOS edge cases)
    playVideoWithRetry(this.#videoElement, 3, 100).catch(() => {
      // Log silently if all retries fail to avoid breaking session
    });
  }
  
  // Private: Cleanup
  #cleanup() {
    this.#isPlaying = false;
    
    // Pause video when audio ends (video syncs with TTS)
    if (this.#videoElement) {
      try {
        this.#videoElement.pause();
      } catch {}
    }
    
    this.#clearCaptionTimers();
    this.#clearSpeechGuard();
  }
  
  // Private: Utilities
  #parseAudioInput(rawInput) {
    if (!rawInput) return null;

const raw = String(rawInput).trim();
    if (!raw) return null;

// Accept either a data URL or a raw base64 string.
    const match = raw.match(/^data:(audio\/[^;]+);base64,(.*)$/i);
    const contentType = match?.[1] || 'audio/mpeg';
    let b64 = (match?.[2] || raw).trim();

// Normalize: strip whitespace, base64url -> base64, add padding.
    b64 = b64.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad === 2) b64 += '==';
    else if (pad === 3) b64 += '=';
    else if (pad === 1) b64 += '===';

return { contentType, b64 };
  }
