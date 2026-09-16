'use client'

import { useEffect, useRef, useState } from 'react'
import GamesOverlay from '../components/games/GamesOverlay'
import { formatWebbElapsed } from './webbPacing.mjs'

export default function WebbPlayBreakOverlay({ playBreak, onComplete }) {
  const [nowMs, setNowMs] = useState(Date.now())
  const finishedRef = useRef(false)

  useEffect(() => {
    finishedRef.current = false
    setNowMs(Date.now())
    if (!playBreak) return undefined
    const timer = setInterval(() => setNowMs(Date.now()), 500)
    return () => clearInterval(timer)
  }, [playBreak?.id])

  const endMs = playBreak?.endsAt ? Date.parse(playBreak.endsAt) : NaN
  const remainingSeconds = Number.isFinite(endMs) ? Math.max(0, Math.ceil((endMs - nowMs) / 1000)) : 0

  const finish = (reason) => {
    if (finishedRef.current) return
    finishedRef.current = true
    onComplete?.(reason)
  }

  useEffect(() => {
    if (playBreak && remainingSeconds <= 0) finish('expired')
  }, [playBreak, remainingSeconds]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!playBreak) return null

  const playTimer = (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: 'rgba(15,23,42,0.88)', color: '#4ade80',
      borderRadius: 999, padding: '7px 11px', fontWeight: 850,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      boxShadow: '0 4px 18px rgba(0,0,0,0.22)',
    }} title="Mrs. Webb play time">
      <span aria-hidden>🎮</span>
      <span>{formatWebbElapsed(remainingSeconds)}</span>
      {Number(playBreak.goldenKeyBonusMin || 0) > 0 && (
        <span style={{ color: '#fbbf24', fontSize: 12 }} title={`Golden Key: +${playBreak.goldenKeyBonusMin} min`}>🔑</span>
      )}
    </div>
  )

  return <GamesOverlay onClose={() => finish('ended-early')} playTimer={playTimer} />
}