import { legacyForecastItems, normalizeWeeklyPattern, subjectsFromLegacy } from './forecast.mjs'
import { todayDate } from './schema.mjs'

export async function buildLegacySeed({ repository, facilitatorId, learnerId, now = new Date() }) {
  const learner = await repository.findOwnedLearner(learnerId, facilitatorId)
  if (!learner) return null
  const today = todayDate(now)
  const source = await repository.readLegacyPlanning({ facilitatorId, learnerId, today })
  const activeTemplate = (source.scheduleTemplates || []).find((item) => item.active) || source.scheduleTemplates?.[0] || null
  const weeklyPattern = normalizeWeeklyPattern(activeTemplate?.pattern)
  const forecastItems = legacyForecastItems(source.plannedLessons, { today })

  return {
    schema_version: 1,
    effective_from: today,
    goals: { legacy_notes: learner.goals_notes || '' },
    subjects: subjectsFromLegacy({ weeklyPattern, plannedLessons: source.plannedLessons }),
    weekly_pattern: weeklyPattern,
    teaching_guidance: { curriculum_preferences: source.curriculumPreferences || null },
    planning_policy: { source: 'legacy_planner', automatic_reforecasting: false },
    legacy_provenance: {
      seeded_at: now.toISOString(),
      sources: {
        schedule_template_id: activeTemplate?.id || null,
        curriculum_preferences_id: source.curriculumPreferences?.id || null,
        goals_notes: Boolean(learner.goals_notes),
        planned_lesson_ids: (source.plannedLessons || []).map((row) => row.id).filter(Boolean),
      },
    },
    forecast_items: forecastItems,
    available_subjects: (source.customSubjects || []).map(({ id, name }) => ({ id, name })),
    learner: { id: learner.id, name: learner.name || 'Learner' },
  }
}
