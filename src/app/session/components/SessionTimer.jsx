"use client";

import { useState, useEffect, useRef } from 'react';
import { TIMER_TYPE_EMOJI } from '../utils/phaseTimerDefaults';

/**
 * SessionTimer - Phase-aware countdown timer with play/work modes
 * 
 * @param {number} totalMinutes - Total time allocated (1-60 minutes)
 * @param {number} lessonProgress - Percentage of lesson work completed (0-100)
 * @param {boolean} isPaused - Whether the timer is paused
 * @param {function} onTimeUp - Callback when timer reaches zero
 * @param {string} lessonKey - Unique identifier for the lesson
 * @param {string} phase - Current phase (discussion/comprehension/exercise/worksheet/test)
 * @param {string} timerType - 'play' or 'work'
 * @param {number} goldenKeyBonus - Additional minutes from golden key (applied to play timers)
 * @param {function} onTimerClick - Callback when timer is clicked (for facilitator controls)
 * @param {function} onTimeRemaining - Callback with remaining minutes (for external display)
 */
export default function SessionTimer({ 
  totalMinutes = 5, 
  lessonProgress = 0, 
  isPaused = false,
  onTimeUp,
  lessonKey = null,
  phase = 'discussion',
  timerType = 'play',
  goldenKeyBonus = 0,
  onTimerClick,
  onTimeRemaining,
  className = ''
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [startTime, setStartTime] = useState(Date.now()); // Initialize immediately, not in useEffect
  const [pausedAt, setPausedAt] = useState(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const intervalRef = useRef(null);

  // Calculate effective total (add golden key bonus to play timers)
  // Also check for adjusted totalMinutes from timer adjustments
  const [adjustedTotalMinutes, setAdjustedTotalMinutes] = useState(null);
  
  const effectiveTotalMinutes = adjustedTotalMinutes !== null 
    ? adjustedTotalMinutes 
    : (timerType === 'play' ? totalMinutes + (goldenKeyBonus || 0) : totalMinutes);

  // Generate phase-specific storage key
  const storageKey = lessonKey 
    ? `session_timer_state:${lessonKey}:${phase}:${timerType}` 
    : `session_timer_state:${phase}:${timerType}`;

  // Initialize from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem(storageKey);
    if (stored) {
      try {
        const state = JSON.parse(stored);
        // Always restore stored state - don't validate totalMinutes to allow timer adjustments
        // The timer adjustment feature needs to be able to modify effective durations
        setElapsedSeconds(state.elapsedSeconds || 0);
        setStartTime(state.startTime || Date.now());
        setPausedAt(state.pausedAt || null);
        
        setHasInitialized(true);
      } catch {
        // Invalid stored data - reset
        setElapsedSeconds(0);
        setStartTime(Date.now());
        setPausedAt(null);
        setHasInitialized(true);
      }
    } else {
      setStartTime(Date.now());
      setHasInitialized(true);
    }
  }, [storageKey, phase, timerType]);

  // Persist state to sessionStorage (but only after initialization to avoid overwriting adjustments)
  useEffect(() => {
    if (startTime !== null && hasInitialized) {
      sessionStorage.setItem(storageKey, JSON.stringify({
        elapsedSeconds,
        startTime,
        pausedAt,
        totalMinutes: effectiveTotalMinutes // Store for validation
      }));
    }
  }, [elapsedSeconds, startTime, pausedAt, storageKey, effectiveTotalMinutes, hasInitialized]);

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
        
        // Debug logging for SessionTimer
        setElapsedSeconds(elapsed);
        
        const totalSeconds = effectiveTotalMinutes * 60;
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
  }, [isPaused, startTime, pausedAt, effectiveTotalMinutes, onTimeUp]);

  // Calculate remaining time
  const totalSeconds = effectiveTotalMinutes * 60;
  const remainingSeconds = totalSeconds - elapsedSeconds;
  
  // remainingSeconds can now exceed totalSeconds when elapsedSeconds is negative (time added)
  const minutes = Math.floor(Math.max(0, remainingSeconds) / 60);
  const seconds = Math.max(0, remainingSeconds) % 60;

  // Report remaining time to parent (for external displays like games overlay)
  useEffect(() => {
    if (onTimeRemaining) {
      onTimeRemaining(minutes);
    }
  }, [minutes, onTimeRemaining]);

  // Calculate progress ratios (only for work timers)
  const timeProgress = (elapsedSeconds / totalSeconds) * 100; // % of time elapsed
  const progressDiff = lessonProgress - timeProgress; // positive = ahead, negative = behind

  // Color logic:
  // PLAY timers: always green (expected to use full time for games)
  // WORK timers: green/yellow/red based on pace
  //   - Green: ahead of schedule or within 5% behind
  //   - Yellow: 5-15% behind
  //   - Red: more than 15% behind or at 00:00
  let color = '#22c55e'; // green by default
  
  if (timerType === 'work') {
    if (remainingSeconds === 0) {
      color = '#ef4444'; // red at timeout
    } else if (progressDiff < -5) {
      color = progressDiff < -15 ? '#ef4444' : '#eab308'; // red : yellow
    }
  }
  // Play timers stay green always

  const displayTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleTimerClick = () => {
    if (onTimerClick) {
      onTimerClick(elapsedSeconds);
    }
  };

  // Determine emoji based on timer type
  const timerEmoji = TIMER_TYPE_EMOJI[timerType] || '⏱️';

  // Build tooltip
  let tooltipText = onTimerClick ? 'Click to adjust timer (requires PIN)' : undefined;
  if (!tooltipText) {
    tooltipText = timerType === 'play' 
      ? 'Play time (for games before work)'
      : 'Work time (complete phase tasks)';
  }

  // Flash animation for play timer during last minute
  const shouldFlash = timerType === 'play' && remainingSeconds > 0 && remainingSeconds <= 60;

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
      cursor: onTimerClick ? 'pointer' : 'default',
      animation: shouldFlash ? 'timerFlash 1s ease-in-out infinite' : 'none'
    }}
    onClick={handleTimerClick}
    title={tooltipText}
    >
      <style>{`
        @keyframes timerFlash {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      <span title={timerType === 'play' ? 'Play' : 'Work'}>{timerEmoji}</span>
      <span>{displayTime}</span>
      {goldenKeyBonus > 0 && timerType === 'play' && (
        <span style={{
          fontSize: '0.75em',
          color: '#fbbf24',
          marginLeft: 4
        }} title={`+${goldenKeyBonus} min golden key bonus`}>
          🔑
        </span>
      )}
      <span style={{
        fontSize: '1rem',
        padding: '2px 6px',
        opacity: 0.8
      }}>
        {isPaused ? '▶️' : '⏸️'}
      </span>
    </div>
  );
}
