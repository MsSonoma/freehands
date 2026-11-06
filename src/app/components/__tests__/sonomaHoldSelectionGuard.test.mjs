import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SONOMA_CONTROL_HOLD_CLASS,
  isSonomaHoldControlTarget,
  attachSonomaHoldSelectionGuard,
} from '../sonomaHoldSelectionGuard.mjs';

const button = {
  closest: (selector) => selector.includes('button') ? button : null,
};
const text = { closest: () => null };
const customTarget = {
  closest: (selector) => selector.includes('[data-sonoma-game-target]') ? customTarget : null,
};

function fakeDocument() {
  const docEvents = new Map();
  const winEvents = new Map();
  const classes = new Set();
  const add = (map, name, listener) => {
    if (!map.has(name)) map.set(name, new Set());
    map.get(name).add(listener);
  };
  const remove = (map, name, listener) => map.get(name)?.delete(listener);
  const doc = {
    hidden: false,
    documentElement: {
      classList: {
        toggle(name, isOn) { if (isOn) classes.add(name); else classes.delete(name); },
        contains(name) { return classes.has(name); },
      },
    },
    addEventListener(name, listener) { add(docEvents, name, listener); },
    removeEventListener(name, listener) { remove(docEvents, name, listener); },
    defaultView: {
      addEventListener(name, listener) { add(winEvents, name, listener); },
      removeEventListener(name, listener) { remove(winEvents, name, listener); },
    },
  };
  const dispatch = (type, target = text, ids = []) => {
    const event = {
      target,
      changedTouches: ids.map(identifier => ({ identifier })),
      preventDefault() { throw Error('Must never cancel touches or game/button actions'); },
    };
    for (const listener of docEvents.get(type) || []) listener(event);
  };
  const dispatchWindow = (type) => {
    for (const listener of winEvents.get(type) || []) listener();
  };
  return { doc, dispatch, dispatchWindow, classes };
}

test('touch guard activates for buttons or game targets but not lesson text', () => {
  assert.equal(isSonomaHoldControlTarget(button), true);
  assert.equal(isSonomaHoldControlTarget(customTarget), true);
  assert.equal(isSonomaHoldControlTarget(text), false);
  assert.equal(isSonomaHoldControlTarget(null), false);
  const mock = fakeDocument();
  const cleanup = attachSonomaHoldSelectionGuard(mock.doc);
  mock.dispatch('touchstart', text, [1]);
  assert.equal(mock.classes.has(SONOMA_CONTROL_HOLD_CLASS), false);
  mock.dispatch('touchstart', button, [2]);
  assert.equal(mock.classes.has(SONOMA_CONTROL_HOLD_CLASS), true);
  mock.dispatch('touchend', text, [2]);
  assert.equal(mock.classes.has(SONOMA_CONTROL_HOLD_CLASS), false);
  cleanup();
});

test('two held fingers keep selection blocked until both release', () => {
  const mock = fakeDocument();
  const cleanup = attachSonomaHoldSelectionGuard(mock.doc);
  mock.dispatch('touchstart', button, [5]);
  mock.dispatch('touchstart', customTarget, [8]);
  mock.dispatch('touchend', text, [5]);
  assert.equal(mock.classes.has(SONOMA_CONTROL_HOLD_CLASS), true);
  mock.dispatch('touchcancel', text, [8]);
  assert.equal(mock.classes.has(SONOMA_CONTROL_HOLD_CLASS), false);
  cleanup();
});

test('visibility change, page hide, window blur, and unmount all clear the guard', () => {
  const mock = fakeDocument();
  const cleanup = attachSonomaHoldSelectionGuard(mock.doc);
  mock.dispatch('touchstart', button, [3]);
  mock.doc.hidden = true;
  mock.dispatch('visibilitychange');
  assert.equal(mock.classes.has(SONOMA_CONTROL_HOLD_CLASS), false);
  mock.doc.hidden = false;
  mock.dispatch('touchstart', button, [4]);
  mock.dispatchWindow('blur');
  assert.equal(mock.classes.has(SONOMA_CONTROL_HOLD_CLASS), false);
  mock.dispatch('touchstart', button, [6]);
  mock.dispatchWindow('pagehide');
  assert.equal(mock.classes.has(SONOMA_CONTROL_HOLD_CLASS), false);
  mock.dispatch('touchstart', button, [7]);
  cleanup();
  assert.equal(mock.classes.has(SONOMA_CONTROL_HOLD_CLASS), false);
  mock.dispatch('touchstart', button, [9]);
  assert.equal(mock.classes.has(SONOMA_CONTROL_HOLD_CLASS), false);
});

test('global CSS blocks selection only on controls or during a control hold', () => {
  const css = readFileSync(new URL('../../globals.css', import.meta.url), 'utf8');
  assert.match(css, /button, button \*/);
  assert.match(css, /-webkit-user-select: none/);
  assert.match(css, /-webkit-touch-callout: none/);
  assert.match(css, /html\.ms-sonoma-control-held body \*:not\(input\):not\(textarea\):not\(\[contenteditable\]\)/);
  assert.match(css, /html\.ms-sonoma-control-held body textarea/);
  assert.match(css, /-webkit-user-select: text !important/);
  assert.doesNotMatch(css, /^body\s*\{[^}]*user-select:\s*none/m);
});

test('shared keyboard installs the guard; volume and arcade controls remain actionable', () => {
  const keyboard = readFileSync(new URL('../SonomaKeyboard.jsx', import.meta.url), 'utf8');
  assert.match(keyboard, /useEffect\(\(\) => attachSonomaHoldSelectionGuard\(document\), \[\]\)/);
  for (const path of [
    '../../session/components/SonomaBackgroundMusicControl.jsx',
    '../../session/webb/WebbBackgroundMusicControl.jsx',
  ]) {
    const src = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(src, /<button\s+type="button"/);
    assert.match(src, /onPointerDown=\{handlePointerDown\}/);
    assert.match(src, /onClick=\{toggleMusic\}/);
  }
  for (const path of [
    '../../session/components/games/MazeRunner.jsx',
    '../../session/components/games/Snake.jsx',
    '../../session/components/games/PlatformJumper.jsx',
    '../../session/components/games/CatchCollect.jsx',
  ]) {
    const src = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.match(src, /const TouchControls =/);
    assert.match(src, /<button/);
  }
  const whack = readFileSync(new URL('../../session/components/games/WhackAMole.jsx', import.meta.url), 'utf8');
  assert.match(whack, /data-sonoma-game-target/);
  assert.match(whack, /onClick=\{\(\) => whackMole\(index\)\}/);
});
