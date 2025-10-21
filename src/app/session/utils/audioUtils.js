/**
 * audioUtils.js
 * 
 * Audio/TTS utilities for session page: base64 normalization, HTMLAudio/WebAudio playback,
 * silent WAV generation for unlock, AudioContext management, mic permission requests, and video playback coordination.
 * 
 * Pure functions and stateless helpers only - no React hooks or component state.
 */

/**
 * Play video with robust retry mechanism for mobile browsers.
 * Mobile browsers (especially iOS) can be finicky with video.play() due to autoplay policies,
 * loading states, and timing issues. This helper provides multiple retry attempts with backoff.
 * 
 * @param {HTMLVideoElement|null} video - Video element to play
 * @param {number} maxRetries - Maximum number of retry attempts (default 3)
 * @param {number} initialDelay - Initial retry delay in ms (default 100)
 * @returns {Promise<void>}
 */
export async function playVideoWithRetry(video, maxRetries = 3, initialDelay = 100) {
  if (!video) return;
  
  let attempt = 0;
  let delay = initialDelay;
  
  while (attempt < maxRetries) {
    try {
      // Ensure video is in a playable state
      if (video.readyState < 2) {
        // HAVE_CURRENT_DATA = 2; wait for enough data
        await new Promise((resolve) => {
          const onReady = () => {
            video.removeEventListener('loadeddata', onReady);
            video.removeEventListener('canplay', onReady);
            resolve();
          };
          video.addEventListener('loadeddata', onReady, { once: true });
          video.addEventListener('canplay', onReady, { once: true });
          // Timeout fallback
          setTimeout(resolve, 500);
        });
      }
      
      // For Chrome iOS: ensure video isn't stuck in a paused/ended state
      if (video.ended) {
        try { video.currentTime = 0; } catch {}
      }
      
      const playPromise = video.play();
      if (playPromise && playPromise.then) {
        await playPromise;
      }
      // Success - video is playing
      console.info('[Session] Video playback started successfully on attempt', attempt + 1);
      return;
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) {
        // Final attempt failed; log but don't throw to avoid breaking the session
        console.warn('[Session] Video play failed after', maxRetries, 'attempts:', err?.name || err?.message || err);
        return;
      }
      // Wait before retry with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2; // exponential backoff
    }
  }
}

/**
 * Normalize base64 audio string: strip data URLs, remove whitespace, convert base64url to standard base64, and add padding.
 * @param {string} raw - Raw base64 audio string (may include data URL prefix)
 * @returns {string} Normalized base64 string
 */
export function normalizeBase64Audio(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  const m = s.match(/^data:audio\/(?:mpeg|mp3|wav|ogg);base64,(.*)$/i);
  if (m) s = m[1];
  s = s.replace(/\s+/g, '');
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  else if (pad === 1) s += '===';
  return s;
}

/**
 * Convert base64 string to ArrayBuffer for audio decoding.
 * @param {string} b64 - Base64 audio string
 * @returns {ArrayBuffer} Audio data as ArrayBuffer
 */
export function base64ToArrayBuffer(b64) {
  const normalized = normalizeBase64Audio(b64);
  const binaryString = atob(normalized);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binaryString.charCodeAt(i);
  return bytes.buffer;
}

/**
 * Generate a tiny silent WAV data URL to unlock HTMLMedia playback on user gesture.
 * Useful for establishing autoplay permissions on mobile browsers.
 * 
 * @param {number} durationMs - Duration in milliseconds (default 60ms)
 * @param {number} sampleRate - Sample rate in Hz (default 8000)
 * @returns {string} Data URL of silent WAV, or empty string on error
 */
export function makeSilentWavDataUrl(durationMs = 60, sampleRate = 8000) {
  try {
    const numSamples = Math.max(1, Math.floor(sampleRate * (durationMs / 1000)));
    const blockAlign = 2; // mono, 16-bit
    const byteRate = sampleRate * blockAlign;
    const dataSize = numSamples * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => { for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i)); };
    // RIFF header
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    // fmt chunk
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true);  // PCM format
    view.setUint16(22, 1, true);  // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // bits per sample
    // data chunk
    writeStr(36, 'data');
    view.setUint32(40, dataSize, true);
    // samples are already zero (silence)
    // Convert to base64
    const bytes = new Uint8Array(buffer);
    let bin = '';
    for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
    const b64 = btoa(bin);
    return `data:audio/wav;base64,${b64}`;
  } catch {
    return '';
  }
}

/**
 * Ensure an AudioContext exists and is resumed. Creates a new context if needed.
 * Note: This function expects audioCtxRef and webAudioGainRef to be managed externally.
 * 
 * @param {Object} refs - Object containing audioCtxRef, webAudioGainRef, and mutedRef
 * @returns {AudioContext|null} The AudioContext instance, or null if unavailable
 */
export function ensureAudioContext(refs) {
  const { audioCtxRef, webAudioGainRef, mutedRef } = refs;
  const Ctx = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
  if (!Ctx) return null;
  if (!audioCtxRef.current || (audioCtxRef.current && audioCtxRef.current.state === 'closed')) {
    try {
      const ctx = new Ctx();
      const gain = ctx.createGain();
      gain.gain.value = mutedRef.current ? 0 : 1;
      gain.connect(ctx.destination);
      audioCtxRef.current = ctx;
      webAudioGainRef.current = gain;
    } catch (e) {
      console.warn('[Session] Failed to create AudioContext', e);
      return null;
    }
  }
  try {
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      // resume without awaiting to keep in gesture
      audioCtxRef.current.resume();
    }
  } catch {}
  return audioCtxRef.current;
}

/**
 * Stop the current WebAudio source node safely.
 * @param {Object} webAudioSourceRef - Ref containing the BufferSourceNode
 */
export function stopWebAudioSource(webAudioSourceRef) {
  const src = webAudioSourceRef.current;
  if (src) {
    try { src.onended = null; } catch {}
    try { src.stop(); } catch {}
    try { src.disconnect(); } catch {}
  }
}

/**
 * Play audio via WebAudio API (more resilient to autoplay policies than HTMLAudio on some browsers).
 * 
 * @param {string} b64 - Base64 audio string
 * @param {Array<string>} sentences - Caption sentences for display sync
 * @param {number} startIndex - Starting caption index
 * @param {Object} refs - Object containing audioCtxRef, webAudioGainRef, webAudioSourceRef, webAudioBufferRef, webAudioStartedAtRef, webAudioPausedAtRef, mutedRef
 * @param {Function} scheduleCaptionsForDuration - Callback to schedule captions based on duration
 * @param {Function} setIsSpeaking - Callback to update speaking state
 * @param {Function} armSpeechGuard - Callback to arm speech timeout guard
 * @param {Function} clearSpeechGuard - Callback to clear speech timeout guard
 * @param {Object} videoRef - Ref to video element for lockstep playback
 * @param {Object} captionBatchRefs - Object with captionBatchStartRef and captionBatchEndRef
 * @param {Object} userPausedRef - Ref tracking user pause state
 * @param {Object} forceNextPlaybackRef - Ref for force-play flag
 * @param {string} phase - Current session phase
 * @param {string} subPhase - Current session sub-phase
 * @param {string} askState - Current ask state
 * @param {string} riddleState - Current riddle state
 * @param {string} poemState - Current poem state
 * @param {Function} setShowOpeningActions - Callback to reveal opening actions
 * @returns {Promise<void>}
 * @throws {Error} If WebAudio is not available or decode/play fails
 */
export async function playViaWebAudio(
  b64,
  sentences,
  startIndex,
  refs,
  scheduleCaptionsForDuration,
  setIsSpeaking,
  armSpeechGuard,
  clearSpeechGuard,
  videoRef,
  captionBatchRefs,
  userPausedRef,
  forceNextPlaybackRef,
  phase,
  subPhase,
  askState,
  riddleState,
  poemState,
  setShowOpeningActions
) {
  const { audioCtxRef, webAudioGainRef, webAudioSourceRef, webAudioBufferRef, webAudioStartedAtRef, webAudioPausedAtRef, mutedRef } = refs;
  const ctx = ensureAudioContext(refs);
  if (!ctx) throw new Error('WebAudio not available');
  stopWebAudioSource(webAudioSourceRef);
  try {
    // Ensure context is running before we decode and start; if it was created while suspended,
    // resuming here avoids a silent start on some browsers.
    try {
      try { console.info('[Session] WebAudio state before resume:', ctx?.state); } catch {}
      if (ctx.state === 'suspended') { await ctx.resume(); }
      try { console.info('[Session] WebAudio state after resume:', ctx?.state); } catch {}
      // If the context is still not running (common after refresh without a user gesture),
      // bail out so the caller can fall back to HTMLAudio or synthetic playback.
      if (ctx.state !== 'running') {
        throw new Error('WebAudio context not running');
      }
    } catch {}
    const arr = base64ToArrayBuffer(b64);
    const buffer = await ctx.decodeAudioData(arr.slice(0));
    webAudioBufferRef.current = buffer;
    try { console.info('[Session] WebAudio decode ok; duration(s)=', Number(buffer?.duration || 0).toFixed(2)); } catch {}
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    try {
      if (!webAudioGainRef.current) {
        const gain = ctx.createGain();
        gain.gain.value = mutedRef.current ? 0 : 1;
        gain.connect(ctx.destination);
        webAudioGainRef.current = gain;
      }
      // Ensure gain matches current mute state right before we connect/start.
      try { if (webAudioGainRef.current) { webAudioGainRef.current.gain.value = mutedRef.current ? 0 : 1; } } catch {}
    } catch {}
    src.connect(webAudioGainRef.current || ctx.destination);
    webAudioSourceRef.current = src;

    {
      const allowAuto = (!userPausedRef.current || forceNextPlaybackRef.current);
      if (allowAuto) {
        // Track current caption batch boundaries for pause/resume parity with HTMLAudio path
        try {
          const batchLen = (sentences && sentences.length) || 0;
          captionBatchRefs.captionBatchStartRef.current = startIndex || 0;
          captionBatchRefs.captionBatchEndRef.current = (startIndex || 0) + batchLen;
        } catch {}
        // Note: Caption scheduling deferred until after video starts (see below)
        // Reset the force flag after first autoplay attempt
        try { if (forceNextPlaybackRef.current) forceNextPlaybackRef.current = false; } catch {}
      }
    }
    setIsSpeaking(true);
    await new Promise((resolve) => {
      src.onended = () => {
        try {
          setIsSpeaking(false);
          // Pause video when the TTS finishes to surface controls
          if (videoRef.current) { try { videoRef.current.pause(); } catch {} }
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
        stopWebAudioSource(webAudioSourceRef);
        webAudioStartedAtRef.current = 0;
        webAudioPausedAtRef.current = 0;
        clearSpeechGuard();
        resolve();
      };
      try {
        try { console.info('[Session] Starting WebAudio source now at', ctx?.currentTime); } catch {}
        webAudioStartedAtRef.current = ctx.currentTime;
        webAudioPausedAtRef.current = 0;
        
        // Start video in response to audio start
        const startVideoAndCaptions = async () => {
          try {
            if (videoRef.current) {
              await playVideoWithRetry(videoRef.current);
              // Small delay to ensure video has actually started playing before scheduling captions
              // Critical for slow devices (old iPads) where video takes time to start
              await new Promise(r => setTimeout(r, 100));
            }
          } catch {}
          
          // Now schedule captions after video is playing
          const allowAuto = (!userPausedRef.current || forceNextPlaybackRef.current);
          if (allowAuto) {
            try { scheduleCaptionsForDuration(buffer.duration, sentences || [], startIndex || 0); } catch {}
          }
        };
        
        // Start video and captions asynchronously (don't block audio start)
        startVideoAndCaptions().catch(() => {});
        
        // Arm guard with known duration for WebAudio
        try { armSpeechGuard(buffer.duration || 0, 'webaudio:start'); } catch {}
        src.start(0);
      } catch (e) { console.warn('[Session] WebAudio start failed', e); resolve(); }
    });
  } catch (e) {
    console.warn('[Session] WebAudio decode/play failed', e);
    throw e;
  }
}

/**
 * Unlock audio playback during a user gesture (creates/resumes AudioContext and plays silent blip).
 * IMPORTANT: Do NOT auto-play any prior TTS here; unlock must be passive to avoid echo/overlap.
 * 
 * @param {Object} refs - Object containing audioCtxRef, webAudioGainRef, mutedRef
 * @param {Object} audioUnlockedRef - Ref tracking unlock state
 * @param {Function} setAudioUnlocked - Callback to update unlock state
 */
export async function unlockAudioPlayback(refs, audioUnlockedRef, setAudioUnlocked) {
  const { audioCtxRef, webAudioGainRef } = refs;
  try {
    // Create/resume AudioContext during the gesture
    const ctx = ensureAudioContext(refs);
    
    // CRITICAL for Chrome iOS: await the resume to ensure context is running
    if (ctx && ctx.state === 'suspended') {
      try {
        await ctx.resume();
        console.info('[Session] AudioContext resumed during unlock, state:', ctx.state);
      } catch (e) {
        console.warn('[Session] Failed to resume AudioContext during unlock', e);
      }
    }
    
    try {
      // Small near-silent blip to solidify unlock; do not await
      if (ctx && ctx.state === 'running') {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        g.gain.value = 0.0001;
        osc.connect(g).connect(webAudioGainRef.current || ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.03);
      }
    } catch {}

    // Also unlock HTMLMedia by playing a tiny muted silent WAV once during the gesture
    try {
      const url = makeSilentWavDataUrl(80);
      if (url) {
        const a = new Audio(url);
        a.muted = true;
        a.volume = 0;
        // Best-effort; do not await
        const p = a.play();
        if (p && p.catch) { p.catch(() => {}); }
        // Stop it shortly after
        setTimeout(() => { try { a.pause(); } catch {} }, 120);
      }
    } catch {}

    // Mark audio as explicitly unlocked so we do not force the prompt again
    audioUnlockedRef.current = true;
    try { if (typeof window !== 'undefined') localStorage.setItem('ms_audioUnlocked', 'true'); } catch {}
    try { setAudioUnlocked(true); } catch {}
  } catch (e) {
    console.warn('[Session] Audio unlock attempt failed', e);
  }
}

/**
 * Request audio and mic permissions during a user gesture (Begin click).
 * - Resumes/creates AudioContext and marks audio as unlocked.
 * - Requests microphone access once, then immediately stops tracks.
 * This should be invoked synchronously inside Begin handlers before any awaits.
 * 
 * @param {boolean} force - Force mic prompt even if already known or on Safari
 * @param {Object} refs - Audio context refs
 * @param {Object} audioUnlockedRef - Ref tracking audio unlock state
 * @param {Function} setAudioUnlocked - Callback to update audio unlock state
 * @param {Object} micRequestInFlightRef - Ref tracking concurrent mic requests
 * @param {boolean|null} micAllowed - Current mic permission state
 * @param {Function} setMicAllowed - Callback to update mic permission state
 * @param {boolean} isSafari - Whether browser is Safari
 * @param {Function} showTipOverride - Callback to show tip message
 */
export function requestAudioAndMicPermissions(
  force,
  refs,
  audioUnlockedRef,
  setAudioUnlocked,
  micRequestInFlightRef,
  micAllowed,
  setMicAllowed,
  isSafari,
  showTipOverride
) {
  // Always try to unlock audio; harmless and gesture-friendly
  try { unlockAudioPlayback(refs, audioUnlockedRef, setAudioUnlocked); } catch {}
  // Avoid concurrent mic prompts
  if (micRequestInFlightRef.current) return;
  // If mic decision already known and not forcing, skip
  if (!force && micAllowed !== null) return;
  // On Safari, avoid auto mic prompts unless forced by user click
  if (!force && isSafari) return;
  try {
    const nav = (typeof navigator !== 'undefined') ? navigator : null;
    if (nav && nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function') {
      micRequestInFlightRef.current = true;
      nav.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          try { stream.getTracks().forEach(t => { try { t.stop(); } catch {} }); } catch {}
          // Persist mic allowed state
          try { if (typeof window !== 'undefined') localStorage.setItem('ms_micAllowed', 'true'); } catch {}
          try { setMicAllowed(true); } catch {}
        })
        .catch((err) => {
          try {
            console.info('[Session] Mic permission request failed or denied', err?.name || err);
            // Surface a brief, non-blocking tip so users know typing still works
            try { showTipOverride('Mic access denied. You can still type answers.', 5000); } catch {}
            // Persist denied state to guide banner visibility
            try { if (typeof window !== 'undefined') localStorage.setItem('ms_micAllowed', 'false'); } catch {}
            try { setMicAllowed(false); } catch {}
          } catch {}
        })
        .finally(() => { micRequestInFlightRef.current = false; });
    }
  } catch { micRequestInFlightRef.current = false; }
}
