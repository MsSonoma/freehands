import { createSyllabusRepository } from './supabaseRepository.server.mjs'
import { getActiveSyllabus } from './revisions.server.mjs'
import { buildDailyReviewCycles } from './reviewProjection.mjs'

export async function loadDailyReviewCyclesForLearner({
  admin,
  facilitatorId,
  learnerId,
  now = new Date(),
  fallbackTimeZone,
} = {}) {
  if (!admin || !facilitatorId || !learnerId) return []
  const repository = createSyllabusRepository(admin)
  const syllabus = await getActiveSyllabus({
    repository,
    admin,
    facilitatorId,
    learnerId,
    now,
    fallbackTimeZone,
    view: 'full',
  })
  if (!syllabus?.has_active_syllabus || !Array.isArray(syllabus.timeline_items)) return []
  const learner = await repository.findOwnedLearner(learnerId, facilitatorId)
  if (learner?.daily_followups_enabled !== true) return []
  return buildDailyReviewCycles({
    timelineItems: syllabus.timeline_items,
    enabled: true,
    today: syllabus.resolved_today,
    timeZone: syllabus.resolved_timezone || 'UTC',
  })
}
