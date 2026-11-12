// Keep synchronous Google recognition bounded; retry only errors that can recover.
export const STT_RECOGNITION_TIMEOUT_MS = 26000;
const RETRYABLE_CODES = new Set(['2', '4', '8', '10', '13', '14', 'UNKNOWN', 'DEADLINE_EXCEEDED', 'RESOURCE_EXHAUSTED', 'ABORTED', 'INTERNAL', 'UNAVAILABLE']);

export function speechErrorCode(error) {
  const raw = error?.code;
  return typeof raw === 'number' || typeof raw === 'string' ? String(raw).toUpperCase() : 'UNCLASSIFIED';
}

export function isRetryableSpeechError(error) {
  return RETRYABLE_CODES.has(speechErrorCode(error));
}

export async function recognizeSpeechWithRetry(client, request, { timeoutMs = STT_RECOGNITION_TIMEOUT_MS, wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await client.recognize(request, { timeout: timeoutMs });
    } catch (error) {
      if (attempt === 1 || !isRetryableSpeechError(error)) throw error;
      await wait(250);
    }
  }
  throw new Error('STT retry loop exhausted');
}
