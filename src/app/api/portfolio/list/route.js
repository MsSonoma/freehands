import { NextResponse } from 'next/server'

import { createServiceClient, getUserFromAuthHeader } from '../../portfolio-scans/lib'
import { PORTFOLIOS_BUCKET, publicObjectUrl } from '../lib'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function errJson(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

export async function GET(req) {
  try {
    const user = await getUserFromAuthHeader(req)
    if (!user) return errJson('Unauthorized', 401)

    const { searchParams } = new URL(req.url)
    const learnerId = String(searchParams.get('learnerId') || '').trim()
    if (!learnerId) return errJson('Missing learnerId', 400)

    const svc = createServiceClient()
    if (!svc) return errJson('Server misconfigured', 500)

    const { data: learnerRow, error: learnerErr } = await svc
      .from('learners')
      .select('id, facilitator_id, owner_id, user_id')
      .eq('id', learnerId)
      .maybeSingle()

    if (learnerErr) return errJson(learnerErr.message, 500)

    const owner = learnerRow?.facilitator_id || learnerRow?.owner_id || learnerRow?.user_id
    if (!owner || owner !== user.id) return errJson('Forbidden', 403)

    const { data: rows, error } = await svc
      .from('portfolio_exports')
      .select('id, portfolio_id, start_date, end_date, include_visual_aids, include_notes, include_images, index_path, manifest_path, created_at')
      .eq('facilitator_id', user.id)
      .eq('learner_id', learnerId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return errJson(error.message, 500)

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (!supabaseUrl) return errJson('Server misconfigured', 500)

    const items = (rows || []).map((r) => ({
      id: r.id,
      portfolioId: r.portfolio_id,
      createdAt: r.created_at,
      startDate: r.start_date,
      endDate: r.end_date,
      include: {
        visualAids: Boolean(r.include_visual_aids),
        notes: Boolean(r.include_notes),
        images: Boolean(r.include_images)
      },
      indexUrl: publicObjectUrl({ supabaseUrl, bucket: PORTFOLIOS_BUCKET, path: r.index_path }),
      manifestUrl: publicObjectUrl({ supabaseUrl, bucket: PORTFOLIOS_BUCKET, path: r.manifest_path })
    }))

    return NextResponse.json({ items })
  } catch (err) {
    return errJson(err?.message || String(err), 500)
  }
}
