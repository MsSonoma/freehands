# Universal Gating System

## How It Works

Users can browse pages and see what features look like, but gated actions are blocked with a consistent overlay/CTA. Gating is driven by entitlements (not hardcoded tier strings).

### GatedOverlay Component

Location: `src/app/components/GatedOverlay.jsx`

Reusable overlay component that shows appropriate messaging based on gate type:

**Auth Gate**
- Prompts user to sign up/sign in with buttons
- Shows feature preview with benefits
- Links to authentication flow

**Tier Gate**
- Prompts user to upgrade with upgrade button
- Shows current tier vs required tier
- Lists feature benefits
- Links to upgrade/account page

**Props:**
- `show` (boolean): Whether to display overlay
- `gateType` ('auth' | 'tier'): Type of gate
- `feature` (string): Feature name
- `emoji` (string): Display emoji
- `description` (string): Feature description
- `benefits` (array): List of benefits
- `currentTier` (string): User's current tier (for tier gates)
- `requiredTier` (string): Required tier (for tier gates)

**Tier model (current)**

- `free` - signed in, no paid features
- `trial` - limited (lifetime) generations; can view all surfaces; write actions for Calendar/Mr. Mentor/Golden Keys/Visual Aids/Games remain gated
- `standard` - paid
- `pro` - paid; includes Mr. Mentor and planner/curriculum prefs
- `lifetime` - legacy tier (treated as fully entitled)

**Tier normalization (legacy compatibility)**

Some older accounts may still have legacy tier ids stored in `profiles.plan_tier` **or** `profiles.subscription_tier`.
Entitlement checks must normalize these values before lookup, and resolve the effective tier using the most-entitled value across both columns:

- `premium` / `premium-plus` -> `pro`
- `plus` / `basic` -> `standard`

**Important:** `requiredTier` is display/CTA text. Logic should be driven by `requiredFeature` entitlements.

### useAccessControl Hook

Location: `src/app/hooks/useAccessControl.js`

Hook for checking authentication and tier access.

**Options:**
- `requiredAuth`: 'none' | 'any' | 'required'
- `requiredFeature`: Feature key from entitlements (e.g., 'lessonGenerator', 'lessonPlanner', 'mentorSessions')
- `minimumTier`: Minimum tier required

**Returns:**
- `loading`: Whether check is in progress
- `isAuthenticated`: Whether user is logged in
- `tier`: User's current tier
- `hasAccess`: Whether user has access
- `gateType`: null | 'auth' | 'tier'

## Implementation Pattern

### For Pages Requiring Authentication Only

```jsx
import GatedOverlay from '@/app/components/GatedOverlay'
import { useAccessControl } from '@/app/hooks/useAccessControl'

export default function MyPage() {
  const { loading, hasAccess, gateType, tier } = useAccessControl({
    requiredAuth: 'required'
  })

  if (loading) return <div>Loading...</div>

  return (
    <>
      {/* Page content - always rendered for preview */}
      <main>...</main>

      {/* Show overlay if no access */}
      <GatedOverlay
        show={!hasAccess}
        gateType={gateType}
        feature="Feature Name"
        emoji="🔒"
        description="Description of feature"
        benefits={[
          'Benefit 1',
          'Benefit 2'
        ]}
      />
    </>
  )
}
```

### For Pages Requiring Tier/Feature

```jsx
import GatedOverlay from '@/app/components/GatedOverlay'
import { useAccessControl } from '@/app/hooks/useAccessControl'

export default function PremiumFeaturePage() {
  const { loading, hasAccess, gateType, isAuthenticated, tier } = useAccessControl({
    requiredAuth: 'required',
    requiredFeature: 'lessonGenerator' // from entitlements
  })

  if (loading) return <div>Loading...</div>

  return (
    <>
      {/* Page content - always rendered */}
      <main>...</main>

      {/* Overlay */}
      <GatedOverlay
        show={!hasAccess}
        gateType={gateType}
        feature="Feature Name"
        emoji="🎓"
        description="Paid feature description"
        benefits={[
          'Feature benefit 1',
          'Feature benefit 2'
        ]}
        currentTier={tier}
        requiredTier="standard"
      />
    </>
  )
}
```

## Related Brain Files

- **[beta-program.md](beta-program.md)** - Universal gates enforce beta tier restrictions
- **[device-leases.md](device-leases.md)** - GatedOverlay wraps device lease enforcement
- **[lesson-quota.md](lesson-quota.md)** - GatedOverlay wraps lesson quota enforcement

## Key Files

- `src/app/components/GatedOverlay.jsx` - Overlay component
- `src/app/hooks/useAccessControl.js` - Access control hook
- `src/app/lib/entitlements.js` - Feature entitlements by tier

## What NOT To Do

- Never hide page content when showing overlay (always render for preview)
- Never allow functionality without access check (server-side validation required)
- Never skip loading state (prevents flash of wrong UI)
- Never hardcode tier requirements (use entitlements config)
- Never forget to pass currentTier and requiredTier for tier gates

## Notes

- For in-session buttons (e.g., Games / Visual Aids), keep the UI visible and block only the action with a short, in-context notice.
- For the Facilitator Calendar, do not use a tier overlay that blocks scrolling/clicking. Keep the page viewable and gate only write actions (view-only banner + guarded handlers).
- For Mr. Mentor, keep the page viewable when signed in (no full-screen lock overlay). Load read-only context (e.g., learners, transcripts, notes) without requiring the paid entitlement.
- For Mr. Mentor, gate write paths behind entitlements: sending messages, session initialization/persistence, and any mutations triggered from the Mr. Mentor surface.
- Server routes must enforce the same entitlements (UI gating is not sufficient).
