import { stableStringify } from './client.js';

function normalizeTextPart(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value ?? '');
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createLegacyItemFingerprint({
  lessonKey = '',
  lessonId = '',
  phase = '',
  item = null,
  questionIndex = null,
} = {}) {
  const options = Array.isArray(item?.options)
    ? item.options
    : (Array.isArray(item?.choices) ? item.choices : []);
  const identity = {
    lesson_key: normalizeTextPart(lessonKey || lessonId),
    phase: normalizeTextPart(phase),
    source_id: normalizeTextPart(item?.id),
    source_type: normalizeTextPart(item?.sourceType || item?.type || item?.questionType),
    question_index: Number.isFinite(Number(questionIndex)) ? Number(questionIndex) : null,
    prompt: normalizeTextPart(item?.question || item?.prompt || item?.text || item?.Q || item?.q),
    options: options.map(normalizeTextPart),
    answer: normalizeTextPart(item?.answer ?? item?.expected ?? item?.correct ?? ''),
    expected_any: Array.isArray(item?.expectedAny) ? item.expectedAny.map(normalizeTextPart) : [],
  };

  return `legacy:${hashString(stableStringify(identity))}`;
}

export function summarizeEvidenceItem(item = null) {
  if (!item || typeof item !== 'object') return null;
  const options = Array.isArray(item.options)
    ? item.options
    : (Array.isArray(item.choices) ? item.choices : []);
  return {
    source_id: item.id || null,
    source_type: item.sourceType || item.type || item.questionType || null,
    question: item.question || item.prompt || item.text || item.Q || item.q || null,
    options: options.length ? options : null,
  };
}
