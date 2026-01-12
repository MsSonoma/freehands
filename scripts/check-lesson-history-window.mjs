#!/usr/bin/env node

/**
 * Quick probe: show legacy lesson_history rows in a UTC time window.
 *
 * Usage:
 *   node scripts/check-lesson-history-window.mjs --learner Emma,Test --from 2026-01-07T00:00:00Z --to 2026-01-09T00:00:00Z
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
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = String(line || '').trim()
      if (!trimmed || trimmed.startsWith('#')) return
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) return
      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed.slice(eqIndex + 1).trim().replace(/^['"]|['"]$/g, '')
      if (!process.env[key]) process.env[key] = value
    })
  }
}

function parseArgs(argv) {
  const args = {
    learners: ['Emma', 'Test'],
    from: null,
    to: null,
  }

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]

    if (token === '--learner') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --learner')
      args.learners = String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      i += 1
      continue
    }

    if (token === '--from') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --from (ISO)')
      args.from = String(value)
      i += 1
      continue
    }

    if (token === '--to') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --to (ISO)')
      args.to = String(value)
      i += 1
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  if (!args.from || !args.to) {
    throw new Error('Provide --from and --to as ISO timestamps (UTC recommended)')
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

async function main() {
  loadEnvFiles()
  const { learners, from, to } = parseArgs(process.argv)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const learnerRows = await fetchAllRows(() =>
    supabase
      .from('learners')
      .select('id, name')
      .in('name', learners)
      .order('name', { ascending: true })
  )

  if (learnerRows.length === 0) {
    console.log('No learners matched')
    return
  }

  for (const learner of learnerRows) {
    const { data, error } = await supabase
      .from('lesson_history')
      .select('lesson_key, completed_at')
      .eq('learner_id', learner.id)
      .gte('completed_at', from)
      .lt('completed_at', to)
      .order('completed_at', { ascending: true })

    if (error) {
      console.log(`${learner.name}: lesson_history error: ${error.message}`)
      continue
    }

    console.log(`\n${learner.name}: lesson_history rows in window: ${(data || []).length}`)
    if ((data || []).length) {
      console.log((data || []).slice(0, 20))
    }
  }
}

main().catch((err) => {
  console.error(String(err?.stack || err?.message || err))
  process.exit(1)
})
