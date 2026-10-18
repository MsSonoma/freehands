import { createSyllabusRepository } from './supabaseRepository.server.mjs'
import { getActiveSyllabus } from './revisions.server.mjs'
import { buildSyllabusReviewProjection } from './reviewProjection.mjs'

export async function loadSyllabusReviewCyclesForLearner({
  admin,
  facilitatorId,
  learnerId,
  now = new Date(),
  fallbackTimeZone,
} = {}) {
  const empty = { dailyReviewCycles: [], weeklyReviewCycles: null }
  if (!admin || !facilitatorId || !learnerId) return empty
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
  if (!syllabus?.has_active_syllabus || !Array.isArray(syllabus.timeline_items)) return empty
  const [learner, dayOffMoves] = await Promise.all([
    repository.findOwnedLearner(learnerId, facilitatorId),
    repository.listDayOffMoves(facilitatorId, learnerId).catch(() => []),
  ])
  if (!learner) return empty
  const projection = buildSyllabusReviewProjection({
    timelineItems: syllabus.timeline_items,
    settings: learner,
    today: syllabus.resolved_today,
    timeZone: syllabus.resolved_timezone || 'UTC',
    dayOffMoves,
  })
  return {
    dailyReviewCycles: projection.dailyReviewCycles,
    weeklyReviewCycles: projection.weeklyReviewCycles,
  }
}

// Preserve the older caller contract.
export async function loadDailyReviewCyclesForLearner(options = {}) {
  const projection = await loadSyllabusReviewCyclesForLearner(options)
  return projection.dailyReviewCycles
}
