# Play Dependent on Work

**Feature:** When enabled for a learner, failing to complete a work timer on time causes the next phase's play timer to be skipped. Work earns play.

**Related Brain Files:**
- **[feature-edge-map.md](feature-edge-map.md)** — Full dependency graph for all 9 session features
- **[timer-system.md](timer-system.md)** — Play and work timers; golden key eligibility
- **[learner-settings-bus.md](learner-settings-bus.md)** — Live flag sync into running session

---

## Core Architecture

**Flag:** `learners.play_dependent_on_work` (BOOLEAN, default `false`)

**Runtime ref:** `playDependentOnWorkRef.current` in `SessionPageV2.jsx` (mirrors state to avoid stale closures)

**Live update path:** Learner Settings Bus → `patchLearner` handler → `playDependentOnWorkRef.current = patch.play_dependent_on_work`

---

## Key Files

- `src/app/session/v2/SessionPageV2.jsx` — Core runtime logic
- `src/app/facilitator/learners/components/LearnerEditOverlay.jsx` — Facilitator toggle UI
- `scripts/add-play-timer-mode-columns.sql` — Schema: `play_dependent_on_work BOOLEAN DEFAULT false`

---

## How It Works

At the end of every work phase (comprehension, exercise, worksheet, test), the session page checks:

```javascript
if (playDependentOnWorkRef.current && playTimersEnabledRef.current && !workPhaseCompletedOnTime) {
  workExpiredNextPhaseRef.current = nextPhase;
  setShowWorkExpiredSkipPlay(true);
  // Defer phaseComplete emit until overlay closes
}
```

**When triggered:**
1. `WorkExpiredSkipPlay` overlay appears (variant `'work-expired'`)  
2. 30-second countdown runs while overlay is displayed
3. On close: `startPhasePlayTimer()` is skipped for the next phase — immediately enters work timer
4. Phase orchestrator continues from work-only entry point

**When NOT triggered (play proceeds normally):**
- `play_dependent_on_work = false`
- `play_timers_enabled = false` (master toggle off)
- Work phase completed on time

---

## Dependencies and Interactions

| Dependency | Direction | Rule |
|-----------|-----------|------|
| `play_timers_enabled` | Play Dependent requires this to be `true` | If master play toggle is off, the penalty cannot fire |
| Golden Key | Play Dependent skipping a work phase does NOT prevent that phase counting toward golden key | A skipped play is still a completed work phase |
| Snapshot | `playDependentOnWorkRef` is NOT stored in snapshot | Flag comes from learner profile fresh on every session start |
| Timers Overlay | Parent can still adjust timers — adjusting remaining work time can change whether the penalty fires | No conflict if overlay updates go through TimerService |

---

## DO NOT BREAK

1. **Orchestrator deferral**: The `phaseComplete` event MUST NOT fire while the WorkExpiredSkipPlay overlay is showing. Emitting it prematurely advances the phase before the learner reads the notification.

2. **Work phase, not play phase**: The check fires at the END of the work phase of phase N, causing phase N+1 to skip ITS play. Do not flip this to "skip current phase's play" — that would skip the current work phase instead.

3. **Ref, not state**: Use `playDependentOnWorkRef.current`, not the React state variable, in phase-completion callbacks. The state variable may be stale inside a closure.

4. **Both conditions required**: `playDependentOnWork && playTimersEnabled`. Checking only one of these causes unexpected behavior when either flag is toggled live.

5. **Live bus update**: The `patchLearner` handler must update `playDependentOnWorkRef.current` immediately. Failing to do so means a live toggle from the parent has no effect until next page load.
