import { buildItemIdentity } from './identity.js';
import { getReservedAssessmentItems } from './assessmentIsolation.js';

export const BASELINE_PROTOCOL_VERSION = 'baseline-v1';

export const BASELINE_STATUSES = Object.freeze({
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  UNAVAILABLE: 'unavailable',
});

export const BASELINE_EVIDENCE_PURPOSE = 'baseline';

export const BASELINE_UNAVAILABLE_REASONS = Object.freeze({
  NO_BASELINE_POOL: 'no_baseline_pool',
  DETERMINISTIC_OVERLAP: 'deterministic_overlap',
  PRIOR_EXPOSURE: 'prior_exposure',
  RESUME_AFTER_INSTRUCTION: 'resume_after_instruction',
  LEGACY_OR_AMBIGUOUS_SNAPSHOT: 'legacy_or_ambiguous_snapshot',
  EVIDENCE_UNAVAILABLE: 'evidence_unavailable',
});

const BASELINE_POOL_FIELDS = Object.freeze([
  'baseline',
  'baselinePool',
  'baseline_pool',
  'baselineItems',
  'baseline_items',
  'priorKnowledge',
  'prior_knowledge',
]);

const INSTRUCTIONAL_PHASE_NAMES = Object.freeze([
  'discussion',
  'comprehension',
  'exercise',
  'worksheet',
]);

const INSTRUCTION_PHASES = new Set([
  'discussion',
  'teaching',
  'comprehension',
  'exercise',
  'worksheet',
  'test',
  'closing',
  'complete',
]);

function asArray(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

function cloneItem(item, index = 0) {
  if (!item || typeof item !== 'object') return null;
  return {
    ...item,
    evidence_purpose: BASELINE_EVIDENCE_PURPOSE,
    number: item.number || index + 1,
  };
}

function extractPoolFromObject(value) {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.questions)) return value.questions;
  if (Array.isArray(value.items)) return value.items;
  return [];
}

export function getBaselineItems(lesson = null) {
  if (!lesson || typeof lesson !== 'object') return [];
  const candidates = [];
  for (const field of BASELINE_POOL_FIELDS) {
    candidates.push(...extractPoolFromObject(lesson[field]));
  }
  if (lesson.raw && typeof lesson.raw === 'object') {
    for (const field of BASELINE_POOL_FIELDS) {
      candidates.push(...extractPoolFromObject(lesson.raw[field]));
    }
  }

  const seen = new Set();
  const unique = [];
  for (const [index, item] of candidates.entries()) {
    const cloned = cloneItem(item, index);
    if (!cloned) continue;
    const key = JSON.stringify(cloned);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(cloned);
  }
  return unique;
}

export function hasInstructionBegunFromSnapshot(snapshot = null) {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const currentPhase = String(snapshot.currentPhase || '').toLowerCase();
  if (INSTRUCTION_PHASES.has(currentPhase)) return true;
  const completed = Array.isArray(snapshot.completedPhases) ? snapshot.completedPhases : [];
  return completed.some((phase) => INSTRUCTION_PHASES.has(String(phase || '').toLowerCase()));
}

function itemIdentityKeys(identity = {}) {
  return [
    identity?.stableItemId ? `stable:${identity.stableItemId}` : null,
    identity?.itemContentHash ? `content:${identity.itemContentHash}` : null,
  ].filter(Boolean);
}

function instructionalItemsFromPhaseSets(phaseSets = null) {
  if (!phaseSets || typeof phaseSets !== 'object') return [];
  return INSTRUCTIONAL_PHASE_NAMES.flatMap((phase) => asArray(phaseSets[phase]));
}

async function identityRecords({ lessonKey, lessonId, lessonData, items }) {
  const records = [];
  for (const item of items || []) {
    const identity = await buildItemIdentity({ lessonKey, lessonId, lessonData, item });
    records.push({ item, identity, keys: itemIdentityKeys(identity) });
  }
  return records;
}

function makeKeySet(records = []) {
  const set = new Set();
  for (const record of records) {
    for (const key of record.keys || []) set.add(key);
  }
  return set;
}

function findOverlaps(records = [], blockedKeys = new Set(), role = 'instructional') {
  const overlaps = [];
  for (const record of records) {
    for (const key of record.keys || []) {
      if (blockedKeys.has(key)) {
        overlaps.push({
          match_key: key,
          role,
          stable_item_id: record.identity?.stableItemId || null,
          item_content_hash: record.identity?.itemContentHash || null,
        });
      }
    }
  }
  return overlaps;
}

export async function buildBaselinePlan({
  lessonKey = '',
  lessonId = '',
  lessonData = null,
  phaseSets = null,
  priorExposedKeys = [],
  targetCount = 2,
} = {}) {
  const baselineItems = getBaselineItems(lessonData);
  if (!baselineItems.length) {
    return {
      protocolVersion: BASELINE_PROTOCOL_VERSION,
      status: BASELINE_STATUSES.UNAVAILABLE,
      reason: BASELINE_UNAVAILABLE_REASONS.NO_BASELINE_POOL,
      selectedItems: [],
      baselineItemCount: 0,
      candidateIdentities: [],
      overlaps: [],
    };
  }

  const [baselineRecords, instructionalRecords, reservedRecords] = await Promise.all([
    identityRecords({ lessonKey, lessonId, lessonData, items: baselineItems }),
    identityRecords({ lessonKey, lessonId, lessonData, items: instructionalItemsFromPhaseSets(phaseSets) }),
    identityRecords({ lessonKey, lessonId, lessonData, items: getReservedAssessmentItems(lessonData) }),
  ]);

  const instructionalKeys = makeKeySet(instructionalRecords);
  const reservedKeys = makeKeySet(reservedRecords);
  const exposedKeys = new Set(priorExposedKeys || []);

  const validRecords = [];
  const overlaps = [];
  const priorExposed = [];

  for (const record of baselineRecords) {
    const recordOverlaps = [
      ...findOverlaps([record], instructionalKeys, 'instructional'),
      ...findOverlaps([record], reservedKeys, 'assessment_reserved'),
    ];
    if (recordOverlaps.length) {
      overlaps.push(...recordOverlaps);
      continue;
    }
    const wasExposed = (record.keys || []).some((key) => exposedKeys.has(key));
    if (wasExposed) {
      priorExposed.push({
        stable_item_id: record.identity?.stableItemId || null,
        item_content_hash: record.identity?.itemContentHash || null,
      });
      continue;
    }
    validRecords.push(record);
  }

  if (!validRecords.length) {
    return {
      protocolVersion: BASELINE_PROTOCOL_VERSION,
      status: BASELINE_STATUSES.UNAVAILABLE,
      reason: priorExposed.length
        ? BASELINE_UNAVAILABLE_REASONS.PRIOR_EXPOSURE
        : BASELINE_UNAVAILABLE_REASONS.DETERMINISTIC_OVERLAP,
      selectedItems: [],
      baselineItemCount: 0,
      candidateIdentities: baselineRecords.map((record) => record.identity),
      overlaps,
      priorExposed,
    };
  }

  const count = Math.max(1, Math.min(3, Number(targetCount) || 2, validRecords.length));
  return {
    protocolVersion: BASELINE_PROTOCOL_VERSION,
    status: validRecords.length >= Math.min(2, baselineItems.length)
      ? 'available'
      : BASELINE_STATUSES.PARTIAL,
    reason: null,
    selectedItems: validRecords.slice(0, count).map((record) => record.item),
    baselineItemCount: count,
    candidateIdentities: baselineRecords.map((record) => record.identity),
    selectedIdentities: validRecords.slice(0, count).map((record) => record.identity),
    overlaps,
    priorExposed,
  };
}
