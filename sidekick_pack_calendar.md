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

// Transform to the format expected by the calendar: { 'YYYY-MM-DD': [{...}] }
    const plannedLessons = {}
    for (const row of data || []) {
      const dateStr = normalizeScheduledDate(row.scheduled_date)
      if (!plannedLessons[dateStr]) {
        plannedLessons[dateStr] = []
      }
      plannedLessons[dateStr].push(row.lesson_data)
    }

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

const loadPlannedForLearner = useCallback(async (targetLearnerId, opts = {}) => {
    if (!targetLearnerId || targetLearnerId === 'none') {
      devWarn('planned: no learner selected', { targetLearnerId })
      setPlannedLessons({})
      plannedLoadedForLearnerRef.current = null
      plannedLoadedAtRef.current = 0
      return
    }

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

### 6. src/app/api/planned-lessons/route.js (715e20f8c79adf81a24d6bba0df47ad7f44fc6912f0e3f031bde78b0436fec4e)
- bm25: -3.8146 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

### 7. src/app/api/lesson-schedule/route.js (a4a66f7a325a73d6a8b19846f515a5433ea46cb37ffe423379030e0dd63353c6)
- bm25: -3.2999 | entity_overlap_w: 2.00 | adjusted: -3.7999 | relevance: 1.0000

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

### 10. src/app/api/lesson-schedule/route.js (a4e59f2557fb96163a81ecde110bf38555467886078c6fd9e9626e2651e23b6e)
- bm25: -3.6057 | relevance: 1.0000

const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

### 11. src/app/api/lesson-schedule/route.js (40b3670d3748df84e2e205008ae62a46d3104decc4304c5ec39b66ddfae302b5)
- bm25: -3.3004 | entity_overlap_w: 1.00 | adjusted: -3.5504 | relevance: 1.0000

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

### 12. src/app/facilitator/calendar/page.js (32b45bffac4f45d7f500daedea9cb9671ada21f4a95c4a86320e30fb74253337)
- bm25: -3.5048 | relevance: 1.0000

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

### 13. src/app/facilitator/calendar/LessonPlanner.jsx (25995026c679706cc4664bad8fa9d83f36a2ea4d46f0cceb4221a8654af8eb71)
- bm25: -3.4342 | relevance: 1.0000

{customSubjects.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {customSubjects.map(subject => (
              <div
                key={subject.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: '#f3f4f6',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#374151'
                }}
              >
                {subject.name}
                <button
                  onClick={() => handleDeleteCustomSubject(subject.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: 0,
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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

### 14. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (c58a15e88b8c79c19c619b0820f6b7356c3dabc582e43e5610b6c6874d62685b)
- bm25: -2.8498 | entity_overlap_w: 2.00 | adjusted: -3.3498 | relevance: 1.0000

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

// Synthesize "history-only" completed lessons for dates that don't exist in lesson_schedule.
      // This is how we surface 2026 activity even if lesson_schedule payload stops at 2025.
      try {
        const existingByDate = new Map()
        for (const [d, arr] of Object.entries(grouped || {})) {
          const set = new Set()
          ;(Array.isArray(arr) ? arr : []).forEach((l) => {
            const ck = canonicalLessonId(l?.lesson_key)
            if (ck) set.add(ck)
          })
          existingByDate.set(d, set)
        }

let synthesizedDates = 0
        for (const [d, list] of (completedEventsByDate || new Map()).entries()) {
          const dateKey = normalizeDateKey(d)
          if (!dateKey) continue
          const existingSet = existingByDate.get(dateKey) || new Set()
          const items = Array.isArray(list) ? list : []

const synthesized = []
          for (const it of items) {
            const rawKey = String(it?.lesson_key || '')
            if (!rawKey) continue
            const ck = canonicalLessonId(rawKey)
            if (ck && existingSet.has(ck)) continue

### 15. src/app/api/planned-lessons/route.js (ea768dab2e653da4a9ef74d6f595ab2f466d7eb0babb59320a48f5ff72b9b4a0)
- bm25: -3.3197 | relevance: 1.0000

// Verify the learner belongs to this facilitator/owner
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 16. src/app/api/planned-lessons/route.js (42127223aa1a5eb61a4fad6c882c523914f98e95c7e9e7d6b8000420836b7753)
- bm25: -3.3066 | relevance: 1.0000

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

### 19. src/app/api/lesson-schedule/route.js (a83063ae5d85edeb01513175e78de0ebdeac54f8a0fc02607cf3b638f24cc566)
- bm25: -2.9027 | entity_overlap_w: 1.00 | adjusted: -3.1527 | relevance: 1.0000

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

### 20. src/app/api/lesson-schedule/route.js (4e331f192a6c56a4cab8c5f7afbe0982981f3bd236880d62edeea56744dbb7e2)
- bm25: -3.1363 | relevance: 1.0000

// Default behavior: prefer facilitator-scoped schedule rows, plus safe legacy rows where facilitator_id is null.
    // Overlay/debug callers can pass includeAll=1 to retrieve all schedule rows for an owned learner.
    if (!includeAll) {
      query = query.or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
    }

### 21. src/app/facilitator/calendar/page.js (7150390142ddd564e9dea3eae18d3c134f9f08597abc11de6462147a72dbfda5)
- bm25: -3.1164 | relevance: 1.0000

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

### 23. src/app/facilitator/calendar/page.js (45a3f960320e40cd0f5d44fbd1557244327369796a5b24116ee137e4fc1a97a6)
- bm25: -3.0747 | relevance: 1.0000

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

### 24. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (9b59b9f278b773731679b2a0383422121f13df552fe5ed2b188d604c96944549)
- bm25: -3.0144 | relevance: 1.0000

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

### 25. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (0f7f87b4918d5297956d0c030740ba0ca8967765f09f399e2c8feddc84f645c1)
- bm25: -2.9786 | relevance: 1.0000

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

### 26. src/app/facilitator/calendar/page.js (c2521be237a199cb7f605cd99dfb540049509998146be81842fe1b7cce9cc3de)
- bm25: -2.9436 | relevance: 1.0000

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

### 27. src/app/api/lesson-schedule/route.js (b89acc0fde5033863fadb63ea3f2943978cd555f4c47181c1e5d95945acef434)
- bm25: -2.8760 | relevance: 1.0000

// API endpoint for lesson schedule management
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const normalizeScheduledDate = (value) => {
  if (!value) return value
  const str = String(value)

// Handles:
  // - YYYY-MM-DD
  // - YYYY-M-D
  // - YYYY-MM-DDTHH:mm:ss...
  // - YYYY-M-D HH:mm:ss...
  const match = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (match) {
    const yyyy = match[1]
    const mm = String(match[2]).padStart(2, '0')
    const dd = String(match[3]).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

return str
}

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

### 28. src/app/api/lesson-schedule/route.js (4e9a18239af15ff105fe40d106e9f7344be874ac858258992abe3bd7cc9ddb7b)
- bm25: -2.7998 | relevance: 1.0000

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

### 29. src/app/facilitator/calendar/LessonPlanner.jsx (9304f9697a56abc0792ac130be58f504e565f9ce5e89cac035cad64c213eb58b)
- bm25: -2.3119 | relevance: 1.0000

if (response.ok) {
                const result = await response.json()
                const outline = result.outline

if (!lessons[dateStr]) {
                  lessons[dateStr] = []
                }

lessons[dateStr].push({
                  ...outline,
                  id: `${dateStr}-${subjectInfo.subject}`,
                  subject: subjectInfo.subject
                })

generatedSoFar.push({
                  date: dateStr,
                  subject: subjectInfo.subject,
                  title: outline?.title || ''
                })
              }
            } catch (err) {
              console.error('Error generating outline:', err)
            }
          }
        }
      }

if (onPlannedLessonsChange) {
        onPlannedLessonsChange(lessons)
      }
    } catch (err) {
      console.error('Error generating planned lessons:', err)
      alert('Failed to generate lesson plan')
    } finally {
      setGenerating(false)
    }
  }

useEffect(() => {
    if (!autoGeneratePlan) return
    if (!learnerId) return
    if (!planStartDate) return
    if (!weeklyPatternLoadedRef.current) return
    if (generating) return

const key = `${learnerId}|${planStartDate}|${planDuration}`
    if (autoGenerateKeyRef.current === key) return

const hasAnySubjects = DAYS.some(day => weeklyPattern[day]?.length > 0)
    if (!hasAnySubjects) return

autoGenerateKeyRef.current = key
    const weeksToGenerate = Number(planDuration) * 4
    generatePlannedLessons(planStartDate, weeksToGenerate)
  }, [autoGeneratePlan, learnerId, planStartDate, planDuration, weeklyPattern, generating])

### 30. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (7f09831630f83a9e9eac7bb26231498a5276ed83722f11169743d3d31488bcfa)
- bm25: -2.2709 | relevance: 1.0000

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

### 32. src/app/facilitator/calendar/page.js (4f93e9cc0018c9b6e27aad45f0db5ed725a2d8b9081a5d3956bf19db6ce6f906)
- bm25: -2.0094 | entity_overlap_w: 1.00 | adjusted: -2.2594 | relevance: 1.0000

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

### 33. src/app/facilitator/calendar/LessonPlanner.jsx (fd591deb67440b85e69d10a8c0629a0abe24abd9a3d4d3f92016c00b9d8bf080)
- bm25: -2.1781 | relevance: 1.0000

const allSubjects = [...CORE_SUBJECTS, ...customSubjects.map(s => s.name)]

return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Title and Workflow Guide */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>
          Create a Lesson Plan
        </h2>
        <WorkflowGuide
          workflowKey="lesson-planner-workflow"
          title="How Automated Lesson Planning Works"
          steps={[
            { 
              step: 'Set your weekly pattern', 
              description: 'Check which subjects you want to teach on each day of the week below' 
            },
            { 
              step: 'Choose start date and duration', 
              description: 'Select when to begin and how many weeks/months to plan' 
            },
            { 
              step: 'Generate lesson plan', 
              description: 'We create lesson outlines based on your learner\'s history and grade level' 
            },
            { 
              step: 'Review and generate full lessons', 
              description: 'Click dates in the calendar to see planned lessons. Generate full lesson content for any outline you like' 
            }
          ]}
        />
      </div>

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

lessonContext = [...completed, ...incomplete]
      }

### 35. src/app/facilitator/calendar/LessonPlanner.jsx (bbc18a96e8e74f641a8270bf1cf9fd128312a7fadd6f6f9216546afe6ad539e8)
- bm25: -2.0723 | relevance: 1.0000

// Add planned lessons from current plan
      Object.entries(plannedLessons || {}).forEach(([date, dayLessons]) => {
        dayLessons.forEach(lesson => {
          lessonContext.push({
            name: lesson.title || lesson.id,
            date,
            status: 'planned'
          })
        })
      })

// Sort chronologically
      lessonContext.sort((a, b) => new Date(a.date) - new Date(b.date))

// Get curriculum preferences
      if (preferencesRes.ok) {
        curriculumPrefs = await preferencesRes.json()
      }

// Build context string for GPT
      let contextText = ''
      if (lessonContext.length > 0) {
        contextText += '\n\nLearner Lesson History (chronological):\n'
        lessonContext.forEach(l => {
          if (l.status === 'completed' && l.score !== null) {
            contextText += `- ${l.name} (${l.status}, score: ${l.score}%)\n`
          } else {
            contextText += `- ${l.name} (${l.status})\n`
          }
        })
      }

// Review policy thresholds (tuned for "repeat low scores, skip high scores")
        const LOW_SCORE_REVIEW_THRESHOLD = 70
        const HIGH_SCORE_AVOID_REPEAT_THRESHOLD = 85

const lowScoreCompleted = lessonContext
          .filter((l) => l.status === 'completed' && l.score !== null && l.score <= LOW_SCORE_REVIEW_THRESHOLD)
          .slice(-20)

const highScoreCompleted = lessonContext
          .filter((l) => l.status === 'completed' && l.score !== null && l.score >= HIGH_SCORE_AVOID_REPEAT_THRESHOLD)
          .slice(-30)

### 36. src/app/api/planned-lessons/route.js (669f59ed11e30a0d8781e7c15939a84b6684017e4f4bf05eec7efec4e3226256)
- bm25: -2.0327 | relevance: 1.0000

export async function POST(request) {
  try {
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

// Get all dates in the new plan (normalized to YYYY-MM-DD)
    const newPlanDates = Object.keys(plannedLessons).map(normalizeScheduledDate)

### 37. src/app/api/lesson-schedule/route.js (e5d59959952764987c24e5d36f60b5336910533bc09e256bbf420f016490f3c6)
- bm25: -1.9966 | relevance: 1.0000

if (startDate && endDate) {
      query = query.gte('scheduled_date', startDate).lte('scheduled_date', endDate)
    }

const { data, error } = await query

if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

const schedule = (data || []).map(item => ({
      ...item,
      scheduled_date: normalizeScheduledDate(item.scheduled_date),
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

### 38. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (9cded2e19c2fec8bbbc5e98f2ffcf33c7f51a88f525eb22b77eeb23b76f11a71)
- bm25: -1.9839 | relevance: 1.0000

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

const todayStr = getLocalTodayStr()
    const scheduledDates = Object.keys(scheduledLessons || {}).filter((d) => (scheduledLessons?.[d]?.length || 0) > 0)
    const plannedDates = Object.keys(plannedLessons || {}).filter((d) => (plannedLessons?.[d]?.length || 0) > 0)

const scheduledUpcoming = scheduledDates.filter((d) => d >= todayStr)
    const plannedUpcoming = plannedDates.filter((d) => d >= todayStr)

// Prefer showing the tab that has UPCOMING lessons. A single old completed scheduled item
    // shouldn't prevent the overlay from auto-switching to a planned week in the future.
    if (listTab === 'scheduled' && scheduledUpcoming.length === 0 && plannedUpcoming.length > 0) {
      setListTab('planned')
    } else if (listTab === 'planned' && plannedUpcoming.length === 0 && scheduledUpcoming.length > 0) {
      setListTab('scheduled')
    } else if (listTab === 'scheduled' && scheduledDates.length === 0 && plannedDates.length > 0) {
      setListTab('planned')
    } else if (listTab === 'planned' && plannedDates.length === 0 && scheduledDates.length > 0) {
      setListTab('scheduled')
    }
  }, [learnerId, listTab, scheduledLessons, plannedLessons])
