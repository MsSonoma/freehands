'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  startResponseInterval,
  pauseResponseInterval,
  resumeResponseInterval,
  responseIntervalElapsedSeconds,
} from '../utils/responseIntervalClock.mjs';

// This clock is intentionally presentation-only. Pacing and Golden Key eligibility
// remain based on the teacher's existing authoritative timing records.
export default function useResponseIntervalClock({ paused = false } = {}) {
  const intervalRef = useRef(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [active, setActive] = useState(false);

  const reset = useCallback(() => {
    const nowMs = Date.now();
    const next = startResponseInterval(nowMs);
    intervalRef.current = pausedRef.current ? pauseResponseInterval(next, nowMs) : next;
    setElapsedSeconds(0);
    setActive(true);
  }, []);

  const clear = useCallback(() => {
    intervalRef.current = null;
    setElapsedSeconds(0);
    setActive(false);
  }, []);

  useEffect(() => {
    const nowMs = Date.now();
    intervalRef.current = paused
      ? pauseResponseInterval(intervalRef.current, nowMs)
      : resumeResponseInterval(intervalRef.current, nowMs);
    setElapsedSeconds(responseIntervalElapsedSeconds(intervalRef.current, nowMs));
  }, [paused]);

  useEffect(() => {
    if (!active) return undefined;
    const update = () => setElapsedSeconds(responseIntervalElapsedSeconds(intervalRef.current, Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    const catchUp = () => { if (!document.hidden) update(); };
    document.addEventListener('visibilitychange', catchUp);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', catchUp);
    };
  }, [active]);

  return { elapsedSeconds, active, reset, clear };
}
