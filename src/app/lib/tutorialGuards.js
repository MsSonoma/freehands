/**
 * Tutorial Gating Guards for Beta Program
 * 
 * Checks if users need to complete tutorials/videos before accessing features.
 * Returns actionable states for redirects and UI blocking.
 */

import { getSupabaseClient, hasSupabaseEnv } from './supabaseClient';
import { areTutorialsRequired, isSurveyRequired } from './betaConfig';

/**
 * Gate types returned by guard functions
 */
export const GATE_TYPE = {
  NONE: null,                          // No gate, access allowed
  SIGNUP_VIDEO: 'signup_video',        // Must watch facilitator signup video
  FACILITATOR_TUTORIAL: 'fac_tutorial', // Must complete facilitator tutorial
  LEARNER_TUTORIAL: 'learner_tutorial', // Must complete learner tutorial
  SURVEY_REQUIRED: 'survey_required',   // Must complete post-lesson survey
  AUTH_REQUIRED: 'auth_required',       // Must be logged in
};

/**
 * Check facilitator tutorial requirements
 * 
 * @param {string} userId - Auth user ID
 * @returns {Promise<{ gateType: string|null, redirectTo: string|null, profile: object|null }>}
 */
export async function checkFacilitatorTutorialGate(userId) {
  if (!userId || !hasSupabaseEnv()) {
    return { gateType: GATE_TYPE.AUTH_REQUIRED, redirectTo: '/auth/login', profile: null };
  }

  const supabase = getSupabaseClient();
  
  try {
    // Fetch profile with tutorial completion timestamps
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('subscription_tier, fac_signup_video_completed_at, fac_tutorial_completed_at')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[tutorialGuards] Error fetching profile:', error);
      return { gateType: GATE_TYPE.NONE, redirectTo: null, profile: null };
    }

    // Check if tutorials are required for this user
    if (!areTutorialsRequired(profile?.subscription_tier)) {
      return { gateType: GATE_TYPE.NONE, redirectTo: null, profile };
    }

    // Beta user: check signup video completion
    if (!profile?.fac_signup_video_completed_at) {
      return {
        gateType: GATE_TYPE.SIGNUP_VIDEO,
        redirectTo: '/facilitator/onboarding/video',
        profile,
      };
    }

    // Beta user: check facilitator tutorial completion
    if (!profile?.fac_tutorial_completed_at) {
      return {
        gateType: GATE_TYPE.FACILITATOR_TUTORIAL,
        redirectTo: '/facilitator/onboarding/tutorial',
        profile,
      };
    }

    // All gates passed
    return { gateType: GATE_TYPE.NONE, redirectTo: null, profile };
  } catch (err) {
    console.error('[tutorialGuards] Exception in checkFacilitatorTutorialGate:', err);
    return { gateType: GATE_TYPE.NONE, redirectTo: null, profile: null };
  }
}

/**
 * Check learner tutorial requirements
 * 
 * @param {string} userId - Auth user ID (facilitator)
 * @param {string} learnerId - Learner ID
 * @returns {Promise<{ gateType: string|null, redirectTo: string|null, completed: boolean }>}
 */
export async function checkLearnerTutorialGate(userId, learnerId) {
  if (!userId || !learnerId || !hasSupabaseEnv()) {
    return { gateType: GATE_TYPE.AUTH_REQUIRED, redirectTo: '/auth/login', completed: false };
  }

  const supabase = getSupabaseClient();

  try {
    // First check if facilitator is Beta and requires tutorials
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', userId)
      .maybeSingle();

    if (!areTutorialsRequired(profile?.subscription_tier)) {
      return { gateType: GATE_TYPE.NONE, redirectTo: null, completed: true };
    }

    // Beta user: check if learner has completed their tutorial
    const { data: progress, error } = await supabase
      .from('learner_tutorial_progress')
      .select('completed_at')
      .eq('learner_id', learnerId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
      console.error('[tutorialGuards] Error checking learner tutorial:', error);
      return { gateType: GATE_TYPE.NONE, redirectTo: null, completed: false };
    }

    if (!progress) {
      return {
        gateType: GATE_TYPE.LEARNER_TUTORIAL,
        redirectTo: `/session/tutorial?learner=${learnerId}`,
        completed: false,
      };
    }

    return { gateType: GATE_TYPE.NONE, redirectTo: null, completed: true };
  } catch (err) {
    console.error('[tutorialGuards] Exception in checkLearnerTutorialGate:', err);
    return { gateType: GATE_TYPE.NONE, redirectTo: null, completed: false };
  }
}

/**
 * Check if survey is required to unlock golden key
 * 
 * @param {string} sessionId - Lesson session ID
 * @returns {Promise<{ surveyRequired: boolean, surveyCompleted: boolean }>}
 */
export async function checkSurveyGate(sessionId) {
  if (!isSurveyRequired() || !sessionId || !hasSupabaseEnv()) {
    return { surveyRequired: false, surveyCompleted: false };
  }

  const supabase = getSupabaseClient();

  try {
    const { data: survey, error } = await supabase
      .from('post_lesson_surveys')
      .select('submitted_at')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      console.error('[tutorialGuards] Error checking survey:', error);
      return { surveyRequired: true, surveyCompleted: false };
    }

    return {
      surveyRequired: true,
      surveyCompleted: !!survey?.submitted_at,
    };
  } catch (err) {
    console.error('[tutorialGuards] Exception in checkSurveyGate:', err);
    return { surveyRequired: true, surveyCompleted: false };
  }
}

/**
 * Mark facilitator signup video as completed
 * 
 * @param {string} userId - Auth user ID
 * @returns {Promise<boolean>} Success status
 */
export async function markSignupVideoCompleted(userId) {
  if (!userId || !hasSupabaseEnv()) return false;

  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ fac_signup_video_completed_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('[tutorialGuards] Error marking video completed:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[tutorialGuards] Exception in markSignupVideoCompleted:', err);
    return false;
  }
}

/**
 * Mark facilitator tutorial as completed
 * 
 * @param {string} userId - Auth user ID
 * @returns {Promise<boolean>} Success status
 */
export async function markFacilitatorTutorialCompleted(userId) {
  if (!userId || !hasSupabaseEnv()) return false;

  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ fac_tutorial_completed_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('[tutorialGuards] Error marking tutorial completed:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[tutorialGuards] Exception in markFacilitatorTutorialCompleted:', err);
    return false;
  }
}

/**
 * Mark learner tutorial as completed
 * 
 * @param {string} learnerId - Learner ID
 * @returns {Promise<boolean>} Success status
 */
export async function markLearnerTutorialCompleted(learnerId) {
  if (!learnerId || !hasSupabaseEnv()) return false;

  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('learner_tutorial_progress')
      .insert({
        learner_id: learnerId,
        completed_at: new Date().toISOString(),
      });

    if (error) {
      console.error('[tutorialGuards] Error marking learner tutorial completed:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[tutorialGuards] Exception in markLearnerTutorialCompleted:', err);
    return false;
  }
}
