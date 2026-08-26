export function normalizeLessonKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') {
    return rawKey
  }

  let key = rawKey.trim()
  if (!key) {
    return key
  }

  // Use forward slashes consistently
  key = key.replace(/\\/g, '/')

  if (key.startsWith('lessons/')) {
    key = key.slice('lessons/'.length)
  }

  if (key.startsWith('Facilitator Lessons/')) {
    key = `general/${key.slice('Facilitator Lessons/'.length)}`
  }

  const lowerKey = key.toLowerCase()

  if (lowerKey.startsWith('facilitator-lessons/')) {
    key = `generated/${key.slice('facilitator-lessons/'.length)}`
  } else if (lowerKey.startsWith('facilitator/')) {
    key = `generated/${key.slice('facilitator/'.length)}`
  } else if (lowerKey.startsWith('generated-lessons/')) {
    key = `generated/${key.slice('generated-lessons/'.length)}`
  }

  if (key.startsWith('generated/generated/')) {
    key = `generated/${key.slice('generated/generated/'.length)}`
  }

  // Collapse duplicate separators by re-normalizing
  key = key.replace(/\/+/g, '/')

  return key
}

export function lessonKeyBasename(rawKey) {
  const key = normalizeLessonKey(rawKey)
  if (!key) return ''
  return String(key).split('/').at(-1).replace(/\.json$/i, '').toLocaleLowerCase()
}

export function resolveLessonKeyAgainst(rawKey, knownKeys = []) {
  const normalized = normalizeLessonKey(rawKey)
  if (!normalized) return normalized
  const canonical = [...new Set((knownKeys || []).map(normalizeLessonKey).filter(Boolean))]
  if (canonical.includes(normalized)) return normalized
  if (normalized.includes('/')) return normalized
  const basename = lessonKeyBasename(normalized)
  const matches = canonical.filter((key) => lessonKeyBasename(key) === basename)
  return matches.length === 1 ? matches[0] : normalized
}
