import { FACILITATOR_EVIDENCE_REPORT_VERSION } from '../masteryEvidence/reporting.js'

function clean(value) { return String(value || '').trim() }

export function instructionalEvidenceContext(reports = []) {
  return reports.filter((report) => report?.report_version === FACILITATOR_EVIDENCE_REPORT_VERSION).slice(0, 12).map((report) => ({
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
  }))
}
