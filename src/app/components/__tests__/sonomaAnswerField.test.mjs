import test from 'node:test';
import assert from 'node:assert/strict';
import { resizeSonomaAnswerField, isSonomaSubmitTarget } from '../sonomaAnswerField.mjs';

test('auto-growing answer follows complete text height without inner scrolling', () => {
  const field = { style: {}, scrollHeight: 92, offsetHeight: 44, clientHeight: 42 };
  assert.equal(resizeSonomaAnswerField(field), 94);
  assert.equal(field.style.height, '94px');
  assert.equal(field.style.overflowY, 'hidden');
  assert.equal(field.style.resize, 'none');
  field.scrollHeight = 155;
  assert.equal(resizeSonomaAnswerField(field), 157);
  field.scrollHeight = 42;
  assert.equal(resizeSonomaAnswerField(field), 44);
});

test('sending does not trigger the global keyboard-dismiss gesture', () => {
  assert.equal(isSonomaSubmitTarget({ closest: selector => selector.includes('[data-sonoma-submit]') ? {} : null }), true);
  assert.equal(isSonomaSubmitTarget({ closest: () => null }), false);
  assert.equal(isSonomaSubmitTarget(null), false);
});
