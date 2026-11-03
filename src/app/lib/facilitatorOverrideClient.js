import { getSupabaseClient } from '@/app/lib/supabaseClient';
export async function previewFacilitatorQuestion({ pin, teacher, phase, original, feedback, grade }) {
  const client = getSupabaseClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in as facilitator to regenerate a question.');
  const response = await fetch('/api/facilitator/overrides/preview', {
    method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind:'question', scope:'instance', pin, teacher, phase, original, feedback, grade }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.proposal) throw new Error(json?.error || 'Question preview failed.');
  return json.proposal;
}

export async function createFacilitatorSourceRevision({ pin, lessonKey, field, index, original, proposal, feedback }) {
  const client = getSupabaseClient();
  const { data: { session } } = await client.auth.getSession();
  if (!session?.access_token) throw new Error('Sign in as facilitator to revise lesson material.');
  const response = await fetch('/api/facilitator/overrides/source-revision', {
    method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, lessonKey, field, index, original, proposal, feedback }),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json?.newDraft) throw new Error(json?.error || 'Source revision could not be saved.');
  return json;
}