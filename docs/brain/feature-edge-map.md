# Feature Edge Map — Session System

**Purpose:** This document is the anti-drift hub. It maps the 9 core session features as nodes in a dependency graph, documents every shared resource, and lists the invariants that must hold at all times. Cohere will pull this file into every session-related recon pack, keeping all 9 features visible at once.

**REQUIRED READING before editing ANY of: SessionPageV2.jsx, SnapshotService.jsx, TimerService.jsx, sessionSnapshotStore.js, assessmentStore.js, transcriptsClient.js, sessionTracking.js, or any component in session/components/.**

---

## The 9 Features (Nodes)

| # | Feature | Brain File | Status |
|---|---------|-----------|--------|
| 1 | **Snapshot** — Resume/Restart | [snapshot-persistence.md](snapshot-persistence.md) | ✅ Documented |
| 2 | **Takeover** — One device at a time | [session-takeover.md](session-takeover.md) | ✅ Documented |
| 3 | **Persistent Sets** — Same questions cross-device/refresh | [persistent-sets.md](persistent-sets.md) | ✅ Documented |
| 4 | **Timers** — Work across devices, through refreshes | [timer-system.md](timer-system.md) | ✅ Documented |
| 5 | **Play Dependent on Work** — Play timer gated by work timer result | [play-dependent-on-work.md](play-dependent-on-work.md) | ✅ Documented |
| 6 | **Timers Overlay** — In-session a-la-carte parent editing | [timers-overlay.md](timers-overlay.md) | ✅ Documented |
| 7 | **Learners List** — Per-learner settings | [learner-settings-bus.md](learner-settings-bus.md) | ✅ Documented |
| 8 | **Golden Key** — Completion prize that adds play time | [timer-system.md](timer-system.md) | ✅ Documented (in timer-system) |
| 9 | **Transcripts** — Full session recording | [transcripts.md](transcripts.md) | ✅ Documented |

---

## Shared Spine: The Snapshot Payload

All 9 features touch the snapshot. This is the canonical payload shape. **Do not add or remove fields without updating this document.**

```javascript
// Snapshot payload (Supabase `snapshots` table + localStorage mirror)
{
  // Identity (Snapshot + Takeover + Persistent Sets)
  sessionId: string,           // UUID for this session (lesson_sessions.id)
  learnerId: string,           // learner UUID
  lessonKey: string,           // canonical lesson key (no prefix, no .json)
  
  // Phase State (Snapshot)
  currentPhase: string,        // 'discussion'|'comprehension'|'exercise'|'worksheet'|'test'|'complete'
  completedPhases: string[],   // phases that have been finished
  phaseData: {                 // per-phase details (question indices, answers, etc.)
    discussion: {},
    comprehension: {},
    exercise: {},
    worksheet: {},
    test: {}
  },
  
  // Timer State (Timers + Golden Key + Play Dependent on Work)
  timerState: {                // serialized from TimerService.serialize()
    sessionElapsed: number,
    currentPlayPhase: string | null,
    currentWorkPhase: string | null,
    playTimers: [{ phase, elapsed, timeLimit, expired }],
    workPhaseTimers: [{ phase, elapsed, timeLimit, completed, onTime }],
    workPhaseResults: [{ phase, completed, onTime, elapsed, timeLimit, remaining, finishedAt }],
    onTimeCompletions: number,
    goldenKeyAwarded: boolean,
    mode: 'play' | 'work'
  },
  
  // Transcript (Transcripts)
  transcript: {
    lines: [{ role: 'assistant'|'user', text: string }],
    activeIndex: number
  },
  
  // Metadata
  lastUpdated: string,         // ISO timestamp
  snapshotVersion: number      // Must be 2; old v1 snapshots rejected
}
```

---

## Shared Storage Registry

**Rule:** Every storage key is owned by exactly ONE feature. Two features must never write to the same key using different schemas.

### Supabase Tables

| Table | Owner Feature(s) | Key Columns |
|-------|-----------------|-------------|
| `snapshots` | Snapshot, Takeover, Timers | `(learner_id, lesson_key)` |
| `lesson_sessions` | Takeover | `(learner_id, lesson_key)` + `device_id`, `ended_at` |
| `lesson_session_events` | Takeover, Transcripts | `session_id`, `event_type` |
| `learner_assessments` | Persistent Sets | `(user_id, learner_id, lesson_key)` |
| `learners` | Learners List | `id` (all per-learner settings columns) |

### Supabase Storage Buckets

| Bucket | Owner Feature | Path Pattern |
|--------|--------------|-------------|
| `transcripts` | Transcripts | `v1/{ownerId}/{learnerId}/{lessonId}/ledger.json` |
| `transcripts` | Transcripts | `v1/{ownerId}/{learnerId}/{lessonId}/transcript.pdf` |

### Learner Profile Columns (`learners` table)

| Column | Owner Feature | Type |
|--------|--------------|------|
| `play_timers_enabled` | Learners List + Timers | BOOLEAN, default true |
| `play_dependent_on_work` | Play Dependent on Work | BOOLEAN, default false |
| `golden_keys_enabled` | Golden Key | BOOLEAN, default true |
| `golden_key_bonus_min` | Golden Key | INTEGER, default 5 |
| `active_golden_keys` | Golden Key | JSONB `{ [lessonKey]: boolean }` |
| `golden_keys` | Golden Key | INTEGER (inventory count) |
| `{phase}_play_min` | Timers | INTEGER (5 columns: discussion/comprehension/exercise/worksheet/test) |
| `{phase}_work_min` | Timers | INTEGER (5 columns) |
| `play_{phase}_enabled` | Learners List + Timers | BOOLEAN (4 columns: comprehension/exercise/worksheet/test) |

### sessionStorage Keys

| Key Pattern | Owner Feature | Cleared By |
|-------------|--------------|-----------|
| `session_timer_state:{lessonKey}:{phase}:{mode}` | Timers | `TimerService.#removeTimerOverlayKey()` at phase transition |
| `timer_{phase}_{mode}` (V1 legacy) | Timers | Snapshot restore on takeover |

### localStorage Keys

| Key Pattern | Owner Feature | Cleared By |
|-------------|--------------|-----------|
| `atomic_snapshot:{learnerId}:{lessonKey}` | Snapshot | `SnapshotService.deleteSnapshot()` on complete |
| `lesson_assessments:{lessonId}` | Persistent Sets | `clearAssessments()` on complete or refresh |
| `learner_id`, `learner_name` | Learners List | Manual (facilitator logout) |

---

## Dependency Edges (Permanent Relationships)

These are the edges. When you change a node, trace all edges to check impact.

```
Learners List ──────────────────────────────────────────────────────────┐
  (provides play_timers_enabled, golden_keys_enabled, phase timer limits) │
  └──► Timers                                                             │
         ├──► Golden Key (work timer onTime → goldenKeyAwarded)           │
         │      └──► Timers Overlay (can apply/suspend golden key)        │
         ├──► Play Dependent on Work (work timer result → skip play)      │
         ├──► Timers Overlay (reads/writes running timer state)           │
         └──► Snapshot (timerState serialized at every gate)              │
                ├──► Takeover (snapshot is the handoff carrier)           │
                ├──► Persistent Sets (question arrays in phaseData)       │
                └──► Transcripts (transcript lines in snapshot)           │
                       └──► Takeover (transcript continues on new device) │
                                                                           │
All features read from ◄────────────────────────────────────────────────┘
  Learners List at session start (loadLearnerProfile)
```

### Critical Edge Rules

1. **Timers → Snapshot**: `TimerService.serialize()` MUST be called and stored in `snapshot.timerState` at every gate. If this is skipped, timer continuity breaks on refresh and takeover.

2. **Snapshot → Takeover**: Snapshot MUST be current before conflict detection triggers. Stale snapshot = timer drift after takeover.

3. **Learners List → Timers**: `loadLearnerProfile()` runs ONCE at session start. Live updates come via Learner Settings Bus (`patchLearner`). Any change to what `loadLearnerProfile()` reads must also update the bus patch handler.

4. **Golden Key → Timers**: `goldenKeyBonus` adds minutes to play timers via `TimerService.setPlayTimerLimits()`. Applying/suspending via overlay calls this same function.

5. **Play Dependent on Work → Golden Key**: Work timer must run for golden key eligibility. If `play_dependent_on_work` skips a work phase, that phase cannot count toward golden key.

6. **Persistent Sets → Snapshot**: Assessment arrays ARE NOT stored in snapshot. They are stored separately in `learner_assessments`. Snapshot only stores the current question INDEX (which question the learner is on). Do not confuse these.

7. **Transcripts → Snapshot**: `snapshot.transcript` holds runtime lines for resume (ephemeral). `transcripts/ledger.json` holds the final persisted record. Never mix these up. Snapshot transcript clears on complete; ledger is append-only forever.

---

## Shared Code Spine

These files are the backbone. Changing any of them can break multiple features simultaneously.

| File | Features It Touches | Change Risk |
|------|-------------------|-------------|
| `src/app/session/v2/SessionPageV2.jsx` | ALL 9 | 🔴 CRITICAL — 5000+ lines, all features flow through here |
| `src/app/session/v2/SnapshotService.jsx` | 1, 2, 3, 4, 5, 9 | 🔴 CRITICAL — snapshot payload and save/restore |
| `src/app/session/v2/TimerService.jsx` | 4, 5, 6, 8 | 🔴 CRITICAL — timer state machine |
| `src/app/session/sessionSnapshotStore.js` | 1, 2, 4 | 🟠 HIGH — V1 snapshot save/restore |
| `src/app/session/assessment/assessmentStore.js` | 3 | 🟡 MEDIUM — assessment persistence |
| `src/app/lib/transcriptsClient.js` | 9 | 🟡 MEDIUM — transcript ledger |
| `src/app/lib/sessionTracking.js` | 2 | 🟡 MEDIUM — session lifecycle |
| `src/app/session/utils/snapshotPersistenceUtils.js` | 1, 9 | 🟡 MEDIUM — V1 snapshot helpers |

---

## Anti-Drift Protocol

### Before Editing Any Shared Spine File

**Step 1 — Multi-Feature Recon (mandatory)**
```powershell
$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"
py -m cohere sk r -a MsSonoma -t "snapshot takeover persistent-sets timers play-dependent-on-work timers-overlay learners-list golden-key transcripts [your specific change]" --out sidekick_pack.md --journal-out sidekick_rounds.jsonl
```

**Step 2 — Check the Dependency Edges**  
Look at the edges above. For the feature you are changing, trace every outgoing edge and verify the downstream feature still works.

**Step 3 — Verify Snapshot Payload Shape**  
If you are changing the snapshot payload, update the "Shared Spine: Snapshot Payload" section in this file.

**Step 4 — Post-Edit Audit**
```powershell
$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"
py -m cohere sk a -a MsSonoma
```

### The 9-Feature Checklist (Before Every Session-Related Push)

Run through this mentally or by test:
- [ ] **Snapshot**: Does refreshing mid-lesson restore the exact position and all state?
- [ ] **Takeover**: Can a second device get a takeover prompt and resume where the first device was?
- [ ] **Persistent Sets**: Do the same questions appear after refresh and on a different device?
- [ ] **Timers**: Do timers continue from the correct elapsed time after refresh?
- [ ] **Play Dependent on Work**: Does missing a work timer deadline skip the next phase's play?
- [ ] **Timers Overlay**: Does adjusting timer from the overlay take effect immediately?
- [ ] **Learners List**: Do per-learner settings (timers, golden key, play portions) apply correctly?
- [ ] **Golden Key**: Is golden key eligibility tracking correctly across phases?
- [ ] **Transcripts**: Are conversation lines saved and available in the facilitator hub?

---

## Common Drift Patterns (Historical Failures)

These are the actual ways features have broken each other. Use these as anti-patterns.

| Pattern | What Broke | Root Cause |
|---------|-----------|-----------|
| Changing snapshot save timing | Takeover timer drift | Timer state not in snapshot at gate |
| Adding new snapshot field without restore | Feature broken after refresh | Restore code not updated to match |
| Changing sessionStorage key format | Timers reset on refresh | TimerService key and SessionTimer key out of sync |
| Live-updating learner settings without bus handler | Timers Overlay stale | `patchLearner` handler missing new column |
| Clearing assessments on session start | Persistent Sets broken | `clearAssessments()` called before `getStoredAssessments()` |
| Adding transcript lines to ledger on every save | Transcript duplication | Using `appendTranscriptSegment()` instead of `updateTranscriptLiveSegment()` |
| Polling for session ownership | Takeover performance | DO NOT add polling; gates only |
| Writing timer state to sessionStorage outside TimerService | Double-write race | Only TimerService owns timer sessionStorage keys |
