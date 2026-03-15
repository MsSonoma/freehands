# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
objectives completion tracking user response text accordion research mode essay generation webb session page.jsx
```

Filter terms used:
```text
page.jsx
objectives
completion
tracking
user
response
text
accordion
research
mode
essay
generation
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-14 17:03` — video and conversation 50/50 split landscape 50% width portrait 50% height media overlay smaller inset positioned toward
- `2026-03-14 17:15` — YouTube video transcript captions for Mrs Webb to use in chat context
- `2026-03-14 17:45` — research objectives derived from lesson questions checklist comprehension tracking GPT check resource search narrowing W

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

Pack chunk count (approximate): 9. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

page.jsx objectives completion tracking user response text accordion research mode essay generation

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/webb/page.jsx (e4f81025b7de8eea3530506be1f98524d18a4fb3b59d1700a8adf22f88dee2d1)
- bm25: -17.9578 | relevance: 0.9473

// ── Active lesson ────────────────────────────────────────────────────
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [chatMessages, setChatMessages]     = useState([]) // [{role,content}] for API
  const [transcript, setTranscript]         = useState([]) // [{text,role}] for CaptionPanel
  const [activeIndex, setActiveIndex]       = useState(-1)
  const [chatLoading, setChatLoading]       = useState(false)
  const transcriptRef                       = useRef(null)

// ── Research objectives ──────────────────────────────────────────────
  const [objectives,         setObjectives]        = useState([])  // string[]
  const [completedObj,       setCompletedObj]      = useState([])  // number[] of completed indices
  const [newlyCompletedObj,  setNewlyCompletedObj] = useState(null) // {idx, text} — drives tablet toast
  const [showObjectives,     setShowObjectives]    = useState(false) // objectives panel overlay
  const [showSourceSettings, setShowSourceSettings] = useState(false) // article source settings
  const [articleSources,     setArticleSources]    = useState(() => {
    const ALL = ['simple-wikipedia','wikipedia','kiddle','ducksters','wikijunior']
    if (typeof window === 'undefined') return ALL
    try {
      const stored = JSON.parse(localStorage.getItem('webb_article_sources') || 'null')
      if (Array.isArray(stored) && stored.length) return stored
    } catch {}
    return ALL
  })
  const checkingObjRef = useRef(false) // debounce concurrent checks

### 2. docs/brain/mr-mentor-conversation-flows.md (958c9ac063b744328200ce6dc74910b7af60f847dfe7d0b4c07358dfdc1068a0)
- bm25: -13.4591 | relevance: 0.9308

### Function Schemas
- **File:** `src/app/api/counselor/route.js`
- **Location:** OpenAI tools array in POST handler
- **Functions:**
  - `search_lessons` - Broad, always available
  - `generate_lesson` - Restricted, escape-aware
  - `schedule_lesson` - Action-immediate
       - `assign_lesson` - Make lesson available to learner (action-immediate)

### Capabilities Info
- **File:** `src/app/api/counselor/route.js`
- **Function:** `getCapabilitiesInfo()`
- **Provides:** Detailed guidance on when to use each function

---

## Edge Cases

### User Says "Recommend Them to Be Generated"
This is confusing language mixing "recommend" (advice) with "generated" (creation).

**Interpretation Priority:**
1. Dominant verb: "recommend" → advice mode
2. Context: "Do you have suggestions?" preceded this → advice mode
3. Action: Search and recommend, don't generate

### User Says "Stop" During Parameter Collection
Even if function calling started, model can produce conversational response abandoning the call.

**Expected Behavior:**
- Model reads escape signal in system prompt
- Produces text response instead of function call
- Response acknowledges user's preference: "Of course! Let me search instead..."

### User Asks for "Christmas Themed" Without Learner Selected
**Correct Flow:**
1. Search for Christmas-themed lessons across grades
2. Present options
3. Offer to narrow by grade OR generate if nothing suitable
4. DO NOT assume generation is wanted

---

## Testing Scenarios

### Scenario 1: Ambiguous Generation Language
```
User: "Emma needs one more lesson and then Christmas vacation. Suggestions?"
Expected: Search, recommend Christmas-themed language arts, ask questions
Actual (before fix): Started asking for grade, subject, difficulty
```

### 3. docs/brain/ingests/pack-mentor-intercepts.md (3e231008a05445b5759eef203b600a852bd9520ce71072cb95d474a484742b29)
- bm25: -12.1720 | relevance: 0.9241

**❌ DON'T** use `ensurePinAllowed` for non-gated features
- Only call it when you genuinely need to gate an action
- Unnecessary calls degrade user experience

## Key Files

**Core Logic**:
- `src/app/lib/pinGate.js` - PIN validation, section tracking, preferences
- `src/app/api/facilitator/pin/route.js` - Get PIN state, preferences
- `src/app/api/facilitator/pin/verify/route.js` - Server PIN verification

**Navigation Integration**:
- `src/app/HeaderBar.js` - Navigation PIN checks, facilitator flag setting
- `src/components/FacilitatorSectionTracker.jsx` - Section flag lifecycle

### 34. docs/brain/session-takeover.md (1f835d163bf68929a4e5f34cd5f4cffe3ef482a5e6b64ab8f8d4977332da7266)
- bm25: -12.0329 | relevance: 1.0000

**Result**: When play timer expires with page closed, restore automatically:
1. Sets countdown completed flag (blocks countdown)
2. Transitions timer to work mode
3. Triggers phase handler to start work phase
4. User lands directly in work phase entrance, can click Go to begin

**Key Files:**
- `src/app/session/page.js`: Flag setting in completion handlers, not in handlePlayTimeUp
- `src/app/session/hooks/useSnapshotPersistence.js`: Detect expired timer on restore, auto-transition
- `src/app/session/sessionSnapshotStore.js`: Persist flag in snapshot

### Database Schema

#### `lesson_sessions` Table Extensions

**New columns:**
```sql
ALTER TABLE lesson_sessions
  ADD COLUMN session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN device_name TEXT,
  ADD COLUMN last_activity_at TIMESTAMPTZ DEFAULT NOW();

CREATE UNIQUE INDEX unique_active_lesson_session 
  ON lesson_sessions (learner_id, lesson_id) 
  WHERE ended_at IS NULL;
```

### 4. docs/brain/visual-aids.md (c3fb6c81339e5a5f3a4c953b263a19d62a9e74dfcc98126689b6811e52abff79)
- bm25: -11.8531 | relevance: 0.9222

### Database
- **Table**: `visual_aids`
  - `lesson_key` (text) - normalized lesson identifier (prefix-stripped, typically ends with `.json`)
  - `facilitator_id` (uuid) - owner
  - `generated_images` (jsonb) - array of saved images (permanent URLs only)
  - `selected_images` (jsonb) - array of images used in-session (permanent URLs only)
  - `generation_count` (int) - generation limit tracking
  - `max_generations` (int) - configured max generations

### 5. src/app/api/webb-objectives/route.js (c36e55d68984e187b2c6ee57f5738229baa493ad7a5ae8d373850a60d47cf77f)
- bm25: -11.4314 | relevance: 0.9196

/**
 * /api/webb-objectives
 *
 * Two actions, one endpoint:
 *
 * POST { action: 'generate', lesson }
 *   → { objectives: string[] }   — 5-8 comprehension objectives derived from lesson questions
 *
 * POST { action: 'check', objectives: string[], completedIndices: number[], conversation: {role,content}[] }
 *   → { newlyCompleted: number[] }   — indices of objectives the student just demonstrated
 */
import { NextResponse } from 'next/server'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

async function callGPT(apiKey, system, user, maxTokens = 500) {
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  })
  const json = await res.json()
  return json.choices?.[0]?.message?.content?.trim() || ''
}

// ── Generate objectives from a lesson's question bank ────────────────────────
async function generateObjectives(apiKey, lesson) {
  const title   = lesson?.title   || 'this topic'
  const subject = lesson?.subject || 'general'
  const grade   = lesson?.grade   ? `Grade ${lesson.grade}` : 'elementary'

### 6. docs/brain/ai-rewrite-system.md (35a8a6775add282434752ed4c19bb6c38e5828f05d19689f0af7b1943e0b76fa)
- bm25: -11.4234 | relevance: 0.9195

# AI Rewrite System

## How It Works

Reusable AI-powered text rewriting system used throughout the application to improve and enhance user-written text.

### AIRewriteButton Component
- Location: `src/components/AIRewriteButton.jsx`
- Props: `text`, `onRewrite`, `disabled`, `loading`, `size`, `style`
- Button sizes: 'small', 'medium', 'large'
- Shows loading state during rewrite

### AI Rewrite API
- Location: `src/app/api/ai/rewrite-text/route.js`
- Endpoint: `POST /api/ai/rewrite-text`
- Request body: `{ text, context?, purpose }`
- Response: `{ rewritten }`

### Rewrite Purposes

**visual-aid-description**
- Rewrites image descriptions for kid-friendly educational content (ages 6-12)
- Simple, age-appropriate language
- Warm and encouraging tone
- 2-3 short sentences
- Natural spoken tone for Ms. Sonoma

**generation-prompt**
- Improves AI image generation prompts for DALL-E 3
- Specific and descriptive
- Includes style guidance
- Educational clarity focus
- Concise but detailed

**general**
- General text improvement
- Clear and concise
- Maintains original meaning
- Improved grammar and flow
- Professional polish

## Current Usage

### Visual Aids Carousel
- Location: `src/components/VisualAidsCarousel.jsx`
- Two rewrite buttons:
  1. **Image Description**: Rewrites user's basic description into kid-friendly language
     - Purpose: `visual-aid-description`
     - Context: Lesson title
  2. **Generation Prompt**: Improves custom prompt for "Generate More"
     - Purpose: `generation-prompt`
     - Context: Lesson title

### 7. src/app/api/webb-objectives/route.js (ad8f73af2b1297bd6b6064b63c0a481970028fc76c92fd415227f8e57bd3bf5e)
- bm25: -11.1551 | relevance: 0.9177

const system =
    `You are a curriculum designer. Given a list of assessment questions for a school lesson, ` +
    `derive 5 to 8 core comprehension objectives. Each objective should be a clear, ` +
    `student-facing statement of what the learner needs to understand — written as ` +
    `"The learner can explain..." or "The learner understands...". ` +
    `Consolidate overlapping questions into a single objective. ` +
    `Do NOT number them. Return one objective per line, nothing else.`

const user =
    `Lesson: "${title}" — ${subject}, ${grade}.\n\n` +
    `Assessment questions:\n${allQ.map((q, i) => `${i + 1}. ${q}`).join('\n')}`

const raw = await callGPT(apiKey, system, user, 400)
  const objectives = raw.split('\n').map(l => l.replace(/^[-•*]\s*/, '').trim()).filter(Boolean)
  return objectives
}

// ── Check whether the student just demonstrated any uncompleted objectives ────
async function checkObjectives(apiKey, objectives, completedIndices, conversation) {
  const incomplete = objectives
    .map((obj, i) => ({ obj, i }))
    .filter(({ i }) => !completedIndices.includes(i))

if (!incomplete.length) return []

// Only look at the last 4 turns to keep this fast + cheap
  const recentTurns = conversation.slice(-4)
    .filter(m => m.role === 'user')
    .map(m => String(m.content || '').trim())
    .filter(Boolean)

if (!recentTurns.length) return []

### 8. src/app/session/webb/page.jsx (6ff7232539ceed43c45bacea4435ff282c7e9eda5531d3e4cea71a871d4c7f7e)
- bm25: -10.9615 | relevance: 0.9164

// ── Objectives: generate when lesson starts ──────────────────────────
  // Generate objectives from the lesson question bank (fired once per lesson).
  // Fall back silently if the API is unavailable.
  const generateObjectives = useCallback(async (lesson) => {
    setObjectives([])
    setCompletedObj([])
    setNewlyCompletedObj(null)
    try {
      const res  = await fetch('/api/webb-objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', lesson }),
      })
      const data = await res.json()
      if (Array.isArray(data.objectives) && data.objectives.length) {
        setObjectives(data.objectives)
      }
    } catch { /* objectives are optional — fail silently */ }
  }, [])

### 9. docs/brain/content-safety.md (93d61090b2a879fb2b21f888024bf4fae5fd67db358043f695a5c3433a258b65)
- bm25: -10.8840 | relevance: 0.9159

## What NOT To Do

- Never remove profanity filter checks before LLM calls
- Never skip output validation (scan responses before frontend)
- Never allow freeform story/poem generation without templates
- Never relax SAFETY RULE directives in prompts
- Never disable moderation API checks

## Template-Based Features

### Poem Feature (Template Mode)
- Pre-written templates: Acrostic, Haiku, Rhyming Couplet
- User selects vocab term from dropdown
- User selects template from list
- System substitutes vocab term into template
- No LLM call for poem generation

### Story Feature (Choice-Based)
- Dropdown choices for characters, settings, plots
- Predefined safe lists only
- Limited LLM for narrative generation with strict guardrails
- Maximum story length: 5 exchanges

## AI Rewrite Safety
- Located: `src/app/api/ai/rewrite-text/route.js`
- Purpose-specific prompts: visual-aid-description, generation-prompt, general
- Kid-friendly language (ages 6-12) for visual-aid-description
- Warm and encouraging tone enforcement
- Context-aware rewrites with lesson title

### 10. src/app/api/webb-objectives/route.js (cea713c644fae1889818a47363b3a28510c9dd12ca530ecf325fbfdd8beacb2e)
- bm25: -10.4822 | relevance: 0.9129

const objList = incomplete.map(({ obj, i }) => `${i}: ${obj}`).join('\n')
  const studentSaid = recentTurns.map(t => `Student: "${t}"`).join('\n')

const raw = await callGPT(apiKey, system,
    `Remaining objectives (number: text):\n${objList}\n\nRecent student messages:\n${studentSaid}`,
    80)

if (raw.toLowerCase().includes('none')) return []
  const newly = []
  for (const part of raw.split(',')) {
    const n = parseInt(part.trim(), 10)
    if (!isNaN(n) && !completedIndices.includes(n) && objectives[n]) newly.push(n)
  }
  return newly
}

export async function POST(req) {
  try {
    const body   = await req.json()
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'Not configured' }, { status: 503 })

if (body.action === 'generate') {
      const objectives = await generateObjectives(apiKey, body.lesson || {})
      return NextResponse.json({ objectives })
    }

if (body.action === 'check') {
      const newly = await checkObjectives(
        apiKey,
        body.objectives    || [],
        body.completedIndices || [],
        body.conversation  || [],
      )
      return NextResponse.json({ newlyCompleted: newly })
    }

return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (e) {
    console.error('[webb-objectives]', e)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

### 11. src/app/facilitator/generator/counselor/CounselorClient.jsx (cf1b46eb6bc2fd7c8ff2571d5249c17bb3439661a6224cfc088fea6132771898)
- bm25: -10.4103 | relevance: 0.9124

// Get auth token for function calling
      const supabase = getSupabaseClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const headers = { 'Content-Type': 'application/json' }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }
      
      const response = await fetch('/api/counselor', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          message: finalForwardMessage,
          // ThoughtHub: chronograph + deterministic packs provide context; omit on-wire history to save tokens.
          history: cohereChronographEnabled ? conversationHistory.slice(-8) : conversationHistory,
          use_cohere_chronograph: cohereChronographEnabled,
          use_thought_hub: cohereChronographEnabled,
          subject_key: subjectKey,
          cohere_mode: 'standard',
          thought_hub_mode: 'standard',
          // Include learner context if a learner is selected
          learner_transcript: learnerTranscript || null,
          // Include persistent goals notes
          goals_notes: goalsNotes || null,
          // Include any context from interceptor
          interceptor_context: Object.keys(forwardContext).length > 0 ? forwardContext : undefined,
          require_generation_confirmation: true,
          generation_confirmed: generationConfirmed,
          disableTools
        })
      })

### 12. src/app/session/webb/page.jsx (afda4de30c18bfbd07256fa275dcff38af1033472ccfcf7baec1f8faceb9f1ea)
- bm25: -10.0660 | relevance: 0.9096

// ── Objectives: check after each student turn ─────────────────────────
  // Runs in the background after a normal chat turn; never blocks the UI.
  const checkObjectivesAfterTurn = useCallback(async (updatedMessages, currentObjectives, currentCompleted) => {
    if (!currentObjectives.length || checkingObjRef.current) return
    if (currentCompleted.length >= currentObjectives.length) return
    checkingObjRef.current = true
    try {
      const res  = await fetch('/api/webb-objectives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action:           'check',
          objectives:       currentObjectives,
          completedIndices: currentCompleted,
          conversation:     updatedMessages,
        }),
      })
      const data = await res.json()
      const newly = data.newlyCompleted || []
      if (newly.length) {
        setCompletedObj(prev => {
          const next = [...new Set([...prev, ...newly])]
          // Show the tablet toast for the first newly completed objective
          const firstIdx = newly.find(i => !prev.includes(i))
          if (firstIdx !== undefined) {
            setNewlyCompletedObj({ idx: firstIdx, text: currentObjectives[firstIdx] })
          }
          return next
        })
      }
    } catch { /* fail silently */ }
    checkingObjRef.current = false
  }, [])

// Auto-dismiss the tablet toast after 3.5 s
  useEffect(() => {
    if (!newlyCompletedObj) return
    const t = setTimeout(() => setNewlyCompletedObj(null), 3500)
    return () => clearTimeout(t)
  }, [newlyCompletedObj])

### 13. sidekick_pack.md (af53ecc19ee10a49a8b05a6d9667006979cd7d5f304dcfad57d5acde47312bea)
- bm25: -10.0567 | relevance: 0.9096

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

### 14. docs/brain/session-takeover.md (67d6f1cc34af6fd217783490d4f011c8cef30e9a03ac7f4e9f0c5692245348e3)
- bm25: -10.0551 | relevance: 0.9095

## Timer Continuity Details

**Timer state components:**
- `currentTimerMode`: 'play' (Begin to Go) or 'work' (Go to next phase)
- `workPhaseCompletions`: object tracking which phases completed work timer
- `elapsedSeconds`: current countdown value
- `targetSeconds`: phase-specific target (from runtime config)
- `capturedAt`: ISO timestamp when snapshot saved

**Snapshot capture (every gate):**
```javascript
timerSnapshot: {
  phase: phase,
  mode: currentTimerModeRef.current || currentTimerMode,
  capturedAt: new Date().toISOString(),
  elapsedSeconds: getElapsedFromSessionStorage(phase, currentTimerMode),
  targetSeconds: getTargetForPhase(phase, currentTimerMode)
}
```

**Restore logic:**
```javascript
const { timerSnapshot } = restoredSnapshot;
if (timerSnapshot) {
  const drift = Math.floor((Date.now() - new Date(timerSnapshot.capturedAt)) / 1000);
  const adjustedElapsed = Math.min(
    timerSnapshot.elapsedSeconds + drift,
    timerSnapshot.targetSeconds
  );
  
  // Write to sessionStorage (source for timer component)
  sessionStorage.setItem(
    `timer_${timerSnapshot.phase}_${timerSnapshot.mode}`,
    JSON.stringify({
      elapsedSeconds: adjustedElapsed,
      startTimestamp: Date.now() - (adjustedElapsed * 1000)
    })
  );
  
  setCurrentTimerMode(timerSnapshot.mode);
}
```

**Result:** Timer continues within ±2 seconds of where old device left off (gate save latency + network round-trip).

## PIN Validation Security

**Already implemented** in `page.js` lines 286-314:
- Client calls `ensurePinAllowed(pinCode)` from `src/app/lib/pinAuth.js`
- Server validates PIN hash against learner's stored scrypt hash
- Only correct PIN allows session takeover
- Failed PIN shows error, user can retry

### 15. docs/brain/beta-program.md (5851e8ee0d8c3d076d02ce2aecabd28c163260fe51544b7be54a3cb74934ed85)
- bm25: -9.7800 | relevance: 0.9072

# Beta Program: Tutorial Gating, Survey, and Tracking

**Status**: Canonical  
**Last Updated**: 2025-11-25

## How It Works

The Beta program provides tutorial-style toggles for all users while enforcing mandatory first-time completion for Beta-tier users. It requires facilitator post-lesson survey (with password re-auth) to unlock the golden key, records timestamps for transcripts and notes, counts repeat usage by sentence, and measures lesson time.

### Goal

- Provide tutorial-style toggles for all users
- Enforce mandatory first-time completion for Beta-tier users
- Require facilitator post-lesson survey with password re-auth to unlock golden key
- Record timestamps for transcripts and notes
- Count repeat usage by sentence
- Measure lesson time

### Scope

- Back-end gating
- Supabase fields/tables
- Route guards
- Event logging
- Survey + re-auth flow
- Feature toggles
- Uninstall plan

### Invariants

- Ms. Sonoma remains stateless and instruction-only
- Placeholders never reach Ms. Sonoma
- ASCII-only punctuation
- No UI/tool mentions in Ms. Sonoma payloads
- Developer-only rules live in Copilot instructions

## Targeting and Flags

### Subscription Tier

- Add `subscription_tier` to `profiles` table (nullable text or enum)
- Valid values include `Beta`
- Only admins set this in Supabase

### Feature Flags

**FORCE_TUTORIALS_FOR_BETA** (default: true)
- If user profile has `subscription_tier == 'Beta'`, tutorial completion gates access

**SURVEY_GOLDEN_KEY_ENABLED** (default: true)
- Golden key remains locked until required survey is submitted

**TUTORIALS_AVAILABLE_FOR_ALL** (default: true)
- Non-Beta users may optionally use tutorials but are not blocked

**Uninstall Toggle**: Turning both flags off fully disables gates without data loss

### 16. docs/brain/mr-mentor-conversation-flows.md (47a7f1d23cc6ab836950913552c45a69e0bbfb20cccb99e80ebdf542e7e579c2)
- bm25: -9.5112 | relevance: 0.9049

# Mr. Mentor Conversation Flows

**Last Updated:** 2025-12-18  
**Status:** Canonical  
**Systems:** Conversation decision logic, lesson generation vs recommendations, escape hatches, function calling triggers

---

## How It Works

### Frontend Confirmation Gate

- Every counselor request sets `require_generation_confirmation: true`.
- If GPT tries to call `generate_lesson`, the API now returns a confirmation prompt instead of executing.
- The frontend marks `pendingConfirmationTool = 'generate_lesson'` and asks the user.
- If the user declines, the next request disables `generate_lesson` (`disableTools: ['generate_lesson']`) and appends a decline note to the user message: "(User declined generation. Respond by providing assistance with the user's problem.)" so GPT assists instead of forcing generation.
- If the user confirms, the next request sets `generation_confirmed: true` and allows the tool call.

### Recommendations vs Generation Decision Logic

Mr. Mentor must distinguish between two fundamentally different user intents:

1. **Seeking Recommendations/Advice** - User wants suggestions from existing lessons
2. **Requesting Generation** - User wants to create a new custom lesson

#### Recognition Patterns

**Recommendation Intent (DO NOT trigger generation):**
- "Do you have suggestions?"
- "What do you recommend?"
- "Any ideas for lessons?"
- "Give me advice"
- "What lessons are good for X?"
- "Do you have lessons on X?"
- Mentioning a topic without imperative verbs

**Generation Intent (ONLY time to trigger generation):**
- "Create a lesson about X"
- "Generate a lesson for X"
- "Make me a lesson on X"
- Explicit imperative verbs requesting creation

#### Response Flow

### 17. docs/brain/ingests/pack.md (3e4733180e642ec829b4887f07abf0a470a782c4ade262bf7f23ad16482acc7f)
- bm25: -9.2278 | relevance: 0.9022

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

### 18. docs/brain/mr-mentor-conversation-flows.md (32af0ce972bc228b72cbaab4e488efca4dd9a1c0df0c93e692c10279247cf66f)
- bm25: -9.2048 | relevance: 0.9020

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

### 19. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (851519f892d949891704ef037fbce8e2b24ad89f33bed54eec889978127580c6)
- bm25: -9.1933 | relevance: 0.9019

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

### 20. docs/brain/timer-system.md (b7aa6681ad045e85a58422ec46641d948683a8b9be9eb4e041d2b6d83bd36742)
- bm25: -9.1595 | relevance: 0.9016

2. **PlayTimeExpiredOverlay** displays:
   - Shows "Time to Get Back to Work!" message
   - 30-second countdown (green, turns amber at 5 seconds)
   - Displays phase name user will return to
   - Auto-advances when countdown reaches 0

3. **handlePlayExpiredComplete** fires when countdown completes:
   - Hides overlay (`showPlayTimeExpired = false`)
   - Transitions to work timer for expired phase
   - Automatically starts the work phase:
     - Discussion/Teaching: calls `startSession()` (orchestrator start)
     - Comprehension/Exercise/Worksheet/Test: calls the phase controller `go()` (`comprehensionPhaseRef.current.go()`, etc.)
   - Each phase handler hides play buttons as part of its normal flow
   - Clears `playExpiredPhase`
  - When discussion/teaching needs to auto-start, `startSession({ ignoreResume: true })` is used so a stale snapshot resumePhase cannot skip ahead during an active lesson.

### Go Button Override

If user clicks Go button during the 30-second countdown:
- Overlay is immediately dismissed
- Work timer starts without waiting for countdown
- All phase start handlers check and clear overlay state

### Work Time Completion Tracking

### 21. src/app/api/counselor/route.js (d3671345983e3da2c721351005b396361b5dc74b8114b589bca081e0fbc86ff5)
- bm25: -9.1239 | relevance: 0.9012

CRITICAL DISTINCTION - Recommendations vs Generation:
- If user asks "do you have suggestions?", "what lessons do you recommend?", "any ideas?", "give me advice" → SEARCH existing lessons and recommend them. DO NOT start lesson generation.
- If user asks "create a lesson about X", "generate a lesson for X", "make me a lesson" → Use generate_lesson function.
- NEVER assume they want generation just because they mention a topic. Default to searching and recommending.

CRITICAL CONFIRMATION STEP - Before Collecting Generation Parameters:
- NEVER start collecting generation parameters (grade, subject, difficulty) without explicit confirmation first
- Even if user says "I need a lesson not in the library" or "recommend lessons to create", they are asking for IDEAS not actual generation
- You MUST ask: "Would you like me to generate a custom lesson?" and wait for their response
- Only start collecting generation parameters if they explicitly confirm they want generation ("yes", "yes, generate", "create one", "make a lesson")
- If they say "no", "search", "recommend", "I'm not sure", "not yet", "I want ideas first" → SEARCH existing lessons and provide recommendations
- This confirmation prevents accidentally entering generation flow when they just want suggestions

### 22. docs/brain/ingests/pack-mentor-intercepts.md (f5d69e0c87050a310ae8df7bb0dbd6ff7af0b77776de5dc44d0f8289b56be3ab)
- bm25: -9.1233 | relevance: 0.9012

**Expected Behavior:**
- Model reads escape signal in system prompt
- Produces text response instead of function call
- Response acknowledges user's preference: "Of course! Let me search instead..."

### 23. src/app/session/v2/TimerService.jsx (ed20e524fb391c98e412107adfaaf937c32ebd58a07e4cce4980ec297dcee03b)
- bm25: -9.0592 | relevance: 0.9006

// Sticky completion records for Golden Key + end-of-test reporting.
    // Once a phase has been completed on time, it retains credit until explicit reset.
    // Map: phase -> { completed, onTime, elapsed, timeLimit, remaining, finishedAt }
    this.workPhaseResults = new Map();
    
    // Work phase time limits (seconds) - all phases have work timers
    this.workPhaseTimeLimits = options.workPhaseTimeLimits || {
      discussion: 300,    // 5 minutes
      comprehension: 180, // 3 minutes
      exercise: 180,      // 3 minutes
      worksheet: 300,     // 5 minutes
      test: 600           // 10 minutes
    };
    
    // Golden key tracking (only counts comprehension, exercise, worksheet, test)
    this.onTimeCompletions = 0;
    this.goldenKeyAwarded = false;

### 24. src/app/api/counselor/route.js (9a307250303ca681aaf2a751152eb9d7dc5d7d694b24887d3a1ca16f658a641f)
- bm25: -8.9355 | relevance: 0.8994

3. GENERATE_LESSON - Create new custom lessons (ONLY when user wants actual generation)
   - ONLY use when user explicitly says: "create a lesson", "generate a lesson", "make me a lesson"
   - DO NOT use when user asks: "do you have suggestions?", "what do you recommend?", "any ideas?", "give me advice"
   - If they ask for recommendations/suggestions/advice: search existing lessons and recommend, don't generate
   - CONFIRMATION REQUIRED: If uncertain whether they want generation vs recommendations, ASK FIRST: "Would you like me to generate a custom lesson?"
   - Only collect parameters after they confirm they want generation
   - ALWAYS search first to avoid duplicates
   - Takes 30-60 seconds to complete
   - ESCAPE HATCH: If during parameter collection user gives ANY response that isn't the parameter you asked for (you ask "What grade?" they say anything OTHER than a grade), abandon and give recommendations instead

### 25. scripts/add-cohere-style-rls-and-rpcs.sql (dfbc5f7ea25ac73242f59b3997b3485225df253d8babbf43c4b2a75ed1ff6525)
- bm25: -8.9343 | relevance: 0.8993

return out_json;
end;
$$;

revoke all on function public.rpc_gate_suggest(uuid,text,text,int) from public;
grant execute on function public.rpc_gate_suggest(uuid,text,text,int) to authenticated;

-- 3) Pack builder (deterministic caps)
create or replace function public.rpc_pack(
  p_tenant_id uuid,
  p_thread_id uuid,
  p_sector text,
  p_question text,
  p_mode text default 'standard'
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  recent_n int;
  recall_k int;
  out_json jsonb;
  q tsquery;
  latest_goals jsonb;
  latest_summary jsonb;
  recent_events jsonb;
  recall_snippets jsonb;
begin
  if p_mode = 'minimal' then
    recent_n := 12;
    recall_k := 4;
  elsif p_mode = 'deep' then
    recent_n := 30;
    recall_k := 12;
  else
    recent_n := 20;
    recall_k := 8;
  end if;

-- Latest goals (may be null)
  select ug.goals_json into latest_goals
  from public.user_goal_versions ug
  where ug.tenant_id = p_tenant_id
    and ug.user_id = auth.uid()
    and (ug.sector = 'both' or ug.sector = p_sector)
  order by ug.ts desc, ug.goal_version_id desc
  limit 1;

-- Latest summary (may be null)
  select jsonb_build_object('title', s.title, 'summary', s.summary, 'ts', s.ts) into latest_summary
  from public.thread_summary_versions s
  where s.tenant_id = p_tenant_id
    and s.thread_id = p_thread_id
  order by s.ts desc, s.summary_version_id desc
  limit 1;

### 26. src/app/session/webb/page.jsx (46c9b322b6504e227a98acb2b46b246c50fe11868f5e5a39a595405d869d14d0)
- bm25: -8.7984 | relevance: 0.8979

// Get Mrs. Webb's opening greeting
    try {
      const res = await fetch('/api/webb-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [], lesson }),
      })
      const data = await res.json()
      const reply = data.reply || `Hi! I'm Mrs. Webb. Today we're exploring "${lesson.title}". What do you already know about this topic?`
      const firstMsg = { role: 'assistant', content: reply }
      setChatMessages([firstMsg])
      addMsg(reply)
    } catch {
      const fallback = `Hi! I'm Mrs. Webb. Let's explore "${lesson.title}" together! What do you already know?`
      setChatMessages([{ role: 'assistant', content: fallback }])
      addMsg(fallback)
    }

setPhase(PHASE.CHATTING)

// Preload media + generate objectives in background
    preloadResources(lesson)
    generateObjectives(lesson)
  }, [preloadResources, generateObjectives])

// ── Send chat message ─────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || chatLoading) return
    addStudentLine(text)

### 27. src/app/session/webb/page.jsx (74292eb7dee7f0da473f100a8b6a50564561b292cf9b6367aba953f15e0ecca4)
- bm25: -8.7755 | relevance: 0.8977

{/* Header */}
      <div style={{ background: C.accentDark, color: '#fff', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24 }} aria-hidden>&#128105;&#127995;&#8205;&#127979;</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: 0.5 }}>MRS. WEBB</div>
              {selectedLesson
                ? <div style={{ fontSize: 11, opacity: 0.85, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedLesson.title}</div>
                : <div style={{ fontSize: 11, opacity: 0.75, letterSpacing: 1 }}>LESSON TEACHER</div>
              }
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {isChatting && objectives.length > 0 && (
              <button
                type="button"
                onClick={() => setShowObjectives(true)}
                title="View learning objectives"
                style={{
                  ...headerBtn,
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: completedObj.length === objectives.length
                    ? 'rgba(13,148,136,0.45)'
                    : 'rgba(255,255,255,0.15)',
                }}
              >
                <span style={{ fontSize: 14 }}>&#9989;</span>
                <span style={{ fontSize: 12 }}>{completedObj.length}/{objectives.length}</span>
              </button>
            )}
            {isChatting && (
              <button type="button" onClick={handleBack} style={he

### 28. src/app/facilitator/generator/counselor/CounselorClient.jsx (560a97dabeb3d69552560641479a25e42d1b318d87c2de0553f727de27f8aff3)
- bm25: -8.7548 | relevance: 0.8975

const continueLessonFollowUp = useCallback(async ({ followUpPayload, validationSummaries, toolResults, token, history }) => {
    const headers = { 'Content-Type': 'application/json' }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

const body = {
      history,
      use_cohere_chronograph: cohereChronographEnabled,
      use_thought_hub: cohereChronographEnabled,
      subject_key: subjectKey,
      cohere_mode: 'standard',
      thought_hub_mode: 'standard',
      followup: {
        assistantMessage: followUpPayload.assistantMessage,
        functionResults: followUpPayload.functionResults,
        toolResults,
        validationSummaries
      },
      learner_transcript: learnerTranscript || null,
      goals_notes: goalsNotes || null
    }

const response = await fetch('/api/counselor', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })

if (!response.ok) {
      let errorMessage = `Follow-up failed with status ${response.status}`
      try {
        const errorData = await response.json()
        // Silent error handling
        if (errorData.error) {
          errorMessage += `: ${errorData.error}`
        }
      } catch (parseErr) {
        // Silent error handling
      }
      throw new Error(errorMessage)
    }

return response.json()
  }, [learnerTranscript, goalsNotes, subjectKey, cohereChronographEnabled])
  
  // Load all lessons for interceptor
  const loadAllLessons = useCallback(async () => {
    const SUBJECTS = ['math', 'science', 'language arts', 'social studies', 'general']
    const results = {}

### 29. docs/brain/ingests/pack-mentor-intercepts.md (332dce4bc318eac57f8b4ce424647323b49ebb36a87c624bea0b8af2f6256077)
- bm25: -8.7455 | relevance: 0.8974

### 11. docs/brain/mr-mentor-conversation-flows.md (32af0ce972bc228b72cbaab4e488efca4dd9a1c0df0c93e692c10279247cf66f)
- bm25: -21.1368 | relevance: 1.0000

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

### 30. docs/brain/ingests/pack.lesson-schedule-debug.md (74199fe96afe81da686db95f9093e9ea134a0430d1c72ed364e7f1224c8410bc)
- bm25: -8.7333 | relevance: 0.8973

### 21. docs/brain/mr-mentor-conversation-flows.md (32af0ce972bc228b72cbaab4e488efca4dd9a1c0df0c93e692c10279247cf66f)
- bm25: -19.5862 | relevance: 1.0000

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

### 31. docs/brain/ingests/pack-mentor-intercepts.md (8b9f88cf49cb1a5d7b9d2e538fd2ba21fd123ce6d6948e9499a15591be0ec033)
- bm25: -8.7086 | relevance: 0.8970

After completing `assign_lesson`, Mr. Mentor must confirm in dialogue:

### 12. docs/brain/mr-mentor-conversation-flows.md (702a9fd80a5cfdb20198851630f5bd2294e3590b38a912d5f7058ef0f693bf2f)
- bm25: -19.3221 | relevance: 1.0000

- **2025-12-31:** Appended multi-screen overlay system documentation (CalendarOverlay, LessonsOverlay, GeneratedLessonsOverlay, LessonMakerOverlay)
- **2025-12-18:** Created brain file documenting recommendations vs generation decision logic and escape hatches (fix for locked-in generation flow)

### 13. docs/brain/lesson-notes.md (ac258ad493dde9c766703881b36300ddf044039fc14bddb8ce88bf9914d1a3ef)
- bm25: -18.7849 | relevance: 1.0000

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

### 32. docs/brain/visual-aids.md (b6180cc574e71342b23d8180360005d2dd8c5c31a49c9ab086c82f07dbd9a747)
- bm25: -8.6856 | relevance: 0.8968

**`generation-prompt`**:
- Improves existing image prompts for DALL-E 3
- System prompt: "You know that AI-generated text in images is gibberish and must be completely avoided"
- User prompt: "Suggest visual metaphors or real-world examples instead of diagrams with text"

### 33. src/app/api/webb-chat/route.js (5cb503cf904008ea1863c1a8258b6b2e38b9ac95b8406b88bbc302fb777a40b2)
- bm25: -8.6669 | relevance: 0.8966

if (Array.isArray(remainingObjectives) && remainingObjectives.length) {
    lines.push(
      `\nResearch objectives the student has NOT yet demonstrated (they must explain these in their own words):`,
      remainingObjectives.slice(0, 6).map((o, i) => `${i + 1}. ${o}`).join('\n'),
      `After discussing the video or article, casually end your response with ONE natural question that would lead the student to demonstrate one of these objectives - as if you are just curious, not testing them.`,
      `Never mention "objectives", never say you are checking comprehension.`,
    )
  }

if (assessmentPush) {
    lines.push(
      `\nYou just finished showing the student key moments from the video. Now is the time to draw out their understanding.`,
      `Write 2-3 sentences: briefly celebrate that they watched the key moments, then ask ONE specific question that requires them to explain something from the lesson in their own words.`,
      `The question should target the most important undemonstrated objective (listed above) if any remain, otherwise ask about the most important concept from the lesson.`,
      `Be warm and conversational — this should feel like natural curiosity, not a quiz. No markdown. No bullet points.`,
    )
  }

return lines.filter(Boolean).join('\n')
}

export async function POST(req) {
  try {
    const { messages = [], lesson = {}, media = {}, remainingObjectives = [], assessmentPush = false, seekRequest = null } = await req.json()

### 34. docs/brain/ms-sonoma-teaching-system.md (bb2e5650adf33de142eec6654c834c9ab6ebe9a82e653095f13ee9f099763fd4)
- bm25: -8.6517 | relevance: 0.8964

- Ms. Sonoma is stateless by design - each call is independent
- Snapshot persistence is a separate system (see snapshot-persistence.md)
- Session tracking and device conflicts are separate (see session-takeover.md)
- Visual aids generation is separate (see visual-aids.md)
- Beta program tutorials/surveys are separate (see Beta program section in copilot-instructions.md)

### 35. docs/brain/ingests/pack.planned-lessons-flow.md (043acc5f96fad3732cebeb897f3edf1f5e317250beb4b58f69e73bcccf3e4b46)
- bm25: -8.5640 | relevance: 0.8954

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

### 36. src/app/session/webb/page.jsx (d5a43d97cf3510e12efece39e320344b022894dd41169dbbdbd9607253df0e52)
- bm25: -8.5183 | relevance: 0.8949

// ── Refresh a media resource (context-aware) ──────────────────────────
  async function refreshMedia(type) {
    setRefreshingMedia(true)
    // Save current article so we can restore it if the refresh fails/returns nothing
    const savedArticle = articleResource
    // Clear immediately so the "Finding an article…" spinner appears while loading
    if (type === 'article') setArticleResource(null)
    const recentContext = chatMessages.slice(-6)
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('. ')
    // Narrow search to remaining (incomplete) objectives
    const remaining = objectives
      .filter((_, i) => !completedObj.includes(i))
      .join('; ')
    const contextWithObj = [remaining, recentContext].filter(Boolean).join('. ')
    try {
      const res = await fetch('/api/webb-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lesson: selectedLesson,
          type,
          context: contextWithObj,
          excludeSourceId:        type === 'article' ? (articleResource?.sourceId || '') : undefined,
          preferredSources:       type === 'article' ? articleSources : undefined,
          excludeVideoIds:        type === 'video'   ? shownVideoIdsRef.current      : [],
        }),
      })
      const data = await res.json()
      if (type === 'video' && data.video) {
        setVideoResource(data.video)
        if (data.video.videoId)
          shownVideoIdsRef.current = [...new Set([...shownVideoIdsRef.current, data.video.videoId])]
      }
      if (type === 'article') {
        if (data.article?.html) {
          setArticleKey(k => k + 1)
          setArticleResource(data.article)
        } else {
          // Nothing usable came back — res

### 37. docs/brain/timer-system.md (c62159a4b77af10506a6b386b1ff0e79f36692314fd70902b4807c54c34fc560)
- bm25: -8.5146 | relevance: 0.8949

**Work timer startup for phases 2-5**: Work timers start immediately when the awaiting-go gate appears, whether in play mode or work mode:
- **Play mode flow**: Play timer starts when the **Begin gate** appears (phase entry) → user clicks Begin → Opening Actions + Go gate appear (play timer already running) → user clicks Go → play timer transitions to work timer
- **Work mode flow (skipPlayPortion)**: Work timer starts when the awaiting-go gate appears → user clicks Go → questions begin (timer already running)

### 38. docs/brain/ingests/pack-mentor-intercepts.md (08191c1e946bc63bc45a43254cb2accc0e9eef97fc1d5a13ecd50fc3089f0a45)
- bm25: -8.4728 | relevance: 0.8944

### 25. docs/brain/session-takeover.md (67d6f1cc34af6fd217783490d4f011c8cef30e9a03ac7f4e9f0c5692245348e3)
- bm25: -13.0742 | relevance: 1.0000

## Timer Continuity Details

**Timer state components:**
- `currentTimerMode`: 'play' (Begin to Go) or 'work' (Go to next phase)
- `workPhaseCompletions`: object tracking which phases completed work timer
- `elapsedSeconds`: current countdown value
- `targetSeconds`: phase-specific target (from runtime config)
- `capturedAt`: ISO timestamp when snapshot saved

**Snapshot capture (every gate):**
```javascript
timerSnapshot: {
  phase: phase,
  mode: currentTimerModeRef.current || currentTimerMode,
  capturedAt: new Date().toISOString(),
  elapsedSeconds: getElapsedFromSessionStorage(phase, currentTimerMode),
  targetSeconds: getTargetForPhase(phase, currentTimerMode)
}
```

**Restore logic:**
```javascript
const { timerSnapshot } = restoredSnapshot;
if (timerSnapshot) {
  const drift = Math.floor((Date.now() - new Date(timerSnapshot.capturedAt)) / 1000);
  const adjustedElapsed = Math.min(
    timerSnapshot.elapsedSeconds + drift,
    timerSnapshot.targetSeconds
  );
  
  // Write to sessionStorage (source for timer component)
  sessionStorage.setItem(
    `timer_${timerSnapshot.phase}_${timerSnapshot.mode}`,
    JSON.stringify({
      elapsedSeconds: adjustedElapsed,
      startTimestamp: Date.now() - (adjustedElapsed * 1000)
    })
  );
  
  setCurrentTimerMode(timerSnapshot.mode);
}
```

**Result:** Timer continues within ±2 seconds of where old device left off (gate save latency + network round-trip).

## PIN Validation Security

### 39. src/app/api/webb-objectives/route.js (25c272eefede9bc6f7be0cf21108fcf0d9c392ef9e97ff974cb0646619faeca2)
- bm25: -8.4159 | relevance: 0.8938

const system =
    `You evaluate whether a student has demonstrated understanding of specific objectives ` +
    `in their own words — NOT just from hearing the teacher say it. ` +
    `The student must use their own words, paraphrase, or give an example. ` +
    `They do NOT need to use exact terminology — a clear conceptual demonstration counts. ` +
    `Return ONLY the numbers of objectives that are clearly demonstrated, e.g. "2,5". ` +
    `If none are demonstrated, return "none".`

### 40. docs/brain/mr-mentor-conversation-flows.md (438f465a3284f676ab4056be1792de3b147ffeb85a21cf84b1439ef3e3b6b724)
- bm25: -8.4000 | relevance: 0.8936

### ❌ DON'T 
Then: ABANDON generation flow immediately
- Stop asking for parameters
- Switch to recommendation mode
- Search existing lessons and suggest them
```


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
