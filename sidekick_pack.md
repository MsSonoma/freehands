# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Missing Jan/Feb scheduled lessons; old scheduled entries disappeared; check /api/lesson-schedule facilitator_id scoping and overlay fast-path immediate schedule
```

Filter terms used:
```text
/api/lesson-schedule
facilitator_id
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/lesson-schedule facilitator_id

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a9bad28bca6d1746bfc7000dc0a7e725e54fa43a6828cd22ffec0c88e973bd76)
- bm25: -6.2926 | entity_overlap_w: 2.00 | adjusted: -6.7926 | relevance: 1.0000

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

### 2. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a9a58f7503a776d8934c8916ca18cf3bc1a60047bf016c63dda1e107a2702cb7)
- bm25: -6.0534 | entity_overlap_w: 2.00 | adjusted: -6.5534 | relevance: 1.0000

devWarn(`schedule: response ms=${Date.now() - startedAtMs} status=${String(response?.status)} ok=${String(response?.ok)}`)

if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        devWarn('schedule: fetch failed', { status: response.status, body: bodyText })
        setScheduledLessons({})
        return
      }

const result = await response.json()
      devWarn(`schedule: parsed json ms=${Date.now() - startedAtMs}`)
      const data = result.schedule || []

const todayStr = getLocalTodayStr()

// Fast-path: render today's + future scheduled lessons immediately.
      // Completion history lookup can be slow; it should not block basic schedule visibility.
      try {
        const immediate = {}
        for (const item of (data || [])) {
          const dateStr = item?.scheduled_date
          const lessonKey = item?.lesson_key
          if (!dateStr || !lessonKey) continue
          if (dateStr < todayStr) continue

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

if (requestId >= (scheduleLastAppliedRequestIdRef.current || 0)) {
          scheduleLastAppliedRequestIdRef.current = requestId
          setScheduledLessons(immediate)
          devWarn(`schedule: immediate loaded dates=${Object.keys(immediate || {}).length}`)
        } else {
          devWarn('schedule: older immediate result ignored')
        }
      } catch {}

### 3. src/app/api/lesson-schedule/route.js (8dd821793c7b52be7dd29371a13ede4188daa5089bb7ae8f716e6fac7ca859d1)
- bm25: -6.0322 | entity_overlap_w: 2.00 | adjusted: -6.5322 | relevance: 1.0000

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

### 4. src/app/api/lesson-schedule/route.js (cbe02459270e38c583d005b8751bb6eeab128a68cfa150e4ed1939076eff6de3)
- bm25: -5.5569 | entity_overlap_w: 1.00 | adjusted: -5.8069 | relevance: 1.0000

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

let query = adminSupabase
      .from('lesson_schedule')
      .select('*')
      .eq('learner_id', learnerId)
      .eq('facilitator_id', user.id)
      .order('scheduled_date', { ascending: true })

if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

const { data, error } = await query

if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

const schedule = (data || []).map(item => ({
      ...item,
      lesson_key: normalizeLessonKey(item.lesson_key)
    }))

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

### 5. src/app/api/planned-lessons/route.js (343b4ca5051beb3247ceb138f38e20ea48dd8d8ff5a9dbd9426f26ab307e073b)
- bm25: -5.2470 | entity_overlap_w: 1.00 | adjusted: -5.4970 | relevance: 1.0000

// Insert all the planned lessons
    const rows = []
    for (const [dateStr, lessons] of Object.entries(plannedLessons)) {
      for (const lesson of lessons) {
        rows.push({
          facilitator_id: user.id,
          learner_id: learnerId,
          scheduled_date: dateStr,
          lesson_data: lesson
        })
      }
    }

### 6. src/app/api/lesson-schedule/route.js (e3e6825cefda1c047350974672a20a450297ed6e32721772e992386dfb08c03f)
- bm25: -5.0091 | entity_overlap_w: 1.00 | adjusted: -5.2591 | relevance: 1.0000

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

query = query
        .eq('learner_id', learnerId)
        .eq('scheduled_date', scheduledDate)

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

### 7. src/app/api/planned-lessons/route.js (1155247505724eedf75a99809ee4ce5c968b0ca4c5fac18265308dec38ea5439)
- bm25: -4.7224 | entity_overlap_w: 1.00 | adjusted: -4.9724 | relevance: 1.0000

// Delete all planned lessons for this learner
    const { error } = await adminSupabase
      .from('planned_lessons')
      .delete()
      .eq('learner_id', learnerId)
      .eq('facilitator_id', user.id)

### 8. src/app/facilitator/generator/counselor/CounselorClient.jsx (ff285077ec24364a3d15a828b25960da37c088fbeb7771884ec5d2aa164606df)
- bm25: -4.2182 | entity_overlap_w: 3.00 | adjusted: -4.9682 | relevance: 1.0000

if (!isMountedRef.current) {
          console.log('[Realtime] Ignoring - component unmounted')
          return
        }

const updatedSession = payload.new
        const oldSession = payload.old

// Only process updates for this user's sessions
        if (updatedSession.facilitator_id !== user.id) {
          console.log('[Realtime] Ignoring - different user:', {
            eventUserId: updatedSession.facilitator_id,
            myUserId: user.id
          })
          return
        }

console.log('[Realtime] Session update detected:', { 
          updatedSessionId: updatedSession.session_id, 
          mySessionId: sessionId,
          isActive: updatedSession.is_active,
          wasActive: oldSession.is_active,
          facilitatorId: updatedSession.facilitator_id,
          deviceName: updatedSession.device_name
        })

### 9. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (4d4384d9cf54637991218f8fa13dc50638c712498f9fada7583f74668a9711e0)
- bm25: -4.2989 | entity_overlap_w: 2.00 | adjusted: -4.7989 | relevance: 1.0000

const handleEditClick = async (scheduledLesson) => {
    setEditingLesson(scheduledLesson.lesson_key)
    setLessonEditorLoading(true)
    setLessonEditorData(null)

try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const authedUserId = session?.user?.id

if (!token || !authedUserId) throw new Error('Not authenticated')
      if (scheduledLesson.facilitator_id && scheduledLesson.facilitator_id !== authedUserId) {
        throw new Error('Cannot edit another facilitator\'s lesson')
      }

const params = new URLSearchParams({ file: scheduledLesson.lesson_key })
      const response = await fetch(`/api/facilitator/lessons/get?${params}`, {
        cache: 'no-store',
        headers: { authorization: `Bearer ${token}` }
      })

if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to load lesson')
      }

const data = await response.json()
      setLessonEditorData(data)
    } catch (err) {
      alert('Failed to load lesson for editing')
      setEditingLesson(null)
      setLessonEditorData(null)
    } finally {
      setLessonEditorLoading(false)
    }
  }

const handleSaveLessonEdits = async (updatedLesson) => {
    setLessonEditorSaving(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

const normalizedFile = String(editingLesson || '')
        .replace(/^generated\//, '')
        .replace(/\.json$/i, '')
      const file = `${normalizedFile}.json`

### 10. src/app/api/planned-lessons/route.js (7bb83e1b735347cdb92c56c77ea2eae34dddf977f0a051beb8da3b1cea7adafd)
- bm25: -4.4978 | entity_overlap_w: 1.00 | adjusted: -4.7478 | relevance: 1.0000

// Fetch planned lessons for this learner.
    // Primary: scoped to this facilitator.
    // Fallback: if there are legacy rows under a single different facilitator_id, return them (read compatibility).
    let data = null
    let error = null

### 11. src/app/facilitator/calendar/page.js (c2521be237a199cb7f605cd99dfb540049509998146be81842fe1b7cce9cc3de)
- bm25: -3.9966 | entity_overlap_w: 3.00 | adjusted: -4.7466 | relevance: 1.0000

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

### 12. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (e3dd37af8020877f0ac3e015ff3707b148f29772ad846d00ffe229905982dbf4)
- bm25: -3.9000 | entity_overlap_w: 3.00 | adjusted: -4.6500 | relevance: 1.0000

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

### 13. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (2738d896564459d2de4fc76721f526e83e69a87936645781d3a6f6ba19e13e89)
- bm25: -3.8406 | entity_overlap_w: 3.00 | adjusted: -4.5906 | relevance: 1.0000

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

### 14. src/app/facilitator/calendar/page.js (32b45bffac4f45d7f500daedea9cb9671ada21f4a95c4a86320e30fb74253337)
- bm25: -4.0958 | entity_overlap_w: 1.50 | adjusted: -4.4708 | relevance: 1.0000

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

### 15. src/app/api/planned-lessons/route.js (13b1caac815cc9c704fe436689e8b167bcfdb8a8352521129c2b4450d7acf36d)
- bm25: -3.9307 | entity_overlap_w: 2.00 | adjusted: -4.4307 | relevance: 1.0000

const primary = await adminSupabase
      .from('planned_lessons')
      .select('*')
      .eq('learner_id', learnerId)
      .eq('facilitator_id', user.id)
      .order('scheduled_date', { ascending: true })

data = primary.data
    error = primary.error

if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

if (!Array.isArray(data) || data.length === 0) {
      const fallback = await adminSupabase
        .from('planned_lessons')
        .select('*')
        .eq('learner_id', learnerId)
        .order('scheduled_date', { ascending: true })

if (fallback.error) {
        return NextResponse.json({ error: fallback.error.message }, { status: 500 })
      }

const allRows = Array.isArray(fallback.data) ? fallback.data : []
      const distinctFacilitators = Array.from(
        new Set(allRows.map(r => r?.facilitator_id).filter(Boolean))
      )

// Only return fallback rows if they're clearly a single legacy owner/facilitator namespace.
      if (distinctFacilitators.length === 1) {
        data = allRows
      } else {
        data = []
      }
    }

// Transform to the format expected by the calendar: { 'YYYY-MM-DD': [{...}] }
    const plannedLessons = {}
    for (const row of data || []) {
      const dateStr = row.scheduled_date
      if (!plannedLessons[dateStr]) {
        plannedLessons[dateStr] = []
      }
      plannedLessons[dateStr].push(row.lesson_data)
    }

return NextResponse.json({ plannedLessons })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

### 16. src/app/facilitator/calendar/page.js (45a3f960320e40cd0f5d44fbd1557244327369796a5b24116ee137e4fc1a97a6)
- bm25: -3.8555 | entity_overlap_w: 1.50 | adjusted: -4.2305 | relevance: 1.0000

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

### 17. src/app/facilitator/calendar/page.js (36f6a926f8e360bba6f24fca8d7b7d8f84d510afd1ea41fbb8571aa71b562ecb)
- bm25: -3.8063 | entity_overlap_w: 1.50 | adjusted: -4.1813 | relevance: 1.0000

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

### 18. src/app/api/planned-lessons/route.js (61d4c28ba90f1d8e1e9174584b7c682b2d97aedbd8d4340b91e8ddb0c66f0ead)
- bm25: -3.5253 | entity_overlap_w: 2.00 | adjusted: -4.0253 | relevance: 1.0000

const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Invalid authorization token' }, { status: 401 })
    }
    
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
    
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

const body = await request.json()
    const { learnerId, plannedLessons } = body

if (!learnerId || !plannedLessons) {
      return NextResponse.json({ error: 'learnerId and plannedLessons required' }, { status: 400 })
    }

// Verify the learner belongs to this facilitator/owner
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

// Get all dates in the new plan
    const newPlanDates = Object.keys(plannedLessons)

// Delete existing planned lessons ONLY for dates in the new plan
    // This allows multiple non-overlapping plans to coexist
    if (newPlanDates.length > 0) {
      await adminSupabase
        .from('planned_lessons')
        .delete()
        .eq('learner_id', learnerId)
        .eq('facilitator_id', user.id)
        .in('scheduled_date', newPlanDates)
    }

### 19. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (e2147456f555b2849bbb40ea2e499f083438789c1215e3d7571c312a6b0f1bba)
- bm25: -3.5475 | entity_overlap_w: 1.50 | adjusted: -3.9225 | relevance: 1.0000

// Get all scheduled lessons for this learner
      let response
      try {
        response = await fetch(`/api/lesson-schedule?learnerId=${targetLearnerId}`, {
          headers: {
            'authorization': `Bearer ${token}`
          },
          signal: controller.signal
        })
      } finally {
        // scheduleTimeoutId cleared in finally
      }

### 20. src/app/api/lesson-schedule/route.js (de5d4f159a60872ee1157045ee26007198a719f7af0ba2498d615936b08fca18)
- bm25: -3.8565 | relevance: 1.0000

const authHeader = request.headers.get('authorization')
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

### 21. src/app/api/lesson-schedule/route.js (96199d3e358dd0859b0ec2adba5e3762640a2d57abee748323f46d90f446936f)
- bm25: -3.7151 | relevance: 1.0000

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

### 22. src/app/api/lesson-schedule/route.js (69d3eee6f156c63e2341596910389371d8a1cc228b35186e66937b5ee27825ef)
- bm25: -3.6650 | relevance: 1.0000

const token = authHeader.replace('Bearer ', '')
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

### 23. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -3.1928 | entity_overlap_w: 1.50 | adjusted: -3.5678 | relevance: 1.0000

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

### 24. src/app/facilitator/calendar/page.js (5e87d7c4007b60bd8dc94a3654ecdcc51bd79003e2d025df44b062ea052b69f4)
- bm25: -3.4300 | relevance: 1.0000

if (pastSchedule.length > 0 && minPastDate) {
          // IMPORTANT: Do not query lesson_session_events directly from the client.
          // In some environments, RLS causes the query to return an empty array without an error,
          // which hides all past schedule history. Use the admin-backed API endpoint instead.
          const historyRes = await fetch(
            `/api/learner/lesson-history?learner_id=${selectedLearnerId}&from=${encodeURIComponent(minPastDate)}&to=${encodeURIComponent(todayStr)}`
          )
          const historyJson = await historyRes.json().catch(() => null)

### 25. src/app/facilitator/calendar/page.js (06ebcf62d0bcfee55d26176a874d2276873c83e6faff89802b02dd63a58e3ed8)
- bm25: -3.1350 | entity_overlap_w: 1.00 | adjusted: -3.3850 | relevance: 1.0000

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

### 26. src/app/facilitator/generator/counselor/CounselorClient.jsx (a6b4fcf60b8cdfe7c39b8b108cc2eb1f12c4ff650b1e0bc74055b7faba0dd8cc)
- bm25: -3.1352 | relevance: 1.0000

const saveRes = await fetch('/api/schedule-templates', {
                  method,
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify(body)
                })

### 27. src/app/facilitator/generator/counselor/CounselorClient.jsx (0cfd9fad62d7fbfc6f7777e33bafc3dd9dcfeb4000945f4f833d493d6441d65d)
- bm25: -3.0822 | relevance: 1.0000

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

### 28. src/app/api/lesson-schedule/route.js (8f69ac1409551eb253ae23abe98537e8ecfbfe2ab7ec08ff5201b30019ffa775)
- bm25: -3.0538 | relevance: 1.0000

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

### 29. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (7b23c5e9a0fd73edfee5eea832dcd8e043d015df6bd7da49968abb7cff81c6b7)
- bm25: -3.0518 | relevance: 1.0000

if (pastSchedule.length > 0 && minPastDate) {
          devWarn(`schedule: history lookup start from=${minPastDate} to=${todayStr}`)
          const historyController = new AbortController()
          const historyTimeoutId = setTimeout(() => {
            try { historyController.abort() } catch {}
          }, 15000)
          let historyRes
          try {
            if (controller.signal?.aborted) {
              throw Object.assign(new Error('Aborted'), { name: 'AbortError' })
            }
            const onAbort = () => {
              try { historyController.abort() } catch {}
            }
            try {
              controller.signal?.addEventListener?.('abort', onAbort, { once: true })
            } catch {}
            historyRes = await fetch(
              `/api/learner/lesson-history?learner_id=${targetLearnerId}&from=${encodeURIComponent(minPastDate)}&to=${encodeURIComponent(todayStr)}`,
              {
                headers: { 'authorization': `Bearer ${token}` },
                signal: historyController.signal
              }
            )
          } finally {
            clearTimeout(historyTimeoutId)
          }

devWarn(`schedule: history response ms=${Date.now() - startedAtMs} status=${String(historyRes?.status)} ok=${String(historyRes?.ok)}`)
          const historyJson = await historyRes.json().catch(() => null)

### 30. src/app/api/planned-lessons/route.js (409b13631d40e3eab10c3cf145e29d6fbfadf7797175b902f67442ce966bf63f)
- bm25: -2.7624 | entity_overlap_w: 1.00 | adjusted: -3.0124 | relevance: 1.0000

// API endpoint for planned lessons management
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learnerId')

const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Invalid authorization token' }, { status: 401 })
    }
    
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
    
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

if (!learnerId) {
      return NextResponse.json({ error: 'learnerId required' }, { status: 400 })
    }

// Verify the learner belongs to this facilitator/owner.
    // Planned lessons are treated as per-learner data (not per-facilitator), but still require authorization.
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

### 31. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (b3e61a9f34002134cf1295cb92a2f63d36c8682d5dbde3b51c06b41bfc8e7519)
- bm25: -2.9947 | relevance: 1.0000

if (!findResponse.ok) throw new Error('Failed to find schedule entry')
      
      const findResult = await findResponse.json()
      const schedules = findResult.schedule || []
      const scheduleItem = schedules.find(s => s.lesson_key === lessonKey && s.scheduled_date === oldDate)
      
      if (!scheduleItem) throw new Error('Schedule entry not found')

### 32. src/app/facilitator/calendar/page.js (4f93e9cc0018c9b6e27aad45f0db5ed725a2d8b9081a5d3956bf19db6ce6f906)
- bm25: -2.8655 | relevance: 1.0000

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

### 33. src/app/api/planned-lessons/route.js (bfaa6a1243e23df0f4a406a0f8cc2ae7e8472cc94a9cd3e668aef31064b7d7cd)
- bm25: -2.5240 | entity_overlap_w: 1.00 | adjusted: -2.7740 | relevance: 1.0000

if (rows.length > 0) {
      const { error: insertError } = await adminSupabase
        .from('planned_lessons')
        .insert(rows)

if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 })
      }
    }

return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learnerId')

const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization' }, { status: 401 })
    }

const token = authHeader.replace('Bearer ', '').trim()
    if (!token) {
      return NextResponse.json({ error: 'Invalid authorization token' }, { status: 401 })
    }
    
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })
    
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

if (!learnerId) {
      return NextResponse.json({ error: 'learnerId required' }, { status: 400 })
    }

// Verify the learner belongs to this facilitator/owner
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

### 34. src/app/facilitator/generator/counselor/CounselorClient.jsx (ef8192c3563a04d5a6d34e4178fbc548d838d1c90e9629ff35618ea9a0d53a68)
- bm25: -2.7472 | relevance: 1.0000

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

### 35. src/app/facilitator/calendar/LessonPlanner.jsx (2cdb279d41617abc41fcf9088b8da7c5c209b33cd6b03cc5f9bccb95193eb4d0)
- bm25: -2.4813 | relevance: 1.0000

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

### 36. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (e0ad5c6af2e149fd6621619800de3cd5e18d65f71dc4ed3ac46a215056a04686)
- bm25: -2.4439 | relevance: 1.0000

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
        setScheduledLessons({})
        return
      }

### 37. src/app/facilitator/calendar/page.js (569159c022eeefbef72c84948696a977e7abd5cab0f47ded3ae5961abff0e070)
- bm25: -2.3961 | relevance: 1.0000

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

### 38. src/app/facilitator/generator/counselor/CounselorClient.jsx (ce2fbe1986b441a81ce4477430a0a63798f32d329cd1a0b749d476315bdc9736)
- bm25: -2.2967 | relevance: 1.0000

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

### 39. src/app/facilitator/generator/counselor/CounselorClient.jsx (631d57d3573f2c9ffb7a6e5d1200f9c08ac0edbe0f4786df9ee642649b84ce8a)
- bm25: -2.2908 | relevance: 1.0000

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

### 40. src/app/facilitator/calendar/LessonPlanner.jsx (1fbb70905a390fd19d72eac8bee15e9fe0cf794d4655f0b246aac936570f9299)
- bm25: -2.2635 | relevance: 1.0000

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
