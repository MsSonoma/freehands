# Email Authentication Link Fix

## Problem
Email confirmation links from Supabase weren't working after signup because:
1. Missing redirect URL configuration (`NEXT_PUBLIC_SITE_URL`)
2. Missing auth callback route to handle email confirmation
3. Redirect URL not configured in Supabase dashboard

## Solution

### 1. Added Environment Variable
Added `NEXT_PUBLIC_SITE_URL` to `.env.local`:
```
NEXT_PUBLIC_SITE_URL=https://mssonoma.com
```

**Important:** This should match your production domain where the app is deployed.

### 2. Created Auth Callback Route
Created `src/app/auth/callback/route.js` to handle email confirmation redirects.

This route:
- Receives the confirmation code from Supabase
- Exchanges it for a session
- Redirects user to `/facilitator` on success
- Redirects to `/auth/login?error=auth_callback_failed` on failure

### 3. Updated Signup/Login Pages
Modified `src/app/auth/signup/page.js` and `src/app/auth/login/page.js` to:
- Use `NEXT_PUBLIC_SITE_URL` with `/auth/callback` path
- Fall back to `window.location.origin` if env var not set

### 4. Configure Supabase Dashboard (REQUIRED)

**You must add the callback URL to your Supabase project settings:**

1. Go to https://app.supabase.com/project/fyfepvozqxgldgfpznrr/auth/url-configuration
2. Under **Redirect URLs**, add: `https://mssonoma.com/auth/callback`
3. Click **Save**

**Note:** Supabase blocks redirects to URLs not in this whitelist for security.

## Testing

1. Restart your dev server to load new environment variables:
## Testing

1. Deploy the changes to Vercel (the environment variable needs to be set in Vercel's dashboard too)
2. Go to https://mssonoma.com/auth/signup
3. Create an account with a real email address
4. Check your email for the confirmation link
5. Click the link - it should redirect to `/auth/callback` then to `/facilitator`
### Link still doesn't work
- Check Supabase dashboard: Is `http://localhost:3001/auth/callback` in Redirect URLs?
- Check browser console for errors
- Check server logs for "Auth callback error"

### Link still doesn't work
- Check Supabase dashboard: Is `https://mssonoma.com/auth/callback` in Redirect URLs?
- Check Vercel environment variables: Is `NEXT_PUBLIC_SITE_URL=https://mssonoma.com` set?
- Check browser console for errors
- Check Vercel function logs for "Auth callback error"

### "Invalid redirect URL" error
- The URL in Redirect URLs must EXACTLY match what the app sends
- Include protocol (`https://`)
- No trailing slash
- Must match your production domain exactly

### Vercel Deployment
1. Add environment variable in Vercel dashboard:
   - Go to Project Settings → Environment Variables
   - Add `NEXT_PUBLIC_SITE_URL` = `https://mssonoma.com`
   - Apply to Production, Preview, and Development
2. Redeploy to apply environment variable changespage.js` - Updated redirect URL construction
- `src/app/auth/login/page.js` - Updated resend confirmation redirect URL
