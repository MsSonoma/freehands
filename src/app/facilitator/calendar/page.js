'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { listLearners } from '@/app/facilitator/learners/clientApi'
import { featuresForTier } from '@/app/lib/entitlements'
import { resolveCalendarLandingParams } from '@/app/lib/facilitatorCalendarLanding.mjs'
import { groupSyllabusCalendarItems, syllabusCalendarSelection, syllabusCalendarItemCompleted } from '@/app/lib/syllabus/calendarProjection.mjs'
import { instructionalTeacherLabel, normalizeInstructionalTeacher } from '@/app/lib/syllabus/instructionalTeacher.mjs'
import { syllabusEntitlementsFor } from '@/app/lib/syllabus/timeline.mjs'
import { buildLessonSchedulePayload, buildSchedulableLessonOptions, postLessonScheduleWithCapacityPin } from '@/app/lib/syllabus/syllabusScheduling.mjs'
import { requestFacilitatorPinException } from '@/app/lib/pinGate'
import { CORE_SUBJECTS } from '@/app/lib/subjects'
import FacilitatorSyllabusLessonOverlay from '@/app/components/syllabus/FacilitatorSyllabusLessonOverlay'
import SyllabusDayActionDialog from '@/app/components/syllabus/SyllabusDayActionDialog'
import SyllabusScheduleDialog from '@/app/components/syllabus/SyllabusScheduleDialog'
import GatedOverlay from '@/app/components/GatedOverlay'
import LessonCalendar from './LessonCalendar'
import GeneratePortfolioModal from './GeneratePortfolioModal'

function dateOnly(value) {
  return String(value || '').slice(0, 10)
}

function prettyDate(value) {
  const date = dateOnly(value)
  if (!date) return ''
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function statusLabel(item) {
  if (item?.actual_kind === 'completed' || item?.historical_record === true) return 'Completed'
  if (item?.actual_kind === 'in_progress') return 'In progress'
  if (item?.actual_kind === 'incomplete') return 'Incomplete'
  if (item?.needs_placement) return 'Needs placement'
  if (!item?.lesson_key) return 'Planned concept'
  if (item?.item_type === 'slate_assignment') return 'Mr. Slate practice'
  if (item?.readiness_state) return String(item.readiness_state).replaceAll('_', ' ')
  return 'Planned'
}

export default function CalendarPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: 'required' })
  const [learners, setLearners] = useState([])
  const [selectedLearnerId, setSelectedLearnerId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [planTier, setPlanTier] = useState('free')
  const [syllabus, setSyllabus] = useState(null)
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [noSchoolDates, setNoSchoolDates] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showPortfolio, setShowPortfolio] = useState(false)
  const [dayActionDate, setDayActionDate] = useState('')
  const [dayActionError, setDayActionError] = useState('')
  const [dayActionBusy, setDayActionBusy] = useState(false)
  const [scheduleDialog, setScheduleDialog] = useState(null)
  const [scheduleLessons, setScheduleLessons] = useState([])
  const [scheduleCatalogLoading, setScheduleCatalogLoading] = useState(false)
  const [scheduleBusy, setScheduleBusy] = useState(false)
  const [scheduleError, setScheduleError] = useState('')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const landing = resolveCalendarLandingParams(new URLSearchParams(window.location.search))
    if (landing.redirectToSyllabus) {
      router.replace('/facilitator/syllabus')
      return
    }
    if (landing.openPortfolio) setShowPortfolio(true)
  }, [router])

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('ms:session:title', { detail: 'Calendar' }))
    return () => window.dispatchEvent(new CustomEvent('ms:session:title', { detail: '' }))
  }, [])

  useEffect(() => {
    if (authLoading || !isAuthenticated) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const supabase = getSupabaseClient()
        const [{ data: { session } }, learnerRows] = await Promise.all([
          supabase.auth.getSession(),
          listLearners(),
        ])
        if (cancelled) return
        const token = session?.access_token || ''
        setAccessToken(token)
        setLearners(Array.isArray(learnerRows) ? learnerRows : [])
        setSelectedLearnerId((current) => current || learnerRows?.[0]?.id || '')
        if (token) {
          const quotaResponse = await fetch('/api/lessons/quota', { headers: { Authorization: `Bearer ${token}` } })
          if (quotaResponse.ok) {
            const quota = await quotaResponse.json().catch(() => ({}))
            if (!cancelled) setPlanTier(quota?.plan_tier || 'free')
          }
        }
      } catch (cause) {
        if (!cancelled) setError(cause?.message || 'Could not load Calendar')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [authLoading, isAuthenticated])

  const loadSyllabus = useCallback(async () => {
    if (!selectedLearnerId || !accessToken) return
    setError('')
    try {
      const response = await fetch(`/api/syllabus?learnerId=${encodeURIComponent(selectedLearnerId)}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not load the Syllabus calendar')
      setSyllabus(json)
      setSelectedDate((current) => current || json.resolved_today || '')
    } catch (cause) {
      setSyllabus(null)
      setError(cause?.message || 'Could not load the Syllabus calendar')
    }
  }, [accessToken, selectedLearnerId])

  const loadNoSchoolDates = useCallback(async () => {
    if (!selectedLearnerId || !accessToken) return
    try {
      const response = await fetch(`/api/no-school-dates?learnerId=${encodeURIComponent(selectedLearnerId)}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) return
      const json = await response.json().catch(() => ({}))
      const grouped = {}
      for (const row of json?.dates || []) {
        const date = dateOnly(row?.date)
        if (date) grouped[date] = row?.reason || ''
      }
      setNoSchoolDates(grouped)
    } catch {
      setNoSchoolDates({})
    }
  }, [accessToken, selectedLearnerId])

  useEffect(() => {
    if (!selectedLearnerId || !accessToken) return
    setSelectedLesson(null)
    setSelectedDate('')
    void Promise.all([loadSyllabus(), loadNoSchoolDates()])
  }, [accessToken, loadNoSchoolDates, loadSyllabus, selectedLearnerId])

  useEffect(() => {
    function refresh() {
      if (document.hidden) return
      void loadSyllabus()
    }
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [loadSyllabus])

  const itemsByDate = useMemo(() => groupSyllabusCalendarItems(syllabus?.timeline_items || []), [syllabus?.timeline_items])
  const selectedItems = selectedDate ? (itemsByDate[selectedDate] || []) : []
  const activeRevisionId = String(syllabus?.active_revision?.id || '')
  const resolvedToday = syllabus?.resolved_today || selectedDate || ''
  const selectedLearner = learners.find((learner) => String(learner.id) === String(selectedLearnerId)) || null
  const portfolioAllowed = featuresForTier(planTier).lessonPlanner === true
  const planningAccess = syllabusEntitlementsFor({ role: 'facilitator', planTier })
  const canScheduleLessons = featuresForTier(planTier).lessonScheduling === true

  function openDayAction(date) {
    setSelectedDate(date)
    setDayActionError('')
    setDayActionDate(date)
  }

  async function refreshPlanningViews() {
    await Promise.all([loadSyllabus(), loadNoSchoolDates()])
  }

  async function setNoSchoolDate({ date, reason }) {
    if (!selectedLearnerId || !accessToken || !date) return
    setDayActionBusy(true)
    setDayActionError('')
    try {
      const response = await fetch('/api/no-school-dates', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ learnerId: selectedLearnerId, date, reason }) })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not mark this day off')
      setDayActionDate('')
      await refreshPlanningViews()
    } catch (cause) {
      setDayActionError(cause.message || 'Could not mark this day off')
    } finally { setDayActionBusy(false) }
  }

  async function clearNoSchoolDate({ date }) {
    if (!selectedLearnerId || !accessToken || !date) return
    setDayActionBusy(true)
    setDayActionError('')
    try {
      const response = await fetch(`/api/no-school-dates?learnerId=${encodeURIComponent(selectedLearnerId)}&date=${encodeURIComponent(date)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not remove the day-off mark')
      setDayActionDate('')
      await refreshPlanningViews()
    } catch (cause) {
      setDayActionError(cause.message || 'Could not remove the day-off mark')
    } finally { setDayActionBusy(false) }
  }

  function createGeneratedDayLesson({ date }) {
    if (!planningAccess.can_change_intent || !selectedLearnerId || !syllabus?.active_revision?.id || !date) return
    setDayActionDate('')
    setDayActionError('')
    const params = new URLSearchParams({
      mode: 'simple',
      source: 'calendar',
      learnerId: selectedLearnerId,
      plannedDate: date,
      expectedActiveRevisionId: syllabus.active_revision.id,
    })
    router.push(`/facilitator/generator?${params.toString()}`)
  }

  async function openExistingLessonPicker(date) {
    if (!canScheduleLessons) return
    setDayActionDate('')
    setScheduleDialog({ mode: 'add', scheduledDate: date })
    setScheduleCatalogLoading(true)
    setScheduleError('')
    try {
      const [publicResults, ownedResponse] = await Promise.all([
        Promise.all(CORE_SUBJECTS.map(async (subject) => {
          const response = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { cache: 'no-store' })
          return [subject, response.ok ? await response.json() : []]
        })),
        fetch('/api/facilitator/lessons/list', { cache: 'no-store', headers: { Authorization: `Bearer ${accessToken}` } }),
      ])
      const publicLessonsBySubject = Object.fromEntries(publicResults.map(([subject, lessons]) => [subject, Array.isArray(lessons) ? lessons : []]))
      const facilitatorLessons = ownedResponse.ok ? await ownedResponse.json() : []
      setScheduleLessons(buildSchedulableLessonOptions({ publicLessonsBySubject, facilitatorLessons }))
    } catch (cause) {
      setScheduleLessons([])
      setScheduleError(cause.message || 'Could not load ready lessons')
    } finally { setScheduleCatalogLoading(false) }
  }

  async function saveExistingLesson(lesson) {
    if (!scheduleDialog?.scheduledDate || !lesson?.lessonKey) return
    setScheduleBusy(true)
    setScheduleError('')
    try {
      const payload = buildLessonSchedulePayload({ learnerId: selectedLearnerId, lessonKey: lesson.lessonKey, scheduledDate: scheduleDialog.scheduledDate })
      const { response, json } = await postLessonScheduleWithCapacityPin({
        payload,
        postSchedule: (body) => fetch('/api/lesson-schedule', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        requestPin: (message) => requestFacilitatorPinException({ message }),
      })
      if (!response.ok) throw new Error(json.error || 'Could not schedule the lesson')
      setScheduleDialog(null)
      await refreshPlanningViews()
    } catch (cause) {
      setScheduleError(cause.message || 'Could not schedule the lesson')
    } finally { setScheduleBusy(false) }
  }

  function selectCalendarItem(item) {
    if (!item?.lesson_key) {
      router.push('/facilitator/syllabus')
      return
    }
    setSelectedLesson(syllabusCalendarSelection(item, { today: resolvedToday }))
  }

  if (authLoading || loading) {
    return <main style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}><p>Loading Calendar...</p></main>
  }

  return (
    <>
      <main style={{ maxWidth: 1280, margin: '0 auto', padding: '16px 18px 32px', display: 'grid', gap: 14 }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 24 }}>Calendar</h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>A month view of the active Syllabus for this learner. Curriculum planning stays in Syllabus.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => router.push('/facilitator/syllabus')} style={{ padding: '8px 12px', border: '1px solid #c7442e', borderRadius: 7, background: '#fff', color: '#c7442e', fontWeight: 800, cursor: 'pointer' }}>Open Syllabus</button>
            <button type="button" onClick={() => portfolioAllowed ? setShowPortfolio(true) : router.push('/facilitator/account/plan')} style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, background: '#fff', color: '#374151', fontWeight: 800, cursor: 'pointer' }}>{portfolioAllowed ? 'Portfolio' : 'Portfolio requires Pro'}</button>
          </div>
        </header>

        {error && <div role="alert" style={{ padding: 10, border: '1px solid #fecaca', borderRadius: 8, background: '#fef2f2', color: '#991b1b' }}>{error}</div>}

        {learners.length === 0 ? (
          <section style={{ padding: 24, border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff' }}>
            <p>No learners found.</p>
            <button type="button" onClick={() => router.push('/facilitator/learners')} style={{ padding: '8px 12px' }}>Manage learners</button>
          </section>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(280px, 0.8fr)', gap: 14, alignItems: 'start' }}>
            <LessonCalendar
              itemsByDate={itemsByDate}
              noSchoolDates={noSchoolDates}
              learners={learners}
              selectedLearnerId={selectedLearnerId}
              selectedDate={selectedDate}
              onLearnerChange={setSelectedLearnerId}
              onDateSelect={setSelectedDate}
              onItemSelect={selectCalendarItem}
              resolvedToday={resolvedToday}
              canManageDays={Boolean(syllabus?.has_active_syllabus)}
              onDayAction={openDayAction}
            />

            <aside style={{ border: '1px solid #d1d5db', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
              <header style={{ padding: 12, borderBottom: '1px solid #e5e7eb' }}>
                <strong>{selectedDate ? prettyDate(selectedDate) : 'Select a date'}</strong>
                {selectedDate && <div style={{ marginTop: 3, fontSize: 12, color: '#6b7280' }}>{selectedItems.length} Syllabus {selectedItems.length === 1 ? 'item' : 'items'}</div>}
              </header>
              <div style={{ padding: 10, display: 'grid', gap: 8 }}>
                {selectedDate && noSchoolDates[selectedDate] !== undefined && (
                  <div style={{ padding: 9, borderRadius: 7, background: '#fffbeb', color: '#92400e', fontSize: 12 }}>
                    {noSchoolDates[selectedDate] || 'Day off'} - this date is protected from new instructional planning.
                  </div>
                )}
                {!syllabus?.has_active_syllabus && (
                  <div style={{ padding: 10, border: '1px solid #e5e7eb', borderRadius: 8 }}>
                    <strong>No active Syllabus</strong>
                    <p style={{ margin: '5px 0 10px', color: '#6b7280', fontSize: 12 }}>Calendar no longer creates a separate lesson plan. Establish the learner plan in Syllabus.</p>
                    <button type="button" onClick={() => router.push('/facilitator/syllabus')} style={{ padding: '7px 10px', border: '1px solid #c7442e', borderRadius: 6, background: '#fff', color: '#c7442e', fontWeight: 700 }}>Open Syllabus</button>
                  </div>
                )}
                {syllabus?.has_active_syllabus && selectedItems.length === 0 && <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>Nothing is placed on this date in the active Syllabus.</p>}
                {selectedItems.map((item) => {
                  const teacher = normalizeInstructionalTeacher(item?.assigned_instructional_teacher || item?.instructional_teacher)
                  const clickable = Boolean(item?.lesson_key)
                  return (
                    <button
                      type="button"
                      key={item.occurrence_id || item.id || `${item.title}-${item.sort_order}`}
                      onClick={() => selectCalendarItem(item)}
                      style={{ width: '100%', textAlign: 'left', padding: 10, border: '1px solid #e5e7eb', borderRadius: 8, background: syllabusCalendarItemCompleted(item) ? '#f9fafb' : '#fff', cursor: 'pointer' }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#6b7280' }}>{item.subject || 'Lesson'}</span>
                        <span style={{ fontSize: 10, color: '#6b7280' }}>{statusLabel(item)}</span>
                      </div>
                      <div style={{ marginTop: 3, fontWeight: 800, color: '#111827' }}>{item.title || 'Untitled lesson'}</div>
                      {teacher && item.item_type !== 'slate_assignment' && <div style={{ marginTop: 4, fontSize: 11, color: '#6b7280' }}>{instructionalTeacherLabel(teacher)}</div>}
                      {!clickable && <div style={{ marginTop: 5, fontSize: 11, color: '#c7442e' }}>Open in Syllabus to prepare this concept</div>}
                    </button>
                  )
                })}
              </div>
            </aside>
          </div>
        )}
      </main>

      {dayActionDate && (
        <SyllabusDayActionDialog
          date={dayActionDate}
          subjects={syllabus?.active_revision?.subjects || []}
          isNoSchool={Object.prototype.hasOwnProperty.call(noSchoolDates, dayActionDate)}
          noSchoolReason={noSchoolDates[dayActionDate] || ''}
          canGenerate={planningAccess.can_change_intent}
          canUseExisting={canScheduleLessons}
          busy={dayActionBusy}
          error={dayActionError}
          onClose={() => { setDayActionDate(''); setDayActionError('') }}
          onGenerate={createGeneratedDayLesson}
          onUseExisting={({ date }) => { void openExistingLessonPicker(date) }}
          onMarkNoSchool={setNoSchoolDate}
          onClearNoSchool={clearNoSchoolDate}
        />
      )}

      {scheduleDialog && (
        <SyllabusScheduleDialog
          mode="add"
          scheduledDate={scheduleDialog.scheduledDate}
          minimumDate={resolvedToday}
          lessons={scheduleLessons}
          loading={scheduleCatalogLoading}
          busy={scheduleBusy}
          error={scheduleError}
          onClose={() => { setScheduleDialog(null); setScheduleError('') }}
          onDateChange={(scheduledDate) => setScheduleDialog((current) => ({ ...current, scheduledDate }))}
          onChooseLesson={saveExistingLesson}
        />
      )}

      {selectedLesson && (
        <FacilitatorSyllabusLessonOverlay
          selection={selectedLesson}
          learnerId={selectedLearnerId}
          accessToken={accessToken}
          planTier={planTier}
          resolvedToday={resolvedToday}
          activeRevisionId={activeRevisionId}
          onChanged={loadSyllabus}
          onClose={() => setSelectedLesson(null)}
          canChangeIntent={false}
        />
      )}

      <GeneratePortfolioModal
        open={showPortfolio && portfolioAllowed}
        onClose={() => setShowPortfolio(false)}
        learnerId={selectedLearnerId}
        learnerName={selectedLearner?.name || ''}
        authToken={accessToken}
        portal
      />

      <GatedOverlay
        show={!isAuthenticated}
        gateType={gateType || 'auth'}
        feature="Calendar"
        description="Sign in to view the learner's Syllabus by month and date."
        benefits={['See planned and completed Syllabus occurrences by date', 'Open lesson details from the Calendar', 'Keep curriculum authorship in one Syllabus']}
      />
    </>
  )
}