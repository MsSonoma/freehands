// Mr. Mentor Session Management API
// Handles session creation, takeover, sync, and deactivation

import { createClient } from '@supabase/supabase-js'
import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
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

const DEVICE_COOKIE_NAME = 'mr_mentor_device_id'
const DEVICE_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365

function parseCookieHeader(cookieHeader) {
  if (!cookieHeader) return {}
  const pairs = cookieHeader.split(';')
  const out = {}
  for (const pair of pairs) {
    const idx = pair.indexOf('=')
    if (idx === -1) continue
    const key = pair.slice(0, idx).trim()
    const val = pair.slice(idx + 1).trim()
    if (!key) continue
    out[key] = val
  }
  return out
}

function getDeviceIdFromRequest(request) {
  try {
    const direct = request?.cookies?.get?.(DEVICE_COOKIE_NAME)?.value
    if (direct) return direct
  } catch {}

  const cookieHeader = request.headers.get('cookie')
  const cookies = parseCookieHeader(cookieHeader)
  const raw = cookies[DEVICE_COOKIE_NAME]
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

function buildDeviceCookieHeader(deviceId) {
  const parts = [
    `${DEVICE_COOKIE_NAME}=${encodeURIComponent(deviceId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${DEVICE_COOKIE_MAX_AGE_S}`
  ]
  if (process.env.NODE_ENV === 'production') {
    parts.push('Secure')
  }
  return parts.join('; ')
}

function jsonWithDeviceCookie({ body, status = 200, deviceCookieHeader }) {
  const headers = deviceCookieHeader ? { 'Set-Cookie': deviceCookieHeader } : undefined
  return Response.json(body, { status, headers })
}

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

export const maxDuration = 60

// GET: Check session status and retrieve active session
export async function GET(request) {
  try {
    const existingDeviceId = getDeviceIdFromRequest(request)
    const deviceId = existingDeviceId || randomUUID()
    const deviceCookieHeader = existingDeviceId ? null : buildDeviceCookieHeader(deviceId)

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonWithDeviceCookie({ body: { error: 'Unauthorized' }, status: 401, deviceCookieHeader })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return jsonWithDeviceCookie({ body: { error: 'Invalid token' }, status: 401, deviceCookieHeader })
    }

    const access = await requireMrMentorAccess(user.id)
    if (!access.allowed) {
      return jsonWithDeviceCookie({ body: { error: 'Pro plan required' }, status: 403, deviceCookieHeader })
    }

    const now = new Date()
    await cleanupStaleSessions({ facilitatorId: user.id, now })

    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    const subjectKey = searchParams.get('subjectKey') || 'facilitator'

    // Get active session for this facilitator
    const { data: sessions, error } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (error) {
      return jsonWithDeviceCookie({ body: { error: 'Database error' }, status: 500, deviceCookieHeader })
    }

    const activeSession = sessions?.[0] || null

    // If no active session, return null
    if (!activeSession) {
      return jsonWithDeviceCookie({
        body: {
          session: null,
          status: 'none'
        },
        status: 200,
        deviceCookieHeader
      })
    }

    // Conversation history is stored in mentor_sessions.conversation_history
    // Don't merge from conversation_drafts - that's for a different purpose
    const isOwner = (activeSession.device_id && activeSession.device_id === deviceId) ||
      (!activeSession.device_id && sessionId && activeSession.session_id === sessionId)

    let conversationThread = null

    if (isOwner) {
      const { data: thread, error: threadError } = await supabase
        .from('mentor_conversation_threads')
        .select('*')
        .eq('facilitator_id', user.id)
        .eq('subject_key', subjectKey)
        .maybeSingle()

      if (!threadError) {
        conversationThread = thread
      }
    }

    const sessionWithConversation = {
      ...activeSession,
      conversation_history: Array.isArray(conversationThread?.conversation_history)
        ? conversationThread.conversation_history
        : [],
      draft_summary: conversationThread?.draft_summary || '',
      token_count: conversationThread?.token_count ?? 0,
      last_local_update_at: conversationThread?.last_local_update_at || activeSession.last_local_update_at || null
    }

    return jsonWithDeviceCookie({
      body: {
        session: sessionWithConversation,
        status: isOwner ? 'active' : 'taken',
        isOwner
      },
      status: 200,
      deviceCookieHeader
    })

  } catch (err) {
    const existingDeviceId = getDeviceIdFromRequest(request)
    const deviceId = existingDeviceId || randomUUID()
    const deviceCookieHeader = existingDeviceId ? null : buildDeviceCookieHeader(deviceId)
    return jsonWithDeviceCookie({ body: { error: 'Internal error' }, status: 500, deviceCookieHeader })
  }
}

// POST: Create or take over session
export async function POST(request) {
  try {
    const existingDeviceId = getDeviceIdFromRequest(request)
    const deviceId = existingDeviceId || randomUUID()
    const deviceCookieHeader = existingDeviceId ? null : buildDeviceCookieHeader(deviceId)

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonWithDeviceCookie({ body: { error: 'Unauthorized' }, status: 401, deviceCookieHeader })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return jsonWithDeviceCookie({ body: { error: 'Invalid token' }, status: 401, deviceCookieHeader })
    }

    const access = await requireMrMentorAccess(user.id)
    if (!access.allowed) {
      return jsonWithDeviceCookie({ body: { error: 'Pro plan required' }, status: 403, deviceCookieHeader })
    }

    const body = await request.json()
    const { deviceName, pinCode, action, targetSessionId, subjectKey } = body || {}

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
      return jsonWithDeviceCookie({ body: { error: 'Database error' }, status: 500, deviceCookieHeader })
    }

    let existingSession = existingSessions?.[0] || null

    if (existingSession && isSessionStale(existingSession, now.getTime())) {
      await deactivateSessionById(existingSession.id)
      existingSession = null
    }

    if (action === 'force_end') {
      if (!pinCode) {
        return jsonWithDeviceCookie({
          body: {
          error: 'PIN required to force end session',
          requiresPin: true
          },
          status: 403,
          deviceCookieHeader
        })
      }

      try {
        const pinValid = await verifyPin(user.id, pinCode)
        if (!pinValid) {
          return jsonWithDeviceCookie({
            body: { error: 'Invalid PIN code', requiresPin: true },
            status: 403,
            deviceCookieHeader
          })
        }
      } catch (pinErr) {
        return jsonWithDeviceCookie({ body: { error: 'Failed to verify PIN' }, status: 500, deviceCookieHeader })
      }

      const targetId = targetSessionId || existingSession?.session_id
      if (!targetId) {
        return jsonWithDeviceCookie({ body: { error: 'No target session available to force end' }, status: 400, deviceCookieHeader })
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
        return jsonWithDeviceCookie({ body: { error: 'Database error' }, status: 500, deviceCookieHeader })
      }

      const targetSession = targetSessions?.[0]
      if (!targetSession) {
        return jsonWithDeviceCookie({ body: { status: 'already_inactive' }, status: 200, deviceCookieHeader })
      }

      const success = await deactivateSessionById(targetSession.id)
      if (!success) {
        return jsonWithDeviceCookie({ body: { error: 'Failed to end session' }, status: 500, deviceCookieHeader })
      }

      return jsonWithDeviceCookie({
        body: { status: 'force_ended', clearedSessionId: targetSession.session_id },
        status: 200,
        deviceCookieHeader
      })
    }

    // If taking over from another device, verify PIN
    // If device_id is missing (legacy rows), we conservatively require PIN for takeover.
    if (existingSession && existingSession.device_id !== deviceId && action === 'takeover') {
      // Verify PIN code
      if (!pinCode) {
        return jsonWithDeviceCookie({
          body: { error: 'PIN required to take over session', requiresPin: true },
          status: 403,
          deviceCookieHeader
        })
      }

      try {
        const pinValid = await verifyPin(user.id, pinCode)
        if (!pinValid) {
          return jsonWithDeviceCookie({
            body: { error: 'Invalid PIN code', requiresPin: true },
            status: 403,
            deviceCookieHeader
          })
        }
      } catch (pinErr) {
        return jsonWithDeviceCookie({
          body: { error: 'Failed to verify PIN', details: pinErr.message },
          status: 500,
          deviceCookieHeader
        })
      }

      // Deactivate old session
      const deactivated = await deactivateSessionById(existingSession.id)

      if (!deactivated) {
        return jsonWithDeviceCookie({ body: { error: 'Failed to deactivate previous session' }, status: 500, deviceCookieHeader })
      }

      const newSessionId = randomUUID()

      // Create new active owner session (conversation lives in mentor_conversation_threads)
      const { data: newSession, error: createError } = await supabase
        .from('mentor_sessions')
        .insert({
          facilitator_id: user.id,
          session_id: newSessionId,
          device_id: deviceId,
          device_name: deviceName || 'Unknown device',
          is_active: true,
          last_activity_at: now.toISOString()
        })
        .select()
        .single()

      if (createError) {
        return jsonWithDeviceCookie({
          body: { error: 'Failed to create session', details: createError.message, code: createError.code },
          status: 500,
          deviceCookieHeader
        })
      }

      console.log('[Takeover API] New session created:', {
        sessionId: newSession.session_id,
        conversationLength: newSession.conversation_history?.length || 0,
        isActive: newSession.is_active
      })

      let thread = null
      if (subjectKey) {
        const { data: threadData, error: threadError } = await supabase
          .from('mentor_conversation_threads')
          .select('*')
          .eq('facilitator_id', user.id)
          .eq('subject_key', subjectKey)
          .maybeSingle()
        if (!threadError) thread = threadData
      }

      const sessionWithConversation = {
        ...newSession,
        conversation_history: Array.isArray(thread?.conversation_history) ? thread.conversation_history : [],
        draft_summary: thread?.draft_summary || '',
        token_count: thread?.token_count ?? 0,
        last_local_update_at: thread?.last_local_update_at || null
      }

      return jsonWithDeviceCookie({
        body: { session: sessionWithConversation, status: 'taken_over', message: 'Session taken over successfully' },
        status: 200,
        deviceCookieHeader
      })
    }

    // If same session is reconnecting or no existing session, create/update
    if (!existingSession || (existingSession.device_id && existingSession.device_id === deviceId)) {
      if (existingSession && existingSession.device_id && existingSession.device_id === deviceId) {
        // Same device reconnecting - just update activity timestamp
        const { data: session, error: updateError } = await supabase
          .from('mentor_sessions')
          .update({
            device_name: deviceName || 'Unknown device',
            device_id: deviceId,
            last_activity_at: now.toISOString()
          })
          .eq('id', existingSession.id)
          .select()
          .single()

        if (updateError) {
          return jsonWithDeviceCookie({ body: { error: 'Failed to update session' }, status: 500, deviceCookieHeader })
        }

        let thread = null
        if (subjectKey) {
          const { data: threadData, error: threadError } = await supabase
            .from('mentor_conversation_threads')
            .select('*')
            .eq('facilitator_id', user.id)
            .eq('subject_key', subjectKey)
            .maybeSingle()
          if (!threadError) thread = threadData
        }

        const sessionWithConversation = {
          ...session,
          conversation_history: Array.isArray(thread?.conversation_history) ? thread.conversation_history : [],
          draft_summary: thread?.draft_summary || '',
          token_count: thread?.token_count ?? 0,
          last_local_update_at: thread?.last_local_update_at || null
        }

        return jsonWithDeviceCookie({
          body: { session: sessionWithConversation, status: 'active' },
          status: 200,
          deviceCookieHeader
        })
      }

      const newSessionId = randomUUID()

      // No existing session - create new one
      const { data: session, error: createError } = await supabase
        .from('mentor_sessions')
        .insert({
          facilitator_id: user.id,
          session_id: newSessionId,
          device_id: deviceId,
          device_name: deviceName || 'Unknown device',
          is_active: true,
          last_activity_at: now.toISOString()
        })
        .select()
        .single()

      if (createError) {
        return jsonWithDeviceCookie({ body: { error: 'Failed to create session' }, status: 500, deviceCookieHeader })
      }

      let thread = null
      if (subjectKey) {
        const { data: threadData, error: threadError } = await supabase
          .from('mentor_conversation_threads')
          .select('*')
          .eq('facilitator_id', user.id)
          .eq('subject_key', subjectKey)
          .maybeSingle()
        if (!threadError) thread = threadData
      }

      const sessionWithConversation = {
        ...session,
        conversation_history: Array.isArray(thread?.conversation_history) ? thread.conversation_history : [],
        draft_summary: thread?.draft_summary || '',
        token_count: thread?.token_count ?? 0,
        last_local_update_at: thread?.last_local_update_at || null
      }

      return jsonWithDeviceCookie({
        body: { session: sessionWithConversation, status: 'active' },
        status: 200,
        deviceCookieHeader
      })
    }

    // Another device has active session - require takeover
    return jsonWithDeviceCookie({
      body: {
        error: 'Another device has an active session',
        requiresPin: true,
        existingSession: {
          session_id: existingSession.session_id,
          device_name: existingSession.device_name,
          last_activity_at: existingSession.last_activity_at
        }
      },
      status: 409,
      deviceCookieHeader
    })

  } catch (err) {
    const existingDeviceId = getDeviceIdFromRequest(request)
    const deviceId = existingDeviceId || randomUUID()
    const deviceCookieHeader = existingDeviceId ? null : buildDeviceCookieHeader(deviceId)
    return jsonWithDeviceCookie({ body: { error: 'Internal error' }, status: 500, deviceCookieHeader })
  }
}

// PATCH: Update session (conversation history, draft summary, last activity)
export async function PATCH(request) {
  try {
    const existingDeviceId = getDeviceIdFromRequest(request)
    const deviceId = existingDeviceId || randomUUID()
    const deviceCookieHeader = existingDeviceId ? null : buildDeviceCookieHeader(deviceId)

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonWithDeviceCookie({ body: { error: 'Unauthorized' }, status: 401, deviceCookieHeader })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return jsonWithDeviceCookie({ body: { error: 'Invalid token' }, status: 401, deviceCookieHeader })
    }

    const access = await requireMrMentorAccess(user.id)
    if (!access.allowed) {
      return jsonWithDeviceCookie({ body: { error: 'Pro plan required' }, status: 403, deviceCookieHeader })
    }

    const body = await request.json()
    const { conversationHistory, draftSummary, tokenCount, lastLocalUpdateAt, subjectKey } = body || {}

    console.log('[PATCH] Received update:', { 
      sessionId, 
      conversationLength: conversationHistory?.length, 
      hasDraft: !!draftSummary,
      tokenCount,
      timestamp: lastLocalUpdateAt
    })

    if (!subjectKey) {
      return jsonWithDeviceCookie({ body: { error: 'subjectKey required' }, status: 400, deviceCookieHeader })
    }

    // Verify there is an active session for this facilitator.
    const { data: sessions, error: activeError } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('facilitator_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)

    if (activeError) {
      return jsonWithDeviceCookie({ body: { error: 'Database error' }, status: 500, deviceCookieHeader })
    }

    const activeSession = sessions?.[0] || null
    if (!activeSession) {
      return jsonWithDeviceCookie({ body: { error: 'Session not active', status: 'inactive' }, status: 410, deviceCookieHeader })
    }

    const isOwner = activeSession.device_id ? activeSession.device_id === deviceId : false
    if (!isOwner) {
      return jsonWithDeviceCookie({ body: { error: 'PIN required', requiresPin: true }, status: 403, deviceCookieHeader })
    }

    const now = new Date()

    // Update session activity timestamp (ownership heartbeat)
    await supabase
      .from('mentor_sessions')
      .update({ last_activity_at: now.toISOString() })
      .eq('id', activeSession.id)

    // Upsert conversation thread for this subject
    const threadUpdates = {
      facilitator_id: user.id,
      subject_key: subjectKey,
      last_activity_at: now.toISOString()
    }

    if (conversationHistory !== undefined) {
      threadUpdates.conversation_history = Array.isArray(conversationHistory) ? conversationHistory : []
    }
    if (draftSummary !== undefined) {
      threadUpdates.draft_summary = draftSummary
    }
    if (tokenCount !== undefined) {
      threadUpdates.token_count = tokenCount
    }
    if (lastLocalUpdateAt) {
      threadUpdates.last_local_update_at = lastLocalUpdateAt
    }

    const { error: threadError } = await supabase
      .from('mentor_conversation_threads')
      .upsert(threadUpdates, { onConflict: 'facilitator_id,subject_key' })

    if (threadError) {
      return jsonWithDeviceCookie({
        body: { error: 'Failed to update conversation', supabaseError: threadError.message || threadError, code: threadError.code },
        status: 500,
        deviceCookieHeader
      })
    }

    return jsonWithDeviceCookie({ body: { success: true }, status: 200, deviceCookieHeader })

  } catch (err) {
    console.error('[PATCH] Error:', err)
    const existingDeviceId = getDeviceIdFromRequest(request)
    const deviceId = existingDeviceId || randomUUID()
    const deviceCookieHeader = existingDeviceId ? null : buildDeviceCookieHeader(deviceId)
    return jsonWithDeviceCookie({ body: { error: 'Internal error', details: err.message }, status: 500, deviceCookieHeader })
  }
}

// DELETE: End session (manual end conversation)
export async function DELETE(request) {
  try {
    const existingDeviceId = getDeviceIdFromRequest(request)
    const deviceId = existingDeviceId || randomUUID()
    const deviceCookieHeader = existingDeviceId ? null : buildDeviceCookieHeader(deviceId)

    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonWithDeviceCookie({ body: { error: 'Unauthorized' }, status: 401, deviceCookieHeader })
    }

    const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return jsonWithDeviceCookie({ body: { error: 'Invalid token' }, status: 401, deviceCookieHeader })
    }

    const access = await requireMrMentorAccess(user.id)
    if (!access.allowed) {
      return jsonWithDeviceCookie({ body: { error: 'Pro plan required' }, status: 403, deviceCookieHeader })
    }

    const { searchParams } = new URL(request.url)
    const subjectKey = searchParams.get('subjectKey')
    const action = searchParams.get('action')

    // If a subjectKey is provided, clear ONLY that conversation thread.
    // This matches the old behavior where deleting the single session cleared the (single) conversation.
    if (subjectKey && (!action || action === 'clear_thread')) {
      const { data: sessions, error: sessionError } = await supabase
        .from('mentor_sessions')
        .select('*')
        .eq('facilitator_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

      if (sessionError) {
        return jsonWithDeviceCookie({ body: { error: 'Database error' }, status: 500, deviceCookieHeader })
      }

      const activeSession = sessions?.[0] || null
      const isOwner = activeSession?.device_id ? activeSession.device_id === deviceId : false
      if (!activeSession) {
        return jsonWithDeviceCookie({ body: { success: true, deletedCount: 0 }, status: 200, deviceCookieHeader })
      }
      if (!isOwner) {
        return jsonWithDeviceCookie({ body: { error: 'PIN required', requiresPin: true }, status: 403, deviceCookieHeader })
      }

      const { data: deletedRows, error: deleteError } = await supabase
        .from('mentor_conversation_threads')
        .delete()
        .eq('facilitator_id', user.id)
        .eq('subject_key', subjectKey)
        .select()

      if (deleteError) {
        return jsonWithDeviceCookie({ body: { error: 'Failed to delete conversation', details: deleteError.message }, status: 500, deviceCookieHeader })
      }

      return jsonWithDeviceCookie({ body: { success: true, deletedCount: deletedRows?.length || 0 }, status: 200, deviceCookieHeader })
    }

    // Otherwise, end the active owner session (lock) for this facilitator.
    const { data: deletedRows, error } = await supabase
      .from('mentor_sessions')
      .delete()
      .eq('facilitator_id', user.id)
      .eq('is_active', true)
      .select()

    if (error) {
      return jsonWithDeviceCookie({ body: { error: 'Failed to delete session', details: error.message }, status: 500, deviceCookieHeader })
    }

    return jsonWithDeviceCookie({ body: { success: true, deletedCount: deletedRows?.length || 0 }, status: 200, deviceCookieHeader })

  } catch (err) {
    const existingDeviceId = getDeviceIdFromRequest(request)
    const deviceId = existingDeviceId || randomUUID()
    const deviceCookieHeader = existingDeviceId ? null : buildDeviceCookieHeader(deviceId)
    return jsonWithDeviceCookie({ body: { error: 'Internal error' }, status: 500, deviceCookieHeader })
  }
}
