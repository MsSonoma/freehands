import { NextResponse } from 'next/server.js'
import { loadLessonForFollowUp } from '../../../lib/masteryEvidence/followUps.server.js'
import { resolveCalendarContext } from '../../../lib/calendarDate.mjs'
import { loadSyllabusAccess, requireSyllabusFuturePlanning } from '../../../lib/syllabus/entitlements.server.mjs'
import { generateInstructionalForecastItems } from '../../../lib/syllabus/learningForecastModel.server.mjs'
import {
  createFacilitatorConcept,
  editFacilitatorConcept,
  editLearningForecastConcept,
  removeFacilitatorConcept,
  replaceLearningForecastConcept,
  suggestPlanAheadConcepts,
} from '../../../lib/syllabus/planning.server.mjs'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const access = deps.syllabusAccess || await loadSyllabusAccess(context.admin, context.user.id)
    requireSyllabusFuturePlanning(access)
    const now = deps.now || new Date()
    const profileTimeZone = typeof repository.findFacilitatorTimeZone === 'function' ? await repository.findFacilitatorTimeZone(context.user.id) : null
    const today = deps.today || resolveCalendarContext({ now, profileTimeZone, fallbackTimeZone: context.user?.user_metadata?.timezone }).today
    const common = { repository, facilitatorId: context.user.id, learnerId, expectedActiveRevisionId: body?.expectedActiveRevisionId, now, today }
    let result
    if (body?.action === 'create') result = await createFacilitatorConcept({ ...common, plannedDate: body.plannedDate, sortOrder: body.sortOrder, title: body.title, description: body.description })
    else if (body?.action === 'edit') result = await editFacilitatorConcept({ ...common, lineageId: body.lineageId, title: body.title, description: body.description })
    else if (body?.action === 'remove') result = await removeFacilitatorConcept({ ...common, lineageId: body.lineageId })
    else if (body?.action === 'edit_forecast') result = await editLearningForecastConcept({ ...common, proposalRevisionId: body.proposalRevisionId, lineageId: body.lineageId, title: body.title, description: body.description })
    else if (body?.action === 'replace_forecast') result = await replaceLearningForecastConcept({
      ...common, proposalRevisionId: body.proposalRevisionId, lineageId: body.lineageId,
      reports: deps.reports, loadReports: deps.loadReports, generateItems: deps.generateItems || generateInstructionalForecastItems,
      resolveLesson: (lessonKey) => loadLessonForFollowUp({ lessonKey, facilitatorId: context.user.id, admin: context.admin }),
    })
    else if (body?.action === 'suggest') result = await suggestPlanAheadConcepts({
      ...common, slots: body.slots, reports: deps.reports, loadReports: deps.loadReports,
      generateItems: deps.generateItems || generateInstructionalForecastItems,
      resolveLesson: (lessonKey) => loadLessonForFollowUp({ lessonKey, facilitatorId: context.user.id, admin: context.admin }),
    })
    else throw new SyllabusError('Unsupported Syllabus planning action.', 400, 'PLANNING_ACTION_INVALID')
    return NextResponse.json({ ok: true, ...result }, { status: body.action === 'suggest' || body.action === 'replace_forecast' ? 200 : 201 })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Syllabus planning failed', code: error.code }, { status })
  }
}
