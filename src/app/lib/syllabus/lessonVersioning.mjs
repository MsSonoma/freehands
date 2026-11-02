// Keep an immutable taught lesson intact. Revisions are new drafts with their own identity.
export function makeEditableLessonVersion(original, sourceLessonKey, now = new Date()) {
  if (!original || typeof original !== 'object' || !String(original.title || '').trim()) {
    throw new Error('A saved lesson is needed to make a revision.')
  }
  const date = now instanceof Date ? now : new Date(now)
  if (!Number.isFinite(date.getTime())) throw new Error('A revision timestamp is required.')
  const content = { ...original }
  for (const key of ['materialization_operation', 'materializationOperation', 'approvedAt', 'approvedBy', 'approval']) {
    delete content[key]
  }
  return {
    ...content,
    id: `${String(original.id || 'lesson').slice(0, 60)}-version-${date.getTime()}`,
    approved: false,
    needsUpdate: false,
    revisionOfLessonKey: String(sourceLessonKey || '').trim(),
    revisionCreatedAt: date.toISOString(),
  }
}
