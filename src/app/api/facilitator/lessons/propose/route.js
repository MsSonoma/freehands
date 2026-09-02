import { NextResponse } from 'next/server.js'
import { createClient } from '@supabase/supabase-js'
import { buildLessonProposal, validateLessonIntent } from '../../../../lib/facilitatorPreparation.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getEnv() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  }
}

async function getUserAndAdmin(request, { createClientImpl = createClient } = {}) {
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!token) return { user: null, admin: null }

  const { url, anon, service } = getEnv()
  if (!url || !anon || !service) return { user: null, admin: null, error: 'Server not configured' }

  const authClient = createClientImpl(url, anon, { auth: { persistSession: false } })
  const { data: { user }, error } = await authClient.auth.getUser(token)
  if (error || !user) return { user: null, admin: null }

  const admin = createClientImpl(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
  return { user, admin }
}

export async function POST(request, deps = {}) {
  try {
    const { user, admin, error } = await getUserAndAdmin(request, deps)
    if (error) return NextResponse.json({ error }, { status: 500 })
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!admin) return NextResponse.json({ error: 'Server not configured' }, { status: 500 })

    const body = await request.json().catch(() => null)
    const validation = validateLessonIntent(body?.intent || body)
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 400 })

    const { data: learner, error: learnerError } = await admin
      .from('learners')
      .select('id, name, grade')
      .eq('id', validation.intent.learnerId)
      .or(`facilitator_id.eq.${user.id},owner_id.eq.${user.id},user_id.eq.${user.id}`)
      .maybeSingle()

    if (learnerError || !learner) {
      return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    }

    const result = buildLessonProposal({ intent: validation.intent, learner })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({ ok: true, proposal: result.proposal })
  } catch (error) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}