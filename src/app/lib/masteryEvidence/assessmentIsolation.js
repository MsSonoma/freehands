import { buildItemIdentity } from './identity.js';

export const ASSESSMENT_ISOLATION_VERSION = 'assessment-isolation-v1';

export const ASSESSMENT_ISOLATION_STATUSES = Object.freeze({
  ISOLATED: 'isolated',
  NOT_ISOLATED: 'not_isolated',
  UNAVAILABLE: 'unavailable',
});

export const ASSESSMENT_ROLES = Object.freeze({
  INSTRUCTIONAL: 'instructional',
  ASSESSMENT_RESERVED: 'assessment_reserved',
});

const RESERVED_LESSON_FIELDS = Object.freeze([
  'test',
  'assessment',
  'assessments',
  'reservedAssessment',
  'reserved_assessment',
  'answerKey',
  'answer_key',
  'testAnswerKey',
  'test_answer_key',
]);

const INSTRUCTIONAL_PHASE_NAMES = Object.freeze([
  'discussion',
  'comprehension',
  'exercise',
  'worksheet',
]);

function cloneSansReserved(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(cloneSansReserved);
  if (typeof value !== 'object') return value;

  const next = {};
  for (const [key, entryValue] of Object.entries(value)) {
    if (RESERVED_LESSON_FIELDS.includes(key)) continue;
    next[key] = cloneSansReserved(entryValue);
  }
  return next;
}

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cloneItemWithRole(item, assessmentRole, sourceRole) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    assessmentRole,
    assessment_role: assessmentRole,
    evidence_purpose: sourceRole || assessmentRole,
    sourceRole: sourceRole || null,
  };
}

export function buildInstructionalLessonView(lesson = null) {
  if (!lesson || typeof lesson !== 'object') return lesson || null;
  const view = cloneSansReserved(lesson);
  return {
    ...view,
    assessmentIsolationVersion: ASSESSMENT_ISOLATION_VERSION,
  };
}

export function getReservedAssessmentItems(lesson = null) {
  if (!lesson || typeof lesson !== 'object') return [];
  const candidates = [];
  if (Array.isArray(lesson.test)) candidates.push(...lesson.test);
  else if (Array.isArray(lesson.test?.questions)) candidates.push(...lesson.test.questions);

  if (lesson.raw && typeof lesson.raw === 'object') {
    if (Array.isArray(lesson.raw.test)) candidates.push(...lesson.raw.test);
    else if (Array.isArray(lesson.raw.test?.questions)) candidates.push(...lesson.raw.test.questions);
  }

  const seen = new Set();
  const unique = [];
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const key = JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(cloneItemWithRole(item, ASSESSMENT_ROLES.ASSESSMENT_RESERVED, 'test'));
  }
  return unique;
}

export function hasSeparableReservedAssessmentPool(lesson = null) {
  return getReservedAssessmentItems(lesson).length > 0;
}

export function roleForPhase(phase = '') {
  return String(phase || '').toLowerCase() === 'test'
    ? ASSESSMENT_ROLES.ASSESSMENT_RESERVED
    : ASSESSMENT_ROLES.INSTRUCTIONAL;
}

export function tagItemsForPhase(items = [], phase = '') {
  const assessmentRole = roleForPhase(phase);
  return asArray(items).map((item) => cloneItemWithRole(item, assessmentRole, phase || assessmentRole));
}

function getInstructionalItemsFromPhaseSets(phaseSets = null) {
  if (!phaseSets || typeof phaseSets !== 'object') return [];
  return INSTRUCTIONAL_PHASE_NAMES.flatMap((phase) => tagItemsForPhase(phaseSets[phase] || [], phase));
}

async function identityRecords({ lessonKey, lessonId, lessonData, items }) {
  const records = [];
  for (const item of items || []) {
    const identity = await buildItemIdentity({ lessonKey, lessonId, lessonData, item });
    records.push({ item, identity });
  }
  return records;
}

function identityKeys(record) {
  const keys = [];
  const stableItemId = record?.identity?.stableItemId;
  const itemContentHash = record?.identity?.itemContentHash;
  if (stableItemId) keys.push(`stable:${stableItemId}`);
  if (itemContentHash) keys.push(`content:${itemContentHash}`);
  return keys;
}

export async function analyzeAssessmentIsolation({
  lessonKey = '',
  lessonId = '',
  lessonData = null,
  phaseSets = null,
} = {}) {
  const reservedItems = getReservedAssessmentItems(lessonData);
  if (!reservedItems.length) {
    return {
      version: ASSESSMENT_ISOLATION_VERSION,
      status: ASSESSMENT_ISOLATION_STATUSES.UNAVAILABLE,
      reservedAssessmentCount: 0,
      reason: 'no_separable_reserved_assessment_pool',
      overlaps: [],
      reservedItemIdentities: [],
    };
  }

  const instructionalItems = getInstructionalItemsFromPhaseSets(phaseSets);
  const [reservedRecords, instructionalRecords] = await Promise.all([
    identityRecords({ lessonKey, lessonId, lessonData, items: reservedItems }),
    identityRecords({ lessonKey, lessonId, lessonData, items: instructionalItems }),
  ]);

  const instructionalByKey = new Map();
  for (const record of instructionalRecords) {
    for (const key of identityKeys(record)) {
      if (!instructionalByKey.has(key)) instructionalByKey.set(key, []);
      instructionalByKey.get(key).push(record);
    }
  }

  const overlaps = [];
  const seenOverlapKeys = new Set();
  for (const reserved of reservedRecords) {
    for (const key of identityKeys(reserved)) {
      const matches = instructionalByKey.get(key) || [];
      for (const instructional of matches) {
        const overlapKey = `${key}:${reserved.identity?.stableItemId || ''}:${instructional.identity?.stableItemId || ''}`;
        if (seenOverlapKeys.has(overlapKey)) continue;
        seenOverlapKeys.add(overlapKey);
        overlaps.push({
          match_key: key,
          reserved_stable_item_id: reserved.identity?.stableItemId || null,
          reserved_item_content_hash: reserved.identity?.itemContentHash || null,
          instructional_stable_item_id: instructional.identity?.stableItemId || null,
          instructional_item_content_hash: instructional.identity?.itemContentHash || null,
          instructional_role: instructional.item?.sourceRole || null,
        });
      }
    }
  }

  return {
    version: ASSESSMENT_ISOLATION_VERSION,
    status: overlaps.length
      ? ASSESSMENT_ISOLATION_STATUSES.NOT_ISOLATED
      : ASSESSMENT_ISOLATION_STATUSES.ISOLATED,
    reservedAssessmentCount: reservedRecords.length,
    reason: overlaps.length ? 'deterministic_instructional_assessment_overlap' : null,
    overlaps,
    reservedItemIdentities: reservedRecords.map((record) => record.identity),
  };
}
