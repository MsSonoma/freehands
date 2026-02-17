# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
V2 completed lessons mismatch: Calendar vs Completed Lessons page vs Awards (medals). Find where lesson completion is recorded in V2 (session/teaching flow), where each screen pulls data (lesson history API, medals API, lesson schedule API), and identify why completions are missing (Emma).
```

Filter terms used:
```text
API
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

API

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_mentor_schema.md (799992b6a1ce2f36ba290f1138f2018a0234f611b1ea4868ee056ceced015f6c)
- bm25: -0.4452 | entity_overlap_w: 2.60 | adjusted: -1.0952 | relevance: 1.0000

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

### 2. sidekick_pack_mentor_route.md (59bdcd490335353b737361ee601c45af69527281b46c66469521fbe00be45497)
- bm25: -0.4865 | entity_overlap_w: 1.30 | adjusted: -0.8115 | relevance: 1.0000

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

### 3. sidekick_pack_lessons_prefetch.md (12848ca022733b1be5ce6019d03313e486302067ede90e19278c512b817e7d57)
- bm25: -0.4671 | entity_overlap_w: 1.30 | adjusted: -0.7921 | relevance: 1.0000

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'mentor_sessions'
  AND indexname = 'unique_active_session_per_facilitator';

### 6. sidekick_pack_mentor_route.md (59bdcd490335353b737361ee601c45af69527281b46c66469521fbe00be45497)
- bm25: -21.3956 | relevance: 1.0000

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

### 4. src/app/facilitator/calendar/page.js (5e87d7c4007b60bd8dc94a3654ecdcc51bd79003e2d025df44b062ea052b69f4)
- bm25: -0.4434 | entity_overlap_w: 1.30 | adjusted: -0.7684 | relevance: 1.0000

if (pastSchedule.length > 0 && minPastDate) {
          // IMPORTANT: Do not query lesson_session_events directly from the client.
          // In some environments, RLS causes the query to return an empty array without an error,
          // which hides all past schedule history. Use the admin-backed API endpoint instead.
          const historyRes = await fetch(
            `/api/learner/lesson-history?learner_id=${selectedLearnerId}&from=${encodeURIComponent(minPastDate)}&to=${encodeURIComponent(todayStr)}`
          )
          const historyJson = await historyRes.json().catch(() => null)

### 5. src/app/api/facilitator/lessons/list/route.js (812a61970219f7a0aa8d2d6fe316dc1438ebab642a181655be3404ec0d38613b)
- bm25: -0.4381 | entity_overlap_w: 1.30 | adjusted: -0.7631 | relevance: 1.0000

if (debug) {
      // eslint-disable-next-line no-console
      console.log('[api/facilitator/lessons/list]', 'listed', { count: (files || []).length, ms: Date.now() - startedAt })
    }
    
    const out = []
    
    // Process each file in the user's folder
    for (const fileObj of files || []) {
      if (!fileObj.name.toLowerCase().endsWith('.json')) continue
      
      // OPTIMIZATION: Skip files not in the requested list
      if (requestedFiles && !requestedFiles.includes(fileObj.name)) {
        continue
      }
      
      try {
        const oneStartedAt = Date.now()
        // Bypass storage SDK and use direct REST API with service role
        const filePath = `facilitator-lessons/${userId}/${fileObj.name}`
        const storageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/lessons/${filePath}`
        
        const response = await fetchWithTimeout(storageUrl, {
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY
          }
        }, 15000)
        
        if (!response.ok) {
          if (debug) {
            // eslint-disable-next-line no-console
            console.log('[api/facilitator/lessons/list]', 'skip file (status)', {
              name: fileObj.name,
              status: response.status,
              ms: Date.now() - oneStartedAt,
            })
          }
          // Silent error - skip this file
          continue
        }
        
        const raw = await response.text()
        const js = JSON.parse(raw)
        const subj = (js.subject || '').toString().toLowerCase()
        const approved = js.approved === true
        const needsUpdate = js.needsUpdate === true
        out.push({ 
          file: f

### 6. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (2a938234217ddc4bbe3fa752d0674cb474afe0e962d03962810e28b81a1eee8a)
- bm25: -0.4335 | entity_overlap_w: 1.30 | adjusted: -0.7585 | relevance: 1.0000

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

### 7. sidekick_pack_planned_all.md (4eccd72e9e830a67d41e2c664cc187b253d6f8de3b4d4434938e2983b422175b)
- bm25: -0.4320 | entity_overlap_w: 1.30 | adjusted: -0.7570 | relevance: 1.0000

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

### 8. sidekick_pack_mentor_sessions_sql.md (28982ef8ec89fc27dcf6d17154a9c30d1772cafa1cc88bf6055a2434f8ad3311)
- bm25: -0.4308 | entity_overlap_w: 1.30 | adjusted: -0.7558 | relevance: 1.0000

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

### 9. sidekick_pack_planned_all.md (02c02d27f519cbb03ec7cb65be2760e2665a920e83f0a486eb7da10bdc2d5d4e)
- bm25: -0.5409 | relevance: 1.0000

// Fetch lesson history (completed, scheduled, planned)
      const [historyRes, medalsRes, scheduledRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

### 10. sidekick_pack_lessons_prefetch.md (ac883869d83ef7e460b14a8423b832b9040d1ff6852c7c67b8802efe2ab1f189)
- bm25: -0.5126 | relevance: 1.0000

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

### 21. sidekick_pack_mentor_sessions_sql.md (3d3d30391a6c3c87efa29d40b3184d4a7404da4afd67032da8b149d37b498393)
- bm25: -15.5948 | relevance: 1.0000

### 22. src/app/api/planned-lessons/route.js (15656ce650d24fdeb4fda70bfd25cc8bd17794cf1e124b01b93a1b3280f5fd24)
- bm25: -12.3784 | entity_overlap_w: 1.00 | adjusted: -12.6284 | relevance: 1.0000

const allRows = Array.isArray(fallback.data) ? fallback.data : []
        const distinctFacilitators = Array.from(
          new Set(allRows.map(r => r?.facilitator_id).filter(Boolean))
        )

### 23. src/app/api/lesson-schedule/route.js (4e331f192a6c56a4cab8c5f7afbe0982981f3bd236880d62edeea56744dbb7e2)
- bm25: -11.8478 | entity_overlap_w: 3.00 | adjusted: -12.5978 | relevance: 1.0000

### 11. src/app/api/facilitator/lessons/list/route.js (36cdb13fbda8730526af20861f4a44d742817a3e0ca0d41a0fdb8c4bc7d2b17a)
- bm25: -0.5086 | relevance: 1.0000

if (debug) {
          // eslint-disable-next-line no-console
          console.log('[api/facilitator/lessons/list]', 'loaded file', {
            name: fileObj.name,
            subject: subj || null,
            ms: Date.now() - oneStartedAt,
          })
        }
      } catch (parseError) {
        if (debug) {
          // eslint-disable-next-line no-console
          console.log('[api/facilitator/lessons/list]', 'skip file (error)', {
            name: fileObj?.name,
            message: parseError?.message || String(parseError),
          })
        }
        // Silent error - skip this file
      }
    }
    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[api/facilitator/lessons/list]', 'done', { count: out.length, ms: Date.now() - startedAt })
    }
    return NextResponse.json(out)
  } catch (e) {
    if (debug) {
      // eslint-disable-next-line no-console
      console.log('[api/facilitator/lessons/list]', 'ERR', { message: e?.message || String(e), ms: Date.now() - startedAt })
    }
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}

### 12. sidekick_pack_lessons_prefetch.md (082a13895140ada4627c25eec4b7f1d12a0d04642005277988bcaea3752e518c)
- bm25: -0.5067 | relevance: 1.0000

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

### 2. sidekick_pack_planned_all.md (6674f39b1a48416b009443ca2cf88e758108c2e528bc2acccb1cd9fa3f4d0107)
- bm25: -24.3616 | relevance: 1.0000

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

### 13. sidekick_pack_mentor_sessions_schema.md (1c25241abb3e388414150fea0f415718c904618a865f7ace44e73d836cb2439f)
- bm25: -0.5058 | relevance: 1.0000

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

### 14. sidekick_pack_mentor_sessions_sql.md (849e9ac0c5f2a578684419c6c51ab533fc53947ce5df0087f51df0c709bb430a)
- bm25: -0.5058 | relevance: 1.0000

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

### 15. sidekick_pack_api_mentor_session.md (5388e78bba3c5d5c4ba59b06b030271c9ebca9ffc6db3797c2d5648e94849b7c)
- bm25: -0.5010 | relevance: 1.0000

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

### 16. sidekick_pack_lessons_prefetch.md (a3b40ffb825fc75fb11bd0df815b1b980abefb5ce1e7bb9704a8f8855fce747e)
- bm25: -0.4995 | relevance: 1.0000

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

### 18. sidekick_pack.md (265d5e9528aab4adb01c0837c5b76cbae1e0657c5159c00e43e1933ff13ad63f)
- bm25: -16.1208 | relevance: 1.0000

### 2. src/app/api/mentor-session/route.js (1fe1ab155adbaf0e5796d4e84c300f4ebc4972ecc1eebe5b27191470f370c0fe)
- bm25: -16.4534 | entity_overlap_w: 8.50 | adjusted: -18.5784 | relevance: 1.0000

### 5. sidekick_pack.md (bbfe1a425ae31a11be296f4f4fc759f6411f10077e0af5313f6a0bb7defac52f)
- bm25: -4.6596 | entity_overlap_w: 6.90 | adjusted: -6.3846 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

### 17. sidekick_pack_mentor_route.md (c5573c182949c3e4b375da5e02fc850631a6175002ce78347d15646082e99491)
- bm25: -0.4977 | relevance: 1.0000

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

### 18. sidekick_pack_mentor_sessions_sql.md (d4426642ad2e7784e215ab45d7554af84cacf0f65c0a2f4c127aeee80a7273a7)
- bm25: -0.4861 | relevance: 1.0000

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

### 19. sidekick_pack_planned_all.md (6674f39b1a48416b009443ca2cf88e758108c2e528bc2acccb1cd9fa3f4d0107)
- bm25: -0.4783 | relevance: 1.0000

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

### 20. sidekick_pack_lessons_prefetch.md (0199283839898ac084639626b1eebec01ea77d02e468dd86fa7181d1dae01fc6)
- bm25: -0.4777 | relevance: 1.0000

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

### 19. src/app/facilitator/calendar/LessonPlanner.jsx (426d7a2069ad0af30eac2d862612b0b84c4fccada605caa681924ce5f5f81bb4)
- bm25: -16.0709 | relevance: 1.0000

if (lowScoreCompleted.length > 0) {
            contextText += `\n\nLow-score completed lessons that are eligible for REVIEW (<= ${LOW_SCORE_REVIEW_THRESHOLD}%):\n`
            lowScoreCompleted.forEach((l) => {
              contextText += `- ${l.name} (score: ${l.score}%)\n`
            })
          }

if (highScoreCompleted.length > 0) {
            contextText += `\n\nHigh-score completed lessons to AVOID repeating (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%):\n`
            highScoreCompleted.forEach((l) => {
              contextText += `- ${l.name} (score: ${l.score}%)\n`
            })
          }

### 21. sidekick_pack_mentor_route.md (3a3bdedcdbf4f05cd828c34cc9ed0cfd6c09ff7fa4e49d8243a0e220afe4fb4f)
- bm25: -0.4718 | relevance: 1.0000

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

### 22. sidekick_pack_mentor_schema.md (bbece32ae29276797773dfc67f0677caacb09224ced11b206097c5976ef7ac79)
- bm25: -0.4712 | relevance: 1.0000

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

### 23. src/app/api/mentor-session/route.js (8c947b4ee36221a3e96f028ad0195f5cd488e4aae3e4498d556916f0ad632c85)
- bm25: -0.4671 | relevance: 1.0000

if (error) {
    return false
  }

### 24. src/app/api/facilitator/lessons/list/route.js (b057ca7c8b643275bebfd594d619e9df9a13d4aa5036625b7478b1c567a04f14)
- bm25: -0.4628 | relevance: 1.0000

if (debug) {
      // eslint-disable-next-line no-console
      console.log('[api/facilitator/lessons/list]', 'start', {
        userId,
        ms: Date.now() - startedAt,
      })
    }
    
    // OPTIMIZATION: Accept filenames query parameter to only load specific files
    const { searchParams } = new URL(request.url)
    const filenamesParam = searchParams.get('filenames')
    const requestedFiles = filenamesParam ? filenamesParam.split(',').filter(Boolean) : null
    
    // Only list files in THIS user's folder
    const { data: files, error: listError } = await supabase.storage
      .from('lessons')
      .list(`facilitator-lessons/${userId}`, { limit: 1000 })
    
    if (listError) {
      if (debug) {
        // eslint-disable-next-line no-console
        console.log('[api/facilitator/lessons/list]', 'list error', { message: listError?.message || String(listError) })
      }
      return NextResponse.json([])
    }

### 25. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -0.4623 | relevance: 1.0000

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

### 26. sidekick_pack_api_mentor_session.md (a0d6a2635e5a0a5206309222151f8fcf78f90a50e4cf0fb8484706065d407fee)
- bm25: -0.4585 | relevance: 1.0000

if (!isMountedRef.current) {
          setSessionLoading(false)
          setSessionLoading(false)
          return
        }

### 27. sidekick_pack_planned_all.md (7e6f9e099ed0bba77cc78887bd83ba39f37066930a72a67bd840f9de1f9e3b5a)
- bm25: -0.4567 | relevance: 1.0000

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

### 28. sidekick_pack_takeover.md (d2b72071b1a2c2c6817565e96ed76f09ce317391276449fdde4792537f9e2326)
- bm25: -0.4563 | relevance: 1.0000

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

### 29. sidekick_pack_calendar.md (2a3e86ef656681a0f342082ad621f01e89dfc9483227c5d812966dc60315f5b5)
- bm25: -0.4560 | relevance: 1.0000

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

### 30. sidekick_pack_lessons_prefetch.md (f7c94d9aeb98885ef845829c1ae5a56937397504b13827f56c781084a24f4b30)
- bm25: -0.4553 | relevance: 1.0000

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

### 12. sidekick_pack.md (1b35bf538afad26f92900c15a9ef188e2e77c3169699221955a87675505eee67)
- bm25: -18.0546 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Where is Mr. Mentor takeover (PIN/device ownership) and per-learner conversation separation implemented end-to-end? Focus on /api/mentor-session and CounselorClient subjectKey usage.
```

Filter terms used:
```text
/api/mentor-session
PIN
CounselorClient
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/mentor-session PIN CounselorClient

## Forced Context

(none)

## Ranked Evidence

### 31. sidekick_pack_planned_all.md (79af748cc863cfa32eda062671f812e41cf02adf095a46eb36bd42871ec402a0)
- bm25: -0.4539 | relevance: 1.0000

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

### 32. src/app/api/mentor-session/route.js (1466e01cbc93090ac23ba797206432b48b5ad753e7dddaa162739546b9be2406)
- bm25: -0.4503 | relevance: 1.0000

return jsonWithDeviceCookie({
          body: { session: sessionWithConversation, status: 'active' },
          status: 200,
          deviceCookieHeader
        })
      }

### 33. sidekick_pack_api_mentor_session.md (40b9daf5c6cd94c6b7cc277177bd9d5cd41a74191e494b65626932470d67bf22)
- bm25: -0.4477 | relevance: 1.0000

// Monitor conversation length and enforce turn limits
  useEffect(() => {
    const turnCount = conversationHistory.length

### 34. src/app/api/mentor-session/route.js (db447f5ae30f36ad761f7878b6af9b402ab0db45c97cf27fc324d68e031d33a4)
- bm25: -0.4477 | relevance: 1.0000

if (!subjectKey) {
      return jsonWithDeviceCookie({ body: { error: 'subjectKey required' }, status: 400, deviceCookieHeader })
    }

### 35. sidekick_pack_calendar.md (0265ef4f1639cb46a8abe3529dd0c20c6f5a521386f8bce166be11efa580ae7a)
- bm25: -0.4450 | relevance: 1.0000

### 15. src/app/api/planned-lessons/route.js (ea768dab2e653da4a9ef74d6f595ab2f466d7eb0babb59320a48f5ff72b9b4a0)
- bm25: -3.3197 | relevance: 1.0000

### 36. sidekick_pack.md (41dbd34511a694e9d348af6166e20a237a38cb0c9b095792c5de9b5e5c5bef32)
- bm25: -0.4450 | relevance: 1.0000

### 6. src/app/api/facilitator/lessons/list/route.js (401f11dbb7450b6c492cc58dde736de6dbc3855ecacc457b5bf890b621eb9ce3)
- bm25: -6.8072 | relevance: 1.0000

### 37. sidekick_pack_calendar.md (4877f9d3982775fd648627719d0576a49689ed9e81ab5a6dbef0dfff5bf19d6e)
- bm25: -0.4450 | relevance: 1.0000

### 27. src/app/api/lesson-schedule/route.js (b89acc0fde5033863fadb63ea3f2943978cd555f4c47181c1e5d95945acef434)
- bm25: -2.8760 | relevance: 1.0000

### 38. sidekick_pack.md (90c775a16ad01a2694dc004818e46a147bdd05238f94485d710e930ceca2a5df)
- bm25: -0.4450 | relevance: 1.0000

### 19. src/app/api/facilitator/lessons/list/route.js (bf9b59297e1ea94f16eed9f638aeba412f4e7a2211c5bd7711dd14d2cdbfb356)
- bm25: -4.9238 | relevance: 1.0000

### 39. sidekick_pack_calendar.md (acf9ce08465f001f4925abe0b71ac34df61a9dc795d33bdd8bbeb9368f36447d)
- bm25: -0.4450 | relevance: 1.0000

### 36. src/app/api/planned-lessons/route.js (669f59ed11e30a0d8781e7c15939a84b6684017e4f4bf05eec7efec4e3226256)
- bm25: -2.0327 | relevance: 1.0000

### 40. sidekick_pack_calendar.md (c66d0eceedc8044113d18d3f20d1fcad9d89003c88db6ca34a5052754108ac85)
- bm25: -0.4450 | relevance: 1.0000

### 6. src/app/api/planned-lessons/route.js (715e20f8c79adf81a24d6bba0df47ad7f44fc6912f0e3f031bde78b0436fec4e)
- bm25: -3.8146 | relevance: 1.0000
