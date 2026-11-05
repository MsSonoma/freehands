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
      title={onClick ? "Open Mrs. Webb work timer controls." : countdown ? "Time remaining in this short response window. It resets for each exchange; it does not limit the entire research or writing phase." : "Time since the last teacher or learner response, including spoken sentences. Reminder and stall timing is calculated separately."}
      aria-label={onClick ? `${countdown ? 'Response window remaining' : 'Response time elapsed'}: ${clockText}. Open timer controls.` : `${countdown ? 'Response window remaining' : 'Response time elapsed'}: ${clockText}`}
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
