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
    goldenKeyFeatures: true, // Poem/Story require golden key (any tier can use with key)
    lifetimeGenerations: 0,
    weeklyGenerations: 0,
    mentorSessions: 0,
  },
  basic: {
    lessonsPerDay: 5,
    allLessons: true,
    learnersMax: 1,
    devices: 1,
    facilitatorTools: false,
    askFeature: true, // Ask allowed on Basic+
    goldenKeyFeatures: true, // Can use golden keys
    lifetimeGenerations: 5, // 5 total, never refreshes
    weeklyGenerations: 0,
    mentorSessions: 0,
  },
  plus: {
    lessonsPerDay: Infinity,
    allLessons: true,
    learnersMax: 2,
    devices: 1,
    facilitatorTools: false,
    askFeature: true,
    goldenKeyFeatures: true,
    lifetimeGenerations: 5, // Shared with basic (no reset on upgrade)
    weeklyGenerations: 1, // 1 per week in addition to lifetime
    mentorSessions: 0,
  },
  premium: {
    lessonsPerDay: Infinity,
    allLessons: true,
    learnersMax: 10,
    devices: 2,
    facilitatorTools: true, // Unlimited tools except Mr. Mentor
    askFeature: true,
    goldenKeyFeatures: true,
    lifetimeGenerations: Infinity,
    weeklyGenerations: Infinity,
    mentorSessions: 5, // 5 included, then requires addon
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
    mentorSessions: 5, // Same as premium
  }
};

export function featuresForTier(tier) {
  const key = (tier || 'free').toLowerCase();
  return ENTITLEMENTS[key] || ENTITLEMENTS.free;
}

const entitlementsApi = { ENTITLEMENTS, featuresForTier };
export default entitlementsApi;
