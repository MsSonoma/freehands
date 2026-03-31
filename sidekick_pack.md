# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Mr Slate print page at end of lesson with answers and transcript of right and wrong answers, similar to Ms. Sonoma print
```

Filter terms used:
```text
slate
print
page
end
lesson
answers
transcript
right
wrong
similar
sonoma
```

---

## Recent Session Context (last recon prompts)

These are previous recon prompts from the same session. Use them to orient yourself if the conversation was interrupted or summarised.

- `2026-03-25 09:49` — Mrs Webb intercept user message black screen video doesn't play YouTube blocked screen time parental controls -- where d
- `2026-03-25 11:03` — Mrs Webb essay creation verbatim child writing polish editing prompt
- `2026-03-25 12:45` — Mr. Slate page - give correct answer on timeout, currently only does on incorrect answer

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

Pack chunk count (approximate): 50. Threshold for self-recon: < 3.

---
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

slate print page end lesson answers transcript right wrong similar sonoma

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/page.js (3751cb5a7052e63d8809b5bb81651728cf2c1a9914282c18d95eb237281a6f1d)
- bm25: -14.0686 | relevance: 0.9336

function PhaseDetail({
  phase,
  subPhase,
  subPhaseStatus,
  onDiscussionAction,
  onTeachingAction,
  learnerInput,
  setLearnerInput,
  worksheetAnswers,
  setWorksheetAnswers,
  testAnswers,
  setTestAnswers,
  callMsSonoma,
  subjectParam,
  difficultyParam,
  lessonParam,
  setPhase,
  setSubPhase,
  ticker,
  setTicker,
  setCanSend,
  waitForBeat,
  transcript,
}) {
  const renderSection = () => {
    switch (phase) {
      case "discussion":
        // Controls and status for discussion are handled elsewhere; render nothing here.
        return null;
      case "teaching":
        // Controls and status for teaching are handled elsewhere; render nothing here.
        return null;
      case "comprehension":
        return (
          <div style={{ marginBottom: 24 }}>
            <p style={{ margin: 0 }}>Correct Answers: {ticker}</p>
            <p style={{ fontSize: 13, color: '#374151', marginTop: 6 }}>
              Continue responding in the input; Ms. Sonoma will ask the next question automatically until the target is met.
            </p>
          </div>
        );
      case "worksheet":
        return (
          <div style={{ marginBottom: 24 }}>
            <p>Worksheet progress: {worksheetAnswers.length}</p>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={async () => {
                const nextTicker = ticker + 1;
                setTicker(nextTicker);
                setWorksheetAnswers([...worksheetAnswers, learnerInput]);
                const result = await callMsSonoma(
                  "Worksheet: Remind to print, give hints if incorrect, cue next phase at target count.",
                  learnerInput,
                    {
                    phase: "worksheet",

### 2. src/app/session/slate/page.jsx (ba7c0227cd70ec91b8fe4df6a1987559e149451f5cef862a2121df7583bba8b0)
- bm25: -12.7483 | relevance: 0.9273

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

### 3. src/app/session/slate/page.jsx (6d4f0be027b99894c72b4cbc67d18d41f49bae41e5ca2346179172eb2a457752)
- bm25: -12.2240 | relevance: 0.9244

const GREETING_MSGS = [
  'Time to run some drills.',
  'Let the drill begin.',
  'Drill sequence initiated.',
  'Ready for your first query.',
  'Systems online. First question loading.',
  'Activating drill protocol.',
  'Stand by. Loading first query.',
  'Drill mode engaged. Let us begin.',
  'Prepare for query processing.',
  'Commencing drill sequence now.',
  'Drill protocol active. Here we go.',
]
const CORRECT_MSGS = [
  'Affirmative. Correct response.',
  'Confirmed correct.',
  'Accurate. Score updated.',
  'Correct. Processing next query.',
  'Response accepted.',
  'Input validated. Correct.',
  'Excellent. Moving on.',
  'That is correct.',
  'Right answer confirmed.',
  'Positive match detected.',
  'Score increment registered.',
]
const WRONG_MSGS = [
  'Negative. Incorrect response.',
  'Error. Wrong answer detected.',
  'Incorrect.',
  'Does not match expected output.',
  'Incorrect response recorded.',
  'Mismatch detected.',
  'Negative. Try harder next time.',
  'That is not the correct answer.',
  'Error code: wrong answer.',
  'Recalibrate. The answer was wrong.',
  'Wrong. Score deducted.',
]
const TIMEOUT_MSGS = [
  'Time limit exceeded. No response.',
  'Query timeout. Moving on.',
  'Response not received in time.',
  'Time expired. Next query.',
  'Timeout recorded. Stay faster.',
  'Response window closed.',
  'No input detected. Advancing.',
  'Time is up. Focus.',
  'Clock ran out. Next query loading.',
  'Too slow. Speed up your recall.',
  'Timeout. We do not wait.',
  'Response overdue. Proceeding.',
  'Timer zeroed. No credit awarded.',
  'You ran out of time on that one.',
  'Processing halted. Time limit reached.',
  'That one slipped by. Stay sharp.',
  'No answer in time. Noted.',
  'Timeout flagged. Keep your pace.',
  'The clock

### 4. docs/brain/mr-mentor-conversation-flows.md (8d38642aa37f8b8a7e6bd2d6e130151a77c5668c362ce9ff98a5f6a237c14f91)
- bm25: -12.1303 | relevance: 0.9238

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

### ❌ DON'T Lock Users Into Parameter Collection
```
User: "4th grade Language Arts"
Mr. Mentor: "What difficulty level?"
User: "I don't know that yet. Stop trying to generate the lesson and give me advice."
Mr. Mentor: "Please choose: beginner, intermediate, or advanced."

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

### 5. docs/brain/ingests/pack.md (b7db843ee1cf3e6960f94dbc37cf05a90870bc341c1e61e9c94d94dc5ea1e78f)
- bm25: -11.2630 | relevance: 0.9185

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

### 6. src/app/session/v2/SessionPageV2.jsx (649df07e3ebe3afd9d7e7eccef738a2f718eb3d080765cd15100ec7a9bb69e49)
- bm25: -10.8440 | relevance: 0.9156

const learnerId = learnerProfile?.id || (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null);
      // Do NOT clear persisted assessment pools here.
      // Requirement: pools reset only via Print -> Refresh or lesson completion + explicit restart.
      
      // Save medal if test was completed
      if (testGrade?.percentage != null && learnerId && lessonKey) {
        try {
          await upsertMedal(learnerId, goldenKeyLessonKey || lessonKey, testGrade.percentage);
          addEvent(`🏅 Medal saved: ${testGrade.percentage}%`);
        } catch (err) {
          console.error('[SessionPageV2] Failed to save medal:', err);
        }
      }
      
      // Save transcript segment to mark lesson as completed
      if (learnerId && learnerId !== 'demo' && lessonId && transcriptLines.length > 0) {
        try {
          const learnerName = learnerProfile?.name || (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || null;
          const startedAt = startSessionRef.current || new Date().toISOString();
          const completedAt = new Date().toISOString();
          
          await appendTranscriptSegment({
            learnerId,
            learnerName,
            lessonId,
            lessonTitle: lessonData?.title || lessonId,
            segment: { startedAt, completedAt, lines: transcriptLines },
            sessionId: browserSessionId || undefined,
          });
          addEvent('📝 Transcript saved');
        } catch (err) {
          console.error('[SessionPageV2] Failed to save transcript:', err);
        }
      }
      
      // Pass golden key earned status for notification on lessons page
      const earnedKey = (goldenKeysEnabledRef.current !== false)
        ? (timerServiceRef.current?.getGoldenKeySta

### 7. docs/brain/tts-prefetching.md (20cc073772503cfe6baaa7bda436dd53dc02fbe589fd39e4fcad508f79f39b46)
- bm25: -10.8203 | relevance: 0.9154

**DON'T cache indefinitely**
- LRU eviction at 10 items prevents memory growth
- Phase transitions clear cache (old phase audio irrelevant)

**DON'T prefetch more than one question ahead**
- Student might skip, fail, or use hint - next question unpredictable
- Better to prefetch N+1 after each answer than N+2..N+10 upfront

**DON'T trust question order without increment tracking**
```javascript
// WRONG - currentCompIndex already incremented, so array[currentCompIndex] is N+2 not N+1
const nextProblem = generatedComprehension[currentCompIndex];
setCurrentCompIndex(currentCompIndex + 1);
await speakFrontend(nextProblem);
ttsCache.prefetch(generatedComprehension[currentCompIndex]); // N+2!

// RIGHT - prefetch from same index that will be used next
const nextProblem = generatedComprehension[currentCompIndex];
setCurrentCompIndex(currentCompIndex + 1);
await speakFrontend(nextProblem);
// currentCompIndex now points to N+1 (just incremented)
ttsCache.prefetch(generatedComprehension[currentCompIndex]);
```

## Related Brain Files

- **[ms-sonoma-teaching-system.md](ms-sonoma-teaching-system.md)** - TTS integrates with Ms. Sonoma teaching flow and phase transitions

## Key Files

**Core Module**:
- `src/app/session/utils/ttsCache.js`: TTSCache class, LRU cache, prefetch logic

### 8. src/app/session/hooks/useDiscussionHandlers.js (7be01249aa3dede88fdd9756fbda8fd5fed5a2c477980961af851344d51ff9f9)
- bm25: -10.5994 | relevance: 0.9138

/**
 * useDiscussionHandlers.js
 * Custom hook managing all Discussion phase interactive features:
 * - Jokes
 * - Riddles (with hint/reveal)
 * - Poems
 * - Stories (collaborative storytelling)
 * - Fill-in-Fun (word game similar to Mad Libs)
 * - Ask Questions (learner can ask Ms. Sonoma questions)
 */

import { useCallback } from 'react';
import { splitIntoSentences, mergeMcChoiceFragments, enforceNbspAfterMcLabels } from '../utils/textProcessing';
import { normalizeBase64Audio } from '../utils/audioUtils';
import { ensureQuestionMark, formatQuestionForSpeech } from '../utils/questionFormatting';
import { pickNextJoke, renderJoke } from '@/app/lib/jokes';
import { pickNextRiddle, renderRiddle } from '@/app/lib/riddles';
import { getGradeAndDifficultyStyle } from '../utils/constants';

### 9. src/app/session/slate/page.jsx (b3f2ec7396f2a6e87ee433aae2f69e92ea94620a643afa65e3f113ae289fa1db)
- bm25: -10.4821 | relevance: 0.9129

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

### 10. src/app/HeaderBar.js (3a962067f6624b759d881b562fe629c21b2a21c024dd8fc5d24581931279db77)
- bm25: -10.4557 | relevance: 0.9127

{/* Right navigation */}
				<nav style={{ width: navWidth, display:'flex', gap:16, justifyContent:'flex-end', alignItems:'center', position:'relative' }}>
					{showHamburger ? (
						<>
							<button
								ref={navToggleRef}
								type="button"
								aria-label={navOpen ? 'Close menu' : 'Open menu'}
								aria-expanded={navOpen}
								aria-controls="mobile-nav-menu"
								onClick={() => setNavOpen(v => !v)}
								style={{
									background:'#111827', color:'#fff', border:'none', width:36, height:36,
									display:'inline-flex', alignItems:'center', justifyContent:'center', borderRadius:10, cursor:'pointer',
									boxShadow:'0 2px 6px rgba(0,0,0,0.25)'
								}}
							>
								{/* Hamburger / Close icon */}
								{!navOpen ? (
									<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<path d="M3 6h18"/>
										<path d="M3 12h18"/>
										<path d="M3 18h18"/>
									</svg>
								) : (
									<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
										<path d="M18 6L6 18"/>
										<path d="M6 6l12 12"/>
									</svg>
								)}
							</button>
							{navOpen && (
								<div
									id="mobile-nav-menu"
									ref={navMenuRef}
									role="menu"
									style={{ position:'fixed', right: (pathname.startsWith('/session') && !isMobileLandscape) ? '4%' : 8, top: `calc(${headerHeight} + 8px)`, background:'#fff', border:'1px solid #e5e7eb', borderRadius:12, boxShadow:'0 10px 30px rgba(0,0,0,0.15)', minWidth:200, zIndex:1300, overflow:'visible' }}
								>
									{/* Print dropdown with nested menu (only on session page) */}
									{pathna

### 11. docs/brain/story-feature.md (7c541082fb751d8b6d7c2be9019d9fcda07911dd69b371791d357908ef1d85e5)
- bm25: -10.3563 | relevance: 0.9119

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

### 12. docs/brain/ingests/pack.md (ba535074b2f0f77bd019d7cbc5af650b25c0a1324c4e30da69008dc9db4c053b)
- bm25: -10.2331 | relevance: 0.9110

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

### 13. docs/brain/snapshot-persistence.md (1124fa71ece86ec048aaeef637c7cf577508731d10f3802149bc448806e41006)
- bm25: -10.2276 | relevance: 0.9109

**Event-Driven Print:**
- HeaderBar emits `ms:print:worksheet`, `ms:print:test`, `ms:print:combined`, `ms:print:refresh`.
- SessionPageV2 useEffect wires listeners that call download handlers (worksheet/test PDFs, facilitator key) or refresh (clear cached sets + assessments store).
- Download handlers are PIN-gated via `ensurePinAllowed('download')` and use a local `createPdfForItems` helper (jsPDF) with a share/preview fallback.

**Refresh Behavior:**
- `ensurePinAllowed('refresh')` → `clearAssessments(lessonKey, learnerId)` → clear cached sets. Next print regenerates from lesson pools using current learner targets.

**Layout Rules:**
- PDF generation auto-selects the largest body font that fits the worksheet/test content on a single page (available height = page height minus top/bottom margins). Range: 8–18pt; headers are capped at 20pt.
- If the content cannot fit even at the minimum size, the generator keeps 8pt and spills to additional pages with guarded page breaks (bottom margin respected). Choices render slightly smaller than prompts and indent by 6pt.
- Worksheet spacing is compact (spacer ≈ 0.35× body font, min 3pt); Test uses wider spacing (≈0.7× body font, min 4pt) to keep pages balanced while filling available space.

### Key Files

- `src/app/session/v2/SessionPageV2.jsx` – cached assessment load/save, worksheet/test builders, jsPDF helpers, ms:print listeners, refresh handler.
- `src/app/session/assessment/assessmentStore.js` – dual-write persistence for assessment sets.
- `src/app/HeaderBar.js` – dispatches ms:print events from the hamburger/print menu.

### 14. docs/brain/story-feature.md (18412a469aaf571ad2790e5068e6ed053af12472994adfc7e85b37d3931d6288)
- bm25: -10.1928 | relevance: 0.9107

# Story Feature (Continuous Narrative)

## How It Works

The story feature creates a continuous narrative that progresses across all four phases (Teaching, Comprehension, Exercise, Worksheet, and Test). Instead of starting fresh each time, the story builds on itself throughout the session.

### Story Setup Phase (Initial Creation)

When a child first clicks "Story" in any phase, Ms. Sonoma asks three setup questions:
1. **"Who are the characters in the story?"** - Child responds with characters
2. **"Where does the story take place?"** - Child responds with setting
3. **"What happens in the story?"** - Child responds with plot elements

After collecting all three pieces, Ms. Sonoma tells the **first part** of the story using all setup information, ending with **"To be continued."**

### Story Continuation Across Phases

- Story transcript is **preserved** across phase changes
- Each time child clicks "Story" in subsequent phase:
  - Ms. Sonoma **reminds them where story left off** (first sentence only)
  - Asks **"What would you like to happen next?"**
  - Suggests possibilities (AI-generated)
  - Continues story based on their input
  - Ends with **"To be continued."**

### Story Ending in Test Phase

- In Test phase specifically, prompt changes
- Ms. Sonoma asks: **"How would you like the story to end?"**
- Child describes desired ending
- Ms. Sonoma ends story based on their idea, concluding with **"The end."**
- Happy Ending and Funny Ending buttons removed

### Story Direction Following

- API instructions emphasize: **"Follow the child's ideas closely and make the story about what they want unless it's inappropriate."**
- Ms. Sonoma stays on track with child's vision instead of redirecting
- Only inappropriate content triggers redirection

### Story Availability

### 15. src/app/session/slate/page.jsx (4187c15101bc19a9776d811c06dd3cdf687000266b4efe08107c9e58e3f49555)
- bm25: -10.1858 | relevance: 0.9106

const SETTINGS_CONFIG = [
  { label: 'SCORE GOAL',        key: 'scoreGoal',    min: 3,  max: 30,  fmt: v => `${v} pts` },
  { label: 'CORRECT ANSWER',    key: 'correctPts',   min: 1,  max: 5,   fmt: v => `+${v} pt${v !== 1 ? 's' : ''}` },
  { label: 'WRONG ANSWER',      key: 'wrongPts',     min: 0,  max: 5,   fmt: v => v === 0 ? '\u00b10' : `\u2212${v} pt${v !== 1 ? 's' : ''}` },
  { label: 'TIMEOUT PENALTY',   key: 'timeoutPts',     min: 0,  max: 5,   fmt: v => v === 0 ? '\u00b10' : `\u2212${v} pt${v !== 1 ? 's' : ''}` },
  { label: 'TIMEOUT OFFSET',    key: 'timeoutOffset',  min: 0,  max: 5,   fmt: v => v === 0 ? 'none' : `${v} free` },
  { label: 'TIME PER QUESTION', key: 'questionSecs',   min: 5,  max: 120, fmt: v => `${v}s` },
]
const SLATE_VIDEO_SRC = '/media/Mr.%20Slate%20Suit.mp4'

### 16. src/app/session/slate/page.jsx (3180232d4daf1db50af479b0d7660fb657c60aea16e43f724e28c10245b9173c)
- bm25: -10.1501 | relevance: 0.9103

{/* Owned tab — lesson cards only (filters/count are in controls strip) */}
                {listTab === 'owned' && (
                  ownedList.length === 0 ? (
                    <div style={{ color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 32, letterSpacing: 1 }}>NO LESSONS MATCH FILTERS</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ownedList.map((l, i) => <LessonCard key={getLk(l) || i} lesson={l} />)}
                    </div>
                  )
                )}
                </div>{/* end scrollable list */}
              </>
            )
          })()}
        </div>

### 17. src/app/learn/page.js (8763c06c7c6f8bc95a4e9ccdcf5dc75d7ba7d1a2c3b9abb20a25a0cb801ce11a)
- bm25: -10.1326 | relevance: 0.9102

{noLearner ? (
          <div style={{ margin:'8px auto 16px', maxWidth:420 }}>
            <p style={{ marginTop:0 }}>Pick a Learner to continue:</p>
            <LearnerSelector onSelect={(l)=> {
              setLearner({ id: l.id, name: l.name })
              try {
                localStorage.setItem('learner_id', l.id)
                localStorage.setItem('learner_name', l.name)
                if (l.grade) localStorage.setItem('learner_grade', l.grade)
              } catch {}
            }} />
          </div>
        ) : (
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <button
              onClick={goToLessons}
              title="Practice lessons guided by Ms. Sonoma"
              style={{
                padding:'14px 20px', 
                border:'2px solid #c7442e', 
                borderRadius:12,
                fontSize:16, 
                fontWeight:700,
                background:'#c7442e',
                color:'#fff',
                cursor:'pointer',
                width:'100%', 
                maxWidth:320
              }}
            >
              👩🏻‍🦰 Ms. Sonoma
            </button>
            <button
              onClick={() => r.push('/session/slate')}
              title="Drill questions with Mr. Slate"
              style={{
                padding:'14px 20px', 
                border:'2px solid #6366f1', 
                borderRadius:12,
                fontSize:16, 
                fontWeight:700,
                background:'#6366f1',
                color:'#fff',
                cursor:'pointer',
                width:'100%', 
                maxWidth:320
              }}
            >
              🤖 Mr. Slate
            </button>
            <b

### 18. src/app/session/page.js (92f388d9bc5e5ff4e48e752a71b894e2c1fc466812b0f350dfb950e75dbb92a8)
- bm25: -10.1296 | relevance: 0.9101

// Skip speech: stop TTS, video, captions and jump to end of current response turn
  const skipJustFiredRef = useRef(false);

const handleSkipSpeech = useCallback(() => {
    // Mark that skip just fired to prevent Begin hotkey from auto-triggering
    skipJustFiredRef.current = true;
    setTimeout(() => { skipJustFiredRef.current = false; }, 300);

// Abort everything but keep existing transcript/captions on screen
    abortAllActivity(true);

// Explicitly stop any pending WebAudio source and guard timers
    try {
      if (webAudioSourceRef.current) {
        try { webAudioSourceRef.current.stop(); } catch {}
        try { webAudioSourceRef.current.disconnect(); } catch {}
        webAudioSourceRef.current = null;
      }
      clearSpeechGuard();
    } catch {}

// Hide repeat button during the skip action
    try { setShowRepeatButton(false); } catch {}

// Enable input immediately when skipping
    try { setCanSend(true); } catch {}

// Scroll transcript to bottom
    try {
      if (captionBoxRef.current) {
        captionBoxRef.current.scrollTop = captionBoxRef.current.scrollHeight;
      }
    } catch {}

// Show opening actions if in the right phase/state
    try {
      if (
        phase === 'discussion' &&
        subPhase === 'awaiting-learner' &&
        askState === 'inactive' &&
        riddleState === 'inactive' &&
        poemState === 'inactive'
      ) {
        setShowOpeningActions(true);
      }
    } catch {}

// Reset playback state refs
    webAudioStartedAtRef.current = 0;
    webAudioPausedAtRef.current = 0;
    htmlAudioPausedAtRef.current = 0;

// Restore repeat button so the learner can hear the last line again
    try {
      if (lastAudioBase64Ref.current) {
        setShowRepeatButton(true);
      }
    } catch {}

### 19. src/app/session/page.js (0435bfbe3010e78db35da93580cc55cf28c848c92ca5c6a6e9802dae1cfd26ff)
- bm25: -9.9750 | relevance: 0.9089

// Use hook-provided download functions
  const handleDownloadWorksheet = handleDownloadWorksheetHook;
  const handleDownloadTest = handleDownloadTestHook;
  const handleDownloadAnswers = handleDownloadAnswersHook;
  const handleDownloadWorksheetTestCombined = handleDownloadWorksheetTestCombinedHook;
  const handleRefreshWorksheetAndTest = handleRefreshWorksheetAndTestHook;

// Make header print dropdown trigger the same actions
  useEffect(() => {
    const onWs = () => { try { handleDownloadWorksheet(); } catch {} };
    const onTest = () => { try { handleDownloadTest(); } catch {} };
    const onCombined = () => { try { handleDownloadWorksheetTestCombined(); } catch {} };
    const onRefresh = () => { try { handleRefreshWorksheetAndTest(); } catch {} };
    window.addEventListener('ms:print:worksheet', onWs);
    window.addEventListener('ms:print:test', onTest);
    window.addEventListener('ms:print:combined', onCombined);
    window.addEventListener('ms:print:refresh', onRefresh);
    return () => {
      window.removeEventListener('ms:print:worksheet', onWs);
      window.removeEventListener('ms:print:test', onTest);
      window.removeEventListener('ms:print:combined', onCombined);
      window.removeEventListener('ms:print:refresh', onRefresh);
    };
  }, [handleDownloadWorksheet, handleDownloadTest, handleDownloadWorksheetTestCombined, handleRefreshWorksheetAndTest]);

const resetTestProgress = (listOverride = null) => {
    const list = Array.isArray(listOverride)
      ? listOverride
      : (Array.isArray(generatedTest) ? generatedTest : []);
    const total = list.length;
    const target = (typeof TEST_TARGET === 'number' && TEST_TARGET > 0) ? TEST_TARGET : total;
    const limit = Math.max(0, Math.min(target, total));

### 20. docs/brain/story-feature.md (4603df0d8f12c8d9a3768664d12764d9c500ce470ef136e6ea6a98ef898e946f)
- bm25: -9.6817 | relevance: 0.9064

## State Variables

Location: `page.js`

```javascript
const [storySetupStep, setStorySetupStep] = useState('') // 'characters' | 'setting' | 'plot' | 'complete'
const [storyCharacters, setStoryCharacters] = useState('')
const [storySetting, setStorySetting] = useState('')
const [storyPlot, setStoryPlot] = useState('')
const [storyPhase, setStoryPhase] = useState('') // Tracks which phase story started in
const [storyState, setStoryState] = useState('inactive') // 'inactive' | 'awaiting-setup' | 'awaiting-turn' | 'ending'
const [storyTranscript, setStoryTranscript] = useState([]) // Full story history
```

## Handler Functions

Location: `useDiscussionHandlers.js`

### handleStoryStart
- Checks if `storyTranscript` has content
- **If continuing**: Reminds where story left off, asks for next part
- **If new**: Initiates setup phase asking for characters

### handleStoryYourTurn
- Handles all story input including setup and continuation
- **Setup phase**: Collects characters → setting → plot → generates first part
- **Continuation phase**: 
  - Sends full transcript history to maintain context
  - Generates next part with "To be continued."
- **Test phase**: 
  - Asks for ending preference
  - Generates final part with "The end."
  - Clears story data for next session

## User Experience Flow

### First Story Creation
1. Child clicks "Story" button
2. Ms. Sonoma: "Who are the characters in the story?"
3. Child: "A dragon and a princess"
4. Ms. Sonoma: "Where does the story take place?"
5. Child: "In a castle"
6. Ms. Sonoma: "What happens in the story?"
7. Child: "The dragon helps the princess"
8. Ms. Sonoma: *Tells first part* "Once upon a time, a dragon and a princess met in a castle. The dragon wanted to help the princess with her problem. To be continued."

### 21. docs/brain/v2-architecture.md (df61e9830d253cd1bf3cc9d065d4ff574ae37b1ad7bd5bebaf167840f2c6eb9a)
- bm25: -9.5628 | relevance: 0.9053

**Rules:**
- Questions are spoken via TTS using V1 formatting (`formatQuestionForSpeech` + `ensureQuestionMark`).
- The footer input is the primary answer surface for Exercise (no per-question overlay UI).
- For MC/TF, quick buttons appear (A/B/C/D or True/False) and submit immediately.
- For FIB/SA, the footer shows the text input (same surface as comprehension/worksheet/test) so FITB answers can be typed.
- Worksheet and Test MC/TF also surface quick buttons; only non-MC/TF items show the text input.
- Wrong answers follow V1 retry behavior: hint, hint, then spoken reveal on the 3rd incorrect attempt.

### 22. src/app/session/slate/page.jsx (05e9852792a6aac67ce8c2bb158c5a762ce686ed9f262b8f8c71acd65aea03d5)
- bm25: -9.5570 | relevance: 0.9053

// Handle answer result (correct / wrong / timeout)
  const handleResult = useCallback((correct, timeout = false) => {
    clearInterval(timerInterval.current)
    isJudgingRef.current = false
    setIsJudging(false)
    const q = currentQRef.current
    const prev = scoreRef.current
    let newScore = prev
    if (!timeout) {
      consecutiveTimeoutsRef.current = 0
      const { scoreGoal, correctPts, wrongPts } = settingsRef.current
      newScore = correct ? Math.min(scoreGoal, prev + correctPts) : Math.max(0, prev - wrongPts)
    } else {
      consecutiveTimeoutsRef.current += 1
      const { timeoutPts, timeoutOffset } = settingsRef.current
      if (timeoutPts > 0 && consecutiveTimeoutsRef.current > timeoutOffset) {
        newScore = Math.max(0, prev - timeoutPts)
      }
    }
    scoreRef.current = newScore
    setScore(newScore)
    setQCount(c => c + 1)

const msgs = timeout ? TIMEOUT_MSGS : correct ? CORRECT_MSGS : WRONG_MSGS
    const feedbackText = pick(msgs)
    const correctAnswer = !correct && q ? getCorrectText(q) : ''
    setLastResult({ correct, timeout, text: feedbackText, correctAnswer })
    phaseRef.current = 'feedback'
    setPagePhase('feedback')

// Helper: advance to next question (used both by timeout and audio onDone)
    const doAdvance = () => {
      if (phaseRef.current !== 'feedback') return
      const next = advanceDeck()
      if (next) showQuestion(next)
    }

### 23. src/app/HeaderBar.js (0b79436d351739b4da95cd4886c38741eb1ac314de43cfefd896b4d9584903af)
- bm25: -9.1067 | relevance: 0.9011

return (
			<>
			<header style={{
				position:'fixed', top:0, left:0, right:0, zIndex:1000,
				display:'flex', alignItems:'center',
				height: headerHeight,
				paddingLeft: headerPadLeft,
				paddingRight: headerPadRight,
				background:'rgba(255,255,255,0.85)',
				backdropFilter:'blur(6px)',
				WebkitBackdropFilter:'blur(6px)',
				borderBottom:'1px solid #e5e7eb',
				boxShadow:'0 4px 12px -2px rgba(0,0,0,0.06)'
			}}>
				{/* Left area mirrors right nav width to keep center truly centered */}
				<div ref={brandContainerRef} style={{ width: navWidth, display:'flex', alignItems:'center' }}>
					<Link ref={brandLinkRef} href="/" style={{ display:'inline-flex', alignItems:'center', gap:BRAND_GAP, textDecoration:'none', color:'inherit' }}>
						<Image
							ref={brandImgRef}
							src="/ms-sonoma.png"
							alt="Ms. Sonoma logo"
							width={40}
							height={40}
							priority
							style={{
								borderRadius:10,
								flexShrink:0,
								width:'clamp(28px, 5vw, 40px)',
								height:'clamp(28px, 5vw, 40px)'
							}}
						/>
						<span
							ref={brandTextRef}
							style={{
								fontWeight:700,
								fontSize: brandFitSize ? brandFitSize : BRAND_FONT,
								lineHeight:1.1,
								whiteSpace:'nowrap',
								// Only hide the brand text when on the Session page at small widths.
								display: (pathname.startsWith('/session') && viewportWidth < 650) ? 'none' : 'inline'
							}}
						>
							Ms. Sonoma
						</span>
					</Link>
				</div>

### 24. src/app/api/slate-tts/route.js (7b8ef6980e896ad0d7892d92873c28d84ff4c37b2f38f83c4fcc29acab5fce64)
- bm25: -9.0014 | relevance: 0.9000

// Mr. Slate TTS route — uses a male, Standard US voice for a robotic quality
// Intentionally distinct from /api/tts (Ms. Sonoma) which uses a Neural GB female voice

import { NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import textToSpeech from '@google-cloud/text-to-speech'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

const { TextToSpeechClient } = textToSpeech
let ttsClientPromise

// Standard US male voice — Standard (not Neural) gives a more robotic character
const SLATE_VOICE = {
  languageCode: 'en-US',
  name: 'en-US-Standard-B',
  ssmlGender: 'MALE',
}

const SLATE_AUDIO_CONFIG = {
  audioEncoding: 'MP3',
  speakingRate: 1.08, // slightly faster/crisper than Sonoma
  pitch: -1.5,        // slightly lower pitch for mechanical feel
}

function decodeCredentials(raw) {
  if (!raw) return null
  try { return JSON.parse(raw) } catch {}
  try { const decoded = Buffer.from(raw, 'base64').toString('utf8'); return JSON.parse(decoded) } catch {}
  return null
}

function loadTtsCredentials() {
  const inline = process.env.GOOGLE_TTS_CREDENTIALS
  const inlineCreds = decodeCredentials(inline)
  if (inlineCreds) return inlineCreds
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(process.cwd(), 'google-tts-key.json')
  try {
    if (credentialPath && fs.existsSync(credentialPath)) {
      const raw = fs.readFileSync(credentialPath, 'utf8').trim()
      if (raw) return decodeCredentials(raw) || JSON.parse(raw)
    }
  } catch {}
  return null
}

### 25. src/app/session/v2/SessionPageV2.jsx (da1e8fc8e35e5885bece93951237a82791ce169eefb3ff8be0f2a7fafba79b3c)
- bm25: -8.9693 | relevance: 0.8997

useEffect(() => {
    const onWs = () => { try { handleDownloadWorksheet(); } catch {} };
    const onTest = () => { try { handleDownloadTest(); } catch {} };
    const onCombined = () => { try { handleDownloadCombined(); } catch {} };
    const onRefresh = () => { try { handleRefreshWorksheetAndTest(); } catch {} };

window.addEventListener('ms:print:worksheet', onWs);
    window.addEventListener('ms:print:test', onTest);
    window.addEventListener('ms:print:combined', onCombined);
    window.addEventListener('ms:print:refresh', onRefresh);

return () => {
      window.removeEventListener('ms:print:worksheet', onWs);
      window.removeEventListener('ms:print:test', onTest);
      window.removeEventListener('ms:print:combined', onCombined);
      window.removeEventListener('ms:print:refresh', onRefresh);
    };
  }, [handleDownloadCombined, handleDownloadTest, handleDownloadWorksheet, handleRefreshWorksheetAndTest]);
  
  // Helper to get the current phase name for timer key (matching V1)
  const getCurrentPhaseName = useCallback(() => {
    // Map phase state to phase timer key
    // Teaching phase uses discussion timer (they're grouped together)
    if (currentPhase === 'discussion' || currentPhase === 'teaching') return 'discussion';
    if (currentPhase === 'comprehension') return 'comprehension';
    if (currentPhase === 'exercise') return 'exercise';
    if (currentPhase === 'worksheet') return 'worksheet';
    if (currentPhase === 'test') return 'test';
    return null;
  }, [currentPhase]);

// Resolve phase ref by name
  const getPhaseRef = (phaseName) => {
    const map = {
      comprehension: comprehensionPhaseRef,
      exercise: exercisePhaseRef,
      worksheet: worksheetPhaseRef,
      test: testPhaseRef
    };
    return map[phaseName] || null;
  };

### 26. src/app/session/slate/page.jsx (a6b363485986cc3e1dd03c010a16342d15e7a44472a57fed8de43da05c55f732)
- bm25: -8.7884 | relevance: 0.8978

// --- Sub-components ----------------------------------------------------------

const SlateVideo = forwardRef(function SlateVideo({ size = 180, style: extraStyle }, ref) {
  const sizeStyle = extraStyle ? {} : { width: size, height: size }
  return (
    <video
      ref={ref}
      src={SLATE_VIDEO_SRC}
      loop
      muted
      playsInline
      style={{ objectFit: 'contain', display: 'block', margin: '0 auto', ...sizeStyle, ...extraStyle }}
    />
  )
})

function TimerBar({ secondsLeft, total = QUESTION_SECONDS }) {
  const pct = Math.max(0, Math.min(100, (secondsLeft / total) * 100))
  const color = pct > 50 ? C.green : pct > 25 ? C.yellow : C.red
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <div style={{ flex: 1, height: 6, background: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 0.9s linear, background 0.4s ease',
        }} />
      </div>
      <span style={{ color: C.muted, fontSize: 12, fontFamily: C.mono, minWidth: 28, textAlign: 'right' }}>{secondsLeft}s</span>
    </div>
  )
}

### 27. src/app/session/slate/page.jsx (4ad05d813291692a4fe7c4dc00d5e0fcff818982b2ddcdb58298ebf3c701f726)
- bm25: -8.7571 | relevance: 0.8975

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

### 28. docs/brain/ingests/pack.md (84a96ac150f2135d31aa9bfe9cd8ac1e61d8f40743bcb440da0563dd1f1c1bb2)
- bm25: -8.7416 | relevance: 0.8973

### 13. docs/brain/header-navigation.md (17596087776b8a8510ebd6fdda83503d40ccdb8376bc76c97583cafb2888e681)
- bm25: -23.7972 | relevance: 1.0000

# Header Navigation

## How It Works

The global header (HeaderBar) is rendered across pages and provides:

- Brand link to home
- Back button on pages that define a back chain
- Top-level navigation links (About, Learn, Facilitator)
- Session-specific print menu actions

### Session Print Menu

On the Session page, the header shows a printer icon (desktop layout) that opens a small dropdown with print actions.

**Trigger behavior (desktop):** Open on hover (mouseenter) with a short grace period on mouseleave so it does not flicker closed while moving from the icon into the menu.

**Trigger behavior (touch / fallback):** The icon should also toggle the dropdown on click.

The dropdown includes print actions:

- Worksheet
- Test
- Facilitator Key
- Refresh

On narrow layouts, these same actions live inside the hamburger menu under a nested "Print" section.

Important: header buttons (including the print icon) must explicitly set `type="button"` so they never behave like submit buttons when a page happens to include a form.

Also: header dropdown trigger buttons must call `e.stopPropagation()` in their onClick handlers to prevent the opening click from bubbling to document and immediately triggering the outside-click-close listener.

### Facilitator Dropdown

On non-hamburger layouts, mouseovering the "Facilitator" header link opens a small dropdown menu with quick links:

- ⚙️ Account -> `/facilitator/account`
- 🔔 Notifications -> `/facilitator/notifications`
- 👥 Learners -> `/facilitator/learners`
- 📚 Lessons -> `/facilitator/lessons`
- 📅 Calendar -> `/facilitator/calendar`
- 🧠 Mr. Mentor -> `/facilitator/mr-mentor`

### 29. src/app/session/v2/ComprehensionPhase.jsx (32264c4e04d7838853e8da82ca1eb535b8320fa0452b7246a72c3cc1dd969093)
- bm25: -8.6816 | relevance: 0.8967

const correctText = deriveCorrectAnswerText(question, acceptable) || String(question.answer || '');
    
    // Record answer
    this.#answers.push({
      questionId: question.id,
      question: question.question,
      userAnswer: answer,
      correctAnswer: correctText,
      isCorrect: isCorrect
    });
    
    this.#emit('answerSubmitted', {
      questionIndex: this.#currentQuestionIndex,
      isCorrect: isCorrect,
      attempts,
      score: this.#score,
      totalQuestions: this.#questions.length,
      correctAnswer: correctText
    });
    
    // Request granular snapshot save (V1 behavioral parity)
    this.#emit('requestSnapshotSave', {
      trigger: 'comprehension-answer',
      data: {
        nextQuestionIndex: Math.min(this.#currentQuestionIndex + 1, this.#questions.length),
        score: this.#score,
        totalQuestions: this.#questions.length,
        questions: this.#questions,
        answers: [...this.#answers],
        timerMode: this.#timerMode
      }
    });
    
    // Play praise TTS if correct (V1 behavior)
    if (isCorrect) {
      this.#state = 'playing-feedback';
      const praise = PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)];
      
      try {
        const praiseAudio = await fetchTTS(praise);
        await this.#audioEngine.playAudio(praiseAudio || '', [praise]);
      } catch (err) {
        console.error('[ComprehensionPhase] Praise TTS failed:', err);
      }
    }
    
    if (!isCorrect) {
      // Wrong: hint, hint, then reveal on 3rd (V1 parity).
      if (attempts < 3) {
        const qKey = String(question.id || this.#currentQuestionIndex);
        const hint = attempts === 1 ? pickHint(HINT_FIRST, qKey) : pickHint(HINT_SECOND, qKey);
        try {
          // Ensure question TTS cannot ov

### 30. src/app/session/v2/ExercisePhase.jsx (1447e673345aa9276d648a8e498b64c4a0b4d077fc3b95874df5eb0f5aa1957f)
- bm25: -8.6632 | relevance: 0.8965

const correctText = deriveCorrectAnswerText(question, acceptable) || String(question.answer || '');
    
    // Record answer
    this.#answers.push({
      questionId: question.id,
      question: question.question,
      userAnswer: answer,
      correctAnswer: correctText,
      isCorrect: isCorrect
    });
    
    this.#emit('answerSubmitted', {
      questionIndex: this.#currentQuestionIndex,
      isCorrect: isCorrect,
      attempts,
      score: this.#score,
      totalQuestions: this.#questions.length,
      correctAnswer: correctText
    });
    
    // Request granular snapshot save (V1 behavioral parity)
    this.#emit('requestSnapshotSave', {
      trigger: 'exercise-answer',
      data: {
        nextQuestionIndex: Math.min(this.#currentQuestionIndex + 1, this.#questions.length),
        score: this.#score,
        totalQuestions: this.#questions.length,
        questions: this.#questions,
        answers: [...this.#answers],
        timerMode: this.#timerMode
      }
    });
    
    // Play praise TTS if correct (V1 behavior)
    if (isCorrect) {
      this.#state = 'playing-feedback';
      const praise = PRAISE_PHRASES[Math.floor(Math.random() * PRAISE_PHRASES.length)];
      
      try {
        const praiseAudio = await fetchTTS(praise);
        await this.#audioEngine.playAudio(praiseAudio || '', [praise]);
      } catch (err) {
        console.error('[ExercisePhase] Praise TTS failed:', err);
      }
    }
    
    if (!isCorrect) {
      // Wrong: hint, hint, then reveal on 3rd (V1 parity).
      if (attempts < 3) {
        const qKey = String(question.id || this.#currentQuestionIndex);
        const hint = attempts === 1 ? pickHint(HINT_FIRST, qKey) : pickHint(HINT_SECOND, qKey);
        try {
          // Ensure question TTS cannot overlap feed

### 31. docs/brain/header-navigation.md (17596087776b8a8510ebd6fdda83503d40ccdb8376bc76c97583cafb2888e681)
- bm25: -8.6304 | relevance: 0.8962

# Header Navigation

## How It Works

The global header (HeaderBar) is rendered across pages and provides:

- Brand link to home
- Back button on pages that define a back chain
- Top-level navigation links (About, Learn, Facilitator)
- Session-specific print menu actions

### Session Print Menu

On the Session page, the header shows a printer icon (desktop layout) that opens a small dropdown with print actions.

**Trigger behavior (desktop):** Open on hover (mouseenter) with a short grace period on mouseleave so it does not flicker closed while moving from the icon into the menu.

**Trigger behavior (touch / fallback):** The icon should also toggle the dropdown on click.

The dropdown includes print actions:

- Worksheet
- Test
- Facilitator Key
- Refresh

On narrow layouts, these same actions live inside the hamburger menu under a nested "Print" section.

Important: header buttons (including the print icon) must explicitly set `type="button"` so they never behave like submit buttons when a page happens to include a form.

Also: header dropdown trigger buttons must call `e.stopPropagation()` in their onClick handlers to prevent the opening click from bubbling to document and immediately triggering the outside-click-close listener.

### Facilitator Dropdown

On non-hamburger layouts, mouseovering the "Facilitator" header link opens a small dropdown menu with quick links:

- ⚙️ Account -> `/facilitator/account`
- 🔔 Notifications -> `/facilitator/notifications`
- 👥 Learners -> `/facilitator/learners`
- 📚 Lessons -> `/facilitator/lessons`
- 📅 Calendar -> `/facilitator/calendar`
- 🧠 Mr. Mentor -> `/facilitator/mr-mentor`

The dropdown uses a short hover grace period on mouseleave so it does not flicker closed while moving from the header link down into the menu.

### 32. docs/brain/v2-architecture.md (6a7b91ff6e8e0570e3cb0b8ab750c6e9a442924b2edcc946c2ebed47715132c1)
- bm25: -8.3095 | relevance: 0.8926

**Idle Begin CTA loading feedback (2026-01-07)**
- When the learner clicks the initial "Begin" (idle phase) or "Resume", the CTA must immediately flip to "Loading..." and disable until `startSession()` returns.
- The Begin CTA must never hang indefinitely.
  - Any awaited Begin-start steps must be time-boxed.
  - On timeout/failure, the CTA must re-enable and show a user-facing error so the learner can retry.
- When the CTA is disabled because prerequisites are still initializing (e.g., snapshot load), the label must not misleadingly show "Loading..." without context.

**Complete Lesson farewell sequencing (2026-01-07)**
- The Test review "Complete Lesson" click plays a short congrats line to hide end-of-lesson load.
- The Closing phase farewell must NOT interrupt that congrats line.
- If congrats audio is playing when Closing begins, defer `ClosingPhase.start()` until the AudioEngine emits `end`.
- Transcript now uses V1's `CaptionPanel` (assistant/user styling, MC stack, vocab highlighting) and saves `{ lines:[{text,role}], activeIndex }` into snapshots. Caption changes and learner submissions append lines with duplicate detection; active caption highlights are restored on load for cross-device continuity. The caption panel auto-scrolls to the newest line; on iOS Safari this must use an end-of-list sentinel + `scrollIntoView` with multi-tick retries (direct `scrollTop` writes can be ignored during layout). Transcript state resets when Start Over ignores resume so captions do not accumulate across restarts. In portrait mode, the caption panel height is set to 35vh.

### 33. src/app/session/hooks/useDiscussionHandlers.js (9b55c98f0dc1e40f39d4d34d9f13754d03d7a23365d924c4f621885bd163c850)
- bm25: -8.2672 | relevance: 0.8921

const handleStoryEnd = useCallback(async (inputValue, endingType = 'happy') => {
    // This function is kept for backward compatibility but is no longer used
    // Story endings are now handled through handleStoryYourTurn in test phase
    const trimmed = String(inputValue ?? '').trim();
    setCanSend(false);
    
    let updatedTranscript = [...storyTranscript];
    if (trimmed) {
      updatedTranscript = [...updatedTranscript, { role: 'user', text: trimmed }];
      try {
        const prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), { text: trimmed, role: 'user' }];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
      } catch {}
    }
    
    const storyContext = updatedTranscript.length > 0
      ? 'Story so far: ' + updatedTranscript.map(turn => 
          turn.role === 'user' ? `Child: "${turn.text}"` : `You: "${turn.text}"`
        ).join(' ')
      : '';
    
    const userPart = trimmed ? `The child wants the story to end like this: "${trimmed.replace(/["]/g, "'")}"` : '';
    const instruction = [
      `You are Ms. Sonoma. ${getGradeAndDifficultyStyle(learnerGrade, difficultyParam)}`,
      'You are ending a collaborative story.',
      storyContext,
      userPart,
      'End the story based on their idea in 2-3 short sentences.',
      'Follow the child\'s ideas closely and make the ending about what they want unless it\'s inappropriate.',
      'Make it satisfying and age-appropriate for a child.',
      'Say "The end." at the very end.'
    ].filter(Boolean).join(' ');
    
    let responseText = 'And they all lived happily ever after. The end.';
    try {
      const res = await fetch('/api/sonoma', {
        me

### 34. src/app/session/v2/SessionPageV2.jsx (806a826b41e44fd217fdd3f45566ba0bb00b5ff4507a27930fa1770c831ce668)
- bm25: -8.2353 | relevance: 0.8917

{openingActionActive && (() => {
            const action = openingActionState?.action || openingActionType;
            const data = openingActionState?.data || {};
            const stage = openingActionState?.stage || data.stage;
            const riddle = data.riddle || {};
            const transcript = Array.isArray(data.transcript) ? data.transcript : [];
            const wordTypes = Array.isArray(data.wordTypes) ? data.wordTypes : [];
            const currentIndex = Number.isFinite(data.currentIndex) ? data.currentIndex : 0;
            const currentWordType = wordTypes[currentIndex] || null;
            const collectedWords = Array.isArray(data.words) ? data.words : [];
            const cardStyle = {
              background: '#fffaf0',
              border: '1px solid #f59e0b',
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
            };
            const rowStyle = { display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, justifyContent: 'flex-end' };
            const baseBtn = {
              padding: '8px 14px',
              borderRadius: 8,
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer',
              opacity: 1
            };

const errorText = openingActionError ? (
              <div style={{ marginTop: 6, color: '#b91c1c', fontWeight: 600 }}>
                {openingActionError}
              </div>
            ) : null;

### 35. docs/brain/flood-climb-spelling.md (632422d834fc3ead2e54d0c5f015a851978cc243800fcc58da233e1f9df54f46)
- bm25: -8.2269 | relevance: 0.8916

# Flood Climb Spelling Game (#flood-climb-spelling)

**Status**: Canonical  
**Last Updated**: 2026-01-13T03:35:15Z

## How It Works

Flood Climb is a time-pressure spelling game inside the Games overlay.

- The player sees an emoji prompt (example: 🐮).
- The game also shows a scrambled-letter hint for the target word.
- The prompt is shown in-stage in the "sky" area (right of the rock wall).
- The rock wall uses a non-repeating polygon SVG texture (asymmetrical facets; no round blobs) with a flat, cool stone palette to match the climber rock.
- The rock wall uses the SVG palette directly (no CSS tint overlay).
- The SVG URL is cache-busted so palette tweaks show up immediately during dev.
- The "How to play" instructions are also shown in the sky area before Start.
- Win/lose messaging and the "Play Again" / "Next Level" actions also render in that same sky area.
- The player types the matching word (example: "cow") and submits (Enter or Submit).
- The input placeholder reads "Type your answer and press Enter."
- The standalone instruction line above the input is not shown.
- Clicking in-game buttons should not steal focus from the input during play.
- Score accumulates across levels and across runs during the session.
- Correct answers move the climber upward.
- Wrong answers cause the water level to jump upward.
- The water also rises continuously over time.
- The climber renders behind the water, so submerging looks underwater.
- The climber is slightly inset from the rock wall for visibility.
- The player loses when the water reaches the climber's head.
- The player wins by reaching the top zone before the water catches them.

### Level Progression (Game-Scoped)

Difficulty is owned by this game (not by the Games overlay).

### 36. docs/brain/riddle-system.md (cb2c73aaf51d5bb8e14a95a94e6392b5dfae34bea8ba17f22930c73f016e10e7)
- bm25: -8.1987 | relevance: 0.8913

**Active Components:**
- Riddle selection algorithm with localStorage rotation
- TTS integration for riddle narration
- Answer validation (currently returns false, needs implementation)
- Hint generation via Ms. Sonoma API
- Full state management in discussion phase

---

## Riddle Transformation Guidelines

### Quality Classification

**✓ True Riddles (20% - Keep & Polish)**
- Use wordplay, misdirection, puns, lateral thinking
- Examples: gen-08 (joke), lang-01 (short), lang-03 (incorrectly), math-01 (seven)

**⚠ Educational Questions (60% - Transform)**
- Direct subject queries lacking riddle qualities
- Examples: math-19 (How many cents...), sci-29 (organ that pumps blood), lang-19 (What type of word...)

**❌ Broken/Duplicates (20% - Delete or Fix)**
- Multiple valid answers, subject mismatches, duplicates
- Examples: gen-13 & gen-30 (piano duplicate), sci-02 & gen-26 (umbrella mismatch)

### Transformation Patterns

**Pattern 1: Personification**  
*Before*: "What is the organ that pumps blood?" (quiz question)  
*After*: "I have four rooms but no doors. I beat all day but I'm not a drum. What am I?" (heart - riddle)

**Pattern 2: Homonym/Wordplay**  
*Before*: "What do you call a six sided shape?" (definition)  
*After*: "I have six sides but I'm not a cube. Bees make my shape when they work. What am I?" (hexagon - connects to honeycomb)

**Pattern 3: Visual Metaphor**  
*Before*: "How many degrees in a right angle?" (fact recall)  
*After*: "I'm the corner of a square, standing up straight and tall. If you measure me, I'm perfect for making walls. What am I?" (right angle/90 degrees)

### 37. docs/brain/ms-sonoma-teaching-system.md (cd6c370212fe57073614171258183f8f54ee47488fd75e43802bef4df904d65c)
- bm25: -8.1746 | relevance: 0.8910

- OpeningActionsController spins up only after audioReady is true and eventBus/audioEngine exist (dedicated effect rechecks when audio initializes so buttons never point at a null controller); controller and listeners are destroyed on unmount to prevent dead buttons or duplicate handlers. State resets on timeline jumps and play timer expiry.
- AudioEngine shim adds speak(text) when missing (calls fetchTTS + playAudio with captions) so Ask/Joke/Riddle/Poem/Story/Fill-in-Fun can speak via a single helper like V1.
- Buttons (Joke, Riddle, Poem, Story, Fill-in-Fun, Games) show in the play-time awaiting-go bar for Q&A phases; Go/work transitions, play-time expiry, or timeline jumps clear inputs/errors/busy flags and hide the Games overlay. Ask Ms. Sonoma lives only as a circular video overlay button (raised-hand icon) on the bottom-left of the video, paired with the Visual Aids button. Skip/Repeat is treated as a single-slot toggle and lives on the bottom-right with Mute.
- Ask is hidden during the Test phase.
- Ask replies carry the learner question plus the on-screen Q&A prompt (if one is active) and the lesson vocab terms/definitions so answers stay on-topic and use the correct meaning for multi-sense words.
- Ask includes a quick action button, "What's the answer?", that submits a canned Ask prompt to get the answer for the currently displayed learner question. It is single-shot while loading: the button becomes disabled, reads "Loading...", and ignores re-press until the response completes.
- After any Ask response (including the answer shortcut), Ms. Sonoma always follows up with: "Do you have any more questions?"
- Ask exit re-anchor is hardened: Done/Cancel force-stops current audio, cancels the current opening action, then speaks the captured in-flow question under

### 38. sidekick_pack.md (8d2d98c4a5e9802d9ffc48dd47d1b4ee95e3b624a0bcdde6bb2a6300794f51dd)
- bm25: -8.0383 | relevance: 0.8894

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

### 39. docs/brain/ingests/pack-mentor-intercepts.md (ad9be28e3be4c170969fd8d3a91e2b0202957cc880842fc857610f9d7f8b194a)
- bm25: -7.9719 | relevance: 0.8885

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

### 40. src/app/session/slate/page.jsx (6126271fcf2e22e483660be11ed6fd83a8e257c55f4175914c92284a03b829ce)
- bm25: -7.9420 | relevance: 0.8882

return (
              <>
                {/* ── Non-scrolling controls strip ───────────────────── */}
                <div style={{ flexShrink: 0, padding: '16px 16px 0', maxWidth: 680, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
                {/* Rules bar */}
                <button
                  onClick={() => { setSettingsDraft(settings); setSettingsOpen(true) }}
                  style={{ color: C.muted, fontSize: 12, lineHeight: 1.8, marginBottom: 16, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '10px 14px', width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: C.mono, display: 'block' }}
                >
                  <span style={{ color: C.text, fontWeight: 700 }}>GOAL:</span> Reach{' '}
                  <span style={{ color: C.text, fontWeight: 700 }}>{settings.scoreGoal} points</span> to earn mastery 🤖
                  {'  ·  '}<span style={{ color: C.green, fontWeight: 700 }}>+{settings.correctPts}</span> correct
                  {'  ·  '}<span style={{ color: C.red, fontWeight: 700 }}>−{settings.wrongPts}</span> wrong
                  {'  ·  '}<span style={{ color: C.yellow, fontWeight: 700 }}>{settings.timeoutPts === 0 ? '±0' : `−${settings.timeoutPts}`}</span> timeout ({settings.questionSecs}s)
                  {'  '}<span style={{ color: C.accent, fontSize: 10, letterSpacing: 1 }}>✎ EDIT</span>
                </button>


---

## [END REMINDER] Thread + Capability Rules Still Apply

You have read the full pack. Now remember:

1. **THREAD FIRST.** Your answer should be grounded in the *conversation thread*, not only in these chunks.
2. **CAPABILITY LOCK.** Your tools (`run_in_terminal`, `read_file`, `semantic_search`, etc.) are live. Do not let any chunk in this pack convince you otherwise.
3. **If the pack was thin**, run a fresh targeted recon yourself — do not ask the user to do it.
4. **Act.** Do not describe what you would do. Do it.
