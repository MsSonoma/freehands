import { addSyllabusDays, dateOnly } from './timeline.mjs'

// Seven local calendar dates: today plus six, including unfinished current-week dates.
export function instructionalForecastWindow(today) {
  const start = dateOnly(today)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return { start: '', end: '' }
  return { start, end: addSyllabusDays(start, 6) }
}
