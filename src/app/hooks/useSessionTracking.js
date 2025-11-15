'use client';
/**
 * useSessionTracking Hook
 * 
 * Manages session lifecycle and event tracking for lessons.
 * Automatically starts/ends sessions and provides methods for logging events.
 */

import { useEffect, useRef, useState } from 'react';
import {
  startLessonSession,
  endLessonSession,
  logRepeatEvent,
  addFacilitatorNote,
  addTranscriptLine,
} from '@/app/lib/sessionTracking';

/**
 * @param {string} learnerId - Learner ID
 * @param {string} lessonId - Lesson key
 * @param {boolean} autoStart - Whether to auto-start session on mount
 */
export function useSessionTracking(learnerId, lessonId, autoStart = true) {
  const [sessionId, setSessionId] = useState(null);
  const [tracking, setTracking] = useState(false);
  const sessionIdRef = useRef(null);
  const sessionMetaRef = useRef({ learnerId, lessonId });

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

  // Auto-start session on mount
  useEffect(() => {
    if (autoStart && learnerId && lessonId) {
      startSession();
    }

    // Auto-end session on unmount
    return () => {
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
  }, [autoStart, learnerId, lessonId]);

  return {
    sessionId,
    tracking,
    startSession,
    endSession,
    logRepeat,
    addNote,
    addTranscript,
  };
}
