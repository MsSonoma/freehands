import { NextResponse } from 'next/server.js'
import { normalizeLessonKey } from '../../lib/lessonKeyNormalization.js'
import { getSyllabusRequestContext } from '../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../lib/syllabus/supabaseRepository.server.mjs'
import { validateLearnerId } from '../../lib/syllabus/schema.mjs'
import {
  WEBB_COMPOSITION_PROTOCOL_VERSION,
  assembleWebbCompositionEssay,
  compositionResearchSnapshot,
  normalizeAcceptedCompositionSentences,
  normalizeWebbCompositionPlan,
  compositionPlanViolations,
} from '../../lib/webbCompositionModel.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function normalizeUuid(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null
}

function cleanOccurrenceId(value) {
  const text = String(value || '').trim()
  return text && text.length <= 500 && !/[\u0000-\u001f]/.test(text) ? text : null
}

function cleanObjectives(values) {
  return Array.isArray(values) ? values.map(value => String(value || '').trim()).filter(Boolean).slice(0, 12) : []
}

function cleanLearnerNotes(notes = {}, objectiveCount = 0) {
  const result = {}
  if (!notes || typeof notes !== 'object' || Array.isArray(notes)) return result
  for (const [rawIndex, note] of Object.entries(notes)) {
    const index = Number(rawIndex)
    if (!Number.isInteger(index) || index < 0 || index >= objectiveCount) continue
    const text = String(note?.text || '').trim().slice(0, 4000)
    if (!text || note?.provenance !== 'learner-message') continue
    result[index] = {
      objectiveIndex: index,
      text,
      sourceMessageId: note.sourceMessageId || null,
      sourceMessageCreatedAt: note.sourceMessageCreatedAt || null,
      accuracy: note.accuracy === 'correct' ? 'correct' : null,
      provenance: 'learner-message',
    }
  }
  return result
}

async function verifyExecution(admin, { executionSessionId, learnerId, lessonKey, occurrenceId, browserSessionId }) {
  const { data: session, error: sessionError } = await admin.from('lesson_sessions')
    .select('id,learner_id,lesson_id,session_id,instructional_teacher,ended_at')
    .eq('id', executionSessionId)
    .eq('learner_id', learnerId)
    .maybeSingle()
  if (sessionError) throw sessionError
  if (!session || session.instructional_teacher !== 'webb' || normalizeLessonKey(session.lesson_id) !== lessonKey) return null
  if (browserSessionId && String(session.session_id || '').toLowerCase() !== browserSessionId) return null
  const { data: events, error: eventError } = await admin.from('lesson_session_events')
    .select('metadata')
    .eq('session_id', executionSessionId)
    .eq('learner_id', learnerId)
    .eq('event_type', 'started')
    .order('occurred_at', { ascending: true })
    .limit(5)
  if (eventError) throw eventError
  const occurrenceMatches = (events || []).some(event => String(event?.metadata?.syllabus_occurrence_id || '').trim() === occurrenceId)
  return occurrenceMatches ? session : null
}

export async function GET(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ ok: false, error: context.error }, { status: context.status })
    const url = new URL(request.url)
    const learnerId = validateLearnerId(url.searchParams.get('learnerId'))
    const occurrenceId = cleanOccurrenceId(url.searchParams.get('occurrenceId'))
    if (!learnerId || !occurrenceId) return NextResponse.json({ ok: false, error: 'Learner and occurrence are required' }, { status: 400 })
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const learner = await repository.findOwnedLearner(learnerId, context.user.id)
    if (!learner) return NextResponse.json({ ok: false, error: 'Learner not found or unauthorized' }, { status: 403 })
    const { data, error } = await context.admin.from('webb_compositions')
      .select('*')
      .eq('facilitator_id', context.user.id)
      .eq('learner_id', learnerId)
      .eq('syllabus_occurrence_id', occurrenceId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return NextResponse.json({ ok: true, composition: data || null })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Could not load Mrs. Webb composition' }, { status: 500 })
  }
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ ok: false, error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const lessonKey = normalizeLessonKey(body?.lessonKey)
    const occurrenceId = cleanOccurrenceId(body?.occurrenceId)
    const executionSessionId = normalizeUuid(body?.executionSessionId)
    const browserSessionId = body?.browserSessionId ? normalizeUuid(body.browserSessionId) : null
    if (!learnerId || !lessonKey || !occurrenceId || !executionSessionId) {
      return NextResponse.json({ ok: false, error: 'Learner, lesson, occurrence, and execution session are required' }, { status: 400 })
    }
    if (body?.browserSessionId && !browserSessionId) {
      return NextResponse.json({ ok: false, error: 'Invalid browser session id' }, { status: 400 })
    }
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const learner = await repository.findOwnedLearner(learnerId, context.user.id)
    if (!learner) return NextResponse.json({ ok: false, error: 'Learner not found or unauthorized' }, { status: 403 })
    const execution = await verifyExecution(context.admin, { executionSessionId, learnerId, lessonKey, occurrenceId, browserSessionId })
    if (!execution) return NextResponse.json({ ok: false, error: 'Mrs. Webb execution could not be verified' }, { status: 409 })

    const objectives = cleanObjectives(body?.objectives)
    const learnerNotes = cleanLearnerNotes(body?.learnerNotes, objectives.length)
    const plan = normalizeWebbCompositionPlan(body?.compositionPlan, objectives.length)
    const violations = compositionPlanViolations(plan, objectives.length)
    if (violations.length) return NextResponse.json({ ok: false, error: 'Invalid composition plan', violations }, { status: 400 })
    const acceptedSentences = normalizeAcceptedCompositionSentences(body?.acceptedSentences, plan)
    const essay = assembleWebbCompositionEssay(plan, acceptedSentences)
    const requestedStatus = body?.status === 'final' ? 'final' : 'draft'
    if (requestedStatus === 'final' && !essay) {
      return NextResponse.json({ ok: false, error: 'A final composition requires every learner-authored slot' }, { status: 400 })
    }
    const now = new Date().toISOString()
    const row = {
      facilitator_id: context.user.id,
      learner_id: learnerId,
      lesson_key: lessonKey,
      syllabus_occurrence_id: occurrenceId,
      execution_session_id: executionSessionId,
      browser_session_id: browserSessionId || execution.session_id || null,
      status: requestedStatus,
      protocol_version: WEBB_COMPOSITION_PROTOCOL_VERSION,
      app_build_id: process.env.VERCEL_GIT_COMMIT_SHA || process.env.NEXT_PUBLIC_BUILD_ID || null,
      composition_plan: plan,
      research_notes: compositionResearchSnapshot(objectives, learnerNotes),
      accepted_sentences: acceptedSentences,
      essay: essay || null,
      updated_at: now,
      ...(requestedStatus === 'final' ? { finalized_at: now } : {}),
    }
    const { data, error } = await context.admin.from('webb_compositions')
      .upsert(row, { onConflict: 'execution_session_id' })
      .select('*')
      .single()
    if (error) throw error
    return NextResponse.json({ ok: true, composition: data })
  } catch (error) {
    return NextResponse.json({ ok: false, error: error?.message || 'Could not save Mrs. Webb composition' }, { status: 500 })
  }
}
