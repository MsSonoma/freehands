# Auth Session Isolation (Cross-Device Logout Issue)

## Critical Problem Solved

**BUG**: Logging out on Device A logged out Device B. Logging into a different account on Device A changed the logged-in user on Device B.

**ROOT CAUSE**: `supabase.auth.signOut()` defaults to `scope: 'global'`, which invalidates the session **server-side** in the Supabase database. This affects ALL devices using that account because they all share the same server-side session.

## How It Works Now

### Local Logout Scope

Changed all `signOut()` calls to use `scope: 'local'`:

```javascript
// Before (global logout - affects all devices):
await supabase.auth.signOut()

// After (local logout - only this device):
await supabase.auth.signOut({ scope: 'local' })
```

**What scope: 'local' does:**
- Clears auth tokens from localStorage on **current device only**
- Does NOT invalidate the server-side session
- Other devices continue using the same session
- Server session eventually expires naturally (based on JWT expiry time)

**What scope: 'global' does (default):**
- Clears auth tokens from localStorage on current device
- **Invalidates server-side session in Supabase database**
- All other devices immediately lose access when they next make an API call
- Session tokens on other devices become invalid

## Why This Happened

Supabase auth sessions work in two layers:

1. **Client-side (localStorage)**: Access token + refresh token stored locally
2. **Server-side (Supabase database)**: Session record with expiry, used to validate tokens

When you call `signOut()` with default settings:
- It clears localStorage on Device A ✓
- It calls Supabase API to invalidate the session record ✗
- Device B's tokens become invalid because server session is gone

**The confusion:** localStorage is device-local, but the session record is shared server-side.

## Files Changed

- `src/app/facilitator/account/settings/page.js` - Added `scope: 'local'` to delete account signOut
- `src/app/facilitator/account/page.js` - Added `scope: 'local'` to logout button signOut

## What NOT To Do

**DO NOT:**
- Use `scope: 'global'` unless you explicitly want to log out all devices (e.g., "Log out everywhere" button)
- Remove the scope parameter (reverts to global logout)
- Assume localStorage changes affect other devices (they don't - this was server-side)

## When To Use Each Scope

**Use `scope: 'local'` (default choice):**
- Normal logout button
- Account deletion (user may have other devices)
- Session timeout on current device
- "Log out of this device" action

**Use `scope: 'global'` (explicit choice):**
- "Log out everywhere" feature (security)
- Password change (force re-auth on all devices)
- Account compromise response
- Admin-initiated logout

## Security Considerations

**Reduced Security vs. Better UX:**
- `scope: 'local'` means compromised device logout doesn't revoke other devices
- Session remains valid until JWT expiry (default: 1 hour with 7-day refresh)
- Attacker with stolen token could use it until natural expiry

**Mitigation:**
- Keep JWT expiry time reasonable (1 hour is good)
- Provide "Log out everywhere" button for users who want it
- Force global logout on password change
- Monitor suspicious activity and force global logout server-side

**Why this trade-off is OK:**
- Most users expect device-independent sessions (Gmail, Facebook, etc. work this way)
- Losing all devices on single logout is bad UX
- Users can explicitly choose "log out everywhere" if needed

## Testing Verification

**Test 1: Local Logout**
1. Log in on Device A (laptop)
2. Log in on Device B (phone) with same account
3. Log out on Device A
4. **Expected**: Device A logged out, Device B still logged in
5. **Before Fix**: Both devices logged out

**Test 2: Account Switch**
1. Log in as User 1 on Device A
2. Log in as User 1 on Device B
3. Log out on Device A, log in as User 2 on Device A
4. **Expected**: Device A is User 2, Device B still User 1
5. **Before Fix**: Device B switched to User 2 or logged out

**Test 3: Session Persistence**
1. Log in on Device A
2. Log in on Device B (same account)
3. Close browser on Device A (not logged out)
4. Reopen browser on Device A
5. **Expected**: Device A still logged in (session persisted)

## Edge Cases

### Natural Session Expiry
- Access token expires after 1 hour (configurable in Supabase)
- Refresh token expires after 7 days (configurable)
- Device automatically refreshes using refresh token
- If refresh token expires, user must log in again (on that device only)

### Concurrent Logout
- User logs out on Device A and Device B simultaneously
- Both use `scope: 'local'`
- Server session remains valid (neither invalidated it)
- Session eventually expires naturally

### Password Change
- Should use `scope: 'global'` to force re-auth everywhere
- Not implemented yet - future enhancement

### Account Deletion
- Currently uses `scope: 'local'`
- Could argue for `scope: 'global'` since account is gone
- But API deletes user anyway, so other devices will fail on next API call

## Future Enhancements

- Add "Log out everywhere" button (explicit `scope: 'global'`)
- Force global logout on password change
- Show "active sessions" list (like Google/Facebook)
- Server-side session revocation API

## Acceptance Criteria

- ✅ Logging out on Device A does NOT log out Device B
- ✅ Logging into different account on Device A does NOT affect Device B
- ✅ Sessions persist across browser refresh on same device
- ✅ Sessions eventually expire naturally (JWT expiry)
- ✅ No custom storage adapters needed (default Supabase behavior works)
- ✅ All signOut() calls explicitly specify scope parameter
