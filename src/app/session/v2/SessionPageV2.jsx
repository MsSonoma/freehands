"use client";

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

import { Suspense, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { getLearner } from '@/app/facilitator/learners/clientApi';
import { loadPhaseTimersForLearner } from '../utils/phaseTimerDefaults';
import SessionTimer from '../components/SessionTimer';
import { AudioEngine } from './AudioEngine';
import { TeachingController } from './TeachingController';
import { ComprehensionPhase } from './ComprehensionPhase';
import { ExercisePhase } from './ExercisePhase';
import { WorksheetPhase } from './WorksheetPhase';
import { TestPhase } from './TestPhase';
import { ClosingPhase } from './ClosingPhase';
import { DiscussionPhase } from './DiscussionPhase';
import { PhaseOrchestrator } from './PhaseOrchestrator';
import { SnapshotService } from './SnapshotService';
import { TimerService } from './TimerService';
import { KeyboardService } from './KeyboardService';
import { OpeningActionsController } from './OpeningActionsController';
import PlayTimeExpiredOverlay from './PlayTimeExpiredOverlay';
import TimerControlOverlay from '../components/TimerControlOverlay';
import EventBus from './EventBus';
import { loadLesson, fetchTTS } from './services';
import { formatMcOptions, isMultipleChoice, isTrueFalse } from '../utils/questionFormatting';
import { getSnapshotStorageKey } from '../utils/snapshotPersistenceUtils';

// Derive a canonical lesson key (filename only, no subject prefix, no .json) for per-learner persistence.
function deriveCanonicalLessonKey({ lessonData, lessonId }) {
  try {
    // Prefer explicit lesson key/id, fall back to URL param.
    const base = getSnapshotStorageKey({ lessonData, lessonParam: lessonId });
    return base || '';
  } catch {
    try {
      let key = lessonData?.key || lessonData?.id || lessonId || '';
      if (key.includes('/')) key = key.split('/').pop();
      return String(key || '').replace(/\.json$/i, '');
    } catch {
      return '';
    }
  }
}

// Timeline constants
const timelinePhases = ["discussion", "comprehension", "exercise", "worksheet", "test"];
const phaseLabels = {
  discussion: "Discussion",
  comprehension: "Comp",
  exercise: "Exercise",
  worksheet: "Worksheet",
  test: "Test",
};

// Timeline component
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
            fontSize: labelFontSize,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
            cursor: onJumpPhase ? 'pointer' : 'default',
            userSelect: 'none',
            transition: 'background 120ms ease, transform 120ms ease'
          }}
        >
          {phaseLabels[phaseKey]}
        </div>
      ))}
    </div>
  );
}

export default function SessionPageV2() {
  return (
    <Suspense fallback={null}>
      <SessionPageV2Inner />
    </Suspense>
  );
}

// Export inner component for direct test route
export { SessionPageV2Inner };

function SessionPageV2Inner() {
  const searchParams = useSearchParams();
  const lessonId = searchParams?.get('lesson') || '';
  const subjectParam = searchParams?.get('subject') || 'math'; // Subject folder for lesson lookup
  const regenerateParam = searchParams?.get('regenerate'); // Support generated lessons

  // Stable session id (persists across refreshes in this tab; V1 parity)
  const [browserSessionId] = useState(() => {
    if (typeof window === 'undefined') return null;
    let sid = sessionStorage.getItem('lesson_session_id');
    if (!sid) {
      sid = (typeof crypto !== 'undefined' && crypto?.randomUUID)
        ? crypto.randomUUID()
        : `sid_${Math.random().toString(16).slice(2)}_${Date.now()}`;
      try { sessionStorage.setItem('lesson_session_id', sid); } catch {}
    }
    return sid;
  });
  
  const videoRef = useRef(null);
  const transcriptRef = useRef(null);
  const audioEngineRef = useRef(null);
  const eventBusRef = useRef(null); // Shared EventBus for all services
  const orchestratorRef = useRef(null);
  const snapshotServiceRef = useRef(null);
  const timerServiceRef = useRef(null);
  const keyboardServiceRef = useRef(null);
  const teachingControllerRef = useRef(null);
  const openingActionsControllerRef = useRef(null);
  const comprehensionPhaseRef = useRef(null);
  const discussionPhaseRef = useRef(null);
  const exercisePhaseRef = useRef(null);
  const worksheetPhaseRef = useRef(null);
  const testPhaseRef = useRef(null);
  const closingPhaseRef = useRef(null);
  const sessionLearnerIdRef = useRef(null); // pinned learner id for this session
  const pendingPlayTimersRef = useRef({}); // track phases waiting to start play timer after init
  const timelineJumpInProgressRef = useRef(false); // Debounce timeline jumps
  const pendingTimerStateRef = useRef(null);
  const startSessionRef = useRef(null);
  const resumePhaseRef = useRef(null);
  
  const [lessonData, setLessonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Canonical per-lesson persistence key (lesson == session identity)
  const lessonKey = useMemo(() => deriveCanonicalLessonKey({ lessonData, lessonId }), [lessonData, lessonId]);
  
  const [currentPhase, setCurrentPhase] = useState('idle');
  
  const [teachingStage, setTeachingStage] = useState('idle');
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [totalSentences, setTotalSentences] = useState(0);
  const [isInSentenceMode, setIsInSentenceMode] = useState(true);
  
  const [comprehensionState, setComprehensionState] = useState('idle');
  const [currentComprehensionQuestion, setCurrentComprehensionQuestion] = useState(null);
  const [comprehensionScore, setComprehensionScore] = useState(0);
  const [comprehensionTotalQuestions, setComprehensionTotalQuestions] = useState(0);
  const [comprehensionAnswer, setComprehensionAnswer] = useState('');
  const [comprehensionTimerMode, setComprehensionTimerMode] = useState('play');
  
  const [exerciseState, setExerciseState] = useState('idle');
  const [currentExerciseQuestion, setCurrentExerciseQuestion] = useState(null);
  const [exerciseScore, setExerciseScore] = useState(0);
  const [exerciseTotalQuestions, setExerciseTotalQuestions] = useState(0);
  const [selectedExerciseAnswer, setSelectedExerciseAnswer] = useState('');
  const [exerciseTimerMode, setExerciseTimerMode] = useState('play');
  
  const [worksheetState, setWorksheetState] = useState('idle');
  const [currentWorksheetQuestion, setCurrentWorksheetQuestion] = useState(null);
  const [worksheetScore, setWorksheetScore] = useState(0);
  const [worksheetTotalQuestions, setWorksheetTotalQuestions] = useState(0);
  const [worksheetAnswer, setWorksheetAnswer] = useState('');
  const [lastWorksheetFeedback, setLastWorksheetFeedback] = useState(null);
  const [worksheetTimerMode, setWorksheetTimerMode] = useState('play');
  
  const [testState, setTestState] = useState('idle');
  const [currentTestQuestion, setCurrentTestQuestion] = useState(null);
  const [testScore, setTestScore] = useState(0);
  const [testTotalQuestions, setTestTotalQuestions] = useState(0);
  const [testAnswer, setTestAnswer] = useState('');
  const [testGrade, setTestGrade] = useState(null);
  const [testReviewAnswer, setTestReviewAnswer] = useState(null);
  const [testReviewIndex, setTestReviewIndex] = useState(0);
  const [testTimerMode, setTestTimerMode] = useState('play');
  
  const [closingState, setClosingState] = useState('idle');
  const [closingMessage, setClosingMessage] = useState('');
  
  const [discussionState, setDiscussionState] = useState('idle');
  const [discussionActivity, setDiscussionActivity] = useState(null);
  const [discussionPrompt, setDiscussionPrompt] = useState('');
  const [discussionResponse, setDiscussionResponse] = useState('');
  const [discussionActivityIndex, setDiscussionActivityIndex] = useState(0);
  
  // Opening actions state
  const [openingActionActive, setOpeningActionActive] = useState(false);
  const [openingActionType, setOpeningActionType] = useState(null);
  const [openingActionState, setOpeningActionState] = useState({});

  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [resumePhase, setResumePhase] = useState(null);
  
  const [workPhaseTime, setWorkPhaseTime] = useState('0:00');
  const [workPhaseRemaining, setWorkPhaseRemaining] = useState('0:00');
  const [goldenKeyEligible, setGoldenKeyEligible] = useState(false);
  
  // Learner profile state (REQUIRED - no defaults)
  const [learnerProfile, setLearnerProfile] = useState(null);
  const [learnerLoading, setLearnerLoading] = useState(true);
  const [learnerError, setLearnerError] = useState(null);
  
  // Phase timer state (loaded from learner profile)
  const [phaseTimers, setPhaseTimers] = useState(null);
  const [currentTimerMode, setCurrentTimerMode] = useState({
    discussion: null,
    comprehension: null,
    exercise: null,
    worksheet: null,
    test: null
  });
  const [timerRefreshKey, setTimerRefreshKey] = useState(0);
  const [goldenKeyBonus, setGoldenKeyBonus] = useState(0);
  const [timerPaused, setTimerPaused] = useState(false);
  
  // Play timer expired overlay state (V1 parity)
  const [showPlayTimeExpired, setShowPlayTimeExpired] = useState(false);
  const [playExpiredPhase, setPlayExpiredPhase] = useState(null);
  
  // Timer control overlay state (facilitator controls)
  const [showTimerControl, setShowTimerControl] = useState(false);
  
  const [currentCaption, setCurrentCaption] = useState('');
  const [transcriptLines, setTranscriptLines] = useState([]);
  const [engineState, setEngineState] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [showRepeatButton, setShowRepeatButton] = useState(false);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    resumePhaseRef.current = resumePhase;
  }, [resumePhase]);
  
  // Compute timeline highlight based on current phase
  const timelineHighlight = (() => {
    // Group teaching with discussion; comprehension is its own segment on the timeline
    if (["discussion", "teaching", "idle"].includes(currentPhase)) {
      return "discussion";
    }
    if (currentPhase === "comprehension") {
      return "comprehension";
    }
    if (currentPhase === "exercise") {
      return "exercise";
    }
    if (currentPhase === "worksheet") {
      return "worksheet";
    }
    if (["test", "grading", "congrats"].includes(currentPhase)) {
      return "test";
    }
    return currentPhase;
  })();
  
  // Load lesson data
  useEffect(() => {
    async function loadLessonData() {
      try {
        setLoading(true);
        setError(null);
        
        let lesson;
        
        // Check for generated lesson (regenerate parameter)
        if (regenerateParam) {
          addEvent('ðŸ¤– Loading generated lesson...');
          const response = await fetch(`/api/lesson-engine/regenerate?key=${regenerateParam}`);
          if (!response.ok) {
            throw new Error(`Failed to load generated lesson: ${response.statusText}`);
          }
          const data = await response.json();
          lesson = data.lesson;
          addEvent(`ðŸ“š Loaded generated lesson: ${lesson.title || 'Untitled'}`);
        }
        // Load lesson if lessonId provided
        else if (lessonId) {
          lesson = await loadLesson(lessonId, subjectParam);
          addEvent(`ðŸ“š Loaded lesson: ${lesson.title}`);
        } else {
          // No lessonId - show error
          throw new Error('No lesson specified. Add ?lesson=filename&subject=math to URL');
        }
        
        const canonicalKey = deriveCanonicalLessonKey({ lessonData: lesson, lessonId });
        if (!canonicalKey) {
          throw new Error('Unable to determine lesson key for persistence.');
        }

        setLessonData({ ...lesson, key: canonicalKey });
        setLoading(false);
      } catch (err) {
        console.error('[SessionPageV2] Lesson load error:', err);
        setError(err.message);
        setLoading(false);
      }
    }
    
    loadLessonData();
  }, [lessonId, subjectParam, regenerateParam]);
  
  // Load learner profile (REQUIRED - no defaults or fallback)
  useEffect(() => {
    async function loadLearnerProfile() {
      try {
        setLearnerLoading(true);
        setLearnerError(null);
        
        const learnerId = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
        
        if (!learnerId || learnerId === 'demo') {
          throw new Error('No learner selected. Please select a learner from the dashboard.');
        }
        
        const learner = await getLearner(learnerId);
        
        if (!learner) {
          throw new Error('Learner profile not found. Please select a valid learner.');
        }
        
        // Pin the session learner id to avoid mid-session localStorage drift.
        sessionLearnerIdRef.current = learner.id;
        setLearnerProfile(learner);
        
        // Load phase timer settings from learner profile
        const timers = loadPhaseTimersForLearner(learner);
        setPhaseTimers(timers);
        
        // Initialize currentTimerMode (null = not started yet)
        setCurrentTimerMode({
          discussion: null,
          comprehension: null,
          exercise: null,
          worksheet: null,
          test: null
        });
        
        // Check for active golden key on this lesson
        if (!lessonKey) {
          throw new Error('Missing canonical lesson key for golden key lookup.');
        }
        const activeKeys = learner.active_golden_keys || {};
        if (activeKeys[lessonKey]) {
          setGoldenKeyBonus(timers.golden_key_bonus_min || 0);
        }
        
        addEvent(`ðŸ‘¤ Loaded learner: ${learner.name}`);
        setLearnerLoading(false);
      } catch (err) {
        console.error('[SessionPageV2] Learner load error:', err);
        setLearnerError(err.message);
        setLearnerLoading(false);
      }
    }
    
    loadLearnerProfile();
  }, [lessonData, lessonId, lessonKey, subjectParam]);
  
  // Initialize shared EventBus (must be first)
  useEffect(() => {
    eventBusRef.current = new EventBus();
    
    return () => {
      if (eventBusRef.current) {
        eventBusRef.current.clear();
        eventBusRef.current = null;
      }
    };
  }, []);
  
  // Initialize SnapshotService after lesson loads
  useEffect(() => {
    if (!lessonData || !learnerProfile || !browserSessionId || !lessonKey) return;

    let cancelled = false;
    setSnapshotLoaded(false);

    const sessionId = browserSessionId;
    const learnerId = learnerProfile.id;

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    try {
      const service = new SnapshotService({
        sessionId,
        learnerId,
        lessonKey,
        supabaseClient: supabase
      });

      snapshotServiceRef.current = service;

      service.initialize().then(snapshot => {
        if (cancelled) return;
        if (snapshot) {
          addEvent(`💾 Loaded snapshot - Resume from: ${snapshot.currentPhase}`);
          setResumePhase(snapshot.currentPhase);
          resumePhaseRef.current = snapshot.currentPhase;

          if (snapshot.timerState) {
            if (timerServiceRef.current) {
              try { timerServiceRef.current.restoreState(snapshot.timerState); } catch {}
            } else {
              pendingTimerStateRef.current = snapshot.timerState;
            }
          }
        } else {
          addEvent('💾 No snapshot found - Starting fresh');
        }
      }).catch(err => {
        if (cancelled) return;
        console.error('[SessionPageV2] Snapshot init error:', err);
        setError('Unable to load saved progress for this lesson.');
      }).finally(() => {
        if (!cancelled) {
          setSnapshotLoaded(true);
        }
      });
    } catch (err) {
      console.error('[SessionPageV2] Snapshot service construction failed:', err);
      setError('Unable to initialize persistence for this lesson.');
      setSnapshotLoaded(true);
    }

    return () => {
      cancelled = true;
      snapshotServiceRef.current = null;
    };
  }, [lessonData, learnerProfile, browserSessionId, lessonKey]);
  
  // Initialize TimerService
  useEffect(() => {
    if (!eventBusRef.current || !lessonKey || !phaseTimers) return;

    const eventBus = eventBusRef.current;

    // Convert minutes -> seconds; golden key bonus applies to play timers only.
    const playBonusSec = Math.max(0, Number(goldenKeyBonus || 0)) * 60;
    const m2s = (m) => Math.max(0, Number(m || 0)) * 60;

    const playTimerLimits = {
      comprehension: m2s(phaseTimers.comprehension_play_min) + playBonusSec,
      exercise: m2s(phaseTimers.exercise_play_min) + playBonusSec,
      worksheet: m2s(phaseTimers.worksheet_play_min) + playBonusSec,
      test: m2s(phaseTimers.test_play_min) + playBonusSec
    };

    const workPhaseTimeLimits = {
      discussion: m2s(phaseTimers.discussion_work_min),
      comprehension: m2s(phaseTimers.comprehension_work_min),
      exercise: m2s(phaseTimers.exercise_work_min),
      worksheet: m2s(phaseTimers.worksheet_work_min),
      test: m2s(phaseTimers.test_work_min)
    };

    // Forward timer events to UI
    const unsubWorkTick = eventBus.on('workPhaseTimerTick', (data) => {
      setWorkPhaseTime(data.formatted);
      setWorkPhaseRemaining(data.remainingFormatted);
    });

    const unsubWorkComplete = eventBus.on('workPhaseTimerComplete', (data) => {
      addEvent(`â±ï¸ ${data.phase} timer complete!`);
    });

    const unsubGoldenKey = eventBus.on('goldenKeyEligible', (data) => {
      setGoldenKeyEligible(data.eligible);
      if (data.eligible) {
        addEvent('ðŸ”‘ Golden Key earned!');
      }
    });

    // Play timer expired event (V1 parity - triggers 30-second overlay)
    const unsubPlayExpired = eventBus.on('playTimerExpired', (data) => {
      setPlayExpiredPhase(data.phase || null);
      setShowPlayTimeExpired(true);
    });

    const timer = new TimerService(eventBus, {
      lessonKey,
      playTimerLimits,
      workPhaseTimeLimits
    });

    timerServiceRef.current = timer;

    // Apply any snapshot-restored timer state once timer exists
    if (pendingTimerStateRef.current) {
      try { timer.restoreState(pendingTimerStateRef.current); } catch {}
      pendingTimerStateRef.current = null;
    }

    return () => {
      try { unsubWorkTick?.(); } catch {}
      try { unsubWorkComplete?.(); } catch {}
      try { unsubGoldenKey?.(); } catch {}
      try { unsubPlayExpired?.(); } catch {}
      timer.destroy();
      timerServiceRef.current = null;
    };
  }, [lessonId, lessonKey, phaseTimers, goldenKeyBonus]);
  
  // Initialize KeyboardService
  useEffect(() => {
    if (!eventBusRef.current) return;
    
    const eventBus = eventBusRef.current;
    
    // Forward hotkey events
    const unsubHotkey = eventBus.on('hotkeyPressed', (data) => {
      handleHotkey(data);
    });
    
    const keyboard = new KeyboardService(eventBus);
    
    keyboardServiceRef.current = keyboard;
    keyboard.init();
    
    return () => {
      keyboard.destroy();
      keyboardServiceRef.current = null;
    };
  }, []);
  
  const addEvent = (msg) => {
    const timestamp = new Date().toLocaleTimeString();
    setEvents(prev => [`[${timestamp}] ${msg}`, ...prev].slice(0, 15));
  };

  // Learner target helper: no silent defaults. Returns positive integer or null (caller must block start).
  const getLearnerTarget = useCallback((phaseName) => {
    const asNumber = (v) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    const parsedTargets = (() => {
      const t = learnerProfile?.targets;
      if (!t) return null;
      if (typeof t === 'object') return t;
      if (typeof t === 'string') {
        try { return JSON.parse(t); } catch { return null; }
      }
      return null;
    })();

    const fromFlat = asNumber(learnerProfile && learnerProfile[phaseName]);
    const fromNested = asNumber(parsedTargets?.[phaseName]);
    // Legacy V1 fallback: some learners stored comprehension under "discussion" (V1 alias)
    const fromLegacy = phaseName === 'comprehension'
      ? (asNumber(learnerProfile && learnerProfile.discussion) ?? asNumber(parsedTargets?.discussion))
      : null;

    let fromOverride = null;
    // Use the pinned session learner id (or loaded profile id) to avoid override lookups drifting mid-session.
    const lid = sessionLearnerIdRef.current || learnerProfile?.id || null;
    try {
      const overrideKeys = [];
      if (lid && lid !== 'demo') {
        overrideKeys.push(`target_${phaseName}_${lid}`);
      }
      overrideKeys.push(`target_${phaseName}`);

      for (const key of overrideKeys) {
        const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
        const num = asNumber(raw);
        if (num && num > 0) {
          fromOverride = num;
          break;
        }
      }
    } catch {}

    const raw = [fromFlat, fromNested, fromLegacy, fromOverride].find(v => Number.isFinite(v) && v > 0) ?? null;
    if (!Number.isFinite(raw) || raw <= 0) {
      setLearnerError(`Missing learner target for ${phaseName}. Update the learner targets and retry.`);
      setError(null);
      addEvent(`⚠️ Missing learner target for ${phaseName}`);
      return null;
    }

    return Math.trunc(raw);
  }, [learnerProfile]);
  
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

  // Begin button handler: ensure phase exists, then start; start pending timer if queued.
  const handleBeginPhase = (phaseName) => {
    ensurePhaseInitialized(phaseName);
    const ref = getPhaseRef(phaseName);
    if (ref?.current?.start) {
      ref.current.start();
    } else {
      addEvent(`⚠️ Unable to start ${phaseName} (not initialized yet)`);
    }
    if (pendingPlayTimersRef.current?.[phaseName]) {
      startPhasePlayTimer(phaseName);
      delete pendingPlayTimersRef.current[phaseName];
    }
  };
  
  // Get timer duration for a phase and type from phaseTimers
  const getCurrentPhaseTimerDuration = useCallback((phaseName, timerType) => {
    if (!phaseTimers || !phaseName || !timerType) return 0;
    const key = `${phaseName}_${timerType}_min`;
    return phaseTimers[key] || 0;
  }, [phaseTimers]);
  
  // Handle timer time-up callback
  const handlePhaseTimerTimeUp = useCallback(() => {
    const phaseName = getCurrentPhaseName();
    if (!phaseName) return;
    
    const mode = currentTimerMode[phaseName];
    if (mode === 'play') {
      // Play time expired - show PlayTimeExpiredOverlay
      addEvent(`â±ï¸ Play time expired for ${phaseName}`);
      setPlayExpiredPhase(phaseName);
      setShowPlayTimeExpired(true);
    } else if (mode === 'work') {
      // Work time exceeded - track for golden key
      addEvent(`â±ï¸ Work time exceeded for ${phaseName}`);
    }
  }, [getCurrentPhaseName, currentTimerMode]);
  
  // Handle timer click (for facilitator controls)
  const handleTimerClick = useCallback(() => {
    console.log('[SessionPageV2] Timer clicked - showing timer control overlay');
    setShowTimerControl(true);
  }, []);
  
  // Handle timer pause toggle
  const handleTimerPauseToggle = useCallback(() => {
    setTimerPaused(prev => !prev);
  }, []);
  
  // Start play timer for a phase (called when phase begins)
  const startPhasePlayTimer = useCallback((phaseName) => {
    if (!phaseName) return;
    setCurrentTimerMode(prev => ({
      ...prev,
      [phaseName]: 'play'
    }));
    setTimerRefreshKey(prev => prev + 1);
    addEvent(`ðŸŽ‰ Play timer started for ${phaseName}`);
  }, []);
  
  // Transition from play to work timer (called when "Go" is clicked)
  const transitionToWorkTimer = useCallback((phaseName) => {
    if (!phaseName) return;
    
    // Clear the play timer storage so work timer starts fresh
    const playTimerKey = lessonKey ? `session_timer_state:${lessonKey}:${phaseName}:play` : null;
    try {
      if (playTimerKey) {
        sessionStorage.removeItem(playTimerKey);
      }
    } catch {}
    
    setCurrentTimerMode(prev => ({
      ...prev,
      [phaseName]: 'work'
    }));
    setTimerRefreshKey(prev => prev + 1);
    addEvent(`âœï¸ Work timer started for ${phaseName}`);
  }, [lessonKey]);
  
  // Handle PlayTimeExpiredOverlay countdown completion (auto-advance to work mode) - V1 parity
  const handlePlayExpiredComplete = useCallback(async () => {
    setShowPlayTimeExpired(false);
    const phaseToStart = playExpiredPhase;
    setPlayExpiredPhase(null);
    
    if (phaseToStart) {
      transitionToWorkTimer(phaseToStart);
      
      // Automatically start the lesson based on the current phase
      try {
        if (phaseToStart === 'discussion' || currentPhase === 'discussion' || currentPhase === 'teaching') {
          // Start teaching/discussion
            startSessionRef.current?.({ ignoreResume: true });
        } else if (phaseToStart === 'comprehension' || currentPhase === 'comprehension') {
          comprehensionPhaseRef.current?.go();
        } else if (phaseToStart === 'exercise' || currentPhase === 'exercise') {
          exercisePhaseRef.current?.go();
        } else if (phaseToStart === 'worksheet' || currentPhase === 'worksheet') {
          worksheetPhaseRef.current?.go();
        } else if (phaseToStart === 'test' || currentPhase === 'test') {
          testPhaseRef.current?.go();
        }
      } catch (e) {
        console.warn('[SessionPageV2] Auto-start failed:', e);
      }
    }
  }, [playExpiredPhase, currentPhase, transitionToWorkTimer]);
  
  // Handle manual "Start Now" from PlayTimeExpiredOverlay - V1 parity
  const handlePlayExpiredStartNow = useCallback(async () => {
    setShowPlayTimeExpired(false);
    const phaseToStart = playExpiredPhase;
    setPlayExpiredPhase(null);
    
    if (phaseToStart) {
      transitionToWorkTimer(phaseToStart);
      
      // Trigger the appropriate Go handler
      try {
        if (phaseToStart === 'discussion' || currentPhase === 'discussion' || currentPhase === 'teaching') {
            startSessionRef.current?.({ ignoreResume: true });
        } else if (phaseToStart === 'comprehension' || currentPhase === 'comprehension') {
          comprehensionPhaseRef.current?.go();
        } else if (phaseToStart === 'exercise' || currentPhase === 'exercise') {
          exercisePhaseRef.current?.go();
        } else if (phaseToStart === 'worksheet' || currentPhase === 'worksheet') {
          worksheetPhaseRef.current?.go();
        } else if (phaseToStart === 'test' || currentPhase === 'test') {
          testPhaseRef.current?.go();
        }
      } catch (e) {
        console.warn('[SessionPageV2] Start now failed:', e);
      }
    }
  }, [playExpiredPhase, currentPhase, transitionToWorkTimer]);
  
  // Handle timeline phase jump - allows user to click timeline to skip to a phase
  const handleTimelineJump = useCallback(async (targetPhase) => {
    console.log('[SessionPageV2] handleTimelineJump called with:', targetPhase);
    console.log('[SessionPageV2] timelineJumpInProgressRef:', timelineJumpInProgressRef);
    console.log('[SessionPageV2] timelineJumpInProgressRef.current:', timelineJumpInProgressRef.current);
    
    // Debounce: Block rapid successive clicks
    if (timelineJumpInProgressRef.current) {
      console.warn('[SessionPageV2] Timeline jump BLOCKED - jump already in progress for:', targetPhase);
      return;
    }
    
    // Set jump in progress flag IMMEDIATELY (before any async operations)
    timelineJumpInProgressRef.current = true;
    console.log('[SessionPageV2] Flag NOW set to true, value:', timelineJumpInProgressRef.current, 'for:', targetPhase);
    
    // Only allow jumping to valid phases
    const validPhases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
    if (!validPhases.includes(targetPhase)) {
      console.warn('[SessionPageV2] Invalid timeline jump target:', targetPhase);
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }
    
    // Guard: Need orchestrator
    if (!orchestratorRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked - no orchestrator');
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }
    
    // Guard: Need audio engine
    if (!audioEngineRef.current) {
      console.warn('[SessionPageV2] Timeline jump blocked - no audio engine');
      timelineJumpInProgressRef.current = false; // Reset flag on early return
      return;
    }
    
    console.log('[SessionPageV2] Timeline jump proceeding to:', targetPhase);
    
    // Stop any playing audio first
    try {
      if (audioEngineRef.current) {
        audioEngineRef.current.stop();
      }
    } catch (e) {
      console.warn('[SessionPageV2] Error stopping audio:', e);
    }
    
    // Ensure video is playing (unlock autoplay)
    try {
      if (videoRef.current && videoRef.current.paused) {
        videoRef.current.currentTime = 0;
        await videoRef.current.play();
      }
    } catch (e) {
      // Silent - video may need user interaction first
    }
    
    // Reset opening actions state to prevent zombie UI
    setOpeningActionActive(false);
    setOpeningActionType(null);
    setOpeningActionState({});
    
    // Destroy any existing phase controllers to avoid conflicts
    if (discussionPhaseRef.current) {
      try { discussionPhaseRef.current.destroy(); } catch {}
      discussionPhaseRef.current = null;
    }
    if (comprehensionPhaseRef.current) {
      try { comprehensionPhaseRef.current.destroy(); } catch {}
      comprehensionPhaseRef.current = null;
    }
    if (exercisePhaseRef.current) {
      try { exercisePhaseRef.current.destroy(); } catch {}
      exercisePhaseRef.current = null;
    }
    if (worksheetPhaseRef.current) {
      try { worksheetPhaseRef.current.destroy(); } catch {}
      worksheetPhaseRef.current = null;
    }
    if (testPhaseRef.current) {
      try { testPhaseRef.current.destroy(); } catch {}
      testPhaseRef.current = null;
    }
    if (closingPhaseRef.current) {
      try { closingPhaseRef.current.destroy(); } catch {}
      closingPhaseRef.current = null;
    }
    
    // Reset phase-specific states
    setDiscussionState('idle');
    setComprehensionState('idle');
    setExerciseState('idle');
    setWorksheetState('idle');
    setTestState('idle');
    
    // Hide PlayTimeExpiredOverlay if showing
    setShowPlayTimeExpired(false);
    setPlayExpiredPhase(null);
    
    // Clear timer storage for the target phase (fresh start)
    try {
      // Clear play timer storage
      if (lessonKey) {
        sessionStorage.removeItem(`session_timer_state:${lessonKey}:${targetPhase}:play`);
      }
      // Clear work timer storage
      if (lessonKey) {
        sessionStorage.removeItem(`session_timer_state:${lessonKey}:${targetPhase}:work`);
      }
      // Clear warning timer storage (30-second countdown)
      if (lessonKey) {
        sessionStorage.removeItem(`play_expired_warning:${lessonKey}:${targetPhase}`);
      }
    } catch {}
    
    // Use orchestrator's skipToPhase method - this will emit phaseChange
    // which triggers startComprehensionPhase/startExercisePhase/etc.
    orchestratorRef.current.skipToPhase(targetPhase);
    
    // Reset timer for the new phase
    // Discussion has no play timer - goes directly to work mode
    // All other phases start in play mode
    const timerMode = targetPhase === 'discussion' ? 'work' : 'play';
    setCurrentTimerMode(prev => ({
      ...prev,
      [targetPhase]: timerMode
    }));
    setTimerRefreshKey(k => k + 1);
    
    // Clear jump in progress flag after a short delay to allow phase to initialize
    setTimeout(() => {
      timelineJumpInProgressRef.current = false;
    }, 500);
  }, [lessonKey]);
  
  // Orientation and layout detection (matching V1)
  const [isMobileLandscape, setIsMobileLandscape] = useState(false);
  const [videoMaxHeight, setVideoMaxHeight] = useState(null);
  const [videoColPercent, setVideoColPercent] = useState(50);
  const [isShortHeight, setIsShortHeight] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [sideBySideHeight, setSideBySideHeight] = useState(null);
  const [stackedCaptionHeight, setStackedCaptionHeight] = useState(null);
  const videoColRef = useRef(null);
  const captionColRef = useRef(null);
  
  // Calculate video height and column width based on viewport (matching V1 logic)
  useEffect(() => {
    const calcVideoHeight = () => {
      try {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isLandscape = w > h;
        setIsMobileLandscape(isLandscape);
        setIsShortHeight(h <= 500);
        
        if (!isLandscape) {
          setVideoMaxHeight(null);
          setVideoColPercent(50);
          return;
        }
        
        // Multi-stage smooth ramp for video height: 40% at 375px -> 65% at 600px -> 70% at 700px -> 75% at 1000px
        let frac;
        if (h <= 375) {
          frac = 0.40;
        } else if (h <= 600) {
          const t = (h - 375) / (600 - 375);
          frac = 0.40 + t * (0.65 - 0.40);
        } else if (h <= 700) {
          const t = (h - 600) / (700 - 600);
          frac = 0.65 + t * (0.70 - 0.65);
        } else if (h <= 1000) {
          const t = (h - 700) / (1000 - 700);
          frac = 0.70 + t * (0.75 - 0.70);
        } else {
          frac = 0.75;
        }
        const target = Math.round(h * frac);
        setVideoMaxHeight(target);
        
        // Video column width: 30% at 500px -> 50% at 700px
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
        pct = Math.max(30, Math.min(50, Math.round(pct * 100) / 100));
        setVideoColPercent(pct);
      } catch {
        setVideoMaxHeight(null);
      }
    };
    
    calcVideoHeight();
    window.addEventListener('resize', calcVideoHeight);
    window.addEventListener('orientationchange', calcVideoHeight);
    
    // Listen to visualViewport for mobile URL bar changes
    let vv = null;
    try {
      vv = window.visualViewport || null;
    } catch {
      vv = null;
    }
    const handleVV = () => calcVideoHeight();
    if (vv) {
      try {
        vv.addEventListener('resize', handleVV);
      } catch {}
      try {
        vv.addEventListener('scroll', handleVV);
      } catch {}
    }
    
    return () => {
      window.removeEventListener('resize', calcVideoHeight);
      window.removeEventListener('orientationchange', calcVideoHeight);
      if (vv) {
        try {
          vv.removeEventListener('resize', handleVV);
        } catch {}
        try {
          vv.removeEventListener('scroll', handleVV);
        } catch {}
      }
    };
  }, []);
  
  // Measure video column height for side-by-side sync (landscape only)
  useEffect(() => {
    if (!isMobileLandscape) {
      setSideBySideHeight(null);
      return;
    }
    
    const v = videoColRef.current;
    if (!v) return;
    
    const measure = () => {
      try {
        const h = v.getBoundingClientRect().height;
        if (Number.isFinite(h) && h > 0) {
          const next = Math.round(h);
          setSideBySideHeight(prev => prev !== next ? next : prev);
        }
      } catch {}
    };
    
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      try {
        ro.observe(v);
      } catch {}
    } else {
      window.addEventListener('resize', measure);
      window.addEventListener('orientationchange', measure);
    }
    
    return () => {
      try {
        ro && ro.disconnect();
      } catch {}
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, [isMobileLandscape, videoMaxHeight]);
  
  // Auto-scroll transcript to bottom when new lines are added
  useEffect(() => {
    if (transcriptRef.current && transcriptLines.length > 0) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcriptLines]);
  
  // Initialize AudioEngine
  useEffect(() => {
    let cancelled = false;
    let retryTimer = null;

    const tryInit = () => {
      if (cancelled) return;

      const videoEl = videoRef.current;
      if (!videoEl) {
        // videoRef is a ref, so changes won't retrigger this effect.
        // Retry until the video element is mounted so the Begin button
        // doesn't get stuck in "Loading...".
        console.log('[SessionPageV2] VideoRef not ready yet');
        retryTimer = setTimeout(tryInit, 50);
        return;
      }

      if (audioEngineRef.current) {
        console.log('[SessionPageV2] AudioEngine already initialized');
        return;
      }

      console.log('[SessionPageV2] Initializing AudioEngine');
      const engine = new AudioEngine({ videoElement: videoEl });
      audioEngineRef.current = engine;
      setAudioReady(true);
      console.log('[SessionPageV2] AudioEngine ready, audioReady set to true');
    
    // Initialize audio system (required for iOS)
    const initAudio = async () => {
      try {
        await engine.initialize();
        addEvent('ðŸ”Š Audio initialized');
      } catch (err) {
        console.error('[SessionPageV2] Audio init failed:', err);
      }
    };
    
    // Auto-initialize on first user interaction
    const unlockAudio = () => {
      initAudio();
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
    
    // Subscribe to AudioEngine events
    engine.on('start', (data) => {
      addEvent('ðŸŽ¬ AudioEngine START');
      setEngineState('playing');
      setShowRepeatButton(false); // Hide repeat while playing
    });
    
    engine.on('end', (data) => {
      addEvent(`ðŸ AudioEngine END (completed: ${data.completed}, skipped: ${data.skipped || false})`);
      setEngineState('idle');
      // Show repeat button if there's audio to replay
      if (engine.hasAudioToReplay) {
        setShowRepeatButton(true);
      }
    });
    
    engine.on('captionChange', (data) => {
      setCurrentCaption(data.text);
      // Accumulate into transcript (skip duplicates and empty lines)
      if (data.text && data.text.trim()) {
        setTranscriptLines(prev => {
          if (prev.length > 0 && prev[prev.length - 1] === data.text) {
            return prev; // Skip duplicate
          }
          return [...prev, data.text];
        });
      }
    });
    
    engine.on('captionsDone', () => {
      setCurrentCaption('');
      // Don't clear transcript - it should persist
    });
    
    engine.on('error', (data) => {
      addEvent(`âŒ AudioEngine ERROR: ${data.message}`);
      setEngineState('error');
    });
    
      return () => {
        try {
          if (engine) engine.destroy();
        } finally {
          // Important: clear ref so a subsequent mount can re-subscribe.
          // Without this, a destroyed engine can linger with listeners cleared.
          if (audioEngineRef.current === engine) audioEngineRef.current = null;
        }
      };
    };

    const cleanupEngine = tryInit();

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (typeof cleanupEngine === 'function') cleanupEngine();
    };
  }, []);
  
  // Initialize TeachingController when lesson loads.
  // Note: audioEngineRef.current is a ref (not reactive). If lessonData loads
  // before AudioEngine is initialized, we must re-run once audioReady flips true.
  useEffect(() => {
    if (!lessonData || !audioEngineRef.current) return;
    
    const controller = new TeachingController({
      audioEngine: audioEngineRef.current,
      lessonData: lessonData,
      lessonMeta: {
        subject: subjectParam,
        difficulty: 'medium', // TODO: Parse from URL or lesson
        lessonId: lessonId,
        lessonTitle: lessonData?.title || lessonId || 'this topic'
      }
    });
    
    teachingControllerRef.current = controller;
    
    // Subscribe to TeachingController events
    controller.on('stageChange', (data) => {
      addEvent(`ðŸ“– Stage: ${data.stage} (${data.totalSentences} sentences)`);
      setTeachingStage(data.stage);
      setTotalSentences(data.totalSentences);
      setSentenceIndex(0);
      setIsInSentenceMode(true);
    });
    
    controller.on('sentenceAdvance', (data) => {
      addEvent(`âž¡ï¸ Sentence ${data.index + 1}/${data.total}`);
      setSentenceIndex(data.index);
    });
    
    controller.on('sentenceComplete', (data) => {
      addEvent(`âœ… Sentence ${data.index + 1} complete`);
    });
    
    controller.on('finalGateReached', (data) => {
      addEvent(`ðŸšª Final gate: ${data.stage}`);
      setIsInSentenceMode(false);
    });
    
    controller.on('requestSnapshotSave', (data) => {
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress(data.trigger, data.data);
      }
    });
    
    // Note: teachingComplete handled in startTeachingPhase, not here
    
    return () => {
      controller.destroy();
      teachingControllerRef.current = null;
    };
  }, [lessonData, audioReady]);
  
  // Initialize PhaseOrchestrator when lesson loads
  useEffect(() => {
    if (!lessonData) return;
    
    const orchestrator = new PhaseOrchestrator({
      lessonData: lessonData,
      useDiscussion: true // Enable discussion phase
    });
    
    orchestratorRef.current = orchestrator;
    
    // Initialize OpeningActionsController
    if (audioEngineRef.current && eventBusRef.current) {
      const openingController = new OpeningActionsController(
        eventBusRef.current,
        audioEngineRef.current,
        {
          phase: currentPhase,
          subject: lessonData.subject || 'math',
          learnerGrade: lessonData.grade || '',
          difficulty: lessonData.difficulty || 'moderate'
        }
      );
      
      openingActionsControllerRef.current = openingController;
      
      // Subscribe to opening action events
      eventBusRef.current.on('openingActionStart', (data) => {
        addEvent(`ðŸŽ¯ Opening action: ${data.type}`);
        setOpeningActionActive(true);
        setOpeningActionType(data.type);
        setOpeningActionState(openingController.getState() || {});
      });
      
      eventBusRef.current.on('openingActionComplete', (data) => {
        addEvent(`âœ… Opening action complete: ${data.type}`);
        setOpeningActionActive(false);
        setOpeningActionType(null);
        setOpeningActionState({});
      });
      
      eventBusRef.current.on('openingActionCancel', (data) => {
        addEvent(`âŒ Opening action cancelled: ${data.type}`);
        setOpeningActionActive(false);
        setOpeningActionType(null);
        setOpeningActionState({});
      });
    }
    
    // Subscribe to phase transitions
    orchestrator.on('phaseChange', (data) => {
      console.log('[SessionPageV2] phaseChange event received:', data.phase);
      console.log('[SessionPageV2] phaseChange audioEngineRef:', !!audioEngineRef.current);
      console.log('[SessionPageV2] phaseChange lessonData:', !!lessonData);
      addEvent(`ðŸ”„ Phase: ${data.phase}`);
      setCurrentPhase(data.phase);

      // Keep snapshot currentPhase aligned so granular saves write under the active phase.
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress('phase-change', { phaseOverride: data.phase });
      }
      
      // Update keyboard service phase
      if (keyboardServiceRef.current) {
        keyboardServiceRef.current.setPhase(data.phase);
      }
      
      // Start phase-specific controller
      if (data.phase === 'discussion') {
        startDiscussionPhase();
        // Discussion has no play timer - start directly in work mode
        setCurrentTimerMode(prev => ({ ...prev, discussion: 'work' }));
        setTimerRefreshKey(k => k + 1);
      } else if (data.phase === 'teaching') {
        startTeachingPhase();
        // Teaching uses discussion timer (grouped together, already in work mode)
      } else if (data.phase === 'comprehension') {
        const started = startComprehensionPhase();
        if (started) {
          // Start play timer for comprehension once phase exists
          startPhasePlayTimer('comprehension');
        } else {
          pendingPlayTimersRef.current.comprehension = true;
        }
      } else if (data.phase === 'exercise') {
        const started = startExercisePhase();
        if (started) {
          startPhasePlayTimer('exercise');
        } else {
          pendingPlayTimersRef.current.exercise = true;
        }
      } else if (data.phase === 'worksheet') {
        const started = startWorksheetPhase();
        if (started) {
          startPhasePlayTimer('worksheet');
        } else {
          pendingPlayTimersRef.current.worksheet = true;
        }
      } else if (data.phase === 'test') {
        const started = startTestPhase();
        if (started) {
          startPhasePlayTimer('test');
        } else {
          pendingPlayTimersRef.current.test = true;
        }
      } else if (data.phase === 'closing') {
        startClosingPhase();
      }
    });
    
    orchestrator.on('sessionComplete', (data) => {
      addEvent('ðŸ Session complete!');
      setCurrentPhase('complete');
      
      // Set prevention flag to block any snapshot saves during cleanup
      if (typeof window !== 'undefined') {
        window.__PREVENT_SNAPSHOT_SAVE__ = true;
      }
      
      // Show golden key status
      if (timerServiceRef.current) {
        const goldenKey = timerServiceRef.current.getGoldenKeyStatus();
        if (goldenKey.eligible) {
          addEvent(`ðŸ”‘ Golden Key Earned! (${goldenKey.onTimeCompletions}/3 on-time)`);
        } else {
          addEvent(`ðŸ”‘ Golden Key not earned (${goldenKey.onTimeCompletions}/3 on-time)`);
        }
      }
      
      // Delete snapshot (session finished)
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.deleteSnapshot().then(() => {
          addEvent('ðŸ’¾ Cleared session snapshot');
          
          // Clear prevention flag after cleanup completes
          if (typeof window !== 'undefined') {
            delete window.__PREVENT_SNAPSHOT_SAVE__;
          }
        }).catch(err => {
          console.error('[SessionPageV2] Delete snapshot error:', err);
          // Clear flag even on error
          if (typeof window !== 'undefined') {
            delete window.__PREVENT_SNAPSHOT_SAVE__;
          }
        });
      }
    });
    
    return () => {
      orchestrator.destroy();
      orchestratorRef.current = null;
    };
  }, [lessonData]);

  // If learnerProfile finishes loading after a Q&A phase was entered, initialize that phase and start any pending play timer.
  useEffect(() => {
    if (!learnerProfile) return;
    if (currentPhase === 'comprehension' || currentPhase === 'exercise' || currentPhase === 'worksheet' || currentPhase === 'test') {
      ensurePhaseInitialized(currentPhase);
    }
  }, [learnerProfile, currentPhase]);
  
  // Start discussion phase
  const startDiscussionPhase = () => {
    console.log('[SessionPageV2] startDiscussionPhase called');
    console.log('[SessionPageV2] audioEngineRef.current:', !!audioEngineRef.current);
    console.log('[SessionPageV2] eventBusRef.current:', !!eventBusRef.current);
    
    if (!audioEngineRef.current || !eventBusRef.current) return;

    const lessonTitle = lessonData?.title || lessonId || 'this topic';

    // Get learner name and lesson title
    const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || 'friend';
    
    console.log('[SessionPageV2] Creating DiscussionPhase with learnerName:', learnerName, 'lessonTitle:', lessonTitle);
    
    const phase = new DiscussionPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      learnerName: learnerName,
      lessonTitle: lessonTitle
    });
    

    discussionPhaseRef.current = phase;
    
    console.log('[SessionPageV2] Setting up event listeners');

    let didComplete = false;
    // Subscribe to events (capture unsubs so we can cleanly tear down)
    const unsubGreetingPlaying = eventBusRef.current.on('greetingPlaying', (data) => {
      addEvent(`ðŸ‘‹ Playing greeting: "${data.greetingText}"`);
      setDiscussionState('playing-greeting');
    });
    
    const unsubGreetingComplete = eventBusRef.current.on('greetingComplete', (data) => {
      addEvent('âœ… Greeting complete');
      setDiscussionState('complete');
    });
    
    const unsubDiscussionComplete = eventBusRef.current.on('discussionComplete', (data) => {
      if (didComplete) return;
      didComplete = true;

      addEvent('ðŸŽ‰ Discussion complete - proceeding to teaching');
      setDiscussionState('complete');

      // Cleanup FIRST to remove discussion audio end listener.
      try { unsubGreetingPlaying?.(); } catch {}
      try { unsubGreetingComplete?.(); } catch {}
      try { unsubDiscussionComplete?.(); } catch {}

      try { phase.destroy(); } catch {}
      discussionPhaseRef.current = null;
      
      // Save snapshot
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.savePhaseCompletion('discussion', {
          completed: true
        }).then(() => {
          addEvent('ðŸ’¾ Saved discussion progress');
        }).catch(err => {
          console.error('[SessionPageV2] Save discussion error:', err);
        });
      }
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onDiscussionComplete();
      }
    });
    
    // Start greeting
    console.log('[SessionPageV2] Calling phase.start()');
    phase.start();
  };
  
  // Start teaching phase
  const startTeachingPhase = () => {
    if (!teachingControllerRef.current) return;
    
    // Wire up teaching complete to orchestrator
    const handleTeachingComplete = (data) => {
      addEvent(`ðŸŽ‰ Teaching complete! (${data.vocabCount} vocab, ${data.exampleCount} examples)`);
      setTeachingStage('complete');
      
      // Save snapshot
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.savePhaseCompletion('teaching', {
          vocabCount: data.vocabCount,
          exampleCount: data.exampleCount
        }).then(() => {
          addEvent('ðŸ’¾ Saved teaching progress');
        }).catch(err => {
          console.error('[SessionPageV2] Save teaching error:', err);
        });
      }
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onTeachingComplete();
      }
    };
    
    teachingControllerRef.current.on('teachingComplete', handleTeachingComplete);
    teachingControllerRef.current.startTeaching({ autoplayFirstSentence: false });
  };
  
  // Start comprehension phase
  const startComprehensionPhase = () => {
    console.log('[SessionPageV2] startComprehensionPhase called');
    console.log('[SessionPageV2] startComprehensionPhase audioEngineRef:', !!audioEngineRef.current);
    if (!audioEngineRef.current || !lessonData) {
      console.log('[SessionPageV2] startComprehensionPhase - guard failed, returning early');
      return false;
    }
    if (!learnerProfile) {
      addEvent('⏸️ Learner not loaded yet - delaying comprehension init');
      return false;
    }

    const snapshot = snapshotServiceRef.current?.snapshot;
    const savedComp = snapshot?.phaseData?.comprehension || null;
    const savedCompQuestions = Array.isArray(savedComp?.questions) && savedComp.questions.length ? savedComp.questions : null;
    
    // Build comprehension questions from MC and TF pools (V1 parity: comprehension uses all question types)
    const compTarget = savedCompQuestions ? savedCompQuestions.length : getLearnerTarget('comprehension');
    if (!compTarget) return false;
    const questions = savedCompQuestions || buildQuestionPool(compTarget, []); // target-driven, no exclusions
    console.log('[SessionPageV2] startComprehensionPhase built questions:', questions.length);
    
    if (questions.length === 0) {
      // If no comprehension questions, skip to exercise
      addEvent('⚠️ No comprehension questions - skipping to exercise');
      if (orchestratorRef.current) {
        orchestratorRef.current.onComprehensionComplete();
      }
      return false;
    }

    // Persist question order immediately so mid-phase resume has deterministic pools.
    if (snapshotServiceRef.current) {
      snapshotServiceRef.current.saveProgress('comprehension-init', {
        phaseOverride: 'comprehension',
        questions,
        nextQuestionIndex: savedComp?.nextQuestionIndex || 0,
        score: savedComp?.score || 0,
        answers: savedComp?.answers || [],
        timerMode: savedComp?.timerMode || 'play'
      });
    }
    
    const phase = new ComprehensionPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions,
      resumeState: savedComp ? {
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
      }
      if (data.state === 'awaiting-answer') {
        addEvent('â“ Waiting for answer...');
      }
    });

    // Subscribe to question events (required for footer Q&A wiring)
    phase.on('questionStart', (data) => {
      setCurrentComprehensionQuestion(data.question);
      setComprehensionTotalQuestions(data.totalQuestions);
    });

    phase.on('questionReady', (data) => {
      setCurrentComprehensionQuestion(data.question);
      setComprehensionState('awaiting-answer');
    });

    phase.on('answerSubmitted', (data) => {
      setComprehensionScore(data.score);
      setComprehensionTotalQuestions(data.totalQuestions);
      setComprehensionAnswer('');
    });

    phase.on('questionSkipped', (data) => {
      setComprehensionScore(data.score);
      setComprehensionTotalQuestions(data.totalQuestions);
      setComprehensionAnswer('');
    });
    
    phase.on('comprehensionComplete', (data) => {
      addEvent(`âœ… Comprehension complete: ${data.answer || '(skipped)'}`);
      setComprehensionState('complete');
      
      // Save snapshot
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.savePhaseCompletion('comprehension', {
          answer: data.answer,
          submitted: !!data.answer
        }).then(() => {
          addEvent('ðŸ’¾ Saved comprehension progress');
        }).catch(err => {
          console.error('[SessionPageV2] Save comprehension error:', err);
        });
      }
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onComprehensionComplete();
      }
      
      // Cleanup
      phase.destroy();
      comprehensionPhaseRef.current = null;
    });
    
    phase.on('error', (data) => {
      addEvent(`âŒ Error: ${data.message}`);
    });
    
    phase.on('requestSnapshotSave', (data) => {
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress(data.trigger, data.data);
      }
    });
    
    // Don't auto-start - let Begin button call phase.start()
    // phase.start();
    return true;
  };
  
  // Start exercise phase
  // Helper: Build question pool from lesson data arrays (V1 parity)
  const buildQuestionPool = (target = 5, excludeTypes = []) => {
    const shuffle = (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    
    const tf = !excludeTypes.includes('tf') && Array.isArray(lessonData?.truefalse) 
      ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf', type: 'tf' })) : [];
    const mc = !excludeTypes.includes('mc') && Array.isArray(lessonData?.multiplechoice) 
      ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc', type: 'mc' })) : [];
    const fib = !excludeTypes.includes('fib') && Array.isArray(lessonData?.fillintheblank) 
      ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib', type: 'fib' })) : [];
    const sa = !excludeTypes.includes('short') && Array.isArray(lessonData?.shortanswer) 
      ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short', type: 'short' })) : [];
    
    // Pool all questions, shuffle, and take target count
    const pool = shuffle([...tf, ...mc, ...fib, ...sa]);
    return pool.slice(0, Math.min(target, pool.length));
  };

  const startExercisePhase = () => {
    console.log('[SessionPageV2] startExercisePhase called');
    console.log('[SessionPageV2] startExercisePhase audioEngineRef:', !!audioEngineRef.current);
    if (!audioEngineRef.current || !lessonData) {
      console.log('[SessionPageV2] startExercisePhase - guard failed, returning early');
      return false;
    }
    if (!learnerProfile) {
      addEvent('⏸️ Learner not loaded yet - delaying exercise init');
      return false;
    }

    const snapshot = snapshotServiceRef.current?.snapshot;
    const savedExercise = snapshot?.phaseData?.exercise || null;
    const savedExerciseQuestions = Array.isArray(savedExercise?.questions) && savedExercise.questions.length ? savedExercise.questions : null;
    
    const exerciseTarget = savedExerciseQuestions ? savedExerciseQuestions.length : getLearnerTarget('exercise');
    if (!exerciseTarget) return false;
    // Build exercise questions from MC and TF pools (V1 parity: exercise uses MC/TF)
    const questions = savedExerciseQuestions || buildQuestionPool(exerciseTarget, ['fib', 'short']);
    console.log('[SessionPageV2] startExercisePhase built questions:', questions.length);
    
    if (questions.length === 0) {
      // If no exercise questions, skip to worksheet
      addEvent('âš ï¸ No exercise questions - skipping to worksheet');
      if (orchestratorRef.current) {
        orchestratorRef.current.onExerciseComplete();
      }
      return false;
    }

    if (snapshotServiceRef.current) {
      snapshotServiceRef.current.saveProgress('exercise-init', {
        phaseOverride: 'exercise',
        questions,
        nextQuestionIndex: savedExercise?.nextQuestionIndex ?? savedExercise?.questionIndex ?? 0,
        score: savedExercise?.score || 0,
        answers: savedExercise?.answers || [],
        timerMode: savedExercise?.timerMode || 'play'
      });
    }
    
    const phase = new ExercisePhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions,
      resumeState: savedExercise ? {
        questions,
        nextQuestionIndex: savedExercise.nextQuestionIndex ?? savedExercise.questionIndex ?? 0,
        score: savedExercise.score || 0,
        answers: savedExercise.answers || [],
        timerMode: savedExercise.timerMode || 'work'
      } : null
    });
    
    exercisePhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setExerciseState(data.state);
      if (data.timerMode) {
        setExerciseTimerMode(data.timerMode);
      }
    });
    
    // Subscribe to question events
    phase.on('questionStart', (data) => {
      addEvent(`ðŸ“ Question ${data.questionIndex + 1}/${data.totalQuestions}`);
      setCurrentExerciseQuestion(data.question);
      setExerciseTotalQuestions(data.totalQuestions);
    });
    
    phase.on('questionReady', (data) => {
      setExerciseState('awaiting-answer');
      addEvent('â“ Question ready for answer...');
    });
    
    phase.on('answerSubmitted', (data) => {
      const result = data.isCorrect ? 'âœ… Correct!' : 'âŒ Incorrect';
      addEvent(`${result} (Score: ${data.score}/${data.totalQuestions})`);
      setExerciseScore(data.score);
      setSelectedExerciseAnswer('');
    });
    
    phase.on('questionSkipped', (data) => {
      addEvent(`â­ï¸ Skipped (Score: ${data.score}/${data.totalQuestions})`);
      setSelectedExerciseAnswer('');
    });
    
    phase.on('exerciseComplete', (data) => {
      addEvent(`ðŸŽ‰ Exercise complete! Score: ${data.score}/${data.totalQuestions} (${data.percentage}%)`);
      setExerciseState('complete');
      
      // Complete work phase timer
      if (timerServiceRef.current) {
        timerServiceRef.current.completeWorkPhaseTimer('exercise');
        const time = timerServiceRef.current.getWorkPhaseTime('exercise');
        if (time) {
          const status = time.onTime ? 'âœ… On time!' : 'â° Time exceeded';
          addEvent(`â±ï¸ Exercise completed in ${time.formatted} ${status}`);
        }
      }
      
      // Save snapshot
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.savePhaseCompletion('exercise', {
          score: data.score,
          totalQuestions: data.totalQuestions,
          percentage: data.percentage,
          answers: data.answers
        }).then(() => {
          addEvent('ðŸ’¾ Saved exercise progress');
        }).catch(err => {
          console.error('[SessionPageV2] Save exercise error:', err);
        });
      }
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onExerciseComplete();
      }
      
      // Cleanup
      phase.destroy();
      exercisePhaseRef.current = null;
    });
    
    phase.on('requestSnapshotSave', (data) => {
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress(data.trigger, data.data);
      }
    });
    
    // Don't auto-start - let Begin button call phase.start()
    // phase.start();
    return true;
  };
  
  // Start worksheet phase
  const startWorksheetPhase = () => {
    console.log('[SessionPageV2] startWorksheetPhase called');
    console.log('[SessionPageV2] startWorksheetPhase audioEngineRef:', !!audioEngineRef.current);
    if (!audioEngineRef.current || !lessonData) {
      console.log('[SessionPageV2] startWorksheetPhase - guard failed, returning early');
      return false;
    }
    if (!learnerProfile) {
      addEvent('⏸️ Learner not loaded yet - delaying worksheet init');
      return false;
    }

    const snapshot = snapshotServiceRef.current?.snapshot;
    const savedWorksheet = snapshot?.phaseData?.worksheet || null;
    const savedWorksheetQuestions = Array.isArray(savedWorksheet?.questions) && savedWorksheet.questions.length ? savedWorksheet.questions : null;
    
    // Build worksheet questions from FIB pool (V1 parity: worksheet uses fill-in-blank)
    const fib = Array.isArray(lessonData?.fillintheblank) 
      ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib', type: 'fib' })) : [];
    const worksheetTarget = savedWorksheetQuestions ? savedWorksheetQuestions.length : getLearnerTarget('worksheet');
    if (!worksheetTarget) return false;
    const questions = savedWorksheetQuestions || fib.slice(0, Math.min(worksheetTarget, fib.length));
    console.log('[SessionPageV2] startWorksheetPhase built questions:', questions.length);
    
    if (questions.length === 0) {
      // If no worksheet questions, skip to test
      addEvent('âš ï¸ No worksheet questions - skipping to test');
      if (orchestratorRef.current) {
        orchestratorRef.current.onWorksheetComplete();
      }
      return false;
    }

    if (snapshotServiceRef.current) {
      snapshotServiceRef.current.saveProgress('worksheet-init', {
        phaseOverride: 'worksheet',
        questions,
        nextQuestionIndex: savedWorksheet?.nextQuestionIndex ?? savedWorksheet?.questionIndex ?? 0,
        score: savedWorksheet?.score || 0,
        answers: savedWorksheet?.answers || [],
        timerMode: savedWorksheet?.timerMode || 'play'
      });
    }
    
    const phase = new WorksheetPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions,
      resumeState: savedWorksheet ? {
        questions,
        nextQuestionIndex: savedWorksheet.nextQuestionIndex ?? savedWorksheet.questionIndex ?? 0,
        score: savedWorksheet.score || 0,
        answers: savedWorksheet.answers || [],
        timerMode: savedWorksheet.timerMode || 'work'
      } : null
    });
    
    worksheetPhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setWorksheetState(data.state);
      if (data.timerMode) {
        setWorksheetTimerMode(data.timerMode);
      }
    });
    
    // Subscribe to question events
    phase.on('questionStart', (data) => {
      addEvent(`ðŸ“ Worksheet ${data.questionIndex + 1}/${data.totalQuestions}`);
      setCurrentWorksheetQuestion(data.question);
      setWorksheetTotalQuestions(data.totalQuestions);
      setLastWorksheetFeedback(null);
    });
    
    phase.on('questionReady', (data) => {
      setWorksheetState('awaiting-answer');
      addEvent('â“ Fill in the blank...');
    });
    
    phase.on('answerSubmitted', (data) => {
      const result = data.isCorrect ? 'âœ… Correct!' : `âŒ Incorrect - Answer: ${data.correctAnswer}`;
      addEvent(`${result} (Score: ${data.score}/${data.totalQuestions})`);
      setWorksheetScore(data.score);
      setWorksheetAnswer('');
      setLastWorksheetFeedback({
        isCorrect: data.isCorrect,
        correctAnswer: data.correctAnswer
      });
    });
    
    phase.on('questionSkipped', (data) => {
      addEvent(`â­ï¸ Skipped - Answer: ${data.correctAnswer} (Score: ${data.score}/${data.totalQuestions})`);
      setWorksheetAnswer('');
      setLastWorksheetFeedback({
        isCorrect: false,
        correctAnswer: data.correctAnswer
      });
    });
    
    phase.on('worksheetComplete', (data) => {
      addEvent(`ðŸŽ‰ Worksheet complete! Score: ${data.score}/${data.totalQuestions} (${data.percentage}%)`);
      setWorksheetState('complete');
      
      // Complete work phase timer
      if (timerServiceRef.current) {
        timerServiceRef.current.completeWorkPhaseTimer('worksheet');
        const time = timerServiceRef.current.getWorkPhaseTime('worksheet');
        if (time) {
          const status = time.onTime ? 'âœ… On time!' : 'â° Time exceeded';
          addEvent(`â±ï¸ Worksheet completed in ${time.formatted} ${status}`);
        }
      }
      
      // Save snapshot
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.savePhaseCompletion('worksheet', {
          score: data.score,
          totalQuestions: data.totalQuestions,
          percentage: data.percentage,
          answers: data.answers
        }).then(() => {
          addEvent('ðŸ’¾ Saved worksheet progress');
        }).catch(err => {
          console.error('[SessionPageV2] Save worksheet error:', err);
        });
      }
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onWorksheetComplete();
      }
      
      // Cleanup
      phase.destroy();
      worksheetPhaseRef.current = null;
    });
    
    phase.on('requestSnapshotSave', (data) => {
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress(data.trigger, data.data);
      }
    });
    
    // Don't auto-start - let Begin button call phase.start()
    // phase.start();
    return true;
  };
  
  // Start test phase
  const startTestPhase = () => {
    console.log('[SessionPageV2] startTestPhase called');
    console.log('[SessionPageV2] startTestPhase audioEngineRef:', !!audioEngineRef.current);
    if (!audioEngineRef.current || !lessonData) {
      console.log('[SessionPageV2] startTestPhase - guard failed, returning early');
      return false;
    }
    if (!learnerProfile) {
      addEvent('⏸️ Learner not loaded yet - delaying test init');
      return false;
    }

    const snapshot = snapshotServiceRef.current?.snapshot;
    const savedTest = snapshot?.phaseData?.test || null;
    const savedTestQuestions = Array.isArray(savedTest?.questions) && savedTest.questions.length ? savedTest.questions : null;
    
    const testTarget = savedTestQuestions ? savedTestQuestions.length : getLearnerTarget('test');
    if (!testTarget) return false;
    // Build test questions from all pools (V1 parity: test uses mix of all types)
    const questions = savedTestQuestions || buildQuestionPool(testTarget, []);
    console.log('[SessionPageV2] startTestPhase built questions:', questions.length);
    
    if (questions.length === 0) {
      // If no test questions, skip to closing
      addEvent('âš ï¸ No test questions - skipping to closing');
      if (orchestratorRef.current) {
        orchestratorRef.current.onTestComplete();
      }
      return false;
    }
    
    if (snapshotServiceRef.current) {
      snapshotServiceRef.current.saveProgress('test-init', {
        phaseOverride: 'test',
        questions,
        nextQuestionIndex: savedTest?.nextQuestionIndex ?? savedTest?.questionIndex ?? 0,
        score: savedTest?.score || 0,
        answers: savedTest?.answers || [],
        timerMode: savedTest?.timerMode || 'play',
        reviewIndex: savedTest?.reviewIndex || 0
      });
    }
    
    const phase = new TestPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions,
      resumeState: savedTest ? {
        questions,
        nextQuestionIndex: savedTest.nextQuestionIndex ?? savedTest.questionIndex ?? 0,
        score: savedTest.score || 0,
        answers: savedTest.answers || [],
        timerMode: savedTest.timerMode || 'work',
        reviewIndex: savedTest.reviewIndex || 0
      } : null
    });
    
    testPhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setTestState(data.state);
      if (data.timerMode) {
        setTestTimerMode(data.timerMode);
      }
    });
    
    // Subscribe to test events
    phase.on('questionStart', (data) => {
      addEvent(`ðŸ“ Test Question ${data.questionIndex + 1}/${data.totalQuestions}`);
      setCurrentTestQuestion(data.question);
      setTestTotalQuestions(data.totalQuestions);
      setTestAnswer('');
    });
    
    phase.on('questionReady', (data) => {
      setTestState('awaiting-answer');
      addEvent('â“ Answer the test question...');
    });
    
    phase.on('answerSubmitted', (data) => {
      const result = data.isCorrect ? 'âœ… Correct!' : 'âŒ Incorrect';
      addEvent(`${result} (Score: ${data.score}/${data.totalQuestions})`);
      setTestScore(data.score);
      setTestAnswer('');
    });
    
    phase.on('questionSkipped', (data) => {
      addEvent(`â­ï¸ Skipped (Score: ${data.score}/${data.totalQuestions})`);
      setTestAnswer('');
    });
    
    phase.on('testQuestionsComplete', (data) => {
      addEvent(`ðŸ“Š Test questions done! Score: ${data.score}/${data.totalQuestions} (${data.percentage}%) - Grade: ${data.grade}`);
      setTestGrade(data);
      setTestState('reviewing');
    });
    
    phase.on('reviewQuestion', (data) => {
      setTestReviewAnswer(data.answer);
      setTestReviewIndex(data.reviewIndex);
      addEvent(`ðŸ“– Review ${data.reviewIndex + 1}/${data.totalReviews}`);
    });
    
    phase.on('testComplete', (data) => {
      addEvent(`ðŸŽ‰ Test complete! Final grade: ${data.grade} (${data.percentage}%)`);
      setTestState('complete');
      
      // Complete work phase timer
      if (timerServiceRef.current) {
        timerServiceRef.current.completeWorkPhaseTimer('test');
        const time = timerServiceRef.current.getWorkPhaseTime('test');
        if (time) {
          const status = time.onTime ? 'âœ… On time!' : 'â° Time exceeded';
          addEvent(`â±ï¸ Test completed in ${time.formatted} ${status}`);
        }
        
        // Check golden key status
        const goldenKey = timerServiceRef.current.getGoldenKeyStatus();
        if (goldenKey.eligible) {
          addEvent('ðŸ”‘ Golden Key Earned! 3 on-time completions!');
        }
      }
      
      // Save snapshot
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.savePhaseCompletion('test', {
          score: data.score,
          totalQuestions: data.totalQuestions,
          percentage: data.percentage,
          grade: data.grade,
          answers: data.answers
        }).then(() => {
          addEvent('ðŸ’¾ Saved test progress');
        }).catch(err => {
          console.error('[SessionPageV2] Save test error:', err);
        });
      }
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onTestComplete();
      }
      
      // Cleanup
      phase.destroy();
      testPhaseRef.current = null;
    });
    
    phase.on('requestSnapshotSave', (data) => {
      if (snapshotServiceRef.current) {
        snapshotServiceRef.current.saveProgress(data.trigger, data.data);
      }
    });
    
    // Don't auto-start - let Begin button call phase.start()
    // phase.start();
    return true;
  };

  // Ensure a phase instance exists (e.g., when learner loads after phaseChange fired).
  const ensurePhaseInitialized = (phaseName) => {
    const refMap = {
      comprehension: comprehensionPhaseRef,
      exercise: exercisePhaseRef,
      worksheet: worksheetPhaseRef,
      test: testPhaseRef
    };
    const startMap = {
      comprehension: startComprehensionPhase,
      exercise: startExercisePhase,
      worksheet: startWorksheetPhase,
      test: startTestPhase
    };

    const ref = refMap[phaseName];
    const starter = startMap[phaseName];
    if (!ref || !starter) return false;
    if (ref.current) return true;
    if (!learnerProfile) return false;

    const started = starter();
    if (started && pendingPlayTimersRef.current?.[phaseName]) {
      startPhasePlayTimer(phaseName);
      delete pendingPlayTimersRef.current[phaseName];
    }
    return started;
  };
  
  // Start closing phase
  const startClosingPhase = () => {
    if (!audioEngineRef.current || !lessonData) return;
    
    const phase = new ClosingPhase({
      audioEngine: audioEngineRef.current,
      lessonTitle: lessonData.title || 'this lesson'
    });
    
    closingPhaseRef.current = phase;
    
    // Subscribe to state changes
    phase.on('stateChange', (data) => {
      setClosingState(data.state);
      setClosingMessage(data.message);
      if (data.state === 'playing') {
        addEvent(`ðŸ’¬ Closing: ${data.message}`);
      }
    });
    
    phase.on('closingComplete', (data) => {
      addEvent('âœ… Closing complete');
      setClosingState('complete');
      
      // Notify orchestrator
      if (orchestratorRef.current) {
        orchestratorRef.current.onClosingComplete();
      }
      
      // Cleanup
      phase.destroy();
      closingPhaseRef.current = null;
    });
    
    // Don't auto-start - let Begin button call phase.start()
    // phase.start();
  };
  
  // Handle keyboard hotkeys
  const handleHotkey = (data) => {
    const { action, phase, key } = data;
    
    addEvent(`âŒ¨ï¸ Hotkey: ${key} (${action})`);
    
    // Handle phase-specific actions
    if (action === 'skip') {
      if (phase === 'teaching') {
        skipSentence();
      } else if (phase === 'discussion') {
        skipDiscussion();
      } else if (phase === 'comprehension') {
        skipComprehension();
      } else if (phase === 'exercise') {
        skipExerciseQuestion();
      } else if (phase === 'worksheet') {
        skipWorksheetQuestion();
      } else if (phase === 'test') {
        skipTestQuestion();
      }
    } else if (action === 'repeat' && phase === 'teaching') {
      repeatSentence();
    } else if (action === 'next' && phase === 'teaching') {
      nextSentence();
    } else if (action === 'pause') {
      // Toggle pause/resume
      if (audioEngineRef.current) {
        const state = audioEngineRef.current.state;
        if (state === 'playing') {
          pauseAudio();
        } else if (state === 'paused') {
          resumeAudio();
        }
      }
    } else if (action === 'stop') {
      stopAudio();
    }
  };
  
  const startSession = async (options = {}) => {
    if (!orchestratorRef.current) {
      console.warn('[SessionPageV2] No orchestrator');
      return;
    }
    
    if (!audioEngineRef.current) {
      console.error('[SessionPageV2] Audio engine not ready');
      return;
    }
    
    // Start prefetching all teaching content immediately (background, non-blocking)
    if (teachingControllerRef.current) {
      teachingControllerRef.current.prefetchAll();
      addEvent('ðŸ”„ Started background prefetch of teaching content');
    }
    
    // Unlock video playback for Chrome autoplay policy
    try {
      if (videoRef.current) {
        if (videoRef.current.readyState < 2) {
          videoRef.current.load();
          // Wait a moment for load to register
          await new Promise(r => setTimeout(r, 100));
        }
        // Seek to first frame and start playing
        try {
          videoRef.current.currentTime = 0;
          await videoRef.current.play();
        } catch (e) {
          // Fallback: briefly play then pause to unlock autoplay, then play again
          const playPromise = videoRef.current.play();
          if (playPromise && playPromise.then) {
            await playPromise.then(() => {
              try { videoRef.current.pause(); } catch {}
              // Now play for real
              try { videoRef.current.play(); } catch {}
            }).catch(() => {});
          }
        }
      }
    } catch (e) {
      // Silent error handling
    }
    
    const normalizeResumePhase = (phase) => {
      // Defensive: old snapshots may contain sub-phases that aren't valid orchestrator phases.
      if (!phase) return null;
      if (phase === 'grading' || phase === 'congrats') return 'test';
      if (phase === 'complete') return 'closing';
      return phase;
    };

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

  // Allow early-declared callbacks to invoke startSession without TDZ issues.
  startSessionRef.current = startSession;
  
  const startTeaching = async (options = {}) => {
    if (!teachingControllerRef.current) return;
    await teachingControllerRef.current.startTeaching(options);
  };
  
  const nextSentence = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.nextSentence();
  };
  
  const repeatSentence = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.repeatSentence();
  };
  
  const skipToExamples = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.skipToExamples();
  };
  
  const restartStage = () => {
    if (!teachingControllerRef.current) return;
    teachingControllerRef.current.restartStage();
  };
  
  const stopAudio = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.stop();
  };
  
  const pauseAudio = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.pause();
  };
  
  const resumeAudio = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.resume();
  };
  
  const toggleMute = () => {
    if (!audioEngineRef.current) return;
    const newMuted = !audioEngineRef.current.isMuted;
    audioEngineRef.current.setMuted(newMuted);
    setIsMuted(newMuted);
  };
  
  // Skip current TTS playback
  const skipTTS = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.stop();
  };
  
  // Skip sentence (hotkey handler for teaching phase)
  const skipSentence = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.stop();
  };
  
  // Replay current sentence
  const replayTTS = () => {
    if (!audioEngineRef.current) return;
    audioEngineRef.current.replay();
  };
  
  // Discussion handlers
  const submitDiscussionResponse = () => {
    if (!discussionPhaseRef.current) return;
    discussionPhaseRef.current.submitResponse(discussionResponse);
    setDiscussionResponse(''); // Clear input after submit
  };
  
  const skipDiscussion = () => {
    if (!discussionPhaseRef.current) return;
    discussionPhaseRef.current.skip();
    setDiscussionResponse(''); // Clear input on skip
  };
  
  // Comprehension handlers
  const submitComprehensionAnswer = () => {
    if (!comprehensionPhaseRef.current) return;
    comprehensionPhaseRef.current.submitAnswer(comprehensionAnswer);
  };
  
  const skipComprehension = () => {
    if (!comprehensionPhaseRef.current) return;
    comprehensionPhaseRef.current.skip();
  };
  
  // Exercise handlers
  const submitExerciseAnswer = () => {
    if (!exercisePhaseRef.current || !selectedExerciseAnswer) return;
    exercisePhaseRef.current.submitAnswer(selectedExerciseAnswer);
  };
  
  const skipExerciseQuestion = () => {
    if (!exercisePhaseRef.current) return;
    exercisePhaseRef.current.skip();
  };
  
  // Worksheet handlers
  const submitWorksheetAnswer = () => {
    if (!worksheetPhaseRef.current || !worksheetAnswer.trim()) return;
    worksheetPhaseRef.current.submitAnswer(worksheetAnswer);
  };
  
  const skipWorksheetQuestion = () => {
    if (!worksheetPhaseRef.current) return;
    worksheetPhaseRef.current.skip();
  };
  
  // Test handlers
  const submitTestAnswer = () => {
    if (!testPhaseRef.current) return;
    
    const question = currentTestQuestion;
    if (!question) return;
    
    if (question.type === 'fill' || question.type === 'fib' || question.sourceType === 'fib') {
      if (!testAnswer.trim()) return;
      testPhaseRef.current.submitAnswer(testAnswer);
    } else {
      // MC/TF
      if (!testAnswer) return;
      testPhaseRef.current.submitAnswer(testAnswer);
    }
  };
  
  const skipTestQuestion = () => {
    if (!testPhaseRef.current) return;
    testPhaseRef.current.skip();
  };
  
  const nextTestReview = () => {
    if (!testPhaseRef.current) return;
    testPhaseRef.current.nextReview();
  };
  
  const previousTestReview = () => {
    if (!testPhaseRef.current) return;
    testPhaseRef.current.previousReview();
  };
  
  const skipTestReview = () => {
    if (!testPhaseRef.current) return;
    testPhaseRef.current.skipReview();
  };
  
  // Loading state: both lesson AND learner must be loaded
  if (loading || learnerLoading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: '1.125rem', color: '#1f2937' }}>
          {loading ? 'Loading lesson...' : 'Loading learner profile...'}
        </div>
      </div>
    );
  }
  
  // Error state: show learner error if present (required), otherwise lesson error
  if (learnerError) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: 24, borderRadius: 8, maxWidth: 448, textAlign: 'center' }}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Learner Profile Required</h2>
          <p style={{ marginBottom: 16 }}>{learnerError}</p>
          <a 
            href="/facilitator/learners" 
            style={{ 
              display: 'inline-block',
              background: '#1f2937', 
              color: '#fff', 
              padding: '10px 20px', 
              borderRadius: 8, 
              textDecoration: 'none',
              fontWeight: 600
            }}
          >
            Go to Learners
          </a>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: 24, borderRadius: 8, maxWidth: 448 }}>
          <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Error loading lesson</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }
  
  // Layout wrapper style: side-by-side in landscape, stacked in portrait
  const videoEffectiveHeight = (videoMaxHeight && Number.isFinite(videoMaxHeight)) ? videoMaxHeight : null;
  const msSideBySideH = videoEffectiveHeight ? `${videoEffectiveHeight}px` : (sideBySideHeight ? `${sideBySideHeight}px` : 'auto');
  
  const mainLayoutStyle = isMobileLandscape
    ? { display: 'flex', alignItems: 'stretch', width: '100%', height: '100vh', overflow: 'hidden', background: '#ffffff', paddingBottom: 4, paddingTop: 'clamp(32px, 7vh, 52px)', '--msSideBySideH': msSideBySideH }
    : { display: 'flex', flexDirection: 'column', width: '100%', minHeight: '100vh', background: '#ffffff' };
  
  const videoWrapperStyle = isMobileLandscape
    ? { flex: `0 0 ${videoColPercent}%`, position: 'relative', overflow: 'visible', background: 'transparent', minWidth: 0, minHeight: 0, height: 'var(--msSideBySideH)', display: 'flex', flexDirection: 'column' }
    : { position: 'relative', width: '100%', margin: '0 auto' };
  
  // Dynamic height style: in landscape with videoMaxHeight, override aspectRatio with explicit height
  const dynamicHeightStyle = (isMobileLandscape && videoMaxHeight) ? { maxHeight: videoMaxHeight, height: videoMaxHeight, minHeight: 0 } : {};
  
  const videoInnerStyle = isMobileLandscape
    ? { position: 'relative', overflow: 'hidden', aspectRatio: '16 / 7.2', minHeight: 200, width: '100%', background: '#000', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', ...dynamicHeightStyle }
    : { position: 'relative', overflow: 'hidden', height: '35vh', width: '92%', margin: '0 auto', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000' };
  
  const transcriptWrapperStyle = isMobileLandscape
    ? { flex: `0 0 ${100 - videoColPercent}%`, display: 'flex', flexDirection: 'column', overflow: 'visible', minWidth: 0, minHeight: 0, background: 'transparent', height: 'var(--msSideBySideH)', maxHeight: 'var(--msSideBySideH)' }
    : { flex: '1 1 auto', display: 'flex', flexDirection: 'column', overflow: 'auto', background: '#ffffff', paddingLeft: '4%', paddingRight: '4%', paddingBottom: 'calc(68px + env(safe-area-inset-bottom, 0px))', marginTop: 8 };
  
  return (
    <>
      {/* Content wrapper - add horizontal gutters in landscape */}
      <div style={isMobileLandscape ? { width: '100%', paddingLeft: 8, paddingRight: 8, boxSizing: 'border-box' } : { width: '100%' }}>
        
      {/* Phase Timeline - absolutely positioned in landscape to not add to page height */}
      <div style={{
        position: isMobileLandscape ? 'absolute' : 'relative',
        top: isMobileLandscape ? 52 : 'auto',
        left: isMobileLandscape ? 0 : 'auto',
        right: isMobileLandscape ? 0 : 'auto',
        zIndex: 9999,
        width: isMobileLandscape ? '100%' : '92%',
        maxWidth: 600,
        margin: '0 auto',
        background: isMobileLandscape ? 'transparent' : '#ffffff',
        paddingTop: isMobileLandscape ? 2 : 'clamp(0.25rem, 1vw, 0.625rem)',
        paddingBottom: isMobileLandscape ? 2 : 'clamp(0.25rem, 1vw, 0.625rem)',
        paddingLeft: isMobileLandscape ? '0.5%' : '2%',
        paddingRight: isMobileLandscape ? '0.5%' : '2%',
        boxSizing: 'border-box'
      }}>
        <Timeline
          timelinePhases={timelinePhases}
          timelineHighlight={timelineHighlight}
          compact={isMobileLandscape}
          onJumpPhase={handleTimelineJump}
        />
      </div>
      
      {/* Main layout */}
      <div style={mainLayoutStyle}>
        {/* Video column */}
      <div ref={videoColRef} style={videoWrapperStyle}>
        <div style={videoInnerStyle}>
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
          
          {/* Phase Timer - top left overlay (matching V1) */}
          {phaseTimers && getCurrentPhaseName() && currentTimerMode[getCurrentPhaseName()] && (
            <div style={{ 
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 10001
            }}>
              <SessionTimer
                key={`phase-timer-${getCurrentPhaseName()}-${currentTimerMode[getCurrentPhaseName()]}-${timerRefreshKey}`}
                phase={getCurrentPhaseName()}
                timerType={currentTimerMode[getCurrentPhaseName()]}
                totalMinutes={getCurrentPhaseTimerDuration(getCurrentPhaseName(), currentTimerMode[getCurrentPhaseName()])}
                goldenKeyBonus={currentTimerMode[getCurrentPhaseName()] === 'play' ? goldenKeyBonus : 0}
                isPaused={timerPaused}
                onTimeUp={handlePhaseTimerTimeUp}
                onPauseToggle={handleTimerPauseToggle}
                lessonKey={lessonKey}
                onTimerClick={handleTimerClick}
              />
            </div>
          )}
          
          {/* Video overlay controls - bottom right (mute) */}
          <div style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            display: 'flex',
            gap: 12,
            zIndex: 10
          }}>
            <button
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              title={isMuted ? 'Unmute' : 'Mute'}
              style={{
                background: '#1f2937',
                color: '#fff',
                border: 'none',
                width: 'clamp(34px, 6.2vw, 52px)',
                height: 'clamp(34px, 6.2vw, 52px)',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
              }}
            >
              {isMuted ? (
                <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6" /><path d="M17 9l6 6" /></svg>
              ) : (
                <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19 8a5 5 0 010 8" /><path d="M15 11a2 2 0 010 2" /></svg>
              )}
            </button>
          </div>
          
          {/* Skip button - bottom left (only when speaking) */}
          {engineState === 'playing' && (
            <button
              type="button"
              onClick={skipTTS}
              aria-label="Skip"
              title="Skip"
              style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                background: '#1f2937',
                color: '#fff',
                border: 'none',
                width: 'clamp(34px, 6.2vw, 52px)',
                height: 'clamp(34px, 6.2vw, 52px)',
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
          
          {/* Repeat button - bottom left (when not speaking but audio available) */}
          {engineState !== 'playing' && showRepeatButton && (
            <button
              type="button"
              onClick={replayTTS}
              aria-label="Repeat"
              title="Repeat"
              style={{
                position: 'absolute',
                bottom: 16,
                left: 16,
                background: '#1f2937',
                color: '#fff',
                border: 'none',
                width: 'clamp(34px, 6.2vw, 52px)',
                height: 'clamp(34px, 6.2vw, 52px)',
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
        </div>
      
      {/* Score ticker - top right */}
      {/* Comprehension/Exercise score counter - top right */}
      {(currentPhase === 'comprehension' && comprehensionState === 'awaiting-answer') && (
        <div style={{ 
          position: 'absolute', 
          top: 8, 
          right: 8, 
          background: 'rgba(17,24,39,0.78)', 
          color: '#fff', 
          padding: '6px 10px', 
          borderRadius: 8, 
          fontSize: 'clamp(0.85rem, 1.6vw, 1rem)', 
          fontWeight: 600, 
          letterSpacing: 0.3, 
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)', 
          zIndex: 10000, 
          pointerEvents: 'none' 
        }}>
          {comprehensionScore}/{comprehensionTotalQuestions}
        </div>
      )}
      
      {currentPhase === 'exercise' && (
        <div style={{ 
          position: 'absolute', 
          top: 8, 
          right: 8, 
          background: 'rgba(17,24,39,0.78)', 
          color: '#fff', 
          padding: '6px 10px', 
          borderRadius: 8, 
          fontSize: 'clamp(0.85rem, 1.6vw, 1rem)', 
          fontWeight: 600, 
          letterSpacing: 0.3, 
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)', 
          zIndex: 10000, 
          pointerEvents: 'none' 
        }}>
          {exerciseScore}/{exerciseTotalQuestions}
        </div>
      )}
      
      {/* Worksheet/Test question counter - top right */}
      {((currentPhase === 'worksheet' && worksheetState === 'awaiting-answer') || (currentPhase === 'test' && testState === 'awaiting-answer')) && (
        <div style={{ 
          position: 'absolute', 
          top: 8, 
          right: 8, 
          background: 'rgba(17,24,39,0.78)', 
          color: '#fff', 
          padding: '6px 10px', 
          borderRadius: 8, 
          fontSize: 'clamp(0.85rem, 1.6vw, 1rem)', 
          fontWeight: 600, 
          letterSpacing: 0.3, 
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)', 
          zIndex: 10000, 
          pointerEvents: 'none' 
        }}>
          Question {currentPhase === 'worksheet' ? (worksheetScore + 1) : (testScore + 1)}
        </div>
      )}
      
      
      {/* Captions are shown only in the transcript panel (no video overlay). */}
      
      
      {/* Captions are shown only in the transcript panel (no video overlay). */}
      
        {/* Audio Transport Controls - Hidden debug panel (press ~ to toggle) */}
        {false && ( // Set to true to enable debug panels
        <div style={{ position: 'absolute', top: 100, right: 20, background: 'rgba(255,255,255,0.95)', borderRadius: 12, padding: 20, maxWidth: 400, maxHeight: '80vh', overflow: 'auto', zIndex: 9000 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: 16 }}>Audio Transport</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={stopAudio}
                style={{ padding: '6px 12px', fontSize: '0.875rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Stop
              </button>
              <button
                onClick={pauseAudio}
                style={{ padding: '6px 12px', fontSize: '0.875rem', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Pause
              </button>
              <button
                onClick={resumeAudio}
                style={{ padding: '6px 12px', fontSize: '0.875rem', background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Resume
              </button>
              <button
                onClick={toggleMute}
                style={{ padding: '6px 12px', fontSize: '0.875rem', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
              >
                Toggle Mute
              </button>
            </div>
          </div>
        
        {/* Current Sentence */}
        {teachingControllerRef.current && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Current Sentence</h2>
            <div className="text-xl p-4 bg-blue-50 rounded min-h-[80px] flex items-center">
              {teachingControllerRef.current.currentSentence || (
                <span className="text-gray-400">No sentence</span>
              )}
            </div>
          </div>
        )}
        
        {/* Live Caption */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Live Caption</h2>
          <div className="text-2xl text-center py-8 min-h-[120px] flex items-center justify-center">
            {currentCaption || <span className="text-gray-400">No caption</span>}
          </div>
        </div>
        
        {/* System State */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">System State</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold text-gray-600 mb-1">TeachingController</div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  teachingStage === 'definitions' || teachingStage === 'examples' ? 'bg-blue-500' :
                  teachingStage === 'complete' ? 'bg-green-500' :
                  'bg-gray-300'
                }`} />
                <span className="font-mono">{teachingStage}</span>
              </div>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-600 mb-1">AudioEngine</div>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  engineState === 'playing' ? 'bg-green-500' :
                  engineState === 'error' ? 'bg-red-500' :
                  'bg-gray-300'
                }`} />
                <span className="font-mono">{engineState}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Keyboard Hotkeys */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Keyboard Hotkeys</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-mono text-gray-600">PageDown</span>
              <span>Skip current item</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-gray-600">PageUp</span>
              <span>Repeat (teaching)</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-gray-600">End</span>
              <span>Next sentence (teaching)</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-gray-600">Space</span>
              <span>Pause/Resume audio</span>
            </div>
            <div className="flex justify-between">
              <span className="font-mono text-gray-600">Escape</span>
              <span>Stop audio</span>
            </div>
          </div>
        </div>
        
        {/* Event Log */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Event Log</h2>
          <div className="space-y-1 font-mono text-sm">
            {events.length === 0 && (
              <div className="text-gray-400">No events yet</div>
            )}
            {events.map((event, i) => (
              <div key={i} className="text-gray-700">{event}</div>
            ))}
          </div>
        </div>
        
        </div>
        )}
      
      </div>
      
      {/* Transcript column */}
      <div style={transcriptWrapperStyle}>
        <div 
          ref={transcriptRef}
          style={{
          background: '#ffffff',
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          padding: 12,
          flex: isMobileLandscape ? '1 1 auto' : '1 1 auto',
          height: isMobileLandscape ? '100%' : 'auto',
          overflow: 'auto',
          fontSize: 'clamp(1.125rem, 2.4vw, 1.5rem)',
          lineHeight: 1.5,
          color: '#111111',
          boxSizing: 'border-box'
        }}>
          {transcriptLines.length > 0 ? (
            <div style={{ whiteSpace: 'pre-line' }}>
              {transcriptLines.map((line, idx) => (
                <p key={idx} style={{ marginBottom: '0.5em' }}>{line}</p>
              ))}
            </div>
          ) : (
            <div style={{ color: '#6b7280' }}>Transcript will appear here...</div>
          )}
        </div>
      </div>
      
      </div> {/* end main layout */}
      </div> {/* end content wrapper */}
      
      {/* Fixed footer with input controls */}
      <div style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999,
        background: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.06)'
      }}>
        <div style={{
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          padding: (isShortHeight && isMobileLandscape) ? '2px 16px calc(2px + env(safe-area-inset-bottom, 0px))' : '4px 12px calc(4px + env(safe-area-inset-bottom, 0px))'
        }}>
          
          {/* Opening Actions + GO button - shown AFTER Begin pressed, during play timer */}
          {((currentPhase === 'comprehension' && comprehensionState === 'awaiting-go') ||
            (currentPhase === 'exercise' && exerciseState === 'awaiting-go') ||
            (currentPhase === 'worksheet' && worksheetState === 'awaiting-go') ||
            (currentPhase === 'test' && testState === 'awaiting-go')) && !openingActionActive && (
            <div style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              justifyContent: 'center',
              marginBottom: 8,
              padding: '0 12px'
            }}>
              <button
                onClick={() => {
                  if (currentPhase === 'comprehension') {
                    transitionToWorkTimer('comprehension');
                    comprehensionPhaseRef.current?.go();
                  } else if (currentPhase === 'exercise') {
                    transitionToWorkTimer('exercise');
                    exercisePhaseRef.current?.go();
                  } else if (currentPhase === 'worksheet') {
                    transitionToWorkTimer('worksheet');
                    worksheetPhaseRef.current?.go();
                  } else if (currentPhase === 'test') {
                    transitionToWorkTimer('test');
                    testPhaseRef.current?.go();
                  }
                }}
                style={{
                  padding: '10px 20px',
                  fontSize: 'clamp(1rem, 2vw, 1.125rem)',
                  background: '#c7442e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(199,68,46,0.4)'
                }}
              >
                GO!
              </button>
              <button
                onClick={() => openingActionsControllerRef.current?.startAsk()}
                style={{
                  padding: '8px 16px',
                  fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                  background: '#3b82f6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Ask Ms. Sonoma
              </button>
              <button
                onClick={() => openingActionsControllerRef.current?.startRiddle()}
                style={{
                  padding: '8px 16px',
                  fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                  background: '#8b5cf6',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Riddle
              </button>
              <button
                onClick={() => openingActionsControllerRef.current?.startPoem()}
                style={{
                  padding: '8px 16px',
                  fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                  background: '#ec4899',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Poem
              </button>
              <button
                onClick={() => openingActionsControllerRef.current?.startStory()}
                style={{
                  padding: '8px 16px',
                  fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                  background: '#f59e0b',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Story
              </button>
              <button
                onClick={() => openingActionsControllerRef.current?.startFillInFun()}
                style={{
                  padding: '8px 16px',
                  fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Fill-in-Fun
              </button>
            </div>
          )}
          
          {/* Phase-specific Begin buttons */}
          {(() => {
            const needBeginDiscussion = (currentPhase === 'idle');
            const needBeginComp = (currentPhase === 'comprehension' && (!comprehensionState || comprehensionState === 'idle'));
            const needBeginExercise = (currentPhase === 'exercise' && (!exerciseState || exerciseState === 'idle'));
            const needBeginWorksheet = (currentPhase === 'worksheet' && (!worksheetState || worksheetState === 'idle'));
            const needBeginTest = (currentPhase === 'test' && (!testState || testState === 'idle'));
            if (!(needBeginDiscussion || needBeginComp || needBeginExercise || needBeginWorksheet || needBeginTest)) return null;

            const offerResume = !!snapshotLoaded && !!resumePhase && resumePhase !== 'idle' && resumePhase !== 'discussion';
            
            const ctaStyle = {
              background: '#c7442e',
              color: '#fff',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 800,
              fontSize: 'clamp(1rem, 2.6vw, 1.125rem)',
              border: 'none',
              boxShadow: '0 2px 12px rgba(199,68,46,0.28)',
              cursor: 'pointer'
            };
            
            return (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                paddingLeft: 12,
                paddingRight: 12,
                marginBottom: 4
              }}>
                {needBeginDiscussion && (
                  offerResume ? (
                    <>
                      <button
                        type="button"
                        style={{...ctaStyle, opacity: (audioReady && snapshotLoaded) ? 1 : 0.5}}
                        onClick={startSession}
                        disabled={!(audioReady && snapshotLoaded)}
                      >
                        Resume
                      </button>
                      <button
                        type="button"
                        style={{
                          ...ctaStyle,
                          background: '#374151',
                          boxShadow: '0 2px 12px rgba(17,24,39,0.24)',
                          opacity: (audioReady && snapshotLoaded) ? 1 : 0.5
                        }}
                        onClick={async () => {
                          try { await snapshotServiceRef.current?.deleteSnapshot?.(); } catch {}
                          resumePhaseRef.current = null;
                          setResumePhase(null);
                          try { timerServiceRef.current?.reset?.(); } catch {}
                          try { await startSession({ ignoreResume: true }); } catch {}
                        }}
                        disabled={!(audioReady && snapshotLoaded)}
                      >
                        Start Over
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      style={{...ctaStyle, opacity: (audioReady && snapshotLoaded) ? 1 : 0.5}}
                      onClick={startSession}
                      disabled={!(audioReady && snapshotLoaded)}
                    >
                      {(audioReady && snapshotLoaded) ? 'Begin' : 'Loading...'}
                    </button>
                  )
                )}
                {needBeginComp && (
                  <button type="button" style={ctaStyle} onClick={() => handleBeginPhase('comprehension')}>
                    Begin Comprehension
                  </button>
                )}
                {needBeginExercise && (
                  <button type="button" style={ctaStyle} onClick={() => handleBeginPhase('exercise')}>
                    Begin Exercise
                  </button>
                )}
                {needBeginWorksheet && (
                  <button type="button" style={ctaStyle} onClick={() => handleBeginPhase('worksheet')}>
                    Begin Worksheet
                  </button>
                )}
                {needBeginTest && (
                  <button type="button" style={ctaStyle} onClick={() => handleBeginPhase('test')}>
                    Begin Test
                  </button>
                )}
              </div>
            );
          })()}

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
                    style={{
                      padding: '12px 28px',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(59, 130, 246, 0.4)'
                    }}
                  >
                    {isInSentenceMode
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
                      padding: '12px 28px',
                      background: isInSentenceMode ? 'linear-gradient(135deg, #a855f7 0%, #9333ea 100%)' : '#9ca3af',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      fontSize: '1rem',
                      fontWeight: 600,
                      cursor: isInSentenceMode ? 'pointer' : 'not-allowed',
                      boxShadow: isInSentenceMode ? '0 4px 16px rgba(168, 85, 247, 0.4)' : 'none'
                    }}
                  >
                    Repeat
                  </button>
                </>
              )}
            </div>
          )}
          
          {/* Q&A footer for phases 2-5 */}
          {(() => {
            const qaPhase = ['comprehension', 'exercise', 'worksheet', 'test'].includes(currentPhase) ? currentPhase : null;
            const awaitingAnswer =
              (qaPhase === 'comprehension' && comprehensionState === 'awaiting-answer') ||
              (qaPhase === 'exercise' && exerciseState === 'awaiting-answer') ||
              (qaPhase === 'worksheet' && worksheetState === 'awaiting-answer') ||
              (qaPhase === 'test' && testState === 'awaiting-answer');

            if (!qaPhase || !awaitingAnswer) return null;

            const q =
              qaPhase === 'comprehension' ? currentComprehensionQuestion :
              qaPhase === 'exercise' ? currentExerciseQuestion :
              qaPhase === 'worksheet' ? currentWorksheetQuestion :
              currentTestQuestion;

            const isFill = qaPhase === 'worksheet'
              || (qaPhase === 'test' && (q?.type === 'fill' || q?.type === 'fib' || q?.sourceType === 'fib'))
              || (qaPhase === 'comprehension' && !isMultipleChoice(q) && !isTrueFalse(q));

            const isMc = !isFill && isMultipleChoice(q);
            const isTf = !isFill && !isMc && isTrueFalse(q);

            const getOpts = () => {
              if (isTf) return ['True', 'False'];
              const raw = Array.isArray(q?.options) ? q.options : (Array.isArray(q?.choices) ? q.choices : []);
              const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
              const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.:\)\-]\s*/i;
              return raw.filter(Boolean).map((o, i) => ({
                key: labels[i] || String(i),
                label: labels[i] || '',
                value: String(o ?? '').trim().replace(anyLabel, '').trim()
              }));
            };

            const currentValue =
              qaPhase === 'comprehension' ? comprehensionAnswer :
              qaPhase === 'exercise' ? selectedExerciseAnswer :
              qaPhase === 'worksheet' ? worksheetAnswer :
              testAnswer;

            const setValue = (v) => {
              if (qaPhase === 'comprehension') setComprehensionAnswer(v);
              else if (qaPhase === 'exercise') setSelectedExerciseAnswer(v);
              else if (qaPhase === 'worksheet') setWorksheetAnswer(v);
              else if (qaPhase === 'test') setTestAnswer(v);
            };

            const onSubmit = () => {
              if (qaPhase === 'comprehension') submitComprehensionAnswer();
              else if (qaPhase === 'exercise') submitExerciseAnswer();
              else if (qaPhase === 'worksheet') submitWorksheetAnswer();
              else if (qaPhase === 'test') submitTestAnswer();
            };

            const onSkip = () => {
              if (qaPhase === 'comprehension') skipComprehension();
              else if (qaPhase === 'exercise') skipExerciseQuestion();
              else if (qaPhase === 'worksheet') skipWorksheetQuestion();
              else if (qaPhase === 'test') skipTestQuestion();
            };

            const canSubmit = !!String(currentValue || '').trim();

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
                {(isMc || isTf) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {(isTf ? getOpts().map((v) => ({ key: v, label: '', value: v })) : getOpts()).map((opt) => {
                      const selected = String(currentValue || '').toLowerCase() === String(opt.value || '').toLowerCase();
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => {
                            setValue(opt.value);

                            // V1/V2 parity: MC/TF quick buttons submit immediately.
                            if (qaPhase === 'comprehension') {
                              comprehensionPhaseRef.current?.submitAnswer(opt.value);
                              setComprehensionAnswer('');
                            } else if (qaPhase === 'exercise') {
                              exercisePhaseRef.current?.submitAnswer(opt.value);
                              setSelectedExerciseAnswer('');
                            } else if (qaPhase === 'test') {
                              testPhaseRef.current?.submitAnswer(opt.value);
                              setTestAnswer('');
                            }
                          }}
                          style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            border: selected ? '2px solid #1f2937' : '1px solid #bdbdbd',
                            background: selected ? '#1f2937' : '#fff',
                            color: selected ? '#fff' : '#111827',
                            cursor: 'pointer',
                            fontWeight: 700,
                            fontSize: 'clamp(0.95rem, 1.6vw, 1.05rem)'
                          }}
                        >
                          {opt.label ? `${opt.label}. ${opt.value}` : opt.value}
                        </button>
                      );
                    })}
                  </div>
                )}

                {isFill && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      type="button"
                      style={{
                        background: '#c7442e',
                        color: '#fff',
                        borderRadius: 8,
                        padding: '8px 12px',
                        minHeight: 40,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 600,
                        boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
                      }}
                      aria-label="Voice input"
                      title="Hold to talk"
                      onClick={() => {
                        // TODO: implement mic recording
                      }}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M19 11a7 7 0 01-14 0" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 21v-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                    <input
                      type="text"
                      placeholder="Type your answer..."
                      value={currentValue}
                      style={{
                        flex: 1,
                        padding: '10px 16px',
                        border: '1px solid #bdbdbd',
                        borderRadius: 6,
                        fontSize: 'clamp(0.95rem, 1.6vw, 1.05rem)',
                        outline: 'none',
                        background: '#fff',
                        color: '#111827'
                      }}
                      onChange={(e) => setValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onSubmit();
                        }
                      }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={onSkip}
                    style={{
                      background: '#9ca3af',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '10px 16px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={onSubmit}
                    disabled={!canSubmit}
                    style={{
                      background: canSubmit ? '#c7442e' : '#9ca3af',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '10px 16px',
                      fontWeight: 800,
                      cursor: canSubmit ? 'pointer' : 'not-allowed'
                    }}
                  >
                    Submit
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
      
      {/* Play Time Expired Overlay - V1 parity: full-screen overlay outside main container */}
      {showPlayTimeExpired && playExpiredPhase && (
        <PlayTimeExpiredOverlay
          isOpen={showPlayTimeExpired}
          phase={playExpiredPhase}
          lessonKey={lessonKey}
          onComplete={handlePlayExpiredComplete}
          onStartNow={handlePlayExpiredStartNow}
        />
      )}
      
      {/* Timer Control Overlay - Facilitator controls for timer and golden key */}
      {showTimerControl && (
        <TimerControlOverlay
          isOpen={showTimerControl}
          onClose={() => setShowTimerControl(false)}
          lessonKey={lessonKey}
          phase={getCurrentPhaseName()}
          timerType={currentTimerMode[getCurrentPhaseName()] || 'work'}
          totalMinutes={getCurrentPhaseTimerDuration(getCurrentPhaseName(), currentTimerMode[getCurrentPhaseName()] || 'work')}
          goldenKeyBonus={goldenKeyBonus}
          isPaused={timerPaused}
          onUpdateTime={(seconds) => {
            // Force timer refresh to pick up new elapsed time from storage
            setTimerRefreshKey(k => k + 1);
          }}
          onTogglePause={() => setTimerPaused(prev => !prev)}
          hasGoldenKey={goldenKeyBonus > 0}
          isGoldenKeySuspended={false}
          onApplyGoldenKey={() => {
            // Apply golden key bonus
            if (phaseTimers) {
              setGoldenKeyBonus(phaseTimers.golden_key_bonus_min || 5);
            }
          }}
          onSuspendGoldenKey={() => setGoldenKeyBonus(0)}
          onUnsuspendGoldenKey={() => {
            if (phaseTimers) {
              setGoldenKeyBonus(phaseTimers.golden_key_bonus_min || 5);
            }
          }}
        />
      )}
    </>
  );
}
