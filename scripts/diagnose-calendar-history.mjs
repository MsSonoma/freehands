import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

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
      const value = trimmed.slice(eqIndex + 1).trim()
      if (!process.env[key]) process.env[key] = value
    })
  }
}

function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

function parseArgs(argv) {
  const args = { learners: [] }
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
    throw new Error(`Unknown argument: ${token}`)
  }
  if (args.learners.length === 0) args.learners = ['Emma', 'Test']
  return args
}

function summarizeByFacilitator(rows) {
  const byFacilitator = {}
  for (const row of rows) {
    const key = row.facilitator_id || 'NULL'
    byFacilitator[key] = (byFacilitator[key] || 0) + 1
  }
  return byFacilitator
}

async function main() {
  loadEnvFiles()
  const { learners } = parseArgs(process.argv)
  const supabase = getSupabaseAdminClient()

  const { data: learnerRows, error: learnerErr } = await supabase
    .from('learners')
    .select('id, name, facilitator_id, owner_id, user_id')
    .in('name', learners)
    .order('name', { ascending: true })

  if (learnerErr) throw learnerErr

  console.log('Learners found:', learnerRows.length)
  for (const learner of learnerRows) {
    console.log('\n=== ' + learner.name + ' ===')
    console.log({
      id: learner.id,
      facilitator_id: learner.facilitator_id,
      owner_id: learner.owner_id,
      user_id: learner.user_id
    })

    const { data: scheduleRows, error: scheduleErr } = await supabase
      .from('lesson_schedule')
      .select('id, facilitator_id, scheduled_date, lesson_key')
      .eq('learner_id', learner.id)
      .order('scheduled_date', { ascending: true })

    if (scheduleErr) throw scheduleErr

    console.log('lesson_schedule rows:', scheduleRows.length)
    console.log('by facilitator_id:', summarizeByFacilitator(scheduleRows))
    console.log(
      'first5 schedule:',
      scheduleRows.slice(0, 5).map((r) => ({
        scheduled_date: r.scheduled_date,
        lesson_key: r.lesson_key,
        facilitator_id: r.facilitator_id
      }))
    )

    const { data: completedRows, error: eventsErr } = await supabase
      .from('lesson_session_events')
      .select('id, lesson_id, occurred_at')
      .eq('learner_id', learner.id)
      .eq('event_type', 'completed')
      .order('occurred_at', { ascending: true })

    if (eventsErr) throw eventsErr

    console.log('lesson_session_events completed:', completedRows.length)
    console.log(
      'first5 events:',
      completedRows.slice(0, 5).map((r) => ({
        occurred_at: r.occurred_at,
        lesson_id: r.lesson_id
      }))
    )
  }
}

main().catch((err) => {
  console.error('ERROR:', err?.message || err)
  process.exit(1)
})
