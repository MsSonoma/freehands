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

export default function CalendarPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true })
  const [pinChecked, setPinChecked] = useState(false)
  const [learners, setLearners] = useState([])
  const [selectedLearnerId, setSelectedLearnerId] = useState('')
  const [selectedDate, setSelectedDate] = useState(null)
  const [scheduledLessons, setScheduledLessons] = useState({}) // Format: { 'YYYY-MM-DD': [{...}] }
  const [scheduledForSelectedDate, setScheduledForSelectedDate] = useState([])
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState('free')
  const [hasAccess, setHasAccess] = useState(false)
  const [tableExists, setTableExists] = useState(true)
  const [rescheduling, setRescheduling] = useState(null) // Track which lesson is being rescheduled

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
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedLearnerId) {
        loadSchedule()
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

      const grouped = {}
      schedule.forEach(item => {
        if (!grouped[item.scheduled_date]) {
          grouped[item.scheduled_date] = []
        }
        grouped[item.scheduled_date].push(item)
      })

      setScheduledLessons(grouped)
    } catch (err) {
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

      await loadSchedule()
      alert('Lesson scheduled successfully!')
    } catch (err) {
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
      alert('Failed to remove lesson')
    }
  }

  const handleRescheduleLesson = async (item, newDate) => {
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
            <style jsx>{`
              .calendar-container {
                display: flex;
                flex-direction: column;
                gap: 1.5rem;
                align-items: stretch;
              }
              
              @media (min-aspect-ratio: 1/1) {
                .calendar-container {
                  flex-direction: row;
                  align-items: flex-start;
                }
                .calendar-container > div {
                  flex: 1;
                  min-width: 0;
                }
              }
            `}</style>
            <div className="calendar-container">
              {/* Left Panel: Calendar */}
              <div>
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
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
                              onClick={() => setRescheduling(item.id)}
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

                {/* Reschedule popup modal */}
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

                {/* Lesson Picker - always visible */}
                <LessonPicker
                  learnerId={selectedLearnerId}
                  selectedDate={selectedDate}
                  onScheduleLesson={handleScheduleLesson}
                  scheduledLessonsForDate={scheduledForSelectedDate}
                />
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
