// Facilitator Calendar - Main scheduling interface
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier, resolveEffectiveTier } from '@/app/lib/entitlements'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import GatedOverlay from '@/app/components/GatedOverlay'
import LessonCalendar from './LessonCalendar'
import LessonPicker from './LessonPicker'
import LessonPlanner from './LessonPlanner'
import DayViewOverlay from './DayViewOverlay'
import LessonNotesModal from './LessonNotesModal'
import VisualAidsManagerModal from './VisualAidsManagerModal'
import PortfolioScansModal from './PortfolioScansModal'
import TypedRemoveConfirmModal from './TypedRemoveConfirmModal'
import GeneratePortfolioModal from './GeneratePortfolioModal'
import { InlineExplainer, PageHeader } from '@/components/FacilitatorHelp'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'

export default function CalendarPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true })
  const [pinChecked, setPinChecked] = useState(false)
  const [authToken, setAuthToken] = useState('')
  const [learners, setLearners] = useState([])
  const [selectedLearnerId, setSelectedLearnerId] = useState('')
  const [selectedDate, setSelectedDate] = useState(null)
  const [scheduledLessons, setScheduledLessons] = useState({}) // Format: { 'YYYY-MM-DD': [{...}] }
  const [scheduledForSelectedDate, setScheduledForSelectedDate] = useState([])
  const [plannedLessons, setPlannedLessons] = useState({}) // Format: { 'YYYY-MM-DD': [{...}] }
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState('free')
  const [canPlan, setCanPlan] = useState(false)
  const [tableExists, setTableExists] = useState(true)
  const [rescheduling, setRescheduling] = useState(null) // Track which lesson is being rescheduled
  const [activeTab, setActiveTab] = useState('scheduler') // 'scheduler' or 'planner'
  const [showDayView, setShowDayView] = useState(false)
  const [noSchoolDates, setNoSchoolDates] = useState({}) // Format: { 'YYYY-MM-DD': 'reason' }

  const [notesItem, setNotesItem] = useState(null)
  const [visualAidsItem, setVisualAidsItem] = useState(null)
  const [portfolioScansItem, setPortfolioScansItem] = useState(null)
  const [removeConfirmItem, setRemoveConfirmItem] = useState(null)
  const [showGeneratePortfolio, setShowGeneratePortfolio] = useState(false)

  const getLocalTodayStr = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const toLocalDateStr = (dateLike) => {
    const dt = new Date(dateLike)
    if (Number.isNaN(dt.getTime())) return null
    const year = dt.getFullYear()
    const month = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const addDaysToDateStr = (dateStr, days) => {
    try {
      const [y, m, d] = String(dateStr || '').split('-').map(n => Number(n))
      if (!y || !m || !d) return null
      const dt = new Date(y, m - 1, d)
      if (Number.isNaN(dt.getTime())) return null
      dt.setDate(dt.getDate() + Number(days || 0))
      const yy = dt.getFullYear()
      const mm = String(dt.getMonth() + 1).padStart(2, '0')
      const dd = String(dt.getDate()).padStart(2, '0')
      return `${yy}-${mm}-${dd}`
    } catch {
      return null
    }
  }

  // Canonical lesson id used for matching completion events to scheduled lessons.
  // Completion rows often store a filename-ish id, while schedule stores subject/prefix paths.
  // Canonicalize both to the same basename-without-extension.
  const canonicalLessonId = (raw) => {
    if (!raw) return null
    const normalized = normalizeLessonKey(String(raw)) || String(raw)
    const base = normalized.includes('/') ? normalized.split('/').pop() : normalized
    const withoutExt = String(base || '').replace(/\.json$/i, '')
    return withoutExt || null
  }

  // Check PIN requirement on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const allowed = await ensurePinAllowed('facilitator-page');
        if (!allowed) {
          router.push('/');
          return;
        }
        if (!cancelled) setPinChecked(true);
      } catch (e) {
        if (!cancelled) setPinChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (!pinChecked) return;
    checkAccess()
  }, [pinChecked])

  // Send title to HeaderBar
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ms:session:title', { detail: 'Lesson Calendar' }))
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('ms:session:title', { detail: '' }))
      }
    }
  }, [])

  useEffect(() => {
    if (!pinChecked) return
    if (!isAuthenticated) return
    loadLearners()
  }, [pinChecked, isAuthenticated])

  useEffect(() => {
    if (selectedLearnerId) {
      loadSchedule()
      loadPlannedLessons()
      loadNoSchoolDates()
    }
  }, [selectedLearnerId])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedLearnerId) {
        loadSchedule()
        loadNoSchoolDates()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [selectedLearnerId])

  useEffect(() => {
    if (selectedDate && scheduledLessons[selectedDate]) {
      setScheduledForSelectedDate(scheduledLessons[selectedDate])
    } else {
      setScheduledForSelectedDate([])
    }
  }, [selectedDate, scheduledLessons])

  const checkAccess = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      // Don't redirect - let the overlay handle it
      if (!session?.user) {
        setCanPlan(false)
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_tier, subscription_tier')
        .eq('id', session.user.id)
        .maybeSingle()

      const effectiveTier = resolveEffectiveTier(profile?.subscription_tier, profile?.plan_tier)
      setTier(effectiveTier)
      
      const ent = featuresForTier(effectiveTier)
      setCanPlan(Boolean(ent.lessonPlanner))
      setLoading(false)
    } catch (err) {
      setCanPlan(false)
      setLoading(false)
    }
  }

  const showViewOnlyNotice = () => {
    alert('View-only: upgrade to Pro to schedule, plan, reschedule, or remove lessons.')
  }

  const requirePlannerAccess = () => {
    if (canPlan) return true
    showViewOnlyNotice()
    return false
  }

  const loadLearners = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('learners')
        .select('id, name, grade')
        .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
        .order('name')

      if (error) throw error
      setLearners(data || [])
      
      if (data && data.length > 0) {
        setSelectedLearnerId(data[0].id)
      }
    } catch (err) {
      // Silent fail
    }
  }

  const loadSchedule = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) {
        return
      }

      if (session.access_token !== authToken) setAuthToken(session.access_token)

      // Load the full schedule history for this learner.
      // This enables retroactive backfills (from lesson_history) to show up on older months.
      // We still filter past dates to only completed lessons after loading.
      const response = await fetch(
        `/api/lesson-schedule?learnerId=${selectedLearnerId}`,
        {
          headers: {
            'authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        let errorData = {}
        try {
          errorData = JSON.parse(errorText)
        } catch {
          // Silent fail on parse error
        }
        
        if (errorData.error?.includes('lesson_schedule') || errorData.error?.includes('does not exist') || errorData.error?.includes('relation')) {
          setScheduledLessons({})
          setTableExists(false)
          return
        }
        
        if (response.status === 401) {
          setScheduledLessons({})
          return
        }
        
        throw new Error(errorData.error || 'Failed to load schedule')
      }
      
      setTableExists(true)

      const data = await response.json()
      const schedule = data.schedule || []

      const todayStr = getLocalTodayStr()

      // Build a completion lookup from lesson_session_events.
      // Past scheduled dates will show only completed lessons.
      // NOTE: Lessons may be completed after their scheduled date (make-up work).
      // We treat a scheduled lesson as completed if it is completed on the same date OR within a short window after.
      let completedKeySet = new Set()
      let completedDatesByLesson = new Map()
      let completionLookupFailed = false
      try {
        const pastSchedule = (schedule || []).filter(s => s?.scheduled_date && s.scheduled_date < todayStr)
        const minPastDate = pastSchedule.reduce((min, s) => (min && min < s.scheduled_date ? min : s.scheduled_date), null)

        if (pastSchedule.length > 0 && minPastDate) {
          // IMPORTANT: Do not query lesson_session_events directly from the client.
          // In some environments, RLS causes the query to return an empty array without an error,
          // which hides all past schedule history. Use the admin-backed API endpoint instead.
          const historyRes = await fetch(
            `/api/learner/lesson-history?learner_id=${selectedLearnerId}&from=${encodeURIComponent(minPastDate)}&to=${encodeURIComponent(todayStr)}`
          )
          const historyJson = await historyRes.json().catch(() => null)

          if (!historyRes.ok) {
            completionLookupFailed = true
          } else {
            const events = Array.isArray(historyJson?.events) ? historyJson.events : []
            for (const row of events) {
              if (row?.event_type && row.event_type !== 'completed') continue
              const completedDate = toLocalDateStr(row?.occurred_at)
              const key = canonicalLessonId(row?.lesson_id)
              if (!completedDate || !key) continue
              completedKeySet.add(`${key}|${completedDate}`)
              const prev = completedDatesByLesson.get(key) || []
              prev.push(completedDate)
              completedDatesByLesson.set(key, prev)
            }

            // De-dup + sort dates per lesson for stable comparisons.
            for (const [k, dates] of completedDatesByLesson.entries()) {
              const uniq = Array.from(new Set((dates || []).filter(Boolean))).sort()
              completedDatesByLesson.set(k, uniq)
            }
          }
        }
      } catch {
        // If completion lookup fails, fall back to showing schedule as-is.
        completedKeySet = new Set()
        completedDatesByLesson = new Map()
        completionLookupFailed = true
      }

      const grouped = {}
      schedule.forEach(item => {
        const dateStr = item?.scheduled_date
        const lessonKey = item?.lesson_key
        if (!dateStr || !lessonKey) return

        const isPast = dateStr < todayStr
        const canonical = canonicalLessonId(lessonKey)
        const direct = canonical ? completedKeySet.has(`${canonical}|${dateStr}`) : false
        const windowEnd = addDaysToDateStr(dateStr, 7)
        const makeup = (() => {
          if (!canonical || !windowEnd) return false
          const dates = completedDatesByLesson.get(canonical) || []
          return dates.some(d => d > dateStr && d <= windowEnd)
        })()
        const completed = direct || makeup

        // Past dates: show only completed lessons.
        if (isPast && !completed && !completionLookupFailed) return

        if (!grouped[dateStr]) grouped[dateStr] = []
        grouped[dateStr].push({ ...item, completed })
      })

      setScheduledLessons(grouped)
    } catch (err) {
      setScheduledLessons({})
    }
  }

  const loadPlannedLessons = async () => {
    if (!selectedLearnerId) return
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) return

      const response = await fetch(
        `/api/planned-lessons?learnerId=${selectedLearnerId}`,
        {
          headers: {
            'authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        setPlannedLessons({})
        return
      }
      
      const data = await response.json()
      setPlannedLessons(data.plannedLessons || {})
    } catch (err) {
      console.error('Error loading planned lessons:', err)
      setPlannedLessons({})
    }
  }

  const loadNoSchoolDates = async () => {
    if (!selectedLearnerId) return
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) return

      const response = await fetch(
        `/api/no-school-dates?learnerId=${selectedLearnerId}`,
        {
          headers: {
            'authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) return
      
      const data = await response.json()
      const dates = data.dates || []

      const grouped = {}
      dates.forEach(item => {
        grouped[item.date] = item.reason || ''
      })

      setNoSchoolDates(grouped)
    } catch (err) {
      console.error('Error loading no-school dates:', err)
    }
  }

  const savePlannedLessons = async (lessons) => {
    if (!requirePlannerAccess()) return
    setPlannedLessons(lessons)
    
    if (!selectedLearnerId) return
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) return

      await fetch('/api/planned-lessons', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          learnerId: selectedLearnerId,
          plannedLessons: lessons
        })
      })
    } catch (err) {
      console.error('Error saving planned lessons:', err)
    }
  }

  const handlePlannedLessonUpdate = (date, lessonId, updatedLesson) => {
    if (!requirePlannerAccess()) return
    const updated = { ...plannedLessons }
    if (updated[date]) {
      const index = updated[date].findIndex(l => l.id === lessonId)
      if (index !== -1) {
        updated[date][index] = updatedLesson
        savePlannedLessons(updated)
      }
    }
  }

  const handlePlannedLessonRemove = (date, lessonId) => {
    if (!requirePlannerAccess()) return
    const updated = { ...plannedLessons }
    if (updated[date]) {
      updated[date] = updated[date].filter(l => l.id !== lessonId)
      if (updated[date].length === 0) {
        delete updated[date]
      }
      savePlannedLessons(updated)
    }
  }

  const handleScheduleLesson = async (lessonKey, date) => {
    if (!requirePlannerAccess()) return
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        alert('Please log in to schedule lessons')
        return
      }

      const response = await fetch('/api/lesson-schedule', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          learnerId: selectedLearnerId,
          lessonKey,
          scheduledDate: date,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to schedule lesson')
      }

      await loadSchedule()
      alert('Lesson scheduled successfully!')
    } catch (err) {
      alert(err.message || 'Failed to schedule lesson')
    }
  }

  const handleRemoveScheduledLesson = async (item, opts = {}) => {
    if (!requirePlannerAccess()) return
    if (!opts?.skipConfirm) {
      if (!confirm('Remove this lesson from the schedule?')) return
    }

    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      const response = await fetch(
        `/api/lesson-schedule?id=${item.id}`,
        {
          method: 'DELETE',
          headers: {
            'authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) throw new Error('Failed to remove lesson')

      await loadSchedule()
    } catch (err) {
      alert('Failed to remove lesson')
    }
  }

  const handleRescheduleLesson = async (item, newDate) => {
    if (!requirePlannerAccess()) return
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      // Delete old schedule entry
      const deleteResponse = await fetch(
        `/api/lesson-schedule?id=${item.id}`,
        {
          method: 'DELETE',
          headers: {
            'authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!deleteResponse.ok) throw new Error('Failed to remove old schedule')

      // Create new schedule entry with new date
      const scheduleResponse = await fetch('/api/lesson-schedule', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          learnerId: selectedLearnerId,
          lessonKey: item.lesson_key,
          scheduledDate: newDate
        })
      })

      if (!scheduleResponse.ok) throw new Error('Failed to reschedule lesson')

      setRescheduling(null)
      await loadSchedule()
    } catch (err) {
      alert('Failed to reschedule lesson')
    }
  }

  const handleNoSchoolSet = async (date, reason) => {
    if (!requirePlannerAccess()) return
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) return

      if (reason === null) {
        // Delete no-school date
        const response = await fetch(
          `/api/no-school-dates?learnerId=${selectedLearnerId}&date=${date}`,
          {
            method: 'DELETE',
            headers: {
              'authorization': `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
          }
        )

        if (!response.ok) throw new Error('Failed to remove no-school date')
      } else {
        // Set no-school date
        const response = await fetch('/api/no-school-dates', {
          method: 'POST',
          headers: {
            'authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            learnerId: selectedLearnerId,
            date,
            reason
          })
        })

        if (!response.ok) throw new Error('Failed to set no-school date')
      }

      await loadNoSchoolDates()
    } catch (err) {
      console.error('Error setting no-school date:', err)
      alert('Failed to update no-school date')
    }
  }

  const handleDateSelect = (dateStr) => {
    setSelectedDate(dateStr)
    setShowDayView(true)
  }

  if (authLoading || loading) {
    return <div style={{ padding: '24px' }}><p>Loading…</p></div>
  }

  return (
    <>
      <div style={{ minHeight: '100vh', background: '#f9fafb', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 12 }}>

        {/* Database Setup Warning */}
        {!tableExists && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
            <h3 className="text-yellow-800 font-semibold mb-2">⚠️ Database Setup Required</h3>
            <p className="text-yellow-700 text-sm mb-3">
              The lesson_schedule table hasn&apos;t been created yet. Please run the migration in your Supabase SQL Editor:
            </p>
            <code className="block bg-yellow-100 text-yellow-900 p-2 rounded text-xs mb-2">
              scripts/add-lesson-schedule-table.sql
            </code>
            <p className="text-yellow-700 text-xs">
              After running the migration, refresh this page.
            </p>
          </div>
        )}

        {learners.length > 0 ? (
          <>
            {/* Two-panel layout: Stack on portrait, side-by-side on landscape */}
            <style jsx>{`
              .calendar-container {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                align-items: stretch;
              }
              
              @media (min-aspect-ratio: 1/1) {
                .calendar-container {
                  flex-direction: row;
                  align-items: flex-start;
                  height: calc(100vh - 100px);
                  gap: 0.75rem;
                }
                .calendar-container > .calendar-panel {
                  flex: 1;
                  min-width: 0;
                  position: sticky;
                  top: 12px;
                  align-self: flex-start;
                }
                .calendar-container > .content-panel {
                  flex: 1;
                  min-width: 0;
                  overflow-y: auto;
                  max-height: calc(100vh - 100px);
                }
              }
            `}</style>
            <div className="calendar-container">
              {/* Left Panel: Calendar */}
              <div className="calendar-panel">
                <LessonCalendar
                  learnerId={selectedLearnerId}
                  onDateSelect={handleDateSelect}
                  scheduledLessons={activeTab === 'scheduler' ? scheduledLessons : plannedLessons}
                  noSchoolDates={noSchoolDates}
                  learners={learners}
                  selectedLearnerId={selectedLearnerId}
                  onLearnerChange={setSelectedLearnerId}
                  isPlannedView={activeTab === 'planner'}
                />
              </div>

              {/* Right Panel: Tabs for Scheduler and Planner */}
              <div className="content-panel" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <PageHeader
                  title="Lesson Calendar"
                  subtitle="Organize your teaching schedule with manual scheduling or automated planning"
                  dense
                  actions={
                    <button
                      type="button"
                      onClick={() => setShowGeneratePortfolio(true)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: 10,
                        border: '1px solid #c7d2fe',
                        background: '#eef2ff',
                        color: '#1e40af',
                        fontWeight: 900,
                        fontSize: 12,
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#e0e7ff' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#eef2ff' }}
                    >
                      Generate portfolio
                    </button>
                  }
                />

                {isAuthenticated && !canPlan && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-sm text-indigo-900">
                        <strong>View-only mode.</strong> You can view your calendar, but Pro is required to schedule or plan lessons.
                      </div>
                      <button
                        type="button"
                        onClick={() => router.push('/facilitator/account/plan')}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-md text-xs font-semibold hover:bg-indigo-700"
                      >
                        Upgrade
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Tab Headers */}
                <div style={{
                  display: 'flex',
                  gap: 6,
                  borderBottom: '2px solid #e5e7eb',
                  alignItems: 'center'
                }}>
                  <button
                    onClick={() => setActiveTab('scheduler')}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      fontSize: 13,
                      fontWeight: 600,
                      border: 'none',
                      borderBottom: activeTab === 'scheduler' ? '2px solid #2563eb' : '2px solid transparent',
                      background: 'transparent',
                      color: activeTab === 'scheduler' ? '#2563eb' : '#6b7280',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      marginBottom: -2
                    }}
                  >
                    Schedule Lessons
                  </button>
                  <InlineExplainer
                    helpKey="calendar-scheduler-tab"
                    title="Schedule Tab"
                  >
                    <p>Use this tab to manually assign lessons to specific dates. Click a date on the calendar, browse your lesson library, and add lessons one at a time.</p>
                    <p className="mt-2 text-xs text-gray-500">Best for custom schedules and one-off lessons.</p>
                  </InlineExplainer>
                  <button
                    onClick={() => setActiveTab('planner')}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      fontSize: 13,
                      fontWeight: 600,
                      border: 'none',
                      borderBottom: activeTab === 'planner' ? '2px solid #2563eb' : '2px solid transparent',
                      background: 'transparent',
                      color: activeTab === 'planner' ? '#2563eb' : '#6b7280',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      marginBottom: -2
                    }}
                  >
                    Lesson Planner
                  </button>
                  <InlineExplainer
                    helpKey="calendar-planner-tab"
                    title="Planner Tab"
                  >
                    <p>Generate multi-week lesson outlines automatically. Set a weekly pattern (which subjects on which days), choose duration, and we&apos;ll create a curriculum plan.</p>
                    <p className="mt-2 text-xs text-gray-500">Best for consistent schedules and long-term planning.</p>
                  </InlineExplainer>
                </div>

                {/* Tab Content - Both tabs remain mounted, only visibility changes */}
                <div style={{ display: activeTab === 'scheduler' ? 'block' : 'none' }}>
                  {/* Date Header - only shows when date is selected */}
                  {selectedDate && (
                    <div style={{ 
                      background: 'linear-gradient(to right, #dbeafe, #e0e7ff)', 
                      borderRadius: '8px', 
                      padding: '10px 12px',
                      border: '1px solid #93c5fd'
                    }}>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#1e40af', marginBottom: '2px' }}>
                        {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                          weekday: 'long',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </div>
                      <div style={{ fontSize: '12px', color: '#3b82f6' }}>
                        {scheduledForSelectedDate.length} scheduled
                      </div>
                    </div>
                  )}

                  {/* Scheduled Lessons - Show first if any exist */}
                  {selectedDate && scheduledForSelectedDate.length > 0 && (
                    <div className="bg-white rounded-lg shadow-md border border-gray-300 overflow-hidden">
                      <div style={{ background: '#f0fdf4', padding: '8px 12px', borderBottom: '1px solid #bbf7d0' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#065f46', margin: 0 }}>
                          Scheduled for This Day
                        </h3>
                      </div>
                      <div>
                        {scheduledForSelectedDate.map(item => {
                          const [subject, filename] = item.lesson_key.split('/')
                          const lessonName = filename?.replace('.json', '').replace(/_/g, ' ') || item.lesson_key
                          const isPastSelectedDate = selectedDate < getLocalTodayStr()
                          
                          return (
                            <div
                              key={item.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '8px 12px',
                                borderBottom: '1px solid #e5e7eb'
                              }}
                            >
                              <div style={{ flex: '1', minWidth: 0 }}>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>
                                  {lessonName}
                                </div>
                              </div>
                              {isPastSelectedDate ? (
                                <>
                                  <button
                                    onClick={() => setNotesItem({ ...item, lessonTitle: lessonName })}
                                    style={{
                                      padding: '3px 10px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      borderRadius: '4px',
                                      border: 'none',
                                      cursor: 'pointer',
                                      background: '#f3f4f6',
                                      color: '#111827',
                                      transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                  >
                                    Notes
                                  </button>
                                  <button
                                    onClick={() => setVisualAidsItem({ ...item, lessonTitle: lessonName })}
                                    style={{
                                      padding: '3px 10px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      borderRadius: '4px',
                                      border: 'none',
                                      cursor: 'pointer',
                                      background: '#eff6ff',
                                      color: '#1e40af',
                                      transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#dbeafe'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#eff6ff'}
                                  >
                                    Visual Aids
                                  </button>
                                  <button
                                    onClick={() => setPortfolioScansItem({ ...item, lessonTitle: lessonName })}
                                    style={{
                                      padding: '3px 10px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      borderRadius: '4px',
                                      border: 'none',
                                      cursor: 'pointer',
                                      background: '#f5f3ff',
                                      color: '#5b21b6',
                                      transition: 'background 0.15s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#ede9fe'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#f5f3ff'}
                                  >
                                    Add Images
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (!requirePlannerAccess()) return
                                      setRemoveConfirmItem({ ...item, lessonTitle: lessonName })
                                    }}
                                    style={{
                                      padding: '3px 10px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      borderRadius: '4px',
                                      border: 'none',
                                      cursor: canPlan ? 'pointer' : 'not-allowed',
                                      background: '#fee2e2',
                                      color: '#991b1b',
                                      transition: 'background 0.15s'
                                    }}
                                    disabled={!canPlan}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#fecaca'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#fee2e2'}
                                  >
                                    Remove
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      if (!requirePlannerAccess()) return
                                      setRescheduling(item.id)
                                    }}
                                    style={{
                                      padding: '3px 10px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      borderRadius: '4px',
                                      border: 'none',
                                      cursor: canPlan ? 'pointer' : 'not-allowed',
                                      background: '#eff6ff',
                                      color: '#1e40af',
                                      transition: 'background 0.15s'
                                    }}
                                    disabled={!canPlan}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#dbeafe'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#eff6ff'}
                                  >
                                    Reschedule
                                  </button>
                                  <button
                                    onClick={() => handleRemoveScheduledLesson(item)}
                                    style={{
                                      padding: '3px 10px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      borderRadius: '4px',
                                      border: 'none',
                                      cursor: canPlan ? 'pointer' : 'not-allowed',
                                      background: '#fee2e2',
                                      color: '#991b1b',
                                      transition: 'background 0.15s'
                                    }}
                                    disabled={!canPlan}
                                    onMouseEnter={(e) => e.currentTarget.style.background = '#fecaca'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = '#fee2e2'}
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Lesson Picker */}
                  <LessonPicker
                    learnerId={selectedLearnerId}
                    selectedDate={selectedDate}
                    onScheduleLesson={handleScheduleLesson}
                    scheduledLessonsForDate={scheduledForSelectedDate}
                  />
                </div>

                <div style={{ display: activeTab === 'planner' ? 'block' : 'none' }}>
                  <LessonPlanner
                    learnerId={selectedLearnerId}
                    learnerGrade={learners.find(l => l.id === selectedLearnerId)?.grade || '3rd'}
                    tier={tier}
                    canPlan={canPlan}
                    selectedDate={selectedDate}
                    plannedLessons={plannedLessons}
                    onPlannedLessonsChange={savePlannedLessons}
                    onLessonGenerated={loadSchedule}
                  />
                </div>
              </div>
            </div>

            {/* Reschedule popup modal - outside tabs */}
            {rescheduling && scheduledForSelectedDate.find(item => item.id === rescheduling) && (
              <div 
                style={{ 
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0,0,0,0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 10000
                }}
                onClick={() => setRescheduling(null)}
              >
                <div 
                  style={{
                    background: '#fff',
                    borderRadius: 8,
                    padding: 20,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                    maxWidth: 320,
                    width: '90%'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>
                    📅 Reschedule Lesson
                  </div>
                  <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
                    {(() => {
                      const item = scheduledForSelectedDate.find(item => item.id === rescheduling)
                      const parts = item.lesson_key?.split('/')
                      const filename = parts?.[1] || item.lesson_key
                      return filename?.replace('.json', '').replace(/_/g, ' ') || item.lesson_key
                    })()}
                  </div>
                  
                  <input
                    type="date"
                    defaultValue={selectedDate}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      fontSize: 14,
                      marginBottom: 16,
                      boxSizing: 'border-box'
                    }}
                    id="reschedule-date"
                  />

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => {
                        const dateInput = document.getElementById('reschedule-date')
                        if (dateInput?.value) {
                          const item = scheduledForSelectedDate.find(item => item.id === rescheduling)
                          handleRescheduleLesson(item, dateInput.value)
                        }
                      }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: 'none',
                        borderRadius: 6,
                        background: '#2563eb',
                        color: '#fff',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer'
                      }}
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => setRescheduling(null)}
                      style={{
                        flex: 1,
                        padding: '10px',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        background: '#fff',
                        color: '#374151',
                        fontSize: 14,
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            <LessonNotesModal
              open={!!notesItem}
              onClose={() => setNotesItem(null)}
              learnerId={selectedLearnerId}
              lessonKey={notesItem?.lesson_key}
              lessonTitle={notesItem?.lessonTitle || 'Lesson Notes'}
            />

            <VisualAidsManagerModal
              open={!!visualAidsItem}
              onClose={() => setVisualAidsItem(null)}
              learnerId={selectedLearnerId}
              lessonKey={visualAidsItem?.lesson_key}
              lessonTitle={visualAidsItem?.lessonTitle || 'Visual Aids'}
              authToken={authToken}
            />

            <PortfolioScansModal
              open={!!portfolioScansItem}
              onClose={() => setPortfolioScansItem(null)}
              learnerId={selectedLearnerId}
              lessonKey={portfolioScansItem?.lesson_key}
              lessonTitle={portfolioScansItem?.lessonTitle || 'Lesson'}
              authToken={authToken}
            />

            <TypedRemoveConfirmModal
              open={!!removeConfirmItem}
              onClose={() => setRemoveConfirmItem(null)}
              title="Remove lesson?"
              description="This cannot be undone. Type remove to confirm."
              confirmWord="remove"
              confirmLabel="Remove"
              onConfirm={async () => {
                if (!removeConfirmItem) return
                await handleRemoveScheduledLesson(removeConfirmItem, { skipConfirm: true })
              }}
            />

            <GeneratePortfolioModal
              open={showGeneratePortfolio}
              onClose={() => setShowGeneratePortfolio(false)}
              learnerId={selectedLearnerId}
              learnerName={learners.find(l => l.id === selectedLearnerId)?.name || ''}
              authToken={authToken}
              portal
            />

            {/* Day View Overlay */}
            {showDayView && selectedDate && (
              <DayViewOverlay
                selectedDate={selectedDate}
                scheduledLessons={scheduledLessons[selectedDate] || []}
                plannedLessons={plannedLessons[selectedDate] || []}
                learnerId={selectedLearnerId}
                learnerGrade={learners.find(l => l.id === selectedLearnerId)?.grade || '3rd'}
                tier={tier}
                noSchoolReason={noSchoolDates[selectedDate] || null}
                onClose={() => setShowDayView(false)}
                onLessonGenerated={() => {
                  loadSchedule()
                  loadNoSchoolDates()
                }}
                onNoSchoolSet={handleNoSchoolSet}
                onPlannedLessonUpdate={handlePlannedLessonUpdate}
                onPlannedLessonRemove={handlePlannedLessonRemove}
              />
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-600">No learners found. Add learners first.</p>
            <button
              onClick={() => router.push('/facilitator/learners')}
              className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
            >
              Manage Learners
            </button>
          </div>
        )}
      </div>
    </div>
    
    <GatedOverlay
      show={!isAuthenticated}
      gateType="auth"
      feature="Lesson Calendar"
      emoji="📅"
      description="Sign in to schedule lessons, plan learning activities, and track completion over time."
      benefits={[
        'Schedule lessons in advance for each learner',
        'View all scheduled lessons in a monthly calendar',
        'Track lesson completion and attendance',
        'Set up recurring lesson schedules'
      ]}
    />
    </>
  )
}
