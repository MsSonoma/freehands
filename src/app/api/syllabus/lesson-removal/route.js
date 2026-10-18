import { NextResponse } from 'next/server.js'
import { verifyFacilitatorPinForUser } from '../../../lib/facilitatorPin.server.mjs'
import { removeLessonWithFacilitatorOverride } from '../../../lib/syllabus/lessonOccurrenceOverride.server.mjs'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { SyllabusError } from '../../../lib/syllabus/schema.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const FIELDS = new Set([
  'learnerId', 'lessonKey', 'occurrenceId', 'evidenceDisposition', 'expectedActiveRevisionId', 'pin',
])

function parseRemovalBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((field) => !FIELDS.has(field))) {
    throw new SyllabusError('Invalid lesson removal request.', 400, 'INVALID_LESSON_REMOVAL')
  }
  const { learnerId, lessonKey, occurrenceId, evidenceDisposition, expectedActiveRevisionId, pin } = body
  if ([learnerId, lessonKey, occurrenceId].some((field) => typeof field !== 'string' || !field.trim())
    || !['keep', 'delete'].includes(evidenceDisposition)
    || typeof pin !== 'string' || !/^\d{4,8}$/.test(pin)
    || (expectedActiveRevisionId != null && (typeof expectedActiveRevisionId !== 'string' || !expectedActiveRevisionId.trim()))) {
    throw new SyllabusError('An exact lesson, evidence choice, and Facilitator PIN are required.', 400, 'INVALID_LESSON_REMOVAL')
  }
  return { learnerId, lessonKey, occurrenceId, evidenceDisposition, expectedActiveRevisionId: expectedActiveRevisionId || null, pin }
}

export async function POST(request, deps = {}) {
  try {
    const context = await (deps.getRequestContext || getSyllabusRequestContext)(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const input = parseRemovalBody(await request.json().catch(() => null))
    const verifyPin = deps.verifyPin || verifyFacilitatorPinForUser
    if (!await verifyPin(context.admin, context.user.id, input.pin)) {
      return NextResponse.json({ error: 'Incorrect Facilitator PIN', code: 'FACILITATOR_PIN_REQUIRED' }, { status: 403 })
    }
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const remove = deps.remove || removeLessonWithFacilitatorOverride
    const { pin, ...removal } = input
    const result = await remove({
      admin: context.admin,
      repository,
      facilitatorId: context.user.id,
      ...removal,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const expected = error instanceof SyllabusError
    return NextResponse.json({
      error: expected ? error.message : 'The lesson could not be removed. No success was confirmed.',
      ...(expected ? { code: error.code } : {}),
    }, { status: expected ? error.status : 500 })
  }
}
