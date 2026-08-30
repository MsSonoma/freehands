import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { requireHistoricalSyllabusOccurrence } from '../../../lib/syllabus/syllabusMembership.server.mjs'
import { normalizeInstructionalTeacher } from '../../../lib/syllabus/instructionalTeacher.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const ACTIVITY_TYPES = new Set(['instructional_completion', 'slate_drill_completion'])
const WEBB_IMPORT_PROVENANCE = 'facilitator_attested_webb_completion_v1_import'
const PROVENANCE = new Set(['facilitator_recorded_legacy_activity', WEBB_IMPORT_PROVENANCE])

function requiredText(value, message, code) {
  const text = String(value || '').trim()
  if (!text) throw new SyllabusError(message, 400, code)
  return text
}

function historicalTimestamp(value, now) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() > now.getTime()) {
    throw new SyllabusError('A valid historical completion time is required', 400, 'INVALID_HISTORICAL_TIMESTAMP')
  }
  return parsed.toISOString()
}

function sourceIdentity({ facilitatorId, learnerId, lessonKey, occurrenceId, activityType, teacher, occurredAt, provenance }) {
  const boundOccurrence = provenance === WEBB_IMPORT_PROVENANCE ? '' : occurrenceId
  return createHash('sha256').update([
    facilitatorId, learnerId, lessonKey, boundOccurrence, activityType, teacher || '', occurredAt, provenance,
  ].join('|')).digest('hex')
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const activityType = requiredText(body?.activityType, 'A historical activity type is required', 'INVALID_HISTORICAL_ACTIVITY')
    if (!ACTIVITY_TYPES.has(activityType)) throw new SyllabusError('Unsupported historical activity type', 400, 'INVALID_HISTORICAL_ACTIVITY')
    const provenance = requiredText(body?.provenance, 'Historical provenance is required', 'INVALID_HISTORICAL_PROVENANCE')
    if (!PROVENANCE.has(provenance)) throw new SyllabusError('Unsupported historical provenance', 400, 'INVALID_HISTORICAL_PROVENANCE')
    const teacher = activityType === 'instructional_completion'
      ? normalizeInstructionalTeacher(body?.instructionalTeacher)
      : null
    if (activityType === 'instructional_completion' && !teacher) {
      throw new SyllabusError('Historical instruction must name Ms. Sonoma or Mrs. Webb', 400, 'INVALID_INSTRUCTIONAL_TEACHER')
    }
    if (activityType === 'slate_drill_completion' && body?.instructionalTeacher != null) {
      throw new SyllabusError('Mr. Slate is not an instructional teacher', 400, 'INVALID_INSTRUCTIONAL_TEACHER')
    }
    if (provenance === WEBB_IMPORT_PROVENANCE && teacher !== 'webb') {
      throw new SyllabusError('Legacy Webb completion imports must name Mrs. Webb', 400, 'INVALID_HISTORICAL_PROVENANCE')
    }
    const now = deps.now || new Date()
    const occurredAt = historicalTimestamp(body?.occurredAt, now)
    if (provenance === WEBB_IMPORT_PROVENANCE) {
      if (!body?.legacyCompletion || body.legacyCompletion.completed !== true) {
        throw new SyllabusError('The facilitator-attested Webb import requires the completed legacy browser record', 400, 'INVALID_LEGACY_WEBB_COMPLETION')
      }
      const legacyCompletedAt = historicalTimestamp(body.legacyCompletion.completedAt, now)
      if (legacyCompletedAt !== occurredAt) {
        throw new SyllabusError('The historical occurrence time must equal the legacy Webb completion time', 400, 'LEGACY_WEBB_COMPLETION_TIME_MISMATCH')
      }
    }
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const membership = await requireHistoricalSyllabusOccurrence({
      repository,
      admin: context.admin,
      facilitatorId: context.user.id,
      learnerId,
      lessonKey: body?.lessonKey,
      occurrenceId: body?.occurrenceId,
      activityType,
      fallbackTimeZone: context.user?.user_metadata?.timezone,
      now,
    })
    const record = await repository.insertLegacyActivityRecord({
      facilitator_id: context.user.id,
      learner_id: learnerId,
      lesson_key: membership.lessonKey,
      syllabus_occurrence_id: membership.occurrenceId,
      activity_type: activityType,
      instructional_teacher: teacher,
      occurred_at: occurredAt,
      provenance,
      source_identity: sourceIdentity({
        facilitatorId: context.user.id,
        learnerId,
        lessonKey: membership.lessonKey,
        occurrenceId: membership.occurrenceId,
        activityType,
        teacher,
        occurredAt,
        provenance,
      }),
      recorded_by: context.user.id,
    })
    return NextResponse.json({ ok: true, historical_activity: record })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : (Number.isInteger(error?.status) ? error.status : 500)
    return NextResponse.json({
      error: error.message || 'Internal server error',
      ...(error?.code ? { code: error.code } : {}),
    }, { status })
  }
}
