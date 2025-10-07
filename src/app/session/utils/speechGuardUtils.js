/**
 * speechGuardUtils.js
 * Speech guard utilities for preventing UI lock when audio playback stalls or hangs.
 * Provides timeout-based safety mechanism to force-stop speaking state if audio doesn't complete naturally.
 */

/**
 * Clear speech guard timer.
 * Cancels any pending speech guard timeout and resets the timer ref.
 * 
 * @param {object} speechGuardTimerRef - React ref containing speech guard timer ID
 */
export function clearSpeechGuard(speechGuardTimerRef) {
  try {
    if (speechGuardTimerRef.current) {
      clearTimeout(speechGuardTimerRef.current);
      speechGuardTimerRef.current = null;
    }
  } catch {}
}

/**
 * Force stop all speaking/playback activities.
 * Called when speech guard timer fires, indicating audio has stalled or hung.
 * Stops audio, video, clears guard, and optionally reveals opening actions.
 * 
 * @param {string} reason - Reason for force stop (for logging/debugging)
 * @param {object} refs - React refs { audioRef, videoRef, speechGuardTimerRef }
 * @param {object} phaseState - Current phase state { phase, subPhase, askState, riddleState, poemState }
 * @param {function} setIsSpeaking - React state setter for speaking status
 * @param {function} setShowOpeningActions - React state setter for opening actions visibility
 * @param {function} stopWebAudioSource - Function to stop WebAudio source
 */
export function forceStopSpeaking(
  reason,
  refs,
  phaseState,
  setIsSpeaking,
  setShowOpeningActions,
  stopWebAudioSource
) {
  try { console.warn('[Session] Speech guard fired; forcing stop. reason=', reason); } catch {}
  
  const { audioRef, videoRef, speechGuardTimerRef } = refs;
  
  if (audioRef.current) {
    try { audioRef.current.pause(); } catch {}
    try { audioRef.current.src = ''; } catch {}
    audioRef.current = null;
  }
  
  try { stopWebAudioSource(); } catch {}
  if (videoRef.current) { try { videoRef.current.pause(); } catch {} }
  try { setIsSpeaking(false); } catch {}
  
  // Also surface Opening actions if we are in Discussion awaiting-learner
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
  
  clearSpeechGuard(speechGuardTimerRef);
}

/**
 * Arm speech guard with timeout based on expected audio duration.
 * Clears any existing guard and sets a new timeout to force-stop if audio doesn't complete.
 * Adds a 3-second safety buffer to the provided duration.
 * 
 * @param {number} seconds - Expected audio duration in seconds
 * @param {string} label - Label for logging/debugging (e.g., 'html:loaded', 'synthetic')
 * @param {object} speechGuardTimerRef - React ref to store timer ID
 * @param {function} forceStopSpeakingCallback - Callback to invoke when guard fires
 */
export function armSpeechGuard(seconds, label, speechGuardTimerRef, forceStopSpeakingCallback) {
  clearSpeechGuard(speechGuardTimerRef);
  const sec = Math.max(0, Number(seconds) || 0);
  // No upper cap: allow long audio; add a small safety fudge
  const ms = Math.max(1800, Math.floor(sec * 1000) + 3000);
  try { console.info('[Session] Arming speech guard for ~', Math.round(ms/1000), 's', label ? `(${label})` : ''); } catch {}
  speechGuardTimerRef.current = setTimeout(() => forceStopSpeakingCallback('guard:' + (label || 'unknown')), ms);
}

/**
 * Arm speech guard with throttling to avoid excessive timer resets.
 * Only arms guard if at least 800ms has passed since the last arm attempt.
 * Useful during audio events that fire repeatedly (e.g., timeupdate).
 * 
 * @param {number} seconds - Expected audio duration in seconds
 * @param {string} label - Label for logging/debugging
 * @param {object} lastGuardArmAtRef - React ref tracking last arm timestamp
 * @param {function} armSpeechGuardCallback - Callback to arm the guard
 */
export function armSpeechGuardThrottled(seconds, label, lastGuardArmAtRef, armSpeechGuardCallback) {
  const now = Date.now();
  if (!lastGuardArmAtRef.current || now - lastGuardArmAtRef.current >= 800) {
    lastGuardArmAtRef.current = now;
    armSpeechGuardCallback(seconds, label);
  }
}
