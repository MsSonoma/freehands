import { NextResponse } from 'next/server.js'
import { isMasteryEvidenceEnabled } from '../../../../../../lib/masteryEvidence/constants.js'
import { loadSyllabusOccurrenceHistory } from '../../../../../../lib/syllabus/occurrenceHistory.server.mjs'
import { getSyllabusRequestContext } from '../../../../../../lib/syllabus/request.server.mjs'
import { validateLearnerId } from '../../../../../../lib/syllabus/schema.mjs'
import { createSyllabusRepository } from '../../../../../../lib/syllabus/supabaseRepository.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function validOccurrenceId(value) {
  const text = String(value || '').trim()
  return text && text.length <= 500 && !/[\u0000-\u001f]/.test(text) ? text : null
}

export async function GET(request, context = {}) {
  try {
    const deps = context.deps || context
    const auth = await getSyllabusRequestContext(request, deps)
    if (auth.error) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
    const learnerId = validateLearnerId((await context.params)?.id)
    const occurrenceId = validOccurrenceId((await context.params)?.occurrenceId)
    if (!occurrenceId) return NextResponse.json({ ok: false, error: 'Invalid occurrence id' }, { status: 400 })
    const repository = deps.repository || createSyllabusRepository(auth.admin)
    const result = await loadSyllabusOccurrenceHistory({
      repository,
      admin: auth.admin,
      facilitatorId: auth.user.id,
      learnerId,
      occurrenceId,
      fallbackTimeZone: auth.user?.user_metadata?.timezone,
      evidenceEnabled: typeof deps.evidenceEnabled === 'boolean' ? deps.evidenceEnabled : isMasteryEvidenceEnabled(process.env),
      signTranscript: deps.signTranscript,
      now: deps.now || new Date(),
    })
    if (result.kind !== 'ok') return NextResponse.json({ ok: false, error: 'Lesson history not found' }, { status: 404 })
    return NextResponse.json({ ok: true, ...result.detail })
  } catch (error) {
    if (error?.name === 'SyllabusError' && error.status === 400) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    }
    return NextResponse.json({ ok: false, error: 'Lesson history is temporarily unavailable' }, { status: 500 })
  }
}
