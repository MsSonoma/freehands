# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Where is the Mr. Mentor calendar overlay wired, how is learner selection handled, and what triggers schedule/planned loads? Anchor: CalendarOverlay.jsx, CounselorClient.jsx, selectedLearnerId default 'none'.

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

### 1. docs/brain/MentorInterceptor_Architecture.md (b9af78a6a85babc29ee74ec9cf6073767b7a2e84a19456e1f96ab9a407cbd74d)
- bm25: -25.6143 | entity_overlap_w: 2.10 | adjusted: -26.1393 | relevance: 1.0000

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

{/* Overlays - always rendered but hidden when not active */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: '#fff',
            zIndex: 5,
            overflow: 'hidden',
            display: activeScreen !== 'mentor' ? 'block' : 'none'
          }}>
            <div style={{ display: activeScreen === 'calendar' ? 'block' : 'none', height: '100%' }}>
              <CalendarOverlay 
                learnerId={selectedLearnerId}
                learnerGrade={learners.find(l => l.id === selectedLearnerId)?.grade}
                tier={tier}
                canPlan={canPlan}
              />
            </div>
            <div style={{ display: activeScreen === 'lessons' ? 'block' : 'none', height: '100%' }}>
              <LessonsOverlay 
                learnerId={selectedLearnerId}
              />
            </div>
            <div style={{ display: activeScreen === 'maker' ? 'block' : 'none', height: '100%' }}>
              <LessonMakerOverlay tier={tier} />
            </div>
          </div>

### 4. docs/brain/calendar-lesson-planning.md (508134b31ceac5379e6edf01fa6e367c144e9aac1f98d2a85cca866a2cb62f68)
- bm25: -22.1947 | relevance: 1.0000

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

### 5. src/app/facilitator/generator/counselor/CounselorClient.jsx (b6a09a7b5de02d74f3286c104c42d33d85ba76ca99054de9f494f42a7b144719)
- bm25: -22.0298 | relevance: 1.0000

// Ensure the calendar overlay is mounted to receive the event.
            setActiveScreen('calendar')

if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('mr-mentor:open-lesson-planner', {
                detail: {
                  learnerId: action.learnerId || selectedLearnerId,
                  startDate: action.startDate,
                  durationMonths: action.durationMonths,
                  autoGenerate: true
                }
              }))
            }

### 6. docs/brain/mr-mentor-conversation-flows.md (ec792e77787419d1b45a207c4f316b72a0b239666251a1dadd891ad81666a1ed)
- bm25: -21.8592 | relevance: 1.0000

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

### 7. docs/brain/mr-mentor-memory.md (cf9c484090fffba0ab1bf54c85953e0c43ba3831fa9fcbba4a42bd4607e87e54)
- bm25: -21.1675 | relevance: 1.0000

## Function Calling Tools

**`get_conversation_memory` tool** (available to Mr. Mentor):
- Loads summary for current facilitator+learner context
- Returns summary + recent turns
- Used automatically on first message of new session

**`search_conversation_history` tool** (available to Mr. Mentor):
- Searches past conversations with keywords
- Parameters: `keywords` (string), `include_current_learner_only` (boolean)
- Returns ranked results from current + archived memories
- Example: User asks "What did we discuss about Emma last week?" → Mr. Mentor calls `search_conversation_history("Emma")`

## Client Integration

`src/app/counselor/CounselorClient.jsx`:
- After each assistant response, calls `POST /api/conversation-memory` with conversation history
- Debounced (1 second) to avoid excessive API calls during rapid exchanges
- On learner switch, loads new memory via `GET /api/conversation-memory?learner_id={id}`
- Search UI (planned) will call `GET /api/conversation-memory?search={keywords}`

## Related Brain Files

- **[mr-mentor-sessions.md](mr-mentor-sessions.md)** - Memory system integrates with session management
- **[mr-mentor-conversation-flows.md](mr-mentor-conversation-flows.md)** - Function calling tools retrieve memory context

## Key Files

- `src/app/api/conversation-memory/route.js` - GET/POST endpoints, summarization logic, archival
- `src/app/counselor/CounselorClient.jsx` - Client-side memory updates, loading
- `src/app/api/counselor/route.js` - Function calling tools, automatic memory loading

## What NOT To Do

**DON'T regenerate summaries from scratch** - Use incremental updates. Regenerating loses nuance and wastes tokens. Only use `force_regenerate: true` for debugging.

### 8. docs/brain/mr-mentor-conversation-flows.md (bb04765302248e45513f25a1ec923d2f1e43ca671594a8c000ee0ab9d9d67fac)
- bm25: -20.3998 | relevance: 1.0000

### Visual Design
- Buttons use emoji icons for quick recognition
- Active button has blue border and light blue background
- Inactive buttons have gray border and white background
- All overlays use consistent styling with gradient headers
- Fully responsive and scrollable

### File Structure
```
src/app/facilitator/tools/counselor/
├── CounselorClient.jsx (main component - updated)
├── ClipboardOverlay.jsx (existing)
└── overlays/
    ├── CalendarOverlay.jsx
    ├── LessonsOverlay.jsx
    ├── GeneratedLessonsOverlay.jsx
    └── LessonMakerOverlay.jsx
```

### Usage
1. **Viewing Different Screens**: Click emoji buttons to switch views
2. **Learner Selection**: Available in most overlays; syncs with main dropdown
3. **Returning to Video**: Click 👨‍🏫 button to return to Mr. Mentor video

### Props Flow
- `learners` array passed from parent to overlays
- `selectedLearnerId` synced across all components
- `tier` passed to LessonMaker for quota checks
- All overlays handle their own data fetching

### Responsive Behavior
- Overlays fill entire video panel area
- Scrollable content areas for long lists
- Compact headers to maximize content space
- Works in both portrait and landscape modes

---

## Related Brain Files

- **[mr-mentor-session-persistence.md](mr-mentor-session-persistence.md)** - Session ownership, device takeover, conversation persistence
- **[MentorInterceptor_Architecture.md](MentorInterceptor_Architecture.md)** - Mr. Mentor counselor system architecture

---

## Changelog

### 9. src/app/facilitator/generator/counselor/CounselorClient.jsx (6dac98246e496604b1cc95f27e46171caf4decca9307c5ba9468e825ca71858d)
- bm25: -20.2711 | relevance: 1.0000

// Load existing draft summary on mount and when learner changes
  useEffect(() => {
    if (!tierChecked || !accessToken) return
    
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (!supabase) return
        
        const learnerId = selectedLearnerId !== 'none' ? selectedLearnerId : null
        
        const response = await fetch(`/api/conversation-drafts?learner_id=${learnerId || ''}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        })

if (response.ok && !cancelled) {
          const data = await response.json()
          if (data.draft?.draft_summary) {
            setDraftSummary(data.draft.draft_summary)
          }
        }
      } catch (err) {
        // Silent error handling
      }
    })()
    
    return () => { cancelled = true }
  }, [accessToken, tierChecked, selectedLearnerId])

// Preload overlay data in background after page is ready
  useEffect(() => {
    if (!tierChecked || !accessToken) return
    
    // Delay preload to let visible content load first
    const preloadTimer = setTimeout(() => {
      // Trigger loads by dispatching events to overlays
      window.dispatchEvent(new CustomEvent('preload-overlays', { 
        detail: { learnerId: selectedLearnerId } 
      }))
    }, 1000) // 1 second delay after page load
    
    return () => clearTimeout(preloadTimer)
  }, [accessToken, tierChecked, selectedLearnerId])

### 10. src/app/facilitator/generator/counselor/CounselorClient.jsx (949ae360672d53d0bacc726c8909803998a539a7eb789b9c49286c8820ddf35f)
- bm25: -19.2953 | entity_overlap_w: 1.00 | adjusted: -19.5453 | relevance: 1.0000

try {
      // Try interceptor first
      const selectedLearner = learners.find(l => l.id === selectedLearnerId)
      const learnerName = selectedLearner?.name
      const learnerGrade = selectedLearner?.grade
      const allLessons = await loadAllLessons()
      
      setLoadingThought(getLoadingThought(
        interceptorRef.current.state.flow,
        interceptorRef.current.state.awaitingInput,
        null
      ))
      
      const interceptResult = await interceptorRef.current.process(message, {
        allLessons,
        selectedLearnerId,
        learnerName,
        learnerGrade,
        conversationHistory
      })
      
      console.log('[CounselorClient] Interceptor result:', JSON.stringify({
        handled: interceptResult.handled,
        hasResponse: !!interceptResult.response,
        hasAction: !!interceptResult.action,
        response: interceptResult.response?.substring(0, 100),
        fullResponse: interceptResult.response
      }, null, 2))
      
      if (interceptResult.handled) {
        // Update loading thought based on what we're doing
        if (interceptResult.action) {
          setLoadingThought(getLoadingThought(
            interceptorRef.current.state.flow,
            interceptorRef.current.state.awaitingInput,
            interceptResult.action
          ))
        }
        
        // Add user message to conversation
        const updatedHistory = [
          ...conversationHistory,
          { role: 'user', content: message }
        ]
        
        // Handle action if present
        if (interceptResult.action) {
          const action = interceptResult.action
          
          if (action.type === 'schedule') {
            setLoadingThought("Adding this lesson to the calendar...")
            // Schedule the les

### 11. src/app/facilitator/generator/counselor/CounselorClient.jsx (3bb58bafaac30035dca9d2fb148e1100ccc0828d88578cba6b5681ff0a843efc)
- bm25: -19.4407 | relevance: 1.0000

// Load goals notes when selection changes
  useEffect(() => {
    if (!tierChecked || !accessToken) return
    
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (selectedLearnerId && selectedLearnerId !== 'none') {
          params.append('learner_id', selectedLearnerId)
        }
        
        const response = await fetch(`/api/goals-notes?${params.toString()}`, {
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        })
        if (response.ok && !cancelled) {
          const data = await response.json()
          setGoalsNotes(data.goals_notes || '')
        }
      } catch (err) {
        // Silent error handling
        if (!cancelled) setGoalsNotes('')
      }
    })()
    return () => { cancelled = true }
  }, [accessToken, tierChecked, selectedLearnerId])

### 12. docs/brain/lesson-notes.md (ba1927d5f15444bd06ae20de79a25c5719c23ee58aaed5fda05b53a8bd35dbd8)
- bm25: -19.1790 | relevance: 1.0000

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

### 13. docs/brain/calendar-lesson-planning.md (edc4501d8cf5402f28f2f259c81317facde5d8c4d278692219fb856850a029d8)
- bm25: -18.4355 | relevance: 1.0000

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

// Load learner transcript when selection changes
  useEffect(() => {
    if (selectedLearnerId === 'none') {
      setLearnerTranscript('')
      setGoalsNotes('')
      return
    }
    
    let cancelled = false
    ;(async () => {
      try {
        const supabase = getSupabaseClient()
        if (supabase) {
          const transcript = await fetchLearnerTranscript(selectedLearnerId, supabase)
          if (!cancelled) {
            setLearnerTranscript(transcript)
          }
        }
      } catch (err) {
        // Silent error handling
        if (!cancelled) setLearnerTranscript('')
      }
    })()
    return () => { cancelled = true }
  }, [selectedLearnerId])

### 15. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (0201c22625480e9f3a54b971d5545320afe3a0cd4ff0f4c9a8a6d2ba474ba51d)
- bm25: -17.0503 | entity_overlap_w: 1.00 | adjusted: -17.3003 | relevance: 1.0000

// Compact calendar view for Mr. Mentor overlay
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import LessonGeneratorOverlay from '@/app/facilitator/calendar/LessonGeneratorOverlay'
import LessonPlanner from '@/app/facilitator/calendar/LessonPlanner'
import LessonEditor from '@/components/LessonEditor'
import LessonNotesModal from '@/app/facilitator/calendar/LessonNotesModal'
import VisualAidsManagerModal from '@/app/facilitator/calendar/VisualAidsManagerModal'
import PortfolioScansModal from '@/app/facilitator/calendar/PortfolioScansModal'
import TypedRemoveConfirmModal from '@/app/facilitator/calendar/TypedRemoveConfirmModal'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'

export default function CalendarOverlay({ learnerId, learnerGrade, tier, canPlan }) {
  const OVERLAY_Z_INDEX = 2147483647

const getLocalTodayStr = () => {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

const toLocalDateStr = (dateLike) => {
    const dt = new Date(dateLike)
    if (Number.isNaN(dt.getTime())) return null
    const year = dt.getFullYear()
    const month = String(dt.getMonth() + 1).padStart(2, '0')
    const day = String(dt.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

### 16. docs/brain/mr-mentor-conversation-flows.md (32af0ce972bc228b72cbaab4e488efca4dd9a1c0df0c93e692c10279247cf66f)
- bm25: -17.1764 | relevance: 1.0000

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

### 17. docs/brain/goals-clipboard.md (6c7fe83e90a7942cbfd98ef8a90715d22a772bbd4c807f6dc85c8f37d1b568ba)
- bm25: -17.1414 | relevance: 1.0000

**`/api/counselor` integration:**
- Request body now includes `goals_notes` field
- System prompt includes: `"PERSISTENT GOALS & PRIORITIES:\n{goals_notes}"`
- Mr. Mentor sees goals in every conversation turn

## Key Files

- `src/app/counselor/CounselorClient.jsx` - Goals button, state management, auto-load on learner switch
- `src/components/GoalsClipboardOverlay.jsx` - Overlay UI component
- `src/app/api/goals-notes/route.js` - Load/save API endpoint
- `src/app/api/counselor/route.js` - Receives goals_notes, includes in system prompt

## What NOT To Do

**DON'T exceed 600 character limit** - UI enforces this but API should validate too. Longer text risks token bloat and poor UX.

**DON'T fail silently on load errors** - If goals fail to load, show user-friendly message. Missing goals can confuse facilitators who expect Mr. Mentor to remember context.

**DON'T forget to clear goals on learner switch** - When learner changes, immediately load new goals. Stale goals = wrong context.

**DON'T make goals optional in API calls** - Always send `goals_notes` field (empty string if none) so Mr. Mentor knows explicitly whether goals exist or not.

### 18. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (a69efca9880db84d16bcf2416cead5e30a8ee222c1531e8f6d6ad02cf39c54d3)
- bm25: -17.0642 | relevance: 1.0000

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

### 19. src/app/facilitator/generator/counselor/MentorInterceptor.js (e29c07b0572d98381e8c5858ff7c03bc8824870010a7316b2f83d1e1918b9253)
- bm25: -16.9679 | relevance: 1.0000

return {
          handled: true,
          response: `What date would you like to schedule ${this.state.selectedLesson.title} for ${learnerName || 'this learner'}?`
        }
      }

if (wantsAssign) {
        if (!selectedLearnerId) {
          return {
            handled: true,
            response: "Please select a learner from the dropdown first, then I can assign the lesson."
          }
        }

this.state.context.lastAssignedLessonKey = this.state.selectedLesson.lessonKey
        this.state.context.lastAssignedLessonTitle = this.state.selectedLesson.title
        this.state.awaitingInput = 'assign_post_confirm'

return {
          handled: true,
          action: {
            type: 'assign',
            lessonKey: this.state.selectedLesson.lessonKey
          },
          response: `I've assigned "${this.state.selectedLesson.title}" to ${learnerName || 'this learner'}. Is that correct?`
        }
      }

if (confirmation === 'no') {
        this.reset()
        return {
          handled: true,
          response: "No problem. The lesson is ready in your lessons tab whenever you need it. How else can I help you?"
        }
      }

### 20. docs/brain/calendar-lesson-planning.md (5099a67314b21b85fa6a8156e8fd0f3b3e8f5c4ec53943e5cc4e0d17890d9adb)
- bm25: -16.7980 | relevance: 1.0000

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

### 21. src/app/facilitator/generator/counselor/CounselorClient.jsx (b6e6ebc1dbed05c56ca851c80bcd9e000659d12c23c8c859a044e2daec8d0991)
- bm25: -15.7328 | relevance: 1.0000

{/* Input footer */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 16px',
        background: '#fff',
        borderTop: '1px solid #e5e7eb',
        zIndex: 10
      }}>
        <div style={{ 
          maxWidth: isMobileLandscape ? '100%' : 800, 
          margin: 0,
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          {/* Learner selection dropdown and screen buttons */}
          {learners.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4
              }}>
                <select
                  id="learner-select"
                  value={selectedLearnerId}
                  onChange={(e) => setSelectedLearnerId(e.target.value)}
                  disabled={loading || isSpeaking}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '8px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    background: '#fff',
                    cursor: (loading || isSpeaking) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="none">No Learner Selected (general discussion)</option>
                  {learners.map(learner => (
                    <option key={learner.id} value={learner.id}>
                      {learner.name} {learner.grade ? `(Grade ${learner.grade})` : ''}
                    </option>
                  ))}
                </select>

### 22. docs/brain/mr-mentor-sessions.md (f2b7ab2dc155d2357594b47f2a3a65b057f762766ec8dbf9983ebc72fa37ef8e)
- bm25: -15.5683 | relevance: 1.0000

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

### 23. docs/brain/mr-mentor-memory.md (7eae78cf82c5808edb7fd0b79c3915efbb0ec9ecc57421958a7789fe8bb44faf)
- bm25: -15.5347 | relevance: 1.0000

# Mr. Mentor Conversation Memory

## How It Works

Mr. Mentor maintains persistent "clipboard knowledge" of facilitator and learner conversations. Every conversation exchange is automatically summarized using GPT-4o-mini, creating incremental context that persists across sessions. Facilitators can search past conversations and Mr. Mentor automatically loads previous memory on first message.

**Flow:**
1. Facilitator sends message to Mr. Mentor
2. After assistant response, client calls `POST /api/conversation-memory` with full conversation turns
3. Backend checks if existing summary exists for facilitator+learner combination
4. If exists: Creates **incremental update** (adds new context to existing summary)
5. If new: Generates fresh summary from all turns
6. Summary saved to `conversation_updates` table (200-400 words, last 10 turns)
7. If conversation exceeds 50 turns: Auto-archive to `conversation_history_archive` table
8. Next session: First message automatically loads previous summary into Mr. Mentor's context
9. Facilitator can search conversations with keywords using fuzzy full-text search

**Purpose**: Provides continuity across days/weeks without re-explaining context. Mr. Mentor remembers previous discussions, learner challenges, and facilitator preferences indefinitely.

## Database Schema

### 24. docs/brain/mr-mentor-session-persistence.md (c2eb61d278bd75ea3bdaff9b65f83fddd692989bdfe687b11402765ab944edc5)
- bm25: -15.2743 | relevance: 1.0000

**When to Delete `conversation_drafts` Row:**
1. User clicks "Delete" → Delete immediately
2. User clicks "Save" → Delete after successful save to `conversation_updates`

**Atomic Delete (New Conversation):**
```javascript
// Delete BOTH tables atomically
await Promise.all([
  fetch(`/api/mentor-session?sessionId=${sessionId}`, { method: 'DELETE' }),
  fetch(`/api/conversation-drafts?learner_id=${learnerId}`, { method: 'DELETE' })
])
```

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

### 27. docs/brain/goals-clipboard.md (44567a922c7f4e2752c78dcf5e5ce1b6adee66a4798a530df7716d58eb8b95b2)
- bm25: -14.8480 | relevance: 1.0000

# Goals Clipboard

## How It Works

Facilitators can set persistent goals and priorities for themselves or specific learners. These goals are automatically included in every Mr. Mentor conversation to provide context and guide discussions.

**Flow:**
1. Click 📋 button in top left of Mr. Mentor video (highlights yellow when goals are set)
2. Enter up to 600 characters of goals/priorities in overlay
3. Goals save automatically per learner (when learner selected) or for facilitator (when no learner)
4. On learner switch, goals auto-load from database
5. Every Mr. Mentor API call receives goals in system prompt under "PERSISTENT GOALS & PRIORITIES"
6. Mr. Mentor can reference goals, suggest using the feature, and guide based on stated objectives

**Purpose**: Provides long-term context that persists across all conversations, enabling Mr. Mentor to give data-informed, goal-aligned guidance without re-explaining objectives every session.

## Database Schema

**Learners table:**
```sql
ALTER TABLE learners 
ADD COLUMN IF NOT EXISTS goals_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_learners_goals_notes 
ON learners(id) WHERE goals_notes IS NOT NULL;
```

**Profiles table (facilitator goals when no learner selected):**
```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS goals_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_goals_notes 
ON profiles(id) WHERE goals_notes IS NOT NULL;
```

## API Integration

**`/api/goals-notes` endpoints:**

**GET**: Load goals for current context
- Query param: `learner_id` (optional)
- If `learner_id` provided: returns `learners.goals_notes`
- If no `learner_id`: returns `profiles.goals_notes` for facilitator
- Returns: `{ success: true, goals_notes: "..." }`

### 28. docs/brain/MentorInterceptor_Architecture.md (7cfd131ea36bbee64c89e221bffc0ef04e7197b8816e1613bcb1dc1d431d339f)
- bm25: -14.2239 | entity_overlap_w: 2.10 | adjusted: -14.7489 | relevance: 1.0000

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

### 29. src/app/facilitator/generator/counselor/CounselorClient.jsx (edd66a96cc6adc70cd1a3eda1a4e179bb1df29fe026d97215ecd7272c65998b1)
- bm25: -14.6728 | relevance: 1.0000

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

// Handle clipboard save (commit to permanent memory)
  const handleClipboardSave = useCallback(async (editedSummary) => {
    try {
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      if (!token) {
        alert('Unable to save: not authenticated')
        return
      }

const learnerId = selectedLearnerId !== 'none' ? selectedLearnerId : null

// Save to conversation_updates (permanent memory)
      await fetch('/api/conversation-memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          learner_id: learnerId,
          conversation_turns: conversationHistory,
          summary_override: editedSummary // Use the user-edited summary
        })
      })

// Delete the draft
      await fetch(`/api/conversation-drafts?learner_id=${learnerId || ''}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

### 31. src/app/facilitator/generator/counselor/overlays/CalendarOverlay.jsx (292d9a04fb67c37442bd55e66fc49a182fa821c01e788a81fa2b2e1039d3bdaa)
- bm25: -14.5665 | relevance: 1.0000

// Listen for preload event to trigger initial load
  useEffect(() => {
    const handlePreload = () => {
      if (learnerId && learnerId !== 'none') {
        loadCalendarData({ force: true })
      }
    }
    
    const handleLessonScheduled = () => {
      // Clear cache and reload
      setScheduledLessons({})
      scheduleLoadedForLearnerRef.current = null
      scheduleLoadedAtRef.current = 0
      loadSchedule({ force: true })
    }
    
    window.addEventListener('preload-overlays', handlePreload)
    window.addEventListener('mr-mentor:lesson-scheduled', handleLessonScheduled)

### 32. docs/brain/calendar-lesson-planning.md (1c551999eb292e7d45b7c6306ea7223b5fc642288558019cf5b0b429daccc9cf)
- bm25: -14.3184 | relevance: 1.0000

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

### 33. src/app/facilitator/generator/counselor/MentorInterceptor.js (ad52f792b6b992c82bed565cb13b30bde0789aa2ababb37aa2fede07d9b500a7)
- bm25: -14.2031 | relevance: 1.0000

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

### 34. src/app/facilitator/generator/counselor/CounselorClient.jsx (1a2f52465221ba7c7ee2fec25ad3720e26caa25f0710e9c88a28e59f59a4a3b5)
- bm25: -14.1977 | relevance: 1.0000

{/* Clipboard Overlay */}
      <ClipboardOverlay
        summary={draftSummary}
        onSave={handleClipboardSave}
        onDelete={handleClipboardDelete}
        onExport={exportConversation}
        onClose={() => {
          setShowClipboard(false)
        }}
        show={showClipboard}
        forced={clipboardForced}
      />

{/* Goals Clipboard Overlay */}
      <GoalsClipboardOverlay
        visible={showGoalsClipboard}
        onClose={() => setShowGoalsClipboard(false)}
        learnerId={selectedLearnerId}
        learnerName={learners.find(l => l.id === selectedLearnerId)?.name}
        onSave={(text) => setGoalsNotes(text)}
      />

### 35. src/app/facilitator/generator/counselor/CounselorClient.jsx (2fb943e8d3c363bb39244245f275dfe6275558d1d7a2f57cd8c46511d2d7e236)
- bm25: -14.1642 | relevance: 1.0000

if (initialToolResults.length > 0) {
        setLoadingThought("Processing tool results...")
        for (const toolResult of initialToolResults) {
          if (toolResult.lesson && toolResult.lessonFile && toolResult.userId) {
            setLoadingThought("Validating generated lesson...")
            const summary = await handleLessonGeneration(toolResult, token)
            if (summary) {
              validationSummaries.push(summary)
            }
          }
          
          // Dispatch events for schedule_lesson success
          if (toolResult.success && toolResult.scheduled) {
            setLoadingThought("Updating calendar...")
            try {
              window.dispatchEvent(new CustomEvent('mr-mentor:lesson-scheduled', {
                detail: {
                  learnerName: toolResult.learnerName,
                  scheduledDate: toolResult.scheduledDate,
                  lessonTitle: toolResult.lessonTitle
                }
              }))
            } catch (err) {
              // Silent error handling
            }
          }
        }
      }

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
