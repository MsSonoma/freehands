import { NextResponse } from 'next/server.js'
import { loadLessonForFollowUp } from '../../../lib/masteryEvidence/followUps.server.js'
import { loadSyllabusAccess, requireSyllabusFuturePlanning } from '../../../lib/syllabus/entitlements.server.mjs'
import { createLearningForecastProposal } from '../../../lib/syllabus/learningForecast.server.mjs'
import { generateInstructionalForecastItems } from '../../../lib/syllabus/learningForecastModel.server.mjs'
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
    const result = await createLearningForecastProposal({
      repository,
      admin: context.admin,
      facilitatorId: context.user.id,
      learnerId,
      expectedActiveRevisionId: body?.expectedActiveRevisionId,
      reports: deps.reports,
      loadReports: deps.loadReports,
      generateItems: deps.generateItems || generateInstructionalForecastItems,
      resolveLesson: (lessonKey) => loadLessonForFollowUp({ lessonKey, facilitatorId: context.user.id, admin: context.admin }),
      now: deps.now || new Date(),
      fallbackTimeZone: context.user?.user_metadata?.timezone,
    })
    return NextResponse.json({ ok: true, ...result }, { status: result.kind === 'proposal' && !result.reused ? 201 : 200 })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Instructional forecasting failed', code: error.code }, { status })
  }
}
