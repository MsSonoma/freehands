import { createClient } from '@supabase/supabase-js'

export async function getSyllabusRequestContext(request, { createClientImpl = createClient, requestContext = null } = {}) {
  if (requestContext) return requestContext
  const header = request.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!token) return { status: 401, error: 'Unauthorized' }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !anon || !service) return { status: 500, error: 'Server not configured' }
  const authClient = createClientImpl(url, anon, { auth: { persistSession: false } })
  const { data: { user }, error } = await authClient.auth.getUser(token)
  if (error || !user) return { status: 401, error: 'Unauthorized' }
  const admin = createClientImpl(url, service, { auth: { persistSession: false, autoRefreshToken: false } })
  return { user, admin }
}
