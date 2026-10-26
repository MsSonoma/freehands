import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isTranscriptAtEnd, pinTranscriptToEnd } from '../transcriptViewport.mjs';

const captionPanel = fs.readFileSync(new URL('../CaptionPanel.js', import.meta.url), 'utf8');
const session = fs.readFileSync(new URL('../../v2/SessionPageV2.jsx', import.meta.url), 'utf8');

test('reduced transcript height exposes the last line without a new transcript entry', () => {
  const scroller = { scrollHeight: 1000, clientHeight: 280, scrollTop: 720 };
  assert.equal(isTranscriptAtEnd(scroller), true);
  // Sonoma Keyboard opens: the same text has less vertical room.
  scroller.clientHeight = 120;
  assert.equal(isTranscriptAtEnd(scroller), false);
  assert.equal(pinTranscriptToEnd(scroller), true);
  assert.equal(scroller.scrollTop, 880);
  assert.equal(isTranscriptAtEnd(scroller), true);
});

test('pinning the scroller does not scroll the document or an ancestor', () => {
  const outer = { scrollTop: 53 };
  const scroller = { scrollHeight: 520, clientHeight: 100, scrollTop: 200 };
  pinTranscriptToEnd(scroller);
  assert.equal(scroller.scrollTop, 420);
  assert.equal(outer.scrollTop, 53);
});

test('opening and closing the custom keyboard use actual scroll space', () => {
  const scroller = { scrollHeight: 800, clientHeight: 130, scrollTop: 0 };
  pinTranscriptToEnd(scroller);
  assert.equal(scroller.scrollTop, 670);
  scroller.clientHeight = 280;
  pinTranscriptToEnd(scroller);
  assert.equal(scroller.scrollTop, 520);
});

test('pinning handles short transcripts and invalid geometry safely', () => {
  const short = { scrollHeight: 45, clientHeight: 200, scrollTop: 0 };
  assert.equal(pinTranscriptToEnd(short), true);
  assert.equal(short.scrollTop, 0);
  assert.equal(pinTranscriptToEnd(null), false);
  assert.equal(pinTranscriptToEnd({ scrollHeight: NaN, clientHeight: 20 }), false);
  assert.equal(isTranscriptAtEnd({ scrollHeight: NaN, clientHeight: 20, scrollTop: 0 }), false);
});

test('the active Sonoma Keyboard supplies its state and height to the transcript', () => {
  assert.match(session, /keyboardActive=\{Boolean\(sonomaKeyboard\.active\)\}/);
  assert.match(session, /keyboardHeight=\{keyboardClearance\}/);
  assert.match(captionPanel, /keyboardActive = false, keyboardHeight = 0/);
  assert.match(captionPanel, /\[displayItems, keyboardActive, keyboardHeight,/);
});

test('condensed transcript follows its own resize and preserves manual browsing', () => {
  assert.match(captionPanel, /new ResizeObserver\(onResize\)/);
  assert.match(captionPanel, /resizeObserver\?\.observe\(el\)/);
  assert.match(captionPanel, /resizeObserver\?\.observe\(el\.parentElement\)/);
  assert.match(captionPanel, /manualBrowsingRef\.current/);
  assert.match(captionPanel, /!el\.isConnected \|\| \(keyboardActive && manualBrowsingRef\.current\)/);
  assert.match(captionPanel, /!keyboardActive \|\| !followTranscriptEnd \|\| manualBrowsingRef\.current/);
  assert.match(captionPanel, /if \(keyboardActive \|\| !boxRef\?\.current\) return/);
  assert.match(captionPanel, /if \(!keyboardActive\) \{\s*try \{ endRef\.current\?\.scrollIntoView/);
  assert.match(captionPanel, /minHeight: 0/);
  assert.match(captionPanel, /height: keyboardActive \? 'auto' : '100%'/);
});
