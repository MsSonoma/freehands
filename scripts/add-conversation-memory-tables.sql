-- Conversation Memory System for Mr. Mentor
-- Stores facilitator and learner-specific conversation summaries
-- Updated with each back-and-forth for continuous context

-- Table: conversation_updates
-- Stores incremental conversation summaries (clipboard knowledge)
CREATE TABLE IF NOT EXISTS conversation_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id UUID REFERENCES learners(id) ON DELETE CASCADE,
  
  -- Summary content (auto-updated with each turn)
  summary TEXT NOT NULL,
  
  -- Original conversation excerpt (last few turns)
  recent_turns JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  turn_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Make it easy to find the latest update per facilitator or learner
  CONSTRAINT unique_active_conversation UNIQUE (facilitator_id, learner_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_conversation_updates_facilitator 
  ON conversation_updates(facilitator_id);
  
CREATE INDEX IF NOT EXISTS idx_conversation_updates_learner 
  ON conversation_updates(learner_id);

-- Index for text search (fuzzy matching)
CREATE INDEX IF NOT EXISTS idx_conversation_updates_summary_search 
  ON conversation_updates USING gin(to_tsvector('english', summary));

-- RLS policies
ALTER TABLE conversation_updates ENABLE ROW LEVEL SECURITY;

-- Facilitators can only access their own conversation updates
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

-- Table: conversation_history_archive
-- Long-term storage of all conversation updates (never deleted)
CREATE TABLE IF NOT EXISTS conversation_history_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facilitator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  learner_id UUID REFERENCES learners(id) ON DELETE SET NULL,
  
  -- Archived summary
  summary TEXT NOT NULL,
  
  -- Full conversation turns at time of archive
  conversation_turns JSONB DEFAULT '[]'::jsonb,
  
  -- Metadata
  turn_count INTEGER DEFAULT 0,
  archived_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Search optimization
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('english', summary)) STORED
);

-- Indexes for archive
CREATE INDEX IF NOT EXISTS idx_conversation_archive_facilitator 
  ON conversation_history_archive(facilitator_id);
  
CREATE INDEX IF NOT EXISTS idx_conversation_archive_learner 
  ON conversation_history_archive(learner_id);
  
CREATE INDEX IF NOT EXISTS idx_conversation_archive_search 
  ON conversation_history_archive USING gin(search_vector);

CREATE INDEX IF NOT EXISTS idx_conversation_archive_date 
  ON conversation_history_archive(archived_at DESC);

-- RLS policies for archive
ALTER TABLE conversation_history_archive ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Facilitators can view their own conversation archive"
  ON conversation_history_archive FOR SELECT
  USING (auth.uid() = facilitator_id);

CREATE POLICY "Facilitators can insert into conversation archive"
  ON conversation_history_archive FOR INSERT
  WITH CHECK (auth.uid() = facilitator_id);

-- Function to automatically archive old conversation updates
CREATE OR REPLACE FUNCTION archive_conversation_update()
RETURNS TRIGGER AS $$
BEGIN
  -- When a conversation update is deleted or significantly changed,
  -- archive it for permanent storage
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

-- Trigger to auto-archive before delete
CREATE TRIGGER trigger_archive_conversation_before_delete
  BEFORE DELETE ON conversation_updates
  FOR EACH ROW
  EXECUTE FUNCTION archive_conversation_update();

-- Optional: Archive when turn count reaches threshold (e.g., 50 turns)
-- This keeps the active table small and responsive
CREATE OR REPLACE FUNCTION maybe_archive_long_conversation()
RETURNS TRIGGER AS $$
BEGIN
  -- If conversation exceeds 50 turns, archive and reset
  IF NEW.turn_count > 50 THEN
    -- Archive current state
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
    
    -- Reset turn count
    NEW.turn_count := 1;
    NEW.recent_turns := '[]'::jsonb;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archive_long_conversation
  BEFORE UPDATE ON conversation_updates
  FOR EACH ROW
  EXECUTE FUNCTION maybe_archive_long_conversation();

COMMENT ON TABLE conversation_updates IS 'Active conversation summaries updated with each Mr. Mentor interaction. Includes recent turn context for continuity.';
COMMENT ON TABLE conversation_history_archive IS 'Permanent archive of all conversation updates. Never deleted. Used for historical search and reference.';
