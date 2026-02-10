# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Implement includeAll=1 for /api/planned-lessons similar to /api/lesson-schedule and update CalendarOverlay to fetch planned lessons with includeAll to surface legacy 2026 planned data without wiping 2025.
```

Filter terms used:
```text
/api/lesson-schedule
/api/planned-lessons
CalendarOverlay
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/lesson-schedule /api/planned-lessons CalendarOverlay

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_calendar.md (e1260b37624b2715be0d2aa874920875ac6bf0e06f93fe12ab2bcb2346976220)
- bm25: -8.3892 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Facilitator calendar page: for learner Emma, where do 2026 scheduled and planned lessons come from? Identify the APIs/tables used (lesson_schedule vs lesson_schedule_keys vs planned_lessons or others) and how the UI merges/backfills 2025/2026. Provide entrypoints and key functions.
```

Filter terms used:
```text
lesson_schedule
lesson_schedule_keys
planned_lessons
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

lesson_schedule lesson_schedule_keys planned_lessons

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/api/planned-lessons/route.js (13ab95e2c88ec5cc604a496e80fd74f45cb5f1a254133d4b8bd7639cc043e74b)
- bm25: -4.5542 | entity_overlap_w: 1.00 | adjusted: -4.8042 | relevance: 1.0000

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

### 2. src/app/api/planned-lessons/route.js (db1a9cc005c7ceee5fb09554e6f8802d9c3c6b43eda28afc6d987b8be33f1c49)
- bm25: -4.3282 | entity_overlap_w: 1.00 | adjusted: -4.5782 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

### 2. sidekick_pack_calendar.md (678a099578ce7dfb438cb5f5fdf33a5ee0a1659724364fe1bd4e3d78e5de8141)
- bm25: -7.0414 | entity_overlap_w: 4.00 | adjusted: -8.0414 | relevance: 1.0000

### 4. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (78704a7836d4dd1067eb47baa5b1f38c321b2794cfd9945f1afc04804cd08e34)
- bm25: -4.1971 | relevance: 1.0000

const persistPlannedForDate = async (dateStr, lessonsForDate) => {
    if (!learnerId || learnerId === 'none') return false

try {
      const token = await getBearerToken()
      if (!token) throw new Error('Not authenticated')

const response = await fetch('/api/planned-lessons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          learnerId,
          plannedLessons: { [dateStr]: lessonsForDate }
        })
      })

const js = await response.json().catch(() => null)
      if (!response.ok) throw new Error(js?.error || 'Failed to save planned lessons')
      return true
    } catch (err) {
      alert('Failed to save planned lessons')
      return false
    }
  }

const savePlannedLessons = async (lessons) => {
    setPlannedLessons(lessons)

if (!learnerId || learnerId === 'none') return

try {
      const token = await getBearerToken()
      if (!token) return

await fetch('/api/planned-lessons', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          learnerId,
          plannedLessons: lessons
        })
      })
    } catch (err) {
      alert('Failed to save planned lessons')
    }
  }

### 3. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (9f29236ecc74aa48ec884981627a104c1498126b3b9e9493d8af7ef3de53abad)
- bm25: -6.9638 | entity_overlap_w: 3.00 | adjusted: -7.7138 | relevance: 1.0000

const persistPlannedForDate = async (dateStr, lessonsForDate) => {
    if (!learnerId || learnerId === 'none') return false

try {
      const token = await getBearerToken()
      if (!token) throw new Error('Not authenticated')

const response = await fetch('/api/planned-lessons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          learnerId,
          plannedLessons: { [dateStr]: lessonsForDate }
        })
      })

const js = await response.json().catch(() => null)
      if (!response.ok) throw new Error(js?.error || 'Failed to save planned lessons')
      return true
    } catch (err) {
      alert('Failed to save planned lessons')
      return false
    }
  }

const savePlannedLessons = async (lessons) => {
    setPlannedLessons(lessons)

if (!learnerId || learnerId === 'none') return

try {
      const token = await getBearerToken()
      if (!token) return

await fetch('/api/planned-lessons', {
        method: 'POST',
        headers: {
          'authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          learnerId,
          plannedLessons: lessons
        })
      })
    } catch (err) {
      alert('Failed to save planned lessons')
    }
  }

const loadPlannedForLearner = useCallback(async (targetLearnerId, opts = {}) => {
    if (!targetLearnerId || targetLearnerId === 'none') {
      devWarn('planned: no learner selected', { targetLearnerId })
      setPlannedLessons({})
      plannedLoadedForLearnerRef.current = null
      plannedLoadedAtRef.current = 0
      return
    }

const shouldApplyToState = () => activeLearnerIdRef.current === targetLearnerId

### 4. sidekick_pack_calendar.md (e4850ca724432dcd515d17e688953f4328c7d15cbaa7795617e091d25879d8e8)
- bm25: -6.4466 | entity_overlap_w: 2.50 | adjusted: -7.0716 | relevance: 1.0000

if (token) {
        setAuthToken((prev) => (prev === token ? prev : token))
      }

if (!token) {
        devWarn('schedule: missing auth token')
        return
      }

// Get all scheduled lessons for this learner
      let response
      try {
        response = await fetch(`/api/lesson-schedule?learnerId=${targetLearnerId}&includeAll=1`, {
          headers: {
            'authorization': `Bearer ${token}`
          },
          cache: 'no-store',
          signal: controller.signal
        })
      } finally {
        // scheduleTimeoutId cleared in finally
      }

devWarn(`schedule: response ms=${Date.now() - startedAtMs} status=${String(response?.status)} ok=${String(response?.ok)}`)

if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        devWarn('schedule: fetch failed', { status: response.status, body: bodyText })
        return
      }

const result = await response.json()
      devWarn(`schedule: parsed json ms=${Date.now() - startedAtMs}`)
      const data = result.schedule || []

### 39. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (38b221cf4f22b44a10dbd08b38788bc4d817a9dcdb503288348e7a0c64cd1a31)
- bm25: -1.9462 | relevance: 1.0000

useEffect(() => {
    if (!learnerId || learnerId === 'none') return
    if (!accessToken) return
    loadCalendarData({ force: true })
  }, [accessToken, learnerId, loadCalendarData])

// If the current tab has no lessons but the other does, auto-switch tabs.
  // This prevents the overlay from looking "empty" when (for example) only planned lessons exist.
  useEffect(() => {
    if (!learnerId || learnerId === 'none') return
    if (userSelectedTabRef.current) return

### 5. sidekick_pack_calendar.md (c9724a6488ce742416aba0ad09a8db8b7ab8f07ded8511ae49cd7dec9f4bde73)
- bm25: -7.0473 | relevance: 1.0000

let query = adminSupabase
      .from('lesson_schedule')
      .select('*')
      .eq('learner_id', learnerId)
      .order('scheduled_date', { ascending: true })

### 8. src/app/api/planned-lessons/route.js (fae5d8e8b9782672af1af9db6f3d3856e36ac64d40a8a683ceae396338a9a040)
- bm25: -3.7919 | relevance: 1.0000

return NextResponse.json({ plannedLessons })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

### 9. src/app/api/planned-lessons/route.js (492eab0ea579c45b09245ffe7fe8046aba5f174397100e6adca1fe9c36f1e6d8)
- bm25: -3.5123 | entity_overlap_w: 1.00 | adjusted: -3.7623 | relevance: 1.0000

// Insert all the planned lessons
    const rows = []
    for (const [dateStr, lessons] of Object.entries(plannedLessons)) {
      const normalizedDate = normalizeScheduledDate(dateStr)
      for (const lesson of lessons) {
        rows.push({
          facilitator_id: user.id,
          learner_id: learnerId,
          scheduled_date: normalizedDate,
          lesson_data: lesson
        })
      }
    }

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

### 6. sidekick_pack_calendar.md (dfcc40071b5fb2d53102fb19ed027d8a41f883bcdb5edd06002fe638d5f372ea)
- bm25: -6.5927 | entity_overlap_w: 1.50 | adjusted: -6.9677 | relevance: 1.0000

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

### 7. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -6.2972 | entity_overlap_w: 1.50 | adjusted: -6.6722 | relevance: 1.0000

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

### 8. src/app/api/planned-lessons/route.js (13ab95e2c88ec5cc604a496e80fd74f45cb5f1a254133d4b8bd7639cc043e74b)
- bm25: -6.5669 | relevance: 1.0000

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

### 9. sidekick_pack_calendar.md (2a3e86ef656681a0f342082ad621f01e89dfc9483227c5d812966dc60315f5b5)
- bm25: -6.1697 | entity_overlap_w: 1.50 | adjusted: -6.5447 | relevance: 1.0000

### 34. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -2.0760 | relevance: 1.0000

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

### 10. sidekick_pack_calendar.md (0265ef4f1639cb46a8abe3529dd0c20c6f5a521386f8bce166be11efa580ae7a)
- bm25: -6.1819 | relevance: 1.0000

### 15. src/app/api/planned-lessons/route.js (ea768dab2e653da4a9ef74d6f595ab2f466d7eb0babb59320a48f5ff72b9b4a0)
- bm25: -3.3197 | relevance: 1.0000

### 11. sidekick_pack_calendar.md (acf9ce08465f001f4925abe0b71ac34df61a9dc795d33bdd8bbeb9368f36447d)
- bm25: -6.1819 | relevance: 1.0000

### 36. src/app/api/planned-lessons/route.js (669f59ed11e30a0d8781e7c15939a84b6684017e4f4bf05eec7efec4e3226256)
- bm25: -2.0327 | relevance: 1.0000

### 12. sidekick_pack_calendar.md (c66d0eceedc8044113d18d3f20d1fcad9d89003c88db6ca34a5052754108ac85)
- bm25: -6.1819 | relevance: 1.0000

### 6. src/app/api/planned-lessons/route.js (715e20f8c79adf81a24d6bba0df47ad7f44fc6912f0e3f031bde78b0436fec4e)
- bm25: -3.8146 | relevance: 1.0000

### 13. src/app/api/planned-lessons/route.js (db1a9cc005c7ceee5fb09554e6f8802d9c3c6b43eda28afc6d987b8be33f1c49)
- bm25: -6.1458 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

// Delete all planned lessons for this learner
    const { error } = await adminSupabase
      .from('planned_lessons')
      .delete()
      .eq('learner_id', learnerId)
      .eq('facilitator_id', user.id)

if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

### 14. src/app/api/planned-lessons/route.js (715e20f8c79adf81a24d6bba0df47ad7f44fc6912f0e3f031bde78b0436fec4e)
- bm25: -6.1081 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

### 15. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (52e282fa4ffc9866a7f19bd8b94a60ffa2323086d14e0c8dd012970244b8da14)
- bm25: -5.7153 | entity_overlap_w: 1.50 | adjusted: -6.0903 | relevance: 1.0000

devWarn(`planned: start learner=${targetLearnerId} force=${String(force)} hasTokenFallback=${String(Boolean(tokenFallbackRef.current))}`)
    const startedAtMs = Date.now()

const controller = new AbortController()
    plannedAbortRef.current = controller
    plannedInFlightLearnerRef.current = targetLearnerId
    plannedLoadInFlightRef.current = true
    const requestId = ++plannedRequestIdRef.current
    const plannedTimeoutId = setTimeout(() => {
      try { controller.abort() } catch {}
    }, 45000)

try {
      const token = await getBearerToken()

devWarn(`planned: got token ms=${Date.now() - startedAtMs} hasToken=${String(Boolean(token))}`)

if (!token) {
        devWarn('planned: missing auth token')
        return
      }

let response
      try {
        response = await fetch(`/api/planned-lessons?learnerId=${targetLearnerId}`, {
          headers: {
            'authorization': `Bearer ${token}`
          },
          cache: 'no-store',
          signal: controller.signal
        })
      } finally {
        // plannedTimeoutId cleared in finally
      }

devWarn(`planned: response ms=${Date.now() - startedAtMs} status=${String(response?.status)} ok=${String(response?.ok)}`)

if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        devWarn('planned: fetch failed', { status: response.status, body: bodyText })
        return
      }

### 16. sidekick_pack_calendar.md (42a5ca483fdab13cbec407cd2056ffc95a72d678b0ddbe156d4f876acff4288c)
- bm25: -5.7122 | entity_overlap_w: 1.50 | adjusted: -6.0872 | relevance: 1.0000

devWarn(`planned: start learner=${targetLearnerId} force=${String(force)} hasTokenFallback=${String(Boolean(tokenFallbackRef.current))}`)
    const startedAtMs = Date.now()

const controller = new AbortController()
    plannedAbortRef.current = controller
    plannedInFlightLearnerRef.current = targetLearnerId
    plannedLoadInFlightRef.current = true
    const requestId = ++plannedRequestIdRef.current
    const plannedTimeoutId = setTimeout(() => {
      try { controller.abort() } catch {}
    }, 45000)

try {
      const token = await getBearerToken()

devWarn(`planned: got token ms=${Date.now() - startedAtMs} hasToken=${String(Boolean(token))}`)

if (!token) {
        devWarn('planned: missing auth token')
        return
      }

let response
      try {
        response = await fetch(`/api/planned-lessons?learnerId=${targetLearnerId}`, {
          headers: {
            'authorization': `Bearer ${token}`
          },
          cache: 'no-store',
          signal: controller.signal
        })
      } finally {
        // plannedTimeoutId cleared in finally
      }

devWarn(`planned: response ms=${Date.now() - startedAtMs} status=${String(response?.status)} ok=${String(response?.ok)}`)

if (!response.ok) {
        const bodyText = await response.text().catch(() => '')
        devWarn('planned: fetch failed', { status: response.status, body: bodyText })
        return
      }

### 31. src/app/facilitator/calendar/page.js (36f6a926f8e360bba6f24fca8d7b7d8f84d510afd1ea41fbb8571aa71b562ecb)
- bm25: -2.2635 | relevance: 1.0000

if (!deleteResponse.ok) throw new Error('Failed to remove old schedule')

### 17. src/app/api/planned-lessons/route.js (fae5d8e8b9782672af1af9db6f3d3856e36ac64d40a8a683ceae396338a9a040)
- bm25: -6.0718 | relevance: 1.0000

return NextResponse.json({ plannedLessons })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

### 18. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (e6f6e2710584ed3300e0c4e0a1adbdd2d0fa8ec3051689f930f88e1a884dca05)
- bm25: -5.2574 | entity_overlap_w: 3.00 | adjusted: -6.0074 | relevance: 1.0000

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

// Get all scheduled lessons for this learner
      let response
      try {
        // Match the main facilitator calendar page:
        // - Primary fetch (facilitator-scoped + safe legacy null facilitator_id rows)
        // - Secondary includeAll=1 fetch to pick up older/legacy rows that may live under other facilitator namespaces
        const [primaryRes, allRes] = await Promise.all([
          fetch(`/api/lesson-schedule?learnerId=${targetLearnerId}`, {
            headers: {
              'authorization': `Bearer ${token}`
            },
            cache: 'no-store',
            signal: controller.signal
          }),
          fetch(`/api/lesson-schedule?learnerId=${targetLearnerId}&includeAll=1`, {
            headers: {
              'authorization': `Bearer ${token}`
            },
            cache: 'no-store',
            signal: controller.signal
          })
        ])

### 19. src/app/facilitator/calendar/page.js (45a3f960320e40cd0f5d44fbd1557244327369796a5b24116ee137e4fc1a97a6)
- bm25: -5.2523 | entity_overlap_w: 1.50 | adjusted: -5.6273 | relevance: 1.0000

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

### 20. src/app/facilitator/calendar/page.js (7150390142ddd564e9dea3eae18d3c134f9f08597abc11de6462147a72dbfda5)
- bm25: -5.2157 | entity_overlap_w: 1.50 | adjusted: -5.5907 | relevance: 1.0000

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

### 21. sidekick_pack.md (7f9000a46540c3dadf4293569fff9a4b190def0cefc8008ce63df80f8b086658)
- bm25: -4.9558 | entity_overlap_w: 2.00 | adjusted: -5.4558 | relevance: 1.0000

### 24. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (03aa0d86e46a715047afc041dd9cf35450e7bd536f6439c6b421050d5470b680)
- bm25: -1.0539 | relevance: 1.0000

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

### 25. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (6b5b5e7e5b9796e65aca35c95f194eaacf65d6c1a3a604ae4a7dc03284a61b74)
- bm25: -1.0539 | relevance: 1.0000

const force = !!opts?.force
    if (plannedLoadInFlightRef.current) {
      const inFlightLearner = plannedInFlightLearnerRef.current
      if (inFlightLearner && inFlightLearner !== targetLearnerId) {
        abortInFlightLoad(plannedAbortRef, plannedInFlightLearnerRef, 'planned')
      } else {
        devWarn('planned: in-flight, skipping', { inFlightLearner })
        return
      }
    }
    if (!force
      && plannedLoadedForLearnerRef.current === targetLearnerId
      && (Date.now() - (plannedLoadedAtRef.current || 0)) < MIN_REFRESH_INTERVAL_MS
    ) {
      devWarn('planned: throttled, skipping', { targetLearnerId })
      return
    }

### 22. src/app/api/planned-lessons/route.js (492eab0ea579c45b09245ffe7fe8046aba5f174397100e6adca1fe9c36f1e6d8)
- bm25: -5.4556 | relevance: 1.0000

// Insert all the planned lessons
    const rows = []
    for (const [dateStr, lessons] of Object.entries(plannedLessons)) {
      const normalizedDate = normalizeScheduledDate(dateStr)
      for (const lesson of lessons) {
        rows.push({
          facilitator_id: user.id,
          learner_id: learnerId,
          scheduled_date: normalizedDate,
          lesson_data: lesson
        })
      }
    }

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

### 23. sidekick_pack.md (23ccc1c0ab53807bcab25a372eaaf7dfa9358dd0d1ebd5d58435d8932eeca3f9)
- bm25: -4.9237 | entity_overlap_w: 2.00 | adjusted: -5.4237 | relevance: 1.0000

### 37. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a6a5f703bef748c4d747d394cc6cbe45b727739626d59197af352fbca88834f3)
- bm25: -0.8782 | relevance: 1.0000

contextText += '\n\n=== REDO RULES: SAME AS PLANNER GENERATION ==='
      contextText += '\nYou are regenerating a planned lesson outline.'
      contextText += `\nPrefer NEW topics most of the time, but you MAY plan a rephrased Review for low scores (<= ${LOW_SCORE_REVIEW_THRESHOLD}%).`
      contextText += `\nAvoid repeating high-score topics (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%) unless the facilitator explicitly requests it.`
      contextText += "\nIf you choose a Review lesson, the title MUST start with 'Review:' and it must use different examples."
      contextText += '\nDo NOT produce an exact duplicate of any scheduled/planned lesson above.'

### 38. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (b690a18afe1a98c7ffdb598a8ad305d257461e7db5099a5e51bade73b4b5f2b9)
- bm25: -0.8782 | relevance: 1.0000

const todayStr = getLocalTodayStr()

// Fast-path: render scheduled lessons immediately.
      // Completion history lookup can be slow; it should not block schedule visibility.
      try {
        const immediate = {}
        for (const item of (data || [])) {
          const dateStr = normalizeDateKey(item?.scheduled_date)
          const lessonKey = item?.lesson_key
          if (!dateStr || !lessonKey) continue

### 24. src/app/facilitator/calendar/page.js (4835d0d6e747efbb6e84edf7a10a2bc8a9f755d7b63ab15c2f5dd9ecb27821a9)
- bm25: -5.0098 | entity_overlap_w: 1.50 | adjusted: -5.3848 | relevance: 1.0000

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

### 25. sidekick_pack_calendar.md (b24065620cf68f8b0af1560ce925a5741112ee97a7d701cadbebbba6af03eb8f)
- bm25: -5.1193 | entity_overlap_w: 1.00 | adjusted: -5.3693 | relevance: 1.0000

const shouldApplyToState = () => activeLearnerIdRef.current === targetLearnerId

### 5. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (1318af73d2a40e715a4831f4e89125d0289ba34962bf8c994c55428a0c15bcef)
- bm25: -4.0116 | relevance: 1.0000

<div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowPlannerOverlay(true)}
                    disabled={!learnerId || learnerId === 'none'}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: (!learnerId || learnerId === 'none') ? '#f3f4f6' : '#111827',
                      color: (!learnerId || learnerId === 'none') ? '#9ca3af' : '#fff',
                      cursor: (!learnerId || learnerId === 'none') ? 'not-allowed' : 'pointer'
                    }}
                    title={(!learnerId || learnerId === 'none') ? 'Select a learner first' : 'Open the full Lesson Planner'}
                  >
                    Create a Lesson Plan
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                  {(!learnerId || learnerId === 'none')
                    ? 'Select a learner to view planned lessons'
                    : (selectedDate ? 'No planned lessons' : 'Select a date to view planned lessons')}
                </div>

### 26. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a76e50eff48663fb478af13164670296a2b51753ccbd35ab0e5bfebf1e5c23cd)
- bm25: -5.3279 | relevance: 1.0000

<div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowPlannerOverlay(true)}
                    disabled={!learnerId || learnerId === 'none'}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: (!learnerId || learnerId === 'none') ? '#f3f4f6' : '#111827',
                      color: (!learnerId || learnerId === 'none') ? '#9ca3af' : '#fff',
                      cursor: (!learnerId || learnerId === 'none') ? 'not-allowed' : 'pointer'
                    }}
                    title={(!learnerId || learnerId === 'none') ? 'Select a learner first' : 'Open the full Lesson Planner'}
                  >
                    Create a Lesson Plan
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                  {(!learnerId || learnerId === 'none')
                    ? 'Select a learner to view planned lessons'
                    : (selectedDate ? 'No planned lessons' : 'Select a date to view planned lessons')}
                </div>

### 27. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (29145b573f2d928cf30dc944bf3afed6df5b8a615618b1bc9c9a883bb3453d67)
- bm25: -4.5720 | entity_overlap_w: 3.00 | adjusted: -5.3220 | relevance: 1.0000

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

### 28. src/app/api/planned-lessons/route.js (ea768dab2e653da4a9ef74d6f595ab2f466d7eb0babb59320a48f5ff72b9b4a0)
- bm25: -5.3150 | relevance: 1.0000

// Verify the learner belongs to this facilitator/owner
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 29. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (45ad3153982e21c4597a82d790e1dc8b4df1c281341a7a4840ed77990d34beff)
- bm25: -4.5437 | entity_overlap_w: 3.00 | adjusted: -5.2937 | relevance: 1.0000

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

### 30. sidekick_pack_calendar.md (c324c00b681b965a2b248ede7252f52a77825f3d968f86839451a88912fa8dcc)
- bm25: -4.8700 | entity_overlap_w: 1.50 | adjusted: -5.2450 | relevance: 1.0000

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

### 22. src/app/facilitator/calendar/page.js (72f70893c01946442b9eded07b75bb6144d62ca4c9aa3ec475af49117056e8d3)
- bm25: -2.8434 | entity_overlap_w: 1.00 | adjusted: -3.0934 | relevance: 1.0000

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

### 31. src/app/api/planned-lessons/route.js (8aaaa19d2aaecc8e08fd50104f8049a1e24cfcdc3bbf0e3a0e442df362ff8547)
- bm25: -5.2035 | relevance: 1.0000

// Fetch planned lessons for this learner.
    // Primary: scoped to this facilitator.
    // Fallback: if there are legacy rows under a single different facilitator_id, return them (read compatibility).
    let data = null
    let error = null

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
      const dateStr = normalizeScheduledDate(row.scheduled_date)
      if (!plannedLessons[dateStr]) {
        plannedLessons[dateStr] = []
      }
      plannedLessons[dateStr].push(row.lesson_data)
    }

### 32. sidekick_pack_calendar.md (8433d094a6742c2a6805901913b61d0bfbfbc49e078e5ba8657783f75d33e24f)
- bm25: -5.0205 | relevance: 1.0000

// Verify the learner belongs to this facilitator/owner.
    // Planned lessons are treated as per-learner data (not per-facilitator), but still require authorization.
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 17. src/app/api/lesson-schedule/route.js (ff3ad28ef7a262ca477170ea0d60d5d1724049c3c3c5d136f9f3e4532a21cf91)
- bm25: -3.2672 | relevance: 1.0000

// Verify the learner belongs to this facilitator
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 18. src/app/facilitator/calendar/page.js (4835d0d6e747efbb6e84edf7a10a2bc8a9f755d7b63ab15c2f5dd9ecb27821a9)
- bm25: -3.1783 | relevance: 1.0000

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

### 33. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (d639b071230e9ed65fd771bbe6b7820ca2615d4a1f72283584fb2cd6d8b20640)
- bm25: -4.9818 | relevance: 1.0000

const response = await fetch('/api/facilitator/lessons/update', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ file, lesson: updatedLesson })
      })

### 34. src/app/api/planned-lessons/route.js (42127223aa1a5eb61a4fad6c882c523914f98e95c7e9e7d6b8000420836b7753)
- bm25: -4.9714 | relevance: 1.0000

// API endpoint for planned lessons management
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const normalizeScheduledDate = (value) => {
  if (!value) return value
  const str = String(value)
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : str
}

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

### 35. sidekick_pack_calendar.md (f3f7b14a499f1f3a989cdd52880f4a862e223e5a88ef1ef84f87ed21c65c5f64)
- bm25: -4.8777 | relevance: 1.0000

if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

### 3. src/app/api/planned-lessons/route.js (8aaaa19d2aaecc8e08fd50104f8049a1e24cfcdc3bbf0e3a0e442df362ff8547)
- bm25: -3.7727 | entity_overlap_w: 2.00 | adjusted: -4.2727 | relevance: 1.0000

// Fetch planned lessons for this learner.
    // Primary: scoped to this facilitator.
    // Fallback: if there are legacy rows under a single different facilitator_id, return them (read compatibility).
    let data = null
    let error = null

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

### 36. sidekick_pack_calendar.md (98a85c497f00dd381ad23e7344a4446072b3c40434b372209b164669449cc680)
- bm25: -4.0288 | entity_overlap_w: 3.00 | adjusted: -4.7788 | relevance: 1.0000

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

### 37. src/app/facilitator/calendar/page.js (c2521be237a199cb7f605cd99dfb540049509998146be81842fe1b7cce9cc3de)
- bm25: -4.0151 | entity_overlap_w: 3.00 | adjusted: -4.7651 | relevance: 1.0000

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

### 38. sidekick_pack_calendar.md (766ac45d3becb9c14bfb831c0701eaa6d3578fd459f96e0578e6578fc0f736ae)
- bm25: -3.9924 | entity_overlap_w: 3.00 | adjusted: -4.7424 | relevance: 1.0000

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

### 39. sidekick_pack_calendar.md (b9dc078a93d41db44527a41092413104e7cbd0203a87c119851dce73c1008662)
- bm25: -4.7312 | relevance: 1.0000

{/* Planned Lessons Info */}
      {Object.keys(plannedLessons).length > 0 && (
        <div style={{
          background: '#eff6ff',
          borderRadius: 8,
          border: '1px solid #93c5fd',
          padding: 12
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af' }}>
            ✓ Lesson plan generated! Click on dates in the calendar to see planned lessons.
          </div>
        </div>
      )}

### 40. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (db05d8c56a11272789cf6fb81a17a6ab1b6c87a3cfe7d92671d7557644b178d3)
- bm25: -4.7248 | relevance: 1.0000

const okFull = !!(historyRes && historyRes.ok)
          if (!okFull) {
            try {
              const smallerFrom = addDaysToDateStr(todayStr, -180) || historyFrom
              historyAttempt = 'recent'
              devWarn(`schedule: history retry attempt=${historyAttempt} from=${smallerFrom} to=${todayStr}`)
              ;({ res: historyRes, json: historyJson } = await fetchHistoryJson(
                `/api/learner/lesson-history?learner_id=${targetLearnerId}&from=${encodeURIComponent(smallerFrom)}&to=${encodeURIComponent(todayStr)}`
              ))
            } catch (err) {
              if (String(err?.name || '') === 'AbortError') throw err
            }
          }

const okRecent = !!(historyRes && historyRes.ok)
          if (!okRecent) {
            try {
              // Last resort: unwindowed fetch is bounded by the API (fast) and often enough to catch recent 2026 activity.
              historyAttempt = 'bounded'
              devWarn(`schedule: history retry attempt=${historyAttempt} (no window)`)
              ;({ res: historyRes, json: historyJson } = await fetchHistoryJson(
                `/api/learner/lesson-history?learner_id=${targetLearnerId}`
              ))
            } catch (err) {
              if (String(err?.name || '') === 'AbortError') throw err
            }
          }
        
          devWarn(
            `schedule: history response ms=${Date.now() - startedAtMs} attempt=${historyAttempt} ` +
            `status=${String(historyRes?.status)} ok=${String(historyRes?.ok)}`
          )
          clearTimeout(historyTimeoutId)
