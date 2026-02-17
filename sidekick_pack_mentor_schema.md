# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
What is the schema for Supabase table mentor_sessions? Find migrations/SQL that create or alter it; list columns relevant to scoping sessions per learner vs facilitator (learner_id, subject, context).
```

Filter terms used:
```text
SQL
learner_id
mentor_sessions
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

SQL learner_id mentor_sessions

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/facilitator/calendar/page.js (72f70893c01946442b9eded07b75bb6144d62ca4c9aa3ec475af49117056e8d3)
- bm25: -6.1503 | entity_overlap_w: 1.30 | adjusted: -6.4753 | relevance: 1.0000

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

### 2. sidekick_pack_calendar.md (5664748c8577fd0132da3c25664f52295fd4045d681f2dc40fb2b982e6013bfb)
- bm25: -5.9752 | entity_overlap_w: 1.30 | adjusted: -6.3002 | relevance: 1.0000

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

### 3. sidekick_pack_mentor_route.md (7307effc7334639c59b7e285e281aa3a4a226fee40b7b11a535d7d04e54e7404)
- bm25: -4.5571 | entity_overlap_w: 1.00 | adjusted: -4.8071 | relevance: 1.0000

async function deactivateSessionById(sessionId) {
  const { error } = await supabase
    .from('mentor_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)

### 4. src/app/api/mentor-session/route.js (94734a3f1ba8be99816f2ae459b0b54476c9de2628a55b95bb8dc269c1404500)
- bm25: -4.4030 | entity_overlap_w: 1.00 | adjusted: -4.6530 | relevance: 1.0000

const ids = staleSessions.map((session) => session.id)
    const { error: deactivateError } = await supabase
      .from('mentor_sessions')
      .update({ is_active: false })
      .in('id', ids)

### 5. sidekick_pack_mentor_route.md (828cc0b263a112b66f0ba45a82962bd6203b9933e7269476cbf299b3a75a4a94)
- bm25: -4.1679 | entity_overlap_w: 1.00 | adjusted: -4.4179 | relevance: 1.0000

// Delete only active sessions (is_active = true)
    // Saved conversations (is_active = false) are preserved
    const { data: deletedRows, error } = await supabase
      .from('mentor_sessions')
      .delete()
      .eq('facilitator_id', user.id)
      .eq('is_active', true)
      .select()

### 6. src/app/api/learner/lesson-history/route.js (9fa11bb439cfe3914be24723e9e7d44533aad95e4f86c10cb388b536d5f666c9)
- bm25: -3.3639 | entity_overlap_w: 4.00 | adjusted: -4.3639 | relevance: 1.0000

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

### 7. src/app/api/mentor-session/route.js (46494cc702c4a2148df586a477d0e85379e6bdd0af7f5b7d39f25aebbbe02c46)
- bm25: -3.8328 | entity_overlap_w: 2.00 | adjusted: -4.3328 | relevance: 1.0000

// If same session is reconnecting or no existing session, create/update
    if (!existingSession || existingSession.session_id === sessionId) {
      if (existingSession && existingSession.session_id === sessionId) {
        // Same session reconnecting - just update activity timestamp
        const { data: session, error: updateError } = await supabase
          .from('mentor_sessions')
          .update({
            device_name: deviceName || 'Unknown device',
            last_activity_at: now.toISOString()
          })
          .eq('id', existingSession.id)
          .select()
          .single()

if (updateError) {
          return Response.json({ error: 'Failed to update session' }, { status: 500 })
        }

return Response.json({
          session: session,
          status: 'active'
        })
      }

// No existing session - create new one
      const { data: session, error: createError } = await supabase
        .from('mentor_sessions')
        .insert({
          facilitator_id: user.id,
          session_id: sessionId,
          device_name: deviceName || 'Unknown device',
          conversation_history: [],
          draft_summary: '',
          is_active: true,
          last_activity_at: now.toISOString()
        })
        .select()
        .single()

if (createError) {
        return Response.json({ error: 'Failed to create session' }, { status: 500 })
      }

return Response.json({
        session: session,
        status: 'active'
      })
    }

### 8. src/app/facilitator/generator/counselor/CounselorClient.jsx (7008dd2f8f517207b58934b927000d615c49dab949c3fa691bdf8fb7783e1c3e)
- bm25: -3.6706 | entity_overlap_w: 2.00 | adjusted: -4.1706 | relevance: 1.0000

// (initializeMentorSession defined later, after realtime subscription helper)

// Replace polling with realtime subscription for instant conflict detection
  const startRealtimeSubscription = useCallback(async () => {
    if (!sessionId || !accessToken || !hasAccess) return
    
    // Clean up existing subscription
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe()
      realtimeChannelRef.current = null
    }

const supabase = getSupabaseClient()
    if (!supabase) return

// Get user ID for filtering
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('[Realtime] Cannot start subscription - no user')
      return
    }

console.log('[Realtime] Starting subscription for session:', sessionId, 'user:', user.id)

// Subscribe to mentor_sessions changes for this facilitator
    // Note: Can't filter by session_id in postgres_changes, so we filter in the callback
    const channel = supabase
      .channel('mentor-session-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'mentor_sessions'
      }, (payload) => {
        console.log('[Realtime] RAW event received:', {
          event: payload.eventType,
          table: payload.table,
          hasNew: !!payload.new,
          hasOld: !!payload.old
        })

if (!isMountedRef.current) {
          console.log('[Realtime] Ignoring - component unmounted')
          return
        }

const updatedSession = payload.new
        const oldSession = payload.old

### 9. sidekick_pack_mentor_route.md (21bb19fb47ac611a80afe9a7c03c8bdc818ea7e80fdf508d53c2f4b17493dc0a)
- bm25: -3.8781 | entity_overlap_w: 1.00 | adjusted: -4.1281 | relevance: 1.0000

// Create new session with conversation copied from old session
      const { data: newSession, error: createError } = await supabase
        .from('mentor_sessions')
        .insert({
          facilitator_id: user.id,
          session_id: sessionId,
          device_name: deviceName || 'Unknown device',
          conversation_history: conversationToCopy,
          draft_summary: draftSummaryToCopy,
          is_active: true,
          last_activity_at: now.toISOString()
        })
        .select()
        .single()

### 10. src/app/api/learner/lesson-history/route.js (fd1937ffd513cfdcd8c204297d056e1d4b876af7f6a90ff015155c1bac2dfd24)
- bm25: -3.3015 | entity_overlap_w: 3.00 | adjusted: -4.0515 | relevance: 1.0000

if (sessionError) {
      return NextResponse.json({ error: 'Failed to load lesson sessions' }, { status: 500 })
    }

const sessions = Array.isArray(sessionRows)
      ? sessionRows.map((row) => {
          const startedAt = row?.started_at || null
          const endedAt = row?.ended_at || null
          let durationSeconds = null
          if (startedAt && endedAt) {
            const start = new Date(startedAt)
            const end = new Date(endedAt)
            const diff = Math.max(0, end.getTime() - start.getTime())
            durationSeconds = Math.round(diff / 1000)
          }
          return {
            id: row?.id || null,
            learner_id: row?.learner_id || null,
            lesson_id: row?.lesson_id || null,
            started_at: startedAt,
            ended_at: endedAt,
            status: endedAt ? 'completed' : 'in-progress',
            duration_seconds: durationSeconds
          }
        })
      : []

let events = []
    try {
      let eventsQueryBase = () => {
        let q = supabase
          .from('lesson_session_events')
          .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
          .eq('learner_id', learnerId)

if (fromIso) q = q.gte('occurred_at', fromIso)
        if (toExclusiveIso) q = q.lt('occurred_at', toExclusiveIso)

return q.order('occurred_at', { ascending: false })
      }

### 11. sidekick_pack_mentor_route.md (76a887c3c0ba6ad8c836e9ab062298f081ae5c0f4868a206f25938dd5ae94aef)
- bm25: -3.5456 | entity_overlap_w: 2.00 | adjusted: -4.0456 | relevance: 1.0000

// If same session is reconnecting or no existing session, create/update
    if (!existingSession || existingSession.session_id === sessionId) {
      if (existingSession && existingSession.session_id === sessionId) {
        // Same session reconnecting - just update activity timestamp
        const { data: session, error: updateError } = await supabase
          .from('mentor_sessions')
          .update({
            device_name: deviceName || 'Unknown device',
            last_activity_at: now.toISOString()
          })
          .eq('id', existingSession.id)
          .select()
          .single()

if (updateError) {
          return Response.json({ error: 'Failed to update session' }, { status: 500 })
        }

return Response.json({
          session: session,
          status: 'active'
        })
      }

// No existing session - create new one
      const { data: session, error: createError } = await supabase
        .from('mentor_sessions')
        .insert({
          facilitator_id: user.id,
          session_id: sessionId,
          device_name: deviceName || 'Unknown device',
          conversation_history: [],
          draft_summary: '',
          is_active: true,
          last_activity_at: now.toISOString()
        })
        .select()
        .single()

if (createError) {
        return Response.json({ error: 'Failed to create session' }, { status: 500 })
      }

return Response.json({
        session: session,
        status: 'active'
      })
    }

### 11. src/app/api/mentor-session/route.js (68357d56faf6860e7ec01ac5f6eed3611e852d487b8eadc0f163056f7e6775ed)
- bm25: -13.6731 | entity_overlap_w: 3.00 | adjusted: -14.4231 | relevance: 1.0000

// Mr. Mentor Session Management API
// Handles session creation, takeover, sync, and deactivation

### 12. sidekick_pack_takeover.md (6a2197d79e8f46f1c42fb07b007f31b41d72cf61b0a050c0e11e3383cd89c0de)
- bm25: -3.5058 | entity_overlap_w: 2.00 | adjusted: -4.0058 | relevance: 1.0000

### 13. src/app/facilitator/generator/counselor/CounselorClient.jsx (7008dd2f8f517207b58934b927000d615c49dab949c3fa691bdf8fb7783e1c3e)
- bm25: -6.9667 | entity_overlap_w: 1.00 | adjusted: -7.2167 | relevance: 1.0000

// (initializeMentorSession defined later, after realtime subscription helper)

// Replace polling with realtime subscription for instant conflict detection
  const startRealtimeSubscription = useCallback(async () => {
    if (!sessionId || !accessToken || !hasAccess) return
    
    // Clean up existing subscription
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.unsubscribe()
      realtimeChannelRef.current = null
    }

const supabase = getSupabaseClient()
    if (!supabase) return

// Get user ID for filtering
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('[Realtime] Cannot start subscription - no user')
      return
    }

console.log('[Realtime] Starting subscription for session:', sessionId, 'user:', user.id)

// Subscribe to mentor_sessions changes for this facilitator
    // Note: Can't filter by session_id in postgres_changes, so we filter in the callback
    const channel = supabase
      .channel('mentor-session-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'mentor_sessions'
      }, (payload) => {
        console.log('[Realtime] RAW event received:', {
          event: payload.eventType,
          table: payload.table,
          hasNew: !!payload.new,
          hasOld: !!payload.old
        })

if (!isMountedRef.current) {
          console.log('[Realtime] Ignoring - component unmounted')
          return
        }

const updatedSession = payload.new
        const oldSession = payload.old

### 13. src/app/api/mentor-session/route.js (c6f52488cd95995f482d8719cfb19978d5f8e9ba35ff652a32c321b901555016)
- bm25: -3.3843 | entity_overlap_w: 2.00 | adjusted: -3.8843 | relevance: 1.0000

// GET: Check session status and retrieve active session
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 })
    }

const access = await requireMrMentorAccess(user.id)
    if (!access.allowed) {
      return Response.json({ error: 'Pro plan required' }, { status: 403 })
    }

const now = new Date()
    await cleanupStaleSessions({ facilitatorId: user.id, now })

const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

// Get active session for this facilitator
    const { data: sessions, error } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

if (error) {
      return Response.json({ error: 'Database error' }, { status: 500 })
    }

const activeSession = sessions?.[0] || null

// If no active session, return null
    if (!activeSession) {
      return Response.json({ 
        session: null,
        status: 'none'
      })
    }

// Conversation history is stored in mentor_sessions.conversation_history
    // Don't merge from conversation_drafts - that's for a different purpose
    const sessionWithConversation = {
      ...activeSession,
      conversation_history: activeSession.conversation_history || [],
      draft_summary: activeSession.draft_summary || ''
    }

### 14. sidekick_pack_takeover.md (7ba0b55dd2e1da3e5871fd86269c2ba23c40511c9483186fc05780559c22f4d5)
- bm25: -3.0965 | entity_overlap_w: 3.00 | adjusted: -3.8465 | relevance: 1.0000

### 27. src/app/api/learner/lesson-history/route.js (fd1937ffd513cfdcd8c204297d056e1d4b876af7f6a90ff015155c1bac2dfd24)
- bm25: -4.2302 | entity_overlap_w: 1.00 | adjusted: -4.4802 | relevance: 1.0000

if (sessionError) {
      return NextResponse.json({ error: 'Failed to load lesson sessions' }, { status: 500 })
    }

const sessions = Array.isArray(sessionRows)
      ? sessionRows.map((row) => {
          const startedAt = row?.started_at || null
          const endedAt = row?.ended_at || null
          let durationSeconds = null
          if (startedAt && endedAt) {
            const start = new Date(startedAt)
            const end = new Date(endedAt)
            const diff = Math.max(0, end.getTime() - start.getTime())
            durationSeconds = Math.round(diff / 1000)
          }
          return {
            id: row?.id || null,
            learner_id: row?.learner_id || null,
            lesson_id: row?.lesson_id || null,
            started_at: startedAt,
            ended_at: endedAt,
            status: endedAt ? 'completed' : 'in-progress',
            duration_seconds: durationSeconds
          }
        })
      : []

let events = []
    try {
      let eventsQueryBase = () => {
        let q = supabase
          .from('lesson_session_events')
          .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
          .eq('learner_id', learnerId)

if (fromIso) q = q.gte('occurred_at', fromIso)
        if (toExclusiveIso) q = q.lt('occurred_at', toExclusiveIso)

return q.order('occurred_at', { ascending: false })
      }

### 28. src/app/facilitator/generator/counselor/CounselorClient.jsx (174b7ff50955eb6cc8e15301c9d45c27764e03725c38994bd8f2f4fed1db44af)
- bm25: -4.2855 | relevance: 1.0000

### 15. src/app/api/planned-lessons/route.js (146c46c2ac9daf4464d5c46347f5662137c1074fa42a8e7030c5330b92a8e553)
- bm25: -3.0319 | entity_overlap_w: 3.00 | adjusted: -3.7819 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

// Fetch planned lessons for this learner.
    // Default behavior matches the facilitator calendar page:
    //   - Primary: scoped to this facilitator.
    //   - Fallback: if there are legacy rows under a single different facilitator_id, return them (read compatibility).
    // includeAll=1 mode intentionally returns *all* planned_lessons rows for the learner (authorized),
    // to surface legacy/other-namespace plans (e.g., 2026) without changing the default UI behavior.
    let data = null
    let error = null

if (includeAll) {
      const all = await adminSupabase
        .from('planned_lessons')
        .select('*')
        .eq('learner_id', learnerId)
        .order('scheduled_date', { ascending: true })

data = all.data
      error = all.error
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
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

### 16. sidekick_pack_mentor_route.md (4886c7b867e4aac621d75c0a4c516427d1a660c27597cac436b8470462b42f97)
- bm25: -3.3899 | entity_overlap_w: 1.00 | adjusted: -3.6399 | relevance: 1.0000

const activeSession = sessions?.[0] || null

// If no active session, return null
    if (!activeSession) {
      return Response.json({ 
        session: null,
        status: 'none'
      })
    }

// Conversation history is stored in mentor_sessions.conversation_history
    // Don't merge from conversation_drafts - that's for a different purpose
    const sessionWithConversation = {
      ...activeSession,
      conversation_history: activeSession.conversation_history || [],
      draft_summary: activeSession.draft_summary || ''
    }

### 26. src/app/facilitator/generator/counselor/CounselorClient.jsx (32b69638a7470372b35d616ad94782f1b5cf5cc4a395ed2d22d03ef4d16b6ab9)
- bm25: -10.9894 | entity_overlap_w: 5.30 | adjusted: -12.3144 | relevance: 1.0000

### 17. sidekick_pack_api_mentor_session.md (6b56b618008d5cb680f8d2acb4a40c06dfe74df74da158e871afccbf478ef705)
- bm25: -3.2986 | entity_overlap_w: 1.00 | adjusted: -3.5486 | relevance: 1.0000

const primary = await adminSupabase
      .from('planned_lessons')
      .select('*')
      .eq('learner_id', learnerId)
      .eq('facilitator_id', user.id)
      .order('scheduled_date', { ascending: true })

### 18. sidekick_pack_calendar.md (b9f64fcc30c8bd3ebb17b85b664218f55ba8aa4093cb2bd832a824322e224253)
- bm25: -3.2986 | entity_overlap_w: 1.00 | adjusted: -3.5486 | relevance: 1.0000

// Delete all planned lessons for this learner
    const { error } = await adminSupabase
      .from('planned_lessons')
      .delete()
      .eq('learner_id', learnerId)
      .eq('facilitator_id', user.id)

### 19. sidekick_pack_mentor_route.md (25261084976d2b3a3cc4725eb0964e4b33bc04a6445771bd8f96ebc26e580024)
- bm25: -3.2800 | entity_overlap_w: 1.00 | adjusted: -3.5300 | relevance: 1.0000

// Delete all planned lessons for this learner
    const { error } = await adminSupabase
      .from('planned_lessons')
      .delete()
      .eq('learner_id', learnerId)
      .eq('facilitator_id', user.id)

### 20. sidekick_pack_planned_all.md (77603d05bb312323c3b902ecf44e787a8f06762e5ea2d0d15968825acb2abeda)
- bm25: -3.2800 | entity_overlap_w: 1.00 | adjusted: -3.5300 | relevance: 1.0000

if (!Array.isArray(data) || data.length === 0) {
      const fallback = await adminSupabase
        .from('planned_lessons')
        .select('*')
        .eq('learner_id', learnerId)
        .order('scheduled_date', { ascending: true })

### 21. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (2a938234217ddc4bbe3fa752d0674cb474afe0e962d03962810e28b81a1eee8a)
- bm25: -2.8907 | entity_overlap_w: 2.00 | adjusted: -3.3907 | relevance: 1.0000

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

### 22. src/app/api/mentor-session/route.js (69d63aea360f4808d2ff3ca73fb3414be72fd128437fe02de0a46d26dc7c39c3)
- bm25: -3.1067 | entity_overlap_w: 1.00 | adjusted: -3.3567 | relevance: 1.0000

console.log('[DELETE] Deleting active session for user:', user.id, 'sessionId:', sessionId)

// Delete only active sessions (is_active = true)
    // Saved conversations (is_active = false) are preserved
    const { data: deletedRows, error } = await supabase
      .from('mentor_sessions')
      .delete()
      .eq('facilitator_id', user.id)
      .eq('is_active', true)
      .select()

console.log('[DELETE] Deleted active rows:', deletedRows?.length || 0, 'Rows:', deletedRows)

if (error) {
      console.error('[DELETE] Error:', error)
      return Response.json({ error: 'Failed to delete session', details: error.message }, { status: 500 })
    }

return Response.json({ success: true, deletedCount: deletedRows?.length || 0 })

} catch (err) {
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

### 23. sidekick_pack_planned_all.md (6bf0ba706dca4190f446a30ec3cb06dd8a1264ea184bf6fbac5ad9e5598aa686)
- bm25: -3.0242 | entity_overlap_w: 1.00 | adjusted: -3.2742 | relevance: 1.0000

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

### 24. sidekick_pack_calendar.md (5d56c2fb53a7eaf5c8fb3b830ea8c9f048631b95aa51d7b1d6b90c2c12416dd9)
- bm25: -2.7409 | entity_overlap_w: 2.00 | adjusted: -3.2409 | relevance: 1.0000

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

### 25. src/app/facilitator/generator/counselor/CounselorClient.jsx (a7995cf02d70d0901fb453c7e405a8d5757fff702873a011fc9767d697f04c3e)
- bm25: -2.7216 | entity_overlap_w: 2.00 | adjusted: -3.2216 | relevance: 1.0000

// Handle Enter key to send message
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      sendMessage()
    }
  }

// Trigger new conversation flow (show clipboard first)
  const startNewConversation = useCallback(async () => {
    if (conversationHistory.length === 0) {
      // No conversation to save, just start fresh
      return
    }

// Show clipboard overlay immediately (skip audio instructions to avoid playback errors)
    // The overlay itself provides clear UI instructions
    setShowClipboard(true)
  }, [conversationHistory])

// Handle clipboard save (commit to permanent memory)
  const handleClipboardSave = useCallback(async (editedSummary) => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        alert('Unable to save: not authenticated')
        return
      }

const learnerId = selectedLearnerId !== 'none' ? selectedLearnerId : null

// Save to conversation_updates (permanent memory)
      await fetch('/api/conversation-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          learner_id: learnerId,
          conversation_turns: conversationHistory,
          summary_override: editedSummary // Use the user-edited summary
        })
      })

// Delete the draft
      await fetch(`/api/conversation-drafts?learner_id=${learnerId || ''}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

### 26. src/app/api/lesson-schedule/route.js (a83063ae5d85edeb01513175e78de0ebdeac54f8a0fc02607cf3b638f24cc566)
- bm25: -2.6778 | entity_overlap_w: 2.00 | adjusted: -3.1778 | relevance: 1.0000

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

### 27. src/app/facilitator/generator/counselor/CounselorClient.jsx (8ca65b91008fada51ac00a96432ba7c4a0d8970aabeb5b08d9fc0657b5147720)
- bm25: -2.8890 | entity_overlap_w: 1.00 | adjusted: -3.1390 | relevance: 1.0000

// Load existing draft summary on mount and when learner changes
  useEffect(() => {
    if (!tierChecked || !accessToken) return
    
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (!supabase) return
        
        const learnerId = selectedLearnerId !== 'none' ? selectedLearnerId : null
        
        const response = await fetch(`/api/conversation-drafts?learner_id=${learnerId || ''}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

### 28. sidekick_pack_calendar.md (c9724a6488ce742416aba0ad09a8db8b7ab8f07ded8511ae49cd7dec9f4bde73)
- bm25: -2.6000 | entity_overlap_w: 2.00 | adjusted: -3.1000 | relevance: 1.0000

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

### 29. sidekick_pack_planned_all.md (5e701235b462b53d4fa20568cdfcc32f504bdbd5e6b2f81ac78a5bb3f6647c99)
- bm25: -2.5884 | entity_overlap_w: 2.00 | adjusted: -3.0884 | relevance: 1.0000

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

### 30. sidekick_pack_planned_all.md (67e0904d08340f2a377f958bee94dd1a6e442e88ccc977e95c8855167174f397)
- bm25: -2.8054 | entity_overlap_w: 1.00 | adjusted: -3.0554 | relevance: 1.0000

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

### 31. src/app/api/planned-lessons/route.js (2e571bb43ce6d8b5d9a45defe2dcfaa4c9056138a0ae893208d9912bb3b024a6)
- bm25: -2.5487 | entity_overlap_w: 2.00 | adjusted: -3.0487 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

// Get all dates in the new plan (normalized to YYYY-MM-DD)
    const newPlanDates = Object.keys(plannedLessons).map(normalizeScheduledDate)

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

### 32. sidekick_pack_planned_all.md (02c02d27f519cbb03ec7cb65be2760e2665a920e83f0a486eb7da10bdc2d5d4e)
- bm25: -2.7920 | entity_overlap_w: 1.00 | adjusted: -3.0420 | relevance: 1.0000

// Fetch lesson history (completed, scheduled, planned)
      const [historyRes, medalsRes, scheduledRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

### 33. src/app/api/lesson-schedule/route.js (a4a66f7a325a73d6a8b19846f515a5433ea46cb37ffe423379030e0dd63353c6)
- bm25: -2.5321 | entity_overlap_w: 2.00 | adjusted: -3.0321 | relevance: 1.0000

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

### 34. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (f4f738b9790c1b46c40556de7f983989a10e077f30287dd8945d6f43a1563a76)
- bm25: -2.7786 | entity_overlap_w: 1.00 | adjusted: -3.0286 | relevance: 1.0000

let historyRes
          let historyJson
          let historyAttempt = 'full'
          try {
            ;({ res: historyRes, json: historyJson } = await fetchHistoryJson(
              `/api/learner/lesson-history?learner_id=${targetLearnerId}&from=${encodeURIComponent(historyFrom)}&to=${encodeURIComponent(todayStr)}`
            ))
          } catch (err) {
            // If the full-window fetch is slow/aborted, retry with a smaller window.
            if (String(err?.name || '') === 'AbortError') throw err
            historyRes = null
            historyJson = null
          }

### 35. sidekick_pack_api_mentor_session.md (8b9b389fa3f5af3a357b2bac6ff071610a26a44a19bb91e69b738429ccd12a05)
- bm25: -2.4941 | entity_overlap_w: 2.00 | adjusted: -2.9941 | relevance: 1.0000

### 32. sidekick_pack_calendar.md (f3f7b14a499f1f3a989cdd52880f4a862e223e5a88ef1ef84f87ed21c65c5f64)
- bm25: -3.2298 | entity_overlap_w: 3.00 | adjusted: -3.9798 | relevance: 1.0000

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

### 36. sidekick_pack_calendar.md (f3f7b14a499f1f3a989cdd52880f4a862e223e5a88ef1ef84f87ed21c65c5f64)
- bm25: -2.4941 | entity_overlap_w: 2.00 | adjusted: -2.9941 | relevance: 1.0000

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

### 37. src/app/api/learner/lesson-history/route.js (5a218f2a3961460c8101e0ab3f4ddd93851d72b79a01f8c880344a7204fefe39)
- bm25: -2.7138 | entity_overlap_w: 1.00 | adjusted: -2.9638 | relevance: 1.0000

if (!existingIncomplete) {
        try {
          const { data: insertedEvent, error: insertError } = await supabase
            .from('lesson_session_events')
            .insert({
              session_id: session.id,
              learner_id: learnerId,
              lesson_id: session.lesson_id,
              event_type: 'incomplete',
              occurred_at: incompleteAtIso,
              metadata: {
                reason: 'auto-marked-stale',
                minutes_since_activity: Math.round((nowMs - latestActivityMs) / 60000),
              },
            })
            .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
            .single()

### 38. src/app/facilitator/generator/counselor/CounselorClient.jsx (8d5a3f01beb2e24d3994f08ab4fab74c23d4c10cb67803937aa80785a3d668bb)
- bm25: -2.9345 | relevance: 1.0000

{/* Input footer */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 16px',
        background: '#fff',
        borderTop: '1px solid #e5e7eb',
        zIndex: 10
      }}>
        <div style={{ 
          maxWidth: isMobileLandscape ? '100%' : 800, 
          margin: 0,
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          {/* Learner selection dropdown and screen buttons */}
          {learners.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4
              }}>
                <select
                  id="learner-select"
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                  disabled={loading || isSpeaking}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    background: '#fff',
                    cursor: (loading || isSpeaking) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="none">No Learner Selected (general discussion)</option>
                  {learners.map(learner => (
                    <option key={learner.id} value={learner.id}>
                      {learner.name} {learner.grade ? `(Grade ${learner.grade})` : ''}
                    </option>
                  ))}
                </select>

### 39. src/app/facilitator/calendar/page.js (5e87d7c4007b60bd8dc94a3654ecdcc51bd79003e2d025df44b062ea052b69f4)
- bm25: -2.6162 | entity_overlap_w: 1.00 | adjusted: -2.8662 | relevance: 1.0000

if (pastSchedule.length > 0 && minPastDate) {
          // IMPORTANT: Do not query lesson_session_events directly from the client.
          // In some environments, RLS causes the query to return an empty array without an error,
          // which hides all past schedule history. Use the admin-backed API endpoint instead.
          const historyRes = await fetch(
            `/api/learner/lesson-history?learner_id=${selectedLearnerId}&from=${encodeURIComponent(minPastDate)}&to=${encodeURIComponent(todayStr)}`
          )
          const historyJson = await historyRes.json().catch(() => null)

### 40. src/app/api/mentor-session/route.js (db7d65cfdea6e1a307048bbac453e8b202e2c2d9bacf853983bae8dbe1bac88d)
- bm25: -2.5657 | entity_overlap_w: 1.00 | adjusted: -2.8157 | relevance: 1.0000

// PIN validated, copy conversation from existing session
      const conversationToCopy = existingSession.conversation_history || []
      const draftSummaryToCopy = existingSession.draft_summary || ''

console.log('[Takeover API] Copying conversation:', {
        oldSessionId: existingSession.session_id,
        oldDeviceName: existingSession.device_name,
        conversationLength: conversationToCopy.length,
        hasDraft: !!draftSummaryToCopy,
        newSessionId: sessionId,
        newDeviceName: deviceName
      })

// Deactivate old session
      const deactivated = await deactivateSessionById(existingSession.id)

if (!deactivated) {
        return Response.json({ error: 'Failed to deactivate previous session' }, { status: 500 })
      }

// Create new session with conversation copied from old session
      const { data: newSession, error: createError } = await supabase
        .from('mentor_sessions')
        .insert({
          facilitator_id: user.id,
          session_id: sessionId,
          device_name: deviceName || 'Unknown device',
          conversation_history: conversationToCopy,
          draft_summary: draftSummaryToCopy,
          is_active: true,
          last_activity_at: now.toISOString()
        })
        .select()
        .single()

if (createError) {
        return Response.json({ 
          error: 'Failed to create session', 
          details: createError.message,
          code: createError.code
        }, { status: 500 })
      }

console.log('[Takeover API] New session created:', {
        sessionId: newSession.session_id,
        conversationLength: newSession.conversation_history?.length || 0,
        isActive: newSession.is_active
      })
