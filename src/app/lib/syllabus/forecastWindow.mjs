import { addSyllabusDays, dateOnly, startOfSyllabusWeek } from './timeline.mjs'

export function instructionalForecastWindow(today, targetWeekStart = '') {
  const currentDate = dateOnly(today)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(currentDate)) return { start: '', end: '' }
  const start = startOfSyllabusWeek(targetWeekStart || currentDate)
  if (!start) return { start: '', end: '' }
  return { start, end: addSyllabusDays(start, 6) }
}

export function instructionalForecastMode(today, targetWeekStart) {
  const currentWeek = startOfSyllabusWeek(today)
  const targetWeek = startOfSyllabusWeek(targetWeekStart)
  if (!currentWeek || !targetWeek) return 'none'
  if (targetWeek < currentWeek) return 'past'
  if (targetWeek <= addSyllabusDays(currentWeek, 7)) return 'automatic'
  return 'manual'
}