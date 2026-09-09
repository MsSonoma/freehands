/**
 * Session Tracking Utilities
 * 
 * Tracks lesson sessions, repeat events, and facilitator notes for Beta program analytics.
 */

import { getSupabaseClient, hasSupabaseEnv } from './supabaseClient.js';

const SESSION_EVENT_TYPES = {
  STARTED: 'started',
  COMPLETED: 'completed',
  RESTARTED: 'restarted',
  EXITED: 'exited',
  INCOMPLETE: 'incomplete',
};

const STALE_EXIT_MINUTES = 60;

/**
 * Check-only: returns conflict info if another browser owns any active
 * instructional execution for this learner. Same-browser lesson changes are
 * ordinary moves and do not require takeover authorization.
 * Does NOT create or modify any session rows.
 */
export async function checkLessonSessionConflict(learnerId, lessonId, browserSessionId) {
  if (!learnerId || !lessonId || !browserSessionId || !hasSupabaseEnv()) return null;
  const supabase = getSupabaseClient();
  const { data: activeRows, error } = await supabase
    .from('lesson_sessions')
    .select('id, session_id, device_name, last_activity_at, started_at, lesson_id, instructional_teacher')
    .eq('learner_id', learnerId)
    .is('ended_at', null)
    .order('last_activity_at', { ascending: false, nullsFirst: false })
    .order('started_at', { ascending: false });
  if (error) return { conflict: false };
  const foreignOwner = Array.isArray(activeRows)
    ? activeRows.find((row) => row?.session_id && row.session_id !== browserSessionId)
    : null;
  if (foreignOwner) {
    return { conflict: true, existingSession: foreignOwner };
  }
  return { conflict: false };
}
/**
 * Start a new lesson session
 * 
 * @param {string} learnerId - Learner ID
 * @param {string} lessonId - Lesson key (e.g., "4th-multiplying-with-zeros")
 * @param {string} browserSessionId - Browser-generated session UUID
 * @param {string} deviceName - Optional device name for display
 * @returns {Promise<{id: string}|{conflict: true, existingSession: object}>} Session result
 */
export async function startLessonSession(learnerId, lessonId, browserSessionId = null, deviceName = null, takeoverPin = null, expectedConflictingSessionId = null, occurrenceId = null, instructionalTeacher = null) {
  if (learnerId === 'demo') return null;
  if (!learnerId || !lessonId || !hasSupabaseEnv()) {
    throw new Error('Unable to start this lesson securely. Return to the Syllabus and try again.');
  }

  const supabase = getSupabaseClient();
  try {
    const { data: sessionResult } = await supabase.auth.getSession();
    const token = sessionResult?.session?.access_token;
    if (!token) throw new Error('Your session expired. Return to the Syllabus and sign in again.');
    const response = await fetch('/api/syllabus/execution/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        learnerId,
        lessonId,
        browserSessionId,
        deviceName,
        occurrenceId,
        instructionalTeacher,
        ...(takeoverPin ? { takeoverPin, expectedConflictingSessionId } : {}),
      }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(response.status === 403
        ? 'This lesson is no longer authorized. Return to the Syllabus and try again.'
        : 'Unable to start this lesson securely. Please try again.');
      error.code = payload?.code || 'SESSION_START_FAILED';
      throw error;
    }
    if (!payload?.id && !payload?.conflict) {
      throw new Error('Unable to confirm this lesson session. Please try again.');
    }
    return payload;
  } catch (err) {
    console.error('[SESSION] Start session error:', err);
    throw err;
  }
}

/**
 * End a lesson session
 * 
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} Success status
 */
export async function endLessonSession(sessionId, options = {}) {
  if (!sessionId || !hasSupabaseEnv()) return false;
  const reason = (options?.reason || SESSION_EVENT_TYPES.COMPLETED).toLowerCase();
  if (reason !== SESSION_EVENT_TYPES.COMPLETED) return false;
  const learnerId = String(options?.learnerId || '').trim();
  const lessonId = String(options?.lessonId || '').trim();
  const occurrenceId = String(options?.occurrenceId || '').trim();
  if (!learnerId || !lessonId || !occurrenceId) return false;

  try {
    const supabase = getSupabaseClient();
    const { data: sessionResult } = await supabase.auth.getSession();
    const token = sessionResult?.session?.access_token;
    if (!token) return false;
    const response = await fetch('/api/syllabus/execution/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        sessionId,
        learnerId,
        lessonId,
        occurrenceId,
        source: options?.metadata?.source,
        testPercentage: options?.metadata?.test_percentage,
      }),
    });
    const result = await response.json().catch(() => null);
    return Boolean(response.ok && result?.ok);
  } catch (err) {
    return false;
  }
}

export { SESSION_EVENT_TYPES, STALE_EXIT_MINUTES };

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
      return false;
    }

    return true;
  } catch (err) {
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
      return false;
    }

    return true;
  } catch (err) {
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
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Renew the exact browser-owned instructional execution lease.
 * The server returns an explicit terminal reason when ownership has ended.
 */
export async function heartbeatLessonSession(sessionId, learnerId, browserSessionId) {
  if (!sessionId || !learnerId || !browserSessionId || !hasSupabaseEnv()) {
    return { ok: false, active: false, session: null, endedReason: null };
  }
  try {
    const supabase = getSupabaseClient();
    const { data: sessionResult } = await supabase.auth.getSession();
    const token = sessionResult?.session?.access_token;
    if (!token) return { ok: false, active: false, session: null, endedReason: null };
    const response = await fetch('/api/syllabus/execution/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ sessionId, learnerId, browserSessionId }),
    });
    const payload = await response.json().catch(() => null);
    if (!payload || typeof payload !== 'object') {
      return { ok: false, active: false, session: null, endedReason: null };
    }
    return {
      ok: response.ok && payload.ok !== false,
      active: payload.active === true,
      session: payload.session || null,
      endedReason: payload.endedReason || payload.session?.ended_reason || null,
      state: payload.state || null,
    };
  } catch {
    return { ok: false, active: false, session: null, endedReason: null };
  }
}
/**
 * Check if a session is still active (not taken over by another device)
 * 
 * @param {string} sessionId - Session ID
 * @returns {Promise<{active: boolean, session: object|null}>}
 */
export async function checkSessionStatus(sessionId) {
  if (!sessionId || !hasSupabaseEnv()) {
    return { active: false, session: null };
  }

  const supabase = getSupabaseClient();

  try {
    const { data, error } = await supabase
      .from('lesson_sessions')
      .select('id, learner_id, lesson_id, session_id, device_name, started_at, last_activity_at, ended_at, ended_reason')
      .eq('id', sessionId)
      .maybeSingle();

    if (error || !data) {
      return { active: false, session: null };
    }

    // Session is active if ended_at is null
    const active = data.ended_at === null;

    return { active, session: data };
  } catch (err) {
    return { active: false, session: null };
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
      return [];
    }

    return data || [];
  } catch (err) {
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
      return null;
    }

    return data;
  } catch (err) {
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
      return [];
    }

    return data || [];
  } catch (err) {
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
      return null;
    }

    if (Array.isArray(data) && data.length > 0) {
      return data[0];
    }

    return null;
  } catch (err) {
    return null;
  }
}
