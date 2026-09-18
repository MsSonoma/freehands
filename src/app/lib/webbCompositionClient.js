'use client'

import { getSupabaseClient, hasSupabaseEnv } from './supabaseClient.js'

async function currentToken() {
  if (!hasSupabaseEnv()) throw new Error('Mrs. Webb composition storage is unavailable.')
  const { data } = await getSupabaseClient().auth.getSession()
  const token = data?.session?.access_token
  if (!token) throw new Error('Sign in is required to save Mrs. Webb writing.')
  return token
}

export async function saveWebbComposition(payload, deps = {}) {
  const token = await (deps.accessToken || currentToken)()
  const fetchImpl = deps.fetch || fetch
  const response = await fetchImpl('/api/webb-compositions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result?.ok === false) {
    const error = new Error(result?.error || `Mrs. Webb composition save failed (${response.status})`)
    error.result = result
    throw error
  }
  return result.composition
}

export async function loadWebbComposition({ learnerId, occurrenceId }, deps = {}) {
  const token = await (deps.accessToken || currentToken)()
  const fetchImpl = deps.fetch || fetch
  const params = new URLSearchParams({ learnerId, occurrenceId })
  const response = await fetchImpl(`/api/webb-compositions?${params}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` },
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result?.ok === false) throw new Error(result?.error || `Mrs. Webb composition load failed (${response.status})`)
  return result.composition || null
}
