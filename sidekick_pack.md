# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
change view lessons to Ms. Sonoma on /learn page, move Mr. Slate button from learn/lessons page to /learn page below Awards, change emoji from rock to robot
```

Filter terms used:
```text
change
view
lessons
sonoma
learn
page
move
slate
button
below
awards
emoji
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-11 10:29` — Calendar past scheduled lessons buttons Notes Visual Aids Add Images Remove - replace Visual Aids with Assigns dropdown 
- `2026-03-11 10:41` — Lesson Planner Generate button opens lesson generator overlay says Generate on [date] change date calendar picker planne
- `2026-03-11 11:30` — Calendar scheduled lessons Edit Lesson button reschedule past lessons Notes Assigns Add Images Remove rescheduling calen

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

Pack chunk count (approximate): 24. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

change view lessons sonoma learn page move slate button below awards emoji

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/learn/awards/page.js (4d8cce309e0f536106072dd471d5d29bbc535b069533182488b0980b7295cb15)
- bm25: -15.4457 | relevance: 0.9392

{subjectsToRender.map(subject => {
            const lessons = groupedMedals[subject]
            if (!lessons || lessons.length === 0) return null

const displaySubject = customKeyToName.get(subject)
              || subject.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

### 2. src/app/learn/awards/page.js (0499b864d98c5cc526cdd870d00a12f230da31563456ead2b5af1a35d52a5b28)
- bm25: -14.6420 | relevance: 0.9361

const customKeyToName = new Map(customDisplayOrder.map((s) => [s.key, s.name]))

### 3. src/app/learn/awards/page.js (c65c1998a9dabde1a8764e963f6b0d48b40ab7e3e508d1f3983ad3e80c0473ed)
- bm25: -13.9214 | relevance: 0.9330

useEffect(() => {
    if (!learnerId) {
      setMedals({})
      setMedalsLoading(false)
      return
    }
    (async () => {
      try {
        const data = await getMedalsForLearner(learnerId)
        setMedals(data || {})
      } catch {
        setMedals({})
      }
      setMedalsLoading(false)
    })()
  }, [learnerId])

### 4. src/app/learn/awards/page.js (9b7b115c5d14e4d1b4f7ce9973b8e273d81cccc35f9535164fb84cc016b3f20a)
- bm25: -13.1307 | relevance: 0.9292

const lessonsMap = {}
      for (const subject of subjectsToFetch) {
        try {
          const subjectKey = normalizeSubjectKey(subject)
          const headers = subject === 'generated' && token 
            ? { 'Authorization': `Bearer ${token}` }
            : {}
          const res = await fetch(`/api/lessons/${encodeURIComponent(subject)}`, { 
            cache: 'no-store',
            headers
          })
          const list = res.ok ? await res.json() : []
          lessonsMap[subjectKey] = Array.isArray(list) ? list : []
        } catch {
          lessonsMap[normalizeSubjectKey(subject)] = []
        }
      }
      if (!cancelled) {
        setAllLessons(lessonsMap)
        setLessonsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [customSubjectNames.join('|')])

### 5. docs/brain/ms-sonoma-teaching-system.md (1f079cae33ff43ac4f14837a3de47b84b5b01b2e253899f9ec065dd2e8c8247d)
- bm25: -13.0482 | relevance: 0.9288

**Transition**:
- "Great. Let's move on to comprehension."

### Pre-Send Checklist

Before shipping to Ms. Sonoma, verify:
- Payload contains only speakable text
- Child's name and lesson title are literal (no placeholders)
- Exactly one phase represented
- If Opening: final sentence is silly question
- If Teaching/Repeat: ends with VERBATIM wrap line
- If Transition: uses VERBATIM move-on line
- If Comprehension: exactly one question, no definitions
- No syntax or labels present: no [], {}, <>, no section labels, no [COPILOT]/[SONOMA]/[VERBATIM]/[SAMPLE]
- Must pass placeholder scan: no {PLACEHOLDER}, [PLACEHOLDER], <PLACEHOLDER>, or stray ALLCAPS tokens

### Turn Map

**After Opening**: Teaching Definitions (developer-triggered, no teaching during opening)

**After Teaching Definitions wrap**:
- Repeat Vocab button → Definitions Repeat
- Next button → Teaching Examples
- Ask button → freeform questions, respond briefly, return to gate

**After Teaching Examples wrap**:
- Repeat Vocab button → Examples Repeat
- Next button → Transition, then Comprehension Ask
- Ask button → freeform questions, respond briefly, return to gate

**Comprehension loop**: Ask → child reply → FeedbackCorrect or FeedbackHint → Ask again (or Closing when goal met)

**Closing**: End of session

### Opening Actions UI (V2)

### 6. src/app/learn/awards/page.js (ebc1895801227375408072bd153c7c76812fe8756cfe668246876a991b78216e)
- bm25: -12.6739 | relevance: 0.9269

if (!bucket || bucket === 'generated') {
        // If the lesson exists in any known subject folder, prefer that.
        const knownSubjects = Object.keys(allLessons || {})
        const foundInKnown = knownSubjects.find((s) => {
          const list = allLessons[s] || []
          return list.some((l) => ensureJsonFile(l?.file) === file)
        })
        if (foundInKnown) bucket = foundInKnown
      }

### 7. src/app/learn/lessons/page.js (5b763ff894b24c13b531c4442061b189657aff4bead8adde661c3b34d6eeee7e)
- bm25: -12.2097 | relevance: 0.9243

;(async () => {
      try {
        // Just check for active session without PIN requirement
        // The lessons page should be freely accessible
        const active = await getActiveLessonSession(learnerId)
        if (cancelled) return
        // No PIN gate here - let learners view lessons freely
        if (!cancelled) setSessionGateReady(true)
      } catch (err) {
        if (!cancelled) setSessionGateReady(true)
      }
    })()

### 8. src/app/facilitator/notifications/page.js (5ab254686e5c76680524212018ffefabefe9426758375ef028ff488370e51053)
- bm25: -12.1946 | relevance: 0.9242

<div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => setPrefsOpen(false)}
                disabled={prefsSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  cursor: prefsSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  opacity: prefsSaving ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={savePrefs}
                disabled={prefsSaving}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid #111827',
                  background: '#111827',
                  color: '#fff',
                  cursor: prefsSaving ? 'not-allowed' : 'pointer',
                  fontWeight: 800,
                  opacity: prefsSaving ? 0.7 : 1
                }}
              >
                {prefsSaving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </SettingsOverlay>

<GatedOverlay
        show={!isAuthenticated}
        gateType={gateType}
        feature="Notifications"
        emoji="🔔"
        description="Sign in to view and manage facilitator notifications."
        benefits={[
          'See reminders about planning and scheduling',
          'Track lesson expirations',
          'Get subscription and limit alerts'
        ]}
      />
    </>
  );
}

### 9. docs/brain/story-feature.md (7c541082fb751d8b6d7c2be9019d9fcda07911dd69b371791d357908ef1d85e5)
- bm25: -12.0801 | relevance: 0.9235

### Story Ending
1. Child clicks "Story" button
2. Ms. Sonoma: **Briefly recounts** (first sentence only): "Together they spotted a sparkly treasure chest below."
3. Ms. Sonoma: "How would you like the story to end?"
4. Child describes ending
5. Ms. Sonoma: *Concludes story* "...and they lived happily ever after. The end."

## Key Files

- `page.js` - Story state variables
- `useDiscussionHandlers.js` - Story handlers (handleStoryStart, handleStoryYourTurn)
- `/api/sonoma/route.js` - Story generation API

## What NOT To Do

- Never reset storyTranscript between phases (preserve continuity)
- Never reset storyUsedThisGate between phases (one story per gate)
- Never skip setup phase on first story creation
- Never allow freeform story generation without setup (use template-based approach)
- Never forget to clear story data after "The end." in Test phase

### 10. docs/brain/story-feature.md (47b7112fa17bfb5f0221b18351895de13c106fd2c67fbfea01dda4cb32a9d469)
- bm25: -12.0787 | relevance: 0.9235

### Story Continuation
1. Child clicks "Story" button
2. Ms. Sonoma: **Briefly recounts** (first sentence only): "The dragon wanted to help the princess."
3. Ms. Sonoma: "What would you like to happen next?"
4. Ms. Sonoma: **Suggests possibilities** (AI-generated): "You could say: the dragon flies away, or they find a map, or a wizard appears."
5. Child: "The dragon flies the princess to find treasure"
6. Ms. Sonoma: *Continues story* "The dragon spread its wings and flew the princess high above the clouds. Together they spotted a sparkly treasure chest below. To be continued."

### 11. src/app/facilitator/account/plan/page.js (70c2cb1bd1337b3a8b3034d268419b9f5371e7e9b583fc6bce07326e4be61dac)
- bm25: -12.0037 | relevance: 0.9231

<div style={{ marginTop: 40 }}>
        <button
          type="button"
          onClick={() => openPortal(setPortalLoading)}
          aria-label="Manage your subscription"
          disabled={Boolean(loadingTier) || portalLoading}
          aria-busy={portalLoading}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: 560,
            margin: '0 auto',
            padding: '10px 14px',
            borderRadius: 10,
            border: '1px solid #ccc',
            background: '#f7f7f7',
            color: '#111',
            fontWeight: 600,
            cursor: Boolean(loadingTier) || portalLoading ? 'not-allowed' : 'pointer',
            opacity: Boolean(loadingTier) || portalLoading ? 0.7 : 1,
          }}
        >
          {portalLoading ? 'Opening…' : 'Manage subscription'}
        </button>
      </div>

<style>{`
        @media (max-width: 1100px) { [aria-label="Plan comparison"] { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 640px) { [aria-label="Plan comparison"] { grid-template-columns: 1fr; } }
      `}</style>
    </main>
    
    <GatedOverlay
      show={!isAuthenticated}
      gateType={gateType}
      feature="Plans & Billing"
      emoji="💳"
      description="Sign in to view and manage your subscription plan."
      benefits={[
        'Compare Free, Trial, Standard, and Pro',
        'Manage your subscription and billing details',
        'View your current plan and usage',
        'Cancel or upgrade anytime'
      ]}
    />
    </>
  );
}

### 12. src/app/session/slate/page.jsx (9aa0441e837627aa176ce619418a83df669b8d45ec48db0cf3c00ae3298c11e2)
- bm25: -11.7286 | relevance: 0.9214

<div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={startDrill} style={ghostBtn}>DRILL AGAIN</button>
            <button onClick={backToList} style={ghostBtn}>LESSON LIST</button>
            <button onClick={exitToLessons} style={primaryBtn}>← BACK TO LESSONS</button>
          </div>
        </div>
      </div>
    )
  }

### 13. src/app/learn/awards/page.js (9da90adda213b5392e247e96be4327d5e0f685988bc96b8e24be7300a9ad09d6)
- bm25: -11.6430 | relevance: 0.9209

'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMedalsForLearner, emojiForTier } from '@/app/lib/medalsClient'
import { CORE_SUBJECTS, sortSubjectsForDropdown } from '@/app/lib/subjects'

export default function AwardsPage() {
  const router = useRouter()
  const [learnerName, setLearnerName] = useState(null)
  const [learnerId, setLearnerId] = useState(null)
  const [medals, setMedals] = useState({})
  const [allLessons, setAllLessons] = useState({})
  const [medalsLoading, setMedalsLoading] = useState(true)
  const [lessonsLoading, setLessonsLoading] = useState(true)
  const [customSubjects, setCustomSubjects] = useState([])
  const [customSubjectsLoading, setCustomSubjectsLoading] = useState(true)

const normalizeSubjectKey = (value) => {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
  }

const customSubjectNames = (customSubjects || [])
    .map((s) => s?.name)
    .filter(Boolean)

// Fetch subjects includes generated so we can infer subject buckets for facilitator-created lessons.
  // Include custom subjects so Awards can resolve titles/blurbs where available.
  const subjectsToFetch = [
    ...CORE_SUBJECTS,
    ...customSubjectNames,
    'generated',
  ]

useEffect(() => {
    try {
      const id = localStorage.getItem('learner_id')
      const name = localStorage.getItem('learner_name')
      if (name) setLearnerName(name)
      if (id) setLearnerId(id)
    } catch {}
  }, [])

### 14. docs/brain/homepage.md (17a708595f5926a1352d014293d26395401f846891deebe02f2c21ebf394db5b)
- bm25: -11.5993 | relevance: 0.9206

# Homepage

**Status:** Canonical
**Created:** 2026-01-10
**Purpose:** Define what the landing page communicates and which outbound links it must include.

## How It Works

The homepage is the app landing page at `/`.

It uses a centered hero layout with:
- Ms. Sonoma hero image
- Primary CTAs: Learn, Facilitator
- Supporting links:
  - About page (AI safety/How it works)
  - External site link to learn more about Ms. Sonoma

### External Website Link

The homepage includes an external link to `https://mssonoma.com` with copy that explicitly tells users to learn about Ms. Sonoma there.

## What NOT To Do

- Do not remove the external `mssonoma.com` link without replacing it with an equivalent learn-more path.
- Do not add device- or storage-related claims to homepage copy.
- Do not add placeholder or environment-specific URLs.

## Key Files

- `src/app/page.js`
- `src/app/home-hero.module.css`

### 15. src/app/learn/awards/page.js (6cbf7bc567229771688329f236afb1c9dffbedd8fcb6f7d8cca57ce82fdb17d8)
- bm25: -11.4955 | relevance: 0.9200

const subjectOrder = CORE_SUBJECTS
  const customOrderedKeys = customDisplayOrder.map((s) => s.key)

const baseOrdered = [
    ...subjectOrder,
    ...customOrderedKeys,
  ]

const subjectsToRender = [
    ...baseOrdered.filter((s) => Array.isArray(groupedMedals[s]) && groupedMedals[s].length > 0),
    ...Object.keys(groupedMedals)
      .filter((s) => !baseOrdered.includes(s))
      .sort((a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: 'base' }))
  ]
  const hasMedals = Object.keys(groupedMedals).length > 0
  const totalMedals = Object.values(groupedMedals).reduce((sum, arr) => sum + arr.length, 0)

// Count medals by tier
  const medalCounts = { gold: 0, silver: 0, bronze: 0 }
  Object.values(groupedMedals).forEach(lessons => {
    lessons.forEach(lesson => {
      if (lesson.medalTier) medalCounts[lesson.medalTier]++
    })
  })

const card = { 
    border: '1px solid #e5e7eb', 
    borderRadius: 12, 
    padding: 14, 
    background: '#fff',
    marginBottom: 8
  }

const subjectHeading = { 
    margin: '24px 0 12px', 
    fontSize: 18, 
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: 8
  }

return (
    <main style={{ padding: 24, maxWidth: 980, margin: '0 auto', minHeight: 'calc(100dvh - 56px)' }}>
      <h1 style={{ margin: '8px 0 4px', textAlign: 'center' }}>
        🏆 Awards
      </h1>
      
      {learnerName && (
        <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 16, color: '#666' }}>
          Earned by <strong style={{ color: '#111' }}>{learnerName}</strong>
        </div>
      )}

### 16. src/app/session/slate/page.jsx (d158e94ac2ff56bef627c39345a7bd2be1b42aa42d16257281055b6f168a7e55)
- bm25: -11.4522 | relevance: 0.9197

const exitToLessons = useCallback(() => {
    clearInterval(timerInterval.current)
    clearTimeout(feedbackTimeout.current)
    router.push('/learn/lessons')
  }, [router])

const lessonTitle = lessonData?.title || ''

// ===========================================================================
  //  RENDER -- Loading
  // ===========================================================================
  if (pagePhase === 'loading') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <SlateVideo size={100} />
          </div>
          <div style={{ fontSize: 13, letterSpacing: 2, marginBottom: 20 }}>INITIALIZING DRILL SYSTEM...</div>
          <LoadingDots />
        </div>
      </div>
    )
  }

// ===========================================================================
  //  RENDER -- Error
  // ===========================================================================
  if (pagePhase === 'error') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
          <div style={{ color: C.red, fontWeight: 700, letterSpacing: 1, marginBottom: 8 }}>SYSTEM ERROR</div>
          <div style={{ color: C.muted, fontSize: 13, marginBottom: 24 }}>{errorMsg}</div>
          <button onClick={exitToLessons} style={ghostBtn}>← RETURN TO LESSONS</button>
        </div>
      </div>
    )
  }

### 17. docs/brain/facilitator-help-system.md (c249a4a4c879fc7d9f3e4681903d5145c69f2f495d6d5eddda5e805833c62e21)
- bm25: -11.3598 | relevance: 0.9191

**2026-01-10**: Added `PageHeader` dense mode.
- Purpose: allow specific pages (e.g., Calendar) to reduce header vertical footprint without changing global facilitator layouts.
- Implementation: `dense` reduces the default margins and slightly reduces title/subtitle sizing.
- Tightness: `dense` is intentionally more compact than the default header; use it only where vertical space is at a premium.

**2025-12-15**: Removed "Don't show again" functionality. Help is now fully voluntary - users click ❓ to view, click backdrop/X to close. No localStorage persistence needed. Simplified component state.

**2025-12-15**: Fixed modal overlay rendering using React Portal and inline styles instead of Tailwind classes. Modals now properly display above page content with backdrop.

**2025-12-15**: Unified both help components to use ❓ emoji. WorkflowGuide and InlineExplainer now use identical button styling for consistency. Both open centered modal overlays with backdrop on click.

**2025-12-15**: Updated InlineExplainer to use modal overlay instead of positioned tooltip. Changed button from blue circle with SVG icon to ❓ emoji. Removed placement prop (no longer needed). Modal centers on screen with backdrop, preventing layout issues and overflow problems.

**2025-12-15**: Initial implementation of help system. Added InlineExplainer, WorkflowGuide, PageHeader components. Deployed help content to calendar, learners, lessons pages. Created this brain file.

---

## Future Considerations

### 18. docs/brain/visual-aids.md (85823dd0676182ce38771044864b6e03b9018a0ce74f1747deb60769ad470de3)
- bm25: -11.2655 | relevance: 0.9185

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

### 19. src/app/facilitator/notifications/page.js (1ecb7897c0b092d3e5fdb5cb52f15534a36f4bab7d2dbc2d3bd4f1eef1b78eaf)
- bm25: -11.2606 | relevance: 0.9184

if (authLoading || loading) {
    return (
      <>
        <main style={{ padding: 7 }}><p>Loading…</p></main>
        <GatedOverlay
          show={!isAuthenticated}
          gateType={gateType}
          feature="Notifications"
          emoji="🔔"
          description="Sign in to view and manage facilitator notifications."
          benefits={[
            'See reminders about planning and scheduling',
            'Track lesson expirations',
            'Get subscription and limit alerts'
          ]}
        />
      </>
    );
  }

### 20. src/app/learn/awards/page.js (aae2328e0ee15a6065296a219b86c3ca49388cd1de1f170e826da26788d23a15)
- bm25: -11.2341 | relevance: 0.9183

return (
              <div key={subject}>
                <h2 style={subjectHeading}>
                  {displaySubject}
                  <span style={{ 
                    fontSize: 14, 
                    fontWeight: 400, 
                    color: '#6b7280',
                    background: '#f3f4f6',
                    padding: '2px 8px',
                    borderRadius: 12
                  }}>
                    {lessons.length} {lessons.length === 1 ? 'medal' : 'medals'}
                  </span>
                </h2>
                
                {lessons.map(lesson => {
                  const medal = emojiForTier(lesson.medalTier)
                  
                  return (
                    <div key={`${subject}-${lesson.file}`} style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>
                            {lesson.title}
                          </h3>
                          {lesson.blurb && (
                            <p style={{ margin: '4px 0', color: '#6b7280', fontSize: 14 }}>
                              {lesson.blurb}
                            </p>
                          )}
                          {(lesson.grade || lesson.difficulty) && (
                            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
                              {lesson.grade && `Grade ${lesson.grade}`}
                              {lesson.grade && lesson.difficulty && ' • '}
                              {lesson.difficulty && lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1)}
                            </div>

### 21. src/app/learn/awards/page.js (f45cd535ba332cbf78616690eb559625eb2e7507931a9b3848baaee84ae648ba)
- bm25: -11.1869 | relevance: 0.9179

{loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: 12, marginTop: 32 }}>
          <div style={{ 
            width: 48, 
            height: 48, 
            border: '4px solid #e5e7eb', 
            borderTop: '4px solid #111', 
            borderRadius: '50%', 
            animation: 'spin 1s linear infinite' 
          }}></div>
          <p style={{ textAlign:'center', color: '#6b7280', fontSize: 16 }}>Loading awards...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : !hasMedals ? (
        <div style={{ textAlign: 'center', marginTop: 32 }}>
          <p style={{ fontSize: 48 }}>🎯</p>
          <p style={{ color: '#6b7280', fontSize: 18 }}>No medals earned yet!</p>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>
            Complete lessons to earn bronze (70%+), silver (80%+), or gold (90%+) medals.
          </p>
        </div>
      ) : (
        <>
          <div style={{ 
            textAlign: 'center', 
            marginBottom: 24, 
            padding: 16, 
            background: '#f9fafb', 
            borderRadius: 12,
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            flexWrap: 'wrap'
          }}>
            <div>
              <div style={{ fontSize: 32 }}>🥇</div>
              <div style={{ fontWeight: 600, fontSize: 20 }}>{medalCounts.gold}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>Gold</div>
            </div>
            <div>
              <div style={{ fontSize: 32 }}>🥈</div>
              <div style={{ f

### 22. docs/brain/ingests/pack.md (aa6ec106ec68e22bb817f61c01c25af4440948ba22e71ec40a50cad850d8b6d0)
- bm25: -10.9577 | relevance: 0.9164

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

### 23. src/app/session/slate/page.jsx (dce69f4d5bbb94256045f88b11abb9dfc1799af639930316e6f68865471a1b37)
- bm25: -10.6879 | relevance: 0.9144

{/* Recent tab — completed Ms. Sonoma sessions, most recent first */}
                {listTab === 'recent' && (
                  recentList.length === 0 ? (
                    <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 32, letterSpacing: 1 }}>
                      NO COMPLETED LESSONS YET — FINISH A LESSON WITH MS. SONOMA TO SEE RESULTS HERE
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>
                        {recentList.length} COMPLETED LESSON{recentList.length !== 1 ? 'S' : ''}
                      </div>
                      {recentList.map((r, i) => <RecentRow key={r.session.id || i} session={r.session} lesson={r.lesson} />)}
                    </div>
                  )
                )}

### 24. .github/copilot-instructions.md (64fe53fc4731798a8a516dad109cc4e32343c622892bac17c6f9bdf1a9f9bbf3)
- bm25: -10.5570 | relevance: 0.9135

If pack #1 doesn't contain the entrypoint you need:
1. Re-pack with a tighter anchor (prefer an exact string, route, or filename).
2. If still missing, ingest/sync the relevant subtree, then re-pack.

When making code/doc changes “for real”:
1. Ensure head is current for touched files (pick one):
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere ingest <file-or-folder> --project freehands [--recursive]`
   - or `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere sync --project freehands` if the working tree may have drifted
2. Prefer generating and applying a change pack linked to evidence:
   - edit file(s) in working tree
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere change new --project freehands --file <relpath> --pack pack.md --out change.json --summary "..."`
   - restore the base file(s) to match DB head (clean base), then:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere apply --project freehands change.json`
3. If anything goes wrong, rollback by change id:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere rollback --project freehands --change-id <id>`
4. Run integrity checks after non-trivial work:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

Binary files:
- Change packs are text-only (plus deletions). Binaries are preserved losslessly by ingest/sync, not by diffs.

NOTE: `.github/instructions/*` are archived snapshots; do not edit them.

## DOCUMENTATION POLICY (COHERE-CANONICAL)

For this workspace, Cohere packs + Cohere change packs are the canonical record of system behavior and provenance.

### 25. sidekick_pack.md (bba8c9d0a2ad1fcfae649c359a4219ed32e5a5913249044c89d6ec0d9ecb4d56)
- bm25: -10.4925 | relevance: 0.9130

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

### 26. sidekick_pack.md (df3b0d06c6e97315f9ac315d8fe85c1be37b146340873af631c44fae1bc3250f)
- bm25: -10.4708 | relevance: 0.9128

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

### 27. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (86b60aae069b5e5cd6312d1188af36820d92ad5d50ac3acdfbcc0206a1059f7c)
- bm25: -10.3637 | relevance: 0.9120

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

### 28. src/app/session/slate/page.jsx (13e1b143fc8c70835296875f2adb564c790e2794458a2ac07e5f1458ae2372e6)
- bm25: -10.3558 | relevance: 0.9119

'use client'

/**
 * Mr. Slate -- Skills & Practice Coach
 *
 * A quiz-mode drill session. Questions are drawn from the same lesson JSON
 * as Ms. Sonoma (sample, truefalse, multiplechoice, fillintheblank pools).
 * The learner accumulates points (goal: 10) to earn the robot mastery icon.
 *
 * Rules:
 *   - Correct answer within time limit  -> +1 (min 0, max 10)
 *   - Wrong answer                      -> -1 (min 0)
 *   - Timeout (15s default)             -> +/-0
 *   - Reach 10 -> mastery confirmed
 *
 * Questions rotate through the full pool without repeats until ~80% have
 * been asked, then the deck reshuffles.
 *
 * Lessons are loaded from /api/learner/available-lessons (handles static,
 * generated, and Supabase-stored lessons uniformly). No URL params required.
 */

import { Suspense, useState, useEffect, useRef, useCallback, forwardRef } from 'react'
import { useRouter } from 'next/navigation'
import { getMasteryForLearner, saveMastery } from '@/app/lib/masteryClient'

// --- Constants ---------------------------------------------------------------

const QUESTION_SECONDS = 15
const SCORE_GOAL = 10
const FEEDBACK_DELAY_MS = 2000
const RESHUFFLE_THRESHOLD = 0.2 // reshuffle when only 20% of deck remains

const DEFAULT_SLATE_SETTINGS = {
  scoreGoal: 10,
  correctPts: 1,
  wrongPts: 1,
  timeoutPts: 0,
  timeoutOffset: 0,
  questionSecs: 15,
}

### 29. src/app/session/slate/page.jsx (9ae74c652da3942f39651a542ca0bdfe34cebe289db1014f40417c12c325038a)
- bm25: -10.1651 | relevance: 0.9104

<div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setSoundOn(v => !v)}
            title={soundOn ? 'Mute voice' : 'Unmute voice'}
            style={soundBtn}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <button onClick={backToList} style={ghostBtn}>LIST</button>
          <button onClick={exitToLessons} style={dangerBtn}>EXIT</button>
        </div>
      </div>

### 30. src/app/learn/lessons/page.js (94b9bc97db37d8e3df7ba866d7fc176a496473efabdad13295900e0115892d1c)
- bm25: -10.0789 | relevance: 0.9097

// CRITICAL: Don't treat 'congrats' or 'test' as meaningful progress
  // Lesson is complete - no point resuming to "Complete Lesson" button
  // Test phase includes both in-progress tests AND completed tests (testFinalPercent may be null)
  if (phase === 'congrats' || phase === 'test') return false

### 31. src/app/learn/awards/page.js (47bc6f3bfd7d509f8e841562bc9aedb6b081a5060920834a436575e17213e74a)
- bm25: -10.0575 | relevance: 0.9096

useEffect(() => {
    let cancelled = false
    ;(async () => {
      setCustomSubjectsLoading(true)
      try {
        const { getSupabaseClient } = await import('@/app/lib/supabaseClient')
        const supabase = getSupabaseClient()
        if (!supabase) {
          if (!cancelled) setCustomSubjects([])
          return
        }
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          if (!cancelled) setCustomSubjects([])
          return
        }

const res = await fetch('/api/custom-subjects', {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        if (!res.ok) {
          if (!cancelled) setCustomSubjects([])
          return
        }
        const data = await res.json().catch(() => null)
        const subjects = Array.isArray(data?.subjects) ? data.subjects : []
        if (!cancelled) setCustomSubjects(subjects)
      } catch {
        if (!cancelled) setCustomSubjects([])
      } finally {
        if (!cancelled) setCustomSubjectsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Get auth token for facilitator lessons
      let token = null
      try {
        const { getSupabaseClient } = await import('@/app/lib/supabaseClient')
        const supabase = getSupabaseClient()
        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession()
          token = session?.access_token || null
        }
      } catch {}

### 32. sidekick_pack.md (8d2d98c4a5e9802d9ffc48dd47d1b4ee95e3b624a0bcdde6bb2a6300794f51dd)
- bm25: -9.9557 | relevance: 0.9087

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

### 33. src/app/learn/lessons/page.js (fd432b7dc2b939e1efff637173a80541b976276afa1b10837256fa7eb09710b2)
- bm25: -9.9178 | relevance: 0.9084

{learnerId && learnerId !== 'demo' && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20, marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => setShowHistoryModal(true)}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              background: '#fff',
              color: '#111827',
              fontSize: 14,
              fontWeight: 600,
              cursor: lessonHistoryLoading ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
            disabled={lessonHistoryLoading && !lessonHistorySessions.length}
            title={lessonHistoryLoading ? 'Loading history…' : 'See completed lessons'}
          >
            ✅ Completed Lessons{completedLessonCount ? ` (${completedLessonCount})` : ''}
            {activeLessonCount > 0 && (
              <span style={{ fontSize: 12, color: '#d97706' }}>⏳ {activeLessonCount}</span>
            )}
          </button>
          <button
            onClick={async () => {
              const ok = await ensurePinAllowed('facilitator-page')
              if (ok) router.push('/facilitator/generator')
            }}
            style={{
              padding: '10px 20px',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              background: '#fff',
              color: '#111827',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            ✨ Generate a Lesson
          </button>
          <button
            onClick={() => rou

### 34. docs/brain/ingests/pack-mentor-intercepts.md (ad9be28e3be4c170969fd8d3a91e2b0202957cc880842fc857610f9d7f8b194a)
- bm25: -9.8703 | relevance: 0.9080

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

### 35. src/app/learn/awards/page.js (7bc9f9a06897b38ad7fbcd7544a86dacb73aed6c6c4ea0e854e91c40036b1551)
- bm25: -9.7768 | relevance: 0.9072

const medalsBySubject = () => {
    const normalizeSubject = (raw) => {
      const s = String(raw || '').trim().toLowerCase()
      if (!s) return null
      if (s === 'language-arts' || s === 'language arts') return 'language arts'
      if (s === 'social-studies' || s === 'social studies') return 'social studies'
      if (s === 'facilitator' || s === 'facilitator-lessons' || s === 'facilitator lessons') return 'generated'
      return s.replace(/\s+/g, ' ')
    }

const ensureJsonFile = (file) => {
      const f = String(file || '').trim()
      if (!f) return f
      return f.toLowerCase().endsWith('.json') ? f : `${f}.json`
    }

const coreSubjects = CORE_SUBJECTS

const grouped = {}
    
    Object.entries(medals).forEach(([lessonKey, medalData]) => {
      if (!medalData.medalTier) return // Only show lessons with medals
      
      const parts = String(lessonKey || '').split('/')
      const subjectRaw = parts[0]
      const fileRaw = parts.slice(1).join('/')
      if (!subjectRaw || !fileRaw) return

const file = ensureJsonFile(fileRaw)
      const subjectKey = normalizeSubject(subjectRaw)

// Determine which subject bucket this medal belongs to.
      // For facilitator-generated lessons, infer from the generated lesson's metadata subject.
      let bucket = subjectKey

const generatedList = allLessons.generated || []
      const generatedLesson = generatedList.find(l => (ensureJsonFile(l?.file) === file)) || null
      const generatedSubject = normalizeSubject(generatedLesson?.subject)

if (!bucket || bucket === 'generated') {
        // Allow generated lessons to bucket into core OR custom subjects.
        if (generatedSubject) {
          bucket = generatedSubject
        }
      }

### 36. src/app/facilitator/lessons/page.js (8c55833cb4214a267daa8a171015ec8d5d740e71d62b27cace491e9fbf0e6a37)
- bm25: -9.7240 | relevance: 0.9068

{selectedLearnerId && showLessons && (
                <button
                  onClick={() => setShowHistoryModal(true)}
                  style={{
                    padding: '10px 18px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    background: '#fff',
                    color: '#374151',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: lessonHistoryLoading ? 'wait' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    whiteSpace: 'nowrap'
                  }}
                  disabled={lessonHistoryLoading && !lessonHistorySessions.length}
                  title={lessonHistoryLoading ? 'Loading history…' : 'View recent completions'}
                >
                  ✅ Completed Lessons{completedLessonCount ? ` (${completedLessonCount})` : ''}
                  {activeLessonCount > 0 && (
                    <span style={{ fontSize: 12, color: '#d97706' }}>⏳ {activeLessonCount}</span>
                  )}
                </button>
              )}

### 37. src/app/session/slate/page.jsx (359e98d10d756fb84bd296d06d2bde2a81963f8018f92b2e5c94f7b392fbfaea)
- bm25: -9.6136 | relevance: 0.9058

// ===========================================================================
  //  RENDER -- Lesson list
  // ===========================================================================
  if (pagePhase === 'list') {
    return (
      <div style={{ fontFamily: C.mono, background: C.bg, height: '100dvh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <video src={SLATE_VIDEO_SRC} muted playsInline style={{ width: 36, height: 36, objectFit: 'contain' }} />
            <div>
              <div style={{ color: C.accent, fontWeight: 800, fontSize: 15, letterSpacing: 2 }}>MR. SLATE V1</div>
              <div style={{ color: C.muted, fontSize: 10, letterSpacing: 2 }}>SKILLS &amp; PRACTICE COACH</div>
            </div>
          </div>
          <button onClick={exitToLessons} style={ghostBtn}>← BACK</button>
        </div>

### 38. docs/brain/ingests/pack.md (2a2474c33e1886efce4e1ae36e6b3481cdfa631f2676d805eaab189c70153402)
- bm25: -9.5820 | relevance: 0.9055

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

### 39. src/app/session/slate/page.jsx (b9c51c7a99463827e71c7398b2b5cda84c07ca75a7888e529f506c49f4504cb2)
- bm25: -9.5334 | relevance: 0.9051

{/* True / False */}
              {isAsking && q.type === 'truefalse' && (
                <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
                  <button
                    onClick={() => onChoiceClick('true')}
                    style={{ ...tfBtnBase, background: '#0d1117', border: `1px solid ${C.green}`, color: C.green }}
                  >
                    TRUE
                  </button>
                  <button
                    onClick={() => onChoiceClick('false')}
                    style={{ ...tfBtnBase, background: '#0d1117', border: `1px solid ${C.red}`, color: C.red }}
                  >
                    FALSE
                  </button>
                </div>
              )}

### 40. docs/brain/calendar-lesson-planning.md (508134b31ceac5379e6edf01fa6e367c144e9aac1f98d2a85cca866a2cb62f68)
- bm25: -9.5141 | relevance: 0.9049

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


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
