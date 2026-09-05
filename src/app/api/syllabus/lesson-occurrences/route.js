import { NextResponse } from 'next/server.js'
import { loadSyllabusAccess, requireSyllabusFuturePlanning } from '../../../lib/syllabus/entitlements.server.mjs'
import { removeLessonOccurrenceFromSyllabus } from '../../../lib/syllabus/lessonOccurrenceRemoval.server.mjs'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { SyllabusError } from '../../../lib/syllabus/schema.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const REQUEST_FIELDS = new Set([
  'learnerId',
  'lessonKey',
  'occurrenceId',
  'expectedActiveRevisionId',
])

function invalidRequest(message) {
  return new SyllabusError(message, 400, 'INVALID_SYLLABUS_OCCURRENCE')
}

function requiredString(body, field) {
  const value = body[field]
  if (typeof value !== 'string' || !value.trim()) {
    throw invalidRequest(`${field} must be a non-empty string`)
  }
  return value
}

function validateBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidRequest('A JSON object is required')
  }
  const unsupportedField = Object.keys(body).find((field) => !REQUEST_FIELDS.has(field))
  if (unsupportedField) {
    throw invalidRequest(`Unsupported request field: ${unsupportedField}`)
  }
  const learnerId = requiredString(body, 'learnerId')
  const lessonKey = requiredString(body, 'lessonKey')
  const occurrenceId = requiredString(body, 'occurrenceId')
  let expectedActiveRevisionId = null
  if (Object.prototype.hasOwnProperty.call(body, 'expectedActiveRevisionId')) {
    if (body.expectedActiveRevisionId !== null
      && (typeof body.expectedActiveRevisionId !== 'string' || !body.expectedActiveRevisionId.trim())) {
      throw invalidRequest('expectedActiveRevisionId must be a non-empty string or null')
    }
    expectedActiveRevisionId = body.expectedActiveRevisionId
  }
  return { learnerId, lessonKey, occurrenceId, expectedActiveRevisionId }
}

export async function DELETE(request, deps = {}) {
  try {
    const getRequestContext = deps.getRequestContext || getSyllabusRequestContext
    const context = await getRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })

    let body
    try {
      body = await request.json()
    } catch {
      throw invalidRequest('A valid JSON request body is required')
    }
    const input = validateBody(body)
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const access = deps.syllabusAccess || await loadSyllabusAccess(context.admin, context.user.id)
    const requireFuturePlanning = deps.requireSyllabusFuturePlanning || requireSyllabusFuturePlanning
    requireFuturePlanning(access)
    const removeOccurrence = deps.removeLessonOccurrenceFromSyllabus || removeLessonOccurrenceFromSyllabus
    const result = await removeOccurrence({
      admin: context.admin,
      repository,
      facilitatorId: context.user.id,
      ...input,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const isSyllabusError = error instanceof SyllabusError
    return NextResponse.json({
      error: isSyllabusError ? error.message : 'Lesson occurrence removal failed',
      ...(isSyllabusError ? { code: error.code } : {}),
    }, { status: isSyllabusError ? error.status : 500 })
  }
}
