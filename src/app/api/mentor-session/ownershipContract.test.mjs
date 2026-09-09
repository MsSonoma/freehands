import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, '../../../..')
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8')

const route = read('src/app/api/mentor-session/route.js')
const client = read('src/app/facilitator/generator/counselor/CounselorClient.jsx')
const chronograph = read('src/app/api/mentor-chronograph/route.js')
const migration = read('supabase/migrations/20260909012000_harden_mentor_session_ownership.sql')

test('Mentor ownership migration keeps durable conversation separate from the temporary lease', () => {
  assert.match(migration, /ended_reason in \('taken_over', 'expired', 'released', 'force_ended'\)/)
  assert.match(migration, /create or replace function public\.acquire_mentor_session_transactional/)
  assert.match(migration, /coalesce\(last_activity_at, created_at\) < v_cutoff/)
  assert.match(migration, /set is_active = false,\s*ended_reason = 'expired'/s)
  assert.match(migration, /p_expected_conflicting_session_id <> v_active\.id/)
  assert.match(migration, /ended_reason = 'taken_over'/)
  assert.match(migration, /create or replace function public\.heartbeat_mentor_session/)

  const acquireStart = migration.indexOf('create or replace function public.acquire_mentor_session_transactional')
  const heartbeatStart = migration.indexOf('create or replace function public.heartbeat_mentor_session')
  const acquireBody = migration.slice(acquireStart, heartbeatStart)
  assert.doesNotMatch(acquireBody, /delete from public\.mentor_conversation_threads/i)
})

test('Mentor durable thread writes and clears are fenced by the exact active owner', () => {
  assert.match(migration, /create or replace function public\.write_mentor_thread_owned_transactional/)
  assert.match(migration, /where facilitator_id = p_facilitator_id\s+and session_id = p_session_id[\s\S]*for update;/)
  assert.match(migration, /v_session\.device_id is distinct from p_device_id/)
  assert.match(migration, /if not v_session\.is_active then/)
  assert.match(migration, /insert into public\.mentor_conversation_threads/)
  assert.match(migration, /on conflict \(facilitator_id, subject_key\)/)
  assert.match(migration, /create or replace function public\.clear_mentor_thread_owned_transactional/)
  assert.match(migration, /create or replace function public\.release_mentor_session_owned_transactional/)
})

test('Mentor API requires tab id plus device cookie and uses transactional ownership RPCs', () => {
  assert.match(route, /activeSession\.session_id === sessionId && activeSession\.device_id === deviceId/)
  assert.match(route, /rpc\('heartbeat_mentor_session'/)
  assert.match(route, /rpc\('acquire_mentor_session_transactional'/)
  assert.match(route, /p_expected_conflicting_session_id: expectedConflictId \|\| null/)
  assert.match(route, /rpc\('write_mentor_thread_owned_transactional'/)
  assert.match(route, /rpc\('clear_mentor_thread_owned_transactional'/)
  assert.match(route, /rpc\('release_mentor_session_owned_transactional'/)
  assert.doesNotMatch(route, /\.upsert\(threadUpdates/)
  assert.doesNotMatch(route, /Sessions never go stale/)
})

test('Mentor client carries one refresh-safe tab execution id through every owner-sensitive path', () => {
  assert.match(client, /sessionStorage\.getItem\('mr_mentor_execution_session_id'\)/)
  assert.match(client, /sessionStorage\.setItem\('mr_mentor_execution_session_id', id\)/)
  assert.doesNotMatch(client, /localStorage\.setItem\('mr_mentor_execution_session_id'/)
  assert.match(client, /mentor-session\?subjectKey=\$\{encodeURIComponent\(subjectKey\)\}&sessionId=\$\{encodeURIComponent\(localExecutionSessionId\)\}/)
  assert.match(client, /sessionId: localExecutionSessionId/)
  assert.match(client, /const payload = \{\s*subjectKey,\s*sessionId,/s)
  assert.match(client, /mentor-session\?subjectKey=\$\{encodeURIComponent\(subjectKey\)\}&sessionId=\$\{encodeURIComponent\(sessionId \|\| ''\)\}/)
  assert.match(client, /const nextExecutionSessionId = generateSessionIdentifier\(\)/)
  assert.match(client, /sessionId: nextExecutionSessionId,\s*expectedConflictId: conflictingSession\?\.id \|\| null/s)
  assert.match(client, /if \(createRes\.status === 409 && createData\?\.existingSession\)/)
  assert.doesNotMatch(client, /clearPersistedSessionIdentifier/)
})

test('legacy Mentor chronograph bridge forwards exact execution identity for owner-fenced reads and clears', () => {
  assert.match(chronograph, /const sessionId = \(searchParams\.get\('sessionId'\) \|\| ''\)\.trim\(\)/)
  assert.match(chronograph, /legacyUrl\.searchParams\.set\('sessionId', sessionId\)/)
  assert.match(chronograph, /body: JSON\.stringify\(\{[\s\S]*subjectKey,\s*sessionId,/)
})