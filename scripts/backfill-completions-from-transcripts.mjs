#!/usr/bin/env node

/**
 * Backfill missing lesson_session_events (completed) from transcript ledgers.
 *
 * Why:
 * - The Calendar history view only treats past scheduled lessons as "completed" when a
 *   lesson_session_events row exists with event_type='completed'.
 * - If a past lesson was finished but the session event was never written (older flows),
 *   transcript ledgers may still contain completedAt timestamps.
 *
 * What it does:
 * - Scans Supabase Storage bucket `transcripts` under `v1/<ownerId>/<learnerId>/...`.
 * - Reads `ledger.json` in both:
 *   - `v1/<ownerId>/<learnerId>/<lessonId>/ledger.json`
 *   - `v1/<ownerId>/<learnerId>/<lessonId>/sessions/<sessionId>/ledger.json`
 * - For each segment with a completedAt timestamp, inserts:
 *   - a `lesson_sessions` row (started_at/ended_at)
 *   - a `lesson_session_events` row with event_type='completed' and occurred_at=completedAt
 *
 * Safety:
 * - Default is dry-run.
 * - Dedupes by (canonical lesson id + local date) against existing completed events.
 *
 * Usage examples:
 *   node scripts/backfill-completions-from-transcripts.mjs --dry-run --learner Emma --from 2026-01-07 --to 2026-01-08
 *   node scripts/backfill-completions-from-transcripts.mjs --learner Emma --from 2026-01-07 --to 2026-01-08
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
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) return
      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '')
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
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
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

function parseArgs(argv) {
  const args = {
    dryRun: true,
    learnerNames: [],
    learnerId: null,
    from: null,
    to: null,
    tz: 'local',
    ownerId: null,
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
        .map(s => s.trim())
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

    if (token === '--owner-id') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --owner-id')
      args.ownerId = String(value)
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

function normalizeFacilitatorId(learnerRow) {
  return learnerRow?.facilitator_id || learnerRow?.owner_id || learnerRow?.user_id || null
}

async function listAll(store, prefix) {
  const all = []
  let offset = 0
  const pageSize = 1000

  for (;;) {
    const { data, error } = await store.list(prefix, { limit: pageSize, offset })
    if (error) throw new Error(`Storage list failed for ${prefix}: ${error.message}`)
    const page = data || []
    all.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }

  return all
}

async function downloadJson(store, filePath) {
  const { data, error } = await store.download(filePath)
  if (error) return null
  const text = await data.text()
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function extractLedgerSegments(ledgerJson) {
  if (!Array.isArray(ledgerJson)) return []
  const out = []
  for (const seg of ledgerJson) {
    const startedAt = seg?.startedAt || null
    const completedAt = seg?.completedAt || null
    if (!completedAt) continue
    out.push({ startedAt, completedAt })
  }
  return out
}

async function findOwnerIdsFromStorage(store, learnerId) {
  const ownerIds = new Set()
  const owners = await listAll(store, 'v1')
  for (const owner of owners) {
    if (!owner?.name) continue
    const candidate = `v1/${owner.name}/${learnerId}`
    const { data, error } = await store.list(candidate, { limit: 1 })
    if (!error && data && data.length) {
      ownerIds.add(owner.name)
    }
  }
  return Array.from(ownerIds)
}

async function run() {
  loadEnvFiles()
  const args = parseArgs(process.argv)

  const supabase = getSupabaseAdminClient()
  const store = supabase.storage.from('transcripts')

  const learners = await fetchAllRows(() =>
    supabase
      .from('learners')
      .select('id, name, facilitator_id, owner_id, user_id')
      .order('name', { ascending: true })
  )

  let targetLearners = []
  if (args.learnerId) {
    targetLearners = learners.filter(l => l?.id === args.learnerId)
  } else {
    const set = new Set(args.learnerNames.map(n => n.toLowerCase()))
    targetLearners = learners.filter(l => set.has(String(l?.name || '').toLowerCase()))
  }

  if (targetLearners.length === 0) {
    throw new Error('No learners matched the provided filter')
  }

  for (const learner of targetLearners) {
    const facilitatorId = normalizeFacilitatorId(learner)
    if (!facilitatorId) {
      console.log(`\n=== ${learner.name} (${learner.id}) ===`)
      console.log('Missing facilitator_id/owner_id/user_id; cannot backfill')
      continue
    }

    console.log(`\n=== Backfill completions from transcripts for ${learner.name} (${learner.id}) ===`)
    console.log(`Mode: ${args.dryRun ? 'DRY RUN (no writes)' : 'WRITE'}`)
    console.log(`Date filter (${args.tz}): ${args.from} .. ${args.to}`)

    const ownerCandidates = []
    if (args.ownerId) ownerCandidates.push(args.ownerId)
    ownerCandidates.push(...[learner.facilitator_id, learner.owner_id, learner.user_id].filter(Boolean))

    let ownerIds = Array.from(new Set(ownerCandidates.filter(id => typeof id === 'string' && id.length > 0)))
    if (ownerIds.length === 0) {
      ownerIds = await findOwnerIdsFromStorage(store, learner.id)
    }

    if (ownerIds.length === 0) {
      console.log('No owner folders found in transcripts; skipping')
      continue
    }

    // Existing completed events (for dedupe)
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
        .map(r => {
          const key = canonicalLessonId(r?.lesson_id)
          const dateStr = toDateStr(r?.occurred_at, args.tz)
          if (!key || !dateStr) return null
          return `${key}|${dateStr}`
        })
        .filter(Boolean)
    )

    let scannedLedgers = 0
    let candidateSegments = 0
    let wouldInsert = 0
    let inserted = 0

    for (const ownerId of ownerIds) {
      const base = `v1/${ownerId}/${learner.id}`
      console.log(`Owner folder: ${base}`)

      const lessonFolders = await listAll(store, base)
      const lessons = (lessonFolders || []).filter(e => e?.name && !e.name.includes('.'))

      if (lessons.length === 0) {
        console.log('  (no lesson transcript folders)')
        continue
      }

      for (const lessonEntry of lessons) {
        const lessonId = lessonEntry.name
        const lessonBase = `${base}/${lessonId}`

        // (A) Base ledger
        const baseLedgerPath = `${lessonBase}/ledger.json`
        const baseLedger = await downloadJson(store, baseLedgerPath)
        if (baseLedger) {
          scannedLedgers += 1
          const segments = extractLedgerSegments(baseLedger)
          for (const seg of segments) {
            const dateStr = toDateStr(seg.completedAt, args.tz)
            if (!dateStr || dateStr < args.from || dateStr > args.to) continue
            candidateSegments += 1
            const canon = canonicalLessonId(lessonId)
            const dedupeKey = `${canon}|${dateStr}`
            if (existingKeySet.has(dedupeKey)) continue

            wouldInsert += 1
            if (args.dryRun) continue

            const startedAt = seg.startedAt || seg.completedAt
            const endedAt = seg.completedAt
            const { data: sessionRow, error: sessionErr } = await supabase
              .from('lesson_sessions')
              .insert({ learner_id: learner.id, lesson_id: lessonId, started_at: startedAt, ended_at: endedAt })
              .select('id')
              .single()

            if (sessionErr) throw new Error(`lesson_sessions insert failed: ${sessionErr.message}`)

            const { error: eventErr } = await supabase
              .from('lesson_session_events')
              .insert({
                session_id: sessionRow.id,
                learner_id: learner.id,
                lesson_id: lessonId,
                event_type: 'completed',
                occurred_at: endedAt,
                metadata: { source: 'transcripts-backfill', transcript_path: baseLedgerPath }
              })

            if (eventErr) throw new Error(`lesson_session_events insert failed: ${eventErr.message}`)

            inserted += 1
            existingKeySet.add(dedupeKey)
          }
        }

        // (B) Session ledgers
        const sessionsPath = `${lessonBase}/sessions`
        let sessions = []
        try {
          sessions = await listAll(store, sessionsPath)
        } catch {
          sessions = []
        }

        for (const sessionEntry of sessions) {
          if (!sessionEntry?.name) continue
          const sessionLedgerPath = `${sessionsPath}/${sessionEntry.name}/ledger.json`
          const sessionLedger = await downloadJson(store, sessionLedgerPath)
          if (!sessionLedger) continue

          scannedLedgers += 1
          const segments = extractLedgerSegments(sessionLedger)
          for (const seg of segments) {
            const dateStr = toDateStr(seg.completedAt, args.tz)
            if (!dateStr || dateStr < args.from || dateStr > args.to) continue
            candidateSegments += 1
            const canon = canonicalLessonId(lessonId)
            const dedupeKey = `${canon}|${dateStr}`
            if (existingKeySet.has(dedupeKey)) continue

            wouldInsert += 1
            if (args.dryRun) continue

            const startedAt = seg.startedAt || seg.completedAt
            const endedAt = seg.completedAt
            const { data: sessionRow, error: sessionErr } = await supabase
              .from('lesson_sessions')
              .insert({ learner_id: learner.id, lesson_id: lessonId, started_at: startedAt, ended_at: endedAt })
              .select('id')
              .single()

            if (sessionErr) throw new Error(`lesson_sessions insert failed: ${sessionErr.message}`)

            const { error: eventErr } = await supabase
              .from('lesson_session_events')
              .insert({
                session_id: sessionRow.id,
                learner_id: learner.id,
                lesson_id: lessonId,
                event_type: 'completed',
                occurred_at: endedAt,
                metadata: { source: 'transcripts-backfill', transcript_path: sessionLedgerPath }
              })

            if (eventErr) throw new Error(`lesson_session_events insert failed: ${eventErr.message}`)

            inserted += 1
            existingKeySet.add(dedupeKey)
          }
        }
      }
    }

    console.log(`\nSummary for ${learner.name}:`)
    console.log(`- Ledgers scanned: ${scannedLedgers}`)
    console.log(`- Candidate completed segments (in date range): ${candidateSegments}`)
    console.log(`- ${args.dryRun ? 'Would insert' : 'Inserted'} completions: ${args.dryRun ? wouldInsert : inserted}`)
  }
}

run().catch((err) => {
  console.error(String(err?.stack || err?.message || err))
  process.exit(1)
})
