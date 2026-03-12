# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
DayViewOverlay + button Schedule Lesson Plan Lesson owned lessons overlay LessonGeneratorOverlay subject picker auto-plan curriculum preferences
```

Filter terms used:
```text
DayViewOverlay
LessonGeneratorOverlay
button
schedule
lesson
plan
owned
lessons
overlay
subject
picker
auto
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-11 19:48` — lesson_key format mismatch between session page and lessons page - medals stored but not displaying, upsertMedal lessonK
- `2026-03-11 19:56` — awards page medals display completed lessons learn/lessons page - all locations that show medals or completed lessons an
- `2026-03-11 20:21` — When I remove planned lessons, they come back after a refresh.

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

DayViewOverlay LessonGeneratorOverlay button schedule lesson plan owned lessons overlay subject picker auto

## Forced Context

(none)

## Ranked Evidence

### 1. cohere-changelog.md (7dcae5cf5f70e4d8e5db11cedb97f4dc9992abed55b6a3545a7f0fd240f3ec1b)
- bm25: -17.4200 | entity_overlap_w: 4.00 | adjusted: -18.4200 | relevance: 0.9485

### 2026-02-27 � Generated lesson not appearing in calendar after scheduling
- Root cause (1): `loadSchedule` filtered out past-date+uncompleted lessons, hiding intentionally-scheduled entries for past/same-day dates
- Root cause (2): `onGenerated` callback passed no data; calendar had to wait for `loadSchedule` to complete before showing the new lesson (race condition)
- Fix (1): Removed `if (isPast && !completed && !completionLookupFailed) return` filter from `calendar/page.js`; all entries in `lesson_schedule` table now always display
- Fix (2): `LessonGeneratorOverlay` now parses schedule POST response and passes `newEntry` to `onGenerated(newEntry)`; forwarded through `DayViewOverlay` to calendar page which immediately injects it into `scheduledLessons` state before `loadSchedule` completes
- Files: `LessonGeneratorOverlay.jsx`, `DayViewOverlay.jsx`, `calendar/page.js`

## 2026-03-02 � Remove redundant PIN on timer pause toggle (v2)
Prompt: `Timers overlay PIN check pause redundant already authenticated`
Fix: Removed `ensurePinAllowed('timer')` from `handleTimerPauseToggle` in SessionPageV2.jsx. Opening the overlay is still PIN-gated via `handleTimerClick`. V1 page.js already had this correct.
File: src/app/session/v2/SessionPageV2.jsx

## 2026-03-02 � Auto-bold vocab in captions; strip GPT markdown asterisks
Prompt: `vocab words bold captions TTS text display caption rendering`
Fix: CaptionPanel.js � (1) Added stripMarkdown() to remove **bold** markers from displayed text before render. (2) Removed phase==='discussion'||'teaching' restriction so vocab terms are bolded in all phases.
File: src/app/session/components/CaptionPanel.js

### 2. docs/brain/calendar-lesson-planning.md (bad918b02a71d06047328cb4b549e073ad8083ccb4d33488af50cae26e835d4c)
- bm25: -17.8248 | relevance: 0.9469

**Owned-only rule:**
- The picker shows ONLY facilitator-owned lessons.
- It does not list public curriculum lessons from `public/lessons`.

### 3. src/app/facilitator/calendar/DayViewOverlay.jsx (eed37ca8a7208b20854b0a40039e64098e151896c8b5aefc52a1142da8773026)
- bm25: -15.0424 | entity_overlap_w: 3.00 | adjusted: -15.7924 | relevance: 0.9404

﻿// Day view overlay showing all scheduled and planned lessons for a selected date
'use client'
import { useEffect, useState } from 'react'
import LessonGeneratorOverlay from './LessonGeneratorOverlay'
import LessonEditor from '@/components/LessonEditor'
import VisualAidsCarousel from '@/components/VisualAidsCarousel'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import LessonNotesModal from './LessonNotesModal'
import VisualAidsManagerModal from './VisualAidsManagerModal'
import PortfolioScansModal from './PortfolioScansModal'
import TypedRemoveConfirmModal from './TypedRemoveConfirmModal'

export default function DayViewOverlay({ 
  selectedDate, 
  scheduledLessons = [], 
  plannedLessons = [], 
  learnerId,
  learners = [],
  learnerGrade,
  tier,
  onClose,
  onLessonGenerated,
  onNoSchoolSet,
  onPlannedLessonUpdate,
  onPlannedLessonRemove,
  noSchoolReason = null
}) {
  const getLocalTodayStr = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

const isPastSelectedDate = selectedDate < getLocalTodayStr()

### 4. docs/brain/ingests/pack.md (449969b4c519b1e04ae0f2ff5cdd6f65950ce2e104330fb9db2a7d480291f3c5)
- bm25: -15.3584 | relevance: 0.9389

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

### 5. sidekick_pack.md (1752b37d6124c9152e21b9d16bc65c88fe33f0886604147c28c18388987d6019)
- bm25: -15.0590 | relevance: 0.9377

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

### 6. src/app/facilitator/calendar/DayViewOverlay.jsx (03746da986464685148f7b5b4f67e64b6fcf67443f5dbb030bd3352e60b8ead0)
- bm25: -14.6143 | entity_overlap_w: 1.00 | adjusted: -14.8643 | relevance: 0.9370

// If generator overlay is open, show it
  if (showGenerator) {
    return (
      <LessonGeneratorOverlay
        learnerId={learnerId}
        learnerGrade={learnerGrade}
        tier={tier}
        scheduledDate={selectedDate}
        prefilledData={generatorData}
        onClose={() => setShowGenerator(false)}
        onGenerated={(entry) => {
          setShowGenerator(false)
          if (onLessonGenerated) onLessonGenerated(entry)
        }}
      />
    )
  }

### 7. src/app/facilitator/calendar/DayViewOverlay.jsx (4e8900a39e892658118ceac81ad426f664400f0acc10758bf3af34f97bfce1b5)
- bm25: -14.7601 | relevance: 0.9365

if (scheduledRes.ok) {
        const scheduledData = await scheduledRes.json()
        const schedule = Array.isArray(scheduledData?.schedule) ? scheduledData.schedule : []
        if (schedule.length > 0) {
          contextText += '\n\nScheduled lessons (do NOT reuse these topics):\n'
          schedule
            .slice()
            .sort((a, b) => String(a.scheduled_date || '').localeCompare(String(b.scheduled_date || '')))
            .slice(-60)
            .forEach((s) => {
              contextText += `- ${s.scheduled_date}: ${s.lesson_key}\n`
            })
        }
      }

if (plannedRes.ok) {
        const plannedData = await plannedRes.json()
        const allPlanned = plannedData?.plannedLessons || {}
        const flattened = []
        Object.entries(allPlanned).forEach(([date, arr]) => {
          ;(Array.isArray(arr) ? arr : []).forEach((l) => {
            flattened.push({ date, subject: l.subject, title: l.title, description: l.description })
          })
        })
        if (flattened.length > 0) {
          contextText += '\n\nPlanned lessons already in the calendar plan (do NOT repeat these topics):\n'
          flattened
            .slice()
            .sort((a, b) => String(a.date).localeCompare(String(b.date)))
            .slice(-80)
            .forEach((l) => {
              contextText += `- ${l.date} (${l.subject || 'general'}): ${l.title || l.description || 'planned lesson'}\n`
            })
        }
      }

### 8. docs/brain/ingests/pack.planned-lessons-flow.md (bb1ea8e97e97bc7a7cf0e595d4c2e295f2243bf8cb59b699da17b5cf5ee90289)
- bm25: -13.6403 | relevance: 0.9317

### 30. docs/brain/lesson-library-downloads.md (b1b9e213db751b5765dbf2e696989c3293e61bd99e1db9d560a4332ae5c3532e)
- bm25: -13.9504 | relevance: 1.0000

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

### 9. docs/brain/lesson-library-downloads.md (b1b9e213db751b5765dbf2e696989c3293e61bd99e1db9d560a4332ae5c3532e)
- bm25: -13.3209 | relevance: 0.9302

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

### 10. src/app/facilitator/lessons/page.js (586445b2660fc915d4d28d1f17246a57e3924b58015c01aeef31074f8c00487f)
- bm25: -13.2814 | relevance: 0.9300

const owned = {}
      for (const lesson of sortedGeneratedList) {
        const subj = (lesson?.subject || '').toString().toLowerCase() || 'math'
        const file = lesson?.file
        if (file) owned[`${subj}/${file}`] = true
      }
      setOwnedLessonKeys(owned)

### 11. docs/brain/ingests/pack.planned-lessons-flow.md (155578c318bfa1c68504c39454f35d1dcfc25dd6e797a69bfbd7d4d8c9043962)
- bm25: -13.0100 | relevance: 0.9286

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

### 12. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (7a42963d49cceba71f31be9d3d8d544fccccaaf4d62770d956e70416bd7e72ff)
- bm25: -12.8629 | relevance: 0.9279

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

### 13. src/app/api/lesson-schedule/route.js (4e331f192a6c56a4cab8c5f7afbe0982981f3bd236880d62edeea56744dbb7e2)
- bm25: -12.5295 | relevance: 0.9261

// Default behavior: prefer facilitator-scoped schedule rows, plus safe legacy rows where facilitator_id is null.
    // Overlay/debug callers can pass includeAll=1 to retrieve all schedule rows for an owned learner.
    if (!includeAll) {
      query = query.or(`facilitator_id.eq.${user.id},facilitator_id.is.null`)
    }

### 14. src/app/facilitator/lessons/page.js (ddcf0631a2f69aa8582e5b17c20193105567fe8a508a5e74cc93dc045fa6a48d)
- bm25: -12.1317 | relevance: 0.9238

const owned = {}
            for (const lesson of sortedGeneratedList) {
              const subj = (lesson?.subject || '').toString().toLowerCase() || 'math'
              const file = lesson?.file
              if (file) owned[`${subj}/${file}`] = true
            }
            if (!cancelled) setOwnedLessonKeys(owned)

const merged = { ...lessonsMap, generated: [] }
            for (const lesson of sortedGeneratedList.slice().reverse()) {
              const subject = lesson.subject || 'math'
              const generatedLesson = { ...lesson, isGenerated: true }
              if (!merged[subject]) merged[subject] = []
              merged[subject].unshift(generatedLesson)
              merged['generated'].push(generatedLesson)
            }

if (!cancelled) setAllLessons(merged)
          }
        }
      } catch {
        // Silent fail
      }
    })()
    return () => { cancelled = true }
  }, []) // Load once on mount

async function refreshOwnedLessons() {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

const res = await fetch('/api/facilitator/lessons/list', {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) return

const generatedList = await res.json()
      const sortedGeneratedList = (Array.isArray(generatedList) ? generatedList : []).sort((a, b) => {
        const timeA = new Date(a?.created_at || 0).getTime()
        const timeB = new Date(b?.created_at || 0).getTime()
        return timeB - timeA
      })

### 15. docs/brain/ingests/pack.md (c4c8f100a25071abdd37e3a676ea7a188fe9fc86430b3f600c5879355aad4113)
- bm25: -12.0163 | relevance: 0.9232

**`/api/learner/lesson-history`** - completed/incomplete sessions  
**`/api/medals`** - lesson scores (may 404 for new learners)  
**`/api/lesson-schedule`** - scheduled lessons (returns `{schedule: [...]}`)  
**`/api/curriculum-preferences`** - focus/banned content  
**`/api/generate-lesson-outline`** - GPT outline generation per subject/date
  - Supports `context` (planner-built history/schedule/plan context)
  - Supports `promptUpdate` (facilitator-provided steering text, used heavily by Redo)

### 16. docs/brain/calendar-lesson-planning.md (265bc11b6e14ebc78b549a5a598ef082eba677b6a58860236e1c61224231f8bf)
- bm25: -12.0160 | relevance: 0.9232

**`/api/learner/lesson-history`** - completed/incomplete sessions  
**`/api/medals`** - lesson scores (may 404 for new learners)  
**`/api/lesson-schedule`** - scheduled lessons (returns `{schedule: [...]}`)  
**`/api/curriculum-preferences`** - focus/banned content  
**`/api/generate-lesson-outline`** - GPT outline generation per subject/date
  - Supports `context` (planner-built history/schedule/plan context)
  - Supports `promptUpdate` (facilitator-provided steering text, used heavily by Redo)

### 17. src/app/facilitator/lessons/page.js (3aeb618d125233610a882a3bd9ea8022d983ccf35e4587a427898672704269f2)
- bm25: -11.9213 | relevance: 0.9226

export default function FacilitatorLessonsPage() {
  const router = useRouter()
  const { loading: authLoading, isAuthenticated, gateType } = useAccessControl({ requiredAuth: true })
  const { coreSubjects, subjectsWithoutGenerated: subjectDropdownOptions } = useFacilitatorSubjects({ includeGenerated: true })
  const [pinChecked, setPinChecked] = useState(false)
  const [tier, setTier] = useState('free')
  const [learners, setLearners] = useState([])
  const [selectedLearnerId, setSelectedLearnerId] = useState(null)
  const [allLessons, setAllLessons] = useState({}) // { subject: [lessons] }
  const [lessonLibraryScope, setLessonLibraryScope] = useState('owned') // owned | downloadable | all
  const [ownedLessonKeys, setOwnedLessonKeys] = useState({}) // { 'subject/file.json': true }
  const [downloadingLesson, setDownloadingLesson] = useState(null) // `${subject}/${file}`
  const [availableLessons, setAvailableLessons] = useState({}) // { 'subject/lesson_file': true } - lessons shown to learner
  const [scheduledLessons, setScheduledLessons] = useState({}) // { 'subject/lesson_file': true } - lessons scheduled for today
  const [futureScheduledLessons, setFutureScheduledLessons] = useState({}) // { 'subject/lesson_file': 'YYYY-MM-DD' } - lessons scheduled for future dates
  const [activeGoldenKeys, setActiveGoldenKeys] = useState({}) // { 'subject/lesson_file': true }
  const [lessonNotes, setLessonNotes] = useState({}) // { 'subject/lesson_file': 'note text' }
  const [medals, setMedals] = useState({}) // { lesson_key: { bestPercent, medalTier } }
  const [loading, setLoading] = useState(true)
  const [lessonsLoading, setLessonsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedS

### 18. docs/brain/ingests/pack.lesson-schedule-debug.md (e2b842c370bb0f99fc9f215cdd7f7ae8c892569b10dc1e4f04911b503e3c107c)
- bm25: -11.1437 | entity_overlap_w: 3.00 | adjusted: -11.8937 | relevance: 0.9224

2025-12-15T01:20:00Z | Copilot | FIX: Build failure - incorrect Supabase import path. Import path '@/lib/supabase' does not exist in project. Corrected to '@/app/lib/supabaseClient' matching pattern used throughout codebase (TutorialGuard, PostLessonSurvey, session page, etc). Build now completes successfully. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (corrected getSupabaseClient import path).
2025-12-15T01:15:00Z | Copilot | FIX: Redo button failing with 401 Unauthorized error. Redo button fetch call to /api/generate-lesson-outline did not include Authorization header with auth token. API endpoint requires Bearer token for authentication (checks request.headers.authorization). Added getSupabaseClient import to DayViewOverlay, modified handleRedoClick to fetch session token via supabase.auth.getSession() before API call, added 'Authorization': `Bearer ${token}` header to fetch request. Redo button now successfully regenerates lesson outlines. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (imported getSupabaseClient, updated handleRedoClick to get auth token and include in headers).
2025-12-15T01:00:00Z | Copilot | FEATURE: Implemented color differentiation for scheduled vs planned lessons in calendar. Scheduled lessons display in orange (#fef3c7 bg, #f59e0b indicator), planned lessons display in blue (#dbeafe bg, #3b82f6 indicator). Added isPlannedView prop to LessonCalendar component that determines which color scheme to use. Updated date cell background color logic and indicator dot color to conditionally apply blue for planned view or orange for scheduled view. Calendar page passes isPlannedView={activeTab === 'planner'} prop based on current tab. Visual distinction makes it immediately clear whether viewing scheduled curriculum or planning futu

### 19. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (db752affeea2f66a776f276697741c41922e9f65f2dad265d123b0fd6b485abd)
- bm25: -11.1364 | entity_overlap_w: 3.00 | adjusted: -11.8864 | relevance: 0.9224

2025-12-15T01:20:00Z | Copilot | FIX: Build failure - incorrect Supabase import path. Import path '@/lib/supabase' does not exist in project. Corrected to '@/app/lib/supabaseClient' matching pattern used throughout codebase (TutorialGuard, PostLessonSurvey, session page, etc). Build now completes successfully. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (corrected getSupabaseClient import path).
2025-12-15T01:15:00Z | Copilot | FIX: Redo button failing with 401 Unauthorized error. Redo button fetch call to /api/generate-lesson-outline did not include Authorization header with auth token. API endpoint requires Bearer token for authentication (checks request.headers.authorization). Added getSupabaseClient import to DayViewOverlay, modified handleRedoClick to fetch session token via supabase.auth.getSession() before API call, added 'Authorization': `Bearer ${token}` header to fetch request. Redo button now successfully regenerates lesson outlines. Files: src/app/facilitator/calendar/DayViewOverlay.jsx (imported getSupabaseClient, updated handleRedoClick to get auth token and include in headers).
2025-12-15T01:00:00Z | Copilot | FEATURE: Implemented color differentiation for scheduled vs planned lessons in calendar. Scheduled lessons display in orange (#fef3c7 bg, #f59e0b indicator), planned lessons display in blue (#dbeafe bg, #3b82f6 indicator). Added isPlannedView prop to LessonCalendar component that determines which color scheme to use. Updated date cell background color logic and indicator dot color to conditionally apply blue for planned view or orange for scheduled view. Calendar page passes isPlannedView={activeTab === 'planner'} prop based on current tab. Visual distinction makes it immediately clear whether viewing scheduled curriculum or planning futu

### 20. src/app/facilitator/calendar/DayViewOverlay.jsx (7577304e3892bf5e4c3fa4aed1b94cdf8d7dd088cc5d8d69899410aea5f9becc)
- bm25: -11.8434 | relevance: 0.9221

const PICKER_MONTHS_DV = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const buildPickerDaysDV = (year, month) => {
    const fd = new Date(year, month, 1).getDay()
    const dim = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < fd; i++) cells.push(null)
    for (let d = 1; d <= dim; d++) cells.push(d)
    return cells
  }

const handleRescheduleLesson = async (lesson, newDate) => {
    if (!newDate) return
    setReschedulingBusy(true)
    try {
      const token = await getAuthTokenOrThrow()
      const del = await fetch(`/api/lesson-schedule?id=${lesson.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
      })
      if (!del.ok) throw new Error('Failed to remove old schedule')
      const add = await fetch('/api/lesson-schedule', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ learnerId, lessonKey: lesson.lesson_key, scheduledDate: newDate })
      })
      if (!add.ok) throw new Error('Failed to reschedule lesson')
      setReschedulePickerKey(null)
      if (onLessonGenerated) onLessonGenerated()
    } catch (err) {
      alert(err?.message || 'Failed to reschedule lesson')
    } finally {
      setReschedulingBusy(false)
    }
  }

### 21. docs/brain/ingests/pack.planned-lessons-flow.md (d9468c04764bd8e3c3053ded3e82ce932fe0cdc355425156b28e6a39d73b37c1)
- bm25: -11.5772 | relevance: 0.9205

// Sort chronologically
      lessonContext.sort((a, b) => new Date(a.date) - new Date(b.date))

// Get curriculum preferences
      if (preferencesRes.ok) {
        curriculumPrefs = await preferencesRes.json()
      }

// Build context string for GPT
      let contextText = ''
      if (lessonContext.length > 0) {
        contextText += '\n\nLearner Lesson History (chronological):\n'
        lessonContext.forEach(l => {
          if (l.status === 'completed' && l.score !== null) {
            contextText += `- ${l.name} (${l.status}, score: ${l.score}%)\n`
          } else {
            contextText += `- ${l.name} (${l.status})\n`
          }
        })
      }

// Review policy thresholds (tuned for "repeat low scores, skip high scores")
        const LOW_SCORE_REVIEW_THRESHOLD = 70
        const HIGH_SCORE_AVOID_REPEAT_THRESHOLD = 85

const lowScoreCompleted = lessonContext
          .filter((l) => l.status === 'completed' && l.score !== null && l.score <= LOW_SCORE_REVIEW_THRESHOLD)
          .slice(-20)

const highScoreCompleted = lessonContext
          .filter((l) => l.status === 'completed' && l.score !== null && l.score >= HIGH_SCORE_AVOID_REPEAT_THRESHOLD)
          .slice(-30)

### 19. docs/brain/calendar-lesson-planning.md (bad918b02a71d06047328cb4b549e073ad8083ccb4d33488af50cae26e835d4c)
- bm25: -17.9746 | relevance: 1.0000

**Owned-only rule:**
- The picker shows ONLY facilitator-owned lessons.
- It does not list public curriculum lessons from `public/lessons`.

### 20. src/app/facilitator/generator/counselor/CounselorClient.jsx (b3bff12a4e114ccf499c988e1a221f45dc4b8dbaf9c141ebdeb90230b9b94c43)
- bm25: -17.3723 | relevance: 1.0000

### 22. docs/brain/calendar-lesson-planning.md (de0b7e2265d9cfcb4b0c9cd0651ba3db1eb254c5334aa7a65a5b5a4fad4aba17)
- bm25: -11.5760 | relevance: 0.9205

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

### 23. src/app/facilitator/calendar/LessonGeneratorOverlay.jsx (e95cccf2122a8de30d54580c51d05d5d8fb83e6f819889c49553190971e84f1e)
- bm25: -11.5201 | relevance: 0.9201

// Generate the full lesson
      const res = await fetch('/api/facilitator/lessons/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: form.title,
          subject: form.subject,
          difficulty: form.difficulty,
          grade: form.grade,
          description: form.description,
          notes: form.notes,
          vocab: form.vocab
        })
      })

### 24. docs/brain/calendar-lesson-planning.md (b5fceec1ff172ff9be6e16676dfd040ac9bf511ccfa0190409ecada4fe8df328)
- bm25: -11.4640 | relevance: 0.9198

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

### 25. docs/brain/ingests/pack.lesson-schedule-debug.md (70940359c629eb7191429b557e1c30bb4e172a7c5692b740c4eda364fd8808f7)
- bm25: -11.4580 | relevance: 0.9197

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

### 26. src/app/facilitator/lessons/page.js (8e1d0152023692ca3eaccc2c7316c55555b8511d45303d8f6dda4fa1614eead9)
- bm25: -11.3921 | relevance: 0.9193

// Load all lessons from all subjects immediately on mount
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLessonsLoading(true)

const lessonsMap = {}

// Start loading public lesson lists immediately (no auth needed) and do it in parallel.
      const publicSubjects = coreSubjects
      await Promise.all(
        publicSubjects.map(async (subject) => {
          try {
            const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { cache: 'no-store' })
            if (!res.ok) {
              lessonsMap[subject] = []
              return
            }
            const list = await res.json()
            lessonsMap[subject] = Array.isArray(list) ? list : []
          } catch {
            lessonsMap[subject] = []
          }
        })
      )

// Initialize generated bucket even if we haven't loaded owned lessons yet.
      lessonsMap['generated'] = []

// Publish public lessons ASAP so Load Lessons feels instant.
      if (!cancelled) {
        setAllLessons({ ...lessonsMap })
        setLessonsLoading(false)
      }

// Now load owned lessons (requires auth) and merge them in.
      try {
        const supabase = getSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token

if (token) {
          const res = await fetch('/api/facilitator/lessons/list', {
            cache: 'no-store',
            headers: { Authorization: `Bearer ${token}` }
          })

### 27. docs/brain/ingests/pack.planned-lessons-flow.md (c985a44d345e351fd61ade599be3e29e3e7386375d077fade62e6f02a4bdad24)
- bm25: -11.3620 | relevance: 0.9191

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

### 28. docs/brain/ingests/pack.md (457324d43ea5d640d2143d6eabafb9637ff47ccee9bda121abde347baffba259)
- bm25: -11.3620 | relevance: 0.9191

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

### 29. docs/brain/ingests/pack.planned-lessons-flow.md (977ea1fb41e88dbfb463ff963fab380938020371c08f2fc5257aaaaa42d3af4b)
- bm25: -11.3015 | relevance: 0.9187

{customSubjects.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {customSubjects.map(subject => (
              <div
                key={subject.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: '#f3f4f6',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#374151'
                }}
              >
                {subject.name}
                <button
                  onClick={() => handleDeleteCustomSubject(subject.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: 0,
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

{/* Planned Lessons Info */}
      {Object.keys(plannedLessons).length > 0 && (
        <div style={{
          background: '#eff6ff',
          borderRadius: 8,
          border: '1px solid #93c5fd',
          padding: 12
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af' }}>
            ✓ Lesson plan generated! Click on dates in the calendar to see planned lessons.
          </div>
        </div>
      )}

### 10. docs/brain/calendar-lesson-planning.md (db1b960e51971b06a27c642e674e9d2199de30b512b88c4bf9712f0b883539ff)
- bm25: -23.9661 | relevance: 1.0000

### 30. docs/brain/ingests/pack.md (90a382c3781f765190781869790ccf18304821e4a8a147aac0b1f34bf9033e76)
- bm25: -11.2537 | relevance: 0.9184

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

### 31. src/app/facilitator/calendar/LessonPlanner.jsx (6eb19de9b4a6b757548c4210ea1a87c087bd6b0056e991a180d330431ea006ea)
- bm25: -11.2465 | relevance: 0.9183

{customSubjects.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {customSubjects.map(subject => (
              <div
                key={subject.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: '#f3f4f6',
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#374151'
                }}
              >
                {subject.name}
                <button
                  onClick={() => handleDeleteCustomSubject(subject.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontSize: 14,
                    padding: 0,
                    lineHeight: 1
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

{/* Planned Lessons Info */}
      {Object.keys(plannedLessons).length > 0 && (
        <div style={{
          background: '#eff6ff',
          borderRadius: 8,
          border: '1px solid #93c5fd',
          padding: 12
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af' }}>
            ✓ Lesson plan generated! Click on dates in the calendar to see planned lessons.
          </div>
        </div>
      )}

### 32. sidekick_pack.md (64290ed97a847af4937b0a588896e436500fd857627efa1c162e556d74128b94)
- bm25: -11.2022 | relevance: 0.9180

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

### 33. sidekick_pack.md (3f3c176dc6a1ced225717f1bd569e7abfe0dd3af095d1f4e365d6e563ed3fa37)
- bm25: -11.1994 | relevance: 0.9180

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

### 34. sidekick_pack.md (1f6274a84a55ab7a17f92e611febefdaec3e2da83bb2ddc88fe58c6e23404ae4)
- bm25: -11.1256 | relevance: 0.9175

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

### 35. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (6f21e8c53d45aa7cb79771bb3c67723de5b861fd8aff799b290e1cbc7f251295)
- bm25: -11.1097 | relevance: 0.9174

<div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => setShowPlannerOverlay(true)}
                    disabled={!learnerId || learnerId === 'none'}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      borderRadius: 8,
                      border: '1px solid #d1d5db',
                      background: (!learnerId || learnerId === 'none') ? '#f3f4f6' : '#111827',
                      color: (!learnerId || learnerId === 'none') ? '#9ca3af' : '#fff',
                      cursor: (!learnerId || learnerId === 'none') ? 'not-allowed' : 'pointer'
                    }}
                    title={(!learnerId || learnerId === 'none') ? 'Select a learner first' : 'Open the full Lesson Planner'}
                  >
                    Create a Lesson Plan
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                  {(!learnerId || learnerId === 'none')
                    ? 'Select a learner to view planned lessons'
                    : (selectedDate ? 'No planned lessons' : 'Select a date to view planned lessons')}
                </div>

### 36. src/lib/faq/facilitator-tools.json (01d1775600d96190823d9a009a124babf1c8c002bd0016694f7f2e5a685b8241)
- bm25: -11.0923 | relevance: 0.9173

{
  "category": "Facilitator Settings & Tools",
  "features": [
    {
      "id": "facilitator-dashboard",
      "title": "Facilitator Dashboard",
      "keywords": [
        "facilitator dashboard",
        "dashboard",
        "facilitator tools",
        "adult tools",
        "teacher tools"
      ],
      "description": "The Facilitator Dashboard is where you manage learners, lessons, scheduling, and account-level facilitator tools.",
      "howToUse": "Open the facilitator area and use the Learners and Lessons sections to manage your work. Mr. Mentor can also open key overlays for you.",
      "relatedFeatures": ["learner-profiles", "lesson-library", "mr-mentor"]
    },
    {
      "id": "goals-clipboard",
      "title": "Goals Clipboard",
      "keywords": [
        "goals clipboard",
        "goals button",
        "notes clipboard",
        "open goals"
      ],
      "description": "The Goals clipboard is the UI where you view and edit Goals and Notes for the selected learner (or facilitator).",
      "howToUse": "Click the 'Goals' button to open it. Mr. Mentor can also help you review what’s saved (report) or suggest what to write (describe/advice).",
      "relatedFeatures": ["goals-notes"]
    },
    {
      "id": "lessons-overlay",
      "title": "Lessons Overlay",
      "keywords": [
        "lessons overlay",
        "lessons button",
        "open lessons",
        "show my lessons",
        "lesson list"
      ],
      "description": "The Lessons overlay is a quick way to browse, search, and act on lessons (schedule, assign/approve, edit, or review).",
      "howToUse": "Click the 'Lessons' button, or ask Mr. Mentor to show lessons and help you find the one you want.",
      "relatedFeatures": ["lesson-library", "lesson-scheduling", "lesson-editing"]

### 37. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (e47ddd04b34ab36279c5d316853898791919b110f8830092679f492ed463f28c)
- bm25: -10.9551 | relevance: 0.9164

**Flow (entry points):**
1. Facilitator Lessons page: navigate to `facilitator/lessons`, select learner, expand subject
2. Calendar schedule view (past completed lessons): click **Notes** on a scheduled lesson
3. Mr. Mentor Calendar overlay (past completed lessons): click **Notes** on a scheduled lesson
4. Type note text and save
5. Empty note deletes the key from the JSONB map (no empty-string storage)
5. When facilitator discusses learner with Mr. Mentor, notes appear in transcript:
   ```
   FACILITATOR NOTES ON LESSONS:

### 38. src/app/facilitator/generator/counselor/MentorInterceptor.js (f4ac7b7c15763423d23bed0191b3efd98dee41efb20a528414769c1fba0e90bb)
- bm25: -10.9247 | relevance: 0.9161

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

### 39. src/app/facilitator/lessons/page.js (5999d823a6da00cc3e4b1c9c307b57ae0784d513c746865011370f6ae142f5a3)
- bm25: -10.9066 | relevance: 0.9160

// If a public lesson has been downloaded (owned copy exists), hide the public entry.
        if (!isOwned && ownedByKey) return

if (lessonLibraryScope === 'owned' && !isOwned) return
        if (lessonLibraryScope === 'downloadable' && isOwned) return

const lessonKey = lesson.isGenerated 
          ? `generated/${lesson.file}` 
          : `${subject}/${lesson.file}`
        
        const hasMetalData = medals[lessonKey]
        
        // Normalize lesson grade
        let lessonGrade = null
        if (lesson.grade) {
          lessonGrade = String(lesson.grade).trim().replace(/(?:st|nd|rd|th)$/i, '').toUpperCase()
        }
        
        // Apply grade filter
        if (selectedGrade !== 'all' && lessonGrade !== selectedGrade) return
        
        // Apply search filter
        const searchLower = searchTerm.toLowerCase()
        if (searchTerm && !lesson.title.toLowerCase().includes(searchLower)) return
        
        filtered.push({
          ...lesson,
          subject,
          lessonKey,
          displayGrade: lessonGrade
        })
      })
    })
    
    // Sort by subject, then grade, then title
    filtered.sort((a, b) => {
      if (a.subject !== b.subject) {
        return a.subject.localeCompare(b.subject)
      }
      if (a.displayGrade !== b.displayGrade) {
        // Handle K specially
        if (a.displayGrade === 'K') return -1
        if (b.displayGrade === 'K') return 1
        const numA = parseInt(a.displayGrade) || 0
        const numB = parseInt(b.displayGrade) || 0
        return numA - numB
      }
      return a.title.localeCompare(b.title)
    })
    
    return filtered
  }

### 40. src/app/facilitator/lessons/page.js (80a9b04c22e05f3fcb2bfbd98ed2dcbe69ef4ba0143cf2e3c524445144e7b241)
- bm25: -10.8836 | relevance: 0.9159

<select
                value={lessonLibraryScope}
                onChange={(e) => setLessonLibraryScope(e.target.value)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                  background: '#fff',
                  cursor: 'pointer',
                  minWidth: '150px'
                }}
              >
                <option value="owned">Owned</option>
                <option value="downloadable">Downloadable</option>
                <option value="all">All Lessons</option>
              </select>

<button
                onClick={() => setShowLessons(true)}
                disabled={showLessons}
                style={{
                  padding: '10px 24px',
                  background: showLessons ? '#e5e7eb' : '#3b82f6',
                  color: showLessons ? '#9ca3af' : '#fff',
                  border: 'none',
                  borderRadius: 6,
                  fontWeight: 600,
                  cursor: showLessons ? 'default' : 'pointer',
                  fontSize: 14,
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                Load Lessons
              </button>


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
