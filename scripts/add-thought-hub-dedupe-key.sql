-- ThoughtHub: add optional dedupe_key to events for idempotent imports.
-- Safe to run after add-cohere-style-chronograph.sql has already been applied.

alter table public.events
  add column if not exists dedupe_key text null;

-- Replace any previous partial index with a full unique index.
drop index if exists public.events_thread_dedupe_key_uq;

create unique index if not exists events_thread_dedupe_key_uq
  on public.events (tenant_id, thread_id, dedupe_key);
