# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
curriculum preferences generate-lesson-outline context generation one day lesson planner single day broken
```

Filter terms used:
```text
curriculum
preferences
generate
lesson
outline
context
generation
one
day
planner
single
broken
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-11 19:56` — awards page medals display completed lessons learn/lessons page - all locations that show medals or completed lessons an
- `2026-03-11 20:21` — When I remove planned lessons, they come back after a refresh.
- `2026-03-11 20:28` — DayViewOverlay + button Schedule Lesson Plan Lesson owned lessons overlay LessonGeneratorOverlay subject picker auto-pla

---

## [REMINDER] Copilot Self-Recon Obligation

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

Pack chunk count (approximate): 6. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

curriculum preferences generate lesson outline context generation one day planner single broken

## Forced Context

(none)

## Ranked Evidence

### 1. docs/brain/ingests/pack.md (c4c8f100a25071abdd37e3a676ea7a188fe9fc86430b3f600c5879355aad4113)
- bm25: -29.3724 | relevance: 0.9671

**`/api/learner/lesson-history`** - completed/incomplete sessions  
**`/api/medals`** - lesson scores (may 404 for new learners)  
**`/api/lesson-schedule`** - scheduled lessons (returns `{schedule: [...]}`)  
**`/api/curriculum-preferences`** - focus/banned content  
**`/api/generate-lesson-outline`** - GPT outline generation per subject/date
  - Supports `context` (planner-built history/schedule/plan context)
  - Supports `promptUpdate` (facilitator-provided steering text, used heavily by Redo)

### 2. docs/brain/calendar-lesson-planning.md (265bc11b6e14ebc78b549a5a598ef082eba677b6a58860236e1c61224231f8bf)
- bm25: -29.3061 | relevance: 0.9670

**`/api/learner/lesson-history`** - completed/incomplete sessions  
**`/api/medals`** - lesson scores (may 404 for new learners)  
**`/api/lesson-schedule`** - scheduled lessons (returns `{schedule: [...]}`)  
**`/api/curriculum-preferences`** - focus/banned content  
**`/api/generate-lesson-outline`** - GPT outline generation per subject/date
  - Supports `context` (planner-built history/schedule/plan context)
  - Supports `promptUpdate` (facilitator-provided steering text, used heavily by Redo)

### 3. docs/brain/calendar-lesson-planning.md (8fb5d6fd52eb343d38244e53af009c1d078e80740d159006615a9235e71a5585)
- bm25: -28.2682 | relevance: 0.9658

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
- bm25: -28.1377 | relevance: 0.9657

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

### 5. docs/brain/ingests/pack.md (5fd0b2319691b60c2ab2d7c6a9650ea9f00741ed6e601d04079fc31a2701cf61)
- bm25: -28.0390 | relevance: 0.9656

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

### 6. sidekick_pack.md (abb89cc2d6ea14313372a56663b0976a0234db712b9cbde62805394db4d66f42)
- bm25: -27.7318 | relevance: 0.9652

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

### 7. sidekick_pack.md (4c5b8bc8077b109c8c99a1196a375108c0227ae6411557a1522b11641918a2df)
- bm25: -27.7318 | relevance: 0.9652

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

### 8. cohere-changelog.md (75f8edfef6769a25cd296bfa345d54f7faf6c69179342ecb8e9b779a224350a7)
- bm25: -23.6122 | relevance: 0.9594

2026-03-03T00:00:00Z | Feature: per-subject curriculum preferences + Lesson Planner duration options redesign. (1) CurriculumPreferencesOverlay: full rewrite — added subject dropdown listing Global, core subjects (math, language arts, science, social studies, general), and custom subjects passed as `customSubjects` prop from LessonPlanner. Selecting a subject loads/saves that subject's focus/ban lists. Global subject maps to existing top-level columns; per-subject data stored in new `subject_preferences` JSONB column (scripts/add-curriculum-subject-preferences.sql). (2) API route `/api/curriculum-preferences`: POST now accepts `subject` field (defaults 'all'). 'all' saves global columns via upsert (unchanged). Any other subject does a read-merge-write on `subject_preferences` JSONB blob. GET unchanged. (3) LessonPlanner: duration dropdown changed from "1–4 Months" to day/week options (1d, 2d, 3d, 4d, 1w, 2w, 3w, 4w) using `parseDurationToDays()` helper; old numeric values treated as weeks for backward compat. Generation loop refactored from week×dayIndex nested loops to single dayOffset loop over totalDays. Preferences context bug fixed (was referencing `curriculumPrefs.focus_concepts` on the raw response envelope — was always undefined). Per-subject context now injected per-slot in `getSubjectContextAdditions(subject)` merging global + subject-specific. Partial results on outer error preserved via `onPlannedLessonsChange` in catch block. `customSubjects` now passed to CurriculumPreferencesOverlay. Files: CurriculumPreferencesOverlay.jsx, LessonPlanner.jsx, src/app/api/curriculum-preferences/route.js, scripts/add-curriculum-subject-preferences.sql. DB: run scripts/add-curriculum-subject-preferences.sql. Recon prompt: "Curriculum Preferences focuses and bans per subject

### 9. src/app/facilitator/calendar/LessonPlanner.jsx (bddbac2b757dd8ab8d0f63a15be69e1a60397f253e6c940a93fdd1dca85cf2c7)
- bm25: -21.6588 | relevance: 0.9559

const dayName = DAYS[currentDate.getDay()]
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`
        const daySubjects = weeklyPattern[dayName] || []

for (const subjectInfo of daySubjects) {
          // Generate outline for each subject on this day
          try {
            const dynamicContextText = `${contextText}${getSubjectContextAdditions(subjectInfo.subject)}${buildGenerationSoFarText(subjectInfo.subject)}`

const response = await fetch('/api/generate-lesson-outline', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  subject: subjectInfo.subject,
                  grade: learnerGrade || '3rd',
                  difficulty: recommendedDifficulty,
                  learnerId,
                  context: dynamicContextText  // Include lesson history, preferences, and generation-so-far
                })
              })

if (response.ok) {
                const result = await response.json()
                const outline = result.outline

if (!lessons[dateStr]) {
                  lessons[dateStr] = []
                }

lessons[dateStr].push({
                  ...outline,
                  id: `${dateStr}-${subjectInfo.subject}`,
                  subject: subjectInfo.subject
                })

### 10. sidekick_pack.md (d62c6741ac395fbdad0b9d21b669ab12793639e264438a2e035c67198dec3016)
- bm25: -19.4923 | relevance: 0.9512

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

### 11. docs/brain/ingests/pack.lesson-schedule-debug.md (0d46f7c2216ba778232cac583e98e29806e63b730e0971657fcc9c8e8208a89c)
- bm25: -19.3598 | relevance: 0.9509

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

### 12. src/app/api/curriculum-preferences/route.js (aa6d9d785a8575d8060710b9c063d2a0c2c18ad4cf81ef22a7d11df61e3ce355)
- bm25: -19.1597 | relevance: 0.9504

let data, error
    if (existingId) {
      const res = await supabase
        .from('curriculum_preferences')
        .update({ subject_preferences: mergedSubjectPrefs, updated_at: now })
        .eq('id', existingId)
        .select()
        .single()
      data = res.data
      error = res.error
    } else {
      const res = await supabase
        .from('curriculum_preferences')
        .upsert({
          facilitator_id: user.id,
          learner_id: learnerId,
          banned_words: [],
          banned_topics: [],
          banned_concepts: [],
          focus_topics: [],
          focus_concepts: [],
          focus_keywords: [],
          subject_preferences: mergedSubjectPrefs,
          updated_at: now
        }, { onConflict: 'facilitator_id,learner_id' })
        .select()
        .single()
      data = res.data
      error = res.error
    }

if (error) {
      const isMissingColumn =
        error.message?.includes('subject_preferences') ||
        error.code === '42703' ||
        error.code === 'PGRST204'
      if (isMissingColumn) {
        console.error('subject_preferences column missing — run scripts/add-curriculum-subject-preferences.sql', error)
        return NextResponse.json({
          error: 'Per-subject preferences require a one-time database update. Run scripts/add-curriculum-subject-preferences.sql in Supabase.',
          migrationNeeded: true
        }, { status: 500 })
      }
      console.error('Error saving subject curriculum preferences:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

### 13. docs/brain/ingests/pack.lesson-schedule-debug.md (9f379726dc01ad3380a3b439e9f96ec15fa0e460570337171051caa5a5d09ee8)
- bm25: -18.4551 | relevance: 0.9486

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

### 14. docs/brain/calendar-lesson-planning.md (1855144ade44b43a78489cf3246c6df30aa1531fdb5dbb9a20f4fe3d2898703f)
- bm25: -17.9697 | relevance: 0.9473

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

### 15. src/app/facilitator/generator/counselor/MentorInterceptor.js (431919c0bcf8badb71978139f17c822c3bb7798fe0a6495afa6258667486b491)
- bm25: -17.6643 | relevance: 0.9464

// Curriculum preferences (single-shot preferred)
    if (this.state.awaitingInput === 'curriculum_prefs_focus_and_avoid') {
      const text = String(userMessage || '').trim()
      const lower = text.toLowerCase()

const focusMatch = text.match(/\bfocus\s*:\s*([^\n;]+)(?:[;\n]|$)/i)
      const avoidMatch = text.match(/\bavoid\s*:\s*([^\n;]+)(?:[;\n]|$)/i)

const focusRaw = focusMatch?.[1] || ''
      const avoidRaw = avoidMatch?.[1] || ''

if (focusRaw) {
        this.state.context.curriculum.focusTopics = this.parseListFromText(focusRaw)
      }
      if (avoidRaw) {
        this.state.context.curriculum.bannedTopics = this.parseListFromText(avoidRaw)
      }

// If they didn't use Focus/Avoid labels, treat their message as focus and ask for avoid.
      if (!focusRaw && !avoidRaw) {
        if (lower === 'skip') {
          this.state.context.curriculum.focusTopics = []
        } else {
          this.state.context.curriculum.focusTopics = this.parseListFromText(text)
        }
      }

if (!this.state.context.curriculum.bannedTopics) {
        this.state.awaitingInput = 'curriculum_prefs_avoid'
        return {
          handled: true,
          response: `What topics should we avoid for ${learnerName || 'this learner'}? (comma-separated, or say "skip")`
        }
      }

this.state.awaitingConfirmation = true
      this.state.awaitingInput = null
      return {
        handled: true,
        response: `Should I save these curriculum preferences for ${learnerName || 'this learner'}?\n\nFocus: ${(this.state.context.curriculum.focusTopics || []).join(', ') || '(none)'}\nAvoid: ${(this.state.context.curriculum.bannedTopics || []).join(', ') || '(none)'}`
      }
    }

### 16. sidekick_pack.md (bcd88c0b1d1b124721ff79f4c0d812bba5b7bee99ff66ccb3d3fbd27ef226395)
- bm25: -17.5949 | relevance: 0.9462

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

### 17. docs/brain/ingests/pack.md (c9661f9dcd74df3cde9a29ba506ce65af935aaaefd2b314837236b771df3e7fd)
- bm25: -17.5737 | relevance: 0.9462

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

### 18. docs/brain/ingests/pack.lesson-schedule-debug.md (19e83f394456a0f4b2f8e0cd451128d789d6216b029b3b4a64a4b74d645bc394)
- bm25: -17.5720 | relevance: 0.9462

- **Location**: `src/app/api/generate-lesson-outline/route.js`
- **Method**: POST
- **Auth**: Bearer token required
- **Body**: `{ subject, grade, difficulty, learnerId?, context?, promptUpdate? }`
  - `context`: planner-provided history/scheduled/planned context to prevent repeats
  - `promptUpdate`: facilitator-provided steering text (used by Redo on planned lessons)

### 19. docs/brain/ingests/pack.md (e1dee79b45583e9ff75bdb216cfbbde5bf6caba4575234ac0b81fd1cb170d071)
- bm25: -17.5620 | relevance: 0.9461

- **Location**: `src/app/api/generate-lesson-outline/route.js`
- **Method**: POST
- **Auth**: Bearer token required
- **Body**: `{ subject, grade, difficulty, learnerId?, context?, promptUpdate? }`
  - `context`: planner-provided history/scheduled/planned context to prevent repeats
  - `promptUpdate`: facilitator-provided steering text (used by Redo on planned lessons)

### 20. docs/brain/ingests/pack.planned-lessons-flow.md (b7a980085f6bc8e1ca16fde88940d8b9b190529334412446a3b7827aec14d21d)
- bm25: -17.4850 | relevance: 0.9459

### 11. docs/brain/calendar-lesson-planning.md (1855144ade44b43a78489cf3246c6df30aa1531fdb5dbb9a20f4fe3d2898703f)
- bm25: -23.9232 | relevance: 1.0000

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

### 21. src/app/facilitator/generator/counselor/MentorInterceptor.js (f4ac7b7c15763423d23bed0191b3efd98dee41efb20a528414769c1fba0e90bb)
- bm25: -17.3961 | relevance: 0.9456

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

### 22. src/lib/mentor/featureRegistry.js (dde9f8ffd6b150af84621cde7ebb083c7b481740cfea0878428c295294e39ba2)
- bm25: -16.4346 | relevance: 0.9426

function getReportableFeatures() {
  return [
    {
      id: 'goals-notes',
      title: 'Goals and Notes',
      category: 'Learners',
      keywords: [
        'goals',
        'notes',
        'goals and notes',
        'learner goals',
        'learner notes',
        'my goals',
        'goals clipboard'
      ],
      description:
        'Goals and Notes are persistent observations you save about a learner (or yourself as facilitator). They help keep context across sessions and let Mr. Mentor tailor guidance.',
      howToUse:
        "To review what's saved, ask 'show my goals and notes'. To update them, open the Goals clipboard or tell me what you'd like to add/change.",
      relatedFeatures: ['learner-profiles', 'mr-mentor'],
      report: {
        actionType: 'report_goals_notes',
        requiresLearner: false
      }
    },
    {
      id: 'curriculum-preferences',
      title: 'Curriculum Preferences',
      category: 'Facilitator',
      keywords: [
        'curriculum preferences',
        'curriculum',
        'learning preferences',
        'focus topics',
        'avoid topics'
      ],
      description:
        "Curriculum preferences are learner-specific guardrails for lesson planning. They let you set topics to focus on and topics to avoid, and Mr. Mentor will use them to guide lesson generation and planning.",
      howToUse:
        "To set them, tell me focus topics and avoid topics for a selected learner, and I can save them. To review what's saved, ask 'show my curriculum preferences'.",
      relatedFeatures: [],
      report: {
        actionType: 'report_curriculum_preferences',
        requiresLearner: true
      }
    },
    {
      id: 'weekly-pattern',
      title: 'Weekly Pattern',
      category: 'Facilitator',
      keywords: [

### 23. sidekick_pack.md (bf63051019c4e3768336c09c25c02f91dadf884b80fad6f3b289ccad0c2f7139)
- bm25: -16.4240 | relevance: 0.9426

**Context Integration:**
- Fetches learner's lesson history (completed, incomplete sessions)
- Loads medals/scores for completed lessons
- Gets scheduled lessons
- Retrieves curriculum preferences (focus/banned concepts/topics/words)
- Combines into context string sent to GPT for smarter lesson planning
- Prevents repetition of already-completed topics
- Prevents repetition within the same generation run by adding "generated so far" lessons into later GPT calls

### 24. docs/brain/api-routes.md (f1ee4af5914ccd9a2266616f7f17e803bc3681e9206331fe1c7a011816c5bc08)
- bm25: -16.4179 | relevance: 0.9426

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

### 25. docs/brain/ingests/pack.planned-lessons-flow.md (04858a7aa2cfe9fef82092e5a258005d9958e21a4600d83a7b00f9e45c943318)
- bm25: -16.3503 | relevance: 0.9424

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

### 26. docs/brain/ingests/pack-mentor-intercepts.md (97d64271b68bc6d4053092bc5752ec3b3bb5424024dd6610da4c6c6a7d49c541)
- bm25: -16.2648 | relevance: 0.9421

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

### 27. src/app/facilitator/calendar/LessonPlanner.jsx (e4bd80e253b70ad52be4a0ef35114eb245f76d7e7065a42dd554e3fc7c08e7db)
- bm25: -16.1313 | relevance: 0.9416

const generatePlannedLessons = async (startDate, totalDays = 7) => {
    if (!requirePlannerAccess()) return
    if (!learnerId) {
      alert('Please select a learner first')
      return
    }

const hasAnySubjects = DAYS.some(day => weeklyPattern[day]?.length > 0)
    if (!hasAnySubjects) {
      alert('Please assign subjects to at least one day of the week')
      return
    }

setGenerating(true)
    const lessons = {}

// Track what we generate during this run so later prompts can avoid repeats
    const generatedSoFar = []

try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

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
      let prefsRow = null

### 28. docs/brain/ingests/pack.md (b7db843ee1cf3e6960f94dbc37cf05a90870bc341c1e61e9c94d94dc5ea1e78f)
- bm25: -15.3285 | relevance: 0.9388

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

### 29. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (a116a0fe94aaefaf16c53814abf544636c96f392c721d41892382725b7ddddf9)
- bm25: -15.3136 | relevance: 0.9387

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

### 14. src/app/facilitator/generator/counselor/CounselorClient.jsx (f32cfa001a67b85c4fb1d68c1bfa6fbcf521a00fdd53aac77ad4d47c1948a374)
- bm25: -18.0843 | relevance: 1.0000

// Load learners list
  useEffect(() => {
    if (!tierChecked || !accessToken) return
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (supabase) {
          const { data } = await supabase.from('learners').select('*').order('created_at', { ascending: false })
          if (!cancelled && data) {
            setLearners(data)
          }
        }
      } catch (err) {
        // Silent error handling
      }
    })()
    return () => { cancelled = true }
  }, [accessToken, tierChecked])

### 30. docs/brain/ingests/pack.lesson-schedule-debug.md (fc18c4ad0ce8de2f0921d5cc14c58d4e4c3beab9ea79e7d6928e61b1cc0b4a95)
- bm25: -15.2481 | relevance: 0.9385

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

### 31. src/app/facilitator/generator/counselor/CounselorClient.jsx (1a524896d65039d810d20436047df237522a2b34344e4525e5015522a5bf877f)
- bm25: -15.2011 | relevance: 0.9383

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

### 32. docs/brain/facilitator-help-system.md (8c85fd8c620a30ce27d8f5b1a2c1456f132eca5ca12c7325ed760169a9d9da7d)
- bm25: -15.1797 | relevance: 0.9382

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

### 33. docs/brain/ingests/pack-mentor-intercepts.md (8a7301d0500f96c08aa055fafd78dfff6d432220ac856186ec0fc23816f67eb4)
- bm25: -15.0752 | relevance: 0.9378

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

### 34. src/app/facilitator/generator/counselor/MentorInterceptor.js (1bb798378d483e27811a87b9038eb22293dcb0b8136ed8c0206b479c564f4d94)
- bm25: -14.9210 | relevance: 0.9372

this.state.awaitingInput = 'custom_subject_delete_name'
      return {
        handled: true,
        response: 'Which custom subject would you like me to delete?'
      }
    }

if (wantsCurriculum) {
      this.state.flow = 'curriculum_prefs'
      this.state.context = { learnerId: selectedLearnerId, curriculum: {} }
      this.state.awaitingInput = 'curriculum_prefs_focus_and_avoid'
      return {
        handled: true,
        response: `Tell me what you want ${learnerName || 'this learner'} to focus on, and what you want to avoid. You can reply like: "Focus: fractions, reading comprehension. Avoid: scary war topics."`
      }
    }

if (wantsPattern) {
      this.state.flow = 'weekly_pattern'
      this.state.context = {
        learnerId: selectedLearnerId,
        weeklyPatternDraft: this.state.context.weeklyPatternDraft || {
          sunday: [], monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: []
        }
      }
      this.state.awaitingInput = 'pattern_day'
      return {
        handled: true,
        response: `Which day would you like to update in the weekly pattern for ${learnerName || 'this learner'}? (Sunday through Saturday)`
      }
    }

if (wantsPlan) {
      this.state.flow = 'lesson_plan_generate'
      this.state.context = { learnerId: selectedLearnerId }
      this.state.awaitingInput = 'plan_start_date'
      return {
        handled: true,
        response: `When should the lesson plan start for ${learnerName || 'this learner'}? You can say a date like 2026-02-10 or something like "next Monday".`
      }
    }

### 35. src/app/facilitator/generator/counselor/MentorInterceptor.js (c12d51a1a8a168edcd71aaedcd1ddeb0bbad4ec93e34852ef627b1922a575d90)
- bm25: -14.8780 | relevance: 0.9370

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

### 36. docs/brain/ingests/pack.planned-lessons-flow.md (155578c318bfa1c68504c39454f35d1dcfc25dd6e797a69bfbd7d4d8c9043962)
- bm25: -14.7990 | relevance: 0.9367

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

### 37. src/app/facilitator/generator/counselor/MentorInterceptor.js (daa1944a5977b52d5acc836973ecd29147f51122f230d0007ecdaa23ff258203)
- bm25: -14.6782 | relevance: 0.9362

if (this.state.awaitingInput === 'curriculum_prefs_avoid') {
      const text = String(userMessage || '').trim()
      this.state.context.curriculum.bannedTopics = text.toLowerCase() === 'skip' ? [] : this.parseListFromText(text)
      this.state.awaitingConfirmation = true
      this.state.awaitingInput = null
      return {
        handled: true,
        response: `Should I save these curriculum preferences for ${learnerName || 'this learner'}?\n\nFocus: ${(this.state.context.curriculum.focusTopics || []).join(', ') || '(none)'}\nAvoid: ${(this.state.context.curriculum.bannedTopics || []).join(', ') || '(none)'}`
      }
    }

### 38. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (300693ad7db2922e5dbf8403cbb489b142c9cd437056e734c2fc71d74f7d0fe5)
- bm25: -14.6243 | relevance: 0.9360

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

### 30. src/app/facilitator/generator/counselor/CounselorClient.jsx (410f29dc3fd0bf06c0fa6c768965509b32ed02741d5c932c54e3a1cb44fcb9bd)
- bm25: -14.6613 | relevance: 1.0000

// Handle Enter key to send message
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      sendMessage()
    }
  }

// Trigger new conversation flow (show clipboard first)
  const startNewConversation = useCallback(async () => {
    if (conversationHistory.length === 0) {
      // No conversation to save, just start fresh
      return
    }

// Show clipboard overlay immediately (skip audio instructions to avoid playback errors)
    // The overlay itself provides clear UI instructions
    setShowClipboard(true)
  }, [conversationHistory])

### 39. src/app/api/curriculum-preferences/route.js (2d1b7c9e09af18554dad070e6f667a38daa3cdb4cd88f3005e9a6de8e066b791)
- bm25: -14.6151 | relevance: 0.9360

const { data: existing, error: fetchErr } = await supabase
      .from('curriculum_preferences')
      .select('id, subject_preferences')
      .eq('facilitator_id', user.id)
      .eq('learner_id', learnerId)
      .maybeSingle()

if (fetchErr) {
      const isColMissing =
        fetchErr.message?.includes('subject_preferences') ||
        fetchErr.code === '42703' ||
        fetchErr.code === 'PGRST204'
      if (isColMissing) {
        // Column not yet added — fall back to id-only fetch so we at least know row state
        columnExists = false
        const { data: idOnly } = await supabase
          .from('curriculum_preferences')
          .select('id')
          .eq('facilitator_id', user.id)
          .eq('learner_id', learnerId)
          .maybeSingle()
        existingId = idOnly?.id || null
      } else {
        console.error('Error fetching existing curriculum preferences:', fetchErr)
        return NextResponse.json({ error: fetchErr.message }, { status: 500 })
      }
    } else {
      existingId = existing?.id || null
      existingSubjectPrefs = existing?.subject_preferences || {}
    }

if (!columnExists) {
      return NextResponse.json({
        error: 'Per-subject preferences require a one-time database update. Run scripts/add-curriculum-subject-preferences.sql in Supabase.',
        migrationNeeded: true
      }, { status: 500 })
    }

### 40. docs/brain/ingests/pack.md (8a535f1018b01bca63214b8dd441e8a6440e56eddd6d63a59123032e040c7111)
- bm25: -14.5806 | relevance: 0.9358

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


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
