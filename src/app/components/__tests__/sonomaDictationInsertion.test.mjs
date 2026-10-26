import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { insertDictationAtSelection } from '../sonomaDictationInsertion.mjs';

const keyboard = fs.readFileSync(new URL('../SonomaKeyboard.jsx', import.meta.url), 'utf8');

test('dictation appends without replacing a partially written answer', () => {
  assert.deepEqual(insertDictationAtSelection('I think', 7, 7, 'it is correct'), {
    value: 'I think it is correct', caret: 21, changed: true,
  });
});

test('dictation respects the caret inside a sentence', () => {
  assert.deepEqual(insertDictationAtSelection('The fox', 4, 4, 'quick'), {
    value: 'The quick fox', caret: 9, changed: true,
  });
});

test('dictation replaces selected text without introducing extra spaces', () => {
  assert.deepEqual(insertDictationAtSelection('The old dog.', 4, 7, 'young'), {
    value: 'The young dog.', caret: 9, changed: true,
  });
});

test('dictation respects sentence punctuation and empty audio results', () => {
  assert.equal(insertDictationAtSelection('Hello.', 5, 5, 'there').value, 'Hello there.');
  assert.equal(insertDictationAtSelection('Already here', 0, 0, 'Hi').value, 'Hi Already here');
  assert.deepEqual(insertDictationAtSelection('Unchanged', 2, 5, '   '), {
    value: 'Unchanged', caret: 2, changed: false,
  });
});

test('shared keyboard microphone reuses STT, tracks field identity, and does not submit', () => {
  assert.match(keyboard, /import WebbDictationButton from/);
  assert.match(keyboard, /<WebbDictationButton/);
  assert.match(keyboard, /onBeforeRecord=\{prepareDictation\}/);
  assert.match(keyboard, /onTranscript=\{applyDictation\}/);
  assert.match(keyboard, /field\.selectionStart/);
  assert.match(keyboard, /entry\?\.ref\?\.current !== field/);
  assert.match(keyboard, /entry\.onChange\(result\.value\)/);
  assert.doesNotMatch(keyboard, /submitAnswer|handleSend|onSend\(/);
});
