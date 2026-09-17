import assert from 'node:assert/strict'
import test from 'node:test'

import { GET } from '../../../api/syllabus/seed/route.js'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function repository(captures = {}) {
  return {
    async findFacilitatorTimeZone(facilitatorId) {
      captures.timeZoneFacilitatorId = facilitatorId
      return 'America/New_York'
    },
    async findOwnedLearner(learnerId, facilitatorId) {
      captures.ownedLearner = { learnerId, facilitatorId }
      return learnerId === LEARNER && facilitatorId === FACILITATOR
        ? { id: LEARNER, name: 'Test', goals_notes: '' }
        : null
    },
    async readLegacyPlanning(args) {
      captures.legacyPlanning = args
      return {
        scheduleTemplates: [],
        plannedLessons: [],
        curriculumPreferences: null,
        customSubjects: [],
      }
    },
  }
}

test('seed resolves facilitator-local today across UTC date rollover', async () => {
  const captures = {}
  const response = await GET(
    new Request(`http://localhost/api/syllabus/seed?learnerId=${LEARNER}`),
    {
      requestContext: {
        user: { id: FACILITATOR, user_metadata: {} },
        admin: {},
      },
      repository: repository(captures),
      now: new Date('2026-09-17T00:26:00.000Z'),
    },
  )

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.seed.effective_from, '2026-09-16')
  assert.equal(body.seed.legacy_provenance.seeded_at, '2026-09-17T00:26:00.000Z')
  assert.equal(captures.timeZoneFacilitatorId, FACILITATOR)
  assert.equal(captures.legacyPlanning.today, '2026-09-16')
})

test('seed falls back to account timezone when profile timezone is unavailable', async () => {
  const captures = {}
  const repo = repository(captures)
  repo.findFacilitatorTimeZone = async () => null

  const response = await GET(
    new Request(`http://localhost/api/syllabus/seed?learnerId=${LEARNER}`),
    {
      requestContext: {
        user: { id: FACILITATOR, user_metadata: { timezone: 'America/Los_Angeles' } },
        admin: {},
      },
      repository: repo,
      now: new Date('2026-09-17T02:30:00.000Z'),
    },
  )

  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.seed.effective_from, '2026-09-16')
  assert.equal(captures.legacyPlanning.today, '2026-09-16')
})
