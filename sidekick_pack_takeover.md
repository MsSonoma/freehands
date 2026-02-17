# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Mr Mentor overlay learner selector: restore ability to select 'No Learner Selected' (empty selection). Find where the overlay learner <select> is rendered and remove any forcing of a learner selection.
```

Filter terms used:
```text
Mr
Mentor
overlay
learner
selector
restore
ability
to
select
No
Learner
Selected
empty
selection
Find
where
the
overlay
learner
select
is
rendered
and
remove
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Mr Mentor overlay learner selector restore ability to select No Learner Selected empty selection Find where the overlay learner select is rendered and remove

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_restore_medal_emojis.md (4b5f437e05ff75e34989306112678a803c16db9dc864c7a9c152cd9328fbf4cf)
- bm25: -30.1404 | relevance: 1.0000

Prompt (original):
```text
Completed Lessons page: remove 'Medal earned' portion since Awards already shows medals. Find where medal earned UI is rendered on /learn/lessons and delete it.
```

### 2. sidekick_pack_lessons_prefetch.md (4d6218fef61eaa3b8654ba737151d12da22cbe7a84644e2656d6431fa83f45ce)
- bm25: -24.8257 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Mr. Mentor page lessons overlay prefetch is not working. Where is the lessons overlay implemented, how are lessons fetched, and where is prefetch/caching supposed to occur on page landing?
```

Filter terms used:
```text
Mr
Mentor
page
lessons
overlay
prefetch
is
not
working
Where
is
the
lessons
overlay
implemented
how
are
lessons
fetched
and
where
is
prefetch
caching
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Mr Mentor page lessons overlay prefetch is not working Where is the lessons overlay implemented how are lessons fetched and where is prefetch caching

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_api_mentor_session.md (5388e78bba3c5d5c4ba59b06b030271c9ebca9ffc6db3797c2d5648e94849b7c)
- bm25: -25.8730 | relevance: 1.0000

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

### 3. sidekick_pack_mentor_schema.md (1a7f91cda5fe61826229fc8f47b854f78d1e32454244a225cb7ad7ef3e2fc5eb)
- bm25: -24.7218 | relevance: 1.0000

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

### 4. src/app/facilitator/generator/counselor/CounselorClient.jsx (3a923a890812500a8d7bb31695878fdc34de0d804596734196fa34ec406a5f5d)
- bm25: -23.7193 | relevance: 1.0000

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

### 5. sidekick_pack_lessons_prefetch.md (4f71a9873f3be2859f269bbc874e89cf26a453dc1352b707820cd5eadf96f1d8)
- bm25: -21.2149 | relevance: 1.0000

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/mentor-session facilitator_id is_active SessionTakeoverDialog

## Forced Context

(none)

## Ranked Evidence

### 7. sidekick_pack_api_mentor_session.md (6a4e308d5326bc08dc43d55d77a917dca49981ecbaa22e641c0c8d8df1915c92)
- bm25: -20.7168 | relevance: 1.0000

// Default behavior: prefer facilitator-scoped schedule rows, plus safe legacy rows where facilitator_id is null.
    // Overlay/debug callers can pass includeAll=1 to retrieve all schedule rows for an owned learner.
    if (!includeAll) {
      query = query.or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
    }

### 8. src/app/api/lesson-schedule/route.js (4e331f192a6c56a4cab8c5f7afbe0982981f3bd236880d62edeea56744dbb7e2)
- bm25: -20.6258 | relevance: 1.0000

// Default behavior: prefer facilitator-scoped schedule rows, plus safe legacy rows where facilitator_id is null.
    // Overlay/debug callers can pass includeAll=1 to retrieve all schedule rows for an owned learner.
    if (!includeAll) {
      query = query.or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
    }

### 9. sidekick_pack_mentor_sessions_schema.md (455339344562db47239e8d791c805dc4f86ca4acf57144996acddf4d5af3842f)
- bm25: -19.9648 | relevance: 1.0000

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'mentor_sessions'
  AND indexname = 'unique_active_session_per_facilitator';

### 2. scripts/setup-mentor-sessions.sql (76419572d186bb374af9dfdf9f1b40251b639abdcfebe257c03215b4b394bc31)
- bm25: -35.6047 | entity_overlap_w: 1.00 | adjusted: -35.8547 | relevance: 1.0000

### 6. src/app/session/v2/SessionPageV2.jsx (52a0feda042a203623e2582fccdec9b74717c10f0b66369eb0efb6a9fae6927f)
- bm25: -19.9961 | relevance: 1.0000

const audioBase64 = await fetchTTS(text);
    try {
      await audioEngineRef.current.playAudio(audioBase64, [text], 0);
    } catch (err) {
      console.warn('[SessionPageV2] Visual aid explain failed:', err);
    }
  }, [stopAudioSafe]);
  
  // Load learner profile (REQUIRED - no defaults or fallback)
  useEffect(() => {
    async function loadLearnerProfile() {
      try {
        setLearnerLoading(true);
        setLearnerError(null);
        
        const learnerId = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
        
        if (!learnerId || learnerId === 'demo') {
          throw new Error('No learner selected. Please select a learner from the dashboard.');
        }
        
        const learner = await getLearner(learnerId);
        
        if (!learner) {
          throw new Error('Learner profile not found. Please select a valid learner.');
        }
        
        // Pin the session learner id to avoid mid-session localStorage drift.
        sessionLearnerIdRef.current = learner.id;
        setLearnerProfile(learner);

### 7. src/app/facilitator/calendar/LessonCalendar.js (6c095505e052dc81a0cc67b04578b7b3c34ec5111ddcfbabce7b355f813374c7)
- bm25: -19.5632 | relevance: 1.0000

return (
    <div className="bg-white rounded-lg shadow-md border border-gray-500 overflow-hidden">
      {/* Calendar Header with Learner Selector */}
      <div style={{ 
        padding: '12px 8px', 
        background: 'linear-gradient(to right, #eff6ff, #eef2ff)',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <div style={{ 
          display: 'flex', 
          gap: 4, 
          justifyContent: 'center', 
          alignItems: 'center',
          flexWrap: 'wrap',
          maxWidth: '100%'
        }}>
          {/* Learner Selector */}
          {learners.length > 0 && (
            <select
              value={selectedLearnerId}
              onChange={(e) => onLearnerChange(e.target.value)}
              style={{
                padding: '6px 10px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 6,
                background: '#fff',
                border: '1px solid #d1d5db',
                cursor: 'pointer',
                minWidth: '120px',
                maxWidth: '160px',
                flex: '1 1 auto'
              }}
            >
              {learners.map(learner => (
                <option key={learner.id} value={learner.id}>
                  {learner.name} {learner.grade ? `(Grade ${learner.grade})` : ''}
                </option>
              ))}
            </select>
          )}
          
          <select
            value={currentMonthIndex}
            onChange={handleMonthChange}
            style={{
              padding: '6px 10px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              background: '#fff',
              border: '1px solid #d1d5db',
              cursor: 'pointer',
              minWidth: '100px',

### 8. sidekick_pack_calendar_cell_styles.md (ff8915ec2d543ab8861b38d81fdb40bd7101c734ed70be009b2b95c106408b26)
- bm25: -19.3175 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Calendar + Calendar overlay: make completed lesson cells light grey (not orange like scheduled). Make highlighted/selected cell a dark outline (not blue like planned lessons). Find the cell style logic and apply minimal changes.
```

Filter terms used:
```text
Calendar
Calendar
overlay
make
completed
lesson
cells
light
grey
not
orange
like
scheduled
Make
highlighted
selected
cell
dark
outline
not
blue
like
planned
lessons
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Calendar Calendar overlay make completed lesson cells light grey not orange like scheduled Make highlighted selected cell dark outline not blue like planned lessons

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_calendar.md (c15e93dc3f822d93b3c56ed5d9a2f14c0045a84177352fe11823046decb59212)
- bm25: -26.3303 | relevance: 1.0000

const todayStr = getLocalTodayStr()

### 9. sidekick_pack_api_mentor_session.md (6a4e308d5326bc08dc43d55d77a917dca49981ecbaa22e641c0c8d8df1915c92)
- bm25: -18.3412 | relevance: 1.0000

// Default behavior: prefer facilitator-scoped schedule rows, plus safe legacy rows where facilitator_id is null.
    // Overlay/debug callers can pass includeAll=1 to retrieve all schedule rows for an owned learner.
    if (!includeAll) {
      query = query.or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
    }

### 10. sidekick_pack_lessons_prefetch.md (f7c94d9aeb98885ef845829c1ae5a56937397504b13827f56c781084a24f4b30)
- bm25: -17.8784 | relevance: 1.0000

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

### 11. sidekick_pack_completions_mismatch.md (285702e726f760250937c6ffdd9c3922d9ee01418a69c6dec5f675fe19c6857d)
- bm25: -17.6821 | relevance: 1.0000

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

### 12. scripts/fix-mentor-sessions-constraint.sql (4dc766a6e79f877413a55badb56b9c5465b95213d58ad0870ca0fb6be097301c)
- bm25: -17.5974 | relevance: 1.0000

-- Fix mentor_sessions unique constraint to only apply when is_active = TRUE
-- The current constraint applies to ALL rows, including is_active = FALSE
-- This causes errors when trying to deactivate sessions

-- Drop the bad constraint
ALTER TABLE public.mentor_sessions 
  DROP CONSTRAINT IF EXISTS unique_active_session_per_facilitator;

-- Create a partial unique index that only applies when is_active = TRUE
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_session_per_facilitator 
  ON public.mentor_sessions(facilitator_id, is_active) 
  WHERE is_active = TRUE;

-- Verify the fix
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.mentor_sessions'::regclass
  AND conname = 'unique_active_session_per_facilitator';

SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'mentor_sessions'
  AND indexname = 'unique_active_session_per_facilitator';

### 13. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (fce861fe7ccd9453ac8db2223dbbd32e1242824d902447d9a37e90cb6c24a4b7)
- bm25: -17.4528 | relevance: 1.0000

<TypedRemoveConfirmModal
        open={!!removeConfirmLesson}
        onClose={() => setRemoveConfirmLesson(null)}
        title="Remove lesson?"
        description="This cannot be undone. Type remove to confirm."
        confirmWord="remove"
        confirmLabel="Remove"
        portal
        zIndex={OVERLAY_Z_INDEX}
        onConfirm={async () => {
          if (!removeConfirmLesson?.scheduleId) return
          await handleRemoveScheduledLessonById(removeConfirmLesson.scheduleId, { skipConfirm: true })
        }}
      />
      
      {/* Reschedule popup modal (ported to body to avoid spill suppression stacking issues) */}
      {isMounted && rescheduling && scheduledForSelectedDate.find(item => item.id === rescheduling) && createPortal(
        <div 
          style={{ 
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: OVERLAY_Z_INDEX
          }}
          onClick={() => setRescheduling(null)}
        >
          <div 
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: 20,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
              maxWidth: 320,
              width: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#1f2937' }}>
              📅 Reschedule Lesson
            </div>
            <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
              {scheduledForSelectedDate.find(item => item.id === rescheduling)?.lesson_title}

### 14. sidekick_pack_completions_mismatch.md (4d70ffb6cf5bf342adef7c9b1b576c15f6b660105427e60170e67a2b73029e01)
- bm25: -17.1922 | relevance: 1.0000

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

### 15. sidekick_pack_lessons_prefetch.md (c2cf5bf3ad627a5e90407d82ebdbcdb0ecc148498a13c5ab029ef56071e17508)
- bm25: -17.1887 | relevance: 1.0000

// Default behavior: prefer facilitator-scoped schedule rows, plus safe legacy rows where facilitator_id is null.
    // Overlay/debug callers can pass includeAll=1 to retrieve all schedule rows for an owned learner.
    if (!includeAll) {
      query = query.or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
    }

### 16. sidekick_pack_loading_lessons.md (92cfd3be7aa969ae1ddeba972b66d04a8f07ebb8615b1f764e18666e784e6d6c)
- bm25: -17.1502 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Lessons overlay stuck on 'Loading Lessons'. Find where Loading Lessons is rendered in LessonsOverlay and what controls the loading flag; identify why loadLessons might not run.
```

Filter terms used:
```text
LessonsOverlay
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

LessonsOverlay

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_api_mentor_session.md (4855132618822a362a64f503352c2317423f958b837508d272e5034660ab6c18)
- bm25: -4.2644 | entity_overlap_w: 2.00 | adjusted: -4.7644 | relevance: 1.0000

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

### 17. src/app/api/lesson-schedule/route.js (4e331f192a6c56a4cab8c5f7afbe0982981f3bd236880d62edeea56744dbb7e2)
- bm25: -17.0318 | relevance: 1.0000

// Default behavior: prefer facilitator-scoped schedule rows, plus safe legacy rows where facilitator_id is null.
    // Overlay/debug callers can pass includeAll=1 to retrieve all schedule rows for an owned learner.
    if (!includeAll) {
      query = query.or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
    }

### 18. sidekick_pack_lessons_hang.md (26ae99bb963289f4f4eb0782eae819b45a2c459d047a0126f196212dbdb636c6)
- bm25: -16.8951 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
LessonsOverlay stuck on 'Loading lessons...'. Trace client loadLessons -> /api/lessons/[subject] implementation, including any filesystem/storage calls that could hang. Show key files and likely hang points.
```

Filter terms used:
```text
/api/lessons
LessonsOverlay
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/api/lessons LessonsOverlay

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_loading_lessons.md (92cfd3be7aa969ae1ddeba972b66d04a8f07ebb8615b1f764e18666e784e6d6c)
- bm25: -5.5356 | entity_overlap_w: 5.00 | adjusted: -6.7856 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Lessons overlay stuck on 'Loading Lessons'. Find where Loading Lessons is rendered in LessonsOverlay and what controls the loading flag; identify why loadLessons might not run.
```

Filter terms used:
```text
LessonsOverlay
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

LessonsOverlay

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_api_mentor_session.md (4855132618822a362a64f503352c2317423f958b837508d272e5034660ab6c18)
- bm25: -4.2644 | entity_overlap_w: 2.00 | adjusted: -4.7644 | relevance: 1.0000

### 19. sidekick_pack.md (4b7dd738e990ee2c376b5dd4958af1c0dbcb9b9ad14319c1c6eda65dc503524d)
- bm25: -16.4889 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Remove the Medal earned portion from the Completed Lessons page (/learn/lessons). Medals are already shown in Awards.
```

Filter terms used:
```text
/learn/lessons
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/learn/lessons

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack.md (0e51f14d1c52152b9424566d3bf0c618fd241c5219d5c054fecaf89e2de88b7d)
- bm25: -7.3972 | entity_overlap_w: 4.50 | adjusted: -8.5222 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Completed Lessons page: remove 'Medal earned' portion since Awards already shows medals. Find where medal earned UI is rendered on /learn/lessons and delete it.
```

Filter terms used:
```text
/learn/lessons
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

/learn/lessons

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/v2/SessionPageV2.jsx (2bc8e681bbd1556f75d0ce083dec1df5ac8c48a7151fbf63b711d25f84060648)
- bm25: -7.6185 | entity_overlap_w: 4.50 | adjusted: -8.7435 | relevance: 1.0000

### 2. sidekick_pack.md (d126e8946a06da80b9958e13cbe36f57c952ca29d7a5bbf1d435e23877448296)
- bm25: -7.3041 | entity_overlap_w: 4.50 | adjusted: -8.4291 | relevance: 1.0000

### 20. sidekick_pack_mentor_schema.md (c291171bca6c247bcc944da0e78649f131eaeab29f843828b0e9ad3edeb31e68)
- bm25: -16.3413 | relevance: 1.0000

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

### 21. src/app/session/page.js (a79593f2bba7b4eee21a3f071d295bf7ef65560f5dcf7708144a732a17f37d00)
- bm25: -16.3235 | relevance: 1.0000

// Handle timer pause/resume (no PIN required - overlay already authenticated)
  const handleTimerPauseToggle = useCallback(async () => {
    setTimerPaused(prev => !prev);
  }, []);

// Handle timer click - open controls with PIN
  const handleTimerClick = useCallback(async (currentElapsedSeconds) => {
    const ok = await ensurePinAllowed('timer');
    if (!ok) return;
    setShowTimerControls(true);
  }, []);

// Handle timer time adjustment
  const handleUpdateTime = useCallback((newElapsedSeconds) => {
    // TimerControlOverlay now handles sessionStorage updates directly
    // Force SessionTimer to re-read its state by changing its key
    setTimerRefreshKey(prev => prev + 1);
    setShowTimerControls(false);
  }, []);

// Handle golden key application from timer controls
  const handleApplyGoldenKey = useCallback(async () => {
    if (hasGoldenKey) {
      alert('This lesson already has a golden key applied.');
      return;
    }
    
    try {
      const learnerId = localStorage.getItem('learner_id');
      if (!learnerId) {
        alert('No learner selected');
        return;
      }

// Import learner API
      const { getLearner, updateLearner } = await import('@/app/facilitator/learners/clientApi');
      const learner = await getLearner(learnerId);
      if (!learner) {
        alert('Learner not found');
        return;
      }

// Check if learner has available golden keys
      if (!learner.golden_keys || learner.golden_keys <= 0) {
        alert('No golden keys available. Complete lessons to earn golden keys.');
        return;
      }

// Apply golden key to this lesson
      const activeKeys = { ...(learner.active_golden_keys || {}) };
      activeKeys[lessonKey] = true;

### 22. sidekick_pack_completions_mismatch.md (f533ca4590ba528b3fae4d32a35123611e935ad97e833c439bc07b66439dfc8e)
- bm25: -16.3067 | relevance: 1.0000

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

### 23. sidekick_pack_lessons_prefetch.md (30b34470ae4c8a433f99089f40aeb4f9c64039a1b27d896906b3f7b190c29fe0)
- bm25: -16.0406 | relevance: 1.0000

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

### 11. sidekick_pack_mentor_route.md (b166a122a9891687b725ba5e2b4a23cef8fa70b4abcaab496e27c5587f3bcc66)
- bm25: -18.0685 | relevance: 1.0000

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

### 24. sidekick_pack_planned_all.md (15fb0f43838f19cafa56c75ddfaf84d4379649e6197e0bf821cf807dfed35892)
- bm25: -15.9820 | relevance: 1.0000

const result = await response.json()
      devWarn(`schedule: parsed json ms=${Date.now() - startedAtMs}`)
      const data = result.schedule || []

### 39. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (38b221cf4f22b44a10dbd08b38788bc4d817a9dcdb503288348e7a0c64cd1a31)
- bm25: -1.9462 | relevance: 1.0000

useEffect(() => {
    if (!learnerId || learnerId === 'none') return
    if (!accessToken) return
    loadCalendarData({ force: true })
  }, [accessToken, learnerId, loadCalendarData])

// If the current tab has no lessons but the other does, auto-switch tabs.
  // This prevents the overlay from looking "empty" when (for example) only planned lessons exist.
  useEffect(() => {
    if (!learnerId || learnerId === 'none') return
    if (userSelectedTabRef.current) return

### 5. sidekick_pack_calendar.md (c9724a6488ce742416aba0ad09a8db8b7ab8f07ded8511ae49cd7dec9f4bde73)
- bm25: -7.0473 | relevance: 1.0000

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

### 25. sidekick_pack_mentor_route.md (b166a122a9891687b725ba5e2b4a23cef8fa70b4abcaab496e27c5587f3bcc66)
- bm25: -15.6201 | relevance: 1.0000

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

### 26. src/app/facilitator/generator/counselor/CounselorClient.jsx (8942fb0e22a7e03ff7b5f3785acde57bf5c57b2d2b549000f26eac370152c810)
- bm25: -15.5813 | relevance: 1.0000

// Ensure the calendar overlay is mounted to receive the event.
            setActiveScreen('calendar')

if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('mr-mentor:open-lesson-planner', {
                detail: {
                  learnerId: action.learnerId || selectedLearnerId,
                  startDate: action.startDate,
                  durationMonths: action.durationMonths,
                  autoGenerate: true
                }
              }))
            }

### 27. src/app/session/page.js (f9a8dbad333c7a98455fd8b3248735abd1b7fcf256b1810ee0778c33526e8969)
- bm25: -15.4720 | relevance: 1.0000

// isSpeaking/phase/subPhase defined earlier; do not redeclare here
  const [transcript, setTranscript] = useState("");
  // Start with loading=true so the existing overlay spinner shows during initial restore
  const [loading, setLoading] = useState(true);
  // TTS overlay: track TTS fetch activity separately; overlay shows when either API or TTS is loading
  const [ttsLoadingCount, setTtsLoadingCount] = useState(0);
  const overlayLoading = loading || (ttsLoadingCount > 0);

### 28. src/app/session/page.js (cc4f064e3ae80ce584c7c76da2afbaf40d1bc78e2a0c1b9cd6ddb39550712595)
- bm25: -15.2549 | relevance: 1.0000

// If focus is in an input and no hotkey matched, allow normal behavior
      if (targetIsInput) return;
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hotkeys, toggleMute, isSpeaking, teachingGateLocked, handleSkipSpeech, showRepeatButton, handleRepeatSpeech, showGames, phase, subPhase, handleGateNo]);

const renderDiscussionControls = () => {
    if (subPhase === "awaiting-learner") {
      return (
        <p style={{ marginBottom: 16 }}>
          Use the buttons below to choose the next step, or type a message and press Send to continue.
        </p>
      );
    }

const currentStep = discussionSteps.find((step) => step.key === subPhase);
    if (!currentStep) {
      return null;
    }

return (
      <button
        type="button"
        style={primaryButtonStyle}
        onClick={startDiscussionStep}
  disabled={loading}
      >
        {currentStep.label}
      </button>
    );
  };

const renderTeachingControls = () => {
    const currentStep = teachingSteps.find((step) => step.key === subPhase);
    if (!currentStep) {
      if (subPhase === "awaiting-gate") {
        return (
          <p style={{ marginBottom: 16 }}>
            Ask the learner if they want the lesson repeated. Type their answer and press Send.
          </p>
        );
      }
      return null;
    }
    return (
      <button
        type="button"
        style={primaryButtonStyle}
        onClick={startTeachingStep}
  disabled={loading}
      >
        {currentStep.label}
      </button>
    );
  };

### 29. src/app/session/page.js (807c92dc97dddac13c022ef8afa33829a9c69051b3763bc27e030b4f0c373912)
- bm25: -15.2332 | relevance: 1.0000

// Decrement available golden keys and mark this lesson as having one
      await updateLearner(learnerId, {
        name: learner.name,
        grade: learner.grade,
        targets: {
          comprehension: learner.comprehension,
          exercise: learner.exercise,
          worksheet: learner.worksheet,
          test: learner.test
        },
        session_timer_minutes: learner.session_timer_minutes,
        golden_keys: (learner.golden_keys || 0) - 1,
        active_golden_keys: activeKeys
      });
      
      // Get the golden key bonus from the learner's settings
      const bonusMinutes = learner.golden_key_bonus_min ?? 5; // Default to 5 if not set
      
      // Update local state
      setHasGoldenKey(true);
      setIsGoldenKeySuspended(false);
      setGoldenKeyBonus(bonusMinutes);
      
      // Force timer to refresh and pick up the new golden key bonus
      setTimerRefreshKey(prev => prev + 1);
      
      // Show success and close overlay
      alert('Golden key applied! This lesson now has bonus play time.');
      setShowTimerControls(false);
      
    } catch (err) {
      alert('Failed to apply golden key. Please try again.');
    }
  }, [hasGoldenKey, lessonKey]);

### 30. sidekick_pack_loading_lessons.md (f9f969db003f53102e85b1e3c7155423150a98822c92dcc253f71eff7d9010c0)
- bm25: -15.1867 | relevance: 1.0000

// Prefetch lessons once coreSubjects are ready (so first overlay open feels instant).
  useEffect(() => {
    loadLessons(false)
  }, [loadLessons])

// Initial learner-scoped load
  useEffect(() => {
    if (learnerId && learnerId !== 'none') {
      loadLearnerData()
    }
  }, [learnerId, loadLearnerData])

// Listen for preload event to trigger initial load
  useEffect(() => {
    const handlePreload = () => {
      loadLessons(false) // Warm cache; don't thrash network if already loaded
      if (learnerId && learnerId !== 'none') {
        loadLearnerData()
      }
    }
    
    const handleLessonGenerated = () => {
      // Clear cache and reload
      setAllLessons({})
      setRetryCount(0)
      setLoadError(false)
      loadLessons(true)
    }
    
    window.addEventListener('preload-overlays', handlePreload)
    window.addEventListener('mr-mentor:lesson-generated', handleLessonGenerated)
    return () => {
      window.removeEventListener('preload-overlays', handlePreload)
      window.removeEventListener('mr-mentor:lesson-generated', handleLessonGenerated)
    }
  }, [learnerId, loadLessons, loadLearnerData])

### 32. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (f9c0d007faeea184e8bb75bd128bec339343d7fa7b8f61fe831893f09ebb37a7)
- bm25: -2.6683 | relevance: 1.0000

### 31. src/app/facilitator/generator/counselor/CounselorClient.jsx (2b6b3ae18645723fa9ce433008c2ea35d93f3ec3d7d5ea50d111f001ed394c8e)
- bm25: -15.1231 | relevance: 1.0000

// Load learners list
  useEffect(() => {
    if (!tierChecked || !accessToken) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (supabase) {
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

const { data } = await supabase
            .from('learners')
            .select('*')
            .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
            .order('created_at', { ascending: false })

if (!cancelled && data) setLearners(data)
        }
      } catch (err) {
        // Silent error handling
      }
    })()
    return () => { cancelled = true }
  }, [accessToken, tierChecked])

// Persist last selected learner (helps survive Fast Refresh/state resets)
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      if (!selectedLearnerId || selectedLearnerId === 'none') return
      window.localStorage?.setItem?.(LAST_SELECTED_LEARNER_KEY, selectedLearnerId)
    } catch {
      // Ignore persistence errors (privacy mode / blocked storage)
    }
  }, [selectedLearnerId])

// Default to the newest learner once the list loads (avoid 'none' stalling overlays)
  useEffect(() => {
    if (!learners?.length) return
    const selectedIsValid = selectedLearnerId !== 'none' && learners.some(l => l.id === selectedLearnerId)
    if (!selectedIsValid) {
      let nextLearnerId = null
      try {
        if (typeof window !== 'undefined') {
          const saved = window.localStorage?.getItem?.(LAST_SELECTED_LEARNER_KEY)
          if (saved && learners.some(l => l.id === saved)) {
            nextLearnerId = saved
          }
        }
      } catch {}

### 32. sidekick_pack_mentor_sessions_schema.md (8ca6872e914a91ad0c11c0fbf1ad6c9d33a4f105d1bcb681e0813b5c3df9bebc)
- bm25: -14.7551 | relevance: 1.0000

-- Verify the fix
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.mentor_sessions'::regclass
  AND conname = 'unique_active_session_per_facilitator';

### 33. scripts/add-mentor-conversation-threads.sql (2298cd617a823bf44e0fc7409f5473e4aca9ec2ba50162da04ef527049f206d7)
- bm25: -14.6026 | relevance: 1.0000

DROP POLICY IF EXISTS "Users can manage their own mentor conversation threads" ON public.mentor_conversation_threads;
CREATE POLICY "Users can manage their own mentor conversation threads"
  ON public.mentor_conversation_threads
  FOR ALL
  USING (auth.uid() = facilitator_id)
  WITH CHECK (auth.uid() = facilitator_id);

GRANT ALL ON public.mentor_conversation_threads TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMENT ON TABLE public.mentor_conversation_threads IS 'Per-subject Mr. Mentor conversations (facilitator + each learner), independent of device ownership.';
COMMENT ON COLUMN public.mentor_conversation_threads.subject_key IS 'Conversation scope key, e.g. facilitator or learner:<uuid>.';

-- 4) Optional: backfill existing single conversation into facilitator thread (best-effort)
-- Inserts a facilitator thread for facilitators that have any mentor_sessions row.
INSERT INTO public.mentor_conversation_threads (facilitator_id, subject_key, conversation_history, draft_summary, token_count, last_local_update_at, last_activity_at)
SELECT
  ms.facilitator_id,
  'facilitator' AS subject_key,
  COALESCE(ms.conversation_history, '[]'::jsonb) AS conversation_history,
  ms.draft_summary,
  ms.token_count,
  ms.last_local_update_at,
  COALESCE(ms.last_activity_at, NOW()) AS last_activity_at
FROM public.mentor_sessions ms
WHERE ms.facilitator_id IS NOT NULL
ON CONFLICT (facilitator_id, subject_key) DO NOTHING;

### 34. sidekick_pack_api_mentor_session.md (ab9dd909eefc0b62a0a2ba26a76d869ff384a78216e0798372cf19d1e7931cfc)
- bm25: -14.5883 | relevance: 1.0000

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

### 35. sidekick_pack_lessons_prefetch.md (f28fe750b7e3090327825fd12d82cf4d51aec8bd8a39c4edc9d8e79c9306f32c)
- bm25: -14.5231 | relevance: 1.0000

-- Verify the fix
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.mentor_sessions'::regclass
  AND conname = 'unique_active_session_per_facilitator';

### 36. sidekick_pack_lessons_prefetch.md (b9e0422bdc74b3db75b476a63cc859ec59938ba529756511ea22a3a2ccde5831)
- bm25: -14.4855 | relevance: 1.0000

### 27. sidekick_pack_api_mentor_session.md (ab9dd909eefc0b62a0a2ba26a76d869ff384a78216e0798372cf19d1e7931cfc)
- bm25: -14.9005 | relevance: 1.0000

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

### 37. sidekick_pack_planned_all.md (8c18d273e31d1f54b86a38b0b80a7ea0932a1cdd9244195c95b8f93d9c6572e5)
- bm25: -14.4801 | relevance: 1.0000

// Verify the learner belongs to this facilitator/owner
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 29. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (45ad3153982e21c4597a82d790e1dc8b4df1c281341a7a4840ed77990d34beff)
- bm25: -4.5437 | entity_overlap_w: 3.00 | adjusted: -5.2937 | relevance: 1.0000

const loadSchedule = useCallback(async (opts = {}) => {
    return loadScheduleForLearner(learnerId, opts)
  }, [learnerId, loadScheduleForLearner])

const loadPlanned = useCallback(async (opts = {}) => {
    return loadPlannedForLearner(learnerId, opts)
  }, [learnerId, loadPlannedForLearner])

const loadCalendarData = useCallback(async (opts = {}) => {
    await Promise.all([loadSchedule(opts), loadPlanned(opts)])
  }, [loadPlanned, loadSchedule])

const handleRemoveScheduledLessonById = async (scheduleId, opts = {}) => {
    if (!scheduleId) return
    if (!opts?.skipConfirm) {
      if (!confirm('Remove this lesson from the schedule?')) return
    }

try {
      const token = await getBearerToken()
      if (!token) return
      const deleteResponse = await fetch(
        `/api/lesson-schedule?id=${scheduleId}`,
        {
          method: 'DELETE',
          headers: {
            'authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

if (!deleteResponse.ok) throw new Error('Failed to remove lesson')
      await loadSchedule()
    } catch (err) {
      alert('Failed to remove lesson')
    }
  }

### 38. sidekick_pack_planned_all.md (c9639c55d65850af6293cd05a5ee181107e387cc171a16fac3f384c70094a148)
- bm25: -14.2269 | relevance: 1.0000

<div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowPlannerOverlay(true)}
                    disabled={!learnerId || learnerId === 'none'}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: (!learnerId || learnerId === 'none') ? '#f3f4f6' : '#111827',
                      color: (!learnerId || learnerId === 'none') ? '#9ca3af' : '#fff',
                      cursor: (!learnerId || learnerId === 'none') ? 'not-allowed' : 'pointer'
                    }}
                    title={(!learnerId || learnerId === 'none') ? 'Select a learner first' : 'Open the full Lesson Planner'}
                  >
                    Create a Lesson Plan
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                  {(!learnerId || learnerId === 'none')
                    ? 'Select a learner to view planned lessons'
                    : (selectedDate ? 'No planned lessons' : 'Select a date to view planned lessons')}
                </div>

### 39. sidekick_pack_mentor_sessions_sql.md (8b3c285b9b33424cd8963056e116cf124f94d4c84bd590a71be5c1b85cbc3184)
- bm25: -14.1985 | relevance: 1.0000

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

### 40. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (135fd9e5a7d904fae2c70355c050178da2f6000edb4b95e94ad918a4c892de20)
- bm25: -14.1172 | relevance: 1.0000

<div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowPlannerOverlay(true)}
                    disabled={!learnerId || learnerId === 'none'}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: (!learnerId || learnerId === 'none') ? '#f3f4f6' : '#111827',
                      color: (!learnerId || learnerId === 'none') ? '#9ca3af' : '#fff',
                      cursor: (!learnerId || learnerId === 'none') ? 'not-allowed' : 'pointer'
                    }}
                    title={(!learnerId || learnerId === 'none') ? 'Select a learner first' : 'Open the full Lesson Planner'}
                  >
                    Create a Lesson Plan
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                  {(!learnerId || learnerId === 'none')
                    ? 'Select a learner to view planned lessons'
                    : (selectedDate ? 'No planned lessons' : 'Select a date to view planned lessons')}
                </div>
