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

    // Check for Premium tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_tier')
      .eq('id', user.id)
      .maybeSingle()
    
    const planTier = (profile?.plan_tier || 'free').toLowerCase()
    if (planTier !== 'premium' && planTier !== 'premium-plus' && planTier !== 'lifetime') {
      return Response.json({ error: 'Premium plan required' }, { status: 403 })
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

    // Check if the requesting session is the active one
    const isOwner = activeSession.session_id === sessionId

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

    // Check for Premium tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_tier')
      .eq('id', user.id)
      .maybeSingle()
    
    const planTier = (profile?.plan_tier || 'free').toLowerCase()
    if (planTier !== 'premium' && planTier !== 'premium-plus' && planTier !== 'lifetime') {
      return Response.json({ error: 'Premium plan required' }, { status: 403 })
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

      try {
        const pinValid = await verifyPin(user.id, pinCode)
        if (!pinValid) {
          return Response.json({
            error: 'Invalid PIN code',
            requiresPin: true
          }, { status: 403 })
        }
      } catch (pinErr) {
        return Response.json({ 
          error: 'Failed to verify PIN', 
          details: pinErr.message 
        }, { status: 500 })
      }

      // PIN validated, copy conversation from existing session
      const conversationToCopy = existingSession.conversation_history || []
      const draftSummaryToCopy = existingSession.draft_summary || ''

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

    // Check for Premium tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_tier')
      .eq('id', user.id)
      .maybeSingle()
    
    const planTier = (profile?.plan_tier || 'free').toLowerCase()
    if (planTier !== 'premium' && planTier !== 'premium-plus' && planTier !== 'lifetime') {
      return Response.json({ error: 'Premium plan required' }, { status: 403 })
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

    if (tokenCount !== undefined) {
      updates.token_count = tokenCount
    }

    // Add client timestamp if provided
    // TODO: Uncomment after migration deployed (adds last_local_update_at column)
    // if (lastLocalUpdateAt) {
    //   updates.last_local_update_at = lastLocalUpdateAt
    // }

    const { error: updateError } = await supabase
      .from('mentor_sessions')
      .update(updates)
      .eq('id', session.id)

    console.log('[PATCH] Update result:', { error: updateError, updates })

    if (updateError) {
      return Response.json({ error: 'Failed to update session' }, { status: 500 })
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

    // Check for Premium tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan_tier')
      .eq('id', user.id)
      .maybeSingle()
    
    const planTier = (profile?.plan_tier || 'free').toLowerCase()
    if (planTier !== 'premium' && planTier !== 'premium-plus' && planTier !== 'lifetime') {
      return Response.json({ error: 'Premium plan required' }, { status: 403 })
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
      return Response.json({ error: 'Failed to end session' }, { status: 500 })
    }

    return Response.json({ success: true })

  } catch (err) {
    return Response.json({ error: 'Internal error' }, { status: 500 })
  }
}
