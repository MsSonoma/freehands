# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Main calendar shows 2026 but /api/lesson-schedule includeAll=1 returns only 2025. Find how /facilitator/calendar builds dots and whether it merges lesson-history sessions/events into scheduledLessons.
```

Filter terms used:
```text
/api/lesson-schedule
/facilitator/calendar
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/lesson-schedule /facilitator/calendar

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/facilitator/calendar/page.js (32b45bffac4f45d7f500daedea9cb9671ada21f4a95c4a86320e30fb74253337)
- bm25: -4.9483 | entity_overlap_w: 1.50 | adjusted: -5.3233 | relevance: 1.0000

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

### 2. src/app/facilitator/calendar/page.js (c2521be237a199cb7f605cd99dfb540049509998146be81842fe1b7cce9cc3de)
- bm25: -4.4250 | entity_overlap_w: 3.00 | adjusted: -5.1750 | relevance: 1.0000

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

### 3. src/app/facilitator/calendar/page.js (45a3f960320e40cd0f5d44fbd1557244327369796a5b24116ee137e4fc1a97a6)
- bm25: -4.5977 | entity_overlap_w: 1.50 | adjusted: -4.9727 | relevance: 1.0000

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

### 4. src/app/facilitator/calendar/page.js (36f6a926f8e360bba6f24fca8d7b7d8f84d510afd1ea41fbb8571aa71b562ecb)
- bm25: -4.3183 | entity_overlap_w: 1.50 | adjusted: -4.6933 | relevance: 1.0000

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

### 5. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (214f0d5c11c7eaff1f38e4225f567adad3006b35cf5f81c186ff5ee66a765f26)
- bm25: -3.7420 | entity_overlap_w: 3.00 | adjusted: -4.4920 | relevance: 1.0000

// Delete old schedule entry
      const deleteResponse = await fetch(
        `/api/lesson-schedule?id=${scheduleItem.id}`,
        {
          method: 'DELETE',
          headers: {
            'authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

if (!deleteResponse.ok) throw new Error('Failed to remove old schedule')

// Create new schedule entry with new date
      const scheduleResponse = await fetch('/api/lesson-schedule', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          learnerId: learnerId,
          lessonKey: lessonKey,
          scheduledDate: newDate
        })
      })

if (!scheduleResponse.ok) throw new Error('Failed to reschedule lesson')

setRescheduling(null)
      setScheduledLessons({})
      await loadSchedule()
    } catch (err) {
      alert('Failed to reschedule lesson')
    }
  }

const handleGenerateClick = (plannedLesson) => {
    if (!selectedDate) return
    setGeneratorData({
      grade: learnerGrade || plannedLesson.grade || '',
      difficulty: plannedLesson.difficulty || 'intermediate',
      subject: plannedLesson.subject || '',
      title: plannedLesson.title || '',
      description: plannedLesson.description || ''
    })
    setShowGenerator(true)
  }

const handleRedoClick = async (plannedLesson) => {
    if (!selectedDate) return
    if (!learnerId || learnerId === 'none') return

setRedoingLesson(plannedLesson.id)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

### 6. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (06029eef735bc91eca5ae8443bab75512c019f0300e98172f3d9885f9fdaf7b6)
- bm25: -3.6910 | entity_overlap_w: 3.00 | adjusted: -4.4410 | relevance: 1.0000

const loadSchedule = useCallback(async (opts = {}) => {
    return loadScheduleForLearner(learnerId, opts)
  }, [learnerId, loadScheduleForLearner])

const loadPlanned = useCallback(async (opts = {}) => {
    return loadPlannedForLearner(learnerId, opts)
  }, [learnerId, loadPlannedForLearner])

const loadCalendarData = useCallback(async (opts = {}) => {
    await Promise.all([loadSchedule(opts), loadPlanned(opts)])
  }, [loadPlanned, loadSchedule])

const handleRemoveScheduledLessonById = async (scheduleId, opts = {}) => {
    if (!scheduleId) return
    if (!opts?.skipConfirm) {
      if (!confirm('Remove this lesson from the schedule?')) return
    }

try {
      const token = await getBearerToken()
      if (!token) return
      const deleteResponse = await fetch(
        `/api/lesson-schedule?id=${scheduleId}`,
        {
          method: 'DELETE',
          headers: {
            'authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

if (!deleteResponse.ok) throw new Error('Failed to remove lesson')

setScheduledLessons({})
      await loadSchedule()
    } catch (err) {
      alert('Failed to remove lesson')
    }
  }

const handleRescheduleLesson = async (lessonKey, oldDate, newDate) => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

// Find the schedule ID
      const findResponse = await fetch(
        `/api/lesson-schedule?learnerId=${learnerId}&startDate=${oldDate}&endDate=${oldDate}`,
        {
          headers: {
            'authorization': `Bearer ${token}`
          }
        }
      )

### 7. src/app/api/lesson-schedule/route.js (47ef18c7ef8591e1134821feeca37edb0523ee56b2a25da080d4a4fea679da09)
- bm25: -4.3522 | relevance: 1.0000

const schedule = (data || []).map(item => ({
      ...item,
      lesson_key: normalizeLessonKey(item.lesson_key)
    }))

### 8. src/app/api/lesson-schedule/route.js (ca0f60fa0dca3687b8f61cedd6301cd7c813c69f954d1e7a45d4f6c8bbea1c63)
- bm25: -4.2060 | relevance: 1.0000

// Insert or update schedule entry
    const { data, error } = await adminSupabase
      .from('lesson_schedule')
      .upsert({
        facilitator_id: user.id,
        learner_id: learnerId,
        lesson_key: normalizedLessonKey,
        scheduled_date: scheduledDate
      }, {
        onConflict: 'learner_id,lesson_key,scheduled_date'
      })
      .select()
      .single()

### 9. src/app/facilitator/calendar/page.js (5e87d7c4007b60bd8dc94a3654ecdcc51bd79003e2d025df44b062ea052b69f4)
- bm25: -4.1358 | relevance: 1.0000

if (pastSchedule.length > 0 && minPastDate) {
          // IMPORTANT: Do not query lesson_session_events directly from the client.
          // In some environments, RLS causes the query to return an empty array without an error,
          // which hides all past schedule history. Use the admin-backed API endpoint instead.
          const historyRes = await fetch(
            `/api/learner/lesson-history?learner_id=${selectedLearnerId}&from=${encodeURIComponent(minPastDate)}&to=${encodeURIComponent(todayStr)}`
          )
          const historyJson = await historyRes.json().catch(() => null)

### 10. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -3.7058 | entity_overlap_w: 1.50 | adjusted: -4.0808 | relevance: 1.0000

if (!token) {
        setGenerating(false)
        return
      }

// Fetch lesson history (completed, scheduled, planned)
      const [historyRes, medalsRes, scheduledRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

let lessonContext = []
      let curriculumPrefs = {}

// Build chronological lesson history with scores
      if (historyRes.ok) {
        const history = await historyRes.json()
        let medals = {}
        
        // Get medals if available
        if (medalsRes.ok) {
          medals = await medalsRes.json()
        }
        
        // Completed lessons with scores
        const completed = (history.sessions || [])
          .filter(s => s.status === 'completed')
          .map(s => ({
            name: s.lesson_id,
            date: s.ended_at,
            status: 'completed',
            score: medals[s.lesson_id]?.bestPercent || null
          }))

// Incomplete lessons
        const incomplete = (history.sessions || [])
          .filter(s => s.status === 'incomplete')
          .map(s => ({
            name: s.lesson_id,
            date: s.started_at,
            status: 'incomplete'
          }))

lessonContext = [...completed, ...incomplete]
      }

### 11. src/app/api/lesson-schedule/route.js (c10bed9dcb49fa72fe049a0f0fcf902d9eb1ad304af4dafb1bdd0eeda1a31c73)
- bm25: -3.8491 | relevance: 1.0000

query = query
        .eq('learner_id', learnerId)
        .eq('scheduled_date', scheduledDate)

### 12. src/app/facilitator/generator/counselor/CounselorClient.jsx (0cfd9fad62d7fbfc6f7777e33bafc3dd9dcfeb4000945f4f833d493d6441d65d)
- bm25: -3.7569 | relevance: 1.0000

// Get loading thought based on interceptor state
  const getLoadingThought = useCallback((flow, awaitingInput, action) => {
    // Action-based thoughts (highest priority)
    if (action?.type === 'generate') {
      return "Generating your custom lesson with AI..."
    }
    if (action?.type === 'schedule') {
      return "Adding this lesson to the calendar..."
    }
    if (action?.type === 'edit') {
      return "Opening the lesson editor..."
    }
    
    // Flow and input-based thoughts
    if (flow === 'generate') {
      if (awaitingInput === 'generate_topic') return "Thinking about lesson topics..."
      if (awaitingInput === 'generate_grade_confirm') return "Checking learner's grade level..."
      if (awaitingInput === 'generate_grade') return "Considering grade levels..."
      if (awaitingInput === 'generate_subject') return "Identifying the subject area..."
      if (awaitingInput === 'generate_difficulty') return "Determining difficulty level..."
      if (awaitingInput === 'generate_title') return "Crafting the perfect title..."
      return "Preparing lesson parameters..."
    }
    
    if (flow === 'schedule') {
      if (awaitingInput === 'schedule_date') return "Looking at the calendar..."
      if (awaitingInput === 'schedule_lesson_search') return "Searching for lessons to schedule..."
      if (awaitingInput === 'post_generation_schedule') return "Reviewing the generated lesson..."
      return "Scheduling the lesson..."
    }
    
    if (flow === 'search') {
      if (awaitingInput === 'lesson_selection') return "Found several matches, reviewing them..."
      return "Searching through your lessons..."
    }
    
    if (flow === 'edit') {
      if (awaitingInput === 'edit_changes') return "Analyzing the requested changes..."
      if (awaiti

### 13. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (e5fdc46b298a439caa0898d99e9cc93420e88023859c9956645aea444cf67dd7)
- bm25: -3.3771 | entity_overlap_w: 1.50 | adjusted: -3.7521 | relevance: 1.0000

// Get all scheduled lessons for this learner
      let response
      try {
        response = await fetch(`/api/lesson-schedule?learnerId=${targetLearnerId}&includeAll=1`, {
          headers: {
            'authorization': `Bearer ${token}`
          },
          signal: controller.signal
        })
      } finally {
        // scheduleTimeoutId cleared in finally
      }

### 14. src/app/api/lesson-schedule/route.js (fdfe6ca1e56a33700c5a63226b57ae193e8bd934c0e88fd91fadefb49167865c)
- bm25: -3.5736 | relevance: 1.0000

// Get active lessons for today (used by learner view)
    if (action === 'active' && learnerId) {
      // Use local date, not UTC
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const today = `${year}-${month}-${day}`
      
      const { data, error } = await adminSupabase
        .from('lesson_schedule')
        .select('lesson_key')
        .eq('learner_id', learnerId)
        .eq('scheduled_date', today)

### 15. src/app/facilitator/calendar/LessonPlanner.jsx (2cdb279d41617abc41fcf9088b8da7c5c209b33cd6b03cc5f9bccb95193eb4d0)
- bm25: -3.3652 | relevance: 1.0000

// Add scheduled lessons
      if (scheduledRes.ok) {
        const scheduledData = await scheduledRes.json()
        const scheduledLessons = (scheduledData.schedule || []).map(s => ({
          name: s.lesson_key,
          date: s.scheduled_date,
          status: 'scheduled'
        }))
        lessonContext = [...lessonContext, ...scheduledLessons]
      }

### 16. src/app/api/lesson-schedule/route.js (b33bd740558edd520fdee5af977045a6c5245a5f47769c3b6a91df96c263423c)
- bm25: -3.3202 | relevance: 1.0000

if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

const lessons = (data || []).map(item => ({
        ...item,
        lesson_key: normalizeLessonKey(item.lesson_key)
      }))

return NextResponse.json({ lessons })
    }

// Get schedule for date range
    if (!learnerId) {
      return NextResponse.json({ error: 'learnerId required' }, { status: 400 })
    }

// Verify the learner belongs to this facilitator.
    // (GET previously relied only on facilitator_id filtering, which can hide legacy schedule rows.)
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

let query = adminSupabase
      .from('lesson_schedule')
      .select('*')
      .eq('learner_id', learnerId)
      .order('scheduled_date', { ascending: true })

// Default behavior: prefer facilitator-scoped schedule rows, plus safe legacy rows where facilitator_id is null.
    // Overlay/debug callers can pass includeAll=1 to retrieve all schedule rows for an owned learner.
    if (!includeAll) {
      query = query.or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
    }

if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

const { data, error } = await query

if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

### 17. src/app/facilitator/calendar/page.js (4f93e9cc0018c9b6e27aad45f0db5ed725a2d8b9081a5d3956bf19db6ce6f906)
- bm25: -3.3136 | relevance: 1.0000

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

### 18. src/app/api/lesson-schedule/route.js (5a7c545f4e75b6cbb1c7e50235eb02427b56a50609b93787dcb79d4d4282eaec)
- bm25: -3.1297 | relevance: 1.0000

if (keySet.length === 1) {
        query = query.eq('lesson_key', keySet[0])
      } else {
        query = query.in('lesson_key', keySet)
      }
    } else {
      return NextResponse.json(
        { error: 'Either id or (learnerId, lessonKey, scheduledDate) required' },
        { status: 400 }
      )
    }

const { error } = await query

if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

return NextResponse.json({ success: true })
  } catch (error) {
    // General DELETE error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

### 19. src/app/facilitator/generator/counselor/CounselorClient.jsx (ce2fbe1986b441a81ce4477430a0a63798f32d329cd1a0b749d476315bdc9736)
- bm25: -3.0140 | relevance: 1.0000

if (initialToolResults.length > 0) {
        setLoadingThought("Processing tool results...")
        for (const toolResult of initialToolResults) {
          if (toolResult.lesson && toolResult.lessonFile && toolResult.userId) {
            setLoadingThought("Validating generated lesson...")
            const summary = await handleLessonGeneration(toolResult, token)
            if (summary) {
              validationSummaries.push(summary)
            }
          }
          
          // Dispatch events for schedule_lesson success
          if (toolResult.success && toolResult.scheduled) {
            setLoadingThought("Updating calendar...")
            try {
              window.dispatchEvent(new CustomEvent('mr-mentor:lesson-scheduled', {
                detail: {
                  learnerName: toolResult.learnerName,
                  scheduledDate: toolResult.scheduledDate,
                  lessonTitle: toolResult.lessonTitle
                }
              }))
            } catch (err) {
              // Silent error handling
            }
          }
        }
      }

### 20. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (fd0011a12def58f4e07c7ed2944d7736c5c47a836e2be66b55df86f95e20f328)
- bm25: -2.9838 | relevance: 1.0000

if (!grouped[dateStr]) grouped[dateStr] = []
        grouped[dateStr].push({
          id: item.id, // Include the schedule ID
          facilitator_id: item.facilitator_id,
          lesson_title: item.lesson_key?.split('/')[1]?.replace('.json', '').replace(/_/g, ' ') || 'Lesson',
          subject: item.lesson_key?.split('/')[0] || 'Unknown',
          grade: 'Various',
          lesson_key: item.lesson_key,
          completed
        })
      })
      if (requestId >= (scheduleLastAppliedRequestIdRef.current || 0)) {
        scheduleLastAppliedRequestIdRef.current = requestId
        setScheduledLessons(grouped)
        devWarn(`schedule: loaded dates=${Object.keys(grouped || {}).length} rows=${(data || []).length}`)
        setTableExists(true)
        scheduleLoadedForLearnerRef.current = targetLearnerId
        scheduleLoadedAtRef.current = Date.now()
      } else {
        devWarn('schedule: older result ignored')
      }
    } catch (err) {
      if (String(err?.name || '') === 'AbortError') {
        devWarn('schedule: timeout/abort', err)
        // Do not clear state on timeout; a newer request may have succeeded.
      } else {
        devWarn('schedule: unexpected error', err)
        if (requestId === scheduleRequestIdRef.current) {
          setScheduledLessons({})
        }
      }
    } finally {
      clearTimeout(scheduleTimeoutId)
      if (scheduleAbortRef.current === controller) {
        scheduleAbortRef.current = null
        scheduleInFlightLearnerRef.current = null
        scheduleLoadInFlightRef.current = false
      }
      devWarn(`schedule: done ms=${Date.now() - startedAtMs}`)
    }
  }, [])

const persistPlannedForDate = async (dateStr, lessonsForDate) => {
    if (!learnerId || learnerId === 'none') return false

### 21. src/app/facilitator/generator/counselor/CounselorClient.jsx (a6b4fcf60b8cdfe7c39b8b108cc2eb1f12c4ff650b1e0bc74055b7faba0dd8cc)
- bm25: -2.9805 | relevance: 1.0000

const saveRes = await fetch('/api/schedule-templates', {
                  method,
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(body)
                })

### 22. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (2b37cfd5780b3ccb2c551bf838d06aa3f96088d036a47e8744734e0fad93ff8b)
- bm25: -2.9665 | relevance: 1.0000

devWarn(`schedule: response ms=${Date.now() - startedAtMs} status=${String(response?.status)} ok=${String(response?.ok)}`)

if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        devWarn('schedule: fetch failed', { status: response.status, body: bodyText })
        return
      }

const result = await response.json()
      devWarn(`schedule: parsed json ms=${Date.now() - startedAtMs}`)
      const data = result.schedule || []

const todayStr = getLocalTodayStr()

// Fast-path: render scheduled lessons immediately.
      // Completion history lookup can be slow; it should not block schedule visibility.
      try {
        const immediate = {}
        for (const item of (data || [])) {
          const dateStr = item?.scheduled_date
          const lessonKey = item?.lesson_key
          if (!dateStr || !lessonKey) continue

if (!immediate[dateStr]) immediate[dateStr] = []
          immediate[dateStr].push({
            id: item.id,
            facilitator_id: item.facilitator_id,
            lesson_title: item.lesson_key?.split('/')[1]?.replace('.json', '').replace(/_/g, ' ') || 'Lesson',
            subject: item.lesson_key?.split('/')[0] || 'Unknown',
            grade: 'Various',
            lesson_key: item.lesson_key,
            completed: false
          })
        }

### 23. src/app/facilitator/calendar/page.js (569159c022eeefbef72c84948696a977e7abd5cab0f47ded3ae5961abff0e070)
- bm25: -2.9383 | relevance: 1.0000

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

### 24. src/app/facilitator/calendar/page.js (1db79234858e7d0148563fd858ac899d67a9657b556f61818ac44e1f3df4e7e1)
- bm25: -2.9041 | relevance: 1.0000

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

### 25. src/app/api/lesson-schedule/route.js (6d7df52b363d5609301104b88d5cc69a5484da9dade446b61041bcc0147b5109)
- bm25: -2.8919 | relevance: 1.0000

// API endpoint for lesson schedule management
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learnerId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const action = searchParams.get('action') // 'active' to get today's active lessons
    const includeAll = searchParams.get('includeAll') === '1'

const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

// Extract the token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '').trim()
    
    if (!token) {
      return NextResponse.json({ error: 'Invalid authorization token' }, { status: 401 })
    }
    
    // Use service key for admin operations, but verify user's token
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
    
    // Validate the user's token
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized', details: userError?.message }, { status: 401 })
    }

### 26. src/app/facilitator/calendar/page.js (0a377186862f438af1cc355b6434ce533b912b26ddfc368cb5a3ca5eecb19ddc)
- bm25: -2.8571 | relevance: 1.0000

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
        'View all scheduled lessons in a monthly calend

### 27. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a4a99aa029dd97fb994cebf6e9ccd9ea3cf1d90af17893eeca90de6dbcdef176)
- bm25: -2.8483 | relevance: 1.0000

if (!findResponse.ok) throw new Error('Failed to find schedule entry')
      
      const findResult = await findResponse.json()
      const schedules = findResult.schedule || []
      const scheduleItem = schedules.find(s => s.lesson_key === lessonKey && s.scheduled_date === oldDate)
      
      if (!scheduleItem) throw new Error('Schedule entry not found')

### 28. src/app/facilitator/calendar/page.js (c9c353ed7ee343f531886f74706eac2c2bef9932de9d89f1819a6330fa59cca5)
- bm25: -2.8263 | relevance: 1.0000

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

### 29. src/app/facilitator/calendar/LessonPlanner.jsx (1fbb70905a390fd19d72eac8bee15e9fe0cf794d4655f0b246aac936570f9299)
- bm25: -2.8045 | relevance: 1.0000

useEffect(() => {
    loadCustomSubjects()
    loadWeeklyPattern()
  }, [learnerId])

useEffect(() => {
    if (typeof initialPlanStartDate === 'string' && initialPlanStartDate.trim()) {
      setPlanStartDate(initialPlanStartDate.trim())
    }
  }, [initialPlanStartDate])

useEffect(() => {
    if (initialPlanDuration !== undefined && initialPlanDuration !== null) {
      const asNum = Number(initialPlanDuration)
      if (Number.isFinite(asNum) && asNum >= 1 && asNum <= 4) {
        setPlanDuration(asNum)
      }
    }
  }, [initialPlanDuration])

const loadCustomSubjects = async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

if (!token) return

const response = await fetch('/api/custom-subjects', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

if (response.ok) {
        const result = await response.json()
        setCustomSubjects(result.subjects || [])
      }
    } catch (err) {
      console.error('Error loading custom subjects:', err)
    }
  }

const loadWeeklyPattern = async () => {
    if (!learnerId) return

try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

if (!token) return

const response = await fetch(`/api/schedule-templates?learnerId=${learnerId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

### 30. src/app/api/lesson-schedule/route.js (b5be32024d7ff077e3b69e232458618bf6a49b5041ad4afb38cd7a56a874aabe)
- bm25: -2.7429 | relevance: 1.0000

if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

const normalizedData = data ? { ...data, lesson_key: normalizeLessonKey(data.lesson_key) } : null

return NextResponse.json({ success: true, data: normalizedData })
  } catch (error) {
    // General POST error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
  const scheduleId = searchParams.get('id')
  const learnerId = searchParams.get('learnerId')
  const lessonKey = searchParams.get('lessonKey')
    const scheduledDate = searchParams.get('scheduledDate')

const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

const token = authHeader.replace('Bearer ', '')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

let query = adminSupabase
      .from('lesson_schedule')
      .delete()
      .eq('facilitator_id', user.id)

if (scheduleId) {
      query = query.eq('id', scheduleId)
    } else if (learnerId && lessonKey && scheduledDate) {
      const normalizedLessonKey = normalizeLessonKey(lessonKey)
      const keySet = Array.from(new Set([normalizedLessonKey, lessonKey].filter(Boolean)))

### 31. src/app/facilitator/calendar/page.js (2dcc2af2d35261efb21e47a8847ac87876da694036e1d14cce6cd8a62dcb8fe4)
- bm25: -2.7339 | relevance: 1.0000

const handleScheduleLesson = async (lessonKey, date) => {
    if (!requirePlannerAccess()) return
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        alert('Please log in to schedule lessons')
        return
      }

### 32. src/app/facilitator/calendar/LessonPlanner.jsx (0b41f195b7b2aa7b56f1325c29180124ac2eabd6eab111d82e54cc93b8668309)
- bm25: -2.7039 | relevance: 1.0000

const response = await fetch('/api/generate-lesson-outline', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  subject: subjectInfo.subject,
                  grade: learnerGrade || '3rd',
                  difficulty: recommendedDifficulty,
                  learnerId,
                  context: dynamicContextText  // Include lesson history, preferences, and generation-so-far
                })
              })

### 33. src/app/facilitator/calendar/LessonPlanner.jsx (d59d3e29d6e19afcd3e10aeeca379527f75c274eed4fa814369470d5128856cc)
- bm25: -2.6717 | relevance: 1.0000

const saveWeeklyPattern = async () => {
    if (!requirePlannerAccess()) return
    if (!learnerId) {
      alert('Please select a learner first')
      return
    }

try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

if (!token) return

const method = templateId ? 'PUT' : 'POST'
      const body = {
        learnerId,
        name: 'Weekly Schedule',
        pattern: weeklyPattern,
        active: true
      }

if (templateId) {
        body.id = templateId
      }

const response = await fetch('/api/schedule-templates', {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

if (response.ok) {
        const result = await response.json()
        if (!templateId) {
          setTemplateId(result.template.id)
        }
        alert('Weekly pattern saved!')
      }
    } catch (err) {
      console.error('Error saving pattern:', err)
      alert('Failed to save weekly pattern')
    }
  }

const generatePlannedLessons = async (startDate, weeks = 4) => {
    if (!requirePlannerAccess()) return
    if (!learnerId) {
      alert('Please select a learner first')
      return
    }

const hasAnySubjects = DAYS.some(day => weeklyPattern[day]?.length > 0)
    if (!hasAnySubjects) {
      alert('Please assign subjects to at least one day of the week')
      return
    }

setGenerating(true)
    const lessons = {}

// Track what we generate during this run so later prompts can avoid repeats
    const generatedSoFar = []

### 34. src/app/facilitator/generator/counselor/CounselorClient.jsx (ef8192c3563a04d5a6d34e4178fbc548d838d1c90e9629ff35618ea9a0d53a68)
- bm25: -2.6339 | relevance: 1.0000

- Title: ${genData.lesson.title}
- Grade: ${genData.lesson.grade}
- Difficulty: ${genData.lesson.difficulty}
- Vocabulary: ${vocab}
- Teaching Notes: ${notes}

As a next step, you might consider adding this lesson to your learner's plan. You can either schedule it on a specific date, or assign it so it shows up as available for ${learnerName || 'this learner'}.

Would you like me to schedule this lesson, or assign it to ${learnerName || 'this learner'}?`

// Set state to await schedule vs assign
                    interceptorRef.current.state.awaitingInput = 'post_generation_action'
                    
                    // Dispatch event to refresh lessons overlay
                    window.dispatchEvent(new CustomEvent('mr-mentor:lesson-generated'))
                  }
                }
              } catch (err) {
                // Generation failed - will show in response
              }
            }
          } else if (action.type === 'edit') {
            // Trigger lesson editor
            setActiveScreen('lessons')
            // Could pass edit instructions as context
          } else if (action.type === 'save_curriculum_preferences') {
            setLoadingThought('Saving curriculum preferences...')

const supabase = getSupabaseClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

### 35. src/app/facilitator/generator/counselor/CounselorClient.jsx (5e9a1fde43a303665b912c12a2715edf1c58592fe07c30a6c78c3dc85e6937aa)
- bm25: -2.5968 | relevance: 1.0000

try {
      // Try interceptor first
      const selectedLearner = learners.find(l => l.id === selectedLearnerId)
      const learnerName = selectedLearner?.name
      const learnerGrade = selectedLearner?.grade
      const allLessons = await loadAllLessons()
      
      setLoadingThought(getLoadingThought(
        interceptorRef.current.state.flow,
        interceptorRef.current.state.awaitingInput,
        null
      ))
      
      const interceptResult = await interceptorRef.current.process(message, {
        allLessons,
        selectedLearnerId,
        learnerName,
        learnerGrade,
        conversationHistory
      })
      
      console.log('[CounselorClient] Interceptor result:', JSON.stringify({
        handled: interceptResult.handled,
        hasResponse: !!interceptResult.response,
        hasAction: !!interceptResult.action,
        response: interceptResult.response?.substring(0, 100),
        fullResponse: interceptResult.response
      }, null, 2))
      
      if (interceptResult.handled) {
        // Update loading thought based on what we're doing
        if (interceptResult.action) {
          setLoadingThought(getLoadingThought(
            interceptorRef.current.state.flow,
            interceptorRef.current.state.awaitingInput,
            interceptResult.action
          ))
        }
        
        // Add user message to conversation
        const updatedHistory = [
          ...conversationHistory,
          { role: 'user', content: message }
        ]
        
        // Handle action if present
        if (interceptResult.action) {
          const action = interceptResult.action
          
          if (action.type === 'schedule') {
            setLoadingThought("Adding this lesson to the calendar...")
            // Schedule the les

### 36. src/app/facilitator/calendar/LessonPlanner.jsx (8ae7a00c94a81bb7d0702b0c9983dad57ff00de8515e988d59101520fa46cf82)
- bm25: -2.5802 | relevance: 1.0000

if (contextText) {
        contextText += '\n\n=== PLANNING RULES: NEW TOPICS vs REVIEW ==='
          contextText += `\nPrefer NEW topics most of the time, but schedule REVIEW lessons for low scores (<= ${LOW_SCORE_REVIEW_THRESHOLD}%).`
          contextText += `\nAvoid repeating lessons that scored well (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%).`

### 37. src/app/facilitator/calendar/page.js (72f70893c01946442b9eded07b75bb6144d62ca4c9aa3ec475af49117056e8d3)
- bm25: -2.5244 | relevance: 1.0000

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

### 38. src/app/api/lesson-schedule/route.js (4e2c1ffc674e34ab1fce99b270dbdd3c6432e19a7c7bc8c4021b29cdbb2111a5)
- bm25: -2.4552 | relevance: 1.0000

return NextResponse.json({ schedule })
  } catch (error) {
    // General GET error
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { learnerId, lessonKey, scheduledDate } = body

if (!learnerId || !lessonKey || !scheduledDate) {
      return NextResponse.json(
        { error: 'learnerId, lessonKey, and scheduledDate required' },
        { status: 400 }
      )
    }

const normalizedLessonKey = normalizeLessonKey(lessonKey)

const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

const token = authHeader.replace('Bearer ', '')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

// Verify the learner belongs to this facilitator
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

### 39. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (684e5fa7c7303fbdfbcfae9a1ca16eb1fac0d2179881d3bf469ee98ee5346d78)
- bm25: -2.2865 | relevance: 1.0000

const force = !!opts?.force
    if (scheduleLoadInFlightRef.current) {
      const inFlightLearner = scheduleInFlightLearnerRef.current
      if (inFlightLearner && inFlightLearner !== targetLearnerId) {
        abortInFlightLoad(scheduleAbortRef, scheduleInFlightLearnerRef, 'schedule')
      } else {
        devWarn('schedule: in-flight, skipping', { inFlightLearner })
        return
      }
    }
    if (!force
      && scheduleLoadedForLearnerRef.current === targetLearnerId
      && (Date.now() - (scheduleLoadedAtRef.current || 0)) < MIN_REFRESH_INTERVAL_MS
    ) {
      devWarn('schedule: throttled, skipping', { targetLearnerId })
      return
    }

devWarn(`schedule: start learner=${targetLearnerId} force=${String(force)} hasTokenFallback=${String(Boolean(tokenFallbackRef.current))}`)

const controller = new AbortController()
    scheduleAbortRef.current = controller
    scheduleInFlightLearnerRef.current = targetLearnerId
    scheduleLoadInFlightRef.current = true
    const requestId = ++scheduleRequestIdRef.current
    const startedAtMs = Date.now()
    const scheduleTimeoutId = setTimeout(() => {
      try { controller.abort() } catch {}
    }, 45000)
    
    try {
      const token = await getBearerToken()
      devWarn(`schedule: got token ms=${Date.now() - startedAtMs} hasToken=${String(Boolean(token))}`)

if (token) {
        setAuthToken((prev) => (prev === token ? prev : token))
      }

if (!token) {
        devWarn('schedule: missing auth token')
        return
      }

### 40. src/app/facilitator/generator/counselor/CounselorClient.jsx (631d57d3573f2c9ffb7a6e5d1200f9c08ac0edbe0f4786df9ee642649b84ce8a)
- bm25: -2.1628 | relevance: 1.0000

const js = await res.json().catch(() => null)
                if (!res.ok) {
                  interceptResult.response = js?.error
                    ? `I couldn't save curriculum preferences: ${js.error}`
                    : "I couldn't save curriculum preferences. Please try again."
                } else {
                  interceptResult.response = `Saved curriculum preferences for ${learnerName || 'this learner'}.`
                }
              } catch {
                interceptResult.response = "I couldn't save curriculum preferences. Please try again."
              }
            }
          } else if (action.type === 'save_weekly_pattern') {
            setLoadingThought('Saving weekly pattern...')

const supabase = getSupabaseClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

if (!token || !selectedLearnerId) {
              interceptResult.response = 'Please select a learner first.'
            } else {
              try {
                const getRes = await fetch(`/api/schedule-templates?learnerId=${selectedLearnerId}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                })
                const getJs = await getRes.json().catch(() => null)
                const templates = Array.isArray(getJs?.templates) ? getJs.templates : []
                const activeTemplate = templates.find(t => t?.active) || templates[0] || null

const method = activeTemplate?.id ? 'PUT' : 'POST'
                const body = activeTemplate?.id
                  ? { id: activeTemplate.id, pattern: action.pattern }
                  : { learnerId: selectedLearnerId, name: 'Weekly Schedule', pattern: action.pattern, active: true }
