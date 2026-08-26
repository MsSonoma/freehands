import { NextResponse } from 'next/server.js'
import { createClient } from '@supabase/supabase-js'
import { normalizeLessonKey } from '../../../../lib/lessonKeyNormalization.js'
import { applyLessonAvailability } from '../../../../lib/lessonAvailability.mjs'
import { verifyFacilitatorLessonAccess } from '../../../../lib/serverLessonAccess.mjs'
import { upsertLessonAssociation } from '../../../../lib/syllabus/lessonAssociations.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

    let lessonAccess = null
    if (available) {
      lessonAccess = await verifyFacilitatorLessonAccess({
        admin,
        userId: user.id,
        lessonKey: normalizedLessonKey,
        fileExistsSync: deps.fileExistsSync,
        unapprovedError: 'Approve the lesson content before making it available',
      })
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

    if (available && lessonAccess) {
      await upsertLessonAssociation({
        admin,
        facilitatorId: user.id,
        learnerId,
        lessonKey: lessonAccess.lessonKey,
        subject: lessonAccess.subject,
        title: lessonAccess.title,
        readinessState: 'available',
        associationSource: 'availability',
        verifyLearner: false,
      })
    }

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
