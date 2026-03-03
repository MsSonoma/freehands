-- Migration: Add per-subject preferences to curriculum_preferences
-- Run this in Supabase SQL editor.
-- Safe to run multiple times (uses IF NOT EXISTS / DO NOTHING patterns).

-- 1. Add subject_preferences JSONB column to store per-subject focus/ban lists.
--    The column is a JSON object keyed by subject name, e.g.:
--    { "math": { "focusTopics": [...], "bannedTopics": [...], ... }, "science": {...} }
--    The existing top-level columns (focus_topics, banned_topics, etc.) remain as
--    the "Global (all subjects)" defaults.

ALTER TABLE curriculum_preferences
  ADD COLUMN IF NOT EXISTS subject_preferences JSONB DEFAULT '{}'::jsonb;
