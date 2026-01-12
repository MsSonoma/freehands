import { NextResponse } from 'next/server'
import { createServiceClient, getBucketName, getUserFromAuthHeader } from '../lib'

export const dynamic = 'force-dynamic'

/**
 * POST /api/portfolio-scans/delete
 * Body: { learnerId, path }
 */
export async function POST(req) {
  try {
    const user = await getUserFromAuthHeader(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const learnerId = String(body?.learnerId || '').trim()
    const path = String(body?.path || '').trim()

    if (!learnerId || !path) {
      return NextResponse.json({ error: 'Missing learnerId or path' }, { status: 400 })
    }

    const svc = createServiceClient()
    if (!svc) return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })

    // Ownership check (fail closed)
    const { data: learnerRow, error: learnerErr } = await svc
      .from('learners')
      .select('id, facilitator_id, owner_id, user_id')
      .eq('id', learnerId)
      .maybeSingle()

    if (learnerErr) return NextResponse.json({ error: learnerErr.message }, { status: 500 })
    const owner = learnerRow?.facilitator_id || learnerRow?.owner_id || learnerRow?.user_id
    if (!owner || owner !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const bucket = getBucketName()

    const { error: delErr } = await svc.storage.from(bucket).remove([path])
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
