function clean(value) { return String(value || '').trim() }

export function buildForecastViewIdentity({ learnerId, activeRevisionId, targetWeek } = {}) {
  const parts = [learnerId, activeRevisionId, targetWeek].map(clean)
  return parts.every(Boolean) ? parts.join(':') : ''
}

export function buildAutomaticForecastAttemptIdentity({ requestIdentity, refreshSequence } = {}) {
  const identity = clean(requestIdentity)
  return identity && Number.isInteger(refreshSequence) && refreshSequence > 0
    ? `${identity}:${refreshSequence}`
    : ''
}

export function isCurrentForecastResponse({ requestIdentity, currentIdentity, requestSequence, currentSequence } = {}) {
  return Boolean(requestIdentity)
    && requestIdentity === currentIdentity
    && Number.isInteger(requestSequence)
    && requestSequence === currentSequence
}
