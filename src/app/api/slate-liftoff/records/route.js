import { NextResponse } from 'next/server.js'

import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization.js'
import { getSyllabusRequestContext } from '@/app/lib/syllabus/request.server.mjs'
import { validateLearnerId } from '@/app/lib/syllabus/schema.mjs'
import { buildSlateTestReportFromEvents } from '@/app/lib/slateTestGradeReport.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function optionalText(value, max = 240) {
  const text = String(value || '').trim()
  return text ? text.slice(0, max) : null
}

function normalizeUuid(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(normalized)
    ? normalized
    : null
}

function percentage(value) {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null
}

function safeArray(value, max = 120) {
  return Array.isArray(value) ? value.slice(0, max) : []
}

export async function GET(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })

    const url = new URL(request.url)
    const learnerId = validateLearnerId(url.searchParams.get('learnerId'))
    const lessonKey = normalizeLessonKey(url.searchParams.get('lessonKey'))
    const occurrenceId = String(url.searchParams.get('occurrenceId') || '').trim()
    if (!lessonKey) return NextResponse.json({ error: 'A lessonKey is required', code: 'LESSON_KEY_REQUIRED' }, { status: 400 })

    const admin = context.admin
    const { data: learner, error: learnerError } = await admin
      .from('learners')
      .select('id, facilitator_id')
      .eq('id', learnerId)
      .eq('facilitator_id', context.user.id)
      .maybeSingle()
    if (learnerError) throw learnerError
    if (!learner) return NextResponse.json({ error: 'Learner not found or unauthorized', code: 'FORBIDDEN' }, { status: 403 })

    let query = admin.from('slate_liftoff_records')
      .select('*')
      .eq('facilitator_id', context.user.id)
      .eq('learner_id', learnerId)
      .eq('lesson_key', lessonKey)
      .order('completed_at', { ascending: false })
      .limit(20)
    if (occurrenceId) query = query.eq('syllabus_occurrence_id', occurrenceId)
    const { data, error } = await query
    if (error?.code === '42P01') return NextResponse.json({ records: [] })
    if (error) throw error
    const records = data || []
    const ids = records.map(r => String(r.execution_session_id || '')).filter(Boolean)
    if (!ids.length) return NextResponse.json({ records })
    const evidence = await admin.from('learning_evidence_events')
      .select('session_id,event_type,payload,result,occurred_at,event_sequence')
      .eq('learner_id', learnerId).eq('facilitator_id', context.user.id)
      .in('session_id', ids)
      .in('event_type', ['item_presented', 'answer_evaluated'])
      .order('occurred_at', { ascending: true }).limit(2000)
    if (evidence.error) return NextResponse.json({ records: records.map(row => ({ ...row, test_report_unavailable: true })) })
    const grouped = new Map()
    for (const event of evidence.data || []) {
      const id = String(event.session_id || '')
      if (!grouped.has(id)) grouped.set(id, [])
      grouped.get(id).push(event)
    }
    return NextResponse.json({ records: records.map(row => ({
      ...row,
      test_report: buildSlateTestReportFromEvents(grouped.get(String(row.execution_session_id)) || [], row.independent_test_percentage),
    })) })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Could not load Liftoff instructional evidence' }, { status: Number.isInteger(error?.status) ? error.status : 500 })
  }
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })

    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const lessonKey = normalizeLessonKey(body?.lessonKey)
    const occurrenceId = String(body?.occurrenceId || '').trim()
    const executionSessionId = normalizeUuid(body?.executionSessionId)
    if (!lessonKey || !occurrenceId || !executionSessionId) {
      return NextResponse.json({ error: 'Liftoff record identity is incomplete', code: 'LIFTOFF_RECORD_IDENTITY_REQUIRED' }, { status: 400 })
    }

    const admin = context.admin
    const { data: learner, error: learnerError } = await admin
      .from('learners')
      .select('id, facilitator_id')
      .eq('id', learnerId)
      .eq('facilitator_id', context.user.id)
      .maybeSingle()
    if (learnerError) throw learnerError
    if (!learner) return NextResponse.json({ error: 'Learner not found or unauthorized', code: 'FORBIDDEN' }, { status: 403 })

    const { data: execution, error: executionError } = await admin
      .from('lesson_sessions')
      .select('id, learner_id, lesson_id, instructional_teacher, started_at, ended_at, ended_reason')
      .eq('id', executionSessionId)
      .eq('learner_id', learnerId)
      .maybeSingle()
    if (executionError) throw executionError
    if (!execution
      || normalizeLessonKey(execution.lesson_id) !== lessonKey
      || execution.instructional_teacher !== 'slate'
      || execution.ended_reason !== 'completed'
      || !execution.ended_at) {
      return NextResponse.json({ error: 'The completed Slate instructional execution could not be verified', code: 'LIFTOFF_EXECUTION_NOT_VERIFIED' }, { status: 409 })
    }

    const { data: completionEvent, error: eventError } = await admin
      .from('lesson_session_events')
      .select('id, occurred_at, metadata')
      .eq('session_id', executionSessionId)
      .eq('event_type', 'completed')
      .order('occurred_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (eventError) throw eventError
    const metadata = completionEvent?.metadata || {}
    if (!completionEvent
      || String(metadata.syllabus_occurrence_id || '') !== occurrenceId
      || metadata.instructional_teacher !== 'slate'
      || metadata.source !== 'slate-liftoff') {
      return NextResponse.json({ error: 'The Liftoff completion provenance could not be verified', code: 'LIFTOFF_COMPLETION_PROVENANCE_MISMATCH' }, { status: 409 })
    }

    const liftoff = body?.liftoff && typeof body.liftoff === 'object' ? body.liftoff : {}
    const protocolVersion = optionalText(liftoff.protocolVersion, 120)
    if (!protocolVersion) return NextResponse.json({ error: 'A Liftoff protocol version is required', code: 'LIFTOFF_PROTOCOL_REQUIRED' }, { status: 400 })

    const row = {
      facilitator_id: context.user.id,
      learner_id: learnerId,
      lesson_key: lessonKey,
      syllabus_occurrence_id: occurrenceId,
      execution_session_id: executionSessionId,
      lesson_title: optionalText(body?.lessonTitle),
      subject: optionalText(body?.subject, 120),
      protocol_version: protocolVersion,
      started_at: execution.started_at,
      completed_at: completionEvent.occurred_at || execution.ended_at,
      independent_test_percentage: percentage(body?.testPercentage),
      component_state: safeArray(liftoff.components),
      responsibility_trace: safeArray(liftoff.trace),
      integration_confirmed: liftoff.integrationConfirmed === true,
      variation_confirmed: liftoff.variationConfirmed === true,
      procedure_released: liftoff.procedureReleased === true,
      source: 'slate_liftoff_v1',
    }

    const inserted = await admin.from('slate_liftoff_records').insert(row).select('*').single()
    if (!inserted.error) return NextResponse.json({ ok: true, record: inserted.data })
    if (inserted.error.code !== '23505') throw inserted.error

    const existing = await admin.from('slate_liftoff_records')
      .select('*')
      .eq('execution_session_id', executionSessionId)
      .maybeSingle()
    if (existing.error) throw existing.error
    if (!existing.data) throw inserted.error
    return NextResponse.json({ ok: true, record: existing.data, existing: true })
  } catch (error) {
    return NextResponse.json({
      error: error?.message || 'Could not record Liftoff instructional evidence',
      ...(error?.code ? { code: error.code } : {}),
    }, { status: Number.isInteger(error?.status) ? error.status : 500 })
  }
}
