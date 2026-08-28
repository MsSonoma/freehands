const EXPLICIT_LIFECYCLE_TYPES = new Set(['completed', 'incomplete', 'restarted', 'exited'])

function clean(value) {
  return String(value || '').trim().toLowerCase()
}

function compareEvents(left, right) {
  const leftTime = Date.parse(left?.occurred_at)
  const rightTime = Date.parse(right?.occurred_at)
  if (Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime !== rightTime) return leftTime - rightTime
  if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) return Number.isFinite(leftTime) ? 1 : -1
  return String(left?.id || '').localeCompare(String(right?.id || ''))
}

export function latestExplicitLessonSessionEvent(events = []) {
  let latest = null
  for (const event of Array.isArray(events) ? events : []) {
    if (!EXPLICIT_LIFECYCLE_TYPES.has(clean(event?.event_type))) continue
    if (!latest || compareEvents(event, latest) > 0) latest = event
  }
  return latest
}

export function resolveLessonSessionLifecycle(session = {}, events = []) {
  const event = latestExplicitLessonSessionEvent(events)
  const eventType = clean(event?.event_type)
  if (eventType) {
    return {
      status: eventType === 'completed' ? 'completed' : 'incomplete',
      event,
      occurredAt: event?.occurred_at || session?.ended_at || session?.started_at || null,
      legacyFallback: false,
    }
  }
  if (session?.ended_at) {
    return { status: 'completed', event: null, occurredAt: session.ended_at, legacyFallback: true }
  }
  return { status: 'in-progress', event: null, occurredAt: session?.started_at || null, legacyFallback: false }
}

export function lifecycleEventActualKind(eventType) {
  return clean(eventType) === 'completed' ? 'completed' : 'incomplete'
}
