# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Calendar day cell overlay opens generator, generates lesson, lesson appears in lessons list but not in calendar day cell or as scheduled lesson - investigate the flow from Generate on date button through to calendar state update
```

Filter terms used:
```text
Calendar
day
cell
overlay
opens
generator
generates
lesson
lesson
appears
in
lessons
list
but
not
in
calendar
day
cell
or
as
scheduled
lesson
investigate
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Calendar day cell overlay opens generator generates lesson lesson appears in lessons list but not in calendar day cell or as scheduled lesson investigate

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/calendar-lesson-planning.md (3fa72b30c4a36a0855e8b5e9c7f63b5cb1e38fd2725c7bcf9389c3fa8d2b81ed)
- bm25: -37.0855 | relevance: 1.0000

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

### 2. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (6f33983453dfbb17ba0b015de6cc76fa071dc0e7a401f52396b7093115ac315c)
- bm25: -36.0508 | relevance: 1.0000

- **overlays/CalendarOverlay.jsx**
  - Compact, side-by-side calendar UI used inside Mr. Mentor
  - Shows scheduled lessons for the selected learner
  - Loads planned lessons from /api/planned-lessons
  - Loads scheduled lessons from /api/lesson-schedule
  - Past scheduled dates: completion markers come from /api/learner/lesson-history (not direct client DB queries) so RLS cannot silently hide history
  - Refresh behavior: overlay force-refreshes on open (and every ~2 minutes) so it stays in sync with changes made in the main Calendar; refresh is throttled to avoid duplicate fetches on mount
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

### 3. docs/brain/MentorInterceptor_Architecture.md (b9af78a6a85babc29ee74ec9cf6073767b7a2e84a19456e1f96ab9a407cbd74d)
- bm25: -35.8219 | relevance: 1.0000

- **overlays/CalendarOverlay.jsx**
  - Compact, side-by-side calendar UI used inside Mr. Mentor
  - Shows scheduled lessons for the selected learner
  - Loads planned lessons from /api/planned-lessons
  - Loads scheduled lessons from /api/lesson-schedule
  - Past scheduled dates: completion markers come from /api/learner/lesson-history (not direct client DB queries) so RLS cannot silently hide history
  - Refresh behavior: overlay force-refreshes on open (and every ~2 minutes) so it stays in sync with changes made in the main Calendar; refresh is throttled to avoid duplicate fetches on mount
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

### 4. docs/brain/ingests/pack.planned-lessons-flow.md (88c29dc19b3f25ed0178c73764a3887f3532851fb2e1292ab2f58b31241fad00)
- bm25: -35.7811 | relevance: 1.0000

- **overlays/CalendarOverlay.jsx**
  - Compact, side-by-side calendar UI used inside Mr. Mentor
  - Shows scheduled lessons for the selected learner
  - Loads planned lessons from /api/planned-lessons
  - Loads scheduled lessons from /api/lesson-schedule
  - Past scheduled dates: completion markers come from /api/learner/lesson-history (not direct client DB queries) so RLS cannot silently hide history
  - Refresh behavior: overlay force-refreshes on open (and every ~2 minutes) so it stays in sync with changes made in the main Calendar; refresh is throttled to avoid duplicate fetches on mount
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

### 5. docs/brain/ingests/pack.md (aa6ec106ec68e22bb817f61c01c25af4440948ba22e71ec40a50cad850d8b6d0)
- bm25: -33.2332 | relevance: 1.0000

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

### 6. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (7a42963d49cceba71f31be9d3d8d544fccccaaf4d62770d956e70416bd7e72ff)
- bm25: -29.8352 | relevance: 1.0000

### 36. docs/brain/calendar-lesson-planning.md (de0b7e2265d9cfcb4b0c9cd0651ba3db1eb254c5334aa7a65a5b5a4fad4aba17)
- bm25: -14.1234 | relevance: 1.0000

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

### 7. docs/brain/ingests/pack.md (a838aa65e66cc882806bbd97ce6cd65ddb5dd60a2df471902da645af333bd942)
- bm25: -29.7203 | relevance: 1.0000

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

### 8. docs/brain/ingests/pack.lesson-schedule-debug.md (43275361c85baceec81d8ab6835df496d5162a8f4cd178ae0c41a5029e83ffac)
- bm25: -29.6515 | relevance: 1.0000

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

### 9. docs/brain/calendar-lesson-planning.md (8fb5d6fd52eb343d38244e53af009c1d078e80740d159006615a9235e71a5585)
- bm25: -29.6044 | relevance: 1.0000

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

### 10. docs/brain/ingests/pack.planned-lessons-flow.md (9b8bb379fb9f858bf16466497e23ae36c4229766bf0ff9306908e1c67f953e68)
- bm25: -28.9160 | relevance: 1.0000

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

### 11. docs/brain/calendar-lesson-planning.md (de0b7e2265d9cfcb4b0c9cd0651ba3db1eb254c5334aa7a65a5b5a4fad4aba17)
- bm25: -28.6058 | relevance: 1.0000

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

### 12. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (699a2ea78705303695515c7e74fd680ef055f084078e7ab40188ca6a27bef342)
- bm25: -28.3826 | relevance: 1.0000

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

### 25. docs/brain/calendar-lesson-planning.md (3fa72b30c4a36a0855e8b5e9c7f63b5cb1e38fd2725c7bcf9389c3fa8d2b81ed)
- bm25: -15.0342 | relevance: 1.0000

**Completion query rule (visibility > micro-optimization):**
- Do not rely on `.in('lesson_id', [...scheduledKeys])` when loading completion events.
- Because `lesson_id` formats vary, strict filtering can miss valid completions and make past calendar history appear empty.

**Calendar date key rule (marker dots):**
- Calendar grid cells must compute their `YYYY-MM-DD` date keys using local time.
- Do not use `Date.toISOString().split('T')[0]` to build calendar cell keys, because it is UTC-based and can shift the day relative to local dates.
- The schedule grouping keys come from `lesson_schedule.scheduled_date` (already `YYYY-MM-DD`). The calendar grid must use the same format.

### 13. docs/brain/ingests/pack.md (5fd0b2319691b60c2ab2d7c6a9650ea9f00741ed6e601d04079fc31a2701cf61)
- bm25: -28.1877 | relevance: 1.0000

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

### 14. docs/brain/ingests/pack.md (457324d43ea5d640d2143d6eabafb9637ff47ccee9bda121abde347baffba259)
- bm25: -28.0365 | relevance: 1.0000

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

### 15. docs/brain/ingests/pack.planned-lessons-flow.md (c985a44d345e351fd61ade599be3e29e3e7386375d077fade62e6f02a4bdad24)
- bm25: -27.9567 | relevance: 1.0000

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

### 24. docs/brain/calendar-lesson-planning.md (1d396766db2440144971a1350400b34ef2799dc2339e2896f9d8c5a4a2c58fe0)
- bm25: -16.2825 | relevance: 1.0000

### 16. docs/brain/ingests/pack.lesson-schedule-debug.md (70940359c629eb7191429b557e1c30bb4e172a7c5692b740c4eda364fd8808f7)
- bm25: -27.8640 | relevance: 1.0000

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

### 17. docs/brain/ingests/pack.planned-lessons-flow.md (043acc5f96fad3732cebeb897f3edf1f5e317250beb4b58f69e73bcccf3e4b46)
- bm25: -26.5799 | relevance: 1.0000

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

### 18. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (7be445ab882a8b5ec4eb6ddf2cb10f9ffe0b8ef65bcdb2d4fb2a0249ed86bb88)
- bm25: -26.4754 | relevance: 1.0000

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

### 26. src/app/facilitator/generator/counselor/CounselorClient.jsx (41e17c24a556523149db2bc643c856816b23d9b78ec8fa7c213dafcfaee30536)
- bm25: -14.9427 | relevance: 1.0000

// Handle clipboard delete (discard conversation)
  const handleClipboardDelete = useCallback(async () => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) return

const learnerId = selectedLearnerId !== 'none' ? selectedLearnerId : null

// Delete the draft
      await fetch(`/api/conversation-drafts?learner_id=${learnerId || ''}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

// Clear conversation
      await clearConversationAfterSave()
      
      setShowClipboard(false)
      setClipboardInstructions(false)
      
      alert('Conversation deleted.')
    } catch (err) {
      // Silent error handling
      alert('Failed to delete conversation.')
    }
  }, [selectedLearnerId])

### 19. docs/brain/ingests/pack.planned-lessons-flow.md (2046f8ed83efe371421b91cb16a7671c8ab761a39b24a8cf0b5c73dd86dac748)
- bm25: -26.4300 | relevance: 1.0000

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

### 33. docs/brain/portfolio-generation.md (e083fdfcd6e4035528697e6c1609dd20b75c22e0849fc326d799b41cbb6a114a)
- bm25: -13.4685 | relevance: 1.0000

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

### 20. docs/brain/ingests/pack.lesson-schedule-debug.md (28cabfb2019a8366fcd1d2186a181c4fd13fcddbffcbc50cd8fd3b3410540dba)
- bm25: -25.5534 | relevance: 1.0000

These actions are implemented on:
- The main Calendar page schedule list
- The Calendar Day View overlay schedule list
- The Mr. Mentor Calendar overlay schedule list

### 21. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (db752affeea2f66a776f276697741c41922e9f65f2dad265d123b0fd6b485abd)
- bm25: -25.3972 | relevance: 1.0000

2025-12-15T01:20:00Z | Copilot | FIX: Build failure - incorrect Supabase import path. Import path '@/lib/supabase' does not exist in project. Corrected to '@/app/lib/supabaseClient' matching pattern used throughout codebase (TutorialGuard, PostLessonSurvey, session page, etc). Build now completes successfully. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (corrected getSupabaseClient import path).
2025-12-15T01:15:00Z | Copilot | FIX: Redo button failing with 401 Unauthorized error. Redo button fetch call to /api/generate-lesson-outline did not include Authorization header with auth token. API endpoint requires Bearer token for authentication (checks request.headers.authorization). Added getSupabaseClient import to DayViewOverlay, modified handleRedoClick to fetch session token via supabase.auth.getSession() before API call, added 'Authorization': `Bearer ${token}` header to fetch request. Redo button now successfully regenerates lesson outlines. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (imported getSupabaseClient, updated handleRedoClick to get auth token and include in headers).
2025-12-15T01:00:00Z | Copilot | FEATURE: Implemented color differentiation for scheduled vs planned lessons in calendar. Scheduled lessons display in orange (#fef3c7 bg, #f59e0b indicator), planned lessons display in blue (#dbeafe bg, #3b82f6 indicator). Added isPlannedView prop to LessonCalendar component that determines which color scheme to use. Updated date cell background color logic and indicator dot color to conditionally apply blue for planned view or orange for scheduled view. Calendar page passes isPlannedView={activeTab === 'planner'} prop based on current tab. Visual distinction makes it immediately clear whether viewing scheduled curriculum or planning futu

### 22. sidekick_pack.md (f0e0466a6588f66493c88c0b00e750e7c20b3e5b9f4eedd4cfc00bcd3826f40a)
- bm25: -24.5808 | relevance: 1.0000

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

### 23. docs/brain/ingests/pack.lesson-schedule-debug.md (e2b842c370bb0f99fc9f215cdd7f7ae8c892569b10dc1e4f04911b503e3c107c)
- bm25: -23.9842 | relevance: 1.0000

2025-12-15T01:20:00Z | Copilot | FIX: Build failure - incorrect Supabase import path. Import path '@/lib/supabase' does not exist in project. Corrected to '@/app/lib/supabaseClient' matching pattern used throughout codebase (TutorialGuard, PostLessonSurvey, session page, etc). Build now completes successfully. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (corrected getSupabaseClient import path).
2025-12-15T01:15:00Z | Copilot | FIX: Redo button failing with 401 Unauthorized error. Redo button fetch call to /api/generate-lesson-outline did not include Authorization header with auth token. API endpoint requires Bearer token for authentication (checks request.headers.authorization). Added getSupabaseClient import to DayViewOverlay, modified handleRedoClick to fetch session token via supabase.auth.getSession() before API call, added 'Authorization': `Bearer ${token}` header to fetch request. Redo button now successfully regenerates lesson outlines. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (imported getSupabaseClient, updated handleRedoClick to get auth token and include in headers).
2025-12-15T01:00:00Z | Copilot | FEATURE: Implemented color differentiation for scheduled vs planned lessons in calendar. Scheduled lessons display in orange (#fef3c7 bg, #f59e0b indicator), planned lessons display in blue (#dbeafe bg, #3b82f6 indicator). Added isPlannedView prop to LessonCalendar component that determines which color scheme to use. Updated date cell background color logic and indicator dot color to conditionally apply blue for planned view or orange for scheduled view. Calendar page passes isPlannedView={activeTab === 'planner'} prop based on current tab. Visual distinction makes it immediately clear whether viewing scheduled curriculum or planning futu

### 24. docs/brain/ingests/pack.planned-lessons-flow.md (5562194e98eccff86674afbd40f840c9addc35ff6b8bafec10ed78d812ac1af7)
- bm25: -23.7616 | relevance: 1.0000

2025-12-15T01:20:00Z | Copilot | FIX: Build failure - incorrect Supabase import path. Import path '@/lib/supabase' does not exist in project. Corrected to '@/app/lib/supabaseClient' matching pattern used throughout codebase (TutorialGuard, PostLessonSurvey, session page, etc). Build now completes successfully. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (corrected getSupabaseClient import path).
2025-12-15T01:15:00Z | Copilot | FIX: Redo button failing with 401 Unauthorized error. Redo button fetch call to /api/generate-lesson-outline did not include Authorization header with auth token. API endpoint requires Bearer token for authentication (checks request.headers.authorization). Added getSupabaseClient import to DayViewOverlay, modified handleRedoClick to fetch session token via supabase.auth.getSession() before API call, added 'Authorization': `Bearer ${token}` header to fetch request. Redo button now successfully regenerates lesson outlines. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (imported getSupabaseClient, updated handleRedoClick to get auth token and include in headers).
2025-12-15T01:00:00Z | Copilot | FEATURE: Implemented color differentiation for scheduled vs planned lessons in calendar. Scheduled lessons display in orange (#fef3c7 bg, #f59e0b indicator), planned lessons display in blue (#dbeafe bg, #3b82f6 indicator). Added isPlannedView prop to LessonCalendar component that determines which color scheme to use. Updated date cell background color logic and indicator dot color to conditionally apply blue for planned view or orange for scheduled view. Calendar page passes isPlannedView={activeTab === 'planner'} prop based on current tab. Visual distinction makes it immediately clear whether viewing scheduled curriculum or planning futu

### 25. docs/brain/changelog.md (734f5012565b6221ab41a07c6ed6a285bb49d94d1fedc65b70806108b10bec2c)
- bm25: -23.7484 | relevance: 1.0000

2025-12-15T01:20:00Z | Copilot | FIX: Build failure - incorrect Supabase import path. Import path '@/lib/supabase' does not exist in project. Corrected to '@/app/lib/supabaseClient' matching pattern used throughout codebase (TutorialGuard, PostLessonSurvey, session page, etc). Build now completes successfully. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (corrected getSupabaseClient import path).
2025-12-15T01:15:00Z | Copilot | FIX: Redo button failing with 401 Unauthorized error. Redo button fetch call to /api/generate-lesson-outline did not include Authorization header with auth token. API endpoint requires Bearer token for authentication (checks request.headers.authorization). Added getSupabaseClient import to DayViewOverlay, modified handleRedoClick to fetch session token via supabase.auth.getSession() before API call, added 'Authorization': `Bearer ${token}` header to fetch request. Redo button now successfully regenerates lesson outlines. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (imported getSupabaseClient, updated handleRedoClick to get auth token and include in headers).
2025-12-15T01:00:00Z | Copilot | FEATURE: Implemented color differentiation for scheduled vs planned lessons in calendar. Scheduled lessons display in orange (#fef3c7 bg, #f59e0b indicator), planned lessons display in blue (#dbeafe bg, #3b82f6 indicator). Added isPlannedView prop to LessonCalendar component that determines which color scheme to use. Updated date cell background color logic and indicator dot color to conditionally apply blue for planned view or orange for scheduled view. Calendar page passes isPlannedView={activeTab === 'planner'} prop based on current tab. Visual distinction makes it immediately clear whether viewing scheduled curriculum or planning futu

### 26. docs/brain/ingests/pack.md (a6a5b49764bccdc0ea96a150066cafd71ebee15598c01794309a8254b535b74a)
- bm25: -23.7087 | relevance: 1.0000

2025-12-15T01:20:00Z | Copilot | FIX: Build failure - incorrect Supabase import path. Import path '@/lib/supabase' does not exist in project. Corrected to '@/app/lib/supabaseClient' matching pattern used throughout codebase (TutorialGuard, PostLessonSurvey, session page, etc). Build now completes successfully. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (corrected getSupabaseClient import path).
2025-12-15T01:15:00Z | Copilot | FIX: Redo button failing with 401 Unauthorized error. Redo button fetch call to /api/generate-lesson-outline did not include Authorization header with auth token. API endpoint requires Bearer token for authentication (checks request.headers.authorization). Added getSupabaseClient import to DayViewOverlay, modified handleRedoClick to fetch session token via supabase.auth.getSession() before API call, added 'Authorization': `Bearer ${token}` header to fetch request. Redo button now successfully regenerates lesson outlines. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (imported getSupabaseClient, updated handleRedoClick to get auth token and include in headers).
2025-12-15T01:00:00Z | Copilot | FEATURE: Implemented color differentiation for scheduled vs planned lessons in calendar. Scheduled lessons display in orange (#fef3c7 bg, #f59e0b indicator), planned lessons display in blue (#dbeafe bg, #3b82f6 indicator). Added isPlannedView prop to LessonCalendar component that determines which color scheme to use. Updated date cell background color logic and indicator dot color to conditionally apply blue for planned view or orange for scheduled view. Calendar page passes isPlannedView={activeTab === 'planner'} prop based on current tab. Visual distinction makes it immediately clear whether viewing scheduled curriculum or planning futu

### 27. docs/brain/ingests/pack-mentor-intercepts.md (13da0bd320ddf15195177f579bcb9bd3b7d2c0a7543a07cb2df2712ac5a0bca6)
- bm25: -23.6295 | relevance: 1.0000

2025-12-15T01:20:00Z | Copilot | FIX: Build failure - incorrect Supabase import path. Import path '@/lib/supabase' does not exist in project. Corrected to '@/app/lib/supabaseClient' matching pattern used throughout codebase (TutorialGuard, PostLessonSurvey, session page, etc). Build now completes successfully. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (corrected getSupabaseClient import path).
2025-12-15T01:15:00Z | Copilot | FIX: Redo button failing with 401 Unauthorized error. Redo button fetch call to /api/generate-lesson-outline did not include Authorization header with auth token. API endpoint requires Bearer token for authentication (checks request.headers.authorization). Added getSupabaseClient import to DayViewOverlay, modified handleRedoClick to fetch session token via supabase.auth.getSession() before API call, added 'Authorization': `Bearer ${token}` header to fetch request. Redo button now successfully regenerates lesson outlines. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (imported getSupabaseClient, updated handleRedoClick to get auth token and include in headers).
2025-12-15T01:00:00Z | Copilot | FEATURE: Implemented color differentiation for scheduled vs planned lessons in calendar. Scheduled lessons display in orange (#fef3c7 bg, #f59e0b indicator), planned lessons display in blue (#dbeafe bg, #3b82f6 indicator). Added isPlannedView prop to LessonCalendar component that determines which color scheme to use. Updated date cell background color logic and indicator dot color to conditionally apply blue for planned view or orange for scheduled view. Calendar page passes isPlannedView={activeTab === 'planner'} prop based on current tab. Visual distinction makes it immediately clear whether viewing scheduled curriculum or planning futu

### 28. docs/brain/ingests/pack.planned-lessons-flow.md (c1630e20d42e7416e0786d4762a62020e29931c3609ba5301492ca0c6c410df5)
- bm25: -23.5145 | relevance: 1.0000

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

### 29. docs/brain/ingests/pack.md (d3ec3059cc7def4b2517964fac42725ca1e098325a989a4b2fbb1f4eb7c9badd)
- bm25: -23.2462 | relevance: 1.0000

These actions are implemented on:
- The main Calendar page schedule list
- The Calendar Day View overlay schedule list
- The Mr. Mentor Calendar overlay schedule list

### 30. docs/brain/calendar-lesson-planning.md (4da551360e5a46cca2826bfe58a71289a036bb89df00313db4714021b4cc5eab)
- bm25: -23.2351 | relevance: 1.0000

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

### 31. docs/brain/ingests/pack.md (fe10194c52ecca73d5dd0223f7028d10267258d80bdab371d948669e51717ef0)
- bm25: -22.7171 | relevance: 1.0000

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

### 32. docs/brain/mr-mentor-conversation-flows.md (ec792e77787419d1b45a207c4f316b72a0b239666251a1dadd891ad81666a1ed)
- bm25: -22.3963 | relevance: 1.0000

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

### 33. docs/brain/portfolio-generation.md (fe1e7ac464f2afc7d7f87532c21ef1729a468f8ae05052009b691a0e808f815e)
- bm25: -22.2966 | relevance: 1.0000

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

### 34. docs/brain/ingests/pack.md (6a1e61007b9ff9c99519640f860bd4eb744925fbb659b58284221644f47027e9)
- bm25: -22.2966 | relevance: 1.0000

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

### 35. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -22.0390 | relevance: 1.0000

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

### 36. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (86b60aae069b5e5cd6312d1188af36820d92ad5d50ac3acdfbcc0206a1059f7c)
- bm25: -21.9744 | relevance: 1.0000

### 2. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -22.4515 | relevance: 1.0000

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

### 3. src/app/facilitator/generator/counselor/CounselorClient.jsx (29fd22a6b836f2b375b277653c9ce728dd6250112309eb2eb1dd4cae49f9327a)
- bm25: -22.0646 | entity_overlap_w: 1.00 | adjusted: -22.3146 | relevance: 1.0000

### 37. docs/brain/ingests/pack.planned-lessons-flow.md (adc19afdea7bdf534f71a846ee6f87a9d438ef3a8b85594268dd0260c3715b64)
- bm25: -21.9219 | relevance: 1.0000

if (wantsCustomSubjectDelete) {
      this.state.flow = 'custom_subject_delete'

### 29. docs/brain/mr-mentor-conversation-flows.md (ec792e77787419d1b45a207c4f316b72a0b239666251a1dadd891ad81666a1ed)
- bm25: -14.0179 | relevance: 1.0000

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

### 38. docs/brain/ingests/pack-mentor-intercepts.md (ad9be28e3be4c170969fd8d3a91e2b0202957cc880842fc857610f9d7f8b194a)
- bm25: -21.3587 | relevance: 1.0000

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

### 39. docs/brain/calendar-lesson-planning.md (1855144ade44b43a78489cf3246c6df30aa1531fdb5dbb9a20f4fe3d2898703f)
- bm25: -20.9643 | relevance: 1.0000

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

### 40. docs/brain/ingests/pack.md (8553ec4a96cb35a36453f5c28d63fd06cec584d5e5726093793930c77128e5d0)
- bm25: -20.6530 | relevance: 1.0000

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
