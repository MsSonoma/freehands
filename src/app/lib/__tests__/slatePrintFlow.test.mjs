import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAssessmentPrintHtml, printAssessmentWindow } from '../../session/assessment/printHtml.mjs'
import { slateLiftoffPrintableTestItems } from '../slateLiftoffTest.mjs'

test('Slate test print HTML contains learner questions and choices, not answer keys or downloads', () => {
  const items = slateLiftoffPrintableTestItems([
    { question: 'What is 2 < 3 & 5 > 4?', choices: [{ letter: 'A', text: 'Yes' }, { letter: 'B', text: 'No' }], correct: 'A' },
    { question: 'The sky is blue.', answer: true },
    { question: 'Fill ____', expected: 'hidden answer' },
  ])
  const html = buildAssessmentPrintHtml({ items, lessonTitle: 'Math & Logic' })
  assert.match(html, /Math &amp; Logic Test/)
  assert.match(html, /What is 2 &lt; 3 &amp; 5 &gt; 4/)
  assert.match(html, /<ol class="choices" type="A">/)
  assert.match(html, /<li>Yes<\/li><li>No<\/li>/)
  assert.match(html, /True\/False: The sky is blue\./)
  assert.match(html, /id="print-assessment"/)
  assert.match(html, /@media print/)
  assert.doesNotMatch(html, /hidden answer|href=|download=/i)
})

test('Slate print window opens the browser print dialog and retains a manual print button', () => {
  let html = ''
  let printed = 0
  let manualPrint
  const previewWin = {
    closed: false,
    focus() {},
    print() { printed += 1 },
    document: {
      readyState: 'complete',
      open() {},
      write(text) { html = text },
      close() {},
      getElementById(id) {
        assert.equal(id, 'print-assessment')
        return { addEventListener(event, handler) {
          assert.equal(event, 'click')
          manualPrint = handler
        } }
      },
    },
  }
  printAssessmentWindow({ previewWin, items: [{ prompt: 'Question one' }] })
  assert.match(html, /Question one/)
  assert.equal(printed, 1)
  manualPrint()
  assert.equal(printed, 2)
})

test('Slate printing waits for the document to load when the print window is still loading', () => {
  let loaded
  let printed = 0
  const previewWin = {
    closed: false,
    focus() {},
    print() { printed += 1 },
    addEventListener(event, callback, options) {
      assert.equal(event, 'load')
      assert.deepEqual(options, { once: true })
      loaded = callback
    },
    document: {
      readyState: 'loading', open() {}, write() {}, close() {},
      getElementById() { return { addEventListener() {} } },
    },
  }
  printAssessmentWindow({ previewWin })
  assert.equal(printed, 0)
  loaded()
  assert.equal(printed, 1)
})
