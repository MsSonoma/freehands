# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Add includeAll=1 to GET /api/planned-lessons (authorized learner) and update CalendarOverlay to fetch planned lessons with includeAll=1 and merge results without overwriting non-empty cache with empty payloads.
```

Filter terms used:
```text
/api/planned-lessons
GET
CalendarOverlay
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/planned-lessons GET CalendarOverlay

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_planned_all.md (b6c5acc516c7d5288cd0923e63578ce9526d930ff4bc4955a5ec6a35dfc19f5a)
- bm25: -6.9139 | entity_overlap_w: 2.30 | adjusted: -7.4889 | relevance: 1.0000

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

### 2. sidekick_pack_planned_all.md (6674f39b1a48416b009443ca2cf88e758108c2e528bc2acccb1cd9fa3f4d0107)
- bm25: -4.9713 | entity_overlap_w: 7.50 | adjusted: -6.8463 | relevance: 1.0000

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

### 3. sidekick_pack_planned_all.md (39f3510b1ceb8c2919ae1bacccf9ee18331d403e12030c6952a1d5dc46408cc2)
- bm25: -5.6201 | entity_overlap_w: 1.50 | adjusted: -5.9951 | relevance: 1.0000

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

### 4. src/app/api/planned-lessons/route.js (42127223aa1a5eb61a4fad6c882c523914f98e95c7e9e7d6b8000420836b7753)
- bm25: -5.5100 | entity_overlap_w: 1.30 | adjusted: -5.8350 | relevance: 1.0000

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

### 5. sidekick_pack_calendar.md (c9724a6488ce742416aba0ad09a8db8b7ab8f07ded8511ae49cd7dec9f4bde73)
- bm25: -5.6845 | relevance: 1.0000

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

### 6. sidekick_pack_calendar.md (3fb65e640cb1ee413c932022c5ef134a374d288490dd0ff49a1fe9a0d27c60da)
- bm25: -5.2607 | entity_overlap_w: 1.30 | adjusted: -5.5857 | relevance: 1.0000

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

### 7. sidekick_pack_planned_all.md (222f12cf61f748251a3c55b61f04a417bbf6d36b0a671960c3bb15c0e3ce026d)
- bm25: -5.1503 | entity_overlap_w: 1.50 | adjusted: -5.5253 | relevance: 1.0000

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

### 8. src/app/api/planned-lessons/route.js (492eab0ea579c45b09245ffe7fe8046aba5f174397100e6adca1fe9c36f1e6d8)
- bm25: -5.3976 | relevance: 1.0000

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

### 9. sidekick_pack_calendar.md (678a099578ce7dfb438cb5f5fdf33a5ee0a1659724364fe1bd4e3d78e5de8141)
- bm25: -4.3868 | entity_overlap_w: 4.00 | adjusted: -5.3868 | relevance: 1.0000

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

### 10. src/app/api/lesson-schedule/route.js (b89acc0fde5033863fadb63ea3f2943978cd555f4c47181c1e5d95945acef434)
- bm25: -5.0500 | entity_overlap_w: 1.30 | adjusted: -5.3750 | relevance: 1.0000

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

### 11. sidekick_pack_planned_all.md (0d7f194b83ef5bdc5e78a390cba7723066ef7cf64d03931e27377d8eb2f980e5)
- bm25: -4.3666 | entity_overlap_w: 4.00 | adjusted: -5.3666 | relevance: 1.0000

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

### 12. sidekick_pack_calendar.md (132361974aedaf3b3f7a3f3e8fea1d6a937d1b672541bd5b645de3302307cbf3)
- bm25: -4.9692 | entity_overlap_w: 1.30 | adjusted: -5.2942 | relevance: 1.0000

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

### 13. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (9f29236ecc74aa48ec884981627a104c1498126b3b9e9493d8af7ef3de53abad)
- bm25: -4.3298 | entity_overlap_w: 3.00 | adjusted: -5.0798 | relevance: 1.0000

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

### 14. sidekick_pack_planned_all.md (f68a0251f9ab67ce11f7b25b5827df78d806ab6f217c4519fb652c1f1d61c955)
- bm25: -4.8911 | relevance: 1.0000

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

### 15. sidekick_pack_planned_all.md (ccfc16941934d1c73cb9b713bc34b9edbbc5377b8a728c9ebde39fbc6cd06222)
- bm25: -4.7739 | relevance: 1.0000

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

### 16. sidekick_pack_calendar.md (e4850ca724432dcd515d17e688953f4328c7d15cbaa7795617e091d25879d8e8)
- bm25: -4.5044 | entity_overlap_w: 1.00 | adjusted: -4.7544 | relevance: 1.0000

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

### 17. sidekick_pack_planned_all.md (d32ec42280065bf36096853714387cbf112aaf8b2e2e135ab2e0095a3bcb82f9)
- bm25: -4.0115 | entity_overlap_w: 2.50 | adjusted: -4.6365 | relevance: 1.0000

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

### 18. src/app/api/lesson-schedule/route.js (a4a66f7a325a73d6a8b19846f515a5433ea46cb37ffe423379030e0dd63353c6)
- bm25: -4.2552 | entity_overlap_w: 1.30 | adjusted: -4.5802 | relevance: 1.0000

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

### 19. sidekick_pack_planned_all.md (7e6f9e099ed0bba77cc78887bd83ba39f37066930a72a67bd840f9de1f9e3b5a)
- bm25: -4.5781 | relevance: 1.0000

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

### 20. sidekick_pack_calendar.md (77e98038566ccd4e39dcfd3877c56142ece89b144f9a0a270ec9dde83578367e)
- bm25: -4.2235 | entity_overlap_w: 1.30 | adjusted: -4.5485 | relevance: 1.0000

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

### 21. sidekick_pack_calendar.md (daec363789d11d6f4fd8250b18eeb4bd64a6be6f6507df08d3872e18ee5521f8)
- bm25: -4.4398 | relevance: 1.0000

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

### 22. sidekick_pack_planned_all.md (5acb38228042b70ca3ad3485aaa5e7beeb19bce38edd39d3fe4800585e78493e)
- bm25: -3.7199 | entity_overlap_w: 2.50 | adjusted: -4.3449 | relevance: 1.0000

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

### 23. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -4.3412 | relevance: 1.0000

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

### 24. sidekick_pack_planned_all.md (2f3bbd7006e39ccf8561aca154fbff6356c161aff0b80f876ec1fdde2b7ae452)
- bm25: -3.6674 | entity_overlap_w: 2.50 | adjusted: -4.2924 | relevance: 1.0000

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

### 25. src/app/api/planned-lessons/route.js (669f59ed11e30a0d8781e7c15939a84b6684017e4f4bf05eec7efec4e3226256)
- bm25: -4.2465 | relevance: 1.0000

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

### 26. sidekick_pack_calendar.md (2a3e86ef656681a0f342082ad621f01e89dfc9483227c5d812966dc60315f5b5)
- bm25: -4.2362 | relevance: 1.0000

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

### 27. sidekick_pack_calendar.md (dfcc40071b5fb2d53102fb19ed027d8a41f883bcdb5edd06002fe638d5f372ea)
- bm25: -3.7734 | entity_overlap_w: 1.50 | adjusted: -4.1484 | relevance: 1.0000

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

### 28. sidekick_pack_planned_all.md (15fb0f43838f19cafa56c75ddfaf84d4379649e6197e0bf821cf807dfed35892)
- bm25: -3.8851 | entity_overlap_w: 1.00 | adjusted: -4.1351 | relevance: 1.0000

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

### 29. sidekick_pack_planned_all.md (20b1ecbe2d8aede35d69d0fc7b8c69ee6d260fe72a83f9545a6e4831fa3d8f80)
- bm25: -4.0115 | relevance: 1.0000

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

### 30. src/app/api/learner/lesson-history/route.js (9fa11bb439cfe3914be24723e9e7d44533aad95e4f86c10cb388b536d5f666c9)
- bm25: -3.6758 | entity_overlap_w: 1.30 | adjusted: -4.0008 | relevance: 1.0000

if (Array.isArray(sessions)) {
    for (const session of sessions) {
      const lessonId = session?.lesson_id
      if (!lessonId) continue
      if (!session?.ended_at && session?.started_at) {
        const existing = inProgress[lessonId]
        if (!existing || new Date(session.started_at) > new Date(existing)) {
          inProgress[lessonId] = session.started_at
        }
      }
    }
  }

return { lastCompleted, inProgress }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learner_id')
    if (!learnerId) {
      return NextResponse.json({ error: 'learner_id required' }, { status: 400 })
    }

const supabase = await getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

const limit = parseLimit(searchParams.get('limit'))

const from = searchParams.get('from')
    const to = searchParams.get('to')
    const fromDate = isYyyyMmDd(from) ? from : null
    const toDate = isYyyyMmDd(to) ? to : null
    const fromIso = fromDate ? `${fromDate}T00:00:00.000Z` : null
    // Use an exclusive upper bound so callers can pass local YYYY-MM-DD safely.
    const toExclusiveDate = toDate ? addDays(toDate, 1) : null
    const toExclusiveIso = toExclusiveDate ? `${toExclusiveDate}T00:00:00.000Z` : null

let sessionsQuery = supabase
      .from('lesson_sessions')
      .select('id, learner_id, lesson_id, started_at, ended_at')
      .eq('learner_id', learnerId)

if (fromIso) {
      sessionsQuery = sessionsQuery.gte('started_at', fromIso)
    }
    if (toExclusiveIso) {
      sessionsQuery = sessionsQuery.lt('started_at', toExclusiveIso)
    }

### 31. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (52e282fa4ffc9866a7f19bd8b94a60ffa2323086d14e0c8dd012970244b8da14)
- bm25: -3.5095 | entity_overlap_w: 1.50 | adjusted: -3.8845 | relevance: 1.0000

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

### 32. sidekick_pack_planned_all.md (79af748cc863cfa32eda062671f812e41cf02adf095a46eb36bd42871ec402a0)
- bm25: -3.8378 | relevance: 1.0000

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

### 33. src/app/api/lesson-schedule/route.js (a83063ae5d85edeb01513175e78de0ebdeac54f8a0fc02607cf3b638f24cc566)
- bm25: -3.8365 | relevance: 1.0000

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

### 34. src/app/api/planned-lessons/route.js (13ab95e2c88ec5cc604a496e80fd74f45cb5f1a254133d4b8bd7639cc043e74b)
- bm25: -3.7649 | relevance: 1.0000

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

### 35. sidekick_pack_planned_all.md (9622963c37aaa5711ff45aabe744c1f2a16602e01f2531b632b91ea6354046d7)
- bm25: -3.4771 | entity_overlap_w: 1.00 | adjusted: -3.7271 | relevance: 1.0000

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

### 36. sidekick_pack_planned_all.md (16041ca7de300de595905f2fec46f55328e4f031e3c5f8b67bf25594ee15e753)
- bm25: -3.6668 | relevance: 1.0000

### 15. src/app/api/planned-lessons/route.js (ea768dab2e653da4a9ef74d6f595ab2f466d7eb0babb59320a48f5ff72b9b4a0)
- bm25: -3.3197 | relevance: 1.0000

### 37. sidekick_pack_planned_all.md (95e979cc2384fa902319f2c63dca591f8c4a428e5964450cf20e47d370844327)
- bm25: -3.6668 | relevance: 1.0000

### 22. src/app/api/planned-lessons/route.js (492eab0ea579c45b09245ffe7fe8046aba5f174397100e6adca1fe9c36f1e6d8)
- bm25: -5.4556 | relevance: 1.0000

### 38. sidekick_pack_planned_all.md (e3cfc4b1f41d25afb42ed51a8a29a2779f3ff34d2b3d2496cf6c647100e2793a)
- bm25: -3.6668 | relevance: 1.0000

### 28. src/app/api/planned-lessons/route.js (ea768dab2e653da4a9ef74d6f595ab2f466d7eb0babb59320a48f5ff72b9b4a0)
- bm25: -5.3150 | relevance: 1.0000

### 39. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (1fa09c91ba97280b70cdecf8e118deca279f6b0b18196775c8928934efb6eb13)
- bm25: -3.6540 | relevance: 1.0000

try {
                const normalizedKey = normalizeLessonKey(String(row?.lesson_id || '')) || String(row?.lesson_id || '')
                const list = completedEventsByDate.get(completedDate) || []
                list.push({ lesson_key: normalizedKey || String(row?.lesson_id || ''), completed: true })
                completedEventsByDate.set(completedDate, list)
              } catch {}
            }

// Some learners may not have explicit "completed" events, but will have completed sessions.
            for (const session of sessions) {
              const endedAt = session?.ended_at || null
              const startedAt = session?.started_at || null
              const status = session?.status || (endedAt ? 'completed' : null)
              if (status !== 'completed' || (!endedAt && !startedAt)) continue

const completedDate = toLocalDateStr(endedAt || startedAt)
              const key = canonicalLessonId(session?.lesson_id)
              if (!completedDate || !key) continue
              completionDates.push(completedDate)
              completedFromSessions += 1
              completedKeySet.add(`${key}|${completedDate}`)
              const prev = completedDatesByLesson.get(key) || []
              prev.push(completedDate)
              completedDatesByLesson.set(key, prev)

try {
                const normalizedKey = normalizeLessonKey(String(session?.lesson_id || '')) || String(session?.lesson_id || '')
                const list = completedEventsByDate.get(completedDate) || []
                list.push({ lesson_key: normalizedKey || String(session?.lesson_id || ''), completed: true })
                completedEventsByDate.set(completedDate, list)
              } catch {}
            }

### 40. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (e6f6e2710584ed3300e0c4e0a1adbdd2d0fa8ec3051689f930f88e1a884dca05)
- bm25: -3.6395 | relevance: 1.0000

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
