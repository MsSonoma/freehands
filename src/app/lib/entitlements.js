// Plan entitlements mapping. Use plan_tier from profiles to gate features.
// Tiers: 'free' | 'basic' | 'plus' | 'premium'

export const ENTITLEMENTS = {
  free: {
    lessonsPerDay: 1,
    allLessons: true, // Can see all lessons, just limited per day
    learnersMax: 1,
    devices: 1,
    facilitatorTools: false,
    askFeature: false, // Ask question requires Basic+
    goldenKeyFeatures: false, // No golden keys on free tier
    lifetimeGenerations: 0,
    weeklyGenerations: 0,
    mentorSessions: 0,
  },
  basic: {
    lessonsPerDay: 2,
    allLessons: true,
    learnersMax: 1,
    devices: 1,
    facilitatorTools: false,
    askFeature: true, // Ask allowed on Basic+
    goldenKeyFeatures: true, // Can use golden keys
    lifetimeGenerations: 1, // 1 lifetime generation
    weeklyGenerations: 0,
    mentorSessions: 0,
  },
  plus: {
    lessonsPerDay: Infinity,
    allLessons: true,
    learnersMax: 2,
    devices: 1,
    facilitatorTools: true, // Calendar and other facilitator tools enabled
    askFeature: true,
    goldenKeyFeatures: true,
    lifetimeGenerations: 5, // 5 lifetime generations
    weeklyGenerations: 1, // 1 per week in addition to lifetime
    mentorSessions: 0,
  },
  premium: {
    lessonsPerDay: Infinity,
    allLessons: true,
    learnersMax: 10,
    devices: 2,
    facilitatorTools: true, // Unlimited tools including Mr. Mentor
    askFeature: true,
    goldenKeyFeatures: true,
    lifetimeGenerations: Infinity,
    weeklyGenerations: Infinity,
    mentorSessions: Infinity, // Mr. Mentor included in Premium
  },
  'premium-plus': {
    // Premium with Mr. Mentor addon ($20/month)
    lessonsPerDay: Infinity,
    allLessons: true,
    learnersMax: 10,
    devices: 2,
    facilitatorTools: true,
    askFeature: true,
    goldenKeyFeatures: true,
    lifetimeGenerations: Infinity,
    weeklyGenerations: Infinity,
    mentorSessions: Infinity, // Unlimited with addon
  },
  lifetime: {
    // Legacy lifetime tier
    lessonsPerDay: Infinity,
    allLessons: true,
    learnersMax: 10,
    devices: 2,
    facilitatorTools: true,
    askFeature: true,
    goldenKeyFeatures: true,
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
 * Beta users get Plus-level features automatically.
 * 
 * @param {string|null} subscriptionTier - Value from profiles.subscription_tier
 * @param {string|null} paidTier - Value from profiles.stripe_subscription_tier or plan_tier
 * @returns {string} The effective tier to use for entitlement lookups
 */
export function resolveEffectiveTier(subscriptionTier, paidTier) {
  // Beta users automatically get Plus-level features
  if (subscriptionTier?.toLowerCase() === 'beta') {
    return 'plus';
  }
  
  // Otherwise use their paid tier (or default to free)
  return (paidTier || 'free').toLowerCase();
}

const entitlementsApi = { ENTITLEMENTS, featuresForTier, resolveEffectiveTier };
export default entitlementsApi;
