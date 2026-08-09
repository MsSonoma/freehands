"use client";

import { getSupabaseClient } from '../supabaseClient.js';
import {
  MASTERY_EVIDENCE_SCHEMA_VERSION,
  MASTERY_EVIDENCE_STATUSES,
  STAGE_1_EVIDENCE_EVENT_TYPES,
  isMasteryEvidenceEnabled,
} from './constants.js';
import { inferLessonSource } from './schema.js';

const DEFAULT_WRITE_TIMEOUT_MS = 4000;

function normalizeText(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function getEvidenceEnabled() {
  return isMasteryEvidenceEnabled({
    NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED: process.env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED,
  });
}

function normalizeKeyPart(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[:|]/g, '-');
}

export function makeEvidenceIdempotencyKey({
  schemaVersion = MASTERY_EVIDENCE_SCHEMA_VERSION,
  sessionId,
  eventType,
  suffix = '',
} = {}) {
  const base = [
    normalizeKeyPart(schemaVersion),
    normalizeKeyPart(sessionId),
    normalizeKeyPart(eventType),
  ].filter(Boolean).join(':');
  const normalizedSuffix = normalizeKeyPart(suffix);
  return normalizedSuffix ? `${base}:${normalizedSuffix}` : base;
}

export function stableStringify(value) {
  if (value == null) return '';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export async function hashLessonContent(lessonData) {
  if (!lessonData || !globalThis.crypto?.subtle || typeof TextEncoder === 'undefined') return null;
  try {
    const bytes = new TextEncoder().encode(stableStringify(lessonData));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return null;
  }
}

async function defaultAuthTokenProvider() {
  const supabase = getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

export class MasteryEvidenceClient {
  constructor({
    enabled = getEvidenceEnabled(),
    fetchImpl = null,
    getAuthToken = defaultAuthTokenProvider,
    now = () => new Date().toISOString(),
    logger = console,
    writeTimeoutMs = DEFAULT_WRITE_TIMEOUT_MS,
  } = {}) {
    this.enabled = !!enabled;
    this.fetchImpl = fetchImpl || ((...args) => fetch(...args));
    this.getAuthToken = getAuthToken;
    this.now = now;
    this.logger = logger;
    this.writeTimeoutMs = writeTimeoutMs;
    this.status = this.enabled
      ? MASTERY_EVIDENCE_STATUSES.PARTIAL
      : MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
    this.hasFailedWrite = false;
    this.meta = null;
    this.evidenceSessionId = null;
    this.serverProvenance = null;
    this.recordedKeys = new Set();
    this.pendingWrites = new Set();
    this.readyPromise = null;
  }

  initialize({
    sessionId,
    browserSessionId,
    learnerId,
    lessonKey,
    lessonId,
    lessonData,
    startedAt,
  } = {}) {
    if (!this.enabled) {
      this.status = MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
      this.readyPromise = Promise.resolve({ ok: false, status: this.status });
      return this.readyPromise;
    }

    const normalizedSessionId = normalizeText(sessionId);
    const normalizedLearnerId = normalizeText(learnerId);
    const normalizedLessonKey = normalizeText(lessonKey);
    if (!normalizedSessionId || !normalizedLearnerId || !normalizedLessonKey) {
      this.status = MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
      this.readyPromise = Promise.resolve({ ok: false, status: this.status });
      return this.readyPromise;
    }

    this.meta = {
      sessionId: normalizedSessionId,
      browserSessionId: normalizeText(browserSessionId),
      learnerId: normalizedLearnerId,
      lessonKey: normalizedLessonKey,
      lessonId: normalizeText(lessonId),
      lessonData: lessonData || null,
      startedAt: startedAt || this.now(),
    };

    this.readyPromise = this.#createSession();
    return this.readyPromise;
  }

  async recordSessionStarted({ initialPhase = null } = {}) {
    if (!this.enabled) return { ok: false, status: this.status };
    const startedAt = this.meta?.startedAt || this.now();
    return await this.#trackWrite(this.#recordEvent({
      eventType: STAGE_1_EVIDENCE_EVENT_TYPES.SESSION_STARTED,
      occurredAt: startedAt,
      phase: initialPhase,
      suffix: STAGE_1_EVIDENCE_EVENT_TYPES.SESSION_STARTED,
      payload: { source: 'session-v2', initial_phase: initialPhase || null },
    }));
  }

  recordPhaseTransition({ previousPhase = null, phase = null, sequence = 0 } = {}) {
    if (!this.enabled) return Promise.resolve({ ok: false, status: this.status });
    const suffix = [
      STAGE_1_EVIDENCE_EVENT_TYPES.PHASE_TRANSITION,
      Number.isFinite(Number(sequence)) ? Number(sequence) : 0,
      previousPhase || 'unknown',
      phase || 'unknown',
    ].join(':');
    return this.#trackWrite(this.#recordEvent({
      eventType: STAGE_1_EVIDENCE_EVENT_TYPES.PHASE_TRANSITION,
      occurredAt: this.now(),
      phase,
      suffix,
      payload: {
        source: 'session-v2',
        previous_phase: previousPhase || null,
        phase: phase || null,
        sequence: Number.isFinite(Number(sequence)) ? Number(sequence) : 0,
      },
    }));
  }

  async recordSessionEnded({ reason = 'completed', testPercentage = null } = {}) {
    if (!this.enabled) return { ok: false, status: this.status };

    await Promise.allSettled(Array.from(this.pendingWrites));
    const endedAt = this.now();
    const eventResult = await this.#trackWrite(this.#recordEvent({
      eventType: STAGE_1_EVIDENCE_EVENT_TYPES.SESSION_ENDED,
      occurredAt: endedAt,
      phase: 'complete',
      suffix: STAGE_1_EVIDENCE_EVENT_TYPES.SESSION_ENDED,
      payload: {
        source: 'session-v2',
        reason,
        test_percentage: testPercentage,
      },
    }));

    const finalStatus = eventResult?.ok && !this.hasFailedWrite
      ? MASTERY_EVIDENCE_STATUSES.COMPLETE
      : MASTERY_EVIDENCE_STATUSES.PARTIAL;
    return await this.finalize({ evidenceStatus: finalStatus, endedAt });
  }

  async markPartial({ endedAt = this.now() } = {}) {
    if (!this.evidenceSessionId) {
      this.status = MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
      return { ok: false, status: this.status };
    }
    return await this.finalize({
      evidenceStatus: MASTERY_EVIDENCE_STATUSES.PARTIAL,
      endedAt,
    });
  }

  async finalize({ evidenceStatus = MASTERY_EVIDENCE_STATUSES.PARTIAL, endedAt = this.now() } = {}) {
    if (!this.enabled || !this.evidenceSessionId) {
      this.status = MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
      return { ok: false, status: this.status };
    }
    const response = await this.#post({
      action: 'finalize_session',
      evidence_session_id: this.evidenceSessionId,
      evidence_status: evidenceStatus,
      ended_at: endedAt,
    });
    if (response?.ok) {
      this.status = response.evidence_session?.evidence_status || evidenceStatus;
      return { ok: true, status: this.status, evidenceSession: response.evidence_session };
    }
    this.hasFailedWrite = true;
    this.status = MASTERY_EVIDENCE_STATUSES.PARTIAL;
    return { ok: false, status: this.status };
  }

  async #createSession() {
    try {
      const lessonContentHash = await hashLessonContent(this.meta?.lessonData);
      const response = await this.#post({
        action: 'create_session',
        schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
        session_id: this.meta.sessionId,
        browser_session_id: this.meta.browserSessionId,
        learner_id: this.meta.learnerId,
        lesson_key: this.meta.lessonKey,
        lesson_id: this.meta.lessonId,
        lesson_source: inferLessonSource({
          lessonKey: this.meta.lessonKey,
          lessonId: this.meta.lessonId,
          lessonData: this.meta.lessonData,
        }),
        lesson_version: normalizeText(this.meta.lessonData?.version || this.meta.lessonData?.updated_at),
        lesson_content_hash: lessonContentHash,
        teaching_protocol_version: 'session-v2',
        teaching_protocol_hash: null,
        started_at: this.meta.startedAt,
      });
      if (!response?.ok || !response.evidence_session?.id) {
        this.status = MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
        return { ok: false, status: this.status };
      }
      this.evidenceSessionId = response.evidence_session.id;
      this.serverProvenance = response.server_provenance || null;
      this.status = response.evidence_session.evidence_status || MASTERY_EVIDENCE_STATUSES.PARTIAL;
      return { ok: true, status: this.status, evidenceSession: response.evidence_session };
    } catch (error) {
      this.hasFailedWrite = true;
      this.status = MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
      this.logger?.warn?.('[MasteryEvidence] Session initialization failed:', error);
      return { ok: false, status: this.status };
    }
  }

  async #recordEvent({ eventType, occurredAt, phase, suffix, payload }) {
    try {
      if (this.readyPromise) await this.readyPromise;
      if (!this.evidenceSessionId || !this.meta) return { ok: false, status: this.status };
      const idempotencyKey = makeEvidenceIdempotencyKey({
        sessionId: this.meta.sessionId,
        eventType,
        suffix,
      });
      if (this.recordedKeys.has(idempotencyKey)) {
        return { ok: true, duplicate: true, status: this.status };
      }
      const response = await this.#post({
        action: 'record_event',
        schema_version: MASTERY_EVIDENCE_SCHEMA_VERSION,
        evidence_session_id: this.evidenceSessionId,
        event_type: eventType,
        idempotency_key: idempotencyKey,
        occurred_at: occurredAt,
        phase,
        payload,
        provenance: this.serverProvenance || null,
      });
      if (response?.ok) {
        this.recordedKeys.add(idempotencyKey);
        return { ok: true, duplicate: !!response.duplicate, status: this.status };
      }
      this.hasFailedWrite = true;
      return { ok: false, status: this.status };
    } catch (error) {
      this.hasFailedWrite = true;
      this.status = this.evidenceSessionId
        ? MASTERY_EVIDENCE_STATUSES.PARTIAL
        : MASTERY_EVIDENCE_STATUSES.UNAVAILABLE;
      this.logger?.warn?.('[MasteryEvidence] Event write failed:', error);
      return { ok: false, status: this.status };
    }
  }

  async #post(body) {
    const token = await this.getAuthToken();
    if (!token) throw new Error('Evidence auth token unavailable');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.writeTimeoutMs);
    try {
      const response = await this.fetchImpl('/api/evidence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Evidence request failed (${response.status})`);
      }
      return data;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  #trackWrite(promise) {
    const tracked = Promise.resolve(promise);
    this.pendingWrites.add(tracked);
    tracked.finally(() => this.pendingWrites.delete(tracked));
    return tracked;
  }
}
