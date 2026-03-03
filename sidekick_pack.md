# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Curriculum Preferences focuses and bans per subject with dropdown selector, custom subjects, per-subject saving, prompt wiring. Lesson Planner Generator duration options change from months to days and weeks.
```

Filter terms used:
```text
Curriculum
Preferences
focuses
and
bans
per
subject
with
dropdown
selector
custom
subjects
per
subject
saving
prompt
wiring
Lesson
Planner
Generator
duration
options
change
from
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Curriculum Preferences focuses and bans per subject with dropdown selector custom subjects per subject saving prompt wiring Lesson Planner Generator duration options change from

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/custom-subjects.md (fd8a5ead4d8a64f78e034e3ca6a8d9b6dea9dbbdcd408f13f17042a7b16d3e24)
- bm25: -38.1243 | relevance: 1.0000

# Custom Subjects (Per Facilitator)

## How It Works

- Custom subjects are stored in the Supabase table `custom_subjects` and are scoped to a single facilitator via `facilitator_id`.
- The canonical API surface is `GET/POST/DELETE /api/custom-subjects`.
  - `GET` returns `{ subjects: [...] }` ordered by `display_order` then `name`.
  - `POST` creates a subject for the authenticated facilitator.
  - `DELETE` deletes a subject only if it belongs to the authenticated facilitator.
- Client surfaces that need subject dropdown options should treat subjects as:
  - Core subjects (universal): `math`, `science`, `language arts`, `social studies`, `general`.
  - Custom subjects (per facilitator): fetched from `/api/custom-subjects` using the facilitator session token.
  - Special subject `generated` is a UI bucket used in some facilitator/Mr. Mentor views (not a custom subject). In the Mr. Mentor lessons overlay, `generated` is intentionally not shown as a subject dropdown option.
- Shared client hook:
  - `useFacilitatorSubjects()` fetches custom subjects for the signed-in facilitator and returns merged dropdown-ready lists.

## What NOT To Do

- Do not make custom subjects global. They must remain per-facilitator (`custom_subjects.facilitator_id`).
- Do not fetch public lesson lists for custom subjects. Only core subjects have public lesson endpoints (`/api/lessons/[subject]`).
- Do not store custom subjects in browser storage as the source of truth.

## Key Files

### 2. src/app/facilitator/generator/counselor/MentorInterceptor.js (ff7c06888892bd8540cfd73ff3789e4d44b179dd1009494703c15f607154944d)
- bm25: -31.5647 | relevance: 1.0000

if (flow === 'curriculum_prefs') {
      const curriculum = ctx.curriculum || {}
      const focusTopics = Array.isArray(curriculum.focusTopics) ? curriculum.focusTopics : []
      const bannedTopics = Array.isArray(curriculum.bannedTopics) ? curriculum.bannedTopics : []

this.reset()
      return {
        handled: true,
        action: {
          type: 'save_curriculum_preferences',
          learnerId: ctx.learnerId,
          focusTopics,
          bannedTopics
        },
        response: 'Saving curriculum preferences...'
      }
    }

if (flow === 'weekly_pattern') {
      const pattern = ctx.weeklyPatternDraft
      this.reset()
      return {
        handled: true,
        action: {
          type: 'save_weekly_pattern',
          learnerId: ctx.learnerId,
          pattern
        },
        response: 'Saving weekly pattern...'
      }
    }

if (flow === 'custom_subject_add') {
      const name = String(ctx.subjectName || '').trim()
      this.reset()
      return {
        handled: true,
        action: {
          type: 'add_custom_subject',
          name
        },
        response: `Adding custom subject "${name}"...`
      }
    }

if (flow === 'custom_subject_delete') {
      const name = String(ctx.subjectName || '').trim()
      this.reset()
      return {
        handled: true,
        action: {
          type: 'delete_custom_subject',
          name
        },
        response: `Deleting custom subject "${name}"...`
      }
    }

if (flow === 'lesson_plan_generate') {
      const startDate = ctx.planStartDate
      const durationMonths = ctx.planDurationMonths
      const learnerId = ctx.learnerId

### 3. docs/brain/calendar-lesson-planning.md (8fb5d6fd52eb343d38244e53af009c1d078e80740d159006615a9235e71a5585)
- bm25: -29.3386 | relevance: 1.0000

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

### 4. docs/brain/ingests/pack.planned-lessons-flow.md (9b8bb379fb9f858bf16466497e23ae36c4229766bf0ff9306908e1c67f953e68)
- bm25: -29.1931 | relevance: 1.0000

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

### 5. sidekick_pack.md (abb89cc2d6ea14313372a56663b0976a0234db712b9cbde62805394db4d66f42)
- bm25: -28.7168 | relevance: 1.0000

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

### 6. sidekick_pack.md (4c5b8bc8077b109c8c99a1196a375108c0227ae6411557a1522b11641918a2df)
- bm25: -28.7168 | relevance: 1.0000

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

### 7. docs/brain/ingests/pack.md (5fd0b2319691b60c2ab2d7c6a9650ea9f00741ed6e601d04079fc31a2701cf61)
- bm25: -27.3530 | relevance: 1.0000

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

### 8. docs/brain/ingests/pack.md (c4c8f100a25071abdd37e3a676ea7a188fe9fc86430b3f600c5879355aad4113)
- bm25: -25.8059 | relevance: 1.0000

**`/api/learner/lesson-history`** - completed/incomplete sessions  
**`/api/medals`** - lesson scores (may 404 for new learners)  
**`/api/lesson-schedule`** - scheduled lessons (returns `{schedule: [...]}`)  
**`/api/curriculum-preferences`** - focus/banned content  
**`/api/generate-lesson-outline`** - GPT outline generation per subject/date
  - Supports `context` (planner-built history/schedule/plan context)
  - Supports `promptUpdate` (facilitator-provided steering text, used heavily by Redo)

### 9. docs/brain/calendar-lesson-planning.md (265bc11b6e14ebc78b549a5a598ef082eba677b6a58860236e1c61224231f8bf)
- bm25: -25.7382 | relevance: 1.0000

**`/api/learner/lesson-history`** - completed/incomplete sessions  
**`/api/medals`** - lesson scores (may 404 for new learners)  
**`/api/lesson-schedule`** - scheduled lessons (returns `{schedule: [...]}`)  
**`/api/curriculum-preferences`** - focus/banned content  
**`/api/generate-lesson-outline`** - GPT outline generation per subject/date
  - Supports `context` (planner-built history/schedule/plan context)
  - Supports `promptUpdate` (facilitator-provided steering text, used heavily by Redo)

### 10. src/app/facilitator/generator/counselor/MentorInterceptor.js (05f7901106371bb7dbec724cb4d1e8394aaf456b5e4692ccb481d88f19f65109)
- bm25: -24.6466 | relevance: 1.0000

const wantsCurriculum = normalized.includes('curriculum') || normalized.includes('preference') || normalized.includes('banned') || normalized.includes('avoid')
    const wantsPattern = normalized.includes('weekly pattern') || (normalized.includes('pattern') && normalized.includes('week')) || normalized.includes('schedule template')
    const wantsCustomSubjectAdd = (normalized.includes('add') || normalized.includes('create') || normalized.includes('new')) && normalized.includes('subject')
    const wantsCustomSubjectDelete = (normalized.includes('delete') || normalized.includes('remove')) && normalized.includes('subject')
    const wantsPlan = (normalized.includes('lesson plan') || normalized.includes('lesson planner') || normalized.includes('planned lessons')) &&
      (normalized.includes('schedule') || normalized.includes('generate') || normalized.includes('make') || normalized.includes('start') || normalized.includes('duration'))

if (wantsCustomSubjectAdd) {
      this.state.flow = 'custom_subject_add'

// Attempt to extract name after "subject"
      const match = userMessage.match(/subject\s+(.+)$/i)
      const maybeName = match?.[1] ? String(match[1]).trim() : ''
      if (maybeName && maybeName.length <= 60) {
        this.state.context.subjectName = maybeName
        this.state.awaitingConfirmation = true
        this.state.awaitingInput = null
        return {
          handled: true,
          response: `Should I add a custom subject named "${maybeName}"?`
        }
      }

this.state.awaitingInput = 'custom_subject_name'
      return {
        handled: true,
        response: 'What custom subject would you like me to add?'
      }
    }

if (wantsCustomSubjectDelete) {
      this.state.flow = 'custom_subject_delete'

### 11. src/app/facilitator/generator/counselor/MentorInterceptor.js (f4ac7b7c15763423d23bed0191b3efd98dee41efb20a528414769c1fba0e90bb)
- bm25: -24.0017 | relevance: 1.0000

// Escape hatch for any structured flow.
    if (this.state.flow && this.state.awaitingInput && this.isEscapeMessage(userMessage)) {
      const normalized = normalizeText(userMessage)

if (normalized.includes('different issue') || normalized.includes('something else')) {
        this.reset()
        return {
          handled: false,
          apiForward: { message: userMessage, bypassInterceptor: true }
        }
      }

this.reset()
      return {
        handled: true,
        response: 'No problem. What would you like to do instead?'
      }
    }

// Lesson plan chooser (routes into subflows)
    if (this.state.awaitingInput === 'lesson_plan_choice') {
      const normalized = normalizeText(userMessage)
      if (normalized.includes('curriculum') || normalized.includes('preference') || normalized.includes('avoid')) {
        return await this.handleLessonPlan('curriculum preferences', context)
      }
      if (normalized.includes('pattern') || normalized.includes('weekly')) {
        return await this.handleLessonPlan('weekly pattern', context)
      }
      if (normalized.includes('subject')) {
        // Ask clarifier for add vs delete.
        this.state.awaitingInput = 'lesson_plan_subject_action'
        return {
          handled: true,
          response: 'Do you want to add a new custom subject, or delete an existing one?'
        }
      }
      if (normalized.includes('schedule') || normalized.includes('generate') || normalized.includes('plan')) {
        return await this.handleLessonPlan('schedule a lesson plan', context)
      }

return {
        handled: true,
        response: 'Would you like to work on curriculum preferences, weekly pattern, custom subjects, or scheduling a lesson plan?'
      }
    }

### 12. cohere-changelog.md (6b4232eab4abc9fd1c07b5ee03d24574552cb621b9b715d1ef02589770bb426e)
- bm25: -23.9486 | relevance: 1.0000

Follow-ups:
- If the app still feels slow, instrument counts/latency of `/api/sonoma` calls per phase and consider parallelizing non-dependent prefetches.

---

Date (UTC): 2026-02-23T16:53:49.2989770Z

Topic: New Games overlay game — Flash Cards (math)

Recon prompt (exact string):
Build new Games overlay game 'Flash Cards': setup screen selects subject (math dropdown), topic, stage; 50 flashcards per topic per stage; 10 stages per topic; meter up/down with goal to advance; stage completion screen (Next); topic completion screen (more exciting, movement, shows next topic + Next). Persist per-learner progress across sessions.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Implement Flash Cards entirely client-side inside GamesOverlay, with deterministic per-learner math decks (50 cards per stage/topic) and localStorage persistence so progress resumes across sessions.
- Files changed: src/app/session/components/games/GamesOverlay.jsx, src/app/session/components/games/FlashCards.jsx, src/app/session/components/games/flashcardsMathDeck.js, cohere-changelog.md

Follow-ups:
- If you want cross-device progress (not just same browser), add a Supabase-backed progress table and swap the storage adapter.

### 2026-02-27 � Generation error: e.map is not a function
- Recon prompt: `Generation Failed error from lesson generator API route - investigate callModel and storage upload`
- Root cause: `buildValidationChangeRequest(validation)` passed whole `{ passed, issues, warnings }` object; function calls `.map()` directly on its argument
- Fix: `src/app/facilitator/generator/page.js` � `buildValidationChangeRequest(validation)` ? `buildValidationChangeRequest(validation.issues)`

### 13. docs/brain/ingests/pack.lesson-schedule-debug.md (ff4a86926b331453f8f6a8fcb311c4367895cc33f5c1b641faf366e3ba113121)
- bm25: -23.9301 | relevance: 1.0000

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

### 14. docs/brain/manifest.json (c84e253717b47212b1719debc33ac92047bd5a6c13afe3f7e47485e845256ff6)
- bm25: -23.6076 | relevance: 1.0000

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

### 15. docs/brain/ingests/pack.md (26cbfbfdc932653f646c2218ebaec8fa3fb19e5d960bc7766502c497351f374a)
- bm25: -23.5602 | relevance: 1.0000

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

### 16. docs/brain/ingests/pack.md (e7c4df837b9e3283dae2f9af0f6fd6ebefd8be8dfe4d6e1df56144b4d22564d8)
- bm25: -23.5348 | relevance: 1.0000

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

### 17. docs/brain/ingests/pack-mentor-intercepts.md (4dae7caeca0c56aeb7dad284f26e1f8a3bdc63e4132ae7b1ea978d78896eea4f)
- bm25: -23.4660 | relevance: 1.0000

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

### 18. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (d05d5d221a529b823920ad988a0fbf12f29278fe69a0c72a1bd1dd95072154f8)
- bm25: -23.4193 | relevance: 1.0000

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

### 19. docs/brain/ingests/pack.planned-lessons-flow.md (196db63f29d528f16d0db6be45aadd46555525c550797b39a0c85f30162b04c4)
- bm25: -23.4193 | relevance: 1.0000

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

### 20. sidekick_pack.md (e6a8550c4046e0c6f0024ee9ef0d6e28d4adccf7c75426888d2214fc3c46db44)
- bm25: -23.2780 | relevance: 1.0000

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

### 21. docs/brain/ingests/pack.planned-lessons-flow.md (631320264e28f6aade98cea9e5e99c54c685ade70ba0ff5054efb444271c559d)
- bm25: -23.0858 | relevance: 1.0000

### 28. src/app/facilitator/generator/counselor/MentorInterceptor.js (61b589ea2c796b43b267ada5fafdf5815ea1989501e82bb17472e966f42c77c0)
- bm25: -14.0785 | relevance: 1.0000

const wantsCurriculum = normalized.includes('curriculum') || normalized.includes('preference') || normalized.includes('banned') || normalized.includes('avoid')
    const wantsPattern = normalized.includes('weekly pattern') || (normalized.includes('pattern') && normalized.includes('week')) || normalized.includes('schedule template')
    const wantsCustomSubjectAdd = (normalized.includes('add') || normalized.includes('create') || normalized.includes('new')) && normalized.includes('subject')
    const wantsCustomSubjectDelete = (normalized.includes('delete') || normalized.includes('remove')) && normalized.includes('subject')
    const wantsPlan = (normalized.includes('lesson plan') || normalized.includes('lesson planner') || normalized.includes('planned lessons')) &&
      (normalized.includes('schedule') || normalized.includes('generate') || normalized.includes('make') || normalized.includes('start') || normalized.includes('duration'))

if (wantsCustomSubjectAdd) {
      this.state.flow = 'custom_subject_add'

// Attempt to extract name after "subject"
      const match = userMessage.match(/subject\s+(.+)$/i)
      const maybeName = match?.[1] ? String(match[1]).trim() : ''
      if (maybeName && maybeName.length <= 60) {
        this.state.context.subjectName = maybeName
        this.state.awaitingConfirmation = true
        this.state.awaitingInput = null
        return {
          handled: true,
          response: `Should I add a custom subject named "${maybeName}"?`
        }
      }

### 22. docs/brain/ingests/pack.planned-lessons-flow.md (adc19afdea7bdf534f71a846ee6f87a9d438ef3a8b85594268dd0260c3715b64)
- bm25: -23.0507 | relevance: 1.0000

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

### 23. src/app/facilitator/generator/counselor/CounselorClient.jsx (9ed677021ed30a5ebb5b2885d2458a4e5c80c6a85f951e42e5087db618317bb4)
- bm25: -22.7440 | relevance: 1.0000

if (!target?.id) {
                  interceptResult.response = `I couldn't find a custom subject named "${action.name}".`
                } else {
                  const delRes = await fetch(`/api/custom-subjects?id=${encodeURIComponent(target.id)}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                  })
                  const delJs = await delRes.json().catch(() => null)
                  if (!delRes.ok) {
                    interceptResult.response = delJs?.error
                      ? `I couldn't delete that subject: ${delJs.error}`
                      : "I couldn't delete that subject. Please try again."
                  } else {
                    interceptResult.response = `Deleted custom subject: ${target.name}.`
                  }
                }
              } catch {
                interceptResult.response = "I couldn't delete that subject. Please try again."
              }
            }
          } else if (action.type === 'generate_lesson_plan') {
            setLoadingThought('Opening Lesson Planner...')

### 24. docs/brain/custom-subjects.md (7e58ee1ca5dc34b720347edc91b697304897f6b53937497421004d738d51df62)
- bm25: -22.7367 | relevance: 1.0000

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

### 25. docs/brain/ingests/pack.md (ba535074b2f0f77bd019d7cbc5af650b25c0a1324c4e30da69008dc9db4c053b)
- bm25: -22.4885 | relevance: 1.0000

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

### 26. src/app/facilitator/generator/counselor/MentorInterceptor.js (a7782eec255590a78122476b30f38091ea203b79863da3ec7a7a3ecadfc2a537)
- bm25: -22.2056 | relevance: 1.0000

this.state.flow = 'lesson_plan'
    this.state.awaitingInput = 'lesson_plan_choice'
    return {
      handled: true,
      response: 'I can help with curriculum preferences, your weekly pattern, custom subjects, or scheduling a lesson plan. What would you like to do?'
    }
  }
  
  /**
   * Handle lesson search flow
   */
  async handleSearch(userMessage, context) {
    const { allLessons = {} } = context
    const params = extractLessonParams(userMessage)
    
    // Search lessons
    const results = this.searchLessons(allLessons, params, userMessage)
    
    if (results.length === 0) {
      return {
        handled: true,
        response: "I couldn't find any lessons matching that description. Would you like me to generate a custom lesson instead?"
      }
    }
    
    // Show top results
    const lessonList = results.slice(0, 5).map((lesson, idx) => 
      `${idx + 1}. ${lesson.title} - ${lesson.grade} ${lesson.subject} (${lesson.difficulty})`
    ).join('\n')
    
    this.state.flow = 'search'
    this.state.context.searchResults = results
    this.state.awaitingInput = 'lesson_selection'
    
    return {
      handled: true,
      response: `It looks like you might be referring to one of these lessons:\n\n${lessonList}\n\nWhich lesson would you like to work with? You can say the number or the lesson name.`
    }
  }
  
  /**
   * Search lessons based on parameters
   */
  searchLessons(allLessons, params, searchTerm) {
    const results = []
    const normalizedSearch = normalizeText(searchTerm)
    
    for (const [subject, lessons] of Object.entries(allLessons)) {
      if (!Array.isArray(lessons)) continue
      
      for (const lesson of lessons) {
        let score = 0
        
        // Match subject
        if (params.subject && subject.toLowerC

### 27. docs/brain/ingests/pack.lesson-schedule-debug.md (fc18c4ad0ce8de2f0921d5cc14c58d4e4c3beab9ea79e7d6928e61b1cc0b4a95)
- bm25: -22.2049 | relevance: 1.0000

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

### 28. docs/brain/facilitator-help-system.md (8c85fd8c620a30ce27d8f5b1a2c1456f132eca5ca12c7325ed760169a9d9da7d)
- bm25: -22.1574 | relevance: 1.0000

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

### 29. cohere-changelog.md (b7741fc42ad62eae52894275d15088486a2bfb6a60ab5903cc11000cef471de1)
- bm25: -21.8869 | relevance: 1.0000

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Special-case curriculum preferences in `handleFaq` to answer “describe” locally and route “report” to a new interceptor action that fetches preferences via existing API.
- Files changed: src/app/facilitator/generator/counselor/MentorInterceptor.js, src/app/facilitator/generator/counselor/CounselorClient.jsx, cohere-changelog.md

Follow-ups:
- Consider adding similar report handlers for weekly pattern and custom subjects.

---

Date (UTC): 2026-02-18T15:28:05.4203857Z

Topic: Feature registry (describe+report) + ThoughtHub blindspot hook

Recon prompt (exact string):
Implement a feature registry for Mr. Mentor: a machine-readable catalog of user-facing features that supports (1) deterministic describe responses, (2) deterministic report responses by calling existing app APIs (learner-scoped when needed), and (3) a hook to log blindspots to ThoughtHub. Identify existing FAQ loader data sources and interceptor entrypoints.

Key evidence:
- sidekick_pack: sidekick_pack.md
- rounds journal: sidekick_rounds.jsonl (search by prompt)

Result:
- Decision: Create a registry that merges existing FAQ JSON features with report-capable feature entries; route FAQ intent through the registry; log no-match queries via `interceptor_context.mentor_blindspot` and persist into ThoughtHub event meta.
- Files changed: src/lib/mentor/featureRegistry.js, src/app/facilitator/generator/counselor/MentorInterceptor.js, src/app/facilitator/generator/counselor/CounselorClient.jsx, src/app/api/counselor/route.js, cohere-changelog.md

Follow-ups:
- Add more report-capable entries (custom subjects, goals notes, lesson schedule summaries).

---

### 30. docs/brain/ingests/pack.planned-lessons-flow.md (155578c318bfa1c68504c39454f35d1dcfc25dd6e797a69bfbd7d4d8c9043962)
- bm25: -21.8702 | relevance: 1.0000

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

### 31. src/lib/mentor/featureRegistry.js (e8145a54599e2324b30c2cc6eb52c0e95377ebefc8c7372bc663781c9306eb24)
- bm25: -21.7849 | relevance: 1.0000

export function shouldTreatAsReportQuery(userInput, context) {
  const normalized = normalizeText(userInput)
  const learnerName = context?.learnerName ? normalizeText(context.learnerName) : ''

return (
    /\bmy\b/.test(normalized) ||
    normalized.includes('current') ||
    normalized.includes('right now') ||
    normalized.includes('show me') ||
    normalized.includes('list') ||
    normalized.includes('what are my') ||
    (learnerName && normalized.includes(learnerName))
  )
}

export function isLikelyAppFeatureQuery(userInput) {
  const normalized = normalizeText(userInput)
  if (!normalized) return false

// If the user references UI or app mechanics, it's likely app-feature related.
  const uiSignals = [
    'in the app',
    'on the site',
    'on this page',
    'where is',
    'where do i',
    'button',
    'dropdown',
    'click',
    'tap',
    'menu',
    'settings',
    'calendar',
    'lessons',
    'schedule',
    'scheduled',
    'assign',
    'approved',
    'generate',
    'edit',
    'learner',
    'worksheet',
    'comprehension',
    'exercise',
    'test',
    'goals',
    'notes',
    'curriculum',
    'weekly pattern',
    'custom subject',
    'custom subjects',
    'planned lessons',
    'lesson planner',
    'no school',
    'holiday',
    'medal',
    'medals',
    'device',
    'devices',
    'subscription',
    'plan',
    'billing',
    'quota',
    'timezone',
    'mr mentor',
    'thought hub',
    'thouthub'
  ]

return uiSignals.some((s) => normalized.includes(s))
}

### 32. docs/brain/ingests/pack-mentor-intercepts.md (4165868b5790029e01f7c01d44458476250e5d36cdd1cc5c43972b949e391bb5)
- bm25: -21.7257 | relevance: 1.0000

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

### 33. src/app/facilitator/generator/counselor/MentorInterceptor.js (2bf439c0a2eb9795e0824bcdbd5fab181498002834a68be6f74f7b90ec41471e)
- bm25: -20.9261 | relevance: 1.0000

if (!selectedLearnerId) {
      return {
        handled: true,
        response: 'Please select a learner from the dropdown first, then I can help you set curriculum preferences, weekly patterns, and schedule a lesson plan.'
      }
    }

### 34. docs/brain/mr-mentor-conversation-flows.md (ec792e77787419d1b45a207c4f316b72a0b239666251a1dadd891ad81666a1ed)
- bm25: -20.8659 | relevance: 1.0000

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

### 35. sidekick_pack.md (305262c426dc85f8c66cb888e4b25f01697fac656a8656c69c3ded6fe8880d06)
- bm25: -20.3879 | relevance: 1.0000

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

### 36. src/app/facilitator/account/plan/page.js (05226c906fac9ae6693610b2fbc5e0070180f676406132be090bb2a32298be79)
- bm25: -20.0182 | relevance: 1.0000

"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccessControl } from '@/app/hooks/useAccessControl';
import { ensurePinAllowed } from '@/app/lib/pinGate';
import GatedOverlay from '@/app/components/GatedOverlay';
// BillingStatusDev removed per request

const plans = [
  { name: 'Free', priceLabel: 'Free', priceSub: '', features: ['Access to 1 lesson per day', '1 Learner'], highlight: false },
  { name: 'Trial', priceLabel: 'Free trial', priceSub: '', features: ['Generate up to 5 lessons (lifetime)', 'No Lesson Planner', 'No Mr. Mentor', 'No Golden Keys, Visual Aids, or Games'], highlight: true },
  { name: 'Standard', priceLabel: '$49', priceSub: 'per month', features: ['Unlimited lessons', 'Lesson Maker', '2 Learners', 'Golden Keys + Visual Aids + Games'], highlight: false },
  { name: 'Pro', priceLabel: '$69', priceSub: 'per month', features: ['Everything in Standard', '5 Learners', 'Mr. Mentor', 'Lesson Planner + Curriculum Preferences'], highlight: false },
];

async function startTrial(setLoadingTier, setCurrentTier) {
  try {
    setLoadingTier('trial');
    const token = await getAccessToken();
    if (!token) throw new Error('Please sign in to start your trial');
    const res = await fetch('/api/billing/start-trial', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.error || 'Unable to start trial');
    setCurrentTier('trial');
  } catch (e) {
    if (typeof window !== 'undefined') alert(e?.message || 'Unable to start trial');
  } finally {
    setLoadingTier(null);
  }
}

### 37. src/app/api/counselor/route.js (4d2e160d3ab6aca791c2ec247367ff87eb38626c390c680fc8db625916e602c4)
- bm25: -19.7335 | relevance: 1.0000

// Helper function to provide capability information
function getCapabilitiesInfo(args) {
  const { action } = args
  
  const capabilities = {
    search_lessons: {
      name: 'search_lessons',
      purpose: 'Search for available lessons across ALL subjects including facilitator-created lessons. You have full access to everything in the library.',
      when_to_use: 'When facilitator asks about available lessons, wants to find lessons on a topic, or needs to browse options. Use subject="facilitator" to find ONLY their custom-created lessons.',
      parameters: {
        subject: 'Optional. Filter by: math, science, language arts, social studies, or facilitator (their custom lessons)',
        grade: 'Optional. Grade level like "3rd", "5th", "8th"',
        searchTerm: 'Optional. Keywords to match in lesson titles'
      },
      returns: 'List of up to 30 matching lessons with title, grade, subject, difficulty, lessonKey (for scheduling), and blurb',
      examples: [
        'Search for 3rd grade multiplication: {subject: "math", grade: "3rd", searchTerm: "multiplication"}',
        'Find facilitator-created lessons: {subject: "facilitator"}',
        'Find their lessons on a topic: {subject: "facilitator", searchTerm: "fractions"}'
      ]
    },
    
    get_lesson_details: {
      name: 'get_lesson_details',
      purpose: 'Get full details of a specific lesson including vocabulary, teaching notes, and question counts',
      when_to_use: 'When you need to understand lesson content to make recommendations or facilitator asks "tell me more about..."',
      parameters: {
        lessonKey: 'Required. Format: "subject/filename.json" (you get this from search_lessons results)'
      },
      returns: 'Lesson details: vocabulary (first 5 terms), teaching notes, ques

### 38. src/app/facilitator/calendar/CurriculumPreferencesOverlay.jsx (e4f320d7dcc37c1ce5e49f6e74e85309c757f98388f348250ab5cc23054eaed2)
- bm25: -19.2663 | relevance: 1.0000

// Curriculum preferences overlay for lesson planner
'use client'
import { useState, useEffect } from 'react'
import { getSupabaseClient } from '@/app/lib/supabaseClient'

export default function CurriculumPreferencesOverlay({ learnerId, onClose, onSaved }) {
  const [bannedWords, setBannedWords] = useState('')
  const [bannedTopics, setBannedTopics] = useState('')
  const [bannedConcepts, setBannedConcepts] = useState('')
  const [focusTopics, setFocusTopics] = useState('')
  const [focusConcepts, setFocusConcepts] = useState('')
  const [focusKeywords, setFocusKeywords] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

useEffect(() => {
    loadPreferences()
  }, [learnerId])

const loadPreferences = async () => {
    if (!learnerId) {
      setLoading(false)
      return
    }

try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

if (!token) {
        setLoading(false)
        return
      }

const response = await fetch(`/api/curriculum-preferences?learnerId=${learnerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

if (response.ok) {
        const result = await response.json()
        const prefs = result.preferences

### 39. src/app/facilitator/generator/counselor/CounselorClient.jsx (7985a9cd29c3d0664e482322021d1d43d58e7879c7e9b97b2330f38558ddf2d6)
- bm25: -18.9985 | relevance: 1.0000

if (!token) {
              interceptResult.response = 'Please sign in first.'
            } else {
              try {
                const res = await fetch('/api/custom-subjects', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ name: action.name })
                })
                const js = await res.json().catch(() => null)
                if (!res.ok) {
                  interceptResult.response = js?.error
                    ? `I couldn't add that subject: ${js.error}`
                    : "I couldn't add that subject. Please try again."
                } else {
                  interceptResult.response = `Added custom subject: ${js?.subject?.name || action.name}.`
                }
              } catch {
                interceptResult.response = "I couldn't add that subject. Please try again."
              }
            }
          } else if (action.type === 'delete_custom_subject') {
            setLoadingThought('Deleting custom subject...')

### 40. src/app/facilitator/generator/counselor/MentorInterceptor.js (c12d51a1a8a168edcd71aaedcd1ddeb0bbad4ec93e34852ef627b1922a575d90)
- bm25: -18.2100 | relevance: 1.0000

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
