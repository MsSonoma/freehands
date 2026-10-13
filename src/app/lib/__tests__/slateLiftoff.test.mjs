import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyLiftoffTurn,
  buildLiftoffSnapshotFeatureState,
  canRestoreLiftoffSnapshot,
  createLiftoffState,
  isLiftoffProblemFresh,
  liftoffReleaseReady,
  normalizeLiftoffComponentMap,
} from '../slateLiftoff.mjs'
import { SLATE_RUN_PURPOSES, slateRunPurpose } from '../slateLearningModel.mjs'

const MAP = [
  { id: 'choose', name: 'Choose operation', dependencies: [], importance: 5, essential: true },
  { id: 'execute', name: 'Execute operation', dependencies: ['choose'], importance: 4, essential: true },
]

test('component maps preserve dependencies and start as evidence, not mastery labels', () => {
  const components = normalizeLiftoffComponentMap(MAP)
  assert.equal(components.length, 2)
  assert.deepEqual(components[1].dependencies, ['choose'])
  assert.equal(components[0].evidenceState, 'unobserved')
  assert.equal(components[1].evidenceState, 'unobserved')
})

test('supported success never becomes independent evidence', () => {
  const state = createLiftoffState(MAP)
  const next = applyLiftoffTurn(state, {
    observations: [{
      componentId: 'choose',
      diagnostic: 'success',
      result: 'supported_success',
      independent: false,
      varied: true,
      integrated: true,
      supportLevel: 'partial',
    }],
    nextAction: { type: 'probe', targetComponentIds: ['choose'], withheldComponentIds: ['choose'] },
  })
  assert.equal(next.components.find((component) => component.id === 'choose').evidenceState, 'supported')
  assert.equal(liftoffReleaseReady(next), false)
})

test('independent evidence requires a meaningful transfer condition before release', () => {
  let state = createLiftoffState(MAP)
  state = applyLiftoffTurn(state, {
    observations: [{
      componentId: 'choose',
      diagnostic: 'success',
      result: 'independent_success',
      independent: true,
      varied: false,
      integrated: false,
      supportLevel: 'none',
    }],
    nextAction: { type: 'probe', targetComponentIds: ['choose'] },
  })
  assert.equal(state.components.find((component) => component.id === 'choose').evidenceState, 'emerging')

  state = applyLiftoffTurn(state, {
    observations: [{
      componentId: 'choose',
      diagnostic: 'success',
      result: 'independent_success',
      independent: true,
      varied: true,
      integrated: false,
      supportLevel: 'none',
    }],
    variationEvidence: true,
    nextAction: { type: 'probe', targetComponentIds: ['execute'] },
  })
  assert.equal(state.components.find((component) => component.id === 'choose').evidenceState, 'independent')
})

test('a contradictory failure destabilizes prior independence instead of erasing history', () => {
  let state = createLiftoffState(MAP)
  state = applyLiftoffTurn(state, {
    observations: [{
      componentId: 'choose',
      diagnostic: 'success',
      result: 'independent_success',
      independent: true,
      varied: true,
      integrated: false,
    }],
    variationEvidence: true,
    nextAction: { type: 'probe' },
  })
  assert.equal(state.components[0].evidenceState, 'independent')

  state = applyLiftoffTurn(state, {
    diagnosis: { category: 'selection_error', evidence: 'Selected the wrong operation.' },
    observations: [{
      componentId: 'choose',
      diagnostic: 'selection_error',
      result: 'failure',
      independent: true,
      varied: true,
      integrated: false,
    }],
    nextAction: { type: 'isolate', targetComponentIds: ['choose'] },
  })
  assert.equal(state.components[0].evidenceState, 'unstable')
})

test('possible slips do not automatically destroy stable independence', () => {
  let state = createLiftoffState(MAP)
  state = applyLiftoffTurn(state, {
    observations: [{
      componentId: 'choose',
      diagnostic: 'success',
      result: 'independent_success',
      independent: true,
      varied: true,
    }],
    variationEvidence: true,
    nextAction: { type: 'probe' },
  })
  state = applyLiftoffTurn(state, {
    observations: [{
      componentId: 'choose',
      diagnostic: 'possible_slip',
      result: 'possible_slip',
      independent: true,
      varied: true,
    }],
    nextAction: { type: 'probe' },
  })
  assert.equal(state.components[0].evidenceState, 'independent')
})

test('model release requests are rejected until all essential components plus integration and variation are established', () => {
  let state = createLiftoffState(MAP)
  state = applyLiftoffTurn(state, {
    observations: [{
      componentId: 'choose',
      diagnostic: 'success',
      result: 'independent_success',
      independent: true,
      varied: true,
      integrated: true,
    }],
    integrationEvidence: true,
    variationEvidence: true,
    nextAction: { type: 'release' },
    sessionDecision: 'procedure_released',
  })
  assert.equal(state.procedureReleased, false)

  state = applyLiftoffTurn(state, {
    observations: [{
      componentId: 'execute',
      diagnostic: 'success',
      result: 'independent_success',
      independent: true,
      varied: true,
      integrated: true,
    }],
    integrationEvidence: true,
    variationEvidence: true,
    nextAction: { type: 'release' },
    sessionDecision: 'procedure_released',
  })
  assert.equal(liftoffReleaseReady(state), true)
  assert.equal(state.procedureReleased, true)
})

test('a failure does not invent supported evidence for an unobserved component', () => {
  const state = applyLiftoffTurn(createLiftoffState(MAP), {
    observations: [{
      componentId: 'choose',
      diagnostic: 'selection_error',
      result: 'failure',
      independent: true,
      varied: false,
      integrated: false,
    }],
    nextAction: { type: 'teach', targetComponentIds: ['choose'] },
  })
  assert.equal(state.components[0].evidenceState, 'unobserved')
})

test('retained evidence remains strong enough for later release decisions', () => {
  const state = createLiftoffState(MAP)
  state.components = state.components.map((component) => ({ ...component, evidenceState: 'retained' }))
  state.integrationConfirmed = true
  state.variationConfirmed = true
  assert.equal(liftoffReleaseReady(state), true)
})

test('Liftoff instruction is not admitted into the Daily Review purpose enum', () => {
  assert.equal(Object.values(SLATE_RUN_PURPOSES).includes('instruction'), false)
  assert.equal(slateRunPurpose('instruction'), SLATE_RUN_PURPOSES.PRACTICE)
})

test('Liftoff snapshots restore only to the exact execution or its explicit takeover target', () => {
  const liftoff = createLiftoffState(MAP)
  const featureState = buildLiftoffSnapshotFeatureState({
    occurrenceId: 'syllabus:one',
    executionSessionId: 'exec-source',
    phase: 'active',
    liftoff,
    slateText: 'Try the next decision.',
    assessmentIndex: 2,
  })
  const direct = { featureState }
  assert.equal(canRestoreLiftoffSnapshot(direct, { occurrenceId: 'syllabus:one', executionSessionId: 'exec-source' }), true)
  assert.equal(canRestoreLiftoffSnapshot(direct, { occurrenceId: 'syllabus:two', executionSessionId: 'exec-source' }), false)
  assert.equal(canRestoreLiftoffSnapshot(direct, { occurrenceId: 'syllabus:one', executionSessionId: 'exec-other' }), false)

  const transferred = {
    featureState,
    ownershipHandoff: { sourceExecutionSessionId: 'exec-source', targetExecutionSessionId: 'exec-target' },
  }
  assert.equal(canRestoreLiftoffSnapshot(transferred, { occurrenceId: 'syllabus:one', executionSessionId: 'exec-target' }), true)
})

test('Liftoff snapshot feature state keeps responsibility evidence and assessment position together', () => {
  const liftoff = createLiftoffState(MAP)
  const feature = buildLiftoffSnapshotFeatureState({
    occurrenceId: 'syllabus:one',
    executionSessionId: 'exec-1',
    phase: 'worksheet',
    liftoff,
    slateText: 'Independent worksheet.',
    assessmentIndex: 3,
    testResults: [{ correct: true }],
    startedAt: '2026-10-07T14:00:00.000Z',
  })
  assert.equal(feature.instructionalTeacher, 'slate')
  assert.equal(feature.phase, 'worksheet')
  assert.equal(feature.assessmentIndex, 3)
  assert.equal(feature.liftoff, liftoff)
  assert.deepEqual(feature.testResults, [{ correct: true }])
})

test('Liftoff progression is evidence-governed and exposes no repetition counter', () => {
  const state = createLiftoffState(MAP)
  assert.equal(Object.hasOwn(state, 'requiredRepetitions'), false)
  assert.equal(Object.hasOwn(state, 'successCount'), false)
  assert.equal(Object.hasOwn(state.components[0], 'requiredRepetitions'), false)
})

test('same problem identity is not fresh even when wording changes', () => {
  assert.equal(isLiftoffProblemFresh(
    { prompt: 'What is one tenth as a decimal?', instanceKey: 'fraction:1/10->decimal' },
    [{ prompt: 'Convert 1/10 to decimal form.', instanceKey: 'fraction:1/10->decimal' }],
  ), false)
})

test('different problem identity is fresh', () => {
  assert.equal(isLiftoffProblemFresh(
    { prompt: 'What is three tenths as a decimal?', instanceKey: 'fraction:3/10->decimal' },
    [{ prompt: 'What is one tenth as a decimal?', instanceKey: 'fraction:1/10->decimal' }],
  ), true)
})

test('repeated problem cannot create variation evidence even if model claims varied', () => {
  const repeated = { prompt: 'Convert 1/10 to a decimal.', instanceKey: 'fraction:1/10->decimal' }
  let state = createLiftoffState(MAP, {
    type: 'probe',
    targetComponentIds: ['choose'],
    problem: repeated,
  }, { priorProblems: [{ prompt: 'What is one tenth as a decimal?', instanceKey: 'fraction:1/10->decimal' }] })
  assert.equal(state.currentAction.problem.fresh, false)

  state = applyLiftoffTurn(state, {
    observations: [{
      componentId: 'choose',
      diagnostic: 'success',
      result: 'independent_success',
      independent: true,
      varied: true,
      integrated: false,
    }],
    variationEvidence: true,
    nextAction: {
      type: 'probe',
      targetComponentIds: ['choose'],
      problem: { prompt: 'Convert 3/10 to a decimal.', instanceKey: 'fraction:3/10->decimal' },
    },
  })

  assert.equal(state.variationConfirmed, false)
  assert.equal(state.components[0].evidenceState, 'emerging')
  assert.equal(state.trace.at(-1).observations[0].varied, false)
})

test('a genuinely different problem can create variation evidence', () => {
  let state = createLiftoffState(MAP, {
    type: 'probe',
    targetComponentIds: ['choose'],
    problem: { prompt: 'Convert 3/10 to a decimal.', instanceKey: 'fraction:3/10->decimal' },
  }, { priorProblems: [{ prompt: 'Convert 1/10 to a decimal.', instanceKey: 'fraction:1/10->decimal' }] })
  assert.equal(state.currentAction.problem.fresh, true)

  state = applyLiftoffTurn(state, {
    observations: [{
      componentId: 'choose',
      diagnostic: 'success',
      result: 'independent_success',
      independent: true,
      varied: true,
      integrated: false,
    }],
    variationEvidence: true,
    nextAction: { type: 'teach', targetComponentIds: ['choose'] },
  })

  assert.equal(state.variationConfirmed, true)
  assert.equal(state.components[0].evidenceState, 'independent')
})

test('next action is marked non-fresh when it reuses an answered problem', () => {
  let state = createLiftoffState(MAP, {
    type: 'probe',
    targetComponentIds: ['choose'],
    problem: { prompt: 'Convert 1/10 to a decimal.', instanceKey: 'fraction:1/10->decimal' },
  })
  state = applyLiftoffTurn(state, {
    observations: [],
    nextAction: {
      type: 'reprobe',
      targetComponentIds: ['choose'],
      problem: { prompt: 'Convert 1/10 to a decimal.', instanceKey: 'fraction:1/10->decimal' },
    },
  })
  assert.equal(state.currentAction.problem.fresh, false)
  assert.equal(state.problemHistory.length, 1)
})

test('earned skills stay revealed if later evidence becomes unstable', () => {
  let state = createLiftoffState(MAP, {
    type: 'probe',
    targetComponentIds: ['choose'],
    problem: { prompt: 'Convert 3/10 to a decimal.', instanceKey: 'fraction:3/10->decimal' },
  }, {
    priorProblems: [{ prompt: 'Convert 1/10 to a decimal.', instanceKey: 'fraction:1/10->decimal' }],
  })

  state = applyLiftoffTurn(state, {
    observations: [{
      componentId: 'choose',
      diagnostic: 'success',
      result: 'independent_success',
      independent: true,
      varied: true,
      integrated: false,
    }],
    variationEvidence: true,
    nextAction: {
      type: 'probe',
      targetComponentIds: ['choose'],
      problem: { prompt: 'Convert 4/10 to a decimal.', instanceKey: 'fraction:4/10->decimal' },
    },
  })

  assert.equal(state.components[0].evidenceState, 'independent')
  assert.equal(state.components[0].revealedToLearner, true)

  state = applyLiftoffTurn(state, {
    observations: [{
      componentId: 'choose',
      diagnostic: 'selection_error',
      result: 'failure',
      independent: true,
      varied: true,
      integrated: false,
    }],
    nextAction: { type: 'teach', targetComponentIds: ['choose'] },
  })

  assert.equal(state.components[0].evidenceState, 'unstable')
  assert.equal(state.components[0].revealedToLearner, true)
})

test('Liftoff snapshot feature state preserves optional activity-keyed working notes exactly', () => {
  const mathWorkingNotes = { activityId: 'teaching-activity', notes: { 'carry.ones': '1' } }
  const assessmentMathWorkingNotes = { activityId: 'test-activity', notes: { 'sum_carry.tens': '2' } }
  const feature = buildLiftoffSnapshotFeatureState({ mathWorkingNotes, assessmentMathWorkingNotes })
  assert.strictEqual(feature.mathWorkingNotes, mathWorkingNotes)
  assert.strictEqual(feature.assessmentMathWorkingNotes, assessmentMathWorkingNotes)

  const oldFeature = buildLiftoffSnapshotFeatureState()
  assert.equal(Object.hasOwn(oldFeature, 'mathWorkingNotes'), false)
  assert.equal(Object.hasOwn(oldFeature, 'assessmentMathWorkingNotes'), false)
})
