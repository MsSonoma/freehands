import { NextResponse } from 'next/server.js'
import { buildLegacySeed } from '../../../lib/syllabus/legacySeed.server.mjs'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { SyllabusError, validateLearnerId } from '../../../lib/syllabus/schema.mjs'

export const dynamic = 'force-dynamic'

export async function GET(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })
    const learnerId = validateLearnerId(new URL(request.url).searchParams.get('learnerId'))
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const seed = await buildLegacySeed({ repository, facilitatorId: context.user.id, learnerId })
    if (!seed) return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    return NextResponse.json({ seed })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status })
  }
}
