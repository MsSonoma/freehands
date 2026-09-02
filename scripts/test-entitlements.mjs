import assert from 'node:assert/strict'
import test from 'node:test'

import {
  featuresForTier,
  preparationDeliveryActionsForTier,
  resolveEffectiveTier,
} from '../src/app/lib/entitlements.js'

test('central entitlement matrix exposes expected scheduling, planner, caps, and generation limits', () => {
  const cases = [
    { tier: 'free', canSchedule: false, canPlan: false, learnersMax: 1, lifetimeGenerations: 5 },
    { tier: 'trial', canSchedule: false, canPlan: false, learnersMax: 1, lifetimeGenerations: 5 },
    { tier: 'standard', canSchedule: true, canPlan: false, learnersMax: 2, lifetimeGenerations: Infinity },
    { tier: 'pro', canSchedule: true, canPlan: true, learnersMax: 5, lifetimeGenerations: Infinity },
    { tier: 'lifetime', canSchedule: true, canPlan: true, learnersMax: 10, lifetimeGenerations: Infinity },
  ]

  for (const item of cases) {
    const features = featuresForTier(item.tier)
    assert.equal(features.lessonGenerator, true, item.tier)
    assert.equal(features.lessonScheduling, item.canSchedule, item.tier)
    assert.equal(features.lessonPlanner, item.canPlan, item.tier)
    assert.equal(features.learnersMax, item.learnersMax, item.tier)
    assert.equal(features.lifetimeGenerations, item.lifetimeGenerations, item.tier)
  }
})

test('Free and Trial generation stays available under the current finite quota', () => {
  for (const tier of ['free', 'trial']) {
    const features = featuresForTier(tier)
    assert.equal(features.lessonGenerator, true, tier)
    assert.equal(Number.isFinite(features.lifetimeGenerations), true, tier)
    assert.ok(features.lifetimeGenerations > 0, tier)
    assert.equal(features.lessonScheduling, false, tier)
    assert.equal(features.lessonPlanner, false, tier)
  }
})

test('Prepare DELIVERY stays usable for Free and Trial without scheduling entitlement', () => {
  for (const tier of ['free', 'trial']) {
    assert.deepEqual(preparationDeliveryActionsForTier(tier), {
      startNow: true,
      makeAvailable: true,
      saveForLater: true,
      schedule: false,
    }, tier)
  }
})

test('Prepare DELIVERY adds scheduling for Standard, Pro, beta, and lifetime access', () => {
  const effectiveTiers = [
    ['standard', resolveEffectiveTier('free', 'standard')],
    ['pro', resolveEffectiveTier('pro', 'free')],
    ['beta', resolveEffectiveTier('beta', 'free')],
    ['lifetime', resolveEffectiveTier('lifetime', 'free')],
  ]

  for (const [label, tier] of effectiveTiers) {
    assert.deepEqual(preparationDeliveryActionsForTier(tier), {
      startNow: true,
      makeAvailable: true,
      saveForLater: true,
      schedule: true,
    }, label)
  }
})

test('beta resolves to pro capabilities', () => {
  const effectiveTier = resolveEffectiveTier('beta', 'free')
  assert.equal(effectiveTier, 'pro')
  assert.deepEqual(featuresForTier(effectiveTier), featuresForTier('pro'))
})

test('legacy aliases normalize through current entitlement helpers', () => {
  assert.deepEqual(featuresForTier('premium'), featuresForTier('pro'))
  assert.deepEqual(featuresForTier('premium-plus'), featuresForTier('pro'))
  assert.deepEqual(featuresForTier('plus'), featuresForTier('standard'))
  assert.deepEqual(featuresForTier('basic'), featuresForTier('standard'))
  assert.deepEqual(featuresForTier('starter'), featuresForTier('free'))
})

test('effective tier uses the most-entitled centralized tier except beta override', () => {
  assert.equal(resolveEffectiveTier('free', 'standard'), 'standard')
  assert.equal(resolveEffectiveTier('pro', 'standard'), 'pro')
  assert.equal(resolveEffectiveTier('lifetime', 'pro'), 'lifetime')
  assert.equal(resolveEffectiveTier('beta', 'standard'), 'pro')
})
