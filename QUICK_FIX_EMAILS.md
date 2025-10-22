# Quick Fix: Missing User Emails

## What to do right now:

1. **Open Supabase Dashboard** → SQL Editor

2. **Copy and run this script:**
   - File: `scripts/setup-profiles-with-triggers.sql`
   - This takes ~5 seconds to run

3. **Verify it worked:**
   - Run: `scripts/verify-profiles-setup.sql` (query #4)
   - You should see "✅ OK" for all users

4. **Fix your friend's account:**
   ```sql
   -- Run this in Supabase SQL Editor
   update public.profiles p
   set email = u.email,
       updated_at = now()
   from auth.users u
   where p.id = u.id
     and (p.email is null or p.email = '');
   ```

5. **Check your friend's email is now saved:**
   ```sql
   select 
     u.email as auth_email,
     p.email as profile_email
   from auth.users u
   join public.profiles p on p.id = u.id
   where u.email = 'your-friends-email@example.com';
   ```

## Why this happened:
- The database triggers that sync emails weren't installed
- Your signup code relies on these automatic triggers
- Without them, emails don't get copied from `auth.users` to `profiles`

## What this fixes:
✅ All new signups will automatically have emails saved  
✅ Existing users without emails will be backfilled  
✅ Email updates will sync automatically  
✅ Your friend's account will have their email restored  

## Files created:
- `scripts/setup-profiles-with-triggers.sql` - Main setup script
- `scripts/verify-profiles-setup.sql` - Check if everything is working
- `docs/SETUP_PROFILES_EMAIL_SYNC.md` - Detailed guide
- Updated `README.md` with setup instructions
