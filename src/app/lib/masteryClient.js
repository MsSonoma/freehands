/**
 * masteryClient.js
 *
 * Tracks Mr. Slate mastery status per learner per lesson.
 * Stored in localStorage (key: slate_mastery_v1) so it persists
 * across page reloads without requiring a DB migration.
 *
 * Schema: { [learnerId]: { [lessonKey]: { mastered: true, masteredAt: ISO } } }
 *
 * lessonKey format: "<subject>/<filename>.json"  e.g. "math/4th_Geometry_Angles_Classification_Beginner.json"
 */

const LS_KEY = 'slate_mastery_v1'

function read() {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}

function write(obj) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)) } catch {}
}

/**
 * Returns the mastery map for one learner: { [lessonKey]: { mastered, masteredAt } }
 */
export function getMasteryForLearner(learnerId) {
  if (!learnerId) return {}
  return read()[learnerId] || {}
}

/**
 * Returns true if this learner has mastered this lesson.
 */
export function isMastered(learnerId, lessonKey) {
  if (!learnerId || !lessonKey) return false
  return !!(read()[learnerId]?.[lessonKey]?.mastered)
}

/**
 * Records mastery for a learner + lesson. Idempotent — safe to call multiple times.
 */
export function saveMastery(learnerId, lessonKey) {
  if (!learnerId || !lessonKey) return
  const all = read()
  if (!all[learnerId]) all[learnerId] = {}
  all[learnerId][lessonKey] = { mastered: true, masteredAt: new Date().toISOString() }
  write(all)
}
