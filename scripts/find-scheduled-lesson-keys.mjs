#!/usr/bin/env node

/**
 * Find lesson_schedule rows by lesson_key substring (service role).
 *
 * Usage:
 *   node scripts/find-scheduled-lesson-keys.mjs --contains "Exploring_Measurement" --from 2026-01-01 --to 2026-01-31
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
  const args = { contains: null, from: null, to: null, learner: null }
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--contains') {
      args.contains = String(argv[i + 1] || '').trim()
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
    if (token === '--learner-id') {
      args.learner = String(argv[i + 1] || '').trim()
      i += 1
      continue
    }
    throw new Error(`Unknown arg: ${token}`)
  }
  if (!args.contains) throw new Error('Provide --contains <substring>')
  if (!args.from || !args.to) throw new Error('Provide --from and --to as YYYY-MM-DD')
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
  const { contains, from, to, learner } = parseArgs(process.argv)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

  const pattern = `%${contains}%`
  const rows = await fetchAllRows(() => {
    let q = supabase
      .from('lesson_schedule')
      .select('scheduled_date, lesson_key, learner_id')
      .ilike('lesson_key', pattern)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .order('scheduled_date', { ascending: true })
    if (learner) q = q.eq('learner_id', learner)
    return q
  })

  console.log(`Found ${rows.length} rows matching ${contains} (${from}..${to})`)
  for (const r of rows) {
    console.log(`- ${r.scheduled_date} | ${r.lesson_key} | learner=${r.learner_id}`)
  }
}

main().catch((err) => {
  console.error(String(err?.stack || err?.message || err))
  process.exit(1)
})
