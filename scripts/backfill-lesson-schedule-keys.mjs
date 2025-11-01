import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { normalizeLessonKey } from '../src/app/lib/lessonKeyNormalization.js'

function loadEnvFiles() {
  const candidates = ['.env.local', '.env']
  const root = path.resolve(process.cwd())

  for (const filename of candidates) {
    const fullPath = path.join(root, filename)
    if (!fs.existsSync(fullPath)) {
      continue
    }

    const content = fs.readFileSync(fullPath, 'utf8')
    content.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        return
      }
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex === -1) {
        return
      }
      const key = trimmed.slice(0, eqIndex).trim()
      const value = trimmed.slice(eqIndex + 1).trim()
      if (!process.env[key]) {
        process.env[key] = value
      }
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

async function backfillLessonScheduleKeys() {
  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase
    .from('lesson_schedule')
    .select('id, lesson_key, learner_id, scheduled_date')

  if (error) {
    throw new Error(`Failed to load lesson_schedule entries: ${error.message}`)
  }

  const rowsNeedingUpdate = []
  const rowsNeedingDelete = []

  for (const row of data) {
    const normalized = normalizeLessonKey(row.lesson_key)
    if (!normalized || normalized === row.lesson_key) {
      continue
    }

    // Check for conflicts before updating
    const { data: existing, error: conflictError } = await supabase
      .from('lesson_schedule')
      .select('id')
      .eq('learner_id', row.learner_id)
      .eq('scheduled_date', row.scheduled_date)
      .eq('lesson_key', normalized)
      .maybeSingle()

    if (conflictError) {
      throw new Error(`Conflict lookup failed for row ${row.id}: ${conflictError.message}`)
    }

    if (existing && existing.id !== row.id) {
      // Duplicate after normalization; mark current row for deletion
      rowsNeedingDelete.push({ ...row, normalized })
    } else {
      rowsNeedingUpdate.push({ ...row, normalized })
    }
  }

  const updates = []
  for (const row of rowsNeedingUpdate) {
    const { data: updated, error: updateError } = await supabase
      .from('lesson_schedule')
      .update({ lesson_key: row.normalized })
      .eq('id', row.id)
      .select('id, lesson_key')
      .maybeSingle()

    if (updateError) {
      throw new Error(`Failed to update row ${row.id}: ${updateError.message}`)
    }

    updates.push(updated)
  }

  const deletions = []
  for (const row of rowsNeedingDelete) {
    const { error: deleteError } = await supabase
      .from('lesson_schedule')
      .delete()
      .eq('id', row.id)

    if (deleteError) {
      throw new Error(`Failed to delete duplicate row ${row.id}: ${deleteError.message}`)
    }

    deletions.push({ id: row.id, lesson_key: row.lesson_key, normalized: row.normalized })
  }

  return {
    totalRows: data.length,
    updatedCount: updates.length,
    deletedCount: deletions.length,
    updates,
    deletions
  }
}

async function run() {
  try {
    loadEnvFiles()
    const result = await backfillLessonScheduleKeys()
    console.log(JSON.stringify(result, null, 2))
    process.exit(0)
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
}

run()
