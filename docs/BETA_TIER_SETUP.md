# Beta Subscription Tier Setup

## Overview

Beta users now automatically receive Plus-level entitlements without requiring a paid subscription tier.

## How It Works

The system checks two fields:
- `subscription_tier` - Controls Beta program features (tutorials, surveys, analytics)
- `stripe_subscription_tier` / `plan_tier` - Controls paid subscription features

When `subscription_tier = 'Beta'`, the user automatically gets Plus-level access regardless of their paid tier.

## Beta User Entitlements (Automatic Plus-Level)

✅ **Unlimited lessons per day**  
✅ **Facilitator tools** (calendar, lesson management)  
✅ **Ask feature** enabled  
✅ **Golden key features** enabled  
✅ **5 lifetime lesson generations**  
✅ **1 weekly lesson generation** (in addition to lifetime)  
✅ **2 learners max**  
✅ **Tutorial gating** (facilitator video, tutorial, learner tutorial, post-lesson survey)  
✅ **Session analytics** (duration, repeats, facilitator notes)

## Assigning Beta Tier

### In Supabase SQL Editor

```sql
-- Assign Beta tier to a specific user by email
UPDATE public.profiles 
SET subscription_tier = 'Beta' 
WHERE email = 'user@example.com';

-- Assign Beta tier to a specific user by ID
UPDATE public.profiles 
SET subscription_tier = 'Beta' 
WHERE id = 'user-uuid-here';

-- Remove Beta tier (post-beta program)
UPDATE public.profiles 
SET subscription_tier = NULL
WHERE subscription_tier = 'Beta';
```

### Verify Beta User Setup

```sql
-- Check a user's subscription status
SELECT 
  id, 
  email, 
  subscription_tier,              -- Should be 'Beta'
  stripe_subscription_tier,       -- Can be NULL
  plan_tier,                      -- Can be NULL
  fac_signup_video_completed_at,  -- Tutorial tracking
  fac_tutorial_completed_at       -- Tutorial tracking
FROM profiles 
WHERE email = 'your-email@example.com';
```

## Testing Beta Access

After setting `subscription_tier = 'Beta'`:

1. **Log in** to the app
2. **Check daily lesson limit**: Should show "Unlimited" or very high number
3. **Access facilitator tools**: Calendar and lesson management should be visible
4. **Generate a lesson**: Should have 5 lifetime + 1 weekly generation quota
5. **Tutorial gates**: Should see facilitator video gate on first login (if `fac_signup_video_completed_at` is NULL)

## Important Notes

### Independent Systems

Beta tier is **independent** from paid tiers:
- You can change Beta entitlements without affecting Plus subscribers
- Beta users can later upgrade to paid tiers (Beta features continue, paid tier overrides if higher)
- Removing Beta tier (`SET subscription_tier = NULL`) immediately reverts user to their paid tier (or free if none)

### Database Fields Used

The system queries these fields from `profiles`:

| Field | Purpose | Beta Value |
|-------|---------|------------|
| `subscription_tier` | Beta program membership | `'Beta'` |
| `stripe_subscription_tier` | Stripe paid tier | Usually `NULL` for Beta |
| `plan_tier` | Fallback paid tier | Usually `NULL` or `'free'` |
| `fac_signup_video_completed_at` | Tutorial gate tracking | Set after completing video |
| `fac_tutorial_completed_at` | Tutorial gate tracking | Set after completing tutorial |

### Code Implementation

The mapping is handled by `resolveEffectiveTier()` in `src/app/lib/entitlements.js`:

```javascript
function resolveEffectiveTier(subscriptionTier, paidTier) {
  if (subscriptionTier?.toLowerCase() === 'beta') {
    return 'plus';  // Beta users get Plus-level access
  }
  return (paidTier || 'free').toLowerCase();
}
```

All usage check API routes use this function:
- `src/app/api/usage/check-lesson-quota/route.js`
- `src/app/api/usage/check-generation-quota/route.js`
- `src/app/api/usage/increment-generation/route.js`
- `src/app/api/lessons/quota/route.js`

## Troubleshooting

### Beta user still seeing free tier limits

1. **Check database**: Verify `subscription_tier = 'Beta'` (case-sensitive, must be capitalized)
2. **Clear cache**: Log out and log back in
3. **Check API response**: Look in browser DevTools Network tab for `/api/usage/check-lesson-quota` - should return `tier: "plus"`

### Tutorial gates not appearing

1. **Check feature flags**: In `src/app/lib/betaConfig.js`, ensure `FORCE_TUTORIALS_FOR_BETA: true`
2. **Check completion status**: Query `fac_signup_video_completed_at` - should be `NULL` to see gate
3. **Verify Beta tier**: Only users with `subscription_tier = 'Beta'` see mandatory gates

### How to bypass tutorial gates for testing

```sql
-- Mark all tutorials as completed for a Beta user
UPDATE public.profiles 
SET 
  fac_signup_video_completed_at = NOW(),
  fac_tutorial_completed_at = NOW()
WHERE email = 'test-user@example.com';
```

## Beta Program Removal

When the Beta program ends:

```sql
-- Remove Beta tier from all users (revert to their paid tier or free)
UPDATE public.profiles 
SET subscription_tier = NULL
WHERE subscription_tier = 'Beta';

-- Optionally, assign paid tiers to Beta graduates
UPDATE public.profiles 
SET 
  subscription_tier = NULL,
  stripe_subscription_tier = 'plus'
WHERE subscription_tier = 'Beta';
```

## Related Documentation

- `docs/brain/beta-program.md` - Beta program implementation details
- `docs/brain/BETA_PROGRAM_IMPLEMENTATION.md` - Tutorial gating and surveys
- `src/app/lib/betaConfig.js` - Beta feature flags
- `src/app/lib/entitlements.js` - Tier entitlements and Beta mapping
