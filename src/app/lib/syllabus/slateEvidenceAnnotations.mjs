import { normalizeLessonKey } from '../lessonKeyNormalization.js'

function clean(value) { return String(value || '').trim() }

function evidenceOccurrence(report) {
  return clean(report?.syllabus_occurrence_id || report?.provenance?.syllabus_occurrence_id)
}

function findSupportedOccurrence(items, lessonKey, occurrenceId) {
  const key = normalizeLessonKey(lessonKey)
  if (!key) return null
  const candidates = items.filter((item) => (
    item?.item_type === 'lesson' && normalizeLessonKey(item?.lesson_key) === key
  ))
  if (occurrenceId) {
    const exact = candidates.filter((item) => (
      clean(item?.occurrence_id) === occurrenceId || clean(item?.source_occurrence_id) === occurrenceId
    ))
    return exact.length === 1 ? exact[0] : null
  }
  return candidates.length === 1 ? candidates[0] : null
}

function masteryAnnotation(report) {
  const state = report?.independent_evidence?.state
  if (state === 'independent_success') return { kind: 'mastery', state, label: 'Mastery: Completed with Mr. Slate' }
  if (state === 'needs_recovery') return { kind: 'mastery', state, label: 'Mastery: Recovery needed' }
  if (state === 'independent_success_after_recovery') return { kind: 'mastery', state, label: 'Mastery: Recovered with Mr. Slate' }
  return null
}

function retentionAnnotation(state) {
  return ['retained', 'demonstrated'].includes(state)
    ? { kind: 'retention', state, label: 'Retention: Completed with Mr. Slate' }
    : null
}

export function annotateSyllabusItemsWithSlateEvidence(items = [], evidenceReports = [], reviewReports = []) {
  const annotations = new Map()
  const add = (item, annotation, evidenceId) => {
    if (!item || !annotation) return
    const key = clean(item.occurrence_id || item.id)
    if (!key) return
    const rows = annotations.get(key) || []
    const duplicate = rows.some((row) => row.kind === annotation.kind && row.label === annotation.label)
    if (!duplicate) rows.push({ ...annotation, authority: 'slate', evidence_id: clean(evidenceId) || null })
    annotations.set(key, rows)
  }

  for (const report of evidenceReports || []) {
    const item = findSupportedOccurrence(items, report?.lesson?.key, evidenceOccurrence(report))
    if (!item) continue
    const evidenceId = report?.provenance?.evidence_session_id || report?.session?.id
    add(item, masteryAnnotation(report), evidenceId)
    add(item, retentionAnnotation(report?.retention?.state), evidenceId)
  }

  for (const report of reviewReports || []) {
    for (const reviewItem of report?.items || []) {
      const item = findSupportedOccurrence(items, reviewItem?.lesson_key, clean(reviewItem?.syllabus_occurrence_id))
      add(item, retentionAnnotation(reviewItem?.state), report?.review?.id)
    }
  }

  return items.map((item) => ({
    ...item,
    slate_annotations: annotations.get(clean(item.occurrence_id || item.id)) || [],
  }))
}
