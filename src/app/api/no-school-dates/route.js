import { NextResponse } from 'next/server.js'
import { resolveCalendarContext } from '../../lib/calendarDate.mjs'
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
    const destinationDate = body?.moveToDate ? clean(body.moveToDate, 10) : ''
    const reason = clean(body?.reason, 300) || null
    if (destinationDate) {
      if (!isCalendarDate(destinationDate) || date === destinationDate) {
        throw new SyllabusError('Choose another valid date for the one-time move.', 400, 'INVALID_DAY_OFF_MOVE')
      }
      const expectedActiveRevisionId = clean(body?.expectedActiveRevisionId, 50)
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(expectedActiveRevisionId)) {
        throw new SyllabusError('Reload the Syllabus before moving these lessons.', 409, 'DAY_OFF_MOVE_STALE')
      }
      const profileTimeZone = typeof repository.findFacilitatorTimeZone === 'function'
        ? await repository.findFacilitatorTimeZone(context.user.id)
        : null
      const calendar = resolveCalendarContext({
        profileTimeZone,
        fallbackTimeZone: context.user?.user_metadata?.timezone,
      })
      if (date < calendar.today || destinationDate < calendar.today) {
        throw new SyllabusError('Day Off moves must use current or future dates.', 400, 'INVALID_DAY_OFF_MOVE')
      }
      const moved = await (deps.moveNoSchoolDay || ((options) => repository.moveNoSchoolDay(options)))({
        facilitatorId: context.user.id,
        learnerId,
        sourceDate: date,
        destinationDate,
        reason,
        localToday: calendar.today,
        expectedActiveRevisionId,
      })
      return NextResponse.json({ ok: true, move: moved })
    }
    const saved = await repository.upsertNoSchoolDate({ facilitator_id: context.user.id, learner_id: learnerId, date, reason })
    return NextResponse.json({ ok: true, date: saved })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : (error?.status || 500)
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
