# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
research objectives derived from lesson questions checklist comprehension tracking GPT check resource search narrowing Webb
```

Filter terms used:
```text
GPT
research
objectives
derived
lesson
questions
checklist
comprehension
tracking
check
resource
search
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-14 13:10` — media overlay does not appear when video or article button is pressed webb page.jsx portal createPortal overlayPanelStyl
- `2026-03-14 17:03` — video and conversation 50/50 split landscape 50% width portrait 50% height media overlay smaller inset positioned toward
- `2026-03-14 17:15` — YouTube video transcript captions for Mrs Webb to use in chat context

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

Pack chunk count (approximate): 10. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

GPT research objectives derived lesson questions checklist comprehension tracking check resource search

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/api/webb-resources/route.js (9893d37300479d3177417e92a2e57a61af59f58d538e4b565e2879bb790066dd)
- bm25: -15.0635 | entity_overlap_w: 2.60 | adjusted: -15.7135 | relevance: 0.9402

// ── Generate video resource ───────────────────────────────────────────────────
async function generateVideo(apiKey, ytKey, title, subject, grade, ctx) {
  // Step 1: GPT builds the best educational search query
  const query = await callGPT(
    apiKey,
    'You create YouTube search queries for educational videos for children. ' +
    'Return ONLY the search query — 4 to 7 words, no punctuation at the end, no quotes.',
    `Lesson: "${title}". Subject: ${subject}. ${grade}.${ctx}`,
    40,
  )
  const safeQuery = (query || `educational ${title}`).slice(0, 120)

if (ytKey) {
    try {
      const ytUrl =
        `${YT_SEARCH}?part=snippet` +
        `&q=${encodeURIComponent(safeQuery)}` +
        `&type=video&safeSearch=strict&videoEmbeddable=true&maxResults=5` +
        `&key=${ytKey}`
      const ytRes  = await fetch(ytUrl)
      const ytData = await ytRes.json()
      const items  = (ytData.items || []).filter(i => i.id?.videoId)

if (items.length) {
        // Step 2: GPT picks the most educationally relevant result.
        // All candidates are already filtered by YouTube's safeSearch=strict + videoEmbeddable=true
        // so the safety bar here is just relevance, not content moderation.
        const candidateList = items.map((item, i) =>
          `${i}: "${item.snippet.title}" | Channel: ${item.snippet.channelTitle} | ${(item.snippet.description || '').slice(0, 200)}`
        ).join('\n')

### 2. src/app/session/v2/ComprehensionPhase.jsx (d01e99ca2a3e724b74eb7e7aee04c05db031eb947b5bbc97b333bb194696ab85)
- bm25: -13.7357 | relevance: 0.9321

/**
 * ComprehensionPhase - Multiple comprehension questions with scoring
 * 
 * Consumes AudioEngine for question playback.
 * Manages question progression and score tracking.
 * Zero coupling to session state or other phases.
 * 
 * Architecture:
 * - Loads comprehension questions from lesson data
 * - Plays each question with TTS
 * - Prefetches N+1 question during N playback (eliminates wait times)
 * - Presents short-answer or fill-in-blank questions
 * - Validates answers and tracks score
 * - Opening actions (play timer) before work mode
 * - Emits comprehensionComplete with results
 * 
 * Usage:
 *   const phase = new ComprehensionPhase({ audioEngine, eventBus, timerService, questions });
 *   phase.on('comprehensionComplete', (results) => saveScore(results));
 *   await phase.start();
 *   await phase.go(); // After opening actions
 */

import { fetchTTS } from './services';
import { ttsCache } from '../utils/ttsCache';
import { buildAcceptableList, judgeAnswer } from './judging';
import { deriveCorrectAnswerText, formatQuestionForSpeech } from '../utils/questionFormatting';
import { HINT_FIRST, HINT_SECOND, pickHint } from '../utils/feedbackMessages';

// V1 praise phrases for correct answers
const PRAISE_PHRASES = [
  'Great job!',
  'Excellent!',
  'You got it!',
  'Nice work!',
  'Well done!',
  'Perfect!',
  'Awesome!',
  'Fantastic!'
];

// Intro phrases for phase start (V1 pacing pattern)
const INTRO_PHRASES = [
  "Now let's check your understanding.",
  "Time to see what you learned.",
  "Let's test your knowledge.",
  "Ready for a question?"
];

### 3. docs/brain/ms-sonoma-teaching-system.md (1f079cae33ff43ac4f14837a3de47b84b5b01b2e253899f9ec065dd2e8c8247d)
- bm25: -12.7164 | relevance: 0.9271

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

### 4. docs/brain/v2-architecture.md (bc99e4b71f540c7bf37fdef5f564161060387111ec7a1c9304f9cd3ccfe6fd49)
- bm25: -10.0207 | entity_overlap_w: 7.80 | adjusted: -11.9707 | relevance: 0.9229

**Retry + Rate Limit Handling:**
- If GPT returns 429, TeachingController enters a cooldown and produces a deterministic "wait then press Next" sentence
- If GPT returns 500+ (or the fetch throws), TeachingController shows a generic server error message (not rate limit)
- When a non-429 error message is shown, the next Next/Repeat/Restart action triggers an actual retry fetch (instead of advancing past the error sentence and effectively skipping the stage)
- Next/Repeat/Restart must not spam GPT requests during cooldown
- Public methods called without `await` (Repeat/Skip/Restart) must not generate unhandled promise rejections

**Environment Variable Requirements:**
- At least one LLM provider key must be configured: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`
- Google TTS requires: `GOOGLE_APPLICATION_CREDENTIALS` (path to JSON file) or `GOOGLE_TTS_CREDENTIALS` (inline JSON or base64)
- Dev server must be restarted after adding/changing `.env.local` to load new environment variables
- Missing keys cause 500 errors (not 429s); TeachingController now distinguishes these in user-facing messages

**Gate Prompt Flow (uses prefetched content):**
1. Speak "Do you have any questions?" (TTS prefetched)
2. Await prefetched GPT result (usually instant)
3. Speak GPT-generated sample questions (TTS prefetched)
4. Fallback if GPT failed: deterministic questions using lesson title

**Exposes:**
- `prefetchAll()` - start all background prefetches (call on Begin)
- `startTeaching(lessonData)`
- `advanceSentence()`
- `repeatSentence()`
- `skipToExamples()`
- Events: `onStageChange`, `onSentenceAdvance`, `onTeachingComplete`

### 5. src/app/session/v2/SessionPageV2.jsx (a7a58085ca7398c2feecb75c3e009eb01bdc6fa8c004ed4ac13177d8287f65c8)
- bm25: -11.1254 | relevance: 0.9175

// Play portion flags (required - no defaults or fallback)
        const playFlags = {
          comprehension: learner.play_comprehension_enabled,
          exercise: learner.play_exercise_enabled,
          worksheet: learner.play_worksheet_enabled,
          test: learner.play_test_enabled,
        };
        for (const [k, v] of Object.entries(playFlags)) {
          if (typeof v !== 'boolean') {
            throw new Error(`Learner profile missing play_${k}_enabled flag. Please run migrations.`);
          }
        }
        setPlayPortionsEnabled(playFlags);
        playPortionsEnabledRef.current = playFlags;
        
        // Load phase timer settings from learner profile
        const timers = loadPhaseTimersForLearner(learner);
        setPhaseTimers(timers);
        
        // Initialize currentTimerMode (null = not started yet), but do not clobber
        // any existing restore/resume-derived modes.
        setCurrentTimerMode((prev) => {
          const hasExistingMode = prev && Object.values(prev).some((mode) => mode === 'play' || mode === 'work');
          if (hasExistingMode) return prev;
          return {
            discussion: null,
            comprehension: null,
            exercise: null,
            worksheet: null,
            test: null
          };
        });
        
        // Check for active golden key on this lesson (only affects play timers when Golden Keys are enabled)
        // Key format must match V1 + /learn/lessons: `${subject}/${lesson}`.
        if (!goldenKeyLessonKey) {
          throw new Error('Missing lesson key for golden key lookup.');
        }
        const activeKeys = learner.active_golden_keys || {};
        if (learner.golden_keys_enabled && activeKeys[goldenKeyLessonKey]) {
          setHasGoldenKey(true);

### 6. src/app/api/webb-chat/route.js (db5fbda60609d4446cdf895d725273be488cea6e615845b8a2033815e96971fd)
- bm25: -10.7914 | entity_overlap_w: 1.30 | adjusted: -11.1164 | relevance: 0.9175

/**
 * /api/webb-chat
 * Mrs. Webb – AI conversation endpoint.
 * Maintains freeform chat about a lesson topic using GPT-4o-mini.
 * Safety-validates student input before forwarding.
 */
import { NextResponse } from 'next/server'
import { validateInput } from '@/lib/contentSafety'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

function buildSystem(lesson) {
  const title   = lesson?.title   || 'this topic'
  const subject = lesson?.subject || 'general'
  const grade   = lesson?.grade   ? `Grade ${lesson.grade}` : 'elementary/middle school'
  return [
    `You are Mrs. Webb, a warm, encouraging, and knowledgeable teacher.`,
    `You are currently helping a student explore: "${title}" (${subject}, ${grade}).`,
    `Your style:`,
    `- Friendly, patient, and age-appropriate.`,
    `- Ask what the student already knows; build on it.`,
    `- Keep replies short — 2 to 4 sentences — they are read aloud.`,
    `- Write in natural spoken language: no markdown, no bullet points.`,
    `- Gently redirect off-topic questions back to the lesson.`,
    `- Celebrate curiosity and effort.`,
  ].join('\n')
}

export async function POST(req) {
  try {
    const { messages = [], lesson = {} } = await req.json()

// Safety-check the last user message
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (lastUser) {
      const check = validateInput(String(lastUser.content || ''), 'general')
      if (!check.safe) {
        return NextResponse.json({
          reply: "Let's keep our conversation focused on the lesson! What would you like to know?",
        })
      }
    }

### 7. docs/brain/lesson-quota.md (667668f994e6639c835e761aecd5152eb6f331cdb22b15442f025701e70ba167)
- bm25: -10.4283 | relevance: 0.9125

## Key Files

- `/api/lessons/quota` - Quota check and enforcement
- `lesson_unique_starts` table - Daily lesson tracking
- `src/app/lib/entitlements.js` - Tier limits

## What NOT To Do

- Never allow unlimited lesson starts (enforced by API)
- Never trust client-side quota counting (server is source of truth)
- Never skip timezone parameter (day boundary matters)
- Never allow quota bypass without tier check
- Never delete lesson_unique_starts records (historical data)

### 8. src/app/session/v2/TeachingController.jsx (29ce558fe0e8453a40bac315c7861bb3a52455c5e8c239c572702e28b01f7999)
- bm25: -9.7245 | entity_overlap_w: 2.60 | adjusted: -10.3745 | relevance: 0.9121

this.#playCurrentExample();
  }
  
  // Private: Completion
  #completeTeaching() {
    this.#stage = 'complete';
    
    if (this.#audioEndListener) {
      this.#audioEngine.off('end', this.#audioEndListener);
      this.#audioEndListener = null;
    }
    
    this.#emit('teachingComplete', {
      vocabCount: this.#vocabSentences.length,
      exampleCount: this.#exampleSentences.length
    });
  }
  
  // Private: Gate prompt - uses prefetched GPT content for zero latency
  // 1. Speak "Do you have any questions?"
  // 2. Speak prefetched GPT sample questions (or fallback)
  async #playGatePrompt(stage) {
    const lessonTitle = this.#lessonMeta?.lessonTitle || this.#lessonData?.title || 'this topic';

### 9. docs/brain/MentorInterceptor_Architecture.md (e4265fa26ec7826d8e1370392b693965e4e387b487bf5b0cf9b7c9cf516b6867)
- bm25: -10.1672 | relevance: 0.9105

1. **Test locally** - verify all flows work as expected
2. **Refine edge cases** - handle ambiguous inputs gracefully
3. **Add FAQ responses** - common questions without API
4. **Improve search scoring** - tune weights, add keyword boosts
5. **Add validation** - check for required data before actions
6. **Error handling** - graceful degradation when actions fail
7. **Telemetry** - track interceptor hit rate, which flows used most
8. **Push to Vercel** - only after thorough local testing

### 10. docs/brain/ZOMBIE-CODE-PREVENTION.md (68762748dd4662631d92c25af07d0be38c24bb4550bc61d5729a22dd06a4ae6d)
- bm25: -9.8693 | relevance: 0.9080

**Do NOT commit until ALL checkboxes verified.**

### RULE 3: Build + Test After Removal

After claiming to remove code:
```powershell
npm run build  # Must pass
# Manual test: Does the removed system's behavior still occur?
```

If removed pool fallback, test: Does exercise run out of questions?
If yes, pool fallback still runs (not actually removed).

### RULE 4: Changelog Honesty

**Never write:**
> "Removed compPool/exercisePool state"

**When only some references were removed.**

**Instead write:**
> "Removed pool fallback from handleGoComprehension (lines 82-103)"

Be specific about WHAT was removed WHERE, not aspirational claims.

### RULE 5: Tag Before Large Removals

Before removing any system:
```powershell
git tag before-removal-YYYYMMDD-HHMM
```

If removal incomplete, revert and try again:
```powershell
git reset --hard before-removal-YYYYMMDD-HHMM
```

---

## How Complete Removal Was Actually Done (Dec 8)

**Step 1: Research** - Grep found all pool references
**Step 2: List every location:**
- Line 1217-1218: State declarations
- Line 1896-1903: Dependencies in useEffect
- Line 4306: Persistence
- Lines 5751-5759: Comprehension fallback
- Lines 5924-5933: Exercise fallback

**Step 3: Remove ALL in one atomic commit**
**Step 4: Add defensive handling** (array exhaustion completes phase instead of showing buttons)
**Step 5: Build test** (passed)
**Step 6: Update changelog** with what was ACTUALLY done

---

## Red Flags of Zombie Code

### 11. src/app/session/v2/SessionPageV2.jsx (a070d80cae8d7efa70c6291e28abc614478b3aee6d02fcec421c5fc5f5d4eb27)
- bm25: -9.8437 | relevance: 0.9078

const forceFresh = timelineJumpForceFreshPhaseRef.current === 'comprehension';

const snapshot = snapshotServiceRef.current?.snapshot;
    const savedComp = forceFresh ? null : (snapshot?.phaseData?.comprehension || null);
    const savedCompQuestions = !forceFresh && Array.isArray(savedComp?.questions) && savedComp.questions.length ? savedComp.questions : null;
    if (savedCompQuestions && savedCompQuestions.length && (!generatedComprehension || !generatedComprehension.length)) {
      setGeneratedComprehension(savedCompQuestions);
    }
    const storedCompQuestions = !forceFresh && Array.isArray(generatedComprehension) && generatedComprehension.length ? generatedComprehension : null;
    
    // Build comprehension questions with 80/20 MC+TF vs SA+FIB blend (all types allowed)
    const compTarget = savedCompQuestions ? savedCompQuestions.length : (storedCompQuestions ? storedCompQuestions.length : getLearnerTarget('comprehension'));
    if (!compTarget) return false;
    const questions = savedCompQuestions || storedCompQuestions || buildQuestionPool(compTarget, []); // target-driven, no exclusions
    console.log('[SessionPageV2] startComprehensionPhase built questions:', questions.length);

### 12. src/app/api/webb-resources/route.js (f50d22a7d55acd7696a13a93c2acce3b188807ada628c2474c7a7096405f6cb4)
- bm25: -9.7011 | relevance: 0.9066

const title   = lesson.title   || 'general topic'
    const subject = lesson.subject || 'general'
    const grade   = lesson.grade   ? `Grade ${lesson.grade}` : 'elementary'
    const ctx     = context ? ` Student discussion context: ${context.slice(0, 300)}` : ''
    const prevSrc = String(previousSource || '').slice(0, 60)

const needVideo   = type === 'video'   || type === 'both'
    const needArticle = type === 'article' || type === 'both'

// Run video and article generation in parallel
    const [videoResult, articleResult] = await Promise.all([
      needVideo   ? generateVideo(apiKey, ytKey, title, subject, grade, ctx)   : null,
      needArticle ? generateArticle(title, prevSrc) : null,
    ])

return NextResponse.json({
      ...(videoResult   ? { video:   videoResult   } : {}),
      ...(articleResult ? { article: articleResult } : {}),
    })
  } catch (e) {
    console.error('webb-resources error:', e)
    return NextResponse.json({ error: 'Resource generation failed' }, { status: 500 })
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'webb-resources',
    sources: WIKI_SOURCES.map(s => s.name),
  })
}

### 13. docs/brain/ZOMBIE-CODE-PREVENTION.md (7ecf86135777229fc44882def5c1f342fc03b5c3cbc93601cf5ec0c5f4bab410)
- bm25: -9.6742 | relevance: 0.9063

# Zombie Code Prevention Protocol

**Created**: 2025-12-08  
**Purpose**: Prevent incomplete removals that create zombie code causing recurring breakage

---

## What Happened (Dec 2-8, 2025)

**Changelog claimed:**
- Dec 2: "POOLS ELIMINATED - Removed compPool/exercisePool state"
- Dec 5: "removed zombie pool fallback"

**Reality:**
- compPool/exercisePool state still existed (lines 1217-1218)
- Pool fallback logic still ran (lines 5751-5759, 5924-5933)
- Pool persistence still saved empty arrays (line 4306)

**Result:**
- Dual architecture: new array-based system fell back to old empty pools
- Exercise phase ran out of questions at Q8 repeatedly
- Opening actions buttons appeared during Q&A phases repeatedly
- Every "fix" only addressed symptoms, not root cause

---

## Zombie Code Definition

**Zombie code** = Code that changelog claims was removed but still exists and executes

**Why it's dangerous:**
1. Creates dual architectures (new + old systems coexist)
2. Produces unpredictable behavior (falls back to broken legacy code)
3. Breaks repeatedly (symptom fixes don't address root cause)
4. Wastes development time (same bugs resurface)

---

## Prevention Protocol

### RULE 1: Grep Before Claiming Removal

Before writing changelog entry claiming code was removed:
```powershell
# Search for the supposedly removed code
rg "compPool" src/
rg "exercisePool" src/
```

If search returns results, **the code is NOT removed** - changelog must not claim it is.

### RULE 2: Complete Removal Checklist

When removing a system (like pools), verify ALL these are removed:

### 14. docs/brain/ingests/pack.lesson-schedule-debug.md (aa9d6f023753d6f644c4d5d6421a16f93ab2cc9ecf966dc47d68ca9cd18a2570)
- bm25: -9.5039 | relevance: 0.9048

**Steps:**
1. Detect search intent
2. Extract parameters (grade, subject, difficulty)
3. Search allLessons with scoring algorithm
4. Present top 5 results with numbers
5. Await lesson selection (number or name)
6. Ask: "schedule, edit, or discuss?"

**Scoring algorithm:**
- Subject match: +10
- Grade match: +10
- Difficulty match: +5
- Title match (fuzzy): +15

**Selection handling:**
- Number: "1" → first result
- Name: "Multiplying with Zeros" → fuzzy match title

**Action branching:**
- Schedule → Enter schedule flow with lessonKey
- Edit → Enter edit flow with lessonKey
- Discuss → Forward to API with lesson context

### 2. Generate Flow

**Intent:** User wants to create a new lesson  
**Examples:** "create a lesson on fractions", "generate 5th grade science"

### 29. docs/brain/lesson-notes.md (ac258ad493dde9c766703881b36300ddf044039fc14bddb8ce88bf9914d1a3ef)
- bm25: -17.9240 | relevance: 1.0000

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

### 15. src/app/session/v2/SessionPageV2.jsx (165372c7a3407e15ba0bb26c2d8d66bb5459089af4189d45d3bfb41cc4ad60ce)
- bm25: -9.4479 | relevance: 0.9043

const resumeIndex = (!forceFresh && savedComp) ? (savedComp.nextQuestionIndex ?? savedComp.questionIndex ?? 0) : 0;
    const clampedIndex = Math.min(Math.max(resumeIndex, 0), Math.max(questions.length - 1, 0));
    setComprehensionTotalQuestions(questions.length);
    setComprehensionScore(savedComp?.score || 0);
    if (questions[clampedIndex]) {
      setCurrentComprehensionQuestion(questions[clampedIndex]);
    }
    if ((!comprehensionState || comprehensionState === 'idle') && savedComp) {
      setComprehensionState('awaiting-answer');
    }
    
    if (questions.length === 0) {
      // If no comprehension questions, skip to exercise
      addEvent('⚠️ No comprehension questions - skipping to exercise');
      if (orchestratorRef.current) {
        orchestratorRef.current.onComprehensionComplete();
      }
      return false;
    }

### 16. docs/brain/ms-sonoma-teaching-system.md (1b4ee06cf283a5924fd938a14c5f34054fb5fb5d3352ab28382727abf1ae0b21)
- bm25: -8.4557 | entity_overlap_w: 3.90 | adjusted: -9.4307 | relevance: 0.9041

- After "Do you have any questions?" Ms. Sonoma explicitly speaks the generated "You could ask questions like..." follow-ups; if GPT is empty or errors, a deterministic three-question fallback is spoken.
- Snapshot triggers stay stage-specific: definitions use teaching-definition / teaching-definition-gate, examples use teaching-example / teaching-example-gate, and they fire before gate playback so resume hits the correct gate/audio without falling back to definitions labels.
- If the examples GPT call returns no text, the stage ends (no deterministic fallback injected); rely on GPT output only.
- Gate controls (Repeat/Next and the PageDown hotkey) stay hidden/blocked while the gate prompt or sample questions load/play under a dedicated lock so learners hear the three suggestions before moving on.
- If Skip is pressed during this locked sequence, skipGatePrompt stops audio, emits gatePromptComplete, and snaps back to awaiting-gate so controls/hotkey surface instead of hanging; captions already contain the sample questions even when TTS is skipped.
- Frontend safety: teaching gate state lives before the skip handler to avoid TDZ ReferenceError crashes in minified builds when Skip fires during the gate.
- Teaching CTAs (Start Definitions / Next Sentence) render as soon as teaching begins, even during the loading-definitions intro, allowing immediate advance into definitions; Next triggers nextSentence which stops intro audio and begins definitions playback.
- Discussion screen shows a Start Definitions button; it calls skipDiscussion to stop the greeting audio and emit discussionComplete immediately so orchestrator enters teaching without waiting for the greeting to finish.

### 17. docs/brain/ms-sonoma-teaching-system.md (6a2edee4e3cfc75ce3af218db8d3ad5077d743885a3415aa675b5984f9edc421)
- bm25: -9.3479 | relevance: 0.9034

**Allowed Phases**:

1. **Opening** (V2: greeting only, no activities)
   - **V1**: Greeting with child's exact name and lesson title (1-2 sentences) + encouragement + joke + silly question
   - **V2**: Greeting with child's exact name and lesson title (1-2 sentences) only. No joke, no silly question. "Begin" button advances to teaching immediately.
   - **Rationale**: V2 removes opening actions from discussion phase to eliminate play timer exploit. Opening actions (Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Games) moved to play time in phases 2-5.

2. **Teaching Definitions** (first stage)
   - One short kid-friendly definition per vocab term (one sentence each)
   - End with [VERBATIM]: "Do you have any questions? You could ask questions like..." + 2-3 example questions

3. **Teaching Examples** (second stage)
   - Inputs: the examples prompt receives the full lesson JSON (including all generated questions used for assessment)
   - Goal: reverse-engineer the assessment questions back into the teaching examples
   - Coverage requirement (CRITICAL): examples must teach all knowledge needed to answer every lesson question (comprehension, exercise, worksheet, test), even when multiple questions overlap
   - Output shape: 2-3 tiny worked examples by default; may use up to 5 tiny examples when needed to cover all question content
   - End with [VERBATIM]: "Do you have any questions? You could ask questions like..." + 2-3 example questions

4. **Repeat** (when Repeat Vocab clicked)
   - Shorter recap of current stage
   - End with [VERBATIM]: "Do you have any questions? You could ask questions like..." + 2-3 example questions

5. **Transition to Comprehension** (when Next clicked after examples)
   - [VERBATIM]: "Great. Let's move on to comprehension."

### 18. src/app/session/v2/SessionPageV2.jsx (31453943746f5eb818aac44b53d49494a054da08dd593dc769449e043b7b8e6d)
- bm25: -9.3432 | relevance: 0.9033

const withTimeout = async (promise, ms, label) => {
      let timeoutId;
      const timeout = new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
      });
      try {
        return await Promise.race([promise, timeout]);
      } finally {
        clearTimeout(timeoutId);
      }
    };

// Ensure audio is unlocked during this user gesture (V1 parity).
    // The auto "first interaction" listener can fire after React onClick.
    try {
      await withTimeout(audioEngineRef.current.initialize(), 2500, 'Audio unlock');
    } catch {
      // Ignore - browsers may block resume/play outside strict gesture contexts.
    }

// Start (or conflict-check) session tracking before the orchestrator begins.
    // This is required for Calendar history to detect completions reliably.
    try {
      const trackingLearnerId = sessionLearnerIdRef.current || learnerProfile?.id || null;
      const trackingLessonId = lessonKey || null;
      if (trackingLearnerId && trackingLearnerId !== 'demo' && trackingLessonId && browserSessionId) {
        const deviceName = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
        const sessionResult = await withTimeout(
          startTrackedSession(browserSessionId, deviceName),
          12000,
          'Session tracking'
        );
        if (sessionResult?.conflict) {
          setConflictingSession(sessionResult.existingSession);
          setShowTakeoverDialog(true);
          return;
        }
        try { startSessionPolling?.(); } catch {}
      }
    } catch {
      // Tracking failures should not block the lesson.
    }

### 19. src/app/session/v2/SessionPageV2.jsx (43b3375f6634d3d631ebe5b551dbaa759e3bc66541ca26f1fe817e96a8d5df53)
- bm25: -9.2934 | relevance: 0.9029

// Persist question order immediately so mid-phase resume has deterministic pools.
    if (snapshotServiceRef.current) {
      snapshotServiceRef.current.saveProgress('comprehension-init', {
        phaseOverride: 'comprehension',
        questions,
        nextQuestionIndex: forceFresh ? 0 : (savedComp?.nextQuestionIndex || 0),
        score: forceFresh ? 0 : (savedComp?.score || 0),
        answers: forceFresh ? [] : (savedComp?.answers || []),
        timerMode: forceFresh ? 'play' : (savedComp?.timerMode || 'play')
      });
    }
    if (!savedCompQuestions && !storedCompQuestions) {
      setGeneratedComprehension(questions);
      persistAssessments(generatedWorksheet, generatedTest, questions, generatedExercise);
    }
    
    const phase = new ComprehensionPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions,
      resumeState: (!forceFresh && savedComp) ? {
        questions,
        nextQuestionIndex: savedComp.nextQuestionIndex ?? savedComp.questionIndex ?? 0,
        score: savedComp.score || 0,
        answers: savedComp.answers || [],
        timerMode: savedComp.timerMode || 'work'
      } : null
    });
    
    comprehensionPhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setComprehensionState(data.state);
      if (data.timerMode) {
        setComprehensionTimerMode(data.timerMode);
        if (data.timerMode === 'play' || data.timerMode === 'work') {
          const prevMode = currentTimerModeRef.current?.comprehension ?? null;
          if (prevMode !== data.timerMode) {
            setCurrentTimerMode((prev) => ({ ...prev, comprehension: data.timerMode }));
            setTimerRefr

### 20. src/app/session/v2/TeachingController.jsx (da357ae03f3e5c1bc91b8663283532500e522c30f2d048273f0b96eec8beb0e8)
- bm25: -8.6360 | entity_overlap_w: 2.60 | adjusted: -9.2860 | relevance: 0.9028

this.#gatePromptActive = true;
    this.#gatePromptStage = stage;
    this.#gatePromptSkipped = false;
    this.#emit('gatePromptStart', { stage });
    let gateError = null;
    try {
    
    // 1. Speak "Do you have any questions?"
    const questionText = 'Do you have any questions?';
    let questionAudio = ttsCache.get(questionText);
    if (!questionAudio) {
      questionAudio = await fetchTTS(questionText);
      if (questionAudio) ttsCache.set(questionText, questionAudio);
    }
    await this.#audioEngine.playAudio(questionAudio || '', [questionText]);
    
    // 2. Get prefetched GPT content (should already be ready)
    let sampleText = null;
    const prefetchPromise = stage === 'definitions' 
      ? this.#definitionsGatePromptPromise 
      : this.#examplesGatePromptPromise;
    
    if (prefetchPromise) {
      try {
        sampleText = await prefetchPromise;
        console.log('[TeachingController] Using prefetched gate prompt for', stage);
      } catch (err) {
        console.error('[TeachingController] Prefetched gate prompt error:', err);
      }
      // Clear the promise
      if (stage === 'definitions') {
        this.#definitionsGatePromptPromise = null;
      } else {
        this.#examplesGatePromptPromise = null;
      }
    }
    
    // 3. Fallback if prefetch failed or returned empty
    const cleanTitle = (lessonTitle || 'this topic').trim();
    if (!sampleText) {
      sampleText = `You could ask questions like... What does ${cleanTitle} mean in simple words? How would we use ${cleanTitle} in real life? Could you show one more example?`;
    }
    
    // 4. Speak GPT-generated (or fallback) sample questions
    let sampleAudio = ttsCache.get(sampleText);
    if (!sampleAudio) {
      sampleAudio = await fetchTTS(sampleText);

### 21. docs/brain/timer-system.md (b7aa6681ad045e85a58422ec46641d948683a8b9be9eb4e041d2b6d83bd36742)
- bm25: -9.1581 | relevance: 0.9016

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

### 22. src/app/facilitator/generator/counselor/MentorThoughtBubble.jsx (7610893120095be9058a4544b09f487e55aedfefd17541089e3f2fed953b2499)
- bm25: -9.1350 | relevance: 0.9013

'use client'

import { useEffect, useState, useMemo } from 'react'

const PHASE_STYLES = {
  start: {
    bg: '#eef2ff',
    border: '#c7d2fe',
    text: '#312e81',
    dot: '#4338ca'
  },
  success: {
    bg: '#ecfdf5',
    border: '#a7f3d0',
    text: '#064e3b',
    dot: '#10b981'
  },
  error: {
    bg: '#fef2f2',
    border: '#fecaca',
    text: '#7f1d1d',
    dot: '#ef4444'
  },
  default: {
    bg: '#f3f4f6',
    border: '#e5e7eb',
    text: '#1f2937',
    dot: '#4b5563'
  }
}

const TOOL_LABELS = {
  search_lessons: 'Lesson Search',
  get_lesson_details: 'Lesson Review',
  generate_lesson: 'Lesson Generator',
  validate_lesson: 'Quality Check',
  improve_lesson: 'Lesson Polish',
  schedule_lesson: 'Calendar Update',
  edit_lesson: 'Lesson Editing',
  get_capabilities: 'Tool Check',
  get_conversation_memory: 'Memory Review',
  search_conversation_history: 'Conversation Search'
}

function formatLabel(name) {
  if (!name) return 'Mr. Mentor'
  return TOOL_LABELS[name] || name.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
}

/**
 * Floating thought bubble for Mr. Mentor status updates
 * @param {{ thought?: { id: string, message: string, name?: string, phase?: string } }} props
 */
export default function MentorThoughtBubble({ thought }) {
  const [visible, setVisible] = useState(false)

useEffect(() => {
    if (thought) {
      setVisible(true)
      return () => setVisible(false)
    }
    setVisible(false)
  }, [thought])

const style = useMemo(() => {
    if (!thought) return PHASE_STYLES.default
    return PHASE_STYLES[thought.phase] || PHASE_STYLES.default
  }, [thought])

const label = useMemo(() => formatLabel(thought?.name), [thought])

if (!thought) return null

### 23. docs/brain/tts-prefetching.md (05e6eff1863500855ddc6c183a5ac48103c48804c8f4dbabf875f31ef1a1e1db)
- bm25: -9.0451 | relevance: 0.9004

# TTS Prefetching System

## Overview

TTS (text-to-speech) prefetching eliminates 2-3 second waits between questions by loading question N+1 in the background while student answers question N. This was the main performance bottleneck identified by user after zombie code cleanup.

## How It Works

### Cache Architecture

**Module**: `src/app/session/utils/ttsCache.js` (212 lines)

**Core Components**:
- `TTSCache` class: Singleton instance exported as `ttsCache`
- LRU cache: Map-based storage with timestamp tracking
- MAX_CACHE_SIZE: 10 items (prevents memory issues during long sessions)
- Eviction: Oldest by timestamp when cache full

**Cache API**:
```javascript
ttsCache.get(text)           // Returns cached base64 audio or null
ttsCache.set(text, audio)    // Stores audio, evicts oldest if full
ttsCache.prefetch(text)      // Background fetch, fire-and-forget
ttsCache.clear()             // Cancels pending fetches, clears cache
ttsCache.cancelPrefetch(text) // Aborts specific pending request
```

### Integration Points

**1. speakFrontendImpl (page.js line ~2927)**
```javascript
// Check cache first
let b64 = ttsCache.get(text);

if (!b64) {
  // Cache miss - fetch from API
  setTtsLoadingCount((c) => c + 1);
  // ... fetch logic ...
  if (b64) {
    b64 = normalizeBase64Audio(b64);
    // Store successful fetch in cache
    ttsCache.set(text, b64);
  }
  setTtsLoadingCount((c) => Math.max(0, c - 1));
}
// else: cache hit - b64 already set, no loading indicator
```

Cache hits skip loading indicator entirely since audio is instant.

**2. Prefetch Triggers**

**After Comprehension Answer (page.js line ~5895)**:
```javascript
try { await speakFrontend(`${celebration}. ${progressPhrase} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}

### 24. src/app/api/webb-resources/route.js (646fc5525bc8ce35812dd96b483f22b47f860ce91463d76fe1e7f8ea4da5d51a)
- bm25: -8.5318 | entity_overlap_w: 1.30 | adjusted: -8.8568 | relevance: 0.8985

﻿/**
 * /api/webb-resources
 * Generates curated, child-safe media resources for a lesson.
 *
 * Video:   YouTube Data API v3 + GPT safety review of title/channel/description
 * Article: Fetches directly from Wikipedia REST APIs (Simple English first, then English)
 *          (srcdoc approach bypasses X-Frame-Options; no client-side fetching needed)
 *
 * POST { lesson, type: 'video'|'article'|'both', context? }
 * Returns:
 *   video?:   { embedUrl, title, channel, searchQuery }  — real playable embed
 *          OR { unavailable: true, searchQuery }          — no key / all rejected
 *   article?: { html, source, title }                    — ready for srcdoc iframe
 *          OR { html: null, source: null, title }        — all fetches failed
 */
import { NextResponse } from 'next/server'

const OPENAI_URL   = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'
const YT_SEARCH    = 'https://www.googleapis.com/youtube/v3/search'

// ── Wikipedia REST API sources (open, no-auth, work from cloud hosting) ───────
const WIKI_SOURCES = [
  {
    name: 'Simple English Wikipedia',
    url:  t => `https://simple.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(t.replace(/\s+/g, '_'))}`,
    base: 'https://simple.wikipedia.org',
  },
  {
    name: 'Wikipedia',
    url:  t => `https://en.wikipedia.org/api/rest_v1/page/mobile-html/${encodeURIComponent(t.replace(/\s+/g, '_'))}`,
    base: 'https://en.wikipedia.org',
  },
]

### 25. docs/brain/v2-architecture.md (fe3b9f85fd0c2ac0ea1bdb0dfecc4270568d1cd9a3aba24a6abf59dde77c0f05)
- bm25: -8.8029 | relevance: 0.8980

### ✅ Completed
- Feature flag check in `page.js` (lines 65-69)
- V2 stub component (`SessionPageV2.jsx`)
- Brain file documentation (this file)
- Manifest entry
- Changelog entry
- Q&A judging parity: Comprehension now matches V1 retry flow (hint, hint, reveal on 3rd) and does NOT advance on incorrect answers; Exercise/Worksheet match the same retry + reveal behavior; Test remains single-attempt grading with correct-answer reveal. SA/FIB route through `/api/judge-short-answer` with local fallback; MC/TF use V1-style local leniency (letters, TF synonyms).
- **AudioEngine component** (`src/app/session/v2/AudioEngine.jsx`) - 600 lines
  - Three playback paths: HTMLAudio (preferred), WebAudio (iOS), Synthetic (no audio)
  - Event-driven architecture (start, end, captionChange, captionsDone, error)
  - Single source of truth (no ref/state duplication)
  - Deterministic caption timing (one timer system)
  - Self-contained video coordination
  - Pause/resume support
  - Speech guard timeout
- **AudioEngine tests** (`AudioEngine.test.jsx`) - Unit tests + manual browser test helpers
- **PhaseOrchestrator component** (`src/app/session/v2/PhaseOrchestrator.jsx`) - 150 lines
  - Manages session phase flow: teaching → comprehension → closing
  - Owns phase state machine
  - Emits phaseChange, sessionComplete events
  - Consumes phase completion events
  - Zero knowledge of phase implementation details
- **ComprehensionPhase** - DEPRECATED (2026-01-03)
  - **No longer used** - comprehension is now handled inline in SessionPageV2
  - V2 uses V1's multi-question pattern instead of single-question class
  - Questions loaded from lesson pools: truefalse, multiplechoice, fillintheblank, shortanswer
  - Questions shuffled and limited to the learner's configured target
    - Source of trut

### 26. docs/brain/ZOMBIE-CODE-PREVENTION.md (ffbfcb380d918610c90bcd626a83877ab986646224bc1827192bdbf377449c31)
- bm25: -8.7612 | relevance: 0.8976

---

## Emergency Zombie Hunting

If bug keeps recurring despite fixes:

```powershell
# 1. Check what changelog claims was removed
cat docs/brain/changelog.md | Select-String "REMOVED"

# 2. Grep for supposedly removed code
rg "compPool|exercisePool" src/

# 3. If found, zombie code exists - do complete removal
```

---

## Commitment

**Future removals will:**
- Grep before claiming removal
- Use complete removal checklist
- Test that removed behavior actually gone
- Write honest changelog (specific locations, not aspirational claims)
- Tag before removal for safe revert

**This prevents:**
- Recurring bugs from incomplete removals
- Dual architectures from zombie fallback
- Wasted time re-fixing "solved" issues
- Changelog lying about what was done

### 27. docs/brain/lesson-assessment-architecture.md (5dccca68690e76ebf6304c04031b2247c3147c808c00cf493f371dc78369dad1)
- bm25: -8.7295 | relevance: 0.8972

No fallbacks. No pool slicing. No refill logic. If index exceeds array length, phase is complete.

### Test Phase Responsiveness

- `handleGoTest` keeps `canSend` true while the first question TTS plays, so MC/TF buttons render immediately even during audio playback.
- `speakingLock` is bypassed when `phase === 'test' && subPhase === 'test-active'`, allowing quick-answer controls to stay visible while Ms. Sonoma is speaking.
- After each test answer, `testActiveIndex` advances and `canSend` is re-enabled before feedback/next-question TTS finishes, so learners can answer the next item without waiting for audio to end.

### Storage Keys

localStorage uses lesson-specific keys:
- `session_comprehension_${lessonParam}` - Comprehension questions
- `session_exercise_${lessonParam}` - Exercise questions  
- `session_worksheet_${lessonParam}` - Worksheet questions
- `session_test_${lessonParam}` - Test questions
- `session_comprehension_index_${lessonParam}` - Progress in Comprehension
- `session_exercise_index_${lessonParam}` - Progress in Exercise

When lesson changes, new keys are used automatically (old lesson arrays stay in storage but are not loaded).

## What NOT To Do

### ❌ Don't add pool states
Arrays are the only source. No backup buckets.

### ❌ Don't add fallback logic to question selection
If array[index] is undefined, phase is complete. Don't try to refill from anywhere.

### ❌ Don't regenerate arrays on every render
Arrays are generated ONCE per lesson load (either fresh or restored from localStorage). Only refresh button triggers regeneration.

### ❌ Don't do partial localStorage restore
Either restore all 4 arrays (full match) or regenerate all 4 (any mismatch). Never restore some arrays and regenerate others.

### 28. src/app/session/v2/ExercisePhase.jsx (c340edc107843e2e2f6afbcb8783da97fdfabf58588ce778365df1a7a63c3252)
- bm25: -8.6989 | relevance: 0.8969

/**
 * ExercisePhase - Multiple choice and true/false questions with scoring
 * 
 * Consumes AudioEngine for question playback.
 * Manages question progression and score tracking.
 * Zero coupling to session state or other phases.
 * 
 * Architecture:
 * - Loads exercise questions from lesson data
 * - Plays each question with TTS
 * - Prefetches N+1 question during N playback (eliminates wait times)
 * - Presents multiple choice or true/false options
 * - Validates answers and tracks score
 * - Emits exerciseComplete with results
 * 
 * Usage:
 *   const phase = new ExercisePhase({ audioEngine, questions });
 *   phase.on('exerciseComplete', (results) => saveScore(results));
 *   await phase.start();
 */

import { fetchTTS } from './services';
import { ttsCache } from '../utils/ttsCache';
import { buildAcceptableList, judgeAnswer } from './judging';
import { deriveCorrectAnswerText, formatQuestionForSpeech } from '../utils/questionFormatting';
import { HINT_FIRST, HINT_SECOND, pickHint } from '../utils/feedbackMessages';

// V1 praise phrases for correct answers
const PRAISE_PHRASES = [
  'Great job!',
  'Excellent!',
  'You got it!',
  'Nice work!',
  'Well done!',
  'Perfect!',
  'Awesome!',
  'Fantastic!'
];

// Intro phrases for phase start (V1 pacing pattern)
const INTRO_PHRASES = [
  "Time for some practice questions.",
  "Let's try some exercises.",
  "Ready to practice?",
  "Let's see how much you know."
];

### 29. scripts/add-cohere-style-chronograph.sql (2ecda6479662dc71f15f2404518b13c1ace4c06325e94532b2386c1966e16536)
- bm25: -8.6985 | relevance: 0.8969

-- 4) Derived, versioned memory
create table if not exists public.user_goal_versions (
  goal_version_id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(tenant_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sector text not null check (sector in ('child','adult','both')),
  ts timestamptz not null default now(),
  goals_json jsonb not null,
  source_event_ids uuid[] not null default '{}'::uuid[],
  supersedes_goal_version_id uuid null
);

### 30. src/app/session/v2/TeachingController.jsx (bec95c63e9b269e3320bea2e6ac038932dc35bbf46baf90975e74fdfe6ed0ec0)
- bm25: -8.6910 | relevance: 0.8968

const fullLessonJson = (() => {
      try {
        return JSON.stringify(this.#lessonData || {});
      } catch {
        return '';
      }
    })();
    
    const vocabContext = terms.length > 0 
      ? `Use these vocabulary words naturally in your examples: ${terms.join(', ')}.`
      : '';
    
    const instruction = [
      `Grade: ${grade}`,
      `Lesson (do not read aloud): "${lessonTitle}"`,
      '',
      'No intro: Do not greet or introduce yourself; begin immediately with the examples.',
      `Examples: Show 2-3 tiny worked examples appropriate for this lesson. If needed to cover all question content, you may show up to 5 tiny examples. ${vocabContext} You compute every step. Be concise, warm, and playful. Do not add definitions or broad explanations. Give only the examples.`,
      '',
      teachingNotes ? `Teaching notes: ${teachingNotes}` : '',
      '',
      'Full lesson JSON (internal; do not read aloud). This includes the questions used for assessment:',
      fullLessonJson ? fullLessonJson : '(missing lesson json)',
      '',
      'Assessment linkage (CRITICAL): The learner will be assessed using the questions in the lesson JSON (comprehension, exercise, worksheet, and test).',
      'Reverse-engineer those questions into your examples so the learner is prepared to answer every question.',
      'Internal self-check (do not output): mentally map every lesson question to at least one example. If any question is not covered, revise the examples until it is.',
      '',
      'CRITICAL ACCURACY: All examples must be correct. Verify accuracy before presenting.',
      '',
      'Kid-friendly: Use simple everyday words. Keep sentences short (about 6-12 words). One idea per sentence.',
      '',
      'Always respond with natural spoken text only.

### 31. src/app/session/page.js (2423470dcc1c27a7695d8ae0bc68bc217353b138a764c3921090fa04db9af017)
- bm25: -8.6612 | relevance: 0.8965

// Disable sending when the UI is not ready or while Ms. Sonoma is speaking
  const comprehensionAwaitingBegin = (phase === 'comprehension' && subPhase === 'comprehension-start');
  // Allow answering Test items while TTS is still playing so buttons appear immediately
  const speakingLock = (phase === 'test' && subPhase === 'test-active') ? false : !!isSpeaking;
  // Derived gating: when Opening/Go buttons are visible, keep input inactive without mutating canSend
  const discussionButtonsVisible = (
    phase === 'discussion' &&
    subPhase === 'awaiting-learner' &&
    (!isSpeaking || captionsDone) &&
    showOpeningActions &&
    askState === 'inactive' &&
    riddleState === 'inactive' &&
    poemState === 'inactive' &&
    fillInFunState === 'inactive'
  );
  const inQnAForButtons = (
    (phase === 'comprehension' && subPhase === 'comprehension-active') ||
    (phase === 'exercise' && (subPhase === 'exercise-start' || subPhase === 'exercise-active')) ||
    (phase === 'worksheet' && subPhase === 'worksheet-active') ||
    (phase === 'test' && subPhase === 'test-active')
  );
  const qnaButtonsVisible = (
    inQnAForButtons && !isSpeaking && showOpeningActions &&
    askState === 'inactive' && riddleState === 'inactive' && poemState === 'inactive' && storyState === 'inactive' && fillInFunState === 'inactive'
  );
  const buttonsGating = discussionButtonsVisible || qnaButtonsVisible;
  // Story and Fill-in-Fun input should also respect the speaking lock
  const storyInputActive = (storyState === 'awaiting-turn' || storyState === 'awaiting-setup');
  const fillInFunInputActive = (fillInFunState === 'collecting-words');
  const sendDisabled = (storyInputActive || fillInFunInputActive) ? (!canSend || loading || speakingLock) : (!canSend || loading || comprehensionAwai

### 32. docs/brain/riddle-system.md (ae2321e7086261f3e5b2eaf607b46e848c65c93273f6674224f4718b92f00026)
- bm25: -8.6285 | relevance: 0.8961

---

## What NOT To Do

### ❌ Don't Generate Riddles via AI
The system is **intentionally static**. Adding AI generation would:
- Create quality inconsistencies
- Risk inappropriate content slipping through
- Add latency and API costs
- Break offline functionality

### ❌ Don't Use Riddles as Comprehension Tests
Riddles are **warm-up fun**, not assessment. They:
- Have single answers (not open-ended)
- Reward lateral thinking (not lesson content mastery)
- Are optional enrichment (not required learning)

### ❌ Don't Add Riddles Without Validation
Every riddle must pass the checklist:
- [ ] Wordplay or misdirection present
- [ ] Single clear answer (no ambiguity)
- [ ] Age-appropriate (6-12 year olds)
- [ ] Subject-relevant (if not in 'general')
- [ ] Fair clues (solvable without guessing)
- [ ] Surprise factor (smile, groan, or "aha!")

### ❌ Don't Mix Quiz Questions into Riddles
**Bad**: "How many cents are in a quarter?" (factual recall)  
**Good**: "I am a coin that is one fourth of a dollar, but I hold much more inside - count them all! How many pennies hide in me?" (wordplay + math)

---

## Current Integration Status

### ✅ Riddles Are Active

Riddles are fully integrated into the discussion phase opening actions:

**User Flow:**
1. Learner enters discussion phase
2. Opening actions menu displays (Ask, Riddle, Poem, Story, Fill-in-Fun, Games)
3. User clicks "Riddle" button
4. `pickNextRiddle(subject)` selects riddle from localStorage rotation
5. Riddle presents with TTS playback
6. State machine handles: 'presented' → 'awaiting-solve' → 'inactive'

### 33. docs/brain/lesson-assessment-architecture.md (c2bb45b2d56241d3d8fd623e8d666b181907464ee2958f4c3fb8e62fc0a646d7)
- bm25: -8.6225 | relevance: 0.8961

# Lesson Assessment Architecture

## How It Works

### Core Design: Arrays as Source of Truth

When a student loads a lesson, the system generates 4 shuffled question arrays that represent their progress through that lesson:

1. **generatedComprehension** - Questions for Comprehension phase (Ask/Feedback)
2. **generatedExercise** - Questions for Exercise phase (interactive practice)
3. **generatedWorksheet** - Questions for Worksheet phase (PDF printable)
4. **generatedTest** - Questions for Test phase (final assessment)

These arrays are **the canonical source of progress**. They persist across browser sessions via localStorage, ensuring:
- Same shuffled order when student returns to lesson
- Student picks up right where they left off
- Consistent question sequence across all 4 phases unless refresh button clicked

### Data Flow

```
Supabase lesson file (questions array)
  ↓
buildQAPool (shuffle with crypto-random)
  ↓
4 generated arrays (ONE TIME on lesson load)
  ↓
localStorage (persist after generation/restore on load)
  ↓
Phase rendering (use arrays[phaseIndex])

### Question Mix (80/20)

- Each phase array targets roughly 80% Multiple Choice/True-False (primary) and 20% Fill-in-the-Blank/Short Answer (secondary).
- Comprehension is blended first, then Exercise is blended from the remainder to avoid duplicate questions between the two phases.
- Worksheet and Test arrays each blend independently using the same 80/20 rule.
- If a category is short (e.g., not enough MC/TF), the blender backfills from whatever remains so targets are still met.
```

### Lesson Data State

### 34. src/app/session/v2/TimerService.jsx (ed20e524fb391c98e412107adfaaf937c32ebd58a07e4cce4980ec297dcee03b)
- bm25: -8.5916 | relevance: 0.8957

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

### 35. src/app/api/webb-resources/route.js (0111c5f2319b3aefb51eb0badfbe0ef11254fb7617fca39ce1dfa0b31c3d392e)
- bm25: -8.1835 | entity_overlap_w: 1.30 | adjusted: -8.5085 | relevance: 0.8948

const picked = items[pickedIdx]
        if (picked?.id?.videoId) {
          return {
            embedUrl:    `https://www.youtube-nocookie.com/embed/${picked.id.videoId}?autoplay=0&rel=0&modestbranding=1`,
            title:       picked.snippet.title,
            channel:     picked.snippet.channelTitle,
            searchQuery: safeQuery,
          }
        }
      }
    } catch { /* fall through */ }
  }

return { unavailable: true, searchQuery: safeQuery }
}

// ── Generate article resource ─────────────────────────────────────────────────
// Directly fetches from Wikipedia REST APIs — no GPT call needed since the
// lesson title IS the Wikipedia article title. Tries Simple English Wikipedia
// first (4th–6th grade level), falls back to regular Wikipedia.
// Alternates which source comes first based on previousSource so refreshes
// show a genuinely different article.
async function generateArticle(title, prevSrc = '') {
  // If we just showed Simple Wikipedia, try regular Wikipedia first this time
  const sources = (prevSrc === 'Simple English Wikipedia')
    ? [WIKI_SOURCES[1], WIKI_SOURCES[0]]
    : WIKI_SOURCES

for (const src of sources) {
    try {
      const r = await fetch(src.url(title), {
        headers: { 'Api-User-Agent': 'EducationApp/1.0 (freehands; educational-app)' },
        signal: AbortSignal.timeout(8000),
      })
      if (r.ok) {
        let html = await r.text()
        html = html.includes('<head>')
          ? html.replace('<head>', `<head><base href="${src.base}">`)
          : `<base href="${src.base}">${html}`
        return { html, source: src.name, title }
      }
    } catch { /* try next source */ }
  }

return { html: null, source: null, title }
}

### 36. docs/brain/ingests/pack.lesson-schedule-debug.md (ad20eff4e904d8995eccbb946f2672066064415df69faa51d33c27ceb72261bb)
- bm25: -8.4884 | relevance: 0.8946

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

### 37. src/app/session/v2/TeachingController.jsx (f0ec284303c6d7b6a0da9176f085aa73c6e42dd010180ec67bc10060b513279c)
- bm25: -8.1023 | entity_overlap_w: 1.30 | adjusted: -8.4273 | relevance: 0.8939

return ['I had trouble loading the examples.'];
  }
  
  // Private: Fetch gate prompt sample questions from GPT
  async #fetchGatePromptFromGPT(stage) {
    const lessonTitle = this.#lessonMeta?.lessonTitle || this.#lessonData?.title || 'this topic';
    const subject = this.#lessonMeta?.subject || 'math';
    const difficulty = this.#lessonMeta?.difficulty || 'medium';
    
    const stageLabel = stage === 'definitions' ? 'vocabulary definitions' : 'examples';
    
    const instruction = [
      `The lesson is "${lessonTitle}".`,
      `We just covered ${stageLabel}.`,
      'Generate 2-3 short example questions a child might ask about this topic.',
      'Start with: "You could ask questions like..."',
      'Then list the questions briefly and naturally.',
      'Keep it very short and friendly.',
      'Do not answer the questions.',
      'Kid-friendly style rules: Use simple everyday words a 5-7 year old can understand. Keep sentences short (about 6-12 words).',
      'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, or symbols.'
    ].join(' ');
    
    try {
      const response = await fetch('/api/sonoma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction,
          input: '',
          context: {
            phase: 'teaching',
            subject,
            difficulty,
            lessonTitle,
            step: 'gate-example-questions',
            stage
          },
          skipAudio: true
        })
      });
      
      if (!response.ok) return null;
      const data = await response.json();
      return data.reply || data.text || null;
    } catch (err) {
      console.error('[TeachingController] Gate pr

### 38. src/app/facilitator/generator/counselor/MentorInterceptor.js (4d53e26a5bb1e862edb14db504e81f475e0fe906b3f0532c196c7549595adb20)
- bm25: -8.4157 | relevance: 0.8938

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

### 39. docs/brain/ingests/pack.mrmentor-calendar-overlay.md (9dd93d6c47df89070d11415ad0908937088b52245fa78b48942a20a9ef02bd8f)
- bm25: -8.4007 | relevance: 0.8936

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

### 40. docs/brain/ingests/pack.lesson-schedule-debug.md (7aa4377a1d4f413b238ad3c2127d6ba606c78ec83ed2cf7a396b5b8ca335c91b)
- bm25: -8.3187 | relevance: 0.8927

// Intent detection patterns
const INTENT_PATTERNS = {
  search: {
    keywords: ['find', 'search', 'look for', 'show me', 'do you have', 'what lessons'],
    confidence: (text) => {
      const normalized = normalizeText(text)
      return INTENT_PATTERNS.search.keywords.some(kw => normalized.includes(kw)) ? 0.8 : 0
    }
  },
  
  generate: {
    keywords: ['generate', 'create', 'make', 'build', 'new lesson'],
    confidence: (text) => {
      const normalized = normalizeText(text)
      
      // Check if it's an FAQ-style question about generation (how to)
      const faqPatterns = ['how do i', 'how can i', 'how to', 'what is', 'explain', 'tell me about']
      if (faqPatterns.some(p => normalized.includes(p))) {
        return 0 // Defer to FAQ intent
      }
      
      return INTENT_PATTERNS.generate.keywords.some(kw => normalized.includes(kw)) ? 0.8 : 0
    }
  },
  
  schedule: {
    keywords: ['schedule', 'add to calendar', 'put on', 'assign for', 'plan for'],
    confidence: (text) => {
      const normalized = normalizeText(text)
      
      // Check if it's an FAQ-style question about scheduling (how to)
      const faqPatterns = ['how do i', 'how can i', 'how to', 'what is', 'explain', 'tell me about']
      if (faqPatterns.some(p => normalized.includes(p))) {
        return 0 // Defer to FAQ intent
      }
      
      return INTENT_PATTERNS.schedule.keywords.some(kw => normalized.includes(kw)) ? 0.8 : 0
    }
  },


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
