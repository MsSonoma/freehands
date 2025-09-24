// Plan entitlements mapping. Use plan_tier from profiles to gate features.
// Tiers: 'free' | 'basic' | 'plus' | 'premium'

export const ENTITLEMENTS = {
  free: {
    lessonsPerDay: 1,
    allLessons: false,
    learnersMax: 1,
    devices: 1,
    facilitatorTools: false,
  },
  basic: {
    lessonsPerDay: 5,
    allLessons: false,
    learnersMax: 1,
    devices: 1,
    facilitatorTools: false,
  },
  plus: {
    lessonsPerDay: 20,
    allLessons: true,
    learnersMax: 10,
    devices: 1,
    facilitatorTools: false,
  },
  premium: {
    lessonsPerDay: Infinity,
    allLessons: true,
    learnersMax: 10,
    devices: 2,
    facilitatorTools: true,
  },
};

export function featuresForTier(tier) {
  const key = (tier || 'free').toLowerCase();
  return ENTITLEMENTS[key] || ENTITLEMENTS.free;
}

const entitlementsApi = { ENTITLEMENTS, featuresForTier };
export default entitlementsApi;
