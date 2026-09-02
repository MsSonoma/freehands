'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './LessonHistoryOverlay.module.css'

function formatDate(value, includeTime = false) {
  if (!value) return 'Date unavailable'
  const date = new Date(value.length === 10 ? `${value}T12:00:00.000Z` : value)
  if (Number.isNaN(date.getTime())) return 'Date unavailable'
  return date.toLocaleString(undefined, {
    timeZone: value.length === 10 ? 'UTC' : undefined,
    month: 'long', day: 'numeric', year: 'numeric',
    ...(includeTime ? { hour: 'numeric', minute: '2-digit' } : {}),
  })
}

function EvidenceFacet({ title, value }) {
  return <div className={styles.facet} data-state={value?.state || 'unavailable'}>
    <strong>{title}</strong>
    <span>{value?.label || 'Not recorded'}</span>
    {value?.detail && <p>{value.detail}</p>}
  </div>
}

function ReviewSection({ title, reports = [] }) {
  if (!reports.length) return null
  return <section className={styles.section}>
    <h3>{title}</h3>
    {reports.map((report) => <article className={styles.reviewCard} key={report.review?.id}>
      <div><strong>{report.label || title}</strong><span>{formatDate(report.review?.completed_at || report.review?.started_at, true)}</span></div>
      <ul>{(report.items || []).map((item, index) => <li key={item.anchor_mastery_check_id || index}>{item.label}</li>)}</ul>
    </article>)}
  </section>
}

function TranscriptDetail({ record, lessonTitle, onBack, loadTranscript = null }) {
  const [text, setText] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (record?.transcript?.kind !== 'txt') return undefined
    const controller = new AbortController()
    setText(null)
    setError('')
    const request = loadTranscript
      ? Promise.resolve(loadTranscript({ record, signal: controller.signal }))
      : fetch(record.transcript.url, { signal: controller.signal }).then((response) => {
          if (!response.ok) throw new Error('The transcript could not be loaded.')
          return response.text()
        })
    request.then(setText).catch((cause) => {
      if (cause?.name !== 'AbortError') setError('The transcript could not be loaded.')
    })
    return () => controller.abort()
  }, [loadTranscript, record])
  return <>
    <button type="button" className={styles.backButton} onClick={onBack}>← Back to lesson history</button>
    <div className={styles.transcriptHeading}><div><p className={styles.kicker}>Session transcript</p><h2>{lessonTitle}</h2></div><span>{record.teacherName}</span></div>
    {record.transcript.kind === 'pdf'
      ? <iframe className={styles.pdfFrame} title={`${lessonTitle} transcript`} src={record.transcript.url} />
      : error
        ? <p className={styles.localError} role="alert">{error}</p>
        : text === null
          ? <p className={styles.status} role="status">Loading transcript…</p>
          : <pre className={styles.transcriptText}>{text}</pre>}
  </>
}

export default function LessonHistoryOverlay({ learnerId, occurrenceId, accessToken, pageIdentity, onClose, loadHistory = null, loadTranscript = null }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retrySequence, setRetrySequence] = useState(0)
  const [transcriptRecord, setTranscriptRecord] = useState(null)
  const closeRef = useRef(null)
  const dialogRef = useRef(null)
  const requestSequence = useRef(0)

  useEffect(() => {
    const previous = document.activeElement
    const priorOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => {
      document.body.style.overflow = priorOverflow
      previous?.focus?.()
    }
  }, [])

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') {
        if (transcriptRecord) setTranscriptRecord(null)
        else onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), a[href], iframe, summary, [tabindex]:not([tabindex="-1"])') || [])]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose, transcriptRecord])

  useEffect(() => {
    const sequence = ++requestSequence.current
    const requestIdentity = `${pageIdentity}:${learnerId}:${occurrenceId}`
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setDetail(null)
    setTranscriptRecord(null)
    const request = loadHistory
      ? Promise.resolve(loadHistory({ learnerId, occurrenceId, pageIdentity, signal: controller.signal }))
      : fetch(`/api/facilitator/learners/${encodeURIComponent(learnerId)}/lesson-history/${encodeURIComponent(occurrenceId)}`, {
          cache: 'no-store',
          signal: controller.signal,
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        }).then(async (response) => {
          const payload = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(payload?.error || 'Lesson history could not be loaded.')
          return payload
        })
    request.then((payload) => {
      if (sequence === requestSequence.current && requestIdentity === `${pageIdentity}:${learnerId}:${occurrenceId}`) setDetail(payload)
    }).catch((cause) => {
      if (cause?.name !== 'AbortError' && sequence === requestSequence.current) setError(cause?.message || 'Lesson history could not be loaded.')
    }).finally(() => {
      if (sequence === requestSequence.current) setLoading(false)
    })
    return () => {
      requestSequence.current += 1
      controller.abort()
    }
  }, [accessToken, learnerId, loadHistory, occurrenceId, pageIdentity, retrySequence])

  const occurrence = detail?.occurrence
  const report = detail?.evidence?.primary
  return <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={detail ? 'lesson-history-title' : undefined} aria-label={detail ? undefined : 'Lesson history'}>
      <button ref={closeRef} type="button" className={styles.closeButton} aria-label="Close lesson history" onClick={onClose}>×</button>
      <div className={styles.scrollBody}>
        {transcriptRecord && detail
          ? <TranscriptDetail record={transcriptRecord} lessonTitle={occurrence?.lessonTitle || 'Lesson'} onBack={() => setTranscriptRecord(null)} loadTranscript={loadTranscript} />
          : <>
            {loading && <p className={styles.status} role="status">Loading this lesson’s history…</p>}
            {error && <div className={styles.error} role="alert"><h2>Lesson history unavailable</h2><p>{error}</p><button type="button" onClick={() => setRetrySequence((value) => value + 1)}>Try again</button></div>}
            {detail && <>
              <header className={styles.header}>
                <p className={styles.kicker}>Review history</p>
                <h2 id="lesson-history-title">{occurrence.lessonTitle}</h2>
                <div className={styles.meta}>
                  <span>{formatDate(occurrence.occurrenceDate)}</span>
                  {occurrence.subject && <span>{occurrence.subject}</span>}
                  {occurrence.actualInstructionalTeacher?.label && <span>Taught by {occurrence.actualInstructionalTeacher.label}</span>}
                  <span>{occurrence.completionState === 'completed' ? 'Completed' : occurrence.completionState}</span>
                </div>
              </header>

              <section className={`${styles.section} ${styles.summary}`}>
                <p className={styles.sectionLabel}>What happened</p>
                <h3>{report?.independent_evidence?.label || 'Learning evidence not recorded'}</h3>
                <p>{report?.independent_evidence?.detail || 'This occurrence is part of the Syllabus record, but no structured learning evidence is available for it.'}</p>
              </section>

              <ReviewSection title="Daily Follow-Up" reports={detail.reviews?.daily} />
              <ReviewSection title="Weekly Review" reports={detail.reviews?.weekly} />
              {(detail.evidence?.slate || []).length > 0 && <section className={styles.section}>
                <h3>Mr. Slate activity</h3>
                {detail.evidence.slate.map((slate) => <div className={styles.slateCard} key={slate.session?.id}>
                  <strong>{slate.independent_evidence?.label || 'Activity recorded'}</strong>
                  <span>{formatDate(slate.session?.started_at, true)}</span>
                </div>)}
              </section>}

              <section className={styles.section}>
                <h3>Session records</h3>
                {(detail.sessionRecords || []).length
                  ? <div className={styles.records}>{detail.sessionRecords.map((record, index) => <button type="button" key={`${record.kind}-${record.startedAt || index}`} onClick={() => setTranscriptRecord(record)}>
                    <span><strong>{record.teacherName} session transcript</strong><small>{formatDate(record.startedAt || record.endedAt, true)}</small></span><b>View</b>
                  </button>)}</div>
                  : <p>No transcript is available for this session.</p>}
              </section>

              {report && <details className={styles.details}>
                <summary>Evidence details</summary>
                <div className={styles.facetGrid}>
                  <EvidenceFacet title="Starting knowledge" value={report.baseline} />
                  <EvidenceFacet title="Assistance" value={report.assistance} />
                  <EvidenceFacet title="Independent demonstration" value={report.independent_evidence} />
                  <EvidenceFacet title="Retention" value={report.retention} />
                </div>
              </details>}
            </>}
          </>}
      </div>
    </section>
  </div>
}
