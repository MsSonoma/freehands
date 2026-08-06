import { NextResponse } from 'next/server.js'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import { normalizeLessonKey } from '../../../../lib/lessonKeyNormalization.js'
import { applyLessonAvailability } from '../../../../lib/lessonAvailability.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STOCK_SUBJECTS = new Set(['math', 'science', 'social studies', 'language arts', 'general'])

function getEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

async function getUserAndAdmin(request, { createClientImpl = createClient } = {}) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!token) return { user: null, admin: null }

  const { url, anon, service } = getEnv()
  if (!url || !anon || !service) return { user: null, admin: null, error: 'Server not configured' }

  const authClient = createClientImpl(url, anon, { auth: { persistSession: false } })
  const { data: { user }, error } = await authClient.auth.getUser(token)
  if (error || !user) return { user: null, admin: null }

  return {
    user,
    admin: createClientImpl(url, service, { auth: { persistSession: false, autoRefreshToken: false } }),
  }
}

async function verifyLessonAccess({ admin, userId, lessonKey, fileExistsSync = fs.existsSync }) {
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
    const raw = await data.text()
    const lesson = JSON.parse(raw)
    if (lesson?.approved !== true) return { ok: false, error: 'Approve the lesson content before making it available' }
    return { ok: true }
  }

  if (!STOCK_SUBJECTS.has(subject)) return { ok: false, error: 'Lesson not found or unauthorized' }
  const folder = subject === 'general' ? 'Facilitator Lessons' : subject
  const publicPath = path.join(process.cwd(), 'public', 'lessons', folder, file)
  return fileExistsSync(publicPath) ? { ok: true } : { ok: false, error: 'Lesson not found or unauthorized' }
}

export async function POST(request, deps = {}) {
  try {
    const body = await request.json().catch(() => null)
    const learnerId = body?.learnerId
    const normalizedLessonKey = normalizeLessonKey(body?.lessonKey)
    const available = body?.available

    if (!learnerId || !normalizedLessonKey || typeof available !== 'boolean') {
      return NextResponse.json({ error: 'learnerId, lessonKey, and available (boolean) are required' }, { status: 400 })
    }

    const { user, admin, error } = await getUserAndAdmin(request, deps)
    if (error) return NextResponse.json({ error }, { status: 500 })
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const { data: learner, error: learnerError } = await admin
      .from('learners')
      .select('id, name, approved_lessons')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

    if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

    if (available) {
      const lessonAccess = await verifyLessonAccess({ admin, userId: user.id, lessonKey: normalizedLessonKey, fileExistsSync: deps.fileExistsSync })
      if (!lessonAccess.ok) {
        return NextResponse.json({ error: lessonAccess.error || 'Lesson not found or unauthorized' }, { status: 403 })
      }
    }

    const availabilityResult = applyLessonAvailability(learner.approved_lessons, normalizedLessonKey, available)
    if (!availabilityResult.ok) return NextResponse.json({ error: availabilityResult.error }, { status: 400 })

    const { error: updateError } = await admin
      .from('learners')
      .update({ approved_lessons: availabilityResult.approvedLessons })
      .eq('id', learnerId)

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      learnerId: learner.id,
      learnerName: learner.name,
      lessonKey: normalizedLessonKey,
      available,
      approvedLessons: availabilityResult.approvedLessons,
    })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}