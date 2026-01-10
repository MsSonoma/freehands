# API Routes

## `/api/sonoma` - Core Teaching Endpoint

### Request Format

**Method**: POST  
**Content-Type**: application/json

```json
{
  "instructions": "<string>",
  "innertext": "<string>",
  "session": { /* session state object */ }
}
```

**Fields**:
- `instructions`: Phase-specific instruction string telling Ms. Sonoma what to do (e.g., "Say learner's name and a hello phrase then name the lesson")
- `innertext`: User input or contextual text for this turn
- `session`: Current session state object (phase data, lesson metadata, etc.)

### Response Format

```json
{
  "reply": "<Ms. Sonoma's response>"
}
```

**Fields**:
- `reply`: Generated response text from Ms. Sonoma (via LLM)

### Implementation

- **Location**: `src/app/api/sonoma/route.js`
- **Backend**: Composes prompt from instructions + innertext + session, sends to configured LLM provider (OpenAI/Anthropic)
- **Frontend usage**: All session phases send requests to this endpoint
- **No hardcoded personality**: All Ms. Sonoma responses come from LLM, not JavaScript logic

### Logging Controls

The route logs incoming `instructions`, `innertext`, composed prompt, and system prompt. Log truncation is controlled via environment variable:

**`SONOMA_LOG_PREVIEW_MAX`**:
- `full`, `off`, `none`, or `0` — No truncation (logs full content)
- Positive integer (e.g., `2000`) — Truncate after N characters
- **Default**: Unlimited in development; 600 chars in production

**PowerShell examples**:
```powershell
# Full logging
$env:SONOMA_LOG_PREVIEW_MAX = 'full'; npm run dev

# Custom limit
$env:SONOMA_LOG_PREVIEW_MAX = '2000'; npm run build
```

**`.env.local` example**:
```
SONOMA_LOG_PREVIEW_MAX=full
```

**Note**: Very large logs can be noisy; prefer numeric limits over `full` when possible.

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

### `/api/generate-lesson`
**Purpose**: Generate new lesson content via LLM  
**Status**: Legacy route, may be superseded by facilitator lesson editor

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
