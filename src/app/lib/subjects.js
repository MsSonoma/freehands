'use client'

export const CORE_SUBJECTS = ['math', 'science', 'language arts', 'social studies', 'general']
export const GENERATED_SUBJECT = 'generated'

function normalizeSubjectKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function mergeSubjectNames(coreSubjects = CORE_SUBJECTS, customSubjectNames = [], options = {}) {
  const { includeGenerated = false } = options || {}

  const output = []
  const seen = new Set()

  const add = (name) => {
    const trimmed = String(name || '').trim()
    if (!trimmed) return
    const key = normalizeSubjectKey(trimmed)
    if (!key) return
    if (seen.has(key)) return
    seen.add(key)
    output.push(trimmed)
  }

  ;(coreSubjects || []).forEach(add)
  ;(customSubjectNames || []).forEach(add)
  if (includeGenerated) add(GENERATED_SUBJECT)

  return output
}

export function sortSubjectsForDropdown(names = [], coreSubjects = CORE_SUBJECTS) {
  const coreKeys = new Map((coreSubjects || []).map((s, idx) => [normalizeSubjectKey(s), idx]))

  return [...(names || [])].sort((a, b) => {
    const aKey = normalizeSubjectKey(a)
    const bKey = normalizeSubjectKey(b)

    const aCoreIdx = coreKeys.get(aKey)
    const bCoreIdx = coreKeys.get(bKey)

    const aIsCore = typeof aCoreIdx === 'number'
    const bIsCore = typeof bCoreIdx === 'number'

    if (aIsCore && bIsCore) return aCoreIdx - bCoreIdx
    if (aIsCore && !bIsCore) return -1
    if (!aIsCore && bIsCore) return 1

    return String(a).localeCompare(String(b), undefined, { sensitivity: 'base' })
  })
}
