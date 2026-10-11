'use client'

import { getSupabaseClient, hasSupabaseEnv } from './supabaseClient.js'

const LIFTOFF_RECORD_TIMEOUT_MS = 6000

async function accessToken() {
  if (!hasSupabaseEnv()) throw new Error('Liftoff evidence recording is unavailable.')
  const { data } = await getSupabaseClient().auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Sign in is required to record Liftoff evidence.')
  return token
}

export async function recordSlateLiftoffEvidence({
  learnerId,
  lessonKey,
  occurrenceId,
  executionSessionId,
  lessonTitle,
  subject,
  testPercentage,
  liftoff,
} = {}, deps = {}) {
  if (!learnerId || !lessonKey || !occurrenceId || !executionSessionId || !liftoff) {
    throw new Error('Liftoff evidence is missing required execution identity.')
  }
  const token = await (deps.accessToken || accessToken)()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), LIFTOFF_RECORD_TIMEOUT_MS)
  try {
    const response = await (deps.fetch || fetch)('/api/slate-liftoff/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({
        learnerId,
        lessonKey,
        occurrenceId,
        executionSessionId,
        lessonTitle: lessonTitle || null,
        subject: subject || null,
        testPercentage,
        liftoff,
      }),
      signal: controller.signal,
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result?.ok) throw new Error(result?.error || 'Liftoff evidence could not be recorded.')
    return result.record
  } finally {
    clearTimeout(timeout)
  }
}
