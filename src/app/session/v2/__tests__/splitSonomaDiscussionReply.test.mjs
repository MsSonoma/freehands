import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSonomaDiscussionReply as split } from '../splitSonomaDiscussionReply.mjs';

test('separates feedback from the next question without losing words', () => {
  const original = 'That is correct! Now, what would happen if the sun disappeared?';
  const result = split(original);
  assert.deepEqual(result, { feedback: 'That is correct!', question: 'Now, what would happen if the sun disappeared?' });
  assert.equal(`${result.feedback} ${result.question}`, original);
});
test('preserves question-only and feedback-only responses', () => {
  assert.equal(split('What is a planet?'), null);
  assert.equal(split('Excellent explanation. You remembered the order.'), null);
});
test('splits transitional question in one sentence', () => {
  assert.deepEqual(split('You are right, now why does that happen?'), { feedback: 'You are right', question: 'now why does that happen?' });
});

test('splits direct question after feedback', () => {
  assert.deepEqual(split('You are correct, what changes next?'), { feedback: 'You are correct', question: 'what changes next?' });
});
