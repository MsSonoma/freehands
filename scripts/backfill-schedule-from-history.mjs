import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
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
      const value = trimmed.slice(eqIndex + 1).trim()
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
      autoRefreshToken: false
    }
  })
}

function parseArgs(argv) {
  const args = {
    dryRun: false,
    learners: [],
    tz: 'local',
    source: 'events'
  }

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i]

    if (token === '--dry-run') {
      args.dryRun = true
      continue
    }

    if (token === '--tz') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --tz (local|utc)')
      args.tz = String(value).toLowerCase()
      i += 1
      continue
    }

    if (token === '--learner') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --learner')
      const parts = String(value)
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      args.learners.push(...parts)
      i += 1
      continue
    }

    if (token === '--source') {
      const value = argv[i + 1]
      if (!value) throw new Error('Missing value for --source (events|lesson_history)')
      args.source = String(value).toLowerCase()
      i += 1
      continue
    }

    throw new Error(`Unknown argument: ${token}`)
  }

  if (args.tz !== 'local' && args.tz !== 'utc') {
    throw new Error('Invalid --tz; expected local or utc')
  }

  if (args.source !== 'events' && args.source !== 'lesson_history') {
    throw new Error('Invalid --source; expected events or lesson_history')
  }

  return args
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

function normalizeFacilitatorId(learnerRow) {
  return learnerRow?.facilitator_id || learnerRow?.owner_id || learnerRow?.user_id || null
}

async function runBackfill({ dryRun, learners, tz, source }) {
  const supabase = getSupabaseAdminClient()

  const allLearners = await fetchAllRows(() =>
    supabase
      .from('learners')
      .select('id, name, facilitator_id, owner_id, user_id')
      .order('name', { ascending: true })
  )

  const learnerFilter = new Set((learners || []).map(n => n.toLowerCase()))
  const targetLearners = learnerFilter.size
    ? allLearners.filter(l => learnerFilter.has(String(l?.name || '').toLowerCase()))
    : allLearners

  if (learnerFilter.size && targetLearners.length === 0) {
    throw new Error(`No learners matched --learner names: ${learners.join(', ')}`)
  }

  const results = []
  let totalToInsert = 0
  let totalInserted = 0
  let totalAlreadyPresent = 0

  for (const learner of targetLearners) {
    const facilitatorId = normalizeFacilitatorId(learner)
    if (!facilitatorId) {
      results.push({
        learnerId: learner?.id,
        learnerName: learner?.name,
        error: 'Missing facilitator_id/owner_id/user_id on learners row; cannot backfill'
      })
      continue
    }

    const completionRows = await fetchAllRows(() => {
      if (source === 'lesson_history') {
        return supabase
          .from('lesson_history')
          .select('lesson_key, completed_at')
          .eq('learner_id', learner.id)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: true })
      }

      return supabase
        .from('lesson_session_events')
        .select('lesson_id, occurred_at')
        .eq('learner_id', learner.id)
        .eq('event_type', 'completed')
        .not('occurred_at', 'is', null)
        .order('occurred_at', { ascending: true })
    })

    const desired = []
    const desiredKeySet = new Set()

    for (const row of completionRows) {
      const lessonKeyRaw = source === 'lesson_history' ? row?.lesson_key : row?.lesson_id
      const completedAt = source === 'lesson_history' ? row?.completed_at : row?.occurred_at
      if (!lessonKeyRaw || !completedAt) continue

      const scheduledDate = toDateStr(completedAt, tz)
      if (!scheduledDate) continue

      const lessonKey = normalizeLessonKey(lessonKeyRaw) || lessonKeyRaw
      const dedupeKey = `${lessonKey}|${scheduledDate}`
      if (desiredKeySet.has(dedupeKey)) continue
      desiredKeySet.add(dedupeKey)

      desired.push({
        facilitator_id: facilitatorId,
        learner_id: learner.id,
        lesson_key: lessonKey,
        scheduled_date: scheduledDate
      })
    }

    const existingRows = await fetchAllRows(() =>
      supabase
        .from('lesson_schedule')
        .select('lesson_key, scheduled_date')
        .eq('learner_id', learner.id)
    )

    const existingKeySet = new Set(
      (existingRows || [])
        .map(r => {
          const key = r?.lesson_key
          const dateStr = r?.scheduled_date
          if (!key || !dateStr) return null
          return `${normalizeLessonKey(key) || key}|${dateStr}`
        })
        .filter(Boolean)
    )

    const toInsert = desired.filter(r => !existingKeySet.has(`${r.lesson_key}|${r.scheduled_date}`))

    totalToInsert += toInsert.length
    totalAlreadyPresent += desired.length - toInsert.length

    if (!dryRun && toInsert.length > 0) {
      const chunkSize = 500
      let insertedForLearner = 0

      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize)
        const { error } = await supabase
          .from('lesson_schedule')
          .upsert(chunk, { onConflict: 'learner_id,lesson_key,scheduled_date' })

        if (error) throw new Error(`Insert failed for ${learner.name}: ${error.message}`)
        insertedForLearner += chunk.length
      }

      totalInserted += insertedForLearner

      results.push({
        learnerId: learner.id,
        learnerName: learner.name,
        facilitatorId,
        source,
        tz,
        completionRows: completionRows.length,
        uniqueCompletedLessonsByDate: desired.length,
        inserted: insertedForLearner,
        alreadyPresent: desired.length - toInsert.length
      })
    } else {
      results.push({
        learnerId: learner.id,
        learnerName: learner.name,
        facilitatorId,
        source,
        tz,
        completionRows: completionRows.length,
        uniqueCompletedLessonsByDate: desired.length,
        wouldInsert: toInsert.length,
        alreadyPresent: desired.length - toInsert.length
      })
    }
  }

  return {
    dryRun,
    source,
    tz,
    learnerFilter: learners,
    learnersProcessed: targetLearners.length,
    totalUniqueCompletedLessonsByDate: results.reduce((sum, r) => sum + (r.uniqueCompletedLessonsByDate || 0), 0),
    totalToInsert,
    totalAlreadyPresent,
    totalInserted,
    results
  }
}

async function main() {
  loadEnvFiles()
  const args = parseArgs(process.argv)

  const result = await runBackfill(args)
  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
