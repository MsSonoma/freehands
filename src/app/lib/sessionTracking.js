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
      console.warn('[sessionTracking] Failed to log session event:', eventType, error);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('[sessionTracking] Exception logging session event:', err);
    return false;
  }
}

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
      .select('id, lesson_id, started_at')
      .eq('learner_id', learnerId)
      .is('ended_at', null);

    if (existingError) {
      console.warn('[sessionTracking] Failed to check existing sessions:', existingError);
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
          console.warn('[sessionTracking] Failed to close existing session before starting new one:', closeError);
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
      console.info('[sessionTracking] Closed', activeSessions.length, 'previous active session(s) for learner');
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

    await logLessonSessionEvent({
      supabase,
      sessionId: data.id,
      learnerId,
      lessonId,
      eventType: SESSION_EVENT_TYPES.STARTED,
      occurredAt: nowIso,
    });

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
      console.error('[sessionTracking] Error loading session for end:', fetchError);
      return false;
    }

    if (!sessionRow) {
      console.warn('[sessionTracking] No session found for end:', sessionId);
      return false;
    }

    if (!sessionRow.ended_at) {
      const { error: updateError } = await supabase
        .from('lesson_sessions')
        .update({ ended_at: nowIso })
        .eq('id', sessionId);

      if (updateError) {
        console.error('[sessionTracking] Error ending session:', updateError);
        return false;
      }
    } else if (!options?.force) {
      // Already ended. Avoid duplicate completed events unless forced.
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

    console.info('[sessionTracking] Session ended:', sessionId, 'reason:', eventType);
    return true;
  } catch (err) {
    console.error('[sessionTracking] Exception in endLessonSession:', err);
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
