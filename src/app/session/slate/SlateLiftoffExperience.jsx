'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import { buildSlateLiftoffTestItems, slateLiftoffPrintableTestItems } from '@/app/lib/slateLiftoffTest.mjs'
import { separateLiftoffTranscriptQuestion } from '@/app/lib/slateLiftoffTranscript.mjs'
import { formatSlateMathTranscript } from '@/app/lib/slateMathTranscript.mjs'
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
  LIFTOFF_PROTOCOL_VERSION,
  liftoffReleaseReady,
} from '@/app/lib/slateLiftoff.mjs'
import ReviewTeacherVideoStage from './ReviewTeacherVideoStage'
import WebbDictationButton from '../webb/WebbDictationButton'
import CaptionPanel from '../components/CaptionPanel'
import styles from './SlateLiftoffExperience.module.css'
import VerticalMathWorkspace from '@/components/math/VerticalMathWorkspace'
import {
  buildMathActivityProblem,
  recordMathSessionHelp,
  submitMathSession,
  updateMathSessionView,
} from '@/lib/math/mathSession.mjs'
import {
  listMathTextDestinations,
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
  formatSlateMathTestResponse,
  mathTestSubmissionReady,
  resolveSlateTestMath,
  restoreSlateMathTestDraft,
  slateTestMathFingerprint,
} from '@/app/lib/slateMathTest.mjs'
import { evaluateMathTestAnswer } from '@/lib/math/mathTestAnswer.mjs'
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
    return String(answer).toLowerCase() === String(Boolean(item.answer ?? item.correct))
  }
  if (type === 'multiplechoice') {
    const raw = String(answer || '').trim()
    const correct = item.correct
    if (typeof correct === 'number') return Number(raw) === Number(correct)
    const choice = item.choices?.find((entry) => String(entry?.letter || '').toUpperCase() === String(correct || '').toUpperCase())
    return raw.toUpperCase() === String(correct || '').toUpperCase()
      || normalizeAnswer(raw) === normalizeAnswer(choice?.text)
  }

  const learnerAnswer = String(answer || '').trim()
  if (!learnerAnswer) return false
  const expectedAny = Array.isArray(item.expectedAny) ? item.expectedAny : []
  const expectedAnswer = String(expectedAny[0] || item.expected || item.answer || '').trim()
  const expectedCandidates = [expectedAnswer, ...expectedAny, item.expected, item.answer].filter(Boolean)
  if (slateMathAnswersEquivalent(learnerAnswer, expectedCandidates, { question: questionText(item) })) return true
  const keywords = Array.isArray(item.keywords) ? item.keywords : (Array.isArray(item.keyTerms) ? item.keyTerms : [])
  try {
    const response = await fetch('/api/judge-short-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: questionText(item),
        learnerAnswer,
        expectedAnswer,
        expectedAny,
        keywords,
        minKeywords: Number.isInteger(item.minKeywords) ? item.minKeywords : (keywords.length ? 1 : 0),
      }),
    })
    const body = await response.json().catch(() => null)
    if (response.ok && typeof body?.correct === 'boolean') return body.correct
  } catch {}

  const normalized = normalizeAnswer(learnerAnswer)
  return [expectedAnswer, ...expectedAny].filter(Boolean).some((candidate) => {
    const expected = normalizeAnswer(candidate)
    return expected && (normalized === expected || normalized.includes(expected) || expected.includes(normalized))
  })
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
  const router = useRouter()
  const [phase, setPhase] = useState('loading')
  const [lesson, setLesson] = useState(null)
  const [liftoff, setLiftoff] = useState(null)
  const [slateText, setSlateText] = useState('')
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
  const [selectedMathTextLocation, setSelectedMathTextLocation] = useState('')
  const [assessmentMathSession, setAssessmentMathSession] = useState(null)
  const [assessmentMathWorkingNotes, setAssessmentMathWorkingNotes] = useState(null)
  const [assessmentMathPending, setAssessmentMathPending] = useState(null)
  const [assessmentMathTextLocation, setAssessmentMathTextLocation] = useState('')
  const [assessmentMathError, setAssessmentMathError] = useState('')

  const answerInputRef = useRef(null)
  const audioRef = useRef(null)
  const soundOnRef = useRef(true)
  const speechRequestRef = useRef(0)
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
  const initializedRef = useRef(false)
  const mathSessionRef = useRef(null)
  const mathWorkingNotesRef = useRef(null)
  const mathArchiveRef = useRef([])
  const mathPendingRef = useRef(null)
  const mathActivityKeyRef = useRef('')
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

  liftoffRef.current = liftoff

  const speak = useCallback(async (text) => {
    if (!soundOnRef.current || !text || !audioRef.current) return
    const requestId = ++speechRequestRef.current
    try {
      const response = await fetch('/api/slate-tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const body = await response.json().catch(() => null)
      if (!response.ok || !body?.audio || !soundOnRef.current || requestId !== speechRequestRef.current) return
      const audio = audioRef.current
      if (!audio) return
      audio.pause()
      audio.src = String(body.audio).startsWith('data:') ? body.audio : `data:audio/mp3;base64,${body.audio}`
      try { videoRef.current?.play?.().catch(() => {}) } catch {}
      audio.onended = () => { try { videoRef.current?.pause?.() } catch {} }
      audio.onerror = () => { try { videoRef.current?.pause?.() } catch {} }
      if (!soundOnRef.current || requestId !== speechRequestRef.current) return
      await audio.play().catch(() => {})
    } catch {}
  }, [])

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
    const sets = buildAssessmentSets(loadedLesson)
    setLesson(loadedLesson)
    setLiftoff(feature.liftoff)
    setSlateText(restartTransferredTest
      ? 'This lesson moved devices during the independent test, so the test is restarting. Because those test items were already seen, this restarted test will not create a new mastery claim.'
      : (oldWorksheetSnapshot ? 'Liftoff is complete. Now take the independent test. No help or answer feedback until the test is finished.' : String(feature.slateText || '')))
    setTestItems(sets.test)
    setAssessmentIndex(restartTransferredTest || oldWorksheetSnapshot ? 0 : Math.max(0, Number(feature.assessmentIndex) || 0))
    const assessmentDraft = restoreSlateMathTestDraft(feature, { restart: restartTransferredTest || oldWorksheetSnapshot })
    const restoredAssessmentText = assessmentDraft.text
    setAssessmentAnswer(restoredAssessmentText)
    assessmentMathTextRef.current = restoredAssessmentText
    setTestResults(restartTransferredTest || oldWorksheetSnapshot ? [] : (Array.isArray(feature.testResults) ? feature.testResults : []))
    if (restartTransferredTest) canonicalReservedTestRef.current = []
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
    setAnswer(pendingOwnsRestoredMath
      ? String(restoredPending.kind === 'composer_help' ? restoredPending.text : restoredPending.learnerResponse || '')
      : '')
    const restoredLines = Array.isArray(snapshot.transcript) ? [...snapshot.transcript] : []
    // Former worksheet snapshots resume at the same independent test boundary.
    if (oldWorksheetSnapshot) restoredLines.push({ role: 'assistant', text: 'Liftoff is complete. Now take the independent test. No help or answer feedback until the test is finished.', kind: 'test_start' })
    // Older Liftoff snapshots saved Slate's feedback but not the separately stored probe.
    // Restore the unanswered question into the learner transcript, with its own hand.
    const activeQuestion = resumedPhase === 'active' ? String(feature.liftoff?.currentAction?.problem?.prompt || '').trim() : ''
    const questionAlreadyPresent = activeQuestion && restoredLines.some((line) => line?.kind === 'liftoff_question' && line?.text === activeQuestion)
    transcriptRef.current = activeQuestion && !questionAlreadyPresent
      ? [...restoredLines, { role: 'assistant', text: activeQuestion, kind: 'liftoff_question' }]
      : restoredLines
    setTranscriptLines(transcriptRef.current)
    startedAtRef.current = feature.startedAt || new Date().toISOString()
    setPhase(resumedPhase)
    return true
  }, [occurrenceId])

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
    const featureState = buildLiftoffSnapshotFeatureState({
      occurrenceId,
      executionSessionId: activeSession.id,
      phase: phaseValue,
      liftoff: liftoffValue,
      slateText: slateTextValue,
      assessmentIndex: assessmentIndexValue,
      worksheetFeedback: null,
      testResults: testResultsValue,
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

  const replayTranscriptLine = useCallback((line) => {
    const text = String(line?.text || '').trim()
    if (!text) return
    void speak(text)
  }, [speak])

  const openLineHelp = useCallback((line, sourceIndex) => {
    const text = String(line?.text || '').trim()
    if (!text || busy || lineHelpBusy || phase === 'test') return
    try { audioRef.current?.pause?.() } catch {}
    try { videoRef.current?.pause?.() } catch {}
    setLineHelpTarget({ text, sourceIndex: Number.isInteger(sourceIndex) ? sourceIndex : null })
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

    const activeMath = mathSessionRef.current
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
      const response = await fetch('/api/slate-liftoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'line_help',
          lesson,
          sourceLine,
          action: action === 'ask' ? 'ask' : 'rephrase',
          learnerQuestion: action === 'ask' ? learnerQuestion : '',
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

  const initializeCanonicalMasteryEvidence = useCallback(async ({ loadedLesson, activeSession, browserSessionId }) => {
    const sets = buildAssessmentSets(loadedLesson)
    const explicitReserved = reservedTestItems(loadedLesson)
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
        lessonData: loadedLesson,
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
          lessonData: loadedLesson,
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
        lessonData: loadedLesson,
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

  const recordCanonicalMasteryAnswer = useCallback(async ({ item, index, answer: learnerAnswer, correct }) => {
    const client = masteryEvidenceClientRef.current
    const canonicalItem = canonicalReservedTestRef.current[index]
    if (!client || !canonicalItem || questionText(canonicalItem) !== questionText(item)) return null

    const eligibility = masteryEligibilityRef.current
    const itemIdentity = eligibility?.itemIdentities?.[index] || null
    const itemExposureId = `slate-liftoff-test:${sessionRef.current?.id || 'session'}:${index + 1}`
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

        startedAtRef.current = resumeSnapshot?.featureState?.startedAt || new Date().toISOString()
        await initializeCanonicalMasteryEvidence({ loadedLesson, activeSession: started, browserSessionId })

        if (cancelled) return
        if (restoreLiftoffSnapshot(resumeSnapshot, started, loadedLesson)) return
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
        if (initialLines.response) appendTranscript('assistant', initialLines.response)
        if (initialLines.question) appendTranscript('assistant', initialLines.question, { kind: 'liftoff_question' })
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
            assessmentIndex: 0,
            worksheetFeedback: null,
            testResults: [],
            finalPercentage: null,
            startedAt: startedAtRef.current,
          }),
        })
        void speak(init.learnerMessage)
      } catch (cause) {
        if (cancelled) return
        setError(cause?.message || 'Mr. Slate could not start this Liftoff lesson.')
        setPhase('error')
      }
    }

    void initialize()
    return () => { cancelled = true }
  }, [appendTranscript, initializeCanonicalMasteryEvidence, learnerId, lessonKey, occurrenceId, restoreLiftoffSnapshot, speak])

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

  useEffect(() => () => {
    try { audioRef.current?.pause?.() } catch {}
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
  const mathSubmitReady = Boolean(activeMathMatches && slateMathSubmissionReady({
    math: activeMathSpec,
    snapshot: mathSession,
    activityId: mathSession?.activityId,
    phase: 'teaching',
  }))
  const mathTextDestinations = useMemo(() => activeMathProblem && mathSession
    ? listMathTextDestinations(activeMathProblem, mathSession.view)
    : [], [activeMathProblem, mathSession])
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
  const assessmentMathDestinations = useMemo(() => assessmentMathProblem && assessmentMathSession
    ? listMathTextDestinations(assessmentMathProblem, assessmentMathSession.view)
    : [], [assessmentMathProblem, assessmentMathSession])

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
  const beginIndependentAssessment = useCallback((loadedLesson, liftoffState) => {
    const sets = buildAssessmentSets(loadedLesson)
    setTestItems(sets.test)
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
    if (!sets.test.length) {
      setError('Liftoff released the procedure, but this lesson has no independent test items. The lesson was not marked complete.')
      setPhase('error')
      return
    }
    const text = 'Liftoff is complete. Now take the independent test. No help or answer feedback until the test is finished.'
    setSlateText(text)
    appendTranscript('assistant', text, { kind: 'test_start' })
    setPhase('test')
    void persistLiftoffSnapshot({ phase: 'test', liftoff: liftoffState, slateText: text, assessmentIndex: 0, worksheetFeedback: null, testResults: [], finalPercentage: null })
    void speak(text)
  }, [appendTranscript, persistLiftoffSnapshot, speak])

  const submitLiftoffAnswer = useCallback(async () => {
    const learnerResponse = answer.trim()
    let activeMath = mathSessionRef.current
    const currentLiftoff = liftoffRef.current
    const currentMathSpec = currentLiftoff?.currentAction?.problem?.math
    const writesFenced = snapshotServiceRef.current?.writesFenced
    if (phase !== 'active' || lineHelpTarget || lineHelpBusy || writesFenced || submitLockRef.current || busy || !lesson || !currentLiftoff) return
    if (currentMathSpec && !slateMathSessionMatchesSpec({
      math: currentMathSpec,
      snapshot: activeMath,
      activityId: activeMath?.activityId,
      phase: 'teaching',
    })) {
      setMathError('This math activity needs attention before it can be submitted. Your saved work has not been reset.')
      return
    }
    if (!learnerResponse && !currentMathSpec) return
    if (activeMath && mathArchiveRef.current.length >= SLATE_MATH_ARCHIVE_LIMIT) {
      setMathError('Math evidence storage is full. Ask a facilitator to preserve this lesson before continuing.')
      return
    }
    submitLockRef.current = true
    setBusy(true)
    try {
      let pending = null
      if (activeMath) {
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
          const response = await fetch('/api/slate-liftoff', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mode: 'line_help', lesson,
              sourceLine: buildMathConversationContext({ prompt: currentLiftoff.currentAction?.problem?.prompt, problem, view: activeMath.view }),
              action: 'ask', learnerQuestion: learnerResponse, phase: 'teaching' }),
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
        setAnswer('')
        appendTranscript('user', learnerResponse)
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
          ...(pending ? { mathSession: pending.mathSession, mathSubmission: pending.submission } : {}),
        }),
      })
      if (snapshotServiceRef.current?.writesFenced) return
      const turn = await response.json().catch(() => null)
      if (!response.ok || !turn?.ok) throw new Error(turn?.error || 'Mr. Slate could not evaluate that step.')
      if (pending && !slateMathReceiptMatches({
        receipt: turn.mathReceipt,
        pending,
        currentActivityId: mathSessionRef.current?.activityId,
        currentRevision: mathSessionRef.current?.revision,
        currentTurnNumber: liftoffRef.current?.turnNumber,
      })) throw new Error('That math response is no longer current. Your work was kept so you can submit it again.')
      if (liftoffRef.current?.turnNumber !== submittedState.turnNumber) return

      const nextState = applyLiftoffTurn(submittedState, turn)
      if (pending) {
        const archived = appendSlateMathArchive(mathArchiveRef.current, pending.mathSession, {
          activityId: pending.submission.activityId,
          requestId: pending.submission.requestId,
          submittedRevision: pending.submission.submittedRevision,
          turnNumber: pending.turnNumber,
        })
        if (!archived.ok) throw new Error(archived.error)
        mathArchiveRef.current = archived.archive
        setMathArchive(archived.archive)
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
      const nextLines = separateLiftoffTranscriptQuestion(turn.learnerMessage, nextQuestion)
      if (nextLines.response) appendTranscript('assistant', nextLines.response)
      if (nextLines.question) appendTranscript('assistant', nextLines.question, { kind: 'liftoff_question' })
      void speak(turn.learnerMessage)
      if (readyForTest) {
        beginIndependentAssessment(lesson, nextState)
      } else {
        void persistLiftoffSnapshot({ phase: 'active', liftoff: nextState, slateText: turn.learnerMessage })
      }
    } catch (cause) {
      if (activeMath) setMathError(cause?.message || 'Mr. Slate could not continue Liftoff. Your math work was kept.')
      else setError(cause?.message || 'Mr. Slate could not continue Liftoff.')
    } finally {
      setBusy(false)
      submitLockRef.current = false
    }
  }, [answer, appendTranscript, beginIndependentAssessment, busy, lesson, lineHelpBusy, lineHelpTarget, persistLiftoffSnapshot, phase, scheduleMathSnapshot, selectedMathTextLocation, speak])

  const finishLesson = useCallback(async (results, { stillOwns = finishOwnershipRef.current || (() => true) } = {}) => {
    if (!stillOwns()) return
    const total = results.length
    const correct = results.filter((result) => result.correct).length
    const percentage = total ? Math.round((correct / total) * 100) : null
    setFinalPercentage(percentage)
    const activeSession = sessionRef.current
    if (!activeSession?.id) throw new Error('The Liftoff session identity was lost before completion.')

    const completed = await endLessonSession(activeSession.id, {
      reason: 'completed',
      learnerId,
      lessonId: lessonKey,
      occurrenceId: activeSession.occurrenceId || occurrenceId,
      metadata: { source: 'slate-liftoff', test_percentage: percentage },
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
    const originalResponse = rawAnswer
    const mathResolved = assessmentMathResolution
    const isMath = mathResolved.kind === 'math'
    if (phase !== 'test' || !item || busy || assessmentSubmitLockRef.current || snapshotServiceRef.current?.writesFenced) return
    if (mathResolved.kind === 'invalid') { setAssessmentMathError(mathResolved.error); return }
    if (!isMath && !rawAnswer) return
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

      if (!isMath && !pending) {
        pending = {
          id: slateMathRequestId('assessment'), index: submittedIndex, question: submittedQuestion,
          answer: rawAnswer, status: 'judge', transcriptRecorded: false,
        }
        assessmentMathPendingRef.current = pending
        setAssessmentMathPending(pending)
        if (!await persistLiftoffSnapshot()) throw new Error('The test response could not be safely saved yet. Please submit it again.')
      }
      if (pending?.status === 'judge') {
        const correct = await judgeAssessmentItem(item, pending.answer)
        if (!stillOwnsItem()) return
        pending = {
          ...pending,
          status: 'evidence',
          result: { question: submittedQuestion, answer: pending.answer, correct, expected: expectedText(item) },
        }
        assessmentMathPendingRef.current = pending
        setAssessmentMathPending(pending)
        if (!await persistLiftoffSnapshot()) throw new Error('The test response could not be safely saved yet. Please submit it again.')
      }

      if (!pending) {
        let result
        if (isMath) {
          let activeMath = assessmentMathSessionRef.current
          if (!activeMath || activeMath.phase !== 'test') {
            setAssessmentMathError('This test math item is not ready. Your work was kept.')
            return
          }
          if (rawAnswer) {
            const route = routeMathTextInput(
              buildMathActivityProblem(mathResolved.spec), activeMath.view, rawAnswer,
              { selectedLocation: assessmentMathTextLocationRef.current || null },
            )
            if (route.kind === 'conversation') {
              setAssessmentMathError('Help is not available during the test.')
              return
            }
            if (route.kind === 'clarification') {
              setAssessmentMathError(mathResolved.spec.operation === 'division'
                ? 'Enter both the quotient and remainder, or select an answer row.'
                : 'Select the space or answer row for this entry.')
              return
            }
            if (route.kind === 'invalid') {
              setAssessmentMathError(route.message)
              return
            }
            if (route.kind === 'entry') {
              const updated = updateMathSessionView(activeMath, route.view, {
                activityId: activeMath.activityId,
                expectedRevision: activeMath.revision,
                requestId: slateMathRequestId('test-input'),
              })
              if (!updated.ok) { setAssessmentMathError(updated.error); return }
              activeMath = updated.state
              assessmentMathSessionRef.current = activeMath
              setAssessmentMathSession(activeMath)
            }
          }
          if (!mathTestSubmissionReady(activeMath)) {
            setAssessmentMathError('Enter an answer in each answer row before submitting.')
            scheduleMathSnapshot()
            return
          }
          const problem = buildMathActivityProblem(mathResolved.spec)
          const privateEvaluation = evaluateMathTestAnswer(problem, activeMath.view)
          const submitted = submitMathSession(activeMath, {
            activityId: activeMath.activityId,
            expectedRevision: activeMath.revision,
            requestId: slateMathRequestId('test-submit'),
          })
          if (!submitted.ok) { setAssessmentMathError(submitted.error); return }
          assessmentMathSessionRef.current = submitted.state
          setAssessmentMathSession(submitted.state)
          rawAnswer = formatSlateMathTestResponse(activeMath)
          result = {
            question: submittedQuestion,
            answer: rawAnswer,
            correct: privateEvaluation.correct === true,
            expected: expectedText(item),
            math: {
              source: mathResolved.source,
              response: rawAnswer,
              originalResponse,
              textLocation: assessmentMathTextLocationRef.current || '',
              entries: { ...submitted.submission.entries },
              submission: submitted.submission,
              snapshot: submitted.state,
            },
          }
        }

        pending = {
          id: pending?.id || slateMathRequestId('assessment'),
          index: submittedIndex,
          question: submittedQuestion,
          answer: rawAnswer,
          result,
          status: 'evidence',
          transcriptRecorded: false,
        }
        assessmentMathPendingRef.current = pending
        setAssessmentMathPending(pending)
        if (!await persistLiftoffSnapshot()) throw new Error('The test response could not be safely saved yet. Please submit it again.')
      }

      if (!stillOwnsItem()) return
      if (!pending.transcriptRecorded) {
        appendTranscript('assistant', submittedQuestion)
        appendTranscript('user', pending.answer)
        pending = { ...pending, transcriptRecorded: true }
        assessmentMathPendingRef.current = pending
        setAssessmentMathPending(pending)
        if (!await persistLiftoffSnapshot()) throw new Error('The test response could not be safely saved yet. Please submit it again.')
      }

      if (!pending.evidenceRecorded) {
        const masteryOutcome = await recordCanonicalMasteryAnswer({
          item, index: submittedIndex, answer: pending.answer, correct: pending.result.correct,
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
  }, [appendTranscript, assessmentAnswer, assessmentIndex, assessmentMathResolution, busy, currentAssessment, currentAssessmentItems, finishLesson, persistLiftoffSnapshot, phase, recordCanonicalMasteryAnswer, scheduleMathSnapshot, testItems.length, testResults])

  if (phase === 'loading') {
    return <div style={{ minHeight: '100vh', background: C.bg, color: C.muted, display: 'grid', placeItems: 'center', fontFamily: C.font }}>PREPARING LIFTOFF...</div>
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
          {finalPercentage != null && <p style={{ fontSize: 20, color: C.green }}>Independent test: {finalPercentage}%</p>}
          <p style={{ color: C.muted }}>Liftoff transferred the procedure before the independent assessment.</p>
          <button onClick={() => router.push('/learn')} style={{ padding: '12px 20px', cursor: 'pointer', fontWeight: 800 }}>Back to lessons</button>
          <audio ref={audioRef} style={{ display: 'none' }} />
        </div>
      </div>
    )
  }

  const isAssessment = phase === 'test'
  const lessonInteractionHeld = Boolean(lineHelpTarget) || lineHelpBusy
  const activeMathTranscriptContent = phase === 'active' && activeMathSpec ? (
    <div data-slate-active-math-transcript-tail style={{ borderTop: `1px solid ${mathError ? C.red : C.border}`, marginTop: 12, paddingTop: 14 }}>
      {activeMathProblem && activeMathMatches ? (
        <fieldset disabled={busy || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <VerticalMathWorkspace
            problem={activeMathProblem}
            view={mathSession.view}
            onViewChange={changeMathView}
            notes={mathWorkingNotes?.activityId === mathSession.activityId ? mathWorkingNotes.notes : {}}
            onNotesChange={changeMathWorkingNotes}
            selectedLocation={selectedMathTextLocation || null}
            onCellSelect={(location) => {
              if (mathSession.view.editable.includes(location)) setSelectedMathTextLocation(location)
            }}
            phase="teaching"
            showCheck={false}
            showFullAnswerInputs={false}
          />
        </fieldset>
      ) : (
        <div role="alert" style={{ color: C.red, fontWeight: 700 }}>
          This math activity needs attention before it can be submitted. Your saved work has not been reset.
        </div>
      )}
      {mathError && <div role="status" style={{ color: C.red, fontWeight: 700, marginTop: 10 }}>{mathError}</div>}
    </div>
  ) : null

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, fontFamily: C.font, display: 'flex', flexDirection: 'column' }}>
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

      <main style={{ flex: 1, minHeight: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: 16, padding: 16 }}>
        <section style={{ minWidth: 0, flex: '1 1 520px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className={styles.videoTranscriptLayout}>
            <div className={styles.videoColumn}>
              <ReviewTeacherVideoStage teacher="slate" ref={videoRef} />
            </div>

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
              stackedHeight={activeMathSpec ? 'clamp(260px, 42vh, 460px)' : null}
              tailContent={activeMathTranscriptContent}
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
          </div>

          {phase === 'active' && (
            !activeMathSpec ? (
            <form data-slate-primary-answer-form onSubmit={(event) => { event.preventDefault(); void submitLiftoffAnswer() }} style={{ position: 'sticky', bottom: 0, zIndex: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', width: '100%', maxWidth: '100%', padding: '10px 0', background: C.bg }}>
              <WebbDictationButton
                disabled={busy || lessonInteractionHeld}
                onBeforeRecord={() => answerInputRef.current?.blur()}
                onTranscript={(text) => {
                  setAnswer((current) => [current.trim(), text].filter(Boolean).join(' '))
                }}
              />
              <textarea
                ref={answerInputRef}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
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
              <button disabled={busy || lessonInteractionHeld || !answer.trim()} style={{ alignSelf: 'stretch', minWidth: 110, cursor: 'pointer', fontWeight: 900 }}>
                {busy ? 'CHECKING...' : 'SUBMIT'}
              </button>
            </form>
            ) : (
            <form data-slate-primary-answer-form onSubmit={(event) => { event.preventDefault(); void submitLiftoffAnswer() }} style={{ position: 'sticky', bottom: 0, zIndex: 20, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', width: '100%', maxWidth: '100%', padding: '10px 0', background: C.bg }}>
              {mathTextDestinations.length > 0 && <select aria-label="Text answer destination" value={selectedMathTextLocation} onChange={(event) => setSelectedMathTextLocation(event.target.value)} disabled={busy || lessonInteractionHeld} style={{ alignSelf: 'stretch', flex: '1 1 180px', minWidth: 0, maxWidth: '100%', background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                {mathTextDestinations.map((destination) => <option key={destination.value} value={destination.value}>{destination.label}</option>)}
              </select>}
              <WebbDictationButton disabled={busy || lessonInteractionHeld} onBeforeRecord={() => answerInputRef.current?.blur()} onTranscript={(text) => setAnswer((current) => [current.trim(), text].filter(Boolean).join(' '))} />
              <textarea ref={answerInputRef} value={answer} onChange={(event) => setAnswer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent?.isComposing) { event.preventDefault(); void submitLiftoffAnswer() } }} placeholder="Type your answer, explain your thinking, or ask a question." rows={2} disabled={busy || lessonInteractionHeld} style={{ flex: '1 1 280px', minWidth: 0, width: '100%', boxSizing: 'border-box', resize: 'vertical', background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, font: 'inherit' }} />
              <button disabled={busy || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced || (!answer.trim() && (snapshotServiceRef.current?.writesFenced || !mathSubmitReady))} style={{ alignSelf: 'stretch', minWidth: 110, cursor: 'pointer', fontWeight: 900 }}>{busy ? 'CHECKING...' : 'SUBMIT'}</button>
            </form>
            )
          )}

          {isAssessment && currentAssessment && (
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
                <div style={{ color: C.muted, fontSize: 12 }}>TEST {assessmentIndex + 1}/{currentAssessmentItems.length}</div>
                {phase === 'test' && <button type="button" onClick={() => void printIndependentTest()} disabled={testPrintBusy || busy} style={{ padding: '7px 10px', background: C.surface2, color: C.accent, border: '1px solid ' + C.border, borderRadius: 6, fontFamily: C.font, fontWeight: 800, cursor: testPrintBusy ? 'wait' : 'pointer' }}>{testPrintBusy ? 'PREPARING PDF...' : 'PRINT TEST'}</button>}
              </div>
              {testPrintError && <div role="alert" style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>{testPrintError}</div>}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 16 }}>
                <div
                  role="button"
                  tabIndex={busy ? -1 : 0}
                  aria-label={`Hear this question again: ${questionText(currentAssessment)}`}
                  title="Click to hear this question again"
                  onClick={!busy ? () => replayTranscriptLine({ text: questionText(currentAssessment) }) : undefined}
                  onKeyDown={!busy ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      replayTranscriptLine({ text: questionText(currentAssessment) })
                    }
                  } : undefined}
                  style={{ flex: 1, minWidth: 0, fontSize: 17, lineHeight: 1.55, cursor: busy ? 'default' : 'pointer' }}
                >{questionText(currentAssessment)}</div>
              </div>

              {assessmentMathResolution.kind === 'invalid' ? (
                <div role="alert" style={{ color: C.red, fontWeight: 700 }}>
                  This test item cannot be scored because its math setup is invalid. Your test work has been kept.
                </div>
              ) : assessmentMathResolution.kind === 'math' ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  {assessmentMathProblem && assessmentMathMatches ? (
                    <fieldset disabled={busy || lineHelpBusy || Boolean(lineHelpTarget) || snapshotServiceRef.current?.writesFenced} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
                      <VerticalMathWorkspace
                        problem={assessmentMathProblem}
                        view={assessmentMathSession.view}
                        onViewChange={changeAssessmentMathView}
                        notes={assessmentMathWorkingNotes?.activityId === assessmentMathSession.activityId ? assessmentMathWorkingNotes.notes : {}}
                        onNotesChange={changeAssessmentMathWorkingNotes}
                        selectedLocation={assessmentMathTextLocation || null}
                        onCellSelect={(location) => {
                          if (assessmentMathSession.view.editable.includes(location)) {
                            assessmentMathTextLocationRef.current = location
                            setAssessmentMathTextLocation(location)
                            scheduleMathSnapshot()
                          }
                        }}
                        showCheck={false}
                        phase="test"
                        showFullAnswerInputs={false}
                      />
                    </fieldset>
                  ) : (
                    <div role="alert" style={{ color: C.red, fontWeight: 700 }}>This test math item could not be opened. Your work has been kept.</div>
                  )}
                  <form onSubmit={(event) => { event.preventDefault(); void submitAssessmentAnswer() }} style={{ display: 'flex', gap: 10 }}>
                    {assessmentMathDestinations.length > 0 && <select aria-label="Text answer destination" value={assessmentMathTextLocation} onChange={(event) => {
                      assessmentMathTextLocationRef.current = event.target.value
                      setAssessmentMathTextLocation(event.target.value)
                      scheduleMathSnapshot()
                    }} disabled={busy || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced} style={{ maxWidth: 190, background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8 }}>
                      {assessmentMathDestinations.map((destination) => <option key={destination.value} value={destination.value}>{destination.label}</option>)}
                    </select>}
                    <input value={assessmentAnswer} onChange={(event) => {
                      assessmentMathTextRef.current = event.target.value
                      setAssessmentAnswer(event.target.value)
                      setAssessmentMathError('')
                      scheduleMathSnapshot()
                    }} disabled={busy || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced} placeholder="Type an answer or use the math grid" style={{ flex: 1, padding: 12, background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8 }} />
                    <button disabled={busy || lessonInteractionHeld || snapshotServiceRef.current?.writesFenced} style={{ padding: '10px 18px', cursor: 'pointer' }}>SUBMIT</button>
                  </form>
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
              ) : (
                <form onSubmit={(event) => { event.preventDefault(); void submitAssessmentAnswer() }} style={{ display: 'flex', gap: 10 }}>
                  <input value={assessmentAnswer} onChange={(event) => { assessmentMathTextRef.current = event.target.value; setAssessmentAnswer(event.target.value) }} disabled={busy || lessonInteractionHeld} style={{ flex: 1, padding: 12, background: C.surface2, color: C.text, border: `1px solid ${C.border}`, borderRadius: 8 }} />
                  <button disabled={busy || lessonInteractionHeld || !assessmentAnswer.trim()} style={{ padding: '10px 18px', cursor: 'pointer' }}>SUBMIT</button>
                </form>
              )}

            </div>
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

        <aside aria-label="Lesson progress" style={{ flex: '0 1 320px', minWidth: 'min(260px, 100%)', maxWidth: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14 }}>
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
      </main>

      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  )
}
