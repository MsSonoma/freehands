# Session Takeover System

> **Multi-feature system.** Before editing takeover code, read [feature-edge-map.md](feature-edge-map.md). Takeover depends on session authority, Snapshot, Timers, and Transcripts remaining aligned across a device switch.

## Core Architecture

Protected lesson-session ownership is settled by the server-controlled transactional start path. Takeover detection on an already-active page uses Supabase Realtime when available, with a 15-second polling fallback.

There is no browser-side check-then-insert authority. A preliminary client-visible conflict can inform the dialog, but only the state inspected inside `public.start_lesson_session_transactional(...)` determines whether the protected start reuses, conflicts, starts, or takes over.

## Session Ownership Model

The product permits one active guided lesson workflow per learner.

- `browserSessionId` is a UUID generated for the browser tab and retained in `sessionStorage`.
- `lesson_sessions.session_id` records that browser identity on the active database row.
- A same-browser request for the same lesson reuses and touches the existing session.
- A different browser requesting the same lesson receives a conflict unless takeover was explicitly authorized for the exact conflicting `lesson_sessions.id`.
- Starting a different lesson ends the learner's prior active lesson sessions atomically. Moving from Lesson A to Lesson B is not a PIN takeover.

The retained partial unique index protects against multiple active rows for the same `(learner_id, lesson_id)`. The stronger one-active-workflow-per-learner product rule is enforced by the learner-serialized transactional RPC and the guarded active-insert path.

## Protected Start Authority

### Server route

Non-demo protected starts use `POST /api/syllabus/execution/start`. The route fails closed and requires:

1. An authenticated facilitator request context.
2. A learner owned by that facilitator.
3. A valid `browserSessionId` UUID.
4. An independently supplied canonical Syllabus occurrence ID.
5. A valid signed execution proof scoped to the facilitator, learner, lesson, and occurrence.
6. For takeover, a fresh Facilitator PIN and the exact expected conflicting session ID.

The page cannot authorize itself with cached facilitator state. The route validates the request and then calls the RPC through the server service-role client. It does not retain a JavaScript check-then-insert fallback.

The Facilitator PIN never enters PostgreSQL. The route verifies it before passing only the resulting `allowTakeover` decision and expected conflict identity to the RPC. Ms. Sonoma and other AI behavior have no session-authority role.

### Transactional RPC

`public.start_lesson_session_transactional(...)` performs the conflict decision and any mutation in one PostgreSQL transaction:

1. Reject a null browser session identity or blank lesson identity.
2. Lock the learner row with `FOR UPDATE`. This learner row is the serialization point for competing protected starts, including starts for different lessons.
3. Lock every active `lesson_sessions` row for the learner.
4. Inspect the active row for the requested lesson.
5. Reuse and touch it when the same browser owns it.
6. Return `conflict` without mutation when another browser owns it and takeover is not authorized.
7. Return a stale conflict without mutation when the expected conflict ID is missing, no longer active, or no longer identifies the observed same-lesson conflict.
8. For an authorized exact-match takeover, end prior active rows and insert the replacement atomically.
9. For a new lesson, end prior active learner sessions and insert the new session atomically without treating the move as a PIN takeover.

Ending prior sessions, recording restart/start events, and inserting the replacement are part of the same transaction. If insertion or event recording fails, PostgreSQL rolls back the earlier endings.

The RPC returns JSON containing the resulting state (`started`, `reused`, `conflict`, or `taken_over`), the created or reused session identity where applicable, conflict/takeover flags, and replacement/conflict details needed by the server and page.

### Database boundary

The migration `20260827174540_transactional_lesson_session_start.sql` establishes the current boundary:

- `EXECUTE` on the start RPC is revoked from `PUBLIC`, `anon`, and `authenticated`, then granted to `service_role`.
- Direct `INSERT` on `lesson_sessions` is revoked from `authenticated`.
- `guard_transactional_lesson_session_start` rejects an active row insert unless the transaction-local RPC marker is set.
- The RPC uses an explicit empty `search_path` and schema-qualified objects.

Authenticated browser code may read permitted session state and perform retained lifecycle operations, but it cannot directly create an active lesson-session row.

## Start and Takeover Flow

### Normal protected start

1. The page obtains and validates its scoped Syllabus execution authorization.
2. At Begin, before the learning orchestrator starts, the page calls the protected start route with its browser, lesson, learner, and canonical occurrence identities.
3. The route verifies facilitator authentication, ownership, proof scope, and request identities.
4. The transactional RPC returns `started`, `reused`, or `conflict`.
5. Missing identity, invalid proof, route failure, RPC failure, or an unrecognized result prevents lesson continuation.

### Same-lesson cross-device conflict

1. Device B requests the same lesson while Device A owns its active session.
2. The RPC returns the current conflict without mutation.
3. The page blocks continuation and presents the takeover dialog.
4. The facilitator supplies a fresh PIN.
5. The page refreshes its scoped Syllabus execution authorization and submits the PIN plus the exact observed conflicting session ID to the protected start route.
6. The route verifies the PIN and calls the RPC with `allowTakeover=true`.
7. The RPC takes over only if the currently locked same-lesson conflict still has that exact ID. Otherwise it returns a stale conflict without mutation.
8. After success, the taking-over page clears its stale local snapshot cache and reloads so the shared database snapshot is restored.

### Different-lesson transition

When the authorized learner starts Lesson B while Lesson A is active, the learner-serialized RPC ends the prior active workflow and starts Lesson B in the same transaction. This is a lesson transition, not a same-lesson cross-device takeover, so it does not require a takeover PIN.

## Active-Page Takeover Detection

After a protected session starts or is reused, the page starts two watchers for that session row:

- **Realtime is primary:** a Supabase Postgres Changes subscription listens for an update that sets the current row's `ended_at`.
- **Polling is fallback:** every 15 seconds, `checkSessionStatus` performs a read-only status query. This detects an ended session when Realtime is unavailable, disconnected, or delayed.

Both watchers stop after takeover is detected or session tracking is torn down. Realtime provides immediate takeover detection when available; it does not eliminate the polling fallback. The polling loop does not create, end, replace, or authorize sessions.

Snapshot/checkpoint writes are not the protected-start authority and cannot grant takeover.

## Snapshot, Timer, and Transcript Continuity

Session authority is settled before the learning orchestrator proceeds. On successful takeover, the new device reloads from the shared snapshot rather than trusting its own stale local cache.

Snapshots remain the cross-device source for instructional checkpoint state, transcript state, and timer state. A timer snapshot records its phase, mode, captured time, elapsed seconds, and target seconds. Restore adjusts elapsed time for the time since capture and preserves the live/expired countdown rules documented in [timer-system.md](timer-system.md).

This separation is intentional:

- The transactional start RPC owns active-session settlement.
- Realtime plus fallback polling detects that an already-open page lost ownership.
- Snapshot restore carries learning state to the authorized replacement device.
- Facilitator authorization remains in the server routes.

## Historical Trigger Model (Removed)

The former `auto_deactivate_old_lesson_sessions` trigger and `deactivate_old_lesson_sessions()` function automatically ended an active session during a later insert. That model could silently replace a session created after a browser-side conflict check.

Migration `20260827174540_transactional_lesson_session_start.sql` removes both historical objects. They are mentioned here only to identify the retired behavior; they do not enforce the current active-session invariant.

The current guard trigger does not perform automatic deactivation or takeover. It rejects unauthorized active inserts. All protected start/reuse/conflict/replacement decisions occur inside `public.start_lesson_session_transactional(...)`.

## What Not To Do

- Do not restore a browser-side read/check followed by direct insert or update as the start authority.
- Do not directly insert active `lesson_sessions` from authenticated browser code.
- Do not recreate automatic session replacement in an insert trigger.
- Do not treat a client-visible conflict as sufficient takeover authority.
- Do not allow a stale expected conflict ID to replace a newer session.
- Do not require a takeover PIN merely because the learner is moving to a different lesson.
- Do not send a raw Facilitator PIN to PostgreSQL or grant educational authorization inside the RPC.
- Do not describe Realtime as eliminating polling; the 15-second read-only polling fallback is intentional.
- Do not use polling, snapshot writes, or AI output to grant session authority.
- Do not store timer state independently of the shared snapshot model.

## Key Files

- `supabase/migrations/20260827174540_transactional_lesson_session_start.sql` - Transactional RPC, guarded active inserts, trigger removal, and grants.
- `src/app/api/syllabus/execution/start/route.js` - Authenticated, owned, proof-bound, fail-closed protected start route.
- `src/app/api/syllabus/execution/route.js` - Scoped Syllabus execution authorization.
- `src/app/lib/facilitatorPin.server.mjs` - Fresh server-side Facilitator PIN verification.
- `src/app/lib/sessionTracking.js` - Protected start client, lifecycle operations, and read-only status check.
- `src/app/hooks/useSessionTracking.js` - Session lifecycle plus Realtime and 15-second polling takeover detection.
- `src/app/session/v2/SessionPageV2.jsx` - Begin flow, conflict dialog, exact-ID takeover submission, watcher startup, and snapshot reload.
- `src/app/session/v2/protectedSessionBoundary.mjs` - Fail-closed continuation boundary.
- `src/app/session/v2/SnapshotService.jsx` - Shared lesson-state persistence and restore.
- `src/app/session/components/SessionTakeoverDialog.jsx` - Takeover UI.

## Acceptance Invariants

- One active guided lesson workflow is permitted per learner.
- Competing protected starts serialize on the learner row.
- Same-browser retries reuse/touch the requested active session.
- Same-lesson cross-device starts conflict without mutation unless fresh server authorization and the exact current conflict identity permit takeover.
- Stale takeover approval cannot replace a newer or disappeared conflict.
- Moving to another lesson atomically replaces prior learner sessions without being mislabeled as PIN takeover.
- Replacement failure preserves prior active sessions through transaction rollback.
- Protected creation requires browser and canonical occurrence identities plus a valid scoped execution proof.
- Authenticated clients cannot directly insert active session rows or execute the transactional RPC.
- Realtime is the immediate detection path when available; a 15-second read-only poll is the fallback.
- The removed automatic deactivation trigger has no current authority.
- The database receives no raw PIN and the AI controls no session authority.

## Future Enhancements (Out of Scope)

- Session history UI showing recent device switches.
- An explicitly designed idle-session policy with server-enforced semantics.
- Improved Realtime connection-health visibility while retaining fail-safe polling.
