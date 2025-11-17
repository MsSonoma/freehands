// Mr. Mentor Session Management API
// Handles session creation, takeover, sync, and deactivation

import { createClient } from '@supabase/supabase-js'
import { scryptSync, timingSafeEqual } from 'node:crypto'

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
  const lastActivity = getSessionActivityTimestamp(session)
  if (!lastActivity) return false
  return referenceMs - lastActivity > SESSION_TIMEOUT_MS
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
      console.error('[mentor-session] Failed to fetch active sessions for cleanup:', error)
      return []
    }

    const referenceMs = now.getTime()
    const staleSessions = (activeSessions || []).filter((session) =>
      isSessionStale(session, referenceMs)
    )

    if (staleSessions.length === 0) {
      return []
    }

    const ids = staleSessions.map((session) => session.id)
    const { error: deactivateError } = await supabase
      .from('mentor_sessions')
      .update({ is_active: false })
      .in('id', ids)

    if (deactivateError) {
      console.error('[mentor-session] Failed to deactivate stale sessions:', deactivateError)
      return []
    }

    staleSessions.forEach((session) => {
      console.info(
        '[mentor-session] Auto-deactivated stale session',
        session.session_id,
        'for facilitator',
        session.facilitator_id
      )
    })

    return staleSessions
  } catch (err) {
    console.error('[mentor-session] Unexpected error clearing stale sessions:', err)
    return []
  }
}

async function deactivateSessionById(sessionId) {
  const { error } = await supabase
    .from('mentor_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)

  if (error) {
    console.error('[mentor-session] Failed to deactivate session by id:', sessionId, error)
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

    console.info(
      '[mentor-session] GET returning session:',
      'session_id=', activeSession.session_id,
      'conversation_history.length=', activeSession.conversation_history?.length || 0,
      'isOwner=', isOwner
    )

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
      console.error('[mentor-session] Failed to fetch existing session:', fetchError)
      return Response.json({ error: 'Database error' }, { status: 500 })
    }

    let existingSession = existingSessions?.[0] || null

    if (existingSession && isSessionStale(existingSession, now.getTime())) {
      const cleared = await deactivateSessionById(existingSession.id)
      if (cleared) {
        console.info(
          '[mentor-session] Cleared stale session during POST for facilitator',
          user.id,
          'session',
          existingSession.session_id
        )
      }
      existingSession = null
    }

    if (action === 'force_end') {
      if (!pinCode) {
        return Response.json({
          error: 'PIN required to force end session',
          requiresPin: true
        }, { status: 403 })
      }

      try {
        const pinValid = await verifyPin(user.id, pinCode)
        if (!pinValid) {
          return Response.json({
            error: 'Invalid PIN code',
            requiresPin: true
          }, { status: 403 })
        }
      } catch (pinErr) {
        console.error('[mentor-session] Failed to verify PIN for force end:', pinErr)
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
        console.error('[mentor-session] Failed to locate session for force end:', targetFetchError)
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

      console.info(
        '[mentor-session] Force-ended session',
        targetSession.session_id,
        'for facilitator',
        user.id
      )

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

      try {
        const pinValid = await verifyPin(user.id, pinCode)
        if (!pinValid) {
          return Response.json({
            error: 'Invalid PIN code',
            requiresPin: true
          }, { status: 403 })
        }
      } catch (pinErr) {
        console.error('[mentor-session] Failed to verify PIN:', pinErr)
        console.error('[mentor-session] PIN error stack:', pinErr.stack)
        return Response.json({ 
          error: 'Failed to verify PIN', 
          details: pinErr.message 
        }, { status: 500 })
      }

      // PIN validated, deactivate old session
      const deactivated = await deactivateSessionById(existingSession.id)

      if (!deactivated) {
        return Response.json({ error: 'Failed to deactivate previous session' }, { status: 500 })
      }

      console.info(
        '[mentor-session] Session takeover cleared previous session',
        existingSession.session_id,
        'for facilitator',
        user.id
      )

      // Fetch actual conversation from conversation_drafts table
      const { data: draftData } = await supabase
        .from('conversation_drafts')
        .select('recent_turns, draft_summary')
        .eq('facilitator_id', user.id)
        .maybeSingle()

      const conversationToCopy = draftData?.recent_turns || existingSession.conversation_history || []
      const draftSummaryToCopy = draftData?.draft_summary || existingSession.draft_summary || ''

      console.info(
        '[mentor-session] TAKEOVER copying conversation_history:',
        'from conversation_drafts.recent_turns.length=', draftData?.recent_turns?.length || 0,
        'from mentor_sessions.conversation_history.length=', existingSession.conversation_history?.length || 0,
        'final length=', conversationToCopy.length
      )

      // Create new session with existing conversation history
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
        console.error('[mentor-session] Failed to create new session:', createError)
        console.error('[mentor-session] Create error details:', JSON.stringify(createError))
        return Response.json({ 
          error: 'Failed to create session', 
          details: createError.message,
          code: createError.code
        }, { status: 500 })
      }

      console.info(
        '[mentor-session] TAKEOVER created new session with conversation_history:',
        'newSession.conversation_history.length=', newSession.conversation_history?.length || 0
      )

      return Response.json({
        session: newSession,
        status: 'taken_over',
        message: 'Session taken over successfully'
      })
    }

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
          console.error('[mentor-session] Failed to update session:', updateError)
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
        console.error('[mentor-session] Failed to create session:', createError)
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
        session_id: existingSession.session_id,
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

    console.info(
      '[mentor-session] PATCH received:',
      'sessionId=', sessionId,
      'conversationHistory.length=', conversationHistory?.length || 0,
      'draftSummary.length=', draftSummary?.length || 0
    )

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
