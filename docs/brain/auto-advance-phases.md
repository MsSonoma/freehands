# Auto-Advance Phases

## Overview

Per-learner setting that automatically advances through phase transitions by skipping "Begin" buttons. Prevents learners from stalling at phase entrances to extend breaks.

## How It Works

**Database Field**: `learners.auto_advance_phases` (boolean, default `true`)
- `true`: Show Begin buttons at phase transitions (default behavior)
- `false`: Auto-click Begin buttons after 500ms delay

**UI Control**: Facilitator → Learners → Edit Learner → Basic Info tab
- Pill switch toggle after Golden Keys field
- Label: "Phase Begin Buttons"
- Description explains behavior difference

**Session Behavior**:
1. Load `autoAdvancePhases` from learner profile
2. useEffect watches `phase`, `subPhase`, `ticker` state
3. Detect awaiting-begin states:
   - `awaiting-learner` (teaching/discussion)
   - `comprehension-start`
   - `exercise-awaiting-begin`
   - `worksheet-awaiting-begin`
   - `test-awaiting-begin` or `review-start`
4. If `autoAdvancePhases === false` AND `ticker > 0` AND awaiting-begin:
   - Wait 500ms (entrance screen renders)
   - Call phase handler automatically

**Initial Begin Exception**:
- First Begin button (lesson start, `ticker === 0`) ALWAYS shows
- Auto-advance only applies to phase transitions after teaching begins
- Preserves learner readiness and consent to start

## What NOT To Do

- ❌ Don't skip initial lesson Begin button
- ❌ Don't skip opening actions or play phase
- ❌ Don't skip countdown overlay when play timer expires
- ❌ Don't auto-advance during games or activities
- ❌ Don't add to dependency array: lessonData (causes TDZ)
- ✅ Only auto-click Begin buttons at phase transitions
- ✅ Always let entrance screens render (500ms delay)

## Key Files

**Database**:
- `supabase/migrations/20251216_add_auto_advance_phases.sql`

**Facilitator UI**:
- `src/app/facilitator/learners/components/LearnerEditOverlay.jsx`
  - State: `autoAdvancePhases`
  - UI: Pill switch in Basic Info tab
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