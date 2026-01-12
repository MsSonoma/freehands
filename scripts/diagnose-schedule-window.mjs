#!/usr/bin/env node

/**
 * List lesson_schedule rows for a learner in a date window.
 *
 * Usage:
 *   node scripts/diagnose-schedule-window.mjs --learner Emma --from 2026-01-07 --to 2026-01-08
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

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
  const args = { learner: null, learnerId: null, from: null, to: null }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--learner') {
      args.learner = String(argv[i + 1] || '').trim()
      i += 1
      continue
    }
    if (token === '--learner-id') {
      args.learnerId = String(argv[i + 1] || '').trim()
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

  if (!args.from || !args.to) throw new Error('Provide --from and --to as YYYY-MM-DD')
  if (!args.learner && !args.learnerId) throw new Error('Provide --learner <Name> or --learner-id <uuid>')
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

async function main() {
  loadEnvFiles()
  const { learner, learnerId, from, to } = parseArgs(process.argv)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  let learnerRow = null
  if (learnerId) {
    const { data, error } = await supabase.from('learners').select('id,name,facilitator_id,owner_id,user_id').eq('id', learnerId).maybeSingle()
    if (error) throw new Error(error.message)
    learnerRow = data
  } else {
    const { data, error } = await supabase.from('learners').select('id,name,facilitator_id,owner_id,user_id').ilike('name', learner).maybeSingle()
    if (error) throw new Error(error.message)
    learnerRow = data
  }

  if (!learnerRow) {
    console.log('Learner not found')
    return
  }

  const rows = await fetchAllRows(() =>
    supabase
      .from('lesson_schedule')
      .select('id, scheduled_date, lesson_key, facilitator_id, learner_id')
      .eq('learner_id', learnerRow.id)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .order('scheduled_date', { ascending: true })
  )

  console.log(`\nSchedule rows for ${learnerRow.name} (${learnerRow.id}) ${from}..${to}: ${rows.length}`)
  for (const r of rows) {
    console.log(`- ${r.scheduled_date} | ${r.lesson_key} | schedule_id=${r.id}`)
  }
}

main().catch((err) => {
  console.error(String(err?.stack || err?.message || err))
  process.exit(1)
})
