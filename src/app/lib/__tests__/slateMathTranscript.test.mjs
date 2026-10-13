import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { formatSlateMathTranscript } from '../slateMathTranscript.mjs'
import { buildMathActivityProblem } from '../../../lib/math/mathSession.mjs'

test('formats a complete multi-digit learner result', () => {
  const problem = buildMathActivityProblem({ operation: 'addition', operands: ['5794', '7'], commands: [] })
  const entries = { 'result.thousands': '5', 'result.hundreds': '8', 'result.tens': '0', 'result.ones': '1' }
  assert.equal(formatSlateMathTranscript(problem, entries), '5801')
})

test('preserves a complete wrong answer', () => {
  const problem = buildMathActivityProblem({ operation: 'addition', operands: ['12', '7'], commands: [] })
  assert.equal(formatSlateMathTranscript(problem, { 'result.tens': '1', 'result.ones': '8' }), '18')
})

test('formats a decimal result', () => {
  const problem = buildMathActivityProblem({ operation: 'addition', operands: ['1.2', '2.3'], commands: [] })
  assert.equal(formatSlateMathTranscript(problem, { 'result.ones': '3', 'result.tenths': '5' }), '3.5')
})

test('formats division quotient and remainder', () => {
  const problem = buildMathActivityProblem({ operation: 'division', operands: ['17', '5'], commands: [] })
  assert.equal(formatSlateMathTranscript(problem, { 'result.ones': '3', 'remainder.ones': '2' }), 'Quotient: 3, remainder: 2')
})

test('describes work-only entries without exposing internal IDs', () => {
  const problem = buildMathActivityProblem({ operation: 'addition', operands: ['95', '7'], commands: [] })
  const formatted = formatSlateMathTranscript(problem, { 'carry.tens': '1' })
  assert.equal(formatted, 'carry tens: 1')
  assert.doesNotMatch(formatted, /carry\.tens/)
})

test('Slate transcript call uses structured formatting and suppresses entry text as explanation', () => {
  const source = readFileSync(new URL('../../session/slate/SlateLiftoffExperience.jsx', import.meta.url), 'utf8')
  assert.match(source, /formatSlateMathTranscript\(problem, submitted\.submission\.entries\)/)
  assert.match(source, /route\.kind !== 'entry' && learnerResponse/)
  assert.doesNotMatch(source, /Math response: \$\{submitted\.submission\.responseText\}/)
})
