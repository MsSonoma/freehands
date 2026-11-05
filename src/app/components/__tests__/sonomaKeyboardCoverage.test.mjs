import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = (relative) => readFileSync(new URL(relative, import.meta.url), 'utf8');
const keyboard = source('../SonomaKeyboard.jsx');
const study = source('../../session/v2/StudyPanel.jsx');
const session = source('../../session/v2/SessionPageV2.jsx');
const secureInput = source('../SonomaPinInput.jsx');
const gate = source('../../lib/pinGate.js');

test('Study opens Sonoma keyboard on touch and focus and suppresses iOS keyboard', () => {
  assert.match(study, /inputMode="none"/);
  assert.match(study, /data-sonoma-input/);
  assert.match(study, /onPointerDown=\{openStudyKeyboard\}/);
  assert.match(study, /onFocus=\{openStudyKeyboard\}/);
  assert.match(study, /layout: 'text'/);
  assert.match(study, /sonomaKeyboard\.closeForInput/);
});

test('Ask and other opening action inputs use Sonoma keyboard on focus, not just tap', () => {
  const matches = session.match(/onFocus=\{\(event\) => openSonomaTextInput\(event, setOpeningActionInput\)\}/g) || [];
  assert.equal(matches.length, 5);
  assert.match(session, /placeholder="Ask Ms\. Sonoma\.\.\."/);
});

test('PIN mode displays digits and backspace without math, dictation, or symbols', () => {
  assert.match(keyboard, /pin: \[\["1","2","3"\]/);
  assert.match(keyboard, /layout !== "pin" && rowIndex/);
  assert.match(keyboard, /getValue.*"function"/);
  assert.match(keyboard, /if \(layout === "pin"\) updated = updated\.replace\(/);
  assert.match(keyboard, /closeForInput/);
  assert.match(secureInput, /inputMode="none"/);
  assert.match(secureInput, /layout: 'pin'/);
  assert.match(secureInput, /type = 'password'/);
  assert.match(secureInput, /replace\(\/\\D\/g, ''\)/);
});

test('DOM PIN gate uses the same Sonoma keypad and keeps the original PIN secret mask', () => {
  assert.match(gate, /input\.inputMode = 'none'/);
  assert.match(gate, /ms:sonoma-keyboard:open/);
  assert.match(gate, /ms:sonoma-keyboard:close/);
  assert.match(gate, /getValue: \(\) => actualValue/);
  assert.match(gate, /input\.value = '•'\.repeat\(actualValue\.length\)/);
  assert.match(gate, /data-sonoma-pin/);
  assert.match(gate, /2147483645/);
  assert.match(keyboard, /zIndex:2147483646/);
});

test('every facilitator PIN entry surface uses the secure numeric Sonoma component', () => {
  for (const path of [
    '../../facilitator/account/page.js',
    '../../learn/FacilitatorPinPrompt.js',
    '../../session/components/SessionTakeoverDialog.jsx',
    '../../facilitator/generator/counselor/SessionTakeoverDialog.jsx',
  ]) {
    const file = source(path);
    assert.match(file, /SonomaPinInput/, path);
    assert.doesNotMatch(file, /inputMode="numeric"[\s\S]{0,120}pinCode/, path);
  }
  const account = source('../../facilitator/account/page.js');
  assert.equal((account.match(/<SonomaPinInput /g)||[]).length, 3);
  const prompt = source('../../learn/FacilitatorPinPrompt.js');
  assert.equal((prompt.match(/<SonomaPinInput/g)||[]).length, 3);
});

test('PIN code remains controlled, masked and server-verified', () => {
  assert.match(secureInput, /onValueChange\?\.\(/);
  assert.match(gate, /const serverOk = await verifyPin\(input\)/);
  assert.match(gate, /-webkit-text-security:disc/);
});
