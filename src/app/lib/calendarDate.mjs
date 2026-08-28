const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/

export function validTimeZone(value) {
  const timeZone = String(value || '').trim()
  if (!timeZone || timeZone.length > 128) return null
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date())
    return timeZone
  } catch {
    return null
  }
}

export function calendarDateInTimeZone(now = new Date(), timeZone = 'UTC') {
  const resolvedZone = validTimeZone(timeZone) || 'UTC'
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: resolvedZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const date = `${values.year}-${values.month}-${values.day}`
  if (!CALENDAR_DATE.test(date)) throw new Error('Could not resolve the local calendar date')
  return date
}

export function resolveCalendarContext({ now = new Date(), profileTimeZone, fallbackTimeZone } = {}) {
  const timeZone = validTimeZone(profileTimeZone) || validTimeZone(fallbackTimeZone) || 'UTC'
  return { timeZone, today: calendarDateInTimeZone(now, timeZone) }
}
