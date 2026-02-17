import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

function loadEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return
    const raw = fs.readFileSync(filePath, 'utf8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = String(line || '').trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx <= 0) continue
      const key = trimmed.slice(0, idx).trim()
      let val = trimmed.slice(idx + 1).trim()
      if (!key) continue
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = val
    }
  } catch {
    // ignore
  }
}

function loadEnvFiles() {
  const repoRoot = process.cwd()
  loadEnvFile(path.join(repoRoot, '.env.local'))
  loadEnvFile(path.join(repoRoot, '.env'))
}

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env.local)')
  }
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function tierForPercent(p) {
  const n = Number(p)
  if (!Number.isFinite(n)) return null
  if (n >= 90) return 'gold'
  if (n >= 80) return 'silver'
  if (n >= 70) return 'bronze'
  return null
}

function toSet(arr) {
  return new Set((Array.isArray(arr) ? arr : []).filter(Boolean))
}

function setDiff(a, b) {
  const out = []
  for (const item of a) {
    if (!b.has(item)) out.push(item)
  }
  out.sort((x, y) => String(x).localeCompare(String(y)))
  return out
}

function summarize(items, max = 20) {
  const list = Array.isArray(items) ? items : []
  if (list.length <= max) return list
  return [...list.slice(0, max), `... (+${list.length - max} more)`]
}

async function findLearnersByName(supabase, nameLike) {
  const term = String(nameLike || '').trim() || 'emma'
  const { data, error } = await supabase
    .from('learners')
    .select('id,name,grade,facilitator_id,owner_id,user_id,created_at')
    .ilike('name', `%${term}%`)
    .limit(50)
    .order('name', { ascending: true })
  if (error) throw error
  return Array.isArray(data) ? data : []
}

async function getLearnerOwnerId(supabase, learnerId) {
  const { data, error } = await supabase
    .from('learners')
    .select('id, facilitator_id, owner_id, user_id')
    .eq('id', learnerId)
    .maybeSingle()
  if (error) return null
  return data?.user_id || data?.owner_id || data?.facilitator_id || null
}

async function fetchHistory(supabase, learnerId) {
  const { data: sessions, error: sessionsErr } = await supabase
    .from('lesson_sessions')
    .select('id, lesson_id, started_at, ended_at')
    .eq('learner_id', learnerId)
    .not('ended_at', 'is', null)
    .order('ended_at', { ascending: true })
  if (sessionsErr) throw sessionsErr

  const { data: events, error: eventsErr } = await supabase
    .from('lesson_session_events')
    .select('id, lesson_id, occurred_at, metadata')
    .eq('learner_id', learnerId)
    .eq('event_type', 'completed')
    .order('occurred_at', { ascending: true })
  if (eventsErr) throw eventsErr

  return {
    sessions: Array.isArray(sessions) ? sessions : [],
    completedEvents: Array.isArray(events) ? events : [],
  }
}

async function fetchMedals(supabase, learnerId) {
  const { data, error } = await supabase
    .from('learner_medals')
    .select('user_id, learner_id, lesson_key, best_percent, medal_tier, updated_at')
    .eq('learner_id', learnerId)
  if (error) throw error
  return Array.isArray(data) ? data : []
}

function buildBestPercentByLessonFromEvents(completedEvents) {
  const best = new Map()
  for (const ev of completedEvents || []) {
    const lessonId = ev?.lesson_id
    if (!lessonId) continue
    const pct = Number(ev?.metadata?.test_percentage)
    if (!Number.isFinite(pct)) continue
    const prev = best.get(lessonId)
    if (prev == null || pct > prev) best.set(lessonId, pct)
  }
  return best
}

async function backfillMissingMedals({ supabase, learnerId, userId, completedLessonIds, medalsByLessonKey, bestPercentByLesson, dryRun }) {
  const missing = []
  for (const lessonId of completedLessonIds) {
    if (medalsByLessonKey.has(lessonId)) continue
    const pct = bestPercentByLesson.get(lessonId)
    if (!Number.isFinite(pct)) {
      missing.push({ lessonId, reason: 'no test_percentage in completed events' })
      continue
    }
    const tier = tierForPercent(pct)
    if (!tier) {
      missing.push({ lessonId, reason: `test_percentage ${pct} < 70 (no medal tier)` })
      continue
    }
    if (!userId) {
      missing.push({ lessonId, reason: 'cannot resolve user_id for learner (needed for learner_medals upsert)' })
      continue
    }

    if (!dryRun) {
      const payload = {
        user_id: userId,
        learner_id: learnerId,
        lesson_key: lessonId,
        best_percent: pct,
        medal_tier: tier,
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase
        .from('learner_medals')
        .upsert(payload, { onConflict: 'user_id,learner_id,lesson_key' })
      if (error) {
        missing.push({ lessonId, reason: `upsert failed: ${error.message || String(error)}` })
        continue
      }
    }
  }
  return missing
}

async function backfillMissingHistoryFromMedals({ supabase, learnerId, medalsRows, completedLessonIds, dryRun }) {
  const missing = []
  const completedSet = toSet(completedLessonIds)

  for (const row of medalsRows || []) {
    const lessonKey = row?.lesson_key
    if (!lessonKey) continue
    if (completedSet.has(lessonKey)) continue

    const occurredAt = row?.updated_at || new Date().toISOString()

    if (!dryRun) {
      const sessionPayload = {
        learner_id: learnerId,
        lesson_id: lessonKey,
        started_at: occurredAt,
        ended_at: occurredAt,
        last_activity_at: occurredAt,
        device_name: 'backfill-from-medals',
      }

      const { data: inserted, error: insertErr } = await supabase
        .from('lesson_sessions')
        .insert(sessionPayload)
        .select('id')
        .single()

      if (insertErr) {
        missing.push({ lessonId: lessonKey, reason: `lesson_sessions insert failed: ${insertErr.message || String(insertErr)}` })
        continue
      }

      const sessionId = inserted?.id
      if (sessionId) {
        const eventPayload = {
          session_id: sessionId,
          learner_id: learnerId,
          lesson_id: lessonKey,
          event_type: 'completed',
          occurred_at: occurredAt,
          metadata: {
            source: 'backfill-from-medals',
            best_percent: Number(row?.best_percent) || 0,
            medal_tier: row?.medal_tier || null,
          },
        }

        const { error: eventErr } = await supabase
          .from('lesson_session_events')
          .insert(eventPayload)

        if (eventErr) {
          missing.push({ lessonId: lessonKey, reason: `lesson_session_events insert failed: ${eventErr.message || String(eventErr)}` })
        }
      }
    }
  }

  return missing
}

function usage() {
  console.log('Usage:')
  console.log('  node scripts/debug-emma-mismatch.mjs find <nameLike>')
  console.log('  node scripts/debug-emma-mismatch.mjs diff <learnerId>')
  console.log('  node scripts/debug-emma-mismatch.mjs backfill <learnerId> [--apply]')
  console.log('')
  console.log('Notes:')
  console.log('  - Loads .env.local/.env automatically for SUPABASE_SERVICE_ROLE_KEY')
  console.log('  - backfill is dry-run unless you pass --apply')
}

async function main() {
  loadEnvFiles()
  const supabase = getSupabaseAdminClient()

  const cmd = String(process.argv[2] || '').trim().toLowerCase()
  const arg = process.argv[3]
  const dryRun = !process.argv.includes('--apply')

  if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
    usage()
    return
  }

  if (cmd === 'find') {
    const rows = await findLearnersByName(supabase, arg)
    console.log(JSON.stringify(rows, null, 2))
    return
  }

  if (cmd === 'diff' || cmd === 'backfill') {
    const learnerId = String(arg || '').trim()
    if (!learnerId) {
      usage()
      process.exit(1)
    }

    const [history, medals] = await Promise.all([
      fetchHistory(supabase, learnerId),
      fetchMedals(supabase, learnerId).catch(() => []),
    ])

    const completedLessonIds = Array.from(
      new Set((history.sessions || []).map((s) => s?.lesson_id).filter(Boolean))
    )
    completedLessonIds.sort((a, b) => String(a).localeCompare(String(b)))
    const completedSet = toSet(completedLessonIds)

    const medalLessonKeys = Array.from(new Set((medals || []).map((m) => m?.lesson_key).filter(Boolean)))
    medalLessonKeys.sort((a, b) => String(a).localeCompare(String(b)))
    const medalsSet = toSet(medalLessonKeys)

    const onlyInHistory = setDiff(completedSet, medalsSet)
    const onlyInMedals = setDiff(medalsSet, completedSet)

    console.log(JSON.stringify({
      learnerId,
      counts: {
        completedSessions: history.sessions.length,
        completedEvents: history.completedEvents.length,
        distinctCompletedLessons: completedLessonIds.length,
        distinctMedalLessons: medalLessonKeys.length,
        onlyInHistory: onlyInHistory.length,
        onlyInMedals: onlyInMedals.length,
      },
      onlyInHistory: summarize(onlyInHistory, 50),
      onlyInMedals: summarize(onlyInMedals, 50),
    }, null, 2))

    if (cmd === 'diff') return

    // backfill mode
    const medalsByLessonKey = new Map()
    for (const row of medals || []) {
      if (row?.lesson_key) medalsByLessonKey.set(row.lesson_key, row)
    }
    const bestPercentByLesson = buildBestPercentByLessonFromEvents(history.completedEvents)

    const inferredUserId = (medals || []).find((r) => r?.user_id)?.user_id || (await getLearnerOwnerId(supabase, learnerId))

    console.log(JSON.stringify({
      dryRun,
      inferredUserId: inferredUserId || null,
      note: dryRun ? 'Pass --apply to write changes' : 'Applying changes'
    }, null, 2))

    const missingMedalsReasons = await backfillMissingMedals({
      supabase,
      learnerId,
      userId: inferredUserId,
      completedLessonIds,
      medalsByLessonKey,
      bestPercentByLesson,
      dryRun,
    })

    const missingHistoryReasons = await backfillMissingHistoryFromMedals({
      supabase,
      learnerId,
      medalsRows: medals,
      completedLessonIds,
      dryRun,
    })

    console.log(JSON.stringify({
      result: {
        missingMedals: missingMedalsReasons.length,
        missingHistory: missingHistoryReasons.length,
      },
      missingMedalsSample: summarize(missingMedalsReasons, 20),
      missingHistorySample: summarize(missingHistoryReasons, 20),
    }, null, 2))
    return
  }

  usage()
  process.exit(1)
}

main().catch((err) => {
  console.error('ERROR:', err?.message || err)
  process.exit(1)
})
