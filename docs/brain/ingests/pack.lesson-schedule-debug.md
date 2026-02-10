# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

CalendarOverlay schedule loader: where is it defined, what calls /api/lesson-schedule, and what could cause it to hang/in-flight forever? Anchor on strings: 'schedule: start' and route '/api/lesson-schedule'.

## Forced Context

### F1. docs/brain/manifest.json (c84e253717b47212b1719debc33ac92047bd5a6c13afe3f7e47485e845256ff6)

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

### F2. docs/brain/changelog.md (0e54fa3021f5880823f03c827371d24752fe976456e6c7bf9dc17b57ebbc36ed)

﻿2026-02-09T01:00:04Z | Copilot | Mr. Mentor Calendar overlay now force-refreshes planned/scheduled/completed markers; removes stale self-cache that blocked polling updates [#MentorInterceptor: CalendarOverlay, refresh, planned-lessons] 
2026-02-05T03:28:35Z | Copilot | Fix Calendar LessonPlanner JSX parse error (Duration <select> tag) that broke Vercel Next build [#calendar-lesson-planning: LessonPlanner, JSX, build] 
2026-02-05T00:30:46Z | Copilot | Entitlements: resolveEffectiveTier now considers subscription_tier + plan_tier (Premium->Pro in either) to prevent false lockouts [#gating-system: tier-normalization, resolveEffectiveTier, tier-gates]
2026-02-05T00:25:09Z | Copilot | Mr. Mentor: remove blocking Pro overlay; signed-in view + read-only loads; gate session init and actions behind Pro [#gating-system: window-shopping, view-only, tier-gates] [#mr-mentor-sessions: realtime conflict detection, session takeover, heartbeat polling]
2026-02-04T21:15:00Z | Copilot | Calendar: always viewable when signed in; gate only schedule/plan writes behind Pro (no tier-blocking overlay) [#calendar-lesson-planning: view-only, canPlan, manual-scheduling] [#gating-system: window-shopping, tier-gates, view-only]
2026-02-04T20:59:14Z | Copilot | Normalize legacy plan_tier values (premium/plus/basic) so learner caps and entitlements resolve correctly [#gating-system: tier-gates, useAccessControl, universal-gating]
2026-02-04T19:31:04Z | Copilot | Clean up remaining legacy tier refs (Basic/Plus/Premium) in UI copy, docs, tasks, and schema examples [#gating-system: requiredFeature, requiredTier, window-shopping] [#account-provisioning: provision wrapper, plan_tier values] [#lesson-quota: lessonsPerDay, quota overlay] [#calendar-lesson-planning: lessonPlanner, tier-gate]
2026-02-04T18:14

### F3. docs/brain/changelog.md (734f5012565b6221ab41a07c6ed6a285bb49d94d1fedc65b70806108b10bec2c)

2025-12-15T01:20:00Z | Copilot | FIX: Build failure - incorrect Supabase import path. Import path '@/lib/supabase' does not exist in project. Corrected to '@/app/lib/supabaseClient' matching pattern used throughout codebase (TutorialGuard, PostLessonSurvey, session page, etc). Build now completes successfully. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (corrected getSupabaseClient import path).
2025-12-15T01:15:00Z | Copilot | FIX: Redo button failing with 401 Unauthorized error. Redo button fetch call to /api/generate-lesson-outline did not include Authorization header with auth token. API endpoint requires Bearer token for authentication (checks request.headers.authorization). Added getSupabaseClient import to DayViewOverlay, modified handleRedoClick to fetch session token via supabase.auth.getSession() before API call, added 'Authorization': `Bearer ${token}` header to fetch request. Redo button now successfully regenerates lesson outlines. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (imported getSupabaseClient, updated handleRedoClick to get auth token and include in headers).
2025-12-15T01:00:00Z | Copilot | FEATURE: Implemented color differentiation for scheduled vs planned lessons in calendar. Scheduled lessons display in orange (#fef3c7 bg, #f59e0b indicator), planned lessons display in blue (#dbeafe bg, #3b82f6 indicator). Added isPlannedView prop to LessonCalendar component that determines which color scheme to use. Updated date cell background color logic and indicator dot color to conditionally apply blue for planned view or orange for scheduled view. Calendar page passes isPlannedView={activeTab === 'planner'} prop based on current tab. Visual distinction makes it immediately clear whether viewing scheduled curriculum or planning futu

### F4. docs/brain/changelog.md (db87d0c32f1221d6e92b21aca469566011b9827dda19431e958af521d64f4d87)

2025-12-09T20:30:00Z | Copilot | CRITICAL AUTH FIX v2: Per-user storage isolation instead of per-tab. Previous fix required re-login on every refresh (unacceptable UX). New approach: each USER gets isolated storage namespace, but same user shares auth across all tabs. Custom storage adapter implements Supabase Storage interface, stores auth at supabase-auth-user-<userId> keys. Client instances cached per userId (not singleton). Same user in multiple tabs shares client and auth (stay logged in together). Different users in different tabs use separate storage keys (isolated). Page refresh auto-detects user ID from localStorage, restores correct client (no re-login). Logout propagates to all tabs for that user but not to tabs with different users. Handles legacy migration from default storage key. Files: src/app/lib/supabaseClient.js (custom UserIsolatedStorage class, clientsByUserId Map, user ID auto-detection), docs/brain/auth-session-isolation.md (completely rewritten with per-user architecture). [REVERTED - see 2025-12-09T21:00:00Z]
2025-12-09T20:00:00Z | Copilot | CRITICAL AUTH FIX: Cross-tab auth leakage - logging out in one tab logged out ALL tabs, logging into new account in Tab A switched Tab B to that account. Root cause: Supabase client used default shared localStorage key 'sb-<project>-auth-token' for all tabs. Auth state changes in one tab immediately affected all other tabs via shared localStorage. Solution: Added per-tab unique storageKey using sessionStorage-persisted UUID (supabase-auth-<UUID>). Each tab generates unique storage key on first load, isolating auth sessions. Tab A logout/login no longer affects Tab B. Auth persists within tab across page navigation but refreshing tab generates new UUID (requires re-login, acceptable trade-off vs auth leakage)

## Ranked Evidence

### 1. docs/brain/calendar-lesson-planning.md (de0b7e2265d9cfcb4b0c9cd0651ba3db1eb254c5334aa7a65a5b5a4fad4aba17)
- bm25: -26.6162 | relevance: 1.0000

**Data source and key format:**
- Loads owned lessons via `GET /api/facilitator/lessons/list` (Bearer token required).
- Schedules lessons using `generated/<filename>` keys so `GET /api/lesson-file?key=generated/<filename>` loads from `facilitator-lessons/<userId>/<filename>`.

**Filtering behavior:**
- Subject grouping uses each lesson's `subject` metadata.
- Grade filtering prefers lesson `grade` metadata; falls back to filename conventions when needed.

### Completed Past Scheduled Lessons (History View)

The Calendar schedule view supports showing scheduled lessons on past dates, but only when the lesson was completed.

**Data rule:**
- The schedule loader fetches the learner's schedule history.
- For dates before "today" (local YYYY-MM-DD), scheduled lessons are included only if there is a matching completion event in `lesson_session_events`.

**Completion matching rule:**
- A scheduled lesson is considered completed when there is a `lesson_session_events` row with:
  - `event_type = 'completed'`
  - `lesson_id` matching the scheduled `lesson_key` after canonicalization
  - `occurred_at` (converted to local YYYY-MM-DD) matching **either**:
    - the same `lesson_schedule.scheduled_date` (on-time / same-day), **or**
    - a date within **7 days after** `lesson_schedule.scheduled_date` (make-up completion)

**Make-up window rule (7 days):**
- The Calendar treats “completed later than scheduled” as completed for the scheduled day only within a short window.
- This is specifically to support common homeschool workflows where Monday/Tuesday lessons are completed on Wednesday/Thursday.

### 2. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (c249cd055c36795f0f3913c414e97bf45a642fe0203470cc9d01088f23f23199)
- bm25: -23.7982 | entity_overlap_w: 3.00 | adjusted: -24.5482 | relevance: 1.0000

if (!deleteResponse.ok) throw new Error('Failed to remove lesson')

setScheduledLessons({})
      await loadSchedule()
    } catch (err) {
      alert('Failed to remove lesson')
    }
  }

const handleRescheduleLesson = async (lessonKey, oldDate, newDate) => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

// Find the schedule ID
      const findResponse = await fetch(
        `/api/lesson-schedule?learnerId=${learnerId}&startDate=${oldDate}&endDate=${oldDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

if (!findResponse.ok) throw new Error('Failed to find schedule entry')
      
      const findResult = await findResponse.json()
      const schedules = findResult.schedule || []
      const scheduleItem = schedules.find(s => s.lesson_key === lessonKey && s.scheduled_date === oldDate)
      
      if (!scheduleItem) throw new Error('Schedule entry not found')

// Delete old schedule entry
      const deleteResponse = await fetch(
        `/api/lesson-schedule?id=${scheduleItem.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

if (!deleteResponse.ok) throw new Error('Failed to remove old schedule')

### 3. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (1320e186900475128f12609bff7876536b27cd563472fcb1f0883656ebf86f4b)
- bm25: -23.2289 | entity_overlap_w: 1.50 | adjusted: -23.6039 | relevance: 1.0000

// Create new schedule entry with new date
      const scheduleResponse = await fetch('/api/lesson-schedule', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          learnerId: learnerId,
          lessonKey: lessonKey,
          scheduledDate: newDate
        })
      })

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

**Action execution:**
```javascript
{
  type: 'schedule',
  lessonKey: 'math/4th-multiplying-with-zeros.json',
  scheduledDate: '2025-12-18'
}
```

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

### 7. docs/brain/calendar-lesson-planning.md (9deb51ba2dd90ddaeee2ec696cc923087de9a8728187af5d9b6f9c4fb5277d7d)
- bm25: -22.9167 | relevance: 1.0000

This is separate from Visual Aids:
- **Visual Aids** are lesson-level aids (generated or curated) used during instruction.
- **Portfolio scans** are learner work artifacts (uploaded images/PDFs).

**Storage:**
- Bucket: `transcripts`
- Path prefix:
  - `v1/<facilitatorUserId>/<learnerId>/<lessonKey>/portfolio-scans/<kind>/...`
- `kind` is one of: `worksheet`, `test`, `other`

**API:**
- `GET /api/portfolio-scans/load?learnerId=...&lessonKey=...&kind=worksheet|test|other`
- `POST /api/portfolio-scans/upload` (multipart form-data: `learnerId`, `lessonKey`, `kind`, `files[]`)
- `POST /api/portfolio-scans/delete` (JSON body: `{ learnerId, path }`)

**Auth + ownership rule:**
- All endpoints require `Authorization: Bearer <access_token>`.
- Endpoints fail closed if the learner is not owned by the authenticated facilitator.

### Backfilling Calendar Schedule From Completion History

If you have existing recorded completions but no corresponding `lesson_schedule` rows (so the Calendar looks empty historically), use the backfill script to insert schedule rows for each completed lesson.

**Script:** `scripts/backfill-schedule-from-history.mjs`

**Default source of truth:**
- Uses `lesson_session_events` rows where `event_type = 'completed'`.
- (Legacy) `--source lesson_history` is supported by the script, but the `lesson_history` table may not exist in the current schema; expect it to fail unless you have that table.

**Performance rule (important):**
- When `--learner` is provided, the script queries ONLY those learner rows (case-insensitive exact match) instead of paging every learner.
- This keeps targeted backfills fast (e.g., `--learner Emma,Test`).

### 8. src/app/facilitator/generator/counselor/MentorInterceptor.js (d04d8e10d99dc3007332e68d4a8a38dae8060ca1740d776346d1ecf832122424)
- bm25: -22.4946 | relevance: 1.0000

return {
          handled: true,
          action: {
            type: 'assign',
            lessonKey: this.state.selectedLesson.lessonKey
          },
          response: `I've assigned "${this.state.selectedLesson.title}" to ${learnerName || 'this learner'}. Is that correct?`
        }
      }
      
      if (normalized.includes('edit')) {
        this.state.flow = 'edit'
        this.state.context.lessonKey = this.state.selectedLesson.lessonKey
        this.state.awaitingInput = 'edit_changes'
        
        return {
          handled: true,
          response: `What would you like me to change in ${this.state.selectedLesson.title}?`
        }
      }
      
      if (normalized.includes('discuss')) {
        // Forward to API with lesson context
        return {
          handled: false,
          apiForward: {
            message: userMessage,
            context: {
              selectedLesson: this.state.selectedLesson
            }
          }
        }
      }
      
      return {
        handled: true,
        response: "Would you like to schedule it, assign it, edit it, or discuss it? Please choose one."
      }
    }
    
    // Handle generation parameters
    if (this.state.flow === 'generate') {
      return await this.handleGenerateParameterInput(userMessage, context)
    }
    
    // Handle schedule date input
    if (this.state.awaitingInput === 'schedule_date') {
      const date = extractDate(userMessage)
      
      if (!date) {
        return {
          handled: true,
          response: "I couldn't understand that date. Please try saying something like 'Monday', 'December 18th', or '2025-12-18'."
        }
      }
      
      this.state.context.scheduledDate = date
      this.state.awaitingConfirmation = true
      this.state.awaitingInp

### 9. docs/brain/calendar-lesson-planning.md (265bc11b6e14ebc78b549a5a598ef082eba677b6a58860236e1c61224231f8bf)
- bm25: -21.9514 | entity_overlap_w: 1.50 | adjusted: -22.3264 | relevance: 1.0000

**`/api/learner/lesson-history`** - completed/incomplete sessions  
**`/api/medals`** - lesson scores (may 404 for new learners)  
**`/api/lesson-schedule`** - scheduled lessons (returns `{schedule: [...]}`)  
**`/api/curriculum-preferences`** - focus/banned content  
**`/api/generate-lesson-outline`** - GPT outline generation per subject/date
  - Supports `context` (planner-built history/schedule/plan context)
  - Supports `promptUpdate` (facilitator-provided steering text, used heavily by Redo)

### 10. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (fc6eb29feb3e755d70c6300159228b4f7282977bd0446373cf200186fead2fdb)
- bm25: -21.6674 | entity_overlap_w: 1.50 | adjusted: -22.0424 | relevance: 1.0000

// Get all scheduled lessons for this learner
      const response = await fetch(`/api/lesson-schedule?learnerId=${targetLearnerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

### 11. src/app/facilitator/generator/counselor/CounselorClient.jsx (edd66a96cc6adc70cd1a3eda1a4e179bb1df29fe026d97215ecd7272c65998b1)
- bm25: -21.7073 | relevance: 1.0000

- Title: ${genData.lesson.title}
- Grade: ${genData.lesson.grade}
- Difficulty: ${genData.lesson.difficulty}
- Vocabulary: ${vocab}
- Teaching Notes: ${notes}

As a next step, you might consider adding this lesson to your learner's plan. You can either schedule it on a specific date, or assign it so it shows up as available for ${learnerName || 'this learner'}.

Would you like me to schedule this lesson, or assign it to ${learnerName || 'this learner'}?`

// Set state to await schedule vs assign
                    interceptorRef.current.state.awaitingInput = 'post_generation_action'
                    
                    // Dispatch event to refresh lessons overlay
                    window.dispatchEvent(new CustomEvent('mr-mentor:lesson-generated'))
                  }
                }
              } catch (err) {
                // Generation failed - will show in response
              }
            }
          } else if (action.type === 'edit') {
            // Trigger lesson editor
            setActiveScreen('lessons')
            // Could pass edit instructions as context
          } else if (action.type === 'save_curriculum_preferences') {
            setLoadingThought('Saving curriculum preferences...')

const supabase = getSupabaseClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

### 12. docs/brain/api-routes.md (619d7d8dd7b599f7bab2e31decb90d7a8272127cd3f304a5a4a090e94f8126cb)
- bm25: -21.6876 | relevance: 1.0000

- **Location**: `src/app/api/counselor/route.js`
- **Behavior**: LLM-driven counselor responses with function calling tools for lesson operations
- **Key tools**: `search_lessons`, `get_lesson_details`, `generate_lesson` (confirmation-gated), `schedule_lesson`, `assign_lesson`, `edit_lesson`, conversation memory tools

### 13. docs/brain/api-routes.md (f1ee4af5914ccd9a2266616f7f17e803bc3681e9206331fe1c7a011816c5bc08)
- bm25: -21.6579 | relevance: 1.0000

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

### 14. docs/brain/calendar-lesson-planning.md (9173fe378f56c3786b75c00e9b12c63312fc70bdcd188229f8dd2f7466567dc9)
- bm25: -21.3579 | relevance: 1.0000

**What it checks:**
- `lesson_schedule` rows in a date window
- matching `lesson_session_events(event_type='completed')` rows for those scheduled lessons
- `learner_medals` rows for those lessons

### 15. docs/brain/calendar-lesson-planning.md (ca128987408f6009b4bc0b991a9c397f7bb90b4e589d5d04580e78c782af275e)
- bm25: -21.2091 | relevance: 1.0000

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

### 16. src/app/facilitator/generator/counselor/MentorInterceptor.js (bb7713ee24ede35cb49f6b75db4614268ed8f95e614cb684dba03e123ad3ecf4)
- bm25: -21.1441 | relevance: 1.0000

// Intent detection patterns
const INTENT_PATTERNS = {
  search: {
    keywords: ['find', 'search', 'look for', 'show me', 'do you have', 'what lessons'],
    confidence: (text) => {
      const normalized = normalizeText(text)
      return INTENT_PATTERNS.search.keywords.some(kw => normalized.includes(kw)) ? 0.8 : 0
    }
  },
  
  generate: {
    keywords: ['generate', 'create', 'make', 'build', 'new lesson'],
    confidence: (text) => {
      const normalized = normalizeText(text)
      
      // Check if it's an FAQ-style question about generation (how to)
      const faqPatterns = ['how do i', 'how can i', 'how to', 'what is', 'explain', 'tell me about']
      if (faqPatterns.some(p => normalized.includes(p))) {
        return 0 // Defer to FAQ intent
      }
      
      return INTENT_PATTERNS.generate.keywords.some(kw => normalized.includes(kw)) ? 0.8 : 0
    }
  },
  
  schedule: {
    keywords: ['schedule', 'add to calendar', 'put on', 'assign for', 'plan for'],
    confidence: (text) => {
      const normalized = normalizeText(text)
      
      // Check if it's an FAQ-style question about scheduling (how to)
      const faqPatterns = ['how do i', 'how can i', 'how to', 'what is', 'explain', 'tell me about']
      if (faqPatterns.some(p => normalized.includes(p))) {
        return 0 // Defer to FAQ intent
      }
      
      return INTENT_PATTERNS.schedule.keywords.some(kw => normalized.includes(kw)) ? 0.8 : 0
    }
  },

### 17. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (f403625d9301fe2b3fc7705aa72c288fe285c71ccd02dccfa14211e20d61202f)
- bm25: -20.0769 | entity_overlap_w: 1.50 | adjusted: -20.4519 | relevance: 1.0000

try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const deleteResponse = await fetch(
        `/api/lesson-schedule?id=${scheduleId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      )

### 18. src/app/facilitator/generator/counselor/MentorInterceptor.js (dd9fc7d0f63f857e45b48169025dafbb0d96182f685e4e93f894b4f372b1d6a0)
- bm25: -20.1330 | relevance: 1.0000

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

// Confirmation detection (yes/no)
function detectConfirmation(text) {
  const normalized = normalizeText(text)
  
  const yesPatterns = ['yes', 'yep', 'yeah', 'sure', 'ok', 'okay', 'correct', 'right', 'confirm', 'go ahead', 'do it']
  const noPatterns = ['no', 'nope', 'nah', 'cancel', 'stop', 'nevermind', 'never mind', 'dont', 'not']
  
  if (yesPatterns.some(p => normalized.includes(p))) return 'yes'
  if (noPatterns.some(p => normalized.includes(p))) return 'no'
  
  return null
}

### 19. docs/brain/calendar-lesson-planning.md (3fa72b30c4a36a0855e8b5e9c7f63b5cb1e38fd2725c7bcf9389c3fa8d2b81ed)
- bm25: -20.0203 | relevance: 1.0000

**Completion query rule (visibility > micro-optimization):**
- Do not rely on `.in('lesson_id', [...scheduledKeys])` when loading completion events.
- Because `lesson_id` formats vary, strict filtering can miss valid completions and make past calendar history appear empty.

**Calendar date key rule (marker dots):**
- Calendar grid cells must compute their `YYYY-MM-DD` date keys using local time.
- Do not use `Date.toISOString().split('T')[0]` to build calendar cell keys, because it is UTC-based and can shift the day relative to local dates.
- The schedule grouping keys come from `lesson_schedule.scheduled_date` (already `YYYY-MM-DD`). The calendar grid must use the same format.

**Calendar month focus rule (history discoverability):**
- When a learner is selected on the Schedule tab, the calendar grid should auto-focus to the month containing the most recent scheduled date (preferably a past/completed date when available).
- This prevents the calendar from looking "empty" on the current month when the learner's completed history is in earlier months.

**UI rule (Schedule tab only):**
- For past (completed) scheduled lessons, actions change to:
  - **Notes**: edits `learners.lesson_notes[lesson_key]`.
  - **Visual Aids**: opens Visual Aids manager (load/generate/save) for that `lessonKey`.
  - **Add Images**: uploads new worksheet/test scan files for the learner+lesson (portfolio artifacts; separate from Visual Aids).
  - **Remove**: requires typing `remove` and warns it cannot be undone.

These actions are implemented on:
- The main Calendar page schedule list
- The Calendar Day View overlay schedule list
- The Mr. Mentor Calendar overlay schedule list

### Portfolio Scan Uploads (Worksheet/Test Images)

### 20. docs/brain/calendar-lesson-planning.md (f44485096b054a9a87535ccac6f4c47bff268c03665c1c11f102615685fe7347)
- bm25: -19.6143 | relevance: 1.0000

### Recovering Missing Completion Events From Medals

In some legacy data states, lesson completions exist as **medals** (scores) but are missing `lesson_session_events(event_type='completed')` rows.

This creates a confusing mismatch:
- Learn/Lessons can show a long historical timeline (because it can render medal-earned dates).
- The Calendar history view can look empty (because it depends on completed session events).

If you need Calendar history to reflect the same historical record, backfill completion events from medals.

**Script:** `scripts/backfill-completions-from-medals.mjs`

**Source of truth:**
- Reads `learner_medals` rows and uses `learner_medals.updated_at` as the completion timestamp.
- Uses `learner_medals.lesson_key` as the lesson id (lesson id canonicalization in the Calendar handles mixed formats).

**What it writes (when not dry-run):**
- Inserts a `lesson_sessions` row.
- Inserts a `lesson_session_events` row with:
  - `event_type = 'completed'`
  - `occurred_at = learner_medals.updated_at`
  - `metadata.source = 'medals-backfill'`

**Dedupe rule:**
- Idempotent per learner by `(canonical lesson id + YYYY-MM-DD)`.

**Safe usage (recommended):**
- Dry-run first: `node scripts/backfill-completions-from-medals.mjs --dry-run --learner Emma --from 2025-09-01 --to 2025-10-31`
- Then write: `node scripts/backfill-completions-from-medals.mjs --write --learner Emma --from 2025-09-01 --to 2025-10-31`

**Important follow-up step (required for Calendar visibility):**
- After backfilling completion events, run the schedule backfill so the Calendar has dated `lesson_schedule` rows:
  - Dry-run: `node scripts/backfill-schedule-from-history.mjs --dry-run --learner Emma`
  - Write: `node scripts/backfill-schedule-from-history.mjs --learner Emma`

### 21. docs/brain/mr-mentor-conversation-flows.md (32af0ce972bc228b72cbaab4e488efca4dd9a1c0df0c93e692c10279247cf66f)
- bm25: -19.5862 | relevance: 1.0000

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

### 22. docs/brain/calendar-lesson-planning.md (508134b31ceac5379e6edf01fa6e367c144e9aac1f98d2a85cca866a2cb62f68)
- bm25: -18.6847 | entity_overlap_w: 1.50 | adjusted: -19.0597 | relevance: 1.0000

### Error Handling

**Graceful Degradation:**
- Medals API failure → defaults to empty object, generation continues
- History processing independent of medals availability
- Individual outline generation failures logged but don't stop batch
- Planned lessons load failure → defaults to empty object, page still usable

**API Response Structure:**
- `/api/medals` returns object directly: `{lessonId: {bestPercent: 85}, ...}`
- `/api/lesson-schedule` returns wrapper: `{schedule: [...]}`
- `/api/planned-lessons` returns wrapper: `{plannedLessons: {...}}`

### Page Load Sequence

**Calendar Page Mount:**
1. Check PIN protection
2. Resolve effective tier and entitlements (sets `canPlan` for write actions)
3. Load learners list (always, once authenticated)
4. Select first learner (if available)
5. **Load scheduled lessons** (useEffect on selectedLearnerId)
6. **Load planned lessons** (useEffect on selectedLearnerId)
7. Load no-school dates

**View-only rule (no hard locks):**
- The calendar must remain viewable for authenticated users on all tiers.
- When `canPlan` is false, scheduling/planning/no-school writes are blocked (view-only banner + action guards), but read data still loads.

**Learner Change:**
- Triggers reload of scheduled lessons, planned lessons, and no-school dates

**After Generation:**
- `generatePlannedLessons()` completes → calls `onPlannedLessonsChange(lessons)`
- `savePlannedLessons(lessons)` saves to database only when `canPlan` is true
- Success message shows, lessons appear on calendar immediately

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

### 24. docs/brain/calendar-lesson-planning.md (db16578ca071a92d4edb45a6c6fe7a53ff201ee7cb9639ca7e4198f9403226a8)
- bm25: -18.6134 | relevance: 1.0000

**Safe usage (recommended):**
- Dry-run first: `node scripts/backfill-schedule-from-history.mjs --dry-run`
- Target specific learners: `node scripts/backfill-schedule-from-history.mjs --dry-run --learner Emma,Test`
- Then run real insert: `node scripts/backfill-schedule-from-history.mjs --learner Emma,Test`

**Date conversion:**
- The script defaults to local date extraction from `occurred_at` (use `--tz utc` only if you want UTC date grouping).

**Progress logging:**
- The script prints matched learners and per-learner processing so long runs don't look stuck.

### Recovering Missing Completion Events From Transcript Ledgers

If a lesson was truly completed but there is **no** `lesson_session_events(event_type='completed')` row (so Calendar history stays empty), you can attempt recovery from transcript ledgers.

**Script:** `scripts/backfill-completions-from-transcripts.mjs`

**Source of truth (required):**
- Transcript `ledger.json` segments with a valid `completedAt` timestamp.
- The script scans both:
  - `v1/<ownerId>/<learnerId>/<lessonId>/ledger.json`
  - `v1/<ownerId>/<learnerId>/<lessonId>/sessions/<sessionId>/ledger.json`

**What it writes (when not dry-run):**
- Inserts a `lesson_sessions` row (with `started_at` + `ended_at`).
- Inserts a `lesson_session_events` row with:
  - `event_type = 'completed'`
  - `occurred_at = completedAt`
  - `metadata.source = 'transcripts-backfill'`

**Limitations (important):**
- If there is no `ledger.json` (or it has no `completedAt`) for the target date range, this recovery cannot fabricate a completion.

### 25. docs/brain/MentorInterceptor_Architecture.md (2585991a7684d55feb1914fcd650db4dfa0bc239c1596db3f638e5f2c2a77cde)
- bm25: -18.5742 | relevance: 1.0000

**API call:**
```javascript
POST /api/facilitator/lessons/schedule
{
  learner_id: 'uuid',
  lesson_key: 'math/4th-multiplying-with-zeros.json',
  scheduled_date: '2025-12-18'
}
```

### 26. src/app/facilitator/generator/counselor/MentorInterceptor.js (ad52f792b6b992c82bed565cb13b30bde0789aa2ababb37aa2fede07d9b500a7)
- bm25: -18.3734 | relevance: 1.0000

return {
        handled: true,
        response: `Would you like me to schedule this lesson, or assign it to ${learnerName || 'this learner'}?`
      }
    }
    
    // Handle lesson selection from search results
    if (this.state.awaitingInput === 'lesson_selection') {
      const results = this.state.context.searchResults || []
      
      // Check if user wants to abandon selection and do something else
      const normalized = normalizeText(userMessage)
      const isRejection = normalized.includes('none') || 
                         normalized.includes('neither') || 
                         normalized.includes('not those') ||
                         normalized.includes('different') ||
                         detectConfirmation(userMessage) === 'no'
      
      if (isRejection) {
        // User doesn't want any of the search results
        // Reset state and check if they're making a new request
        this.reset()
        
        // Check if message contains a new intent (generate, schedule, edit, etc.)
        const intents = {}
        for (const [intentName, pattern] of Object.entries(INTENT_PATTERNS)) {
          intents[intentName] = pattern.confidence(userMessage)
        }
        
        const topIntent = Object.entries(intents)
          .filter(([_, score]) => score > 0)
          .sort((a, b) => b[1] - a[1])[0]
        
        if (topIntent) {
          const [intent] = topIntent
          
          // Route to the new intent handler
          switch (intent) {
            case 'generate':
              return await this.handleGenerate(userMessage, context)
            case 'schedule':
              return await this.handleSchedule(userMessage, context)
            case 'assign':
              return await this.handleAssign(userMessage, c

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

**Intent:** User wants to find lessons  
**Examples:** "show me 4th grade math lessons", "find science lessons"

**Steps:**
1. Detect search intent
2. Extract parameters (grade, subject, difficulty)
3. Search allLessons with scoring algorithm
4. Present top 5 results with numbers
5. Await lesson selection (number or name)
6. Ask: "schedule, edit, or discuss?"

**Scoring algorithm:**
- Subject match: +10
- Grade match: +10
- Difficulty match: +5
- Title match (fuzzy): +15

**Selection handling:**
- Number: "1" → first result
- Name: "Multiplying with Zeros" → fuzzy match title

**Action branching:**
- Schedule → Enter schedule flow with lessonKey
- Edit → Enter edit flow with lessonKey
- Discuss → Forward to API with lesson context

### 2. Generate Flow

**Intent:** User wants to create a new lesson  
**Examples:** "create a lesson on fractions", "generate 5th grade science"

### 29. docs/brain/lesson-notes.md (ac258ad493dde9c766703881b36300ddf044039fc14bddb8ce88bf9914d1a3ef)
- bm25: -17.9240 | relevance: 1.0000

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

### 30. docs/brain/MentorInterceptor_Architecture.md (859736bab84d0ee834de1e1f0302bcc99fd52b2eaf052ec25b24ee572d9c187c)
- bm25: -17.7100 | relevance: 1.0000

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

### 32. docs/brain/portfolio-generation.md (fe1e7ac464f2afc7d7f87532c21ef1729a468f8ae05052009b691a0e808f815e)
- bm25: -17.3592 | relevance: 1.0000

# Portfolio Generation System

**Last Updated**: 2026-01-30T15:25:06Z
**Status**: Canonical

## How It Works

The Lesson Calendar page provides a **Generate portfolio** button that builds a shareable, no-login portfolio for a learner across a date range.

### UI Flow

1. Facilitator opens Lesson Calendar.
2. Clicks **Generate portfolio** (header button).
3. Modal collects:
   - Start date (YYYY-MM-DD)
   - End date (YYYY-MM-DD)
   - Include checkboxes: Visual aids, Notes, Images
4. Clicking **Generate Portfolio** calls `POST /api/portfolio/generate`.
5. UI shows a public link to open the portfolio plus a manifest download link.
6. UI also lists previously generated portfolios so they can be re-opened or deleted.

### What Gets Included

The generator produces one portfolio index with per-lesson recap sections.

Per lesson (completed scheduled lessons only):
- **Title**: derived from `lesson_schedule.lesson_key`.
- **Date**: the scheduled date.
- **Notes** (optional): from `learners.lesson_notes[lesson_key]`.
- **Visual aids** (optional): `visual_aids.selected_images` for the facilitator and that lesson.
- **Images / scans** (optional): worksheet/test/other scans uploaded via the Calendar "Add Images" feature.

### Completion Rule (Calendar parity)

Portfolio generation follows the Calendar history rule:
- A scheduled lesson counts as completed if there is a `lesson_session_events` row with `event_type = 'completed'` for the same canonical lesson id either:
  - on the scheduled date, or
  - within 7 days after (make-up window).

Canonical lesson id is the normalized basename without `.json`.

### Storage + Public Access (No Login)

Portfolios are stored as static files in Supabase Storage so reviewers do not need to log in.

### 33. src/app/facilitator/generator/counselor/MentorInterceptor.js (04a62284104fbf05e1228f5a0172c619f26a1f4751051dbebe02e64608a26369)
- bm25: -17.3021 | relevance: 1.0000

if (wantsSchedule || (confirmation === 'yes' && !wantsAssign)) {
        // Move to schedule flow with the generated lesson
        this.state.flow = 'schedule'
        this.state.context.lessonKey = this.state.selectedLesson.lessonKey
        this.state.awaitingInput = 'schedule_date'
        this.state.awaitingConfirmation = false

### 34. src/app/facilitator/generator/counselor/CounselorClient.jsx (60c176bcff82c1e02d73b950e5a574eb068e4dd8a8f796ad6c2a928075a9f4d8)
- bm25: -17.1553 | relevance: 1.0000

// Get loading thought based on interceptor state
  const getLoadingThought = useCallback((flow, awaitingInput, action) => {
    // Action-based thoughts (highest priority)
    if (action?.type === 'generate') {
      return "Generating your custom lesson with AI..."
    }
    if (action?.type === 'schedule') {
      return "Adding this lesson to the calendar..."
    }
    if (action?.type === 'edit') {
      return "Opening the lesson editor..."
    }
    
    // Flow and input-based thoughts
    if (flow === 'generate') {
      if (awaitingInput === 'generate_topic') return "Thinking about lesson topics..."
      if (awaitingInput === 'generate_grade_confirm') return "Checking learner's grade level..."
      if (awaitingInput === 'generate_grade') return "Considering grade levels..."
      if (awaitingInput === 'generate_subject') return "Identifying the subject area..."
      if (awaitingInput === 'generate_difficulty') return "Determining difficulty level..."
      if (awaitingInput === 'generate_title') return "Crafting the perfect title..."
      return "Preparing lesson parameters..."
    }
    
    if (flow === 'schedule') {
      if (awaitingInput === 'schedule_date') return "Looking at the calendar..."
      if (awaitingInput === 'schedule_lesson_search') return "Searching for lessons to schedule..."
      if (awaitingInput === 'post_generation_schedule') return "Reviewing the generated lesson..."
      return "Scheduling the lesson..."
    }
    
    if (flow === 'search') {
      if (awaitingInput === 'lesson_selection') return "Found several matches, reviewing them..."
      return "Searching through your lessons..."
    }
    
    if (flow === 'edit') {
      if (awaitingInput === 'edit_changes') return "Analyzing the requested changes..."
      if (awaiti

### 35. src/app/facilitator/generator/counselor/MentorInterceptor.js (850864fee69ba862040f4b425bee776a85a293507ac7983e123b8fb3f6700fe6)
- bm25: -17.0978 | relevance: 1.0000

if (confirmation === 'yes') {
        this.reset()
        return {
          handled: true,
          response: "Great. What would you like to do next?"
        }
      }

if (confirmation === 'no') {
        const lessonKey = this.state.context?.lastAssignedLessonKey
        const lessonTitle = this.state.context?.lastAssignedLessonTitle
        this.reset()
        if (lessonKey) {
          return {
            handled: true,
            action: {
              type: 'unassign',
              lessonKey
            },
            response: lessonTitle
              ? `Okay — I removed "${lessonTitle}" from that learner's available lessons. What would you like instead?`
              : "Okay — I removed that lesson from the learner's available lessons. What would you like instead?"
          }
        }

return {
          handled: true,
          response: "Okay. What would you like instead?"
        }
      }

return {
        handled: true,
        response: "Please say yes or no."
      }
    }

// Handle post-generation schedule prompt
    if (this.state.awaitingInput === 'post_generation_action') {
      const normalized = normalizeText(userMessage)
      const confirmation = detectConfirmation(userMessage)
      const wantsSchedule = normalized.includes('schedule') || normalized.includes('calendar') || normalized.includes('date')
      const wantsAssign = normalized.includes('assign') || normalized.includes('available') || normalized.includes('show') || normalized.includes('approve')

### 36. docs/brain/facilitator-help-system.md (8c85fd8c620a30ce27d8f5b1a2c1456f132eca5ca12c7325ed760169a9d9da7d)
- bm25: -17.0373 | relevance: 1.0000

### Why Not Just Add Text to Pages?

Beta testers wanted **on-demand** help, not always-visible instructions. Static text:
- Clutters UI for experienced users
- Increases cognitive load
- Doesn't respect dismissal preferences

Collapsible/dismissible components give power users clean interface while supporting new users.

---

## Help Content Guidelines

### Writing Style
- **Short sentences** (6-12 words per sentence, matching Ms. Sonoma style)
- **One idea per sentence** - Don't combine concepts
- **Active voice** - "Click the calendar icon" not "The calendar icon can be clicked"
- **Concrete examples** - "Check Math on Monday, Wednesday, Friday" not "Select subjects for days"
- **No jargon** - "Lesson outlines" not "Curriculum data structures"

### Content Structure
- **Title**: 2-5 words describing the feature
- **First sentence**: What it does (outcome)
- **Second sentence**: When/why to use it (context)
- **Optional third**: Example or caveat

Example:
```jsx
<InlineExplainer title="Weekly Pattern">
  <p>Check the subjects you want to teach on each day.</p>
  <p>This pattern repeats every week for the duration you specify.</p>
  <p>Example: Check "Math" on Monday, Wednesday, Friday to schedule 3 math lessons per week.</p>
</InlineExplainer>
```

### What to Explain

**Explain:**
- Workflows spanning multiple actions (plan → review → generate → schedule)
- Differences between similar features (Scheduler vs Planner, Play vs Work timers)
- Non-obvious consequences (editing scheduled lesson affects all dates)
- Technical concepts users must understand (phases, timers, targets)

**Don't explain:**
- Standard UI patterns (dropdowns, checkboxes, buttons)
- Self-evident actions ("Click Save to save")
- Features with external documentation linked elsewhere

---
