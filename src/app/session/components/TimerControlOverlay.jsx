"use client";

import { useState, useEffect, useCallback } from 'react';

/**
 * TimerControlOverlay - Facilitator control panel for timer and golden key
 * PIN-protected overlay that allows facilitators to:
 * - Adjust remaining time
 * - Pause/resume timer
 * - Apply or suspend golden key for the current lesson
 * 
 * @param {boolean} isOpen - Whether the overlay is visible
 * @param {function} onClose - Callback to close the overlay
 * @param {string} lessonKey - Unique identifier for the lesson
 * @param {string} phase - Current phase name
 * @param {string} timerType - 'play' or 'work'
 * @param {number} totalMinutes - Total time allocated in minutes
 * @param {number} goldenKeyBonus - Additional minutes from golden key (for play timers)
 * @param {boolean} isPaused - Whether timer is currently paused
 * @param {function} onUpdateTime - Callback to update elapsed time (seconds)
 * @param {function} onTogglePause - Callback to pause/resume timer
 * @param {boolean} hasGoldenKey - Whether lesson has an active golden key
 * @param {boolean} isGoldenKeySuspended - Whether golden key effect is suspended
 * @param {function} onApplyGoldenKey - Callback to apply golden key to lesson
 * @param {function} onSuspendGoldenKey - Callback to suspend golden key effect
 * @param {function} onUnsuspendGoldenKey - Callback to restore golden key effect
 */
export default function TimerControlOverlay({
  isOpen,
  onClose,
  lessonKey,
  phase,
  timerType = 'play',
  totalMinutes = 5,
  goldenKeyBonus = 0,
  isPaused = false,
  onUpdateTime,
  onTogglePause,
  hasGoldenKey = false,
  isGoldenKeySuspended = false,
  onApplyGoldenKey,
  onSuspendGoldenKey,
  onUnsuspendGoldenKey
}) {
  // Calculate effective total (add golden key bonus to play timers)
  const effectiveTotalMinutes = timerType === 'play' 
    ? totalMinutes + (goldenKeyBonus || 0)
    : totalMinutes;
  
  const totalSeconds = effectiveTotalMinutes * 60;
  
  // Generate phase-specific storage key (matching SessionTimer)
  const storageKey = lessonKey 
    ? `session_timer_state:${lessonKey}:${phase}:${timerType}` 
    : `session_timer_state:${phase}:${timerType}`;
  
  // Get current elapsed seconds from phase-specific storage
  // This must match SessionTimer's calculation logic exactly
  const getCurrentElapsedSeconds = useCallback(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored) {
        const state = JSON.parse(stored);
        
        // If timer is paused, use stored elapsedSeconds
        if (isPaused && state.pausedAt) {
          return state.elapsedSeconds || 0;
        }
        
        // If timer is running, calculate from startTime (matches SessionTimer logic)
        if (state.startTime) {
          const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
          return elapsed;
        }
        
        // Fallback to stored elapsedSeconds
        return state.elapsedSeconds || 0;
      }
    } catch {}
    return 0;
  }, [storageKey, isPaused]);
  
  const [currentElapsedSeconds, setCurrentElapsedSeconds] = useState(getCurrentElapsedSeconds());
  const remainingSeconds = Math.max(0, totalSeconds - currentElapsedSeconds);
  
  const [adjustMinutes, setAdjustMinutes] = useState(0);
  const [saving, setSaving] = useState(false);

  // Update elapsed time every second when timer is running
  useEffect(() => {
    if (!isPaused) {
      const interval = setInterval(() => {
        setCurrentElapsedSeconds(getCurrentElapsedSeconds());
      }, 1000);
      return () => clearInterval(interval);
    } else {
      // Update once when paused to get accurate paused time
      setCurrentElapsedSeconds(getCurrentElapsedSeconds());
    }
  }, [isPaused, getCurrentElapsedSeconds]);

  // Reset adjustment when opening and update current time
  useEffect(() => {
    if (isOpen) {
      setAdjustMinutes(0);
      setCurrentElapsedSeconds(getCurrentElapsedSeconds());
    }
  }, [isOpen, getCurrentElapsedSeconds]);

  if (!isOpen) return null;

  const handleApplyTimeAdjustment = async () => {
    if (adjustMinutes === 0) return;
    
    setSaving(true);
    try {
      const adjustSeconds = adjustMinutes * 60;
      const currentElapsed = getCurrentElapsedSeconds();
      // Allow newElapsed to go negative to represent time added beyond original duration
      const newElapsed = currentElapsed - adjustSeconds;
      
      // Debug logging
      console.log('Timer Adjustment Debug:', {
        adjustMinutes,
        adjustSeconds,
        currentElapsed,
        newElapsed,
        effectiveTotalMinutes,
        totalSeconds
      });
      
      // Update the phase-specific timer state in sessionStorage
      try {
        const stored = sessionStorage.getItem(storageKey);
        if (stored) {
          const state = JSON.parse(stored);
          // Set startTime to achieve the desired elapsed time
          // newElapsed = (Date.now() - newStartTime) / 1000
          // newStartTime = Date.now() - (newElapsed * 1000)
          const newStartTime = Date.now() - (newElapsed * 1000);
          console.log('Setting sessionStorage:', {
            newStartTime,
            newElapsed,
            currentTime: Date.now(),
            storageKey
          });
          state.startTime = newStartTime;
          state.elapsedSeconds = newElapsed;
          state.totalMinutes = effectiveTotalMinutes; // Keep original total
          sessionStorage.setItem(storageKey, JSON.stringify(state));
        } else {
          // Create new timer state if none exists
          const newStartTime = Date.now() - (newElapsed * 1000);
          const newState = {
            startTime: newStartTime,
            elapsedSeconds: newElapsed,
            pausedAt: null,
            totalMinutes: effectiveTotalMinutes
          };
          sessionStorage.setItem(storageKey, JSON.stringify(newState));
        }
      } catch (error) {
        // Silent error handling
      }
      
      await onUpdateTime?.(newElapsed);
      setAdjustMinutes(0);
    } catch (error) {
      // Failed to adjust time
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePause = async () => {
    setSaving(true);
    try {
      await onTogglePause?.();
    } catch (error) {
      // Failed to toggle pause
    } finally {
      setSaving(false);
    }
  };

  const handleApplyGoldenKey = async () => {
    setSaving(true);
    try {
      await onApplyGoldenKey?.();
    } catch (error) {
      // Failed to apply golden key
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSuspendGoldenKey = async () => {
    setSaving(true);
    try {
      if (isGoldenKeySuspended) {
        await onUnsuspendGoldenKey?.();
      } else {
        await onSuspendGoldenKey?.();
      }
    } catch (error) {
      // Failed to toggle golden key suspension
    } finally {
      setSaving(false);
    }
  };

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Calculate preview remaining time - can exceed original duration when adding time
  const adjustSeconds = adjustMinutes * 60;
  const previewElapsed = Math.max(0, currentElapsedSeconds - adjustSeconds);
  
  // If adjustment pushes elapsed time below 0, we've added more time than originally elapsed
  // In that case, remaining time = original total + extra time added
  const extraTimeAdded = Math.max(0, adjustSeconds - currentElapsedSeconds);
  const previewRemaining = Math.max(0, totalSeconds - previewElapsed + extraTimeAdded);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10002,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111' }}>Timer Controls</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 28,
              cursor: 'pointer',
              color: '#6b7280',
              lineHeight: 1,
              padding: 0
            }}
          >×</button>
        </div>

        {/* Current Status */}
        <div style={{
          background: '#f9fafb',
          padding: 16,
          borderRadius: 8,
          marginBottom: 20
        }}>
          <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
            Current Phase: <strong>{phase}</strong> ({timerType === 'play' ? '🎮 Play Time' : '📝 Work Time'})
            {goldenKeyBonus > 0 && timerType === 'play' && (
              <span style={{ color: '#fbbf24', marginLeft: 8 }}>🔑 +{goldenKeyBonus} min bonus</span>
            )}
          </div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#111', fontFamily: 'monospace' }}>
            {formatTime(remainingSeconds)} <span style={{ fontSize: 14, fontWeight: 400 }}>remaining</span>
          </div>
          <div style={{ fontSize: 14, color: '#6b7280', marginTop: 4 }}>
            {isPaused ? '⏸️ Paused' : '▶️ Running'}
          </div>
        </div>

        {/* Time Adjustment */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Adjust Time
          </label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <button
              onClick={() => setAdjustMinutes(prev => prev - 5)}
              disabled={saving}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600
              }}
            >-5 min</button>
            <button
              onClick={() => setAdjustMinutes(prev => prev - 1)}
              disabled={saving}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600
              }}
            >-1 min</button>
            <input
              type="number"
              value={adjustMinutes}
              onChange={(e) => setAdjustMinutes(parseInt(e.target.value) || 0)}
              disabled={saving}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 16,
                fontWeight: 600,
                textAlign: 'center',
                fontFamily: 'monospace'
              }}
            />
            <button
              onClick={() => setAdjustMinutes(prev => prev + 1)}
              disabled={saving}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600
              }}
            >+1 min</button>
            <button
              onClick={() => setAdjustMinutes(prev => prev + 5)}
              disabled={saving}
              style={{
                padding: '8px 16px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 600
              }}
            >+5 min</button>
          </div>
          {adjustMinutes !== 0 && (
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
              New remaining: <strong>{formatTime(previewRemaining)}</strong>
            </div>
          )}
          <button
            onClick={handleApplyTimeAdjustment}
            disabled={adjustMinutes === 0 || saving}
            style={{
              width: '100%',
              padding: '10px',
              border: 'none',
              borderRadius: 8,
              background: adjustMinutes === 0 || saving ? '#d1d5db' : '#c7442e',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: adjustMinutes === 0 || saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Applying...' : 'Apply Time Adjustment'}
          </button>
        </div>

        {/* Pause/Resume */}
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={handleTogglePause}
            disabled={saving}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              background: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              color: '#111'
            }}
          >
            {isPaused ? '▶️ Resume Timer' : '⏸️ Pause Timer'}
          </button>
        </div>

        {/* Golden Key Controls */}
        <div style={{
          borderTop: '1px solid #e5e7eb',
          paddingTop: 20
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600, color: '#111' }}>🔑 Golden Key</h3>
          
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
              Status: <strong>{hasGoldenKey ? (isGoldenKeySuspended ? 'Active (Suspended)' : 'Active') : 'Not Applied'}</strong>
            </div>
          </div>

          {!hasGoldenKey ? (
            <button
              onClick={handleApplyGoldenKey}
              disabled={saving}
              style={{
                width: '100%',
                padding: '12px',
                border: 'none',
                borderRadius: 8,
                background: saving ? '#d1d5db' : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                color: '#78350f',
                fontSize: 16,
                fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(251, 191, 36, 0.3)'
              }}
            >
              Apply Golden Key to This Lesson
            </button>
          ) : (
            <button
              onClick={handleToggleSuspendGoldenKey}
              disabled={saving}
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                background: '#fff',
                color: '#111',
                fontSize: 16,
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {isGoldenKeySuspended ? 'Unsuspend Golden Key Effect' : 'Suspend Golden Key Effect'}
            </button>
          )}
          
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8, lineStyle: 1.4 }}>
            {isGoldenKeySuspended 
              ? 'Key is applied but suspended - bonus time is paused until unsuspended.'
              : hasGoldenKey 
                ? 'Golden key adds bonus time to play timers for this lesson.'
                : 'Applying a golden key will add bonus time to play timers for this lesson.'}
          </div>
        </div>

        {/* Close Button */}
        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 20, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              background: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              color: '#111'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
