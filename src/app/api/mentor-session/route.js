// Mr. Mentor Session Management API
// Handles session creation, takeover, sync, and deactivation

import { createClient } from '@supabase/supabase-js'

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

export const maxDuration = 60

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
      console.error('[mentor-session] Failed to fetch session:', error)
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

    // Check if the requesting session is the active one
    const isOwner = activeSession.session_id === sessionId

    return Response.json({
      session: activeSession,
      status: isOwner ? 'active' : 'taken',
      isOwner
    })

  } catch (err) {
    console.error('[mentor-session] GET error:', err)
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

    const body = await request.json()
    const { sessionId, deviceName, pinCode, action } = body

    if (!sessionId) {
      return Response.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Check for existing active session
    const { data: existingSessions, error: fetchError } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      console.error('[mentor-session] Failed to fetch existing session:', fetchError)
      return Response.json({ error: 'Database error' }, { status: 500 })
    }

    const existingSession = existingSessions?.[0]

    // If taking over from another device, verify PIN
    if (existingSession && existingSession.session_id !== sessionId && action === 'takeover') {
      // Verify PIN code
      if (!pinCode) {
        return Response.json({ 
          error: 'PIN required to take over session',
          requiresPin: true
        }, { status: 403 })
      }

      // Validate PIN using the same gate logic
      const { data: profile } = await supabase
        .from('profiles')
        .select('pin_code')
        .eq('id', user.id)
        .single()

      if (!profile?.pin_code || profile.pin_code !== pinCode) {
        return Response.json({ 
          error: 'Invalid PIN code',
          requiresPin: true
        }, { status: 403 })
      }

      // PIN validated, deactivate old session
      const { error: deactivateError } = await supabase
        .from('mentor_sessions')
        .update({ is_active: false })
        .eq('id', existingSession.id)

      if (deactivateError) {
        console.error('[mentor-session] Failed to deactivate old session:', deactivateError)
      }

      // Create new session with existing conversation history
      const { data: newSession, error: createError } = await supabase
        .from('mentor_sessions')
        .insert({
          facilitator_id: user.id,
          session_id: sessionId,
          device_name: deviceName || 'Unknown device',
          conversation_history: existingSession.conversation_history || [],
          draft_summary: existingSession.draft_summary,
          is_active: true,
          last_activity_at: new Date().toISOString()
        })
        .select()
        .single()

      if (createError) {
        console.error('[mentor-session] Failed to create new session:', createError)
        return Response.json({ error: 'Failed to create session' }, { status: 500 })
      }

      return Response.json({
        session: newSession,
        status: 'taken_over',
        message: 'Session taken over successfully'
      })
    }

    // If same session is reconnecting or no existing session, create/update
    if (!existingSession || existingSession.session_id === sessionId) {
      // Upsert session
      const { data: session, error: upsertError } = await supabase
        .from('mentor_sessions')
        .upsert({
          facilitator_id: user.id,
          session_id: sessionId,
          device_name: deviceName || 'Unknown device',
          conversation_history: existingSession?.conversation_history || [],
          draft_summary: existingSession?.draft_summary,
          is_active: true,
          last_activity_at: new Date().toISOString()
        }, {
          onConflict: 'facilitator_id,is_active'
        })
        .select()
        .single()

      if (upsertError) {
        console.error('[mentor-session] Failed to upsert session:', upsertError)
        return Response.json({ error: 'Failed to create session' }, { status: 500 })
      }

      return Response.json({
        session: session,
        status: 'active'
      })
    }

    // Another device has active session - require takeover
    return Response.json({
      error: 'Another device has an active session',
      requiresPin: true,
      existingSession: {
        device_name: existingSession.device_name,
        last_activity_at: existingSession.last_activity_at
      }
    }, { status: 409 })

  } catch (err) {
    console.error('[mentor-session] POST error:', err)
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

    const body = await request.json()
    const { sessionId, conversationHistory, draftSummary } = body

    if (!sessionId) {
      return Response.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Verify this is the active session
    const { data: session } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('session_id', sessionId)
      .eq('is_active', true)
      .single()

    if (!session) {
      return Response.json({ 
        error: 'Session not active or not found',
        status: 'inactive'
      }, { status: 410 })
    }

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

    const { error: updateError } = await supabase
      .from('mentor_sessions')
      .update(updates)
      .eq('id', session.id)

    if (updateError) {
      console.error('[mentor-session] Failed to update session:', updateError)
      return Response.json({ error: 'Failed to update session' }, { status: 500 })
    }

    return Response.json({ success: true })

  } catch (err) {
    console.error('[mentor-session] PATCH error:', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
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

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return Response.json({ error: 'Session ID required' }, { status: 400 })
    }

    // Deactivate session
    const { error } = await supabase
      .from('mentor_sessions')
      .update({ is_active: false })
      .eq('facilitator_id', user.id)
      .eq('session_id', sessionId)

    if (error) {
      console.error('[mentor-session] Failed to deactivate session:', error)
      return Response.json({ error: 'Failed to end session' }, { status: 500 })
    }

    return Response.json({ success: true })

  } catch (err) {
    console.error('[mentor-session] DELETE error:', err)
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
