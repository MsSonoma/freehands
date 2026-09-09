'use client'

import { getSupabaseClient, hasSupabaseEnv } from './supabaseClient.js'

async function accessToken() {
  if (!hasSupabaseEnv()) throw new Error('Golden Key service is unavailable.')
  const { data } = await getSupabaseClient().auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Sign in is required to use Golden Keys.')
  return token
}

async function postGoldenKey(body, deps = {}) {
  const token = await (deps.accessToken || accessToken)()
  const fetchImpl = deps.fetch || fetch
  const response = await fetchImpl('/api/learner/golden-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result?.ok === false) {
    const error = new Error(result?.error || `Golden Key operation failed (${response.status})`)
    error.code = result?.state || result?.code || null
    error.result = result
    throw error
  }
  return result
}

export async function applyGoldenKeyToLesson({ learnerId, lessonKey }, deps = {}) {
  if (!learnerId || !lessonKey) throw new Error('Learner and lesson are required to apply a Golden Key.')
  return await postGoldenKey({ action: 'apply', learnerId, lessonKey }, deps)
}

export async function finalizeGoldenKeyForSession({ learnerId, lessonKey, executionSessionId, browserSessionId, awardEarnedKey = false }, deps = {}) {
  if (!learnerId || !lessonKey || !executionSessionId || !browserSessionId) {
    throw new Error('Learner, lesson, execution session, and browser session are required to finalize a Golden Key.')
  }
  return await postGoldenKey({
    action: 'finalize',
    learnerId,
    lessonKey,
    executionSessionId,
    browserSessionId,
    awardEarnedKey: awardEarnedKey === true,
  }, deps)
}