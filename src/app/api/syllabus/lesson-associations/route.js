import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { upsertLessonAssociation } from '../../../lib/syllabus/lessonAssociations.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { verifyFacilitatorLessonAccess } from '../../../lib/serverLessonAccess.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
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
    })
    return NextResponse.json({ ok: true, association })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status })
  }
}
