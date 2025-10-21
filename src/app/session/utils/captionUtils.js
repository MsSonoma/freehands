/**
 * captionUtils.js
 * Caption scheduling and timing utilities for synchronized subtitle display.
 * Pure functions for caption pacing, word counting, and timer management.
 */

/**
 * Count words in a sentence or sentence-like object. Used for caption pacing.
 * Accepts a string or an object with a `text` field; returns a minimum of 1.
 * 
 * @param {string|object} s - Sentence string or object with text field
 * @returns {number} Word count (minimum 1)
 */
export function countWords(s) {
  try {
    const raw = (typeof s === 'string') ? s : (s && typeof s.text === 'string' ? s.text : '');
    if (!raw) return 1;
    // Normalize non-breaking spaces and collapse whitespace
    const norm = String(raw).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
    if (!norm) return 1;
    // Split on spaces after stripping simple punctuation groups
    const cleaned = norm.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[^A-Za-z0-9'+\-]+/g, ' ');
    const parts = cleaned.trim().split(/\s+/).filter(Boolean);
    return parts.length || 1;
  } catch { return 1; }
}

/**
 * Clear all active caption timers.
 * 
 * @param {object} captionTimersRef - React ref containing array of timer IDs
 */
export function clearCaptionTimers(captionTimersRef) {
  try {
    if (captionTimersRef.current && Array.isArray(captionTimersRef.current)) {
      captionTimersRef.current.forEach((timer) => clearTimeout(timer));
      captionTimersRef.current = [];
    }
  } catch {}
}

/**
 * Schedule captions synchronized to HTMLAudio playback.
 * Waits for audio duration metadata, then schedules caption progression based on word count distribution.
 * 
 * @param {HTMLAudioElement} audio - Audio element to sync captions with
 * @param {Array} sentences - Array of sentence strings or objects with text fields
 * @param {number} startIndex - Starting caption index
 * @param {object} refs - React refs { captionTimersRef, captionBatchEndRef }
 * @param {function} setCaptionIndex - React state setter for caption index
 * @param {function} setCaptionsDone - React state setter for captions completion signal
 */
export function scheduleCaptionsForAudio(audio, sentences, startIndex, refs, setCaptionIndex, setCaptionsDone) {
  const { captionTimersRef, captionBatchEndRef } = refs;
  
  clearCaptionTimers(captionTimersRef);
  if (!sentences || !sentences.length) return;
  
  try { setCaptionsDone(false); } catch {}

  // Only schedule through the provided batch of sentences; caller passes in the new batch
  const totalWords = sentences.reduce((sum, s) => sum + (countWords(s) || 1), 0) || sentences.length;
  
  const startSchedule = (durationSeconds) => {
    const safeDuration = durationSeconds && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : Math.max(totalWords / 3.6, Math.min(sentences.length * 1.5, 12));

    // Ensure a minimum display time per sentence so progression is visible
    const minPerSentence = 0.6; // seconds

    let elapsed = 0;
    setCaptionIndex(startIndex);
    
    for (let i = 1; i < sentences.length; i += 1) {
      const prevWords = countWords(sentences[i - 1]) || 1;
      const step = Math.max(minPerSentence, safeDuration * (prevWords / totalWords));
      elapsed += step;
      const targetIndex = startIndex + i;
      
      const timer = window.setTimeout(() => {
        setCaptionIndex(targetIndex);
        // If we reached the end-of-batch caption, mark captionsDone
        try {
          const end = captionBatchEndRef.current || (startIndex + sentences.length);
          if (targetIndex >= end - 1) setCaptionsDone(true);
        } catch {}
      }, Math.round(elapsed * 1000));
      
      captionTimersRef.current.push(timer);
    }
  };

  let scheduled = false;
  const launch = (d) => {
    if (scheduled) return;
    scheduled = true;
    startSchedule(d);
  };
  
  if (Number.isFinite(audio.duration) && audio.duration > 0) {
    // Use remaining duration when resuming mid-playback so caption pacing stays aligned
    const remaining = Math.max(0.1, (audio.duration || 0) - (audio.currentTime || 0));
    launch(remaining);
  } else {
    const onLoaded = () => launch(audio.duration);
    audio.addEventListener("loadedmetadata", onLoaded, { once: true });
    audio.addEventListener("canplay", onLoaded, { once: true });
    
    // Wait for audio to actually start playing before scheduling captions (critical for slow devices)
    // If audio never plays, fall back to heuristic after longer delay
    const onPlayStart = () => {
      if (!scheduled) {
        const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
        launch(duration);
      }
    };
    audio.addEventListener("play", onPlayStart, { once: true });
    
    // Extended fallback for extremely slow devices: only start captions after 2 seconds if audio still hasn't loaded/played
    const fallbackTimer = window.setTimeout(() => {
      if (!scheduled) {
        console.warn('[Captions] Audio metadata/play delayed beyond 2s, starting captions with heuristic');
        launch(0);
      }
    }, 2000);
    captionTimersRef.current.push(fallbackTimer);
  }
}

/**
 * Schedule captions against a known duration (used by WebAudio fallback and synthetic playback).
 * Immediately schedules caption progression based on word count distribution over the specified duration.
 * 
 * @param {number} durationSeconds - Total duration for caption display
 * @param {Array} sentences - Array of sentence strings or objects with text fields
 * @param {number} startIndex - Starting caption index
 * @param {object} refs - React refs { captionTimersRef, captionBatchEndRef }
 * @param {function} setCaptionIndex - React state setter for caption index
 * @param {function} setCaptionsDone - React state setter for captions completion signal
 */
export function scheduleCaptionsForDuration(durationSeconds, sentences, startIndex, refs, setCaptionIndex, setCaptionsDone) {
  const { captionTimersRef, captionBatchEndRef } = refs;
  
  clearCaptionTimers(captionTimersRef);
  if (!sentences || !sentences.length) return;
  
  try { setCaptionsDone(false); } catch {}

  const totalWords = sentences.reduce((sum, s) => sum + (countWords(s) || 1), 0) || sentences.length;
  const safeDuration = durationSeconds && Number.isFinite(durationSeconds) && durationSeconds > 0
    ? durationSeconds
    : Math.max(totalWords / 3.6, Math.min(sentences.length * 1.5, 12));
  const minPerSentence = 0.6;

  let elapsed = 0;
  setCaptionIndex(startIndex);
  
  for (let i = 1; i < sentences.length; i += 1) {
    const prevWords = countWords(sentences[i - 1]) || 1;
    const step = Math.max(minPerSentence, safeDuration * (prevWords / totalWords));
    elapsed += step;
    const targetIndex = startIndex + i;
    
    const timer = window.setTimeout(() => {
      setCaptionIndex(targetIndex);
      try {
        const end = captionBatchEndRef.current || (startIndex + sentences.length);
        if (targetIndex >= end - 1) setCaptionsDone(true);
      } catch {}
    }, Math.round(elapsed * 1000));
    
    captionTimersRef.current.push(timer);
  }
}
