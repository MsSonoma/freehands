Lesson Daily Quota (Unique Per Day)

Server-side enforcement for daily unique lesson starts using Supabase. Revisiting the same lesson on the same day does NOT increase the count. The day boundary is computed using the user's IANA time zone.

Schema
Run in Supabase SQL editor:

create table if not exists lesson_unique_starts (
  user_id uuid not null,
  day date not null,
  lesson_key text not null,
  primary key (user_id, day, lesson_key)
);

-- Optional RLS (the API uses service role; enable RLS to protect from other access paths)
alter table lesson_unique_starts enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'lesson_unique_starts' and policyname = 'user can read own') then
    create policy "user can read own" on lesson_unique_starts for select using (auth.uid() = user_id);
  end if;
end $$;

API
- GET /api/lessons/quota?tz=America/New_York → { plan_tier, count, limit, remaining }
- POST /api/lessons/quota with JSON { lesson_key: string, timezone?: string } → records unique start if not present; returns { plan_tier, count, limit }, or 429 if adding would exceed the daily limit.

Client usage
- On Begin click: call POST with { lesson_key, timezone } before navigating. If 429, show a message and do not navigate.
- The client keeps a local set of unique lesson_keys per day to provide snappy feedback; the server remains the source of truth.

Notes
- lesson_key should be a stable per-lesson identifier (we use the JSON filename from /public/lessons/... ).
- If timezone is omitted, UTC is used on the server.
