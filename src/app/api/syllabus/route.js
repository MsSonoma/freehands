import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../lib/syllabus/supabaseRepository.server.mjs'
import { getActiveSyllabus } from '../../lib/syllabus/revisions.server.mjs'
import { SyllabusError, validateLearnerId } from '../../lib/syllabus/schema.mjs'
import { isMasteryEvidenceEnabled } from '../../lib/masteryEvidence/constants.js'
import { buildFollowUpAvailability, normalizeFollowUpSettings } from '../../lib/masteryEvidence/followUps.service.js'
import { createSupabaseFollowUpRepository, loadLessonForFollowUp } from '../../lib/masteryEvidence/followUps.server.js'
import { buildSyllabusReviewProjection } from '../../lib/syllabus/reviewProjection.mjs'

export const dynamic = 'force-dynamic'

export async function GET(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const url = new URL(request.url)
    const learnerId = validateLearnerId(url.searchParams.get('learnerId'))
    const view = url.searchParams.get('view') === 'shell' ? 'shell' : 'full'
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const result = await getActiveSyllabus({
      repository,
      admin: context.admin,
      facilitatorId: context.user.id,
      learnerId,
      fallbackTimeZone: context.user?.user_metadata?.timezone,
      view,
    })
    if (view === 'full' && result?.has_active_syllabus && Array.isArray(result.timeline_items) && isMasteryEvidenceEnabled(process.env)) {
      try {
        const followUpRepository = createSupabaseFollowUpRepository(context.admin)
        const learner = await followUpRepository.findOwnedLearner({ userId: context.user.id, learnerId })
        const settings = normalizeFollowUpSettings(learner || {})
        const preliminary = buildSyllabusReviewProjection({
          timelineItems: result.timeline_items,
          settings,
          today: result.resolved_today,
          timeZone: result.resolved_timezone || 'UTC',
        })
        const availability = await buildFollowUpAvailability({
          repository: followUpRepository,
          userId: context.user.id,
          learnerId,
          loadLesson: (lessonKey) => loadLessonForFollowUp({
            lessonKey,
            facilitatorId: context.user.id,
            admin: context.admin,
          }),
          now: new Date().toISOString(),
          dailyReviewCycles: preliminary.dailyReviewCycles,
        })
        const projection = buildSyllabusReviewProjection({
          timelineItems: result.timeline_items,
          settings,
          today: result.resolved_today,
          timeZone: result.resolved_timezone || 'UTC',
          availability,
        })
        result.timeline_items = [...result.timeline_items, ...projection.items]
        result.review_settings = settings
      } catch {
        result.review_projection_status = 'unavailable'
      }
    }
    return NextResponse.json(result)
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status })
  }
}
