import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import {
  resolveEvidenceSessionProvenance,
  resolveSlateLiftoffProviderProvenance,
  resolveSlateProviderProvenance,
} from '../masteryEvidence/provenance.js'

const migration = fs.readFileSync(path.resolve('supabase/migrations/20261007145500_add_slate_liftoff_records.sql'), 'utf8')
const recordRoute = fs.readFileSync(path.resolve('src/app/api/slate-liftoff/records/route.js'), 'utf8')
const liftoffRoute = fs.readFileSync(path.resolve('src/app/api/slate-liftoff/route.js'), 'utf8')
const experience = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')
const testSelection = fs.readFileSync(path.resolve('src/app/lib/slateLiftoffTest.mjs'), 'utf8')
const overlay = fs.readFileSync(path.resolve('src/app/components/syllabus/FacilitatorSyllabusLessonOverlay.js'), 'utf8')
const evidenceRoute = fs.readFileSync(path.resolve('src/app/api/evidence/route.js'), 'utf8')
const evidenceClient = fs.readFileSync(path.resolve('src/app/lib/masteryEvidence/client.js'), 'utf8')
const learnerHome = fs.readFileSync(path.resolve('src/app/learn/LearnerHome.js'), 'utf8')

test('Liftoff process records are server-only process evidence, not mastery claims', () => {
  assert.match(migration, /create table public\.slate_liftoff_records/i)
  assert.match(migration, /component_state jsonb/i)
  assert.match(migration, /responsibility_trace jsonb/i)
  assert.match(migration, /grant select, insert on table public\.slate_liftoff_records to service_role/i)
  assert.match(migration, /create index slate_liftoff_records_learner_idx\s+on public\.slate_liftoff_records\(learner_id\)/i)
  assert.doesNotMatch(migration, /grant [^;]*(anon|authenticated)/i)
  assert.match(migration, /does not independently assert mastery or retention/i)
})

test('Liftoff record writes require a completed protected Slate execution and exact provenance', () => {
  assert.match(recordRoute, /execution\.instructional_teacher !== 'slate'/)
  assert.match(recordRoute, /execution\.ended_reason !== 'completed'/)
  assert.match(recordRoute, /metadata\.syllabus_occurrence_id/)
  assert.match(recordRoute, /metadata\.instructional_teacher !== 'slate'/)
  assert.match(recordRoute, /metadata\.source !== 'slate-liftoff'/)
  assert.match(recordRoute, /execution_session_id: executionSessionId/)
})

test('facilitator record retrieval remains learner-owned and occurrence-scoped', () => {
  assert.match(recordRoute, /\.eq\('facilitator_id', context\.user\.id\)/)
  assert.match(recordRoute, /\.eq\('learner_id', learnerId\)/)
  assert.match(recordRoute, /if \(occurrenceId\) query = query\.eq\('syllabus_occurrence_id', occurrenceId\)/)
})

test('final independent test sources are not exposed to the Liftoff model prompt', () => {
  assert.doesNotMatch(liftoffRoute, /shortanswer:\s*compactRows/)
  assert.doesNotMatch(liftoffRoute, /wordProblems:\s*compactRows/)
  assert.doesNotMatch(liftoffRoute, /test:\s*compactRows/)
  assert.match(testSelection, /Array\.isArray\(lesson\.wordProblems\)/)
  assert.match(testSelection, /Array\.isArray\(lesson\.shortanswer\)/)
  assert.match(experience, /buildSlateLiftoffTestItems\(lesson\)/)
  assert.doesNotMatch(testSelection, /if \(!test\.length\)[\s\S]*lesson\.multiplechoice/)
})

test('completed Liftoff preserves snapshot until durable process evidence is saved', () => {
  const completionStart = experience.indexOf('const finishLesson = useCallback')
  const assessmentStart = experience.indexOf('const submitAssessmentAnswer = useCallback', completionStart)
  const completion = experience.slice(completionStart, assessmentStart)
  const recordIndex = completion.indexOf('recordSlateLiftoffEvidence')
  const deleteIndex = completion.indexOf('deleteSnapshot')
  assert.ok(recordIndex >= 0)
  assert.ok(deleteIndex > recordIndex)
  assert.match(completion, /if \(liftoffEvidenceSaved\)/)
})

test('facilitator lesson overlay exposes Liftoff evidence without claiming delayed retention', () => {
  assert.match(overlay, /\/api\/slate-liftoff\/records/)
  assert.match(overlay, /Mr\. Slate objectives/)
  assert.match(overlay, /type="checkbox"/)
  assert.match(overlay, /does not by itself establish delayed retention/)
})

test('protected Slate instruction receives Liftoff provenance instead of review or Sonoma provenance', () => {
  assert.match(evidenceRoute, /instructional_teacher, ended_at, ended_reason/)
  assert.match(evidenceRoute, /trackedTeacher === 'slate'/)
  assert.match(evidenceRoute, /resolveSlateLiftoffProviderProvenance\(\)/)
})

test('Slate provenance keeps protocol identity distinct while sharing the global OpenAI model handle', () => {
  const env = {
    OPENAI_MODEL: 'shared-model',
    SLATE_LIFTOFF_MODEL: 'ignored-liftoff-model',
    SONOMA_OPENAI_MODEL: 'ignored-review-model',
  }
  const review = resolveSlateProviderProvenance(env)
  const liftoff = resolveSlateLiftoffProviderProvenance(env)
  assert.equal(review.provider, 'deterministic_app')
  assert.equal(review.model, 'shared-model')
  assert.equal(review.teaching_protocol_version, 'slate-mastery-retention-v1')
  assert.equal(liftoff.provider, 'openai')
  assert.equal(liftoff.model, 'shared-model')
  assert.equal(liftoff.teaching_protocol_version, 'liftoff-instruction-v1')
  const restored = resolveEvidenceSessionProvenance({ teaching_protocol_version: 'liftoff-instruction-v1' }, env)
  assert.equal(restored.provider, 'openai')
  assert.equal(restored.model, 'shared-model')
})

test('mastery evidence client keeps the old source by default but permits Liftoff to name its source', () => {
  assert.match(evidenceClient, /eventSource = 'session-v2'/)
  assert.match(evidenceClient, /eventSource: normalizeText\(eventSource\) \|\| 'session-v2'/)
  assert.match(evidenceClient, /source: this\.meta\?\.eventSource \|\| 'session-v2'/)
  assert.match(experience, /eventSource: 'slate-liftoff'/)
})

test('only an isolated explicit reserved test enters canonical Liftoff mastery evidence', () => {
  assert.match(experience, /reservedTestItems\(loadedLesson\)/)
  assert.match(experience, /analyzeAssessmentIsolation/)
  assert.match(experience, /ASSESSMENT_ISOLATION_STATUSES\.ISOLATED/)
  assert.match(experience, /qualifyMasteryOpportunity/)
  assert.match(experience, /assessmentRole: ASSESSMENT_ROLES\.ASSESSMENT_RESERVED/)
  assert.match(experience, /recordMasteryCheckResult/)
  assert.match(experience, /if \(restartTransferredTest\) canonicalReservedTestRef\.current = \[\]/)
})

test('Liftoff preserves Mr. Slate Focus Flow controls and separates music from speech mute', () => {
  assert.match(experience, /\/media\/Focus%20Flow\.wav/)
  assert.match(experience, /mr_slate_background_music_volume/)
  assert.match(experience, /mr_slate_background_music_muted/)
  assert.match(experience, /RIGHT-CLICK OR HOLD FOR VOLUME/)
  assert.match(experience, /MUSIC ON/)
  assert.match(experience, /SPEECH ON/)
})

test('Slate instruction cannot consume a Golden Key until Slate has Golden Key semantics', () => {
  assert.match(learnerHome, /const goldenKeyTeacherEligible = currentTeacher === 'sonoma' \|\| currentTeacher === 'webb'/)
  assert.doesNotMatch(learnerHome, /goldenKeyTeacherEligible = [^\n]*slate/)
})
