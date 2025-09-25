"use client";

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react";
import { ensurePinAllowed } from "../lib/pinGate";
import { useRouter, useSearchParams } from "next/navigation";
import { jsPDF } from "jspdf";
import { loadRuntimeVariables } from "../lib/runtimeVariables";
import { getSupabaseClient } from "../lib/supabaseClient";
import { getLearner } from "@/app/facilitator/learners/clientApi";
import { getStoredAssessments, saveAssessments, clearAssessments } from './assessment/assessmentStore';
import { upsertMedal } from '@/app/lib/medalsClient';

export default function SessionPage(){
  return (
    <Suspense fallback={null}>
      <SessionPageInner />
    </Suspense>
  );
}

const CLEAN_SPEECH_INSTRUCTION =
  "Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, ASCII art, bullet lines, or other symbols that would be awkward to read aloud.";

// Global guardrails for Ms. Sonoma (system-side, not spoken):
const GUARD_INSTRUCTION = [
  "You are Ms. Sonoma. Teach the defined lesson. If vocab is provided, use it during teaching only.",
  "Do not mention or reference the words 'exercise', 'worksheet', 'test', 'exam', 'quiz', or 'answer key' in your spoken responses during discussion, teaching, or comprehension phases.",
  "Do not switch or expand to any other topic; politely steer back to the defined lesson when needed.",
  "Integrate any teaching notes naturally; do not read them verbatim or announce them."
].join(" ");

// (Global judging guard removed; per-question judging specs only.)

// Teaching style guide specifically for young learners (ages 5–7).
const KID_FRIENDLY_STYLE = [
  "Kid-friendly style rules:",
  "Use simple everyday words a 5–7 year old can understand.",
  "Keep sentences short (about 6–12 words).",
  "Avoid big words and jargon. If you must use one, add a quick kid-friendly meaning in parentheses.",
  "Use a warm, friendly tone with everyday examples.",
  "Speak directly to the learner using 'you' and 'we'.",
  "One idea per sentence; do not pack many steps into one sentence."
].join(" ");

/**
 * Compose the system message sent to Ms. Sonoma.
 * Priority: use teachingNotes as the primary scope when present, otherwise fall back to lessonTitle.
 * Vocab may be either an array of strings or an array of objects { term, definition }.
 * The generated message instructs Ms. Sonoma to use the provided scope text and vocab and to
 * give kid-friendly one-sentence definitions for each vocab term during the teaching
 * segment only (not during comprehension). It does not mention files or external sources.
 */
function buildSystemMessage({ lessonTitle = "", teachingNotes = "", vocab = [], gatePhrase = "" } = {}) {
  const scopeSource = teachingNotes && teachingNotes.trim() ? "teachingNotes" : "lessonTitle";
  const scopeText = scopeSource === "teachingNotes" ? teachingNotes.trim() : lessonTitle.trim();

  // Prepare vocab content. Accept [{term,definition}, ...] or ["word", ...].
  let vocabContent;
  if (Array.isArray(vocab) && vocab.length > 0) {
    const hasDefs = vocab.every(v => v && typeof v === "object" && (v.term || v.word) && v.definition);
    if (hasDefs) {
      vocabContent = "Vocab (each term with provided definition):\n" + vocab.map(v => {
        const term = v.term || v.word;
        return `- ${term} — ${v.definition}`;
      }).join("\n");
      vocabContent += "\nInstruction: During the TEACHING segment only, give each provided definition in a single short kid-friendly sentence and use the term naturally in examples. Do NOT repeat these definitions during the comprehension phase.";
    } else {
      const list = vocab.map(v => (typeof v === "string" ? v : (v.term || v.word))).join(", ");
      vocabContent = `Vocab list: ${list}.\nInstruction: For each term above, during the TEACHING segment only, give a single short kid-friendly definition (one sentence) and then use the term in your worked examples. Do NOT repeat the definitions during comprehension.`;
    }
  } else {
    // No vocab provided: omit vocab instructions entirely.
    vocabContent = "";
  }

  // Gate phrase: only include when actually provided; do not reference variable names.
  const gatePhraseLine = gatePhrase
    ? `Gate phrase: Say this phrase verbatim once at the appropriate moment: "${gatePhrase}"`
    : "";

  // Neutral normalization note may be included globally (non-grading, general guidance)
  const NORMALIZATION_NOTE = "Normalize by lowercasing, trimming, collapsing spaces, removing punctuation, and mapping number words zero–twenty to digits.";

  const parts = [
    CLEAN_SPEECH_INSTRUCTION,
    "You are Ms. Sonoma. Follow the defined lesson. Include provided vocab only during the teaching segment.",
    `Lesson background (do not read aloud): ${scopeText}`,
    vocabContent,
    GUARD_INSTRUCTION,
    KID_FRIENDLY_STYLE,
    NORMALIZATION_NOTE,
    // compact gate rule
    gatePhraseLine,
    // brief reminder of teaching structure and where vocab definitions belong
    "Teaching structure: Intro → Examples → Wrap. During the teaching reply include one-sentence child-friendly definitions for each vocab term and use the terms in examples. End the teaching wrap only with exactly: \"Would you like me to go over that again?\""
  ];

  return parts.filter(Boolean).join("\n\n");
}

// Exact phrase Ms. Sonoma must say (when learner declines a repeat) to advance to comprehension.
const COMPREHENSION_CUE_PHRASE = "Great. Let's move on to comprehension.";
// Targets are loaded dynamically per-user.
let COMPREHENSION_TARGET = 3;
let EXERCISE_TARGET = 5;
let WORKSHEET_TARGET = 15;
let TEST_TARGET = 10;

// Dynamically load per-user targets at runtime (recomputed on each call)
async function ensureRuntimeTargets(forceReload = false) {
  try {
    // Always reload from runtime variables first
    const vars = await loadRuntimeVariables();
    const t = vars?.targets || {};
    // Support both 'comprehension' and legacy 'discussion'
    COMPREHENSION_TARGET = (t.comprehension ?? t.discussion ?? 3);
    EXERCISE_TARGET = t.exercise ?? 5;
    WORKSHEET_TARGET = t.worksheet ?? 15;
    TEST_TARGET = t.test ?? 10;

    // Get current learner info (fresh each time)
    const learnerId = typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null;
    const learnerName = typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null;
    
    if (learnerId && learnerId !== 'demo') {
      try {
        // Always fetch fresh learner data
        const learner = await getLearner(learnerId);
        if (learner) {
          const n = (v) => (v == null ? undefined : Number(v));
          // Prefer explicit top-level fields, else fall back to nested targets object if present
          COMPREHENSION_TARGET = n(learner.comprehension ?? learner.targets?.comprehension) ?? COMPREHENSION_TARGET;
          EXERCISE_TARGET = n(learner.exercise ?? learner.targets?.exercise) ?? EXERCISE_TARGET;
          WORKSHEET_TARGET = n(learner.worksheet ?? learner.targets?.worksheet) ?? WORKSHEET_TARGET;
          TEST_TARGET = n(learner.test ?? learner.targets?.test) ?? TEST_TARGET;
          
          console.log(`[Session] Loaded targets for learner ${learner.name}:`, {
            comprehension: COMPREHENSION_TARGET,
            exercise: EXERCISE_TARGET,
            worksheet: WORKSHEET_TARGET,
            test: TEST_TARGET
          });
        }
      } catch (error) {
        console.warn('[Session] Failed to load learner data:', error);
      }
    }
    // Fallback: if id is not usable (demo/missing), try to match by learner_name in local storage list
    // Use the first match if any learner with that name exists
    if ((!learnerId || learnerId === 'demo') && learnerName && learnerName !== 'Demo Learner') {
      try {
        const raw = typeof window !== 'undefined' ? localStorage.getItem('facilitator_learners') : null;
        if (raw) {
          try {
            const list = JSON.parse(raw);
            if (Array.isArray(list)) {
              const match = list.find(l => l && (l.name === learnerName || l.full_name === learnerName));
              if (match) {
                const n = (v) => (v == null ? undefined : Number(v));
                COMPREHENSION_TARGET = n(match.comprehension ?? match.targets?.comprehension) ?? COMPREHENSION_TARGET;
                EXERCISE_TARGET = n(match.exercise ?? match.targets?.exercise) ?? EXERCISE_TARGET;
                WORKSHEET_TARGET = n(match.worksheet ?? match.targets?.worksheet) ?? WORKSHEET_TARGET;
                TEST_TARGET = n(match.test ?? match.targets?.test) ?? TEST_TARGET;
              }
            }
          } catch {/* ignore parse errors */}
        }
      } catch {/* ignore fallback errors */}
    }

    // LocalStorage overrides (user-adjustable targets) – learner-specific first
    try {
      const currentLearnerId = (learnerId && learnerId !== 'demo') ? learnerId : null;
      if (currentLearnerId) {
        const lc = Number(localStorage.getItem(`target_comprehension_${currentLearnerId}`));
        const le = Number(localStorage.getItem(`target_exercise_${currentLearnerId}`));
        const lw = Number(localStorage.getItem(`target_worksheet_${currentLearnerId}`));
        const lt = Number(localStorage.getItem(`target_test_${currentLearnerId}`));
        if (!Number.isNaN(lc) && lc > 0) COMPREHENSION_TARGET = lc;
        if (!Number.isNaN(le) && le > 0) EXERCISE_TARGET = le;
        if (!Number.isNaN(lw) && lw > 0) WORKSHEET_TARGET = lw;
        if (!Number.isNaN(lt) && lt > 0) TEST_TARGET = lt;
      } else {
        // Global overrides for demo / no learner selected
        const lc = Number(localStorage.getItem('target_comprehension'));
        const le = Number(localStorage.getItem('target_exercise'));
        const lw = Number(localStorage.getItem('target_worksheet'));
        const lt = Number(localStorage.getItem('target_test'));
        if (!Number.isNaN(lc) && lc > 0) COMPREHENSION_TARGET = lc;
        if (!Number.isNaN(le) && le > 0) EXERCISE_TARGET = le;
        if (!Number.isNaN(lw) && lw > 0) WORKSHEET_TARGET = lw;
        if (!Number.isNaN(lt) && lt > 0) TEST_TARGET = lt;
      }
    } catch {/* ignore override read errors */}
  } catch (error) {
    console.error('[Session] Error loading runtime targets:', error);
  }
}
// Manifest removed: lessons now resolved directly by filename (drag-and-drop JSON in /public/lessons/{subject}).
// Backward compatibility map for legacy lesson ids -> new filenames if needed.
const LEGACY_LESSON_MAP = {
  // Back-compat mapping from older lesson ids to concrete filenames
  'lesson.beginner.1': 'Multiply_1_Digit_Numbers_Beginner.json',
  'lesson.intermediate.1': 'Multiply_2_Digit_Numbers_Intermediate.json',
  'lesson.advanced.1': 'Multiply_3_Digit_Numbers_Advanced.json',
};

// Order of major phases shown above the video timeline
const timelinePhases = ["discussion", "comprehension", "exercise", "worksheet", "test"];
const phaseLabels = {
  discussion: "Discussion",
  comprehension: "Comp",
  exercise: "Exercise",
  worksheet: "Worksheet",
  test: "Test",
};

const discussionSteps = [
  {
    key: "greeting",
    instruction: "Greeting: Say the learner's name with a hello phrase and name the lesson. Do not ask any questions and do not invite a response. Keep it to 1–2 sentences max.",
    next: "encouragement",
    label: "Next: Encouragement",
  },
  {
    key: "encouragement",
    instruction: "Encourage: Say a positive and reassuring statement. Do not ask any questions and do not invite a response. Keep it to a single sentence.",
    next: "joke",
    label: "Next: Joke",
  },
  {
    key: "joke",
    instruction: "Joke: Begin with either 'Wanna hear a joke?' or 'Let's start with a joke.' Then tell one short, kid-friendly joke related to the subject. Keep total to 1–2 sentences.",
    next: "silly-question",
    label: "Next: Silly Question",
  },
  {
    key: "silly-question",
    instruction: "Silly question: Ask the learner a playful question before teaching. Only ask the question (one sentence) and end with a question mark. Do not add any sentences or commentary after the question.",
    next: "awaiting-learner",
    label: "Wait for learner reply",
  },
];

function getTeachingSteps(lessonTitle = "the lesson") {
  return [
    {
      key: "teaching-intro",
      instruction:
        `Teaching Part 1/3: This lesson is strictly "${lessonTitle}". Introduce today's lesson topic using the Session JSON's lessonTitle and preview what the learner will accomplish. Explain only that specific topic; do not give general study advice or other operations. Include 1–2 short numeric examples as part of the explanation that you fully compute yourself. Keep it to about three sentences; do not ask if they want it repeated yet. Do not mention the worksheet or test. ${KID_FRIENDLY_STYLE}`,
      next: "teaching-example",
      label: "Next: Examples",
    },
    {
      key: "teaching-example",
      instruction:
        `Teaching Part 2/3: This lesson is strictly "${lessonTitle}". Walk through one or two worked examples step by step strictly within the lessonTitle scope (from Session JSON). You complete the examples yourself—do not ask the learner to solve. Keep the explanation under four sentences and stay focused on the concrete steps for this lesson only. Do not mention the worksheet or test. ${KID_FRIENDLY_STYLE}`,
      next: "teaching-wrap",
      label: "Next: Wrap Up",
    },
    {
      key: "teaching-wrap",
      instruction:
        `Teaching Part 3/3: This lesson is strictly "${lessonTitle}". Summarize the exact steps for the specific lessonTitle (from Session JSON), remind them about any simple tools or notes, and finish by asking exactly "Would you like me to go over that again?" Do not ask them to solve anything. Do not mention the worksheet or test. ${KID_FRIENDLY_STYLE}`,
      next: "awaiting-gate",
      label: "Wait for learner answer",
    },
  ];
}

function resolveLessonInfo(subject, lesson) {
  let base = lesson || "";
  // legacy mapping
  if (LEGACY_LESSON_MAP[base]) base = LEGACY_LESSON_MAP[base];
  // ensure filename ends with .json
  let file = base.endsWith('.json') ? base : `${base}.json`;
  return { title: lesson || "Lesson", file };
}

function splitIntoSentences(text) {
  if (!text) {
    return [];
  }
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])/)
    .map((part) => part.trim())
    .filter(Boolean);
  return sentences.length ? sentences : [text.trim()];
}

function countWords(text) {
  if (!text) {
    return 0;
  }
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function SessionPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  
  const subjectParam = params.get("subject") || "math";
  let difficultyParam = params.get("difficulty") || "beginner";
  // Backward compatibility: rename 'normal' difficulty to 'intermediate'
  if (difficultyParam.toLowerCase() === 'normal') difficultyParam = 'intermediate';
  // Default to a lesson file that exists in public/lessons/math to avoid 404s on first load
  const lessonParam = params.get("lesson") || "3rd_Multiplication_Facts_to_10x10_Beginner.json";

  // Per-question judging spec (no global grading logic). The caller decides the mode per item.
  // mode: 'exact' (compare against an explicit acceptable set) or 'short-answer' (keywords + min)
  const buildPerQuestionJudgingSpec = useCallback(({
    mode = 'exact',
    learnerAnswer = '',
    expectedAnswer = '',
    acceptableAnswers = [],
    keywords = [],
    minKeywords = null,
  }) => {
    const data = [
      `EXPECTED: ${expectedAnswer}`,
      (Array.isArray(acceptableAnswers) && acceptableAnswers.length) ? `ACCEPTABLE: [${acceptableAnswers.join(', ')}]` : null,
      (mode === 'short-answer' && Array.isArray(keywords) && keywords.length) ? `KEYWORDS: [${keywords.join(', ')}]` : null,
      (mode === 'short-answer' && Number.isInteger(minKeywords) && minKeywords > 0) ? `MIN: ${minKeywords}` : null,
      `LEARNER_ANSWER: "${learnerAnswer}"`
    ].filter(Boolean).join(' ');

    const normalize = '- Normalize by lowercasing, trimming, collapsing spaces, removing punctuation, and mapping number words zero–twenty to digits.';
    const exactRule = '- Mark CORRECT if and only if the normalized learner answer equals any normalized item in ACCEPTABLE.';
    const shortRule = '- For this short answer item, mark CORRECT when the learner answer contains at least MIN distinct keywords as whole words (case-insensitive). Do not accept answers that are not covered by that rule.';
    const modeRule = mode === 'short-answer' ? shortRule : exactRule;
    const output = [
      'OUTPUT:',
      '- Start with exactly "Correct!" OR "Not quite right."',
      '- If incorrect: give ONE short non-revealing hint. Do NOT reveal the answer. '
    ].join(' ');
    return `${data} ${normalize} ${modeRule} ${output}`;
  }, []);
  
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
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [phase, setPhase] = useState("discussion");
  const [subPhase, setSubPhase] = useState("greeting");
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
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
  // Mirror for immediate, synchronous reads between renders to avoid stale state in rapid turns
  const worksheetIndexRef = useRef(0);
  const [generatedTest, setGeneratedTest] = useState(null);
  // Ephemeral (reset on refresh) pre-generated sets for comprehension and exercise
  const [generatedComprehension, setGeneratedComprehension] = useState(null);
  const [generatedExercise, setGeneratedExercise] = useState(null);
  const [currentCompIndex, setCurrentCompIndex] = useState(0);
  const [currentExIndex, setCurrentExIndex] = useState(0);
  // Dynamic max height for video in mobile landscape (computed from viewport)
  const [videoMaxHeight, setVideoMaxHeight] = useState(null);
  useEffect(() => {
    const calcVideoHeight = () => {
      try {
        const w = window.innerWidth; const h = window.innerHeight;
        const isLandscape = w > h; const isMobile = Math.min(w, h) <= 820;
        if (!(isLandscape && isMobile)) { setVideoMaxHeight(null); return; }
        // Estimate header + timeline + padding footprint (compact header 52 + ~72 timeline/padding)
        const reserved = 52 + 72;
        const usable = Math.max(180, h - reserved);
        // Let video occupy at most 48% of viewport height, but not exceed usable
        const target = Math.min(usable, Math.round(h * 0.48));
        setVideoMaxHeight(target);
      } catch { setVideoMaxHeight(null); }
    };
    calcVideoHeight();
    window.addEventListener('resize', calcVideoHeight);
    window.addEventListener('orientationchange', calcVideoHeight);
    return () => { window.removeEventListener('resize', calcVideoHeight); window.removeEventListener('orientationchange', calcVideoHeight); };
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
  const [currentWorksheetIndex, setCurrentWorksheetIndex] = useState(0);
  // Sample-driven question pools (for comprehension & exercise)
  const [compPool, setCompPool] = useState([]); // remaining shuffled problems for comprehension
  const [exercisePool, setExercisePool] = useState([]); // remaining shuffled problems for exercise
  const [currentCompProblem, setCurrentCompProblem] = useState(null); // problem currently asked in comprehension awaiting learner answer
  const [currentExerciseProblem, setCurrentExerciseProblem] = useState(null); // problem currently asked in exercise awaiting learner answer

  // When starting comprehension, keep input disabled until Ms. Sonoma finishes asking the first question
  useEffect(() => {
    if (phase !== 'comprehension') return;
    // During comprehension-start, keep input locked until the first question has been asked (currentCompProblem set)
    // and Ms. Sonoma has finished speaking it (isSpeaking false).
    const awaitingFirst = (subPhase === 'comprehension-start' && !currentCompProblem);
    if (awaitingFirst) {
      if (canSend) setCanSend(false);
      return;
    }
    if (subPhase === 'comprehension-start' && currentCompProblem && !isSpeaking) {
      if (!canSend) setCanSend(true);
    }
  }, [phase, subPhase, currentCompProblem, isSpeaking, canSend]);
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
  // UI base width used for simple maxWidth centering (no scaling of the container)
  // Global max width for primary session content band (reduced from 1000 to 900 per request)
  const baseWidth = 900;
  // Side-by-side layout refs (mobile landscape) for equal height sync
  const videoColRef = useRef(null);
  const captionColRef = useRef(null);
  const [sideBySideHeight, setSideBySideHeight] = useState(null);
  // Mobile landscape detector: small viewport height with landscape orientation (declared before any effect uses it)
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
        if (Number.isFinite(h) && h > 0) setSideBySideHeight(h);
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
  }, [isMobileLandscape]);
  useEffect(() => {
    const check = () => {
      try {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const isLandscape = w > h;
        // New rule: side-by-side only below 700px smallest dimension
        const withinSideBySideRange = Math.min(w, h) < 700;
        setIsMobileLandscape(withinSideBySideRange && isLandscape);
      } catch {}
    };
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => { window.removeEventListener('resize', check); window.removeEventListener('orientationchange', check); };
  }, []);

  // Measure to size stacked caption panel. Rule: if viewport height < 700px, match video height exactly; otherwise square (height ≈ width).
  useEffect(() => {
    if (isMobileLandscape) { setStackedCaptionHeight(null); return; }
    const measureTarget = videoColRef.current; // video defines canonical height
    const widthTarget = captionColRef.current || videoColRef.current;
    if (!measureTarget || !widthTarget) return;
    const measure = () => {
      try {
        const vRect = measureTarget.getBoundingClientRect();
        const wRect = widthTarget.getBoundingClientRect();
        const videoH = vRect.height;
        const w = wRect.width;
        const vh = window.innerHeight;
        if (vh < 700) {
          if (Number.isFinite(videoH) && videoH > 0) {
            setStackedCaptionHeight(Math.round(videoH));
          }
        } else {
          if (Number.isFinite(w) && w > 0) {
            const vhCap = vh * 0.85;
            const target = Math.max(260, Math.min(Math.round(w), Math.round(vhCap)));
            setStackedCaptionHeight(target);
          }
        }
      } catch {}
    };
    measure();
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => measure());
      try { ro.observe(measureTarget); } catch {}
      if (widthTarget && widthTarget !== measureTarget) { try { ro.observe(widthTarget); } catch {} }
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
  }, [isMobileLandscape]);

  // (moved lower originally) placeholder: title dispatch effect defined after manifestInfo/effectiveLessonTitle
  // Fixed scale factor to avoid any auto-shrinking behavior
  const snappedScale = 1;
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
  // Media & caption refs (restored after refactor removal)
  const videoRef = useRef(null); // controls lesson video playback synchrony with TTS
  const audioRef = useRef(null); // active Audio element for synthesized speech
  const captionTimersRef = useRef([]); // active timers advancing captionIndex
  const captionSentencesRef = useRef([]); // accumulated caption sentences for full transcript persistence
  // Track current caption batch boundaries for accurate resume scheduling
  const captionBatchStartRef = useRef(0);
  const captionBatchEndRef = useRef(0);
  // Playback controls
  const [muted, setMuted] = useState(false);
  // Mirror latest mute state for async callbacks (prevents stale closures)
  const mutedRef = useRef(false);
  const [userPaused, setUserPaused] = useState(false); // user-level pause covering video + TTS
  // iOS/Safari audio unlock (when autoplay is blocked)
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const lastAudioBase64Ref = useRef(null);
  const lastSentencesRef = useRef([]);
  const lastStartIndexRef = useRef(0);
  // Test phase state
  const [testActiveIndex, setTestActiveIndex] = useState(0); // index of current test question during active test taking
  const [testUserAnswers, setTestUserAnswers] = useState([]); // collected user answers
  const [testReviewIndex, setTestReviewIndex] = useState(0); // index during review/grading cycle
  const [testReviewing, setTestReviewing] = useState(false); // whether Ms. Sonoma is reviewing answers
  const [skipPendingLessonLoad, setSkipPendingLessonLoad] = useState(false); // flag when skip pressed before lesson data ready
  // Test review correctness tracking (restored)
  const [usedTestCuePhrases, setUsedTestCuePhrases] = useState([]); // unique cue phrases detected so far in test review
  const [testCorrectCount, setTestCorrectCount] = useState(0); // authoritative correct count derived from cue phrases
  const [testFinalPercent, setTestFinalPercent] = useState(null); // final percent shown after grading until lesson completion
  // Model-validated correctness tracking during test review
  // Concise bounded-leniency guidance (applies only to open-ended judging, not TF/MC)
  const JUDGING_LENIENCY_OPEN_ENDED = 'Judge open-ended answers with bounded leniency: ignore fillers and politeness, be case-insensitive, ignore punctuation, and collapse spaces. Map number words zero–twenty to digits and allow simple forms like "one hundred twenty". Accept simple plural/tense changes in acceptable phrases but require all core keywords from an acceptable variant. If multiple different numbers appear, treat as incorrect. Do not apply this leniency to true/false or multiple choice.';

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
  const expectedAnyList = (q) => Array.isArray(q?.expectedAny) ? q.expectedAny.filter(Boolean) : null;

  // Encouragement snippets used around progress/count cues in comprehension, exercise, worksheet.
  // Keep short, single sentences (no trailing spaces). Safe for insertion before or after count cue.
  const ENCOURAGEMENT_SNIPPETS = useMemo(() => [
    'Great focus',
    'Nice thinking',
    'You are doing great',
    'Keep it up',
    'Strong effort',
    'Brain power engaged',
    'Love that persistence',
  'Flex that brain',
    'Terrific progress',
    'Staying sharp'
  ], []);

  // Helper to build a randomized pattern specification we inject into model instructions.
  // Returns an object { patternHint, pick } where pick(encouragement, progressPhrase) -> combined string
  // patternHint is inserted into instructions so model knows allowed positions.
  const buildCountCuePattern = useCallback((progressPhrase) => {
    // Decide order on the client so UX sees variety deterministically per turn.
    const encouragement = ENCOURAGEMENT_SNIPPETS[Math.floor(Math.random() * ENCOURAGEMENT_SNIPPETS.length)];
    const placeBefore = Math.random() < 0.5;
    const patternHint = placeBefore
      ? `Say a brief encouragement (e.g., "${encouragement}.") immediately BEFORE you say: "${progressPhrase}"`
      : `Say the progress phrase "${progressPhrase}" then immediately AFTER it one brief encouragement such as: "${encouragement}."`;
    const pick = () => placeBefore
      ? `${encouragement}. ${progressPhrase}`
      : `${progressPhrase} ${encouragement}.`;
    return { encouragement, placeBefore, patternHint, pick };
  }, [ENCOURAGEMENT_SNIPPETS]);

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
  const teachingSteps = useMemo(() => getTeachingSteps(effectiveLessonTitle), [effectiveLessonTitle]);
  // Dispatch lesson title to header (mobile landscape) now that manifestInfo/effectiveLessonTitle are initialized
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const pageTitle = ((lessonData && (lessonData.title || lessonData.lessonTitle)) || manifestInfo.title || effectiveLessonTitle || '').toString();
      const detail = isMobileLandscape ? pageTitle : '';
      window.dispatchEvent(new CustomEvent('ms:session:title', { detail }));
    } catch {}
  }, [isMobileLandscape, lessonData, manifestInfo.title, effectiveLessonTitle]);
  // Shared constants
  // Import centrally defined worksheet progress cue variants
  // Note: keep relative path stable if this file moves
  const { WORKSHEET_CUE_VARIANTS } = require('./constants/worksheetCues.js');

  const subjectSegment = (subjectParam || "math").toLowerCase();
  // Preserve original casing of the lesson filename; only normalize subject segment
  const lessonFilename = manifestInfo.file || "";
  const lessonFilePath = lessonFilename
    ? `/lessons/${encodeURIComponent(subjectSegment)}/${encodeURIComponent(lessonFilename)}`
    : "";

  // Build a normalized QA pool for comprehension/exercise
  // - Math: use a broad pool that includes Samples + category groups (TF/MC/FIB/Short Answer)
  // - Others: prefer Samples; fall back to TF/MC/FIB only (no Short Answer in comprehension/exercise)
  // - Normalize fields so both 'answer' and 'expected' exist on each item, and coerce single-object fields to arrays
  const buildQAPool = useCallback(() => {
    const arrify = (val) => (Array.isArray(val) ? val : (val ? [val] : []));
    const ensureAE = (qIn) => {
      const q = { ...qIn };
      // If both expected and answer are missing but expectedAny exists, seed them from the first acceptable
      const any = Array.isArray(q.expectedAny) ? q.expectedAny.filter(Boolean) : [];
      if ((q.expected == null) && (q.answer == null) && any.length) {
        const seed = String(any[0]);
        q.expected = seed;
        q.answer = seed;
      } else {
        q.expected = q.expected ?? q.answer;
        q.answer = q.answer ?? q.expected;
      }
      return q;
    };
    const normalize = (q) => ensureAE(q);
    const isShortAnswer = (q) => isShortAnswerItem(q);
    const shuffle = (arr) => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };
    const isMath = (subjectParam === 'math');

    // Prepare Samples
    const samplesRaw = arrify(lessonData?.sample).map(normalize);
    const samplesForPhase = isMath
      ? samplesRaw // allow Short Answer in Math comprehension/exercise
      : samplesRaw.filter((q) => !isShortAnswer(q)); // exclude SA for non-Math

    // Prepare categories (accept single object or array)
    const tf = arrify(lessonData?.truefalse).map(q => ({ ...q, sourceType: 'tf' })).map(normalize);
    const mc = arrify(lessonData?.multiplechoice).map(q => ({ ...q, sourceType: 'mc' })).map(normalize);
    const fib = arrify(lessonData?.fillintheblank).map(q => ({ ...q, sourceType: 'fib' })).map(normalize);
    const sa = arrify(lessonData?.shortanswer).map(q => ({ ...q, sourceType: 'short' })).map(normalize);

    // Exclude invalid MC entries that have no options/choices (would behave like short answer)
    const mcValid = mc.filter(q => {
      const hasChoices = (Array.isArray(q?.choices) && q.choices.length) || (Array.isArray(q?.options) && q.options.length);
      return hasChoices;
    });

    if (isMath) {
      // Math: Mix Samples with TF/MC/FIB/SA
      const pool = [...samplesForPhase, ...tf, ...mcValid, ...fib, ...sa];
      return shuffle(pool);
    }

    // Non-Math: Prefer Samples (no SA). If none, fall back to TF/MC/FIB only.
    if (samplesForPhase.length) return shuffle(samplesForPhase);
    const catPool = [...tf, ...mcValid, ...fib];
    return shuffle(catPool);
  }, [lessonData]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Ensure dynamic targets from learner/runtime are available before building generated sets
      await ensureRuntimeTargets(true); // Force fresh reload
      if (!lessonFilePath) {
        if (!cancelled) {
          setLessonData(null);
          setLessonDataError("");
          setDownloadError("");
        }
        return;
      }

      setLessonDataLoading(true);
      try {
        const res = await fetch(lessonFilePath);
        if (!res.ok) {
          throw new Error(`Failed to load lesson data (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) {
          setLessonData(data);
          setLessonDataError("");
          setDownloadError("");
          // Initialize non-repeating decks for samples and word problems
          initSampleDeck(data);
          initWordDeck(data);
          // Initialize comprehension/exercise pools (math uses sample + wordProblems)
          const initialPool = buildQAPool();
          if (initialPool.length) {
            setCompPool(initialPool);
            setExercisePool(initialPool);
            setCurrentCompProblem(null);
            setCurrentExerciseProblem(null);
          }
          // Attempt to restore persisted assessments for this lesson (id preferred, fallback to filename), invalidate if content changed
          if (!cancelled) {
            const storageKey = getAssessmentStorageKey({ data, manifest: manifestInfo, param: lessonParam });
            const stored = storageKey ? getStoredAssessments(storageKey) : null;
            // For math, do not derive mismatch from test content because tests are generated from samples
            const currentFirstTest = subjectParam === 'math' ? null : (Array.isArray(data.test) && data.test.length ? data.test[0].prompt : null);
            const storedFirstTest = subjectParam === 'math' ? null : (stored && Array.isArray(stored.test) && stored.test.length ? stored.test[0].prompt : null);
            const contentMismatch = subjectParam === 'math' ? false : (storedFirstTest && currentFirstTest && storedFirstTest !== currentFirstTest);
            if (stored && stored.worksheet && stored.test && !contentMismatch) {
              const wOk = Array.isArray(stored.worksheet) && stored.worksheet.length === WORKSHEET_TARGET;
              const tOk = Array.isArray(stored.test) && stored.test.length === TEST_TARGET;
              if (wOk && tOk) {
                setGeneratedWorksheet(stored.worksheet);
                setGeneratedTest(stored.test);
                setCurrentWorksheetIndex(0);
                worksheetIndexRef.current = 0;
              } else {
                // Invalidate stale cache with wrong counts
                try { if (storageKey) clearAssessments(storageKey); } catch {}
                setGeneratedWorksheet(null);
                setGeneratedTest(null);
              }
            } else {
              // Content changed or nothing stored: discard stale sets so a fresh randomization occurs at session begin
              try { if (contentMismatch && storageKey) { clearAssessments(storageKey); } } catch {}
              setGeneratedWorksheet(null);
              setGeneratedTest(null);
              setCurrentWorksheetIndex(0);
              worksheetIndexRef.current = 0;
              worksheetIndexRef.current = 0;
              // NEW: Immediately generate fresh randomized worksheet/test sets so that
              // (a) printing and spoken walkthrough always match, even if user downloads before starting
              // (b) skipping directly to worksheet/test uses the exact same pre-generated arrays
              const shuffle = (arr) => {
                const copy = [...arr];
                for (let i = copy.length - 1; i > 0; i -= 1) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [copy[i], copy[j]] = [copy[j], copy[i]];
                }
                return copy;
              };
              // Select a blended set (for math): ~70% from samples/categories and ~30% from word problems
              const selectMixed = (samples = [], wpArr = [], target = 0, isTest = false) => {
                const wpAvail = Array.isArray(wpArr) ? wpArr : [];
                const baseAvail = Array.isArray(samples) ? samples : [];
                const desiredWp = Math.round(target * 0.3);
                const wpCount = Math.min(Math.max(0, desiredWp), wpAvail.length);
                const baseCount = Math.max(0, target - wpCount);
                const wpSel = shuffle(wpAvail).slice(0, wpCount).map(q => {
                  const core = isTest ? ({ ...q, expected: q.expected ?? q.answer }) : q;
                  return { ...core, sourceType: 'word' };
                });
                const baseSel = shuffle(baseAvail).slice(0, baseCount).map(q => ({ ...q, sourceType: 'sample' }));
                return shuffle([...wpSel, ...baseSel]);
              };
              let gW = [];
              let gT = [];
              if (subjectParam === 'math') {
                const samples = reserveSamples(WORKSHEET_TARGET + TEST_TARGET);
                const words = reserveWords(WORKSHEET_TARGET + TEST_TARGET);
                // Include category pools in addition to samples
                const tf = Array.isArray(data.truefalse) ? data.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
                const mc = Array.isArray(data.multiplechoice) ? data.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
                const fib = Array.isArray(data.fillintheblank) ? data.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
                const sa = Array.isArray(data.shortanswer) ? data.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
                const cats = [...tf, ...mc, ...fib, ...sa];
                if ((samples && samples.length) || (words && words.length) || cats.length) {
                  const takeMixed = (target, isTest) => {
                    const desiredWp = Math.round(target * 0.3);
                    const wpSel = (words || []).slice(0, desiredWp).map(q => ({ ...(isTest ? ({ ...q, expected: q.expected ?? q.answer }) : q), sourceType: 'word' }));
                    // Cap SA/FIB to 10% each in the remainder from samples+categories
                    const remainder = Math.max(0, target - wpSel.length);
                    const cap = Math.max(0, Math.floor(target * 0.10));
                    const fromBase = [
                      ...((samples || []).map(q => ({ ...q, sourceType: 'sample' }))),
                      ...cats
                    ];
                    const saArr = fromBase.filter(q => /short\s*answer|shortanswer/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'short');
                    const fibArr = fromBase.filter(q => /fill\s*in\s*the\s*blank|fillintheblank/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'fib');
                    const others = fromBase.filter(q => !saArr.includes(q) && !fibArr.includes(q));
                    const saPick = shuffleArr(saArr).slice(0, Math.min(cap, saArr.length));
                    const fibPick = shuffleArr(fibArr).slice(0, Math.min(cap, fibArr.length));
                    const remaining = Math.max(0, remainder - saPick.length - fibPick.length);
                    const otherPick = shuffleArr(others).slice(0, remaining);
                    const baseSel = shuffleArr([...saPick, ...fibPick, ...otherPick]);
                    return shuffleArr([...wpSel, ...baseSel]);
                  };
                  gW = takeMixed(WORKSHEET_TARGET, false);
                  gT = takeMixed(TEST_TARGET, true);
                  setGeneratedWorksheet(gW);
                  setGeneratedTest(gT);
                }
              } else {
                // Non-math: build from category arrays when available; cap Short Answer and Fill-in-the-Blank at 10% each
                const buildFromCategories = (target = 0) => {
                  const tf = Array.isArray(data.truefalse) ? data.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
                  const mc = Array.isArray(data.multiplechoice) ? data.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
                  const fib = Array.isArray(data.fillintheblank) ? data.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
                  const sa = Array.isArray(data.shortanswer) ? data.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
                  const anyCats = tf.length || mc.length || fib.length || sa.length;
                  if (!anyCats) return null;
                  const cap = Math.max(0, Math.floor(target * 0.10));
                  const saPick = shuffle(sa).slice(0, Math.min(cap, sa.length));
                  const fibPick = shuffle(fib).slice(0, Math.min(cap, fib.length));
                  const others = shuffle([...tf, ...mc]);
                  const remaining = Math.max(0, target - saPick.length - fibPick.length);
                  const otherPick = others.slice(0, remaining);
                  return shuffle([...saPick, ...fibPick, ...otherPick]);
                };
                const fromCatsW = buildFromCategories(WORKSHEET_TARGET);
                const fromCatsT = buildFromCategories(TEST_TARGET);
                if (fromCatsW) {
                  gW = fromCatsW;
                  setGeneratedWorksheet(gW);
                } else if (Array.isArray(data.worksheet) && data.worksheet.length) {
                  gW = shuffle(data.worksheet).slice(0, WORKSHEET_TARGET);
                  setGeneratedWorksheet(gW);
                }
                if (fromCatsT) {
                  gT = fromCatsT;
                  setGeneratedTest(gT);
                } else if (Array.isArray(data.test) && data.test.length) {
                  gT = shuffle(data.test).slice(0, TEST_TARGET);
                  setGeneratedTest(gT);
                }
              }
              if (storageKey) {
                try { saveAssessments(storageKey, { worksheet: gW, test: gT }); } catch {}
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

  const clearCaptionTimers = () => {
    captionTimersRef.current.forEach((timer) => clearTimeout(timer));
    captionTimersRef.current = [];
  };

  const scheduleCaptionsForAudio = (audio, sentences, startIndex = 0) => {
    clearCaptionTimers();
    if (!sentences.length) return;

    // Only schedule through the provided batch of sentences; caller passes in the new batch
    const totalWords = sentences.reduce((sum, s) => sum + (countWords(s) || 1), 0) || sentences.length;
    const startSchedule = (durationSeconds) => {
      const safeDuration = durationSeconds && Number.isFinite(durationSeconds) && durationSeconds > 0
        ? durationSeconds
        : Math.max(totalWords / 3.6, Math.min(sentences.length * 1.5, 12));

      // Ensure a minimum display time per sentence so progression is visible
      const minPerSentence = 0.6; // seconds

      let elapsed = 0;
      setCaptionIndex(startIndex);
      for (let i = 1; i < sentences.length; i += 1) {
        const prevWords = countWords(sentences[i - 1]) || 1;
        const step = Math.max(minPerSentence, safeDuration * (prevWords / totalWords));
        elapsed += step;
        const timer = window.setTimeout(() => {
          setCaptionIndex(startIndex + i);
        }, Math.round(elapsed * 1000));
        captionTimersRef.current.push(timer);
      }
    };

    let scheduled = false;
    const launch = (d) => {
      if (scheduled) return;
      scheduled = true;
      startSchedule(d);
    };
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      // Use remaining duration when resuming mid-playback so caption pacing stays aligned
      const remaining = Math.max(0.1, (audio.duration || 0) - (audio.currentTime || 0));
      launch(remaining);
    } else {
      const onLoaded = () => launch(audio.duration);
      audio.addEventListener("loadedmetadata", onLoaded, { once: true });
      audio.addEventListener("canplay", onLoaded, { once: true });
      // Fallback: if metadata never fires quickly, schedule with heuristic after 250ms
      const fallbackTimer = window.setTimeout(() => launch(0), 250);
      captionTimersRef.current.push(fallbackTimer);
    }
  };

  // Schedule captions against a known duration (used by WebAudio fallback)
  const scheduleCaptionsForDuration = (durationSeconds, sentences, startIndex = 0) => {
    clearCaptionTimers();
    if (!sentences || !sentences.length) return;

    const totalWords = sentences.reduce((sum, s) => sum + (countWords(s) || 1), 0) || sentences.length;
    const safeDuration = durationSeconds && Number.isFinite(durationSeconds) && durationSeconds > 0
      ? durationSeconds
      : Math.max(totalWords / 3.6, Math.min(sentences.length * 1.5, 12));
    const minPerSentence = 0.6;

    let elapsed = 0;
    setCaptionIndex(startIndex);
    for (let i = 1; i < sentences.length; i += 1) {
      const prevWords = countWords(sentences[i - 1]) || 1;
      const step = Math.max(minPerSentence, safeDuration * (prevWords / totalWords));
      elapsed += step;
      const timer = window.setTimeout(() => setCaptionIndex(startIndex + i), Math.round(elapsed * 1000));
      captionTimersRef.current.push(timer);
    }
  };

  const playAudioFromBase64 = async (audioBase64, batchSentences = [], startIndex = 0) => {
    clearCaptionTimers();

    if (!audioBase64) {
      // Silent step: advance captions using a heuristic so it still feels paced
      // Allow subtle background motion even without audio
      try { if (videoRef.current && !userPaused) { videoRef.current.play?.().catch(() => {}); } } catch {}
      const sentences = batchSentences || [];
      if (sentences.length > 1) {
        // Rough pacing with minimum per-sentence time
        const totalWords = sentences.reduce((sum, s) => sum + (countWords(s) || 1), 0) || sentences.length;
        const safeDuration = Math.max(totalWords / 3.6, Math.min(sentences.length * 1.5, 12));
        const minPerSentence = 0.6; // seconds
        let elapsed = 0;
        setCaptionIndex(startIndex);
        for (let i = 1; i < sentences.length; i += 1) {
          const prevWords = countWords(sentences[i - 1]) || 1;
          const step = Math.max(minPerSentence, safeDuration * (prevWords / totalWords));
          elapsed += step;
          const timer = window.setTimeout(() => setCaptionIndex(startIndex + i), Math.round(elapsed * 1000));
          captionTimersRef.current.push(timer);
        }
      }
      return;
    }

    try {
      // Stash last audio payload in case we need to retry after an iOS unlock
      lastAudioBase64Ref.current = audioBase64 || null;
      lastSentencesRef.current = Array.isArray(batchSentences) ? batchSentences : [];
      lastStartIndexRef.current = Number.isFinite(startIndex) ? startIndex : 0;
      const binaryString = atob(audioBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i += 1) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // If we're on iOS and the WebAudio context is already unlocked, prefer WebAudio path directly
      try {
        const ua = (typeof navigator !== 'undefined' ? navigator.userAgent || '' : '').toLowerCase();
        const isIOS = /iphone|ipad|ipod/.test(ua) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        if (isIOS && audioCtxRef.current && audioCtxRef.current.state !== 'suspended') {
          await playViaWebAudio(audioBase64, batchSentences || [], startIndex);
          return;
        }
      } catch {/* fall back to HTMLAudio below */}

      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch (pauseError) {
          console.warn("[Session] Unable to pause existing audio.", pauseError);
        }
        audioRef.current.src = "";
        audioRef.current = null;
      }

      const blob = new Blob([bytes.buffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      await new Promise((resolve) => {
  const audio = new Audio(url);
  audioRef.current = audio;
  // Apply latest mute state immediately
  audio.muted = Boolean(mutedRef.current);
  audio.volume = mutedRef.current ? 0 : 1;
  if (!userPaused) {
    scheduleCaptionsForAudio(audio, batchSentences || [], startIndex);
  }
        // Track current caption batch boundaries for pause/resume behavior
        try {
          const batchLen = (batchSentences && batchSentences.length) || 0;
          captionBatchStartRef.current = startIndex;
          captionBatchEndRef.current = startIndex + batchLen;
        } catch {}

        const cleanup = () => {
          try { URL.revokeObjectURL(url); } catch {}
          // Do not change caption on cleanup; keep the full text on screen
          audioRef.current = null;
          resolve();
        };

        audio.onended = () => {
          try {
            setIsSpeaking(false);
            // Pause video when the TTS finishes unless the user explicitly resumed
            if (videoRef.current && !userPaused) {
              try { videoRef.current.pause(); } catch {}
            }
          } catch {}
          cleanup();
        };
        audio.onerror = () => {
          try { setIsSpeaking(false); } catch {}
          cleanup();
        };

        if (!userPaused) {
          const playPromise = audio.play();
          // Try to play the video to keep visuals in sync with speech
          if (videoRef.current) {
            try { videoRef.current.play().catch(() => {}); } catch {}
          }
          if (playPromise && playPromise.catch) {
            playPromise.catch((err) => {
              console.warn('[Session] Audio autoplay blocked or failed.', err);
              try { setIsSpeaking(false); } catch {}
              // If audio cannot start, pause the background video to avoid a perpetual "speaking" feel
              if (videoRef.current && !userPaused) {
                try { videoRef.current.pause(); } catch {}
              }
              // Show unlock UI prompt so user can enable audio on iOS/Safari
              try { setNeedsAudioUnlock(true); } catch {}
              cleanup();
            });
          }
        } else {
          // User paused: do not auto play; ensure speaking state is false
          setIsSpeaking(false);
        }
      });
    } catch (audioError) {
      console.error("[Session] Failed to play audio from base64.", audioError);
      const sentences = batchSentences || [];
      if (sentences.length) {
        setCaptionIndex(startIndex + sentences.length - 1);
      }
      await waitForBeat();
    }
  };

  // Persistent WebAudio context + nodes for iOS fallback
  const audioCtxRef = useRef(null);
  const webAudioGainRef = useRef(null);
  const webAudioSourceRef = useRef(null);

  const ensureAudioContext = () => {
    const Ctx = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) return null;
    if (!audioCtxRef.current) {
      try {
        const ctx = new Ctx();
        const gain = ctx.createGain();
        gain.gain.value = mutedRef.current ? 0 : 1;
        gain.connect(ctx.destination);
        audioCtxRef.current = ctx;
        webAudioGainRef.current = gain;
      } catch (e) {
        console.warn('[Session] Failed to create AudioContext', e);
        return null;
      }
    }
    try {
      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        // resume without awaiting to keep in gesture
        audioCtxRef.current.resume();
      }
    } catch {}
    return audioCtxRef.current;
  };

  const stopWebAudioSource = () => {
    const src = webAudioSourceRef.current;
    if (src) {
      try { src.onended = null; } catch {}
      try { src.stop(); } catch {}
      try { src.disconnect(); } catch {}
      webAudioSourceRef.current = null;
    }
  };

  const base64ToArrayBuffer = (b64) => {
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) bytes[i] = binaryString.charCodeAt(i);
    return bytes.buffer;
  };

  const playViaWebAudio = async (b64, sentences, startIndex) => {
    const ctx = ensureAudioContext();
    if (!ctx) throw new Error('WebAudio not available');
    stopWebAudioSource();
    try {
      const arr = base64ToArrayBuffer(b64);
      const buffer = await ctx.decodeAudioData(arr.slice(0));
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      try {
        if (!webAudioGainRef.current) {
          const gain = ctx.createGain();
          gain.gain.value = mutedRef.current ? 0 : 1;
          gain.connect(ctx.destination);
          webAudioGainRef.current = gain;
        }
      } catch {}
      src.connect(webAudioGainRef.current || ctx.destination);
      webAudioSourceRef.current = src;

      if (!userPaused) {
        try { scheduleCaptionsForDuration(buffer.duration, sentences || [], startIndex || 0); } catch {}
        if (videoRef.current) { try { videoRef.current.play(); } catch {} }
      }
      setIsSpeaking(true);
      await new Promise((resolve) => {
        src.onended = () => {
          try {
            setIsSpeaking(false);
            if (videoRef.current && !userPaused) { try { videoRef.current.pause(); } catch {} }
          } catch {}
          stopWebAudioSource();
          resolve();
        };
        try { src.start(0); } catch (e) { console.warn('[Session] WebAudio start failed', e); resolve(); }
      });
    } catch (e) {
      console.warn('[Session] WebAudio decode/play failed', e);
      throw e;
    }
  };

  // One-time audio unlock flow for iOS: resume/create AudioContext, try HTMLAudio immediately, then fallback to WebAudio
  const unlockAudioPlayback = useCallback(() => {
    try {
      // Create/resume AudioContext during the gesture
      const ctx = ensureAudioContext();
      try {
        // Small near-silent blip to solidify unlock; do not await
        if (ctx) {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          g.gain.value = 0.0001;
          osc.connect(g).connect(webAudioGainRef.current || ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.03);
        }
      } catch {}

      setNeedsAudioUnlock(false);

      const b64 = lastAudioBase64Ref.current;
      const sents = Array.isArray(lastSentencesRef.current) ? lastSentencesRef.current : [];
      const idx = Number.isFinite(lastStartIndexRef.current) ? lastStartIndexRef.current : 0;
      if (!b64) return;

      // Try HTMLAudio path synchronously within gesture
      try {
        const arr = base64ToArrayBuffer(b64);
        const blob = new Blob([arr], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.muted = Boolean(mutedRef.current);
        audio.volume = mutedRef.current ? 0 : 1;
        if (!userPaused) { try { scheduleCaptionsForAudio(audio, sents, idx); } catch {} }
        audio.onended = () => {
          try {
            setIsSpeaking(false);
            if (videoRef.current && !userPaused) { try { videoRef.current.pause(); } catch {} }
          } catch {}
          try { URL.revokeObjectURL(url); } catch {}
          audioRef.current = null;
        };
        audio.onerror = () => {
          try { setIsSpeaking(false); } catch {}
          try { URL.revokeObjectURL(url); } catch {}
          audioRef.current = null;
        };
        setIsSpeaking(true);
        if (videoRef.current && !userPaused) { try { videoRef.current.play(); } catch {} }
        const p = audio.play();
        if (p && p.catch) {
          p.catch(async (err) => {
            console.info('[Session] HTMLAudio still blocked post-unlock; falling back to WebAudio', err?.name || err);
            try { setIsSpeaking(false); } catch {}
            try { URL.revokeObjectURL(url); } catch {}
            audioRef.current = null;
            // WebAudio fallback (async; gesture no longer required since context is resumed)
            try { await playViaWebAudio(b64, sents, idx); } catch {}
          });
        }
      } catch (e) {
        console.info('[Session] Immediate HTMLAudio path failed; trying WebAudio', e?.name || e);
        // Fallback to WebAudio
        (async () => { try { await playViaWebAudio(b64, sents, idx); } catch {} })();
      }
    } catch (e) {
      console.warn('[Session] Audio unlock attempt failed', e);
    }
  }, [scheduleCaptionsForAudio]);

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

  // Play/pause handler affecting both audio + video
  const togglePlayPause = () => {
    setUserPaused((prev) => {
      const next = !prev;
      if (next) {
        // Pausing
        if (audioRef.current) {
          try { audioRef.current.pause(); } catch { /* ignore */ }
        }
        if (videoRef.current) {
          try { videoRef.current.pause(); } catch { /* ignore */ }
        }
        // Stop caption progression while paused
        clearCaptionTimers();
        setIsSpeaking(false);
      } else {
        // Resuming
        if (audioRef.current) {
          try {
            audioRef.current.play();
            setIsSpeaking(true);
            // Re-schedule caption timers for the remainder of the current batch
            try {
              const startAt = captionIndex;
              const batchEnd = captionBatchEndRef.current || captionSentencesRef.current.length;
              const slice = (captionSentencesRef.current || []).slice(startAt, batchEnd);
              if (slice.length) {
                scheduleCaptionsForAudio(audioRef.current, slice, startAt);
              }
            } catch {/* ignore scheduling errors */}
          } catch { /* ignore */ }
        } else {
            // No current audio; if future audio arrives while userPaused=false it will auto-play
        }
        if (videoRef.current) {
          try { videoRef.current.play(); } catch { /* ignore */ }
        }
      }
      return next;
    });
  };

  const toggleMute = () => setMuted((m) => !m);

  // Centralized abort/cleanup: stop audio, captions, mic/STT, and in-flight requests
  const abortAllActivity = useCallback(() => {
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
    // Clear captions and indices
    try {
      clearCaptionTimers();
      captionBatchStartRef.current = 0;
      captionBatchEndRef.current = 0;
      captionSentencesRef.current = [];
      setCaptionSentences([]);
      setCaptionIndex(0);
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
      // Build a clean system message WITHOUT any grading rules
      const systemBase = buildSystemMessage({
        lessonTitle: session?.lessonTitle || session?.lesson || effectiveLessonTitle,
        teachingNotes: session?.teachingNotes || '',
        vocab: session?.vocab || (lessonData?.vocab || []),
        gatePhrase: session?.gatePhrase || ''
      });

  // Grading rules go in individual per-question instructions only
      const systemContent = systemBase;
      const userContent = `${instructions}`; // keep user instruction short and focused
      const systemPreview = `${systemContent.slice(0, 200)}… (${systemContent.length} chars)`;
      console.log("[Session] Calling Ms. Sonoma", {
        phaseKey,
        usingSystemId: false,
        systemPreview,
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

      let { res, data } = await attempt({ system: systemContent, instruction: userContent, innertext, session });

      // Dev-only: sometimes the route compiles on first touch and returns 404 briefly.
      // If that happens, pre-warm the route, wait a beat, and retry (forcing full system registration).
      if (res && res.status === 404) {
        try {
          console.warn('[Session] /api/sonoma returned 404; retrying after short delay to allow dev compile...')
        } catch {}
        // Pre-warm the route (GET) to trigger compilation/registration in dev
        try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
        await new Promise(r => setTimeout(r, 900));
        ({ res, data } = await attempt({ system: systemContent, instruction: userContent, innertext, session }));
        // If still 404, wait a bit longer and try one more time
        if (res && res.status === 404) {
          try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
          await new Promise(r => setTimeout(r, 1200));
          ({ res, data } = await attempt({ system: systemContent, instruction: userContent, innertext, session }));
        }
      }

      // No server-side session; always send full system

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
          const openers = ["Wanna hear a joke?", "Let's start with a joke."];
          const hasOpener = openers.some((o) => replyText.trim().toLowerCase().startsWith(o.toLowerCase()));
          if (!hasOpener) {
            const chosen = openers[Math.random() < 0.5 ? 0 : 1];
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
          // Unified opening: keep the content intact; only remove banned words and cleanup spacing
          replyText = replyText
            .replace(/\b(exercise|worksheet|test|exam|quiz|answer key)\b/gi, "")
            .replace(/\s{2,}/g, " ")
            .trim();
        } else if (stepKey === "teaching-unified" || stepKey === "teaching-unified-repeat") {
          // Unified teaching (initial or repeat): strip banned words, allow only the single gate question, normalize others to periods
          const gateQ = "Would you like me to go over that again?";
          let normalized = replyText
            .replace(/\b(exercise|worksheet|test|exam|quiz|answer key)\b/gi, "")
            .replace(/\s{2,}/g, " ")
            .trim();
          // Remove extra question marks except gate question
          const parts = normalized.split(/(?<=[.!?])\s+/).filter(Boolean);
          const cleaned = parts
            .map((p) => (new RegExp(gateQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(p) ? gateQ : p.replace(/\?/g, ".")))
            .join(" ")
            .replace(/\s{2,}/g, " ")
            .trim();
          if (!new RegExp(gateQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(cleaned)) {
            replyText = `${cleaned} ${gateQ}`.trim();
          } else {
            replyText = cleaned;
          }
        } else if (stepKey && stepKey.startsWith("teaching")) {
          // Teaching phase hygiene: avoid worksheet/test mentions; questions only allowed in teaching-wrap gate
          replyText = replyText.replace(/\b(exercise|worksheet|test|exam|quiz|answer key)\b/gi, "").replace(/\s{2,}/g, " ").trim();
          if (stepKey === "teaching-wrap") {
            const gateQ = "Would you like me to go over that again?";
            // Normalize body punctuation (no extra questions except the gate question)
            let normalized = replyText.replace(/\?/g, ".").replace(/\s{2,}/g, " ").trim();
            if (!new RegExp(gateQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(normalized)) {
              normalized = `${normalized} ${gateQ}`.trim();
            }
            replyText = normalized;
          } else {
            replyText = replyText.replace(/\?/g, ".");
          }
        } else if (stepKey === 'teaching-gate-response') {
          const cue = COMPREHENSION_CUE_PHRASE;
          const gateQ = "Would you like me to go over that again?";
          const lower = replyText.trim().toLowerCase();
          const hasCue = lower.includes(cue.toLowerCase());
          // If proceed path: require exactly cue + one question, no trailing content
          if (hasCue) {
            // Strip banned terms and normalize whitespace
            replyText = replyText.replace(/\b(exercise|worksheet|test|exam|quiz|answer key)\b/gi, "").replace(/\s{2,}/g, " ").trim();
            // Keep only optional encouragement + exact cue, and nothing after
            const parts = replyText.split(/(?<=[.!?])\s+/).filter(Boolean);
            const cueIdx = parts.findIndex(p => p.toLowerCase().includes(cue.toLowerCase()));
            if (cueIdx !== -1) {
              const encouragement = cueIdx > 0 ? parts.slice(0, cueIdx).join(" ").replace(/\?+/g, ".").trim() : "";
              replyText = [encouragement, cue].filter(Boolean).join(" ").trim();
            } else {
              replyText = cue; // fallback to just the cue if parsing was odd
            }
          } else {
            // Re-teach or clarifier path: enforce no future-phase terms and allow only the single gate question
            replyText = replyText.replace(/\b(exercise|worksheet|test|exam|quiz|answer key)\b/gi, "").replace(/\s{2,}/g, " ").trim();
            // If it looks like a clarifying yes/no question, allow it and stop
            const isClarifier = /go over it again\?\s*$/i.test(replyText);
            if (!isClarifier) {
              // Enforce unified-teaching end gate question
              let normalized = replyText
                .replace(/\?/g, ".")
                .replace(/\s{2,}/g, " ")
                .trim();
              if (!new RegExp(gateQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(normalized)) {
                normalized = `${normalized} ${gateQ}`.trim();
              }
              replyText = normalized;
            }
          }
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

    setTranscript(replyText);
    setError("");

  // Prepare captions from the full reply (append to keep full transcript)
      let newSentences = splitIntoSentences(replyText);
      // Safety: if splitting lost substantial content (edge punctuation cases), fall back to a single full-text line
      const normalizedOriginal = replyText.replace(/\s+/g, " ").trim();
      const normalizedJoined = newSentences.join(" ").replace(/\s+/g, " ").trim();
      if (normalizedJoined.length < Math.floor(0.9 * normalizedOriginal.length)) {
        newSentences = [normalizedOriginal];
      }
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
  nextAll = [...nextAll, ...newSentences];
  captionSentencesRef.current = nextAll;
  setCaptionSentences(nextAll);
  // Set selection to the first reply sentence (skip the inserted items before reply)
  setCaptionIndex(prevLen + preReplyExtra);

      // Network + processing complete; stop showing loading placeholder BEFORE or while starting audio
      setLoading(false);
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
      return { success: true, data };
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

  // ---------------------------------------------
  // Answer normalization helpers (digits <-> words)
  // We keep this local (UI-side) because we only need lightweight mapping.
  // If future lessons expand beyond 0-20 or include fractions, refactor to a shared util.
  const numberWordMap = useMemo(() => ({
    0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
    10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty'
  }), []);

  const normalizeAnswer = (val) => {
    if (!val) return '';
    const trimmed = String(val).trim().toLowerCase();
    // Direct digit
    if (/^-?\d+$/.test(trimmed)) return String(parseInt(trimmed, 10));
    // Word match
    const directNum = Object.keys(numberWordMap).find(k => numberWordMap[k] === trimmed);
    if (directNum) return String(parseInt(directNum, 10));
    // Remove hyphens (e.g., 'twenty-one' future proofing) then retry
    const deHyphen = trimmed.replace(/-/g, ' ');
    const maybe = Object.keys(numberWordMap).find(k => numberWordMap[k] === deHyphen);
    if (maybe) return String(parseInt(maybe, 10));
    return trimmed; // fallback raw
  };

  const expandExpectedAnswer = (ans) => {
    if (ans == null) return { primary: '', synonyms: [] };
    const norm = normalizeAnswer(ans);
    const num = parseInt(norm, 10);
    if (!Number.isNaN(num) && numberWordMap[num]) {
      const word = numberWordMap[num];
      if (word !== norm) {
        return { primary: norm, synonyms: [word] };
      }
      return { primary: norm, synonyms: [word] };
    }
    return { primary: String(ans), synonyms: [] };
  };

  // Format multiple-choice options for speech (e.g., "A) ..., B) ..., C) ...")
  const formatMcOptions = (item) => {
    try {
      const opts = Array.isArray(item?.options)
        ? item.options.filter(Boolean)
        : (Array.isArray(item?.choices) ? item.choices.filter(Boolean) : []);
      if (!opts.length) return '';
      const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      // Normalize: strip any existing leading label for the expected letter, then prepend exactly one standardized label
      const parts = opts.map((o, i) => {
        const raw = String(o ?? '').trim();
        const label = labels[i] || '';
        // Strip ANY leading letter label like "A)", "(B)", "C.", "D:", "E -" regardless of which letter it is
        const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.\:\)\-]\s*/i;
        const cleaned = raw.replace(anyLabel, '').trim();
        return `${label}. ${cleaned}`;
      });
      return parts.join(' ');
    } catch {
      return '';
    }
  };

  // Phase-agnostic question formatting helpers
  const isTrueFalse = (item) => {
    try {
      const qType = String(item?.type || '').toLowerCase();
      if (item?.sourceType === 'tf') return true;
      if (/^(true\s*\/\s*false|truefalse|tf)$/i.test(qType)) return true;
      // Heuristic: treat as TF when expected/answer is literally true/false (common in category arrays)
      const exp = String(item?.expected ?? item?.answer ?? '').trim().toLowerCase();
      if (exp === 'true' || exp === 'false') return true;
      const any = Array.isArray(item?.expectedAny) ? item.expectedAny.map((v) => String(v).trim().toLowerCase()) : [];
      if (any.includes('true') || any.includes('false')) return true;
      return false;
    } catch { return false; }
  };
  const isFillInBlank = (item) => {
    try {
      const st = String(item?.sourceType || '').toLowerCase();
      const qt = String(item?.type || '').toLowerCase();
      const prompt = String(item?.prompt || item?.question || '').toLowerCase();
      if (st === 'fib') return true;
      if (/fill\s*in\s*the\s*blank|fillintheblank/.test(qt)) return true;
      if (/_{3,}/.test(prompt)) return true; // has ___ style blanks
      return false;
    } catch { return false; }
  };
  const isShortAnswerItem = (item) => {
    try {
      const st = String(item?.sourceType || '').toLowerCase();
      const qt = String(item?.type || '').toLowerCase();
      if (st === 'short') return true;
      if (/short\s*answer|shortanswer/.test(qt)) return true;
      // Heuristic: not TF, no choices/options, not FIB -> treat as short answer
      const hasChoices = (Array.isArray(item?.choices) && item.choices.length) || (Array.isArray(item?.options) && item.options.length);
      if (!isTrueFalse(item) && !hasChoices && !isFillInBlank(item)) return true;
      return false;
    } catch { return false; }
  };
  const formatQuestionForSpeech = useCallback((item) => {
    if (!item) return '';
    const tfPrefix = isTrueFalse(item) ? 'True/False: ' : '';
    const mc = formatMcOptions(item);
    const base = String(item.prompt || item.question || '').trim();
    return mc ? `${tfPrefix}${base} ${mc}` : `${tfPrefix}${base}`;
  }, []);

  // Helper: get the display text of an MC option by its letter (A, B, C, ...)
  const getOptionTextForLetter = (item, letter) => {
    try {
      if (!item || !letter) return null;
      const opts = Array.isArray(item?.options)
        ? item.options.filter(Boolean)
        : (Array.isArray(item?.choices) ? item.choices.filter(Boolean) : []);
      if (!opts.length) return null;
      const idx = String(letter).toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0);
      if (idx < 0 || idx >= opts.length) return null;
      const raw = String(opts[idx] ?? '').trim();
      const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.:\)\-]\s*/i;
      const cleaned = raw.replace(anyLabel, '').trim();
      return cleaned || null;
    } catch { return null; }
  };

  // Ensure displayed/asked question ends with a question mark
  const ensureQuestionMark = (s) => {
    try {
      const t = String(s || '').trim();
      if (!t) return t;
      if (t.endsWith('?')) return t;
      return t.replace(/[.!]+$/, '') + '?';
    } catch {
      return s;
    }
  };

  // Determine the letter label (A, B, C, ...) for the correct option when the expected/acceptable answer
  // matches one of the provided options. Returns the uppercase letter or null if not applicable.
  const letterForAnswer = (item, acceptableList = []) => {
    try {
      const opts = Array.isArray(item?.options)
        ? item.options.filter(Boolean)
        : (Array.isArray(item?.choices) ? item.choices.filter(Boolean) : []);
      if (!opts.length) return null;
      const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      const norm = (s) => normalizeAnswer(String(s ?? ''));
      const acc = Array.from(new Set((acceptableList || []).map((v) => norm(v))));
      // If expected is directly a single letter, accept it as-is
      const directLetter = acc.find(v => /^[a-d]$/i.test(v));
      if (directLetter) return String(directLetter).toUpperCase();
      for (let i = 0; i < opts.length; i += 1) {
        const label = labels[i] || '';
        const raw = String(opts[i] ?? '').trim();
        // Strip ANY leading letter label for comparison
        const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.\:\)\-]\s*/i;
        const cleaned = raw.replace(anyLabel, '').trim();
        const nclean = norm(cleaned);
        if (acc.includes(nclean)) return label || null;
      }
      return null;
    } catch {
      return null;
    }
  };

  // Ensure a set matches target length by topping up from provided pools; duplicates only as last resort
  const promptKey = (q) => String(q?.prompt || q?.question || '').trim().toLowerCase();
  const ensureExactCount = useCallback((base = [], target = 0, pools = [], allowDuplicatesAsLastResort = true) => {
    const out = [...(Array.isArray(base) ? base : [])];
    if (out.length >= target) return out.slice(0, target);
    const used = new Set(out.map(promptKey));
    const pushUnique = (item) => {
      const key = promptKey(item);
      if (!key || !used.has(key)) {
        out.push(item);
        if (key) used.add(key);
      }
    };
    for (const pool of pools) {
      if (out.length >= target) break;
      const arr = Array.isArray(pool) ? pool : [];
      for (const item of arr) {
        if (out.length >= target) break;
        pushUnique(item);
      }
    }
    if (out.length < target && allowDuplicatesAsLastResort) {
      // Cycle through pools again allowing duplicates
      const flat = pools.flat().filter(Boolean);
      let idx = 0;
      while (out.length < target && flat.length) {
        out.push(flat[idx % flat.length]);
        idx += 1;
      }
    }
    return out.slice(0, target);
  }, []);

  // Global, non-repeating sample deck across phases (comprehension, exercise, and math worksheet/test picks)
  const sampleDeckRef = useRef([]); // array of sample items in a fixed shuffled order
  const sampleIndexRef = useRef(0); // next read index in deck
  const usedSampleSetRef = useRef(new Set()); // track used prompts to avoid repeats across phases within a cycle
  const shuffleArr = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const initSampleDeck = useCallback((data) => {
    try {
      const raw = Array.isArray(data?.sample) ? data.sample : [];
      sampleDeckRef.current = shuffleArr(raw);
      sampleIndexRef.current = 0;
      usedSampleSetRef.current = new Set();
    } catch {
      sampleDeckRef.current = [];
      sampleIndexRef.current = 0;
      usedSampleSetRef.current = new Set();
    }
  }, []);
  const drawSampleUnique = useCallback(() => {
    const deck = sampleDeckRef.current || [];
    if (!deck.length) return null;
    if (sampleIndexRef.current >= deck.length) {
      // Completed a full cycle: reshuffle and reset (now repeats are allowed again)
      sampleDeckRef.current = shuffleArr(deck);
      sampleIndexRef.current = 0;
      usedSampleSetRef.current = new Set();
    }
    const item = sampleDeckRef.current[sampleIndexRef.current++];
    const key = String(item?.prompt || item?.question || '').trim();
    if (key) usedSampleSetRef.current.add(key);
    return item || null;
  }, []);
  const reserveSamples = useCallback((count) => {
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const it = drawSampleUnique();
      if (!it) break;
      out.push(it);
    }
    return out;
  }, [drawSampleUnique]);

  // Word problem deck (math) with non-repeating behavior across phases that use it (worksheet/test selections)
  const wordDeckRef = useRef([]);
  const wordIndexRef = useRef(0);
  const initWordDeck = useCallback((data) => {
    try {
      const raw = Array.isArray(data?.wordProblems) ? data.wordProblems : [];
      wordDeckRef.current = shuffleArr(raw);
      wordIndexRef.current = 0;
    } catch {
      wordDeckRef.current = [];
      wordIndexRef.current = 0;
    }
  }, []);
  const drawWordUnique = useCallback(() => {
    const deck = wordDeckRef.current || [];
    if (!deck.length) return null;
    if (wordIndexRef.current >= deck.length) {
      wordDeckRef.current = shuffleArr(deck);
      wordIndexRef.current = 0;
    }
    return wordDeckRef.current[wordIndexRef.current++] || null;
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

  // Only react to explicit user pause by pausing the video; do not auto-play the video here.
  // Video playback will be driven by TTS (audio) so we avoid starting the video on mount or when userPaused flips to false.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (userPaused) {
        video.pause();
      }
    } catch {
      /* ignore */
    }
  }, [userPaused]);

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
    // Unified discussion: Greeting -> Encouragement -> Joke -> Silly Question in ONE response
    setCanSend(false);
  const learnerName = (typeof window !== 'undefined' ? (localStorage.getItem('learner_name') || '') : '').trim();
  const lessonTitleExact = (effectiveLessonTitle && typeof effectiveLessonTitle === 'string' && effectiveLessonTitle.trim()) ? effectiveLessonTitle.trim() : 'the lesson';
    const instruction = [
      "Unified opening: In one response do all of the following in order:",
      learnerName
        ? `1) Greeting: begin with a hello that says the learner's name exactly as: "${learnerName}" and name the lesson exactly as: "${lessonTitleExact}" (1–2 sentences, no question).`
        : `1) Greeting: say hello and name the lesson exactly as: "${lessonTitleExact}" (1–2 sentences, no question).`,
      "2) Encouragement: one short, positive sentence (no question).",
      "3) Joke: start with either 'Wanna hear a joke?' or 'Let's start with a joke.' then tell one short kid-friendly joke related to the subject (total up to 2 sentences).",
      "4) Silly question: ask one playful question before teaching, exactly one sentence ending with a question mark. THIS MUST BE THE FINAL SENTENCE of your entire response. Do NOT add anything after this question. End immediately after the silly question."
    ].join(" ");
    const result = await callMsSonoma(instruction, "", {
      phase: "discussion",
      subject: subjectParam,
      difficulty: difficultyParam,
      lesson: lessonParam,
      lessonTitle: effectiveLessonTitle,
      learnerName,
      step: "unified-discussion",
    });
    if (!result.success) return;
    setSubPhase("awaiting-learner");
    setCanSend(true);
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
      setCanSend(true);
    } else {
      setSubPhase(step.next);
    }
  };

  const startTeachingUnified = async () => {
    // Unified teaching: Intro -> Example(s) -> Wrap + gate question in ONE response
    setCanSend(false);
    let instruction = [
      `Unified teaching for "${effectiveLessonTitle}": Do all parts in one response strictly within this lessonTitle scope.`,
      "1) Intro: introduce today's topic and what they'll accomplish (about three short sentences).",
      "2) Examples: walk through one or two worked numeric examples step by step that you fully compute yourself (no asking learner to solve).",
      "3) Wrap: summarize the exact steps for this lesson and finish by asking exactly 'Would you like me to go over that again?'",
      // Guardrails already established globally; reminder for brevity:
      "Use only that single gate question; no other questions or future-phase terms.",
      KID_FRIENDLY_STYLE
    ].join(" ");
    instruction = withTeachingNotes(instruction);
    const result = await callMsSonoma(instruction, "", {
      phase: "teaching",
      subject: subjectParam,
      difficulty: difficultyParam,
      lesson: lessonParam,
      lessonTitle: effectiveLessonTitle,
      step: "teaching-unified",
      teachingNotes: getTeachingNotes() || undefined,
    });
    if (!result.success) return;
    setSubPhase("awaiting-gate");
    setCanSend(true);
  };

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
      "3) Compact recap of the exact procedural steps.",
      "End by asking exactly 'Would you like me to go over that again?' and nothing else after it.",
      // Declaration already given for teaching phase above; no need to restate the banned list.
      "Follow prior teaching guardrails (no future-phase terms or additional questions).",
      KID_FRIENDLY_STYLE
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
    setCanSend(true);
    setTeachingRepeats((c) => c + 1);
  };

  // Auto-advance scripted steps after audio finishes speaking
  useEffect(() => {
    // Only auto-advance after the session has begun and after audio finishes
    if (showBegin || loading || isSpeaking) return;

    // Do not auto-advance discussion anymore; it's unified into one step
    if (phase === "discussion") return;

    if (phase === "teaching") {
      // Progress through teaching steps automatically until awaiting-gate
      if (["teaching-intro", "teaching-example", "teaching-wrap"].includes(subPhase)) {
        startTeachingStep();
      }
    }
  }, [isSpeaking, loading, phase, subPhase, showBegin]);

  const handleDownloadWorksheet = async () => {
    const ok = await ensurePinAllowed('download');
    if (!ok) return;
    // Open a blank tab immediately to avoid popup blockers; we'll populate it after generating the PDF
  const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    try { showTipOverride('Tip: If nothing opens, allow pop-ups for this site.'); } catch {}
    setDownloadError("");
    let source = generatedWorksheet;
    // If not yet generated, build synchronously now to avoid state update race
    if (!source?.length && lessonData) {
      const shuffle = (arr) => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };
      if (subjectParam === 'math') {
        const samples = Array.isArray(lessonData.sample) ? lessonData.sample.map(q => ({ ...q, sourceType: 'sample' })) : [];
        const words = Array.isArray(lessonData.wordProblems) ? lessonData.wordProblems.map(q => ({ ...q, sourceType: 'word' })) : [];
        const tf = Array.isArray(lessonData.truefalse) ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
        const mc = Array.isArray(lessonData.multiplechoice) ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
        const fib = Array.isArray(lessonData.fillintheblank) ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
        const sa = Array.isArray(lessonData.shortanswer) ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
        const cats = [...tf, ...mc, ...fib, ...sa];
        const desiredWp = Math.round(WORKSHEET_TARGET * 0.3);
        const wpSel = shuffle(words).slice(0, Math.min(desiredWp, words.length));
        // Cap SA/FIB to 10% each in remainder from samples+categories
        const remainder = Math.max(0, WORKSHEET_TARGET - wpSel.length);
        const cap = Math.max(0, Math.floor(WORKSHEET_TARGET * 0.10));
        const fromBase = shuffle([...samples, ...cats]);
        const saArr = fromBase.filter(q => /short\s*answer|shortanswer/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'short');
        const fibArr = fromBase.filter(q => /fill\s*in\s*the\s*blank|fillintheblank/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'fib');
        const others = fromBase.filter(q => !saArr.includes(q) && !fibArr.includes(q));
        const saPick = saArr.slice(0, Math.min(cap, saArr.length));
        const fibPick = fibArr.slice(0, Math.min(cap, fibArr.length));
        const remaining = Math.max(0, remainder - saPick.length - fibPick.length);
        const otherPick = others.slice(0, remaining);
        const base = shuffle([...wpSel, ...saPick, ...fibPick, ...otherPick]);
        const used = new Set(base.map(promptKey));
        const remBase = shuffle([...samples, ...cats]).filter(q => !used.has(promptKey(q)));
        const remWords = shuffle(words).filter(q => !used.has(promptKey(q)));
        source = ensureExactCount(base, WORKSHEET_TARGET, [remBase, remWords]);
      } else {
        const tf = Array.isArray(lessonData.truefalse) ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
        const mc = Array.isArray(lessonData.multiplechoice) ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
        const fib = Array.isArray(lessonData.fillintheblank) ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
        const sa = Array.isArray(lessonData.shortanswer) ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
        const maxShort = Math.floor(WORKSHEET_TARGET * 0.3);
        const saPick = shuffle(sa).slice(0, Math.min(maxShort, sa.length));
        const others = shuffle([...tf, ...mc, ...fib]);
        const otherPick = others.slice(0, Math.max(0, WORKSHEET_TARGET - saPick.length));
        if (saPick.length || otherPick.length) {
          const base = shuffle([...saPick, ...otherPick]);
          const used = new Set(base.map(promptKey));
          const remOthers = others.filter(q => !used.has(promptKey(q)));
          const remFib = fib.filter(q => !used.has(promptKey(q)));
          const remSa = sa.filter(q => !used.has(promptKey(q)));
          const legacy = Array.isArray(lessonData.worksheet) ? lessonData.worksheet.filter(q => !used.has(promptKey(q))) : [];
          source = ensureExactCount(base, WORKSHEET_TARGET, [shuffle(remOthers), shuffle(remFib), shuffle(remSa), shuffle(legacy)]);
        } else if (Array.isArray(lessonData.worksheet) && lessonData.worksheet.length) {
          source = ensureExactCount(shuffle(lessonData.worksheet).slice(0, WORKSHEET_TARGET), WORKSHEET_TARGET, [shuffle(lessonData.worksheet)]);
        }
      }
      if (source?.length) {
        setGeneratedWorksheet(source);
        const key = getAssessmentStorageKey();
        if (key) {
          try { saveAssessments(key, { worksheet: source, test: generatedTest || [] }); } catch {}
        }
      }
    }
    if (!source?.length) {
      setDownloadError("Worksheet content is unavailable for this lesson.");
      return;
    }
    createPdfForItems(source.map((q, i) => ({ ...q, number: i + 1 })), "worksheet", previewWin);
  };

  const handleDownloadTest = async () => {
    const ok = await ensurePinAllowed('download');
    if (!ok) return;
    // Open a blank tab immediately to avoid popup blockers; we'll populate it after generating the PDF
  const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    try { showTipOverride('Tip: If nothing opens, allow pop-ups for this site.'); } catch {}
    setDownloadError("");
    let source = generatedTest;
    if (!source?.length && lessonData) {
      const shuffle = (arr) => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };
      if (subjectParam === 'math') {
        const samples = Array.isArray(lessonData.sample) ? lessonData.sample.map(q => ({ ...q, sourceType: 'sample' })) : [];
        const words = Array.isArray(lessonData.wordProblems) ? lessonData.wordProblems.map(q => ({ ...q, sourceType: 'word' })) : [];
        const tf = Array.isArray(lessonData.truefalse) ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
        const mc = Array.isArray(lessonData.multiplechoice) ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
        const fib = Array.isArray(lessonData.fillintheblank) ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
        const sa = Array.isArray(lessonData.shortanswer) ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
        const cats = [...tf, ...mc, ...fib, ...sa];
        const desiredWp = Math.round(TEST_TARGET * 0.3);
        const wpSel = shuffle(words).slice(0, Math.min(desiredWp, words.length)).map(q => ({ ...q, expected: q.expected ?? q.answer, sourceType: 'word' }));
        // Cap SA/FIB to 10% each in remainder from samples+categories
        const remainder = Math.max(0, TEST_TARGET - wpSel.length);
        const cap = Math.max(0, Math.floor(TEST_TARGET * 0.10));
        const fromBase = shuffle([...samples, ...cats]);
        const saArr = fromBase.filter(q => /short\s*answer|shortanswer/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'short');
        const fibArr = fromBase.filter(q => /fill\s*in\s*the\s*blank|fillintheblank/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'fib');
        const others = fromBase.filter(q => !saArr.includes(q) && !fibArr.includes(q));
        const saPick = saArr.slice(0, Math.min(cap, saArr.length));
        const fibPick = fibArr.slice(0, Math.min(cap, fibArr.length));
        const remaining = Math.max(0, remainder - saPick.length - fibPick.length);
        const otherPick = others.slice(0, remaining);
        const base = shuffle([...wpSel, ...saPick, ...fibPick, ...otherPick]);
        const used = new Set(base.map(promptKey));
        const remBase = shuffle([...samples, ...cats]).filter(q => !used.has(promptKey(q)));
        const remWords = shuffle(words).filter(q => !used.has(promptKey(q)));
        source = ensureExactCount(base, TEST_TARGET, [remBase, remWords]);
      } else {
        const tf = Array.isArray(lessonData.truefalse) ? lessonData.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
        const mc = Array.isArray(lessonData.multiplechoice) ? lessonData.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
        const fib = Array.isArray(lessonData.fillintheblank) ? lessonData.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
        const sa = Array.isArray(lessonData.shortanswer) ? lessonData.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
        const maxShort = Math.floor(TEST_TARGET * 0.3);
        const saPick = shuffle(sa).slice(0, Math.min(maxShort, sa.length));
        const others = shuffle([...tf, ...mc, ...fib]);
        const otherPick = others.slice(0, Math.max(0, TEST_TARGET - saPick.length));
        if (saPick.length || otherPick.length) {
          const base = shuffle([...saPick, ...otherPick]);
          const used = new Set(base.map(promptKey));
          const remOthers = others.filter(q => !used.has(promptKey(q)));
          const remFib = fib.filter(q => !used.has(promptKey(q)));
          const remSa = sa.filter(q => !used.has(promptKey(q)));
          const legacy = Array.isArray(lessonData.test) ? lessonData.test.filter(q => !used.has(promptKey(q))) : [];
          source = ensureExactCount(base, TEST_TARGET, [shuffle(remOthers), shuffle(remFib), shuffle(remSa), shuffle(legacy)]);
        } else if (Array.isArray(lessonData.test) && lessonData.test.length) {
          source = ensureExactCount(shuffle(lessonData.test).slice(0, TEST_TARGET), TEST_TARGET, [shuffle(lessonData.test)]);
        }
      }
      if (source?.length) {
        setGeneratedTest(source);
        const key = getAssessmentStorageKey();
        if (key) {
          try { saveAssessments(key, { worksheet: generatedWorksheet || [], test: source }); } catch {}
        }
      }
    }
    if (!source?.length) {
      setDownloadError("Test content is unavailable for this lesson.");
      return;
    }
    createPdfForItems(source.map((q, i) => ({ ...q, number: i + 1 })), "test", previewWin);
  };

  // Re-generate fresh randomized worksheet and test sets and reset session progress
  const handleRefreshWorksheetAndTest = useCallback(async () => {
    // Clear persisted sets for this lesson
    const key = getAssessmentStorageKey();
    if (key) { try { clearAssessments(key); } catch { /* ignore */ } }
    // Reset current worksheet/test state
    setGeneratedWorksheet(null);
    setGeneratedTest(null);
    setCurrentWorksheetIndex(0);
    worksheetIndexRef.current = 0;
    setTestActiveIndex(0);
    setTestUserAnswers([]);
    // Re-run generation logic by reloading the lesson data block
    try {
      // Force re-evaluation of targets in case learner or runtime changed
      runtimeTargetsLoaded = false;
      await ensureRuntimeTargets(true); // Force fresh reload
      // Force immediate regeneration using existing logic just below lesson load
      const data = lessonData;
      if (!data) return;
      const storageKey = getAssessmentStorageKey({ data, manifest: manifestInfo, param: lessonParam });
      // Copy of the generation logic pathway; rely on helper decks already initialized
      const shuffle = (arr) => {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i -= 1) {
          const j = Math.floor(Math.random() * (i + 1));
          [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
      };
      let gW = [];
      let gT = [];
      if (subjectParam === 'math') {
        const samples = reserveSamples(WORKSHEET_TARGET + TEST_TARGET);
        const words = reserveWords(WORKSHEET_TARGET + TEST_TARGET);
        const takeMixed = (target, isTest) => {
          const desiredWp = Math.round(target * 0.3);
          const wpSel = (words || []).slice(0, desiredWp).map(q => ({ ...(isTest ? ({ ...q, expected: q.expected ?? q.answer }) : q), sourceType: 'word' }));
          const remainder = Math.max(0, target - wpSel.length);
          const cap = Math.max(0, Math.floor(target * 0.10));
          const fromSamples = (samples || []).map(q => ({ ...q, sourceType: 'sample' }));
          const sa = fromSamples.filter(q => /short\s*answer|shortanswer/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'short');
          const fib = fromSamples.filter(q => /fill\s*in\s*the\s*blank|fillintheblank/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'fib');
          const others = fromSamples.filter(q => !sa.includes(q) && !fib.includes(q));
          const shuffleArr = (arr) => shuffle(arr);
          const saPick = shuffleArr(sa).slice(0, Math.min(cap, sa.length));
          const fibPick = shuffleArr(fib).slice(0, Math.min(cap, fib.length));
          const remaining = Math.max(0, remainder - saPick.length - fibPick.length);
          const otherPick = shuffleArr(others).slice(0, remaining);
          const baseSel = shuffleArr([...saPick, ...fibPick, ...otherPick]);
          const base = shuffleArr([...wpSel, ...baseSel]);
          if (base.length >= target) return base.slice(0, target);
          const usedKeys = new Set(base.map(promptKey));
          const remOthers = others.filter(q => !usedKeys.has(promptKey(q)));
          const remSa = sa.filter(q => !usedKeys.has(promptKey(q)));
          const remFib = fib.filter(q => !usedKeys.has(promptKey(q)));
          const remWords = (words || []).slice(desiredWp).filter(q => !usedKeys.has(promptKey(q)));
          return ensureExactCount(base, target, [shuffleArr(remOthers), shuffleArr(remSa), shuffleArr(remFib), shuffleArr(remWords)]);
        };
        gW = takeMixed(WORKSHEET_TARGET, false);
        gT = takeMixed(TEST_TARGET, true);
        setGeneratedWorksheet(gW);
        setGeneratedTest(gT);
      } else {
        const tf = Array.isArray(data.truefalse) ? data.truefalse.map(q => ({ ...q, sourceType: 'tf' })) : [];
        const mc = Array.isArray(data.multiplechoice) ? data.multiplechoice.map(q => ({ ...q, sourceType: 'mc' })) : [];
        const fib = Array.isArray(data.fillintheblank) ? data.fillintheblank.map(q => ({ ...q, sourceType: 'fib' })) : [];
        const sa = Array.isArray(data.shortanswer) ? data.shortanswer.map(q => ({ ...q, sourceType: 'short' })) : [];
        const anyCats = tf.length || mc.length || fib.length || sa.length;
        if (anyCats) {
          const gFromCats = (target) => {
            const capLocal = Math.max(0, Math.floor(target * 0.10));
            const saPick = shuffle(sa).slice(0, Math.min(capLocal, sa.length));
            const fibPick = shuffle(fib).slice(0, Math.min(capLocal, fib.length));
            const others = shuffle([...tf, ...mc]);
            const remaining = Math.max(0, target - saPick.length - fibPick.length);
            const otherPick = others.slice(0, remaining);
            const base = shuffle([...saPick, ...fibPick, ...otherPick]);
            if (base.length >= target) return base.slice(0, target);
            const usedKeys = new Set(base.map(promptKey));
            const remOthers = others.slice(remaining).filter(q => !usedKeys.has(promptKey(q)));
            const remFib = fib.filter(q => !usedKeys.has(promptKey(q)));
            const remSa = sa.filter(q => !usedKeys.has(promptKey(q)));
            const legacy = label => (Array.isArray(data[label]) ? data[label] : []).filter(q => !usedKeys.has(promptKey(q)));
            const legacyAll = [...legacy('worksheet'), ...legacy('test')];
            return ensureExactCount(base, target, [shuffle(remOthers), shuffle(remFib), shuffle(remSa), shuffle(legacyAll)]);
          };
          gW = gFromCats(WORKSHEET_TARGET);
          gT = gFromCats(TEST_TARGET);
          setGeneratedWorksheet(gW);
          setGeneratedTest(gT);
        } else {
          if (Array.isArray(data.worksheet) && data.worksheet.length) setGeneratedWorksheet(ensureExactCount(shuffle(data.worksheet).slice(0, WORKSHEET_TARGET), WORKSHEET_TARGET, [shuffle(data.worksheet)]));
          if (Array.isArray(data.test) && data.test.length) setGeneratedTest(ensureExactCount(shuffle(data.test).slice(0, TEST_TARGET), TEST_TARGET, [shuffle(data.test)]));
        }
      }
      if (storageKey) { try { saveAssessments(storageKey, { worksheet: gW, test: gT }); } catch {} }
    } catch {}
  }, [lessonData, lessonParam, manifestInfo, subjectParam]);

  // Make header print dropdown trigger the same actions
  useEffect(() => {
    const onWs = () => { try { handleDownloadWorksheet(); } catch {} };
    const onTest = () => { try { handleDownloadTest(); } catch {} };
    const onRefresh = () => { try { handleRefreshWorksheetAndTest(); } catch {} };
    window.addEventListener('ms:print:worksheet', onWs);
    window.addEventListener('ms:print:test', onTest);
    window.addEventListener('ms:print:refresh', onRefresh);
    return () => {
      window.removeEventListener('ms:print:worksheet', onWs);
      window.removeEventListener('ms:print:test', onTest);
      window.removeEventListener('ms:print:refresh', onRefresh);
    };
  }, [handleDownloadWorksheet, handleDownloadTest, handleRefreshWorksheetAndTest]);

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

  // PDF generator (worksheet/test). For worksheet: add header bar "<Title> Worksheet 20 __________" with name line.
  // Dynamically choose largest font size that fits on a single page for worksheet content; tests retain multi-page flow.
  function createPdfForItems(items = [], label = 'worksheet', previewWin = null) {
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
      // Helper: shrink long blanks for fill-in-the-blank items
      // Previously ~one-third; now double the size (~two-thirds) as requested
      const shrinkFIBBlanks = (s, ratio = 0.66) => {
        if (!s) return s;
        return s.replace(/_{4,}/g, (m) => {
          const desired = Math.max(12, Math.round(m.length * ratio));
          return '_'.repeat(desired);
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
        let base = String(item.prompt || item.question || '');
        const qType = String(item.type || '').toLowerCase();
        const isFIB = item.sourceType === 'fib' || /fill\s*in\s*the\s*blank|fillintheblank/.test(qType);
        const isTF = item.sourceType === 'tf' || /^(true\s*\/\s*false|truefalse|tf)$/i.test(qType);
        // Shrink blanks for FIB items (both worksheet and test)
        if (isFIB) {
          base = shrinkFIBBlanks(base);
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
            return `${lbl}. ${cleaned}`;
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
  // Preview-first: strictly open in the provided preview window/tab with inline viewer; no auto-download
      const fileName = `${manifestInfo.file || 'lesson'}-${label}.pdf`;
      try {
  const blob = doc.output('blob');
        const blobUrl = URL.createObjectURL(blob);
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${fileName}</title>
<meta name="viewport" content="width=device-width, initial-scale=1"> 
<style>html,body{height:100%;margin:0}body{display:flex;flex-direction:column}header{padding:8px 12px;border-bottom:1px solid #ddd;font:14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;color:#111;background:#fafafa;display:flex;gap:8px;align-items:center}header .sp{flex:1}iframe{flex:1;border:0;width:100%}a.button{display:inline-block;padding:6px 10px;border:1px solid #ccc;border-radius:6px;text-decoration:none;color:#111;background:#fff}a.button:hover{background:#f3f3f3}</style>
</head><body>
<header>
  <div>${fileName}</div>
  <div class="sp"></div>
  <a class="button" href="${blobUrl}" download="${fileName}">Download</a>
</header>
<iframe src="${blobUrl}" title="${fileName}"></iframe>
</body></html>`;
  const win = previewWin && previewWin.document ? previewWin : null;
        if (win && win.document) {
          win.document.open();
          win.document.write(html);
          win.document.close();
          // Revoke URL when tab unloads
          try { win.addEventListener('beforeunload', () => URL.revokeObjectURL(blobUrl)); } catch {}
        } else {
          // Do not auto-download; surface a friendly tip instead
          setDownloadError('Preview blocked. Please allow pop-ups for this site to view the PDF.');
          try { showTipOverride('Tip: Allow pop-ups to preview PDFs.'); } catch {}
        }
      } catch (e) {
        // Do not auto-download; show error
        setDownloadError('Failed to generate or preview the PDF.');
      }
    } catch (e) {
      console.error('[PDF] Failed to generate PDF', e);
      setDownloadError('Failed to generate PDF.');
    }
  }

  // Disable sending when the UI is not ready or while Ms. Sonoma is speaking
  const comprehensionAwaitingBegin = (phase === 'comprehension' && subPhase === 'comprehension-start' && !currentCompProblem);
  const speakingLock = !!isSpeaking; // lock input anytime she is speaking
  const sendDisabled = (!canSend || loading || comprehensionAwaitingBegin || speakingLock);
  // Transient placeholder override for the input field (non-intrusive and time-limited)
  const [tipOverride, setTipOverride] = useState(null);
  const tipTimerRef = useRef(null);
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
        return "Opening: greeting, encouragement, a quick joke, and a silly question.";
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

  const ensureBaseSessionSetup = useCallback(() => {
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
  const stored = storedKey ? getStoredAssessments(storedKey) : null;
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
  setCurrentWorksheetIndex(0);
  worksheetIndexRef.current = 0;
      }
      if (tOk && !generatedTest) {
        setGeneratedTest(stored.test);
      }
      if ((wOk || !stored.worksheet) && (tOk || !stored.test)) return;
      // Mismatch: drop cache and continue to regenerate below
      try { if (storedKey) clearAssessments(storedKey); } catch {}
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
      const samples = Array.isArray(lessonData.sample) ? lessonData.sample.map(q => ({ ...q, sourceType: 'sample' })) : [];
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
      const fromBase = shuffle2([...samples, ...cats]);
      const saArr = fromBase.filter(q => /short\s*answer|shortanswer/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'short');
      const fibArr = fromBase.filter(q => /fill\s*in\s*the\s*blank|fillintheblank/i.test(String(q?.type||'')) || String(q?.sourceType||'') === 'fib');
      const others = fromBase.filter(q => !saArr.includes(q) && !fibArr.includes(q));
      const saPick = saArr.slice(0, Math.min(cap, saArr.length));
      const fibPick = fibArr.slice(0, Math.min(cap, fibArr.length));
      const remaining = Math.max(0, remainder - saPick.length - fibPick.length);
      const otherPick = others.slice(0, remaining);
      const base = shuffle2([...wpSel, ...saPick, ...fibPick, ...otherPick]);
      const used = new Set(base.map(promptKey));
      const remBase = shuffle2([...samples, ...cats]).filter(q => !used.has(promptKey(q)));
      const remWords = shuffle2(words).filter(q => !used.has(promptKey(q)));
      return ensureExactCount(base, target, [remBase, remWords]);
    };
    if (subjectParam === 'math') {
      if (!gW) {
        gW = buildMathSet(WORKSHEET_TARGET, false);
        if (gW && gW.length) {
          setGeneratedWorksheet(gW);
          setCurrentWorksheetIndex(0);
          worksheetIndexRef.current = 0;
        }
      }
      if (!gT) {
        gT = buildMathSet(TEST_TARGET, true);
        if (gT && gT.length) setGeneratedTest(gT);
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
          setCurrentWorksheetIndex(0);
          worksheetIndexRef.current = 0;
        } else if (Array.isArray(lessonData.worksheet) && lessonData.worksheet.length) {
          gW = shuffle2(lessonData.worksheet).slice(0, WORKSHEET_TARGET);
          setGeneratedWorksheet(gW);
          setCurrentWorksheetIndex(0);
          worksheetIndexRef.current = 0;
        }
      }
      if (!gT) {
        if (fromCatsT) {
          gT = fromCatsT;
          setGeneratedTest(gT);
        } else if (Array.isArray(lessonData.test) && lessonData.test.length) {
          gT = shuffle2(lessonData.test).slice(0, TEST_TARGET);
          setGeneratedTest(gT);
        }
      }
    }
    if (gW || gT) {
      if (lessonData.id) {
  const key = getAssessmentStorageKey();
  if (key) { try { saveAssessments(key, { worksheet: gW || [], test: gT || [] }); } catch {} }
      }
    }
  }, [lessonData, generatedWorksheet, generatedTest, compPool.length]);

  const beginSession = async () => {
    await ensureRuntimeTargets(true); // Force fresh reload of targets
    setShowBegin(false);
    setPhase("discussion");
    setPhaseGuardSent({});
    ensureBaseSessionSetup();
    // Build ephemeral provided question sets for comprehension and exercise
    try {
      const pool = buildQAPool();
      const shuffled = Array.isArray(pool) ? (Array.from(pool)) : [];
      // Simple in-place shuffle
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const totalNeeded = Math.max(0, (COMPREHENSION_TARGET || 0)) + Math.max(0, (EXERCISE_TARGET || 0));
      let take = shuffled.slice(0, totalNeeded);
      // If pool is smaller than needed, allow repetition by cycling
      if (take.length < totalNeeded && shuffled.length) {
        const extra = [];
        let k = 0;
        while (take.length + extra.length < totalNeeded) {
          extra.push({ ...shuffled[k % shuffled.length] });
          k += 1;
        }
        take = [...take, ...extra];
      }
      const compArr = take.slice(0, COMPREHENSION_TARGET);
      const exArr = take.slice(COMPREHENSION_TARGET, COMPREHENSION_TARGET + EXERCISE_TARGET);
      setGeneratedComprehension(compArr);
      setGeneratedExercise(exArr);
      setCurrentCompIndex(0);
      setCurrentExIndex(0);
      setCurrentCompProblem(null);
      setCurrentExerciseProblem(null);
    } catch {
      // If anything goes wrong, leave as null and fall back to on-the-fly selection
      setGeneratedComprehension(null);
      setGeneratedExercise(null);
      setCurrentCompIndex(0);
      setCurrentExIndex(0);
      setCurrentCompProblem(null);
      setCurrentExerciseProblem(null);
    }
    setSubPhase("unified-discussion");
    setCanSend(false);
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
    const preface = 'Teaching notes (for your internal guidance; integrate naturally—do not read verbatim): ' + tn;
    return `${preface}\n${baseInstruction}`;
  }, [getTeachingNotes]);

  const beginWorksheetPhase = () => {
    // Ensure assessments exist if user arrived here via skip before they were generated
    if (!generatedWorksheet) {
      ensureBaseSessionSetup();
    }
    if (!generatedWorksheet || !generatedWorksheet.length) {
      // Nothing to run
      setSubPhase('worksheet-empty');
      setCanSend(false);
      return;
    }
    // Ensure the initial Begin button is never shown once worksheet starts
    setShowBegin(false);
    // Immediately advance subPhase so the "Begin Worksheet" button disappears
    // even while we wait for Ms. Sonoma's intro + first question reply.
  setSubPhase('worksheet-active');
  worksheetIndexRef.current = 0;
    setCanSend(false);
  const first = generatedWorksheet[0];
  // Use the same speech formatter so TF prefix and MC options are embedded in the asked question
  const firstWithOptions = ensureQuestionMark(formatQuestionForSpeech(first));
    // Instruction differs if reached via skip: include announcement + encouragement + joke announcement + joke before first question
    const introInstruction = worksheetSkippedAwaitBegin ? [
      'Worksheet start (skipped to): Output exactly six sentences:',
      '(1) Announce you are beginning the worksheet now.',
      '(2) One short encouragement sentence (different from announcement).',
      '(3) Announce a quick joke with a lead-in like "Here comes a quick joke before we dive in."',
      '(4) Tell one kid-friendly very short math joke (single sentence).',
      '(5) Say one short readiness line to lead into the first question (for example, "Ready for your first question?").',
      '(6) Ask the FIRST worksheet question exactly as provided below; this must be the final sentence and must end with a question mark.',
      'Do not add labels; do not say any of the bracketed tokens aloud.',
      `FIRST_WORKSHEET_QUESTION: ${firstWithOptions}`
    ].join(' ') : [
      'Worksheet start: Output exactly two sentences:',
      '(1) One friendly sentence acknowledging they are ready, reassuring them they will do great. Do not mention the test.',
      '(2) Ask the FIRST worksheet question exactly as provided below; this must be the final sentence and must end with a question mark.',
      'Do not add labels; do not say any of the bracketed tokens aloud.',
      `FIRST_WORKSHEET_QUESTION: ${firstWithOptions}`
    ].join(' ');
  callMsSonoma(introInstruction, '', { phase: 'worksheet', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'worksheet-start', skippedIntro: worksheetSkippedAwaitBegin })
      .then(() => {
        setTicker(1); // question number displayed as 1 for first question
  setCurrentWorksheetIndex(0);
  worksheetIndexRef.current = 0;
        setCanSend(true);
        if (worksheetSkippedAwaitBegin) setWorksheetSkippedAwaitBegin(false);
      })
      .catch(() => {
        setCanSend(true);
        if (worksheetSkippedAwaitBegin) setWorksheetSkippedAwaitBegin(false);
      });
  };

  const beginTestPhase = async () => {
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
          const samples = Array.isArray(lessonData.sample) ? lessonData.sample : [];
          const words = Array.isArray(lessonData.wordProblems) ? lessonData.wordProblems : [];
          if (samples.length || words.length) {
            const desiredWp = Math.round(TEST_TARGET * 0.3);
            const wpSel = shuffle(words).slice(0, Math.min(desiredWp, words.length)).map(q => ({ ...q, expected: q.expected ?? q.answer, sourceType: 'word' }));
            const baseSel = shuffle(samples).slice(0, Math.max(0, TEST_TARGET - wpSel.length)).map(q => ({ ...q, sourceType: 'sample' }));
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
          try {
            const key = getAssessmentStorageKey();
            if (key) saveAssessments(key, { worksheet: generatedWorksheet || [], test: built });
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
    // Ensure audio can play if previously paused by user
    setUserPaused(false);
    // Reset model-validated correctness tracking
    setUsedTestCuePhrases([]);
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
    setTestCorrectCount(0);
  // Prepare first question visual (include numbering prefix "1.") and inline choices/TF label
  const firstItem = generatedTest[0];
  const firstBody = formatQuestionForSpeech(firstItem);
  const firstDisplay = `1. ${firstBody}`;
  captionSentencesRef.current = [firstDisplay];
  worksheetIndexRef.current = 0;
  setCaptionSentences([firstDisplay]);
    setCaptionIndex(0);
    setTestActiveIndex(0);
    setSubPhase('test-active');
    setCanSend(true);
    try { showTipOverride('Starting test…', 3000); } catch {}

    // Do not trigger TTS here; just show the first question in the overlay with captions and proceed silently.
  };

  // Begin Comprehension manually when arriving at comprehension-start (e.g., via skip)
  const beginComprehensionPhase = async () => {
    // Ensure session scaffolding exists
    ensureBaseSessionSetup();
    // Only act in comprehension phase
    if (phase !== 'comprehension') return;
    if (subPhase !== 'comprehension-start') setSubPhase('comprehension-start');
    try { console.log('[Session] Begin Comprehension clicked', { phase, subPhase, currentCompIndex, compPoolLen: Array.isArray(compPool) ? compPool.length : 0 }); } catch {}
  setCanSend(false);
    // Try to pick a first comprehension problem in the same priority order used elsewhere
    let firstComp = null;
    if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
      let idx = currentCompIndex;
      while (idx < generatedComprehension.length && isShortAnswerItem(generatedComprehension[idx])) idx += 1;
      if (idx < generatedComprehension.length) {
        firstComp = generatedComprehension[idx];
        setCurrentCompIndex(idx + 1);
      }
    }
    if (!firstComp) {
      let tries = 0;
      while (tries < 5) {
        const s = drawSampleUnique();
        if (s && !isShortAnswerItem(s)) { firstComp = s; break; }
        tries += 1;
      }
    }
    if (!firstComp && compPool.length) {
      const filtered = compPool.filter(q => !isShortAnswerItem(q));
      if (filtered.length > 0) {
        firstComp = filtered[0];
        setCompPool(compPool.slice(1));
      }
    }
    // Final fallback: rebuild pool from lesson data
    if (!firstComp) {
      const refilled = buildQAPool();
      if (Array.isArray(refilled) && refilled.length) {
        firstComp = refilled[0];
        setCompPool(refilled.slice(1));
      }
    }
    // If we still didn't find a non-short-answer item, fall back to ANY available item
    if (!firstComp) {
      try {
        if (Array.isArray(generatedComprehension) && generatedComprehension.length) {
          firstComp = generatedComprehension[currentCompIndex] || generatedComprehension[0];
          setCurrentCompIndex((currentCompIndex || 0) + 1);
        } else if (Array.isArray(compPool) && compPool.length) {
          firstComp = compPool[0];
          setCompPool(compPool.slice(1));
        }
      } catch {}
    }
    if (firstComp) {
      try { console.log('[Session] Selected first comprehension item', { firstComp }); } catch {}
      setCurrentCompProblem(firstComp);
      const formatted = formatQuestionForSpeech(firstComp);
      const intro = [
        'Comprehension start: Begin with exactly ONE short encouragement sentence.',
        'Immediately after that, ask the following comprehension question exactly as the FINAL sentence (single question sentence ending with a question mark).',
        'Do not add any other sentences after the question.',
        `FIRST_COMPREHENSION_QUESTION: ${formatted}`
      ].join(' ');
      try {
        await callMsSonoma(intro, '', { phase: 'comprehension', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'comprehension-start-ask-first' }, { fastReturn: true });
      } finally {
        // Keep input disabled until Ms. Sonoma finishes speaking the first question
        // A dedicated effect will flip canSend to true when isSpeaking becomes false
        setCanSend(false);
      }
    } else {
      try { console.warn('[Session] Begin Comprehension: no available question found on first attempt'); } catch {}
      // Nothing available yet; allow user to try again
      setCanSend(true);
    }
  };

  // ------------------------------
  // Automatic Test Review Sequence
  // After the learner finishes silent test input, we deliver a review intro.
  // Then we automatically iterate each question without requiring user input.
  // Final summary now receives externally computed score so the model just reports it.
  const finalizeTestAndFarewell = async ({ correctCount, total, percent } = {}) => {
    if (!generatedTest || !generatedTest.length) return;
    const fallbackTotal = generatedTest.length;
    const safeTotal = total || fallbackTotal;
    const safeCorrect = (typeof correctCount === 'number') ? correctCount : testCorrectCount;
    const safePercent = (typeof percent === 'number') ? percent : Math.round((safeCorrect / Math.max(1, safeTotal)) * 100);
    const learnerName = (typeof window !== 'undefined' ? (localStorage.getItem('learner_name') || '') : '').trim();
    const gradeInstruction = [
      'Final test summary (TEST ONLY):',
      'You are given the authoritative score numbers from the system. DO NOT recalculate or estimate.',
      `AUTHORITATIVE_TOTAL: ${safeTotal}`,
      `AUTHORITATIVE_CORRECT: ${safeCorrect}`,
      `AUTHORITATIVE_PERCENT: ${safePercent}`,
      'Output exactly one sentence reporting only the percentage in this exact pattern: "Your score is AUTHORITATIVE_PERCENT%." (replace token with the number). Nothing else in that sentence.',
      'Then a second proud but concise congratulation sentence (no numbers).',
      'Then a third sentence that begins exactly with: "One more joke before we go."',
      'Then a fourth sentence containing one short kid-friendly joke (single sentence).',
      'Then a fifth encouragement sentence to keep learning.',
      learnerName
        ? `Then a final warm goodbye sentence that says the learner's name exactly as: "${learnerName}". Output nothing after the goodbye.`
        : 'Then a final warm goodbye sentence. Output nothing after the goodbye.'
    ].join(' ');
  const summary = await callMsSonoma(gradeInstruction, '', { phase: 'test', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'test-final-summary', correctCount: safeCorrect, total: safeTotal, percent: safePercent, learnerName });
    if (summary.success) {
      setPhase('congrats');
      setSubPhase('congrats-done');
  setCanSend(false);
      try { setTestFinalPercent(safePercent); } catch {}
      // Persist medal for this learner/lesson (best-of, no downgrades). Uses Supabase when available, local fallback otherwise.
      try {
        const learnerId = (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
        // lesson key convention matches lessons quota API: `${subject}/${filename}`; here lessonParam may include .json
        const subjectLower = (subjectParam || 'math').toLowerCase();
        const lessonKey = `${subjectLower}/${lessonParam}`;
        if (learnerId && lessonKey && typeof safePercent === 'number') {
          upsertMedal(learnerId, lessonKey, safePercent);
        }
      } catch {}
    } else {
      setCanSend(true);
    }
  };

  const performTestReviewItem = async (idx) => {
    if (!generatedTest || !generatedTest.length) return;
    if (idx >= generatedTest.length) {
      await finalizeTestAndFarewell();
      return;
    }
    setTestReviewIndex(idx);
    setSubPhase('test-review');
    setCanSend(false);
  const q = generatedTest[idx];
    const learnerAnsRaw = (testUserAnswers[idx] || '').trim();
    const learnerAnsForDisplay = learnerAnsRaw || 'blank';
  const { primary: expectedPrimary, synonyms: expectedSyns } = expandExpectedAnswer(q.expected || q.answer);
  const anyOfT = expectedAnyList(q);
  let acceptable = anyOfT && anyOfT.length ? Array.from(new Set(anyOfT.map(String))) : [expectedPrimary, ...expectedSyns];
  const letterT = letterForAnswer(q, acceptable);
  if (letterT) {
    const optTextT = getOptionTextForLetter(q, letterT);
    acceptable = Array.from(new Set([
      ...acceptable,
      letterT,
      letterT.toLowerCase(),
      ...(optTextT ? [optTextT] : [])
    ]));
  }
  const isLast = idx === generatedTest.length - 1;
  // Frontend picks one unused cue phrase and embeds it verbatim; do not send the list.
  const unusedCuePhrases = CORRECT_TEST_CUE_PHRASES.filter(p => !usedTestCuePhrases.includes(p));
  const chosenCue = (unusedCuePhrases.length ? unusedCuePhrases : CORRECT_TEST_CUE_PHRASES)[Math.floor(Math.random() * (unusedCuePhrases.length ? unusedCuePhrases.length : CORRECT_TEST_CUE_PHRASES.length))];
    // Safe prompt/expected fallbacks to avoid sending undefined
    const promptForReview = (q.prompt || q.question || '').trim() || 'Prompt missing';
    const expectedForReview = (expectedPrimary || '').toString().trim() || 'Expected missing';
    const instructionParts = [
      'Test review item structured output only.',
      `ACCEPTABLE_ANSWERS: [${acceptable.join(', ')}]`,
      Array.isArray(q.keywords) && q.keywords.length ? `KEYWORDS: [${q.keywords.join(', ')}]` : null,
      Number.isInteger(q.minKeywords) ? `MIN: ${q.minKeywords}` : null,
      `Question number: ${idx + 1}`,
      `Question: ${promptForReview}`,
      `Expected: ${expectedForReview}`,
      `Learner answered: ${learnerAnsForDisplay}`,
      isOpenEndedTestItem(q) ? JUDGING_LENIENCY_OPEN_ENDED : null,
      'Produce exactly FIVE conversational sentences (no numbering):',
      `(a) Start with: "Question ${idx + 1},"`,
      '(b) Second sentence: the question text verbatim.',
      `(c) Third: "The expected answer was ${expectedPrimary}."`,
      `(d) Fourth: "Your answer was ${learnerAnsForDisplay}."`,
  `(e) Fifth: If incorrect give one short gentle correction with the right answer. If correct, say, "${chosenCue}"`,
      isLast ? 'Do NOT add any more sentences after the fifth.' : 'After those five sentences output exactly one more sentence: "Next question." Only if not final.'
    ];
    const result = await callMsSonoma(
      instructionParts.join(' '),
      '',
  { phase: 'test', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'test-review-item', index: idx },
      { fastReturn: true } // fastReturn: allow ticker to update immediately while audio plays
    );
    if (result.success) {
      // Detect cue phrase for correctness (model-validated)
      const replyText = result.data && result.data.reply ? result.data.reply : '';
      if (replyText) {
        const replyLower = replyText.toLowerCase();
        // Count a correct answer if ANY allowed cue phrase appears in the reply.
        // Do not require cross-question uniqueness; we only care about presence per item.
        let matchedCue = null;
        for (const phrase of CORRECT_TEST_CUE_PHRASES) {
          if (replyLower.includes(phrase.toLowerCase())) { matchedCue = phrase; break; }
        }
        if (matchedCue) {
          setUsedTestCuePhrases(prev => [...prev, matchedCue]);
          setTestCorrectCount(prev => prev + 1);
          console.log('[TestReview] Matched cue phrase:', matchedCue, 'Updated correct count.');
        } else {
          console.log('[TestReview] No cue phrase matched in reply:', replyText);
        }
      }
      if (isLast) {
        // Defer final summary until after last audio finishes so closing lines don't overlap
        const total = generatedTest.length;
        const correct = testCorrectCount; // already incremented if matched
        const percent = Math.round((correct / Math.max(1, total)) * 100);
        const interval = setInterval(() => {
          const playing = audioRef.current && !audioRef.current.paused;
          if (!playing) {
            clearInterval(interval);
            finalizeTestAndFarewell({ correctCount: correct, total, percent });
          }
        }, 350);
      } else {
        // Chain next review item AFTER current audio finishes to avoid overlapping voices
        const interval = setInterval(() => {
          const playing = audioRef.current && !audioRef.current.paused;
          if (!playing) {
            clearInterval(interval);
            performTestReviewItem(idx + 1);
          }
        }, 300);
      }
    } else {
      // On failure allow manual retry by enabling send (edge case)
      setCanSend(true);
    }
  };

  // Single-call full test review (original mode) – ticker updates only after full review finishes
  const performFullTestReview = async (answersOverride) => {
    if (!generatedTest || !generatedTest.length) return;
    setSubPhase('test-review');
    setCanSend(false);
    const answers = answersOverride || testUserAnswers;
  const questionBlocks = generatedTest.map((q, i) => {
      const { primary: expectedPrimary, synonyms: expectedSyns } = expandExpectedAnswer(q.expected || q.answer);
      const anyOf = expectedAnyList(q);
      let acceptable = anyOf && anyOf.length
        ? Array.from(new Set(anyOf.map(String)))
        : [expectedPrimary, ...expectedSyns];
      const letter = letterForAnswer(q, acceptable);
      if (letter) {
        const optText = getOptionTextForLetter(q, letter);
        acceptable = Array.from(new Set([
          ...acceptable,
          letter,
          letter.toLowerCase(),
          ...(optText ? [optText] : [])
        ]));
      }
  const learnerAnsRaw = (answers[i] || '').trim() || 'blank';
  // Choose a per-question cue phrase on the frontend (avoid sending lists; keep uniqueness best-effort)
  const prior = new Set();
  try { usedTestCuePhrases.forEach(p => prior.add(p)); } catch {}
  const candidates = CORRECT_TEST_CUE_PHRASES.filter(p => !prior.has(p));
  const cueForThis = (candidates.length ? candidates : CORRECT_TEST_CUE_PHRASES)[Math.floor(Math.random() * (candidates.length ? candidates.length : CORRECT_TEST_CUE_PHRASES.length))];
      const promptForReview = (q.prompt || q.question || '').trim() || 'Prompt missing';
      const expectedForReview = (expectedPrimary || '').toString().trim() || 'Expected missing';
      const lines = [
        `QUESTION_${i + 1}_PROMPT: ${promptForReview}`,
        `QUESTION_${i + 1}_EXPECTED: ${expectedForReview}`,
  `QUESTION_${i + 1}_ACCEPTABLE: [${acceptable.join(', ')}]`,
        `QUESTION_${i + 1}_LEARNER: ${learnerAnsRaw}`,
        `QUESTION_${i + 1}_CUE: ${cueForThis}`
      ];
      if (Array.isArray(q.keywords) && q.keywords.length) {
        lines.push(`QUESTION_${i + 1}_KEYWORDS: [${q.keywords.join(', ')}]`);
      }
      if (Number.isInteger(q.minKeywords)) {
        lines.push(`QUESTION_${i + 1}_MIN: ${q.minKeywords}`);
      }
      return lines.join('\n');
    }).join('\n\n');
    const reviewInstruction = [
      'You are given all test questions with expected answers, acceptable variants, and learner answers.',
      'For each question in order, produce exactly five short natural sentences (no numbering, no bullets, no markdown).',
      'Sentence 1: exactly "Question N." (replace N).',
      'Sentence 2: the question text verbatim.',
      'Sentence 3: "The expected answer was X."',
      'Sentence 4: "Your answer was Y."',
      'Sentence 5: If incorrect give one short gentle correction with the right answer. If correct, say the provided cue phrase for this question exactly as written in the question data.',
      // Bounded leniency: only for open-ended items (the model should apply this where applicable)
      JUDGING_LENIENCY_OPEN_ENDED,
      'After the fifth sentence output "Next question." only when not the final question.',
      'For the final question do NOT add "Next question." and do NOT give any overall score or summary.',
      'Do NOT output any aggregate score, percent, total correct count, or closing remarks. Stop immediately after the last required sentence.',
      'Question data follows. Do NOT echo metadata keys.'
    ].join(' ');
    const result = await callMsSonoma(
      reviewInstruction + '\n\n' + questionBlocks,
      '',
  { phase: 'test', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'test-full-review' }
    );
    if (result.success) {
      const replyText = result.data?.reply || '';
      // Strategy: Split by "Question N." boundaries to isolate blocks. We only allow ONE cue phrase per block.
      // This prevents accidental double counting if model erroneously appends more than one cue phrase.
      const total = generatedTest.length;
      const blockRegex = /Question\s+(\d+)\./gi;
      const indices = [];
      let m;
      while ((m = blockRegex.exec(replyText)) !== null) {
        indices.push({ q: parseInt(m[1], 10), index: m.index });
      }
      // Push end sentinel
      indices.sort((a,b)=>a.index-b.index);
      const blocks = [];
      for (let i = 0; i < indices.length; i++) {
        const start = indices[i].index;
        const end = (i + 1 < indices.length) ? indices[i+1].index : replyText.length;
        const qNumber = indices[i].q;
        if (qNumber >= 1 && qNumber <= total) {
          blocks.push({ q: qNumber, text: replyText.slice(start, end) });
        }
      }
      // Count correctness per block if ANY allowed cue phrase appears in that block (case-insensitive).
      // We do not enforce uniqueness across different questions; duplicates are acceptable.
      let correct = 0;
      const found = [];
      for (const block of blocks) {
        const lowerBlock = block.text.toLowerCase();
        let chosen = null;
        for (const phrase of CORRECT_TEST_CUE_PHRASES) {
          if (lowerBlock.includes(phrase.toLowerCase())) { chosen = phrase; break; }
        }
        if (chosen) { correct++; found.push(chosen); }
      }
      setUsedTestCuePhrases(found);
      setTestCorrectCount(Math.min(correct, total));
      const percent = Math.round((correct / Math.max(1, total)) * 100);
      // We want ticker to appear right after audio finishes, before final summary.
      const interval = setInterval(() => {
        const playing = audioRef.current && !audioRef.current.paused;
        if (!playing) {
          clearInterval(interval);
          // Mark a completed review subPhase so UI can show percent immediately.
          setTestFinalPercent(percent);
          setSubPhase('test-review-finished');
          // Trigger final summary AFTER a short defer so percent overlay is visible first frame.
          setTimeout(() => finalizeTestAndFarewell({ correctCount: correct, total, percent }), 150);
        }
      }, 350);
    } else {
      setCanSend(true);
    }
  };

  // TEMP development helper: skip forward through major phases
  const skipForwardPhase = async () => {
    const ok = await ensurePinAllowed('skip');
    if (!ok) return;
    // Centralized abort/cleanup
    abortAllActivity();
    // Ensure overlays tied to !loading can render immediately (Begin buttons)
    setLoading(false);
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
      return;
    }
    if (phase === 'worksheet') {
      setPhase('test');
      setSubPhase('test-awaiting-begin');
      setTicker(0);
      setCanSend(false);
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
    abortAllActivity();
    // Ensure overlays tied to !loading can render immediately after back-skip
    setLoading(false);
    if (phase === 'congrats') {
      setPhase('test');
      setSubPhase('test-awaiting-begin');
      setCanSend(false);
      return;
    }
    if (phase === 'test') {
      setPhase('worksheet');
      setSubPhase('worksheet-awaiting-begin');
      setCanSend(false);
      return;
    }
    if (phase === 'worksheet') {
      setPhase('exercise');
      setSubPhase('exercise-awaiting-begin');
      try { exerciseAwaitingLockRef.current = true; setTimeout(() => { exerciseAwaitingLockRef.current = false; }, 800); } catch {}
      setCanSend(false);
      return;
    }
    if (phase === 'exercise') {
      // Go back to Comprehension start
      setPhase('comprehension');
  setSubPhase('comprehension-start');
      try { comprehensionAwaitingLockRef.current = true; setTimeout(() => { comprehensionAwaitingLockRef.current = false; }, 800); } catch {}
      setCurrentCompProblem(null);
      setCanSend(false);
      return;
    }
    if (phase === 'comprehension') {
      // From comprehension, return to Discussion begin
      setPhase('discussion');
      setSubPhase('greeting');
      setShowBegin(true);
      // When returning to the Discussion begin screen, lock input until Begin is pressed
      setCanSend(false);
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
    // From discussion/teaching → comprehension
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
    // From comprehension → exercise (awaiting begin)
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
    // From exercise → worksheet (awaiting begin)
    if (phase === 'exercise') {
      setPhase('worksheet');
      setSubPhase('worksheet-awaiting-begin');
      setWorksheetSkippedAwaitBegin(true);
      setTicker(0);
      setCanSend(false);
      return;
    }
    // From worksheet → test (awaiting begin)
    if (phase === 'worksheet') {
      setPhase('test');
      setSubPhase('test-awaiting-begin');
      setTicker(0);
      setCanSend(false);
      return;
    }
    // If already at test/congrats, do nothing
  }, [skipPendingLessonLoad, lessonData, lessonDataLoading]);

  // Begin Exercise manually when awaiting begin (either skipped or auto-transitioned)
  const beginSkippedExercise = () => {
    if (phase !== 'exercise' || subPhase !== 'exercise-awaiting-begin') return;
    // Clear any temporary awaiting lock now that the user is explicitly starting
    try { exerciseAwaitingLockRef.current = false; } catch {}
    // Ensure pools/assessments exist if we arrived here via skip before setup
    ensureBaseSessionSetup();
    // Choose first exercise problem from ephemeral pre-generated array; fallback to deck/pools
    let first = null;
    if (Array.isArray(generatedExercise) && currentExIndex < generatedExercise.length) {
      let idx = currentExIndex;
      while (idx < generatedExercise.length && isShortAnswerItem(generatedExercise[idx])) idx += 1;
      if (idx < generatedExercise.length) {
        first = generatedExercise[idx];
        setCurrentExIndex(idx + 1);
      }
    }
    if (!first) {
      let tries = 0;
      while (tries < 5) {
        const candidate = drawSampleUnique();
        if (candidate && !isShortAnswerItem(candidate)) { first = candidate; break; }
        tries += 1;
      }
    }
    if (!first && exercisePool.length) {
      const [head, ...rest] = exercisePool;
      first = isShortAnswerItem(head) ? null : head;
      setExercisePool(rest);
    }
    if (!first) {
      const refilled = buildQAPool();
      if (refilled.length) {
        const [head, ...rest] = refilled;
        first = head;
        setExercisePool(rest);
      }
    }
    if (first) {
      setCurrentExerciseProblem(first);
    } else {
      setCurrentExerciseProblem(null);
    }
  setExerciseSkippedAwaitBegin(false);
    setSubPhase('exercise-start');
    // Build intro + first question instruction for Ms. Sonoma (mirrors worksheet pattern)
    if (first) {
      const formattedFirst = formatQuestionForSpeech(first);
      const exerciseIntro = [
        'Exercise start: Briefly (one friendly sentence) announce we are beginning the exercise practice. No mention of worksheet or test.',
        'Immediately after that, ask the FIRST exercise question exactly as provided below as the FINAL sentence (single question sentence ending with a question mark, nothing after).',
        `FIRST_EXERCISE_QUESTION: ${formattedFirst}`
      ].join(' ');
      setCanSend(false);
  callMsSonoma(exerciseIntro, '', { phase: 'exercise', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'exercise-start' })
        .then(() => {
          // After model asks first question, allow learner to answer
          setCanSend(true);
          setTicker(0); // ticker counts correct answers; remains 0 initially
        })
        .catch(() => setCanSend(true));
    } else {
      // No preselected problem available: instruct model to generate one so the API fires and session proceeds
      const exerciseIntro = [
        'Exercise start: Briefly (one friendly sentence) announce we are beginning the exercise practice. No mention of worksheet or test.',
        'Immediately after that, generate ONE appropriate first exercise question for this lesson as the FINAL sentence (single question sentence ending with a question mark, nothing after).'
      ].join(' ');
      setCanSend(false);
  callMsSonoma(exerciseIntro, '', { phase: 'exercise', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'exercise-start-generate' })
        .then(() => {
          setCanSend(true);
          setTicker(0);
        })
        .catch(() => setCanSend(true));
    }
  };

  const handleSend = async (providedValue) => {
    // Use the provided value when present (e.g., from InputPanel), otherwise fall back to state
    const raw = providedValue !== undefined ? providedValue : learnerInput;
    const trimmed = String(raw ?? '').trim();
    if (!trimmed) {
      return;
    }
    // Clear only when actually sending so the input doesn't appear to "eat" text without sending
    setLearnerInput("");

    if (phase === 'discussion' && subPhase === 'awaiting-learner') {
      setCanSend(false);
      let combinedInstruction = [
        "Silly question follow-up: BEGIN by directly replying to (and briefly referencing) the learner's most recent message that answered the silly question in a playful, natural way (one short sentence, two at most). Do not restate the original silly question. Immediately after that playful acknowledgment, transition smoothly into teaching.",
        `Unified teaching for "${effectiveLessonTitle}": Do all parts in one response strictly within this lessonTitle scope.`,
        '1) Intro: introduce today\'s topic and what they\'ll accomplish (about three short sentences).',
        '2) Examples: walk through one or two worked numeric examples step by step that you fully compute yourself (no asking learner to solve).',
        '3) Wrap: summarize the exact steps for this lesson and finish by asking exactly "Would you like me to go over that again?"'
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
      setCanSend(false);

      // Ms. Sonoma decides based on the learner message using strict normalization rules
      const normalizationRules = [
        'Normalize the learner reply by lowercasing, trimming, collapsing spaces, removing punctuation, and mapping number words zero–twenty to digits.',
        'YES set: yes, y, yeah, yup, ok, okay, sure, please.',
        'NO set: no, n, nope, nah, not now, later.',
        'If and only if the normalized reply is a single token (no spaces) in the YES set, treat it as YES.',
        'If and only if the normalized reply is a single token (no spaces) in the NO set, treat it as NO.',
        'If unclear, ask one short clarifying question: "Do you want me to go over it again?" and stop.'
      ].join(' ');

      const gateInstruction = [
        'Teaching gate follow-up: Decide if the learner wants a repeat or to move on using the normalization rules. Do not be lenient or interpret beyond those rules.',
        normalizationRules,
        // YES branch: immediately re-teach in a fresh way
        `If YES: Re-teach now. Deliver the full unified teaching for "${effectiveLessonTitle}" again, rephrasing the intro and definitions, and use 2–3 new tiny worked examples that you fully compute yourself. End exactly with: "Would you like me to go over that again?" Do not mention exercise, worksheet, test, exam, quiz, or answer key.`,
        // NO branch: encouragement + cue ONLY (no question yet; UI will show Begin Comprehension)
        `If NO: Start with one short encouragement sentence. Then output exactly: "${COMPREHENSION_CUE_PHRASE}" and stop. Do not include any comprehension question or additional content after the cue.`
      ].join(' ');

      const result = await callMsSonoma(
        withTeachingNotes(gateInstruction),
        trimmed,
  { phase: 'teaching', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'teaching-gate-response' }
      );
      const replyRaw = (result && result.data && result.data.reply) || '';
      setLearnerInput('');

      // Decide next UI state based on what Ms. Sonoma chose:
      const cueDetected = replyRaw.trim().toLowerCase().includes(COMPREHENSION_CUE_PHRASE.toLowerCase());
      if (cueDetected) {
        // Proceed path: enter comprehension landing (Begin Comprehension button)
        setPhase('comprehension');
        setSubPhase('comprehension-start');
        // Do not allow typing until the facilitator presses Begin Comprehension
        setCanSend(false);
        setCurrentCompProblem(null);
      } else {
        // Either a re-teach just happened (should end with the gate question), or a clarifying question was asked.
        // Stay in the teaching gate loop.
        setSubPhase('awaiting-gate');
        setCanSend(true);
      }
      return;
    }

    if (phase === 'comprehension') {
      setCanSend(false);
      const nextCount = ticker + 1;
      const progressPhrase = nextCount === 1
        ? `That makes ${nextCount} correct answer.`
        : `That makes ${nextCount} correct answers.`;
      // Build randomized encouragement placement pattern for this turn
      const compPattern = buildCountCuePattern(progressPhrase);
      const nearTarget = (ticker === COMPREHENSION_TARGET - 1);
      const atTarget = (nextCount === COMPREHENSION_TARGET);
    const firstComprehensionTurn = ticker === 0; // include full declaration only on first comprehension judging turn
  // Ensure we have a current problem; if missing, select one now.
  // If the learner hasn't typed an answer yet, ask it; otherwise, judge immediately using the typed answer.
  let problemForThisTurn = currentCompProblem;
  if (!currentCompProblem) {
        // Attempt to pick a first comprehension problem now (same priority as gate path)
        let firstComp = null;
        if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
          let idx = currentCompIndex;
          while (idx < generatedComprehension.length && isShortAnswerItem(generatedComprehension[idx])) idx += 1;
          if (idx < generatedComprehension.length) {
            firstComp = generatedComprehension[idx];
            setCurrentCompIndex(idx + 1);
          }
        }
        if (!firstComp) {
          let tries = 0;
          while (tries < 5) {
            const candidate = drawSampleUnique();
            if (candidate && !isShortAnswerItem(candidate)) { firstComp = candidate; break; }
            tries += 1;
          }
        }
        if (!firstComp && compPool.length) {
          const filtered = compPool.filter(q => !isShortAnswerItem(q));
          if (filtered.length > 0) {
            firstComp = filtered[0];
            setCompPool(compPool.slice(1));
          }
        }

        // Final fallback: rebuild pool on-the-fly from lesson data so we always have a provided item
        if (!firstComp) {
          const refilled = buildQAPool();
          if (Array.isArray(refilled) && refilled.length) {
            firstComp = refilled[0];
            setCompPool(refilled.slice(1));
          }
        }

        if (firstComp) {
          setCurrentCompProblem(firstComp);
          // If no learner input yet, ask the first question now and return; else fall through to judge immediately
          if (!trimmed) {
            const formatted = formatQuestionForSpeech(firstComp);
            const intro = [
              'Comprehension start: Begin with exactly ONE short encouragement sentence.',
              'Immediately after that, ask the following comprehension question exactly as the FINAL sentence (single question sentence ending with a question mark).',
              'Do not add any other sentences after the question.',
              `FIRST_COMPREHENSION_QUESTION: ${formatted}`
            ].join(' ');
            try {
              await callMsSonoma(intro, '', { phase: 'comprehension', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'comprehension-start-ask-first' }, { fastReturn: true });
            } finally {
              // Keep disabled until TTS completes the first question
              setCanSend(false);
            }
            setLearnerInput('');
            return;
          }
          // else: learner has typed an answer already; continue to judging below using the selected firstComp
          problemForThisTurn = firstComp;
        } else {
          // Could not source a question yet; allow retry soon
          setCanSend(true);
          setLearnerInput('');
          return;
        }
      }

  // If we have a provided problem, judge it and provide the exact next one
  if (problemForThisTurn) {
        // Draw next problem if continuing and not near-target using non-repeating deck
        let nextProblem = null;
        if (!nearTarget && !atTarget) {
          if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
            let idx = currentCompIndex;
            while (idx < generatedComprehension.length && isShortAnswerItem(generatedComprehension[idx])) idx += 1;
            if (idx < generatedComprehension.length) {
              nextProblem = generatedComprehension[idx];
              setCurrentCompIndex(idx + 1);
            }
          }
          if (!nextProblem) {
            let tries = 0;
            while (tries < 5) {
              const s = drawSampleUnique();
              if (s && !isShortAnswerItem(s)) { nextProblem = s; break; }
              tries += 1;
            }
          }
          if (!nextProblem && compPool.length) {
            const [head, ...rest] = compPool;
            nextProblem = isShortAnswerItem(head) ? null : head;
            setCompPool(rest);
          }
        }

    // Expand expected answer to include digit/word equivalence for friendliness
  const { primary: expectedPrimary, synonyms: expectedSyns } = expandExpectedAnswer(problemForThisTurn.answer);
  const anyOfC = expectedAnyList(problemForThisTurn);
  let acceptableC = anyOfC && anyOfC.length ? Array.from(new Set(anyOfC.map(String))) : [expectedPrimary, ...expectedSyns];
  // If this is a multiple-choice item, also accept the single-letter selection for the correct option
  // and the underlying option text itself.
  const letterC = letterForAnswer(problemForThisTurn, acceptableC);
  if (letterC) {
    const optText = getOptionTextForLetter(problemForThisTurn, letterC);
    acceptableC = Array.from(new Set([
      ...acceptableC,
      letterC,
      letterC.toLowerCase(),
      ...(optText ? [optText] : [])
    ]));
  }
  const expectedDisplay = acceptableC.length > 1 ? `${expectedPrimary} (also accept: ${acceptableC.filter(v=>v!==expectedPrimary).join(', ')})` : expectedPrimary;
  const currCompDisplay = formatQuestionForSpeech(problemForThisTurn);

        // Per-question judging spec (choose mode based on presence of keywords/min)
        let finalAcceptableC;
        const isShort = (Array.isArray(problemForThisTurn.keywords) && Number.isInteger(problemForThisTurn.minKeywords));
        if (isShort) {
          finalAcceptableC = [];
        } else {
          const anyOfC2 = expectedAnyList(problemForThisTurn);
          finalAcceptableC = anyOfC2 && anyOfC2.length ? Array.from(new Set(anyOfC2.map(String))) : acceptableC;
        }
        const expectedDisplayFinal = isShort ? expectedPrimary : finalAcceptableC[0];
        const gradingInstruction = buildPerQuestionJudgingSpec({
          mode: isShort ? 'short-answer' : 'exact',
          learnerAnswer: trimmed,
          expectedAnswer: expectedDisplayFinal,
          acceptableAnswers: isShort ? [] : finalAcceptableC,
          keywords: isShort ? (problemForThisTurn.keywords || []) : [],
          minKeywords: isShort ? (problemForThisTurn.minKeywords ?? null) : null,
        });

        const judgementInstructionLines = atTarget ? [
          'Comprehension judging (FINAL question):',
          `You asked: "${currCompDisplay}"`,
          `The correct answer is: "${expectedDisplayFinal}"`,
          gradingInstruction,
          'Do NOT read or echo the metadata lines above; they are for your reference only.',
          'JUDGING PROTOCOL:',
          '1) Use the grading instruction above to determine if the answer is correct or incorrect.',
          '2) Start your response with EITHER "Correct!" OR "Not quite right."',
          `3) If CORRECT: Say "Correct!" then say: "${progressPhrase}" then say: "That's all for comprehension. Now let's move on to the exercise."`,
          `4) If INCORRECT: Start with "Not quite right." Then give ONE short non-revealing hint (do NOT say the answer). Then repeat this exact question: "${currCompDisplay}"`
        ] : nearTarget ? [
          'Comprehension judging:',
          `You asked: "${currCompDisplay}"`,
          `The correct answer is: "${expectedDisplayFinal}"`,
          gradingInstruction,
          'Do NOT read or echo the metadata lines above; they are for your reference only.',
          'JUDGING PROTOCOL:',
          '1) Use the grading instruction above to determine if the answer is correct or incorrect.',
          '2) Start your response with EITHER "Correct!" OR "Not quite right."',
          `3) If CORRECT: Say "Correct!" then say: "${progressPhrase}" then STOP.`,
          `4) If INCORRECT: Start with "Not quite right." Then give ONE short non-revealing hint (do NOT say the answer). Then repeat this exact question: "${currCompDisplay}"`
        ] : [
          'Comprehension judging:',
          `You asked: "${currCompDisplay}"`,
          `The correct answer is: "${expectedDisplayFinal}"`,
          gradingInstruction,
          'Do NOT read or echo the metadata lines above; they are for your reference only.',
          'JUDGING PROTOCOL:',
          '1) Use the grading instruction above to determine if the answer is correct or incorrect.',
          '2) Start your response with EITHER "Correct!" OR "Not quite right."',
          `3) If CORRECT: Say "Correct!" then say: "${progressPhrase}"`,
          '4) If CORRECT: After the progress phrase, ask the next question.',
          `5) If INCORRECT: Start with "Not quite right." Then give ONE short non-revealing hint (do NOT say the answer). Then repeat this exact question: "${currCompDisplay}"`
        ];

        // Provide structured section for model clarity
        if (nextProblem && !nearTarget && !atTarget) {
          const formattedNext = formatQuestionForSpeech(nextProblem);
          judgementInstructionLines.push(`NEXT_COMPREHENSION_QUESTION: ${formattedNext}`);
        }

        const comprehensionInstruction = judgementInstructionLines.join(' ');
        const result = await callMsSonoma(
          comprehensionInstruction,
          trimmed,
          { phase: 'comprehension', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, ticker, step: 'comprehension-response', nearTarget, provided: true }
        );
        setLearnerInput('');
        if (result && result.data && result.data.reply) {
          const replyBody = result.data.reply;
          const progressMatch = replyBody.match(/That makes (\d+) correct answer[s]?\./i);
          // Guard against false positives when the model says it's incorrect
          const incorrectHints = /(\bincorrect\b|\bnot\s+quite\s+right\b|\bwrong\b|correct answer is|correct answer was)/i;
          const correctHints = /\bcorrect!/i;
          const incrementOk = progressMatch && correctHints.test(replyBody) && !incorrectHints.test(replyBody);
          if (incrementOk) {
            const reported = parseInt(progressMatch[1], 10);
            if (!Number.isNaN(reported) && reported === ticker + 1) {
              const newVal = reported;
              setTicker(newVal);
              // Advance to next problem only on correct and not nearTarget/atTarget (they handle transitions)
              if (!nearTarget && !atTarget) {
                setCurrentCompProblem(nextProblem || null);
              }
              if (newVal >= COMPREHENSION_TARGET) {
                // Transition to exercise phase but require explicit begin via the button
                setPhase('exercise');
                setSubPhase('exercise-awaiting-begin');
                setExerciseSkippedAwaitBegin(true);
                setTicker(0);
                setCanSend(false);
                setCurrentExerciseProblem(null);
                setCurrentCompProblem(null);
                return;
              }
            }
          }
          // If not incrementing (incorrect), keep the SAME question to repeat
        }
        setCanSend(true);
        return;
      }

      // No generic comprehension judging branch: provided-item judging is required
      setLearnerInput('');
      setCanSend(true);
      return;
    }

    if (phase === 'worksheet') {
      setCanSend(false);
      if (!generatedWorksheet || !generatedWorksheet.length) {
        setLearnerInput('');
        setCanSend(true);
        return;
      }
  const total = generatedWorksheet.length;
  const idx = worksheetIndexRef.current ?? currentWorksheetIndex; // current question index (ref first)
  const qObj = generatedWorksheet[idx];
  const isFinal = idx === total - 1;
      // Build judgement instruction similar to exercise but with distinct cueing & no progress phrase
  const { primary: expectedPrimaryW, synonyms: expectedSynsW } = expandExpectedAnswer(qObj.answer || qObj.expected);
  const anyOfW = expectedAnyList(qObj);
  const acceptableW = anyOfW && anyOfW.length ? Array.from(new Set(anyOfW.map(String))) : [expectedPrimaryW, ...expectedSynsW];
  const expectedDisplayW = acceptableW.length > 1 ? `${expectedPrimaryW} (also accept: ${acceptableW.filter(v=>v!==expectedPrimaryW).join(', ')})` : expectedPrimaryW;
      // Choose the next SEQUENTIAL question (no dedup skipping)
      const nextIndex = idx + 1;
  const hasDistinctNext = (!isFinal && nextIndex < total);
  const nextObj = hasDistinctNext ? generatedWorksheet[nextIndex] : null;
      // Cue phrases used to mark a correct worksheet answer and advance. The FE will look for the exact
      // phrase we inject here. Choose at random each round to reduce repetition.
      const cueVariant = !isFinal
        ? WORKSHEET_CUE_VARIANTS[Math.floor(Math.random() * WORKSHEET_CUE_VARIANTS.length)]
        : '';
  const currDisplay = formatQuestionForSpeech(qObj);
      
      const isShortW = (Array.isArray(qObj.keywords) && Number.isInteger(qObj.minKeywords));
      const rubricInstructionW = buildPerQuestionJudgingSpec({
        mode: isShortW ? 'short-answer' : 'exact',
        learnerAnswer: trimmed,
        expectedAnswer: expectedPrimaryW,
        acceptableAnswers: isShortW ? [] : acceptableW,
        keywords: isShortW ? (qObj.keywords || []) : [],
        minKeywords: isShortW ? (qObj.minKeywords ?? null) : null,
      });

      // Local correctness check to advance immediately without waiting for model cue
      let isCorrectLocal = false;
      try {
        const normAns = (s) => normalizeAnswer(String(s ?? ''));
        if (!isShortW) {
          isCorrectLocal = acceptableW.map(a => normAns(a)).includes(normAns(trimmed));
        } else {
          const kws = Array.isArray(qObj.keywords) ? qObj.keywords.filter(Boolean).map(String) : [];
          const min = Number.isInteger(qObj.minKeywords) ? qObj.minKeywords : 1;
          const learnerN = ` ${normAns(trimmed)} `;
          const hits = new Set();
          for (const kw of kws) {
            const kn = normAns(kw);
            if (!kn) continue;
            const re = new RegExp(`(^|\\s)${kn}(?=\\s|$)`);
            if (re.test(learnerN)) hits.add(kn);
          }
          isCorrectLocal = hits.size >= min;
        }
      } catch {}

  // Do not pre-advance state locally; wait for the model to emit the cue to keep flow aligned.

      const lines = [
        'Worksheet judging (provided):',
        `Question number: ${idx + 1} of ${total}.`,
        `Question asked: "${currDisplay}"`,
        rubricInstructionW,
  '1) Decide if correct briefly (friendly).',
  '2) If incorrect: give ONE short non-revealing hint (do NOT say the answer) + re-ask the SAME worksheet question EXACTLY as originally asked as the final sentence (do not advance numbering). Do NOT say any next-question cue or readiness lines. Do NOT read or reference the NEXT_WORKSHEET_QUESTION.',
      ];
      if (isFinal) {
        lines.push(
          `3) If CORRECT (FINAL question): brief positive reaction, then say: "That's all for the worksheet. Now let's move on to the test." After that: one encouraging sentence (distinct if possible), then a sentence that naturally invites another joke (paraphrasing "How about another joke?"), then tell one short kid-friendly joke, then a reminder sentence to have the facilitator print the test, then final readiness sentence exactly: "Click \"Begin Test\" when you are ready." No sentences after that readiness sentence.`
        );
      } else {
        // For worksheet, correct (not final) output must be exactly three or four sentences:
        // (a) A brief positive reaction (one sentence).
        // (b) The cue phrase sentence verbatim: "${cueVariant}" (one sentence). Do not modify.
        // (c) One short encouragement sentence immediately AFTER the cue (one sentence).
        // (d) Optionally one additional short encouragement sentence (distinct).
        // (e) FINALLY, ask the NEXT worksheet question we supply below as the FINAL sentence; it must end with a question mark.
        // STRICT: The next question must be the LAST sentence. Do NOT add any sentence after it. Stop after the question.
        // Do not include labels; do not speak bracketed tokens.
        lines.push(
          `3) If correct (not final): output in this exact order: reaction → cue → encouragement (→ optional extra encouragement) → NEXT question as the FINAL sentence (stop after it).`
        );
        // Provide the exact cue sentence to speak verbatim as the second sentence
        if (cueVariant) {
          lines.push(`The second sentence must be exactly: "${cueVariant}"`);
        }
        if (hasDistinctNext) {
          lines.push('Only read the NEXT_WORKSHEET_QUESTION below when the answer is CORRECT. If the answer is incorrect, ignore it completely and stay on the current question. Do NOT say any next-question cue or readiness lines when incorrect.');
          lines.push('When the answer is CORRECT, the NEXT_WORKSHEET_QUESTION must be the final sentence. Do not append any words or sentences after it. Stop after the question.');
          // Always provide the literal next sequential question; the assistant must only read it on correct.
          const nextSeq = generatedWorksheet[nextIndex];
          if (nextSeq) {
            const nextWithOptions = ensureQuestionMark(formatQuestionForSpeech(nextSeq));
            lines.push(`NEXT_WORKSHEET_QUESTION: ${nextWithOptions}`);
          }
        }
      }
      // Grading normalization is already specified in rubricInstructionW above; no extra trailing notes.
      const instruction = lines.join(' ');
  const result = await callMsSonoma(instruction, trimmed, { phase: 'worksheet', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'worksheet-judging', index: idx });
      setLearnerInput('');
      if (result && result.data && result.data.reply) {
        const body = result.data.reply;
        // Normalize helper for robust substring checks:
        // - lowercase
        // - strip punctuation and symbols (including ×), keep alphanumerics and spaces
        // - collapse whitespace
        const norm = (s) => (s || '')
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, ' ') // drop punctuation/symbols
          .replace(/\s+/g, ' ')
          .trim();
        const bodyN = norm(body);
        const currQ = formatQuestionForSpeech(qObj);
        const currQN = norm(currQ);
        const reAsk = bodyN.includes(currQN) || bodyN.includes(norm(qObj.prompt));
        const completionPhrase = /worksheet complete\.?/i.test(body);
        // Accept any of the allowed cue phrases in case the model deviates from the single instructed one
        const nextCueDetected = !isFinal && WORKSHEET_CUE_VARIANTS.some(
          (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(body)
        );
        // Note: advancement now depends ONLY on detecting a valid cue phrase.
        // We no longer require the next question to be present or exclude re-asks.
  const nextQ = !isFinal && nextObj ? formatQuestionForSpeech(nextObj) : '';
  const nextQN = norm(nextQ);
  const nextPromptOnlyN = !isFinal && nextObj ? norm(nextObj.prompt || nextObj.question || '') : '';
        if (isFinal && completionPhrase) {
          // Transition to test gating
            setPhase('test');
            setSubPhase('test-awaiting-begin');
            setTicker(0);
            setCanSend(false);
            return;
        }
        // Advance to the next item using a single condition: cue detected.
        if (!isFinal && nextCueDetected) {
          if (hasDistinctNext) {
            const nextBody = formatQuestionForSpeech(generatedWorksheet[nextIndex]);
            captionSentencesRef.current = [`${nextIndex + 1}. ${nextBody}`];
            setCaptionSentences([`${nextIndex + 1}. ${nextBody}`]);
            setCaptionIndex(0);
            setLearnerInput('');
            setCanSend(false);
            worksheetIndexRef.current = nextIndex;
            setCurrentWorksheetIndex(nextIndex);
            setTicker(nextIndex + 1);
          } else {
            setPhase('test');
            setSubPhase('test-awaiting-begin');
            setTicker(0);
            setCanSend(false);
            return;
          }
        }
      }
      setCanSend(true);
      return;
    }

    if (phase === 'test') {
      // Two sub-phases: test-active (silent collection) and test-review (Ms. Sonoma grading)
      if (subPhase === 'test-active') {
        if (!generatedTest || !generatedTest.length) {
          setLearnerInput('');
          return;
        }
        const nextAnswers = [...testUserAnswers];
        nextAnswers[testActiveIndex] = trimmed;
        setTestUserAnswers(nextAnswers);
        const nextIndex = testActiveIndex + 1;
        if (nextIndex < generatedTest.length) {
          // Advance to next question: update caption to that prompt with numbering
          setTestActiveIndex(nextIndex);
          // Build next caption line with inline choices and TF label
          const nextItem = generatedTest[nextIndex];
          const body = formatQuestionForSpeech(nextItem);
          const display = `${nextIndex + 1}. ${body}`;
          captionSentencesRef.current = [display];
          setCaptionSentences([display]);
          setCaptionIndex(0);
          setLearnerInput('');
          return;
        }
        // Completed all answers -> initiate review intro
        setSubPhase('test-review-intro');
        setCanSend(false);
        const reviewIntroInstruction = [
          'Test complete: Congratulate them for finishing the test (1 short sentence).',
          'Then tell them you will review answers together now (1 short sentence).',
          'Do not start grading yet; stop after inviting the review.'
        ].join(' ');
  const res = await callMsSonoma(reviewIntroInstruction, '', { phase: 'test', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'test-review-intro' });
        if (res.success) {
          setTestReviewing(true);
          // Kick off single-call full test review with latest answers to avoid race where last answer not yet committed
          performFullTestReview(nextAnswers);
        } else {
          setCanSend(true);
        }
        setLearnerInput('');
        return;
      }
      setLearnerInput('');
      return;
    }

  if (phase === 'exercise') {
      setCanSend(false);
      const nearTarget = (ticker === EXERCISE_TARGET - 1);
      const atTarget = (ticker + 1 === EXERCISE_TARGET);
      const firstExerciseTurn = ticker === 0;
      const exerciseGuardLine = 'Do NOT mention test, exam, quiz, or answer key.';
      // We should use the provided-question judging path whenever we have a concrete
      // currentExerciseProblem (regardless of where it came from: samples, TF/MC/FIB pools, etc.).
      // Previously this logic incorrectly gated on lessonData.sample presence for non-math lessons,
      // causing the generic branch to run without ACCEPTABLE_ANSWERS or LEARNER_ANSWER context.
      const hasProblem = Boolean(currentExerciseProblem);

      // Build the progress phrase and count-cue pattern once for this turn so it is available
      // in both the provided-question branch and the generic-instruction branch below.
      const progressPhrase = `That makes ${ticker + 1} correct ${ticker + 1 === 1 ? 'answer' : 'answers'}.`;
      const exercisePattern = buildCountCuePattern(progressPhrase);

  if (hasProblem) {
        // Draw next exercise problem if not nearTarget using non-repeating deck
        let nextExerciseProblem = null;
        if (!nearTarget && !atTarget) {
          if (Array.isArray(generatedExercise) && currentExIndex < generatedExercise.length) {
            let idx = currentExIndex;
            while (idx < generatedExercise.length && isShortAnswerItem(generatedExercise[idx])) idx += 1;
            if (idx < generatedExercise.length) {
              nextExerciseProblem = generatedExercise[idx];
              setCurrentExIndex(idx + 1);
            }
          }
          if (!nextExerciseProblem) {
            let tries = 0;
            while (tries < 5 && !nextExerciseProblem) {
              const candidate = drawSampleUnique();
              if (candidate && !isShortAnswerItem(candidate)) { nextExerciseProblem = candidate; break; }
              tries += 1;
            }
          }
          if (!nextExerciseProblem) {
            // pool fallback
            if (exercisePool.length) {
              const [head, ...rest] = exercisePool;
              nextExerciseProblem = isShortAnswerItem(head) ? null : head;
              setExercisePool(rest);
            }
          }
        }

  const { primary: expectedPrimaryEx, synonyms: expectedSynsEx } = expandExpectedAnswer(currentExerciseProblem.answer || currentExerciseProblem.expected);
  const anyOfE = expectedAnyList(currentExerciseProblem);
  let acceptableE = anyOfE && anyOfE.length ? Array.from(new Set(anyOfE.map(String))) : [expectedPrimaryEx, ...expectedSynsEx];
  const letterE = letterForAnswer(currentExerciseProblem, acceptableE);
  if (letterE) {
    const optTextE = getOptionTextForLetter(currentExerciseProblem, letterE);
    acceptableE = Array.from(new Set([
      ...acceptableE,
      letterE,
      letterE.toLowerCase(),
      ...(optTextE ? [optTextE] : [])
    ]));
  }
  const expectedDisplayEx = acceptableE.length > 1 ? `${expectedPrimaryEx} (also accept: ${acceptableE.filter(v=>v!==expectedPrimaryEx).join(', ')})` : expectedPrimaryEx;
  const currExDisplay = formatQuestionForSpeech(currentExerciseProblem);
  
        // Per-question judging spec
        const isShortEx = (Array.isArray(currentExerciseProblem.keywords) && Number.isInteger(currentExerciseProblem.minKeywords));
        const finalAcceptableE = isShortEx
          ? []
          : (() => {
              const anyOfE2 = expectedAnyList(currentExerciseProblem);
              return anyOfE2 && anyOfE2.length ? Array.from(new Set(anyOfE2.map(String))) : acceptableE;
            })();
        const expectedDisplayExFinal = isShortEx ? expectedPrimaryEx : finalAcceptableE[0];
        const gradingInstructionEx = buildPerQuestionJudgingSpec({
          mode: isShortEx ? 'short-answer' : 'exact',
          learnerAnswer: trimmed,
          expectedAnswer: expectedDisplayExFinal,
          acceptableAnswers: isShortEx ? [] : finalAcceptableE,
          keywords: isShortEx ? (currentExerciseProblem.keywords || []) : [],
          minKeywords: isShortEx ? (currentExerciseProblem.minKeywords ?? null) : null,
        });
        
        const judgementLines = atTarget ? [
          'Exercise judging (FINAL):',
          `You asked: "${currExDisplay}"`,
          `The correct answer is: "${expectedDisplayExFinal}"`,
          gradingInstructionEx,
          'Do NOT read or echo the metadata lines above; they are for your reference only.',
          'JUDGING PROTOCOL:',
          '1) Use the grading instruction above to determine if the answer is correct or incorrect.',
          '2) Start your response with EITHER "Correct!" OR "Not quite right."',
          `3) If CORRECT: Say "Correct!" then say: "${progressPhrase}" then say: "That's all for the exercise. Now let's move on to the worksheet." Then quick joke and worksheet instructions.`,
          `4) If INCORRECT: Start with "Not quite right." Then give ONE short non-revealing hint (do NOT say the answer). Then repeat this exact question: "${currExDisplay}"`
        ] : nearTarget ? [
          'Exercise judging:',
          `You asked: "${currExDisplay}"`,
          `The correct answer is: "${expectedDisplayExFinal}"`,
          gradingInstructionEx,
          'Do NOT read or echo the metadata lines above; they are for your reference only.',
          'JUDGING PROTOCOL:',
          '1) Use the grading instruction above to determine if the answer is correct or incorrect.',
          '2) Start your response with EITHER "Correct!" OR "Not quite right."',
          `3) If CORRECT: Say "Correct!" then say: "${progressPhrase}" then STOP.`,
          `4) If INCORRECT: Start with "Not quite right." Then give ONE short non-revealing hint (do NOT say the answer). Then repeat this exact question: "${currExDisplay}"`
        ] : [
          'Exercise judging:',
          `You asked: "${currExDisplay}"`,
          `The correct answer is: "${expectedDisplayExFinal}"`,
          gradingInstructionEx,
          'Do NOT read or echo the metadata lines above; they are for your reference only.',
          'JUDGING PROTOCOL:',
          '1) Use the grading instruction above to determine if the answer is correct or incorrect.',
          '2) Start your response with EITHER "Correct!" OR "Not quite right."',
          `3) If CORRECT: Say "Correct!" then say: "${progressPhrase}"`,
          '4) If CORRECT: After the progress phrase, ask the next question.',
          `5) If INCORRECT: Start with "Not quite right." Then give ONE short non-revealing hint (do NOT say the answer). Then repeat this exact question: "${currExDisplay}"`
        ];
        judgementLines.push(exerciseGuardLine);
        if (!nearTarget && !atTarget && nextExerciseProblem) {
          const formattedNextEx = formatQuestionForSpeech(nextExerciseProblem);
          judgementLines.push(`NEXT_EXERCISE_QUESTION: ${formattedNextEx}`);
        }

        const exerciseInstruction = judgementLines.join(' ');
        const result = await callMsSonoma(
          exerciseInstruction,
          trimmed,
          { phase: 'exercise', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, ticker, step: 'exercise-response', nearTarget, provided: true }
        );
        setLearnerInput('');
        if (result && result.data && result.data.reply) {
          const replyBody = result.data.reply;
          const progressMatch = replyBody.match(/That makes (\d+) correct answer[s]?\./i);
          // Guard: don't increment if the assistant explicitly marked the answer incorrect
          const incorrectHints = /(\bincorrect\b|\bnot\s+quite\s+right\b|\bwrong\b|correct answer is|correct answer was)/i;
          const correctHints = /\bcorrect!/i;
          const incrementOk = progressMatch && correctHints.test(replyBody) && !incorrectHints.test(replyBody);
          if (incrementOk) {
            const reported = parseInt(progressMatch[1], 10);
            if (!Number.isNaN(reported) && reported === ticker + 1) {
              const newVal = reported;
              setTicker(newVal);
              // Advance to next problem only when correct and not nearTarget/atTarget
              if (!nearTarget && !atTarget) {
                setCurrentExerciseProblem(nextExerciseProblem || null);
              }
              if (newVal >= EXERCISE_TARGET) {
                setPhase('worksheet');
                setSubPhase('worksheet-awaiting-begin');
                setTicker(0);
                setCanSend(false);
                setCurrentExerciseProblem(null);
                return;
              }
            }
          }
          // If not incrementing (incorrect), keep SAME question to repeat
        }
        setCanSend(true);
        return;
      }
      // No current exercise problem yet: trigger a first question so the facilitator's Send actually progresses.
      try {
        const exerciseIntro = [
          'Exercise start: Briefly (one friendly sentence) announce we are beginning the exercise practice. No mention of worksheet or test.',
          'Immediately after that, generate ONE appropriate first exercise question for this lesson as the FINAL sentence (single question sentence ending with a question mark, nothing after).'
        ].join(' ');
        await callMsSonoma(
          exerciseIntro,
          '',
          { phase: 'exercise', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'exercise-start-generate-from-send' },
          { fastReturn: true }
        );
      } finally {
        setCanSend(true);
      }
      setLearnerInput('');
      return;
    }

    setLearnerInput('');
  };

  const renderDiscussionControls = () => {
    if (subPhase === "awaiting-learner") {
      return (
        <p style={{ marginBottom: 16 }}>
          Ask the learner to respond to the silly question. When they do, type their reply and press Send.
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

  return (
    <div style={{ width: '100%', height: '100svh', overflow: 'hidden' }}>
  {/* Bounding wrapper: regular flow; inner container handles centering via margin auto */}
  <div style={{ width: '100%', position: 'relative', height: '100%' }}>
    {/* Scroll area sized to the viewport; disable scrolling to keep top cluster fixed */}
  <div style={{ height: '100%', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
    {/* Width-matched wrapper: center by actual scaled width */}
  <div style={{ width: '100%', maxWidth: baseWidth, position: 'relative', margin: '0 auto', boxSizing: 'border-box', paddingBottom: footerHeight }}>
    {/* Content wrapper (no transform scaling) */}
    <div style={{ width: '100%' }}>
      {/* Sticky cluster: title + timeline + video + captions stick under the header without moving into it */}
  <div style={{ position: 'sticky', top: (isMobileLandscape ? 52 : 64), zIndex: 25, background: '#ffffff' }}>
        <div style={{ width: '100%', boxSizing: 'border-box', padding: '0 0 6px', minWidth: 0 }}>
  {(() => {
    // Dynamic portrait title padding:
    // - Mobile landscape: no spacer wrapper style applied (handled elsewhere)
    // - Portrait < 800px width: retain proportional breathing room (2% each side of title area)
    // - Portrait >= 800px width: collapse to a near-zero fixed padding for tighter layout
    let spacerStyle = undefined;
    if (!isMobileLandscape) {
      const vw = (typeof window !== 'undefined') ? window.innerWidth : null;
      if (vw != null && vw >= 800) {
        spacerStyle = { paddingTop: 4, paddingBottom: 4 };
      } else {
        spacerStyle = { paddingTop: '2%', paddingBottom: '2%' };
      }
    }
    return (
      <div className="portrait-title-spacer" style={spacerStyle}>
        {!isMobileLandscape && (
          <h1 style={{ textAlign: "center", marginTop: 0, marginBottom: 8 }}>
            {(lessonData && (lessonData.title || lessonData.lessonTitle)) || manifestInfo.title}
          </h1>
        )}
      </div>
    );
  })()}
  {/** Clickable timeline jump logic */}
  {(() => {
    const handleJumpPhase = (target) => {
      // Jump directly to a major phase emulating skip button side-effects
      // This centralizes transitional resets so timeline navigation = skip navigation.
      try { abortAllActivity(); } catch {}
      setLoading(false); // allow overlays/buttons to show immediately

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
        setPhase('test');
        setSubPhase('test-awaiting-begin');
        setShowBegin(false);
        setCanSend(false);
        setTicker(0);
      };

      switch (target) {
        case 'discussion':
          goDiscussion();
          break;
        case 'comprehension':
          goComprehension();
          break;
        case 'exercise':
          goExercise();
          break;
        case 'worksheet':
          goWorksheet();
          break;
        case 'test':
          goTest();
          break;
        default:
          break;
      }
    };
    return (
      <div style={{ position: 'relative', zIndex: 9999 }}>
        <Timeline timelinePhases={timelinePhases} timelineHighlight={timelineHighlight} compact={isMobileLandscape} onJumpPhase={handleJumpPhase} />
      </div>
    );
  })()}

  {/* Video + captions: stack normally; side-by-side on mobile landscape */}
  <div style={isMobileLandscape ? { display:'flex', alignItems:'stretch', width:'100%', paddingBottom:4 } : {}}>
    <div ref={videoColRef} style={isMobileLandscape ? { flex:'0 0 50%', display:'flex', flexDirection:'column', minWidth:0 } : {}}>
      <VideoPanel
        isMobileLandscape={isMobileLandscape}
        videoMaxHeight={videoMaxHeight}
        videoRef={videoRef}
        showBegin={showBegin}
        isSpeaking={isSpeaking}
        onBegin={beginSession}
        onBeginComprehension={beginComprehensionPhase}
        onBeginWorksheet={beginWorksheetPhase}
        onBeginTest={beginTestPhase}
        onBeginSkippedExercise={beginSkippedExercise}
        onPrev={skipBackwardPhase}
        onNext={skipForwardPhase}
        phase={phase}
        subPhase={subPhase}
        ticker={ticker}
        testCorrectCount={testCorrectCount}
        testFinalPercent={testFinalPercent}
        lessonParam={lessonParam}
        muted={muted}
        userPaused={userPaused}
        onToggleMute={toggleMute}
        onTogglePlayPause={togglePlayPause}
        loading={loading}
        exerciseSkippedAwaitBegin={exerciseSkippedAwaitBegin}
        skipPendingLessonLoad={skipPendingLessonLoad}
        currentCompProblem={currentCompProblem}
        needsAudioUnlock={needsAudioUnlock}
        onUnlockAudio={unlockAudioPlayback}
        onCompleteLesson={() => {
          const key = getAssessmentStorageKey();
          if (key) { try { clearAssessments(key); } catch { /* ignore */ } }
          setShowBegin(true);
          setPhase('discussion');
          setSubPhase('greeting');
          setCanSend(false);
          setGeneratedWorksheet(null);
          setGeneratedTest(null);
          setCurrentWorksheetIndex(0);
          worksheetIndexRef.current = 0;
          if (typeof window !== 'undefined') {
            window.location.href = '/learn/lessons';
          }
        }}
      />
    </div>
  <div ref={captionColRef} style={isMobileLandscape ? { flex:'0 0 50%', minWidth:0, display:'flex', height: sideBySideHeight ? sideBySideHeight : 'auto' } : (stackedCaptionHeight ? { maxHeight: stackedCaptionHeight, height: stackedCaptionHeight, overflowY:'hidden', marginTop:8 } : {})}>
      <CaptionPanel
        sentences={captionSentences}
        activeIndex={captionIndex}
        boxRef={captionBoxRef}
        scaleFactor={snappedScale}
        compact={isMobileLandscape}
        fullHeight={isMobileLandscape && !!sideBySideHeight}
        stackedHeight={(!isMobileLandscape && stackedCaptionHeight) ? stackedCaptionHeight : null}
      />
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
        <div style={{ margin: '0 auto', width: '100%', maxWidth: baseWidth, boxSizing: 'border-box', padding: isMobileLandscape ? '6px 0 calc(6px + env(safe-area-inset-bottom, 0px))' : '10px 0 calc(10px + env(safe-area-inset-bottom, 0px))' }}>
          <InputPanel
            learnerInput={learnerInput}
            setLearnerInput={setLearnerInput}
            sendDisabled={sendDisabled}
            canSend={canSend}
            loading={loading}
            abortKey={abortKey}
            needsAudioUnlock={needsAudioUnlock}
            showBegin={showBegin}
            isSpeaking={isSpeaking}
            phase={phase}
            subPhase={subPhase}
            currentCompProblem={currentCompProblem}
            tipOverride={tipOverride}
            onSend={handleSend}
            compact={isMobileLandscape}
          />
        </div>
      </div>

      {/* Intentionally nothing rendered below the fixed footer */}
      <style jsx global>{`
        .scrollbar-hidden { -ms-overflow-style: none; scrollbar-width: none; }
        .scrollbar-hidden::-webkit-scrollbar { display: none; }
        /* Global spinner + animation (used in VideoPanel overlay) */
        @keyframes msSpinFade { 0% { transform: rotate(0deg); opacity:1; } 50% { transform: rotate(180deg); opacity:0.55; } 100% { transform: rotate(360deg); opacity:1; } }
        .ms-spinner { position: relative; box-sizing: border-box; width:72px; height:72px; border:7px solid rgba(255,255,255,0.25); border-top-color:#ffffff; border-radius:50%; animation: msSpinFade 0.85s linear infinite; filter: drop-shadow(0 4px 12px rgba(0,0,0,0.45)); }
  .ms-spinner::after { content:""; position:absolute; inset:12px; border:4px solid transparent; border-top-color:#c7442e; border-radius:50%; animation: msSpinFade 1.4s linear infinite reverse; }
      `}</style>
        {/* Close outer viewport container */}
      </div>
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
  const [labelFontSize, setLabelFontSize] = useState(16);

  // Compute a shared font size so the longest label fits within a single column
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const BASE = 16; // px
    const MIN = 12;  // px - keep readable on small screens
    const MAX = 16;  // px - do not upscale above base
    const PADDING_X = 18 * 2 + 4; // left+right padding plus a little slack for borders

    const labels = (Array.isArray(timelinePhases) ? timelinePhases : []).map(k => String(phaseLabels[k] || ''));
    if (!labels.length) return;

    const compute = () => {
      const totalWidth = el.clientWidth || 0;
      if (totalWidth <= 0) { setLabelFontSize(BASE); return; }
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

      if (maxLabelWidth <= 0 || available <= 0) { setLabelFontSize(BASE); return; }
      const scale = Math.min(1, available / maxLabelWidth);
      const next = Math.max(MIN, Math.min(MAX, Math.floor(BASE * scale)));
      setLabelFontSize(next);
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
  <div ref={containerRef} style={{ display: "grid", gridTemplateColumns, gap: 6, marginBottom: compact ? 4 : 8, width: '100%', minWidth: 0, position: 'relative', zIndex: 9999, padding: 4, boxSizing: 'border-box' }}>
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
            padding: compact ? "4px 10px" : "8px 18px",
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

function VideoPanel({ isMobileLandscape, videoMaxHeight, videoRef, showBegin, isSpeaking, onBegin, onBeginComprehension, onBeginWorksheet, onBeginTest, onBeginSkippedExercise, onPrev, onNext, phase, subPhase, ticker, testCorrectCount, testFinalPercent, lessonParam, muted, userPaused, onToggleMute, onTogglePlayPause, loading, exerciseSkippedAwaitBegin, skipPendingLessonLoad, currentCompProblem, onCompleteLesson, needsAudioUnlock, onUnlockAudio }) {
  // Reduce horizontal max width in mobile landscape to shrink vertical footprint (height scales with width via aspect ratio)
  const containerMaxWidth = isMobileLandscape ? 'clamp(300px, 52vw, 520px)' : 1000;
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
  // Determine if we are sitting at a phase-begin state where a Begin button is displayed.
  // In these states playing/pausing the ambient video causes issues, so we disable the control entirely.
  const atPhaseBegin = (
    (phase === 'discussion' && showBegin) ||
    (phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin') ||
    (phase === 'test' && subPhase === 'test-awaiting-begin') ||
    (phase === 'comprehension' && subPhase === 'comprehension-start' && !currentCompProblem) ||
    (phase === 'exercise' && subPhase === 'exercise-awaiting-begin')
  );
  // Portrait refinement: instead of padding the outer wrapper, shrink the video width a bit so
  // the empty space on each side is symmetrical and the video remains visually centered.
  // We choose a slight shrink (e.g. 92%) to create subtle gutters. Landscape keeps full width.
  const outerWrapperStyle = { position: 'relative', margin: '0 auto', maxWidth: containerMaxWidth, width: '100%' };
  const innerVideoWrapperStyle = isMobileLandscape
    ? { position: 'relative', overflow: 'hidden', aspectRatio: '16 / 7.2', minHeight: 200, width: '100%', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000', '--ctrlSize': 'clamp(34px, 6.2vw, 52px)', ...dynamicHeightStyle }
    : { position: 'relative', overflow: 'hidden', aspectRatio: '16 / 7.2', minHeight: 200, width: '92%', margin: '0 auto', borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.12)', background: '#000', '--ctrlSize': 'clamp(34px, 6.2vw, 52px)', ...dynamicHeightStyle };
  return (
    <div style={outerWrapperStyle}>
      <div style={innerVideoWrapperStyle}>
        <video
          ref={videoRef}
          src="/media/ms-sonoma-3.mp4"
          muted={muted}
          loop
          playsInline
          preload="auto"
          onLoadedMetadata={() => {
            try {
              // Ensure the first frame is visible on load without auto-playing
              if (videoRef.current) {
                try { videoRef.current.currentTime = 0; } catch {}
                try { videoRef.current.pause(); } catch {}
              }
            } catch {}
          }}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', opacity: phase === 'test' && subPhase === 'test-active' ? 0 : 1, transition: 'opacity 250ms ease' }}
        />
        {phase === 'test' && subPhase === 'test-active' && (
          <div style={{ position: 'absolute', inset: 0, background: '#000', color: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.3, maxWidth: 1000 }}>
              <span />
            </div>
          </div>
        )}
        {(phase === 'comprehension' || phase === 'exercise') && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(17,24,39,0.78)', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: 14, fontWeight: 600, letterSpacing: 0.3, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>
            {ticker} correct
          </div>
        )}
        {(phase === 'worksheet' && subPhase === 'worksheet-active') || (phase === 'test' && subPhase === 'test-active') ? (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 32px', pointerEvents: 'none', textAlign: 'center' }}>
            <div style={{ fontSize: 'clamp(28px, 4.2vw, 52px)', fontWeight: 800, lineHeight: 1.18, color: '#ffffff', textShadow: '0 0 4px rgba(0,0,0,0.9), 0 2px 6px rgba(0,0,0,0.85), 0 4px 22px rgba(0,0,0,0.65)', letterSpacing: 0.5, fontFamily: 'Inter, system-ui, sans-serif', width: '100%' }}>
              <CurrentAssessmentPrompt phase={phase} subPhase={subPhase} />
            </div>
          </div>
        ) : null}
        {((phase === 'congrats') || (phase === 'test' && subPhase === 'test-review-finished')) && typeof testFinalPercent === 'number' && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(17,24,39,0.85)', color: '#fff', padding: '10px 14px', borderRadius: 10, fontSize: 18, fontWeight: 700, letterSpacing: 0.4, boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>Score: {testFinalPercent}%</div>
        )}
        {phase === 'worksheet' && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(17,24,39,0.78)', color: '#fff', padding: '6px 10px', borderRadius: 8, fontSize: 14, fontWeight: 600, letterSpacing: 0.3, boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}>Number {ticker}</div>
        )}
        {loading && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, zIndex: 5, pointerEvents: 'none', background: 'rgba(0,0,0,0.38)', padding: '42px 48px', borderRadius: 160, backdropFilter: 'blur(2px)', boxShadow: '0 6px 28px rgba(0,0,0,0.45)' }}>
            <div className="ms-spinner" role="status" aria-label="Loading" />
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 600, letterSpacing: 0.5, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Loading...</div>
          </div>
        )}
        {showBegin && phase === 'discussion' && (
          <button type="button" onClick={onBegin} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#c7442e', color: '#fff', borderRadius: 16, padding: '16px 40px', fontWeight: 700, fontSize: 22, border: 'none', boxShadow: '0 2px 16px rgba(199,68,46,0.18)', cursor: 'pointer', zIndex: 6 }}>Begin</button>
        )}
        {/* iOS/Safari audio unlock prompt */}
        {needsAudioUnlock && (
          <button
            type="button"
            onClick={onUnlockAudio}
            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#1f2937', color: '#fff', borderRadius: 14, padding: '14px 26px', fontWeight: 800, fontSize: 18, border: 'none', boxShadow: '0 2px 14px rgba(0,0,0,0.35)', cursor: 'pointer', zIndex: 7 }}
          >
            Tap to enable sound
          </button>
        )}
        {phase === 'congrats' && !loading && (
          <button type="button" onClick={onCompleteLesson} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#c7442e', color: '#fff', borderRadius: 16, padding: '18px 46px', fontWeight: 800, fontSize: 26, letterSpacing: 0.5, border: 'none', boxShadow: '0 4px 20px rgba(199,68,46,0.35)', cursor: 'pointer', zIndex: 4, textShadow: '0 2px 4px rgba(0,0,0,0.35)' }}>Complete Lesson</button>
        )}
        {phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin' && (
          <button type="button" onClick={onBeginWorksheet} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#c7442e', color: '#fff', borderRadius: 16, padding: '16px 40px', fontWeight: 700, fontSize: 22, border: 'none', boxShadow: '0 2px 16px rgba(199,68,46,0.18)', cursor: 'pointer', zIndex: 6 }}>Begin Worksheet</button>
        )}
        {phase === 'test' && subPhase === 'test-awaiting-begin' && (
          <button type="button" onClick={onBeginTest} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#c7442e', color: '#fff', borderRadius: 16, padding: '16px 40px', fontWeight: 700, fontSize: 22, border: 'none', boxShadow: '0 2px 16px rgba(199,68,46,0.18)', cursor: 'pointer', zIndex: 6 }}>Begin Test</button>
        )}
        {phase === 'comprehension' && subPhase === 'comprehension-start' && !currentCompProblem && (
          <button type="button" onClick={onBeginComprehension} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#c7442e', color: '#fff', borderRadius: 16, padding: '16px 40px', fontWeight: 700, fontSize: 22, border: 'none', boxShadow: '0 2px 16px rgba(199,68,46,0.18)', cursor: 'pointer', zIndex: 6 }}>Begin Comprehension</button>
        )}
        {phase === 'exercise' && subPhase === 'exercise-awaiting-begin' && (
          <button type="button" onClick={onBeginSkippedExercise} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#c7442e', color: '#fff', borderRadius: 16, padding: '16px 40px', fontWeight: 700, fontSize: 22, border: 'none', boxShadow: '0 2px 16px rgba(199,68,46,0.18)', cursor: 'pointer', zIndex: 6 }}>Begin Exercise</button>
        )}
  {/* Primary control cluster (play/pause + mute) */}
  <div style={controlClusterStyle}>
          <button
            type="button"
            onClick={atPhaseBegin ? undefined : onTogglePlayPause}
            aria-label={userPaused ? 'Play' : 'Pause'}
            disabled={atPhaseBegin}
            title={atPhaseBegin ? 'Press Begin first' : (userPaused ? 'Play' : 'Pause')}
            style={{
              ...controlButtonBase,
              cursor: atPhaseBegin ? 'not-allowed' : 'pointer',
              opacity: atPhaseBegin ? 0.4 : 1
            }}
          >
            {userPaused ? (
              <svg style={{ width: '55%', height: '55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg style={{ width: '55%', height: '55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            )}
          </button>
          <button type="button" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'} style={controlButtonBase}>
            {muted ? (
              <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6" /><path d="M17 9l6 6" /></svg>
            ) : (
              <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19 8a5 5 0 010 8" /><path d="M15 11a2 2 0 010 2" /></svg>
            )}
          </button>
        </div>
        {/* Paired skip controls at bottom-left */}
        {(phase !== 'congrats') && (onPrev || onNext) && (
          /* Mirror cluster: same bottom & edge offset (16) and same internal gap (12) to create symmetry */
          <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 12 }}>
            {onPrev && (
              <button
                type="button"
                onClick={phase === 'discussion' ? undefined : onPrev}
                aria-label="Previous"
                title="Previous"
                disabled={phase === 'discussion'}
                style={{ ...controlButtonBase, cursor: phase === 'discussion' ? 'not-allowed' : 'pointer', opacity: phase === 'discussion' ? 0.4 : 1 }}
              >
                <svg style={{ width: '55%', height: '55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            )}
            {onNext && (
              <button
                type="button"
                onClick={phase === 'test' ? undefined : onNext}
                aria-label="Next"
                title="Next"
                disabled={phase === 'test'}
                style={{ ...controlButtonBase, cursor: phase === 'test' ? 'not-allowed' : 'pointer', opacity: phase === 'test' ? 0.4 : 1 }}
              >
                <svg style={{ width: '55%', height: '55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            )}
          </div>
        )}
        {skipPendingLessonLoad && (
          <div style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(31,41,55,0.85)', color: '#fff', padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, letterSpacing: 0.4, boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}>Loading lesson… skip will apply</div>
        )}
      </div>
    </div>
  );
}

// Helper component to extract current assessment question from global caption state via context-less DOM fallback
function CurrentAssessmentPrompt({ phase, subPhase }) {
  // We will attempt to read window.__MS_CAPTIONS if exposed else fallback to scanning caption container.
  const [prompt, setPrompt] = useState('');
  useEffect(() => {
    const extract = () => {
      try {
        // Direct global if maintained
        if (window.__MS_CAPTION_SENTENCES && Array.isArray(window.__MS_CAPTION_SENTENCES)) {
          if (phase === 'test' && subPhase === 'test-active') {
            return window.__MS_CAPTION_SENTENCES[0] || '';
          }
          if (phase === 'worksheet' && subPhase === 'worksheet-active') {
            return window.__MS_CAPTION_SENTENCES[window.__MS_CAPTION_SENTENCES.length - 1] || '';
          }
        }
        // Fallback: query caption panel paragraphs
        const panel = document.querySelector('[data-ms-caption-panel]');
        if (panel) {
          const parts = Array.from(panel.querySelectorAll('p')).map(p => p.textContent.trim()).filter(Boolean);
          if (phase === 'test' && subPhase === 'test-active') return parts[0] || '';
          if (phase === 'worksheet' && subPhase === 'worksheet-active') return parts[parts.length - 1] || '';
        }
      } catch {}
      return '';
    };
    setPrompt(extract());
    const id = setInterval(() => setPrompt(extract()), 400); // lightweight poll to keep in sync
    return () => clearInterval(id);
  }, [phase, subPhase]);
  return prompt ? <span>{prompt}</span> : null;
}

function InputPanel({ learnerInput, setLearnerInput, sendDisabled, canSend, loading, onSend, showBegin, isSpeaking, phase, subPhase, tipOverride, abortKey, currentCompProblem, needsAudioUnlock, compact = false }) {
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

  // Global hotkey: Hold Numpad Plus to record (keydown starts, keyup stops)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code !== 'NumpadAdd') return;
      // Prevent text input of '+' when we handle it
      e.preventDefault();
      if (hotkeyDownRef.current) return; // ignore auto-repeat
      hotkeyDownRef.current = true;
      if (!sendDisabled && !isRecording && !uploading) {
        startRecording();
      }
    };
    const onKeyUp = (e) => {
      if (e.code !== 'NumpadAdd') return;
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
  }, [isRecording, uploading, sendDisabled, startRecording, stopRecording]);

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
  // Auto-focus when the field becomes available for input
  useEffect(() => {
    if (canSend && inputRef.current) {
      try {
        inputRef.current.focus();
        // Move cursor to end (in case residual text restored in future flows)
        const len = inputRef.current.value.length;
        inputRef.current.setSelectionRange(len, len);
      } catch {/* ignore focus errors */}
    }
  }, [canSend]);
  const computePlaceholder = () => {
    if (needsAudioUnlock) return 'Press "Tap to enable sound"';
    if (tipOverride) return tipOverride;
    if (showBegin) return 'Press "Begin"';
    if (phase === 'congrats') return 'Press "Complete Lesson"';
    if (loading) return 'loading...';
    if (isSpeaking) return 'Ms. Sonoma is talking...';
    // During Comprehension: lock input and guide clearly
    if (phase === 'comprehension') {
      if (subPhase === 'comprehension-start' && !currentCompProblem) return 'Press "Begin Comprehension"';
    }
  if (phase === 'exercise' && subPhase === 'exercise-awaiting-begin') return 'Press "Begin Exercise"';
  if (phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin') return 'Press "Begin Worksheet"';
    if (phase === 'test' && subPhase === 'test-awaiting-begin') return 'Press "Begin Test"';
    // Show guidance any time input is actionable (buttons full color => not disabled)
    if (!sendDisabled) return 'Type your answer...';
    return '';
  };
  return (
  <div style={{ display: "flex", alignItems: "center", gap: (typeof compact !== 'undefined' && compact) ? 6 : 8, marginBottom: (typeof compact !== 'undefined' && compact) ? 2 : 12, width: '100%', maxWidth: '100%', marginLeft: 'auto', marginRight: 'auto', boxSizing: 'border-box', paddingLeft: (typeof compact !== 'undefined' && compact) ? 8 : 12, paddingRight: (typeof compact !== 'undefined' && compact) ? 8 : 12 }}>
      <button
        style={{
          background: (sendDisabled || needsAudioUnlock) ? "#4b5563" : '#c7442e',
          color: "#fff",
          borderRadius: 8,
          padding: (typeof compact !== 'undefined' && compact) ? "6px 10px" : "8px 12px",
          fontWeight: 600,
          border: "none",
          cursor: (sendDisabled || needsAudioUnlock) ? "not-allowed" : "pointer",
          opacity: (sendDisabled || needsAudioUnlock) ? 0.7 : 1,
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
        disabled={sendDisabled || needsAudioUnlock}
        onContextMenu={(e) => { e.preventDefault(); }}
        onDragStart={(e) => { e.preventDefault(); }}
        onTouchStart={(e) => {
          // Use hold-to-record on touch devices; prevent synthetic click
          e.preventDefault();
          if (sendDisabled || needsAudioUnlock) return;
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
          if (sendDisabled || needsAudioUnlock) return;
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
            title={isRecording ? 'Release Numpad + to stop' : 'Hold Numpad + to talk'}
        value={learnerInput}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(event) => setLearnerInput(event.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (!sendDisabled && !needsAudioUnlock) {
              handleSend();
            }
          }
        }}
        placeholder={computePlaceholder()}
        disabled={sendDisabled || needsAudioUnlock}
        style={{
          flex: 1,
          padding: "10px",
          borderRadius: 6,
          border: "1px solid #bdbdbd",
          fontSize: 16,
          background: (!sendDisabled && !needsAudioUnlock) ? "#fff" : "#f3f4f6",
          color: (!sendDisabled && !needsAudioUnlock) ? "#111827" : "#9ca3af",
          transition: 'background 0.2s, color 0.2s',
          ...(loading ? { animation: 'flashInputPlaceholder 0.85s ease-in-out infinite' } : {})
        }}
      />
      <button
        style={{
          background: (sendDisabled || needsAudioUnlock) ? "#4b5563" : "#c7442e",
          color: "#fff",
          borderRadius: 8,
          padding: (typeof compact !== 'undefined' && compact) ? "6px 10px" : "8px 12px",
          fontWeight: 600,
          border: "none",
          cursor: (sendDisabled || needsAudioUnlock) ? "not-allowed" : "pointer",
          opacity: (sendDisabled || needsAudioUnlock) ? 0.7 : 1,
          transition: "background 0.2s, opacity 0.2s",
        }}
        aria-label="Send response"
        disabled={sendDisabled || needsAudioUnlock}
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
  <div style={{ position:'absolute', bottom:-18, left:4, fontSize:11, color:'#c7442e' }}>{errorMsg}</div>
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

function CaptionPanel({ sentences, activeIndex, boxRef, scaleFactor = 1, compact = false, fullHeight = false, stackedHeight = null }) {
  const [canScroll, setCanScroll] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);

  // Detect overflow & scroll position
  const recomputeScrollState = useCallback(() => {
    if (!boxRef?.current) return;
    const el = boxRef.current;
    const overflow = el.scrollHeight > el.clientHeight + 4; // tolerance
    setCanScroll(overflow);
    setAtTop(el.scrollTop <= 4);
    setAtBottom(el.scrollTop >= el.scrollHeight - el.clientHeight - 4);
  }, [boxRef]);

  useEffect(() => {
    recomputeScrollState();
  }, [sentences, stackedHeight, fullHeight, compact, recomputeScrollState]);

  useEffect(() => {
    if (!boxRef?.current) return;
    const el = boxRef.current;
    const handler = () => recomputeScrollState();
    el.addEventListener('scroll', handler, { passive: true });
    const resizeObs = new ResizeObserver(handler);
    resizeObs.observe(el);
    return () => {
      el.removeEventListener('scroll', handler);
      resizeObs.disconnect();
    };
  }, [boxRef, recomputeScrollState]);

  useEffect(() => {
    if (!boxRef?.current) return;
    const el = boxRef.current.querySelector(`[data-idx="${activeIndex}"]`);
    if (!el) return;
    const container = boxRef.current;
    const marginTop = 8;
    const marginBottom = 24;
    const scale = Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
    const elementTop = el.offsetTop - marginTop;
    const elementBottom = el.offsetTop + el.offsetHeight + marginBottom;
    const viewTop = container.scrollTop;
    const viewBottom = viewTop + container.clientHeight;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    const isLast = activeIndex >= (Array.isArray(sentences) ? sentences.length - 1 : -1);
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
  }, [activeIndex, sentences, scaleFactor, boxRef]);

  const panelStyle = {
    width: '100%',
    boxSizing: 'border-box',
    paddingTop: compact ? 6 : 12,
    paddingRight: 12,
    paddingBottom: compact ? 6 : 12,
    paddingLeft: 12,
  background: '#ffffff',
  color: '#111111',
  borderRadius: 14,
  fontSize: 18,
  lineHeight: 1.5,
    maxHeight: fullHeight ? '100%' : (stackedHeight ? stackedHeight : (compact ? '14vh' : '18vh')),
    height: fullHeight ? '100%' : (stackedHeight ? stackedHeight : 'auto'),
    overflowY: 'auto',
    position: 'relative',
    boxShadow: '0 4px 12px rgba(0,0,0,0.25)'
  };

  return (
    <div ref={boxRef} className="scrollbar-hidden" style={panelStyle} aria-live="polite">
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
            fontSize: 18,
            lineHeight: '34px',
            cursor: atTop ? 'default' : 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
            opacity: atTop ? 0.6 : 1,
          }}
        >▲</button>
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
            fontSize: 18,
            lineHeight: '34px',
            cursor: atBottom ? 'default' : 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
            opacity: atBottom ? 0.6 : 1,
          }}
        >▼</button>
      </div>
      {(!sentences || sentences.length === 0) && (
        <div style={{ color: '#6b7280' }}>Captions will appear here.</div>
      )}
      {sentences && sentences.length > 0 && (
        <p style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 18, lineHeight: 1.5, color: '#111111', paddingRight: '5%' }}>
          {sentences.map((s, i) => {
            const isObj = s && typeof s === 'object';
            const text = isObj ? (s.text ?? '') : String(s ?? '');
            const isUser = isObj && s.role === 'user';
            const isNewline = !isObj && text === '\n';
            if (isNewline) return <span key={`br-${i}`}><br /></span>;
            return (
              <span
                key={`${i}-${text.slice(0,12)}`}
                data-idx={i}
                style={{
                  background: i === activeIndex ? 'rgba(199,68,46,0.22)' : 'transparent',
                  borderRadius: 4,
                  transition: 'background 140ms ease, box-shadow 140ms ease, color 140ms ease',
                  color: isUser ? '#c7442e' : undefined,
                  fontWeight: (isUser || i === activeIndex) ? 600 : undefined,
                  boxShadow: i === activeIndex ? 'inset 3px 0 0 0 #c7442e, 0 0 0 1px rgba(199,68,46,0.25)' : undefined,
                  padding: i === activeIndex ? '0 2px 0 4px' : undefined,
                  scrollMarginTop: 16,
                }}
              >
                {text}{i < sentences.length - 1 ? ' ' : ''}
              </span>
            );
          })}
        </p>
      )}
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
                const result = await callMsSonoma(
                  "Test: Black screen, overlay questions, grade after all answers, no hints or rephrasing.",
                  learnerInput,
                    {
                    phase: "test",
                    subject: subjectParam,
                    difficulty: difficultyParam,
                    lesson: lessonParam,
                  lessonTitle: effectiveLessonTitle,
                    ticker: nextTicker,
                  }
                );
                setLearnerInput("");
                if (result.success && nextTicker >= TEST_TARGET) {
                  setPhase("grading");
                  setSubPhase("grading-start");
                  setCanSend(false);
                  await waitForBeat(320);
                  setPhase("congrats");
                }
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
      case "congrats":
        return (
          <div style={{ marginBottom: 24 }}>
            <h2>Congratulations!</h2>
            <p>{transcript}</p>
            <button
              type="button"
              style={primaryButtonStyle}
              onClick={() => {
                const key = getAssessmentStorageKey();
                if (key) { try { clearAssessments(key); } catch {} }
                // Reset to allow a fresh session (new randomized sets next time Begin clicked)
                setShowBegin(true);
                setPhase('discussion');
                setSubPhase('greeting');
                // Keep input disabled until Begin is pressed
                setCanSend(false);
                setGeneratedWorksheet(null);
                setGeneratedTest(null);
                setCurrentWorksheetIndex(0);
              }}
            >
              Complete Lesson
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return renderSection();
}






// End of PhaseDetail component













