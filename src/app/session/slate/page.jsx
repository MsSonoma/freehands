'use client'

/**
 * Mr. Slate -- Skills & Practice Coach
 *
 * A quiz-mode drill session. Questions are drawn from the same lesson JSON
 * as Ms. Sonoma (sample, truefalse, multiplechoice, fillintheblank pools).
 * The learner accumulates points (goal: 10) to earn the robot mastery icon.
 *
 * Rules:
 *   - Correct answer within time limit  -> +1 (min 0, max 10)
 *   - Wrong answer                      -> -1 (min 0)
 *   - Timeout (15s default)             -> +/-0
 *   - Reach 10 -> mastery confirmed
 *
 * Questions rotate through the full pool without repeats until ~80% have
 * been asked, then the deck reshuffles.
 *
 * Lessons are loaded from /api/learner/available-lessons (handles static,
 * generated, and Supabase-stored lessons uniformly). No URL params required.
 */

import { Suspense, useState, useEffect, useRef, useCallback, forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import { getMasteryForLearner, saveMastery } from '@/app/lib/masteryClient'

// --- Constants ---------------------------------------------------------------

const QUESTION_SECONDS = 15
const SCORE_GOAL = 10
const FEEDBACK_DELAY_MS = 2000
const RESHUFFLE_THRESHOLD = 0.2 // reshuffle when only 20% of deck remains

const DEFAULT_SLATE_SETTINGS = {
  scoreGoal: 10,
  correctPts: 1,
  wrongPts: 1,
  timeoutPts: 0,
  timeoutOffset: 0,
  questionSecs: 15,
}

const SETTINGS_CONFIG = [
  { label: 'SCORE GOAL',        key: 'scoreGoal',    min: 3,  max: 30,  fmt: v => `${v} pts` },
  { label: 'CORRECT ANSWER',    key: 'correctPts',   min: 1,  max: 5,   fmt: v => `+${v} pt${v !== 1 ? 's' : ''}` },
  { label: 'WRONG ANSWER',      key: 'wrongPts',     min: 0,  max: 5,   fmt: v => v === 0 ? '\u00b10' : `\u2212${v} pt${v !== 1 ? 's' : ''}` },
  { label: 'TIMEOUT PENALTY',   key: 'timeoutPts',     min: 0,  max: 5,   fmt: v => v === 0 ? '\u00b10' : `\u2212${v} pt${v !== 1 ? 's' : ''}` },
  { label: 'TIMEOUT OFFSET',    key: 'timeoutOffset',  min: 0,  max: 5,   fmt: v => v === 0 ? 'none' : `${v} free` },
  { label: 'TIME PER QUESTION', key: 'questionSecs',   min: 5,  max: 120, fmt: v => `${v}s` },
]
const SLATE_VIDEO_SRC = '/media/Mr-%20Slate%20Loop.mp4'

// --- Color palette (dark robot theme) ----------------------------------------

const C = {
  bg: '#0d1117',
  surface: '#161b22',
  surfaceElev: '#1c2128',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  accent: '#58a6ff',
  green: '#3fb950',
  greenDim: 'rgba(63,185,80,0.15)',
  red: '#f85149',
  redDim: 'rgba(248,81,73,0.15)',
  yellow: '#d29922',
  yellowDim: 'rgba(210,153,34,0.15)',
  mono: '"ui-monospace","Cascadia Code","Source Code Pro",monospace',
}

// --- Question pool helpers ----------------------------------------------------

function buildPool(lessonData) {
  const pool = []
  for (const q of lessonData?.sample || []) {
    if (q?.question) pool.push({ type: 'shortanswer', question: q.question, expectedAny: q.expectedAny || [] })
  }
  for (const q of lessonData?.truefalse || []) {
    if (!q?.question) continue
    if (typeof q.answer === 'boolean') {
      pool.push({ type: 'truefalse', question: q.question, answer: q.answer })
    } else if (q.expectedAny?.length) {
      pool.push({ type: 'shortanswer', question: q.question, expectedAny: q.expectedAny })
    }
  }
  for (const q of lessonData?.multiplechoice || []) {
    if (!q?.question) continue
    if (Array.isArray(q.choices) && q.choices.length) {
      pool.push({ type: 'multiplechoice', question: q.question, choices: q.choices, correct: q.correct ?? 0 })
    } else if (q.expectedAny?.length) {
      pool.push({ type: 'shortanswer', question: q.question, expectedAny: q.expectedAny })
    }
  }
  for (const q of lessonData?.fillintheblank || []) {
    if (q?.question) pool.push({ type: 'fillintheblank', question: q.question, expectedAny: q.expectedAny || [] })
  }
  for (const q of lessonData?.shortanswer || []) {
    if (q?.question) pool.push({ type: 'shortanswer', question: q.question, expectedAny: q.expectedAny || [] })
  }
  return pool
}

function shuffleArr(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// --- Answer evaluation -------------------------------------------------------

function checkAnswer(q, raw) {
  if (!q) return false
  if (q.type === 'multiplechoice') return Number(raw) === Number(q.correct)
  if (q.type === 'truefalse') return (raw === 'true') === Boolean(q.answer)
  const norm = s => String(s || '').trim().toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()
  const ua = norm(raw)
  if (!ua) return false
  return (q.expectedAny || []).some(e => {
    const ne = norm(e)
    return ne.length > 0 && (ua.includes(ne) || ne.includes(ua))
  })
}

function getCorrectText(q) {
  if (!q) return ''
  if (q.type === 'multiplechoice') return q.choices?.[q.correct] || String(q.correct)
  if (q.type === 'truefalse') return q.answer ? 'True' : 'False'
  return (q.expectedAny || [])[0] || ''
}

// --- Robot dialogue ----------------------------------------------------------

const pick = arr => arr[Math.floor(Math.random() * arr.length)]

const GREETING_MSGS = [
  'Time to run some drills.',
  'Let the drill begin.',
  'Drill sequence initiated.',
  'Ready for your first query.',
  'Systems online. First question loading.',
  'Activating drill protocol.',
  'Stand by. Loading first query.',
  'Drill mode engaged. Let us begin.',
  'Prepare for query processing.',
  'Commencing drill sequence now.',
  'Drill protocol active. Here we go.',
]
const CORRECT_MSGS = [
  'Affirmative. Correct response.',
  'Confirmed correct.',
  'Accurate. Score updated.',
  'Correct. Processing next query.',
  'Response accepted.',
  'Input validated. Correct.',
  'Excellent. Moving on.',
  'That is correct.',
  'Right answer confirmed.',
  'Positive match detected.',
  'Score increment registered.',
]
const WRONG_MSGS = [
  'Negative. Incorrect response.',
  'Error. Wrong answer detected.',
  'Incorrect.',
  'Does not match expected output.',
  'Incorrect response recorded.',
  'Mismatch detected.',
  'Negative. Try harder next time.',
  'That is not the correct answer.',
  'Error code: wrong answer.',
  'Recalibrate. The answer was wrong.',
  'Wrong. Score deducted.',
]
const TIMEOUT_MSGS = [
  'Time limit exceeded. No response.',
  'Query timeout. Moving on.',
  'Response not received in time.',
  'Time expired. Next query.',
  'Timeout recorded. Stay faster.',
  'Response window closed.',
  'No input detected. Advancing.',
  'Time is up. Focus.',
  'Clock ran out. Next query loading.',
  'Too slow. Speed up your recall.',
  'Timeout. We do not wait.',
  'Response overdue. Proceeding.',
  'Timer zeroed. No credit awarded.',
  'You ran out of time on that one.',
  'Processing halted. Time limit reached.',
  'That one slipped by. Stay sharp.',
  'No answer in time. Noted.',
  'Timeout flagged. Keep your pace.',
  'The clock does not lie. Moving on.',
  'Speed and accuracy. Work on both.',
  'Time penalty applied. Next.',
  'Zero seconds remaining. Advancing.',
]
const CONGRATS_MSGS = [
  'Mastery confirmed. Well done.',
  'Drill sequence complete. Excellent work.',
  'You have reached mastery level.',
  'Outstanding. Mastery achieved.',
  'All systems confirm mastery. Great job.',
  'Target score reached. Drill complete.',
  'Congratulations. Mastery unlocked.',
  'You have passed the drill protocol.',
  'Mission complete. Mastery confirmed.',
  'Well done. You have earned the robot badge.',
  'Impressive performance. Mastery achieved.',
]

// --- Sub-components ----------------------------------------------------------

const SlateVideo = forwardRef(function SlateVideo({ size = 180, style: extraStyle }, ref) {
  const sizeStyle = extraStyle ? {} : { width: size, height: size }
  return (
    <video
      ref={ref}
      src={SLATE_VIDEO_SRC}
      loop
      muted
      playsInline
      style={{ objectFit: 'contain', display: 'block', margin: '0 auto', ...sizeStyle, ...extraStyle }}
    />
  )
})

function TimerBar({ secondsLeft, total = QUESTION_SECONDS }) {
  const pct = Math.max(0, Math.min(100, (secondsLeft / total) * 100))
  const color = pct > 50 ? C.green : pct > 25 ? C.yellow : C.red
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 0.9s linear, background 0.4s ease',
        }} />
      </div>
      <span style={{ color: C.muted, fontSize: 12, fontFamily: C.mono, minWidth: 28, textAlign: 'right' }}>{secondsLeft}s</span>
    </div>
  )
}

function ScorePips({ score, goal = SCORE_GOAL }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {Array.from({ length: goal }, (_, i) => (
        <div key={i} style={{
          width: 14,
          height: 14,
          borderRadius: 2,
          background: i < score ? C.green : '#21262d',
          border: `1px solid ${i < score ? '#2ea043' : C.border}`,
          transition: 'background 0.3s, border-color 0.3s',
        }} />
      ))}
      <span style={{ color: C.muted, fontSize: 12, fontFamily: C.mono, marginLeft: 4 }}>{score}/{goal}</span>
    </div>
  )
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 8,
          height: 8,
          background: C.muted,
          borderRadius: '50%',
          animation: `slateblink 1.2s ease-in-out ${i * 0.4}s infinite`,
        }} />
      ))}
      <style>{`@keyframes slateblink { 0%,100%{opacity:0.2} 50%{opacity:1} }`}</style>
    </div>
  )
}

// --- Style helpers -----------------------------------------------------------

const btnBase = {
  fontFamily: C.mono,
  cursor: 'pointer',
  letterSpacing: 1,
  transition: 'opacity 0.15s',
}
const primaryBtn = {
  ...btnBase,
  background: C.green,
  border: `1px solid ${C.green}`,
  color: '#0d1117',
  borderRadius: 6,
  padding: '12px 28px',
  fontSize: 14,
  fontWeight: 800,
}
const ghostBtn = {
  ...btnBase,
  background: C.surface,
  border: `1px solid ${C.border}`,
  color: C.muted,
  borderRadius: 6,
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 700,
}
const dangerBtn = {
  ...btnBase,
  background: 'transparent',
  border: `1px solid ${C.border}`,
  color: C.red,
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 12,
  fontWeight: 700,
}
const soundBtn = {
  ...btnBase,
  background: 'transparent',
  border: `1px solid ${C.border}`,
  color: C.muted,
  borderRadius: 6,
  padding: '6px 10px',
  fontSize: 13,
  fontWeight: 600,
}
const choiceBtn = {
  ...btnBase,
  background: C.surfaceElev,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: '12px 16px',
  color: C.text,
  fontSize: 14,
  textAlign: 'left',
  width: '100%',
}
const tfBtnBase = {
  ...btnBase,
  flex: 1,
  borderRadius: 8,
  padding: '16px 24px',
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: 2,
}

// --- TTS helper ---------------------------------------------------------------

async function playSlateAudio(text, audioEl, videoEl, onDone, isSpeakingRef) {
  if (!text || !audioEl) { onDone?.(); return }
  if (isSpeakingRef) isSpeakingRef.current = true
  try {
    const res = await fetch('/api/slate-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) { if (isSpeakingRef) isSpeakingRef.current = false; onDone?.(); return }
    const { audio } = await res.json()
    if (!audio) { if (isSpeakingRef) isSpeakingRef.current = false; onDone?.(); return }
    audioEl.pause()
    audioEl.src = audio.startsWith('data:') ? audio : `data:audio/mp3;base64,${audio}`
    if (videoEl) { try { videoEl.play().catch(() => {}) } catch {} }
    audioEl.onended = () => {
      if (isSpeakingRef) isSpeakingRef.current = false
      if (videoEl) { try { videoEl.pause() } catch {} }
      onDone?.()
    }
    audioEl.onerror = () => {
      if (isSpeakingRef) isSpeakingRef.current = false
      onDone?.()
    }
    audioEl.play().catch(() => { if (isSpeakingRef) isSpeakingRef.current = false; onDone?.() })
  } catch { if (isSpeakingRef) isSpeakingRef.current = false; onDone?.() }
}

// --- Main inner component ----------------------------------------------------

function SlateDrillInner() {
  const router = useRouter()

  // Page state
  // Phases: loading | list | ready | asking | feedback | won | error
  const [pagePhase, setPagePhase] = useState('loading')
  const [availableLessons, setAvailableLessons] = useState([])
  const [lessonData, setLessonData] = useState(null)
  const [pool, setPool] = useState([])
  const [score, setScore] = useState(0)
  const [qCount, setQCount] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS)
  const [currentQ, setCurrentQ] = useState(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const [soundOn, setSoundOn] = useState(true)
  const [learnerId, setLearnerId] = useState(null)
  const [masteryMap, setMasteryMap] = useState({})
  const [errorMsg, setErrorMsg] = useState('')
  const [listTab, setListTab] = useState('active')
  const [ownedFilters, setOwnedFilters] = useState({ subject: '', grade: '', difficulty: '' })
  const [allOwnedLessons, setAllOwnedLessons] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [listError, setListError] = useState('')
  const [settings, setSettings] = useState(DEFAULT_SLATE_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SLATE_SETTINGS)
  const [settingsSaving, setSettingsSaving] = useState(false)

  // Refs for stale-closure-free use in timers/callbacks
  const phaseRef = useRef('loading')
  const currentQRef = useRef(null)
  const deckRef = useRef([])
  const deckIdxRef = useRef(0)
  const poolRef = useRef([])
  const scoreRef = useRef(0)
  const soundRef = useRef(true)
  const learnerIdRef = useRef(null)
  const lessonKeyRef = useRef('')

  const timerInterval = useRef(null)
  const feedbackTimeout = useRef(null)
  const audioEl = useRef(null)
  const inputEl = useRef(null)
  const slateVideoRef = useRef(null)
  const slateIsSpeakingRef = useRef(false)
  const consecutiveTimeoutsRef = useRef(0)
  const settingsRef = useRef(DEFAULT_SLATE_SETTINGS)

  // Keep fast refs in sync
  useEffect(() => { soundRef.current = soundOn }, [soundOn])
  useEffect(() => { learnerIdRef.current = learnerId }, [learnerId])
  useEffect(() => { settingsRef.current = settings }, [settings])

  // Load learner + mastery + available lessons
  useEffect(() => {
    if (typeof window === 'undefined') return
    const id = localStorage.getItem('learner_id')
    setLearnerId(id)
    if (id) {
      const mm = getMasteryForLearner(id)
      setMasteryMap(mm)
      learnerIdRef.current = id
      if (!id || id === 'demo') {
        phaseRef.current = 'list'
        setPagePhase('list')
        return
      }
      Promise.all([
        fetch(`/api/learner/available-lessons?learner_id=${encodeURIComponent(id)}`)
          .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load lessons'))),
        fetch(`/api/learner/slate-settings?learner_id=${encodeURIComponent(id)}`)
          .then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/learner/lesson-history?learner_id=${encodeURIComponent(id)}&limit=200`)
          .then(r => r.ok ? r.json() : null).catch(() => null),
      ])
        .then(([{ lessons }, settingsRes, historyRes]) => {
          const drillable = (lessons || []).filter(l => buildPool(l).length > 0)
          setAvailableLessons(drillable)
          setAllOwnedLessons(lessons || [])
          if (settingsRes?.settings) {
            const merged = { ...DEFAULT_SLATE_SETTINGS, ...settingsRes.settings }
            setSettings(merged)
            setSettingsDraft(merged)
            settingsRef.current = merged
          }
          if (historyRes?.sessions) {
            const completed = historyRes.sessions
              .filter(s => s.status === 'completed' && s.lesson_id && s.ended_at)
            // Deduplicate by lesson_id keeping most-recent
            const seen = new Map()
            for (const s of completed) {
              const existing = seen.get(s.lesson_id)
              if (!existing || new Date(s.ended_at) > new Date(existing.ended_at)) {
                seen.set(s.lesson_id, s)
              }
            }
            setRecentSessions([...seen.values()].sort((a, b) => new Date(b.ended_at) - new Date(a.ended_at)))
          }
          phaseRef.current = 'list'
          setPagePhase('list')
        })
        .catch(e => {
          setErrorMsg(e?.message || 'Could not load lessons.')
          phaseRef.current = 'error'
          setPagePhase('error')
        })
    } else {
      phaseRef.current = 'list'
      setPagePhase('list')
    }
  }, [])

  // Cleanup
  useEffect(() => () => {
    clearInterval(timerInterval.current)
    clearTimeout(feedbackTimeout.current)
    if (audioEl.current) { audioEl.current.pause(); audioEl.current.src = '' }
  }, [])

  // Select a lesson from the list — skip the ready screen, go straight to drilling
  const selectLesson = useCallback((lesson) => {
    clearInterval(timerInterval.current)
    clearTimeout(feedbackTimeout.current)
    const p = buildPool(lesson)
    if (!p.length) {
      setListError('This lesson has no drill questions. Ask your facilitator to add quiz questions to it.')
      return
    }
    if (!p.length) {
      setErrorMsg('This lesson has no drill questions. Try a different lesson, or ask your facilitator to add quiz questions to it.')
      phaseRef.current = 'error'
      setPagePhase('error')
      return
    }
    poolRef.current = p
    setPool(p)
    const lk = lesson.lessonKey || `${lesson.subject || 'general'}/${lesson.file || ''}`
    lessonKeyRef.current = lk
    setLessonData(lesson)
    setScore(0)
    scoreRef.current = 0
    setQCount(0)
    const newDeck = shuffleArr(p)
    deckRef.current = newDeck
    deckIdxRef.current = 0
    const q = newDeck[0]
    if (q) {
      deckIdxRef.current = 1
      currentQRef.current = q
      setCurrentQ(q)
      setUserAnswer('')
      setLastResult(null)
      setSecondsLeft(settingsRef.current.questionSecs)
      phaseRef.current = 'asking'
      setPagePhase('asking')
      setTimeout(() => inputEl.current?.focus?.(), 80)
      if (soundRef.current) {
        setTimeout(() => {
          playSlateAudio(pick(GREETING_MSGS), audioEl.current, slateVideoRef.current, () => {
            playSlateAudio(q.question, audioEl.current, slateVideoRef.current, undefined, slateIsSpeakingRef)
          }, slateIsSpeakingRef)
        }, 120)
      }
    }
  }, [])

  // Advance the deck, reshuffling when 80%+ has been used
  const advanceDeck = useCallback(() => {
    const cur = deckRef.current
    const idx = deckIdxRef.current
    const p = poolRef.current
    if (!p.length) return null
    if (idx >= cur.length - Math.max(1, Math.floor(cur.length * RESHUFFLE_THRESHOLD))) {
      const newDeck = shuffleArr(p)
      deckRef.current = newDeck
      deckIdxRef.current = 1
      return newDeck[0]
    }
    deckIdxRef.current = idx + 1
    return cur[idx]
  }, [])

  // Display a question
  const showQuestion = useCallback((q, skipAudio = false) => {
    currentQRef.current = q
    setCurrentQ(q)
    setUserAnswer('')
    setLastResult(null)
    setSecondsLeft(settingsRef.current.questionSecs)
    phaseRef.current = 'asking'
    setPagePhase('asking')
    setTimeout(() => inputEl.current?.focus?.(), 80)
    if (!skipAudio && soundRef.current) setTimeout(() => playSlateAudio(q.question, audioEl.current, slateVideoRef.current, undefined, slateIsSpeakingRef), 120)
  }, [])

  // Start / restart the drill
  const startDrill = useCallback(() => {
    clearInterval(timerInterval.current)
    clearTimeout(feedbackTimeout.current)
    const newDeck = shuffleArr(poolRef.current)
    deckRef.current = newDeck
    deckIdxRef.current = 0
    setScore(0)
    scoreRef.current = 0
    setQCount(0)
    const q = advanceDeck()
    if (q) {
      showQuestion(q, true) // skipAudio — we chain greeting → question ourselves
      if (soundRef.current) {
        setTimeout(() => {
          playSlateAudio(pick(GREETING_MSGS), audioEl.current, slateVideoRef.current, () => {
            playSlateAudio(q.question, audioEl.current, slateVideoRef.current, undefined, slateIsSpeakingRef)
          }, slateIsSpeakingRef)
        }, 120)
      }
    }
  }, [advanceDeck, showQuestion])

  // Handle answer result (correct / wrong / timeout)
  const handleResult = useCallback((correct, timeout = false) => {
    clearInterval(timerInterval.current)
    const q = currentQRef.current
    const prev = scoreRef.current
    let newScore = prev
    if (!timeout) {
      consecutiveTimeoutsRef.current = 0
      const { scoreGoal, correctPts, wrongPts } = settingsRef.current
      newScore = correct ? Math.min(scoreGoal, prev + correctPts) : Math.max(0, prev - wrongPts)
    } else {
      consecutiveTimeoutsRef.current += 1
      const { timeoutPts, timeoutOffset } = settingsRef.current
      if (timeoutPts > 0 && consecutiveTimeoutsRef.current > timeoutOffset) {
        newScore = Math.max(0, prev - timeoutPts)
      }
    }
    scoreRef.current = newScore
    setScore(newScore)
    setQCount(c => c + 1)

    const msgs = timeout ? TIMEOUT_MSGS : correct ? CORRECT_MSGS : WRONG_MSGS
    const feedbackText = pick(msgs)
    const correctAnswer = !correct && !timeout && q ? getCorrectText(q) : ''
    setLastResult({ correct, timeout, text: feedbackText, correctAnswer })
    phaseRef.current = 'feedback'
    setPagePhase('feedback')

    // Helper: advance to next question (used both by timeout and audio onDone)
    const doAdvance = () => {
      if (phaseRef.current !== 'feedback') return
      const next = advanceDeck()
      if (next) showQuestion(next)
    }

    if (!timeout && newScore >= settingsRef.current.scoreGoal) {
      // Won — fire after a short delay so the feedback text is visible briefly
      feedbackTimeout.current = setTimeout(() => {
        const lid = learnerIdRef.current
        const lk = lessonKeyRef.current
        if (lid && lk) {
          saveMastery(lid, lk)
          setMasteryMap(getMasteryForLearner(lid))
        }
        const doWon = () => { phaseRef.current = 'won'; setPagePhase('won') }
        if (soundRef.current) {
          playSlateAudio(pick(CONGRATS_MSGS), audioEl.current, slateVideoRef.current, doWon, slateIsSpeakingRef)
        } else {
          doWon()
        }
      }, FEEDBACK_DELAY_MS)
    } else if (soundRef.current && correctAnswer) {
      // Wrong answer with sound: chain feedback → correct answer → advance
      // No separate timeout — audio onDone drives the transition so nothing cuts it off
      playSlateAudio(feedbackText, audioEl.current, slateVideoRef.current, () => {
        playSlateAudio(`The correct answer was ${correctAnswer}.`, audioEl.current, slateVideoRef.current, () => {
          feedbackTimeout.current = setTimeout(doAdvance, 600)
        }, slateIsSpeakingRef)
      }, slateIsSpeakingRef)
    } else {
      // Correct / timeout with sound, or sound off: use normal delay then advance
      if (soundRef.current) {
        playSlateAudio(feedbackText, audioEl.current, slateVideoRef.current, undefined, slateIsSpeakingRef)
      }
      feedbackTimeout.current = setTimeout(doAdvance, FEEDBACK_DELAY_MS)
    }
  }, [advanceDeck, showQuestion])

  // Countdown timer
  useEffect(() => {
    if (pagePhase !== 'asking') return
    clearInterval(timerInterval.current)
    timerInterval.current = setInterval(() => {
      if (slateIsSpeakingRef.current) return // pause while Mr. Slate is talking
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(timerInterval.current)
          handleResult(false, true)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timerInterval.current)
  }, [pagePhase, currentQ, handleResult])

  // Text answer submission
  const onTextSubmit = useCallback(() => {
    if (phaseRef.current !== 'asking') return
    handleResult(checkAnswer(currentQRef.current, userAnswer), false)
  }, [userAnswer, handleResult])

  // Choice click (MC / TF)
  const onChoiceClick = useCallback((value) => {
    if (phaseRef.current !== 'asking') return
    handleResult(checkAnswer(currentQRef.current, String(value)), false)
  }, [handleResult])

  const onKeyDown = useCallback(e => { if (e.key === 'Enter') onTextSubmit() }, [onTextSubmit])

  const saveSettings = useCallback(async (draft) => {
    setSettings(draft)
    settingsRef.current = draft
    setSettingsOpen(false)
    const lid = learnerIdRef.current
    if (lid && lid !== 'demo') {
      setSettingsSaving(true)
      try {
        await fetch('/api/learner/slate-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ learner_id: lid, settings: draft }),
        })
      } catch {}
      setSettingsSaving(false)
    }
  }, [])

  const backToList = useCallback(() => {
    clearInterval(timerInterval.current)
    clearTimeout(feedbackTimeout.current)
    setScore(0)
    scoreRef.current = 0
    setQCount(0)
    setCurrentQ(null)
    setLessonData(null)
    lessonKeyRef.current = ''
    phaseRef.current = 'list'
    setPagePhase('list')
  }, [])

  const exitToLessons = useCallback(() => {
    clearInterval(timerInterval.current)
    clearTimeout(feedbackTimeout.current)
    router.push('/learn/lessons')
  }, [router])

  const lessonTitle = lessonData?.title || ''

  // ===========================================================================
  //  RENDER -- Loading
  // ===========================================================================
  if (pagePhase === 'loading') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <SlateVideo size={100} />
          </div>
          <div style={{ fontSize: 13, letterSpacing: 2, marginBottom: 20 }}>INITIALIZING DRILL SYSTEM...</div>
          <LoadingDots />
        </div>
      </div>
    )
  }

  // ===========================================================================
  //  RENDER -- Error
  // ===========================================================================
  if (pagePhase === 'error') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: C.red, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>SYSTEM ERROR</div>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>{errorMsg}</div>
          <button onClick={exitToLessons} style={ghostBtn}>← RETURN TO LESSONS</button>
        </div>
      </div>
    )
  }

  // ===========================================================================
  //  RENDER -- Lesson list
  // ===========================================================================
  if (pagePhase === 'list') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <video src={SLATE_VIDEO_SRC} muted playsInline style={{ width: 36, height: 36, objectFit: 'contain' }} />
            <div>
              <div style={{ color: C.accent, fontWeight: 800, fontSize: 15, letterSpacing: 2 }}>MR. SLATE V1</div>
              <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2 }}>SKILLS &amp; PRACTICE COACH</div>
            </div>
          </div>
          <button onClick={exitToLessons} style={ghostBtn}>← BACK</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '24px 16px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
          {availableLessons.length === 0 && allOwnedLessons.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 60 }}>
              <div style={{ marginBottom: 16 }}>
                <SlateVideo size={120} />
              </div>
              <div style={{ color: C.muted, fontSize: 14, letterSpacing: 1 }}>NO DRILL LESSONS AVAILABLE</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Complete a lesson with Ms. Sonoma first, then come back to practice.</div>
            </div>
          ) : (() => {
            // --- Derived lists for each tab ---
            const getLk = l => l.lessonKey || `${l.subject || 'general'}/${l.file || ''}`

            // Active: drillable lessons not yet Slate-mastered
            const activeList = availableLessons.filter(l => !masteryMap[getLk(l)]?.mastered)

            // Recent: sessions completed in Ms. Sonoma, joined to allOwnedLessons for metadata
            const ownedByKey = new Map(allOwnedLessons.map(l => [getLk(l), l]))
            const recentList = recentSessions.map(s => {
              const lesson = ownedByKey.get(s.lesson_id)
              return { session: s, lesson }
            })

            // Owned: ALL owned lessons (drillable or not) with filters
            const allSubjects = [...new Set(allOwnedLessons.map(l => l.subject).filter(Boolean))].sort()
            const allGrades = [...new Set(allOwnedLessons.map(l => l.grade).filter(v => v != null))].sort((a, b) => Number(a) - Number(b))
            const allDiffs = [...new Set(allOwnedLessons.map(l => l.difficulty).filter(Boolean))].sort()
            const ownedList = allOwnedLessons.filter(l => {
              if (ownedFilters.subject && l.subject !== ownedFilters.subject) return false
              if (ownedFilters.grade && String(l.grade) !== ownedFilters.grade) return false
              if (ownedFilters.difficulty && l.difficulty !== ownedFilters.difficulty) return false
              return true
            })

            // --- Tab styles ---
            const tabStyle = active => ({
              background: active ? C.accent : 'transparent',
              color: active ? C.bg : C.muted,
              border: `1px solid ${active ? C.accent : C.border}`,
              borderRadius: 6,
              padding: '6px 16px',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 2,
              cursor: 'pointer',
              fontFamily: C.mono,
              transition: 'all 0.15s',
            })

            // --- Lesson card renderer (all owned lessons) ---
            const LessonCard = ({ lesson, dateLabel }) => {
              const lk = getLk(lesson)
              const mastered = !!(masteryMap[lk]?.mastered)
              const poolSize = buildPool(lesson).length
              const subjectLabel = (lesson.subject || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              const gradeLabel = lesson.grade ? `Grade ${lesson.grade}` : ''
              const diffLabel = lesson.difficulty ? lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1) : ''
              return (
                <button
                  onClick={() => selectLesson(lesson)}
                  style={{
                    background: C.surface,
                    border: `1px solid ${mastered ? C.green : C.border}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    width: '100%',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                      {mastered && <span style={{ color: C.green, marginRight: 6 }}>🤖</span>}
                      {lesson.title || lk}
                    </div>
                    <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1 }}>
                      {[subjectLabel, gradeLabel, diffLabel].filter(Boolean).join(' · ')}
                      {poolSize > 0
                        ? <>{' · '}<span style={{ color: mastered ? C.green : C.accent }}>{poolSize} QUESTIONS</span></>
                        : <span style={{ color: C.muted, marginLeft: 4, opacity: 0.6 }}>· no drill questions</span>
                      }
                      {mastered && <span style={{ color: C.green, marginLeft: 8 }}>✓ MASTERED</span>}
                      {dateLabel && <span style={{ color: C.muted, marginLeft: 8 }}>{dateLabel}</span>}
                    </div>
                  </div>
                  <div style={{ color: C.accent, fontWeight: 800, fontSize: 18, flexShrink: 0 }}>▶</div>
                </button>
              )
            }

            // --- Recent row (session + optional lesson metadata) ---
            const RecentRow = ({ session, lesson }) => {
              const dateLabel = session.ended_at
                ? new Date(session.ended_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : ''
              if (lesson) return <LessonCard lesson={lesson} dateLabel={dateLabel} />
              // No lesson metadata (lesson may have been removed) — show raw session info
              const lk = session.lesson_id || '—'
              return (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', opacity: 0.5 }}>
                  <div style={{ color: C.muted, fontSize: 13 }}>{lk}</div>
                  {dateLabel && <div style={{ color: C.muted, fontSize: 11, marginTop: 4 }}>{dateLabel}</div>}
                </div>
              )
            }

            return (
              <>
                {/* Rules bar */}
                <button
                  onClick={() => { setSettingsDraft(settings); setSettingsOpen(true) }}
                  style={{ color: C.muted, fontSize: 12, lineHeight: 1.8, marginBottom: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: C.mono, display: 'block' }}
                >
                  <span style={{ color: C.text, fontWeight: 700 }}>GOAL:</span> Reach{' '}
                  <span style={{ color: C.text, fontWeight: 700 }}>{settings.scoreGoal} points</span> to earn mastery 🤖
                  {'  ·  '}<span style={{ color: C.green, fontWeight: 700 }}>+{settings.correctPts}</span> correct
                  {'  ·  '}<span style={{ color: C.red, fontWeight: 700 }}>−{settings.wrongPts}</span> wrong
                  {'  ·  '}<span style={{ color: C.yellow, fontWeight: 700 }}>{settings.timeoutPts === 0 ? '±0' : `−${settings.timeoutPts}`}</span> timeout ({settings.questionSecs}s)
                  {'  '}<span style={{ color: C.accent, fontSize: 10, letterSpacing: 1 }}>✎ EDIT</span>
                </button>

                {/* Inline warning banner */}
                {listError && (
                  <div style={{ background: C.redDim, border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: C.red, fontSize: 12 }}>{listError}</span>
                    <button onClick={() => setListError('')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>✕</button>
                  </div>
                )}

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <button style={tabStyle(listTab === 'active')} onClick={() => setListTab('active')}>ACTIVE</button>
                  <button style={tabStyle(listTab === 'recent')} onClick={() => setListTab('recent')}>
                    RECENT{recentList.length > 0 ? ` (${recentList.length})` : ''}
                  </button>
                  <button style={tabStyle(listTab === 'owned')} onClick={() => setListTab('owned')}>
                    OWNED{allOwnedLessons.length > 0 ? ` (${allOwnedLessons.length})` : ''}
                  </button>
                </div>

                {/* Active tab */}
                {listTab === 'active' && (
                  activeList.length === 0 ? (
                    <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 32, letterSpacing: 1 }}>
                      ALL LESSONS MASTERED — CHECK RECENT TAB 🤖
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>
                        {activeList.length} LESSON{activeList.length !== 1 ? 'S' : ''} AVAILABLE
                      </div>
                      {activeList.map((l, i) => <LessonCard key={getLk(l) || i} lesson={l} />)}
                    </div>
                  )
                )}

                {/* Recent tab — completed Ms. Sonoma sessions, most recent first */}
                {listTab === 'recent' && (
                  recentList.length === 0 ? (
                    <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 32, letterSpacing: 1 }}>
                      NO COMPLETED LESSONS YET — FINISH A LESSON WITH MS. SONOMA TO SEE RESULTS HERE
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>
                        {recentList.length} COMPLETED LESSON{recentList.length !== 1 ? 'S' : ''}
                      </div>
                      {recentList.map((r, i) => <RecentRow key={r.session.id || i} session={r.session} lesson={r.lesson} />)}
                    </div>
                  )
                )}

                {/* Owned tab — all owned/activated lessons with filters */}
                {listTab === 'owned' && (
                  <div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                      <select
                        value={ownedFilters.subject}
                        onChange={e => setOwnedFilters(f => ({ ...f, subject: e.target.value }))}
                        style={{ background: C.surface, color: ownedFilters.subject ? C.text : C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', fontSize: 11, fontFamily: C.mono, cursor: 'pointer', letterSpacing: 1 }}
                      >
                        <option value=''>ALL SUBJECTS</option>
                        {allSubjects.map(s => <option key={s} value={s}>{s.replace(/-/g, ' ').toUpperCase()}</option>)}
                      </select>
                      <select
                        value={ownedFilters.grade}
                        onChange={e => setOwnedFilters(f => ({ ...f, grade: e.target.value }))}
                        style={{ background: C.surface, color: ownedFilters.grade ? C.text : C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', fontSize: 11, fontFamily: C.mono, cursor: 'pointer', letterSpacing: 1 }}
                      >
                        <option value=''>ALL GRADES</option>
                        {allGrades.map(g => <option key={g} value={String(g)}>GRADE {g}</option>)}
                      </select>
                      <select
                        value={ownedFilters.difficulty}
                        onChange={e => setOwnedFilters(f => ({ ...f, difficulty: e.target.value }))}
                        style={{ background: C.surface, color: ownedFilters.difficulty ? C.text : C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', fontSize: 11, fontFamily: C.mono, cursor: 'pointer', letterSpacing: 1 }}
                      >
                        <option value=''>ALL DIFFICULTIES</option>
                        {allDiffs.map(d => <option key={d} value={d}>{d.toUpperCase()}</option>)}
                      </select>
                      {(ownedFilters.subject || ownedFilters.grade || ownedFilters.difficulty) && (
                        <button
                          onClick={() => setOwnedFilters({ subject: '', grade: '', difficulty: '' })}
                          style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, color: C.muted, fontSize: 11, fontFamily: C.mono, cursor: 'pointer', padding: '5px 10px', letterSpacing: 1 }}
                        >✕ CLEAR</button>
                      )}
                    </div>
                    {ownedList.length === 0 ? (
                      <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 32, letterSpacing: 1 }}>NO LESSONS MATCH FILTERS</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>
                          {ownedList.length} OF {allOwnedLessons.length} OWNED LESSON{allOwnedLessons.length !== 1 ? 'S' : ''}
                        </div>
                        {ownedList.map((l, i) => <LessonCard key={getLk(l) || i} lesson={l} />)}
                      </div>
                    )}
                  </div>
                )}
              </>
            )
          })()}
        </div>

        {/* Settings overlay */}
        {settingsOpen && (
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}
            onClick={e => { if (e.target === e.currentTarget) setSettingsOpen(false) }}
          >
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: '28px 28px 24px', width: '100%', maxWidth: 420, fontFamily: C.mono }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                <span style={{ color: C.accent, fontWeight: 800, fontSize: 15, letterSpacing: 3 }}>DRILL SETTINGS</span>
                <button onClick={() => setSettingsOpen(false)} style={{ background: 'none', border: 'none', color: C.muted, fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>✕</button>
              </div>
              {SETTINGS_CONFIG.map(({ label, key, min, max, fmt }) => (
                <div key={key} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: C.muted, fontSize: 11, letterSpacing: 1 }}>{label}</span>
                    <span style={{ color: C.text, fontWeight: 700, fontSize: 14 }}>{fmt(settingsDraft[key])}</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={settingsDraft[key]}
                    onChange={e => setSettingsDraft(d => ({ ...d, [key]: Number(e.target.value) }))}
                    style={{ width: '100%', accentColor: C.accent, cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: C.muted, fontSize: 10, marginTop: 2 }}>
                    <span>{fmt(min)}</span><span>{fmt(max)}</span>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setSettingsOpen(false)} style={ghostBtn}>CANCEL</button>
                <button
                  onClick={() => saveSettings(settingsDraft)}
                  style={{ ...primaryBtn, opacity: settingsSaving ? 0.6 : 1 }}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? 'SAVING...' : 'SAVE SETTINGS'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ===========================================================================
  //  RENDER -- Won
  // ===========================================================================
  if (pagePhase === 'won') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ maxWidth: 540, width: '100%', textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}>
            <SlateVideo size={120} />
          </div>
          <div style={{ color: C.green, fontWeight: 900, fontSize: 26, letterSpacing: 4, marginBottom: 4 }}>
            MASTERY CONFIRMED
          </div>
          <div style={{ color: C.muted, fontSize: 12, letterSpacing: 2, marginBottom: 28 }}>DRILL SEQUENCE COMPLETE</div>

          <div style={{ background: C.surface, border: `1px solid ${C.green}`, borderRadius: 12, padding: 28, marginBottom: 24 }}>
            <ScorePips score={settings.scoreGoal} goal={settings.scoreGoal} />
            <div style={{ color: C.text, fontWeight: 700, fontSize: 16, marginTop: 14 }}>{lessonTitle}</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{qCount} QUERIES PROCESSED TO REACH MASTERY</div>
          </div>

          <div style={{ color: C.muted, fontSize: 12, letterSpacing: 1, marginBottom: 28 }}>
            🤖 MASTERY ICON WILL APPEAR ON YOUR LESSON CARD.
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={startDrill} style={ghostBtn}>DRILL AGAIN</button>
            <button onClick={backToList} style={ghostBtn}>LESSON LIST</button>
            <button onClick={exitToLessons} style={primaryBtn}>← BACK TO LESSONS</button>
          </div>
        </div>
      </div>
    )
  }

  // ===========================================================================
  //  RENDER -- Asking / Feedback (main drill screen)
  // ===========================================================================
  const q = currentQ
  const isAsking = pagePhase === 'asking'
  const isFeedback = pagePhase === 'feedback'

  const borderColor = isFeedback && lastResult
    ? (lastResult.correct ? C.green : lastResult.timeout ? C.yellow : C.red)
    : C.border

  return (
    <div style={{ fontFamily: C.mono, background: C.bg, height: '100dvh', display: 'flex', flexDirection: 'column' }}>

      {/* Header bar */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <video src={SLATE_VIDEO_SRC} muted playsInline style={{ width: 32, height: 32, objectFit: 'contain', flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.accent, fontWeight: 800, fontSize: 13, letterSpacing: 2 }}>MR. SLATE</div>
            <div style={{ color: C.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '22ch' }}>{lessonTitle}</div>
          </div>
        </div>

        <ScorePips score={score} goal={settings.scoreGoal} />

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setSoundOn(v => !v)}
            title={soundOn ? 'Mute voice' : 'Unmute voice'}
            style={soundBtn}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <button onClick={backToList} style={ghostBtn}>LIST</button>
          <button onClick={exitToLessons} style={dangerBtn}>EXIT</button>
        </div>
      </div>

      {/* Main drill area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Mr. Slate video — expands to fill all space above the card */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 16px 0' }}>
          <SlateVideo ref={slateVideoRef} style={{ width: '100%', height: '100%', objectFit: 'contain', margin: 0 }} />
        </div>

        {/* Question card — anchored to bottom, scrolls internally if very tall */}
        <div style={{ flexShrink: 0, overflowY: 'auto', maxHeight: '60vh', padding: '12px 16px 56px', width: '100%', maxWidth: 632, margin: '0 auto', boxSizing: 'border-box' }}>
          {q && (
            <div style={{
              background: C.surface,
              border: `1px solid ${borderColor}`,
              borderRadius: 12,
              padding: 24,
              transition: 'border-color 0.3s',
            }}>
              {/* Query label */}
              <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 14 }}>
                QUERY #{qCount + (isAsking ? 1 : 0)} · {q.type.toUpperCase()}
              </div>

              {/* Question text */}
              <div style={{ color: C.text, fontSize: 'clamp(15px,2.8vw,20px)', fontWeight: 600, marginBottom: 20, lineHeight: 1.55 }}>
                {q.question}
              </div>

              {/* Countdown timer -- only while asking */}
              {isAsking && <TimerBar secondsLeft={secondsLeft} total={settings.questionSecs} />}

              {/* Multiple choice */}
              {isAsking && q.type === 'multiplechoice' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginTop: 16 }}>
                  {(q.choices || []).map((choice, i) => (
                    <button
                      key={i}
                      onClick={() => onChoiceClick(i)}
                      style={choiceBtn}
                    >
                      <span style={{ color: C.accent, marginRight: 8, fontWeight: 800 }}>
                        {String.fromCharCode(65 + i)}.
                      </span>
                      {choice}
                    </button>
                  ))}
                </div>
              )}

              {/* True / False */}
              {isAsking && q.type === 'truefalse' && (
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button
                    onClick={() => onChoiceClick('true')}
                    style={{ ...tfBtnBase, background: '#0d1117', border: `1px solid ${C.green}`, color: C.green }}
                  >
                    TRUE
                  </button>
                  <button
                    onClick={() => onChoiceClick('false')}
                    style={{ ...tfBtnBase, background: '#0d1117', border: `1px solid ${C.red}`, color: C.red }}
                  >
                    FALSE
                  </button>
                </div>
              )}

              {/* Short answer / Fill in the blank */}
              {isAsking && (q.type === 'shortanswer' || q.type === 'fillintheblank') && (
                <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                  <input
                    ref={inputEl}
                    type="text"
                    value={userAnswer}
                    onChange={e => setUserAnswer(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="TYPE YOUR ANSWER..."
                    style={{
                      flex: 1,
                      background: C.bg,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      padding: '10px 14px',
                      color: C.text,
                      fontSize: 15,
                      fontFamily: C.mono,
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={onTextSubmit}
                    style={{ ...btnBase, background: C.accent, border: `1px solid ${C.accent}`, color: '#0d1117', borderRadius: 6, padding: '10px 18px', fontSize: 13, fontWeight: 800 }}
                  >
                    SUBMIT
                  </button>
                </div>
              )}

              {/* Feedback panel */}
              {isFeedback && lastResult && (
                <div style={{
                  marginTop: 20,
                  padding: 16,
                  background: lastResult.correct ? C.greenDim : lastResult.timeout ? C.yellowDim : C.redDim,
                  border: `1px solid ${lastResult.correct ? C.green : lastResult.timeout ? C.yellow : C.red}`,
                  borderRadius: 8,
                }}>
                  <div style={{
                    fontWeight: 800,
                    fontSize: 14,
                    letterSpacing: 1,
                    color: lastResult.correct ? C.green : lastResult.timeout ? C.yellow : C.red,
                  }}>
                    {lastResult.correct ? '✓ ' : lastResult.timeout ? '⏰ ' : '✗ '}
                    {lastResult.text}
                  </div>
                  {lastResult.correctAnswer && (
                    <div style={{ marginTop: 8, color: C.muted, fontSize: 13 }}>
                      EXPECTED: <strong style={{ color: C.text }}>{lastResult.correctAnswer}</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hidden audio element for TTS playback */}
      <audio ref={audioEl} style={{ display: 'none' }} />
    </div>
  )
}

// --- Page root with Suspense --------------------------------------------------

export default function SlateDrillPage() {
  return (
    <Suspense fallback={
      <div style={{ background: '#0d1117', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8b949e', fontFamily: 'monospace' }}>
        <span>LOADING...</span>
      </div>
    }>
      <SlateDrillInner />
    </Suspense>
  )
}
