import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const facilitator = fs.readFileSync(path.resolve('src/app/components/syllabus/FacilitatorSyllabusLessonOverlay.js'), 'utf8')
const liftoff = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')
const migration = fs.readFileSync(path.resolve('supabase/migrations/20261009140847_enable_learner_snapshots_realtime.sql'), 'utf8')

test('facilitator Syllabus loads current Liftoff state from the durable learner snapshot', () => {
  assert.match(facilitator, /\/api\/snapshots\?/)
  assert.match(facilitator, /liftoffProgressFromSnapshot/)
  assert.match(facilitator, /feature\.kind !== 'slate-liftoff-v1'/)
  assert.match(facilitator, /feature\.occurrenceId/)
})

test('facilitator Syllabus subscribes to learner snapshot Postgres changes', () => {
  assert.match(facilitator, /getSupabaseClient/)
  assert.match(facilitator, /realtime\.setAuth\(accessToken\)/)
  assert.match(facilitator, /table: 'learner_snapshots'/)
  assert.match(facilitator, /learner_id=eq\./)
  assert.match(facilitator, /setLiftoffProgress\(progress\)/)
  assert.match(facilitator, /removeChannel\(channel\)/)
})

test('facilitator objective progress is visible without a completed-session gate', () => {
  assert.match(facilitator, /Mr\. Slate objectives/)
  assert.match(facilitator, /type="checkbox"/)
  assert.match(facilitator, /checked=\{demonstrated\}/)
  assert.match(facilitator, /evidenceLabel/)
  assert.match(facilitator, /evidenceState\.replaceAll/)
  assert.match(facilitator, /No Liftoff objectives yet/)
  assert.match(facilitator, /Live updates connected/)
  assert.doesNotMatch(facilitator, /displayTeacher === 'slate' && actualKind === 'completed' && \(liftoffRecordLoading \|\| liftoffRecord\)/)
})

test('completed record is archival fallback instead of the required live source', () => {
  assert.match(facilitator, /liftoffProgressFromRecord/)
  assert.match(facilitator, /source: 'completed_record'/)
  assert.match(facilitator, /source: 'live_snapshot'/)
})

test('learner persists Liftoff snapshot at start and after each active turn', () => {
  assert.match(liftoff, /saveProgress\('liftoff-start'/)
  assert.match(liftoff, /persistLiftoffSnapshot\(\{\s*phase: 'active', liftoff: nextState, slateText: turn\.learnerMessage, pendingAdvance: advance/)
})

test('migration publishes learner snapshots to Supabase Realtime idempotently', () => {
  assert.match(migration, /pg_publication_tables/)
  assert.match(migration, /pubname = 'supabase_realtime'/)
  assert.match(migration, /tablename = 'learner_snapshots'/)
  assert.match(migration, /alter publication supabase_realtime add table public\.learner_snapshots/)
})
