import test from 'node:test';
import assert from 'node:assert/strict';
import { recognizeSpeechWithRetry, isRetryableSpeechError, speechErrorCode } from '../recognitionRetry.mjs';

test('recovers a transient Google Speech failure without rerecording', async () => {
  const calls = [];
  const client = { recognize: async (request, settings) => {
    calls.push({ request, settings });
    if (calls.length === 1) throw Object.assign(new Error('temporary'), { code: 14 });
    return [{ results: [{ alternatives: [{ transcript: 'Hello' }] }] }];
  }};
  const payload = { audio: { content: 'same recording' } };
  const response = await recognizeSpeechWithRetry(client, payload, { wait: async () => {} });
  assert.equal(response[0].results[0].alternatives[0].transcript, 'Hello');
  assert.equal(calls.length, 2);
  assert.strictEqual(calls[0].request, calls[1].request);
  assert.equal(calls[0].settings.timeout, 26000);
});

test('does not retry invalid audio or permissions/configuration failures', async () => {
  let count = 0;
  const client = { recognize: async () => { count++; throw Object.assign(new Error('bad format'), { code: 3 }); }};
  await assert.rejects(recognizeSpeechWithRetry(client, {}));
  assert.equal(count, 1);
  assert.equal(isRetryableSpeechError({ code: 3 }), false);
  assert.equal(speechErrorCode({ code: 4 }), '4');
});

test('bounds retry attempts on persistent transient errors', async () => {
  let count = 0;
  const client = { recognize: async () => { count++; throw Object.assign(new Error('deadline'), { code: 4 }); }};
  await assert.rejects(recognizeSpeechWithRetry(client, {}, { wait: async () => {} }));
  assert.equal(count, 2);
});
