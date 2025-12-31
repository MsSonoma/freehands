# Cancellation Feedback

Collects short feedback when users cancel immediately. Data is optional and best-effort—cancellation proceeds regardless.

## Table

```sql
create table if not exists public.cancellation_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reasons text[] not null default '{}',
  message text null,
  allow_contact boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_cancellation_feedback_user on public.cancellation_feedback(user_id);
```

## API

POST `/api/billing/manage/feedback`

Body:

```json
{ "reasons": ["Too expensive"], "message": "...", "allowContact": true }
```

If the table is missing, the API responds with `{ stored: false, hint }` but still returns 200 so cancellation is not blocked.
