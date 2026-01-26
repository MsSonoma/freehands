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
import { useSearchParams, useRouter } from 'next/navigation';
import jsPDF from 'jspdf';
import { createBrowserClient } from '@supabase/ssr';
import { getSupabaseClient } from '@/app/lib/supabaseClient';
import { getLearner, updateLearner } from '@/app/facilitator/learners/clientApi';
import { subscribeLearnerSettingsPatches } from '@/app/lib/learnerSettingsBus';
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
import GamesOverlay from '../components/games/GamesOverlay';
import EventBus from './EventBus';
import { loadLesson, fetchTTS } from './services';
import { formatMcOptions, isMultipleChoice, isTrueFalse, formatQuestionForSpeech, ensureQuestionMark } from '../utils/questionFormatting';
import { getSnapshotStorageKey } from '../utils/snapshotPersistenceUtils';
import { ensurePinAllowed } from '@/app/lib/pinGate';
import { upsertMedal } from '@/app/lib/medalsClient';
import { appendTranscriptSegment } from '@/app/lib/transcriptsClient';
import { getStoredAssessments, saveAssessments, clearAssessments } from '../assessment/assessmentStore';
import CaptionPanel from '../components/CaptionPanel';
import SessionVisualAidsCarousel from '../components/SessionVisualAidsCarousel';
import { useSessionTracking } from '@/app/hooks/useSessionTracking';
import SessionTakeoverDialog from '../components/SessionTakeoverDialog';

// Test Review UI Component (matches V1)
function TestReviewUI({ testGrade, generatedTest, timerService, workPhaseCompletions, workTimeRemaining, goldenKeysEnabled, onOverrideAnswer, onCompleteReview }) {
  const { score, totalQuestions, percentage, grade: letterGrade, answers } = testGrade;
  
  const tierForPercent = (pct) => {
    if (pct >= 90) return 'gold';
    if (pct >= 80) return 'silver';
    if (pct >= 70) return 'bronze';
    return null;
  };
  
  const emojiForTier = (tier) => {
    if (tier === 'gold') return '🥇';
    if (tier === 'silver') return '🥈';
    if (tier === 'bronze') return '🥉';
    return '';
  };
  
  const tier = tierForPercent(percentage);
  const medal = emojiForTier(tier);
  
  const card = { 
    background: '#ffffff', 
    border: '1px solid #e5e7eb', 
    borderRadius: 12, 
    padding: 16, 
    boxShadow: '0 2px 10px rgba(0,0,0,0.04)'
  };
  
  const badge = (ok) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 999,
    fontWeight: 800,
    fontSize: 12,
    background: ok ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.14)',
    color: ok ? '#065f46' : '#7f1d1d',
    border: `1px solid ${ok ? 'rgba(16,185,129,0.35)' : 'rgba(239,68,68,0.35)'}`
  });
  
  const btn = {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #d1d5db',
    background: '#f9fafb',
    color: '#374151',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.15s ease'
  };
  
  const workPhases = ['discussion', 'comprehension', 'exercise', 'worksheet', 'test'];
  
  const formatRemainingLabel = (phaseKey) => {
    const minutesLeft = workTimeRemaining?.[phaseKey] ?? null;
    if (minutesLeft == null) return '—';
    const totalSeconds = Math.round(Math.max(0, minutesLeft * 60));
    const mins = Math.floor(totalSeconds / 60);
    const secs = String(totalSeconds % 60).padStart(2, '0');
    return `${mins}:${secs}`;
  };
  
  const onTimeCount = Object.values(workPhaseCompletions || {}).filter(Boolean).length;
  const meetsGoldenKey = onTimeCount >= 3;
  
  const formatQuestionForDisplay = (q) => {
    if (typeof q === 'string') return q;
    return q?.question || q?.text || '';
  };
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 12, 
      overflow: 'auto', 
      paddingTop: 8, 
      paddingBottom: 8,
      height: '100%'
    }}>
      <div style={{ 
        ...card, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        gap: 12, 
        position: 'sticky', 
        top: 0, 
        zIndex: 5, 
        background: '#ffffff' 
      }}>
        <div style={{ fontSize: 'clamp(1.1rem, 2.4vw, 1.4rem)', fontWeight: 800, color: '#065f46' }}>
          {percentage}% grade
        </div>
        <div style={{ fontSize: 'clamp(1.2rem, 2.6vw, 1.5rem)' }} aria-label="Medal preview">{medal}</div>
      </div>
      
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontWeight: 800 }}>Work timers</div>
        {goldenKeysEnabled ? (
          <div style={{ fontWeight: 700, color: meetsGoldenKey ? '#065f46' : '#7f1d1d' }}>
            {meetsGoldenKey ? 'Golden key eligible (3+ on-time work timers)' : 'Golden key not yet met (needs 3 on-time work timers)'}
          </div>
        ) : null}
        <div style={{ fontSize: 13, color: '#4b5563' }}>Play timers are ignored here.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 }}>
          {workPhases.map((p) => {
            const onTime = !!(workPhaseCompletions && workPhaseCompletions[p]);
            const remainingLabel = formatRemainingLabel(p);
            const statusText = remainingLabel === '—' ? 'not started' : (onTime ? 'on time' : 'timed out / incomplete');
            const statusColor = statusText === 'not started' ? '#374151' : (onTime ? '#065f46' : '#7f1d1d');
            return (
              <div key={p} style={{ 
                padding: 10, 
                border: '1px solid #e5e7eb', 
                borderRadius: 8, 
                background: '#f9fafb', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: 4 
              }}>
                <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{p}</div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700 }}>{remainingLabel}</div>
                <div style={{ fontSize: 12, color: statusColor }}>{statusText}</div>
              </div>
            );
          })}
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {answers && answers.map((answerData, i) => {
          const ok = answerData.isCorrect;
          const num = i + 1;
          const stem = formatQuestionForDisplay(answerData.question);
          const userAns = answerData.userAnswer || '';
          const expectedText = answerData.correctAnswer || '';
          
          return (
            <div key={i} style={card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ fontWeight: 800 }}>Question {num}</div>
                <span style={badge(ok)}>{ok ? 'correct' : 'incorrect'}</span>
              </div>
              <div style={{ marginTop: 8, color: '#111827', fontWeight: 600 }}>{stem}</div>
              <div style={{ marginTop: 6, color: '#374151' }}>
                <span style={{ fontWeight: 700 }}>Your answer:</span> {userAns || <em style={{ color: '#6b7280' }}>No answer</em>}
              </div>
              {expectedText ? (
                <div style={{ marginTop: 4, color: '#4b5563' }}>
                  <span style={{ fontWeight: 700 }}>Expected answer:</span> {expectedText}
                </div>
              ) : null}
              <div style={{ marginTop: 10 }}>
                <button type="button" style={btn} onClick={() => onOverrideAnswer(i)}>Facilitator override</button>
              </div>
            </div>
          );
        })}
      </div>
      
      <div style={{ height: 80 }} />
    </div>
  );
}

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
const orderedPhases = ["discussion", "teaching", "comprehension", "exercise", "worksheet", "test", "closing"];
const phaseLabels = {
  discussion: "Discussion",
  comprehension: "Comp",
  exercise: "Exercise",
  worksheet: "Worksheet",
  test: "Test",
};

const normalizePhaseAlias = (phase) => {
  if (!phase) return null;
  if (phase === "grading" || phase === "congrats") return "test";
  if (phase === "complete") return "closing";
  return phase;
};

const deriveResumePhaseFromSnapshot = (snapshot) => {
  if (!snapshot) return null;

  const rank = (phase) => {
    const normalized = normalizePhaseAlias(phase);
    const idx = orderedPhases.indexOf(normalized);
    return idx === -1 ? -1 : idx;
  };

  const addCandidate = (set, value) => {
    if (!value) return;
    const normalized = normalizePhaseAlias(value);
    if (!normalized) return;
    set.add(normalized);
  };

  const candidates = new Set();
  addCandidate(candidates, snapshot.currentPhase);

  const completed = Array.isArray(snapshot.completedPhases) ? snapshot.completedPhases : [];
  completed.forEach((p) => addCandidate(candidates, p));

  const phaseData = snapshot.phaseData && typeof snapshot.phaseData === 'object' ? Object.keys(snapshot.phaseData) : [];
  phaseData.forEach((p) => addCandidate(candidates, p));

  if (!candidates.size) return null;

  let best = null;
  for (const candidate of candidates) {
    if (best === null || rank(candidate) > rank(best)) {
      best = candidate;
    }
  }

  return best;
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
    <div ref={containerRef} style={{ display: "grid", gridTemplateColumns, gap: 'clamp(0.25rem, 0.8vw, 0.5rem)', marginBottom: compact ? 'clamp(0.125rem, 0.6vw, 0.25rem)' : 'clamp(0.25rem, 1vw, 0.625rem)', width: '100%', minWidth: 0, position: 'relative', zIndex: 50, padding: 'clamp(0.125rem, 0.6vw, 0.375rem)', boxSizing: 'border-box' }}>
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
  const router = useRouter();
  const lessonId = searchParams?.get('lesson') || '';
  const subjectParam = searchParams?.get('subject') || 'math'; // Subject folder for lesson lookup
  const regenerateParam = searchParams?.get('regenerate'); // Support generated lessons
  const goldenKeyFromUrl = searchParams?.get('goldenKey') === 'true';

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
  const answerInputRef = useRef(null);
  const openingActionsControllerRef = useRef(null);
  const comprehensionPhaseRef = useRef(null);
  const discussionPhaseRef = useRef(null);
  const exercisePhaseRef = useRef(null);
  const worksheetPhaseRef = useRef(null);
  const testPhaseRef = useRef(null);
  const closingPhaseRef = useRef(null);
  const sessionLearnerIdRef = useRef(null); // pinned learner id for this session
  const pendingPlayTimersRef = useRef({}); // track phases waiting to start play timer after init
  const timelineJumpForceFreshPhaseRef = useRef(null); // timeline jumps should show opening actions, not resume mid-phase
  const timelineJumpTimerStartedRef = useRef(null); // track which phase had timer started by timeline jump (prevent double-start)
  const timelineJumpInProgressRef = useRef(false); // Debounce timeline jumps
  const pendingTimerStateRef = useRef(null);
  const lastTimerPersistAtRef = useRef(0);
  const startSessionRef = useRef(null);
  const resumePhaseRef = useRef(null);
  const deferClosingStartUntilAudioEndRef = useRef(false);
  
  const [lessonData, setLessonData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Canonical per-lesson persistence key (lesson == session identity)
  const lessonKey = useMemo(() => deriveCanonicalLessonKey({ lessonData, lessonId }), [lessonData, lessonId]);

  // Golden Key lookup/persistence key MUST match V1 + /learn/lessons convention.
  // V1 stored golden keys under `${subject}/${lesson}` (including .json when present).
  const goldenKeyLessonKey = useMemo(() => {
    if (!subjectParam || !lessonId) return '';
    return `${subjectParam}/${lessonId}`;
  }, [subjectParam, lessonId]);

  // Normalized key for visual aids (strips folder prefixes so the same lesson shares visual aids)
  const visualAidsLessonKey = useMemo(() => {
    const raw = lessonId || lessonData?.key || lessonKey || '';
    if (!raw) return null;

    // Visual aids are stored using a file-style key (typically includes .json).
    // Normalize to filename-only and force a .json suffix so session matches editor saves.
    let key = String(raw);
    if (key.includes('/')) key = key.split('/').pop();
    key = key.replace(/^(generated|facilitator|math|science|language-arts|social-studies|demo)\//, '');
    key = key.replace(/\.json$/i, '');
    if (!key) return null;
    return `${key}.json`;
  }, [lessonId, lessonData?.key, lessonKey]);
  
  const [currentPhase, setCurrentPhase] = useState('idle');
  const currentPhaseRef = useRef('idle');
  useEffect(() => {
    currentPhaseRef.current = currentPhase;
  }, [currentPhase]);
  
  const [teachingStage, setTeachingStage] = useState('idle');
  const [teachingLoading, setTeachingLoading] = useState(false);
  const [comprehensionSubmitting, setComprehensionSubmitting] = useState(false);
  const [exerciseSubmitting, setExerciseSubmitting] = useState(false);
  const [worksheetSubmitting, setWorksheetSubmitting] = useState(false);
  const [testSubmitting, setTestSubmitting] = useState(false);
  const [congratsTtsUrl, setCongratsTtsUrl] = useState(null);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [totalSentences, setTotalSentences] = useState(0);
  const [isInSentenceMode, setIsInSentenceMode] = useState(true);
  
  const [comprehensionState, setComprehensionState] = useState('idle');
  const comprehensionStateRef = useRef('idle');
  useEffect(() => {
    comprehensionStateRef.current = comprehensionState;
  }, [comprehensionState]);
  const [currentComprehensionQuestion, setCurrentComprehensionQuestion] = useState(null);
  const [comprehensionScore, setComprehensionScore] = useState(0);
  const [comprehensionTotalQuestions, setComprehensionTotalQuestions] = useState(0);
  const [comprehensionAnswer, setComprehensionAnswer] = useState('');
  const [comprehensionTimerMode, setComprehensionTimerMode] = useState('play');
  
  const [exerciseState, setExerciseState] = useState('idle');
  const exerciseStateRef = useRef('idle');
  useEffect(() => {
    exerciseStateRef.current = exerciseState;
  }, [exerciseState]);
  const [currentExerciseQuestion, setCurrentExerciseQuestion] = useState(null);
  const [exerciseScore, setExerciseScore] = useState(0);
  const [exerciseTotalQuestions, setExerciseTotalQuestions] = useState(0);
  const [selectedExerciseAnswer, setSelectedExerciseAnswer] = useState('');
  const [exerciseTimerMode, setExerciseTimerMode] = useState('play');
  
  const [worksheetState, setWorksheetState] = useState('idle');
  const worksheetStateRef = useRef('idle');
  useEffect(() => {
    worksheetStateRef.current = worksheetState;
  }, [worksheetState]);
  const [currentWorksheetQuestion, setCurrentWorksheetQuestion] = useState(null);
  const [worksheetScore, setWorksheetScore] = useState(0);
  const [worksheetTotalQuestions, setWorksheetTotalQuestions] = useState(0);
  const [worksheetAnswer, setWorksheetAnswer] = useState('');
  const [lastWorksheetFeedback, setLastWorksheetFeedback] = useState(null);
  const [worksheetTimerMode, setWorksheetTimerMode] = useState('play');
  
  const [testState, setTestState] = useState('idle');
  const testStateRef = useRef('idle');
  useEffect(() => {
    testStateRef.current = testState;
  }, [testState]);
  const [currentTestQuestion, setCurrentTestQuestion] = useState(null);
  const [testScore, setTestScore] = useState(0);
  const [testTotalQuestions, setTestTotalQuestions] = useState(0);
  const [testAnswer, setTestAnswer] = useState('');
  const [testGrade, setTestGrade] = useState(null);
  const [testReviewAnswer, setTestReviewAnswer] = useState(null);
  const [testReviewIndex, setTestReviewIndex] = useState(0);
  const [testTimerMode, setTestTimerMode] = useState('play');
  
  const [workPhaseCompletions, setWorkPhaseCompletions] = useState({
    discussion: false,
    comprehension: false,
    exercise: false,
    worksheet: false,
    test: false
  });
  const [workTimeRemaining, setWorkTimeRemaining] = useState({
    discussion: null,
    comprehension: null,
    exercise: null,
    worksheet: null,
    test: null
  });
  
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
  const [openingActionInput, setOpeningActionInput] = useState('');
  const [openingActionBusy, setOpeningActionBusy] = useState(false);
  const openingActionBusyRef = useRef(false);
  const [openingActionError, setOpeningActionError] = useState('');
  const [showGames, setShowGames] = useState(false);
  const [visualAidsData, setVisualAidsData] = useState(null);
  const [showVisualAids, setShowVisualAids] = useState(false);

  useEffect(() => {
    openingActionBusyRef.current = openingActionBusy;
  }, [openingActionBusy]);

  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [resumePhase, setResumePhase] = useState(null);
  
  const [workPhaseTime, setWorkPhaseTime] = useState('0:00');
  const [workPhaseRemaining, setWorkPhaseRemaining] = useState('0:00');
  const [goldenKeyEligible, setGoldenKeyEligible] = useState(false);
  const [goldenKeysEnabled, setGoldenKeysEnabled] = useState(null);
  const goldenKeysEnabledRef = useRef(true);

  // Per-learner play-portion flags (phases 2-5). Source of truth: Supabase.
  // These are required booleans and are live-updated via the Learner Settings Bus.
  const [playPortionsEnabled, setPlayPortionsEnabled] = useState({
    comprehension: true,
    exercise: true,
    worksheet: true,
    test: true,
  });
  const playPortionsEnabledRef = useRef({
    comprehension: true,
    exercise: true,
    worksheet: true,
    test: true,
  });
  
  // Learner profile state (REQUIRED - no defaults)
  const [learnerProfile, setLearnerProfile] = useState(null);
  const [learnerLoading, setLearnerLoading] = useState(true);
  const [learnerError, setLearnerError] = useState(null);

  // Session tracking (lesson_sessions + lesson_session_events)
  const [showTakeoverDialog, setShowTakeoverDialog] = useState(false);
  const [conflictingSession, setConflictingSession] = useState(null);
  const {
    startSession: startTrackedSession,
    endSession: endTrackedSession,
    startPolling: startSessionPolling,
    stopPolling: stopSessionPolling,
  } = useSessionTracking(
    learnerProfile?.id || null,
    lessonKey || null,
    false,
    (session) => {
      setConflictingSession(session);
      setShowTakeoverDialog(true);
    }
  );
  
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
  const [hasGoldenKey, setHasGoldenKey] = useState(false);
  const [isGoldenKeySuspended, setIsGoldenKeySuspended] = useState(false);
  const goldenKeyBonusRef = useRef(0);
  const hasGoldenKeyRef = useRef(false);
  const goldenKeyLessonKeyRef = useRef('');
  const [timerPaused, setTimerPaused] = useState(false);
  
  // Timer display state (fed by TimerService events) - separate for play and work
  const [playTimerDisplayElapsed, setPlayTimerDisplayElapsed] = useState(0);
  const [playTimerDisplayRemaining, setPlayTimerDisplayRemaining] = useState(0);
  const [workTimerDisplayElapsed, setWorkTimerDisplayElapsed] = useState(0);
  const [workTimerDisplayRemaining, setWorkTimerDisplayRemaining] = useState(0);

  useEffect(() => {
    goldenKeyBonusRef.current = Number(goldenKeyBonus || 0);
  }, [goldenKeyBonus]);

  useEffect(() => {
    hasGoldenKeyRef.current = !!hasGoldenKey;
  }, [hasGoldenKey]);

  useEffect(() => {
    goldenKeyLessonKeyRef.current = String(goldenKeyLessonKey || '');
  }, [goldenKeyLessonKey]);

  useEffect(() => {
    if (typeof goldenKeysEnabled === 'boolean') {
      goldenKeysEnabledRef.current = goldenKeysEnabled;
      try { timerServiceRef.current?.setGoldenKeysEnabled?.(goldenKeysEnabled); } catch {}
      if (!goldenKeysEnabled) {
        setGoldenKeyEligible(false);
      }
    }
  }, [goldenKeysEnabled]);
  
  // Play timer expired overlay state (V1 parity)
  const [showPlayTimeExpired, setShowPlayTimeExpired] = useState(false);
  const [playExpiredPhase, setPlayExpiredPhase] = useState(null);
  
  // Timer control overlay state (facilitator controls)
  const [showTimerControl, setShowTimerControl] = useState(false);
  
  const [currentCaption, setCurrentCaption] = useState('');
  const [transcriptLines, setTranscriptLines] = useState([]);
  const [activeCaptionIndex, setActiveCaptionIndex] = useState(-1);
  const [engineState, setEngineState] = useState('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [showRepeatButton, setShowRepeatButton] = useState(false);
  const [events, setEvents] = useState([]);
  const [downloadError, setDownloadError] = useState('');
  const [generatedComprehension, setGeneratedComprehension] = useState(null);
  const [generatedExercise, setGeneratedExercise] = useState(null);
  const [generatedWorksheet, setGeneratedWorksheet] = useState(null);
  const [generatedTest, setGeneratedTest] = useState(null);

  const persistTranscriptState = useCallback((lines, activeIdx) => {
    if (!snapshotServiceRef.current) return;
    try {
      const safeLines = Array.isArray(lines)
        ? lines.map((l) => ({ text: String(l?.text || ''), role: l?.role === 'user' ? 'user' : 'assistant' }))
        : [];
      const safeIdx = Number.isFinite(activeIdx) ? activeIdx : -1;
      snapshotServiceRef.current.saveProgress('transcript', {
        transcript: {
          lines: safeLines,
          activeIndex: safeIdx
        }
      });
    } catch (err) {
      console.error('[SessionPageV2] Persist transcript error:', err);
    }
  }, []);

  const appendTranscriptLine = useCallback((line, { updateActive = false } = {}) => {
    const text = String(line?.text || '').trim();
    if (!text) return;
    const role = line?.role === 'user' ? 'user' : 'assistant';
    setTranscriptLines((prev) => {
      const next = [...prev, { text, role }];
      const nextActive = updateActive || role === 'assistant' ? next.length - 1 : activeCaptionIndex;
      if (updateActive || role === 'assistant') {
        setActiveCaptionIndex(nextActive);
      }
      persistTranscriptState(next, nextActive);
      return next;
    });
  }, [activeCaptionIndex, persistTranscriptState]);

  // Idle "Begin" / "Resume" CTA loading state
  const [startSessionLoading, setStartSessionLoading] = useState(false);
  const startSessionLoadingRef = useRef(false);
  const [startSessionError, setStartSessionError] = useState('');
  useEffect(() => {
    startSessionLoadingRef.current = startSessionLoading;
  }, [startSessionLoading]);

  const resetTranscriptState = useCallback(({ persist = false } = {}) => {
    setTranscriptLines([]);
    setActiveCaptionIndex(-1);
    setCurrentCaption('');
    if (persist) {
      persistTranscriptState([], -1);
    }
  }, [persistTranscriptState]);

  const scrollTranscriptToBottom = useCallback(() => {
    const el = transcriptRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      if (!transcriptRef.current) return;
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    });
  }, []);

  // Vocab terms for caption highlighting (Discussion/Teaching)
  const vocabTerms = useMemo(() => {
    if (!lessonData) return [];
    const normalizeList = (arr = []) => (Array.isArray(arr) ? arr : []).map((t) => String(t || '').trim()).filter(Boolean);
    const explicit = normalizeList(lessonData.vocabulary || lessonData.vocab || lessonData.vocab_terms);
    const fallback = (() => {
      const rawTitle = String(lessonData.title || lessonId || '').trim();
      if (!rawTitle) return [];
      const stop = new Set(['with','and','the','of','a','an','to','in','on','for','by','vs','versus','about','into','from']);
      return rawTitle
        .split(/[^A-Za-z]+/)
        .map(w => w.trim())
        .filter(w => w && !stop.has(w.toLowerCase()))
        .slice(0, 5);
    })();
    const terms = explicit.length ? explicit : fallback;
    const dedup = new Map();
    for (const t of terms) {
      const key = t.toLowerCase();
      if (!dedup.has(key)) dedup.set(key, t);
    }
    return Array.from(dedup.values()).sort((a, b) => b.length - a.length);
  }, [lessonData, lessonId]);

  useEffect(() => {
    resumePhaseRef.current = resumePhase;
  }, [resumePhase]);

  // Keep transcript pinned to the newest line on initial load/refresh (V1 parity)
  useEffect(() => {
    scrollTranscriptToBottom();
  }, [transcriptLines.length, snapshotLoaded, scrollTranscriptToBottom]);

  // Broadcast lesson title to HeaderBar so the header matches V1 in mobile landscape
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const title = (() => {
      try {
        const raw = lessonData?.title || lessonData?.lessonTitle || lessonKey || lessonId || '';
        return typeof raw === 'string' ? raw.trim() : String(raw || '');
      } catch {
        return '';
      }
    })();
    try {
      window.dispatchEvent(new CustomEvent('ms:session:title', { detail: title }));
    } catch {}
    return () => {
      try {
        window.dispatchEvent(new CustomEvent('ms:session:title', { detail: '' }));
      } catch {}
    };
  }, [lessonData, lessonKey, lessonId]);

  // Reset opening action input/errors when switching action types
  useEffect(() => {
    setOpeningActionInput('');
    setOpeningActionError('');
    setOpeningActionBusy(false);
  }, [openingActionType]);
  
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

  // Autofocus answer input when awaiting an answer in any Q&A phase (footer parity)
  useEffect(() => {
    const awaiting =
      (currentPhase === 'comprehension' && comprehensionState === 'awaiting-answer') ||
      (currentPhase === 'exercise' && exerciseState === 'awaiting-answer') ||
      (currentPhase === 'worksheet' && worksheetState === 'awaiting-answer') ||
      (currentPhase === 'test' && testState === 'awaiting-answer');
    if (awaiting && answerInputRef.current) {
      try {
        answerInputRef.current.focus({ preventScroll: true });
      } catch {
        try { answerInputRef.current.focus(); } catch {}
      }
    }
  }, [currentPhase, comprehensionState, exerciseState, worksheetState, testState]);
  
  // Load lesson data
  useEffect(() => {
    async function loadLessonData() {
      try {
        setLoading(true);
        setError(null);
        
        let lesson;
        
        // Check for generated lesson (regenerate parameter)
        if (regenerateParam) {
          addEvent('Loading generated lesson (regenerate)...');
          const response = await fetch(`/api/lesson-engine/regenerate?key=${regenerateParam}`);
          if (!response.ok) {
            throw new Error(`Failed to load generated lesson: ${response.statusText}`);
          }
          const data = await response.json();
          lesson = data.lesson;
          addEvent(`Loaded generated lesson: ${lesson.title || 'Untitled'}`);
        }
        // Load generated lessons from facilitator storage when subject=generated
        else if (subjectParam === 'generated') {
          if (!lessonId) {
            throw new Error('No lesson specified. Add ?lesson=filename.json when using subject=generated');
          }

          const supabase = getSupabaseClient();
          if (!supabase) {
            throw new Error('Supabase client not available for generated lessons.');
          }
          const { data: sessionResult } = await supabase?.auth.getSession() || {};
          const session = sessionResult?.session;
          const userId = session?.user?.id || null;
          const accessToken = session?.access_token || null;

          if (!userId || !accessToken) {
            addEvent('Sign in required to load generated lessons.');
            setError('Sign in required to load generated lessons. Please sign in and retry.');
            setLoading(false);
            return;
          }

          const normalizedLessonId = lessonId.endsWith('.json') ? lessonId : `${lessonId}.json`;
          const params = new URLSearchParams({ file: normalizedLessonId });
          addEvent('Loading generated lesson from facilitator storage...');
          const response = await fetch(`/api/facilitator/lessons/get?${params.toString()}`, {
            headers: {
              Authorization: `Bearer ${accessToken}`
            }
          });
          if (!response.ok) {
            throw new Error(`Failed to load generated lesson (${response.status})`);
          }
          lesson = await response.json();
          addEvent(`Loaded generated lesson: ${lesson.title || normalizedLessonId}`);
        }
        // Load lesson if lessonId provided
        else if (lessonId) {
          lesson = await loadLesson(lessonId, subjectParam);
          addEvent(`Loaded lesson: ${lesson.title}`);
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

  // Load visual aids separately from database (facilitator-specific)
  useEffect(() => {
    if (!visualAidsLessonKey) {
      setVisualAidsData(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const supabase = getSupabaseClient();
        if (!supabase) {
          if (!cancelled) setVisualAidsData(null);
          return;
        }

        const { data: sessionResult } = await supabase?.auth.getSession() || {};
        const session = sessionResult?.session;
        const token = session?.access_token || null;

        if (!token) {
          if (!cancelled) setVisualAidsData(null);
          return;
        }

        const res = await fetch(`/api/visual-aids/load?lessonKey=${encodeURIComponent(visualAidsLessonKey)}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!res.ok) {
          if (!cancelled) setVisualAidsData(null);
          return;
        }

        const data = await res.json();
        const images = Array.isArray(data?.selectedImages) ? data.selectedImages : [];

        if (!cancelled) {
          setVisualAidsData(images);
        }
      } catch (err) {
        if (!cancelled) setVisualAidsData(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visualAidsLessonKey]);

  const handleExplainVisualAid = useCallback(async (aid) => {
    const text = String(aid?.description || '').trim();
    if (!text) return;
    if (!audioEngineRef.current) return;

    try {
      audioEngineRef.current.stop();
    } catch {}

    const audioBase64 = await fetchTTS(text);
    try {
      await audioEngineRef.current.playAudio(audioBase64, [text], 0);
    } catch (err) {
      console.warn('[SessionPageV2] Visual aid explain failed:', err);
    }
  }, []);
  
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

        if (typeof learner.golden_keys_enabled !== 'boolean') {
          throw new Error('Learner profile missing golden_keys_enabled flag. Please run migrations.');
        }
        setGoldenKeysEnabled(learner.golden_keys_enabled);
        goldenKeysEnabledRef.current = learner.golden_keys_enabled;

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
        
        // Initialize currentTimerMode (null = not started yet)
        setCurrentTimerMode({
          discussion: null,
          comprehension: null,
          exercise: null,
          worksheet: null,
          test: null
        });
        
        // Check for active golden key on this lesson (only affects play timers when Golden Keys are enabled)
        // Key format must match V1 + /learn/lessons: `${subject}/${lesson}`.
        if (!goldenKeyLessonKey) {
          throw new Error('Missing lesson key for golden key lookup.');
        }
        const activeKeys = learner.active_golden_keys || {};
        if (learner.golden_keys_enabled && activeKeys[goldenKeyLessonKey]) {
          setHasGoldenKey(true);
          setIsGoldenKeySuspended(false);
          setGoldenKeyBonus(timers.golden_key_bonus_min || 0);
        } else if (learner.golden_keys_enabled && goldenKeyFromUrl) {
          // Golden key consumed on /learn/lessons; session must persist the per-lesson flag.
          setHasGoldenKey(true);
          setIsGoldenKeySuspended(false);
          setGoldenKeyBonus(timers.golden_key_bonus_min || 0);
          try {
            const { updateLearner } = await import('@/app/facilitator/learners/clientApi');
            await updateLearner(learner.id, {
              active_golden_keys: {
                ...(activeKeys || {}),
                [goldenKeyLessonKey]: true,
              },
            });
          } catch (err) {
            console.warn('[SessionPageV2] Failed to persist golden key from URL:', err);
          }
        } else {
          setHasGoldenKey(false);
          setIsGoldenKeySuspended(false);
          setGoldenKeyBonus(0);
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
  }, [lessonData, lessonId, lessonKey, subjectParam, goldenKeyFromUrl, goldenKeyLessonKey]);

  // Live-update learner settings (no localStorage persistence)
  useEffect(() => {
    if (!learnerProfile?.id) return;

    const unsubscribe = subscribeLearnerSettingsPatches((msg) => {
      if (!msg) return;
      if (String(msg.learnerId || '') !== String(learnerProfile.id)) return;

      const patch = msg.patch && typeof msg.patch === 'object' ? msg.patch : null;
      if (!patch) return;

      if ('golden_keys_enabled' in patch) {
        const next = patch.golden_keys_enabled;
        if (typeof next !== 'boolean') return;
        setGoldenKeysEnabled(next);
        goldenKeysEnabledRef.current = next;
        try { timerServiceRef.current?.setGoldenKeysEnabled?.(next); } catch {}
        if (!next) {
          setGoldenKeyEligible(false);
          setHasGoldenKey(false);
          setIsGoldenKeySuspended(false);
          setGoldenKeyBonus(0);
        }
      }

      const nextPlayFlags = {
        comprehension: ('play_comprehension_enabled' in patch) ? patch.play_comprehension_enabled : undefined,
        exercise: ('play_exercise_enabled' in patch) ? patch.play_exercise_enabled : undefined,
        worksheet: ('play_worksheet_enabled' in patch) ? patch.play_worksheet_enabled : undefined,
        test: ('play_test_enabled' in patch) ? patch.play_test_enabled : undefined,
      };
      const hasAnyPlayFlag = Object.values(nextPlayFlags).some(v => v !== undefined);
      if (hasAnyPlayFlag) {
        const merged = {
          ...playPortionsEnabledRef.current,
          ...(typeof nextPlayFlags.comprehension === 'boolean' ? { comprehension: nextPlayFlags.comprehension } : {}),
          ...(typeof nextPlayFlags.exercise === 'boolean' ? { exercise: nextPlayFlags.exercise } : {}),
          ...(typeof nextPlayFlags.worksheet === 'boolean' ? { worksheet: nextPlayFlags.worksheet } : {}),
          ...(typeof nextPlayFlags.test === 'boolean' ? { test: nextPlayFlags.test } : {}),
        };
        setPlayPortionsEnabled(merged);
        playPortionsEnabledRef.current = merged;

        // If play portion is turned off while sitting at the Go gate, jump straight to work.
        // (Do not attempt to interrupt intro playback states here.)
        try {
          const phaseNow = String(currentPhaseRef.current || '');
          const disableNow = (
            (phaseNow === 'comprehension' && nextPlayFlags.comprehension === false) ||
            (phaseNow === 'exercise' && nextPlayFlags.exercise === false) ||
            (phaseNow === 'worksheet' && nextPlayFlags.worksheet === false) ||
            (phaseNow === 'test' && nextPlayFlags.test === false)
          );
          if (disableNow) {
            const phaseStateMap = {
              comprehension: comprehensionStateRef.current,
              exercise: exerciseStateRef.current,
              worksheet: worksheetStateRef.current,
              test: testStateRef.current,
            };
            const refMap = {
              comprehension: comprehensionPhaseRef,
              exercise: exercisePhaseRef,
              worksheet: worksheetPhaseRef,
              test: testPhaseRef,
            };
            if (phaseStateMap[phaseNow] === 'awaiting-go') {
              transitionToWorkTimer(phaseNow);
              refMap[phaseNow]?.current?.go?.();
            }
          }
        } catch {}
      }
    });

    return () => {
      try { unsubscribe?.(); } catch {}
    };
  }, [learnerProfile?.id]);

  // Load persisted worksheet/test sets for printing (local+Supabase)
  useEffect(() => {
    if (!lessonKey) return;
    let cancelled = false;

    const loadStored = async () => {
      try {
        const learnerId = learnerProfile?.id || (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null);
        const stored = await getStoredAssessments(lessonKey, { learnerId });
        if (cancelled || !stored) return;
        if (Array.isArray(stored.comprehension) && stored.comprehension.length) {
          setGeneratedComprehension(stored.comprehension);
        }
        if (Array.isArray(stored.exercise) && stored.exercise.length) {
          setGeneratedExercise(stored.exercise);
        }
        if (Array.isArray(stored.worksheet) && stored.worksheet.length) {
          setGeneratedWorksheet(stored.worksheet);
        }
        if (Array.isArray(stored.test) && stored.test.length) {
          setGeneratedTest(stored.test);
        }
      } catch {
        /* noop */
      }
    };

    loadStored();
    return () => { cancelled = true; };
  }, [lessonKey, learnerProfile]);
  
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
          const normalizedResumePhase = deriveResumePhaseFromSnapshot(snapshot);
          const resumePhaseName = normalizedResumePhase || snapshot.currentPhase || null;

          if (normalizedResumePhase && snapshot.currentPhase && normalizedResumePhase !== snapshot.currentPhase) {
            addEvent(`Loaded snapshot - resume normalized to ${normalizedResumePhase} (was ${snapshot.currentPhase})`);
          } else {
            addEvent(`💾 Loaded snapshot - Resume from: ${resumePhaseName || 'idle'}`);
          }

          setResumePhase(resumePhaseName);
          resumePhaseRef.current = resumePhaseName;

          const isBeginningPhase = !resumePhaseName || resumePhaseName === 'idle' || resumePhaseName === 'discussion';

          const storedTranscript = snapshot?.transcript;
          const storedLines = Array.isArray(storedTranscript?.lines) ? storedTranscript.lines : null;
          if (isBeginningPhase) {
            // If snapshot is already at the beginning, start fresh and clear any stale captions.
            resetTranscriptState({ persist: true });
          } else if (storedLines && storedLines.length) {
            const normalized = storedLines.map((l) => ({ text: String(l?.text || ''), role: l?.role === 'user' ? 'user' : 'assistant' }));
            setTranscriptLines(normalized);
            const nextActive = Number.isFinite(storedTranscript?.activeIndex) ? storedTranscript.activeIndex : (normalized.length ? normalized.length - 1 : -1);
            setActiveCaptionIndex(nextActive);
            const lastAssistant = [...normalized].reverse().find((l) => l.role !== 'user');
            setCurrentCaption(lastAssistant?.text || '');
          } else {
            resetTranscriptState({ persist: true });
          }

          if (snapshot.timerState) {
            if (timerServiceRef.current) {
              try { timerServiceRef.current.restoreState(snapshot.timerState); } catch {}
            } else {
              pendingTimerStateRef.current = snapshot.timerState;
            }
          }
        } else {
          resetTranscriptState();
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
  }, [lessonData, learnerProfile, browserSessionId, lessonKey, resetTranscriptState]);
  
  // Initialize TimerService
  useEffect(() => {
    if (!eventBusRef.current || !lessonKey || !phaseTimers) return;

    const eventBus = eventBusRef.current;

    // Convert minutes -> seconds; golden key bonus applies to play timers only (and only when Golden Keys are enabled).
    const playBonusSec = goldenKeysEnabledRef.current
      ? Math.max(0, Number(goldenKeyBonusRef.current || 0)) * 60
      : 0;
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
      if (goldenKeysEnabledRef.current === false) return;
      const eligible = data?.eligible === true;
      setGoldenKeyEligible(eligible);
      if (eligible) addEvent('🔑 Golden Key earned!');
    });

    // Play timer expired event (V1 parity - triggers 30-second overlay)
    const unsubPlayExpired = eventBus.on('playTimerExpired', (data) => {
      setPlayExpiredPhase(data.phase || null);
      setShowPlayTimeExpired(true);
      // Trigger phase transition logic
      handlePhaseTimerTimeUp();
    });
    
    // Subscribe to timer tick events for display - separate handlers for play and work
    const unsubPlayTick = eventBus.on('playTimerTick', (data) => {
      setPlayTimerDisplayElapsed(data.elapsed || 0);
      setPlayTimerDisplayRemaining(data.remaining || 0);
    });
    
    const unsubWorkTick2 = eventBus.on('workPhaseTimerTick', (data) => {
      setWorkTimerDisplayElapsed(data.elapsed || 0);
      setWorkTimerDisplayRemaining(data.remaining || 0);
    });
    
    // Initialize display on timer start - separate for play and work
    const unsubPlayStart = eventBus.on('playTimerStart', (data) => {
      setPlayTimerDisplayElapsed(0);
      setPlayTimerDisplayRemaining(data.timeLimit || 0);
    });
    
    const unsubWorkStart = eventBus.on('workPhaseTimerStart', (data) => {
      setWorkTimerDisplayElapsed(0);
      setWorkTimerDisplayRemaining(data.timeLimit || 0);
    });

    const timer = new TimerService(eventBus, {
      lessonKey,
      playTimerLimits,
      workPhaseTimeLimits,
      goldenKeysEnabled: goldenKeysEnabledRef.current
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
      try { unsubPlayTick?.(); } catch {}
      try { unsubWorkTick2?.(); } catch {}
      try { unsubPlayStart?.(); } catch {}
      try { unsubWorkStart?.(); } catch {}
      timer.destroy();
      timerServiceRef.current = null;
    };
  }, [lessonKey, phaseTimers]);

  // Update play timer limits when bonus/enabled state changes (do not recreate TimerService).
  useEffect(() => {
    if (!timerServiceRef.current || !phaseTimers) return;

    const playBonusSec = goldenKeysEnabledRef.current
      ? Math.max(0, Number(goldenKeyBonusRef.current || 0)) * 60
      : 0;
    const m2s = (m) => Math.max(0, Number(m || 0)) * 60;

    timerServiceRef.current.setPlayTimerLimits({
      comprehension: m2s(phaseTimers.comprehension_play_min) + playBonusSec,
      exercise: m2s(phaseTimers.exercise_play_min) + playBonusSec,
      worksheet: m2s(phaseTimers.worksheet_play_min) + playBonusSec,
      test: m2s(phaseTimers.test_play_min) + playBonusSec
    });
  }, [phaseTimers, goldenKeyBonus, goldenKeysEnabled]);
  
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

  const getAssessmentStorageKey = useCallback(() => {
    return lessonKey || null;
  }, [lessonKey]);

  const persistAssessments = useCallback((worksheetSet, testSet, comprehensionSet, exerciseSet) => {
    const key = getAssessmentStorageKey();
    if (!key) return;
    const learnerId = learnerProfile?.id || (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null);
    try {
      saveAssessments(key, {
        worksheet: Array.isArray(worksheetSet) ? worksheetSet : (Array.isArray(generatedWorksheet) ? generatedWorksheet : []),
        test: Array.isArray(testSet) ? testSet : (Array.isArray(generatedTest) ? generatedTest : []),
        comprehension: Array.isArray(comprehensionSet) ? comprehensionSet : (Array.isArray(generatedComprehension) ? generatedComprehension : []),
        exercise: Array.isArray(exerciseSet) ? exerciseSet : (Array.isArray(generatedExercise) ? generatedExercise : [])
      }, { learnerId });
    } catch {
      /* noop */
    }
  }, [generatedComprehension, generatedExercise, generatedTest, generatedWorksheet, getAssessmentStorageKey, learnerProfile]);

  const questionKey = useCallback((q) => {
    return (q?.prompt || q?.question || q?.Q || q?.q || '').toString().trim().toLowerCase();
  }, []);

  const isPrimaryType = useCallback((q) => {
    const qt = String(q?.questionType || q?.type || q?.sourceType || '').toLowerCase();
    return qt === 'mc' || qt === 'multiplechoice' || qt === 'tf' || qt === 'truefalse';
  }, []);

  const blendByType = useCallback((pool = [], target = 0) => {
    const shuffleLocal = (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const deduped = [];
    const seen = new Set();
    for (const item of pool) {
      const key = questionKey(item);
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      deduped.push(item);
    }

    const primaryPool = shuffleLocal(deduped.filter(isPrimaryType));
    const secondaryPool = shuffleLocal(deduped.filter((q) => !isPrimaryType(q)));

    const desiredSecondary = Math.max(0, Math.round(target * 0.2));
    const desiredPrimary = Math.max(0, target - desiredSecondary);

    const out = [];
    const takeFrom = (arr, count) => {
      while (count > 0 && arr.length) {
        out.push(arr.shift());
        count -= 1;
      }
    };

    takeFrom(secondaryPool, desiredSecondary);
    takeFrom(primaryPool, desiredPrimary);

    let remaining = target - out.length;
    const spill = [...primaryPool, ...secondaryPool];
    takeFrom(spill, remaining);

    // If still short (e.g., after dedup), backfill by cycling the original pool so we always hit the target count.
    if (out.length < target && pool.length) {
      const refill = shuffleLocal(pool);
      let idx = 0;
      while (out.length < target && refill.length) {
        out.push(refill[idx % refill.length]);
        idx += 1;
      }
    }

    return out.slice(0, target);
  }, [isPrimaryType, questionKey]);

  const buildWorksheetSet = useCallback(() => {
    const target = getLearnerTarget('worksheet');
    if (!lessonData || !target) return [];
    const pool = buildQuestionPool(target, []);
    const selected = pool.slice(0, target).map((q, idx) => ({ ...q, number: q.number || (idx + 1) }));
    return selected;
  }, [lessonData, getLearnerTarget]);

  const buildTestSet = useCallback(() => {
    const target = getLearnerTarget('test');
    if (!lessonData || !target) return [];
    const pool = buildQuestionPool(target, []);
    const selected = pool.slice(0, target).map((q, idx) => ({ ...q, number: q.number || (idx + 1) }));
    return selected;
  }, [lessonData, getLearnerTarget, buildQuestionPool]);

  const shareOrPreviewPdf = useCallback(async (blob, fileName = 'document.pdf', previewWin = null) => {
    try {
      const supportsFile = typeof File !== 'undefined';
      const file = supportsFile ? new File([blob], fileName, { type: 'application/pdf' }) : null;
      if (file && navigator?.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
        return;
      }
    } catch {
      /* fall through */
    }

    try {
      const url = URL.createObjectURL(blob);
      const win = previewWin && previewWin.document ? previewWin : null;
      if (win) {
        try { win.addEventListener('beforeunload', () => URL.revokeObjectURL(url)); } catch {}
        win.location.href = url;
      } else {
        window.location.href = url;
        setTimeout(() => { try { URL.revokeObjectURL(url); } catch {} }, 10000);
      }
      return;
    } catch {
      /* fall through */
    }

    try {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        try { URL.revokeObjectURL(url); } catch {}
        try { document.body.removeChild(a); } catch {}
      }, 10000);
    } catch {
      /* noop */
    }
  }, []);

  const createPdfForItems = useCallback(async (items = [], label = 'worksheet', previewWin = null) => {
    try {
      const doc = new jsPDF();
      const pageHeight = doc.internal.pageSize.getHeight();
      const lessonTitle = (lessonData?.title || lessonKey || lessonId || 'Lesson').trim();
      const niceLabel = label.charAt(0).toUpperCase() + label.slice(1);

      const shrinkFIBBlanks = (s, answerLength = 0) => {
        if (!s) return s;
        return s.replace(/_{4,}/g, (m) => {
          let targetSize = 12;
          if (answerLength > 0) {
            targetSize = Math.max(12, Math.min(60, answerLength * 2));
          } else {
            targetSize = Math.max(12, Math.round(m.length * 0.66));
          }
          return '_'.repeat(targetSize);
        });
      };

      const renderLineText = (item) => {
        let base = String(item.prompt || item.question || item.Q || item.q || '');
        const qType = String(item.type || '').toLowerCase();
        const isFIB = item.sourceType === 'fib' || /fill\s*in\s*the\s*blank|fillintheblank/.test(qType);
        const isTF = item.sourceType === 'tf' || /^(true\s*\/\s*false|truefalse|tf)$/i.test(qType);
        if (isFIB) {
          let answerLength = 0;
          const answer = item.answer || item.expected || item.correct || item.key || '';
          if (Array.isArray(item.answers) && item.answers.length > 0) {
            answerLength = Math.max(...item.answers.map((a) => String(a || '').trim().length));
          } else if (answer) {
            answerLength = String(answer).trim().length;
          }
          base = shrinkFIBBlanks(base, answerLength);
        }
        const trimmed = base.trimStart();
        if (isTF && !/^true\s*\/\s*false\s*:/i.test(trimmed) && !/^true\s*false\s*:/i.test(trimmed)) {
          base = `True/False: ${base}`;
        }
        let choicesLine = null;
        const opts = Array.isArray(item?.options)
          ? item.options.filter(Boolean)
          : (Array.isArray(item?.choices) ? item.choices.filter(Boolean) : []);
        if (opts.length) {
          const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
          const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.\:\)\-]\s*/i;
          const parts = opts.map((o, i) => {
            const raw = String(o ?? '').trim();
            const cleaned = raw.replace(anyLabel, '').trim();
            const lbl = labels[i] || '';
            return `${lbl}.\u00A0${cleaned}`;
          });
          choicesLine = parts.join('   ');
        }
        return { prompt: base, choicesLine };
      };

      const topMargin = 28;
      const bottomMargin = 18;
      const left = 14;
      const maxWidth = 182;
      const choiceIndent = 6;
      const minBodyFont = 8;
      const maxBodyFont = 18; // allow larger text on short sets while still fitting the page
      const minChoiceFont = 8;

      const getLineHeight = (size) => Math.max(size * 0.5, 4.5);

      const measureContentHeight = (bodySize) => {
        const choiceSize = Math.max(minChoiceFont, Math.min(bodySize - 1, Math.round(bodySize * 0.92)));
        const promptLineHeight = getLineHeight(bodySize);
        const choiceLineHeight = getLineHeight(choiceSize);
        let height = 0;

        doc.setFontSize(bodySize);
        items.forEach((item, idx) => {
          const num = item.number || idx + 1;
          const { prompt: promptText, choicesLine } = renderLineText(item);
          const promptLines = doc.splitTextToSize(`${num}. ${promptText}`, maxWidth);
          height += promptLines.length * promptLineHeight;

          if (choicesLine) {
            doc.setFontSize(choiceSize);
            const choiceLines = doc.splitTextToSize(choicesLine, maxWidth - choiceIndent);
            height += choiceLines.length * choiceLineHeight;
            doc.setFontSize(bodySize);
          }

          const spacer = label === 'worksheet' ? Math.max(bodySize * 0.35, 3) : Math.max(bodySize * 0.7, 4);
          height += spacer;
        });

        return height;
      };

      const availableHeight = pageHeight - topMargin - bottomMargin;
      let bodyFontSize = minBodyFont;
      for (let size = maxBodyFont; size >= minBodyFont; size -= 0.5) {
        if (measureContentHeight(size) <= availableHeight) {
          bodyFontSize = size;
          break;
        }
      }

      const choiceFontSize = Math.max(minChoiceFont, Math.min(bodyFontSize - 1, Math.round(bodyFontSize * 0.92)));
      const promptLineHeight = getLineHeight(bodyFontSize);
      const choiceLineHeight = getLineHeight(choiceFontSize);
      const spacerSize = label === 'worksheet' ? Math.max(bodyFontSize * 0.35, 3) : Math.max(bodyFontSize * 0.7, 4);
      const bottomLimit = pageHeight - bottomMargin;

      doc.setTextColor(0, 0, 0);
      const headerSize = Math.min(20, Math.max(12, bodyFontSize + 2));
      doc.setFontSize(headerSize);
      const headerText = `${lessonTitle} ${niceLabel}`;
      doc.text(headerText, 12, 14);
      doc.setDrawColor(180, 180, 180);
      doc.line(12, 18, 198, 18);

      let y = topMargin;

      const drawParagraph = (text, fontSize, lineHeight, indent = 0) => {
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, maxWidth - indent);
        for (const line of lines) {
          if (y > bottomLimit) {
            doc.addPage();
            y = topMargin;
          }
          doc.text(line, left + indent, y);
          y += lineHeight;
        }
      };

      items.forEach((item, idx) => {
        const num = item.number || idx + 1;
        const { prompt: promptText, choicesLine } = renderLineText(item);
        drawParagraph(`${num}. ${promptText}`, bodyFontSize, promptLineHeight, 0);
        if (choicesLine) {
          drawParagraph(choicesLine, choiceFontSize, choiceLineHeight, choiceIndent);
        }
        y += spacerSize;
      });

      const fileBase = String(lessonKey || lessonId || 'lesson').replace(/\.json$/i, '');
      const fileName = `${fileBase}-${label}.pdf`;
      const blob = doc.output('blob');
      await shareOrPreviewPdf(blob, fileName, previewWin);
    } catch (err) {
      console.error('[SessionPageV2] PDF generation failed', err);
      setDownloadError('Failed to generate PDF.');
    }
  }, [lessonData, lessonKey, lessonId, shareOrPreviewPdf]);

  const handleTestOverrideAnswer = useCallback(async (index) => {
    const ok = await ensurePinAllowed('facilitator');
    if (!ok) return;
    
    setTestGrade((prevGrade) => {
      if (!prevGrade || !prevGrade.answers) return prevGrade;
      
      const newAnswers = prevGrade.answers.slice();
      newAnswers[index] = {
        ...newAnswers[index],
        isCorrect: !newAnswers[index].isCorrect
      };
      
      const newScore = newAnswers.filter(a => a.isCorrect).length;
      const newPercentage = Math.round((newScore / newAnswers.length) * 100);
      const newLetterGrade = newPercentage >= 90 ? 'A' : newPercentage >= 80 ? 'B' : newPercentage >= 70 ? 'C' : newPercentage >= 60 ? 'D' : 'F';
      
      return {
        ...prevGrade,
        answers: newAnswers,
        score: newScore,
        percentage: newPercentage,
        grade: newLetterGrade
      };
    });
  }, []);

  const handleDownloadWorksheet = useCallback(async () => {
    const ok = await ensurePinAllowed('download');
    if (!ok) return;
    const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    setDownloadError('');

    let source = generatedWorksheet;
    if (!source || !source.length) {
      source = buildWorksheetSet();
      if (source.length) {
        setGeneratedWorksheet(source);
        persistAssessments(source, generatedTest || []);
      }
    }

    if (!source || !source.length) {
      setDownloadError('Worksheet content is unavailable for this lesson.');
      return;
    }

    await createPdfForItems(source.map((q, i) => ({ ...q, number: q.number || (i + 1) })), 'worksheet', previewWin);
  }, [buildWorksheetSet, createPdfForItems, generatedTest, generatedWorksheet, persistAssessments]);

  const handleDownloadTest = useCallback(async () => {
    const ok = await ensurePinAllowed('download');
    if (!ok) return;
    const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    setDownloadError('');

    let source = generatedTest;
    if (!source || !source.length) {
      source = buildTestSet();
      if (source.length) {
        setGeneratedTest(source);
        persistAssessments(generatedWorksheet || [], source);
      }
    }

    if (!source || !source.length) {
      setDownloadError('Test content is unavailable for this lesson.');
      return;
    }

    await createPdfForItems(source.map((q, i) => ({ ...q, number: q.number || (i + 1) })), 'test', previewWin);
  }, [buildTestSet, createPdfForItems, generatedTest, generatedWorksheet, persistAssessments]);

  const handleDownloadCombined = useCallback(async () => {
    const ok = await ensurePinAllowed('download');
    if (!ok) return;
    const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    setDownloadError('');

    let ws = generatedWorksheet;
    let ts = generatedTest;
    if (!ws || !ws.length) {
      ws = buildWorksheetSet();
      if (ws.length) setGeneratedWorksheet(ws);
    }
    if (!ts || !ts.length) {
      ts = buildTestSet();
      if (ts.length) setGeneratedTest(ts);
    }

    if ((ws && ws.length) || (ts && ts.length)) {
      persistAssessments(ws || generatedWorksheet || [], ts || generatedTest || []);
    }

    if ((!ws || !ws.length) && (!ts || !ts.length)) {
      setDownloadError('No worksheet or test content available.');
      return;
    }

    const doc = new jsPDF();
    const lessonTitle = (lessonData?.title || lessonKey || lessonId || 'Lesson').trim();
    let y = 14;
    doc.setFontSize(18);
    doc.text(`${lessonTitle} Facilitator Key`, 14, y);
    y += 10;
    doc.setFontSize(12);

    const renderAnswerLine = (label, num, prompt, answer) => {
      const wrapWidth = 180;
      const header = `${label} ${num}. ${prompt}`.trim();
      const headerLines = doc.splitTextToSize(header, wrapWidth);
      headerLines.forEach((line) => {
        if (y > 280) { doc.addPage(); y = 14; doc.setFontSize(12); }
        doc.text(line, 14, y);
        y += 6;
      });
      const ansLines = doc.splitTextToSize(`Answer: ${answer}`, wrapWidth);
      ansLines.forEach((line) => {
        if (y > 280) { doc.addPage(); y = 14; doc.setFontSize(12); }
        doc.text(line, 20, y);
        y += 6;
      });
      y += 2;
    };

    const extractAnswer = (q) => {
      try {
        if (!q) return 'N/A';
        if (Array.isArray(q.answers)) return q.answers.join(', ');
        if (Array.isArray(q.expected)) return q.expected.join(', ');
        if (Array.isArray(q.answer)) return q.answer.join(', ');
        const direct = q.expected || q.answer || q.solution || q.correct || q.key || q.A || q.a;
        if (typeof direct === 'string' && direct.trim()) return direct.trim();
        if (typeof direct === 'number') return String(direct);
        if (Array.isArray(q.choices)) {
          let idx = Number.isFinite(q.correctIndex) ? q.correctIndex : -1;
          if (idx < 0 && (q.expected || q.answer)) {
            const target = String(q.expected || q.answer).trim().toLowerCase();
            idx = q.choices.findIndex((c) => String(c).trim().toLowerCase() === target);
          }
          if (idx >= 0 && idx < q.choices.length) {
            const letter = String.fromCharCode(65 + idx);
            const choiceText = String(q.choices[idx]).trim();
            return `${letter}) ${choiceText}`;
          }
        }
        if (typeof q.isTrue === 'boolean') return q.isTrue ? 'True' : 'False';
        if (typeof q.trueFalse === 'boolean') return q.trueFalse ? 'True' : 'False';
        return 'N/A';
      } catch {
        return 'N/A';
      }
    };

    if (ws && ws.length) {
      doc.setFontSize(16);
      doc.text('Worksheet Answers', 14, y);
      y += 8;
      doc.setFontSize(12);
      ws.forEach((q, idx) => {
        const prompt = (q.prompt || q.question || q.Q || q.q || '').toString().trim();
        renderAnswerLine('W', q.number || idx + 1, prompt, extractAnswer(q));
      });
      y += 4;
    }

    if (ts && ts.length) {
      if (y > 250) { doc.addPage(); y = 14; }
      doc.setFontSize(16);
      doc.text('Test Answers', 14, y);
      y += 8;
      doc.setFontSize(12);
      ts.forEach((q, idx) => {
        const prompt = (q.prompt || q.question || q.Q || q.q || '').toString().trim();
        renderAnswerLine('T', q.number || idx + 1, prompt, extractAnswer(q));
      });
    }

    const fileBase = String(lessonKey || lessonId || 'lesson').replace(/\.json$/i, '');
    const fileName = `${fileBase}-key.pdf`;
    try {
      const blob = doc.output('blob');
      await shareOrPreviewPdf(blob, fileName, previewWin);
    } catch (err) {
      console.error('[SessionPageV2] Combined PDF generation failed', err);
      setDownloadError('Failed to generate facilitator key.');
    }
  }, [buildTestSet, buildWorksheetSet, generatedTest, generatedWorksheet, lessonData, lessonId, lessonKey, persistAssessments, shareOrPreviewPdf]);

  const handleRefreshWorksheetAndTest = useCallback(async () => {
    const ok = await ensurePinAllowed('refresh');
    if (!ok) return;
    setGeneratedComprehension(null);
    setGeneratedExercise(null);
    setGeneratedWorksheet(null);
    setGeneratedTest(null);
    const key = getAssessmentStorageKey();
    const learnerId = learnerProfile?.id || (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null);
    if (key) {
      try { await clearAssessments(key, { learnerId }); } catch {}
    }
    if (snapshotServiceRef.current) {
      try { await snapshotServiceRef.current.deleteSnapshot(); } catch {}
      resumePhaseRef.current = null;
      setResumePhase(null);
    }
  }, [getAssessmentStorageKey, learnerProfile]);

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

  // Begin button handler: ensure phase exists, then start; start pending timer if queued.
  const handleBeginPhase = async (phaseName) => {
    ensurePhaseInitialized(phaseName);

    const playEnabledForPhase = (p) => {
      if (!p) return true;
      if (p === 'comprehension') return playPortionsEnabledRef.current?.comprehension !== false;
      if (p === 'exercise') return playPortionsEnabledRef.current?.exercise !== false;
      if (p === 'worksheet') return playPortionsEnabledRef.current?.worksheet !== false;
      if (p === 'test') return playPortionsEnabledRef.current?.test !== false;
      return true;
    };
    const skipPlayPortion = ['comprehension', 'exercise', 'worksheet', 'test'].includes(phaseName)
      ? !playEnabledForPhase(phaseName)
      : false;
    
    // Special handling for discussion: prefetch greeting TTS before starting
    if (phaseName === 'discussion') {
      setDiscussionState('loading');
      const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || 'friend';
      const lessonTitle = lessonData?.title || lessonId || 'this topic';
      const greetingText = `Hi ${learnerName}, ready to learn about ${lessonTitle}?`;
      
      try {
        // Prefetch greeting TTS
        await fetchTTS(greetingText);
      } catch (err) {
        console.error('[SessionPageV2] Failed to prefetch greeting:', err);
      }
      
      // Discussion work timer starts when Begin is clicked, not here
    }
    
    const ref = getPhaseRef(phaseName);
    if (ref?.current?.start) {
      if (skipPlayPortion) {
        transitionToWorkTimer(phaseName);
        // Start work timer immediately when skipping play portion (unless timeline jump already started it)
        if (timerServiceRef.current && timelineJumpTimerStartedRef.current !== phaseName) {
          timerServiceRef.current.startWorkPhaseTimer(phaseName);
        }
        await ref.current.start({ skipPlayPortion: true });
      } else {
        await ref.current.start();
      }

      // Q&A phases with play timers: after Begin, tell the learner they can play.
      // (Exclude discussion; skipPlayPortion phases should not say this.)
      if (!skipPlayPortion && ['comprehension', 'exercise', 'worksheet', 'test'].includes(phaseName)) {
        const playLine = 'Now you can play until the play timer runs out.';
        try {
          const playAudio = await fetchTTS(playLine);
          if (audioEngineRef.current) {
            await audioEngineRef.current.playAudio(playAudio || '', [playLine]);
          }
        } catch (err) {
          console.warn('[SessionPageV2] Failed to speak play timer line:', err);
        }
      }
    } else {
      addEvent(`⚠️ Unable to start ${phaseName} (not initialized yet)`);
    }
    
    // Clear the timeline jump timer flag after phase starts
    if (timelineJumpTimerStartedRef.current === phaseName) {
      timelineJumpTimerStartedRef.current = null;
    }
    
    if (pendingPlayTimersRef.current?.[phaseName]) {
      if (!skipPlayPortion) {
        startPhasePlayTimer(phaseName);
      }
      delete pendingPlayTimersRef.current[phaseName];
    }
  };
  
  // Get timer duration for a phase and type from phaseTimers
  const getCurrentPhaseTimerDuration = useCallback((phaseName, timerType) => {
    if (!phaseTimers || !phaseName || !timerType) return 0;
    const key = `${phaseName}_${timerType}_min`;
    return phaseTimers[key] || 0;
  }, [phaseTimers]);

  // Calculate lesson progress percentage (V1 parity)
  // Used by SessionTimer to determine pace color for WORK timers.
  const calculateLessonProgress = useCallback(() => {
    const phaseWeights = {
      discussion: 10,
      teaching: 30,
      comprehension: 50,
      exercise: 70,
      worksheet: 85,
      test: 95
    };

    if (currentPhase === 'complete' || currentPhase === 'closing') return 100;

    const baseWeight = phaseWeights[currentPhase] || 0;
    const snapshot = snapshotServiceRef.current?.snapshot || null;
    const phaseData = snapshot?.phaseData || {};

    const getRatioFromSnapshot = (phaseKey, totalFallback) => {
      const pd = phaseData?.[phaseKey] || {};
      const total = (
        (Number.isFinite(totalFallback) && totalFallback > 0)
          ? totalFallback
          : (Array.isArray(pd.questions) ? pd.questions.length : 0)
      );
      if (!total) return 0;

      const nextIdxRaw = Number.isFinite(pd.nextQuestionIndex)
        ? pd.nextQuestionIndex
        : (Number.isFinite(pd.questionIndex) ? pd.questionIndex : 0);
      const nextIdx = Math.max(0, Math.min(total, nextIdxRaw));
      return Math.max(0, Math.min(1, nextIdx / total));
    };

    let progress = baseWeight;

    if (currentPhase === 'comprehension') {
      const phaseRange = phaseWeights.comprehension - phaseWeights.teaching;
      const ratio = getRatioFromSnapshot('comprehension', comprehensionTotalQuestions);
      progress = phaseWeights.teaching + (ratio * phaseRange);
    } else if (currentPhase === 'exercise') {
      const phaseRange = phaseWeights.exercise - phaseWeights.comprehension;
      const ratio = getRatioFromSnapshot('exercise', exerciseTotalQuestions);
      progress = phaseWeights.comprehension + (ratio * phaseRange);
    } else if (currentPhase === 'worksheet') {
      const phaseRange = phaseWeights.worksheet - phaseWeights.exercise;
      const ratio = getRatioFromSnapshot('worksheet', worksheetTotalQuestions);
      progress = phaseWeights.exercise + (ratio * phaseRange);
    } else if (currentPhase === 'test') {
      const phaseRange = phaseWeights.test - phaseWeights.worksheet;
      const ratio = getRatioFromSnapshot('test', testTotalQuestions);
      progress = phaseWeights.worksheet + (ratio * phaseRange);
    }

    return Math.min(100, Math.max(0, progress));
  }, [currentPhase, comprehensionTotalQuestions, exerciseTotalQuestions, worksheetTotalQuestions, testTotalQuestions]);
  
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
      setShowGames(false);
    } else if (mode === 'work') {
      // Work time exceeded - track for golden key
      addEvent(`â±ï¸ Work time exceeded for ${phaseName}`);
    }
  }, [getCurrentPhaseName, currentTimerMode]);
  
  // Close games overlay whenever we leave play time for the current phase
  useEffect(() => {
    if (!showGames) return;
    const phaseName = getCurrentPhaseName();
    const timerMode = phaseName ? currentTimerMode[phaseName] : null;
    if (timerMode !== 'play') {
      setShowGames(false);
    }
  }, [showGames, getCurrentPhaseName, currentTimerMode]);

  // Handle timer click (for facilitator controls)
  const handleTimerClick = useCallback(async () => {
    let allowed = false;
    try {
      allowed = await ensurePinAllowed('timer');
    } catch (e) {
      console.warn('[SessionPageV2] Timer PIN gate error:', e);
    }
    if (!allowed) return;

    console.log('[SessionPageV2] Timer clicked - showing timer control overlay');
    setShowTimerControl(true);
  }, []);
  
  // Handle timer pause toggle
  const handleTimerPauseToggle = useCallback(async () => {
    let allowed = false;
    try {
      allowed = await ensurePinAllowed('timer');
    } catch (e) {
      console.warn('[SessionPageV2] Timer PIN gate error:', e);
    }
    if (!allowed) return;

    setTimerPaused(prev => {
      const nextPaused = !prev;
      
      // Control the authoritative timer in TimerService
      const timerSvc = timerServiceRef.current;
      if (timerSvc) {
        if (nextPaused) {
          timerSvc.pause();
        } else {
          timerSvc.resume();
        }
      }
      
      return nextPaused;
    });
  }, []);

  const persistTimerStateNow = useCallback((trigger) => {
    try {
      const svc = snapshotServiceRef.current;
      const timerSvc = timerServiceRef.current;
      if (!svc || !timerSvc) return;
      svc.saveProgress(trigger || 'timer-overlay', {
        timerState: timerSvc.getState()
      });
    } catch (err) {
      console.warn('[SessionPageV2] Timer snapshot persist failed:', err);
    }
  }, []);

  // Persist timer state during active sessions so refresh resumes near-current elapsed time.
  // Throttled to avoid spamming Supabase.
  useEffect(() => {
    const eventBus = eventBusRef.current;
    if (!eventBus || !lessonKey) return;

    const minIntervalMs = 10_000;
    const maybePersist = (trigger) => {
      const now = Date.now();
      if (now - lastTimerPersistAtRef.current < minIntervalMs) return;
      lastTimerPersistAtRef.current = now;
      persistTimerStateNow(trigger);
    };

    const unsubPlayStart = eventBus.on('playTimerStart', () => persistTimerStateNow('timer-start-play'));
    const unsubWorkStart = eventBus.on('workPhaseTimerStart', () => persistTimerStateNow('timer-start-work'));
    const unsubPlayExpired = eventBus.on('playTimerExpired', () => persistTimerStateNow('timer-expired-play'));

    const unsubPlayTick = eventBus.on('playTimerTick', () => maybePersist('timer-tick-play'));
    const unsubWorkTick = eventBus.on('workPhaseTimerTick', () => maybePersist('timer-tick-work'));

    const onVisibilityChange = () => {
      try {
        if (document.hidden) {
          // Try to flush the most recent timer state when the tab is backgrounded.
          persistTimerStateNow('visibility-hidden');
        } else {
          // iOS/Safari can suspend intervals while hidden; force a catch-up tick on return.
          try {
            timerServiceRef.current?.resync?.('visibility-visible');
          } catch {}
        }
      } catch {}
    };

    const onFocus = () => {
      try {
        timerServiceRef.current?.resync?.('focus');
      } catch {}
    };

    const onPageShow = () => {
      try {
        timerServiceRef.current?.resync?.('pageshow');
      } catch {}
    };

    const onBeforeUnload = () => {
      try {
        persistTimerStateNow('beforeunload');
      } catch {}
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      try { unsubPlayStart?.(); } catch {}
      try { unsubWorkStart?.(); } catch {}
      try { unsubPlayExpired?.(); } catch {}
      try { unsubPlayTick?.(); } catch {}
      try { unsubWorkTick?.(); } catch {}
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('beforeunload', onBeforeUnload);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [lessonKey, persistTimerStateNow]);

  const handleApplyGoldenKeyForLesson = useCallback(async () => {
    if (goldenKeysEnabledRef.current === false) return;
    if (!lessonKey) return;

    const learnerId = sessionLearnerIdRef.current || learnerProfile?.id || null;
    if (!learnerId || learnerId === 'demo') return;

    // If already applied locally, don't reapply.
    if (hasGoldenKey) return;

    try {
      const learner = await getLearner(learnerId);
      if (!learner) return;

      if (!goldenKeyLessonKey) return;

      const activeKeys = { ...(learner.active_golden_keys || {}) };
      if (activeKeys[goldenKeyLessonKey]) {
        setHasGoldenKey(true);
        setIsGoldenKeySuspended(false);
        const timers = loadPhaseTimersForLearner(learner);
        setGoldenKeyBonus(timers.golden_key_bonus_min || 0);
        setTimerRefreshKey(k => k + 1);
        persistTimerStateNow('golden-key-applied');
        return;
      }

      const available = Number(learner.golden_keys || 0);
      if (!Number.isFinite(available) || available <= 0) {
        return;
      }

      activeKeys[goldenKeyLessonKey] = true;
      const updated = await updateLearner(learnerId, {
        golden_keys: available - 1,
        active_golden_keys: activeKeys
      });

      // Reflect in local session state.
      setLearnerProfile(updated || learner);
      setHasGoldenKey(true);
      setIsGoldenKeySuspended(false);
      const timers = loadPhaseTimersForLearner(updated || learner);
      setGoldenKeyBonus(timers.golden_key_bonus_min || 0);
      setTimerRefreshKey(k => k + 1);
      persistTimerStateNow('golden-key-applied');
    } catch (err) {
      console.warn('[SessionPageV2] Failed to apply golden key:', err);
    }
  }, [hasGoldenKey, lessonKey, goldenKeyLessonKey, learnerProfile, persistTimerStateNow]);

  const handleSuspendGoldenKey = useCallback(() => {
    if (goldenKeysEnabledRef.current === false) return;
    if (!hasGoldenKey) return;
    setIsGoldenKeySuspended(true);
    setGoldenKeyBonus(0);
    setTimerRefreshKey(k => k + 1);
    persistTimerStateNow('golden-key-suspended');
  }, [hasGoldenKey, persistTimerStateNow]);

  const handleUnsuspendGoldenKey = useCallback(() => {
    if (goldenKeysEnabledRef.current === false) return;
    if (!hasGoldenKey) return;
    setIsGoldenKeySuspended(false);
    if (phaseTimers) {
      setGoldenKeyBonus(phaseTimers.golden_key_bonus_min || 5);
    }
    setTimerRefreshKey(k => k + 1);
    persistTimerStateNow('golden-key-unsuspended');
  }, [hasGoldenKey, phaseTimers, persistTimerStateNow]);
  
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
    console.log('[SessionPageV2] PlayTimeExpired countdown complete, transitioning to work');
    setShowPlayTimeExpired(false);
    const phaseToStart = playExpiredPhase;
    setPlayExpiredPhase(null);
    
    if (phaseToStart) {
      console.log('[SessionPageV2] Calling go() for phase:', phaseToStart);
      transitionToWorkTimer(phaseToStart);
      
      // Call go() on the phase controller to start work mode
      try {
        if (phaseToStart === 'discussion') {
          // Discussion starts teaching immediately (no play time)
          startSessionRef.current?.({ ignoreResume: true });
        } else if (phaseToStart === 'comprehension') {
          comprehensionPhaseRef.current?.go();
        } else if (phaseToStart === 'exercise') {
          exercisePhaseRef.current?.go();
        } else if (phaseToStart === 'worksheet') {
          worksheetPhaseRef.current?.go();
        } else if (phaseToStart === 'test') {
          testPhaseRef.current?.go();
        }
      } catch (e) {
        console.error('[SessionPageV2] Failed to call go() on phase:', e);
      }
    }
  }, [playExpiredPhase, transitionToWorkTimer]);
  
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

    // PIN gate: timeline jumps are facilitator-only
    let allowed = false;
    try {
      allowed = await ensurePinAllowed('timeline');
    } catch (e) {
      console.warn('[SessionPageV2] Timeline PIN gate error:', e);
    }
    if (!allowed) {
      timelineJumpInProgressRef.current = false;
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
    
    // Reset opening actions state to prevent zombie UI
    setOpeningActionActive(false);
    setOpeningActionType(null);
    setOpeningActionState({});
    setOpeningActionInput('');
    setOpeningActionError('');
    setOpeningActionBusy(false);
    setShowGames(false);

    // Timeline jumps should enter the destination phase fresh (Begin -> Opening Actions -> Go)
    // even if snapshot phaseData exists. Mark the target so phase init ignores resumeState.
    timelineJumpForceFreshPhaseRef.current = targetPhase;
    
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
    
    // Reset timer for the new phase and START IT IMMEDIATELY (timeline jumps start timers right away)
    // First, stop any existing timers for this phase to ensure clean restart
    if (timerServiceRef.current) {
      timerServiceRef.current.stopPlayTimer(targetPhase);
      timerServiceRef.current.stopWorkPhaseTimer(targetPhase);
    }
    
    // Discussion has no play timer - goes directly to work mode
    // All other phases start in play mode
    const timerMode = targetPhase === 'discussion' ? 'work' : 'play';
    setCurrentTimerMode(prev => ({
      ...prev,
      [targetPhase]: timerMode
    }));
    setTimerRefreshKey(k => k + 1);
    
    // Start the appropriate timer immediately (don't wait for Begin button)
    if (timerServiceRef.current) {
      if (targetPhase === 'discussion') {
        // Discussion starts work timer when greeting plays, but for timeline jump start it now
        timerServiceRef.current.startWorkPhaseTimer(targetPhase);
        timelineJumpTimerStartedRef.current = targetPhase; // Mark that we started the timer
      } else {
        // Other phases start play timer immediately
        timerServiceRef.current.startPlayTimer(targetPhase);
        timelineJumpTimerStartedRef.current = targetPhase; // Mark that we started the timer
      }
    }
    
    // Clear jump in progress flag after a short delay to allow phase to initialize
    setTimeout(() => {
      timelineJumpInProgressRef.current = false;
    }, 500);
  }, [lessonKey]);

  // Opening actions helpers
  const syncOpeningActionState = useCallback(() => {
    const controller = openingActionsControllerRef.current;
    const next = controller?.getState?.() || {};
    setOpeningActionState(next);
    return next;
  }, []);

  const handleOpeningActionCancel = useCallback(() => {
    const controller = openingActionsControllerRef.current;
    if (controller?.cancelCurrent) {
      controller.cancelCurrent();
    }
    // Stop any playing audio
    if (audioEngineRef.current) {
      audioEngineRef.current.stop();
    }
    setOpeningActionActive(false);
    setOpeningActionType(null);
    setOpeningActionState({});
    setOpeningActionInput('');
    setOpeningActionError('');
    setOpeningActionBusy(false);
  }, []);

  const buildAskContext = useCallback(() => {
    const lessonTitle = (lessonData?.title || lessonKey || lessonId || 'this lesson').toString();
    const gradeLevel = (learnerProfile?.grade || lessonData?.grade || '').toString();
    const subject = (lessonData?.subject || subjectParam || 'general').toString();
    const difficulty = (lessonData?.difficulty || 'moderate').toString();

    const rawVocabArray = (() => {
      const possible = lessonData?.vocabulary || lessonData?.vocab || lessonData?.vocab_terms;
      return Array.isArray(possible) ? possible : null;
    })();

    let vocabChunk = '';
    if (rawVocabArray && rawVocabArray.length) {
      const items = rawVocabArray.slice(0, 12).map((v) => {
        if (typeof v === 'string') return { term: v, definition: '' };
        const term = (v && (v.term || v.word || v.title || v.key || '')) || '';
        const def = (v && (v.definition || v.meaning || v.explainer || '')) || '';
        return { term: String(term).trim(), definition: String(def).trim() };
      }).filter((x) => x.term);

      if (items.length) {
        const withDefs = items.some((x) => x.definition);
        if (withDefs) {
          const pairs = items.slice(0, 6).map((x) => `${x.term}: ${x.definition || 'definition not provided'}`).join('; ');
          vocabChunk = `Relevant vocab for this lesson (use provided meanings): ${pairs}.`;
        } else {
          const list = items.map((x) => x.term).join(', ');
          vocabChunk = `Relevant vocab for this lesson (use provided meanings): ${list}.`;
        }
      }
    }

    const formatProblem = (item) => {
      if (!item) return '';
      try {
        const formatted = ensureQuestionMark(formatQuestionForSpeech(item, { layout: 'multiline' }));
        const cleaned = formatted.replace(/\s+/g, ' ').trim();
        if (!cleaned) return '';
        return cleaned.length > 400 ? `${cleaned.slice(0, 400)}...` : cleaned;
      } catch {
        return '';
      }
    };

    let problemBody = '';
    if (currentPhase === 'comprehension' && currentComprehensionQuestion) {
      problemBody = formatProblem(currentComprehensionQuestion);
    } else if (currentPhase === 'exercise' && currentExerciseQuestion) {
      problemBody = formatProblem(currentExerciseQuestion);
    } else if (currentPhase === 'worksheet' && currentWorksheetQuestion) {
      problemBody = formatProblem(currentWorksheetQuestion);
    } else if (currentPhase === 'test' && currentTestQuestion) {
      problemBody = formatProblem(currentTestQuestion);
    }

    const problemChunk = problemBody
      ? `Current problem context (for reference, do not re-read): "${problemBody}"`
      : '';

    return {
      lessonTitle,
      gradeLevel,
      subject,
      difficulty,
      vocabChunk,
      problemChunk
    };
  }, [lessonData, lessonKey, lessonId, learnerProfile, subjectParam, currentPhase, currentComprehensionQuestion, currentExerciseQuestion, currentWorksheetQuestion, currentTestQuestion]);

  const handleOpeningAskStart = useCallback(async () => {
    const controller = openingActionsControllerRef.current;
    if (!controller || openingActionBusy) return;
    setOpeningActionError('');
    setOpeningActionBusy(true);
    try {
      await controller.startAsk();
    } catch (err) {
      console.error('[SessionPageV2] Ask start error:', err);
      setOpeningActionError('Ask is unavailable right now. Try again.');
    } finally {
      setOpeningActionBusy(false);
    }
  }, [openingActionBusy]);

  const handleOpeningAskSubmit = useCallback(async () => {
    const controller = openingActionsControllerRef.current;
    if (!controller) return;
    if (openingActionBusyRef.current) return;
    const question = openingActionInput.trim();
    if (!question) {
      setOpeningActionError('Enter a question first.');
      return;
    }
    openingActionBusyRef.current = true;
    setOpeningActionBusy(true);
    setOpeningActionError('');
    try {
      const askContext = buildAskContext();
      await controller.submitAskQuestion(question, askContext);
      setOpeningActionInput('');
      syncOpeningActionState();
    } catch (err) {
      console.error('[SessionPageV2] Ask submit error:', err);
      setOpeningActionError('Could not send that question. Try again.');
    } finally {
      openingActionBusyRef.current = false;
      setOpeningActionBusy(false);
    }
  }, [openingActionInput, syncOpeningActionState, buildAskContext]);

  const handleOpeningAskDone = useCallback(() => {
    const controller = openingActionsControllerRef.current;
    // Stop any playing audio before completing
    if (audioEngineRef.current) {
      audioEngineRef.current.stop();
    }
    controller?.completeAsk?.();
  }, []);

  const handleOpeningRiddleHint = useCallback(async () => {
    const controller = openingActionsControllerRef.current;
    if (!controller) return;
    setOpeningActionBusy(true);
    setOpeningActionError('');
    try {
      await controller.revealRiddleHint();
      syncOpeningActionState();
    } catch (err) {
      console.error('[SessionPageV2] Riddle hint error:', err);
      setOpeningActionError('Could not get a hint right now.');
    } finally {
      setOpeningActionBusy(false);
    }
  }, [syncOpeningActionState]);

  const handleOpeningRiddleReveal = useCallback(async () => {
    const controller = openingActionsControllerRef.current;
    if (!controller) return;
    setOpeningActionBusy(true);
    setOpeningActionError('');
    try {
      await controller.revealRiddleAnswer();
      syncOpeningActionState();
    } catch (err) {
      console.error('[SessionPageV2] Riddle reveal error:', err);
      setOpeningActionError('Could not reveal the answer right now.');
    } finally {
      setOpeningActionBusy(false);
    }
  }, [syncOpeningActionState]);

  const handleOpeningRiddleGuess = useCallback(async () => {
    const controller = openingActionsControllerRef.current;
    if (!controller) return;
    const guess = openingActionInput.trim();
    if (!guess) {
      setOpeningActionError('Enter your guess first.');
      return;
    }
    setOpeningActionBusy(true);
    setOpeningActionError('');
    try {
      await controller.submitRiddleGuess(guess);
      setOpeningActionInput('');
      syncOpeningActionState();
    } catch (err) {
      console.error('[SessionPageV2] Riddle guess error:', err);
      setOpeningActionError('Could not submit that guess. Try again.');
    } finally {
      setOpeningActionBusy(false);
    }
  }, [openingActionInput, syncOpeningActionState]);

  const handleOpeningRiddleDone = useCallback(() => {
    const controller = openingActionsControllerRef.current;
    controller?.completeRiddle?.();
  }, []);

  const handleOpeningPoemDone = useCallback(() => {
    const controller = openingActionsControllerRef.current;
    controller?.completePoem?.();
  }, []);

  const handleOpeningPoemSuggestions = useCallback(async () => {
    const controller = openingActionsControllerRef.current;
    if (!controller) return;
    
    setOpeningActionError('');
    try {
      await controller.showPoemSuggestions();
    } catch (err) {
      console.error('[SessionPageV2] Poem suggestions error:', err);
      setOpeningActionError('Could not show suggestions.');
    }
  }, []);

  const handleOpeningPoemSubmit = useCallback(async () => {
    const controller = openingActionsControllerRef.current;
    if (!controller) return;
    
    const topic = openingActionInput.trim();
    if (!topic) {
      setOpeningActionError('Please enter a poem topic.');
      return;
    }
    
    setOpeningActionError('');
    setOpeningActionInput('');
    
    try {
      await controller.generatePoem(topic);
    } catch (err) {
      console.error('[SessionPageV2] Poem generation error:', err);
      setOpeningActionError('Could not generate poem.');
    }
  }, [openingActionInput]);

  const handleOpeningStoryContinue = useCallback(async () => {
    const controller = openingActionsControllerRef.current;
    if (!controller) return;
    const line = openingActionInput.trim();
    if (!line) {
      setOpeningActionError('Add a line to continue the story.');
      return;
    }
    setOpeningActionBusy(true);
    setOpeningActionError('');
    try {
      await controller.continueStory(line);
      setOpeningActionInput('');
      syncOpeningActionState();
    } catch (err) {
      console.error('[SessionPageV2] Story continue error:', err);
      setOpeningActionError('Could not continue the story right now.');
    } finally {
      setOpeningActionBusy(false);
    }
  }, [openingActionInput, syncOpeningActionState]);

  const handleOpeningStoryFinish = useCallback(() => {
    const controller = openingActionsControllerRef.current;
    controller?.completeStory?.();
  }, []);

  const handleOpeningFillInFunSubmit = useCallback(async () => {
    const controller = openingActionsControllerRef.current;
    if (!controller) return;
    const current = syncOpeningActionState();
    const ready = current?.action === 'fill-in-fun' && Array.isArray(current?.data?.wordTypes) && current.data.wordTypes.length > 0;
    if (!ready || openingActionBusy) return;
    const word = openingActionInput.trim();
    if (!word) {
      setOpeningActionError('Enter a word to keep going.');
      return;
    }
    setOpeningActionBusy(true);
    setOpeningActionError('');
    try {
      await controller.addFillInFunWord(word);
      setOpeningActionInput('');
      syncOpeningActionState();
    } catch (err) {
      console.error('[SessionPageV2] Fill-in-Fun add word error:', err);
      setOpeningActionError('Could not add that word. Try another.');
    } finally {
      setOpeningActionBusy(false);
    }
  }, [openingActionInput, syncOpeningActionState]);

  const handleOpeningFillInFunStart = useCallback(async () => {
    const controller = openingActionsControllerRef.current;
    if (!controller || openingActionBusy) return;
    setOpeningActionError('');
    setOpeningActionBusy(true);
    try {
      await controller.startFillInFun();
      syncOpeningActionState();
    } catch (err) {
      console.error('[SessionPageV2] Fill-in-Fun start error:', err);
      setOpeningActionError('Fill-in-Fun is unavailable right now. Try again.');
    } finally {
      setOpeningActionBusy(false);
    }
  }, [openingActionBusy, syncOpeningActionState]);

  const handleOpeningFillInFunDone = useCallback(() => {
    const controller = openingActionsControllerRef.current;
    controller?.completeFillInFun?.();
  }, []);

  const handleOpeningJokeDone = useCallback(() => {
    const controller = openingActionsControllerRef.current;
    controller?.completeJoke?.();
  }, []);
  
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
  const footerRef = useRef(null);
  const [footerHeight, setFooterHeight] = useState(0);
  
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

  // Measure the fixed footer height so portrait caption sizing can reserve exact space (V1 parity)
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

  // Set portrait caption height to 35vh
  useEffect(() => {
    if (isMobileLandscape) {
      setStackedCaptionHeight(null);
    } else {
      // 35vh for portrait mode
      const vh = window.innerHeight;
      const targetHeight = Math.floor(vh * 0.35);
      setStackedCaptionHeight(targetHeight);
    }
  }, [isMobileLandscape]);
  
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
      const text = data?.text || '';
      const idxFromEvent = Number.isFinite(data?.index) ? data.index : null;
      setCurrentCaption(text);

      if (text && text.trim()) {
        setTranscriptLines((prev) => {
          const last = prev[prev.length - 1];
          const isDuplicate = last && last.role !== 'user' && last.text === text;
          const nextActive = idxFromEvent ?? (isDuplicate ? prev.length - 1 : prev.length);
          if (isDuplicate) {
            setActiveCaptionIndex(nextActive);
            persistTranscriptState(prev, nextActive);
            return prev;
          }
          const next = [...prev, { text, role: 'assistant' }];
          setActiveCaptionIndex(nextActive);
          persistTranscriptState(next, nextActive);
          return next;
        });
      } else if (idxFromEvent !== null) {
        setActiveCaptionIndex(idxFromEvent);
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
      
      // For discussion and test phases, initialize them but DON'T auto-start them
      // after a timeline jump. They should show the "Begin" button first.
      const isTimelineJump = timelineJumpInProgressRef.current;
      
      // Start phase-specific controller
      if (data.phase === 'discussion') {
        startDiscussionPhase();
        // Discussion has no play timer - start directly in work mode
        setCurrentTimerMode(prev => ({ ...prev, discussion: 'work' }));
        setTimerRefreshKey(k => k + 1);
        // If timeline jump, keep discussionState as 'idle' to show Begin button
        if (!isTimelineJump && discussionPhaseRef.current) {
          discussionPhaseRef.current.start();
        }
      } else if (data.phase === 'teaching') {
        startTeachingPhase();
        // Teaching uses discussion timer (grouped together, already in work mode)
      } else if (data.phase === 'comprehension') {
        const started = startComprehensionPhase();
        if (started) {
          // Start play timer for comprehension once phase exists (unless play portion is disabled)
          if (playPortionsEnabledRef.current?.comprehension !== false) {
            startPhasePlayTimer('comprehension');
          }
        } else {
          if (playPortionsEnabledRef.current?.comprehension !== false) {
            pendingPlayTimersRef.current.comprehension = true;
          }
        }
      } else if (data.phase === 'exercise') {
        const started = startExercisePhase();
        if (started) {
          if (playPortionsEnabledRef.current?.exercise !== false) {
            startPhasePlayTimer('exercise');
          }
        } else {
          if (playPortionsEnabledRef.current?.exercise !== false) {
            pendingPlayTimersRef.current.exercise = true;
          }
        }
      } else if (data.phase === 'worksheet') {
        const started = startWorksheetPhase();
        if (started) {
          if (playPortionsEnabledRef.current?.worksheet !== false) {
            startPhasePlayTimer('worksheet');
          }
        } else {
          if (playPortionsEnabledRef.current?.worksheet !== false) {
            pendingPlayTimersRef.current.worksheet = true;
          }
        }
      } else if (data.phase === 'test') {
        const started = startTestPhase();
        if (started) {
          if (playPortionsEnabledRef.current?.test !== false) {
            startPhasePlayTimer('test');
          }
        } else {
          if (playPortionsEnabledRef.current?.test !== false) {
            pendingPlayTimersRef.current.test = true;
          }
        }
      } else if (data.phase === 'closing') {
        startClosingPhase();
      }
    });
    
    orchestrator.on('sessionComplete', async (data) => {
      addEvent('ðŸ Session complete!');
      setCurrentPhase('complete');
      
      // Set prevention flag to block any snapshot saves during cleanup
      if (typeof window !== 'undefined') {
        window.__PREVENT_SNAPSHOT_SAVE__ = true;
      }
      
      // Show golden key status
      if (goldenKeysEnabledRef.current !== false && timerServiceRef.current) {
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

      // Clear persisted assessment sets so next session rebuilds from scratch
      const key = getAssessmentStorageKey();
      const learnerId = learnerProfile?.id || (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null);
      if (key) {
        try { await clearAssessments(key, { learnerId }); } catch {}
      }
      setGeneratedComprehension(null);
      setGeneratedExercise(null);
      setGeneratedWorksheet(null);
      setGeneratedTest(null);
      
      // Save medal if test was completed
      if (testGrade?.percentage != null && learnerId && lessonKey) {
        try {
          await upsertMedal(learnerId, lessonKey, testGrade.percentage);
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
        ? (timerServiceRef.current?.getGoldenKeyStatus()?.eligible || false)
        : false;

      // If golden key was earned, persist it to the learner inventory (Supabase)
      // NOTE: The toast on /learn/lessons is driven by sessionStorage; that alone does NOT update the DB.
      if (earnedKey) {
        const awardLearnerId = learnerProfile?.id || (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null);
        if (awardLearnerId && awardLearnerId !== 'demo') {
          try {
            const { getLearner, updateLearner } = await import('@/app/facilitator/learners/clientApi');
            const learner = await getLearner(awardLearnerId);
            if (learner) {
              await updateLearner(awardLearnerId, {
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
              addEvent('🔑 Golden Key awarded (saved to learner inventory)');
            }
          } catch (err) {
            console.error('[SessionPageV2] Failed to persist golden key award:', err);
          }
        }
      }

      if (earnedKey && typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('just_earned_golden_key', 'true');
        } catch {}
      }

      // Clear active golden key for this lesson when the lesson is completed (V1 parity).
      // This ensures the key persists across exits/resumes until completion, but does not stick forever after completion.
      if (goldenKeysEnabledRef.current !== false && hasGoldenKeyRef.current) {
        const appliedKey = goldenKeyLessonKeyRef.current;
        const clearLearnerId = learnerProfile?.id || (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null);
        if (appliedKey && clearLearnerId && clearLearnerId !== 'demo') {
          try {
            const { getLearner, updateLearner } = await import('@/app/facilitator/learners/clientApi');
            const learner = await getLearner(clearLearnerId);
            if (learner) {
              const activeKeys = { ...(learner.active_golden_keys || {}) };
              if (activeKeys[appliedKey]) {
                delete activeKeys[appliedKey];
                await updateLearner(clearLearnerId, { active_golden_keys: activeKeys });
              }
            }
          } catch (err) {
            console.warn('[SessionPageV2] Failed to clear active golden key on completion:', err);
          }
        }
      }

      // End tracked session (so Calendar history can detect this completion).
      try { stopSessionPolling?.(); } catch {}
      try {
        await endTrackedSession('completed', {
          source: 'session-v2',
          test_percentage: testGrade?.percentage ?? null,
        });
      } catch {}
      
      // Navigate to lessons page
      console.log('[SessionPageV2] Attempting navigation to lessons page');
      console.log('[SessionPageV2] router:', router);
      console.log('[SessionPageV2] router.push type:', typeof router?.push);
      try {
        if (router && typeof router.push === 'function') {
          console.log('[SessionPageV2] Using router.push');
          router.push('/learn/lessons');
        } else if (typeof window !== 'undefined') {
          console.log('[SessionPageV2] Using window.location.href');
          window.location.href = '/learn/lessons';
        }
      } catch (err) {
        console.error('[SessionPageV2] Navigation error:', err);
        if (typeof window !== 'undefined') {
          try { window.location.href = '/learn/lessons'; } catch {}
        }
      }
    });
    
    return () => {
      orchestrator.destroy();
      orchestratorRef.current = null;
    };
  }, [lessonData]);

  // Initialize OpeningActionsController once audio is ready and lesson is loaded
  useEffect(() => {
    if (!lessonData || !audioReady || !audioEngineRef.current || !eventBusRef.current) return;

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

    const handleOpeningStart = (data) => {
      const actionType = data?.type || data?.action || null;
      addEvent(`Opening action start: ${actionType || 'unknown'}`);
      setOpeningActionActive(true);
      setOpeningActionType(actionType);
      setOpeningActionState(openingController.getState() || {});
      setOpeningActionInput('');
      setOpeningActionError('');
      setOpeningActionBusy(false);
    };

    const handleOpeningComplete = (data) => {
      const actionType = data?.type || data?.action || null;
      addEvent(`Opening action complete: ${actionType || 'unknown'}`);
      setOpeningActionActive(false);
      setOpeningActionType(null);
      setOpeningActionState({});
      setOpeningActionInput('');
      setOpeningActionError('');
      setOpeningActionBusy(false);
    };

    const handleOpeningCancel = (data) => {
      const actionType = data?.type || data?.action || null;
      addEvent(`Opening action cancelled: ${actionType || 'unknown'}`);
      setOpeningActionActive(false);
      setOpeningActionType(null);
      setOpeningActionState({});
      setOpeningActionInput('');
      setOpeningActionError('');
      setOpeningActionBusy(false);
    };

    const unsubStart = eventBusRef.current.on('openingActionStart', handleOpeningStart);
    const unsubComplete = eventBusRef.current.on('openingActionComplete', handleOpeningComplete);
    const unsubCancel = eventBusRef.current.on('openingActionCancel', handleOpeningCancel);

    return () => {
      try { unsubStart?.(); } catch {}
      try { unsubComplete?.(); } catch {}
      try { unsubCancel?.(); } catch {}
      try { openingController.destroy(); } catch {}
      openingActionsControllerRef.current = null;
      setOpeningActionActive(false);
      setOpeningActionType(null);
      setOpeningActionState({});
      setOpeningActionInput('');
      setOpeningActionError('');
      setOpeningActionBusy(false);
    };
  }, [lessonData, audioReady]);

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
      
      // Start discussion work timer when greeting begins (discussion has no play timer)
      if (timerServiceRef.current) {
        timerServiceRef.current.startWorkPhaseTimer('discussion');
      }
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
    
    // Don't auto-start - let handleBeginPhase call start() when user clicks Begin
    // This ensures Begin button shows after timeline jumps
  };
  
  // Start teaching phase
  const startTeachingPhase = () => {
    if (!teachingControllerRef.current) return;

    const savedTeaching = snapshotServiceRef.current?.snapshot?.phaseData?.teaching || null;
    const resumeState = savedTeaching ? {
      stage: savedTeaching.stage,
      sentenceIndex: Number.isFinite(savedTeaching.sentenceIndex) ? savedTeaching.sentenceIndex : 0,
      isInSentenceMode: savedTeaching.isInSentenceMode !== false,
      vocabSentences: Array.isArray(savedTeaching.vocabSentences) ? savedTeaching.vocabSentences : [],
      exampleSentences: Array.isArray(savedTeaching.exampleSentences) ? savedTeaching.exampleSentences : []
    } : null;

    if (resumeState) {
      const total = resumeState.stage === 'examples'
        ? resumeState.exampleSentences.length
        : resumeState.vocabSentences.length;
      if (resumeState.stage) setTeachingStage(resumeState.stage);
      if (total) setTotalSentences(total);
      setSentenceIndex(Math.max(0, Math.min(resumeState.sentenceIndex || 0, Math.max(0, total - 1))));
      setIsInSentenceMode(resumeState.isInSentenceMode !== false);
    }
    
    // Wire up teaching complete to orchestrator
    const handleTeachingComplete = (data) => {
      addEvent(`ðŸŽ‰ Teaching complete! (${data.vocabCount} vocab, ${data.exampleCount} examples)`);
      setTeachingStage('complete');

      // Discussion work timer spans discussion + teaching (complete it when teaching finishes).
      if (timerServiceRef.current) {
        timerServiceRef.current.completeWorkPhaseTimer('discussion');
        const time = timerServiceRef.current.getWorkPhaseTime('discussion');
        if (time) {
          setWorkPhaseCompletions(prev => ({
            ...prev,
            discussion: time.onTime
          }));
          setWorkTimeRemaining(prev => ({
            ...prev,
            discussion: time.remaining / 60
          }));
        }
      }
      
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
    teachingControllerRef.current.startTeaching({ autoplayFirstSentence: false, resumeState });
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
      persistAssessments(generatedWorksheet || [], generatedTest || [], questions, generatedExercise || []);
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
      
      // Track work phase completion for golden key
      if (timerServiceRef.current) {
        const time = timerServiceRef.current.getWorkPhaseTime('comprehension');
        if (time) {
          setWorkPhaseCompletions(prev => ({
            ...prev,
            comprehension: time.onTime
          }));
          setWorkTimeRemaining(prev => ({
            ...prev,
            comprehension: time.remaining / 60
          }));
        }
      }
      
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

    // Start play timer at the Begin gate (before Begin is clicked) for play-enabled Q&A phases.
    // Do NOT do this on resume auto-start, and do NOT double-start after timeline jumps.
    const resumeMatch = !!snapshotServiceRef.current?.snapshot && resumePhaseRef.current === 'comprehension';
    const shouldAutoStart = resumeMatch || !!savedComp;
    const shouldStartPlayAtBeginGate = !shouldAutoStart && playPortionsEnabledRef.current?.comprehension !== false;
    if (
      shouldStartPlayAtBeginGate
      && timerServiceRef.current
      && timelineJumpTimerStartedRef.current !== 'comprehension'
    ) {
      timerServiceRef.current.startPlayTimer('comprehension');
    }
    
    // Auto-start when resuming into this phase so refreshes do not surface the Begin button.
    if (shouldAutoStart && phase.start) {
      if (playPortionsEnabledRef.current?.comprehension === false) {
        transitionToWorkTimer('comprehension');
        phase.start({ skipPlayPortion: true });
        if (pendingPlayTimersRef.current?.comprehension) {
          delete pendingPlayTimersRef.current.comprehension;
        }
      } else {
        phase.start();
        if (pendingPlayTimersRef.current?.comprehension) {
          startPhasePlayTimer('comprehension');
          delete pendingPlayTimersRef.current.comprehension;
        }
      }
    }

    if (forceFresh) {
      timelineJumpForceFreshPhaseRef.current = null;
    }
    return true;
  };
  
  // Start exercise phase
  // Helper: Build question pool from lesson data arrays with 80/20 MC+TF vs SA+FIB blend
  function buildQuestionPool(target = 5, excludeTypes = []) {
    const tf = !excludeTypes.includes('tf') && Array.isArray(lessonData?.truefalse) 
      ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf', type: 'tf' })) : [];
    const mc = !excludeTypes.includes('mc') && Array.isArray(lessonData?.multiplechoice) 
      ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc', type: 'mc' })) : [];
    const fib = !excludeTypes.includes('fib') && Array.isArray(lessonData?.fillintheblank) 
      ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib', type: 'fib' })) : [];
    const sa = !excludeTypes.includes('short') && Array.isArray(lessonData?.shortanswer) 
      ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short', type: 'short' })) : [];
    
    const pool = [...tf, ...mc, ...fib, ...sa];
    const blended = blendByType(pool, target);
    return blended;
  }

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

    const forceFresh = timelineJumpForceFreshPhaseRef.current === 'exercise';

    const snapshot = snapshotServiceRef.current?.snapshot;
    const savedExercise = forceFresh ? null : (snapshot?.phaseData?.exercise || null);
    const savedExerciseQuestions = !forceFresh && Array.isArray(savedExercise?.questions) && savedExercise.questions.length ? savedExercise.questions : null;
    if (savedExerciseQuestions && savedExerciseQuestions.length && (!generatedExercise || !generatedExercise.length)) {
      setGeneratedExercise(savedExerciseQuestions);
    }
    const storedExerciseQuestions = !forceFresh && Array.isArray(generatedExercise) && generatedExercise.length ? generatedExercise : null;
    
    const exerciseTarget = savedExerciseQuestions ? savedExerciseQuestions.length : (storedExerciseQuestions ? storedExerciseQuestions.length : getLearnerTarget('exercise'));
    if (!exerciseTarget) return false;
    // Build exercise questions with 80/20 MC+TF vs SA+FIB blend
    const questions = savedExerciseQuestions || storedExerciseQuestions || buildQuestionPool(exerciseTarget, []);
    console.log('[SessionPageV2] startExercisePhase built questions:', questions.length);

    const resumeIndex = (!forceFresh && savedExercise) ? (savedExercise.nextQuestionIndex ?? savedExercise.questionIndex ?? 0) : 0;
    const clampedIndex = Math.min(Math.max(resumeIndex, 0), Math.max(questions.length - 1, 0));
    setExerciseTotalQuestions(questions.length);
    setExerciseScore(savedExercise?.score || 0);
    if (questions[clampedIndex]) {
      setCurrentExerciseQuestion(questions[clampedIndex]);
    }
    if ((!exerciseState || exerciseState === 'idle') && savedExercise) {
      setExerciseState('awaiting-answer');
    }
    
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
        nextQuestionIndex: forceFresh ? 0 : (savedExercise?.nextQuestionIndex ?? savedExercise?.questionIndex ?? 0),
        score: forceFresh ? 0 : (savedExercise?.score || 0),
        answers: forceFresh ? [] : (savedExercise?.answers || []),
        timerMode: forceFresh ? 'play' : (savedExercise?.timerMode || 'play')
      });
    }
    if (!savedExerciseQuestions && !storedExerciseQuestions) {
      setGeneratedExercise(questions);
      persistAssessments(generatedWorksheet || [], generatedTest || [], generatedComprehension || [], questions);
    }
    
    const phase = new ExercisePhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions,
      resumeState: (!forceFresh && savedExercise) ? {
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
          addEvent(`Exercise completed in ${time.formatted} ${status}`);
          setWorkPhaseCompletions(prev => ({ ...prev, exercise: time.onTime }));
          setWorkTimeRemaining(prev => ({ ...prev, exercise: time.remaining / 60 }));
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

    // Start play timer at the Begin gate (before Begin is clicked) for play-enabled Q&A phases.
    // Do NOT do this on resume auto-start, and do NOT double-start after timeline jumps.
    const resumeMatch = !!snapshotServiceRef.current?.snapshot && resumePhaseRef.current === 'exercise';
    const shouldAutoStart = resumeMatch || !!savedExercise;
    const shouldStartPlayAtBeginGate = !shouldAutoStart && playPortionsEnabledRef.current?.exercise !== false;
    if (
      shouldStartPlayAtBeginGate
      && timerServiceRef.current
      && timelineJumpTimerStartedRef.current !== 'exercise'
    ) {
      timerServiceRef.current.startPlayTimer('exercise');
    }
    
    // Auto-start when resuming into this phase so refreshes do not surface the Begin button.
    if (shouldAutoStart && phase.start) {
      if (playPortionsEnabledRef.current?.exercise === false) {
        transitionToWorkTimer('exercise');
        phase.start({ skipPlayPortion: true });
        if (pendingPlayTimersRef.current?.exercise) {
          delete pendingPlayTimersRef.current.exercise;
        }
      } else {
        phase.start();
        if (pendingPlayTimersRef.current?.exercise) {
          startPhasePlayTimer('exercise');
          delete pendingPlayTimersRef.current.exercise;
        }
      }
    }

    if (forceFresh) {
      timelineJumpForceFreshPhaseRef.current = null;
    }
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

    const forceFresh = timelineJumpForceFreshPhaseRef.current === 'worksheet';

    const snapshot = snapshotServiceRef.current?.snapshot;
    const savedWorksheet = forceFresh ? null : (snapshot?.phaseData?.worksheet || null);
    const savedWorksheetQuestions = !forceFresh && Array.isArray(savedWorksheet?.questions) && savedWorksheet.questions.length ? savedWorksheet.questions : null;
    if (savedWorksheetQuestions && savedWorksheetQuestions.length && (!generatedWorksheet || !generatedWorksheet.length)) {
      setGeneratedWorksheet(savedWorksheetQuestions);
    }

    let questions = savedWorksheetQuestions || generatedWorksheet || [];
    if (!questions.length) {
      questions = buildWorksheetSet();
      if (questions.length) {
        setGeneratedWorksheet(questions);
        persistAssessments(questions, generatedTest || [], generatedComprehension || [], generatedExercise || []);
      }
    }

    const worksheetTarget = questions.length || getLearnerTarget('worksheet');
    if (!worksheetTarget) return false;
    console.log('[SessionPageV2] startWorksheetPhase built questions:', questions.length);

    const resumeIndex = (!forceFresh && savedWorksheet) ? (savedWorksheet.nextQuestionIndex ?? savedWorksheet.questionIndex ?? 0) : 0;
    const clampedIndex = Math.min(Math.max(resumeIndex, 0), Math.max(questions.length - 1, 0));
    setWorksheetTotalQuestions(questions.length);
    setWorksheetScore(savedWorksheet?.score || 0);
    if (questions[clampedIndex]) {
      setCurrentWorksheetQuestion(questions[clampedIndex]);
    }
    if ((!worksheetState || worksheetState === 'idle') && savedWorksheet) {
      setWorksheetState('awaiting-answer');
    }
    
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
        nextQuestionIndex: forceFresh ? 0 : (savedWorksheet?.nextQuestionIndex ?? savedWorksheet?.questionIndex ?? 0),
        score: forceFresh ? 0 : (savedWorksheet?.score || 0),
        answers: forceFresh ? [] : (savedWorksheet?.answers || []),
        timerMode: forceFresh ? 'play' : (savedWorksheet?.timerMode || 'play')
      });
    }
    
    const phase = new WorksheetPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions,
      resumeState: (!forceFresh && savedWorksheet) ? {
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
          setWorkPhaseCompletions(prev => ({ ...prev, worksheet: time.onTime }));
          setWorkTimeRemaining(prev => ({ ...prev, worksheet: time.remaining / 60 }));
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

    // Start play timer at the Begin gate (before Begin is clicked) for play-enabled Q&A phases.
    // Do NOT do this on resume auto-start, and do NOT double-start after timeline jumps.
    const resumeMatch = !!snapshotServiceRef.current?.snapshot && resumePhaseRef.current === 'worksheet';
    const shouldAutoStart = resumeMatch || !!savedWorksheet;
    const shouldStartPlayAtBeginGate = !shouldAutoStart && playPortionsEnabledRef.current?.worksheet !== false;
    if (
      shouldStartPlayAtBeginGate
      && timerServiceRef.current
      && timelineJumpTimerStartedRef.current !== 'worksheet'
    ) {
      timerServiceRef.current.startPlayTimer('worksheet');
    }
    
    // Auto-start when resuming into this phase so refreshes do not surface the Begin button.
    if (shouldAutoStart && phase.start) {
      if (playPortionsEnabledRef.current?.worksheet === false) {
        transitionToWorkTimer('worksheet');
        phase.start({ skipPlayPortion: true });
        if (pendingPlayTimersRef.current?.worksheet) {
          delete pendingPlayTimersRef.current.worksheet;
        }
      } else {
        phase.start();
        if (pendingPlayTimersRef.current?.worksheet) {
          startPhasePlayTimer('worksheet');
          delete pendingPlayTimersRef.current.worksheet;
        }
      }
    }

    if (forceFresh) {
      timelineJumpForceFreshPhaseRef.current = null;
    }
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
    if (testPhaseRef.current) {
      try {
        testPhaseRef.current.destroy();
      } catch (err) {
        console.warn('[SessionPageV2] Existing TestPhase destroy failed:', err);
      }
      testPhaseRef.current = null;
    }
    try {
      audioEngineRef.current.stop();
    } catch {}
    if (!learnerProfile) {
      addEvent('⏸️ Learner not loaded yet - delaying test init');
      return false;
    }

    const forceFresh = false; // test deck should persist unless explicitly refreshed

    const snapshot = snapshotServiceRef.current?.snapshot;
    const savedTest = snapshot?.phaseData?.test || null;
    const savedTestQuestions = Array.isArray(savedTest?.questions) && savedTest.questions.length ? savedTest.questions : null;
    if (savedTestQuestions && (!generatedTest || !generatedTest.length)) {
      setGeneratedTest(savedTestQuestions);
    }

    // Prefer saved deck, then cached generation; rebuild only when none exist.
    let questions = savedTestQuestions || generatedTest || [];
    if (!questions.length) {
      questions = buildTestSet();
      if (questions.length) {
        setGeneratedTest(questions);
        persistAssessments(generatedWorksheet || [], questions, generatedComprehension || [], generatedExercise || []);
      }
    }

    // Trim deck to the learner target so completion enters review after the expected count.
    const targetCount = getLearnerTarget('test') || questions.length;
    const maxQuestions = targetCount > 0 ? targetCount : questions.length;
    if (maxQuestions && questions.length > maxQuestions) {
      questions = questions.slice(0, maxQuestions);
    }

    const testTarget = questions.length;
    if (!testTarget) return false;
    console.log('[SessionPageV2] startTestPhase built questions:', questions.length);

    const resumeIndex = savedTest ? (savedTest.nextQuestionIndex ?? savedTest.questionIndex ?? 0) : 0;
    const clampedIndex = Math.min(Math.max(resumeIndex, 0), Math.max(questions.length - 1, 0));
    setTestTotalQuestions(questions.length);
    setTestScore(savedTest?.score || 0);
    if (questions[clampedIndex]) {
      setCurrentTestQuestion(questions[clampedIndex]);
    }
    // Only restore state if NOT a timeline jump - timeline jumps should always show Begin button
    const isTimelineJump = timelineJumpInProgressRef.current;
    if ((!testState || testState === 'idle') && savedTest && !isTimelineJump) {
      setTestState('awaiting-answer');
    }
    
    if (questions.length === 0) {
      // If no test questions, skip to closing
      addEvent('âš ï¸ No test questions - skipping to closing');
      if (orchestratorRef.current) {
        orchestratorRef.current.onTestComplete();
      }
      return false;
    }
    
    const restoreNextIndex = Math.min(savedTest?.nextQuestionIndex ?? savedTest?.questionIndex ?? 0, questions.length);
    const restoreAnswers = (Array.isArray(savedTest?.answers) ? savedTest.answers : []).slice(0, questions.length);
    const restoreReviewIndex = Math.min(savedTest?.reviewIndex || 0, restoreAnswers.length);

    if (snapshotServiceRef.current) {
      snapshotServiceRef.current.saveProgress('test-init', {
        phaseOverride: 'test',
        questions,
        nextQuestionIndex: restoreNextIndex,
        score: forceFresh ? 0 : (savedTest?.score || 0),
        answers: restoreAnswers,
        timerMode: forceFresh ? 'play' : (savedTest?.timerMode || 'play'),
        reviewIndex: restoreReviewIndex
      });
    }

    const phase = new TestPhase({
      audioEngine: audioEngineRef.current,
      eventBus: eventBusRef.current,
      timerService: timerServiceRef.current,
      questions: questions,
      resumeState: savedTest ? {
        questions,
        nextQuestionIndex: restoreNextIndex,
        score: savedTest.score || 0,
        answers: restoreAnswers,
        timerMode: savedTest.timerMode || 'work',
        reviewIndex: restoreReviewIndex
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
      console.log('[SessionPageV2] testQuestionsComplete event received:', data);
      addEvent(`ðŸ“Š Test questions done! Score: ${data.score}/${data.totalQuestions} (${data.percentage}%) - Grade: ${data.grade}`);
      setTestGrade(data);
      console.log('[SessionPageV2] Setting testState to reviewing');
      setTestState('reviewing');
      
      // Prefetch congrats TTS for fast Complete Lesson response
      const congratsText = 'Great job completing the lesson!';
      fetchTTS(congratsText).then(audioBase64 => {
        if (audioBase64) setCongratsTtsUrl(audioBase64);
      }).catch(err => {
        console.warn('[SessionPageV2] Failed to prefetch congrats TTS:', err);
      });
      
      // Complete work phase timer when entering review
      if (timerServiceRef.current) {
        timerServiceRef.current.completeWorkPhaseTimer('test');
        const time = timerServiceRef.current.getWorkPhaseTime('test');
        if (time) {
          const status = time.onTime ? 'âœ… On time!' : 'â° Time exceeded';
          addEvent(`â±ï¸ Test completed in ${time.formatted} ${status}`);
          setWorkPhaseCompletions(prev => ({ ...prev, test: time.onTime }));
          setWorkTimeRemaining(prev => ({ ...prev, test: time.remaining / 60 }));
        }
        
        const goldenKey = timerServiceRef.current.getGoldenKeyStatus();
        if (goldenKey.eligible) {
          addEvent('Golden Key Earned! 3 on-time completions!');
        }
      }
    });
    phase.on('reviewQuestion', (data) => {
      console.log('[SessionPageV2] reviewQuestion event received:', data);
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
          setWorkPhaseCompletions(prev => ({ ...prev, test: time.onTime }));
          setWorkTimeRemaining(prev => ({ ...prev, test: time.remaining / 60 }));
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

    // Start play timer at the Begin gate (before Begin is clicked) for play-enabled Q&A phases.
    // Do NOT do this on resume auto-start, and do NOT double-start after timeline jumps.
    const resumeMatch = !!snapshotServiceRef.current?.snapshot && resumePhaseRef.current === 'test';
    const shouldAutoStart = !isTimelineJump && (resumeMatch || !!savedTest);
    const shouldStartPlayAtBeginGate = !shouldAutoStart && playPortionsEnabledRef.current?.test !== false;
    if (
      shouldStartPlayAtBeginGate
      && timerServiceRef.current
      && timelineJumpTimerStartedRef.current !== 'test'
    ) {
      timerServiceRef.current.startPlayTimer('test');
    }
    
    // Auto-start only when resuming into this phase so refreshes do not surface the Begin button.
    // Timeline jumps should ALWAYS show the Begin button first, even if savedTest exists.
    if (shouldAutoStart && phase.start) {
      if (playPortionsEnabledRef.current?.test === false) {
        transitionToWorkTimer('test');
        phase.start({ skipPlayPortion: true });
        if (pendingPlayTimersRef.current?.test) {
          delete pendingPlayTimersRef.current.test;
        }
      } else {
        phase.start();
        if (pendingPlayTimersRef.current?.test) {
          startPhasePlayTimer('test');
          delete pendingPlayTimersRef.current.test;
        }
      }
    }

    if (forceFresh) {
      timelineJumpForceFreshPhaseRef.current = null;
    }
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
    
    // Auto-start closing phase (no Begin button needed for farewell)
    // If we just played the "Complete Lesson" congrats message, wait for it to finish.
    if (deferClosingStartUntilAudioEndRef.current && audioEngineRef.current) {
      const engine = audioEngineRef.current;
      
      let started = false;
      const onEnd = (data) => {
        // Only start farewell when congrats audio actually completes
        if (started || !data.completed) return;
        started = true;
        try { engine.off?.('end', onEnd); } catch {}
        deferClosingStartUntilAudioEndRef.current = false;
        // Small delay to ensure clean transition
        setTimeout(() => {
          try { phase.start(); } catch {}
        }, 100);
      };

      try {
        engine.on?.('end', onEnd);
      } catch {
        // If we cannot subscribe, fall back to delayed start.
        deferClosingStartUntilAudioEndRef.current = false;
        setTimeout(() => phase.start(), 500);
      }
      return;
    }

    phase.start();
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

    if (options?.ignoreResume) {
      resetTranscriptState();
    }
    
    // Start teaching prefetch in the background (needs to be ready by Teaching phase).
    // Defer off the Begin click call stack so the "Loading..." state can render immediately.
    if (teachingControllerRef.current) {
      setTimeout(() => {
        try {
          teachingControllerRef.current?.prefetchAll?.();
          addEvent('📄 Started background prefetch of teaching content');
        } catch {
          // Silent
        }
      }, 0);
    }
    
    // Prep video element (load + seek to first frame). The actual iOS autoplay unlock
    // is handled inside AudioEngine.initialize() (play() during gesture, pause on 'playing').
    try {
      if (videoRef.current) {
        try { videoRef.current.muted = true; } catch {}
        if (videoRef.current.readyState < 2) {
          try { videoRef.current.load(); } catch {}
        }
        try { videoRef.current.currentTime = 0; } catch {}
      }
    } catch {}
    
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

    const supabase = getSupabaseClient();
    const { data: sessionResult } = await supabase?.auth.getSession() || {};
    const token = sessionResult?.session?.access_token;
    if (!token) {
      throw new Error('Not logged in');
    }

    const res = await fetch('/api/facilitator/pin/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ pin: pinCode })
    });

    const result = await res.json().catch(() => null);
    if (!res.ok || !result?.ok) {
      throw new Error('Invalid PIN');
    }

    if (conflictingSession?.id) {
      try {
        const { endLessonSession } = await import('@/app/lib/sessionTracking');
        await endLessonSession(conflictingSession.id, {
          reason: 'taken_over',
          metadata: {
            taken_over_by_session_id: browserSessionId,
            taken_over_at: new Date().toISOString(),
          },
          learnerId: trackingLearnerId,
          lessonId: trackingLessonId,
        });
      } catch {}
    }

    try {
      const deviceName = typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown';
      const takeoverStart = await startTrackedSession(browserSessionId, deviceName);
      if (takeoverStart?.conflict) {
        throw new Error('Lesson is still active on another device');
      }
      try { startSessionPolling?.(); } catch {}
    } catch (err) {
      throw err;
    }

    // Clear local snapshot so reload pulls the latest remote snapshot.
    try {
      localStorage.removeItem(`atomic_snapshot:${trackingLearnerId}:${trackingLessonId}`);
    } catch {}

    setShowTakeoverDialog(false);
    setConflictingSession(null);

    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }, [browserSessionId, conflictingSession, learnerProfile?.id, lessonKey, startTrackedSession, startSessionPolling]);

  const handleCancelTakeover = useCallback(() => {
    setShowTakeoverDialog(false);
    setConflictingSession(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/learn/lessons';
    }
  }, []);

  // Allow early-declared callbacks to invoke startSession without TDZ issues.
  startSessionRef.current = startSession;
  
  const startTeaching = async (options = {}) => {
    if (!teachingControllerRef.current) return;
    await teachingControllerRef.current.startTeaching(options);
  };
  
  const nextSentence = async () => {
    if (!teachingControllerRef.current) return;
    
    // Show loading if GPT content isn't ready
    setTeachingLoading(true);
    try {
      await teachingControllerRef.current.nextSentence();
    } finally {
      setTeachingLoading(false);
    }
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
    
    // If we're in a phase with a skip handler, call it to transition state properly
    const phaseName = getCurrentPhaseName();
    if (phaseName === 'comprehension' && comprehensionPhaseRef.current?.skip) {
      comprehensionPhaseRef.current.skip();
    } else if (phaseName === 'exercise' && exercisePhaseRef.current?.skip) {
      exercisePhaseRef.current.skip();
    } else if (phaseName === 'worksheet' && worksheetPhaseRef.current?.skip) {
      worksheetPhaseRef.current.skip();
    } else if (phaseName === 'test' && testPhaseRef.current?.skip) {
      testPhaseRef.current.skip();
    }
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
  const submitComprehensionAnswer = async () => {
    if (!comprehensionPhaseRef.current) return;
    const answerText = comprehensionAnswer;
    if (answerText && answerText.trim()) {
      appendTranscriptLine({ text: answerText, role: 'user' });
    }
    setComprehensionSubmitting(true);
    try {
      await comprehensionPhaseRef.current.submitAnswer(answerText);
      setComprehensionAnswer('');
    } finally {
      setComprehensionSubmitting(false);
    }
  };
  
  const skipComprehension = () => {
    if (!comprehensionPhaseRef.current) return;
    comprehensionPhaseRef.current.skip();
  };
  
  // Exercise handlers
  const submitExerciseAnswer = async () => {
    if (!exercisePhaseRef.current || !selectedExerciseAnswer) return;
    appendTranscriptLine({ text: selectedExerciseAnswer, role: 'user' });
    setExerciseSubmitting(true);
    try {
      await exercisePhaseRef.current.submitAnswer(selectedExerciseAnswer);
    } finally {
      setExerciseSubmitting(false);
    }
  };
  
  const skipExerciseQuestion = () => {
    if (!exercisePhaseRef.current) return;
    exercisePhaseRef.current.skip();
  };
  
  // Worksheet handlers
  const submitWorksheetAnswer = async () => {
    if (!worksheetPhaseRef.current || !worksheetAnswer.trim()) return;
    appendTranscriptLine({ text: worksheetAnswer, role: 'user' });
    setWorksheetSubmitting(true);
    try {
      await worksheetPhaseRef.current.submitAnswer(worksheetAnswer);
      setWorksheetAnswer('');
    } finally {
      setWorksheetSubmitting(false);
    }
  };
  
  const skipWorksheetQuestion = () => {
    if (!worksheetPhaseRef.current) return;
    worksheetPhaseRef.current.skip();
  };
  
  // Test handlers
  const submitTestAnswer = async () => {
    if (!testPhaseRef.current) return;
    
    const question = currentTestQuestion;
    if (!question) return;
    
    setTestSubmitting(true);
    try {
      if (question.type === 'fill' || question.type === 'fib' || question.sourceType === 'fib') {
        if (!testAnswer.trim()) return;
        appendTranscriptLine({ text: testAnswer, role: 'user' });
        await testPhaseRef.current.submitAnswer(testAnswer);
        setTestAnswer('');
      } else {
        // MC/TF
        if (!testAnswer) return;
        appendTranscriptLine({ text: testAnswer, role: 'user' });
        await testPhaseRef.current.submitAnswer(testAnswer);
        setTestAnswer('');
      }
    } finally {
      setTestSubmitting(false);
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
  
  const skipTestReview = async () => {
    if (!testPhaseRef.current) return;
    
    // Play prefetched congrats TTS immediately for responsive feel
    if (congratsTtsUrl && audioEngineRef.current) {
      try {
        // Prevent the ClosingPhase farewell from interrupting this message.
        deferClosingStartUntilAudioEndRef.current = true;
        audioEngineRef.current.playAudio(congratsTtsUrl, ['Great job completing the lesson!']);
      } catch (err) {
        console.warn('[SessionPageV2] Failed to play congrats TTS:', err);
      }
    }
    
    // Let completion logic happen in background (don't await)
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
        top: isMobileLandscape ? 'clamp(52px, 8vh, 72px)' : 'auto',
        left: isMobileLandscape ? 0 : 'auto',
        right: isMobileLandscape ? 0 : 'auto',
        zIndex: 50,
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
          {phaseTimers && !showGames && getCurrentPhaseName() && currentTimerMode[getCurrentPhaseName()] && (
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
                goldenKeyBonus={currentTimerMode[getCurrentPhaseName()] === 'play' && goldenKeysEnabledRef.current !== false ? goldenKeyBonus : 0}
                lessonProgress={calculateLessonProgress()}
                isPaused={timerPaused}
                elapsedSeconds={currentTimerMode[getCurrentPhaseName()] === 'play' ? playTimerDisplayElapsed : workTimerDisplayElapsed}
                remainingSeconds={currentTimerMode[getCurrentPhaseName()] === 'play' ? playTimerDisplayRemaining : workTimerDisplayRemaining}
                onPauseToggle={handleTimerPauseToggle}
                lessonKey={lessonKey}
                onTimerClick={handleTimerClick}
              />
            </div>
          )}
          
          {/* Video overlay controls - bottom right (Skip/Repeat + mute) */}
          <div style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            display: 'flex',
            gap: 12,
            zIndex: 10
          }}>
            {/* Skip/Repeat (acts as one button) */}
            {engineState === 'playing' && (
              <button
                type="button"
                onClick={skipTTS}
                aria-label="Skip"
                title="Skip"
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
                <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 4 15 12 5 20 5 4" />
                  <line x1="19" y1="5" x2="19" y2="19" />
                </svg>
              </button>
            )}

            {engineState !== 'playing' && showRepeatButton && (
              <button
                type="button"
                onClick={replayTTS}
                aria-label="Repeat"
                title="Repeat"
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
                <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 1v6h-6" />
                  <path d="M7 23v-6h6" />
                  <path d="M3.51 9a9 9 0 0114.13-3.36L17 7" />
                  <path d="M20.49 15A9 9 0 015.36 18.36L7 17" />
                </svg>
              </button>
            )}

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
          
          {/* Bottom-left control cluster (Ask + Visual Aids) */}
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              display: 'flex',
              gap: 12,
              zIndex: 10
            }}
          >
            {(() => {
              const canShowAsk = !!openingActionsControllerRef.current && !openingActionActive && normalizePhaseAlias(currentPhase) !== 'test';
              const disabled = openingActionBusy || !canShowAsk;
              if (!canShowAsk) return null;
              return (
                <button
                  type="button"
                  onClick={handleOpeningAskStart}
                  disabled={disabled}
                  aria-label="Ask Ms. Sonoma"
                  title="Ask Ms. Sonoma"
                  style={{
                    background: disabled ? '#9ca3af' : '#2563eb',
                    color: '#fff',
                    border: 'none',
                    width: 'clamp(34px, 6.2vw, 52px)',
                    height: 'clamp(34px, 6.2vw, 52px)',
                    display: 'grid',
                    placeItems: 'center',
                    borderRadius: '50%',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    boxShadow: disabled ? 'none' : '0 2px 8px rgba(37,99,235,0.35)',
                    fontSize: 'clamp(16px, 3.3vw, 22px)',
                    fontWeight: 800
                  }}
                >
                  ✋
                </button>
              );
            })()}

            {Array.isArray(visualAidsData) && visualAidsData.length > 0 && (
              <button
                type="button"
                onClick={() => setShowVisualAids(true)}
                aria-label="Visual Aids"
                title="Visual Aids"
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
                <span style={{ fontSize: 'clamp(16px, 3.3vw, 22px)', lineHeight: 1 }}>🖼️</span>
              </button>
            )}
          </div>
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
      <div ref={captionColRef} style={transcriptWrapperStyle}>
        {currentPhase === 'test' && testState === 'reviewing' && testGrade ? (
          <TestReviewUI
            testGrade={testGrade}
            generatedTest={generatedTest}
            timerService={timerServiceRef.current}
            workPhaseCompletions={workPhaseCompletions}
            workTimeRemaining={workTimeRemaining}
            goldenKeysEnabled={goldenKeysEnabled !== false}
            onOverrideAnswer={handleTestOverrideAnswer}
            onCompleteReview={skipTestReview}
          />
        ) : (
          <CaptionPanel
            sentences={transcriptLines}
            activeIndex={activeCaptionIndex}
            boxRef={transcriptRef}
            fullHeight={isMobileLandscape}
            stackedHeight={isMobileLandscape ? '100%' : (stackedCaptionHeight || null)}
            phase={currentPhase}
            vocabTerms={vocabTerms}
          />
        )}
      </div>
      
      </div> {/* end main layout */}
      </div> {/* end content wrapper */}
      
      {/* Fixed footer with input controls */}
      <div ref={footerRef} style={{
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
          
          {(() => {
            const awaitingGo = (
              (currentPhase === 'comprehension' && comprehensionState === 'awaiting-go') ||
              (currentPhase === 'exercise' && exerciseState === 'awaiting-go') ||
              (currentPhase === 'worksheet' && worksheetState === 'awaiting-go') ||
              (currentPhase === 'test' && testState === 'awaiting-go')
            );

            if (!awaitingGo || openingActionActive) return null;

            return (
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
                  onClick={() => openingActionsControllerRef.current?.startJoke?.()}
                  style={{
                    padding: '8px 16px',
                    fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                    background: '#111827',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Joke
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
                  onClick={handleOpeningFillInFunStart}
                  style={{
                    padding: '8px 16px',
                    fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                    background: '#10b981',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: openingActionBusy ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    opacity: openingActionBusy ? 0.6 : 1
                  }}
                  disabled={openingActionBusy}
                >
                  Fill-in-Fun
                </button>
                <button
                  onClick={() => setShowGames(true)}
                  style={{
                    padding: '8px 16px',
                    fontSize: 'clamp(0.9rem, 1.8vw, 1rem)',
                    background: '#0ea5e9',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Games
                </button>
              </div>
            );
          })()}

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

            const renderInputRow = (placeholder, onEnterSend) => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <input
                  type="text"
                  value={openingActionInput}
                  onChange={(e) => setOpeningActionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      onEnterSend();
                    }
                  }}
                  placeholder={placeholder}
                  style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 8, padding: 10 }}
                  disabled={openingActionBusy}
                  autoFocus
                />
              </div>
            );

            if (!action) return null;

            if (action === 'ask') {
              return (
                <div style={{ padding: '0 12px' }}>
                  <div style={{ ...cardStyle, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="text"
                        value={openingActionInput}
                        onChange={(e) => setOpeningActionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (openingActionBusy) return;
                            handleOpeningAskSubmit();
                          }
                        }}
                        placeholder="Ask Ms. Sonoma..."
                        style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: '0.9rem' }}
                        autoFocus
                        disabled={openingActionBusy}
                      />
                      <button
                        type="button"
                        style={{ ...baseBtn, background: '#111827', color: '#fff', padding: '8px 12px', opacity: openingActionBusy ? 0.6 : 1, cursor: openingActionBusy ? 'not-allowed' : 'pointer' }}
                        onClick={handleOpeningAskSubmit}
                        disabled={openingActionBusy}
                      >
                        Send
                      </button>
                      <button type="button" style={{ ...baseBtn, background: '#10b981', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningAskDone}>
                        Done
                      </button>
                      <button type="button" style={{ ...baseBtn, background: '#ef4444', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningActionCancel}>
                        Cancel
                      </button>
                    </div>
                    {data.answer ? (
                      <div style={{ marginTop: 6, fontSize: '0.85rem', fontWeight: 600 }}>
                        Answer: <span style={{ fontWeight: 400 }}>{data.answer}</span>
                      </div>
                    ) : null}
                    {errorText}
                  </div>
                </div>
              );
            }

            if (action === 'riddle') {
              return (
                <div style={{ padding: '0 12px' }}>
                  <div style={{ ...cardStyle, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>{riddle.text || riddle.question || 'Riddle incoming...'}</div>
                        {stage === 'hint' && riddle.hint ? (
                          <div style={{ fontSize: '0.85rem', marginTop: 4, color: '#4b5563' }}>Hint: {riddle.hint}</div>
                        ) : null}
                        {stage === 'answer' && riddle.answer ? (
                          <div style={{ fontSize: '0.85rem', marginTop: 4, color: '#065f46', fontWeight: 700 }}>Answer: {riddle.answer}</div>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" style={{ ...baseBtn, background: '#b45309', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningRiddleHint}>
                          Hint
                        </button>
                        <button type="button" style={{ ...baseBtn, background: '#374151', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningRiddleReveal}>
                          Give me the answer
                        </button>
                        <button type="button" style={{ ...baseBtn, background: '#374151', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningActionCancel}>
                          Back
                        </button>
                      </div>
                    </div>
                    {errorText}
                  </div>
                </div>
              );
            }

            if (action === 'poem') {
              const stage = openingActionState.stage;
              const showSuggestions = data.showSuggestions;
              const poemText = data.poem;
              
              if (stage === 'awaiting-topic') {
                return (
                  <div style={{ padding: '0 12px' }}>
                    <div style={{ ...cardStyle, padding: '8px 12px' }}>
                      <div style={{ marginBottom: 6, fontSize: '0.85rem', color: '#6b7280' }}>What would you like the poem to be about?</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input
                          type="text"
                          value={openingActionInput}
                          onChange={(e) => setOpeningActionInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && openingActionInput.trim()) {
                              handleOpeningPoemSubmit();
                            }
                          }}
                          placeholder="e.g., dinosaurs, space, friendship..."
                          style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.9rem' }}
                          autoFocus
                        />
                        <button type="button" style={{ ...baseBtn, background: '#10b981', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningPoemSubmit} disabled={!openingActionInput.trim()}>
                          Send
                        </button>
                        {showSuggestions && (
                          <button type="button" style={{ ...baseBtn, background: '#f59e0b', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningPoemSuggestions}>
                            Suggestions
                          </button>
                        )}
                        <button type="button" style={{ ...baseBtn, background: '#ef4444', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningActionCancel}>
                          Back
                        </button>
                      </div>
                      {errorText}
                    </div>
                  </div>
                );
              }
              
              if (stage === 'reading' || stage === 'complete') {
                return (
                  <div style={{ padding: '0 12px' }}>
                    <div style={{ ...cardStyle, padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ flex: 1, whiteSpace: 'pre-wrap', color: '#111827', fontSize: '0.9rem' }}>{poemText || 'Generating poem...'}</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" style={{ ...baseBtn, background: '#10b981', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningPoemDone}>
                            Done
                          </button>
                          <button type="button" style={{ ...baseBtn, background: '#ef4444', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningActionCancel}>
                            Cancel
                          </button>
                        </div>
                      </div>
                      {errorText}
                    </div>
                  </div>
                );
              }
            }

            if (action === 'story') {
              const setupStep = data.setupStep;
              const stage = openingActionState.stage;
              
              // Get prompt text based on setup step
              let promptText = 'Tell me about a character to start.';
              if (setupStep === 'characters') {
                promptText = 'Who are the characters in the story?';
              } else if (setupStep === 'setting') {
                promptText = 'Where does the story take place?';
              } else if (setupStep === 'plot') {
                promptText = 'What happens in the story?';
              } else if (stage === 'awaiting-turn') {
                promptText = 'What happens next?';
              } else if (stage === 'complete' || stage === 'ended') {
                promptText = '';
              }
              
              return (
                <div style={{ padding: '0 12px' }}>
                  <div style={{ ...cardStyle, padding: '8px 12px' }}>
                    {transcript.length > 0 && (
                      <div style={{ maxHeight: 100, overflow: 'auto', border: '1px solid #e5e7eb', borderRadius: 8, padding: 6, background: '#fff', marginBottom: 6, fontSize: '0.85rem' }}>
                        {transcript.map((turn, idx) => (
                          <div key={idx} style={{ marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: turn.role === 'user' ? '#111827' : '#2563eb' }}>
                              {turn.role === 'user' ? 'You' : 'Ms. Sonoma'}:
                            </span>{' '}
                            <span style={{ color: '#111827' }}>{turn.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(stage === 'complete' || stage === 'ended') ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                        <button type="button" style={{ ...baseBtn, background: '#10b981', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningStoryFinish}>
                          Done
                        </button>
                        <button type="button" style={{ ...baseBtn, background: '#ef4444', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningActionCancel}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <>
                        {promptText && (
                          <div style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 6 }}>{promptText}</div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <input
                            type="text"
                            value={openingActionInput}
                            onChange={(e) => setOpeningActionInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && openingActionInput.trim()) {
                                handleOpeningStoryContinue();
                              }
                            }}
                            placeholder="Your answer..."
                            style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: '0.9rem' }}
                            autoFocus
                          />
                          <button type="button" style={{ ...baseBtn, background: '#2563eb', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningStoryContinue} disabled={!openingActionInput.trim()}>
                            Send
                          </button>
                          <button type="button" style={{ ...baseBtn, background: '#ef4444', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningActionCancel}>
                            Back
                          </button>
                        </div>
                      </>
                    )}
                    {errorText}
                  </div>
                </div>
              );
            }

            if (action === 'fill-in-fun') {
              const canSubmit = !openingActionBusy && !!currentWordType && !!openingActionInput.trim();
              return (
                <div style={{ padding: '0 12px' }}>
                  <div style={{ ...cardStyle, padding: '8px 12px' }}>
                    <div style={{ fontSize: '0.85rem', marginBottom: 4 }}>
                      {currentWordType ? (
                        <span style={{ fontWeight: 600 }}>Give me a {currentWordType.toLowerCase()}.</span>
                      ) : (
                        <span style={{ color: '#6b7280' }}>Gathering blanks...</span>
                      )}
                      {collectedWords.length > 0 && (
                        <span style={{ color: '#374151', marginLeft: 8 }}>
                          Words: {collectedWords.join(', ')}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="text"
                        value={openingActionInput}
                        onChange={(e) => setOpeningActionInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (!canSubmit) return;
                            handleOpeningFillInFunSubmit();
                          }
                        }}
                        placeholder={currentWordType ? `Type a ${currentWordType.toLowerCase()}` : 'Type a word'}
                        style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 10px', fontSize: '0.9rem' }}
                        autoFocus
                        disabled={openingActionBusy || !currentWordType}
                      />
                      <button
                        type="button"
                        style={{ ...baseBtn, background: '#2563eb', color: '#fff', padding: '8px 12px', opacity: canSubmit ? 1 : 0.6, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
                        onClick={handleOpeningFillInFunSubmit}
                        disabled={!canSubmit}
                      >
                        Submit
                      </button>
                      <button type="button" style={{ ...baseBtn, background: '#10b981', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningFillInFunDone}>
                        Done
                      </button>
                      <button type="button" style={{ ...baseBtn, background: '#ef4444', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningActionCancel}>
                        Cancel
                      </button>
                    </div>
                    {errorText}
                  </div>
                </div>
              );
            }

            if (action === 'joke') {
              const jokeText = data.joke || 'Sharing a quick joke...';
              return (
                <div style={{ padding: '0 12px' }}>
                  <div style={{ ...cardStyle, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ flex: 1, whiteSpace: 'pre-wrap', color: '#111827', fontSize: '0.9rem' }}>{jokeText}</div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" style={{ ...baseBtn, background: '#10b981', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningJokeDone}>
                          Done
                        </button>
                        <button type="button" style={{ ...baseBtn, background: '#ef4444', color: '#fff', padding: '8px 12px' }} onClick={handleOpeningActionCancel}>
                          Cancel
                        </button>
                      </div>
                    </div>
                    {errorText}
                  </div>
                </div>
              );
            }

            return null;
          })()}
          
          {/* Complete Lesson button during test review */}
          {currentPhase === 'test' && testState === 'reviewing' && testGrade && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: '10px 12px 8px'
            }}>
              <button
                type="button"
                onClick={skipTestReview}
                style={{
                  background: '#10b981',
                  color: '#fff',
                  borderRadius: 10,
                  padding: '12px 20px',
                  fontWeight: 800,
                  fontSize: 'clamp(1.05rem, 2.4vw, 1.25rem)',
                  border: 'none',
                  boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
                  cursor: 'pointer'
                }}
              >
                Complete Lesson
              </button>
            </div>
          )}
          
          {/* Phase-specific Begin buttons */}
          {(() => {
            const needBeginDiscussion = (currentPhase === 'idle') || (currentPhase === 'discussion' && (!discussionState || discussionState === 'idle'));
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
                {needBeginDiscussion && currentPhase === 'discussion' && (
                  <button 
                    type="button" 
                    style={{...ctaStyle, opacity: discussionState === 'loading' ? 0.7 : 1}} 
                    onClick={() => handleBeginPhase('discussion')}
                    disabled={discussionState === 'loading'}
                  >
                    {discussionState === 'loading' ? 'Loading...' : 'Begin Discussion'}
                  </button>
                )}
                {needBeginDiscussion && currentPhase === 'idle' && (
                  offerResume ? (
                    <>
                      <button
                        type="button"
                        style={{...ctaStyle, opacity: (audioReady && snapshotLoaded) ? 1 : 0.5}}
                        onClick={() => handleStartSessionClick()}
                        disabled={!(audioReady && snapshotLoaded) || startSessionLoading}
                      >
                        {startSessionLoading ? 'Loading...' : 'Resume'}
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
                          resetTranscriptState();
                          try { timerServiceRef.current?.reset?.(); } catch {}
                          // Don't auto-start - let user click Begin button
                          setCurrentPhase('idle');
                          setDiscussionState('idle');
                        }}
                        disabled={!(audioReady && snapshotLoaded) || startSessionLoading}
                      >
                        Start Over
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      style={{...ctaStyle, opacity: (audioReady && snapshotLoaded) ? 1 : 0.5}}
                      onClick={() => handleStartSessionClick()}
                      disabled={!(audioReady && snapshotLoaded) || startSessionLoading}
                    >
                      {(audioReady && snapshotLoaded)
                        ? (startSessionLoading ? 'Loading...' : 'Begin')
                        : (!snapshotLoaded ? 'Loading session...' : 'Preparing audio...')
                      }
                    </button>
                  )
                )}
                {needBeginDiscussion && currentPhase === 'idle' && startSessionError ? (
                  <div style={{
                    width: '100%',
                    maxWidth: 520,
                    marginTop: 10,
                    marginLeft: 'auto',
                    marginRight: 'auto',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: '1px solid rgba(239,68,68,0.35)',
                    background: 'rgba(239,68,68,0.10)',
                    color: '#7f1d1d',
                    fontSize: 13,
                    fontWeight: 650,
                    textAlign: 'center'
                  }}>
                    {startSessionError}
                  </div>
                ) : null}
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

            if (!qaPhase || !awaitingAnswer || openingActionActive) return null;

            const q =
              qaPhase === 'comprehension' ? currentComprehensionQuestion :
              qaPhase === 'exercise' ? currentExerciseQuestion :
              qaPhase === 'worksheet' ? currentWorksheetQuestion :
              currentTestQuestion;

            const isMc = isMultipleChoice(q);
            const isTf = !isMc && isTrueFalse(q);
            const isFill =
              (qaPhase === 'worksheet' && !isMc && !isTf) ||
              (qaPhase === 'test' && ((q?.type === 'fill' || q?.type === 'fib' || q?.sourceType === 'fib') || (!isMc && !isTf))) ||
              ((qaPhase === 'comprehension' || qaPhase === 'exercise') && !isMc && !isTf);

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

            const isSubmitting = (
              (qaPhase === 'comprehension' && comprehensionSubmitting) ||
              (qaPhase === 'exercise' && exerciseSubmitting) ||
              (qaPhase === 'worksheet' && worksheetSubmitting) ||
              (qaPhase === 'test' && testSubmitting)
            );

            const canSubmit = !isSubmitting && !!String(currentValue || '').trim();

            const quickContainerStyle = {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: 8,
              paddingLeft: isMobileLandscape ? 12 : '4%',
              paddingRight: isMobileLandscape ? 12 : '4%',
              marginBottom: 6
            };

            const quickButtonStyle = {
              background: '#1f2937',
              color: '#fff',
              borderRadius: 8,
              padding: '8px 12px',
              minHeight: 40,
              minWidth: 56,
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(0,0,0,0.18)'
            };

            const options = getOpts();

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 0' }}>
                {(isMc || isTf) && (
                  <div style={quickContainerStyle}>
                    {isTf && (
                      <>
                        {['True', 'False'].map((val) => (
                          <button
                            key={val}
                            type="button"
                            style={quickButtonStyle}
                            onClick={() => {
                              setValue(val);
                              appendTranscriptLine({ text: val, role: 'user' });
                              if (qaPhase === 'comprehension') {
                                comprehensionPhaseRef.current?.submitAnswer(val);
                                setComprehensionAnswer('');
                              } else if (qaPhase === 'exercise') {
                                exercisePhaseRef.current?.submitAnswer(val);
                                setSelectedExerciseAnswer('');
                              } else if (qaPhase === 'worksheet') {
                                worksheetPhaseRef.current?.submitAnswer(val);
                                setWorksheetAnswer('');
                              } else if (qaPhase === 'test') {
                                testPhaseRef.current?.submitAnswer(val);
                                setTestAnswer('');
                              }
                            }}
                          >
                            {val}
                          </button>
                        ))}
                      </>
                    )}

                    {isMc && (
                      (() => {
                        const count = Math.min(4, Math.max(2, options.length || 4));
                        const letters = ['A', 'B', 'C', 'D'].slice(0, count);
                        return letters.map((letter, idx) => {
                          const val = options[idx]?.value || letter;
                          return (
                            <button
                              key={letter}
                              type="button"
                              style={quickButtonStyle}
                              onClick={() => {
                                setValue(val);
                                appendTranscriptLine({ text: val, role: 'user' });
                                if (qaPhase === 'comprehension') {
                                  comprehensionPhaseRef.current?.submitAnswer(val);
                                  setComprehensionAnswer('');
                                } else if (qaPhase === 'exercise') {
                                  exercisePhaseRef.current?.submitAnswer(val);
                                  setSelectedExerciseAnswer('');
                                } else if (qaPhase === 'worksheet') {
                                  worksheetPhaseRef.current?.submitAnswer(val);
                                  setWorksheetAnswer('');
                                } else if (qaPhase === 'test') {
                                  testPhaseRef.current?.submitAnswer(val);
                                  setTestAnswer('');
                                }
                              }}
                            >
                              {letter}
                            </button>
                          );
                        });
                      })()
                    )}
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
                      ref={answerInputRef}
                      autoFocus
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
                        cursor: canSubmit ? 'pointer' : 'not-allowed',
                        minHeight: 40,
                        opacity: isSubmitting ? 0.7 : 1
                      }}
                    >
                      {isSubmitting ? 'Loading...' : 'Submit'}
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {showVisualAids && Array.isArray(visualAidsData) && visualAidsData.length > 0 && (
        <SessionVisualAidsCarousel
          visualAids={visualAidsData}
          onClose={() => setShowVisualAids(false)}
          onExplain={handleExplainVisualAid}
          videoRef={videoRef}
          isSpeaking={engineState === 'playing'}
        />
      )}
      
      {showGames && (() => {
        const phaseName = getCurrentPhaseName();
        const timerType = phaseName ? currentTimerMode[phaseName] : null;
        const timerNode = (phaseTimers && phaseName && timerType === 'play') ? (
          <SessionTimer
            key={`games-timer-${phaseName}-${timerType}-${timerRefreshKey}`}
            phase={phaseName}
            timerType={timerType}
            totalMinutes={getCurrentPhaseTimerDuration(phaseName, timerType)}
            goldenKeyBonus={timerType === 'play' && goldenKeysEnabledRef.current !== false ? goldenKeyBonus : 0}
            isPaused={timerPaused}
            lessonKey={lessonKey}
            lessonProgress={calculateLessonProgress()}
          />
        ) : null;

        return (
          <GamesOverlay
            onClose={() => setShowGames(false)}
            playTimer={timerNode}
          />
        );
      })()}
      
      {/* Play Time Expired Overlay - V1 parity: full-screen overlay outside main container */}
      {showPlayTimeExpired && playExpiredPhase && (
        <PlayTimeExpiredOverlay
          isOpen={showPlayTimeExpired}
          phase={playExpiredPhase}
          lessonKey={lessonKey}
          isPaused={timerPaused}
          muted={isMuted}
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
          goldenKeysEnabled={goldenKeysEnabledRef.current !== false}
          goldenKeyBonus={goldenKeysEnabledRef.current !== false ? goldenKeyBonus : 0}
          isPaused={timerPaused}
          onUpdateTime={(seconds) => {
            const phaseName = getCurrentPhaseName();
            const mode = phaseName ? (currentTimerMode[phaseName] || 'work') : 'work';
            try {
              timerServiceRef.current?.setPhaseElapsedSeconds?.(phaseName, mode, seconds);
            } catch (err) {
              console.warn('[SessionPageV2] Timer adjust failed:', err);
            }
            // Force timer refresh to pick up new elapsed time from the engine
            setTimerRefreshKey(k => k + 1);
            persistTimerStateNow('timer-adjust');
          }}
          onTogglePause={handleTimerPauseToggle}
          hasGoldenKey={goldenKeysEnabledRef.current !== false && hasGoldenKey}
          isGoldenKeySuspended={isGoldenKeySuspended}
          onApplyGoldenKey={handleApplyGoldenKeyForLesson}
          onSuspendGoldenKey={handleSuspendGoldenKey}
          onUnsuspendGoldenKey={handleUnsuspendGoldenKey}
        />
      )}

      {showTakeoverDialog && (
        <SessionTakeoverDialog
          existingSession={conflictingSession}
          onTakeover={handleSessionTakeover}
          onCancel={handleCancelTakeover}
        />
      )}
    </>
  );
}
