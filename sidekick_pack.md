# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Mr. Slate not loading all lessons that facilitator/lessons page has in owned - available-lessons API slate page lesson list
```

Filter terms used:
```text
API
slate
not
loading
all
lessons
facilitator
page
owned
available
lesson
list
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-11 10:41` — Lesson Planner Generate button opens lesson generator overlay says Generate on [date] change date calendar picker planne
- `2026-03-11 11:30` — Calendar scheduled lessons Edit Lesson button reschedule past lessons Notes Assigns Add Images Remove rescheduling calen
- `2026-03-11 17:21` — change view lessons to Ms. Sonoma on /learn page, move Mr. Slate button from learn/lessons page to /learn page below Awa

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

Pack chunk count (approximate): 27. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

API slate not loading all lessons facilitator page owned available lesson list

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/slate/page.jsx (2ddbffc215161a104f365cc3b7817839f451a7295575f9a11ec248dde84574e3)
- bm25: -19.4518 | relevance: 0.9511

// Load learner + mastery + available lessons
  useEffect(() => {
    if (typeof window === 'undefined') return
    const id = localStorage.getItem('learner_id')
    setLearnerId(id)
    if (id) {
      const mm = getMasteryForLearner(id)
      setMasteryMap(mm)
      learnerIdRef.current = id
      if (!id || id === 'demo') {
        phaseRef.current = 'list'
        setPagePhase('list')
        return
      }
      Promise.all([
        fetch(`/api/learner/available-lessons?learner_id=${encodeURIComponent(id)}`)
          .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load lessons'))),
        fetch(`/api/learner/slate-settings?learner_id=${encodeURIComponent(id)}`)
          .then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/learner/lesson-history?learner_id=${encodeURIComponent(id)}&limit=200`)
          .then(r => r.ok ? r.json() : null).catch(() => null),
      ])
        .then(([availRes, settingsRes, historyRes]) => {
          const { lessons = [], staleApprovedKeys = [] } = availRes || {}
          const drillable = (lessons || []).filter(l => buildPool(l).length > 0)
          setAvailableLessons(drillable)
          setAllOwnedLessons(lessons || [])
          if (settingsRes?.settings) {
            const merged = { ...DEFAULT_SLATE_SETTINGS, ...settingsRes.settings }
            setSettings(merged)
            setSettingsDraft(merged)
            settingsRef.current = merged
          }

### 2. docs/brain/lesson-library-downloads.md (b1b9e213db751b5765dbf2e696989c3293e61bd99e1db9d560a4332ae5c3532e)
- bm25: -18.7970 | relevance: 0.9495

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

### 3. src/app/facilitator/lessons/page.js (652a3b96f1eb02714520e12523a2705fb2cdd47f2309e1cb0facbc899260c7e3)
- bm25: -17.5317 | relevance: 0.9460

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

if (res.ok) {
            const generatedList = await res.json()
            const sortedGeneratedList = (Array.isArray(generatedList) ? generatedList : []).sort((a, b) => {
              const timeA = new Date(a?.created_at || 0).getTime()
              const timeB = new Date(b?.created_at || 0).getTime()
              return timeB - timeA
            })

### 4. docs/brain/ingests/pack.md (90a382c3781f765190781869790ccf18304821e4a8a147aac0b1f34bf9033e76)
- bm25: -17.1940 | relevance: 0.9450

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

### 5. src/app/session/slate/page.jsx (215300450fbe910ad2a77df56744c0c6320eef8d290c7edb22e8020d6c2338e9)
- bm25: -16.9444 | relevance: 0.9443

// Fetch full lesson data for:
          //   1. history lesson_ids not in the loaded approved set
          //   2. staleApprovedKeys — keys that were in approved_lessons but files couldn't be
          //      found by available-lessons (now we retry via /api/lessons/meta which handles
          //      generated lessons stored in Supabase Storage)
          const historyMissing = [...seen.keys()].filter(k => !approvedKeySet.has(k))
          const staleSet = new Set(staleApprovedKeys || [])
          const metaKeys = [...new Set([...historyMissing, ...staleSet])]
          if (metaKeys.length) {
            fetch('/api/lessons/meta', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keys: metaKeys, learner_id: id }),
            }).then(r => r.ok ? r.json() : null).then(res => {
              if (res?.lessons?.length) {
                const map = {}
                for (const l of res.lessons) map[l.lessonKey] = l
                setHistoryLessons(map)
              }
            }).catch(() => {})
          }
          phaseRef.current = 'list'
          setPagePhase('list')
        })
        .catch(e => {
          setErrorMsg(e?.message || 'Could not load lessons.')
          phaseRef.current = 'error'
          setPagePhase('error')
        })
    } else {
      phaseRef.current = 'list'
      setPagePhase('list')
    }
  }, [])

### 6. docs/brain/calendar-lesson-planning.md (bad918b02a71d06047328cb4b549e073ad8083ccb4d33488af50cae26e835d4c)
- bm25: -16.2633 | relevance: 0.9421

**Owned-only rule:**
- The picker shows ONLY facilitator-owned lessons.
- It does not list public curriculum lessons from `public/lessons`.

### 7. docs/brain/ingests/pack.planned-lessons-flow.md (0c267f88511874e9aa926f255c08f624faee2b4e83d515c7f72f326776e0c3d2)
- bm25: -16.1835 | relevance: 0.9418

- On page mount, the client prefetches built-in lesson lists immediately (no auth required) and loads subjects in parallel.
- Owned lessons are then fetched after auth/session is available and merged into the list.
- This keeps the UI responsive so clicking "Load Lessons" feels instant even if auth is slow.

### 8. src/app/session/slate/page.jsx (78a2752199a35b2d8534f7c4da7c1e305a5a3df4ed04356546777f1d78e74395)
- bm25: -15.3515 | relevance: 0.9388

{/* ── Scrollable list ─────────────────────────────────── */}
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 16px 24px', maxWidth: 680, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                {listTab === 'active' && (
                  activeList.length === 0 ? (
                    <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 32, letterSpacing: 1 }}>
                      ALL LESSONS MASTERED — CHECK RECENT TAB 🤖
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ color: C.muted, fontSize: 11, letterSpacing: 2, marginBottom: 4 }}>
                        {activeList.length} LESSON{activeList.length !== 1 ? 'S' : ''} AVAILABLE
                      </div>
                      {activeList.map((l, i) => <LessonCard key={getLk(l) || i} lesson={l} />)}
                    </div>
                  )
                )}

### 9. src/app/session/slate/page.jsx (1fa657a448e1581db4210e6af458701832c57fba66a45d9d0d9c98394daff5ae)
- bm25: -15.1802 | relevance: 0.9382

{/* Body — flex column so controls stay fixed and only the list scrolls */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {availableLessons.length === 0 && allOwnedLessons.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 60 }}>
              <div style={{ marginBottom: 16 }}>
                <SlateVideo size={120} />
              </div>
              <div style={{ color: C.muted, fontSize: 14, letterSpacing: 1 }}>NO DRILL LESSONS AVAILABLE</div>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Complete a lesson with Ms. Sonoma first, then come back to practice.</div>
            </div>
          ) : (() => {
            // --- Derived lists for each tab ---
            const getLk = l => l.lessonKey || `${l.subject || 'general'}/${l.file || ''}`

// Merge approved lessons + history-fetched metadata into one map
            const mergedMap = new Map(allOwnedLessons.map(l => [getLk(l), l]))
            Object.entries(historyLessons).forEach(([k, l]) => { if (!mergedMap.has(k)) mergedMap.set(k, l) })

// Active: drillable lessons from approved set, not yet Slate-mastered
            const activeList = availableLessons.filter(l => !masteryMap[getLk(l)]?.mastered)

// Recent: sessions joined to merged lesson map so all cards are real
            const recentList = recentSessions.map(s => ({ session: s, lesson: mergedMap.get(s.lesson_id) }))

### 10. docs/brain/ingests/pack.planned-lessons-flow.md (bb1ea8e97e97bc7a7cf0e595d4c2e295f2243bf8cb59b699da17b5cf5ee90289)
- bm25: -14.9865 | relevance: 0.9374

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

### 11. docs/brain/calendar-lesson-planning.md (1d396766db2440144971a1350400b34ef2799dc2339e2896f9d8c5a4a2c58fe0)
- bm25: -14.6080 | relevance: 0.9359

- `src/app/facilitator/calendar/LessonPicker.js`
  - Manual scheduling UI ("Add Lessons")
  - Loads ONLY facilitator-owned lessons via `/api/facilitator/lessons/list`
  - Produces `generated/<filename>` keys for scheduling and for `/api/lesson-file`

### 12. docs/brain/ingests/pack.planned-lessons-flow.md (0f7166c8532c44d946f304b21783d627e9b974887552cfc762d34feacecf6e85)
- bm25: -14.3902 | relevance: 0.9350

- `src/app/facilitator/calendar/LessonPicker.js`
  - Manual scheduling UI ("Add Lessons")
  - Loads ONLY facilitator-owned lessons via `/api/facilitator/lessons/list`
  - Produces `generated/<filename>` keys for scheduling and for `/api/lesson-file`

### 13. sidekick_pack.md (84b9eb66256455b459527b44b0d725e6b90511e2bf688251f44a08fbf12a8ce2)
- bm25: -14.3637 | relevance: 0.9349

**Data source and key format:**
- Loads owned lessons via `GET /api/facilitator/lessons/list` (Bearer token required).
- Schedules lessons using `generated/<filename>` keys so `GET /api/lesson-file?key=generated/<filename>` loads from `facilitator-lessons/<userId>/<filename>`.

### 14. docs/brain/ingests/pack.md (e4dc0297c51db7b2d71be9de0406c24c615491ad333d110432ff2a8f5a2ec213)
- bm25: -14.2549 | relevance: 0.9344

- A dropdown filter controls which lessons are shown:
  - **Owned** (default): show only owned lessons (Storage-backed).
  - **Downloadable**: show only downloadable lessons that are not owned.
  - **All Lessons**: show both.

### 15. src/app/facilitator/lessons/page.js (fb4196aaceb4cb5f37a10f372c1d445db829e8fe181e20ad14318ff446fb609f)
- bm25: -13.7058 | relevance: 0.9320

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

### 16. src/app/session/slate/page.jsx (36719431fe7f3258f8a4d7604510f97529ca7d60507a7278cb51c2acaa757e28)
- bm25: -13.6427 | relevance: 0.9317

{/* Owned tab — all owned/activated lessons with filters */}
                {listTab === 'owned' && (
                  <div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                      <select
                        value={ownedFilters.subject}
                        onChange={e => setOwnedFilters(f => ({ ...f, subject: e.target.value }))}
                        style={{ background: C.surface, color: ownedFilters.subject ? C.text : C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', fontSize: 11, fontFamily: C.mono, cursor: 'pointer', letterSpacing: 1 }}
                      >
                        <option value=''>ALL SUBJECTS</option>
                        {allSubjects.map(s => <option key={s} value={s}>{s.replace(/-/g, ' ').toUpperCase()}</option>)}
                      </select>
                      <select
                        value={ownedFilters.grade}
                        onChange={e => setOwnedFilters(f => ({ ...f, grade: e.target.value }))}
                        style={{ background: C.surface, color: ownedFilters.grade ? C.text : C.muted, border: `1px solid ${C.border}`, borderRadius: 6, padding: '5px 10px', fontSize: 11, fontFamily: C.mono, cursor: 'pointer', letterSpacing: 1 }}
                      >
                        <option value=''>ALL GRADES</option>
                        {allGrades.map(g => <option key={g} value={String(g)}>GRADE {g}</option>)}
                      </select>
                      <select
                        value={ownedFilters.difficulty}
                        onChange={e => setOwnedFilters(f => ({ ...f, difficulty: e.target.value }))}
                        style={{ background: C.surface, color: ownedFilters.diffi

### 17. src/app/facilitator/lessons/page.js (091b333030b7fa0b790d4abe79fdf6f8a31327df31aa89502ac14854e23bd94a)
- bm25: -12.9147 | relevance: 0.9281

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

const owned = {}
      for (const lesson of sortedGeneratedList) {
        const subj = (lesson?.subject || '').toString().toLowerCase() || 'math'
        const file = lesson?.file
        if (file) owned[`${subj}/${file}`] = true
      }
      setOwnedLessonKeys(owned)

### 18. src/app/facilitator/lessons/page.js (121977b0b65b50a3f402b628076d1afc293340c46f229f4d92d0d00df893012b)
- bm25: -12.4234 | relevance: 0.9255

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

### 19. src/app/session/slate/page.jsx (6904ac8d681ef822ce6ac487589db141b2edd3e4f7592cadaf845fb8f55aea1b)
- bm25: -12.3876 | relevance: 0.9253

// Page state
  // Phases: loading | list | ready | asking | feedback | won | error
  const [pagePhase, setPagePhase] = useState('loading')
  const [availableLessons, setAvailableLessons] = useState([])
  const [lessonData, setLessonData] = useState(null)
  const [pool, setPool] = useState([])
  const [score, setScore] = useState(0)
  const [qCount, setQCount] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS)
  const [currentQ, setCurrentQ] = useState(null)
  const [userAnswer, setUserAnswer] = useState('')
  const [lastResult, setLastResult] = useState(null)
  const [soundOn, setSoundOn] = useState(true)
  const [learnerId, setLearnerId] = useState(null)
  const [masteryMap, setMasteryMap] = useState({})
  const [errorMsg, setErrorMsg] = useState('')
  const [listTab, setListTab] = useState('active')
  const [ownedFilters, setOwnedFilters] = useState({ subject: '', grade: '', difficulty: '' })
  const [allOwnedLessons, setAllOwnedLessons] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [historyLessons, setHistoryLessons] = useState({})
  const [listError, setListError] = useState('')
  const [settings, setSettings] = useState(DEFAULT_SLATE_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsDraft, setSettingsDraft] = useState(DEFAULT_SLATE_SETTINGS)
  const [settingsSaving, setSettingsSaving] = useState(false)

### 20. src/app/learn/lessons/page.js (a496efb3e2ea9c79ee10f68c524874c9247e042a14ec501354b58b2525ea8bd8)
- bm25: -12.0440 | entity_overlap_w: 1.30 | adjusted: -12.3690 | relevance: 0.9252

setLessonsLoading(true)
      
      const lessonsMap = {}
      
      // Load demo lessons if it's the demo learner
      if (learnerId === 'demo') {
        try {
          const res = await fetch('/api/lessons/demo', { cache: 'no-store' })
          const list = res.ok ? await res.json() : []
          lessonsMap['demo'] = Array.isArray(list) ? list : []
        } catch {
          lessonsMap['demo'] = []
        }
      } else if (learnerId) {
        // OPTIMIZED: Call single API that returns only checked/scheduled lessons
        try {
          const res = await fetch(`/api/learner/available-lessons?learner_id=${learnerId}`, {
            cache: 'no-store'
          })
          
          if (res.ok) {
            const {
              lessons,
              scheduledKeys: serverScheduledKeys,
              rawSchedule: serverRawSchedule,
              approvedKeys: serverApprovedKeys,
              staleApprovedKeys,
              staleScheduledKeys
            } = await res.json()
            let cleanupTriggered = false
            if (Array.isArray(staleApprovedKeys) && staleApprovedKeys.length > 0) {
              cleanupTriggered = true
            }
            if (Array.isArray(staleScheduledKeys) && staleScheduledKeys.length > 0) {
              cleanupTriggered = true
            }
            if (cleanupTriggered) {
              setRefreshTrigger(prev => prev + 1)
            }
            
            // Group by subject
            for (const lesson of lessons) {
              const subject = lesson.isGenerated ? 'generated' : (lesson.subject || 'general')
              if (!lessonsMap[subject]) lessonsMap[subject] = []
              lessonsMap[subject].push(lesson)
            }
          }
        } catch (err) {
        }
      }
      
      i

### 21. sidekick_pack.md (d62c6741ac395fbdad0b9d21b669ab12793639e264438a2e035c67198dec3016)
- bm25: -12.0369 | entity_overlap_w: 1.30 | adjusted: -12.3619 | relevance: 0.9252

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

### 22. docs/brain/ingests/pack.md (449969b4c519b1e04ae0f2ff5cdd6f65950ce2e104330fb9db2a7d480291f3c5)
- bm25: -12.2931 | relevance: 0.9248

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

### 23. src/app/session/slate/page.jsx (9aa0441e837627aa176ce619418a83df669b8d45ec48db0cf3c00ae3298c11e2)
- bm25: -12.1992 | relevance: 0.9242

<div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={startDrill} style={ghostBtn}>DRILL AGAIN</button>
            <button onClick={backToList} style={ghostBtn}>LESSON LIST</button>
            <button onClick={exitToLessons} style={primaryBtn}>← BACK TO LESSONS</button>
          </div>
        </div>
      </div>
    )
  }

### 24. docs/brain/calendar-lesson-planning.md (508134b31ceac5379e6edf01fa6e367c144e9aac1f98d2a85cca866a2cb62f68)
- bm25: -11.4773 | entity_overlap_w: 2.60 | adjusted: -12.1273 | relevance: 0.9238

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

### 25. docs/brain/ingests/pack.lesson-schedule-debug.md (e224d32488a2b06f9978abd8574e008f7dbf4babd4347e650e7fb5b4f94c5832)
- bm25: -11.4553 | entity_overlap_w: 2.60 | adjusted: -12.1053 | relevance: 0.9237

After completing `assign_lesson`, Mr. Mentor must confirm in dialogue:

### 22. docs/brain/calendar-lesson-planning.md (508134b31ceac5379e6edf01fa6e367c144e9aac1f98d2a85cca866a2cb62f68)
- bm25: -18.6847 | entity_overlap_w: 1.50 | adjusted: -19.0597 | relevance: 1.0000

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

### 26. src/app/session/slate/page.jsx (0877c7ac701b8020d4b42945c40e5b0f22bdb7963e45b61864038498f052e168)
- bm25: -11.9661 | relevance: 0.9229

// --- Lesson card renderer (all owned lessons) ---
            const LessonCard = ({ lesson, dateLabel }) => {
              const lk = getLk(lesson)
              const mastered = !!(masteryMap[lk]?.mastered)
              const poolSize = buildPool(lesson).length
              const subjectLabel = (lesson.subject || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              const gradeLabel = lesson.grade ? `Grade ${lesson.grade}` : ''
              const diffLabel = lesson.difficulty ? lesson.difficulty.charAt(0).toUpperCase() + lesson.difficulty.slice(1) : ''
              return (
                <button
                  onClick={() => selectLesson(lesson)}
                  style={{
                    background: C.surface,
                    border: `1px solid ${mastered ? C.green : C.border}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    width: '100%',
                    transition: 'border-color 0.2s',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: C.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                      {mastered && <span style={{ color: C.green, marginRight: 6 }}>🤖</span>}
                      {lesson.title || lk}
                    </div>
                    <div style={{ color: C.muted, fontSize: 11, letterSpacing: 1 }}>
                      {[subjectLabel, gradeLabel, diffLabel].filter(Boolean).join(' · ')}
                      {poolSize >

### 27. docs/brain/lesson-editor.md (38744ddc77ed5cd3e3f4d0f126e4a5cb059b0e9e1a27af60e154326b18e313ce)
- bm25: -11.9034 | relevance: 0.9225

### Validation & Safety

**Pre-save Validation**
- Required fields (title, grade, difficulty)
- Question text presence
- Answer completeness
- Minimum choice counts for multiple choice
- Blank presence for fill-in-blank

**Auto-cleanup**
- Empty questions removed
- Empty answer fields filtered
- Empty vocabulary terms removed
- Empty choice options filtered
- Maintains JSON structure integrity

**Error Display**
- Clear error messages before save
- Specific field identification
- Red error banner with checklist

### Workflow

**Edit existing owned lesson**
1. Go to Lesson Library
2. Click "Edit" on an owned lesson
3. Edit any fields in the structured form
4. Save Changes to update the Storage-backed JSON file
5. Cancel to discard changes

**Create a new lesson from scratch**
1. Go to Lesson Library
2. Click **📝 New Lesson**
3. Fill in lesson fields (title, grade, difficulty, subject, etc.)
4. Press Save to create the lesson in Storage
5. Cancel to discard (no Storage file is created)

## Integration with Existing Features

**Compatible with:**
- Text Preview (still available)
- Request AI Changes (for AI-assisted editing)

## Related Brain Files

- **[lesson-validation.md](lesson-validation.md)** - Editor triggers automatic validation on save
- **[ai-rewrite-system.md](ai-rewrite-system.md)** - AIRewriteButton improves lesson content quality

## Key Files

- Structured form UI: `src/components/LessonEditor.jsx`
- Lesson editor page: `src/app/facilitator/lessons/edit/page.js`
- Save existing lesson: `src/app/api/lesson-edit/route.js`
- Create new lesson on first save: `src/app/api/facilitator/lessons/create/route.js`

## What NOT To Do

### 28. src/app/facilitator/lessons/page.js (bda39f95b86d69576d1597096edf6e7f48b83b6e3b8ea916f84cd925ea6ed2c4)
- bm25: -11.8954 | relevance: 0.9225

const owned = {}
            for (const lesson of sortedGeneratedList) {
              const subj = (lesson?.subject || '').toString().toLowerCase() || 'math'
              const file = lesson?.file
              if (file) owned[`${subj}/${file}`] = true
            }
            if (!cancelled) setOwnedLessonKeys(owned)

### 29. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (a1dab0d14f0aec8a3d6ff1797043dccbc6f0c6bcd8dd35fda40e4485f4c57199)
- bm25: -11.1839 | entity_overlap_w: 2.60 | adjusted: -11.8339 | relevance: 0.9221

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

### 30. docs/brain/ingests/pack.planned-lessons-flow.md (3ec4933909da7f7624f4da9086154847a7d90213bc6f8e1a8c7e751f80493f5e)
- bm25: -11.0187 | entity_overlap_w: 2.60 | adjusted: -11.6687 | relevance: 0.9211

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

### 31. src/app/session/slate/page.jsx (13e1b143fc8c70835296875f2adb564c790e2794458a2ac07e5f1458ae2372e6)
- bm25: -11.6480 | relevance: 0.9209

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

### 32. src/app/facilitator/calendar/LessonPicker.js (f875aea1742fe41051db332a32ce08b233c98071266f27296c61cf8d1fb98417)
- bm25: -11.4356 | relevance: 0.9196

const loadAllLessons = async () => {
    try {
      const { getSupabaseClient } = await import('@/app/lib/supabaseClient')
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

// Calendar "Add Lessons" should only show facilitator-owned lessons.
      // These are served via /api/facilitator/lessons/list and scheduled via the "generated/<filename>" key format.
      if (!token) {
        setAllLessons({})
        return
      }

const lessonsMap = {}

try {
        const res = await fetch('/api/facilitator/lessons/list', {
          cache: 'no-store',
          headers: { Authorization: `Bearer ${token}` }
        })

if (!res.ok) {
          setAllLessons({})
          return
        }

const ownedLessons = await res.json()
        if (!Array.isArray(ownedLessons)) {
          setAllLessons({})
          return
        }

for (const lesson of ownedLessons) {
          const subject = (lesson?.subject || 'math').toString().toLowerCase()
          if (!lessonsMap[subject]) lessonsMap[subject] = []
          lessonsMap[subject].push({ ...lesson, isGenerated: true })
        }
      } catch (err) {
        setAllLessons({})
        return
      }

setAllLessons(lessonsMap)
    } catch (err) {
      // Silent fail
    }
  }

const handleSchedule = async (lessonKey) => {
    if (!selectedDate) {
      alert('Please select a date first')
      return
    }

setLoading(true)
    try {
      await onScheduleLesson(lessonKey, selectedDate)
      setSelectedLesson(null)
      setLessonDetails(null)
    } finally {
      setLoading(false)
    }
  }

### 33. src/app/api/counselor/route.js (e0e087643d203754ad927bf3632d1e46b45bbf97fde6cfee3bd57de99811b895)
- bm25: -11.2817 | relevance: 0.9186

// Define available functions
    let tools = [
      {
        type: 'function',
        function: {
          name: 'get_capabilities',
          description: 'Get detailed information about your available actions and how to use them. Call this when you need to remember how to generate lessons, schedule them, search for lessons, or understand what parameters are required.',
          parameters: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                description: 'Specific action to get help with (optional). Options: generate_lesson, schedule_lesson, assign_lesson, search_lessons, get_lesson_details, or omit for all capabilities.',
                enum: ['generate_lesson', 'schedule_lesson', 'assign_lesson', 'search_lessons', 'get_lesson_details', 'all']
              }
            }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_lessons',
          description: 'Search for available lessons across all subjects (math, science, language arts, social studies) and facilitator-created lessons. Use this to find lessons by topic, grade, or subject. Returns lesson titles, grades, and keys for scheduling.',
          parameters: {
            type: 'object',
            properties: {
              subject: {
                type: 'string',
                description: 'Filter by subject (optional)',
                enum: ['math', 'science', 'language arts', 'social studies', 'facilitator']
              },
              grade: {
                type: 'string',
                description: 'Filter by grade level like "3rd", "5th" (optional)'
              },
              searchTerm: {
                type: 'string',
                description:

### 34. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (0b4b07dc8dc811d9aa6fcb14d7822a3b6dee590a016258d910f6837aedca0b6f)
- bm25: -10.9476 | entity_overlap_w: 1.30 | adjusted: -11.2726 | relevance: 0.9185

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

### 35. src/app/session/slate/page.jsx (359e98d10d756fb84bd296d06d2bde2a81963f8018f92b2e5c94f7b392fbfaea)
- bm25: -11.1811 | relevance: 0.9179

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

### 36. src/app/api/counselor/route.js (a9d50bd79e5c7b7743013004d68e3a1aa190963beeb9defb3f390771f341d679)
- bm25: -11.1442 | relevance: 0.9177

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

### 37. src/app/session/slate/page.jsx (a330fbeb752b2de55385a68f75e4433226078d18cd2d13c5b7853345c6bba1c2)
- bm25: -11.0760 | relevance: 0.9172

const backToList = useCallback(() => {
    clearInterval(timerInterval.current)
    clearTimeout(feedbackTimeout.current)
    setScore(0)
    scoreRef.current = 0
    setQCount(0)
    setCurrentQ(null)
    setLessonData(null)
    lessonKeyRef.current = ''
    phaseRef.current = 'list'
    setPagePhase('list')
  }, [])

### 38. src/app/session/slate/page.jsx (14314f913d9dee9b6a42b7ecfdef9e45b5487ade0b740878b2d929ce19f40c2f)
- bm25: -11.0158 | relevance: 0.9168

{/* Inline warning banner */}
                {listError && (
                  <div style={{ background: C.redDim, border: `1px solid ${C.red}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: C.red, fontSize: 12 }}>{listError}</span>
                    <button onClick={() => setListError('')} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 0 }}>✕</button>
                  </div>
                )}

{/* Tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 0 }}>
                  <button style={tabStyle(listTab === 'active')} onClick={() => setListTab('active')}>ACTIVE</button>
                  <button style={tabStyle(listTab === 'recent')} onClick={() => setListTab('recent')}>
                    RECENT{recentList.length > 0 ? ` (${recentList.length})` : ''}
                  </button>
                  <button style={tabStyle(listTab === 'owned')} onClick={() => setListTab('owned')}>
                    OWNED{mergedMap.size > 0 ? ` (${mergedMap.size})` : ''}
                  </button>
                </div>
                </div>{/* end controls strip */}

### 39. src/app/api/counselor/route.js (4d2e160d3ab6aca791c2ec247367ff87eb38626c390c680fc8db625916e602c4)
- bm25: -10.9825 | relevance: 0.9165

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

### 40. src/app/facilitator/calendar/LessonPicker.js (2fdcb49286c7afb546edec2ba2192209ebdcf821a39f1853c3dead2307e6edb9)
- bm25: -10.9551 | relevance: 0.9164

{/* Compact Lessons List */}
      <div style={{ height: '400px', overflowY: 'auto' }}>
        {totalCount === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' }}>
            {Object.keys(allLessons).length === 0 ? 'Loading lessons...' : 'No lessons match your filters'}
          </div>
        ) : (
          <div>
            {Object.entries(filteredLessonsBySubject)
              .sort(([subjectA], [subjectB]) => {
                // Sort subjects alphabetically
                return subjectA.localeCompare(subjectB)
              })
              .map(([subject, lessons]) => {
              if (lessons.length === 0) return null
              
              return (
                <div key={subject}>
                  {/* Subject Header (only show when viewing all subjects) */}
                  {selectedSubject === 'all' && (
                    <div style={{ 
                      padding: '6px 12px', 
                      background: '#f9fafb', 
                      borderBottom: '1px solid #e5e7eb',
                      fontSize: '12px',
                      fontWeight: '700',
                      color: '#374151',
                      textTransform: 'capitalize',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1
                    }}>
                      {subject}
                    </div>
                  )}
                  
                  {/* Lessons for this subject */}
                  {lessons.map(lesson => {
                    const scheduled = isScheduled(lesson.key)
                    return (
                      <div
                        key={lesson.key}
                        onClick={() => handleLessonClick(lesson)}


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
