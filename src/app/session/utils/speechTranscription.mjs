// Upload the already recorded speech. Keep successful segments cached so
// retrying a timeout never forces the learner to repeat their whole answer.
export const SPEECH_REQUEST_TIMEOUT_MS = 63000;
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504]);

function abortError() {
  const error = new Error('Transcription cancelled');
  error.name = 'AbortError';
  return error;
}

async function pauseBeforeRetry(ms, signal) {
  if (signal?.aborted) throw abortError();
  await new Promise((resolve, reject) => {
    let onAbort;
    const timer = setTimeout(() => {
      if (onAbort) signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
  });
}

export async function transcribeSpeechSegment(
  blob,
  { signal, timeoutMs = SPEECH_REQUEST_TIMEOUT_MS, fetchImpl = fetch, wait = pauseBeforeRetry } = {},
) {
  if (!blob?.size) return '';
  const extension = String(blob.type).includes('ogg') ? 'ogg' : 'webm';
  const form = new FormData();
  form.append('audio', blob, 'learner-speech.' + extension);
  form.append('language', 'en-US');

  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal?.aborted) throw abortError();
    const controller = new AbortController();
    let timedOut = false;
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    try {
      const response = await fetchImpl('/api/stt', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error('Speech service returned ' + response.status);
        error.retryable = RETRYABLE_STATUSES.has(response.status);
        throw error;
      }
      const data = await response.json();
      const transcript = String(data?.transcript || '').trim();
      if (transcript || attempt === 1) return transcript;
      // Occasionally Google returns an empty result on otherwise valid audio.
      await wait(250, signal);
      continue;
    } catch (error) {
      if (signal?.aborted) throw abortError();
      const retryable = timedOut || error?.retryable || error?.name === 'AbortError' || error instanceof TypeError;
      if (!retryable || attempt === 1) throw error;
      await wait(400, signal);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
  return '';
}

export async function transcribeSpeechSegments(
  segments,
  { transcripts = [], signal, fetchImpl = fetch, timeoutMs = SPEECH_REQUEST_TIMEOUT_MS, onProgress } = {},
) {
  if (!Array.isArray(segments) || segments.length === 0) {
    throw new Error('No speech recorded');
  }
  let next = 0;
  let firstError = null;
  let done = transcripts.filter(value => typeof value === 'string').length;
  const workers = Array.from({ length: Math.min(2, segments.length) }, async () => {
    while (!firstError && !signal?.aborted) {
      const index = next++;
      if (index >= segments.length) return;
      if (typeof transcripts[index] === 'string') continue;
      try {
        transcripts[index] = await transcribeSpeechSegment(segments[index], {
          signal,
          timeoutMs,
          fetchImpl,
        });
        done++;
        onProgress?.(done, segments.length);
      } catch (error) {
        firstError ||= error;
      }
    }
  });
  await Promise.all(workers);
  if (signal?.aborted) throw abortError();
  if (firstError) throw firstError;
  const text = transcripts.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error('No speech detected');
  return text;
}

// Browser playback uses locally held segments. Transcription still uploads each
// segment to the configured speech service.
export async function replaySpeechSegments(segments, { signal, AudioCtor = Audio, urlApi = URL } = {}) {
  for (const segment of segments) {
    if (signal?.aborted) throw abortError();
    await new Promise((resolve, reject) => {
      const url = urlApi.createObjectURL(segment);
      const audio = new AudioCtor(url);
      let complete = false;
      const clean = () => {
        if (complete) return false;
        complete = true;
        signal?.removeEventListener('abort', onAbort);
        try { audio.pause(); } catch {}
        urlApi.revokeObjectURL(url);
        return true;
      };
      const onAbort = () => { if (clean()) reject(abortError()); };
      audio.onended = () => { if (clean()) resolve(); };
      audio.onerror = () => { if (clean()) reject(new Error('Playback unavailable')); };
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) return onAbort();
      Promise.resolve().then(() => audio.play()).catch(error => {
        if (clean()) reject(error);
      });
    });
  }
}
