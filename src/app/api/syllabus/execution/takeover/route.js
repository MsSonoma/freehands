import { NextResponse } from 'next/server.js'
import { normalizeLessonKey } from '../../../../lib/lessonKeyNormalization.js'
import { verifyFacilitatorPinForUser } from '../../../../lib/facilitatorPin.server.mjs'
import { getSyllabusRequestContext } from '../../../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../../../lib/syllabus/supabaseRepository.server.mjs'
import { validateLearnerId } from '../../../../lib/syllabus/schema.mjs'
import {
  createSyllabusExecutionProof,
  createSyllabusTakeoverProof,
  PROOF_TTL_SECONDS,
  resolveSyllabusExecution,
  SYLLABUS_EXECUTION_COOKIE,
  SYLLABUS_TAKEOVER_COOKIE,
} from '../../../../lib/syllabus/executionAuthorization.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizeUuid(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const lessonKey = normalizeLessonKey(body?.lessonKey)
    const occurrenceId = String(body?.occurrenceId || '').trim()
    const instructionalTeacher = String(body?.instructionalTeacher || '').trim().toLowerCase()
    const expectedConflictingSessionId = normalizeUuid(body?.expectedConflictingSessionId)
    const takeoverPin = String(body?.takeoverPin || '')
    if (!lessonKey) return NextResponse.json({ error: 'A lessonKey is required', code: 'LESSON_ID_REQUIRED' }, { status: 400 })
    if (!occurrenceId) return NextResponse.json({ error: 'A Syllabus occurrenceId is required', code: 'SYLLABUS_OCCURRENCE_REQUIRED' }, { status: 400 })
    if (!['sonoma', 'webb'].includes(instructionalTeacher)) {
      return NextResponse.json({ error: 'A valid instructionalTeacher is required', code: 'INSTRUCTIONAL_TEACHER_REQUIRED' }, { status: 400 })
    }
    if (!expectedConflictingSessionId) {
      return NextResponse.json({ error: 'The observed conflicting session is required for takeover', code: 'EXPECTED_CONFLICT_REQUIRED' }, { status: 400 })
    }
    if (!/^\d{4,8}$/.test(takeoverPin)) {
      return NextResponse.json({ error: 'Facilitator PIN must be 4-8 digits', code: 'INVALID_FACILITATOR_PIN' }, { status: 403 })
    }

    const now = deps.now || new Date()
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const decision = await resolveSyllabusExecution({
      repository,
      admin: context.admin,
      facilitatorId: context.user.id,
      learnerId,
      lessonKey,
      occurrenceId,
      now,
      fallbackTimeZone: context.user?.user_metadata?.timezone,
    })
    if (decision.instructionalTeacher !== instructionalTeacher) {
      return NextResponse.json({ error: 'This lesson is assigned to a different instructional teacher.', code: 'INSTRUCTIONAL_TEACHER_MISMATCH' }, { status: 403 })
    }
    const verifyPin = deps.verifyFacilitatorPinForUser || verifyFacilitatorPinForUser
    if (!await verifyPin(context.admin, context.user.id, takeoverPin)) {
      return NextResponse.json({ error: 'Invalid Facilitator PIN', code: 'INVALID_FACILITATOR_PIN' }, { status: 403 })
    }

    const secret = deps.proofSecret || process.env.SUPABASE_SERVICE_ROLE_KEY
    const executionScope = decision.scope
    const takeoverScope = {
      facilitatorId: context.user.id,
      learnerId,
      lessonKey: executionScope.lessonKey,
      occurrenceId: executionScope.occurrenceId,
      instructionalTeacher,
      expectedConflictingSessionId,
    }
    const response = NextResponse.json({
      ok: true,
      occurrenceId: executionScope.occurrenceId,
      lessonKey: executionScope.lessonKey,
      instructionalTeacher,
      expectedConflictingSessionId,
    })
    const cookieOptions = {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: PROOF_TTL_SECONDS,
    }
    response.cookies.set(SYLLABUS_EXECUTION_COOKIE, createSyllabusExecutionProof(executionScope, secret, now), cookieOptions)
    response.cookies.set(SYLLABUS_TAKEOVER_COOKIE, createSyllabusTakeoverProof(takeoverScope, secret, now), cookieOptions)
    return response
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Could not authorize this lesson takeover', code: error?.code || 'TAKEOVER_AUTHORIZATION_FAILED' }, { status: error?.status || 500 })
  }
}