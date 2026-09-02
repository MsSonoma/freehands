import { normalizeLessonKey } from './lessonKeyNormalization.js'

export function normalizeAvailabilityMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const [key, value] of Object.entries(raw)) {
    if (!value) continue
    const normalized = normalizeLessonKey(key)
    if (normalized) out[normalized] = true
  }
  return out
}

export function buildAvailabilityKeyVariants(lessonKey) {
  const normalized = normalizeLessonKey(lessonKey)
  const variants = new Set([lessonKey, normalized].filter(Boolean))
  if (normalized?.startsWith('general/')) variants.add(normalized.replace(/^general\//, 'facilitator/'))
  if (String(lessonKey || '').startsWith('Facilitator Lessons/')) variants.add(String(lessonKey))
  return Array.from(variants).filter(Boolean)
}

export function applyLessonAvailability(previous, lessonKey, available) {
  const normalizedLessonKey = normalizeLessonKey(lessonKey)
  if (!normalizedLessonKey || typeof available !== 'boolean') {
    return { ok: false, error: 'lessonKey and available are required' }
  }

  const next = normalizeAvailabilityMap(previous)
  if (available) {
    next[normalizedLessonKey] = true
  } else {
    for (const variant of buildAvailabilityKeyVariants(normalizedLessonKey)) delete next[variant]
    delete next[normalizedLessonKey]
  }
  return { ok: true, approvedLessons: next, lessonKey: normalizedLessonKey, available }
}