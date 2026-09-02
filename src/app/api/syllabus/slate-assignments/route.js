import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { requireSlateAssignableSyllabusOccurrence } from '../../../lib/syllabus/syllabusMembership.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function clean(value) { return String(value || '').trim() }

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const membership = await requireSlateAssignableSyllabusOccurrence({
      repository,
      admin: context.admin,
      facilitatorId: context.user.id,
      learnerId,
      lessonKey: body?.lessonKey,
      occurrenceId: body?.occurrenceId,
      fallbackTimeZone: context.user?.user_metadata?.timezone,
      now: deps.now || new Date(),
    })
    const assignment = await repository.createSlateAssignment({
      facilitator_id: context.user.id,
      learner_id: learnerId,
      lesson_key: membership.lessonKey,
      syllabus_occurrence_id: membership.occurrenceId,
    })
    return NextResponse.json({ ok: true, assignment })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Internal server error', code: error.code || 'INTERNAL_ERROR' }, { status })
  }
}

export async function DELETE(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const assignmentId = clean(body?.assignmentId)
    if (!/^[0-9a-f-]{36}$/i.test(assignmentId)) {
      throw new SyllabusError('A valid Mr. Slate assignment is required', 400, 'INVALID_SLATE_ASSIGNMENT')
    }
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const removed = await repository.deleteSlateAssignment(context.user.id, learnerId, assignmentId)
    if (!removed) throw new SyllabusError('Mr. Slate assignment not found', 404, 'SLATE_ASSIGNMENT_NOT_FOUND')
    return NextResponse.json({ ok: true })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Internal server error', code: error.code || 'INTERNAL_ERROR' }, { status })
  }
}
