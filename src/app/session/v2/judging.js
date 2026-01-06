/**
 * V2 judging helpers.
 *
 * Goal: match V1 behavior.
 * - MC/TF: local judging via isAnswerCorrectLocal with V1-style acceptable list (letters, option text, TF synonyms).
 * - SA/FIB: POST to /api/judge-short-answer, fallback to local judge on any error.
 */

import { isAnswerCorrectLocal } from '../utils/answerEvaluation';
import {
  getOptionTextForLetter,
  isFillInBlank,
  isShortAnswerItem,
  letterForAnswer,
} from '../utils/questionFormatting';

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
export async function judgeAnswer(learnerAnswerRaw, acceptableList, problem) {
  const learnerAnswer = String(learnerAnswerRaw ?? '').trim();
  if (!learnerAnswer) return false;

  const acceptable = uniqStrings(acceptableList);

  const localFallback = () => {
    try {
      return isAnswerCorrectLocal(learnerAnswer, acceptable, problem);
    } catch {
      return false;
    }
  };

  const shouldUseBackend = isShortAnswerItem(problem) || isFillInBlank(problem);
  if (!shouldUseBackend) return localFallback();

  try {
    const questionText = String(
      problem?.question || problem?.prompt || problem?.Q || problem?.q || ''
    ).trim();
    const expectedAnswer = String(problem?.answer || problem?.expected || '').trim();

    const keywords = Array.isArray(problem?.keywords) ? problem.keywords : [];
    const minKeywords = Number.isInteger(problem?.minKeywords)
      ? problem.minKeywords
      : (keywords.length > 0 ? 1 : 0);

    const res = await fetch('/api/judge-short-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: questionText,
        learnerAnswer,
        expectedAnswer,
        expectedAny: acceptable,
        keywords,
        minKeywords,
      }),
    });

    if (!res.ok) throw new Error(`judge-short-answer ${res.status}`);
    const data = await res.json();
    if (typeof data?.correct === 'boolean') return data.correct;
  } catch {
    // ignore and fall back to local
  }

  return localFallback();
}
