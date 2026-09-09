'use client';
/**
 * useSessionTracking Hook
 * 
 * Manages session lifecycle and event tracking for lessons.
 * Automatically starts/ends sessions and provides methods for logging events.
 * Detects session takeover via Supabase Realtime (instant) with 15s polling fallback.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  startLessonSession,
  endLessonSession,
  logRepeatEvent,
  addFacilitatorNote,
  addTranscriptLine,
  heartbeatLessonSession,
} from '@/app/lib/sessionTracking';
import { getSupabaseClient } from '@/app/lib/supabaseClient';

/**
 * @param {string} learnerId - Learner ID
 * @param {string} lessonId - Lesson key
 * @param {boolean} autoStart - Whether to auto-start session on mount
 * @param {function} onSessionTakenOver - Callback when session is taken over by another device
 */
export function useSessionTracking(learnerId, lessonId, autoStart = true, onSessionTakenOver, onSessionEnded) {
  const [sessionId, setSessionId] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [conflictingSession, setConflictingSession] = useState(null);
  const sessionIdRef = useRef(null);
  const sessionMetaRef = useRef({ learnerId, lessonId, browserSessionId: null, occurrenceId: null, instructionalTeacher: null });
  const pollIntervalRef = useRef(null);
  const realtimeChannelRef = useRef(null);
  const isMountedRef = useRef(true);
  const terminalHandledRef = useRef(false); // guard: handle each ownership-ending transition once

  const startSession = async (browserSessionId = null, deviceName = null, takeoverPin = null, expectedConflictingSessionId = null, occurrenceId = null, instructionalTeacher = null) => {
    if (!learnerId || !lessonId) {
      return null;
    }

    if (sessionIdRef.current) {
      return { id: sessionIdRef.current };
    }

    const withTimeout = async (promise, ms, label) => {
      let timeoutId;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      });
      try {
        return await Promise.race([promise, timeout]);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    setTracking(true);
    try {
      const result = await withTimeout(
        startLessonSession(learnerId, lessonId, browserSessionId, deviceName, takeoverPin, expectedConflictingSessionId, occurrenceId, instructionalTeacher),
        10000,
        'startLessonSession'
      );
      
      // Check for conflict
      if (result?.conflict) {
        setConflictingSession(result.existingSession);
        return result; // Return conflict to caller
      }
      
      if (result?.id) {
        sessionIdRef.current = result.id;
        setSessionId(result.id);
        sessionMetaRef.current = { learnerId, lessonId, browserSessionId, occurrenceId, instructionalTeacher };
        console.log('[SESSION] sessionIdRef.current set to:', result.id);
        return result;
      }

      return null;
    } catch (err) {
      console.error('[SESSION] startSession failed:', err);
      throw err;
    } finally {
      setTracking(false);
    }
  };

  const endSession = async (reason = 'completed', metadata) => {
    if (!sessionIdRef.current) {
      return false;
    }

    const meta = sessionMetaRef.current || { learnerId, lessonId };
    const success = await endLessonSession(sessionIdRef.current, {
      reason,
      metadata,
      learnerId: meta.learnerId,
      lessonId: meta.lessonId,
      occurrenceId: meta.occurrenceId,
    });
    
    if (success) {
      sessionIdRef.current = null;
      setSessionId(null);
      sessionMetaRef.current = { learnerId, lessonId, browserSessionId: null, occurrenceId: null, instructionalTeacher: null };
    }

    return success;
  };

  const logRepeat = async (sentenceId) => {
    if (!sessionIdRef.current) {
      return false;
    }

    return await logRepeatEvent(sessionIdRef.current, sentenceId);
  };

  const addNote = async (text) => {
    if (!sessionIdRef.current) {
      return false;
    }

    return await addFacilitatorNote(sessionIdRef.current, text);
  };

  const addTranscript = async (speaker, text) => {
    if (!sessionIdRef.current) {
      return false;
    }

    return await addTranscriptLine(sessionIdRef.current, speaker, text);
  };

  // Watch exact execution ownership: Realtime is immediate; heartbeat is the 15s fallback and lease renewal.
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    const supabase = getSupabaseClient();
    if (realtimeChannelRef.current && supabase) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) return;
    terminalHandledRef.current = false;

    const stopWatchers = () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (realtimeChannelRef.current && supabase) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };

    const handleOwnershipEnded = (sessionRow, rawReason) => {
      if (!isMountedRef.current || terminalHandledRef.current) return;
      terminalHandledRef.current = true;
      stopWatchers();

      const reason = String(rawReason || sessionRow?.ended_reason || 'ended').trim().toLowerCase();
      sessionIdRef.current = null;
      setSessionId(null);

      if (reason === 'taken_over') {
        setConflictingSession(sessionRow || null);
        if (typeof onSessionTakenOver === 'function') onSessionTakenOver(sessionRow || null);
        return;
      }

      setConflictingSession(null);
      if (typeof onSessionEnded === 'function') onSessionEnded(sessionRow || null, reason);
    };

    if (supabase) {
      try {
        const channel = supabase
          .channel(`session-ownership:${currentSessionId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'lesson_sessions',
              filter: `id=eq.${currentSessionId}`,
            },
            (payload) => {
              if (payload.new?.ended_at != null) {
                handleOwnershipEnded(payload.new, payload.new?.ended_reason || 'ended');
              }
            }
          )
          .subscribe((status) => {
            console.log('[SESSION OWNERSHIP] Realtime channel status:', status);
          });
        realtimeChannelRef.current = channel;
      } catch (err) {
        console.warn('[SESSION OWNERSHIP] Realtime subscribe failed, heartbeat remains active:', err);
      }
    }

    const heartbeat = async () => {
      const sid = sessionIdRef.current;
      const meta = sessionMetaRef.current;
      if (!sid || !meta?.learnerId || !meta?.browserSessionId || !isMountedRef.current || terminalHandledRef.current) return;
      try {
        const result = await heartbeatLessonSession(sid, meta.learnerId, meta.browserSessionId);
        if (!isMountedRef.current || terminalHandledRef.current) return;
        if (result?.active === false && (result?.endedReason || result?.state === 'ownership_mismatch')) {
          handleOwnershipEnded(result.session, result.endedReason || result.state);
        }
      } catch (err) {
        console.error('[SESSION OWNERSHIP] Heartbeat error:', err);
      }
    };

    void heartbeat();
    pollIntervalRef.current = setInterval(heartbeat, 15000);
  }, [onSessionTakenOver, onSessionEnded]);
  // Adopt a protected session created by another canonical client path (Mrs. Webb).
  // This keeps ownership monitoring shared without duplicating the start transaction.
  const adoptSession = useCallback((adoptedSessionId, browserSessionId, meta = {}) => {
    if (!adoptedSessionId || !browserSessionId) return null;
    sessionIdRef.current = adoptedSessionId;
    setSessionId(adoptedSessionId);
    terminalHandledRef.current = false;
    sessionMetaRef.current = {
      learnerId: meta.learnerId || learnerId,
      lessonId: meta.lessonId || lessonId,
      browserSessionId,
      occurrenceId: meta.occurrenceId || null,
      instructionalTeacher: meta.instructionalTeacher || null,
    };
    return adoptedSessionId;
  }, [learnerId, lessonId]);
  // Stop all takeover watchers
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    const supabase = getSupabaseClient();
    if (realtimeChannelRef.current && supabase) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  }, []);

  // Auto-start session on mount
  useEffect(() => {
    // Reset on every run — a prior deps-change cleanup may have set this to false
    // while the component is still mounted (e.g. learnerId/lessonId becoming non-null
    // after async load). If we don't reset it here, handleTakenOver will silently bail.
    isMountedRef.current = true;

    if (autoStart && learnerId && lessonId) {
      startSession().then((id) => {
        if (id && isMountedRef.current) {
          startPolling();
        }
      });
    }

    // Cleanup on unmount - stop polling but don't end session
    // Sessions should only end via explicit endSession() calls or browser close (beforeunload)
    return () => {
      isMountedRef.current = false;
      stopPolling();
      // Don't auto-end session on component unmount to avoid closing during React remounts
    };
  }, [autoStart, learnerId, lessonId, startPolling, stopPolling]);

  return {
    sessionId,
    tracking,
    conflictingSession,
    startSession,
    adoptSession,
    endSession,
    logRepeat,
    addNote,
    addTranscript,
    startPolling,
    stopPolling,
  };
}
