import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  buildLiftoffSnapshotFeatureState,
  createLiftoffState,
  isResumableSlateLiftoffSnapshot,
} from '../slateLiftoff.mjs'

const identity = {
  learnerId: 'learner-one',
  lessonKey: 'math/fractions',
  occurrenceId: 'occurrence-one',
}
const progress = createLiftoffState([
  { id: 'identify', name: 'Identify the operation', dependencies: [], essential: true },
])

function savedLiftoff(phase = 'active') {
  return {
    learnerId: identity.learnerId,
    lessonKey: identity.lessonKey,
    featureState: buildLiftoffSnapshotFeatureState({
      occurrenceId: identity.occurrenceId,
      executionSessionId: 'protected-execution',
      phase,
      liftoff: progress,
    }),
  }
}

test('refresh offers a resume choice during Liftoff teaching and the independent test', () => {
  assert.equal(isResumableSlateLiftoffSnapshot(savedLiftoff('active'), identity), true)
  assert.equal(isResumableSlateLiftoffSnapshot(savedLiftoff('test'), identity), true)
  assert.equal(isResumableSlateLiftoffSnapshot(savedLiftoff('worksheet'), identity), true)
})

test('refresh never offers another learner, lesson, occurrence, or teacher snapshot', () => {
  const saved = savedLiftoff()
  assert.equal(isResumableSlateLiftoffSnapshot(null, identity), false)
  assert.equal(isResumableSlateLiftoffSnapshot(saved, { ...identity, learnerId: 'another-learner' }), false)
  assert.equal(isResumableSlateLiftoffSnapshot(saved, { ...identity, lessonKey: 'math/another' }), false)
  assert.equal(isResumableSlateLiftoffSnapshot(saved, { ...identity, occurrenceId: 'another-occurrence' }), false)
  assert.equal(isResumableSlateLiftoffSnapshot({ ...saved, featureState: { ...saved.featureState, instructionalTeacher: 'webb' } }, identity), false)
  assert.equal(isResumableSlateLiftoffSnapshot({ ...saved, featureState: { ...saved.featureState, kind: 'not-liftoff' } }, identity), false)
  assert.equal(isResumableSlateLiftoffSnapshot({ ...saved, featureState: { ...saved.featureState, liftoff: null } }, identity), false)
  assert.equal(isResumableSlateLiftoffSnapshot({ ...saved, featureState: { ...saved.featureState, phase: 'complete' } }, identity), false)
})

test('Liftoff waits for an explicit choice and protects progress until Restart is authorized', () => {
  const page = readFileSync(new URL('../../session/slate/SlateLiftoffExperience.jsx', import.meta.url), 'utf8')
  const waitAt = page.indexOf('resumeDecision = await new Promise')
  const beginAt = page.indexOf('const started = await startProtectedInstructionalSession')
  const bindAt = page.indexOf('snapshotService.bindExecutionOwner')
  const deleteAt = page.indexOf('await snapshotService.deleteSnapshot()')
  assert.ok(waitAt >= 0 && waitAt < beginAt, 'Resume / Restart must precede protected session startup')
  assert.ok(bindAt > beginAt && deleteAt > bindAt, 'Restart must delete after protected ownership binding')
  assert.match(page, /resumeDecision !== 'restart' && restoreLiftoffSnapshot/)
  assert.match(page, /if \(snapshotService\.writesFenced\)/)
  assert.match(page, /resolve\?\.\('cancelled'\)/)
  assert.match(page, /if \(phase === 'resume_choice'\)/)
  assert.match(page, /data-slate-liftoff-resume-choice/)
  assert.match(page, /chooseLiftoffResume\('resume'\)/)
  assert.match(page, /chooseLiftoffResume\('restart'\)/)
  assert.match(page, /background: C\.surface/)
  assert.match(page, /borderRadius: 18/)
})
