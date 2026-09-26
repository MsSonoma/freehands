import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server.js'

import { normalizeLessonKey } from '../../../lib/lessonKeyNormalization.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { requireSlateAssignableSyllabusOccurrence } from '../../../lib/syllabus/syllabusMembership.server.mjs'
import { SLATE_RUN_PURPOSES, slateRunPurpose } from '../../../lib/slateLearningModel.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const RUN_PURPOSES = new Set(Object.values(SLATE_RUN_PURPOSES))

function optionalText(value, max = 240) {
  const text = String(value || '').trim()
  return text ? text.slice(0, max) : null
}

function timestamp(value, message, now, { allowFutureMs = 300000 } = {}) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > now.getTime() + allowFutureMs) {
    const error = new Error(message)
    error.status = 400
    throw error
  }
  return parsed.toISOString()
}

function sourceIdentity({ facilitatorId, learnerId, lessonKey, occurrenceId, runPurpose, startedAt }) {
  return createHash('sha256').update([facilitatorId, learnerId, lessonKey, occurrenceId, runPurpose, startedAt].join('|')).digest('hex')
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })

    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const lessonKey = normalizeLessonKey(body?.lessonKey)
    if (!lessonKey) return NextResponse.json({ error: 'A lessonKey is required', code: 'LESSON_KEY_REQUIRED' }, { status: 400 })

    const occurrenceId = String(body?.occurrenceId || '').trim()
    if (!occurrenceId) return NextResponse.json({ error: 'A Syllabus occurrenceId is required', code: 'SYLLABUS_OCCURRENCE_REQUIRED' }, { status: 400 })

    const runPurpose = slateRunPurpose(body?.runPurpose)
    if (!RUN_PURPOSES.has(runPurpose)) return NextResponse.json({ error: 'Invalid Mr. Slate run purpose', code: 'INVALID_SLATE_RUN_PURPOSE' }, { status: 400 })

    const now = deps.now || new Date()
    const completedAt = timestamp(body?.completedAt, 'A valid Mr. Slate completion time is required', now)
    const startedAt = timestamp(body?.startedAt || completedAt, 'A valid Mr. Slate start time is required', now)
    if (Date.parse(startedAt) > Date.parse(completedAt)) return NextResponse.json({ error: 'Mr. Slate completion cannot precede its start time', code: 'INVALID_SLATE_COMPLETION_TIME' }, { status: 400 })

    const repository = deps.repository || createSyllabusRepository(context.admin)
    const learner = await repository.findOwnedLearner(learnerId, context.user.id)
    if (!learner) return NextResponse.json({ error: 'Learner not found or unauthorized', code: 'FORBIDDEN' }, { status: 403 })

    const requireMembership = deps.requireSlateAssignableSyllabusOccurrence || requireSlateAssignableSyllabusOccurrence
    const membership = await requireMembership({
      repository,
      admin: context.admin,
      facilitatorId: context.user.id,
      learnerId,
      lessonKey,
      occurrenceId,
      fallbackTimeZone: context.user?.user_metadata?.timezone,
      now,
    })

    const row = await repository.insertSlateCompletion({
      facilitator_id: context.user.id,
      learner_id: learnerId,
      lesson_key: membership.lessonKey,
      syllabus_occurrence_id: membership.occurrenceId,
      run_purpose: runPurpose,
      lesson_title: optionalText(body?.lessonTitle),
      subject: optionalText(body?.subject, 120),
      started_at: startedAt,
      completed_at: completedAt,
      source: 'slate_session_v1',
      source_identity: sourceIdentity({ facilitatorId: context.user.id, learnerId, lessonKey: membership.lessonKey, occurrenceId: membership.occurrenceId, runPurpose, startedAt }),
    })

    return NextResponse.json({ ok: true, completion: row })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Could not record Mr. Slate completion', ...(error?.code ? { code: error.code } : {}) }, { status: Number.isInteger(error?.status) ? error.status : 500 })
  }
}
