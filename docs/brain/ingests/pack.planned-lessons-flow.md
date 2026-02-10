# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Where does /facilitator/calendar load planned lessons? Anchor on '/api/planned-lessons', 'planned_lessons', and 'LessonPlanner'. List the end-to-end data flow and files.

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

### 1. docs/brain/calendar-lesson-planning.md (508134b31ceac5379e6edf01fa6e367c144e9aac1f98d2a85cca866a2cb62f68)
- bm25: -36.4616 | entity_overlap_w: 1.50 | adjusted: -36.8366 | relevance: 1.0000

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

### 2. docs/brain/calendar-lesson-planning.md (5099a67314b21b85fa6a8156e8fd0f3b3e8f5c4ec53943e5cc4e0d17890d9adb)
- bm25: -33.5881 | entity_overlap_w: 3.50 | adjusted: -34.4631 | relevance: 1.0000

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

### 3. docs/brain/calendar-lesson-planning.md (b5fceec1ff172ff9be6e16676dfd040ac9bf511ccfa0190409ecada4fe8df328)
- bm25: -32.1347 | entity_overlap_w: 3.50 | adjusted: -33.0097 | relevance: 1.0000

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

### 5. docs/brain/MentorInterceptor_Architecture.md (b9af78a6a85babc29ee74ec9cf6073767b7a2e84a19456e1f96ab9a407cbd74d)
- bm25: -30.7151 | entity_overlap_w: 2.50 | adjusted: -31.3401 | relevance: 1.0000

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

### 6. docs/brain/calendar-lesson-planning.md (1c551999eb292e7d45b7c6306ea7223b5fc642288558019cf5b0b429daccc9cf)
- bm25: -30.1053 | entity_overlap_w: 1.00 | adjusted: -30.3553 | relevance: 1.0000

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

### 7. docs/brain/calendar-lesson-planning.md (8fb5d6fd52eb343d38244e53af009c1d078e80740d159006615a9235e71a5585)
- bm25: -27.4118 | relevance: 1.0000

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

### 8. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (25dec241b345621fbddf678eb05ac687effee9e2dc75d5c887cfe1b2199a525f)
- bm25: -26.5711 | entity_overlap_w: 3.00 | adjusted: -27.3211 | relevance: 1.0000

const response = await fetch('/api/planned-lessons', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          learnerId,
          plannedLessons: { [dateStr]: lessonsForDate }
        })
      })

const js = await response.json().catch(() => null)
      if (!response.ok) throw new Error(js?.error || 'Failed to save planned lessons')
      return true
    } catch (err) {
      alert('Failed to save planned lessons')
      return false
    }
  }

const savePlannedLessons = async (lessons) => {
    setPlannedLessons(lessons)

if (!learnerId || learnerId === 'none') return

try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return

await fetch('/api/planned-lessons', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          learnerId,
          plannedLessons: lessons
        })
      })
    } catch (err) {
      alert('Failed to save planned lessons')
    }
  }

const loadPlannedForLearner = useCallback(async (targetLearnerId, opts = {}) => {
    if (!targetLearnerId || targetLearnerId === 'none') {
      setPlannedLessons({})
      plannedLoadedForLearnerRef.current = null
      plannedLoadedAtRef.current = 0
      return
    }

const force = !!opts?.force
    if (plannedLoadInFlightRef.current) return
    if (!force
      && plannedLoadedForLearnerRef.current === targetLearnerId
      && (Date.now() - (plannedLoadedAtRef.current || 0)) < MIN_REFRESH_INTERVAL_MS
    ) {
      return
    }

### 9. src/app/facilitator/calendar/LessonPlanner.jsx (25995026c679706cc4664bad8fa9d83f36a2ea4d46f0cceb4221a8654af8eb71)
- bm25: -25.5684 | relevance: 1.0000

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

**2025-12-15**: Changed to date-specific overwrite for planned lessons
- POST now only deletes dates included in the new plan (uses `.in('scheduled_date', newPlanDates)`)
- Multiple non-overlapping plans can coexist (schedule Jan + Mar separately, both persist)
- Overlapping dates are replaced (reschedule Jan 15-31 overwrites only those dates)
- Enables incremental planning and gap-filling without losing unrelated lessons
- Removed full-replacement logic that deleted all planned lessons on every save

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

### 12. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a69efca9880db84d16bcf2416cead5e30a8ee222c1531e8f6d6ad02cf39c54d3)
- bm25: -21.9397 | relevance: 1.0000

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

### 13. docs/brain/calendar-lesson-planning.md (59e1f720e9da8a0e4092e8c32a2dd3518235e3c2695d8f75011f08689da9e9b1)
- bm25: -21.6091 | relevance: 1.0000

### ❌ DON'T: Delete ALL planned lessons on every save
**Why**: Users want to schedule multiple non-overlapping time periods (e.g., January + March). Full replacement would delete January when scheduling March. Use date-specific deletion instead.

### 14. src/app/facilitator/calendar/LessonPlanner.jsx (9304f9697a56abc0792ac130be58f504e565f9ce5e89cac035cad64c213eb58b)
- bm25: -21.1362 | relevance: 1.0000

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

generatedSoFar.push({
                  date: dateStr,
                  subject: subjectInfo.subject,
                  title: outline?.title || ''
                })
              }
            } catch (err) {
              console.error('Error generating outline:', err)
            }
          }
        }
      }

if (onPlannedLessonsChange) {
        onPlannedLessonsChange(lessons)
      }
    } catch (err) {
      console.error('Error generating planned lessons:', err)
      alert('Failed to generate lesson plan')
    } finally {
      setGenerating(false)
    }
  }

useEffect(() => {
    if (!autoGeneratePlan) return
    if (!learnerId) return
    if (!planStartDate) return
    if (!weeklyPatternLoadedRef.current) return
    if (generating) return

const key = `${learnerId}|${planStartDate}|${planDuration}`
    if (autoGenerateKeyRef.current === key) return

const hasAnySubjects = DAYS.some(day => weeklyPattern[day]?.length > 0)
    if (!hasAnySubjects) return

autoGenerateKeyRef.current = key
    const weeksToGenerate = Number(planDuration) * 4
    generatePlannedLessons(planStartDate, weeksToGenerate)
  }, [autoGeneratePlan, learnerId, planStartDate, planDuration, weeklyPattern, generating])

### 15. docs/brain/api-routes.md (f1ee4af5914ccd9a2266616f7f17e803bc3681e9206331fe1c7a011816c5bc08)
- bm25: -20.2508 | relevance: 1.0000

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

### 16. src/app/facilitator/calendar/LessonPlanner.jsx (fd591deb67440b85e69d10a8c0629a0abe24abd9a3d4d3f92016c00b9d8bf080)
- bm25: -20.2361 | relevance: 1.0000

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

### 17. docs/brain/calendar-lesson-planning.md (ca128987408f6009b4bc0b991a9c397f7bb90b4e589d5d04580e78c782af275e)
- bm25: -19.9524 | relevance: 1.0000

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

### 18. src/app/facilitator/calendar/LessonPlanner.jsx (bbc18a96e8e74f641a8270bf1cf9fd128312a7fadd6f6f9216546afe6ad539e8)
- bm25: -19.2572 | relevance: 1.0000

// Add planned lessons from current plan
      Object.entries(plannedLessons || {}).forEach(([date, dayLessons]) => {
        dayLessons.forEach(lesson => {
          lessonContext.push({
            name: lesson.title || lesson.id,
            date,
            status: 'planned'
          })
        })
      })

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

return response.json()
  }, [learnerTranscript, goalsNotes])
  
  // Load all lessons for interceptor
  const loadAllLessons = useCallback(async () => {
    const SUBJECTS = ['math', 'science', 'language arts', 'social studies', 'general']
    const results = {}
    
    for (const subject of SUBJECTS) {
      try {
        const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, {
          cache: 'no-store'
        })
        if (res.ok) {
          const list = await res.json()
          if (Array.isArray(list)) {
            results[subject] = list
          }
        }
      } catch (err) {
        // Silent error - continue with other subjects
      }
    }
    
    // Load generated lessons
    const supabase = getSupabaseClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    
    if (token) {
      try {
        const res = await fetch('/api/facilitator/lessons/list', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const generatedList = await res.json()
          results['generated'] = generatedList.map(lesson => ({
            ...lesson,
            isGenerated: true
          }))
          
          // Also add generated lessons to their subject buckets
          for (const lesson of generatedList) {
            const subject = lesson.subject || 'math'
            if (!results[subject]) results[subject] = []
            results[subject].push({
              ...lesson,
              isGenerated: true
            })
          }
        }
      } catch (err) {
        // Silent error
      }
    }
    
    return results
  }, [])

### 21. src/app/facilitator/calendar/LessonPlanner.jsx (6b168bfbed05e5a77c41e13237992b2579bfb9cb2101795ff35d795651c6016e)
- bm25: -17.3637 | relevance: 1.0000

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

### 22. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (260bb5af0a56cc92d5644d5052871273cbaaa8688deaae8b50bc28a03eb49591)
- bm25: -16.9634 | entity_overlap_w: 1.50 | adjusted: -17.3384 | relevance: 1.0000

try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

if (!token) {
        setPlannedLessons({})
        return
      }

const response = await fetch(`/api/planned-lessons?learnerId=${targetLearnerId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

if (!response.ok) {
        setPlannedLessons({})
        return
      }

const result = await response.json()
      setPlannedLessons(result.plannedLessons || {})
      plannedLoadedForLearnerRef.current = targetLearnerId
      plannedLoadedAtRef.current = Date.now()
    } catch (err) {
      setPlannedLessons({})
    } finally {
      plannedLoadInFlightRef.current = false
    }
  }, [])

const loadSchedule = useCallback(async (opts = {}) => {
    return loadScheduleForLearner(learnerId, opts)
  }, [learnerId, loadScheduleForLearner])

const loadPlanned = useCallback(async (opts = {}) => {
    return loadPlannedForLearner(learnerId, opts)
  }, [learnerId, loadPlannedForLearner])

const loadCalendarData = useCallback(async (opts = {}) => {
    await Promise.all([loadSchedule(opts), loadPlanned(opts)])
  }, [loadPlanned, loadSchedule])

const handleRemoveScheduledLessonById = async (scheduleId, opts = {}) => {
    if (!scheduleId) return
    if (!opts?.skipConfirm) {
      if (!confirm('Remove this lesson from the schedule?')) return
    }

### 23. docs/brain/calendar-lesson-planning.md (de0b7e2265d9cfcb4b0c9cd0651ba3db1eb254c5334aa7a65a5b5a4fad4aba17)
- bm25: -17.2002 | relevance: 1.0000

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

- `src/app/facilitator/calendar/LessonPicker.js`
  - Manual scheduling UI ("Add Lessons")
  - Loads ONLY facilitator-owned lessons via `/api/facilitator/lessons/list`
  - Produces `generated/<filename>` keys for scheduling and for `/api/lesson-file`

### 25. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (729242ae943c3b8f481fa5b12d46b37feb4a481ecbed5bcba067226e52184170)
- bm25: -14.5304 | relevance: 1.0000

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

### 26. docs/brain/lesson-library-downloads.md (ea6c987f912e08a4811e52893de3701d5c14ec17ac6ba2a12fed4b2d9135d9b9)
- bm25: -14.4910 | relevance: 1.0000

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

this.state.awaitingInput = 'custom_subject_name'
      return {
        handled: true,
        response: 'What custom subject would you like me to add?'
      }
    }

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

**LessonMakerOverlay** (`overlays/LessonMakerOverlay.jsx`)
- Compact lesson generation form
- Quota display
- All fields from full lesson maker
- Inline success/error messages
- Scrollable form

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

- On page mount, the client prefetches built-in lesson lists immediately (no auth required) and loads subjects in parallel.
- Owned lessons are then fetched after auth/session is available and merged into the list.
- This keeps the UI responsive so clicking "Load Lessons" feels instant even if auth is slow.

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

// Confirmation detection (yes/no)
function detectConfirmation(text) {
  const normalized = normalizeText(text)
  
  const yesPatterns = ['yes', 'yep', 'yeah', 'sure', 'ok', 'okay', 'correct', 'right', 'confirm', 'go ahead', 'do it']
  const noPatterns = ['no', 'nope', 'nah', 'cancel', 'stop', 'nevermind', 'never mind', 'dont', 'not']
  
  if (yesPatterns.some(p => normalized.includes(p))) return 'yes'
  if (noPatterns.some(p => normalized.includes(p))) return 'no'
  
  return null
}

### 35. docs/brain/v2-architecture.md (6b58472c0d17f41aea41b5c12dc7d85721f215fca1034c2dca60d8e04747ff7a)
- bm25: -12.7953 | relevance: 1.0000

---

## System Boundaries (Planned)

### AudioEngine Component
**Owns:**
- Audio playback state (HTMLAudio vs WebAudio vs Synthetic)
- Caption timing and synchronization
- Video play/pause coordination
- Mute state
- Speech guard timer

**Exposes:**
- `playAudio(base64, sentences, options)`
- `stopAudio()`
- `pauseAudio()`
- `resumeAudio()`
- Events: `onAudioStart`, `onAudioEnd`, `onCaptionChange`

**Does NOT:**
- Know about teaching stages
- Know about phase transitions
- Mutate phase state

### Video Playback Coordination

**How It Works:**
1. Video element has `loop`, `playsInline`, `muted`, and `preload="auto"` props - NO `autoPlay`
2. Video is preloaded on page load but remains paused
3. When user clicks Begin button, `startSession()` unlocks video playback:
   - Checks if video needs load: `if (videoRef.current.readyState < 2)` → `videoRef.current.load()`
   - Waits 100ms for load to register
   - Seeks to first frame: `videoRef.current.currentTime = 0`
   - Attempts to play: `await videoRef.current.play()`
   - If play fails, uses fallback: `play().then(pause()).then(play())` to unlock Chrome autoplay
4. After unlock, video loops continuously (has `loop` attribute)
5. Video continues looping throughout entire session - provides brand immersion
6. **iOS-safe playback:** AudioEngine uses `playVideoWithRetry()` utility for robust mobile playback:
   - Waits for video `readyState >= 2` (HAVE_CURRENT_DATA)
   - Handles `ended` state by resetting `currentTime` to 0
   - Implements exponential backoff with 3 retry attempts
   - Listens for `loadeddata`/`canplay` events with timeout fallback
   - Prevents session breakage if video fails to play

### 36. docs/brain/mr-mentor-sessions.md (f2b7ab2dc155d2357594b47f2a3a65b057f762766ec8dbf9983ebc72fa37ef8e)
- bm25: -12.6159 | relevance: 1.0000

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
