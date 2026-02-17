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

### 1. sidekick_pack.md (1dd92dae5e8813538d894c056cbd5ce4b3c04e2476cfbc543123ea11bb1a3d1f)
- bm25: -16.1404 | entity_overlap_w: 7.50 | adjusted: -18.0154 | relevance: 1.0000

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

### 4. sidekick_pack.md (1dd92dae5e8813538d894c056cbd5ce4b3c04e2476cfbc543123ea11bb1a3d1f)
- bm25: -9.7858 | entity_overlap_w: 5.50 | adjusted: -11.1608 | relevance: 1.0000

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

### 5. sidekick_pack_takeover.md (356ca3e9b5f2146428f2b3f46f0e21f3b760d5d403814b67615a603dc64b0276)
- bm25: -9.7682 | entity_overlap_w: 5.50 | adjusted: -11.1432 | relevance: 1.0000

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

### 6. sidekick_pack_takeover.md (e0968e842c5c995f634336c7ca15618ec623795565428152b76ad11d32003981)
- bm25: -9.7682 | entity_overlap_w: 5.50 | adjusted: -11.1432 | relevance: 1.0000

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

### 7. src/app/facilitator/generator/counselor/CounselorClient.jsx (32b69638a7470372b35d616ad94782f1b5cf5cc4a395ed2d22d03ef4d16b6ab9)
- bm25: -9.7160 | entity_overlap_w: 5.50 | adjusted: -11.0910 | relevance: 1.0000

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

### 8. src/app/facilitator/generator/counselor/CounselorClient.jsx (c21578213791b60e66ac69b7300670fbcdc55d03473be62cedfb6eaabbfb8622)
- bm25: -7.7187 | entity_overlap_w: 1.00 | adjusted: -7.9687 | relevance: 1.0000

// Listen for menu actions from HeaderBar (no longer used, but keep for backwards compat)
  useEffect(() => {
    const onExport = () => exportConversation()
    const onNewSession = () => startNewConversation()
    
    window.addEventListener('ms:mentor:export', onExport)
    window.addEventListener('ms:mentor:new-session', onNewSession)
    
    return () => {
      window.removeEventListener('ms:mentor:export', onExport)
      window.removeEventListener('ms:mentor:new-session', onNewSession)
    }
  }, [exportConversation, startNewConversation])

// Auto-scroll captions to bottom
  useEffect(() => {
    if (captionBoxRef.current) {
      captionBoxRef.current.scrollTop = captionBoxRef.current.scrollHeight
    }
  }, [captionText, captionIndex])

if (!pinChecked) {
    return (
      <main style={{ padding: 24 }}>
        <p>Checking facilitator PIN…</p>
      </main>
    )
  }

if (!tierChecked) {
    return (
      <main style={{ padding: 24 }}>
        <p>Loading...</p>
      </main>
    )
  }

// Show takeover dialog if session conflict exists
  if (showTakeoverDialog && conflictingSession) {
    return (
      <SessionTakeoverDialog
        existingSession={conflictingSession}
        onTakeover={handleSessionTakeover}
        onCancel={() => router.push('/facilitator')}
      />
    )
  }

### 9. sidekick_pack_takeover.md (289fcbe7eafedb353f94dc7933de3708ca756455202726a98dc0e7dc70fde64f)
- bm25: -7.3196 | entity_overlap_w: 1.00 | adjusted: -7.5696 | relevance: 1.0000

// Listen for menu actions from HeaderBar (no longer used, but keep for backwards compat)
  useEffect(() => {
    const onExport = () => exportConversation()
    const onNewSession = () => startNewConversation()
    
    window.addEventListener('ms:mentor:export', onExport)
    window.addEventListener('ms:mentor:new-session', onNewSession)
    
    return () => {
      window.removeEventListener('ms:mentor:export', onExport)
      window.removeEventListener('ms:mentor:new-session', onNewSession)
    }
  }, [exportConversation, startNewConversation])

// Auto-scroll captions to bottom
  useEffect(() => {
    if (captionBoxRef.current) {
      captionBoxRef.current.scrollTop = captionBoxRef.current.scrollHeight
    }
  }, [captionText, captionIndex])

if (!pinChecked) {
    return (
      <main style={{ padding: 24 }}>
        <p>Checking facilitator PIN…</p>
      </main>
    )
  }

if (!tierChecked) {
    return (
      <main style={{ padding: 24 }}>
        <p>Loading...</p>
      </main>
    )
  }

// Show takeover dialog if session conflict exists
  if (showTakeoverDialog && conflictingSession) {
    return (
      <SessionTakeoverDialog
        existingSession={conflictingSession}
        onTakeover={handleSessionTakeover}
        onCancel={() => router.push('/facilitator')}
      />
    )
  }

### 8. src/app/facilitator/generator/counselor/CounselorClient.jsx (1a62d2f3c94f8c3b1e42864f9fc34918ff33f975c6bb8eb76a1ade509b0ad968)
- bm25: -8.8426 | entity_overlap_w: 1.00 | adjusted: -9.0926 | relevance: 1.0000

### 10. sidekick_pack_takeover.md (07b22dc7735d96da6aeb7c6744e47004dc68be83f6926738e69c963b3f63593c)
- bm25: -6.9809 | entity_overlap_w: 1.00 | adjusted: -7.2309 | relevance: 1.0000

### 9. sidekick_pack.md (d1ec81fdd9752b2555826acc1023252274fca16b822aef5f80161f4ff6dd2dac)
- bm25: -8.7340 | entity_overlap_w: 1.00 | adjusted: -8.9840 | relevance: 1.0000

### 2. src/app/facilitator/generator/counselor/CounselorClient.jsx (c21578213791b60e66ac69b7300670fbcdc55d03473be62cedfb6eaabbfb8622)
- bm25: -4.1206 | entity_overlap_w: 1.30 | adjusted: -4.4456 | relevance: 1.0000

// Listen for menu actions from HeaderBar (no longer used, but keep for backwards compat)
  useEffect(() => {
    const onExport = () => exportConversation()
    const onNewSession = () => startNewConversation()
    
    window.addEventListener('ms:mentor:export', onExport)
    window.addEventListener('ms:mentor:new-session', onNewSession)
    
    return () => {
      window.removeEventListener('ms:mentor:export', onExport)
      window.removeEventListener('ms:mentor:new-session', onNewSession)
    }
  }, [exportConversation, startNewConversation])

// Auto-scroll captions to bottom
  useEffect(() => {
    if (captionBoxRef.current) {
      captionBoxRef.current.scrollTop = captionBoxRef.current.scrollHeight
    }
  }, [captionText, captionIndex])

if (!pinChecked) {
    return (
      <main style={{ padding: 24 }}>
        <p>Checking facilitator PIN…</p>
      </main>
    )
  }

if (!tierChecked) {
    return (
      <main style={{ padding: 24 }}>
        <p>Loading...</p>
      </main>
    )
  }

// Show takeover dialog if session conflict exists
  if (showTakeoverDialog && conflictingSession) {
    return (
      <SessionTakeoverDialog
        existingSession={conflictingSession}
        onTakeover={handleSessionTakeover}
        onCancel={() => router.push('/facilitator')}
      />
    )
  }

### 11. sidekick_pack.md (d1ec81fdd9752b2555826acc1023252274fca16b822aef5f80161f4ff6dd2dac)
- bm25: -6.9473 | entity_overlap_w: 1.00 | adjusted: -7.1973 | relevance: 1.0000

### 2. src/app/facilitator/generator/counselor/CounselorClient.jsx (c21578213791b60e66ac69b7300670fbcdc55d03473be62cedfb6eaabbfb8622)
- bm25: -4.1206 | entity_overlap_w: 1.30 | adjusted: -4.4456 | relevance: 1.0000

// Listen for menu actions from HeaderBar (no longer used, but keep for backwards compat)
  useEffect(() => {
    const onExport = () => exportConversation()
    const onNewSession = () => startNewConversation()
    
    window.addEventListener('ms:mentor:export', onExport)
    window.addEventListener('ms:mentor:new-session', onNewSession)
    
    return () => {
      window.removeEventListener('ms:mentor:export', onExport)
      window.removeEventListener('ms:mentor:new-session', onNewSession)
    }
  }, [exportConversation, startNewConversation])

// Auto-scroll captions to bottom
  useEffect(() => {
    if (captionBoxRef.current) {
      captionBoxRef.current.scrollTop = captionBoxRef.current.scrollHeight
    }
  }, [captionText, captionIndex])

if (!pinChecked) {
    return (
      <main style={{ padding: 24 }}>
        <p>Checking facilitator PIN…</p>
      </main>
    )
  }

if (!tierChecked) {
    return (
      <main style={{ padding: 24 }}>
        <p>Loading...</p>
      </main>
    )
  }

// Show takeover dialog if session conflict exists
  if (showTakeoverDialog && conflictingSession) {
    return (
      <SessionTakeoverDialog
        existingSession={conflictingSession}
        onTakeover={handleSessionTakeover}
        onCancel={() => router.push('/facilitator')}
      />
    )
  }

### 3. src/app/facilitator/calendar/page.js (0a32ebc9ad08d634e4f5fe53dbfb28e72c4ad0eb82a86311b99c270a1e056612)
- bm25: -3.9718 | entity_overlap_w: 1.30 | adjusted: -4.2968 | relevance: 1.0000

### 12. sidekick_pack_takeover.md (6ab7b739334afeaea082c2424ed18760868b0056056cb4146b9f1cb05cd5b365)
- bm25: -6.4376 | entity_overlap_w: 2.00 | adjusted: -6.9376 | relevance: 1.0000

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier, resolveEffectiveTier } from '@/app/lib/entitlements'
import { fetchLearnerTranscript } from '@/app/lib/learnerTranscript'
import { validateLessonQuality, buildValidationChangeRequest } from '@/app/lib/lessonValidation'
import ClipboardOverlay from './ClipboardOverlay'
import GoalsClipboardOverlay from './GoalsClipboardOverlay'
import CalendarOverlay from './overlays/CalendarOverlay'
import LessonsOverlay from './overlays/LessonsOverlay'
import LessonMakerOverlay from './overlays/LessonMakerOverlay'
import MentorThoughtBubble from './MentorThoughtBubble'
import SessionTakeoverDialog from './SessionTakeoverDialog'
import MentorInterceptor from './MentorInterceptor'

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

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier, resolveEffectiveTier } from '@/app/lib/entitlements'
import { fetchLearnerTranscript } from '@/app/lib/learnerTranscript'
import { validateLessonQuality, buildValidationChangeRequest } from '@/app/lib/lessonValidation'
import ClipboardOverlay from './ClipboardOverlay'
import GoalsClipboardOverlay from './GoalsClipboardOverlay'
import CalendarOverlay from './overlays/CalendarOverlay'
import LessonsOverlay from './overlays/LessonsOverlay'
import LessonMakerOverlay from './overlays/LessonMakerOverlay'
import MentorThoughtBubble from './MentorThoughtBubble'
import SessionTakeoverDialog from './SessionTakeoverDialog'
import MentorInterceptor from './MentorInterceptor'

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

if (!isMountedRef.current) {
          setSessionLoading(false)
          setSessionLoading(false)
          return
        }

if (createdSession?.session_id && createdSession.session_id !== sessionId) {
          setSessionLoading(false)
          assignSessionIdentifier(createdSession.session_id)
          return
        }

### 16. sidekick_pack_takeover.md (b65d845f962c2dcaaa89d2fb046432403b5d3c3d80b78abb73abd86f23d330da)
- bm25: -4.3751 | entity_overlap_w: 1.50 | adjusted: -4.7501 | relevance: 1.0000

// Helper: Actually clear conversation state after save/delete
  const clearConversationAfterSave = async () => {
    // End current session in database
    if (sessionId && accessToken) {
      try {
        await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
      } catch (e) {
        // Silent error handling
      }
    }
    
    // End current session usage tracking
    if (sessionStarted) {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        
        if (token) {
          await fetch('/api/usage/mentor/increment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'end' })
          })
        }
      } catch (e) {
        // Silent error handling
      }
    }
    
    if (sessionPollInterval.current) {
      clearInterval(sessionPollInterval.current)
      sessionPollInterval.current = null
    }

### 17. src/app/facilitator/generator/counselor/CounselorClient.jsx (4a68051b03929f296a686aefa6c7e5b7ccae490470f056adff7667dc2572e632)
- bm25: -4.3448 | entity_overlap_w: 1.50 | adjusted: -4.7198 | relevance: 1.0000

// Helper: Actually clear conversation state after save/delete
  const clearConversationAfterSave = async () => {
    // End current session in database
    if (sessionId && accessToken) {
      try {
        await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })
      } catch (e) {
        // Silent error handling
      }
    }
    
    // End current session usage tracking
    if (sessionStarted) {
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        
        if (token) {
          await fetch('/api/usage/mentor/increment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'end' })
          })
        }
      } catch (e) {
        // Silent error handling
      }
    }
    
    if (sessionPollInterval.current) {
      clearInterval(sessionPollInterval.current)
      sessionPollInterval.current = null
    }

### 18. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (db96521d88eaeec132fd2b012e48ace5fbf769f77d2ef05134824c651c2c1100)
- bm25: -4.1957 | entity_overlap_w: 2.00 | adjusted: -4.6957 | relevance: 1.0000

const handleEditClick = async (scheduledLesson) => {
    setEditingLesson(scheduledLesson.lesson_key)
    setLessonEditorLoading(true)
    setLessonEditorData(null)

try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const authedUserId = session?.user?.id

if (!token || !authedUserId) throw new Error('Not authenticated')
      if (scheduledLesson.facilitator_id && scheduledLesson.facilitator_id !== authedUserId) {
        throw new Error('Cannot edit another facilitator\'s lesson')
      }

const params = new URLSearchParams({ file: scheduledLesson.lesson_key })
      const response = await fetch(`/api/facilitator/lessons/get?${params}`, {
        cache: 'no-store',
        headers: { authorization: `Bearer ${token}` }
      })

if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to load lesson')
      }

const data = await response.json()
      setLessonEditorData(data)
    } catch (err) {
      alert('Failed to load lesson for editing')
      setEditingLesson(null)
      setLessonEditorData(null)
    } finally {
      setLessonEditorLoading(false)
    }
  }

const handleSaveLessonEdits = async (updatedLesson) => {
    setLessonEditorSaving(true)
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

const normalizedFile = String(editingLesson || '')
        .replace(/^generated\//, '')
        .replace(/\.json$/i, '')
      const file = `${normalizedFile}.json`

### 19. sidekick_pack_calendar.md (8433d094a6742c2a6805901913b61d0bfbfbc49e078e5ba8657783f75d33e24f)
- bm25: -3.9204 | entity_overlap_w: 2.00 | adjusted: -4.4204 | relevance: 1.0000

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

### 20. sidekick_pack_takeover.md (4d45bbcfaa633092686e1ce71da5a4ce6e0bde06d3389bd7bc5651efd662992c)
- bm25: -3.8964 | entity_overlap_w: 1.50 | adjusted: -4.2714 | relevance: 1.0000

// Save conversation to database whenever it changes
  useEffect(() => {
    console.log('[Mr. Mentor] Save effect triggered:', { 
      sessionId: !!sessionId, 
      accessToken: !!accessToken, 
      hasAccess, 
      sessionLoading, 
      conversationLength: conversationHistory.length,
      willSave: sessionId && accessToken && hasAccess && !sessionLoading && conversationHistory.length > 0
    })
    
    if (!sessionId || !accessToken || !hasAccess || sessionLoading || conversationHistory.length === 0) return
    
    // Debounce database writes
    const saveTimer = setTimeout(async () => {
      try {
        // Update local timestamp
        lastLocalUpdateTimestamp.current = Date.now()
        console.log('[Mr. Mentor] Saving conversation to DB:', conversationHistory.length, 'messages')
        
        const payload = {
          sessionId,
          conversationHistory,
          draftSummary,
          tokenCount: currentSessionTokens,
          lastLocalUpdateAt: new Date(lastLocalUpdateTimestamp.current).toISOString()
        }
        
        console.log('[Mr. Mentor] PATCH payload:', { 
          sessionId: payload.sessionId, 
          conversationLength: payload.conversationHistory?.length,
          hasDraft: !!payload.draftSummary,
          tokenCount: payload.tokenCount,
          timestamp: payload.lastLocalUpdateAt
        })
        
        const response = await fetch('/api/mentor-session', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(payload)
        })
        
        const result = await response.json().catch(() => ({}))
        console.log('[Mr. Mentor] PATCH response:', { ok: response.ok

### 21. src/app/facilitator/generator/counselor/CounselorClient.jsx (8faefcd69ada239d95b78ede3322fe35d8c4cd9fbcf107461382dcca0c29958f)
- bm25: -3.8738 | entity_overlap_w: 1.50 | adjusted: -4.2488 | relevance: 1.0000

// Save conversation to database whenever it changes
  useEffect(() => {
    console.log('[Mr. Mentor] Save effect triggered:', { 
      sessionId: !!sessionId, 
      accessToken: !!accessToken, 
      hasAccess, 
      sessionLoading, 
      conversationLength: conversationHistory.length,
      willSave: sessionId && accessToken && hasAccess && !sessionLoading && conversationHistory.length > 0
    })
    
    if (!sessionId || !accessToken || !hasAccess || sessionLoading || conversationHistory.length === 0) return
    
    // Debounce database writes
    const saveTimer = setTimeout(async () => {
      try {
        // Update local timestamp
        lastLocalUpdateTimestamp.current = Date.now()
        console.log('[Mr. Mentor] Saving conversation to DB:', conversationHistory.length, 'messages')
        
        const payload = {
          sessionId,
          conversationHistory,
          draftSummary,
          tokenCount: currentSessionTokens,
          lastLocalUpdateAt: new Date(lastLocalUpdateTimestamp.current).toISOString()
        }
        
        console.log('[Mr. Mentor] PATCH payload:', { 
          sessionId: payload.sessionId, 
          conversationLength: payload.conversationHistory?.length,
          hasDraft: !!payload.draftSummary,
          tokenCount: payload.tokenCount,
          timestamp: payload.lastLocalUpdateAt
        })
        
        const response = await fetch('/api/mentor-session', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify(payload)
        })
        
        const result = await response.json().catch(() => ({}))
        console.log('[Mr. Mentor] PATCH response:', { ok: response.ok

### 22. src/app/facilitator/generator/counselor/CounselorClient.jsx (b9fbe23ffc72a61a3d870df5f81b541f3e9aeee27421e3bfe1429b2c19e1b419)
- bm25: -3.7171 | entity_overlap_w: 2.00 | adjusted: -4.2171 | relevance: 1.0000

// Only process updates for this user's sessions
        if (updatedSession.facilitator_id !== user.id) {
          console.log('[Realtime] Ignoring - different user:', {
            eventUserId: updatedSession.facilitator_id,
            myUserId: user.id
          })
          return
        }

### 23. src/app/facilitator/generator/counselor/CounselorClient.jsx (376e3135d2c88e5b553959f02f6a1691e838ed19259965ac76d8a84b55fb903e)
- bm25: -4.1762 | relevance: 1.0000

const canPlan = Boolean(featuresForTier(tier)?.lessonPlanner)

const generateSessionIdentifier = useCallback(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }, [])

const persistSessionIdentifier = useCallback((id) => {
    if (typeof window === 'undefined' || !id) return
    try {
      sessionStorage.setItem('mr_mentor_session_id', id)
    } catch {}
    try {
      localStorage.setItem('mr_mentor_active_session_id', id)
    } catch {}
  }, [])

const clearPersistedSessionIdentifier = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.removeItem('mr_mentor_session_id')
    } catch {}
    try {
      localStorage.removeItem('mr_mentor_active_session_id')
    } catch {}
  }, [])

const assignSessionIdentifier = useCallback((id) => {
    if (!id) return
    persistSessionIdentifier(id)
    setSessionId(id)
  }, [persistSessionIdentifier])

// (startSessionPolling defined later, after session setup hooks)

### 24. sidekick_pack_takeover.md (286b21b876dd43167572bcd6d4f3e2f6a37d59d8f77ecf5581fe673813f7cb22)
- bm25: -3.7728 | entity_overlap_w: 1.50 | adjusted: -4.1478 | relevance: 1.0000

const checkSessionStatus = async () => {
      try {
        const res = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        
        if (!res.ok) return

### 26. src/app/facilitator/generator/counselor/CounselorClient.jsx (a1ae0a2fd223855fdf2c5474602229e9f53ed6e4e4e0393afe4bfa23f922274d)
- bm25: -4.2255 | entity_overlap_w: 1.50 | adjusted: -4.6005 | relevance: 1.0000

### 25. sidekick_pack_calendar.md (daec363789d11d6f4fd8250b18eeb4bd64a6be6f6507df08d3872e18ee5521f8)
- bm25: -3.3935 | entity_overlap_w: 3.00 | adjusted: -4.1435 | relevance: 1.0000

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

### 28. sidekick_pack_takeover.md (bb0fe5e9d047f3ab0c75e484c0e251d99db1f2530e1a37678683f763d6195aee)
- bm25: -4.0670 | relevance: 1.0000

if (!isMountedRef.current) {
          setSessionLoading(false)
          setSessionLoading(false)
          return
        }

if (createdSession?.session_id && createdSession.session_id !== sessionId) {
          setSessionLoading(false)
          assignSessionIdentifier(createdSession.session_id)
          return
        }

### 5. src/app/facilitator/generator/counselor/CounselorClient.jsx (376e3135d2c88e5b553959f02f6a1691e838ed19259965ac76d8a84b55fb903e)
- bm25: -10.6019 | relevance: 1.0000

const canPlan = Boolean(featuresForTier(tier)?.lessonPlanner)

const generateSessionIdentifier = useCallback(() => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }, [])

const persistSessionIdentifier = useCallback((id) => {
    if (typeof window === 'undefined' || !id) return
    try {
      sessionStorage.setItem('mr_mentor_session_id', id)
    } catch {}
    try {
      localStorage.setItem('mr_mentor_active_session_id', id)
    } catch {}
  }, [])

const clearPersistedSessionIdentifier = useCallback(() => {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.removeItem('mr_mentor_session_id')
    } catch {}
    try {
      localStorage.removeItem('mr_mentor_active_session_id')
    } catch {}
  }, [])

const assignSessionIdentifier = useCallback((id) => {
    if (!id) return
    persistSessionIdentifier(id)
    setSessionId(id)
  }, [persistSessionIdentifier])

// (startSessionPolling defined later, after session setup hooks)

### 29. sidekick_pack_takeover.md (6ed8a706b498e6f657f40b7510171a6feb31af872e9d9f786da46598bee12a13)
- bm25: -4.0568 | relevance: 1.0000

// Start session if this is the first message
      if (!sessionStarted) {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        
        if (token) {
          await fetch('/api/usage/mentor/increment', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ action: 'start' })
          })
          setSessionStarted(true)
        }
      }

### 30. sidekick_pack_planned_all.md (5071023fee14b1947ec97c9b3da5d4f96595f1c7517de9f099d8bb62cf6916c2)
- bm25: -3.2478 | entity_overlap_w: 3.00 | adjusted: -3.9978 | relevance: 1.0000

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

### 35. sidekick_pack_calendar.md (f3f7b14a499f1f3a989cdd52880f4a862e223e5a88ef1ef84f87ed21c65c5f64)
- bm25: -4.8777 | relevance: 1.0000

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

### 31. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (881c6aeccb4aa181f82d1847a73c237bc06ba1eb9aa5f3d346ace55680312e1b)
- bm25: -3.4828 | entity_overlap_w: 2.00 | adjusted: -3.9828 | relevance: 1.0000

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

// Only return fallback rows if they're clearly a single legacy owner/facilitator namespace.
      if (distinctFacilitators.length === 1) {
        data = allRows
      } else {
        data = []
      }
    }

### 33. sidekick_pack_takeover.md (780bc28e652a51d50dce7548510375e1e0ac8869d0f2a608904ae366094e7a02)
- bm25: -3.5690 | entity_overlap_w: 1.50 | adjusted: -3.9440 | relevance: 1.0000

// Monitor conversation length and enforce turn limits
  useEffect(() => {
    const turnCount = conversationHistory.length

// Warning at 30 turns
    if (turnCount === 30 && !turnWarningShown) {
      setTurnWarningShown(true)
      alert('Your conversation is getting long. Consider starting a new conversation soon for better performance.')
    }

// Force overlay at 50 turns
    if (turnCount >= 50 && !showClipboard) {
      setShowClipboard(true)
      setClipboardForced(true)
    }
  }, [conversationHistory.length, showClipboard, turnWarningShown])

// Reset warning flag when new conversation starts
  useEffect(() => {
    if (conversationHistory.length === 0) {
      setTurnWarningShown(false)
      setClipboardForced(false)
    }
  }, [conversationHistory.length])

const initializeMentorSession = useCallback(async () => {
    if (!sessionId || !accessToken || !hasAccess || !tierChecked) {
      return
    }

console.log('[Mr. Mentor] Initializing session:', sessionId)
    setSessionLoading(true)

try {
      const checkRes = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

if (!isMountedRef.current) {
        setSessionLoading(false)
        return
      }

if (!checkRes.ok) {
        const data = await checkRes.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to check existing session')
      }

### 24. src/app/facilitator/generator/counselor/CounselorClient.jsx (6761ba03eefbe5225064c71c22710c17fe5c49f1d82927f8d133d6a1eeee757e)
- bm25: -4.7126 | relevance: 1.0000

### 34. src/app/api/planned-lessons/route.js (574fd23a79ac65035e0db4bf7ab01755ae271852821851a9f5779aa8e4420a2a)
- bm25: -3.3810 | entity_overlap_w: 2.00 | adjusted: -3.8810 | relevance: 1.0000

if (!learnerId) {
      return NextResponse.json({ error: 'learnerId required' }, { status: 400 })
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

### 35. src/app/facilitator/generator/counselor/CounselorClient.jsx (09b0b520905f7250b5d63a871724ce4038abee9f4ab573f5eb5fce185eb358af)
- bm25: -3.4779 | entity_overlap_w: 1.50 | adjusted: -3.8529 | relevance: 1.0000

realtimeChannelRef.current = channel
  }, [sessionId, accessToken, hasAccess])

// Clean up realtime subscription on unmount
  useEffect(() => {
    return () => {
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.unsubscribe()
        realtimeChannelRef.current = null
      }
    }
  }, [])

// Monitor conversation length and enforce turn limits
  useEffect(() => {
    const turnCount = conversationHistory.length

// Warning at 30 turns
    if (turnCount === 30 && !turnWarningShown) {
      setTurnWarningShown(true)
      alert('Your conversation is getting long. Consider starting a new conversation soon for better performance.')
    }

// Force overlay at 50 turns
    if (turnCount >= 50 && !showClipboard) {
      setShowClipboard(true)
      setClipboardForced(true)
    }
  }, [conversationHistory.length, showClipboard, turnWarningShown])

// Reset warning flag when new conversation starts
  useEffect(() => {
    if (conversationHistory.length === 0) {
      setTurnWarningShown(false)
      setClipboardForced(false)
    }
  }, [conversationHistory.length])

const initializeMentorSession = useCallback(async () => {
    if (!sessionId || !accessToken || !hasAccess || !tierChecked) {
      return
    }

console.log('[Mr. Mentor] Initializing session:', sessionId)
    setSessionLoading(true)

try {
      const checkRes = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

if (!isMountedRef.current) {
        setSessionLoading(false)
        return
      }

if (!checkRes.ok) {
        const data = await checkRes.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to check existing session')
      }

### 36. src/app/api/lesson-schedule/route.js (ff3ad28ef7a262ca477170ea0d60d5d1724049c3c3c5d136f9f3e4532a21cf91)
- bm25: -3.5398 | entity_overlap_w: 1.00 | adjusted: -3.7898 | relevance: 1.0000

// Verify the learner belongs to this facilitator
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

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

### 12. src/app/facilitator/generator/counselor/CounselorClient.jsx (fe35cada78006265a115c3c1e903d4415d9fcd7a8f619558635d36e4465be49f)
- bm25: -6.9062 | entity_overlap_w: 2.50 | adjusted: -7.5312 | relevance: 1.0000

// Periodic heartbeat to detect if session was taken over (backup to realtime)
  useEffect(() => {
    if (!sessionId || !accessToken || !hasAccess || sessionLoading) return

const checkSessionStatus = async () => {
      try {
        const res = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        
        if (!res.ok) return

### 39. sidekick_pack_takeover.md (1f8bb138ac5cd60bc837c33cf2320c683c1c16459f3b411cf6cafa5117a77e1c)
- bm25: -3.7297 | relevance: 1.0000

if (!resolvedId) {
      try {
        resolvedId = sessionStorage.getItem('mr_mentor_session_id')
      } catch {}
    }

### 40. src/app/facilitator/generator/counselor/CounselorClient.jsx (fe35cada78006265a115c3c1e903d4415d9fcd7a8f619558635d36e4465be49f)
- bm25: -3.3427 | entity_overlap_w: 1.50 | adjusted: -3.7177 | relevance: 1.0000

// Periodic heartbeat to detect if session was taken over (backup to realtime)
  useEffect(() => {
    if (!sessionId || !accessToken || !hasAccess || sessionLoading) return

const checkSessionStatus = async () => {
      try {
        const res = await fetch(`/api/mentor-session?sessionId=${sessionId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        
        if (!res.ok) return

const data = await res.json()
        
        console.log('[Heartbeat] Checking session status:', {
          mySessionId: sessionId,
          activeSessionId: data.session?.session_id,
          isOwner: data.isOwner,
          sessionStarted,
          hasSession: !!data.session
        })
        
        // Only show PIN if there's an active session AND we're not the owner
        // If there's no session at all, don't show PIN - user can start fresh
        if (data.session && !data.isOwner) {
          console.log('[Heartbeat] Not owner - showing PIN overlay')
          
          clearPersistedSessionIdentifier()
          initializedSessionIdRef.current = null
          
          setConversationHistory([])
          setDraftSummary('')
          setCurrentSessionTokens(0)
          setSessionStarted(false)
          setSessionLoading(false)
          
          // Show takeover dialog with the active session info
          setConflictingSession(data.session)
          setShowTakeoverDialog(true)
        }
      } catch (err) {
        console.error('[Heartbeat] Error:', err)
      }
    }
