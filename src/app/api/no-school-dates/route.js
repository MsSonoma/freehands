import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../lib/syllabus/supabaseRepository.server.mjs'
import { isCalendarDate, SyllabusError, validateLearnerId } from '../../lib/syllabus/schema.mjs'

export const dynamic = 'force-dynamic'

function clean(value, max = Infinity) { return String(value || '').trim().slice(0, max) }

async function ownedContext(request, deps) {
  const context = await getSyllabusRequestContext(request, deps)
  if (context.error) return { response: NextResponse.json({ error: context.error }, { status: context.status }) }
  const repository = deps.repository || createSyllabusRepository(context.admin)
  return { context, repository }
}

export async function GET(request, deps = {}) {
  try {
    const resolved = await ownedContext(request, deps)
    if (resolved.response) return resolved.response
    const { context, repository } = resolved
    const learnerId = validateLearnerId(new URL(request.url).searchParams.get('learnerId'))
    if (!await repository.findOwnedLearner(learnerId, context.user.id)) throw new SyllabusError('Learner not found or unauthorized', 403, 'FORBIDDEN')
    const dates = await repository.listNoSchoolDates(context.user.id, learnerId)
    return NextResponse.json({ dates })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Could not load no-school dates', code: error.code }, { status })
  }
}

export async function POST(request, deps = {}) {
  try {
    const resolved = await ownedContext(request, deps)
    if (resolved.response) return resolved.response
    const { context, repository } = resolved
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const date = clean(body?.date, 10)
    if (!isCalendarDate(date)) throw new SyllabusError('A valid calendar date is required', 400, 'INVALID_NO_SCHOOL_DATE')
    if (!await repository.findOwnedLearner(learnerId, context.user.id)) throw new SyllabusError('Learner not found or unauthorized', 403, 'FORBIDDEN')
    const saved = await repository.upsertNoSchoolDate({ facilitator_id: context.user.id, learner_id: learnerId, date, reason: clean(body?.reason, 300) || null })
    return NextResponse.json({ ok: true, date: saved })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Could not save no-school date', code: error.code }, { status })
  }
}

export async function DELETE(request, deps = {}) {
  try {
    const resolved = await ownedContext(request, deps)
    if (resolved.response) return resolved.response
    const { context, repository } = resolved
    const params = new URL(request.url).searchParams
    const learnerId = validateLearnerId(params.get('learnerId'))
    const date = clean(params.get('date'), 10)
    if (!isCalendarDate(date)) throw new SyllabusError('A valid calendar date is required', 400, 'INVALID_NO_SCHOOL_DATE')
    if (!await repository.findOwnedLearner(learnerId, context.user.id)) throw new SyllabusError('Learner not found or unauthorized', 403, 'FORBIDDEN')
    await repository.deleteNoSchoolDate(context.user.id, learnerId, date)
    return NextResponse.json({ ok: true })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Could not remove no-school date', code: error.code }, { status })
  }
}
