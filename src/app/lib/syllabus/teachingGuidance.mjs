import { SyllabusError } from './schema.mjs'

export const TEACHING_GUIDANCE_FIELDS = Object.freeze([
  Object.freeze({ label: 'Focus topics', globalKey: 'focus_topics', subjectKey: 'focusTopics' }),
  Object.freeze({ label: 'Focus concepts', globalKey: 'focus_concepts', subjectKey: 'focusConcepts' }),
  Object.freeze({ label: 'Focus keywords', globalKey: 'focus_keywords', subjectKey: 'focusKeywords' }),
  Object.freeze({ label: 'Avoid topics', globalKey: 'banned_topics', subjectKey: 'bannedTopics' }),
  Object.freeze({ label: 'Avoid concepts', globalKey: 'banned_concepts', subjectKey: 'bannedConcepts' }),
  Object.freeze({ label: 'Avoid words', globalKey: 'banned_words', subjectKey: 'bannedWords' }),
])

const GLOBAL_KEYS = new Set(TEACHING_GUIDANCE_FIELDS.map((field) => field.globalKey))
const SUBJECT_KEYS = new Set(TEACHING_GUIDANCE_FIELDS.map((field) => field.subjectKey))
const BLOCKED_SUBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_LIST_ITEMS = 100
const MAX_GUIDANCE_TEXT = 500
const MAX_SUBJECTS = 100

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

function cleanList(value, location, { rejectEmpty = true } = {}) {
  if (!Array.isArray(value) || value.length > MAX_LIST_ITEMS) {
    throw new SyllabusError(`${location} must be an array with at most ${MAX_LIST_ITEMS} items`)
  }
  return value.map((item, index) => {
    if (typeof item !== 'string') throw new SyllabusError(`${location}[${index}] must be text`)
    const cleaned = item.trim()
    if ((rejectEmpty && !cleaned) || cleaned.length > MAX_GUIDANCE_TEXT) {
      throw new SyllabusError(`${location}[${index}] must contain 1-${MAX_GUIDANCE_TEXT} characters`)
    }
    return cleaned
  }).filter(Boolean)
}

function rejectUnknownKeys(value, allowed, location) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new SyllabusError(`${location}.${key} is not an editable Teaching Guidance field`)
  }
}

export function validateTeachingGuidanceOverride(input) {
  if (!isRecord(input)) throw new SyllabusError('teachingGuidanceOverride must be an object')
  rejectUnknownKeys(input, new Set(['curriculum_preferences']), 'teachingGuidanceOverride')
  const preferences = input.curriculum_preferences
  if (!isRecord(preferences)) throw new SyllabusError('teachingGuidanceOverride.curriculum_preferences must be an object')
  rejectUnknownKeys(preferences, new Set([...GLOBAL_KEYS, 'subject_preferences']), 'teachingGuidanceOverride.curriculum_preferences')

  const validated = {}
  for (const field of TEACHING_GUIDANCE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(preferences, field.globalKey)) {
      validated[field.globalKey] = cleanList(preferences[field.globalKey], `teachingGuidanceOverride.curriculum_preferences.${field.globalKey}`)
    }
  }
  if (Object.prototype.hasOwnProperty.call(preferences, 'subject_preferences')) {
    if (!isRecord(preferences.subject_preferences)) {
      throw new SyllabusError('teachingGuidanceOverride.curriculum_preferences.subject_preferences must be an object')
    }
    const subjects = Object.entries(preferences.subject_preferences)
    if (subjects.length > MAX_SUBJECTS) throw new SyllabusError(`Teaching Guidance supports at most ${MAX_SUBJECTS} subjects`)
    validated.subject_preferences = {}
    for (const [rawSubject, fields] of subjects) {
      const subject = rawSubject.trim()
      if (!subject || subject.length > 100 || BLOCKED_SUBJECT_KEYS.has(subject)) {
        throw new SyllabusError('Teaching Guidance subject names must contain 1-100 safe characters')
      }
      if (!isRecord(fields)) throw new SyllabusError(`Teaching Guidance for ${subject} must be an object`)
      rejectUnknownKeys(fields, SUBJECT_KEYS, `teachingGuidanceOverride.curriculum_preferences.subject_preferences.${subject}`)
      validated.subject_preferences[subject] = {}
      for (const field of TEACHING_GUIDANCE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(fields, field.subjectKey)) {
          validated.subject_preferences[subject][field.subjectKey] = cleanList(
            fields[field.subjectKey],
            `teachingGuidanceOverride.curriculum_preferences.subject_preferences.${subject}.${field.subjectKey}`,
          )
        }
      }
    }
  }
  return { curriculum_preferences: validated }
}

export function applyTeachingGuidanceOverride(serverGuidance, input) {
  const override = validateTeachingGuidanceOverride(input)
  const guidance = isRecord(serverGuidance) ? structuredClone(serverGuidance) : {}
  const existingPreferences = isRecord(guidance.curriculum_preferences)
    ? structuredClone(guidance.curriculum_preferences)
    : {}
  const incomingPreferences = override.curriculum_preferences
  for (const field of TEACHING_GUIDANCE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(incomingPreferences, field.globalKey)) {
      existingPreferences[field.globalKey] = incomingPreferences[field.globalKey]
    }
  }
  if (incomingPreferences.subject_preferences) {
    const existingSubjects = isRecord(existingPreferences.subject_preferences)
      ? structuredClone(existingPreferences.subject_preferences)
      : {}
    for (const [subject, fields] of Object.entries(incomingPreferences.subject_preferences)) {
      const existingSubject = isRecord(existingSubjects[subject]) ? existingSubjects[subject] : {}
      existingSubjects[subject] = { ...existingSubject, ...fields }
    }
    existingPreferences.subject_preferences = existingSubjects
  }
  guidance.curriculum_preferences = existingPreferences
  return guidance
}

export function updateTeachingGuidanceList(guidance, { field, subject = null, values }) {
  const next = isRecord(guidance) ? structuredClone(guidance) : {}
  const preferences = isRecord(next.curriculum_preferences) ? next.curriculum_preferences : {}
  next.curriculum_preferences = preferences
  if (subject === null) {
    preferences[field.globalKey] = [...values]
    return next
  }
  const subjectPreferences = isRecord(preferences.subject_preferences) ? preferences.subject_preferences : {}
  preferences.subject_preferences = subjectPreferences
  const subjectFields = isRecord(subjectPreferences[subject]) ? subjectPreferences[subject] : {}
  subjectPreferences[subject] = subjectFields
  subjectFields[field.subjectKey] = [...values]
  return next
}

export function teachingGuidanceOverrideFrom(guidance) {
  const preferences = isRecord(guidance?.curriculum_preferences) ? guidance.curriculum_preferences : {}
  const override = { curriculum_preferences: {} }
  for (const field of TEACHING_GUIDANCE_FIELDS) {
    if (Array.isArray(preferences[field.globalKey])) {
      override.curriculum_preferences[field.globalKey] = cleanList(
        preferences[field.globalKey],
        `teaching_guidance.curriculum_preferences.${field.globalKey}`,
        { rejectEmpty: false },
      )
    }
  }
  if (isRecord(preferences.subject_preferences)) {
    override.curriculum_preferences.subject_preferences = {}
    for (const [subject, fields] of Object.entries(preferences.subject_preferences)) {
      if (!isRecord(fields)) continue
      const known = {}
      for (const field of TEACHING_GUIDANCE_FIELDS) {
        if (Array.isArray(fields[field.subjectKey])) {
          known[field.subjectKey] = cleanList(
            fields[field.subjectKey],
            `teaching_guidance.curriculum_preferences.subject_preferences.${subject}.${field.subjectKey}`,
            { rejectEmpty: false },
          )
        }
      }
      if (Object.keys(known).length) override.curriculum_preferences.subject_preferences[subject] = known
    }
  }
  return validateTeachingGuidanceOverride(override)
}

export function normalizedTeachingGuidance(guidance) {
  return applyTeachingGuidanceOverride(guidance, teachingGuidanceOverrideFrom(guidance))
}
