/**
 * V2 judging helpers.
 *
 * Goal: match V1 behavior.
 * - MC/TF: local judging via isAnswerCorrectLocal with V1-style acceptable list (letters, option text, TF synonyms).
 * - SA/FIB: POST to /api/judge-short-answer, fallback to local judge on any error.
 */

import { isAnswerCorrectLocal } from '../utils/answerEvaluation.js';
import {
  getOptionTextForLetter,
  isFillInBlank,
  isShortAnswerItem,
  letterForAnswer,
} from '../utils/questionFormatting.js';

function keepNonEmpty(v) {
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  return true;
}

function uniqStrings(list) {
  const out = [];
  const seen = new Set();
  for (const v of list || []) {
    const s = String(v ?? '').trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function optionTextAt(problem, index) {
  const opts = Array.isArray(problem?.options)
    ? problem.options
    : (Array.isArray(problem?.choices) ? problem.choices : []);
  if (!opts || index == null) return '';
  if (index < 0 || index >= opts.length) return '';
  const raw = String(opts[index] ?? '').trim();
  const anyLabel = /^\s*\(?[A-Z]\)?\s*[\.:\)\-]\s*/i;
  return raw.replace(anyLabel, '').trim();
}

/**
 * Build the acceptable answers list for judging.
 *
 * Supports multiple schema variants:
 * - expectedAny[]
 * - answer / expected
 * - correct as numeric index
 * - answer as numeric index
 */
export function buildAcceptableList(problem) {
  const expectedAny = Array.isArray(problem?.expectedAny)
    ? problem.expectedAny.filter(keepNonEmpty)
    : [];
  const acceptableAlt = Array.isArray(problem?.acceptable)
    ? problem.acceptable.filter(keepNonEmpty)
    : [];
  const rawExpected = [problem?.answer, problem?.expected].find(
    (v) => v != null && String(v).trim().length > 0
  );

  let acceptable = [...expectedAny, ...acceptableAlt];
  if (!acceptable.length) {
    acceptable = rawExpected != null ? [rawExpected] : [];
  }

  // If the schema provides a numeric correct index, include its letter + option text.
  const correctIndex =
    (typeof problem?.correct === 'number' ? problem.correct : null) ??
    (typeof problem?.answer === 'number' ? problem.answer : null);

  if (typeof correctIndex === 'number' && Number.isFinite(correctIndex)) {
    const labels = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const letter = labels[correctIndex] || null;
    const optText = optionTextAt(problem, correctIndex);
    acceptable = [
      ...acceptable,
      ...(letter ? [letter, letter.toLowerCase()] : []),
      ...(optText ? [optText] : []),
    ];
  }

  // If acceptable contains option text, derive the correct letter and include it.
  const derivedLetter = letterForAnswer(problem, acceptable);
  if (derivedLetter) {
    const optText = getOptionTextForLetter(problem, derivedLetter);
    acceptable = [
      ...acceptable,
      derivedLetter,
      derivedLetter.toLowerCase(),
      ...(optText ? [optText] : []),
    ];
  }

  return uniqStrings(acceptable);
}

/**
 * Judge an answer with V1 parity.
 * - SA/FIB: backend judge, fallback to local
 * - MC/TF: local judge
 */
// Test consumers need the complete judgment. The other lesson phases retain
// judgeAnswer()'s boolean contract, including retriable evaluator failures.
export async function judgeTestAnswer(learnerAnswerRaw, acceptableList, problem) {
  const learnerAnswer = String(learnerAnswerRaw ?? '').trim();
  const acceptable = uniqStrings(acceptableList);
  if (!learnerAnswer) return {
    status: 'incorrect', correct: false, reason: 'No answer was submitted.',
    evaluationMode: 'no_response',
  };

  const shouldUseBackend = isShortAnswerItem(problem) || isFillInBlank(problem);
  if (!shouldUseBackend) {
    const correct = isAnswerCorrectLocal(learnerAnswer, acceptable, problem);
    return {
      status: correct ? 'correct' : 'incorrect',
      correct,
      reason: correct ? 'The selected answer matches the answer key.' : 'The selected answer does not match the answer key.',
      evaluationMode: 'answer_key',
    };
  }

  const MAX_ATTEMPTS = 3;
  const ATTEMPT_TIMEOUT_MS = 5000;
  const RETRY_DELAY_MS = 2000;
  const questionText = String(problem?.question || problem?.prompt || problem?.Q || problem?.q || '').trim();
  const expectedAnswer = String(problem?.answer ?? problem?.expected ?? '').trim();
  const keywords = Array.isArray(problem?.keywords) ? problem.keywords : [];
  const minKeywords = Number.isInteger(problem?.minKeywords) ? problem.minKeywords : (keywords.length > 0 ? 1 : 0);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS);
    try {
      const res = await fetch('/api/judge-short-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText, learnerAnswer, expectedAnswer,
          expectedAny: acceptable, keywords, minKeywords,
          requiresReasoning: problem?.requiresReasoning === true,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`judge-short-answer ${res.status}`);
      const data = await res.json();
      const status = String(data?.status || '').toLowerCase();
      const reason = String(data?.reason || '').trim();
      if (['correct', 'partial', 'incorrect'].includes(status) && reason) {
        return { status, correct: status === 'correct', reason, evaluationMode: 'semantic' };
      }
      throw new Error('judge-short-answer: incomplete semantic result');
    } catch (error) {
      if (attempt < MAX_ATTEMPTS) await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return {
    status: 'ungraded', correct: null,
    reason: 'The learning evaluator was unavailable. The answer was retained for review.',
    evaluationMode: 'semantic_unavailable',
  };
}

export async function judgeAnswer(learnerAnswerRaw, acceptableList, problem) {
  const judgment = await judgeTestAnswer(learnerAnswerRaw, acceptableList, problem);
  if (judgment.status === 'ungraded') throw new Error('judge-unavailable');
  return judgment.correct === true;
}
