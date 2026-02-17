import { createClient } from '@supabase/supabase-js'

export function createRlsSupabaseForToken(token) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) return null

  return createClient(supabaseUrl, anonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

export async function cohereGetUserAndClient(req) {
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Authentication required', status: 401 }
  }

  const token = authHeader.substring(7)
  const supabase = createRlsSupabaseForToken(token)
  if (!supabase) return { error: 'Database not configured', status: 500 }

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: 'Invalid authentication', status: 401 }

  return { token, user, supabase }
}

export function formatPackForSystemMessage(pack) {
  if (!pack || typeof pack !== 'object') return ''

  const goals = pack.user_goals ? JSON.stringify(pack.user_goals) : ''
  const summaryTitle = pack.thread_summary?.title || ''
  const summaryText = pack.thread_summary?.summary || ''

  const recent = Array.isArray(pack.recent_events) ? pack.recent_events : []
  const recall = Array.isArray(pack.recall_snippets) ? pack.recall_snippets : []

  const recentBlock = recent
    .map(e => {
      const role = e.role
      const text = (e.text || '').trim()
      if (!text) return null
      return `${role.toUpperCase()}: ${text}`
    })
    .filter(Boolean)
    .join('\n')

  const recallBlock = recall
    .map(e => {
      const role = e.role
      const text = (e.text || '').trim()
      if (!text) return null
      return `${role.toUpperCase()}: ${text}`
    })
    .filter(Boolean)
    .join('\n')

  const parts = []
  parts.push('=== COHERE-STYLE PACK (DETERMINISTIC) ===')

  if (goals) {
    parts.push('CURRENT GOALS JSON:')
    parts.push(goals)
  }

  if (summaryTitle || summaryText) {
    parts.push('THREAD SUMMARY:')
    if (summaryTitle) parts.push(`Title: ${summaryTitle}`)
    if (summaryText) parts.push(summaryText)
  }

  if (recentBlock) {
    parts.push('RECENT EVENTS (VERBATIM):')
    parts.push(recentBlock)
  }

  if (recallBlock) {
    parts.push('RECALL SNIPPETS (OLDER HITS):')
    parts.push(recallBlock)
  }

  parts.push('=== END PACK ===')

  return parts.join('\n')
}

export async function cohereEnsureThread({ supabase, sector = 'both', subjectKey }) {
  const { data: tenantId, error: tenantErr } = await supabase.rpc('rpc_get_or_create_my_tenant')
  if (tenantErr) throw tenantErr

  const { data: threadId, error: threadErr } = await supabase.rpc('rpc_get_or_create_thread', {
    p_tenant_id: tenantId,
    p_sector: sector,
    p_subject_key: subjectKey
  })
  if (threadErr) throw threadErr

  return { tenantId, threadId }
}

export async function cohereAppendEvent({ supabase, tenantId, threadId, role, text, meta }) {
  const { data: eventId, error } = await supabase.rpc('rpc_append_event', {
    p_tenant_id: tenantId,
    p_thread_id: threadId,
    p_role: role,
    p_text: text,
    p_meta: meta || {}
  })
  if (error) throw error
  return eventId
}

export async function thoughtHubUpsertEventsDeduped({ supabase, events }) {
  if (!Array.isArray(events) || events.length === 0) return 0

  const rows = events
    .map((e) => {
      if (!e) return null
      const tenant_id = e.tenant_id
      const thread_id = e.thread_id
      const role = e.role
      const text = typeof e.text === 'string' ? e.text : ''
      const dedupe_key = typeof e.dedupe_key === 'string' ? e.dedupe_key : null
      const meta = e.meta && typeof e.meta === 'object' ? e.meta : {}
      if (!tenant_id || !thread_id) return null
      if (role !== 'user' && role !== 'assistant' && role !== 'system') return null
      if (!text.trim()) return null
      if (!dedupe_key) return null
      return { tenant_id, thread_id, role, text, dedupe_key, meta }
    })
    .filter(Boolean)

  if (rows.length === 0) return 0

  const { error, count } = await supabase
    .from('events')
    .upsert(rows, { onConflict: 'tenant_id,thread_id,dedupe_key', ignoreDuplicates: true, count: 'exact' })

  if (error) throw error
  return count ?? rows.length
}

export async function cohereGateSuggest({ supabase, tenantId, sector = 'both', question, topK = 5 }) {
  const { data, error } = await supabase.rpc('rpc_gate_suggest', {
    p_tenant_id: tenantId,
    p_sector: sector,
    p_question: question,
    p_top_k: topK
  })
  if (error) throw error
  return data
}

export async function cohereBuildPack({ supabase, tenantId, threadId, sector = 'both', question, mode = 'standard' }) {
  const { data, error } = await supabase.rpc('rpc_pack', {
    p_tenant_id: tenantId,
    p_thread_id: threadId,
    p_sector: sector,
    p_question: question,
    p_mode: mode
  })
  if (error) throw error
  return data
}
