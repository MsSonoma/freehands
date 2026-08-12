import { NextResponse } from 'next/server.js';

import { isMasteryEvidenceEnabled } from '@/app/lib/masteryEvidence/constants.js';
import {
  loadFollowUpRunState,
  presentFollowUpItem,
  publicRunState,
  recordFollowUpAssistance,
  respondToFollowUpItem,
} from '@/app/lib/masteryEvidence/followUps.service.js';
import {
  authenticateFollowUpRequest,
  createSupabaseFollowUpRepository,
} from '@/app/lib/masteryEvidence/followUps.server.js';
import { isUuid } from '@/app/lib/masteryEvidence/schema.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function routeContext(request, context = {}) {
  const deps = context.deps || {};
  const auth = await authenticateFollowUpRequest(request, deps);
  if (!auth.user) {
    return {
      error: NextResponse.json(
        { ok: false, error: auth.error || 'Unauthorized' },
        { status: auth.status || 401 },
      ),
    };
  }
  const params = await context.params;
  const runId = params?.runId;
  if (!isUuid(runId)) {
    return { error: NextResponse.json({ ok: false, error: 'Invalid Follow-Up id' }, { status: 400 }) };
  }
  return {
    auth,
    deps,
    runId,
    repository: deps.repository || createSupabaseFollowUpRepository(auth.admin),
  };
}

function operationResponse(result) {
  if (result?.kind === 'not_found') return NextResponse.json({ ok: false, error: 'Follow-Up not found' }, { status: 404 });
  if (result?.kind === 'forbidden') return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  if (result?.kind === 'disabled') return NextResponse.json({ ok: false, error: 'This Follow-Up is turned off' }, { status: 409 });
  if (result?.kind === 'conflict') return NextResponse.json({ ok: false, error: result.reason }, { status: 409 });
  if (result?.kind === 'invalid') return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
  return null;
}

export async function GET(request, context = {}) {
  try {
    if (!isMasteryEvidenceEnabled(process.env)) {
      return NextResponse.json({ ok: false, error: 'Follow-Ups disabled' }, { status: 404 });
    }
    const ctx = await routeContext(request, context);
    if (ctx.error) return ctx.error;
    const state = await loadFollowUpRunState({
      repository: ctx.repository,
      userId: ctx.auth.user.id,
      runId: ctx.runId,
    });
    const failure = operationResponse(state);
    if (failure) return failure;
    return NextResponse.json({ ok: true, ...publicRunState(state) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Follow-Up lookup failed' }, { status: 500 });
  }
}

export async function POST(request, context = {}) {
  try {
    if (!isMasteryEvidenceEnabled(process.env)) {
      return NextResponse.json({ ok: false, error: 'Follow-Ups disabled' }, { status: 404 });
    }
    const ctx = await routeContext(request, context);
    if (ctx.error) return ctx.error;
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || !isUuid(body.item_id)) {
      return NextResponse.json({ ok: false, error: 'item_id is required' }, { status: 400 });
    }
    const common = {
      repository: ctx.repository,
      userId: ctx.auth.user.id,
      runId: ctx.runId,
      itemId: body.item_id,
      now: ctx.deps.now?.() || new Date().toISOString(),
    };
    let result;
    if (body.action === 'present') result = await presentFollowUpItem(common);
    else if (body.action === 'assist') {
      result = await recordFollowUpAssistance({
        ...common,
        kind: body.kind,
        requestId: body.request_id,
      });
    } else if (body.action === 'respond') {
      result = await respondToFollowUpItem({ ...common, response: body.response });
    } else {
      return NextResponse.json({ ok: false, error: 'Unsupported Follow-Up action' }, { status: 400 });
    }
    const failure = operationResponse(result);
    if (failure) return failure;
    if (body.action === 'assist') return NextResponse.json({ ok: true, ...result });
    if (body.action === 'respond') {
      return NextResponse.json({
        ok: true,
        duplicate: result.duplicate === true,
        acknowledgement: result.acknowledgement || null,
        review_recommended: result.review_recommended === true,
        result: result.result || null,
        ...publicRunState(result.state),
      });
    }
    return NextResponse.json({ ok: true, ...publicRunState(result) });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Follow-Up write failed' }, { status: 500 });
  }
}
