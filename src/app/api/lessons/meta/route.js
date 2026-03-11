// Fetch full lesson data by lessonKey(s) for the Mr. Slate drill page.
// POST { keys: string[], learner_id?: string } → { lessons: LessonData[] }
// Handles:
//   - stock lessons (math, science, social studies, language arts) → local disk
//   - general/facilitator lessons → local Facilitator Lessons folder
//   - generated lessons (facilitator-authored in Supabase Storage) → Storage download
//     Requires learner_id so we can look up the facilitator_id for the Storage path.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LESSONS_ROOT = path.join(process.cwd(), 'public', 'lessons')
const STOCK_SUBJECTS = new Set(['math', 'science', 'social studies', 'language arts'])
const FACILITATOR_FOLDER = 'Facilitator Lessons'

async function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function POST(request) {
  try {
    const body = await request.json()
    const keys = Array.isArray(body?.keys) ? body.keys : []
    const learnerId = typeof body?.learner_id === 'string' ? body.learner_id.trim() : null
    if (!keys.length) return NextResponse.json({ lessons: [] })

    // Look up facilitator_id once if we have a learner_id (needed for generated lessons)
    let facilitatorId = null
    if (learnerId) {
      try {
        const supabase = await getSupabaseAdmin()
        if (supabase) {
          const { data } = await supabase
            .from('learners')
            .select('facilitator_id')
            .eq('id', learnerId)
            .single()
          facilitatorId = data?.facilitator_id || null
        }
      } catch {
        // Non-fatal — generated lessons will be skipped
      }
    }

    const lessons = []
    for (const raw of keys.slice(0, 300)) {
      const key = String(raw || '').trim()
      const slashIdx = key.indexOf('/')
      if (slashIdx < 1) continue
      const subject = key.slice(0, slashIdx).toLowerCase()
      const filename = key.slice(slashIdx + 1)
      if (!filename) continue

      let data = null

      if (STOCK_SUBJECTS.has(subject)) {
        // Stock lesson — read from local disk
        try {
          const filePath = path.join(LESSONS_ROOT, subject, filename)
          const text = await fs.readFile(filePath, 'utf8')
          data = JSON.parse(text)
          data.lessonKey = `${subject}/${filename}`
          data.subject = subject
          data.file = filename
        } catch {
          // not found or bad JSON — skip
        }
      } else if (subject === 'general') {
        // Facilitator lesson on local disk
        try {
          const filePath = path.join(LESSONS_ROOT, FACILITATOR_FOLDER, filename)
          const text = await fs.readFile(filePath, 'utf8')
          data = JSON.parse(text)
          data.lessonKey = `${subject}/${filename}`
          data.subject = 'general'
          data.file = filename
        } catch {
          // not found — skip
        }
      } else if (subject === 'generated' && facilitatorId) {
        // Facilitator-authored lesson stored in Supabase Storage
        try {
          const supabase = await getSupabaseAdmin()
          if (supabase) {
            const { data: fileData, error } = await supabase.storage
              .from('lessons')
              .download(`facilitator-lessons/${facilitatorId}/${filename}`)
            if (!error && fileData) {
              const text = await fileData.text()
              data = JSON.parse(text)
              data.lessonKey = `generated/${filename}`
              // Preserve the real subject from the lesson JSON; only fall back to 'generated'
              // if the field is missing so the awards page can bucket correctly.
              data.subject = data.subject || 'generated'
              data.file = filename
              data.isGenerated = true
            }
          }
        } catch {
          // Storage error — skip
        }
      }

      if (data) lessons.push(data)
    }

    return NextResponse.json({ lessons })
  } catch {
    return NextResponse.json({ lessons: [] })
  }
}
