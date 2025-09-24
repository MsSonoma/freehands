# Device Leases (Concurrent Devices)

This feature limits the number of concurrent devices (browsers) active per user based on their plan tier.

## Schema

Create the following table in Supabase/Postgres:

```sql
create table if not exists public.device_leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  acquired_at timestamptz not null default now(),
  expires_at timestamptz not null,
  released_at timestamptz null
);

-- Indexes for active lease lookups
create index if not exists idx_device_leases_user_active
  on public.device_leases (user_id)
  where released_at is null;

create index if not exists idx_device_leases_active_time
  on public.device_leases (expires_at)
  where released_at is null;

-- Optional: prevent duplicate active lease per (user_id, device_id)
create unique index if not exists uq_device_active_per_device
  on public.device_leases (user_id, device_id)
  where released_at is null and expires_at > now();
```

## API Endpoints

- `GET /api/devices/status` → Returns `{ plan_tier, devicesCap, active }`.
- `POST /api/devices/claim` with JSON `{ device_id, ttlSeconds? }` → Attempts to claim a slot, extends if already active. 409 when at capacity.
- `POST /api/devices/release` with JSON `{ device_id }` → Releases active lease for device.

All endpoints require an Authorization Bearer token for the current user (use Supabase session access token).

## Enforcement

The cap is based on plan_tier from `profiles`:

- free: 1
- basic: 1
- plus: 1
- premium: 2

You can change the mapping centrally (for now duplicated in route files) or wire it to `src/app/lib/entitlements.js` on the server as needed.

## Notes

- Leases auto-expire when `expires_at` passes; clients can periodically POST claim to extend.
- On logout or tab close, clients should POST release to free the slot sooner.
- Consider adding a background job to purge expired rows.
