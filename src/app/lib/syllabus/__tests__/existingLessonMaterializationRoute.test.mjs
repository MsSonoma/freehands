import assert from 'node:assert/strict'
import test from 'node:test'

import { POST } from '../../../api/syllabus/materialize/route.js'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const LINEAGE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function request(existingLessonKey, extra = {}) {
  return new Request('http://localhost/api/syllabus/materialize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ learnerId: LEARNER, lineageId: LINEAGE, expectedActiveRevisionId: 'revision-1', existingLessonKey, ...extra }),
  })
}

function context(lesson, storageError = null) {
  return {
    user: { id: FACILITATOR, user_metadata: {} },
    admin: {
      storage: { from: () => ({ download: async () => ({ data: lesson ? new Blob([JSON.stringify(lesson)]) : null, error: storageError }) }) },
    },
  }
}

test('unapproved existing lesson access fails before forecast adoption or active mutation', async () => {
  let repositoryCalls = 0
  const response = await POST(request('generated/draft.json'), {
    requestContext: context({ approved: false, title: 'Draft', subject: 'math' }),
    syllabusAccess: { can_change_intent: true },
    repository: new Proxy({}, { get() { repositoryCalls++; throw new Error('repository must not be reached') } }),
  })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).code, 'LESSON_NOT_ACCESSIBLE')
  assert.equal(repositoryCalls, 0)
})

test('unauthorized existing lesson access fails before forecast adoption or active mutation', async () => {
  let repositoryCalls = 0
  const response = await POST(request('generated/missing.json'), {
    requestContext: context(null, { message: 'not found' }),
    syllabusAccess: { can_change_intent: true },
    repository: new Proxy({}, { get() { repositoryCalls++; throw new Error('repository must not be reached') } }),
  })
  assert.equal(response.status, 403)
  assert.equal((await response.json()).code, 'LESSON_NOT_ACCESSIBLE')
  assert.equal(repositoryCalls, 0)
})

test('approved existing lesson passes only server-verified canonical metadata into materialization', async () => {
  let input
  const response = await POST(request('generated/ready.json'), {
    requestContext: context({ approved: true, title: 'Canonical Ready Lesson', subject: 'science' }),
    syllabusAccess: { can_change_intent: true },
    repository: {},
    materializeForecastOccurrence: async (args) => { input = args; return { kind: 'existing_lesson_bound', lesson_key: args.existingLesson.lessonKey } },
  })
  assert.equal(response.status, 200)
  assert.deepEqual(input.existingLesson, {
    lessonKey: 'generated/ready.json',
    title: 'Canonical Ready Lesson',
    subject: 'science',
  })
  assert.equal((await response.json()).lesson_key, 'generated/ready.json')
})

test('direct proposal API rejects unresolved recovery before proposal lookup or mutation', async () => {
  const reached = []
  const repository = {
    async findOwnedLearner() { reached.push('learner'); return { id: LEARNER, facilitator_id: FACILITATOR, grade: '5' } },
    async findSyllabus() { reached.push('syllabus'); return { id: 'syllabus-1', active_revision_id: 'revision-1' } },
    async findForecastMaterialization() { reached.push('receipt'); return { id: 'receipt-1', status: 'recovery_required', lesson_key: null } },
    async findRevision() { reached.push('proposal-lookup'); throw new Error('proposal lookup must not be reached') },
    async listForecastItems() { reached.push('forecast-lookup'); throw new Error('forecast lookup must not be reached') },
    async insertRevision() { reached.push('revision-write'); throw new Error('revision write must not be reached') },
    async createLearningForecastCarryForwardProposal() { reached.push('carry-forward'); throw new Error('carry-forward must not be reached') },
  }
  const response = await POST(request('generated/ready.json', { proposalRevisionId: 'proposal-1' }), {
    requestContext: context({ approved: true, title: 'Canonical Ready Lesson', subject: 'math' }),
    syllabusAccess: { can_change_intent: true },
    repository,
  })
  const json = await response.json()
  assert.equal(response.status, 409)
  assert.equal(json.code, 'MATERIALIZATION_RECOVERY_REQUIRED')
  assert.deepEqual(reached, ['learner', 'syllabus', 'receipt'])
})
