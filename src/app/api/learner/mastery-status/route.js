import { NextResponse } from 'next/server.js'

import { authenticateFollowUpRequest } from '@/app/lib/masteryEvidence/followUps.server.js'
import { isUuid } from '@/app/lib/masteryEvidence/schema.js'
import { MASTERY_OUTCOMES } from '@/app/lib/masteryEvidence/mastery.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request, context = {}) {
  try {
    const deps = context.deps || {}
    const auth = await authenticateFollowUpRequest(request, deps)
    if (!auth.user) return NextResponse.json({ ok: false, error: auth.error || 'Unauthorized' }, { status: auth.status || 401 })
    const learnerId = new URL(request.url).searchParams.get('learner_id') || ''
    if (!isUuid(learnerId)) return NextResponse.json({ ok: false, error: 'Invalid learner id' }, { status: 400 })
    const { data: learner } = await auth.admin.from('learners').select('id').eq('id', learnerId)
      .or(`facilitator_id.eq.${auth.user.id},owner_id.eq.${auth.user.id},user_id.eq.${auth.user.id}`).maybeSingle()
    if (!learner?.id) return NextResponse.json({ ok: false, error: 'Learner not found or unauthorized' }, { status: 403 })
    const { data: sessions, error: sessionError } = await auth.admin.from('learning_evidence_sessions')
      .select('id,lesson_key,ended_at').eq('learner_id', learnerId).eq('facilitator_id', auth.user.id)
      .eq('evidence_status', 'complete').like('session_id', 'slate:%')
    if (sessionError) throw sessionError
    const ids = (sessions || []).map((row) => row.id)
    if (!ids.length) return NextResponse.json({ ok: true, mastery: {} })
    const { data: events, error: eventError } = await auth.admin.from('learning_evidence_events')
      .select('evidence_session_id,lesson_key,occurred_at,mastery_outcome').in('evidence_session_id', ids)
      .in('mastery_outcome', [MASTERY_OUTCOMES.INDEPENDENT_SUCCESS, MASTERY_OUTCOMES.INDEPENDENT_SUCCESS_AFTER_RECOVERY])
      .order('occurred_at', { ascending: false })
    if (eventError) throw eventError
    const mastery = {}
    for (const event of events || []) {
      if (!event.lesson_key || mastery[event.lesson_key]) continue
      mastery[event.lesson_key] = { mastered: true, masteredAt: event.occurred_at, source: 'canonical_evidence' }
    }
    return NextResponse.json({ ok: true, mastery })
  } catch {
    return NextResponse.json({ ok: false, error: 'Mastery status is temporarily unavailable' }, { status: 500 })
  }
}
