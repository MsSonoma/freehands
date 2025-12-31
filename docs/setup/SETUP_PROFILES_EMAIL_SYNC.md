# Profiles Email Sync Setup

## Problem
User emails are not being saved to the `profiles` table when they sign up.

## Root Cause
The database triggers that automatically sync email addresses from `auth.users` to `public.profiles` are not installed in your Supabase instance.

## Solution

### Step 1: Run the Setup Script

1. Open your Supabase project dashboard
2. Navigate to the SQL Editor
3. Open the file `scripts/setup-profiles-with-triggers.sql` from this repository
4. Copy the entire contents and paste into the Supabase SQL editor
5. Click "Run" to execute the script

This script will:
- Create the `profiles` table if it doesn't exist
- Add the `email` column if missing
- Create trigger functions that sync email from `auth.users` to `profiles`
- Backfill emails for existing users who don't have profiles or emails
- Set up proper RLS (Row Level Security) policies

### Step 2: Verify the Setup

1. In the Supabase SQL Editor, run the verification queries from `scripts/verify-profiles-setup.sql`
2. Check query #4 to see all users and their email sync status
3. Look for any rows with status "❌ MISSING PROFILE" or "⚠️ MISSING EMAIL IN PROFILE"

Expected results:
- All queries should return data (no errors)
- Query #2 should show 2 triggers: `on_auth_user_created` and `on_auth_user_updated`
- Query #3 should show 2 functions: `handle_new_user` and `handle_user_update`
- Query #4 should show "✅ OK" status for all users

### Step 3: Fix Existing Users (if needed)

If query #4 shows users without emails, run this update query:

```sql
-- Sync emails for existing users who are missing them
update public.profiles p
set email = u.email,
    updated_at = now()
from auth.users u
where p.id = u.id
  and (p.email is null or p.email = '');
```

### Step 4: Test with a New Signup

1. Create a test account through your app's signup page
2. Check the `profiles` table in Supabase
3. Verify that the new user's email is populated

Query to check:
```sql
select 
  u.email as auth_email,
  p.email as profile_email,
  u.created_at
from auth.users u
join public.profiles p on p.id = u.id
order by u.created_at desc
limit 5;
```

## How It Works

When a user signs up:
1. Supabase creates a record in `auth.users` with their email
2. The `on_auth_user_created` trigger fires automatically
3. The `handle_new_user()` function creates a matching profile with the email

When a user's email changes:
1. Supabase updates the email in `auth.users`
2. The `on_auth_user_updated` trigger fires
3. The `handle_user_update()` function syncs the new email to the profile

## Troubleshooting

### Triggers are not firing
- Verify triggers exist: Run query #2 from `verify-profiles-setup.sql`
- Check function ownership: Functions must be owned by `postgres` user
- Re-run the setup script if triggers are missing

### Profile exists but email is null
- Run the sync update query from Step 3
- Check if the user's email exists in `auth.users`
- Verify RLS policies aren't blocking the update

### New signups still don't have emails
- Check Supabase logs for trigger errors
- Verify the function has `SECURITY DEFINER` set
- Ensure the `postgres` user owns the trigger functions

### Permission Errors
If you see "insufficient privilege" errors:
- Make sure you're running the script as a database owner/admin
- The Supabase SQL Editor typically has the right permissions
- If issues persist, contact Supabase support

## Related Files
- `scripts/setup-profiles-with-triggers.sql` - Complete setup script
- `scripts/verify-profiles-setup.sql` - Diagnostic queries
- `docs/profiles-schema.sql` - Original schema documentation (outdated)
