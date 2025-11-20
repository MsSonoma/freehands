'use client';
/**
 * useSessionTracking Hook
 * 
 * Manages session lifecycle and event tracking for lessons.
 * Automatically starts/ends sessions and provides methods for logging events.
 * Polls for session takeover detection.
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
  const isMountedRef = useRef(true);

  const startSession = async () => {
    if (!learnerId || !lessonId) {
      return null;
    }

    if (sessionIdRef.current) {
      return sessionIdRef.current;
    }

    setTracking(true);
    const id = await startLessonSession(learnerId, lessonId);
    
    if (id) {
      sessionIdRef.current = id;
      setSessionId(id);
      sessionMetaRef.current = { learnerId, lessonId };
      setTracking(false);
      return id;
    } else {
      setTracking(false);
      return null;
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

  // Start polling for session takeover detection
  const startPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || !isMountedRef.current) return;

      try {
        const { active, session } = await checkSessionStatus(currentSessionId);

        if (!isMountedRef.current) return;

        // Session was taken over by another device
        if (!active && session) {
          // Stop polling
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }

          // Clear local session state
          sessionIdRef.current = null;
          setSessionId(null);
          setConflictingSession(session);

          // Notify parent component
          if (typeof onSessionTakenOver === 'function') {
            onSessionTakenOver(session);
          }
        }
      } catch (err) {
        // Silent error handling
      }
    }, 8000); // Poll every 8 seconds
  }, [onSessionTakenOver]);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
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

    // Auto-end session on unmount
    return () => {
      isMountedRef.current = false;
      stopPolling();
      if (sessionIdRef.current) {
        const meta = sessionMetaRef.current || { learnerId, lessonId };
        endLessonSession(sessionIdRef.current, {
          reason: 'exited',
          metadata: { trigger: 'unmount' },
          learnerId: meta.learnerId,
          lessonId: meta.lessonId,
        });
      }
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
