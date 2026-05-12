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
  checkSessionStatus,
} from '@/app/lib/sessionTracking';
import { getSupabaseClient } from '@/app/lib/supabaseClient';

/**
 * @param {string} learnerId - Learner ID
 * @param {string} lessonId - Lesson key
 * @param {boolean} autoStart - Whether to auto-start session on mount
 * @param {function} onSessionTakenOver - Callback when session is taken over by another device
 */
export function useSessionTracking(learnerId, lessonId, autoStart = true, onSessionTakenOver) {
  const [sessionId, setSessionId] = useState(null);
  const [tracking, setTracking] = useState(false);
  const [conflictingSession, setConflictingSession] = useState(null);
  const sessionIdRef = useRef(null);
  const sessionMetaRef = useRef({ learnerId, lessonId });
  const pollIntervalRef = useRef(null);
  const realtimeChannelRef = useRef(null);
  const isMountedRef = useRef(true);
  const takenOverRef = useRef(false); // guard: fire callback once per takeover

  const startSession = async (browserSessionId = null, deviceName = null) => {
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
        startLessonSession(learnerId, lessonId, browserSessionId, deviceName),
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
        sessionMetaRef.current = { learnerId, lessonId };
        console.log('[SESSION] sessionIdRef.current set to:', result.id);
        return result;
      }

      return null;
    } catch (err) {
      console.error('[SESSION] startSession failed:', err);
      return null;
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
    });
    
    if (success) {
      sessionIdRef.current = null;
      setSessionId(null);
      sessionMetaRef.current = { learnerId, lessonId };
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

  // Start takeover detection: Realtime subscription (instant) + polling fallback (15s)
  const startPolling = useCallback(() => {
    // --- Teardown any previous watchers ---
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
    takenOverRef.current = false;

    const handleTakenOver = (sessionRow) => {
      if (!isMountedRef.current || takenOverRef.current) return;
      takenOverRef.current = true;

      // Stop all watchers
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (realtimeChannelRef.current && supabase) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }

      sessionIdRef.current = null;
      setSessionId(null);
      setConflictingSession(sessionRow);

      if (typeof onSessionTakenOver === 'function') {
        onSessionTakenOver(sessionRow);
      }
    };

    // --- Realtime: primary (instant) ---
    if (supabase) {
      try {
        const channel = supabase
          .channel(`session-takeover:${currentSessionId}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'lesson_sessions',
              filter: `id=eq.${currentSessionId}`,
            },
            (payload) => {
              // ended_at being set means another device took over
              if (payload.new?.ended_at != null) {
                console.log('[SESSION TAKEOVER] Realtime: session ended by another device');
                handleTakenOver(payload.new);
              }
            }
          )
          .subscribe((status) => {
            console.log('[SESSION TAKEOVER] Realtime channel status:', status);
          });
        realtimeChannelRef.current = channel;
      } catch (err) {
        console.warn('[SESSION TAKEOVER] Realtime subscribe failed, falling back to poll only:', err);
      }
    }

    // --- Polling: fallback (15s) ---
    // Catches the case where the Realtime WS is dropped/unreliable.
    pollIntervalRef.current = setInterval(async () => {
      const sid = sessionIdRef.current;
      if (!sid || !isMountedRef.current || takenOverRef.current) return;
      try {
        const { active, session } = await checkSessionStatus(sid);
        if (!isMountedRef.current || takenOverRef.current) return;
        if (!active && session) {
          console.log('[SESSION TAKEOVER] Poll fallback: session closed by another device');
          handleTakenOver(session);
        }
      } catch (err) {
        console.error('[SESSION TAKEOVER] Poll fallback error:', err);
      }
    }, 15000);
  }, [onSessionTakenOver]);

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
    endSession,
    logRepeat,
    addNote,
    addTranscript,
    startPolling,
    stopPolling,
  };
}
