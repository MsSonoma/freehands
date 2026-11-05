import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  caretContrastColor,
  measureSonomaTextCaret,
  visibleCaretIndicator,
} from '../sonomaCaretIndicator.mjs';

test('caret colors stay readable on pale and dark text inputs', () => {
  assert.equal(caretContrastColor('rgb(255, 255, 255)'), '#b42318');
  assert.equal(caretContrastColor('rgba(0, 0, 0, 1)'), '#fde68a');
  assert.equal(caretContrastColor('rgb(30, 41, 59)'), '#fde68a');
  assert.equal(caretContrastColor('rgba(244, 235, 220, .9)'), '#b42318');
  assert.equal(caretContrastColor('transparent'), '#b42318');
});

test('indicator stays visible within the input and above the keyboard', () => {
  const rect = { left: 12, right: 380, top: 100, bottom: 225 };
  const bounds = { viewportWidth: 390, viewportHeight: 700, keyboardTop: 400 };
  assert.deepEqual(visibleCaretIndicator({ x: 130, y: 140, height: 24 }, rect, bounds),
    { left: 130, top: 140, height: 24 });
  assert.deepEqual(visibleCaretIndicator({ x: 480, y: 260, height: 24 }, rect, bounds),
    { left: 377, top: 199, height: 24 });
  assert.deepEqual(visibleCaretIndicator({ x: -20, y: 30, height: 24 }, rect, bounds),
    { left: 15, top: 102, height: 24 });
});

test('indicator does not cover the keyboard or appear in hidden inputs', () => {
  const rect = { left: 0, right: 400, top: 600, bottom: 700 };
  assert.equal(visibleCaretIndicator({ x: 40, y: 660, height: 24 }, rect,
    { viewportWidth: 400, viewportHeight: 750, keyboardTop: 530 }), null);
  assert.equal(visibleCaretIndicator(null, rect), null);
  assert.equal(measureSonomaTextCaret(null, 4), null);
  assert.equal(measureSonomaTextCaret({ isConnected: false }, 4), null);
});

test('spacebar trackpad shows and clears a noninteractive caret marker without changing learner text', () => {
  const source = readFileSync(new URL('../SonomaKeyboard.jsx', import.meta.url), 'utf8');
  assert.match(source, /showCaretIndicator\(field, startCaret\)/);
  assert.match(source, /showCaretIndicator\(field, caret\)/);
  assert.match(source, /if \(wasTrackpad\) lingerCaretIndicator\(\)/);
  assert.match(source, /clearCaretIndicator\(\)/);
  assert.match(source, /data-sonoma-caret-indicator aria-hidden="true"/);
  assert.match(source, /pointerEvents:"none"/);
  assert.match(source, /zIndex:2147483647/);
  assert.match(source, /field\.style\.caretColor = caretContrastColor/);
  assert.match(source, /field\.style\.caretColor = previous/);
  assert.match(source, /field\.dataset\?\.sonomaPin !== undefined/);
  assert.match(source, /field\.setSelectionRange\(caret, caret\)/);
});
