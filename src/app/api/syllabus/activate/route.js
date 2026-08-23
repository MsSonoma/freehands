import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { activateSyllabus } from '../../../lib/syllabus/revisions.server.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'

export const dynamic = 'force-dynamic'

export async function POST(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const result = await activateSyllabus({ repository, facilitatorId: context.user.id, learnerId, snapshot: body?.snapshot })
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status })
  }
}
