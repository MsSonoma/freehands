'use client'

/**
 * Mr. Slate -- Skills & Practice Coach
 *
 * A mastery-aware drill session. Points pace the learner experience only;
 * canonical mastery and retention come from append-only shared evidence.
 *
 * Rules:
 *   - Correct answer within time limit  -> +1 (min 0, max 10)
 *   - Wrong answer                      -> -1 (min 0)
 *   - Timeout (15s default)             -> +/-0
 *   - Reach 10 -> drill complete (never automatic mastery)
 *
 * Questions rotate through the full pool without repeats until ~80% have
 * been asked, then the deck reshuffles.
 *
 * Lessons are loaded from /api/learner/available-lessons (handles static,
 * generated, and Supabase-stored lessons uniformly). No URL params required.
 */

import { Suspense, useState, useEffect, useRef, useCallback, forwardRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCanonicalMasteryForLearner } from '@/app/lib/masteryClient'
import { updateTranscriptLiveSegment } from '@/app/lib/transcriptsClient'
import { requestFacilitatorPinException } from '@/app/lib/pinGate'
import { authorizeProtectedOccurrence } from '@/app/lib/syllabus/executionClient'
import SlateReviewExperience from './SlateReviewExperience'
import { MasteryEvidenceClient } from '@/app/lib/masteryEvidence/client.js'
import { STAGE_6_EVIDENCE_EVENT_TYPES } from '@/app/lib/masteryEvidence/constants.js'
import { buildItemIdentity } from '@/app/lib/masteryEvidence/identity.js'
import { analyzeAssessmentIsolation, ASSESSMENT_ISOLATION_STATUSES } from '@/app/lib/masteryEvidence/assessmentIsolation.js'
import { buildRecoveryTeachingPayload, INDEPENDENT_MASTERY_PROTOCOL_VERSION, MASTERY_OUTCOMES } from '@/app/lib/masteryEvidence/mastery.js'
import {
  SLATE_PROTOCOL_VERSION,
  SLATE_RUN_PURPOSES,
  buildSlatePool,
  classifySlateMasteryResponse,
  createSlateRunState,
  markSlateRecoveryCompleted,
  markSlateRecoveryStarted,
  pointGoalMessage,
  slateCompletionAudioOptions,
  slateRunPurpose,
} from '@/app/lib/slateLearningModel.mjs'

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
const SLATE_VIDEO_SRC = '/media/Mr.%20Slate%20Suit.mp4'

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
  return buildSlatePool(lessonData, SLATE_RUN_PURPOSES.PRACTICE)
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

/** Sync local judge — used for MC/TF and as the SA/FIB fallback. */
function checkAnswerLocal(q, raw) {
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

/**
 * Async answer judge.
 * MC/TF: local, synchronous.
 * SA/FIB: calls /api/judge-short-answer (GPT, same as Ms. Sonoma).
 *         Falls back to local judge if the API is unavailable.
 */
async function checkAnswer(q, raw) {
  if (!q) return false
  const type = (q.type || '').toLowerCase()
  if (type === 'multiplechoice' || type === 'truefalse') return checkAnswerLocal(q, raw)

  // Short-answer / fill-in-the-blank → GPT judge
  const learnerAnswer = String(raw || '').trim()
  if (!learnerAnswer) return false

  const questionText = String(q.question || q.prompt || '').trim()
  const expectedAny = Array.isArray(q.expectedAny) ? q.expectedAny : []
  const expectedAnswer = String(expectedAny[0] || q.answer || q.expected || '').trim()
  const keywords = Array.isArray(q.keywords) ? q.keywords : []
  const minKeywords = Number.isInteger(q.minKeywords) ? q.minKeywords : (keywords.length > 0 ? 1 : 0)

  const MAX_ATTEMPTS = 3
  const TIMEOUT_MS = 5000
  const RETRY_MS = 2000
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    try {
      const res = await fetch('/api/judge-short-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: questionText, learnerAnswer, expectedAnswer, expectedAny, keywords, minKeywords }),
        signal: ctrl.signal,
      })
      clearTimeout(tid)
      if (!res.ok) throw new Error(`judge ${res.status}`)
      const data = await res.json()
      if (typeof data?.correct === 'boolean') return data.correct
      throw new Error('unexpected shape')
    } catch {
      clearTimeout(tid)
      if (attempt < MAX_ATTEMPTS) await new Promise(r => setTimeout(r, RETRY_MS))
    }
  }
  // API unavailable — fall back to local judge
  return checkAnswerLocal(q, raw)
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

async function playSlateAudio(text, audioEl, videoEl, onDone, isSpeakingRef, muted = false) {
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
    audioEl.muted = muted
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
  const searchParams = useSearchParams()
  const routeLearnerId = searchParams?.get('learnerId') || ''
  const routeOccurrenceId = searchParams?.get('occurrenceId') || ''
  const routeRunPurpose = slateRunPurpose(searchParams?.get('purpose'))

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
  const [historyLessons, setHistoryLessons] = useState({})
  const [listError, setListError] = useState('')
  const [settings, setSettings] = useState(DEFAULT_SLATE_SETTINGS)
  const [isJudging, setIsJudging] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SLATE_SETTINGS)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [drillTranscript, setDrillTranscript] = useState([])
  const drillTranscriptRef = useRef([])
  const slateSessionStartRef = useRef(null) // ISO timestamp set when drill starts
  const [txStatus, setTxStatus] = useState(null) // null | 'saving' | 'ok' | 'failed'
  const [, setEvidenceStatus] = useState('unavailable')
  const [completionMessage, setCompletionMessage] = useState('Drill complete.')
  const [offerResume, setOfferResume] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      const raw = localStorage.getItem('slate_session')
      return !!(raw && JSON.parse(raw)?.lessonData)
    } catch { return false }
  })

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
  const authorizedOccurrenceRef = useRef('')
  const evidenceClientRef = useRef(null)
  const isolationRef = useRef(null)
  const runStateRef = useRef(createSlateRunState(routeRunPurpose))
  const currentExposureRef = useRef(null)
  const exposureSequenceRef = useRef(0)
  const presentedItemIdsRef = useRef(new Set())
  const priorExposedKeysRef = useRef(new Set())
  const latestMasteryOutcomeRef = useRef(null)

  const timerInterval = useRef(null)
  const feedbackTimeout = useRef(null)
  const audioEl = useRef(null)
  const inputEl = useRef(null)
  const slateVideoRef = useRef(null)
  const slateIsSpeakingRef = useRef(false)
  const isJudgingRef = useRef(false)
  const consecutiveTimeoutsRef = useRef(0)
  const settingsRef = useRef(DEFAULT_SLATE_SETTINGS)

  // Keep fast refs in sync
  useEffect(() => { soundRef.current = soundOn }, [soundOn])
  useEffect(() => { learnerIdRef.current = learnerId }, [learnerId])
  useEffect(() => { settingsRef.current = settings }, [settings])

  // ── Save drill transcript to Supabase when lesson is won ───────────────
  useEffect(() => {
    if (pagePhase !== 'won') return
    const lid = learnerId
    const lk = lessonKeyRef.current
    if (!lid) { console.warn('[Slate] Transcript skip: no learnerId'); return }
    if (lid === 'demo') return
    if (!lk) { console.warn('[Slate] Transcript skip: no lessonKey'); return }
    if (!drillTranscriptRef.current.length) { console.warn('[Slate] Transcript skip: drillTranscript is empty'); return }
    const lines = drillTranscriptRef.current.flatMap(e => {
      const rows = [
        { role: 'assistant', text: `Q${e.num}: ${e.question}` },
        { role: 'user', text: e.timeout ? '(time out)' : (String(e.answer || '').trim() || '(no answer)') },
      ]
      if (!e.correct && e.correctAnswer) {
        rows.push({ role: 'assistant', text: `Correct answer: ${e.correctAnswer}` })
      }
      return rows
    })
    const lessonTitle = lessonData?.title || lk
    const learnerNameVal = (() => { try { return localStorage.getItem('learner_name') || '' } catch { return '' } })()
    setTxStatus('saving')
    updateTranscriptLiveSegment({
      learnerId: lid,
      learnerName: learnerNameVal,
      lessonId: lk,
      lessonTitle,
      startedAt: slateSessionStartRef.current || new Date().toISOString(),
      lines,
      teacher: 'slate',
    }).then(r => {
      if (r?.ok) {
        setTxStatus('ok')
      } else {
        console.error('[Slate] Transcript save failed:', r?.reason, r?.error)
        setTxStatus('failed')
      }
    }).catch(e => {
      console.error('[Slate] Transcript save error:', e)
      setTxStatus('failed')
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagePhase])

  // Load learner + mastery + available lessons
  useEffect(() => {
    if (typeof window === 'undefined') return
    const id = localStorage.getItem('learner_id')
    setLearnerId(id)
    if (id) {
      getCanonicalMasteryForLearner(id).then(setMasteryMap).catch(() => setMasteryMap({}))
      learnerIdRef.current = id
      if (!id || id === 'demo') {
        // No pending lesson key for demo — go to list (redirect handled below)
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
        .then(([availRes, settingsRes, historyRes]) => {
          const { lessons = [], staleApprovedKeys = [] } = availRes || {}
          const drillable = (lessons || []).filter(l => buildPool(l).length > 0)
          setAvailableLessons(drillable)
          setAllOwnedLessons(lessons || [])
          if (settingsRes?.settings) {
            const merged = { ...DEFAULT_SLATE_SETTINGS, ...settingsRes.settings }
            setSettings(merged)
            setSettingsDraft(merged)
            settingsRef.current = merged
          }

          // Build the key set that available-lessons already resolved
          const approvedKeySet = new Set(
            (lessons || []).map(l => l.lessonKey || `${l.subject || 'general'}/${l.file || ''}`)
          )

          // Collect history session lesson_ids
          const seen = new Map()
          if (historyRes?.sessions) {
            const completed = historyRes.sessions
              .filter(s => s.status === 'completed' && s.lesson_id && s.ended_at)
            for (const s of completed) {
              const existing = seen.get(s.lesson_id)
              if (!existing || new Date(s.ended_at) > new Date(existing.ended_at)) {
                seen.set(s.lesson_id, s)
              }
            }
            setRecentSessions([...seen.values()].sort((a, b) => new Date(b.ended_at) - new Date(a.ended_at)))
          }

          // Fetch full lesson data for:
          //   1. history lesson_ids not in the loaded approved set
          //   2. staleApprovedKeys — keys that were in approved_lessons but files couldn't be
          //      found by available-lessons (now we retry via /api/lessons/meta which handles
          //      generated lessons stored in Supabase Storage)
          const historyMissing = [...seen.keys()].filter(k => !approvedKeySet.has(k))
          const staleSet = new Set(staleApprovedKeys || [])
          const metaKeys = [...new Set([...historyMissing, ...staleSet])]
          if (metaKeys.length) {
            fetch('/api/lessons/meta', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keys: metaKeys, learner_id: id }),
            }).then(r => r.ok ? r.json() : null).then(res => {
              if (res?.lessons?.length) {
                const map = {}
                for (const l of res.lessons) map[l.lessonKey] = l
                setHistoryLessons(map)
              }
            }).catch(() => {})
          }

          // Check for a pending mastery lesson key.
          // Only auto-start if there is no saved session to resume — if offerResume is
          // true we fall through to the overlay so the user can choose resume vs new.
          const pendingKey = (() => { try { return sessionStorage.getItem('slate_pending_lesson_key') } catch { return null } })()
          const hasSavedSession = (() => { try { return !!(localStorage.getItem('slate_session') && JSON.parse(localStorage.getItem('slate_session'))?.lessonData) } catch { return false } })()
          if (pendingKey && !hasSavedSession) {
            const allLessons = lessons || []
            const match = allLessons.find(l => (l.lessonKey || `${l.subject || 'general'}/${l.file || ''}`) === pendingKey)
            if (match && buildPool(match).length > 0) {
              try { sessionStorage.removeItem('slate_pending_lesson_key') } catch {}
              // Auto-start drill with the pending lesson
              selectLesson(match)
              return
            }
            try { sessionStorage.removeItem('slate_pending_lesson_key') } catch {}
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

  // Redirect to the canonical learner home when in list phase with no resume offer.
  useEffect(() => {
    if (pagePhase === 'list' && !offerResume) {
      router.replace('/learn')
    }
  }, [pagePhase, offerResume, router])

  const recordQuestionPresented = useCallback((q) => {
    if (!q) return
    exposureSequenceRef.current += 1
    const stableLocalId = String(q.id || q.question || 'item')
    const preExposed = presentedItemIdsRef.current.has(stableLocalId)
    presentedItemIdsRef.current.add(stableLocalId)
    const exposureId = `slate-exposure:${exposureSequenceRef.current}:${stableLocalId}`
    currentExposureRef.current = { id: exposureId, preExposed }
    evidenceClientRef.current?.recordItemPresented({
      phase: runStateRef.current.runPurpose,
      itemId: q.id || null,
      itemPurpose: q.sourceRole || runStateRef.current.runPurpose,
      itemExposureId: exposureId,
      identityItem: q,
      assessmentRole: q.assessmentRole,
      evidencePurpose: runStateRef.current.runPurpose,
      item: { question: q.question, type: q.type },
    })
  }, [])

  // Select a lesson from the list — skip the ready screen, go straight to drilling
  const selectLesson = useCallback(async (lesson) => {
    clearInterval(timerInterval.current)
    clearTimeout(feedbackTimeout.current)
    const p = buildSlatePool(lesson, routeRunPurpose)
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
    const lk = lesson.lessonKey || `${lesson.subject || 'general'}/${lesson.file || ''}`
    let activityAuthorization = null
    try {
      const authorization = await authorizeProtectedOccurrence({
        learnerId: routeLearnerId || learnerIdRef.current,
        lessonKey: lk,
        occurrenceId: routeOccurrenceId,
        requestPin: requestFacilitatorPinException,
      })
      authorizedOccurrenceRef.current = authorization.occurrenceId
      activityAuthorization = authorization
    } catch (cause) {
      setErrorMsg(cause?.message || 'This Syllabus practice occurrence is not authorized.')
      phaseRef.current = 'error'
      setPagePhase('error')
      return
    }
    const isolation = await analyzeAssessmentIsolation({
      lessonKey: lk,
      lessonId: lesson.id || lesson.lessonId || lk,
      lessonData: lesson,
      phaseSets: {
        discussion: lesson.discussion || [], comprehension: lesson.comprehension || [],
        exercise: lesson.exercise || [], worksheet: buildPool(lesson),
      },
    })
    isolationRef.current = isolation
    runStateRef.current = createSlateRunState(routeRunPurpose)
    priorExposedKeysRef.current = new Set()
    presentedItemIdsRef.current = new Set()
    latestMasteryOutcomeRef.current = null
    const activityId = `slate:${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`
    const evidenceClient = new MasteryEvidenceClient()
    evidenceClientRef.current = evidenceClient
    const initialized = await evidenceClient.initialize({
      sessionId: activityId,
      browserSessionId: activityId,
      learnerId: routeLearnerId || learnerIdRef.current,
      lessonKey: lk,
      lessonId: lesson.id || lesson.lessonId || lk,
      lessonData: lesson,
      assessmentIsolation: isolation,
      mastery: { protocolVersion: INDEPENDENT_MASTERY_PROTOCOL_VERSION },
      teachingProtocol: { protocolVersion: SLATE_PROTOCOL_VERSION, protocolHash: null },
      activityAuthorization: { occurrenceId: activityAuthorization?.occurrenceId || null },
    })
    setEvidenceStatus(initialized?.status || 'unavailable')
    if (initialized?.ok) {
      await evidenceClient.recordSessionStarted({ initialPhase: routeRunPurpose })
      if (routeRunPurpose === SLATE_RUN_PURPOSES.MASTERY) {
        const identities = await Promise.all(p.map((item) => buildItemIdentity({ lessonKey: lk, lessonId: lesson.id || lk, lessonData: lesson, item })))
        const prior = await evidenceClient.checkPriorExposure({ learnerId: routeLearnerId || learnerIdRef.current, itemIdentities: identities })
        priorExposedKeysRef.current = new Set(prior?.exposedKeys || [])
      }
    }
    poolRef.current = p
    setPool(p)
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
      recordQuestionPresented(q)
      setUserAnswer('')
      setLastResult(null)
      setSecondsLeft(settingsRef.current.questionSecs)
      phaseRef.current = 'asking'
      setPagePhase('asking')
      setTimeout(() => inputEl.current?.focus?.(), 80)
      setTimeout(() => {
        const m = !soundRef.current
        playSlateAudio(pick(GREETING_MSGS), audioEl.current, slateVideoRef.current, () => {
          playSlateAudio(q.question, audioEl.current, slateVideoRef.current, undefined, slateIsSpeakingRef, !soundRef.current)
        }, slateIsSpeakingRef, m)
      }, 120)
    }
  }, [recordQuestionPresented, routeLearnerId, routeOccurrenceId, routeRunPurpose])

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
      if (runStateRef.current.recoveryNeeded) {
        return newDeck.find((item) => String(item.id || item.question) !== String(currentQRef.current?.id || currentQRef.current?.question)) || newDeck[0]
      }
      return newDeck[0]
    }
    deckIdxRef.current = idx + 1
    if (runStateRef.current.recoveryNeeded) {
      for (let offset = idx; offset < cur.length; offset += 1) {
        if (String(cur[offset]?.id || cur[offset]?.question) !== String(currentQRef.current?.id || currentQRef.current?.question)) {
          deckIdxRef.current = offset + 1
          return cur[offset]
        }
      }
    }
    return cur[idx]
  }, [])

  // Display a question
  const showQuestion = useCallback((q, skipAudio = false) => {
    isJudgingRef.current = false
    setIsJudging(false)
    currentQRef.current = q
    setCurrentQ(q)
    recordQuestionPresented(q)
    setUserAnswer('')
    setLastResult(null)
    setSecondsLeft(settingsRef.current.questionSecs)
    phaseRef.current = 'asking'
    setPagePhase('asking')
    setTimeout(() => inputEl.current?.focus?.(), 80)
    if (!skipAudio) setTimeout(() => playSlateAudio(q.question, audioEl.current, slateVideoRef.current, undefined, slateIsSpeakingRef, !soundRef.current), 120)
  }, [recordQuestionPresented])

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
    drillTranscriptRef.current = []
    slateSessionStartRef.current = new Date().toISOString()
    setDrillTranscript([])
    setTxStatus(null)
    const q = advanceDeck()
    if (q) {
      showQuestion(q, true) // skipAudio — we chain greeting → question ourselves
      setTimeout(() => {
        const m = !soundRef.current
        playSlateAudio(pick(GREETING_MSGS), audioEl.current, slateVideoRef.current, () => {
          playSlateAudio(q.question, audioEl.current, slateVideoRef.current, undefined, slateIsSpeakingRef, !soundRef.current)
        }, slateIsSpeakingRef, m)
      }, 120)
    }
  }, [advanceDeck, showQuestion])

  const recordSlateResponse = useCallback(async ({ q, correct, timeout, rawAnswer, correctAnswer }) => {
    const client = evidenceClientRef.current
    const exposure = currentExposureRef.current
    if (!client || !q || !exposure?.id) return { ok: false, status: 'unavailable' }
    const common = {
      phase: runStateRef.current.runPurpose,
      itemId: q.id || null,
      itemPurpose: q.sourceRole || runStateRef.current.runPurpose,
      itemExposureId: exposure.id,
      identityItem: q,
      assessmentRole: q.assessmentRole,
      evidencePurpose: runStateRef.current.runPurpose,
      attemptNumber: 1,
      isFirstResponse: true,
    }
    const responseWrite = await client.recordLearnerResponse({ ...common, response: timeout ? null : rawAnswer, responseType: timeout ? 'timeout' : q.type })
    const evaluationWrite = await client.recordAnswerEvaluated({
      ...common, isCorrect: correct === true && !timeout, response: timeout ? null : rawAnswer,
      correctAnswer, evaluationMode: q.type === 'shortanswer' || q.type === 'fillintheblank' ? 'semantic_or_local_fallback' : 'deterministic',
    })
    let masteryWrite = null
    if ([SLATE_RUN_PURPOSES.MASTERY, SLATE_RUN_PURPOSES.RECOVERY].includes(runStateRef.current.runPurpose)) {
      const identity = await buildItemIdentity({
        lessonKey: lessonKeyRef.current, lessonId: lessonKeyRef.current,
        lessonData: client.meta?.lessonData, item: q,
      })
      const classification = classifySlateMasteryResponse({
        runState: runStateRef.current,
        itemIdentity: identity,
        itemExposureId: exposure.id,
        isCorrect: correct === true && !timeout,
        priorExposedKeys: priorExposedKeysRef.current,
        preAssessmentExposed: exposure.preExposed,
        assessmentIsolationStatus: isolationRef.current?.status || ASSESSMENT_ISOLATION_STATUSES.UNAVAILABLE,
      })
      if (classification.masteryOutcome) {
        masteryWrite = await client.recordMasteryCheckResult({
          ...common,
          isCorrect: correct === true && !timeout,
          masteryCheckRole: classification.checkRole,
          independenceStatus: classification.qualification?.independenceStatus,
          independenceReason: classification.qualification?.independenceReason,
          masteryOutcome: classification.masteryOutcome,
          response: timeout ? null : rawAnswer,
          correctAnswer,
          qualification: { ...classification.qualification, slate_run_purpose: runStateRef.current.runPurpose },
        })
        if (classification.masteryOutcome === MASTERY_OUTCOMES.NEEDS_RECOVERY) {
          runStateRef.current = {
            ...runStateRef.current,
            recoveryNeeded: true,
            recoveryStarted: false,
            recoveryCompleted: false,
          }
          latestMasteryOutcomeRef.current = null
        }
        if ([MASTERY_OUTCOMES.INDEPENDENT_SUCCESS, MASTERY_OUTCOMES.INDEPENDENT_SUCCESS_AFTER_RECOVERY].includes(classification.masteryOutcome) && masteryWrite?.ok) {
          latestMasteryOutcomeRef.current = classification.masteryOutcome
          runStateRef.current = {
            ...runStateRef.current,
            recoveryNeeded: false,
            recoveryStarted: false,
            recoveryCompleted: false,
          }
        }
      }
    }
    let revealWrite = null
    if (!correct && correctAnswer) {
      revealWrite = await client.recordAnswerRevealed({ ...common, correctAnswer, revealSource: timeout ? 'slate_timeout_teaching' : 'slate_correction' })
    }
    const writesBeforeRecovery = responseWrite?.ok && evaluationWrite?.ok && (!masteryWrite || masteryWrite.ok) && (!revealWrite || revealWrite.ok)
    let recoveryContext = null
    if (writesBeforeRecovery && masteryWrite?.ok && runStateRef.current.recoveryNeeded && correctAnswer) {
      const teachingPayload = buildRecoveryTeachingPayload({
        lessonData: client.meta?.lessonData,
        failedItem: q,
        learnerResponse: timeout ? null : rawAnswer,
        correctAnswer,
        recoveryMode: 'slate_spoken_correction',
      })
      const recoveryStartedWrite = await client.recordInteractionEvent({
        eventType: STAGE_6_EVIDENCE_EVENT_TYPES.RECOVERY_STARTED,
        ...common,
        suffix: `${exposure.id}:recovery-started`,
        payload: { ...teachingPayload, timeout: timeout === true },
      })
      runStateRef.current = markSlateRecoveryStarted(runStateRef.current, recoveryStartedWrite?.ok === true)
      if (recoveryStartedWrite?.ok) recoveryContext = { common, teachingPayload, timeout }
    }
    const ok = writesBeforeRecovery && (!runStateRef.current.recoveryNeeded || runStateRef.current.recoveryStarted)
    return { ok, status: ok ? client.status : 'partial', recoveryStarted: !!recoveryContext, recoveryContext }
  }, [])

  const completeSlateRecovery = useCallback(async (context) => {
    if (!context || !runStateRef.current.recoveryStarted) return false
    const write = await evidenceClientRef.current?.recordInteractionEvent({
      eventType: STAGE_6_EVIDENCE_EVENT_TYPES.RECOVERY_COMPLETED,
      ...context.common,
      suffix: `${context.common.itemExposureId}:recovery-completed`,
      payload: { ...context.teachingPayload, timeout: context.timeout === true, completion: 'spoken_correction_completed' },
    })
    runStateRef.current = markSlateRecoveryCompleted(runStateRef.current, write?.ok === true)
    return write?.ok === true
  }, [])

  // Handle answer result (correct / wrong / timeout)
  const handleResult = useCallback((correct, timeout = false, rawAnswer = '') => {
    clearInterval(timerInterval.current)
    isJudgingRef.current = false
    setIsJudging(false)
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

    // Build transcript entry
    if (q) {
      const entry = {
        num: drillTranscriptRef.current.length + 1,
        question: q.question,
        type: q.type,
        answer: rawAnswer,
        correctAnswer: getCorrectText(q),
        correct,
        timeout,
      }
      drillTranscriptRef.current = [...drillTranscriptRef.current, entry]
      setDrillTranscript([...drillTranscriptRef.current])
    }

    const msgs = timeout ? TIMEOUT_MSGS : correct ? CORRECT_MSGS : WRONG_MSGS
    const feedbackText = pick(msgs)
    const correctAnswer = !correct && q ? getCorrectText(q) : ''
    const evidenceWrite = recordSlateResponse({ q, correct, timeout, rawAnswer, correctAnswer })
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
      feedbackTimeout.current = setTimeout(async () => {
        await evidenceWrite
        const finalized = await evidenceClientRef.current?.recordSessionEnded({ reason: 'drill_goal_reached' })
        const finalEvidenceStatus = finalized?.status || 'unavailable'
        setEvidenceStatus(finalEvidenceStatus)
        setCompletionMessage(pointGoalMessage({ evidenceStatus: finalEvidenceStatus, masteryOutcome: latestMasteryOutcomeRef.current }))
        const completionAudioOptions = slateCompletionAudioOptions({
          evidenceStatus: finalEvidenceStatus,
          masteryOutcome: latestMasteryOutcomeRef.current,
        })
        const lid = learnerIdRef.current
        if (lid) getCanonicalMasteryForLearner(lid).then(setMasteryMap).catch(() => {})
        const doWon = () => { phaseRef.current = 'won'; setPagePhase('won') }
        playSlateAudio(pick(completionAudioOptions), audioEl.current, slateVideoRef.current, doWon, slateIsSpeakingRef, !soundRef.current)
      }, FEEDBACK_DELAY_MS)
    } else if (correctAnswer) {
      // Wrong answer: chain feedback → correct answer → advance (muted if sound off)
      // No separate timeout — audio onDone drives the transition so nothing cuts it off
      const m = !soundRef.current
      playSlateAudio(feedbackText, audioEl.current, slateVideoRef.current, () => {
        playSlateAudio(`The correct answer was ${correctAnswer}.`, audioEl.current, slateVideoRef.current, () => {
          void evidenceWrite.then((evidence) => {
            if (!evidence?.recoveryStarted) {
              feedbackTimeout.current = setTimeout(doAdvance, 600)
              return
            }
            const recoveryText = `Let us review the idea. The question was: ${q?.question || 'this item'}. The correct response is ${correctAnswer}. Connect the question to that answer before the next query.`
            setLastResult((previous) => previous ? { ...previous, recoveryText } : previous)
            playSlateAudio(recoveryText, audioEl.current, slateVideoRef.current, () => {
              void completeSlateRecovery(evidence.recoveryContext).finally(() => {
                feedbackTimeout.current = setTimeout(doAdvance, 600)
              })
            }, slateIsSpeakingRef, !soundRef.current)
          })
        }, slateIsSpeakingRef, !soundRef.current)
      }, slateIsSpeakingRef, m)
    } else {
      // Correct / timeout: play feedback (muted if sound off), then advance after delay
      playSlateAudio(feedbackText, audioEl.current, slateVideoRef.current, undefined, slateIsSpeakingRef, !soundRef.current)
      feedbackTimeout.current = setTimeout(doAdvance, FEEDBACK_DELAY_MS)
    }
  }, [advanceDeck, completeSlateRecovery, recordSlateResponse, showQuestion])

  // Countdown timer
  useEffect(() => {
    if (pagePhase !== 'asking') return
    clearInterval(timerInterval.current)
    timerInterval.current = setInterval(() => {
      if (slateIsSpeakingRef.current || isJudgingRef.current) return // pause while Slate is talking or judging
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
  const onTextSubmit = useCallback(async () => {
    if (phaseRef.current !== 'asking') return
    if (isJudgingRef.current) return  // prevent double-submit / spam
    isJudgingRef.current = true
    setIsJudging(true)
    const correct = await checkAnswer(currentQRef.current, userAnswer)
    if (phaseRef.current !== 'asking') {
      // timed out or navigated away while judge was in flight — abort silently
      isJudgingRef.current = false
      setIsJudging(false)
      return
    }
    handleResult(correct, false, userAnswer)
  }, [userAnswer, handleResult])

  // Choice click (MC / TF)
  const onChoiceClick = useCallback((value) => {
    if (phaseRef.current !== 'asking') return
    if (isJudgingRef.current) return  // prevent double-fire
    isJudgingRef.current = true
    setIsJudging(true)
    const q = currentQRef.current
    // Build human-readable label for the selected choice
    let rawAnswerLabel = String(value)
    if (q?.type === 'multiplechoice' && Array.isArray(q.choices)) {
      rawAnswerLabel = q.choices[Number(value)] ?? rawAnswerLabel
    } else if (q?.type === 'truefalse') {
      rawAnswerLabel = value === 'true' ? 'True' : 'False'
    }
    handleResult(checkAnswerLocal(q, String(value)), false, rawAnswerLabel)
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
    isJudgingRef.current = false
    setIsJudging(false)
    setScore(0)
    scoreRef.current = 0
    setQCount(0)
    setCurrentQ(null)
    setLessonData(null)
    lessonKeyRef.current = ''
    router.push('/learn')
  }, [router])

  const exitToLessons = useCallback(() => {
    clearInterval(timerInterval.current)
    clearTimeout(feedbackTimeout.current)
    router.push('/learn')
  }, [router])

  // ── Snapshot save/restore (survive navigation) ────────────────────────
  async function handleSlateResume() {
    try {
      const saved = JSON.parse(localStorage.getItem('slate_session') || 'null')
      if (!saved?.lessonData) { setOfferResume(false); return }
      // Legacy snapshots did not carry a durable evidence-session identity.
      // Restart the drill through the canonical initializer instead of letting
      // a resumed local-only score manufacture an educational claim.
      try { localStorage.removeItem('slate_session') } catch {}
      setOfferResume(false)
      await selectLesson(saved.lessonData)
    } catch (cause) {
      setErrorMsg(cause?.message || 'This Syllabus practice occurrence is not authorized.')
      phaseRef.current = 'error'
      setPagePhase('error')
    }
  }

  function handleSlateRestart() {
    try { localStorage.removeItem('slate_session') } catch {}
    // If the user arrived with a pending mastery lesson key,
    // start that lesson now instead of redirecting back to lesson selection.
    const pendingKey = (() => { try { return sessionStorage.getItem('slate_pending_lesson_key') } catch { return null } })()
    if (pendingKey) {
      try { sessionStorage.removeItem('slate_pending_lesson_key') } catch {}
      const match = availableLessons.find(l => (l.lessonKey || `${l.subject || 'general'}/${l.file || ''}`) === pendingKey)
      if (match && buildPool(match).length > 0) {
        setOfferResume(false)
        selectLesson(match)
        return
      }
    }
    setOfferResume(false)
  }

  // Save drill state after each question; clear on completion
  useEffect(() => {
    if (offerResume) return // never wipe storage while the resume prompt is showing
    if (pagePhase === 'won') {
      try { localStorage.removeItem('slate_session') } catch {}
      return
    }
    if ((pagePhase === 'asking' || pagePhase === 'feedback') && lessonData) {
      try {
        localStorage.setItem('slate_session', JSON.stringify({
          lessonData,
          lessonKey: lessonKeyRef.current,
          authorizedOccurrenceId: authorizedOccurrenceRef.current,
          score,
          qCount,
          drillTranscript: drillTranscriptRef.current,
        }))
      } catch { /* ignore quota errors */ }
    }
  }, [pagePhase, lessonData, score, qCount, drillTranscript, offerResume])

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
    // When a resume is being offered, show only the overlay over a neutral screen.
    // The lesson list is phased out; never expose it to the user.
    if (offerResume) {
      return (
        <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <audio ref={audioEl} />
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'rgba(0,0,0,0.80)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
            <div style={{
              background: '#0f172a',
              borderRadius: 18,
              width: 'min(92vw, 360px)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 2px #6366f1',
              padding: '28px 24px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
              <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Welcome back!</div>
              <div style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                You were in the middle of a drill with Mr. Slate.<br/>
                Would you like to pick up where you left off?
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button type="button" onClick={handleSlateResume}
                  style={{
                    flex: 1, background: '#6366f1', color: '#fff', border: 'none',
                    borderRadius: 10, padding: '11px 0', cursor: 'pointer',
                    fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
                  }}
                >▶ Resume</button>
                <button type="button" onClick={handleSlateRestart}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
                    border: '1px solid #334155',
                    borderRadius: 10, padding: '11px 0', cursor: 'pointer',
                    fontWeight: 700, fontSize: 15, fontFamily: 'inherit',
                  }}
                >↺ New Lesson</button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div style={{ fontFamily: C.mono, background: C.bg, height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        {/* ── Resume overlay ─────────────────────────────────────────── */}
        {offerResume && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'rgba(0,0,0,0.80)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}>
            <div style={{
              background: '#0f172a',
              borderRadius: 18,
              width: 'min(92vw, 360px)',
              boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 2px #6366f1',
              padding: '28px 24px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
              <div style={{ color: '#e2e8f0', fontWeight: 800, fontSize: 18, marginBottom: 8 }}>Welcome back!</div>
              <div style={{ color: '#94a3b8', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
                You were in the middle of a drill with Mr. Slate.<br/>
                Would you like to pick up where you left off?
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                <button type="button" onClick={handleSlateResume}
                  style={{
                    flex: 1, background: '#6366f1', color: '#fff', border: 'none',
                    borderRadius: 10, padding: '11px 0', cursor: 'pointer',
                    fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
                  }}
                >▶ Resume</button>
                <button type="button" onClick={handleSlateRestart}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,0.07)', color: '#94a3b8',
                    border: '1px solid #334155',
                    borderRadius: 10, padding: '11px 0', cursor: 'pointer',
                    fontWeight: 700, fontSize: 15, fontFamily: 'inherit',
                  }}
                >↺ New Lesson</button>
              </div>
            </div>
          </div>
        )}
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

        {/* Body — flex column so controls stay fixed and only the list scrolls */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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

            // Merge approved lessons + history-fetched metadata into one map
            const mergedMap = new Map(allOwnedLessons.map(l => [getLk(l), l]))
            Object.entries(historyLessons).forEach(([k, l]) => { if (!mergedMap.has(k)) mergedMap.set(k, l) })

            // Active: drillable lessons from approved set, not yet Slate-mastered
            const activeList = availableLessons.filter(l => !masteryMap[getLk(l)]?.mastered)

            // Recent: sessions joined to merged lesson map so all cards are real
            const recentList = recentSessions.map(s => ({ session: s, lesson: mergedMap.get(s.lesson_id) }))

            // Owned: full merged set (approved + ever-completed) with filters
            const fullOwnedLessons = [...mergedMap.values()]
            const allSubjects = [...new Set(fullOwnedLessons.map(l => l.subject).filter(s => s && s !== 'generated'))].sort()
            const allGrades = [...new Set(fullOwnedLessons.map(l => l.grade).filter(v => v != null))].sort((a, b) => Number(a) - Number(b))
            const allDiffs = [...new Set(fullOwnedLessons.map(l => l.difficulty).filter(Boolean))].sort()
            const ownedList = fullOwnedLessons.filter(l => {
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
                {/* ── Non-scrolling controls strip ───────────────────── */}
                <div style={{ flexShrink: 0, padding: '16px 16px 0', maxWidth: 680, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

                {/* Inline warning banner */}
                {listError && (
                  <div style={{ background: C.redDim, border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: C.red, fontSize: 12 }}>{listError}</span>
                    <button onClick={() => setListError('')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>✕</button>
                  </div>
                )}

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
                  <button style={tabStyle(listTab === 'active')} onClick={() => setListTab('active')}>ACTIVE</button>
                  <button style={tabStyle(listTab === 'recent')} onClick={() => setListTab('recent')}>
                    RECENT{recentList.length > 0 ? ` (${recentList.length})` : ''}
                  </button>
                  <button style={tabStyle(listTab === 'owned')} onClick={() => setListTab('owned')}>
                    OWNED{mergedMap.size > 0 ? ` (${mergedMap.size})` : ''}
                  </button>
                </div>

                {/* Owned filters + count — non-scrolling, only on Owned tab */}
                {listTab === 'owned' && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
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
                    {mergedMap.size > 0 && (
                      <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2 }}>
                        {ownedList.length} OF {mergedMap.size} OWNED LESSON{mergedMap.size !== 1 ? 'S' : ''}
                      </div>
                    )}
                  </div>
                )}
                </div>{/* end controls strip */}

                {/* ── Scrollable list ─────────────────────────────────── */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px 24px', maxWidth: 680, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
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

                {/* Owned tab — lesson cards only (filters/count are in controls strip) */}
                {listTab === 'owned' && (
                  ownedList.length === 0 ? (
                    <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 32, letterSpacing: 1 }}>NO LESSONS MATCH FILTERS</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ownedList.map((l, i) => <LessonCard key={getLk(l) || i} lesson={l} />)}
                    </div>
                  )
                )}
                </div>{/* end scrollable list */}
              </>
            )
          })()}
        </div>

        {/* Settings overlay removed — settings now configured in Facilitator > Targets */}
      </div>
    )
  }

  // ===========================================================================
  //  RENDER -- Won
  // ===========================================================================
  if (pagePhase === 'won') {
    const openTranscript = () => {
      const title = lessonTitle || 'Mr. Slate Drill'
      const date = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
      const correctCount = drillTranscript.filter(e => e.correct).length
      const wrongCount = drillTranscript.filter(e => !e.correct && !e.timeout).length
      const timeoutCount = drillTranscript.filter(e => e.timeout).length

      // Escape user-provided text for safe HTML insertion
      const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')

      const rows = drillTranscript.map((e, i) => {
        const statusColor = e.correct ? '#16a34a' : e.timeout ? '#b45309' : '#dc2626'
        const statusLabel = e.correct ? '✓ Correct' : e.timeout ? '⏱ Timeout' : '✗ Wrong'
        const answerLine = e.answer
          ? `<div class="detail">Your answer: <strong>${esc(e.answer)}</strong></div>`
          : ''
        const correctLine = !e.correct && e.correctAnswer
          ? `<div class="detail correct-ans">Correct: <strong>${esc(e.correctAnswer)}</strong></div>`
          : ''
        return `<div class="row" style="border-left-color:${statusColor}">
  <div class="row-top">
    <span class="qtext">${i + 1}. ${esc(e.question)}</span>
    <span class="status" style="color:${statusColor}">${statusLabel}</span>
  </div>${answerLine}${correctLine}
</div>`
      }).join('\n')

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>${esc(title)} — Drill Transcript</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#111;padding:24px 32px;max-width:900px;margin:0 auto;font-size:13px;line-height:1.4}
@media print{body{padding:16px 20px;max-width:none}}
.no-print{display:flex;align-items:center;gap:12px;margin-bottom:16px;padding:9px 13px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px}
.no-print button{padding:6px 16px;background:#16a34a;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.03em}
.no-print button:hover{background:#15803d}
.no-print span{font-size:11px;color:#166534}
h1{font-size:16px;font-weight:800;margin-bottom:2px}
.sub{font-size:10px;color:#6b7280;margin-bottom:10px}
.summary{display:flex;gap:16px;margin-bottom:12px;padding:8px 12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px}
.summary-item{text-align:center}
.summary-item .val{font-size:17px;font-weight:800}
.summary-item .lbl{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em}
.green{color:#16a34a}.red{color:#dc2626}.amber{color:#b45309}
h2{font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6b7280;margin-bottom:8px}
#content{column-count:2;column-gap:20px}
.row{border-left:3px solid #e5e7eb;padding:5px 8px;margin-bottom:6px;break-inside:avoid;-webkit-column-break-inside:avoid}
.row-top{display:flex;justify-content:space-between;align-items:flex-start;gap:6px}
.qtext{font-weight:600;flex:1;line-height:1.35}
.status{font-weight:700;white-space:nowrap;flex-shrink:0;font-size:.85em}
.detail{margin-top:2px;font-size:.85em;color:#374151}
.correct-ans{color:#1d4ed8}
@media print{.no-print{display:none!important}}
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()">🖨 Print Transcript</button>
  <span>Tip: Set margins to &ldquo;Minimum&rdquo; in print settings to save paper.</span>
</div>
<h1>🤖 ${esc(title)}</h1>
<div class="sub">Mr. Slate Drill Transcript &mdash; ${esc(date)}</div>
<div class="summary">
  <div class="summary-item"><div class="val green">${correctCount}</div><div class="lbl">Correct</div></div>
  <div class="summary-item"><div class="val red">${wrongCount}</div><div class="lbl">Wrong</div></div>
  <div class="summary-item"><div class="val amber">${timeoutCount}</div><div class="lbl">Timeout</div></div>
  <div class="summary-item"><div class="val">${drillTranscript.length}</div><div class="lbl">Total</div></div>
</div>
<h2>Questions &amp; Answers</h2>
<div id="content">
${rows}
</div>
<script>
(function(){
  // With 2 columns, the column content is compressed vertically, so we measure
  // document.body.scrollHeight (full page height including header) against a
  // 2-page budget: 2 * ~960px usable (letter at 96dpi with 0.5in margins) = ~1920px.
  // Use 1800 as a slightly conservative target to account for the header block.
  var TARGET = 1800;
  var MIN_FS = 7;
  var fs = 13; // matches base font-size above
  while (document.body.scrollHeight > TARGET && fs > MIN_FS) {
    fs -= 0.5;
    document.body.style.fontSize = fs + 'px';
  }
})();
</script>
</body>
</html>`

      const win = window.open('', '_blank')
      if (!win) return
      win.document.write(html)
      win.document.close()
      win.focus()
    }

    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ maxWidth: 540, width: '100%', textAlign: 'center' }}>
          <div style={{ marginBottom: 12 }}>
            <SlateVideo size={120} />
          </div>
          <div style={{ color: C.green, fontWeight: 900, fontSize: 26, letterSpacing: 4, marginBottom: 4 }}>
            DRILL COMPLETE
          </div>
          <div style={{ color: C.muted, fontSize: 12, letterSpacing: 2, marginBottom: 28 }}>DRILL SEQUENCE COMPLETE</div>

          <div style={{ background: C.surface, border: `1px solid ${C.green}`, borderRadius: 12, padding: 28, marginBottom: 24 }}>
            <ScorePips score={settings.scoreGoal} goal={settings.scoreGoal} />
            <div style={{ color: C.text, fontWeight: 700, fontSize: 16, marginTop: 14 }}>{lessonTitle}</div>
            <div style={{ color: C.muted, fontSize: 12, marginTop: 4 }}>{qCount} QUERIES PROCESSED</div>
          </div>

          <div style={{ color: C.muted, fontSize: 12, letterSpacing: 1, marginBottom: txStatus ? 8 : 28 }}>
            {completionMessage}
          </div>
          {txStatus && (
            <div style={{ fontSize: 11, letterSpacing: 1, marginBottom: 28, color: txStatus === 'ok' ? C.green : txStatus === 'failed' ? '#ef4444' : C.muted }}>
              {txStatus === 'saving' && '⏳ SAVING TRANSCRIPT…'}
              {txStatus === 'ok' && '✓ TRANSCRIPT SAVED'}
              {txStatus === 'failed' && '⚠ TRANSCRIPT SAVE FAILED — CHECK CONSOLE'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={() => selectLesson(lessonData)} style={ghostBtn}>DRILL AGAIN</button>
            <button onClick={backToList} style={ghostBtn}>LESSON LIST</button>
            {drillTranscript.length > 0 && (
              <button onClick={openTranscript} style={ghostBtn}>TRANSCRIPT</button>
            )}
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
            onClick={() => setSoundOn(v => {
              const next = !v
              soundRef.current = next
              if (audioEl.current) audioEl.current.muted = !next
              return next
            })}
            title={soundOn ? 'Mute voice' : 'Unmute voice'}
            style={soundBtn}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
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
                      disabled={isJudging}
                      style={{ ...choiceBtn, opacity: isJudging ? 0.5 : 1, cursor: isJudging ? 'not-allowed' : 'pointer' }}
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
                    disabled={isJudging}
                    style={{ ...tfBtnBase, background: '#0d1117', border: `1px solid ${C.green}`, color: C.green, opacity: isJudging ? 0.5 : 1, cursor: isJudging ? 'not-allowed' : 'pointer' }}
                  >
                    TRUE
                  </button>
                  <button
                    onClick={() => onChoiceClick('false')}
                    disabled={isJudging}
                    style={{ ...tfBtnBase, background: '#0d1117', border: `1px solid ${C.red}`, color: C.red, opacity: isJudging ? 0.5 : 1, cursor: isJudging ? 'not-allowed' : 'pointer' }}
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
                    disabled={isJudging}
                    style={{ ...btnBase, background: C.accent, border: `1px solid ${C.accent}`, color: '#0d1117', borderRadius: 6, padding: '10px 18px', fontSize: 13, fontWeight: 800, opacity: isJudging ? 0.5 : 1, cursor: isJudging ? 'not-allowed' : 'pointer' }}
                  >
                    {isJudging ? '...' : 'SUBMIT'}
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
                  {lastResult.recoveryText && (
                    <div style={{ marginTop: 10, color: C.text, fontSize: 13, lineHeight: 1.5 }}>
                      {lastResult.recoveryText}
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
      <SlatePageContent />
    </Suspense>
  )
}

function SlatePageContent() {
  const searchParams = useSearchParams()
  const reviewRunId = searchParams?.get('reviewRunId')
  return reviewRunId ? <SlateReviewExperience runId={reviewRunId} /> : <SlateDrillInner />
}
