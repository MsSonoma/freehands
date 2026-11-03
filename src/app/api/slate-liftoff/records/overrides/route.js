import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '@/app/lib/syllabus/request.server.mjs'
import { verifyFacilitatorPinForUser } from '@/app/lib/facilitatorPin.server.mjs'
import { buildSlateTestReportFromEvents, slateTestResultStatus } from '@/app/lib/slateTestGradeReport.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const VALID = ['correct', 'partial', 'incorrect']
function trimmed(value, max = 1500) {
  return typeof value === 'string' ? value.trim().slice(0, max + 1) : ''
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const recordId = trimmed(body?.recordId, 80)
    const questionIndex = Number(body?.questionIndex)
    const action = trimmed(body?.action, 20)
    const feedback = trimmed(body?.feedback)
    const correctedStatus = trimmed(body?.correctedStatus, 30)
    const originalQuestion = trimmed(body?.originalQuestion, 2000)
    if (!/^[0-9a-f-]{36}$/i.test(recordId) || !Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= 150 ||
        !['grade', 'question'].includes(action) || feedback.length < 8 || feedback.length > 1500 ||
        (action === 'grade' && !VALID.includes(correctedStatus))) {
      return NextResponse.json({ error: 'Invalid completed-test review request' }, { status: 400 })
    }
    const { admin, user } = context
    if (!await (deps.verifyPin || verifyFacilitatorPinForUser)(admin, user.id, String(body?.pin || ''))) {
      return NextResponse.json({ error: 'Invalid facilitator PIN' }, { status: 403 })
    }
    const { data: record, error: recordError } = await admin.from('slate_liftoff_records')
      .select('id,facilitator_id,learner_id,lesson_key,execution_session_id,independent_test_percentage')
      .eq('id', recordId).eq('facilitator_id', user.id).maybeSingle()
    if (recordError) throw recordError
    if (!record) return NextResponse.json({ error: 'Completed test not found' }, { status: 404 })

    const { data: evidence, error: evidenceError } = await admin.from('learning_evidence_events')
      .select('event_type,payload,result,occurred_at,event_sequence')
      .eq('session_id', record.execution_session_id).eq('learner_id', record.learner_id)
      .eq('facilitator_id', user.id).in('event_type', ['item_presented', 'answer_evaluated'])
      .order('occurred_at', { ascending: true }).limit(1000)
    if (evidenceError) throw evidenceError
    const report = buildSlateTestReportFromEvents(evidence || [], record.independent_test_percentage)
    const row = report?.items?.find(item => item.index === questionIndex)
    if (!row || trimmed(row.question, 2000) !== originalQuestion ||
        !VALID.includes(slateTestResultStatus(row))) {
      return NextResponse.json({ error: 'Question no longer matches verified completed evidence' }, { status: 409 })
    }
    const proposal = action === 'question' && body.proposal && typeof body.proposal === 'object' &&
      typeof body.proposal.question === 'string'
      ? body.proposal : null
    if (proposal && JSON.stringify(proposal).length > 12000) {
      return NextResponse.json({ error: 'Proposed replacement exceeds size limit' }, { status: 400 })
    }
    const sourceRevision = trimmed(body?.sourceRevisionLessonKey, 300) || null
    if (sourceRevision) {
      const match = /^generated\/([a-zA-Z0-9._-]+\.json)$/.exec(sourceRevision)
      if (action !== 'question' || !match) return NextResponse.json({ error: 'Invalid lesson revision' }, { status: 400 })
      const { data: saved, error: sourceError } = await admin.storage.from('lessons')
        .download(`facilitator-lessons/${user.id}/${match[1]}`)
      if (sourceError || !saved) return NextResponse.json({ error: 'The revised lesson could not be verified' }, { status: 409 })
      const revision = await saved.text().then(text => JSON.parse(text)).catch(() => null)
      if (revision?.revisionOf !== record.lesson_key || revision?.lessonKey !== sourceRevision) {
        return NextResponse.json({ error: 'The lesson revision does not match the completed assessment source' }, { status: 409 })
      }
    }
    const insert = {
      record_id: record.id,
      facilitator_id: user.id,
      question_index: questionIndex,
      action,
      original_question: row.question,
      original_status: slateTestResultStatus(row),
      corrected_status: action === 'grade' ? correctedStatus : null,
      feedback,
      proposed_question: proposal,
      source_revision_lesson_key: action === 'question' ? sourceRevision : null,
    }
    const { data, error } = await admin.from('slate_test_result_overrides').insert(insert).select('*').single()
    if (error) throw error
    return NextResponse.json({ ok: true, review: data })
  } catch (error) {
    console.warn('[Slate test result override]', error?.message)
    return NextResponse.json({ error: error?.code === '42P01'
      ? 'The result-review database migration must be applied before overrides can be saved.'
      : 'The facilitator review could not be saved. No result was changed.' },
      { status: 500 })
  }
}
