-- Quick setup script for Mr. Mentor Conversation Memory
-- Run this in Supabase SQL Editor to set up the memory system

-- Step 1: Create conversation_updates table
CREATE TABLE IF NOT EXISTS conversation_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id UUID REFERENCES learners(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  recent_turns JSONB DEFAULT '[]'::jsonb,
  turn_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_active_conversation UNIQUE (facilitator_id, learner_id)
);

-- Step 2: Create conversation_history_archive table
CREATE TABLE IF NOT EXISTS conversation_history_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id UUID REFERENCES learners(id) ON DELETE SET NULL,
  summary TEXT NOT NULL,
  conversation_turns JSONB DEFAULT '[]'::jsonb,
  turn_count INTEGER DEFAULT 0,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', summary)) STORED
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_conversation_updates_facilitator 
  ON conversation_updates(facilitator_id);

CREATE INDEX IF NOT EXISTS idx_conversation_updates_learner 
  ON conversation_updates(learner_id);

CREATE INDEX IF NOT EXISTS idx_conversation_updates_summary_search 
  ON conversation_updates USING gin(to_tsvector('english', summary));

CREATE INDEX IF NOT EXISTS idx_conversation_archive_facilitator 
  ON conversation_history_archive(facilitator_id);

CREATE INDEX IF NOT EXISTS idx_conversation_archive_learner 
  ON conversation_history_archive(learner_id);

CREATE INDEX IF NOT EXISTS idx_conversation_archive_search 
  ON conversation_history_archive USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_conversation_archive_date 
  ON conversation_history_archive(archived_at DESC);

-- Step 4: Enable RLS
ALTER TABLE conversation_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_history_archive ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY "Facilitators can view their own conversation updates"
  ON conversation_updates FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can insert their own conversation updates"
  ON conversation_updates FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can update their own conversation updates"
  ON conversation_updates FOR UPDATE
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can delete their own conversation updates"
  ON conversation_updates FOR DELETE
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can view their own conversation archive"
  ON conversation_history_archive FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can insert into conversation archive"
  ON conversation_history_archive FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

-- Step 6: Create archival functions
CREATE OR REPLACE FUNCTION archive_conversation_update()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO conversation_history_archive (
    facilitator_id,
    learner_id,
    summary,
    conversation_turns,
    turn_count,
    archived_at
  ) VALUES (
    OLD.facilitator_id,
    OLD.learner_id,
    OLD.summary,
    OLD.recent_turns,
    OLD.turn_count,
    NOW()
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION maybe_archive_long_conversation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.turn_count > 50 THEN
    INSERT INTO conversation_history_archive (
      facilitator_id,
      learner_id,
      summary,
      conversation_turns,
      turn_count,
      archived_at
    ) VALUES (
      NEW.facilitator_id,
      NEW.learner_id,
      NEW.summary,
      NEW.recent_turns,
      NEW.turn_count,
      NOW()
    );
    NEW.turn_count := 1;
    NEW.recent_turns := '[]'::jsonb;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 7: Create triggers
CREATE TRIGGER trigger_archive_conversation_before_delete
  BEFORE DELETE ON conversation_updates
  FOR EACH ROW
  EXECUTE FUNCTION archive_conversation_update();

CREATE TRIGGER trigger_archive_long_conversation
  BEFORE UPDATE ON conversation_updates
  FOR EACH ROW
  EXECUTE FUNCTION maybe_archive_long_conversation();

-- Step 8: Add comments for documentation
COMMENT ON TABLE conversation_updates IS 'Active conversation summaries updated with each Mr. Mentor interaction. Includes recent turn context for continuity.';
COMMENT ON TABLE conversation_history_archive IS 'Permanent archive of all conversation updates. Never deleted. Used for historical search and reference.';

-- Done!
SELECT 'Conversation memory system setup complete!' AS status;
