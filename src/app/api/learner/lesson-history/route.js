import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STALE_MINUTES = 60

function parseLimit(value) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, 200)
  }
  return 100
}

async function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}

function buildSummary(sessions = [], events = []) {
  const lastCompleted = {}
  const inProgress = {}

  if (Array.isArray(events)) {
    for (const event of events) {
      const lessonId = event?.lesson_id
      if (!lessonId || event?.event_type !== 'completed') continue
      const occurredAt = event?.occurred_at
      if (!occurredAt) continue
      const existing = lastCompleted[lessonId]
      if (!existing || new Date(occurredAt) > new Date(existing)) {
        lastCompleted[lessonId] = occurredAt
      }
    }
  }

  if (Array.isArray(sessions)) {
    for (const session of sessions) {
      const lessonId = session?.lesson_id
      if (!lessonId) continue
      if (!session?.ended_at && session?.started_at) {
        const existing = inProgress[lessonId]
        if (!existing || new Date(session.started_at) > new Date(existing)) {
          inProgress[lessonId] = session.started_at
        }
      }
    }
  }

  return { lastCompleted, inProgress }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const learnerId = searchParams.get('learner_id')
    if (!learnerId) {
      return NextResponse.json({ error: 'learner_id required' }, { status: 400 })
    }

    const supabase = await getSupabaseAdmin()
    if (!supabase) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 500 })
    }

    const limit = parseLimit(searchParams.get('limit'))

    const { data: sessionRows, error: sessionError } = await supabase
      .from('lesson_sessions')
      .select('id, learner_id, lesson_id, started_at, ended_at')
      .eq('learner_id', learnerId)
      .order('started_at', { ascending: false })
      .limit(limit)

    if (sessionError) {
      console.error('[Lesson History API] Failed to load sessions:', sessionError)
      return NextResponse.json({ error: 'Failed to load lesson sessions' }, { status: 500 })
    }

    const sessions = Array.isArray(sessionRows)
      ? sessionRows.map((row) => {
          const startedAt = row?.started_at || null
          const endedAt = row?.ended_at || null
          let durationSeconds = null
          if (startedAt && endedAt) {
            const start = new Date(startedAt)
            const end = new Date(endedAt)
            const diff = Math.max(0, end.getTime() - start.getTime())
            durationSeconds = Math.round(diff / 1000)
          }
          return {
            id: row?.id || null,
            learner_id: row?.learner_id || null,
            lesson_id: row?.lesson_id || null,
            started_at: startedAt,
            ended_at: endedAt,
            status: endedAt ? 'completed' : 'in-progress',
            duration_seconds: durationSeconds
          }
        })
      : []

    let events = []
    try {
      const { data: eventRows, error: eventsError } = await supabase
        .from('lesson_session_events')
        .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
        .eq('learner_id', learnerId)
        .order('occurred_at', { ascending: false })
        .limit(500)

      if (eventsError) {
        if (eventsError?.code !== '42P01') {
          console.warn('[Lesson History API] Failed to load session events:', eventsError)
        }
      } else if (Array.isArray(eventRows)) {
        events = eventRows
      }
    } catch (eventsFetchError) {
      console.warn('[Lesson History API] Unexpected error loading session events:', eventsFetchError)
    }

    const eventsBySession = new Map()
    for (const event of events) {
      const sessionId = event?.session_id
      if (!sessionId) continue
      if (!eventsBySession.has(sessionId)) {
        eventsBySession.set(sessionId, [])
      }
      eventsBySession.get(sessionId).push(event)
    }

    const nowMs = Date.now()
    const staleMillis = STALE_MINUTES * 60 * 1000

    for (const session of sessions) {
      if (!session?.id || session?.ended_at) continue

      const sessionEvents = eventsBySession.get(session.id) || []
      const latestEvent = sessionEvents.reduce((latest, current) => {
        if (!current?.occurred_at) return latest
        if (!latest?.occurred_at) return current
        return new Date(current.occurred_at) > new Date(latest.occurred_at) ? current : latest
      }, null)

      const latestActivityIso = latestEvent?.occurred_at || session.started_at
      const latestActivityMs = latestActivityIso ? Date.parse(latestActivityIso) : NaN

      if (!Number.isFinite(latestActivityMs)) {
        continue
      }

      if ((nowMs - latestActivityMs) < staleMillis) {
        continue
      }

      const existingIncomplete = sessionEvents.some((event) => event?.event_type === 'incomplete')
      const incompleteAtMs = latestActivityMs + staleMillis
      const incompleteAtIso = new Date(incompleteAtMs).toISOString()

      if (!existingIncomplete) {
        try {
          const { data: insertedEvent, error: insertError } = await supabase
            .from('lesson_session_events')
            .insert({
              session_id: session.id,
              learner_id: learnerId,
              lesson_id: session.lesson_id,
              event_type: 'incomplete',
              occurred_at: incompleteAtIso,
              metadata: {
                reason: 'auto-marked-stale',
                minutes_since_activity: Math.round((nowMs - latestActivityMs) / 60000),
              },
            })
            .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
            .single()

          if (insertError) {
            console.warn('[Lesson History API] Failed to insert incomplete event:', insertError)
          } else if (insertedEvent) {
            events.push(insertedEvent)
            sessionEvents.push(insertedEvent)
            eventsBySession.set(session.id, sessionEvents)
          }
        } catch (insertException) {
          console.warn('[Lesson History API] Exception inserting incomplete event:', insertException)
        }
      }

      if (!session.ended_at) {
        try {
          const { error: updateError } = await supabase
            .from('lesson_sessions')
            .update({ ended_at: incompleteAtIso })
            .eq('id', session.id)
            .is('ended_at', null)

          if (updateError) {
            console.warn('[Lesson History API] Failed to mark session incomplete:', updateError)
          }
        } catch (updateException) {
          console.warn('[Lesson History API] Exception updating session as incomplete:', updateException)
        }
      }

      session.ended_at = session.ended_at || incompleteAtIso
      session.status = 'incomplete'
      const startMs = session.started_at ? Date.parse(session.started_at) : NaN
      if (Number.isFinite(startMs)) {
        session.duration_seconds = Math.max(0, Math.round((new Date(session.ended_at).getTime() - startMs) / 1000))
      }
    }

    const sessionsWithEvents = sessions.map((session) => ({
      ...session,
      events: eventsBySession.get(session.id) || [],
    }))

    const summary = buildSummary(sessionsWithEvents, events)

    return NextResponse.json({
      learnerId,
      sessions: sessionsWithEvents,
      events,
      summary
    })
  } catch (error) {
    console.error('[Lesson History API] Unexpected error:', error)
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 })
  }
}
