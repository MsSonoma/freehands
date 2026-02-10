# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Mr. Mentor Calendar overlay: where is it implemented, and how does it load planned lessons, scheduled lessons, and completed lessons? Compare to the main Calendar page and identify any divergence or stale sources (e.g., timezone date keys, lesson_schedule, lesson_session_events, medals).

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

### 1. docs/brain/lesson-notes.md (ba1927d5f15444bd06ae20de79a25c5719c23ee58aaed5fda05b53a8bd35dbd8)
- bm25: -36.2172 | relevance: 1.0000

# Lesson Notes

## How It Works

Facilitators can add notes to any lesson in the `facilitator/lessons` page. These notes are stored per learner and automatically included in Mr. Mentor's learner transcript, providing context about specific challenges, progress, or needs.

**Flow (entry points):**
1. Facilitator Lessons page: navigate to `facilitator/lessons`, select learner, expand subject
2. Calendar schedule view (past completed lessons): click **Notes** on a scheduled lesson
3. Mr. Mentor Calendar overlay (past completed lessons): click **Notes** on a scheduled lesson
4. Type note text and save
5. Empty note deletes the key from the JSONB map (no empty-string storage)
5. When facilitator discusses learner with Mr. Mentor, notes appear in transcript:
   ```
   FACILITATOR NOTES ON LESSONS:

math - Multiplication Basics:
     "Struggles with times tables above 5x. Needs more practice with visual aids."

science - Solar System:
     "Very interested in planets, completed ahead of schedule."
   ```
6. Mr. Mentor references notes in responses for data-informed, personalized counseling

**Purpose**: Enables facilitators to document learner-specific observations that persist across lessons, providing Mr. Mentor with longitudinal context for better guidance.

## Database Schema

**Learners table:**
```sql
-- Column added to learners table
lesson_notes jsonb default '{}'::jsonb

-- Structure: { 'subject/lesson_file': 'note text', ... }
-- Example:
{
  "math/Multiplication_Basics.json": "Struggles with times tables above 5x",
  "science/Solar_System.json": "Very interested in planets, completed ahead of schedule"
}
```

## Mr. Mentor Integration

### 2. docs/brain/calendar-lesson-planning.md (3fa72b30c4a36a0855e8b5e9c7f63b5cb1e38fd2725c7bcf9389c3fa8d2b81ed)
- bm25: -35.1192 | relevance: 1.0000

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

### 3. docs/brain/MentorInterceptor_Architecture.md (75fdb0fbddb1f0621d0ed4e1ec4faf69b33ecbed1888eb54a3d9f917aca04bee)
- bm25: -34.9459 | relevance: 1.0000

- **overlays/CalendarOverlay.jsx**
  - Compact, side-by-side calendar UI used inside Mr. Mentor
  - Shows scheduled lessons for the selected learner
  - Loads planned lessons from /api/planned-lessons
  - Month navigation: month/year dropdowns plus adjacent < and > buttons to move one month backward/forward
  - Tabs under the calendar toggle BOTH:
    - The selected-date list: Scheduled vs Planned
    - The calendar date-cell markers/highlights (only the active tab is marked)
  - Tabs remain visible even before selecting a date; list shows a select-a-date hint
  - The selected date label renders below the tabs (not above)
  - Scheduled list actions:
    - Today/future: Edit (full-page editor overlay), Reschedule, Remove
    - Past (completed-only): Notes, Add Image, Remove (typed `remove` confirmation; irreversible warning)
  - Planned list actions: Generate (opens generator overlay for that date), Redo, Remove
  - Overlay stacking rule: full-screen overlays/modals are rendered via React portal to document.body so they are not trapped by spill-suppression/stacking contexts; z-index alone is not sufficient
  - Planned tab CTA: Create a Lesson Plan opens a full-screen Lesson Planner overlay (reuses the Calendar page LessonPlanner)

### 4. docs/brain/calendar-lesson-planning.md (8fb5d6fd52eb343d38244e53af009c1d078e80740d159006615a9235e71a5585)
- bm25: -34.0788 | relevance: 1.0000

# Calendar Lesson Planning System - Ms. Sonoma Brain File

**Last Updated**: 2026-02-05T03:28:35Z  
**Status**: Canonical

## How It Works

### Automated Lesson Plan Generation

The Calendar page includes an automated lesson planner that generates lesson outlines for multiple weeks based on a weekly subject pattern.

**Flow:**
1. Facilitator sets up weekly pattern (which subjects on which days)
2. Selects start date and duration (in months)
3. Clicks "Generate Lesson Plan" 
4. System generates outline for each subject/day combination across specified timeframe
5. **Planned lessons automatically save to database**
6. Planned lessons load from database on page mount or learner change

**Context Integration:**
- Fetches learner's lesson history (completed, incomplete sessions)
- Loads medals/scores for completed lessons
- Gets scheduled lessons
- Retrieves curriculum preferences (focus/banned concepts/topics/words)
- Combines into context string sent to GPT for smarter lesson planning
- Prevents repetition of already-completed topics
- Prevents repetition within the same generation run by adding "generated so far" lessons into later GPT calls

**Within-run anti-repeat rule (important):**
- The planner generates one outline per day/subject slot.
- If the context sent to GPT does not include outlines generated earlier in the same batch, GPT can repeat topics week-to-week because it cannot "see" what it already created.
- The planner must include a short list of already-generated outlines (especially for the same subject) in the context for subsequent outline requests.

### 5. docs/brain/calendar-lesson-planning.md (508134b31ceac5379e6edf01fa6e367c144e9aac1f98d2a85cca866a2cb62f68)
- bm25: -31.4009 | relevance: 1.0000

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

### 6. docs/brain/mr-mentor-conversation-flows.md (ec792e77787419d1b45a207c4f316b72a0b239666251a1dadd891ad81666a1ed)
- bm25: -28.9258 | relevance: 1.0000

### Scenario 3: Recommendation After Search
```
User: "Do you have lessons on fractions?"
Mr. Mentor: [searches, finds 5 lessons]
Mr. Mentor: "I found 5 fraction lessons. Here are the top 3..."
Expected: Offer to generate ONLY if search yields poor results
```

---

## Multi-Screen Overlay System

The Mr. Mentor interface includes a multi-screen overlay system allowing users to switch between video and different tool views without leaving the counselor page.

### Screen Toggle Buttons
Located on same row as "Discussing learner" dropdown, five buttons for switching views:
- **👨‍🏫 Mr. Mentor**: Default video view
- **📚 Lessons**: Facilitator lessons list (scrollable)
- **📅 Calendar**: Lesson calendar panel
- **✨ Generated**: Generated lessons list (scrollable)
- **🎨 Maker**: Lesson creation form

### Overlay Components

All overlay components fit in video screen area, match half-screen format:

**CalendarOverlay** (`overlays/CalendarOverlay.jsx`)
- Shows only calendar panel (not scheduling panel)
- Learner selector at top
- Month/year navigation
- Visual indicators for scheduled lessons
- Shows scheduled lessons for selected date

**LessonsOverlay** (`overlays/LessonsOverlay.jsx`)
- Learner selector
- Subject-based expandable sections
- Grade filters per subject
- Shows approved lessons, medals, progress
- Fully scrollable list

**GeneratedLessonsOverlay** (`overlays/GeneratedLessonsOverlay.jsx`)
- Subject and grade filters
- Status indicators (approved, needs update)
- Scrollable lesson list
- Color-coded by status

**LessonMakerOverlay** (`overlays/LessonMakerOverlay.jsx`)
- Compact lesson generation form
- Quota display
- All fields from full lesson maker
- Inline success/error messages
- Scrollable form

### 7. docs/brain/calendar-lesson-planning.md (5099a67314b21b85fa6a8156e8fd0f3b3e8f5c4ec53943e5cc4e0d17890d9adb)
- bm25: -28.8989 | relevance: 1.0000

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

**`/api/planned-lessons`**
- **GET** `?learnerId=X` - Load all planned lessons for learner, returns `{plannedLessons: {...}}`
- **POST** - Save lesson plan with date-specific overwrite (only replaces dates in new plan), expects `{learnerId, plannedLessons}`
- **DELETE** `?learnerId=X` - Clear all planned lessons for learner

### 9. docs/brain/calendar-lesson-planning.md (1c551999eb292e7d45b7c6306ea7223b5fc642288558019cf5b0b429daccc9cf)
- bm25: -27.4635 | relevance: 1.0000

### ✅ DO: Save planned lessons to database immediately after generation
**Why**: Persistence must be automatic and immediate. User expects generated plan to "just work" across sessions.

### ✅ DO: Load planned lessons on page mount and learner change
**Why**: User switching between learners or returning to page needs to see their saved plans instantly.

### ✅ DO: Handle API failures gracefully with defaults
**Why**: External data should enhance generation, not block it. Default to empty arrays/objects when APIs fail.

### ✅ DO: Use date-specific overwrite for POST saves
**Why**: Allows multiple non-overlapping plans to coexist. Only deletes dates that are in the new plan, preserving all other dates. Enables incremental planning and gap-filling without losing unrelated lessons.

## Related Brain Files

- **[lesson-assessment-architecture.md](lesson-assessment-architecture.md)** - Planner uses medals API from assessment system

## Key Files

**Component:**
- `src/app/facilitator/calendar/page.js` (lines 220-275)
  - `loadPlannedLessons()` - fetch from database on mount/learner change
  - `savePlannedLessons(lessons)` - update state AND persist to database
  - useEffect hooks wire loading to selectedLearnerId changes

- `src/app/facilitator/calendar/LessonPlanner.jsx` (lines 215-410)
  - `generatePlannedLessons()` function - main generation logic
  - Fetches context from multiple APIs
  - Loops through weeks/days/subjects generating outlines
  - Calls `onPlannedLessonsChange(lessons)` with complete plan
  - Handles errors and updates state

### 10. docs/brain/calendar-lesson-planning.md (de0b7e2265d9cfcb4b0c9cd0651ba3db1eb254c5334aa7a65a5b5a4fad4aba17)
- bm25: -27.2420 | relevance: 1.0000

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

### 11. docs/brain/calendar-lesson-planning.md (edc4501d8cf5402f28f2f259c81317facde5d8c4d278692219fb856850a029d8)
- bm25: -26.0161 | relevance: 1.0000

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

### 12. docs/brain/calendar-lesson-planning.md (9173fe378f56c3786b75c00e9b12c63312fc70bdcd188229f8dd2f7466567dc9)
- bm25: -25.6308 | relevance: 1.0000

**What it checks:**
- `lesson_schedule` rows in a date window
- matching `lesson_session_events(event_type='completed')` rows for those scheduled lessons
- `learner_medals` rows for those lessons

### 13. docs/brain/header-navigation.md (17596087776b8a8510ebd6fdda83503d40ccdb8376bc76c97583cafb2888e681)
- bm25: -23.7972 | relevance: 1.0000

# Header Navigation

## How It Works

The global header (HeaderBar) is rendered across pages and provides:

- Brand link to home
- Back button on pages that define a back chain
- Top-level navigation links (About, Learn, Facilitator)
- Session-specific print menu actions

### Session Print Menu

On the Session page, the header shows a printer icon (desktop layout) that opens a small dropdown with print actions.

**Trigger behavior (desktop):** Open on hover (mouseenter) with a short grace period on mouseleave so it does not flicker closed while moving from the icon into the menu.

**Trigger behavior (touch / fallback):** The icon should also toggle the dropdown on click.

The dropdown includes print actions:

- Worksheet
- Test
- Facilitator Key
- Refresh

On narrow layouts, these same actions live inside the hamburger menu under a nested "Print" section.

Important: header buttons (including the print icon) must explicitly set `type="button"` so they never behave like submit buttons when a page happens to include a form.

Also: header dropdown trigger buttons must call `e.stopPropagation()` in their onClick handlers to prevent the opening click from bubbling to document and immediately triggering the outside-click-close listener.

### Facilitator Dropdown

On non-hamburger layouts, mouseovering the "Facilitator" header link opens a small dropdown menu with quick links:

- ⚙️ Account -> `/facilitator/account`
- 🔔 Notifications -> `/facilitator/notifications`
- 👥 Learners -> `/facilitator/learners`
- 📚 Lessons -> `/facilitator/lessons`
- 📅 Calendar -> `/facilitator/calendar`
- 🧠 Mr. Mentor -> `/facilitator/mr-mentor`

The dropdown uses a short hover grace period on mouseleave so it does not flicker closed while moving from the header link down into the menu.

### 14. docs/brain/calendar-lesson-planning.md (4da551360e5a46cca2826bfe58a71289a036bb89df00313db4714021b4cc5eab)
- bm25: -23.3155 | relevance: 1.0000

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

**Visual Aids (Generate / View / Save):**
- Uses the same facilitator Visual Aids system as the regular editor:
  - `GET /api/visual-aids/load?lessonKey=...`
  - `POST /api/visual-aids/generate`
  - `POST /api/visual-aids/save`
- All Visual Aids endpoints require `Authorization: Bearer <access_token>`.
- The inline editor computes a normalized `lessonKey` for visual aids based on the scheduled lesson key:
  - strips the `generated/` prefix (if present)
  - ensures a `.json` suffix
- The Calendar editor renders `VisualAidsCarousel` above the lesson editor modal (z-index passed explicitly).

### 15. docs/brain/portfolio-generation.md (fe1e7ac464f2afc7d7f87532c21ef1729a468f8ae05052009b691a0e808f815e)
- bm25: -23.0077 | relevance: 1.0000

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

### 16. docs/brain/calendar-lesson-planning.md (bad918b02a71d06047328cb4b549e073ad8083ccb4d33488af50cae26e835d4c)
- bm25: -22.8108 | relevance: 1.0000

**Owned-only rule:**
- The picker shows ONLY facilitator-owned lessons.
- It does not list public curriculum lessons from `public/lessons`.

### 17. docs/brain/lesson-notes.md (ac258ad493dde9c766703881b36300ddf044039fc14bddb8ce88bf9914d1a3ef)
- bm25: -21.9046 | relevance: 1.0000

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

### 18. docs/brain/calendar-lesson-planning.md (db1b960e51971b06a27c642e674e9d2199de30b512b88c4bf9712f0b883539ff)
- bm25: -21.8662 | relevance: 1.0000

**2025-12-15**: Changed to date-specific overwrite for planned lessons
- POST now only deletes dates included in the new plan (uses `.in('scheduled_date', newPlanDates)`)
- Multiple non-overlapping plans can coexist (schedule Jan + Mar separately, both persist)
- Overlapping dates are replaced (reschedule Jan 15-31 overwrites only those dates)
- Enables incremental planning and gap-filling without losing unrelated lessons
- Removed full-replacement logic that deleted all planned lessons on every save

### 19. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -20.9762 | relevance: 1.0000

if (!token) {
        setGenerating(false)
        return
      }

// Fetch lesson history (completed, scheduled, planned)
      const [historyRes, medalsRes, scheduledRes, preferencesRes] = await Promise.all([
        fetch(`/api/learner/lesson-history?learner_id=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/medals?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/lesson-schedule?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, { headers: { 'Authorization': `Bearer ${token}` } })
      ])

let lessonContext = []
      let curriculumPrefs = {}

// Build chronological lesson history with scores
      if (historyRes.ok) {
        const history = await historyRes.json()
        let medals = {}
        
        // Get medals if available
        if (medalsRes.ok) {
          medals = await medalsRes.json()
        }
        
        // Completed lessons with scores
        const completed = (history.sessions || [])
          .filter(s => s.status === 'completed')
          .map(s => ({
            name: s.lesson_id,
            date: s.ended_at,
            status: 'completed',
            score: medals[s.lesson_id]?.bestPercent || null
          }))

// Incomplete lessons
        const incomplete = (history.sessions || [])
          .filter(s => s.status === 'incomplete')
          .map(s => ({
            name: s.lesson_id,
            date: s.started_at,
            status: 'incomplete'
          }))

lessonContext = [...completed, ...incomplete]
      }

### 20. docs/brain/gating-system.md (cb1248e270a257df23ad524e2c2b63707ede02617183dccb7aecf99c85524a2b)
- bm25: -20.4275 | relevance: 1.0000

- For in-session buttons (e.g., Games / Visual Aids), keep the UI visible and block only the action with a short, in-context notice.
- For the Facilitator Calendar, do not use a tier overlay that blocks scrolling/clicking. Keep the page viewable and gate only write actions (view-only banner + guarded handlers).
- For Mr. Mentor, keep the page viewable when signed in (no full-screen lock overlay). Load read-only context (e.g., learners, transcripts, notes) without requiring the paid entitlement.
- For Mr. Mentor, gate write paths behind entitlements: sending messages, session initialization/persistence, and any mutations triggered from the Mr. Mentor surface.
- Server routes must enforce the same entitlements (UI gating is not sufficient).

### 21. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -20.0228 | relevance: 1.0000

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

### 22. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (67390ef01280b90390db5de84ee0efb99ee24b709eb07a67d2fca4755f97d83b)
- bm25: -19.9002 | relevance: 1.0000

const plannedFlat = []
      Object.entries(plannedLessons || {}).forEach(([date, arr]) => {
        ;(Array.isArray(arr) ? arr : []).forEach((l) => {
          plannedFlat.push({ date, subject: l.subject, title: l.title, description: l.description })
        })
      })
      if (plannedFlat.length > 0) {
        contextText += '\n\nPlanned lessons already in the calendar plan (do NOT repeat these topics):\n'
        plannedFlat
          .slice()
          .sort((a, b) => String(a.date).localeCompare(String(b.date)))
          .slice(-80)
          .forEach((l) => {
            contextText += `- ${l.date} (${l.subject || 'general'}): ${l.title || l.description || 'planned lesson'}\n`
          })
      }

contextText += '\n\n=== REDO RULES: SAME AS PLANNER GENERATION ==='
      contextText += '\nYou are regenerating a planned lesson outline.'
      contextText += `\nPrefer NEW topics most of the time, but you MAY plan a rephrased Review for low scores (<= ${LOW_SCORE_REVIEW_THRESHOLD}%).`
      contextText += `\nAvoid repeating high-score topics (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%) unless the facilitator explicitly requests it.`
      contextText += "\nIf you choose a Review lesson, the title MUST start with 'Review:' and it must use different examples."
      contextText += '\nDo NOT produce an exact duplicate of any scheduled/planned lesson above.'

### 23. docs/brain/calendar-lesson-planning.md (8471470a735a79332c0085400ffaf63cf33c55dc69d22a40bbf8280784aabc7b)
- bm25: -19.8502 | relevance: 1.0000

**Score-aware repeat policy (important):**
- The planner should prefer new topics, but it is allowed to repeat a concept as a **Review** when prior scores are low.
- Low-score completed lessons are eligible for review; high-score lessons should generally not be repeated soon.
- Review lessons must be rephrased (new framing/examples) and the title should start with `Review:`.
- Outlines may include `kind: "review" | "new"`, and review outlines are title-prefixed for visibility.

### 24. docs/brain/lesson-library-downloads.md (b1b9e213db751b5765dbf2e696989c3293e61bd99e1db9d560a4332ae5c3532e)
- bm25: -19.7895 | relevance: 1.0000

# Lesson Library Downloads (Owned vs Downloadable)

**Status:** Canonical
**Created:** 2026-01-10
**Purpose:** Define how facilitator-visible "download" works without any device storage.

## How It Works

### Concepts

- **Downloadable lesson**: A built-in lesson JSON that exists on the server under `public/lessons/<subject>/...`.
- **Owned lesson**: A facilitator-specific copy of a lesson stored in Supabase Storage under `lessons/facilitator-lessons/<facilitatorId>/<file>.json`.
- **Download action**: Server-side copy from the built-in library into the facilitator's Storage folder (not a device download).

### UX Rules (Facilitator Lessons Page)

- Top-of-page actions:
  - **📝 New Lesson** opens the lesson editor with a blank lesson (no Storage write until the user saves).
  - **✨ Generate Lesson** opens the Lesson Maker flow (`/facilitator/generator`).

- A dropdown filter controls which lessons are shown:
  - **Owned** (default): show only owned lessons (Storage-backed).
  - **Downloadable**: show only downloadable lessons that are not owned.
  - **All Lessons**: show both.

- **Gating**:
  - Downloadable lessons that are not owned show exactly one action: **Download**.
  - After Download succeeds, the owned copy exists and the regular lesson controls appear (Edit, per-learner availability, notes, schedule).

### Prefetch Behavior

- On page mount, the client prefetches built-in lesson lists immediately (no auth required) and loads subjects in parallel.
- Owned lessons are then fetched after auth/session is available and merged into the list.
- This keeps the UI responsive so clicking "Load Lessons" feels instant even if auth is slow.

### Data/Key Rules

### 25. src/app/facilitator/calendar/LessonPlanner.jsx (fd591deb67440b85e69d10a8c0629a0abe24abd9a3d4d3f92016c00b9d8bf080)
- bm25: -19.5330 | relevance: 1.0000

const allSubjects = [...CORE_SUBJECTS, ...customSubjects.map(s => s.name)]

return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Title and Workflow Guide */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: 0 }}>
          Create a Lesson Plan
        </h2>
        <WorkflowGuide
          workflowKey="lesson-planner-workflow"
          title="How Automated Lesson Planning Works"
          steps={[
            { 
              step: 'Set your weekly pattern', 
              description: 'Check which subjects you want to teach on each day of the week below' 
            },
            { 
              step: 'Choose start date and duration', 
              description: 'Select when to begin and how many weeks/months to plan' 
            },
            { 
              step: 'Generate lesson plan', 
              description: 'We create lesson outlines based on your learner\'s history and grade level' 
            },
            { 
              step: 'Review and generate full lessons', 
              description: 'Click dates in the calendar to see planned lessons. Generate full lesson content for any outline you like' 
            }
          ]}
        />
      </div>

### 26. docs/brain/calendar-lesson-planning.md (1855144ade44b43a78489cf3246c6df30aa1531fdb5dbb9a20f4fe3d2898703f)
- bm25: -19.5214 | relevance: 1.0000

### Redo for Planned Lessons (Pre-Scheduling)

Planned lessons (outlines) shown in the day view have a **Redo** action that regenerates the outline before scheduling.

**Redo prompt update:**
- Each planned lesson can optionally store a `promptUpdate` string.
- The UI exposes a "Redo prompt update" field.
- When Redo is clicked, this text is appended to the GPT prompt so the facilitator can steer what changes (e.g., "different topic", "more reading comprehension", "avoid fractions").

**Redo context rule:**
- Redo must include learner history (with scores when available) + current scheduled lessons + planned lessons in the prompt context.
- This prevents Redo from returning the same two outlines repeatedly.

**Redo rule (matches planner):**
- Redo should follow the same score-aware repeat policy as planner generation (new topics preferred; review allowed for low scores; avoid repeating high-score topics).
- Redo additionally supports `promptUpdate` to let the facilitator steer the regeneration.
- Redo should not force every regeneration to be a review; instead, only label as `Review:` when a review is actually chosen.

**Grade source of truth:**
- Planned-lesson outlines must use the selected learner's grade as the default `grade` sent to `/api/generate-lesson-outline`.
- Do not hardcode a default grade like "3rd" at the planner layer; that will leak into every planned lesson and any downstream generator that uses the outline.

**Grade type normalization:**
- Treat `grade` as a string in generator UIs.
- Some data sources store grade as a number (e.g., `3`), which will crash code that assumes `.trim()` exists.

### 27. docs/brain/mr-mentor-conversation-flows.md (32af0ce972bc228b72cbaab4e488efca4dd9a1c0df0c93e692c10279247cf66f)
- bm25: -19.2234 | relevance: 1.0000

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

### 28. docs/brain/calendar-lesson-planning.md (4731161016a2187b2fd087005bddb695c2e3359d6516adcd3465f729348765b2)
- bm25: -18.7333 | relevance: 1.0000

If there is no reliable completion source (no `lesson_session_events` rows and no transcript `completedAt` in storage), but you know which lessons were completed and on what dates, you can insert completion signals and medals directly.

**Script:** `scripts/backfill-manual-completions.mjs`

**Config file format:**
- `learnerName`: learner lookup string (case-insensitive)
- `defaultPercent`: used only when an item omits `percent`
- `items[]`: each entry includes:
  - `lesson_key`: the scheduled lesson key (usually `generated/<filename>.json`)
  - `completed_date`: local `YYYY-MM-DD`
  - optional `percent` (0-100)
  - optional `note` (stored in event metadata)

**What it writes:**
- `lesson_sessions`: creates a minimal session row with `started_at == ended_at` (date-only backfill; uses local noon ISO)
- `lesson_session_events`: inserts `started` + `completed` events for the session
- `learner_medals`: upserts `best_percent` and `medal_tier` keyed by `(user_id, learner_id, lesson_key)` where `lesson_key` is the canonical id (basename without `.json`)

**Dedupe rule:**
- Skips if a `completed` event already exists for the same canonical lesson id on the same local date.

**Safe usage (recommended):**
- Dry-run: `node scripts/backfill-manual-completions.mjs --dry-run --file scripts/<your-config>.json`
- Write: `node scripts/backfill-manual-completions.mjs --write --file scripts/<your-config>.json`

### Verifying Backfill Results (Events + Medals)

To confirm the DB state matches what the Calendar (history) and Medals UI expect, use:

**Script:** `scripts/check-completions-for-keys.mjs`

### 29. docs/brain/calendar-lesson-planning.md (265bc11b6e14ebc78b549a5a598ef082eba677b6a58860236e1c61224231f8bf)
- bm25: -18.5157 | relevance: 1.0000

**`/api/learner/lesson-history`** - completed/incomplete sessions  
**`/api/medals`** - lesson scores (may 404 for new learners)  
**`/api/lesson-schedule`** - scheduled lessons (returns `{schedule: [...]}`)  
**`/api/curriculum-preferences`** - focus/banned content  
**`/api/generate-lesson-outline`** - GPT outline generation per subject/date
  - Supports `context` (planner-built history/schedule/plan context)
  - Supports `promptUpdate` (facilitator-provided steering text, used heavily by Redo)

### 30. docs/brain/custom-subjects.md (7e58ee1ca5dc34b720347edc91b697304897f6b53937497421004d738d51df62)
- bm25: -18.4045 | relevance: 1.0000

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

### 31. docs/brain/mr-mentor-conversation-flows.md (8d38642aa37f8b8a7e6bd2d6e130151a77c5668c362ce9ff98a5f6a237c14f91)
- bm25: -18.2419 | relevance: 1.0000

---

## What NOT To Do

### ❌ DON'T Skip Confirmation When Intent Is Ambiguous
```
User: "I need a language arts lesson but I don't want one of the ones we have in 
       the library. It should have a Christmas theme, please make some recommendations."

WRONG: "Is this lesson for Emma's grade (4)?"
RIGHT: "Would you like me to generate a custom lesson?"
       (If they say no: "Let me search for Christmas-themed language arts lessons...")
```

### ❌ DON'T Trigger Generation on Advice-Seeking Language
```
User: "Emma has one more Language Arts lesson and then it's Christmas vacation. 
       Do you have any suggestions?"

WRONG: Start asking for grade, subject, difficulty
RIGHT: Search language arts lessons, recommend Christmas-themed options
```

### ❌ DON'T Lock Users Into Parameter Collection
```
User: "4th grade Language Arts"
Mr. Mentor: "What difficulty level?"
User: "I don't know that yet. Stop trying to generate the lesson and give me advice."
Mr. Mentor: "Please choose: beginner, intermediate, or advanced."

WRONG: Continue asking for required parameters
RIGHT: "Of course! Let me search for 4th grade Language Arts lessons instead..."
```

### ❌ DON'T Confuse Topic Mention with Generation Request
```
User: "I need something Christmas-themed"

WRONG: Interpret as "generate a Christmas lesson"
RIGHT: Interpret as "search for Christmas-themed lessons"
```

### ❌ DON'T Assume Grade from Context Unless Explicit
```
User: "I want you to recommend them to be generated."
Mr. Mentor: "Is this lesson for Emma's grade (4)?"

WRONG: Assume user wants generation just because they said "generated"
RIGHT: Clarify intent first - "Would you like me to search for existing lessons 
       or help you create a new one?"
```

---

## Key Files

### 32. docs/brain/api-routes.md (f1ee4af5914ccd9a2266616f7f17e803bc3681e9206331fe1c7a011816c5bc08)
- bm25: -18.1363 | relevance: 1.0000

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

### 33. src/app/facilitator/calendar/LessonPlanner.jsx (2cdb279d41617abc41fcf9088b8da7c5c209b33cd6b03cc5f9bccb95193eb4d0)
- bm25: -17.9938 | relevance: 1.0000

// Add scheduled lessons
      if (scheduledRes.ok) {
        const scheduledData = await scheduledRes.json()
        const scheduledLessons = (scheduledData.schedule || []).map(s => ({
          name: s.lesson_key,
          date: s.scheduled_date,
          status: 'scheduled'
        }))
        lessonContext = [...lessonContext, ...scheduledLessons]
      }

### 34. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (5d41b9bf517eebb4d3804a2d02aef902c5ef59c377353f9f57c89608469dd536)
- bm25: -17.9535 | relevance: 1.0000

// Build a completion lookup.
      // Past scheduled dates will show only completed lessons.
      // NOTE: Lessons may be completed after their scheduled date (make-up work).
      let completedKeySet = new Set()
      let completedDatesByLesson = new Map()
      let completionLookupFailed = false
      try {
        const pastSchedule = (data || []).filter(row => row?.scheduled_date && row.scheduled_date < todayStr)
        const minPastDate = pastSchedule.reduce((min, r) => (min && min < r.scheduled_date ? min : r.scheduled_date), null)

### 35. src/app/facilitator/calendar/LessonPlanner.jsx (426d7a2069ad0af30eac2d862612b0b84c4fccada605caa681924ce5f5f81bb4)
- bm25: -17.3864 | entity_overlap_w: 1.10 | adjusted: -17.6614 | relevance: 1.0000

if (lowScoreCompleted.length > 0) {
            contextText += `\n\nLow-score completed lessons that are eligible for REVIEW (<= ${LOW_SCORE_REVIEW_THRESHOLD}%):\n`
            lowScoreCompleted.forEach((l) => {
              contextText += `- ${l.name} (score: ${l.score}%)\n`
            })
          }

if (highScoreCompleted.length > 0) {
            contextText += `\n\nHigh-score completed lessons to AVOID repeating (>= ${HIGH_SCORE_AVOID_REPEAT_THRESHOLD}%):\n`
            highScoreCompleted.forEach((l) => {
              contextText += `- ${l.name} (score: ${l.score}%)\n`
            })
          }

contextText += '\n\nWhen you choose a REVIEW lesson:'
          contextText += '\n- It can revisit the underlying concept of a low-score lesson'
          contextText += '\n- It MUST be rephrased with different examples and practice (not a near-duplicate)'
          contextText += "\n- The title MUST start with 'Review:'"

contextText += '\n\nAlso: you are generating a multi-week plan.'
          contextText += '\nFor weekly recurring subjects, each week MUST progress naturally.'
          contextText += "\nDo not repeat last week's topic unless it is explicitly a 'Review:' for a low-score concept."

contextText += '\n\nCurriculum Evolution Guidelines:'
          contextText += '\n- Mix new instruction with occasional review based on scores'
          contextText += '\n- Build sequentially (e.g., after "Fractions Intro" → "Comparing Fractions" → "Adding Fractions")'
          contextText += '\n- Reference prior concepts but teach something genuinely new'
          contextText += `\n- Target difficulty: ${recommendedDifficulty} (maintain for 3-4 lessons before advancing)`

### 36. docs/brain/mr-mentor-conversation-flows.md (47a7f1d23cc6ab836950913552c45a69e0bbfb20cccb99e80ebdf542e7e579c2)
- bm25: -17.6202 | relevance: 1.0000

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
