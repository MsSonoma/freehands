-- Add lesson_notes column to learners table
-- Structure: { 'subject/lesson_file': 'note text here', ... }

alter table public.learners add column if not exists lesson_notes jsonb default '{}'::jsonb;

-- Create index for efficient JSON queries
create index if not exists idx_learners_lesson_notes on public.learners using gin(lesson_notes);

-- Update existing learners to have empty object if null
update public.learners set lesson_notes = '{}'::jsonb where lesson_notes is null;
