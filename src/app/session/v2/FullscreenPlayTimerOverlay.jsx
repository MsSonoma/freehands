"use client";

import React, { useMemo } from 'react';

function formatSeconds(seconds) {
  const safe = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const mins = Math.floor(safe / 60);
  const secs = String(safe % 60).padStart(2, '0');
  return `${mins}:${secs}`;
}

export default function FullscreenPlayTimerOverlay({
  isOpen,
  secondsRemaining,
  isPaused = false,
  onClose,
}) {
  const display = useMemo(() => formatSeconds(secondsRemaining), [secondsRemaining]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1200,
        background: 'rgba(17, 24, 39, 0.92)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div style={{
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        fontWeight: 800,
        opacity: 0.9,
        marginBottom: 10,
      }}>
        Play Timer
      </div>

      <div
        style={{
          fontSize: 'clamp(4rem, 14vw, 10rem)',
          fontWeight: 900,
          lineHeight: 1,
          color: '#10b981',
          textShadow: '0 6px 24px rgba(0,0,0,0.45)',
          marginBottom: 14,
        }}
      >
        {display}
      </div>

      {isPaused && (
        <div style={{
          fontSize: '1rem',
          fontWeight: 800,
          color: '#fbbf24',
          marginBottom: 18,
        }}>
          Paused
        </div>
      )}

      <button
        type="button"
        onClick={onClose}
        style={{
          padding: '12px 18px',
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.22)',
          background: 'rgba(255,255,255,0.10)',
          color: '#ffffff',
          fontWeight: 900,
          cursor: 'pointer',
          minWidth: 180,
        }}
      >
        Close
      </button>
    </div>
  );
}
