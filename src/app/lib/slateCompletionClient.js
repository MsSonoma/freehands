'use client'

import { getSupabaseClient, hasSupabaseEnv } from './supabaseClient.js'

const COMPLETION_TIMEOUT_MS = 5000

async function accessToken() {
  if (!hasSupabaseEnv()) throw new Error('Mr. Slate completion recording is unavailable.')
  const { data } = await getSupabaseClient().auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Sign in is required to record Mr. Slate completion.')
  return token
}

export async function recordSlateCompletion({ learnerId, lessonKey, occurrenceId, runPurpose = 'practice', startedAt, completedAt, lessonTitle, subject } = {}, deps = {}) {
  if (!learnerId || !lessonKey || !occurrenceId || !completedAt) throw new Error('Mr. Slate completion is missing required session identity.')
  const token = await (deps.accessToken || accessToken)()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), COMPLETION_TIMEOUT_MS)
  try {
    const response = await (deps.fetch || fetch)('/api/slate/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ learnerId, lessonKey, occurrenceId, runPurpose, startedAt: startedAt || completedAt, completedAt, lessonTitle: lessonTitle || null, subject: subject || null }),
      signal: controller.signal,
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result?.ok) throw new Error(result?.error || 'Mr. Slate completion could not be recorded.')
    return result.completion
  } finally {
    clearTimeout(timeout)
  }
}