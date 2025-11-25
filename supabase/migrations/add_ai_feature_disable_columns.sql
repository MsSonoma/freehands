-- Add columns to allow facilitators to disable individual AI features per learner
-- When true, the corresponding feature button is disabled for this learner in all sessions

-- Ask Feature: Learner can ask questions about the lesson vocabulary
ALTER TABLE learners ADD COLUMN IF NOT EXISTS ask_disabled BOOLEAN DEFAULT FALSE;

-- Poem Feature: Generate creative silly poems (content-safety protected, not lesson-restricted)
ALTER TABLE learners ADD COLUMN IF NOT EXISTS poem_disabled BOOLEAN DEFAULT FALSE;

-- Story Feature: Generate creative short stories (content-safety protected, not lesson-restricted)
ALTER TABLE learners ADD COLUMN IF NOT EXISTS story_disabled BOOLEAN DEFAULT FALSE;

-- Fill-in-Fun Feature: Mad libs style creative game (content-safety protected, not lesson-restricted)
ALTER TABLE learners ADD COLUMN IF NOT EXISTS fill_in_fun_disabled BOOLEAN DEFAULT FALSE;

-- All four features are content-safety protected with 6-layer guardrails:
-- 1. Keyword filtering (banned words)
-- 2. Prompt injection detection
-- 3. OpenAI Moderation API
-- 4. Instruction hardening
-- 5. Output validation
-- 6. Lesson scope enforcement

-- These toggles give facilitators granular control over which AI features
-- are available to each learner, allowing complete avoidance of AI if desired.
