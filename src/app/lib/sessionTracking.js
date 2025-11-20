/**
 * Session Tracking Utilities
 * 
 * Tracks lesson sessions, repeat events, and facilitator notes for Beta program analytics.
 */

import { getSupabaseClient, hasSupabaseEnv } from './supabaseClient';

const SESSION_EVENT_TYPES = {
  STARTED: 'started',
  COMPLETED: 'completed',
  RESTARTED: 'restarted',
  EXITED: 'exited',
  INCOMPLETE: 'incomplete',
};

const STALE_EXIT_MINUTES = 60;

function minutesBetween(startIso, endIso) {
  if (!startIso || !endIso) return null;
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const diffMs = end.getTime() - start.getTime();
    return Math.max(0, Math.round(diffMs / 60000));
  } catch {
    return null;
  }
}

async function logLessonSessionEvent({
  supabase,
  sessionId,
  learnerId,
  lessonId,
  eventType,
  occurredAt,
  metadata,
}) {
  if (!sessionId || !learnerId || !lessonId || !eventType || !hasSupabaseEnv()) {
    return false;
  }

  const payload = {
    session_id: sessionId,
    learner_id: learnerId,
    lesson_id: lessonId,
    event_type: eventType,
    occurred_at: occurredAt || new Date().toISOString(),
  };

  if (metadata && typeof metadata === 'object' && Object.keys(metadata).length > 0) {
    payload.metadata = metadata;
  }

  try {
    const { error } = await supabase
      .from('lesson_session_events')
      .insert(payload);

    if (error) {
      return false;
    }

    return true;
  } catch (err) {
    return false;
  }
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
export async function startLessonSession(learnerId, lessonId, browserSessionId = null, deviceName = null) {
  if (!learnerId || !lessonId || !hasSupabaseEnv()) return null;

  const supabase = getSupabaseClient();
  const nowIso = new Date().toISOString();

  try {
    // Check for existing active session (conflict detection at Begin)
    const { data: existingActive, error: checkError } = await supabase
      .from('lesson_sessions')
      .select('id, session_id, device_name, last_activity_at, started_at')
      .eq('learner_id', learnerId)
      .eq('lesson_id', lessonId)
      .is('ended_at', null)
      .maybeSingle();

    if (checkError) {
      console.error('[SESSION] Conflict check error:', checkError);
    }

    // If active session exists with different session_id, return conflict
    if (existingActive && browserSessionId && existingActive.session_id !== browserSessionId) {
      console.log('[SESSION] Conflict detected - existing session:', existingActive.session_id, 'new:', browserSessionId);
      return {
        conflict: true,
        existingSession: existingActive
      };
    }

    // Close any existing active sessions for this learner+lesson (safety cleanup)
    const { data: existingSessions, error: existingError } = await supabase
      .from('lesson_sessions')
      .select('id, lesson_id, started_at')
      .eq('learner_id', learnerId)
      .is('ended_at', null);

    if (existingError) {
      // Silent fail on check
    }

    const activeSessions = Array.isArray(existingSessions) ? existingSessions : [];

    if (activeSessions.length > 0) {
      for (const session of activeSessions) {
        const { id: activeId, lesson_id: activeLessonId, started_at: activeStartedAt } = session;

        const { error: closeError } = await supabase
          .from('lesson_sessions')
          .update({ ended_at: nowIso })
          .eq('id', activeId);

        if (closeError) {
          continue;
        }

        const minutesActive = minutesBetween(activeStartedAt, nowIso);
        await logLessonSessionEvent({
          supabase,
          sessionId: activeId,
          learnerId,
          lessonId: activeLessonId,
          eventType: SESSION_EVENT_TYPES.RESTARTED,
          occurredAt: nowIso,
          metadata: {
            resumed_with_lesson_id: lessonId,
            minutes_active: minutesActive,
          },
        });
      }
    }

    // Create new session with ownership fields
    const insertPayload = {
      learner_id: learnerId,
      lesson_id: lessonId,
      started_at: nowIso,
      last_activity_at: nowIso,
    };

    if (browserSessionId) {
      insertPayload.session_id = browserSessionId;
    }

    if (deviceName) {
      insertPayload.device_name = deviceName;
    }

    const { data, error } = await supabase
      .from('lesson_sessions')
      .insert(insertPayload)
      .select('id')
      .single();

    if (error) {
      console.error('[SESSION] Insert error:', error);
      return null;
    }

    await logLessonSessionEvent({
      supabase,
      sessionId: data.id,
      learnerId,
      lessonId,
      eventType: SESSION_EVENT_TYPES.STARTED,
      occurredAt: nowIso,
    });

    return { id: data.id };
  } catch (err) {
    console.error('[SESSION] Start session error:', err);
    return null;
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

  const supabase = getSupabaseClient();
  const reason = (options?.reason || SESSION_EVENT_TYPES.COMPLETED).toLowerCase();
  const nowIso = new Date().toISOString();

  try {
    const { data: sessionRow, error: fetchError } = await supabase
      .from('lesson_sessions')
      .select('id, learner_id, lesson_id, started_at, ended_at')
      .eq('id', sessionId)
      .maybeSingle();

    if (fetchError) {
      return false;
    }

    if (!sessionRow) {
      return false;
    }

    if (!sessionRow.ended_at) {
      const { error: updateError } = await supabase
        .from('lesson_sessions')
        .update({ ended_at: nowIso })
        .eq('id', sessionId);

      if (updateError) {
        return false;
      }
    } else if (!options?.force) {
      if (reason === SESSION_EVENT_TYPES.COMPLETED) {
        const { data: existingEvent } = await supabase
          .from('lesson_session_events')
          .select('id')
          .eq('session_id', sessionId)
          .eq('event_type', SESSION_EVENT_TYPES.COMPLETED)
          .limit(1);

        if (Array.isArray(existingEvent) && existingEvent.length > 0) {
          return true;
        }
      }
    }

    const minutesActive = minutesBetween(sessionRow.started_at, nowIso);

    const eventType = (
      reason === SESSION_EVENT_TYPES.COMPLETED ? SESSION_EVENT_TYPES.COMPLETED :
      reason === SESSION_EVENT_TYPES.EXITED ? SESSION_EVENT_TYPES.EXITED :
      reason === SESSION_EVENT_TYPES.RESTARTED ? SESSION_EVENT_TYPES.RESTARTED :
      reason === SESSION_EVENT_TYPES.INCOMPLETE ? SESSION_EVENT_TYPES.INCOMPLETE :
      SESSION_EVENT_TYPES.COMPLETED
    );

    await logLessonSessionEvent({
      supabase,
      sessionId,
      learnerId: sessionRow.learner_id,
      lessonId: sessionRow.lesson_id,
      eventType,
      occurredAt: nowIso,
      metadata: {
        ...options?.metadata,
        minutes_active: minutesActive,
      },
    });

    return true;
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
      .select('id, learner_id, lesson_id, started_at, ended_at')
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
