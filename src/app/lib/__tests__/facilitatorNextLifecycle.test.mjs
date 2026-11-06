import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createLiftoffState, facilitatorFulfillLiftoffComponent, advanceLiftoffAfterFacilitator } from '../slateLiftoff.mjs'
import { restoreSlateLiftoffAdvance } from '../slateLiftoffTranscript.mjs'

const problem = (id, tag) => ({
  prompt: 'Explain ' + tag + '?',
  instanceKey: tag,
  responseContract: { targetComponentId: id, demandType: 'explain', criterion: 'Explain ' + tag },
})

test('Slate FacOR advances without inventing a learner turn or removing previous evidence', () => {
  const original = createLiftoffState([
    { id: 'alpha', name: 'First idea', description: 'First' },
    { id: 'beta', name: 'Second idea', description: 'Second' },
  ], { type: 'probe', targetComponentIds: ['alpha'], problem: problem('alpha', 'first') })
  const approved = facilitatorFulfillLiftoffComponent(original, 'alpha')
  assert.equal(approved.facilitatorFulfillments.alpha.source, 'facilitator')
  const next = advanceLiftoffAfterFacilitator(approved, {
    type: 'probe', targetComponentIds: ['beta'], problem: problem('beta', 'second'),
  })
  assert.ok(next)
  assert.equal(next.turnNumber, 1)
  assert.deepEqual(next.facilitatorFulfillments, approved.facilitatorFulfillments)
  assert.deepEqual(next.components, approved.components)
  assert.equal(next.currentAction.targetComponentIds[0], 'beta')
  assert.equal(next.problemHistory.at(-1).instanceKey, 'first')
  assert.equal(next.trace.at(-1).event, 'facilitator_superseded_question')
  assert.deepEqual(next.trace.at(-1).observations, [])
  assert.equal(advanceLiftoffAfterFacilitator(approved, {
    type: 'probe', targetComponentIds: ['beta'], problem: problem('beta', 'first'),
  }), null, 'a retired problem cannot be presented as the next problem')
})

test('Slate FacOR Next survives refresh but rejects stale or unapproved transitions', () => {
  const initial = createLiftoffState([{ id: 'alpha', name: 'First idea' }], {
    type: 'probe', targetComponentIds: ['alpha'], problem: problem('alpha', 'first'),
  })
  const approved = facilitatorFulfillLiftoffComponent(initial, 'alpha')
  const pending = { kind: 'facilitator', turnNumber: approved.turnNumber, componentId: 'alpha' }
  assert.deepEqual(restoreSlateLiftoffAdvance(pending, approved), pending)
  assert.equal(restoreSlateLiftoffAdvance(pending, initial), null)
  assert.equal(restoreSlateLiftoffAdvance({ ...pending, turnNumber: 99 }, approved), null)
})

test('all three teachers hold obsolete questions until learner-controlled Next', () => {
  const base = new URL('../../', import.meta.url)
  const read = path => readFileSync(new URL(path, base), 'utf8')
  const sonoma = read('session/v2/SessionPageV2.jsx')
  const webb = read('session/webb/page.jsx')
  const slate = read('session/slate/SlateLiftoffExperience.jsx')
  assert.match(sonoma, /nextFacilitatorObjective\(\)/)
  assert.match(sonoma, /discussionState === 'awaiting-facilitator-next'/)
  assert.match(webb, /facilitatorAdvance: true/)
  assert.match(webb, /facilitatorNextPending && \(/)
  assert.match(slate, /mode: 'facilitator_next'/)
  assert.match(slate, /pendingAdvance: pending, slateText: notice/)
  assert.match(slate, /advanceLiftoffAfterFacilitator\(current, data.nextAction\)/)
})