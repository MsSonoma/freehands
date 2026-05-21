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

function tierForPercent(p) {
  if (p >= 90) return 'gold'
  if (p >= 80) return 'silver'
  if (p >= 70) return 'bronze'
  return null
}

export function slateEmojiForTier(tier) {
  if (tier === 'gold')   return '🏅'
  if (tier === 'silver') return '🥈'
  if (tier === 'bronze') return '🥉'
  return '�'
}

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
 * Records mastery for a learner + lesson. Stores the best (highest) percent achieved.
 * @param {string} learnerId
 * @param {string} lessonKey
 * @param {number} [percent] - scoreGoal / nonTimeoutTries * 100, rounded
 */
export function saveMastery(learnerId, lessonKey, percent) {
  if (!learnerId || !lessonKey) return
  const all = read()
  if (!all[learnerId]) all[learnerId] = {}
  const existing = all[learnerId][lessonKey] || {}
  const newPercent = typeof percent === 'number' && isFinite(percent) ? Math.min(100, percent) : null
  const isBetter = newPercent !== null && (existing.bestPercent == null || newPercent > existing.bestPercent)
  all[learnerId][lessonKey] = {
    mastered: true,
    masteredAt: existing.masteredAt || new Date().toISOString(),
    bestPercent: isBetter ? newPercent : (existing.bestPercent ?? null),
    medalTier:   isBetter ? tierForPercent(newPercent) : (existing.medalTier ?? null),
  }
  write(all)
}
