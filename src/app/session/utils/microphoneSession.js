let cachedMicrophoneStream = null;
let microphoneRequestPromise = null;
let microphoneUseCount = 0;
let microphoneRequestEpoch = 0;
const pendingMicrophoneWaiters = new Set();

function microphoneAbortError() {
  const error = new Error('Microphone request cancelled');
  error.name = 'AbortError';
  return error;
}
let pageCleanupBound = false;

const MICROPHONE_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
  },
};

function getLiveAudioTracks(stream) {
  try {
    return stream?.getAudioTracks?.().filter(track => track.readyState === 'live') || [];
  } catch {
    return [];
  }
}

function hasReusableAudio(stream) {
  return getLiveAudioTracks(stream).length > 0;
}

function setTracksEnabled(stream, enabled) {
  getLiveAudioTracks(stream).forEach(track => {
    try { track.enabled = enabled; } catch {}
  });
}

function setAudioSessionType(type) {
  // Safari may move playback to the receiver or retain a low-volume recording
  // route after getUserMedia. Other browsers do not necessarily expose this API.
  try {
    if (typeof navigator !== 'undefined' && navigator.audioSession) {
      navigator.audioSession.type = type;
    }
  } catch {}
}

function restorePlaybackWhenIdle() {
  if (microphoneUseCount === 0 && !microphoneRequestPromise) {
    setAudioSessionType('playback');
  }
}

// A new lesson should recover output routing left behind by a previous screen,
// but must never steal audio routing from a currently active microphone.
export function ensurePlaybackAudioSession() {
  restorePlaybackWhenIdle();
}

function activateStream(stream) {
  if (stream !== cachedMicrophoneStream || !hasReusableAudio(stream)) {
    throw new Error('Microphone stream is no longer available');
  }
  // Two MediaRecorders must not compete for one shared capture track.
  if (microphoneUseCount > 0) {
    throw new Error('Microphone already in use');
  }
  microphoneUseCount = 1;
  setTracksEnabled(stream, true);
  return stream;
}

function stopStream(stream) {
  try { stream?.getTracks?.().forEach(track => track.stop()); } catch {}
}

function persistMicAllowed(value) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ms_micAllowed', value ? 'true' : 'false');
    }
  } catch {}
}

function bindPageCleanup() {
  if (pageCleanupBound || typeof window === 'undefined') return;
  pageCleanupBound = true;
  const release = () => releaseReusableMicrophoneStream();
  window.addEventListener('pagehide', release);
  window.addEventListener('beforeunload', release);
}

export async function getReusableMicrophoneStream({ signal } = {}) {
  if (signal?.aborted) throw microphoneAbortError();
  if (hasReusableAudio(cachedMicrophoneStream)) {
    return activateStream(cachedMicrophoneStream);
  }

  if (cachedMicrophoneStream) {
    stopStream(cachedMicrophoneStream);
    cachedMicrophoneStream = null;
    microphoneUseCount = 0;
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Voice input unavailable');
  }

  const requestEpoch = microphoneRequestEpoch;
  if (!microphoneRequestPromise) {
    // Explicitly enter recording mode, then restore playback after the last
    // capture track ends. Track.enabled=false does not restore iOS audio routing.
    setAudioSessionType('play-and-record');
    let request;
    try {
      request = navigator.mediaDevices.getUserMedia(MICROPHONE_CONSTRAINTS);
    } catch (error) {
      restorePlaybackWhenIdle();
      throw error;
    }

    const pending = Promise.resolve(request)
      .then(stream => {
        if (requestEpoch !== microphoneRequestEpoch || !hasReusableAudio(stream)) {
          stopStream(stream);
          throw new Error('Microphone request cancelled or unavailable');
        }
        cachedMicrophoneStream = stream;
        persistMicAllowed(true);
        bindPageCleanup();
        return stream;
      })
      .catch(error => {
        if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
          persistMicAllowed(false);
        }
        throw error;
      })
      .finally(() => {
        if (microphoneRequestPromise === pending) microphoneRequestPromise = null;
        // Do not reset to playback between permission resolution and the
        // awaiting recorder's activation. Only restore after a failed request.
        if (!hasReusableAudio(cachedMicrophoneStream)) restorePlaybackWhenIdle();
      });

    microphoneRequestPromise = pending;
  }

  // Every requesting screen owns its pending permission wait. Unmounting one
  // caller must not cancel another caller's legitimate recording request.
  const waiter = {};
  pendingMicrophoneWaiters.add(waiter);
  let onAbort = null;
  try {
    const pending = microphoneRequestPromise;
    const stream = signal
      ? await Promise.race([
          pending,
          new Promise((_, reject) => {
            onAbort = () => reject(microphoneAbortError());
            if (signal.aborted) onAbort();
            else signal.addEventListener('abort', onAbort, { once: true });
          }),
        ])
      : await pending;
    if (signal?.aborted) throw microphoneAbortError();
    if (requestEpoch !== microphoneRequestEpoch || stream !== cachedMicrophoneStream) {
      throw new Error('Microphone request cancelled');
    }
    return activateStream(stream);
  } finally {
    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
    pendingMicrophoneWaiters.delete(waiter);
    // getUserMedia itself cannot be aborted everywhere. Invalidate the old
    // request, restore playback now, and stop its stream if it arrives later.
    if (signal?.aborted && pendingMicrophoneWaiters.size === 0 &&
        microphoneUseCount === 0 &&
        (microphoneRequestPromise || cachedMicrophoneStream)) {
      releaseReusableMicrophoneStream();
    }
  }
}

export function isMicrophoneCapturing() {
  return microphoneUseCount > 0 && hasReusableAudio(cachedMicrophoneStream);
}

export function pauseReusableMicrophoneStream(stream = cachedMicrophoneStream) {
  if (!stream) return;
  if (stream === cachedMicrophoneStream) {
    microphoneUseCount = 0;
    stopStream(stream);
    cachedMicrophoneStream = null;
  } else {
    stopStream(stream);
  }
  restorePlaybackWhenIdle();
}

export function releaseReusableMicrophoneStream() {
  // Invalidate unresolved permission prompts too: a late grant must not revive
  // capture after navigation, cancellation, or page teardown.
  microphoneRequestEpoch += 1;
  // A page-level release invalidates all old waiters. Unresolved browser
  // permission prompts must not prevent cancellation of a later request.
  pendingMicrophoneWaiters.clear();
  if (cachedMicrophoneStream) stopStream(cachedMicrophoneStream);
  cachedMicrophoneStream = null;
  microphoneRequestPromise = null;
  microphoneUseCount = 0;
  restorePlaybackWhenIdle();
}
