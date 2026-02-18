import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import {
  cohereGetUserAndClient,
  cohereEnsureThread,
  cohereAppendEvent
} from '@/app/lib/cohereStyleMentor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function clampInt(value, { min, max, fallback }) {
  const n = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}

function validateProposal(proposal) {
  if (!proposal || typeof proposal !== 'object') return 'proposal must be an object'

  const id = typeof proposal.id === 'string' ? proposal.id.trim() : ''
  const title = typeof proposal.title === 'string' ? proposal.title.trim() : ''

  if (!id) return 'proposal.id is required'
  if (!title) return 'proposal.title is required'

  if (proposal.keywords !== undefined) {
    if (!Array.isArray(proposal.keywords)) return 'proposal.keywords must be an array'
    const bad = proposal.keywords.some((k) => typeof k !== 'string' || !k.trim())
    if (bad) return 'proposal.keywords must be an array of non-empty strings'
  }

  if (proposal.report !== undefined) {
    if (!proposal.report || typeof proposal.report !== 'object') return 'proposal.report must be an object'
    if (typeof proposal.report.actionType !== 'string' || !proposal.report.actionType.trim()) {
      return 'proposal.report.actionType is required when report is provided'
    }
    if (proposal.report.requiresLearner !== undefined && typeof proposal.report.requiresLearner !== 'boolean') {
      return 'proposal.report.requiresLearner must be a boolean'
    }
  }

  return null
}

export async function GET(req) {
  try {
    const auth = await cohereGetUserAndClient(req)
    if (auth?.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { supabase } = auth

    const { searchParams } = new URL(req.url)
    const subjectKey = (searchParams.get('subjectKey') || 'facilitator').trim()
    const sector = (searchParams.get('sector') || 'both').trim()
    const limit = clampInt(searchParams.get('limit'), { min: 20, max: 500, fallback: 200 })

    const { tenantId, threadId } = await cohereEnsureThread({ supabase, sector, subjectKey })

    const { data, error } = await supabase
      .from('events')
      .select('id, role, meta, created_at, text')
      .eq('tenant_id', tenantId)
      .eq('thread_id', threadId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const events = Array.isArray(data) ? data : []
    const proposals = events
      .map((e) => {
        const meta = e?.meta && typeof e.meta === 'object' ? e.meta : null
        const proposal = meta?.mentor_feature_proposal && typeof meta.mentor_feature_proposal === 'object'
          ? meta.mentor_feature_proposal
          : null
        if (!proposal) return null

        return {
          id: e.id,
          created_at: e.created_at,
          role: e.role,
          text: e.text,
          proposal
        }
      })
      .filter(Boolean)

    return NextResponse.json({ tenantId, threadId, subjectKey, sector, proposals })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req) {
  try {
    const auth = await cohereGetUserAndClient(req)
    if (auth?.error) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { supabase } = auth

    const body = await req.json().catch(() => null)
    const subjectKey = (body?.subjectKey || 'facilitator').trim()
    const sector = (body?.sector || 'both').trim()
    const proposal = body?.proposal

    const validationError = validateProposal(proposal)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { tenantId, threadId } = await cohereEnsureThread({ supabase, sector, subjectKey })

    const eventText = `Feature registry proposal: ${proposal.title}`
    const meta = {
      mentor_feature_proposal: {
        ...proposal,
        _stored_at: new Date().toISOString()
      },
      source: 'mentor_feature_proposals_api',
      proposal_id: crypto.randomUUID()
    }

    const eventId = await cohereAppendEvent({
      supabase,
      tenantId,
      threadId,
      role: 'assistant',
      text: eventText,
      meta
    })

    return NextResponse.json({ success: true, tenantId, threadId, eventId })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
