export const MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION = 'mastery-identity-v1';
export const LESSON_IDENTITY_VERSION = 'lesson-identity-v1';
export const ITEM_IDENTITY_VERSION = 'item-identity-v1';
export const TEACHING_PROTOCOL_VERSION = 'session-v2-conversational-v1';

export const TEACHING_PROTOCOL_DESCRIPTOR = Object.freeze({
  protocol_version: TEACHING_PROTOCOL_VERSION,
  normal_path: [
    'socratic_discussion',
    'exercise_conversation',
    'worksheet',
    'test',
    'closing',
  ],
  active_controllers: {
    discussion: 'DiscussionPhase',
    exercise: 'ExerciseConversationPhase',
    worksheet: 'WorksheetPhase',
    test: 'TestPhase',
    closing: 'ClosingPhase',
  },
  active_apis: [
    '/api/sonoma-discussion',
    '/api/sonoma-exercise',
    '/api/evidence',
  ],
  assistance_controls: [
    'ask',
    'repeat',
    'visual_aids',
    'hint',
    'retry',
    'answer_reveal',
    'timeline_jump',
    'question_set_refresh',
  ],
  non_goals: [
    'assessment_isolation',
    'baseline',
    'independent_mastery',
    'retention',
  ],
});

const LESSON_CONTENT_FIELDS = Object.freeze([
  'title',
  'subject',
  'grade',
  'difficulty',
  'vocab',
  'vocabulary',
  'vocab_terms',
  'teachingNotes',
  'examples',
  'example',
  'sample',
  'wordProblems',
  'truefalse',
  'multiplechoice',
  'fillintheblank',
  'shortanswer',
  'comprehension',
  'exercise',
  'worksheet',
  'test',
  'baseline',
  'baselinePool',
  'baseline_pool',
  'baselineItems',
  'baseline_items',
  'retention',
  'retentionPool',
  'retention_pool',
  'retentionItems',
  'retention_items',
  'dailyFollowup',
  'dailyFollowups',
  'daily_followup',
  'daily_followups',
  'dailyFollowupPool',
  'daily_followup_pool',
  'weeklyReview',
  'weeklyReviews',
  'weekly_review',
  'weekly_reviews',
  'weeklyReviewPool',
  'weekly_review_pool',
  'discussion',
]);

const ITEM_CONTENT_FIELDS = Object.freeze([
  'sourceType',
  'type',
  'questionType',
  'question',
  'prompt',
  'text',
  'Q',
  'q',
  'options',
  'choices',
  'answer',
  'correct',
  'expected',
  'expectedAny',
  'keywords',
  'keyTerms',
  'minKeywords',
  'hint',
  'opportunityId',
]);

const EXPLICIT_ITEM_ID_FIELDS = Object.freeze([
  'stableItemId',
  'stable_item_id',
  'itemId',
  'item_id',
  'sourceId',
  'source_id',
  'id',
]);

const EXPLICIT_CONCEPT_ID_FIELDS = Object.freeze([
  'conceptId',
  'concept_id',
  'objectiveId',
  'objective_id',
  'standardId',
  'standard_id',
]);

function normalizeText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeIdentityPart(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._:/-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function selectDefinedFields(source, fields) {
  if (!source || typeof source !== 'object') return {};
  const selected = {};
  for (const field of fields) {
    if (source[field] !== undefined) selected[field] = source[field];
  }
  return selected;
}

function canonicalize(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value.trim().replace(/\s+/g, ' ');
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, canonicalize(entryValue)])
      .filter(([, entryValue]) => entryValue !== undefined);
    return Object.fromEntries(entries);
  }
  return String(value);
}

export function stableStringify(value) {
  if (value == null) return '';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export async function sha256Hex(value) {
  if (!globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') return null;
  const bytes = new TextEncoder().encode(String(value ?? ''));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashCanonicalValue(value) {
  return sha256Hex(stableStringify(canonicalize(value)));
}

function uuidFromSha256Hex(hex) {
  if (!hex || hex.length < 32) return null;
  const chars = hex.slice(0, 32).split('');
  chars[12] = '5';
  const variant = (parseInt(chars[16], 16) & 0x3) | 0x8;
  chars[16] = variant.toString(16);
  const s = chars.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

export function resolveStableLessonKey({ lessonKey = '', lessonId = '', lessonData = null } = {}) {
  const explicit = normalizeText(lessonKey)
    || normalizeText(lessonData?.key)
    || normalizeText(lessonData?.lessonKey)
    || normalizeText(lessonData?.lesson_key)
    || normalizeText(lessonData?.id)
    || normalizeText(lessonId);
  if (!explicit) return null;
  return explicit.replace(/\.json$/i, '');
}

export function canonicalizeLessonContent(lessonData = null) {
  const source = lessonData?.raw && typeof lessonData.raw === 'object'
    ? lessonData.raw
    : lessonData;
  return canonicalize(selectDefinedFields(source, LESSON_CONTENT_FIELDS));
}

export async function buildLessonIdentity({ lessonKey = '', lessonId = '', lessonData = null } = {}) {
  const stableLessonKey = resolveStableLessonKey({ lessonKey, lessonId, lessonData });
  const canonicalLessonContent = canonicalizeLessonContent(lessonData);
  const lessonContentHash = await hashCanonicalValue({
    identity_version: LESSON_IDENTITY_VERSION,
    content: canonicalLessonContent,
  });
  const lessonVersionSourceHash = await sha256Hex(stableStringify({
    identity_schema_version: MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION,
    lesson_identity_version: LESSON_IDENTITY_VERSION,
    stable_lesson_key: stableLessonKey,
    lesson_content_hash: lessonContentHash,
  }));
  return {
    identitySchemaVersion: MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION,
    lessonIdentityVersion: LESSON_IDENTITY_VERSION,
    stableLessonKey,
    lessonContentHash,
    lessonVersionId: uuidFromSha256Hex(lessonVersionSourceHash),
  };
}

export async function buildTeachingProtocolIdentity() {
  const protocolHash = await hashCanonicalValue({
    identity_schema_version: MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION,
    descriptor: TEACHING_PROTOCOL_DESCRIPTOR,
  });
  return {
    protocolVersion: TEACHING_PROTOCOL_VERSION,
    protocolHash,
    descriptor: TEACHING_PROTOCOL_DESCRIPTOR,
  };
}

function firstExplicitValue(source, fields) {
  if (!source || typeof source !== 'object') return null;
  for (const field of fields) {
    const value = normalizeText(source[field]);
    if (value) return { field, value };
  }
  return null;
}

export function canonicalizeItemContent(item = null) {
  return canonicalize(selectDefinedFields(item, ITEM_CONTENT_FIELDS));
}

export function deriveConceptId(item = null) {
  const explicit = firstExplicitValue(item, EXPLICIT_CONCEPT_ID_FIELDS);
  if (explicit?.value) {
    return `concept:${ITEM_IDENTITY_VERSION}:${normalizeIdentityPart(explicit.value)}`;
  }
  if (item?.objective && typeof item.objective === 'object') {
    const objectiveId = normalizeText(item.objective.id || item.objective.objectiveId || item.objective.objective_id);
    if (objectiveId) return `concept:${ITEM_IDENTITY_VERSION}:${normalizeIdentityPart(objectiveId)}`;
  }
  if (item?.standard && typeof item.standard === 'object') {
    const standardId = normalizeText(item.standard.id || item.standard.standardId || item.standard.standard_id);
    if (standardId) return `concept:${ITEM_IDENTITY_VERSION}:${normalizeIdentityPart(standardId)}`;
  }
  return null;
}

export async function buildItemIdentity({
  lessonKey = '',
  lessonId = '',
  lessonData = null,
  item = null,
} = {}) {
  if (!item || typeof item !== 'object') {
    return {
      stableItemId: null,
      itemContentHash: null,
      itemIdentityVersion: ITEM_IDENTITY_VERSION,
      conceptId: null,
    };
  }

  const stableLessonKey = resolveStableLessonKey({ lessonKey, lessonId, lessonData });
  const canonicalItemContent = canonicalizeItemContent(item);
  const itemContentHash = await hashCanonicalValue({
    identity_version: ITEM_IDENTITY_VERSION,
    content: canonicalItemContent,
  });
  const explicitSource = firstExplicitValue(item, EXPLICIT_ITEM_ID_FIELDS);
  const sourceIdentity = explicitSource?.value
    ? {
        kind: 'explicit_source_id',
        field: explicitSource.field,
        value: explicitSource.value,
        source_type: normalizeText(item.sourceType || item.type || item.questionType),
      }
    : {
        kind: 'content_fallback',
        item_content_hash: itemContentHash,
      };
  const stableItemHash = await sha256Hex(stableStringify({
    identity_schema_version: MASTERY_EVIDENCE_IDENTITY_SCHEMA_VERSION,
    item_identity_version: ITEM_IDENTITY_VERSION,
    stable_lesson_key: stableLessonKey,
    source_identity: sourceIdentity,
  }));

  return {
    stableItemId: stableItemHash ? `item:${ITEM_IDENTITY_VERSION}:${stableItemHash}` : null,
    itemContentHash,
    itemIdentityVersion: ITEM_IDENTITY_VERSION,
    conceptId: deriveConceptId(item),
  };
}
