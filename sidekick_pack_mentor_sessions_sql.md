# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Find the SQL or migration that creates table mentor_sessions (look for 'create table mentor_sessions' or 'alter table mentor_sessions'). List columns.
```

Filter terms used:
```text
mentor_sessions
SQL
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

mentor_sessions SQL

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_mentor_schema.md (196c63713c4aa7d09c019526c84b777f409e64c0e86b6560172bfc378cef7622)
- bm25: -9.9732 | entity_overlap_w: 6.90 | adjusted: -11.6982 | relevance: 1.0000

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

### 2. sidekick_pack_mentor_schema.md (ebb07c6b50c9b919b40941e042392e9a26a8440c5be7d53121503fdd93a5af19)
- bm25: -6.4722 | entity_overlap_w: 1.30 | adjusted: -6.7972 | relevance: 1.0000

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

### 3. sidekick_pack_mentor_schema.md (2ea2b247b7112ad19926b40490787248601b4833bce2df19b06824f25cb68575)
- bm25: -5.5793 | entity_overlap_w: 1.30 | adjusted: -5.9043 | relevance: 1.0000

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

### 4. src/app/facilitator/calendar/page.js (72f70893c01946442b9eded07b75bb6144d62ca4c9aa3ec475af49117056e8d3)
- bm25: -5.3660 | entity_overlap_w: 1.30 | adjusted: -5.6910 | relevance: 1.0000

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

### 5. sidekick_pack_calendar.md (5664748c8577fd0132da3c25664f52295fd4045d681f2dc40fb2b982e6013bfb)
- bm25: -5.2136 | entity_overlap_w: 1.30 | adjusted: -5.5386 | relevance: 1.0000

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

### 6. sidekick_pack_mentor_schema.md (789c376238411a7697641d9d485d1b667aa50fa4849d0346477a0eb8f8b61668)
- bm25: -3.8599 | entity_overlap_w: 3.00 | adjusted: -4.6099 | relevance: 1.0000

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

### 7. sidekick_pack_mentor_schema.md (20964756447856c4b54bc7a24dc03acdc743245d776b43f66f6b31491a402542)
- bm25: -3.7301 | entity_overlap_w: 3.00 | adjusted: -4.4801 | relevance: 1.0000

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

### 8. sidekick_pack_mentor_route.md (7307effc7334639c59b7e285e281aa3a4a226fee40b7b11a535d7d04e54e7404)
- bm25: -4.0859 | entity_overlap_w: 1.00 | adjusted: -4.3359 | relevance: 1.0000

async function deactivateSessionById(sessionId) {
  const { error } = await supabase
    .from('mentor_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)

### 9. src/app/api/mentor-session/route.js (94734a3f1ba8be99816f2ae459b0b54476c9de2628a55b95bb8dc269c1404500)
- bm25: -3.9482 | entity_overlap_w: 1.00 | adjusted: -4.1982 | relevance: 1.0000

const ids = staleSessions.map((session) => session.id)
    const { error: deactivateError } = await supabase
      .from('mentor_sessions')
      .update({ is_active: false })
      .in('id', ids)

### 10. sidekick_pack_mentor_route.md (828cc0b263a112b66f0ba45a82962bd6203b9933e7269476cbf299b3a75a4a94)
- bm25: -3.7382 | entity_overlap_w: 1.00 | adjusted: -3.9882 | relevance: 1.0000

// Delete only active sessions (is_active = true)
    // Saved conversations (is_active = false) are preserved
    const { data: deletedRows, error } = await supabase
      .from('mentor_sessions')
      .delete()
      .eq('facilitator_id', user.id)
      .eq('is_active', true)
      .select()

### 11. src/app/api/mentor-session/route.js (46494cc702c4a2148df586a477d0e85379e6bdd0af7f5b7d39f25aebbbe02c46)
- bm25: -3.4399 | entity_overlap_w: 2.00 | adjusted: -3.9399 | relevance: 1.0000

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

### 12. src/app/facilitator/generator/counselor/CounselorClient.jsx (7008dd2f8f517207b58934b927000d615c49dab949c3fa691bdf8fb7783e1c3e)
- bm25: -3.2948 | entity_overlap_w: 2.00 | adjusted: -3.7948 | relevance: 1.0000

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

### 13. sidekick_pack_mentor_route.md (21bb19fb47ac611a80afe9a7c03c8bdc818ea7e80fdf508d53c2f4b17493dc0a)
- bm25: -3.4791 | entity_overlap_w: 1.00 | adjusted: -3.7291 | relevance: 1.0000

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

### 14. sidekick_pack_mentor_schema.md (f6b2b7547966f39796186062891b73192dacedd669baf1255c0407971e2d0b1b)
- bm25: -3.4791 | entity_overlap_w: 1.00 | adjusted: -3.7291 | relevance: 1.0000

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

### 15. sidekick_pack_mentor_schema.md (b2e9a742c08aa0cda3ee93259ec6927342626672a77ab4812a6d44d2a953ce6c)
- bm25: -3.1901 | entity_overlap_w: 2.00 | adjusted: -3.6901 | relevance: 1.0000

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

### 16. sidekick_pack_mentor_route.md (76a887c3c0ba6ad8c836e9ab062298f081ae5c0f4868a206f25938dd5ae94aef)
- bm25: -3.1829 | entity_overlap_w: 2.00 | adjusted: -3.6829 | relevance: 1.0000

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

### 17. sidekick_pack_takeover.md (6a2197d79e8f46f1c42fb07b007f31b41d72cf61b0a050c0e11e3383cd89c0de)
- bm25: -3.1472 | entity_overlap_w: 2.00 | adjusted: -3.6472 | relevance: 1.0000

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

### 18. sidekick_pack_mentor_schema.md (661dede2825481fe04da276df9d1294c9bc19136484ed719412fc5ecb44259a9)
- bm25: -3.3308 | entity_overlap_w: 1.00 | adjusted: -3.5808 | relevance: 1.0000

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

### 19. sidekick_pack_mentor_schema.md (da26b76c984290299ce40dba64556cf8e80731ff52358584ee45bc255e22e749)
- bm25: -3.3308 | entity_overlap_w: 1.00 | adjusted: -3.5808 | relevance: 1.0000

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

### 20. sidekick_pack_mentor_schema.md (91374418c076207a8c22559c0c4ca15b14f2290345b48600cc87af8cfa7078e4)
- bm25: -3.0516 | entity_overlap_w: 2.00 | adjusted: -3.5516 | relevance: 1.0000

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

### 21. src/app/api/mentor-session/route.js (c6f52488cd95995f482d8719cfb19978d5f8e9ba35ff652a32c321b901555016)
- bm25: -3.0384 | entity_overlap_w: 2.00 | adjusted: -3.5384 | relevance: 1.0000

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

### 22. sidekick_pack_mentor_route.md (4886c7b867e4aac621d75c0a4c516427d1a660c27597cac436b8470462b42f97)
- bm25: -3.0424 | entity_overlap_w: 1.00 | adjusted: -3.2924 | relevance: 1.0000

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

### 23. src/app/api/mentor-session/route.js (69d63aea360f4808d2ff3ca73fb3414be72fd128437fe02de0a46d26dc7c39c3)
- bm25: -2.7889 | entity_overlap_w: 1.00 | adjusted: -3.0389 | relevance: 1.0000

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

### 24. sidekick_pack_mentor_schema.md (a238f7a00fd91a4bb42471b11d689f0c3523d9a8a81504a18dc9bceae370aed5)
- bm25: -2.3272 | entity_overlap_w: 1.00 | adjusted: -2.5772 | relevance: 1.0000

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

### 25. src/app/api/mentor-session/route.js (db7d65cfdea6e1a307048bbac453e8b202e2c2d9bacf853983bae8dbe1bac88d)
- bm25: -2.3043 | entity_overlap_w: 1.00 | adjusted: -2.5543 | relevance: 1.0000

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

### 26. sidekick_pack_mentor_schema.md (8e448f78561e7f0e5621ee96c89dc40cbc8078f45d0d7f062ae7475aa92d76aa)
- bm25: -2.1963 | entity_overlap_w: 1.00 | adjusted: -2.4463 | relevance: 1.0000

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

### 27. sidekick_pack_mentor_schema.md (8c40ea979c2c830c5c40956d1f4a8324caf1d47a7524ebdc5f85a83162a04af6)
- bm25: -2.1559 | entity_overlap_w: 1.00 | adjusted: -2.4059 | relevance: 1.0000

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

### 28. src/app/api/mentor-session/route.js (1fe1ab155adbaf0e5796d4e84c300f4ebc4972ecc1eebe5b27191470f370c0fe)
- bm25: -2.1362 | entity_overlap_w: 1.00 | adjusted: -2.3862 | relevance: 1.0000

try {
        const pinValid = await verifyPin(user.id, pinCode)
        if (!pinValid) {
          return Response.json({
            error: 'Invalid PIN code',
            requiresPin: true
          }, { status: 403 })
        }
      } catch (pinErr) {
        return Response.json({ error: 'Failed to verify PIN' }, { status: 500 })
      }

const targetId = targetSessionId || existingSession?.session_id
      if (!targetId) {
        return Response.json({ error: 'No target session available to force end' }, { status: 400 })
      }

const { data: targetSessions, error: targetFetchError } = await supabase
        .from('mentor_sessions')
        .select('id, session_id')
        .eq('facilitator_id', user.id)
        .eq('session_id', targetId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

if (targetFetchError) {
        return Response.json({ error: 'Database error' }, { status: 500 })
      }

const targetSession = targetSessions?.[0]
      if (!targetSession) {
        return Response.json({ status: 'already_inactive' })
      }

const success = await deactivateSessionById(targetSession.id)
      if (!success) {
        return Response.json({ error: 'Failed to end session' }, { status: 500 })
      }

return Response.json({
        status: 'force_ended',
        clearedSessionId: targetSession.session_id
      })
    }

// If taking over from another device, verify PIN
    if (existingSession && existingSession.session_id !== sessionId && action === 'takeover') {
      // Verify PIN code
      if (!pinCode) {
        return Response.json({ 
          error: 'PIN required to take over session',
          requiresPin: true
        }, { status: 403 })
      }

### 29. sidekick_pack_mentor_route.md (28ee605842d2135beee2390aaffe4f408e66063350b265d8a9636e03003d7b3c)
- bm25: -2.1362 | entity_overlap_w: 1.00 | adjusted: -2.3862 | relevance: 1.0000

const targetId = targetSessionId || existingSession?.session_id
      if (!targetId) {
        return Response.json({ error: 'No target session available to force end' }, { status: 400 })
      }

const { data: targetSessions, error: targetFetchError } = await supabase
        .from('mentor_sessions')
        .select('id, session_id')
        .eq('facilitator_id', user.id)
        .eq('session_id', targetId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

if (targetFetchError) {
        return Response.json({ error: 'Database error' }, { status: 500 })
      }

const targetSession = targetSessions?.[0]
      if (!targetSession) {
        return Response.json({ status: 'already_inactive' })
      }

const success = await deactivateSessionById(targetSession.id)
      if (!success) {
        return Response.json({ error: 'Failed to end session' }, { status: 500 })
      }

return Response.json({
        status: 'force_ended',
        clearedSessionId: targetSession.session_id
      })
    }

// If taking over from another device, verify PIN
    if (existingSession && existingSession.session_id !== sessionId && action === 'takeover') {
      // Verify PIN code
      if (!pinCode) {
        return Response.json({ 
          error: 'PIN required to take over session',
          requiresPin: true
        }, { status: 403 })
      }

### 3. src/app/api/mentor-session/route.js (69d63aea360f4808d2ff3ca73fb3414be72fd128437fe02de0a46d26dc7c39c3)
- bm25: -17.0068 | entity_overlap_w: 4.00 | adjusted: -18.0068 | relevance: 1.0000

console.log('[DELETE] Deleting active session for user:', user.id, 'sessionId:', sessionId)

### 30. src/app/api/mentor-session/route.js (a35cf334171c13312e31e3a837acf94d5ed0fc2b2b550c703de719e2385bfa99)
- bm25: -2.1297 | entity_overlap_w: 1.00 | adjusted: -2.3797 | relevance: 1.0000

} catch (err) {
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// PATCH: Update session (conversation history, draft summary, last activity)
export async function PATCH(request) {
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

const body = await request.json()
    const { sessionId, conversationHistory, draftSummary, tokenCount, lastLocalUpdateAt } = body

console.log('[PATCH] Received update:', { 
      sessionId, 
      conversationLength: conversationHistory?.length, 
      hasDraft: !!draftSummary,
      tokenCount,
      timestamp: lastLocalUpdateAt
    })

if (!sessionId) {
      return Response.json({ error: 'Session ID required' }, { status: 400 })
    }

console.log('[PATCH] Looking for session:', { userId: user.id, sessionId })

// Verify this is the active session
    const { data: session, error: sessionError } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .single()

console.log('[PATCH] Session query result:', { found: !!session, error: sessionError })

### 31. sidekick_pack_mentor_schema.md (f415dc0a09a7a995ac4adac6edf765d33fc4c77c70e4ea486210aaaeffe1e45d)
- bm25: -2.1169 | entity_overlap_w: 1.00 | adjusted: -2.3669 | relevance: 1.0000

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

### 32. src/app/api/mentor-session/route.js (f42b4125818c957ac606e715ca7ec6b570ab16ee591dc11e1edd7b33533cd4a6)
- bm25: -2.1169 | entity_overlap_w: 1.00 | adjusted: -2.3669 | relevance: 1.0000

// Update session
    const updates = {
      last_activity_at: new Date().toISOString()
    }

if (conversationHistory !== undefined) {
      updates.conversation_history = conversationHistory
    }

if (draftSummary !== undefined) {
      updates.draft_summary = draftSummary
    }

if (tokenCount !== undefined) {
      updates.token_count = tokenCount
    }

if (lastLocalUpdateAt) {
      updates.last_local_update_at = lastLocalUpdateAt
    }

const { error: updateError } = await supabase
      .from('mentor_sessions')
      .update(updates)
      .eq('id', session.id)

console.log('[PATCH] Update result:', { error: updateError, updates })

if (updateError) {
      return Response.json({ 
        error: 'Failed to update session', 
        supabaseError: updateError.message || updateError,
        code: updateError.code
      }, { status: 500 })
    }

return Response.json({ success: true })

} catch (err) {
    console.error('[PATCH] Error:', err)
    return Response.json({ error: 'Internal error', details: err.message }, { status: 500 })
  }
}

// DELETE: End session (manual end conversation)
export async function DELETE(request) {
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

### 33. src/app/api/mentor-session/route.js (3e707d10abc70307e8ea2175a8e2ef7a7bc3bc124aff810b84d88b3f8fe08d5f)
- bm25: -2.0610 | entity_overlap_w: 1.00 | adjusted: -2.3110 | relevance: 1.0000

return Response.json({
      session: sessionWithConversation,
      status: isOwner ? 'active' : 'taken',
      isOwner
    })

} catch (err) {
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST: Create or take over session
export async function POST(request) {
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

const body = await request.json()
    const { sessionId, deviceName, pinCode, action, targetSessionId } = body

if (!sessionId) {
      return Response.json({ error: 'Session ID required' }, { status: 400 })
    }

const now = new Date()

await cleanupStaleSessions({ facilitatorId: user.id, now })

// Check for existing active session
    const { data: existingSessions, error: fetchError } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

if (fetchError) {
      return Response.json({ error: 'Database error' }, { status: 500 })
    }

let existingSession = existingSessions?.[0] || null

if (existingSession && isSessionStale(existingSession, now.getTime())) {
      await deactivateSessionById(existingSession.id)
      existingSession = null
    }

### 34. sidekick_pack_mentor_route.md (b166a122a9891687b725ba5e2b4a23cef8fa70b4abcaab496e27c5587f3bcc66)
- bm25: -2.0431 | entity_overlap_w: 1.00 | adjusted: -2.2931 | relevance: 1.0000

console.log('[PATCH] Received update:', { 
      sessionId, 
      conversationLength: conversationHistory?.length, 
      hasDraft: !!draftSummary,
      tokenCount,
      timestamp: lastLocalUpdateAt
    })

if (!sessionId) {
      return Response.json({ error: 'Session ID required' }, { status: 400 })
    }

console.log('[PATCH] Looking for session:', { userId: user.id, sessionId })

// Verify this is the active session
    const { data: session, error: sessionError } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .single()

console.log('[PATCH] Session query result:', { found: !!session, error: sessionError })

### 22. src/app/api/planned-lessons/route.js (15656ce650d24fdeb4fda70bfd25cc8bd17794cf1e124b01b93a1b3280f5fd24)
- bm25: -12.3784 | entity_overlap_w: 1.00 | adjusted: -12.6284 | relevance: 1.0000

const allRows = Array.isArray(fallback.data) ? fallback.data : []
        const distinctFacilitators = Array.from(
          new Set(allRows.map(r => r?.facilitator_id).filter(Boolean))
        )

### 23. src/app/api/lesson-schedule/route.js (4e331f192a6c56a4cab8c5f7afbe0982981f3bd236880d62edeea56744dbb7e2)
- bm25: -11.8478 | entity_overlap_w: 3.00 | adjusted: -12.5978 | relevance: 1.0000

// Default behavior: prefer facilitator-scoped schedule rows, plus safe legacy rows where facilitator_id is null.
    // Overlay/debug callers can pass includeAll=1 to retrieve all schedule rows for an owned learner.
    if (!includeAll) {
      query = query.or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
    }

### 35. sidekick_pack_mentor_route.md (d88c18d299f4791ccc3d01c23cda981fdd867248721f1b2df31f8066ba12f0ef)
- bm25: -2.0431 | entity_overlap_w: 1.00 | adjusted: -2.2931 | relevance: 1.0000

// Another device has active session - require takeover
    return Response.json({
      error: 'Another device has an active session',
      requiresPin: true,
      existingSession: {
        session_id: existingSession.session_id,
        device_name: existingSession.device_name,
        last_activity_at: existingSession.last_activity_at
      }
    }, { status: 409 })

### 25. src/app/api/mentor-session/route.js (c6f52488cd95995f482d8719cfb19978d5f8e9ba35ff652a32c321b901555016)
- bm25: -11.9349 | entity_overlap_w: 2.00 | adjusted: -12.4349 | relevance: 1.0000

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

### 36. sidekick_pack_mentor_route.md (68db64b244632dd22e77b805b5e50b3f242e722b3df4dd8115386906fff9128c)
- bm25: -2.0371 | entity_overlap_w: 1.00 | adjusted: -2.2871 | relevance: 1.0000

### 31. src/app/api/mentor-session/route.js (3e707d10abc70307e8ea2175a8e2ef7a7bc3bc124aff810b84d88b3f8fe08d5f)
- bm25: -11.6997 | entity_overlap_w: 2.00 | adjusted: -12.1997 | relevance: 1.0000

return Response.json({
      session: sessionWithConversation,
      status: isOwner ? 'active' : 'taken',
      isOwner
    })

} catch (err) {
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}

// POST: Create or take over session
export async function POST(request) {
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

const body = await request.json()
    const { sessionId, deviceName, pinCode, action, targetSessionId } = body

if (!sessionId) {
      return Response.json({ error: 'Session ID required' }, { status: 400 })
    }

const now = new Date()

await cleanupStaleSessions({ facilitatorId: user.id, now })

// Check for existing active session
    const { data: existingSessions, error: fetchError } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

if (fetchError) {
      return Response.json({ error: 'Database error' }, { status: 500 })
    }

### 37. sidekick_pack_mentor_route.md (2de53d2f8ecfa3152b823e762968b211d9727b3657bd91d5773c59179002583b)
- bm25: -2.0023 | entity_overlap_w: 1.00 | adjusted: -2.2523 | relevance: 1.0000

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const SESSION_TIMEOUT_MINUTES = Math.max(
  1,
  Number.parseInt(process.env.MENTOR_SESSION_TIMEOUT_MINUTES ?? '15', 10)
)
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000

function getSessionActivityTimestamp(session) {
  if (!session) return 0
  const iso = session.last_activity_at || session.created_at
  if (!iso) return 0
  const ts = new Date(iso).getTime()
  return Number.isFinite(ts) ? ts : 0
}

function isSessionStale(session, referenceMs = Date.now()) {
  // Sessions never go stale - conversations persist indefinitely
  // Only manual actions (delete/save/export) should clear them
  return false
}

async function cleanupStaleSessions({ facilitatorId, now = new Date() } = {}) {
  try {
    let query = supabase
      .from('mentor_sessions')
      .select('id, session_id, facilitator_id, last_activity_at, created_at')
      .eq('is_active', true)

if (facilitatorId) {
      query = query.eq('facilitator_id', facilitatorId)
    }

const { data: activeSessions, error } = await query

if (error) {
      return []
    }

const referenceMs = now.getTime()
    const staleSessions = (activeSessions || []).filter((session) =>
      isSessionStale(session, referenceMs)
    )

if (staleSessions.length === 0) {
      return []
    }

### 12. src/app/api/mentor-session/route.js (a32ee1aeb5f6c84f6115cf947944bd0643fb288fd1cf2bfcf7cdae9d1ef28362)
- bm25: -14.1657 | relevance: 1.0000

return Response.json({
        session: newSession,
        status: 'taken_over',
        message: 'Session taken over successfully'
      })
    }

### 38. src/app/api/mentor-session/route.js (adfb74802203806f9dd3f9f3942b3cab5e250bace28553cfd8c279f424a82c64)
- bm25: -1.9854 | entity_overlap_w: 1.00 | adjusted: -2.2354 | relevance: 1.0000

if (deactivateError) {
      return []
    }

return staleSessions
  } catch (err) {
    return []
  }
}

async function deactivateSessionById(sessionId) {
  const { error } = await supabase
    .from('mentor_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)

if (error) {
    return false
  }

return true
}

function scryptHash(pin, salt) {
  return `s1$${salt}$${scryptSync(pin, salt, 64, { N: 16384, r: 8, p: 1 }).toString('hex')}`
}

function verifyPinHash(pin, stored) {
  if (typeof stored !== 'string') return false
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 's1') return false
  const [, salt] = parts
  const recomputed = scryptHash(pin, salt)
  try {
    return timingSafeEqual(Buffer.from(recomputed), Buffer.from(stored))
  } catch {
    return false
  }
}

async function requireMrMentorAccess(userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, plan_tier')
    .eq('id', userId)
    .maybeSingle()

const effectiveTier = resolveEffectiveTier(profile?.subscription_tier, profile?.plan_tier)
  const ent = featuresForTier(effectiveTier)
  const allowed = ent?.mentorSessions === Infinity || (Number.isFinite(ent?.mentorSessions) && ent.mentorSessions > 0)
  return { allowed, tier: effectiveTier }
}

async function verifyPin(userId, pinCode) {
  // Try to get facilitator_pin_hash first (modern schema)
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('facilitator_pin_hash')
    .eq('id', userId)
    .maybeSingle()

if (error) {
    throw error
  }

if (!profile) {
    return false
  }

if (profile.facilitator_pin_hash) {
    return verifyPinHash(pinCode, profile.facilitator_pin_hash)
  }

// No PIN set
  return false
}

### 39. src/app/api/mentor-session/route.js (68357d56faf6860e7ec01ac5f6eed3611e852d487b8eadc0f163056f7e6775ed)
- bm25: -1.9798 | entity_overlap_w: 1.00 | adjusted: -2.2298 | relevance: 1.0000

// Mr. Mentor Session Management API
// Handles session creation, takeover, sync, and deactivation

import { createClient } from '@supabase/supabase-js'
import { scryptSync, timingSafeEqual } from 'node:crypto'
import { featuresForTier, resolveEffectiveTier } from '../../lib/entitlements'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const SESSION_TIMEOUT_MINUTES = Math.max(
  1,
  Number.parseInt(process.env.MENTOR_SESSION_TIMEOUT_MINUTES ?? '15', 10)
)
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000

function getSessionActivityTimestamp(session) {
  if (!session) return 0
  const iso = session.last_activity_at || session.created_at
  if (!iso) return 0
  const ts = new Date(iso).getTime()
  return Number.isFinite(ts) ? ts : 0
}

function isSessionStale(session, referenceMs = Date.now()) {
  // Sessions never go stale - conversations persist indefinitely
  // Only manual actions (delete/save/export) should clear them
  return false
}

async function cleanupStaleSessions({ facilitatorId, now = new Date() } = {}) {
  try {
    let query = supabase
      .from('mentor_sessions')
      .select('id, session_id, facilitator_id, last_activity_at, created_at')
      .eq('is_active', true)

if (facilitatorId) {
      query = query.eq('facilitator_id', facilitatorId)
    }

const { data: activeSessions, error } = await query

if (error) {
      return []
    }

const referenceMs = now.getTime()
    const staleSessions = (activeSessions || []).filter((session) =>
      isSessionStale(session, referenceMs)
    )

if (staleSessions.length === 0) {
      return []
    }

### 40. sidekick_pack_mentor_route.md (c5573c182949c3e4b375da5e02fc850631a6175002ce78347d15646082e99491)
- bm25: -1.9255 | entity_overlap_w: 1.00 | adjusted: -2.1755 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Read src/app/api/mentor-session/route.js ownership logic: how it uses sessionId, deviceName, facilitator_id, is_active, isOwner, and how takeover via PIN is implemented. Also how CounselorClient decides to show takeover dialog vs start conversation. Need change to per-subject conversations (facilitator + each learner) and server-backed device ownership (no localStorage).
```

Filter terms used:
```text
src/app/api/mentor-session/route.js
/app/api/mentor-session/route
PIN
route.js
CounselorClient
facilitator_id
is_active
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

src/app/api/mentor-session/route.js /app/api/mentor-session/route PIN route.js CounselorClient facilitator_id is_active

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/api/mentor-session/route.js (94734a3f1ba8be99816f2ae459b0b54476c9de2628a55b95bb8dc269c1404500)
- bm25: -18.3520 | entity_overlap_w: 1.00 | adjusted: -18.6020 | relevance: 1.0000

const ids = staleSessions.map((session) => session.id)
    const { error: deactivateError } = await supabase
      .from('mentor_sessions')
      .update({ is_active: false })
      .in('id', ids)

### 2. src/app/api/mentor-session/route.js (1fe1ab155adbaf0e5796d4e84c300f4ebc4972ecc1eebe5b27191470f370c0fe)
- bm25: -16.4534 | entity_overlap_w: 8.50 | adjusted: -18.5784 | relevance: 1.0000
