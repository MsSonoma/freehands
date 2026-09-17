'use client'

import { getSupabaseClient, hasSupabaseEnv } from './supabaseClient.js'

async function authToken() {
  try {
    if (!hasSupabaseEnv()) return null
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getSession()
    if (error || !data?.session?.access_token) return null
    return data.session.access_token
  } catch {
    return null
  }
}

async function postAttention(action, payload = {}) {
  const token = await authToken()
  if (!token) return { ok: false, skipped: true }
  try {
    const response = await fetch('/api/session/attention', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ action, ...payload }),
    })
    const result = await response.json().catch(() => null)
    return { ok: response.ok && result?.ok === true, status: response.status, ...(result || {}) }
  } catch (error) {
    console.warn('[Sonoma pacing] Attention request failed:', error?.message || error)
    return { ok: false, error }
  }
}

export function recordSonomaPacingEvent(payload = {}) {
  if (!payload?.learnerId || payload.learnerId === 'demo' || !payload?.executionSessionId || !payload?.turnId) {
    return Promise.resolve({ ok: false, skipped: true })
  }
  return postAttention('event', payload)
}

export function createSonomaAttentionNotification(payload = {}) {
  if (!payload?.learnerId || payload.learnerId === 'demo' || !payload?.executionSessionId || !payload?.turnId) {
    return Promise.resolve({ ok: false, skipped: true })
  }
  return postAttention('notify', payload)
}