import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { snapshotLessonMatchesExecution } from '../../../lib/snapshotTakeoverHandoff.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EVENT_TYPES = new Set([
  'response_turn_started',
  'response_reminder',
  'response_received',
  'facilitator_escalated',
])

function isUuid(value) {
  return UUID_RE.test(String(value || '').trim())
}

function env() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

function clients() {
  const { url, anon, service } = env()
  if (!url || !anon || !service) return null
  return {
    pub: createClient(url, anon, { auth: { persistSession: false } }),
    admin: createClient(url, service, { auth: { persistSession: false } }),
  }
}

function bearer(request) {
  const value = request.headers.get('authorization') || request.headers.get('Authorization') || ''
  return value.startsWith('Bearer ') ? value.slice(7).trim() : ''
}

async function authenticatedUser(request, pub) {
  const token = bearer(request)
  if (!token) return null
  const { data, error } = await pub.auth.getUser(token)
  return error ? null : data?.user || null
}

async function ownsLearner(admin, userId, learnerId) {
  if (!isUuid(learnerId)) return false
  const { data, error } = await admin
    .from('learners')
    .select('id')
    .eq('id', learnerId)
    .or(`facilitator_id.eq.${userId},owner_id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle()
  return !error && String(data?.id || '') === String(learnerId)
}

async function activeExecution(admin, { learnerId, executionSessionId, browserSessionId }) {
  if (!isUuid(executionSessionId) || !isUuid(browserSessionId)) return null
  const { data, error } = await admin
    .from('lesson_sessions')
    .select('id, learner_id, lesson_id, session_id, instructional_teacher, ended_at, ended_reason')
    .eq('id', executionSessionId)
    .eq('learner_id', learnerId)
    .maybeSingle()
  if (error || !data) return null
  if (data.ended_at != null) return null
  if (String(data.session_id || '') !== String(browserSessionId || '')) return null
  if (String(data.instructional_teacher || '').toLowerCase() !== 'sonoma') return null
  return data
}

function safeText(value, max = 500) {
  return String(value || '').trim().slice(0, max)
}

function eventPayload(body, execution) {
  return {
    facilitator_id: body.facilitatorId,
    learner_id: body.learnerId,
    session_id: body.executionSessionId,
    lesson_key: safeText(body.lessonKey, 500) || execution.lesson_id || null,
    turn_id: body.turnId,
    phase: safeText(body.phase, 64) || null,
    turn_kind: safeText(body.turnKind, 64) || null,
    question_index: Number.isFinite(Number(body.questionIndex)) ? Math.max(0, Math.floor(Number(body.questionIndex))) : null,
    event_type: body.eventType,
    event_key: safeText(body.eventKey, 500),
    elapsed_seconds: Number.isFinite(Number(body.elapsedSeconds)) ? Math.max(0, Math.floor(Number(body.elapsedSeconds))) : null,
    reminder_stage: Number.isFinite(Number(body.reminderStage)) ? Math.max(0, Math.min(5, Math.floor(Number(body.reminderStage)))) : null,
    metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
  }
}

export async function POST(request) {
  const db = clients()
  if (!db) return NextResponse.json({ ok: false, error: 'Attention persistence is not configured' }, { status: 503 })

  const user = await authenticatedUser(request, db.pub)
  if (!user?.id) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  const action = safeText(body?.action, 32)
  const learnerId = safeText(body?.learnerId, 80)
  const executionSessionId = safeText(body?.executionSessionId, 80)
  const browserSessionId = safeText(body?.browserSessionId, 80)
  const turnId = safeText(body?.turnId, 80)
  const phase = safeText(body?.phase, 64).toLowerCase()
  if (!['event', 'notify'].includes(action) || !isUuid(learnerId) || !isUuid(executionSessionId) || !isUuid(browserSessionId) || !isUuid(turnId) || !['discussion', 'comprehension', 'exercise', 'worksheet', 'test'].includes(phase)) {
    return NextResponse.json({ ok: false, error: 'Invalid attention request' }, { status: 400 })
  }
  if (!await ownsLearner(db.admin, user.id, learnerId)) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 })
  }
  const execution = await activeExecution(db.admin, { learnerId, executionSessionId, browserSessionId })
  if (!execution) {
    return NextResponse.json({ ok: false, error: 'Lesson execution ownership is no longer active', code: 'EXECUTION_OWNERSHIP_LOST' }, { status: 409 })
  }
  const requestLessonKey = safeText(body?.lessonKey, 500)
  if (requestLessonKey && !snapshotLessonMatchesExecution(requestLessonKey, execution.lesson_id)) {
    return NextResponse.json({ ok: false, error: 'Lesson execution scope mismatch', code: 'EXECUTION_SCOPE_MISMATCH' }, { status: 409 })
  }

  if (action === 'event') {
    const eventType = safeText(body?.eventType, 80)
    const eventKey = safeText(body?.eventKey, 500)
    if (!EVENT_TYPES.has(eventType) || !eventKey) {
      return NextResponse.json({ ok: false, error: 'Invalid pacing event' }, { status: 400 })
    }
    const payload = eventPayload({ ...body, facilitatorId: user.id, eventType, eventKey }, execution)
    const { error } = await db.admin.from('sonoma_response_pacing_events').insert(payload)
    if (!error || error.code === '23505') {
      return NextResponse.json({ ok: true, duplicate: error?.code === '23505' })
    }
    console.error('[Sonoma attention] Event insert failed:', error)
    return NextResponse.json({ ok: false, error: 'Unable to record pacing event' }, { status: 500 })
  }

  const learnerLabel = safeText(body?.learnerName, 120) || 'A learner'
  const lessonLabel = safeText(body?.lessonTitle, 240) || safeText(body?.lessonKey, 240) || 'a Ms. Sonoma lesson'
  const elapsedSeconds = Number.isFinite(Number(body?.elapsedSeconds)) ? Math.max(0, Math.floor(Number(body.elapsedSeconds))) : 0
  const elapsedMinutes = Math.max(1, Math.round(elapsedSeconds / 60))
  const dedupeKey = `sonoma-attention:${executionSessionId}:${turnId}`
  const metadata = {
    source: 'ms-sonoma-response-pacing',
    learnerId,
    executionSessionId,
    lessonKey: safeText(body?.lessonKey, 500) || execution.lesson_id || null,
    turnId,
    phase,
    turnKind: safeText(body?.turnKind, 64) || null,
    questionIndex: Number.isFinite(Number(body?.questionIndex)) ? Math.max(0, Math.floor(Number(body.questionIndex))) : null,
    elapsedSeconds,
  }
  const { error } = await db.admin.from('facilitator_notifications').insert({
    facilitator_id: user.id,
    category: 'learner-attention',
    type: 'sonoma_response_unanswered',
    title: 'Ms. Sonoma needs facilitator attention',
    body: `${learnerLabel} has not responded during ${lessonLabel} for about ${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'}.`,
    dedupe_key: dedupeKey,
    metadata,
  })
  if (!error || error.code === '23505') {
    return NextResponse.json({ ok: true, duplicate: error?.code === '23505', dedupeKey })
  }
  console.error('[Sonoma attention] Notification insert failed:', error)
  return NextResponse.json({ ok: false, error: 'Unable to notify the facilitator' }, { status: 500 })
}