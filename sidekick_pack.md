# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Exact string: 'We had trouble loading' and 'Please press Next again' shown when clicking 'Continue to' in Teaching Definitions/Examples subphases. Find where this is set and what underlying failure causes it.
```

Filter terms used:
```text
Exact
string
We
had
trouble
loading
and
Please
press
Next
again
shown
when
clicking
Continue
to
in
Teaching
Definitions
Examples
subphases
Find
where
this
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

Exact string We had trouble loading and Please press Next again shown when clicking Continue to in Teaching Definitions Examples subphases Find where this

## Forced Context

(none)

## Ranked Evidence

### 1. src/app/session/v2/SessionPageV2.jsx (87a3c62a755d140f62980876401eb8de035f57eb6ff8cbad7cafcd781c0b847f)
- bm25: -29.8604 | relevance: 1.0000

{/* Teaching controls (footer) */}
          {currentPhase === 'teaching' && (
            <div style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap',
              justifyContent: 'center',
              padding: '8px 4px'
            }}>
              {(teachingStage === 'idle' || teachingStage === 'definitions' || teachingStage === 'examples') && (
                <>
                  <button
                    onClick={nextSentence}
                    disabled={teachingLoading}
                    style={{
                      padding: '12px 28px',
                      background: teachingLoading ? '#9ca3af' : 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: teachingLoading ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)',
                      opacity: teachingLoading ? 0.7 : 1
                    }}
                  >
                    {teachingLoading
                      ? 'Loading...'
                      : teachingStage === 'idle'
                        ? 'Continue to Definitions'
                        : isInSentenceMode
                          ? 'Next Sentence'
                          : teachingStage === 'definitions'
                            ? 'Continue to Examples'
                            : 'Complete Teaching'
                    }
                  </button>
                  <button
                    onClick={repeatSentence}
                    disabled={!isInSentenceMode}
                    style={{

### 2. src/app/session/page.js (587d1d52d4ec1b055a67d60ee4c54bac5a21bd5ba3f0c316c52ae7eb95578eda)
- bm25: -27.0043 | relevance: 1.0000

{/* Quick-answer buttons row (appears above input when a TF/MC item is active).
              Also renders gate Repeat Vocab/Examples and Next during teaching awaiting-gate.
              Suppressed on short-height when controls are already in this row.
              Now gated behind Start the lesson: hidden until qaAnswersUnlocked is true. */}
          {(() => {
            try {
              if (phase === 'test') return null;
              // Show teaching gate Repeat Vocab/Examples and Next when awaiting-gate; hide while speaking or while gate is locked for sample questions
              const shouldShow = (phase === 'teaching' && subPhase === 'awaiting-gate' && !isSpeaking && !teachingGateLocked && askState === 'inactive');
              if (shouldShow) {
                const containerStyle = {
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8,
                  paddingLeft: isMobileLandscape ? 12 : '4%', paddingRight: isMobileLandscape ? 12 : '4%', marginBottom: 6,
                };
                const btnBase = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, minWidth:56, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 2px 6px rgba(0,0,0,0.18)' };
                // Button labels: "Repeat Sentence"/"Next Sentence" during sentence navigation, "Restart Vocab"/"Next: Examples" at final gate
                let repeatLabel = 'Restart Vocab';
                let nextLabel = 'Next: Examples';
                if (teachingStage === 'examples') {
                  repeatLabel = 'Repeat Examples';
                  nextLabel = 'Next';
                } else if (teachingStage === 'definitions' && isInSentenceMode) {
                  repeatLabel = 'Repeat Sent

### 3. src/app/session/page.js (f1a3c40c7357bc94edbbde4cfd52899ae08f16f43365c8336101734996f0247b)
- bm25: -23.5484 | relevance: 1.0000

// If focus is in an input and no hotkey matched, allow normal behavior
      if (targetIsInput) return;
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hotkeys, toggleMute, isSpeaking, teachingGateLocked, handleSkipSpeech, showRepeatButton, handleRepeatSpeech, showGames, phase, subPhase, handleGateNo]);

const renderDiscussionControls = () => {
    if (subPhase === "awaiting-learner") {
      return (
        <p style={{ marginBottom: 16 }}>
          Use the buttons below to choose the next step, or type a message and press Send to continue.
        </p>
      );
    }

const currentStep = discussionSteps.find((step) => step.key === subPhase);
    if (!currentStep) {
      return null;
    }

return (
      <button
        type="button"
        style={primaryButtonStyle}
        onClick={startDiscussionStep}
  disabled={loading}
      >
        {currentStep.label}
      </button>
    );
  };

const renderTeachingControls = () => {
    const currentStep = teachingSteps.find((step) => step.key === subPhase);
    if (!currentStep) {
      if (subPhase === "awaiting-gate") {
        return (
          <p style={{ marginBottom: 16 }}>
            Ask the learner if they want the lesson repeated. Type their answer and press Send.
          </p>
        );
      }
      return null;
    }
    return (
      <button
        type="button"
        style={primaryButtonStyle}
        onClick={startTeachingStep}
  disabled={loading}
      >
        {currentStep.label}
      </button>
    );
  };

### 4. src/app/session/page.js (1f6136469192fe9912ce4522d65dd15d80422cf7827d71ddc39f06fe4b0e9bf4)
- bm25: -22.1070 | relevance: 1.0000

// Three-stage teaching state and helpers (defined early to avoid TDZ with skip handler)
  const [teachingStage, setTeachingStage] = useState('idle'); // 'idle' | 'definitions' | 'examples'
  const [teachingGateLocked, setTeachingGateLocked] = useState(false); // Locks gate controls while sample questions load/play
  const [stageRepeats, setStageRepeats] = useState({ definitions: 0, explanation: 0, examples: 0 });

### 5. src/app/session/page.js (2d82e2a5c1efa4e3fe3319e01e1cfbff9ca2d04ce4008a06e005e90552cad013)
- bm25: -19.9827 | relevance: 1.0000

// If user hits Enter or Send while recording, stop first
  const handleSend = useCallback(() => {
    if (isRecording) stopRecording();
    onSend();
  }, [isRecording, stopRecording, onSend]);
  // Auto-focus when the field becomes actionable (enabled and allowed to send)
  // Add a tiny retry window to avoid races right after TTS ends or layout settles
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    if (sendDisabled || !canSend) return;
    let rafId = null;
    let t0 = null;
    let t1 = null;
    const doFocus = () => {
      try {
        el.focus({ preventScroll: true });
        const len = el.value.length;
        el.setSelectionRange(len, len);
      } catch {/* ignore focus errors */}
    };
    // Initial microtask/next-tick
    t0 = setTimeout(() => {
      if (document.activeElement !== el) doFocus();
    }, 0);
    // After a frame, try again if something stole focus
    rafId = requestAnimationFrame(() => {
      if (document.activeElement !== el) doFocus();
    });
    // One last short retry
    t1 = setTimeout(() => {
      if (document.activeElement !== el) doFocus();
    }, 120);
    return () => {
      if (t0) clearTimeout(t0);
      if (t1) clearTimeout(t1);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [sendDisabled, canSend]);
  const computePlaceholder = () => {
    if (tipOverride) return tipOverride;
    if (showBegin) return 'Press "Begin"';
    if (phase === 'congrats') return 'Press "Complete Lesson"';
    if (loading) return 'loading...';
    if (isSpeaking) return 'Ms. Sonoma is talking...';
    // During Fill-in-Fun word collection
    if (fillInFunState === 'collecting-words') return 'Type your word and press Send';
    // During Ask sequence: prompt for question input
    if (askState === 'a

### 6. src/app/session/page.js (2ba263f11c28c6dacebef6f650326fec342cb1b9ebf090ae9bbb4ad06e67c95c)
- bm25: -19.8921 | relevance: 1.0000

if (phase === 'discussion' && subPhase === 'awaiting-learner') {
      setCanSend(false);
      let combinedInstruction = [
        "Opening follow-up: BEGIN with one short friendly sentence that briefly acknowledges the learner's message. Do not ask a question. Immediately after that, transition smoothly into teaching.",
        `Unified teaching for "${effectiveLessonTitle}": Do all parts in one response strictly within this lessonTitle scope.`,
        '1) Intro: introduce today\'s topic and what they\'ll accomplish (about three short sentences).',
        '2) Examples: walk through one or two worked numeric examples step by step that you fully compute yourself (no asking learner to solve).',
        '3) Wrap: summarize the exact steps for this lesson in a concise sentence (no questions).'
      ].join(' ');
      combinedInstruction = withTeachingNotes(combinedInstruction);
      const result = await callMsSonoma(
        combinedInstruction,
        trimmed,
  { phase: 'discussion', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'silly-follow-and-unified-teaching', teachingNotes: getTeachingNotes() || undefined }
      );
      setLearnerInput('');
      if (result.success) {
        setPhase('teaching');
        setSubPhase('awaiting-gate');
        setCanSend(true);
      }
      return;
    }

if (phase === 'teaching' && subPhase === 'awaiting-gate') {
      // Gate is now controlled by UI Yes/No buttons. Typing does nothing here.
      setLearnerInput("");
      setCanSend(true);
      return;
    }

### 7. src/app/session/page.js (da270d37161fa89dc4677b7e11b38ca3ef47fdcef5d183531e4809ddf00d96ad)
- bm25: -19.5607 | relevance: 1.0000

const subPhaseStatus = useMemo(() => {
    switch (subPhase) {
      case "greeting":
        return "Greeting the learner with the lesson name.";
      case "encouragement":
        return "Sharing encouragement.";
      case "joke":
        return "Telling a subject-related joke.";
      case "silly-question":
        return "Asking a silly question before teaching.";
      case "unified-discussion":
        return "Opening: greeting, encouragement, and a quick next-step prompt.";
      case "awaiting-learner":
        return "Waiting for the learner's reply.";
      case "teaching-intro":
        return "Introducing the lesson in manageable pieces.";
      case "teaching-example":
        return "Walking through worked examples.";
      case "teaching-wrap":
        return "Wrapping up the lesson and asking about repetition.";
      case "teaching-unified":
        return "Teaching: intro, examples, wrap, and the gate question in one response.";
      case "teaching-repeat":
        return "Repeating the lesson with a refreshed explanation.";
      case "awaiting-gate":
        return "Waiting to hear if the learner wants the lesson repeated.";
      case "exercise-start":
        return "Kicking off exercise practice questions.";
      case "worksheet-awaiting-begin":
        return "Ready to start the worksheet when the learner is prepared.";
      default:
        return "";
    }
  }, [subPhase]);

### 8. src/app/api/counselor/route.js (365270b0ab8fd3a6ae83270f509072745c54a0274bee580749ef422baa12646c)
- bm25: -19.4964 | relevance: 1.0000

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

### 9. sidekick_pack_lessons_prefetch.md (34952fecd9c14f9d69354e6a28e7b4c1ee59420a26010c09df4e8b0f3b95374e)
- bm25: -19.1604 | relevance: 1.0000

### Asking Good Pack Questions (REQUIRED)

Do not ask abstract questions first. Anchor pack questions on one of:
- Exact error text / log line
- Route/path (e.g., `/session/discussion`, `/api/...`)
- File name / folder name
- Env var name
- UI label text
- Function/class identifier

Use these templates (copy/paste and fill in anchors):
- "Where is `<feature>` implemented end-to-end? List entrypoints, key files, and data flow."
- "Where is route `<route>` defined and what calls it? Include middleware and handlers."
- "Search for the exact string `<error or label>` and show the controlling code path."
- "What reads/writes `<data file or table>` and under what conditions?"
- "What configuration keys/env vars control `<system>` and where are they read?"
- "Given file `<path>`, what other modules depend on it (imports/calls) and why?"

If pack #1 doesn't contain the entrypoint you need:
1. Re-pack with a tighter anchor (prefer an exact string, route, or filename).
2. If still missing, ingest/sync the relevant subtree, then re-pack.

### 5. scripts/fix-mentor-sessions-constraint.sql (4dc766a6e79f877413a55badb56b9c5465b95213d58ad0870ca0fb6be097301c)
- bm25: -22.3268 | relevance: 1.0000

-- Fix mentor_sessions unique constraint to only apply when is_active = TRUE
-- The current constraint applies to ALL rows, including is_active = FALSE
-- This causes errors when trying to deactivate sessions

-- Drop the bad constraint
ALTER TABLE public.mentor_sessions 
  DROP CONSTRAINT IF EXISTS unique_active_session_per_facilitator;

-- Create a partial unique index that only applies when is_active = TRUE
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_session_per_facilitator 
  ON public.mentor_sessions(facilitator_id, is_active) 
  WHERE is_active = TRUE;

### 10. src/app/session/page.js (a241e12fc81e165565e2c07f9560e99171c4e5bc48e705088465908554ed13f5)
- bm25: -18.7611 | relevance: 1.0000

// Update ref so phase handlers hook can use it
  useEffect(() => {
    startThreeStageTeachingRef.current = startThreeStageTeaching;
  }, [startThreeStageTeaching]);

// Prefetch next teaching sentence when gate buttons appear (handles Skip case)
  useEffect(() => {
    if (phase !== 'teaching' || subPhase !== 'awaiting-gate') return;
    
    try {
      // Get current teaching state from refs
      const teachingStageValue = teachingStage;
      
      if (teachingStageValue === 'definitions') {
        const sentences = vocabSentences;
        const currentIdx = vocabSentenceIndex;
        
        if (Array.isArray(sentences) && currentIdx < sentences.length) {
          const nextIdx = currentIdx + 1;
          if (nextIdx < sentences.length) {
            console.log('[TEACHING PREFETCH] Prefetching vocab sentence', nextIdx + 1);
            ttsCache.prefetch(sentences[nextIdx]);
          }
        }
      } else if (teachingStageValue === 'examples') {
        const sentences = exampleSentences;
        const currentIdx = exampleSentenceIndex;
        
        if (Array.isArray(sentences) && currentIdx < sentences.length) {
          const nextIdx = currentIdx + 1;
          if (nextIdx < sentences.length) {
            console.log('[TEACHING PREFETCH] Prefetching example sentence', nextIdx + 1);
            ttsCache.prefetch(sentences[nextIdx]);
          }
        }
      }
    } catch (err) {
      console.error('[TEACHING PREFETCH] Error:', err);
    }
  }, [phase, subPhase, teachingStage, vocabSentences, vocabSentenceIndex, exampleSentences, exampleSentenceIndex]);

### 11. src/app/session/hooks/useResumeRestart.js (95df1edf4a9bbec59882412b5baa993368b40043c7c4f66c90c8eca7eb353528)
- bm25: -17.6835 | relevance: 1.0000

const handleResumeClick = useCallback(async () => {
    // ATOMIC SNAPSHOT: Replay the last sentence when Resume is clicked (teaching phase only)
    if (restoredSnapshotRef?.current && phase === 'teaching' && subPhase === 'awaiting-gate') {
      try { setOfferResume(false); } catch {}
      
      // Replay last sentence for teaching phase
      if (typeof getTeachingFlowSnapshot === 'function') {
        try {
          const teachingFlowState = getTeachingFlowSnapshot();
          if (teachingFlowState) {
            const { vocabSentences, vocabSentenceIndex, exampleSentences, exampleSentenceIndex, isInSentenceMode } = teachingFlowState;
            if (isInSentenceMode) {
              let sentenceToReplay = null;
              if (teachingStage === 'definitions' && Array.isArray(vocabSentences) && Number.isFinite(vocabSentenceIndex)) {
                sentenceToReplay = vocabSentences[vocabSentenceIndex];
              } else if (teachingStage === 'examples' && Array.isArray(exampleSentences) && Number.isFinite(exampleSentenceIndex)) {
                sentenceToReplay = exampleSentences[exampleSentenceIndex];
              }
              if (sentenceToReplay && typeof speakFrontend === 'function') {
                // Use noCaptions to avoid duplicating in transcript
                setTimeout(() => {
                  speakFrontend(sentenceToReplay, { noCaptions: true }).catch(() => {});
                }, 100); // Small delay to ensure state is fully applied
              }
            }
          }
        } catch {}
      }
      
      return;
    }
    
    try { setOfferResume(false); } catch {}
    try { unlockAudioPlayback(); } catch {}
    try { preferHtmlAudioOnceRef.current = true; } catch {}
    try { forceNextPlaybackRef.current = true; } catch {}

### 12. .github/copilot-instructions.md (e52caea170745fc1683b39903882c41423525bdca8f3020661944d316c296134)
- bm25: -16.3842 | relevance: 1.0000

Local health-check sequence:
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere --help`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere project list`
- `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere doctor --project freehands`

When answering architecture questions or planning changes:
1. Build an evidence pack first:
   - `$env:COHERE_HOME = "$env:USERPROFILE\.coherence_apps\ms_sonoma"; py -m cohere pack "<question>" --project freehands --profile MsSonoma --out pack.md`
2. Use the pack’s chunk IDs as evidence anchors (the IDs are the provenance tokens).

### Asking Good Pack Questions (REQUIRED)

Do not ask abstract questions first. Anchor pack questions on one of:
- Exact error text / log line
- Route/path (e.g., `/session/discussion`, `/api/...`)
- File name / folder name
- Env var name
- UI label text
- Function/class identifier

Use these templates (copy/paste and fill in anchors):
- "Where is `<feature>` implemented end-to-end? List entrypoints, key files, and data flow."
- "Where is route `<route>` defined and what calls it? Include middleware and handlers."
- "Search for the exact string `<error or label>` and show the controlling code path."
- "What reads/writes `<data file or table>` and under what conditions?"
- "What configuration keys/env vars control `<system>` and where are they read?"
- "Given file `<path>`, what other modules depend on it (imports/calls) and why?"

If pack #1 doesn't contain the entrypoint you need:
1. Re-pack with a tighter anchor (prefer an exact string, route, or filename).
2. If still missing, ingest/sync the relevant subtree, then re-pack.

### 13. src/app/api/counselor/route.js (f720a6009787bc62743e7f63e0b51742f9c90a8657a55a12ad32b58bf8b8eee4)
- bm25: -16.2633 | relevance: 1.0000

CRITICAL ESCAPE MECHANISM - If You're Already Collecting Generation Parameters:
- If user responds with ANYTHING that is NOT a direct answer to the parameter you asked for, they are trying to ESCAPE generation
- Examples: You ask "What grade level?" and they say:
  - "I need recommendations" → NOT a grade level → ESCAPE
  - "I'm not ready to decide" → NOT a grade level → ESCAPE
  - "Stop asking me this" → NOT a grade level → ESCAPE
  - "Give me advice instead" → NOT a grade level → ESCAPE
  - "4th" → IS a grade level → continue
- When you detect ANY non-parameter response: IMMEDIATELY STOP collecting parameters, DO NOT call generate_lesson, respond conversationally and offer to search/recommend instead
- Re-assess what they actually want - they're telling you they don't want to generate
- Do NOT continue asking for the next parameter - they've changed their mind

### 14. src/app/api/counselor/route.js (bbe96737358ec09a99e8781bd7cca492756d24a00fa2642956561069de1d25b7)
- bm25: -15.8785 | relevance: 1.0000

8. SEARCH_CONVERSATION_HISTORY - Search past conversations with keywords
   - When they say "what did we discuss about X?" → USE THIS TOOL
   - When they want to review past advice or plans → USE THIS TOOL
   - Uses fuzzy matching to find relevant past conversations
   - Searches both current and archived conversations

### 15. src/app/api/counselor/route.js (41ed1e47a243141a65084c69991bd2a118bf522030273e874e8910f20508a4e1)
- bm25: -15.7286 | relevance: 1.0000

// Build system prompt with learner context and goals if available
    let systemPrompt = MENTOR_SYSTEM_PROMPT
    
    if (goalsNotes) {
      systemPrompt += `\n\n=== PERSISTENT GOALS & PRIORITIES ===\nThe facilitator has set these persistent goals that should guide all conversations:\n\nPersistent Goals:\n${goalsNotes}\n\n=== END PERSISTENT GOALS ===\n\nIMPORTANT: These goals persist across all conversations. Reference them when relevant, and help the facilitator work toward them. The facilitator can update these goals anytime using the Goals clipboard button (📋) on screen.`
    }
    
    if (learnerTranscript) {
      systemPrompt += `\n\n=== CURRENT LEARNER CONTEXT ===\nThe facilitator has selected a specific learner to discuss. Here is their profile and progress:\n\n${learnerTranscript}\n\n=== END LEARNER CONTEXT ===\n\nIMPORTANT INSTRUCTIONS FOR THIS LEARNER:\n- When generating lessons, ALWAYS use the grade level shown in the learner profile above\n- When scheduling lessons, you can use the learner's name (e.g., "Emma", "John") and the system will find them\n- When searching for lessons, consider their current grade level and adjust difficulty accordingly\n\nUse this information to provide personalized, data-informed guidance. Reference specific achievements, struggles, or patterns you notice. Ask questions that help the facilitator reflect on this learner's unique needs and progress.`
    }

### 16. src/app/session/page.js (b5af3a95d67fe36f3b7852cc768646525254bf2885d9ec61e0fd6671670a8db8)
- bm25: -15.4906 | relevance: 1.0000

const startTeachingUnifiedRepeat = async () => {
    // Repeat teaching with a different transition tone; avoid sounding like a fresh start.
    setCanSend(false);
    const prefix = teachingRepeats === 0
      ? "No problem. Let's look at it a little differently this time."
      : "Sure again. I'll rephrase and highlight the core steps one more time.";
    let instruction = [
      `${prefix} Re-teach the lesson strictly titled "${manifestInfo.title}" in a concise refreshed way:`,
      "1) Brief alternate angle: one or two sentences that restate the concept with a slightly different framing.",
      "2) One worked numeric example (different numbers than before) fully computed step by step.",
      "3) Compact recap of the exact procedural steps (no questions at the end).",
      // Declaration already given for teaching phase above; no need to restate the banned list. Re-emphasize no questions.
      "Follow prior teaching guardrails (no future-phase terms or additional questions).",
      getGradeAndDifficultyStyle(learnerGrade || getGradeNumber(), difficultyParam)
    ].join(" ");
    instruction = withTeachingNotes(instruction);
    const result = await callMsSonoma(instruction, "", {
      phase: "teaching",
      subject: subjectParam,
      difficulty: difficultyParam,
      lesson: lessonParam,
      lessonTitle: effectiveLessonTitle,
      step: "teaching-unified-repeat",
      teachingNotes: getTeachingNotes() || undefined,
      repeatCount: teachingRepeats + 1,
    });
    if (!result.success) return;
    setSubPhase("awaiting-gate");
    // Disable text input; gate is controlled by Yes/No UI buttons
    setCanSend(false);
    setTeachingRepeats((c) => c + 1);
  };

### 17. src/app/session/v2/SessionPageV2.jsx (bbb30079de6a0a197adb6210cef94fe952a3d50c49016c0bc44967b49a9a7f05)
- bm25: -15.4311 | relevance: 1.0000

﻿"use client";

/**
 * Session Page V2 - Full Session Flow
 * 
 * Architecture:
 * - PhaseOrchestrator: Manages phase transitions (teaching â†’ comprehension â†’ exercise â†’ worksheet â†’ test â†’ closing)
 * - TeachingController: Manages definitions â†’ examples
 * - ComprehensionPhase: Manages question â†’ answer â†’ feedback
 * - ExercisePhase: Manages multiple choice/true-false questions with scoring
 * - WorksheetPhase: Manages fill-in-blank questions with text input
 * - TestPhase: Manages graded test questions with review
 * - ClosingPhase: Manages closing message
 * - AudioEngine: Self-contained playback
 * - Event-driven: Zero state coupling between components
 * 
 * Enable via localStorage flag: localStorage.setItem('session_architecture_v2', 'true')
 */

### 18. src/app/session/v2/OpeningActionsController.jsx (d158101ce5835d6319f99663bc4dc8a83f94af48b1fc6abb9a13c6a9470db6b3)
- bm25: -15.1921 | relevance: 1.0000

/**
   * Accept a learner guess for the riddle (conversational input)
   * Uses simple normalization to compare against the answer and responds aloud.
   * @param {string} guess - Learner's guess typed in the shared input field
   */
  async submitRiddleGuess(guess) {
    if (this.#currentAction !== 'riddle') {
      return { success: false, error: 'Riddle action not active' };
    }

const attempt = String(guess || '').trim();
    if (!attempt) {
      return { success: false, error: 'Please enter a guess first.' };
    }

const normalize = (text) => String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

const answer = this.#actionState?.riddle?.answer || '';
    const isCorrect = normalize(attempt) && normalize(attempt) === normalize(answer);

let reply = '';
    if (isCorrect) {
      this.#actionState.stage = 'answer';
      reply = `You got it. The answer is ${answer}. Nice thinking.`;
    } else {
      const hint = this.#actionState?.riddle?.hint;
      const hintLine = hint ? `Try again. Hint: ${hint}` : 'Good try. Think about the clue words.';
      reply = hintLine;
    }

### 19. src/app/facilitator/generator/counselor/CounselorClient.jsx (617ee4db0dd1222e03213ca7f468d3f68d3ae8efceccf78fd57d05b1b887da0d)
- bm25: -14.6886 | relevance: 1.0000

// If a newer init attempt started, don't clobber its loading state.
      if (attemptId !== initAttemptIdRef.current) {
        return
      }

// Silent error handling
      setSessionLoading(false)
      if (initializedSessionIdRef.current === subjectKey) {
        initializedSessionIdRef.current = null
      }
    } finally {
      if (initInFlightSubjectRef.current === subjectKey) {
        initInFlightSubjectRef.current = null
      }
    }
  }, [sessionId, accessToken, hasAccess, tierChecked, subjectKey, assignSessionIdentifier, startRealtimeSubscription])

// Initialize session when all dependencies are ready
  useEffect(() => {
    // Only attempt initialization when all required dependencies are ready
    if (!accessToken || !hasAccess || !tierChecked) {
      // If we're still waiting for dependencies, keep loading state true only if we haven't checked yet
      if (tierChecked && (!hasAccess || !accessToken)) {
        // Dependencies are checked but we don't have access - stop loading
        setSessionLoading(false)
      }
      return
    }
    
    // Don't re-initialize if we've already initialized this subject
    if (initializedSessionIdRef.current === subjectKey) {
      return
    }

// Avoid duplicate in-flight init for the same subject
    if (initInFlightSubjectRef.current === subjectKey) {
      return
    }
    
    // All dependencies ready - initialize
    initializeMentorSession()
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, hasAccess, tierChecked, subjectKey, initializeMentorSession])

### 20. src/app/api/counselor/route.js (00b5f26e891312de11eeb26532f765e2d87080aad117921534b83bb52d622f7a)
- bm25: -14.3472 | relevance: 1.0000

Core Counseling Approach:
- Use active listening and empathetic reflection
- Ask open-ended, thought-provoking questions
- Practice Socratic questioning to help them discover their own solutions
- Validate their feelings and experiences
- Offer practical, actionable suggestions when appropriate
- Encourage growth mindset and self-compassion

Curriculum Planning Expertise:
- Understand homeschool standards for K-12
- Suggest age-appropriate topics and learning sequences
- Help create weekly, monthly, and yearly schedules
- Balance subjects (math, language arts, science, social studies, arts, PE)
- Accommodate different learning styles and special needs
- Recommend pacing and realistic expectations

YOUR TOOLS - YOU CAN USE THESE RIGHT NOW:

You have 8 function calling tools available. Use them actively during conversations:

1. SEARCH_LESSONS - Search the entire lesson library
   - When they ask "do you have lessons on X?" → USE THIS TOOL
   - When they mention a topic → SEARCH FOR IT
   - Searches: math, science, language arts, social studies, AND their custom lessons
   - To find THEIR lessons: use subject="facilitator"
   - Returns: up to 30 lessons with titles, grades, keys

2. GET_LESSON_DETAILS - View full lesson content
   - When you need to understand what's in a lesson → USE THIS TOOL
   - When they ask "tell me about lesson X" → USE THIS TOOL
   - Returns: vocabulary, teaching notes, question counts

### 21. src/app/facilitator/generator/counselor/CounselorClient.jsx (db65afa80af7229364d5c3e72e5c81d94ed0fc3ab9d95766fd9ac6a89e4466d6)
- bm25: -14.3351 | relevance: 1.0000

// Update draft summary in background (async, non-blocking)
      updateDraftSummary(finalHistory, token).catch(err => {
        // Silent error handling - don't block the UI
      })

} catch (err) {
      // Silent error handling
      enqueueToolThoughts([
        {
          id: `error-${Date.now()}`,
          name: 'system',
          phase: 'error',
          message: 'I hit a connection snag reaching the server. Please try once more.'
        }
      ])
      setError('Failed to reach Mr. Mentor. Please try again.')
    } finally {
      setLoading(false)
      setLoadingThought(null)
    }
  }, [userInput, loading, conversationHistory, playAudio, learnerTranscript, goalsNotes, selectedLearnerId, sessionStarted, currentSessionTokens, enqueueToolThoughts, handleLessonGeneration, continueLessonFollowUp, learners, loadAllLessons, getLoadingThought])

### 22. src/app/session/page.js (ed4716fef4536f0d4576c463b479be76fdd1c69df5e19e6bc044e080dd74f070)
- bm25: -14.3043 | relevance: 1.0000

// Global hotkeys for mute toggle, skip, and repeat
  useEffect(() => {
    const onKeyDown = (e) => {
      // Disable hotkeys when games overlay is active
      if (showGames) return;
      
      const code = e.code || e.key;
      const target = e.target;
      const targetIsInput = isTextEntryTarget(target);
      if (!hotkeys) return;

const { muteToggle, skip, repeat } = { ...DEFAULT_HOTKEYS, ...hotkeys };

if (muteToggle && code === muteToggle) {
        e.preventDefault();
        toggleMute?.();
        return;
      }

const nextSentence = hotkeys?.nextSentence || DEFAULT_HOTKEYS.nextSentence;
      const isNextSentenceKey = nextSentence && code === nextSentence;

// Prioritize Next Sentence behavior during the teaching gate (handles custom overlaps)
      if (
        isNextSentenceKey &&
        phase === 'teaching' &&
        subPhase === 'awaiting-gate' &&
        typeof handleGateNo === 'function'
      ) {
        // Only fire after TTS finishes (and loading completes) or has been skipped
        if (isSpeaking || teachingGateLocked) return;
        e.preventDefault();
        handleGateNo();
        return;
      }

if (skip && code === skip) {
        // Always stop default PageDown behavior so inputs don't hijack the key
        e.preventDefault();
        // Skip speech when speaking
        if (isSpeaking && typeof handleSkipSpeech === 'function') {
          handleSkipSpeech();
        }
        return;
      }

// Next Sentence hotkey (non-teaching contexts fall back to default behavior blocker only)
      if (isNextSentenceKey) {
        e.preventDefault();
        return;
      }

### 23. src/app/facilitator/generator/counselor/CounselorClient.jsx (0a683351f7dc5c5c7c3086137c646ede7a182a4d013cb6a702c19eceec58ed77)
- bm25: -14.2539 | relevance: 1.0000

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

### 24. src/app/facilitator/generator/counselor/CounselorClient.jsx (a45dbd911d3409ebc396c8165cc0db9b588036f208d6ada5bb9491bafd9a1298)
- bm25: -14.0611 | relevance: 1.0000

const js = await res.json().catch(() => null)
                if (!res.ok) {
                  interceptResult.response = js?.error
                    ? `I couldn't save curriculum preferences: ${js.error}`
                    : "I couldn't save curriculum preferences. Please try again."
                } else {
                  interceptResult.response = `Saved curriculum preferences for ${learnerName || 'this learner'}.`
                }
              } catch {
                interceptResult.response = "I couldn't save curriculum preferences. Please try again."
              }
            }
          } else if (action.type === 'save_weekly_pattern') {
            setLoadingThought('Saving weekly pattern...')

const supabase = getSupabaseClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

if (!token || !selectedLearnerId) {
              interceptResult.response = 'Please select a learner first.'
            } else {
              try {
                const getRes = await fetch(`/api/schedule-templates?learnerId=${selectedLearnerId}`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                })
                const getJs = await getRes.json().catch(() => null)
                const templates = Array.isArray(getJs?.templates) ? getJs.templates : []
                const activeTemplate = templates.find(t => t?.active) || templates[0] || null

const method = activeTemplate?.id ? 'PUT' : 'POST'
                const body = activeTemplate?.id
                  ? { id: activeTemplate.id, pattern: action.pattern }
                  : { learnerId: selectedLearnerId, name: 'Weekly Schedule', pattern: action.pattern, active: true }

### 25. sidekick_pack_takeover.md (6f6187342d1bd30b76953eb36920e8e0f4c27439e3c580f0956b638e2103dc86)
- bm25: -13.9742 | relevance: 1.0000

### 19. src/app/facilitator/generator/counselor/CounselorClient.jsx (10be640176aa3001fa165591b40335545d6f746743d098c06542da0a2e60f5a6)
- bm25: -5.7199 | relevance: 1.0000

// Initialize session when all dependencies are ready
  useEffect(() => {
    // Only attempt initialization when all required dependencies are ready
    if (!sessionId || !accessToken || !hasAccess || !tierChecked) {
      // If we're still waiting for dependencies, keep loading state true only if we haven't checked yet
      if (tierChecked && (!hasAccess || !accessToken)) {
        // Dependencies are checked but we don't have access - stop loading
        setSessionLoading(false)
      }
      return
    }
    
    // Don't re-initialize if we've already initialized this session ID
    if (initializedSessionIdRef.current === sessionId) {
      return
    }
    
    // Mark this session ID as initialized
    initializedSessionIdRef.current = sessionId
    
    // All dependencies ready - initialize
    initializeMentorSession()
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, accessToken, hasAccess, tierChecked])

### 20. src/app/facilitator/generator/counselor/CounselorClient.jsx (e4f5bc99879834ae8c23a3a7324906a509778d387d1ab5946654bae5d4d731b0)
- bm25: -5.7065 | relevance: 1.0000

// Send message to Mr. Mentor
  const sendMessage = useCallback(async () => {
    const message = userInput.trim()
    if (!message || loading) return

// Flags for generation confirmation flow
    let generationConfirmed = false
    const disableTools = []
    let declineNote = null

### 26. src/app/session/v2/SessionPageV2.jsx (1767526cdad621638cbfa2f915a7406226f1114442ba53b32bea0559f5e4b034)
- bm25: -13.9706 | relevance: 1.0000

const resolvedPhase = options?.ignoreResume
      ? (options?.startPhase || null)
      : (options?.startPhase || resumePhaseRef.current);
    const target = normalizeResumePhase(resolvedPhase);

// Resume flow (snapshot): start the orchestrator directly at the target phase.
    // Critical: do NOT start Discussion first then skip, because Discussion/Teaching can still complete
    // and override the manual skip later.
    if (target && target !== 'idle') {
      try {
        await orchestratorRef.current.startSession({ startPhase: target });
      } catch (e) {
        console.warn('[SessionPageV2] Resume startSession(startPhase) failed; starting fresh:', e);
        await orchestratorRef.current.startSession();
      }
    } else {
      await orchestratorRef.current.startSession();
    }
  };

const handleStartSessionClick = useCallback(async (options = {}) => {
    if (startSessionLoadingRef.current) return;
    startSessionLoadingRef.current = true;
    setStartSessionError('');
    setStartSessionLoading(true);
    try {
      await startSession(options);
    } catch (err) {
      const msg = (err && typeof err === 'object' && 'message' in err) ? String(err.message || '') : '';
      setStartSessionError(msg || 'Unable to start. Please try again.');
    } finally {
      startSessionLoadingRef.current = false;
      setStartSessionLoading(false);
    }
  }, [startSession]);

const handleSessionTakeover = useCallback(async (pinCode) => {
    const trackingLearnerId = sessionLearnerIdRef.current || learnerProfile?.id || null;
    const trackingLessonId = lessonKey || null;

if (!trackingLearnerId || !trackingLessonId || !browserSessionId) {
      throw new Error('Session not initialized');
    }

### 27. src/app/api/counselor/route.js (ec3d2f748169e692bf985c6c3da9fcc5c397f3bf5f396b9b0a9d3876cdc80138)
- bm25: -13.9324 | relevance: 1.0000

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

### 28. src/app/session/page.js (5a973c5013fbf83d26238fd5d326d2a84872f2d46e92685b4a2152b7920e5557)
- bm25: -13.7187 | relevance: 1.0000

// Prevent multiple simultaneous completions
    if (completionInProgressRef.current) {
      return;
    }
    completionInProgressRef.current = true;
    setCompletingLesson(true);

try {
      // Check if golden key was earned (3 on-time work phases completed)
      const earnedKey = checkGoldenKeyEarn();
      if (earnedKey) {
        // Increment golden key in database
        const learnerId = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
        if (learnerId && learnerId !== 'demo') {
          try {
            const { getLearner, updateLearner } = await import('@/app/facilitator/learners/clientApi');
            const learner = await getLearner(learnerId);
            if (learner) {
              await updateLearner(learnerId, {
                name: learner.name,
                grade: learner.grade,
                targets: {
                  comprehension: learner.comprehension,
                  exercise: learner.exercise,
                  worksheet: learner.worksheet,
                  test: learner.test
                },
                session_timer_minutes: learner.session_timer_minutes,
                golden_keys: (learner.golden_keys || 0) + 1
              });
            }
          } catch (err) {
            // Failed to increment key
          }
        }
      }

// Golden key message will be shown on the lessons page instead of blocking here
      // This allows immediate navigation without requiring a second button press

### 29. src/app/session/page.js (2a865c2dad358277ea421a936119ba567ebd5858438c9901d5292ae0ccb482a0)
- bm25: -13.5563 | relevance: 1.0000

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

### 30. src/app/session/page.js (ace7a5f0956fda91534cea55ad1952fc30e8005da794a03c815d6ea6a97400f3)
- bm25: -13.5289 | relevance: 1.0000

// Teaching flow hook (two-stage: definitions ? examples)
  const {
    promptGateRepeat: promptGateRepeatHook,
    teachDefinitions: teachDefinitionsHook,
    teachExamples: teachExamplesHook,
    startTwoStageTeaching: startTwoStageTeachingHook,
    handleGateYes: handleGateYesHook,
    handleGateNo: handleGateNoHook,
    moveToComprehensionWithCue: moveToComprehensionWithCueHook,
    isInSentenceMode,
    getTeachingFlowSnapshot,
    applyTeachingFlowSnapshot,
    vocabSentences,
    vocabSentenceIndex,
    exampleSentences,
    exampleSentenceIndex,
  } = useTeachingFlow_LEGACY_SESSION_V1_DISCONTINUED({
    // State setters
    setCanSend,
    setSubPhase,
    setPhase,
    setTeachingStage,
    setStageRepeats,
    setCaptionSentences,
    setCaptionIndex,
    setTtsLoadingCount,
    setCurrentCompProblem,
    // State values
    teachingStage,
    // Refs
    captionSentencesRef,
    // API & utilities
    callMsSonoma,
    speakFrontend,
    playAudioFromBase64,
    scheduleSaveSnapshot,
    ensureLessonDataReady,
    getAvailableVocab,
    getGradeNumber,
    getCleanLessonTitle,
    getTeachingNotes,
    splitIntoSentences,
    mergeMcChoiceFragments,
    enforceNbspAfterMcLabels,
    // Timer functions
    markWorkPhaseComplete,
    // Lesson context
    subjectParam,
    difficultyParam,
    lessonParam,
    effectiveLessonTitle,
    // Constants
    COMPREHENSION_CUE_PHRASE,
  });

// Keep bridge refs pointed at the latest hook helpers
  teachingFlowSnapshotGetRef.current = getTeachingFlowSnapshot;
  teachingFlowSnapshotApplyRef.current = applyTeachingFlowSnapshot;

### 31. sidekick_pack_loading_lessons.md (92cfd3be7aa969ae1ddeba972b66d04a8f07ebb8615b1f764e18666e784e6d6c)
- bm25: -13.4992 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
Lessons overlay stuck on 'Loading Lessons'. Find where Loading Lessons is rendered in LessonsOverlay and what controls the loading flag; identify why loadLessons might not run.
```

Filter terms used:
```text
LessonsOverlay
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

LessonsOverlay

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_api_mentor_session.md (4855132618822a362a64f503352c2317423f958b837508d272e5034660ab6c18)
- bm25: -4.2644 | entity_overlap_w: 2.00 | adjusted: -4.7644 | relevance: 1.0000

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ensurePinAllowed } from '@/app/lib/pinGate'
import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { featuresForTier, resolveEffectiveTier } from '@/app/lib/entitlements'
import { fetchLearnerTranscript } from '@/app/lib/learnerTranscript'
import { validateLessonQuality, buildValidationChangeRequest } from '@/app/lib/lessonValidation'
import ClipboardOverlay from './ClipboardOverlay'
import GoalsClipboardOverlay from './GoalsClipboardOverlay'
import CalendarOverlay from './overlays/CalendarOverlay'
import LessonsOverlay from './overlays/LessonsOverlay'
import LessonMakerOverlay from './overlays/LessonMakerOverlay'
import MentorThoughtBubble from './MentorThoughtBubble'
import SessionTakeoverDialog from './SessionTakeoverDialog'
import MentorInterceptor from './MentorInterceptor'

### 32. src/app/facilitator/generator/counselor/overlays/LessonsOverlay.jsx (40cba0c1620cfc70a82293aab5d2161fa369ab53c7d2f6c9e9ea97cc900659e5)
- bm25: -13.1649 | relevance: 1.0000

try {
      const supabase = getSupabaseClient()
      if (!supabase) throw new Error('Not authenticated')
      const { error } = await supabase.from('learners').update({ approved_lessons: next }).eq('id', learnerId)
      if (error) throw error
    } catch (err) {
      // Silent error handling
      alert('Failed to update lesson availability. Please try again.')
      setApprovedLessons(previous)
    } finally {
      setSaving(false)
    }
  }, [approvedLessons, learnerId])

### 33. src/app/facilitator/generator/counselor/CounselorClient.jsx (5db03db2c11dac25dae1e665464f84e796cf7d5370aa2fa1b34dea3dee12cf45)
- bm25: -13.1514 | relevance: 1.0000

// Clear conversation and start fresh
      await clearConversationAfterSave()
      
      setShowClipboard(false)
      setClipboardInstructions(false)
      
      alert('Conversation saved to memory!')
    } catch (err) {
      // Silent error handling
      alert('Failed to save conversation. Please try again.')
    }
  }, [conversationHistory, selectedLearnerId])

### 34. src/app/session/page.js (72cf4138f2f4f30f0aa18a75b1c5f1abb16dd54343065cda8c1b478c2983cf3e)
- bm25: -13.1381 | relevance: 1.0000

// Ask-a-question flow: route learner's question to Ms. Sonoma, then ask for confirmation
    if (askState === 'awaiting-input') {
      setCanSend(false);
      setAskOriginalQuestion(trimmed);
      // Derive a grade level if present in lesson or title (e.g., "4th", "10th")
      const source = (lessonParam || effectiveLessonTitle || '').toString();
      const gradeMatch = source.match(/\b(1st|2nd|3rd|[4-9]th|1[0-2]th)\b/i);
      const gradeLevel = gradeMatch ? gradeMatch[0] : '';
      // Try to load the lesson JSON so we can surface vocab for this Ask
      let vocabChunk = '';
      try {
        const data = await ensureLessonDataReady();
        const rawVocab = Array.isArray(data?.vocab) ? data.vocab : null;
        if (rawVocab && rawVocab.length) {
          // Normalize to up to 12 terms; include short definitions when provided
          const items = rawVocab.slice(0, 12).map(v => {
            if (typeof v === 'string') return { term: v, definition: '' };
            const term = (v && (v.term || v.word || v.title || v.key || '')) || '';
            const def = (v && (v.definition || v.meaning || v.explainer || '')) || '';
            return { term: String(term), definition: String(def) };
          }).filter(x => x.term);
          if (items.length) {
            const withDefs = items.some(x => x.definition);
            if (withDefs) {
              // Keep it brief: include at most 6 definition pairs to avoid bloating the prompt
              const pairs = items.slice(0, 6).map(x => `${x.term}: ${x.definition}`).join('; ');
              vocabChunk = `Relevant vocab for this lesson (use naturally): ${pairs}.`;
            } else {
              const list = items.map(x => x.term).join(', ');
              vocabChunk = `Relevant vocab for this lesson (

### 35. src/app/api/counselor/route.js (baa067605de92aac7f3e09489a835666b3bda1172a2a7fe55c4d6e05fc67c128)
- bm25: -13.0406 | relevance: 1.0000

CRITICAL: When someone asks about lessons, DON'T say "I can't access" or "I'm unable to" - JUST USE THE SEARCH TOOL.
CRITICAL: When someone asks you to schedule a lesson, you MUST call the schedule_lesson function. DO NOT confirm scheduling without actually calling it.
CRITICAL: NEVER say "I've scheduled" or "has been scheduled" unless you actually called the schedule_lesson function and got a success response.
CRITICAL: When someone asks you to assign a lesson to a learner (make it available), you MUST call the assign_lesson function. DO NOT confirm assignment without actually calling it.
CRITICAL: NEVER say "I've assigned" unless you actually called assign_lesson and got a success response.
If you need details on parameters, call get_capabilities first.
Use these tools proactively - they expect you to search and find things for them.

Best Practices:
1. Search first - they may have already created what they need
2. To find THEIR lessons: search with subject="facilitator"
3. Get details to understand lesson scope before recommending
4. Confirm actions: "I found 3 lessons you created on fractions..."
5. Keep it conversational - never mention "function calls" or technical details

Response Style:
- Keep responses conversational and warm (2-4 paragraphs typically)
- Speak naturally as a caring professional, not overly formal
- Use "you" and "your" to maintain connection
- Share insights with humility ("In my experience..." "Many parents find...")
- Acknowledge the complexity of parenting and teaching

### 36. src/app/facilitator/generator/counselor/CounselorClient.jsx (a77d6a2bc87ff58a6be8207400929e3301b200054a499968f4182930eead0410)
- bm25: -13.0077 | relevance: 1.0000

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

### 37. src/app/facilitator/generator/counselor/CounselorClient.jsx (731c3d69b371dcd3640f6369114a3d5051c27585afbf54cfe741b30c504a9ddb)
- bm25: -12.9711 | relevance: 1.0000

const supabase = getSupabaseClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

if (!token) {
              interceptResult.response = 'Please sign in first.'
            } else {
              try {
                const listRes = await fetch('/api/custom-subjects', {
                  headers: { 'Authorization': `Bearer ${token}` }
                })
                const listJs = await listRes.json().catch(() => null)
                const subjects = Array.isArray(listJs?.subjects) ? listJs.subjects : []
                const target = subjects.find(s => String(s?.name || '').toLowerCase() === String(action.name || '').trim().toLowerCase())

### 38. sidekick_pack_completions_mismatch2.md (1e89ee9d2bae12d591c47b307dd5f759a693b8159b2a9a8b0021fac76fc2a10c)
- bm25: -12.8000 | relevance: 1.0000

### 8. sidekick_pack_completions_mismatch.md (4d70ffb6cf5bf342adef7c9b1b576c15f6b660105427e60170e67a2b73029e01)
- bm25: -13.9598 | entity_overlap_w: 2.50 | adjusted: -14.5848 | relevance: 1.0000

# Cohere Pack (Sidekick Recon) - MsSonoma

Project: freehands
Profile: MsSonoma
Mode: standard

Prompt (original):
```text
V2 completed lessons mismatch: Calendar vs Completed Lessons page vs Awards (medals). Find where lesson completion is recorded in V2 (session/teaching flow), where each screen pulls data (lesson history API, medals API, lesson schedule API), and identify why completions are missing (Emma).
```

Filter terms used:
```text
API
```
# Context Pack

**Project**: freehands
**Profile**: MsSonoma
**Mode**: standard

## Pack Contract

This pack is mechanically assembled: forced canonical context first, then ranked evidence until relevance saturates.

## Question

API

## Forced Context

(none)

## Ranked Evidence

### 1. sidekick_pack_mentor_schema.md (799992b6a1ce2f36ba290f1138f2018a0234f611b1ea4868ee056ceced015f6c)
- bm25: -0.4452 | entity_overlap_w: 2.60 | adjusted: -1.0952 | relevance: 1.0000

### 39. src/app/facilitator/calendar/page.js (5e87d7c4007b60bd8dc94a3654ecdcc51bd79003e2d025df44b062ea052b69f4)
- bm25: -2.6162 | entity_overlap_w: 1.00 | adjusted: -2.8662 | relevance: 1.0000

### 39. src/app/session/page.js (8eeadfdc4be8a4a4d71970358a8ad1cb1e5343c7a837a813926fb2163891f55e)
- bm25: -12.7869 | relevance: 1.0000

// Deterministic non-test leniency clauses
  const tf_leniency = 'True/False leniency (tf_leniency): Accept a single-letter T or F (case-insensitive) only when the reply is one letter. Accept a single-token yes/no mapped to true/false. Also accept if a whole token equals true/false and it matches the correct boolean.';
  const mc_leniency = 'Multiple choice leniency (mc_leniency): Accept the choice letter label (A, B, C, D), case-insensitive, that matches the correct choice. Or accept full normalized equality to the correct choice text. If key_terms are provided for the correct choice, accept when all key terms appear (order-free; whole tokens).';
  const sa_leniency = 'Short answer leniency (sa_leniency): Accept when the normalized reply contains the canonical correct answer as whole tokens; or accept when it meets min_required matches of key_terms where each term may match itself or any listed direct_synonyms. Only listed direct synonyms count. Ignore fillers and politeness; be case-insensitive; ignore punctuation; collapse spaces; map number words zero to twenty to digits.';
  const sa_leniency_3 = 'Short answer third-try leniency (sa_leniency_3): Same as short answer leniency. When non_advance_count is 2 or more, the hint in feedback must include the exact correct answer once before re-asking.';

const isOpenEndedTestItem = (q) => {
    const t = String(q?.type || '').toLowerCase();
    if (t === 'mc' || t === 'multiplechoice' || q?.isMC) return false;
    if (t === 'tf' || t === 'truefalse' || q?.isTF) return false;
    return true;
  };

### 40. src/app/facilitator/generator/counselor/CounselorClient.jsx (6c923bd4a850d44cef5d8f8b07d753de635d3f87f66ddcc18987e5caa20bbb31)
- bm25: -12.6844 | relevance: 1.0000

const saveJs = await saveRes.json().catch(() => null)
                if (!saveRes.ok) {
                  interceptResult.response = saveJs?.error
                    ? `I couldn't save the weekly pattern: ${saveJs.error}`
                    : "I couldn't save the weekly pattern. Please try again."
                } else {
                  interceptResult.response = `Weekly pattern saved for ${learnerName || 'this learner'}.`
                }
              } catch {
                interceptResult.response = "I couldn't save the weekly pattern. Please try again."
              }
            }
          } else if (action.type === 'add_custom_subject') {
            setLoadingThought('Adding custom subject...')

const supabase = getSupabaseClient()
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token
