#!/usr/bin/env node

/**
 * Verify lesson_session_events(completed) + learner_medals for a set of lesson keys.
 *
 * Usage:
 *   node scripts/check-completions-for-keys.mjs --learner Emma --from 2026-01-05 --to 2026-01-08
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
  const args = { learner: null, from: null, to: null }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--learner') {
      args.learner = String(argv[i + 1] || '').trim()
      i += 1
      continue
    }
    if (token === '--from') {
      args.from = String(argv[i + 1] || '').trim()
      i += 1
      continue
    }
    if (token === '--to') {
      args.to = String(argv[i + 1] || '').trim()
      i += 1
      continue
    }
    throw new Error(`Unknown arg: ${token}`)
  }
  if (!args.learner) throw new Error('Provide --learner <Name>')
  if (!args.from || !args.to) throw new Error('Provide --from and --to (YYYY-MM-DD)')
  return args
}

function canonicalLessonId(raw) {
  if (!raw) return null
  const normalized = normalizeLessonKey(String(raw)) || String(raw)
  const base = normalized.includes('/') ? normalized.split('/').pop() : normalized
  const withoutExt = String(base || '').replace(/\.json$/i, '')
  return withoutExt || null
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
  const { learner, from, to } = parseArgs(process.argv)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing env')

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const { data: learnerRow, error: learnerErr } = await supabase
    .from('learners')
    .select('id,name,facilitator_id,owner_id,user_id')
    .ilike('name', learner)
    .maybeSingle()

  if (learnerErr) throw new Error(learnerErr.message)
  if (!learnerRow) throw new Error('Learner not found')

  const schedule = await fetchAllRows(() =>
    supabase
      .from('lesson_schedule')
      .select('scheduled_date, lesson_key')
      .eq('learner_id', learnerRow.id)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .order('scheduled_date', { ascending: true })
  )

  const lessonKeys = Array.from(new Set((schedule || []).map(r => r.lesson_key).filter(Boolean)))
  const canonKeys = Array.from(new Set(lessonKeys.map(k => canonicalLessonId(k)).filter(Boolean)))

  console.log(`\nLearner: ${learnerRow.name} (${learnerRow.id})`)
  console.log(`Schedule rows in window ${from}..${to}: ${schedule.length}`)
  for (const r of schedule) console.log(`- ${r.scheduled_date} | ${r.lesson_key}`)

  const events = await fetchAllRows(() =>
    supabase
      .from('lesson_session_events')
      .select('lesson_id,event_type,occurred_at,metadata')
      .eq('learner_id', learnerRow.id)
      .in('event_type', ['completed'])
      .order('occurred_at', { ascending: true })
  )

  const filteredEvents = events.filter(e => {
    const canon = canonicalLessonId(e.lesson_id)
    const dt = new Date(e.occurred_at)
    const ymd = Number.isNaN(dt.getTime()) ? null : `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
    return canonKeys.includes(canon) && ymd && ymd >= from && ymd <= to
  })

  console.log(`\nCompleted events for scheduled lessons (by local date) in window: ${filteredEvents.length}`)
  for (const e of filteredEvents) {
    const dt = new Date(e.occurred_at)
    const ymd = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`
    console.log(`- ${ymd} | ${e.lesson_id} | occurred_at=${e.occurred_at}`)
  }

  const facilitatorId = normalizeFacilitatorId(learnerRow)
  if (!facilitatorId) {
    console.log('\nNo facilitatorId on learner row; skipping medals check')
    return
  }

  const medals = await fetchAllRows(() =>
    supabase
      .from('learner_medals')
      .select('lesson_key,best_percent,medal_tier,updated_at')
      .eq('user_id', facilitatorId)
      .eq('learner_id', String(learnerRow.id))
      .order('updated_at', { ascending: true })
  )

  const filteredMedals = medals.filter(m => canonKeys.includes(String(m.lesson_key)))
  console.log(`\nMedals for scheduled lessons in window: ${filteredMedals.length}`)
  for (const m of filteredMedals) {
    console.log(`- ${m.lesson_key} | best=${m.best_percent} | tier=${m.medal_tier} | updated_at=${m.updated_at}`)
  }
}

main().catch((err) => {
  console.error(String(err?.stack || err?.message || err))
  process.exit(1)
})
