'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import CaptionPanel from '../components/CaptionPanel'

// ── Color tokens (teal − Mrs. Webb brand) ─────────────────────────────────────
const C = {
  accent:      '#0d9488',
  accentDark:  '#0f766e',
  accentLight: '#ccfbf1',
  border:      '#99f6e4',
  muted:       '#6b7280',
  text:        '#111827',
  danger:      '#ef4444',
  success:     '#10b981',
}

const WEBB_API = (path) => `/api/webb/${path}`

const PHASE = {
  LIST:        'list',
  STARTING:    'starting',
  PRESENTING:  'presenting',
  PROBING:     'probing',
  REMEDIATING: 'remediating',
  COMPLETE:    'complete',
}

async function webbPost(path, body) {
  const res = await fetch(WEBB_API(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

async function webbGet(path) {
  const res = await fetch(WEBB_API(path))
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data }
}

// ── Root page ─────────────────────────────────────────────────────────────────
export default function WebbPage() {
  const router = useRouter()

  // Phase state machine
  const [phase, setPhase]              = useState(PHASE.LIST)
  const [lessons, setLessons]          = useState([])
  const [fetchingLessons, setFetching] = useState(false)
  const [pageError, setPageError]      = useState('')

  // Active session
  const [sessionId, setSessionId]      = useState(null)
  const [lessonTitle, setLessonTitle]  = useState('')
  const [totalItems, setTotalItems]    = useState(0)
  const [itemIdx, setItemIdx]          = useState(0)
  const [currentItem, setCurrentItem]  = useState(null)
  const [probe, setProbe]              = useState('')

  // Remediation
  const [rewatchBlocked, setRewatchBlocked] = useState(false)
  const [rewatchItem, setRewatchItem]       = useState(null)
  const [remData, setRemData]               = useState(null)
  const [remChosen, setRemChosen]           = useState(null)
  const [reward, setReward]                 = useState(null)

  // CaptionPanel transcript
  const [transcript, setTranscript]    = useState([])   // [{text, role}]
  const [activeIndex, setActiveIndex]  = useState(-1)
  const transcriptRef                  = useRef(null)

  // Video / audio
  const videoRef       = useRef(null)
  const ttsQueueRef    = useRef([])
  const ttsBusyRef     = useRef(false)
  const ttsCurrentRef  = useRef(null)
  const [engineState, setEngineState]  = useState('idle') // 'idle' | 'playing'
  const [isMuted, setIsMuted]          = useState(false)
  const isMutedRef                     = useRef(false)

  // Layout measurement
  const videoColRef                          = useRef(null)
  const [isMobileLandscape, setIsLandscape]  = useState(false)
  const [videoMaxHeight, setVideoMaxHeight]  = useState(null)
  const [videoColPercent, setVideoColPct]    = useState(45)
  const [sideBySideHeight, setSBSH]          = useState(null)

  const learnerName = useRef('')

  // ── Init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    try { learnerName.current = localStorage.getItem('learner_name') || '' } catch {}
    loadLessons()
  }, [])

  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])

  // ── Orientation detection (matches SessionPageV2) ─────────────────────
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const land = w > h
      setIsLandscape(land)
      if (!land) { setVideoMaxHeight(null); setVideoColPct(45); return }
      let frac
      if (h <= 375)       frac = 0.40
      else if (h <= 600)  frac = 0.40 + ((h - 375) / 225) * 0.25
      else if (h <= 700)  frac = 0.65 + ((h - 600) / 100) * 0.05
      else if (h <= 1000) frac = 0.70 + ((h - 700) / 300) * 0.05
      else                frac = 0.75
      setVideoMaxHeight(Math.round(h * frac))
      const pct = h <= 500 ? 40 : h >= 700 ? 45 : 40 + ((h - 500) / 200) * 5
      setVideoColPct(Math.round(pct * 10) / 10)
    }
    calc()
    window.addEventListener('resize', calc)
    window.addEventListener('orientationchange', calc)
    let vv = null
    try { vv = window.visualViewport || null } catch {}
    if (vv) { try { vv.addEventListener('resize', calc) } catch {} }
    return () => {
      window.removeEventListener('resize', calc)
      window.removeEventListener('orientationchange', calc)
      if (vv) { try { vv.removeEventListener('resize', calc) } catch {} }
    }
  }, [])

  // Measure video column height for side-by-side height sync
  useEffect(() => {
    if (!isMobileLandscape) { setSBSH(null); return }
    const v = videoColRef.current
    if (!v) return
    const measure = () => {
      try {
        const h = v.getBoundingClientRect().height
        if (Number.isFinite(h) && h > 0) setSBSH(prev => prev !== Math.round(h) ? Math.round(h) : prev)
      } catch {}
    }
    measure()
    let ro
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measure)
      try { ro.observe(v) } catch {}
    } else {
      window.addEventListener('resize', measure)
    }
    return () => {
      try { ro?.disconnect() } catch {}
      window.removeEventListener('resize', measure)
    }
  }, [isMobileLandscape, videoMaxHeight])

  // ── TTS: sequential queue, drives teacher video play/pause ────────────
  async function drainTTSQueue() {
    if (ttsBusyRef.current) return
    const text = ttsQueueRef.current.shift()
    if (!text) return
    ttsBusyRef.current = true
    if (!isMutedRef.current) {
      try {
        const res = await fetch('/api/webb-tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        })
        const data = await res.json()
        const audioUrl = data.audio
        if (audioUrl && !isMutedRef.current) {
          await new Promise((resolve) => {
            const audio = new Audio(audioUrl)
            ttsCurrentRef.current = audio
            setEngineState('playing')
            try { videoRef.current?.play() } catch {}
            const done = () => {
              if (ttsCurrentRef.current === audio) ttsCurrentRef.current = null
              if (!ttsQueueRef.current.length) {
                setEngineState('idle')
                try { if (videoRef.current) videoRef.current.pause() } catch {}
              }
              resolve()
            }
            audio.onended = done
            audio.onerror = done
            audio.play().catch(done)
          })
        }
      } catch {
        setEngineState('idle')
        try { if (videoRef.current) videoRef.current.pause() } catch {}
      }
    }
    ttsBusyRef.current = false
    if (ttsQueueRef.current.length > 0) {
      drainTTSQueue()
    } else {
      setEngineState('idle')
      try { if (videoRef.current) videoRef.current.pause() } catch {}
    }
  }

  function speakText(text) {
    const t = String(text || '').trim()
    if (!t) return
    ttsQueueRef.current.push(t)
    drainTTSQueue()
  }

  function skipTTS() {
    ttsQueueRef.current = []
    if (ttsCurrentRef.current) {
      ttsCurrentRef.current.pause()
      ttsCurrentRef.current.onended = null
      ttsCurrentRef.current = null
    }
    ttsBusyRef.current = false
    setEngineState('idle')
    try { if (videoRef.current) videoRef.current.pause() } catch {}
  }

  function stopTTS() { skipTTS() }

  function toggleMute() {
    setIsMuted(prev => {
      const next = !prev
      isMutedRef.current = next
      if (next) skipTTS()
      return next
    })
  }

  // ── Transcript helpers ─────────────────────────────────────────────────
  function addMsg(text) {
    const t = String(text || '').trim()
    if (!t) return
    setTranscript(prev => {
      const next = [...prev, { text: t, role: 'assistant' }]
      setActiveIndex(next.length - 1)
      return next
    })
    speakText(t)
  }

  function addStudentLine(text) {
    const t = String(text || '').trim()
    if (!t) return
    setTranscript(prev => [...prev, { text: t, role: 'user' }])
  }

  // ── Lesson list ────────────────────────────────────────────────────────
  async function loadLessons() {
    setFetching(true)
    setPageError('')
    const { ok, data } = await webbGet('lesson/list')
    setFetching(false)
    if (!ok || !Array.isArray(data.lessons)) {
      setPageError("Couldn't reach Mrs. Webb's server. Make sure it's running on port 7720.")
      setLessons([])
      return
    }
    setLessons(data.lessons)
  }

  // ── Start lesson ───────────────────────────────────────────────────────
  async function startLesson(lessonId) {
    setPhase(PHASE.STARTING)
    setPageError('')
    const { ok, data } = await webbPost('lesson/start', { lesson_id: lessonId })
    if (!ok || !data.session_id) {
      setPhase(PHASE.LIST)
      setPageError(data.error || "Couldn't start the lesson. Please try again.")
      return
    }
    setSessionId(data.session_id)
    setLessonTitle(data.lesson_title || '')
    setTotalItems(data.total_items ?? 0)
    setItemIdx(1)
    setCurrentItem(data.current_item)
    setTranscript([])
    setActiveIndex(-1)
    setRemData(null)
    setRemChosen(null)
    setRewatchBlocked(false)
    setReward(null)
    if (data.intro) addMsg(data.intro)
    setPhase(PHASE.PRESENTING)
  }

  // ── Item done ──────────────────────────────────────────────────────────
  async function handleItemDone() {
    setPageError('')
    const { ok, data } = await webbPost('lesson/item-done', { session_id: sessionId })
    if (!ok || !data.probe) {
      setPageError(data.error || 'Something went wrong. Please try again.')
      return
    }
    setProbe(data.probe)
    addMsg(data.probe)
    setPhase(PHASE.PROBING)
  }

  // ── Probe result ───────────────────────────────────────────────────────
  function handleProbeResult(result) {
    if (result._safety_blocked) {
      addMsg(result.nudge || "Let's keep our chat on topic!")
      return
    }
    if (result.passed) {
      if (result.auto_passed) addMsg("That's okay — great effort! Let's keep going.")
      if (result.next_item) {
        setCurrentItem(result.next_item)
        setItemIdx(i => i + 1)
        addMsg("Great job! Let's look at the next part.")
        setPhase(PHASE.PRESENTING)
      } else {
        handleLessonComplete()
      }
    } else {
      if (result.nudge) addMsg(result.nudge)
      if (result.next_probe) { addMsg(result.next_probe); setProbe(result.next_probe) }
      if (result.needs_remediation) {
        setRewatchBlocked(false)
        setRewatchItem(currentItem)
        setRemData(null)
        setRemChosen(null)
        setPhase(PHASE.REMEDIATING)
      }
    }
  }

  // ── Lesson complete ────────────────────────────────────────────────────
  async function handleLessonComplete() {
    setPhase(PHASE.COMPLETE)
    addMsg("You did it! Fantastic work today! \uD83C\uDF89")
    const { ok, data } = await webbGet(
      `lesson/reward?session_id=${encodeURIComponent(sessionId)}`
    )
    if (ok && data.reward_available && data.reward) setReward(data.reward)
  }

  // ── Remediation done ───────────────────────────────────────────────────
  async function handleRemediationDone() {
    setPageError('')
    const { ok, data } = await webbPost('lesson/remediation-done', { session_id: sessionId })
    if (!ok || !data.probe) {
      setPageError(data.error || 'Something went wrong. Please try again.')
      return
    }
    setProbe(data.probe)
    addMsg(data.probe)
    setRemData(null)
    setRemChosen(null)
    setPhase(PHASE.PROBING)
  }

  // ── Close / exit ───────────────────────────────────────────────────────
  async function closeSession() {
    stopTTS()
    if (sessionId) await webbPost('lesson/close', { session_id: sessionId }).catch(() => {})
    setSessionId(null); setCurrentItem(null); setTranscript([]); setActiveIndex(-1)
    setReward(null); setRemData(null); setRemChosen(null); setProbe('')
    setLessonTitle(''); setItemIdx(0); setTotalItems(0)
    setPhase(PHASE.LIST)
    loadLessons()
  }

  async function handleExit() {
    const { ensurePinAllowed } = await import('@/app/lib/pinGate')
    if (!await ensurePinAllowed('session-exit')) return
    stopTTS()
    if (sessionId) await webbPost('lesson/close', { session_id: sessionId }).catch(() => {})
    router.push('/learn')
  }

  // ── Layout styles (mirrors SessionPageV2) ─────────────────────────────
  const videoEffH = videoMaxHeight && Number.isFinite(videoMaxHeight) ? videoMaxHeight : null
  const msSBSH    = videoEffH ? `${videoEffH}px` : (sideBySideHeight ? `${sideBySideHeight}px` : 'auto')

  const mainLayoutStyle = isMobileLandscape
    ? {
        display: 'flex', alignItems: 'stretch', flex: '1 1 0',
        overflow: 'hidden', background: '#fff',
        paddingLeft: 8, paddingRight: 8, boxSizing: 'border-box',
        '--msSideBySideH': msSBSH,
      }
    : {
        display: 'flex', flexDirection: 'column',
        flex: '1 1 0', overflow: 'hidden', background: '#fff',
      }

  const videoWrapperStyle = isMobileLandscape
    ? {
        flex: `0 0 ${videoColPercent}%`, position: 'relative',
        overflow: 'hidden', minWidth: 0,
        height: 'var(--msSideBySideH)', display: 'flex', flexDirection: 'column',
      }
    : { position: 'relative', width: '100%', flexShrink: 0 }

  const dynH = (isMobileLandscape && videoEffH)
    ? { height: videoEffH, maxHeight: videoEffH, minHeight: 0 }
    : {}

  const videoInnerStyle = isMobileLandscape
    ? {
        position: 'relative', overflow: 'hidden',
        aspectRatio: '16 / 7.2', minHeight: 200,
        width: '100%', background: '#000',
        borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
        ...dynH,
      }
    : {
        position: 'relative', overflow: 'hidden',
        height: '35vh', minHeight: 120,
        width: '92%', margin: '8px auto 0',
        borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)',
        background: '#000',
      }

  const transcriptWrapperStyle = isMobileLandscape
    ? {
        flex: `0 0 ${100 - videoColPercent}%`,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', minWidth: 0,
        height: 'var(--msSideBySideH)', maxHeight: 'var(--msSideBySideH)',
        paddingLeft: 8, boxSizing: 'border-box',
      }
    : {
        flex: '1 1 0', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', background: '#fff', marginTop: 8,
      }

  const showProgress = totalItems > 0 &&
    (phase === PHASE.PRESENTING || phase === PHASE.PROBING || phase === PHASE.REMEDIATING)
  const activeSession =
    phase === PHASE.PRESENTING || phase === PHASE.PROBING ||
    phase === PHASE.REMEDIATING || phase === PHASE.COMPLETE

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column',
      background: '#fff', fontFamily: 'system-ui, -apple-system, sans-serif',
      overflow: 'hidden',
    }}>

      {/* ── Header ── */}
      <div style={{
        background: C.accentDark, color: '#fff',
        flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '10px 16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }} aria-hidden>&#128105;&#8205;&#127979;</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>MRS. WEBB</div>
              {lessonTitle
                ? <div style={{ fontSize: 11, opacity: 0.85, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lessonTitle}</div>
                : <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: 1 }}>LESSON TEACHER</div>
              }
            </div>
          </div>
          <button
            type="button"
            onClick={handleExit}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.35)',
              color: '#fff', borderRadius: 8,
              padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            &larr; BACK
          </button>
        </div>

        {showProgress && (
          <div style={{ padding: '0 16px 10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, opacity: 0.8, marginBottom: 4 }}>
              <span>Part {itemIdx} of {totalItems}</span>
              <span>{Math.round((itemIdx / totalItems) * 100)}%</span>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 99, height: 5 }}>
              <div style={{
                background: '#fff', borderRadius: 99, height: 5,
                width: `${Math.round((itemIdx / totalItems) * 100)}%`,
                transition: 'width .4s ease',
              }} />
            </div>
          </div>
        )}
      </div>

      {/* ── Page error ── */}
      {pageError && (
        <div style={{
          background: '#fef2f2', borderBottom: '1px solid #fca5a5',
          color: C.danger, padding: '8px 16px',
          fontSize: 13, textAlign: 'center', flexShrink: 0,
        }}>
          {pageError}
        </div>
      )}

      {/* ── Main two-panel layout ── */}
      <div style={mainLayoutStyle}>

        {/* ── Video column ── */}
        <div ref={videoColRef} style={videoWrapperStyle}>
          <div style={videoInnerStyle}>

            {/* Teacher looping video */}
            <video
              ref={videoRef}
              src="/media/webb-teacher.mp4"
              muted
              loop
              playsInline
              preload="auto"
              style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'top center',
              }}
            />

            {/* Skip + Mute overlay (bottom right) */}
            <div style={{
              position: 'absolute', bottom: 16, right: 16,
              display: 'flex', gap: 12, zIndex: 10,
            }}>
              {engineState === 'playing' && (
                <button type="button" onClick={skipTTS} aria-label="Skip" title="Skip" style={overlayBtnStyle}>
                  <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="5 4 15 12 5 20 5 4" />
                    <line x1="19" y1="5" x2="19" y2="19" />
                  </svg>
                </button>
              )}
              <button type="button" onClick={toggleMute} aria-label={isMuted ? 'Unmute' : 'Mute'} title={isMuted ? 'Unmute' : 'Mute'} style={overlayBtnStyle}>
                {isMuted ? (
                  <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6" /><path d="M17 9l6 6" />
                  </svg>
                ) : (
                  <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 5L6 9H2v6h4l5 4V5z" />
                    <path d="M19 8a5 5 0 010 8" /><path d="M15 11a2 2 0 010 2" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Content viewer below video in landscape */}
          {phase === PHASE.PRESENTING && currentItem && isMobileLandscape && (
            <div style={{ flex: '1 1 0', overflowY: 'auto', paddingTop: 8 }}>
              <ContentViewer item={currentItem} compact />
            </div>
          )}
        </div>

        {/* ── Transcript column ── */}
        <div style={transcriptWrapperStyle}>

          {phase === PHASE.LIST && (
            <div style={{ flex: '1 1 0', overflowY: 'auto', padding: '12px 8px' }}>
              <LessonList
                lessons={lessons}
                loading={fetchingLessons}
                onStart={startLesson}
                onReload={loadLessons}
                learnerName={learnerName.current}
              />
            </div>
          )}

          {phase === PHASE.STARTING && (
            <div style={{ flex: '1 1 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ color: C.muted, fontSize: 14, textAlign: 'center' }}>Starting lesson&hellip;</div>
            </div>
          )}

          {activeSession && (
            <CaptionPanel
              sentences={transcript}
              activeIndex={activeIndex}
              boxRef={transcriptRef}
              fullHeight
            />
          )}

          {/* Content viewer in portrait (below CaptionPanel) */}
          {phase === PHASE.PRESENTING && currentItem && !isMobileLandscape && (
            <div style={{
              flexShrink: 0, maxHeight: '38vh', overflowY: 'auto',
              borderTop: `1px solid ${C.border}`,
            }}>
              <ContentViewer item={currentItem} />
            </div>
          )}

          {/* Remediation panel */}
          {phase === PHASE.REMEDIATING && (
            <div style={{
              flexShrink: 0, borderTop: `1px solid ${C.border}`,
              overflowY: 'auto', maxHeight: '42vh',
            }}>
              <RemediationPanel
                sessionId={sessionId}
                rewatchBlocked={rewatchBlocked}
                rewatchItem={rewatchItem}
                remData={remData}
                remChosen={remChosen}
                onSetRemData={setRemData}
                onSetRemChosen={setRemChosen}
                onRewatchBlocked={() => setRewatchBlocked(true)}
                onReadyToRetry={handleRemediationDone}
                addMsg={addMsg}
              />
            </div>
          )}

          {/* Complete panel */}
          {phase === PHASE.COMPLETE && (
            <div style={{ flexShrink: 0, padding: '8px 4px', borderTop: `1px solid ${C.border}` }}>
              {reward
                ? <RewardVideo reward={reward} onClose={closeSession} />
                : (
                  <div style={{ textAlign: 'center', padding: '12px 8px' }}>
                    <div style={{ fontSize: 36, marginBottom: 6 }}>&#127775;</div>
                    <p style={{ color: C.muted, fontSize: 14, margin: '0 0 12px' }}>Wonderful work today!</p>
                    <button type="button" onClick={closeSession} style={primaryBtn}>
                      &larr; Choose Another Lesson
                    </button>
                  </div>
                )
              }
            </div>
          )}
        </div>
      </div>

      {/* ── Footer: PRESENTING ── */}
      {phase === PHASE.PRESENTING && currentItem && (
        <div style={footerStyle}>
          <span style={{ fontSize: 13, color: C.muted, flex: 1, alignSelf: 'center' }}>
            {currentItem.content_type === 'video' ? '&#127916; Watch the video above' : '&#128218; Read through the content above'}
          </span>
          <button type="button" onClick={handleItemDone} style={{ ...primaryBtn, flexShrink: 0 }}>
            &#9989; I&apos;m done!
          </button>
        </div>
      )}

      {/* ── Footer: PROBING ── */}
      {phase === PHASE.PROBING && (
        <div style={footerStyle}>
          <StudentInput
            sessionId={sessionId}
            probe={probe}
            onResult={handleProbeResult}
            onStudentLine={addStudentLine}
          />
        </div>
      )}
    </div>
  )
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const overlayBtnStyle = {
  background: '#1f2937', color: '#fff', border: 'none',
  width: 'clamp(34px, 6.2vw, 52px)', height: 'clamp(34px, 6.2vw, 52px)',
  display: 'grid', placeItems: 'center',
  borderRadius: '50%', cursor: 'pointer',
  boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
}

const primaryBtn = {
  background: '#0d9488', color: '#fff', border: 'none',
  borderRadius: 8, padding: '10px 20px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
  fontFamily: 'inherit',
}

const footerStyle = {
  flexShrink: 0, background: '#fff',
  borderTop: '1px solid #e5e7eb',
  padding: '10px 16px',
  paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
  display: 'flex', alignItems: 'center', gap: 10,
}

// ── LessonList ────────────────────────────────────────────────────────────────
function LessonList({ lessons, loading, onStart, onReload, learnerName }) {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', color: '#0f766e', fontSize: 20 }}>
          {learnerName ? `Hi, ${learnerName}! &#128075;` : 'Welcome to Mrs. Webb!'}
        </h2>
        <p style={{ color: '#6b7280', margin: 0, fontSize: 14 }}>Pick a lesson to start learning.</p>
      </div>
      {loading && <div style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280', fontSize: 14 }}>Loading lessons&hellip;</div>}
      {!loading && lessons.length === 0 && (
        <div style={{ textAlign: 'center', padding: 32, color: '#6b7280' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>&#128218;</div>
          <p style={{ marginBottom: 16 }}>No lessons available yet.</p>
          <button type="button" onClick={onReload} style={{ ...primaryBtn, background: 'transparent', color: '#0d9488', border: '1.5px solid #0d9488' }}>Retry</button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lessons.map(lesson => (
          <div key={lesson.lesson_id} style={{ background: '#fff', border: '1.5px solid #99f6e4', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#111827', marginBottom: 2 }}>{lesson.title}</div>
              {lesson.description && <div style={{ fontSize: 13, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lesson.description}</div>}
              <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {lesson.subject && <Tag>{lesson.subject}</Tag>}
                {lesson.grade_range && <Tag>Grade {lesson.grade_range}</Tag>}
                {lesson.item_count != null && <Tag>{lesson.item_count} part{lesson.item_count !== 1 ? 's' : ''}</Tag>}
              </div>
            </div>
            <button type="button" onClick={() => onStart(lesson.lesson_id)} style={{ ...primaryBtn, flexShrink: 0 }}>Start &rarr;</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── ContentViewer ─────────────────────────────────────────────────────────────
function ContentViewer({ item, compact = false }) {
  if (!item) return null
  if (item.content_type === 'video') return <VideoContent item={item} compact={compact} />
  return <TextContent item={item} compact={compact} />
}

function VideoContent({ item, compact }) {
  return (
    <div style={{ padding: compact ? '6px 8px' : '8px 12px' }}>
      <div style={{ fontWeight: 700, fontSize: compact ? 12 : 14, color: '#0f766e', marginBottom: 4 }}>
        &#127916; {item.title}
      </div>
      {item.summary && !compact && (
        <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>{item.summary}</div>
      )}
      <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000', borderRadius: 8, overflow: 'hidden' }}>
        <iframe
          src={item.video_embed_url}
          title={item.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        />
      </div>
    </div>
  )
}

function TextContent({ item, compact }) {
  return (
    <div style={{ padding: compact ? '6px 8px' : '8px 12px' }}>
      <div style={{ fontWeight: 700, fontSize: compact ? 12 : 14, color: '#0f766e', marginBottom: 4 }}>
        &#128218; {item.title}
      </div>
      <div style={{ fontSize: compact ? 13 : 15, lineHeight: 1.65, color: '#111827', maxHeight: compact ? 110 : 260, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {item.content_text || item.summary || "Read through this section, then click I'm done! when ready."}
      </div>
    </div>
  )
}

// ── StudentInput ──────────────────────────────────────────────────────────────
function StudentInput({ sessionId, probe, onResult, onStudentLine }) {
  const [value, setValue]      = useState('')
  const [loading, setLoading]  = useState(false)
  const [error, setError]      = useState('')
  const ref                    = useRef(null)

  useEffect(() => { setValue(''); setError(''); ref.current?.focus() }, [probe])

  async function submit() {
    const text = value.trim()
    if (!text || loading) return
    onStudentLine(text)
    setLoading(true)
    setError('')
    const { ok, data } = await webbPost('lesson/respond', { session_id: sessionId, text })
    setLoading(false)
    if (!ok && !data._safety_blocked) {
      setError(data.error || 'Something went wrong. Try again.')
      return
    }
    setValue('')
    onResult(data)
  }

  return (
    <div style={{ display: 'flex', gap: 8, width: '100%', alignItems: 'flex-end', position: 'relative' }}>
      {error && (
        <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: 4, fontSize: 12, color: '#ef4444' }}>
          {error}
        </div>
      )}
      <textarea
        ref={ref}
        rows={2}
        value={value}
        disabled={loading}
        onChange={e => { setError(''); setValue(e.target.value.slice(0, 400)) }}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() } }}
        placeholder={loading ? 'Checking\u2026' : 'Type your answer here\u2026'}
        aria-label="Your answer"
        style={{
          flex: 1, border: `1.5px solid ${error ? '#ef4444' : '#99f6e4'}`,
          borderRadius: 10, padding: '8px 12px', fontSize: 15,
          resize: 'none', outline: 'none', fontFamily: 'inherit',
          background: loading ? '#f9fafb' : '#fff', color: '#111827',
          WebkitAppearance: 'none',
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={loading || !value.trim()}
        style={{
          ...primaryBtn,
          opacity: (loading || !value.trim()) ? 0.5 : 1,
          cursor: (loading || !value.trim()) ? 'not-allowed' : 'pointer',
          padding: '10px 16px', alignSelf: 'stretch',
          display: 'flex', alignItems: 'center',
        }}
      >
        {loading ? '\u2026' : '\u2192'}
      </button>
    </div>
  )
}

// ── RemediationPanel ──────────────────────────────────────────────────────────
function RemediationPanel({ sessionId, rewatchBlocked, rewatchItem, remData, remChosen, onSetRemData, onSetRemChosen, onRewatchBlocked, onReadyToRetry, addMsg }) {
  const [busy, setBusy]             = useState(false)
  const [rewatching, setRewatching] = useState(false)

  async function choose(option) {
    setBusy(true)
    onSetRemChosen(option)
    const { ok, data } = await webbPost('lesson/remediate', { session_id: sessionId, option })
    setBusy(false)
    if (!ok) { addMsg(data.error || 'Something went wrong.'); onSetRemChosen(null); return }
    onSetRemData(data)
    if (option === 'rewatch') {
      if (data.rewatch_blocked) {
        onRewatchBlocked()
        addMsg(data.message || "You've already watched this one. Let Mrs. Webb help you another way!")
        onSetRemChosen(null)
      } else if (data.rewatch) {
        addMsg(data.message || "Of course! Watch it again — take your time.")
        setRewatching(true)
      }
    } else if (option === 'explain') {
      addMsg(data.message || "Let me explain this in my own words\u2026")
      if (data.explanation) addMsg(data.explanation)
    } else if (option === 'read_aloud') {
      addMsg(data.message || "Let me read this to you!")
      if (data.read_text) addMsg(data.read_text)
    }
  }

  const showRetry = !busy && !rewatching &&
    (remChosen === 'explain' || remChosen === 'read_aloud' ||
      (remChosen === 'rewatch' && remData?.rewatch_blocked))

  return (
    <div style={{ padding: '10px 12px' }}>
      <div style={{ fontWeight: 700, color: '#0f766e', marginBottom: 10, fontSize: 13 }}>
        &#128161; Let&apos;s try a different approach:
      </div>
      {rewatching && rewatchItem && (
        <div style={{ marginBottom: 10 }}>
          <VideoContent item={rewatchItem} />
          <button type="button" onClick={() => setRewatching(false)} style={{ ...primaryBtn, marginTop: 8, fontSize: 13, padding: '8px 14px' }}>
            Done watching
          </button>
        </div>
      )}
      {remChosen === 'read_aloud' && remData?.read_text && (
        <div style={{ background: '#ccfbf1', border: '1px solid #99f6e4', borderRadius: 10, padding: '10px 12px', fontSize: 14, lineHeight: 1.65, color: '#111827', marginBottom: 10, maxHeight: 180, overflowY: 'auto' }}>
          {remData.read_text}
        </div>
      )}
      {!rewatching && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          <RemBtn emoji="&#127916;" label="Watch the video again" disabled={rewatchBlocked || busy} dimmed={rewatchBlocked} onClick={() => choose('rewatch')} />
          {rewatchBlocked && <div style={{ fontSize: 12, color: '#6b7280', marginLeft: 6 }}>Already watched &mdash; let Mrs. Webb help another way!</div>}
          <RemBtn emoji="&#128172;" label="Let Mrs. Webb explain" disabled={busy} onClick={() => choose('explain')} />
          <RemBtn emoji="&#128218;" label="Have Mrs. Webb read it aloud" disabled={busy} onClick={() => choose('read_aloud')} />
        </div>
      )}
      {showRetry && (
        <button type="button" onClick={onReadyToRetry} style={{ ...primaryBtn, width: '100%', textAlign: 'center' }}>
          OK, I&apos;m ready to try again! &rarr;
        </button>
      )}
    </div>
  )
}

function RemBtn({ emoji, label, disabled, dimmed, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 10,
        border: `1.5px solid ${dimmed ? '#d1d5db' : '#99f6e4'}`,
        background: dimmed ? '#f9fafb' : '#ccfbf1',
        color: dimmed ? '#6b7280' : '#0f766e',
        fontWeight: 600, fontSize: 14,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: (disabled && !dimmed) ? 0.6 : 1,
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: 18 }}>{emoji}</span>
      {label}
      {dimmed && <span style={{ fontSize: 11, marginLeft: 'auto', color: '#9ca3af' }}>(already watched)</span>}
    </button>
  )
}

// ── RewardVideo ───────────────────────────────────────────────────────────────
function RewardVideo({ reward, onClose }) {
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #10b981', boxShadow: '0 2px 12px rgba(16,185,129,0.15)' }}>
      <div style={{ background: '#ecfdf5', padding: '12px 14px', textAlign: 'center', borderBottom: '1px solid #a7f3d0' }}>
        <div style={{ fontSize: 32, marginBottom: 4 }}>&#127881;</div>
        <div style={{ fontWeight: 800, color: '#065f46', fontSize: 16 }}>{reward.title}</div>
        {reward.description && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{reward.description}</div>}
      </div>
      <div style={{ position: 'relative', paddingTop: '56.25%', background: '#000' }}>
        <iframe
          src={reward.url}
          title={reward.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
        />
      </div>
      <div style={{ padding: '12px 14px', textAlign: 'center' }}>
        <button type="button" onClick={onClose} style={primaryBtn}>All done! &larr; Choose Another Lesson</button>
      </div>
    </div>
  )
}

// ── Tag ────────────────────────────────────────────────────────────────────────
function Tag({ children }) {
  return (
    <span style={{ background: '#ccfbf1', color: '#0f766e', borderRadius: 99, padding: '2px 8px', fontSize: 11, fontWeight: 600, border: '1px solid #99f6e4' }}>
      {children}
    </span>
  )
}
