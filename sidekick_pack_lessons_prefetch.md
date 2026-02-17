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

### 3. sidekick_pack_calendar.md (e1260b37624b2715be0d2aa874920875ac6bf0e06f93fe12ab2bcb2346976220)
- bm25: -24.3352 | relevance: 1.0000

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

### 1. src/app/api/planned-lessons/route.js (13ab95e2c88ec5cc604a496e80fd74f45cb5f1a254133d4b8bd7639cc043e74b)
- bm25: -4.5542 | entity_overlap_w: 1.00 | adjusted: -4.8042 | relevance: 1.0000

// Delete existing planned lessons ONLY for dates in the new plan
    // This allows multiple non-overlapping plans to coexist
    if (newPlanDates.length > 0) {
      await adminSupabase
        .from('planned_lessons')
        .delete()
        .eq('learner_id', learnerId)
        .eq('facilitator_id', user.id)
        .in('scheduled_date', newPlanDates)
    }

### 2. src/app/api/planned-lessons/route.js (db1a9cc005c7ceee5fb09554e6f8802d9c3c6b43eda28afc6d987b8be33f1c49)
- bm25: -4.3282 | entity_overlap_w: 1.00 | adjusted: -4.5782 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

### 4. .github/copilot-instructions.md (e52caea170745fc1683b39903882c41423525bdca8f3020661944d316c296134)
- bm25: -23.7089 | relevance: 1.0000

Local health-check sequence:
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere --help`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project list`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

When answering architecture questions or planning changes:
1. Build an evidence pack first:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere pack "<question>" --project freehands --profile MsSonoma --out pack.md`
2. Use the pack’s chunk IDs as evidence anchors (the IDs are the provenance tokens).

### Asking Good Pack Questions (REQUIRED)

Do not ask abstract questions first. Anchor pack questions on one of:
- Exact error text / log line
- Route/path (e.g., `/session/discussion`, `/api/...`)
- File name / folder name
- Env var name
- UI label text
- Function/class identifier

Use these templates (copy/paste and fill in anchors):
- "Where is `<feature>` implemented end-to-end? List entrypoints, key files, and data flow."
- "Where is route `<route>` defined and what calls it? Include middleware and handlers."
- "Search for the exact string `<error or label>` and show the controlling code path."
- "What reads/writes `<data file or table>` and under what conditions?"
- "What configuration keys/env vars control `<system>` and where are they read?"
- "Given file `<path>`, what other modules depend on it (imports/calls) and why?"

If pack #1 doesn't contain the entrypoint you need:
1. Re-pack with a tighter anchor (prefer an exact string, route, or filename).
2. If still missing, ingest/sync the relevant subtree, then re-pack.

### 5. scripts/fix-mentor-sessions-constraint.sql (4dc766a6e79f877413a55badb56b9c5465b95213d58ad0870ca0fb6be097301c)
- bm25: -22.3268 | relevance: 1.0000

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

-- Function to deactivate old sessions when a new one is created
CREATE OR REPLACE FUNCTION deactivate_old_mentor_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- Deactivate all other sessions for this facilitator
  UPDATE public.mentor_sessions
  SET is_active = FALSE
  WHERE facilitator_id = NEW.facilitator_id
    AND id != NEW.id
    AND is_active = TRUE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

### 3. scripts/setup-mentor-sessions.sql (31afb0263b5558a382a0dcdba3cc50120e5e453cb20ca5d11f24299e8b7d64eb)
- bm25: -33.9236 | entity_overlap_w: 7.00 | adjusted: -35.6736 | relevance: 1.0000

-- Mr. Mentor Session Management
-- Single-device enforcement and conversation persistence

-- Create mentor_sessions table
CREATE TABLE IF NOT EXISTS public.mentor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL, -- Browser-generated unique session ID
  device_name TEXT, -- Optional device identifier
  conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_summary TEXT,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Only one active session per facilitator
  CONSTRAINT unique_active_session_per_facilitator UNIQUE (facilitator_id, is_active)
);

### 10. sidekick_pack_calendar.md (daec363789d11d6f4fd8250b18eeb4bd64a6be6f6507df08d3872e18ee5521f8)
- bm25: -18.2769 | relevance: 1.0000

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

### 1. sidekick_pack_takeover.md (95783bb288ad3033fe9c166cad976a0570a90d0f12d825373052a81d2d0da2b8)
- bm25: -4.5074 | entity_overlap_w: 10.10 | adjusted: -7.0324 | relevance: 1.0000

// Add user message to conversation
      const updatedHistory = [
        ...conversationHistory,
        { role: 'user', content: finalForwardMessage }
      ]
      setConversationHistory(updatedHistory)

// Display user message in captions
      setCaptionText(finalForwardMessage)
      setCaptionSentences([finalForwardMessage])
      setCaptionIndex(0)

### 25. sidekick_pack.md (5a7eda029235ebba21657c1b32873ddd8559fc8aed65721790b9dbfa5fd46a0d)
- bm25: -4.2444 | entity_overlap_w: 1.50 | adjusted: -4.6194 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

### 13. scripts/setup-mentor-sessions.sql (76419572d186bb374af9dfdf9f1b40251b639abdcfebe257c03215b4b394bc31)
- bm25: -17.8548 | relevance: 1.0000

-- Function to deactivate old sessions when a new one is created
CREATE OR REPLACE FUNCTION deactivate_old_mentor_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- Deactivate all other sessions for this facilitator
  UPDATE public.mentor_sessions
  SET is_active = FALSE
  WHERE facilitator_id = NEW.facilitator_id
    AND id != NEW.id
    AND is_active = TRUE;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

### 14. sidekick_pack_mentor_sessions_schema.md (fef6031c98645ee319cb58429c5d505811a51be91b950c356a138cc5ad943ec9)
- bm25: -17.0636 | relevance: 1.0000

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_facilitator ON public.mentor_sessions(facilitator_id);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_session_id ON public.mentor_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_active ON public.mentor_sessions(facilitator_id, is_active) WHERE is_active = TRUE;

### 15. sidekick_pack_takeover.md (43a876c4969af73582fdaf97e1ecc2d3ff1171f983087f27b2b9f814cd3cfd75)
- bm25: -16.6870 | relevance: 1.0000

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

### 39. sidekick_pack_planned_all.md (80c748684a01d5fcb48348b44514e2e51b5da42c9b018c454190dc86994a0269)
- bm25: -2.4963 | relevance: 1.0000

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

const loadPlannedLessons = async () => {
    if (!selectedLearnerId) return
    
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session?.access_token) return

const response = await fetch(
        `/api/planned-lessons?learnerId=${selectedLearnerId}`,
        {
          headers: {
            'authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      )

if (!response.ok) {
        setPlannedLessons({})
        return
      }
      
      const data = await response.json()
      setPlannedLessons(data.plannedLessons || {})
    } catch (err) {
      console.error('Error loading planned lessons:', err)
      setPlannedLessons({})
    }
  }

### 16. scripts/setup-mentor-sessions.sql (31afb0263b5558a382a0dcdba3cc50120e5e453cb20ca5d11f24299e8b7d64eb)
- bm25: -16.2885 | relevance: 1.0000

-- Mr. Mentor Session Management
-- Single-device enforcement and conversation persistence

-- Create mentor_sessions table
CREATE TABLE IF NOT EXISTS public.mentor_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL, -- Browser-generated unique session ID
  device_name TEXT, -- Optional device identifier
  conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_summary TEXT,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Only one active session per facilitator
  CONSTRAINT unique_active_session_per_facilitator UNIQUE (facilitator_id, is_active)
);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_facilitator ON public.mentor_sessions(facilitator_id);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_session_id ON public.mentor_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_active ON public.mentor_sessions(facilitator_id, is_active) WHERE is_active = TRUE;

-- RLS policies
ALTER TABLE public.mentor_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own sessions
CREATE POLICY "Users can manage their own mentor sessions"
  ON public.mentor_sessions
  FOR ALL
  USING (auth.uid() = facilitator_id)
  WITH CHECK (auth.uid() = facilitator_id);

### 17. sidekick_pack_mentor_route.md (c5573c182949c3e4b375da5e02fc850631a6175002ce78347d15646082e99491)
- bm25: -16.2776 | relevance: 1.0000

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

contextText += '\n\nWhen you choose a REVIEW lesson:'
          contextText += '\n- It can revisit the underlying concept of a low-score lesson'
          contextText += '\n- It MUST be rephrased with different examples and practice (not a near-duplicate)'
          contextText += "\n- The title MUST start with 'Review:'"

contextText += '\n\nAlso: you are generating a multi-week plan.'
          contextText += '\nFor weekly recurring subjects, each week MUST progress naturally.'
          contextText += "\nDo not repeat last week's topic unless it is explicitly a 'Review:' for a low-score concept."

contextText += '\n\nCurriculum Evolution Guidelines:'
          contextText += '\n- Mix new instruction with occasional review based on scores'
          contextText += '\n- Build sequentially (e.g., after "Fractions Intro" → "Comparing Fractions" → "Adding Fractions")'
          contextText += '\n- Reference prior concepts but teach something genuinely new'
          contextText += `\n- Target difficulty: ${recommendedDifficulty} (maintain for 3-4 lessons before advancing)`

### 20. sidekick_pack.md (dda9f346feed492a4539e96db18729a8c954f59794173bfcc11276a5e4712fa3)
- bm25: -15.7019 | relevance: 1.0000

const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (pinCode.length !== 4) {
      setError('PIN must be 4 digits')
      return
    }

setError('')
    setLoading(true)

try {
      await onTakeover(pinCode)
    } catch (err) {
      setError(err.message || 'Failed to take over session')
      setLoading(false)
    }
  }

### 4. sidekick_pack_mentor_route.md (c5573c182949c3e4b375da5e02fc850631a6175002ce78347d15646082e99491)
- bm25: -4.7486 | entity_overlap_w: 6.90 | adjusted: -6.4736 | relevance: 1.0000

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

### 22. src/app/facilitator/generator/counselor/CounselorClient.jsx (8739feacbd7833fd3c560b3dc70603b21d27cf2228702c77dd85b2093f3dfc18)
- bm25: -15.5773 | relevance: 1.0000

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

### 23. sidekick_pack_calendar.md (5c380a01e2f9ba9c992f2a7c9e8a9e5293956b3a263df08f6f6b4786875ba2f8)
- bm25: -15.1949 | relevance: 1.0000

return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Title and Workflow Guide */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>
          Create a Lesson Plan
        </h2>
        <WorkflowGuide
          workflowKey="lesson-planner-workflow"
          title="How Automated Lesson Planning Works"
          steps={[
            { 
              step: 'Set your weekly pattern', 
              description: 'Check which subjects you want to teach on each day of the week below' 
            },
            { 
              step: 'Choose start date and duration', 
              description: 'Select when to begin and how many weeks/months to plan' 
            },
            { 
              step: 'Generate lesson plan', 
              description: 'We create lesson outlines based on your learner\'s history and grade level' 
            },
            { 
              step: 'Review and generate full lessons', 
              description: 'Click dates in the calendar to see planned lessons. Generate full lesson content for any outline you like' 
            }
          ]}
        />
      </div>

### 24. sidekick_pack_mentor_sessions_sql.md (2b2e1c21c9fde203d49a014d6745c46b0521b8b806a4093505b0ce3322d9df47)
- bm25: -15.0910 | relevance: 1.0000

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

### 25. sidekick_pack_mentor_route.md (86168cedd50e00fee26d998d716eff67125185bfdd10716ca8d125c82b53c5c3)
- bm25: -15.0860 | relevance: 1.0000

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

### 26. sidekick_pack_mentor_sessions_schema.md (a8f754dbfb6141b4e42674cf9bbda2c9a59c28248df5b215d463c9c48fcede48)
- bm25: -15.0691 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Using scripts/setup-mentor-sessions.sql and scripts/fix-mentor-sessions-constraint.sql, summarize mentor_sessions schema and constraints. We need to support multiple active conversations per facilitator: one facilitator subject and one per learner; but still enforce single owning device per subject. Propose minimal schema change.
```

Filter terms used:
```text
scripts/fix-mentor-sessions-constraint.sql
scripts/setup-mentor-sessions.sql
constraint.sql
sessions.sql
mentor_sessions
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

scripts/fix-mentor-sessions-constraint.sql scripts/setup-mentor-sessions.sql constraint.sql sessions.sql mentor_sessions

## Forced Context

(none)

## Ranked Evidence

### 1. scripts/fix-mentor-sessions-constraint.sql (4dc766a6e79f877413a55badb56b9c5465b95213d58ad0870ca0fb6be097301c)
- bm25: -53.1166 | entity_overlap_w: 5.00 | adjusted: -54.3666 | relevance: 1.0000

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

if (!createRes.ok) {
          throw new Error(createData?.error || 'Failed to initialize mentor session')
        }

const createdSession = createData.session || createData

### 28. src/app/facilitator/calendar/LessonPlanner.jsx (fd591deb67440b85e69d10a8c0629a0abe24abd9a3d4d3f92016c00b9d8bf080)
- bm25: -14.8336 | relevance: 1.0000

const allSubjects = [...CORE_SUBJECTS, ...customSubjects.map(s => s.name)]

return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Title and Workflow Guide */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>
          Create a Lesson Plan
        </h2>
        <WorkflowGuide
          workflowKey="lesson-planner-workflow"
          title="How Automated Lesson Planning Works"
          steps={[
            { 
              step: 'Set your weekly pattern', 
              description: 'Check which subjects you want to teach on each day of the week below' 
            },
            { 
              step: 'Choose start date and duration', 
              description: 'Select when to begin and how many weeks/months to plan' 
            },
            { 
              step: 'Generate lesson plan', 
              description: 'We create lesson outlines based on your learner\'s history and grade level' 
            },
            { 
              step: 'Review and generate full lessons', 
              description: 'Click dates in the calendar to see planned lessons. Generate full lesson content for any outline you like' 
            }
          ]}
        />
      </div>

### 29. sidekick_pack_takeover.md (d2b72071b1a2c2c6817565e96ed76f09ce317391276449fdde4792537f9e2326)
- bm25: -14.7237 | relevance: 1.0000

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

### 30. .github/copilot-instructions.md (44978fc34c4002e594b02db48cccc5e17f7dcf7c335bd15c95e11e72797c2f0a)
- bm25: -13.9272 | relevance: 1.0000

- Use Sidekick for quick health + linkage checks (good first move before edits):
   - `py -m cohere sk a -a MsSonoma` (audit: inconsistencies, missing context, broken connections)
   - `py -m cohere sk f -a MsSonoma` (forecast: problems + opportunities)
   - If useful for Copilot context: write into the workspace and open the file:
      - `py -m cohere sk a -a MsSonoma --out sidekick_latest.txt --out-format text`

## Isolation (Required)

This workspace MUST use an isolated Cohere home so it does not share DB/blobs/history with other apps.

- Required env var (PowerShell): `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"`
- After setting it, run all Cohere commands normally (examples below).

Notes:
- If `COHERE_HOME` is not set, Cohere will fall back to the shared default (`%USERPROFILE%\.coherence\`) which is NOT allowed for this workspace.
- First-time setup in a fresh isolated home may require `project add` and an initial `ingest`/`sync`.

### Cohere Gate (Do This First)

For any question about how the code works, debugging, or architecture: you MUST run a Cohere pack first and use chunk IDs as evidence.
- If you cannot run Cohere in this session, say that explicitly and ask the user to run `py -m cohere doctor --project freehands`.

This repo uses the local `cohere` tool (in the sibling Cohere workspace) as the mechanical source-of-truth for:
- Lossless blobs + DB head state
- Deterministic extracted text + chunks
- Evidence packs (context packs)
- Audited change packs (apply/rollback provenance)

### Cohere Is Local (Not “Online”)

### 31. sidekick_pack_mentor_sessions_schema.md (8ca6872e914a91ad0c11c0fbf1ad6c9d33a4f105d1bcb681e0813b5c3df9bebc)
- bm25: -13.9058 | relevance: 1.0000

-- Verify the fix
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.mentor_sessions'::regclass
  AND conname = 'unique_active_session_per_facilitator';

### 32. sidekick_pack_takeover.md (a4b65677b8e3cca433db02b9826531f7c6fec24256a6a07229654155ff63b249)
- bm25: -13.7079 | relevance: 1.0000

### 10. src/app/facilitator/generator/counselor/CounselorClient.jsx (1870a42fb8ca4d587dbffcbca54113385c1767e002b536685ae700643ebd8e1d)
- bm25: -8.9024 | relevance: 1.0000

if (response.ok && !cancelled) {
          const data = await response.json()
          if (data.draft?.draft_summary) {
            setDraftSummary(data.draft.draft_summary)
          }
        }
      } catch (err) {
        // Silent error handling
      }
    })()
    
    return () => { cancelled = true }
  }, [accessToken, tierChecked, selectedLearnerId])

// Preload overlay data in background after page is ready
  useEffect(() => {
    if (!tierChecked || !accessToken) return
    
    // Delay preload to let visible content load first
    const preloadTimer = setTimeout(() => {
      // Trigger loads by dispatching events to overlays
      window.dispatchEvent(new CustomEvent('preload-overlays', { 
        detail: { learnerId: selectedLearnerId } 
      }))
    }, 1000) // 1 second delay after page load
    
    return () => clearTimeout(preloadTimer)
  }, [accessToken, tierChecked, selectedLearnerId])

// Dispatch title to header (like session page)
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.dispatchEvent(new CustomEvent('ms:session:title', { detail: 'Mr. Mentor' }))
    } catch {}
    return () => {
      try {
        window.dispatchEvent(new CustomEvent('ms:session:title', { detail: '' }))
      } catch {}
    }
  }, [])

// Generate and persist unique session ID on mount
  useEffect(() => {
    if (typeof window === 'undefined') return

let resolvedId = null

try {
      resolvedId = localStorage.getItem('mr_mentor_active_session_id')
    } catch (err) {
      // Silent error handling
    }

### 33. src/app/facilitator/calendar/page.js (0a377186862f438af1cc355b6434ce533b912b26ddfc368cb5a3ca5eecb19ddc)
- bm25: -13.6889 | relevance: 1.0000

{/* Day View Overlay */}
            {showDayView && selectedDate && (
              <DayViewOverlay
                selectedDate={selectedDate}
                scheduledLessons={scheduledLessons[selectedDate] || []}
                plannedLessons={plannedLessons[selectedDate] || []}
                learnerId={selectedLearnerId}
                learnerGrade={learners.find(l => l.id === selectedLearnerId)?.grade || '3rd'}
                tier={tier}
                noSchoolReason={noSchoolDates[selectedDate] || null}
                onClose={() => setShowDayView(false)}
                onLessonGenerated={() => {
                  loadSchedule()
                  loadNoSchoolDates()
                }}
                onNoSchoolSet={handleNoSchoolSet}
                onPlannedLessonUpdate={handlePlannedLessonUpdate}
                onPlannedLessonRemove={handlePlannedLessonRemove}
              />
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <p className="text-gray-600">No learners found. Add learners first.</p>
            <button
              onClick={() => router.push('/facilitator/learners')}
              className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 transition"
            >
              Manage Learners
            </button>
          </div>
        )}
      </div>
    </div>
    
    <GatedOverlay
      show={!isAuthenticated}
      gateType="auth"
      feature="Lesson Calendar"
      emoji="📅"
      description="Sign in to schedule lessons, plan learning activities, and track completion over time."
      benefits={[
        'Schedule lessons in advance for each learner',
        'View all scheduled lessons in a monthly calend

### 34. src/app/api/planned-lessons/route.js (7f4030d9bf7a1414ad7d0582b42b03e4f7424290402ad9566f507a6ded607bdf)
- bm25: -13.5474 | relevance: 1.0000

// Verify the learner belongs to this facilitator/owner.
    // Planned lessons are treated as per-learner data (not per-facilitator), but still require authorization.
    const { data: learner, error: learnerError } = await adminSupabase
      .from('learners')
      .select('id')
      .eq('id', learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

### 35. src/app/api/planned-lessons/route.js (146c46c2ac9daf4464d5c46347f5662137c1074fa42a8e7030c5330b92a8e553)
- bm25: -13.3256 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

// Fetch planned lessons for this learner.
    // Default behavior matches the facilitator calendar page:
    //   - Primary: scoped to this facilitator.
    //   - Fallback: if there are legacy rows under a single different facilitator_id, return them (read compatibility).
    // includeAll=1 mode intentionally returns *all* planned_lessons rows for the learner (authorized),
    // to surface legacy/other-namespace plans (e.g., 2026) without changing the default UI behavior.
    let data = null
    let error = null

if (includeAll) {
      const all = await adminSupabase
        .from('planned_lessons')
        .select('*')
        .eq('learner_id', learnerId)
        .order('scheduled_date', { ascending: true })

data = all.data
      error = all.error
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    } else {
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

### 36. sidekick_pack.md (eb935820d503d08b4f59d766c9d329ae4e33178828aef28b4e56ce180a55408d)
- bm25: -13.0312 | relevance: 1.0000

// Check if THIS session was deactivated (taken over)
        if (updatedSession.session_id === mySessionId && oldSession.is_active && !updatedSession.is_active) {
          console.log('[Realtime] THIS SESSION taken over - showing PIN overlay')
          
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
              const checkRes = await fetch(`/api/mentor-session?subjectKey=${encodeURIComponent(subjectKey)}`, {
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
            isSameSession: updatedSession.session_id === mySessionId,
            wasActive: oldSession.is_active,
            isActive: updatedSession.is_active
          })
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

### 37. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (678fc9164b378a09b6e102a9357522a6f1bffad00943fcc9d0e950694fbda1b5)
- bm25: -12.9342 | relevance: 1.0000

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

const todayStr = getLocalTodayStr()
    const scheduledDates = Object.keys(scheduledLessons || {}).filter((d) => (scheduledLessons?.[d]?.length || 0) > 0)
    const plannedDates = Object.keys(plannedLessons || {}).filter((d) => (plannedLessons?.[d]?.length || 0) > 0)

const scheduledUpcoming = scheduledDates.filter((d) => d >= todayStr)
    const plannedUpcoming = plannedDates.filter((d) => d >= todayStr)

// Prefer showing the tab that has UPCOMING lessons. A single old completed scheduled item
    // shouldn't prevent the overlay from auto-switching to a planned week in the future.
    if (listTab === 'scheduled' && scheduledUpcoming.length === 0 && plannedUpcoming.length > 0) {
      setListTab('planned')
    } else if (listTab === 'planned' && plannedUpcoming.length === 0 && scheduledUpcoming.length > 0) {
      setListTab('scheduled')
    } else if (listTab === 'scheduled' && scheduledDates.length === 0 && plannedDates.length > 0) {
      setListTab('planned')
    } else if (listTab === 'planned' && plannedDates.length === 0 && scheduledDates.length > 0) {
      setListTab('scheduled')
    }
  }, [learnerId, listTab, scheduledLessons, plannedLessons])

### 38. src/app/facilitator/generator/counselor/CounselorClient.jsx (db9884f3827e3099ce9f19e3b519ee93556d91572e153d15caf03a2ebb18f42b)
- bm25: -12.9039 | relevance: 1.0000

// Check if THIS session was deactivated (taken over)
        if (updatedSession.session_id === mySessionId && oldSession.is_active && !updatedSession.is_active) {
          console.log('[Realtime] THIS SESSION taken over - showing PIN overlay')
          
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
              const checkRes = await fetch(`/api/mentor-session?subjectKey=${encodeURIComponent(subjectKey)}`, {
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
            isSameSession: updatedSession.session_id === mySessionId,
            wasActive: oldSession.is_active,
            isActive: updatedSession.is_active
          })
        }
      })
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status)
      })

### 39. .github/copilot-instructions.md (5881b38a2bf6f0706d17a2c60153172fdd6bb3f02d202b178ebc202c9e440520)
- bm25: -12.6819 | relevance: 1.0000

When making code/doc changes “for real”:
1. Ensure head is current for touched files (pick one):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
   - or `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sync --project freehands` if the working tree may have drifted
2. Prefer generating and applying a change pack linked to evidence:
   - edit file(s) in working tree
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere change new --project freehands --file <relpath> --pack pack.md --out change.json --summary "..."`
   - restore the base file(s) to match DB head (clean base), then:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere apply --project freehands change.json`
3. If anything goes wrong, rollback by change id:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere rollback --project freehands --change-id <id>`
4. Run integrity checks after non-trivial work:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

### 40. sidekick_pack_mentor_schema.md (7b9e34a5f9903cdaa3183773337bc2ab39af5dc019f6678858d9220d46e15e9b)
- bm25: -12.6688 | relevance: 1.0000

let events = []
    try {
      let eventsQueryBase = () => {
        let q = supabase
          .from('lesson_session_events')
          .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
          .eq('learner_id', learnerId)

if (fromIso) q = q.gte('occurred_at', fromIso)
        if (toExclusiveIso) q = q.lt('occurred_at', toExclusiveIso)

return q.order('occurred_at', { ascending: false })
      }

### 28. src/app/facilitator/generator/counselor/CounselorClient.jsx (174b7ff50955eb6cc8e15301c9d45c27764e03725c38994bd8f2f4fed1db44af)
- bm25: -4.2855 | relevance: 1.0000

### 15. src/app/api/planned-lessons/route.js (146c46c2ac9daf4464d5c46347f5662137c1074fa42a8e7030c5330b92a8e553)
- bm25: -3.0319 | entity_overlap_w: 3.00 | adjusted: -3.7819 | relevance: 1.0000

if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

// Fetch planned lessons for this learner.
    // Default behavior matches the facilitator calendar page:
    //   - Primary: scoped to this facilitator.
    //   - Fallback: if there are legacy rows under a single different facilitator_id, return them (read compatibility).
    // includeAll=1 mode intentionally returns *all* planned_lessons rows for the learner (authorized),
    // to surface legacy/other-namespace plans (e.g., 2026) without changing the default UI behavior.
    let data = null
    let error = null

if (includeAll) {
      const all = await adminSupabase
        .from('planned_lessons')
        .select('*')
        .eq('learner_id', learnerId)
        .order('scheduled_date', { ascending: true })
