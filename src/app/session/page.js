"use client";

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react";
import { ensurePinAllowed } from "../lib/pinGate";
import { getHotkeysLocal, fetchHotkeysServer, DEFAULT_HOTKEYS, isTextEntryTarget } from "../lib/hotkeys";
import { useRouter, useSearchParams } from "next/navigation";
import { jsPDF } from "jspdf";
import { loadRuntimeVariables } from "../lib/runtimeVariables";
import { getSupabaseClient } from "../lib/supabaseClient";
import { appendTranscriptSegment, updateTranscriptLiveSegment } from "../lib/transcriptsClient";
import { getLearner, updateLearner } from "@/app/facilitator/learners/clientApi";
// SpinnerScreen removed here; reverting to in-panel overlay spinner
import { generateOpening } from "../lib/opening";
import { pickNextJoke, renderJoke, normalizeHumorLevel } from "../lib/jokes";
const { COMPREHENSION_INTROS, EXERCISE_INTROS, WORKSHEET_INTROS, TEST_INTROS } = require('./constants/phaseIntros.js');
import { pickNextRiddle, renderRiddle } from "../lib/riddles";
import { getStoredAssessments, saveAssessments, clearAssessments } from './assessment/assessmentStore';
import { getStoredSnapshot, saveSnapshot, clearSnapshot, consolidateSnapshots } from './sessionSnapshotStore';
import { upsertMedal, emojiForTier, tierForPercent } from '@/app/lib/medalsClient';
import { splitIntoSentences, mergeMcChoiceFragments, enforceNbspAfterMcLabels, countWords } from './utils/textProcessing';
import { CLEAN_SPEECH_INSTRUCTION, GUARD_INSTRUCTION, KID_FRIENDLY_STYLE, COMPREHENSION_CUE_PHRASE, timelinePhases, phaseLabels, discussionSteps, getTeachingSteps, getGradeAndDifficultyStyle } from './utils/constants';
import { buildSystemMessage, buildPerQuestionJudgingSpec } from './utils/systemMessage';
import { resolveLessonInfo, getLessonTitle } from './utils/lessonUtils';
import { formatQuestionForSpeech, isShortAnswerItem, isFillInBlank, isTrueFalse, isMultipleChoice, formatMcOptions, ensureQuestionMark, promptKey, deriveCorrectAnswerText, formatQuestionForInlineAsk, letterForAnswer, getOptionTextForLetter, naturalJoin } from './utils/questionFormatting';
import { normalizeAnswer } from './utils/answerNormalization';
import { isAnswerCorrectLocal, expandExpectedAnswer, expandRiddleAcceptables, composeExpectedBundle } from './utils/answerEvaluation';
import { ENCOURAGEMENT_SNIPPETS, CELEBRATE_CORRECT, HINT_FIRST, HINT_SECOND, pickHint, buildCountCuePattern } from './utils/feedbackMessages';
import { generateClosing, getSimpleEncouragement } from './utils/closingSignals';
import { getJokePrompt } from './utils/openingSignals';
import { normalizeBase64Audio, base64ToArrayBuffer, makeSilentWavDataUrl, ensureAudioContext, stopWebAudioSource, playViaWebAudio, unlockAudioPlayback, requestAudioAndMicPermissions, playVideoWithRetry } from './utils/audioUtils';
import { clearCaptionTimers as clearCaptionTimersUtil, scheduleCaptionsForAudio as scheduleCaptionsForAudioUtil, scheduleCaptionsForDuration as scheduleCaptionsForDurationUtil } from './utils/captionUtils';
import { clearSynthetic as clearSyntheticUtil, finishSynthetic as finishSyntheticUtil, pauseSynthetic as pauseSyntheticUtil, resumeSynthetic as resumeSyntheticUtil } from './utils/syntheticPlaybackUtils';
import { buildQAPool as buildQAPoolUtil, ensureExactCount as ensureExactCountUtil, initWordDeck as initWordDeckUtil, drawWordUnique as drawWordUniqueUtil } from './utils/assessmentGenerationUtils';
// REMOVED: initSampleDeck, drawSampleUnique, reserveSamples - sample array deprecated
import { getSnapshotStorageKey as getSnapshotStorageKeyUtil, scheduleSaveSnapshotCore } from './utils/snapshotPersistenceUtils';
import { clearSpeechGuard as clearSpeechGuardUtil, forceStopSpeaking as forceStopSpeakingUtil, armSpeechGuard as armSpeechGuardUtil, armSpeechGuardThrottled as armSpeechGuardThrottledUtil } from './utils/speechGuardUtils';
import { checkLearnerInput } from './utils/profanityFilter';
import { useDiscussionHandlers } from './hooks/useDiscussionHandlers';
import { useAudioPlayback } from './hooks/useAudioPlayback';
import { usePhaseHandlers } from './hooks/usePhaseHandlers';
import { useAssessmentGeneration } from './hooks/useAssessmentGeneration';
import { useTeachingFlow } from './hooks/useTeachingFlow';
import { useAssessmentDownloads } from './hooks/useAssessmentDownloads';
import { useSessionTracking } from '../hooks/useSessionTracking';
import { useSnapshotPersistence } from './hooks/useSnapshotPersistence';
import { useResumeRestart } from './hooks/useResumeRestart';
import SessionTimer from './components/SessionTimer';
import GatedOverlay from '../components/GatedOverlay';

export default function SessionPage(){
  return (
    <Suspense fallback={null}>
      <SessionPageInner />
    </Suspense>
  );
}

// Targets are loaded dynamically per-user.
let COMPREHENSION_TARGET = 3;
let EXERCISE_TARGET = 5;
let WORKSHEET_TARGET = 15;
let TEST_TARGET = 10;

// Dynamically load per-user targets at runtime (recomputed on each call)
async function ensureRuntimeTargets(forceReload = false) {
  try {
    const vars = await loadRuntimeVariables();
    const t = vars?.targets || {};
    COMPREHENSION_TARGET = (t.comprehension ?? t.discussion ?? COMPREHENSION_TARGET ?? 3);
    EXERCISE_TARGET = (t.exercise ?? EXERCISE_TARGET ?? 5);
    WORKSHEET_TARGET = (t.worksheet ?? WORKSHEET_TARGET ?? 15);
    TEST_TARGET = (t.test ?? TEST_TARGET ?? 10);

    const learnerId = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
    const learnerName = typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null;

    if (learnerId && learnerId !== 'demo') {
      try {
        const learner = await getLearner(learnerId);
        if (learner) {
          const n = (v) => (v == null ? undefined : Number(v));
          COMPREHENSION_TARGET = n(learner.comprehension ?? learner.targets?.comprehension) ?? COMPREHENSION_TARGET;
          EXERCISE_TARGET = n(learner.exercise ?? learner.targets?.exercise) ?? EXERCISE_TARGET;
          WORKSHEET_TARGET = n(learner.worksheet ?? learner.targets?.worksheet) ?? WORKSHEET_TARGET;
          TEST_TARGET = n(learner.test ?? learner.targets?.test) ?? TEST_TARGET;
          const humorLevel = normalizeHumorLevel(learner.humor_level);
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem('learner_humor_level', humorLevel);
              if (learnerId && learnerId !== 'demo') {
                localStorage.setItem(`learner_humor_level_${learnerId}`, humorLevel);
              }
            } catch {}
          }
        }
      } catch (e) {
        console.warn('[Session] Failed to load learner data:', e);
      }
    } else if (learnerName && learnerName !== 'Demo Learner') {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('facilitator_learners') : null;
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list)) {
            const match = list.find(l => l && (l.name === learnerName || l.full_name === learnerName));
            if (match) {
              const n = (v) => (v == null ? undefined : Number(v));
              COMPREHENSION_TARGET = n(match.comprehension ?? match.targets?.comprehension) ?? COMPREHENSION_TARGET;
              EXERCISE_TARGET = n(match.exercise ?? match.targets?.exercise) ?? EXERCISE_TARGET;
              WORKSHEET_TARGET = n(match.worksheet ?? match.targets?.worksheet) ?? WORKSHEET_TARGET;
              TEST_TARGET = n(match.test ?? match.targets?.test) ?? TEST_TARGET;
              const humorLevel = normalizeHumorLevel(match.humor_level);
              if (typeof window !== 'undefined') {
                try {
                  localStorage.setItem('learner_humor_level', humorLevel);
                  if (match.id) {
                    localStorage.setItem(`learner_humor_level_${match.id}`, humorLevel);
                  }
                } catch {}
              }
            }
          }
        }
      } catch {/* ignore parse errors */}
    }

    // Local overrides (per-learner first, then global)
    const currentId = learnerId && learnerId !== 'demo' ? learnerId : null;
    if (currentId) {
      const lc = Number(localStorage.getItem(`target_comprehension_${currentId}`));
      const le = Number(localStorage.getItem(`target_exercise_${currentId}`));
      const lw = Number(localStorage.getItem(`target_worksheet_${currentId}`));
      const lt = Number(localStorage.getItem(`target_test_${currentId}`));
      if (!Number.isNaN(lc) && lc > 0) COMPREHENSION_TARGET = lc;
      if (!Number.isNaN(le) && le > 0) EXERCISE_TARGET = le;
      if (!Number.isNaN(lw) && lw > 0) WORKSHEET_TARGET = lw;
      if (!Number.isNaN(lt) && lt > 0) TEST_TARGET = lt;
    } else {
      const lc = Number(localStorage.getItem('target_comprehension'));
      const le = Number(localStorage.getItem('target_exercise'));
      const lw = Number(localStorage.getItem('target_worksheet'));
      const lt = Number(localStorage.getItem('target_test'));
      if (!Number.isNaN(lc) && lc > 0) COMPREHENSION_TARGET = lc;
      if (!Number.isNaN(le) && le > 0) EXERCISE_TARGET = le;
      if (!Number.isNaN(lw) && lw > 0) WORKSHEET_TARGET = lw;
      if (!Number.isNaN(lt) && lt > 0) TEST_TARGET = lt;
    }
  } catch (error) {
    console.error('[Session] Error loading runtime targets:', error);
  }
}
  
function SessionPageInner() {
  // URL params defined earlier; reuse here without redeclaration

  // Core session state that many effects/handlers depend on must be initialized first
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showRepeatButton, setShowRepeatButton] = useState(false);
  const [phase, setPhase] = useState("discussion");
  const [subPhase, setSubPhase] = useState("greeting");
  
  // URL params: subject/lesson/difficulty with safe defaults used throughout this component
  // Kept near the top so any effects/handlers can safely reference them without TDZ issues
  const searchParams = useSearchParams();
  const router = useRouter();
  const subjectParam = (searchParams?.get('subject') || 'math').toLowerCase();
  const lessonParam = searchParams?.get('lesson') || '';
  const difficultyParam = (searchParams?.get('difficulty') || 'beginner').toLowerCase();
  const goldenKeyFromUrl = searchParams?.get('goldenKey') === 'true';
  
  // Track whether this lesson has an active golden key (from URL or persisted in DB)
  const [hasGoldenKey, setHasGoldenKey] = useState(goldenKeyFromUrl);
  const [trackingLearnerId, setTrackingLearnerId] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const storedId = localStorage.getItem('learner_id');
      if (storedId && storedId !== 'demo') {
        setTrackingLearnerId(storedId);
      } else {
        setTrackingLearnerId(null);
      }
    } catch {
      setTrackingLearnerId(null);
    }
  }, []);

  const lessonSessionKey = useMemo(() => {
    if (!subjectParam || !lessonParam) return null;
    return `${subjectParam}/${lessonParam}`;
  }, [subjectParam, lessonParam]);

  const {
    startSession: startTrackedSession,
    endSession: endTrackedSession,
  } = useSessionTracking(
    trackingLearnerId,
    lessonSessionKey,
    false
  );
  
  // Force target reload when learner changes
  const reloadTargetsForCurrentLearner = useCallback(async () => {
    // Reset targets to defaults first
    COMPREHENSION_TARGET = 3;
    EXERCISE_TARGET = 5;
    WORKSHEET_TARGET = 15;
    TEST_TARGET = 10;
    
    // Force fresh load
    await ensureRuntimeTargets(true);
  }, []);

  useEffect(() => {
    // Load runtime & learner targets once on mount
    reloadTargetsForCurrentLearner();
  }, [reloadTargetsForCurrentLearner]);

  // Discussion: post-Opening action buttons state
  const [showOpeningActions, setShowOpeningActions] = useState(false);
  // Gate quick-answer buttons until the learner presses "Start the lesson" for the first item in each Q&A phase
  const [qaAnswersUnlocked, setQaAnswersUnlocked] = useState(false);
  const [jokeUsedThisGate, setJokeUsedThisGate] = useState(false);
  const [riddleUsedThisGate, setRiddleUsedThisGate] = useState(false);
  const [poemUsedThisGate, setPoemUsedThisGate] = useState(false);
  // Track when the current caption batch has fully displayed (end-of-captions signal)
  const [captionsDone, setCaptionsDone] = useState(false);
  // Ad-hoc Q&A flow state
  // askState: 'inactive' | 'awaiting-input' | 'awaiting-confirmation'
  const [askState, setAskState] = useState('inactive');
  // Store the body of the active Q&A question at Ask start so we can reliably recap it after Ask ends
  const askReturnBodyRef = useRef('');
  // Track the last spoken Q&A question body (with MC/numbering formatting)
  const activeQuestionBodyRef = useRef('');
  const [askOriginalQuestion, setAskOriginalQuestion] = useState('');
  // Riddle state (hoisted before handlers to avoid TDZ in dependencies)
  const [riddleState, setRiddleState] = useState('inactive'); // 'inactive' | 'presented' | 'awaiting-solve'
  const [currentRiddle, setCurrentRiddle] = useState(null); // { id, text, answer }
  // Poem state
  // poemState: 'inactive' | 'awaiting-topic' | 'awaiting-ok'
  const [poemState, setPoemState] = useState('inactive');
  const [showPoemSuggestions, setShowPoemSuggestions] = useState(false);
  // Story state
  // storyState: 'inactive' | 'awaiting-setup' | 'awaiting-turn' | 'ending'
  const [storyState, setStoryState] = useState('inactive');
  const [storyUsedThisGate, setStoryUsedThisGate] = useState(false);
  // Story transcript: array of {role: 'user'|'assistant', text: string}
  const [storyTranscript, setStoryTranscript] = useState([]);
  // Story setup: tracks collection of characters, setting, and plot
  const [storySetupStep, setStorySetupStep] = useState(''); // 'characters' | 'setting' | 'plot' | 'complete'
  const [storyCharacters, setStoryCharacters] = useState('');
  const [storySetting, setStorySetting] = useState('');
  const [storyPlot, setStoryPlot] = useState('');
  // Track which phase the story started in (to know if we're continuing across phases)
  const [storyPhase, setStoryPhase] = useState('');
  // Fill-in-Fun state
  // fillInFunState: 'inactive' | 'loading' | 'collecting-words' | 'awaiting-ok'
  const [fillInFunState, setFillInFunState] = useState('inactive');
  const [fillInFunUsedThisGate, setFillInFunUsedThisGate] = useState(false);
  // Template structure: { template: string, words: [{type, label, prompt}] }
  const [fillInFunTemplate, setFillInFunTemplate] = useState(null);
  // Collected words: { label1: 'word1', label2: 'word2', ... }
  const [fillInFunCollectedWords, setFillInFunCollectedWords] = useState({});
  // Current word index being collected
  const [fillInFunCurrentIndex, setFillInFunCurrentIndex] = useState(0);
  // When a snapshot is restored on mount, surface a Resume/Restart offer in the footer
  const [offerResume, setOfferResume] = useState(false);

  // Session Timer state
  const [timerPaused, setTimerPaused] = useState(false);
  const [sessionTimerMinutes, setSessionTimerMinutes] = useState(60); // Default 1 hour
  const [goldenKeyEarned, setGoldenKeyEarned] = useState(false);
  
  // Learner grade state (for grade-appropriate speech)
  const [learnerGrade, setLearnerGrade] = useState('');
  
  // Lesson quota gate state
  const [showQuotaGate, setShowQuotaGate] = useState(false);
  const [quotaGateInfo, setQuotaGateInfo] = useState({ remaining: 0, limit: 0, tier: 'free' });
  
  // Ask feature gate state (for demo lessons)
  const [showAskGate, setShowAskGate] = useState(false);
  
  // Debug: Log when showAskGate changes
  useEffect(() => {
    console.log('[Ask Gate] showAskGate state changed to:', showAskGate);
  }, [showAskGate]);
  
  // User tier state for feature gating
  const [userTier, setUserTier] = useState('free');
  
  // Helper: check if Ask feature is allowed (requires Basic+ tier)
  const askFeatureAllowed = useMemo(() => {
    const { ENTITLEMENTS } = require('../lib/entitlements');
    const entitlement = ENTITLEMENTS[userTier] || ENTITLEMENTS.free;
    return entitlement.askFeature;
  }, [userTier]);
  
  // Helper: get Ask button click handler (demo lessons show gate, others require tier)
  const getAskButtonHandler = useCallback((originalHandler) => {
    const isDemoLesson = subjectParam === 'demo';
    console.log('[Ask Button] getAskButtonHandler called - isDemoLesson:', isDemoLesson, 'askFeatureAllowed:', askFeatureAllowed);
    if (isDemoLesson || !askFeatureAllowed) {
      // Demo lessons or users without feature: show gate
      return () => {
        console.log('[Ask Button] Showing ask gate overlay');
        setShowAskGate(true);
      };
    }
    // Users with feature: execute original handler
    console.log('[Ask Button] Returning original handler');
    return originalHandler;
  }, [subjectParam, askFeatureAllowed]);
  
  // Helper: check if Ask button should be disabled (never disabled now - always clickable to show gate or execute)
  const isAskButtonDisabled = useMemo(() => {
    return false; // Always enabled so users can click to see gate
  }, []);
  
  // Helper: check if golden key features (Poem/Story) are allowed
  const goldenKeyFeaturesAllowed = useMemo(() => {
    // Golden key features require an active golden key on this lesson
    // All tiers can use them if they have a golden key
    return hasGoldenKey;
  }, [hasGoldenKey]);
  
  // Load user tier from profile
  useEffect(() => {
    (async () => {
      try {
        const supabase = getSupabaseClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('plan_tier')
            .eq('id', user.id)
            .single();
          
          if (profile?.plan_tier) {
            setUserTier(profile.plan_tier);
            console.info('[Session] User tier loaded:', profile.plan_tier);
          } else {
            setUserTier('free');
          }
        } else {
          setUserTier('free');
        }
      } catch (e) {
        console.warn('[Session] Failed to load user tier:', e);
        setUserTier('free');
      }
    })();
  }, []);

  // Load timer setting, grade, and check for active golden keys on this lesson
  useEffect(() => {
    (async () => {
      try {
        const learnerId = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
        if (learnerId && learnerId !== 'demo') {
          const learner = await getLearner(learnerId);
          if (learner?.session_timer_minutes) {
            setSessionTimerMinutes(Number(learner.session_timer_minutes));
            console.info('[Session] Timer duration loaded:', learner.session_timer_minutes, 'minutes');
          } else {
            setSessionTimerMinutes(60); // Reset to default if not set
            console.info('[Session] No timer setting found, using default 60 minutes');
          }
          // Load learner grade
          if (learner?.grade) {
            setLearnerGrade(learner.grade);
            console.info('[Session] Learner grade loaded:', learner.grade);
          } else {
            setLearnerGrade(''); // Clear if not set
          }
          
          // Check for active golden key on this lesson
          const lessonKey = `${subjectParam}/${lessonParam}`;
          const activeKeys = learner?.active_golden_keys || {};
          if (activeKeys[lessonKey]) {
            setHasGoldenKey(true);
            console.info('[Golden Key] Found active golden key for this lesson:', lessonKey);
          } else if (goldenKeyFromUrl) {
            // New golden key usage - save it to the database
            setHasGoldenKey(true);
            console.info('[Golden Key] Saving new golden key usage for lesson:', lessonKey);
            try {
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
                golden_keys: learner.golden_keys, // Don't decrement here - already done in learn/lessons page
                active_golden_keys: {
                  ...activeKeys,
                  [lessonKey]: true
                }
              });
              console.info('[Golden Key] Successfully saved golden key usage');
            } catch (err) {
              console.error('[Golden Key] Failed to save golden key usage:', err);
            }
          }
        } else {
          setSessionTimerMinutes(60); // Default for demo or no learner
          setLearnerGrade(''); // Clear grade for demo
        }
      } catch (e) {
        console.warn('[Session] Failed to load timer setting and grade:', e);
        setSessionTimerMinutes(60); // Fallback to default on error
        setLearnerGrade('');
      }
    })();
  }, [subjectParam, lessonParam, goldenKeyFromUrl]); // Re-run when lesson changes
  
  // Also listen for storage changes to pick up timer and grade updates from facilitator page
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'facilitator_learners' || e.key === 'learner_id') {
        // Reload timer setting and grade when learner data changes
        (async () => {
          try {
            const learnerId = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
            if (learnerId && learnerId !== 'demo') {
              const learner = await getLearner(learnerId);
              if (learner?.session_timer_minutes) {
                setSessionTimerMinutes(Number(learner.session_timer_minutes));
                console.info('[Session] Timer duration updated from storage change:', learner.session_timer_minutes, 'minutes');
              }
              if (learner?.grade) {
                setLearnerGrade(learner.grade);
                console.info('[Session] Learner grade updated from storage change:', learner.grade);
              }
            }
          } catch (e) {
            console.warn('[Session] Failed to reload timer setting and grade:', e);
          }
        })();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Handle timer pause/resume with PIN verification
  const handleTimerPauseToggle = useCallback(async () => {
    // Only require PIN when pausing (not when resuming)
    if (!timerPaused) {
      const ok = await ensurePinAllowed('timer');
      if (!ok) return;
    }
    setTimerPaused(prev => !prev);
  }, [timerPaused]);

  // Handle timer completion
  const handleTimeUp = useCallback(() => {
    // When time is up, show warning but allow learner to continue
    if (typeof window !== 'undefined') {
      alert('Time is up! Complete the lesson to see if you earned the golden key.');
    }
  }, []);

  // Reset opening actions visibility on begin and on major phase changes
  useEffect(() => {
    if (phase === 'discussion' && subPhase === 'unified-discussion') {
      setShowOpeningActions(false);
      setJokeUsedThisGate(false);
      setRiddleUsedThisGate(false);
      setPoemUsedThisGate(false);
      setFillInFunUsedThisGate(false);
      // Story persists across phases - don't reset storyUsedThisGate or clear transcript
      // Only clear story when starting a completely new session
    }
  }, [phase, subPhase]);

  // After Opening finishes speaking and we are awaiting-learner, show action buttons
  // Only when not in Ask, Riddle, Poem, or Story flows
  useEffect(() => {
    if (
      !isSpeaking &&
      phase === 'discussion' &&
      subPhase === 'awaiting-learner' &&
      askState === 'inactive' &&
      riddleState === 'inactive' &&
      poemState === 'inactive' &&
      storyState === 'inactive' &&
      fillInFunState === 'inactive'
    ) {
      setShowOpeningActions(true);
    }
  }, [isSpeaking, phase, subPhase, askState, riddleState, poemState, storyState, fillInFunState]);

  // Also reveal Opening actions when the captions finish (even if audio is still playing)
  useEffect(() => {
    if (
      captionsDone &&
      phase === 'discussion' &&
      subPhase === 'awaiting-learner' &&
      askState === 'inactive' &&
      riddleState === 'inactive' &&
      poemState === 'inactive' &&
      storyState === 'inactive' &&
      fillInFunState === 'inactive'
    ) {
      setShowOpeningActions(true);
    }
  }, [captionsDone, phase, subPhase, askState, riddleState, poemState, storyState, fillInFunState]);

  // If Ask, Riddle, Poem, Story, or Fill-in-Fun becomes active, immediately hide Opening actions
  useEffect(() => {
    if (askState !== 'inactive' || riddleState !== 'inactive' || poemState !== 'inactive' || storyState !== 'inactive' || fillInFunState !== 'inactive') {
      try { setShowOpeningActions(false); } catch {}
    }
  }, [askState, riddleState, poemState, storyState, fillInFunState]);

  // Helper: speak arbitrary frontend text via unified captions + TTS
  // Use a ref so early functions can call it before it's fully defined
  const speakFrontendRef = useRef(null);
  const speakFrontend = useCallback(async (...args) => {
    console.log('[speakFrontend] Wrapper called, ref is:', speakFrontendRef.current ? 'set' : 'null', 'args:', args);
    if (speakFrontendRef.current) {
      return speakFrontendRef.current(...args);
    } else {
      console.warn('[speakFrontend] Ref is null, cannot execute');
    }
  }, []);

  // (moved: handleStartLesson is defined after explicit Go handlers to avoid TDZ)

  // URL params defined above; referenced throughout

  // Monitor learner changes and reload targets
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'learner_id' || e.key === 'learner_name') {
        console.log('[Session] Learner changed, reloading targets...');
        reloadTargetsForCurrentLearner();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [reloadTargetsForCurrentLearner]);

  const [showBegin, setShowBegin] = useState(true);
  const sessionStartRef = useRef(null); // timestamp for current in-app session segment
  // Track the starting caption index for the current transcript segment (so ledger appends don't duplicate)
  const transcriptSegmentStartIndexRef = useRef(0);
  // isSpeaking/phase/subPhase defined earlier; do not redeclare here
  const [transcript, setTranscript] = useState("");
  // Start with loading=true so the existing overlay spinner shows during initial restore
  const [loading, setLoading] = useState(true);
  // TTS overlay: track TTS fetch activity separately; overlay shows when either API or TTS is loading
  const [ttsLoadingCount, setTtsLoadingCount] = useState(0);
  const overlayLoading = loading || (ttsLoadingCount > 0);
  const [error, setError] = useState("");
  const [canSend, setCanSend] = useState(false);
  const [learnerInput, setLearnerInput] = useState("");
  const [ticker, setTicker] = useState(0);
  const [worksheetAnswers, setWorksheetAnswers] = useState([]);
  const [testAnswers, setTestAnswers] = useState([]);
  const [lessonData, setLessonData] = useState(null);
  const [lessonDataLoading, setLessonDataLoading] = useState(false);
  const [lessonDataError, setLessonDataError] = useState("");
  const [downloadError, setDownloadError] = useState("");
  // Generated assessment sets persisted for session (worksheet & test)
  const [generatedWorksheet, setGeneratedWorksheet] = useState(null);
  // Preserve original full worksheet source objects (with answer metadata) used to derive generatedWorksheet
  const [worksheetSourceFull, setWorksheetSourceFull] = useState(null);
  // Mirror for immediate, synchronous reads between renders to avoid stale state in rapid turns
  const worksheetIndexRef = useRef(0);
  const [generatedTest, setGeneratedTest] = useState(null);
  // Preserve original full test source objects
  const [testSourceFull, setTestSourceFull] = useState(null);
  // Ephemeral (reset on refresh) pre-generated sets for comprehension and exercise
  const [generatedComprehension, setGeneratedComprehension] = useState(null);
  const [generatedExercise, setGeneratedExercise] = useState(null);
  const [currentCompIndex, setCurrentCompIndex] = useState(0);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  // Facilitator-configurable hotkeys (local-first, then server when available)
  const [hotkeys, setHotkeys] = useState(() => getHotkeysLocal());
  useEffect(() => {
    // Refresh from local storage on mount and when updated in another tab/window
    try {
      setHotkeys(getHotkeysLocal());
    } catch {}
    const onStorage = (e) => {
      try {
        if (e?.key === 'facilitator_hotkeys') {
          setHotkeys(getHotkeysLocal());
        }
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchHotkeysServer();
        if (res?.ok && res.hotkeys) setHotkeys(res.hotkeys);
      } catch {}
    })();
  }, []);

  // Calculate lesson progress percentage (defined after all state variables)
  const calculateLessonProgress = useCallback(() => {
    // Map phases to progress percentages
    const phaseWeights = {
      'discussion': 10,
      'teaching': 30,
      'comprehension': 50,
      'exercise': 70,
      'worksheet': 85,
      'test': 95
    };
    
    let baseProgress = phaseWeights[phase] || 0;
    
    // Add granular progress within each phase
    if (phase === 'comprehension' && currentCompIndex > 0) {
      const phaseRange = phaseWeights.comprehension - phaseWeights.teaching;
      const withinPhase = (currentCompIndex / COMPREHENSION_TARGET) * phaseRange;
      baseProgress = phaseWeights.teaching + Math.min(withinPhase, phaseRange);
    } else if (phase === 'exercise' && currentExIndex > 0) {
      const phaseRange = phaseWeights.exercise - phaseWeights.comprehension;
      const withinPhase = (currentExIndex / EXERCISE_TARGET) * phaseRange;
      baseProgress = phaseWeights.comprehension + Math.min(withinPhase, phaseRange);
    } else if (phase === 'worksheet' && worksheetAnswers.length > 0) {
      const phaseRange = phaseWeights.worksheet - phaseWeights.exercise;
      const withinPhase = (worksheetAnswers.length / WORKSHEET_TARGET) * phaseRange;
      baseProgress = phaseWeights.exercise + Math.min(withinPhase, phaseRange);
    } else if (phase === 'test' && testAnswers.length > 0) {
      const phaseRange = phaseWeights.test - phaseWeights.worksheet;
      const withinPhase = (testAnswers.length / TEST_TARGET) * phaseRange;
      baseProgress = phaseWeights.worksheet + Math.min(withinPhase, phaseRange);
    }
    
    return Math.min(100, Math.max(0, baseProgress));
  }, [phase, currentCompIndex, currentExIndex, worksheetAnswers, testAnswers]);

  // Dynamic target height for video in landscape (computed from viewport)
  const [videoMaxHeight, setVideoMaxHeight] = useState(null);
  // Dynamic video column width in landscape (percent of row width)
  // Maps viewport height 600 -> 50% down to height 400 -> 30% (clamped)
  const [videoColPercent, setVideoColPercent] = useState(50);
  // Ultra-short screen handling: when viewport height <= 500px, relocate overlay controls to footer
  const [isShortHeight, setIsShortHeight] = useState(false);
  // Extra-tight landscape handling: when viewport height <= 450px in landscape, remove timeline vertical padding
  const [isVeryShortLandscape, setIsVeryShortLandscape] = useState(false);
  useEffect(() => {
    const calcVideoHeight = () => {
      try {
        const w = window.innerWidth; const h = window.innerHeight;
        // Track short height regardless of orientation
        setIsShortHeight(h <= 500);
        // Extra-tight landscape flag
        setIsVeryShortLandscape((w > h) && (h <= 450));
        const isLandscape = w > h;
        if (!isLandscape) { setVideoMaxHeight(null); setVideoColPercent(50); return; }
        // Multi-stage smooth ramp: 40% at 375px -> 65% at 600px -> 70% at 700px -> 75% at 1000px
        // clamped to [0.40, 0.75]. Applies to all landscape viewports.
        let frac;
        if (h <= 375) {
          frac = 0.40;
        } else if (h <= 600) {
          // Ramp from 40% at 375px to 65% at 600px
          const t = (h - 375) / (600 - 375);
          frac = 0.40 + t * (0.65 - 0.40);
        } else if (h <= 700) {
          // Ramp from 65% at 600px to 70% at 700px
          const t = (h - 600) / (700 - 600);
          frac = 0.65 + t * (0.70 - 0.65);
        } else if (h <= 1000) {
          // Ramp from 70% at 700px to 75% at 1000px
          const t = (h - 700) / (1000 - 700);
          frac = 0.70 + t * (0.75 - 0.70);
        } else {
          frac = 0.75;
        }
        const target = Math.round(h * frac);
        setVideoMaxHeight(target);

        // Compute landscape video column width percent: 30% at 500px -> 50% at 700px
        const hwMin = 500;
        const hwMax = 700;
        let pct;
        if (h <= hwMin) {
          pct = 30;
        } else if (h >= hwMax) {
          pct = 50;
        } else {
          const t2 = (h - hwMin) / (hwMax - hwMin);
          pct = 30 + t2 * (50 - 30);
        }
        // Keep a small precision to reduce jitter; clamp defensively
        pct = Math.max(30, Math.min(50, Math.round(pct * 100) / 100));
        setVideoColPercent(pct);
      } catch { setVideoMaxHeight(null); }
    };
    calcVideoHeight();
    window.addEventListener('resize', calcVideoHeight);
    window.addEventListener('orientationchange', calcVideoHeight);
    // On mobile browsers, the URL bar show/hide changes the visual viewport height
    // without always emitting a classic resize. Listen to visualViewport if present.
    let vv = null;
    try { vv = window.visualViewport || null; } catch { vv = null; }
    const handleVV = () => calcVideoHeight();
    if (vv) {
      try { vv.addEventListener('resize', handleVV); } catch {}
      try { vv.addEventListener('scroll', handleVV); } catch {}
    }
    return () => {
      window.removeEventListener('resize', calcVideoHeight);
      window.removeEventListener('orientationchange', calcVideoHeight);
      if (vv) {
        try { vv.removeEventListener('resize', handleVV); } catch {}
        try { vv.removeEventListener('scroll', handleVV); } catch {}
      }
    };
  }, []);

  // (moved below state declarations that reference it)
  // Consistent key for saving/loading/clearing generated assessments
  const getAssessmentStorageKey = (override) => {
    try {
      const d = override?.data ?? lessonData;
      const m = override?.manifest ?? manifestInfo;
      const p = override?.param ?? lessonParam;
      const base = (d && d.id) || (m && m.file) || p || '';
      // Bind to learner + target counts so caches reflect per-learner configuration
  const learnerId = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
      const suffix = `:L:${learnerId}:W${WORKSHEET_TARGET}:T${TEST_TARGET}`;
      return `${base}${suffix}`;
    } catch { return lessonParam || ''; }
  };
  // Stable key for session snapshots
  const getSnapshotStorageKey = (override) => {
    return getSnapshotStorageKeyUtil({ lessonData, manifestInfo, lessonParam, override });
  };
  const [currentWorksheetIndex, setCurrentWorksheetIndex] = useState(0);
  // Sample-driven question pools (for comprehension & exercise)
  const [compPool, setCompPool] = useState([]); // remaining shuffled problems for comprehension
  const [exercisePool, setExercisePool] = useState([]); // remaining shuffled problems for exercise
  const [currentCompProblem, setCurrentCompProblem] = useState(null); // problem currently asked in comprehension awaiting learner answer
  const [currentExerciseProblem, setCurrentExerciseProblem] = useState(null); // problem currently asked in exercise awaiting learner answer

  // (session snapshot hooks moved below test state initialization to avoid TDZ)

  // Comprehension input gating
  // - While in comprehension-start (pre-first-question), keep input disabled.
  // - After the first question is set (comprehension-active), enable input only once TTS finishes the prompt.
  useEffect(() => {
    if (phase !== 'comprehension') return;
    if (subPhase === 'comprehension-start') {
      if (canSend) setCanSend(false);
      return;
    }
    if (subPhase === 'comprehension-active') {
      if (currentCompProblem && !isSpeaking && !canSend) setCanSend(true);
      return;
    }
  }, [phase, subPhase, currentCompProblem, isSpeaking, canSend]);

  // Persist comprehension/exercise pools whenever they are initialized or change length (e.g., after consuming an item)
  useEffect(() => {
    const storageKey = getAssessmentStorageKey();
    if (!storageKey) return;
    const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
    // Debounce saves lightly to avoid tight loops
    const t = setTimeout(() => {
      try {
        const payload = {
          worksheet: generatedWorksheet || [],
          test: generatedTest || [],
          comprehension: Array.isArray(compPool) ? compPool : [],
          exercise: Array.isArray(exercisePool) ? exercisePool : [],
        };
        saveAssessments(storageKey, payload, { learnerId: lid });
      } catch {}
    }, 150);
    return () => clearTimeout(t);
  }, [compPool?.length, exercisePool?.length]);
  const [exerciseSkippedAwaitBegin, setExerciseSkippedAwaitBegin] = useState(false); // flag: exercise reached via skip and needs explicit begin
  const [worksheetSkippedAwaitBegin, setWorksheetSkippedAwaitBegin] = useState(false); // flag: worksheet reached via skip and needs enriched intro
  // Comprehension awaiting-begin lock to ignore late replies during skip/transition
  const comprehensionAwaitingLockRef = useRef(false);
  // Track whether we've already sent the full global guard declaration for a phase
  const [phaseGuardSent, setPhaseGuardSent] = useState({});
  // Abort control for Ms. Sonoma requests
  const sonomaAbortRef = useRef(null);
  // Global abort key to notify child components (e.g., mic/STT) to stop
  const [abortKey, setAbortKey] = useState(0);
  // Track how many times unified teaching has been repeated after the initial pass
  const [teachingRepeats, setTeachingRepeats] = useState(0);
  // Captions: track all sentences and the active one for YouTube-like pacing
  const [captionSentences, setCaptionSentences] = useState([]);
  const [captionIndex, setCaptionIndex] = useState(0);
  const captionBoxRef = useRef(null);
  // No native-size clamp: always use computed target height in landscape
  const videoEffectiveHeight = (videoMaxHeight && Number.isFinite(videoMaxHeight)) ? videoMaxHeight : null;
  // Full-bleed layout for session; no global max-width container here.
  // Side-by-side layout refs (wide aspect) for equal height sync
  const videoColRef = useRef(null);
  const captionColRef = useRef(null);
  const [sideBySideHeight, setSideBySideHeight] = useState(null);
  // Wide-aspect detector: enable side-by-side when viewport is sufficiently wide vs tall
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  // When captions are stacked below the video (not mobile landscape), we size them to ~60% of the video panel height
  const [stackedCaptionHeight, setStackedCaptionHeight] = useState(null);
  useEffect(() => {
    if (!isMobileLandscape) { setSideBySideHeight(null); return; }
    const v = videoColRef.current;
    const c = captionColRef.current;
    if (!v || !c) return;
    const measure = () => {
      try {
        const h = v.getBoundingClientRect().height;
        if (Number.isFinite(h) && h > 0) {
          const next = Math.round(h);
          setSideBySideHeight((prev) => (prev !== next ? next : prev));
        }
      } catch {}
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      try { ro.observe(v); } catch {}
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
      window.addEventListener('orientationchange', measure);
    }
    return () => {
      try { ro && ro.disconnect(); } catch {}
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', measure);
        window.removeEventListener('orientationchange', measure);
      }
    };
  }, [isMobileLandscape, videoMaxHeight]);
  // Rule: captions float to the right of the video when width/height >= 1.0 (true landscape: width >= height).
  // This replaces the previous 700px threshold rule.
  useEffect(() => {
    const check = () => {
      try {
        const w = window.innerWidth;
        const h = window.innerHeight;
  const wideAspect = h > 0 && (w / h) >= 1.0;
        setIsMobileLandscape(!!wideAspect);
      } catch {}
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => { window.removeEventListener('resize', check); window.removeEventListener('orientationchange', check); };
  }, []);

  // Measure the fixed footer height to reserve exact space and avoid blank scroll area
  const footerRef = useRef(null);
  const [footerHeight, setFooterHeight] = useState(0);
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const measure = () => {
      try {
        const h = Math.ceil(el.getBoundingClientRect().height);
        if (Number.isFinite(h) && h >= 0) setFooterHeight(h);
      } catch {}
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      try { ro.observe(el); } catch {}
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
    }
    return () => {
      try { ro && ro.disconnect(); } catch {}
      if (typeof window !== 'undefined') window.removeEventListener('resize', measure);
    };
  }, []);

  // Measure to size stacked caption panel. When not side-by-side, cap captions to visible viewport minus footer and current top offset.
  useEffect(() => {
    if (isMobileLandscape) { setStackedCaptionHeight(null); return; }
    const measureTarget = videoColRef.current; // video defines canonical reflow triggers
    const widthTarget = captionColRef.current || videoColRef.current;
    const topTarget = captionColRef.current || widthTarget || measureTarget;
    if (!measureTarget || !widthTarget || !topTarget) return;
    const measure = () => {
      try {
        const vRect = measureTarget.getBoundingClientRect();
        const wRect = widthTarget.getBoundingClientRect();
        const tRect = topTarget.getBoundingClientRect();
        const videoH = vRect.height;
        const w = wRect.width;
        const vh = window.innerHeight;
        const colTop = Math.max(0, tRect.top);
        // Keep a small gap above the footer to avoid visual collision
        const footerGap = 8;
        const available = Math.max(220, Math.floor(vh - footerHeight - footerGap - colTop));
        // Prefer not to exceed column width to keep a square-ish feel
        if (Number.isFinite(w) && w > 0) {
          const target = Math.max(220, Math.min(Math.round(w), available));
          setStackedCaptionHeight(target);
        } else if (Number.isFinite(videoH) && videoH > 0) {
          const target = Math.max(220, Math.min(Math.round(videoH), available));
          setStackedCaptionHeight(target);
        }
      } catch {}
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      try { ro.observe(measureTarget); } catch {}
      if (widthTarget && widthTarget !== measureTarget) { try { ro.observe(widthTarget); } catch {} }
      if (captionColRef.current) { try { ro.observe(captionColRef.current); } catch {} }
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', measure);
      window.addEventListener('orientationchange', measure);
    }
    return () => {
      try { ro && ro.disconnect(); } catch {}
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', measure);
        window.removeEventListener('orientationchange', measure);
      }
    };
  }, [isMobileLandscape, footerHeight]);

  // (moved lower originally) placeholder: title dispatch effect defined after manifestInfo/effectiveLessonTitle
  // Fixed scale factor to avoid any auto-shrinking behavior
  const snappedScale = 1;
  // (footer height measurement moved above stacked caption sizing effect)
  // Media & caption refs (restored after refactor removal)
  const videoRef = useRef(null); // controls lesson video playback synchrony with TTS
  const videoPlayingRef = useRef(false); // track if video is currently playing to avoid duplicate play calls
  const audioRef = useRef(null); // active Audio element for synthesized speech
  const captionTimersRef = useRef([]); // active timers advancing captionIndex
  const captionSentencesRef = useRef([]); // accumulated caption sentences for full transcript persistence
  // Track re-joins: begin timestamp when the user hits Begin
  useEffect(() => {
    if (showBegin === false && !sessionStartRef.current) {
      sessionStartRef.current = new Date().toISOString();
      // Start a fresh transcript segment at the current caption length
      try { transcriptSegmentStartIndexRef.current = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current.length : 0; } catch {}
    }
  }, [showBegin]);
  // Track current caption batch boundaries for accurate resume scheduling
  const captionBatchStartRef = useRef(0);
  const captionBatchEndRef = useRef(0);
  // Playback controls
  const [muted, setMuted] = useState(false);
  const isSpeakingRef = useRef(false);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);
  // Mirror latest mute state for async callbacks (prevents stale closures)
  const mutedRef = useRef(false);
  // When true, the next play attempt ignores gating (used for Opening begin)
  const forceNextPlaybackRef = useRef(false);
  // Browser detection: treat Safari specially for mic prompts
  const isSafari = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
  }, []);
  // Tracks whether the user has explicitly unlocked audio via a gesture (prevents re-prompting)
  const audioUnlockedRef = useRef(false);
  // Persisted UX flags for audio/mic setup
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [micAllowed, setMicAllowed] = useState(null); // null=unknown, true/false=decided
  const micRequestInFlightRef = useRef(false);
  // Load persisted flags on mount
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const au = localStorage.getItem('ms_audioUnlocked');
        const ma = localStorage.getItem('ms_micAllowed');
        setAudioUnlocked(au === 'true');
        if (ma !== null) setMicAllowed(ma === 'true');
      }
    } catch {}
  }, []);

  // Preload video on mount to avoid race condition on Begin
  useEffect(() => {
    try {
      if (videoRef.current) {
        // Trigger video load immediately
        videoRef.current.load();
        console.info('[Session] Video preload initiated on mount');
        
        // Track video playing state for Chrome autoplay coordination
        const video = videoRef.current;
        const onPlay = () => {
          videoPlayingRef.current = true;
          console.info('[Session] Video playing, flag set to true');
        };
        const onPause = () => {
          videoPlayingRef.current = false;
          console.info('[Session] Video paused, flag set to false');
        };
        const onEnded = () => {
          videoPlayingRef.current = false;
          console.info('[Session] Video ended, flag set to false');
        };
        
        video.addEventListener('play', onPlay);
        video.addEventListener('playing', onPlay);
        video.addEventListener('pause', onPause);
        video.addEventListener('ended', onEnded);
        
        return () => {
          video.removeEventListener('play', onPlay);
          video.removeEventListener('playing', onPlay);
          video.removeEventListener('pause', onPause);
          video.removeEventListener('ended', onEnded);
        };
      }
    } catch (e) {
      console.warn('[Session] Video preload failed', e);
    }
  }, []);

  const lastAudioBase64Ref = useRef(null);
  // Track HTMLAudio paused position so we can reconstruct/resume after long idle or GC
  const htmlAudioPausedAtRef = useRef(0);
  // Prefer HTMLAudio for the very first TTS playback (Opening) to satisfy stricter autoplay policies.
  // We reset this after the first attempt so subsequent replies can use WebAudio-first as usual.
  const preferHtmlAudioOnceRef = useRef(false);
  // Prevent multiple recovery attempts for the Opening playback
  const openingReattemptedRef = useRef(false);
  // Guard: if audio stalls or never ends on mobile, auto-release the speaking lock so controls do not hang
  const speechGuardTimerRef = useRef(null);
  const clearSpeechGuard = useCallback(() => {
    clearSpeechGuardUtil(speechGuardTimerRef);
  }, []);
  const forceStopSpeaking = useCallback((reason = 'timeout') => {
    forceStopSpeakingUtil(
      reason,
      { audioRef, videoRef, speechGuardTimerRef },
      { phase, subPhase, askState, riddleState, poemState },
      setIsSpeaking,
      setShowOpeningActions,
      stopWebAudioSource
    );
  }, [phase, subPhase, askState, riddleState, poemState]);
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  // Track last arm time to avoid spamming guard while we get metadata/ticks
  const lastGuardArmAtRef = useRef(0);
  const armSpeechGuard = useCallback((seconds, label = '') => {
    armSpeechGuardUtil(seconds, label, speechGuardTimerRef, forceStopSpeaking);
  }, [forceStopSpeaking]);
  const armSpeechGuardThrottled = useCallback((seconds, label = '') => {
    armSpeechGuardThrottledUtil(seconds, label, lastGuardArmAtRef, armSpeechGuard);
  }, [armSpeechGuard]);
  const lastSentencesRef = useRef([]);
  const lastStartIndexRef = useRef(0);
  // Test phase state
  const [testActiveIndex, setTestActiveIndex] = useState(0); // index of current test question during active test taking
  const [testUserAnswers, setTestUserAnswers] = useState([]); // collected user answers
  const [testCorrectByIndex, setTestCorrectByIndex] = useState([]); // boolean per question
  const [skipPendingLessonLoad, setSkipPendingLessonLoad] = useState(false); // flag when skip pressed before lesson data ready
  // Test review correctness tracking (restored)
  const [usedTestCuePhrases, setUsedTestCuePhrases] = useState([]); // unique cue phrases detected so far in test review
  const [testCorrectCount, setTestCorrectCount] = useState(0); // authoritative correct count derived from cue phrases
  const [testFinalPercent, setTestFinalPercent] = useState(null); // final percent shown after grading until lesson completion
  // Congrats phase state tracking for completion button persistence
  const [congratsStarted, setCongratsStarted] = useState(false);
  const [congratsDone, setCongratsDone] = useState(false);
  // Model-validated correctness tracking during test review
  // Concise bounded-leniency guidance (applies only to open-ended judging, not TF/MC)
  const JUDGING_LENIENCY_OPEN_ENDED = 'Judge open-ended answers with bounded leniency: ignore fillers and politeness, be case-insensitive, ignore punctuation, and collapse spaces. Map number words zero�twenty to digits and allow simple forms like "one hundred twenty". Accept simple plural/tense changes in acceptable phrases but require all core keywords from an acceptable variant. If multiple different numbers appear, treat as incorrect. Do not apply this leniency to true/false or multiple choice.';

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

  // Celebratory, unique, and domain-agnostic cue phrases (no math-specific wording).
  const CORRECT_TEST_CUE_PHRASES = useMemo(() => [
    'Spark of success',
    'Victory tick',
    'Answer locked in',
    'Bright star answer',
    'High five moment',
    'Correct and proud',
    'You nailed it',
    'That tracks true',
    'Answer win',
    'Golden answer',
    'Solution glow',
    'Brain boost',
    'Track of truth',
    'Result rocket',
    'A-plus moment',
    'Clean solve',
    'Solid outcome',
    'Clear outcome',
    'Facts aligned',
    'Crisp solve',
    'Total triumph',
    'Neat outcome',
    'Correct combo',
    'Answer sparkle'
  ], []);

  // (Moved snapshot persistence hooks below state declarations to avoid TDZ)

  // Strong requirement text reused in both per-question and full test review instructions.
  // Purpose: ensure model ALWAYS outputs one (and only one) unique cue phrase for each correct answer so
  // correctness detection is deterministic. Missing or multiple cue phrases cause the system to treat
  // the answer as incorrect. The phrase must be appended verbatim at the END of the praise sentence.
  const CUE_PHRASE_REQUIREMENT = "If (and only if) the learner's answer is correct you MUST append EXACTLY ONE (and only one) unused cue phrase from the provided list at the END of the praise sentence separated by a single space. This cue phrase is MANDATORY for every correct answer. Do NOT alter the cue phrase text, do NOT add punctuation or extra words after it, and do NOT use more than one phrase. If you omit the phrase, change it, reuse a phrase, or add extra trailing words after it the system will grade the answer as incorrect.";

  // (Removed global grading constants and guards to prevent cross-question drift.)

  // Hard rule for Comprehension/Exercise question generation (non-Math):
  // Only allow MC, True/False, or Fill-in-the-Blank. Never Short Answer.
  const ALLOWED_Q_TYPES_NOTE = "Question type constraint: Only use Multiple Choice (include four choices labeled 'A.', 'B.', 'C.', 'D.'), True/False, or Fill in the Blank (use _____). Do NOT use short answer or any open-ended question types in the Comprehension or Exercise phases.";

  // Helper to use any provided expectedAny list from lesson JSON
  const expectedAnyList = (q) => {
    try {
      // Keep boolean false; drop only null/undefined and empty strings after trim
      const keep = (v) => {
        if (v == null) return false;
        const s = typeof v === 'string' ? v.trim() : v;
        return !(typeof s === 'string' && s.length === 0);
      };
      const a = Array.isArray(q?.expectedAny) ? q.expectedAny.filter(keep) : [];
      const b = Array.isArray(q?.acceptable) ? q.acceptable.filter(keep) : [];
      const merged = [...a, ...b];
      return merged.length ? merged : null;
    } catch { return null; }
  };

  // Track wrong attempts per question key so we can vary hints and reveal on third try
  const wrongAttemptsRef = useRef(new Map());
  const bumpWrongAttempt = useCallback((qKey) => {
    try {
      if (!qKey) return 1;
      const prev = wrongAttemptsRef.current.get(qKey) || 0;
      const next = prev + 1;
      wrongAttemptsRef.current.set(qKey, next);
      return next;
    } catch { return 1; }
  }, []);
  const resetWrongAttempt = useCallback((qKey) => {
    try { if (qKey) wrongAttemptsRef.current.delete(qKey); } catch {}
  }, []);

  // Re-added: derive manifest info + teaching steps (was removed accidentally, causing ReferenceError)
  const manifestInfo = useMemo(
    () => resolveLessonInfo(subjectParam, lessonParam),
    [subjectParam, lessonParam]
  );
  // Prefer human-friendly title from lesson JSON over filename-derived manifest title
  const effectiveLessonTitle = useMemo(() => {
    const t = (lessonData?.title || lessonData?.lessonTitle || manifestInfo.title || "Lesson");
    return typeof t === "string" ? t.trim() : String(t);
  }, [lessonData, manifestInfo.title]);
  
  // Helper: derive Grade number (e.g., 4 from "4th") from common sources
  const getGradeNumber = useCallback(() => {
    try {
      const source = (manifestInfo?.title || effectiveLessonTitle || lessonParam || '').toString();
      const m = source.match(/\b(K|1st|2nd|3rd|[4-9]th|1[0-2]th)\b/i);
      if (!m) return '';
      const token = m[1].toLowerCase();
      if (token === 'k') return 'K';
      const n = token.replace(/(st|nd|rd|th)$/i, '');
      return String(parseInt(n, 10));
    } catch { return ''; }
  }, [manifestInfo?.title, effectiveLessonTitle, lessonParam]);
  
  const teachingSteps = useMemo(() => {
    // Use learner's grade if available, otherwise try to derive from lesson title
    const gradeToUse = learnerGrade || getGradeNumber();
    return getTeachingSteps(effectiveLessonTitle, gradeToUse, difficultyParam);
  }, [effectiveLessonTitle, learnerGrade, difficultyParam, getGradeNumber]);
  // Dispatch lesson title to header (mobile landscape) now that manifestInfo/effectiveLessonTitle are initialized
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const pageTitle = ((lessonData && (lessonData.title || lessonData.lessonTitle)) || manifestInfo.title || effectiveLessonTitle || '').toString();
      // Always dispatch the title so HeaderBar can show it in both landscape and portrait
      window.dispatchEvent(new CustomEvent('ms:session:title', { detail: pageTitle }));
    } catch {}
  }, [isMobileLandscape, lessonData, manifestInfo.title, effectiveLessonTitle]);
  // Shared constants
  // Import centrally defined worksheet progress cue variants
  // Note: keep relative path stable if this file moves
  const { WORKSHEET_CUE_VARIANTS } = require('./constants/worksheetCues.js');

  const subjectSegment = (subjectParam || "math").toLowerCase();
  const subjectFolderSegment = subjectSegment === 'generated'
    ? 'Generated Lessons'
    : (subjectSegment === 'general' ? 'Facilitator Lessons' : subjectSegment);
  // Preserve original casing of the lesson filename; only normalize subject segment
  const lessonFilename = manifestInfo.file || "";
  const lessonFilePath = lessonFilename
    ? `/lessons/${encodeURIComponent(subjectFolderSegment)}/${encodeURIComponent(lessonFilename)}`
    : "";

  // Ensure lesson JSON is loaded before we try to extract vocab for Definitions
  const ensureLessonDataReady = useCallback(async () => {
    try {
      // If already loaded with a vocab field, use it
      if (lessonData && (Array.isArray(lessonData.vocab) || lessonData.vocab)) {
        return lessonData;
      }
      
      // Handle generated lessons from Supabase
      if (subjectParam === 'generated' && lessonFilename) {
        try {
          const supabase = getSupabaseClient();
          if (supabase) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const params = new URLSearchParams({
                file: lessonFilename,
                userId: user.id
              });
              const res = await fetch(`/api/facilitator/lessons/get?${params}`);
              if (res.ok) {
                const data = await res.json();
                try { setLessonData(data); } catch {}
                try { console.info('[LessonLoad] Loaded generated lesson', lessonFilename); } catch {}
                return data;
              }
            }
          }
        } catch {}
      }
      
      // If we know where to load it from, fetch on-demand
      if (lessonFilePath) {
        const res = await fetch(lessonFilePath);
        if (res.ok) {
          const data = await res.json();
          try { setLessonData(data); } catch {}
          try { console.info('[LessonLoad] Loaded lesson via', lessonFilePath); } catch {}
          return data;
        }
        // Fallback: try common subject folders to locate the lesson file if subjectParam is missing/mismatched
        const candidatesBase = ['math', 'language arts', 'science', 'social studies'];
        const preferred = subjectFolderSegment;
        const ordered = [preferred, ...candidatesBase.filter(s => s !== preferred)];
        for (const folder of ordered) {
          const altPath = `/lessons/${encodeURIComponent(folder)}/${encodeURIComponent(lessonFilename)}`;
          try {
            const r = await fetch(altPath);
            if (r.ok) {
              const data = await r.json();
              try { setLessonData(data); } catch {}
              try { console.info('[LessonLoad] Loaded lesson via fallback', altPath); } catch {}
              return data;
            }
          } catch {}
        }
      }
    } catch {}
    return lessonData;
  }, [lessonData, lessonFilePath, subjectParam, lessonFilename, subjectFolderSegment]);

  // Build a normalized QA pool for comprehension/exercise
  const buildQAPool = useCallback((dataOverride = null) => buildQAPoolUtil(dataOverride || lessonData, subjectParam), [lessonData, subjectParam]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Ensure dynamic targets from learner/runtime are available before building generated sets
      await ensureRuntimeTargets(true); // Force fresh reload
      if (!lessonFilePath && subjectParam !== 'generated') {
        if (!cancelled) {
          setLessonData(null);
          setLessonDataError("");
          setDownloadError("");
        }
        return;
      }

      setLessonDataLoading(true);
      try {
        let data;
        
        // Handle facilitator lessons from Supabase
        if (subjectParam === 'generated' && lessonFilename) {
          const supabase = getSupabaseClient();
          if (!supabase) {
            throw new Error('Supabase client not available');
          }
          
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) {
            throw new Error('User not authenticated');
          }
          
          const params = new URLSearchParams({
            file: lessonFilename,
            userId: user.id
          });
          
          const res = await fetch(`/api/facilitator/lessons/get?${params}`);
          if (!res.ok) {
            throw new Error(`Failed to load lesson data (${res.status})`);
          }
          data = await res.json();
        } else {
          // Handle standard lessons from public folder
          const res = await fetch(lessonFilePath);
          if (!res.ok) {
            throw new Error(`Failed to load lesson data (${res.status})`);
          }
          data = await res.json();
        }
        if (!cancelled) {
          setLessonData(data);
          setLessonDataError("");
          setDownloadError("");
          // Initialize non-repeating decks for word problems
          // REMOVED: initSampleDeck(data) - sample array deprecated
          initWordDeck(data);
          // Attempt to restore persisted assessments for this lesson (id preferred, fallback to filename), invalidate if content changed
          if (!cancelled) {
            const storageKey = getAssessmentStorageKey({ data, manifest: manifestInfo, param: lessonParam });
            const currentLearnerId = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
            const stored = storageKey ? (await getStoredAssessments(storageKey, { learnerId: currentLearnerId })) : null;
            // For math, do not derive mismatch from test content because tests are generated from samples
            const currentFirstTest = subjectParam === 'math' ? null : (Array.isArray(data.test) && data.test.length ? data.test[0].prompt : null);
            const storedFirstTest = subjectParam === 'math' ? null : (stored && Array.isArray(stored.test) && stored.test.length ? stored.test[0].prompt : null);
            const contentMismatch = subjectParam === 'math' ? false : (storedFirstTest && currentFirstTest && storedFirstTest !== currentFirstTest);
            // Initialize comprehension/exercise pools (prefer persisted; else build fresh)
            if (stored && Array.isArray(stored.comprehension) && stored.comprehension.length) {
              setCompPool(stored.comprehension);
            } else {
              const initialPool = buildQAPool(data);
              if (initialPool.length) setCompPool(initialPool);
            }
            if (stored && Array.isArray(stored.exercise) && stored.exercise.length) {
              setExercisePool(stored.exercise);
            } else {
              const initialPool = buildQAPool(data);
              if (initialPool.length) setExercisePool(initialPool);
            }
            setCurrentCompProblem(null);
            setCurrentExerciseProblem(null);

            if (stored && stored.worksheet && stored.test && !contentMismatch) {
              const wOk = Array.isArray(stored.worksheet) && stored.worksheet.length === WORKSHEET_TARGET;
              const tOk = Array.isArray(stored.test) && stored.test.length === TEST_TARGET;
              if (wOk && tOk) {
                setGeneratedWorksheet(stored.worksheet);
                setGeneratedTest(stored.test);
                setCurrentWorksheetIndex(0);
                worksheetIndexRef.current = 0;
              } else {
                // Counts changed since save; ignore stored arrays and regenerate fresh below without clearing persisted sets
                setGeneratedWorksheet(null);
                setGeneratedTest(null);
              }
            } else {
              // Content changed or nothing stored: ignore previous arrays and regenerate without clearing persisted sets
              setGeneratedWorksheet(null);
              setGeneratedTest(null);
              setCurrentWorksheetIndex(0);
              worksheetIndexRef.current = 0;
              worksheetIndexRef.current = 0;
              // NEW: Immediately generate fresh randomized worksheet/test sets so that
              // (a) printing and spoken walkthrough always match, even if user downloads before starting
              // (b) skipping directly to worksheet/test uses the exact same pre-generated arrays
              const shuffle = shuffleHook;
              const shuffleArr = shuffleArrHook;
              const selectMixed = selectMixedHook;
              let gW = [];
              let gT = [];
              if (subjectParam === 'math') {
                // REMOVED: reserveSamples - deprecated zombie code
                const words = reserveWords(WORKSHEET_TARGET + TEST_TARGET);
                // Include category pools only (no samples)
                const tf = Array.isArray(data.truefalse) ? data.truefalse.map(q => ({ ...q, sourceType: 'tf', questionType: 'tf' })) : [];
                const mc = Array.isArray(data.multiplechoice) ? data.multiplechoice.map(q => ({ ...q, sourceType: 'mc', questionType: 'mc' })) : [];
                const fib = Array.isArray(data.fillintheblank) ? data.fillintheblank.map(q => ({ ...q, sourceType: 'fib', questionType: 'sa' })) : [];
                const sa = Array.isArray(data.shortanswer) ? data.shortanswer.map(q => ({ ...q, sourceType: 'short', questionType: 'sa' })) : [];
                const cats = [...tf, ...mc, ...fib, ...sa];
                if ((words && words.length) || cats.length) {
                  gW = takeMixedHook(WORKSHEET_TARGET, false, { words, data });
                  gT = takeMixedHook(TEST_TARGET, true, { words, data });
                  setGeneratedWorksheet(gW);
                  setGeneratedTest(gT);
                }
              } else {
                // Non-math: build from category arrays when available; cap Short Answer and Fill-in-the-Blank at 10% each
                const fromCatsW = buildFromCategoriesHook(WORKSHEET_TARGET, data);
                const fromCatsT = buildFromCategoriesHook(TEST_TARGET, data);
                if (fromCatsW) {
                  gW = fromCatsW;
                  setGeneratedWorksheet(gW);
                } else if (Array.isArray(data.worksheet) && data.worksheet.length) {
                  gW = shuffle(data.worksheet).slice(0, WORKSHEET_TARGET).map(q => ({ ...q, questionType: (q?.questionType) ? q.questionType : 'sa' }));
                  setGeneratedWorksheet(gW);
                }
                if (fromCatsT) {
                  gT = fromCatsT;
                  setGeneratedTest(gT);
                } else if (Array.isArray(data.test) && data.test.length) {
                  gT = shuffle(data.test).slice(0, TEST_TARGET).map(q => ({ ...q, questionType: (q?.questionType) ? q.questionType : 'sa' }));
                  setGeneratedTest(gT);
                }
              }
              if (storageKey) {
                try {
                  const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
                  await saveAssessments(storageKey, { worksheet: gW, test: gT, comprehension: compPool || [], exercise: exercisePool || [] }, { learnerId: lid });
                } catch {}
              }
            }
          }
        }
      } catch (e) {
        console.error("[Session] Lesson resource fetch failed:", e);
        if (!cancelled) {
          setLessonData(null);
          setLessonDataError("Lesson resources are unavailable.");
          setDownloadError("");
        }
      } finally {
        if (!cancelled) {
          setLessonDataLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [lessonFilePath]);

  const waitForBeat = (ms = 240) => new Promise((resolve) => setTimeout(resolve, ms));

  const clearCaptionTimers = () => clearCaptionTimersUtil(captionTimersRef);

  // Web Speech API fallback removed per requirement: absolutely no browser Web Speech usage.

  // Keep audioUnlocked state loosely synced with ref if one changes elsewhere
  useEffect(() => {
    if (audioUnlockedRef.current && !audioUnlocked) {
      try { setAudioUnlocked(true); } catch {}
      try { if (typeof window !== 'undefined') localStorage.setItem('ms_audioUnlocked', 'true'); } catch {}
    }
  }, [audioUnlocked]);

  // React to mute toggle on current audio and keep a ref for async use
  useEffect(() => {
    mutedRef.current = muted;
    if (audioRef.current) {
      try {
        audioRef.current.muted = muted;
        audioRef.current.volume = muted ? 0 : 1;
      } catch {}
    }
    // Propagate mute to WebAudio gain if present
    if (webAudioGainRef.current) {
      try { webAudioGainRef.current.gain.value = muted ? 0 : 1; } catch {}
    }
  }, [muted]);

  // Stable refs for state/functions used by audio playback
  const captionIndexRef = useRef(captionIndex);
  useEffect(() => { captionIndexRef.current = captionIndex; }, [captionIndex]);
  // These refs will be populated after useAudioPlayback hook provides the functions
  const scheduleCaptionsForAudioRef = useRef(null);
  const scheduleCaptionsForDurationRef = useRef(null);
  const computeHeuristicDurationRef = useRef(null);
  const armSpeechGuardRef = useRef(armSpeechGuard); // armSpeechGuard exists early
  const playAudioFromBase64Ref = useRef(null);
  const startThreeStageTeachingRef = useRef(null); // will be populated after function is defined

  // New unified pause implementation
  const pauseAll = useCallback(() => {
    try { pauseSynthetic(); } catch {}
    if (audioRef.current) {
      try {
        try { htmlAudioPausedAtRef.current = Number(audioRef.current.currentTime || 0); } catch {}
        audioRef.current.pause();
      } catch {}
    }
    // Record WebAudio pause offset and stop source
    try {
      const ctx = audioCtxRef.current;
      if (ctx && webAudioBufferRef.current && webAudioSourceRef.current) {
        const elapsed = Math.max(0, (ctx.currentTime || 0) - (webAudioStartedAtRef.current || 0));
        webAudioPausedAtRef.current = elapsed;
      }
    } catch {}
    try {
      if (webAudioSourceRef.current) {
        try { webAudioSourceRef.current.stop(); } catch {}
        try { webAudioSourceRef.current.disconnect(); } catch {}
        webAudioSourceRef.current = null;
      }
    } catch {}
    try { if (videoRef.current) videoRef.current.pause(); } catch {}
    try { clearCaptionTimers(); } catch {}
    try { clearSpeechGuard(); } catch {}
  }, []);

  // New unified resume implementation
  const resumeAll = useCallback(() => {
    // Synthetic
    if (syntheticRef.current?.active) {
      try { resumeSynthetic(); } catch {}
    }
    // HTMLAudio resume
    if (audioRef.current) {
      try {
        try {
          const desired = Number(htmlAudioPausedAtRef.current || 0);
          if (Number.isFinite(desired) && desired > 0) {
            audioRef.current.currentTime = Math.max(0, desired);
          }
        } catch {}
        const p = audioRef.current.play();
        try { setIsSpeaking(true); } catch {}
        // Captions
        try {
          const startAt = captionIndexRef.current;
          const batchEnd = captionBatchEndRef.current || captionSentencesRef.current.length;
          const slice = (captionSentencesRef.current || []).slice(startAt, batchEnd);
          if (slice.length) {
            scheduleCaptionsForAudioRef.current?.(audioRef.current, slice, startAt);
          }
        } catch {}
        // Guard
        try {
          if (Number.isFinite(audioRef.current.duration) && audioRef.current.duration > 0) {
            const remaining = Math.max(0.1, (audioRef.current.duration || 0) - (audioRef.current.currentTime || 0));
            armSpeechGuardRef.current?.(remaining, 'html:resume');
          } else {
            const startAt = captionIndexRef.current;
            const end = captionBatchEndRef.current || captionSentencesRef.current.length;
            const slice = (captionSentencesRef.current || []).slice(startAt, end);
            const est = computeHeuristicDurationRef.current?.(slice) || 2.0;
            armSpeechGuardRef.current?.(est, 'html:resume-heur');
          }
        } catch {}
        // Fallback reconstruct
        if (p && p.catch) {
          p.catch(() => {
            const b64 = lastAudioBase64Ref.current;
            if (b64) {
              const startAt = lastStartIndexRef.current || captionIndexRef.current;
              const sentences = Array.isArray(lastSentencesRef.current) && lastSentencesRef.current.length
                ? lastSentencesRef.current
                : (captionSentencesRef.current || []).slice(startAt, captionBatchEndRef.current || captionSentencesRef.current.length);
              const offset = Number(htmlAudioPausedAtRef.current || 0) || 0;
              try { playAudioFromBase64Ref.current?.(b64, sentences, startAt, { resumeAtSeconds: offset }).catch(() => {}); } catch {}
            }
          });
        }
      } catch {}
    } else if (webAudioBufferRef.current) {
      // WebAudio resume
      try {
        // Create/resume AudioContext
        let ctx = audioCtxRef.current;
        if (!ctx || ctx.state === 'closed') {
          const Ctx = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
          if (Ctx) {
            ctx = new Ctx();
            audioCtxRef.current = ctx;
            const gain = ctx.createGain();
            gain.gain.value = mutedRef.current ? 0 : 1;
            gain.connect(ctx.destination);
            webAudioGainRef.current = gain;
          }
        }
        if (ctx && ctx.state === 'suspended') {
          ctx.resume();
        }
        
        if (ctx) {
          // Stop any existing source
          if (webAudioSourceRef.current) {
            try { webAudioSourceRef.current.stop(); } catch {}
            try { webAudioSourceRef.current.disconnect(); } catch {}
            webAudioSourceRef.current = null;
          }
          
          const src = ctx.createBufferSource();
          src.buffer = webAudioBufferRef.current;
          src.connect(webAudioGainRef.current || ctx.destination);
          webAudioSourceRef.current = src;
          const offset = Math.max(0, webAudioPausedAtRef.current || 0);
          src.onended = () => {
            try { setIsSpeaking(false); } catch {}
            try { if (videoRef.current) videoRef.current.pause(); } catch {}
            try {
              if (
                phase === 'discussion' &&
                subPhase === 'awaiting-learner' &&
                askState === 'inactive' &&
                riddleState === 'inactive' &&
                poemState === 'inactive'
              ) { setShowOpeningActions(true); }
            } catch {}
            // Stop source
            if (webAudioSourceRef.current) {
              try { webAudioSourceRef.current.stop(); } catch {}
              try { webAudioSourceRef.current.disconnect(); } catch {}
              webAudioSourceRef.current = null;
            }
            webAudioStartedAtRef.current = 0;
            webAudioPausedAtRef.current = 0;
            clearSpeechGuard();
          };
          webAudioStartedAtRef.current = ctx.currentTime - offset;
          try { setIsSpeaking(true); } catch {}
          src.start(0, offset);
          try {
            if (videoRef.current) {
              playVideoWithRetry(videoRef.current);
            }
          } catch {}
          // Captions from remaining duration
          try {
            const startAt = captionIndexRef.current;
            const batchEnd = captionBatchEndRef.current || captionSentencesRef.current.length;
            const slice = (captionSentencesRef.current || []).slice(startAt, batchEnd);
            if (slice.length) {
              const remaining = Math.max(0.1, (webAudioBufferRef.current.duration || 0) - offset);
              scheduleCaptionsForDurationRef.current?.(remaining, slice, startAt);
            }
          } catch {}
          try { armSpeechGuardRef.current?.(Math.max(0.1, (webAudioBufferRef.current.duration || 0) - offset), 'webaudio:resume'); } catch {}
        }
      } catch {}
    } else {
      // Reconstruct last playback
      const b64 = lastAudioBase64Ref.current;
      if (b64) {
        const startAt = lastStartIndexRef.current || captionIndexRef.current;
        const sentences = Array.isArray(lastSentencesRef.current) && lastSentencesRef.current.length
          ? lastSentencesRef.current
          : (captionSentencesRef.current || []).slice(startAt, captionBatchEndRef.current || captionSentencesRef.current.length);
        const offset = Number(htmlAudioPausedAtRef.current || 0) || 0;
        try { setIsSpeaking(true); } catch {}
        try { playAudioFromBase64Ref.current?.(b64, sentences, startAt, { resumeAtSeconds: offset }).catch(() => {}); } catch {}
      }
    }
    // Always try to start the video with user gesture
    try {
      if (videoRef.current) {
        playVideoWithRetry(videoRef.current);
      }
    } catch {}
  }, [ensureAudioContext]);

  // Centralized abort/cleanup: stop audio, captions, mic/STT, and in-flight requests
  // keepCaptions: when true, do NOT wipe captionSentences so on-screen transcript remains continuous across handoffs
  const abortAllActivity = useCallback((keepCaptions = false) => {
    // Abort in-flight Ms. Sonoma
    try { if (sonomaAbortRef.current) sonomaAbortRef.current.abort('skip'); } catch {}
    // Stop audio playback
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      try { audioRef.current.src = ''; } catch {}
      audioRef.current = null;
    }
    // Pause video as well on abort
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch {}
    }
    // Stop synthetic playback timers/state
    try { clearSynthetic(); } catch {}
    // Clear any deferred playback intent so it does not apply after abort
    try { setPlaybackIntent(null); } catch {}
    // Clear captions timers and optionally content
    try {
      clearCaptionTimers();
      captionBatchStartRef.current = 0;
      captionBatchEndRef.current = 0;
      if (!keepCaptions) {
        captionSentencesRef.current = [];
        setCaptionSentences([]);
        setCaptionIndex(0);
      }
    } catch {}
    // Reset transcript, speaking state, and input
    setTranscript('');
    setIsSpeaking(false);
    setLearnerInput('');
    // Notify children (InputPanel) to stop mic and cancel STT
    setAbortKey((k) => k + 1);
  }, []);

  const callMsSonoma = async (instructions, innertext, session, opts = {}) => {
    // If we're in the exercise awaiting-begin lock window, avoid issuing a new call that might
    // change subPhase out from under the Begin overlay due to late replies.
    try {
      if (exerciseAwaitingLockRef.current && session && session.phase === 'exercise') {
        return { success: false, skippedDueToAwaitingLock: true };
      }
      if (comprehensionAwaitingLockRef.current && session && session.phase === 'comprehension') {
        return { success: false, skippedDueToAwaitingLock: true };
      }
    } catch {}
    // Keep existing caption text on screen until new text is ready
    clearCaptionTimers();
    setLoading(true);
    try {
  const rawPhaseKey = (session?.phase || 'unknown').toString().toLowerCase();
  // Bucket 'teaching' and 'comprehension' with 'discussion' so we have exactly four server sessions.
  const phaseKey = (rawPhaseKey === 'teaching' || rawPhaseKey === 'comprehension') ? 'discussion' : rawPhaseKey;
      // Send only the provided instructions (no system message)
      const userContent = `${instructions}`;
      console.log("[Session] Calling Ms. Sonoma", {
        phaseKey,
        userInstructionPreview: userContent.slice(0, 200),
        sessionMeta: { step: session?.step, subject: session?.subject, difficulty: session?.difficulty }
      });
      // Create AbortController so we can cancel on skip
      const ctrl = new AbortController();
      sonomaAbortRef.current = ctrl;
      // Prefer cached systemId; fall back to sending full system once
      const attempt = async (payload) => {
        const res = await fetch("/api/sonoma", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: ctrl.signal,
        });
        const data = await res.json().catch(() => ({}));
        return { res, data };
      };

  // Always include innertext when provided so the backend can log/use it
  let { res, data } = await attempt({ instruction: userContent, innertext });

      // Dev-only: sometimes the route compiles on first touch and returns 404 briefly.
      // If that happens, pre-warm the route, wait a beat, and retry (forcing full system registration).
      if (res && res.status === 404) {
        try {
          console.warn('[Session] /api/sonoma returned 404; retrying after short delay to allow dev compile...')
        } catch {}
        // Pre-warm the route (GET) to trigger compilation/registration in dev
        try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
        await new Promise(r => setTimeout(r, 900));
  ({ res, data } = await attempt({ instruction: userContent, innertext }));
        // If still 404, wait a bit longer and try one more time
        if (res && res.status === 404) {
          try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
          await new Promise(r => setTimeout(r, 1200));
          ({ res, data } = await attempt({ instruction: userContent, innertext }));
        }
      }

  // Stateless call: server receives only the instruction text

      if (!res.ok) {
        throw new Error(`Request failed with ${res.status}`);
      }

      console.log("[Session] Ms. Sonoma replied:", data);

      // Enforce step-specific reply hygiene
      let replyText = data.reply || "";
      try {
        const stepKey = (session && session.step) || "";
        const phaseKey = (session && session.phase) || "";
        if (stepKey === "silly-question") {
          // Keep only a single sentence that ends with a question mark
          const qMatches = replyText.match(/[^?]*\?/g);
          if (qMatches && qMatches.length) {
            replyText = qMatches[qMatches.length - 1].trim();
          } else {
            // If no explicit question, append a question mark to the last sentence
            replyText = (replyText.split(/(?<=[.!?])\s+/).pop() || replyText).trim();
            if (!replyText.endsWith("?")) replyText += "?";
          }
          // No worksheet/test mention in discussion
          replyText = replyText.replace(/\b(worksheet|test|exam|quiz)\b/gi, "");
        } else if (stepKey === "greeting" || stepKey === "encouragement") {
          // Remove any question sentences and keep it brief
          if (replyText.includes("?")) {
            replyText = replyText.slice(0, replyText.indexOf("?")).trim();
          }
          const parts = replyText
            .replace(/\s+/g, " ")
            .split(/(?<=[.!])\s+/)
            .filter(Boolean);
          const maxSentences = stepKey === "greeting" ? 2 : 1;
          replyText = parts.slice(0, maxSentences).join(" ").trim();
          // No worksheet/test mention in discussion
          replyText = replyText.replace(/\b(worksheet|test|exam|quiz)\b/gi, "").replace(/\s{2,}/g, " ").trim();
        } else if (stepKey === "joke") {
          // Ensure required opener is present
          const openers = [getJokePrompt(), getJokePrompt()]; // Get two options
          const hasOpener = openers.some((o) => replyText.trim().toLowerCase().startsWith(o.toLowerCase()));
          if (!hasOpener) {
            const chosen = getJokePrompt();
            replyText = `${chosen} ${replyText.trim()}`.trim();
          }
          // Keep it short: at most 2 sentences; allow question only in opener
          let parts = replyText
            .replace(/\s+/g, " ")
            .split(/(?<=[.!?])\s+/)
            .filter(Boolean)
            .slice(0, 2);
          if (parts.length > 1) {
            parts[1] = parts[1].replace(/\?/g, ".");
          }
          replyText = parts.join(" ").trim();
          // No worksheet/test mention in discussion
          replyText = replyText.replace(/\b(worksheet|test|exam|quiz)\b/gi, "").replace(/\s{2,}/g, " ").trim();
        } else if (stepKey === "unified-discussion") {
          // Unified opening: keep paragraph/blank-line pacing intact for jokes.
          // Remove banned words, normalize spaces within lines, and collapse 3+ newlines to exactly 2.
          let cleaned = replyText.replace(/\b(exercise|worksheet|test|exam|quiz|answer key)\b/gi, "");
          cleaned = cleaned
            .split("\n")
            .map((line) => line.replace(/[ \t]{2,}/g, " ").replace(/\s+$/g, ""))
            .join("\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
          replyText = cleaned;
        } else if (stepKey === "teaching-unified" || stepKey === "teaching-unified-repeat") {
          // Unified teaching (initial or repeat): strip banned words; end statements with periods (no gate question).
          let normalized = replyText
            .replace(/\b(exercise|worksheet|test|exam|quiz|answer key)\b/gi, "")
            .replace(/\s{2,}/g, " ")
            .trim();
          // Normalize any stray question marks to periods in teaching
          replyText = normalized.replace(/\?/g, ".").replace(/\s{2,}/g, " ").trim();
        } else if (stepKey && stepKey.startsWith("teaching")) {
          // Teaching phase hygiene: avoid worksheet/test mentions; questions only allowed in teaching-wrap gate
          replyText = replyText.replace(/\b(exercise|worksheet|test|exam|quiz|answer key)\b/gi, "").replace(/\s{2,}/g, " ").trim();
          if (stepKey === "teaching-wrap") {
            // Normalize body punctuation (no questions; concise wrap)
            replyText = replyText.replace(/\?/g, ".").replace(/\s{2,}/g, " ").trim();
          } else {
            replyText = replyText.replace(/\?/g, ".");
          }
        } else if (stepKey === 'teaching-gate-response') {
          // We no longer want Ms. Sonoma to manage the gate question verbally.
          // Sanitize by removing future-phase terms and normalizing whitespace.
          replyText = replyText.replace(/\b(exercise|worksheet|test|exam|quiz|answer key)\b/gi, "").replace(/\s{2,}/g, " ").trim();
        } else if (phaseKey === "comprehension" || stepKey === "comprehension" || stepKey === "comprehension-start" || stepKey === "comprehension-response") {
          // Comprehension: keep text intact; only normalize whitespace
          replyText = replyText.replace(/\s{2,}/g, " ").trim();
        } else if (phaseKey === 'exercise' || stepKey === 'exercise-start' || stepKey === 'exercise-response') {
          // Exercise: allow questions. Normally strip worksheet/test/exam/quiz/answer key.
          // However, for the FINAL transition composite reply we intentionally allow the word 'worksheet'.
          const transitionPhrases = [
            /that's it for the exercise\. let's do the worksheet\./i,
            /let me know when you're ready to begin the worksheet\./i
          ];
          const isWorksheetTransition = transitionPhrases.some((r) => r.test(replyText));
          if (isWorksheetTransition) {
            // Keep 'worksheet' but remove other banned words
            replyText = replyText.replace(/\b(test|exam|quiz|answer key)\b/gi, "").replace(/\s{2,}/g, " ").trim();
          } else {
            replyText = replyText.replace(/\b(worksheet|test|exam|quiz|answer key)\b/gi, "").replace(/\s{2,}/g, " ").trim();
          }
        } else if (stepKey === "silly-response") {
          // Legacy path (may be phased out): ensure no worksheet/test mention while transitioning to teaching
          replyText = replyText.replace(/\b(exercise|worksheet|test|exam|quiz)\b/gi, "").replace(/\s{2,}/g, " ").trim();
          replyText = replyText.replace(/\?/g, ".");
        } else if (stepKey === "silly-follow-and-unified-teaching") {
          // Combined playful follow-up + unified teaching in one reply.
          const gateQ = "Would you like me to go over that again?";
          // Remove forbidden future-phase words
          replyText = replyText.replace(/\b(worksheet|test|exam|quiz|answer key)\b/gi, "").replace(/\s{2,}/g, " ").trim();
          // Normalize multiple whitespace and punctuation
          // Ensure exactly one gate question at the end.
            const gateRegex = new RegExp(gateQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            const occurrences = replyText.match(gateRegex);
            if (!occurrences) {
              replyText = `${replyText} ${gateQ}`.trim();
            } else if (occurrences.length > 1) {
              // Keep first occurrence only
              const firstIndex = replyText.toLowerCase().indexOf(gateQ.toLowerCase());
              const before = replyText.slice(0, firstIndex + gateQ.length);
              replyText = before;
            } else {
              // Normalize casing
              replyText = replyText.replace(gateRegex, gateQ);
            }
          // Remove stray question marks except the gate question
          replyText = replyText
            .split(/(?<=[.!?])\s+/)
            .map((seg) => (seg.trim().toLowerCase() === gateQ.toLowerCase() ? gateQ : seg.replace(/\?/g, ".")))
            .join(" ")
            .replace(/\s{2,}/g, " ")
            .trim();
          if (!new RegExp(gateQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(replyText)) {
            replyText = `${replyText} ${gateQ}`.trim();
          }
        } else {
          // Default: outside allowed contexts, remove questions to avoid inorganic flow
          if (replyText.includes("?")) {
            replyText = replyText.replace(/\?/g, ".");
          }
        }
      } catch {
        // best-effort hygiene; ignore errors
      }

  // Prepare captions from the full reply (append to keep full transcript)
  let newSentences = splitIntoSentences(replyText);
  // Merge MC fragments like "A." + "7, B." + ... into a single inline sentence for captions
  newSentences = mergeMcChoiceFragments(newSentences);
  // After merging, enforce NBSP after MC labels so letter-choice pairs don't break across lines in the captions UI
  newSentences = newSentences.map((s) => enforceNbspAfterMcLabels(s));
      // Safety: if splitting lost substantial content (edge punctuation cases), fall back to a single full-text line
      const normalizedOriginal = replyText.replace(/\s+/g, " ").trim();
  const normalizedJoined = newSentences.join(" ").replace(/\s+/g, " ").trim();
      if (normalizedJoined.length < Math.floor(0.9 * normalizedOriginal.length)) {
        newSentences = [normalizedOriginal];
      }

      // Skip audio playback, transcript, and caption display if requested (for sentence-by-sentence gating)
      if (opts.skipAudio) {
        // Return text and sentences without updating UI - caller will handle display
        setLoading(false);
        setPhaseGuardSent((prev) => (prev[phaseKey] ? prev : { ...prev, [phaseKey]: true }));
        return { success: true, data, text: replyText, sentences: newSentences };
      }

    setTranscript(replyText);
    setError("");

  const prevLen = captionSentencesRef.current?.length || 0;
  let nextAll = [...(captionSentencesRef.current || [])];
  // If user provided input (innertext), insert it ABOVE Ms. Sonoma's reply as its own line,
  // adding a newline before and after so it stands on its own line.
  // These pre-reply items are NOT included in TTS scheduling.
  let preReplyExtra = 0;
  try {
    if (typeof innertext === 'string') {
      const it = innertext.trim();
      if (it) {
        nextAll.push('\n'); // ensure user text starts on a new line
        preReplyExtra += 1;
        nextAll.push({ text: it, role: 'user' }); // styled in CaptionPanel
        preReplyExtra += 1;
        nextAll.push('\n'); // ensure reply starts on a new line after user text
        preReplyExtra += 1;
      }
    }
  } catch { /* non-fatal */ }
      // Network + processing complete; stop showing loading placeholder BEFORE or while starting audio
      setLoading(false);
      
  nextAll = [...nextAll, ...newSentences];
  captionSentencesRef.current = nextAll;
  setCaptionSentences(nextAll);
  // Set selection to the first reply sentence (skip the inserted items before reply)
  setCaptionIndex(prevLen + preReplyExtra);

      const hasAudio = Boolean(data.audio);
      setIsSpeaking(hasAudio);
      
      if (opts.fastReturn) {
        // Fire-and-forget audio so caller can process reply (e.g., test review cue detection) immediately
        const replyStartIndex = prevLen + preReplyExtra;
        playAudioFromBase64(data.audio, newSentences, replyStartIndex)
          .catch(err => console.warn('[Session] Async audio playback failed (fastReturn).', err));
      } else {
        const replyStartIndex = prevLen + preReplyExtra;
        await playAudioFromBase64(data.audio, newSentences, replyStartIndex);
        setIsSpeaking(false);
      }

      // Mark guard as sent for this phase only after a successful reply
  setPhaseGuardSent((prev) => (prev[phaseKey] ? prev : { ...prev, [phaseKey]: true }));
  // Expose the sanitized reply text so callers (e.g., riddle judge/hint) can use it directly
  return { success: true, data, text: replyText };
    } catch (err) {
      // Some runtimes surface aborts with name 'AbortError', others pass through the reason (e.g., 'skip')
      const isAbort = err?.name === 'AbortError' || err === 'skip' || err?.message === 'skip' || err?.cause === 'skip';
      if (isAbort) {
        console.warn('[Session] Ms. Sonoma request aborted');
        setLoading(false);
        return { success: false, aborted: true };
      }
      console.error("[Session] Ms. Sonoma API call failed:", err);
      setTranscript("Ms. Sonoma is unavailable.");
      setError("We could not reach Ms. Sonoma.");
      // Keep previous caption on screen to avoid a blank stall
      return { success: false, error: err };
    } finally {
      // Loading already cleared earlier once reply text was prepared
      // For fastReturn flows, do NOT tear down audio here; let the audio lifecycle manage isSpeaking/video.
      if (!opts.fastReturn) {
        try { setIsSpeaking(false); } catch {}
        if (audioRef.current) {
          try { audioRef.current.pause(); } catch {}
          audioRef.current = null;
        }
      }
      // Clear controller
      if (sonomaAbortRef.current) sonomaAbortRef.current = null;
    }
  };

  // Ensure a set matches target length by topping up from provided pools
  const ensureExactCount = useCallback((base = [], target = 0, pools = [], allowDuplicatesAsLastResort = true) => {
    return ensureExactCountUtil(base, target, pools, allowDuplicatesAsLastResort);
  }, []);

  // REMOVED: sample deck - deprecated and no longer used
  // See docs/KILL_SAMPLE_ARRAY.md for why this was removed

  // Word problem deck (math) with non-repeating behavior
  const wordDeckRef = useRef([]);
  const wordIndexRef = useRef(0);
  
  const initWordDeck = useCallback((data) => {
    initWordDeckUtil(data, { wordDeckRef, wordIndexRef });
  }, []);
  
  const drawWordUnique = useCallback(() => {
    return drawWordUniqueUtil({ wordDeckRef, wordIndexRef });
  }, []);
  
  const reserveWords = useCallback((count) => {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const it = drawWordUnique();
      if (!it) break;
      out.push(it);
    }
    return out;
  }, [drawWordUnique]);

  // Assessment generation hook
  const {
    shuffle: shuffleHook,
    shuffleArr: shuffleArrHook,
    selectMixed: selectMixedHook,
    takeMixed: takeMixedHook,
    buildFromCategories: buildFromCategoriesHook,
    generateAssessments: generateAssessmentsHook,
  } = useAssessmentGeneration({
    lessonData,
    subjectParam,
    WORKSHEET_TARGET,
    TEST_TARGET,
    reserveWords,
    // REMOVED: reserveSamples - sample array deprecated
  });

  // Transient placeholder override for the input field (non-intrusive and time-limited)
  const [tipOverride, setTipOverride] = useState(null);
  const tipTimerRef = useRef(null);
  // Note: mutual exclusivity with Opening/Go buttons is handled via sendDisabled (buttonsGating)
  const showTipOverride = useCallback((text, ms = 10000) => {
    try { if (tipTimerRef.current) clearTimeout(tipTimerRef.current); } catch {}
    setTipOverride(String(text || '').trim() || null);
    if (ms > 0) {
      tipTimerRef.current = setTimeout(() => {
        setTipOverride(null);
        tipTimerRef.current = null;
      }, ms);
    }
  }, []);
  // Clear on state transitions so normal placeholder flow resumes immediately when the UI changes
  useEffect(() => {
    if (tipOverride != null) setTipOverride(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, subPhase, loading, canSend, showBegin, isSpeaking]);
  useEffect(() => () => { try { if (tipTimerRef.current) clearTimeout(tipTimerRef.current); } catch {} }, []);

  // Audio playback hook - manages all TTS audio, video sync, and caption scheduling
  const {
    playAudioFromBase64: playAudioFromBase64Hook,
    scheduleCaptionsForAudio: scheduleCaptionsForAudioHook,
    scheduleCaptionsForDuration: scheduleCaptionsForDurationHook,
    computeHeuristicDuration: computeHeuristicDurationHook,
    toggleMute: toggleMuteHook,
    clearSynthetic: clearSyntheticHook,
    finishSynthetic: finishSyntheticHook,
    pauseSynthetic: pauseSyntheticHook,
    resumeSynthetic: resumeSyntheticHook,
    // Refs from the hook
    audioCtxRef,
    webAudioGainRef,
    webAudioSourceRef,
    webAudioBufferRef,
    webAudioStartedAtRef,
    webAudioPausedAtRef,
    syntheticRef
  } = useAudioPlayback({
  // State setters
  setIsSpeaking,
  setShowRepeatButton,
  setShowOpeningActions,
    setCaptionIndex,
    setCaptionsDone,
    setCaptionSentences,
    setMuted,
    setAudioUnlocked,
    setOfferResume,
    
    // State values
    muted,
    loading,
    captionIndex,
    audioUnlocked,
    phase,
    subPhase,
    askState,
    riddleState,
    poemState,
    
    // Refs passed to hook
    audioRef,
    videoRef,
    mutedRef,
    audioUnlockedRef,
    captionIndexRef,
    captionSentencesRef,
    captionTimersRef,
    captionBatchStartRef,
    captionBatchEndRef,
    lastAudioBase64Ref,
    lastSentencesRef,
    lastStartIndexRef,
    preferHtmlAudioOnceRef,
    forceNextPlaybackRef,
    htmlAudioPausedAtRef,
    speechGuardTimerRef,
    lastGuardArmAtRef,
    
    // Utility functions from utils and inline functions
    scheduleCaptionsForAudioUtil,
    scheduleCaptionsForDurationUtil,
    clearSyntheticUtil,
    finishSyntheticUtil,
    pauseSyntheticUtil,
    resumeSyntheticUtil,
    clearCaptionTimers,
    clearSpeechGuard,
    armSpeechGuard,
    armSpeechGuardThrottled,
    forceStopSpeaking,
    showTipOverride,
    ensureAudioContext,
    playViaWebAudio,
  });

  // Create inline wrappers for audio utility functions using hook-provided refs
  const ensureAudioContextWrapped = useCallback(() => {
    return ensureAudioContext({ audioCtxRef, webAudioGainRef, mutedRef });
  }, [audioCtxRef, webAudioGainRef, mutedRef]);
  
  const playViaWebAudioWrapped = useCallback(async (b64, sentences, startIndex) => {
    return playViaWebAudio(
      b64,
      sentences,
      startIndex,
      { audioCtxRef, webAudioGainRef, webAudioSourceRef, webAudioBufferRef, webAudioStartedAtRef, webAudioPausedAtRef, mutedRef },
      scheduleCaptionsForDurationUtil,
      setIsSpeaking,
      armSpeechGuard,
      clearSpeechGuard,
      videoRef,
      videoPlayingRef,
      { captionBatchStartRef, captionBatchEndRef },
      forceNextPlaybackRef,
      phase,
      subPhase,
      askState,
      riddleState,
      poemState,
      setShowOpeningActions
    );
  }, [audioCtxRef, webAudioGainRef, webAudioSourceRef, webAudioBufferRef, webAudioStartedAtRef, webAudioPausedAtRef, mutedRef, phase, subPhase, askState, riddleState, poemState, armSpeechGuard, clearSpeechGuard]);
  
  const stopWebAudioSourceWrapped = useCallback(() => {
    return stopWebAudioSource(webAudioSourceRef);
  }, [webAudioSourceRef]);
  
  const unlockAudioPlaybackWrapped = useCallback(async () => {
    return unlockAudioPlayback({ audioCtxRef, webAudioGainRef, mutedRef }, audioUnlockedRef, setAudioUnlocked);
  }, [audioCtxRef, webAudioGainRef, mutedRef]);

  // Use hook-provided functions (avoids redeclaration of inline wrappers below)
  const playAudioFromBase64 = playAudioFromBase64Hook;
  const scheduleCaptionsForAudio = scheduleCaptionsForAudioHook;
  const scheduleCaptionsForDuration = scheduleCaptionsForDurationHook;
  const computeHeuristicDuration = computeHeuristicDurationHook;
  const toggleMute = toggleMuteHook;
  const clearSynthetic = clearSyntheticHook;
  const finishSynthetic = finishSyntheticHook;
  const pauseSynthetic = pauseSyntheticHook;
  const resumeSynthetic = resumeSyntheticHook;

  // Skip speech: stop TTS, video, captions and jump to end of current response turn
  const handleSkipSpeech = useCallback(() => {
    console.log('[handleSkipSpeech] Skipping current speech');
    
    // Stop all audio playback
    if (audioRef.current) {
      try { audioRef.current.pause(); } catch {}
      try { audioRef.current.src = ''; } catch {}
      audioRef.current = null;
    }
    
    // Stop WebAudio source
    if (webAudioSourceRef.current) {
      try { webAudioSourceRef.current.stop(); } catch {}
      try { webAudioSourceRef.current.disconnect(); } catch {}
      webAudioSourceRef.current = null;
    }
    
    // Stop synthetic playback
    try { clearSynthetic(); } catch {}
    
    // Pause video
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch {}
    }
    
    // Clear captions
    try { clearCaptionTimers(); } catch {}
    
    // Clear speech guard timer
    try { clearSpeechGuard(); } catch {}
    
    // Set speaking to false
    try { setIsSpeaking(false); } catch {}
    
    // Hide repeat button since we're skipping
    try { setShowRepeatButton(false); } catch {}
    
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
  }, [phase, subPhase, askState, riddleState, poemState, clearSynthetic, clearSpeechGuard]);

  // Repeat speech: replay the last TTS audio without updating captions
  const handleRepeatSpeech = useCallback(async () => {
    console.log('[handleRepeatSpeech] Repeating last speech');
    
    // Check if we have audio to replay
    if (!lastAudioBase64Ref.current) {
      console.warn('[handleRepeatSpeech] No audio available to repeat');
      return;
    }
    
    // Hide repeat button while playing
    setShowRepeatButton(false);
    
    // Set speaking state
    setIsSpeaking(true);
    
    try {
      // Replay audio without updating captions (pass empty array for sentences)
      await playAudioFromBase64(lastAudioBase64Ref.current, [], 0);
    } catch (err) {
      console.error('[handleRepeatSpeech] Failed to replay audio:', err);
      setIsSpeaking(false);
      // Show repeat button again since replay failed
      if (lastAudioBase64Ref.current) {
        setShowRepeatButton(true);
      }
    }
  }, [playAudioFromBase64]);

  // Helper: speak arbitrary frontend text via unified captions + TTS
  // (defined here after playAudioFromBase64 is available, and updates the ref for early callbacks)
  const speakFrontendImpl = useCallback(async (text, opts = {}) => {
    console.log('[speakFrontendImpl] Called with text:', text?.substring(0, 50), 'opts:', opts);
    try {
      const mcLayout = opts && typeof opts === 'object' ? (opts.mcLayout || 'inline') : 'inline';
      const noCaptions = !!(opts && typeof opts === 'object' && opts.noCaptions);
      let sentences = splitIntoSentences(text);
      sentences = mergeMcChoiceFragments(sentences, mcLayout).map((s) => enforceNbspAfterMcLabels(s));
      // When noCaptions is set (e.g., resume after refresh), do not mutate caption state
      // so the transcript on screen does not duplicate. Still play TTS.
      let startIndexForBatch = 0;
      if (!noCaptions) {
        const prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), ...sentences];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
        startIndexForBatch = prevLen;
      } else {
        // Keep current caption index; batch will be empty so no scheduling occurs
        try { startIndexForBatch = Number(captionIndexRef.current || 0); } catch { startIndexForBatch = 0; }
      }
      console.log('[speakFrontendImpl] About to fetch TTS');
      let dec = false;
      try {
        setTtsLoadingCount((c) => c + 1);
        let res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
        if (!res.ok) {
          try { await fetch('/api/tts', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(() => {}); } catch {}
          res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
        }
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          let b64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
          if (b64) b64 = normalizeBase64Audio(b64);
          console.log('[speakFrontendImpl] Got audio, length:', b64?.length || 0);
          if (b64) {
            if (!dec) { setTtsLoadingCount((c) => Math.max(0, c - 1)); dec = true; }
            // Let the playback engine manage isSpeaking lifecycle
            try { setIsSpeaking(true); } catch {}
            console.log('[speakFrontendImpl] About to play audio');
            try { await playAudioFromBase64(b64, noCaptions ? [] : sentences, startIndexForBatch); } catch {}
            console.log('[speakFrontendImpl] Audio playback complete');
          } else {
            if (!dec) { setTtsLoadingCount((c) => Math.max(0, c - 1)); dec = true; }
            // Use unified synthetic playback so video + isSpeaking behave consistently
            try { await playAudioFromBase64('', noCaptions ? [] : sentences, startIndexForBatch); } catch {}
          }
        }
      } catch (err) {
        console.error('[speakFrontendImpl] Error:', err);
      }
      finally { if (!dec) setTtsLoadingCount((c) => Math.max(0, c - 1)); }
    } catch (err) {
      console.error('[speakFrontendImpl] Outer error:', err);
    }
  }, [playAudioFromBase64, setTtsLoadingCount, setIsSpeaking, setCaptionSentences, setCaptionIndex, captionSentencesRef, captionIndexRef]);

  // Update the ref so early callbacks can use it
  useEffect(() => { 
    // console.log('[speakFrontendImpl] Updating ref with implementation'); // Removed: excessive logging
    speakFrontendRef.current = speakFrontendImpl; 
  }, [speakFrontendImpl]);

  // Update refs with hook-provided functions (for use in callbacks defined before the hook)
  useEffect(() => { scheduleCaptionsForAudioRef.current = scheduleCaptionsForAudio; }, [scheduleCaptionsForAudio]);
  useEffect(() => { scheduleCaptionsForDurationRef.current = scheduleCaptionsForDuration; }, [scheduleCaptionsForDuration]);
  useEffect(() => { computeHeuristicDurationRef.current = computeHeuristicDuration; }, [computeHeuristicDuration]);
  useEffect(() => { playAudioFromBase64Ref.current = playAudioFromBase64; }, [playAudioFromBase64]);

  // Use discussion handlers hook
  const {
    handleTellJoke,
    handleAskQuestionStart,
    handleAskConfirmYes,
    handleAskConfirmNo,
    handleAskAnother,
    handleAskBack,
    handleTellRiddle,
    judgeRiddleAttempt,
    requestRiddleHint,
    revealRiddleAnswer,
    handleRiddleBack,
    handlePoemStart,
    handlePoemSuggestions,
    handlePoemOk,
    handlePoemBack,
    handleStoryStart,
    handleStoryYourTurn,
    handleStoryEnd,
    handleStoryBack,
    handleFillInFunStart,
    handleFillInFunWordSubmit,
    handleFillInFunOk,
    handleFillInFunBack,
  } = useDiscussionHandlers({
    setShowOpeningActions,
    setJokeUsedThisGate,
    setRiddleUsedThisGate,
    setPoemUsedThisGate,
    setStoryUsedThisGate,
  setStoryState,
  setStorySetupStep,
  setStoryCharacters,
  setStorySetting,
  setStoryPlot,
  setStoryPhase,
  setStoryTranscript,
    setFillInFunUsedThisGate,
    setCanSend,
    setLoading,
    setAskState,
    setAskOriginalQuestion,
    setRiddleState,
    setCurrentRiddle,
    setPoemState,
    setShowPoemSuggestions,
    setStoryState,
    setStoryTranscript,
    setStorySetupStep,
    setStoryCharacters,
    setStorySetting,
    setStoryPlot,
    setStoryPhase,
    setFillInFunState,
    setFillInFunTemplate,
    setFillInFunCollectedWords,
    setFillInFunCurrentIndex,
    setTtsLoadingCount,
    setIsSpeaking,
    setCaptionSentences,
    setCaptionIndex,
    setLearnerInput,
    setAbortKey,
    jokeUsedThisGate,
    fillInFunUsedThisGate,
    subjectParam,
    lessonData,
    phase,
    subPhase,
    currentCompProblem,
    currentExerciseProblem,
    currentWorksheetIndex,
    generatedWorksheet,
    testActiveIndex,
    generatedTest,
    askOriginalQuestion,
    currentRiddle,
    storyTranscript,
    storySetupStep,
    storyCharacters,
    storySetting,
    storyPlot,
    storyPhase,
    fillInFunTemplate,
    fillInFunCollectedWords,
    fillInFunCurrentIndex,
    difficultyParam,
    lessonParam,
    learnerGrade,
    captionSentencesRef,
    askReturnBodyRef,
    activeQuestionBodyRef,
    worksheetIndexRef,
    speakFrontend,
    callMsSonoma,
    playAudioFromBase64,
    hasGoldenKey,
  });

  // Use phase handlers hook
  const {
    handleGoComprehension: handleGoComprehensionHook,
    handleGoExercise: handleGoExerciseHook,
    handleGoWorksheet: handleGoWorksheetHook,
    handleGoTest: handleGoTestHook,
    handleStartLesson: handleStartLessonHook
  } = usePhaseHandlers({
    // State setters
    setShowOpeningActions,
    setCurrentCompProblem,
    setSubPhase,
    setQaAnswersUnlocked,
    setCanSend,
    setCurrentCompIndex,
    setCompPool,
    setCurrentExerciseProblem,
    setCurrentExIndex,
    setExercisePool,
    
    // State values
    phase,
    currentCompProblem,
    generatedComprehension,
    currentCompIndex,
    compPool,
    currentExerciseProblem,
    generatedExercise,
    currentExIndex,
    exercisePool,
    generatedWorksheet,
    generatedTest,
    
    // Refs
    activeQuestionBodyRef,
    startThreeStageTeachingRef,
    
    // Functions
    speakFrontend,
    // REMOVED: drawSampleUnique - deprecated zombie code
    buildQAPool
  });

  // Use hook-provided phase handlers
  const handleGoComprehension = handleGoComprehensionHook;
  const handleGoExercise = handleGoExerciseHook;
  const handleGoWorksheet = handleGoWorksheetHook;
  const handleGoTest = handleGoTestHook;
  const handleStartLesson = handleStartLessonHook;


  useEffect(() => {
    return () => {
      clearCaptionTimers();
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch {
          /* ignore */
        }
      }
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  

  const startDiscussionStep = async () => {
    try { console.info('[Opening] startDiscussionStep entered'); } catch {}
    try { console.info('[Opening] generateOpening typeof =', typeof generateOpening); } catch {}
    
    // CRITICAL: Unlock audio during user gesture (Begin click) - required for Chrome
    try {
      console.info('[Opening] Unlocking audio playback for Chrome');
      await unlockAudioPlaybackWrapped();
    } catch (e) {
      console.warn('[Opening] Audio unlock failed', e);
    }
    
    // Ensure we are not starting in a muted state
    try { setMuted(false); } catch {}
    try { mutedRef.current = false; } catch {}
    try { forceNextPlaybackRef.current = true; } catch {}
    
    // CRITICAL for Chrome: Unlock video autoplay by playing during user gesture
    // Keep it playing (muted and looping) so audio code doesn't need to restart it
    try {
      if (videoRef.current) {
        console.info('[Opening] Starting video during Begin for Chrome autoplay');
        if (videoRef.current.readyState < 2) {
          videoRef.current.load();
          // Wait a moment for load to register
          await new Promise(r => setTimeout(r, 100));
        }
        // Play video and keep it playing (it's muted and looping anyway)
        const playPromise = videoRef.current.play();
        if (playPromise && playPromise.then) {
          await playPromise;
          console.info('[Opening] Video playing and unlocked for Chrome');
        }
      }
    } catch (e) {
      console.warn('[Opening] Video play failed', e);
    }
    
  // Unified discussion is now generated locally: Greeting + Encouragement + next-step prompt (no joke/silly question)
    setCanSend(false);
    // Compose the opening text using local pools (no API/TTS for this step)
    const learnerName = (typeof window !== 'undefined' ? (localStorage.getItem('learner_name') || '') : '').trim();
    const lessonTitleExact = (effectiveLessonTitle && typeof effectiveLessonTitle === 'string' && effectiveLessonTitle.trim()) ? effectiveLessonTitle.trim() : 'the lesson';
    const safeSubject = (subjectParam || '').trim() || 'math';
    try {
      try { console.info('[Opening] about to call generateOpening'); } catch {}
      const openingText = generateOpening({ name: learnerName || 'friend', lessonTitle: lessonTitleExact, subject: safeSubject });
      try { console.info('[Opening] generated text len=', (openingText || '').length); } catch {}
      // Hygiene similar to unified-discussion cleanup when coming from API
      let replyText = String(openingText || '')
        .replace(/\b(exercise|worksheet|test|exam|quiz|answer key)\b/gi, '')
        .split('\n')
        .map((line) => line.replace(/[ \t]{2,}/g, ' ').replace(/\s+$/g, ''))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      // Inject into transcript and captions locally (isolate errors so TTS still proceeds)
      try { console.info('[Opening] setting transcript and preparing captions'); } catch {}
      setTranscript(replyText);
      setError("");
      let prevLen = 0;
      let newSentences = [];
      try {
        // Prepare captions from the full reply
        try { console.info('[Opening] splitIntoSentences start'); } catch {}
        newSentences = splitIntoSentences(replyText);
        newSentences = mergeMcChoiceFragments(newSentences);
        newSentences = newSentences.map((s) => enforceNbspAfterMcLabels(s));
        const normalizedOriginal = replyText.replace(/\s+/g, ' ').trim();
        const normalizedJoined = newSentences.join(' ').replace(/\s+/g, ' ').trim();
        if (normalizedJoined.length < Math.floor(0.9 * normalizedOriginal.length)) {
          newSentences = [normalizedOriginal];
        }
        prevLen = captionSentencesRef.current?.length || 0;
        let nextAll = [...(captionSentencesRef.current || [])];
        nextAll = [...nextAll, ...newSentences];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
        try { console.info('[Opening] captions prepared; sentences=', newSentences.length, 'startIndex=', prevLen); } catch {}
      } catch (capErr) {
        try { console.warn('[Opening] caption prep failed; proceeding to TTS anyway', capErr?.name || capErr); } catch {}
        // Keep minimal single-sentence caption
        newSentences = [replyText];
        prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), replyText];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
      }

      // Request TTS for the local opening and play it using the same pipeline as API replies.
      setLoading(true);
      setTtsLoadingCount((c) => c + 1);
      const replyStartIndex = prevLen; // we appended opening sentences at the end
      try { console.info('[OpeningTTS] POST /api/tts starting�'); } catch {}
      let res;
      try {
        res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: replyText }) });
        try { console.info('[OpeningTTS] /api/tts status=', res.status, 'ok=', res.ok); } catch {}
        var data = await res.json().catch(() => ({}));
        try { console.info('[OpeningTTS] /api/tts payload keys=', Object.keys(data || {})); } catch {}
        var audioB64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
        // Dev warm-up: if route wasn�t ready (404) or no audio returned, pre-warm and retry once
        if ((!res.ok && res.status === 404) || !audioB64) {
          try { console.warn('[OpeningTTS] No audio or 404 from /api/tts; warming route and retrying once�'); } catch {}
          try { await fetch('/api/tts', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(() => {}); } catch {}
          try { await waitForBeat(400); } catch {}
          res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: replyText }) });
          try { console.info('[OpeningTTS] /api/tts retry status=', res.status, 'ok=', res.ok); } catch {}
          data = await res.json().catch(() => ({}));
          try { console.info('[OpeningTTS] /api/tts retry payload keys=', Object.keys(data || {})); } catch {}
          audioB64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
        }
      } finally {
        setTtsLoadingCount((c) => Math.max(0, c - 1));
      }
      if (audioB64) audioB64 = normalizeBase64Audio(audioB64);
      // Match API flow: stop showing loading before kicking off audio
      setLoading(false);
      if (audioB64) {
        try { console.info('[OpeningTTS] using Google TTS, len=', audioB64.length); } catch {}
        // Stash payload so gesture-based unlock can retry immediately if needed
        try { lastAudioBase64Ref.current = audioB64; } catch {}
        setIsSpeaking(true);
        // Give the UI a brief beat to commit !loading before starting audio
        try { await waitForBeat(60); } catch {}
        // Prefer HTMLAudio for the very first Opening playback; clear automatically after attempt
        try { preferHtmlAudioOnceRef.current = true; } catch {}
        // Fire-and-forget to match fastReturn behavior; UI remains responsive
        playAudioFromBase64(audioB64, newSentences, replyStartIndex)
          .catch(err => console.warn('[OpeningTTS] audio playback failed', err));
        // Safety: if we are not speaking within ~1.2s, attempt one recovery by switching path
        try {
          openingReattemptedRef.current = false;
          setTimeout(async () => {
            try {
              if (!isSpeakingRef.current && lastAudioBase64Ref.current && !openingReattemptedRef.current) {
                openingReattemptedRef.current = true;
                const b64 = lastAudioBase64Ref.current;
                // Flip preference: if we tried HTML first, force WebAudio; otherwise, force HTML once
                if (preferHtmlAudioOnceRef.current) {
                  // We still prefer HTML per flag; switch to WebAudio explicitly
                  try { console.warn('[OpeningTTS] Recovery: trying WebAudio path after initial silence'); } catch {}
                  try { await playViaWebAudio(b64, newSentences, replyStartIndex); } catch (e) { try { console.warn('[OpeningTTS] Recovery WebAudio failed', e); } catch {} }
                } else {
                  try { console.warn('[OpeningTTS] Recovery: retrying via HTMLAudio path'); } catch {}
                  try { preferHtmlAudioOnceRef.current = true; } catch {}
                  try { await playAudioFromBase64(b64, newSentences, replyStartIndex); } catch (e) { try { console.warn('[OpeningTTS] Recovery HTMLAudio failed', e); } catch {} }
                }
              }
            } catch {}
          }, 1200);
        } catch {}
      } else {
        console.warn('[OpeningTTS] No audio in TTS response for Opening');
      }
      setSubPhase('awaiting-learner');
      setCanSend(true);
    } catch (e) {
      // Fallback: if anything fails, show a minimal safe opening and still TTS it
      try { console.error('[Opening] generation failed, using fallback text', e); } catch {}
  const fallback = `${learnerName ? `Hello, ${learnerName}.` : 'Hello.'} Today's lesson is ${lessonTitleExact}.\n\nYou're going to do amazing.\n\nWhat would you like to do first?`;
      setTranscript(fallback);
      let newSentences = splitIntoSentences(fallback);
      newSentences = mergeMcChoiceFragments(newSentences).map((s) => enforceNbspAfterMcLabels(s));
      const prevLen = captionSentencesRef.current?.length || 0;
      const nextAll = [...(captionSentencesRef.current || []), ...newSentences];
      captionSentencesRef.current = nextAll;
      setCaptionSentences(nextAll);
      setCaptionIndex(prevLen);
      // Proceed to TTS the fallback so audio still plays
      try {
        setLoading(true);
        setTtsLoadingCount((c) => c + 1);
        const replyStartIndex = prevLen;
        try { console.info('[OpeningTTS] Fallback: POST /api/tts starting�'); } catch {}
        let res;
        let data;
        let audioB64;
        try {
          res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: fallback }) });
          try { console.info('[OpeningTTS] Fallback status=', res.status, 'ok=', res.ok); } catch {}
          data = await res.json().catch(() => ({}));
          audioB64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
          if ((!res.ok && res.status === 404) || !audioB64) {
            try { await fetch('/api/tts', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(() => {}); } catch {}
            try { await waitForBeat(300); } catch {}
            res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: fallback }) });
            data = await res.json().catch(() => ({}));
            audioB64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
          }
        } finally {
          setTtsLoadingCount((c) => Math.max(0, c - 1));
        }
        if (audioB64) audioB64 = normalizeBase64Audio(audioB64);
        setLoading(false);
        if (audioB64) {
          try { lastAudioBase64Ref.current = audioB64; } catch {}
          setIsSpeaking(true);
          try { await waitForBeat(40); } catch {}
          try { preferHtmlAudioOnceRef.current = true; } catch {}
          playAudioFromBase64(audioB64, newSentences, replyStartIndex).catch(() => {});
          try {
            openingReattemptedRef.current = false;
            setTimeout(async () => {
              try {
                if (!isSpeakingRef.current && lastAudioBase64Ref.current && !openingReattemptedRef.current) {
                  openingReattemptedRef.current = true;
                  const b64 = lastAudioBase64Ref.current;
                  try { await playViaWebAudio(b64, newSentences, replyStartIndex); } catch {}
                }
              } catch {}
            }, 1200);
          } catch {}
        } else {
          try { console.warn('[OpeningTTS] Fallback had no audio'); } catch {}
          setIsSpeaking(false);
        }
      } catch {
        setLoading(false);
        setIsSpeaking(false);
  }
      setSubPhase('awaiting-learner');
      setCanSend(true);
    }
  };

  const startTeachingStep = async () => {
    const currentIndex = teachingSteps.findIndex((step) => step.key === subPhase);
    if (currentIndex === -1) {
      return;
    }
    const step = teachingSteps[currentIndex];
    setCanSend(false);
    const stepInstruction = step.key === 'teaching-intro' ? withTeachingNotes(step.instruction) : step.instruction;
    const result = await callMsSonoma(stepInstruction, "", {
      phase: "teaching",
      subject: subjectParam,
      difficulty: difficultyParam,
      lesson: lessonParam,
  lessonTitle: effectiveLessonTitle,
      step: step.key,
      teachingNotes: getTeachingNotes() || undefined,
    });
    if (!result.success) {
      return;
    }
    if (step.next === "awaiting-gate") {
      setSubPhase("awaiting-gate");
      // Disable text input; gate is controlled by Yes/No UI buttons
      setCanSend(false);
    } else {
      setSubPhase(step.next);
    }
  };

  // Three-stage teaching state and helpers
  const [teachingStage, setTeachingStage] = useState('idle'); // 'idle' | 'definitions' | 'examples'
  const [stageRepeats, setStageRepeats] = useState({ definitions: 0, explanation: 0, examples: 0 });

  // Session snapshot persistence (restore and save) � placed after state declarations to avoid TDZ
  const restoredSnapshotRef = useRef(false);
  const didRunRestoreRef = useRef(false); // ensure we attempt restore exactly once per mount
  const restoreFoundRef = useRef(false);  // whether we actually applied a prior snapshot
  const resumeAppliedRef = useRef(false); // track whether resume reconciliation has been applied
  const snapshotSaveTimerRef = useRef(null);
  // Track a logical per-restart session id for per-session transcript files
  const [transcriptSessionId, setTranscriptSessionId] = useState(null);
  // Used to coalesce redundant saves: store a compact signature of the last saved meaningful state
  const lastSavedSigRef = useRef(null);
  // Retry budget for labeled saves when key is not yet ready
  const pendingSaveRetriesRef = useRef({});

  // Snapshot persistence system (must be early to avoid TDZ errors in handleRestartClick)
  const { scheduleSaveSnapshot, snapshotSigMemo } = useSnapshotPersistence({
    // State values
    phase,
    subPhase,
    showBegin,
    ticker,
    teachingStage,
    stageRepeats,
    qaAnswersUnlocked,
    jokeUsedThisGate,
    riddleUsedThisGate,
    poemUsedThisGate,
    storyUsedThisGate,
  storyState,
  storySetupStep,
  storyCharacters,
  storySetting,
  storyPlot,
  storyPhase,
    storyTranscript,
    currentCompIndex,
    currentExIndex,
    currentWorksheetIndex,
    testActiveIndex,
    currentCompProblem,
    currentExerciseProblem,
    testUserAnswers,
    testCorrectByIndex,
    testCorrectCount,
    testFinalPercent,
    congratsStarted,
    congratsDone,
    captionSentences,
    captionIndex,
    usedTestCuePhrases,
    generatedComprehension,
    generatedExercise,
    generatedWorksheet,
    generatedTest,
    // State setters
    setPhase,
    setSubPhase,
    setShowBegin,
    setTicker,
    setTeachingStage,
    setStageRepeats,
    setQaAnswersUnlocked,
    setJokeUsedThisGate,
    setRiddleUsedThisGate,
    setPoemUsedThisGate,
    setStoryUsedThisGate,
  setStoryState,
  setStorySetupStep,
  setStoryCharacters,
  setStorySetting,
  setStoryPlot,
  setStoryPhase,
    setStoryTranscript,
    setCurrentCompIndex,
    setCurrentExIndex,
    setCurrentWorksheetIndex,
    setTestActiveIndex,
    setCurrentCompProblem,
    setCurrentExerciseProblem,
    setTestUserAnswers,
    setTestCorrectByIndex,
    setTestCorrectCount,
    setTestFinalPercent,
    setCongratsStarted,
    setCongratsDone,
    setCaptionSentences,
    setCaptionIndex,
    setUsedTestCuePhrases,
    setGeneratedComprehension,
    setGeneratedExercise,
    setLoading,
    setOfferResume,
    setCanSend,
    setShowOpeningActions,
    setTtsLoadingCount,
    setIsSpeaking,
    // Refs
    restoredSnapshotRef,
    restoreFoundRef,
    didRunRestoreRef,
    snapshotSaveTimerRef,
    pendingSaveRetriesRef,
    lastSavedSigRef,
    activeQuestionBodyRef,
    captionSentencesRef,
    worksheetIndexRef,
    sessionStartRef,
    preferHtmlAudioOnceRef,
    resumeAppliedRef,
    // Functions
    getSnapshotStorageKey,
    // Data
    lessonParam,
    lessonData,
    manifestInfo,
    effectiveLessonTitle,
    transcriptSessionId,
    WORKSHEET_TARGET,
    TEST_TARGET,
  });

  // Helper: gather vocab from multiple potential sources/keys
  const getAvailableVocab = useCallback((dataOverride = null) => {
    // Try known lessonData keys
    const ld = dataOverride || lessonData || {};
    const raw = ld.vocab ?? ld.vocabulary ?? ld.vocabularyTerms ?? ld.terms;
    if (!raw) return [];
    // If already an array, normalize items and return
    if (Array.isArray(raw)) {
      const arr = raw.filter(Boolean).map((v) => {
        if (typeof v === 'string') return { term: v, definition: '' };
        if (v && typeof v === 'object') {
          const term = v.term || v.word || v.key || '';
          const definition = v.definition || v.def || '';
          if (term || definition) return { term, definition };
        }
        return null;
      }).filter(Boolean);
      return arr;
    }
    // If a single object, coerce to one-item array
    if (typeof raw === 'object') {
      // If looks like a single vocab item
      if ('term' in raw || 'definition' in raw || 'word' in raw) {
        const term = raw.term || raw.word || raw.key || '';
        const definition = raw.definition || raw.def || '';
        return (term || definition) ? [{ term, definition }] : [];
      }
      // If looks like a dictionary { term: definition }
      const entries = Object.entries(raw).map(([k, v]) => ({ term: String(k), definition: typeof v === 'string' ? v : '' }));
      return entries.filter(e => e.term || e.definition);
    }
    // If a string, try comma-separated list
    if (typeof raw === 'string') {
      const parts = raw.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
      return parts.map(p => ({ term: p, definition: '' }));
    }
    return [];
  }, [lessonData]);

  // Helper: clean lesson title for display (strip grade prefixes, difficulty suffixes, underscores/extensions)
  const getCleanLessonTitle = useCallback(() => {
    try {
      let title = (manifestInfo?.title || effectiveLessonTitle || lessonParam || '').toString();
      // Remove extension
      title = title.replace(/\.json$/i, '');
      // Replace underscores with spaces
      title = title.replace(/_/g, ' ');
      // Drop grade token at start (e.g., "4th ")
      title = title.replace(/^\s*(K|1st|2nd|3rd|[4-9]th|1[0-2]th)\s+/i, '');
      // Drop trailing difficulty markers
      title = title.replace(/\s+(Beginner|Intermediate|Advanced)$/i, '');
      // Title case normalization: leave as-is to avoid unintended changes
      return title.trim();
    } catch { return ''; }
  }, [manifestInfo?.title, effectiveLessonTitle, lessonParam]);

  // Helper: fallback vocab list from title keywords if no explicit vocab
  const getFallbackVocabFromTitle = useCallback(() => {
    const t = getCleanLessonTitle();
    if (!t) return [];
    const stop = new Set(['with','and','the','of','a','an','to','in','on','for','by','vs','versus','about','into','from']);
    const words = t.split(/[^A-Za-z]+/).map(w => w.trim()).filter(w => w && !stop.has(w.toLowerCase()));
    const uniq = Array.from(new Set(words.map(w => w.charAt(0).toUpperCase() + w.slice(1))));
    return uniq.slice(0, 5); // 3�5 terms
  }, [getCleanLessonTitle]);

  const hasVocab = useMemo(() => {
    try {
      const v = getAvailableVocab();
      return Array.isArray(v) && v.length > 0;
    } catch { return false; }
  }, [getAvailableVocab]);

  // Flatten vocab terms into a simple string array for caption highlighting during Discussion
  const vocabTermsForHighlight = useMemo(() => {
    try {
      let terms = [];
      const v = getAvailableVocab();
      if (Array.isArray(v) && v.length) {
        terms = v.map((it) => (typeof it === 'string' ? it : (it && typeof it === 'object' ? String(it.term || it.word || it.key || '') : '')));
      } else {
        // Fallback to title-derived terms when no explicit vocab is present
        terms = getFallbackVocabFromTitle();
      }
      // Normalize, dedupe case-insensitively, keep original casing of first occurrence
      const map = new Map();
      for (const t of terms) {
        const s = String(t || '').trim();
        if (!s) continue;
        const k = s.toLowerCase();
        if (!map.has(k)) map.set(k, s);
      }
      // Sort by length descending so longer phrases are preferred in combined regex
      return Array.from(map.values()).sort((a,b)=>b.length-a.length);
    } catch { return []; }
  }, [getAvailableVocab, getFallbackVocabFromTitle]);

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

  // Auto-advance scripted steps after audio finishes speaking
  useEffect(() => {
    // Only auto-advance after the session has begun and after audio finishes
    if (showBegin || loading || isSpeaking) return;

    // Do not auto-advance discussion anymore; it's unified into one step
    if (phase === "discussion") return;

    if (phase === "teaching") {
      // When running the new three-stage teaching flow, do not run legacy auto-advance
      if (teachingStage !== 'idle') return;
      // Progress through teaching steps automatically until awaiting-gate
      if (["teaching-intro", "teaching-example", "teaching-wrap"].includes(subPhase)) {
        startTeachingStep();
      }
    }
  }, [isSpeaking, loading, phase, subPhase, showBegin, teachingStage]);

  // Enable downloads when generated sets exist; for non-math also allow when categories/legacy arrays are present
  const hasNonMathCats = subjectParam !== 'math' && Boolean(
    (lessonData?.truefalse && lessonData.truefalse.length) ||
    (lessonData?.multiplechoice && lessonData.multiplechoice.length) ||
    (lessonData?.fillintheblank && lessonData.fillintheblank.length) ||
    (lessonData?.shortanswer && lessonData.shortanswer.length)
  );
  const hasLegacyNonMath = subjectParam !== 'math' && Boolean(
    (lessonData?.worksheet && lessonData.worksheet.length) ||
    (lessonData?.test && lessonData.test.length)
  );
  const canDownloadWorksheet = Boolean(
    (generatedWorksheet && generatedWorksheet.length) ||
    hasNonMathCats ||
    hasLegacyNonMath
  );
  const canDownloadTest = Boolean(
    (generatedTest && generatedTest.length) ||
    hasNonMathCats ||
    hasLegacyNonMath
  );
  const canDownloadAnswers = Boolean(
    canDownloadWorksheet || canDownloadTest
  );

  // PDF generator (worksheet/test). For worksheet: add header bar "<Title> Worksheet 20 __________" with name line.
  // Dynamically choose largest font size that fits on a single page for worksheet content; tests retain multi-page flow.
  // Mobile-friendly share/preview helper: tries OS share sheet first, then native viewer, then download
  async function shareOrPreviewPdf(blob, fileName = 'document.pdf', previewWin = null) {
    // 1) Web Share Level 2 (files) => opens OS sheet with Print on mobile
    try {
      const supportsFile = typeof File !== 'undefined';
      const file = supportsFile ? new File([blob], fileName, { type: 'application/pdf' }) : null;
      if (file && navigator?.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
        return;
      }
    } catch { /* fall through */ }

    // 2) Browser native PDF viewer (new tab if available, else same tab)
    try {
      const url = URL.createObjectURL(blob);
      const win = previewWin && previewWin.document ? previewWin : null;
      if (win) {
        try { win.addEventListener('beforeunload', () => URL.revokeObjectURL(url)); } catch {}
        win.location.href = url;
      } else {
        try { showTipOverride('Tip: Allow pop-ups to preview PDFs. Opening here instead...', 6000); } catch {}
        window.location.href = url;
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 10000);
      }
      return;
    } catch { /* fall through */ }

    // 3) Last resort: force download
    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} document.body.removeChild(a); }, 10000);
    } catch { /* noop */ }
  }

  async function createPdfForItems(items = [], label = 'worksheet', previewWin = null) {
    try {
      const doc = new jsPDF();
      const lessonTitle = (lessonData?.title || manifestInfo.title || 'Lesson').trim();
      const niceLabel = label.charAt(0).toUpperCase() + label.slice(1);
      // Short-answer spacing tuning (mm): we want more space above the line, less below it
      const SHORT_PAD_ABOVE = 6; // gap between text block and the short-answer line
      const SHORT_PAD_BELOW = 2; // gap between the line and the next block
      // Helper: lengthen answer blanks for word problems in worksheet PDFs
      const isLikelyWordProblem = (q) => {
        if (!q) return false;
        // Never treat explicit fill-in-the-blank items as word problems
        const qType = String(q.type || '').toLowerCase();
        if (q.sourceType === 'fib' || /fill\s*in\s*the\s*blank|fillintheblank/.test(qType)) return false;
        if (q.sourceType === 'word') return true;
        const text = String(q.prompt || q.question || '').trim();
        if (!text) return false;
        if (text.includes('=')) return false; // equations are not word problems
        // Treat as word problem if letters other than the operator 'x' appear
        const lettersExcludingX = text.replace(/x/gi, '').match(/[a-wy-z]/i);
        return Boolean(lettersExcludingX);
      };
      // Helper: dynamically size blanks for fill-in-the-blank items based on answer length
      // Scales blank size proportionally to answer length to avoid tiny spaces for long words
      const shrinkFIBBlanks = (s, answerLength = 0) => {
        if (!s) return s;
        return s.replace(/_{4,}/g, (m) => {
          // Base size: scale with answer length (roughly 2 underscores per character)
          // Min 12 underscores for short answers, max 60 for very long ones
          let targetSize = 12;
          if (answerLength > 0) {
            targetSize = Math.max(12, Math.min(60, answerLength * 2));
          } else {
            // Fallback: use 66% of original blank length if answer length unknown
            targetSize = Math.max(12, Math.round(m.length * 0.66));
          }
          return '_'.repeat(targetSize);
        });
      };
      const expandBlank = (s, factor = 4) => {
        if (!s) return s;
        return s.replace(/_{3,}/g, (m) => {
          const len = m.length * (factor || 4);
          const cap = Math.min(120, len); // hard cap to avoid overflow
          return '_'.repeat(cap);
        });
      };
      // Format a question's text for PDF rendering (apply FIB shrink, TF prefix) and split MC choices
      // Returns { prompt, choicesLine }
      const renderLineText = (item) => {
        let base = String(item.prompt || item.question || item.Q || item.q || '');
        const qType = String(item.type || '').toLowerCase();
        const isFIB = item.sourceType === 'fib' || /fill\s*in\s*the\s*blank|fillintheblank/.test(qType);
        const isTF = item.sourceType === 'tf' || /^(true\s*\/\s*false|truefalse|tf)$/i.test(qType);
        // Shrink blanks for FIB items (both worksheet and test) based on answer length
        if (isFIB) {
          // Get answer length from various possible fields
          let answerLength = 0;
          const answer = item.answer || item.expected || item.correct || item.key || '';
          if (Array.isArray(item.answers) && item.answers.length > 0) {
            // Use longest answer from array
            answerLength = Math.max(...item.answers.map(a => String(a || '').trim().length));
          } else if (answer) {
            answerLength = String(answer).trim().length;
          }
          base = shrinkFIBBlanks(base, answerLength);
        }
        // Expand blank for word problems (math) in worksheet (do not affect FIB)
        if (label === 'worksheet' && !isFIB && isLikelyWordProblem(item)) {
          base = expandBlank(base, 4);
        }
        // Prefix True/False label if needed
        const trimmed = base.trimStart();
        if (isTF && !/^true\s*\/\s*false\s*:/i.test(trimmed) && !/^true\s*false\s*:/i.test(trimmed)) {
          base = `True/False: ${base}`;
        }
        // Normalize and label multiple-choice options consistently (A., B., C., ...)
        let choicesLine = null;
        const opts = Array.isArray(item?.options)
          ? item.options.filter(Boolean)
          : (Array.isArray(item?.choices) ? item.choices.filter(Boolean) : []);
        if (opts.length) {
          const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
          const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.:\)\-]\s*/i;
          const parts = opts.map((o, i) => {
            const raw = String(o ?? '').trim();
            const cleaned = raw.replace(anyLabel, '').trim();
            const lbl = labels[i] || '';
            // NBSP between label and text prevents line breaks between them in PDF split
            return `${lbl}.\u00A0${cleaned}`;
          });
          choicesLine = parts.join('   ');
        }
        return { prompt: base, choicesLine };
      };
      if (label === 'worksheet') {
        // Ink-friendly header (no filled rectangle)
        doc.setTextColor(0,0,0);
        doc.setFontSize(14);
        const headerText = `${lessonTitle} Worksheet`;
        doc.text(headerText, 12, 14);
        // Name line: 20 underscores for handwritten name
  // Removed name line per updated requirements (ink-friendly & uncluttered)
        // Light separator line
        doc.setDrawColor(180,180,180);
        doc.line(12, 18, 198, 18);
        // Prepare to fit all questions on one page below header
        const topMargin = 28; // leave gap after header
        const left = 14;
        const maxWidth = 182; // 210 - 14*2 approx
        const pageHeight = 297; // A4 height mm
        const bottomMargin = 16;
        // Candidate font sizes (start large). We'll always compress to one page.
        const candidates = [18,16,15,14,13,12,11,10];
        let chosen = 10;
        let layout = null;
        for (const size of candidates) {
          let y = topMargin; let fits = true; const lines = [];
          for (let idx=0; idx < items.length; idx++) {
            const item = items[idx];
            const num = item.number || idx + 1;
            const { prompt, choicesLine } = renderLineText(item);
            doc.setFontSize(size);
            const wrappedPrompt = doc.splitTextToSize(`${num}. ${prompt}`, maxWidth);
            let wrappedChoices = [];
            let indentWidth = 0;
            if (choicesLine) {
              indentWidth = doc.getTextWidth('    ');
              wrappedChoices = doc.splitTextToSize(choicesLine, Math.max(10, maxWidth - indentWidth));
            }
            const baseLineH = size * 0.55 + 1.6; // slightly taller for large fonts
            const textHeight = (wrappedPrompt.length + wrappedChoices.length) * baseLineH;
            const isShort = item.sourceType === 'short' || /\b(short\s*answer)\b/i.test(item.type || '');
            // Base spacing for non-short items
            let blockHeight = isShort
              ? (textHeight + SHORT_PAD_ABOVE + SHORT_PAD_BELOW)
              : (textHeight + 4);
            if (y + blockHeight > pageHeight - bottomMargin) { fits = false; break; }
            lines.push({ startY: y, size, wrappedPrompt, wrappedChoices, indentWidth, blockHeight, baseLineH, isShort, textHeight });
            y += blockHeight;
          }
          if (fits) { chosen = size; layout = lines; break; }
        }
        if (!layout) {
          // Even smallest candidate overflowed. Perform proportional vertical scaling to squeeze onto one page.
          const size = candidates[candidates.length -1];
          const lines = []; let y = topMargin; let totalHeight = 0;
          for (let idx=0; idx < items.length; idx++) {
            const item = items[idx];
            const num = item.number || idx + 1;
            const { prompt, choicesLine } = renderLineText(item);
            doc.setFontSize(size);
            const wrappedPrompt = doc.splitTextToSize(`${num}. ${prompt}`, maxWidth);
            let wrappedChoices = [];
            let indentWidth = 0;
            if (choicesLine) {
              indentWidth = doc.getTextWidth('    ');
              wrappedChoices = doc.splitTextToSize(choicesLine, Math.max(10, maxWidth - indentWidth));
            }
            const baseLineH = size * 0.55 + 1.4;
            const textHeight = (wrappedPrompt.length + wrappedChoices.length) * baseLineH;
            const isShort = item.sourceType === 'short' || /\b(short\s*answer)\b/i.test(item.type || '');
            let blockHeight = isShort
              ? (textHeight + SHORT_PAD_ABOVE + SHORT_PAD_BELOW)
              : (textHeight + 3);
            lines.push({ wrappedPrompt, wrappedChoices, indentWidth, blockHeight, baseLineH, isShort, textHeight });
            totalHeight += blockHeight;
          }
          const available = (pageHeight - bottomMargin) - topMargin;
          const scale = available / totalHeight; // < 1 compresses
          let cursor = topMargin;
          lines.forEach(l => {
            const scaledLineH = l.baseLineH * scale;
            const scaledTextHeight = l.textHeight * scale;
            l.wrapped.forEach((ln,i) => {
              doc.text(ln, left, cursor + i * scaledLineH + chosen * 0.42);
            });
            if (l.isShort) {
              const lineY = cursor + scaledTextHeight + (SHORT_PAD_ABOVE * scale);
              doc.setDrawColor(100,100,100);
              doc.line(left, lineY, left + maxWidth * 0.95, lineY);
            }
            cursor += (l.blockHeight * scale);
          });
        } else {
          // Render chosen layout as-is (single page)
            layout.forEach((block, index) => {
              doc.setFontSize(block.size);
              // Render prompt lines
              block.wrappedPrompt.forEach((ln,i) => {
                doc.text(ln, left, block.startY + i * block.baseLineH + block.size * 0.42);
              });
              // Render choices with hanging indent
              if (block.wrappedChoices && block.wrappedChoices.length) {
                const startY = block.startY + block.wrappedPrompt.length * block.baseLineH;
                block.wrappedChoices.forEach((ln,i) => {
                  doc.text(ln, left + block.indentWidth, startY + i * block.baseLineH + block.size * 0.42);
                });
              }
              if (block.isShort) {
                // Draw a horizontal answer line with tuned spacing
                const lineY = block.startY + block.textHeight + SHORT_PAD_ABOVE;
                doc.setDrawColor(100,100,100);
                doc.line(left, lineY, left + maxWidth * 0.95, lineY);
              }
            });
        }
      } else {
        // Test: now enforce single-page adaptive sizing similar to worksheet.
        // Header
        doc.setTextColor(0,0,0);
        doc.setFontSize(14);
        doc.text(`${lessonTitle} Test`, 12, 14);
        doc.setDrawColor(180,180,180);
        doc.line(12, 18, 198, 18);
        // Layout constants
        const topMargin = 26; // a little tighter than worksheet
        const left = 14;
        const maxWidth = 182;
        const pageHeight = 297;
        const bottomMargin = 16;
        const candidates = [18,16,15,14,13,12,11,10];
        let chosen = 10;
        let layout = null;
        for (const size of candidates) {
          let y = topMargin; let fits = true; const lines = [];
          for (let idx=0; idx < items.length; idx++) {
            const item = items[idx];
            const num = item.number || idx + 1;
            const { prompt, choicesLine } = renderLineText(item);
            doc.setFontSize(size);
            const wrappedPrompt = doc.splitTextToSize(`${num}. ${prompt}`, maxWidth);
            let wrappedChoices = [];
            let indentWidth = 0;
            if (choicesLine) {
              indentWidth = doc.getTextWidth('    ');
              wrappedChoices = doc.splitTextToSize(choicesLine, Math.max(10, maxWidth - indentWidth));
            }
            const baseLineH = size * 0.55 + 1.6;
            const textHeight = (wrappedPrompt.length + wrappedChoices.length) * baseLineH;
            const isShort = item.sourceType === 'short' || /\b(short\s*answer)\b/i.test(item.type || '');
            const blockHeight = isShort
              ? (textHeight + SHORT_PAD_ABOVE + SHORT_PAD_BELOW)
              : (textHeight + 4);
            if (y + blockHeight > pageHeight - bottomMargin) { fits = false; break; }
            lines.push({ startY: y, size, wrappedPrompt, wrappedChoices, indentWidth, blockHeight, baseLineH, isShort, textHeight });
            y += blockHeight;
          }
          if (fits) { chosen = size; layout = lines; break; }
        }
        if (!layout) {
          // Compress vertically with smallest font size
          const size = candidates[candidates.length -1];
          const lines = []; let totalHeight = 0;
          for (let idx=0; idx < items.length; idx++) {
            const item = items[idx];
            const num = item.number || idx + 1;
            // Use renderLineText to preserve FIB/TF/MC formatting and blank sizing
            const { prompt, choicesLine } = renderLineText(item);
            doc.setFontSize(size);
            const wrappedPrompt = doc.splitTextToSize(`${num}. ${prompt}`, maxWidth);
            let wrappedChoices = [];
            let indentWidth = 0;
            if (choicesLine) {
              indentWidth = doc.getTextWidth('    ');
              wrappedChoices = doc.splitTextToSize(choicesLine, Math.max(10, maxWidth - indentWidth));
            }
            const baseLineH = size * 0.55 + 1.4;
            const textHeight = (wrappedPrompt.length + wrappedChoices.length) * baseLineH;
            const isShort = item.sourceType === 'short' || /\b(short\s*answer)\b/i.test(item.type || '');
            const blockHeight = isShort
              ? (textHeight + SHORT_PAD_ABOVE + SHORT_PAD_BELOW)
              : (textHeight + 3);
            lines.push({ wrappedPrompt, wrappedChoices, indentWidth, blockHeight, baseLineH, isShort, textHeight });
            totalHeight += blockHeight;
          }
          const available = (pageHeight - bottomMargin) - topMargin;
          const scale = available / totalHeight;
          let cursor = topMargin;
          lines.forEach(l => {
            const scaledLineH = l.baseLineH * scale;
            const scaledTextHeight = l.textHeight * scale;
            // Prompt
            l.wrappedPrompt.forEach((ln,i) => {
              doc.text(ln, left, cursor + i * scaledLineH + chosen * 0.42);
            });
            // Choices (hanging indent)
            if (l.wrappedChoices && l.wrappedChoices.length) {
              const startY = cursor + l.wrappedPrompt.length * scaledLineH;
              l.wrappedChoices.forEach((ln,i) => {
                doc.text(ln, left + l.indentWidth, startY + i * scaledLineH + chosen * 0.42);
              });
            }
            if (l.isShort) {
              const lineY = cursor + scaledTextHeight + (SHORT_PAD_ABOVE * scale);
              doc.setDrawColor(100,100,100);
              doc.line(left, lineY, left + maxWidth * 0.95, lineY);
            }
            cursor += (l.blockHeight * scale);
          });
        } else {
          layout.forEach(block => {
            doc.setFontSize(block.size);
            // Prompt
            block.wrappedPrompt.forEach((ln,i) => {
              doc.text(ln, left, block.startY + i * block.baseLineH + block.size * 0.42);
            });
            // Choices
            if (block.wrappedChoices && block.wrappedChoices.length) {
              const startY = block.startY + block.wrappedPrompt.length * block.baseLineH;
              block.wrappedChoices.forEach((ln,i) => {
                doc.text(ln, left + block.indentWidth, startY + i * block.baseLineH + block.size * 0.42);
              });
            }
            if (block.isShort) {
              const lineY = block.startY + block.textHeight + SHORT_PAD_ABOVE;
              doc.setDrawColor(100,100,100);
              doc.line(left, lineY, left + maxWidth * 0.95, lineY);
            }
          });
        }
      }
  // Preview-first: open directly in the browser's native PDF viewer (no custom toolbar/header)
  const base = (lessonData?.title || manifestInfo.title || manifestInfo.file || 'lesson');
  const safe = String(base).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0,60) || 'lesson';
  const fileName = `${safe}-${label}.pdf`;
      try {
        const blob = doc.output('blob');
        await shareOrPreviewPdf(blob, fileName, previewWin);
      } catch (e) {
        setDownloadError('Failed to generate or preview the PDF.');
      }
    } catch (e) {
      console.error('[PDF] Failed to generate PDF', e);
      setDownloadError('Failed to generate PDF.');
    }
  }

  // Disable sending when the UI is not ready or while Ms. Sonoma is speaking
  const comprehensionAwaitingBegin = (phase === 'comprehension' && subPhase === 'comprehension-start');
  const speakingLock = !!isSpeaking; // lock input anytime she is speaking
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
    (phase === 'exercise' && subPhase === 'exercise-start') ||
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
  const sendDisabled = (storyInputActive || fillInFunInputActive) ? (!canSend || loading || speakingLock) : (!canSend || loading || comprehensionAwaitingBegin || speakingLock || buttonsGating);

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

  const timelineHighlight = useMemo(() => {
    // Group teaching with discussion; comprehension is its own segment on the timeline
    if (["discussion", "teaching", "awaiting-learner"].includes(phase)) {
      return "discussion";
    }
    if (phase === "comprehension") {
      return "comprehension";
    }
    if (phase === "exercise") {
      return "exercise";
    }
    if (phase === "worksheet") {
      return "worksheet";
    }
    if (["test", "grading", "congrats"].includes(phase)) {
      return "test";
    }
    return phase;
  }, [phase]);

  // Ensure Begin buttons appear immediately in any awaiting-begin state
  useEffect(() => {
    const awaiting = (
      (phase === 'exercise' && subPhase === 'exercise-awaiting-begin') ||
      (phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin') ||
      (phase === 'test' && subPhase === 'test-awaiting-begin')
    );
    if (awaiting) {
      if (loading) setLoading(false);
      if (isSpeaking) setIsSpeaking(false);
    }
  }, [phase, subPhase, loading, isSpeaking]);

  // Stabilize exercise-awaiting-begin after skip: guard against same-tick state churn
  const awaitingGuardRef = useRef(null);
  // After a skip forward/backward into exercise awaiting-begin, hold a short lock window
  // that prevents any stray effects from advancing out of awaiting-begin until things settle.
  // The lock is cleared either when Begin is clicked or after a short timeout.
  const exerciseAwaitingLockRef = useRef(false);
  useEffect(() => {
    if (phase === 'exercise' && subPhase === 'exercise-awaiting-begin') {
      try { if (awaitingGuardRef.current) clearTimeout(awaitingGuardRef.current); } catch {}
      awaitingGuardRef.current = setTimeout(() => {
        // If we somehow left awaiting-begin without starting, and no audio is playing, restore it
        if (phase === 'exercise' && subPhase !== 'exercise-start' && !isSpeaking) {
          setSubPhase('exercise-awaiting-begin');
        }
      }, 0);
    }
    return () => { try { if (awaitingGuardRef.current) clearTimeout(awaitingGuardRef.current); } catch {} };
  }, [phase, subPhase, isSpeaking]);

  // While the lock is active, aggressively pin subPhase to 'exercise-awaiting-begin'
  // unless the user has actually started the exercise.
  useEffect(() => {
    try {
      if (exerciseAwaitingLockRef.current && phase === 'exercise' && subPhase !== 'exercise-start' && subPhase !== 'exercise-awaiting-begin') {
        setSubPhase('exercise-awaiting-begin');
      }
    } catch {}
  }, [phase, subPhase]);

  const ensureBaseSessionSetup = useCallback(async () => {
    if (!lessonData) return;
    // Always ensure QA pools at least once (idempotent refill if empty)
    if (!compPool.length) {
      const pool = buildQAPool();
      if (pool.length) {
        setCompPool(pool);
        setExercisePool(pool);
      }
    }
  // If assessments already generated, nothing further to do
    if (generatedWorksheet && generatedTest) return;
  // Try stored assessments first when id is available
  const storedKey = getAssessmentStorageKey();
  const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
  const stored = storedKey ? await getStoredAssessments(storedKey, { learnerId: lid }) : null;
    const shuffle = (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
  if (stored) {
      const wOk = Array.isArray(stored.worksheet) && stored.worksheet.length === WORKSHEET_TARGET;
      const tOk = Array.isArray(stored.test) && stored.test.length === TEST_TARGET;
      if (wOk && !generatedWorksheet) {
        setGeneratedWorksheet(stored.worksheet);
        setWorksheetSourceFull(stored.worksheet);
  setCurrentWorksheetIndex(0);
  worksheetIndexRef.current = 0;
      }
      if (tOk && !generatedTest) {
        setGeneratedTest(stored.test);
        setTestSourceFull(stored.test);
      }
      // If either array has wrong count, ignore it and regenerate without clearing persisted sets
    }
    // Generate missing assessments individually (do not require both to be absent)
    let gW = generatedWorksheet;
    let gT = generatedTest;
    const shuffle2 = (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    const buildMathSet = (target = 0, isTest = false) => {
      // REMOVED: samples array - deprecated
      const words = Array.isArray(lessonData.wordProblems) ? lessonData.wordProblems.map(q => ({ ...q, sourceType: 'word' })) : [];
      const tf = Array.isArray(lessonData.truefalse) ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
      const mc = Array.isArray(lessonData.multiplechoice) ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
      const fib = Array.isArray(lessonData.fillintheblank) ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
      const sa = Array.isArray(lessonData.shortanswer) ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
      const cats = [...tf, ...mc, ...fib, ...sa];
      const desiredWp = Math.round(target * 0.3);
      const wpSel = shuffle2(words).slice(0, Math.min(desiredWp, words.length)).map(q => ({ ...(isTest ? ({ ...q, expected: q.expected ?? q.answer }) : q) }));
      const remainder = Math.max(0, target - wpSel.length);
      const cap = Math.max(0, Math.floor(target * 0.10));
      const fromBase = shuffle2(cats);
      const saArr = fromBase.filter(q => /short\s*answer|shortanswer/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'short');
      const fibArr = fromBase.filter(q => /fill\s*in\s*the\s*blank|fillintheblank/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'fib');
      const others = fromBase.filter(q => !saArr.includes(q) && !fibArr.includes(q));
      const saPick = saArr.slice(0, Math.min(cap, saArr.length));
      const fibPick = fibArr.slice(0, Math.min(cap, fibArr.length));
      const remaining = Math.max(0, remainder - saPick.length - fibPick.length);
      const otherPick = others.slice(0, remaining);
      const base = shuffle2([...wpSel, ...saPick, ...fibPick, ...otherPick]);
      const used = new Set(base.map(promptKey));
      const remBase = shuffle2(cats).filter(q => !used.has(promptKey(q)));
      const remWords = shuffle2(words).filter(q => !used.has(promptKey(q)));
      return ensureExactCount(base, target, [remBase, remWords]);
    };
    if (subjectParam === 'math') {
      if (!gW) {
        gW = buildMathSet(WORKSHEET_TARGET, false);
        if (gW && gW.length) {
          setGeneratedWorksheet(gW);
          setWorksheetSourceFull(gW);
          setCurrentWorksheetIndex(0);
          worksheetIndexRef.current = 0;
        }
      }
      if (!gT) {
        gT = buildMathSet(TEST_TARGET, true);
        if (gT && gT.length) { setGeneratedTest(gT); setTestSourceFull(gT); }
      }
    } else {
      // Build from category arrays if present; cap short answers to 30%
      const buildFromCategories = (target = 0) => {
        const tf = Array.isArray(lessonData.truefalse) ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
        const mc = Array.isArray(lessonData.multiplechoice) ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
        const fib = Array.isArray(lessonData.fillintheblank) ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
        const sa = Array.isArray(lessonData.shortanswer) ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
        const anyCats = tf.length || mc.length || fib.length || sa.length;
        if (!anyCats) return null;
        const maxShort = Math.floor(target * 0.3);
        const saPick = shuffle2(sa).slice(0, Math.min(maxShort, sa.length));
        const others = shuffle2([...tf, ...mc, ...fib]);
        const remaining = Math.max(0, target - saPick.length);
        const otherPick = others.slice(0, remaining);
        return shuffle2([...saPick, ...otherPick]);
      };
      const fromCatsW = buildFromCategories(WORKSHEET_TARGET);
      const fromCatsT = buildFromCategories(TEST_TARGET);
      if (!gW) {
        if (fromCatsW) {
          gW = fromCatsW;
          setGeneratedWorksheet(gW);
          setWorksheetSourceFull(gW);
          setCurrentWorksheetIndex(0);
          worksheetIndexRef.current = 0;
        } else if (Array.isArray(lessonData.worksheet) && lessonData.worksheet.length) {
          gW = shuffle2(lessonData.worksheet).slice(0, WORKSHEET_TARGET);
          setGeneratedWorksheet(gW);
          setWorksheetSourceFull(gW);
          setCurrentWorksheetIndex(0);
          worksheetIndexRef.current = 0;
        }
      }
      if (!gT) {
        if (fromCatsT) {
          gT = fromCatsT;
          setGeneratedTest(gT);
          setTestSourceFull(gT);
        } else if (Array.isArray(lessonData.test) && lessonData.test.length) {
          gT = shuffle2(lessonData.test).slice(0, TEST_TARGET);
          setGeneratedTest(gT);
          setTestSourceFull(gT);
        }
      }
    }
    if (gW || gT) {
      if (lessonData.id) {
  const key = getAssessmentStorageKey();
  if (key) { try { const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none'; saveAssessments(key, { worksheet: gW || [], test: gT || [], comprehension: compPool || [], exercise: exercisePool || [] }, { learnerId: lid }); } catch {} }
      }
    }
  }, [lessonData, generatedWorksheet, generatedTest, compPool.length]);

  const beginSession = async () => {
    try { console.info('[Begin] Clicked: starting session'); } catch {}
    
    // Skip quota checks for demo lessons - they're unlimited
    const isDemoLesson = subjectParam === 'demo';
    console.info('[Begin] Subject param:', subjectParam, 'isDemoLesson:', isDemoLesson);
    
    // Check lesson quota before allowing session to start
    if (!isDemoLesson) {
      try {
        const supabase = getSupabaseClient();
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          const response = await fetch('/api/usage/check-lesson-quota', {
            headers: {
              'authorization': `Bearer ${session.access_token}`
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            if (!data.allowed) {
              // Show gate overlay
              setQuotaGateInfo({
                remaining: data.remaining || 0,
                limit: data.limit || 0,
                tier: data.tier || 'free',
                reason: data.reason
              });
              setShowQuotaGate(true);
              return; // Stop session start
            }
            console.info('[Begin] Lesson quota check passed:', data);
            
            // Increment lesson counter
            await fetch('/api/usage/increment-lesson', {
              method: 'POST',
              headers: {
                'authorization': `Bearer ${session.access_token}`
              }
            });
          } else {
            console.warn('[Begin] Quota check failed, allowing session anyway');
          }
        }
      } catch (e) {
        console.warn('[Begin] Failed to check lesson quota:', e);
        // Allow session to continue on error to avoid blocking learners
      }
    }
    
    // Reload timer setting from current learner to get latest value
    try {
      const learnerId = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
      if (learnerId && learnerId !== 'demo') {
        const learner = await getLearner(learnerId);
        if (learner?.session_timer_minutes) {
          setSessionTimerMinutes(Number(learner.session_timer_minutes));
          console.info('[Begin] Timer duration loaded:', learner.session_timer_minutes, 'minutes');
        }
      }
    } catch (e) {
      console.warn('[Begin] Failed to reload timer setting:', e);
    }
    
    // Reset timer state for new session
    try {
      sessionStorage.removeItem('session_timer_state');
      setTimerPaused(false);
      console.info('[Begin] Timer reset for new session');
    } catch (e) {
      console.warn('[Begin] Failed to reset timer:', e);
    }
    
    // End any prior API/audio/mic activity before starting fresh; keep captions continuity at Discussion opening
    try { abortAllActivity(true); } catch {}
    // Ensure audio and mic permissions are handled as part of Begin (in-gesture)
  // mic permission will be requested only when user starts recording

    // Kick off Supabase session tracking once the learner actually begins this lesson
    if (trackingLearnerId && lessonSessionKey && typeof startTrackedSession === 'function') {
      try {
        const supabaseSessionId = await startTrackedSession();
        if (supabaseSessionId) {
          try { console.info('[Begin] Supabase lesson session started:', supabaseSessionId); } catch {}
        } else {
          console.warn('[Begin] Supabase session start returned null');
        }
      } catch (sessionErr) {
        console.warn('[Begin] Supabase session start failed:', sessionErr);
      }
    }

    // Immediately update UI so it feels responsive
    setShowBegin(false);
    setPhase("discussion");
    setPhaseGuardSent({});
    setSubPhase("unified-discussion");
    setCanSend(false);
  try { scheduleSaveSnapshot('begin-discussion'); } catch {}
    try { console.info('[Begin] UI updated ? discussion/unified-discussion'); } catch {}

    // Non-blocking: load targets and generate pools in the background
    // so Opening can start speaking right away.
    (async () => {
      try {
        await ensureRuntimeTargets(true); // Force fresh reload of targets
        ensureBaseSessionSetup();
        // Build ephemeral provided question sets for comprehension and exercise
        try {
          const pool = buildQAPool();
          const shuffled = Array.isArray(pool) ? (Array.from(pool)) : [];
          for (let i = shuffled.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          const totalNeeded = Math.max(0, (COMPREHENSION_TARGET || 0)) + Math.max(0, (EXERCISE_TARGET || 0));
          // Don't duplicate questions - use only what's available
          let take = shuffled.slice(0, Math.min(totalNeeded, shuffled.length));
          const compArr = take.slice(0, Math.min(COMPREHENSION_TARGET, take.length));
          const exArr = take.slice(compArr.length, Math.min(compArr.length + EXERCISE_TARGET, take.length));
          setGeneratedComprehension(compArr);
          setGeneratedExercise(exArr);
          setCurrentCompIndex(0);
          setCurrentExIndex(0);
          setCurrentCompProblem(null);
          setCurrentExerciseProblem(null);
          try { console.info('[Begin] Targets/pools ready'); } catch {}
        } catch (e) {
          // Defer to on-the-fly selection if needed
          setGeneratedComprehension(null);
          setGeneratedExercise(null);
          setCurrentCompIndex(0);
          setCurrentExIndex(0);
          setCurrentCompProblem(null);
          setCurrentExerciseProblem(null);
          try { console.warn('[Begin] Pool generation failed; will select on the fly', e?.name || e); } catch {}
        }
      } catch (e) {
        try { console.warn('[Begin] ensureRuntimeTargets failed', e?.name || e); } catch {}
      }
    })();

    // Kick off the Opening immediately (does its own loading state for TTS)
    try { console.info('[Begin] Starting Opening step�'); } catch {}
    await startDiscussionStep();
  };

  // Helper: get teaching notes from the loaded lesson (if present)
  const getTeachingNotes = useCallback(() => {
    try {
      const tn = lessonData?.teachingNotes || lessonData?.teacherNotes || lessonData?.notes;
      const s = typeof tn === 'string' ? tn.trim() : '';
      return s || '';
    } catch {
      return '';
    }
  }, [lessonData]);

  // Helper: inject teaching notes into the front of an instruction for the model to base the lesson on
  const withTeachingNotes = useCallback((baseInstruction) => {
    const tn = getTeachingNotes();
    if (!tn) return baseInstruction;
    const preface = 'Teaching notes (for your internal guidance; integrate naturally�do not read verbatim): ' + tn;
    return `${preface}\n${baseInstruction}`;
  }, [getTeachingNotes]);

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
  } = useTeachingFlow({
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
    // Lesson context
    subjectParam,
    difficultyParam,
    lessonParam,
    effectiveLessonTitle,
    // Constants
    COMPREHENSION_CUE_PHRASE,
  });

  // Use hook-provided teaching flow functions
  const promptGateRepeat = promptGateRepeatHook;
  const teachDefinitions = teachDefinitionsHook;
  const teachExamples = teachExamplesHook;
  const startThreeStageTeaching = startTwoStageTeachingHook;
  const handleGateYes = handleGateYesHook;
  const handleGateNo = handleGateNoHook;
  const moveToComprehensionWithCue = moveToComprehensionWithCueHook;

  // Update ref so phase handlers hook can use it
  useEffect(() => {
    startThreeStageTeachingRef.current = startThreeStageTeaching;
  }, [startThreeStageTeaching]);

  // Assessment downloads hook
  const {
    handleDownloadWorksheet: handleDownloadWorksheetHook,
    handleDownloadTest: handleDownloadTestHook,
    handleDownloadAnswers: handleDownloadAnswersHook,
    handleDownloadWorksheetTestCombined: handleDownloadWorksheetTestCombinedHook,
    handleRefreshWorksheetAndTest: handleRefreshWorksheetAndTestHook
  } = useAssessmentDownloads({
    lessonData,
    manifestInfo,
    lessonParam,
    subjectParam,
    generatedWorksheet,
    generatedTest,
    compPool,
    exercisePool,
    worksheetSourceFull,
    testSourceFull,
    setDownloadError,
    setGeneratedWorksheet,
    setGeneratedTest,
    setCurrentWorksheetIndex,
    setTestActiveIndex,
    setTestUserAnswers,
    worksheetIndexRef,
    ensurePinAllowed,
    showTipOverride,
    getAssessmentStorageKey,
    getSnapshotStorageKey,
    saveAssessments,
    clearAssessments,
    ensureExactCount,
    promptKey,
    createPdfForItems,
    shareOrPreviewPdf,
    ensureRuntimeTargets,
    // REMOVED: reserveSamples - deprecated zombie code
    reserveWords,
    jsPDF,
    WORKSHEET_TARGET,
    TEST_TARGET
  });

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

    setTestActiveIndex(0);
    setTestUserAnswers(() => (limit > 0 ? Array.from({ length: limit }, () => '') : []));
    setTestCorrectByIndex(() => (limit > 0 ? Array.from({ length: limit }) : []));
    setTestCorrectCount(0);
    setTestFinalPercent(null);
    setUsedTestCuePhrases([]);
  };

  const beginWorksheetPhase = async () => {
    // End any prior API/audio/mic activity before starting fresh
    try { abortAllActivity(true); } catch {}
    // Ensure audio/mic unlocked via Begin
  // mic permission will be requested only when user starts recording
    // Ensure assessments exist if user arrived here via skip before they were generated
    if (!generatedWorksheet) {
      ensureBaseSessionSetup();
    }
    // No standalone unlock prompt: Begin handles permissions
    if (!generatedWorksheet || !generatedWorksheet.length) {
      // Nothing to run
      setSubPhase('worksheet-empty');
      setCanSend(false);
      return;
    }
  // Ensure the initial Begin button is never shown once worksheet starts
    setShowBegin(false);
    // Gate quick-answer buttons until the learner presses Go button
    setQaAnswersUnlocked(false);
    setJokeUsedThisGate(false);
    setRiddleUsedThisGate(false);
    setPoemUsedThisGate(false);
    setStoryUsedThisGate(false);
    setFillInFunUsedThisGate(false);
    // Immediately advance subPhase so the "Begin Worksheet" button disappears
    setSubPhase('worksheet-active');
    worksheetIndexRef.current = 0;
    setCurrentWorksheetIndex(0);
    setTicker(0);
    setCanSend(false);
    // Do NOT speak the first question here - it will be spoken when Go is pressed
    // This prevents the question buttons from interfering with Ask/Joke/Riddle/Poem/Story/Fill-in-fun
    const opener = WORKSHEET_INTROS[Math.floor(Math.random() * WORKSHEET_INTROS.length)];
    try {
      await speakFrontend(opener);
    } catch {}
    // After intro, reveal Opening actions row
    try { setShowOpeningActions(true); } catch {}
    // Keep input disabled until Go is pressed
    setCanSend(false);
    if (worksheetSkippedAwaitBegin) setWorksheetSkippedAwaitBegin(false);
  };

  const beginTestPhase = async () => {
    let testListForReset = Array.isArray(generatedTest) ? generatedTest : null;
    // End any prior API/audio/mic activity before starting fresh
    try { abortAllActivity(true); } catch {}
    // Ensure audio/mic unlocked via Begin
  // mic permission will be requested only when user starts recording
    if (!generatedTest || !generatedTest.length) {
      // Ensure assessments exist if user arrived here via skip or regeneration lag
      ensureBaseSessionSetup();
      // As a fallback, build a test set synchronously from lessonData if available
      if (lessonData) {
        const shuffle = (arr) => {
          const copy = [...arr];
          for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
          }
          return copy;
        };
        let built = null;
        if (subjectParam === 'math') {
          // REMOVED: samples array - deprecated
          const words = Array.isArray(lessonData.wordProblems) ? lessonData.wordProblems : [];
          const tf = Array.isArray(lessonData.truefalse) ? lessonData.truefalse : [];
          const mc = Array.isArray(lessonData.multiplechoice) ? lessonData.multiplechoice : [];
          const fib = Array.isArray(lessonData.fillintheblank) ? lessonData.fillintheblank : [];
          const sa = Array.isArray(lessonData.shortanswer) ? lessonData.shortanswer : [];
          const cats = [...tf, ...mc, ...fib, ...sa];
          if (words.length || cats.length) {
            const desiredWp = Math.round(TEST_TARGET * 0.3);
            const wpSel = shuffle(words).slice(0, Math.min(desiredWp, words.length)).map(q => ({ ...q, expected: q.expected ?? q.answer, sourceType: 'word' }));
            const baseSel = shuffle(cats).slice(0, Math.max(0, TEST_TARGET - wpSel.length));
            built = shuffle([...wpSel, ...baseSel]);
          }
        } else {
          const tf = Array.isArray(lessonData.truefalse) ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
          const mc = Array.isArray(lessonData.multiplechoice) ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
          const fib = Array.isArray(lessonData.fillintheblank) ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
          const sa = Array.isArray(lessonData.shortanswer) ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
          const maxShort = Math.floor(TEST_TARGET * 0.3);
          const saPick = shuffle(sa).slice(0, Math.min(maxShort, sa.length));
          const others = shuffle([...tf, ...mc, ...fib]);
          const remaining = Math.max(0, TEST_TARGET - saPick.length);
          const otherPick = others.slice(0, remaining);
          if (saPick.length || otherPick.length) {
            built = shuffle([...saPick, ...otherPick]);
          } else if (Array.isArray(lessonData.test) && lessonData.test.length) {
            built = shuffle(lessonData.test).slice(0, TEST_TARGET);
          }
        }
        if (built && built.length) {
          setGeneratedTest(built);
          testListForReset = built;
          try {
            const key = getAssessmentStorageKey();
            if (key) { const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none'; saveAssessments(key, { worksheet: generatedWorksheet || [], test: built, comprehension: compPool || [], exercise: exercisePool || [] }, { learnerId: lid }); }
          } catch {}
        } else {
          setSubPhase('test-empty');
          setCanSend(false);
          return;
        }
      } else {
        setSubPhase('test-empty');
        setCanSend(false);
        return;
      }
    }
  // Hide any residual Begin button if user jumped here directly
    setShowBegin(false);
  // Gate quick-answer buttons until Start the lesson
  setQaAnswersUnlocked(false);
  setJokeUsedThisGate(false);
  setRiddleUsedThisGate(false);
  setPoemUsedThisGate(false);
  setStoryUsedThisGate(false);
  setFillInFunUsedThisGate(false);
                // Fallback snapshot from selection page - now learner-specific
                const currentLearnerId = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
                if (currentLearnerId && currentLearnerId !== 'demo') {
                  // Use learner-specific target overrides
                  const lc = parseInt(localStorage.getItem(`target_comprehension_${currentLearnerId}`) || '');
                  const le = parseInt(localStorage.getItem(`target_exercise_${currentLearnerId}`) || '');
                  const lw = parseInt(localStorage.getItem(`target_worksheet_${currentLearnerId}`) || '');
                  const lt = parseInt(localStorage.getItem(`target_test_${currentLearnerId}`) || '');
                  if (!isNaN(lc)) COMPREHENSION_TARGET = lc;
                  if (!isNaN(le)) EXERCISE_TARGET = le;
                  if (!isNaN(lw)) WORKSHEET_TARGET = lw;
                  if (!isNaN(lt)) TEST_TARGET = lt;
                } else {
                  // Fallback to global overrides for demo/missing learner
                  const lc = parseInt(localStorage.getItem('target_comprehension') || '');
                  const le = parseInt(localStorage.getItem('target_exercise') || '');
                  const lw = parseInt(localStorage.getItem('target_worksheet') || '');
                  const lt = parseInt(localStorage.getItem('target_test') || '');
                  if (!isNaN(lc)) COMPREHENSION_TARGET = lc;
                  if (!isNaN(le)) EXERCISE_TARGET = le;
                  if (!isNaN(lw)) WORKSHEET_TARGET = lw;
                  if (!isNaN(lt)) TEST_TARGET = lt;
                }
  // Reset all test progress so prior attempts do not auto-complete the phase
  resetTestProgress(testListForReset);
  // Do NOT speak the first question here - it will be spoken when Go is pressed
  // This prevents the question buttons from interfering with Ask/Joke/Riddle/Poem/Story/Fill-in-fun
  setSubPhase('test-active');
    setCanSend(false);
    try { showTipOverride('Starting test...', 3000); } catch {}

    // Speak a short test intro (random); first question is gated behind Go button
    try {
      const opener = TEST_INTROS[Math.floor(Math.random() * TEST_INTROS.length)];
      await speakFrontend(opener);
    } catch {}
    // After intro, reveal Opening actions row (for Q&A extras)
    try { setShowOpeningActions(true); } catch {}
    // Keep input disabled until Go is pressed
    setCanSend(false);
  };

  // During facilitator review (now a Test subphase): keep preview grade percent and count in sync with correctness array.
  useEffect(() => {
    const inTestReview = (phase === 'test' && typeof subPhase === 'string' && subPhase.startsWith('review'));
    if (!inTestReview) return; // only recompute while in the review subphase under Test
    try {
      const total = Array.isArray(generatedTest) ? generatedTest.length : 0;
      const correct = Array.isArray(testCorrectByIndex) ? testCorrectByIndex.filter(Boolean).length : 0;
      const percent = Math.round((correct / Math.max(1, total)) * 100);
      if (Number.isFinite(correct)) setTestCorrectCount(correct);
      // Defer committing the final percent until after facilitator accepts
    } catch {}
  }, [phase, subPhase, generatedTest, testCorrectByIndex]);

  // Persist medal when final percent changes in congrats (post-review)
  useEffect(() => {
    if (phase !== 'congrats') return;
    if (typeof testFinalPercent !== 'number') return;
    try {
      const learnerId = (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
      const subjectLower = (subjectParam || 'math').toLowerCase();
      const lessonKey = `${subjectLower}/${lessonParam}`;
      if (learnerId && lessonKey) upsertMedal(learnerId, lessonKey, testFinalPercent);
    } catch {}
  }, [phase, testFinalPercent, subjectParam, lessonParam]);

  // Begin Comprehension manually when arriving at comprehension-start (e.g., via skip)
  const beginComprehensionPhase = async () => {
    // End any prior API/audio/mic activity before starting fresh
    try { abortAllActivity(true); } catch {}
    // Ensure audio/mic unlocked via Begin
  // mic permission will be requested only when user starts recording
    // Ensure session scaffolding exists
    ensureBaseSessionSetup();
    // No standalone unlock prompt
    // Only act in comprehension phase
    if (phase !== 'comprehension') return;
  if (subPhase !== 'comprehension-start' && subPhase !== 'comprehension-active') setSubPhase('comprehension-start');
  // Gate quick-answer buttons until Start the lesson
  setQaAnswersUnlocked(false);
  setJokeUsedThisGate(false);
  setRiddleUsedThisGate(false);
  setPoemUsedThisGate(false);
  setStoryUsedThisGate(false);
  setFillInFunUsedThisGate(false);
    // Persist the entrance to comprehension-start immediately
  // Persist the entrance to comprehension-start immediately (single-snapshot resume pointer)
  try { scheduleSaveSnapshot('begin-comprehension'); } catch {}
    try { console.log('[Session] Begin Comprehension clicked', { phase, subPhase, currentCompIndex, compPoolLen: Array.isArray(compPool) ? compPool.length : 0 }); } catch {}
  setCanSend(false);
    // Do NOT arm the first question here - it will be armed when Go is pressed
    // This prevents the question buttons from interfering with Ask/Joke/Riddle/Poem/Story/Fill-in-fun
    // Immediately enter active subPhase so the Begin button disappears right away
    setSubPhase('comprehension-active');
  // Persist the transition to comprehension-active so resume lands on the five-button view
  try { scheduleSaveSnapshot('comprehension-active'); } catch {}
    // New: Phase intro (random from pool); first question is gated behind Go button
    const intro = COMPREHENSION_INTROS[Math.floor(Math.random() * COMPREHENSION_INTROS.length)];
    try {
      await speakFrontend(intro);
    } catch {}
    // After intro, reveal Opening actions row
    try { setShowOpeningActions(true); } catch {}
    // Keep input disabled until Go is pressed
    setCanSend(false);
  };

  // Finalize facilitator review: lock score, then advance to congrats
  const finalizeReview = useCallback(async () => {
    try { abortAllActivity(); } catch {}
    const total = Array.isArray(generatedTest) ? generatedTest.length : 0;
    const correct = Array.isArray(testCorrectByIndex) ? testCorrectByIndex.filter(Boolean).length : 0;
    const safePercent = Math.round((correct / Math.max(1, Math.max(1, total))) * 100);
    try { setTestFinalPercent(safePercent); } catch {}
    setPhase('congrats');
    setSubPhase('congrats-done');
  setTicker(0);
    setCanSend(false);
  try { scheduleSaveSnapshot('begin-worksheet'); } catch {}
    // Auto-start congrats speech so captions immediately return to transcript
    try { setCongratsStarted(true); } catch {}
    // Persist medal on effect when congrats
  }, [generatedTest, testCorrectByIndex, speakFrontend]);

  // Speak congrats summary once upon entering congrats
  const congratsSpokenRef = useRef(false);
  // Defer auto-review transitions while final TTS feedback is playing
  const reviewDeferRef = useRef(false);
  const [congratsSpeaking, setCongratsSpeaking] = useState(false);
  useEffect(() => {
    if (phase === 'congrats' && typeof testFinalPercent === 'number' && congratsStarted && !congratsSpokenRef.current) {
      const learnerName = (typeof window !== 'undefined' ? (localStorage.getItem('learner_name') || '') : '').trim();
      const closing = generateClosing({
        conceptLearned: 'today\'s test',
        engagementLevel: 'focused',
        learnerName: learnerName || null
      });
      const lines = [
        `Your score is ${testFinalPercent}%.`,
        closing
      ].join(' ');
      (async () => {
        setCongratsSpeaking(true);
        setCongratsDone(false);
        try { await speakFrontend(lines); } catch {}
        setCongratsSpeaking(false);
        setCongratsDone(true);
      })();
      congratsSpokenRef.current = true;
    }
    if (phase !== 'congrats') {
      congratsSpokenRef.current = false;
      setCongratsStarted(false);
      setCongratsSpeaking(false);
      setCongratsDone(false);
    }
  }, [phase, testFinalPercent, congratsStarted]);

  

  // ------------------------------
  // Automatic Test Review Sequence
  // When the test target is reached and Ms. Sonoma has finished speaking, enter review.
  useEffect(() => {
    try {
      // Do not retrigger if we're already in test-review or in congrats
      if (phase === 'congrats') return;
      if (phase === 'test' && typeof subPhase === 'string' && subPhase.startsWith('review')) return;
      if (reviewDeferRef.current) return; // Hold while we intentionally speak final feedback
      if (isSpeaking) return; // Wait until TTS feedback is finished
      if (phase !== 'test') return; // Treat test as the authoritative phase
      const list = Array.isArray(generatedTest) ? generatedTest : [];
      const limit = Math.min((typeof TEST_TARGET === 'number' && TEST_TARGET > 0) ? TEST_TARGET : list.length, list.length);
      const answeredCount = Array.isArray(testUserAnswers) ? testUserAnswers.filter(v => typeof v === 'string' && v.length > 0).length : 0;
      const judgedCount = Array.isArray(testCorrectByIndex) ? testCorrectByIndex.filter(v => typeof v !== 'undefined').length : 0;
      const idxDone = (typeof testActiveIndex === 'number' ? testActiveIndex : 0) >= limit;
      const finished = limit > 0 && (answeredCount >= limit || judgedCount >= limit || idxDone);
      if (finished) {
        try { setCanSend(false); } catch {}
        try { setSubPhase('review-start'); } catch {}
      }
    } catch {}
  }, [phase, subPhase, generatedTest, testUserAnswers, testCorrectByIndex, testActiveIndex, isSpeaking]);

  // Direct trigger: when target is met during test (by answers or judged), enter Review after TTS completes
  useEffect(() => {
    try {
      if (phase !== 'test') return;
      if (reviewDeferRef.current) return; // Hold while final feedback is speaking
      if (isSpeaking) return; // Do not transition mid-speech
      if (typeof subPhase === 'string' && subPhase.startsWith('review')) return; // Already in review subphase
      const list = Array.isArray(generatedTest) ? generatedTest : [];
      const limit = Math.min((typeof TEST_TARGET === 'number' && TEST_TARGET > 0) ? TEST_TARGET : list.length, list.length);
      if (limit <= 0) return;
      const answeredCount = Array.isArray(testUserAnswers) ? testUserAnswers.filter(v => typeof v === 'string' && v.length > 0).length : 0;
      const judgedCount = Array.isArray(testCorrectByIndex) ? testCorrectByIndex.filter(v => typeof v !== 'undefined').length : 0;
      const idxDone = (typeof testActiveIndex === 'number' ? testActiveIndex : 0) >= limit;
      if (answeredCount >= limit || judgedCount >= limit || idxDone || (typeof ticker === 'number' && ticker >= limit)) {
        try { setCanSend(false); } catch {}
        try { setSubPhase('review-start'); } catch {}
      }
    } catch {}
  }, [phase, generatedTest, testUserAnswers, testCorrectByIndex, testActiveIndex, ticker, isSpeaking, subPhase]);
  const finalizeTestAndFarewell = async ({ correctCount, total, percent } = {}) => {
    if (!generatedTest || !generatedTest.length) return;
    const fallbackTotal = generatedTest.length;
    const safeTotal = total || fallbackTotal;
    const safeCorrect = (typeof correctCount === 'number') ? correctCount : testCorrectCount;
    const safePercent = (typeof percent === 'number') ? percent : Math.round((safeCorrect / Math.max(1, safeTotal)) * 100);
    const learnerName = (typeof window !== 'undefined' ? (localStorage.getItem('learner_name') || '') : '').trim();
    // Local TTS summary
    try {
      const lines = [
        `Your score is ${safePercent}%.`,
        'Nice work today. I am proud of you.',
        'Keep learning and having fun.',
        learnerName ? `Goodbye ${learnerName}.` : 'Goodbye.'
      ].join(' ');
      await speakFrontend(lines);
    } catch {}
  setPhase('congrats');
  setSubPhase('congrats-done');
  setCanSend(false);
  try { setTestFinalPercent(safePercent); } catch {}
    // Persist medal
    try {
      const learnerId = (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
      const subjectLower = (subjectParam || 'math').toLowerCase();
      const lessonKey = `${subjectLower}/${lessonParam}`;
      if (learnerId && lessonKey && typeof safePercent === 'number') {
        upsertMedal(learnerId, lessonKey, safePercent);
      }
    } catch {}
    setCanSend(true);
    // Persist phase entrance
    try { scheduleSaveSnapshot('begin-test'); } catch {}
  };


  // TEMP development helper: skip forward through major phases
  const skipForwardPhase = async () => {
    const ok = await ensurePinAllowed('skip');
    if (!ok) return;
    // Confirm out-of-order move: skipping alters the lesson timeline irreversibly
    try {
      const ans = typeof window !== 'undefined' ? window.prompt("This will alter the lesson in a way that can't be reversed. Type 'ok' to proceed.") : null;
      if (!ans || String(ans).trim().toLowerCase() !== 'ok') return;
    } catch {}
    // Centralized abort/cleanup
    abortAllActivity();
    // Ensure overlays tied to !loading can render immediately (Begin buttons)
    setLoading(false);
    // On any timeline skip, cut over transcript and clear prior resume snapshots
    try {
      const learnerId = (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
      const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || null;
      const lessonId = String(lessonParam || '').replace(/\.json$/i, '');
      // Append only the lines since the last segment start to avoid duplicating prior session text
      const startIdx = Math.max(0, Number(transcriptSegmentStartIndexRef.current) || 0);
      const all = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current : [];
      const slice = all.slice(startIdx).filter((ln) => ln && typeof ln.text === 'string' && ln.text.trim().length > 0).map((ln) => ({ role: ln.role || 'assistant', text: ln.text }));
      if (learnerId && learnerId !== 'demo' && slice.length > 0) {
        await appendTranscriptSegment({
          learnerId,
          learnerName,
          lessonId,
          lessonTitle: effectiveLessonTitle,
          segment: { startedAt: sessionStartRef.current || new Date().toISOString(), completedAt: new Date().toISOString(), lines: slice },
          sessionId: transcriptSessionId || undefined,
        });
      }
    } catch (e) { try { console.warn('[Skip] transcript append failed', e); } catch {} }
    // Clear snapshot so the new position becomes the fresh baseline immediately
    try {
      const key = getSnapshotStorageKey();
      if (key) {
        const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
        try { await clearSnapshot(key, { learnerId: lid }); } catch {}
      }
    } catch {}
    // Start a new transcript segment window and seed a fresh snapshot save shortly
    try {
      sessionStartRef.current = new Date().toISOString();
      transcriptSegmentStartIndexRef.current = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current.length : 0;
      // Allow the phase/subPhase setters below to run, then seed a save
      setTimeout(() => { try { scheduleSaveSnapshot('skip-forward'); } catch {} }, 50);
    } catch {}
    // New behavior: skip only between MAJOR phases (discussion -> comprehension -> exercise -> worksheet -> test)
    // Teaching is grouped with discussion on the timeline; comprehension is its own major phase.
    if (!lessonData || lessonDataLoading) {
      // Defer skip until lesson data arrives
      setSkipPendingLessonLoad(true);
      return;
    }
    if (showBegin) {
      // User has not begun; ensure base setup so later phases have pools/assessments
      ensureBaseSessionSetup();
      setShowBegin(false);
      // First skip from a fresh session should proceed to Comprehension start
      setPhase('comprehension');
  setSubPhase('comprehension-start');
  setTicker(0);
      // Engage awaiting lock to ignore late replies during transition
      try { comprehensionAwaitingLockRef.current = true; setTimeout(() => { comprehensionAwaitingLockRef.current = false; }, 800); } catch {}
      setCurrentCompProblem(null);
      setCanSend(false);
      return;
    }
    if (phase === 'discussion' || phase === 'teaching') {
      // Move to Comprehension start (teaching/discussion are a single segment on the timeline)
      ensureBaseSessionSetup();
      setShowBegin(false);
      setPhase('comprehension');
  setSubPhase('comprehension-start');
  setTicker(0);
  try { comprehensionAwaitingLockRef.current = true; setTimeout(() => { comprehensionAwaitingLockRef.current = false; }, 800); } catch {}
  setCurrentCompProblem(null);
  setCanSend(false);
      return;
    }
    if (phase === 'comprehension') {
      // Advance to Exercise begin
      setPhase('exercise');
      setSubPhase('exercise-awaiting-begin');
      try { exerciseAwaitingLockRef.current = true; setTimeout(() => { exerciseAwaitingLockRef.current = false; }, 800); } catch {}
      setExerciseSkippedAwaitBegin(true);
      setCurrentExerciseProblem(null);
      setTicker(0);
      setCanSend(false);
      return;
    }
    if (phase === 'exercise') {
      setPhase('worksheet');
      setSubPhase('worksheet-awaiting-begin');
      setWorksheetSkippedAwaitBegin(true);
      setTicker(0);
      setCanSend(false);
      try { scheduleSaveSnapshot('skip-forward'); } catch {}
      return;
    }
    if (phase === 'worksheet') {
      resetTestProgress();
      setPhase('test');
      setSubPhase('test-awaiting-begin');
      setTicker(0);
      setCanSend(false);
      try { scheduleSaveSnapshot('skip-forward'); } catch {}
      return;
    }
    if (phase === 'test') {
      // Do not allow skipping to the Congrats state
      return;
    }
  };

  // Skip backward between MAJOR phases only
  const skipBackwardPhase = async () => {
    const ok = await ensurePinAllowed('skip');
    if (!ok) return;
    try {
      const ans = typeof window !== 'undefined' ? window.prompt("This will alter the lesson in a way that can't be reversed. Type 'ok' to proceed.") : null;
      if (!ans || String(ans).trim().toLowerCase() !== 'ok') return;
    } catch {}
    abortAllActivity();
    // Ensure overlays tied to !loading can render immediately after back-skip
    setLoading(false);
    // On any timeline skip back, also cut over transcript and clear snapshots
    try {
      const learnerId = (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
      const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || null;
      const lessonId = String(lessonParam || '').replace(/\.json$/i, '');
      const startIdx = Math.max(0, Number(transcriptSegmentStartIndexRef.current) || 0);
      const all = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current : [];
      const slice = all.slice(startIdx).filter((ln) => ln && typeof ln.text === 'string' && ln.text.trim().length > 0).map((ln) => ({ role: ln.role || 'assistant', text: ln.text }));
      if (learnerId && learnerId !== 'demo' && slice.length > 0) {
        await appendTranscriptSegment({
          learnerId,
          learnerName,
          lessonId,
          lessonTitle: effectiveLessonTitle,
          segment: { startedAt: sessionStartRef.current || new Date().toISOString(), completedAt: new Date().toISOString(), lines: slice },
          sessionId: transcriptSessionId || undefined,
        });
      }
    } catch (e) { try { console.warn('[SkipBack] transcript append failed', e); } catch {} }
    try {
      const key = getSnapshotStorageKey();
      if (key) {
        const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
        try { await clearSnapshot(key, { learnerId: lid }); } catch {}
      }
    } catch {}
    try {
      sessionStartRef.current = new Date().toISOString();
      transcriptSegmentStartIndexRef.current = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current.length : 0;
      setTimeout(() => { try { scheduleSaveSnapshot('skip-back'); } catch {} }, 50);
    } catch {}
    if (phase === 'congrats') {
      resetTestProgress();
      setPhase('test');
      setSubPhase('test-awaiting-begin');
      setCanSend(false);
      return;
    }
    if (phase === 'test') {
      setPhase('worksheet');
      setSubPhase('worksheet-awaiting-begin');
      setCanSend(false);
      try { scheduleSaveSnapshot('skip-back'); } catch {}
      return;
    }
    if (phase === 'worksheet') {
      setPhase('exercise');
      setSubPhase('exercise-awaiting-begin');
      try { exerciseAwaitingLockRef.current = true; setTimeout(() => { exerciseAwaitingLockRef.current = false; }, 800); } catch {}
      setCanSend(false);
      try { scheduleSaveSnapshot('skip-back'); } catch {}
      return;
    }
    if (phase === 'exercise') {
      // Go back to Comprehension start
      setPhase('comprehension');
  setSubPhase('comprehension-start');
      try { comprehensionAwaitingLockRef.current = true; setTimeout(() => { comprehensionAwaitingLockRef.current = false; }, 800); } catch {}
      setCurrentCompProblem(null);
      setCanSend(false);
      try { scheduleSaveSnapshot('skip-back'); } catch {}
      return;
    }
    if (phase === 'comprehension') {
      // From comprehension, return to Discussion begin
      setPhase('discussion');
      setSubPhase('greeting');
      setShowBegin(true);
      // When returning to the Discussion begin screen, lock input until Begin is pressed
      setCanSend(false);
      try { scheduleSaveSnapshot('skip-back'); } catch {}
      return;
    }
    if (phase === 'teaching') {
      setPhase('discussion');
      setSubPhase('greeting');
      // Restore the initial Begin overlay when returning to the start
      setShowBegin(true);
      // Lock input like the initial load state
      setCanSend(false);
      return;
    }
    // If already at discussion, no-op
  };

  // If the user pressed skip before lesson data was ready, apply the intended skip
  // automatically once lesson data finishes loading. Mirrors the forward-skip behavior.
  useEffect(() => {
    if (!skipPendingLessonLoad) return;
    if (!lessonData || lessonDataLoading) return;
    // Clear the flag so we only apply once
    setSkipPendingLessonLoad(false);
    // Align with skip behavior side-effects
    abortAllActivity();
    setLoading(false);
    // Fresh session: go to comprehension start
    if (showBegin) {
      ensureBaseSessionSetup();
      setShowBegin(false);
      setPhase('comprehension');
  setSubPhase('comprehension-start');
  setTicker(0);
      try { comprehensionAwaitingLockRef.current = true; setTimeout(() => { comprehensionAwaitingLockRef.current = false; }, 800); } catch {}
      setCurrentCompProblem(null);
      setCanSend(false);
      return;
    }
    // From discussion/teaching ? comprehension
    if (phase === 'discussion' || phase === 'teaching') {
      ensureBaseSessionSetup();
      setShowBegin(false);
      setPhase('comprehension');
  setSubPhase('comprehension-start');
  setTicker(0);
      try { comprehensionAwaitingLockRef.current = true; setTimeout(() => { comprehensionAwaitingLockRef.current = false; }, 800); } catch {}
      setCurrentCompProblem(null);
      setCanSend(false);
      return;
    }
    // From comprehension ? exercise (awaiting begin)
    if (phase === 'comprehension') {
      setPhase('exercise');
      setSubPhase('exercise-awaiting-begin');
      try { exerciseAwaitingLockRef.current = true; setTimeout(() => { exerciseAwaitingLockRef.current = false; }, 800); } catch {}
      setExerciseSkippedAwaitBegin(true);
      setCurrentExerciseProblem(null);
      setTicker(0);
      setCanSend(false);
      return;
    }
    // From exercise ? worksheet (awaiting begin)
    if (phase === 'exercise') {
      setPhase('worksheet');
      setSubPhase('worksheet-awaiting-begin');
      setWorksheetSkippedAwaitBegin(true);
      setTicker(0);
      setCanSend(false);
      return;
    }
    // From worksheet ? test (awaiting begin)
    if (phase === 'worksheet') {
      resetTestProgress();
      setPhase('test');
      setSubPhase('test-awaiting-begin');
      setTicker(0);
      setCanSend(false);
      return;
    }
    // If already at test/congrats, do nothing
  }, [skipPendingLessonLoad, lessonData, lessonDataLoading]);

  // Begin Exercise manually when awaiting begin (either skipped or auto-transitioned)
  const beginSkippedExercise = async () => {
    if (phase !== 'exercise' || subPhase !== 'exercise-awaiting-begin') return;
    // End any prior API/audio/mic activity before starting fresh
    try { abortAllActivity(); } catch {}
    // Ensure audio/mic unlocked via Begin
  // mic permission will be requested only when user starts recording
    // Clear any temporary awaiting lock now that the user is explicitly starting
    try { exerciseAwaitingLockRef.current = false; } catch {}
    // Ensure pools/assessments exist if we arrived here via skip before setup
    ensureBaseSessionSetup();
    // No standalone unlock prompt
    // Do NOT arm the first question here - it will be armed when Go is pressed
    // This prevents the question buttons from interfering with Ask/Joke/Riddle/Poem/Story/Fill-in-fun
  setExerciseSkippedAwaitBegin(false);
  setSubPhase('exercise-start');
  // Gate quick-answer buttons until Start the lesson
  setQaAnswersUnlocked(false);
  setJokeUsedThisGate(false);
  setRiddleUsedThisGate(false);
  setPoemUsedThisGate(false);
  setStoryUsedThisGate(false);
  setFillInFunUsedThisGate(false);
  // Persist phase entrance for Exercise
  try { scheduleSaveSnapshot('begin-exercise'); } catch {}
    // Frontend-only: brief intro; first question is gated behind Go button
    const opener = EXERCISE_INTROS[Math.floor(Math.random() * EXERCISE_INTROS.length)];
    try {
      setCanSend(false);
      setTicker(0);
      await speakFrontend(opener);
    } catch {}
    // After intro, reveal Opening actions row
    try { setShowOpeningActions(true); } catch {}
    // Keep input disabled until Go is pressed
    setCanSend(false);
  };

  // Footer actions: Resume current state (re-run the current part), or Restart entire lesson fresh
  const { handleResumeClick, handleRestartClick } = useResumeRestart({
    // State values
    phase,
    subPhase,
    teachingStage,
    qaAnswersUnlocked,
    currentCompProblem,
    currentExerciseProblem,
    currentWorksheetIndex,
    testActiveIndex,
    generatedWorksheet,
    generatedTest,
    lessonParam,
    lessonData,
    manifestInfo,
    effectiveLessonTitle,
    transcriptSessionId,
    WORKSHEET_TARGET,
    TEST_TARGET,
    // State setters
    setOfferResume,
    setSubPhase,
    setCanSend,
    setShowOpeningActions,
    setQaAnswersUnlocked,
    setShowBegin,
    setPhase,
    setGeneratedWorksheet,
    setGeneratedTest,
    setCurrentWorksheetIndex,
    setCurrentCompProblem,
    setCurrentExerciseProblem,
    setTestUserAnswers,
    setTestCorrectByIndex,
    setTestCorrectCount,
    setTestFinalPercent,
    setJokeUsedThisGate,
    setRiddleUsedThisGate,
    setPoemUsedThisGate,
    setStoryUsedThisGate,
    setTimerPaused,
    setTicker,
    setCaptionSentences,
    setCaptionIndex,
    setTranscriptSessionId,
    setLoading,
    // Refs
    preferHtmlAudioOnceRef,
    forceNextPlaybackRef,
    activeQuestionBodyRef,
    worksheetIndexRef,
    captionSentencesRef,
    sessionStartRef,
    transcriptSegmentStartIndexRef,
    // Functions
    unlockAudioPlayback: unlockAudioPlaybackWrapped,
    startDiscussionStep,
    teachDefinitions,
    promptGateRepeat,
    teachExamples,
    speakFrontend,
    ensureQuestionMark,
    formatQuestionForSpeech,
    beginComprehensionPhase,
    beginSkippedExercise,
    beginWorksheetPhase,
    beginTestPhase,
    abortAllActivity,
    getSnapshotStorageKey,
    getAssessmentStorageKey,
    clearAssessments,
    scheduleSaveSnapshot,
  startTrackedSession,
    // Constants
    COMPREHENSION_INTROS,
    EXERCISE_INTROS,
    WORKSHEET_INTROS,
    TEST_INTROS,
  });

  /**
   * Unified answer judging: uses backend API for short-answer questions,
   * local judging for TF/MC/FIB questions.
   * 
   * @param {string} learnerAnswer - The learner's answer
   * @param {Array<string>} acceptable - List of acceptable answers
   * @param {Object} problem - Question object with type info
   * @returns {Promise<boolean>} True if answer is correct
   */
  const judgeAnswer = async (learnerAnswer, acceptable, problem) => {
    try {
      // Check if this is a short-answer or fill-in-blank question
      const isSA = isShortAnswerItem(problem);
      const isFIB = isFillInBlank(problem);
      const useBackend = isSA || isFIB;
      
      console.log('[judgeAnswer] Question type check:', {
        isSA,
        isFIB,
        useBackend,
        question: problem.question || problem.prompt || '',
        learnerAnswer
      });
      
      if (useBackend) {
        // Use backend API for short-answer and fill-in-blank questions
        const expectedPrimary = problem.answer || problem.expected || '';
        const expectedAnyArr = expectedAnyList(problem);
        const keywords = Array.isArray(problem.keywords) ? problem.keywords : [];
        const minKeywords = typeof problem.minKeywords === 'number' ? problem.minKeywords : (keywords.length > 0 ? 1 : 0);
        
        console.log('[judgeAnswer] Sending to backend:', {
          question: problem.question || problem.prompt || '',
          expectedPrimary,
          expectedAnyArr,
          keywords,
          minKeywords
        });
        
        try {
          const response = await fetch('/api/judge-short-answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: problem.question || problem.prompt || '',
              learnerAnswer,
              expectedAnswer: expectedPrimary,
              expectedAny: expectedAnyArr,
              keywords,
              minKeywords,
            }),
          });
          
          if (!response.ok) {
            console.warn('[judgeAnswer] Backend API failed, falling back to local judging');
            return isAnswerCorrectLocal(learnerAnswer, acceptable, problem);
          }
          
          const data = await response.json();
          console.log('[judgeAnswer] Backend response:', data);
          return !!data.correct;
        } catch (apiError) {
          console.warn('[judgeAnswer] Backend API error, falling back to local judging:', apiError);
          return isAnswerCorrectLocal(learnerAnswer, acceptable, problem);
        }
      } else {
        // Use local judging for TF/MC/FIB questions
        return isAnswerCorrectLocal(learnerAnswer, acceptable, problem);
      }
    } catch (error) {
      console.error('[judgeAnswer] Error:', error);
      // Fallback to local judging on any error
      return isAnswerCorrectLocal(learnerAnswer, acceptable, problem);
    }
  };

  const handleSend = async (providedValue) => {
    // Prevent concurrent calls while processing
    if (!canSend) return;
    
    // Use the provided value when present (e.g., from InputPanel), otherwise fall back to state
    const raw = providedValue !== undefined ? providedValue : learnerInput;
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) {
      return;
    }
    
    // Check for profanity and block if detected
    const profanityCheck = checkLearnerInput(trimmed);
    if (!profanityCheck.allowed) {
      console.log('[Session] Profanity detected and blocked:', { filtered: profanityCheck.filtered });
      // Show rejection message and clear input
      setLearnerInput("");
      await speakFrontend(profanityCheck.message || "Let's use kind words.");
      return;
    }
    
    // Clear only when actually sending so the input doesn't appear to "eat" text without sending
    setLearnerInput("");

    // Poem: topic input ? generate poem, then await Ok
    if (poemState === 'awaiting-topic') {
      setCanSend(false);
      setShowPoemSuggestions(false);
      // Echo the user's topic to captions as user line
      try {
        const prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), { text: trimmed, role: 'user' }];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
      } catch {}
      // Ask backend to write a 16-line rhyming poem about the specific user topic; then read via unified TTS/captions
      const topic = (trimmed || '').replace(/["��]/g, "'");
      const instruction = [
        'You are Ms. Sonoma.',
        `Write a rhyming poem with exactly 16 lines about the topic: "${topic}".`,
        'Use simple, warm language for kids, one short idea per line.',
        'Keep the poem clearly about that topic throughout.',
        'Do not add a title or extra commentary.'
      ].join(' ');
      const result = await callMsSonoma(instruction, '', { phase: 'discussion', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, step: 'poem' }).catch(() => null);
      // callMsSonoma handles audio playback internally, so no need to call speakFrontend
      setPoemState('awaiting-ok');
      setCanSend(false);
      setShowOpeningActions(true);
      return;
    }

    // Story: awaiting-turn or awaiting-setup ? treat as Your Turn (handles both setup and continuation)
    if (storyState === 'awaiting-turn' || storyState === 'awaiting-setup') {
      // Prevent double-processing by checking if input is already cleared
      if (!trimmed) return;
      setLearnerInput('');
      await handleStoryYourTurn(trimmed);
      return;
    }

    // Fill-in-Fun: collecting words
    if (fillInFunState === 'collecting-words') {
      if (!trimmed) return;
      setLearnerInput('');
      await handleFillInFunWordSubmit(trimmed);
      return;
    }

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
              vocabChunk = `Relevant vocab for this lesson (use naturally): ${list}.`;
            }
          }
        }
      } catch { /* vocab optional */ }
      // Capture the current problem text shown when Ask was pressed, if any
      // IMPORTANT: Do NOT include the current problem during Entrance state (before Go).
      // Only send this context once Q&A answers are unlocked.
      let problemChunk = '';
      try {
        const canIncludeProblemContext = !!qaAnswersUnlocked; // Entrance guard
        if (canIncludeProblemContext) {
          let body = (askReturnBodyRef?.current || activeQuestionBodyRef?.current || '').toString();
          if (body) {
            // Normalize whitespace and trim; cap to avoid prompt bloat
            body = body.replace(/\s+/g, ' ').trim();
            if (body.length > 400) body = body.slice(0, 400) + '�';
            problemChunk = `Current problem context (for reference, do not re-read): "${body}".`;
          }
        }
      } catch { /* problem context optional */ }
      const persona = [
        'You are Ms. Sonoma, a warm, playful, kid-friendly teacher who stays on task.',
        gradeLevel ? `The learner is a ${gradeLevel}-grade student.` : 'Speak to a school-age learner.',
        `The current lesson is "${effectiveLessonTitle}". Answer the learner\'s question briefly and clearly using correct terms but kid-friendly language.`,
        // Include a compact vocab snippet so the model can use the right terms
        vocabChunk,
        // Provide the exact problem the learner is looking at
        problemChunk,
        // Absolute rule for Ask: Ms. Sonoma must not ask questions in her answer.
        'Be encouraging, and keep focus on this lesson. Close with one gentle sentence that naturally returns us to the lesson topic. Do not ask any questions.'
      ].join(' ');
      const result = await callMsSonoma(
        persona,
        trimmed,
        { phase: 'discussion', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'open-question', gradeLevel },
        { fastReturn: false }
      );
      // After reply speech, ask if they have other questions and suggest examples
      try {
        await speakFrontend('Do you have any other questions?');
        
        // Generate example questions that evolve from what the learner just asked
        const lessonTitle = getCleanLessonTitle();
        const notes = getTeachingNotes() || '';
        
        const instruction = [
          `The lesson is "${lessonTitle}".`,
          `The learner just asked: "${trimmed}"`,
          'We answered their question.',
          'Now generate 2-3 short follow-up questions that naturally evolve from what they asked.',
          'These should be related questions that go deeper or explore connected ideas.',
          'Make them curious and enticing so the learner wants to ask more.',
          'Start with: "You could ask questions like..."',
          'Then list the questions briefly and naturally.',
          'Keep it very short and friendly.',
          'Do not answer the questions.',
          'Kid-friendly style rules: Use simple everyday words a 5–7 year old can understand. Keep sentences short (about 6–12 words).',
          'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, or symbols.'
        ].join(' ');
        
        const exampleQuestionsResult = await callMsSonoma(
          instruction,
          '',
          {
            phase: 'discussion',
            subject: subjectParam,
            difficulty: difficultyParam,
            lesson: lessonParam,
            lessonTitle: effectiveLessonTitle,
            step: 'ask-example-questions',
            teachingNotes: notes || undefined,
            originalQuestion: trimmed
          }
        );
        
        if (!exampleQuestionsResult.success) {
          console.warn('[Ask] Failed to generate example questions');
        }
      } catch (err) {
        console.warn('[Ask] Error in confirmation flow:', err);
      }
      setAskState('awaiting-confirmation');
      // Keep input disabled while awaiting button choice
      setCanSend(false);
      return;
    }

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

    if (phase === 'comprehension') {
      setCanSend(false);
      // Echo the learner's answer into the captions as a user-styled line
      try {
        const userItem = { text: trimmed, role: 'user' };
        captionSentencesRef.current = [...(captionSentencesRef.current || []), userItem];
        setCaptionSentences(captionSentencesRef.current.slice());
        setCaptionIndex(Math.max(0, (captionSentencesRef.current || []).length - 1));
      } catch {}
      const nextCount = ticker + 1;
      const progressPhrase = nextCount === 1
        ? `That makes ${nextCount} correct answer.`
        : `That makes ${nextCount} correct answers.`;
      const nearTarget = (ticker === COMPREHENSION_TARGET - 1);
      const atTarget = (nextCount === COMPREHENSION_TARGET);
      
      console.log('[Comprehension] Start of phase:', { ticker, nextCount, nearTarget, atTarget, COMPREHENSION_TARGET, currentCompProblem: !!currentCompProblem });

      // Ensure a current problem; if none, select one. If no input, just speak the question and return.
      let problem = currentCompProblem;
      if (!problem) {
        // Try generated list first (now includes SA questions)
        let pick = null;
        if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
          pick = generatedComprehension[currentCompIndex];
          setCurrentCompIndex(currentCompIndex + 1);
        }
        // REMOVED: drawSampleUnique fallback - deprecated zombie code
        if (!pick && compPool.length) {
          pick = compPool[0];
          setCompPool(compPool.slice(1));
        }
        if (!pick) {
          const refilled = buildQAPool();
          if (Array.isArray(refilled) && refilled.length) { pick = refilled[0]; setCompPool(refilled.slice(1)); }
        }
        if (pick) {
          problem = pick;
          setCurrentCompProblem(pick);
          if (!trimmed) {
            const formatted = ensureQuestionMark(formatQuestionForSpeech(pick, { layout: 'multiline' }));
            const opener = ENCOURAGEMENT_SNIPPETS[Math.floor(Math.random() * ENCOURAGEMENT_SNIPPETS.length)] + '.';
            // Track exactly what question body was spoken (without opener)
            activeQuestionBodyRef.current = formatted;
            try { await speakFrontend(`${opener} ${formatted}`, { mcLayout: 'multiline' }); } catch {}
            setLearnerInput('');
            // Keep disabled until speaking done
            setSubPhase('comprehension-active');
            setCanSend(false);
            return;
          }
        } else {
          setLearnerInput('');
          setCanSend(true);
          return;
        }
      }

      // Draw the next problem now (avoid duplicates); only used when current is correct and not final
      let nextProblem = null;
      console.log('[Comprehension] Pre-selection check:', { nearTarget, atTarget, willTryPreselect: !nearTarget && !atTarget, hasGeneratedComprehension: !!generatedComprehension, generatedComprehensionLength: generatedComprehension?.length, currentCompIndex, currentProblemText: problem?.question?.substring(0, 50) });
      if (!nearTarget && !atTarget) {
        if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
          let idx = currentCompIndex;
          const candidateText = generatedComprehension[idx]?.question?.substring(0, 50);
          console.log('[Comprehension] Trying generatedComprehension at idx:', idx, 'text:', candidateText);
          // Simply take the next item from the pre-generated array (duplicates already handled during generation)
          nextProblem = generatedComprehension[idx]; 
          setCurrentCompIndex(idx + 1); 
          console.log('[Comprehension] Selected from generatedComprehension, will set index to:', idx + 1);
        }
        if (!nextProblem) {
          // REMOVED: drawSampleUnique fallback - deprecated zombie code
        }
        if (!nextProblem && compPool.length) {
          console.log('[Comprehension] Trying compPool, length:', compPool.length);
          const [head, ...rest] = compPool;
          const headSame = (()=>{ try { const t=(head?.question ?? formatQuestionForSpeech(head)).trim(); const c=(problem?.question ?? formatQuestionForSpeech(problem)).trim(); return t===c; } catch { return false; }})();
          if (head && !headSame) { nextProblem = head; setCompPool(rest); }
          else {
            const altIndex = rest.findIndex(q => q && (()=>{ try { const t=(q?.question ?? formatQuestionForSpeech(q)).trim(); const c=(problem?.question ?? formatQuestionForSpeech(problem)).trim(); return t!==c; } catch { return true; }})());
            if (altIndex >= 0) { nextProblem = rest[altIndex]; setCompPool(rest.slice(altIndex + 1)); }
            else { setCompPool(rest); }
          }
        }
      }
      
      console.log('[Comprehension] After pre-selection, nextProblem:', !!nextProblem);

      // Build acceptable answers for local judging
  // Accept both schema variants: some items use `answer`, others use `expected`
  const { primary: expectedPrimary, synonyms: expectedSyns } = expandExpectedAnswer(problem.answer ?? problem.expected);
      const anyOf = expectedAnyList(problem);
      let acceptable = anyOf && anyOf.length ? Array.from(new Set(anyOf.map(String))) : [expectedPrimary, ...expectedSyns];
      // If the data provides a numeric correct index, use it to add the letter and option text to acceptable
      try {
        if (problem && typeof problem.correct === 'number') {
          const idx = problem.correct; // JSON appears 0-based
          const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
          const letterFromCorrect = labels[idx] || null;
          if (letterFromCorrect) {
            const optList = Array.isArray(problem?.options) ? problem.options : (Array.isArray(problem?.choices) ? problem.choices : []);
            const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.\:\)\-]\s*/i;
            const optText = optList && optList[idx] ? String(optList[idx]).replace(anyLabel, '').trim() : '';
            acceptable = Array.from(new Set([
              ...acceptable,
              letterFromCorrect,
              letterFromCorrect.toLowerCase(),
              ...(optText ? [optText] : []),
            ]));
          }
        }
      } catch {}
      // At this point in comprehension, acceptable contains expected answers.
      // Add derived letter and option text when acceptable matches an option
      try {
        const L = letterForAnswer(problem, acceptable);
        if (L) {
          const optText = getOptionTextForLetter(problem, L);
          acceptable = Array.from(new Set([
            ...acceptable,
            L,
            L.toLowerCase(),
            ...(optText ? [optText] : []),
          ]));
        }
      } catch {}

      // Judge locally with unified leniency
      let correct = false;
      try {
        correct = await judgeAnswer(trimmed, acceptable, problem);
        console.log('[Comprehension] judgeAnswer result:', { correct, trimmed, ticker, nearTarget, atTarget, hasNextProblem: !!nextProblem });
      } catch (err) {
        console.error('[Comprehension] judgeAnswer error:', err);
      }

      setLearnerInput('');

      if (correct) {
        // Reset wrong-attempt counter for this question
        try {
          const qKey = (problem?.question ?? formatQuestionForSpeech(problem)).trim();
          resetWrongAttempt(qKey);
        } catch {}
        const celebration = CELEBRATE_CORRECT[Math.floor(Math.random() * CELEBRATE_CORRECT.length)];
        if (atTarget) {
          try { scheduleSaveSnapshot('comprehension-complete'); } catch {}
          try { await speakFrontend(`${celebration}. ${progressPhrase} That's all for comprehension. Now let's begin the exercise.`); } catch {}
          setPhase('exercise');
          setSubPhase('exercise-awaiting-begin');
          setExerciseSkippedAwaitBegin(true);
          setTicker(0);
          setCurrentCompProblem(null);
          setCanSend(false);
          return;
        }
        setTicker(ticker + 1);
        console.log('[Comprehension] After correct answer:', { nearTarget, atTarget, hasNextProblem: !!nextProblem, ticker: ticker + 1 });
        if (!nearTarget && nextProblem) {
          console.log('[Comprehension] Taking path: ask next question');
          setCurrentCompProblem(nextProblem);
          try { scheduleSaveSnapshot('qa-correct-next'); } catch {}
          const nextQ = ensureQuestionMark(formatQuestionForSpeech(nextProblem, { layout: 'multiline' }));
          // Remember the exact next question spoken
          activeQuestionBodyRef.current = nextQ;
          try { await speakFrontend(`${celebration}. ${progressPhrase} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}
          setSubPhase('comprehension-active');
          setCanSend(false);
          return;
        }
        // No more unique questions available - complete the phase early
        if (!nextProblem && !nearTarget && !atTarget) {
          console.log('[Comprehension] Taking path: no more questions, ending phase early');
          try { scheduleSaveSnapshot('comprehension-complete'); } catch {}
          try { await speakFrontend(`${celebration}. ${progressPhrase} That's all for comprehension. Now let's begin the exercise.`); } catch {}
          setPhase('exercise');
          setSubPhase('exercise-awaiting-begin');
          setExerciseSkippedAwaitBegin(true);
          setTicker(0);
          setCurrentCompProblem(null);
          setCanSend(false);
          return;
        }
        console.log('[Comprehension] Taking path: near/at target or other condition - just celebrate');
        try { scheduleSaveSnapshot('qa-correct-progress'); } catch {}
        try { await speakFrontend(`${celebration}. ${progressPhrase}`); } catch {}
  setCanSend(true);
        return;
      }

      // Incorrect: adaptive hinting and reveal on third miss
      const qKey = (() => { try { return (problem?.question ?? formatQuestionForSpeech(problem)).trim(); } catch { return ''; } })();
      const wrongN = bumpWrongAttempt(qKey);
      const currQ = ensureQuestionMark(formatQuestionForSpeech(problem, { layout: 'multiline' }));
      // When we re-ask with a hint or reveal, snapshot the question body
      activeQuestionBodyRef.current = currQ;
      if (wrongN >= 3) {
        // Reveal answer on third incorrect
        const { primary: expectedPrimaryC, synonyms: expectedSynsC } = expandExpectedAnswer(problem.answer ?? problem.expected);
        const anyOfC = expectedAnyList(problem);
        const acceptableC = anyOfC && anyOfC.length ? Array.from(new Set(anyOfC.map(String))) : [expectedPrimaryC, ...expectedSynsC];
        const correctText = deriveCorrectAnswerText(problem, acceptableC, expectedPrimaryC) || expectedPrimaryC || '';
        const reveal = correctText ? `Not quite right. The correct answer is ${correctText}.` : 'Not quite right.';
        try { await speakFrontend(`${reveal} ${currQ}`, { mcLayout: 'multiline' }); } catch {}
      } else if (wrongN === 2) {
        const supportive = pickHint(HINT_SECOND, qKey);
        try { await speakFrontend(`${supportive} ${currQ}`, { mcLayout: 'multiline' }); } catch {}
      } else {
        const gentle = pickHint(HINT_FIRST, qKey);
        try { await speakFrontend(`${gentle} ${currQ}`, { mcLayout: 'multiline' }); } catch {}
      }
      setSubPhase('comprehension-active');
      setCanSend(true);
      return;
    }

  // Exercise: frontend-only judging mirrors Comprehension with multiline MC formatting
    if (phase === 'exercise') {
      // Ignore if we're still on the begin overlay
      if (subPhase === 'exercise-awaiting-begin') { setLearnerInput(''); setCanSend(true); return; }
      setCanSend(false);
      // Echo learner reply as a red "user" line in captions
      try {
        const userItem = { text: trimmed, role: 'user' };
        captionSentencesRef.current = [...(captionSentencesRef.current || []), userItem];
        setCaptionSentences(captionSentencesRef.current.slice());
        setCaptionIndex(Math.max(0, (captionSentencesRef.current || []).length - 1));
      } catch {}

      // Ensure we have a current problem; if not, pick one and just ask it now
      let problem = currentExerciseProblem;
      if (!problem) {
        let first = null;
        if (Array.isArray(generatedExercise) && currentExIndex < generatedExercise.length) {
          first = generatedExercise[currentExIndex];
          setCurrentExIndex(currentExIndex + 1);
        }
        // REMOVED: drawSampleUnique fallback - deprecated zombie code
        if (!first && exercisePool.length) {
          const [head, ...rest] = exercisePool;
          if (head) first = head;
          setExercisePool(rest);
        }
        if (!first) {
          const refilled = buildQAPool();
          if (refilled.length) { const [head, ...rest] = refilled; first = head; setExercisePool(rest); }
        }
        if (first) {
          setCurrentExerciseProblem(first);
          const q = ensureQuestionMark(formatQuestionForSpeech(first, { layout: 'multiline' }));
          // Track first exercise question asked
          activeQuestionBodyRef.current = q;
          try { await speakFrontend(q, { mcLayout: 'multiline' }); } catch {}
        }
        setCanSend(true);
        return;
      }

      const nextCount = ticker + 1;
      const progressPhrase = nextCount === 1
        ? `That makes ${nextCount} correct answer.`
        : `That makes ${nextCount} correct answers.`;
      const nearTarget = (ticker === EXERCISE_TARGET - 1);
      const atTarget = (nextCount === EXERCISE_TARGET);

      // Pre-pick next problem if we won't be at target yet
      let nextProblem = null;
      if (!nearTarget && !atTarget) {
        if (Array.isArray(generatedExercise) && currentExIndex < generatedExercise.length) {
          const currText = (() => { try { return (problem?.question ?? formatQuestionForSpeech(problem)).trim(); } catch { return ''; } })();
          let idx = currentExIndex;
          // Skip only if same question (allow SA now)
          while (idx < generatedExercise.length && (()=>{ try { const t=(generatedExercise[idx]?.question ?? formatQuestionForSpeech(generatedExercise[idx])).trim(); return t===currText; } catch { return false; }})()) idx += 1;
          if (idx < generatedExercise.length) { nextProblem = generatedExercise[idx]; setCurrentExIndex(idx + 1); }
        }
        // REMOVED: drawSampleUnique fallback - deprecated zombie code
        if (!nextProblem && exercisePool.length) {
          const [head, ...rest] = exercisePool;
          const headSame = (()=>{ try { const t=(head?.question ?? formatQuestionForSpeech(head)).trim(); const c=(problem?.question ?? formatQuestionForSpeech(problem)).trim(); return t===c; } catch { return false; }})();
          if (head && !headSame) { nextProblem = head; setExercisePool(rest); }
          else {
            const altIndex = rest.findIndex(q => q && (()=>{ try { const t=(q?.question ?? formatQuestionForSpeech(q)).trim(); const c=(problem?.question ?? formatQuestionForSpeech(problem)).trim(); return t!==c; } catch { return true; }})());
            if (altIndex >= 0) { nextProblem = rest[altIndex]; setExercisePool(rest.slice(altIndex + 1)); }
            else { setExercisePool(rest); }
          }
        }
      }

      // Build acceptable answers
  const { primary: expectedPrimaryE, synonyms: expectedSynsE } = expandExpectedAnswer(problem.answer ?? problem.expected ?? problem.A ?? problem.a);
      const anyOfE = expectedAnyList(problem);
      let acceptableE = anyOfE && anyOfE.length ? Array.from(new Set(anyOfE.map(String))) : [expectedPrimaryE, ...expectedSynsE];
      // If numeric correct index exists, add letter and option text
      try {
        if (problem && typeof problem.correct === 'number') {
          const idx = problem.correct; const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
          const L = labels[idx] || null;
          if (L) {
            const optList = Array.isArray(problem?.options) ? problem.options : (Array.isArray(problem?.choices) ? problem.choices : []);
            const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.\:\)\-]\s*/i;
            const optText = optList && optList[idx] ? String(optList[idx]).replace(anyLabel, '').trim() : '';
            acceptableE = Array.from(new Set([ ...acceptableE, L, L.toLowerCase(), ...(optText ? [optText] : []) ]));
          }
        }
      } catch {}
      const letterE = letterForAnswer(problem, acceptableE);
      if (letterE) {
        const optTextE = getOptionTextForLetter(problem, letterE);
        acceptableE = Array.from(new Set([ ...acceptableE, letterE, letterE.toLowerCase(), ...(optTextE ? [optTextE] : []) ]));
      }

      // Local correctness using unified helper
      let correct = false;
      try { 
        correct = await judgeAnswer(trimmed, acceptableE, problem); 
        if (!correct) {
          console.log('[Exercise] Answer marked incorrect:', { learnerAnswer: trimmed, acceptableE, problemAnswer: problem.answer, problemExpected: problem.expected, problemA: problem.A, problema: problem.a, anyOfE });
        }
      } catch {}

      setLearnerInput('');

      if (correct) {
        // Reset wrong-attempt counter for this question
        try {
          const qKey = (problem?.question ?? formatQuestionForSpeech(problem)).trim();
          resetWrongAttempt(qKey);
        } catch {}
        const celebration = CELEBRATE_CORRECT[Math.floor(Math.random() * CELEBRATE_CORRECT.length)];
        if (atTarget) {
          try { scheduleSaveSnapshot('exercise-complete'); } catch {}
          try { await speakFrontend(`${celebration}. ${progressPhrase} That's all for the exercise. Now let's move on to the worksheet.`); } catch {}
          setPhase('worksheet');
          setSubPhase('worksheet-awaiting-begin');
          setTicker(0);
          setCanSend(false);
          setCurrentExerciseProblem(null);
          return;
        }
        setTicker(ticker + 1);
        if (!nearTarget && nextProblem) {
          setCurrentExerciseProblem(nextProblem);
          try { scheduleSaveSnapshot('qa-correct-next'); } catch {}
          const nextQ = ensureQuestionMark(formatQuestionForSpeech(nextProblem, { layout: 'multiline' }));
          // Remember the exact next exercise question spoken
          activeQuestionBodyRef.current = nextQ;
          try { await speakFrontend(`${celebration}. ${progressPhrase} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}
          // Re-enable input after the next question has been spoken. While speaking, input is locked by speakingLock.
          setCanSend(true);
          return;
        }
        try { scheduleSaveSnapshot('qa-correct-progress'); } catch {}
        try { await speakFrontend(`${celebration}. ${progressPhrase}`); } catch {}
  setCanSend(true);
        return;
      }

      // Incorrect: adaptive hints; reveal on third incorrect
      const qKeyE = (() => { try { return (problem?.question ?? formatQuestionForSpeech(problem)).trim(); } catch { return ''; } })();
      const wrongNE = bumpWrongAttempt(qKeyE);
      const currQ = ensureQuestionMark(formatQuestionForSpeech(problem, { layout: 'multiline' }));
      // Snapshot the question we are re-asking with a hint
      activeQuestionBodyRef.current = currQ;
      if (wrongNE >= 3) {
        const { primary: expectedPrimaryE2, synonyms: expectedSynsE2 } = expandExpectedAnswer(problem.answer ?? problem.expected ?? problem.A ?? problem.a);
        const anyOfE2 = expectedAnyList(problem);
        const acceptableE2 = anyOfE2 && anyOfE2.length ? Array.from(new Set(anyOfE2.map(String))) : [expectedPrimaryE2, ...expectedSynsE2];
        const correctTextE = deriveCorrectAnswerText(problem, acceptableE2, expectedPrimaryE2) || expectedPrimaryE2 || '';
        const revealE = correctTextE ? `Not quite right. The correct answer is ${correctTextE}.` : 'Not quite right.';
        try { console.log('[Exercise] Third try reveal:', { correctTextE, expectedPrimaryE2, acceptableE2, problemAnswer: problem.answer, problemExpected: problem.expected, problemA: problem.A, problema: problem.a }); } catch {}
        try { await speakFrontend(`${revealE} ${currQ}`, { mcLayout: 'multiline' }); } catch {}
      } else if (wrongNE === 2) {
        const supportiveE = pickHint(HINT_SECOND, qKeyE);
        try { await speakFrontend(`${supportiveE} ${currQ}`, { mcLayout: 'multiline' }); } catch {}
      } else {
        const gentleE = pickHint(HINT_FIRST, qKeyE);
        try { await speakFrontend(`${gentleE} ${currQ}`, { mcLayout: 'multiline' }); } catch {}
      }
      setCanSend(true);
      return;
    }

    // Worksheet: frontend-only judging mirrors Exercise (multiline MC, retries on wrong)
    if (phase === 'worksheet') {
      if (subPhase === 'worksheet-awaiting-begin') { setLearnerInput(''); setCanSend(true); return; }
      setCanSend(false);
      // Echo learner reply into captions as user line
      try {
        const userItem = { text: trimmed, role: 'user' };
        captionSentencesRef.current = [...(captionSentencesRef.current || []), userItem];
        setCaptionSentences(captionSentencesRef.current.slice());
        setCaptionIndex(Math.max(0, (captionSentencesRef.current || []).length - 1));
      } catch {}

      // Ensure there is a current problem; if not, ask the first one
      const list = Array.isArray(generatedWorksheet) ? generatedWorksheet : [];
      let idx = (typeof worksheetIndexRef?.current === 'number' ? worksheetIndexRef.current : currentWorksheetIndex) || 0;
      if (!list.length) { setCanSend(true); return; }
      if (idx < 0 || idx >= list.length) { idx = 0; }
      let problem = list[idx];
      if (!problem) {
        // Ask first question now and return
        const firstQ = ensureQuestionMark(formatQuestionForSpeech(list[0], { layout: 'multiline' }));
        // Track first worksheet question asked
        activeQuestionBodyRef.current = firstQ;
        try { await speakFrontend(firstQ, { mcLayout: 'multiline' }); } catch {}
        setCanSend(true);
        return;
      }

      const nextCount = ticker + 1;
      const totalLimit = Math.min(WORKSHEET_TARGET || list.length, list.length);
      const progressPhrase = nextCount === 1 ? `That makes ${nextCount} correct answer.` : `That makes ${nextCount} correct answers.`;
      const nearTarget = (ticker === totalLimit - 1);
      const atTarget = (nextCount === totalLimit);

      // Build acceptable answers
  const { primary: expectedPrimaryW, synonyms: expectedSynsW } = expandExpectedAnswer(problem.answer ?? problem.expected);
      const anyOfW = expectedAnyList(problem);
      let acceptableW = anyOfW && anyOfW.length ? Array.from(new Set(anyOfW.map(String))) : [expectedPrimaryW, ...expectedSynsW];
      try {
        if (problem && typeof problem.correct === 'number') {
          const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
          const L = labels[problem.correct] || null;
          if (L) {
            const optList = Array.isArray(problem?.options) ? problem.options : (Array.isArray(problem?.choices) ? problem.choices : []);
            const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.\:\)\-]\s*/i;
            const optText = optList && optList[problem.correct] ? String(optList[problem.correct]).replace(anyLabel, '').trim() : '';
            acceptableW = Array.from(new Set([ ...acceptableW, L, L.toLowerCase(), ...(optText ? [optText] : []) ]));
          }
        }
      } catch {}
      const letterW = letterForAnswer(problem, acceptableW);
      if (letterW) {
        const optTextW = getOptionTextForLetter(problem, letterW);
        acceptableW = Array.from(new Set([ ...acceptableW, letterW, letterW.toLowerCase(), ...(optTextW ? [optTextW] : []) ]));
      }

      // Local correctness using unified helper
      let correctW = false;
      try { correctW = await judgeAnswer(trimmed, acceptableW, problem); } catch {}

      setLearnerInput('');

      if (correctW) {
        // Reset wrong-attempt counter for this question
        try {
          const qKey = (problem?.question ?? formatQuestionForSpeech(problem)).trim();
          resetWrongAttempt(qKey);
        } catch {}
        const celebration = CELEBRATE_CORRECT[Math.floor(Math.random() * CELEBRATE_CORRECT.length)];
        if (atTarget) {
          try { scheduleSaveSnapshot('worksheet-complete'); } catch {}
          try { await speakFrontend(`${celebration}. ${progressPhrase} That's all for the worksheet. Now let's begin the test.`); } catch {}
          resetTestProgress();
          setPhase('test');
          setSubPhase('test-awaiting-begin');
          setTicker(0);
          setCanSend(false);
          return;
        }
        // Advance worksheet index and ask next
    const nextIdx = Math.min(idx + 1, list.length - 1);
        worksheetIndexRef.current = nextIdx;
        setCurrentWorksheetIndex(nextIdx);
        setTicker(ticker + 1);
        try { scheduleSaveSnapshot('qa-correct-next'); } catch {}
  const nextObj = list[nextIdx];
  const numN = (typeof nextObj?.number === 'number' && nextObj.number > 0) ? nextObj.number : (nextIdx + 1);
  const nextQ = ensureQuestionMark(`${numN}. ${formatQuestionForSpeech(nextObj, { layout: 'multiline' })}`);
    // Remember the exact next worksheet question spoken
    activeQuestionBodyRef.current = nextQ;
        try { await speakFrontend(`${celebration}. ${progressPhrase} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}
        setCanSend(true);
        return;
      }

      // Incorrect: adaptive hints and reveal on third incorrect attempt
      const qKeyW = (() => { try { return (problem?.question ?? formatQuestionForSpeech(problem)).trim(); } catch { return ''; } })();
      const wrongNW = bumpWrongAttempt(qKeyW);
      const currNum = (typeof problem?.number === 'number' && problem.number > 0) ? problem.number : (idx + 1);
      const currQ = ensureQuestionMark(`${currNum}. ${formatQuestionForSpeech(problem, { layout: 'multiline' })}`);
      // Snapshot the worksheet question we are re-asking
      activeQuestionBodyRef.current = currQ;
      if (wrongNW >= 3) {
        const { primary: expectedPrimaryW2, synonyms: expectedSynsW2 } = expandExpectedAnswer(problem.answer ?? problem.expected ?? problem.A ?? problem.a);
        const anyOfW2 = expectedAnyList(problem);
        const acceptableW2 = anyOfW2 && anyOfW2.length ? Array.from(new Set(anyOfW2.map(String))) : [expectedPrimaryW2, ...expectedSynsW2];
        const correctTextW = deriveCorrectAnswerText(problem, acceptableW2, expectedPrimaryW2) || expectedPrimaryW2 || '';
        const revealW = correctTextW ? `Not quite right. The correct answer is ${correctTextW}.` : 'Not quite right.';
        try { console.log('[Worksheet] Third try reveal:', { correctTextW, expectedPrimaryW2, acceptableW2, problemAnswer: problem.answer, problemExpected: problem.expected, problemA: problem.A, problema: problem.a }); } catch {}
        try { await speakFrontend(`${revealW} ${currQ}`, { mcLayout: 'multiline' }); } catch {}
      } else if (wrongNW === 2) {
        const supportiveW = pickHint(HINT_SECOND, qKeyW);
        try { await speakFrontend(`${supportiveW} ${currQ}`, { mcLayout: 'multiline' }); } catch {}
      } else {
        const gentleW = pickHint(HINT_FIRST, qKeyW);
        try { await speakFrontend(`${gentleW} ${currQ}`, { mcLayout: 'multiline' }); } catch {}
      }
      setCanSend(true);
      return;
    }

    if (phase === 'test') {
      // Immediate per-question judging: no retries, auto-advance, cumulative scoring
      if (subPhase === 'test-active') {
        if (!generatedTest || !generatedTest.length) { setLearnerInput(''); return; }
        setCanSend(false);
        // Frontend-only judging for Test: no retries, reveal correct on miss, auto-advance
        try {
          const totalLimit = Math.min(TEST_TARGET || generatedTest.length, generatedTest.length);
          const idx = testActiveIndex;
          const qObj = generatedTest[idx];
          // Append learner reply to transcript as user line
          try {
            const replyItem = { text: trimmed, role: 'user' };
            captionSentencesRef.current = [...(captionSentencesRef.current || []), replyItem];
            setCaptionSentences(captionSentencesRef.current.slice());
            setCaptionIndex(Math.max(0, (captionSentencesRef.current || []).length - 1));
          } catch {}
          // Persist learner answer
          const answersNow = [...testUserAnswers];
          answersNow[idx] = trimmed;
          setTestUserAnswers(answersNow);

          // Build acceptable answers (letter + option text support)
          const { primary: expectedPrimaryT, synonyms: expectedSynsT } = expandExpectedAnswer(qObj.answer ?? qObj.expected);
          const anyOfT = expectedAnyList(qObj);
          let acceptableT = anyOfT && anyOfT.length ? Array.from(new Set(anyOfT.map(String))) : [expectedPrimaryT, ...expectedSynsT];
          try {
            if (qObj && typeof qObj.correct === 'number') {
              const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
              const L = labels[qObj.correct] || null;
              if (L) {
                const optList = Array.isArray(qObj?.options) ? qObj.options : (Array.isArray(qObj?.choices) ? qObj.choices : []);
                const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.\:\)\-]\s*/i;
                const optText = optList && optList[qObj.correct] ? String(optList[qObj.correct]).replace(anyLabel, '').trim() : '';
                acceptableT = Array.from(new Set([ ...acceptableT, L, L.toLowerCase(), ...(optText ? [optText] : []) ]));
              }
            }
          } catch {}
          const letterT = letterForAnswer(qObj, acceptableT);
          if (letterT) {
            const optTextT = getOptionTextForLetter(qObj, letterT);
            acceptableT = Array.from(new Set([ ...acceptableT, letterT, letterT.toLowerCase(), ...(optTextT ? [optTextT] : []) ]));
          }

          // Local correctness using unified helper (no retries in test)
          let judgedCorrect = false;
          try { judgedCorrect = await judgeAnswer(trimmed, acceptableT, qObj); } catch {}

          // Update correctness arrays and counts
          try { setTestCorrectByIndex(prev => { const a = Array.isArray(prev) ? prev.slice() : []; a[idx] = !!judgedCorrect; return a; }); } catch {}
          if (judgedCorrect) setTestCorrectCount(prev => prev + 1);

          setLearnerInput('');

          const isFinal = (idx + 1) >= totalLimit;
          const nextIdx = idx + 1;
          // Build feedback speech with correct answer populated
          let speech;
          if (judgedCorrect) {
            speech = `${CELEBRATE_CORRECT[Math.floor(Math.random() * CELEBRATE_CORRECT.length)]}.`;
          } else {
            const correctText = deriveCorrectAnswerText(qObj, acceptableT, expectedPrimaryT) || expectedPrimaryT;
            speech = correctText
              ? `Not quite right. The correct answer is ${correctText}.`
              : `Not quite right.`;
          }

          if (!isFinal) {
            const nextObj = generatedTest[nextIdx];
            const nextQ = ensureQuestionMark(`${nextIdx + 1}. ${formatQuestionForSpeech(nextObj, { layout: 'multiline' })}`);
            // Remember the exact next test question spoken
            activeQuestionBodyRef.current = nextQ;
            try { await speakFrontend(`${speech} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}
            setTestActiveIndex(nextIdx);
            try { scheduleSaveSnapshot('test-advance'); } catch {}
            setCanSend(true);
            return;
          }

          // Last question: speak feedback + brief encouragement, then go straight to facilitator review
          try { setTestCorrectByIndex(prev => { const a = Array.isArray(prev) ? prev.slice() : []; a[idx] = judgedCorrect; return a; }); } catch {}

          // Always cue a short encouragement for closure, regardless of correctness
          const encouragement = getSimpleEncouragement();
          const closingLine = `${speech} ${encouragement}.`;
          // Speak feedback fully, then transition to review so it opens after Ms. Sonoma responds
          reviewDeferRef.current = true;
          try { await speakFrontend(closingLine); } catch {}
          reviewDeferRef.current = false;
          // Go directly to review; congrats is gated after Accept
          try { setCanSend(false); } catch {}
          try { setSubPhase('review-start'); } catch {}
          try { scheduleSaveSnapshot('test-review-start'); } catch {}
          return;
        } catch {
          // Hard fallback: force facilitator review to avoid dead-ends (defer score to review phase)
          try { setCanSend(false); } catch {}
          try { setSubPhase('review-start'); } catch {}
          return;
        }
        const totalLimit = Math.min(TEST_TARGET || generatedTest.length, generatedTest.length);
        const idx = testActiveIndex;
        const qObj = generatedTest[idx];
        // Append learner reply to the transcript (styled as user in CaptionPanel)
        try {
          const replyItem = { text: trimmed, role: 'user' };
          captionSentencesRef.current = [...captionSentencesRef.current, replyItem];
          setCaptionSentences(captionSentencesRef.current.slice());
          setCaptionIndex(Math.max(0, captionSentencesRef.current.length - 1));
        } catch {}
        // Persist learner answer
        const answersNow = [...testUserAnswers];
        answersNow[idx] = trimmed;
        setTestUserAnswers(answersNow);

        // Build expected/acceptable (mirror worksheet/exercise logic)
  const { primary: expectedPrimaryT, synonyms: expectedSynsT } = expandExpectedAnswer(qObj.answer ?? qObj.expected);
        const anyOfT = expectedAnyList(qObj);
        let acceptableT = anyOfT && anyOfT.length ? Array.from(new Set(anyOfT.map(String))) : [expectedPrimaryT, ...expectedSynsT];
        const letterT = letterForAnswer(qObj, acceptableT);
        if (letterT) {
          const optTextT = getOptionTextForLetter(qObj, letterT);
          acceptableT = Array.from(new Set([
            ...acceptableT,
            letterT,
            letterT.toLowerCase(),
            ...(optTextT ? [optTextT] : [])
          ]));
        }
        // Legacy API-driven judging path removed
        return;
      }
      setLearnerInput('');
      return;
    }

    // Old exercise API-driven path removed; exercise is now handled earlier via frontend-only branch.

    setLearnerInput('');
  };

  // Begin hotkey control for Begin overlays. When a Begin button is visible, the configured Begin/Send key triggers it.
  useEffect(() => {
    const onKeyDown = (e) => {
      const code = e.code || e.key;
      const target = e.target;
      if (isTextEntryTarget(target)) return;
      const beginCode = hotkeys?.beginSend || DEFAULT_HOTKEYS.beginSend;
      if (!beginCode || code !== beginCode) return;
      try {
        // Initial Begin is always allowed to start even if loading flags are set pre-session
        if (showBegin && phase === 'discussion') {
          e.preventDefault();
          beginSession();
          return;
        }
        // For later begins, avoid firing while loading/speaking to prevent overlap
        if (loading || isSpeaking) return;
        if (phase === 'comprehension' && subPhase === 'comprehension-start') {
          e.preventDefault();
          beginComprehensionPhase();
          return;
        }
        if (phase === 'exercise' && subPhase === 'exercise-awaiting-begin') {
          e.preventDefault();
          beginSkippedExercise();
          return;
        }
        if (phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin') {
          e.preventDefault();
          beginWorksheetPhase();
          return;
        }
        if (phase === 'test' && subPhase === 'test-awaiting-begin') {
          e.preventDefault();
          beginTestPhase();
          return;
        }
      } catch {}
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showBegin, phase, subPhase, loading, isSpeaking, beginSession, beginComprehensionPhase, beginSkippedExercise, beginWorksheetPhase, beginTestPhase, hotkeys]);

  // Global hotkeys for mute toggle
  useEffect(() => {
    const onKeyDown = (e) => {
      const code = e.code || e.key;
      const target = e.target;
      if (isTextEntryTarget(target)) return; // don't steal keys while typing in inputs/textareas
      if (!hotkeys) return;

      const { muteToggle } = { ...DEFAULT_HOTKEYS, ...hotkeys };

      if (muteToggle && code === muteToggle) {
        e.preventDefault();
        toggleMute?.();
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hotkeys, toggleMute]);

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

  // Shared Complete Lesson handler used by VideoPanel (and any other triggers)
  const onCompleteLesson = useCallback(async () => {
    // Check if golden key was earned (completed within time limit)
    let earnedKey = false;
    try {
      const timerState = sessionStorage.getItem('session_timer_state');
      if (timerState) {
        const state = JSON.parse(timerState);
        const totalSeconds = sessionTimerMinutes * 60;
        const elapsed = state.elapsedSeconds || 0;
        if (elapsed <= totalSeconds) {
          earnedKey = true;
          setGoldenKeyEarned(true);
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
              console.error('[Golden Key] Failed to increment key:', err);
            }
          }
        }
      }
    } catch {}

    // Show golden key message if earned
    if (earnedKey && typeof window !== 'undefined') {
      alert('🔑 Congratulations! You earned the Golden Key! This unlocks the poem and story in your next lesson!');
    }

    // Clear timer state
    try {
      sessionStorage.removeItem('session_timer_state');
    } catch {}

    // Clear active golden key for this lesson if it was used
    if (hasGoldenKey) {
      const learnerId = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
      if (learnerId && learnerId !== 'demo') {
        try {
          const { getLearner, updateLearner } = await import('@/app/facilitator/learners/clientApi');
          const learner = await getLearner(learnerId);
          if (learner) {
            const lessonKey = `${subjectParam}/${lessonParam}`;
            const activeKeys = { ...(learner.active_golden_keys || {}) };
            delete activeKeys[lessonKey];
            
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
              golden_keys: learner.golden_keys,
              active_golden_keys: activeKeys
            });
            console.info('[Golden Key] Cleared active golden key for completed lesson:', lessonKey);
          }
        } catch (err) {
          console.error('[Golden Key] Failed to clear active golden key:', err);
        }
      }
    }

    // Stop any ongoing audio/speech/mic work first
    try { abortAllActivity(); } catch {}
    const storageLearnerId = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';

    // Clear cached assessments first so generated sets rebuild next session
    try {
      const assessmentKey = getAssessmentStorageKey();
      if (assessmentKey) {
        await clearAssessments(assessmentKey, { learnerId: storageLearnerId });
      }
    } catch {}

    // Clear resume snapshots so fresh lessons start without a Continue prompt
    try {
      const snapshotKeys = new Set();
      try {
        const key = getSnapshotStorageKey();
        if (key) snapshotKeys.add(key);
      } catch {}
      try {
        const key = getSnapshotStorageKey({ param: lessonParam });
        if (key) snapshotKeys.add(key);
      } catch {}
      try {
        const key = getSnapshotStorageKey({ manifest: manifestInfo });
        if (key) snapshotKeys.add(key);
      } catch {}
      try {
        if (lessonData?.id) {
          const key = getSnapshotStorageKey({ data: lessonData });
          if (key) snapshotKeys.add(key);
        }
      } catch {}

      for (const key of snapshotKeys) {
        try { await clearSnapshot(key, { learnerId: storageLearnerId }); } catch {}
        try {
          const variants = [
            `${key}:W15:T10`,
            `${key}:W20:T20`,
            `${key}:W${Number(WORKSHEET_TARGET) || 15}:T${Number(TEST_TARGET) || 10}`,
          ];
          for (const variant of variants) {
            try { await clearSnapshot(variant, { learnerId: storageLearnerId }); } catch {}
            try { await clearSnapshot(`${variant}.json`, { learnerId: storageLearnerId }); } catch {}
          }
          try { await clearSnapshot(`${key}.json`, { learnerId: storageLearnerId }); } catch {}
        } catch {}
      }
    } catch {}
    // Persist transcript segment (append-only) to Supabase Storage
    try {
      const learnerId = (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
      const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || null;
      const lessonId = String(lessonParam || '').replace(/\.json$/i, '');
      const startedAt = sessionStartRef.current || new Date().toISOString();
      const completedAt = new Date().toISOString();
      const all = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current : [];
      const startIdx = Math.max(0, Number(transcriptSegmentStartIndexRef.current) || 0);
      const lines = all.slice(startIdx)
        .filter((ln) => ln && typeof ln.text === 'string' && ln.text.trim().length > 0)
        .map((ln) => ({ role: ln.role || 'assistant', text: ln.text }));
      if (learnerId && learnerId !== 'demo' && lines.length > 0) {
        await appendTranscriptSegment({
          learnerId,
          learnerName,
          lessonId,
          lessonTitle: effectiveLessonTitle,
          segment: { startedAt, completedAt, lines },
          sessionId: transcriptSessionId || undefined,
        });
      }
    } catch (e) { console.warn('[Session] transcript append failed', e); }
    if (trackingLearnerId) {
      try { await endTrackedSession(); } catch {}
    }
    sessionStartRef.current = null;
    try { transcriptSegmentStartIndexRef.current = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current.length : 0; } catch {}
    setShowBegin(true);
    setPhase('discussion');
    setSubPhase('greeting');
    setCanSend(false);
    setGeneratedWorksheet(null);
    setGeneratedTest(null);
    setCurrentWorksheetIndex(0);
    worksheetIndexRef.current = 0;
    // Navigate to lessons
    try {
      if (router && typeof router.push === 'function') {
        router.push('/learn/lessons');
      } else if (typeof window !== 'undefined') {
        window.location.href = '/learn/lessons';
      }
    } catch {
      if (typeof window !== 'undefined') {
        try { window.location.href = '/learn/lessons'; } catch {}
      }
    }
  }, [effectiveLessonTitle, lessonParam, router, sessionTimerMinutes, endTrackedSession, trackingLearnerId]);

  // No portrait spacer: timeline should sit directly under the header in portrait mode.

  return (
    <>
    <div style={{ width: '100%', height: '100svh', overflow: 'hidden' }}>
  {/* Bounding wrapper: regular flow; inner container handles centering via margin auto */}
  <div style={{ width: '100%', height: '100%' }}>
    {/* Scroll area sized to the viewport; disable scrolling to keep top cluster fixed */}
  <div style={{ height: '100%', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
    {/* Width-matched wrapper: center by actual scaled width */}
  <div style={{ width: '100%', boxSizing: 'border-box', paddingBottom: footerHeight }}>
  {/* Content wrapper (no transform scaling). Add small horizontal gutters in landscape. */}
  <div style={ isMobileLandscape ? { width: '100%', paddingLeft: 8, paddingRight: 8, boxSizing: 'border-box' } : { width: '100%' } }>
      {/* Sticky cluster: title + timeline + video + captions stick under the header without moving into it */}
  <div style={{ position: 'sticky', top: (isMobileLandscape ? 52 : 64), zIndex: 25, background: '#ffffff' }}>
    {(() => {
  const showBanner = !audioUnlocked;
      if (!showBanner) return null;
  const onEnable = async () => { try { await unlockAudioPlaybackWrapped(); } catch {} };
      return (
        <div style={{ width: '100%', borderBottom: '1px solid #e5e7eb', background: '#fff8e1', color: '#4b3b00' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, fontSize: 13, lineHeight: 1.3 }}>
              Enable audio so Ms. Sonoma can speak to you.
            </div>
            <button type="button" onClick={onEnable} style={{ padding: '6px 10px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, cursor: 'pointer' }}>
              Enable Audio
            </button>
          </div>
        </div>
      );
    })()}
    <div style={{ width: '100%', boxSizing: 'border-box', padding: (isMobileLandscape ? '0 0 6px' : 0), minWidth: 0 }}>
  {/** Clickable timeline jump logic */}
  {(() => {
    const handleJumpPhase = async (target) => {
      const ok = await ensurePinAllowed('timeline');
      if (!ok) return;
      // Always confirm on any move (forward or backward) from the current phase
      try {
        const currentIdx = timelinePhases.indexOf(phase);
        const targetIdx = timelinePhases.indexOf(target);
        const isDifferent = targetIdx !== currentIdx;
        if (isDifferent) {
          const ans = typeof window !== 'undefined' ? window.prompt("This will alter the lesson in a way that can't be reversed. Type 'ok' to proceed.") : null;
          if (!ans || String(ans).trim().toLowerCase() !== 'ok') return;
        }
      } catch {}
      // Jump directly to a major phase emulating skip button side-effects
      // This centralizes transitional resets so timeline navigation = skip navigation.
      try { abortAllActivity(); } catch {}
      setLoading(false); // allow overlays/buttons to show immediately
      // On timeline jump, cut transcript segment and clear snapshots so resume starts fresh
      try {
        const learnerId = (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
        const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || null;
        const lessonId = String(lessonParam || '').replace(/\.json$/i, '');
        const startIdx = Math.max(0, Number(transcriptSegmentStartIndexRef.current) || 0);
        const all = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current : [];
        const slice = all.slice(startIdx).filter((ln) => ln && typeof ln.text === 'string' && ln.text.trim().length > 0).map((ln) => ({ role: ln.role || 'assistant', text: ln.text }));
        if (learnerId && learnerId !== 'demo' && slice.length > 0) {
          await appendTranscriptSegment({
            learnerId,
            learnerName,
            lessonId,
            lessonTitle: effectiveLessonTitle,
            segment: { startedAt: sessionStartRef.current || new Date().toISOString(), completedAt: new Date().toISOString(), lines: slice },
            sessionId: transcriptSessionId || undefined,
          });
        }
      } catch (e) { try { console.warn('[TimelineJump] transcript append failed', e); } catch {} }
      try {
        const key = getSnapshotStorageKey();
        if (key) {
          const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none';
          try { await clearSnapshot(key, { learnerId: lid }); } catch {}
        }
      } catch {}
      try {
        sessionStartRef.current = new Date().toISOString();
        transcriptSegmentStartIndexRef.current = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current.length : 0;
      } catch {}

      const goDiscussion = () => {
        setPhase('discussion');
        setSubPhase('greeting');
        setShowBegin(true); // initial big Begin overlay
        setCanSend(false);
        setTicker(0);
      };

      const goComprehension = () => {
        ensureBaseSessionSetup();
        setPhase('comprehension');
        setSubPhase('comprehension-start');
        setShowBegin(false); // we use the dedicated Begin Comprehension button, not global overlay
        setCurrentCompProblem(null);
        setCanSend(false);
        setTicker(0);
        try {
          comprehensionAwaitingLockRef.current = true;
          setTimeout(() => { comprehensionAwaitingLockRef.current = false; }, 800);
        } catch {}
      };

      const goExercise = () => {
        ensureBaseSessionSetup();
        setPhase('exercise');
        setSubPhase('exercise-awaiting-begin');
        setShowBegin(false);
        setExerciseSkippedAwaitBegin(true); // ensures Begin Exercise button path
        setCurrentExerciseProblem(null);
        setCanSend(false);
        setTicker(0);
        try {
          exerciseAwaitingLockRef.current = true;
          setTimeout(() => { exerciseAwaitingLockRef.current = false; }, 800);
        } catch {}
      };

      const goWorksheet = () => {
        ensureBaseSessionSetup();
        setPhase('worksheet');
        setSubPhase('worksheet-awaiting-begin');
        setShowBegin(false);
        setWorksheetSkippedAwaitBegin(true);
        setCanSend(false);
        setTicker(0);
      };

      const goTest = () => {
        ensureBaseSessionSetup();
        resetTestProgress();
        setPhase('test');
        setSubPhase('test-awaiting-begin');
        setShowBegin(false);
        setCanSend(false);
        setTicker(0);
      };

      switch (target) {
        case 'discussion':
          goDiscussion();
          try { scheduleSaveSnapshot('jump-discussion'); } catch {}
          break;
        case 'comprehension':
          goComprehension();
          try { scheduleSaveSnapshot('jump-comprehension'); } catch {}
          break;
        case 'exercise':
          goExercise();
          try { scheduleSaveSnapshot('jump-exercise'); } catch {}
          break;
        case 'worksheet':
          goWorksheet();
          try { scheduleSaveSnapshot('jump-worksheet'); } catch {}
          break;
        case 'test':
          goTest();
          try { scheduleSaveSnapshot('jump-test'); } catch {}
          break;
        default:
          break;
      }
    };
    return (
      <div style={{ position: 'relative', zIndex: 9999 }}>
        {/* Timeline is constrained to a 600px max width */}
        <div
          style={{
            width: isMobileLandscape ? '100%' : '92%',
            maxWidth: 600,
            margin: '0 auto',
            // When page height is very short in landscape, remove timeline vertical padding entirely.
            // Otherwise, when short-height+landscape, apply small padding (2px) to avoid clipping.
            paddingTop: isVeryShortLandscape ? 0 : ((isShortHeight && isMobileLandscape) ? 2 : undefined),
            paddingBottom: isVeryShortLandscape ? 0 : ((isShortHeight && isMobileLandscape) ? 2 : undefined),
          }}
        >
          <Timeline
            timelinePhases={timelinePhases}
            timelineHighlight={timelineHighlight}
            compact={isMobileLandscape}
            onJumpPhase={handleJumpPhase}
          />
        </div>
      </div>
    );
  })()}

    {/* Removed inline Review button; moved to footer control bar */}

  {/* Video + captions: stack normally; side-by-side on mobile landscape */}
  <div style={isMobileLandscape ? { display:'flex', alignItems:'stretch', width:'100%', paddingBottom:4, '--msSideBySideH': (videoEffectiveHeight ? `${videoEffectiveHeight}px` : (sideBySideHeight ? `${sideBySideHeight}px` : 'auto')) } : {}}>
    <div ref={videoColRef} style={isMobileLandscape ? { flex:`0 0 ${videoColPercent}%`, display:'flex', flexDirection:'column', minWidth:0, minHeight:0, height: 'var(--msSideBySideH)' } : {}}>
  {/* Shared Complete Lesson handler */}
  { /* define once; stable ref for consumers */ }
  {(() => { return null; })()}
  <VideoPanel
        isMobileLandscape={isMobileLandscape}
        isShortHeight={isShortHeight}
  videoMaxHeight={videoEffectiveHeight || videoMaxHeight}
        videoRef={videoRef}
        showBegin={showBegin}
        isSpeaking={isSpeaking}
        phase={phase}
  ticker={ticker}
    currentWorksheetIndex={currentWorksheetIndex}
        onBegin={beginSession}
        onBeginComprehension={beginComprehensionPhase}
        onBeginWorksheet={beginWorksheetPhase}
        onBeginTest={beginTestPhase}
        onBeginSkippedExercise={beginSkippedExercise}
        subPhase={subPhase}
        testCorrectCount={testCorrectCount}
        testFinalPercent={testFinalPercent}
        lessonParam={lessonParam}
        muted={muted}
        onToggleMute={toggleMute}
        onSkip={handleSkipSpeech}
  loading={loading}
  overlayLoading={overlayLoading}
        exerciseSkippedAwaitBegin={exerciseSkippedAwaitBegin}
        skipPendingLessonLoad={skipPendingLessonLoad}
  currentCompProblem={currentCompProblem}
  testActiveIndex={testActiveIndex}
  testList={Array.isArray(generatedTest) ? generatedTest : []}
        onCompleteLesson={onCompleteLesson}
        sessionTimerMinutes={sessionTimerMinutes}
        timerPaused={timerPaused}
        calculateLessonProgress={calculateLessonProgress}
        handleTimeUp={handleTimeUp}
        handleTimerPauseToggle={handleTimerPauseToggle}
        showRepeatButton={showRepeatButton}
        handleRepeatSpeech={handleRepeatSpeech}
      />
      {/* Worksheet end-of-phase Review button removed per requirements */}
    </div>
  <div ref={captionColRef} style={(() => {
        const showScrollable = (phase === 'congrats') || (phase === 'test' && typeof subPhase === 'string' && subPhase.startsWith('review'));
        if (isMobileLandscape) {
          return {
            flex: `0 0 ${Math.max(0, 100 - videoColPercent)}%`,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: showScrollable ? 'auto' : 'hidden',
            height: 'var(--msSideBySideH)',
            maxHeight: 'var(--msSideBySideH)',
            position: 'relative',
            '--msSideBySideH': (videoEffectiveHeight ? `${videoEffectiveHeight}px` : (sideBySideHeight ? `${sideBySideHeight}px` : 'auto')),
          };
        }
        if (stackedCaptionHeight) {
          return {
            maxHeight: stackedCaptionHeight,
            height: stackedCaptionHeight,
            overflowY: showScrollable ? 'auto' : 'hidden',
            marginTop: 8,
            paddingLeft: '4%',
            paddingRight: '4%',
          };
        }
        return { paddingLeft: '4%', paddingRight: '4%', position: 'relative' };
      })()}>
      {(phase === 'test' && typeof subPhase === 'string' && subPhase.startsWith('review')) ? (
        (() => {
          const list = Array.isArray(generatedTest) ? generatedTest : [];
          const answers = Array.isArray(testUserAnswers) ? testUserAnswers : [];
          const correctness = Array.isArray(testCorrectByIndex) ? testCorrectByIndex : [];
          const total = list.length;
          const correct = correctness.filter(Boolean).length;
          const percent = typeof testFinalPercent === 'number' ? testFinalPercent : Math.round((correct/Math.max(1,total))*100);
          const tier = tierForPercent(percent);
          const medal = tier ? emojiForTier(tier) : '';
          const badge = (ok) => ({
            display:'inline-block', padding:'2px 8px', borderRadius:999, fontWeight:800, fontSize:12,
            background: ok ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
            color: ok ? '#065f46' : '#7f1d1d', border: `1px solid ${ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`
          });
          const btn = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'6px 10px', fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 2px 6px rgba(0,0,0,0.18)' };
          const card = { background:'#ffffff', border:'1px solid #e5e7eb', borderRadius:12, padding:16, boxShadow:'0 2px 10px rgba(0,0,0,0.04)'};
          const askOverride = async (i) => {
            const ok = await ensurePinAllowed('facilitator');
            if (!ok) return;
            // Toggle correctness and recompute
            setTestCorrectByIndex((prev) => {
              const a = Array.isArray(prev) ? prev.slice() : [];
              a[i] = !a[i];
              return a;
            });
          };
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:12, overflow:'visible', paddingTop:8, paddingBottom:8 }}>
              <div style={{ ...card, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, position:'sticky', top:0, zIndex:5, background:'#ffffff' }}>
                <div style={{ fontSize:'clamp(1.1rem, 2.4vw, 1.4rem)', fontWeight:800, color:'#065f46' }}>
                  {percent}% grade
                </div>
                <div style={{ fontSize: 'clamp(1.2rem, 2.6vw, 1.5rem)' }} aria-label="Medal preview">{medal}</div>
              </div>
              {/* No in-pane Complete action; final red button appears in footer after congrats speech */}
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {list.map((q, i) => {
                  const ok = !!correctness[i];
                  const num = i + 1;
                  const stem = formatQuestionForInlineAsk(q);
                  const ans = answers[i] || '';
                  // Resolve an expected answer string for display (best-effort)
                  const expectedText = (() => {
                    try {
                      const exp = (typeof q?.expected === 'string' && q.expected.trim()) ? q.expected.trim()
                        : (Array.isArray(q?.expectedAny) && q.expectedAny.length ? String(q.expectedAny[0]).trim()
                          : (typeof q?.answer === 'string' ? q.answer.trim() : ''));
                      return exp || '';
                    } catch { return ''; }
                  })();
                  return (
                    <div key={i} style={card}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12 }}>
                        <div style={{ fontWeight:800 }}>Question {num}</div>
                        <span style={badge(ok)}>{ok ? 'correct' : 'incorrect'}</span>
                      </div>
                      <div style={{ marginTop:8, color:'#111827', fontWeight:600 }}>{stem}</div>
                      <div style={{ marginTop:6, color:'#374151' }}>
                        <span style={{ fontWeight:700 }}>Your answer:</span> {ans || <em style={{ color:'#6b7280' }}>No answer</em>}
                      </div>
                      {expectedText ? (
                        <div style={{ marginTop:4, color:'#4b5563' }}>
                          <span style={{ fontWeight:700 }}>Expected answer:</span> {expectedText}
                        </div>
                      ) : null}
                      <div style={{ marginTop:10 }}>
                        <button type="button" style={btn} onClick={() => askOverride(i)}>Facilitator override</button>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ height:8 }} />
            </div>
          );
        })()
      ) : (
        <CaptionPanel
          sentences={captionSentences}
          activeIndex={captionIndex}
          boxRef={captionBoxRef}
          scaleFactor={snappedScale}
          compact={isMobileLandscape}
          fullHeight={isMobileLandscape && !!(sideBySideHeight || videoMaxHeight)}
          stackedHeight={(!isMobileLandscape && stackedCaptionHeight) ? stackedCaptionHeight : null}
          phase={phase}
          vocabTerms={vocabTermsForHighlight}
        />
      )}
    </div>
  </div>
        </div>
      </div>

  {/* End scroll content area before fixed footer */}
  </div> {/* end inner band */}
  </div> {/* end content wrapper */}
  </div> {/* end width-matched wrapper */}
  </div> {/* end scroll container */}

  {/* Fixed footer with input controls (downloads removed) */}
      <div ref={footerRef} style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 999, background: '#ffffff', borderTop: '1px solid #e5e7eb', boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
      {/* Footer padding: default 4px, reduce to 2px when short-height AND landscape. Add horizontal inset when controls are relocated to footer. */}
      <div
        aria-hidden={overlayLoading ? true : undefined}
        style={{
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          padding: (isShortHeight && isMobileLandscape) ? '2px 16px calc(2px + env(safe-area-inset-bottom, 0px))' : '4px 12px calc(4px + env(safe-area-inset-bottom, 0px))',
          // Prevent initial flicker: hide footer contents while the loading overlay is visible
          opacity: overlayLoading ? 0 : 1,
          pointerEvents: overlayLoading ? 'none' : 'auto',
          transition: 'opacity 120ms linear'
        }}
      >
        {/* Global Resume/Restart tray after a restore (visible across viewport sizes). While shown, hide other footer controls to avoid conflicts. */}
        {offerResume && (
          <div style={{
            maxWidth: 900,
            margin: '4px auto 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            flexWrap: 'wrap'
          }}>
            <button type="button" onClick={handleResumeClick} style={{ padding: '8px 12px', background: '#c7442e', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
              Resume
            </button>
            <button type="button" onClick={handleRestartClick} style={{ padding: '8px 12px', background: '#111827', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer' }}>
              Restart
            </button>
          </div>
        )}
        {/* When Resume tray is visible, do not render any other footer controls */}
  {offerResume ? null : (<>
          {/* Begin CTA row */}
          {(() => {
            try {
              const needBeginDiscussion = (showBegin && phase === 'discussion');
              const needBeginComp = (phase === 'comprehension' && subPhase === 'comprehension-start');
              const needBeginExercise = (phase === 'exercise' && subPhase === 'exercise-awaiting-begin');
              const needBeginWorksheet = (phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin');
              const needBeginTest = (phase === 'test' && subPhase === 'test-awaiting-begin');
              if (!(needBeginDiscussion || needBeginComp || needBeginExercise || needBeginWorksheet || needBeginTest)) return null;
              const ctaStyle = { background:'#c7442e', color:'#fff', borderRadius:10, padding:'10px 18px', fontWeight:800, fontSize:'clamp(1rem, 2.6vw, 1.125rem)', border:'none', boxShadow:'0 2px 12px rgba(199,68,46,0.28)', cursor:'pointer' };
              const rowStyle = { display:'flex', alignItems:'center', justifyContent:'center', gap:12, paddingLeft:12, paddingRight:12, marginBottom:4 };
              return (
                <div style={rowStyle}>
                  {needBeginDiscussion && (
                    <button type="button" style={ctaStyle} onClick={beginSession}>Begin</button>
                  )}
                  {needBeginComp && (
                    <button type="button" style={ctaStyle} onClick={beginComprehensionPhase}>Begin Comprehension</button>
                  )}
                  {needBeginExercise && (
                    <button type="button" style={ctaStyle} onClick={beginSkippedExercise}>Begin Exercise</button>
                  )}
                  {needBeginWorksheet && (
                    <button type="button" style={ctaStyle} onClick={beginWorksheetPhase}>Begin Worksheet</button>
                  )}
                  {needBeginTest && (
                    <button type="button" style={ctaStyle} onClick={beginTestPhase}>Begin Test</button>
                  )}
                </div>
              );
            } catch {}
            return null;
          })()}

          {/* Review footer row: Submit during Test review (only when not using the short-height relocated controls) */}
          {(() => {
            try {
              const inReview = (phase === 'test' && typeof subPhase === 'string' && subPhase.startsWith('review'));
              if (!inReview) return null;
              if (isShortHeight) return null; // submit appears in the relocated controls for short-height
          
              const disabled = !!isSpeaking;
              const btnStyle = { background:'#c7442e', color:'#fff', borderRadius:10, padding:'10px 18px', fontWeight:800, fontSize:'clamp(1rem, 2.2vw, 1.125rem)', border:'none', boxShadow:'0 2px 12px rgba(199,68,46,0.28)', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 };
              return (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, padding:'6px 12px' }}>
                  <button type="button" aria-label="Submit" title="Submit" disabled={disabled} style={btnStyle} onClick={disabled ? undefined : finalizeReview}>Submit</button>
                </div>
              );
            } catch { return null; }
          })()}

          {/* Congrats footer row with Complete Lesson and medal (only after congrats TTS finishes) */}
          {(() => {
            if (phase !== 'congrats') return null;
            if (!congratsDone) return null;
            const percent = typeof testFinalPercent === 'number' ? testFinalPercent : null;
            const tier = (percent != null) ? tierForPercent(percent) : null;
            const medal = tier ? emojiForTier(tier) : '';
            const btnStyle = { background:'#c7442e', color:'#fff', borderRadius:10, padding:'10px 18px', fontWeight:800, fontSize:'clamp(1rem, 2.2vw, 1.125rem)', border:'none', boxShadow:'0 2px 12px rgba(199,68,46,0.28)', cursor:'pointer' };
            return (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14, padding:'6px 12px' }}>
                <button type="button" style={btnStyle} onClick={() => {
                  try { onCompleteLesson && onCompleteLesson(); } catch {}
                }}>Complete Lesson</button>
                <div aria-label="Medal" style={{ fontSize:'clamp(1.2rem, 2.4vw, 1.5rem)' }}>{medal}</div>
              </div>
            );
          })()}

          {/* Discussion post-Opening actions: show after Opening audio ends */}
          {(() => {
            try {
              const canShow = (
                phase === 'discussion' &&
                subPhase === 'awaiting-learner' &&
                (!isSpeaking || captionsDone) &&
                showOpeningActions &&
                askState === 'inactive' &&
                riddleState === 'inactive' &&
                poemState === 'inactive' &&
                storyState === 'inactive' &&
                fillInFunState === 'inactive'
              );
              if (!canShow) return null;
              const wrap = { display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap', gap:8, padding:'6px 12px' };
              const btn = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
              const goBtn = { ...btn, background:'#c7442e', boxShadow:'0 2px 12px rgba(199,68,46,0.28)' };
              const disabledBtn = { ...btn, opacity:0.5, cursor:'not-allowed' };
              
              // Poem/Story require an active golden key on this lesson
              const poemDisabled = poemUsedThisGate || !goldenKeyFeaturesAllowed;
              const storyDisabled = storyUsedThisGate || !goldenKeyFeaturesAllowed;
              
              return (
                <div style={wrap} aria-label="Opening actions">
                  <button type="button" style={btn} onClick={getAskButtonHandler(handleAskQuestionStart)}>Ask</button>
                  <button type="button" style={jokeUsedThisGate ? disabledBtn : btn} onClick={jokeUsedThisGate ? undefined : handleTellJoke} disabled={jokeUsedThisGate}> Joke</button>
                  <button type="button" style={riddleUsedThisGate ? disabledBtn : btn} onClick={riddleUsedThisGate ? undefined : handleTellRiddle} disabled={riddleUsedThisGate}>Riddle</button>
                  <button type="button" style={poemDisabled ? disabledBtn : btn} onClick={poemDisabled ? undefined : handlePoemStart} disabled={poemDisabled} title={!goldenKeyFeaturesAllowed ? 'Use a Golden Key to unlock' : undefined}>Poem</button>
                  <button type="button" style={storyDisabled ? disabledBtn : btn} onClick={storyDisabled ? undefined : handleStoryStart} disabled={storyDisabled} title={!goldenKeyFeaturesAllowed ? 'Use a Golden Key to unlock' : undefined}>Story</button>
                  <button type="button" style={fillInFunUsedThisGate ? disabledBtn : btn} onClick={fillInFunUsedThisGate ? undefined : handleFillInFunStart} disabled={fillInFunUsedThisGate}>Fill-in-Fun</button>
                  <button type="button" style={goBtn} onClick={lessonData ? handleStartLesson : undefined} disabled={!lessonData} title={lessonData ? undefined : 'Loading lesson�'}>Go</button>
                </div>
              );
            } catch {}
            return null;
          })()}

          {/* Q&A phases Opening actions: show after phase intro ends */}
          {(() => {
            try {
              const inQnA = (
                (phase === 'comprehension' && subPhase === 'comprehension-active') ||
                (phase === 'exercise' && subPhase === 'exercise-start') ||
                (phase === 'worksheet' && subPhase === 'worksheet-active') ||
                (phase === 'test' && subPhase === 'test-active')
              );
              const canShow = (
                inQnA && !isSpeaking && showOpeningActions && askState === 'inactive' && riddleState === 'inactive' && poemState === 'inactive' && storyState === 'inactive' && fillInFunState === 'inactive'
              );
              if (!canShow) return null;
              const wrap = { display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap', gap:8, padding:'6px 12px' };
              const btn = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
              const goBtn = { ...btn, background:'#c7442e', boxShadow:'0 2px 12px rgba(199,68,46,0.28)' };
              const disabledBtn = { ...btn, opacity:0.5, cursor:'not-allowed' };
              // Phase-specific Go: trigger the first question for the active phase
              const onGo = !lessonData ? undefined : (
                phase === 'comprehension' ? handleGoComprehension :
                phase === 'exercise' ? handleGoExercise :
                phase === 'worksheet' ? handleGoWorksheet :
                phase === 'test' ? handleGoTest :
                handleStartLesson
              );
              
              // Poem/Story require an active golden key on this lesson
              const poemDisabled = poemUsedThisGate || !goldenKeyFeaturesAllowed;
              const storyDisabled = storyUsedThisGate || !goldenKeyFeaturesAllowed;
              
              return (
                <div style={wrap} aria-label="Phase opening actions">
                  <button type="button" style={btn} onClick={getAskButtonHandler(handleAskQuestionStart)}>Ask</button>
                  <button type="button" style={jokeUsedThisGate ? disabledBtn : btn} onClick={jokeUsedThisGate ? undefined : handleTellJoke} disabled={jokeUsedThisGate}> Joke</button>
                  <button type="button" style={riddleUsedThisGate ? disabledBtn : btn} onClick={riddleUsedThisGate ? undefined : handleTellRiddle} disabled={riddleUsedThisGate}>Riddle</button>
                  <button type="button" style={poemDisabled ? disabledBtn : btn} onClick={poemDisabled ? undefined : handlePoemStart} disabled={poemDisabled} title={!goldenKeyFeaturesAllowed ? 'Use a Golden Key to unlock' : undefined}>Poem</button>
                  <button type="button" style={storyDisabled ? disabledBtn : btn} onClick={storyDisabled ? undefined : handleStoryStart} disabled={storyDisabled} title={!goldenKeyFeaturesAllowed ? 'Use a Golden Key to unlock' : undefined}>Story</button>
                  <button type="button" style={fillInFunUsedThisGate ? disabledBtn : btn} onClick={fillInFunUsedThisGate ? undefined : handleFillInFunStart} disabled={fillInFunUsedThisGate}>Fill-in-Fun</button>
                  <button type="button" style={goBtn} onClick={onGo} disabled={!lessonData} title={lessonData ? undefined : 'Loading lesson�'}>Go</button>
                </div>
              );
            } catch {}
            return null;
          })()}

          {/* Ask-a-question confirmation row (inside fixed footer) */}
          {askState === 'awaiting-confirmation' && (() => {
            const wrap = { display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'6px 12px', flexWrap:'wrap' };
            const btnBase = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
            const backBtn = { ...btnBase, background:'#374151' };
            return (
              <div style={wrap} aria-label="Ask confirmation: ask another or go back">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button type="button" style={btnBase} onClick={handleAskAnother}>Ask</button>
                  <button type="button" style={backBtn} onClick={handleAskBack}>Back</button>
                </div>
              </div>
            );
          })()}

          {/* Poem action buttons: Suggestions, Ok, and Back */}
          {(() => {
            try {
              const active = (poemState === 'awaiting-topic' || poemState === 'awaiting-ok');
              if (!active) return null;
              const wrap = { display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'6px 12px', flexWrap:'wrap' };
              const btnBase = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
              const backBtn = { ...btnBase, background:'#374151' };
              return (
                <div style={wrap} aria-label="Poem actions">
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {poemState === 'awaiting-topic' && showPoemSuggestions && (
                      <button type="button" style={btnBase} onClick={handlePoemSuggestions}>Suggestions</button>
                    )}
                    {poemState === 'awaiting-ok' && (
                      <button type="button" style={btnBase} onClick={handlePoemOk}>Ok</button>
                    )}
                    <button type="button" style={backBtn} onClick={handlePoemBack}>Back</button>
                  </div>
                </div>
              );
            } catch {}
            return null;
          })()}

          {/* Fill-in-Fun action buttons: Ok and Back */}
          {(() => {
            try {
              const active = (fillInFunState === 'collecting-words' || fillInFunState === 'awaiting-ok');
              if (!active) return null;
              const wrap = { display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'6px 12px', flexWrap:'wrap' };
              const btnBase = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
              const backBtn = { ...btnBase, background:'#374151' };
              return (
                <div style={wrap} aria-label="Fill-in-Fun actions">
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {fillInFunState === 'awaiting-ok' && (
                      <button type="button" style={btnBase} onClick={handleFillInFunOk}>Ok</button>
                    )}
                    <button type="button" style={backBtn} onClick={handleFillInFunBack}>Back</button>
                  </div>
                </div>
              );
            } catch {}
            return null;
          })()}

          {/* Story back button: shows during story setup and continuation */}
          {(() => {
            try {
              const active = (storyState === 'awaiting-setup' || storyState === 'awaiting-turn');
              if (!active) return null;
              const wrap = { display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'6px 12px', flexWrap:'wrap' };
              const backBtn = { background:'#374151', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
              return (
                <div style={wrap} aria-label="Story actions">
                  <button type="button" style={backBtn} onClick={handleStoryBack}>Back</button>
                </div>
              );
            } catch {}
            return null;
          })()}

          {/* Riddle action row (inside fixed footer) */}
          {(() => {
            try {
              // Show riddle controls whenever a riddle is active, regardless of phase/subPhase
              // (previously gated to discussion/awaiting-learner, which hid buttons after the riddle was read)
              const active = (riddleState && riddleState !== 'inactive');
              if (!active) return null;
              const wrap = { display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'6px 12px', flexWrap:'wrap' };
              const btnBase = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
              const backBtn = { ...btnBase, background:'#374151' };
              const hintBtn = { ...btnBase, background:'#b45309' };
              const answerBtn = { ...btnBase, background:'#374151' };
              return (
                <div style={wrap} aria-label="Riddle actions">
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button type="button" style={hintBtn} onClick={requestRiddleHint}>Hint</button>
                    <button type="button" style={answerBtn} onClick={revealRiddleAnswer}>Give me the answer</button>
                    <button type="button" style={backBtn} onClick={handleRiddleBack}>Back</button>
                  </div>
                </div>
              );
            } catch {}
            return null;
          })()}

          {/* Quick-answer buttons row (appears above input when a TF/MC item is active).
              Also renders gate Repeat Vocab/Examples and Next during teaching awaiting-gate.
              Suppressed on short-height when controls are already in this row.
              Now gated behind Start the lesson: hidden until qaAnswersUnlocked is true. */}
          {(() => {
            try {
              // Show teaching gate Repeat Vocab/Examples and Next when awaiting-gate; hide while speaking
              if (phase === 'teaching' && subPhase === 'awaiting-gate' && !isSpeaking && askState === 'inactive') {
                const containerStyle = {
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8,
                  paddingLeft: isMobileLandscape ? 12 : '4%', paddingRight: isMobileLandscape ? 12 : '4%', marginBottom: 6,
                };
                const btnBase = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, minWidth:56, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 2px 6px rgba(0,0,0,0.18)' };
                // Button labels: "Repeat Sentence"/"Next Sentence" during sentence navigation, "Restart Vocab"/"Next: Examples" at final gate
                let repeatLabel = 'Restart Vocab';
                let nextLabel = 'Next: Examples';
                console.log('[Gate Button 2] teachingStage:', teachingStage, 'isInSentenceMode:', isInSentenceMode);
                if (teachingStage === 'examples') {
                  repeatLabel = 'Repeat Examples';
                  nextLabel = 'Next';
                } else if (teachingStage === 'definitions' && isInSentenceMode) {
                  repeatLabel = 'Repeat Sentence';
                  nextLabel = 'Next Sentence';
                  console.log('[Gate Button 2] Setting labels to "Repeat Sentence"/"Next Sentence" for sentence mode');
                }
                const ariaLabel = teachingStage === 'examples' ? 'Teaching gate: repeat examples or move to next stage' : 'Teaching gate: repeat vocab or move to next stage';
                if (isShortHeight) return null; // already rendered in controls row above
                return (
                  <div style={containerStyle} aria-label={ariaLabel}>
                    <button type="button" style={btnBase} onClick={handleGateYes}>{repeatLabel}</button>
                    <button type="button" style={btnBase} onClick={handleGateNo}>{nextLabel}</button>
                    <button
                      type="button"
                      style={{ ...btnBase, minWidth: 160, background: '#374151', opacity: (askState !== 'inactive') ? 0.6 : 1, cursor: (askState !== 'inactive') ? 'not-allowed' : 'pointer' }}
                      onClick={askState === 'inactive' ? getAskButtonHandler(handleAskQuestionStart) : undefined}
                    >Ask</button>
                  </div>
                );
              }
              // In Q&A phases, do not show quick-answer buttons until Start the lesson is pressed
              const isQnAPhase = (
                phase === 'comprehension' || phase === 'exercise' || phase === 'worksheet' || phase === 'test'
              );
              if (isQnAPhase && !qaAnswersUnlocked) return null;
              // Hide while Ask flow is active to avoid overlapping controls
              if (askState !== 'inactive') return null;
              if (sendDisabled) return null; // respect gating otherwise
              if (isShortHeight) {
                // When short, quick answers render inline with the controls row above.
                // Also skip if a Begin row is present (no active question yet).
                const needBeginDiscussion = (showBegin && phase === 'discussion');
                const needBeginComp = (phase === 'comprehension' && subPhase === 'comprehension-start');
                const needBeginExercise = (phase === 'exercise' && subPhase === 'exercise-awaiting-begin');
                const needBeginWorksheet = (phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin');
                const needBeginTest = (phase === 'test' && subPhase === 'test-awaiting-begin');
                const anyBegin = needBeginDiscussion || needBeginComp || needBeginExercise || needBeginWorksheet || needBeginTest;
                if (anyBegin) return null; // hide during Begin overlays; show during active questions
              }
              // Determine the currently active question across phases
              let active = null;
              if (phase === 'comprehension') {
                active = currentCompProblem || null;
              } else if (phase === 'exercise') {
                active = currentExerciseProblem || null;
              } else if (phase === 'worksheet' && subPhase === 'worksheet-active') {
                const idx = (typeof worksheetIndexRef !== 'undefined' && worksheetIndexRef && typeof worksheetIndexRef.current === 'number')
                  ? (worksheetIndexRef.current ?? 0)
                  : (typeof currentWorksheetIndex === 'number' ? currentWorksheetIndex : 0);
                const list = Array.isArray(generatedWorksheet) ? generatedWorksheet : [];
                active = list[idx] || null;
              } else if (phase === 'test' && subPhase === 'test-active') {
                const list = Array.isArray(generatedTest) ? generatedTest : [];
                const idx = (typeof testActiveIndex === 'number' ? testActiveIndex : 0);
                active = list[idx] || null;
              }
              if (!active) return null;

              const choiceCount = Array.isArray(active.choices) && active.choices.length
                ? active.choices.length
                : (Array.isArray(active.options) ? active.options.length : 0);

              const containerStyle = {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: 8,
                // Align with video gutters in portrait
                paddingLeft: isMobileLandscape ? 12 : '4%',
                paddingRight: isMobileLandscape ? 12 : '4%',
                marginBottom: 6,
              };
              const btnBase = {
                background: '#1f2937',
                color: '#fff',
                borderRadius: 8,
                padding: '8px 12px',
                minHeight: 40,
                minWidth: 56,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.18)'
              };

              const isTF = isTrueFalse(active);
              if (isTF) {
                return (
                  <div style={containerStyle} aria-label="Quick answer: true or false">
                    <button type="button" style={btnBase} onClick={() => handleSend('true')}>True</button>
                    <button type="button" style={btnBase} onClick={() => handleSend('false')}>False</button>
                    <button
                      type="button"
                      style={{ ...btnBase, minWidth: 100, background: '#374151', opacity: (askState !== 'inactive') ? 0.6 : 1, cursor: (askState !== 'inactive') ? 'not-allowed' : 'pointer' }}
                      onClick={askState === 'inactive' ? getAskButtonHandler(handleAskQuestionStart) : undefined}
                    >Ask</button>
                  </div>
                );
              }

              // Treat as multiple choice if tagged 'mc' or has discrete options/choices
              const isMC = isMultipleChoice(active) || (choiceCount >= 2);
              if (isMC) {
                const count = Math.min(4, Math.max(2, choiceCount || 4));
                const letters = ['A','B','C','D'].slice(0, count);
                return (
                  <div style={containerStyle} aria-label="Quick answer: multiple choice">
                    {letters.map((L) => (
                      <button key={L} type="button" style={btnBase} onClick={() => handleSend(L)}>{L}</button>
                    ))}
                    <button
                      type="button"
                      style={{ ...btnBase, minWidth: 100, background: '#374151', opacity: (askState !== 'inactive') ? 0.6 : 1, cursor: (askState !== 'inactive') ? 'not-allowed' : 'pointer' }}
                      onClick={askState === 'inactive' ? getAskButtonHandler(handleAskQuestionStart) : undefined}
                    >Ask</button>
                  </div>
                );
              }

              // Short-answer or fill-in-the-blank: show Ask-only button
              return (
                <div style={containerStyle} aria-label="Ask about the current question">
                  <button
                    type="button"
                    style={{ ...btnBase, minWidth: 120, background: '#374151', opacity: (askState !== 'inactive') ? 0.6 : 1, cursor: (askState !== 'inactive') ? 'not-allowed' : 'pointer' }}
                    onClick={askState === 'inactive' ? getAskButtonHandler(handleAskQuestionStart) : undefined}
                  >Ask</button>
                </div>
              );
            } catch {}
            return null;
          })()}
          <InputPanel
            learnerInput={learnerInput}
            setLearnerInput={setLearnerInput}
            sendDisabled={sendDisabled}
            canSend={canSend}
            loading={loading}
            abortKey={abortKey}
            showBegin={showBegin}
            isSpeaking={isSpeaking}
            phase={phase}
            subPhase={subPhase}
            currentCompProblem={currentCompProblem}
            teachingStage={teachingStage}
            isInSentenceMode={isInSentenceMode}
            tipOverride={tipOverride}
            onSend={handleSend}
            compact={isMobileLandscape}
            hotkeys={hotkeys}
            showOpeningActions={showOpeningActions}
            askState={askState}
            riddleState={riddleState}
            poemState={poemState}
            storyState={storyState}
            fillInFunState={fillInFunState}
          />
        </>)}
        </div>
      </div>
  {/* Intentionally nothing rendered below the fixed footer */}
        {/* Close outer viewport container */}
      </div>
    
    {/* Lesson Quota Gate Overlay - moved outside position:relative containers */}
    {showQuotaGate && (
      <GatedOverlay
        show={showQuotaGate}
        onClose={() => setShowQuotaGate(false)}
        gateType="tier"
        feature="More Lessons Today"
        emoji="📚"
        description={`You've used ${quotaGateInfo.limit} of ${quotaGateInfo.limit} lessons today on your ${quotaGateInfo.tier} plan.`}
        benefits={[
          'Upgrade to Basic for 5 lessons per day',
          'Upgrade to Plus for unlimited lessons',
          'Upgrade to Premium for unlimited lessons + 10 learners'
        ]}
        requiredTier="basic"
      />
    )}
    
    {/* Ask Feature Gate Overlay - for demo lessons */}
    {showAskGate && (
      <GatedOverlay
        show={showAskGate}
        onClose={() => setShowAskGate(false)}
        gateType="tier"
        feature="Ask Questions"
        emoji="💬"
        description="Ask Ms. Sonoma questions about the lesson to get personalized help and deeper understanding."
        benefits={[
          'Ask questions during any lesson',
          'Get instant answers from Ms. Sonoma',
          'Available on Basic plan and higher'
        ]}
        requiredTier="basic"
      />
    )}
    </>
  );
}



const primaryButtonStyle = {
  background: "#1f2937",
  color: "#fff",
  borderRadius: 8,
  padding: "8px 12px",
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};

function Timeline({ timelinePhases, timelineHighlight, compact = false, onJumpPhase }) {
  const columns = Array.isArray(timelinePhases) && timelinePhases.length > 0 ? timelinePhases.length : 5;
  const gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
  const containerRef = useRef(null);
  const [labelFontSize, setLabelFontSize] = useState('1rem');

  // Compute a shared font size so the longest label fits within a single column
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

  const BASE = 16; // px for measurement
  const MIN = 12;  // px - keep readable on small screens
  const MAX = 20;  // px - permit larger labels on wider screens
    const PADDING_X = 18 * 2 + 4; // left+right padding plus a little slack for borders

    const labels = (Array.isArray(timelinePhases) ? timelinePhases : []).map(k => String(phaseLabels[k] || ''));
    if (!labels.length) return;

    const compute = () => {
      const totalWidth = el.clientWidth || 0;
  if (totalWidth <= 0) { setLabelFontSize('1rem'); return; }
      const colWidth = totalWidth / columns;
      const available = Math.max(0, colWidth - PADDING_X);

      // Build a hidden measurer span to measure widths at BASE size and bold weight (worst case)
      const meas = document.createElement('span');
      meas.style.position = 'fixed';
      meas.style.left = '-99999px';
      meas.style.top = '0';
      meas.style.whiteSpace = 'nowrap';
      meas.style.visibility = 'hidden';
      const cs = window.getComputedStyle(el);
      meas.style.fontFamily = cs.fontFamily || 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
      meas.style.fontWeight = '700'; // measure bold to avoid overflow when highlighted
      meas.style.fontSize = `${BASE}px`;
      document.body.appendChild(meas);
      let maxLabelWidth = 0;
      for (const text of labels) {
        meas.textContent = text;
        const w = meas.getBoundingClientRect().width;
        if (w > maxLabelWidth) maxLabelWidth = w;
      }
      document.body.removeChild(meas);

  if (maxLabelWidth <= 0 || available <= 0) { setLabelFontSize('1rem'); return; }
      const scale = Math.min(1, available / maxLabelWidth);
  const next = Math.max(MIN, Math.min(MAX, Math.floor(BASE * scale)));
  // Map px -> rem using current root font-size for consistent scaling
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const nextRem = Math.max(0.5, next / rootPx);
  setLabelFontSize(`${nextRem}rem`);
    };

    // Initial compute + observe container size changes
    compute();
    const ro = new ResizeObserver(() => compute());
    try { ro.observe(el); } catch {}
    // Recompute on window orientation changes
    const onResize = () => compute();
    window.addEventListener('resize', onResize);
    return () => {
      try { ro.disconnect(); } catch {}
      window.removeEventListener('resize', onResize);
    };
  }, [timelinePhases, columns]);

  return (
  <div ref={containerRef} style={{ display: "grid", gridTemplateColumns, gap: 'clamp(0.25rem, 0.8vw, 0.5rem)', marginBottom: compact ? 'clamp(0.125rem, 0.6vw, 0.25rem)' : 'clamp(0.25rem, 1vw, 0.625rem)', width: '100%', minWidth: 0, position: 'relative', zIndex: 9999, padding: 'clamp(0.125rem, 0.6vw, 0.375rem)', boxSizing: 'border-box' }}>
      {timelinePhases.map((phaseKey) => (
        <div
          key={phaseKey}
          onClick={onJumpPhase ? () => onJumpPhase(phaseKey) : undefined}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            boxSizing: 'border-box',
            padding: compact ? 'clamp(3px, 0.6vw, 6px) clamp(8px, 1.4vw, 12px)' : 'clamp(6px, 1vw, 10px) clamp(14px, 2vw, 18px)',
            borderRadius: 12,
            background: timelineHighlight === phaseKey ? "#c7442e" : "#e5e7eb",
            color: timelineHighlight === phaseKey ? "#fff" : "#374151",
            fontWeight: timelineHighlight === phaseKey ? 700 : 500,
            boxShadow: timelineHighlight === phaseKey ? "0 0 0 3px #c7442e, 0 2px 8px #c7442e" : undefined,
            border: "2px solid transparent",
            // Responsive label typography
            fontSize: labelFontSize,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            cursor: onJumpPhase ? 'pointer' : 'default',
            userSelect: 'none',
            transition: 'background 120ms ease, transform 120ms ease',
            ...(onJumpPhase ? {':hover': {}} : {})
          }}
        >
          {phaseLabels[phaseKey]}
        </div>
      ))}
    </div>
  );
}

function VideoPanel({ isMobileLandscape, isShortHeight, videoMaxHeight, videoRef, showBegin, isSpeaking, onBegin, onBeginComprehension, onBeginWorksheet, onBeginTest, onBeginSkippedExercise, phase, subPhase, ticker, currentWorksheetIndex, testCorrectCount, testFinalPercent, lessonParam, muted, onToggleMute, onSkip, loading, overlayLoading, exerciseSkippedAwaitBegin, skipPendingLessonLoad, currentCompProblem, onCompleteLesson, testActiveIndex, testList, sessionTimerMinutes, timerPaused, calculateLessonProgress, handleTimeUp, handleTimerPauseToggle, showRepeatButton, handleRepeatSpeech }) {
  // Reduce horizontal max width in mobile landscape to shrink vertical footprint (height scales with width via aspect ratio)
  // Remove horizontal clamp: let the video occupy the full available width of its column
  const containerMaxWidth = 'none';
  const dynamicHeightStyle = (isMobileLandscape && videoMaxHeight) ? { maxHeight: videoMaxHeight, height: videoMaxHeight, minHeight: 0 } : {};
  // Responsive control sizing: derive a target size from container width via CSS clamp.
  // We'll expose a CSS variable --ctrlSize and reuse for skip + play/pause/mute for symmetry.
  const controlClusterStyle = {
    position: 'absolute',
    bottom: 16,
    right: 16,
    display: 'flex',
    gap: 12,
    zIndex: 10,
    // size calculation moved to child buttons via CSS var
  };
  const controlButtonBase = {
    background: '#1f2937',
    color: '#fff',
    border: 'none',
    width: 'var(--ctrlSize)',
    height: 'var(--ctrlSize)',
    display: 'grid',
    placeItems: 'center',
    borderRadius: '50%',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
  };
  // Begin overlays removed. Keep controls always enabled.
  const atPhaseBegin = false;
  // Portrait refinement: instead of padding the outer wrapper, shrink the video width a bit so
  // the empty space on each side is symmetrical and the video remains visually centered.
  // We choose a slight shrink (e.g. 92%) to create subtle gutters. Landscape keeps full width.
  const outerWrapperStyle = { position: 'relative', margin: '0 auto', width: '100%' };

  // In portrait, interpolate height from 25svh at 1:1 to 35svh at 2:1 (height:width), clamped outside that range.
  const [portraitSvH, setPortraitSvH] = useState(35);
  useEffect(() => {
    const computePortraitHeight = () => {
      try {
        const w = Math.max(1, window.innerWidth || 1);
        const h = Math.max(1, window.innerHeight || 1);
        const ratio = h / w; // 1 => square; 2 => twice as tall as wide
        const t = Math.min(1, Math.max(0, (ratio - 1) / (2 - 1))); // 0..1 over [1,2]
  const svh = 35 - (10 * t); // 35..25
        setPortraitSvH(svh);
      } catch {}
    };
    if (!isMobileLandscape) {
      computePortraitHeight();
      window.addEventListener('resize', computePortraitHeight);
      window.addEventListener('orientationchange', computePortraitHeight);
      return () => {
        window.removeEventListener('resize', computePortraitHeight);
        window.removeEventListener('orientationchange', computePortraitHeight);
      };
    }
  }, [isMobileLandscape]);

  const innerVideoWrapperStyle = isMobileLandscape
    ? { position: 'relative', overflow: 'hidden', aspectRatio: '16 / 7.2', minHeight: 200, width: '100%', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000', '--ctrlSize': 'clamp(34px, 6.2vw, 52px)', ...dynamicHeightStyle }
    : { position: 'relative', overflow: 'hidden', height: `${portraitSvH}svh`, width: '92%', margin: '0 auto', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000', '--ctrlSize': 'clamp(34px, 6.2vw, 52px)' };
  return (
    <div style={outerWrapperStyle}>
      <div style={innerVideoWrapperStyle}>
        <video
          ref={videoRef}
          src="/media/ms-sonoma-3.mp4"
          muted
          loop
          playsInline
          preload="auto"
          onLoadedMetadata={() => {
            try {
              // Seek to first frame without pausing to keep video ready for immediate playback
              if (videoRef.current && videoRef.current.paused) {
                try { videoRef.current.currentTime = 0; } catch {}
              }
            } catch {}
          }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
        />
        {/* Session Timer - overlay in top left */}
        {sessionTimerMinutes > 0 && !showBegin && (
          <div style={{ 
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10001
          }}>
            <SessionTimer
              key={`timer-${sessionTimerMinutes}`}
              totalMinutes={sessionTimerMinutes}
              lessonProgress={calculateLessonProgress()}
              isPaused={timerPaused}
              onTimeUp={handleTimeUp}
              onPauseToggle={handleTimerPauseToggle}
            />
          </div>
        )}
        {/* No black screen during test */}
        {(phase === 'comprehension' || phase === 'exercise') && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(17,24,39,0.78)', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: 'clamp(0.85rem, 1.6vw, 1rem)', fontWeight: 600, letterSpacing: 0.3, boxShadow: '0 2px 6px rgba(0,0,0,0.25)', zIndex: 10000, pointerEvents: 'none' }}>
            {phase === 'comprehension' ? `${ticker}/${COMPREHENSION_TARGET}` : `${ticker}/${EXERCISE_TARGET}`}
          </div>
        )}
        {(phase === 'worksheet' && subPhase === 'worksheet-active') ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 32px', pointerEvents: 'none', textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(1.75rem, 4.2vw, 3.25rem)', fontWeight: 800, lineHeight: 1.18, color: '#ffffff', textShadow: '0 0 4px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.85), 0 4px 22px rgba(0,0,0,0.65)', letterSpacing: 0.5, fontFamily: 'Inter, system-ui, sans-serif', width: '100%' }}>
              <CurrentAssessmentPrompt phase={phase} subPhase={subPhase} testActiveIndex={testActiveIndex} testList={testList} />
            </div>
          </div>
        ) : null}
        {/* Ticker for worksheet/test phases rendered after prompt overlay to stay on top */}
        {((phase === 'worksheet' && subPhase === 'worksheet-active') || (phase === 'test' && subPhase === 'test-active')) && (
          <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(17,24,39,0.78)', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: 'clamp(0.85rem, 1.6vw, 1rem)', fontWeight: 600, letterSpacing: 0.3, boxShadow: '0 2px 6px rgba(0,0,0,0.25)', zIndex: 10000, pointerEvents: 'none' }}>
            {phase === 'worksheet' ? `Question ${Number((typeof currentWorksheetIndex === 'number' ? currentWorksheetIndex : 0) + 1)}` : `Question ${Number((typeof testActiveIndex === 'number' ? testActiveIndex : 0) + 1)}`}
          </div>
        )}
        {((phase === 'congrats') || (phase === 'test' && typeof subPhase === 'string' && subPhase.startsWith('review'))) && typeof testFinalPercent === 'number' && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(17,24,39,0.85)', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 'clamp(1rem, 2vw, 1.25rem)', fontWeight: 700, letterSpacing: 0.4, boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>Score: {testFinalPercent}%</div>
        )}
  {/* Ticker badges handled above for all phases */}
        {overlayLoading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 5, pointerEvents: 'none', background: 'rgba(0,0,0,0.38)', padding: '46px 50px', borderRadius: 160, backdropFilter: 'blur(2px)', boxShadow: '0 6px 28px rgba(0,0,0,0.45)' }}>
            <div className="ms-spinner-legacy" aria-hidden="true">
              <div className="ms-spinner" role="status" aria-label="Loading" />
            </div>
            <div style={{ color: '#fff', fontSize: 'clamp(0.95rem, 1.6vw, 1rem)', fontWeight: 600, letterSpacing: 0.5, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Loading...</div>
          </div>
        )}
        {/* Begin overlays removed intentionally */}
  {/* Primary control cluster (mute only; play/pause removed per request) */}
  <div style={controlClusterStyle}>
          <button type="button" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} style={controlButtonBase}>
            {muted ? (
              <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6" /><path d="M17 9l6 6" /></svg>
            ) : (
              <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19 8a5 5 0 010 8" /><path d="M15 11a2 2 0 010 2" /></svg>
            )}
          </button>
        </div>
        {/* Skip button when speaking */}
        {isSpeaking && typeof onSkip === 'function' && (
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip"
            title="Skip"
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              background: '#1f2937',
              color: '#fff',
              border: 'none',
              width: 'var(--ctrlSize)',
              height: 'var(--ctrlSize)',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              zIndex: 10
            }}
          >
            <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 4 15 12 5 20 5 4" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </button>
        )}
        {/* Repeat button when not speaking and audio available */}
        {!isSpeaking && showRepeatButton && (
          <button
            type="button"
            onClick={handleRepeatSpeech}
            aria-label="Repeat"
            title="Repeat"
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              background: '#1f2937',
              color: '#fff',
              border: 'none',
              width: 'var(--ctrlSize)',
              height: 'var(--ctrlSize)',
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              zIndex: 10
            }}
          >
            {/* Repeat icon: circular arrow */}
            <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 1v6h-6" />
              <path d="M7 23v-6h6" />
              <path d="M3.51 9a9 9 0 0114.13-3.36L17 7" />
              <path d="M20.49 15A9 9 0 015.36 18.36L7 17" />
            </svg>
          </button>
        )}
        {skipPendingLessonLoad && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(31,41,55,0.85)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 'clamp(0.75rem, 1.4vw, 0.9rem)', fontWeight: 600, letterSpacing: 0.4, boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>Loading lesson… skip will apply</div>
        )}
      </div>
    </div>
  );
}

// Helper component to extract current assessment question from global caption state via context-less DOM fallback
function CurrentAssessmentPrompt({ phase, subPhase, testActiveIndex, testList }) {
  // We will attempt to read window.__MS_CAPTIONS if exposed else fallback to scanning caption container.
  const [prompt, setPrompt] = useState('');
  useEffect(() => {
    const extract = () => {
      // Prefer authoritative local data for TEST overlay so numbering/choices are reliable
      try {
        if (phase === 'test' && subPhase === 'test-active' && Array.isArray(testList) && typeof testActiveIndex === 'number') {
          const idx = Math.max(0, Math.min(testList.length - 1, testActiveIndex));
          const q = testList[idx];
          if (q) {
            const number = `${idx + 1}. `;
            const stem = (q.prompt || q.question || q.text || '').toString().trim();
            const rawChoices = Array.isArray(q.choices) && q.choices.length ? q.choices : (Array.isArray(q.options) ? q.options : []);
            if (rawChoices && rawChoices.length) {
              const letters = ['A','B','C','D','E','F'];
              const parts = rawChoices.slice(0, 6).map((c, i) => `${letters[i]})\u00A0${String(c)}`);
              // Return structured payload so renderer can stack lines and keep pairs together
              return { number, stem, parts };
            }
            return { number, stem, parts: [] };
          }
        }
      } catch {}
      try {
        // Direct global if maintained
        if (window.__MS_CAPTION_SENTENCES && Array.isArray(window.__MS_CAPTION_SENTENCES)) {
          // For test, avoid using captions: handled above via local data.
          if (phase === 'worksheet' && subPhase === 'worksheet-active') {
            return window.__MS_CAPTION_SENTENCES[window.__MS_CAPTION_SENTENCES.length - 1] || '';
          }
        }
        // Fallback: query caption panel paragraphs
        const panel = document.querySelector('[data-ms-caption-panel]');
        if (panel) {
          const parts = Array.from(panel.querySelectorAll('p')).map(p => p.textContent.trim()).filter(Boolean);
          // For test, avoid using captions: handled above via local data.
          if (phase === 'worksheet' && subPhase === 'worksheet-active') return parts[parts.length - 1] || '';
        }
      } catch {}
      return '';
    };
    setPrompt(extract());
    const id = setInterval(() => setPrompt(extract()), 400); // lightweight poll to keep in sync
    return () => clearInterval(id);
  }, [phase, subPhase]);
  if (!prompt) return null;
  // If structured payload, render stacked with nowrap options
  if (typeof prompt === 'object' && prompt && 'number' in prompt) {
    const { number, stem, parts } = prompt;
    const children = [<span key="stem">{number}{stem}</span>];
    if (parts && parts.length) {
      parts.forEach((t, i) => {
        children.push(<br key={`br-${i}`} />);
        children.push(<span key={`opt-${i}`} style={{ whiteSpace: 'nowrap' }}>{enforceNbspAfterMcLabels(t)}</span>);
      });
    }
    return <span>{children}</span>;
  }
  // Fallback: plain string
  return <span>{String(prompt)}</span>;
}

function InputPanel({ learnerInput, setLearnerInput, sendDisabled, canSend, loading, onSend, showBegin, isSpeaking, phase, subPhase, tipOverride, abortKey, currentCompProblem, teachingStage, isInSentenceMode, compact = false, hotkeys, showOpeningActions, askState, riddleState, poemState, storyState, fillInFunState }) {
  const [focused, setFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const autoStopRef = useRef(null);
  const inputRef = useRef(null);
  // Track whether Numpad+ is currently held to avoid repeat triggers
  const hotkeyDownRef = useRef(false);
  // Track touch-hold lifecycle so we can start on touchstart and stop on touchend without triggering synthetic clicks
  const touchActiveRef = useRef(false);

  // Abort controller for STT fetch
  const sttAbortRef = useRef(null);

  const transcribeBlob = useCallback(async (blob) => {
    if (!blob) return;
    setUploading(true);
    setErrorMsg('');
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'input.webm');
      fd.append('language', 'en-US');
      const ctrl = new AbortController();
      sttAbortRef.current = ctrl;
      const res = await fetch('/api/stt', { method: 'POST', body: fd, signal: ctrl.signal });
      if (!res.ok) throw new Error(`STT failed ${res.status}`);
      const data = await res.json();
      const text = (data?.transcript || '').trim();
      if (text) {
        // Populate the input with the transcript; facilitator can edit/press Send
        setLearnerInput(text);
      } else {
        setErrorMsg('No speech detected');
      }
    } catch (e) {
      if (e?.name === 'AbortError') {
        console.warn('[STT] aborted');
        return;
      }
      console.warn('[STT] transcription failed', e);
      setErrorMsg('Transcription failed');
    } finally {
      setUploading(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (isRecording || uploading) return;
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      try { if (typeof window !== 'undefined') localStorage.setItem('ms_micAllowed', 'true'); } catch {}
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data); };
      // When recording actually starts, clear any existing typed text so mic can be used to retry without manual delete
      mr.onstart = () => {
        setIsRecording(true);
        try {
          if (typeof learnerInput === 'string' && learnerInput.trim().length > 0) {
            setLearnerInput('');
          }
        } catch {}
      };
      mr.onerror = (e) => { console.warn('[Mic] recorder error', e?.error || e); setIsRecording(false); setErrorMsg('Recording error'); };
      mr.onstop = async () => {
        try { stream.getTracks().forEach(tr => tr.stop()); } catch {}
        const out = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeBlob(out);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      autoStopRef.current = setTimeout(() => { try { mr.state !== 'inactive' && mr.stop(); } catch {} }, 30000);
    } catch (e) {
      console.warn('[Mic] getUserMedia failed', e);
      setErrorMsg('Mic permission denied');
      try {
        if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.name === 'NotFoundError')) {
          if (typeof window !== 'undefined') localStorage.setItem('ms_micAllowed', 'false');
        }
      } catch {}
    }
  }, [isRecording, uploading, transcribeBlob, learnerInput, setLearnerInput]);

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
    if (mr && mr.state !== 'inactive') {
      try { mr.stop(); } catch {}
    }
    setIsRecording(false);
  }, []);

  // Global hotkey: Hold configured key (default NumpadPlus) to record (keydown starts, keyup stops)
  useEffect(() => {
    const onKeyDown = (e) => {
      const code = e.code || e.key;
      const micCode = (hotkeys?.micHold || DEFAULT_HOTKEYS.micHold);
      if (!micCode || code !== micCode) return;
      // Prevent text input of '+' when we handle it
      e.preventDefault();
      if (hotkeyDownRef.current) return; // ignore auto-repeat
      hotkeyDownRef.current = true;
      if (!sendDisabled && !isRecording && !uploading) {
        startRecording();
      }
    };
    const onKeyUp = (e) => {
      const code = e.code || e.key;
      const micCode = (hotkeys?.micHold || DEFAULT_HOTKEYS.micHold);
      if (!micCode || code !== micCode) return;
      e.preventDefault();
      hotkeyDownRef.current = false;
      if (isRecording) {
        stopRecording();
      }
    };
    window.addEventListener('keydown', onKeyDown, { passive: false });
    window.addEventListener('keyup', onKeyUp, { passive: false });
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isRecording, uploading, sendDisabled, startRecording, stopRecording, hotkeys]);

  useEffect(() => () => {
    try { mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive' && mediaRecorderRef.current.stop(); } catch {}
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
  }, []);

  // Stop any in-progress mic/STT when abortKey changes (skip pressed)
  useEffect(() => {
    // Abort STT fetch
    try { if (sttAbortRef.current) sttAbortRef.current.abort('skip'); } catch {}
    // Stop recording if active
    try {
      // Clear any pending auto-stop timer so it doesn't try to stop again later
      if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    } catch {}
    setIsRecording(false);
    setUploading(false);
    setErrorMsg('');
  }, [abortKey]);

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
    if (askState === 'awaiting-input') return 'Type your question...';
    // During Story word collection
    if (storyState === 'awaiting-turn' || storyState === 'awaiting-setup') return 'Type your answer and press Send';
    // During Discussion with Opening actions visible (Ask, Joke, Riddle, Poem, Story, Fill-in-Fun, Go buttons)
    if (
      phase === 'discussion' &&
      subPhase === 'awaiting-learner' &&
      showOpeningActions &&
      askState === 'inactive' &&
      riddleState === 'inactive' &&
      poemState === 'inactive' &&
      storyState === 'inactive' &&
      fillInFunState === 'inactive'
    ) {
      return 'Press "Go" to begin';
    }
    // During Teaching gate, disable text and prompt to use buttons
    if (phase === 'teaching' && subPhase === 'awaiting-gate') {
      if (teachingStage === 'examples') {
        return 'Tap Repeat Examples or Next above';
      }
      // During definitions: check if in sentence mode
      const repeatLabel = isInSentenceMode ? 'Repeat Sentence' : 'Restart Vocab';
      const nextLabel = isInSentenceMode ? 'Next Sentence' : 'Next: Examples';
      return `Tap ${repeatLabel} or ${nextLabel} above`;
    }
    // During Comprehension: lock input and guide clearly
    if (phase === 'comprehension') {
  if (subPhase === 'comprehension-start') return 'Press "Begin Comprehension"';
    }
  if (phase === 'exercise' && subPhase === 'exercise-awaiting-begin') return 'Press "Begin Exercise"';
  if (phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin') return 'Press "Begin Worksheet"';
    if (phase === 'test' && subPhase === 'test-awaiting-begin') return 'Press "Begin Test"';
    // Show guidance any time input is actionable (buttons full color => not disabled)
    if (!sendDisabled) return 'Type your answer...';
    return '';
  };
  return (
  <div style={{ display: "flex", alignItems: "center", gap: (typeof compact !== 'undefined' && compact) ? 6 : 8, marginBottom: 0, width: '100%', maxWidth: '100%', marginLeft: 'auto', marginRight: 'auto', boxSizing: 'border-box', paddingLeft: (typeof compact !== 'undefined' && compact) ? 8 : (compact ? 12 : '4%'), paddingRight: (typeof compact !== 'undefined' && compact) ? 8 : (compact ? 12 : '4%') }}>
      <button
        style={{
          background: (sendDisabled) ? "#4b5563" : '#c7442e',
          color: "#fff",
          borderRadius: 8,
          padding: (typeof compact !== 'undefined' && compact) ? "6px 10px" : "8px 12px",
          fontWeight: 600,
          border: "none",
          cursor: (sendDisabled) ? "not-allowed" : "pointer",
          opacity: (sendDisabled) ? 0.7 : 1,
          transition: "background 0.2s, opacity 0.2s, box-shadow 0.2s",
          position: 'relative',
          boxShadow: isRecording ? '0 0 0 4px rgba(199,68,46,0.35), 0 0 12px 4px rgba(199,68,46,0.55)' : '0 2px 6px rgba(0,0,0,0.25)',
          // Prevent long-press selection/callout on mobile
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          touchAction: 'manipulation'
        }}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
  disabled={sendDisabled}
        onContextMenu={(e) => { e.preventDefault(); }}
        onDragStart={(e) => { e.preventDefault(); }}
        onTouchStart={(e) => {
          // Use hold-to-record on touch devices; prevent synthetic click
          e.preventDefault();
          if (sendDisabled) return;
          touchActiveRef.current = true;
          if (!isRecording && !uploading) {
            startRecording();
          }
        }}
        onTouchEnd={(e) => {
          e.preventDefault();
          if (!touchActiveRef.current) return;
          touchActiveRef.current = false;
          if (isRecording) {
            stopRecording();
          }
        }}
        onTouchCancel={(e) => {
          e.preventDefault();
          touchActiveRef.current = false;
          if (isRecording) {
            stopRecording();
          }
        }}
        onClick={() => {
          if (sendDisabled) return;
          if (isRecording) {
            stopRecording();
          } else {
            startRecording();
          }
        }}
      >
        {isRecording ? (
          <div style={{ position:'relative', width:18, height:18 }}>
            <div style={{ position:'absolute', inset:0, background:'#fff', borderRadius:4, animation:'msPulse 1s ease-in-out infinite' }} />
          </div>
        ) : uploading ? (
          <div style={{ position:'relative', width:18, height:18 }}>
            <div style={{ position:'absolute', inset:0, border:'3px solid rgba(255,255,255,0.4)', borderTopColor:'#fff', borderRadius:'50%', animation:'msSpinFade 0.9s linear infinite' }} />
          </div>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M19 11a7 7 0 01-14 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 21v-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>
      {/* Removed iOS-only test sound button to simplify controls */}
      <input
        ref={inputRef}
            title={(() => {
              const micCode = (hotkeys?.micHold || DEFAULT_HOTKEYS.micHold);
              const label = micCode === 'NumpadAdd' ? 'Numpad +' : micCode || 'Numpad +';
              return isRecording ? `Release ${label} to stop` : `Hold ${label} to talk`;
            })()}
        value={learnerInput}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => setLearnerInput(event.target.value)}
        onKeyDown={(e) => {
          const code = e.code || e.key;
          const beginCode = (hotkeys?.beginSend || DEFAULT_HOTKEYS.beginSend);
          if (code === beginCode) {
            e.preventDefault();
            if (!sendDisabled) {
              handleSend();
            }
          }
        }}
        placeholder={computePlaceholder()}
  disabled={sendDisabled}
        style={{
          flex: 1,
          padding: "10px",
          borderRadius: 6,
          border: "1px solid #bdbdbd",
          fontSize: 'clamp(0.95rem, 1.6vw, 1.05rem)',
          background: (!sendDisabled) ? "#fff" : "#f3f4f6",
          color: (!sendDisabled) ? "#111827" : "#9ca3af",
          transition: 'background 0.2s, color 0.2s',
          ...(loading ? { animation: 'flashInputPlaceholder 0.85s ease-in-out infinite' } : {})
        }}
      />
      <button
        style={{
          background: (sendDisabled) ? "#4b5563" : "#c7442e",
          color: "#fff",
          borderRadius: 8,
          padding: (typeof compact !== 'undefined' && compact) ? "6px 10px" : "8px 12px",
          fontWeight: 600,
          border: "none",
          cursor: (sendDisabled) ? "not-allowed" : "pointer",
          opacity: (sendDisabled) ? 0.7 : 1,
          transition: "background 0.2s, opacity 0.2s",
        }}
        aria-label="Send response"
  disabled={sendDisabled}
  onClick={handleSend}
      >
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
          <path d="M22 2L11 13" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* Flash animation style for loading placeholder */}
      <style jsx>{`
        @keyframes flashInputPlaceholder {
          0% { opacity: 1; }
          50% { opacity: 0.55; }
          100% { opacity: 1; }
        }
        @keyframes msPulse { 0% { transform: scale(1); opacity:1;} 50% { transform: scale(0.55); opacity:0.5;} 100% { transform: scale(1); opacity:1;} }
        @keyframes msSpinFade {
          0% { transform: rotate(0deg); opacity: 1; }
          50% { transform: rotate(180deg); opacity: 0.55; }
          100% { transform: rotate(360deg); opacity: 1; }
        }
        .ms-spinner {
          position: relative;
          box-sizing: border-box;
          width: 64px;
          height: 64px;
          border: 6px solid rgba(255,255,255,0.22);
          border-top-color: #ffffff;
          border-radius: 50%;
          animation: msSpinFade 0.9s linear infinite;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
        }
      `}</style>
    {errorMsg && (
  <div style={{ position:'absolute', bottom:-18, left:4, fontSize:'clamp(0.7rem, 1.2vw, 0.8rem)', color:'#c7442e' }}>{errorMsg}</div>
    )}
    </div>
  );
}

function DownloadPanel({
  lessonDataLoading,
  canDownloadWorksheet,
  canDownloadTest,
  onDownloadWorksheet,
  onDownloadTest,
  onReroll,
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 8,
        alignItems: 'stretch',
        marginTop: 8,
        marginBottom: 4,
        width: '100%',
        maxWidth: '100%',
        boxSizing: 'border-box',
        paddingLeft: 12,
        paddingRight: 12,
      }}
    >
      <button
        type="button"
        style={{
          background: lessonDataLoading || !canDownloadWorksheet ? "#6b7280" : "#1f2937",
          color: "#fff",
          borderRadius: 8,
          padding: '12px 14px',
          minHeight: 44,
          fontWeight: 600,
          border: "none",
          cursor: lessonDataLoading || !canDownloadWorksheet ? "not-allowed" : "pointer",
          opacity: lessonDataLoading || !canDownloadWorksheet ? 0.7 : 1,
          width: '100%',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
        }}
        disabled={lessonDataLoading || !canDownloadWorksheet}
        onClick={onDownloadWorksheet}
      >
        Worksheet
      </button>
      <button
        type="button"
        style={{
          background: lessonDataLoading || !canDownloadTest ? "#6b7280" : "#1f2937",
          color: "#fff",
          borderRadius: 8,
          padding: '12px 14px',
          minHeight: 44,
          fontWeight: 600,
          border: "none",
          cursor: lessonDataLoading || !canDownloadTest ? "not-allowed" : "pointer",
          opacity: lessonDataLoading || !canDownloadTest ? 0.7 : 1,
          width: '100%',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
        }}
        disabled={lessonDataLoading || !canDownloadTest}
        onClick={onDownloadTest}
      >
        Test
      </button>
      <button
        type="button"
        style={{
          background: lessonDataLoading || (!canDownloadWorksheet && !canDownloadTest) ? "#6b7280" : "#c7442e",
          color: "#fff",
          borderRadius: 8,
          padding: '12px 14px',
          minHeight: 44,
          fontWeight: 700,
          border: "none",
          cursor: lessonDataLoading || (!canDownloadWorksheet && !canDownloadTest) ? "not-allowed" : "pointer",
          opacity: lessonDataLoading || (!canDownloadWorksheet && !canDownloadTest) ? 0.7 : 1,
          width: '100%',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          overflow: 'hidden',
        }}
        disabled={lessonDataLoading || (!canDownloadWorksheet && !canDownloadTest)}
        onClick={onReroll}
        title="Reset and re-generate a new worksheet and test"
      >
        Refresh Worksheet & Test
      </button>
    </div>
  );
}

function CaptionPanel({ sentences, activeIndex, boxRef, scaleFactor = 1, compact = false, fullHeight = false, stackedHeight = null, phase, vocabTerms = [] }) {
  const [canScroll, setCanScroll] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);
  // Normalize incoming sentences (strings or { text, role }) to a consistent shape
  const items = useMemo(() => {
    if (!Array.isArray(sentences)) return [];
    return sentences.map((s) => (typeof s === 'string' ? { text: s } : (s && typeof s === 'object' ? s : { text: '' })));
  }, [sentences]);

  // Detect overflow & scroll position on the scroller (boxRef)
  const recomputeScrollState = useCallback(() => {
    if (!boxRef?.current) return;
    const el = boxRef.current;
    const overflow = el.scrollHeight > el.clientHeight + 4; // tolerance
    setCanScroll(overflow);
    setAtTop(el.scrollTop <= 4);
    setAtBottom(el.scrollTop >= el.scrollHeight - el.clientHeight - 4);
  }, [boxRef]);

  useEffect(() => { recomputeScrollState(); }, [items, stackedHeight, fullHeight, compact, recomputeScrollState]);

  useEffect(() => {
    if (!boxRef?.current) return;
    const el = boxRef.current;
    const handler = () => recomputeScrollState();
    el.addEventListener('scroll', handler, { passive: true });
    const resizeObs = new ResizeObserver(handler);
    resizeObs.observe(el);
    return () => { el.removeEventListener('scroll', handler); resizeObs.disconnect(); };
  }, [boxRef, recomputeScrollState]);

  // Auto-center active caption line
  useEffect(() => {
    if (!boxRef?.current) return;
    const activeEl = boxRef.current.querySelector(`[data-idx="${activeIndex}"]`);
    if (!activeEl) return;
    const container = boxRef.current;
    const marginTop = 8;
    const marginBottom = 24;
    const scale = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
    const elementTop = activeEl.offsetTop - marginTop;
    const elementBottom = activeEl.offsetTop + activeEl.offsetHeight + marginBottom;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const isLast = activeIndex >= (Array.isArray(items) ? items.length - 1 : -1);
    if (elementTop < viewTop || elementBottom > viewBottom) {
      const distance = Math.abs(elementTop - viewTop);
      const jumpThreshold = (container.clientHeight * 0.65) / scale;
      let target;
      if (isLast) target = maxScroll; else {
        const desiredOffset = Math.max(0, elementTop - (container.clientHeight * 0.2) / scale);
        target = Math.min(maxScroll, desiredOffset);
      }
      if (distance > jumpThreshold) container.scrollTop = target; else container.scrollTo({ top: target, behavior: 'smooth' });
      if (isLast) requestAnimationFrame(() => { container.scrollTop = maxScroll; });
    }
  }, [activeIndex, items, scaleFactor, boxRef]);

  const containerStyle = {
    width: '100%',
    boxSizing: 'border-box',
    background: '#ffffff',
    borderRadius: 14,
    position: 'relative',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
    flex: fullHeight ? '1 1 auto' : undefined,
    maxHeight: fullHeight ? '100%' : (stackedHeight ? stackedHeight : (compact ? '14vh' : '18vh')),
    height: fullHeight ? '100%' : (stackedHeight ? stackedHeight : 'auto'),
  };

  const scrollerStyle = {
    flex: '1 1 auto',
    height: '100%',
    overflowY: 'auto',
    paddingTop: compact ? 6 : 12,
    paddingRight: 12,
    paddingBottom: compact ? 6 : 12,
    paddingLeft: 12,
    color: '#111111',
    fontSize: 'clamp(1.125rem, 2.4vw, 1.5rem)',
    lineHeight: 1.5,
  };

  return (
    <div data-ms-caption-panel-container style={containerStyle}>
      <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 10 }}>
        <button
          type="button"
          aria-label="Scroll up captions"
          disabled={atTop}
          onClick={() => { if (boxRef.current) boxRef.current.scrollBy({ top: -Math.max(80, boxRef.current.clientHeight * 0.4), behavior: 'smooth' }); }}
          style={{
            background: atTop ? '#d1d5db' : '#1f2937',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            width: 34,
            height: 34,
            fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
            lineHeight: '34px',
            cursor: atTop ? 'default' : 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
            opacity: atTop ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ 
            width: 0, 
            height: 0, 
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '8px solid #fff',
            display: 'inline-block',
            transform: 'translateY(-2px)'
          }} />
        </button>
        <button
          type="button"
          aria-label="Scroll down captions"
          disabled={atBottom}
          onClick={() => { if (boxRef.current) boxRef.current.scrollBy({ top: Math.max(80, boxRef.current.clientHeight * 0.4), behavior: 'smooth' }); }}
          style={{
            background: atBottom ? '#d1d5db' : '#1f2937',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            width: 34,
            height: 34,
            fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
            lineHeight: '34px',
            cursor: atBottom ? 'default' : 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
            opacity: atBottom ? 0.6 : 1,
          }}
        >
          <span style={{ 
            width: 0, 
            height: 0, 
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderTop: '8px solid #fff',
            display: 'inline-block'
          }} />
        </button>
      </div>
      <div ref={boxRef} data-ms-caption-panel className="scrollbar-hidden" style={scrollerStyle} aria-live="polite">
        {Array.isArray(items) && items.length > 0 ? (
          <>
          {items.map((s, idx) => {
            const text = (s && typeof s.text === 'string') ? s.text : '';
            if (text === '\n') {
              return <div key={idx} data-idx={idx} style={{ height: 6 }} />;
            }
            const isActive = idx === activeIndex;
            const containerBase = { margin: '6px 0', transition: 'background-color 160ms ease, color 160ms ease' };
            const activeContainer = isActive ? { background: 'rgba(199,68,46,0.08)', borderRadius: 8, padding: '4px 6px' } : null;
            const textBase = { whiteSpace: 'pre-line' };
            const activeText = isActive ? { fontWeight: 700, color: '#111111' } : { fontWeight: 500 };
            // Style for learner-entered lines
            const userText = { color: '#c7442e', fontWeight: 600 };
            // If this line appears to contain multiple-choice choices, render stacked with nowrap pairs
            const mcMatch = text && /(\s|^)[A-F][\.)]\s+\S/.test(text) && (text.match(/[A-F][\.)]\s+\S/g) || []).length >= 2;
            let mcRender = null;
            if (mcMatch) {
              try {
                const m = text.match(/^(\d+\.\s*)?(.*?)(\s+[A-F][\.)]\s.*)$/);
                if (m) {
                  const [, num = '', stem = '', choiceChunk = ''] = m;
                  const tokens = choiceChunk.trim().split(/\s+(?=[A-F][\.)]\s)/);
                  mcRender = (
                    <div style={{ whiteSpace: 'normal' }}>
                      {(num || stem) ? <div>{num}{stem}</div> : null}
                      {tokens.map((t, i) => (
                        <div key={i} style={{ whiteSpace: 'nowrap' }}>{enforceNbspAfterMcLabels(t)}</div>
                      ))}
                    </div>
                  );
                }
              } catch {}
            }
            // Build highlighted parts when in Discussion and vocab terms exist; skip for user lines and MC renders
            let highlighted = null;
            try {
              if (!mcRender && s.role !== 'user' && (phase === 'discussion' || phase === 'teaching') && text) {
                const terms = Array.isArray(vocabTerms) ? vocabTerms.filter(Boolean).map(t => String(t).trim()).filter(Boolean) : [];
                if (terms.length) {
                  const esc = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                  // Cross-compatible boundary emulation using prefix capture; allow simple plural/possessive
                  const core = terms.map(esc).sort((a,b)=>b.length-a.length).join('|');
                  const pattern = new RegExp(`(^|[^A-Za-z0-9])(${core})(?:'s|s)?(?![A-Za-z0-9])`, 'gi');
                  const parts = [];
                  let lastIndex = 0;
                  let m;
                  while ((m = pattern.exec(text)) !== null) {
                    const start = m.index;
                    const prefix = m[1] || '';
                    const coreTerm = m[2] || '';
                    const full = m[0] || '';
                    const suffix = full.slice(prefix.length + coreTerm.length);
                    // Add text before match
                    if (start > lastIndex) parts.push(text.slice(lastIndex, start));
                    // Add prefix unbolded
                    if (prefix) parts.push(prefix);
                    // Bold the term plus any simple suffix
                    const boldKey = `b-${idx}-${start}`;
                    parts.push(<strong key={boldKey}>{coreTerm + suffix}</strong>);
                    lastIndex = start + full.length;
                  }
                  if (lastIndex > 0) {
                    if (lastIndex < text.length) parts.push(text.slice(lastIndex));
                    highlighted = parts;
                  }
                }
              }
            } catch {}
            return (
              <div key={idx} data-idx={idx} style={{ ...containerBase, ...(activeContainer || {}) }} aria-current={isActive ? 'true' : undefined}>
                {s.role === 'user' ? (
                  <div style={{ ...textBase, ...userText }}>{text}</div>
                ) : mcRender ? (
                  <div style={{ ...textBase, ...activeText }}>{mcRender}</div>
                ) : (
                  <div style={{ ...textBase, ...activeText }}>{highlighted || text}</div>
                )}
              </div>
            );
          })}
          {/* Dynamic tail spacer to keep one blank line at the bottom without altering the transcript */}
          <div aria-hidden data-ms-caption-tail-spacer style={{ height: '1.5em' }} />
          </>
        ) : (
          <>
            <div style={{ color: '#6b7280' }}>No captions yet.</div>
            {/* Keep consistent tail spacing even when empty */}
            <div aria-hidden data-ms-caption-tail-spacer style={{ height: '1.5em' }} />
          </>
        )}
      </div>
    </div>
  );
}

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
                    subject: subjectParam,
                    difficulty: difficultyParam,
                    lesson: lessonParam,
                  lessonTitle: effectiveLessonTitle,
                    ticker: nextTicker,
                  }
                );
                setLearnerInput("");
                if (result.success && nextTicker >= WORKSHEET_TARGET) {
                  setPhase("test");
                  setSubPhase("test-start");
                  setCanSend(false);
                }
              }}
            >
              Next worksheet item
            </button>
          </div>
        );
      case "test":
        // Render Review controls inline when in a review subphase to keep the timeline in Test
        if (typeof subPhase === 'string' && subPhase.startsWith('review')) {
          return (
            <div style={{ marginBottom: 24 }}>
              <h2>Facilitator Review</h2>
              <p>Adjust correctness as needed, then accept.</p>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:8 }}>
                <span>
                  Score preview: {typeof testFinalPercent === 'number' ? testFinalPercent : Math.round(((Array.isArray(testCorrectByIndex)?testCorrectByIndex.filter(Boolean).length:0)/Math.max(1,(Array.isArray(generatedTest)?generatedTest.length:0))*100))}%
                </span>
                <button type="button" style={primaryButtonStyle} onClick={finalizeReview}>Accept</button>
              </div>
            </div>
          );
        }
        return (
          <div style={{ marginBottom: 24 }}>
            <p>Test answers recorded: {testAnswers.length}</p>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={async () => {
                const nextTicker = ticker + 1;
                setTicker(nextTicker);
                setTestAnswers([...testAnswers, learnerInput]);
                const payload = {
                  phase: "test",
                  subject: subjectParam,
                  difficulty: difficultyParam,
                  lesson: lessonParam,
                  lessonTitle: effectiveLessonTitle,
                  ticker: nextTicker,
                };
                // Clear input immediately
                setLearnerInput("");
                // If we've met or exceeded the target, do not await anything � go straight to review.
                if (nextTicker >= TEST_TARGET) {
                  try { setCanSend(false); } catch {}
                  // Review is a subphase of Test; keep phase pinned to 'test'
                  try { setSubPhase("review-start"); } catch {}
                  // Fire-and-forget the API call so logs/metrics are not lost, but do not block UI.
                  try { callMsSonoma("Test: Black screen, overlay questions, grade after all answers, no hints or rephrasing.", learnerInput, payload); } catch {}
                  return;
                }
                // Otherwise, continue normal flow for intermediate questions.
                try {
                  await callMsSonoma(
                    "Test: Black screen, overlay questions, grade after all answers, no hints or rephrasing.",
                    learnerInput,
                    payload
                  );
                } catch {}
              }}
            >
              Submit test answer
            </button>
          </div>
        );
      case "grading":
        return (
          <div style={{ marginBottom: 24 }}>
            <p>Grading in progress...</p>
          </div>
        );
      case "review":
        // Legacy: keep nothing here so timeline stays consistent; review renders under test phase
        return null;
      case "congrats":
        return (
          <div style={{ marginBottom: 24 }}>
            <h2>Congratulations!</h2>
            {!congratsStarted ? (
              <div>
                <p>{transcript}</p>
                <button type="button" style={primaryButtonStyle} onClick={() => setCongratsStarted(true)}>Start Congrats</button>
              </div>
            ) : (
              <p>{transcript}</p>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return renderSection();
}






// End of PhaseDetail component













