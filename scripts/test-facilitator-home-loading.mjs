import assert from 'node:assert/strict'
import test from 'node:test'

import {
  FACILITATOR_HOME_SHELL_STATES,
  loadFacilitatorHomeSchedules,
  resolveFacilitatorHomeShellState,
  settleFacilitatorHomeTask,
} from '../src/app/lib/facilitatorHomeLoading.mjs'
import { ensurePinAllowed } from '../src/app/lib/pinGate.js'

test('authenticated Facilitator Home renders after PIN while learner data loads', async () => {
  assert.equal(resolveFacilitatorHomeShellState({
    authLoading: false,
    isAuthenticated: true,
    pinChecked: true,
  }), FACILITATOR_HOME_SHELL_STATES.HOME)

  const learners = await settleFacilitatorHomeTask(
    () => Promise.resolve([{ id: 'learner-1', name: 'Ada' }]),
    { fallback: [], timeoutMs: 25, label: 'Learner list' },
  )
  assert.equal(learners.ok, true)
  assert.equal(learners.value[0].name, 'Ada')
})

test('lesson-list failure falls back without changing the authenticated shell', async () => {
  const lessons = await settleFacilitatorHomeTask(
    () => Promise.reject(new Error('lesson API unavailable')),
    { fallback: [], timeoutMs: 25, label: 'Lesson list' },
  )

  assert.equal(lessons.ok, false)
  assert.deepEqual(lessons.value, [])
  assert.equal(resolveFacilitatorHomeShellState({ authLoading: false, isAuthenticated: true, pinChecked: true }), 'home')
})

test('profile failure falls back without changing the authenticated shell', async () => {
  const profile = await settleFacilitatorHomeTask(
    () => Promise.reject(new Error('profile query unavailable')),
    { fallback: null, timeoutMs: 25, label: 'Facilitator profile' },
  )

  assert.equal(profile.ok, false)
  assert.equal(profile.value, null)
  assert.equal(resolveFacilitatorHomeShellState({ authLoading: false, isAuthenticated: true, pinChecked: true }), 'home')
})

test('one failed learner schedule preserves schedules returned for other learners', async () => {
  const result = await loadFacilitatorHomeSchedules({
    learners: [{ id: 'learner-1' }, { id: 'learner-2' }],
    timeoutMs: 25,
    loadSchedule: async (learner) => {
      if (learner.id === 'learner-1') throw new Error('schedule unavailable')
      return { schedule: [{ lesson_key: 'generated/ready.json', scheduled_date: '2026-08-10' }] }
    },
  })

  assert.equal(result.failures, 1)
  assert.deepEqual(result.scheduledKeys, { 'generated/ready.json': '2026-08-10' })
})

test('a schedule request that never settles is bounded and cannot hold the Home shell', async () => {
  const startedAt = Date.now()
  const result = await loadFacilitatorHomeSchedules({
    learners: [{ id: 'slow' }, { id: 'fast' }],
    timeoutMs: 20,
    loadSchedule: (learner) => learner.id === 'slow'
      ? new Promise(() => {})
      : Promise.resolve({ schedule: [{ lesson_key: 'generated/fast.json' }] }),
  })

  assert.equal(result.failures, 1)
  assert.deepEqual(result.scheduledKeys, { 'generated/fast.json': true })
  assert.ok(Date.now() - startedAt < 250)
})

test('active facilitator section bypasses PIN preference lookup', async () => {
  let lookups = 0
  const allowed = await ensurePinAllowed('facilitator-page', {
    isBrowser: true,
    isInFacilitatorSection: () => true,
    fetchServerPrefsAndHasPin: async () => {
      lookups += 1
      return { hasPin: true, prefs: { facilitatorPage: true } }
    },
  })

  assert.equal(allowed, true)
  assert.equal(lookups, 0)
})

test('configured PIN outside the facilitator section still prompts and verifies', async () => {
  const calls = []
  const allowed = await ensurePinAllowed('facilitator-page', {
    isBrowser: true,
    isInFacilitatorSection: () => false,
    fetchServerPrefsAndHasPin: async () => {
      calls.push('lookup')
      return { hasPin: true, prefs: { facilitatorPage: true } }
    },
    promptForPinMasked: async () => {
      calls.push('prompt')
      return '1234'
    },
    verifyPinServer: async (pin) => {
      calls.push(`verify:${pin}`)
      return true
    },
    setInFacilitatorSection: (active) => calls.push(`active:${active}`),
  })

  assert.equal(allowed, true)
  assert.deepEqual(calls, ['lookup', 'prompt', 'verify:1234', 'active:true'])
})

test('signed-out users still receive the authentication gate', () => {
  assert.equal(resolveFacilitatorHomeShellState({
    authLoading: false,
    isAuthenticated: false,
    pinChecked: false,
  }), FACILITATOR_HOME_SHELL_STATES.AUTH_GATE)
})
