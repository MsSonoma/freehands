import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isTextEntryElement,
  isTouchLikeDevice,
  measureTypingViewport,
  shouldAutoFocusTextInput,
} from '../useTypingViewport.js'

function fakeWindow({ touch = false, innerWidth = 1024, innerHeight = 768, visualHeight = innerHeight, visualWidth = innerWidth, offsetTop = 0 } = {}) {
  return {
    innerWidth,
    innerHeight,
    navigator: { maxTouchPoints: touch ? 5 : 0 },
    matchMedia: () => ({ matches: touch }),
    visualViewport: { height: visualHeight, width: visualWidth, offsetTop, offsetLeft: 0 },
  }
}

function input(overrides = {}) {
  return { tagName: 'INPUT', type: 'text', disabled: false, readOnly: false, ...overrides }
}

test('touch typing uses the visual viewport and computes the keyboard inset', () => {
  const win = fakeWindow({ touch: true, innerHeight: 768, visualHeight: 360 })
  const state = measureTypingViewport(win, { activeElement: input() })
  assert.equal(state.touchLike, true)
  assert.equal(state.textEntryFocused, true)
  assert.equal(state.typing, true)
  assert.equal(state.visualHeight, 360)
  assert.equal(state.keyboardInset, 408)
})

test('small browser chrome changes are not treated as a keyboard inset', () => {
  const win = fakeWindow({ touch: true, innerHeight: 768, visualHeight: 730 })
  const state = measureTypingViewport(win, { activeElement: input() })
  assert.equal(state.typing, true)
  assert.equal(state.keyboardInset, 0)
})

test('desktop text entry keeps automatic focus convenience without touch typing mode', () => {
  const win = fakeWindow({ touch: false })
  const state = measureTypingViewport(win, { activeElement: input() })
  assert.equal(isTouchLikeDevice(win), false)
  assert.equal(shouldAutoFocusTextInput(win), true)
  assert.equal(state.typing, false)
})

test('touch devices never request automatic software-keyboard focus', () => {
  const win = fakeWindow({ touch: true })
  assert.equal(shouldAutoFocusTextInput(win), false)
})

test('only editable text controls enter typing mode', () => {
  assert.equal(isTextEntryElement(input()), true)
  assert.equal(isTextEntryElement({ tagName: 'TEXTAREA', disabled: false, readOnly: false }), true)
  assert.equal(isTextEntryElement(input({ type: 'checkbox' })), false)
  assert.equal(isTextEntryElement(input({ disabled: true })), false)
  assert.equal(isTextEntryElement({ tagName: 'DIV', isContentEditable: true }), true)
})
