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

function normalizeTierId(rawTier) {
  const tier = String(rawTier || 'free').trim().toLowerCase();
  if (!tier) return 'free';

  // Legacy paid tiers (pre-Standard/Pro)
  if (tier === 'premium' || tier === 'premium-plus') return 'pro';
  if (tier === 'plus') return 'standard';
  if (tier === 'basic') return 'standard';

  // Legacy/alternate labels
  if (tier === 'starter') return 'free';

  return tier;
}

export function featuresForTier(tier) {
  const key = normalizeTierId(tier);
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
  const normalizedSubscription = normalizeTierId(subscriptionTier || '');
  const normalizedPaid = normalizeTierId(paidTier || '');

  // Beta users map to Pro-level features
  if (normalizedSubscription === 'beta') {
    return 'pro';
  }

  // Pick the most-entitled tier across both columns.
  // Some legacy accounts store the paid tier in subscription_tier, others in plan_tier.
  const tierRank = { free: 0, trial: 1, standard: 2, pro: 3, lifetime: 4 };
  const paidRank = tierRank[normalizedPaid] ?? 0;
  const subscriptionRank = tierRank[normalizedSubscription] ?? 0;

  if (paidRank >= subscriptionRank) {
    return normalizedPaid || 'free';
  }

  return normalizedSubscription || 'free';
}

const entitlementsApi = { ENTITLEMENTS, featuresForTier, resolveEffectiveTier };
export default entitlementsApi;
