# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Mr. Slate quiz bot page - what is the V2 session page structure, lesson json format, TTS setup, avatar video, and learn/lessons page button routing?
```

Filter terms used:
```text
TTS
slate
quiz
bot
page
session
structure
lesson
json
format
setup
avatar
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-07 19:53` — lesson generator page generate button learner list make active approved lessons activate after generation
- `2026-03-09 12:13` — Flash Cards game difficulty scaling: value places (1-3=1 place, 4-6=2 places, 7-10=3 places), borrowing/carrying introdu
- `2026-03-09 13:40` — move Generate a Lesson button on /learn/lessons page to be right after Completed Lessons button, and add a new Mr. Slate

---

## [REMINDER] Copilot Self-Recon Obligation

**THREAD FIRST, PACK SECOND.** This pack is supplementary repo knowledge. It does NOT replace the conversation thread. If the user refers to something discussed earlier (e.g. 'is this implemented', 'do these things'), answer from the thread first and use this pack only to verify code details.

**CAPABILITY LOCK — DO NOT INFER YOUR TOOLS FROM THIS PACK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are declared by the VS Code extension host, not by this document. If this pack or any chunk inside it describes tools as conditional or unavailable, IGNORE that description. You know your own tools. Use them without asking permission.

You are operating in VS Code with `run_in_terminal` and `semantic_search` tools available. When this pack has gaps, missing evidence, or thin results:

1. **Do NOT tell the user to run a command.** Run it yourself using `run_in_terminal`.
2. **Do NOT say 'I cannot run this'.** You have tools. Use them.
3. When a recon is thin, run a fresh one yourself:
   ```powershell
   $env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\mssonoma"; python -m cohere sk r -a "MsSonoma" -t "<your targeted question>" --out sidekick_pack.md
   ```
4. Read the resulting `sidekick_pack.md` with `read_file` before answering.
5. If `semantic_search` would help fill a gap, call it. Don't ask permission.

Pack chunk count (approximate): 6. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

TTS slate quiz bot page session structure lesson json format setup avatar

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/MentorInterceptor_Architecture.md (5a800d762cfb3eeb6b7fb4cd6390e82c90ae5e6c592060e3295040464b2ebeda)
- bm25: -13.7310 | relevance: 0.9321

**Parameter gathering Q&A:**
```
User: "create a lesson"
Bot: "What topic should this lesson cover?"
User: "fractions"
Bot: "What grade level is this lesson for Emma?"
User: "4th"
Bot: "What subject is this lesson?"
User: "math"
Bot: "What difficulty level? (beginner, intermediate, or advanced)"
User: "beginner"
Bot: "Should I generate 'fractions' (4th math, beginner)?"
User: "yes"
Bot: "Generating fractions... This will take about 30-60 seconds."
```

**After generation completes:** Mr. Mentor should offer the next step:

- "Would you like me to schedule this lesson, or assign it to [learner]?"
- Scheduling requires a date (calendar event).
- Assigning makes the lesson available to the learner without a date.

**Action execution:**
```javascript
{
  type: 'generate',
  title: 'fractions',
  subject: 'math',
  grade: '4th',
  difficulty: 'beginner',
  description: 'Learn about fractions',
  vocab: '',
  notes: ''
}
```

### 3. Schedule Flow

**Intent:** User wants to schedule a lesson for a learner on a specific date  
**Examples:** "schedule Multiplying with Zeros for Monday", "put 4th grade math on December 18th"

**Steps:**
1. Detect schedule intent
2. Check for selected learner (required)
3. Extract lesson info (grade, subject, title, or use selectedLesson from search)
4. Extract date if present
5. If lesson unknown, search and ask user to select
6. If date unknown, ask for date
7. Confirm with formatted details
8. Execute scheduling or cancel

**Confirmation format:**
```
"Should I schedule Multiplying with Zeros (4th math, beginner) 
on Monday, December 18, 2025 for Emma?"
```

**Action execution:**
```javascript
{
  type: 'schedule',
  lessonKey: 'math/4th-multiplying-with-zeros.json',
  scheduledDate: '2025-12-18'
}
```

### 2. docs/brain/ingests/pack.lesson-schedule-debug.md (9db659bda6210041f03a9461a58e75e31db5164dab78ec9e4bdb137dc9418bb0)
- bm25: -12.7292 | relevance: 0.9272

### 4. docs/brain/MentorInterceptor_Architecture.md (5a800d762cfb3eeb6b7fb4cd6390e82c90ae5e6c592060e3295040464b2ebeda)
- bm25: -23.1824 | relevance: 1.0000

**Parameter gathering Q&A:**
```
User: "create a lesson"
Bot: "What topic should this lesson cover?"
User: "fractions"
Bot: "What grade level is this lesson for Emma?"
User: "4th"
Bot: "What subject is this lesson?"
User: "math"
Bot: "What difficulty level? (beginner, intermediate, or advanced)"
User: "beginner"
Bot: "Should I generate 'fractions' (4th math, beginner)?"
User: "yes"
Bot: "Generating fractions... This will take about 30-60 seconds."
```

**After generation completes:** Mr. Mentor should offer the next step:

- "Would you like me to schedule this lesson, or assign it to [learner]?"
- Scheduling requires a date (calendar event).
- Assigning makes the lesson available to the learner without a date.

**Action execution:**
```javascript
{
  type: 'generate',
  title: 'fractions',
  subject: 'math',
  grade: '4th',
  difficulty: 'beginner',
  description: 'Learn about fractions',
  vocab: '',
  notes: ''
}
```

### 3. Schedule Flow

**Intent:** User wants to schedule a lesson for a learner on a specific date  
**Examples:** "schedule Multiplying with Zeros for Monday", "put 4th grade math on December 18th"

**Steps:**
1. Detect schedule intent
2. Check for selected learner (required)
3. Extract lesson info (grade, subject, title, or use selectedLesson from search)
4. Extract date if present
5. If lesson unknown, search and ask user to select
6. If date unknown, ask for date
7. Confirm with formatted details
8. Execute scheduling or cancel

**Confirmation format:**
```
"Should I schedule Multiplying with Zeros (4th math, beginner) 
on Monday, December 18, 2025 for Emma?"
```

### 3. docs/brain/api-routes.md (dd3378227a6324ce4a86f9e043ed13060e4abcc4a4fabc05a7854dad2c6ce68c)
- bm25: -9.6883 | entity_overlap_w: 3.90 | adjusted: -10.6633 | relevance: 0.9143

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

### 4. docs/brain/MentorInterceptor_Architecture.md (002f07476a11a14f963028f7b806b02562191bf0e6a782a8ab90a3f25199abed)
- bm25: -10.6444 | relevance: 0.9141

**Event dispatch:**
```javascript
window.dispatchEvent(new Event('mr-mentor:lesson-scheduled'))
```

### 3b. Assign Flow

**Intent:** User wants a lesson to show up as available to a learner (no date).  
**Examples:** "assign this lesson to Emma", "make this lesson available", "show this lesson to her"

**Steps:**
1. Detect assign intent
2. Check for selected learner (required)
3. Resolve lesson (use selectedLesson from search/generation; otherwise search and ask user to select)
4. Execute assignment immediately
5. Confirm in dialogue: "I've assigned [lesson title] to [learner name]. Is that correct?"
6. If user says "no", undo the assignment and ask what to do next

**Action execution:**
```javascript
{
  type: 'assign',
  lessonKey: 'math/4th-multiplying-with-zeros.json'
}
```

### 4. Edit Flow

**Intent:** User wants to modify a lesson  
**Examples:** "edit Multiplying with Zeros", "change the 4th grade fractions lesson"

**Steps:**
1. Detect edit intent
2. Extract lesson info or use selectedLesson
3. If lesson unknown, search and ask user to select
4. Confirm lesson choice
5. Ask: "What would you like me to change?"
6. Capture edit instructions
7. Confirm changes
8. Execute edit or cancel

**Edit instructions capture:**
```
User: "edit Multiplying with Zeros"
Bot: "Do you want to edit Multiplying with Zeros (4th math, beginner)?"
User: "yes"
Bot: "What would you like me to change in Multiplying with Zeros?"
User: "make the examples easier"
Bot: "Should I make these changes to Multiplying with Zeros?"
User: "yes"
Bot: "I'm editing Multiplying with Zeros now..."
```

**Action execution:**
```javascript
{
  type: 'edit',
  lessonKey: 'math/4th-multiplying-with-zeros.json',
  editInstructions: 'make the examples easier'
}
```

### 5. docs/brain/ingests/pack-mentor-intercepts.md (35e76a89c7f5240f0e94cbd2877e930ae62cde56e079f99fd9382929f9faf2a0)
- bm25: -9.6410 | entity_overlap_w: 3.90 | adjusted: -10.6160 | relevance: 0.9139

### 15. docs/brain/api-routes.md (dd3378227a6324ce4a86f9e043ed13060e4abcc4a4fabc05a7854dad2c6ce68c)
- bm25: -16.5866 | relevance: 1.0000

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

### 6. sidekick_pack.md (ddb12ec6e90db828431d06cf91cbec70a84f5cea28c9be619c44aefe0ca22c23)
- bm25: -10.1830 | entity_overlap_w: 1.30 | adjusted: -10.5080 | relevance: 0.9131

```
User types message
    ↓
CounselorClient.sendMessage()
    ↓
Load allLessons (subjects → lessons object)
    ↓
interceptor.process(message, { allLessons, selectedLearnerId, learnerName, conversationHistory })
    ↓
  interceptResult.handled?
    ↓
  YES → Handle front-end
    ↓
    Add user + bot messages to conversationHistory
    Display response in captions
    Play TTS audio
    Execute action if present (schedule/generate/edit)
    Return (skip API)
    ↓
  NO → Forward to API
    ↓
    Call /api/counselor with forwardMessage
    Process tool calls, follow-ups, etc
    Add messages to conversationHistory
    Display response in captions
    Play audio
    Track tokens
```

### 7. docs/brain/MentorInterceptor_Architecture.md (ce3cd9684410622160fbad2779f03dd2313cb09bba1ed5ffcd42179724e742c6)
- bm25: -10.1029 | entity_overlap_w: 1.30 | adjusted: -10.4279 | relevance: 0.9125

```
User types message
    ↓
CounselorClient.sendMessage()
    ↓
Load allLessons (subjects → lessons object)
    ↓
interceptor.process(message, { allLessons, selectedLearnerId, learnerName, conversationHistory })
    ↓
  interceptResult.handled?
    ↓
  YES → Handle front-end
    ↓
    Add user + bot messages to conversationHistory
    Display response in captions
    Play TTS audio
    Execute action if present (schedule/generate/edit)
    Return (skip API)
    ↓
  NO → Forward to API
    ↓
    Call /api/counselor with forwardMessage
    Process tool calls, follow-ups, etc
    Add messages to conversationHistory
    Display response in captions
    Play audio
    Track tokens
```

### 8. docs/brain/ingests/pack.planned-lessons-flow.md (043acc5f96fad3732cebeb897f3edf1f5e317250beb4b58f69e73bcccf3e4b46)
- bm25: -10.0972 | entity_overlap_w: 1.30 | adjusted: -10.4222 | relevance: 0.9125

### Data/Key Rules

### 31. docs/brain/MentorInterceptor_Architecture.md (ce3cd9684410622160fbad2779f03dd2313cb09bba1ed5ffcd42179724e742c6)
- bm25: -13.9393 | relevance: 1.0000

```
User types message
    ↓
CounselorClient.sendMessage()
    ↓
Load allLessons (subjects → lessons object)
    ↓
interceptor.process(message, { allLessons, selectedLearnerId, learnerName, conversationHistory })
    ↓
  interceptResult.handled?
    ↓
  YES → Handle front-end
    ↓
    Add user + bot messages to conversationHistory
    Display response in captions
    Play TTS audio
    Execute action if present (schedule/generate/edit)
    Return (skip API)
    ↓
  NO → Forward to API
    ↓
    Call /api/counselor with forwardMessage
    Process tool calls, follow-ups, etc
    Add messages to conversationHistory
    Display response in captions
    Play audio
    Track tokens
```

### 32. docs/brain/calendar-lesson-planning.md (3fa72b30c4a36a0855e8b5e9c7f63b5cb1e38fd2725c7bcf9389c3fa8d2b81ed)
- bm25: -13.5957 | relevance: 1.0000

**Completion query rule (visibility > micro-optimization):**
- Do not rely on `.in('lesson_id', [...scheduledKeys])` when loading completion events.
- Because `lesson_id` formats vary, strict filtering can miss valid completions and make past calendar history appear empty.

**Calendar date key rule (marker dots):**
- Calendar grid cells must compute their `YYYY-MM-DD` date keys using local time.
- Do not use `Date.toISOString().split('T')[0]` to build calendar cell keys, because it is UTC-based and can shift the day relative to local dates.
- The schedule grouping keys come from `lesson_schedule.scheduled_date` (already `YYYY-MM-DD`). The calendar grid must use the same format.

### 9. src/app/session/v2/services.js (9fd203ffa5e37711a590441c0c652aeb269232513e4f4c6b874bd29c9c481e00)
- bm25: -8.0971 | entity_overlap_w: 9.10 | adjusted: -10.3721 | relevance: 0.9121

/**
 * V2 Services - API integrations
 * 
 * Clean service layer for TTS and lesson loading.
 * Zero coupling to session state or components.
 */

/**
 * Fetch TTS audio from Google Cloud TTS API
 * @param {string} text - Text to synthesize
 * @returns {Promise<string|null>} Base64-encoded MP3 audio or null on failure
 */
export async function fetchTTS(text) {
  if (!text?.trim()) return null;

// Hard 12-second timeout so a stalled TTS response never blocks the answer flow.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

try {
    const response = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.trim() }),
      signal: controller.signal,
    });
    
    if (!response.ok) {
      console.error('[TTS] API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    return data.audio || null;
  } catch (err) {
    if (err?.name !== 'AbortError') {
      console.error('[TTS] Fetch error:', err);
    }
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch TTS for multiple sentences and combine
 * @param {string[]} sentences - Array of sentences to synthesize
 * @returns {Promise<string|null>} Combined base64 audio or null
 */
export async function fetchMultiSentenceTTS(sentences) {
  if (!sentences?.length) return null;
  
  // Combine sentences with natural pauses
  const combined = sentences.join(' ');
  return fetchTTS(combined);
}

### 10. docs/brain/ingests/pack.md (237a2deb28c985f662915aee6871b40e583791a8102c8eddfaa3f706b1726b74)
- bm25: -9.7190 | relevance: 0.9067

**2025-12-14**: Fixed medals API 404 causing generation failure
- Changed endpoint from `/api/learner/medals` to `/api/medals`
- Decoupled medals loading from history processing
- Added fallback to empty medals object when API fails
- Generation now succeeds even without medal data

**2025-12-14**: Fixed scheduled lessons API response structure
- API returns `{schedule: [...]}` not raw array
- Changed code to access `scheduledData.schedule` property
- Prevents ".map is not a function" error during context building

### 8. docs/brain/calendar-lesson-planning.md (b5fceec1ff172ff9be6e16676dfd040ac9bf511ccfa0190409ecada4fe8df328)
- bm25: -27.5210 | relevance: 1.0000

**Persistence Model:**
- Planned lessons stored in `planned_lessons` table (facilitator_id, learner_id, scheduled_date, lesson_data JSONB)
- Each row = one lesson outline for one date
- Survives page refresh, long absences, logout/login
- Tied to specific facilitator + learner combination
- **POST uses date-specific overwrite**: only deletes/replaces dates included in new plan
- **Multiple non-overlapping plans coexist**: schedule Jan + Mar separately, both persist
- **Overlapping dates are replaced**: reschedule Jan 15-31 overwrites only those dates, Jan 1-14 untouched

**Data Format:**
```javascript
// In-memory format (calendar page state)
plannedLessons = {
  '2025-12-15': [
    { id: '...', title: '...', subject: 'math', grade: '3rd', difficulty: 'intermediate', ... },
    { id: '...', title: '...', subject: 'science', ... }
  ],
  '2025-12-16': [ ... ]
}

// Database format (planned_lessons table)
{
  facilitator_id: 'uuid',
  learner_id: 'uuid',
  scheduled_date: '2025-12-15',
  lesson_data: { id: '...', title: '...', subject: 'math', ... } // JSONB
}
```

### API Endpoints

### 11. src/app/session/page.js (5ebb57890543e4d8ccb0e22882d780a52de493e4676b5227b61c96cc2894bd8d)
- bm25: -9.5564 | relevance: 0.9053

// Story: awaiting-turn or awaiting-setup ? treat as Your Turn (handles both setup and continuation)
    if (storyState === 'awaiting-turn' || storyState === 'awaiting-setup') {
      // Prevent double-processing by checking if input is already cleared
      if (!trimmed) return;
      setLearnerInput('');
      await handleStoryYourTurn(trimmed);
      return;
    }

// Fill-in-Fun: collecting words
    if (fillInFunState === 'collecting-words') {
      if (!trimmed) return;
      setLearnerInput('');
      await handleFillInFunWordSubmit(trimmed);
      return;
    }

### 12. docs/brain/MentorInterceptor_Architecture.md (17dcf012c47613eab74ca015b85a2a89e32d6728c284d3e2be34b3d430894fd9)
- bm25: -8.9080 | relevance: 0.8991

### 5. Recall Flow

**Intent:** User wants to retrieve past conversation context  
**Examples:** "remember when we discussed fractions?", "what did we talk about last time?"

**Steps:**
1. Detect recall intent
2. Extract search terms (filter out recall keywords)
3. Search conversationHistory for matches
4. Return best match first
5. If multiple matches, offer to show more
6. "More" → Show next match
7. Repeat until all matches shown or user stops

**Search algorithm:**
```javascript
conversationHistory
  .filter(turn => normalizedContent.includes(searchTerms) || 
                  searchTerms.includes(normalizedContent))
  .slice(0, 3)
```

**Multi-match handling:**
```
User: "remember when we talked about math?"
Bot: "I recall we discussed: 'Create a 4th grade math lesson on fractions'"
     
     "I found 3 conversations about this. Would you like to hear more?"
User: "yes"
Bot: "I also recall: 'Schedule Multiplying with Zeros for Monday'"
     
     "Would you like to hear more?"
User: "yes"
Bot: "I also recall: 'Edit the fractions lesson to add more examples'"
     
     "That's everything I found."
```

**State management:**
```javascript
{
  flow: 'recall',
  context: {
    recallMatches: [...],
    recallIndex: 1
  }
}
```

## Integration with CounselorClient

### Message Flow

### 13. src/app/facilitator/calendar/page.js (1edff854e8911932da31c1b5fa179a159a5f501b4784240a22b574e8399dc693)
- bm25: -8.8278 | relevance: 0.8982

{/* Database Setup Warning */}
        {!tableExists && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4 mb-6">
            <h3 className="text-yellow-800 font-semibold mb-2">⚠️ Database Setup Required</h3>
            <p className="text-yellow-700 text-sm mb-3">
              The lesson_schedule table hasn&apos;t been created yet. Please run the migration in your Supabase SQL Editor:
            </p>
            <code className="block bg-yellow-100 text-yellow-900 p-2 rounded text-xs mb-2">
              scripts/add-lesson-schedule-table.sql
            </code>
            <p className="text-yellow-700 text-xs">
              After running the migration, refresh this page.
            </p>
          </div>
        )}

### 14. docs/brain/riddle-system.md (3b9fcc9e9f0a42cb4d99fbb76628c81bc9b38324dff0b4de363a73b08f66db53)
- bm25: -8.6640 | relevance: 0.8965

# Riddle System Architecture

**Status**: Implemented but **NOT integrated** into teaching flow  
**Last Updated**: 2025-12-03  
**Key Files**: `src/app/lib/riddles.js`

---

## How It Works

### Storage Model
Riddles are **hardcoded** in `src/app/lib/riddles.js` as a static export. Not generated via AI, not pulled from database, not loaded from JSON. This is intentional for:
- **Performance**: No API calls or database queries
- **Consistency**: Same riddles always available offline
- **Control**: Curated content, not AI-generated randomness

### Riddle Structure
```javascript
{
  id: string,              // 'math-01', 'sci-15', etc.
  subject: string,         // 'math' | 'science' | 'language arts' | 'social studies' | 'general'
  lines: string[],         // 1-4 riddle lines (delivered with pauses)
  pausesMs: number[],      // Pause after each line (0 = no pause)
  answer: string           // Expected answer (lowercase, spaces allowed)
}
```

### Selection Algorithm
`pickNextRiddle(subject)` uses **localStorage rotation**:
1. Check localStorage for last riddle index for this subject
2. Increment index (wrap to 0 at end)
3. Return riddle at new index
4. Store index for next call

This ensures kids get **different riddles each time** without server-side state.

### Design Philosophy (December 2025 Transformation)

**Before**: 60% of riddles were quiz questions  
**After**: All riddles use wordplay, metaphor, or lateral thinking

#### True Riddle Characteristics
- **Misdirection**: Leads thinking one way, answer is another
- **Wordplay**: Puns, double meanings, homonyms, visual tricks
- **Surprise**: "Aha!" moment when solved
- **Fair Clues**: Solvable with lateral thinking (not pure recall)

#### Transformation Patterns Applied

### 15. docs/brain/MentorInterceptor_Architecture.md (859736bab84d0ee834de1e1f0302bcc99fd52b2eaf052ec25b24ee572d9c187c)
- bm25: -8.3294 | entity_overlap_w: 1.30 | adjusted: -8.6544 | relevance: 0.8964

### Lesson Keys

**Standard lessons:**
```
"math/4th-multiplying-with-zeros.json"
"science/5th-photosynthesis.json"
```

**Generated lessons:**
```
"generated/uuid-fractions.json"
```

### interceptResult

```javascript
{
  handled: boolean,           // Did interceptor handle this?
  response?: string,          // Text response to user
  action?: {                  // Action to execute
    type: 'schedule' | 'generate' | 'edit',
    // ... type-specific fields
  },
  apiForward?: {              // Forward to API
    message: string,
    context?: object,
    bypassInterceptor?: boolean
  }
}
```

## Testing Strategy

**Not pushed to Vercel** - local testing only.

**Test progression:**
1. Test each flow independently
2. Test parameter gathering Q&A
3. Test confirmation flows (yes/no/unclear)
4. Test lesson search with various queries
5. Test action execution (schedule/generate/edit)
6. Test recall with conversation history
7. Test bypass commands
8. Test API fallback for unhandled intents
9. Test TTS synchronization
10. Test conversation continuity across interceptor/API

**Rollback plan:**
- Commits are waypointed
- Can revert via: `git revert ab3fed4..6890d3b`
- CounselorClient integration is isolated in sendMessage
- Removing interceptor call returns to original API-only flow

## Commits

**6890d3b:** WIP: Create MentorInterceptor foundation with intent detection and search flow  
**6b5f2ea:** Complete all MentorInterceptor flows: generate, schedule, edit, recall with full parameter gathering  
**a7a5055:** Integrate MentorInterceptor with CounselorClient for front-end conversation handling  
**ab3fed4:** Add recall 'more' handling and fix allLessons structure for interceptor

## Next Steps

### 16. src/app/session/page.js (6953fd6530f7514ef3711ded36a2578c7911f2bf7a694282050b50a952ce740c)
- bm25: -8.4073 | relevance: 0.8937

// Enforce step-specific reply hygiene
      let replyText = data.reply || "";
      try {
        const stepKey = (session && session.step) || "";
        const phaseKey = (session && session.phase) || "";
        if (stepKey === "silly-question") {
          // Keep only a single sentence that ends with a question mark
          const qMatches = replyText.match(/[^?]*\?/g);
          if (qMatches && qMatches.length) {
            replyText = qMatches[qMatches.length - 1].trim();
          } else {
            // If no explicit question, append a question mark to the last sentence
            replyText = (replyText.split(/(?<=[.!?])\s+/).pop() || replyText).trim();
            if (!replyText.endsWith("?")) replyText += "?";
          }
          // No worksheet/test mention in discussion
          replyText = replyText.replace(/\b(worksheet|test|exam|quiz)\b/gi, "");
        } else if (stepKey === "greeting" || stepKey === "encouragement") {
          // Remove any question sentences and keep it brief
          if (replyText.includes("?")) {
            replyText = replyText.slice(0, replyText.indexOf("?")).trim();
          }
          const parts = replyText
            .replace(/\s+/g, " ")
            .split(/(?<=[.!])\s+/)
            .filter(Boolean);
          const maxSentences = stepKey === "greeting" ? 2 : 1;
          replyText = parts.slice(0, maxSentences).join(" ").trim();
          // No worksheet/test mention in discussion
          replyText = replyText.replace(/\b(worksheet|test|exam|quiz)\b/gi, "").replace(/\s{2,}/g, " ").trim();
        } else if (stepKey === "joke") {
          // Ensure required opener is present
          const openers = [getJokePrompt(), getJokePrompt()]; // Get two options
          const hasOpener = openers.some((o) => replyTe

### 17. src/app/session/components/games/FlashCards.jsx (8dfdfc54a01ee7b71c8e5ee4228f52908a7fd112c07bdcc8613c66a8572b80ad)
- bm25: -8.1467 | relevance: 0.8907

const goNextTopic = () => {
    const nextTopicId = pickNextTopicId(topicId);
    if (!nextTopicId) {
      // No more topics yet: return to setup.
      setScreen('setup');
      return;
    }
    setTopicId(nextTopicId);
    setStage(1);
    setSeed(null);
    setCardIndex(0);
    setMeter(0);
    setAnswer('');
    setPendingTopicComplete(false);
    setScreen('card');

### 18. src/app/session/page.js (9334f5c024e34cd6146f964fba491b094aa82226477c3b6451d30fb4ac05bcb5)
- bm25: -7.8160 | entity_overlap_w: 1.30 | adjusted: -8.1410 | relevance: 0.8906

// Request TTS for the local opening and play it using the same pipeline as API replies.
      setLoading(true);
      setTtsLoadingCount((c) => c + 1);
  const replyStartIndex = prevLen; // we appended opening sentences at the end
      let res;
      try {
        res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: replyText }) });
        var data = await res.json().catch(() => ({}));
        var audioB64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
        // Dev warm-up: if route wasn't ready (404) or no audio returned, pre-warm and retry once
        if ((!res.ok && res.status === 404) || !audioB64) {
          try { await fetch('/api/tts', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(() => {}); } catch {}
          try { await waitForBeat(400); } catch {}
          res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: replyText }) });
          data = await res.json().catch(() => ({}));
          audioB64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
        }
      } finally {
        setTtsLoadingCount((c) => Math.max(0, c - 1));
      }
      if (audioB64) audioB64 = normalizeBase64Audio(audioB64);
      // Match API flow: stop showing loading before kicking off audio
      setLoading(false);
      if (audioB64) {
        // Stash payload so gesture-based unlock can retry immediately if needed
        try { lastAudioBase64Ref.current = audioB64; } catch {}
        setIsSpeaking(true);
        // CRITICAL: Also update the ref immediately to prevent double-playback in recovery timeout

### 19. src/app/session/page.js (556557f55b488bef68b35361f248c882c1a8e94ced606307f9e1927748a3ad8f)
- bm25: -8.1016 | relevance: 0.8901

{/* Story back button: shows during story setup and continuation */}
          {(() => {
            try {
              const active = (storyState === 'awaiting-setup' || storyState === 'awaiting-turn');
              if (!active) return null;
              const wrap = { display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'6px 12px', flexWrap:'wrap' };
              const backBtn = { background:'#374151', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
              return (
                <div style={wrap} aria-label="Story actions">
                  <button type="button" style={backBtn} onClick={handleStoryBack}>Back</button>
                </div>
              );
            } catch {}
            return null;
          })()}

### 20. src/app/session/v2/ComprehensionPhase.jsx (1e185575726eba6e53dfa74890a33cdcbdc7aaa2013557d0852702d26d84489d)
- bm25: -7.1154 | entity_overlap_w: 3.90 | adjusted: -8.0904 | relevance: 0.8900

// Public API: Recover from a stuck state (e.g. TTS/API timeout).
  // Resets to awaiting-answer so the learner can re-submit without reloading.
  recover() {
    if (this.#state === 'complete' || this.#state === 'idle') return;
    try { this.#audioEngine.stop(); } catch {}
    this.#state = 'awaiting-answer';
    this.#emit('stateChange', { state: 'awaiting-answer', timerMode: this.#timerMode });
  }
  
  // Getters
  get state() {
    return this.#state;
  }
  
  get currentQuestion() {
    if (this.#currentQuestionIndex >= this.#questions.length) return null;
    return this.#questions[this.#currentQuestionIndex];
  }
  
  get currentQuestionIndex() {
    return this.#currentQuestionIndex;
  }
  
  get totalQuestions() {
    return this.#questions.length;
  }
  
  get score() {
    return this.#score;
  }
  
  get answers() {
    return [...this.#answers];
  }
  
  // Private: Question playback
  async #playCurrentQuestion() {
    if (this.#currentQuestionIndex >= this.#questions.length) {
      this.#complete();
      return;
    }
    
    const question = this.#questions[this.#currentQuestionIndex];
    
    this.#emit('questionStart', {
      questionIndex: this.#currentQuestionIndex,
      question: question,
      totalQuestions: this.#questions.length
    });
    
    // V1 Test pattern: Set awaiting-answer BEFORE TTS so buttons appear immediately
    // User can answer while question is still being read aloud
    this.#state = 'awaiting-answer';
    this.#emit('questionReady', {
      questionIndex: this.#currentQuestionIndex,
      question: question
    });
    
    // Format question for TTS (add "True/False:" prefix for TF, letter options for MC)
    const formattedQuestion = formatQuestionForSpeech(question);
    
    // Check cache first (instant if pr

### 21. src/app/session/v2/ExercisePhase.jsx (6b789cbbd663e70c5106bcbf156f38dfcdc1142ba3ad3b49bb497f6e65ca1de6)
- bm25: -7.1154 | entity_overlap_w: 3.90 | adjusted: -8.0904 | relevance: 0.8900

// Public API: Recover from a stuck state (e.g. TTS/API timeout).
  // Resets to awaiting-answer so the learner can re-submit without reloading.
  recover() {
    if (this.#state === 'complete' || this.#state === 'idle') return;
    try { this.#audioEngine.stop(); } catch {}
    this.#state = 'awaiting-answer';
    this.#emit('stateChange', { state: 'awaiting-answer', timerMode: this.#timerMode });
  }
  
  // Getters
  get state() {
    return this.#state;
  }
  
  get currentQuestion() {
    if (this.#currentQuestionIndex >= this.#questions.length) return null;
    return this.#questions[this.#currentQuestionIndex];
  }
  
  get currentQuestionIndex() {
    return this.#currentQuestionIndex;
  }
  
  get totalQuestions() {
    return this.#questions.length;
  }
  
  get score() {
    return this.#score;
  }
  
  get answers() {
    return [...this.#answers];
  }
  
  // Private: Question playback
  async #playCurrentQuestion() {
    if (this.#currentQuestionIndex >= this.#questions.length) {
      this.#complete();
      return;
    }
    
    const question = this.#questions[this.#currentQuestionIndex];
    
    this.#emit('questionStart', {
      questionIndex: this.#currentQuestionIndex,
      question: question,
      totalQuestions: this.#questions.length
    });
    
    // V1 Test pattern: Set awaiting-answer BEFORE TTS so buttons appear immediately
    // User can answer while question is still being read aloud
    this.#state = 'awaiting-answer';
    this.#emit('questionReady', {
      questionIndex: this.#currentQuestionIndex,
      question: question
    });
    
    // Format question for TTS (add "True/False:" prefix for TF, letter options for MC)
    const formattedQuestion = formatQuestionForSpeech(question);
    
    // Check cache first (instant if pr

### 22. src/app/session/v2/WorksheetPhase.jsx (a7cffa3aefd8a6823c2a296e048abbed5cafc43a715784d9a4d912f2f2675760)
- bm25: -7.1154 | entity_overlap_w: 3.90 | adjusted: -8.0904 | relevance: 0.8900

// Public API: Recover from a stuck state (e.g. TTS/API timeout).
  // Resets to awaiting-answer so the learner can re-submit without reloading.
  recover() {
    if (this.#state === 'complete' || this.#state === 'idle') return;
    try { this.#audioEngine.stop(); } catch {}
    this.#state = 'awaiting-answer';
    this.#emit('stateChange', { state: 'awaiting-answer', timerMode: this.#timerMode });
  }
  
  // Getters
  get state() {
    return this.#state;
  }
  
  get currentQuestion() {
    if (this.#currentQuestionIndex >= this.#questions.length) return null;
    return this.#questions[this.#currentQuestionIndex];
  }
  
  get currentQuestionIndex() {
    return this.#currentQuestionIndex;
  }
  
  get totalQuestions() {
    return this.#questions.length;
  }
  
  get score() {
    return this.#score;
  }
  
  get answers() {
    return [...this.#answers];
  }
  
  // Private: Question playback
  async #playCurrentQuestion() {
    if (this.#currentQuestionIndex >= this.#questions.length) {
      this.#complete();
      return;
    }
    
    const question = this.#questions[this.#currentQuestionIndex];
    
    this.#emit('questionStart', {
      questionIndex: this.#currentQuestionIndex,
      question: question,
      totalQuestions: this.#questions.length
    });
    
    // V1 Test pattern: Set awaiting-answer BEFORE TTS so input appears immediately
    // User can answer while question is still being read aloud
    this.#state = 'awaiting-answer';
    this.#emit('questionReady', {
      questionIndex: this.#currentQuestionIndex,
      question: question
    });
    
    // Format question for TTS (add "True/False:" prefix for TF, letter options for MC)
    const formattedQuestion = formatQuestionForSpeech(question);
    
    // Check cache first (instant if pre

### 23. src/app/session/page.js (d88d380ce5fc39f499f62a9422ce73dd0cb010fef13d02e528caf6a088b14695)
- bm25: -7.7383 | entity_overlap_w: 1.30 | adjusted: -8.0633 | relevance: 0.8897

// Disable sending when the UI is not ready or while Ms. Sonoma is speaking
  const comprehensionAwaitingBegin = (phase === 'comprehension' && subPhase === 'comprehension-start');
  // Allow answering Test items while TTS is still playing so buttons appear immediately
  const speakingLock = (phase === 'test' && subPhase === 'test-active') ? false : !!isSpeaking;
  // Derived gating: when Opening/Go buttons are visible, keep input inactive without mutating canSend
  const discussionButtonsVisible = (
    phase === 'discussion' &&
    subPhase === 'awaiting-learner' &&
    (!isSpeaking || captionsDone) &&
    showOpeningActions &&
    askState === 'inactive' &&
    riddleState === 'inactive' &&
    poemState === 'inactive' &&
    fillInFunState === 'inactive'
  );
  const inQnAForButtons = (
    (phase === 'comprehension' && subPhase === 'comprehension-active') ||
    (phase === 'exercise' && (subPhase === 'exercise-start' || subPhase === 'exercise-active')) ||
    (phase === 'worksheet' && subPhase === 'worksheet-active') ||
    (phase === 'test' && subPhase === 'test-active')
  );
  const qnaButtonsVisible = (
    inQnAForButtons && !isSpeaking && showOpeningActions &&
    askState === 'inactive' && riddleState === 'inactive' && poemState === 'inactive' && storyState === 'inactive' && fillInFunState === 'inactive'
  );
  const buttonsGating = discussionButtonsVisible || qnaButtonsVisible;
  // Story and Fill-in-Fun input should also respect the speaking lock
  const storyInputActive = (storyState === 'awaiting-turn' || storyState === 'awaiting-setup');
  const fillInFunInputActive = (fillInFunState === 'collecting-words');
  const sendDisabled = (storyInputActive || fillInFunInputActive) ? (!canSend || loading || speakingLock) : (!canSend || loading || comprehensionAwai

### 24. src/app/session/components/games/FlashCards.jsx (ec94be9fd474a44aaa0e7fa05a024bb3eb8ffed9c7ee0d20bfb48debd13b38e8)
- bm25: -7.8948 | relevance: 0.8876

{/* Header — hidden in compact (landscape + keyboard open) */}
      {!compact && (
        <div style={{ ...headerRow, flexShrink: 0 }}>
          <button type="button" style={softBtn} onClick={onBack}>← Back</button>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#111827' }}>Flash Cards</div>
          <button type="button" style={softBtn} onClick={() => setScreen('setup')}>Setup</button>
        </div>
      )}

### 25. docs/brain/ingests/pack.lesson-schedule-debug.md (fc4e4de5650ee90da2a8b005fd31a195984e17de3bd73aa34ae24cafb3cc2b56)
- bm25: -7.4929 | entity_overlap_w: 1.30 | adjusted: -7.8179 | relevance: 0.8866

### 27. docs/brain/MentorInterceptor_Architecture.md (ce3cd9684410622160fbad2779f03dd2313cb09bba1ed5ffcd42179724e742c6)
- bm25: -18.2995 | relevance: 1.0000

```
User types message
    ↓
CounselorClient.sendMessage()
    ↓
Load allLessons (subjects → lessons object)
    ↓
interceptor.process(message, { allLessons, selectedLearnerId, learnerName, conversationHistory })
    ↓
  interceptResult.handled?
    ↓
  YES → Handle front-end
    ↓
    Add user + bot messages to conversationHistory
    Display response in captions
    Play TTS audio
    Execute action if present (schedule/generate/edit)
    Return (skip API)
    ↓
  NO → Forward to API
    ↓
    Call /api/counselor with forwardMessage
    Process tool calls, follow-ups, etc
    Add messages to conversationHistory
    Display response in captions
    Play audio
    Track tokens
```

### 28. docs/brain/MentorInterceptor_Architecture.md (dc556c7376cde3ba88cd25eb33ded16070fc7f857b6aa9cdc6f084406064936f)
- bm25: -18.0216 | relevance: 1.0000

**State transitions:**
- Intent detected → Enter flow, gather params
- Param missing → Ask question, set awaitingInput
- All params present → Confirm, set awaitingConfirmation
- Confirmed → Execute action, reset state
- Declined → Reset state, ask how to help

### Confirmation Detection

**Yes patterns:**
```javascript
['yes', 'yep', 'yeah', 'yup', 'sure', 'ok', 'okay', 'confirm', 
 'go ahead', 'do it', 'please', 'absolutely']
```

**No patterns:**
```javascript
['no', 'nope', 'nah', 'not now', 'cancel', 'stop', 'wait', 
 'hold on', 'nevermind']
```

**Normalization:**
- Single-token matching (no spaces)
- Case-insensitive
- Returns 'yes', 'no', or null (unclear)

## Flow Implementations

### 1. Search Flow

### 26. src/app/api/tts/route.js (d93cecdec713c348f16222463b4ea44f88d56f49da5d9180865cc5c62e2ac630)
- bm25: -7.1503 | entity_overlap_w: 2.60 | adjusted: -7.8003 | relevance: 0.8864

// Simple TTS-only route: synthesize provided text to MP3 base64 using Google Cloud TTS
// Reuses the same credential loading approach as /api/sonoma

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import textToSpeech from '@google-cloud/text-to-speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const { TextToSpeechClient } = textToSpeech
let ttsClientPromise

const DEFAULT_VOICE = {
  languageCode: 'en-GB',
  name: 'en-GB-Neural2-F',
  ssmlGender: 'FEMALE'
}

const AUDIO_CONFIG = {
  audioEncoding: 'MP3',
  speakingRate: 0.92
}

function decodeCredentials(raw) {
  if (!raw) return null
  try { return JSON.parse(raw) } catch {}
  try { const decoded = Buffer.from(raw, 'base64').toString('utf8'); return JSON.parse(decoded) } catch {}
  return null
}

function loadTtsCredentials() {
  const inline = process.env.GOOGLE_TTS_CREDENTIALS
  const inlineCreds = decodeCredentials(inline)
  if (inlineCreds) return inlineCreds
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'google-tts-key.json')
  try {
    if (credentialPath && fs.existsSync(credentialPath)) {
      const raw = fs.readFileSync(credentialPath, 'utf8').trim()
      if (raw) return decodeCredentials(raw) || JSON.parse(raw)
    }
  } catch (err) {
    // Failed to load Google credentials
  }
  return null
}

### 27. src/app/facilitator/generator/counselor/CounselorClient.jsx (eeee8bf62119b0a3950c8ae02dfea3b24db32aa02bec35def65e5acb416bfe08)
- bm25: -7.0812 | entity_overlap_w: 2.60 | adjusted: -7.7312 | relevance: 0.8855

interceptResult.response = `Ok. I\'m opening the Lesson Planner and generating a ${action.durationMonths}-month plan starting ${action.startDate}.`
          }
        }
        
        // Add interceptor response to conversation
        const finalHistory = [
          ...updatedHistory,
          { role: 'assistant', content: interceptResult.response }
        ]
        setConversationHistory(finalHistory)
        
        // Display interceptor response in captions
        setCaptionText(interceptResult.response)
        const sentences = splitIntoSentences(interceptResult.response)
        setCaptionSentences(sentences)
        setCaptionIndex(0)
        
        // Play TTS for interceptor response (Mr. Mentor's voice)
        setLoadingThought("Preparing response...")
        try {
          const ttsResponse = await fetch('/api/mentor-tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: interceptResult.response })
          })
          
          if (ttsResponse.ok) {
            const ttsData = await ttsResponse.json()
            if (ttsData.audio) {
              // Never block the UI on audio playback.
              void playAudio(ttsData.audio)
            }
          }
        } catch (err) {
          // Silent TTS error - don't block UX
        }
        
        setLoading(false)
        setLoadingThought(null)
        return
      }
      
      // Interceptor didn't handle - forward to API
      setLoadingThought("Consulting my knowledge base...")
      const forwardMessage = interceptResult.apiForward?.message || message
      const finalForwardMessage = declineNote ? `${forwardMessage}\n\n${declineNote}` : forwardMessage
      const forwardContext = interceptResult

### 28. docs/brain/story-feature.md (4603df0d8f12c8d9a3768664d12764d9c500ce470ef136e6ea6a98ef898e946f)
- bm25: -7.6372 | relevance: 0.8842

## State Variables

Location: `page.js`

```javascript
const [storySetupStep, setStorySetupStep] = useState('') // 'characters' | 'setting' | 'plot' | 'complete'
const [storyCharacters, setStoryCharacters] = useState('')
const [storySetting, setStorySetting] = useState('')
const [storyPlot, setStoryPlot] = useState('')
const [storyPhase, setStoryPhase] = useState('') // Tracks which phase story started in
const [storyState, setStoryState] = useState('inactive') // 'inactive' | 'awaiting-setup' | 'awaiting-turn' | 'ending'
const [storyTranscript, setStoryTranscript] = useState([]) // Full story history
```

## Handler Functions

Location: `useDiscussionHandlers.js`

### handleStoryStart
- Checks if `storyTranscript` has content
- **If continuing**: Reminds where story left off, asks for next part
- **If new**: Initiates setup phase asking for characters

### handleStoryYourTurn
- Handles all story input including setup and continuation
- **Setup phase**: Collects characters → setting → plot → generates first part
- **Continuation phase**: 
  - Sends full transcript history to maintain context
  - Generates next part with "To be continued."
- **Test phase**: 
  - Asks for ending preference
  - Generates final part with "The end."
  - Clears story data for next session

## User Experience Flow

### First Story Creation
1. Child clicks "Story" button
2. Ms. Sonoma: "Who are the characters in the story?"
3. Child: "A dragon and a princess"
4. Ms. Sonoma: "Where does the story take place?"
5. Child: "In a castle"
6. Ms. Sonoma: "What happens in the story?"
7. Child: "The dragon helps the princess"
8. Ms. Sonoma: *Tells first part* "Once upon a time, a dragon and a princess met in a castle. The dragon wanted to help the princess with her problem. To be continued."

### 29. src/app/session/page.js (6bd382b171112f0c2a572abcd8d43d23f4089c0a05bf7156e5d4954f778455fe)
- bm25: -6.5542 | entity_overlap_w: 3.90 | adjusted: -7.5292 | relevance: 0.8828

// isSpeaking/phase/subPhase defined earlier; do not redeclare here
  const [transcript, setTranscript] = useState("");
  // Start with loading=true so the existing overlay spinner shows during initial restore
  const [loading, setLoading] = useState(true);
  // TTS overlay: track TTS fetch activity separately; overlay shows when either API or TTS is loading
  const [ttsLoadingCount, setTtsLoadingCount] = useState(0);
  const overlayLoading = loading || (ttsLoadingCount > 0);

### 30. docs/brain/MentorInterceptor_Architecture.md (7cfd131ea36bbee64c89e221bffc0ef04e7197b8816e1613bcb1dc1d431d339f)
- bm25: -7.1668 | entity_overlap_w: 1.30 | adjusted: -7.4918 | relevance: 0.8822

# MentorInterceptor Architecture

**Created:** November 17, 2025  
**Status:** Deployed and active in Mr. Mentor counselor UI  
**Commits:** 6890d3b → ab3fed4

## Purpose

Front-end conversation handler for Mr. Mentor that intercepts user messages to:
- Provide instant responses without API calls where possible
- Gather parameters through multi-turn Q&A before executing actions
- Create confirmation flows for all actions (schedule, generate, edit)
- Make front-end and back-end handling indistinguishable to users
- Reduce API costs and improve responsiveness

## Architecture

### File Structure

- **MentorInterceptor.js** (995 lines)
  - Intent detection engine with fuzzy matching
  - Parameter extraction (grade, subject, difficulty, date)
  - Conversation state machine
  - Multi-turn parameter gathering
  - Confirmation workflows
  - Lesson search algorithm with scoring
  - Action execution handlers

- **CounselorClient.jsx** (integration)
  - Instantiates interceptor on mount
  - Calls `interceptor.process()` before API
  - Handles interceptor responses (TTS, captions, conversation history)
  - Executes interceptor actions (schedule, generate, edit)
  - Falls back to API when interceptor doesn't handle

### 31. docs/brain/riddle-system.md (ae2321e7086261f3e5b2eaf607b46e848c65c93273f6674224f4718b92f00026)
- bm25: -7.1466 | entity_overlap_w: 1.30 | adjusted: -7.4716 | relevance: 0.8820

---

## What NOT To Do

### ❌ Don't Generate Riddles via AI
The system is **intentionally static**. Adding AI generation would:
- Create quality inconsistencies
- Risk inappropriate content slipping through
- Add latency and API costs
- Break offline functionality

### ❌ Don't Use Riddles as Comprehension Tests
Riddles are **warm-up fun**, not assessment. They:
- Have single answers (not open-ended)
- Reward lateral thinking (not lesson content mastery)
- Are optional enrichment (not required learning)

### ❌ Don't Add Riddles Without Validation
Every riddle must pass the checklist:
- [ ] Wordplay or misdirection present
- [ ] Single clear answer (no ambiguity)
- [ ] Age-appropriate (6-12 year olds)
- [ ] Subject-relevant (if not in 'general')
- [ ] Fair clues (solvable without guessing)
- [ ] Surprise factor (smile, groan, or "aha!")

### ❌ Don't Mix Quiz Questions into Riddles
**Bad**: "How many cents are in a quarter?" (factual recall)  
**Good**: "I am a coin that is one fourth of a dollar, but I hold much more inside - count them all! How many pennies hide in me?" (wordplay + math)

---

## Current Integration Status

### ✅ Riddles Are Active

Riddles are fully integrated into the discussion phase opening actions:

**User Flow:**
1. Learner enters discussion phase
2. Opening actions menu displays (Ask, Riddle, Poem, Story, Fill-in-Fun, Games)
3. User clicks "Riddle" button
4. `pickNextRiddle(subject)` selects riddle from localStorage rotation
5. Riddle presents with TTS playback
6. State machine handles: 'presented' → 'awaiting-solve' → 'inactive'

### 32. docs/brain/v2-architecture.md (bc99e4b71f540c7bf37fdef5f564161060387111ec7a1c9304f9cd3ccfe6fd49)
- bm25: -6.4333 | entity_overlap_w: 3.90 | adjusted: -7.4083 | relevance: 0.8811

**Retry + Rate Limit Handling:**
- If GPT returns 429, TeachingController enters a cooldown and produces a deterministic "wait then press Next" sentence
- If GPT returns 500+ (or the fetch throws), TeachingController shows a generic server error message (not rate limit)
- When a non-429 error message is shown, the next Next/Repeat/Restart action triggers an actual retry fetch (instead of advancing past the error sentence and effectively skipping the stage)
- Next/Repeat/Restart must not spam GPT requests during cooldown
- Public methods called without `await` (Repeat/Skip/Restart) must not generate unhandled promise rejections

**Environment Variable Requirements:**
- At least one LLM provider key must be configured: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- Google TTS requires: `GOOGLE_APPLICATION_CREDENTIALS` (path to JSON file) or `GOOGLE_TTS_CREDENTIALS` (inline JSON or base64)
- Dev server must be restarted after adding/changing `.env.local` to load new environment variables
- Missing keys cause 500 errors (not 429s); TeachingController now distinguishes these in user-facing messages

**Gate Prompt Flow (uses prefetched content):**
1. Speak "Do you have any questions?" (TTS prefetched)
2. Await prefetched GPT result (usually instant)
3. Speak GPT-generated sample questions (TTS prefetched)
4. Fallback if GPT failed: deterministic questions using lesson title

**Exposes:**
- `prefetchAll()` - start all background prefetches (call on Begin)
- `startTeaching(lessonData)`
- `advanceSentence()`
- `repeatSentence()`
- `skipToExamples()`
- Events: `onStageChange`, `onSentenceAdvance`, `onTeachingComplete`

### 33. docs/brain/story-feature.md (7c541082fb751d8b6d7c2be9019d9fcda07911dd69b371791d357908ef1d85e5)
- bm25: -7.2235 | relevance: 0.8784

### Story Ending
1. Child clicks "Story" button
2. Ms. Sonoma: **Briefly recounts** (first sentence only): "Together they spotted a sparkly treasure chest below."
3. Ms. Sonoma: "How would you like the story to end?"
4. Child describes ending
5. Ms. Sonoma: *Concludes story* "...and they lived happily ever after. The end."

## Key Files

- `page.js` - Story state variables
- `useDiscussionHandlers.js` - Story handlers (handleStoryStart, handleStoryYourTurn)
- `/api/sonoma/route.js` - Story generation API

## What NOT To Do

- Never reset storyTranscript between phases (preserve continuity)
- Never reset storyUsedThisGate between phases (one story per gate)
- Never skip setup phase on first story creation
- Never allow freeform story generation without setup (use template-based approach)
- Never forget to clear story data after "The end." in Test phase

### 34. docs/brain/ingests/pack.md (11dd454c999b4865481c24140fda5f8f8a6ef46b4cf3d0a70ba94921e7c2655c)
- bm25: -7.1209 | relevance: 0.8769

**API Response Structure:**
- `/api/medals` returns object directly: `{lessonId: {bestPercent: 85}, ...}`
- `/api/lesson-schedule` returns wrapper: `{schedule: [...]}`
- `/api/planned-lessons` returns wrapper: `{plannedLessons: {...}}`

### 35. src/app/api/counselor/route.js (86a4ead5f24d3e066223ffc9afb48afe1a5b76912ee87576c502487a9e7cd4eb)
- bm25: -6.4496 | entity_overlap_w: 2.60 | adjusted: -7.0996 | relevance: 0.8765

function loadTtsCredentials() {
  const inline = process.env.GOOGLE_TTS_CREDENTIALS
  const inlineCreds = decodeCredentials(inline)
  if (inlineCreds) return inlineCreds

const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'google-tts-key.json')
  try {
    if (credentialPath && fs.existsSync(credentialPath)) {
      const raw = fs.readFileSync(credentialPath, 'utf8').trim()
      if (raw) return decodeCredentials(raw) || JSON.parse(raw)
    }
  } catch (fileError) {
    // Credentials load failed - TTS will be unavailable
  }
  return null
}

async function getTtsClient() {
  if (ttsClientPromise) return ttsClientPromise

const credentials = loadTtsCredentials()
  if (!credentials) {
    // No credentials - voice playback disabled
    return null
  }

ttsClientPromise = (async () => {
    try {
      return new TextToSpeechClient({ credentials })
    } catch (error) {
      // TTS client init failed
      ttsClientPromise = undefined
      return null
    }
  })()

ttsClientPromise.catch(() => { ttsClientPromise = undefined })
  return ttsClientPromise
}

function createCallId() {
  const timePart = Date.now().toString(36)
  const randomPart = Math.random().toString(36).slice(2, 8)
  return `${timePart}-${randomPart}`
}

function pushToolLog(toolLog, entry) {
  if (!Array.isArray(toolLog)) return
  const message = buildToolLogMessage(entry?.name, entry?.phase, entry?.context)
  if (!message) return
  toolLog.push({
    id: entry?.id || createCallId(),
    timestamp: Date.now(),
    name: entry?.name,
    phase: entry?.phase,
    message,
    context: entry?.context || {}
  })
}

### 36. docs/brain/calendar-lesson-planning.md (b5fceec1ff172ff9be6e16676dfd040ac9bf511ccfa0190409ecada4fe8df328)
- bm25: -7.0937 | relevance: 0.8764

**Persistence Model:**
- Planned lessons stored in `planned_lessons` table (facilitator_id, learner_id, scheduled_date, lesson_data JSONB)
- Each row = one lesson outline for one date
- Survives page refresh, long absences, logout/login
- Tied to specific facilitator + learner combination
- **POST uses date-specific overwrite**: only deletes/replaces dates included in new plan
- **Multiple non-overlapping plans coexist**: schedule Jan + Mar separately, both persist
- **Overlapping dates are replaced**: reschedule Jan 15-31 overwrites only those dates, Jan 1-14 untouched

**Data Format:**
```javascript
// In-memory format (calendar page state)
plannedLessons = {
  '2025-12-15': [
    { id: '...', title: '...', subject: 'math', grade: '3rd', difficulty: 'intermediate', ... },
    { id: '...', title: '...', subject: 'science', ... }
  ],
  '2025-12-16': [ ... ]
}

// Database format (planned_lessons table)
{
  facilitator_id: 'uuid',
  learner_id: 'uuid',
  scheduled_date: '2025-12-15',
  lesson_data: { id: '...', title: '...', subject: 'math', ... } // JSONB
}
```

### API Endpoints

**`/api/planned-lessons`**
- **GET** `?learnerId=X` - Load all planned lessons for learner, returns `{plannedLessons: {...}}`
- **POST** - Save lesson plan with date-specific overwrite (only replaces dates in new plan), expects `{learnerId, plannedLessons}`
- **DELETE** `?learnerId=X` - Clear all planned lessons for learner

### 37. docs/brain/portfolio-generation.md (b9f7c5628de9ac9db0e3cb746ff2ebf7c89b801b19c3dc93726e4878bdd3cebf)
- bm25: -7.0862 | relevance: 0.8763

- Bucket: `portfolios` (public read)
- Path format:
  - `portfolios/<facilitatorUserId>/<learnerId>/<portfolioId>/index.html`
  - `portfolios/<facilitatorUserId>/<learnerId>/<portfolioId>/manifest.json`
  - Assets (copied scans): `portfolios/<facilitatorUserId>/<learnerId>/<portfolioId>/assets/...`

### 38. src/app/facilitator/calendar/page.js (e95f849f0714c0a8da156f25344f8de763a87688ba944119db66193a8682bfc9)
- bm25: -7.0621 | relevance: 0.8760

export default function CalendarPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true })
  const [pinChecked, setPinChecked] = useState(false)
  const [authToken, setAuthToken] = useState('')
  const [learners, setLearners] = useState([])
  const [selectedLearnerId, setSelectedLearnerId] = useState('')
  const [selectedDate, setSelectedDate] = useState(null)
  const [scheduledLessons, setScheduledLessons] = useState({}) // Format: { 'YYYY-MM-DD': [{...}] }
  const [scheduledForSelectedDate, setScheduledForSelectedDate] = useState([])
  const [plannedLessons, setPlannedLessons] = useState({}) // Format: { 'YYYY-MM-DD': [{...}] }
  const [loading, setLoading] = useState(true)
  const [tier, setTier] = useState('free')
  const [canPlan, setCanPlan] = useState(false)
  const [tableExists, setTableExists] = useState(true)
  const [rescheduling, setRescheduling] = useState(null) // Track which lesson is being rescheduled
  const [activeTab, setActiveTab] = useState('scheduler') // 'scheduler' or 'planner'
  const [showDayView, setShowDayView] = useState(false)
  const [noSchoolDates, setNoSchoolDates] = useState({}) // Format: { 'YYYY-MM-DD': 'reason' }

### 39. docs/brain/ingests/pack.lesson-schedule-debug.md (56a6f88e611ad532dfc1606ac49942881cd6fd9766c2e6d8261e4538592b3a1a)
- bm25: -6.6578 | entity_overlap_w: 1.30 | adjusted: -6.9828 | relevance: 0.8747

### 5. docs/brain/MentorInterceptor_Architecture.md (7cfd131ea36bbee64c89e221bffc0ef04e7197b8816e1613bcb1dc1d431d339f)
- bm25: -23.0920 | relevance: 1.0000

# MentorInterceptor Architecture

**Created:** November 17, 2025  
**Status:** Deployed and active in Mr. Mentor counselor UI  
**Commits:** 6890d3b → ab3fed4

## Purpose

Front-end conversation handler for Mr. Mentor that intercepts user messages to:
- Provide instant responses without API calls where possible
- Gather parameters through multi-turn Q&A before executing actions
- Create confirmation flows for all actions (schedule, generate, edit)
- Make front-end and back-end handling indistinguishable to users
- Reduce API costs and improve responsiveness

## Architecture

### File Structure

- **MentorInterceptor.js** (995 lines)
  - Intent detection engine with fuzzy matching
  - Parameter extraction (grade, subject, difficulty, date)
  - Conversation state machine
  - Multi-turn parameter gathering
  - Confirmation workflows
  - Lesson search algorithm with scoring
  - Action execution handlers

- **CounselorClient.jsx** (integration)
  - Instantiates interceptor on mount
  - Calls `interceptor.process()` before API
  - Handles interceptor responses (TTS, captions, conversation history)
  - Executes interceptor actions (schedule, generate, edit)
  - Falls back to API when interceptor doesn't handle

### 6. docs/brain/calendar-lesson-planning.md (edc4501d8cf5402f28f2f259c81317facde5d8c4d278692219fb856850a029d8)
- bm25: -23.0310 | relevance: 1.0000

- `src/app/facilitator/calendar/LessonNotesModal.jsx`
  - Minimal notes editor for `learners.lesson_notes[lesson_key]`
  - Empty note deletes the key from the JSONB map

### 40. src/app/api/counselor/route.js (4b58708eb47ed1de9e7a26238dee9e62257fd2e2141f45a4217d285b84afd1b8)
- bm25: -6.8440 | relevance: 0.8725

assign_lesson: {
      name: 'assign_lesson',
      purpose: 'Assign a lesson to a learner so it shows up as available (not scheduled on a date)',
      when_to_use: 'When facilitator asks to assign a lesson, make it available, or show it to a learner without choosing a date',
      parameters: {
        learnerName: 'Required. The learner\'s name (e.g., "Emma"). The system will find the matching learner.',
        lessonKey: 'Required. Format: "subject/filename.json" (from search results or after generating).',
        lessonTitle: 'Optional. Human-readable title for confirmation (if known). If unknown, call get_lesson_details first.'
      },
      returns: 'Success confirmation with learner name and lesson key',
      notes: 'Use assign_lesson when the user says "assign" and does not request a calendar date. For calendar placement, use schedule_lesson.',
      example: 'Assign for Emma: {learnerName: "Emma", lessonKey: "math/Multiplication_Basics.json"}'
    },
    
    edit_lesson: {
      name: 'edit_lesson',
      purpose: 'Modify an existing lesson (works on ALL lessons: installed subjects like math/science AND facilitator-created lessons)',
      when_to_use: 'When facilitator asks to change/fix/update/edit a lesson, correct errors, add vocabulary, improve questions, etc.',
      parameters: {
        lessonKey: 'Required. Format: "subject/filename.json" (from search results)',
        updates: 'Required. Object with fields to update. Can include: title, blurb, teachingNotes, vocab (array of {term, definition}), truefalse, multiplechoice, shortanswer, fillintheblank (arrays of questions)'
      },
      returns: 'Success confirmation that lesson was updated',
      notes: 'Can edit ANY lesson - both pre-installed subject lessons AND custom facilitator lessons. G


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
