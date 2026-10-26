import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { isTranscriptTapGesture } from '../sonomaTranscriptGesture.mjs';

const keyboard = fs.readFileSync(new URL('../SonomaKeyboard.jsx', import.meta.url), 'utf8');
const caption = fs.readFileSync(new URL('../../session/components/CaptionPanel.js', import.meta.url), 'utf8');
const webb = fs.readFileSync(new URL('../../session/webb/page.jsx', import.meta.url), 'utf8');
const start = { pointerId: 1, clientX: 90, clientY: 150, scrollTop: 240, dragged: false };

test('a stationary tap on transcript dismisses the open keyboard', () => {
  assert.equal(isTranscriptTapGesture(start, { pointerId: 1, clientX: 90, clientY: 150 }, 240), true);
  assert.equal(isTranscriptTapGesture(start, { pointerId: 1, clientX: 96, clientY: 158 }, 240), true);
});

test('dragging up or down preserves keyboard even without measurable scroll', () => {
  assert.equal(isTranscriptTapGesture(start, { pointerId: 1, clientX: 91, clientY: 166 }, 240), false);
  assert.equal(isTranscriptTapGesture(start, { pointerId: 1, clientX: 90, clientY: 135 }, 240), false);
  assert.equal(isTranscriptTapGesture({ ...start, dragged: true }, { pointerId: 1, clientX: 90, clientY: 150 }, 240), false);
});

test('scrollbar displacement, multi-touch, and invalid gestures do not dismiss', () => {
  assert.equal(isTranscriptTapGesture(start, { pointerId: 1, clientX: 90, clientY: 150 }, 250), false);
  assert.equal(isTranscriptTapGesture(start, { pointerId: 2, clientX: 90, clientY: 150 }, 240), false);
  assert.equal(isTranscriptTapGesture(null, { pointerId: 1, clientX: 90, clientY: 150 }, 240), false);
  assert.equal(isTranscriptTapGesture(start, { pointerId: 1, clientX: NaN, clientY: 150 }, 240), false);
});

test('all three teacher transcripts are marked for gesture-aware dismissal', () => {
  assert.match(caption, /data-ms-caption-panel data-sonoma-transcript/);
  assert.match(caption, /data-sonoma-transcript-scroll/);
  assert.match(caption, /aria-label="Scroll up captions"/);
  assert.match(caption, /aria-label="Scroll down captions"/);
  assert.match(webb, /data-ms-webb-transcript data-sonoma-transcript/);
});

test('the keyboard defers transcript taps until pointerup and ignores scroll controls', () => {
  assert.ok(keyboard.includes('event.target.closest?.("[data-sonoma-transcript-scroll]")'));
  assert.ok(keyboard.includes('event.target.closest?.("[data-sonoma-transcript]")'));
  assert.match(keyboard, /isTranscriptTapGesture\(pending, event, pending\.transcript\.scrollTop\)\) close\(\)/);
  assert.match(keyboard, /document\.addEventListener\("pointermove", onPointerMove\)/);
  assert.match(keyboard, /document\.addEventListener\("pointerup", onPointerUp\)/);
  assert.match(keyboard, /document\.addEventListener\("pointercancel", onPointerCancel\)/);
});
