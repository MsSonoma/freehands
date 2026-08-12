"use client";

import { getSupabaseClient } from '@/app/lib/supabaseClient';

export function followUpsFeatureEnabled(env = process.env) {
  const value = String(
    env.NEXT_PUBLIC_MASTERY_EVIDENCE_ENABLED
      ?? env.MASTERY_EVIDENCE_ENABLED
      ?? '',
  ).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value);
}

async function accessToken() {
  const supabase = getSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Please log in to use Follow-Ups');
  return session.access_token;
}

async function followUpRequest(url, init = {}) {
  const token = await accessToken();
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.ok === false) {
    throw new Error(json?.error || 'Follow-Up request failed');
  }
  return json;
}

export async function getFollowUps(learnerId) {
  if (!followUpsFeatureEnabled() || !learnerId) return { ok: true, enabled: false, cards: [] };
  return followUpRequest(`/api/learner/follow-ups?learner_id=${encodeURIComponent(learnerId)}`);
}

export async function startFollowUp(learnerId, cardId) {
  return followUpRequest('/api/learner/follow-ups', {
    method: 'POST',
    body: JSON.stringify({ action: 'start', learner_id: learnerId, card_id: cardId }),
  });
}

export async function getFollowUpRun(runId) {
  return followUpRequest(`/api/learner/follow-ups/${encodeURIComponent(runId)}`);
}

export async function actOnFollowUp(runId, payload) {
  return followUpRequest(`/api/learner/follow-ups/${encodeURIComponent(runId)}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateFollowUpSettings(learnerId, patch) {
  return followUpRequest('/api/learner/follow-ups', {
    method: 'PATCH',
    body: JSON.stringify({ learner_id: learnerId, ...patch }),
  });
}
