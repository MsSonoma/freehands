# Universal Gating System

## Overview
Allow users to browse all pages to see what features look like, but show overlays when they need to sign in or upgrade to actually use them.

## Components Created

### 1. `GatedOverlay` Component (`src/app/components/GatedOverlay.jsx`)
Reusable overlay component that shows appropriate messaging based on gate type:
- **Auth Gate**: Prompts user to sign up/sign in with buttons
- **Tier Gate**: Prompts user to upgrade with upgrade button

**Props:**
- `show` (boolean): Whether to display overlay
- `gateType` ('auth' | 'tier'): Type of gate
- `feature` (string): Feature name
- `emoji` (string): Display emoji
- `description` (string): Feature description  
- `benefits` (array): List of benefits
- `currentTier` (string): User's current tier
- `requiredTier` (string): Required tier

### 2. `useAccessControl` Hook (`src/app/hooks/useAccessControl.js`)
Hook for checking authentication and tier access.

**Options:**
- `requiredAuth`: 'none' | 'any' | 'required'
- `requiredFeature`: Feature key from entitlements
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
    requiredAuth: 'required', // or 'none' if can be used without auth
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
          'Premium benefit 1',
          'Premium benefit 2'
        ]}
        currentTier={tier}
        requiredTier="premium"
      />
    </>
  )
}
```

## Pages to Update

### Require Authentication
- `/learn` - Learner selection and progress tracking
- `/learn/lessons` - Lesson selection
- `/learn/awards` - Awards and achievements
- `/facilitator` - Facilitator hub
- `/facilitator/learners` - Learner management
- `/facilitator/learners/add` - Add learner
- `/facilitator/account` - Account settings
- `/facilitator/settings` - General settings

### Require Premium Tier (`facilitatorTools`)
- `/facilitator/tools` - Tools hub
- `/facilitator/tools/lesson-maker` - Lesson generator
- `/facilitator/tools/generated` - Generated lessons library
- `/facilitator/tools/counselor` - Mr. Mentor AI counselor
- `/facilitator/lessons` - Lesson approval and management
- `/facilitator/calendar` - Lesson scheduling calendar

### Current Implementation Status
- ✅ `GatedOverlay` component created
- ✅ `useAccessControl` hook created
- ✅ Counselor page has overlay (needs migration to new component)
- ✅ Lesson Maker page has overlay (needs migration)
- ✅ Generated lessons page has overlay (needs migration)
- ⏳ Other pages need overlays added

## Migration Steps

1. **Phase 1**: Update existing overlays to use `GatedOverlay` component
   - Counselor (`/facilitator/tools/counselor`)
   - Lesson Maker (`/facilitator/tools/lesson-maker`)
   - Generated Lessons (`/facilitator/tools/generated`)

2. **Phase 2**: Add auth gates to core pages
   - `/learn/*` pages
   - `/facilitator` (basic)
   - `/facilitator/learners/*`

3. **Phase 3**: Add tier gates to premium features
   - `/facilitator/lessons`
   - `/facilitator/calendar`
   - `/facilitator/tools`

4. **Phase 4**: Remove PIN gates from page-level access
   - Keep PIN gates for specific actions only
   - Use overlays for page-level access control

## Benefits

1. **Window Shopping**: Users can see all features before committing
2. **Clear CTAs**: Obvious next steps (sign up, sign in, upgrade)
3. **Consistent UX**: Same overlay style across all pages
4. **Easier Maintenance**: Centralized gating logic
5. **Better Conversion**: Show value before asking for commitment

## Notes

- PIN gates remain for specific actions within pages (skip, download, etc.)
- Overlays are non-blocking - content still renders underneath
- Uses backdrop blur for visual separation
- Mobile-responsive design
