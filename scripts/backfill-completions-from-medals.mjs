#!/usr/bin/env node

/**
 * Backfill missing lesson_session_events (completed) from learner_medals rows.
 *
 * Why:
 * - The Learn -> Completed Lessons timeline can show deep history because medals are stored.
 * - The Calendar history view depends on lesson_session_events(event_type='completed').
 * - Older/legacy lessons may have medals without any session events.
 *
 * What it does:
 * - For each learner_medals row (optionally filtered by date window), inserts:
 *   - a lesson_sessions row (started_at/ended_at at the medal timestamp)
 *   - a lesson_session_events row with event_type='completed'
 * - Dedupes against existing completed events by (canonical lesson id + YYYY-MM-DD).
 *
 * Safety:
 * - Default is dry-run.
 *
 * Usage:
 *   node scripts/backfill-completions-from-medals.mjs --dry-run --learner Emma --from 2025-09-01 --to 2025-10-31
 *   node scripts/backfill-completions-from-medals.mjs --write   --learner Emma --from 2025-09-01 --to 2025-10-31
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { normalizeLessonKey } from '../src/app/lib/lessonKeyNormalization.js'

function loadEnvFiles() {
  const candidates = ['.env.local', '.env']
  const root = path.resolve(process.cwd())

  for (const filename of candidates) {
    const fullPath = path.join(root, filename)
    if (!fs.existsSync(fullPath)) continue

    const content = fs.readFileSync(fullPath, 'utf8')
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = String(line || '').trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) return
      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed
        .slice(eqIndex + 1)
        .trim()
        .replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    })
  }
}

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Supabase environment variables NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function canonicalLessonId(raw) {
  if (!raw) return null
  const normalized = normalizeLessonKey(String(raw)) || String(raw)
  const base = normalized.includes('/') ? normalized.split('/').pop() : normalized
  const withoutExt = String(base || '').replace(/\.json$/i, '')
  return withoutExt || null
}

function toDateStr(dateLike, tz) {
  const dt = new Date(dateLike)
  if (Number.isNaN(dt.getTime())) return null

  if (tz === 'utc') {
    return dt.toISOString().split('T')[0]
  }

  const year = dt.getFullYear()
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function fetchAllRows(queryFactory, pageSize = 1000) {
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const query = queryFactory().range(offset, offset + pageSize - 1)
    const { data, error } = await query
    if (error) throw new Error(error.message)
    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

function parseArgs(argv) {
  const args = {
    dryRun: true,
    learnerNames: [],
    learnerId: null,
    from: null,
    to: null,
    tz: 'local',
  }

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]

    if (token === '--dry-run') {
      args.dryRun = true
      continue
    }

    if (token === '--write') {
      args.dryRun = false
      continue
    }

    if (token === '--learner') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --learner')
      const parts = String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      args.learnerNames.push(...parts)
      i += 1
      continue
    }

    if (token === '--learner-id') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --learner-id')
      args.learnerId = String(value)
      i += 1
      continue
    }

    if (token === '--from') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --from (YYYY-MM-DD)')
      args.from = String(value)
      i += 1
      continue
    }

    if (token === '--to') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --to (YYYY-MM-DD)')
      args.to = String(value)
      i += 1
      continue
    }

    if (token === '--tz') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --tz (local|utc)')
      args.tz = String(value).toLowerCase()
      i += 1
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  if (args.tz !== 'local' && args.tz !== 'utc') {
    throw new Error('Invalid --tz; expected local or utc')
  }

  if (!args.from || !args.to) {
    throw new Error('Missing required --from and/or --to (YYYY-MM-DD)')
  }

  if (!args.learnerId && args.learnerNames.length === 0) {
    throw new Error('Provide --learner <Name> or --learner-id <uuid>')
  }

  return args
}

function normalizeFacilitatorId(learnerRow) {
  return learnerRow?.facilitator_id || learnerRow?.owner_id || learnerRow?.user_id || null
}

async function loadTargetLearners(supabase, args) {
  const learners = await fetchAllRows(() =>
    supabase
      .from('learners')
      .select('id, name, facilitator_id, owner_id, user_id')
      .order('name', { ascending: true })
  )

  if (args.learnerId) {
    const matched = learners.filter((l) => String(l?.id) === String(args.learnerId))
    if (matched.length === 0) throw new Error(`No learners matched --learner-id ${args.learnerId}`)
    return matched
  }

  const set = new Set(args.learnerNames.map((n) => n.toLowerCase()))
  const matched = learners.filter((l) => set.has(String(l?.name || '').toLowerCase()))
  if (matched.length === 0) throw new Error(`No learners matched --learner names: ${args.learnerNames.join(', ')}`)
  return matched
}

async function run() {
  loadEnvFiles()
  const args = parseArgs(process.argv)

  console.log(`Mode: ${args.dryRun ? 'DRY RUN (no writes)' : 'WRITE'}`)
  console.log(`Date filter (${args.tz}): ${args.from} .. ${args.to}`)

  const supabase = getSupabaseAdminClient()
  const targetLearners = await loadTargetLearners(supabase, args)

  console.log(`Learners matched: ${targetLearners.length}`)

  for (const learner of targetLearners) {
    const facilitatorId = normalizeFacilitatorId(learner)
    if (!facilitatorId) {
      console.log(`\n=== ${learner.name} (${learner.id}) ===`)
      console.log('Missing facilitator_id/owner_id/user_id; cannot backfill')
      continue
    }

    console.log(`\n=== Backfill completions from medals for ${learner.name} (${learner.id}) ===`)

    const existingCompleted = await fetchAllRows(() =>
      supabase
        .from('lesson_session_events')
        .select('lesson_id, occurred_at')
        .eq('learner_id', learner.id)
        .eq('event_type', 'completed')
        .order('occurred_at', { ascending: false })
    )

    const existingKeySet = new Set(
      (existingCompleted || [])
        .map((r) => {
          const key = canonicalLessonId(r?.lesson_id)
          const dateStr = toDateStr(r?.occurred_at, args.tz)
          if (!key || !dateStr) return null
          return `${key}|${dateStr}`
        })
        .filter(Boolean)
    )

    // Fetch medals. In DB, earnedAt is stored as updated_at.
    const medalRows = await fetchAllRows(() =>
      supabase
        .from('learner_medals')
        .select('id, learner_id, lesson_key, best_percent, medal_tier, updated_at, user_id')
        .eq('learner_id', String(learner.id))
        .order('updated_at', { ascending: true })
    )

    let scanned = 0
    let candidate = 0
    let wouldInsert = 0
    let inserted = 0

    for (const medalRow of medalRows) {
      scanned += 1
      const lessonKey = medalRow?.lesson_key
      const occurredAt = medalRow?.updated_at
      if (!lessonKey || !occurredAt) continue

      const dateStr = toDateStr(occurredAt, args.tz)
      if (!dateStr || dateStr < args.from || dateStr > args.to) continue

      candidate += 1

      const canon = canonicalLessonId(lessonKey)
      if (!canon) continue

      const dedupeKey = `${canon}|${dateStr}`
      if (existingKeySet.has(dedupeKey)) continue

      wouldInsert += 1
      if (args.dryRun) continue

      const { data: sessionRow, error: sessionErr } = await supabase
        .from('lesson_sessions')
        .insert({ learner_id: learner.id, lesson_id: lessonKey, started_at: occurredAt, ended_at: occurredAt })
        .select('id')
        .single()

      if (sessionErr) throw new Error(`lesson_sessions insert failed: ${sessionErr.message}`)

      const { error: eventErr } = await supabase
        .from('lesson_session_events')
        .insert({
          session_id: sessionRow.id,
          learner_id: learner.id,
          lesson_id: lessonKey,
          event_type: 'completed',
          occurred_at: occurredAt,
          metadata: {
            source: 'medals-backfill',
            medals_row_id: medalRow?.id ?? null,
            best_percent: medalRow?.best_percent ?? null,
            medal_tier: medalRow?.medal_tier ?? null,
            medals_updated_at: occurredAt,
          },
        })

      if (eventErr) throw new Error(`lesson_session_events insert failed: ${eventErr.message}`)

      inserted += 1
      existingKeySet.add(dedupeKey)
    }

    console.log(`Summary for ${learner.name}:`)
    console.log(`- Medals scanned: ${scanned}`)
    console.log(`- Medals in date range: ${candidate}`)
    console.log(`- ${args.dryRun ? 'Would insert' : 'Inserted'} completions: ${args.dryRun ? wouldInsert : inserted}`)
  }
}

run().catch((err) => {
  console.error(String(err?.stack || err?.message || err))
  process.exit(1)
})
