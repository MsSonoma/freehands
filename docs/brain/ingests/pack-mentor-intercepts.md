# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Where is Mr. Mentor mechanical intercept implemented, and how do schedule_lesson/assign_lesson tools and escape hatches work? Anchor: src/app/api/counselor/route.js and pendingConfirmationTool.

## Forced Context

### F1. docs/brain/manifest.json (053a34bf539b1900dfe148bce815cf295eabc0de0c5644c972b61cf1ae4e47dc)

{
  "facilitator-hub": {
    "file": "facilitator-hub.md",
    "systems": [
      "/facilitator",
      "hub-cards",
      "account",
      "billing-placement",
      "subscription-status"
    ],
    "last_updated": "2026-01-08T02:06:48Z",
    "status": "canonical"
  },
  "header-navigation": {
    "file": "header-navigation.md",
    "systems": [
      "HeaderBar",
      "top-nav-links",
      "facilitator-dropdown",
      "session-exit-pin-gate",
      "print-menu"
    ],
    "last_updated": "2026-01-27T19:27:45Z",
    "status": "canonical"
  },
  "homepage": {
    "file": "homepage.md",
    "systems": [
      "/",
      "home hero",
      "mssonoma.com",
      "external link",
      "learn-more copy"
    ],
    "last_updated": "2026-01-10T19:44:15Z",
    "status": "canonical"
  },
  "custom-subjects": {
    "file": "custom-subjects.md",
    "systems": [
      "custom_subjects",
      "/api/custom-subjects",
      "per-facilitator subjects",
      "subject dropdowns",
      "Mr. Mentor subjects"
    ],
    "last_updated": "2026-01-10T20:06:44Z",
    "status": "canonical"
  },
  "notifications-system": {
    "file": "notifications-system.md",
    "systems": [
      "facilitator notifications",
      "/facilitator/notifications",
      "facilitator_notifications",
      "facilitator_notification_prefs",
      "read_at",
      "notification settings",
      "no-localStorage"
    ],
    "last_updated": "2026-01-08T13:36:08Z",
    "status": "canonical"
  },
  "dev-server-and-chunks": {
    "file": "dev-server-and-chunks.md",
    "systems": [
      "next-dev",
      "chunk-404",
      "_next-static-chunks",
      "distDir",
      "next-config",
      "cache-clean",
      "restart-dev-3001"
    ],
    "last_updated": "2026-01-01T05:20:00Z",
    "status": "canonical"
  },
  "g

### F2. docs/brain/changelog.md (af78fd9ed3f607fe5c964d2af9c77035b2427d1149edcdcf77835af1237bea38)

﻿2026-02-05T03:28:35Z | Copilot | Fix Calendar LessonPlanner JSX parse error (Duration <select> tag) that broke Vercel Next build [#calendar-lesson-planning: LessonPlanner, JSX, build] 
2026-02-05T00:30:46Z | Copilot | Entitlements: resolveEffectiveTier now considers subscription_tier + plan_tier (Premium->Pro in either) to prevent false lockouts [#gating-system: tier-normalization, resolveEffectiveTier, tier-gates]
2026-02-05T00:25:09Z | Copilot | Mr. Mentor: remove blocking Pro overlay; signed-in view + read-only loads; gate session init and actions behind Pro [#gating-system: window-shopping, view-only, tier-gates] [#mr-mentor-sessions: realtime conflict detection, session takeover, heartbeat polling]
2026-02-04T21:15:00Z | Copilot | Calendar: always viewable when signed in; gate only schedule/plan writes behind Pro (no tier-blocking overlay) [#calendar-lesson-planning: view-only, canPlan, manual-scheduling] [#gating-system: window-shopping, tier-gates, view-only]
2026-02-04T20:59:14Z | Copilot | Normalize legacy plan_tier values (premium/plus/basic) so learner caps and entitlements resolve correctly [#gating-system: tier-gates, useAccessControl, universal-gating]
2026-02-04T19:31:04Z | Copilot | Clean up remaining legacy tier refs (Basic/Plus/Premium) in UI copy, docs, tasks, and schema examples [#gating-system: requiredFeature, requiredTier, window-shopping] [#account-provisioning: provision wrapper, plan_tier values] [#lesson-quota: lessonsPerDay, quota overlay] [#calendar-lesson-planning: lessonPlanner, tier-gate]
2026-02-04T18:14:47Z | Copilot | ESLint: ignore .next-dev output so lint only checks source
2026-02-04T01:05:00Z | Copilot | Gate Session V2 Games/Visual Aids/Golden Keys by plan entitlements; sync provisioning + brain docs to free/trial/standard/pro [#

### F3. docs/brain/changelog.md (d860f06acd14ee79ee7235b00357d2b3e26068c0eb5026a82476a970011eb698)

2025-12-15T01:20:00Z | Copilot | FIX: Build failure - incorrect Supabase import path. Import path '@/lib/supabase' does not exist in project. Corrected to '@/app/lib/supabaseClient' matching pattern used throughout codebase (TutorialGuard, PostLessonSurvey, session page, etc). Build now completes successfully. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (corrected getSupabaseClient import path).
2025-12-15T01:15:00Z | Copilot | FIX: Redo button failing with 401 Unauthorized error. Redo button fetch call to /api/generate-lesson-outline did not include Authorization header with auth token. API endpoint requires Bearer token for authentication (checks request.headers.authorization). Added getSupabaseClient import to DayViewOverlay, modified handleRedoClick to fetch session token via supabase.auth.getSession() before API call, added 'Authorization': `Bearer ${token}` header to fetch request. Redo button now successfully regenerates lesson outlines. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (imported getSupabaseClient, updated handleRedoClick to get auth token and include in headers).
2025-12-15T01:00:00Z | Copilot | FEATURE: Implemented color differentiation for scheduled vs planned lessons in calendar. Scheduled lessons display in orange (#fef3c7 bg, #f59e0b indicator), planned lessons display in blue (#dbeafe bg, #3b82f6 indicator). Added isPlannedView prop to LessonCalendar component that determines which color scheme to use. Updated date cell background color logic and indicator dot color to conditionally apply blue for planned view or orange for scheduled view. Calendar page passes isPlannedView={activeTab === 'planner'} prop based on current tab. Visual distinction makes it immediately clear whether viewing scheduled curriculum or planning futu

### F4. docs/brain/changelog.md (5198739245eee2147be1c4f98d337674977e8e82829e9c58c2c86491e342a333)

2025-12-09T20:30:00Z | Copilot | CRITICAL AUTH FIX v2: Per-user storage isolation instead of per-tab. Previous fix required re-login on every refresh (unacceptable UX). New approach: each USER gets isolated storage namespace, but same user shares auth across all tabs. Custom storage adapter implements Supabase Storage interface, stores auth at supabase-auth-user-<userId> keys. Client instances cached per userId (not singleton). Same user in multiple tabs shares client and auth (stay logged in together). Different users in different tabs use separate storage keys (isolated). Page refresh auto-detects user ID from localStorage, restores correct client (no re-login). Logout propagates to all tabs for that user but not to tabs with different users. Handles legacy migration from default storage key. Files: src/app/lib/supabaseClient.js (custom UserIsolatedStorage class, clientsByUserId Map, user ID auto-detection), docs/brain/auth-session-isolation.md (completely rewritten with per-user architecture). [REVERTED - see 2025-12-09T21:00:00Z]
2025-12-09T20:00:00Z | Copilot | CRITICAL AUTH FIX: Cross-tab auth leakage - logging out in one tab logged out ALL tabs, logging into new account in Tab A switched Tab B to that account. Root cause: Supabase client used default shared localStorage key 'sb-<project>-auth-token' for all tabs. Auth state changes in one tab immediately affected all other tabs via shared localStorage. Solution: Added per-tab unique storageKey using sessionStorage-persisted UUID (supabase-auth-<UUID>). Each tab generates unique storage key on first load, isolating auth sessions. Tab A logout/login no longer affects Tab B. Auth persists within tab across page navigation but refreshing tab generates new UUID (requires re-login, acceptable trade-off vs auth leakage)

## Ranked Evidence

### 1. docs/brain/api-routes.md (619d7d8dd7b599f7bab2e31decb90d7a8272127cd3f304a5a4a090e94f8126cb)
- bm25: -36.0158 | relevance: 1.0000

- **Location**: `src/app/api/counselor/route.js`
- **Behavior**: LLM-driven counselor responses with function calling tools for lesson operations
- **Key tools**: `search_lessons`, `get_lesson_details`, `generate_lesson` (confirmation-gated), `schedule_lesson`, `assign_lesson`, `edit_lesson`, conversation memory tools

### 2. docs/brain/mr-mentor-conversation-flows.md (958c9ac063b744328200ce6dc74910b7af60f847dfe7d0b4c07358dfdc1068a0)
- bm25: -32.6460 | relevance: 1.0000

### Function Schemas
- **File:** `src/app/api/counselor/route.js`
- **Location:** OpenAI tools array in POST handler
- **Functions:**
  - `search_lessons` - Broad, always available
  - `generate_lesson` - Restricted, escape-aware
  - `schedule_lesson` - Action-immediate
       - `assign_lesson` - Make lesson available to learner (action-immediate)

### Capabilities Info
- **File:** `src/app/api/counselor/route.js`
- **Function:** `getCapabilitiesInfo()`
- **Provides:** Detailed guidance on when to use each function

---

## Edge Cases

### User Says "Recommend Them to Be Generated"
This is confusing language mixing "recommend" (advice) with "generated" (creation).

**Interpretation Priority:**
1. Dominant verb: "recommend" → advice mode
2. Context: "Do you have suggestions?" preceded this → advice mode
3. Action: Search and recommend, don't generate

### User Says "Stop" During Parameter Collection
Even if function calling started, model can produce conversational response abandoning the call.

**Expected Behavior:**
- Model reads escape signal in system prompt
- Produces text response instead of function call
- Response acknowledges user's preference: "Of course! Let me search instead..."

### User Asks for "Christmas Themed" Without Learner Selected
**Correct Flow:**
1. Search for Christmas-themed lessons across grades
2. Present options
3. Offer to narrow by grade OR generate if nothing suitable
4. DO NOT assume generation is wanted

---

## Testing Scenarios

### Scenario 1: Ambiguous Generation Language
```
User: "Emma needs one more lesson and then Christmas vacation. Suggestions?"
Expected: Search, recommend Christmas-themed language arts, ask questions
Actual (before fix): Started asking for grade, subject, difficulty
```

### 3. docs/brain/mr-mentor-conversation-flows.md (a602718684749a96d908b30e99eea5da87d14a2353cbba1d5d1e4edcbd888118)
- bm25: -28.9522 | relevance: 1.0000

### System Prompt
- **File:** `src/app/api/counselor/route.js`
- **Constant:** `MENTOR_SYSTEM_PROMPT`
- **Key Sections:**
  - `CRITICAL DISTINCTION - Recommendations vs Generation`
  - Tool descriptions for `GENERATE_LESSON`, `SEARCH_LESSONS`
  - Escape hatch instructions

### 4. docs/brain/mr-mentor-memory.md (cf9c484090fffba0ab1bf54c85953e0c43ba3831fa9fcbba4a42bd4607e87e54)
- bm25: -27.7635 | relevance: 1.0000

## Function Calling Tools

**`get_conversation_memory` tool** (available to Mr. Mentor):
- Loads summary for current facilitator+learner context
- Returns summary + recent turns
- Used automatically on first message of new session

**`search_conversation_history` tool** (available to Mr. Mentor):
- Searches past conversations with keywords
- Parameters: `keywords` (string), `include_current_learner_only` (boolean)
- Returns ranked results from current + archived memories
- Example: User asks "What did we discuss about Emma last week?" → Mr. Mentor calls `search_conversation_history("Emma")`

## Client Integration

`src/app/counselor/CounselorClient.jsx`:
- After each assistant response, calls `POST /api/conversation-memory` with conversation history
- Debounced (1 second) to avoid excessive API calls during rapid exchanges
- On learner switch, loads new memory via `GET /api/conversation-memory?learner_id={id}`
- Search UI (planned) will call `GET /api/conversation-memory?search={keywords}`

## Related Brain Files

- **[mr-mentor-sessions.md](mr-mentor-sessions.md)** - Memory system integrates with session management
- **[mr-mentor-conversation-flows.md](mr-mentor-conversation-flows.md)** - Function calling tools retrieve memory context

## Key Files

- `src/app/api/conversation-memory/route.js` - GET/POST endpoints, summarization logic, archival
- `src/app/counselor/CounselorClient.jsx` - Client-side memory updates, loading
- `src/app/api/counselor/route.js` - Function calling tools, automatic memory loading

## What NOT To Do

**DON'T regenerate summaries from scratch** - Use incremental updates. Regenerating loses nuance and wastes tokens. Only use `force_regenerate: true` for debugging.

### 5. docs/brain/lesson-validation.md (d76e6cdb4d66d09eca13f4085b6ffb89b9a9401296041ac37b869ece0a0289a0)
- bm25: -25.4537 | relevance: 1.0000

**Legacy route:** `/facilitator/generator/lesson-maker` redirects to `/facilitator/generator`.

**Mr. Mentor** (`src/app/api/counselor/route.js`):
1. User: "Create a 5th grade science lesson on photosynthesis"
2. Mr. Mentor calls `generate_lesson` function
3. Backend validates lesson automatically
4. If issues: Make second call to fix quality
5. Mr. Mentor confirms completion with improved lesson

## Related Brain Files

- **[lesson-editor.md](lesson-editor.md)** - Validation runs automatically on lesson editor save
- **[mr-mentor-conversation-flows.md](mr-mentor-conversation-flows.md)** - Mr. Mentor auto-validates generated lessons

## Key Files

- `src/app/lib/lessonValidation.js` - Validation logic, critical issue checks, change request builder
- `src/components/Toast.jsx` - Toast notification component
- `src/app/facilitator/generator/page.js` - Manual generation UI with validation flow
- `src/app/api/counselor/route.js` - Mr. Mentor's automatic validation + retry logic
- `src/app/api/facilitator/lessons/generate/route.js` - Generation endpoint
- `src/app/api/facilitator/lessons/request-changes/route.js` - Improvement endpoint

## What NOT To Do

**DON'T block on warnings** - Only critical issues trigger retry. Warnings are logged but don't block lesson creation.

**DON'T exceed 60s per call** - Each API call must stay under Vercel timeout. Split into two calls rather than one long call.

**DON'T skip validation in Mr. Mentor flow** - Both manual (Lesson Maker) and conversational (Mr. Mentor) generation must validate.

**DON'T regenerate from scratch on retry** - Second call uses "request-changes" approach: "Fix these specific issues" not "regenerate entire lesson".

### 6. docs/brain/mr-mentor-session-persistence.md (c2eb61d278bd75ea3bdaff9b65f83fddd692989bdfe687b11402765ab944edc5)
- bm25: -24.3334 | relevance: 1.0000

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

### 7. docs/brain/mr-mentor-conversation-flows.md (47a7f1d23cc6ab836950913552c45a69e0bbfb20cccb99e80ebdf542e7e579c2)
- bm25: -24.2774 | relevance: 1.0000

# Mr. Mentor Conversation Flows

**Last Updated:** 2025-12-18  
**Status:** Canonical  
**Systems:** Conversation decision logic, lesson generation vs recommendations, escape hatches, function calling triggers

---

## How It Works

### Frontend Confirmation Gate

- Every counselor request sets `require_generation_confirmation: true`.
- If GPT tries to call `generate_lesson`, the API now returns a confirmation prompt instead of executing.
- The frontend marks `pendingConfirmationTool = 'generate_lesson'` and asks the user.
- If the user declines, the next request disables `generate_lesson` (`disableTools: ['generate_lesson']`) and appends a decline note to the user message: "(User declined generation. Respond by providing assistance with the user's problem.)" so GPT assists instead of forcing generation.
- If the user confirms, the next request sets `generation_confirmed: true` and allows the tool call.

### Recommendations vs Generation Decision Logic

Mr. Mentor must distinguish between two fundamentally different user intents:

1. **Seeking Recommendations/Advice** - User wants suggestions from existing lessons
2. **Requesting Generation** - User wants to create a new custom lesson

#### Recognition Patterns

**Recommendation Intent (DO NOT trigger generation):**
- "Do you have suggestions?"
- "What do you recommend?"
- "Any ideas for lessons?"
- "Give me advice"
- "What lessons are good for X?"
- "Do you have lessons on X?"
- Mentioning a topic without imperative verbs

**Generation Intent (ONLY time to trigger generation):**
- "Create a lesson about X"
- "Generate a lesson for X"
- "Make me a lesson on X"
- Explicit imperative verbs requesting creation

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

- API
  - `src/app/api/custom-subjects/route.js`
- Shared subject utilities
  - `src/app/hooks/useFacilitatorSubjects.js`
  - `src/app/lib/subjects.js`
- UI surfaces that must reflect custom subjects
  - `src/app/facilitator/calendar/LessonPicker.js` (scheduler subject filter)
  - `src/app/facilitator/lessons/page.js` (lesson library subject filter)
  - `src/components/LessonEditor.jsx` (lesson subject field)
  - `src/app/facilitator/generator/page.js` (Lesson Maker)
  - `src/app/facilitator/generator/counselor/overlays/*` (Mr. Mentor overlays)

### 10. docs/brain/mr-mentor-sessions.md (f2b7ab2dc155d2357594b47f2a3a65b057f762766ec8dbf9983ebc72fa37ef8e)
- bm25: -21.7710 | relevance: 1.0000

- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Three-layer persistence for conversation state
- **[mr-mentor-memory.md](mr-mentor-memory.md)** - Conversation memory accessed during sessions

## Key Files

- `src/app/facilitator/generator/counselor/CounselorClient.jsx` - Session initialization, realtime/heartbeat conflict detection, takeover handling, conversation sync
- `src/components/SessionTakeoverDialog.jsx` - Takeover modal UI
- `src/app/api/mentor-session/route.js` - GET/POST/PATCH/DELETE endpoints, PIN validation, session enforcement

## Maintenance

**Manual cleanup** (if needed):
```sql
-- View all active sessions
SELECT * FROM mentor_sessions WHERE is_active = true;

-- Force-end specific session
UPDATE mentor_sessions 
SET is_active = false 
WHERE facilitator_id = 'uuid' AND is_active = true;
```

**Automatic cleanup:**
- API automatically deactivates stale sessions (no activity > 15 minutes) before creating new sessions
- No cron job needed

## What NOT To Do

**DON'T allow multiple active sessions** - Enforced by unique constraint + API validation. Multiple active sessions = split-brain state.

**DON'T skip PIN validation on takeover** - PIN required for `action: 'takeover'` and `action: 'force_end'`. Prevents unauthorized session hijacking.

**DON'T lose conversation history on takeover** - New session inherits full `conversation_history` from old session. Zero data loss.

**DON'T forget to stop polling on unmount** - Clear interval in cleanup effect. Memory leak otherwise.

**DON'T allow takeover without showing warning** - Dialog must explain consequences (other device loses session). User should understand what's happening.

### 11. docs/brain/mr-mentor-conversation-flows.md (32af0ce972bc228b72cbaab4e488efca4dd9a1c0df0c93e692c10279247cf66f)
- bm25: -21.1368 | relevance: 1.0000

**Implementation:** OpenAI model reads these signals and produces conversational response instead of continuing function call.

---

### Function Calling Triggers

#### `search_lessons` - Always Available
- When user asks about lessons on a topic
- When user mentions a subject area
- Before considering generation
- Default action for lesson-related queries

#### `generate_lesson` - Highly Restricted
- ONLY when explicit imperative generation language detected
- ONLY after searching doesn't find suitable match
- NEVER for "suggestions", "recommendations", "ideas", "advice"
- Must honor escape signals if user backs out

#### `schedule_lesson` - Immediate Action
- When user says "schedule this", "add to calendar", "put it on Monday"
- Must ALWAYS call function (never confirm without actually calling)
- Requires lessonKey from prior search/generation

#### `assign_lesson` - Immediate Action
- When user says "assign this lesson", "make it available", "show this lesson to [learner]"
- This is NOT scheduling. It updates learner availability (approved lessons) without picking a date.
- Must ALWAYS call function (never confirm assignment without actually calling)
- Requires lessonKey from prior search/generation

### Post-Lesson Next Step (Schedule vs Assign)

When Mr. Mentor has identified a specific lesson (from search or generation) and the facilitator has a learner selected, he should offer both options:

- Ask: "Would you like me to schedule this lesson, or assign it to [learner]?"
- Judge the response:
       - If they clearly want scheduling, proceed with `schedule_lesson` (and collect a date if needed)
       - If they clearly want assignment/availability, proceed with `assign_lesson`

After completing `assign_lesson`, Mr. Mentor must confirm in dialogue:

### 12. docs/brain/mr-mentor-conversation-flows.md (702a9fd80a5cfdb20198851630f5bd2294e3590b38a912d5f7058ef0f693bf2f)
- bm25: -19.3221 | relevance: 1.0000

- **2025-12-31:** Appended multi-screen overlay system documentation (CalendarOverlay, LessonsOverlay, GeneratedLessonsOverlay, LessonMakerOverlay)
- **2025-12-18:** Created brain file documenting recommendations vs generation decision logic and escape hatches (fix for locked-in generation flow)

### 13. docs/brain/lesson-notes.md (ac258ad493dde9c766703881b36300ddf044039fc14bddb8ce88bf9914d1a3ef)
- bm25: -18.7849 | relevance: 1.0000

if (notesKeys.length > 0) {
  lines.push(`FACILITATOR NOTES ON LESSONS:`);
  notesKeys.sort().forEach(key => {
    const [subject, lessonName] = key.split('/');
    lines.push(`${subject} - ${lessonName}:`);
    lines.push(`  "${lessonNotes[key]}"`);
  });
}
```

**Use cases:**
- **Progress tracking**: "Completed with 95%. Ready for next level." → Mr. Mentor suggests advanced materials
- **Challenge documentation**: "Struggles with word problems. Anxious during tests." → Suggests scaffolding/anxiety strategies
- **Interest tracking**: "Loves hands-on experiments. Wants to learn chemistry." → Suggests enrichment resources
- **Behavioral context**: "Easily distracted. Works better in morning sessions." → Suggests schedule optimization

## Key Files

- `src/app/facilitator/lessons/page.js` - Note UI (add/edit/save), state management, Supabase updates
- `src/app/facilitator/calendar/LessonNotesModal.jsx` - Notes modal used from Calendar schedule lists
- `src/app/lib/learnerTranscript.js` - Transcript builder, includes notes section
- `src/app/api/counselor/route.js` - Receives transcript with notes

## What NOT To Do

**DON'T make notes too long** - No character limit enforced, but excessively long notes bloat Mr. Mentor's context window. Keep notes concise (1-3 sentences per lesson).

**DON'T duplicate medal data** - Medals already appear in transcript. Notes should add *new* context (challenges, interests, behavior) not already captured elsewhere.

**DON'T fail to update notes** - Stale notes mislead Mr. Mentor. Encourage facilitators to update notes as learner progresses.

**DON'T forget empty note deletion** - Save function correctly deletes empty notes from JSONB object (avoids storing null/empty values).

### 14. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -17.8102 | relevance: 1.0000

- **`src/app/session/components/SessionVisualAidsCarousel.js`** - Learner session display
  - Full-screen carousel during lesson
  - "Explain" button triggers Ms. Sonoma TTS of description
  - Read-only view (no editing)

### Integration Points
- **`src/app/facilitator/lessons/edit/page.js`** - Lesson editor
  - `handleGenerateVisualAids()` - initiates generation
  - Manages visual aids state and save flow

- **`src/app/facilitator/calendar/DayViewOverlay.jsx`** - Calendar scheduled-lesson inline editor
  - Provides the same "Generate Visual Aids" button as the regular editor via `LessonEditor` props
  - Loads/saves/generates via `/api/visual-aids/*` with bearer auth
  - Renders `VisualAidsCarousel` above the inline editor modal

- **`src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx`** - Mr. Mentor counselor
  - `handleGenerateVisualAids()` - generation from counselor lesson creation

- **`src/app/session/page.js`** - Learner session
  - Loads visual aids by normalized `lessonKey`
  - `onShowVisualAids()` - opens carousel
  - `onExplainVisualAid()` - triggers Ms. Sonoma explanation

- **`src/app/session/v2/SessionPageV2.jsx`** - Learner session (V2)
  - Loads visual aids by normalized `lessonKey`
  - Video overlay includes a Visual Aids button when images exist
  - Renders `SessionVisualAidsCarousel` and uses AudioEngine-backed TTS for Explain

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

### `/api/counselor`
**Purpose**: Mr. Mentor counselor chat endpoint (facilitator-facing)  
**Status**: Operational

### 16. docs/brain/mr-mentor-conversation-flows.md (bb04765302248e45513f25a1ec923d2f1e43ca671594a8c000ee0ab9d9d67fac)
- bm25: -16.1975 | relevance: 1.0000

### Visual Design
- Buttons use emoji icons for quick recognition
- Active button has blue border and light blue background
- Inactive buttons have gray border and white background
- All overlays use consistent styling with gradient headers
- Fully responsive and scrollable

### File Structure
```
src/app/facilitator/tools/counselor/
├── CounselorClient.jsx (main component - updated)
├── ClipboardOverlay.jsx (existing)
└── overlays/
    ├── CalendarOverlay.jsx
    ├── LessonsOverlay.jsx
    ├── GeneratedLessonsOverlay.jsx
    └── LessonMakerOverlay.jsx
```

### Usage
1. **Viewing Different Screens**: Click emoji buttons to switch views
2. **Learner Selection**: Available in most overlays; syncs with main dropdown
3. **Returning to Video**: Click 👨‍🏫 button to return to Mr. Mentor video

### Props Flow
- `learners` array passed from parent to overlays
- `selectedLearnerId` synced across all components
- `tier` passed to LessonMaker for quota checks
- All overlays handle their own data fetching

### Responsive Behavior
- Overlays fill entire video panel area
- Scrollable content areas for long lists
- Compact headers to maximize content space
- Works in both portrait and landscape modes

---

## Related Brain Files

- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Session ownership, device takeover, conversation persistence
- **[MentorInterceptor_Architecture.md](MentorInterceptor_Architecture.md)** - Mr. Mentor counselor system architecture

---

## Changelog

### 17. docs/brain/lesson-library-downloads.md (ea6c987f912e08a4811e52893de3701d5c14ec17ac6ba2a12fed4b2d9135d9b9)
- bm25: -15.9750 | relevance: 1.0000

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

### 20. docs/brain/portfolio-generation.md (e083fdfcd6e4035528697e6c1609dd20b75c22e0849fc326d799b41cbb6a114a)
- bm25: -14.2574 | relevance: 1.0000

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

- **[ai-rewrite-system.md](ai-rewrite-system.md)** - AI rewrite improves DALL-E 3 prompts for visual aid generation
- **[ms-sonoma-teaching-system.md](ms-sonoma-teaching-system.md)** - Visual aids displayed during teaching phase

## Key Files

### API Routes
- **`src/app/api/visual-aids/generate/route.js`** - Main generation endpoint
  - Prompt creation (GPT-4o-mini)
  - DALL-E 3 image generation with no-text suffix
  - Kid-friendly description generation
  - Returns array of `{ url, prompt, description, id }`

- **`src/app/api/visual-aids/save/route.js`** - Permanent storage
  - Downloads DALL-E image from temporary URL
  - Uploads to Supabase `visual-aids` bucket
  - Saves metadata to `visual_aids` table
  - Returns permanent URL

- **`src/app/api/visual-aids/load/route.js`** - Fetch by lesson
  - Query: `?lessonKey=<key>`
  - Returns all visual aids for a lesson with permanent URLs

- **`src/app/api/visual-aids/rewrite-description/route.js`** - Description improvement
  - Converts user descriptions into kid-friendly Ms. Sonoma language

- **`src/app/api/ai/rewrite-text/route.js`** - Prompt improvement
  - Purpose: `visual-aid-prompt-from-notes` - converts teaching notes to image guidance
  - Purpose: `generation-prompt` - improves existing prompts for DALL-E

### 24. docs/brain/facilitator-hub.md (da9aec6fdfc1ea2738cb90fb2977c145f037ea8248bca3683693f7940f7ecae9)
- bm25: -13.2175 | relevance: 1.0000

# Facilitator Hub

## How It Works

The Facilitator hub is the main entry point for facilitator workflows at `/facilitator`.

- It shows a small grid of primary sections (cards) that route to key areas.
- It displays the current subscription tier as informational status.
- Billing is treated as part of **Account** (plan + billing lives under `/facilitator/account/*`).

## What NOT To Do

- Do not add a separate "Billing" section on the hub. Billing navigation belongs under **Account**.
- Do not duplicate billing management UIs on the hub. Use the account plan/billing pages.

## Key Files

- `src/app/facilitator/page.js` - Facilitator hub cards and subscription status display
- `src/app/facilitator/account/page.js` - Account hub (settings overlays)
- `src/app/facilitator/account/plan/page.js` - Plans & billing entry point
- `src/app/billing/manage/*` - Billing portal UI

### 25. docs/brain/session-takeover.md (67d6f1cc34af6fd217783490d4f011c8cef30e9a03ac7f4e9f0c5692245348e3)
- bm25: -13.0742 | relevance: 1.0000

## Timer Continuity Details

**Timer state components:**
- `currentTimerMode`: 'play' (Begin to Go) or 'work' (Go to next phase)
- `workPhaseCompletions`: object tracking which phases completed work timer
- `elapsedSeconds`: current countdown value
- `targetSeconds`: phase-specific target (from runtime config)
- `capturedAt`: ISO timestamp when snapshot saved

**Snapshot capture (every gate):**
```javascript
timerSnapshot: {
  phase: phase,
  mode: currentTimerModeRef.current || currentTimerMode,
  capturedAt: new Date().toISOString(),
  elapsedSeconds: getElapsedFromSessionStorage(phase, currentTimerMode),
  targetSeconds: getTargetForPhase(phase, currentTimerMode)
}
```

**Restore logic:**
```javascript
const { timerSnapshot } = restoredSnapshot;
if (timerSnapshot) {
  const drift = Math.floor((Date.now() - new Date(timerSnapshot.capturedAt)) / 1000);
  const adjustedElapsed = Math.min(
    timerSnapshot.elapsedSeconds + drift,
    timerSnapshot.targetSeconds
  );
  
  // Write to sessionStorage (source for timer component)
  sessionStorage.setItem(
    `timer_${timerSnapshot.phase}_${timerSnapshot.mode}`,
    JSON.stringify({
      elapsedSeconds: adjustedElapsed,
      startTimestamp: Date.now() - (adjustedElapsed * 1000)
    })
  );
  
  setCurrentTimerMode(timerSnapshot.mode);
}
```

**Result:** Timer continues within ±2 seconds of where old device left off (gate save latency + network round-trip).

## PIN Validation Security

**Already implemented** in `page.js` lines 286-314:
- Client calls `ensurePinAllowed(pinCode)` from `src/app/lib/pinAuth.js`
- Server validates PIN hash against learner's stored scrypt hash
- Only correct PIN allows session takeover
- Failed PIN shows error, user can retry

### 26. docs/brain/api-routes.md (f1ee4af5914ccd9a2266616f7f17e803bc3681e9206331fe1c7a011816c5bc08)
- bm25: -12.8678 | relevance: 1.0000

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

### `/api/tts`
**Purpose**: Text-to-speech conversion (Google TTS)  
**Status**: Operational, used for all Ms. Sonoma audio

### `/api/visual-aids/generate`
**Purpose**: Generate visual aid images via DALL-E 3  
**Status**: Operational, see `docs/brain/visual-aids.md`

### 27. docs/brain/MentorInterceptor_Architecture.md (beb91c6e7f8983432a0bd86cb52a457104626ef63585fbbd7538effbe9fa1fe0)
- bm25: -12.8330 | relevance: 1.0000

## Notes

- Interceptor is **stateful** (conversation state machine) but **not persisted** (resets on page refresh)
- All responses use same TTS voice as Mr. Mentor API
- Conversation history includes both interceptor and API responses
- Action execution triggers UI changes (screen overlays) and API calls (schedule)
- Interceptor can hand off to API mid-conversation if needed
- "More" handling in recall flow maintains state for pagination
- Fuzzy matching allows natural language flexibility
- Confirmation flows prevent accidental actions
- Parameter gathering is patient (re-asks if unclear)
- Bypass commands give users escape hatch

## Related Brain Files

- **[mr-mentor-conversation-flows.md](mr-mentor-conversation-flows.md)** - Backend function calling and generation vs recommendation logic
- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Session ownership and conversation persistence

## Open Questions

- Should interceptor state persist in sessionStorage?
- Should we cache allLessons to avoid reloading on every message?
- Should generate action open maker overlay with pre-filled form?
- Should edit action open editor with AI rewrite pre-populated?
- Should we add intent confidence thresholds before handling?
- Should unclear intents ask clarifying questions or forward to API?
- Should we track interceptor analytics (hit rate, time saved)?

### 28. docs/brain/v2-architecture.md (dcea5ecf862257a5f80f2259d150c9f5b9ae6ce42bb7e280b9ad10ee41710f36)
- bm25: -12.8121 | relevance: 1.0000

**V2 Implementation:**
- `src/app/session/v2/SessionPageV2.jsx` - Complete session flow UI (3500+ lines, includes comprehension logic)
- `src/app/session/v2/AudioEngine.jsx` - Audio playback system (600 lines)
- `src/app/session/v2/TeachingController.jsx` - Teaching stage machine with TTS (400 lines)
- `src/app/session/v2/ComprehensionPhase.jsx` - DEPRECATED, not used (comprehension handled inline in SessionPageV2)
- `src/app/session/v2/DiscussionPhase.jsx` - Discussion activities (200 lines)
- `src/app/session/v2/ExercisePhase.jsx` - Exercise questions with scoring (300 lines)
- `src/app/session/v2/WorksheetPhase.jsx` - Fill-in-blank questions (300 lines)
- `src/app/session/v2/TestPhase.jsx` - Graded test with review (400 lines)
- `src/app/session/v2/ClosingPhase.jsx` - Closing message with encouragement (150 lines)
- `src/app/session/v2/PhaseOrchestrator.jsx` - Session phase management (150 lines)
- `src/app/session/v2/SnapshotService.jsx` - Session persistence (300 lines)
- `src/app/session/v2/TimerService.jsx` - Session and work phase timers (350 lines)
- `src/app/session/v2/KeyboardService.jsx` - Keyboard hotkey management (150 lines)
- `src/app/session/v2/services.js` - API integration layer (TTS + lesson loading, includes question pools)
- `src/app/session/v2test/page.jsx` - Direct test route

### 29. docs/brain/mr-mentor-conversation-flows.md (275b0271e1e22eff331c8f0b7a6425c14f322de3d0f011431c2bdf08e5c69cf7)
- bm25: -12.4519 | relevance: 1.0000

### Scenario 2: Escape During Collection
```
User: "Generate a 4th grade math lesson"
Mr. Mentor: "What difficulty?"
User: "Stop. I don't want to generate. Give me advice."
Expected: "Let me search for 4th grade math lessons instead..."
Actual (before fix): Continued asking "Please choose: beginner, intermediate..."
```

### 30. docs/brain/mr-mentor-sessions.md (973e3de11950f5a0be1e7f5a77ab27d5a507cadd8918e997a510b58184d1a6d2)
- bm25: -12.2866 | relevance: 1.0000

**Initialization** (`src/app/facilitator/generator/counselor/CounselorClient.jsx`):
1. Generate/reuse a unique `sessionId`, persist it to sessionStorage/localStorage
2. Wait for accessToken and tier validation
3. `GET /api/mentor-session?sessionId={id}`
4. If another device owns the active session → show `SessionTakeoverDialog`
5. If no active session exists → `POST /api/mentor-session` with `action: 'initialize'`
6. Load `conversation_history` and `draft_summary` from the returned session
7. Start conflict detection (realtime + heartbeat)

**Conflict detection:**

- Realtime subscription listens to `mentor_sessions` updates for fast takeover detection.
- Heartbeat polling runs as a backup (`GET /api/mentor-session?sessionId={id}` every ~3 seconds).
- If an active session exists and `isOwner` is false:
  - Clear the persisted session id
  - Reset local conversation state
  - Show `SessionTakeoverDialog` with the active session info

**Conversation Persistence:**
- Every change to `conversationHistory` or `draftSummary` triggers debounced `PATCH` (1 second delay)
- On "New Conversation" click: `DELETE /api/mentor-session?sessionId={id}`

## Components

**`SessionTakeoverDialog.jsx`** - Modal for takeover flow

Props:
```jsx
{
  existingSession: {
    session_id: string,
    device_name: string,
    last_activity_at: string (ISO timestamp)
  },
  onTakeover: (pinCode: string) => Promise<void>,
  onForceEnd?: (pinCode: string) => Promise<void>,
  onCancel: () => void
}
```

Features:
- Displays device name and last activity timestamp
- 4-digit PIN input (numeric only)
- "Take Over Session" button (calls `onTakeover`)
- "Force End Session" button (calls `onForceEnd` to release frozen session)
- Warning about consequences
- Cancel button returns to facilitator page

### 31. docs/brain/goals-clipboard.md (44567a922c7f4e2752c78dcf5e5ce1b6adee66a4798a530df7716d58eb8b95b2)
- bm25: -12.1822 | relevance: 1.0000

# Goals Clipboard

## How It Works

Facilitators can set persistent goals and priorities for themselves or specific learners. These goals are automatically included in every Mr. Mentor conversation to provide context and guide discussions.

**Flow:**
1. Click 📋 button in top left of Mr. Mentor video (highlights yellow when goals are set)
2. Enter up to 600 characters of goals/priorities in overlay
3. Goals save automatically per learner (when learner selected) or for facilitator (when no learner)
4. On learner switch, goals auto-load from database
5. Every Mr. Mentor API call receives goals in system prompt under "PERSISTENT GOALS & PRIORITIES"
6. Mr. Mentor can reference goals, suggest using the feature, and guide based on stated objectives

**Purpose**: Provides long-term context that persists across all conversations, enabling Mr. Mentor to give data-informed, goal-aligned guidance without re-explaining objectives every session.

## Database Schema

**Learners table:**
```sql
ALTER TABLE learners 
ADD COLUMN IF NOT EXISTS goals_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_learners_goals_notes 
ON learners(id) WHERE goals_notes IS NOT NULL;
```

**Profiles table (facilitator goals when no learner selected):**
```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS goals_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_goals_notes 
ON profiles(id) WHERE goals_notes IS NOT NULL;
```

## API Integration

**`/api/goals-notes` endpoints:**

**GET**: Load goals for current context
- Query param: `learner_id` (optional)
- If `learner_id` provided: returns `learners.goals_notes`
- If no `learner_id`: returns `profiles.goals_notes` for facilitator
- Returns: `{ success: true, goals_notes: "..." }`

### 32. docs/brain/mr-mentor-conversation-flows.md (b092cfb0641074435856e69633799ea1e14b0c7b1d03a8076be2d125e178142e)
- bm25: -12.1078 | relevance: 1.0000

#### Layer 1: Confirmation Before Parameter Collection (Primary Defense)
When intent is ambiguous, Mr. Mentor should ASK before starting parameter collection:

**Question:** "Would you like me to generate a custom lesson?"

**Only proceed with generation if user confirms:**
- "yes, generate"
- "create one"
- "make a lesson"
- Clear affirmative for generation

**Switch to search/recommend if user says:**
- "no"
- "search"
- "recommend"
- "I'm not sure"
- "show me what you have"
- Anything other than clear generation confirmation

**Why This Works:** Prevents awkward parameter collection when user just wanted recommendations. Gives user explicit choice before committing to generation flow.

#### Layer 2: Escape During Parameter Collection (Backup Defense)

**           |
             v
           Call generate_lesson function
```

---

### Escape Hatch Mechanism

**Problem:** Once parameter collection begins, GPT-4o function calling wants to complete required parameters before executing function. This creates a "locked in" experience where user can't back out.

**Solution:** Explicit escape instructions in system prompt:

```
If user says during parameter collection:
- "stop"
- "no"
- "I don't want to generate"
- "give me advice instead"
- "I don't want you to generate the lesson"
Skip Confirmation When Intent Is Ambiguous
```
User: "I need a language arts lesson but I don't want one of the ones we have in 
       the library. It should have a Christmas theme, please make some recommendations."

WRONG: "Is this lesson for Emma's grade (4)?"
RIGHT: "Would you like me to generate a custom lesson?"
       (If they say no: "Let me search for Christmas-themed language arts lessons...")
```

### 33. docs/brain/pin-protection.md (3aa2a8e5f407ed24098e9d06429a29a96012af85911782bdf9d220a708346647)
- bm25: -12.0850 | relevance: 1.0000

### Preferences

PIN preferences are stored in:
- Server: `profiles.pin_prefs` (JSON column)
- Client: `localStorage.facilitator_pin_prefs` (cached copy)

Default preferences (when PIN exists but prefs not set):
```javascript
{
  downloads: true,
  facilitatorKey: true,
  skipTimeline: true,
  changeLearner: true,
  refresh: true,
  timer: true,
  facilitatorPage: true,
  activeSession: true
}
```

## What NOT To Do

**❌ DON'T** set facilitator section flag for non-facilitator actions
- Only `facilitator-page` action and session-exit-to-facilitator navigation should set the flag
- Setting it for other actions would allow bypassing PIN on facilitator pages

**❌ DON'T** store PIN in localStorage
- PIN verification is server-only for security
- Never cache PIN validation results beyond sessionStorage flag

**❌ DON'T** create multiple PIN prompts simultaneously
- `ensurePinAllowed` uses global lock (`activePinPrompt`) to prevent concurrent prompts
- If another prompt is active, wait for its result

**❌ DON'T** forget to clear facilitator section flag when leaving facilitator routes
- FacilitatorSectionTracker handles this automatically
- Manual flag clearing should match its logic

**❌ DON'T** use `ensurePinAllowed` for non-gated features
- Only call it when you genuinely need to gate an action
- Unnecessary calls degrade user experience

## Key Files

**Core Logic**:
- `src/app/lib/pinGate.js` - PIN validation, section tracking, preferences
- `src/app/api/facilitator/pin/route.js` - Get PIN state, preferences
- `src/app/api/facilitator/pin/verify/route.js` - Server PIN verification

**Navigation Integration**:
- `src/app/HeaderBar.js` - Navigation PIN checks, facilitator flag setting
- `src/components/FacilitatorSectionTracker.jsx` - Section flag lifecycle

### 34. docs/brain/session-takeover.md (1f835d163bf68929a4e5f34cd5f4cffe3ef482a5e6b64ab8f8d4977332da7266)
- bm25: -12.0329 | relevance: 1.0000

**Result**: When play timer expires with page closed, restore automatically:
1. Sets countdown completed flag (blocks countdown)
2. Transitions timer to work mode
3. Triggers phase handler to start work phase
4. User lands directly in work phase entrance, can click Go to begin

**Key Files:**
- `src/app/session/page.js`: Flag setting in completion handlers, not in handlePlayTimeUp
- `src/app/session/hooks/useSnapshotPersistence.js`: Detect expired timer on restore, auto-transition
- `src/app/session/sessionSnapshotStore.js`: Persist flag in snapshot

### Database Schema

#### `lesson_sessions` Table Extensions

**New columns:**
```sql
ALTER TABLE lesson_sessions
  ADD COLUMN session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN device_name TEXT,
  ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX unique_active_lesson_session 
  ON lesson_sessions (learner_id, lesson_id) 
  WHERE ended_at IS NULL;
```

**Trigger: Auto-deactivate old sessions (data integrity)**
```sql
CREATE OR REPLACE FUNCTION deactivate_old_lesson_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- When inserting a new active session, close any existing active session for same learner+lesson
  IF NEW.ended_at IS NULL THEN
    UPDATE lesson_sessions
    SET ended_at = NOW()
    WHERE learner_id = NEW.learner_id
      AND lesson_id = NEW.lesson_id
      AND ended_at IS NULL
      AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_deactivate_old_lesson_sessions
  BEFORE INSERT ON lesson_sessions
  FOR EACH ROW
  EXECUTE FUNCTION deactivate_old_lesson_sessions();
```

**Purpose**: Database enforces single-session constraint even if application logic fails. Ensures no orphaned active sessions.

### Checkpoint Gates (Where Conflicts Detected)

### 35. docs/brain/ai-rewrite-system.md (316854d4d2bc71c0ac5f86896adc58c38b29b41d22194aff261c0a1ca02bde82)
- bm25: -11.8770 | relevance: 1.0000

## Related Brain Files

- **[visual-aids.md](visual-aids.md)** - AI rewrite optimizes DALL-E 3 prompts for visual aid generation
- **[lesson-editor.md](lesson-editor.md)** - AIRewriteButton integrated in lesson editor for content improvement

## Key Files

- `src/components/AIRewriteButton.jsx` - Reusable button component
- `src/app/api/ai/rewrite-text/route.js` - Rewrite API endpoint
- `src/components/VisualAidsCarousel.jsx` - Current usage example

## What NOT To Do

- Never expose rewrite API publicly (requires auth)
- Never skip purpose parameter (determines prompt style)
- Never rewrite without user trigger (button click required)
- Never cache rewritten text globally (user-specific content)

### 36. docs/brain/ms-sonoma-teaching-system.md (cede03814a8e282c9f02f9885e01f2a1ed833b57c04cd2aef304bf98f2d7f4ba)
- bm25: -11.6708 | relevance: 1.0000

## Related Brain Files

- **[tts-prefetching.md](tts-prefetching.md)** - TTS powers audio playback for Ms. Sonoma speech
- **[visual-aids.md](visual-aids.md)** - Visual aids displayed during teaching phase

## Key Files

### Core API
- `src/app/api/sonoma/route.js` - Main Ms. Sonoma API endpoint, integrates content safety validation

### Content Safety
- `src/lib/contentSafety.js` - Lenient validation system: prompt injection detection (always), banned keywords (reduced list, skipped for creative features), instruction hardening (primary defense), output validation with skipModeration=true (OpenAI Moderation API bypassed to prevent false positives like "pajamas" flagged as sexual)

### Teaching Flow Hooks
- `src/app/session/hooks/useTeachingFlow.js` - Orchestrates teaching definitions and examples stages

### Phase Handlers
- `src/app/session/hooks/usePhaseHandlers.js` - Manages phase transitions (comprehension, exercise, worksheet, test)

### Session Page
- `src/app/session/page.js` - Main session orchestration, phase state management

### Brand Signal Sources (Read-Only)
- `.github/Signals/MsSonoma_Voice_and_Vocabulary_Guide.pdf`
- `.github/Signals/MsSonoma_Messaging_Matrix_Text.pdf`
- `.github/Signals/MsSonoma_OnePage_Brand_Story.pdf`
- `.github/Signals/MsSonoma_Homepage_Copy_Framework.pdf`
- `.github/Signals/MsSonoma_Launch_Deck_The_Calm_Revolution.pdf`
- `.github/Signals/MsSonoma_SignalFlow_Full_Report.pdf`

### Data Schema
- Supabase tables for lesson content, vocab terms, comprehension items
- Content safety incidents logging table

## Notes
