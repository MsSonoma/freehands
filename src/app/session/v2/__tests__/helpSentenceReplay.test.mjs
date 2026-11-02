import test from 'node:test';
import assert from 'node:assert/strict';
import { splitHelpSentences, replayableHelpHistory } from '../helpSentenceReplay.mjs';

test('Ask and Study split teacher responses into replayable sentences', () => {
  assert.deepEqual(splitHelpSentences('The Earth rotates. This causes day and night! Why does that happen?'), [
    'The Earth rotates.', 'This causes day and night!', 'Why does that happen?',
  ]);
});

test('learner entries do not become teacher replay targets', () => {
  assert.deepEqual(replayableHelpHistory([
    { role: 'user', content: 'How does it work?' },
    { role: 'assistant', content: 'It spins. It turns.' },
    { role: 'user', content: 'Can you repeat?' },
  ]).map(x => x.text), ['It spins.', 'It turns.']);
});
