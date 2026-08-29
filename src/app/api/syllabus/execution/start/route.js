import { NextResponse } from 'next/server.js'
import { normalizeLessonKey } from '../../../../lib/lessonKeyNormalization.js'
import { verifyFacilitatorPinForUser } from '../../../../lib/facilitatorPin.server.mjs'
import { getSyllabusRequestContext } from '../../../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../../../lib/syllabus/supabaseRepository.server.mjs'
import { validateLearnerId } from '../../../../lib/syllabus/schema.mjs'
import {
  executionProofMatches,
  readSyllabusExecutionProof,
  SYLLABUS_EXECUTION_COOKIE,
} from '../../../../lib/syllabus/executionAuthorization.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function cookieValue(request, name) {
  const prefix = `${name}=`
  const row = (request.headers.get('cookie') || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))
  return row ? decodeURIComponent(row.slice(prefix.length)) : ''
}

function normalizeUuid(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null
}

async function startSessionTransaction(admin, values) {
  const { data, error } = await admin.rpc('start_lesson_session_transactional', values)
  if (error) throw error
  if (!data || typeof data !== 'object') throw new Error('Transactional session start returned no result')
  return data
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const lessonKey = normalizeLessonKey(body?.lessonId)
    if (!lessonKey) return NextResponse.json({ error: 'A lessonId is required' }, { status: 400 })
    const browserSessionId = normalizeUuid(body?.browserSessionId)
    if (!browserSessionId) {
      return NextResponse.json({ error: 'A browserSessionId is required', code: 'BROWSER_SESSION_ID_REQUIRED' }, { status: 400 })
    }
    const occurrenceId = String(body?.occurrenceId || '').trim()
    if (!occurrenceId) {
      return NextResponse.json({ error: 'A Syllabus occurrenceId is required', code: 'SYLLABUS_OCCURRENCE_REQUIRED' }, { status: 400 })
    }
    const instructionalTeacher = String(body?.instructionalTeacher || '').trim().toLowerCase()
    if (!['sonoma', 'webb'].includes(instructionalTeacher)) {
      return NextResponse.json({ error: 'A valid instructionalTeacher is required', code: 'INSTRUCTIONAL_TEACHER_REQUIRED' }, { status: 400 })
    }
    const now = deps.now || new Date()
    const secret = deps.proofSecret || process.env.SUPABASE_SERVICE_ROLE_KEY
    const proof = readSyllabusExecutionProof(cookieValue(request, SYLLABUS_EXECUTION_COOKIE), secret, now)
    const proofAllowed = Boolean(proof && executionProofMatches(proof, {
      facilitatorId: context.user.id,
      learnerId,
      lessonKey,
      occurrenceId,
      instructionalTeacher,
      today: proof.today,
    }))
    if (!proofAllowed) {
      return NextResponse.json({ error: 'A valid scoped Syllabus execution authorization is required', code: 'SYLLABUS_EXECUTION_DENIED' }, { status: 403 })
    }

    const repository = deps.repository || createSyllabusRepository(context.admin)
    const learner = await repository.findOwnedLearner(learnerId, context.user.id)
    if (!learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized', code: 'FORBIDDEN' }, { status: 403 })
    }

    const deviceName = String(body?.deviceName || '').trim() || null
    const allowTakeover = Boolean(body?.takeoverPin)
    const expectedConflictingSessionId = normalizeUuid(body?.expectedConflictingSessionId)
    if (allowTakeover) {
      if (!expectedConflictingSessionId) {
        return NextResponse.json({ error: 'The observed conflicting session is required for takeover', code: 'EXPECTED_CONFLICT_REQUIRED' }, { status: 409 })
      }
      const verifyPin = deps.verifyFacilitatorPinForUser || verifyFacilitatorPinForUser
      if (!await verifyPin(context.admin, context.user.id, body.takeoverPin)) {
        return NextResponse.json({ error: 'Invalid Facilitator PIN', code: 'INVALID_FACILITATOR_PIN' }, { status: 403 })
      }
    }

    const runTransaction = deps.startSessionTransaction || startSessionTransaction
    const result = await runTransaction(context.admin, {
      p_learner_id: learnerId,
      p_lesson_id: lessonKey,
      p_browser_session_id: browserSessionId,
      p_device_name: deviceName,
      p_allow_takeover: allowTakeover,
      p_expected_conflicting_session_id: expectedConflictingSessionId,
      p_syllabus_occurrence_id: occurrenceId,
      p_instructional_teacher: instructionalTeacher,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Could not start the authorized lesson session' }, { status: 500 })
  }
}
