import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const STALE_MINUTES = 60

function isYyyyMmDd(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function addDays(dateStr, days) {
  if (!isYyyyMmDd(dateStr)) return null
  const [y, m, d] = dateStr.split('-').map(n => Number(n))
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (Number.isNaN(dt.getTime())) return null
  dt.setUTCDate(dt.getUTCDate() + Number(days || 0))
  const yy = dt.getUTCFullYear()
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(dt.getUTCDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

async function fetchAllRows(queryFactory, { pageSize = 1000, maxRows = 5000 } = {}) {
  const rows = []
  for (let offset = 0; offset < maxRows; offset += pageSize) {
    const upper = Math.min(offset + pageSize - 1, maxRows - 1)
    const { data, error } = await queryFactory().range(offset, upper)
    if (error) throw error
    const page = Array.isArray(data) ? data : []
    rows.push(...page)
    if (page.length < pageSize) break
  }
  return rows
}

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

    const from = searchParams.get('from')
    const to = searchParams.get('to')
    const fromDate = isYyyyMmDd(from) ? from : null
    const toDate = isYyyyMmDd(to) ? to : null
    const fromIso = fromDate ? `${fromDate}T00:00:00.000Z` : null
    // Use an exclusive upper bound so callers can pass local YYYY-MM-DD safely.
    const toExclusiveDate = toDate ? addDays(toDate, 1) : null
    const toExclusiveIso = toExclusiveDate ? `${toExclusiveDate}T00:00:00.000Z` : null

    let sessionsQuery = supabase
      .from('lesson_sessions')
      .select('id, learner_id, lesson_id, started_at, ended_at')
      .eq('learner_id', learnerId)

    if (fromIso) {
      sessionsQuery = sessionsQuery.gte('started_at', fromIso)
    }
    if (toExclusiveIso) {
      sessionsQuery = sessionsQuery.lt('started_at', toExclusiveIso)
    }

    const { data: sessionRows, error: sessionError } = await sessionsQuery
      .order('started_at', { ascending: false })
      .limit(limit)

    if (sessionError) {
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
      let eventsQueryBase = () => {
        let q = supabase
          .from('lesson_session_events')
          .select('id, session_id, lesson_id, event_type, occurred_at, metadata')
          .eq('learner_id', learnerId)

        if (fromIso) q = q.gte('occurred_at', fromIso)
        if (toExclusiveIso) q = q.lt('occurred_at', toExclusiveIso)

        return q.order('occurred_at', { ascending: false })
      }

      // Without a window, keep the old behavior (small bounded fetch).
      if (!fromIso && !toExclusiveIso) {
        const { data: eventRows, error: eventsError } = await eventsQueryBase().limit(500)
        if (eventsError) {
          if (eventsError?.code !== '42P01') {
            // Silent warning - table may not exist yet
          }
        } else if (Array.isArray(eventRows)) {
          events = eventRows
        }
      } else {
        const eventRows = await fetchAllRows(eventsQueryBase, { pageSize: 1000, maxRows: 5000 })
        events = eventRows
      }
    } catch (eventsFetchError) {
      // Silent warning - events fetch failed
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
            // Silent warning - insert failed
          } else if (insertedEvent) {
            events.push(insertedEvent)
            sessionEvents.push(insertedEvent)
            eventsBySession.set(session.id, sessionEvents)
          }
        } catch (insertException) {
          // Silent warning - insert exception
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
            // Silent warning - update failed
          }
        } catch (updateException) {
          // Silent warning - update exception
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
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 })
  }
}
