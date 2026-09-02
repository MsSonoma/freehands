/**
 * masteryClient.js
 *
 * Legacy Mr. Slate compatibility helpers.
 *
 * `slate_mastery_v1` is no longer educational authority. Canonical mastery is
 * loaded from append-only mastery evidence through getCanonicalMasteryForLearner.
 *
 * lessonKey format: "<subject>/<filename>.json"  e.g. "math/4th_Geometry_Angles_Classification_Beginner.json"
 */

export function slateEmojiForTier(tier) {
  if (tier === 'gold')   return '🏅'
  if (tier === 'silver') return '🥈'
  if (tier === 'bronze') return '🥉'
  return '�'
}

/**
 * Returns the mastery map for one learner: { [lessonKey]: { mastered, masteredAt } }
 */
export function getMasteryForLearner() {
  return {}
}

/**
 * Returns true if this learner has mastered this lesson.
 */
export function isMastered() {
  return false
}

/**
 * Deprecated point-score writer. It deliberately fails closed.
 */
export function saveMastery() {
  // Intentionally does not write. Retained only so older callers fail closed.
  return { ok: false, canonical: false, reason: 'legacy_point_mastery_disabled' }
}

export async function getCanonicalMasteryForLearner(learnerId) {
  if (!learnerId || learnerId === 'demo') return {}
  const { getSupabaseClient } = await import('./supabaseClient.js')
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) return {}
  const response = await fetch(`/api/learner/mastery-status?learner_id=${encodeURIComponent(learnerId)}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: 'no-store',
  })
  if (!response.ok) return {}
  const body = await response.json().catch(() => ({}))
  return body?.mastery || {}
}
