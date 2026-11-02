import assert from 'node:assert/strict'
import test from 'node:test'
import { syllabusRecoveryGuidance } from '../recoveryGuidance.mjs'

test('every error has an educator-actionable response without internal software terms', () => {
  for (const error of ['OpenAI request timeout', 'MATERIALIZATION_INPUT_CHANGED', 'NO_SCHOOL_DATE', 'ENTITLEMENT_CHECK_FAILED', 'Unexpected error', '']) {
    const response = syllabusRecoveryGuidance(error)
    assert.ok(response.length > 25)
    assert.doesNotMatch(response, /artifact|receipt|lineage|hash|database|code the app/i)
    assert.match(response, /refresh|retry|create|choose|review|open|check/i)
  }
})
