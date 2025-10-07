/**
 * System message builders for communicating with Ms. Sonoma.
 * Functions to compose instructions and grading specifications.
 */

import { CLEAN_SPEECH_INSTRUCTION, GUARD_INSTRUCTION, KID_FRIENDLY_STYLE } from './constants';

/**
 * Compose the system message sent to Ms. Sonoma.
 * Priority: use teachingNotes as the primary scope when present, otherwise fall back to lessonTitle.
 * Vocab may be either an array of strings or an array of objects { term, definition }.
 * The generated message instructs Ms. Sonoma to use the provided scope text and vocab and to
 * give kid-friendly one-sentence definitions for each vocab term during the teaching
 * segment only (not during comprehension). It does not mention files or external sources.
 * 
 * @param {Object} options - Configuration options
 * @param {string} options.lessonTitle - The title of the lesson
 * @param {string} options.teachingNotes - Optional teaching notes (takes priority)
 * @param {Array} options.vocab - Vocabulary terms (strings or objects with term/definition)
 * @param {string} options.gatePhrase - Optional phrase to say verbatim
 * @param {string} options.stage - Current stage (e.g., 'definitions')
 * @returns {string} Complete system message for Ms. Sonoma
 */
export function buildSystemMessage({ lessonTitle = "", teachingNotes = "", vocab = [], gatePhrase = "", stage = "" } = {}) {
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

/**
 * Build a concise grading spec string for a single question.
 * 
 * Modes:
 *  - exact: accept equality to expected or any acceptable (after normalization)
 *  - short-answer: accept when at least minKeywords keywords appear (order-free)
 * 
 * Flags:
 *  - tf: enable true/false leniency (T/F and yes/no mapping)
 *  - mc: enable multiple-choice leniency (choice letter or full text)
 *  - sa: hint that the question type is short-answer (informational)
 * 
 * @param {Object} options - Grading specification options
 * @param {string} options.mode - Grading mode ('exact' or 'short-answer')
 * @param {string} options.learnerAnswer - The learner's answer
 * @param {string} options.expectedAnswer - The expected correct answer
 * @param {Array<string>} options.acceptableAnswers - Array of acceptable answer variants
 * @param {Array<string>} options.keywords - Keywords for short-answer mode
 * @param {number} options.minKeywords - Minimum number of keywords required
 * @param {boolean} options.tf - Enable true/false leniency
 * @param {boolean} options.mc - Enable multiple-choice leniency
 * @param {boolean} options.sa - Hint that this is a short-answer question
 * @returns {string} Grading instruction string
 */
export function buildPerQuestionJudgingSpec({
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
