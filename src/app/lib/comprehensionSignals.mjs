export const COMPREHENSION_SIGNAL_PROTOCOL_VERSION = 'comprehension-signal-v1';

export const COMPREHENSION_SIGNAL_STATUSES = Object.freeze([
  'question_only',
  'uncertain',
  'partial',
  'misconception',
  'self_reported_understanding',
  'unresolved',
  'not_enough_information',
]);

const STRATEGIES = new Set([
  'concrete_example',
  'analogy',
  'contrast',
  'step_by_step',
  'spatial_model',
  'number_model',
  'plain_language',
  'acknowledgement',
  'other',
]);

function cleanText(value, maxLength = 800) {
  const text = value == null ? '' : String(value).trim();
  return text.length > maxLength ? text.slice(0, maxLength) : text;
}

function cleanList(value, maxItems = 5) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const result = [];
  for (const item of source) {
    const text = cleanText(item, 240);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= maxItems) break;
  }
  return result;
}

export function normalizeComprehensionDiagnostic(value) {
  const input = value && typeof value === 'object' ? value : {};
  const status = COMPREHENSION_SIGNAL_STATUSES.includes(input.status)
    ? input.status
    : 'not_enough_information';
  return {
    protocol_version: COMPREHENSION_SIGNAL_PROTOCOL_VERSION,
    status,
    understood: cleanList(input.understood),
    unclear: cleanList(input.unclear),
    misconceptions: cleanList(input.misconceptions),
    summary: cleanText(input.summary, 320),
  };
}

export function normalizeInstructionalStrategy(value) {
  const strategy = cleanText(value, 80).toLowerCase().replace(/[^a-z0-9_]+/g, '_');
  return STRATEGIES.has(strategy) ? strategy : 'other';
}

export function fallbackComprehensionDiagnostic({ inputMode = 'typed', learnerMessage = '' } = {}) {
  if (inputMode === 'understood') {
    return normalizeComprehensionDiagnostic({
      status: 'self_reported_understanding',
      summary: 'The learner reported that the explanation now makes sense.',
    });
  }
  if (inputMode === 'deepen') {
    return normalizeComprehensionDiagnostic({
      status: 'unresolved',
      unclear: learnerMessage ? [learnerMessage] : [],
      summary: 'The learner reported that the target still does not make sense.',
    });
  }
  if (inputMode === 'reframe') {
    return normalizeComprehensionDiagnostic({
      status: 'uncertain',
      unclear: learnerMessage ? [learnerMessage] : [],
      summary: 'The learner requested a different representation of the target.',
    });
  }
  return normalizeComprehensionDiagnostic({ status: 'not_enough_information' });
}

export function buildInstructionalResponseContract() {
  return [
    'Return ONLY valid JSON with this exact top-level shape:',
    '{"reply":"learner-facing spoken response","strategy":"concrete_example|analogy|contrast|step_by_step|spatial_model|number_model|plain_language|acknowledgement|other","comprehension_signal":{"status":"question_only|uncertain|partial|misconception|self_reported_understanding|unresolved|not_enough_information","understood":[],"unclear":[],"misconceptions":[],"summary":""}}',
    'The reply is the only text the learner will hear. Do not put JSON or analysis inside reply.',
    'For comprehension_signal, be conservative: record understanding only when the learner explicitly states it or necessarily demonstrates it in their message.',
    'A question alone does not prove the learner understands its premises. Do not infer mastery.',
    'Only record a misconception when the learner actually expresses the mistaken idea. If evidence is insufficient, use not_enough_information.',
    'Keep understood, unclear, and misconceptions as short concept descriptions, not judgments about the learner.',
  ].join('\n');
}

function stripCodeFence(text) {
  const value = cleanText(text, 20000);
  const fenced = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : value;
}

export function parseInstructionalJsonResponse(text) {
  const raw = stripCodeFence(text);
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const reply = cleanText(parsed.reply, 4000);
  if (!reply) return null;
  return {
    reply,
    strategy: normalizeInstructionalStrategy(parsed.strategy),
    diagnostic: normalizeComprehensionDiagnostic(parsed.comprehension_signal),
  };
}
