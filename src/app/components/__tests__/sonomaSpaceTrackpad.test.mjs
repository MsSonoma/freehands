import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPACE_TRACKPAD_HOLD_MS,
  isShortSpaceTap,
  trackpadCaretFromDrag,
  trackpadVisualRows,
} from '../sonomaSpaceTrackpad.mjs';

const caret = (value, startCaret, deltaX, deltaY, wrapColumns = 0) =>
  trackpadCaretFromDrag({ value, startCaret, deltaX, deltaY, wrapColumns });

test('a quick stationary release is a tap; moving the finger is not', () => {
  assert.equal(SPACE_TRACKPAD_HOLD_MS >= 250, true);
  assert.equal(isShortSpaceTap(40, 20, 46, 25), true);
  assert.equal(isShortSpaceTap(40, 20, 58, 20), false);
  assert.equal(isShortSpaceTap(40, 20, 40, 39), false);
});

test('dragging left and right moves the insertion cursor without changing text', () => {
  const value = 'we love learning';
  assert.equal(caret(value, 8, 24, 0), 10);
  assert.equal(caret(value, 8, -36, 0), 5);
  assert.equal(caret(value, 8, 0, 0), 8);
  assert.equal(caret(value, 8, 144, 0), value.length);
  assert.equal(caret(value, 8, -144, 0), 0);
});

test('small finger jitter does not move the cursor', () => {
  assert.equal(caret('abcdef', 3, 5, 8), 3);
  assert.equal(caret('abcdef', 3, -11, -20), 3);
});

test('vertical movement moves between typed lines at a consistent column', () => {
  const text = 'one\ntwelve\nabc';
  assert.deepEqual(trackpadVisualRows(text), [
    { start: 0, end: 3 },
    { start: 4, end: 10 },
    { start: 11, end: 14 },
  ]);
  assert.equal(caret(text, 7, 0, 24), 14);
  assert.equal(caret(text, 7, 0, -24), 3);
  assert.equal(caret(text, 7, -12, 24), 13);
});

test('wrapped textarea rows can be traversed without producing invalid offsets', () => {
  const text = 'abcdefghijk';
  assert.deepEqual(trackpadVisualRows(text, 4), [
    { start: 0, end: 4 },
    { start: 4, end: 8 },
    { start: 8, end: 11 },
  ]);
  assert.equal(caret(text, 2, 0, 48, 4), 10);
  assert.equal(caret(text, 9, 24, -24, 4), 7);
  assert.equal(caret(text, 11, 0, 24, 4), 11);
});

test('empty fields, newlines, and nonfinite pointer deltas are safe', () => {
  assert.equal(caret('', 0, 120, 30), 0);
  assert.equal(caret('a\n', 2, -12, -24), 0);
  assert.equal(trackpadCaretFromDrag({ value: 'hello', startCaret: 2, deltaX: NaN }), 2);
});

test('shared keyboard connects Space pointer lifecycle without changing other keys', async () => {
  const { readFileSync } = await import('node:fs');
  const keyboard = readFileSync(new URL('../SonomaKeyboard.jsx', import.meta.url), 'utf8');
  assert.match(keyboard, /onPointerDown=\{key === "Space" \? handleSpacePointerDown :/);
  assert.match(keyboard, /onPointerMove=\{key === "Space" \? handleSpacePointerMove/);
  assert.match(keyboard, /onPointerUp=\{key === "Space" \? handleSpacePointerUp/);
  assert.match(keyboard, /onPointerCancel=\{key === "Space" \? handleSpacePointerCancel/);
  assert.match(keyboard, /onLostPointerCapture=\{key === "Space" \? handleSpacePointerCancel/);
  assert.match(keyboard, /onClick=\{key === "Space" \? handleSpaceClick : \(\) => press\(key\)\}/);
  assert.match(keyboard, /const shouldInsertSpace = gesture\.mode !== "trackpad" &&/);
  assert.match(keyboard, /if \(shouldInsertSpace\) press\("Space"\)/);
  assert.match(keyboard, /suppressSpaceClickRef\.current = true/);
  assert.match(keyboard, /if \(event\.detail !== 0 && suppressSpaceClickRef\.current\)/);
  assert.match(keyboard, /touchAction:"none"/);
  assert.match(keyboard, /setPointerCapture\(event\.pointerId\)/);
  assert.match(keyboard, /cancelSpaceGesture\(\)/);
  assert.match(keyboard, /"move cursor"/);
  assert.match(keyboard, /entry\?\.layout === "pin"/);
  assert.match(keyboard, /field\.setSelectionRange\(caret, caret\)/);
});
