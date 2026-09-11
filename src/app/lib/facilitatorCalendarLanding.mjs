export const LEGACY_CALENDAR_AUTHORING_TABS = Object.freeze(['planner', 'subjects'])

export function resolveCalendarLandingParams(params) {
  const reader = params instanceof URLSearchParams
    ? params
    : new URLSearchParams(params || '')
  const requestedTab = reader.get('tab') || ''
  return {
    openPortfolio: reader.get('portfolio') === '1',
    redirectToSyllabus: LEGACY_CALENDAR_AUTHORING_TABS.includes(requestedTab),
    learnerId: reader.get('learnerId') || '',
    date: reader.get('date') || '',
    lessonKey: reader.get('lessonKey') || '',
    occurrenceId: reader.get('occurrenceId') || '',
  }
}
