'use client'

import { formatWebbElapsed, responseTimerColor } from './webbPacing.mjs'

export default function WebbResponseTimer({ turn, elapsedSeconds = 0, pacingElapsedSeconds = elapsedSeconds, settings, compact = false, onClick = null, countdown = false, remainingSeconds = 0 }) {
  if (!turn || settings?.responsePacingEnabled === false) return null
  const color = countdown ? (remainingSeconds <= 0 ? '#ef4444' : '#f8fafc') : responseTimerColor(pacingElapsedSeconds, settings?.reminderIntervalMin)
  const clockText = formatWebbElapsed(countdown ? remainingSeconds : elapsedSeconds)
  return (
    <button
      type="button"
      onClick={onClick}
      title={onClick ? "Open Mrs. Webb work timer controls." : countdown ? "Research or writing work time remaining. Time never blocks lesson completion." : "Time since this prompt was presented, including teacher speech. Pacing reminders count only the time the learner can respond."}
      aria-label={onClick ? `${countdown ? 'Work time remaining' : 'Response time elapsed'}: ${clockText}. Open timer controls.` : `${countdown ? 'Work time remaining' : 'Response time elapsed'}: ${clockText}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: compact ? 4 : 6,
        padding: compact ? '3px 6px' : '5px 9px',
        borderRadius: 999,
        background: 'rgba(15,23,42,0.72)',
        border: '1px solid rgba(255,255,255,0.18)',
        color,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontWeight: 800,
        fontSize: compact ? 10 : 12,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        transition: 'color 240ms ease',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span aria-hidden>⏱</span>
      <span>{clockText}</span>
    </button>
  )
}
