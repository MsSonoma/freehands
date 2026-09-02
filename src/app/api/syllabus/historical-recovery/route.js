import { NextResponse } from 'next/server.js'

import { recoverVerifiedLegacyEvidence } from '../../../lib/syllabus/legacyEvidenceRecovery.server.mjs'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function publicRecord(record) {
  return {
    id: record?.id,
    lesson_key: record?.lesson_key,
    syllabus_occurrence_id: record?.syllabus_occurrence_id,
    activity_type: record?.activity_type,
    instructional_teacher: record?.instructional_teacher,
    occurred_at: record?.occurred_at,
    provenance: record?.provenance,
  }
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const record = await (deps.recoverVerifiedLegacyEvidence || recoverVerifiedLegacyEvidence)({
      admin: context.admin,
      repository,
      facilitatorId: context.user.id,
      learnerId,
      lessonKey: body?.lessonKey,
      teacher: body?.teacher,
      ...(deps.loadLedger ? { loadLedger: deps.loadLedger } : {}),
    })
    return NextResponse.json({ ok: true, historical_activity: publicRecord(record) })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : (Number.isInteger(error?.status) ? error.status : 500)
    return NextResponse.json({
      error: error.message || 'Internal server error',
      ...(error?.code ? { code: error.code } : {}),
    }, { status })
  }
}
