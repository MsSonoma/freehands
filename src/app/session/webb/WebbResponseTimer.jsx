'use client'

import { formatWebbElapsed, responseTimerColor } from './webbPacing.mjs'

export default function WebbResponseTimer({ turn, elapsedSeconds = 0, settings, compact = false }) {
  if (!turn || settings?.responsePacingEnabled === false) return null
  const color = responseTimerColor(elapsedSeconds, settings?.reminderIntervalMin)
  return (
    <div
      title="Time since Mrs. Webb handed you the turn. This is a pacing guide, not a deadline."
      aria-label={`Your response time is ${formatWebbElapsed(elapsedSeconds)}`}
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
      }}
    >
      <span aria-hidden>⏱</span>
      <span>{formatWebbElapsed(elapsedSeconds)}</span>
    </div>
  )
}