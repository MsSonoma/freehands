import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { requireSlateAssignableSyllabusOccurrence } from '../../../lib/syllabus/syllabusMembership.server.mjs'
import { isCalendarDate, SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { SLATE_RUN_PURPOSES } from '../../../lib/slateLearningModel.mjs'
import { isReviewTeacher, normalizeReviewTeacher } from '../../../lib/reviewTeacher.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function clean(value) { return String(value || '').trim() }

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const scheduledDate = clean(body?.scheduledDate)
    if (!isCalendarDate(scheduledDate)) {
      throw new SyllabusError('A valid Daily Review schedule date is required', 400, 'INVALID_SLATE_SCHEDULE_DATE')
    }
    const runPurpose = clean(body?.runPurpose) || SLATE_RUN_PURPOSES.PRACTICE
    if (!Object.values(SLATE_RUN_PURPOSES).includes(runPurpose)) {
      throw new SyllabusError('The Daily Review session purpose is invalid', 400, 'INVALID_SLATE_RUN_PURPOSE')
    }
    if (body?.reviewTeacher != null && !isReviewTeacher(body.reviewTeacher)) {
      throw new SyllabusError('The Daily Review teacher is invalid', 400, 'INVALID_REVIEW_TEACHER')
    }
    const reviewTeacher = normalizeReviewTeacher(body?.reviewTeacher)
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
    const earliestDate = [membership.item?.planned_date, membership.syllabus?.resolved_today]
      .map((value) => clean(value).slice(0, 10))
      .filter(isCalendarDate)
      .sort()
      .at(-1)
    if (earliestDate && scheduledDate < earliestDate) {
      throw new SyllabusError('Daily Review must be scheduled on or after the instructional lesson and cannot be scheduled in the past', 400, 'SLATE_SCHEDULE_BEFORE_INSTRUCTION')
    }
    const noSchoolDates = typeof repository.listNoSchoolDates === 'function' ? await repository.listNoSchoolDates(context.user.id, learnerId, scheduledDate, scheduledDate) : []
    if (noSchoolDates.some((row) => clean(row?.date).slice(0, 10) === scheduledDate)) {
      throw new SyllabusError('Remove the day-off or holiday mark before scheduling Daily Review on this date.', 409, 'NO_SCHOOL_DATE')
    }
    const assignment = await repository.createSlateAssignment({
      facilitator_id: context.user.id,
      learner_id: learnerId,
      lesson_key: membership.lessonKey,
      syllabus_occurrence_id: membership.occurrenceId,
      scheduled_date: scheduledDate,
      run_purpose: runPurpose,
      review_teacher: reviewTeacher,
    })
    return NextResponse.json({ ok: true, assignment })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Internal server error', code: error.code || 'INTERNAL_ERROR' }, { status })
  }
}

export async function PATCH(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const assignmentId = clean(body?.assignmentId)
    if (!/^[0-9a-f-]{36}$/i.test(assignmentId)) {
      throw new SyllabusError('A valid Daily Review assignment is required', 400, 'INVALID_SLATE_ASSIGNMENT')
    }
    if (!isReviewTeacher(body?.reviewTeacher)) {
      throw new SyllabusError('The Daily Review teacher is invalid', 400, 'INVALID_REVIEW_TEACHER')
    }
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const assignment = await repository.updateSlateAssignmentTeacher(context.user.id, learnerId, assignmentId, normalizeReviewTeacher(body.reviewTeacher))
    if (!assignment) throw new SyllabusError('Daily Review assignment not found', 404, 'SLATE_ASSIGNMENT_NOT_FOUND')
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
      throw new SyllabusError('A valid Daily Review assignment is required', 400, 'INVALID_SLATE_ASSIGNMENT')
    }
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const removed = await repository.deleteSlateAssignment(context.user.id, learnerId, assignmentId)
    if (!removed) throw new SyllabusError('Daily Review assignment not found', 404, 'SLATE_ASSIGNMENT_NOT_FOUND')
    return NextResponse.json({ ok: true })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Internal server error', code: error.code || 'INTERNAL_ERROR' }, { status })
  }
}
