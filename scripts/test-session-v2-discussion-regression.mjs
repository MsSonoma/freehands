import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const SESSION_PAGE = new URL('../src/app/session/v2/SessionPageV2.jsx', import.meta.url);
const DISCUSSION_PHASE = new URL('../src/app/session/v2/DiscussionPhase.jsx', import.meta.url);

test('Session V2 does not render retired Discussion sentence controls', async () => {
  const [sessionSource, discussionSource] = await Promise.all([
    readFile(SESSION_PAGE, 'utf8'),
    readFile(DISCUSSION_PHASE, 'utf8'),
  ]);

  assert.match(
    discussionSource,
    /V2 Simplified/,
    'regression test assumes the production simplified DiscussionPhase architecture',
  );
  assert.doesNotMatch(
    sessionSource,
    /\bdiscussionSentenceInfo\b/,
    'SessionPageV2 must not reference removed Discussion sentence state',
  );
  assert.doesNotMatch(
    sessionSource,
    /discussionPhaseRef\.current\?\.nextSentence\(/,
    'SessionPageV2 must not call retired DiscussionPhase.nextSentence()',
  );
  assert.doesNotMatch(
    sessionSource,
    /discussionPhaseRef\.current\.repeatCurrentSentence\(/,
    'SessionPageV2 must not call retired DiscussionPhase.repeatCurrentSentence()',
  );
});
