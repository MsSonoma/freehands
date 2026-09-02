import { NextResponse } from 'next/server.js'
import { loadLessonForFollowUp } from '../../../lib/masteryEvidence/followUps.server.js'
import { isMasteryEvidenceEnabled } from '../../../lib/masteryEvidence/constants.js'
import { loadRecentMasteryReports } from '../../../lib/syllabus/masteryReports.server.mjs'
import { createMasteryReforecastProposal } from '../../../lib/syllabus/proposals.server.mjs'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { loadSyllabusAccess, requireSyllabusFuturePlanning } from '../../../lib/syllabus/entitlements.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const access = deps.syllabusAccess || await loadSyllabusAccess(context.admin, context.user.id)
    requireSyllabusFuturePlanning(access)
    const enabled = deps.reports
      ? true
      : (typeof deps.enabled === 'boolean' ? deps.enabled : isMasteryEvidenceEnabled(process.env))
    const reports = deps.reports || (enabled ? await (deps.loadReports || loadRecentMasteryReports)({
      repository,
      facilitatorId: context.user.id,
      learnerId,
      resolveLesson: (lessonKey) => loadLessonForFollowUp({
        lessonKey,
        facilitatorId: context.user.id,
        admin: context.admin,
      }),
    }) : [])
    const result = await createMasteryReforecastProposal({
      repository,
      facilitatorId: context.user.id,
      learnerId,
      expectedActiveRevisionId: body?.expectedActiveRevisionId,
      reports,
    })
    return NextResponse.json({ ok: true, ...result }, { status: result.kind === 'proposal' ? 201 : 200 })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status })
  }
}
