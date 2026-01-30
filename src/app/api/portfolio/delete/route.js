import { NextResponse } from 'next/server'

import { createServiceClient, getUserFromAuthHeader } from '../../portfolio-scans/lib'
import { PORTFOLIOS_BUCKET } from '../lib'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function errJson(message, status = 400, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

async function removePortfolioFolder(svc, { userId, learnerId, portfolioId }) {
  const prefix = `${userId}/${learnerId}/${portfolioId}`

  // Recursively list and delete (paged) with a hard cap.
  const toDelete = []
  const listErrors = []

  async function listPrefix(pathPrefix) {
    const { data: files, error } = await svc.storage.from(PORTFOLIOS_BUCKET).list(pathPrefix, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' }
    })

    if (error) {
      listErrors.push({ pathPrefix, message: error.message })
      return
    }

    for (const f of files || []) {
      if (!f?.name) continue
      const full = `${pathPrefix}/${f.name}`

      // Supabase list() returns folders as items with no metadata and no id.
      const isFolder = !f.id && !f.updated_at && !f.created_at && f.metadata == null
      if (isFolder) {
        await listPrefix(full)
      } else {
        toDelete.push(full)
      }

      if (toDelete.length > 5000) return
    }
  }

  await listPrefix(prefix)

  if (listErrors.length) {
    throw new Error(`Failed to list portfolio storage folder (${listErrors[0].message})`)
  }

  // Also try to remove the directory markers even if list is incomplete.
  if (toDelete.length === 0) return

  const removeErrors = []

  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100)
    const { error } = await svc.storage.from(PORTFOLIOS_BUCKET).remove(batch)
    if (error) {
      removeErrors.push(error.message)
      break
    }
  }

  if (removeErrors.length) {
    throw new Error(`Failed to delete portfolio files (${removeErrors[0]})`)
  }
}

export async function POST(req) {
  try {
    const user = await getUserFromAuthHeader(req)
    if (!user) return errJson('Unauthorized', 401)

    const body = await req.json().catch(() => null)
    const learnerId = String(body?.learnerId || '').trim()
    const portfolioId = String(body?.portfolioId || '').trim()

    if (!learnerId) return errJson('Missing learnerId', 400)
    if (!portfolioId) return errJson('Missing portfolioId', 400)

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

    // Ensure the row exists and is owned by this facilitator.
    const { data: row, error: rowErr } = await svc
      .from('portfolio_exports')
      .select('id, portfolio_id')
      .eq('facilitator_id', user.id)
      .eq('learner_id', learnerId)
      .eq('portfolio_id', portfolioId)
      .maybeSingle()

    if (rowErr) return errJson(rowErr.message, 500)
    if (!row) return errJson('Not found', 404)

    // Delete stored files first (so link stops working), then delete DB row.
    await removePortfolioFolder(svc, { userId: user.id, learnerId, portfolioId })

    const { error: delErr } = await svc
      .from('portfolio_exports')
      .delete()
      .eq('id', row.id)

    if (delErr) return errJson(delErr.message, 500)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errJson(err?.message || String(err), 500)
  }
}
