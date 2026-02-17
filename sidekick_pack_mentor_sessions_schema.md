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

-- Grant permissions
GRANT ALL ON public.mentor_sessions TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

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

### 23. src/app/facilitator/calendar/page.js (45a3f960320e40cd0f5d44fbd1557244327369796a5b24116ee137e4fc1a97a6)
- bm25: -3.0747 | relevance: 1.0000

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

### 1. src/app/facilitator/calendar/page.js (72f70893c01946442b9eded07b75bb6144d62ca4c9aa3ec475af49117056e8d3)
- bm25: -6.1503 | entity_overlap_w: 1.30 | adjusted: -6.4753 | relevance: 1.0000

if (!response.ok) throw new Error('Failed to set no-school date')
      }

### 8. sidekick_pack_mentor_sessions_sql.md (9c5b21f2a623d5091cfc3bc3ef8410f671fd21eb11c002e299a43db376685d9a)
- bm25: -25.1044 | relevance: 1.0000

const handleDateSelect = (dateStr) => {
    setSelectedDate(dateStr)
    setShowDayView(true)
  }

if (authLoading || loading) {
    return <div style={{ padding: '24px' }}><p>Loading…</p></div>
  }

return (
    <>
      <div style={{ minHeight: '100vh', background: '#f9fafb', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 12 }}>

### 2. sidekick_pack_mentor_schema.md (ebb07c6b50c9b919b40941e042392e9a26a8440c5be7d53121503fdd93a5af19)
- bm25: -6.4722 | entity_overlap_w: 1.30 | adjusted: -6.7972 | relevance: 1.0000

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

### 3. sidekick_pack_mentor_schema.md (2ea2b247b7112ad19926b40490787248601b4833bce2df19b06824f25cb68575)
- bm25: -5.5793 | entity_overlap_w: 1.30 | adjusted: -5.9043 | relevance: 1.0000

### 2. sidekick_pack_calendar.md (5664748c8577fd0132da3c25664f52295fd4045d681f2dc40fb2b982e6013bfb)
- bm25: -5.9752 | entity_overlap_w: 1.30 | adjusted: -6.3002 | relevance: 1.0000

### 9. sidekick_pack_mentor_schema.md (ebb07c6b50c9b919b40941e042392e9a26a8440c5be7d53121503fdd93a5af19)
- bm25: -24.9759 | relevance: 1.0000

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

### 10. sidekick_pack_mentor_sessions_sql.md (3ca3dc81e40a5d6d5f9c13fdac89d016e74f0628254ebea4f98bd4a2aad1a31a)
- bm25: -24.6977 | relevance: 1.0000

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

### 23. src/app/facilitator/calendar/page.js (45a3f960320e40cd0f5d44fbd1557244327369796a5b24116ee137e4fc1a97a6)
- bm25: -3.0747 | relevance: 1.0000

### 4. src/app/facilitator/calendar/page.js (72f70893c01946442b9eded07b75bb6144d62ca4c9aa3ec475af49117056e8d3)
- bm25: -5.3660 | entity_overlap_w: 1.30 | adjusted: -5.6910 | relevance: 1.0000

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

if (authLoading || loading) {
    return <div style={{ padding: '24px' }}><p>Loading…</p></div>
  }

return (
    <>
      <div style={{ minHeight: '100vh', background: '#f9fafb', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 12 }}>

### 11. sidekick_pack_mentor_sessions_sql.md (6a8e06a4da81e7e05b77ff56ec51ec7f76c40c28ea73eba7b161b42716e108d5)
- bm25: -22.6994 | relevance: 1.0000

console.log('[PATCH] Session query result:', { found: !!session, error: sessionError })

### 12. sidekick_pack_mentor_sessions_sql.md (72cfa0338324646165fe6ed7ac7fda0b6d48856ab40ad33a6fd1ef6f6203ece8)
- bm25: -22.6994 | relevance: 1.0000

if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

### 13. sidekick_pack_mentor_sessions_sql.md (ab91c924359ccfba8817a8588311a022d967b3cd2149b3c5d64d1c05e64fd8dd)
- bm25: -22.6994 | relevance: 1.0000

const now = new Date()
    await cleanupStaleSessions({ facilitatorId: user.id, now })

### 14. sidekick_pack_mentor_sessions_sql.md (02813d24e3510379ab14514f7204ae980f1ad0c9f52d507ccda35474af8486f9)
- bm25: -22.4298 | relevance: 1.0000

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

// PIN validated, copy conversation from existing session
      const conversationToCopy = existingSession.conversation_history || []
      const draftSummaryToCopy = existingSession.draft_summary || ''

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

### 25. sidekick_pack_mentor_sessions_sql.md (99f24a62b3661e637d3ca02877d199a1712cb3f7cdbf4a883e3969e55603454c)
- bm25: -21.3627 | relevance: 1.0000

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

### 1. src/app/facilitator/calendar/page.js (72f70893c01946442b9eded07b75bb6144d62ca4c9aa3ec475af49117056e8d3)
- bm25: -6.1503 | entity_overlap_w: 1.30 | adjusted: -6.4753 | relevance: 1.0000

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

if (authLoading || loading) {
    return <div style={{ padding: '24px' }}><p>Loading…</p></div>
  }

return (
    <>
      <div style={{ minHeight: '100vh', background: '#f9fafb', opacity: !isAuthenticated ? 0.5 : 1, pointerEvents: !isAuthenticated ? 'none' : 'auto' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 12 }}>

### 29. sidekick_pack_mentor_schema.md (2ea2b247b7112ad19926b40490787248601b4833bce2df19b06824f25cb68575)
- bm25: -21.1347 | relevance: 1.0000

### 2. sidekick_pack_calendar.md (5664748c8577fd0132da3c25664f52295fd4045d681f2dc40fb2b982e6013bfb)
- bm25: -5.9752 | entity_overlap_w: 1.30 | adjusted: -6.3002 | relevance: 1.0000

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

### 38. sidekick_pack_mentor_sessions_sql.md (ca3ccf97844367bfd0be1e3ceda1f5249653cd112decf3070950f9bc3f2b062f)
- bm25: -20.1553 | relevance: 1.0000

// GET: Check session status and retrieve active session
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

### 39. sidekick_pack_mentor_sessions_sql.md (cbdc8f8dedafedb280bc0258779d451591d914351bd05daa313669ea7c45037f)
- bm25: -20.1553 | relevance: 1.0000

// GET: Check session status and retrieve active session
export async function GET(request) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

### 40. src/app/facilitator/calendar/page.js (72f70893c01946442b9eded07b75bb6144d62ca4c9aa3ec475af49117056e8d3)
- bm25: -20.0617 | relevance: 1.0000

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

if (authLoading || loading) {
    return <div style={{ padding: '24px' }}><p>Loading…</p></div>
  }

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
