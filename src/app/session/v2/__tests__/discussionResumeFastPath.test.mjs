import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { splitSonomaDiscussionReply } from '../splitSonomaDiscussionReply.mjs';
import { restoreDiscussionObjectivePlan } from '../restoreDiscussionObjectivePlan.mjs';

const source = readFileSync(new URL('../DiscussionPhase.jsx', import.meta.url), 'utf8')
  .replace(/^import .*;\s*$/gm, '')
  .replace('export class DiscussionPhase', 'class DiscussionPhase') + '\nthis.DiscussionPhase = DiscussionPhase;';
const pageSource = readFileSync(new URL('../SessionPageV2.jsx', import.meta.url), 'utf8');

function setup({ history = [{ role: 'assistant', content: 'The prior question.' }], objectives = [], clues = [], completed = [],
  sentenceKey = null, checkpoint = null, fetchMode = 'fail' } = {}) {
  const requests = [];
  const speech = [];
  const events = [];
  const context = {
    splitSonomaDiscussionReply,
    buildInstructionalLessonView: lesson => lesson,
    console,
    fetchTTS: async text => { speech.push(text); return 'tts'; },
    fetch: async (url, params) => {
      const body = JSON.parse(params.body);
      requests.push({ url, action: body.action });
      if (fetchMode === 'fail') throw new Error('No network permitted on saved chat fast resume');
      return {
        ok: true,
        json: async () => url.includes('webb-objectives')
          ? { objectives: ['An objective generated after resume'], clues: ['Generated goal'] }
          : { text: 'First overview sentence. Second overview sentence.' },
      };
    },
  };
  vm.runInNewContext(source, context);
  const audioEnd = new Set();
  const audio = {
    on(event, callback) { if (event === 'end') audioEnd.add(callback); },
    off(event, callback) { if (event === 'end') audioEnd.delete(callback); },
    stop() {},
    async playAudio(audioData, lines) { speech.push(`play:${lines[0]}`); },
  };
  const bus = { emit(name, payload) { events.push({ name, payload }); }, on() { return () => {}; } };
  const phase = new context.DiscussionPhase({
    audioEngine: audio, eventBus: bus, lessonData: { title: 'Science' },
    resumeHistory: history, resumeObjectives: objectives, resumeObjectiveClues: clues,
    resumeCompletedIndices: completed, resumeSentenceKey: sentenceKey, resumeReplyCheckpoint: checkpoint,
  });
  return { phase, requests, speech, events };
}

test('saved chat resumes to an available input without network, overview, or TTS', async () => {
  const { phase, requests, speech, events } = setup({
    objectives: ['Describe evaporation', 'Explain rain'],
    clues: ['Water into vapor', 'Water from clouds'], completed: [0],
  });
  await phase.prefetch();
  assert.equal(phase.state, 'ready');
  phase.start();
  assert.equal(phase.state, 'chatting');
  assert.equal(phase.completedObjectives, 1);
  assert.deepEqual(Array.from(phase.objectivePlan.objectives), ['Describe evaporation', 'Explain rain']);
  assert.deepEqual(Array.from(phase.objectivePlan.objectiveClues), ['Water into vapor', 'Water from clouds']);
  assert.equal(requests.length, 0);
  assert.equal(speech.length, 0);
  assert.ok(events.some(event => event.name === 'learnerTurnReady' && event.payload.turnKind === 'discussion-resume'));
  phase.destroy();
});

test('saved feedback/Next checkpoint restores immediately without replaying previous grading', async () => {
  const checkpoint = { stage: 'awaiting-next', feedback: 'Good reasoning.', question: 'What changes next?' };
  const { phase, requests, speech } = setup({ objectives: ['Describe evaporation'],
    checkpoint, history: [{ role: 'assistant', content: 'Good reasoning.' }] });
  await phase.prefetch();
  phase.start();
  assert.equal(phase.state, 'awaiting-next');
  assert.equal(phase.replyCheckpoint.question, checkpoint.question);
  assert.equal(requests.length, 0);
  assert.equal(speech.length, 0);
  phase.destroy();
});

test('unanswered learner turn still waits for explicit retry rather than duplicating response', async () => {
  const { phase, requests } = setup({ objectives: ['Describe evaporation'],
    history: [{ role: 'assistant', content: 'Why?' }, { role: 'user', content: 'Because water heats.' }] });
  await phase.prefetch(); phase.start();
  assert.equal(phase.state, 'reply-unavailable');
  assert.equal(requests.length, 0);
  phase.destroy();
});

test('legacy saved chat fetches goals only, not introductory overview or TTS', async () => {
  const { phase, requests, speech } = setup({ fetchMode: 'success', completed: [0] });
  await phase.prefetch(); phase.start();
  assert.equal(phase.state, 'chatting');
  assert.equal(phase.completedObjectives, 0, 'Old indexes cannot award new generated goals');
  assert.deepEqual(requests.map(request => request.action), ['generate']);
  assert.equal(speech.length, 0);
  phase.destroy();
});

test('sentence-level resume still prepares the original playback sequence', async () => {
  const { phase, requests, speech } = setup({ fetchMode: 'success',
    sentenceKey: 'ov:1', objectives: ['Explain rain'], clues: ['From clouds'] });
  await phase.prefetch(); phase.start();
  assert.equal(phase.state, 'playing-overview');
  assert.deepEqual(requests.map(request => request.action), ['overview']);
  assert.ok(speech.length > 0);
  phase.destroy();
});

test('saved goal plan keeps credits only when every index belongs to that plan', () => {
  const valid = restoreDiscussionObjectivePlan({
    objectives: ['First goal', 'Second goal'], objectiveClues: ['Hint A', 'Hint B'],
    completedObjectiveIndices: [0, 1, 1],
  });
  assert.deepEqual(valid.completedObjectiveIndices, [0, 1]);
  assert.deepEqual(valid.legacyUnmappedCompletedObjectiveIndices, []);
  const legacy = restoreDiscussionObjectivePlan({ completedObjectiveIndices: [1, 4] });
  assert.deepEqual(legacy.completedObjectiveIndices, []);
  assert.deepEqual(legacy.legacyUnmappedCompletedObjectiveIndices, [1, 4]);
  const mismatch = restoreDiscussionObjectivePlan({ objectives: ['Only one'], completedObjectiveIndices: [0, 2] });
  assert.deepEqual(mismatch.completedObjectiveIndices, []);
  assert.deepEqual(mismatch.legacyUnmappedCompletedObjectiveIndices, [0, 2]);
});

test('Discussion listeners are installed before a synchronous ready event, and goal plan is saved', () => {
  const listen = pageSource.indexOf("const unsubStateChange = eventBusRef.current.on('discussionStateChange'");
  const prefetch = pageSource.indexOf('void phase.prefetch();', listen);
  const end = pageSource.indexOf('  // Start teaching phase', listen);
  assert.ok(listen !== -1 && prefetch > listen && prefetch < end);
  assert.match(pageSource, /saveProgress\('discussion-objective-plan'/);
  assert.match(pageSource, /legacyUnmappedObjectiveAnnouncements: /);
  assert.match(pageSource, /resumeObjectives: savedGoalPlan.objectives/);
});
