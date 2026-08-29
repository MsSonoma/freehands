# Mastery Evidence Foundation

## How It Works

The mastery evidence system creates a durable, additive evidence substrate and a deterministic facilitator reporting view. Stages 1-7 collect and qualify evidence. Stage 8 reads that evidence into educator-visible session history. It does not change learner instruction, phase progression, scoring, medals, transcripts, snapshots, prompts, or question selection.

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

Mr. Slate remains mastery, recovery, Daily/Weekly review, and retention authority. He is intentionally excluded from `instructional_teacher`, never starts or completes the Sonoma/Webb canonical instructional session, and cannot become a normal lesson teacher through learner preference or URL state.

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

Stage 3 adds stable identity infrastructure without changing learner behavior.

Session identity now includes:

- `identity_schema_version = mastery-identity-v1`
- `lesson_identity_version = lesson-identity-v1`
- `stable_lesson_key`, a canonical key beside the existing `lesson_key`
- deterministic `lesson_content_hash`
- deterministic UUID `lesson_version_id`
- `teaching_protocol_version = session-v2-conversational-v1`
- deterministic `teaching_protocol_hash`

Lesson content hashing is canonicalized from instructional content fields only. Runtime/session metadata, timestamps, analytics-only fields, user interface state, evidence state, transcripts, snapshots, scoring, and learner responses are excluded. Existing `lesson_key` remains available for backward-compatible source references and queries.

Event identity now preserves the Stage 2 legacy `item_id` / `legacy_item_fingerprint` and adds nullable Stage 3 fields beside it:

- `stable_item_id`
- `item_content_hash`
- `item_identity_version = item-identity-v1`
- source-backed `concept_id` when an explicit concept/objective/standard id exists on the source item

`stable_item_id` identifies the source/content item across repeated exposures. `item_exposure_id` remains the exposure-level identifier for a specific presentation occurrence. This distinction is required for later analysis but does not introduce mastery scoring or assessment isolation by itself.

Item content hashing excludes runtime exposure position, phase run, learner response, score, assistance state, and answer-attempt state. If the source item has an explicit id, the stable item id is anchored to that source id and the item content hash records content revisions. If the item has no explicit id, the stable item id falls back to lesson key plus item content hash.

Provenance currently captures the Sonoma provider/model selection, app build id when available, the Stage 3 teaching protocol version/hash when provided by the client, and the server fallback protocol values for older clients.

Stage 4 adds assessment-isolation infrastructure without changing learner behavior.

The isolation model uses two centralized item roles:

- `instructional`: Discussion, Exercise, Worksheet, and other learning-support exposures.
- `assessment_reserved`: source-backed Test items that are held out until the Test phase.

When the lesson source has a separable Test pool, Session V2 uses that pool for Test and sends a sanitized instructional lesson view to instructional AI endpoints. The sanitized view removes reserved assessment fields such as `test`, assessment pools, and answer-key fields before Discussion, Exercise, and Webb objective payloads are built. Ask remains context-only: before Test it receives the active instructional context, and during Test it may receive the active Test item because the item has already been presented. Visual-aid generation continues to use teaching notes/title/custom prompts rather than the full lesson object.

Stage 4 session metadata records:

- `assessment_isolation_version = assessment-isolation-v1`
- `assessment_isolation_status`: `isolated`, `not_isolated`, or `unavailable`
- `reserved_assessment_count`

Stage 4 event metadata records:

- `assessment_role`
- `pre_assessment_exposed`

`isolated` means a separable reserved Test pool exists and its Stage 3 stable/content item identities do not overlap the instructional phase sets for the session. `not_isolated` means deterministic identity overlap was found between instructional and reserved Test items. `unavailable` means the source does not expose a separable reserved Test pool, so the app preserves legacy behavior and does not falsely claim isolation.

This is not cryptographic secrecy. The full lesson may still exist in browser memory. The boundary is a runtime projection and evidence classification boundary for instructional AI payloads and source-backed Test item exposure.

Stage 5 adds baseline evidence architecture without adding mastery state.

Baseline answers one narrow question: what could the learner demonstrate before Ms. Sonoma taught this lesson? It runs as a short pre-instruction step before normal Socratic Discussion, not as a new major orchestrator phase or timeline lock. Eligible baseline items come only from an explicit source pool such as `baseline` / `baselinePool`; ordinary Discussion prompts are not reinterpreted as baseline.

Newly generated facilitator lessons request a small explicit `baseline` pool, normally two low-pressure items. Legacy lessons without that pool continue normally and record baseline as unavailable when evidence is enabled.

The baseline protocol is versioned as `baseline-v1`. Baseline eligibility requires deterministic non-overlap with instructional phase items and reserved Test items using Stage 3 stable/content identity. The prior-exposure check reads existing `item_presented` evidence for the same facilitator-owned learner and item identity; previously exposed baseline items are not treated as cold merely because Start Over or a new browser session reset local runtime state.

Baseline interaction is measurement only:

- present the item;
- allow verbatim repeat/TTS;
- accept one first response, including “I don’t know”;
- evaluate and record the evidence chain;
- acknowledge neutrally;
- move on or begin normal Discussion.

Baseline does not hint, reteach, reveal answers, retry, show a score, claim mastery, or create retention/proficiency state.

Stage 5 session metadata records:

- `baseline_protocol_version = baseline-v1`
- `baseline_status`: `complete`, `partial`, or `unavailable`
- `baseline_item_count`
- `baseline_unavailable_reason`

Stage 5 event metadata records:

- `evidence_purpose = baseline`

Baseline uses the existing item evidence primitives: `item_presented`, `learner_response`, and `answer_evaluated`, preserving stable item id, item content hash, exposure id, attempt number, first-response flag, result, and provenance.

Stage 6 adds independent mastery and recovery evidence without changing scores, medals, or reporting.

Stage 6 answers one narrow post-instruction question: can the learner demonstrate the target independently on a genuinely held-out reserved Test item? If the first clean held-out check fails, Stage 6 preserves that failure and can classify a later correct first response on a different clean held-out item as independent success after recovery. Same-item retries, hints, answer reveal, Ask assistance, generated visual assistance, prior exposure, baseline overlap, instructional exposure, or assessment-isolation failure prevent the item from being called independent evidence.

The Stage 6 protocol is versioned as `independent-mastery-v1`. It separates correctness from independence qualification:

- a correct answer after help is correct but not independent;
- a wrong first response on a clean held-out item is valid independent evidence and produces `needs_recovery`;
- a later correct retry on the same item is not independent mastery;
- a different clean held-out item may support `independent_success_after_recovery`.

Stage 6 adds append-only result events instead of mutating prior answer evidence. Result events use `mastery_check_result` and may carry:

- `mastery_protocol_version`
- `mastery_cycle_id`
- `mastery_check_id`
- `mastery_check_role`: `initial` or `recovery_verification`
- `independence_status`
- `independence_reason`
- `mastery_outcome`: `independent_success`, `needs_recovery`, `independent_success_after_recovery`, `assisted_success`, or `unavailable`

Recovery teaching must not receive future held-out verification items. The recovery payload helper includes the failed item, learner response, and correction context while using the instructional lesson projection so unused reserved Test items remain absent.

Known Stage 2 boundary: retry-attempt continuity is only as reliable as current phase state. Active-session attempts are recorded from the authoritative phase controller. If a refresh/takeover happens after a wrong answer where the current snapshot does not preserve retry counters or current-question position accurately, Stage 2 does not invent continuity.

Stage 7 adds delayed retention evidence without adding scheduling, reminders, reporting, or a new major lesson phase.

Stage 7 answers one narrow later-revisit question: after a meaningful delay, can the learner still demonstrate the target independently before Ms. Sonoma reviews or reteaches it? A retention check is eligible only when all of these are true:

- a prior Stage 6 `mastery_check_result` anchor has `mastery_outcome = independent_success` or `independent_success_after_recovery`;
- at least 24 hours have elapsed from that anchor event timestamp;
- the check happens in a later session, not the same session that produced the anchor;
- the anchor has not already been consumed by an earlier retention result;
- the selected item comes from an explicit dedicated retention pool;
- the selected item has deterministic identity and has not already been presented to the same learner;
- the item does not overlap baseline, instructional, or reserved Stage 6 Test items by stable/content identity;
- there is no app-observed same-target instructional exposure between the anchor and the retention check;
- the submitted answer is the first response and no hint, Ask, answer reveal, generated visual aid, or retry assistance occurred before it.

Repeat/TTS remains allowed because it repeats the prompt verbatim and does not add instructional content.

The Stage 7 protocol is versioned as `retention-v1`. It separates correctness from retention qualification:

- eligible and correct: `retained`;
- eligible and incorrect: `needs_review`;
- assisted and correct: `assisted_review`;
- otherwise: `unavailable`.

Stage 7 records append-only `retention_check_result` events. These may carry:

- `retention_protocol_version`
- `retention_check_id`
- `retention_anchor_mastery_check_id`
- `retention_delay_seconds`
- `retention_qualification_status`
- `retention_qualification_reason`
- `retention_outcome`

Legacy lessons without a retention pool continue normally and do not produce fake retention evidence. Evidence API failures or ineligible histories are nonblocking and fall through to the existing pre-instruction path.

Existing lessons with an explicit retention pool keep the `retention-v1` in-session path. New facilitator-generated lessons now reserve separate Daily Follow-Up and Weekly Review pools instead of adding new legacy-retention items. All three reserved roles participate in deterministic lesson identity and are excluded from instructional AI payloads, recovery payloads, visual-aid payloads, and Stage 6 Test item selection.

Stage 8 adds facilitator evidence reporting without adding a database table, cache, write path, scheduler, or learner-flow mutation.

The integration extends the existing learner transcript route into Learning History. The existing transcript list remains intact. When the mastery-evidence feature flag is enabled, the page also requests `/api/facilitator/learners/[id]/evidence` and shows compact chronological evidence cards. When reporting is disabled, the evidence section stays hidden and transcript history behaves as before. A reporting failure shows a calm local error and does not affect transcripts or learner sessions.

`src/app/lib/masteryEvidence/reporting.js` is the only interpretation layer. It deterministically derives a whitelisted `facilitator-evidence-v1` summary from a tracked `lesson_sessions` row, its authorized `learning_evidence_sessions` row, and append-only structured events. Browser components display the returned states; they do not reinterpret raw evidence or parse transcript prose.

Each session report separates:

- session and lesson identity;
- source-backed concept scope when exactly one `concept_id` is present, otherwise honest lesson or multi-concept scope;
- evidence completeness (`complete`, `partial`, or `unavailable`) separately from whether a particular measurement exists;
- baseline evidence;
- notable assistance/recovery, with Repeat/TTS retained as accessibility/control context rather than hint dependency;
- Stage 6 independent evidence;
- Stage 7 retention evidence with exact `retention_delay_seconds` and an educator-readable duration;
- legacy Test score, explicitly separate from independent evidence;
- facilitator timeline jumps and question refreshes as neutral context;
- inferred interpretations;
- rule-based, educator-controlled options;
- supporting facts and protocol/item provenance.

Baseline reporting uses Stage 5 session metadata and baseline `answer_evaluated` first-response chains:

- all intended first responses correct: `Prior knowledge observed`;
- one or more first responses not correct: `Not demonstrated before instruction`, with the exact observed count;
- missing or incomplete response chain: `Baseline incomplete`;
- legacy, contaminated, prior-exposed, ambiguous, or unavailable measurement: `Prior-knowledge evidence unavailable` with a bounded reason.

If baseline was not demonstrated and a later clean independent result succeeded, Stage 8 may infer that independent performance improved between the two measurements. If baseline was already demonstrated and the later check succeeded, Stage 8 says the learner demonstrated the target before instruction and again later. Neither case attributes learning causally to Ms. Sonoma.

Stage 6 reporting preserves outcome distinctions:

- `independent_success`: `Demonstrated independently`;
- `independent_success_after_recovery`: `Demonstrated independently after recovery`, with the initial unsuccessful check, recovery, and fresh verification kept visible;
- `assisted_success`: `Correct with assistance`, never independent evidence;
- `needs_recovery`: `Independent demonstration not yet established`, never permanent failure;
- `unavailable`: `Independent evidence unavailable`, never failure.

Stage 7 reporting preserves delayed-check meaning:

- `retained`: `Retained after <exact recorded interval>`;
- `needs_review`: `Review recommended after <interval>`, while the explicit prior Stage 6 anchor remains visible;
- `assisted_review`: `Retention not independently established`;
- no result under the known retention protocol: `Retention not yet measured`, with no invented schedule;
- `unavailable`: a bounded unavailable explanation, never failure.

The API is a narrow authenticated server read. It verifies the bearer token and learner ownership before any history query. It then queries tracked sessions only for that learner, re-applies `facilitator_id`, `learner_id`, tracked-session, and evidence-session boundaries to returned evidence rows, and returns derived summaries rather than raw database rows. Client-provided learner, session, lesson, and cursor filters cannot bypass ownership. The service role is used only after explicit authorization.

History is bounded to 10 sessions by default and 25 maximum. Keyset pagination orders by `started_at desc, id desc`; the next cursor contains only the final authorized tracked-session timestamp and id. Each page performs one tracked-session query, one evidence-session query, and one event query, avoiding browser raw-event reconstruction and N+1 per-session reads. Existing Stage 1, Stage 5, and Stage 7 indexes already support these access patterns, so Stage 8 requires no migration.

Unknown newer baseline, independent-mastery, or retention protocol versions use a safe fallback: evidence is acknowledged, detailed interpretation is unavailable, and completeness is partial. Protocol versions and item references remain in advanced details for auditability.

Stage 8 reporting vocabulary is deliberate:

- **Observed**: direct structured events or recorded result states.
- **Inferred**: deterministic comparisons such as baseline-to-later improvement or recovery before success.
- **Proposed**: optional next actions such as considering review.
- **Verified**: reserved; Stage 8 does not invent a general verified-mastery claim.

Claim boundaries are absolute. Stage 8 does not claim causal learning attribution, permanent mastery, guaranteed retention, human-vs-AI superiority, an invented mastery percentage, a global learner score, AI confidence, learner ranking, or diagnostic inference. Session completion, scores, medals, and transcripts remain separate from mastery-evidence qualification.

Daily Follow-Ups and Weekly Reviews extend the evidence system without changing the lesson lifecycle.

They are learner-facing cards in Learn, not lessons, assignments, notifications, or curriculum objects. They do not increment lesson quotas, reopen a completed lesson, create lesson snapshots, change scores/medals, or mutate the Stage 1-8 session evidence rows. Both are off by default and independently controlled per learner under the existing mastery-evidence feature flag.

The protocols and pools are deliberately separate:

- `daily-followup-v1` uses only `dailyFollowup` aliases and is anchored to one eligible Stage 6 success. Presentation must occur at least 24 hours after the anchor. An existing `retention-v1` result or Daily result consumes the anchor for another Daily opportunity. A clean correct first response records `retained`; a clean incorrect first response records `needs_review`. It does not trigger automatic reteaching.
- `weekly-review-v1` uses only `weeklyReview` aliases. It selects at most five distinct recent targets from the seven-local-day learning window ending at the configured weekday activation. The current weekly activation remains available until the next activation; missed weeks do not stack. Selection is deterministic and never pads with filler.
- Completing Daily never consumes Weekly. Weekly result facts record whether prior Daily retrieval was observed for the same Stage 6 anchor.
- Legacy `retention-v1`, Daily, and Weekly questions are mutually protected by stable/content identity. Reserved fields are stripped from instructional/recovery payloads. Prior learner exposure is checked during selection and again immediately before presentation.

The facilitator profile `timezone` is authoritative for weekly boundaries, with `UTC` as the safe fallback. Weekday activation is local midnight. Runs and selected items are durable in `learning_review_runs` and `learning_review_items`; append-only interactions/results are stored in `learning_review_events`. The service-role API is the only writer. `learning_review_items.item_payload` stores the reserved source item and may contain answer-bearing fields, so authenticated clients must not receive direct SELECT access to `learning_review_items`. Learner and facilitator browser flows read through authenticated server APIs that return sanitized current-item or derived reporting responses instead of raw review rows.

The first learner response is immutable through an idempotency key and database uniqueness. Resume uses the same run and selected item. Verbatim Repeat is recorded but remains non-disqualifying. Answer reveal is recorded before response and prevents an independent interpretation. Refresh, Start Over, and lesson-session state cannot reset a review run because review persistence is separate from snapshots and lesson local storage.

Stage 8 returns review summaries separately from session reports. Daily and Weekly labels, protocol versions, exact delay, qualification, outcome, earlier Stage 6 anchor, intervening instruction/review flags, and prior Daily context remain distinct from Test scores and legacy retention.

## What NOT To Do

- Do not use `lesson_session_events` as the mastery evidence store.
- Do not reinterpret Stage 1 lifecycle events or existing production proof rows.
- Do not create mastery percentages, independent mastery checks, concept state transitions, baseline results, or retention events in Stage 2.
- Do not treat Stage 3 identity fields as proof of mastery, independent measurement, or learner outcome improvement.
- Do not treat Stage 4 assessment isolation as baseline, mastery, retention, or outcome evidence.
- Do not treat Stage 5 baseline evidence as post-instruction mastery, retained knowledge, or outcome proof.
- Do not treat Stage 6 independent mastery results as retention, causal learning proof, a facilitator dashboard, or a rewrite of legacy scores/medals.
- Do not treat Stage 7 retention evidence as a scheduler, spaced-repetition system, causal proof, or general mastery percentage.
- Do not let a Stage 8 UI component reinterpret raw events; change the centralized reporting derivation and its deterministic tests.
- Do not expose raw evidence rows, provider/model fields, response text, answer keys, service metadata, or secrets through the facilitator reporting API.
- Do not call session completion, a Test score, a medal, an assisted answer, or missing evidence independent mastery.
- Do not turn Stage 8 interpretations or options into automatic lesson assignment, scheduling, curriculum mutation, notification, or learner-setting changes.
- Do not add causal attribution, permanent-mastery language, human-vs-AI claims, mastery percentages, rankings, confidence scores, or diagnostic labels to reports.
- Do not claim assessment secrecy for unsupported legacy lessons with no separable reserved Test pool.
- Do not change prompts, phase order, question selection, scoring, snapshots, transcripts, or completion behavior to serve evidence writes.
- Do not mutate existing evidence events. Corrections belong in later appended events.
- Do not infer evidence by parsing transcript prose after the fact; capture current behavior at runtime.
- Do not claim complete mastery, safety, comparative outcome, or audit guarantees from these Stage 1 tables.
- Do not enable evidence by default without an explicit environment flag.
- Do not treat Daily or Weekly cards as lessons, count them against lesson quotas, create snapshots for them, or auto-assign/reopen curriculum.
- Do not share a held-out item identity across baseline, instruction, Test, legacy retention, Daily, or Weekly roles.
- Do not let Daily completion consume Weekly eligibility or stack missed weekly cycles.

## Key Files

- `supabase/migrations/20260809000000_add_learning_evidence_foundation.sql`
- `supabase/migrations/20260809010000_add_stage_2_learning_evidence_events.sql`
- `supabase/migrations/20260809020000_add_stage_3_mastery_evidence_identity.sql`
- `supabase/migrations/20260809030000_add_stage_4_assessment_isolation.sql`
- `supabase/migrations/20260809040000_add_stage_5_baseline_evidence.sql`
- `supabase/migrations/20260809050000_add_stage_6_independent_mastery.sql`
- `supabase/migrations/20260809060000_add_stage_7_retention_evidence.sql`
- `supabase/migrations/20260812090000_add_daily_followups_weekly_reviews.sql`
- `src/app/api/evidence/route.js`
- `src/app/lib/masteryEvidence/constants.js`
- `src/app/lib/masteryEvidence/identity.js`
- `src/app/lib/masteryEvidence/assessmentIsolation.js`
- `src/app/lib/masteryEvidence/baseline.js`
- `src/app/lib/masteryEvidence/mastery.js`
- `src/app/lib/masteryEvidence/retention.js`
- `src/app/lib/masteryEvidence/reporting.js`
- `src/app/lib/masteryEvidence/followUps.js`
- `src/app/lib/masteryEvidence/followUps.server.js`
- `src/app/lib/masteryEvidence/followUps.service.js`
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
- `src/app/api/facilitator/learners/[id]/evidence/route.js`
- `src/app/api/learner/follow-ups/route.js`
- `src/app/api/learner/follow-ups/[runId]/route.js`
- `src/app/learn/follow-ups/[runId]/page.js`
- `src/app/api/facilitator/learners/[id]/transcripts/route.js`
- `src/app/facilitator/learners/[id]/transcripts/page.js`
- `src/app/facilitator/learners/[id]/transcripts/EvidenceHistorySection.jsx`
- `src/app/facilitator/learners/[id]/transcripts/evidenceHistory.module.css`
- `scripts/test-mastery-evidence.mjs`
- `scripts/test-stage3-identity.mjs`
- `scripts/test-stage4-assessment-isolation.mjs`
- `scripts/test-stage5-baseline.mjs`
- `scripts/test-stage6-independent-mastery.mjs`
- `scripts/test-stage7-retention.mjs`
- `scripts/test-stage8-facilitator-reporting.mjs`
- `scripts/test-follow-ups.mjs`
