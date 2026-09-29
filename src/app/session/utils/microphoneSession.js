let cachedMicrophoneStream = null;
let microphoneRequestPromise = null;
let microphoneUseCount = 0;
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

function activateStream(stream) {
  microphoneUseCount += 1;
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

export async function getReusableMicrophoneStream() {
  if (hasReusableAudio(cachedMicrophoneStream)) {
    return activateStream(cachedMicrophoneStream);
  }

  if (cachedMicrophoneStream) {
    stopStream(cachedMicrophoneStream);
    cachedMicrophoneStream = null;
    microphoneUseCount = 0;
  }

  if (microphoneRequestPromise) {
    const stream = await microphoneRequestPromise;
    return activateStream(stream);
  }

  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Voice input unavailable');
  }

  microphoneRequestPromise = navigator.mediaDevices.getUserMedia(MICROPHONE_CONSTRAINTS)
    .then(stream => {
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
      microphoneRequestPromise = null;
    });

  const stream = await microphoneRequestPromise;
  return activateStream(stream);
}

export function pauseReusableMicrophoneStream(stream = cachedMicrophoneStream) {
  if (!stream) return;
  if (stream === cachedMicrophoneStream && microphoneUseCount > 0) {
    microphoneUseCount -= 1;
  }
  if (stream !== cachedMicrophoneStream || microphoneUseCount === 0) {
    setTracksEnabled(stream, false);
  }
}

export function releaseReusableMicrophoneStream() {
  if (cachedMicrophoneStream) stopStream(cachedMicrophoneStream);
  cachedMicrophoneStream = null;
  microphoneRequestPromise = null;
  microphoneUseCount = 0;
}
