function clean(value) { return String(value || '').trim() }

export function buildForecastViewIdentity({ learnerId, activeRevisionId, targetWeek, selectedWeekStart } = {}) {
  const parts = [learnerId, activeRevisionId, targetWeek, selectedWeekStart].map(clean)
  return parts.every(Boolean) ? parts.join(':') : ''
}

export function isCurrentForecastResponse({ requestIdentity, currentIdentity, requestSequence, currentSequence } = {}) {
  return Boolean(requestIdentity)
    && requestIdentity === currentIdentity
    && Number.isInteger(requestSequence)
    && requestSequence === currentSequence
}
