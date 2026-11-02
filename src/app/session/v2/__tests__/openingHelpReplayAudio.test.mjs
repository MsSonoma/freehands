import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../OpeningActionsController.jsx', import.meta.url), 'utf8')
  .replace(/^import [^\n]+\n/gm, '')
  .replace('export class OpeningActionsController', 'class OpeningActionsController');

function harness({ tts = async text => `audio:${text}` } = {}) {
  const main = { played: [], stopCount: 0, async playAudio(_audio, texts) { this.played.push(texts[0]); }, stop() { this.stopCount += 1; } };
  const help = { played: [], stopCount: 0, async playAudio(_audio, texts) { this.played.push(texts[0]); }, stop() { this.stopCount += 1; } };
  const api = { on() {}, emit() {} };
  const Module = new Function('fetchTTS', 'getGradeAndDifficultyStyle', 'buildSenseMakingGuidance',
    'buildLearnerLanguageGuidance', 'fallbackComprehensionDiagnostic', 'SENSE_MAKING_MODES',
    'LEARNER_LANGUAGE_MODES', source + '\nreturn OpeningActionsController;')(
    tts, () => '', () => '', () => '', () => ({}), {}, {},
  );
  return { main, help, controller: new Module(api, main, { studyAudioEngine: help, phase: 'discussion' }) };
}

test('Ask uses only help playback, preserves sentence history, and replays without a new AI turn', async () => {
  const { main, help, controller } = harness();
  const fetchBefore = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return { ok: true, json: async () => ({ reply: 'The moon reflects light. It does not make its own light.' }) };
  };
  try {
    await controller.startAsk();
    const result = await controller.submitAskQuestion('Why is the moon bright?');
    assert.equal(result.success, true);
    assert.equal(main.played.length, 0, 'main lesson engine never narrates Ask');
    assert.equal(calls, 1);
    const history = controller.getState().data.history;
    assert.deepEqual(history.filter(turn => turn.role === 'assistant').map(turn => turn.content), [
      'The moon reflects light. It does not make its own light.', 'Do you have any more questions?',
    ]);
    assert.equal(controller.replayHelpSentence('It does not make its own light.'), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(help.played.at(-1), 'It does not make its own light.');
    assert.equal(calls, 1, 'replay is TTS only, never a new model call');
    assert.equal(controller.replayHelpSentence('Why is the moon bright?'), false, 'learner question is not replayed as Ms. Sonoma');
  } finally {
    controller.completeAsk();
    globalThis.fetch = fetchBefore;
  }
});

test('a new Study replay cancels an older pending TTS request', async () => {
  let resolveOriginal;
  let originalText = '';
  const { main, help, controller } = harness({ tts: text => {
    if (!resolveOriginal) {
      originalText = text;
      return new Promise(resolve => { resolveOriginal = resolve; });
    }
    return Promise.resolve(`audio:${text}`);
  }});
  controller.startStudy({ type: 'vocabulary', term: 'gravity', definition: 'a pulling force' });
  await controller.submitStudyMessage('', {}, { mode: 'understood' });
  assert.match(originalText, /glad that makes more sense/i);
  assert.equal(controller.replayHelpSentence("I'm glad that makes more sense."), true);
  await new Promise(resolve => setImmediate(resolve));
  const played = [...help.played];
  resolveOriginal('audio:stale');
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(help.played, played, 'late original speech must not restart');
  assert.equal(main.played.length, 0, 'study speech cannot start the lesson engine');
  controller.completeStudy();
});

test('closing a help action cancels TTS that has not finished loading', async () => {
  let resolveTTS;
  const { help, controller } = harness({ tts: () => new Promise(resolve => { resolveTTS = resolve; }) });
  controller.startStudy({ type: 'vocabulary', term: 'planet' });
  await controller.submitStudyMessage('', {}, { mode: 'understood' });
  controller.completeStudy();
  resolveTTS('late-speech');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(help.played.length, 0);
});

test('Study response and replay stay on the help audio engine', async () => {
  const { main, help, controller } = harness();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ reply: 'Gravity pulls things toward Earth. That is why things fall.' }) });
  try {
    controller.startStudy({ type: 'vocabulary', term: 'gravity', definition: 'a pull' });
    const result = await controller.submitStudyMessage('How does it work?', {}, { mode: 'typed' });
    assert.equal(result.success, true);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(help.played, ['Gravity pulls things toward Earth. That is why things fall.']);
    assert.equal(controller.replayHelpSentence('That is why things fall.'), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(help.played.at(-1), 'That is why things fall.');
    assert.equal(main.played.length, 0);
  } finally {
    controller.completeStudy();
    globalThis.fetch = originalFetch;
  }
});

test('session presentation routes teacher sentence taps to help replay, without starting main transcript replay', () => {
  const page = readFileSync(new URL('../SessionPageV2.jsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../StudyPanel.jsx', import.meta.url), 'utf8');
  assert.match(panel, /<HelpReplaySentence/);
  assert.match(page, /onReplaySentence=\{\(sentence\) => openingActionsControllerRef\.current\?\.replayHelpSentence\(sentence\)\}/);
  assert.match(page, /<HelpReplaySentence key=\{sentenceIndex\}/);
  assert.match(page, /stopTranscriptReplayAudio\(\)/);
  assert.match(page, /const onHelpAudioStart = \(\) => \{/);
  assert.match(page, /mainAudio\.pause\(\)/);
  assert.ok(page.includes("if (token === askExitAudioTokenRef.current)"));
});
