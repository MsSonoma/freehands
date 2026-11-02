import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sonoma = readFileSync(new URL('../SessionPageV2.jsx', import.meta.url), 'utf8');
const webb = readFileSync(new URL('../../webb/page.jsx', import.meta.url), 'utf8');

test('Sonoma objective hint requests a verified PIN before unlocking full goals', () => {
  assert.match(sonoma, /const unlockDiscussionObjectives = useCallback/);
  assert.match(sonoma, /const pin = await requestFacilitatorPinException/);
  assert.match(sonoma, /if \(pin\) setShowFullDiscussionObjectives\(true\)/);
  assert.match(sonoma, /!showFullDiscussionObjectives && !done\) void unlockDiscussionObjectives\(\)/);
  assert.match(sonoma, /showFullDiscussionObjectives && !done &&/);
  assert.match(sonoma, /facilitatorFulfillDiscussionObjective\(i\)/);
  assert.match(sonoma, /setShowFullDiscussionObjectives\(false\)/);
});

test('Webb objective hint requires the same PIN and facilitator-only fulfillment panel', () => {
  assert.match(webb, /async function unlockWebbObjectives\(\)/);
  assert.match(webb, /const pin = await requestFacilitatorPinException/);
  assert.match(webb, /if \(pin\) setShowFullObjectives\(true\)/);
  assert.match(webb, /!showFullObjectives && !done\) void unlockWebbObjectives\(\)/);
  assert.match(webb, /showFullObjectives && !done &&/);
  assert.match(webb, /facilitatorFulfillWebbObjective\(i\)/);
  assert.match(webb, /objectiveQueueRef\.current\.invalidate\(\)/);
  assert.match(webb, /setShowFullObjectives\(false\)/);
});
