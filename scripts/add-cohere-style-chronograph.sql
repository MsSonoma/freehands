-- Supabase Cohere-style chronograph + deterministic pack layer (Mr. Mentor)
--
-- Run in Supabase SQL editor.
-- This is designed to be Supabase-only (no local state), RLS-protected, and deterministic.

-- 0) Extensions (optional)
create extension if not exists pg_trgm;

-- 1) Tenancy + membership
create table if not exists public.tenants (
  tenant_id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_memberships (
  tenant_id uuid not null references public.tenants(tenant_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index if not exists tenant_memberships_user_idx
  on public.tenant_memberships (user_id, tenant_id);

-- 2) Adult unlock (PIN gate)
create table if not exists public.adult_sessions (
  tenant_id uuid not null references public.tenants(tenant_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  unlocked_until timestamptz not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index if not exists adult_sessions_unlocked_until_idx
  on public.adult_sessions (tenant_id, user_id, unlocked_until);

-- 3) Threads + immutable event chronograph
create table if not exists public.threads (
  thread_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(tenant_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sector text not null check (sector in ('child','adult','both')),
  subject_key text not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz null,
  constraint threads_unique_scope unique (tenant_id, user_id, sector, subject_key)
);

create index if not exists threads_tenant_user_created_idx
  on public.threads (tenant_id, user_id, created_at desc);

create index if not exists threads_scope_idx
  on public.threads (tenant_id, user_id, sector, subject_key);

create table if not exists public.events (
  event_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(tenant_id) on delete cascade,
  thread_id uuid not null references public.threads(thread_id) on delete cascade,
  ts timestamptz not null default now(),
  role text not null check (role in ('user','assistant','system')),
  text text not null,
  dedupe_key text null,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists events_thread_ts_idx
  on public.events (tenant_id, thread_id, ts asc, event_id asc);

-- Optional idempotency for imports/backfills (e.g., legacy history ingestion)
-- NOTE: This is intentionally NOT partial, so ON CONFLICT (tenant_id,thread_id,dedupe_key)
-- can use it without requiring a conflict-target predicate.
create unique index if not exists events_thread_dedupe_key_uq
  on public.events (tenant_id, thread_id, dedupe_key);

-- FTS support on events
alter table public.events
  add column if not exists tsv tsvector generated always as (to_tsvector('english', coalesce(text,''))) stored;

create index if not exists events_tsv_gin
  on public.events using gin (tsv);

-- 4) Derived, versioned memory
create table if not exists public.user_goal_versions (
  goal_version_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(tenant_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sector text not null check (sector in ('child','adult','both')),
  ts timestamptz not null default now(),
  goals_json jsonb not null,
  source_event_ids uuid[] not null default '{}'::uuid[],
  supersedes_goal_version_id uuid null
);

create index if not exists user_goal_versions_latest_idx
  on public.user_goal_versions (tenant_id, user_id, sector, ts desc, goal_version_id desc);

create table if not exists public.thread_summary_versions (
  summary_version_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(tenant_id) on delete cascade,
  thread_id uuid not null references public.threads(thread_id) on delete cascade,
  sector text not null check (sector in ('child','adult','both')),
  ts timestamptz not null default now(),
  title text not null,
  summary text not null,
  covers_event_min uuid null,
  covers_event_max uuid null,
  source_event_ids uuid[] not null default '{}'::uuid[]
);

create index if not exists thread_summary_versions_latest_idx
  on public.thread_summary_versions (tenant_id, thread_id, ts desc, summary_version_id desc);

-- FTS support on summaries
alter table public.thread_summary_versions
  add column if not exists tsv tsvector generated always as (to_tsvector('english', coalesce(summary,''))) stored;

create index if not exists thread_summary_versions_tsv_gin
  on public.thread_summary_versions using gin (tsv);

-- 5) FAQ / intent gate
create table if not exists public.gate_intents (
  intent_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(tenant_id) on delete cascade,
  sector text not null check (sector in ('child','adult','both')),
  label text not null,
  trigger_text text not null,
  answer_text text null,
  robot_text text null,
  updated_at timestamptz not null default now()
);

alter table public.gate_intents
  add column if not exists tsv tsvector generated always as (to_tsvector('english', coalesce(trigger_text,''))) stored;

create index if not exists gate_intents_tsv_gin
  on public.gate_intents using gin (tsv);
