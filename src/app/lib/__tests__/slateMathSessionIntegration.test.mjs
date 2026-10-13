import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  buildMathActivityProblem,
  updateMathSessionView,
} from '../../../lib/math/mathSession.mjs'
import { enterVerticalMathFullAnswer } from '../../../lib/math/verticalMath.mjs'
import {
  appendSlateMathArchive,
  createOrRestoreSlateMathActivity,
  slateMathReceiptMatches,
  slateMathSessionMatchesSpec,
  slateMathSubmissionReady,
} from '../slateMath.mjs'
import { buildLiftoffSnapshotFeatureState } from '../slateLiftoff.mjs'

const source = readFileSync(new URL('../../session/slate/SlateLiftoffExperience.jsx', import.meta.url), 'utf8')
const math = { operation: 'addition', operands: ['12', '7'], commands: [] }

function completeState(activityId = 'activity') {
  const made = createOrRestoreSlateMathActivity({ math, activityId })
  const problem = buildMathActivityProblem(math)
  const entered = enterVerticalMathFullAnswer(problem, made.state.view, '19')
  return updateMathSessionView(made.state, entered.view, {
    activityId,
    expectedRevision: made.state.revision,
    requestId: 'edit',
  }).state
}

test('optional math helpers reject mismatched restores and gate readiness', () => {
  assert.equal(createOrRestoreSlateMathActivity({ math: null, activityId: 'none' }).state, null)
  const complete = completeState()
  assert.equal(slateMathSessionMatchesSpec({ math, snapshot: complete, activityId: 'activity' }), true)
  assert.equal(slateMathSessionMatchesSpec({ math: { ...math, operands: ['13', '7'] }, snapshot: complete, activityId: 'activity' }), false)
  assert.equal(slateMathSubmissionReady({ math, snapshot: complete, activityId: 'activity' }), true)
  assert.equal(slateMathSubmissionReady({ math, snapshot: createOrRestoreSlateMathActivity({ math, activityId: 'blank' }).state, activityId: 'blank' }), false)
  const allGiven = { ...math, commands: [{ action: 'show', locations: ['result.*'] }] }
  const demo = createOrRestoreSlateMathActivity({ math: allGiven, activityId: 'demo' }).state
  assert.equal(slateMathSubmissionReady({ math: allGiven, snapshot: demo, activityId: 'demo' }), false)
})

test('receipt guard rejects stale activity, revision, and turn', () => {
  const pending = { turnNumber: 4, submission: { activityId: 'a', requestId: 'r', submittedRevision: 2 } }
  const receipt = { activityId: 'a', requestId: 'r', submittedRevision: 2 }
  assert.equal(slateMathReceiptMatches({ receipt, pending, currentActivityId: 'a', currentRevision: 3, currentTurnNumber: 4 }), true)
  assert.equal(slateMathReceiptMatches({ receipt, pending, currentActivityId: 'b', currentRevision: 3, currentTurnNumber: 4 }), false)
  assert.equal(slateMathReceiptMatches({ receipt, pending, currentActivityId: 'a', currentRevision: 4, currentTurnNumber: 4 }), false)
  assert.equal(slateMathReceiptMatches({ receipt, pending, currentActivityId: 'a', currentRevision: 3, currentTurnNumber: 5 }), false)
})

test('accepted archive appends once without mutating pending snapshot evidence', () => {
  const snapshot = completeState('archive')
  const metadata = { activityId: 'archive', requestId: 'request', submittedRevision: 1 }
  const first = appendSlateMathArchive([], snapshot, metadata)
  assert.equal(first.ok, true)
  assert.equal(first.archive.length, 1)
  assert.strictEqual(first.archive[0].mathSession, snapshot)
  assert.strictEqual(appendSlateMathArchive(first.archive, snapshot, metadata).archive, first.archive)
  const feature = buildLiftoffSnapshotFeatureState({
    occurrenceId: 'o', executionSessionId: 'e', mathSession: snapshot,
    mathArchive: first.archive, mathPending: { learnerResponse: '', mathSession: snapshot },
  })
  assert.strictEqual(feature.mathSession, snapshot)
  assert.strictEqual(feature.mathArchive, first.archive)
  assert.equal(feature.mathPending.learnerResponse, '')
})

test('active source preserves retries, persistence, guards, and separate submit branches', () => {
  assert.match(source, /existing\.turnNumber === currentLiftoff\.turnNumber/)
  assert.match(source, /pending\.learnerResponse \? \{ learnerResponse: pending\.learnerResponse \} : \{\}/)
  assert.ok(source.indexOf('const nextState = applyLiftoffTurn') < source.indexOf('appendSlateMathArchive(mathArchiveRef.current'))
  assert.match(source, /liftoffRef\.current = nextState\s+setLiftoff\(nextState\)/)
  assert.match(source, /phase !== 'active' \|\| introTeachingRef\.current \|\| lineHelpTarget \|\| lineHelpBusy \|\| writesFenced/)
  assert.match(source, /if \(!text \|\| busy \|\| lineHelpBusy \|\| phase === 'test'\) return/)
  assert.match(source, /saveProgress\('liftoff'/)
  assert.match(source, /window\.addEventListener\('pagehide', flush\)/)
  assert.match(source, /showCheck=\{false\}/)
  const editHandler = source.slice(source.indexOf('const changeMathView'), source.indexOf('const essentialComponents'))
  assert.doesNotMatch(editHandler, /fetch\(/)
  assert.match(source, /!answer\.trim\(\) && !mathPending\?\.submission/)
  assert.match(source, /kind: 'text_answer'/)
  assert.match(source, /pending\?\.submission && !slateMathReceiptMatches/)
  assert.match(source, /kind: 'optional_work'/)
  assert.doesNotMatch(source, /phase="test"[\s\S]{0,200}showCheck=\{false\}/)
})
