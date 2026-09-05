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

`syllabus_lesson_associations` remains learner-specific Syllabus membership and metadata when `inferred_placement_suppressed` is true. Literal boolean `true` suppresses only association-only provisional `inferred` or `needs_placement` synthesis; it does not remove the learner-to-lesson relationship or its readiness, subject, title, or instructional teacher. Explicit forecast, explicit schedule, actual, historical, and Slate authorities remain separate and continue to compose normally.

All intended suppression-clear lifecycle paths are implemented: Schedule, Reschedule, Prepare Save for later, and Materialization. Explicit Schedule and Reschedule persist the schedule first, preserve or upsert the learner association second, and clear suppression to `false` third; only then does the request report success. Prepare's Save for later sends only the allowlisted semantic action `action: 'save_for_later'`; the server preserves or upserts the association and then clears suppression. The generic association POST remains suppression-neutral, the narrow suppression setter remains server-owned, and raw client suppression writes are rejected.

Suppression does not clear for learner availability or Make available, Start now, Save draft and leave, instructional teacher changes, generic metadata or readiness preservation, or the generator association created before materialized forecast binding.

These clear lifecycles are multi-write and retry-convergent, not atomic or transactional. Explicit schedule or bound forecast authority remains visible independently if a later suppression clear fails, while Save for later depends on the clear to restore provisional inference visibility. A failed clear makes the request fail, and stale suppression must be repaired by retry because it could matter after explicit authority later disappears.

### Exact occurrence removal

Exact Syllabus occurrence removal is implemented and verified in source. It depends on `supabase/migrations/20260904212950_add_syllabus_inferred_placement_suppression.sql` for durable inference-suppression state. Source presence alone is not production proof: database migration history and the deployed application commit must be verified separately before exact-removal behavior is described as available in production.

The implementation distinguishes three identities: the lesson artifact, the learner assignment/availability relationship, and the Syllabus occurrence. Exact removal identifies the third as `learnerId + lessonKey + occurrenceId`, plus `expectedActiveRevisionId` only when replacement of the active revision is required. Dates are presentation and placement data, not occurrence identity. Occurrence authority is exact and namespaced:

- `syllabus:<forecast-row-id>` uses the exact forecast row ID as authority.
- `scheduled:<schedule-row-id>` uses the exact schedule row ID.
- `inferred:<association-id>` uses the association identity and the implemented canonical fallback rules; `needs_placement` uses that same inferred association identity.
- `actual` and `historical` records are protected and are not removable through this mutation.

Lineage fallback exists only for genuinely ID-less active-revision forecast rows and must resolve uniquely. A `lineage_id` is not assumed to be globally unique. Ambiguous identity fails closed.

Schedule/forecast reconciliation gives explicit schedule-to-forecast identities authority. When a schedule supplies explicit identities, it must match that exact forecast identity; a stale explicit identity cannot fall through to same-date or sole-candidate heuristics. Those heuristics remain available only when a schedule supplies no explicit identities. A successfully reconciled schedule receives `reconciled_forecast_id`. Removal of that reconciled occurrence removes the exact forecast row and the exact schedule row. Partial-failure retry converges on those identities without stealing a sibling forecast occurrence.

`syllabus_lesson_associations.inferred_placement_suppressed` controls association-only synthesis. When false, the association may synthesize an `inferred` or `needs_placement` placement if no stronger authority exists. When true, the association remains, but that synthesis is suppressed; explicit forecast, schedule, actual/history, and Slate authority remain separate. Removal sets suppression to true for an explicitly removed inferred or `needs_placement` occurrence, removal of the final ordinary explicit forecast/schedule occurrence for the lesson, and final reconciled removal. It does not suppress inference globally while explicit same-key siblings remain.

Verified re-entry restores suppression to false after explicit Schedule or Reschedule, Prepare Save for later, successful materialization after binding, and a reused materialization retry. Start now and Save draft and leave do not clear suppression.

For a final explicit occurrence, all safe read-only validation and snapshot construction precede mutation. Suppression is then set to true before destructive removal. A suppression failure therefore leaves explicit authority untouched and retryable; if suppression succeeds and a later step fails, surviving explicit authority remains visible and retryable. Final reconciled ordering is suppression, then revision activation that removes the forecast, then exact schedule deletion. There is no durable `lesson_schedule` removal receipt or archive, and revision provenance is not a machine-authority removal receipt.

`src/app/lib/syllabus/lessonOccurrenceRemoval.server.mjs` owns exact mutation semantics. Verified behavior includes canonical lesson-key and occurrence validation; active-Syllabus authority; already-started detection through a matching actual `source_occurrence_id`; rejection of actual, historical, and Slate placements; inferred/`needs_placement` suppression; exact forecast and schedule removal; reconciled forecast-plus-schedule removal; revision checks only when revision replacement is required; and fail-closed ambiguity with no silent broadening. A schedule-only removal may retry with a stale supplied expected revision because it performs no revision mutation. Its comprehensive service suite passes 38/38.

The authenticated `DELETE /api/syllabus/lesson-occurrences` boundary accepts only `learnerId`, `lessonKey`, `occurrenceId`, and `expectedActiveRevisionId`. It rejects alternate client occurrence authority and delegates removal meaning to the server service; browser code does not mutate the database directly. Its route suite passes 27/27.

`SyllabusDocument` passes exact occurrence authority into Prepare only from `item.occurrence_id` and the active revision `id`. Prepare carries them as ephemeral URL-scoped `syllabusOccurrenceId` and `syllabusExpectedActiveRevisionId`; neither is persisted in preparation snapshots or localStorage. The occurrence-context suite passes 11/11.

Prepare exposes two intentionally different actions. `Remove this occurrence from Syllabus` calls the exact DELETE route and preserves the lesson artifact, sibling occurrences, and learning history; `actual:` and `historical:` presentations are disabled/protected, while the server remains final authority on removability. `Remove lesson from learner` uses the existing lesson-availability broad-removal path with `available: false` for current/future learner-level removal, appears only when server current-binding truth confirms the lesson is bound, and preserves the artifact and historical evidence. The removal UI suite passes 4/4, and the broad learner-removal backend suite passes 7/7.

The lesson editor is grant-only for learner binding: an unbound learner receives `Grant Access` with `available: true`, while an already-bound learner sees the non-destructive `Already assigned` state. Broad learner removal no longer originates there. The separate artifact-level Delete Lesson behavior remains separate and unchanged.

### Instructional teacher authority

`syllabus_lesson_associations.instructional_teacher` is the facilitator-owned current assignment for a learner and lesson. Its only values are `sonoma` and `webb`; existing and new associations default to Sonoma. Association writes that omit the teacher update readiness and metadata without resetting an existing Webb assignment. Prepare is the editing surface for viewing, changing, and explicitly saving this assignment.

Mr. Slate remains supplemental to that teacher assignment. Every drillable lesson occurrence exposes learner-initiated `Practice with Mr. Slate`, including completed occurrences, without changing or repeating the instructional session. A facilitator may add an occurrence-bound row in `syllabus_slate_assignments`; composition renders it as a separate `slate_assignment` event immediately after its parent lesson. The event carries its own identity and a launch reference to the exact current parent representation, while the durable assignment retains the original Syllabus occurrence identity across instructional completion. Removing the supplemental event deletes only the assignment.

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
- Association-only members may receive deterministic weekly-pattern inference unless their association has literal boolean `inferred_placement_suppressed = true`.
- Actual session evidence remains on its local-calendar activity date.
- Completed history does not create a new future obligation unless later explicit intent proves a deliberate repeat.
- Starting or completing a lesson upgrades readiness without erasing earlier occurrence history.
- Protected Sonoma and Webb sessions are the shared instructional history: their transactional completed event creates actual completion evidence independently of transcript storage or browser-local persona caches.
- Slate drill mastery is practice evidence and does not create an instructional session or completed Syllabus occurrence.
- An assigned Slate event is visible intent, not proof that practice occurred. Completion and mastery still require canonical Slate evidence.
- Explicit lifecycle events outrank `ended_at`: `completed` is completed, while `incomplete`, `restarted`, and `exited` preserve a non-completed attempt as `incomplete`. Only historical ended sessions with no relevant lifecycle event use the legacy completion fallback.

### Occurrence-scoped Review History

The facilitator's `Review history` action is contextual to one composed occurrence. The unified Syllabus remains mounted while `LessonHistoryOverlay` opens above it, so closing returns to the same learner and selected week rather than navigating to the learner-wide transcript archive. The page owns the overlay alongside its planning editors, closes competing top-level workspaces before opening history, and invalidates history on learner changes. The overlay aborts superseded requests and checks learner, occurrence, and page identity before accepting a response.

`GET /api/facilitator/learners/[id]/lesson-history/[occurrenceId]` authenticates the facilitator, verifies learner ownership, loads the active revision through `loadSyllabusTimelineInputs()`, and recomposes the current legitimate timeline before accepting the occurrence. The result must contain exactly one requested `occurrence_id`, followed by exactly one canonical session for `actual:<lesson_sessions.id>` or append-only historical activity for `historical:<record-id>`. Lesson title, lesson key, subject, date, and newest-session heuristics are not occurrence authority.

Only after that proof may the server load deterministic reporting for the exact canonical session, occurrence-anchored Slate evidence, and Daily/Weekly review items linked through mastery-check anchors from the authorized evidence. Transcript storage paths are derived server-side and exposed only as short-lived signed URLs. Evidence and transcript absence degrade independently. This GET is observational and cannot mutate Syllabus, planning, forecast, scheduling, session, transcript, or mastery state.

Review History presents the authoritative `report.learning_summary` first under `What this tells us`: its headline and narrative, any unresolved `Still unknown` state, and any `What to consider next` planning meaning. Assistance counts are subordinate context and appear only when nonzero. If an older report lacks `learning_summary`, the overlay states neutrally that structured learning evidence is unavailable; it never promotes raw facets into a new conclusion. The collapsible Evidence details section retains the four authoritative facets for auditability.

Completed occurrence-bound Slate activity is rendered separately and uses each Slate report's own `learning_summary`. Assigned or scheduled Slate intent is not learning evidence and never appears as a completed Slate evidence card. Daily Follow-Up and Weekly Review reporting remain separate from both instructional and Slate summaries.

Standalone historical Slate-only rows remain visible as non-instructional activity where the timeline supports them, but expose no lesson actions and are rejected by the Review History detail boundary. They cannot become instructional history through a direct occurrence request.

### Instructional learning forecast

The active weekly pattern, not the model, owns next week's instructional slot count, dates, and subjects. `POST /api/syllabus/forecast` expands that pattern on the server, subtracts timeline slots already occupied by educator-authored or materialized intent, and asks the model only for a title and concise first-class description for each remaining slot. The bounded model context contains current Syllabus planning inputs plus whitelisted `facilitator-evidence-v1` summaries; it never contains browser history prose, transcript text, or raw evidence events.

The result is one inactive revision with `proposal_kind = learning_forecast`. Its deterministic `proposal_key` covers the active revision, target week, planning inputs, current intent, occupied timeline, and evidence summaries. Identical authoritative inputs reuse the current proposal before another model request. This evidence-informed learning forecast is the sole current instructional forecasting authority. Only explicit facilitator adoption creates active intent.

The former `mastery_reforecast` proposal authority is retired. Current reads do not load or expose inactive mastery proposals, no route or repository service can create one, and generic proposal activation accepts only `learning_forecast`. Historical database functions and constraints remain inert in immutable migrations. Schema and timeline presentation may still recognize already-activated `mastery_reforecast` items so a restored historical Syllabus remains readable, but browser-authored snapshots cannot introduce that legacy origin.

Forecast descriptions live in `syllabus_forecast_items.description`; legacy rows may remain null. AI-proposed items retain `origin = learning_forecast` through adoption and later revision copying.

Learning-forecast acceptance creates a fresh immutable active revision with the facilitator-local acceptance date after verifying that the proposal is still canonical and still based on the exact active pointer. This permits a still-current forecast to be deliberately accepted several days after generation.

Materialization addresses one exact `lineage_id`, never a title. If the occurrence is still proposed, `adoptLearningForecastLineage()` copies only that selected conceptual item into a fresh active revision; sibling AI items never become active through the one-lineage action. Before claiming a materialization receipt or invoking the generator, the server deterministically carries non-conflicting unaccepted siblings into a fresh inactive `learning_forecast` proposal based on that adopted active pointer. Generator or binding failure therefore leaves the remainder current and actionable. If lesson-key binding succeeds and advances the active pointer again, that current remainder proposal is deterministically rebased onto the final bound revision without a forecast-model call. The carry-forward proposal stores only the remaining AI concepts, preserves their exact lineages/titles/descriptions/subjects/dates/metadata, records root and immediate proposal provenance, and uses a deterministic `learning-forecast-rebase-v1` identity. A sibling whose date/sort slot is occupied by active intent is dropped. Whole-proposal adoption merges these delta proposals with their exact active base, so deliberate adoption of the displayed remainder preserves already accepted intent.

Carry-forward is intentionally a second repository operation: active educator intent commits first and is never rolled back if proposal persistence fails. The first post-adoption carry is a prerequisite for generation; if it fails, materialization reports the failure before receipt claim or quota-bearing generation. A refreshed read exposes no stale proposal, while the immutable source proposal plus deterministic identity permits an idempotent reconstruction against the adopted revision without generating the selected lesson. Materialization delegates full content generation to `POST /api/facilitator/lessons/generate`, which retains generator entitlement, quota, storage, canonical identity, and draft association authority. The owned learner's `learners.grade` is required before adoption or generation; missing grade fails closed without a fabricated fallback.

The service-role receipt UUID is also the trusted generator operation identity. Before the model call, it determines one exact facilitator-owned Storage path and generated lesson key. The artifact embeds the server-verified receipt, Syllabus, lineage, input hash, facilitator, and learner identities. A retry of a `generating` receipt is recovery-only: it may load and validate that exact artifact, associate it, atomically charge finite quota at most once while finalizing the receipt, and continue exact-lineage binding without a model call. It never scans Storage, matches titles, or regenerates by age. If the exact artifact is absent or mismatched, the receipt enters `recovery_required`; ordinary generation is disabled and the authorized response exposes only non-secret operation and lineage IDs for reconciliation. A successful binding retry rebases the still-current sibling remainder onto the bound revision. Forecasting, carry-forward, and materialization do not write `lesson_schedule`.

Materialization clears inference suppression only after successful exact forecast binding establishes placement authority and the materialization receipt is successfully recorded with `status: 'bound'`. The generator association created during artifact generation or recovery does not clear suppression. After the bound receipt is durable, materialization clears the learner association's suppression to `false` before carry-forward and success. An already-bound reused materialization, identified by its existing `item.lesson_key`, retries the clear before returning `reused: true`, providing convergence when an earlier attempt bound successfully but suppression clearing failed.

`LESSON_ASSOCIATION_NOT_FOUND` is a materialization-local no-op because no association means there is no suppression state to clear; the general setter continues to fail for a missing association outside this handling. Every other suppression-clear failure propagates and fails the request. Because binding and clearing are separate writes, such a failure does not roll back the already-bound forecast or relabel its successfully bound receipt as `binding_failed`; retry enters the already-bound `lesson_key` path and attempts the clear again.

### Unified facilitator planning surface

The facilitator Syllabus is the primary interaction surface for Goals, Subjects, Weekly Pattern, Teaching Guidance, future lesson concepts, and explicit multiweek planning. These controls do not introduce a second planning record: saves create complete immutable Syllabus revisions through the same activation transaction and exact expected-active pointer check. Subject and weekly-pattern edits reuse canonical snapshot validation and capacity enforcement; historical occurrences remain derived from their existing session/event authority.

The normal facilitator document presents exactly one selected week. The current inactive `learning_forecast` is projected only into its exact automatic next-week target as a presentation layer: each suggestion keeps its proposal revision and lineage identity, appears in its canonical day/slot order, and remains visibly suggested until the facilitator uses the existing adoption or exact-lineage materialization action. Loading, no-action, failure, and retry states stay inside that target week. Proposal rows never enter `timeline_items`, canonical membership, or active intent merely because they are rendered. The active path has no detached forecast panel.

The facilitator sees one forecast workflow. There is no separate mastery-evidence check, mastery proposal state, annotation layer, or activation control. Mastery-specific practice, recovery, review, follow-up, and retention remain supplemental Mr. Slate work and are never converted into ordinary instructional forecast items.

When the facilitator navigates to the next instructional week, the client performs one explicit `POST /api/syllabus/forecast` check for the learner, active revision, and target week. Response acceptance additionally requires the same selected week and request sequence, so a late success or error for week A cannot alter week B. Same-view overlay rerenders do not change that identity. The normal Syllabus GET remains read-only. The server remains the idempotency authority and either reuses the deterministic proposal, returns no action, or produces a replacement proposal from changed authoritative inputs. Inactive proposal controls are facilitator-only.

`SyllabusDocument` does not infer host authority. Production callers explicitly grant action capabilities: the dedicated facilitator Syllabus grants Review History and lesson workflows, the learner grants only its existing lesson-open behavior, and the facilitator-home preview grants neither. The preview retains its existing route to the dedicated Syllabus and cannot display handlerless buttons. The development QA harness grants only its deterministic fixture handlers.

`POST /api/syllabus/planning` owns bounded planning mutations. Create Your Own validates an exact future weekly-pattern slot, creates a stable lineage with `origin = facilitator` and `lesson_key = null`, and activates that educational intent without creating an artifact or schedule. Editing preserves the exact lineage and records facilitator provenance. Editing an AI forecast activates the selected modified lineage as educator intent and deterministically carries eligible siblings. Replace regenerates only title and description for the exact inactive proposal lineage while preserving date, subject, sort slot, and lineage.

Plan Ahead is an inline Syllabus mode, not a modal or separate application. It is a 1-4 week projection of the active Weekly Pattern plus canonical forecast items, and returning from it restores the ordinary selected-week view. It is not persisted as a separate plan. Farther-out AI suggestions are explicit, transient facilitator requests and carry a prompt boundary that forbids assumed future completion or mastery; they become canonical only when saved as facilitator intent. Materialized items cannot be edited or removed through planning controls. Full lesson generation continues through exact-lineage materialization and never schedules automatically.

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
- Do not store Mr. Slate in `instructional_teacher`, hide an assignment as a lesson badge, or let an assigned event consume weekly instructional capacity.
- Do not change weekly capacity, PIN gates, or execution authorization to repair composition.
- Do not remove approved lesson keys from canonical resolution without proving legacy alias safety.
- Do not change the no-active-Syllabus legacy compatibility behavior here.
- Do not treat inference suppression as association removal or as authority to hide explicit forecast, schedule, actual, historical, or Slate representations.
- Do not clear inference suppression at generator-association time; materialization clearing belongs after exact forecast binding and a durable bound receipt.
- Do not turn the verified local exact-occurrence implementation into a production claim until its code is committed and deployed and the suppression migration is applied.
- Do not broaden occurrence removal by date, title, lesson key alone, globally assumed lineage uniqueness, or fallback heuristics after a stale explicit reconciliation identity.
- Do not describe revision provenance as a removal receipt; no durable `lesson_schedule` removal receipt or archive exists.
- Do not replace contextual Review History with learner-wide transcript navigation.
- Do not resolve repeated occurrence history by lesson key, title, subject, date, or latest session.
- Do not make a normal Syllabus GET create forecasts; forecasting is an authenticated explicit POST.
- Do not let a model choose dates, subjects, capacity, lineages, permissions, readiness, or schedules.
- Do not materialize by title or append a second forecast occurrence for the generated artifact.
- Do not activate sibling forecast lineages when one proposed concept is selected for generation.
- Do not fabricate a learner grade when the canonical owned learner record has none.
- Do not treat `learning_forecast` as `mastery_reforecast` or turn Slate review/recovery options into ordinary instruction.
- Do not restore a route, repository writer, read-model field, UI control, or generic activation path for current `mastery_reforecast` proposals.

## Key Files

- `src/app/lib/syllabus/lessonTimeline.mjs` - Active timeline membership, metadata, readiness, history, and placement composition.
- `src/app/lib/syllabus/lessonAssociations.server.mjs` - Exact learner-association writes, including the narrow inference-suppression setter.
- `supabase/migrations/20260904212950_add_syllabus_inferred_placement_suppression.sql` - Migration for durable association-only provisional inference-suppression state; production application must be verified from database migration history.
- `src/app/lib/syllabus/__tests__/lessonInferenceSuppression.test.mjs` - Focused suppression, explicit-authority, helper, and migration regressions.
- `src/app/lib/syllabus/lessonOccurrenceRemoval.server.mjs` - Verified server authority for exact occurrence removal and retry convergence.
- `src/app/api/syllabus/lesson-occurrences/route.js` - Authenticated allowlisted exact-occurrence deletion boundary.
- `src/app/components/syllabus/SyllabusDocument.js` - Exact occurrence and active-revision context propagation into Prepare.
- `src/app/facilitator/prepare/page.js` - Ephemeral occurrence context and separate exact versus broad learner-removal actions.
- `src/app/facilitator/lessons/edit/page.js` - Grant-only learner assignment state; artifact deletion remains separate.
- `src/app/lib/syllabus/__tests__/lessonOccurrenceRemoval.test.mjs` - Exact-removal service coverage.
- `src/app/lib/syllabus/__tests__/lessonOccurrenceRemovalRoute.test.mjs` - Authenticated route-boundary coverage.
- `src/app/lib/syllabus/__tests__/lessonOccurrencePrepareContext.test.mjs` - Ephemeral exact-context propagation coverage.
- `src/app/lib/syllabus/__tests__/lessonRemovalUi.test.mjs` - Exact versus broad removal UI coverage.
- `src/app/api/syllabus/slate-assignments/route.js` - Facilitator-owned occurrence-exact add/remove boundary for supplemental Slate events.
- `supabase/migrations/20260902161410_add_syllabus_slate_assignments.sql` - Durable occurrence-bound Slate assignment storage and grants.
- `src/app/lib/syllabus/lessonTimelineInputs.server.mjs` - Shared read/execution input loading and fail-soft facilitator-artifact metadata enrichment.
- `src/app/lib/syllabus/revisions.server.mjs` - Loads legitimate membership/readiness inputs for the active read model.
- `src/app/lib/syllabus/learningForecast.mjs` - Pure slot expansion, bounded evidence projection, deterministic input identity, and proposal snapshot construction.
- `src/app/lib/syllabus/evidenceProjection.mjs` - Browser-safe shared whitelist from authoritative facilitator reports into forecast context.
- `src/app/lib/syllabus/learningForecast.server.mjs` - Ownership, concurrency, reuse, model, and inactive-proposal orchestration.
- `src/app/lib/syllabus/materialization.server.mjs` - Exact-lineage generator delegation, durable retry receipt, and lesson-key binding.
- `src/app/lib/syllabus/materializationGenerator.server.mjs` - Deterministic exact-artifact generation and recovery core.
- `src/app/lib/syllabus/planning.mjs` - Pure 1-4 week canonical slot projection.
- `src/app/lib/syllabus/planning.server.mjs` - Exact-slot facilitator planning, forecast edit/replace, and transient suggestion authority.
- `src/app/api/syllabus/planning/route.js` - Authenticated, entitled planning mutation boundary.
- `src/app/components/syllabus/SyllabusPlanningWorkspace.js` - Facilitator Plan Ahead document workspace.
- `supabase/migrations/20260831201314_add_learning_forecast_foundation.sql` - Description, proposal-kind generalization, proposal RPC, and server-only materialization receipts.
- `supabase/migrations/20260901160538_add_materialization_generation_recovery.sql` - Recovery receipt fields/state and service-role atomic artifact/quota finalization.
- `src/app/lib/syllabus/executionAuthorization.server.mjs` - Reuses the same composed membership for protected lesson execution decisions.
- `src/app/lib/syllabus/timeline.mjs` - Active versus no-active-Syllabus read-model boundary.
- `src/app/lib/syllabus/__tests__/lessonTimeline.test.mjs` - Membership, readiness, placement, history, metadata, and capacity regressions.
- `src/app/lib/syllabus/occurrenceHistory.server.mjs` - Authorized exact-occurrence history read model with isolated evidence and transcript resolution.
- `src/app/components/syllabus/LessonHistoryOverlay.js` - In-place, abortable, focus-contained facilitator Review History.
- `src/app/lib/syllabus/__tests__/occurrenceHistory.test.mjs` - Repeat isolation, ownership, evidence anchors, partial data, instructor, legacy, future-intent, and UI race regressions.
