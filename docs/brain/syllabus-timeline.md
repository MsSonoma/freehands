# Active Syllabus Lesson Timeline

## How It Works

`composeSyllabusLessonTimeline()` builds the lesson occurrences shown for an active learner Syllabus. It is a pure composition layer: it reads already-loaded revision, association, schedule, session, event, supplemental artifact metadata, and legacy availability data without writing storage or changing educational intent.

`loadSyllabusTimelineInputs()` is the shared server-side input boundary used by both `getActiveSyllabus()` and `resolveSyllabusExecution()`. It loads the same composition inputs for the read and execution paths, then may enrich already-legitimate generated lesson keys from facilitator-owned lesson storage before invoking the pure composer.

### Membership authority

A lesson enters the active Syllabus timeline only through a learner-specific learning relationship:

- `syllabus_lesson_associations` admits an unscheduled lesson for provisional weekly placement.
- A forecast item with `lesson_key` admits immutable Syllabus intent.
- An explicit `lesson_schedule` row admits scheduled intent.
- A tracked lesson session or terminal session event admits actual learner history.

Forecast items without a lesson artifact remain standalone Syllabus intentions. They are composed separately and do not depend on legacy availability.

### Instructional teacher authority

`syllabus_lesson_associations.instructional_teacher` is the facilitator-owned current assignment for a learner and lesson. Its only values are `sonoma` and `webb`; existing and new associations default to Sonoma. Association writes that omit the teacher update readiness and metadata without resetting an existing Webb assignment. Prepare is the editing surface for viewing, changing, and explicitly saving this assignment.

Current and future runnable association-backed items expose the assignment. A provisional forecast with no real association does not acquire teacher metadata merely from composition. Historical actuals instead use the immutable `lesson_sessions.instructional_teacher` recorded at protected start (or the canonical event source for pre-column history), so changing future intent never rewrites who conducted an earlier session.

### Availability is not membership

`learners.approved_lessons` is a legacy readiness/availability map. It does not admit a lesson to the active Syllabus timeline, create metadata, create inferred placement, or create an occurrence.

Approved lesson keys remain among canonical key-resolution candidates so defensible legacy shortened IDs and `facilitator/...` aliases can resolve to the same artifact identity. Resolution is not membership.

Only an entry whose value is exactly `true` is available. False, null, missing, string, and other non-true values do not upgrade readiness.

When a legitimate membership source has already created timeline metadata, a matching exact-true approved entry may monotonically upgrade that member to `available`. It cannot regress `in_progress` or `completed`, and it cannot manufacture placement.

### Metadata authority

Subject and title supplied by an association, forecast item, or schedule remain authoritative for that occurrence. Supplemental artifact metadata fills only missing metadata and cannot create membership, key authority, placement, intent, or inference.

The server enrichment layer resolves only generated keys already supported by an association, forecast, schedule, session, or session event. It deduplicates reads, skips keys with complete explicit metadata, uses bounded concurrency, and verifies facilitator ownership with `verifyFacilitatorLessonAccess({ requireApproved: false })`. Missing, unauthorized, or invalid artifacts fail soft to the composer's existing fallback. A uniquely supported historical shortened key may resolve; an ambiguous key is never guessed.

The pure composer does not load generated lesson JSON or infer generated subjects from filenames. `general` remains a valid educational subject when genuinely stored or when a legitimate member has no stronger metadata. The `generated` storage namespace is never displayed as an educational subject.

### Placement and history

- Explicit schedules and dated forecast items reserve capacity before provisional inference.
- Association-only members may receive deterministic weekly-pattern inference.
- Actual session evidence remains on its local-calendar activity date.
- Completed history does not create a new future obligation unless later explicit intent proves a deliberate repeat.
- Starting or completing a lesson upgrades readiness without erasing earlier occurrence history.
- Protected Sonoma and Webb sessions are the shared instructional history: their transactional completed event creates actual completion evidence independently of transcript storage or browser-local persona caches.
- Slate drill mastery is practice evidence and does not create an instructional session or completed Syllabus occurrence.
- Explicit lifecycle events outrank `ended_at`: `completed` is completed, while `incomplete`, `restarted`, and `exited` preserve a non-completed attempt as `incomplete`. Only historical ended sessions with no relevant lifecycle event use the legacy completion fallback.

### Instructional learning forecast

The active weekly pattern, not the model, owns next week's instructional slot count, dates, and subjects. `POST /api/syllabus/forecast` expands that pattern on the server, subtracts timeline slots already occupied by educator-authored or materialized intent, and asks the model only for a title and concise first-class description for each remaining slot. The bounded model context contains current Syllabus planning inputs plus whitelisted `facilitator-evidence-v1` summaries; it never contains browser history prose, transcript text, or raw evidence events.

The result is one inactive revision with `proposal_kind = learning_forecast`. Its deterministic `proposal_key` covers the active revision, target week, planning inputs, current intent, occupied timeline, and evidence summaries. Identical authoritative inputs reuse the current proposal before another model request. A learning forecast and a mastery reforecast are independent proposal kinds and may coexist. Only explicit facilitator adoption creates active intent.

Forecast descriptions live in `syllabus_forecast_items.description`; legacy rows may remain null. AI-proposed items retain `origin = learning_forecast` through adoption and later revision copying.

Learning-forecast acceptance creates a fresh immutable active revision with the facilitator-local acceptance date after verifying that the proposal is still canonical and still based on the exact active pointer. This permits a still-current forecast to be deliberately accepted several days after generation without relaxing the existing same-day mastery-reforecast rule.

Materialization addresses one exact `lineage_id`, never a title. If the occurrence is still proposed, `adoptLearningForecastLineage()` copies only that selected conceptual item into a fresh active revision; sibling AI items never become active through the one-lineage action. Before claiming a materialization receipt or invoking the generator, the server deterministically carries non-conflicting unaccepted siblings into a fresh inactive `learning_forecast` proposal based on that adopted active pointer. Generator or binding failure therefore leaves the remainder current and actionable. If lesson-key binding succeeds and advances the active pointer again, that current remainder proposal is deterministically rebased onto the final bound revision without a forecast-model call. The carry-forward proposal stores only the remaining AI concepts, preserves their exact lineages/titles/descriptions/subjects/dates/metadata, records root and immediate proposal provenance, and uses a deterministic `learning-forecast-rebase-v1` identity. A sibling whose date/sort slot is occupied by active intent is dropped. Whole-proposal adoption merges these delta proposals with their exact active base, so deliberate adoption of the displayed remainder preserves already accepted intent.

Carry-forward is intentionally a second repository operation: active educator intent commits first and is never rolled back if proposal persistence fails. The first post-adoption carry is a prerequisite for generation; if it fails, materialization reports the failure before receipt claim or quota-bearing generation. A refreshed read exposes no stale proposal, while the immutable source proposal plus deterministic identity permits an idempotent reconstruction against the adopted revision without generating the selected lesson. Materialization delegates full content generation to `POST /api/facilitator/lessons/generate`, which retains generator entitlement, quota, storage, canonical identity, and draft association authority. The owned learner's `learners.grade` is required before adoption or generation; missing grade fails closed without a fabricated fallback. The materialization receipt table preserves a successful artifact across a later binding failure so retry binds instead of generating again, then rebases the still-current remainder onto the bound revision. Forecasting, carry-forward, and materialization do not write `lesson_schedule`.

### No active Syllabus

The active composer is not a replacement for the no-active-Syllabus compatibility path. `resolveSyllabusReadModel()` still returns the legacy compatibility fallback with no fabricated canonical timeline when no active revision exists.

## What Not To Do

- Do not use `approved_lessons` as Syllabus membership or planning authority.
- Do not eagerly create metadata for every approved lesson key.
- Do not treat truthy non-boolean availability values as `available`.
- Do not hide incorrect membership by suppressing the General label in the UI.
- Do not guess a generated lesson's subject from its filename or weekly pattern.
- Do not live-read facilitator lesson storage from the pure composer; keep enrichment in the shared server input boundary.
- Do not let supplemental artifact metadata create membership or become canonical key-resolution authority.
- Do not display the `generated` storage namespace as an educational subject.
- Do not bulk-backfill historical approved lessons into Syllabus associations.
- Do not infer completion from transcript timestamps, farewell text, Webb localStorage, or Slate mastery.
- Do not infer instructional teacher authority from learner localStorage, URLs, or Slate mastery.
- Do not change weekly capacity, PIN gates, or execution authorization to repair composition.
- Do not remove approved lesson keys from canonical resolution without proving legacy alias safety.
- Do not change the no-active-Syllabus legacy compatibility behavior here.
- Do not make a normal Syllabus GET create forecasts; forecasting is an authenticated explicit POST.
- Do not let a model choose dates, subjects, capacity, lineages, permissions, readiness, or schedules.
- Do not materialize by title or append a second forecast occurrence for the generated artifact.
- Do not activate sibling forecast lineages when one proposed concept is selected for generation.
- Do not fabricate a learner grade when the canonical owned learner record has none.
- Do not treat `learning_forecast` as `mastery_reforecast` or turn Slate review/recovery options into ordinary instruction.

## Key Files

- `src/app/lib/syllabus/lessonTimeline.mjs` - Active timeline membership, metadata, readiness, history, and placement composition.
- `src/app/lib/syllabus/lessonTimelineInputs.server.mjs` - Shared read/execution input loading and fail-soft facilitator-artifact metadata enrichment.
- `src/app/lib/syllabus/revisions.server.mjs` - Loads legitimate membership/readiness inputs for the active read model.
- `src/app/lib/syllabus/learningForecast.mjs` - Pure slot expansion, bounded evidence projection, deterministic input identity, and proposal snapshot construction.
- `src/app/lib/syllabus/learningForecast.server.mjs` - Ownership, concurrency, reuse, model, and inactive-proposal orchestration.
- `src/app/lib/syllabus/materialization.server.mjs` - Exact-lineage generator delegation, durable retry receipt, and lesson-key binding.
- `supabase/migrations/20260831201314_add_learning_forecast_foundation.sql` - Description, proposal-kind generalization, proposal RPC, and server-only materialization receipts.
- `src/app/lib/syllabus/executionAuthorization.server.mjs` - Reuses the same composed membership for protected lesson execution decisions.
- `src/app/lib/syllabus/timeline.mjs` - Active versus no-active-Syllabus read-model boundary.
- `src/app/lib/syllabus/__tests__/lessonTimeline.test.mjs` - Membership, readiness, placement, history, metadata, and capacity regressions.
