ALTER TABLE public.syllabus_lesson_associations
  ADD COLUMN inferred_placement_suppressed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.syllabus_lesson_associations.inferred_placement_suppressed IS
  'When true, prevents association-only inferred or needs_placement Syllabus synthesis without removing the learner-to-lesson association; explicit forecast, schedule, and history authority remain separate.';
