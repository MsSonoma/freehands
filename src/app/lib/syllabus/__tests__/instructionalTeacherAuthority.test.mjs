import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { upsertLessonAssociation } from '../lessonAssociations.server.mjs'
import { composeSyllabusLessonTimeline } from '../lessonTimeline.mjs'
import { buildInstructionalSessionRoute } from '../instructionalTeacher.mjs'
import { GET as getLessonAssociation } from '../../../api/syllabus/lesson-associations/route.js'

const FACILITATOR = '11111111-1111-4111-8111-111111111111'
const LEARNER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MIGRATION_PATH = path.resolve('supabase/migrations/20260829190809_add_instructional_teacher_authority.sql')

function instructionalTeacherMigration() {
  return fs.readFileSync(MIGRATION_PATH, 'utf8')
}

function migrationFunction(sql, functionName) {
  const declaration = new RegExp(`create(?: or replace)? function public\\.${functionName}\\(`, 'i').exec(sql)
  const start = declaration?.index ?? -1
  const end = sql.indexOf(`revoke all on function public.${functionName}`, start)
  assert.notEqual(start, -1, `${functionName} is present`)
  assert.notEqual(end, -1, `${functionName} grant boundary is present`)
  return sql.slice(start, end)
}

function associationAdmin(existing = null) {
  const state = { row: existing ? structuredClone(existing) : null, writes: [] }
  const matches = () => ({
    eq() { return this },
    select() { return this },
    async single() { return { data: structuredClone(state.row), error: null } },
  })
  return {
    state,
    from(table) {
      assert.equal(table, 'syllabus_lesson_associations')
      return {
        select() {
          return {
            eq() { return this },
            async maybeSingle() { return { data: structuredClone(state.row), error: null } },
          }
        },
        update(payload) {
          state.writes.push({ kind: 'update', payload: structuredClone(payload) })
          state.row = { ...state.row, ...payload }
          return matches()
        },
        insert(payload) {
          state.writes.push({ kind: 'insert', payload: structuredClone(payload) })
          state.row = structuredClone(payload)
          return { select: () => ({ single: async () => ({ data: structuredClone(state.row), error: null }) }) }
        },
      }
    },
  }
}

function write(admin, instructionalTeacher) {
  return upsertLessonAssociation({
    admin,
    facilitatorId: FACILITATOR,
    learnerId: LEARNER,
    lessonKey: 'generated/fractions.json',
    subject: 'math',
    title: 'Fractions',
    readinessState: 'available',
    associationSource: 'prepare',
    instructionalTeacher,
    verifyLearner: false,
  })
}

test('new associations default to Sonoma and explicit Webb assignments persist', async () => {
  const defaultAdmin = associationAdmin()
  const defaulted = await write(defaultAdmin, undefined)
  assert.equal(defaulted.instructional_teacher, 'sonoma')
  assert.equal(defaultAdmin.state.writes[0].kind, 'insert')

  const webbAdmin = associationAdmin()
  const webb = await write(webbAdmin, 'webb')
  assert.equal(webb.instructional_teacher, 'webb')
})

test('omitted teacher updates preserve an existing Webb assignment', async () => {
  const admin = associationAdmin({
    facilitator_id: FACILITATOR,
    learner_id: LEARNER,
    lesson_key: 'generated/fractions.json',
    readiness_state: 'approved',
    instructional_teacher: 'webb',
  })
  const result = await write(admin, undefined)
  assert.equal(result.instructional_teacher, 'webb')
  assert.equal(admin.state.writes[0].kind, 'update')
  assert.equal(Object.hasOwn(admin.state.writes[0].payload, 'instructional_teacher'), false)
})

for (const invalidTeacher of ['slate', 'unknown']) {
  test(`${invalidTeacher} is rejected as an instructional teacher`, async () => {
    const admin = associationAdmin()
    await assert.rejects(() => write(admin, invalidTeacher), /must be sonoma or webb/i)
    assert.equal(admin.state.writes.length, 0)
  })
}

test('timeline exposes current assignment but preserves the actual historical teacher', () => {
  const items = composeSyllabusLessonTimeline({
    activeRevision: { id: 'revision-1', effective_from: '2026-08-01', weekly_pattern: { saturday: [{ subject: 'math' }] } },
    associations: [{ id: 'association-1', lesson_key: 'generated/fractions.json', subject: 'math', title: 'Fractions', readiness_state: 'available', instructional_teacher: 'webb' }],
    forecastItems: [{ id: 'forecast-1', lineage_id: 'lineage-1', lesson_key: 'generated/fractions.json', subject: 'math', title: 'Fractions again', planned_date: '2026-08-29', sort_order: 0, created_at: '2026-08-28T10:00:00Z' }],
    sessions: [{ id: 'session-1', lesson_id: 'generated/fractions.json', instructional_teacher: 'sonoma', started_at: '2026-08-22T10:00:00Z', ended_at: '2026-08-22T11:00:00Z' }],
    sessionEvents: [{ id: 'event-1', session_id: 'session-1', lesson_id: 'generated/fractions.json', event_type: 'completed', occurred_at: '2026-08-22T11:00:00Z', metadata: { source: 'session-v2', instructional_teacher: 'sonoma' } }],
    today: '2026-08-29',
  })
  const historical = items.find((item) => item.occurrence_id === 'actual:session-1')
  const currentIntent = items.find((item) => item.placement_kind === 'syllabus')
  assert.equal(historical.assigned_instructional_teacher, 'webb')
  assert.equal(historical.actual_instructional_teacher, 'sonoma')
  assert.equal(currentIntent.assigned_instructional_teacher, 'webb')
})

test('instructional routing permits Sonoma and Webb, never Slate', () => {
  assert.match(buildInstructionalSessionRoute({ learnerId: LEARNER, subject: 'math', fileName: 'fractions.json', instructionalTeacher: 'sonoma' }), /^\/session\?/)
  assert.match(buildInstructionalSessionRoute({ learnerId: LEARNER, subject: 'math', fileName: 'fractions.json', instructionalTeacher: 'webb' }), /^\/session\/webb\?/)
  assert.throws(() => buildInstructionalSessionRoute({ learnerId: LEARNER, subject: 'math', fileName: 'fractions.json', instructionalTeacher: 'slate' }), /valid instructional teacher/i)
})

test('learner home is canonical, clears stale preference, and legacy route redirects', () => {
  const home = fs.readFileSync(path.resolve('src/app/learn/LearnerHome.js'), 'utf8')
  const canonicalPage = fs.readFileSync(path.resolve('src/app/learn/page.js'), 'utf8')
  const legacyPage = fs.readFileSync(path.resolve('src/app/learn/lessons/page.js'), 'utf8')
  assert.match(canonicalPage, /from '\.\/LearnerHome'/)
  assert.match(legacyPage, /redirect\('\/learn'\)/)
  assert.match(home, /localStorage\.removeItem\('selected_teacher'\)/)
  assert.doesNotMatch(home, /localStorage\.getItem\('selected_teacher'\)|setSelectedTeacher|value=\{selectedTeacher\}/)
  assert.match(home, /syllabusOccurrence\?\.assigned_instructional_teacher/)
})

test('lesson association GET rejects a malformed lesson key with the canonical client error', async () => {
  const request = new Request(`http://localhost/api/syllabus/lesson-associations?learnerId=${LEARNER}&lessonKey=%20`, {
    headers: { Authorization: 'Bearer token' },
  })
  const response = await getLessonAssociation(request, {
    requestContext: { user: { id: FACILITATOR }, admin: {} },
  })
  assert.equal(response.status, 400)
  assert.equal((await response.json()).code, 'INVALID_LESSON_KEY')
})

test('migration constrains assignments and binds start and completion to immutable teacher identity', () => {
  const sql = instructionalTeacherMigration()
  assert.match(sql, /syllabus_lesson_associations[\s\S]*instructional_teacher text not null default 'sonoma'/i)
  assert.match(sql, /check \(instructional_teacher in \('sonoma', 'webb'\)\)/i)
  assert.match(sql, /lesson_sessions[\s\S]*add column instructional_teacher text/i)
  assert.match(sql, /instructional teacher recorded at session start is immutable/i)
  assert.match(sql, /p_instructional_teacher not in \('sonoma', 'webb'\)/i)
  assert.match(sql, /insert into public\.lesson_sessions[\s\S]*instructional_teacher[\s\S]*p_instructional_teacher/i)
  assert.match(sql, /v_session\.instructional_teacher is distinct from p_instructional_teacher/i)
  assert.match(sql, /p_instructional_teacher = 'sonoma' and p_source <> 'session-v2'/i)
  assert.match(sql, /p_instructional_teacher = 'webb' and p_source <> 'webb'/i)
  assert.match(sql, /set search_path = ''/i)
  assert.match(sql, /revoke all on function public\.start_lesson_session_transactional[\s\S]*public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.complete_lesson_session_transactional[\s\S]*to service_role/i)
})

test('instructional-teacher migration additively preserves both legacy RPC signatures', () => {
  const sql = instructionalTeacherMigration()
  const legacyStart = fs.readFileSync(path.resolve('supabase/migrations/20260827174540_transactional_lesson_session_start.sql'), 'utf8')
  const legacyCompletion = fs.readFileSync(path.resolve('supabase/migrations/20260828192109_transactional_lesson_session_completion.sql'), 'utf8')

  assert.match(legacyStart, /create or replace function public\.start_lesson_session_transactional\(\s*p_learner_id uuid,\s*p_lesson_id text,\s*p_browser_session_id uuid,\s*p_device_name text,\s*p_allow_takeover boolean,\s*p_expected_conflicting_session_id uuid,\s*p_syllabus_occurrence_id text\s*\)/i)
  assert.match(sql, /create function public\.start_lesson_session_transactional\(\s*p_learner_id uuid,\s*p_lesson_id text,\s*p_browser_session_id uuid,\s*p_device_name text,\s*p_allow_takeover boolean,\s*p_expected_conflicting_session_id uuid,\s*p_syllabus_occurrence_id text,\s*p_instructional_teacher text\s*\)/i)
  assert.doesNotMatch(sql, /drop function(?: if exists)? public\.start_lesson_session_transactional\(uuid, text, uuid, text, boolean, uuid, text\)/i)

  assert.match(legacyCompletion, /create or replace function public\.complete_lesson_session_transactional\(\s*p_session_id uuid,\s*p_learner_id uuid,\s*p_lesson_id text,\s*p_syllabus_occurrence_id text,\s*p_source text,\s*p_test_percentage numeric\s*\)/i)
  assert.match(sql, /create function public\.complete_lesson_session_transactional\(\s*p_session_id uuid,\s*p_learner_id uuid,\s*p_lesson_id text,\s*p_syllabus_occurrence_id text,\s*p_source text,\s*p_instructional_teacher text,\s*p_test_percentage numeric\s*\)/i)
  assert.doesNotMatch(sql, /drop function(?: if exists)? public\.complete_lesson_session_transactional\(uuid, uuid, text, text, text, numeric\)/i)
})

test('new application routes select only the teacher-bound RPC overloads', () => {
  const startRoute = fs.readFileSync(path.resolve('src/app/api/syllabus/execution/start/route.js'), 'utf8')
  const completionRoute = fs.readFileSync(path.resolve('src/app/api/syllabus/execution/complete/route.js'), 'utf8')
  assert.match(startRoute, /p_syllabus_occurrence_id: occurrenceId,\s+p_instructional_teacher: instructionalTeacher/i)
  assert.match(completionRoute, /p_source: source,\s+p_instructional_teacher: instructionalTeacher,\s+p_test_percentage: testPercentage/i)
})

test('legacy active NULL-teacher session from the same browser cannot enter the reuse branch', () => {
  const start = migrationFunction(instructionalTeacherMigration(), 'start_lesson_session_transactional')
  assert.match(start, /if v_requested_found\s+and v_requested_active\.instructional_teacher = p_instructional_teacher\s+and v_requested_active\.session_id = p_browser_session_id then/i)
})

test('legacy active NULL-teacher session without takeover follows the ordinary conflict branch', () => {
  const start = migrationFunction(instructionalTeacherMigration(), 'start_lesson_session_transactional')
  assert.match(start, /if v_requested_found\s+and v_requested_active\.instructional_teacher is not null\s+and v_requested_active\.instructional_teacher is distinct from p_instructional_teacher then/i)
  assert.match(start, /if v_requested_found then\s+if not coalesce\(p_allow_takeover, false\) then\s+return jsonb_build_object\(\s+'state', 'conflict'/i)
})

test('valid takeover replaces a legacy active session with a fresh teacher-bound session', () => {
  const start = migrationFunction(instructionalTeacherMigration(), 'start_lesson_session_transactional')
  assert.match(start, /p_expected_conflicting_session_id <> v_requested_active\.id[\s\S]*v_takeover := true/i)
  assert.match(start, /update public\.lesson_sessions set ended_at = v_now[\s\S]*'restarted'[\s\S]*insert into public\.lesson_sessions[\s\S]*p_instructional_teacher[\s\S]*case when v_takeover then 'taken_over'/i)
  assert.doesNotMatch(start, /update public\.lesson_sessions[\s\S]*set instructional_teacher\s*=/i)
})

test('takeover with the wrong expected legacy conflict id remains stale', () => {
  const start = migrationFunction(instructionalTeacherMigration(), 'start_lesson_session_transactional')
  assert.match(start, /if p_expected_conflicting_session_id is null\s+or p_expected_conflicting_session_id <> v_requested_active\.id then\s+return jsonb_build_object\([\s\S]*?'staleConflict', true/i)
})

test('active non-null Sonoma session cannot be taken over as Webb', () => {
  const start = migrationFunction(instructionalTeacherMigration(), 'start_lesson_session_transactional')
  const mismatch = start.indexOf('and v_requested_active.instructional_teacher is not null')
  const takeover = start.indexOf('if not coalesce(p_allow_takeover, false)')
  assert.ok(mismatch >= 0 && mismatch < takeover, 'non-null teacher mismatch is checked before takeover authorization')
  assert.match(start.slice(mismatch, takeover), /'state', 'teacher_mismatch'/i)
})

test('completion of a historical NULL-teacher session fails closed without guessing a teacher', () => {
  const completion = migrationFunction(instructionalTeacherMigration(), 'complete_lesson_session_transactional')
  assert.match(completion, /if v_session\.instructional_teacher is distinct from p_instructional_teacher then\s+return jsonb_build_object\([\s\S]*?'state', 'teacher_mismatch'/i)
  assert.doesNotMatch(completion, /coalesce\(v_session\.instructional_teacher|set instructional_teacher\s*=/i)
})
