-- Facilitator-authored, per-learner/lesson Webb media decisions.
-- Search ranking is advisory; content cannot be used until explicitly approved.
create table public.webb_lesson_media (
  facilitator_id uuid not null references auth.users(id) on delete cascade,
  learner_id uuid not null references public.learners(id) on delete cascade,
  lesson_key text not null,
  kind text not null check (kind in ('video', 'article')),
  resource_id text not null,
  resource jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  work_allowed boolean not null default false,
  requested_at timestamptz,
  approved_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (facilitator_id, learner_id, lesson_key, kind, resource_id),
  constraint webb_media_work_permission check (not work_allowed or (kind = 'video' and status = 'approved'))
);
create index webb_lesson_media_lesson_idx on public.webb_lesson_media
  (learner_id, lesson_key, status, kind);
alter table public.webb_lesson_media enable row level security;
revoke all on table public.webb_lesson_media from public, anon, authenticated;
grant select, insert, update on public.webb_lesson_media to service_role;
comment on table public.webb_lesson_media is 'Facilitator-approved Mrs Webb video and article resources; lesson-specific approvals and optional work-video permission.';
