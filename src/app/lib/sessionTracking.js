/**
 * Session Tracking Utilities
 * 
 * Tracks lesson sessions, repeat events, and facilitator notes for Beta program analytics.
 */

import { getSupabaseClient, hasSupabaseEnv } from './supabaseClient';

/**
 * Start a new lesson session
 * 
 * @param {string} learnerId - Learner ID
 * @param {string} lessonId - Lesson key (e.g., "4th-multiplying-with-zeros")
 * @returns {Promise<string|null>} Session ID or null on failure
 */
export async function startLessonSession(learnerId, lessonId) {
  if (!learnerId || !lessonId || !hasSupabaseEnv()) return null;

  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();

  try {
    // Ensure the learner has at most one active session at a time.
    const { data: existingSessions, error: existingError } = await supabase
      .from('lesson_sessions')
      .select('id, lesson_id')
      .eq('learner_id', learnerId)
      .is('ended_at', null);

    if (existingError) {
      console.warn('[sessionTracking] Failed to check existing sessions:', existingError);
    }

    const activeSessions = Array.isArray(existingSessions) ? existingSessions : [];

    if (activeSessions.length > 0) {
      const activeIds = activeSessions.map((session) => session.id);
      const { error: closeActiveError } = await supabase
        .from('lesson_sessions')
        .update({ ended_at: nowIso })
        .in('id', activeIds);

      if (closeActiveError) {
        console.warn('[sessionTracking] Failed to close existing sessions before starting new one:', closeActiveError);
      } else {
        console.info('[sessionTracking] Closed', activeIds.length, 'previous active session(s) for learner');
      }
    }

    const { data, error } = await supabase
      .from('lesson_sessions')
      .insert({
        learner_id: learnerId,
        lesson_id: lessonId,
        started_at: nowIso,
      })
      .select('id')
      .single();

    if (error) {
      console.error('[sessionTracking] Error starting session:', error);
      return null;
    }

    console.info('[sessionTracking] Session started:', data.id);
    return data.id;
  } catch (err) {
    console.error('[sessionTracking] Exception in startLessonSession:', err);
    return null;
  }
}

/**
 * End a lesson session
 * 
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} Success status
 */
export async function endLessonSession(sessionId) {
  if (!sessionId || !hasSupabaseEnv()) return false;

  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('lesson_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId);

    if (error) {
      console.error('[sessionTracking] Error ending session:', error);
      return false;
    }

    console.info('[sessionTracking] Session ended:', sessionId);
    return true;
  } catch (err) {
    console.error('[sessionTracking] Exception in endLessonSession:', err);
    return false;
  }
}

/**
 * Log a repeat button click event
 * 
 * @param {string} sessionId - Session ID
 * @param {string} sentenceId - Identifier for the sentence/segment repeated
 * @returns {Promise<boolean>} Success status
 */
export async function logRepeatEvent(sessionId, sentenceId) {
  if (!sessionId || !sentenceId || !hasSupabaseEnv()) return false;

  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('repeat_events')
      .insert({
        session_id: sessionId,
        sentence_id: sentenceId,
        ts: new Date().toISOString(),
      });

    if (error) {
      console.error('[sessionTracking] Error logging repeat event:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[sessionTracking] Exception in logRepeatEvent:', err);
    return false;
  }
}

/**
 * Add a facilitator note during the lesson
 * 
 * @param {string} sessionId - Session ID
 * @param {string} text - Note text
 * @returns {Promise<boolean>} Success status
 */
export async function addFacilitatorNote(sessionId, text) {
  if (!sessionId || !text || !hasSupabaseEnv()) return false;

  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('facilitator_notes')
      .insert({
        session_id: sessionId,
        text: text.trim(),
        ts: new Date().toISOString(),
      });

    if (error) {
      console.error('[sessionTracking] Error adding note:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[sessionTracking] Exception in addFacilitatorNote:', err);
    return false;
  }
}

/**
 * Add a transcript line during the lesson
 * 
 * @param {string} sessionId - Session ID
 * @param {string} speaker - Speaker identifier ('ms_sonoma' | 'learner' | 'system')
 * @param {string} text - Transcript text
 * @returns {Promise<boolean>} Success status
 */
export async function addTranscriptLine(sessionId, speaker, text) {
  if (!sessionId || !speaker || !text || !hasSupabaseEnv()) return false;

  const supabase = getSupabaseClient();

  try {
    const { error } = await supabase
      .from('lesson_transcripts')
      .insert({
        session_id: sessionId,
        speaker: speaker,
        text: text.trim(),
        ts: new Date().toISOString(),
      });

    if (error) {
      console.error('[sessionTracking] Error adding transcript line:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[sessionTracking] Exception in addTranscriptLine:', err);
    return false;
  }
}

/**
 * Get transcript for a session
 * 
 * @param {string} sessionId - Session ID
 * @returns {Promise<array>} Array of transcript lines
 */
export async function getSessionTranscript(sessionId) {
  if (!sessionId || !hasSupabaseEnv()) return [];

  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('lesson_transcripts')
      .select('*')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true });

    if (error) {
      console.error('[sessionTracking] Error fetching transcript:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[sessionTracking] Exception in getSessionTranscript:', err);
    return [];
  }
}

/**
 * Get session metrics (duration, repeat counts, notes)
 * 
 * @param {string} sessionId - Session ID
 * @returns {Promise<object|null>} Metrics object or null
 */
export async function getSessionMetrics(sessionId) {
  if (!sessionId || !hasSupabaseEnv()) return null;

  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('session_metrics')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle();

    if (error) {
      console.error('[sessionTracking] Error fetching metrics:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[sessionTracking] Exception in getSessionMetrics:', err);
    return null;
  }
}

/**
 * Get all sessions for a learner
 * 
 * @param {string} learnerId - Learner ID
 * @param {number} limit - Maximum number of sessions to return
 * @returns {Promise<array>} Array of session records
 */
export async function getLearnerSessions(learnerId, limit = 10) {
  if (!learnerId || !hasSupabaseEnv()) return [];

  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('lesson_sessions')
      .select('*')
      .eq('learner_id', learnerId)
      .order('started_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[sessionTracking] Error fetching sessions:', error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('[sessionTracking] Exception in getLearnerSessions:', err);
    return [];
  }
}

/**
 * Fetch the active (un-ended) session for a learner, if any.
 * Returns the most recent session with a null ended_at.
 *
 * @param {string} learnerId - Learner ID
 * @returns {Promise<object|null>} Active session record or null
 */
export async function getActiveLessonSession(learnerId) {
  if (!learnerId || !hasSupabaseEnv()) return null;

  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('lesson_sessions')
      .select('id, lesson_id, started_at')
      .eq('learner_id', learnerId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1);

    if (error) {
      console.warn('[sessionTracking] Error fetching active session:', error);
      return null;
    }

    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }

    return null;
  } catch (err) {
    console.warn('[sessionTracking] Exception in getActiveLessonSession:', err);
    return null;
  }
}
