import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { requireAssociationLearner, setLessonAssociationInferenceSuppressed, upsertLessonAssociation } from '../../../lib/syllabus/lessonAssociations.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { verifyFacilitatorLessonAccess } from '../../../lib/serverLessonAccess.mjs'
import { normalizeLessonKey } from '../../../lib/lessonKeyNormalization.js'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { requireAssignableSyllabusOccurrence } from '../../../lib/syllabus/syllabusMembership.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const params = new URL(request.url).searchParams
    const learnerId = validateLearnerId(params.get('learnerId'))
    const lessonKey = normalizeLessonKey(params.get('lessonKey'))
    if (!lessonKey) throw new SyllabusError('A valid lesson key is required', 400, 'INVALID_LESSON_KEY')
    await requireAssociationLearner(context.admin, context.user.id, learnerId)
    const { data, error } = await context.admin.from('syllabus_lesson_associations')
      .select('*')
      .eq('facilitator_id', context.user.id)
      .eq('learner_id', learnerId)
      .eq('lesson_key', lessonKey)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ ok: true, association: data || null })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Internal server error', ...(error instanceof SyllabusError ? { code: error.code } : {}) }, { status })
  }
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    if (Object.prototype.hasOwnProperty.call(body || {}, 'suppressed')
      || Object.prototype.hasOwnProperty.call(body || {}, 'inferred_placement_suppressed')) {
      throw new SyllabusError('Suppression state is server-owned', 400, 'INVALID_LESSON_ASSOCIATION_MUTATION')
    }
    const action = String(body?.action || '').trim()
    if (action && action !== 'save_for_later') {
      throw new SyllabusError('Unsupported lesson association action', 400, 'INVALID_LESSON_ASSOCIATION_ACTION')
    }
    const access = await verifyFacilitatorLessonAccess({
      admin: context.admin,
      userId: context.user.id,
      lessonKey: body?.lessonKey,
      fileExistsSync: deps.fileExistsSync,
      requireApproved: false,
    })
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: 403 })
    const lesson = access.lesson || {}
    const association = await upsertLessonAssociation({
      admin: context.admin,
      facilitatorId: context.user.id,
      learnerId,
      lessonKey: access.lessonKey,
      subject: lesson.subject || access.subject,
      title: lesson.title || access.title,
      readinessState: !access.lessonKey.startsWith('generated/') || lesson.approved === true ? 'approved' : 'draft',
      associationSource: 'prepare',
      instructionalTeacher: body?.instructionalTeacher,
    })
    if (action === 'save_for_later') {
      const clearInferenceSuppression = deps.setLessonAssociationInferenceSuppressed || setLessonAssociationInferenceSuppressed
      await clearInferenceSuppression({
        admin: context.admin,
        facilitatorId: context.user.id,
        learnerId,
        lessonKey: access.lessonKey,
        suppressed: false,
        verifyLearner: false,
      })
    }
    return NextResponse.json({ ok: true, association })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({
      error: error.message || 'Internal server error',
      ...(error instanceof SyllabusError ? { code: error.code } : {}),
    }, { status })
  }
}

export async function PATCH(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const lessonKey = normalizeLessonKey(body?.lessonKey)
    if (!lessonKey) throw new SyllabusError('A valid lesson key is required', 400, 'INVALID_LESSON_KEY')
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const membership = await requireAssignableSyllabusOccurrence({
      repository,
      admin: context.admin,
      facilitatorId: context.user.id,
      learnerId,
      lessonKey,
      occurrenceId: body?.occurrenceId,
      fallbackTimeZone: context.user?.user_metadata?.timezone,
      now: deps.now || new Date(),
    })
    const association = await upsertLessonAssociation({
      admin: context.admin,
      facilitatorId: context.user.id,
      learnerId,
      lessonKey: membership.lessonKey,
      subject: membership.item.subject,
      title: membership.item.title,
      readinessState: membership.item.readiness_state || 'saved',
      associationSource: 'syllabus',
      instructionalTeacher: body?.instructionalTeacher,
      verifyLearner: false,
    })
    return NextResponse.json({ ok: true, association, occurrenceId: membership.occurrenceId })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({
      error: error.message || 'Internal server error',
      ...(error instanceof SyllabusError ? { code: error.code } : {}),
    }, { status })
  }
}
