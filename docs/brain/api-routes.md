# API Routes

## `/api/sonoma` - Core Ms. Sonoma Endpoint

### Request Format

**Method**: POST  
**Content-Type**: application/json

```json
{
  "instruction": "<string>",
  "innertext": "<string>",
  "skipAudio": true
}
```

**Fields**:
- `instruction`: The per-turn instruction string (server hardens it for safety).
- `innertext`: Optional learner input for this turn.
- `skipAudio`: Optional boolean; when `true`, the API will skip Google TTS and return `audio: null`.

**Why `skipAudio` exists**:
- Some callers (especially teaching definitions/examples generation) need text only.
- Returning base64 audio for large responses can be slow on mobile devices.

### Response Format

```json
{
  "reply": "<string>",
  "audio": "<base64 mp3>" 
}
```

**Fields**:
- `reply`: Ms. Sonoma response text from the configured LLM provider.
- `audio`: Base64-encoded MP3 when TTS is enabled and available; `null` when `skipAudio=true` (or when TTS is not configured).

### Implementation

- **Location**: `src/app/api/sonoma/route.js`
- **Providers**: OpenAI or Anthropic depending on env configuration
- **Runtime**: Node.js (Google SDKs require Node, not Edge)
- **Stateless**: Each call is independent; no DB writes from this endpoint

### Health Check

**Method**: GET

Returns `200` with `{ ok: true, route: 'sonoma', runtime }`.

### Logging Controls

Log truncation is controlled via environment variable `SONOMA_LOG_PREVIEW_MAX`:

- `full`, `off`, `none`, or `0` — No truncation
- Positive integer (e.g., `2000`) — Truncate after N characters
- Default: Unlimited in development; 600 chars in production

---

## Other Core Routes

### `/api/counselor`
**Purpose**: Mr. Mentor counselor chat endpoint (facilitator-facing)  
**Status**: Operational

- **Location**: `src/app/api/counselor/route.js`
- **Behavior**: LLM-driven counselor responses with function calling tools for lesson operations
- **Key tools**: `search_lessons`, `get_lesson_details`, `generate_lesson` (confirmation-gated), `schedule_lesson`, `assign_lesson`, `edit_lesson`, conversation memory tools

### `/api/lesson-schedule`
**Purpose**: Create/read/delete calendar entries for learner lessons  
**Status**: Operational

- **Location**: `src/app/api/lesson-schedule/route.js`

### `/api/lesson-assign`
**Purpose**: Assign/unassign lessons to a learner (availability via `learners.approved_lessons`)  
**Status**: Operational

- **Location**: `src/app/api/lesson-assign/route.js`
- **Method**: POST
- **Auth**: Bearer token required; learner ownership verified server-side
- **Body**: `{ learnerId, lessonKey, assigned }`

### `/api/generate-lesson-outline`
**Purpose**: Generate a lightweight lesson outline (title + description) for planning/redo  
**Status**: Operational

- **Location**: `src/app/api/generate-lesson-outline/route.js`
- **Method**: POST
- **Auth**: Bearer token required
- **Body**: `{ subject, grade, difficulty, learnerId?, context?, promptUpdate? }`
  - `context`: planner-provided history/scheduled/planned context to prevent repeats
  - `promptUpdate`: facilitator-provided steering text (used by Redo on planned lessons)

**Response**:
- Returns `{ outline: { kind, title, description, subject, grade, difficulty } }`
- `kind` is `new` or `review`
- When `kind=review`, the title is prefixed with `Review:` for clarity

### `/api/generate-lesson`
**Purpose**: Generate new lesson content via LLM  
**Status**: Legacy route, may be superseded by facilitator lesson editor

### `/api/facilitator/learners/[id]/evidence`
**Purpose**: Return deterministic, educator-safe Stage 8 evidence summaries for one facilitator-owned learner
**Status**: Operational when mastery evidence is enabled

- **Location**: `src/app/api/facilitator/learners/[id]/evidence/route.js`
- **Method**: GET
- **Auth**: Bearer token required; learner ownership is verified before history queries
- **Filters**: optional `session_id`, `lesson_key`, `limit`, and opaque keyset `cursor`
- **Bounds**: 10 sessions by default, 25 maximum
- **Response**: whitelisted derived session summaries, separately typed Daily/Weekly review summaries, and pagination metadata; never raw evidence rows
- **Privacy**: service-role reads re-apply facilitator, learner, tracked-session, and evidence-session boundaries
- **Feature flag**: returns a calm empty disabled response when the existing mastery-evidence flag is off
- **Failure isolation**: reporting failure does not affect learner sessions or transcript history

### `/api/facilitator/learners/[id]/lesson-history/[occurrenceId]`
**Purpose**: Return read-only history for one exact Syllabus occurrence selected by an authenticated facilitator
**Status**: Operational without an additional migration

- **Location**: `src/app/api/facilitator/learners/[id]/lesson-history/[occurrenceId]/route.js`
- **Method**: GET
- **Authorization**: Bearer authentication, facilitator-owned learner, active Syllabus composition, and exact occurrence membership are all required before evidence or transcript reads
- **Occurrence authority**: Accepts only a unique composed `actual:<lesson_sessions.id>` or `historical:<legacy-record-id>` occurrence; title, subject, lesson key, date, and latest-session matching are never fallbacks
- **Instruction boundary**: A historical occurrence must be a canonical instructional-completion record. Standalone historical Slate-only activity is non-instructional, has no Review History action, and receives the same non-disclosing 404 if requested directly
- **Evidence boundary**: Canonical instructional evidence joins through the exact `lesson_sessions.id`; Slate evidence requires the selected occurrence anchor, while Daily/Weekly reviews require mastery-check anchors belonging to authorized occurrence evidence
- **Transcript boundary**: Server code derives the authorized storage location and returns a short-lived signed URL. Raw storage paths are not response authority, and a missing transcript does not erase session/evidence history
- **Failure behavior**: Unauthorized learners and unknown occurrences share the same non-disclosing 404 response. Evidence and transcript failures degrade independently
- **Mutation**: Read-only; it does not change Syllabus revisions, proposals, planning, sessions, evidence, transcripts, readiness, or scheduling

### `/api/learner/follow-ups`
**Purpose**: Read/start learner Daily Follow-Up and Weekly Review cards and update facilitator-controlled per-learner settings
**Status**: Operational only when the existing mastery-evidence flag is enabled and the Follow-Up migration is installed

- **Location**: `src/app/api/learner/follow-ups/route.js`
- **Methods**: `GET` availability, `POST` with `action=start`, `PATCH` settings
- **Auth**: Bearer token required; learner ownership is verified before reads or writes
- **Selection**: Server time, profile timezone, source-backed evidence, deterministic identity, and durable run state are authoritative
- **Privacy**: Responses omit answer keys, raw responses, private item payloads, service credentials, and unselected held-out items; availability cards never include reserved selections
- **Settings**: Accepts only `daily_followups_enabled`, `weekly_reviews_enabled`, and a validated weekday

### `/api/learner/follow-ups/[runId]`
**Purpose**: Resume and append interactions to one authorized review run
**Status**: Operational only when the existing mastery-evidence flag is enabled

- **Location**: `src/app/api/learner/follow-ups/[runId]/route.js`
- **Methods**: `GET` current state; `POST` `present`, `assist`, or `respond`
- **Integrity**: Stable run/items, idempotent presentation/first-response/evaluation/result facts, and server-side answer evaluation
- **Controls**: Repeat is non-disqualifying; answer reveal is assistance; disabled settings block new presentation but do not discard an already presented first-response opportunity
- **Isolation**: Prior exposure is rechecked at presentation time; the route returns only the sanitized current item and never exposes future review items or raw `item_payload`; it never creates lesson sessions or snapshots

### `/api/syllabus/execution/start`
**Purpose**: Settle an authorized Syllabus lesson-session start without a check-then-insert takeover race
**Status**: Operational after `20260827174540_transactional_lesson_session_start.sql` is applied

- **Location**: `src/app/api/syllabus/execution/start/route.js`
- **Method**: POST
- **Auth**: Bearer token, facilitator-owned learner, and signed scoped Syllabus execution proof are all required; the proof binds the facilitator, learner, lesson, occurrence, local date, and server-resolved instructional teacher
- **Browser identity**: A valid `browserSessionId` UUID is mandatory for protected non-demo starts
- **Occurrence identity**: The page sends the canonical occurrence returned by its authorization decision; the route requires that independent value to match the signed proof, so another tab's proof cannot authorize this page's occurrence
- **Takeover**: A fresh Facilitator PIN plus the exact `expectedConflictingSessionId` are required before the route sends `allowTakeover=true`
- **Teacher identity**: `instructionalTeacher` must be `sonoma` or `webb`, must match the proof, and is written immutably to the canonical session plus started event
- **Atomicity**: One service-role call to `start_lesson_session_transactional` locks the learner and every active learner session, closes prior lessons, and returns `started`, `reused`, `conflict`, or `taken_over`; the route has no JavaScript check/insert fallback
- **Database boundary**: The RPC accepts no raw PIN and is executable only by `service_role`
- **Legacy compatibility**: Webb/Sonoma instructional clients may initially authorize with an empty occurrence only when the server has no active Syllabus; the authorization route returns the canonical `legacy:<lesson-key>:<today>` identity used by protected start and completion. Active-Syllabus occurrence matching remains exact and fail-closed.

### `/api/syllabus/execution`
**Purpose**: Authorize an exact Syllabus occurrence for instruction or supplemental Slate practice
**Status**: Operational

- **Location**: `src/app/api/syllabus/execution/route.js`
- **Method**: POST
- **Instruction**: The default `instruction` activity preserves today/repeat PIN rules and the server-resolved Sonoma/Webb assignment.
- **Slate practice**: `activityKind=slate_practice` permits on-demand practice for an exact owned Syllabus occurrence without an instructional exception PIN. It returns scoped occurrence context but never mints the instructional proof cookie or calls the protected instructional start/completion routes.
- **Boundary**: Slate remains invalid as `instructionalTeacher`; the supplemental activity mode cannot substitute for Sonoma or Webb.

### `/api/syllabus/slate-assignments`
**Purpose**: Add or remove a separately visible Mr. Slate practice event for one exact lesson occurrence
**Status**: Operational after `20260902161410_add_syllabus_slate_assignments.sql` is applied

- **Location**: `src/app/api/syllabus/slate-assignments/route.js`
- **Methods**: POST assigns by learner, lesson, and exact composed occurrence; DELETE removes by owned assignment ID.
- **Auth**: Bearer authentication, facilitator-owned learner, and exact active-Syllabus membership are required before the service-role write.
- **Idempotency**: One assignment may exist per facilitator, learner, and parent occurrence; repeated POST returns the existing assignment.
- **Separation**: The row creates no lesson session, completion, mastery, schedule, capacity use, or instructional-teacher change.

### `/api/syllabus/forecast`
**Purpose**: Create or reuse one inactive, next-week instructional learning forecast from canonical Syllabus intent and deterministic evidence summaries
**Status**: Operational after `20260831201314_add_learning_forecast_foundation.sql` and `20260901160538_add_materialization_generation_recovery.sql` are applied

- **Location**: `src/app/api/syllabus/forecast/route.js`
- **Method**: POST with `{ learnerId, expectedActiveRevisionId }`
- **Auth**: Bearer token, learner ownership, and existing Syllabus future-planning entitlement are required
- **Authority**: Server weekly-pattern slots own dates, subjects, and count; the model returns title and description only
- **Idempotency**: Unchanged authoritative inputs reuse the current `learning_forecast` proposal without another model call
- **Mutation boundary**: Writes an inactive proposal only; it does not change the active pointer, generate a full lesson, consume generation quota, or create schedule rows

### `/api/syllabus/materialize`
**Purpose**: Materialize one exact adopted or proposed learning-forecast lineage as a canonical generated lesson
**Status**: Operational after `20260831201314_add_learning_forecast_foundation.sql` is applied

- **Location**: `src/app/api/syllabus/materialize/route.js`
- **Method**: POST with `{ learnerId, lineageId, expectedActiveRevisionId, proposalRevisionId? }`
- **Auth**: Bearer token, learner ownership, Syllabus future-planning entitlement, and the canonical generator's own entitlement/quota checks are required
- **Lineage**: The server validates the exact `lineage_id`; it never matches by title
- **One-lineage adoption**: Selecting one proposed concept creates a fresh active revision containing only that selected proposal change, immediately rebases non-conflicting siblings onto that adopted revision before generation, and rebases that current remainder again if lesson-key binding advances the active pointer
- **Carry-forward boundary**: Rebase preserves exact sibling lineages and concept fields, invokes neither forecast nor lesson generation, consumes no quota, and drops a sibling whose date/sort slot is occupied by active educator intent
- **Grade authority**: Full generation requires the owned learner's authoritative `learners.grade`; a missing grade returns a bounded error before adoption or generation
- **Generator reuse**: Delegates to `POST /api/facilitator/lessons/generate` in proposal mode, preserving storage, canonical `lesson_key`, draft association, and normal quota authority
- **Recovery identity**: The server-verified receipt UUID determines one exact facilitator Storage path/key and is bound to the owned learner, Syllabus, exact lineage, and generation-input hash; browser JSON cannot supply this trusted generator dependency
- **Retry**: Generator or binding failure leaves the post-adoption sibling proposal current. A `generating` retry is recovery-only and validates the exact embedded operation metadata before reuse; it never performs a second model call or title/path search
- **Quota**: The service-role completion RPC locks the receipt and records the finite-tier charge atomically at most once. New materializations retain normal quota; exact recovery cannot charge twice
- **Ambiguity**: If no exact artifact can be proven, the receipt becomes `recovery_required`, normal generation remains disabled, and the authorized response returns only non-secret operation/lineage identity for reconciliation
- **Scheduling**: Neither materialization nor forecast adoption creates `lesson_schedule` rows

### `/api/syllabus/planning`
**Purpose**: Apply exact-slot facilitator planning actions from the unified Syllabus surface
**Status**: Operational; no additional migration beyond the current Syllabus foundation is required

- **Location**: `src/app/api/syllabus/planning/route.js`
- **Method**: POST with `learnerId`, `expectedActiveRevisionId`, an action, and action-specific fields
- **Auth**: Bearer token, learner ownership, and Syllabus future-planning entitlement are required
- **Actions**: Create, edit, or remove eligible facilitator concepts; edit or replace an exact inactive forecast lineage; return transient explicit Plan Ahead suggestions
- **Concurrency**: Every action validates the exact active revision and fails closed after a concurrent pointer change
- **Authority**: Persisted planning actions create canonical immutable Syllabus revisions or the existing inactive `learning_forecast` proposal kind; no `plannedLessons`-style store is used
- **AI boundary**: Replacement preserves exact lineage/date/subject/sort slot. Farther-out suggestions use current evidence summaries but explicitly do not assume future completion or mastery and are not persisted until the facilitator saves them
- **Artifact boundary**: Concept creation leaves `lesson_key = null`; full generation remains `/api/syllabus/materialize`
- **Scheduling**: The route does not create or update `lesson_schedule`

### `/api/syllabus/execution/complete`
**Purpose**: Commit truthful instructional completion for an already protected Sonoma or Webb session
**Status**: Teacher-bound after `20260829010000_add_instructional_teacher_authority.sql` is applied

- **Location**: `src/app/api/syllabus/execution/complete/route.js`
- **Method**: POST
- **Auth**: Bearer token and facilitator-owned learner are required
- **Identity**: Valid session UUID, canonical lesson key, exact Syllabus occurrence ID, and a canonical Sonoma (`session-v2`) or Webb (`webb`) source are mandatory
- **Atomicity**: One service-role call locks the session, verifies its protected-start occurrence and immutable instructional teacher, rejects a conflicting source, sets `ended_at`, and inserts the completed event in one transaction
- **Idempotency**: A retry for an already completed session returns the existing completion; an ended-but-uncompleted or mismatched session fails closed
- **Database boundary**: Only `service_role` can execute the RPC; browser clients cannot directly insert lifecycle events or change `ended_at`

### `/api/tts`
**Purpose**: Text-to-speech conversion (Google TTS)  
**Status**: Operational, used for all Ms. Sonoma audio

### `/api/visual-aids/generate`
**Purpose**: Generate visual aid images via DALL-E 3  
**Status**: Operational, see `docs/brain/visual-aids.md`

### `/api/content-safety`
**Purpose**: Content moderation via Azure Content Safety API  
**Status**: Operational, see brain files for content safety architecture

---

## API Architecture Principles

1. **Stateless**: Each `/api/sonoma` call is independent; session state passed in request body
2. **Instruction-driven**: Behavior controlled by `instructions` field, not hardcoded logic
3. **LLM-agnostic**: Provider/model configured via `SONOMA_PROVIDER` and `SONOMA_MODEL` env vars
4. **Closed-world**: API responses are text-only; no side effects, no file access, no database writes from Ms. Sonoma
