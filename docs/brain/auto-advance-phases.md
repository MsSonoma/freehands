# Auto-Advance Phases

## Overview

Per-learner setting that automatically advances through phase transitions by skipping "Begin" buttons. Prevents learners from stalling at phase entrances to extend breaks.

## How It Works

- Storage: `learners.auto_advance_phases` boolean (default true). `true` = show Begin buttons; `false` = auto-click them after a 500ms delay.
- UI: The Learner edit overlay no longer exposes this as a Basic Info option (the previous switch labeled "Phase Begin Buttons" was removed as outdated). Existing learners still keep their stored value.
- Persistence: `clientApi.updateLearner/createLearner` write `auto_advance_phases` to Supabase (flat + JSON schemas) and to the localStorage fallback (`facilitator_learners`). `normalizeRow` defaults to true when null so `false` survives refresh.
- Session load: `session/page.js` reads `learner.auto_advance_phases` into state; storage change listener rehydrates when learner selection changes.
- Runtime: useEffect watches `phase`, `subPhase`, `ticker`, and reruns when lesson data finishes loading. If `autoAdvancePhases === false` and we are in an awaiting-begin state (`awaiting-learner`, `comprehension-start`, `exercise-awaiting-begin`, `worksheet-awaiting-begin`, `test-awaiting-begin`), wait 500ms then call the appropriate Begin handler (not Go) so intros and opening actions still run. Only the very first Begin (discussion `awaiting-learner` while `ticker === 0`) is exempt so users must explicitly start the lesson. UI hides Begin buttons when auto-advance is off to prevent flash before auto-click. Begin refs are set after all Begin handlers are declared to avoid TDZ while still tracking live handlers.
- Initial Begin exception: Skip automation only when `phase === 'discussion'`, `subPhase === 'awaiting-learner'`, and `ticker === 0`; later phase resets to `ticker = 0` should still auto-advance.

## What NOT To Do

- ❌ Don't skip initial lesson Begin button
- ❌ Don't skip opening actions or play phase
- ❌ Don't skip countdown overlay when play timer expires
- ❌ Don't auto-advance during games or activities
- ❌ Don't add to dependency array: lessonData (causes TDZ)
- ❌ Don't gate the entire feature on `ticker`—only the first discussion Begin uses the `ticker === 0` exemption
- ❌ Don't render Begin buttons during auto-advance (except the initial Begin) or they will flash
- ❌ Don't call Go handlers from auto-advance; use Begin handlers so intros/opening actions render
- ✅ Only auto-click Begin buttons at phase transitions
- ✅ Always let entrance screens render (500ms delay)
- ❌ Don't re-add the removed "Phase Begin Buttons" toggle to the Learner Basic Info options

## Key Files

**Database**:
- `supabase/migrations/20251216_add_auto_advance_phases.sql`

**Facilitator UI**:
- `src/app/facilitator/learners/components/LearnerEditOverlay.jsx`
  - State: `autoAdvancePhases`
  - UI: Toggle removed from Basic Info options (setting remains persisted and still affects runtime)
  - Save: Include in `onSave` payload

**Session Logic**:
- `src/app/session/page.js`
  - Lines ~548: State variable
  - Lines ~644: Load from learner profile
  - Lines ~729: Reload on storage change
  - Lines ~1146: Auto-advance useEffect

## Edge Cases

- **Snapshot restore**: If restored to awaiting-begin with `ticker > 0`, auto-advance triggers
- **Demo mode**: Defaults to `true` (show buttons)
- **Golden key**: Auto-advance still applies (just faster)
- **Play timer expiration**: Countdown shows normally, then auto-advance applies to next phase

## Analytics Opportunity

Could log auto-advance events vs manual clicks to show facilitators which learners need this setting.