# Lesson Quota (Daily Unique Lessons)

## How It Works

Server-side enforcement for daily unique lesson starts using Supabase. Revisiting the same lesson on the same day does NOT increase the count. The day boundary is computed using the user's IANA time zone.

### Schema

Table: `lesson_unique_starts`

Columns:
- `user_id` (uuid, not null)
- `day` (date, not null)
- `lesson_key` (text, not null)
- Primary key: (user_id, day, lesson_key)

RLS enabled with policy "user can read own" using auth.uid() = user_id.

### API Endpoints

**GET /api/lessons/quota?tz=America/New_York**
- Returns: `{ plan_tier, count, limit, remaining }`
- Shows current day's quota usage

**POST /api/lessons/quota**
- Body: `{ lesson_key: string, timezone?: string }`
- Records unique start if not present
- Returns: `{ plan_tier, count, limit }`
- Returns 429 if adding would exceed daily limit

### Client Usage

**On Begin Click**
- Call POST with `{ lesson_key, timezone }` before navigating
- If 429, show message and do not navigate
- Client keeps local set of unique lesson_keys per day for snappy feedback
- Server remains source of truth

### Quota Limits by Tier

Limits based on plan_tier from profiles table:
- free: Limited daily lessons
- basic: More daily lessons
- plus: More daily lessons
- premium: Maximum daily lessons

(Exact limits configured in API route)

### Notes

- `lesson_key` should be stable per-lesson identifier (JSON filename from `/public/lessons/...`)
- If timezone omitted, UTC is used on server
- Daily boundary computed using user's IANA time zone

## Key Files

- `/api/lessons/quota` - Quota check and enforcement
- `lesson_unique_starts` table - Daily lesson tracking
- `src/app/lib/entitlements.js` - Tier limits

## What NOT To Do

- Never allow unlimited lesson starts (enforced by API)
- Never trust client-side quota counting (server is source of truth)
- Never skip timezone parameter (day boundary matters)
- Never allow quota bypass without tier check
- Never delete lesson_unique_starts records (historical data)
