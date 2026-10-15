import { slateTestResultStatus, summarizeSlateTestResults } from '@/app/lib/slateTestGradeReport.mjs'

const LABELS = {
  correct: 'Correct · 1 point',
  partial: 'Partially demonstrated · ½ point',
  incorrect: 'Not credited · 0 points',
  ungraded: 'Not yet graded',
}

export default function SlateIndependentTestReport({ items = [], percentage = null, legacy = false, compact = false }) {
  const entries = Array.isArray(items) ? items : []
  const summary = summarizeSlateTestResults(entries)
  const shownPercentage = percentage == null ? summary.percentage : Number(percentage)
  return (
    <section aria-label="Independent test grading report" style={{ width: '100%', textAlign: 'left', margin: '14px 0', lineHeight: 1.55 }}>
      <div style={{ padding: compact ? '10px 0' : 16, border: '1px solid currentColor', borderRadius: 8 }}>
        <h2 style={{ fontSize: compact ? 16 : 19, margin: '0 0 6px' }}>Independent test grading report</h2>
        <p style={{ margin: '6px 0', fontSize: compact ? 15 : 20, fontWeight: 800 }}>
          {Number.isFinite(shownPercentage) ? `${shownPercentage}%` : 'Grade pending'}
          {summary.total ? ` · ${summary.points} of ${summary.total} points` : ''}
        </p>
        <p style={{ margin: '6px 0', fontSize: 13 }}>
          {summary.correct} correct · {summary.partial} partial · {summary.incorrect} not credited
          {summary.ungraded ? ` · ${summary.ungraded} ungraded` : ''}
        </p>
        <p style={{ margin: '7px 0', opacity: 0.85, fontSize: 12 }}>
          One point for correct, half a point for partial, zero for incorrect.
          Test feedback is shown only after the independent test has finished.
        </p>
        {legacy && <p role="note" style={{ margin: '9px 0', fontWeight: 700, fontSize: 12 }}>
          Historical grading: this test did not save reasons for each decision. The recorded score is displayed as originally awarded and has not been independently regraded.
        </p>}
      </div>
      {entries.length ? (
        <ol style={{ margin: '14px 0', paddingLeft: 24 }}>
          {entries.map((entry, index) => {
            const status = slateTestResultStatus(entry)
            const reason = String(entry?.judgmentReason || entry?.reason || '').trim()
            return (
              <li key={String(entry?.submissionId ?? entry?.index ?? index)} style={{ padding: '10px 8px', borderBottom: '1px solid currentColor' }}>
                <strong style={{ display: 'block' }}>{entry?.question || `Question ${index + 1}`}</strong>
                <p style={{ margin: '6px 0' }}><strong>Answer:</strong> {String(entry?.answer ?? '') || '(No answer saved)'}</p>
                <p style={{ margin: '5px 0', fontWeight: 700 }}>
                  {LABELS[status]}{legacy ? ' · Original evaluation' : ''}
                </p>
                <p style={{ margin: '5px 0' }}><strong>Why:</strong> {reason || 'No grading explanation was saved for this earlier attempt; facilitator review is recommended.'}</p>
                {entry?.expected && <p style={{ margin: '5px 0', opacity: 0.85 }}><strong>Reference answer:</strong> {String(entry.expected)}</p>}
              </li>
            )
          })}
        </ol>
      ) : <p>No individual answers were saved for this report.</p>}
    </section>
  )
}
