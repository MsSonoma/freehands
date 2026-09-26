'use client'

import { useEffect, useState } from 'react'
import styles from './FacilitatorSyllabusLessonOverlay.module.css'

const REVIEW_TEACHERS = [
  { id: 'sonoma', label: 'Ms. Sonoma' },
  { id: 'webb', label: 'Mrs. Webb' },
  { id: 'slate', label: 'Mr. Slate' },
]

function teacherLabel(value) {
  return REVIEW_TEACHERS.find((teacher) => teacher.id === value)?.label || 'Mr. Slate'
}

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

function reviewTypeLabel(review = {}) {
  if (review.review_type === 'daily_review') return 'Daily Review'
  if (review.review_type === 'daily_followup') return 'Daily Follow-Up'
  if (review.review_type === 'weekly_review') return 'Weekly Review'
  return review.title || 'Review'
}

function actionLabel(item = {}, busy = false) {
  if (busy) return item.review_status === 'in_progress' ? 'Resuming...' : 'Starting...'
  if (item.review_status === 'in_progress') return 'Resume review'
  if (item.review_status === 'available') return 'Start review'
  if (item.review_status === 'waiting_review_material') return 'Preparing review'
  if (item.review_status === 'completed') return 'Review completed'
  return 'Complete lessons first'
}

function LessonChecklist({ lessons = [] }) {
  if (!lessons.length) return <p>No lesson checklist is available for this review.</p>
  return (
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
            {lesson.completed ? '\u2713' : '\u25CB'}
          </strong>
          <span>{lesson.title || 'Lesson'}</span>
        </div>
      ))}
    </div>
  )
}

export default function SyllabusReviewOverlay({
  item,
  onClose,
  onStart,
  busy = false,
} = {}) {
  const [teacher, setTeacher] = useState('slate')
  useEffect(() => {
    setTeacher(['sonoma', 'webb', 'slate'].includes(item?.review_teacher) ? item.review_teacher : 'slate')
  }, [item?.review_teacher, item?.review_run_id, item?.review_card_id])

  if (!item) return null

  const historyReviews = item.item_type === 'review_history' && Array.isArray(item.reviews) ? item.reviews : []
  const historySlateCompletions = item.item_type === 'slate_review_history' && Array.isArray(item.slate_completions) ? item.slate_completions : []
  const totalHistoryCount = historyReviews.length + historySlateCompletions.length
  const isHistory = totalHistoryCount > 0
  const isSlateHistory = item.item_type === 'slate_review_history'
  const progress = item.review_progress || {}
  const lessons = Array.isArray(progress.lessons) ? progress.lessons : []
  const canStart = !isHistory && item.review_ready === true && item.review_status !== 'completed'
  const completedCount = Number(progress.completed_count || 0)
  const totalCount = Number(progress.total_count || 0)

  return (
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.() }}>
      <section className={styles.overlay} role="dialog" aria-modal="true" aria-label={`${item.title || 'Review'} details`}>
        <header>
          <div>
            <p className={styles.subject}>{isHistory ? (isSlateHistory ? 'Mr. Slate' : 'Review') : 'Review'}</p>
            <h2>{isHistory ? (totalHistoryCount === 1 ? 'Completed review' : 'Completed reviews') : (item.title || 'Review')}</h2>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">Close</button>
        </header>

        <div className={styles.body}>
          {isHistory ? (
            <>
              <dl className={styles.meta}>
                <div><dt>Status</dt><dd>Completed</dd></div>
                {item.planned_date && <div><dt>Date</dt><dd>{prettyDate(item.planned_date)}</dd></div>}
                <div><dt>Reviews</dt><dd>{totalHistoryCount}</dd></div>
              </dl>
              {historyReviews.map((review, index) => {
                const reviewProgress = review.review_progress || {}
                const reviewLessons = Array.isArray(reviewProgress.lessons) ? reviewProgress.lessons : []
                return (
                  <section className={styles.detailSection} key={review.id || review.cycle_key || index}>
                    <h3>{reviewTypeLabel(review)}</h3>
                    {review.description && <p>{review.description}</p>}
                    {review.review_teacher && <p>Completed with <strong>{teacherLabel(review.review_teacher)}</strong>.</p>}
                    <LessonChecklist lessons={reviewLessons} />
                  </section>
                )
              })}
              {historySlateCompletions.map((completion, index) => (
                <section className={styles.detailSection} key={completion.historical_activity_id || completion.id || 'slate-' + index}>
                  <h3>{completion.title || 'Mr. Slate review'}</h3>
                  <p>{completion.subject ? completion.subject + '. Completed with Mr. Slate.' : 'Completed with Mr. Slate.'}</p>
                </section>
              ))}
            </>
          ) : (
            <>
              {item.description && <p className={styles.description}>{item.description}</p>}
              <dl className={styles.meta}>
                <div><dt>Status</dt><dd>{statusLabel(item)}</dd></div>
                {item.planned_date && <div><dt>Date</dt><dd>{prettyDate(item.planned_date)}</dd></div>}
                <div><dt>Lessons</dt><dd>{completedCount} of {totalCount} complete</dd></div>
                {Number.isFinite(Number(item.review_question_count)) && Number(item.review_question_count) > 0 && <div><dt>Questions</dt><dd>{Number(item.review_question_count)}</dd></div>}
              </dl>
              <section className={styles.detailSection}>
                <h3>Teacher for this quiz</h3>
                {item.review_status === 'in_progress' ? (
                  <p>This review will continue with <strong>{teacherLabel(teacher)}</strong>.</p>
                ) : (
                  <label style={{ display: 'grid', gap: 6, maxWidth: 280 }}>
                    <span>Choose who will give the quiz</span>
                    <select value={teacher} onChange={(event) => setTeacher(event.target.value)} disabled={!canStart || busy}>
                      {REVIEW_TEACHERS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                  </label>
                )}
              </section>
              <section className={styles.detailSection}>
                <h3>Lessons in this review</h3>
                <LessonChecklist lessons={lessons} />
              </section>
              {item.review_status === 'pending_lessons' && (
                <section className={styles.detailSection}>
                  <h3>When this becomes available</h3>
                  <p>The review unlocks after every lesson listed above is completed.</p>
                </section>
              )}
            </>
          )}
        </div>

        <footer>
          <div className={styles.secondaryActions}>
            <button type="button" onClick={onClose}>Close</button>
          </div>
          {!isHistory && (
            <button
              type="button"
              className={styles.primary}
              disabled={!canStart || busy}
              onClick={() => canStart && onStart?.(item, teacher)}
            >
              {actionLabel(item, busy)}
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}
