# Persistent Sets System

**Feature:** Same question arrays (comprehension, exercise, worksheet, test) are shown after page refresh AND on any other device — the random draw is locked in once and shared.

**Related Brain Files:**
- **[feature-edge-map.md](feature-edge-map.md)** — Full dependency graph for all 9 session features
- **[snapshot-persistence.md](snapshot-persistence.md)** — Snapshot stores question INDEX, not question arrays
- **[session-takeover.md](session-takeover.md)** — Second device receives same persistent sets via DB

---

## Core Architecture

**Two-Tier Persistence (Local + Remote)**

| Tier | Key | Schema |
|------|-----|--------|
| localStorage | `lesson_assessments:{lessonId}` | `{ worksheet: [], test: [], comprehension: [], exercise: [], savedAt: ISO }` |
| Supabase `learner_assessments` | `(user_id, learner_id, lesson_key)` | Column: `data` (JSONB), same schema |

Remote is the **cross-device source of truth**. Local is the **fast cache**.

---

## Key Files

- `src/app/session/assessment/assessmentStore.js` — Core persistence API
- `src/app/api/assessments/route.js` — Backend handler (GET/POST/DELETE)
- `src/app/session/v2/SessionPageV2.jsx` — Load on mount, generate-and-save on first visit

---

## How It Works

### First Device (No Existing Sets)
1. Session page mounts, calls `getStoredAssessments(lessonKey, { learnerId })`
2. Remote returns 404/null → no stored sets
3. Generate all 4 arrays via `buildAllPhaseSets()` immediately
4. Call `saveAssessments()` — writes to localStorage AND best-effort remote POST
5. Cache in `buildAllPhaseSetsCache.current` for the rest of the session
6. Any second device that joins after this point gets the remote copy

### Second Device / Page Refresh
1. `getStoredAssessments()` tries remote first → HIT
2. Load stored arrays, seed `buildAllPhaseSetsCache.current`
3. No regeneration — same random draw for all phases

### Clearing
- `clearAssessments(lessonKey, { learnerId })` — called ONLY when:
  - Learner explicitly clicks "Start Over" / "Refresh"
  - Lesson completes (`sessionComplete` event)
- Clears localStorage AND remote row

---

## DO NOT BREAK

1. **Persist before phase starts**: `saveAssessments()` must be called BEFORE any phase uses the sets. If device 2 arrives while phase 1 is in progress, it must find existing sets in the remote DB.

2. **80/20 blend invariant**: Question arrays use `maxSecondary = Math.max(0, Math.round(totalNeeded * 0.2))` — approximately 80% MC+TF, 20% SA+FIB. Do not change this without testing PDF generation.

3. **Remote first, local fallback**: `getStoredAssessments()` ALWAYS tries remote before localStorage. Never swap this order or cross-device persistence breaks.

4. **Assessment arrays ≠ snapshot**: The `snapshots` table stores the current question INDEX (which question learner is on). The `learner_assessments` table stores the question arrays themselves. These are separate systems. Do not merge them.

5. **Stable dedup key**: `question_key = lowercase(prompt || question || Q || q).trim()` — deduplicate on this key. Changing the dedup key causes regeneration on refresh.

6. **buildAllPhaseSetsCache**: If this cache is cleared or bypassed mid-session, phase transitions will regenerate different questions. Only clear it when `clearAssessments()` is called.

---

## What Breaks Persistent Sets

- Calling `clearAssessments()` on session start (clears before load)
- Using `appendTranscriptSegment()` instead of the assessments API for question saves
- Changing `lessonKey` derivation (key mismatch between save and load)
- Snapshot restore overwriting cached sets (snapshot has indices, not arrays)
