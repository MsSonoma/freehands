"use client";

export const dynamic = 'force-dynamic';

import { useState, useRef, useEffect, useMemo, useCallback, Suspense } from "react";
import { ensurePinAllowed } from "../lib/pinGate";
import { getHotkeysLocal, fetchHotkeysServer, DEFAULT_HOTKEYS, isTextEntryTarget } from "../lib/hotkeys";
import { useRouter, useSearchParams } from "next/navigation";
import { jsPDF } from "jspdf";
import { loadRuntimeVariables } from "../lib/runtimeVariables";
import { getSupabaseClient } from "../lib/supabaseClient";
import { appendTranscriptSegment } from "../lib/transcriptsClient";
import { getLearner } from "@/app/facilitator/learners/clientApi";
// SpinnerScreen removed here; reverting to in-panel overlay spinner
import { generateOpening } from "../lib/opening";
import { pickNextJoke, renderJoke } from "../lib/jokes";
const { COMPREHENSION_INTROS, EXERCISE_INTROS, WORKSHEET_INTROS, TEST_INTROS } = require('./constants/phaseIntros.js');
import { pickRandomRiddle } from "../lib/riddles";
import { getStoredAssessments, saveAssessments, clearAssessments } from './assessment/assessmentStore';
import { upsertMedal, emojiForTier, tierForPercent } from '@/app/lib/medalsClient';

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
function buildSystemMessage({ lessonTitle = "", teachingNotes = "", vocab = [], gatePhrase = "", stage = "" } = {}) {
  const scopeSource = teachingNotes && teachingNotes.trim() ? "teachingNotes" : "lessonTitle";
  const scopeText = scopeSource === "teachingNotes" ? teachingNotes.trim() : lessonTitle.trim();

  // Prepare vocab content ONLY for the definitions stage. Accept [{term,definition}, ...] or ["word", ...].
  let vocabContent;
  const includeVocab = (stage === 'definitions');
  if (includeVocab && Array.isArray(vocab) && vocab.length > 0) {
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
    // Omit vocab entirely for non-definitions or when none provided
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
    "Include provided vocab only during the teaching segment.",
    `Lesson background (do not read aloud): ${scopeText}`,
    vocabContent,
    GUARD_INSTRUCTION,
    KID_FRIENDLY_STYLE,
    NORMALIZATION_NOTE,
    // compact gate rule
    gatePhraseLine,
    // Stage-aware: omit rigid teaching-structure text to avoid redundancy
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
    key: 'greeting',
    instruction: "Greeting: Say the learner's name with a hello phrase and name the lesson. Do not ask any questions and do not invite a response. Keep it to 1–2 sentences max.",
    next: 'encouragement',
    label: 'Next: Encouragement',
  },
  {
    key: 'encouragement',
    instruction: 'Encourage: Say a positive and reassuring statement. Do not ask any questions and do not invite a response. Keep it to a single sentence.',
    next: 'joke',
    label: 'Next: Joke',
  },
  {
    key: 'joke',
    instruction: "Joke: Begin with either 'Wanna hear a joke?' or 'Let's start with a joke.' Then tell one short, kid-friendly joke related to the subject. Keep total to 1–2 sentences.",
    next: 'silly-question',
    label: 'Next: Silly Question',
  },
  {
    key: 'silly-question',
    instruction: 'Silly question: Ask one playful, silly question as the final sentence.',
    next: 'awaiting-learner',
    label: 'Wait for learner reply',
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
        `Teaching Part 3/3: This lesson is strictly "${lessonTitle}". Summarize the exact steps for the specific lessonTitle (from Session JSON), remind them about any simple tools or notes, and close with a concise wrap (no questions). Do not ask them to solve anything. Do not mention the worksheet or test. ${KID_FRIENDLY_STYLE}`,
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
  if (!text) return [];
  try {
    const lines = String(text).split(/\n+/);
    const out = [];
    for (const lineRaw of lines) {
      const line = String(lineRaw).replace(/[\t ]+/g, ' ').trimEnd();
      if (!line) continue;
      const parts = line
        .split(/(?<=[.?!])/)
        .map((part) => String(part).trim())
        .filter(Boolean);
      if (parts.length) out.push(...parts);
    }
    return out.length ? out : [String(text).trim()];
  } catch {
    return [String(text).trim()];
  }
}

// Post-split fix-up: merge multiple-choice label fragments so options stay inline.
// Example input fragments from splitting: ["A.", "7, B.", "70, C.", "700, D.", "7000"]
// Output: ["A. 7,   B. 70,   C. 700,   D. 7000"]
// (legacy mergeMcChoiceFragments removed; using improved version below)

// Ensure the letter label and its choice stay together in captions and displays by inserting NBSP after labels.
// Patterns covered: "A.", "(B)", "C:", "D)", "E -" etc., when followed by spaces and text
function mergeMcChoiceFragments(sentences, layout = 'inline') {
  if (!Array.isArray(sentences) || !sentences.length) return sentences || [];
  const out = [];
  const isLabelToken = (s) => /^\(?[A-Z]\)?\s*[.:)\-]\s*$/.test(String(s || '').trim());
  const startsWithLabel = (s) => /^\(?[A-Z]\)?\s*[.:)\-]\s+/.test(String(s || ''));
  const isNumberLine = (s) => /^\d+\.\s*$/.test(String(s || '').trim()); // e.g., "4."

  let i = 0;
  while (i < sentences.length) {
    const cur = String(sentences[i] ?? '');
    const trimmed = cur.trim();

    if (isLabelToken(trimmed) || startsWithLabel(trimmed)) {
      // 1) Build pairs greedily: A. text, B. text, ... possibly split across tokens
      const parts = [];
      // Seed first pair
      if (startsWithLabel(trimmed) && !isLabelToken(trimmed)) {
        const m = trimmed.match(/^\(?([A-Z])\)?\s*[.:)\-]\s+(.*)$/);
        if (m) parts.push(`${m[1]}. ${m[2].trim()}`);
      } else if (isLabelToken(trimmed)) {
        const label = trimmed.match(/^\(?([A-Z])\)?/)[1];
        // Pair with following non-empty token as choice text
        let j = i + 1;
        while (j < sentences.length && String(sentences[j]).trim() === '') j++;
        const choice = j < sentences.length ? String(sentences[j]).trim() : '';
        if (choice) i = j; // advance to the choice token
        parts.push(`${label}. ${choice}`.trim());
      }

      // Continue greedily collecting subsequent label fragments
      let k = i + 1;
      while (k < sentences.length) {
        const nxt = String(sentences[k] ?? '');
        const ntrim = nxt.trim();
        if (isLabelToken(ntrim)) {
          const label = ntrim.match(/^\(?([A-Z])\)?/)[1];
          let m = k + 1;
          while (m < sentences.length && String(sentences[m]).trim() === '') m++;
          const choice = m < sentences.length ? String(sentences[m]).trim() : '';
          if (choice) k = m;
          parts.push(`${label}. ${choice}`.trim());
          k += 1;
          continue;
        }
        if (startsWithLabel(ntrim)) {
          const m = ntrim.match(/^\(?([A-Z])\)?\s*[.:)\-]\s+(.*)$/);
          if (m) parts.push(`${m[1]}. ${m[2].trim()}`);
          k += 1;
          continue;
        }
        break;
      }

      // 2) Optionally prepend preceding numeric line like "4." for Test phase numbering
      let prefix = '';
      if (out.length && isNumberLine(out[out.length - 1])) {
        prefix = String(out.pop()).trim();
      }

      // 3) If prior output line is a question/stem, decide how to attach options
      let head = '';
      if (out.length) {
        const prev = String(out[out.length - 1]);
        if (/[?)]$/.test(prev)) head = String(out.pop());
      }

      if (layout === 'multiline') {
        // Keep the question/stem as its own line, then list each option on a new line
        if (head) {
          const withPrefix = prefix ? `${prefix} ${head}` : head;
          out.push(withPrefix.trim());
        } else if (prefix && parts.length) {
          // No explicit head; attach prefix to the first option
          parts[0] = `${prefix} ${parts[0]}`;
        }
        for (const p of parts) {
          out.push(p.trim());
        }
        i = k + 1;
        continue;
      } else {
        const inline = parts.join(',   ');
        let finalLine = head ? `${head}   ${inline}` : inline;
        if (prefix) finalLine = `${prefix} ${finalLine}`;
        if (!/[.?!]$/.test(finalLine)) finalLine += '.';
        out.push(finalLine.trim());
        i = k + 1;
        continue;
      }
    }

    out.push(sentences[i]);
    i += 1;
  }
  return out;
}

// Ensure the letter label and its choice stay together visually by replacing the normal space after
// the label with a non-breaking space. Handles patterns like "A.", "(B)", "C:", "D)".
function enforceNbspAfterMcLabels(text) {
  try {
    if (typeof text !== 'string') return text;
    return text
      .replace(/\(A\)/g, '(A)') // normalize unexpected variants just in case
      .replace(/\b\(?([A-D])\)?\s*([.:)\-])\s+(?=\S)/g, (_m, p1, p2) => `${p1}.\u00A0`)
      .replace(/\b([A-D])\)\s+(?=\S)/g, (_m, p1) => `${p1}).\u00A0`);
  } catch { return text; }
}

// Count words in a sentence or sentence-like object. Used for caption pacing.
// Accepts a string or an object with a `text` field; returns a minimum of 1.
function countWords(s) {
  try {
    const raw = (typeof s === 'string') ? s : (s && typeof s.text === 'string' ? s.text : '');
    if (!raw) return 1;
    // Normalize non-breaking spaces and collapse whitespace
    const norm = String(raw).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
    if (!norm) return 1;
    // Split on spaces after stripping simple punctuation groups
    const cleaned = norm.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/[^A-Za-z0-9'+\-]+/g, ' ');
    const parts = cleaned.trim().split(/\s+/).filter(Boolean);
    return parts.length || 1;
  } catch { return 1; }
}

// Build a concise grading spec string for a single question.
// Modes:
//  - exact: accept equality to expected or any acceptable (after normalization)
//  - short-answer: accept when at least minKeywords keywords appear (order-free)
// Flags:
//  - tf: enable true/false leniency (T/F and yes/no mapping)
//  - mc: enable multiple-choice leniency (choice letter or full text)
//  - sa: hint that the question type is short-answer (informational)
function buildPerQuestionJudgingSpec({
  mode = 'exact',
  learnerAnswer = '',
  expectedAnswer = '',
  acceptableAnswers = [],
  keywords = [],
  minKeywords = null,
  tf = false,
  mc = false,
  sa = false,
} = {}) {
  try {
    const normalizeRule = 'Normalize by lowercasing, trimming, collapsing spaces, removing punctuation, and mapping number words zero–twenty to digits.';
    const base = [
      'Grading instruction:',
      normalizeRule,
      `Mode: ${mode}`,
    ];

    // True/False leniency
    if (tf) {
      base.push('True/False leniency: accept single-letter T/F; accept yes/no mapped to true/false; also accept canonical true/false tokens.');
    }
    // Multiple-choice leniency
    if (mc) {
      base.push('Multiple-choice leniency: accept the choice letter (A, B, C, …) or the full normalized choice text.');
    }

    if (mode === 'short-answer') {
      const minK = Number.isInteger(minKeywords) ? minKeywords : (Array.isArray(keywords) && keywords.length ? 1 : 0);
      base.push(`Short-answer acceptance: answer is correct when it contains at least ${minK} required keyword(s) from: ${Array.isArray(keywords) ? keywords.join(', ') : ''}.`);
      base.push('Judge on content only; ignore politeness or filler. Do not reveal the correct answer.');
    } else {
      const list = Array.isArray(acceptableAnswers) && acceptableAnswers.length ? acceptableAnswers.join(', ') : expectedAnswer;
      base.push(`Exact acceptance: correct if normalized answer equals expected or any acceptable variant. Expected: ${expectedAnswer}. Acceptable variants: ${list}.`);
      base.push('Do not reveal the correct answer in feedback.');
    }

    return base.filter(Boolean).join(' ');
  } catch {
    return 'Grading instruction: Use normalization; accept expected answer or listed acceptable variants; for short-answer, require the specified keyword count.';
  }
}
  
function SessionPageInner() {
  // URL params defined earlier; reuse here without redeclaration

  // Core session state that many effects/handlers depend on must be initialized first
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [phase, setPhase] = useState("discussion");
  const [subPhase, setSubPhase] = useState("greeting");
  
  // URL params: subject/lesson/difficulty with safe defaults used throughout this component
  // Kept near the top so any effects/handlers can safely reference them without TDZ issues
  const searchParams = useSearchParams();
  const subjectParam = (searchParams?.get('subject') || 'math').toLowerCase();
  const lessonParam = searchParams?.get('lesson') || '';
  const difficultyParam = (searchParams?.get('difficulty') || 'beginner').toLowerCase();
  
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
  // Ad-hoc Q&A flow state
  // askState: 'inactive' | 'awaiting-input' | 'awaiting-confirmation'
  const [askState, setAskState] = useState('inactive');
  const [askOriginalQuestion, setAskOriginalQuestion] = useState('');
  // Riddle state (hoisted before handlers to avoid TDZ in dependencies)
  const [riddleState, setRiddleState] = useState('inactive'); // 'inactive' | 'presented' | 'awaiting-solve'
  const [currentRiddle, setCurrentRiddle] = useState(null); // { id, text, answer }
  // Poem state
  // poemState: 'inactive' | 'awaiting-topic' | 'awaiting-ok'
  const [poemState, setPoemState] = useState('inactive');

  // Reset opening actions visibility on begin and on major phase changes
  useEffect(() => {
    if (phase === 'discussion' && subPhase === 'unified-discussion') {
      setShowOpeningActions(false);
      setJokeUsedThisGate(false);
      setRiddleUsedThisGate(false);
      setPoemUsedThisGate(false);
    }
  }, [phase, subPhase]);

  // After Opening finishes speaking and we are awaiting-learner, show action buttons
  // Only when not in Ask, Riddle, or Poem flows
  useEffect(() => {
    if (
      !isSpeaking &&
      phase === 'discussion' &&
      subPhase === 'awaiting-learner' &&
      askState === 'inactive' &&
      riddleState === 'inactive' &&
      poemState === 'inactive'
    ) {
      setShowOpeningActions(true);
    }
  }, [isSpeaking, phase, subPhase, askState, riddleState, poemState]);

  // If Ask, Riddle, or Poem becomes active, immediately hide Opening actions
  useEffect(() => {
    if (askState !== 'inactive' || riddleState !== 'inactive' || poemState !== 'inactive') {
      try { setShowOpeningActions(false); } catch {}
    }
  }, [askState, riddleState, poemState]);

  // Handler: Tell me a joke (once per gate)
  const handleTellJoke = useCallback(async () => {
    if (jokeUsedThisGate) return;
    try { setShowOpeningActions(false); } catch {}
    try {
      const subjectKey = (subjectParam || 'math');
      const jokeObj = pickNextJoke(subjectKey);
      const text = renderJoke(jokeObj) || '';
      if (!text) { setShowOpeningActions(true); setJokeUsedThisGate(true); return; }
      // Append to captions first; schedule indices
      let sentences = splitIntoSentences(text);
      sentences = mergeMcChoiceFragments(sentences).map((s) => enforceNbspAfterMcLabels(s));
      const prevLen = captionSentencesRef.current?.length || 0;
      const nextAll = [...(captionSentencesRef.current || []), ...sentences];
      captionSentencesRef.current = nextAll;
      setCaptionSentences(nextAll);
      setCaptionIndex(prevLen);
      // Synthesize and play via unified path
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
          if (b64) {
            if (!dec) { setTtsLoadingCount((c) => Math.max(0, c - 1)); dec = true; }
            setIsSpeaking(true);
            try { await playAudioFromBase64(b64, sentences, prevLen); } catch {}
          } else {
            // No audio: approximate timing for captions
            if (!dec) { setTtsLoadingCount((c) => Math.max(0, c - 1)); dec = true; }
            try { if (typeof scheduleCaptionsForDuration === 'function') scheduleCaptionsForDuration(2.5, sentences, prevLen); } catch {}
          }
        }
      } finally {
        if (!dec) setTtsLoadingCount((c) => Math.max(0, c - 1));
      }
    } catch {}
    setJokeUsedThisGate(true);
    // Reveal remaining actions after joke completes or schedules
    setTimeout(() => setShowOpeningActions(true), 400);
  }, [jokeUsedThisGate, subjectParam]);

  // Helper: speak arbitrary frontend text via unified captions + TTS
  const speakFrontend = useCallback(async (text, opts = {}) => {
    try {
      const mcLayout = opts && typeof opts === 'object' ? (opts.mcLayout || 'inline') : 'inline';
      let sentences = splitIntoSentences(text);
      sentences = mergeMcChoiceFragments(sentences, mcLayout).map((s) => enforceNbspAfterMcLabels(s));
      const prevLen = captionSentencesRef.current?.length || 0;
      const nextAll = [...(captionSentencesRef.current || []), ...sentences];
      captionSentencesRef.current = nextAll;
      setCaptionSentences(nextAll);
      setCaptionIndex(prevLen);
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
        if (b64) {
          if (!dec) { setTtsLoadingCount((c) => Math.max(0, c - 1)); dec = true; }
          setIsSpeaking(true);
          try { await playAudioFromBase64(b64, sentences, prevLen); } finally { setIsSpeaking(false); }
        } else {
          if (!dec) { setTtsLoadingCount((c) => Math.max(0, c - 1)); dec = true; }
          try { if (typeof scheduleCaptionsForDuration === 'function') scheduleCaptionsForDuration(2.0, sentences, prevLen); } catch {}
        }
      }
  } catch {}
  finally { if (!dec) setTtsLoadingCount((c) => Math.max(0, c - 1)); }
  } catch {}
  }, []);

  // Handler: Ask a question (entry)
  const handleAskQuestionStart = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    const learnerName = (typeof window !== 'undefined' ? (localStorage.getItem('learner_name') || '') : '').trim();
    const name = learnerName || 'friend';
    // Frontend prompt and transcript
    const prompt = `Yes, ${name} did you have a question?`;
    // Enable input/mic for the facilitator immediately; speaking lock will block until prompt finishes
    setCanSend(true);
    setAskOriginalQuestion('');
    setAskState('awaiting-input');
    await speakFrontend(prompt);
  }, [speakFrontend]);

  // (moved: handleStartLesson defined later, after state declarations to avoid TDZ)

  // Ask confirmation handlers (after Ms. Sonoma answered)
  const handleAskConfirmYes = useCallback(() => {
    // Return to unused-buttons state: hide confirmation, show normal opening actions, allow input again
    setAskState('inactive');
    setAskOriginalQuestion('');
    setShowOpeningActions(true);
    setCanSend(true);
  }, []);

  const handleAskConfirmNo = useCallback(async () => {
    // Encourage re-asking with the original question populated
    try { await speakFrontend('Try asking again a little bit differently.'); } catch {}
    setAskState('awaiting-input');
    // Pre-populate the input for editing
    setLearnerInput(askOriginalQuestion || '');
    setCanSend(true);
  }, [askOriginalQuestion, speakFrontend]);

  const handleAskAnother = useCallback(() => {
    // Clear input and return to ask-entry state
    setLearnerInput('');
    setAskOriginalQuestion('');
    setAskState('awaiting-input');
    setCanSend(true);
  }, []);

  // Riddle: start and present one via TTS/captions
  const handleTellRiddle = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    try { setRiddleUsedThisGate(true); } catch {}
    const pick = pickRandomRiddle();
    setCurrentRiddle(pick);
    setRiddleState('presented');
    await speakFrontend(`Here is a riddle. ${pick.text}`);
    setCanSend(true);
    setRiddleState('awaiting-solve');
  }, [speakFrontend]);

  // Poem: start flow – ask for topic via frontend TTS and enable input
  const handlePoemStart = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    try { setPoemUsedThisGate(true); } catch {}
    setPoemState('awaiting-topic');
    setCanSend(true);
    await speakFrontend('What would you like the poem to be about?');
  }, [speakFrontend]);

  // Poem: after reading, show Ok; pressing Ok returns to options
  const handlePoemOk = useCallback(() => {
    setPoemState('inactive');
    setShowOpeningActions(true);
    setCanSend(true);
  }, []);


  // Riddle: judge learner's attempt (local leniency first, then model if needed)
  const judgeRiddleAttempt = useCallback(async (attempt) => {
    if (!currentRiddle) return { ok: false, text: '' };

    // Local lenient acceptance using unified normalization
    try {
      const acceptable = expandRiddleAcceptables(currentRiddle.answer);
      const okLocal = isAnswerCorrectLocal(attempt, acceptable, { type: 'short-answer' });
      if (okLocal) {
        return { ok: true, text: 'Correct. Nice solving.' };
      }
    } catch {}

    // Fall back to model judging with bounded-leniency guidance
    const instruction = [
      'You are Ms. Sonoma. Judge if the learner solved the riddle correctly.',
      `Riddle: "${currentRiddle.text}".`,
      `Correct answer: "${currentRiddle.answer}".`,
      `Learner attempt: "${attempt}".`,
      JUDGING_LENIENCY_OPEN_ENDED,
      'Reply in one short friendly line: say Correct with brief praise if they got it, or say Not correct with a tiny encouragement to try again. Do not reveal the answer.'
    ].join(' ');
    const result = await callMsSonoma(
      instruction,
      '',
      { phase: 'discussion', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, step: 'riddle-judge' },
      { fastReturn: true }
    ).catch(() => null);
    return result || { ok: false, text: '' };
  }, [currentRiddle, subjectParam, difficultyParam, lessonParam]);

  // Riddle: ask for a hint
  const requestRiddleHint = useCallback(async () => {
    if (!currentRiddle) return;
    const instruction = `You are Ms. Sonoma. Give a tiny hint (one short sentence) for this riddle without revealing the answer. Riddle: "${currentRiddle.text}". Correct answer: "${currentRiddle.answer}". Keep it playful and encouraging.`;
    const result = await callMsSonoma(instruction, '', { phase: 'discussion', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, step: 'riddle-hint' }, { fastReturn: true }).catch(() => null);
    const line = (result && result.text) ? result.text : 'Here is a small hint.';
    await speakFrontend(line);
    setRiddleState('awaiting-solve');
  }, [currentRiddle, subjectParam, difficultyParam, lessonParam, speakFrontend]);

  // Riddle: reveal the answer and return to options
  const revealRiddleAnswer = useCallback(async () => {
    if (!currentRiddle) return;
    await speakFrontend(`The answer is: ${currentRiddle.answer}. Nice thinking. Let us jump back to our options.`);
    setCurrentRiddle(null);
    setRiddleState('inactive');
    setShowOpeningActions(true);
  }, [currentRiddle, speakFrontend]);

  // Riddle: Solve button handler – puts focus back on input/mic
  const handleRiddleSolve = useCallback(async () => {
    setCanSend(true);
    setRiddleState('awaiting-solve');
    await speakFrontend('Go ahead and tell me your answer.');
  }, [speakFrontend]);

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
  // isSpeaking/phase/subPhase defined earlier; do not redeclare here
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
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
        // Smooth ramp: 40% at 375px height -> 70% at 600px height (linear),
        // clamped to [0.40, 0.70]. Applies to all landscape viewports.
        const hMin = 375;
        const hMax = 600;
        let frac;
        if (h <= hMin) {
          frac = 0.40;
        } else if (h >= hMax) {
          frac = 0.70;
        } else {
          const t = (h - hMin) / (hMax - hMin);
          frac = 0.40 + t * (0.70 - 0.40);
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
  const [currentWorksheetIndex, setCurrentWorksheetIndex] = useState(0);
  // Sample-driven question pools (for comprehension & exercise)
  const [compPool, setCompPool] = useState([]); // remaining shuffled problems for comprehension
  const [exercisePool, setExercisePool] = useState([]); // remaining shuffled problems for exercise
  const [currentCompProblem, setCurrentCompProblem] = useState(null); // problem currently asked in comprehension awaiting learner answer
  const [currentExerciseProblem, setCurrentExerciseProblem] = useState(null); // problem currently asked in exercise awaiting learner answer

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

  // Explicit Go handlers per phase to reliably start the first question
  const handleGoComprehension = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'comprehension') return;
    let item = currentCompProblem;
    if (!item) {
      let firstComp = null;
      if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
        let idx = currentCompIndex;
        while (idx < generatedComprehension.length && isShortAnswerItem(generatedComprehension[idx])) idx += 1;
        if (idx < generatedComprehension.length) { firstComp = generatedComprehension[idx]; setCurrentCompIndex(idx + 1); }
      }
      if (!firstComp) {
        let tries = 0; while (tries < 5) { const s = drawSampleUnique(); if (s && !isShortAnswerItem(s)) { firstComp = s; break; } tries += 1; }
      }
      if (!firstComp && compPool.length) {
        const filtered = compPool.filter(q => !isShortAnswerItem(q));
        if (filtered.length > 0) { firstComp = filtered[0]; setCompPool(compPool.slice(1)); }
      }
      if (!firstComp) {
        const refilled = buildQAPool();
        if (Array.isArray(refilled) && refilled.length) { firstComp = refilled[0]; setCompPool(refilled.slice(1)); }
      }
      if (!firstComp) {
        if (Array.isArray(generatedComprehension) && generatedComprehension.length) {
          firstComp = generatedComprehension[currentCompIndex] || generatedComprehension[0];
          setCurrentCompIndex((currentCompIndex || 0) + 1);
        } else if (Array.isArray(compPool) && compPool.length) {
          firstComp = compPool[0]; setCompPool(compPool.slice(1));
        }
      }
      if (firstComp) { setCurrentCompProblem(firstComp); item = firstComp; setSubPhase('comprehension-active'); }
    }
    if (!item) { setShowOpeningActions(true); return; }
    try {
      setQaAnswersUnlocked(true);
      const formatted = ensureQuestionMark(formatQuestionForSpeech(item, { layout: 'multiline' }));
      setCanSend(false);
      await speakFrontend(formatted, { mcLayout: 'multiline' });
    } catch {}
    setCanSend(true);
  }, [phase, currentCompProblem, generatedComprehension, currentCompIndex, compPool, speakFrontend]);

  const handleGoExercise = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'exercise') return;
    let item = currentExerciseProblem;
    if (!item) {
      let first = null;
      if (Array.isArray(generatedExercise) && currentExIndex < generatedExercise.length) {
        let idx = currentExIndex;
        while (idx < generatedExercise.length && isShortAnswerItem(generatedExercise[idx])) idx += 1;
        if (idx < generatedExercise.length) { first = generatedExercise[idx]; setCurrentExIndex(idx + 1); }
      }
      if (!first) { let tries = 0; while (tries < 5) { const s = drawSampleUnique(); if (s && !isShortAnswerItem(s)) { first = s; break; } tries += 1; } }
      if (!first && exercisePool.length) { const [head, ...rest] = exercisePool; first = isShortAnswerItem(head) ? null : head; setExercisePool(rest); }
      if (!first) { const refilled = buildQAPool(); if (refilled.length) { const [head, ...rest] = refilled; first = head; setExercisePool(rest); } }
      if (first) { setCurrentExerciseProblem(first); item = first; setSubPhase('exercise-start'); }
    }
    if (!item) { setShowOpeningActions(true); return; }
    try {
      setQaAnswersUnlocked(true);
      const formatted = ensureQuestionMark(formatQuestionForSpeech(item, { layout: 'multiline' }));
      setCanSend(false);
      await speakFrontend(formatted, { mcLayout: 'multiline' });
    } catch {}
    setCanSend(true);
  }, [phase, currentExerciseProblem, generatedExercise, currentExIndex, exercisePool, speakFrontend]);

  const handleGoWorksheet = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'worksheet') return;
    const list = Array.isArray(generatedWorksheet) ? generatedWorksheet : [];
    const item = list[0];
    if (!item) { setShowOpeningActions(true); return; }
    try {
      setQaAnswersUnlocked(true);
      const num = (typeof item.number === 'number' && item.number > 0) ? item.number : 1;
      const formatted = ensureQuestionMark(`${num}. ${formatQuestionForSpeech(item, { layout: 'multiline' })}`);
      setCanSend(false);
      await speakFrontend(formatted, { mcLayout: 'multiline' });
    } catch {}
    setCanSend(true);
  }, [phase, generatedWorksheet, speakFrontend]);

  const handleGoTest = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase !== 'test') return;
    const list = Array.isArray(generatedTest) ? generatedTest : [];
    const item = list[0];
    if (!item) { setShowOpeningActions(true); return; }
    try {
      setQaAnswersUnlocked(true);
      const formatted = ensureQuestionMark(`1. ${formatQuestionForSpeech(item, { layout: 'multiline' })}`);
      setCanSend(false);
      await speakFrontend(formatted, { mcLayout: 'multiline' });
    } catch {}
    setCanSend(true);
  }, [phase, generatedTest, speakFrontend]);

  // Handler: Start the lesson now (fallback/generic)
  const handleStartLesson = useCallback(async () => {
    try { setShowOpeningActions(false); } catch {}
    if (phase === 'comprehension' && currentCompProblem) {
      try {
        setQaAnswersUnlocked(true);
        const formatted = ensureQuestionMark(formatQuestionForSpeech(currentCompProblem, { layout: 'multiline' }));
        setCanSend(false);
        await speakFrontend(formatted, { mcLayout: 'multiline' });
      } catch {}
      setCanSend(true);
      return;
    }
    if (phase === 'exercise' && currentExerciseProblem) {
      try {
        setQaAnswersUnlocked(true);
        const formatted = ensureQuestionMark(formatQuestionForSpeech(currentExerciseProblem, { layout: 'multiline' }));
        setCanSend(false);
        await speakFrontend(formatted, { mcLayout: 'multiline' });
      } catch {}
      setCanSend(true);
      return;
    }
    if (phase === 'worksheet' && Array.isArray(generatedWorksheet) && generatedWorksheet[0]) {
      try {
        setQaAnswersUnlocked(true);
        const first = generatedWorksheet[0];
        const num = (typeof first.number === 'number' && first.number > 0) ? first.number : 1;
        const formatted = ensureQuestionMark(`${num}. ${formatQuestionForSpeech(first, { layout: 'multiline' })}`);
        setCanSend(false);
        await speakFrontend(formatted, { mcLayout: 'multiline' });
      } catch {}
      setCanSend(true);
      return;
    }
    if (phase === 'test' && Array.isArray(generatedTest) && generatedTest[0]) {
      try {
        setQaAnswersUnlocked(true);
        const formatted = ensureQuestionMark(`1. ${formatQuestionForSpeech(generatedTest[0], { layout: 'multiline' })}`);
        setCanSend(false);
        await speakFrontend(formatted, { mcLayout: 'multiline' });
      } catch {}
      setCanSend(true);
      return;
    }
    try { await startThreeStageTeaching(); } catch {}
  }, [phase, currentCompProblem, currentExerciseProblem, generatedWorksheet, generatedTest, speakFrontend]);

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
  const audioRef = useRef(null); // active Audio element for synthesized speech
  const captionTimersRef = useRef([]); // active timers advancing captionIndex
  const captionSentencesRef = useRef([]); // accumulated caption sentences for full transcript persistence
  // Track re-joins: begin timestamp when the user hits Begin
  useEffect(() => {
    if (showBegin === false && !sessionStartRef.current) {
      sessionStartRef.current = new Date().toISOString();
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
  const [userPaused, setUserPaused] = useState(false); // user-level pause covering video + TTS
  // When true, the next play attempt ignores userPaused gating (used for Opening begin)
  const forceNextPlaybackRef = useRef(false);
  // Record user play/pause intents that occur while the app is loading; apply after load finishes
  const [playbackIntent, setPlaybackIntent] = useState(null); // 'play' | 'pause' | null
  // Browser detection: treat Safari specially for mic prompts
  const isSafari = useMemo(() => {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /Safari\//.test(ua) && !/Chrome|Chromium|Edg\//.test(ua);
  }, []);
  // Tracks whether the user has explicitly unlocked audio via a gesture (prevents re‑prompting)
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
  const lastAudioBase64Ref = useRef(null);
  // Prefer HTMLAudio for the very first TTS playback (Opening) to satisfy stricter autoplay policies.
  // We reset this after the first attempt so subsequent replies can use WebAudio-first as usual.
  const preferHtmlAudioOnceRef = useRef(false);
  // Prevent multiple recovery attempts for the Opening playback
  const openingReattemptedRef = useRef(false);
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
  // Model-validated correctness tracking during test review
  // Concise bounded-leniency guidance (applies only to open-ended judging, not TF/MC)
  const JUDGING_LENIENCY_OPEN_ENDED = 'Judge open-ended answers with bounded leniency: ignore fillers and politeness, be case-insensitive, ignore punctuation, and collapse spaces. Map number words zero–twenty to digits and allow simple forms like "one hundred twenty". Accept simple plural/tense changes in acceptable phrases but require all core keywords from an acceptable variant. If multiple different numbers appear, treat as incorrect. Do not apply this leniency to true/false or multiple choice.';

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
      const a = Array.isArray(q?.expectedAny) ? q.expectedAny.filter(Boolean) : [];
      const b = Array.isArray(q?.acceptable) ? q.acceptable.filter(Boolean) : [];
      const merged = [...a, ...b];
      return merged.length ? merged : null;
    } catch { return null; }
  };

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

  // Organic single-sentence celebrations for correct comprehension answers (no rigid cue wording).
  // Keep them short, warm, and domain-agnostic; avoid trailing punctuation beyond a period.
  const CELEBRATE_CORRECT = useMemo(() => [
    'Yes, great thinking',
    'That is right',
    'Nice work',
    'You nailed it',
    'Correct and confident',
    'Solid answer',
    'Exactly right',
    'Way to go',
    'Spot on',
    'You got it'
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
      // Always dispatch the title so HeaderBar can show it in both landscape and portrait
      window.dispatchEvent(new CustomEvent('ms:session:title', { detail: pageTitle }));
    } catch {}
  }, [isMobileLandscape, lessonData, manifestInfo.title, effectiveLessonTitle]);
  // Shared constants
  // Import centrally defined worksheet progress cue variants
  // Note: keep relative path stable if this file moves
  const { WORKSHEET_CUE_VARIANTS } = require('./constants/worksheetCues.js');

  const subjectSegment = (subjectParam || "math").toLowerCase();
  const subjectFolderSegment = subjectSegment === 'facilitator' ? 'Facilitator Lessons' : subjectSegment;
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
        const candidatesBase = ['math', 'language arts', 'science', 'social studies', 'Facilitator Lessons'];
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
  }, [lessonData, lessonFilePath]);

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
  const samplesRaw = arrify(lessonData?.sample).map(q => ({ ...normalize(q), questionType: 'sa' }));
    const samplesForPhase = isMath
      ? samplesRaw // allow Short Answer in Math comprehension/exercise
      : samplesRaw.filter((q) => !isShortAnswer(q)); // exclude SA for non-Math

    // Prepare categories (accept single object or array)
  const tf = arrify(lessonData?.truefalse).map(q => ({ ...q, sourceType: 'tf', questionType: 'tf' })).map(normalize);
  const mc = arrify(lessonData?.multiplechoice).map(q => ({ ...q, sourceType: 'mc', questionType: 'mc' })).map(normalize);
  const fib = arrify(lessonData?.fillintheblank).map(q => ({ ...q, sourceType: 'fib', questionType: 'sa' })).map(normalize);
  const sa = arrify(lessonData?.shortanswer).map(q => ({ ...q, sourceType: 'short', questionType: 'sa' })).map(normalize);

    // Exclude invalid MC entries that have no options/choices (would behave like short answer)
    const mcValid = mc.filter(q => {
      const hasChoices = (Array.isArray(q?.choices) && q.choices.length) || (Array.isArray(q?.options) && q.options.length);
      return hasChoices;
    });

    if (isMath) {
      // Math: Mix Samples with TF/MC/FIB/SA
      const pool = [...samplesForPhase, ...tf, ...mcValid, ...fib, ...sa];
      // Log unique questionTypes for dev validation
      try { console.debug('[PoolTagging] Comp/Ex pool types:', Array.from(new Set(pool.map(x => x?.questionType || 'sa')))); } catch {}
      return shuffle(pool);
    }

    // Non-Math: Prefer Samples (no SA). If none, fall back to TF/MC/FIB only.
    if (samplesForPhase.length) {
      try { console.debug('[PoolTagging] Comp/Ex pool types (samples only):', Array.from(new Set(samplesForPhase.map(x => x?.questionType || 'sa')))); } catch {}
      return shuffle(samplesForPhase);
    }
    const catPool = [...tf, ...mcValid, ...fib];
    try { console.debug('[PoolTagging] Comp/Ex pool types (cats):', Array.from(new Set(catPool.map(x => x?.questionType || 'sa')))); } catch {}
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
              const initialPool = buildQAPool();
              if (initialPool.length) setCompPool(initialPool);
            }
            if (stored && Array.isArray(stored.exercise) && stored.exercise.length) {
              setExercisePool(stored.exercise);
            } else {
              const initialPool = buildQAPool();
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
                    return { ...core, sourceType: 'word', questionType: 'sa' };
                  });
                  const baseSel = shuffle(baseAvail).slice(0, baseCount).map(q => ({ ...q, sourceType: 'sample', questionType: 'sa' }));
                return shuffle([...wpSel, ...baseSel]);
              };
              let gW = [];
              let gT = [];
              if (subjectParam === 'math') {
                const samples = reserveSamples(WORKSHEET_TARGET + TEST_TARGET);
                const words = reserveWords(WORKSHEET_TARGET + TEST_TARGET);
                // Include category pools in addition to samples
                const tf = Array.isArray(data.truefalse) ? data.truefalse.map(q => ({ ...q, sourceType: 'tf', questionType: 'tf' })) : [];
                const mc = Array.isArray(data.multiplechoice) ? data.multiplechoice.map(q => ({ ...q, sourceType: 'mc', questionType: 'mc' })) : [];
                const fib = Array.isArray(data.fillintheblank) ? data.fillintheblank.map(q => ({ ...q, sourceType: 'fib', questionType: 'sa' })) : [];
                const sa = Array.isArray(data.shortanswer) ? data.shortanswer.map(q => ({ ...q, sourceType: 'short', questionType: 'sa' })) : [];
                const cats = [...tf, ...mc, ...fib, ...sa];
                if ((samples && samples.length) || (words && words.length) || cats.length) {
                  const takeMixed = (target, isTest) => {
                    const desiredWp = Math.round(target * 0.3);
                    const wpSel = (words || []).slice(0, desiredWp).map(q => ({ ...(isTest ? ({ ...q, expected: q.expected ?? q.answer }) : q), sourceType: 'word', questionType: 'sa' }));
                    // Cap SA/FIB to 10% each in the remainder from samples+categories
                    const remainder = Math.max(0, target - wpSel.length);
                    const cap = Math.max(0, Math.floor(target * 0.10));
                    const fromBase = [
                      ...((samples || []).map(q => ({ ...q, sourceType: 'sample', questionType: 'sa' })) ),
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
                    const mixed = shuffleArr([...wpSel, ...baseSel]);
                    try { console.debug('[PoolTagging] Mixed select types:', Array.from(new Set(mixed.map(x => x?.questionType || 'sa')))); } catch {}
                    return mixed;
                  };
                  gW = takeMixed(WORKSHEET_TARGET, false);
                  gT = takeMixed(TEST_TARGET, true);
                  setGeneratedWorksheet(gW);
                  setGeneratedTest(gT);
                }
              } else {
                // Non-math: build from category arrays when available; cap Short Answer and Fill-in-the-Blank at 10% each
                const buildFromCategories = (target = 0) => {
                  const tf = Array.isArray(data.truefalse) ? data.truefalse.map(q => ({ ...q, sourceType: 'tf', questionType: 'tf' })) : [];
                  const mc = Array.isArray(data.multiplechoice) ? data.multiplechoice.map(q => ({ ...q, sourceType: 'mc', questionType: 'mc' })) : [];
                  const fib = Array.isArray(data.fillintheblank) ? data.fillintheblank.map(q => ({ ...q, sourceType: 'fib', questionType: 'sa' })) : [];
                  const sa = Array.isArray(data.shortanswer) ? data.shortanswer.map(q => ({ ...q, sourceType: 'short', questionType: 'sa' })) : [];
                  const anyCats = tf.length || mc.length || fib.length || sa.length;
                  if (!anyCats) return null;
                  const cap = Math.max(0, Math.floor(target * 0.10));
                  const saPick = shuffle(sa).slice(0, Math.min(cap, sa.length));
                  const fibPick = shuffle(fib).slice(0, Math.min(cap, fib.length));
                  const others = shuffle([...tf, ...mc]);
                  const remaining = Math.max(0, target - saPick.length - fibPick.length);
                  const otherPick = others.slice(0, remaining);
                  const built = shuffle([...saPick, ...fibPick, ...otherPick]);
                  try { console.debug('[PoolTagging] Non-math category types:', Array.from(new Set(built.map(x => x?.questionType || 'sa')))); } catch {}
                  return built;
                };
                const fromCatsW = buildFromCategories(WORKSHEET_TARGET);
                const fromCatsT = buildFromCategories(TEST_TARGET);
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
      // Normalize and stash last audio payload in case we need to retry after an iOS unlock
      const normalizedB64 = normalizeBase64Audio(audioBase64 || '');
      lastAudioBase64Ref.current = normalizedB64 || null;
      lastSentencesRef.current = Array.isArray(batchSentences) ? batchSentences : [];
      lastStartIndexRef.current = Number.isFinite(startIndex) ? startIndex : 0;

      // If this is the very first playback after Begin (Opening), prefer HTMLAudio once.
      // Many browsers grant more permissive autoplay to HTMLMediaElement after a user gesture.
      const useHtmlFirst = !!preferHtmlAudioOnceRef.current;
      if (!useHtmlFirst) {
        // Prefer WebAudio path when the AudioContext is ready (more resilient to autoplay policies),
        // not only on iOS. We'll attempt it whenever a context exists; ensureAudioContext may resume if suspended.
        try {
          const ctx = ensureAudioContext();
          if (ctx) {
            try { console.info('[Session] playAudioFromBase64: using WebAudio path for playback'); } catch {}
            await playViaWebAudio(normalizedB64, batchSentences || [], startIndex);
            // First playback completed via WebAudio; clear the one-time preference if it was set accidentally
            if (preferHtmlAudioOnceRef.current) preferHtmlAudioOnceRef.current = false;
            return;
          }
        } catch {/* fall back to HTMLAudio below */}
      }

      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch (pauseError) {
          console.warn("[Session] Unable to pause existing audio.", pauseError);
        }
        audioRef.current.src = "";
        audioRef.current = null;
      }

  // HTMLAudio fallback path
  try { console.info('[Session] playAudioFromBase64: using HTMLAudio path for playback'); } catch {}
  const arrBuf = base64ToArrayBuffer(normalizedB64);
  const blob = new Blob([arrBuf], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);

      await new Promise((resolve) => {
  const audio = new Audio(url);
  audioRef.current = audio;
  // Apply latest mute state immediately
  audio.muted = Boolean(mutedRef.current);
  audio.volume = mutedRef.current ? 0 : 1;
  {
    const allowAuto = (!userPaused || forceNextPlaybackRef.current);
    if (allowAuto) {
      scheduleCaptionsForAudio(audio, batchSentences || [], startIndex);
    }
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

        audio.onplay = () => {
          try { setIsSpeaking(true); } catch {}
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
          // Try WebAudio fallback if available
          (async () => {
            try {
              await playViaWebAudio(normalizedB64, batchSentences || [], startIndex);
            } catch {
              /* final fallback: no audio */
            } finally {
              cleanup();
            }
          })();
        };

        {
          let playPromise;
          const allowAuto = (!userPaused || forceNextPlaybackRef.current);
          try { console.info('[Session] HTMLAudio: allowAuto=', allowAuto, 'muted=', !!mutedRef.current, 'userPaused=', !!userPaused, 'forceNext=', !!forceNextPlaybackRef.current); } catch {}
          if (allowAuto) {
            playPromise = audio.play();
            // Try to play the video to keep visuals in sync with speech
            if (videoRef.current) {
              try { videoRef.current.play().catch(() => {}); } catch {}
            }
            // Reset the force flag after first autoplay attempt
            try { if (forceNextPlaybackRef.current) forceNextPlaybackRef.current = false; } catch {}
            // Clear the first-playback HTMLAudio preference after attempting
            if (preferHtmlAudioOnceRef.current) preferHtmlAudioOnceRef.current = false;
          }
          if (playPromise && playPromise.catch) {
            playPromise.catch((err) => {
              console.warn('[Session] Audio autoplay blocked or failed. Falling back to WebAudio.', err);
              try { setIsSpeaking(false); } catch {}
              // If audio cannot start, pause the background video to avoid a perpetual "speaking" feel
              if (videoRef.current && (!userPaused || forceNextPlaybackRef.current)) {
                try { videoRef.current.pause(); } catch {}
              }
              // Attempt WebAudio fallback using the same payload
              (async () => {
                try {
                  try { console.info('[Session] HTMLAudio failed; retrying via WebAudio'); } catch {}
                  await playViaWebAudio(normalizedB64, batchSentences || [], startIndex);
                } catch {
                  /* give up silently */
                } finally {
                  cleanup();
                }
              })();
            });
          }
        }
        if (userPaused && !forceNextPlaybackRef.current) {
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
  const webAudioBufferRef = useRef(null);
  const webAudioStartedAtRef = useRef(0);
  const webAudioPausedAtRef = useRef(0);

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

  // Generate a tiny silent WAV data URL to reliably unlock HTMLMedia playback on user gesture
  const makeSilentWavDataUrl = (durationMs = 60, sampleRate = 8000) => {
    try {
      const numSamples = Math.max(1, Math.floor(sampleRate * (durationMs / 1000)));
      const blockAlign = 2; // mono, 16-bit
      const byteRate = sampleRate * blockAlign;
      const dataSize = numSamples * blockAlign;
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);
      const writeStr = (offset, str) => { for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i)); };
      // RIFF header
      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + dataSize, true);
      writeStr(8, 'WAVE');
      // fmt chunk
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true); // PCM chunk size
      view.setUint16(20, 1, true);  // PCM format
      view.setUint16(22, 1, true);  // mono
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, 16, true); // bits per sample
      // data chunk
      writeStr(36, 'data');
      view.setUint32(40, dataSize, true);
      // samples are already zero (silence)
      // Convert to base64
      const bytes = new Uint8Array(buffer);
      let bin = '';
      for (let i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);
      return `data:audio/wav;base64,${b64}`;
    } catch {
      return '';
    }
  };

  // Normalize base64 audio: strip data URLs, remove whitespace, convert base64url, and pad
  const normalizeBase64Audio = (raw) => {
    if (!raw) return '';
    let s = String(raw).trim();
    const m = s.match(/^data:audio\/(?:mpeg|mp3|wav|ogg);base64,(.*)$/i);
    if (m) s = m[1];
    s = s.replace(/\s+/g, '');
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    const pad = s.length % 4;
    if (pad === 2) s += '==';
    else if (pad === 3) s += '=';
    else if (pad === 1) s += '===';
    return s;
  };

  const base64ToArrayBuffer = (b64) => {
    const normalized = normalizeBase64Audio(b64);
    const binaryString = atob(normalized);
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
      // Ensure context is running before we decode and start; if it was created while suspended,
      // resuming here avoids a silent start on some browsers.
      try {
        try { console.info('[Session] WebAudio state before resume:', ctx?.state); } catch {}
        if (ctx.state === 'suspended') { await ctx.resume(); }
        try { console.info('[Session] WebAudio state after resume:', ctx?.state); } catch {}
      } catch {}
    const arr = base64ToArrayBuffer(b64);
    const buffer = await ctx.decodeAudioData(arr.slice(0));
    webAudioBufferRef.current = buffer;
  try { console.info('[Session] WebAudio decode ok; duration(s)=', Number(buffer?.duration || 0).toFixed(2)); } catch {}
  const src = ctx.createBufferSource();
  src.buffer = buffer;
      try {
        if (!webAudioGainRef.current) {
          const gain = ctx.createGain();
          gain.gain.value = mutedRef.current ? 0 : 1;
          gain.connect(ctx.destination);
          webAudioGainRef.current = gain;
        }
        // Ensure gain matches current mute state right before we connect/start.
        try { if (webAudioGainRef.current) { webAudioGainRef.current.gain.value = mutedRef.current ? 0 : 1; } } catch {}
      } catch {}
      src.connect(webAudioGainRef.current || ctx.destination);
  webAudioSourceRef.current = src;

      {
        const allowAuto = (!userPaused || forceNextPlaybackRef.current);
        if (allowAuto) {
          // Track current caption batch boundaries for pause/resume parity with HTMLAudio path
          try {
            const batchLen = (sentences && sentences.length) || 0;
            captionBatchStartRef.current = startIndex || 0;
            captionBatchEndRef.current = (startIndex || 0) + batchLen;
          } catch {}
          try { scheduleCaptionsForDuration(buffer.duration, sentences || [], startIndex || 0); } catch {}
          if (videoRef.current) { try { videoRef.current.play(); } catch {} }
          // Reset the force flag after first autoplay attempt
          try { if (forceNextPlaybackRef.current) forceNextPlaybackRef.current = false; } catch {}
        }
      }
      setIsSpeaking(true);
      await new Promise((resolve) => {
        src.onended = () => {
          try {
            setIsSpeaking(false);
            if (videoRef.current && (!userPaused || forceNextPlaybackRef.current)) { try { videoRef.current.pause(); } catch {} }
          } catch {}
          stopWebAudioSource();
          webAudioStartedAtRef.current = 0;
          webAudioPausedAtRef.current = 0;
          resolve();
        };
        try {
          try { console.info('[Session] Starting WebAudio source now at', ctx?.currentTime); } catch {}
          webAudioStartedAtRef.current = ctx.currentTime;
          webAudioPausedAtRef.current = 0;
          src.start(0);
        } catch (e) { console.warn('[Session] WebAudio start failed', e); resolve(); }
      });
    } catch (e) {
      console.warn('[Session] WebAudio decode/play failed', e);
      throw e;
    }
  };

  // Web Speech API fallback removed per requirement: absolutely no browser Web Speech usage.

  // Audio unlock flow: resume/create AudioContext and unlock HTMLMedia by a silent blip.
  // IMPORTANT: Do NOT auto-play any prior TTS here; unlock must be passive to avoid echo/overlap.
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

      // Also unlock HTMLMedia by playing a tiny muted silent WAV once during the gesture
      try {
        const url = makeSilentWavDataUrl(80);
        if (url) {
          const a = new Audio(url);
          a.muted = true;
          a.volume = 0;
          // Best-effort; do not await
          const p = a.play();
          if (p && p.catch) { p.catch(() => {}); }
          // Stop it shortly after
          setTimeout(() => { try { a.pause(); } catch {} }, 120);
        }
      } catch {}

    // Mark audio as explicitly unlocked so we do not force the prompt again
    audioUnlockedRef.current = true;
    try { if (typeof window !== 'undefined') localStorage.setItem('ms_audioUnlocked', 'true'); } catch {}
    try { setAudioUnlocked(true); } catch {}
    } catch (e) {
      console.warn('[Session] Audio unlock attempt failed', e);
    }
  }, []);

  // Request audio and mic permissions during a user gesture (Begin click).
  // - Resumes/creates AudioContext and marks audio as unlocked.
  // - Requests microphone access once, then immediately stops tracks.
  // This should be invoked synchronously inside Begin handlers before any awaits.
  const requestAudioAndMicPermissions = useCallback((force = false) => {
    // Always try to unlock audio; harmless and gesture-friendly
    try { unlockAudioPlayback(); } catch {}
    // Avoid concurrent mic prompts
    if (micRequestInFlightRef.current) return;
    // If mic decision already known and not forcing, skip
    if (!force && micAllowed !== null) return;
    // On Safari, avoid auto mic prompts unless forced by user click
    if (!force && isSafari) return;
    try {
      const nav = (typeof navigator !== 'undefined') ? navigator : null;
      if (nav && nav.mediaDevices && typeof nav.mediaDevices.getUserMedia === 'function') {
        micRequestInFlightRef.current = true;
        nav.mediaDevices.getUserMedia({ audio: true })
          .then((stream) => {
            try { stream.getTracks().forEach(t => { try { t.stop(); } catch {} }); } catch {}
            // Persist mic allowed state
            try { if (typeof window !== 'undefined') localStorage.setItem('ms_micAllowed', 'true'); } catch {}
            try { setMicAllowed(true); } catch {}
          })
          .catch((err) => {
            try {
              console.info('[Session] Mic permission request failed or denied', err?.name || err);
              // Surface a brief, non-blocking tip so users know typing still works
              try { showTipOverride('Mic access denied. You can still type answers.', 5000); } catch {}
              // Persist denied state to guide banner visibility
              try { if (typeof window !== 'undefined') localStorage.setItem('ms_micAllowed', 'false'); } catch {}
              try { setMicAllowed(false); } catch {}
            } catch {}
          })
          .finally(() => { micRequestInFlightRef.current = false; });
      }
    } catch { micRequestInFlightRef.current = false; }
  }, [unlockAudioPlayback, isSafari, micAllowed]);

  // Attempt audio and microphone setup immediately on page entry.
  // - This proactively prompts for mic permission and preps AudioContext early.
  // - Browsers may still require a user gesture for autoplay, but this reduces friction later.
  useEffect(() => {
    // On mount, only unlock audio. Do not auto-request mic for any browser.
    try { unlockAudioPlayback(); } catch {}
  }, [unlockAudioPlayback]);

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

  // When loading finishes, apply any deferred playback intent
  useEffect(() => {
    if (!loading && playbackIntent) {
      const intent = playbackIntent;
      // Clear first to avoid re-entry loops
      setPlaybackIntent(null);
      if (intent === 'pause') {
        try { if (audioRef.current) audioRef.current.pause(); } catch {}
        try { if (videoRef.current) videoRef.current.pause(); } catch {}
        clearCaptionTimers();
        setIsSpeaking(false);
        // Ensure UI state reflects paused
        try { setUserPaused(true); } catch {}
      } else if (intent === 'play') {
        const a = audioRef.current;
        if (a) {
          try {
            a.play();
            setIsSpeaking(true);
            const startAt = captionIndex;
            const batchEnd = captionBatchEndRef.current || captionSentencesRef.current.length;
            const slice = (captionSentencesRef.current || []).slice(startAt, batchEnd);
            if (slice.length) {
              try { scheduleCaptionsForAudio(a, slice, startAt); } catch {}
            }
          } catch {}
        }
        if (videoRef.current) {
          try { videoRef.current.play(); } catch {}
        }
        try { setUserPaused(false); } catch {}
      }
    }
  }, [loading, playbackIntent, captionIndex, scheduleCaptionsForAudio]);

  // Play/pause handler affecting both audio + video
  const togglePlayPause = () => {
    setUserPaused((prev) => {
      const next = !prev;
      // If we are currently loading, defer actual media control to avoid DOMExceptions
      // and race conditions. We still flip the UI state immediately so the button reflects intent.
      if (loading) {
        setPlaybackIntent(next ? 'pause' : 'play');
        return next;
      }
      if (next) {
        // Pausing
        if (audioRef.current) {
          try { audioRef.current.pause(); } catch { /* ignore */ }
        }
        // Record WebAudio paused position before stopping source
        try {
          const ctx = audioCtxRef.current;
          if (ctx && webAudioBufferRef.current && webAudioSourceRef.current) {
            const elapsed = Math.max(0, (ctx.currentTime || 0) - (webAudioStartedAtRef.current || 0));
            webAudioPausedAtRef.current = elapsed;
          }
        } catch { /* ignore */ }
        // Stop any active WebAudio source as well
        try { stopWebAudioSource(); } catch { /* ignore */ }
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
        } else if (webAudioBufferRef.current) {
          // Resume WebAudio from paused offset
          try {
            const ctx = ensureAudioContext();
            if (ctx) {
              stopWebAudioSource();
              const src = ctx.createBufferSource();
              src.buffer = webAudioBufferRef.current;
              src.connect(webAudioGainRef.current || ctx.destination);
              webAudioSourceRef.current = src;
              const offset = Math.max(0, webAudioPausedAtRef.current || 0);
              src.onended = () => {
                try { setIsSpeaking(false); } catch {}
                stopWebAudioSource();
                webAudioStartedAtRef.current = 0;
                webAudioPausedAtRef.current = 0;
              };
              webAudioStartedAtRef.current = ctx.currentTime - offset;
              setIsSpeaking(true);
              src.start(0, offset);
              // Re-schedule captions for the remainder of the batch using remaining duration heuristic
              const startAt = captionIndex;
              const batchEnd = captionBatchEndRef.current || captionSentencesRef.current.length;
              const slice = (captionSentencesRef.current || []).slice(startAt, batchEnd);
              if (slice.length) {
                const remaining = Math.max(0.1, (webAudioBufferRef.current.duration || 0) - offset);
                scheduleCaptionsForDuration(remaining, slice, startAt);
              }
            }
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
    // Clear any deferred playback intent so it does not apply after abort
    try { setPlaybackIntent(null); } catch {}
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

  let { res, data } = await attempt({ instruction: userContent });

      // Dev-only: sometimes the route compiles on first touch and returns 404 briefly.
      // If that happens, pre-warm the route, wait a beat, and retry (forcing full system registration).
      if (res && res.status === 404) {
        try {
          console.warn('[Session] /api/sonoma returned 404; retrying after short delay to allow dev compile...')
        } catch {}
        // Pre-warm the route (GET) to trigger compilation/registration in dev
        try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
        await new Promise(r => setTimeout(r, 900));
  ({ res, data } = await attempt({ instruction: userContent }));
        // If still 404, wait a bit longer and try one more time
        if (res && res.status === 404) {
          try { await fetch('/api/sonoma', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(()=>{}) } catch {}
          await new Promise(r => setTimeout(r, 1200));
          ({ res, data } = await attempt({ instruction: userContent }));
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

    setTranscript(replyText);
    setError("");

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
  // Answer normalization and judging helpers
  // We keep this local (UI-side). The aim is to be forgiving:
  // - case-insensitive; strip punctuation/diacritics; collapse spaces
  // - normalize number words and ordinals to digits
  // - remove common fillers/stopwords
  // - simple stemming for plural/tense variants
  const numberWordMap = useMemo(() => ({
    0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine',
    10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen', 15: 'fifteen', 16: 'sixteen', 17: 'seventeen', 18: 'eighteen', 19: 'nineteen', 20: 'twenty'
  }), []);

  const STOPWORDS = new Set([
    'a','an','the','to','of','in','on','at','and','or','is','are','am','was','were','be','being','been',
    'it','its','it\'s','i','im','i\'m','me','my','mine','you','your','yours','we','us','our','ours',
    'please','thanks','thank','okay','ok','yup','yeah','hey','hi'
  ]);

  const stripDiacritics = (s) => {
    try { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch { return s; }
  };

  const simpleStem = (t) => {
    let w = t;
    w = w.replace(/'(s|re|ve|d|ll|m)$/i, '');
    if (/ies$/i.test(w) && w.length > 3) w = w.slice(0, -3) + 'y';
    else if (/([sxz]|ch|sh)es$/i.test(w) && w.length > 3) w = w.replace(/es$/i, '');
    else if (/s$/i.test(w) && !/ss$/i.test(w) && w.length > 3) w = w.slice(0, -1);
    if (/ing$/i.test(w) && w.length > 4) w = w.slice(0, -3);
    else if (/ed$/i.test(w) && w.length > 3) w = w.replace(/ed$/i, '');
    return w;
  };

  const ORDINALS = new Map(Object.entries({
    'first':'1','second':'2','third':'3','fourth':'4','fifth':'5','sixth':'6','seventh':'7','eighth':'8','ninth':'9','tenth':'10',
    'eleventh':'11','twelfth':'12','thirteenth':'13','fourteenth':'14','fifteenth':'15','sixteenth':'16','seventeenth':'17','eighteenth':'18','nineteenth':'19','twentieth':'20'
  }));

  const SMALLS = new Map(Object.entries({
    zero:0, one:1, two:2, three:3, four:4, five:5, six:6, seven:7, eight:8, nine:9,
    ten:10, eleven:11, twelve:12, thirteen:13, fourteen:14, fifteen:15, sixteen:16, seventeen:17, eighteen:18, nineteen:19
  }));
  const TENS = new Map(Object.entries({
    twenty:20, thirty:30, forty:40, fifty:50, sixty:60, seventy:70, eighty:80, ninety:90
  }));
  const SCALES = new Map(Object.entries({ hundred:100, thousand:1000 }));

  const wordsToNumberFrom = (tokens, start) => {
    let i = start; let total = 0; let current = 0; let consumed = 0; let matched = false;
    while (i < tokens.length) {
      const tk = tokens[i];
      if (SMALLS.has(tk)) { current += SMALLS.get(tk); matched = true; i += 1; consumed += 1; continue; }
      if (TENS.has(tk)) {
        current += TENS.get(tk);
        // optional unit after tens
        if (i + 1 < tokens.length && SMALLS.has(tokens[i+1])) { current += SMALLS.get(tokens[i+1]); i += 1; consumed += 1; }
        matched = true; i += 1; consumed += 1; continue;
      }
      if (SCALES.has(tk)) {
        const scale = SCALES.get(tk);
        if (current === 0) current = 1;
        current *= scale;
        total += current; current = 0;
        matched = true; i += 1; consumed += 1; continue;
      }
      break;
    }
    if (!matched) return null;
    total += current;
    return { value: total, consumed };
  };

  const tokenize = (s) => String(s || '').split(/\s+/).filter(Boolean);

  const normalizeAnswer = (val) => {
    if (val == null) return '';
    let s = String(val).toLowerCase();
    s = stripDiacritics(s);
    // Convert ordinal digits like 1st -> 1
    s = s.replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1');
    // Replace punctuation/underscores/hyphens with spaces
    s = s.replace(/[\-_]/g, ' ');
    s = s.replace(/[^a-z0-9\s]/g, ' ');
    s = s.replace(/\s+/g, ' ').trim();
    // Early return for pure digits
    if (/^-?\d+$/.test(s)) return String(parseInt(s, 10));
    // Normalize ordinal words
    const ord = ORDINALS.get(s);
    if (ord) return ord;
    // Tokenize for number-word sequences and stopwords/stemming
    let toks = tokenize(s);
    // Map ordinal words to digits at token level
    toks = toks.map(t => ORDINALS.get(t) || t);
    // Replace sequences of number words with digits
    const out = [];
    for (let i = 0; i < toks.length; ) {
      const res = wordsToNumberFrom(toks, i);
      if (res && res.consumed > 0) {
        out.push(String(res.value));
        i += res.consumed; continue;
      }
      out.push(toks[i]); i += 1;
    }
    // Remove stopwords and stem
    const out2 = out
      .filter(t => !STOPWORDS.has(t))
      .map(t => simpleStem(t))
      .filter(Boolean);
    return out2.join(' ').trim();
  };

  // Token helper from normalized text
  const tokensFromNormalized = (s) => tokenize(normalizeAnswer(s));

  // Tiny Levenshtein for fuzzy token equality (length <= 20)
  const levenshtein = (a, b) => {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (al === 0) return bl; if (bl === 0) return al;
    const dp = new Array(bl + 1);
    for (let j = 0; j <= bl; j++) dp[j] = j;
    for (let i = 1; i <= al; i++) {
      let prev = i - 1; dp[0] = i;
      for (let j = 1; j <= bl; j++) {
        const tmp = dp[j];
        dp[j] = Math.min(
          dp[j] + 1,
          dp[j - 1] + 1,
          prev + (a[i - 1] === b[j - 1] ? 0 : 1)
        );
        prev = tmp;
      }
    }
    return dp[bl];
  };

  // Unified local correctness check with leniency
  const isAnswerCorrectLocal = (learnerRaw, acceptableList, problem) => {
    const learnerNorm = normalizeAnswer(String(learnerRaw ?? ''));
    const accNorm = Array.from(new Set((acceptableList || []).map(a => normalizeAnswer(String(a ?? '')))));

    // Accept single MC letter embedded (e.g., "I think b")
    const letterMatch = learnerNorm.match(/(?:^|\s)([a-d])(?:\s|$)/i);
    if (letterMatch) {
      const letter = letterMatch[1].toLowerCase();
      if (accNorm.includes(letter)) return true;
    }

    // True/False synonyms mapping when applicable
    const isTFq = isTrueFalse(problem);
    if (isTFq) {
      const TRUE_SYNS = new Set(['true','t','yes','y','correct','right']);
      const FALSE_SYNS = new Set(['false','f','no','n','incorrect','wrong']);
      if (accNorm.includes('true') && TRUE_SYNS.has(learnerNorm)) return true;
      if (accNorm.includes('false') && FALSE_SYNS.has(learnerNorm)) return true;
    }

    // Exact normalized equality
    if (accNorm.includes(learnerNorm)) return true;

    // Token-subset acceptance: all core tokens of an acceptable phrase appear in learner tokens (order-free)
    const learnerTokens = new Set(tokensFromNormalized(learnerNorm));
    for (const a of accNorm) {
      if (/^[a-d]$/i.test(a)) continue; // skip bare letters here
      const aTokens = tokensFromNormalized(a).filter(t => !STOPWORDS.has(t));
      if (aTokens.length && aTokens.every(t => learnerTokens.has(t))) return true;
    }

    // Short-answer keyword path for non-MC/TF
    const hasChoices = isMultipleChoice(problem);
    if (!hasChoices && !isTFq) {
      const kws = Array.isArray(problem?.keywords) ? problem.keywords.filter(Boolean).map(String) : [];
      const minK = Number.isInteger(problem?.minKeywords) ? problem.minKeywords : (kws.length ? 1 : 0);
      if (kws.length && minK >= 0) {
        const ltoks = Array.from(learnerTokens);
        let hits = 0;
        for (const kw of kws) {
          const kwTokens = tokensFromNormalized(kw);
          // All tokens of a keyword phrase must be present (with light fuzz) to count as one hit
          const ok = kwTokens.length > 0 && kwTokens.every(kt => {
            if (learnerTokens.has(kt)) return true;
            // fuzzy for tokens length >= 4 (distance <= 1)
            if (kt.length >= 4) {
              return ltoks.some(t => Math.abs(t.length - kt.length) <= 1 && levenshtein(t, kt) <= 1);
            }
            return false;
          });
          if (ok) hits += 1;
        }
        if (hits >= minK) return true;
      }
    }
    return false;
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

  // Riddles: expand simple acceptable variants for common phrasing
  // - Drop leading articles (a, an, the)
  // - Drop leading possessives (your, my, our, their, his, her)
  // - If answer is "(the) letter X", accept just "X"
  const expandRiddleAcceptables = (answer) => {
    const variants = new Set();
    const raw = String(answer || '').trim();
    if (!raw) return [];
    variants.add(raw);
    // Drop leading article
    const noArticle = raw.replace(/^\s*(?:a|an|the)\s+/i, '').trim();
    if (noArticle && noArticle !== raw) variants.add(noArticle);
    // Drop leading possessive pronouns
    const noPoss = raw.replace(/^\s*(?:your|my|our|their|his|her)\s+/i, '').trim();
    if (noPoss && noPoss !== raw) variants.add(noPoss);
    // If of the form "(the )?letter X" -> accept just X
    const m = raw.match(/^\s*(?:the\s+)?letter\s+([a-z])\s*$/i);
    if (m && m[1]) {
      variants.add(m[1]);
      variants.add(m[1].toLowerCase());
      variants.add(m[1].toUpperCase());
    }
    return Array.from(variants);
  };

  // Build a combined expected bundle line: primary, optional any, optional acceptable
  // String format (ASCII; single line):
  // primary=<value>; any=[v1, v2]; acceptable=[a1, a2]
  // Fallbacks: primary_final = first non-empty of [primary, any[0], acceptable[0]]
  // Omit any segment if empty; omit acceptable only if truly empty.
  const composeExpectedBundle = ({ primary, any, acceptable } = {}) => {
    const arrify = (v) => Array.isArray(v) ? v : (v == null ? [] : [v]);
    const toStr = (v) => {
      if (v == null) return '';
      const s = String(v).trim();
      return s;
    };
    const uniq = (list) => {
      const out = [];
      const seen = new Set();
      for (const v of list) {
        const s = toStr(v);
        if (!s) continue;
        if (!seen.has(s)) { seen.add(s); out.push(s); }
      }
      return out;
    };
    const primaryStr = toStr(primary);
    const anyList = uniq(arrify(any));
    const acceptableListBase = uniq(arrify(acceptable));
    // Determine primary_final
    const primaryFinal = primaryStr || (anyList.length ? anyList[0] : '') || (acceptableListBase.length ? acceptableListBase[0] : '');
    // Build acceptable list including primaryFinal (when truthy), then dedupe
    const acceptableList = uniq([primaryFinal, ...acceptableListBase]);
    const parts = [];
    parts.push('primary=' + (primaryFinal ?? ''));
    if (anyList.length) parts.push('any=[' + anyList.join(', ') + ']');
    if (acceptableList.length) parts.push('acceptable=[' + acceptableList.join(', ') + ']');
    return parts.join('; ');
  };

  // Format multiple-choice options for speech (e.g., "A) ..., B) ..., C) ...")
  const formatMcOptions = (item, { layout = 'inline' } = {}) => {
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
        // Use NBSP between label and option text to prevent wrapping between them
        return `${label}.\u00A0${cleaned}`;
      });
      if (layout === 'multiline') {
        return parts.join('\n');
      }
      // Default inline with spaced commas for readability
      return parts.join(',   ');
    } catch {
      return '';
    }
  };

  // Phase-agnostic question formatting helpers
  const isTrueFalse = (item) => {
    try {
      // Normalize several possible fields
      const sourceType = String(item?.sourceType || '').toLowerCase();
      const typeField = String(item?.type || '').toLowerCase();
      const qType = String(item?.questionType || '').toLowerCase();
      if (sourceType === 'tf' || qType === 'tf') return true;
      if (/^(true\s*\/\s*false|truefalse|tf)$/i.test(typeField)) return true;
      if (/^(true\s*\/\s*false|truefalse|tf)$/i.test(qType)) return true;
      // Heuristic: treat as TF when expected/answer is literally true/false
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

  // Basic multiple-choice detection: has options/choices array with 2+ items and not TF
  const isMultipleChoice = (item) => {
    try {
      const opts = Array.isArray(item?.options)
        ? item.options.filter(Boolean)
        : (Array.isArray(item?.choices) ? item.choices.filter(Boolean) : []);
      if (!opts || opts.length < 2) return false;
      return !isTrueFalse(item);
    } catch { return false; }
  };

  // Lightweight validators for inline MC ask
  const hasInlineMcChoices = (s) => {
    try {
      const t = String(s || '');
      // Expect at least A. and B. present on the same line as the question mark
      const line = t.split(/\n/).pop();
      return /\bA\s*\./.test(line) && /\bB\s*\./.test(line);
    } catch { return false; }
  };
  const countQuestionMarks = (s) => {
    try { return (String(s || '').match(/\?/g) || []).length; } catch { return 0; }
  };
  const formatQuestionForSpeech = useCallback((item, { layout = 'inline' } = {}) => {
    if (!item) return '';
    const tfPrefix = isTrueFalse(item) ? 'True/False: ' : '';
    const mc = formatMcOptions(item, { layout });
    const base = String(item.prompt || item.question || '').trim();
    // Put MC options on a new line; keep them comma-separated
    return mc ? `${tfPrefix}${base}\n${mc}` : `${tfPrefix}${base}`;
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
      const raw = String(s || '');
      if (!raw) return raw;
      const parts = raw.split('\n');
      if (!parts.length) return raw;
      const q = parts[0].trim();
      const withQM = q.endsWith('?') ? q : q.replace(/[.!]+$/, '') + '?';
      return [withQM, ...parts.slice(1)].join('\n');
    } catch {
      return s;
    }
  };

  // Ensure a single terminal question mark at the very end of the line (one line only)
  const ensureSingleTerminalQuestionMark = (s) => {
    try {
      const raw = String(s || '');
      if (!raw) return raw;
      // Strip trailing punctuation and whitespace, then append exactly one '?'
      const withoutTrail = raw.replace(/\s*[?.!]+$/, '').trimEnd();
      return `${withoutTrail}?`;
    } catch {
      return s;
    }
  };

  // Build a single-line ask string; for MC, include lettered choices inline on the same line
  const formatQuestionForInlineAsk = (item) => {
    if (!item) return '';
    try {
      const tfPrefix = isTrueFalse(item) ? 'True/False: ' : '';
      const baseRaw = String(item.prompt || item.question || '').trim();
      // Remove any trailing sentence punctuation from the stem; we'll add the final '?' at the very end later
      const base = baseRaw.replace(/\s*[?.!]+$/, '');
      const mcLine = formatMcOptions(item); // already single-line like "A.\u00A0foo,   B.\u00A0bar"
      const line = mcLine ? `${tfPrefix}${base} ${mcLine}` : `${tfPrefix}${base}`;
      // Avoid collapsing non-breaking spaces; only trim ends
      return line.trim();
    } catch {
      return '';
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
      const tokenize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).filter(w => !['a','an','the'].includes(w));
      for (let i = 0; i < opts.length; i += 1) {
        const label = labels[i] || '';
        const raw = String(opts[i] ?? '').trim();
        // Strip ANY leading letter label for comparison
        const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.\:\)\-]\s*/i;
        const cleaned = raw.replace(anyLabel, '').trim();
        const nclean = norm(cleaned);
        if (acc.includes(nclean)) return label || null;
        // Also accept when acceptable term tokens are contained within option tokens (e.g., 'notebook' ⊆ 'a notebook')
        const optTokens = tokenize(nclean);
        for (const a of acc) {
          const accTokens = tokenize(a);
          if (accTokens.length && accTokens.every(t => optTokens.includes(t))) {
            return label || null;
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  // Join list into natural language (A, B, or C)
  const naturalJoin = (arr, conj = 'or') => {
    const list = (arr || []).map(s => String(s || '').trim()).filter(Boolean);
    if (!list.length) return '';
    if (list.length === 1) return list[0];
    if (list.length === 2) return `${list[0]} ${conj} ${list[1]}`;
    return `${list.slice(0, -1).join(', ')}, ${conj} ${list[list.length - 1]}`;
  };

  // Derive a speakable/displayable "correct answer" text using front-end info
  const deriveCorrectAnswerText = (problem, acceptableList = [], expectedPrimary = '') => {
    try {
      const rawExpected = [problem?.answer, problem?.expected].map(v => String(v ?? '').trim()).find(Boolean) || '';
      const options = Array.isArray(problem?.options) ? problem.options : (Array.isArray(problem?.choices) ? problem.choices : []);
      // MC: prefer letter + option text
      const letter = letterForAnswer(problem, acceptableList);
      if (letter) {
        const optText = getOptionTextForLetter(problem, letter) || '';
        if (optText) return `${letter}. ${optText}`;
        return letter;
      }
      // True/False: map synonyms to canonical
      if (isTrueFalse(problem)) {
        const accNorm = new Set((acceptableList || []).map(a => normalizeAnswer(a)));
        if (accNorm.has('true')) return 'True';
        if (accNorm.has('false')) return 'False';
        if (/^\s*true\s*$/i.test(rawExpected)) return 'True';
        if (/^\s*false\s*$/i.test(rawExpected)) return 'False';
      }
      // Prefer raw expected text if provided
      if (rawExpected) return rawExpected;
      // Otherwise use the first meaningful acceptable (skip bare letters)
      const acceptableClean = Array.from(new Set((acceptableList || [])
        .map(s => String(s || '').trim())
        .filter(Boolean)
        .filter(s => !/^[A-D]$/i.test(s))));
      if (acceptableClean.length) {
        // If many, present up to 3 joined with 'or'
        return naturalJoin(acceptableClean.slice(0, 3), 'or');
      }
      // As a last resort, surface keywords for short answer items
      if (!isMultipleChoice(problem) && !isTrueFalse(problem) && Array.isArray(problem?.keywords) && problem.keywords.length) {
        const kws = problem.keywords.map(k => String(k || '').trim()).filter(Boolean);
        if (kws.length) return naturalJoin(kws.slice(0, 4), 'and');
      }
      // Nothing to show
      return '';
    } catch {
      return '';
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
    try { console.info('[Opening] startDiscussionStep entered'); } catch {}
    try { console.info('[Opening] generateOpening typeof =', typeof generateOpening); } catch {}
    // Ensure audio is unlocked and mic permissions requested within the Begin click gesture
  // mic permission will be requested only when user starts recording
    // Ensure we are not starting in a muted or paused state
    try { setMuted(false); } catch {}
    try { setUserPaused(false); } catch {}
    try { mutedRef.current = false; } catch {}
    try { forceNextPlaybackRef.current = true; } catch {}
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
      try { console.info('[OpeningTTS] POST /api/tts starting…'); } catch {}
      let res;
      try {
        res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: replyText }) });
        try { console.info('[OpeningTTS] /api/tts status=', res.status, 'ok=', res.ok); } catch {}
        var data = await res.json().catch(() => ({}));
        try { console.info('[OpeningTTS] /api/tts payload keys=', Object.keys(data || {})); } catch {}
        var audioB64 = (data && (data.audio || data.audioBase64 || data.audioContent || data.content || data.b64)) || '';
        // Dev warm-up: if route wasn’t ready (404) or no audio returned, pre-warm and retry once
        if ((!res.ok && res.status === 404) || !audioB64) {
          try { console.warn('[OpeningTTS] No audio or 404 from /api/tts; warming route and retrying once…'); } catch {}
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
        try { console.info('[OpeningTTS] Fallback: POST /api/tts starting…'); } catch {}
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
  const [teachingStage, setTeachingStage] = useState('idle'); // 'idle' | 'definitions' | 'explanation' | 'examples'
  const [stageRepeats, setStageRepeats] = useState({ definitions: 0, explanation: 0, examples: 0 });

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
    return uniq.slice(0, 5); // 3–5 terms
  }, [getCleanLessonTitle]);

  const hasVocab = useMemo(() => {
    try {
      const v = getAvailableVocab();
      return Array.isArray(v) && v.length > 0;
    } catch { return false; }
  }, [getAvailableVocab]);

  const promptGateRepeat = useCallback(async () => {
    // Hard-wired spoken gate with captions
    try { await speakFrontend('Do you want me to go over that again?'); } catch {}
    setSubPhase('awaiting-gate');
    setCanSend(false); // gated via buttons
  }, [speakFrontend]);

  const teachDefinitions = useCallback(async (isRepeat = false) => {
    setCanSend(false);
    // Hide gate UI while speaking this stage
    setSubPhase('teaching-3stage');
    // Frontend-only announcement before API call
    if (!isRepeat) {
      try { await speakFrontend("First let's go over some definitions."); } catch {}
    }
  // Make sure lesson data is present before extracting vocab
  const loaded = await ensureLessonDataReady();
  const vocabList = getAvailableVocab(loaded || undefined);
  const hasAnyVocab = Array.isArray(vocabList) && vocabList.length > 0;
  // Use only lesson-provided vocab; do not fall back to title-derived terms
  // Be robust: accept {term}|{word}|{key} or raw string items, then de-duplicate case-insensitively
  const terms = hasAnyVocab
    ? Array.from(new Map(
        vocabList
          .map(v => {
            const raw = (typeof v === 'string') ? v : (v?.term || v?.word || v?.key || '');
            const t = (raw || '').trim();
            return t ? [t.toLowerCase(), t] : null;
          })
          .filter(Boolean)
      ).values())
    : [];
    const gradeText = getGradeNumber();
    const lessonTitle = getCleanLessonTitle();
    const vocabCsv = terms.join(', ');
    try {
      if (!terms.length) {
        console.warn('[Definitions] No vocab terms found to inject. lesson has keys:', Object.keys(loaded || lessonData || {}));
      } else {
        console.info('[Definitions] Injecting vocab terms:', terms);
      }
    } catch {}
    const instruction = [
      '',
      `Grade: ${gradeText || ''}`.trim(),
      '',
      `Lesson: (do not read aloud): "${lessonTitle}"`,
      '',
      'No intro: Do not greet or introduce yourself; begin immediately with the definitions.',
      '',
  `Definitions: Define these words: ${vocabCsv}. Keep it warm, playful, and brief. Do not ask a question.`,
      '',
      "Kid-friendly: Use simple everyday words a 5 year old can understand. Keep sentences short (about 6–12 words). Avoid big words and jargon. If you must use one, add a quick kid-friendly meaning in parentheses. Use a warm, friendly tone with everyday examples. Speak directly to the learner using 'you' and 'we'. One idea per sentence; do not pack many steps into one sentence.",
      '',
      'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, ASCII art, bullet lines, or other symbols that would be awkward to read aloud.'
    ].join('\n');
    const result = await callMsSonoma(
      instruction,
      '',
      {
        phase: 'teaching',
        subject: subjectParam,
        difficulty: difficultyParam,
        lesson: lessonParam,
        lessonTitle: effectiveLessonTitle,
        step: isRepeat ? 'definitions-repeat' : 'definitions',
        teachingNotes: getTeachingNotes() || undefined,
        // Provide explicit vocab when available
        vocab: hasAnyVocab ? vocabList : [],
        stage: 'definitions'
      }
    );
    return !!result.success;
  }, [ensureLessonDataReady, getAvailableVocab, getGradeNumber, getCleanLessonTitle, subjectParam, difficultyParam, lessonParam, effectiveLessonTitle]);

  const teachExplanation = useCallback(async (isRepeat = false) => {
    setCanSend(false);
    // Hide gate UI while speaking this stage
    setSubPhase('teaching-3stage');
    // Frontend-only announcement before API call
    if (!isRepeat) {
      try { await speakFrontend("Now I'll explain the lesson."); } catch {}
    }
    const gradeText = getGradeNumber();
    const lessonTitle = getCleanLessonTitle();
    const notes = getTeachingNotes() || '';
    const instruction = [
      '',
      `Grade: ${gradeText || ''}`.trim(),
      '',
      `Lesson: (do not read aloud): "${lessonTitle}"`,
      '',
      `Teaching notes (for your internal guidance; integrate naturally—do not read verbatim): ${notes}`,
      'No intro: Do not greet or introduce yourself; begin immediately with the explanation.',
      'Explanation: Explain the lesson using the Teaching notes only. Keep it short, warm, and playful. Do not ask a question.',
      '',
      'Kid-friendly style rules: Use simple everyday words a 5 year old can understand. Keep sentences short (about 6–12 words). Avoid big words and jargon. If you must use one, add a quick kid-friendly meaning in parentheses. Use a warm, friendly tone with everyday examples. Speak directly to the learner using \"you\" and \"we\". One idea per sentence; do not pack many steps into one sentence.',
      '',
      'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, ASCII art, bullet lines, or other symbols that would be awkward to read aloud.'
    ].join('\n');
    const result = await callMsSonoma(
      instruction,
      '',
      {
        phase: 'teaching',
        subject: subjectParam,
        difficulty: difficultyParam,
        lesson: lessonParam,
        lessonTitle: effectiveLessonTitle,
        step: isRepeat ? 'explanation-repeat' : 'explanation',
        teachingNotes: notes || undefined,
        // Do not include vocab during explanation
        vocab: [],
        stage: 'explanation'
      }
    );
    return !!result.success;
  }, [getGradeNumber, getCleanLessonTitle, subjectParam, difficultyParam, lessonParam, effectiveLessonTitle]);

  const teachExamples = useCallback(async (isRepeat = false) => {
    setCanSend(false);
    // Hide gate UI while speaking this stage
    setSubPhase('teaching-3stage');
    // Frontend-only announcement before API call
    if (!isRepeat) {
      try { await speakFrontend("Now let's see this in action."); } catch {}
    }
    const lessonTitle = getCleanLessonTitle();
    const notes = getTeachingNotes() || '';
    const instruction = [
      '',
      `Teaching notes (for your internal guidance; integrate naturally—do not read verbatim): ${notes}`,
      '',
      'No intro: Do not greet or introduce yourself; begin immediately with the examples.',
      'Examples: Show 2–3 tiny worked examples appropriate for this lesson. You compute every step. Be concise, warm, and playful. Do not add definitions or broad explanations beyond what is needed to show the steps. Do not do an introduction or a wrap; give only the examples.',
      '',
      'Kid-friendly style rules: Use simple everyday words a 5–7 year old can understand. Keep sentences short (about 6–12 words). Avoid big words and jargon. If you must use one, add a quick kid-friendly meaning in parentheses. Use a warm, friendly tone with everyday examples. Speak directly to the learner using \"you\" and \"we\". One idea per sentence; do not pack many steps into one sentence.',
      '',
      'Always respond with natural spoken text only. Do not use emojis, decorative characters, repeated punctuation, ASCII art, bullet lines, or other symbols that would be awkward to read aloud.'
    ].join('\n');
    const result = await callMsSonoma(
      instruction,
      '',
      {
        phase: 'teaching',
        subject: subjectParam,
        difficulty: difficultyParam,
        lesson: lessonParam,
        lessonTitle: effectiveLessonTitle,
        step: isRepeat ? 'examples-repeat' : 'examples',
        teachingNotes: notes || undefined,
        // Do not include vocab during examples
        vocab: [],
        stage: 'examples'
      }
    );
    return !!result.success;
  }, [getCleanLessonTitle, subjectParam, difficultyParam, lessonParam, effectiveLessonTitle]);

  const startThreeStageTeaching = useCallback(async () => {
    // Mark subPhase to a neutral value so legacy auto-advance doesn't trigger
    setSubPhase('teaching-3stage');
    setPhase('teaching');
    // Always begin with Definitions. If no explicit vocab is provided, we will extract key terms from notes.
    try {
      const loaded = await ensureLessonDataReady();
      const v = getAvailableVocab(loaded || undefined);
      const detectedCount = Array.isArray(v) ? v.length : 0;
      console.info('[Teaching] Start: forcing definitions first; detectedVocabCount=', detectedCount);
    } catch {}
    setTeachingStage('definitions');
    let ok = await teachDefinitions(false);
    if (ok) await promptGateRepeat();
  }, [ensureLessonDataReady, getAvailableVocab, teachDefinitions, promptGateRepeat]);

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
    // Disable text input; gate is controlled by Yes/No UI buttons
    setCanSend(false);
    setTeachingRepeats((c) => c + 1);
  };

  // Teaching gate UI handlers for three-stage flow
  const handleGateYes = useCallback(async () => {
    try { console.info('[Gate] YES clicked: repeat stage', teachingStage); } catch {}
    if (teachingStage === 'definitions') {
      const ok = await teachDefinitions(true);
      if (ok) {
        setStageRepeats((s) => ({ ...s, definitions: (s.definitions || 0) + 1 }));
        await promptGateRepeat();
      }
      return;
    }
    if (teachingStage === 'explanation') {
      const ok = await teachExplanation(true);
      if (ok) {
        setStageRepeats((s) => ({ ...s, explanation: (s.explanation || 0) + 1 }));
        await promptGateRepeat();
      }
      return;
    }
    if (teachingStage === 'examples') {
      const ok = await teachExamples(true);
      if (ok) {
        setStageRepeats((s) => ({ ...s, examples: (s.examples || 0) + 1 }));
        await promptGateRepeat();
      }
      return;
    }
  }, [teachingStage, teachDefinitions, teachExplanation, teachExamples, promptGateRepeat]);

  const moveToComprehensionWithCue = useCallback(async () => {
    // Use the existing caption pipeline with TTS cue
    setCanSend(false);
    const cue = COMPREHENSION_CUE_PHRASE;
    let sentences = splitIntoSentences(cue);
    try { sentences = mergeMcChoiceFragments(sentences).map((s) => enforceNbspAfterMcLabels(s)); } catch {}
    const prevLen = captionSentencesRef.current?.length || 0;
    try {
      const nextAll = [...(captionSentencesRef.current || []), ...sentences];
      captionSentencesRef.current = nextAll;
      setCaptionSentences(nextAll);
      setCaptionIndex(prevLen);
    } catch {}
    const FALLBACK_SECS = 1.8;
    let transitioned = false;
    try {
      setTtsLoadingCount((c) => c + 1);
      let res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: cue }) });
      if (!res.ok) { try { await fetch('/api/tts', { method: 'GET', headers: { 'Accept': 'application/json' } }).catch(() => {}); } catch {}
        res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: cue }) }); }
      if (res.ok) {
        const data = await res.json();
        let b64 = (data && data.audio) ? String(data.audio) : '';
        if (b64) {
          setTtsLoadingCount((c) => Math.max(0, c - 1));
          b64 = b64.replace(/^data:audio\/[a-zA-Z0-9.-]+;base64,/, '').trim();
          try { await playAudioFromBase64(b64, sentences, prevLen); } catch {}
          setPhase('comprehension');
          setSubPhase('comprehension-start');
          setCurrentCompProblem(null);
          setCanSend(false);
          transitioned = true;
        }
      }
  } catch {}
    finally { setTtsLoadingCount((c) => Math.max(0, c - 1)); }
    if (!transitioned) {
      // no audio path: decrement before showing fallback timing
      setTtsLoadingCount((c) => Math.max(0, c - 1));
      try { if (typeof scheduleCaptionsForDuration === 'function') scheduleCaptionsForDuration(FALLBACK_SECS, sentences, prevLen); } catch {}
      await new Promise(r => setTimeout(r, FALLBACK_SECS * 1000 + 150));
      setPhase('comprehension');
      setSubPhase('comprehension-start');
      setCurrentCompProblem(null);
      setCanSend(false);
    }
  }, [playAudioFromBase64, scheduleCaptionsForDuration]);

  const handleGateNo = useCallback(async () => {
    try { console.info('[Gate] NO clicked: next stage', teachingStage); } catch {}
    if (teachingStage === 'definitions') {
      // Advance to Explanation
      setTeachingStage('explanation');
      const ok = await teachExplanation(false);
      if (ok) await promptGateRepeat();
      return;
    }
    if (teachingStage === 'explanation') {
      // Advance to Examples
      setTeachingStage('examples');
      const ok = await teachExamples(false);
      if (ok) await promptGateRepeat();
      return;
    }
    if (teachingStage === 'examples') {
      // Done with three stages: cue comprehension
      setTeachingStage('idle');
      await moveToComprehensionWithCue();
      return;
    }
  }, [teachingStage, teachExplanation, teachExamples, promptGateRepeat, moveToComprehensionWithCue]);

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
          try { const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none'; saveAssessments(key, { worksheet: source, test: generatedTest || [], comprehension: compPool || [], exercise: exercisePool || [] }, { learnerId: lid }); } catch {}
        }
      }
    }
    if (!source?.length) {
      setDownloadError("Worksheet content is unavailable for this lesson.");
      return;
    }
    await createPdfForItems(source.map((q, i) => ({ ...q, number: i + 1 })), "worksheet", previewWin);
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
          try { const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none'; saveAssessments(key, { worksheet: generatedWorksheet || [], test: source, comprehension: compPool || [], exercise: exercisePool || [] }, { learnerId: lid }); } catch {}
        }
      }
    }
    if (!source?.length) {
      setDownloadError("Test content is unavailable for this lesson.");
      return;
    }
    await createPdfForItems(source.map((q, i) => ({ ...q, number: i + 1 })), "test", previewWin);
  };

  // Download combined answer key (worksheet + test) in a single PDF
  const handleDownloadAnswers = async () => {
    const ok = await ensurePinAllowed('download');
    if (!ok) return;
    const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    try { showTipOverride('Tip: If nothing opens, allow pop-ups for this site.'); } catch {}
    setDownloadError("");
    // Ensure we have generated sets or fallback to existing lesson arrays
    let ws = generatedWorksheet;
    let ts = generatedTest;
    if ((!ws || !ws.length || !ts || !ts.length) && lessonData) {
      // Attempt minimal synchronous generation ONLY if arrays empty and lessonData present (reuse logic lightly)
      try {
        if ((!ws || !ws.length) && (Array.isArray(lessonData.worksheet) && lessonData.worksheet.length)) {
          ws = lessonData.worksheet.slice(0, WORKSHEET_TARGET || 20).map((q, i) => ({ ...q, number: i + 1 }));
        }
        if ((!ts || !ts.length) && (Array.isArray(lessonData.test) && lessonData.test.length)) {
          ts = lessonData.test.slice(0, TEST_TARGET || 20).map((q, i) => ({ ...q, number: i + 1 }));
        }
      } catch {}
    }
    // If still nothing to show, surface error
    if ((!ws || !ws.length) && (!ts || !ts.length)) {
      setDownloadError('No worksheet or test content available for answers.');
      return;
    }
    const itemsWorksheet = Array.isArray(ws) ? ws.map((q, i) => ({ ...q, number: q.number || (i + 1) })) : [];
    const itemsTest = Array.isArray(ts) ? ts.map((q, i) => ({ ...q, number: q.number || (i + 1) })) : [];

    // Build PDF with both sections using same jsPDF instance
    try {
      const doc = new jsPDF();
      const lessonTitle = (lessonData?.title || manifestInfo.title || 'Lesson').trim();
      let y = 14;
  doc.setFontSize(18);
  doc.text(`${lessonTitle} Facilitator Key`, 14, y);
      y += 10;
      const normalFont = () => { try { doc.setFontSize(12); } catch {} };
      normalFont();

      const renderAnswerLine = (label, num, prompt, answer) => {
        const wrapWidth = 180;
        const header = `${label} ${num}. ${prompt}`.trim();
        const headerLines = doc.splitTextToSize(header, wrapWidth);
        headerLines.forEach(line => {
          if (y > 280) { doc.addPage(); y = 14; normalFont(); }
          doc.text(line, 14, y); y += 6;
        });
        const ansLines = doc.splitTextToSize(`Answer: ${answer}`, wrapWidth);
        ansLines.forEach(line => {
          if (y > 280) { doc.addPage(); y = 14; normalFont(); }
          doc.text(line, 20, y); y += 6;
        });
        y += 2;
      };

      const extractAnswer = (q) => {
        try {
          if (!q) return '—';
          // Possible fields: answer, expected, correct, key, solution; MC: correct option; TF: boolean; FIB may have blanks array; short answer might have expected
          if (Array.isArray(q.answers)) return q.answers.join(', ');
          if (Array.isArray(q.expected)) return q.expected.join(', ');
          if (Array.isArray(q.answer)) return q.answer.join(', ');
          const direct = q.expected || q.answer || q.solution || q.correct || q.key;
          if (typeof direct === 'string' && direct.trim()) return direct.trim();
          if (typeof direct === 'number') return String(direct);
          if (typeof q === 'object') {
            // Multiple choice pattern: convert numeric index to letter + choice text (like buildCanonicalAnswer)
            if (Array.isArray(q.choices)) {
              // Determine correct via correctIndex or by matching expected among choices
              let idx = Number.isFinite(q.correctIndex) ? q.correctIndex : -1;
              if (idx < 0 && (q.expected || q.answer)) {
                const target = String(q.expected || q.answer).trim().toLowerCase();
                idx = q.choices.findIndex(c => String(c).trim().toLowerCase() === target);
              }
              if (idx >= 0 && idx < q.choices.length) {
                const letter = String.fromCharCode(65 + idx); // A, B, C, D...
                const choiceText = String(q.choices[idx]).trim();
                return `${letter}) ${choiceText}`;
              }
            }
            if (Array.isArray(q.choices) && (typeof q.correct === 'string' || typeof q.correct === 'number')) {
              // correct holds either the exact matching choice text or an index
              if (typeof q.correct === 'number') {
                const idx = q.correct;
                if (idx >= 0 && idx < q.choices.length) {
                  const letter = String.fromCharCode(65 + idx);
                  const choiceText = String(q.choices[idx]).trim();
                  return `${letter}) ${choiceText}`;
                }
              } else {
                // correct is a string - try to find its letter
                const target = q.correct.trim().toLowerCase();
                const idx = q.choices.findIndex(c => String(c).trim().toLowerCase() === target);
                if (idx >= 0) {
                  const letter = String.fromCharCode(65 + idx);
                  return `${letter}) ${q.correct}`;
                }
                return q.correct;
              }
            }
            if (typeof q.isTrue === 'boolean') return q.isTrue ? 'True' : 'False';
            if (typeof q.trueFalse === 'boolean') return q.trueFalse ? 'True' : 'False';
          }
          return '—';
        } catch { return '—'; }
      };

      if (itemsWorksheet.length) {
        doc.setFontSize(16); doc.text('Worksheet Answers', 14, y); y += 8; normalFont();
        itemsWorksheet.forEach(q => {
          const prompt = (q.prompt || q.question || q.text || '').toString().trim();
          renderAnswerLine('W', q.number, prompt, extractAnswer(q));
        });
        y += 4;
      }
      if (itemsTest.length) {
        if (y > 250) { doc.addPage(); y = 14; }
        doc.setFontSize(16); doc.text('Test Answers', 14, y); y += 8; normalFont();
        itemsTest.forEach(q => {
          const prompt = (q.prompt || q.question || q.text || '').toString().trim();
          renderAnswerLine('T', q.number, prompt, extractAnswer(q));
        });
      }

  // Filename: use the lesson ID (filename without .json) to ensure stable, predictable naming
  const lessonIdForName = String(manifestInfo?.file || lessonParam || 'lesson').replace(/\.json$/i, '');
  const fileName = `${lessonIdForName}-key.pdf`;
      try {
        const blob = doc.output('blob');
        await shareOrPreviewPdf(blob, fileName, previewWin);
      } catch { doc.save(fileName); }
    } catch (e) {
      console.warn('[Session] Failed to build answers PDF', e);
      setDownloadError('Failed to generate answers PDF.');
    }
  };

  // Download Facilitator Key (Lesson Notes, Vocab, Worksheet Q&A, Test Q&A) forced into one page when possible
  const handleDownloadWorksheetTestCombined = async () => {
    const ok = await ensurePinAllowed('facilitator-key');
    if (!ok) return;
    const previewWin = typeof window !== 'undefined' ? window.open('about:blank', '_blank') : null;
    try { showTipOverride('Tip: If nothing opens, allow pop-ups for this site.'); } catch {}
    setDownloadError('');
  // Use existing generated cached sets only (do not attempt regeneration here)
  const ws = Array.isArray(worksheetSourceFull) ? worksheetSourceFull : (Array.isArray(generatedWorksheet) ? generatedWorksheet : []);
  const ts = Array.isArray(testSourceFull) ? testSourceFull : (Array.isArray(generatedTest) ? generatedTest : []);
  if (!ws.length && !ts.length) { setDownloadError('No worksheet or test content available. Refresh first.'); return; }
    try {
      const doc = new jsPDF();
      const lessonTitle = (lessonData?.title || manifestInfo.title || 'Lesson').trim();
      // Single page constraints; scale down font and, if needed, use two-column fallback for Q&A sections.
      const MAX_SIZE = 12; // start modest to improve fit
      const MIN_SIZE = 5;
      const LINE_GAP = 1.0;
      const LEFT = 8;
      const TOP = 14;
      const BOTTOM_LIMIT = 285; // mm bottom cut
      const PAGE_WIDTH = 210; // A4 width
      const PAGE_INNER_WIDTH = PAGE_WIDTH - (LEFT * 2);
      // Canonical answer derivation mirroring judging logic precedence.
      const buildCanonicalAnswer = (q, debug = false) => {
        if (!q || typeof q !== 'object') return '—';
        const usedKeys = new Set();
        const parts = [];
        const push = (key, val) => {
          if (val == null) return;
          if (Array.isArray(val)) { val.forEach(v => push(key, v)); return; }
          const s = String(val).trim();
          if (!s) return;
          parts.push(s);
          if (key) usedKeys.add(key);
        };

        // Primary single-value style fields (first non-empty wins ordering prominence)
        const primaryOrder = ['expected','answer','expectedAnswer','expectedOutput','solution','key','correct'];
        for (const k of primaryOrder) { if (q[k] != null) push(k, q[k]); }

        // Acceptable / any-of variants
        if (Array.isArray(q.expectedAny) && q.expectedAny.length) push('expectedAny', q.expectedAny);
        if (Array.isArray(q.acceptableAnswers) && q.acceptableAnswers.length) push('acceptableAnswers', q.acceptableAnswers);
        if (Array.isArray(q.acceptable) && q.acceptable.length) push('acceptable', q.acceptable);
        if (Array.isArray(q.answers) && q.answers.length) push('answers', q.answers);

        // Multiple choice (derive letter + text if possible)
        if (Array.isArray(q.choices)) {
          // Determine correct via correctIndex, correct, or by matching expected among choices
          let idx = Number.isFinite(q.correctIndex) ? q.correctIndex : -1;
          if (idx < 0 && Number.isFinite(q.correct)) {
            idx = q.correct;
          }
          if (idx < 0 && (q.expected || q.answer)) {
            const target = String(q.expected || q.answer).trim().toLowerCase();
            idx = q.choices.findIndex(c => String(c).trim().toLowerCase() === target);
          }
            if (idx >= 0 && idx < q.choices.length) {
              const letter = String.fromCharCode(65 + idx);
              const choiceText = String(q.choices[idx]).trim();
              push('mc', `${letter}) ${choiceText}`);
            }
        }

        // Boolean / True-False
        if (typeof q.isTrue === 'boolean') push('isTrue', q.isTrue ? 'True' : 'False');
        if (typeof q.trueFalse === 'boolean') push('trueFalse', q.trueFalse ? 'True' : 'False');

        // Numeric range style (min/max or expectedMin/expectedMax)
        const min = q.min ?? q.expectedMin;
        const max = q.max ?? q.expectedMax;
        if (Number.isFinite(min) && Number.isFinite(max)) {
          if (min === max) push('range', String(min)); else push('range', `${min}–${max}`);
        } else if (Number.isFinite(min)) { push('min', min); }
        if (Number.isFinite(max) && !Number.isFinite(min)) push('max', max);

        // Keywords / terms for short-answer (indicate requirement summary if no direct expected)
        if (Array.isArray(q.terms) && q.terms.length) push('terms', `terms: ${q.terms.join(', ')}`);
        if (Array.isArray(q.keywords) && q.keywords.length) push('keywords', `keywords: ${q.keywords.join(', ')}`);
        if (Number.isInteger(q.minKeywords) && q.minKeywords > 0) push('minKeywords', `min keywords: ${q.minKeywords}`);

        // Explanation (short only)
        if (typeof q.explanation === 'string') {
          const exp = q.explanation.trim();
          if (exp && exp.length <= 120) push('explanation', exp);
        }

        // Deduplicate preserving earliest occurrence precedence
        const seen = new Set();
        const ordered = [];
        for (const p of parts) { if (!seen.has(p)) { seen.add(p); ordered.push(p); } }
        if (!ordered.length) return '(no answer data)';
        const answer = ordered.join(' / ');
        if (debug && process.env.NODE_ENV !== 'production') {
          return `${answer}  [${Array.from(usedKeys).join(',')}]`;
        }
        return answer;
      };
      // Build content: Notes, Vocab, then Worksheet/Test Q&A with prompt and answer on the same line.
      const debugAnswers = false; // toggle for dev
      const notes = String(lessonData?.teachingNotes || lessonData?.teacherNotes || lessonData?.notes || '')
        .replace(/\s+/g, ' ').trim();
      const vocabArr = Array.isArray(lessonData?.vocab) ? lessonData.vocab : [];
      const vocabItems = vocabArr.map(v => {
        if (v && typeof v === 'object') {
          const term = String(v.term || v.word || '').trim();
          const def = String(v.definition || '').trim();
          return term && def ? `${term}: ${def}` : term || def || '';
        }
        return String(v || '').trim();
      }).filter(Boolean);

      // Build worksheet/test lines with prompt — answer (compact)
      const worksheetItems = ws.map((q,i)=>({
        prefix:'W',
        num:(q.number || i+1),
        prompt: String(q.prompt || q.question || q.text || '').trim(),
        ans: buildCanonicalAnswer(q, debugAnswers)
      }));
      const testItems = ts.map((q,i)=>({
        prefix:'T',
        num:(q.number || i+1),
        prompt: String(q.prompt || q.question || q.text || '').trim(),
        ans: buildCanonicalAnswer(q, debugAnswers)
      }));
      const buildQALine = (it) => {
        const p = it.prompt || '';
        const a = it.ans || '';
        // Use em dash separator; keep tight spacing
        return `${it.prefix}${it.num}. ${p} — ${a}`.replace(/\s+/g,' ').trim();
      };

      const measureTotalHeightSingle = (size) => {
        doc.setFontSize(size);
        const lineHeight = size * 0.352778;
        let y = TOP;
        // Title
        y += lineHeight;
        // Lesson Notes
        if (notes) {
          y += lineHeight; // heading
          const lines = doc.splitTextToSize(notes, PAGE_INNER_WIDTH);
          const block = lines.length * lineHeight + LINE_GAP;
          if (y + block > BOTTOM_LIMIT) return false;
          y += block;
        }
        // Vocab
        if (vocabItems.length) {
          y += lineHeight; // heading
          for (const vi of vocabItems) {
            const lines = doc.splitTextToSize(vi, PAGE_INNER_WIDTH);
            const block = lines.length * lineHeight + LINE_GAP * 0.8;
            if (y + block > BOTTOM_LIMIT) return false;
            y += block;
          }
        }
        // Worksheet heading + items
        if (worksheetItems.length) {
          y += lineHeight; // heading
          for (const it of worksheetItems) {
            const lines = doc.splitTextToSize(buildQALine(it), PAGE_INNER_WIDTH);
            const blockHeight = lines.length * lineHeight + LINE_GAP;
            if (y + blockHeight > BOTTOM_LIMIT) return false;
            y += blockHeight;
          }
        }
        // Spacer + Test heading (no rule now)
        if (testItems.length) {
          y += lineHeight * 0.8; // spacer between sections
          y += lineHeight; // Test heading
          for (const it of testItems) {
            const lines = doc.splitTextToSize(buildQALine(it), PAGE_INNER_WIDTH);
            const blockHeight = lines.length * lineHeight + LINE_GAP;
            if (y + blockHeight > BOTTOM_LIMIT) return false;
            y += blockHeight;
          }
        }
        return true;
      };

      // Try single-column fit first
      let chosenFont = MAX_SIZE;
      let useTwoCols = false;
      for (let size = MAX_SIZE; size >= MIN_SIZE; size -= 1) {
        if (measureTotalHeightSingle(size)) { chosenFont = size; break; }
        if (size === MIN_SIZE) { useTwoCols = true; chosenFont = size; }
      }

      const lineHeight = chosenFont * 0.352778;
      let y = TOP;
      doc.setFontSize(chosenFont);
  // Title
  try { doc.setFont(undefined, 'bold'); } catch {}
  doc.text(`${lessonTitle} Facilitator Key`, LEFT, y);
  try { doc.setFont(undefined, 'normal'); } catch {}
      y += lineHeight;

      // Render Notes
      const renderParagraph = (heading, text) => {
        if (!text) return;
        try { doc.setFont(undefined, 'bold'); } catch {}
        doc.text(heading, LEFT, y); y += lineHeight;
        try { doc.setFont(undefined, 'normal'); } catch {}
        const lines = doc.splitTextToSize(text, PAGE_INNER_WIDTH);
        for (const ln of lines) { doc.text(ln, LEFT, y); y += lineHeight; }
        y += LINE_GAP;
      };
      renderParagraph('Lesson Notes', notes);

      // Render Vocab list (compact)
      if (vocabItems.length) {
        try { doc.setFont(undefined, 'bold'); } catch {}
        doc.text('Vocab', LEFT, y); y += lineHeight;
        try { doc.setFont(undefined, 'normal'); } catch {}
        for (const vi of vocabItems) {
          const lines = doc.splitTextToSize(vi, PAGE_INNER_WIDTH);
          for (const ln of lines) { doc.text(ln, LEFT, y); y += lineHeight; }
          y += LINE_GAP * 0.8;
        }
      }

      if (!useTwoCols) {
        // Single column Q&A
        const renderQASection = (title, items, { spacerTop=false } = {}) => {
          if (!items.length) return;
          if (spacerTop) y += lineHeight * 0.6;
          try { doc.setFont(undefined, 'bold'); } catch {}
          doc.text(title, LEFT, y); y += lineHeight;
          try { doc.setFont(undefined, 'normal'); } catch {}
          for (const it of items) {
            const lines = doc.splitTextToSize(buildQALine(it), PAGE_INNER_WIDTH);
            for (const ln of lines) { doc.text(ln, LEFT, y); y += lineHeight; if (y > BOTTOM_LIMIT) break; }
            y += LINE_GAP;
            if (y > BOTTOM_LIMIT) break;
          }
        };
        renderQASection('Worksheet', worksheetItems);
        renderQASection('Test', testItems, { spacerTop:true });
      } else {
        // Two-column fallback for Q&A only; keep Notes and Vocab full-width at top
        const GUTTER = 6;
        const colWidth = (PAGE_INNER_WIDTH - GUTTER) / 2;
        const startY = y;
        const renderCol = (xLeft, items, title) => {
          let yCol = startY;
          doc.text(title, xLeft, yCol); yCol += lineHeight;
          for (const it of items) {
            const lines = doc.splitTextToSize(buildQALine(it), colWidth);
            for (const ln of lines) { doc.text(ln, xLeft, yCol); yCol += lineHeight; if (yCol > BOTTOM_LIMIT) return yCol; }
            yCol += LINE_GAP;
            if (yCol > BOTTOM_LIMIT) return yCol;
          }
          return yCol;
        };
        // Split worksheet and test into a single list and then divide roughly in half for columns
        const combined = [
          ... (worksheetItems.length ? [{ type:'heading', title:'Worksheet' }] : []),
          ...worksheetItems.map(it=>({ type:'item', it })),
          ... (testItems.length ? [{ type:'heading', title:'Test' }] : []),
          ...testItems.map(it=>({ type:'item', it }))
        ];
        // Build strings per entry to estimate halves by count (not height-perfect but adequate)
        const linesAll = combined.map(entry => entry.type === 'heading' ? `# ${entry.title}` : buildQALine(entry.it));
        const mid = Math.ceil(linesAll.length / 2);
        const leftEntries = combined.slice(0, mid);
        const rightEntries = combined.slice(mid);
        // Rendering with headings preserved
        const renderEntries = (xLeft, entries) => {
          let yCol = startY;
          let section = '';
          for (const e of entries) {
            if (e.type === 'heading') { section = e.title; try { doc.setFont(undefined, 'bold'); } catch {}; doc.text(section, xLeft, yCol); yCol += lineHeight; try { doc.setFont(undefined, 'normal'); } catch {}; continue; }
            const txt = buildQALine(e.it);
            const lines = doc.splitTextToSize(txt, colWidth);
            for (const ln of lines) { doc.text(ln, xLeft, yCol); yCol += lineHeight; if (yCol > BOTTOM_LIMIT) return yCol; }
            yCol += LINE_GAP;
            if (yCol > BOTTOM_LIMIT) return yCol;
          }
          return yCol;
        };
        const xLeft = LEFT;
        const xRight = LEFT + colWidth + GUTTER;
        const yEndLeft = renderEntries(xLeft, leftEntries);
        const yEndRight = renderEntries(xRight, rightEntries);
        y = Math.max(yEndLeft, yEndRight);
      }

  // Filename: use the lesson ID (filename without .json) to ensure stable, predictable naming
  const lessonIdForName = String(manifestInfo?.file || lessonParam || 'lesson').replace(/\.json$/i, '');
  const fileName = `${lessonIdForName}-key.pdf`;
      try {
        const blob = doc.output('blob');
        await shareOrPreviewPdf(blob, fileName, previewWin);
      } catch { doc.save(fileName); }
    } catch (e) {
      console.warn('[Session] Failed combined worksheet/test PDF', e);
      setDownloadError('Failed to generate combined worksheet/test PDF.');
    }
  };

  // Re-generate fresh randomized worksheet and test sets and reset session progress
  const handleRefreshWorksheetAndTest = useCallback(async () => {
    const ok = await ensurePinAllowed('refresh');
    if (!ok) return;
    // Clear persisted sets for this lesson
    const key = getAssessmentStorageKey();
  if (key) { try { const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none'; await clearAssessments(key, { learnerId: lid }); } catch { /* ignore */ } }
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
  if (storageKey) { try { const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none'; await saveAssessments(storageKey, { worksheet: gW, test: gT, comprehension: compPool || [], exercise: exercisePool || [] }, { learnerId: lid }); } catch {} }
    } catch {}
  }, [lessonData, lessonParam, manifestInfo, subjectParam]);

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
    !isSpeaking &&
    showOpeningActions &&
    askState === 'inactive' &&
    riddleState === 'inactive' &&
    poemState === 'inactive'
  );
  const inQnAForButtons = (
    (phase === 'comprehension' && subPhase === 'comprehension-active') ||
    (phase === 'exercise' && subPhase === 'exercise-start') ||
    (phase === 'worksheet' && subPhase === 'worksheet-active') ||
    (phase === 'test' && subPhase === 'test-active')
  );
  const qnaButtonsVisible = (
    inQnAForButtons && !isSpeaking && showOpeningActions &&
    askState === 'inactive' && riddleState === 'inactive' && poemState === 'inactive'
  );
  const buttonsGating = discussionButtonsVisible || qnaButtonsVisible;
  const sendDisabled = (!canSend || loading || comprehensionAwaitingBegin || speakingLock || buttonsGating);
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
    // End any prior API/audio/mic activity before starting fresh
    try { abortAllActivity(); } catch {}
    // Ensure audio and mic permissions are handled as part of Begin (in-gesture)
  // mic permission will be requested only when user starts recording

    // Immediately update UI so it feels responsive
    setShowBegin(false);
    setPhase("discussion");
    setPhaseGuardSent({});
    setSubPhase("unified-discussion");
    setCanSend(false);
    try { console.info('[Begin] UI updated → discussion/unified-discussion'); } catch {}

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
          let take = shuffled.slice(0, totalNeeded);
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
    try { console.info('[Begin] Starting Opening step…'); } catch {}
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

  const beginWorksheetPhase = async () => {
    // End any prior API/audio/mic activity before starting fresh
    try { abortAllActivity(); } catch {}
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
    // Gate quick-answer buttons until the learner presses Start the lesson
    setQaAnswersUnlocked(false);
    setJokeUsedThisGate(false);
    setRiddleUsedThisGate(false);
    setPoemUsedThisGate(false);
  setRiddleUsedThisGate(false);
  setPoemUsedThisGate(false);
    // Immediately advance subPhase so the "Begin Worksheet" button disappears
    setSubPhase('worksheet-active');
    worksheetIndexRef.current = 0;
    setCurrentWorksheetIndex(0);
    setTicker(0);
    setCanSend(false);
  const first = generatedWorksheet[0];
  const num1 = (typeof first?.number === 'number' && first.number > 0) ? first.number : 1;
  const q = ensureQuestionMark(`${num1}. ${formatQuestionForSpeech(first, { layout: 'multiline' })}`);
    const opener = WORKSHEET_INTROS[Math.floor(Math.random() * WORKSHEET_INTROS.length)];
    try {
      await speakFrontend(opener);
    } catch {}
    setCanSend(true);
    // After intro+first question, reveal Opening actions row
    try { setShowOpeningActions(true); } catch {}
    if (worksheetSkippedAwaitBegin) setWorksheetSkippedAwaitBegin(false);
  };

  const beginTestPhase = async () => {
    // End any prior API/audio/mic activity before starting fresh
    try { abortAllActivity(); } catch {}
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
    // Ensure audio can play if previously paused by user
    setUserPaused(false);
    // Reset model-validated correctness tracking
    setUsedTestCuePhrases([]);
  setTestCorrectByIndex([]);
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
    // Do not manually append the first question to captions; we'll speak it locally
    const firstItem = generatedTest[0];
    const firstBody = formatQuestionForSpeech(firstItem, { layout: 'multiline' });
    setTestActiveIndex(0);
    setSubPhase('test-active');
    setCanSend(false);
    try { showTipOverride('Starting test…', 3000); } catch {}

    // Speak a short test intro (random); first question is gated behind Start the lesson
    try {
      const opener = TEST_INTROS[Math.floor(Math.random() * TEST_INTROS.length)];
      await speakFrontend(opener);
    } catch {}
    // After intro, reveal Opening actions row (for Q&A extras)
    try { setShowOpeningActions(true); } catch {}
    setCanSend(true);
  };

  // Keep grade percent and count in sync with correctness array.
  useEffect(() => {
    if (phase !== 'congrats') return; // only matter in preview
    try {
      const total = Array.isArray(generatedTest) ? generatedTest.length : 0;
      const correct = Array.isArray(testCorrectByIndex) ? testCorrectByIndex.filter(Boolean).length : 0;
      const percent = Math.round((correct / Math.max(1, total)) * 100);
      if (Number.isFinite(correct)) setTestCorrectCount(correct);
      if (Number.isFinite(percent)) setTestFinalPercent(percent);
    } catch {}
  }, [phase, generatedTest, testCorrectByIndex]);

  // Persist medal when final percent changes in congrats (best-of safeguard handled in client)
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
    try { abortAllActivity(); } catch {}
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
      // Immediately enter active subPhase so the Begin button disappears right away
      setSubPhase('comprehension-active');
      // New: Phase intro (random from pool); first question is gated behind Start the lesson
      const intro = COMPREHENSION_INTROS[Math.floor(Math.random() * COMPREHENSION_INTROS.length)];
      try {
        await speakFrontend(intro);
      } catch {}
      // After intro, reveal Opening actions row
      try { setShowOpeningActions(true); } catch {}
      // Keep input disabled until TTS finishes; an effect will re-enable when not speaking
      setCanSend(false);
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
    // Local TTS summary
    try {
      const lines = [
        `Your score is ${safePercent}%.`,
        'Nice work today. I am proud of you.',
        'One more joke before we go.',
        'Why did the pencil cross the paper? To get to the other side.',
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
  // Gate quick-answer buttons until Start the lesson
  setQaAnswersUnlocked(false);
  setJokeUsedThisGate(false);
  setRiddleUsedThisGate(false);
  setPoemUsedThisGate(false);
    // Frontend-only: brief intro + first question via unified TTS/captions
    if (first) {
      const opener = EXERCISE_INTROS[Math.floor(Math.random() * EXERCISE_INTROS.length)];
      try {
        setCanSend(false);
        setTicker(0);
        await speakFrontend(opener);
      } catch {}
      // After intro, reveal Opening actions row
      try { setShowOpeningActions(true); } catch {}
      setCanSend(true);
    } else {
      // Nothing to ask yet (rare); leave UI enabled
      setCanSend(true);
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

    // Riddle attempt: when a riddle is active and we're awaiting a solve, judge the attempt first
    if (phase === 'discussion' && subPhase === 'awaiting-learner' && riddleState === 'awaiting-solve' && currentRiddle) {
      setCanSend(false);
      // Echo the learner's attempt into captions as user line
      try {
        const prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), { text: trimmed, role: 'user' }];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
      } catch {}
      const result = await judgeRiddleAttempt(trimmed);
      const line = (result && result.text) ? result.text : 'Not quite. Try again.';
      await speakFrontend(line);
      // If model said it's correct, end riddle and return to options; otherwise keep awaiting solve
      const isCorrect = /\b(correct|you got it|that\'?s right)\b/i.test(line);
      if (isCorrect) {
        setRiddleState('inactive');
        setCurrentRiddle(null);
        setShowOpeningActions(true);
        setCanSend(true);
      } else {
        setRiddleState('awaiting-solve');
        setCanSend(true);
      }
      return;
    }

    // Poem: topic input → generate poem, then await Ok
    if (poemState === 'awaiting-topic') {
      setCanSend(false);
      // Echo the user's topic to captions as user line
      try {
        const prevLen = captionSentencesRef.current?.length || 0;
        const nextAll = [...(captionSentencesRef.current || []), { text: trimmed, role: 'user' }];
        captionSentencesRef.current = nextAll;
        setCaptionSentences(nextAll);
        setCaptionIndex(prevLen);
      } catch {}
      // Ask backend to write a 16-line rhyming poem about the specific user topic; then read via unified TTS/captions
      const topic = (trimmed || '').replace(/["“”]/g, "'");
      const instruction = [
        'You are Ms. Sonoma.',
        `Write a rhyming poem with exactly 16 lines about the topic: "${topic}".`,
        'Use simple, warm language for kids, one short idea per line.',
        'Keep the poem clearly about that topic throughout.',
        'Do not add a title or extra commentary.'
      ].join(' ');
      const result = await callMsSonoma(instruction, '', { phase: 'discussion', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, step: 'poem' }).catch(() => null);
      const poem = (result && result.text) ? result.text : `Here is a little poem about ${trimmed}.`;
      await speakFrontend(poem);
      setPoemState('awaiting-ok');
      setCanSend(false);
      setShowOpeningActions(true);
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
      const persona = [
        'You are Ms. Sonoma, a warm, playful, kid-friendly teacher who stays on task.',
        gradeLevel ? `The learner is a ${gradeLevel}-grade student.` : 'Speak to a school-age learner.',
        `The current lesson is "${effectiveLessonTitle}". Answer the learner\'s question briefly and clearly using correct terms but kid-friendly language.`,
        'Be encouraging, and keep focus on this lesson. Close with one gentle sentence that naturally returns us to the lesson topic. Do not ask a new question.'
      ].join(' ');
      const result = await callMsSonoma(
        persona,
        trimmed,
        { phase: 'discussion', subject: subjectParam, difficulty: difficultyParam, lesson: lessonParam, lessonTitle: effectiveLessonTitle, step: 'open-question', gradeLevel },
        { fastReturn: false }
      );
      // After reply speech, ask for confirmation via frontend TTS (spoken only; no footer label)
      try {
        await speakFrontend('Did I answer your question?');
      } catch {}
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

      // Ensure a current problem; if none, select one. If no input, just speak the question and return.
      let problem = currentCompProblem;
      if (!problem) {
        // Try generated list first, skipping short-answer items
        let pick = null;
        if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
          let idx = currentCompIndex;
          while (idx < generatedComprehension.length && isShortAnswerItem(generatedComprehension[idx])) idx += 1;
          if (idx < generatedComprehension.length) { pick = generatedComprehension[idx]; setCurrentCompIndex(idx + 1); }
        }
        if (!pick) {
          let tries = 0; while (tries < 5) { const s = drawSampleUnique(); if (s && !isShortAnswerItem(s)) { pick = s; break; } tries += 1; }
        }
        if (!pick && compPool.length) {
          const filtered = compPool.filter(q => !isShortAnswerItem(q));
          if (filtered.length > 0) { pick = filtered[0]; setCompPool(compPool.slice(1)); }
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
      if (!nearTarget && !atTarget) {
        if (Array.isArray(generatedComprehension) && currentCompIndex < generatedComprehension.length) {
          const currText = (() => { try { return (problem?.question ?? formatQuestionForSpeech(problem)).trim(); } catch { return ''; } })();
          let idx = currentCompIndex;
          while (idx < generatedComprehension.length && (isShortAnswerItem(generatedComprehension[idx]) || (()=>{ try { const t=(generatedComprehension[idx]?.question ?? formatQuestionForSpeech(generatedComprehension[idx])).trim(); return t===currText; } catch { return false; }})())) idx += 1;
          if (idx < generatedComprehension.length) { nextProblem = generatedComprehension[idx]; setCurrentCompIndex(idx + 1); }
        }
        if (!nextProblem) {
          let tries = 0;
          while (tries < 5) {
            const s = drawSampleUnique();
            const isSame = (() => { try { const t=(s?.question ?? formatQuestionForSpeech(s)).trim(); const c=(problem?.question ?? formatQuestionForSpeech(problem)).trim(); return t===c; } catch { return false; }})();
            if (s && !isShortAnswerItem(s) && !isSame) { nextProblem = s; break; }
            tries += 1;
          }
        }
        if (!nextProblem && compPool.length) {
          const [head, ...rest] = compPool;
          const headSame = (()=>{ try { const t=(head?.question ?? formatQuestionForSpeech(head)).trim(); const c=(problem?.question ?? formatQuestionForSpeech(problem)).trim(); return t===c; } catch { return false; }})();
          if (head && !isShortAnswerItem(head) && !headSame) { nextProblem = head; setCompPool(rest); }
          else {
            const altIndex = rest.findIndex(q => q && !isShortAnswerItem(q) && (()=>{ try { const t=(q?.question ?? formatQuestionForSpeech(q)).trim(); const c=(problem?.question ?? formatQuestionForSpeech(problem)).trim(); return t!==c; } catch { return true; }})());
            if (altIndex >= 0) { nextProblem = rest[altIndex]; setCompPool(rest.slice(altIndex + 1)); }
            else { setCompPool(rest); }
          }
        }
      }

      // Build acceptable answers for local judging
  // Accept both schema variants: some items use `answer`, others use `expected`
  const { primary: expectedPrimary, synonyms: expectedSyns } = expandExpectedAnswer(problem.answer || problem.expected);
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
        correct = isAnswerCorrectLocal(trimmed, acceptable, problem);
      } catch {}

      setLearnerInput('');

      if (correct) {
        const celebration = CELEBRATE_CORRECT[Math.floor(Math.random() * CELEBRATE_CORRECT.length)];
        if (atTarget) {
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
        if (!nearTarget && nextProblem) {
          setCurrentCompProblem(nextProblem);
          const nextQ = ensureQuestionMark(formatQuestionForSpeech(nextProblem, { layout: 'multiline' }));
          try { await speakFrontend(`${celebration}. ${progressPhrase} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}
          setSubPhase('comprehension-active');
          setCanSend(false);
          return;
        }
        try { await speakFrontend(`${celebration}. ${progressPhrase}`); } catch {}
        setCanSend(true);
        return;
      }

      // Incorrect: gentle hint and re-ask same question
      const gentle = 'Not quite right. Think about the key idea and try again.';
      const currQ = ensureQuestionMark(formatQuestionForSpeech(problem, { layout: 'multiline' }));
      try { await speakFrontend(`${gentle} ${currQ}`, { mcLayout: 'multiline' }); } catch {}
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
          let idx = currentExIndex;
          while (idx < generatedExercise.length && isShortAnswerItem(generatedExercise[idx])) idx += 1;
          if (idx < generatedExercise.length) { first = generatedExercise[idx]; setCurrentExIndex(idx + 1); }
        }
        if (!first) {
          let tries = 0; while (tries < 5 && !first) { const c = drawSampleUnique(); if (c && !isShortAnswerItem(c)) { first = c; break; } tries += 1; }
        }
        if (!first && exercisePool.length) {
          const [head, ...rest] = exercisePool; const pick = isShortAnswerItem(head) ? null : head; if (pick) first = pick; setExercisePool(rest);
        }
        if (!first) {
          const refilled = buildQAPool();
          if (refilled.length) { const [head, ...rest] = refilled; first = head; setExercisePool(rest); }
        }
        if (first) {
          setCurrentExerciseProblem(first);
          const q = ensureQuestionMark(formatQuestionForSpeech(first, { layout: 'multiline' }));
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
          while (idx < generatedExercise.length && (isShortAnswerItem(generatedExercise[idx]) || (()=>{ try { const t=(generatedExercise[idx]?.question ?? formatQuestionForSpeech(generatedExercise[idx])).trim(); return t===currText; } catch { return false; }})())) idx += 1;
          if (idx < generatedExercise.length) { nextProblem = generatedExercise[idx]; setCurrentExIndex(idx + 1); }
        }
        if (!nextProblem) {
          let tries = 0;
          while (tries < 5) {
            const s = drawSampleUnique();
            const isSame = (() => { try { const t=(s?.question ?? formatQuestionForSpeech(s)).trim(); const c=(problem?.question ?? formatQuestionForSpeech(problem)).trim(); return t===c; } catch { return false; }})();
            if (s && !isShortAnswerItem(s) && !isSame) { nextProblem = s; break; }
            tries += 1;
          }
        }
        if (!nextProblem && exercisePool.length) {
          const [head, ...rest] = exercisePool;
          const headSame = (()=>{ try { const t=(head?.question ?? formatQuestionForSpeech(head)).trim(); const c=(problem?.question ?? formatQuestionForSpeech(problem)).trim(); return t===c; } catch { return false; }})();
          if (head && !isShortAnswerItem(head) && !headSame) { nextProblem = head; setExercisePool(rest); }
          else {
            const altIndex = rest.findIndex(q => q && !isShortAnswerItem(q) && (()=>{ try { const t=(q?.question ?? formatQuestionForSpeech(q)).trim(); const c=(problem?.question ?? formatQuestionForSpeech(problem)).trim(); return t!==c; } catch { return true; }})());
            if (altIndex >= 0) { nextProblem = rest[altIndex]; setExercisePool(rest.slice(altIndex + 1)); }
            else { setExercisePool(rest); }
          }
        }
      }

      // Build acceptable answers
      const { primary: expectedPrimaryE, synonyms: expectedSynsE } = expandExpectedAnswer(problem.answer || problem.expected);
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
      try { correct = isAnswerCorrectLocal(trimmed, acceptableE, problem); } catch {}

      setLearnerInput('');

      if (correct) {
        const celebration = CELEBRATE_CORRECT[Math.floor(Math.random() * CELEBRATE_CORRECT.length)];
        if (atTarget) {
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
          const nextQ = ensureQuestionMark(formatQuestionForSpeech(nextProblem, { layout: 'multiline' }));
          try { await speakFrontend(`${celebration}. ${progressPhrase} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}
          // Re-enable input after the next question has been spoken. While speaking, input is locked by speakingLock.
          setCanSend(true);
          return;
        }
        try { await speakFrontend(`${celebration}. ${progressPhrase}`); } catch {}
        setCanSend(true);
        return;
      }

      // Incorrect: gentle hint and re-ask the same question
      const gentle = 'Not quite right. Think about the key idea and try again.';
      const currQ = ensureQuestionMark(formatQuestionForSpeech(problem, { layout: 'multiline' }));
      try { await speakFrontend(`${gentle} ${currQ}`, { mcLayout: 'multiline' }); } catch {}
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
      const { primary: expectedPrimaryW, synonyms: expectedSynsW } = expandExpectedAnswer(problem.answer || problem.expected);
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
      try { correctW = isAnswerCorrectLocal(trimmed, acceptableW, problem); } catch {}

      setLearnerInput('');

      if (correctW) {
        const celebration = CELEBRATE_CORRECT[Math.floor(Math.random() * CELEBRATE_CORRECT.length)];
        if (atTarget) {
          try { await speakFrontend(`${celebration}. ${progressPhrase} That's all for the worksheet. Now let's begin the test.`); } catch {}
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
  const nextObj = list[nextIdx];
  const numN = (typeof nextObj?.number === 'number' && nextObj.number > 0) ? nextObj.number : (nextIdx + 1);
  const nextQ = ensureQuestionMark(`${numN}. ${formatQuestionForSpeech(nextObj, { layout: 'multiline' })}`);
        try { await speakFrontend(`${celebration}. ${progressPhrase} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}
        setCanSend(true);
        return;
      }

      // Incorrect: gentle hint and re-ask same question
      const gentle = 'Not quite right. Think about the key idea and try again.';
  const currNum = (typeof problem?.number === 'number' && problem.number > 0) ? problem.number : (idx + 1);
  const currQ = ensureQuestionMark(`${currNum}. ${formatQuestionForSpeech(problem, { layout: 'multiline' })}`);
      try { await speakFrontend(`${gentle} ${currQ}`, { mcLayout: 'multiline' }); } catch {}
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
          const { primary: expectedPrimaryT, synonyms: expectedSynsT } = expandExpectedAnswer(qObj.answer || qObj.expected);
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
          try { judgedCorrect = isAnswerCorrectLocal(trimmed, acceptableT, qObj); } catch {}

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
            try { await speakFrontend(`${speech} ${nextQ}`, { mcLayout: 'multiline' }); } catch {}
            setTestActiveIndex(nextIdx);
            setCanSend(true);
            return;
          }

          // Last question: speak feedback, then finalize
          try { await speakFrontend(speech); } catch {}
          const total = totalLimit;
          const correct = testCorrectCount + (judgedCorrect ? 1 : 0);
          try { setTestCorrectByIndex(prev => { const a = Array.isArray(prev) ? prev.slice() : []; a[idx] = judgedCorrect; return a; }); } catch {}
          const percent = Math.round((correct / Math.max(1, total)) * 100);
          finalizeTestAndFarewell({ correctCount: correct, total, percent });
          return;
        } catch {}
        // Fallback return to avoid running legacy path
        setCanSend(true);
        return;
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
        const { primary: expectedPrimaryT, synonyms: expectedSynsT } = expandExpectedAnswer(qObj.answer || qObj.expected);
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

  // Global hotkeys for skip left/right, mute toggle, and play/pause toggle
  useEffect(() => {
    const onKeyDown = (e) => {
      const code = e.code || e.key;
      const target = e.target;
      if (isTextEntryTarget(target)) return; // don't steal keys while typing in inputs/textareas
      if (!hotkeys) return;

      const { skipLeft, skipRight, muteToggle, playPauseToggle } = { ...DEFAULT_HOTKEYS, ...hotkeys };

      if (skipLeft && code === skipLeft) {
        e.preventDefault();
        // Boundaries handled in function; PIN gating applied inside
        skipBackwardPhase?.();
        return;
      }
      if (skipRight && code === skipRight) {
        e.preventDefault();
        skipForwardPhase?.();
        return;
      }
      if (muteToggle && code === muteToggle) {
        e.preventDefault();
        toggleMute?.();
        return;
      }
      if (playPauseToggle && code === playPauseToggle) {
        e.preventDefault();
        togglePlayPause?.();
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hotkeys, skipBackwardPhase, skipForwardPhase, toggleMute, togglePlayPause]);

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

  // No portrait spacer: timeline should sit directly under the header in portrait mode.

  return (
    <div style={{ width: '100%', height: '100svh', overflow: 'hidden' }}>
  {/* Bounding wrapper: regular flow; inner container handles centering via margin auto */}
  <div style={{ width: '100%', position: 'relative', height: '100%' }}>
    {/* Scroll area sized to the viewport; disable scrolling to keep top cluster fixed */}
  <div style={{ height: '100%', overflowY: 'hidden', WebkitOverflowScrolling: 'touch', overscrollBehaviorY: 'contain' }}>
    {/* Width-matched wrapper: center by actual scaled width */}
  <div style={{ width: '100%', position: 'relative', boxSizing: 'border-box', paddingBottom: footerHeight }}>
  {/* Content wrapper (no transform scaling). Add small horizontal gutters in landscape. */}
  <div style={ isMobileLandscape ? { width: '100%', paddingLeft: 8, paddingRight: 8, boxSizing: 'border-box' } : { width: '100%' } }>
      {/* Sticky cluster: title + timeline + video + captions stick under the header without moving into it */}
  <div style={{ position: 'sticky', top: (isMobileLandscape ? 52 : 64), zIndex: 25, background: '#ffffff' }}>
    {(() => {
  const showBanner = !audioUnlocked;
      if (!showBanner) return null;
  const onEnable = () => { try { unlockAudioPlayback(); } catch {} };
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

  {/* Video + captions: stack normally; side-by-side on mobile landscape */}
  <div style={isMobileLandscape ? { display:'flex', alignItems:'stretch', width:'100%', paddingBottom:4, '--msSideBySideH': (videoEffectiveHeight ? `${videoEffectiveHeight}px` : (sideBySideHeight ? `${sideBySideHeight}px` : 'auto')) } : {}}>
    <div ref={videoColRef} style={isMobileLandscape ? { flex:`0 0 ${videoColPercent}%`, display:'flex', flexDirection:'column', minWidth:0, minHeight:0, height: 'var(--msSideBySideH)' } : {}}>
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
        onPrev={skipBackwardPhase}
        onNext={skipForwardPhase}
        subPhase={subPhase}
        testCorrectCount={testCorrectCount}
        testFinalPercent={testFinalPercent}
        lessonParam={lessonParam}
        muted={muted}
        
        userPaused={userPaused}
        onToggleMute={toggleMute}
    onTogglePlayPause={togglePlayPause}
  loading={loading}
  overlayLoading={overlayLoading}
        exerciseSkippedAwaitBegin={exerciseSkippedAwaitBegin}
        skipPendingLessonLoad={skipPendingLessonLoad}
  currentCompProblem={currentCompProblem}
  testActiveIndex={testActiveIndex}
  testList={Array.isArray(generatedTest) ? generatedTest : []}
        onCompleteLesson={async () => {
          const key = getAssessmentStorageKey();
          if (key) { try { const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none'; clearAssessments(key, { learnerId: lid }); } catch { /* ignore */ } }
          // Persist transcript segment (append-only) to Supabase Storage
          try {
            const learnerId = (typeof window !== 'undefined' ? localStorage.getItem('learner_id') : null) || null;
            const learnerName = (typeof window !== 'undefined' ? localStorage.getItem('learner_name') : null) || null;
            const lessonId = String(lessonParam || '').replace(/\.json$/i, '');
            const startedAt = sessionStartRef.current || new Date().toISOString();
            const completedAt = new Date().toISOString();
            const lines = Array.isArray(captionSentencesRef.current) ? captionSentencesRef.current
              .filter((ln) => ln && typeof ln.text === 'string' && ln.text.trim().length > 0)
              .map((ln) => ({ role: ln.role || 'assistant', text: ln.text })) : [];
            if (learnerId && learnerId !== 'demo' && lines.length > 0) {
              await appendTranscriptSegment({
                learnerId,
                learnerName,
                lessonId,
                lessonTitle: effectiveLessonTitle,
                segment: { startedAt, completedAt, lines },
              });
            }
          } catch (e) { console.warn('[Session] transcript append failed', e); }
          sessionStartRef.current = null;
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
  <div ref={captionColRef} style={isMobileLandscape ? { flex:`0 0 ${Math.max(0, 100 - videoColPercent)}%`, minWidth:0, minHeight:0, display:'flex', flexDirection:'column', overflow: (phase === 'congrats' ? 'auto' : 'hidden'), height: 'var(--msSideBySideH)', maxHeight: 'var(--msSideBySideH)', position:'relative', '--msSideBySideH': (videoEffectiveHeight ? `${videoEffectiveHeight}px` : (sideBySideHeight ? `${sideBySideHeight}px` : 'auto')) } : (stackedCaptionHeight ? { maxHeight: stackedCaptionHeight, height: stackedCaptionHeight, overflowY: (phase === 'congrats' ? 'auto' : 'hidden'), marginTop:8, paddingLeft: '4%', paddingRight: '4%' } : { paddingLeft: '4%', paddingRight: '4%', position:'relative' })}>
      {phase === 'congrats' && typeof testFinalPercent === 'number' ? (
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
          // Provide explicit scroll controls for visibility on touch devices
          const scrollParent = captionColRef;
          const doScroll = (dy) => {
            try {
              const el = scrollParent?.current;
              if (el) el.scrollBy({ top: dy, behavior: 'smooth' });
            } catch {}
          };
          const scrollBtn = { position:'absolute', right: 8, zIndex: 10, background:'#1f2937', color:'#fff', border:'none', width:36, height:36, display:'grid', placeItems:'center', borderRadius:999, boxShadow:'0 2px 8px rgba(0,0,0,0.25)', cursor:'pointer' };
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:12, overflow:'visible', paddingTop:8, paddingBottom:8 }}>
              <button type="button" aria-label="Scroll up" title="Scroll up" style={{ ...scrollBtn, top: 8 }} onClick={() => doScroll(-240)}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 15l-6-6-6 6"/></svg>
              </button>
              <button type="button" aria-label="Scroll down" title="Scroll down" style={{ ...scrollBtn, bottom: 8 }} onClick={() => doScroll(240)}>
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              <div style={{ ...card, display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, position:'sticky', top:0, zIndex:5, background:'#ffffff' }}>
                <div style={{ fontSize:'clamp(1.1rem, 2.4vw, 1.4rem)', fontWeight:800, color:'#065f46' }}>
                  {percent}% grade
                </div>
                <div style={{ fontSize: 'clamp(1.2rem, 2.6vw, 1.5rem)' }} aria-label="Medal preview">{medal}</div>
              </div>
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
      <div style={{ margin: '0 auto', width: '100%', boxSizing: 'border-box', padding: (isShortHeight && isMobileLandscape) ? '2px 16px calc(2px + env(safe-area-inset-bottom, 0px))' : '4px 12px calc(4px + env(safe-area-inset-bottom, 0px))' }}>
          {/* When the screen height is very short, relocate video overlay controls into the footer. If a Begin row is present, controls join that row. */}
          {(() => {
            try {
              if (!isShortHeight) return null;
              const needBeginDiscussion = (showBegin && phase === 'discussion');
              const needBeginComp = (phase === 'comprehension' && subPhase === 'comprehension-start');
              const needBeginExercise = (phase === 'exercise' && subPhase === 'exercise-awaiting-begin');
              const needBeginWorksheet = (phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin');
              const needBeginTest = (phase === 'test' && subPhase === 'test-awaiting-begin');
              const anyBegin = needBeginDiscussion || needBeginComp || needBeginExercise || needBeginWorksheet || needBeginTest;
              if (anyBegin) return null; // controls will render within the Begin row below
              // Make footer controls slightly smaller when the viewport is short in landscape so the footer takes less vertical space
              const btnSize = (isShortHeight && isMobileLandscape) ? 32 : 36;
              const btnBase = { background:'#1f2937', color:'#fff', border:'none', width:btnSize, height:btnSize, display:'grid', placeItems:'center', borderRadius:'50%', cursor:'pointer', boxShadow:'0 2px 6px rgba(0,0,0,0.2)' };
              const canPrev = typeof skipBackwardPhase === 'function' && phase !== 'discussion';
              const canNext = typeof skipForwardPhase === 'function' && phase !== 'test';
              // Determine if a quick-answer cluster should appear (TF/MC) and render it in the middle of this row
              let qa = null;
              try {
                // Show hard-wired Yes/No during teaching gate; hide while speaking (belt-and-suspenders)
                if (phase === 'teaching' && subPhase === 'awaiting-gate' && !isSpeaking) {
                  const qaWrap = { display:'flex', alignItems:'center', justifyContent:'center', gap:8, flex:1, flexWrap:'wrap', padding:'0 8px' };
                  const qaBtn = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight: (isShortHeight && isMobileLandscape) ? 32 : 36, minWidth:56, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 2px 6px rgba(0,0,0,0.18)' };
                  qa = (
                    <div style={qaWrap} aria-label="Teaching gate: repeat or move on">
                      <button type="button" style={qaBtn} onClick={handleGateYes}>Yes</button>
                      <button type="button" style={qaBtn} onClick={handleGateNo}>No</button>
                      <button
                        type="button"
                        style={{ ...qaBtn, minWidth: 140, opacity: (askState !== 'inactive') ? 0.6 : 1, cursor: (askState !== 'inactive') ? 'not-allowed' : 'pointer' }}
                        onClick={askState === 'inactive' ? handleAskQuestionStart : undefined}
                        disabled={askState !== 'inactive'}
                      >Ask</button>
                    </div>
                  );
                } else if (!sendDisabled) {
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
                  if (active) {
                    const choiceCount = Array.isArray(active.choices) && active.choices.length
                      ? active.choices.length
                      : (Array.isArray(active.options) ? active.options.length : 0);
                    const qaWrap = { display:'flex', alignItems:'center', justifyContent:'center', gap:8, flex:1, flexWrap:'wrap', padding:'0 8px' };
                    const qaBtn = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight: (isShortHeight && isMobileLandscape) ? 32 : 36, minWidth:48, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 2px 6px rgba(0,0,0,0.18)' };
                    const isTF = isTrueFalse(active);
                    if (isTF) {
                      qa = (
                        <div style={qaWrap} aria-label="Quick answer: true or false">
                          <button type="button" style={qaBtn} onClick={() => handleSend('true')}>True</button>
                          <button type="button" style={qaBtn} onClick={() => handleSend('false')}>False</button>
                        </div>
                      );
                    } else {
                      const isMC = isMultipleChoice(active) || ((choiceCount || 0) >= 2);
                      if (isMC) {
                        const count = Math.min(4, Math.max(2, choiceCount || 4));
                        const letters = ['A','B','C','D'].slice(0, count);
                        qa = (
                          <div style={qaWrap} aria-label="Quick answer: multiple choice">
                            {letters.map((L) => (
                              <button key={L} type="button" style={qaBtn} onClick={() => handleSend(L)}>{L}</button>
                            ))}
                          </div>
                        );
                      }
                    }
                  }
                }
              } catch {}
              // Move playback/mute to the left, prev/next (skip) to the right, and inset both pairs symmetrically.
              const pairInset = (isShortHeight && isMobileLandscape) ? 64 : 24;
              return (
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, paddingTop:2, paddingBottom:2, paddingLeft: pairInset, paddingRight: pairInset, marginBottom:2 }}>
                  {/* Left: Previous + Next (skip) */}
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button type="button" aria-label="Previous" title="Previous" onClick={canPrev ? skipBackwardPhase : undefined} disabled={!canPrev} style={{ ...btnBase, opacity: canPrev ? 1 : 0.4, cursor: canPrev ? 'pointer' : 'not-allowed' }}>
                      <svg style={{ width:'55%', height:'55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                    </button>
                    <button type="button" aria-label="Next" title="Next" onClick={canNext ? skipForwardPhase : undefined} disabled={!canNext} style={{ ...btnBase, opacity: canNext ? 1 : 0.4, cursor: canNext ? 'pointer' : 'not-allowed' }}>
                      <svg style={{ width:'55%', height:'55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                    </button>
                  </div>
                  {/* Middle: Quick answers if available */}
                  {qa}
                  {/* Right: Play/Pause + Mute */}
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button type="button" aria-label={userPaused ? 'Play' : 'Pause'} title={userPaused ? 'Play' : 'Pause'} onClick={togglePlayPause} style={btnBase}>
                      {userPaused ? (
                        <svg style={{ width:'55%', height:'55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 5v14l11-7z" /></svg>
                      ) : (
                        <svg style={{ width:'55%', height:'55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                      )}
                    </button>
                    <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} onClick={toggleMute} style={btnBase}>
                      {muted ? (
                        <svg style={{ width:'60%', height:'60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6" /><path d="M17 9l6 6" /></svg>
                      ) : (
                        <svg style={{ width:'60%', height:'60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19 8a5 5 0 010 8" /><path d="M15 11a2 2 0 010 2" /></svg>
                      )}
                    </button>
                  </div>
                </div>
              );
            } catch {}
            return null;
          })()}
          {/* Redundant Begin CTA row (appears above quick answers) */}
          {(() => {
            try {
              const needBeginDiscussion = (showBegin && phase === 'discussion');
              const needBeginComp = (phase === 'comprehension' && subPhase === 'comprehension-start');
              const needBeginExercise = (phase === 'exercise' && subPhase === 'exercise-awaiting-begin');
              const needBeginWorksheet = (phase === 'worksheet' && subPhase === 'worksheet-awaiting-begin');
              const needBeginTest = (phase === 'test' && subPhase === 'test-awaiting-begin');
              if (!(needBeginDiscussion || needBeginComp || needBeginExercise || needBeginWorksheet || needBeginTest)) return null;
              const ctaStyle = { background:'#c7442e', color:'#fff', borderRadius:10, padding:'10px 18px', fontWeight:800, fontSize:'clamp(1rem, 2.6vw, 1.125rem)', border:'none', boxShadow:'0 2px 12px rgba(199,68,46,0.28)', cursor:'pointer' };
              if (isShortHeight) {
                // Single row: play/mute left, begin center, skip right — inset both pairs symmetrically
                const btnBase = { background:'#1f2937', color:'#fff', border:'none', width:36, height:36, display:'grid', placeItems:'center', borderRadius:'50%', cursor:'pointer', boxShadow:'0 2px 6px rgba(0,0,0,0.2)' };
                const canPrev = typeof skipBackwardPhase === 'function' && phase !== 'discussion';
                const canNext = typeof skipForwardPhase === 'function' && phase !== 'test';
                const pairInset = (isShortHeight && isMobileLandscape) ? 64 : 24;
                return (
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, paddingTop:2, paddingBottom:2, paddingLeft: pairInset, paddingRight: pairInset, marginBottom:2 }}>
                      {/* Left: Skip (Previous + Next) */}
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <button type="button" aria-label="Previous" title="Previous" onClick={canPrev ? skipBackwardPhase : undefined} disabled={!canPrev} style={{ ...btnBase, opacity: canPrev ? 1 : 0.4, cursor: canPrev ? 'pointer' : 'not-allowed' }}>
                          <svg style={{ width:'55%', height:'55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                        </button>
                        <button type="button" aria-label="Next" title="Next" onClick={canNext ? skipForwardPhase : undefined} disabled={!canNext} style={{ ...btnBase, opacity: canNext ? 1 : 0.4, cursor: canNext ? 'pointer' : 'not-allowed' }}>
                          <svg style={{ width:'55%', height:'55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
                        </button>
                      </div>
                      {/* Middle: Begin CTA(s) */}
                      <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, justifyContent:'center' }}>
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
                    {/* Right: Play/Pause + Mute */}
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <button type="button" aria-label={userPaused ? 'Play' : 'Pause'} title={'Press Begin first'} disabled style={{ ...btnBase, opacity: 0.4, cursor:'not-allowed' }}>
                        {userPaused ? (
                          <svg style={{ width:'55%', height:'55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 5v14l11-7z" /></svg>
                        ) : (
                          <svg style={{ width:'55%', height:'55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        )}
                      </button>
                      <button type="button" aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} onClick={toggleMute} style={btnBase}>
                        {muted ? (
                          <svg style={{ width:'60%', height:'60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6" /><path d="M17 9l6 6" /></svg>
                        ) : (
                          <svg style={{ width:'60%', height:'60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19 8a5 5 0 010 8" /><path d="M15 11a2 2 0 010 2" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                );
              }
              // Default (not short height): center-only Begin row
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

          {/* Congrats footer row with Complete Lesson and medal */}
          {(() => {
            if (phase !== 'congrats') return null;
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
                !isSpeaking &&
                showOpeningActions &&
                askState === 'inactive' &&
                riddleState === 'inactive' &&
                poemState === 'inactive'
              );
              if (!canShow) return null;
              const wrap = { display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap', gap:8, padding:'6px 12px' };
              const btn = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
              const goBtn = { ...btn, background:'#c7442e', boxShadow:'0 2px 12px rgba(199,68,46,0.28)' };
              const disabledBtn = { ...btn, opacity:0.5, cursor:'not-allowed' };
              return (
                <div style={wrap} aria-label="Opening actions">
                  <button type="button" style={jokeUsedThisGate ? disabledBtn : btn} onClick={jokeUsedThisGate ? undefined : handleTellJoke} disabled={jokeUsedThisGate}> Joke</button>
                  <button type="button" style={btn} onClick={handleAskQuestionStart}>Ask</button>
                  <button type="button" style={riddleUsedThisGate ? disabledBtn : btn} onClick={riddleUsedThisGate ? undefined : handleTellRiddle} disabled={riddleUsedThisGate}>Riddle</button>
                  <button type="button" style={poemUsedThisGate ? disabledBtn : btn} onClick={poemUsedThisGate ? undefined : handlePoemStart} disabled={poemUsedThisGate}>Poem</button>
                  <button type="button" style={goBtn} onClick={lessonData ? handleStartLesson : undefined} disabled={!lessonData} title={lessonData ? undefined : 'Loading lesson…'}>Go</button>
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
                inQnA && !isSpeaking && showOpeningActions && askState === 'inactive' && riddleState === 'inactive' && poemState === 'inactive'
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
              return (
                <div style={wrap} aria-label="Phase opening actions">
                  <button type="button" style={jokeUsedThisGate ? disabledBtn : btn} onClick={jokeUsedThisGate ? undefined : handleTellJoke} disabled={jokeUsedThisGate}> Joke</button>
                  <button type="button" style={btn} onClick={handleAskQuestionStart}>Ask</button>
                  <button type="button" style={riddleUsedThisGate ? disabledBtn : btn} onClick={riddleUsedThisGate ? undefined : handleTellRiddle} disabled={riddleUsedThisGate}>Riddle</button>
                  <button type="button" style={poemUsedThisGate ? disabledBtn : btn} onClick={poemUsedThisGate ? undefined : handlePoemStart} disabled={poemUsedThisGate}>Poem</button>
                  <button type="button" style={goBtn} onClick={onGo} disabled={!lessonData} title={lessonData ? undefined : 'Loading lesson…'}>Go</button>
                </div>
              );
            } catch {}
            return null;
          })()}

          {/* Ask-a-question confirmation row (inside fixed footer) */}
          {askState === 'awaiting-confirmation' && (() => {
            const wrap = { display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'6px 12px', flexWrap:'wrap' };
            const btnBase = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
            const yesBtn = { ...btnBase, background:'#065f46' };
            const noBtn = { ...btnBase, background:'#7f1d1d' };
            return (
              <div style={wrap} aria-label="Ask confirmation">
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button type="button" style={yesBtn} onClick={handleAskConfirmYes}>Yes</button>
                  <button type="button" style={noBtn} onClick={handleAskConfirmNo}>No</button>
                  <button type="button" style={btnBase} onClick={handleAskAnother}>Ask another question</button>
                </div>
              </div>
            );
          })()}

          {/* Poem confirmation row: shows Ok after poem is read */}
          {poemState === 'awaiting-ok' && (() => {
            const wrap = { display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'6px 12px', flexWrap:'wrap' };
            const okBtn = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
            return (
              <div style={wrap} aria-label="Poem confirmation">
                <button type="button" style={okBtn} onClick={handlePoemOk}>Ok</button>
              </div>
            );
          })()}

          {/* Riddle action row (inside fixed footer) */}
          {(() => {
            try {
              const active = (phase === 'discussion' && subPhase === 'awaiting-learner' && riddleState && riddleState !== 'inactive');
              if (!active) return null;
              const wrap = { display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'6px 12px', flexWrap:'wrap' };
              const btnBase = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, fontWeight:800, border:'none', boxShadow:'0 2px 8px rgba(0,0,0,0.18)', cursor:'pointer' };
              const solveBtn = { ...btnBase, background:'#065f46' };
              const hintBtn = { ...btnBase, background:'#b45309' };
              const answerBtn = { ...btnBase, background:'#374151' };
              return (
                <div style={wrap} aria-label="Riddle actions">
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <button type="button" style={solveBtn} onClick={handleRiddleSolve}>Solve</button>
                    <button type="button" style={hintBtn} onClick={requestRiddleHint}>Hint</button>
                    <button type="button" style={answerBtn} onClick={revealRiddleAnswer}>Tell me the answer</button>
                  </div>
                </div>
              );
            } catch {}
            return null;
          })()}

          {/* Quick-answer buttons row (appears above input when a TF/MC item is active).
              Also renders gate Yes/No during teaching awaiting-gate.
              Suppressed on short-height when controls are already in this row.
              Now gated behind Start the lesson: hidden until qaAnswersUnlocked is true. */}
          {(() => {
            try {
              // Show teaching gate Yes/No when awaiting-gate; hide while speaking (belt-and-suspenders)
              if (phase === 'teaching' && subPhase === 'awaiting-gate' && !isSpeaking) {
                const containerStyle = {
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 8,
                  paddingLeft: isMobileLandscape ? 12 : '4%', paddingRight: isMobileLandscape ? 12 : '4%', marginBottom: 6,
                };
                const btnBase = { background:'#1f2937', color:'#fff', borderRadius:8, padding:'8px 12px', minHeight:40, minWidth:56, fontWeight:700, border:'none', cursor:'pointer', boxShadow:'0 2px 6px rgba(0,0,0,0.18)' };
                if (isShortHeight) return null; // already rendered in controls row above
                return (
                  <div style={containerStyle} aria-label="Teaching gate: repeat or move on">
                    <button type="button" style={btnBase} onClick={handleGateYes}>Yes</button>
                    <button type="button" style={btnBase} onClick={handleGateNo}>No</button>
                    <button
                      type="button"
                      style={{ ...btnBase, minWidth: 160, background: '#374151', opacity: (askState !== 'inactive') ? 0.6 : 1, cursor: (askState !== 'inactive') ? 'not-allowed' : 'pointer' }}
                      onClick={askState === 'inactive' ? handleAskQuestionStart : undefined}
                      disabled={askState !== 'inactive'}
                    >Ask</button>
                  </div>
                );
              }
              // In Q&A phases, do not show quick-answer buttons until Start the lesson is pressed
              const isQnAPhase = (
                phase === 'comprehension' || phase === 'exercise' || phase === 'worksheet' || phase === 'test'
              );
              if (isQnAPhase && !qaAnswersUnlocked) return null;
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
                  </div>
                );
              }
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
            tipOverride={tipOverride}
            onSend={handleSend}
            compact={isMobileLandscape}
            hotkeys={hotkeys}
          />
        </div>
      </div>
  {/* Intentionally nothing rendered below the fixed footer */}
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

function VideoPanel({ isMobileLandscape, isShortHeight, videoMaxHeight, videoRef, showBegin, isSpeaking, onBegin, onBeginComprehension, onBeginWorksheet, onBeginTest, onBeginSkippedExercise, onPrev, onNext, phase, subPhase, ticker, currentWorksheetIndex, testCorrectCount, testFinalPercent, lessonParam, muted, userPaused, onToggleMute, onTogglePlayPause, loading, overlayLoading, exerciseSkippedAwaitBegin, skipPendingLessonLoad, currentCompProblem, onCompleteLesson, testActiveIndex, testList }) {
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
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }}
        />
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
        {(phase === 'congrats') && typeof testFinalPercent === 'number' && (
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
  {/* Primary control cluster (play/pause + mute) */}
  {!isShortHeight && (
  <div style={controlClusterStyle}>
          <button
            type="button"
            onClick={onTogglePlayPause}
            aria-label={userPaused ? 'Play' : 'Pause'}
            title={userPaused ? 'Play' : 'Pause'}
            style={{
              ...controlButtonBase
            }}
          >
            {userPaused ? (
              <svg style={{ width: '55%', height: '55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 5v14l11-7z" /></svg>
            ) : (
              <svg style={{ width: '55%', height: '55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
            )}
          </button>
          <button type="button" onClick={onToggleMute} aria-label={muted ? 'Unmute' : 'Mute'} title={muted ? 'Unmute' : 'Mute'} style={controlButtonBase}>
            {muted ? (
              <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M23 9l-6 6" /><path d="M17 9l6 6" /></svg>
            ) : (
              <svg style={{ width: '60%', height: '60%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19 8a5 5 0 010 8" /><path d="M15 11a2 2 0 010 2" /></svg>
            )}
          </button>
        </div>
  )}
        {/* Paired skip controls at bottom-left */}
  {!isShortHeight && (phase !== 'congrats') && (onPrev || onNext) && (
          /* Mirror cluster: same bottom & edge offset (16) and same internal gap (12) to create symmetry */
          <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 12 }}>
            {onPrev && (
              <button
                type="button"
                onClick={onPrev}
                aria-label="Previous"
                title="Previous"
                style={{ ...controlButtonBase }}
              >
                <svg style={{ width: '55%', height: '55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            )}
            {onNext && (
              <button
                type="button"
                onClick={onNext}
                aria-label="Next"
                title="Next"
                style={{ ...controlButtonBase }}
              >
                <svg style={{ width: '55%', height: '55%' }} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            )}
          </div>
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

function InputPanel({ learnerInput, setLearnerInput, sendDisabled, canSend, loading, onSend, showBegin, isSpeaking, phase, subPhase, tipOverride, abortKey, currentCompProblem, compact = false, hotkeys }) {
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
    // During Teaching gate, disable text and prompt to use buttons
    if (phase === 'teaching' && subPhase === 'awaiting-gate') return 'Tap Yes or No below';
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

function CaptionPanel({ sentences, activeIndex, boxRef, scaleFactor = 1, compact = false, fullHeight = false, stackedHeight = null }) {
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
            fontSize: 'clamp(1rem, 1.8vw, 1.2rem)',
            lineHeight: '34px',
            cursor: atBottom ? 'default' : 'pointer',
            boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
            opacity: atBottom ? 0.6 : 1,
          }}
        >▼</button>
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
            return (
              <div key={idx} data-idx={idx} style={{ ...containerBase, ...(activeContainer || {}) }} aria-current={isActive ? 'true' : undefined}>
                {s.role === 'user' ? (
                  <div style={{ ...textBase, ...userText }}>{text}</div>
                ) : mcRender ? (
                  <div style={{ ...textBase, ...activeText }}>{mcRender}</div>
                ) : (
                  <div style={{ ...textBase, ...activeText }}>{text}</div>
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
                if (key) { try { const lid = typeof window !== 'undefined' ? (localStorage.getItem('learner_id') || 'none') : 'none'; clearAssessments(key, { learnerId: lid }); } catch {} }
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













