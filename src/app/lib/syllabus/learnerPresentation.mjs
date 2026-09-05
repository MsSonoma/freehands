export function resolveLearnerSyllabusPresentation({
  learnerId,
  demoLearner = false,
  syllabusStatus = 'idle',
  syllabusDecisionLearnerId = '',
  syllabusKind = 'fallback',
  selectedLesson = false,
} = {}) {
  const decisionReady = demoLearner || Boolean(
    learnerId
    && syllabusStatus === 'ready'
    && syllabusDecisionLearnerId === learnerId,
  )
  const active = !demoLearner && decisionReady && syllabusKind === 'active'
  const pending = !demoLearner && !decisionReady
  const fallback = !pending && !active

  return {
    state: pending ? 'pending' : active ? 'active' : 'fallback',
    showOpening: pending,
    showActiveSyllabus: active,
    showFallbackMessage: fallback && !demoLearner,
    showLegacyLibraryHeading: fallback,
    showSupportingLibrary: fallback || (active && Boolean(selectedLesson)),
    allowLegacyTutorial: fallback && !demoLearner,
  }
}

export function learnerNowViewportKey({
  role,
  learnerId,
  revisionId,
  weekState,
  weekStart,
} = {}) {
  if (role !== 'learner' || !learnerId || !revisionId || weekState !== 'now' || !weekStart) return ''
  return `${learnerId}:${revisionId}:${weekStart}`
}

export function shouldEstablishLearnerNowViewport(key, establishedKey) {
  return Boolean(key && key !== establishedKey)
}
