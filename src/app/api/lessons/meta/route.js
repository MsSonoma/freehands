// Fetch lesson metadata by lessonKey(s) — no auth required, reads public lesson files.
// POST { keys: string[] } → { lessons: LessonData[] }
// Handles stock lessons (math, science, social studies, language arts).
// Generated/facilitator lessons are skipped silently (those are already in available-lessons).

import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const LESSONS_ROOT = path.join(process.cwd(), 'public', 'lessons')
const STOCK_SUBJECTS = new Set(['math', 'science', 'social studies', 'language arts'])

export async function POST(request) {
  try {
    const body = await request.json()
    const keys = Array.isArray(body?.keys) ? body.keys : []
    if (!keys.length) return NextResponse.json({ lessons: [] })

    const lessons = []
    for (const raw of keys.slice(0, 300)) {
      const key = String(raw || '').trim()
      const slashIdx = key.indexOf('/')
      if (slashIdx < 1) continue
      const subject = key.slice(0, slashIdx).toLowerCase()
      const filename = key.slice(slashIdx + 1)
      if (!filename || !STOCK_SUBJECTS.has(subject)) continue
      try {
        const filePath = path.join(LESSONS_ROOT, subject, filename)
        const text = await fs.readFile(filePath, 'utf8')
        const data = JSON.parse(text)
        data.lessonKey = `${subject}/${filename}`
        data.subject = subject
        data.file = filename
        lessons.push(data)
      } catch {
        // not found or bad JSON — skip silently
      }
    }

    return NextResponse.json({ lessons })
  } catch {
    return NextResponse.json({ lessons: [] })
  }
}
