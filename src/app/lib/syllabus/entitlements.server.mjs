import { syllabusEntitlementsFor } from './timeline.mjs'
import { SyllabusError } from './schema.mjs'

export function syllabusAccessFromProfile(profile = {}) {
  return syllabusEntitlementsFor({
    role: 'facilitator',
    subscriptionTier: profile?.subscription_tier,
    planTier: profile?.plan_tier,
  })
}

export async function loadSyllabusAccess(admin, userId) {
  const { data, error } = await admin.from('profiles')
    .select('subscription_tier,plan_tier')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new SyllabusError('Could not verify Syllabus planning access', 500, 'ENTITLEMENT_CHECK_FAILED')
  return syllabusAccessFromProfile(data || {})
}

export function requireSyllabusFuturePlanning(access) {
  if (!access?.can_change_intent) {
    throw new SyllabusError('Future Syllabus planning requires the current Lesson Planner entitlement', 403, 'SYLLABUS_PLANNING_REQUIRED')
  }
}
