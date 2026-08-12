'use client';

import styles from './evidenceHistory.module.css';

function formatSessionDate(value) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatScore(score) {
  if (!score || !Number.isFinite(Number(score.value))) return null;
  return score.unit === 'percent' ? `${Number(score.value)}%` : String(score.value);
}

function describeFact(fact) {
  if (!fact) return null;
  if (fact.event_type === 'answer_evaluated' && fact.item?.evidence_purpose === 'baseline') {
    if (fact.correctness === true) return 'A baseline first response was correct.';
    if (fact.correctness === false) return 'A baseline first response was not correct.';
    return 'A baseline response was recorded without a complete evaluation.';
  }
  if (fact.event_type === 'mastery_check_result') {
    const labels = {
      independent_success: 'A clean held-out first response was correct without disqualifying assistance.',
      needs_recovery: 'The initial clean held-out first response was not correct.',
      independent_success_after_recovery: 'A different held-out item was correct independently after recovery.',
      assisted_success: 'The answer became correct, but the check was assisted.',
      unavailable: 'The independent check could not be qualified.',
    };
    return labels[fact.mastery_outcome] || 'An independent-check result was recorded.';
  }
  if (fact.event_type === 'retention_check_result') {
    const labels = {
      retained: 'The delayed held-out check was correct and independently qualified.',
      needs_review: 'The delayed held-out check was not demonstrated independently.',
      assisted_review: 'The delayed check became assisted.',
      unavailable: 'The delayed check could not be qualified.',
    };
    return labels[fact.retention_outcome] || 'A delayed-check result was recorded.';
  }
  return null;
}

function Facet({ title, value }) {
  return (
    <div className={styles.facet} data-state={value?.state || 'unavailable'}>
      <div className={styles.facetTitle}>{title}</div>
      <div className={styles.facetLabel}>{value?.label || 'Evidence unavailable'}</div>
      {value?.detail && <p className={styles.facetDetail}>{value.detail}</p>}
    </div>
  );
}

function EvidenceDetails({ report, transcript, onOpenTranscript }) {
  const facts = [
    ...(report.baseline?.supporting_evidence || []),
    ...(report.independent_evidence?.supporting_evidence || []),
    ...(report.retention?.supporting_evidence || []),
  ].map(describeFact).filter(Boolean);
  const protocols = report.provenance?.protocols || {};
  const protocolEntries = [
    ['Baseline', protocols.baseline],
    ['Independent check', protocols.independent_mastery],
    ['Retention', protocols.retention],
  ];

  return (
    <details className={styles.details}>
      <summary>Why this summary?</summary>
      <div className={styles.detailsBody}>
        {facts.length > 0 ? (
          <ul className={styles.detailList}>
            {facts.map((fact, index) => <li key={`${fact}-${index}`}>{fact}</li>)}
          </ul>
        ) : (
          <p>No Stage 5-7 result facts were available for this session.</p>
        )}

        {(report.assistance?.events || []).length > 0 && (
          <div>
            <strong>Notable help and recovery</strong>
            <ul className={styles.detailList}>
              {report.assistance.events.map((event, index) => (
                <li key={`${event.type}-${event.occurred_at || index}`}>{event.label}</li>
              ))}
            </ul>
          </div>
        )}

        {(report.assistance?.accessibility_actions || []).length > 0 && (
          <p>
            Prompt repeat was used {report.assistance.accessibility_actions.length} time{report.assistance.accessibility_actions.length === 1 ? '' : 's'}.
            {' '}Repeat is shown as an accessibility/control action, not as hint dependency.
          </p>
        )}

        {(report.independent_evidence?.recovery_chain || []).length > 0 && (
          <div>
            <strong>Recovery sequence</strong>
            <ol className={styles.detailList}>
              {report.independent_evidence.recovery_chain.map((step, index) => (
                <li key={`${step.state}-${index}`}>{step.label}</li>
              ))}
            </ol>
          </div>
        )}

        {report.retention?.prior_independent_evidence && (
          <p><strong>Earlier evidence:</strong> {report.retention.prior_independent_evidence.label}. {report.retention.prior_independent_evidence.detail}</p>
        )}

        <div className={styles.provenanceGrid}>
          <div>
            <strong>Target scope</strong>
            <span>{report.target?.scope === 'concept' ? `Concept: ${report.target.concept_id}` : 'Lesson-level evidence'}</span>
          </div>
          <div>
            <strong>Protocol versions</strong>
            <span>{protocolEntries.map(([label, version]) => `${label}: ${version || 'not recorded'}`).join(' | ')}</span>
          </div>
          <div>
            <strong>Source references</strong>
            <span>{report.provenance?.item_references?.length || 0} item reference{report.provenance?.item_references?.length === 1 ? '' : 's'} preserved</span>
          </div>
          <div>
            <strong>Session reference</strong>
            <span>{report.session?.id || 'Not recorded'}</span>
          </div>
        </div>

        {transcript && (
          <button type="button" className={styles.transcriptButton} onClick={() => onOpenTranscript?.(transcript)}>
            Open session transcript
          </button>
        )}
      </div>
    </details>
  );
}

function EvidenceCard({ report, transcripts, onOpenTranscript }) {
  const transcript = transcripts.find((item) => (
    item?.sessionId
      && report.session?.browser_session_id
      && String(item.sessionId) === String(report.session.browser_session_id)
  )) || null;
  const lessonLabel = report.lesson?.id || report.lesson?.source_key || report.lesson?.key || 'Lesson';
  const scoreText = formatScore(report.score);

  return (
    <article className={styles.card} data-completeness={report.completeness?.state || 'unavailable'}>
      <header className={styles.cardHeader}>
        <div>
          <h3>{lessonLabel}</h3>
          <div className={styles.sessionDate}>{formatSessionDate(report.session?.started_at)}</div>
        </div>
        <span className={styles.completeness}>{report.completeness?.label || 'Structured evidence unavailable'}</span>
      </header>

      <div className={styles.facetGrid}>
        <Facet title="Before instruction" value={report.baseline} />
        <Facet title="During learning" value={report.assistance} />
        <Facet title="Independent evidence" value={report.independent_evidence} />
        <Facet title="Retention" value={report.retention} />
      </div>

      {scoreText && (
        <div className={styles.scoreRow}>
          <strong>{report.score.label}:</strong> {scoreText}
          <span>{report.score.detail}</span>
        </div>
      )}

      {(report.interventions || []).length > 0 && (
        <section className={styles.contextBlock} aria-label="Facilitator context">
          <h4>Facilitator context</h4>
          <ul>
            {report.interventions.map((item, index) => (
              <li key={`${item.kind}-${item.occurred_at || index}`}>{item.label}</li>
            ))}
          </ul>
        </section>
      )}

      {(report.interpretations || []).length > 0 && (
        <section className={styles.interpretationBlock} aria-label="Interpretation">
          <h4>Interpretation</h4>
          <ul>
            {report.interpretations.map((item) => <li key={item.kind}>{item.label}</li>)}
          </ul>
        </section>
      )}

      {(report.options || []).length > 0 && (
        <section className={styles.optionBlock} aria-label="Educator options">
          <h4>Options</h4>
          <ul>
            {report.options.map((item) => <li key={item.kind}>{item.label}</li>)}
          </ul>
        </section>
      )}

      <EvidenceDetails report={report} transcript={transcript} onOpenTranscript={onOpenTranscript} />
    </article>
  );
}

function ReviewCard({ report }) {
  const isWeekly = report.review?.type === 'weekly_review';
  const reviewLabel = isWeekly ? 'Weekly Review' : 'Daily Follow-Up';
  return (
    <article className={styles.card} data-completeness={report.review?.status === 'completed' ? 'complete' : 'partial'}>
      <header className={styles.cardHeader}>
        <div>
          <h3>{report.label || reviewLabel}</h3>
          <div className={styles.sessionDate}>{formatSessionDate(report.review?.started_at)}</div>
        </div>
        <span className={styles.completeness}>{report.review?.status === 'completed' ? 'Complete' : 'In progress'}</span>
      </header>
      <p className={styles.facetDetail}>
        {isWeekly
          ? 'A separate mixed review of recent learning. Daily retrieval is noted when it preceded a weekly item.'
          : 'A strict delayed check tied to earlier independent evidence. It does not reopen the lesson.'}
      </p>
      <div className={styles.facetGrid}>
        {(report.items || []).map((item, index) => (
          <Facet
            key={`${item.anchor_mastery_check_id || item.lesson_key}-${index}`}
            title={item.lesson_id || item.lesson_key || `Item ${index + 1}`}
            value={{ state: item.state, label: item.label }}
          />
        ))}
      </div>
      {isWeekly && (report.items || []).some((item) => item.prior_daily_retrieval_observed) && (
        <div className={styles.contextBlock}>Prior Daily Follow-Up retrieval was observed for at least one weekly item.</div>
      )}
    </article>
  );
}

export default function EvidenceHistorySection({
  enabled,
  loading,
  error,
  reports = [],
  reviews = [],
  transcripts = [],
  hasMore,
  loadingMore,
  onLoadMore,
  onOpenTranscript,
}) {
  if (!enabled && !loading && !error) return null;

  return (
    <section className={styles.section} aria-labelledby="learning-evidence-heading">
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="learning-evidence-heading">Learning evidence</h2>
          <p>Observed evidence comes first. Interpretations and educator-controlled options are kept separate.</p>
        </div>
      </div>

      {loading ? (
        <div className={styles.stateBox} role="status">Loading learning evidence...</div>
      ) : error ? (
        <div className={styles.stateBox} role="status">
          Learning evidence is temporarily unavailable. Transcript history is still available below.
        </div>
      ) : reports.length === 0 && reviews.length === 0 ? (
        <div className={styles.stateBox}>
          No learning-evidence sessions yet. Transcript history remains available below.
        </div>
      ) : (
        <div className={styles.cardList}>
          {reviews.map((report) => <ReviewCard key={report.review?.id} report={report} />)}
          {reports.map((report, index) => (
            <EvidenceCard
              key={`${report.session?.id || 'legacy'}-${index}`}
              report={report}
              transcripts={transcripts}
              onOpenTranscript={onOpenTranscript}
            />
          ))}
        </div>
      )}

      {hasMore && !loading && !error && (
        <button type="button" className={styles.loadMoreButton} onClick={onLoadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading older sessions...' : 'Load older sessions'}
        </button>
      )}
    </section>
  );
}
