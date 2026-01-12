import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const TRANSCRIPTS_BUCKET = 'transcripts'
const VROOT = 'v1'

export function getBearerToken(req) {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null
  return token || null
}

export async function getUserFromAuthHeader(req) {
  const token = getBearerToken(req)
  if (!token) return null

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) return null

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false }
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null

  return createClient(url, serviceKey, { auth: { persistSession: false } })
}

export async function assertLearnerOwnedByUser(svc, learnerId, userId) {
  const { data: learner, error } = await svc
    .from('learners')
    .select('id, facilitator_id, owner_id, user_id')
    .eq('id', learnerId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!learner) return false

  const owner = learner.facilitator_id || learner.owner_id || learner.user_id
  return owner === userId
}

export function buildScansBasePath({ userId, learnerId, lessonKey }) {
  const raw = String(lessonKey || '').replace(/^\/+/, '')
  if (!raw) return null
  return `${VROOT}/${userId}/${learnerId}/${raw}/portfolio-scans`
}

export function getBucketName() {
  return TRANSCRIPTS_BUCKET
}

export function safeKind(input) {
  const k = String(input || '').toLowerCase().trim()
  if (k === 'worksheet') return 'worksheet'
  if (k === 'test') return 'test'
  return 'other'
}

export function guessContentType(filename, provided) {
  const ct = String(provided || '').trim()
  if (ct) return ct
  const lower = String(filename || '').toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg'
  if (lower.endsWith('.webp')) return 'image/webp'
  if (lower.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}
