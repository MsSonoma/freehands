import { NextResponse } from 'next/server.js'
import { POST as generateFacilitatorLesson } from '../../facilitator/lessons/generate/route.js'
import { loadSyllabusAccess, requireSyllabusFuturePlanning } from '../../../lib/syllabus/entitlements.server.mjs'
import { materializeForecastOccurrence, reconstructForecastCarryForward } from '../../../lib/syllabus/materialization.server.mjs'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function validLineageId(value) {
  const text = String(value || '').trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null
}

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const access = deps.syllabusAccess || await loadSyllabusAccess(context.admin, context.user.id)
    requireSyllabusFuturePlanning(access)
    if (body?.reconstructCarryForward === true) {
      const result = await reconstructForecastCarryForward({
        repository,
        admin: context.admin,
        facilitatorId: context.user.id,
        learnerId,
        sourceProposalRevisionId: body?.sourceProposalRevisionId,
        expectedActiveRevisionId: body?.expectedActiveRevisionId,
        now: deps.now || new Date(),
        fallbackTimeZone: context.user?.user_metadata?.timezone,
      })
      return NextResponse.json({ ok: true, ...result })
    }
    const lineageId = validLineageId(body?.lineageId)
    if (!lineageId) throw new SyllabusError('A valid forecast lineage is required')
    const authorization = request.headers.get('authorization') || ''
    const generateLesson = deps.generateLesson || (async (spec) => {
      const generatorRequest = new Request(new URL('/api/facilitator/lessons/generate', request.url), {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'proposal',
          learnerId,
          proposal: { version: 1, learnerId, generationSpec: spec },
        }),
      })
      const response = await generateFacilitatorLesson(generatorRequest)
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || !payload?.lessonKey) throw new Error(payload?.error || 'Lesson generation failed')
      return payload
    })
    const result = await materializeForecastOccurrence({
      repository,
      admin: context.admin,
      facilitatorId: context.user.id,
      learnerId,
      lineageId,
      expectedActiveRevisionId: body?.expectedActiveRevisionId,
      proposalRevisionId: body?.proposalRevisionId || null,
      generateLesson,
      now: deps.now || new Date(),
      fallbackTimeZone: context.user?.user_metadata?.timezone,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    const recovery = error.code === 'FORECAST_CARRY_FORWARD_FAILED' ? {
      reconstructCarryForward: true,
      sourceProposalRevisionId: error.sourceProposalRevisionId,
      expectedActiveRevisionId: error.expectedActiveRevisionId,
    } : undefined
    return NextResponse.json({ error: error.message || 'Forecast materialization failed', code: error.code, ...(recovery ? { recovery } : {}) }, { status })
  }
}
