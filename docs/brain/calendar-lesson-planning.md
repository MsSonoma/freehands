# Calendar Lesson Planning System - Ms. Sonoma Brain File

**Last Updated**: 2026-01-12T13:04:42Z  
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

**Grade source of truth:**
- Planned-lesson outlines must use the selected learner's grade as the default `grade` sent to `/api/generate-lesson-outline`.
- Do not hardcode a default grade like "3rd" at the planner layer; that will leak into every planned lesson and any downstream generator that uses the outline.

**Grade type normalization:**
- Treat `grade` as a string in generator UIs.
- Some data sources store grade as a number (e.g., `3`), which will crash code that assumes `.trim()` exists.

**Grade option normalization:**
- The lesson generator grade dropdown expects one of: `K`, `1st`..`12th`.
- If the learner grade is stored as `3` or `"3"`, normalize it to `"3rd"` so the dropdown defaults correctly.

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

**`/api/learner/lesson-history`** - completed/incomplete sessions  
**`/api/medals`** - lesson scores (may 404 for new learners)  
**`/api/lesson-schedule`** - scheduled lessons (returns `{schedule: [...]}`)  
**`/api/curriculum-preferences`** - focus/banned content  
**`/api/generate-lesson-outline`** - GPT outline generation per subject/date

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
2. Check tier access (facilitatorTools required)
3. Load learners list
4. Select first learner (if available)
5. **Load scheduled lessons** (useEffect on selectedLearnerId)
6. **Load planned lessons** (useEffect on selectedLearnerId)
7. Load no-school dates

**Learner Change:**
- Triggers reload of scheduled lessons, planned lessons, and no-school dates

**After Generation:**
- `generatePlannedLessons()` completes → calls `onPlannedLessonsChange(lessons)`
- `savePlannedLessons(lessons)` updates state AND saves to database
- Success message shows, lessons appear on calendar immediately

### Manual Scheduling: "Add Lessons" Picker

The Calendar page includes an "Add Lessons" panel for manually assigning lesson files to specific dates.

**Owned-only rule:**
- The picker shows ONLY facilitator-owned lessons.
- It does not list public curriculum lessons from `public/lessons`.

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
- A scheduled lesson is considered completed for a date when there is a `lesson_session_events` row with:
  - `event_type = 'completed'`
  - `lesson_id` matching the scheduled `lesson_key` after canonicalization
  - `occurred_at` (converted to local YYYY-MM-DD) matching the `lesson_schedule.scheduled_date`

**Lesson key canonicalization (required for completion matching):**
- `lesson_schedule.lesson_key` is typically a path like `math/Foo.json` or `generated/Foo.json`.
- `lesson_session_events.lesson_id` has historically been stored in multiple formats (sometimes a basename, sometimes a path).
- For matching, canonicalize both sides to the same id:
  - take the last path segment (basename)
  - strip `.json` suffix

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
  - **Add Image**: opens Visual Aids manager (load/generate/save) for that `lessonKey`.
  - **Remove**: requires typing `remove` and warns it cannot be undone.

These actions are implemented on:
- The main Calendar page schedule list
- The Calendar Day View overlay schedule list
- The Mr. Mentor Calendar overlay schedule list

### Backfilling Calendar Schedule From Completion History

If you have existing recorded completions but no corresponding `lesson_schedule` rows (so the Calendar looks empty historically), use the backfill script to insert schedule rows for each completed lesson.

**Script:** `scripts/backfill-schedule-from-history.mjs`

**Default source of truth:**
- Uses `lesson_session_events` rows where `event_type = 'completed'`.
- (Legacy) `lesson_history` can be used only when explicitly requested via `--source lesson_history`.

**Dedupe rule:**
- Inserts are idempotent because `lesson_schedule` has `UNIQUE(learner_id, lesson_key, scheduled_date)` and the script upserts on the same conflict key.

**Safe usage (recommended):**
- Dry-run first: `node scripts/backfill-schedule-from-history.mjs --dry-run`
- Target specific learners: `node scripts/backfill-schedule-from-history.mjs --dry-run --learner Emma,Test`
- Then run real insert: `node scripts/backfill-schedule-from-history.mjs --learner Emma,Test`

**Date conversion:**
- The script defaults to local date extraction from `occurred_at` (use `--tz utc` only if you want UTC date grouping).

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

**Common failure mode:**
- If the Calendar overlay calls `/api/facilitator/lessons/get` without the bearer token, the API returns `401 {"error":"Unauthorized"}`.
- If the Calendar overlay calls `/api/visual-aids/*` without the bearer token, those endpoints also return `401 {"error":"Unauthorized"}`.

## What NOT To Do

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

### ❌ DON'T: Delete ALL planned lessons on every save
**Why**: Users want to schedule multiple non-overlapping time periods (e.g., January + March). Full replacement would delete January when scheduling March. Use date-specific deletion instead.

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

- `src/app/facilitator/calendar/LessonPicker.js`
  - Manual scheduling UI ("Add Lessons")
  - Loads ONLY facilitator-owned lessons via `/api/facilitator/lessons/list`
  - Produces `generated/<filename>` keys for scheduling and for `/api/lesson-file`

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

**2025-12-15**: Changed to date-specific overwrite for planned lessons
- POST now only deletes dates included in the new plan (uses `.in('scheduled_date', newPlanDates)`)
- Multiple non-overlapping plans can coexist (schedule Jan + Mar separately, both persist)
- Overlapping dates are replaced (reschedule Jan 15-31 overwrites only those dates)
- Enables incremental planning and gap-filling without losing unrelated lessons
- Removed full-replacement logic that deleted all planned lessons on every save

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
