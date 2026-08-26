import fs from 'node:fs'
import path from 'node:path'

import { normalizeLessonKey } from './lessonKeyNormalization.js'

const STOCK_SUBJECTS = new Set(['math', 'science', 'social studies', 'language arts', 'general'])

export async function verifyFacilitatorLessonAccess({
  admin,
  userId,
  lessonKey,
  fileExistsSync = fs.existsSync,
  unapprovedError = 'Approve the lesson content before continuing',
  requireApproved = true,
} = {}) {
  const normalized = normalizeLessonKey(lessonKey)
  if (!normalized || !normalized.includes('/')) return { ok: false, error: 'Invalid lesson key' }

  const [subject, ...rest] = normalized.split('/')
  const file = rest.join('/')
  if (!file || file.includes('..') || file.includes('\\')) return { ok: false, error: 'Invalid lesson key' }

  if (subject === 'generated') {
    const { data, error } = await admin.storage
      .from('lessons')
      .download(`facilitator-lessons/${userId}/${file}`)
    if (error || !data) return { ok: false, error: 'Lesson not found or unauthorized' }

    try {
      const lesson = JSON.parse(await data.text())
      if (requireApproved && lesson?.approved !== true) return { ok: false, error: unapprovedError }
      return { ok: true, lessonKey: normalized, lesson, subject: lesson?.subject || 'generated', title: lesson?.title || file.replace(/\.json$/i, '') }
    } catch {
      return { ok: false, error: 'Lesson content is invalid' }
    }
  }

  if (!STOCK_SUBJECTS.has(subject)) return { ok: false, error: 'Lesson not found or unauthorized' }
  const folder = subject === 'general' ? 'Facilitator Lessons' : subject
  const publicPath = path.join(process.cwd(), 'public', 'lessons', folder, file)
  if (!fileExistsSync(publicPath)) return { ok: false, error: 'Lesson not found or unauthorized' }
  try {
    const lesson = JSON.parse(fs.readFileSync(publicPath, 'utf8'))
    return { ok: true, lessonKey: normalized, lesson, subject: lesson?.subject || subject, title: lesson?.title || file.replace(/\.json$/i, '') }
  } catch {
    return { ok: false, error: 'Lesson content is invalid' }
  }
}
