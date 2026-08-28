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
- **Auth**: Bearer token, facilitator-owned learner, and signed scoped Syllabus execution proof are all required
- **Browser identity**: A valid `browserSessionId` UUID is mandatory for protected non-demo starts
- **Occurrence identity**: The page sends the canonical occurrence returned by its authorization decision; the route requires that independent value to match the signed proof, so another tab's proof cannot authorize this page's occurrence
- **Takeover**: A fresh Facilitator PIN plus the exact `expectedConflictingSessionId` are required before the route sends `allowTakeover=true`
- **Atomicity**: One service-role call to `start_lesson_session_transactional` locks the learner and every active learner session, closes prior lessons, and returns `started`, `reused`, `conflict`, or `taken_over`; the route has no JavaScript check/insert fallback
- **Database boundary**: The RPC accepts no raw PIN and is executable only by `service_role`
- **Legacy compatibility**: Webb/Sonoma instructional clients may initially authorize with an empty occurrence only when the server has no active Syllabus; the authorization route returns the canonical `legacy:<lesson-key>:<today>` identity used by protected start and completion. Active-Syllabus occurrence matching remains exact and fail-closed.

### `/api/syllabus/execution/complete`
**Purpose**: Commit truthful instructional completion for an already protected Sonoma or Webb session
**Status**: Operational after `20260828130000_transactional_lesson_session_completion.sql` is applied

- **Location**: `src/app/api/syllabus/execution/complete/route.js`
- **Method**: POST
- **Auth**: Bearer token and facilitator-owned learner are required
- **Identity**: Valid session UUID, canonical lesson key, and exact Syllabus occurrence ID are mandatory
- **Atomicity**: One service-role call locks the session, verifies its protected-start occurrence, sets `ended_at`, and inserts the completed event in one transaction
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
