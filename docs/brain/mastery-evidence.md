# Mastery Evidence Foundation

## How It Works

The mastery evidence system creates a durable, additive evidence substrate for future mastery reporting. It does not change learner instruction, phase progression, scoring, medals, transcripts, snapshots, prompts, question selection, or facilitator UI.

The system is disabled unless `NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED` or `MASTERY_EVIDENCE_ENABLED` is set to `true`, `1`, `yes`, or `on`.

When enabled, Session V2 creates evidence only after the existing `lesson_sessions` tracker successfully returns a session row id. That id is the anchor for `learning_evidence_sessions.session_id`.

Stage 1 lifecycle events remain:

- `session_started`
- `phase_transition`
- `session_ended`

Stage 2 records current learning behavior without changing it. Current Stage 2 event vocabulary is:

- `item_presented`
- `learner_response`
- `answer_evaluated`
- `hint_given`
- `retry_requested`
- `answer_revealed`
- `ask_used`
- `repeat_used`
- `visual_aid_used`
- `question_set_refreshed`
- `timeline_jump`

Evidence writes go through `/api/evidence`. The browser does not write directly to evidence tables. The route authenticates the bearer token, verifies learner ownership, verifies that the tracked `lesson_sessions` row exists for the learner, and writes through the service role.

`learning_evidence_sessions` stores identity, lesson references, provenance, and integrity status. `learning_evidence_events` is append-only and stores versioned event records with lifecycle fields plus Stage 2 fields for event sequence, item, exposure, assistance, attempt, first-response, result, payload, and provenance.

Stage 2 item identity is deliberately not the final Stage 3 concept/item model. It uses `legacy_item_fingerprint`, a deterministic hash derived from current lesson/item fields: lesson key or lesson id, phase, source id/type, question index, normalized prompt, options, answer, and accepted-answer list. The fingerprint is for within-current-architecture correlation only and does not mutate lesson JSON.

Stage 2 exposure identity uses `item_exposure_id` to identify an occurrence of an item being shown in a session. Session V2 derives it from phase run, question index, and the legacy fingerprint. Browser refreshes reuse the same semantic exposure; timeline jumps increment the phase run so a fresh presentation is distinguishable.

Stage 2 answer chains record:

- `learner_response` for the accepted learner answer text.
- `answer_evaluated` for the current app judgment.
- `attempt_number` and `is_first_response` on response/evaluation events.
- Atomic assistance events (`hint_given`, `retry_requested`, `answer_revealed`) rather than a mutable mastery summary.

Ask is recorded only after submission. Freeform Ask uses `ask_mode = freeform`. The "What's the answer?" shortcut uses `ask_mode = current_answer_request` and also appends an `answer_revealed` evidence event linked to the active item when available.

Visual aids are recorded when the visual-aid carousel actually presents or explains an aid. Repeat is recorded only for intentional learner/facilitator repeat controls, not technical TTS recovery. Question-set refresh and timeline jumps are recorded only after their existing PIN gates succeed.

Status semantics:

- `complete`: the writer confirmed the evidence session, Stage 1 attempted events, `session_ended`, and finalization.
- `partial`: an evidence session exists, but at least one attempted evidence write failed or finalization could not prove full integrity.
- `unavailable`: no usable evidence session was established, usually because the feature is disabled, auth is missing, tracking did not return a session id, or the API/database is unavailable.

Idempotency is keyed by schema version, tracked session id, event type, and event-specific suffix. Duplicate API inserts return the existing event instead of creating another row.

Stage 2 adds `event_sequence`, a client-assigned monotonic sequence for attempted evidence events in the active browser writer. It is nullable so existing Stage 1 rows remain valid.

Provenance currently captures the Sonoma provider/model selection, app build id when available, `session-v2` teaching protocol version, optional teaching protocol hash, and a client-side lesson content hash when browser crypto can produce one.

Known Stage 2 boundary: retry-attempt continuity is only as reliable as current phase state. Active-session attempts are recorded from the authoritative phase controller. If a refresh/takeover happens after a wrong answer where the current snapshot does not preserve retry counters or current-question position accurately, Stage 2 does not invent continuity.

## What NOT To Do

- Do not use `lesson_session_events` as the mastery evidence store.
- Do not reinterpret Stage 1 lifecycle events or existing production proof rows.
- Do not create mastery percentages, independent mastery checks, concept state transitions, baseline results, or retention events in Stage 2.
- Do not change prompts, phase order, question selection, scoring, snapshots, transcripts, or completion behavior to serve evidence writes.
- Do not mutate existing evidence events. Corrections belong in later appended events.
- Do not infer evidence by parsing transcript prose after the fact; capture current behavior at runtime.
- Do not claim complete mastery, safety, comparative outcome, or audit guarantees from these Stage 1 tables.
- Do not enable evidence by default without an explicit environment flag.

## Key Files

- `supabase/migrations/20260809000000_add_learning_evidence_foundation.sql`
- `supabase/migrations/20260809010000_add_stage_2_learning_evidence_events.sql`
- `src/app/api/evidence/route.js`
- `src/app/lib/masteryEvidence/constants.js`
- `src/app/lib/masteryEvidence/schema.js`
- `src/app/lib/masteryEvidence/provenance.js`
- `src/app/lib/masteryEvidence/client.js`
- `src/app/lib/masteryEvidence/items.js`
- `src/app/session/v2/SessionPageV2.jsx`
- `src/app/session/v2/ComprehensionPhase.jsx`
- `src/app/session/v2/ExerciseConversationPhase.jsx`
- `src/app/session/v2/WorksheetPhase.jsx`
- `src/app/session/v2/TestPhase.jsx`
- `src/app/session/components/SessionVisualAidsCarousel.js`
- `scripts/test-mastery-evidence.mjs`
