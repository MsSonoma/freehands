import { NextResponse } from 'next/server.js';

import { isMasteryEvidenceEnabled } from '@/app/lib/masteryEvidence/constants.js';
import {
  buildFollowUpAvailability,
  normalizeFollowUpSettings,
  publicAvailability,
  publicRunState,
  startFollowUpRun,
  loadFollowUpRunState,
} from '@/app/lib/masteryEvidence/followUps.service.js';
import { normalizeWeeklyReviewDay } from '@/app/lib/masteryEvidence/followUps.js';
import {
  authenticateFollowUpRequest,
  createSupabaseFollowUpRepository,
  loadLessonForFollowUp,
} from '@/app/lib/masteryEvidence/followUps.server.js';
import { isUuid } from '@/app/lib/masteryEvidence/schema.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function responseForKind(result) {
  if (result?.kind === 'forbidden') {
    return NextResponse.json({ ok: false, error: 'Learner not found or unauthorized' }, { status: 403 });
  }
  if (result?.kind === 'not_found') {
    return NextResponse.json({ ok: false, error: 'Follow-Up not found' }, { status: 404 });
  }
  return null;
}

async function contextFor(request, deps = {}) {
  const auth = await authenticateFollowUpRequest(request, deps);
  if (!auth.user) {
    return {
      error: NextResponse.json(
        { ok: false, error: auth.error || 'Unauthorized' },
        { status: auth.status || 401 },
      ),
    };
  }
  const repository = deps.repository || createSupabaseFollowUpRepository(auth.admin, { client: auth.client });
  const loadLesson = deps.loadLesson || ((lessonKey) => loadLessonForFollowUp({
    lessonKey,
    facilitatorId: auth.user.id,
    admin: auth.admin,
    cwd: deps.cwd,
  }));
  return { auth, repository, loadLesson };
}

function enabled() {
  return isMasteryEvidenceEnabled(process.env);
}

export async function GET(request, deps = {}) {
  try {
    if (!enabled()) return NextResponse.json({ ok: true, enabled: false, cards: [] });
    const ctx = await contextFor(request, deps);
    if (ctx.error) return ctx.error;
    const learnerId = new URL(request.url).searchParams.get('learner_id');
    if (!isUuid(learnerId)) {
      return NextResponse.json({ ok: false, error: 'learner_id must be a UUID' }, { status: 400 });
    }
    const availability = await buildFollowUpAvailability({
      repository: ctx.repository,
      userId: ctx.auth.user.id,
      learnerId,
      loadLesson: ctx.loadLesson,
      now: deps.now?.() || new Date().toISOString(),
    });
    const failure = responseForKind(availability);
    if (failure) return failure;
    return NextResponse.json({ ok: true, enabled: true, ...publicAvailability(availability) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Follow-Up lookup failed' }, { status: 500 });
  }
}

export async function POST(request, deps = {}) {
  try {
    if (!enabled()) return NextResponse.json({ ok: false, error: 'Follow-Ups disabled' }, { status: 404 });
    const ctx = await contextFor(request, deps);
    if (ctx.error) return ctx.error;
    const body = await request.json().catch(() => null);
    if (body?.action !== 'start') {
      return NextResponse.json({ ok: false, error: 'Unsupported Follow-Up action' }, { status: 400 });
    }
    const learnerId = body?.learner_id;
    if (!isUuid(learnerId) || typeof body?.card_id !== 'string') {
      return NextResponse.json({ ok: false, error: 'learner_id and card_id are required' }, { status: 400 });
    }
    const now = deps.now?.() || new Date().toISOString();
    const availability = await buildFollowUpAvailability({
      repository: ctx.repository,
      userId: ctx.auth.user.id,
      learnerId,
      loadLesson: ctx.loadLesson,
      now,
      includePrivate: true,
    });
    const failure = responseForKind(availability);
    if (failure) return failure;
    const card = availability.cards.find((entry) => entry.id === body.card_id);
    if (!card) {
      return NextResponse.json({ ok: false, error: 'Follow-Up is no longer available' }, { status: 409 });
    }
    const run = await startFollowUpRun({
      repository: ctx.repository,
      userId: ctx.auth.user.id,
      learnerId,
      card,
      now,
    });
    const state = await loadFollowUpRunState({
      repository: ctx.repository,
      userId: ctx.auth.user.id,
      runId: run.id,
    });
    return NextResponse.json({ ok: true, ...publicRunState(state) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Follow-Up could not start' }, { status: 500 });
  }
}

export async function PATCH(request, deps = {}) {
  try {
    if (!enabled()) return NextResponse.json({ ok: false, error: 'Follow-Ups disabled' }, { status: 404 });
    const ctx = await contextFor(request, deps);
    if (ctx.error) return ctx.error;
    const body = await request.json().catch(() => null);
    const learnerId = body?.learner_id;
    if (!isUuid(learnerId)) {
      return NextResponse.json({ ok: false, error: 'learner_id must be a UUID' }, { status: 400 });
    }
    const learner = await ctx.repository.findOwnedLearner({
      userId: ctx.auth.user.id,
      learnerId,
    });
    if (!learner?.id) {
      return NextResponse.json({ ok: false, error: 'Learner not found or unauthorized' }, { status: 403 });
    }
    const settings = {};
    if (body.daily_followups_enabled !== undefined) {
      if (typeof body.daily_followups_enabled !== 'boolean') throw new Error('daily_followups_enabled must be boolean');
      settings.daily_followups_enabled = body.daily_followups_enabled;
    }
    if (body.weekly_reviews_enabled !== undefined) {
      if (typeof body.weekly_reviews_enabled !== 'boolean') throw new Error('weekly_reviews_enabled must be boolean');
      settings.weekly_reviews_enabled = body.weekly_reviews_enabled;
    }
    if (body.weekly_review_day !== undefined) {
      const normalized = normalizeWeeklyReviewDay(body.weekly_review_day);
      if (normalized !== String(body.weekly_review_day).trim().toLowerCase()) throw new Error('weekly_review_day is invalid');
      settings.weekly_review_day = normalized;
    }
    if (!Object.keys(settings).length) throw new Error('No Follow-Up settings supplied');
    const updated = await ctx.repository.updateSettings({
      userId: ctx.auth.user.id,
      learnerId,
      settings,
    });
    if (!updated?.id) {
      return NextResponse.json({ ok: false, error: 'Learner not found or unauthorized' }, { status: 403 });
    }
    return NextResponse.json({ ok: true, settings: normalizeFollowUpSettings(updated) });
  } catch (error) {
    const message = error?.message || 'Follow-Up settings update failed';
    const badInput = /must be|invalid|supplied/.test(message);
    return NextResponse.json({ ok: false, error: message }, { status: badInput ? 400 : 500 });
  }
}
