import test from 'node:test';
import assert from 'node:assert/strict';
import { createSegmentedSpeechRecording, SPEECH_SEGMENT_MS, MAX_SPEECH_RECORDING_MS } from './segmentedSpeechRecording.mjs';

class FakeRecorder {
  static instances = [];
  constructor(stream, { mimeType }) {
    this.stream = stream;
    this.mimeType = mimeType;
    this.state = 'inactive';
    this.id = FakeRecorder.instances.length + 1;
    FakeRecorder.instances.push(this);
  }
  start() {
    this.state = 'recording';
    this.onstart?.();
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['segment ' + this.id], { type: this.mimeType }) });
    this.onstop?.();
  }
}

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  FakeRecorder.instances = [];
  const events = { started: 0, stopped: 0, complete: null, failures: [] };
  const session = createSegmentedSpeechRecording({
    stream: {},
    mimeType: 'audio/webm;codecs=opus',
    Recorder: FakeRecorder,
    onStart: () => events.started++,
    onStopped: () => events.stopped++,
    onComplete: segments => { events.complete = segments; },
    onFailure: error => events.failures.push(error),
  });
  return { session, events };
}

test('a two-minute response is four independently playable 30-second containers', async t => {
  const { session, events } = setup(t);
  session.start();
  for (let i = 0; i < 4; i++) t.mock.timers.tick(SPEECH_SEGMENT_MS);
  assert.equal(events.started, 1);
  assert.equal(events.stopped, 1);
  assert.equal(FakeRecorder.instances.length, 4);
  assert.equal(events.complete.length, 4);
  assert.deepEqual(await Promise.all(events.complete.map(blob => blob.text())), [
    'segment 1', 'segment 2', 'segment 3', 'segment 4',
  ]);
  assert.equal(SPEECH_SEGMENT_MS, 30000);
  assert.equal(events.failures.length, 0);
});

test('stopping between segment boundaries includes the final part and prevents further recording', async t => {
  const { session, events } = setup(t);
  session.start();
  t.mock.timers.tick(SPEECH_SEGMENT_MS);
  t.mock.timers.tick(SPEECH_SEGMENT_MS);
  t.mock.timers.tick(1000);
  session.stop();
  t.mock.timers.tick(MAX_SPEECH_RECORDING_MS);
  assert.equal(FakeRecorder.instances.length, 3);
  assert.equal(events.complete.length, 3);
  assert.equal(events.stopped, 1);
});

test('cancel discards only an explicitly abandoned recording and releases the microphone', t => {
  const { session, events } = setup(t);
  session.start();
  t.mock.timers.tick(SPEECH_SEGMENT_MS);
  session.cancel();
  t.mock.timers.tick(MAX_SPEECH_RECORDING_MS);
  assert.equal(events.complete, null);
  assert.equal(events.stopped, 1);
  assert.equal(events.failures.length, 0);
});

test('recording error releases capture and does not falsely submit a partial answer', t => {
  const { session, events } = setup(t);
  session.start();
  const error = new Error('device error');
  FakeRecorder.instances[0].onerror({ error });
  assert.equal(events.complete, null);
  assert.equal(events.stopped, 1);
  assert.equal(events.failures[0], error);
});
