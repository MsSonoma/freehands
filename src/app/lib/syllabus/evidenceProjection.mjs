import { FACILITATOR_EVIDENCE_REPORT_VERSION } from '../masteryEvidence/reporting.js'

function clean(value) { return String(value || '').trim() }
const SUBJECT_ALIASES = Object.freeze({ mathematics: 'math', maths: 'math', ela: 'language arts', english: 'language arts', 'english language arts': 'language arts', history: 'social studies', civics: 'social studies' })
export function instructionalSubjectKey(value) {
  const key = clean(value).toLocaleLowerCase()
  return SUBJECT_ALIASES[key] || key
}

export function projectInstructionalEvidenceReport(report) {
  if (report?.report_version !== FACILITATOR_EVIDENCE_REPORT_VERSION) return null
  return {
    report_version: report.report_version,
    lesson: {
      key: clean(report.lesson?.key || report.lesson?.source_key) || null,
      title: clean(report.lesson?.title) || null,
      subject: clean(report.lesson?.subject) || null,
    },
    completeness: clean(report.completeness?.state) || null,
    baseline: clean(report.baseline?.state) || null,
    independent: clean(report.independent_evidence?.state) || null,
    retention: clean(report.retention?.state) || null,
    learning_summary: report.learning_summary ? {
      headline: clean(report.learning_summary.headline) || null,
      narrative: clean(report.learning_summary.narrative) || null,
      unresolved: clean(report.learning_summary.unresolved?.label) || null,
    } : null,
  }
}

export function instructionalEvidenceContext(reports = []) {
  return reports.map(projectInstructionalEvidenceReport).filter(Boolean).slice(0, 12)
}

export function subjectBalancedInstructionalEvidenceContext(reports = [], subjects = [], { perSubjectLimit = 8, fallbackLimit = 4 } = {}) {
  const projected = reports.map(projectInstructionalEvidenceReport).filter(Boolean)
  const requested = []
  const seen = new Set()
  for (const subject of subjects || []) {
    const cleaned = clean(subject)
    const key = instructionalSubjectKey(cleaned)
    if (!cleaned || seen.has(key)) continue
    seen.add(key)
    requested.push({ subject: cleaned, key })
  }
  if (!requested.length) return projected.slice(0, 12)

  const balanced = []
  const usedIndexes = new Set()
  let missingRequestedSubject = false
  for (const requestedSubject of requested) {
    let count = 0
    for (let index = 0; index < projected.length && count < perSubjectLimit; index++) {
      const report = projected[index]
      if (instructionalSubjectKey(report.lesson?.subject) !== requestedSubject.key) continue
      usedIndexes.add(index)
      balanced.push(report)
      count++
    }
    if (count === 0) missingRequestedSubject = true
  }

  // Keep a small recent cross-subject fallback when a requested subject has no
  // evidence yet. This preserves useful learner context without allowing a busy
  // subject to crowd the requested subject's own history out of the planner.
  if (missingRequestedSubject && fallbackLimit > 0) {
    let added = 0
    for (let index = 0; index < projected.length && added < fallbackLimit; index++) {
      if (usedIndexes.has(index)) continue
      balanced.push(projected[index])
      usedIndexes.add(index)
      added++
    }
  }
  return balanced
}
