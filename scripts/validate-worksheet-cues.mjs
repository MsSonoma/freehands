// Quick local validator for worksheet cue detection logic.
// Mirrors the normalization used in src/app/session/page.js for worksheet judging.
import { WORKSHEET_CUE_VARIANTS } from '../src/app/session/constants/worksheetCues.js';

function norm(s = '') {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesNormalized(haystack, needle) {
  const H = norm(haystack);
  const N = norm(needle);
  return H.includes(N);
}

function cueDetected(body) {
  return WORKSHEET_CUE_VARIANTS.some((p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(body));
}

// Sample current and next questions (with a math symbol in next)
const currQ = 'What is 3 x 4?';
const nextQ = 'What is 9 × 2?'; // note the times symbol

// Test cases simulate a correct flow response with variations in punctuation and symbol usage.
const tests = [
  {
    name: 'Exact cue plus next question, period instead of question mark',
    reply: `Correct! Next worksheet question. Nice thinking. ${nextQ.replace('?', '.')}`,
    expectAdvance: true,
  },
  {
    name: 'Different allowed cue variant and includes next question',
    reply: `You got it. Here's the next worksheet question. Keep it up. ${nextQ}`,
    expectAdvance: true,
  },
  {
    name: 'Cue present but re-asks current instead of next',
    reply: `Nice job! On to the next worksheet question. ${currQ}`,
    expectAdvance: false,
  },
  {
    name: 'No cue phrase, but includes next question',
    reply: `Great thinking. ${nextQ}`,
    expectAdvance: false,
  },
];

for (const t of tests) {
  const body = t.reply;
  const nextPresent = includesNormalized(body, nextQ);
  const currPresent = includesNormalized(body, currQ);
  const hasCue = cueDetected(body);
  const willAdvance = hasCue && nextPresent && !currPresent;
  const pass = willAdvance === t.expectAdvance;
  console.log(`${pass ? 'PASS' : 'FAIL'} - ${t.name}`);
  if (!pass) {
    console.log({ hasCue, nextPresent, currPresent, willAdvance, expect: t.expectAdvance, body });
  }
}
