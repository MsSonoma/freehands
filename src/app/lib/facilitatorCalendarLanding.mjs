export const CALENDAR_TABS = Object.freeze(['scheduler', 'planner', 'subjects'])

export function resolveCalendarLandingParams(params) {
  const reader = params instanceof URLSearchParams
    ? params
    : new URLSearchParams(params || '')
  const requestedTab = reader.get('tab') || 'scheduler'
  const activeTab = CALENDAR_TABS.includes(requestedTab) ? requestedTab : 'scheduler'
  return {
    activeTab,
    openPortfolio: reader.get('portfolio') === '1',
  }
}