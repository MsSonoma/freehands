/**
 * PlayTimeExpiredOverlay.jsx
 * 
 * Full-screen overlay displayed when play timer expires. Shows 30-second countdown
 * before transitioning to work mode. Matches V1's immersive overlay design.
 * 
 * The 30-second countdown is PERSISTENT:
 * - Stored with timestamp when started so it survives page refresh
 * - Continues ticking even when app is closed (timestamp math on reload)
 * - If expired while app was closed, immediately triggers onComplete
 * - Once expired, clears storage and moves to work mode
 * 
 * Props (V1-style parent-controlled):
 * - isOpen: boolean - Whether overlay is visible (parent controls this)
 * - phase: string - Current phase name for display
 * - lessonKey: string - Unique lesson identifier for storage key
 * - isPaused: boolean - Whether timer is paused (stops countdown)
 * - onComplete: function - Called when countdown reaches 0
 * - onStartNow: function - Called when user clicks "Start Now" button
 * 
 * Timer colors (V1 parity):
 * - Green (#22c55e): countdown > 5 seconds
 * - Amber (#fbbf24): countdown <= 5 seconds (warning)
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { playSfx } from '../utils/sfx';

const WARNING_DURATION = 30; // 30 seconds

export default function PlayTimeExpiredOverlay({
  isOpen,
  phase = 'lesson',
  lessonKey = 'default',
  isPaused = false,
  muted = false,
  onComplete,
  onStartNow
}) {
  const [countdown, setCountdown] = useState(WARNING_DURATION);
  const [pausedAt, setPausedAt] = useState(null);
  const intervalRef = useRef(null);
  const hasCalledCompleteRef = useRef(false);
  const hasPlayedAlarmRef = useRef(false);
  
  // Storage key for this phase's warning timer
  const storageKey = `play_expired_warning:${lessonKey}:${phase}`;
  
  // Clear the warning timer storage
  const clearWarningStorage = useCallback(() => {
    try {
      sessionStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);
  
  // Handle completion (only call once)
  const handleComplete = useCallback(() => {
    if (hasCalledCompleteRef.current) return;
    hasCalledCompleteRef.current = true;
    
    // Clear storage since we're done
    clearWarningStorage();
    
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    onComplete?.();
  }, [clearWarningStorage, onComplete]);
  
  // Handle "Start Now" button
  const handleStartNow = useCallback(() => {
    // Clear storage since user is manually starting
    clearWarningStorage();
    
    // Clear interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    onStartNow?.();
  }, [clearWarningStorage, onStartNow]);

  useEffect(() => {
    if (!isOpen) {
      // Reset the completion flag when closed
      hasCalledCompleteRef.current = false;
      hasPlayedAlarmRef.current = false;
      setPausedAt(null);
      return;
    }
    
    // If paused, stop the interval and store pause time
    // But first, update countdown to current value so display doesn't freeze
    if (isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (pausedAt === null) {
        // Get current timestamp from storage to calculate frozen countdown value
        let currentStartTimestamp = null;
        try {
          const stored = sessionStorage.getItem(storageKey);
          if (stored) {
            const data = JSON.parse(stored);
            currentStartTimestamp = data.startTimestamp;
          }
        } catch {}
        
        if (currentStartTimestamp) {
          const elapsedMs = Date.now() - currentStartTimestamp;
          const elapsedSeconds = Math.floor(elapsedMs / 1000);
          const remaining = Math.max(0, WARNING_DURATION - elapsedSeconds);
          setCountdown(remaining);
        }
        
        setPausedAt(Date.now());
      }
      return;
    }
    
    // Check for existing warning timer in storage
    let startTimestamp = null;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        startTimestamp = data.startTimestamp;
      }
    } catch {}
    
    // If resuming from pause, adjust startTimestamp
    if (pausedAt !== null) {
      const pauseDuration = Date.now() - pausedAt;
      startTimestamp = (startTimestamp || Date.now()) + pauseDuration;
      setPausedAt(null);
      
      // Update storage with adjusted timestamp
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({
          startTimestamp,
          phase
        }));
      } catch {}
    }
    
    // If no stored timestamp, this is a fresh start - save current time
    if (!startTimestamp) {
      startTimestamp = Date.now();
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({
          startTimestamp,
          phase
        }));
      } catch {}
    }
    
    // Calculate how much time has elapsed since the warning started
    const elapsedMs = Date.now() - startTimestamp;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const remaining = Math.max(0, WARNING_DURATION - elapsedSeconds);
    
    // If already expired, immediately complete
    if (remaining <= 0) {
      setCountdown(0);
      // Use setTimeout to avoid calling during render
      setTimeout(() => handleComplete(), 0);
      return;
    }
    
    // Set initial countdown from persisted state
    setCountdown(remaining);
    
    // Tick every second using timestamp math for accuracy
    intervalRef.current = setInterval(() => {
      const nowElapsed = Math.floor((Date.now() - startTimestamp) / 1000);
      const nowRemaining = Math.max(0, WARNING_DURATION - nowElapsed);
      
      setCountdown(nowRemaining);
      
      if (nowRemaining <= 0) {
        handleComplete();
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen, isPaused, pausedAt, storageKey, phase, handleComplete]);

  useEffect(() => {
    if (!isOpen) return;
    if (hasPlayedAlarmRef.current) return;
    hasPlayedAlarmRef.current = true;

    // Play alarm once when the overlay appears.
    // Use the exact filename casing present in public/sfx.
    playSfx('/sfx/Alarm.mp3', { volume: 0.6, muted });
  }, [isOpen, muted]);

  if (!isOpen) return null;

  const phaseDisplay = phase.charAt(0).toUpperCase() + phase.slice(1);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        // Must render above GamesOverlay (which uses zIndex: 20000)
        zIndex: 2147483647,
        background: 'rgba(17, 24, 39, 0.95)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        backdropFilter: 'blur(8px)'
      }}
    >
      <div style={{
        textAlign: 'center',
        maxWidth: 600
      }}>
        {/* Timer icon */}
        <div style={{
          fontSize: 'clamp(4rem, 10vw, 6rem)',
          marginBottom: 24
        }}>
          ⏰
        </div>

        {/* Main message */}
        <h2 style={{
          fontSize: 'clamp(1.75rem, 5vw, 2.5rem)',
          fontWeight: 800,
          color: '#fff',
          marginBottom: 16,
          lineHeight: 1.2,
          textShadow: '0 2px 8px rgba(0,0,0,0.4)'
        }}>
          Time to Get Back to Work!
        </h2>

        {/* Explanation */}
        <p style={{
          fontSize: 'clamp(1.1rem, 3vw, 1.4rem)',
          color: '#e5e7eb',
          marginBottom: 24,
          lineHeight: 1.5,
          textShadow: '0 1px 4px rgba(0,0,0,0.3)'
        }}>
          Your play time is up. Don't worry—you'll be able to play again as soon as you finish the {phaseDisplay} phase!
        </p>

        {/* Countdown display */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: '24px 40px',
          marginBottom: 24,
          backdropFilter: 'blur(4px)',
          border: '2px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{
            fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
            color: '#9ca3af',
            marginBottom: 8,
            fontWeight: 600,
            letterSpacing: 0.5
          }}>
            Starting work in
          </div>
          <div style={{
            fontSize: 'clamp(3rem, 8vw, 5rem)',
            fontWeight: 900,
            color: countdown <= 5 ? '#fbbf24' : '#22c55e',
            fontFamily: 'monospace',
            lineHeight: 1,
            textShadow: countdown <= 5 
              ? '0 0 20px rgba(251, 191, 36, 0.6)' 
              : '0 0 20px rgba(34, 197, 94, 0.5)',
            transition: 'color 0.3s, text-shadow 0.3s'
          }}>
            {countdown}
          </div>
          <div style={{
            fontSize: 'clamp(0.85rem, 1.8vw, 1rem)',
            color: '#9ca3af',
            marginTop: 8,
            fontWeight: 600
          }}>
            {countdown === 1 ? 'second' : 'seconds'}
          </div>
        </div>

        {/* Start Now button */}
        {onStartNow && (
          <button
            onClick={handleStartNow}
            style={{
              padding: '16px 32px',
              fontSize: 'clamp(1.1rem, 2.5vw, 1.3rem)',
              fontWeight: 700,
              background: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              cursor: 'pointer',
              marginBottom: 24,
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.4)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = '#16a34a';
              e.target.style.transform = 'translateY(-2px)';
              e.target.style.boxShadow = '0 6px 16px rgba(34, 197, 94, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = '#22c55e';
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.4)';
            }}
          >
            Start Now
          </button>
        )}

        {/* Encouragement */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
          color: '#fbbf24',
          fontWeight: 700,
          textShadow: '0 1px 4px rgba(0,0,0,0.3)'
        }}>
          <span style={{ fontSize: '1.5em' }}>✏️</span>
          <span>You've got this!</span>
          <span style={{ fontSize: '1.5em' }}>✏️</span>
        </div>
      </div>
    </div>
  );
}
