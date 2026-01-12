import { NextResponse } from 'next/server'
import { buildScansBasePath, createServiceClient, getBucketName, getUserFromAuthHeader, safeKind } from '../lib'

export const dynamic = 'force-dynamic'

/**
 * GET /api/portfolio-scans/load?learnerId=...&lessonKey=...&kind=worksheet|test|other
 * Lists uploaded worksheet/test scan files for a specific learner+lesson.
 */
export async function GET(req) {
  try {
    const user = await getUserFromAuthHeader(req)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const learnerId = searchParams.get('learnerId')
    const lessonKey = searchParams.get('lessonKey')
    const kind = safeKind(searchParams.get('kind') || 'other')

    if (!learnerId || !lessonKey) {
      return NextResponse.json({ error: 'Missing learnerId or lessonKey' }, { status: 400 })
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

    const base = buildScansBasePath({ userId: user.id, learnerId, lessonKey })
    if (!base) return NextResponse.json({ error: 'Invalid lessonKey' }, { status: 400 })

    const prefix = `${base}/${kind}`
    const bucket = getBucketName()

    const { data: files, error: listErr } = await svc.storage.from(bucket).list(prefix, {
      limit: 200,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' }
    })

    if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 })

    const out = []
    for (const f of files || []) {
      if (!f?.name) continue
      const path = `${prefix}/${f.name}`
      const { data: signed, error: signErr } = await svc.storage.from(bucket).createSignedUrl(path, 60 * 60)
      if (signErr) continue

      out.push({
        name: f.name,
        path,
        kind,
        size: f.metadata?.size ?? null,
        created_at: f.created_at || null,
        url: signed?.signedUrl || null
      })
    }

    return NextResponse.json({ items: out })
  } catch (err) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  }
}
