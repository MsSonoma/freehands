-- Enable Supabase Realtime for lesson_sessions table.
-- This lets Device A receive instant notification when Device B sets ended_at
-- (takeover), instead of waiting for the next 8s poll cycle.
--
-- Run once in your Supabase SQL editor or via psql.

-- 1. Full replica identity so UPDATE payloads include the old row as well as new.
ALTER TABLE lesson_sessions REPLICA IDENTITY FULL;

-- 2. Add the table to the Supabase Realtime publication.
ALTER PUBLICATION supabase_realtime ADD TABLE lesson_sessions;
