import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

import { normalizeLessonKey } from '../lessonKeyNormalization.js';

const STOCK_SUBJECTS = new Set(['math', 'science', 'social studies', 'language arts']);
const FACILITATOR_FOLDER = 'Facilitator Lessons';

export function getFollowUpClients(deps = {}) {
  if (deps.clients) return deps.clients;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const createClientImpl = deps.createClientImpl || createClient;
  if (!url || !anon || !service) return null;
  return {
    pub: createClientImpl(url, anon, { auth: { persistSession: false } }),
    admin: createClientImpl(url, service, { auth: { persistSession: false } }),
  };
}

export function getBearerToken(request) {
  const auth = request.headers.get('authorization') || request.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export async function authenticateFollowUpRequest(request, deps = {}) {
  if (deps.authenticate) return deps.authenticate(request);
  const token = getBearerToken(request);
  if (!token) return { user: null, error: 'Missing authorization', status: 401 };
  const clients = getFollowUpClients(deps);
  if (!clients) return { user: null, error: 'Follow-Ups are not configured', status: 503 };
  const { data, error } = await clients.pub.auth.getUser(token);
  if (error || !data?.user?.id) return { user: null, error: 'Unauthorized', status: 401 };
  return { user: data.user, admin: clients.admin };
}

export function createSupabaseFollowUpRepository(admin) {
  return {
    async findOwnedLearner({ userId, learnerId }) {
      const { data, error } = await admin
        .from('learners')
        .select('id,name,facilitator_id,daily_followups_enabled,weekly_reviews_enabled,weekly_review_day')
        .eq('id', learnerId)
        .or(`facilitator_id.eq.${userId},owner_id.eq.${userId},user_id.eq.${userId}`)
        .maybeSingle();
      if (error) throw new Error('Learner ownership check failed');
      return data || null;
    },

    async updateSettings({ userId, learnerId, settings }) {
      const { data, error } = await admin
        .from('learners')
        .update(settings)
        .eq('id', learnerId)
        .or(`facilitator_id.eq.${userId},owner_id.eq.${userId},user_id.eq.${userId}`)
        .select('id,daily_followups_enabled,weekly_reviews_enabled,weekly_review_day')
        .maybeSingle();
      if (error) throw new Error(error.message || 'Follow-Up settings update failed');
      return data || null;
    },

    async getProfileTimezone({ userId }) {
      const { data, error } = await admin
        .from('profiles')
        .select('timezone')
        .eq('id', userId)
        .maybeSingle();
      if (error) return null;
      return typeof data?.timezone === 'string' ? data.timezone : null;
    },

    async listEvidenceEvents({ userId, learnerId }) {
      const { data, error } = await admin
        .from('learning_evidence_events')
        .select([
          'event_id',
          'event_type',
          'occurred_at',
          'session_id',
          'lesson_key',
          'lesson_id',
          'concept_id',
          'stable_item_id',
          'item_content_hash',
          'item_exposure_id',
          'assessment_role',
          'phase',
          'mastery_cycle_id',
          'mastery_check_id',
          'mastery_outcome',
          'retention_anchor_mastery_check_id',
        ].join(','))
        .eq('facilitator_id', userId)
        .eq('learner_id', learnerId)
        .in('event_type', ['mastery_check_result', 'retention_check_result', 'item_presented'])
        .order('occurred_at', { ascending: false })
        .limit(10000);
      if (error) throw new Error('Learning evidence history query failed');
      return Array.isArray(data) ? data : [];
    },

    async listReviewRuns({ userId, learnerId, reviewType = null, cycleKey = null, limit = 1000 }) {
      let query = admin
        .from('learning_review_runs')
        .select('*')
        .eq('facilitator_id', userId)
        .eq('learner_id', learnerId);
      if (reviewType) query = query.eq('review_type', reviewType);
      if (cycleKey) query = query.eq('cycle_key', cycleKey);
      const { data, error } = await query
        .order('started_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error('Review run history query failed');
      return Array.isArray(data) ? data : [];
    },

    async listReviewItems({ userId, learnerId, runIds }) {
      if (!runIds?.length) return [];
      const { data, error } = await admin
        .from('learning_review_items')
        .select('*')
        .eq('facilitator_id', userId)
        .eq('learner_id', learnerId)
        .in('run_id', runIds)
        .order('ordinal', { ascending: true });
      if (error) throw new Error('Review item query failed');
      return Array.isArray(data) ? data : [];
    },

    async listReviewEvents({ userId, learnerId, runIds }) {
      if (!runIds?.length) return [];
      const { data, error } = await admin
        .from('learning_review_events')
        .select('*')
        .eq('facilitator_id', userId)
        .eq('learner_id', learnerId)
        .in('run_id', runIds)
        .order('occurred_at', { ascending: true });
      if (error) throw new Error('Review event query failed');
      return Array.isArray(data) ? data : [];
    },

    async getRun({ userId, runId }) {
      const { data, error } = await admin
        .from('learning_review_runs')
        .select('*')
        .eq('id', runId)
        .eq('facilitator_id', userId)
        .maybeSingle();
      if (error) throw new Error('Review run query failed');
      return data || null;
    },

    async insertRun(run) {
      const { data, error } = await admin
        .from('learning_review_runs')
        .insert(run)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },

    async findRunByCycle({ learnerId, reviewType, cycleKey }) {
      const { data, error } = await admin
        .from('learning_review_runs')
        .select('*')
        .eq('learner_id', learnerId)
        .eq('review_type', reviewType)
        .eq('cycle_key', cycleKey)
        .maybeSingle();
      if (error) throw new Error('Review cycle query failed');
      return data || null;
    },

    async insertItems(items) {
      if (!items?.length) return [];
      const { data, error } = await admin
        .from('learning_review_items')
        .insert(items)
        .select('*');
      if (error) {
        const itemError = new Error(error.message || 'Review item creation failed');
        itemError.code = error.code;
        throw itemError;
      }
      return Array.isArray(data) ? data : [];
    },

    async insertEvent(event) {
      const { data, error } = await admin
        .from('learning_review_events')
        .insert(event)
        .select('*')
        .single();
      if (error?.code === '23505') {
        const { data: existing } = await admin
          .from('learning_review_events')
          .select('*')
          .eq('idempotency_key', event.idempotency_key)
          .maybeSingle();
        if (existing) return { ...existing, duplicate: true };
      }
      if (error) throw new Error(error.message || 'Review event write failed');
      return data;
    },

    async updateRun({ runId, updates }) {
      const { data, error } = await admin
        .from('learning_review_runs')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', runId)
        .select('*')
        .maybeSingle();
      if (error) throw new Error(error.message || 'Review run update failed');
      return data || null;
    },
  };
}

function resolveSafePath(root, ...parts) {
  const target = path.resolve(root, ...parts);
  const rootWithSeparator = `${path.resolve(root)}${path.sep}`;
  if (!target.startsWith(rootWithSeparator)) return null;
  return target;
}

export async function loadLessonForFollowUp({
  lessonKey,
  facilitatorId,
  admin,
  cwd = process.cwd(),
} = {}) {
  const normalized = normalizeLessonKey(String(lessonKey || '').trim());
  const slash = normalized?.indexOf('/') ?? -1;
  if (slash < 1) return null;
  const subject = normalized.slice(0, slash).toLowerCase().replace(/_/g, ' ');
  const filename = normalized.slice(slash + 1);
  if (!filename || filename.includes('..') || filename.includes('\\')) return null;

  let lesson = null;
  if (subject === 'generated') {
    if (!admin || !facilitatorId || filename.includes('/')) return null;
    const { data, error } = await admin.storage
      .from('lessons')
      .download(`facilitator-lessons/${facilitatorId}/${filename}`);
    if (error || !data) return null;
    lesson = JSON.parse(await data.text());
    lesson.isGenerated = true;
  } else {
    const lessonsRoot = path.join(cwd, 'public', 'lessons');
    const folder = subject === 'general' ? FACILITATOR_FOLDER : subject;
    if (subject !== 'general' && !STOCK_SUBJECTS.has(subject)) return null;
    const filePath = resolveSafePath(lessonsRoot, folder, filename);
    if (!filePath) return null;
    try {
      lesson = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } catch {
      return null;
    }
  }

  return {
    ...lesson,
    lessonKey: normalized,
    file: filename,
    subject: lesson.subject || subject,
  };
}
