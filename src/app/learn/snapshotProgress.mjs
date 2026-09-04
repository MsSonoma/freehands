import { lessonKeyBasename, normalizeLessonKey } from '../lib/lessonKeyNormalization.js'

const RESUMABLE_PHASES = new Set(['discussion', 'teaching', 'comprehension', 'exercise', 'worksheet', 'test'])
const NON_RESUMABLE_PHASES = new Set(['closing', 'complete', 'completed', 'congrats'])

function cleanPhase(value) {
  return String(value || '').trim().toLowerCase()
}

function hasAnswers(value) {
  return Array.isArray(value) && value.some((answer) => {
    if (answer == null) return false
    if (typeof answer === 'object') return Object.keys(answer).length > 0
    return String(answer).trim().length > 0
  })
}

function positiveIndex(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0
}

function phaseHasProgress(phase, data = {}, snapshot = {}) {
  if (!data || typeof data !== 'object' || data.completedAt) return false

  if (phase === 'baseline') {
    return cleanPhase(data.status) === 'active' && hasAnswers(data.responses)
  }
  if (phase === 'retention') {
    return cleanPhase(data.status) === 'active'
      && Array.isArray(data.responses)
      && data.responses.length === 0
      && Array.isArray(data?.plan?.selectedItems)
      && data.plan.selectedItems.length > 0
  }

  if (phase === 'discussion') {
    return positiveIndex(data.turnCount)
      || (Array.isArray(data.completedObjectiveIndices) && data.completedObjectiveIndices.length > 0)
      || Boolean(data.sentenceKey)
      || (Array.isArray(snapshot?.transcript?.lines) && snapshot.transcript.lines.length > 0)
  }
  if (phase === 'teaching') {
    return positiveIndex(data.sentenceIndex)
      || ['concept', 'definitions', 'vocabulary', 'lecture', 'examples'].includes(cleanPhase(data.stage))
      || Boolean(data.conceptCompleted)
  }
  if (['comprehension', 'exercise', 'worksheet', 'test'].includes(phase)) {
    return positiveIndex(data.nextQuestionIndex ?? data.questionIndex)
      || hasAnswers(data.answers)
      || ['comprehension-answer', 'comprehension-skip', 'exercise-answer', 'exercise-skip', 'worksheet-answer', 'worksheet-skip', 'test-answer', 'test-skip'].includes(String(data.lastAction || ''))
  }
  return false
}

/**
 * Distinguish durable learner work from lifecycle state. Canonical completion is
 * deliberately not inferred here; callers must continue to use lifecycle history.
 */
export function snapshotHasMeaningfulProgress(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false

  const currentPhase = cleanPhase(snapshot.currentPhase || snapshot.resume?.phase || snapshot.phase || 'discussion')
  if (NON_RESUMABLE_PHASES.has(currentPhase)) return false
  if (currentPhase === 'test' && Number.isFinite(snapshot.testFinalPercent)) return false

  const phaseData = snapshot.phaseData && typeof snapshot.phaseData === 'object' ? snapshot.phaseData : {}
  if (['baseline', 'retention'].includes(currentPhase) && phaseHasProgress(currentPhase, phaseData[currentPhase], snapshot)) return true
  if (RESUMABLE_PHASES.has(currentPhase) && phaseHasProgress(currentPhase, phaseData[currentPhase], snapshot)) return true

  // currentPhase can advance before the first granular action lands. Preserve
  // earlier unfinished phase data, but never a completed phase checkpoint.
  for (const phase of RESUMABLE_PHASES) {
    if (phaseHasProgress(phase, phaseData[phase], snapshot)) return true
  }

  // Legacy snapshot compatibility.
  if (snapshot.showBegin === false || snapshot.qaAnswersUnlocked) return true
  if (snapshot.resume?.kind === 'question') return true
  if (snapshot.subPhase && snapshot.subPhase !== 'greeting') return true
  if (positiveIndex(snapshot.currentCompIndex)) return true
  if (positiveIndex(snapshot.currentExIndex)) return true
  if (positiveIndex(snapshot.currentWorksheetIndex)) return true
  if (positiveIndex(snapshot.testActiveIndex)) return true
  if (snapshot.currentCompProblem || snapshot.currentExerciseProblem) return true
  if (hasAnswers(snapshot.testUserAnswers)) return true
  if (Array.isArray(snapshot.storyTranscript) && snapshot.storyTranscript.length > 0) return true

  return false
}

function canonicalLessonIdentity(value) {
  return String(normalizeLessonKey(value) || '').replace(/\.json$/i, '').toLowerCase()
}

function timestamp(value) {
  const parsed = Date.parse(value || '')
  return Number.isFinite(parsed) ? parsed : null
}

/**
 * Bind restorable snapshots to exact canonical Syllabus actual occurrences.
 * Each record is { lessonKey, snapshot }; callers choose the local/server
 * snapshot using the same precedence as SnapshotService before binding.
 */
export function bindSnapshotsToSyllabusOccurrences({ snapshotRecords, sessions, timelineItems, learnerId }) {
  const proposals = new Map()

  for (const record of snapshotRecords || []) {
    const snapshot = record?.snapshot
    const candidateLessonKey = record?.lessonKey
    const snapshotUpdatedAt = timestamp(snapshot?.lastUpdated)
    if (!snapshotHasMeaningfulProgress(snapshot)
      || !snapshot?.sessionId
      || !snapshot?.learnerId
      || !snapshot?.lessonKey
      || snapshot.learnerId !== learnerId
      || snapshotUpdatedAt == null
      || lessonKeyBasename(snapshot.lessonKey) !== lessonKeyBasename(candidateLessonKey)) continue

    const matchingSessions = (sessions || []).filter((session) => (
      session?.learner_id === learnerId
      && session?.session_id === snapshot.sessionId
      && canonicalLessonIdentity(session?.lesson_id) === canonicalLessonIdentity(candidateLessonKey)
      && timestamp(session?.started_at) != null
      && timestamp(session.started_at) <= snapshotUpdatedAt
    )).sort((left, right) => timestamp(right.started_at) - timestamp(left.started_at))

    if (!matchingSessions.length) continue
    const latestStartedAt = timestamp(matchingSessions[0].started_at)
    const latestMatches = matchingSessions.filter((session) => timestamp(session.started_at) === latestStartedAt)
    if (latestMatches.length !== 1 || !latestMatches[0]?.id) continue

    const occurrenceId = `actual:${latestMatches[0].id}`
    const occurrenceMatches = (timelineItems || []).filter((item) => (
      item?.occurrence_id === occurrenceId
      && item?.placement_kind === 'actual'
      && canonicalLessonIdentity(item?.lesson_key) === canonicalLessonIdentity(candidateLessonKey)
    ))
    if (occurrenceMatches.length === 1) {
      const factKey = `${snapshot.sessionId}|${lessonKeyBasename(snapshot.lessonKey)}|${snapshot.lastUpdated}`
      const occurrences = proposals.get(factKey) || new Set()
      occurrences.add(occurrenceId)
      proposals.set(factKey, occurrences)
    }
  }

  const bound = {}
  for (const occurrences of proposals.values()) {
    if (occurrences.size === 1) bound[[...occurrences][0]] = true
  }
  return bound
}

export function selectSnapshotForRestore(localSnapshot, serverSnapshot) {
  if (localSnapshot && typeof localSnapshot === 'object') return localSnapshot
  if (serverSnapshot && typeof serverSnapshot === 'object') return serverSnapshot
  return null
}

/**
 * Include historical Syllabus artifacts in snapshot discovery even when they
 * are no longer part of today's available/scheduled lesson library.
 */
export function snapshotCandidateLessons(activeLessonsBySubject, timelineItems, lessonLookup) {
  const candidates = new Map()

  Object.values(activeLessonsBySubject || {}).flat().forEach((lesson) => {
    if (lesson?.lessonKey && !lesson.lessonKey.startsWith('demo/')) {
      candidates.set(lesson.lessonKey, lesson)
    }
  })

  ;(timelineItems || []).forEach((item) => {
    const lessonKey = item?.lesson_key
    const lesson = lessonKey ? lessonLookup?.[lessonKey] : null
    if (lessonKey && lesson && !lessonKey.startsWith('demo/')) {
      candidates.set(lessonKey, { ...lesson, lessonKey })
    }
  })

  return [...candidates.values()]
}
