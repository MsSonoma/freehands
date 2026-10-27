'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import { useSonomaKeyboard } from '@/app/components/SonomaKeyboard'
import { requestFacilitatorPinException } from '@/app/lib/pinGate'
import {
  getProtectedBrowserSessionId,
  startProtectedInstructionalSession,
} from '@/app/lib/syllabus/executionClient'
import { endLessonSession, heartbeatLessonSession } from '@/app/lib/sessionTracking'
import { getSupabaseClient } from '@/app/lib/supabaseClient.js'
import { updateTranscriptLiveSegment } from '@/app/lib/transcriptsClient'
import { recordSlateLiftoffEvidence } from '@/app/lib/slateLiftoffClient.js'
import { slateMathAnswersEquivalent } from '@/app/lib/slateAnswerEquivalence.mjs'
import { summarizeSlateTestResults } from '@/app/lib/slateTestGradeReport.mjs'
import SlateIndependentTestReport from './SlateIndependentTestReport'
import { buildSlateLiftoffTestItems, slateLiftoffPrintableTestItems } from '@/app/lib/slateLiftoffTest.mjs'
import { validateSlateTestAlignment } from '@/app/lib/slateTestAlignment.mjs'
import { separateLiftoffTranscriptQuestion, prepareSlateLiftoffAdvance, restoreSlateLiftoffAdvance } from '@/app/lib/slateLiftoffTranscript.mjs'
import { resolveSlateLineHelpTarget, slateLineHelpHistory } from '@/app/lib/slateLineHelp.mjs'
import { advanceSlateIntroTeaching, createSlateIntroTeaching, restoreSlateIntroTeaching } from '@/app/lib/slateIntroTeaching.mjs'
import { playSlateSpeechUntilEnd } from '@/app/lib/slateSpeechPlayback.mjs'
import { formatSlateMathTranscript } from '@/app/lib/slateMathTranscript.mjs'
import { slateMathWorkspaceResult, insertSlateMathResult } from '@/app/lib/slateMathDraft.mjs'
import { slateScratchSpec, slateScratchUiForQuestion } from '@/app/lib/slateMathScratch.mjs'
import { sanitizeMultiplicationScratchEntries } from '@/lib/math/multiplicationScratch.mjs'
import { SnapshotService } from '@/app/session/v2/SnapshotService.jsx'
import { MasteryEvidenceClient } from '@/app/lib/masteryEvidence/client.js'
import { analyzeAssessmentIsolation, ASSESSMENT_ISOLATION_STATUSES, ASSESSMENT_ROLES } from '@/app/lib/masteryEvidence/assessmentIsolation.js'
import { buildItemIdentity } from '@/app/lib/masteryEvidence/identity.js'
import {
  buildMasteryEligibilityContext,
  classifyMasteryOutcome,
  INDEPENDENCE_REASONS,
  INDEPENDENT_MASTERY_PROTOCOL_VERSION,
  MASTERY_CHECK_ROLES,
  qualifyMasteryOpportunity,
} from '@/app/lib/masteryEvidence/mastery.js'
import {
  applyLiftoffTurn,
  buildLiftoffSnapshotFeatureState,
  canRestoreLiftoffSnapshot,
  createLiftoffState,
  isResumableSlateLiftoffSnapshot,
  LIFTOFF_PROTOCOL_VERSION,
  liftoffReleaseReady,
} from '@/app/lib/slateLiftoff.mjs'
import ReviewTeacherVideoStage from './ReviewTeacherVideoStage'
import WebbDictationButton from '../webb/WebbDictationButton'
import { isMicrophoneCapturing } from '../utils/microphoneSession'
import { SONOMA_RESPONSE_PACING_INTERVAL_SECONDS } from '../v2/sonomaResponsePacing.mjs'
import CaptionPanel from '../components/CaptionPanel'
import styles from './SlateLiftoffExperience.module.css'
import VerticalMathWorkspace from '@/components/math/VerticalMathWorkspace'
import SlateManualScratch from './SlateManualScratch'
import { initialSlateManualScratch, restoreSlateManualScratch } from '@/app/lib/slateManualScratch.mjs'
import {
  buildMathActivityProblem,
  recordMathSessionHelp,
  submitMathSession,
  updateMathSessionView,
} from '@/lib/math/mathSession.mjs'
import {
  isMathConversationQuestion,
  routeMathTextInput,
} from '@/lib/math/mathTextInput.mjs'
import {
  appendSlateMathArchive,
  buildMathConversationContext,
  createOrRestoreSlateMathActivity,
  createSlateMathActivityId,
  slateMathReceiptMatches,
  shouldSendSlateMathConversation,
  slateMathHelpPendingMatches,
  slateMathPendingMatchesText,
  slateMathSessionMatchesSpec,
  slateMathSubmissionReady,
  SLATE_MATH_ARCHIVE_LIMIT,
} from '@/app/lib/slateMath.mjs'
import {
  createSlateMathTestSession,
  resolveSlateTestMath,
  restoreSlateMathTestDraft,
  slateTestMathFingerprint,
} from '@/app/lib/slateMathTest.mjs'
import {
  listVerticalMathWorkingNoteSlots,
  restoreVerticalMathWorkingNotes,
  sanitizeVerticalMathWorkingNotes,
} from '@/lib/math/verticalMathNotes.mjs'

const SLATE_MUSIC_SRC = '/media/Focus%20Flow.wav'
const SLATE_MUSIC_DEFAULT_VOLUME = 0.18
const SLATE_MUSIC_VOLUME_KEY = 'mr_slate_background_music_volume'
const SLATE_MUSIC_MUTED_KEY = 'mr_slate_background_music_muted'
const SLATE_MUSIC_LONG_PRESS_MS = 550

function safeVerticalMathNoteKeys(session) {
  try {
    return listVerticalMathWorkingNoteSlots(buildMathActivityProblem(session?.spec), session?.view).map((slot) => slot.key)
  } catch {
    return []
  }
}

function clampSlateMusicVolume(value) {
  if (value === null || value === undefined || value === '') return SLATE_MUSIC_DEFAULT_VOLUME
  const number = Number(value)
  if (!Number.isFinite(number)) return SLATE_MUSIC_DEFAULT_VOLUME
  return Math.min(1, Math.max(0, number))
}

const C = {
  bg: '#0d1117',
  surface: '#161b22',
  surface2: '#1c2128',
  border: '#30363d',
  text: '#e6edf3',
  muted: '#8b949e',
  accent: '#58a6ff',
  green: '#3fb950',
  red: '#f85149',
  yellow: '#d29922',
  font: '"ui-monospace","Cascadia Code","Source Code Pro",monospace',
}

function questionType(item = {}) {
  if (Array.isArray(item.choices) && item.choices.length) return 'multiplechoice'
  if (typeof item.answer === 'boolean' || typeof item.correct === 'boolean') return 'truefalse'
  return 'shortanswer'
}

function questionText(item = {}) {
  return String(item.question || item.prompt || item.text || '').trim()
}

function expectedText(item = {}) {
  const type = questionType(item)
  if (type === 'truefalse') return String(Boolean(item.answer ?? item.correct))
  if (type === 'multiplechoice') {
    const correct = item.correct
    if (typeof correct === 'number') {
      const choice = item.choices?.[correct]
      return typeof choice === 'object' ? String(choice.text || choice.label || '') : String(choice || '')
    }
    const byLetter = item.choices?.find((choice) => String(choice?.letter || '').toUpperCase() === String(correct || '').toUpperCase())
    return byLetter ? String(byLetter.text || byLetter.label || byLetter.letter || '') : String(correct || '')
  }
  return String((Array.isArray(item.expectedAny) ? item.expectedAny[0] : '') || item.expected || item.answer || '').trim()
}

function normalizeAnswer(value) {
  return String(value || '').trim().toLowerCase().replace(/[^\w.\-\s]/g, '').replace(/\s+/g, ' ')
}

async function judgeAssessmentItem(item, answer) {
  const type = questionType(item)
  if (type === 'truefalse') {
    const correct = String(answer).trim().toLowerCase() === String(Boolean(item.answer ?? item.correct))
    return { status: correct ? 'correct' : 'incorrect',
      reason: correct ? 'The true/false choice is correct.' : 'The true/false choice does not match the question.' }
  }
  if (type === 'multiplechoice') {
    const raw = String(answer || '').trim()
    const correct = item.correct
    let matched = false
    if (typeof correct === 'number') {
      const index = Math.trunc(correct)
      const letterIndex = /^[A-Z]$/i.test(raw) ? raw.toUpperCase().charCodeAt(0) - 65 : null
      const choice = item.choices?.[index]
      const choiceText = typeof choice === 'object' && choice !== null
        ? String(choice.text || choice.label || '') : String(choice ?? '')
      matched = letterIndex === index || (raw !== '' && /^[0-9]+$/.test(raw) && Number(raw) === index) ||
        (Boolean(choiceText) && normalizeAnswer(raw) === normalizeAnswer(choiceText))
    } else {
      const choice = item.choices?.find(entry => String(entry?.letter || '').toUpperCase() === String(correct || '').toUpperCase())
      matched = raw.toUpperCase() === String(correct || '').toUpperCase() ||
        normalizeAnswer(raw) === normalizeAnswer(choice?.text)
    }
    return { status: matched ? 'correct' : 'incorrect',
      reason: matched ? 'The selected answer is correct.' : 'The selected answer does not match the question.' }
  }

  const learnerAnswer = String(answer || '').trim()
  if (!learnerAnswer) return { status: 'incorrect', reason: 'No answer was provided.' }
  const expectedAny = Array.isArray(item.expectedAny) ? item.expectedAny : []
  const expectedAnswer = String(expectedAny[0] || item.expected || item.answer || '').trim()
  const expectedCandidates = [expectedAnswer, ...expectedAny, item.expected, item.answer].filter(Boolean)
  const prompt = questionText(item)
  const reasoningRequired = /\b(explain|justify|defend|prove|why|reasonableness|compare|describe|check|how)\b/i.test(prompt)
  // Mechanical equivalence is suitable only for a plain numerical question;
  // it must never replace the semantic assessment of a requested explanation.
  if (!reasoningRequired && slateMathAnswersEquivalent(learnerAnswer, expectedCandidates, { question: prompt })) {
    return { status: 'correct', reason: 'The numerical value is equivalent to the expected value.' }
  }
  let response
  try {
    response = await fetch('/api/judge-short-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: prompt,
        learnerAnswer,
        expectedAnswer,
        expectedAny,
        requiresReasoning: reasoningRequired,
      }),
    })
  } catch {
    throw new Error('Grading is temporarily unavailable. Your answer is saved; submit it again to retry.')
  }
  const body = await response.json().catch(() => null)
  if (!response.ok || !['correct', 'partial', 'incorrect'].includes(body?.status) ||
      typeof body?.reason !== 'string' || !body.reason.trim()) {
    throw new Error('Grading is temporarily unavailable. Your answer is saved; submit it again to retry.')
  }
  return { status: body.status, reason: body.reason.trim() }
}

function uniqueQuestions(items = []) {
  const seen = new Set()
  return (Array.isArray(items) ? items : []).filter((item) => {
    const key = questionText(item)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildAssessmentSets(lesson = {}) {
  const explicitWorksheet = Array.isArray(lesson.worksheet)
    ? lesson.worksheet
    : (Array.isArray(lesson.worksheet?.questions) ? lesson.worksheet.questions : [])
  const worksheet = uniqueQuestions(
    explicitWorksheet.length
      ? explicitWorksheet
      : [
          ...(Array.isArray(lesson.fillintheblank) ? lesson.fillintheblank : []),
          ...(Array.isArray(lesson.multiplechoice) ? lesson.multiplechoice : []),
        ]
  )

  return { worksheet, test: buildSlateLiftoffTestItems(lesson) }
}

function reservedTestItems(lesson = {}) {
  return uniqueQuestions(Array.isArray(lesson.test)
    ? lesson.test
    : (Array.isArray(lesson.test?.questions) ? lesson.test.questions : []))
}

function buildLiftoffInstructionalPhaseSets(lesson = {}, worksheet = []) {
  return {
    discussion: [
      ...(Array.isArray(lesson.discussion) ? lesson.discussion : []),
      ...(Array.isArray(lesson.sample) ? lesson.sample : []),
    ],
    comprehension: [
      ...(Array.isArray(lesson.comprehension) ? lesson.comprehension : []),
      ...(Array.isArray(lesson.multiplechoice) ? lesson.multiplechoice : []),
      ...(Array.isArray(lesson.fillintheblank) ? lesson.fillintheblank : []),
    ],
    exercise: Array.isArray(lesson.exercise) ? lesson.exercise : [],
    worksheet,
  }
}

function slateMathRequestId(kind = 'request') {
  const random = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `slate-${kind}:${random}`.slice(0, 200)
}

export default function SlateLiftoffExperience({ learnerId, lessonKey, occurrenceId }) {
  const sonomaKeyboard = useSonomaKeyboard()
  const openSlateInput = (event, onChange, layout = 'text') => sonomaKeyboard.open({ ref: { current: event.currentTarget }, onChange, layout, theme: { label: 'Mr. Slate Keyboard', background: '#1e293b', color: '#e2e8f0', accent: '#d97706' } })
  const router = useRouter()
  const manualScratchActivityId = `slate-manual:${String(occurrenceId || lessonKey || 'lesson').slice(0, 145)}`
  const [phase, setPhase] = useState('loading')
  const [resumeLessonTitle, setResumeLessonTitle] = useState('')
  const [resumeChoiceBusy, setResumeChoiceBusy] = useState(false)
  const [lesson, setLesson] = useState(null)
  const [liftoff, setLiftoff] = useState(null)
  const [slateText, setSlateText] = useState('')
  const [introTeaching, setIntroTeaching] = useState(null)
  const [introSpeechPlaying, setIntroSpeechPlaying] = useState(false)
  const [questionPending, setQuestionPending] = useState(false)
  const [pendingAdvance, setPendingAdvance] = useState(null)
  const [advanceError, setAdvanceError] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [exiting, setExiting] = useState(false)
  const [exitError, setExitError] = useState('')
  const [error, setError] = useState('')
  const [session, setSession] = useState(null)
  const [testItems, setTestItems] = useState([])
  const [assessmentIndex, setAssessmentIndex] = useState(0)
  const [assessmentAnswer, setAssessmentAnswer] = useState('')
  const [testResults, setTestResults] = useState([])
  const [testPrintBusy, setTestPrintBusy] = useState(false)
  const [testPrintError, setTestPrintError] = useState('')
  const [finalPercentage, setFinalPercentage] = useState(null)
  const [soundOn, setSoundOn] = useState(true)
  const [musicMuted, setMusicMuted] = useState(false)
  const [musicVolume, setMusicVolume] = useState(SLATE_MUSIC_DEFAULT_VOLUME)
  const [musicVolumeOpen, setMusicVolumeOpen] = useState(false)
  const [transcriptLines, setTranscriptLines] = useState([])
  const [lineHelpTarget, setLineHelpTarget] = useState(null)
  const [lineHelpInput, setLineHelpInput] = useState('')
  const [lineHelpBusy, setLineHelpBusy] = useState(false)
  const [lineHelpError, setLineHelpError] = useState('')
  const [mathSession, setMathSession] = useState(null)
  const [mathWorkingNotes, setMathWorkingNotes] = useState(null)
  const [mathArchive, setMathArchive] = useState([])
  const [mathPending, setMathPending] = useState(null)
  const [mathError, setMathError] = useState('')
  const [activeScratchUi, setActiveScratchUi] = useState(null)
  const [assessmentScratchUi, setAssessmentScratchUi] = useState(null)
  const [manualScratchUi, setManualScratchUi] = useState(initialSlateManualScratch)
  const [selectedMathTextLocation, setSelectedMathTextLocation] = useState('')
  const [assessmentMathSession, setAssessmentMathSession] = useState(null)
  const [assessmentMathWorkingNotes, setAssessmentMathWorkingNotes] = useState(null)
  const [assessmentMathPending, setAssessmentMathPending] = useState(null)
  const [assessmentMathTextLocation, setAssessmentMathTextLocation] = useState('')
  const [assessmentMathError, setAssessmentMathError] = useState('')

  const answerInputRef = useRef(null)
  const reminderActivityRef = useRef(Date.now())
  const reminderTurnRef = useRef('')
  const reminderStageRef = useRef(0)
  const reminderLastAtRef = useRef(0)
  const audioRef = useRef(null)
  const soundOnRef = useRef(true)
  const speechRequestRef = useRef(0)
  const introSpeechRef = useRef(null)
  const introTeachingRef = useRef(null)
  const introAdvanceLockRef = useRef(false)
  const pendingAdvanceRef = useRef(null)
  const pendingAdvanceLockRef = useRef(false)
  const componentActiveRef = useRef(true)
  const videoRef = useRef(null)
  const musicAudioRef = useRef(null)
  const musicMutedRef = useRef(false)
  const musicVolumeRef = useRef(SLATE_MUSIC_DEFAULT_VOLUME)
  const musicControlRef = useRef(null)
  const musicLongPressRef = useRef(null)
  const musicSuppressClickRef = useRef(false)
  const sessionRef = useRef(null)
  const transcriptRef = useRef([])
  const transcriptBoxRef = useRef(null)
  const startedAtRef = useRef(null)
  const browserSessionIdRef = useRef(null)
  const snapshotServiceRef = useRef(null)
  const masteryEvidenceClientRef = useRef(null)
  const masteryEligibilityRef = useRef(null)
  const assessmentIsolationRef = useRef(null)
  const canonicalReservedTestRef = useRef([])
  const testItemsRef = useRef([])
  const rebuildLegacyTestRef = useRef(false)
  const initializedRef = useRef(false)
  const resumeChoiceRef = useRef(null)
  const mathSessionRef = useRef(null)
  const mathWorkingNotesRef = useRef(null)
  const mathArchiveRef = useRef([])
  const mathPendingRef = useRef(null)
  const mathActivityKeyRef = useRef('')
  const activeScratchUiRef = useRef(null)
  const assessmentScratchUiRef = useRef(null)
  const manualScratchUiRef = useRef(initialSlateManualScratch())
  const submitLockRef = useRef(false)
  const assessmentSubmitLockRef = useRef(false)
  const assessmentMathSessionRef = useRef(null)
  const assessmentMathWorkingNotesRef = useRef(null)
  const assessmentMathPendingRef = useRef(null)
  const assessmentMathTextRef = useRef('')
  const assessmentMathTextLocationRef = useRef('')
  const assessmentMathKeyRef = useRef('')
  const assessmentMathFingerprintRef = useRef('')
  const assessmentIndexRef = useRef(0)
  const finishOwnershipRef = useRef(null)
  const snapshotTimerRef = useRef(null)
  const persistRef = useRef(null)
  const liftoffRef = useRef(null)

  const appendTranscript = useCallback((role, text, meta = {}) => {
    const value = String(text || '').trim()
    if (!value) return
    const next = [...transcriptRef.current, { ...meta, role, text: value }]
    transcriptRef.current = next
    setTranscriptLines(next)
  }, [])

  const appendTestQuestion = useCallback((item, index) => {
    const text = questionText(item)
    if (!text) return
    // On resume, the active question may already be the last transcript line.
    // Only suppress that exact duplicate, not a question from a restarted test.
    const last = transcriptRef.current.at(-1)
    if (last?.role === 'assistant' && last?.text === text) return
    appendTranscript('assistant', text, { kind: 'test_question', testIndex: index })
  }, [appendTranscript])

  liftoffRef.current = liftoff

  const speak = useCallback(async (text) => {
    if (!soundOnRef.current || !text || !audioRef.current) return 'unavailable'
    const requestId = ++speechRequestRef.current
    try {
      const response = await fetch('/api/slate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.audio || !soundOnRef.current || requestId !== speechRequestRef.current) return 'unavailable'
      const audio = audioRef.current
      if (!audio) return 'unavailable'
      audio.pause()
      audio.src = String(body.audio).startsWith('data:') ? body.audio : `data:audio/mp3;base64,${body.audio}`
      try { videoRef.current?.play?.().catch(() => {}) } catch {}
      if (!soundOnRef.current || requestId !== speechRequestRef.current) return 'unavailable'
      const result = await playSlateSpeechUntilEnd(audio)
      if (requestId === speechRequestRef.current) {
        try { videoRef.current?.pause?.() } catch {}
      }
      return result
    } catch {
      return 'unavailable'
    }
  }, [])

  // The active question alone is a waiting turn; never remind during instruction,
  // recording, ongoing typing, or assessment.
  useEffect(() => {
    const activeQuestion = phase === 'active' && !introTeaching && !pendingAdvance && !questionPending && !busy && !lineHelpTarget
    if (!activeQuestion) {
      reminderTurnRef.current = ''
      reminderStageRef.current = 0
      return
    }
    const key = String(liftoff?.turnNumber ?? liftoff?.currentAction?.id ?? slateText)
    if (key !== reminderTurnRef.current) {
      reminderTurnRef.current = key
      reminderStageRef.current = 0
      reminderLastAtRef.current = Date.now()
      reminderActivityRef.current = Date.now()
    }
    const timer = window.setInterval(() => {
      const now = Date.now()
      if (isMicrophoneCapturing() || now - reminderActivityRef.current < 60000) return
      if (now - reminderLastAtRef.current < SONOMA_RESPONSE_PACING_INTERVAL_SECONDS * 1000) return
      if (reminderStageRef.current >= 4 || !reminderTurnRef.current) return
      reminderLastAtRef.current = now
      reminderStageRef.current += 1
      const message = [
        "I'm here when you're ready. Ask if you need help.",
        "If you're stuck, tell me which part is difficult.",
        "Let's keep an eye on our lesson time. Tell me what you're thinking.",
        "We should get back to work. You can still ask me for help.",
      ][reminderStageRef.current - 1]
      appendTranscript('assistant', message, { kind: 'attention_reminder', pacingStage: reminderStageRef.current })
      void speak(message)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [phase, introTeaching, pendingAdvance, questionPending, busy, lineHelpTarget, liftoff?.turnNumber, liftoff?.currentAction?.id, slateText, appendTranscript, speak])
  const toggleSpeech = useCallback(() => {
    const next = !soundOnRef.current
    soundOnRef.current = next
    setSoundOn(next)
    if (!next) {
      speechRequestRef.current += 1
      audioRef.current?.pause()
      try { videoRef.current?.pause?.() } catch {}
    }
  }, [])

  const clearMusicLongPress = useCallback(() => {
    if (musicLongPressRef.current) {
      clearTimeout(musicLongPressRef.current)
      musicLongPressRef.current = null
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    let storedVolume = SLATE_MUSIC_DEFAULT_VOLUME
    let storedMuted = false
    try {
      storedVolume = clampSlateMusicVolume(window.localStorage.getItem(SLATE_MUSIC_VOLUME_KEY))
      const mutedValue = window.localStorage.getItem(SLATE_MUSIC_MUTED_KEY)
      storedMuted = mutedValue === '1' || mutedValue === 'true'
    } catch {}
    musicVolumeRef.current = storedVolume
    musicMutedRef.current = storedMuted
    setMusicVolume(storedVolume)
    setMusicMuted(storedMuted)

    const audio = new Audio(SLATE_MUSIC_SRC)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = storedVolume
    musicAudioRef.current = audio
    const ensurePlayback = () => {
      if (musicAudioRef.current !== audio || musicMutedRef.current || !audio.paused) return
      try {
        const promise = audio.play()
        if (promise && typeof promise.catch === 'function') promise.catch(() => {})
      } catch {}
    }
    document.addEventListener('pointerdown', ensurePlayback, true)
    document.addEventListener('keydown', ensurePlayback, true)
    ensurePlayback()
    return () => {
      document.removeEventListener('pointerdown', ensurePlayback, true)
      document.removeEventListener('keydown', ensurePlayback, true)
      try { audio.pause() } catch {}
      try { audio.src = '' } catch {}
      if (musicAudioRef.current === audio) musicAudioRef.current = null
    }
  }, [])

  useEffect(() => () => clearMusicLongPress(), [clearMusicLongPress])

  useEffect(() => {
    if (!musicVolumeOpen) return undefined
    const outside = (event) => {
      if (!musicControlRef.current?.contains(event.target)) setMusicVolumeOpen(false)
    }
    const escape = (event) => {
      if (event.key === 'Escape') setMusicVolumeOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [musicVolumeOpen])

  const toggleMusic = useCallback(() => {
    if (musicSuppressClickRef.current) {
      musicSuppressClickRef.current = false
      return
    }
    const nextMuted = !musicMutedRef.current
    musicMutedRef.current = nextMuted
    setMusicMuted(nextMuted)
    try { window.localStorage.setItem(SLATE_MUSIC_MUTED_KEY, nextMuted ? '1' : '0') } catch {}
    const audio = musicAudioRef.current
    if (!audio) return
    if (nextMuted) {
      try { audio.pause() } catch {}
      return
    }
    audio.volume = musicVolumeRef.current
    try {
      const promise = audio.play()
      if (promise && typeof promise.catch === 'function') promise.catch(() => {})
    } catch {}
  }, [])

  const changeMusicVolume = useCallback((event) => {
    const nextVolume = clampSlateMusicVolume(event.target.value)
    musicVolumeRef.current = nextVolume
    setMusicVolume(nextVolume)
    try { window.localStorage.setItem(SLATE_MUSIC_VOLUME_KEY, String(nextVolume)) } catch {}
    const audio = musicAudioRef.current
    if (!audio) return
    audio.volume = nextVolume
    if (!musicMutedRef.current && audio.paused) {
      try {
        const promise = audio.play()
        if (promise && typeof promise.catch === 'function') promise.catch(() => {})
      } catch {}
    }
  }, [])

  const openMusicVolume = useCallback((event) => {
    event.preventDefault()
    clearMusicLongPress()
    musicSuppressClickRef.current = false
    setMusicVolumeOpen(true)
  }, [clearMusicLongPress])

  const beginMusicLongPress = useCallback((event) => {
    if (event.button !== 0) return
    clearMusicLongPress()
    musicSuppressClickRef.current = false
    musicLongPressRef.current = setTimeout(() => {
      musicLongPressRef.current = null
      musicSuppressClickRef.current = true
      setMusicVolumeOpen(true)
    }, SLATE_MUSIC_LONG_PRESS_MS)
  }, [clearMusicLongPress])

  const restoreLiftoffSnapshot = useCallback((snapshot, activeSession, loadedLesson) => {
    if (!canRestoreLiftoffSnapshot(snapshot, { occurrenceId, executionSessionId: activeSession?.id })) return false
    const feature = snapshot.featureState
    const oldWorksheetSnapshot = feature.phase === 'worksheet'
    const resumedPhase = feature.phase === 'test' || oldWorksheetSnapshot ? 'test' : 'active'
    const transferredExecution = String(feature.executionSessionId || '') !== String(activeSession?.id || '')
    const restartTransferredTest = transferredExecution && feature.phase === 'test'
    const savedTestItems = Array.isArray(feature.testItems) ? feature.testItems : []
    const needsReplacement = resumedPhase === 'test' && !validateSlateTestAlignment({ lesson: loadedLesson, liftoff: feature.liftoff, testItems: savedTestItems }).ok
    const restoredTestItems = needsReplacement ? [] : savedTestItems
    rebuildLegacyTestRef.current = needsReplacement
    testItemsRef.current = restoredTestItems
    setLesson(loadedLesson)
    setLiftoff(feature.liftoff)
    activeScratchUiRef.current = feature.activeScratchUi || null
    setActiveScratchUi(activeScratchUiRef.current)
    assessmentScratchUiRef.current = restartTransferredTest ? null : (feature.assessmentScratchUi || null)
    setAssessmentScratchUi(assessmentScratchUiRef.current)
    manualScratchUiRef.current = restoreSlateManualScratch(feature.manualScratchUi, manualScratchActivityId, resumedPhase === 'test' ? 'test' : 'teaching')
    setManualScratchUi(manualScratchUiRef.current)
    setSlateText(needsReplacement
      ? 'The previous test did not verify the objectives taught in Liftoff. Those attempts remain in the transcript but will not count. Preparing an aligned independent test.'
      : (restartTransferredTest
        ? 'This lesson moved devices during the independent test, so the test is restarting. Because those test items were already seen, this restarted test will not create a new mastery claim.'
        : (oldWorksheetSnapshot ? 'Liftoff is complete. Now take the independent test. No help or answer feedback until the test is finished.' : String(feature.slateText || ''))))
    setTestItems(restoredTestItems)
    setAssessmentIndex(needsReplacement || restartTransferredTest || oldWorksheetSnapshot ? 0 : Math.max(0, Number(feature.assessmentIndex) || 0))
    const assessmentDraft = restoreSlateMathTestDraft(feature, { restart: needsReplacement || restartTransferredTest || oldWorksheetSnapshot })
    const restoredAssessmentText = assessmentDraft.text
    setAssessmentAnswer(restoredAssessmentText)
    assessmentMathTextRef.current = restoredAssessmentText
    setTestResults(needsReplacement || restartTransferredTest || oldWorksheetSnapshot ? [] : (Array.isArray(feature.testResults) ? feature.testResults : []))
    if (needsReplacement || restartTransferredTest) canonicalReservedTestRef.current = []
    setFinalPercentage(Number.isFinite(Number(feature.finalPercentage)) ? Number(feature.finalPercentage) : null)
    const restoredMathArchive = Array.isArray(feature.mathArchive) ? feature.mathArchive : []
    mathArchiveRef.current = restoredMathArchive
    setMathArchive(restoredMathArchive)
    mathPendingRef.current = feature.mathPending || null
    setMathPending(feature.mathPending || null)
    mathSessionRef.current = feature.mathSession || null
    setMathSession(feature.mathSession || null)
    const restoredAssessmentMath = assessmentDraft.session
    const restoredAssessmentPending = assessmentDraft.pending
    const restoredAssessmentLocation = assessmentDraft.textLocation
    assessmentMathSessionRef.current = restoredAssessmentMath
    assessmentMathPendingRef.current = restoredAssessmentPending
    assessmentMathTextLocationRef.current = restoredAssessmentLocation
    assessmentMathFingerprintRef.current = assessmentDraft.fingerprint
    setAssessmentMathSession(restoredAssessmentMath)
    const restoredMathNotes = feature.mathSession ? restoreVerticalMathWorkingNotes(feature.mathWorkingNotes, {
      activityId: feature.mathSession.activityId,
      validKeys: safeVerticalMathNoteKeys(feature.mathSession),
    }) : null
    mathWorkingNotesRef.current = restoredMathNotes
    setMathWorkingNotes(restoredMathNotes)
    const restoredAssessmentNotes = !restartTransferredTest && restoredAssessmentMath ? restoreVerticalMathWorkingNotes(feature.assessmentMathWorkingNotes, {
      activityId: restoredAssessmentMath.activityId,
      validKeys: safeVerticalMathNoteKeys(restoredAssessmentMath),
    }) : null
    assessmentMathWorkingNotesRef.current = restoredAssessmentNotes
    setAssessmentMathWorkingNotes(restoredAssessmentNotes)
    setAssessmentMathPending(restoredAssessmentPending)
    setAssessmentMathTextLocation(restoredAssessmentLocation)
    assessmentMathKeyRef.current = ''
    const restoredPending = feature.mathPending || null
    const restoredMath = feature.mathSession || null
    const restoredTurn = feature.liftoff?.turnNumber
    const pendingOwnsRestoredMath = resumedPhase === 'active' && restoredMath && (
      (restoredPending?.submission?.activityId === restoredMath.activityId &&
        restoredMath.revision === restoredPending.submission.submittedRevision + 1 &&
        restoredPending.turnNumber === restoredTurn) ||
      (restoredPending?.kind === 'composer_help' && restoredPending.activityId === restoredMath.activityId &&
        restoredPending.helpedRevision === restoredMath.revision && restoredPending.turnNumber === restoredTurn)
    )
    const pendingOwnsTextAnswer = resumedPhase === 'active' && restoredPending?.kind === 'text_answer' && restoredPending.turnNumber === restoredTurn
    setAnswer(pendingOwnsRestoredMath || pendingOwnsTextAnswer
      ? String(restoredPending.kind === 'composer_help' ? restoredPending.text : restoredPending.learnerResponse || '')
      : '')
    const restoredIntro = resumedPhase === 'active' ? restoreSlateIntroTeaching(feature.introTeaching) : null
    introTeachingRef.current = restoredIntro
    setIntroTeaching(restoredIntro)
    introSpeechRef.current = null
    setIntroSpeechPlaying(false)
    const restoredLines = Array.isArray(snapshot.transcript) ? [...snapshot.transcript] : []
    // Former worksheet snapshots resume at the same independent test boundary.
    if (oldWorksheetSnapshot) restoredLines.push({ role: 'assistant', text: 'Liftoff is complete. Now take the independent test. No help or answer feedback until the test is finished.', kind: 'test_start' })
    // Older Liftoff snapshots saved Slate's feedback but not the separately stored probe.
    // Restore the unanswered question into the learner transcript, with its own hand.
    const activeQuestion = resumedPhase === 'active' ? String(feature.liftoff?.currentAction?.problem?.prompt || '').trim() : ''
    const questionAlreadyPresent = activeQuestion && restoredLines.some((line) => line?.kind === 'liftoff_question' && line?.text === activeQuestion)
    const savedAdvance = resumedPhase === 'active' && !restoredIntro
      ? (restoreSlateLiftoffAdvance(feature.pendingAdvance, feature.liftoff) ||
        // If the browser closed just after the learner chose to begin the test,
        // the active snapshot can be awaiting preparation instead of test mode.
        (feature.liftoff?.procedureReleased && liftoffReleaseReady(feature.liftoff)
          ? { kind: 'test', turnNumber: feature.liftoff.turnNumber } : null))
      : null
    // If a click revealed the next question before its snapshot finished, do not hide it again.
    const questionAlreadyRevealed = savedAdvance?.kind === 'question' && restoredLines.some(
      (line) => line?.kind === 'liftoff_question' && line?.turnNumber === restoredTurn && line?.text === savedAdvance.question
    )
    const restoredAdvance = questionAlreadyRevealed ? null : savedAdvance
    pendingAdvanceRef.current = restoredAdvance
    setPendingAdvance(restoredAdvance)
    setAdvanceError('')
    setQuestionPending(Boolean(restoredIntro || restoredAdvance))
    transcriptRef.current = activeQuestion && !restoredIntro && !restoredAdvance && !questionAlreadyPresent
      ? [...restoredLines, { role: 'assistant', text: activeQuestion, kind: 'liftoff_question' }]
      : restoredLines
    setTranscriptLines(transcriptRef.current)
    if (resumedPhase === 'test' && !needsReplacement && !restoredAssessmentPending?.transcriptRecorded) {
      const restoredIndex = restartTransferredTest || oldWorksheetSnapshot ? 0 : Math.max(0, Number(feature.assessmentIndex) || 0)
      appendTestQuestion(restoredTestItems[restoredIndex], restoredIndex)
    }
    startedAtRef.current = feature.startedAt || new Date().toISOString()
    setPhase(needsReplacement ? 'preparing_test' : resumedPhase)
    return true
  }, [appendTestQuestion, occurrenceId])

  const persistLiftoffSnapshot = useCallback(async (overrides = {}) => {
    const service = snapshotServiceRef.current
    const activeSession = sessionRef.current
    if (!service || !activeSession?.id || service.writesFenced) return false
    const phaseValue = overrides.phase ?? phase
    const liftoffValue = overrides.liftoff ?? liftoff
    const slateTextValue = Object.prototype.hasOwnProperty.call(overrides, 'slateText') ? overrides.slateText : slateText
    const assessmentIndexValue = Object.prototype.hasOwnProperty.call(overrides, 'assessmentIndex') ? overrides.assessmentIndex : assessmentIndex
    const testResultsValue = Object.prototype.hasOwnProperty.call(overrides, 'testResults') ? overrides.testResults : testResults
    const finalPercentageValue = Object.prototype.hasOwnProperty.call(overrides, 'finalPercentage') ? overrides.finalPercentage : finalPercentage
    const pendingAdvanceValue = Object.prototype.hasOwnProperty.call(overrides, 'pendingAdvance') ? overrides.pendingAdvance : pendingAdvanceRef.current
    const featureState = buildLiftoffSnapshotFeatureState({
      occurrenceId,
      executionSessionId: activeSession.id,
      phase: phaseValue,
      liftoff: liftoffValue,
      slateText: slateTextValue,
      introTeaching: introTeachingRef.current,
      pendingAdvance: pendingAdvanceValue,
      activeScratchUi: activeScratchUiRef.current,
      assessmentScratchUi: assessmentScratchUiRef.current,
      manualScratchUi: manualScratchUiRef.current,
      assessmentIndex: assessmentIndexValue,
      worksheetFeedback: null,
      testResults: testResultsValue,
      testItems: Object.prototype.hasOwnProperty.call(overrides, 'testItems') ? overrides.testItems : testItemsRef.current,
      finalPercentage: finalPercentageValue,
      startedAt: startedAtRef.current || new Date().toISOString(),
      mathSession: mathSessionRef.current,
      mathWorkingNotes: mathWorkingNotesRef.current,
      mathArchive: mathArchiveRef.current,
      mathPending: mathPendingRef.current,
      assessmentMathSession: assessmentMathSessionRef.current,
      assessmentMathWorkingNotes: assessmentMathWorkingNotesRef.current,
      assessmentMathPending: assessmentMathPendingRef.current,
      assessmentMathText: assessmentMathTextRef.current,
      assessmentMathTextLocation: assessmentMathTextLocationRef.current,
      assessmentMathFingerprint: assessmentMathFingerprintRef.current,
    })
    const result = await service.saveProgress('liftoff', {
      phaseOverride: phaseValue,
      transcript: transcriptRef.current,
      featureState,
    })
    return Boolean(result && result.success !== false && result.blocked !== true && !result.ownershipLost && !service.writesFenced)
  }, [assessmentIndex, finalPercentage, liftoff, occurrenceId, phase, slateText, testResults])

  persistRef.current = persistLiftoffSnapshot

  const handleExit = useCallback(async () => {
    if (busy || exiting || lineHelpBusy || assessmentSubmitLockRef.current || submitLockRef.current) return
    const { ensurePinAllowed } = await import('@/app/lib/pinGate')
    if (!await ensurePinAllowed('session-exit')) return
    setExiting(true)
    setExitError('')
    try {
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
      const saved = await persistLiftoffSnapshot()
      if (!saved) throw new Error('Progress could not be saved. Please try Exit again.')
      audioRef.current?.pause()
      musicAudioRef.current?.pause()
      router.push('/learn')
    } catch (cause) {
      setExitError(cause?.message || 'Progress could not be saved. Please try Exit again.')
      setExiting(false)
    }
  }, [busy, exiting, lineHelpBusy, persistLiftoffSnapshot, router])

  const scheduleMathSnapshot = useCallback(() => {
    if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
    snapshotTimerRef.current = setTimeout(() => {
      snapshotTimerRef.current = null
      void persistRef.current?.()
    }, 500)
  }, [])

  const commitScratchUi = useCallback((isTest, nextUi) => {
    if (isTest) {
      assessmentScratchUiRef.current = nextUi
      setAssessmentScratchUi(nextUi)
    } else {
      activeScratchUiRef.current = nextUi
      setActiveScratchUi(nextUi)
    }
    scheduleMathSnapshot()
  }, [scheduleMathSnapshot])

  const commitManualScratchUi = useCallback((next) => {
    manualScratchUiRef.current = next
    setManualScratchUi(next)
    scheduleMathSnapshot()
  }, [scheduleMathSnapshot])

  // The learner workspace belongs to the Math keyboard tab, not an independent panel.
  useEffect(() => {
    sonomaKeyboard.setWorkspaceDock(
      phase === 'active' || phase === 'test' ? { label: 'Mr. Slate Keyboard' } : null
    )
    return () => sonomaKeyboard.setWorkspaceDock(null)
  }, [sonomaKeyboard.setWorkspaceDock, phase])

  const replayTranscriptLine = useCallback((line) => {
    const text = String(line?.text || '').trim()
    if (!text) return
    void speak(text)
  }, [speak])

  const nextIntroSentence = useCallback(async () => {
    const current = introTeachingRef.current
    if (!current || introSpeechPlaying || introAdvanceLockRef.current || busy || exiting ||
        lineHelpBusy || lineHelpTarget || snapshotServiceRef.current?.writesFenced) return
    const next = advanceSlateIntroTeaching(current)
    if (!next) return
    introAdvanceLockRef.current = true
    if (next.kind === 'question') {
      introTeachingRef.current = null
      setIntroTeaching(null)
      setQuestionPending(false)
      if (next.question) {
        appendTranscript('assistant', next.question, { kind: 'liftoff_question' })
        void speak(next.question)
      }
      introAdvanceLockRef.current = false
      void persistRef.current?.()
      return
    }
    introTeachingRef.current = next.stage
    setIntroTeaching(next.stage)
    appendTranscript('assistant', next.sentence, { kind: 'liftoff_teaching_sentence' })
    setIntroSpeechPlaying(true)
    void persistRef.current?.()
    try {
      await speak(next.sentence)
    } finally {
      if (componentActiveRef.current && introTeachingRef.current === next.stage) {
        setIntroSpeechPlaying(false)
      }
      introAdvanceLockRef.current = false
    }
  }, [appendTranscript, busy, exiting, introSpeechPlaying, lineHelpBusy, lineHelpTarget, speak])

  const openLineHelp = useCallback((line, sourceIndex) => {
    const text = String(line?.text || '').trim()
    if (!text || busy || lineHelpBusy || phase === 'test') return
    try { audioRef.current?.pause?.() } catch {}
    try { videoRef.current?.pause?.() } catch {}
    // A rephrased transcript line still belongs to the original explanation.
    // Keep all follow-ups on that same source so successive requests have history.
    setLineHelpTarget(resolveSlateLineHelpTarget(transcriptRef.current, line, sourceIndex))
    setLineHelpInput('')
    setLineHelpError('')
  }, [busy, lineHelpBusy, phase])

  const closeLineHelp = useCallback(() => {
    if (lineHelpBusy) return
    setLineHelpTarget(null)
    setLineHelpInput('')
    setLineHelpError('')
  }, [lineHelpBusy])

  const requestLineHelp = useCallback(async (action) => {
    const sourceLine = String(lineHelpTarget?.text || '').trim()
    const learnerQuestion = String(lineHelpInput || '').trim()
    if (!sourceLine || !lesson || lineHelpBusy || phase === 'test') return
    if (action === 'ask' && !learnerQuestion) {
      setLineHelpError('Ask Mr. Slate what you want to know about this line.')
      return
    }

    const activeMath = introTeachingRef.current ? null : mathSessionRef.current
    if (activeMath) {
      const recorded = recordMathSessionHelp(activeMath, {
        activityId: activeMath.activityId,
        expectedRevision: activeMath.revision,
        requestId: slateMathRequestId('help'),
        kind: action === 'ask' ? 'line_help_ask' : 'line_help_rephrase',
      })
      if (!recorded.ok) {
        setLineHelpError(recorded.error)
        return
      }
      mathSessionRef.current = recorded.state
      setMathSession(recorded.state)
      await persistLiftoffSnapshot()
    }

    setLineHelpBusy(true)
    setLineHelpError('')
    if (action === 'ask') {
      appendTranscript('user', learnerQuestion, { kind: 'line_help_question', sourceMessageIndex: lineHelpTarget?.sourceIndex ?? null })
      setLineHelpInput('')
    }
    try {
      const helpHistory = slateLineHelpHistory(transcriptRef.current, lineHelpTarget?.sourceIndex)
      const response = await fetch('/api/slate-liftoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'line_help',
          lesson,
          sourceLine,
          action: action === 'ask' ? 'ask' : 'rephrase',
          learnerQuestion: action === 'ask' ? learnerQuestion : '',
          ...helpHistory,
          phase: 'teaching',
        }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body?.reply) throw new Error(body?.error || 'Line help is unavailable.')
      const reply = String(body.reply).trim()
      appendTranscript('assistant', reply, { kind: 'line_help', sourceMessageIndex: lineHelpTarget?.sourceIndex ?? null })
      void speak(reply)
      await persistLiftoffSnapshot()
    } catch (err) {
      setLineHelpError(err?.message || 'Mr. Slate could not help with that line right now.')
    } finally {
      setLineHelpBusy(false)
    }
  }, [appendTranscript, lesson, lineHelpBusy, lineHelpInput, lineHelpTarget, persistLiftoffSnapshot, phase, speak])

  const initializeCanonicalMasteryEvidence = useCallback(async ({ loadedLesson, activeSession, browserSessionId, providedTestItems = null }) => {
    const evidenceLesson = Array.isArray(providedTestItems) && providedTestItems.length
      ? { ...loadedLesson, test: providedTestItems }
      : loadedLesson
    const sets = buildAssessmentSets(evidenceLesson)
    const explicitReserved = reservedTestItems(evidenceLesson)
    const canonicalItems = explicitReserved.length ? sets.test : []
    canonicalReservedTestRef.current = canonicalItems
    masteryEligibilityRef.current = null
    assessmentIsolationRef.current = null
    masteryEvidenceClientRef.current = null
    if (!canonicalItems.length) return

    try {
      const phaseSets = buildLiftoffInstructionalPhaseSets(loadedLesson, sets.worksheet)
      const isolation = await analyzeAssessmentIsolation({
        lessonKey,
        lessonId: loadedLesson?.id || lessonKey,
        lessonData: evidenceLesson,
        phaseSets,
      })
      assessmentIsolationRef.current = isolation

      const evidenceClient = new MasteryEvidenceClient()
      masteryEvidenceClientRef.current = evidenceClient
      await evidenceClient.initialize({
        sessionId: activeSession.id,
        browserSessionId,
        learnerId,
        lessonKey,
        lessonId: loadedLesson?.id || lessonKey,
        // The version identity remains the actual stored lesson, not a temporary test pool.
        lessonData: loadedLesson,
        assessmentIsolation: isolation,
        mastery: { protocolVersion: INDEPENDENT_MASTERY_PROTOCOL_VERSION },
        teachingProtocol: { protocolVersion: LIFTOFF_PROTOCOL_VERSION, protocolHash: null },
        activityAuthorization: { occurrenceId: activeSession.occurrenceId || occurrenceId },
        eventSource: 'slate-liftoff',
        startedAt: startedAtRef.current || new Date().toISOString(),
      })

      const identities = []
      for (const item of canonicalItems) {
        identities.push(await buildItemIdentity({
          lessonKey,
          lessonId: loadedLesson?.id || lessonKey,
          lessonData: evidenceLesson,
          item,
        }))
      }

      if (isolation?.status !== ASSESSMENT_ISOLATION_STATUSES.ISOLATED) {
        masteryEligibilityRef.current = {
          ok: false,
          reason: INDEPENDENCE_REASONS.ISOLATION_NOT_TRUSTWORTHY,
          itemIdentities: identities,
          priorExposedKeys: new Set(),
          baselineIdentityKeys: new Set(),
          instructionalExposureKeys: new Set(),
        }
        return
      }

      const prior = await evidenceClient.checkPriorExposure({ learnerId, itemIdentities: identities })
      if (!prior?.ok) {
        masteryEligibilityRef.current = {
          ok: false,
          reason: INDEPENDENCE_REASONS.PRIOR_EXPOSURE,
          itemIdentities: identities,
          priorExposedKeys: new Set(),
          baselineIdentityKeys: new Set(),
          instructionalExposureKeys: new Set(),
        }
        return
      }

      const context = await buildMasteryEligibilityContext({
        lessonKey,
        lessonId: loadedLesson?.id || lessonKey,
        lessonData: evidenceLesson,
        phaseSets,
        priorExposedKeys: prior.exposedKeys || [],
      })
      masteryEligibilityRef.current = { ok: true, itemIdentities: identities, ...context }
    } catch (e) {
      console.warn('[Slate Liftoff] canonical mastery evidence unavailable', e)
      masteryEligibilityRef.current = {
        ok: false,
        reason: INDEPENDENCE_REASONS.IDENTITY_UNAVAILABLE,
        itemIdentities: [],
        priorExposedKeys: new Set(),
        baselineIdentityKeys: new Set(),
        instructionalExposureKeys: new Set(),
      }
    }
  }, [learnerId, lessonKey, occurrenceId])

  const recordCanonicalMasteryAnswer = useCallback(async ({ item, index, answer: learnerAnswer, correct, judgment }) => {
    const client = masteryEvidenceClientRef.current
    const canonicalItem = canonicalReservedTestRef.current[index]
    if (!client || !canonicalItem || questionText(canonicalItem) !== questionText(item)) return null

    const eligibility = masteryEligibilityRef.current
    const itemIdentity = eligibility?.itemIdentities?.[index] || null
    const itemExposureId = `slate-liftoff-test:${sessionRef.current?.id || 'session'}:${index + 1}:${String(canonicalItem.id || questionText(canonicalItem)).slice(0, 80)}`
    const itemContext = {
      phase: 'test',
      itemId: String(canonicalItem?.id || `slate-liftoff-test-${index + 1}`),
      itemPurpose: 'test',
      itemExposureId,
      identityItem: canonicalItem,
      assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
      evidencePurpose: 'independent_mastery',
      questionIndex: index,
    }

    const presented = await client.recordItemPresented({ ...itemContext, totalQuestions: canonicalReservedTestRef.current.length, item: { question: questionText(canonicalItem) } })
    if (presented?.ok === false) throw new Error('The independent test evidence could not be saved yet.')
    const responseRecorded = await client.recordLearnerResponse({
      ...itemContext,
      attemptNumber: 1,
      isFirstResponse: true,
      response: learnerAnswer,
      responseType: 'text',
    })
    if (responseRecorded?.ok === false) throw new Error('The independent test evidence could not be saved yet.')
    const evaluationRecorded = await client.recordAnswerEvaluated({
      ...itemContext,
      attemptNumber: 1,
      isFirstResponse: true,
      isCorrect: correct === true,
      evaluationMode: 'slate_liftoff_independent_test',
      judgmentStatus: judgment?.status || null,
      judgmentReason: judgment?.reason || null,
      response: learnerAnswer,
      correctAnswer: expectedText(canonicalItem) || null,
    })
    if (evaluationRecorded?.ok === false) throw new Error('The independent test evidence could not be saved yet.')

    const qualification = eligibility?.ok === false
      ? {
          eligible: false,
          independenceStatus: 'unavailable',
          independenceReason: eligibility.reason || INDEPENDENCE_REASONS.IDENTITY_UNAVAILABLE,
        }
      : qualifyMasteryOpportunity({
          itemIdentity,
          assessmentRole: ASSESSMENT_ROLES.ASSESSMENT_RESERVED,
          assessmentIsolationStatus: assessmentIsolationRef.current?.status || null,
          itemExposureId,
          isFirstResponse: true,
          preAssessmentExposed: false,
          priorExposedKeys: eligibility?.priorExposedKeys || [],
          baselineIdentityKeys: eligibility?.baselineIdentityKeys || [],
          instructionalExposureKeys: eligibility?.instructionalExposureKeys || [],
          assistanceEventsBeforeResponse: [],
        })
    const masteryOutcome = classifyMasteryOutcome({
      qualification,
      isCorrect: correct === true,
      checkRole: MASTERY_CHECK_ROLES.INITIAL,
    })
    const masteryRecorded = await client.recordMasteryCheckResult({
      ...itemContext,
      attemptNumber: 1,
      isFirstResponse: true,
      isCorrect: correct === true,
      masteryCheckRole: MASTERY_CHECK_ROLES.INITIAL,
      independenceStatus: qualification.independenceStatus,
      independenceReason: qualification.independenceReason,
      masteryOutcome,
      response: learnerAnswer,
      correctAnswer: expectedText(canonicalItem) || null,
      qualification,
      questionIndex: index,
    })
    if (masteryRecorded?.ok === false) throw new Error('The independent test evidence could not be saved yet.')
    return masteryOutcome
  }, [])

  const chooseLiftoffResume = useCallback((decision) => {
    const resolve = resumeChoiceRef.current
    if (!resolve || resumeChoiceBusy) return
    resumeChoiceRef.current = null
    setResumeChoiceBusy(true)
    resolve(decision)
  }, [resumeChoiceBusy])

  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true
    let cancelled = false

    async function initialize() {
      if (!learnerId || !lessonKey || !occurrenceId) {
        setError('This Liftoff lesson is missing its learner, lesson, or Syllabus occurrence.')
        setPhase('error')
        return
      }

      try {
        const browserSessionId = getProtectedBrowserSessionId()
        if (!browserSessionId) throw new Error('A secure browser session identity is required.')
        browserSessionIdRef.current = browserSessionId

        const snapshotService = new SnapshotService({
          sessionId: browserSessionId,
          learnerId,
          lessonKey,
          supabaseClient: getSupabaseClient(),
        })
        snapshotServiceRef.current = snapshotService
        const loadedSnapshot = await snapshotService.initialize()

        const metaResponse = await fetch('/api/lessons/meta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: [lessonKey], learner_id: learnerId }),
        })
        const meta = await metaResponse.json().catch(() => null)
        const loadedLesson = meta?.lessons?.find((entry) => (
          (entry.lessonKey || `${entry.subject || 'general'}/${entry.file || ''}`) === lessonKey
        )) || meta?.lessons?.[0]
        if (!metaResponse.ok || !loadedLesson) throw new Error('This lesson could not be loaded for Liftoff.')

        // Unlike the older Daily Review route, Liftoff used to restore immediately.
        // Pause before starting a protected execution so a refresh offers the same choice.
        let resumeDecision = 'resume'
        if (isResumableSlateLiftoffSnapshot(loadedSnapshot, { learnerId, lessonKey, occurrenceId })) {
          if (cancelled) return
          setResumeLessonTitle(String(loadedLesson.title || 'this Liftoff lesson'))
          setResumeChoiceBusy(false)
          setPhase('resume_choice')
          resumeDecision = await new Promise((resolve) => { resumeChoiceRef.current = resolve })
          if (cancelled || resumeDecision === 'cancelled') return
        }

        const started = await startProtectedInstructionalSession({
          learnerId,
          lessonKey,
          occurrenceId,
          instructionalTeacher: 'slate',
          requestPin: requestFacilitatorPinException,
        })
        if (!started?.id) throw new Error('The protected Liftoff session could not be confirmed.')

        sessionRef.current = started
        setSession(started)
        snapshotService.bindExecutionOwner({ executionSessionId: started.id, browserSessionId })

        let resumeSnapshot = loadedSnapshot
        if (started.snapshotHandoffId) {
          const transfer = await snapshotService.claimTakeoverSnapshot({
            handoffId: started.snapshotHandoffId,
            targetExecutionSessionId: started.id,
            targetBrowserSessionId: browserSessionId,
          })
          if (transfer?.ok && transfer?.snapshot) resumeSnapshot = transfer.snapshot
          else resumeSnapshot = snapshotService.snapshot || loadedSnapshot
        }

        if (resumeDecision === 'restart') {
          // Only the protected owner may discard this lesson's saved progress.
          // Keep the recovered copy locally if execution ownership changes mid-delete.
          await snapshotService.deleteSnapshot()
          if (snapshotService.writesFenced) {
            if (resumeSnapshot) snapshotService.adoptTransferredSnapshot(resumeSnapshot)
            throw new Error('The lesson moved to another session. Its saved progress was not restarted.')
          }
          resumeSnapshot = null
        }

        startedAtRef.current = resumeSnapshot?.featureState?.startedAt || new Date().toISOString()
        const savedAssessment = Array.isArray(resumeSnapshot?.featureState?.testItems) ? resumeSnapshot.featureState.testItems : []
        if (savedAssessment.length && validateSlateTestAlignment({ lesson: loadedLesson, liftoff: resumeSnapshot.featureState.liftoff, testItems: savedAssessment }).ok) {
          await initializeCanonicalMasteryEvidence({ loadedLesson, activeSession: started, browserSessionId, providedTestItems: savedAssessment })
        }

        if (cancelled) return
        if (resumeDecision !== 'restart' && restoreLiftoffSnapshot(resumeSnapshot, started, loadedLesson)) return
        snapshotService.clearLoadedSnapshot()

        const initResponse = await fetch('/api/slate-liftoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'initialize', lesson: loadedLesson }),
        })
        const init = await initResponse.json().catch(() => null)
        if (!initResponse.ok || !init?.ok) throw new Error(init?.error || 'Mr. Slate could not prepare Liftoff.')
        if (init.compatible === false) throw new Error(init.compatibilityReason || 'This lesson does not contain a usable Liftoff component map.')

        const initialState = createLiftoffState(init.componentMap, init.nextAction, { priorProblems: init.modeledProblem ? [init.modeledProblem] : [] })
        setLesson(loadedLesson)
        setLiftoff(initialState)
        setSlateText(init.learnerMessage)
        const initialQuestion = String(initialState.currentAction?.problem?.prompt || '').trim()
        const initialLines = separateLiftoffTranscriptQuestion(init.learnerMessage, initialQuestion)
        const opening = createSlateIntroTeaching(initialLines.response, initialLines.question)
        introTeachingRef.current = opening
        setIntroTeaching(opening)
        pendingAdvanceRef.current = null
        setPendingAdvance(null)
        setAdvanceError('')
        if (opening) {
          appendTranscript('assistant', opening.sentences[0], { kind: 'liftoff_teaching_sentence' })
          introSpeechRef.current = opening.sentences[0]
        } else {
          if (initialLines.response) appendTranscript('assistant', initialLines.response)
          if (initialLines.question) appendTranscript('assistant', initialLines.question, { kind: 'liftoff_question' })
          introSpeechRef.current = initialLines.response || initialLines.question
        }
        setIntroSpeechPlaying(Boolean(introSpeechRef.current))
        setQuestionPending(Boolean(opening))
        setBusy(false)
        setPhase('active')
        await snapshotService.saveProgress('liftoff-start', {
          phaseOverride: 'active',
          transcript: transcriptRef.current,
          featureState: buildLiftoffSnapshotFeatureState({
            occurrenceId,
            executionSessionId: started.id,
            phase: 'active',
            liftoff: initialState,
            slateText: init.learnerMessage,
            introTeaching: opening,
            assessmentIndex: 0,
            worksheetFeedback: null,
            testResults: [],
            finalPercentage: null,
            startedAt: startedAtRef.current,
          }),
        })
      } catch (cause) {
        if (cancelled) return
        setError(cause?.message || 'Mr. Slate could not start this Liftoff lesson.')
        setPhase('error')
      }
    }

    void initialize()
    return () => {
      cancelled = true
      const resolve = resumeChoiceRef.current
      resumeChoiceRef.current = null
      resolve?.('cancelled')
    }
  }, [appendTranscript, initializeCanonicalMasteryEvidence, learnerId, lessonKey, occurrenceId, restoreLiftoffSnapshot])

  // Play only the first visible teaching sentence on mount. The learner
  // advances every later sentence; no next question is revealed automatically.
  useEffect(() => {
    if (phase !== 'active' || !introSpeechRef.current || !audioRef.current) return undefined
    const sentence = introSpeechRef.current
    introSpeechRef.current = null
    let cancelled = false
    void (async () => {
      await speak(sentence)
      if (cancelled || !componentActiveRef.current) return
      setIntroSpeechPlaying(false)
    })()
    return () => {
      cancelled = true
      // React StrictMode replays effects during development.
      if (!introSpeechRef.current) introSpeechRef.current = sentence
    }
  }, [phase, speak])

  useEffect(() => {
    if (!session?.id || !browserSessionIdRef.current) return undefined
    const timer = setInterval(() => {
      heartbeatLessonSession(session.id, learnerId, browserSessionIdRef.current).then((status) => {
        if (status?.ok && status.active === false) {
          const reason = String(status.endedReason || status.state || 'ended')
          snapshotServiceRef.current?.fenceWrites?.(reason)
          if (reason === 'taken_over') {
            void snapshotServiceRef.current?.offerTakeoverSnapshot?.({
              sourceExecutionSessionId: session.id,
              sourceBrowserSessionId: browserSessionIdRef.current,
            })
          }
          setError(reason === 'taken_over'
            ? 'This lesson moved to another device. Your latest Liftoff state was offered to the new session.'
            : 'This lesson session ended. Return to the Syllabus to continue.')
          setPhase('error')
        }
      }).catch(() => {})
    }, 30000)
    return () => clearInterval(timer)
  }, [learnerId, session?.id])

  useEffect(() => {
    const math = phase === 'active' ? liftoff?.currentAction?.problem?.math : null
    if (!math || !session?.id) {
      if (phase !== 'active' || !math) {
        mathActivityKeyRef.current = ''
        mathSessionRef.current = null
        setMathSession(null)
        mathWorkingNotesRef.current = null
        setMathWorkingNotes(null)
        setMathError('')
      }
      return
    }
    const key = JSON.stringify([liftoff.turnNumber, math])
    if (mathActivityKeyRef.current === key) return
    const restored = mathSessionRef.current
    const activityId = restored?.activityId || createSlateMathActivityId({
      occurrenceId,
      executionSessionId: sessionRef.current.id,
      stage: 'active',
      turnNumber: liftoff.turnNumber,
    })
    const result = createOrRestoreSlateMathActivity({ math, snapshot: restored, activityId, phase: 'teaching' })
    if (!result.ok) {
      mathActivityKeyRef.current = key
      setMathError(result.error || 'This math activity could not be restored. Your saved work was kept.')
      return
    }
    mathActivityKeyRef.current = key
    const pending = mathPendingRef.current
    const pendingLocation = pending?.textLocation
    const pendingMatches = pending?.submission?.activityId === result.state.activityId &&
      result.state.revision === pending.submission.submittedRevision + 1 &&
      pending.turnNumber === liftoff.turnNumber
    let restoreLocation = false
    if (pendingMatches && typeof pendingLocation === 'string' && pendingLocation) {
      if (pendingLocation.endsWith('.*')) {
        const rowId = pendingLocation.slice(0, -2)
        const problem = buildMathActivityProblem(math)
        const row = (problem.answerRows || (problem.resultRow ? [problem.resultRow] : []))
          .find((candidate) => candidate.id === rowId)
        restoreLocation = Boolean(row?.cells?.length && row.cells.every((cell) => result.state.view.editable.includes(cell.id)))
      } else {
        restoreLocation = result.state.view.editable.includes(pendingLocation)
      }
    }
    setSelectedMathTextLocation(restoreLocation ? pendingLocation : '')
    mathSessionRef.current = result.state
    setMathSession(result.state)
    const restoredNotes = restoreVerticalMathWorkingNotes(mathWorkingNotesRef.current, {
      activityId: result.state.activityId,
      validKeys: safeVerticalMathNoteKeys(result.state),
    })
    mathWorkingNotesRef.current = restoredNotes
    setMathWorkingNotes(restoredNotes)
    setMathError('')
    scheduleMathSnapshot()
  }, [liftoff, occurrenceId, phase, scheduleMathSnapshot, session?.id])

  useEffect(() => {
    const flush = () => {
      if (snapshotTimerRef.current) clearTimeout(snapshotTimerRef.current)
      snapshotTimerRef.current = null
      void persistRef.current?.()
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush()
    }
  }, [])

  useEffect(() => {
    componentActiveRef.current = true
    return () => {
      componentActiveRef.current = false
      speechRequestRef.current += 1
      try { audioRef.current?.pause?.() } catch {}
    }
  }, [])

  useEffect(() => {
    if (!['complete', 'error'].includes(phase)) return
    try { musicAudioRef.current?.pause?.() } catch {}
  }, [phase])

  const components = liftoff?.components || []
  const activeMathSpec = phase === 'active' ? liftoff?.currentAction?.problem?.math : null
  const activeMathMatches = Boolean(activeMathSpec && mathSession && (
    slateMathSessionMatchesSpec({
      math: activeMathSpec,
      snapshot: mathSession,
      activityId: mathSession.activityId,
      phase: 'teaching',
    })
  ))
  const activeMathProblem = useMemo(() => {
    if (!activeMathMatches) return null
    try { return buildMathActivityProblem(activeMathSpec) } catch { return null }
  }, [activeMathMatches, activeMathSpec])
  const activeScratchDraft = useMemo(() => activeMathMatches && mathSession?.activityId
    ? slateScratchUiForQuestion(activeScratchUi, mathSession.activityId, activeMathSpec, 'teaching')
    : null, [activeMathMatches, activeMathSpec, activeScratchUi, mathSession?.activityId])
  const activeScratchOperation = activeScratchDraft?.operation || activeMathSpec?.operation
  const activeScratchVariant = activeScratchOperation !== activeMathSpec?.operation
    ? activeScratchDraft?.variants?.[activeScratchOperation] : null
  const activeScratchSession = activeScratchOperation === activeMathSpec?.operation
    ? mathSession : activeScratchVariant?.session
  const activeScratchProblem = useMemo(() => {
    if (!activeScratchSession || !activeMathMatches) return null
    if (activeScratchOperation === activeMathSpec?.operation) return activeMathProblem
    try { return buildMathActivityProblem(slateScratchSpec(activeMathSpec, activeScratchOperation)) }
    catch { return null }
  }, [activeMathMatches, activeMathProblem, activeMathSpec, activeScratchOperation, activeScratchSession])
  const activeScratchNotes = activeScratchOperation === activeMathSpec?.operation
    ? (mathWorkingNotes && mathSession && mathWorkingNotes.activityId === mathSession.activityId ? mathWorkingNotes.notes : {})
    : (activeScratchVariant?.notes || {})
  const activeWorkspaceValue = useMemo(() => slateMathWorkspaceResult(activeScratchProblem, activeScratchSession?.view), [activeScratchProblem, activeScratchSession])
  const changeMathView = useCallback((nextView) => {
    const current = mathSessionRef.current
    if (!current || busy || lineHelpBusy || lineHelpTarget || snapshotServiceRef.current?.writesFenced) return
    const updated = updateMathSessionView(current, nextView, {
      activityId: current.activityId,
      expectedRevision: current.revision,
      requestId: slateMathRequestId('input'),
    })
    if (!updated.ok) {
      setMathError(updated.error)
      return
    }
    mathSessionRef.current = updated.state
    setMathSession(updated.state)
    setMathError('')
    scheduleMathSnapshot()
  }, [busy, lineHelpBusy, lineHelpTarget, scheduleMathSnapshot])
  const changeMathWorkingNotes = useCallback((nextNotes) => {
    const current = mathSessionRef.current
    if (!current || phase !== 'active' || busy || lineHelpBusy || lineHelpTarget || submitLockRef.current || snapshotServiceRef.current?.writesFenced) return
    if (mathWorkingNotesRef.current?.activityId !== current.activityId) return
    const validKeys = safeVerticalMathNoteKeys(current)
    const scoped = { activityId: current.activityId, notes: sanitizeVerticalMathWorkingNotes(nextNotes, { validKeys }) }
    mathWorkingNotesRef.current = scoped
    setMathWorkingNotes(scoped)
    scheduleMathSnapshot()
  }, [busy, lineHelpBusy, lineHelpTarget, phase, scheduleMathSnapshot])
  const essentialComponents = components.filter((component) => component.essential !== false)
  const demonstratedComponents = essentialComponents.filter((component) => ['independent', 'retained'].includes(component.evidenceState))
  const revealedComponents = essentialComponents.filter((component) => component.revealedToLearner === true || ['independent', 'retained'].includes(component.evidenceState))
  const currentAssessmentItems = testItems
  const currentAssessment = currentAssessmentItems[assessmentIndex] || null
  assessmentIndexRef.current = assessmentIndex
  const assessmentMathResolution = useMemo(
    () => phase === 'test' && currentAssessment ? resolveSlateTestMath(currentAssessment) : { kind: 'text' },
    [currentAssessment, phase],
  )
  const assessmentMathSpec = assessmentMathResolution.kind === 'math' ? assessmentMathResolution.spec : null
  const assessmentMathFingerprint = useMemo(() => {
    if (!currentAssessment || !assessmentMathSpec) return ''
    try { return slateTestMathFingerprint(currentAssessment, assessmentMathSpec) } catch { return '' }
  }, [assessmentMathSpec, currentAssessment])
  const assessmentMathMatches = Boolean(assessmentMathSpec && assessmentMathSession?.phase === 'test' &&
    JSON.stringify(assessmentMathSession.spec) === JSON.stringify(assessmentMathSpec))
  const assessmentMathProblem = useMemo(() => {
    if (!assessmentMathMatches) return null
    try { return buildMathActivityProblem(assessmentMathSpec) } catch { return null }
  }, [assessmentMathMatches, assessmentMathSpec])
  const assessmentScratchDraft = useMemo(() => assessmentMathMatches && assessmentMathSession?.activityId
    ? slateScratchUiForQuestion(assessmentScratchUi, assessmentMathSession.activityId, assessmentMathSpec, 'test')
    : null, [assessmentMathMatches, assessmentMathSession?.activityId, assessmentMathSpec, assessmentScratchUi])
  const assessmentScratchOperation = assessmentScratchDraft?.operation || assessmentMathSpec?.operation
  const assessmentScratchVariant = assessmentScratchOperation !== assessmentMathSpec?.operation
    ? assessmentScratchDraft?.variants?.[assessmentScratchOperation] : null
  const assessmentScratchSession = assessmentScratchOperation === assessmentMathSpec?.operation
    ? assessmentMathSession : assessmentScratchVariant?.session
  const assessmentScratchProblem = useMemo(() => {
    if (!assessmentScratchSession || !assessmentMathMatches) return null
    if (assessmentScratchOperation === assessmentMathSpec?.operation) return assessmentMathProblem
    try { return buildMathActivityProblem(slateScratchSpec(assessmentMathSpec, assessmentScratchOperation)) }
    catch { return null }
  }, [assessmentMathMatches, assessmentMathProblem, assessmentMathSpec, assessmentScratchOperation, assessmentScratchSession])
  const assessmentScratchNotes = assessmentScratchOperation === assessmentMathSpec?.operation
    ? (assessmentMathWorkingNotes && assessmentMathSession && assessmentMathWorkingNotes.activityId === assessmentMathSession.activityId ? assessmentMathWorkingNotes.notes : {})
    : (assessmentScratchVariant?.notes || {})
  const assessmentWorkspaceValue = useMemo(() => slateMathWorkspaceResult(assessmentScratchProblem, assessmentScratchSession?.view), [assessmentScratchProblem, assessmentScratchSession])

  useEffect(() => {
    if (phase !== 'test' || !currentAssessment || assessmentMathResolution.kind !== 'math' || !session?.id) {
      if (assessmentMathResolution.kind === 'invalid') setAssessmentMathError(assessmentMathResolution.error)
      else setAssessmentMathError('')
      if (assessmentMathResolution.kind !== 'math') {
        assessmentMathKeyRef.current = ''
        assessmentMathSessionRef.current = null
        setAssessmentMathSession(null)
        assessmentMathWorkingNotesRef.current = null
        setAssessmentMathWorkingNotes(null)
      }
      return
    }
    const key = JSON.stringify([assessmentIndex, assessmentMathFingerprint])
    if (assessmentMathKeyRef.current === key && assessmentMathSessionRef.current) return
    const activityId = createSlateMathActivityId({
      occurrenceId,
      executionSessionId: session.id,
      stage: 'test',
      assessmentIndex,
    })
    const restored = assessmentMathSessionRef.current
    if (restored && assessmentMathFingerprintRef.current && assessmentMathFingerprintRef.current !== assessmentMathFingerprint) {
      assessmentMathKeyRef.current = key
      setAssessmentMathSession(null)
      setAssessmentMathError('This saved test math belongs to a different item. Your saved work was kept.')
      return
    }
    const result = createSlateMathTestSession({ item: currentAssessment, snapshot: restored, activityId })
    assessmentMathKeyRef.current = key
    if (!result.ok) {
      setAssessmentMathError('This test math item could not be restored. Your saved work was kept.')
      return
    }
    assessmentMathSessionRef.current = result.state
    assessmentMathFingerprintRef.current = assessmentMathFingerprint
    setAssessmentMathSession(result.state)
    const restoredNotes = restoreVerticalMathWorkingNotes(assessmentMathWorkingNotesRef.current, {
      activityId: result.state.activityId,
      validKeys: safeVerticalMathNoteKeys(result.state),
    })
    assessmentMathWorkingNotesRef.current = restoredNotes
    setAssessmentMathWorkingNotes(restoredNotes)
    setAssessmentMathError('')
    scheduleMathSnapshot()
  }, [assessmentIndex, assessmentMathFingerprint, assessmentMathResolution, currentAssessment, occurrenceId, phase, scheduleMathSnapshot, session?.id])

  const changeAssessmentMathView = useCallback((nextView) => {
    const current = assessmentMathSessionRef.current
    if (!current || busy || lineHelpBusy || lineHelpTarget || assessmentSubmitLockRef.current || snapshotServiceRef.current?.writesFenced) return
    const updated = updateMathSessionView(current, nextView, {
      activityId: current.activityId,
      expectedRevision: current.revision,
      requestId: slateMathRequestId('test-input'),
    })
    if (!updated.ok) { setAssessmentMathError(updated.error); return }
    assessmentMathSessionRef.current = updated.state
    setAssessmentMathSession(updated.state)
    setAssessmentMathError('')
    scheduleMathSnapshot()
  }, [busy, lineHelpBusy, lineHelpTarget, scheduleMathSnapshot])
  const changeAssessmentMathWorkingNotes = useCallback((nextNotes) => {
    const current = assessmentMathSessionRef.current
    if (!current || phase !== 'test' || busy || lineHelpBusy || lineHelpTarget || assessmentSubmitLockRef.current || snapshotServiceRef.current?.writesFenced) return
    if (assessmentMathWorkingNotesRef.current?.activityId !== current.activityId) return
    const validKeys = safeVerticalMathNoteKeys(current)
    const scoped = { activityId: current.activityId, notes: sanitizeVerticalMathWorkingNotes(nextNotes, { validKeys }) }
    assessmentMathWorkingNotesRef.current = scoped
    setAssessmentMathWorkingNotes(scoped)
    scheduleMathSnapshot()
  }, [busy, lineHelpBusy, lineHelpTarget, phase, scheduleMathSnapshot])
  const changeScratchView = useCallback((isTest, nextView) => {
    if (busy || lineHelpBusy || lineHelpTarget || snapshotServiceRef.current?.writesFenced) return
    const original = isTest ? assessmentMathSessionRef.current : mathSessionRef.current
    const math = isTest ? assessmentMathSpec : activeMathSpec
    if (!original || !math) return
    const ui = slateScratchUiForQuestion(
      isTest ? assessmentScratchUiRef.current : activeScratchUiRef.current,
      original.activityId, math, isTest ? 'test' : 'teaching',
    )
    if (ui.operation === math.operation) {
      if (isTest) changeAssessmentMathView(nextView)
      else changeMathView(nextView)
      return
    }
    const variant = ui.variants[ui.operation]
    if (!variant) return
    const updated = updateMathSessionView(variant.session, nextView, {
      activityId: variant.session.activityId,
      expectedRevision: variant.session.revision,
      requestId: slateMathRequestId('scratch-input'),
    })
    if (!updated.ok) return
    commitScratchUi(isTest, { ...ui, variants: {
      ...ui.variants, [ui.operation]: { ...variant, session: updated.state },
    } })
  }, [activeMathSpec, assessmentMathSpec, busy, changeAssessmentMathView, changeMathView, commitScratchUi, lineHelpBusy, lineHelpTarget])

  const changeScratchNotes = useCallback((isTest, nextNotes) => {
    if (busy || lineHelpBusy || lineHelpTarget || snapshotServiceRef.current?.writesFenced) return
    const original = isTest ? assessmentMathSessionRef.current : mathSessionRef.current
    const math = isTest ? assessmentMathSpec : activeMathSpec
    if (!original || !math) return
    const ui = slateScratchUiForQuestion(
      isTest ? assessmentScratchUiRef.current : activeScratchUiRef.current,
      original.activityId, math, isTest ? 'test' : 'teaching',
    )
    if (ui.operation === math.operation) {
      if (isTest) changeAssessmentMathWorkingNotes(nextNotes)
      else changeMathWorkingNotes(nextNotes)
      return
    }
    const variant = ui.variants[ui.operation]
    if (!variant) return
    const notes = sanitizeVerticalMathWorkingNotes(nextNotes, {
      validKeys: safeVerticalMathNoteKeys(variant.session),
    })
    commitScratchUi(isTest, { ...ui, variants: {
      ...ui.variants, [ui.operation]: { ...variant, notes },
    } })
  }, [activeMathSpec, assessmentMathSpec, busy, changeAssessmentMathWorkingNotes, changeMathWorkingNotes, commitScratchUi, lineHelpBusy, lineHelpTarget])

  const changeScratchPartialEntries = useCallback((isTest, entries) => {
    if (busy || lineHelpBusy || lineHelpTarget || snapshotServiceRef.current?.writesFenced) return
    const original = isTest ? assessmentMathSessionRef.current : mathSessionRef.current
    const math = isTest ? assessmentMathSpec : activeMathSpec
    if (!original || !math) return
    const ui = slateScratchUiForQuestion(
      isTest ? assessmentScratchUiRef.current : activeScratchUiRef.current,
      original.activityId, math, isTest ? 'test' : 'teaching',
    )
    if (ui.operation !== 'multiplication') return
    let problem
    try { problem = buildMathActivityProblem(slateScratchSpec(math, 'multiplication')) }
    catch { return }
    const clean = sanitizeMultiplicationScratchEntries(problem, entries)
    commitScratchUi(isTest, { ...ui, partialEntriesByOperation: {
      ...ui.partialEntriesByOperation, multiplication: clean,
    } })
  }, [activeMathSpec, assessmentMathSpec, busy, commitScratchUi, lineHelpBusy, lineHelpTarget])

  const skillsRemaining = Math.max(0, essentialComponents.length - demonstratedComponents.length)
  const learnerStage = phase === 'test' ? 'test' : 'liftoff'
  const progressStages = [
    { id: 'liftoff', label: 'Liftoff' },
    { id: 'test', label: 'Test' },
    { id: 'done', label: 'Results' },
  ]
  const learnerStageIndex = progressStages.findIndex((stage) => stage.id === learnerStage)
  const testTranscriptStartIndex = useMemo(() => transcriptLines.findIndex((line) => line?.kind === 'test_start'), [transcriptLines])
  const transcriptStartIndex = phase === 'test'
    ? (testTranscriptStartIndex >= 0 ? testTranscriptStartIndex : Math.max(0, transcriptLines.length - 1))
    : -1

  const statusText = useMemo(() => {
    if (!liftoff) return ''
    const demonstrated = (liftoff.components || []).filter((component) => component.essential !== false && ['independent', 'retained'].includes(component.evidenceState)).length
    const total = (liftoff.components || []).filter((component) => component.essential !== false).length
    const remaining = Math.max(0, total - demonstrated)
    return `${demonstrated}/${total} skills demonstrated${phase === 'active' ? ` - ${remaining} skills still to demonstrate` : ''}`
  }, [liftoff, phase])

  const printIndependentTest = useCallback(async () => {
    if (phase !== 'test' || !testItems.length || testPrintBusy) return
    const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null
    if (!previewWin) {
      setTestPrintError('Allow the PDF preview window to open so your test stays on screen.')
      return
    }
    setTestPrintBusy(true)
    setTestPrintError('')
    try {
      const { createAssessmentPdf } = await import('@/app/session/assessment/printPdf')
      await createAssessmentPdf({
        items: slateLiftoffPrintableTestItems(testItems),
        label: 'test',
        lessonTitle: lesson?.title || lessonKey,
        fileBase: String(lessonKey || 'lesson').replace(/[\\/]/g, '-'),
        previewWin,
      })
    } catch (cause) {
      try { if (!previewWin.closed) previewWin.close() } catch {}
      setTestPrintError(cause?.message || 'Could not prepare this test for printing.')
    } finally {
      setTestPrintBusy(false)
    }
  }, [lesson?.title, lessonKey, phase, testItems, testPrintBusy])
  const beginIndependentAssessment = useCallback(async (loadedLesson, liftoffState) => {
    setPhase('preparing_test')
    const sets = buildAssessmentSets(loadedLesson)
    let alignedTestItems = sets.test
    try {
      if (!validateSlateTestAlignment({ lesson: loadedLesson, liftoff: liftoffState, testItems: alignedTestItems }).ok) {
        const response = await fetch('/api/slate-liftoff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'prepare_test', lesson: loadedLesson, state: liftoffState }),
        })
        const body = await response.json().catch(() => ({}))
        if (!response.ok || !body?.ok || !Array.isArray(body?.testItems)) {
          throw new Error(body?.error || 'Could not prepare a test that assesses the taught objectives.')
        }
        alignedTestItems = body.testItems
      }
      const alignment = validateSlateTestAlignment({ lesson: loadedLesson, liftoff: liftoffState, testItems: alignedTestItems })
      if (!alignment.ok) throw new Error('The reserved test does not adequately assess every essential Liftoff objective. No test score was recorded.')
      if (!sessionRef.current?.id || snapshotServiceRef.current?.writesFenced) return
      await initializeCanonicalMasteryEvidence({
        loadedLesson, activeSession: sessionRef.current,
        browserSessionId: browserSessionIdRef.current, providedTestItems: alignedTestItems,
      })
      if (snapshotServiceRef.current?.writesFenced) return
    } catch (cause) {
      setError(cause?.message || 'The independent test could not be aligned with Liftoff.')
      setPhase('error')
      return
    }
    testItemsRef.current = alignedTestItems
    setTestItems(alignedTestItems)
    setAssessmentIndex(0)
    setAssessmentAnswer('')
    assessmentMathTextRef.current = ''
    assessmentMathTextLocationRef.current = ''
    assessmentMathSessionRef.current = null
    assessmentMathWorkingNotesRef.current = null
    assessmentMathPendingRef.current = null
    assessmentMathKeyRef.current = ''
    assessmentMathFingerprintRef.current = ''
    setAssessmentMathTextLocation('')
    setAssessmentMathSession(null)
    setAssessmentMathWorkingNotes(null)
    setAssessmentMathPending(null)
    setAssessmentMathError('')
    setTestResults([])
    if (!alignedTestItems.length) {
      setError('Liftoff released the procedure, but this lesson has no independent test items. The lesson was not marked complete.')
      setPhase('error')
      return
    }
    const text = 'Liftoff is complete. Now take the independent test. No help or answer feedback until the test is finished.'
    setSlateText(text)
    appendTranscript('assistant', text, { kind: 'test_start' })
    void persistLiftoffSnapshot({ phase: 'test', liftoff: liftoffState, slateText: text, testItems: alignedTestItems, assessmentIndex: 0, worksheetFeedback: null, testResults: [], finalPercentage: null })
    // The independent-test question appears in the transcript once the introduction ends.
    await speak(text)
    if (componentActiveRef.current && !snapshotServiceRef.current?.writesFenced) {
      appendTestQuestion(alignedTestItems[0], 0)
      setPhase('test')
      void persistLiftoffSnapshot({ phase: 'test', liftoff: liftoffState, slateText: text, testItems: alignedTestItems, assessmentIndex: 0, worksheetFeedback: null, testResults: [], finalPercentage: null })
    }
  }, [appendTestQuestion, appendTranscript, initializeCanonicalMasteryEvidence, persistLiftoffSnapshot, speak])

  useEffect(() => {
    if (phase !== 'preparing_test' || !rebuildLegacyTestRef.current || !lesson || !liftoff) return
    rebuildLegacyTestRef.current = false
    appendTranscript('assistant',
      'The earlier test questions did not establish the objectives taught in Liftoff. Those answers remain visible in the transcript but will not be used as this test score. An aligned independent test is being prepared.',
      { kind: 'test_replaced' })
    void beginIndependentAssessment(lesson, liftoff)
  }, [appendTranscript, beginIndependentAssessment, lesson, liftoff, phase])

  const continueAfterFeedback = useCallback(async () => {
    const advance = pendingAdvanceRef.current
    const current = liftoffRef.current
    if (!advance || !current || advance.turnNumber !== current.turnNumber ||
        phase !== 'active' || introTeachingRef.current || busy || exiting || lineHelpBusy ||
        lineHelpTarget || pendingAdvanceLockRef.current || snapshotServiceRef.current?.writesFenced) return
    pendingAdvanceLockRef.current = true
    setBusy(true)
    setAdvanceError('')
    try {
      if (advance.kind === 'question') {
        // Persist the learner's choice before revealing the question. If the
        // browser closes between the save and render, legacy restore can still
        // reveal the same current question without skipping a turn.
        const saved = await persistLiftoffSnapshot({ phase: 'active', liftoff: current, pendingAdvance: null })
        if (!saved) throw new Error('The next question could not be saved. Please press Next again.')
        if (!componentActiveRef.current || snapshotServiceRef.current?.writesFenced ||
            liftoffRef.current?.turnNumber !== advance.turnNumber) return
        pendingAdvanceRef.current = null
        setPendingAdvance(null)
        setQuestionPending(false)
        appendTranscript('assistant', advance.question, { kind: 'liftoff_question', turnNumber: advance.turnNumber })
        void persistRef.current?.()
        void speak(advance.question)
      } else if (advance.kind === 'test') {
        // The pending transition remains recoverable in the last active
        // snapshot until the test itself has been prepared and saved.
        pendingAdvanceRef.current = null
        setPendingAdvance(null)
        setQuestionPending(false)
        await beginIndependentAssessment(lesson, current)
      }
    } catch (cause) {
      setAdvanceError(cause?.message || 'Could not continue to the next question.')
    } finally {
      pendingAdvanceLockRef.current = false
      setBusy(false)
    }
  }, [appendTranscript, beginIndependentAssessment, busy, exiting, lesson, lineHelpBusy, lineHelpTarget, persistLiftoffSnapshot, phase, speak])

  const submitLiftoffAnswer = useCallback(async () => {
    const learnerResponse = answer.trim()
    let activeMath = mathSessionRef.current
    const currentLiftoff = liftoffRef.current
    const currentMathSpec = currentLiftoff?.currentAction?.problem?.math
    const writesFenced = snapshotServiceRef.current?.writesFenced
    if (phase !== 'active' || introTeachingRef.current || pendingAdvanceRef.current || lineHelpTarget || lineHelpBusy || writesFenced || submitLockRef.current || busy || !lesson || !currentLiftoff) return
    if (currentMathSpec && mathPendingRef.current?.submission && !slateMathSessionMatchesSpec({
      math: currentMathSpec,
      snapshot: activeMath,
      activityId: activeMath?.activityId,
      phase: 'teaching',
    })) {
      setMathError('This math activity needs attention before it can be submitted. Your saved work has not been reset.')
      return
    }
    if (!learnerResponse && !mathPendingRef.current?.submission) return
    if (activeMath && (Object.keys(activeMath.view?.entries || {}).length || Object.keys(mathWorkingNotesRef.current?.notes || {}).length) && mathArchiveRef.current.length >= SLATE_MATH_ARCHIVE_LIMIT) {
      setMathError('Math evidence storage is full. Ask a facilitator to preserve this lesson before continuing.')
      return
    }
    submitLockRef.current = true
    setBusy(true)
    try {
      let pending = null
      if (activeMath && (mathPendingRef.current?.submission || mathPendingRef.current?.kind === 'composer_help' || isMathConversationQuestion(learnerResponse))) {
        const problem = buildMathActivityProblem(currentMathSpec)
        const initiallyComplete = slateMathSubmissionReady({ math: currentMathSpec, snapshot: activeMath, activityId: activeMath.activityId })
        const route = routeMathTextInput(problem, activeMath.view, answer, { selectedLocation: selectedMathTextLocation || null })
        if (route.kind === 'invalid' || route.kind === 'clarification') {
          setMathError(route.message)
          return
        }
        if (shouldSendSlateMathConversation({ route, gridComplete: initiallyComplete, phase: activeMath.phase })) {
          const originalActivityId = activeMath.activityId
          const originalTurnNumber = currentLiftoff.turnNumber
          let helpPending = mathPendingRef.current
          if (!slateMathHelpPendingMatches({ pending: helpPending, activityId: originalActivityId, revision: activeMath.revision, turnNumber: originalTurnNumber, text: learnerResponse })) {
            const recorded = recordMathSessionHelp(activeMath, {
              activityId: originalActivityId, expectedRevision: activeMath.revision,
              requestId: slateMathRequestId('composer-help'), kind: 'composer_help',
            })
            if (!recorded.ok) { setMathError(recorded.error); return }
            activeMath = recorded.state
            mathSessionRef.current = activeMath
            setMathSession(activeMath)
            helpPending = { kind: 'composer_help', activityId: originalActivityId, helpedRevision: activeMath.revision, turnNumber: originalTurnNumber, text: learnerResponse }
            mathPendingRef.current = helpPending
            setMathPending(helpPending)
            appendTranscript('user', learnerResponse, { kind: 'line_help_question', activityId: originalActivityId })
            await persistLiftoffSnapshot()
          }
          if (snapshotServiceRef.current?.writesFenced || mathSessionRef.current?.activityId !== originalActivityId || mathSessionRef.current?.revision !== activeMath.revision || liftoffRef.current?.turnNumber !== originalTurnNumber) return
          const helpHistory = slateLineHelpHistory(transcriptRef.current, null, { activityId: originalActivityId })
          const response = await fetch('/api/slate-liftoff', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'line_help', lesson,
              sourceLine: buildMathConversationContext({ prompt: currentLiftoff.currentAction?.problem?.prompt, problem, view: activeMath.view }),
              action: 'ask', learnerQuestion: learnerResponse, ...helpHistory, phase: 'teaching' }),
          })
          const body = await response.json().catch(() => ({}))
          if (!response.ok || !body?.reply) throw new Error(body?.error || 'Mr. Slate could not help with that math yet.')
          if (snapshotServiceRef.current?.writesFenced || mathSessionRef.current?.activityId !== originalActivityId || mathSessionRef.current?.revision !== activeMath.revision || liftoffRef.current?.turnNumber !== originalTurnNumber) return
          const reply = String(body.reply).trim()
          appendTranscript('assistant', reply, { kind: 'line_help', activityId: originalActivityId })
          mathPendingRef.current = null
          setMathPending(null)
          setAnswer('')
          setMathError('')
          await persistLiftoffSnapshot()
          void speak(reply)
          return
        }
        if (route.kind === 'entry' && route.locations.length) {
          const updated = updateMathSessionView(activeMath, route.view, {
            activityId: activeMath.activityId, expectedRevision: activeMath.revision, requestId: slateMathRequestId('input'),
          })
          if (!updated.ok) { setMathError(updated.error); return }
          activeMath = updated.state
          mathSessionRef.current = activeMath
          setMathSession(activeMath)
          setMathError('')
          scheduleMathSnapshot()
        }
        const gridComplete = slateMathSubmissionReady({ math: currentMathSpec, snapshot: activeMath, activityId: activeMath.activityId })
        if (!gridComplete) {
          if (route.kind === 'entry') setAnswer('')
          setMathError('Your entry was added. Complete the remaining highlighted math locations.')
          return
        }
        const existing = mathPendingRef.current
        const unchangedPending = existing?.submission?.activityId === activeMath.activityId &&
          activeMath.revision === existing.submission.submittedRevision + 1 &&
          existing.turnNumber === currentLiftoff.turnNumber &&
          slateMathPendingMatchesText({ pending: existing, activityId: activeMath.activityId, revision: activeMath.revision, turnNumber: currentLiftoff.turnNumber, text: learnerResponse })
        if (unchangedPending) {
          pending = existing
        } else {
          const submitted = submitMathSession(activeMath, {
            activityId: activeMath.activityId,
            expectedRevision: activeMath.revision,
            requestId: slateMathRequestId('submit'),
          })
          if (!submitted.ok) {
            setMathError(submitted.error)
            return
          }
          mathSessionRef.current = submitted.state
          setMathSession(submitted.state)
          pending = {
            turnNumber: liftoff.turnNumber,
            learnerResponse,
            textLocation: selectedMathTextLocation || '',
            submission: submitted.submission,
            mathSession: submitted.state,
          }
          mathPendingRef.current = pending
          setMathPending(pending)
          appendTranscript('user', `Math response: ${formatSlateMathTranscript(problem, submitted.submission.entries)}${route.kind !== 'entry' && learnerResponse ? `\nExplanation: ${learnerResponse}` : ''}`, {
            kind: 'math_submission',
            activityId: submitted.submission.activityId,
            requestId: submitted.submission.requestId,
            submittedRevision: submitted.submission.submittedRevision,
          })
          await persistLiftoffSnapshot()
        }
      } else {
        // One learner answer, whether mentally calculated, written, or copied from scratch.
        const previous = mathPendingRef.current
        if (previous?.kind === 'text_answer' && previous.turnNumber === currentLiftoff.turnNumber && previous.learnerResponse === learnerResponse) {
          pending = previous
        } else {
          const savedWork = currentMathSpec && activeMath && slateMathSessionMatchesSpec({
            math: currentMathSpec, snapshot: activeMath, activityId: activeMath.activityId, phase: 'teaching',
          }) ? activeMath : null
          pending = { kind: 'text_answer', turnNumber: currentLiftoff.turnNumber, learnerResponse,
            mathSession: savedWork, mathWorkingNotes: savedWork ? mathWorkingNotesRef.current : null }
          mathPendingRef.current = pending
          setMathPending(pending)
          appendTranscript('user', learnerResponse)
          if (!await persistLiftoffSnapshot()) throw new Error('Your answer could not be safely saved. Please submit it again.')
        }
      }

      if (snapshotServiceRef.current?.writesFenced) return
      const submittedState = liftoffRef.current
      const response = await fetch('/api/slate-liftoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'turn', lesson, state: submittedState,
          ...(pending
            ? (pending.learnerResponse ? { learnerResponse: pending.learnerResponse } : {})
            : (learnerResponse ? { learnerResponse } : {})),
          ...(pending?.submission
            ? { mathSession: pending.mathSession, mathSubmission: pending.submission }
            : (pending?.mathSession ? { mathSession: pending.mathSession, mathWorkingNotes: pending.mathWorkingNotes } : {})),
        }),
      })
      if (snapshotServiceRef.current?.writesFenced) return
      const turn = await response.json().catch(() => null)
      if (!response.ok || !turn?.ok) throw new Error(turn?.error || 'Mr. Slate could not evaluate that step.')
      if (pending?.submission && !slateMathReceiptMatches({
        receipt: turn.mathReceipt,
        pending,
        currentActivityId: mathSessionRef.current?.activityId,
        currentRevision: mathSessionRef.current?.revision,
        currentTurnNumber: liftoffRef.current?.turnNumber,
      })) throw new Error('That math response is no longer current. Your work was kept so you can submit it again.')
      if (liftoffRef.current?.turnNumber !== submittedState.turnNumber) return

      const nextState = applyLiftoffTurn(submittedState, turn)
      if (pending) {
        if (pending.submission) {
          // Finish a valid submission from a session saved before this change.
          const archived = appendSlateMathArchive(mathArchiveRef.current, pending.mathSession, {
            activityId: pending.submission.activityId,
            requestId: pending.submission.requestId,
            submittedRevision: pending.submission.submittedRevision,
            turnNumber: pending.turnNumber,
          })
          if (!archived.ok) throw new Error(archived.error)
          mathArchiveRef.current = archived.archive
          setMathArchive(archived.archive)
        } else if (pending.kind === 'text_answer' && pending.mathSession) {
          const entries = pending.mathSession.view?.entries || {}
          const notes = pending.mathWorkingNotes?.notes || {}
          if (Object.keys(entries).length || Object.keys(notes).length) {
            const archived = appendSlateMathArchive(mathArchiveRef.current, pending.mathSession, {
              activityId: pending.mathSession.activityId,
              requestId: 'scratch:' + String(pending.turnNumber),
              submittedRevision: pending.mathSession.revision,
              turnNumber: pending.turnNumber,
              kind: 'optional_work',
              workingNotes: notes,
            })
            if (!archived.ok) throw new Error(archived.error)
            mathArchiveRef.current = archived.archive
            setMathArchive(archived.archive)
          }
        }
        mathPendingRef.current = null
        setMathPending(null)
        mathSessionRef.current = null
        setMathSession(null)
        mathWorkingNotesRef.current = null
        setMathWorkingNotes(null)
        mathActivityKeyRef.current = ''
        setAnswer('')
        setMathError('')
      }
      liftoffRef.current = nextState
      setLiftoff(nextState)
      setSlateText(turn.learnerMessage)
      const readyForTest = nextState.procedureReleased && liftoffReleaseReady(nextState)
      const nextQuestion = readyForTest ? '' : String(nextState.currentAction?.problem?.prompt || '').trim()
      const { feedback, pendingAdvance: advance } = prepareSlateLiftoffAdvance(
        turn.learnerMessage, nextQuestion, { turnNumber: nextState.turnNumber, readyForTest }
      )
      if (!advance) throw new Error('Mr. Slate did not prepare the next question. Your progress has been retained.')
      // Evaluation and evidence are already complete. Reveal only the feedback;
      // the learner chooses when the next question or test begins.
      pendingAdvanceRef.current = advance
      setPendingAdvance(advance)
      setAdvanceError('')
      setQuestionPending(true)
      if (feedback) appendTranscript('assistant', feedback)
      if (!await persistLiftoffSnapshot({
        phase: 'active', liftoff: nextState, slateText: turn.learnerMessage, pendingAdvance: advance,
      })) throw new Error('The next question could not be safely saved. Your progress is retained; try Next again.')
      // Speech may continue while the learner considers the feedback. Next is
      // a separate choice; the audio ending never advances the lesson.
      if (feedback) void speak(feedback)
    } catch (cause) {
      if (pendingAdvanceRef.current) setAdvanceError(cause?.message || 'Mr. Slate could not save the next question yet.')
      else if (activeMath) setMathError(cause?.message || 'Mr. Slate could not continue Liftoff. Your math work was kept.')
      else setError(cause?.message || 'Mr. Slate could not continue Liftoff.')
    } finally {
      setBusy(false)
      submitLockRef.current = false
    }
  }, [answer, appendTranscript, busy, lesson, lineHelpBusy, lineHelpTarget, persistLiftoffSnapshot, phase, scheduleMathSnapshot, selectedMathTextLocation, speak])

  const finishLesson = useCallback(async (results, { stillOwns = finishOwnershipRef.current || (() => true) } = {}) => {
    if (!stillOwns()) return
    const alignment = validateSlateTestAlignment({ lesson, liftoff, testItems: testItemsRef.current })
    if (!alignment.ok || results.length !== testItemsRef.current.length) {
      throw new Error('The independent test did not verify every essential Liftoff objective. No completion or mastery score was recorded.')
    }
    const score = summarizeSlateTestResults(results)
    if (!score.complete) throw new Error('An independent test response still needs evaluation. No grade was recorded.')
    const percentage = score.percentage
    setFinalPercentage(percentage)
    const activeSession = sessionRef.current
    if (!activeSession?.id) throw new Error('The Liftoff session identity was lost before completion.')

    const completed = await endLessonSession(activeSession.id, {
      reason: 'completed',
      learnerId,
      lessonId: lessonKey,
      occurrenceId: activeSession.occurrenceId || occurrenceId,
      metadata: { source: 'slate-liftoff', test_percentage: percentage,
        test_points: score.points, test_total: score.total, test_partial: score.partial },
    })
    if (!completed) throw new Error('The lesson assessment finished, but the protected Syllabus completion could not be verified.')
    if (!stillOwns()) return

    try {
      await masteryEvidenceClientRef.current?.recordSessionEnded?.({ reason: 'completed', testPercentage: percentage })
    } catch (e) {
      console.warn('[Slate Liftoff] canonical mastery evidence finalization failed', e)
    }
    if (!stillOwns()) return

    let liftoffEvidenceSaved = false
    try {
      await recordSlateLiftoffEvidence({
        learnerId,
        lessonKey,
        occurrenceId: activeSession.occurrenceId || occurrenceId,
        executionSessionId: activeSession.id,
        lessonTitle: lesson?.title || lessonKey,
        subject: lesson?.subject || null,
        testPercentage: percentage,
        liftoff,
      })
      liftoffEvidenceSaved = true
    } catch (e) {
      console.error('[Slate Liftoff] durable responsibility trace save failed', e)
    }
    if (!stillOwns()) return

    if (liftoffEvidenceSaved) {
      try { await snapshotServiceRef.current?.deleteSnapshot?.() } catch {}
    }

    try {
      const learnerName = localStorage.getItem('learner_name') || ''
      await updateTranscriptLiveSegment({
        learnerId,
        learnerName,
        lessonId: lessonKey,
        lessonTitle: lesson?.title || lessonKey,
        startedAt: startedAtRef.current || new Date().toISOString(),
        lines: transcriptRef.current,
        teacher: 'slate',
      })
    } catch {}
    if (!stillOwns()) return

    const completionText = percentage == null
      ? 'Lesson complete.'
      : `Lesson complete. Your independent test score is ${percentage} percent.`
    setSlateText(completionText)
    appendTranscript('assistant', completionText)
    setPhase('complete')
    void speak(completionText)
  }, [appendTranscript, learnerId, lesson?.subject, lesson?.title, lessonKey, liftoff, occurrenceId, speak])

  const submitAssessmentAnswer = useCallback(async (choiceValue = null) => {
    const item = currentAssessment
    let rawAnswer = choiceValue == null ? assessmentAnswer.trim() : String(choiceValue)
    if (phase !== 'test' || !item || busy || assessmentSubmitLockRef.current || snapshotServiceRef.current?.writesFenced) return
    if (!rawAnswer && !assessmentMathPendingRef.current?.status) return
    const submittedIndex = assessmentIndex
    const submittedQuestion = questionText(item)
    const executionSessionId = sessionRef.current?.id
    const stillOwnsItem = () => !snapshotServiceRef.current?.writesFenced &&
      sessionRef.current?.id === executionSessionId && assessmentIndexRef.current === submittedIndex &&
      questionText(currentAssessmentItems[submittedIndex]) === submittedQuestion
    assessmentSubmitLockRef.current = true
    setBusy(true)
    try {
      let pending = assessmentMathPendingRef.current
      const pendingMatches = pending?.index === submittedIndex && pending?.question === submittedQuestion
      if (!pendingMatches) pending = null

      if (pending?.status === 'advance') {
        const nextIndex = pending.index + 1
        assessmentMathPendingRef.current = null
        setAssessmentMathPending(null)
        assessmentMathSessionRef.current = null
        setAssessmentMathSession(null)
        assessmentMathWorkingNotesRef.current = null
        setAssessmentMathWorkingNotes(null)
        assessmentMathKeyRef.current = ''
        assessmentMathFingerprintRef.current = ''
        assessmentMathTextRef.current = ''
        assessmentMathTextLocationRef.current = ''
        setAssessmentMathTextLocation('')
        setAssessmentMathError('')
        setAssessmentAnswer('')
        setAssessmentIndex(nextIndex)
        appendTestQuestion(currentAssessmentItems[nextIndex], nextIndex)
        if (!await persistLiftoffSnapshot({ phase: 'test', assessmentIndex: nextIndex, testResults: pending.nextResults })) {
          throw new Error('The test response could not be safely saved yet. Please submit it again.')
        }
        return
      }
      if (pending?.status === 'finish') {
        if (stillOwnsItem()) {
          finishOwnershipRef.current = stillOwnsItem
          await finishLesson(pending.nextResults)
        }
        return
      }

      if (!pending) {
        const workingSession = assessmentMathResolution.kind === 'math' && assessmentMathMatches
          ? assessmentMathSessionRef.current : null
        const hasWorking = Boolean(workingSession && (
          Object.keys(workingSession.view?.entries || {}).length || Object.keys(assessmentMathWorkingNotesRef.current?.notes || {}).length
        ))
        pending = {
          id: slateMathRequestId('assessment'), index: submittedIndex, question: submittedQuestion,
          answer: rawAnswer, status: 'judge', transcriptRecorded: false,
          ...(hasWorking ? { working: { source: assessmentMathResolution.source,
            snapshot: workingSession, notes: assessmentMathWorkingNotesRef.current?.notes || {} } } : {}),
        }
        assessmentMathPendingRef.current = pending
        setAssessmentMathPending(pending)
        if (!await persistLiftoffSnapshot()) throw new Error('The test response could not be safely saved yet. Please submit it again.')
      }
      if (pending?.status === 'judge') {
        const judgment = await judgeAssessmentItem(item, pending.answer)
        if (!stillOwnsItem()) return
        pending = {
          ...pending,
          status: 'evidence',
          result: { question: submittedQuestion, answer: pending.answer,
            correct: judgment.status === 'correct', judgmentStatus: judgment.status,
            judgmentReason: judgment.reason, expected: expectedText(item),
            ...(pending.working ? { mathWorking: pending.working } : {}) },
        }
        assessmentMathPendingRef.current = pending
        setAssessmentMathPending(pending)
        if (!await persistLiftoffSnapshot()) throw new Error('The test response could not be safely saved yet. Please submit it again.')
      }


      if (!stillOwnsItem()) return
      if (!pending.transcriptRecorded) {
        appendTestQuestion(item, submittedIndex)
        appendTranscript('user', pending.answer)
        pending = { ...pending, transcriptRecorded: true }
        assessmentMathPendingRef.current = pending
        setAssessmentMathPending(pending)
        if (!await persistLiftoffSnapshot()) throw new Error('The test response could not be safely saved yet. Please submit it again.')
      }

      if (!pending.evidenceRecorded) {
        const masteryOutcome = await recordCanonicalMasteryAnswer({
          item, index: submittedIndex, answer: pending.answer, correct: pending.result.correct,
          judgment: { status: pending.result.judgmentStatus, reason: pending.result.judgmentReason },
        })
        if (!stillOwnsItem()) return
        pending = {
          ...pending,
          evidenceRecorded: true,
          result: { ...pending.result, ...(masteryOutcome ? { masteryOutcome } : {}) },
        }
        assessmentMathPendingRef.current = pending
        setAssessmentMathPending(pending)
        if (!await persistLiftoffSnapshot()) throw new Error('The test response could not be safely saved yet. Please submit it again.')
      }

      const alreadySaved = testResults.some((entry) => entry?.submissionId === pending.id)
      const result = { ...pending.result, submissionId: pending.id }
      const nextResults = [...testResults, result]
      const savedResults = alreadySaved ? testResults : nextResults
      setTestResults(savedResults)
      const hasNextAssessment = submittedIndex + 1 < testItems.length
      pending = { ...pending, status: hasNextAssessment ? 'advance' : 'finish', nextResults: savedResults }
      assessmentMathPendingRef.current = pending
      setAssessmentMathPending(pending)
      if (!await persistLiftoffSnapshot({ phase: 'test', assessmentIndex: submittedIndex, testResults: savedResults })) {
        throw new Error('The test response could not be safely saved yet. Please submit it again.')
      }
      if (!stillOwnsItem()) return
      if (hasNextAssessment) {
        const nextIndex = submittedIndex + 1
        assessmentMathPendingRef.current = null
        setAssessmentMathPending(null)
        assessmentMathSessionRef.current = null
        setAssessmentMathSession(null)
        assessmentMathWorkingNotesRef.current = null
        setAssessmentMathWorkingNotes(null)
        assessmentMathKeyRef.current = ''
        assessmentMathFingerprintRef.current = ''
        assessmentMathTextRef.current = ''
        assessmentMathTextLocationRef.current = ''
        setAssessmentMathTextLocation('')
        setAssessmentMathError('')
        setAssessmentAnswer('')
        setAssessmentIndex(nextIndex)
        appendTestQuestion(currentAssessmentItems[nextIndex], nextIndex)
        await persistLiftoffSnapshot({ phase: 'test', assessmentIndex: nextIndex, testResults: savedResults })
        return
      }
      finishOwnershipRef.current = stillOwnsItem
      if (alreadySaved) await finishLesson(savedResults)
      else await finishLesson(nextResults)
    } catch (cause) {
      setAssessmentMathError(cause?.message || 'The independent assessment could not continue.')
    } finally {
      setBusy(false)
      assessmentSubmitLockRef.current = false
    }
  }, [appendTestQuestion, appendTranscript, assessmentAnswer, assessmentIndex, assessmentMathMatches, assessmentMathResolution, busy, currentAssessment, currentAssessmentItems, finishLesson, persistLiftoffSnapshot, phase, recordCanonicalMasteryAnswer, scheduleMathSnapshot, testItems.length, testResults])

  if (phase === 'resume_choice') {
    return (
      <div data-slate-liftoff-resume-choice style={{ minHeight: '100dvh', background: C.bg, color: C.text, fontFamily: C.font }}>
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1200,
          background: 'rgba(0,0,0,0.80)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div role="dialog" aria-modal="true" aria-labelledby="slate-liftoff-resume-title" aria-busy={resumeChoiceBusy} style={{
            background: C.surface, borderRadius: 18,
            width: 'min(92vw, 360px)',
            boxShadow: `0 12px 48px rgba(0,0,0,0.6), 0 0 0 2px ${C.accent}`,
            padding: '28px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👋</div>
            <h1 id="slate-liftoff-resume-title" style={{ color: C.text, fontWeight: 800, fontSize: 18, margin: '0 0 8px' }}>Welcome back!</h1>
            <p style={{ color: C.muted, fontSize: 14, lineHeight: 1.6, margin: '0 0 24px' }}>
              You were in the middle of <strong style={{ color: C.text }}>“{resumeLessonTitle}”</strong> with Mr. Slate.
              <br />
              {resumeChoiceBusy ? 'Preparing your lesson…' : 'Would you like to pick up where you left off?'}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button type="button" onClick={() => chooseLiftoffResume('resume')} disabled={resumeChoiceBusy} style={{
                flex: 1, background: C.accent, color: C.bg, border: 'none',
                borderRadius: 10, padding: '11px 0', cursor: resumeChoiceBusy ? 'wait' : 'pointer',
                fontWeight: 800, fontSize: 15, fontFamily: 'inherit',
                opacity: resumeChoiceBusy ? 0.7 : 1,
              }}>▶ Resume</button>
              <button type="button" onClick={() => chooseLiftoffResume('restart')} disabled={resumeChoiceBusy} style={{
                flex: 1, background: C.surface2, color: C.muted,
                border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 0',
                cursor: resumeChoiceBusy ? 'wait' : 'pointer',
                fontWeight: 700, fontSize: 15, fontFamily: 'inherit',
                opacity: resumeChoiceBusy ? 0.7 : 1,
              }}>↺ Restart</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'loading' || phase === 'preparing_test') {
    return <div style={{ minHeight: '100vh', background: C.bg, color: C.muted, display: 'grid', placeItems: 'center', fontFamily: C.font }}>{phase === 'preparing_test' ? 'PREPARING OBJECTIVE-ALIGNED TEST...' : 'PREPARING LIFTOFF...'}</div>
  }

  if (phase === 'error') {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'grid', placeItems: 'center', padding: 24, fontFamily: C.font }}>
        <div style={{ maxWidth: 680, width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
          <h1 style={{ marginTop: 0, fontSize: 22 }}>Liftoff stopped</h1>
          <p style={{ color: C.red, lineHeight: 1.6 }}>{error}</p>
          <button onClick={() => router.push('/learn')} style={{ padding: '10px 16px', cursor: 'pointer' }}>Return to lessons</button>
        </div>
      </div>
    )
  }

  if (phase === 'complete') {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, color: C.text, display: 'grid', placeItems: 'center', padding: 24, fontFamily: C.font }}>
        <div style={{ maxWidth: 760, width: '100%', textAlign: 'center' }}>
          <ReviewTeacherVideoStage teacher="slate" ref={videoRef} />
          <h1>Independent Test Results</h1>
          <SlateIndependentTestReport items={testResults} percentage={finalPercentage} />
          <p style={{ color: C.muted }}>This independent test was completed without help during the test. Partial answers receive half a point; only correct answers establish independent mastery evidence.</p>
          <button onClick={() => router.push('/learn')} style={{ padding: '12px 20px', cursor: 'pointer', fontWeight: 800 }}>Back to lessons</button>
          <audio ref={audioRef} style={{ display: 'none' }} />
        </div>
      </div>
    )
  }

  const isAssessment = phase === 'test'
  const lessonInteractionHeld = Boolean(lineHelpTarget) || lineHelpBusy
  const structuredMathPresented = Boolean(activeMathSpec && !questionPending && !introTeaching)
  const activeMathTranscriptContent = phase === 'active' ? (
    <div data-slate-active-math-transcript-tail style={{ marginTop: 12, paddingTop: 8 }}>
      {structuredMathPresented && <>
      {activeMathMatches && (activeScratchProblem && activeScratchSession ? (
        <fieldset disabled={busy || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced} style={{ border: 0, padding: 0, margin: '10px 0 0', minWidth: 0 }}>
          <VerticalMathWorkspace
            problem={activeScratchProblem}
            view={activeScratchSession.view}
            onViewChange={(nextView) => changeScratchView(false, nextView)}
            onOpenNumberPad={(event, onChange) => openSlateInput(event, onChange, 'number')}
            notes={activeScratchNotes}
            onNotesChange={(nextNotes) => changeScratchNotes(false, nextNotes)}
            scratchPartialEntries={activeScratchDraft?.partialEntriesByOperation?.multiplication || {}}
            onScratchPartialEntriesChange={(entries) => changeScratchPartialEntries(false, entries)}
            selectedLocation={activeScratchOperation === activeMathSpec.operation ? (selectedMathTextLocation || null) : null}
            onCellSelect={activeScratchOperation === activeMathSpec.operation ? (location) => {
              if (mathSession.view.editable.includes(location)) setSelectedMathTextLocation(location)
            } : undefined}
            phase="teaching"
            showCheck={false}
            showFullAnswerInputs={false}
            embeddedScratch
            footer={
              <button type="button" onClick={() => { setAnswer((current) => insertSlateMathResult(current, activeWorkspaceValue)); answerInputRef.current?.focus() }} disabled={busy || lessonInteractionHeld || !activeWorkspaceValue} style={{ cursor: activeWorkspaceValue ? 'pointer' : 'default' }}>USE THIS RESULT IN ANSWER</button>
            }
          />
        </fieldset>
      ) : (
        <div role="alert" style={{ color: C.muted, fontWeight: 700 }}>The scratch workspace is unavailable.</div>
      ))}
      {mathError && <div role="status" style={{ color: C.red, fontWeight: 700, marginTop: 10 }}>{mathError}</div>}
      </>}

    </div>
  ) : null

  // Text-entry test answers use the same composer position as Liftoff,
  // outside the transcript. Choice buttons and question math stay in the transcript.
  const assessmentWrittenAnswerMode = !isAssessment || !currentAssessment ? null
    : assessmentMathResolution.kind === 'invalid' && questionType(currentAssessment) === 'shortanswer' ? 'invalid-math'
    : assessmentMathResolution.kind === 'math'
      ? (questionType(currentAssessment) === 'multiplechoice' ? null : 'math')
      : ['multiplechoice', 'truefalse'].includes(questionType(currentAssessment)) ? null : 'text'

  const assessmentTranscriptContent = isAssessment && currentAssessment ? (
    <div data-slate-test-transcript-tail style={{ marginTop: 12, paddingTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                <div style={{ color: C.muted, fontSize: 12 }}>TEST {assessmentIndex + 1}/{currentAssessmentItems.length}</div>
                {phase === 'test' && <button type="button" onClick={() => void printIndependentTest()} disabled={testPrintBusy || busy} style={{ padding: '7px 10px', background: C.surface2, color: C.accent, border: '1px solid ' + C.border, borderRadius: 6, fontFamily: C.font, fontWeight: 800, cursor: testPrintBusy ? 'wait' : 'pointer' }}>{testPrintBusy ? 'PREPARING PDF...' : 'PRINT TEST'}</button>}
              </div>
              {testPrintError && <div role="alert" style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{testPrintError}</div>}
              {assessmentMathResolution.kind === 'invalid' && questionType(currentAssessment) === 'shortanswer' ? null : assessmentMathResolution.kind === 'math' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {assessmentMathMatches && (assessmentScratchProblem && assessmentScratchSession ? (
                    <fieldset disabled={busy || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                      <VerticalMathWorkspace
                        problem={assessmentScratchProblem}
                        view={assessmentScratchSession.view}
                        onViewChange={(nextView) => changeScratchView(true, nextView)}
                        onOpenNumberPad={(event, onChange) => openSlateInput(event, onChange, 'number')}
                        notes={assessmentScratchNotes}
                        onNotesChange={(nextNotes) => changeScratchNotes(true, nextNotes)}
                        scratchPartialEntries={assessmentScratchDraft?.partialEntriesByOperation?.multiplication || {}}
                        onScratchPartialEntriesChange={(entries) => changeScratchPartialEntries(true, entries)}
                        selectedLocation={assessmentScratchOperation === assessmentMathSpec.operation ? (assessmentMathTextLocation || null) : null}
                        onCellSelect={assessmentScratchOperation === assessmentMathSpec.operation ? (location) => {
                          if (assessmentMathSession.view.editable.includes(location)) {
                            assessmentMathTextLocationRef.current = location
                            setAssessmentMathTextLocation(location)
                            scheduleMathSnapshot()
                          }
                        } : undefined}
                        showCheck={false}
                        phase="test"
                        showFullAnswerInputs={false}
                        embeddedScratch
                        footer={questionType(currentAssessment) === 'multiplechoice' ? null : (
                          <button type="button" onClick={() => { const next = insertSlateMathResult(assessmentAnswer, assessmentWorkspaceValue); assessmentMathTextRef.current = next; setAssessmentAnswer(next); scheduleMathSnapshot() }} disabled={busy || snapshotServiceRef.current?.writesFenced || !assessmentWorkspaceValue} style={{ cursor: assessmentWorkspaceValue ? 'pointer' : 'default' }}>USE THIS RESULT IN ANSWER</button>
                        )}
                      />
                    </fieldset>
                  ) : (
                    <div role="alert" style={{ color: C.red, fontWeight: 700 }}>This test math item could not be opened. Your work has been kept.</div>
                  ))}
                  {questionType(currentAssessment) === 'multiplechoice' ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {currentAssessment.choices.map((choice, index) => {
                      const letter = typeof choice === 'object' ? (choice.letter || String.fromCharCode(65 + index)) : String.fromCharCode(65 + index)
                      const text = typeof choice === 'object' ? (choice.text || choice.label || letter) : choice
                      return <button key={`${letter}-${index}`} disabled={busy || lessonInteractionHeld} onClick={() => void submitAssessmentAnswer(letter)} style={{ textAlign: 'left', padding: 12, cursor: 'pointer' }}>{letter}. {text}</button>
                    })}
                  </div>
                  ) : null}
                  {assessmentMathError && <div role="status" style={{ color: C.muted, fontWeight: 700 }}>{assessmentMathError}</div>}
                </div>
              ) : questionType(currentAssessment) === 'multiplechoice' ? (
                <div style={{ display: 'grid', gap: 8 }}>
                  {currentAssessment.choices.map((choice, index) => {
                    const letter = typeof choice === 'object' ? (choice.letter || String.fromCharCode(65 + index)) : String.fromCharCode(65 + index)
                    const text = typeof choice === 'object' ? (choice.text || choice.label || letter) : choice
                    return <button key={`${letter}-${index}`} disabled={busy || lessonInteractionHeld} onClick={() => void submitAssessmentAnswer(letter)} style={{ textAlign: 'left', padding: 12, cursor: 'pointer' }}>{letter}. {text}</button>
                  })}
                </div>
              ) : questionType(currentAssessment) === 'truefalse' ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button disabled={busy || lessonInteractionHeld} onClick={() => void submitAssessmentAnswer('true')} style={{ flex: 1, padding: 12, cursor: 'pointer' }}>TRUE</button>
                  <button disabled={busy || lessonInteractionHeld} onClick={() => void submitAssessmentAnswer('false')} style={{ flex: 1, padding: 12, cursor: 'pointer' }}>FALSE</button>
                </div>
              ) : null}


    </div>
  ) : null

  return (
    <div className={styles.sessionShell} style={{ background: C.bg, color: C.text, fontFamily: C.font, display: 'flex', flexDirection: 'column', ...(sonomaKeyboard.keyboardHeight > 0 ? { height: `calc(100dvh - ${sonomaKeyboard.keyboardHeight}px)`, minHeight: 0, overflowY: 'auto' } : {}) }}>
      <header style={{ minHeight: 58, padding: '10px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 900, letterSpacing: 1 }}>MR. SLATE · LIFTOFF</div>
          <div style={{ color: C.muted, fontSize: 12 }}>{lesson?.title || lessonKey}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: C.muted, fontSize: 12 }}>{isAssessment ? phase.toUpperCase() : statusText}</span>
          <div ref={musicControlRef} style={{ position: 'relative', display: 'inline-grid' }}>
            {musicVolumeOpen && (
              <div role="dialog" aria-label="Mr. Slate background music volume" onContextMenu={(event) => event.preventDefault()} style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 210, padding: '10px 12px', background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, boxShadow: '0 10px 28px rgba(0,0,0,0.4)', zIndex: 50 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}><strong style={{ fontSize: 11, letterSpacing: 1 }}>MUSIC VOLUME</strong><span style={{ color: C.muted, fontSize: 11 }}>{Math.round(musicVolume * 100)}%</span></div>
                <input type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={changeMusicVolume} aria-label="Background music volume" style={{ width: '100%', cursor: 'pointer' }} />
                <div style={{ marginTop: 6, color: C.muted, fontSize: 10 }}>RIGHT-CLICK OR HOLD FOR VOLUME</div>
              </div>
            )}
            <button type="button" onClick={toggleMusic} onContextMenu={openMusicVolume} onPointerDown={beginMusicLongPress} onPointerUp={clearMusicLongPress} onPointerCancel={clearMusicLongPress} onPointerLeave={clearMusicLongPress} aria-pressed={musicMuted} aria-haspopup="dialog" aria-expanded={musicVolumeOpen} title={musicMuted ? 'Unmute music. Right-click or hold for volume.' : 'Mute music. Right-click or hold for volume.'} style={{ padding: '7px 10px', cursor: 'pointer' }}>
              {musicMuted ? 'MUSIC OFF' : 'MUSIC ON'}
            </button>
          </div>
          <button type="button" onClick={toggleSpeech} aria-pressed={!soundOn} style={{ padding: '7px 10px', cursor: 'pointer' }}>{soundOn ? 'SPEECH ON' : 'SPEECH OFF'}</button>
          <button type="button" onClick={() => void handleExit()} disabled={busy || exiting || lineHelpBusy} aria-label="Exit Mr. Slate Liftoff" style={{ padding: '7px 10px', cursor: busy || exiting || lineHelpBusy ? 'not-allowed' : 'pointer', fontWeight: 800 }}>{exiting ? 'SAVING...' : 'EXIT'}</button>
        </div>
      </header>
      {exitError && <div role="alert" style={{ padding: '8px 18px', color: C.red, fontSize: 12 }}>{exitError}</div>}

      {(phase === 'active' || phase === 'test') && sonomaKeyboard.active?.layout === 'math' && sonomaKeyboard.workspacePortal && createPortal(
        <div data-slate-manual-scratch style={{ margin: 0 }}>
          <SlateManualScratch
            draft={manualScratchUi}
            activityId={manualScratchActivityId}
            phase={isAssessment ? 'test' : 'teaching'}
            onChange={commitManualScratchUi}
            allowTransfer={!isAssessment ? (!introTeaching && !questionPending) : (questionType(currentAssessment) === 'shortanswer')}
            onUseResult={(result) => {
              if (isAssessment) {
                const next = insertSlateMathResult(assessmentMathTextRef.current, result)
                assessmentMathTextRef.current = next
                setAssessmentAnswer(next)
                scheduleMathSnapshot()
              } else {
                setAnswer((current) => insertSlateMathResult(current, result))
                if (answerInputRef.current) {
                  answerInputRef.current.focus({ preventScroll: true })
                  openSlateInput({ currentTarget: answerInputRef.current }, (next) => {
                    reminderActivityRef.current = Date.now()
                    setAnswer(next)
                  })
                }
              }
            }}
            disabled={busy || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced}
          />
        </div>,
        sonomaKeyboard.workspacePortal
      )}
      <main className={styles.sessionMain} style={{ flex: 1, minHeight: 0, display: 'flex', gap: 16, padding: 16 }}>
        <section className={styles.contentColumn} data-slate-scroll-mode={isAssessment ? 'test' : (lineHelpTarget ? 'help' : 'active')} style={{ minWidth: 0, flex: '1 1 520px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className={styles.transcriptColumn} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
            <div style={{ color: C.accent, fontSize: 11, fontWeight: 900, letterSpacing: 1.4, marginBottom: 8 }}>
              TRANSCRIPT · {phase === 'active' ? liftoff?.currentAction?.type?.toUpperCase() || 'LIFTOFF' : phase.toUpperCase()}
            </div>
            <CaptionPanel
              sentences={transcriptLines}
              activeIndex={Math.max(0, transcriptLines.length - 1)}
              boxRef={transcriptBoxRef}
              phase={phase === 'active' ? 'teaching' : phase}
              captionStartIndex={transcriptStartIndex}
              studyEnabled={!busy && !lineHelpBusy && phase !== 'test'}
              onStudyRequest={openLineHelp}
              onReplayRequest={replayTranscriptLine}
              replayEnabled={!busy && !lineHelpBusy}
              teacherName="Mr. Slate"
              stackedHeight={isAssessment ? (assessmentWrittenAnswerMode ? 'min(52dvh, 480px)' : 'min(72dvh, 720px)') : (structuredMathPresented && activeScratchDraft?.visible ? 'clamp(260px, 42vh, 460px)' : null)}
              tailContent={isAssessment ? assessmentTranscriptContent : activeMathTranscriptContent}
              followTranscriptEnd={!isAssessment}
              keyboardActive={sonomaKeyboard.keyboardHeight > 0}
              keyboardHeight={sonomaKeyboard.keyboardHeight}
              theme={{
                background: C.surface2,
                text: C.text,
                muted: C.muted,
                userText: C.accent,
                activeBackground: 'rgba(88,166,255,0.10)',
                activeText: C.text,
                controlBackground: C.surface,
                controlDisabledBackground: C.border,
                controlText: C.text,
                handBorder: C.accent,
                handBackground: C.surface,
                handText: C.accent,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                boxShadow: 'none',
                fontFamily: C.font,
              }}
            />
          </div>

          {(phase === 'active' || (isAssessment && currentAssessment)) && (
            <button type="button" data-sonoma-keyboard-toggle
              data-slate-math-keyboard-tab
              onClick={() => sonomaKeyboard.showMathTab({
                label: 'Mr. Slate Keyboard', background: '#1e293b', color: '#e2e8f0', accent: '#d97706',
              })}
              disabled={snapshotServiceRef.current?.writesFenced}
              aria-label="Open Math keyboard tab"
              style={{ alignSelf: 'flex-start', minHeight: 38, padding: '8px 14px', background: C.surface, color: C.accent, border: `1px solid ${C.border}`, borderRadius: 8, fontFamily: C.font, fontWeight: 800, cursor: 'pointer' }}>
              MATH KEYBOARD
            </button>
          )}

          {assessmentWrittenAnswerMode && (
            <form
              data-slate-test-answer-form
              onSubmit={(event) => { event.preventDefault(); void submitAssessmentAnswer() }}
              style={{ position: 'sticky', bottom: 0, zIndex: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', width: '100%', maxWidth: '100%', padding: '10px 0', background: C.bg }}
            >
              <textarea
                data-slate-test-answer-input
                aria-label="Test answer"
                data-sonoma-input
                inputMode="none"
                onPointerDown={(event) => openSlateInput(event, (next) => {
                  assessmentMathTextRef.current = next
                  setAssessmentAnswer(next)
                  if (assessmentWrittenAnswerMode === 'math') setAssessmentMathError('')
                  if (assessmentWrittenAnswerMode !== 'text') scheduleMathSnapshot()
                }, 'math')}
                value={assessmentAnswer}
                onChange={(event) => {
                  assessmentMathTextRef.current = event.target.value
                  setAssessmentAnswer(event.target.value)
                  if (assessmentWrittenAnswerMode === 'math') setAssessmentMathError('')
                  if (assessmentWrittenAnswerMode !== 'text') scheduleMathSnapshot()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
                    event.preventDefault()
                    void submitAssessmentAnswer()
                  }
                }}
                rows={2}
                placeholder={assessmentWrittenAnswerMode === 'math' ? 'Type your answer or use a result from scratch work' : 'Type your test answer'}
                disabled={busy || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced}
                style={{ flex: '1 1 280px', minWidth: 0, width: '100%', boxSizing: 'border-box', resize: 'vertical', background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, font: 'inherit' }}
              />
              <button
                type="submit"
                disabled={busy || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced || (!assessmentAnswer.trim() && (assessmentWrittenAnswerMode === 'text' || !assessmentMathPending?.status))}
                style={{ alignSelf: 'stretch', minWidth: 110, cursor: 'pointer', fontWeight: 900 }}
              >
                {busy ? 'CHECKING...' : 'SUBMIT'}
              </button>
            </form>
          )}

          {phase === 'active' && introTeaching && (
            <div data-slate-intro-navigation style={{ display: 'flex', justifyContent: 'center', padding: '10px 0' }}>
              <button
                type="button"
                onClick={() => void nextIntroSentence()}
                disabled={introSpeechPlaying || busy || exiting || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced}
                style={{
                  padding: '12px 24px', minHeight: 44, background: C.accent, color: C.bg,
                  border: 0, borderRadius: 8, fontFamily: C.font, fontWeight: 800,
                  cursor: introSpeechPlaying || lessonInteractionHeld ? 'not-allowed' : 'pointer',
                  opacity: introSpeechPlaying || lessonInteractionHeld ? 0.6 : 1,
                }}
              >
                {introTeaching.index < introTeaching.sentences.length - 1 ? 'NEXT SENTENCE' : 'START QUESTION'}
              </button>
            </div>
          )}

          {phase === 'active' && !introTeaching && pendingAdvance && (
            <div data-slate-followup-navigation style={{ display: 'grid', justifyItems: 'center', gap: 8, padding: '10px 0' }}>
              <button type="button" onClick={() => void continueAfterFeedback()}
                disabled={busy || exiting || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced}
                style={{
                  padding: '12px 24px', minHeight: 44, background: C.accent, color: C.bg,
                  border: 0, borderRadius: 8, fontFamily: C.font, fontWeight: 900,
                  cursor: busy || exiting || lessonInteractionHeld ? 'not-allowed' : 'pointer',
                  opacity: busy || exiting || lessonInteractionHeld ? 0.6 : 1,
                }}>
                {pendingAdvance.kind === 'test' ? 'START TEST' : 'NEXT'}
              </button>
              {advanceError && <p role="alert" style={{ color: C.red, margin: 0 }}>{advanceError}</p>}
            </div>
          )}

          {phase === 'active' && !introTeaching && !pendingAdvance && (
            <form data-slate-primary-answer-form onSubmit={(event) => { event.preventDefault(); void submitLiftoffAnswer() }} style={{ position: 'sticky', bottom: 0, zIndex: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', width: '100%', maxWidth: '100%', padding: '10px 0', background: C.bg }}>
              <WebbDictationButton
                disabled={busy || lessonInteractionHeld}
                onBeforeRecord={() => { reminderActivityRef.current = Date.now(); answerInputRef.current?.blur() }}
                onTranscript={(text) => setAnswer((current) => [current.trim(), text].filter(Boolean).join(' '))}
              />
              <textarea
                ref={answerInputRef}
                data-sonoma-input
                inputMode="none"
                onPointerDown={(event) => openSlateInput(event, (next) => { reminderActivityRef.current = Date.now(); setAnswer(next) })}
                value={answer}
                onChange={(event) => { reminderActivityRef.current = Date.now(); setAnswer(event.target.value) }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) {
                    event.preventDefault()
                    void submitLiftoffAnswer()
                  }
                }}
                placeholder="Show your thinking or answer Mr. Slate."
                rows={2}
                disabled={busy || lessonInteractionHeld}
                style={{ flex: '1 1 280px', minWidth: 0, width: '100%', boxSizing: 'border-box', resize: 'vertical', background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, font: 'inherit' }}
              />
              <button disabled={busy || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced || (!answer.trim() && !mathPending?.submission)} style={{ alignSelf: 'stretch', minWidth: 110, cursor: 'pointer', fontWeight: 900 }}>
                {busy ? 'CHECKING...' : 'SUBMIT'}
              </button>
            </form>
          )}

          {lineHelpTarget && phase !== 'test' && (
            <div style={{ background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, fontFamily: C.font }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: C.accent, fontSize: 11, fontWeight: 900, letterSpacing: 1.2 }}>ASK ABOUT THIS LINE</div>
                  <div style={{ marginTop: 5, fontWeight: 700, whiteSpace: 'pre-wrap' }}>{lineHelpTarget.text}</div>
                </div>
                <button type="button" disabled={lineHelpBusy} onClick={closeLineHelp} style={{ padding: '6px 9px', cursor: lineHelpBusy ? 'not-allowed' : 'pointer', background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: C.font }}>CLOSE</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                <button type="button" disabled={lineHelpBusy} onClick={() => void requestLineHelp('rephrase')} style={{ padding: '9px 12px', cursor: lineHelpBusy ? 'not-allowed' : 'pointer', fontWeight: 800, background: C.surface, color: C.accent, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: C.font }}>
                  {lineHelpBusy ? 'WORKING...' : 'EXPLAIN IT ANOTHER WAY'}
                </button>
              </div>
              <form onSubmit={(event) => { event.preventDefault(); void requestLineHelp('ask') }} style={{ display: 'flex', gap: 8 }}>
                <input
                  data-sonoma-input
                  inputMode="none"
                  onPointerDown={(event) => openSlateInput(event, setLineHelpInput)}
                  value={lineHelpInput}
                  onChange={(event) => setLineHelpInput(event.target.value)}
                  disabled={lineHelpBusy}
                  placeholder="Ask Mr. Slate about this line..."
                  aria-label="Ask Mr. Slate about this transcript line"
                  style={{ flex: 1, minWidth: 0, padding: 10, background: C.surface, color: C.text, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: C.font }}
                />
                <button type="submit" disabled={lineHelpBusy || !lineHelpInput.trim()} style={{ padding: '9px 14px', cursor: lineHelpBusy ? 'not-allowed' : 'pointer', fontWeight: 800, background: C.surface, color: C.accent, border: `1px solid ${C.border}`, borderRadius: 6, fontFamily: C.font }}>ASK</button>
              </form>
              {lineHelpError && <div role="status" style={{ marginTop: 8, color: C.red, fontWeight: 700 }}>{lineHelpError}</div>}
            </div>
          )}

        </section>

        <div className={styles.sidebarColumn} style={{ flex: '0 1 320px', minWidth: 'min(260px, 100%)', maxWidth: '100%' }}>
          <ReviewTeacherVideoStage teacher="slate" ref={videoRef} style={{ width: '100%', margin: 0 }} />
          <aside className={styles.progressPanel} aria-label="Lesson progress" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
          <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1.4, fontWeight: 900, marginBottom: 12 }}>YOUR PROGRESS</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {progressStages.map((stage, index) => {
              const current = stage.id === learnerStage
              const completed = learnerStageIndex > index
              return (
                <div key={stage.id} style={{ padding: '6px 8px', borderRadius: 999, border: `1px solid ${current ? C.accent : C.border}`, color: current ? C.text : (completed ? C.green : C.muted), background: current ? C.surface2 : 'transparent', fontSize: 10, fontWeight: current ? 900 : 700 }}>
                  {completed ? '? ' : ''}{stage.label}
                </div>
              )
            })}
          </div>

          <div style={{ padding: 12, background: C.surface2, borderRadius: 8, marginBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 900 }}>{demonstratedComponents.length}/{essentialComponents.length} skills demonstrated</div>
            {phase === 'active' && <div style={{ color: C.muted, fontSize: 12, marginTop: 5 }}>{skillsRemaining === 0 ? 'Putting it together.' : `${skillsRemaining} skill${skillsRemaining === 1 ? '' : 's'} still to demonstrate`}</div>}
            {phase === 'test' && <div style={{ color: C.muted, fontSize: 12, marginTop: 5 }}>Test {Math.min(assessmentIndex + 1, currentAssessmentItems.length)}/{currentAssessmentItems.length}</div>}
          </div>

          <div style={{ color: C.muted, fontSize: 10, letterSpacing: 1.2, fontWeight: 900, marginBottom: 8 }}>EARNED SKILLS</div>
          {revealedComponents.length > 0 ? revealedComponents.map((component) => {
            const currentlyDemonstrated = ['independent', 'retained'].includes(component.evidenceState)
            return (
              <div key={component.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTop: `1px solid ${C.border}`, padding: '9px 0' }}>
                <strong style={{ fontSize: 12 }}>{currentlyDemonstrated ? '? ' : '? '}{component.name}</strong>
                {!currentlyDemonstrated && <span style={{ color: C.yellow, fontSize: 10, whiteSpace: 'nowrap' }}>CHECKING AGAIN</span>}
              </div>
            )
          }) : <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>Skills will appear here after you demonstrate them.</div>}
          </aside>
        </div>
      </main>

      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  )
}
