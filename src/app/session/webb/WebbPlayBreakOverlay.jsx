'use client'

import { useEffect, useRef, useState } from 'react'
import GamesOverlay from '../components/games/GamesOverlay'
import TimerControlOverlay from '../components/TimerControlOverlay'
import FullscreenPlayTimerOverlay from '../v2/FullscreenPlayTimerOverlay'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { formatWebbElapsed, webbPlayRemainingSeconds } from './webbPacing.mjs'

export default function WebbPlayBreakOverlay({
  playBreak,
  onComplete,
  lessonKey,
  gamesEnabled = true,
  goldenKeysEntitled = true,
  goldenKeysEnabled = true,
  hasGoldenKey = false,
  isGoldenKeySuspended = false,
  onUpdateElapsed,
  onTogglePause,
  onApplyGoldenKey,
  onSuspendGoldenKey,
  onUnsuspendGoldenKey,
  onPlayWithWebb,
  playActivity = '',
  playActivityBusy = false,
}) {
  const [nowMs, setNowMs] = useState(Date.now())
  const [showGames, setShowGames] = useState(false)
  const [showFullscreenTimer, setShowFullscreenTimer] = useState(false)
  const [showTimerControls, setShowTimerControls] = useState(false)
  const [showPlayWithWebbMenu, setShowPlayWithWebbMenu] = useState(false)
  const [notice, setNotice] = useState('')
  const finishedRef = useRef(false)

  useEffect(() => {
    finishedRef.current = false
    setNowMs(Date.now())
    setShowGames(false)
    setShowFullscreenTimer(false)
    setShowTimerControls(false)
    setShowPlayWithWebbMenu(false)
    setNotice('')
    if (!playBreak) return undefined
    const timer = setInterval(() => setNowMs(Date.now()), 500)
    return () => clearInterval(timer)
  }, [playBreak?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (showGames && showFullscreenTimer) setShowFullscreenTimer(false)
  }, [showGames, showFullscreenTimer])

  const remainingSeconds = webbPlayRemainingSeconds(playBreak, nowMs)

  const finish = (reason) => {
    if (finishedRef.current) return
    finishedRef.current = true
    onComplete?.(reason)
  }

  useEffect(() => {
    if (playBreak && !playBreak.isPaused && remainingSeconds <= 0) finish('expired')
  }, [playBreak, remainingSeconds]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!playBreak) return null

  const currentBonusMin = Math.max(0, Number(playBreak.goldenKeyBonusMin || 0))
  const durationSeconds = Math.max(0, Number(playBreak.durationSeconds || 0))
  const baseDurationSeconds = Math.max(0, durationSeconds - currentBonusMin * 60)
  const baseMinutes = baseDurationSeconds / 60

  const openTimerControls = async () => {
    let allowed = false
    try {
      allowed = await ensurePinAllowed('timer')
    } catch {}
    if (allowed) setShowTimerControls(true)
  }

  const playTimer = (
    <button
      type="button"
      onClick={openTimerControls}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        background: 'rgba(15,23,42,0.92)', color: '#4ade80',
        border: '1px solid rgba(255,255,255,0.16)',
        borderRadius: 999, padding: '8px 12px', fontWeight: 900,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        boxShadow: '0 4px 18px rgba(0,0,0,0.22)', cursor: 'pointer',
      }}
      title="Open facilitator timer controls"
      aria-label="Open facilitator timer controls"
    >
      <span aria-hidden>🎮</span>
      <span>{formatWebbElapsed(remainingSeconds)}</span>
      {playBreak.isPaused && <span style={{ color: '#fbbf24', fontSize: 11 }}>PAUSED</span>}
      {currentBonusMin > 0 && (
        <span style={{ color: '#fbbf24', fontSize: 12 }} title={'Golden Key: +' + currentBonusMin + ' min'}>🔑</span>
      )}
    </button>
  )

  const mainSurface = !showGames ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mrs. Webb play time"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'linear-gradient(160deg, #0f766e 0%, #134e4a 100%)',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ position: 'absolute', top: 18, left: 18 }}>
        {playTimer}
      </div>

      <div style={{ fontSize: 42, marginBottom: 8 }} aria-hidden>👩🏻‍🏫</div>
      <div style={{ fontSize: 'clamp(1.45rem, 4vw, 2.4rem)', fontWeight: 900, marginBottom: 6 }}>
        Play time with Mrs. Webb
      </div>
      <div style={{ maxWidth: 620, opacity: 0.88, fontSize: 15, marginBottom: 22 }}>
        Your lesson is paused while the play timer runs. Choose what you want to do, or press GO! to return to learning now.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 760 }}>
        {!showPlayWithWebbMenu ? (
          <>
        <button
          type="button"
          onClick={() => finish('go')}
          style={{
            padding: '11px 22px', fontSize: 17, background: '#c7442e', color: '#fff',
            border: 'none', borderRadius: 9, cursor: 'pointer', fontWeight: 900,
            boxShadow: '0 3px 12px rgba(0,0,0,0.22)',
          }}
        >
          GO!
        </button>

        <button
          type="button"
          onClick={() => setShowPlayWithWebbMenu(true)}
          disabled={playActivityBusy}
          style={{
            padding: '10px 18px', fontSize: 16,
            background: playActivityBusy ? '#4b5563' : '#111827',
            color: '#fff', border: 'none', borderRadius: 9,
            cursor: playActivityBusy ? 'wait' : 'pointer', fontWeight: 900,
          }}
        >
          {playActivityBusy ? 'Mrs. Webb is thinking…' : 'Play with Mrs. Webb'}
        </button>

        <button
          type="button"
          onClick={() => {
            if (!gamesEnabled) {
              setNotice('Games are unavailable on this plan.')
              return
            }
            setNotice('')
            setShowGames(true)
          }}
          style={{
            padding: '10px 18px', fontSize: 16,
            background: gamesEnabled ? '#0ea5e9' : '#6b7280',
            color: '#fff', border: 'none', borderRadius: 9,
            cursor: gamesEnabled ? 'pointer' : 'not-allowed', fontWeight: 800,
          }}
        >
          Games
        </button>

        <button
          type="button"
          onClick={() => setShowFullscreenTimer(true)}
          style={{
            padding: '10px 18px', fontSize: 16, background: '#10b981',
            color: '#fff', border: 'none', borderRadius: 9,
            cursor: 'pointer', fontWeight: 900,
          }}
        >
          Fullscreen Timer
        </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowPlayWithWebbMenu(false)}
              style={{
                padding: '10px 18px', fontSize: 16, background: '#374151',
                color: '#fff', border: 'none', borderRadius: 9,
                cursor: 'pointer', fontWeight: 900,
              }}
            >
              Back
            </button>
            {[
              ['Joke', '#111827'],
              ['Riddle', '#8b5cf6'],
              ['Poem', '#ec4899'],
              ['Story', '#f59e0b'],
              ['Fill-in-Fun', '#10b981'],
            ].map(([label, background]) => (
              <button
                key={label}
                type="button"
                disabled={playActivityBusy}
                onClick={() => onPlayWithWebb?.(label)}
                style={{
                  padding: '10px 18px', fontSize: 16, background,
                  color: '#fff', border: 'none', borderRadius: 9,
                  cursor: playActivityBusy ? 'wait' : 'pointer',
                  fontWeight: 800,
                  opacity: playActivityBusy ? 0.65 : 1,
                }}
              >
                {label}
              </button>
            ))}
          </>
        )}
      </div>

      {notice && (
        <div style={{ marginTop: 14, background: 'rgba(255,255,255,0.12)', borderRadius: 10, padding: '8px 12px', fontWeight: 700 }}>
          {notice}
        </div>
      )}

      {playActivity && (
        <div style={{
          marginTop: 20,
          width: 'min(680px, 92vw)',
          background: 'rgba(255,255,255,0.96)',
          color: '#134e4a',
          borderRadius: 14,
          padding: '14px 18px',
          fontSize: 16,
          lineHeight: 1.45,
          fontWeight: 650,
          boxShadow: '0 8px 26px rgba(0,0,0,0.2)',
        }}>
          {playActivity}
        </div>
      )}
    </div>
  ) : (
    <GamesOverlay onClose={() => setShowGames(false)} playTimer={playTimer} />
  )

  return (
    <>
      {mainSurface}

      <FullscreenPlayTimerOverlay
        isOpen={showFullscreenTimer}
        secondsRemaining={remainingSeconds}
        isPaused={!!playBreak.isPaused}
        onClose={() => setShowFullscreenTimer(false)}
      />

      <TimerControlOverlay
        isOpen={showTimerControls}
        onClose={() => setShowTimerControls(false)}
        lessonKey={lessonKey}
        phase="Mrs. Webb play"
        timerType="play"
        totalMinutes={baseMinutes}
        goldenKeysEntitled={goldenKeysEntitled}
        goldenKeysEnabled={goldenKeysEnabled}
        goldenKeyBonus={currentBonusMin}
        isPaused={!!playBreak.isPaused}
        remainingSeconds={remainingSeconds}
        onUpdateTime={onUpdateElapsed}
        onTogglePause={onTogglePause}
        hasGoldenKey={hasGoldenKey}
        isGoldenKeySuspended={isGoldenKeySuspended}
        onApplyGoldenKey={onApplyGoldenKey}
        onSuspendGoldenKey={onSuspendGoldenKey}
        onUnsuspendGoldenKey={onUnsuspendGoldenKey}
      />
    </>
  )
}
