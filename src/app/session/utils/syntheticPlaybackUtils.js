/**
 * syntheticPlaybackUtils.js
 * Synthetic playback utilities for caption-only playback without audio assets.
 * Manages timing state machine for displaying captions when no TTS audio is available.
 */

import { playVideoWithRetry } from './audioUtils';

/**
 * Clear synthetic playback state and timers.
 * Resets the synthetic ref to inactive state with all timing data cleared.
 * 
 * @param {object} syntheticRef - React ref containing synthetic playback state
 */
export function clearSynthetic(syntheticRef) {
  try { 
    if (syntheticRef.current?.timerId) {
      clearTimeout(syntheticRef.current.timerId);
    }
  } catch {}
  syntheticRef.current = { active: false, duration: 0, elapsed: 0, startAtMs: 0, timerId: null };
}

/**
 * Complete synthetic playback with cleanup.
 * Stops video, clears speech guard, resets synthetic state, and optionally reveals opening actions.
 * 
 * @param {object} syntheticRef - React ref containing synthetic playback state
 * @param {object} videoRef - React ref to video element
 * @param {object} phase state - Current phase state { phase, subPhase, askState, riddleState, poemState }
 * @param {function} setIsSpeaking - React state setter for speaking status
 * @param {function} setShowOpeningActions - React state setter for opening actions visibility
 * @param {function} clearSpeechGuard - Function to clear speech guard timer
 */
export function finishSynthetic(
  syntheticRef,
  videoRef,
  phaseState,
  setIsSpeaking,
  setShowOpeningActions,
  clearSpeechGuard
) {
  try { setIsSpeaking(false); } catch {}
  try { if (videoRef.current) videoRef.current.pause(); } catch {}
  
  // If we're in Discussion awaiting-learner, explicitly reveal Opening actions now
  try {
    const { phase, subPhase, askState, riddleState, poemState } = phaseState;
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
  
  clearSpeechGuard();
  clearSynthetic(syntheticRef);
}

/**
 * Pause synthetic playback.
 * Tracks elapsed time, clears timers, pauses video, and clears caption timers.
 * 
 * @param {object} syntheticRef - React ref containing synthetic playback state
 * @param {object} videoRef - React ref to video element
 * @param {function} clearCaptionTimers - Function to clear caption scheduling timers
 */
export function pauseSynthetic(syntheticRef, videoRef, clearCaptionTimers) {
  const s = syntheticRef.current;
  if (!s?.active) return;
  
  try {
    if (s.startAtMs) {
      const now = Date.now();
      const delta = Math.max(0, (now - s.startAtMs) / 1000);
      s.elapsed = Math.max(0, (s.elapsed || 0) + delta);
    }
  } catch {}
  
  try { if (s.timerId) clearTimeout(s.timerId); } catch {}
  s.timerId = null;
  s.startAtMs = 0;
  
  try { if (videoRef.current) videoRef.current.pause(); } catch {}
  try { clearCaptionTimers(); } catch {}
}

/**
 * Resume synthetic playback from paused state.
 * Recalculates remaining time, reschedules captions, restarts video, and arms completion timer.
 * 
 * @param {object} syntheticRef - React ref containing synthetic playback state
 * @param {object} refs - React refs { videoRef, speechGuardTimerRef, captionBatchEndRef, captionSentencesRef }
 * @param {number} captionIndex - Current caption index
 * @param {function} scheduleCaptionsForDuration - Function to schedule captions with fixed duration
 * @param {function} setIsSpeaking - React state setter for speaking status
 * @param {function} finishSyntheticCallback - Callback to invoke when synthetic playback completes
 */
export function resumeSynthetic(
  syntheticRef,
  refs,
  captionIndex,
  scheduleCaptionsForDuration,
  setIsSpeaking,
  finishSyntheticCallback
) {
  const s = syntheticRef.current;
  if (!s?.active) return;
  
  const { videoRef, speechGuardTimerRef, captionBatchEndRef, captionSentencesRef } = refs;
  
  const total = Number(s.duration || 0);
  const elapsed = Math.max(0, Number(s.elapsed || 0));
  const remaining = Math.max(0.1, total - elapsed);
  
  try {
    const startAt = captionIndex;
    const end = captionBatchEndRef.current || captionSentencesRef.current.length;
    const slice = (captionSentencesRef.current || []).slice(startAt, end);
    if (slice.length) scheduleCaptionsForDuration(remaining, slice, startAt);
  } catch {}
  
  try {
    if (videoRef.current) {
      playVideoWithRetry(videoRef.current);
    }
  } catch {}
  
  try { setIsSpeaking(true); } catch {}
  try { if (speechGuardTimerRef?.current) clearTimeout(speechGuardTimerRef.current); } catch {}
  
  try {
    s.startAtMs = Date.now();
    s.timerId = setTimeout(finishSyntheticCallback, Math.round(remaining * 1000) + 50);
  } catch {}
}
