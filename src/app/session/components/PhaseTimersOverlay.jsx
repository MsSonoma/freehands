"use client";

import { useState, useEffect } from 'react';
import { 
  PHASE_DISPLAY_NAMES, 
  TIMER_TYPE_EMOJI, 
  TIMER_TYPE_NAMES,
  getDefaultPhaseTimers
} from '../utils/phaseTimerDefaults';

/**
 * PhaseTimersOverlay - Compact overlay for configuring all 11 phase timers
 * 
 * Displays 5 phases (Discussion, Comprehension, Exercise, Worksheet, Test)
 * Each phase has Play🎉 and Work✏️ timers side-by-side
 * Plus one Golden Key⚡ bonus timer at the bottom
 * 
 * @param {boolean} isOpen - Whether overlay is visible
 * @param {function} onClose - Callback to close overlay
 * @param {object} initialTimers - Initial timer values (11 properties)
 * @param {function} onSave - Callback when Save button clicked (receives updated timers object)
 */
export default function PhaseTimersOverlay({
  isOpen,
  onClose,
  initialTimers,
  onSave
}) {
  const [timers, setTimers] = useState(getDefaultPhaseTimers());
  const [saving, setSaving] = useState(false);
  const [hoveredTooltip, setHoveredTooltip] = useState(null);
  const [clickedTooltip, setClickedTooltip] = useState(null);

  // Initialize timers from props
  useEffect(() => {
    if (isOpen && initialTimers) {
      setTimers({ ...getDefaultPhaseTimers(), ...initialTimers });
    }
  }, [isOpen, initialTimers]);

  if (!isOpen) return null;

  const phases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];

  const handleTimerChange = (phase, type, value) => {
    const key = `${phase}_${type}_min`;
    const numValue = Math.max(1, Math.min(60, parseInt(value) || 1)); // 1-60 min range
    setTimers(prev => ({ ...prev, [key]: numValue }));
  };

  const handleGoldenKeyChange = (value) => {
    const numValue = Math.max(1, Math.min(60, parseInt(value) || 1));
    setTimers(prev => ({ ...prev, golden_key_bonus_min: numValue }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave?.(timers);
      onClose?.();
    } catch (error) {
      // Error saving timers
    } finally {
      setSaving(false);
    }
  };

  const handleTooltipHover = (key, isEntering) => {
    if (!clickedTooltip) {
      setHoveredTooltip(isEntering ? key : null);
    }
  };

  const handleTooltipClick = (key) => {
    if (clickedTooltip === key) {
      setClickedTooltip(null);
      setHoveredTooltip(null);
    } else {
      setClickedTooltip(key);
      setHoveredTooltip(null);
    }
  };

  const showTooltip = (key) => hoveredTooltip === key || clickedTooltip === key;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10003,
        background: 'rgba(0, 0, 0, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setClickedTooltip(null);
          onClose?.();
        }
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          maxWidth: 560,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '2px solid #e5e7eb'
        }}>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111' }}>
            ⏱️ Phase Timers
          </h2>
          <button
            onClick={() => {
              setClickedTooltip(null);
              onClose?.();
            }}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 32,
              cursor: 'pointer',
              color: '#6b7280',
              lineHeight: 1,
              padding: 0
            }}
          >×</button>
        </div>

        {/* Info note */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          padding: 12,
          marginBottom: 20,
          fontSize: 13,
          color: '#1e40af',
          lineHeight: 1.5
        }}>
          <strong>How it works:</strong> Each phase has Play time (for games before work) and Work time (for actual lesson tasks). 
          Click phase names for details.
        </div>

        {/* Phase timers */}
        {phases.map((phase) => (
          <div key={phase} style={{ marginBottom: 20 }}>
            {/* Phase header with tooltip */}
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#374151',
                  cursor: 'help',
                  display: 'inline-block',
                  borderBottom: '1px dotted #9ca3af',
                  userSelect: 'none'
                }}
                onMouseEnter={() => handleTooltipHover(`phase-${phase}`, true)}
                onMouseLeave={() => handleTooltipHover(`phase-${phase}`, false)}
                onClick={() => handleTooltipClick(`phase-${phase}`)}
              >
                {PHASE_DISPLAY_NAMES[phase]}
              </div>

              {/* Tooltip */}
              {showTooltip(`phase-${phase}`) && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 6,
                  background: '#1f2937',
                  color: '#fff',
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: 12,
                  lineHeight: 1.4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  zIndex: 10,
                  maxWidth: 280,
                  whiteSpace: 'normal'
                }}>
                  <strong>Play:</strong> Time from "Begin {PHASE_DISPLAY_NAMES[phase]}" to "Go" button (games/exploration).
                  <br />
                  <strong>Work:</strong> Time from "Go" to next phase (actual lesson work).
                </div>
              )}
            </div>

            {/* Timer dials side-by-side */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr', 
              gap: 12 
            }}>
              {/* Play timer */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#059669',
                  marginBottom: 6,
                  cursor: 'help',
                  position: 'relative'
                }}
                  onMouseEnter={() => handleTooltipHover(`${phase}-play`, true)}
                  onMouseLeave={() => handleTooltipHover(`${phase}-play`, false)}
                  onClick={() => handleTooltipClick(`${phase}-play`)}
                >
                  {TIMER_TYPE_EMOJI.play} {TIMER_TYPE_NAMES.play}
                  
                  {/* Play tooltip */}
                  {showTooltip(`${phase}-play`) && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 4,
                      background: '#1f2937',
                      color: '#fff',
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      lineHeight: 1.3,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      zIndex: 10,
                      whiteSpace: 'nowrap'
                    }}>
                      Time for games before work starts
                    </div>
                  )}
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={timers[`${phase}_play_min`]}
                  onChange={(e) => handleTimerChange(phase, 'play', e.target.value)}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 18,
                    fontWeight: 700,
                    textAlign: 'center',
                    color: '#059669',
                    background: '#fff'
                  }}
                />
                <div style={{ 
                  fontSize: 11, 
                  color: '#6b7280', 
                  marginTop: 4, 
                  textAlign: 'center' 
                }}>
                  minutes
                </div>
              </div>

              {/* Work timer */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#2563eb',
                  marginBottom: 6,
                  cursor: 'help',
                  position: 'relative'
                }}
                  onMouseEnter={() => handleTooltipHover(`${phase}-work`, true)}
                  onMouseLeave={() => handleTooltipHover(`${phase}-work`, false)}
                  onClick={() => handleTooltipClick(`${phase}-work`)}
                >
                  {TIMER_TYPE_EMOJI.work} {TIMER_TYPE_NAMES.work}
                  
                  {/* Work tooltip */}
                  {showTooltip(`${phase}-work`) && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      marginTop: 4,
                      background: '#1f2937',
                      color: '#fff',
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: 11,
                      lineHeight: 1.3,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                      zIndex: 10,
                      whiteSpace: 'nowrap'
                    }}>
                      Actual lesson work time
                    </div>
                  )}
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={timers[`${phase}_work_min`]}
                  onChange={(e) => handleTimerChange(phase, 'work', e.target.value)}
                  disabled={saving}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '2px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 18,
                    fontWeight: 700,
                    textAlign: 'center',
                    color: '#2563eb',
                    background: '#fff'
                  }}
                />
                <div style={{ 
                  fontSize: 11, 
                  color: '#6b7280', 
                  marginTop: 4, 
                  textAlign: 'center' 
                }}>
                  minutes
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Golden Key Bonus */}
        <div style={{
          borderTop: '2px solid #e5e7eb',
          paddingTop: 20,
          marginTop: 4
        }}>
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#b45309',
                cursor: 'help',
                display: 'inline-block',
                borderBottom: '1px dotted #9ca3af',
                userSelect: 'none'
              }}
              onMouseEnter={() => handleTooltipHover('golden-key', true)}
              onMouseLeave={() => handleTooltipHover('golden-key', false)}
              onClick={() => handleTooltipClick('golden-key')}
            >
              ⚡ Golden Key Bonus
            </div>

            {/* Golden key tooltip */}
            {showTooltip('golden-key') && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 6,
                background: '#1f2937',
                color: '#fff',
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: 12,
                lineHeight: 1.4,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                zIndex: 10,
                maxWidth: 280,
                whiteSpace: 'normal'
              }}>
                Extra time added to <strong>all play timers</strong> when golden key is earned (completing 4/5 work phases) or applied by facilitator.
              </div>
            )}
          </div>

          <div style={{ maxWidth: 240 }}>
            <input
              type="number"
              min="1"
              max="60"
              value={timers.golden_key_bonus_min}
              onChange={(e) => handleGoldenKeyChange(e.target.value)}
              disabled={saving}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid #d1d5db',
                borderRadius: 8,
                fontSize: 18,
                fontWeight: 700,
                textAlign: 'center',
                color: '#b45309',
                background: '#fffbeb'
              }}
            />
            <div style={{ 
              fontSize: 11, 
              color: '#6b7280', 
              marginTop: 4, 
              textAlign: 'center' 
            }}>
              bonus minutes per phase
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginTop: 24,
          borderTop: '1px solid #e5e7eb',
          paddingTop: 20
        }}>
          <button
            onClick={() => {
              setClickedTooltip(null);
              onClose?.();
            }}
            disabled={saving}
            style={{
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              background: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              color: '#6b7280'
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '12px',
              border: 'none',
              borderRadius: 8,
              background: saving ? '#d1d5db' : '#c7442e',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 2px 8px rgba(199, 68, 46, 0.3)'
            }}
          >
            {saving ? 'Saving...' : 'Save Timers'}
          </button>
        </div>
      </div>
    </div>
  );
}
