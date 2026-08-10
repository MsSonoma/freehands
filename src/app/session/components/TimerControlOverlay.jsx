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
 * @param {boolean} goldenKeysEnabled - Whether Golden Key logic/UI is enabled for this learner
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
  goldenKeysEntitled = true,
  goldenKeysEnabled = true,
  goldenKeyBonus = 0,
  isPaused = false,
  onUpdateTime,
  onTogglePause,
  hasGoldenKey = false,
  isGoldenKeySuspended = false,
  onApplyGoldenKey,
  onSuspendGoldenKey,
  onUnsuspendGoldenKey,
  onOpenLearnerSettings,
  // V2: authoritative remaining seconds fed directly from TimerService events.
  // When provided, sessionStorage polling is skipped entirely — TimerService
  // is the single owner of timer state and this overlay just reads what it emits.
  remainingSeconds: remainingSecondsProp = null,
}) {
  // Calculate effective total (add golden key bonus to play timers)
  const effectiveTotalMinutes = timerType === 'play' 
    ? totalMinutes + (goldenKeysEnabled ? (goldenKeyBonus || 0) : 0)
    : totalMinutes;
  
  const totalSeconds = effectiveTotalMinutes * 60;
  
  // Generate phase-specific storage key (matching SessionTimer) — only used in V1 fallback path
  const storageKey = lessonKey 
    ? `session_timer_state:${lessonKey}:${phase}:${timerType}` 
    : `session_timer_state:${phase}:${timerType}`;
  
  // Get current elapsed seconds from phase-specific storage (V1 / fallback path only)
  // This must match SessionTimer's calculation logic exactly
  const getCurrentElapsedSeconds = useCallback(() => {
    // V2 path: remainingSeconds is authoritative, derive elapsed from it
    if (remainingSecondsProp !== null) {
      return Math.max(0, totalSeconds - remainingSecondsProp);
    }
    // V1 fallback: read from sessionStorage
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
  }, [storageKey, isPaused, remainingSecondsProp, totalSeconds]);
  
  // V2 path: remaining is the prop itself (always current via TimerService events).
  // V1 path: derive remaining from internal elapsed state polled from sessionStorage.
  const [currentElapsedSeconds, setCurrentElapsedSeconds] = useState(getCurrentElapsedSeconds());
  const remainingSeconds = remainingSecondsProp !== null
    ? Math.max(0, remainingSecondsProp)
    : Math.max(0, totalSeconds - currentElapsedSeconds);
  
  const [adjustMinutes, setAdjustMinutes] = useState(0);
  const [saving, setSaving] = useState(false);

  // V1 only: update elapsed time every second by polling sessionStorage.
  // V2 skips this — remainingSeconds prop is already updated every second by TimerService.
  useEffect(() => {
    if (remainingSecondsProp !== null) return; // V2 path — no polling needed
    if (!isPaused) {
      const interval = setInterval(() => {
        setCurrentElapsedSeconds(getCurrentElapsedSeconds());
      }, 1000);
      return () => clearInterval(interval);
    } else {
      // Update once when paused to get accurate paused time
      setCurrentElapsedSeconds(getCurrentElapsedSeconds());
    }
  }, [isPaused, getCurrentElapsedSeconds, remainingSecondsProp]);

  // Reset adjustment only when the overlay is opened — NOT on every prop change.
  // Keeping remainingSecondsProp or getCurrentElapsedSeconds in this dep array caused
  // adjustMinutes to reset to 0 on every timer tick, making it impossible to apply an adjustment.
  useEffect(() => {
    if (isOpen) {
      setAdjustMinutes(0);
    }
  }, [isOpen]);

  // V1 only: sync elapsed time from sessionStorage when overlay opens.
  useEffect(() => {
    if (isOpen && remainingSecondsProp === null) {
      setCurrentElapsedSeconds(getCurrentElapsedSeconds());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // intentionally omit getCurrentElapsedSeconds — V1 polling handles ongoing updates

  if (!isOpen) return null;

  const handleApplyTimeAdjustment = async () => {
    if (adjustMinutes === 0) return;
    
    setSaving(true);
    try {
      const adjustSeconds = adjustMinutes * 60;
      const currentElapsed = getCurrentElapsedSeconds();
      // Allow newElapsed to go negative to represent time added beyond original duration
      const newElapsed = currentElapsed - adjustSeconds;

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
        // Must render above GamesOverlay (which uses zIndex: 20000)
        // Keep just under PlayTimeExpiredOverlay (which uses zIndex: 2147483647)
        zIndex: 2147483646,
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
          padding: '14px 18px',
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#111' }}>Timer Controls</h2>
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
          padding: '8px 12px',
          borderRadius: 8,
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8
        }}>
          <div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              <strong>{phase}</strong> · {timerType === 'play' ? '🎮 Play' : '📝 Work'}
              {goldenKeysEnabled && goldenKeyBonus > 0 && timerType === 'play' && (
                <span style={{ color: '#fbbf24', marginLeft: 6 }}>🔑 +{goldenKeyBonus}m</span>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 1 }}>
              {isPaused ? '⏸️ Paused' : '▶️ Running'}
            </div>
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#111', fontFamily: 'monospace', flexShrink: 0 }}>
            {formatTime(remainingSeconds)}
          </div>
        </div>

        {/* Time Adjustment */}
        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
            Adjust Time
          </label>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginBottom: 5 }}>
            <button
              onClick={() => setAdjustMinutes(prev => prev - 5)}
              disabled={saving}
              style={{
                padding: '5px 8px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600
              }}
            >-5</button>
            <button
              onClick={() => setAdjustMinutes(prev => prev - 1)}
              disabled={saving}
              style={{
                padding: '5px 8px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600
              }}
            >-1</button>
            <input
              type="number"
              value={adjustMinutes}
              onChange={(e) => setAdjustMinutes(parseInt(e.target.value) || 0)}
              disabled={saving}
              style={{
                flex: 1,
                padding: '5px 8px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                textAlign: 'center',
                fontFamily: 'monospace'
              }}
            />
            <button
              onClick={() => setAdjustMinutes(prev => prev + 1)}
              disabled={saving}
              style={{
                padding: '5px 8px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600
              }}
            >+1</button>
            <button
              onClick={() => setAdjustMinutes(prev => prev + 5)}
              disabled={saving}
              style={{
                padding: '5px 8px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                background: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600
              }}
            >+5</button>
          </div>
          {adjustMinutes !== 0 && (
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 5 }}>
              New remaining: <strong>{formatTime(previewRemaining)}</strong>
            </div>
          )}
          <button
            onClick={handleApplyTimeAdjustment}
            disabled={adjustMinutes === 0 || saving}
            style={{
              width: '100%',
              padding: '7px',
              border: 'none',
              borderRadius: 8,
              background: adjustMinutes === 0 || saving ? '#d1d5db' : '#c7442e',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: adjustMinutes === 0 || saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Applying...' : 'Apply Time Adjustment'}
          </button>
        </div>

        {/* Pause/Resume */}
        <div style={{ marginBottom: 10 }}>
          <button
            onClick={handleTogglePause}
            disabled={saving}
            style={{
              width: '100%',
              padding: '7px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              background: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              color: '#111'
            }}
          >
            {isPaused ? '▶️ Resume Timer' : '⏸️ Pause Timer'}
          </button>
        </div>

        {/* Golden Key Controls */}
        {goldenKeysEntitled ? (
          <div style={{
            borderTop: '1px solid #e5e7eb',
            paddingTop: 10
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#111' }}>🔑 Golden Key</h3>
              <span style={{ fontSize: 12, color: '#6b7280' }}>
                Status: <strong>{hasGoldenKey ? (isGoldenKeySuspended ? 'Active (Suspended)' : 'Active') : 'Not Applied'}</strong>
              </span>
            </div>

            {!goldenKeysEnabled && (
              <div style={{
                border: '1px solid #e5e7eb',
                background: '#f9fafb',
                color: '#6b7280',
                padding: '6px 10px',
                borderRadius: 8,
                fontSize: 12,
                marginBottom: 6
              }}>
                Golden Keys are turned off for this learner.
              </div>
            )}

            {!goldenKeysEnabled ? (
              <button
                disabled={true}
                style={{
                  width: '100%',
                  padding: '7px',
                  border: 'none',
                  borderRadius: 8,
                  background: '#d1d5db',
                  color: '#374151',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'not-allowed'
                }}
              >
                Apply Golden Key to This Lesson
              </button>
            ) : !hasGoldenKey ? (
              <button
                onClick={handleApplyGoldenKey}
                disabled={saving}
                style={{
                  width: '100%',
                  padding: '7px',
                  border: 'none',
                  borderRadius: 8,
                  background: saving ? '#d1d5db' : 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                  color: '#78350f',
                  fontSize: 14,
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
                  padding: '7px',
                  border: '1px solid #d1d5db',
                  borderRadius: 8,
                  background: '#fff',
                  color: '#111',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: saving ? 'not-allowed' : 'pointer'
                }}
              >
                {isGoldenKeySuspended ? 'Unsuspend Golden Key Effect' : 'Suspend Golden Key Effect'}
              </button>
            )}

            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 5 }}>
              {isGoldenKeySuspended
                ? 'Key is applied but suspended — bonus time is paused until unsuspended.'
                : hasGoldenKey
                  ? 'Golden key adds bonus time to play timers for this lesson.'
                  : 'Applying a golden key will add bonus time to play timers for this lesson.'}
            </div>
          </div>
        ) : (
          <div style={{
            borderTop: '1px solid #e5e7eb',
            paddingTop: 10
          }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 14, fontWeight: 600, color: '#111' }}>🔑 Golden Key</h3>
            <div style={{
              border: '1px solid #fcd34d',
              background: '#fef3c7',
              color: '#92400e',
              padding: '6px 10px',
              borderRadius: 8,
              fontSize: 12
            }}>
              Golden Keys are available on Standard and Pro plans.
            </div>
          </div>
        )}

        {/* Timers & Targets Settings Link */}
        {onOpenLearnerSettings && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button
              onClick={onOpenLearnerSettings}
              style={{
                background: 'none',
                border: 'none',
                color: '#6366f1',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0
              }}
            >
              ⚙️ Edit Timers &amp; Questions per Phase
            </button>
          </div>
        )}


      </div>
    </div>
  );
}
