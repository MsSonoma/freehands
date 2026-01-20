# Calendar Lesson Planning System - Ms. Sonoma Brain File

**Last Updated**: 2026-01-20T00:40:00Z  
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

**Score-aware repeat policy (important):**
- The planner should prefer new topics, but it is allowed to repeat a concept as a **Review** when prior scores are low.
- Low-score completed lessons are eligible for review; high-score lessons should generally not be repeated soon.
- Review lessons must be rephrased (new framing/examples) and the title should start with `Review:`.
- Outlines may include `kind: "review" | "new"`, and review outlines are title-prefixed for visibility.

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
  - Supports `context` (planner-built history/schedule/plan context)
  - Supports `promptUpdate` (facilitator-provided steering text, used heavily by Redo)

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
- A scheduled lesson is considered completed when there is a `lesson_session_events` row with:
  - `event_type = 'completed'`
  - `lesson_id` matching the scheduled `lesson_key` after canonicalization
  - `occurred_at` (converted to local YYYY-MM-DD) matching **either**:
    - the same `lesson_schedule.scheduled_date` (on-time / same-day), **or**
    - a date within **7 days after** `lesson_schedule.scheduled_date` (make-up completion)

**Make-up window rule (7 days):**
- The Calendar treats “completed later than scheduled” as completed for the scheduled day only within a short window.
- This is specifically to support common homeschool workflows where Monday/Tuesday lessons are completed on Wednesday/Thursday.

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
  - **Visual Aids**: opens Visual Aids manager (load/generate/save) for that `lessonKey`.
  - **Add Images**: uploads new worksheet/test scan files for the learner+lesson (portfolio artifacts; separate from Visual Aids).
  - **Remove**: requires typing `remove` and warns it cannot be undone.

These actions are implemented on:
- The main Calendar page schedule list
- The Calendar Day View overlay schedule list
- The Mr. Mentor Calendar overlay schedule list

### Portfolio Scan Uploads (Worksheet/Test Images)

The Calendar “Add Images” action is for uploading **new** images (e.g., worksheet/test scans) to attach to a completed scheduled lesson for portfolio purposes.

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

**Dedupe rule:**
- Inserts are idempotent because `lesson_schedule` has `UNIQUE(learner_id, lesson_key, scheduled_date)` and the script upserts on the same conflict key.

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

**Safe usage (recommended):**
- Dry-run first: `node scripts/backfill-completions-from-transcripts.mjs --dry-run --learner Emma --from 2026-01-07 --to 2026-01-08`
- Then run real insert: `node scripts/backfill-completions-from-transcripts.mjs --write --learner Emma --from 2026-01-07 --to 2026-01-08`

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

### Manual Completion + Medal Backfill (When You Know the Lesson Keys)

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

**What it checks:**
- `lesson_schedule` rows in a date window
- matching `lesson_session_events(event_type='completed')` rows for those scheduled lessons
- `learner_medals` rows for those lessons

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
