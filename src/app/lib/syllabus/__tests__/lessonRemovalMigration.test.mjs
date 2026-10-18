import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const sql = fs.readFileSync(
  new URL('../../../../../supabase/migrations/20261018162000_facilitator_lesson_removal_overrides.sql', import.meta.url),
  'utf8',
)

test('a PIN-authorized removal is recorded persistently under the learner and facilitator', () => {
  assert.match(sql, /create table if not exists public\.syllabus_lesson_removals/i)
  assert.match(sql, /unique \(facilitator_id, learner_id, lesson_key, occurrence_id\)/)
  assert.match(sql, /evidence_disposition in \('keep', 'delete'\)/)
  assert.match(sql, /revoke all on function public\.record_facilitator_lesson_removal[\s\S]*from public, anon, authenticated/)
  assert.match(sql, /grant execute on function public\.record_facilitator_lesson_removal[\s\S]*to service_role/)
})

test('keeping evidence releases active lesson ownership without deleting learning history', () => {
  const keepStart = sql.indexOf("if p_evidence_disposition = 'keep' then")
  const deleteStart = sql.indexOf("if p_evidence_disposition = 'delete' then")
  assert.ok(keepStart >= 0 && deleteStart > keepStart)
  const keep = sql.slice(keepStart, deleteStart)
  assert.match(keep, /ended_reason = 'released'/)
  assert.match(keep, /public\.lesson_session_events/)
  assert.match(keep, /'exited'/)
  assert.doesNotMatch(keep, /delete from/)
})

test('deleting evidence is exact-session scoped, cleans review anchors, and avoids clearing the whole lesson', () => {
  assert.match(sql, /delete from public\.learning_review_items/)
  assert.match(sql, /delete from public\.learning_evidence_sessions/)
  assert.match(sql, /delete from public\.lesson_sessions/)
  assert.match(sql, /id = any\(p_execution_session_ids\)/)
  assert.match(sql, /evidence\.session_id = any\(v_session_identifiers\)/)
  assert.doesNotMatch(sql, /truncate\s+table/i)
  assert.doesNotMatch(sql, /delete from public\.syllabus_forecast_items/i)
})
