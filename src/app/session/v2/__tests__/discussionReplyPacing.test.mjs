import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { splitSonomaDiscussionReply } from '../splitSonomaDiscussionReply.mjs';

const source = fs.readFileSync(new URL('../DiscussionPhase.jsx', import.meta.url), 'utf8')
  .replace(/^import .*;\s*$/gm, '')
  .replace('export class DiscussionPhase', 'class DiscussionPhase') + '\nthis.DiscussionPhase = DiscussionPhase;';

function harness(reply = 'That is correct! What should happen next?') {
  const listeners = new Map();
  const events = [];
  const audioListeners = new Set();
  const audio = {
    played: [],
    on(event, fn) { if (event === 'end') audioListeners.add(fn); },
    off(event, fn) { if (event === 'end') audioListeners.delete(fn); },
    stop() {},
    async playAudio(_audio, lines) { this.played.push(lines[0]); },
    end() { for (const fn of [...audioListeners]) fn({ completed: true }); },
  };
  const bus = {
    emit(type, data) { events.push({ type, data }); for (const fn of listeners.get(type) || []) fn(data); },
    on(type, fn) { const callbacks = listeners.get(type) || []; callbacks.push(fn); listeners.set(type, callbacks); return () => {}; },
  };
  const context = {
    fetchTTS: async () => 'audio',
    splitSonomaDiscussionReply,
    buildInstructionalLessonView: lesson => lesson,
    console,
    fetch: async (url, options) => {
      const action = JSON.parse(options.body).action;
      return {
        ok: true,
        json: async () => url.includes('webb-objectives')
          ? (action === 'generate' ? { objectives: ['Explain science'] } : { newlyCompleted: [] })
          : (action === 'overview' ? { text: 'Welcome to science.' } : { text: reply }),
      };
    },
  };
  vm.runInNewContext(source, context, { filename: 'DiscussionPhase.jsx' });
  const make = (extra = {}) => new context.DiscussionPhase({ audioEngine: audio, eventBus: bus, lessonData: { title: 'Science' }, resumeHistory: [{ role: 'assistant', content: 'Hello' }], ...extra });
  return { audio, events, make };
}

test('feedback pauses before a concealed next question, and Next does not grade', async () => {
  const { audio, events, make } = harness();
  const phase = make();
  await phase.prefetch();
  phase.start();
  assert.equal(phase.state, 'chatting');
  await phase.submitMessage('Science answer');
  assert.equal(phase.state, 'playing-reply-feedback');
  assert.equal(phase.activeReplySegmentText, 'That is correct!');
  assert.equal(events.filter(e => e.type === 'discussionMessage' && e.data.text.includes('What should')).length, 0);
  audio.end();
  assert.equal(phase.state, 'awaiting-next');
  assert.equal(phase.replyCheckpoint.stage, 'awaiting-next');
  phase.nextReplyPart();
  assert.equal(phase.state, 'playing-reply-question');
  assert.equal(phase.activeReplySegmentText, 'What should happen next?');
  assert.equal(events.filter(e => e.type === 'discussionMessage' && e.data.text.includes('What should')).length, 1);
  await new Promise(resolve => setImmediate(resolve)); // Let question TTS install its listener.
  audio.end();
  assert.equal(phase.state, 'chatting');
  assert.equal(phase.replyCheckpoint.stage, 'question-complete');
  assert.equal(events.filter(e => e.type === 'discussionObjectiveComplete').length, 0);
});

test('raising a hand during feedback preserves Next and restart resumes the pause', async () => {
  const { make } = harness();
  const phase = make();
  await phase.prefetch();
  phase.start();
  await phase.submitMessage('Answer');
  phase.pauseForHelp();
  assert.equal(phase.state, 'awaiting-next');
  const checkpoint = phase.replyCheckpoint;
  const resumed = make({ resumeReplyCheckpoint: checkpoint, resumeHistory: [{ role: 'assistant', content: checkpoint.feedback }] });
  await resumed.prefetch();
  resumed.start();
  assert.equal(resumed.state, 'awaiting-next');
  assert.equal(resumed.activeReplySegmentText, checkpoint.feedback);
  resumed.nextReplyPart();
  assert.equal(resumed.state, 'playing-reply-question');
});

test('question-stage help retains the question rather than advancing', async () => {
  const { make, audio } = harness();
  const phase = make();
  await phase.prefetch();
  phase.start();
  await phase.submitMessage('Answer');
  audio.end();
  phase.nextReplyPart();
  phase.pauseForHelp();
  assert.equal(phase.state, 'chatting');
  assert.equal(phase.activeReplySegmentText, 'What should happen next?');
  assert.equal(phase.replyCheckpoint.stage, 'question-complete');
});
