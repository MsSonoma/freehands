# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Calendar scheduled lessons Edit Lesson button reschedule past lessons Notes Assigns Add Images Remove rescheduling calendar picker instant no refresh
```

Filter terms used:
```text
calendar
scheduled
lessons
edit
lesson
button
reschedule
past
notes
assigns
add
images
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-10 18:55` — How does Ms. Sonoma judge short answer and fill-in-the-blank answers? What API endpoint does she call? What is the reque
- `2026-03-11 10:29` — Calendar past scheduled lessons buttons Notes Visual Aids Add Images Remove - replace Visual Aids with Assigns dropdown 
- `2026-03-11 10:41` — Lesson Planner Generate button opens lesson generator overlay says Generate on [date] change date calendar picker planne

---

## [CRITICAL — this pack is thin or empty.] Copilot Self-Recon Obligation

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

Pack chunk count (approximate): 1. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

calendar scheduled lessons edit lesson button reschedule past notes assigns add images

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack.md (ccac777c1db3eb879e26c94f4af62772b4cbecb113643c61a5bd1dd98c06a334)
- bm25: -22.2673 | relevance: 0.9570

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

### 2. docs/brain/ingests/pack.md (aa6ec106ec68e22bb817f61c01c25af4440948ba22e71ec40a50cad850d8b6d0)
- bm25: -21.9466 | relevance: 0.9564

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

### 3. sidekick_pack.md (1b8d472e8d337a496fea4e2f89d70f9d674ba8099b9a98db4dd35f1003f58603)
- bm25: -21.4648 | relevance: 0.9555

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

### 4. sidekick_pack.md (d66e1da129156d6bba9275eea9e1242dbd9dc3611f95401f842f0c993f41627b)
- bm25: -21.3661 | relevance: 0.9553

**UI rule (Schedule tab only):**
- For past (completed) scheduled lessons, actions change to:
  - **Notes**: edits `learners.lesson_notes[lesson_key]`.
  - **Visual Aids**: opens Visual Aids manager (load/generate/save) for that `lessonKey`.
  - **Add Images**: uploads new worksheet/test scan files for the learner+lesson (portfolio artifacts; separate from Visual Aids).
  - **Remove**: requires typing `remove` and warns it cannot be undone.

### 5. sidekick_pack.md (8d3f68810a223f0093360948579972365ee3e3b878ca2ff41ecef73ff997fe8f)
- bm25: -21.3661 | relevance: 0.9553

**UI rule (Schedule tab only):**
- For past (completed) scheduled lessons, actions change to:
  - **Notes**: edits `learners.lesson_notes[lesson_key]`.
  - **Visual Aids**: opens Visual Aids manager (load/generate/save) for that `lessonKey`.
  - **Add Images**: uploads new worksheet/test scan files for the learner+lesson (portfolio artifacts; separate from Visual Aids).
  - **Remove**: requires typing `remove` and warns it cannot be undone.

### 6. sidekick_pack.md (a6a5a8402f60a32ae3f5331f3e88e3b679090d1e257e5157603316df1542732f)
- bm25: -21.2591 | relevance: 0.9551

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

### 7. sidekick_pack.md (cad378213fd13855af53d533bd71221aed90460d4fbb4523573edc023e104f0e)
- bm25: -21.2591 | relevance: 0.9551

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

### 8. sidekick_pack.md (1f28777aa00516f363d491420dfa6a99c690b1cfebadbd59af7be0334bd94883)
- bm25: -21.2591 | relevance: 0.9551

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

### 9. docs/brain/ingests/pack.planned-lessons-flow.md (88c29dc19b3f25ed0178c73764a3887f3532851fb2e1292ab2f58b31241fad00)
- bm25: -21.1986 | relevance: 0.9550

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

### 10. docs/brain/MentorInterceptor_Architecture.md (b9af78a6a85babc29ee74ec9cf6073767b7a2e84a19456e1f96ab9a407cbd74d)
- bm25: -21.1842 | relevance: 0.9549

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

### 11. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (6f33983453dfbb17ba0b015de6cc76fa071dc0e7a401f52396b7093115ac315c)
- bm25: -21.1840 | relevance: 0.9549

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

### 12. docs/brain/calendar-lesson-planning.md (3fa72b30c4a36a0855e8b5e9c7f63b5cb1e38fd2725c7bcf9389c3fa8d2b81ed)
- bm25: -19.9653 | relevance: 0.9523

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

### 13. sidekick_pack.md (838d24067808134cf08c96e92ef01cb7a31d6b4a2d9cbe2757f6914876e84133)
- bm25: -19.5724 | relevance: 0.9514

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

### 14. sidekick_pack.md (a475ff22c1aa00a916e071e88692d18b86e76ca3a394e28c40ff6af3f80b6c05)
- bm25: -19.5228 | relevance: 0.9513

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

### 15. docs/brain/ingests/pack.lesson-schedule-debug.md (29249996be09c0693404295bc827d5da4c475eff693d707e837bdac9c49a7aa2)
- bm25: -19.5081 | relevance: 0.9512

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

### 16. sidekick_pack.md (9c94af25c016ceba64bc640ba1250313117b47564e20b21e486a2383cf8e7b32)
- bm25: -19.3446 | relevance: 0.9508

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

### 17. docs/brain/portfolio-generation.md (fe1e7ac464f2afc7d7f87532c21ef1729a468f8ae05052009b691a0e808f815e)
- bm25: -19.2797 | relevance: 0.9507

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

### 18. docs/brain/ingests/pack.md (6a1e61007b9ff9c99519640f860bd4eb744925fbb659b58284221644f47027e9)
- bm25: -19.2797 | relevance: 0.9507

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

### 19. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (e47ddd04b34ab36279c5d316853898791919b110f8830092679f492ed463f28c)
- bm25: -19.1326 | relevance: 0.9503

**Flow (entry points):**
1. Facilitator Lessons page: navigate to `facilitator/lessons`, select learner, expand subject
2. Calendar schedule view (past completed lessons): click **Notes** on a scheduled lesson
3. Mr. Mentor Calendar overlay (past completed lessons): click **Notes** on a scheduled lesson
4. Type note text and save
5. Empty note deletes the key from the JSONB map (no empty-string storage)
5. When facilitator discusses learner with Mr. Mentor, notes appear in transcript:
   ```
   FACILITATOR NOTES ON LESSONS:

### 20. docs/brain/ingests/pack.md (a838aa65e66cc882806bbd97ce6cd65ddb5dd60a2df471902da645af333bd942)
- bm25: -19.0898 | relevance: 0.9502

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

### 21. docs/brain/ingests/pack.lesson-schedule-debug.md (43275361c85baceec81d8ab6835df496d5162a8f4cd178ae0c41a5029e83ffac)
- bm25: -19.0296 | relevance: 0.9501

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

### 22. sidekick_pack.md (2bc7d589ac799e9924beb7e71177c39de367d4c740ef99fd5fec5a52072ad3eb)
- bm25: -18.4996 | relevance: 0.9487

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

### 23. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (7be445ab882a8b5ec4eb6ddf2cb10f9ffe0b8ef65bcdb2d4fb2a0249ed86bb88)
- bm25: -18.0869 | relevance: 0.9476

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

### 24. docs/brain/lesson-notes.md (ba1927d5f15444bd06ae20de79a25c5719c23ee58aaed5fda05b53a8bd35dbd8)
- bm25: -17.6187 | relevance: 0.9463

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

### 25. docs/brain/ingests/pack.md (b5adbc57ffb081312d82eb41107cf88819855e985f0bde2dcc5c657df7a0f2a8)
- bm25: -17.3303 | relevance: 0.9454

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

### 26. src/app/api/counselor/route.js (a9d50bd79e5c7b7743013004d68e3a1aa190963beeb9defb3f390771f341d679)
- bm25: -17.2276 | relevance: 0.9451

4. SCHEDULE_LESSON - Add lessons to calendars
   - When they say "schedule this" "add that to Monday" "put it on the calendar" → YOU MUST ACTUALLY CALL THIS FUNCTION
   - You can use the learner's NAME (like "Emma") - the system will find them
   - Need: learner name, lesson key from search/generate, date in YYYY-MM-DD format
   - CRITICAL: DO NOT say you've scheduled something unless you ACTUALLY call the schedule_lesson function
   - NEVER confirm scheduling without calling the function first

5. ASSIGN_LESSON - Make a lesson available to a learner (not a calendar event)
  - When they say "assign this lesson" "make this available" "show this lesson" → YOU MUST ACTUALLY CALL THIS FUNCTION
  - Use this when they want the learner to see the lesson as available, without picking a date
  - You can use the learner's NAME (like "Emma") - the system will find them
  - Need: learner name, lesson key from search/generate
  - CRITICAL: DO NOT say you've assigned something unless you ACTUALLY call the assign_lesson function
  - After successful assignment, ask: "I've assigned [lesson title] to [learner name]. Is that correct?"

6. EDIT_LESSON - Modify existing lessons (ALL lessons: installed subjects AND facilitator-created)
   - When they ask to change/fix/update/edit a lesson → USE THIS TOOL
   - Can edit: vocabulary, teaching notes, blurb, questions (all types)
   - Works on both pre-installed lessons AND custom facilitator lessons

7. GET_CONVERSATION_MEMORY - Retrieve past conversation summaries
   - When you need context from previous sessions → USE THIS TOOL
   - When they mention something discussed before → USE THIS TOOL
   - Automatically loads at start of each conversation for continuity
   - Can search across all past conversations with keywords

### 27. docs/brain/ingests/pack.planned-lessons-flow.md (2046f8ed83efe371421b91cb16a7671c8ab761a39b24a8cf0b5c73dd86dac748)
- bm25: -16.2889 | relevance: 0.9422

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

### 28. docs/brain/calendar-lesson-planning.md (3b6e5c01846ed94e0fb9b182d52c90bb48e47f373bd8d63a82f0583a4583c4bb)
- bm25: -16.1644 | relevance: 0.9417

The Calendar “Add Images” action is for uploading **new** images (e.g., worksheet/test scans) to attach to a completed scheduled lesson for portfolio purposes.

### 29. sidekick_pack.md (8d2d98c4a5e9802d9ffc48dd47d1b4ee95e3b624a0bcdde6bb2a6300794f51dd)
- bm25: -15.7694 | relevance: 0.9404

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

### 30. docs/brain/ingests/pack.lesson-schedule-debug.md (fd1796cfe6b6c5842bd4b799eabaf2d2ce1a1088d7f98e72a10e49586317cb10)
- bm25: -15.7490 | relevance: 0.9403

- `src/app/facilitator/lessons/page.js` - Note UI (add/edit/save), state management, Supabase updates
- `src/app/facilitator/calendar/LessonNotesModal.jsx` - Notes modal used from Calendar schedule lists
- `src/app/lib/learnerTranscript.js` - Transcript builder, includes notes section
- `src/app/api/counselor/route.js` - Receives transcript with notes

### 31. docs/brain/ingests/pack-mentor-intercepts.md (ad9be28e3be4c170969fd8d3a91e2b0202957cc880842fc857610f9d7f8b194a)
- bm25: -15.6465 | relevance: 0.9399

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

### 32. src/app/api/counselor/route.js (4b58708eb47ed1de9e7a26238dee9e62257fd2e2141f45a4217d285b84afd1b8)
- bm25: -14.7926 | relevance: 0.9367

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

### 33. src/app/facilitator/lessons/page.js (3ebc8e5a144233c36425689366f873ec7283a1590782a891bc651f66df154956)
- bm25: -14.6670 | relevance: 0.9362

{learnerSelected && !isDownloadableNotOwned && (
                          <>
                            <button
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setEditingNote(isEditingThisNote ? null : lessonKey)
                              }}
                              style={{
                                padding: '4px 10px',
                                border: '1px solid #d1d5db',
                                borderRadius: 4,
                                background: noteText ? '#fef3c7' : '#fff',
                                color: '#6b7280',
                                fontSize: 12,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title={noteText ? 'Edit note' : 'Add note'}
                            >
                              📝 <span className="button-text-tablet">{noteText ? 'Note' : 'Notes'}</span>
                            </button>

### 34. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (701fb407ed303bb2938f611c71a6241f38ababdbdff51df58a01100766d08bad)
- bm25: -14.4134 | relevance: 0.9351

{/* Compact action buttons */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        loadLessonForEditing(lessonKey)
                      }}
                      style={{
                        padding: '3px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: '#fff',
                        color: '#6b7280',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title="Edit lesson"
                    >
                      ✏️ Edit
                    </button>

<button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingNote(isEditingThisNote ? null : lessonKey)
                      }}
                      style={{
                        padding: '3px 8px',
                        border: '1px solid #d1d5db',
                        borderRadius: 4,
                        background: noteText ? '#fef3c7' : '#fff',
                        color: '#6b7280',
                        fontSize: 11,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      title={noteText ? 'Edit note' : 'Add note'}
                    >
                      📝 {noteText ? 'Note' : 'Notes'}
                    </button>

### 35. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -14.3467 | relevance: 0.9348

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

### 36. src/app/facilitator/lessons/edit/page.js (81fa080d17e9cff139a908d1cce1d7f7fd0dc9ee4aa0d7e37abc9118d0a53f76)
- bm25: -14.0224 | relevance: 0.9334

{showVisualAidsCarousel && (
        <VisualAidsCarousel
          images={visualAidsImages}
          onClose={() => setShowVisualAidsCarousel(false)}
          onSave={handleSaveVisualAids}
          onGenerateMore={handleGenerateMore}
          onUploadImage={handleUploadImage}
          onRewriteDescription={handleRewriteDescription}
          onGeneratePrompt={handleGeneratePrompt}
          generating={generatingVisualAids}
          teachingNotes={lesson?.teachingNotes || ''}
          lessonTitle={lesson?.title || ''}
          generationProgress={generationProgress}
          generationCount={generationCount}
          maxGenerations={MAX_GENERATIONS}
        />
      )}
      
      {/* Learner Selection Dropdown */}
      {showLearnerSelect && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}
        onClick={() => setShowLearnerSelect(null)}
        >
          <div style={{
            background: '#fff',
            borderRadius: 8,
            padding: 24,
            maxWidth: 400,
            width: '90%'
          }}
          onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0 }}>Select Learner</h3>
            <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 16 }}>
              {showLearnerSelect === 'notes' && 'Choose a learner to add notes for this lesson'}
              {showLearnerSelect === 'schedule' && 'Choose a learner to schedule this lesson for'}
              {showLearnerSelect === 'assign' && 'Choose a learner to assign this lesson to'}

### 37. sidekick_pack.md (81b308fed54410aa353557e8e7c03a6b83e6387201788a33cfd45dcbda1918df)
- bm25: -13.9686 | relevance: 0.9332

The Calendar schedule view supports showing scheduled lessons on past dates, but only when the lesson was completed.

### 38. docs/brain/ingests/pack.planned-lessons-flow.md (0a1e168264e4ffb7690341fafb963775753d01cf54c647920a52242e34956be9)
- bm25: -13.8937 | relevance: 0.9329

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

### 4. docs/brain/calendar-lesson-planning.md (edc4501d8cf5402f28f2f259c81317facde5d8c4d278692219fb856850a029d8)
- bm25: -32.4309 | entity_overlap_w: 1.00 | adjusted: -32.6809 | relevance: 1.0000

- `src/app/facilitator/calendar/LessonNotesModal.jsx`
  - Minimal notes editor for `learners.lesson_notes[lesson_key]`
  - Empty note deletes the key from the JSONB map

### 39. docs/brain/ingests/pack.planned-lessons-flow.md (043acc5f96fad3732cebeb897f3edf1f5e317250beb4b58f69e73bcccf3e4b46)
- bm25: -13.8720 | relevance: 0.9328

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

### 40. sidekick_pack.md (af53ecc19ee10a49a8b05a6d9667006979cd7d5f304dcfad57d5acde47312bea)
- bm25: -13.4180 | relevance: 0.9306

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


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
