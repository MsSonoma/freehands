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

### 3. src/app/api/mentor-session/route.js (69d63aea360f4808d2ff3ca73fb3414be72fd128437fe02de0a46d26dc7c39c3)
- bm25: -17.0068 | entity_overlap_w: 4.00 | adjusted: -18.0068 | relevance: 1.0000

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

### 4. src/app/api/mentor-session/route.js (db7d65cfdea6e1a307048bbac453e8b202e2c2d9bacf853983bae8dbe1bac88d)
- bm25: -16.6184 | entity_overlap_w: 4.30 | adjusted: -17.6934 | relevance: 1.0000

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

### 5. src/app/api/mentor-session/route.js (3958ad66d31fdd366c1afdd1ece82c7e35fc29dcb9d61e6315a71a4c7ae49d10)
- bm25: -17.3259 | entity_overlap_w: 1.30 | adjusted: -17.6509 | relevance: 1.0000

if (action === 'force_end') {
      if (!pinCode) {
        return Response.json({
          error: 'PIN required to force end session',
          requiresPin: true
        }, { status: 403 })
      }

### 6. sidekick_pack_api_mentor_session.md (5388e78bba3c5d5c4ba59b06b030271c9ebca9ffc6db3797c2d5648e94849b7c)
- bm25: -15.3720 | entity_overlap_w: 9.00 | adjusted: -17.6220 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Where is /api/mentor-session implemented? Show route file and how it determines isOwner, session conflict, deviceName, is_active, facilitator_id. Also where SessionTakeoverDialog calls takeover endpoint.
```

Filter terms used:
```text
/api/mentor-session
facilitator_id
is_active
SessionTakeoverDialog
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/mentor-session facilitator_id is_active SessionTakeoverDialog

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_takeover.md (d2b72071b1a2c2c6817565e96ed76f09ce317391276449fdde4792537f9e2326)
- bm25: -17.1695 | entity_overlap_w: 10.50 | adjusted: -19.7945 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Locate and fix takeover ownership: clearPersistedSessionIdentifier initializedSessionIdRef SessionTakeoverDialog /api/mentor-session handleSessionTakeover isOwner session_id is_active. Also locate how counselor conversations are keyed vs selectedLearnerId.
```

Filter terms used:
```text
/api/mentor-session
is_active
session_id
SessionTakeoverDialog
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/mentor-session is_active session_id SessionTakeoverDialog

## Forced Context

(none)

## Ranked Evidence

### 7. src/app/api/mentor-session/route.js (0b8fb24bee229b470cdaf5c432acf35ae2a5a6cb8691f1c246836018a5951fda)
- bm25: -16.5763 | entity_overlap_w: 2.60 | adjusted: -17.2263 | relevance: 1.0000

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

### 8. src/app/api/mentor-session/route.js (adfb74802203806f9dd3f9f3942b3cab5e250bace28553cfd8c279f424a82c64)
- bm25: -14.1610 | entity_overlap_w: 2.30 | adjusted: -14.7360 | relevance: 1.0000

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

### 9. src/app/api/mentor-session/route.js (3d522ad63d91422ab388d5aae24d897f24bcd44cb1026f48bc108ca0ba8b6cd7)
- bm25: -14.6915 | relevance: 1.0000

export const maxDuration = 60

### 10. src/app/api/mentor-session/route.js (46494cc702c4a2148df586a477d0e85379e6bdd0af7f5b7d39f25aebbbe02c46)
- bm25: -13.9801 | entity_overlap_w: 2.00 | adjusted: -14.4801 | relevance: 1.0000

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

### 12. src/app/api/mentor-session/route.js (a32ee1aeb5f6c84f6115cf947944bd0643fb288fd1cf2bfcf7cdae9d1ef28362)
- bm25: -14.1657 | relevance: 1.0000

return Response.json({
        session: newSession,
        status: 'taken_over',
        message: 'Session taken over successfully'
      })
    }

### 13. src/app/api/mentor-session/route.js (87c713d343af23c78bf234a4045be4e2bf1085e19cd8944f123afcb53683ebf6)
- bm25: -14.0730 | relevance: 1.0000

const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

### 14. src/app/api/mentor-session/route.js (0a6cccf41da3e43828f1c52ec42818af709685763dbe41129b6e7c5ff2f91757)
- bm25: -13.9296 | relevance: 1.0000

if (!session) {
      return Response.json({ 
        error: 'Session not active or not found',
        status: 'inactive'
      }, { status: 410 })
    }

### 15. src/app/api/mentor-session/route.js (e85fb717ac5c44914b28a858c82b08f67ef923f3da63a08194f8e932da4f6f06)
- bm25: -13.8225 | relevance: 1.0000

// Check if this device owns the active session by comparing session IDs
    const isOwner = activeSession.session_id === sessionId

### 16. sidekick_pack_api_mentor_session.md (ab9dd909eefc0b62a0a2ba26a76d869ff384a78216e0798372cf19d1e7931cfc)
- bm25: -12.4839 | entity_overlap_w: 5.10 | adjusted: -13.7589 | relevance: 1.0000

### 14. src/app/api/lesson-schedule/route.js (4e331f192a6c56a4cab8c5f7afbe0982981f3bd236880d62edeea56744dbb7e2)
- bm25: -4.5145 | entity_overlap_w: 3.00 | adjusted: -5.2645 | relevance: 1.0000

// Default behavior: prefer facilitator-scoped schedule rows, plus safe legacy rows where facilitator_id is null.
    // Overlay/debug callers can pass includeAll=1 to retrieve all schedule rows for an owned learner.
    if (!includeAll) {
      query = query.or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
    }

### 15. src/app/facilitator/generator/counselor/CounselorClient.jsx (7f24f606713fe057f3639dfcd7185ba8520b02c89dfca12e296b9c06293ca12f)
- bm25: -4.4968 | entity_overlap_w: 1.50 | adjusted: -4.8718 | relevance: 1.0000

if (!isMountedRef.current) {
        return
      }

const { session: activeSession, status, isOwner } = payload || {}

console.log('[Mr. Mentor] Session check:', {
        hasActiveSession: !!activeSession,
        status,
        isOwner,
        willShowTakeover: !isOwner && !!activeSession
      })

if (!activeSession || status === 'none') {
        const deviceName = `${navigator.platform || 'Unknown'} - ${navigator.userAgent.split(/[()]/)[1] || 'Browser'}`
        const createRes = await fetch('/api/mentor-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            sessionId,
            deviceName,
            action: 'initialize'
          })
        })

const createData = await createRes.json().catch(() => ({}))

if (!createRes.ok) {
          throw new Error(createData?.error || 'Failed to initialize mentor session')
        }

const createdSession = createData.session || createData

### 17. sidekick_pack_api_mentor_session.md (49adbe3477aa172fbaeb0bd824f932c343e207440eca49fa98f6cec3e246f80d)
- bm25: -11.2337 | entity_overlap_w: 9.00 | adjusted: -13.4837 | relevance: 1.0000

### 2. src/app/facilitator/generator/counselor/CounselorClient.jsx (db827adc4693207e19a47c4b31312ea3d57b04d11af0203344c71672cbea8cbf)
- bm25: -11.1610 | entity_overlap_w: 3.00 | adjusted: -11.9110 | relevance: 1.0000

console.log('[Realtime] Session update detected:', { 
          updatedSessionId: updatedSession.session_id, 
          mySessionId: sessionId,
          isActive: updatedSession.is_active,
          wasActive: oldSession.is_active,
          facilitatorId: updatedSession.facilitator_id,
          deviceName: updatedSession.device_name
        })

### 3. sidekick_pack_takeover.md (c5953ecd074d6911600dcc7cd6abbba9e144f4ee7eaac0a4d6ac4c3fbfb45356)
- bm25: -10.7253 | entity_overlap_w: 4.50 | adjusted: -11.8503 | relevance: 1.0000

### 3. src/app/facilitator/generator/counselor/CounselorClient.jsx (db827adc4693207e19a47c4b31312ea3d57b04d11af0203344c71672cbea8cbf)
- bm25: -13.7968 | entity_overlap_w: 3.00 | adjusted: -14.5468 | relevance: 1.0000

console.log('[Realtime] Session update detected:', { 
          updatedSessionId: updatedSession.session_id, 
          mySessionId: sessionId,
          isActive: updatedSession.is_active,
          wasActive: oldSession.is_active,
          facilitatorId: updatedSession.facilitator_id,
          deviceName: updatedSession.device_name
        })

### 4. src/app/facilitator/generator/counselor/CounselorClient.jsx (7f24f606713fe057f3639dfcd7185ba8520b02c89dfca12e296b9c06293ca12f)
- bm25: -10.4296 | entity_overlap_w: 4.50 | adjusted: -11.5546 | relevance: 1.0000

if (!isMountedRef.current) {
        return
      }

const { session: activeSession, status, isOwner } = payload || {}

### 18. sidekick_pack_planned_all.md (79af748cc863cfa32eda062671f812e41cf02adf095a46eb36bd42871ec402a0)
- bm25: -11.9867 | entity_overlap_w: 5.40 | adjusted: -13.3367 | relevance: 1.0000

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

### 19. sidekick_pack_api_mentor_session.md (9a680818701e676ef57288063ddbf9e28de95ec234588d6ce41cc72af8299a96)
- bm25: -11.7948 | entity_overlap_w: 4.20 | adjusted: -12.8448 | relevance: 1.0000

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

### 26. src/app/api/planned-lessons/route.js (15656ce650d24fdeb4fda70bfd25cc8bd17794cf1e124b01b93a1b3280f5fd24)
- bm25: -3.8593 | entity_overlap_w: 1.00 | adjusted: -4.1093 | relevance: 1.0000

const allRows = Array.isArray(fallback.data) ? fallback.data : []
        const distinctFacilitators = Array.from(
          new Set(allRows.map(r => r?.facilitator_id).filter(Boolean))
        )

### 27. sidekick_pack_planned_all.md (5e701235b462b53d4fa20568cdfcc32f504bdbd5e6b2f81ac78a5bb3f6647c99)
- bm25: -3.3349 | entity_overlap_w: 3.00 | adjusted: -4.0849 | relevance: 1.0000

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

### 20. sidekick_pack_api_mentor_session.md (2b1d53bf4856f429b237f5c2eba3881b13b044e01c166bd29f4cbd3a216af661)
- bm25: -11.9159 | entity_overlap_w: 3.20 | adjusted: -12.7159 | relevance: 1.0000

### 37. src/app/api/planned-lessons/route.js (0cb34597997923379f49f1a5824d6852b3ad04d47f6f03a6981194ba09861b6b)
- bm25: -3.5216 | entity_overlap_w: 1.00 | adjusted: -3.7716 | relevance: 1.0000

// Verify the learner belongs to this facilitator/owner
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 38. sidekick_pack_takeover.md (ea828774f1131ea6f2317efabbac4596bdf128f70ff03d1758deadd5cd1aca30)
- bm25: -3.3936 | entity_overlap_w: 1.50 | adjusted: -3.7686 | relevance: 1.0000

if (!resolvedId) {
      resolvedId = generateSessionIdentifier()
    }

### 11. src/app/api/learner/lesson-history/route.js (5a218f2a3961460c8101e0ab3f4ddd93851d72b79a01f8c880344a7204fefe39)
- bm25: -7.6764 | entity_overlap_w: 2.00 | adjusted: -8.1764 | relevance: 1.0000

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

### 21. src/app/api/mentor-session/route.js (a35cf334171c13312e31e3a837acf94d5ed0fc2b2b550c703de719e2385bfa99)
- bm25: -12.1950 | entity_overlap_w: 2.00 | adjusted: -12.6950 | relevance: 1.0000

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

### 24. src/app/api/mentor-session/route.js (c309c3f6c03f88363fbb6ec9f6571e1e777467a6745b3a2951a95283251d1a9d)
- bm25: -12.4507 | relevance: 1.0000

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

### 26. src/app/facilitator/generator/counselor/CounselorClient.jsx (32b69638a7470372b35d616ad94782f1b5cf5cc4a395ed2d22d03ef4d16b6ab9)
- bm25: -10.9894 | entity_overlap_w: 5.30 | adjusted: -12.3144 | relevance: 1.0000

// Check if THIS session was deactivated (taken over)
        if (updatedSession.session_id === sessionId && oldSession.is_active && !updatedSession.is_active) {
          console.log('[Realtime] THIS SESSION taken over - showing PIN overlay')
          
          // Clear persisted session ID so next load generates a new one
          clearPersistedSessionIdentifier()
          initializedSessionIdRef.current = null
          
          // Clear conversation state
          setConversationHistory([])
          setDraftSummary('')
          setCurrentSessionTokens(0)
          setSessionStarted(false)
          setSessionLoading(false)
          
          // Fetch the active session to show in takeover dialog
          ;(async () => {
            try {
              const checkRes = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              })
              if (checkRes.ok) {
                const checkData = await checkRes.json()
                if (checkData.session) {
                  setConflictingSession(checkData.session)
                }
              }
            } catch (err) {
              console.error('[Realtime] Failed to fetch active session:', err)
            }
          })()
          
          setShowTakeoverDialog(true)
        } else {
          console.log('[Realtime] Update is for different session or not a takeover:', {
            isSameSession: updatedSession.session_id === sessionId,
            wasActive: oldSession.is_active,
            isActive: updatedSession.is_active
          })
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

### 27. sidekick_pack_api_mentor_session.md (0b07397d0162e4e74dfb24a34e8e1978524efdadcf9bd30ff5ae8ad33aad76b8)
- bm25: -10.9034 | entity_overlap_w: 5.30 | adjusted: -12.2284 | relevance: 1.0000

// Check if THIS session was deactivated (taken over)
        if (updatedSession.session_id === sessionId && oldSession.is_active && !updatedSession.is_active) {
          console.log('[Realtime] THIS SESSION taken over - showing PIN overlay')
          
          // Clear persisted session ID so next load generates a new one
          clearPersistedSessionIdentifier()
          initializedSessionIdRef.current = null
          
          // Clear conversation state
          setConversationHistory([])
          setDraftSummary('')
          setCurrentSessionTokens(0)
          setSessionStarted(false)
          setSessionLoading(false)
          
          // Fetch the active session to show in takeover dialog
          ;(async () => {
            try {
              const checkRes = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              })
              if (checkRes.ok) {
                const checkData = await checkRes.json()
                if (checkData.session) {
                  setConflictingSession(checkData.session)
                }
              }
            } catch (err) {
              console.error('[Realtime] Failed to fetch active session:', err)
            }
          })()
          
          setShowTakeoverDialog(true)
        } else {
          console.log('[Realtime] Update is for different session or not a takeover:', {
            isSameSession: updatedSession.session_id === sessionId,
            wasActive: oldSession.is_active,
            isActive: updatedSession.is_active
          })
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

### 28. sidekick_pack_api_mentor_session.md (6fd9782d11ce1df4be2f0dd97be736e1c9ab217b9d12835a7525737dcd99559a)
- bm25: -10.9034 | entity_overlap_w: 5.30 | adjusted: -12.2284 | relevance: 1.0000

// Check if THIS session was deactivated (taken over)
        if (updatedSession.session_id === sessionId && oldSession.is_active && !updatedSession.is_active) {
          console.log('[Realtime] THIS SESSION taken over - showing PIN overlay')
          
          // Clear persisted session ID so next load generates a new one
          clearPersistedSessionIdentifier()
          initializedSessionIdRef.current = null
          
          // Clear conversation state
          setConversationHistory([])
          setDraftSummary('')
          setCurrentSessionTokens(0)
          setSessionStarted(false)
          setSessionLoading(false)
          
          // Fetch the active session to show in takeover dialog
          ;(async () => {
            try {
              const checkRes = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              })
              if (checkRes.ok) {
                const checkData = await checkRes.json()
                if (checkData.session) {
                  setConflictingSession(checkData.session)
                }
              }
            } catch (err) {
              console.error('[Realtime] Failed to fetch active session:', err)
            }
          })()
          
          setShowTakeoverDialog(true)
        } else {
          console.log('[Realtime] Update is for different session or not a takeover:', {
            isSameSession: updatedSession.session_id === sessionId,
            wasActive: oldSession.is_active,
            isActive: updatedSession.is_active
          })
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

### 29. sidekick_pack_api_mentor_session.md (86c4d63b1f02930bc7705805084573d7746bb8fed142112a9b0d9bf4b948236f)
- bm25: -10.9034 | entity_overlap_w: 5.30 | adjusted: -12.2284 | relevance: 1.0000

// Check if THIS session was deactivated (taken over)
        if (updatedSession.session_id === sessionId && oldSession.is_active && !updatedSession.is_active) {
          console.log('[Realtime] THIS SESSION taken over - showing PIN overlay')
          
          // Clear persisted session ID so next load generates a new one
          clearPersistedSessionIdentifier()
          initializedSessionIdRef.current = null
          
          // Clear conversation state
          setConversationHistory([])
          setDraftSummary('')
          setCurrentSessionTokens(0)
          setSessionStarted(false)
          setSessionLoading(false)
          
          // Fetch the active session to show in takeover dialog
          ;(async () => {
            try {
              const checkRes = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              })
              if (checkRes.ok) {
                const checkData = await checkRes.json()
                if (checkData.session) {
                  setConflictingSession(checkData.session)
                }
              }
            } catch (err) {
              console.error('[Realtime] Failed to fetch active session:', err)
            }
          })()
          
          setShowTakeoverDialog(true)
        } else {
          console.log('[Realtime] Update is for different session or not a takeover:', {
            isSameSession: updatedSession.session_id === sessionId,
            wasActive: oldSession.is_active,
            isActive: updatedSession.is_active
          })
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

### 30. sidekick_pack_api_mentor_session.md (96dd70fbf610e19a70aa19d80a43db2e6874c97f860075c9ca5ec98ba700cb79)
- bm25: -10.9034 | entity_overlap_w: 5.30 | adjusted: -12.2284 | relevance: 1.0000

// Check if THIS session was deactivated (taken over)
        if (updatedSession.session_id === sessionId && oldSession.is_active && !updatedSession.is_active) {
          console.log('[Realtime] THIS SESSION taken over - showing PIN overlay')
          
          // Clear persisted session ID so next load generates a new one
          clearPersistedSessionIdentifier()
          initializedSessionIdRef.current = null
          
          // Clear conversation state
          setConversationHistory([])
          setDraftSummary('')
          setCurrentSessionTokens(0)
          setSessionStarted(false)
          setSessionLoading(false)
          
          // Fetch the active session to show in takeover dialog
          ;(async () => {
            try {
              const checkRes = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              })
              if (checkRes.ok) {
                const checkData = await checkRes.json()
                if (checkData.session) {
                  setConflictingSession(checkData.session)
                }
              }
            } catch (err) {
              console.error('[Realtime] Failed to fetch active session:', err)
            }
          })()
          
          setShowTakeoverDialog(true)
        } else {
          console.log('[Realtime] Update is for different session or not a takeover:', {
            isSameSession: updatedSession.session_id === sessionId,
            wasActive: oldSession.is_active,
            isActive: updatedSession.is_active
          })
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

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

let existingSession = existingSessions?.[0] || null

if (existingSession && isSessionStale(existingSession, now.getTime())) {
      await deactivateSessionById(existingSession.id)
      existingSession = null
    }

### 32. sidekick_pack_api_mentor_session.md (279df76f2334ef4eefa287f69efafeaa499b070ed2f54fc69bce9a71c062f55a)
- bm25: -11.1930 | entity_overlap_w: 2.10 | adjusted: -11.7180 | relevance: 1.0000

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

### 20. sidekick_pack_takeover.md (4d45bbcfaa633092686e1ce71da5a4ce6e0bde06d3389bd7bc5651efd662992c)
- bm25: -3.8964 | entity_overlap_w: 1.50 | adjusted: -4.2714 | relevance: 1.0000

### 33. sidekick_pack_takeover.md (c5953ecd074d6911600dcc7cd6abbba9e144f4ee7eaac0a4d6ac4c3fbfb45356)
- bm25: -10.3565 | entity_overlap_w: 5.00 | adjusted: -11.6065 | relevance: 1.0000

### 3. src/app/facilitator/generator/counselor/CounselorClient.jsx (db827adc4693207e19a47c4b31312ea3d57b04d11af0203344c71672cbea8cbf)
- bm25: -13.7968 | entity_overlap_w: 3.00 | adjusted: -14.5468 | relevance: 1.0000

console.log('[Realtime] Session update detected:', { 
          updatedSessionId: updatedSession.session_id, 
          mySessionId: sessionId,
          isActive: updatedSession.is_active,
          wasActive: oldSession.is_active,
          facilitatorId: updatedSession.facilitator_id,
          deviceName: updatedSession.device_name
        })

### 4. src/app/facilitator/generator/counselor/CounselorClient.jsx (7f24f606713fe057f3639dfcd7185ba8520b02c89dfca12e296b9c06293ca12f)
- bm25: -10.4296 | entity_overlap_w: 4.50 | adjusted: -11.5546 | relevance: 1.0000

if (!isMountedRef.current) {
        return
      }

const { session: activeSession, status, isOwner } = payload || {}

console.log('[Mr. Mentor] Session check:', {
        hasActiveSession: !!activeSession,
        status,
        isOwner,
        willShowTakeover: !isOwner && !!activeSession
      })

if (!activeSession || status === 'none') {
        const deviceName = `${navigator.platform || 'Unknown'} - ${navigator.userAgent.split(/[()]/)[1] || 'Browser'}`
        const createRes = await fetch('/api/mentor-session', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({
            sessionId,
            deviceName,
            action: 'initialize'
          })
        })

const createData = await createRes.json().catch(() => ({}))

if (!createRes.ok) {
          throw new Error(createData?.error || 'Failed to initialize mentor session')
        }

### 34. src/app/api/lesson-schedule/route.js (ff3ad28ef7a262ca477170ea0d60d5d1724049c3c3c5d136f9f3e4532a21cf91)
- bm25: -11.3537 | entity_overlap_w: 1.00 | adjusted: -11.6037 | relevance: 1.0000

// Verify the learner belongs to this facilitator
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 35. src/app/api/planned-lessons/route.js (0cb34597997923379f49f1a5824d6852b3ad04d47f6f03a6981194ba09861b6b)
- bm25: -11.2952 | entity_overlap_w: 1.00 | adjusted: -11.5452 | relevance: 1.0000

// Verify the learner belongs to this facilitator/owner
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 36. sidekick_pack.md (1dd92dae5e8813538d894c056cbd5ce4b3c04e2476cfbc543123ea11bb1a3d1f)
- bm25: -10.1603 | entity_overlap_w: 5.30 | adjusted: -11.4853 | relevance: 1.0000

// Check if THIS session was deactivated (taken over)
        if (updatedSession.session_id === sessionId && oldSession.is_active && !updatedSession.is_active) {
          console.log('[Realtime] THIS SESSION taken over - showing PIN overlay')
          
          // Clear persisted session ID so next load generates a new one
          clearPersistedSessionIdentifier()
          initializedSessionIdRef.current = null
          
          // Clear conversation state
          setConversationHistory([])
          setDraftSummary('')
          setCurrentSessionTokens(0)
          setSessionStarted(false)
          setSessionLoading(false)
          
          // Fetch the active session to show in takeover dialog
          ;(async () => {
            try {
              const checkRes = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              })
              if (checkRes.ok) {
                const checkData = await checkRes.json()
                if (checkData.session) {
                  setConflictingSession(checkData.session)
                }
              }
            } catch (err) {
              console.error('[Realtime] Failed to fetch active session:', err)
            }
          })()
          
          setShowTakeoverDialog(true)
        } else {
          console.log('[Realtime] Update is for different session or not a takeover:', {
            isSameSession: updatedSession.session_id === sessionId,
            wasActive: oldSession.is_active,
            isActive: updatedSession.is_active
          })
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

### 37. sidekick_pack_takeover.md (356ca3e9b5f2146428f2b3f46f0e21f3b760d5d403814b67615a603dc64b0276)
- bm25: -10.1378 | entity_overlap_w: 5.30 | adjusted: -11.4628 | relevance: 1.0000

// Check if THIS session was deactivated (taken over)
        if (updatedSession.session_id === sessionId && oldSession.is_active && !updatedSession.is_active) {
          console.log('[Realtime] THIS SESSION taken over - showing PIN overlay')
          
          // Clear persisted session ID so next load generates a new one
          clearPersistedSessionIdentifier()
          initializedSessionIdRef.current = null
          
          // Clear conversation state
          setConversationHistory([])
          setDraftSummary('')
          setCurrentSessionTokens(0)
          setSessionStarted(false)
          setSessionLoading(false)
          
          // Fetch the active session to show in takeover dialog
          ;(async () => {
            try {
              const checkRes = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              })
              if (checkRes.ok) {
                const checkData = await checkRes.json()
                if (checkData.session) {
                  setConflictingSession(checkData.session)
                }
              }
            } catch (err) {
              console.error('[Realtime] Failed to fetch active session:', err)
            }
          })()
          
          setShowTakeoverDialog(true)
        } else {
          console.log('[Realtime] Update is for different session or not a takeover:', {
            isSameSession: updatedSession.session_id === sessionId,
            wasActive: oldSession.is_active,
            isActive: updatedSession.is_active
          })
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

### 38. sidekick_pack_takeover.md (e0968e842c5c995f634336c7ca15618ec623795565428152b76ad11d32003981)
- bm25: -10.1378 | entity_overlap_w: 5.30 | adjusted: -11.4628 | relevance: 1.0000

// Check if THIS session was deactivated (taken over)
        if (updatedSession.session_id === sessionId && oldSession.is_active && !updatedSession.is_active) {
          console.log('[Realtime] THIS SESSION taken over - showing PIN overlay')
          
          // Clear persisted session ID so next load generates a new one
          clearPersistedSessionIdentifier()
          initializedSessionIdRef.current = null
          
          // Clear conversation state
          setConversationHistory([])
          setDraftSummary('')
          setCurrentSessionTokens(0)
          setSessionStarted(false)
          setSessionLoading(false)
          
          // Fetch the active session to show in takeover dialog
          ;(async () => {
            try {
              const checkRes = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
              })
              if (checkRes.ok) {
                const checkData = await checkRes.json()
                if (checkData.session) {
                  setConflictingSession(checkData.session)
                }
              }
            } catch (err) {
              console.error('[Realtime] Failed to fetch active session:', err)
            }
          })()
          
          setShowTakeoverDialog(true)
        } else {
          console.log('[Realtime] Update is for different session or not a takeover:', {
            isSameSession: updatedSession.session_id === sessionId,
            wasActive: oldSession.is_active,
            isActive: updatedSession.is_active
          })
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

### 39. sidekick_pack_api_mentor_session.md (054e2962b38d693a6449e357990067b71bf24cef6dfe65e79b167a1bf139e3ce)
- bm25: -10.8815 | entity_overlap_w: 2.10 | adjusted: -11.4065 | relevance: 1.0000

### 15. src/app/api/learner/lesson-history/route.js (9157c225ea6bb007ac2531e96a366b9e76432a349cd594c07c251457ecf6abf4)
- bm25: -6.6673 | entity_overlap_w: 1.00 | adjusted: -6.9173 | relevance: 1.0000

const eventsBySession = new Map()
    for (const event of events) {
      const sessionId = event?.session_id
      if (!sessionId) continue
      if (!eventsBySession.has(sessionId)) {
        eventsBySession.set(sessionId, [])
      }
      eventsBySession.get(sessionId).push(event)
    }

const nowMs = Date.now()
    const staleMillis = STALE_MINUTES * 60 * 1000

for (const session of sessions) {
      if (!session?.id || session?.ended_at) continue

### 13. src/app/facilitator/generator/counselor/CounselorClient.jsx (b154c65843fc4836e963ddebf10c9aed63fa1764da56aa817c2f79498a14020a)
- bm25: -5.7982 | entity_overlap_w: 2.00 | adjusted: -6.2982 | relevance: 1.0000

'use client'

### 40. src/app/facilitator/generator/counselor/CounselorClient.jsx (db827adc4693207e19a47c4b31312ea3d57b04d11af0203344c71672cbea8cbf)
- bm25: -10.2567 | entity_overlap_w: 3.00 | adjusted: -11.0067 | relevance: 1.0000

console.log('[Realtime] Session update detected:', { 
          updatedSessionId: updatedSession.session_id, 
          mySessionId: sessionId,
          isActive: updatedSession.is_active,
          wasActive: oldSession.is_active,
          facilitatorId: updatedSession.facilitator_id,
          deviceName: updatedSession.device_name
        })
