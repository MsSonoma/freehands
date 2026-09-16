'use client'

import { getSupabaseClient, hasSupabaseEnv } from './supabaseClient.js'

async function currentFacilitator() {
  try {
    if (!hasSupabaseEnv()) return null
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getUser()
    if (error || !data?.user?.id) return null
    return { supabase, facilitatorId: data.user.id }
  } catch (error) {
    console.warn('[Webb pacing] Could not resolve facilitator identity:', error?.message || error)
    return null
  }
}

function duplicate(error) {
  return error?.code === '23505'
}

export async function recordWebbPacingEvent({
  learnerId,
  sessionId,
  lessonKey,
  turnId = null,
  eventType,
  eventKey,
  elapsedSeconds = null,
  reminderStage = null,
  metadata = {},
} = {}) {
  if (!eventType || !eventKey || !learnerId || learnerId === 'demo') return { ok: false, skipped: true }
  const auth = await currentFacilitator()
  if (!auth) return { ok: false, skipped: true }
  const { supabase, facilitatorId } = auth
  try {
    const { error } = await supabase.from('webb_pacing_events').insert({
      facilitator_id: facilitatorId,
      learner_id: learnerId,
      session_id: sessionId || null,
      lesson_key: lessonKey || null,
      turn_id: turnId || null,
      event_type: eventType,
      event_key: eventKey,
      elapsed_seconds: Number.isFinite(Number(elapsedSeconds)) ? Math.max(0, Math.floor(Number(elapsedSeconds))) : null,
      reminder_stage: Number.isFinite(Number(reminderStage)) ? Math.max(0, Math.floor(Number(reminderStage))) : null,
      metadata: metadata && typeof metadata === 'object' ? metadata : {},
    })
    if (!error || duplicate(error)) return { ok: true, duplicate: duplicate(error) }
    console.warn('[Webb pacing] Could not record pacing event:', error.message || error)
    return { ok: false, error }
  } catch (error) {
    console.warn('[Webb pacing] Pacing event request failed:', error?.message || error)
    return { ok: false, error }
  }
}

export async function createWebbAttentionNotification({
  learnerId,
  learnerName,
  sessionId,
  lessonKey,
  lessonTitle,
  turnId,
  stage,
  elapsedSeconds,
} = {}) {
  if (!learnerId || learnerId === 'demo' || !sessionId || !turnId) return { ok: false, skipped: true }
  const auth = await currentFacilitator()
  if (!auth) return { ok: false, skipped: true }
  const { supabase, facilitatorId } = auth
  const dedupeKey = `webb-attention:${sessionId}:${turnId}`
  const learnerLabel = String(learnerName || '').trim() || 'A learner'
  const lessonLabel = String(lessonTitle || '').trim() || String(lessonKey || '').trim() || 'a Mrs. Webb lesson'
  const elapsedMinutes = Math.max(1, Math.round(Number(elapsedSeconds || 0) / 60))
  try {
    const { error } = await supabase.from('facilitator_notifications').insert({
      facilitator_id: facilitatorId,
      category: 'learner-attention',
      type: 'webb_response_unanswered',
      title: 'Mrs. Webb needs facilitator attention',
      body: `${learnerLabel} has not responded in ${lessonLabel} for about ${elapsedMinutes} minute${elapsedMinutes === 1 ? '' : 's'}.`,
      dedupe_key: dedupeKey,
      metadata: {
        source: 'mrs-webb-response-pacing',
        learnerId,
        sessionId,
        lessonKey: lessonKey || null,
        turnId,
        stage: stage || null,
        elapsedSeconds: Math.max(0, Math.floor(Number(elapsedSeconds || 0))),
      },
    })
    if (!error || duplicate(error)) return { ok: true, duplicate: duplicate(error), dedupeKey }
    console.warn('[Webb pacing] Could not create facilitator notification:', error.message || error)
    return { ok: false, error }
  } catch (error) {
    console.warn('[Webb pacing] Facilitator notification request failed:', error?.message || error)
    return { ok: false, error }
  }
}