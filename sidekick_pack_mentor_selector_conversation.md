# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Does Mr Mentor conversation change when learner selector changes? Trace selectedLearnerId -> subjectKey -> mentor_sessions load/save. Confirm one conversation per facilitator subject and one per learner.
```

Filter terms used:
```text
mentor_sessions
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

mentor_sessions

## Forced Context

(none)

## Ranked Evidence

### 1. scripts/setup-mentor-sessions.sql (b47c0f98c6499b5d8e84419cec1ec0ee1a3db140b8f0f15efa91d58dd69f8646)
- bm25: -4.3994 | entity_overlap_w: 7.00 | adjusted: -6.1494 | relevance: 1.0000

-- Trigger to automatically deactivate old sessions
DROP TRIGGER IF EXISTS trigger_deactivate_old_mentor_sessions ON public.mentor_sessions;
CREATE TRIGGER trigger_deactivate_old_mentor_sessions
  AFTER INSERT ON public.mentor_sessions
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE)
  EXECUTE FUNCTION deactivate_old_mentor_sessions();

-- Grant permissions
GRANT ALL ON public.mentor_sessions TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

COMMENT ON TABLE public.mentor_sessions IS 'Tracks active Mr. Mentor sessions - enforces single device per facilitator';
COMMENT ON COLUMN public.mentor_sessions.session_id IS 'Browser-generated unique ID for this session instance';
COMMENT ON COLUMN public.mentor_sessions.conversation_history IS 'Full conversation history as JSON array';
COMMENT ON COLUMN public.mentor_sessions.is_active IS 'Only one active session allowed per facilitator at a time';

### 2. sidekick_pack_mentor_sessions_schema.md (a15c9151898b17b6b69dc9c11f351335dfb390974dbd228bee539cfff9b9ab11)
- bm25: -4.0755 | entity_overlap_w: 8.00 | adjusted: -6.0755 | relevance: 1.0000

### 7. sidekick_pack_mentor_sessions_sql.md (8b3c285b9b33424cd8963056e116cf124f94d4c84bd590a71be5c1b85cbc3184)
- bm25: -25.4032 | entity_overlap_w: 8.00 | adjusted: -27.4032 | relevance: 1.0000

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

### 3. sidekick_pack_mentor_sessions_sql.md (8b3c285b9b33424cd8963056e116cf124f94d4c84bd590a71be5c1b85cbc3184)
- bm25: -3.9626 | entity_overlap_w: 8.00 | adjusted: -5.9626 | relevance: 1.0000

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

### 4. scripts/setup-mentor-sessions.sql (31afb0263b5558a382a0dcdba3cc50120e5e453cb20ca5d11f24299e8b7d64eb)
- bm25: -4.2045 | entity_overlap_w: 7.00 | adjusted: -5.9545 | relevance: 1.0000

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

### 5. sidekick_pack_lessons_prefetch.md (d167179868aa584556af06fbe30a6af0102e5ff7a5d239da80bf8770fe182456)
- bm25: -4.0865 | entity_overlap_w: 7.00 | adjusted: -5.8365 | relevance: 1.0000

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

### 6. sidekick_pack_mentor_sessions_schema.md (a8f754dbfb6141b4e42674cf9bbda2c9a59c28248df5b215d463c9c48fcede48)
- bm25: -4.2338 | entity_overlap_w: 6.00 | adjusted: -5.7338 | relevance: 1.0000

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

### 7. sidekick_pack_lessons_prefetch.md (b0573c71adf742623aaa82bd0a7fe8c39d94c604f77a8a8ba3983bd4e22062f8)
- bm25: -4.2249 | entity_overlap_w: 5.00 | adjusted: -5.4749 | relevance: 1.0000

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

### 8. scripts/fix-mentor-sessions-constraint.sql (4dc766a6e79f877413a55badb56b9c5465b95213d58ad0870ca0fb6be097301c)
- bm25: -3.9788 | entity_overlap_w: 5.00 | adjusted: -5.2288 | relevance: 1.0000

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

### 9. scripts/add-mentor-conversation-threads.sql (d8f572ba57c750ca989a6b7871e4c27d4ec7bdba0a730c1dae25cdf7d15a9e99)
- bm25: -3.6689 | entity_overlap_w: 6.00 | adjusted: -5.1689 | relevance: 1.0000

-- Adds server-backed device identity and per-subject conversation threads for Mr. Mentor.
--
-- Rationale:
-- - Ownership/takeover is enforced by mentor_sessions (single active row per facilitator).
-- - Conversations must be separate per subject (facilitator vs each learner), and persist across devices.
-- - Device identity must NOT rely on localStorage; the API uses an HttpOnly cookie and stores device_id on mentor_sessions.

-- 1) Add device_id to mentor_sessions (used for ownership checks)
ALTER TABLE public.mentor_sessions
  ADD COLUMN IF NOT EXISTS device_id TEXT;

CREATE INDEX IF NOT EXISTS idx_mentor_sessions_device_id
  ON public.mentor_sessions(device_id);

COMMENT ON COLUMN public.mentor_sessions.device_id IS 'Stable device identifier (from HttpOnly cookie) for ownership checks.';

-- 2) Create mentor_conversation_threads table (one row per facilitator + subject_key)
CREATE TABLE IF NOT EXISTS public.mentor_conversation_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_key TEXT NOT NULL,
  conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  draft_summary TEXT,
  token_count INT,
  last_local_update_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

CONSTRAINT unique_mentor_conversation_thread UNIQUE (facilitator_id, subject_key)
);

CREATE INDEX IF NOT EXISTS idx_mentor_conversation_threads_facilitator
  ON public.mentor_conversation_threads(facilitator_id);

CREATE INDEX IF NOT EXISTS idx_mentor_conversation_threads_subject
  ON public.mentor_conversation_threads(subject_key);

### 10. sidekick_pack_mentor_sessions_schema.md (fef6031c98645ee319cb58429c5d505811a51be91b950c356a138cc5ad943ec9)
- bm25: -4.4136 | entity_overlap_w: 3.00 | adjusted: -5.1636 | relevance: 1.0000

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_facilitator ON public.mentor_sessions(facilitator_id);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_session_id ON public.mentor_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_mentor_sessions_active ON public.mentor_sessions(facilitator_id, is_active) WHERE is_active = TRUE;

### 11. sidekick_pack_lessons_prefetch.md (de15dcc98e39160e5ebd3f2059146de1e210796211b02079471cd6e4f66a2031)
- bm25: -4.1151 | entity_overlap_w: 4.00 | adjusted: -5.1151 | relevance: 1.0000

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

### 12. sidekick_pack_mentor_sessions_schema.md (2aaab68a56d22bfe5dde99b9154dcba7fa987d48a6644e68ed702cd8d10ef17b)
- bm25: -4.1019 | entity_overlap_w: 4.00 | adjusted: -5.1019 | relevance: 1.0000

-- RLS policies
ALTER TABLE public.mentor_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own sessions
CREATE POLICY "Users can manage their own mentor sessions"
  ON public.mentor_sessions
  FOR ALL
  USING (auth.uid() = facilitator_id)
  WITH CHECK (auth.uid() = facilitator_id);

### 4. sidekick_pack_mentor_sessions_sql.md (1b6d957a2e3e704f3ee42ee4b9595e7232598e0ce935ecb1cfd350114c6b5af1)
- bm25: -32.6377 | relevance: 1.0000

{/* Database Setup Warning */}
        {!tableExists && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
            <h3 className="text-yellow-800 font-semibold mb-2">⚠️ Database Setup Required</h3>
            <p className="text-yellow-700 text-sm mb-3">
              The lesson_schedule table hasn&apos;t been created yet. Please run the migration in your Supabase SQL Editor:
            </p>
            <code className="block bg-yellow-100 text-yellow-900 p-2 rounded text-xs mb-2">
              scripts/add-lesson-schedule-table.sql
            </code>
            <p className="text-yellow-700 text-xs">
              After running the migration, refresh this page.
            </p>
          </div>
        )}

### 5. scripts/setup-mentor-sessions.sql (b47c0f98c6499b5d8e84419cec1ec0ee1a3db140b8f0f15efa91d58dd69f8646)
- bm25: -30.2638 | entity_overlap_w: 7.00 | adjusted: -32.0138 | relevance: 1.0000

-- Trigger to automatically deactivate old sessions
DROP TRIGGER IF EXISTS trigger_deactivate_old_mentor_sessions ON public.mentor_sessions;
CREATE TRIGGER trigger_deactivate_old_mentor_sessions
  AFTER INSERT ON public.mentor_sessions
  FOR EACH ROW
  WHEN (NEW.is_active = TRUE)
  EXECUTE FUNCTION deactivate_old_mentor_sessions();

### 13. sidekick_pack_mentor_sessions_schema.md (455339344562db47239e8d791c805dc4f86ca4acf57144996acddf4d5af3842f)
- bm25: -3.8613 | entity_overlap_w: 4.00 | adjusted: -4.8613 | relevance: 1.0000

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

### 14. sidekick_pack_mentor_sessions_schema.md (fc8c085ec97dc6320cb11dc1f53a891c122664b47132b40af714105f1cbfcc4b)
- bm25: -3.7383 | entity_overlap_w: 4.00 | adjusted: -4.7383 | relevance: 1.0000

COMMENT ON TABLE public.mentor_sessions IS 'Tracks active Mr. Mentor sessions - enforces single device per facilitator';
COMMENT ON COLUMN public.mentor_sessions.session_id IS 'Browser-generated unique ID for this session instance';
COMMENT ON COLUMN public.mentor_sessions.conversation_history IS 'Full conversation history as JSON array';
COMMENT ON COLUMN public.mentor_sessions.is_active IS 'Only one active session allowed per facilitator at a time';

### 6. sidekick_pack_mentor_sessions_sql.md (8ce0d1f25cafb569aa5b5502a1fc3486a475ec421946b0377d9e27ab928e814e)
- bm25: -27.8404 | relevance: 1.0000

### 5. sidekick_pack_calendar.md (5664748c8577fd0132da3c25664f52295fd4045d681f2dc40fb2b982e6013bfb)
- bm25: -5.2136 | entity_overlap_w: 1.30 | adjusted: -5.5386 | relevance: 1.0000

return (
    <>
      <div style={{ minHeight: '100vh', background: '#f9fafb', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 12 }}>

{/* Database Setup Warning */}
        {!tableExists && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
            <h3 className="text-yellow-800 font-semibold mb-2">⚠️ Database Setup Required</h3>
            <p className="text-yellow-700 text-sm mb-3">
              The lesson_schedule table hasn&apos;t been created yet. Please run the migration in your Supabase SQL Editor:
            </p>
            <code className="block bg-yellow-100 text-yellow-900 p-2 rounded text-xs mb-2">
              scripts/add-lesson-schedule-table.sql
            </code>
            <p className="text-yellow-700 text-xs">
              After running the migration, refresh this page.
            </p>
          </div>
        )}

### 15. sidekick_pack_mentor_sessions_schema.md (5cad9584cc10cb6fa6e1d1d147fe0492b68dbd9ea5852fd9c24e5bc271e8b086)
- bm25: -3.6862 | entity_overlap_w: 3.00 | adjusted: -4.4362 | relevance: 1.0000

### 16. sidekick_pack_mentor_route.md (76a887c3c0ba6ad8c836e9ab062298f081ae5c0f4868a206f25938dd5ae94aef)
- bm25: -3.1829 | entity_overlap_w: 2.00 | adjusted: -3.6829 | relevance: 1.0000

### 26. sidekick_pack_mentor_sessions_sql.md (ba3128820823919541969f1110abb8238adcad2994a66c4a52e068438a0acf0d)
- bm25: -21.3627 | relevance: 1.0000

### 7. sidekick_pack_mentor_schema.md (20964756447856c4b54bc7a24dc03acdc743245d776b43f66f6b31491a402542)
- bm25: -3.7301 | entity_overlap_w: 3.00 | adjusted: -4.4801 | relevance: 1.0000

### 27. sidekick_pack_mentor_sessions_sql.md (c7718ada04b12fdbe00d6386ed38c6709b164ec1a7dbc624165548945bd08a03)
- bm25: -21.3627 | relevance: 1.0000

### 18. sidekick_pack_mentor_schema.md (661dede2825481fe04da276df9d1294c9bc19136484ed719412fc5ecb44259a9)
- bm25: -3.3308 | entity_overlap_w: 1.00 | adjusted: -3.5808 | relevance: 1.0000

### 28. sidekick_pack_mentor_schema.md (196c63713c4aa7d09c019526c84b777f409e64c0e86b6560172bfc378cef7622)
- bm25: -20.4213 | entity_overlap_w: 3.00 | adjusted: -21.1713 | relevance: 1.0000

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

### 16. sidekick_pack_mentor_sessions_sql.md (9e3d826b99092d1efd71847656e46e2700305aa41dc798a69c60fca379a2d700)
- bm25: -3.5732 | entity_overlap_w: 3.00 | adjusted: -4.3232 | relevance: 1.0000

async function deactivateSessionById(sessionId) {
  const { error } = await supabase
    .from('mentor_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)

### 9. src/app/api/mentor-session/route.js (94734a3f1ba8be99816f2ae459b0b54476c9de2628a55b95bb8dc269c1404500)
- bm25: -3.9482 | entity_overlap_w: 1.00 | adjusted: -4.1982 | relevance: 1.0000

const ids = staleSessions.map((session) => session.id)
    const { error: deactivateError } = await supabase
      .from('mentor_sessions')
      .update({ is_active: false })
      .in('id', ids)

### 10. sidekick_pack_mentor_route.md (828cc0b263a112b66f0ba45a82962bd6203b9933e7269476cbf299b3a75a4a94)
- bm25: -3.7382 | entity_overlap_w: 1.00 | adjusted: -3.9882 | relevance: 1.0000

// Delete only active sessions (is_active = true)
    // Saved conversations (is_active = false) are preserved
    const { data: deletedRows, error } = await supabase
      .from('mentor_sessions')
      .delete()
      .eq('facilitator_id', user.id)
      .eq('is_active', true)
      .select()

### 11. src/app/api/mentor-session/route.js (46494cc702c4a2148df586a477d0e85379e6bdd0af7f5b7d39f25aebbbe02c46)
- bm25: -3.4399 | entity_overlap_w: 2.00 | adjusted: -3.9399 | relevance: 1.0000

### 17. sidekick_pack_mentor_sessions_schema.md (376699d7c59830d2a5949bf0d7bd872f335409b8ab63ff03783e42283a87dbf1)
- bm25: -3.9218 | entity_overlap_w: 1.00 | adjusted: -4.1718 | relevance: 1.0000

if (updateError) {
          return Response.json({ error: 'Failed to update session' }, { status: 500 })
        }

### 15. sidekick_pack_mentor_sessions_sql.md (bc21c825efb23dec0df950725b103ca88f8e85a42a950547e61f3d42697756dd)
- bm25: -22.4298 | relevance: 1.0000

if (updateError) {
          return Response.json({ error: 'Failed to update session' }, { status: 500 })
        }

### 16. sidekick_pack_mentor_sessions_sql.md (981b3e76b43924a0bf4bc6c25ee885b277252b6c4e33dbbb96ebb99df7e9fe34)
- bm25: -22.2885 | relevance: 1.0000

function isSessionStale(session, referenceMs = Date.now()) {
  // Sessions never go stale - conversations persist indefinitely
  // Only manual actions (delete/save/export) should clear them
  return false
}

### 17. sidekick_pack_mentor_sessions_sql.md (7f51c10005862bb1a1649d411062518457998c30793124f9e35b0346e74604b4)
- bm25: -21.9071 | entity_overlap_w: 1.00 | adjusted: -22.1571 | relevance: 1.0000

const { data: targetSessions, error: targetFetchError } = await supabase
        .from('mentor_sessions')
        .select('id, session_id')
        .eq('facilitator_id', user.id)
        .eq('session_id', targetId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

### 18. sidekick_pack_mentor_sessions_sql.md (5924f232cdb173f30ee17d4fdcf7fdfc020644536edd38d3cec5da492ac01e44)
- bm25: -22.0371 | relevance: 1.0000

// If no active session, return null
    if (!activeSession) {
      return Response.json({ 
        session: null,
        status: 'none'
      })
    }

### 19. sidekick_pack_mentor_sessions_sql.md (3d8dc32d5929f2cfdee8cda4ba8bed5f91180c1ebbf95657bab592bc0b753a25)
- bm25: -21.7829 | relevance: 1.0000

### 18. sidekick_pack_mentor_sessions_schema.md (0ea966e67a9f607d11d880863699759c5c09ce3da919072850f413ae68686ba2)
- bm25: -3.9211 | entity_overlap_w: 1.00 | adjusted: -4.1711 | relevance: 1.0000

-- Grant permissions
GRANT ALL ON public.mentor_sessions TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

### 19. sidekick_pack_mentor_sessions_sql.md (1974a656fb5c7a0b03782cbe67151a0575d6a9ab68dc2f12cec5e0eec2a81d9c)
- bm25: -3.3799 | entity_overlap_w: 3.00 | adjusted: -4.1299 | relevance: 1.0000

console.log('[Realtime] Starting subscription for session:', sessionId, 'user:', user.id)

// Subscribe to mentor_sessions changes for this facilitator
    // Note: Can't filter by session_id in postgres_changes, so we filter in the callback
    const channel = supabase
      .channel('mentor-session-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'mentor_sessions'
      }, (payload) => {
        console.log('[Realtime] RAW event received:', {
          event: payload.eventType,
          table: payload.table,
          hasNew: !!payload.new,
          hasOld: !!payload.old
        })

if (!isMountedRef.current) {
          console.log('[Realtime] Ignoring - component unmounted')
          return
        }

const updatedSession = payload.new
        const oldSession = payload.old

### 13. sidekick_pack_mentor_route.md (21bb19fb47ac611a80afe9a7c03c8bdc818ea7e80fdf508d53c2f4b17493dc0a)
- bm25: -3.4791 | entity_overlap_w: 1.00 | adjusted: -3.7291 | relevance: 1.0000

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

### 14. sidekick_pack_mentor_schema.md (f6b2b7547966f39796186062891b73192dacedd669baf1255c0407971e2d0b1b)
- bm25: -3.4791 | entity_overlap_w: 1.00 | adjusted: -3.7291 | relevance: 1.0000

### 20. sidekick_pack_mentor_sessions_sql.md (9b7bf4ebbe718ab65bacd3a500b98eaef6d73d92a616b9dd78b5c4a33285275f)
- bm25: -3.3655 | entity_overlap_w: 3.00 | adjusted: -4.1155 | relevance: 1.0000

console.log('[Realtime] Starting subscription for session:', sessionId, 'user:', user.id)

// Subscribe to mentor_sessions changes for this facilitator
    // Note: Can't filter by session_id in postgres_changes, so we filter in the callback
    const channel = supabase
      .channel('mentor-session-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'mentor_sessions'
      }, (payload) => {
        console.log('[Realtime] RAW event received:', {
          event: payload.eventType,
          table: payload.table,
          hasNew: !!payload.new,
          hasOld: !!payload.old
        })

if (!isMountedRef.current) {
          console.log('[Realtime] Ignoring - component unmounted')
          return
        }

const updatedSession = payload.new
        const oldSession = payload.old

### 9. sidekick_pack_mentor_route.md (21bb19fb47ac611a80afe9a7c03c8bdc818ea7e80fdf508d53c2f4b17493dc0a)
- bm25: -3.8781 | entity_overlap_w: 1.00 | adjusted: -4.1281 | relevance: 1.0000

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

### 10. src/app/api/learner/lesson-history/route.js (fd1937ffd513cfdcd8c204297d056e1d4b876af7f6a90ff015155c1bac2dfd24)
- bm25: -3.3015 | entity_overlap_w: 3.00 | adjusted: -4.0515 | relevance: 1.0000

### 21. scripts/setup-mentor-sessions.sql (76419572d186bb374af9dfdf9f1b40251b639abdcfebe257c03215b4b394bc31)
- bm25: -3.8619 | entity_overlap_w: 1.00 | adjusted: -4.1119 | relevance: 1.0000

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

### 22. sidekick_pack_mentor_sessions_sql.md (5e87105c4ba7c6afc7532b81ca93dcb442c7f5b2dbe577c5eccc3213a0f19636)
- bm25: -3.3560 | entity_overlap_w: 3.00 | adjusted: -4.1060 | relevance: 1.0000

### 6. sidekick_pack_mentor_schema.md (789c376238411a7697641d9d485d1b667aa50fa4849d0346477a0eb8f8b61668)
- bm25: -3.8599 | entity_overlap_w: 3.00 | adjusted: -4.6099 | relevance: 1.0000

### 3. sidekick_pack_mentor_route.md (7307effc7334639c59b7e285e281aa3a4a226fee40b7b11a535d7d04e54e7404)
- bm25: -4.5571 | entity_overlap_w: 1.00 | adjusted: -4.8071 | relevance: 1.0000

async function deactivateSessionById(sessionId) {
  const { error } = await supabase
    .from('mentor_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)

### 4. src/app/api/mentor-session/route.js (94734a3f1ba8be99816f2ae459b0b54476c9de2628a55b95bb8dc269c1404500)
- bm25: -4.4030 | entity_overlap_w: 1.00 | adjusted: -4.6530 | relevance: 1.0000

const ids = staleSessions.map((session) => session.id)
    const { error: deactivateError } = await supabase
      .from('mentor_sessions')
      .update({ is_active: false })
      .in('id', ids)

### 5. sidekick_pack_mentor_route.md (828cc0b263a112b66f0ba45a82962bd6203b9933e7269476cbf299b3a75a4a94)
- bm25: -4.1679 | entity_overlap_w: 1.00 | adjusted: -4.4179 | relevance: 1.0000

// Delete only active sessions (is_active = true)
    // Saved conversations (is_active = false) are preserved
    const { data: deletedRows, error } = await supabase
      .from('mentor_sessions')
      .delete()
      .eq('facilitator_id', user.id)
      .eq('is_active', true)
      .select()

### 6. src/app/api/learner/lesson-history/route.js (9fa11bb439cfe3914be24723e9e7d44533aad95e4f86c10cb388b536d5f666c9)
- bm25: -3.3639 | entity_overlap_w: 4.00 | adjusted: -4.3639 | relevance: 1.0000

### 23. sidekick_pack_mentor_sessions_schema.md (5319fb91866fd3e565195d1981b71d5bf033f2e1bfad839c84073310e29b488e)
- bm25: -3.7963 | entity_overlap_w: 1.00 | adjusted: -4.0463 | relevance: 1.0000

### 23. src/app/facilitator/calendar/page.js (45a3f960320e40cd0f5d44fbd1557244327369796a5b24116ee137e4fc1a97a6)
- bm25: -3.0747 | relevance: 1.0000

### 30. sidekick_pack_mentor_sessions_sql.md (599a10a7ce348de30804293c1d93f3cae870a8383fd81cfc22818bd89acb6ed6)
- bm25: -21.0543 | relevance: 1.0000

// Get user ID for filtering
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      console.error('[Realtime] Cannot start subscription - no user')
      return
    }

### 31. sidekick_pack_mentor_sessions_sql.md (70db498fde34e6c6d7fcfc41e3c054661a479d43431c7dbf5c3ddba244d1f4cc)
- bm25: -20.6675 | entity_overlap_w: 1.00 | adjusted: -20.9175 | relevance: 1.0000

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

### 32. sidekick_pack_mentor_sessions_sql.md (f4707ef6d264e587db17ee040d9a8874e3c90440aba8e287378a1373676aad3e)
- bm25: -20.8221 | relevance: 1.0000

return (
    <>
      <div style={{ minHeight: '100vh', background: '#f9fafb', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 12 }}>

### 33. sidekick_pack_mentor_sessions_sql.md (849e9ac0c5f2a578684419c6c51ab533fc53947ce5df0087f51df0c709bb430a)
- bm25: -20.8138 | relevance: 1.0000

### 24. sidekick_pack_mentor_sessions_schema.md (8ca6872e914a91ad0c11c0fbf1ad6c9d33a4f105d1bcb681e0813b5c3df9bebc)
- bm25: -3.7956 | entity_overlap_w: 1.00 | adjusted: -4.0456 | relevance: 1.0000

-- Verify the fix
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.mentor_sessions'::regclass
  AND conname = 'unique_active_session_per_facilitator';

### 25. sidekick_pack_mentor_sessions_schema.md (7939029b0ac282bbd5bcf16556315e0adcc167a321e6b0b6f20b713ffe921747)
- bm25: -4.0004 | relevance: 1.0000

### 25. sidekick_pack_mentor_sessions_sql.md (99f24a62b3661e637d3ca02877d199a1712cb3f7cdbf4a883e3969e55603454c)
- bm25: -21.3627 | relevance: 1.0000

### 26. sidekick_pack_mentor_sessions_schema.md (90e2bdef39bf6e33ca102729de0882a746236181b2da283b3d38b0caecb1ec01)
- bm25: -4.0004 | relevance: 1.0000

### 14. sidekick_pack_mentor_sessions_sql.md (02813d24e3510379ab14514f7204ae980f1ad0c9f52d507ccda35474af8486f9)
- bm25: -22.4298 | relevance: 1.0000

### 27. sidekick_pack_mentor_sessions_sql.md (7f51c10005862bb1a1649d411062518457998c30793124f9e35b0346e74604b4)
- bm25: -3.7477 | entity_overlap_w: 1.00 | adjusted: -3.9977 | relevance: 1.0000

const { data: targetSessions, error: targetFetchError } = await supabase
        .from('mentor_sessions')
        .select('id, session_id')
        .eq('facilitator_id', user.id)
        .eq('session_id', targetId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)

### 28. src/app/facilitator/generator/counselor/CounselorClient.jsx (a6e6d2e8f2ec3f58171ccc0aa79f43db6bfe702207744971493b65a5de225729)
- bm25: -3.4532 | entity_overlap_w: 2.00 | adjusted: -3.9532 | relevance: 1.0000

// Subscribe to mentor_sessions changes for this facilitator
    // Note: Can't filter by session_id in postgres_changes, so we filter in the callback
    const channel = supabase
      .channel('mentor-session-changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'mentor_sessions'
      }, (payload) => {
        console.log('[Realtime] RAW event received:', {
          event: payload.eventType,
          table: payload.table,
          hasNew: !!payload.new,
          hasOld: !!payload.old
        })

### 29. sidekick_pack_mentor_sessions_sql.md (70db498fde34e6c6d7fcfc41e3c054661a479d43431c7dbf5c3ddba244d1f4cc)
- bm25: -3.5890 | entity_overlap_w: 1.00 | adjusted: -3.8390 | relevance: 1.0000

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

### 30. sidekick_pack_mentor_sessions_schema.md (b28586de24d5d2f6266515e582b7905c53c65c4c4cb52dae86a55d56db373d36)
- bm25: -3.8249 | relevance: 1.0000

### 20. sidekick_pack_mentor_sessions_sql.md (c204b55d670ed91463e03655a5da9bcb250330875a9d19ca07bb422a7ad2c6ff)
- bm25: -21.6580 | relevance: 1.0000

const access = await requireMrMentorAccess(user.id)
    if (!access.allowed) {
      return Response.json({ error: 'Pro plan required' }, { status: 403 })
    }

### 21. sidekick_pack_mentor_sessions_sql.md (9bf4ccf1ed06e641ac7adb16dbb39fe6985a1f6940a25405ed0dc53f1fc36693)
- bm25: -21.5345 | relevance: 1.0000

if (updateError) {
      return Response.json({ 
        error: 'Failed to update session', 
        supabaseError: updateError.message || updateError,
        code: updateError.code
      }, { status: 500 })
    }

### 22. sidekick_pack_mentor_sessions_sql.md (ab510f8ffc4709ec6a2d240f4b22a31780c92c2054066e3781f5ab9736b8e540)
- bm25: -21.5345 | relevance: 1.0000

await loadNoSchoolDates()
    } catch (err) {
      console.error('Error setting no-school date:', err)
      alert('Failed to update no-school date')
    }
  }

### 23. sidekick_pack_mentor_sessions_sql.md (1003003b5d910173c799928d3c2cc76e4c4fe1bd8927ef448ee18b536be05ab1)
- bm25: -21.4124 | relevance: 1.0000

### 17. sidekick_pack_takeover.md (6a2197d79e8f46f1c42fb07b007f31b41d72cf61b0a050c0e11e3383cd89c0de)
- bm25: -3.1472 | entity_overlap_w: 2.00 | adjusted: -3.6472 | relevance: 1.0000

### 24. sidekick_pack_mentor_sessions_sql.md (1b63cae686feb09d5091c437025f1bdd713b84897e589efac403d863688927b9)
- bm25: -21.3627 | relevance: 1.0000

### 8. sidekick_pack_mentor_route.md (7307effc7334639c59b7e285e281aa3a4a226fee40b7b11a535d7d04e54e7404)
- bm25: -4.0859 | entity_overlap_w: 1.00 | adjusted: -4.3359 | relevance: 1.0000

### 31. sidekick_pack_mentor_sessions_schema.md (9ad1d9fe9ddec47ba60163e9968c3ddb09a5b42c0aefd8c4aa61bac6a743aecf)
- bm25: -3.7769 | relevance: 1.0000

### 34. sidekick_pack_mentor_sessions_sql.md (6e95657d17358c7cb31ad2731cfad2ccb0adadd9b931a52c5ca49322fc0f5fc2)
- bm25: -20.7814 | relevance: 1.0000

const SESSION_TIMEOUT_MINUTES = Math.max(
  1,
  Number.parseInt(process.env.MENTOR_SESSION_TIMEOUT_MINUTES ?? '15', 10)
)
const SESSION_TIMEOUT_MS = SESSION_TIMEOUT_MINUTES * 60 * 1000

### 35. sidekick_pack_mentor_sessions_sql.md (ba3573c56f90f2646eaa43cec2c16f0be1bb2945c608b27f42aa46c2e7332168)
- bm25: -20.7079 | relevance: 1.0000

const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 })
    }

### 36. sidekick_pack_mentor_sessions_sql.md (d05b44574d3e106b6de14f8c9c2bc8c95af0a1eecd0f051165286c1277f21719)
- bm25: -20.7079 | relevance: 1.0000

const token = authHeader.substring(7)
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 })
    }

### 37. sidekick_pack_mentor_sessions_sql.md (3eeb5c30358a3d5cee5c6b15bcb7507b0e4dd09acdf93553d231205390d4cd46)
- bm25: -19.9453 | entity_overlap_w: 1.00 | adjusted: -20.1953 | relevance: 1.0000

### 32. sidekick_pack_mentor_sessions_sql.md (3eeb5c30358a3d5cee5c6b15bcb7507b0e4dd09acdf93553d231205390d4cd46)
- bm25: -3.4939 | entity_overlap_w: 1.00 | adjusted: -3.7439 | relevance: 1.0000

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

### 33. sidekick_pack_mentor_sessions_schema.md (af020279671d42571546f4f3c3a92b51c0afc99807e9e37627ed84fd38e0f3ba)
- bm25: -3.4939 | entity_overlap_w: 1.00 | adjusted: -3.7439 | relevance: 1.0000

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

### 34. sidekick_pack_lessons_prefetch.md (c99f61fdeda7b416ff96e4c35559ae2fb1c658909de6ec974d51e545d0e7b150)
- bm25: -3.4836 | entity_overlap_w: 1.00 | adjusted: -3.7336 | relevance: 1.0000

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

### 35. sidekick_pack_mentor_route.md (7307effc7334639c59b7e285e281aa3a4a226fee40b7b11a535d7d04e54e7404)
- bm25: -3.3080 | entity_overlap_w: 1.00 | adjusted: -3.5580 | relevance: 1.0000

async function deactivateSessionById(sessionId) {
  const { error } = await supabase
    .from('mentor_sessions')
    .update({ is_active: false })
    .eq('id', sessionId)

### 36. scripts/add-mentor-conversation-threads.sql (d94dc6113c6d8538adce69c11a56cbf1731eee715eb3978d96ce99e7ff852730)
- bm25: -3.2716 | entity_overlap_w: 1.00 | adjusted: -3.5216 | relevance: 1.0000

-- 3) RLS policies (match mentor_sessions: facilitator-only access)
ALTER TABLE public.mentor_conversation_threads ENABLE ROW LEVEL SECURITY;

### 37. sidekick_pack_completions_mismatch.md (843762fe3adb633bed76dcd21aeb11e31dc67d00d77427c1032433bff72a1043)
- bm25: -3.2359 | entity_overlap_w: 1.00 | adjusted: -3.4859 | relevance: 1.0000

const ids = staleSessions.map((session) => session.id)
    const { error: deactivateError } = await supabase
      .from('mentor_sessions')
      .update({ is_active: false })
      .in('id', ids)

### 38. sidekick_pack_mentor_sessions_sql.md (6a8e06a4da81e7e05b77ff56ec51ec7f76c40c28ea73eba7b161b42716e108d5)
- bm25: -3.4424 | relevance: 1.0000

console.log('[PATCH] Session query result:', { found: !!session, error: sessionError })

### 39. sidekick_pack_mentor_sessions_sql.md (72cfa0338324646165fe6ed7ac7fda0b6d48856ab40ad33a6fd1ef6f6203ece8)
- bm25: -3.4424 | relevance: 1.0000

if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

### 40. sidekick_pack_mentor_sessions_sql.md (ab91c924359ccfba8817a8588311a022d967b3cd2149b3c5d64d1c05e64fd8dd)
- bm25: -3.4424 | relevance: 1.0000

const now = new Date()
    await cleanupStaleSessions({ facilitatorId: user.id, now })
