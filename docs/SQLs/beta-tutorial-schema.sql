-- Beta Program: Tutorial Gating, Survey, and Tracking Schema
-- Run this in Supabase SQL editor to add Beta subscription tier support,
-- tutorial completion tracking, session instrumentation, and post-lesson surveys.

-- ============================================================================
-- 1. PROFILES TABLE: Add Beta tier and tutorial completion timestamps
-- ============================================================================

-- Add subscription_tier column (nullable; admins set to 'Beta' manually in Supabase)
alter table public.profiles add column if not exists subscription_tier text;

-- Add facilitator tutorial completion timestamps
alter table public.profiles add column if not exists fac_signup_video_completed_at timestamptz;
alter table public.profiles add column if not exists fac_tutorial_completed_at timestamptz;

-- Create index for subscription_tier lookups
create index if not exists idx_profiles_subscription_tier 
  on public.profiles(subscription_tier) 
  where subscription_tier is not null;

-- ============================================================================
-- 2. LEARNER_TUTORIAL_PROGRESS: Track first-time learner tutorial completion
-- ============================================================================

create table if not exists public.learner_tutorial_progress (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Ensure one tutorial completion per learner (first-time only)
create unique index if not exists idx_learner_tutorial_progress_learner_id 
  on public.learner_tutorial_progress(learner_id);

-- RLS: Facilitators can see/manage tutorial progress for their learners
alter table public.learner_tutorial_progress enable row level security;

drop policy if exists "learner_tutorial_progress_select" on public.learner_tutorial_progress;
create policy "learner_tutorial_progress_select" 
  on public.learner_tutorial_progress for select
  using (
    exists (
      select 1 from public.learners l
      where l.id = learner_tutorial_progress.learner_id
        and l.facilitator_id = auth.uid()
    )
  );

drop policy if exists "learner_tutorial_progress_insert" on public.learner_tutorial_progress;
create policy "learner_tutorial_progress_insert" 
  on public.learner_tutorial_progress for insert
  with check (
    exists (
      select 1 from public.learners l
      where l.id = learner_tutorial_progress.learner_id
        and l.facilitator_id = auth.uid()
    )
  );

grant select, insert on table public.learner_tutorial_progress to authenticated;

-- ============================================================================
-- 3. LESSON_SESSIONS: Track lesson start/end times for duration metrics
-- ============================================================================

create table if not exists public.lesson_sessions (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_id text not null, -- lesson key like "4th-multiplying-with-zeros"
  started_at timestamptz not null default now(),
  ended_at timestamptz, -- null until lesson ends
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_sessions_learner_id 
  on public.lesson_sessions(learner_id);

create index if not exists idx_lesson_sessions_started_at 
  on public.lesson_sessions(started_at desc);

-- RLS: Facilitators can see sessions for their learners
alter table public.lesson_sessions enable row level security;

drop policy if exists "lesson_sessions_select" on public.lesson_sessions;
create policy "lesson_sessions_select" 
  on public.lesson_sessions for select
  using (
    exists (
      select 1 from public.learners l
      where l.id = lesson_sessions.learner_id
        and l.facilitator_id = auth.uid()
    )
  );

drop policy if exists "lesson_sessions_insert" on public.lesson_sessions;
create policy "lesson_sessions_insert" 
  on public.lesson_sessions for insert
  with check (
    exists (
      select 1 from public.learners l
      where l.id = lesson_sessions.learner_id
        and l.facilitator_id = auth.uid()
    )
  );

drop policy if exists "lesson_sessions_update" on public.lesson_sessions;
create policy "lesson_sessions_update" 
  on public.lesson_sessions for update
  using (
    exists (
      select 1 from public.learners l
      where l.id = lesson_sessions.learner_id
        and l.facilitator_id = auth.uid()
    )
  );

grant select, insert, update on table public.lesson_sessions to authenticated;

-- ============================================================================
-- 3a. LESSON_SESSION_EVENTS: Point-in-time events for session lifecycle
-- ============================================================================

create table if not exists public.lesson_session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lesson_sessions(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_id text not null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_session_events_session_id
  on public.lesson_session_events(session_id);

create index if not exists idx_lesson_session_events_learner_id
  on public.lesson_session_events(learner_id, occurred_at desc);

alter table public.lesson_session_events enable row level security;

drop policy if exists "lesson_session_events_select" on public.lesson_session_events;
create policy "lesson_session_events_select"
  on public.lesson_session_events for select
  using (
    exists (
      select 1 from public.learners l
      where l.id = lesson_session_events.learner_id
        and l.facilitator_id = auth.uid()
    )
  );

drop policy if exists "lesson_session_events_insert" on public.lesson_session_events;
create policy "lesson_session_events_insert"
  on public.lesson_session_events for insert
  with check (
    exists (
      select 1 from public.learners l
      where l.id = lesson_session_events.learner_id
        and l.facilitator_id = auth.uid()
    )
  );

grant select, insert on table public.lesson_session_events to authenticated;

-- ============================================================================
-- 4. FACILITATOR_NOTES: Timestamped notes during lessons
-- ============================================================================

create table if not exists public.facilitator_notes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lesson_sessions(id) on delete cascade,
  ts timestamptz not null default now(), -- timestamp of note
  text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_facilitator_notes_session_id 
  on public.facilitator_notes(session_id);

create index if not exists idx_facilitator_notes_ts 
  on public.facilitator_notes(ts desc);

-- RLS: Facilitators can manage notes for their sessions
alter table public.facilitator_notes enable row level security;

drop policy if exists "facilitator_notes_select" on public.facilitator_notes;
create policy "facilitator_notes_select" 
  on public.facilitator_notes for select
  using (
    exists (
      select 1 from public.lesson_sessions s
      join public.learners l on l.id = s.learner_id
      where s.id = facilitator_notes.session_id
        and l.facilitator_id = auth.uid()
    )
  );

drop policy if exists "facilitator_notes_insert" on public.facilitator_notes;
create policy "facilitator_notes_insert" 
  on public.facilitator_notes for insert
  with check (
    exists (
      select 1 from public.lesson_sessions s
      join public.learners l on l.id = s.learner_id
      where s.id = facilitator_notes.session_id
        and l.facilitator_id = auth.uid()
    )
  );

drop policy if exists "facilitator_notes_update" on public.facilitator_notes;
create policy "facilitator_notes_update" 
  on public.facilitator_notes for update
  using (
    exists (
      select 1 from public.lesson_sessions s
      join public.learners l on l.id = s.learner_id
      where s.id = facilitator_notes.session_id
        and l.facilitator_id = auth.uid()
    )
  );

drop policy if exists "facilitator_notes_delete" on public.facilitator_notes;
create policy "facilitator_notes_delete" 
  on public.facilitator_notes for delete
  using (
    exists (
      select 1 from public.lesson_sessions s
      join public.learners l on l.id = s.learner_id
      where s.id = facilitator_notes.session_id
        and l.facilitator_id = auth.uid()
    )
  );

grant select, insert, update, delete on table public.facilitator_notes to authenticated;

-- ============================================================================
-- 5. REPEAT_EVENTS: Track "Repeat" button clicks per sentence
-- ============================================================================

create table if not exists public.repeat_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lesson_sessions(id) on delete cascade,
  sentence_id text not null, -- identifier for the sentence/segment repeated
  ts timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_repeat_events_session_id 
  on public.repeat_events(session_id);

create index if not exists idx_repeat_events_session_sentence 
  on public.repeat_events(session_id, sentence_id);

-- RLS: Facilitators can see repeat events for their sessions
alter table public.repeat_events enable row level security;

drop policy if exists "repeat_events_select" on public.repeat_events;
create policy "repeat_events_select" 
  on public.repeat_events for select
  using (
    exists (
      select 1 from public.lesson_sessions s
      join public.learners l on l.id = s.learner_id
      where s.id = repeat_events.session_id
        and l.facilitator_id = auth.uid()
    )
  );

drop policy if exists "repeat_events_insert" on public.repeat_events;
create policy "repeat_events_insert" 
  on public.repeat_events for insert
  with check (
    exists (
      select 1 from public.lesson_sessions s
      join public.learners l on l.id = s.learner_id
      where s.id = repeat_events.session_id
        and l.facilitator_id = auth.uid()
    )
  );

grant select, insert on table public.repeat_events to authenticated;

-- ============================================================================
-- 6. LESSON_TRANSCRIPTS: Timestamped transcript lines for each session
-- ============================================================================

create table if not exists public.lesson_transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lesson_sessions(id) on delete cascade,
  ts timestamptz not null default now(), -- timestamp of this transcript line
  speaker text not null, -- 'ms_sonoma' | 'learner' | 'system'
  text text not null, -- transcript text
  created_at timestamptz not null default now()
);

create index if not exists idx_lesson_transcripts_session_id 
  on public.lesson_transcripts(session_id);

create index if not exists idx_lesson_transcripts_ts 
  on public.lesson_transcripts(ts);

create index if not exists idx_lesson_transcripts_session_ts 
  on public.lesson_transcripts(session_id, ts);

-- RLS: Facilitators can see transcripts for their sessions
alter table public.lesson_transcripts enable row level security;

drop policy if exists "lesson_transcripts_select" on public.lesson_transcripts;
create policy "lesson_transcripts_select" 
  on public.lesson_transcripts for select
  using (
    exists (
      select 1 from public.lesson_sessions s
      join public.learners l on l.id = s.learner_id
      where s.id = lesson_transcripts.session_id
        and l.facilitator_id = auth.uid()
    )
  );

drop policy if exists "lesson_transcripts_insert" on public.lesson_transcripts;
create policy "lesson_transcripts_insert" 
  on public.lesson_transcripts for insert
  with check (
    exists (
      select 1 from public.lesson_sessions s
      join public.learners l on l.id = s.learner_id
      where s.id = lesson_transcripts.session_id
        and l.facilitator_id = auth.uid()
    )
  );

grant select, insert on table public.lesson_transcripts to authenticated;

-- ============================================================================
-- 7. POST_LESSON_SURVEYS: Facilitator feedback surveys (unlock golden key)
-- ============================================================================

create table if not exists public.post_lesson_surveys (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lesson_sessions(id) on delete cascade,
  submitted_at timestamptz not null default now(),
  environment jsonb, -- e.g., {"location": "home", "distractions": "low", "lighting": "good"}
  learning_style jsonb, -- e.g., {"engagement": "high", "focus_duration": 25, "preferred_pace": "moderate"}
  fatigue_moments jsonb, -- e.g., {"timestamps": ["12:34", "18:22"], "notes": "lost focus after 20min"}
  struggles jsonb, -- e.g., {"topics": ["fractions"], "confusion_points": ["denominator concept"]}
  notes_freeform text, -- open-ended facilitator observations
  created_at timestamptz not null default now()
);

-- One survey per session
create unique index if not exists idx_post_lesson_surveys_session_id 
  on public.post_lesson_surveys(session_id);

create index if not exists idx_post_lesson_surveys_submitted_at 
  on public.post_lesson_surveys(submitted_at desc);

-- RLS: Facilitators can manage surveys for their sessions
alter table public.post_lesson_surveys enable row level security;

drop policy if exists "post_lesson_surveys_select" on public.post_lesson_surveys;
create policy "post_lesson_surveys_select" 
  on public.post_lesson_surveys for select
  using (
    exists (
      select 1 from public.lesson_sessions s
      join public.learners l on l.id = s.learner_id
      where s.id = post_lesson_surveys.session_id
        and l.facilitator_id = auth.uid()
    )
  );

drop policy if exists "post_lesson_surveys_insert" on public.post_lesson_surveys;
create policy "post_lesson_surveys_insert" 
  on public.post_lesson_surveys for insert
  with check (
    exists (
      select 1 from public.lesson_sessions s
      join public.learners l on l.id = s.learner_id
      where s.id = post_lesson_surveys.session_id
        and l.facilitator_id = auth.uid()
    )
  );

drop policy if exists "post_lesson_surveys_update" on public.post_lesson_surveys;
create policy "post_lesson_surveys_update" 
  on public.post_lesson_surveys for update
  using (
    exists (
      select 1 from public.lesson_sessions s
      join public.learners l on l.id = s.learner_id
      where s.id = post_lesson_surveys.session_id
        and l.facilitator_id = auth.uid()
    )
  );

grant select, insert, update on table public.post_lesson_surveys to authenticated;

-- ============================================================================
-- 8. HELPER VIEWS: Aggregate metrics for reporting
-- ============================================================================

-- View: Session duration and repeat counts
create or replace view public.session_metrics as
select
  s.id as session_id,
  s.learner_id,
  s.lesson_id,
  s.started_at,
  s.ended_at,
  extract(epoch from (s.ended_at - s.started_at)) / 60 as duration_minutes,
  count(distinct r.id) as total_repeats,
  count(distinct fn.id) as total_notes,
  ps.id is not null as survey_completed
from public.lesson_sessions s
left join public.repeat_events r on r.session_id = s.id
left join public.facilitator_notes fn on fn.session_id = s.id
left join public.post_lesson_surveys ps on ps.session_id = s.id
group by s.id, s.learner_id, s.lesson_id, s.started_at, s.ended_at, ps.id;

-- RLS for view: restrict to facilitator's learners only
alter view public.session_metrics owner to postgres;
grant select on public.session_metrics to authenticated;

-- Note: Views inherit RLS from underlying tables. Since lesson_sessions has RLS
-- that restricts to facilitator_id, the view automatically applies the same restriction.
-- Users can only see session_metrics for their own learners.

-- ============================================================================
-- NOTES FOR ADMINS
-- ============================================================================

-- To assign Beta tier to a user (manual admin action in Supabase):
--   update public.profiles set subscription_tier = 'Beta' where email = 'user@example.com';

-- To remove Beta tier after program ends:
--   update public.profiles set subscription_tier = null where subscription_tier = 'Beta';

-- To verify tutorial completion for a facilitator:
--   select fac_signup_video_completed_at, fac_tutorial_completed_at 
--   from public.profiles where id = 'facilitator-uuid';

-- To check learner tutorial completion:
--   select * from public.learner_tutorial_progress where learner_id = 'learner-uuid';

-- To view session metrics:
--   select * from public.session_metrics where learner_id = 'learner-uuid' order by started_at desc;
