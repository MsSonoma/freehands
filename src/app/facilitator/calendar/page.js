// Facilitator Calendar - Main scheduling interface
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier } from '@/app/lib/entitlements'
import { useAccessControl } from '@/app/hooks/useAccessControl'
import GatedOverlay from '@/app/components/GatedOverlay'
import LessonCalendar from './LessonCalendar'
import LessonPicker from './LessonPicker'

export default function CalendarPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true })
  const [learners, setLearners] = useState([])
  const [selectedLearnerId, setSelectedLearnerId] = useState('')
  const [selectedDate, setSelectedDate] = useState(null)
  const [scheduledLessons, setScheduledLessons] = useState({}) // Format: { 'YYYY-MM-DD': [{...}] }
  const [scheduledForSelectedDate, setScheduledForSelectedDate] = useState([])
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState('free')
  const [hasAccess, setHasAccess] = useState(false)
  const [tableExists, setTableExists] = useState(true)

  useEffect(() => {
    checkAccess()
  }, [])

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
    if (hasAccess) {
      loadLearners()
    }
  }, [hasAccess])

  useEffect(() => {
    if (selectedLearnerId) {
      loadSchedule()
    }
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
        setHasAccess(false)
        setLoading(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('plan_tier')
        .eq('id', session.user.id)
        .maybeSingle()

      const planTier = (profile?.plan_tier || 'free').toLowerCase()
      setTier(planTier)
      
      const ent = featuresForTier(planTier)
      setHasAccess(ent.facilitatorTools)
      setLoading(false)
    } catch (err) {
      console.error('Error checking access:', err)
      setHasAccess(false)
      setLoading(false)
    }
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
      
      // Auto-select first learner
      if (data && data.length > 0) {
        setSelectedLearnerId(data[0].id)
      }
    } catch (err) {
      console.error('Error loading learners:', err)
    }
  }

  const loadSchedule = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      console.log('[Calendar] Session check:', { hasSession: !!session, hasToken: !!session?.access_token })
      
      if (!session?.access_token) {
        console.error('No valid session found')
        return
      }

      // Load schedule for next 3 months
      const startDate = new Date()
      const endDate = new Date()
      endDate.setMonth(endDate.getMonth() + 3)

      const response = await fetch(
        `/api/lesson-schedule?learnerId=${selectedLearnerId}&startDate=${startDate.toISOString().split('T')[0]}&endDate=${endDate.toISOString().split('T')[0]}`,
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
          console.error('Failed to parse error response:', errorText)
        }
        
        console.error('Failed to load schedule:', {
          status: response.status,
          statusText: response.statusText,
          error: errorData,
          rawText: errorText
        })
        
        // If table doesn't exist, just set empty schedule
        if (errorData.error?.includes('lesson_schedule') || errorData.error?.includes('does not exist') || errorData.error?.includes('relation')) {
          console.warn('lesson_schedule table not found. Please run the migration first.')
          setScheduledLessons({})
          setTableExists(false)
          return
        }
        
        // If 401, might be auth issue - show user-friendly message
        if (response.status === 401) {
          console.error('Authentication failed. Try logging out and back in.')
          setScheduledLessons({})
          return
        }
        
        throw new Error(errorData.error || 'Failed to load schedule')
      }
      
      setTableExists(true)

      const data = await response.json()
      const schedule = data.schedule || []

      // Group by date
      const grouped = {}
      schedule.forEach(item => {
        if (!grouped[item.scheduled_date]) {
          grouped[item.scheduled_date] = []
        }
        grouped[item.scheduled_date].push(item)
      })

      setScheduledLessons(grouped)
    } catch (err) {
      console.error('Error loading schedule:', err)
      // Set empty schedule on error to allow page to work
      setScheduledLessons({})
    }
  }

  const handleScheduleLesson = async (lessonKey, date) => {
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

      // Reload schedule
      await loadSchedule()
      alert('Lesson scheduled successfully!')
    } catch (err) {
      console.error('Error scheduling lesson:', err)
      alert(err.message || 'Failed to schedule lesson')
    }
  }

  const handleRemoveScheduledLesson = async (item) => {
    if (!confirm('Remove this lesson from the schedule?')) return

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
      console.error('Error removing lesson:', err)
      alert('Failed to remove lesson')
    }
  }

  if (authLoading || loading) {
    return <div style={{ padding: '24px' }}><p>Loading…</p></div>
  }

  return (
    <>
      <div style={{ minHeight: '100vh', background: '#f9fafb', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 24 }}>

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
            <div style={{ display: 'flex', flexDirection: 'row', gap: '1.5rem', alignItems: 'flex-start' }}>
              {/* Left Panel: Calendar */}
              <div style={{ flex: '1', minWidth: 0 }}>
                <LessonCalendar
                  learnerId={selectedLearnerId}
                  onDateSelect={setSelectedDate}
                  scheduledLessons={scheduledLessons}
                  learners={learners}
                  selectedLearnerId={selectedLearnerId}
                  onLearnerChange={setSelectedLearnerId}
                />
              </div>

              {/* Right Panel: Scheduler for Selected Day */}
              <div style={{ flex: '1', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '100%' }}>
                {selectedDate ? (
                  <>
                    {/* Date Header */}
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

                    {/* Scheduled Lessons - Show first if any exist */}
                    {scheduledForSelectedDate.length > 0 && (
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
                                <button
                                  onClick={() => handleRemoveScheduledLesson(item)}
                                  style={{
                                    padding: '3px 10px',
                                    fontSize: '11px',
                                    fontWeight: '600',
                                    borderRadius: '4px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    background: '#fee2e2',
                                    color: '#991b1b',
                                    transition: 'background 0.15s'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = '#fecaca'}
                                  onMouseLeave={(e) => e.currentTarget.style.background = '#fee2e2'}
                                >
                                  Remove
                                </button>
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
                  </>
                ) : (
                  <div className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                    <p className="text-gray-500 text-lg">
                      ← Select a date on the calendar to schedule lessons
                    </p>
                  </div>
                )}
              </div>
            </div>
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
    
    {isAuthenticated && !hasAccess && (
      <GatedOverlay
        show={true}
        gateType="tier"
        feature="Lesson Calendar"
        emoji="📅"
        description="The Lesson Calendar is a premium facilitator tool. Upgrade your plan to access scheduling and tracking features."
        benefits={[
          'Schedule lessons in advance for each learner',
          'View all scheduled lessons in a monthly calendar',
          'Track lesson completion and attendance',
          'Set up recurring lesson schedules'
        ]}
        currentTier={tier}
        requiredTier="premium"
      />
    )}
    </>
  )
}
