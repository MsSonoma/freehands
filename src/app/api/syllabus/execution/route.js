import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { verifyFacilitatorPinForUser } from '../../../lib/facilitatorPin.server.mjs'
import {
  createSyllabusExecutionProof,
  executionProofMatches,
  PROOF_TTL_SECONDS,
  readSyllabusExecutionProof,
  resolveSyllabusExecution,
  SYLLABUS_EXECUTION_COOKIE,
} from '../../../lib/syllabus/executionAuthorization.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function cookieValue(request, name) {
  const source = request.headers.get('cookie') || ''
  const prefix = `${name}=`
  const row = source.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix))
  return row ? decodeURIComponent(row.slice(prefix.length)) : ''
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const lessonKey = String(body?.lessonKey || '').trim()
    if (!lessonKey) throw new SyllabusError('A lessonKey is required')
    const now = deps.now || new Date()
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const decision = await resolveSyllabusExecution({
      repository,
      admin: context.admin,
      facilitatorId: context.user.id,
      learnerId,
      lessonKey,
      occurrenceId: body?.occurrenceId,
      now,
      fallbackTimeZone: context.user?.user_metadata?.timezone,
    })
    const requestedInstructionalTeacher = String(body?.instructionalTeacher || '').trim().toLowerCase()
    if (requestedInstructionalTeacher && requestedInstructionalTeacher !== decision.instructionalTeacher) {
      return NextResponse.json({
        error: 'This lesson is assigned to a different instructional teacher.',
        code: 'INSTRUCTIONAL_TEACHER_MISMATCH',
      }, { status: 403 })
    }
    const secret = deps.proofSecret || process.env.SUPABASE_SERVICE_ROLE_KEY
    const existingProof = readSyllabusExecutionProof(cookieValue(request, SYLLABUS_EXECUTION_COOKIE), secret, now)
    let authorization = decision.allowedWithoutPin ? 'today' : null
    if (!authorization && executionProofMatches(existingProof, decision.scope)) authorization = 'scoped_pin_proof'
    if (!authorization && body?.exceptionPin) {
      const verifyPin = deps.verifyFacilitatorPinForUser || verifyFacilitatorPinForUser
      if (!await verifyPin(context.admin, context.user.id, body.exceptionPin)) {
        return NextResponse.json({ error: 'Invalid Facilitator PIN', code: 'INVALID_FACILITATOR_PIN' }, { status: 403 })
      }
      authorization = 'fresh_pin'
    }
    if (!authorization) {
      return NextResponse.json({
        error: decision.reason === 'completed_repeat'
          ? 'A fresh Facilitator PIN is required to repeat completed work.'
          : 'A fresh Facilitator PIN is required to start a non-today Syllabus occurrence.',
        code: 'SYLLABUS_EXECUTION_PIN_REQUIRED',
        reason: decision.reason,
      }, { status: 409 })
    }
    const response = NextResponse.json({
      ok: true,
      authorization,
      occurrenceId: decision.scope.occurrenceId,
      lessonKey: decision.scope.lessonKey,
      instructionalTeacher: decision.instructionalTeacher,
      today: decision.calendar.today,
      timeZone: decision.calendar.timeZone,
    })
    response.cookies.set(SYLLABUS_EXECUTION_COOKIE, createSyllabusExecutionProof(decision.scope, secret, now), {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: PROOF_TTL_SECONDS,
    })
    return response
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Internal server error', code: error.code || 'INTERNAL_ERROR' }, { status })
  }
}
