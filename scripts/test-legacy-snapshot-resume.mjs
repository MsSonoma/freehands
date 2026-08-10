import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import {
  deriveResumePhaseFromSnapshot,
  normalizeResumePhase,
} from '../src/app/session/v2/resumePhase.js'

test('resume phase extraction supports current V2 snapshot shape', () => {
  assert.equal(deriveResumePhaseFromSnapshot({ currentPhase: 'exercise' }), 'exercise')
})

test('resume phase extraction supports verified legacy snapshot phase field', () => {
  assert.equal(deriveResumePhaseFromSnapshot({ phase: 'exercise' }), 'exercise')
})

test('resume phase extraction supports verified legacy resume.phase field', () => {
  assert.equal(deriveResumePhaseFromSnapshot({ resume: { phase: 'test' } }), 'test')
})

test('legacy test aliases normalize to test', () => {
  assert.equal(deriveResumePhaseFromSnapshot({ phase: 'grading' }), 'test')
  assert.equal(deriveResumePhaseFromSnapshot({ phase: 'congrats' }), 'test')
})

test('complete snapshots normalize to closing', () => {
  assert.equal(deriveResumePhaseFromSnapshot({ phase: 'complete' }), 'closing')
})

test('legacy teaching and comprehension resume at restored Socratic Discussion', () => {
  assert.equal(normalizeResumePhase('teaching'), 'discussion')
  assert.equal(normalizeResumePhase('comprehension'), 'discussion')
  assert.equal(deriveResumePhaseFromSnapshot({ phase: 'teaching' }), 'discussion')
  assert.equal(deriveResumePhaseFromSnapshot({ phase: 'comprehension' }), 'discussion')
})

test('unrecognized existing snapshot is not interpreted as a resumable phase', () => {
  assert.equal(deriveResumePhaseFromSnapshot({ phase: 'unknown-legacy-phase' }), null)
})

test('SessionPageV2 treats loaded snapshots with unrecognized phase shape as fresh starts', () => {
  const sessionSource = readFileSync(join(process.cwd(), 'src/app/session/v2/SessionPageV2.jsx'), 'utf8')

  assert.doesNotMatch(sessionSource, /snapshotResumeBlocked/)
  assert.doesNotMatch(sessionSource, /Saved progress found, but its resume phase could not be recognized/)
  assert.doesNotMatch(sessionSource, /cannot determine where to resume/)
  assert.match(sessionSource, /const resumePhaseName = normalizedResumePhase \|\| null/)
  assert.match(
    sessionSource,
    /audioReady && snapshotLoaded && currentPhase === 'idle' && !resumePhase/,
  )
})
