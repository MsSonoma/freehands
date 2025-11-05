/**
 * Beta Program Feature Flags
 * 
 * Controls tutorial gating, survey requirements, and Beta subscription tier enforcement.
 * Set these flags to false to disable Beta program features without data loss.
 */

export const BETA_CONFIG = {
  /**
   * FORCE_TUTORIALS_FOR_BETA
   * When true, users with subscription_tier='Beta' must complete tutorials before accessing features.
   * Non-Beta users are not blocked but can access tutorials optionally.
   */
  FORCE_TUTORIALS_FOR_BETA: true,

  /**
   * SURVEY_GOLDEN_KEY_ENABLED
   * When true, golden key remains locked until facilitator completes post-lesson survey
   * with password re-authentication.
   */
  SURVEY_GOLDEN_KEY_ENABLED: true,

  /**
   * TUTORIALS_AVAILABLE_FOR_ALL
   * When true, all users can access tutorial content via Help menu (non-blocking).
   * When false, tutorials are hidden entirely (not recommended during Beta).
   */
  TUTORIALS_AVAILABLE_FOR_ALL: true,
};

/**
 * Check if Beta program features are active
 */
export function isBetaProgramActive() {
  return BETA_CONFIG.FORCE_TUTORIALS_FOR_BETA || BETA_CONFIG.SURVEY_GOLDEN_KEY_ENABLED;
}

/**
 * Check if a user has Beta tier subscription
 * @param {string|null} subscriptionTier - Value from profiles.subscription_tier
 */
export function isBetaUser(subscriptionTier) {
  return subscriptionTier?.toLowerCase() === 'beta';
}

/**
 * Check if tutorials are required for a given user
 * @param {string|null} subscriptionTier - Value from profiles.subscription_tier
 */
export function areTutorialsRequired(subscriptionTier) {
  return BETA_CONFIG.FORCE_TUTORIALS_FOR_BETA && isBetaUser(subscriptionTier);
}

/**
 * Check if survey/golden key is enabled
 */
export function isSurveyRequired() {
  return BETA_CONFIG.SURVEY_GOLDEN_KEY_ENABLED;
}

/**
 * Check if tutorials should be shown in Help menu
 */
export function areTutorialsAvailable() {
  return BETA_CONFIG.TUTORIALS_AVAILABLE_FOR_ALL;
}
