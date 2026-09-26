'use client'

import styles from './FacilitatorSyllabusLessonOverlay.module.css'

function prettyDate(value) {
  const day = String(value || '').slice(0, 10)
  if (!day) return ''
  const parsed = new Date(`${day}T12:00:00`)
  if (Number.isNaN(parsed.getTime())) return day
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function statusLabel(item = {}) {
  if (item.review_status === 'completed') return 'Completed'
  if (item.review_status === 'in_progress') return 'In progress'
  if (item.review_status === 'available') return 'Ready'
  if (item.review_status === 'waiting_review_material') return 'Preparing'
  return 'Waiting for lessons'
}

function actionLabel(item = {}, busy = false) {
  if (busy) return item.review_status === 'in_progress' ? 'Resuming...' : 'Starting...'
  if (item.review_status === 'in_progress') return 'Resume review'
  if (item.review_status === 'available') return 'Start review'
  if (item.review_status === 'waiting_review_material') return 'Preparing review'
  if (item.review_status === 'completed') return 'Review completed'
  return 'Complete lessons first'
}

export default function SyllabusReviewOverlay({
  item,
  onClose,
  onStart,
  busy = false,
} = {}) {
  if (!item) return null
  const progress = item.review_progress || {}
  const lessons = Array.isArray(progress.lessons) ? progress.lessons : []
  const canStart = item.review_ready === true && item.review_status !== 'completed'
  const completedCount = Number(progress.completed_count || 0)
  const totalCount = Number(progress.total_count || 0)

  return (
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.() }}>
      <section className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${item.title || 'Review'} details`}>
        <header>
          <div>
            <p className={styles.subject}>Review</p>
            <h2>{item.title || 'Review'}</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">Close</button>
        </header>

        <div className={styles.body}>
          {item.description && <p className={styles.description}>{item.description}</p>}

          <dl className={styles.meta}>
            <div><dt>Status</dt><dd>{statusLabel(item)}</dd></div>
            {item.planned_date && <div><dt>Date</dt><dd>{prettyDate(item.planned_date)}</dd></div>}
            <div><dt>Lessons</dt><dd>{completedCount} of {totalCount} complete</dd></div>
          </dl>

          <section className={styles.detailSection}>
            <h3>Lessons in this review</h3>
            {lessons.length ? (
              <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                {lessons.map((lesson) => (
                  <div
                    key={lesson.id || `${lesson.lesson_key || ''}:${lesson.title || ''}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '22px minmax(0,1fr)',
                      gap: 8,
                      alignItems: 'start',
                      padding: '9px 10px',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      background: lesson.completed ? '#f7faf7' : '#fff',
                      color: '#374151',
                    }}
                  >
                    <strong aria-hidden="true" style={{ color: lesson.completed ? '#4f6b4f' : '#9ca3af' }}>
                      {lesson.completed ? '?' : '?'}
                    </strong>
                    <span>{lesson.title || 'Lesson'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p>No lesson checklist is available for this review.</p>
            )}
          </section>

          {item.review_status === 'pending_lessons' && (
            <section className={styles.detailSection}>
              <h3>When this becomes available</h3>
              <p>The review unlocks after every lesson listed above is completed.</p>
            </section>
          )}
        </div>

        <footer>
          <div className={styles.secondaryActions}>
            <button type="button" onClick={onClose}>Close</button>
          </div>
          <button
            type="button"
            className={styles.primary}
            disabled={!canStart || busy}
            onClick={() => canStart && onStart?.(item)}
          >
            {actionLabel(item, busy)}
          </button>
        </footer>
      </section>
    </div>
  )
}