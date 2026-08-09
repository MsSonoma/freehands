# Mastery Evidence Foundation

## How It Works

Stage 1 creates a durable, additive evidence substrate for future mastery reporting. It does not change learner instruction, phase progression, scoring, medals, transcripts, snapshots, prompts, question selection, or facilitator UI.

The system is disabled unless `NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED` or `MASTERY_EVIDENCE_ENABLED` is set to `true`, `1`, `yes`, or `on`.

When enabled, Session V2 creates evidence only after the existing `lesson_sessions` tracker successfully returns a session row id. That id is the anchor for `learning_evidence_sessions.session_id`.

Current Stage 1 event scope is intentionally narrow:

- `session_started`
- `phase_transition`
- `session_ended`

Evidence writes go through `/api/evidence`. The browser does not write directly to evidence tables. The route authenticates the bearer token, verifies learner ownership, verifies that the tracked `lesson_sessions` row exists for the learner, and writes through the service role.

`learning_evidence_sessions` stores identity, lesson references, provenance, and integrity status. `learning_evidence_events` is append-only and stores versioned event records with reserved future fields for concept, item, assistance, attempt, first-response, result, payload, and provenance.

Status semantics:

- `complete`: the writer confirmed the evidence session, Stage 1 attempted events, `session_ended`, and finalization.
- `partial`: an evidence session exists, but at least one attempted evidence write failed or finalization could not prove full integrity.
- `unavailable`: no usable evidence session was established, usually because the feature is disabled, auth is missing, tracking did not return a session id, or the API/database is unavailable.

Idempotency is keyed by schema version, tracked session id, event type, and event-specific suffix. Duplicate API inserts return the existing event instead of creating another row.

Provenance currently captures the Sonoma provider/model selection, app build id when available, `session-v2` teaching protocol version, optional teaching protocol hash, and a client-side lesson content hash when browser crypto can produce one.

## What NOT To Do

- Do not use `lesson_session_events` as the mastery evidence store.
- Do not instrument answers, hints, Ask, individual items, mastery scores, medals, assessment results, or learner UI actions in Stage 1.
- Do not change prompts, phase order, question selection, scoring, snapshots, transcripts, or completion behavior to serve evidence writes.
- Do not mutate existing evidence events. Corrections belong in later appended events.
- Do not claim complete mastery, safety, comparative outcome, or audit guarantees from these Stage 1 tables.
- Do not enable evidence by default without an explicit environment flag.

## Key Files

- `supabase/migrations/20260809000000_add_learning_evidence_foundation.sql`
- `src/app/api/evidence/route.js`
- `src/app/lib/masteryEvidence/constants.js`
- `src/app/lib/masteryEvidence/schema.js`
- `src/app/lib/masteryEvidence/provenance.js`
- `src/app/lib/masteryEvidence/client.js`
- `src/app/session/v2/SessionPageV2.jsx`
- `scripts/test-mastery-evidence.mjs`
