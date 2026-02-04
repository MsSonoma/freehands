// Plan entitlements mapping. Use plan_tier from profiles to gate features.
// Tiers: 'free' | 'trial' | 'standard' | 'pro' (plus optional legacy tiers like 'lifetime')

export const ENTITLEMENTS = {
  free: {
    lessonsPerDay: 1,
    allLessons: true, // Can see all lessons, just limited per day
    learnersMax: 1,
    devices: 1,
    lessonGenerator: false,
    lessonPlanner: false,
    askFeature: false, // Ask question requires Standard+
    goldenKeyFeatures: false,
    visualAids: true, // visible in session; usage may be gated elsewhere
    games: true, // visible in session; usage may be gated elsewhere
    lifetimeGenerations: 0,
    weeklyGenerations: 0,
    mentorSessions: 0,
  },
  trial: {
    lessonsPerDay: 1,
    allLessons: true,
    learnersMax: 1,
    devices: 1,
    // Trial allows lesson generation, but blocks planner + Mr. Mentor.
    // Quota enforcement uses lifetime/weekly generation limits.
    lessonGenerator: true,
    lessonPlanner: false,
    askFeature: false,
    goldenKeyFeatures: false,
    visualAids: false,
    games: false,
    lifetimeGenerations: 5,
    weeklyGenerations: 0,
    mentorSessions: 0,
  },
  standard: {
    lessonsPerDay: Infinity,
    allLessons: true,
    learnersMax: 2,
    devices: 1,
    lessonGenerator: true,
    lessonPlanner: false,
    askFeature: true,
    goldenKeyFeatures: true,
    visualAids: true,
    games: true,
    lifetimeGenerations: Infinity,
    weeklyGenerations: Infinity,
    mentorSessions: 0,
  },
  pro: {
    lessonsPerDay: Infinity,
    allLessons: true,
    learnersMax: 5,
    devices: 2,
    lessonGenerator: true,
    lessonPlanner: true,
    askFeature: true,
    goldenKeyFeatures: true,
    visualAids: true,
    games: true,
    lifetimeGenerations: Infinity,
    weeklyGenerations: Infinity,
    mentorSessions: Infinity,
  },
  lifetime: {
    // Legacy lifetime tier
    lessonsPerDay: Infinity,
    allLessons: true,
    learnersMax: 10,
    devices: 2,
    lessonGenerator: true,
    lessonPlanner: true,
    askFeature: true,
    goldenKeyFeatures: true,
    visualAids: true,
    games: true,
    lifetimeGenerations: Infinity,
    weeklyGenerations: Infinity,
    mentorSessions: Infinity, // Mr. Mentor included
  }
};

export function featuresForTier(tier) {
  const key = (tier || 'free').toLowerCase();
  return ENTITLEMENTS[key] || ENTITLEMENTS.free;
}

/**
 * Resolve the effective tier for entitlement checks.
 * Beta users get Pro-level features automatically.
 * 
 * @param {string|null} subscriptionTier - Value from profiles.subscription_tier
 * @param {string|null} paidTier - Value from profiles.stripe_subscription_tier or plan_tier
 * @returns {string} The effective tier to use for entitlement lookups
 */
export function resolveEffectiveTier(subscriptionTier, paidTier) {
  // Beta users map to Pro-level features
  if (subscriptionTier?.toLowerCase() === 'beta') {
    return 'pro';
  }
  
  // Otherwise use their paid tier (or default to free)
  return (paidTier || 'free').toLowerCase();
}

const entitlementsApi = { ENTITLEMENTS, featuresForTier, resolveEffectiveTier };
export default entitlementsApi;
