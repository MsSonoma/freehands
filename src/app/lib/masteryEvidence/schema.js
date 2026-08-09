import {
  MASTERY_EVIDENCE_SCHEMA_VERSION,
  MASTERY_EVIDENCE_STATUSES,
  STAGE_1_EVIDENCE_EVENT_TYPES,
  STAGE_1_PHASES,
} from './constants.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function normalizeOptionalText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

export function normalizeRequiredText(value, fieldName) {
  const text = normalizeOptionalText(value);
  if (!text) {
    throw new Error(`${fieldName} required`);
  }
  return text;
}

export function assertSchemaVersion(schemaVersion) {
  if (schemaVersion !== MASTERY_EVIDENCE_SCHEMA_VERSION) {
    throw new Error('Unsupported evidence schema version');
  }
}

export function assertEvidenceStatus(status) {
  const valid = Object.values(MASTERY_EVIDENCE_STATUSES);
  if (!valid.includes(status)) {
    throw new Error('Unsupported evidence status');
  }
}

export function assertStage1EventType(eventType) {
  const valid = Object.values(STAGE_1_EVIDENCE_EVENT_TYPES);
  if (!valid.includes(eventType)) {
    throw new Error('Unsupported evidence event type');
  }
}

export function assertStage1Phase(phase, { allowNull = true } = {}) {
  if (phase == null || phase === '') {
    if (allowNull) return null;
    throw new Error('phase required');
  }
  const normalized = String(phase).trim();
  if (!STAGE_1_PHASES.includes(normalized)) {
    throw new Error('Unsupported evidence phase');
  }
  return normalized;
}

export function normalizeJsonObject(value, fieldName) {
  if (value == null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  return value;
}

export function normalizeIsoTimestamp(value, fallback = null) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid timestamp');
  }
  return date.toISOString();
}

export function inferLessonSource({ lessonKey, lessonId, lessonData } = {}) {
  const key = String(lessonKey || lessonId || lessonData?.key || '').toLowerCase();
  if (key.startsWith('generated/')) return 'generated';
  if (key.startsWith('demo/')) return 'demo';
  if (lessonData?.userId || lessonData?.approved !== undefined) return 'generated';
  if (key) return 'built_in';
  return null;
}
