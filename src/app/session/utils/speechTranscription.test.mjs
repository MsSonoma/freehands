import test from 'node:test';
import assert from 'node:assert/strict';
import { transcribeSpeechSegments, transcribeSpeechSegment } from './speechTranscription.mjs';

function recording(text) {
  return new Blob([text], { type: 'audio/webm' });
}

test('multiple independent recordings become one ordered learner answer', async () => {
  const received = [];
  const fetchImpl = async (url, { method, body }) => {
    assert.equal(url, '/api/stt');
    assert.equal(method, 'POST');
    const spoken = await body.get('audio').text();
    received.push(spoken);
    return { ok: true, json: async () => ({ transcript: spoken }) };
  };
  const result = await transcribeSpeechSegments([
    recording('I think'), recording('the answer'), recording('is gravity.'),
  ], { fetchImpl });
  assert.equal(result, 'I think the answer is gravity.');
  assert.deepEqual(received.sort(), ['I think', 'the answer', 'is gravity.'].sort());
});

test('transcription failure keeps successful segments cached for the retry', async () => {
  const requests = [];
  const transcripts = [];
  let serviceAvailable = false;
  const fetchImpl = async (url, { body }) => {
    const spoken = await body.get('audio').text();
    requests.push(spoken);
    if (spoken === 'answer part two' && !serviceAvailable) {
      return { ok: false, status: 500 };
    }
    return { ok: true, json: async () => ({ transcript: spoken }) };
  };
  const segments = [recording('answer part one'), recording('answer part two')];
  await assert.rejects(
    transcribeSpeechSegments(segments, { fetchImpl, transcripts }),
    /Speech service returned 500/,
  );
  assert.equal(transcripts[0], 'answer part one');
  serviceAvailable = true;
  const combined = await transcribeSpeechSegments(segments, { fetchImpl, transcripts });
  assert.equal(combined, 'answer part one answer part two');
  assert.equal(requests.filter(item => item === 'answer part one').length, 1);
  assert.equal(requests.filter(item => item === 'answer part two').length, 2);
});

test('temporary speech service failures retry the original audio', async () => {
  const requests = [];
  const sameBlob = recording('Emma said something thoughtful');
  const fetchImpl = async (url, { body }) => {
    requests.push(await body.get('audio').text());
    if (requests.length === 1) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({ transcript: 'Emma said something thoughtful' }) };
  };
  const text = await transcribeSpeechSegment(sameBlob, { fetchImpl, wait: async () => {} });
  assert.equal(text, 'Emma said something thoughtful');
  assert.deepEqual(requests, ['Emma said something thoughtful', 'Emma said something thoughtful']);
});

test('a browser timeout retries recorded audio instead of asking to speak again', async () => {
  let requests = 0;
  const fetchImpl = (url, { signal }) => {
    requests++;
    if (requests === 1) return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(Object.assign(new Error('timed out'), { name: 'AbortError' })), { once: true });
    });
    return Promise.resolve({ ok: true, json: async () => ({ transcript: 'recovered speech' }) });
  };
  const text = await transcribeSpeechSegment(recording('speech'), {
    fetchImpl, timeoutMs: 10, wait: async () => {},
  });
  assert.equal(text, 'recovered speech');
  assert.equal(requests, 2);
});

test('cancelled transcription does not start another request', async () => {
  const controller = new AbortController();
  const fetchImpl = async () => {
    controller.abort();
    throw new Error('network');
  };
  await assert.rejects(
    transcribeSpeechSegments([recording('speech')], { fetchImpl, signal: controller.signal }),
    { name: 'AbortError' },
  );
});
