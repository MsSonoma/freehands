import { normalizeLessonKey } from './lessonKeyNormalization.js'

const WORKFLOW_SOURCES = new Set(['syllabus', 'calendar', 'library', 'home'])

export function normalizeLessonWorkflowSource(source = '') {
  const value = String(source || '').trim().toLowerCase()
  return WORKFLOW_SOURCES.has(value) ? value : 'library'
}

export function buildLessonGeneratorReviewHref({
  learnerId = '',
  lessonKey = '',
  source = 'library',
  plannedDate = '',
  occurrenceId = '',
  expectedActiveRevisionId = '',
} = {}) {
  const canonicalKey = normalizeLessonKey(lessonKey)
  const params = new URLSearchParams({ mode: 'review', source: normalizeLessonWorkflowSource(source) })
  if (learnerId) params.set('learnerId', String(learnerId))
  if (canonicalKey) params.set('lessonKey', canonicalKey)
  if (plannedDate) params.set('plannedDate', String(plannedDate).slice(0, 10))
  if (occurrenceId) params.set('occurrenceId', String(occurrenceId))
  if (expectedActiveRevisionId) params.set('expectedActiveRevisionId', String(expectedActiveRevisionId))
  return `/facilitator/generator?${params.toString()}`
}

export function buildLessonWorkflowReturnHref({
  source = 'library',
  learnerId = '',
  plannedDate = '',
  lessonKey = '',
  occurrenceId = '',
} = {}) {
  const normalizedSource = normalizeLessonWorkflowSource(source)
  if (normalizedSource === 'library') return '/facilitator/lessons'

  const path = normalizedSource === 'calendar' ? '/facilitator/calendar' : '/facilitator/syllabus'
  const params = new URLSearchParams()
  if (learnerId) params.set('learnerId', String(learnerId))
  if (plannedDate) params.set('date', String(plannedDate).slice(0, 10))
  const canonicalKey = normalizeLessonKey(lessonKey)
  if (canonicalKey) params.set('lessonKey', canonicalKey)
  if (occurrenceId) params.set('occurrenceId', String(occurrenceId))
  const query = params.toString()
  return query ? `${path}?${query}` : path
}
