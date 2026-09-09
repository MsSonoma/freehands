'use client'

import { getSupabaseClient } from '@/app/lib/supabaseClient'
import { normalizeLessonKey } from '@/app/lib/lessonKeyNormalization'

async function resolveAccessToken(explicitToken) {
  if (String(explicitToken || '').trim()) return String(explicitToken).trim()
  const supabase = getSupabaseClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Sign in required')
  return token
}

export function canRegenerateLesson(lessonKey) {
  const normalized = normalizeLessonKey(lessonKey)
  return Boolean(normalized && normalized.startsWith('generated/'))
}

export async function regenerateLessonWithChanges({
  lessonKey,
  file = '',
  changeRequest,
  accessToken = '',
  fetchImpl = fetch,
} = {}) {
  const normalizedKey = normalizeLessonKey(lessonKey)
  if (!normalizedKey && !String(file || '').trim()) throw new Error('A generated lesson is required')
  const feedback = String(changeRequest || '').trim()
  if (feedback.length < 4) throw new Error('Describe what should be different')
  const token = await resolveAccessToken(accessToken)
  const response = await fetchImpl('/api/facilitator/lessons/request-changes', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(normalizedKey ? { lessonKey: normalizedKey } : { file: String(file).trim() }),
      changeRequest: feedback,
    }),
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(json?.error || 'Could not regenerate the lesson')
    error.code = json?.code || ''
    error.status = response.status
    throw error
  }
  return json
}