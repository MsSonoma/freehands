import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { activateProposedSyllabus, activateSyllabus, establishSyllabusFromLegacyPlan } from '../../../lib/syllabus/revisions.server.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { loadSyllabusAccess, requireSyllabusFuturePlanning } from '../../../lib/syllabus/entitlements.server.mjs'
import { verifyFacilitatorPinForUser } from '../../../lib/facilitatorPin.server.mjs'
import { resolveCalendarContext } from '../../../lib/calendarDate.mjs'

export const dynamic = 'force-dynamic'

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const access = deps.syllabusAccess || await loadSyllabusAccess(context.admin, context.user.id)
    const now = deps.now || new Date()
    let profileTimeZone = null
    if (context.admin?.from) {
      const { data: profile } = await context.admin.from('profiles').select('timezone').eq('id', context.user.id).maybeSingle()
      profileTimeZone = profile?.timezone || null
    }
    const today = deps.today || resolveCalendarContext({ now, profileTimeZone, fallbackTimeZone: context.user?.user_metadata?.timezone }).today
    let allowCapacityException = false
    if (body?.exceptionPin) {
      const verifyPin = deps.verifyFacilitatorPinForUser || verifyFacilitatorPinForUser
      if (!await verifyPin(context.admin, context.user.id, body.exceptionPin)) {
        return NextResponse.json({ error: 'Invalid Facilitator PIN', code: 'INVALID_FACILITATOR_PIN' }, { status: 403 })
      }
      allowCapacityException = true
    }
    if (body?.proposalRevisionId) requireSyllabusFuturePlanning(access)
    if (!body?.proposalRevisionId && !access.can_change_intent && body?.establishFromCurrentPlan !== true) {
      requireSyllabusFuturePlanning(access)
    }
    let result
    if (body?.proposalRevisionId) {
      result = await activateProposedSyllabus({
        repository,
        facilitatorId: context.user.id,
        learnerId,
        proposalRevisionId: body.proposalRevisionId,
        expectedActiveRevisionId: body.expectedActiveRevisionId,
        now,
        today,
        allowCapacityException,
      })
    } else if (!access.can_change_intent) {
      result = await establishSyllabusFromLegacyPlan({
        repository,
        facilitatorId: context.user.id,
        learnerId,
        teachingGuidanceOverride: body?.teachingGuidanceOverride,
        now,
        today,
        allowCapacityException,
      })
    } else {
      result = await activateSyllabus({
        repository,
        facilitatorId: context.user.id,
        learnerId,
        snapshot: body?.snapshot,
        now,
        today,
        allowCapacityException,
        expectedActiveRevisionId: body?.expectedActiveRevisionId,
      })
    }
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Internal server error', code: error.code, conflict: error.conflict }, { status })
  }
}
