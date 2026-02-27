# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Generation Failed error from lesson generator API route - investigate callModel and storage upload
```

Filter terms used:
```text
API
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

API

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/ingests/pack.lesson-schedule-debug.md (fa02942af206a27ad23c2e1ee23975650152df2f5e09e9374905dc45a475c12e)
- bm25: -1.8901 | entity_overlap_w: 7.80 | adjusted: -3.8401 | relevance: 1.0000

### ❌ DON'T: Require medals API to succeed for generation to continue
**Why**: Medals API returns 404 for new learners with no completed lessons, or during database migrations. Lesson planning must continue even without score data.

### ❌ DON'T: Use wrong API endpoint patterns
**Why**: API routes follow specific conventions:
- `/api/medals?learnerId=X` (correct)
- `/api/learner/medals?learnerId=X` (wrong, returns 404)

Check actual route files, not assumptions.

### ❌ DON'T: Couple unrelated API responses with `&&` in conditionals
**Why**: `if (historyRes.ok && medalsRes.ok)` blocks history processing when medals fails. Process each response independently with its own conditional.

### ❌ DON'T: Forget to handle API response wrapper objects
**Why**: Some APIs return raw arrays, others return `{data: [...]}` or `{schedule: [...]}`. Always check the route to see actual response structure. Using `.map()` on a wrapper object causes "not a function" errors.

### 16. src/app/facilitator/generator/counselor/MentorInterceptor.js (bb7713ee24ede35cb49f6b75db4614268ed8f95e614cb684dba03e123ad3ecf4)
- bm25: -21.1441 | relevance: 1.0000

### 2. docs/brain/ingests/pack.planned-lessons-flow.md (fec1a515684d5e019fff779fa3f8d5eaffc180a5b0f963e36e8bc20a447a2714)
- bm25: -1.7961 | entity_overlap_w: 7.80 | adjusted: -3.7461 | relevance: 1.0000

**Rule**:
- Only add access guards on interactive handlers (e.g., `onClick`, submit handlers), or in the called function (e.g., `generatePlannedLessons()` already calls `requirePlannerAccess()`).
- Do not splice guard blocks into JSX without confirming the opening tag still exists.

### ❌ DON'T: Store planned lessons only in component state
**Why**: Component state clears on refresh, logout, or navigation. User loses entire generated plan. Creates terrible UX where plans disappear unpredictably.

### ❌ DON'T: Require medals API to succeed for generation to continue
**Why**: Medals API returns 404 for new learners with no completed lessons, or during database migrations. Lesson planning must continue even without score data.

### ❌ DON'T: Use wrong API endpoint patterns
**Why**: API routes follow specific conventions:
- `/api/medals?learnerId=X` (correct)
- `/api/learner/medals?learnerId=X` (wrong, returns 404)

Check actual route files, not assumptions.

### ❌ DON'T: Couple unrelated API responses with `&&` in conditionals
**Why**: `if (historyRes.ok && medalsRes.ok)` blocks history processing when medals fails. Process each response independently with its own conditional.

### ❌ DON'T: Forget to handle API response wrapper objects
**Why**: Some APIs return raw arrays, others return `{data: [...]}` or `{schedule: [...]}`. Always check the route to see actual response structure. Using `.map()` on a wrapper object causes "not a function" errors.

### 18. src/app/facilitator/calendar/LessonPlanner.jsx (bbc18a96e8e74f641a8270bf1cf9fd128312a7fadd6f6f9216546afe6ad539e8)
- bm25: -19.2572 | relevance: 1.0000

### 3. docs/brain/calendar-lesson-planning.md (ca128987408f6009b4bc0b991a9c397f7bb90b4e589d5d04580e78c782af275e)
- bm25: -1.7480 | entity_overlap_w: 7.80 | adjusted: -3.6980 | relevance: 1.0000

## What NOT To Do

### ❌ DON'T: Break JSX tags during gating edits
**Why**: A malformed JSX tag (for example, accidentally deleting a `<select` opening tag while moving click-guards) will compile in dev only until the file is imported, then fail the production build with parser errors like "Unexpected token" near a bare `>`.

**Rule**:
- Only add access guards on interactive handlers (e.g., `onClick`, submit handlers), or in the called function (e.g., `generatePlannedLessons()` already calls `requirePlannerAccess()`).
- Do not splice guard blocks into JSX without confirming the opening tag still exists.

### ❌ DON'T: Store planned lessons only in component state
**Why**: Component state clears on refresh, logout, or navigation. User loses entire generated plan. Creates terrible UX where plans disappear unpredictably.

### ❌ DON'T: Require medals API to succeed for generation to continue
**Why**: Medals API returns 404 for new learners with no completed lessons, or during database migrations. Lesson planning must continue even without score data.

### ❌ DON'T: Use wrong API endpoint patterns
**Why**: API routes follow specific conventions:
- `/api/medals?learnerId=X` (correct)
- `/api/learner/medals?learnerId=X` (wrong, returns 404)

Check actual route files, not assumptions.

### ❌ DON'T: Couple unrelated API responses with `&&` in conditionals
**Why**: `if (historyRes.ok && medalsRes.ok)` blocks history processing when medals fails. Process each response independently with its own conditional.

### ❌ DON'T: Forget to handle API response wrapper objects
**Why**: Some APIs return raw arrays, others return `{data: [...]}` or `{schedule: [...]}`. Always check the route to see actual response structure. Using `.map()` on a wrapper object causes "not a function" errors.

### 4. docs/brain/ingests/pack.md (237a2deb28c985f662915aee6871b40e583791a8102c8eddfaa3f706b1726b74)
- bm25: -1.7496 | entity_overlap_w: 6.50 | adjusted: -3.3746 | relevance: 1.0000

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

### 5. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (927a36610f2e66911e7ea826ffa802962a757c0ec7b545a69c3fcf9244a1445d)
- bm25: -1.8377 | entity_overlap_w: 5.20 | adjusted: -3.1377 | relevance: 1.0000

**2025-12-15**: Added database persistence for planned lessons
- Created `planned_lessons` table with JSONB lesson_data column
- Created `/api/planned-lessons` route (GET/POST/DELETE)
- Modified calendar page to load planned lessons on mount/learner change
- Added `savePlannedLessons()` that updates state AND persists to database
- Wired `savePlannedLessons` as callback to LessonPlanner
- Planned lessons now survive refresh, long absence, logout/login
- Tied to specific facilitator + learner combination via foreign keys

**2025-12-14**: Fixed medals API 404 causing generation failure
- Changed endpoint from `/api/learner/medals` to `/api/medals`
- Decoupled medals loading from history processing
- Added fallback to empty medals object when API fails
- Generation now succeeds even without medal data

**2025-12-14**: Fixed scheduled lessons API response structure
- API returns `{schedule: [...]}` not raw array
- Changed code to access `scheduledData.schedule` property
- Prevents ".map is not a function" error during context building

### 21. src/app/facilitator/generator/counselor/CounselorClient.jsx (b6e6ebc1dbed05c56ca851c80bcd9e000659d12c23c8c859a044e2daec8d0991)
- bm25: -15.7328 | relevance: 1.0000

### 6. sidekick_pack.md (30549f54be833385d5ba4ee39360ca49e40c21f5e7a28f19d502dd8a670c9c74)
- bm25: -1.7715 | entity_overlap_w: 5.20 | adjusted: -3.0715 | relevance: 1.0000

### 36. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (927a36610f2e66911e7ea826ffa802962a757c0ec7b545a69c3fcf9244a1445d)
- bm25: -11.6021 | relevance: 1.0000

**2025-12-15**: Added database persistence for planned lessons
- Created `planned_lessons` table with JSONB lesson_data column
- Created `/api/planned-lessons` route (GET/POST/DELETE)
- Modified calendar page to load planned lessons on mount/learner change
- Added `savePlannedLessons()` that updates state AND persists to database
- Wired `savePlannedLessons` as callback to LessonPlanner
- Planned lessons now survive refresh, long absence, logout/login
- Tied to specific facilitator + learner combination via foreign keys

**2025-12-14**: Fixed medals API 404 causing generation failure
- Changed endpoint from `/api/learner/medals` to `/api/medals`
- Decoupled medals loading from history processing
- Added fallback to empty medals object when API fails
- Generation now succeeds even without medal data

**2025-12-14**: Fixed scheduled lessons API response structure
- API returns `{schedule: [...]}` not raw array
- Changed code to access `scheduledData.schedule` property
- Prevents ".map is not a function" error during context building

### 21. src/app/facilitator/generator/counselor/CounselorClient.jsx (b6e6ebc1dbed05c56ca851c80bcd9e000659d12c23c8c859a044e2daec8d0991)
- bm25: -15.7328 | relevance: 1.0000

### 37. docs/brain/beta-program.md (cae6df5d6046a2f57313f44becea8e960b732d9849e6bb3963232d991ff6fd57)
- bm25: -11.5924 | relevance: 1.0000

### Never Block Non-Beta Users
- Tutorials are optional for non-Beta users
- Gates apply only when `subscription_tier == 'Beta'`

### 7. docs/brain/calendar-lesson-planning.md (5099a67314b21b85fa6a8156e8fd0f3b3e8f5c4ec53943e5cc4e0d17890d9adb)
- bm25: -1.7686 | entity_overlap_w: 5.20 | adjusted: -3.0686 | relevance: 1.0000

**2025-12-15**: Added adaptive difficulty progression
- Analyzes last 6 completed lessons to calculate recommended difficulty
- Moves up to advanced if avg ≥80-85% and appropriate current level
- Moves down to beginner if avg ≤65%, or to intermediate if avg ≤70% while at advanced
- Defaults to intermediate with <3 completed lessons
- Enhanced GPT instructions with "Curriculum Evolution Guidelines" and anti-repetition directives

**2025-12-15**: Added database persistence for planned lessons
- Created `planned_lessons` table with JSONB lesson_data column
- Created `/api/planned-lessons` route (GET/POST/DELETE)
- Modified calendar page to load planned lessons on mount/learner change
- Added `savePlannedLessons()` that updates state AND persists to database
- Wired `savePlannedLessons` as callback to LessonPlanner
- Planned lessons now survive refresh, long absence, logout/login
- Tied to specific facilitator + learner combination via foreign keys

**2025-12-14**: Fixed medals API 404 causing generation failure
- Changed endpoint from `/api/learner/medals` to `/api/medals`
- Decoupled medals loading from history processing
- Added fallback to empty medals object when API fails
- Generation now succeeds even without medal data

**2025-12-14**: Fixed scheduled lessons API response structure
- API returns `{schedule: [...]}` not raw array
- Changed code to access `scheduledData.schedule` property
- Prevents ".map is not a function" error during context building

### 8. docs/brain/ingests/pack.planned-lessons-flow.md (e074ed398bef57bf4187388697ee43b3d448308b1f50fb9269c99a3bb6ab5e3c)
- bm25: -1.7338 | entity_overlap_w: 5.20 | adjusted: -3.0338 | relevance: 1.0000

### 2. docs/brain/calendar-lesson-planning.md (5099a67314b21b85fa6a8156e8fd0f3b3e8f5c4ec53943e5cc4e0d17890d9adb)
- bm25: -33.5881 | entity_overlap_w: 3.50 | adjusted: -34.4631 | relevance: 1.0000

**2025-12-15**: Added adaptive difficulty progression
- Analyzes last 6 completed lessons to calculate recommended difficulty
- Moves up to advanced if avg ≥80-85% and appropriate current level
- Moves down to beginner if avg ≤65%, or to intermediate if avg ≤70% while at advanced
- Defaults to intermediate with <3 completed lessons
- Enhanced GPT instructions with "Curriculum Evolution Guidelines" and anti-repetition directives

**2025-12-15**: Added database persistence for planned lessons
- Created `planned_lessons` table with JSONB lesson_data column
- Created `/api/planned-lessons` route (GET/POST/DELETE)
- Modified calendar page to load planned lessons on mount/learner change
- Added `savePlannedLessons()` that updates state AND persists to database
- Wired `savePlannedLessons` as callback to LessonPlanner
- Planned lessons now survive refresh, long absence, logout/login
- Tied to specific facilitator + learner combination via foreign keys

**2025-12-14**: Fixed medals API 404 causing generation failure
- Changed endpoint from `/api/learner/medals` to `/api/medals`
- Decoupled medals loading from history processing
- Added fallback to empty medals object when API fails
- Generation now succeeds even without medal data

**2025-12-14**: Fixed scheduled lessons API response structure
- API returns `{schedule: [...]}` not raw array
- Changed code to access `scheduledData.schedule` property
- Prevents ".map is not a function" error during context building

### 9. docs/brain/ingests/pack.lesson-schedule-debug.md (12989ad8d07322ac9f6432c7f1b12df965613cda4dca19e643cdb09dba0e6e92)
- bm25: -1.7155 | entity_overlap_w: 5.20 | adjusted: -3.0155 | relevance: 1.0000

### Manual Scheduling: "Add Lessons" Picker

The Calendar page includes an "Add Lessons" panel for manually assigning lesson files to specific dates.

### 23. docs/brain/calendar-lesson-planning.md (5099a67314b21b85fa6a8156e8fd0f3b3e8f5c4ec53943e5cc4e0d17890d9adb)
- bm25: -18.7846 | relevance: 1.0000

**2025-12-15**: Added adaptive difficulty progression
- Analyzes last 6 completed lessons to calculate recommended difficulty
- Moves up to advanced if avg ≥80-85% and appropriate current level
- Moves down to beginner if avg ≤65%, or to intermediate if avg ≤70% while at advanced
- Defaults to intermediate with <3 completed lessons
- Enhanced GPT instructions with "Curriculum Evolution Guidelines" and anti-repetition directives

**2025-12-15**: Added database persistence for planned lessons
- Created `planned_lessons` table with JSONB lesson_data column
- Created `/api/planned-lessons` route (GET/POST/DELETE)
- Modified calendar page to load planned lessons on mount/learner change
- Added `savePlannedLessons()` that updates state AND persists to database
- Wired `savePlannedLessons` as callback to LessonPlanner
- Planned lessons now survive refresh, long absence, logout/login
- Tied to specific facilitator + learner combination via foreign keys

**2025-12-14**: Fixed medals API 404 causing generation failure
- Changed endpoint from `/api/learner/medals` to `/api/medals`
- Decoupled medals loading from history processing
- Added fallback to empty medals object when API fails
- Generation now succeeds even without medal data

**2025-12-14**: Fixed scheduled lessons API response structure
- API returns `{schedule: [...]}` not raw array
- Changed code to access `scheduledData.schedule` property
- Prevents ".map is not a function" error during context building

### 10. docs/brain/ingests/pack.lesson-schedule-debug.md (e3dee7047737c4ade92723eaf33d7c14f4f4e7bfc10ef68d963ce7b2cb1040d8)
- bm25: -1.7152 | entity_overlap_w: 5.20 | adjusted: -3.0152 | relevance: 1.0000

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

### 31. docs/brain/MentorInterceptor_Architecture.md (60f07ef2ca6b46ccf29d388c7876adc7209f6ef132ed0c012457179a075de044)
- bm25: -17.6460 | relevance: 1.0000

### Action Execution

**Schedule:**
```javascript
POST /api/facilitator/lessons/schedule
window.dispatchEvent('mr-mentor:lesson-scheduled')
```

**Generate:**
```javascript
setActiveScreen('maker')
// Future: populate maker fields with action data
```

**Edit:**
```javascript
setActiveScreen('lessons')
// Future: open lesson editor with editInstructions
```

### TTS for Interceptor Responses

```javascript
POST /api/text-to-speech
{ text: interceptResult.response }

playAudio(ttsData.audio)
```

Same voice as Mr. Mentor API responses.

### Conversation History

Interceptor responses are added to conversationHistory:

```javascript
[
  { role: 'user', content: 'find 4th grade math lessons' },
  { role: 'assistant', content: 'I found 5 lessons. Which one...' }
]
```

This allows:
- Recall flow to search interceptor conversations
- API to see interceptor context when forwarded
- Continuity across interceptor/API boundary

### Bypass Commands

User can skip interceptor:

### 11. docs/brain/ingests/pack-mentor-intercepts.md (25711d27c508cfb3ccfe0857cf9840f8ee4f0b6ca320336ae4655ec852460047)
- bm25: -1.9834 | entity_overlap_w: 3.90 | adjusted: -2.9584 | relevance: 1.0000

- `src/app/facilitator/generator/counselor/CounselorClient.jsx` - Main Mr. Mentor UI (2831 lines)
- `src/app/facilitator/generator/counselor/ClipboardOverlay.jsx` - Conversation summary overlay
- `src/app/api/mentor-session/route.js` - Session CRUD API (GET/POST/PATCH/DELETE)
- `src/app/api/conversation-drafts/route.js` - Draft summary API
- `src/app/api/conversation-memory/route.js` - Permanent memory API

### 12. docs/brain/mr-mentor-session-persistence.md (c2eb61d278bd75ea3bdaff9b65f83fddd692989bdfe687b11402765ab944edc5)
- bm25: -1.8539 | entity_overlap_w: 3.90 | adjusted: -2.8289 | relevance: 1.0000

**When to Delete `conversation_drafts` Row:**
1. User clicks "Delete" → Delete immediately
2. User clicks "Save" → Delete after successful save to `conversation_updates`

**Atomic Delete (New Conversation):**
```javascript
// Delete BOTH tables atomically
await Promise.all([
  fetch(`/api/mentor-session?sessionId=${sessionId}`, { method: 'DELETE' }),
  fetch(`/api/conversation-drafts?learner_id=${learnerId}`, { method: 'DELETE' })
])
```

---

## What NOT To Do

❌ **Never load conversation_history during polling** - Only during confirmed takeover  
❌ **Never overwrite local conversation without timestamp check** - Use atomic gate  
❌ **Never store draft_summary in mentor_sessions** - Single source in conversation_drafts  
❌ **Never delete is_active=false sessions immediately** - Keep 24h for recovery  
❌ **Never allow >50 turns without forcing overlay** - Degrades AI performance  
❌ **Never skip confirmation on "Delete"** - Use native `confirm()` dialog

---

## Key Files

- `src/app/facilitator/generator/counselor/CounselorClient.jsx` - Main Mr. Mentor UI (2831 lines)
- `src/app/facilitator/generator/counselor/ClipboardOverlay.jsx` - Conversation summary overlay
- `src/app/api/mentor-session/route.js` - Session CRUD API (GET/POST/PATCH/DELETE)
- `src/app/api/conversation-drafts/route.js` - Draft summary API
- `src/app/api/conversation-memory/route.js` - Permanent memory API

### 13. docs/brain/MentorInterceptor_Architecture.md (60f07ef2ca6b46ccf29d388c7876adc7209f6ef132ed0c012457179a075de044)
- bm25: -1.7730 | entity_overlap_w: 3.90 | adjusted: -2.7480 | relevance: 1.0000

### Action Execution

**Schedule:**
```javascript
POST /api/facilitator/lessons/schedule
window.dispatchEvent('mr-mentor:lesson-scheduled')
```

**Generate:**
```javascript
setActiveScreen('maker')
// Future: populate maker fields with action data
```

**Edit:**
```javascript
setActiveScreen('lessons')
// Future: open lesson editor with editInstructions
```

### TTS for Interceptor Responses

```javascript
POST /api/text-to-speech
{ text: interceptResult.response }

playAudio(ttsData.audio)
```

Same voice as Mr. Mentor API responses.

### Conversation History

Interceptor responses are added to conversationHistory:

```javascript
[
  { role: 'user', content: 'find 4th grade math lessons' },
  { role: 'assistant', content: 'I found 5 lessons. Which one...' }
]
```

This allows:
- Recall flow to search interceptor conversations
- API to see interceptor context when forwarded
- Continuity across interceptor/API boundary

### Bypass Commands

User can skip interceptor:

```javascript
['different issue', 'something else', 'nevermind', 'skip']
```

Returns:
```javascript
{
  handled: false,
  apiForward: { 
    message: userMessage, 
    bypassInterceptor: true 
  }
}
```

## Data Structures

### allLessons (from loadAllLessons)

### 14. docs/brain/goals-clipboard.md (6c7fe83e90a7942cbfd98ef8a90715d22a772bbd4c807f6dc85c8f37d1b568ba)
- bm25: -1.7601 | entity_overlap_w: 3.90 | adjusted: -2.7351 | relevance: 1.0000

**`/api/counselor` integration:**
- Request body now includes `goals_notes` field
- System prompt includes: `"PERSISTENT GOALS & PRIORITIES:\n{goals_notes}"`
- Mr. Mentor sees goals in every conversation turn

## Key Files

- `src/app/counselor/CounselorClient.jsx` - Goals button, state management, auto-load on learner switch
- `src/components/GoalsClipboardOverlay.jsx` - Overlay UI component
- `src/app/api/goals-notes/route.js` - Load/save API endpoint
- `src/app/api/counselor/route.js` - Receives goals_notes, includes in system prompt

## What NOT To Do

**DON'T exceed 600 character limit** - UI enforces this but API should validate too. Longer text risks token bloat and poor UX.

**DON'T fail silently on load errors** - If goals fail to load, show user-friendly message. Missing goals can confuse facilitators who expect Mr. Mentor to remember context.

**DON'T forget to clear goals on learner switch** - When learner changes, immediately load new goals. Stale goals = wrong context.

**DON'T make goals optional in API calls** - Always send `goals_notes` field (empty string if none) so Mr. Mentor knows explicitly whether goals exist or not.

### 15. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (9cc323629ddd2145461939a8ea0910f1262ae81d210a78303cc32979399b4a31)
- bm25: -1.7282 | entity_overlap_w: 3.90 | adjusted: -2.7032 | relevance: 1.0000

**`/api/counselor` integration:**
- Request body now includes `goals_notes` field
- System prompt includes: `"PERSISTENT GOALS & PRIORITIES:\n{goals_notes}"`
- Mr. Mentor sees goals in every conversation turn

## Key Files

- `src/app/counselor/CounselorClient.jsx` - Goals button, state management, auto-load on learner switch
- `src/components/GoalsClipboardOverlay.jsx` - Overlay UI component
- `src/app/api/goals-notes/route.js` - Load/save API endpoint
- `src/app/api/counselor/route.js` - Receives goals_notes, includes in system prompt

## What NOT To Do

**DON'T exceed 600 character limit** - UI enforces this but API should validate too. Longer text risks token bloat and poor UX.

**DON'T fail silently on load errors** - If goals fail to load, show user-friendly message. Missing goals can confuse facilitators who expect Mr. Mentor to remember context.

**DON'T forget to clear goals on learner switch** - When learner changes, immediately load new goals. Stale goals = wrong context.

**DON'T make goals optional in API calls** - Always send `goals_notes` field (empty string if none) so Mr. Mentor knows explicitly whether goals exist or not.

### 18. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a69efca9880db84d16bcf2416cead5e30a8ee222c1531e8f6d6ad02cf39c54d3)
- bm25: -17.0642 | relevance: 1.0000

### 16. docs/brain/ingests/pack-mentor-intercepts.md (8b09eea9f3295dcc52f3f4b9bb7d9878bd71a49a32283381d433d7d6821ceb01)
- bm25: -1.7103 | entity_overlap_w: 3.90 | adjusted: -2.6853 | relevance: 1.0000

#### Response Flow

### 8. docs/brain/goals-clipboard.md (6c7fe83e90a7942cbfd98ef8a90715d22a772bbd4c807f6dc85c8f37d1b568ba)
- bm25: -23.7025 | relevance: 1.0000

**`/api/counselor` integration:**
- Request body now includes `goals_notes` field
- System prompt includes: `"PERSISTENT GOALS & PRIORITIES:\n{goals_notes}"`
- Mr. Mentor sees goals in every conversation turn

## Key Files

- `src/app/counselor/CounselorClient.jsx` - Goals button, state management, auto-load on learner switch
- `src/components/GoalsClipboardOverlay.jsx` - Overlay UI component
- `src/app/api/goals-notes/route.js` - Load/save API endpoint
- `src/app/api/counselor/route.js` - Receives goals_notes, includes in system prompt

## What NOT To Do

**DON'T exceed 600 character limit** - UI enforces this but API should validate too. Longer text risks token bloat and poor UX.

**DON'T fail silently on load errors** - If goals fail to load, show user-friendly message. Missing goals can confuse facilitators who expect Mr. Mentor to remember context.

**DON'T forget to clear goals on learner switch** - When learner changes, immediately load new goals. Stale goals = wrong context.

**DON'T make goals optional in API calls** - Always send `goals_notes` field (empty string if none) so Mr. Mentor knows explicitly whether goals exist or not.

### 9. docs/brain/custom-subjects.md (7e58ee1ca5dc34b720347edc91b697304897f6b53937497421004d738d51df62)
- bm25: -23.1679 | relevance: 1.0000

### 17. docs/brain/api-routes.md (1a9909aa92e1849ef1e916a1eb98c4a6450cf230d4dcc814fde247b23fff87a0)
- bm25: -1.8675 | entity_overlap_w: 2.60 | adjusted: -2.5175 | relevance: 1.0000

---

## API Architecture Principles

1. **Stateless**: Each `/api/sonoma` call is independent; session state passed in request body
2. **Instruction-driven**: Behavior controlled by `instructions` field, not hardcoded logic
3. **LLM-agnostic**: Provider/model configured via `SONOMA_PROVIDER` and `SONOMA_MODEL` env vars
4. **Closed-world**: API responses are text-only; no side effects, no file access, no database writes from Ms. Sonoma

### 18. docs/brain/ingests/pack-mentor-intercepts.md (e51688fc662a7cfeed539410f10ff803205d894fd46fa5cf904e66e0ab3adef1)
- bm25: -1.8641 | entity_overlap_w: 2.60 | adjusted: -2.5141 | relevance: 1.0000

- API
  - `src/app/api/portfolio/generate/route.js` (portfolio builder)
  - `src/app/api/portfolio/list/route.js` (list saved portfolios)
  - `src/app/api/portfolio/delete/route.js` (delete saved portfolios + files)
  - `src/app/api/portfolio/lib.js` (HTML builder + helpers)

### 21. docs/brain/content-safety.md (8439c6a11335f126b7eb9ca7e5cceeea2313c6fa8078c00e649bedbe03efc5ad)
- bm25: -13.9812 | relevance: 1.0000

- `src/app/session/utils/profanityFilter.js` - Profanity detection, word list
- `src/app/api/sonoma/route.js` - Moderation API integration
- Session page instruction builders - Safety directives

### 22. docs/brain/lesson-validation.md (6bd47820aa3da6e19dc9b0a9c78ca88859dc4dd6752d036fea1a2fe4318d515b)
- bm25: -13.7593 | relevance: 1.0000

**Lesson Maker** (`/facilitator/generator`, implemented in `src/app/facilitator/generator/page.js`):
1. User fills form and clicks "Generate Lesson"
2. Toast: "Generating lesson..."
3. Call `/api/facilitator/lessons/generate`
4. Validate with `lessonValidation.validateLesson()`
5. If issues: Toast "Improving quality...", call `/api/facilitator/lessons/request-changes`
6. Toast: "Lesson ready!"

### 23. docs/brain/visual-aids.md (a5475ac1e1d52b11fba2a131961efaa39fab393b62bc29614a7cbc09580ebb03)
- bm25: -13.7064 | relevance: 1.0000

**Never skip the no-text enforcement suffix:**
- Every DALL-E prompt must include the explicit no-text suffix
- This is the final guardrail against text appearing in images
- Without it, even carefully worded prompts can accidentally trigger text rendering

## Related Brain Files

### 19. docs/brain/ingests/pack-mentor-intercepts.md (8a7301d0500f96c08aa055fafd78dfff6d432220ac856186ec0fc23816f67eb4)
- bm25: -1.7895 | entity_overlap_w: 2.60 | adjusted: -2.4395 | relevance: 1.0000

- `src/app/api/medals/route.js` - GET medals by learnerId
- `src/app/api/learner/lesson-history/route.js` - session history
- `src/app/api/lesson-schedule/route.js` - scheduled lessons (returns `{schedule: [...]}`)
- `src/app/api/curriculum-preferences/route.js` - focus/banned content
- `src/app/api/generate-lesson-outline/route.js` - GPT outline generation

**Database:**
- `supabase/migrations/20251214000000_add_planned_lessons_table.sql` (NEW)
  - `planned_lessons` table: id, facilitator_id, learner_id, scheduled_date, lesson_data (JSONB), timestamps
  - Indexes on facilitator_learner, date, facilitator_learner_date
  - RLS policies: facilitators access only their own planned lessons
  - UNIQUE constraint prevents exact duplicates

## Recent Changes

### 19. docs/brain/MentorInterceptor_Architecture.md (b30a12376305295c1ddcb75bee3d82a3ed8acd72d64038cfbc7e8c026aea67e9)
- bm25: -14.6288 | relevance: 1.0000

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

### 20. docs/brain/portfolio-generation.md (e083fdfcd6e4035528697e6c1609dd20b75c22e0849fc326d799b41cbb6a114a)
- bm25: -1.7442 | entity_overlap_w: 2.60 | adjusted: -2.3942 | relevance: 1.0000

Portfolio scans originally live in the `transcripts` bucket and are private/signed-url only. For no-login review, the generator copies scan files into the public `portfolios` bucket and links them from the portfolio HTML.

### Persistence + Management

Each generated portfolio is also saved in the database so it can be revisited and deleted.

- Table: `public.portfolio_exports`
  - Stores: facilitator_id, learner_id, portfolio_id, date range, include flags, and Storage paths.
- API endpoints:
  - `GET /api/portfolio/list?learnerId=<uuid>`: returns the latest saved portfolios for that learner.
  - `POST /api/portfolio/delete`: deletes the portfolio's Storage folder first (breaking the public link), then deletes the DB row.

This management layer is required because reviewers may keep the public link, and facilitators need a way to revoke access later.

## What NOT To Do

- Do not embed images as base64 in the HTML. Always link out to stored objects.
- Do not rely on short-lived signed URLs for reviewer access. Use stored public objects for portfolio artifacts.
- Do not include future (not-yet-completed) scheduled lessons in the portfolio.
- Do not add compatibility fallbacks for missing required inputs (dates, learnerId, include flags). Fail loudly.

## Key Files

- UI
  - `src/app/facilitator/calendar/page.js` (header button + modal wiring)
  - `src/app/facilitator/calendar/GeneratePortfolioModal.jsx` (overlay)
  - `src/components/FacilitatorHelp/PageHeader.jsx` (adds optional `actions` slot)

- API
  - `src/app/api/portfolio/generate/route.js` (portfolio builder)
  - `src/app/api/portfolio/list/route.js` (list saved portfolios)
  - `src/app/api/portfolio/delete/route.js` (delete saved portfolios + files)
  - `src/app/api/portfolio/lib.js` (HTML builder + helpers)

### 21. docs/brain/MentorInterceptor_Architecture.md (ce3cd9684410622160fbad2779f03dd2313cb09bba1ed5ffcd42179724e742c6)
- bm25: -1.7324 | entity_overlap_w: 2.60 | adjusted: -2.3824 | relevance: 1.0000

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

### 22. docs/brain/ingests/pack.md (11dd454c999b4865481c24140fda5f8f8a6ef46b4cf3d0a70ba94921e7c2655c)
- bm25: -1.9872 | entity_overlap_w: 1.30 | adjusted: -2.3122 | relevance: 1.0000

**API Response Structure:**
- `/api/medals` returns object directly: `{lessonId: {bestPercent: 85}, ...}`
- `/api/lesson-schedule` returns wrapper: `{schedule: [...]}`
- `/api/planned-lessons` returns wrapper: `{plannedLessons: {...}}`

### 23. docs/brain/api-routes.md (6582e7640dfac0b6e5d075e6c5e50752dfcc173c2af94759940062f99ce9fb28)
- bm25: -1.9276 | entity_overlap_w: 1.30 | adjusted: -2.2526 | relevance: 1.0000

### `/api/content-safety`
**Purpose**: Content moderation via Azure Content Safety API  
**Status**: Operational, see brain files for content safety architecture

### 24. docs/brain/ingests/pack-mentor-intercepts.md (e4bc8bd62895b9dd178bf544acd7b46d801af741c5ef2894d341124251440498)
- bm25: -1.8879 | entity_overlap_w: 1.30 | adjusted: -2.2129 | relevance: 1.0000

`src/app/counselor/CounselorClient.jsx`:
- After each assistant response, calls `POST /api/conversation-memory` with conversation history
- Debounced (1 second) to avoid excessive API calls during rapid exchanges
- On learner switch, loads new memory via `GET /api/conversation-memory?learner_id={id}`
- Search UI (planned) will call `GET /api/conversation-memory?search={keywords}`

### 25. docs/brain/calendar-lesson-planning.md (6035959c031ffab71ffbf3f5cbacb6d3960524c07c4b172b2317d5d4ccedc1ff)
- bm25: -1.8415 | entity_overlap_w: 1.30 | adjusted: -2.1665 | relevance: 1.0000

**Common failure mode:**
- If the Calendar overlay calls `/api/facilitator/lessons/get` without the bearer token, the API returns `401 {"error":"Unauthorized"}`.
- If the Calendar overlay calls `/api/visual-aids/*` without the bearer token, those endpoints also return `401 {"error":"Unauthorized"}`.

### 26. docs/brain/lesson-library-downloads.md (ea6c987f912e08a4811e52893de3701d5c14ec17ac6ba2a12fed4b2d9135d9b9)
- bm25: -1.8368 | entity_overlap_w: 1.30 | adjusted: -2.1618 | relevance: 1.0000

### API

- `POST /api/facilitator/lessons/download`
  - Auth: requires `Authorization: Bearer <access_token>`.
  - Input: `{ subject, file }`.
  - Server reads the built-in file from `public/lessons/<subjectFolder>/<file>.json`.
  - Server uploads to Supabase Storage path `facilitator-lessons/<userId>/<file>.json` with `upsert: true`.

## What NOT To Do

- Do not store lessons on the device (no localStorage/indexedDB/file downloads).
- Do not reuse Golden Keys to mean "unlock lessons"; Golden Keys are bonus play-time semantics.
- Do not match ownership using filename-only; subject collisions are possible.
- Do not allow path traversal in the download endpoint (`..`, `/`, `\\`).

## Key Files

- `src/app/facilitator/lessons/page.js`
- `src/app/api/facilitator/lessons/download/route.js`
- `src/app/api/facilitator/lessons/list/route.js`
- `src/app/api/lessons/[subject]/route.js`
- `src/app/api/lesson-file/route.js`

### 27. docs/brain/ingests/pack.md (8a535f1018b01bca63214b8dd441e8a6440e56eddd6d63a59123032e040c7111)
- bm25: -1.8122 | entity_overlap_w: 1.30 | adjusted: -2.1372 | relevance: 1.0000

- `src/app/facilitator/calendar/VisualAidsManagerModal.jsx`
  - Visual Aids manager for a lessonKey using `/api/visual-aids/load|generate|save`
  - Uses `VisualAidsCarousel` for selection/upload/save UI

- `src/app/facilitator/calendar/TypedRemoveConfirmModal.jsx`
  - Typed confirmation dialog (requires `remove`) for irreversible schedule deletion

**API Routes:**
- `src/app/api/planned-lessons/route.js`
  - GET: load by learner, transform DB rows to `{date: [lessons]}` format
  - POST: date-specific overwrite - extracts dates from new plan, deletes only those dates (.in filter), inserts new rows
  - DELETE: clear all planned lessons for learner
  - RLS policies ensure facilitator can only access own data

- `src/app/api/medals/route.js` - GET medals by learnerId
- `src/app/api/learner/lesson-history/route.js` - session history
- `src/app/api/lesson-schedule/route.js` - scheduled lessons (returns `{schedule: [...]}`)
- `src/app/api/curriculum-preferences/route.js` - focus/banned content
- `src/app/api/generate-lesson-outline/route.js` - GPT outline generation

**Database:**
- `supabase/migrations/20251214000000_add_planned_lessons_table.sql` (NEW)
  - `planned_lessons` table: id, facilitator_id, learner_id, scheduled_date, lesson_data (JSONB), timestamps
  - Indexes on facilitator_learner, date, facilitator_learner_date
  - RLS policies: facilitators access only their own planned lessons
  - UNIQUE constraint prevents exact duplicates

## Recent Changes

### 12. docs/brain/calendar-lesson-planning.md (9173fe378f56c3786b75c00e9b12c63312fc70bdcd188229f8dd2f7466567dc9)
- bm25: -25.6308 | relevance: 1.0000

### 28. docs/brain/calendar-lesson-planning.md (edc4501d8cf5402f28f2f259c81317facde5d8c4d278692219fb856850a029d8)
- bm25: -1.7974 | entity_overlap_w: 1.30 | adjusted: -2.1224 | relevance: 1.0000

- `src/app/facilitator/calendar/LessonNotesModal.jsx`
  - Minimal notes editor for `learners.lesson_notes[lesson_key]`
  - Empty note deletes the key from the JSONB map

- `src/app/facilitator/calendar/VisualAidsManagerModal.jsx`
  - Visual Aids manager for a lessonKey using `/api/visual-aids/load|generate|save`
  - Uses `VisualAidsCarousel` for selection/upload/save UI

- `src/app/facilitator/calendar/TypedRemoveConfirmModal.jsx`
  - Typed confirmation dialog (requires `remove`) for irreversible schedule deletion

**API Routes:**
- `src/app/api/planned-lessons/route.js`
  - GET: load by learner, transform DB rows to `{date: [lessons]}` format
  - POST: date-specific overwrite - extracts dates from new plan, deletes only those dates (.in filter), inserts new rows
  - DELETE: clear all planned lessons for learner
  - RLS policies ensure facilitator can only access own data

- `src/app/api/medals/route.js` - GET medals by learnerId
- `src/app/api/learner/lesson-history/route.js` - session history
- `src/app/api/lesson-schedule/route.js` - scheduled lessons (returns `{schedule: [...]}`)
- `src/app/api/curriculum-preferences/route.js` - focus/banned content
- `src/app/api/generate-lesson-outline/route.js` - GPT outline generation

**Database:**
- `supabase/migrations/20251214000000_add_planned_lessons_table.sql` (NEW)
  - `planned_lessons` table: id, facilitator_id, learner_id, scheduled_date, lesson_data (JSONB), timestamps
  - Indexes on facilitator_learner, date, facilitator_learner_date
  - RLS policies: facilitators access only their own planned lessons
  - UNIQUE constraint prevents exact duplicates

## Recent Changes

### 29. cohere-changelog.md (c099d43e20ff8f7901fbebd173567513a37beb2b8b5a706427a1268ddc96e551)
- bm25: -1.7941 | entity_overlap_w: 1.30 | adjusted: -2.1191 | relevance: 1.0000

Result:
- Decision: Add two authenticated API routes backed by ThoughtHub events: one groups `meta.mentor_blindspot` by normalized query; one lists/appends `meta.mentor_feature_proposal` as an append-only event for later promotion into the registry.
- Files changed: src/app/api/mentor-blindspots/route.js, src/app/api/mentor-feature-proposals/route.js, cohere-changelog.md

### 30. docs/brain/ingests/pack.planned-lessons-flow.md (575e83b0e4a0ed1667a2690633337b3755d2e4b69162a2c3fb4af6899807233d)
- bm25: -1.7880 | entity_overlap_w: 1.30 | adjusted: -2.1130 | relevance: 1.0000

- `src/app/facilitator/calendar/TypedRemoveConfirmModal.jsx`
  - Typed confirmation dialog (requires `remove`) for irreversible schedule deletion

**API Routes:**
- `src/app/api/planned-lessons/route.js`
  - GET: load by learner, transform DB rows to `{date: [lessons]}` format
  - POST: date-specific overwrite - extracts dates from new plan, deletes only those dates (.in filter), inserts new rows
  - DELETE: clear all planned lessons for learner
  - RLS policies ensure facilitator can only access own data

- `src/app/api/medals/route.js` - GET medals by learnerId
- `src/app/api/learner/lesson-history/route.js` - session history
- `src/app/api/lesson-schedule/route.js` - scheduled lessons (returns `{schedule: [...]}`)
- `src/app/api/curriculum-preferences/route.js` - focus/banned content
- `src/app/api/generate-lesson-outline/route.js` - GPT outline generation

**Database:**
- `supabase/migrations/20251214000000_add_planned_lessons_table.sql` (NEW)
  - `planned_lessons` table: id, facilitator_id, learner_id, scheduled_date, lesson_data (JSONB), timestamps
  - Indexes on facilitator_learner, date, facilitator_learner_date
  - RLS policies: facilitators access only their own planned lessons
  - UNIQUE constraint prevents exact duplicates

## Recent Changes

### 5. docs/brain/MentorInterceptor_Architecture.md (b9af78a6a85babc29ee74ec9cf6073767b7a2e84a19456e1f96ab9a407cbd74d)
- bm25: -30.7151 | entity_overlap_w: 2.50 | adjusted: -31.3401 | relevance: 1.0000

### 31. docs/brain/MentorInterceptor_Architecture.md (2585991a7684d55feb1914fcd650db4dfa0bc239c1596db3f638e5f2c2a77cde)
- bm25: -1.7809 | entity_overlap_w: 1.30 | adjusted: -2.1059 | relevance: 1.0000

**API call:**
```javascript
POST /api/facilitator/lessons/schedule
{
  learner_id: 'uuid',
  lesson_key: 'math/4th-multiplying-with-zeros.json',
  scheduled_date: '2025-12-18'
}
```

### 32. docs/brain/content-safety.md (8439c6a11335f126b7eb9ca7e5cceeea2313c6fa8078c00e649bedbe03efc5ad)
- bm25: -1.7757 | entity_overlap_w: 1.30 | adjusted: -2.1007 | relevance: 1.0000

- `src/app/session/utils/profanityFilter.js` - Profanity detection, word list
- `src/app/api/sonoma/route.js` - Moderation API integration
- Session page instruction builders - Safety directives

### 33. docs/brain/ingests/pack.lesson-schedule-debug.md (e32f19a7bc99b1fa707b42fc140ba5864a2bbf1c21cf1058c6b3a11637691a49)
- bm25: -1.7653 | entity_overlap_w: 1.30 | adjusted: -2.0903 | relevance: 1.0000

**API call:**
```javascript
POST /api/facilitator/lessons/schedule
{
  learner_id: 'uuid',
  lesson_key: 'math/4th-multiplying-with-zeros.json',
  scheduled_date: '2025-12-18'
}
```

### 34. docs/brain/mr-mentor-memory.md (bcae0399964dfd446fb26c989fa31caab3e7af2aa7335a0a65f8edd22073d4a8)
- bm25: -1.7601 | entity_overlap_w: 1.30 | adjusted: -2.0851 | relevance: 1.0000

**`conversation_history_archive` table (Permanent Archive):**
```sql
- id: UUID primary key
- facilitator_id: UUID
- learner_id: UUID (nullable)
- summary: TEXT
- conversation_turns: JSONB (full turns at archive time)
- turn_count: INTEGER
- archived_at: TIMESTAMPTZ
- search_vector: tsvector (generated for full-text search)
```
**Never deleted.** Archives created when conversation deleted or exceeds 50 turns.

## API Endpoints

**`POST /api/conversation-memory`** - Update or create memory

Request:
```json
{
  "learner_id": "uuid-or-null",
  "conversation_turns": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "force_regenerate": false
}
```

Response:
```json
{
  "success": true,
  "conversation_update": {
    "id": "...",
    "summary": "...",
    "turn_count": 15,
    "updated_at": "..."
  }
}
```

**`GET /api/conversation-memory`** - Retrieve memory

Query params:
- `learner_id` (optional): Get learner-specific memory
- `search` (optional): Search with keywords
- `include_archive` (optional): Include archived conversations

Examples:
```
GET /api/conversation-memory
→ Returns general facilitator memory

GET /api/conversation-memory?learner_id=abc123
→ Returns memory for specific learner

GET /api/conversation-memory?search=math%20curriculum&include_archive=true
→ Searches current + archived memories for "math curriculum"
```

Response (single memory):
```json
{
  "success": true,
  "conversation_update": {
    "summary": "...",
    "turn_count": 15,
    "recent_turns": [...],
    "updated_at": "..."
  }
}
```

### 35. docs/brain/ingests/pack-mentor-intercepts.md (b93a4076a94fbc8922a46757e9f5cbda4e268d5694230d2c678a0f3fca32e62b)
- bm25: -1.7597 | entity_overlap_w: 1.30 | adjusted: -2.0847 | relevance: 1.0000

### API

- `POST /api/facilitator/lessons/download`
  - Auth: requires `Authorization: Bearer <access_token>`.
  - Input: `{ subject, file }`.
  - Server reads the built-in file from `public/lessons/<subjectFolder>/<file>.json`.
  - Server uploads to Supabase Storage path `facilitator-lessons/<userId>/<file>.json` with `upsert: true`.

## What NOT To Do

- Do not store lessons on the device (no localStorage/indexedDB/file downloads).
- Do not reuse Golden Keys to mean "unlock lessons"; Golden Keys are bonus play-time semantics.
- Do not match ownership using filename-only; subject collisions are possible.
- Do not allow path traversal in the download endpoint (`..`, `/`, `\\`).

## Key Files

- `src/app/facilitator/lessons/page.js`
- `src/app/api/facilitator/lessons/download/route.js`
- `src/app/api/facilitator/lessons/list/route.js`
- `src/app/api/lessons/[subject]/route.js`
- `src/app/api/lesson-file/route.js`

### 18. docs/brain/calendar-lesson-planning.md (edc4501d8cf5402f28f2f259c81317facde5d8c4d278692219fb856850a029d8)
- bm25: -14.7958 | relevance: 1.0000

- `src/app/facilitator/calendar/LessonNotesModal.jsx`
  - Minimal notes editor for `learners.lesson_notes[lesson_key]`
  - Empty note deletes the key from the JSONB map

- `src/app/facilitator/calendar/VisualAidsManagerModal.jsx`
  - Visual Aids manager for a lessonKey using `/api/visual-aids/load|generate|save`
  - Uses `VisualAidsCarousel` for selection/upload/save UI

- `src/app/facilitator/calendar/TypedRemoveConfirmModal.jsx`
  - Typed confirmation dialog (requires `remove`) for irreversible schedule deletion

### 36. docs/brain/ingests/pack.lesson-schedule-debug.md (dd94434cb8c303004181882c8f4228c47f194f0b2bf6e5804d6698eafdab5d02)
- bm25: -1.7583 | entity_overlap_w: 1.30 | adjusted: -2.0833 | relevance: 1.0000

- `src/app/facilitator/calendar/TypedRemoveConfirmModal.jsx`
  - Typed confirmation dialog (requires `remove`) for irreversible schedule deletion

**API Routes:**
- `src/app/api/planned-lessons/route.js`
  - GET: load by learner, transform DB rows to `{date: [lessons]}` format
  - POST: date-specific overwrite - extracts dates from new plan, deletes only those dates (.in filter), inserts new rows
  - DELETE: clear all planned lessons for learner
  - RLS policies ensure facilitator can only access own data

- `src/app/api/medals/route.js` - GET medals by learnerId
- `src/app/api/learner/lesson-history/route.js` - session history
- `src/app/api/lesson-schedule/route.js` - scheduled lessons (returns `{schedule: [...]}`)
- `src/app/api/curriculum-preferences/route.js` - focus/banned content
- `src/app/api/generate-lesson-outline/route.js` - GPT outline generation

**Database:**
- `supabase/migrations/20251214000000_add_planned_lessons_table.sql` (NEW)
  - `planned_lessons` table: id, facilitator_id, learner_id, scheduled_date, lesson_data (JSONB), timestamps
  - Indexes on facilitator_learner, date, facilitator_learner_date
  - RLS policies: facilitators access only their own planned lessons
  - UNIQUE constraint prevents exact duplicates

## Recent Changes

### 7. docs/brain/calendar-lesson-planning.md (9deb51ba2dd90ddaeee2ec696cc923087de9a8728187af5d9b6f9c4fb5277d7d)
- bm25: -22.9167 | relevance: 1.0000

This is separate from Visual Aids:
- **Visual Aids** are lesson-level aids (generated or curated) used during instruction.
- **Portfolio scans** are learner work artifacts (uploaded images/PDFs).

### 37. docs/brain/pin-protection.md (9d13ed0a83c6fafa15ecaac2fcd18ecc25090900b8af7f490f6909677b7b779f)
- bm25: -1.7449 | entity_overlap_w: 1.30 | adjusted: -2.0699 | relevance: 1.0000

PIN verification is server-only (no localStorage fallback):
- Server validates PIN against hashed value in `profiles.facilitator_pin_hash`
- Uses bcrypt for secure comparison
- API endpoint: `POST /api/facilitator/pin/verify`

### 38. docs/brain/ingests/pack.planned-lessons-flow.md (c1630e20d42e7416e0786d4762a62020e29931c3609ba5301492ca0c6c410df5)
- bm25: -1.7211 | entity_overlap_w: 1.30 | adjusted: -2.0461 | relevance: 1.0000

## What NOT To Do

- Do not store lessons on the device (no localStorage/indexedDB/file downloads).
- Do not reuse Golden Keys to mean "unlock lessons"; Golden Keys are bonus play-time semantics.
- Do not match ownership using filename-only; subject collisions are possible.
- Do not allow path traversal in the download endpoint (`..`, `/`, `\\`).

## Key Files

- `src/app/facilitator/lessons/page.js`
- `src/app/api/facilitator/lessons/download/route.js`
- `src/app/api/facilitator/lessons/list/route.js`
- `src/app/api/lessons/[subject]/route.js`
- `src/app/api/lesson-file/route.js`

### 27. docs/brain/calendar-lesson-planning.md (4da551360e5a46cca2826bfe58a71289a036bb89df00313db4714021b4cc5eab)
- bm25: -14.3879 | relevance: 1.0000

**Usage:**
- `node scripts/check-completions-for-keys.mjs --learner Emma --from 2026-01-05 --to 2026-01-08`

### Scheduled Lessons Overlay: Built-in Lesson Editor

The Calendar day overlay includes an inline lesson editor for scheduled lessons.

This editor matches the regular lesson editor for Visual Aids (button + carousel + generation + persistence).

**Lesson load:**
- Uses `GET /api/facilitator/lessons/get?file=<lesson_key>`
- This endpoint requires an `Authorization: Bearer <access_token>` header.
- The API derives the facilitator user id from the bearer token and loads from `facilitator-lessons/<userId>/...`.
- Client code must not rely on a `userId` query param for this endpoint.

**Lesson save:**
- Uses `PUT /api/facilitator/lessons/update` with JSON body `{ file, lesson }` and `Authorization: Bearer <access_token>`.
- The server enforces that the authenticated user can only edit their own lessons.

### 39. docs/brain/mr-mentor-sessions.md (0f0ef394916da8a11db2215e0273c72dba088f715c68ce104a6523679e5bfde1)
- bm25: -1.7089 | entity_overlap_w: 1.30 | adjusted: -2.0339 | relevance: 1.0000

## API Endpoints

**`GET /api/mentor-session?sessionId={id}`** - Check session status

Response:
```json
{
  "status": "active" | "taken" | "none",
  "session": {
    "session_id": "...",
    "device_name": "...",
    "conversation_history": [...],
    "draft_summary": "...",
    "last_activity_at": "..."
  },
  "isOwner": true | false
}
```

**`POST /api/mentor-session`** - Create/takeover/force-end session

Request:
```json
{
  "sessionId": "...",
  "deviceName": "My Desktop",
  "pinCode": "1234",
  "action": "resume" | "takeover" | "force_end",
  "targetSessionId": "..." // for force_end
}
```

- **`action: 'resume'`**: Create new session (fails if another session active)
- **`action: 'takeover'`**: Deactivate other session, create new one (requires valid PIN)
- **`action: 'force_end'`**: Release frozen session without taking over (requires valid PIN)
- Automatically clears stale sessions older than `MENTOR_SESSION_TIMEOUT_MINUTES` (default: 15 minutes)

Response:
```json
{
  "session": { ... },
  "status": "active" | "taken_over" | "force_ended"
}
```

**`PATCH /api/mentor-session`** - Update conversation/draft

Request:
```json
{
  "sessionId": "...",
  "conversationHistory": [...],
  "draftSummary": "..."
}
```

Auto-debounced on client (saves 1 second after last change).

**`DELETE /api/mentor-session?sessionId={id}`** - End session

Called when user clicks "New Conversation". Deactivates session, returns `{ success: true }`.

## Client Flow

**Entitlement gating (view-only vs active session)**

### 40. docs/brain/ingests/pack.planned-lessons-flow.md (155578c318bfa1c68504c39454f35d1dcfc25dd6e797a69bfbd7d4d8c9043962)
- bm25: -1.6993 | entity_overlap_w: 1.30 | adjusted: -2.0243 | relevance: 1.0000

## Key Files

- UI
  - `src/app/facilitator/calendar/page.js` (header button + modal wiring)
  - `src/app/facilitator/calendar/GeneratePortfolioModal.jsx` (overlay)
  - `src/components/FacilitatorHelp/PageHeader.jsx` (adds optional `actions` slot)

- API
  - `src/app/api/portfolio/generate/route.js` (portfolio builder)
  - `src/app/api/portfolio/list/route.js` (list saved portfolios)
  - `src/app/api/portfolio/delete/route.js` (delete saved portfolios + files)
  - `src/app/api/portfolio/lib.js` (HTML builder + helpers)

### 34. src/app/facilitator/generator/counselor/MentorInterceptor.js (dd9fc7d0f63f857e45b48169025dafbb0d96182f685e4e93f894b4f372b1d6a0)
- bm25: -12.9933 | relevance: 1.0000

,

lesson_plan: {
    keywords: [
      'lesson plan',
      'lesson planner',
      'planned lessons',
      'curriculum preferences',
      'curriculum',
      'weekly pattern',
      'schedule template',
      'start date',
      'duration',
      'generate lesson plan',
      'schedule a lesson plan'
    ],
    confidence: (text) => {
      const normalized = normalizeText(text)

// FAQ-style questions about the planner should defer to FAQ intent.
      const faqPatterns = ['how do i', 'how can i', 'how to', 'what is', 'explain', 'tell me about']
      if (faqPatterns.some(p => normalized.includes(p))) {
        return 0
      }

return INTENT_PATTERNS.lesson_plan.keywords.some(kw => normalized.includes(kw)) ? 0.85 : 0
    }
  }
}
