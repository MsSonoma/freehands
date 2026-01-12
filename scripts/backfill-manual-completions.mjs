#!/usr/bin/env node

/**
 * Backfill missing completion signals + medals for specific lessons/dates.
 *
 * What it writes:
 * - lesson_sessions: started_at + ended_at (date-only backfill uses local noon)
 * - lesson_session_events: started + completed (completed.occurred_at == ended_at)
 * - learner_medals: user_id (facilitator id), learner_id, lesson_key, best_percent, medal_tier
 *
 * Why:
 * - Calendar history requires lesson_session_events(event_type='completed')
 * - Medals require learner_medals rows
 *
 * Usage:
 *   node scripts/backfill-manual-completions.mjs --dry-run --file scripts/manual-backfill-emma-2026-01-07-08.json
 *   node scripts/backfill-manual-completions.mjs --write   --file scripts/manual-backfill-emma-2026-01-07-08.json
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
    for (const line of content.split(/\r?\n/)) {
      const trimmed = String(line || '').trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    }
  }
}

function parseArgs(argv) {
  const args = { dryRun: true, file: null }
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
    if (token === '--file') {
      args.file = String(argv[i + 1] || '').trim()
      i += 1
      continue
    }
    throw new Error(`Unknown arg: ${token}`)
  }
  if (!args.file) throw new Error('Provide --file <json config path>')
  return args
}

function canonicalLessonId(raw) {
  if (!raw) return null
  const normalized = normalizeLessonKey(String(raw)) || String(raw)
  const base = normalized.includes('/') ? normalized.split('/').pop() : normalized
  const withoutExt = String(base || '').replace(/\.json$/i, '')
  return withoutExt || null
}

function tierForPercent(pct) {
  const n = Number(pct)
  if (!Number.isFinite(n)) return null
  if (n >= 90) return 'gold'
  if (n >= 80) return 'silver'
  if (n >= 70) return 'bronze'
  return null
}

function localNoonIsoFromDateStr(dateStr) {
  const [y, m, d] = String(dateStr || '').split('-').map(n => Number(n))
  if (!y || !m || !d) return null
  const dt = new Date(y, m - 1, d, 12, 0, 0)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toISOString()
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

async function main() {
  loadEnvFiles()
  const { dryRun, file } = parseArgs(process.argv)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const absPath = path.resolve(process.cwd(), file)
  const config = JSON.parse(fs.readFileSync(absPath, 'utf8'))
  const learnerName = String(config?.learnerName || '').trim()
  const defaultPercent = Number(config?.defaultPercent ?? 90)
  const items = Array.isArray(config?.items) ? config.items : []

  if (!learnerName) throw new Error('Config missing learnerName')
  if (!items.length) throw new Error('Config items is empty')

  const { data: learner, error: learnerErr } = await supabase
    .from('learners')
    .select('id,name,facilitator_id,owner_id,user_id')
    .ilike('name', learnerName)
    .maybeSingle()

  if (learnerErr) throw new Error(learnerErr.message)
  if (!learner) throw new Error(`Learner not found: ${learnerName}`)

  const facilitatorId = normalizeFacilitatorId(learner)
  if (!facilitatorId) throw new Error('Learner row missing facilitator_id/owner_id/user_id')

  console.log(`\n=== Manual completion backfill for ${learner.name} (${learner.id}) ===`)
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'WRITE'}`)

  // Existing completed events for dedupe
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
        const canon = canonicalLessonId(r?.lesson_id)
        const occurred = r?.occurred_at
        if (!canon || !occurred) return null
        const dt = new Date(occurred)
        if (Number.isNaN(dt.getTime())) return null
        const yyyy = dt.getFullYear()
        const mm = String(dt.getMonth() + 1).padStart(2, '0')
        const dd = String(dt.getDate()).padStart(2, '0')
        return `${canon}|${yyyy}-${mm}-${dd}`
      })
      .filter(Boolean)
  )

  let wouldWrite = 0
  let didWrite = 0

  for (const raw of items) {
    const lessonKeyRaw = raw?.lesson_key
    const completedDate = raw?.completed_date
    const percent = Number.isFinite(Number(raw?.percent)) ? Number(raw.percent) : defaultPercent
    const note = typeof raw?.note === 'string' ? raw.note : null

    const lessonKey = normalizeLessonKey(lessonKeyRaw) || lessonKeyRaw
    const canon = canonicalLessonId(lessonKey)
    if (!lessonKey || !completedDate || !canon) {
      console.log('Skipping invalid item:', raw)
      continue
    }

    const dedupeKey = `${canon}|${completedDate}`
    if (existingKeySet.has(dedupeKey)) {
      console.log(`- SKIP already completed: ${completedDate} | ${lessonKey}`)
      continue
    }

    const completedAtIso = localNoonIsoFromDateStr(completedDate)
    if (!completedAtIso) throw new Error(`Invalid completed_date: ${completedDate}`)

    const medalTier = tierForPercent(percent)
    if (!medalTier) {
      console.log(`- WARN percent ${percent} has no medal tier (<70): ${lessonKey}`)
    }

    wouldWrite += 1

    if (dryRun) {
      console.log(`- WOULD backfill: completed=${completedDate} | ${lessonKey} | percent=${percent}`)
      continue
    }

    // Create a session row (minimal times; started_at == ended_at for date-only backfill)
    const { data: sessionRow, error: sessionErr } = await supabase
      .from('lesson_sessions')
      .insert({
        learner_id: learner.id,
        lesson_id: lessonKey,
        started_at: completedAtIso,
        ended_at: completedAtIso,
      })
      .select('id')
      .single()

    if (sessionErr) throw new Error(`lesson_sessions insert failed: ${sessionErr.message}`)

    const metadata = {
      source: 'manual-backfill',
      backfilled: true,
      date_only: true,
      note: note || undefined,
    }

    const { error: startedErr } = await supabase
      .from('lesson_session_events')
      .insert({
        session_id: sessionRow.id,
        learner_id: learner.id,
        lesson_id: lessonKey,
        event_type: 'started',
        occurred_at: completedAtIso,
        metadata,
      })

    if (startedErr) throw new Error(`lesson_session_events started insert failed: ${startedErr.message}`)

    const { error: completedErr } = await supabase
      .from('lesson_session_events')
      .insert({
        session_id: sessionRow.id,
        learner_id: learner.id,
        lesson_id: lessonKey,
        event_type: 'completed',
        occurred_at: completedAtIso,
        metadata: { ...metadata, percent },
      })

    if (completedErr) throw new Error(`lesson_session_events completed insert failed: ${completedErr.message}`)

    // Upsert medal row
    const medalPayload = {
      user_id: facilitatorId,
      learner_id: String(learner.id),
      lesson_key: String(canon),
      best_percent: Math.max(0, Math.min(100, Math.round(percent))),
      medal_tier: medalTier,
      updated_at: completedAtIso,
    }

    const { error: medalErr } = await supabase
      .from('learner_medals')
      .upsert(medalPayload, { onConflict: 'user_id,learner_id,lesson_key' })

    if (medalErr) throw new Error(`learner_medals upsert failed: ${medalErr.message}`)

    didWrite += 1
    existingKeySet.add(dedupeKey)

    console.log(`- WROTE completion+medal: completed=${completedDate} | ${lessonKey} | percent=${percent}`)
  }

  console.log('\nSummary:')
  console.log(`- ${dryRun ? 'Would write' : 'Wrote'}: ${dryRun ? wouldWrite : didWrite}`)
}

main().catch((err) => {
  console.error(String(err?.stack || err?.message || err))
  process.exit(1)
})
