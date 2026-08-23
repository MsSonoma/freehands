const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const REQUIRED_SECTIONS = ['goals', 'subjects', 'weekly_pattern', 'teaching_guidance', 'planning_policy', 'legacy_provenance', 'forecast_items']
const ITEM_TYPES = new Set(['lesson', 'review', 'check', 'unit'])
const ORIGINS = new Set(['legacy_import', 'generated', 'facilitator', 'mastery_reforecast'])

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const cleanText = (value) => typeof value === 'string' ? value.trim() : ''

export function isCalendarDate(value) {
  const match = DATE.exec(String(value || ''))
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
}

function weeklySubjectReferences(weeklyPattern) {
  const references = []
  for (const [day, entries] of Object.entries(weeklyPattern)) {
    if (!Array.isArray(entries)) throw new SyllabusError(`weekly_pattern.${day} must be an array`)
    entries.forEach((entry, index) => {
      const subject = cleanText(typeof entry === 'string' ? entry : entry?.subject)
      if (!subject) throw new SyllabusError(`weekly_pattern.${day}[${index}] must have a subject`)
      references.push({ subject, location: `weekly_pattern.${day}[${index}]` })
    })
  }
  return references
}

export class SyllabusError extends Error {
  constructor(message, status = 400, code = 'SYLLABUS_ERROR') {
    super(message)
    this.name = 'SyllabusError'
    this.status = status
    this.code = code
  }
}

export function todayDate(now = new Date()) {
  return now.toISOString().slice(0, 10)
}

export function validateLearnerId(value) {
  if (!UUID.test(String(value || ''))) throw new SyllabusError('A valid learnerId is required')
  return String(value)
}

export function validateSnapshot(input, { today = todayDate() } = {}) {
  if (!isObject(input)) throw new SyllabusError('A complete Syllabus snapshot is required')
  const missing = REQUIRED_SECTIONS.filter((key) => !Object.prototype.hasOwnProperty.call(input, key))
  if (missing.length) throw new SyllabusError(`Missing required snapshot sections: ${missing.join(', ')}`)
  if (!isObject(input.goals)) throw new SyllabusError('goals must be an object')
  if (!Array.isArray(input.subjects)) throw new SyllabusError('subjects must be an array')
  if (!isObject(input.weekly_pattern)) throw new SyllabusError('weekly_pattern must be an object')
  if (!isObject(input.teaching_guidance)) throw new SyllabusError('teaching_guidance must be an object')
  if (!isObject(input.planning_policy)) throw new SyllabusError('planning_policy must be an object')
  if (!isObject(input.legacy_provenance)) throw new SyllabusError('legacy_provenance must be an object')
  if (!Array.isArray(input.forecast_items)) throw new SyllabusError('forecast_items must be an array')

  if (!isCalendarDate(today)) throw new SyllabusError('Server activation date is invalid', 500)
  // Phase 1 contract: omission means the server's activation date; an explicit
  // value is accepted only when it exactly matches that server-resolved date.
  const suppliedEffectiveFrom = cleanText(input.effective_from)
  if (suppliedEffectiveFrom && !isCalendarDate(suppliedEffectiveFrom)) {
    throw new SyllabusError('effective_from must be a valid YYYY-MM-DD date')
  }
  if (suppliedEffectiveFrom && suppliedEffectiveFrom !== today) {
    throw new SyllabusError('Phase 1 activation requires effective_from to equal today')
  }
  const effectiveFrom = today

  const subjects = input.subjects.map((entry, index) => {
    const name = cleanText(typeof entry === 'string' ? entry : entry?.name)
    if (!name) throw new SyllabusError(`subjects[${index}] must have a name`)
    return typeof entry === 'string' ? { name } : { ...entry, name }
  })
  const declaredSubjectKeys = new Set(subjects.map((entry) => entry.name.toLocaleLowerCase()))
  if (declaredSubjectKeys.size !== subjects.length) throw new SyllabusError('subjects must not contain duplicate names')

  for (const reference of weeklySubjectReferences(input.weekly_pattern)) {
    if (!declaredSubjectKeys.has(reference.subject.toLocaleLowerCase())) {
      throw new SyllabusError(`${reference.location} references undeclared subject "${reference.subject}"`)
    }
  }

  const forecastItems = input.forecast_items.map((item, index) => {
    if (!isObject(item)) throw new SyllabusError(`forecast_items[${index}] must be an object`)
    const plannedDate = cleanText(item.planned_date)
    const subject = cleanText(item.subject)
    const title = cleanText(item.title)
    const itemType = cleanText(item.item_type)
    const origin = cleanText(item.origin)
    if (!isCalendarDate(plannedDate)) throw new SyllabusError(`forecast_items[${index}].planned_date is invalid`)
    if (plannedDate < effectiveFrom) throw new SyllabusError(`forecast_items[${index}].planned_date cannot be before effective_from`)
    if (!subject || !title) throw new SyllabusError(`forecast_items[${index}] requires subject and title`)
    if (!declaredSubjectKeys.has(subject.toLocaleLowerCase())) {
      throw new SyllabusError(`forecast_items[${index}].subject references undeclared subject "${subject}"`)
    }
    if (!ITEM_TYPES.has(itemType)) throw new SyllabusError(`forecast_items[${index}].item_type is invalid`)
    if (!ORIGINS.has(origin)) throw new SyllabusError(`forecast_items[${index}].origin is invalid`)
    if (!UUID.test(String(item.lineage_id || ''))) throw new SyllabusError(`forecast_items[${index}].lineage_id is invalid`)
    if (item.metadata !== undefined && !isObject(item.metadata)) throw new SyllabusError(`forecast_items[${index}].metadata must be an object`)
    return {
      lineage_id: item.lineage_id,
      planned_date: plannedDate,
      subject,
      title,
      lesson_key: cleanText(item.lesson_key) || null,
      item_type: itemType,
      origin,
      sort_order: Number.isInteger(item.sort_order) ? item.sort_order : index,
      metadata: item.metadata || {},
    }
  }).sort((a, b) => a.planned_date.localeCompare(b.planned_date) || a.sort_order - b.sort_order || a.title.localeCompare(b.title))

  return {
    schema_version: 1,
    effective_from: effectiveFrom,
    goals: structuredClone(input.goals),
    subjects,
    weekly_pattern: structuredClone(input.weekly_pattern),
    teaching_guidance: structuredClone(input.teaching_guidance),
    planning_policy: structuredClone(input.planning_policy),
    legacy_provenance: structuredClone(input.legacy_provenance),
    forecast_items: forecastItems,
    change_reason: cleanText(input.change_reason) || null,
  }
}
