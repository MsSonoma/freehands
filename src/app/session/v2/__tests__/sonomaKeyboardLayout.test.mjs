import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { measureSonomaLandscapeRoom, resolveSonomaKeyboardClearance } from '../sonomaKeyboardLayout.mjs';

const source = fs.readFileSync(new URL('../SessionPageV2.jsx', import.meta.url), 'utf8');

test('custom keyboard height alone controls its bottom clearance', () => {
  assert.equal(resolveSonomaKeyboardClearance({
    customOpen: true, customHeight: 216, nativeVisible: true, nativeInset: 408,
  }), 216);
  assert.equal(resolveSonomaKeyboardClearance({
    customOpen: true, customHeight: 0, nativeVisible: true, nativeInset: 408,
  }), 0);
});

test('native keyboard is a fallback only when the custom keyboard is closed', () => {
  assert.equal(resolveSonomaKeyboardClearance({nativeVisible: true,nativeInset: 408}),408);
  assert.equal(resolveSonomaKeyboardClearance({nativeVisible: false,nativeInset: 408}),0);
  assert.equal(resolveSonomaKeyboardClearance({customOpen: true,customHeight: -8}),0);
});

test('landscape derives both panel heights from the actual footer and media coordinates', () => {
  assert.equal(measureSonomaLandscapeRoom({mediaTop: 72,footerTop: 540}),464);
  assert.equal(measureSonomaLandscapeRoom({mediaTop: 72,footerTop: 310}),234);
  assert.equal(measureSonomaLandscapeRoom({mediaTop: 72,footerTop: 45}),0);
  assert.equal(measureSonomaLandscapeRoom({mediaTop: NaN,footerTop: 540}),null);
  assert.equal(measureSonomaLandscapeRoom({mediaTop: 72,footerTop: Infinity}),null);
});

test('legacy iPad keyboard collapse ramp and height-dependent column widths are gone', () => {
  assert.doesNotMatch(source, /videoMaxHeight|videoColPercent|sideBySideHeight|msSideBySideH/);
  assert.doesNotMatch(source, /const h = vv\?\.height \|\| layoutH/);
  assert.match(source, /measureSonomaLandscapeRoom\(\{ mediaTop, footerTop \}\)/);
  assert.match(source, /height: landscapeMediaHeight === null/);
  assert.match(source, /flex: '1 1 50%'/);
  assert.match(source, /height: '100%'/);
  assert.match(source, /minHeight: 0/);
});

test('portrait reserves space without compressing the video and duplicate typing context stays hidden', () => {
  assert.match(source, /paddingBottom: `\$\{footerHeight \+ keyboardClearance \+ 12\}px`/);
  assert.match(source, /height: '35vh'/);
  assert.match(source, /flex: '1 0 auto', minHeight: stackedCaptionHeight \|\| '35vh'/);
  assert.match(source, /bottom: keyboardClearance/);
  assert.match(source, /visible=\{!sonomaKeyboard\.active && typingViewport\.keyboardVisible\}/);
  assert.match(source, /useTypingViewport\(\{ preserveTouchFocus: true \}\)/);
});
