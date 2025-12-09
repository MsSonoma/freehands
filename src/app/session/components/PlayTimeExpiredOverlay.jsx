"use client";

import { useState, useEffect, useRef } from 'react';

/**
 * PlayTimeExpiredOverlay - 30-second countdown when play timer expires
 * 
 * Displays a friendly message telling the learner it's time to start working,
 * with reassurance that they can play again after the next phase.
 * Auto-advances to work phase when countdown completes.
 * 
 * @param {boolean} isOpen - Whether overlay is visible
 * @param {string} phase - Current phase name for display
 * @param {function} onComplete - Callback when countdown completes (advances to work)
 */
export default function PlayTimeExpiredOverlay({
  isOpen,
  phase = 'lesson',
  onComplete,
  onStartNow
}) {
  const [countdown, setCountdown] = useState(30);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setCountdown(30);
      
      intervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            // Delay the callback slightly to let the user see "0"
            setTimeout(() => {
              onComplete?.();
            }, 100);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      };
    }
  }, [isOpen, onComplete]);

  if (!isOpen) return null;

  const phaseDisplay = phase.charAt(0).toUpperCase() + phase.slice(1);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10005,
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
            onClick={onStartNow}
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
