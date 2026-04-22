/**
 * webbCompletionClient.js
 *
 * Tracks Mrs. Webb essay-completion status per learner per lesson.
 * Stored in localStorage (key: webb_completion_v1) so it persists
 * across page reloads without requiring a DB migration.
 *
 * Schema: { [learnerId]: { [lessonKey]: { completed: true, completedAt: ISO } } }
 *
 * lessonKey format matches the lesson's lessonKey / lesson_id field.
 */

const LS_KEY = 'webb_completion_v1'

function read() {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}

function write(obj) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)) } catch {}
}

/**
 * Returns the completion map for one learner: { [lessonKey]: { completed, completedAt } }
 */
export function getWebbCompletionForLearner(learnerId) {
  if (!learnerId) return {}
  return read()[learnerId] || {}
}

/**
 * Returns true if this learner has completed this lesson via Mrs. Webb.
 */
export function isWebbCompleted(learnerId, lessonKey) {
  if (!learnerId || !lessonKey) return false
  return !!(read()[learnerId]?.[lessonKey]?.completed)
}

/**
 * Records essay completion for a learner + lesson. Idempotent — safe to call multiple times.
 */
export function saveWebbCompletion(learnerId, lessonKey) {
  if (!learnerId || !lessonKey) return
  const all = read()
  if (!all[learnerId]) all[learnerId] = {}
  all[learnerId][lessonKey] = { completed: true, completedAt: new Date().toISOString() }
  write(all)
}
