# Universal Gating System

## How It Works

Allows users to browse all pages to see what features look like, but shows overlays when they need to sign in or upgrade to actually use them.

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

### useAccessControl Hook

Location: `src/app/hooks/useAccessControl.js`

Hook for checking authentication and tier access.

**Options:**
- `requiredAuth`: 'none' | 'any' | 'required'
- `requiredFeature`: Feature key from entitlements (e.g., 'facilitatorTools')
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
    requiredFeature: 'facilitatorTools' // from entitlements
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
        description="Premium feature description"
        benefits={[
          'Feature benefit 1',
          'Feature benefit 2'
        ]}
        currentTier={tier}
        requiredTier="premium"
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
