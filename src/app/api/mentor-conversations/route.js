import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { featuresForTier, resolveEffectiveTier } from '../../lib/entitlements'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function authenticate(request) {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const token = authHeader.substring(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return { error: Response.json({ error: 'Invalid token' }, { status: 401 }) }

  const { data: profile } = await supabase
    .from('profiles')
    .select('subscription_tier, plan_tier')
    .eq('id', user.id)
    .maybeSingle()
  const tier = resolveEffectiveTier(profile?.subscription_tier, profile?.plan_tier)
  const ent = featuresForTier(tier)
  const allowed = ent?.mentorSessions === Infinity || (Number.isFinite(ent?.mentorSessions) && ent.mentorSessions > 0)
  if (!allowed) return { error: Response.json({ error: 'Pro plan required' }, { status: 403 }) }
  return { user }
}

async function ownedLearner(userId, learnerId) {
  const id = String(learnerId || '').trim()
  if (!id) return null
  const { data } = await supabase
    .from('learners')
    .select('id, name')
    .eq('id', id)
    .or(`facilitator_id.eq.${userId},owner_id.eq.${userId},user_id.eq.${userId}`)
    .maybeSingle()
  return data || null
}

function cleanTitle(value) {
  const title = String(value || '').replace(/\s+/g, ' ').trim()
  if (!title) return ''
  return title.slice(0, 120)
}

export async function GET(request) {
  try {
    const auth = await authenticate(request)
    if (auth.error) return auth.error
    const { searchParams } = new URL(request.url)
    const id = String(searchParams.get('id') || '').trim()

    if (id) {
      const { data, error } = await supabase
        .from('mentor_conversations')
        .select('*')
        .eq('id', id)
        .eq('facilitator_id', auth.user.id)
        .maybeSingle()
      if (error) throw error
      if (!data) return Response.json({ error: 'Conversation not found' }, { status: 404 })
      return Response.json({ conversation: data })
    }

    const { data, error } = await supabase
      .from('mentor_conversations')
      .select('id, learner_id, context_key, thread_key, title, last_activity_at, created_at, updated_at')
      .eq('facilitator_id', auth.user.id)
      .order('last_activity_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return Response.json({ conversations: data || [] })
  } catch (error) {
    console.error('[mentor-conversations GET]', error)
    return Response.json({ error: 'Failed to load conversations' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const auth = await authenticate(request)
    if (auth.error) return auth.error
    const body = await request.json().catch(() => ({}))
    const learner = await ownedLearner(auth.user.id, body?.learnerId)
    const id = randomUUID()
    const contextKey = learner ? `learner:${learner.id}` : 'facilitator'
    const title = cleanTitle(body?.title) || 'New conversation'

    const { data, error } = await supabase
      .from('mentor_conversations')
      .insert({
        id,
        facilitator_id: auth.user.id,
        learner_id: learner?.id || null,
        context_key: contextKey,
        thread_key: `conversation:${id}`,
        title
      })
      .select('*')
      .single()
    if (error) throw error
    return Response.json({ conversation: data }, { status: 201 })
  } catch (error) {
    console.error('[mentor-conversations POST]', error)
    return Response.json({ error: 'Failed to create conversation' }, { status: 500 })
  }
}

export async function PATCH(request) {
  try {
    const auth = await authenticate(request)
    if (auth.error) return auth.error
    const body = await request.json().catch(() => ({}))
    const id = String(body?.id || '').trim()
    if (!id) return Response.json({ error: 'Conversation id required' }, { status: 400 })

    const updates = { updated_at: new Date().toISOString() }
    if (body?.title !== undefined) {
      const title = cleanTitle(body.title)
      if (!title) return Response.json({ error: 'Title required' }, { status: 400 })
      updates.title = title
    }
    if (body?.learnerId !== undefined) {
      const learner = await ownedLearner(auth.user.id, body.learnerId)
      updates.learner_id = learner?.id || null
      updates.context_key = learner ? `learner:${learner.id}` : 'facilitator'
    }

    const { data, error } = await supabase
      .from('mentor_conversations')
      .update(updates)
      .eq('id', id)
      .eq('facilitator_id', auth.user.id)
      .select('*')
      .maybeSingle()
    if (error) throw error
    if (!data) return Response.json({ error: 'Conversation not found' }, { status: 404 })
    return Response.json({ conversation: data })
  } catch (error) {
    console.error('[mentor-conversations PATCH]', error)
    return Response.json({ error: 'Failed to update conversation' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const auth = await authenticate(request)
    if (auth.error) return auth.error
    const { searchParams } = new URL(request.url)
    const id = String(searchParams.get('id') || '').trim()
    if (!id) return Response.json({ error: 'Conversation id required' }, { status: 400 })

    const { data: conversation, error: loadError } = await supabase
      .from('mentor_conversations')
      .select('id, thread_key')
      .eq('id', id)
      .eq('facilitator_id', auth.user.id)
      .maybeSingle()
    if (loadError) throw loadError
    if (!conversation) return Response.json({ success: true, deleted: false })

    const { error: deleteError } = await supabase
      .from('mentor_conversations')
      .delete()
      .eq('id', id)
      .eq('facilitator_id', auth.user.id)
    if (deleteError) throw deleteError

    if (conversation.thread_key) {
      await supabase.from('threads').delete().eq('user_id', auth.user.id).eq('subject_key', conversation.thread_key)
      await supabase.from('mentor_conversation_threads').delete().eq('facilitator_id', auth.user.id).eq('subject_key', conversation.thread_key)
    }

    return Response.json({ success: true, deleted: true })
  } catch (error) {
    console.error('[mentor-conversations DELETE]', error)
    return Response.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }
}
