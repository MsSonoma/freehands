import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import test from 'node:test'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      return nextResolve(new URL(`../src/${specifier.slice(2)}`, import.meta.url).href, context)
    }
    return nextResolve(specifier, context)
  },
})

const { PATCH: patchFollowUpSettings } = await import('../src/app/api/learner/follow-ups/route.js')

const learnersPageSource = readFileSync(new URL('../src/app/facilitator/learners/page.js', import.meta.url), 'utf8')
const overlaySource = readFileSync(new URL('../src/app/facilitator/learners/components/LearnerEditOverlay.jsx', import.meta.url), 'utf8')
const clientApiSource = readFileSync(new URL('../src/app/facilitator/learners/clientApi.js', import.meta.url), 'utf8')

const LEARNER_A = '11111111-1111-4111-8111-111111111111'
const LEARNER_B = '22222222-2222-4222-8222-222222222222'

function withEvidenceEnabled() {
  const previous = {
    publicFlag: process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED,
    serverFlag: process.env.MASTERY_EVIDENCE_ENABLED,
  }
  process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED = 'true'
  process.env.MASTERY_EVIDENCE_ENABLED = 'true'
  return () => {
    if (previous.publicFlag === undefined) delete process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED
    else process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED = previous.publicFlag
    if (previous.serverFlag === undefined) delete process.env.MASTERY_EVIDENCE_ENABLED
    else process.env.MASTERY_EVIDENCE_ENABLED = previous.serverFlag
  }
}

function patchRequest(body) {
  return new Request('http://localhost.test/api/learner/follow-ups', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer token' },
    body: JSON.stringify(body),
  })
}

function createSettingsRepository({ fail = false } = {}) {
  const rows = new Map([
    [LEARNER_A, {
      id: LEARNER_A,
      facilitator_id: 'user-1',
      daily_followups_enabled: false,
      weekly_reviews_enabled: false,
      weekly_review_day: 'friday',
    }],
    [LEARNER_B, {
      id: LEARNER_B,
      facilitator_id: 'user-1',
      daily_followups_enabled: true,
      weekly_reviews_enabled: true,
      weekly_review_day: 'monday',
    }],
  ])
  const calls = []
  return {
    rows,
    calls,
    async findOwnedLearner({ userId, learnerId }) {
      const row = rows.get(learnerId)
      return row?.facilitator_id === userId ? { ...row } : null
    },
    async updateSettings({ userId, learnerId, settings }) {
      const row = rows.get(learnerId)
      if (!row || row.facilitator_id !== userId) return null
      calls.push({ learnerId, settings: { ...settings } })
      if (fail) throw new Error('database offline')
      const updated = { ...row, ...settings }
      rows.set(learnerId, updated)
      return { ...updated }
    },
  }
}

async function callSettingsPatch(repository, body) {
  const restore = withEvidenceEnabled()
  try {
    return await patchFollowUpSettings(patchRequest(body), {
      authenticate: async () => ({ user: { id: 'user-1' } }),
      repository,
    })
  } finally {
    restore()
  }
}

test('learner list exposes an obvious per-learner Review Settings action', () => {
  assert.match(learnersPageSource, /const \[editingReviewSettings, setEditingReviewSettings\]/)
  assert.match(learnersPageSource, /title="Review Settings"/)
  assert.match(learnersPageSource, /aria-label=\{`Review Settings for \$\{learner\.name/)
  assert.match(learnersPageSource, /setEditingReviewSettings\(learner\)/)
  assert.match(learnersPageSource, /initialTab: 'reviews'/)
  assert.match(learnersPageSource, /await handlePatchLearner\(editingReviewSettings, patch\)/)
})

test('learner card actions wrap on mobile and restore absolute placement on tablet', () => {
  assert.match(learnersPageSource, /\.learner-card-actions \{[\s\S]*position: static !important;[\s\S]*flex-wrap: wrap;/)
  assert.match(learnersPageSource, /@media \(min-width: 640px\) \{[\s\S]*\.learner-card-actions \{[\s\S]*position: absolute !important;[\s\S]*flex-wrap: nowrap;/)
})

test('Review Settings are not hidden in Basic or behind a public feature flag', () => {
  assert.match(overlaySource, /\{ id: 'reviews', label: 'Review Settings' \}/)
  assert.match(overlaySource, /activeTab === 'reviews'/)
  assert.match(overlaySource, />\s*Daily Follow-Ups\s*</)
  assert.match(overlaySource, />\s*Weekly Reviews\s*</)
  assert.match(overlaySource, />\s*Weekly Review Day\s*</)
  assert.doesNotMatch(overlaySource, /followUpsFeatureEnabled/)
  assert.doesNotMatch(overlaySource, /Learning Follow-Ups/)
})

test('review controls use the Follow-Up settings API and not generic learner writes', () => {
  assert.match(learnersPageSource, /if \(isFollowUpPatch\) await updateFollowUpSettings\(learner\.id, patch\)/)
  assert.match(learnersPageSource, /broadcastLearnerSettingsPatch\(learner\.id, patch\)/)
  const updateLearnerBody = clientApiSource.slice(
    clientApiSource.indexOf('export async function updateLearner'),
    clientApiSource.indexOf('export async function deleteLearner'),
  )
  assert.doesNotMatch(updateLearnerBody, /daily_followups_enabled/)
  assert.doesNotMatch(updateLearnerBody, /weekly_reviews_enabled/)
  assert.doesNotMatch(updateLearnerBody, /weekly_review_day/)
})

test('review UI initializes per learner and preserves failed persistence semantics', () => {
  assert.match(overlaySource, /setDailyFollowUpsEnabled\(learner\.daily_followups_enabled === true\)/)
  assert.match(overlaySource, /setWeeklyReviewsEnabled\(learner\.weekly_reviews_enabled === true\)/)
  assert.match(overlaySource, /setWeeklyReviewDay\(WEEKDAYS\.includes\(learner\.weekly_review_day\) \? learner\.weekly_review_day : 'friday'\)/)
  assert.match(overlaySource, /setFollowUpError\(err\?\.message \|\| 'Failed to update Review Settings'\)/)
  assert.match(overlaySource, /rollback\.weekly_review_day/)
  assert.match(overlaySource, /disabled=\{!weeklyReviewsEnabled \|\| savingFollowUps \|\| saving\}/)
  assert.match(overlaySource, /The selected day is preserved when Weekly Reviews are turned off/)
})

test('settings API persists Daily only for the requested learner', async () => {
  const repository = createSettingsRepository()
  const response = await callSettingsPatch(repository, {
    learner_id: LEARNER_A,
    daily_followups_enabled: true,
  })
  const json = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(json.settings, {
    daily_followups_enabled: true,
    weekly_reviews_enabled: false,
    weekly_review_day: 'friday',
  })
  assert.equal(repository.rows.get(LEARNER_B).daily_followups_enabled, true)
  assert.equal(repository.rows.get(LEARNER_B).weekly_review_day, 'monday')
})

test('settings API persists Weekly only with selected weekday', async () => {
  const repository = createSettingsRepository()
  const response = await callSettingsPatch(repository, {
    learner_id: LEARNER_A,
    weekly_reviews_enabled: true,
    weekly_review_day: 'wednesday',
  })
  const json = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(json.settings, {
    daily_followups_enabled: false,
    weekly_reviews_enabled: true,
    weekly_review_day: 'wednesday',
  })
})

test('settings API supports both enabled and neither enabled', async () => {
  const repository = createSettingsRepository()
  let response = await callSettingsPatch(repository, {
    learner_id: LEARNER_A,
    daily_followups_enabled: true,
    weekly_reviews_enabled: true,
  })
  let json = await response.json()
  assert.equal(response.status, 200)
  assert.equal(json.settings.daily_followups_enabled, true)
  assert.equal(json.settings.weekly_reviews_enabled, true)

  response = await callSettingsPatch(repository, {
    learner_id: LEARNER_A,
    daily_followups_enabled: false,
    weekly_reviews_enabled: false,
  })
  json = await response.json()
  assert.equal(response.status, 200)
  assert.equal(json.settings.daily_followups_enabled, false)
  assert.equal(json.settings.weekly_reviews_enabled, false)
})

test('settings API preserves weekly day while Weekly Reviews are toggled off and on', async () => {
  const repository = createSettingsRepository()
  await callSettingsPatch(repository, {
    learner_id: LEARNER_A,
    weekly_reviews_enabled: true,
    weekly_review_day: 'tuesday',
  })
  await callSettingsPatch(repository, {
    learner_id: LEARNER_A,
    weekly_reviews_enabled: false,
  })
  assert.equal(repository.rows.get(LEARNER_A).weekly_review_day, 'tuesday')
  const response = await callSettingsPatch(repository, {
    learner_id: LEARNER_A,
    weekly_reviews_enabled: true,
  })
  const json = await response.json()
  assert.equal(response.status, 200)
  assert.equal(json.settings.weekly_review_day, 'tuesday')
})

test('settings API rejects cross-account learners and failed writes do not report success', async () => {
  let repository = createSettingsRepository()
  let response = await callSettingsPatch(repository, {
    learner_id: '33333333-3333-4333-8333-333333333333',
    daily_followups_enabled: true,
  })
  assert.equal(response.status, 403)

  repository = createSettingsRepository({ fail: true })
  response = await callSettingsPatch(repository, {
    learner_id: LEARNER_A,
    daily_followups_enabled: true,
  })
  const json = await response.json()
  assert.equal(response.status, 500)
  assert.equal(json.ok, false)
  assert.equal(repository.rows.get(LEARNER_A).daily_followups_enabled, false)
})
