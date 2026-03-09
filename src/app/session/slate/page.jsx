'use client'

/**
 * Mr. Slate â€” Skills & Practice Coach
 *
 * A quiz-mode drill session. Questions are drawn from the same lesson JSON
 * as Ms. Sonoma (sample, truefalse, multiplechoice, fillintheblank pools).
 * The learner accumulates points (goal: 10) to earn the ðŸ¤– mastery icon.
 *
 * Rules:
 *   - Correct answer within time limit  â†’ +1 (min 0, max 10)
 *   - Wrong answer                      â†’ -1 (min 0)
 *   - Timeout (15s default)             â†’ Â±0
 *   - Reach 10 â†’ mastery confirmed
 *
 * Questions rotate through the full pool without repeats until ~80% have
 * been asked, then the deck reshuffles.
 *
 * Lessons are loaded from /api/learner/available-lessons (handles static,
 * generated, and Supabase-stored lessons uniformly). No URL params required.
 */

import { Suspense, useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getMasteryForLearner, saveMastery } from '@/app/lib/masteryClient'

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const QUESTION_SECONDS = 15
const SCORE_GOAL = 10
const FEEDBACK_DELAY_MS = 2000
const RESHUFFLE_THRESHOLD = 0.2 // reshuffle when only 20% of deck remains

// â”€â”€â”€ Color palette (dark robot theme) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Question pool helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildPool(lessonData) {
  const pool = []
  for (const q of lessonData?.sample || []) {
    if (q?.question) pool.push({ type: 'shortanswer', question: q.question, expectedAny: q.expectedAny || [] })
  }
  for (const q of lessonData?.truefalse || []) {
    if (q?.question != null) pool.push({ type: 'truefalse', question: q.question, answer: Boolean(q.answer) })
  }
  for (const q of lessonData?.multiplechoice || []) {
    if (q?.question) pool.push({
      type: 'multiplechoice',
      question: q.question,
      choices: Array.isArray(q.choices) ? q.choices : [],
      correct: q.correct ?? 0,
    })
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

// â”€â”€â”€ Answer evaluation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Robot dialogue â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const pick = arr => arr[Math.floor(Math.random() * arr.length)]

const CORRECT_MSGS = [
  'AFFIRMATIVE. CORRECT RESPONSE.',
  'CONFIRMED CORRECT.',
  'ACCURATE. SCORE UPDATED.',
  'CORRECT. PROCESSING NEXT QUERY.',
  'RESPONSE ACCEPTED.',
  'INPUT VALIDATED. CORRECT.',
]
const WRONG_MSGS = [
  'NEGATIVE. INCORRECT RESPONSE.',
  'ERROR: WRONG ANSWER DETECTED.',
  'INCORRECT.',
  'DOES NOT MATCH EXPECTED OUTPUT.',
  'INCORRECT RESPONSE RECORDED.',
  'MISMATCH DETECTED.',
]
const TIMEOUT_MSGS = [
  'TIME LIMIT EXCEEDED. NO RESPONSE.',
  'QUERY TIMEOUT.',
  'RESPONSE NOT RECEIVED IN TIME.',
  'TIME EXPIRED. NEXT QUERY.',
  'TIMEOUT RECORDED.',
]

// â”€â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ Style helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

// â”€â”€â”€ TTS helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function playSlateAudio(text, audioEl) {
  if (!text || !audioEl) return
  try {
    const res = await fetch('/api/slate-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (!res.ok) return
    const { audio } = await res.json()
    if (!audio) return
    audioEl.pause()
    audioEl.src = audio.startsWith('data:') ? audio : `data:audio/mp3;base64,${audio}`
    audioEl.play().catch(() => {})
  } catch {}
}

// â”€â”€â”€ Main inner component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SlateDrillInner() {
  const router = useRouter()

  // â”€â”€ Page state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Phases: loading | list | ready | asking | feedback | won | error
  const [pagePhase, setPagePhase] = useState('loading')
  const [availableLessons, setAvailableLessons] = useState([])
  const [lessonData, setLessonData] = useState(null)  // the chosen lesson object from the API
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

  // â”€â”€ Refs for stale-closure-free use in timers/callbacks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // Keep fast refs in sync
  useEffect(() => { soundRef.current = soundOn }, [soundOn])
  useEffect(() => { learnerIdRef.current = learnerId }, [learnerId])

  // â”€â”€ Load learner + mastery + available lessons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
      fetch(`/api/learner/available-lessons?learner_id=${encodeURIComponent(id)}`)
        .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load lessons')))
        .then(({ lessons }) => {
          // Only list lessons that have at least one drill question
          const drillable = (lessons || []).filter(l => {
            const p = buildPool(l)
            return p.length > 0
          })
          setAvailableLessons(drillable)
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

  // â”€â”€ Cleanup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => () => {
    clearInterval(timerInterval.current)
    clearTimeout(feedbackTimeout.current)
    if (audioEl.current) { audioEl.current.pause(); audioEl.current.src = '' }
  }, [])

  // â”€â”€ Select a lesson from the list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const selectLesson = useCallback((lesson) => {
    const p = buildPool(lesson)
    poolRef.current = p
    setPool(p)
    const d = shuffleArr(p)
    deckRef.current = d
    deckIdxRef.current = 0
    const lk = lesson.lessonKey || `${lesson.subject || 'general'}/${lesson.file || ''}`
    lessonKeyRef.current = lk
    setLessonData(lesson)
    phaseRef.current = 'ready'
    setPagePhase('ready')
  }, [])

  // â”€â”€ Advance the deck, reshuffling when 80%+ has been used â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Display a question â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const showQuestion = useCallback((q) => {
    currentQRef.current = q
    setCurrentQ(q)
    setUserAnswer('')
    setLastResult(null)
    setSecondsLeft(QUESTION_SECONDS)
    phaseRef.current = 'asking'
    setPagePhase('asking')
    setTimeout(() => inputEl.current?.focus?.(), 80)
    if (soundRef.current) playSlateAudio(q.question, audioEl.current)
  }, [])

  // â”€â”€ Start / restart the drill â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    if (q) showQuestion(q)
  }, [advanceDeck, showQuestion])

  // â”€â”€ Handle answer result (correct / wrong / timeout) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleResult = useCallback((correct, timeout = false) => {
    clearInterval(timerInterval.current)
    const q = currentQRef.current
    const prev = scoreRef.current
    let newScore = prev
    if (!timeout) {
      newScore = correct ? Math.min(SCORE_GOAL, prev + 1) : Math.max(0, prev - 1)
    }
    scoreRef.current = newScore
    setScore(newScore)
    setQCount(c => c + 1)

    const msgs = timeout ? TIMEOUT_MSGS : correct ? CORRECT_MSGS : WRONG_MSGS
    const correctAnswer = !correct && !timeout && q ? getCorrectText(q) : ''
    setLastResult({ correct, timeout, text: pick(msgs), correctAnswer })
    phaseRef.current = 'feedback'
    setPagePhase('feedback')

    if (!timeout && newScore >= SCORE_GOAL) {
      feedbackTimeout.current = setTimeout(() => {
        const lid = learnerIdRef.current
        const lk = lessonKeyRef.current
        if (lid && lk) {
          saveMastery(lid, lk)
          setMasteryMap(getMasteryForLearner(lid))
        }
        phaseRef.current = 'won'
        setPagePhase('won')
      }, FEEDBACK_DELAY_MS)
    } else {
      feedbackTimeout.current = setTimeout(() => {
        if (phaseRef.current !== 'feedback') return
        const next = advanceDeck()
        if (next) showQuestion(next)
      }, FEEDBACK_DELAY_MS)
    }
  }, [advanceDeck, showQuestion])

  // â”€â”€ Countdown timer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (pagePhase !== 'asking') return
    clearInterval(timerInterval.current)
    timerInterval.current = setInterval(() => {
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

  // â”€â”€ Text answer submission â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const onTextSubmit = useCallback(() => {
    if (phaseRef.current !== 'asking') return
    handleResult(checkAnswer(currentQRef.current, userAnswer), false)
  }, [userAnswer, handleResult])

  // â”€â”€ Choice click (MC / TF) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const onChoiceClick = useCallback((value) => {
    if (phaseRef.current !== 'asking') return
    handleResult(checkAnswer(currentQRef.current, String(value)), false)
  }, [handleResult])

  const onKeyDown = useCallback(e => { if (e.key === 'Enter') onTextSubmit() }, [onTextSubmit])

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

  // â”€â”€ Derived display values â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const lessonTitle = lessonData?.title || ''

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  RENDER â€” Loading
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (pagePhase === 'loading') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>ðŸ¤–</div>
          <div style={{ fontSize: 13, letterSpacing: 2, marginBottom: 20 }}>INITIALIZING DRILL SYSTEM...</div>
          <LoadingDots />
        </div>
      </div>
    )
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  RENDER â€” Error
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (pagePhase === 'error') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>âš ï¸</div>
          <div style={{ color: C.red, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>SYSTEM ERROR</div>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>{errorMsg}</div>
          <button onClick={exitToLessons} style={ghostBtn}>â† RETURN TO LESSONS</button>
        </div>
      </div>
    )
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  RENDER â€” Lesson list
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
            <span style={{ fontSize: 26 }}>ðŸ¤–</span>
            <div>
              <div style={{ color: C.accent, fontWeight: 800, fontSize: 15, letterSpacing: 2 }}>MR. SLATE V1</div>
              <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2 }}>SKILLS &amp; PRACTICE COACH</div>
            </div>
          </div>
          <button onClick={exitToLessons} style={ghostBtn}>â† BACK</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, padding: '24px 16px', maxWidth: 680, margin: '0 auto', width: '100%' }}>
          {availableLessons.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 60 }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>ðŸ“­</div>
              <div style={{ color: C.muted, fontSize: 14, letterSpacing: 1 }}>NO DRILL LESSONS AVAILABLE</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Complete a lesson with Ms. Sonoma first, then come back to practice.</div>
            </div>
          ) : (
            <>
              <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 16 }}>
                SELECT A LESSON TO DRILL â€” {availableLessons.length} AVAILABLE
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {availableLessons.map((lesson, i) => {
                  const lk = lesson.lessonKey || `${lesson.subject || 'general'}/${lesson.file || ''}`
                  const mastered = !!(masteryMap[lk]?.mastered)
                  const poolSize = buildPool(lesson).length
                  const subjectLabel = (lesson.subject || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  const gradeLabel = lesson.grade ? `Grade ${lesson.grade}` : ''
                  const diffLabel = lesson.difficulty ? lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1) : ''
                  return (
                    <button
                      key={lk || i}
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
                        transition: 'border-color 0.2s',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                          {mastered && <span style={{ color: C.green, marginRight: 6 }}>ðŸ¤–</span>}
                          {lesson.title || lk}
                        </div>
                        <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1 }}>
                          {[subjectLabel, gradeLabel, diffLabel].filter(Boolean).join(' Â· ')}
                          {' Â· '}<span style={{ color: mastered ? C.green : C.accent }}>{poolSize} QUESTIONS</span>
                          {mastered && <span style={{ color: C.green, marginLeft: 8 }}>âœ“ MASTERED</span>}
                        </div>
                      </div>
                      <div style={{ color: C.accent, fontWeight: 800, fontSize: 18, flexShrink: 0 }}>â–¶</div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  RENDER â€” Ready (pre-drill intro screen)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (pagePhase === 'ready') {
    const mastered = !!(masteryMap[lessonKeyRef.current]?.mastered)
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 500, width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 80, marginBottom: 8, lineHeight: 1 }}>ðŸ¤–</div>
          <div style={{ color: C.accent, fontWeight: 800, fontSize: 22, letterSpacing: 3, marginBottom: 2 }}>MR. SLATE V1</div>
          <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 28 }}>SKILLS &amp; PRACTICE COACH</div>

          {/* Lesson info panel */}
          <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2, marginBottom: 4 }}>LESSON LOADED</div>
            <div style={{ color: C.text, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{lessonTitle}</div>
            <div style={{ color: C.muted, fontSize: 12 }}>{pool.length} DRILL QUESTIONS AVAILABLE IN POOL</div>
          </div>

          {/* Previous mastery badge */}
          {mastered && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: 8, padding: '10px 16px', marginBottom: 20, color: C.green }}>
              <span style={{ fontSize: 18 }}>ðŸ¤–</span>
              <span style={{ fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>MASTERY PREVIOUSLY CONFIRMED</span>
            </div>
          )}

          {/* Rules */}
          <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.9, marginBottom: 28, textAlign: 'left', background: C.bg, borderRadius: 8, padding: '12px 16px', border: `1px solid ${C.border}` }}>
            <div style={{ color: C.text, fontWeight: 700, marginBottom: 6, letterSpacing: 1 }}>RULES:</div>
            <div>Goal: reach <span style={{ color: C.text, fontWeight: 700 }}>10 points</span></div>
            <div>Correct within timer â†’ <span style={{ color: C.green, fontWeight: 700 }}>+1</span></div>
            <div>Wrong answer â†’ <span style={{ color: C.red, fontWeight: 700 }}>âˆ’1</span> (minimum 0)</div>
            <div>Timeout ({QUESTION_SECONDS}s) â†’ <span style={{ color: C.yellow, fontWeight: 700 }}>Â±0</span></div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={startDrill} style={primaryBtn}>
              â–¶ COMMENCE DRILL
            </button>
            <button onClick={backToList} style={ghostBtn}>
              â† LESSON LIST
            </button>
          </div>
        </div>
      </div>
    )
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  RENDER â€” Won
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  if (pagePhase === 'won') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ maxWidth: 540, width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: 96, lineHeight: 1, marginBottom: 12 }}>ðŸ¤–</div>
          <div style={{ color: C.green, fontWeight: 900, fontSize: 26, letterSpacing: 4, marginBottom: 4 }}>
            MASTERY CONFIRMED
          </div>
          <div style={{ color: C.muted, fontSize: 12, letterSpacing: 2, marginBottom: 28 }}>DRILL SEQUENCE COMPLETE</div>

          <div style={{ background: C.surface, border: `1px solid ${C.green}`, borderRadius: 12, padding: 28, marginBottom: 24 }}>
            <ScorePips score={SCORE_GOAL} goal={SCORE_GOAL} />
            <div style={{ color: C.text, fontWeight: 700, fontSize: 16, marginTop: 14 }}>{lessonTitle}</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{qCount} QUERIES PROCESSED TO REACH MASTERY</div>
          </div>

          <div style={{ color: C.muted, fontSize: 12, letterSpacing: 1, marginBottom: 28 }}>
            ðŸ¤– MASTERY ICON WILL APPEAR ON YOUR LESSON CARD.
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={startDrill} style={ghostBtn}>DRILL AGAIN</button>
            <button onClick={backToList} style={ghostBtn}>LESSON LIST</button>
            <button onClick={exitToLessons} style={primaryBtn}>â† BACK TO LESSONS</button>
          </div>
        </div>
      </div>
    )
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  //  RENDER â€” Asking / Feedback (main drill screen)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  const q = currentQ
  const isAsking = pagePhase === 'asking'
  const isFeedback = pagePhase === 'feedback'

  const borderColor = isFeedback && lastResult
    ? (lastResult.correct ? C.green : lastResult.timeout ? C.yellow : C.red)
    : C.border

  return (
    <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

      {/* â”€â”€ Header bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
          <span style={{ fontSize: 22 }}>ðŸ¤–</span>
          <div style={{ minWidth: 0 }}>
            <div style={{ color: C.accent, fontWeight: 800, fontSize: 13, letterSpacing: 2 }}>MR. SLATE</div>
            <div style={{ color: C.muted, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '22ch' }}>{lessonTitle}</div>
          </div>
        </div>

        <ScorePips score={score} />

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setSoundOn(v => !v)}
            title={soundOn ? 'Mute voice' : 'Unmute voice'}
            style={soundBtn}
          >
            {soundOn ? 'ðŸ”Š' : 'ðŸ”‡'}
          </button>
          <button onClick={backToList} style={ghostBtn}>LIST</button>
          <button onClick={exitToLessons} style={dangerBtn}>EXIT</button>
        </div>
      </div>

      {/* â”€â”€ Main drill area â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>

          {/* Robot avatar */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 72, lineHeight: 1, userSelect: 'none' }}>ðŸ¤–</div>
          </div>

          {/* Question card */}
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
                QUERY #{qCount + (isAsking ? 1 : 0)} Â· {q.type.toUpperCase()}
              </div>

              {/* Question text */}
              <div style={{ color: C.text, fontSize: 'clamp(15px,2.8vw,20px)', fontWeight: 600, marginBottom: 20, lineHeight: 1.55 }}>
                {q.question}
              </div>

              {/* Countdown timer â€” only while asking */}
              {isAsking && <TimerBar secondsLeft={secondsLeft} total={QUESTION_SECONDS} />}

              {/* â”€â”€ Multiple choice â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

              {/* â”€â”€ True / False â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

              {/* â”€â”€ Short answer / Fill in the blank â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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

              {/* â”€â”€ Feedback panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
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
                    {lastResult.correct ? 'âœ“ ' : lastResult.timeout ? 'â° ' : 'âœ— '}
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

// â”€â”€â”€ Page root with Suspense â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

