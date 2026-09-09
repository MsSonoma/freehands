// Mr. Mentor Session Management API
// Durable conversation threads are independent from the temporary execution-owner lease.

import { createClient } from '@supabase/supabase-js'
import { randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { featuresForTier, resolveEffectiveTier } from '../../lib/entitlements'

export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
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
  const out = {}
  for (const pair of cookieHeader.split(';')) {
    const idx = pair.indexOf('=')
    if (idx === -1) continue
    const key = pair.slice(0, idx).trim()
    const val = pair.slice(idx + 1).trim()
    if (key) out[key] = val
  }
  return out
}

function getDeviceIdFromRequest(request) {
  try {
    const direct = request?.cookies?.get?.(DEVICE_COOKIE_NAME)?.value
    if (direct) return direct
  } catch {}
  const raw = parseCookieHeader(request.headers.get('cookie'))[DEVICE_COOKIE_NAME]
  if (!raw) return null
  try { return decodeURIComponent(raw) } catch { return raw }
}

function buildDeviceCookieHeader(deviceId) {
  const parts = [
    `${DEVICE_COOKIE_NAME}=${encodeURIComponent(deviceId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${DEVICE_COOKIE_MAX_AGE_S}`
  ]
  if (process.env.NODE_ENV === 'production') parts.push('Secure')
  return parts.join('; ')
}

function jsonWithDeviceCookie({ body, status = 200, deviceCookieHeader }) {
  const headers = deviceCookieHeader ? { 'Set-Cookie': deviceCookieHeader } : undefined
  return Response.json(body, { status, headers })
}

async function cleanupStaleSessions({ facilitatorId, now = new Date() } = {}) {
  if (!facilitatorId) return []
  const cutoff = new Date(now.getTime() - SESSION_TIMEOUT_MS).toISOString()
  const { data, error } = await supabase
    .from('mentor_sessions')
    .update({ is_active: false, ended_reason: 'expired' })
    .eq('facilitator_id', facilitatorId)
    .eq('is_active', true)
    .lt('last_activity_at', cutoff)
    .select('id, session_id, ended_reason')
  return error ? [] : (data || [])
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
  try { return timingSafeEqual(Buffer.from(recomputed), Buffer.from(stored)) } catch { return false }
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
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('facilitator_pin_hash')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  if (!profile?.facilitator_pin_hash) return false
  return verifyPinHash(pinCode, profile.facilitator_pin_hash)
}

async function authenticate(request, deviceCookieHeader) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { response: jsonWithDeviceCookie({ body: { error: 'Unauthorized' }, status: 401, deviceCookieHeader }) }
  }
  const token = authHeader.substring(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return { response: jsonWithDeviceCookie({ body: { error: 'Invalid token' }, status: 401, deviceCookieHeader }) }
  }
  const access = await requireMrMentorAccess(user.id)
  if (!access.allowed) {
    return { response: jsonWithDeviceCookie({ body: { error: 'Pro plan required' }, status: 403, deviceCookieHeader }) }
  }
  return { user, access }
}

async function loadThread(facilitatorId, subjectKey) {
  if (!subjectKey) return null
  const { data, error } = await supabase
    .from('mentor_conversation_threads')
    .select('*')
    .eq('facilitator_id', facilitatorId)
    .eq('subject_key', subjectKey)
    .maybeSingle()
  return error ? null : data
}

function withConversation(session, thread) {
  if (!session) return null
  return {
    ...session,
    conversation_history: Array.isArray(thread?.conversation_history) ? thread.conversation_history : [],
    draft_summary: thread?.draft_summary || '',
    token_count: thread?.token_count ?? 0,
    last_local_update_at: thread?.last_local_update_at || session.last_local_update_at || null
  }
}

function publicConflict(session) {
  if (!session) return null
  return {
    id: session.id,
    session_id: session.session_id,
    device_name: session.device_name,
    last_activity_at: session.last_activity_at,
    created_at: session.created_at
  }
}

async function acquireSession({ facilitatorId, sessionId, deviceId, deviceName, allowTakeover, expectedConflictId }) {
  const { data, error } = await supabase.rpc('acquire_mentor_session_transactional', {
    p_facilitator_id: facilitatorId,
    p_session_id: sessionId,
    p_device_id: deviceId,
    p_device_name: deviceName || 'Unknown device',
    p_allow_takeover: !!allowTakeover,
    p_expected_conflicting_session_id: expectedConflictId || null,
    p_timeout_minutes: SESSION_TIMEOUT_MINUTES
  })
  if (error) throw error
  return data || { ok: false, state: 'unknown' }
}

function ownershipFailureResponse(result, deviceCookieHeader) {
  const endedReason = result?.endedReason || result?.ended_reason || null
  const state = result?.state || 'ownership_lost'
  const inactive = state === 'ended' || state === 'missing'
  return jsonWithDeviceCookie({
    body: {
      error: 'Mr. Mentor execution ownership was lost',
      code: 'MENTOR_OWNERSHIP_LOST',
      state,
      endedReason
    },
    status: inactive ? 410 : 409,
    deviceCookieHeader
  })
}

// GET: Read the temporary execution owner. Conversation data is returned only to the exact owner tab.
export async function GET(request) {
  const existingDeviceId = getDeviceIdFromRequest(request)
  const deviceId = existingDeviceId || randomUUID()
  const deviceCookieHeader = existingDeviceId ? null : buildDeviceCookieHeader(deviceId)
  try {
    const auth = await authenticate(request, deviceCookieHeader)
    if (auth.response) return auth.response

    await cleanupStaleSessions({ facilitatorId: auth.user.id })

    const { searchParams } = new URL(request.url)
    const sessionId = String(searchParams.get('sessionId') || '').trim()
    const subjectKey = String(searchParams.get('subjectKey') || 'facilitator').trim() || 'facilitator'

    const { data: sessions, error } = await supabase
      .from('mentor_sessions')
      .select('*')
      .eq('facilitator_id', auth.user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
    if (error) return jsonWithDeviceCookie({ body: { error: 'Database error' }, status: 500, deviceCookieHeader })

    const activeSession = sessions?.[0] || null
    if (!activeSession) {
      return jsonWithDeviceCookie({ body: { session: null, status: 'none', isOwner: false }, deviceCookieHeader })
    }

    const isOwner = !!sessionId && activeSession.session_id === sessionId && activeSession.device_id === deviceId
    let ownerSession = activeSession
    if (isOwner) {
      const { data: heartbeat, error: heartbeatError } = await supabase.rpc('heartbeat_mentor_session', {
        p_facilitator_id: auth.user.id,
        p_session_id: sessionId,
        p_device_id: deviceId
      })
      if (heartbeatError) return jsonWithDeviceCookie({ body: { error: 'Heartbeat failed' }, status: 500, deviceCookieHeader })
      if (!heartbeat?.active) return ownershipFailureResponse(heartbeat, deviceCookieHeader)
      ownerSession = heartbeat.session || activeSession
    }
    const thread = isOwner ? await loadThread(auth.user.id, subjectKey) : null
    return jsonWithDeviceCookie({
      body: {
        session: withConversation(ownerSession, thread),
        status: isOwner ? 'active' : 'taken',
        isOwner
      },
      deviceCookieHeader
    })
  } catch (err) {
    console.error('[mentor-session GET]', err)
    return jsonWithDeviceCookie({ body: { error: 'Internal error' }, status: 500, deviceCookieHeader })
  }
}

// POST: Acquire, resume, take over, or force-end the temporary execution lock.
export async function POST(request) {
  const existingDeviceId = getDeviceIdFromRequest(request)
  const deviceId = existingDeviceId || randomUUID()
  const deviceCookieHeader = existingDeviceId ? null : buildDeviceCookieHeader(deviceId)
  try {
    const auth = await authenticate(request, deviceCookieHeader)
    if (auth.response) return auth.response

    const body = await request.json()
    const action = String(body?.action || 'initialize')
    const deviceName = String(body?.deviceName || 'Unknown device')
    const subjectKey = String(body?.subjectKey || 'facilitator').trim() || 'facilitator'
    const requestedSessionId = String(body?.sessionId || '').trim() || randomUUID()

    if (action === 'force_end') {
      if (!body?.pinCode) {
        return jsonWithDeviceCookie({ body: { error: 'PIN required to force end session', requiresPin: true }, status: 403, deviceCookieHeader })
      }
      if (!(await verifyPin(auth.user.id, body.pinCode))) {
        return jsonWithDeviceCookie({ body: { error: 'Invalid PIN code', requiresPin: true }, status: 403, deviceCookieHeader })
      }
      const target = String(body?.targetSessionId || '').trim()
      const { data: sessions, error } = await supabase
        .from('mentor_sessions')
        .select('id, session_id, is_active')
        .eq('facilitator_id', auth.user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
      if (error) return jsonWithDeviceCookie({ body: { error: 'Database error' }, status: 500, deviceCookieHeader })
      const current = sessions?.[0] || null
      if (!current || (target && target !== current.id && target !== current.session_id)) {
        return jsonWithDeviceCookie({ body: { status: 'already_inactive' }, deviceCookieHeader })
      }
      const { error: endError } = await supabase
        .from('mentor_sessions')
        .update({ is_active: false, ended_reason: 'force_ended', last_activity_at: new Date().toISOString() })
        .eq('id', current.id)
        .eq('is_active', true)
      if (endError) return jsonWithDeviceCookie({ body: { error: 'Failed to end session' }, status: 500, deviceCookieHeader })
      return jsonWithDeviceCookie({ body: { status: 'force_ended', clearedSessionId: current.session_id }, deviceCookieHeader })
    }

    const takingOver = action === 'takeover'
    let expectedConflictId = null
    if (takingOver) {
      if (!body?.pinCode) {
        return jsonWithDeviceCookie({ body: { error: 'PIN required to take over session', requiresPin: true }, status: 403, deviceCookieHeader })
      }
      if (!(await verifyPin(auth.user.id, body.pinCode))) {
        return jsonWithDeviceCookie({ body: { error: 'Invalid PIN code', requiresPin: true }, status: 403, deviceCookieHeader })
      }
      expectedConflictId = String(body?.expectedConflictId || '').trim() || null
      if (!expectedConflictId) {
        return jsonWithDeviceCookie({ body: { error: 'Expected conflicting session identity required' }, status: 409, deviceCookieHeader })
      }
    }

    const result = await acquireSession({
      facilitatorId: auth.user.id,
      sessionId: requestedSessionId,
      deviceId,
      deviceName,
      allowTakeover: takingOver,
      expectedConflictId
    })

    if (!result?.ok) {
      const existingSession = result?.existingSession || null
      return jsonWithDeviceCookie({
        body: {
          error: result?.state === 'stale_conflict' ? 'The conflicting Mentor session changed. Refresh and try again.' : 'Another tab or device has an active Mr. Mentor session',
          code: result?.state === 'stale_conflict' ? 'MENTOR_STALE_CONFLICT' : 'MENTOR_CONFLICT',
          requiresPin: true,
          state: result?.state || 'conflict',
          existingSession: publicConflict(existingSession)
        },
        status: 409,
        deviceCookieHeader
      })
    }

    const thread = await loadThread(auth.user.id, subjectKey)
    const session = withConversation(result.session, thread)
    return jsonWithDeviceCookie({
      body: {
        session,
        status: result.state === 'taken_over' ? 'taken_over' : 'active',
        isOwner: true,
        message: result.state === 'taken_over' ? 'Session taken over successfully' : undefined
      },
      deviceCookieHeader
    })
  } catch (err) {
    console.error('[mentor-session POST]', err)
    return jsonWithDeviceCookie({ body: { error: 'Internal error', details: err?.message }, status: 500, deviceCookieHeader })
  }
}

// PATCH: Atomically fence the durable thread write behind the exact active owner tab.
export async function PATCH(request) {
  const existingDeviceId = getDeviceIdFromRequest(request)
  const deviceId = existingDeviceId || randomUUID()
  const deviceCookieHeader = existingDeviceId ? null : buildDeviceCookieHeader(deviceId)
  try {
    const auth = await authenticate(request, deviceCookieHeader)
    if (auth.response) return auth.response

    const body = await request.json()
    const sessionId = String(body?.sessionId || '').trim()
    const subjectKey = String(body?.subjectKey || '').trim()
    if (!sessionId) return jsonWithDeviceCookie({ body: { error: 'sessionId required' }, status: 400, deviceCookieHeader })
    if (!subjectKey) return jsonWithDeviceCookie({ body: { error: 'subjectKey required' }, status: 400, deviceCookieHeader })

    const existingThread = await loadThread(auth.user.id, subjectKey)
    const conversationHistory = body?.conversationHistory !== undefined
      ? (Array.isArray(body.conversationHistory) ? body.conversationHistory : [])
      : (Array.isArray(existingThread?.conversation_history) ? existingThread.conversation_history : [])
    const draftSummary = body?.draftSummary !== undefined ? String(body.draftSummary || '') : (existingThread?.draft_summary || '')
    const tokenCount = body?.tokenCount !== undefined ? Number(body.tokenCount || 0) : Number(existingThread?.token_count || 0)
    const lastLocalUpdateAt = body?.lastLocalUpdateAt || existingThread?.last_local_update_at || new Date().toISOString()

    const { data, error } = await supabase.rpc('write_mentor_thread_owned_transactional', {
      p_facilitator_id: auth.user.id,
      p_session_id: sessionId,
      p_device_id: deviceId,
      p_subject_key: subjectKey,
      p_conversation_history: conversationHistory,
      p_draft_summary: draftSummary,
      p_token_count: Number.isFinite(tokenCount) ? tokenCount : 0,
      p_last_local_update_at: lastLocalUpdateAt
    })
    if (error) throw error
    if (!data?.ok) return ownershipFailureResponse(data, deviceCookieHeader)

    return jsonWithDeviceCookie({ body: { success: true, state: data.state, last_activity_at: data.last_activity_at }, deviceCookieHeader })
  } catch (err) {
    console.error('[mentor-session PATCH]', err)
    return jsonWithDeviceCookie({ body: { error: 'Internal error', details: err?.message }, status: 500, deviceCookieHeader })
  }
}

// DELETE: clear one durable thread or release only the exact owner execution lease.
export async function DELETE(request) {
  const existingDeviceId = getDeviceIdFromRequest(request)
  const deviceId = existingDeviceId || randomUUID()
  const deviceCookieHeader = existingDeviceId ? null : buildDeviceCookieHeader(deviceId)
  try {
    const auth = await authenticate(request, deviceCookieHeader)
    if (auth.response) return auth.response

    const { searchParams } = new URL(request.url)
    const sessionId = String(searchParams.get('sessionId') || '').trim()
    const subjectKey = String(searchParams.get('subjectKey') || '').trim()
    const action = String(searchParams.get('action') || '')
    if (!sessionId) return jsonWithDeviceCookie({ body: { error: 'sessionId required' }, status: 400, deviceCookieHeader })

    if (subjectKey && (!action || action === 'clear_thread')) {
      const { data, error } = await supabase.rpc('clear_mentor_thread_owned_transactional', {
        p_facilitator_id: auth.user.id,
        p_session_id: sessionId,
        p_device_id: deviceId,
        p_subject_key: subjectKey
      })
      if (error) throw error
      if (!data?.ok) return ownershipFailureResponse(data, deviceCookieHeader)
      return jsonWithDeviceCookie({ body: { success: true, deletedCount: data.deletedCount || 0 }, deviceCookieHeader })
    }

    const { data, error } = await supabase.rpc('release_mentor_session_owned_transactional', {
      p_facilitator_id: auth.user.id,
      p_session_id: sessionId,
      p_device_id: deviceId
    })
    if (error) throw error
    if (!data?.ok) return ownershipFailureResponse(data, deviceCookieHeader)
    return jsonWithDeviceCookie({ body: { success: true, state: data.state }, deviceCookieHeader })
  } catch (err) {
    console.error('[mentor-session DELETE]', err)
    return jsonWithDeviceCookie({ body: { error: 'Internal error', details: err?.message }, status: 500, deviceCookieHeader })
  }
}
