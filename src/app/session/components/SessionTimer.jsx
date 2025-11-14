"use client";

import { useState, useEffect, useRef } from 'react';

/**
 * SessionTimer - Displays a countdown timer that changes color based on lesson progress
 * 
 * @param {number} totalMinutes - Total time allocated for the session (60-300 minutes)
 * @param {number} lessonProgress - Percentage of lesson completed (0-100)
 * @param {boolean} isPaused - Whether the timer is paused
 * @param {function} onTimeUp - Callback when timer reaches zero
 * @param {function} onPauseToggle - Callback to request pause/resume (PIN required only for pausing)
 * @param {string} lessonKey - Unique identifier for the lesson (e.g., 'math/lesson_name') for scoped timer storage
 * @param {function} onTimerClick - Callback when timer is clicked (for facilitator controls)
 */
export default function SessionTimer({ 
  totalMinutes = 60, 
  lessonProgress = 0, 
  isPaused = false,
  onTimeUp,
  onPauseToggle,
  lessonKey = null,
  onTimerClick,
  className = ''
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [pausedAt, setPausedAt] = useState(null);
  const intervalRef = useRef(null);

  // Generate lesson-specific storage key
  const storageKey = lessonKey ? `session_timer_state:${lessonKey}` : 'session_timer_state';

  // Initialize from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      try {
        const state = JSON.parse(stored);
        setElapsedSeconds(state.elapsedSeconds || 0);
        setStartTime(state.startTime || Date.now());
        setPausedAt(state.pausedAt || null);
      } catch {}
    } else {
      setStartTime(Date.now());
    }
  }, [storageKey]);

  // Persist state to sessionStorage
  useEffect(() => {
    if (startTime !== null) {
      sessionStorage.setItem(storageKey, JSON.stringify({
        elapsedSeconds,
        startTime,
        pausedAt
      }));
    }
  }, [elapsedSeconds, startTime, pausedAt, storageKey]);

  // Update elapsed time
  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setPausedAt(Date.now());
      return;
    }

    // Resume: adjust startTime to account for paused duration
    if (pausedAt !== null) {
      const pauseDuration = Date.now() - pausedAt;
      setStartTime(prev => prev + pauseDuration);
      setPausedAt(null);
    }

    intervalRef.current = setInterval(() => {
      if (startTime) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        setElapsedSeconds(elapsed);
        
        const totalSeconds = totalMinutes * 60;
        if (elapsed >= totalSeconds) {
          clearInterval(intervalRef.current);
          onTimeUp?.();
        }
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPaused, startTime, pausedAt, totalMinutes, onTimeUp]);

  // Calculate remaining time
  const totalSeconds = totalMinutes * 60;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;

  // Calculate progress ratios
  const timeProgress = (elapsedSeconds / totalSeconds) * 100; // % of time elapsed
  const progressDiff = lessonProgress - timeProgress; // positive = ahead, negative = behind

  // Color logic:
  // Green: ahead of schedule or within 5% behind
  // Yellow: 5-15% behind
  // Red: more than 15% behind
  let color = '#22c55e'; // green
  if (progressDiff < -5) {
    color = progressDiff < -15 ? '#ef4444' : '#eab308'; // red : yellow
  }

  const displayTime = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleTimerClick = () => {
    if (onTimerClick) {
      onTimerClick(elapsedSeconds);
    }
  };

  return (
    <div className={`session-timer ${className}`} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '6px 12px',
      background: 'rgba(0, 0, 0, 0.75)',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      fontFamily: 'monospace',
      fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
      fontWeight: 'bold',
      color: color,
      transition: 'color 0.3s ease',
      backdropFilter: 'blur(4px)',
      cursor: onTimerClick ? 'pointer' : 'default'
    }}
    onClick={handleTimerClick}
    title={onTimerClick ? 'Click to adjust timer (requires PIN)' : undefined}
    >
      <span>⏱️</span>
      <span>{displayTime}</span>
      {onPauseToggle && (
        <button
          onClick={onPauseToggle}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '2px 6px',
            opacity: 0.8,
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
          title={isPaused ? 'Resume' : 'Pause (requires PIN)'}
        >
          {isPaused ? '▶️' : '⏸️'}
        </button>
      )}
    </div>
  );
}
