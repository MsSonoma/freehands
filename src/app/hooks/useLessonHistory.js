import { useEffect, useMemo, useState, useCallback } from 'react'

function createInitialState() {
  return {
    sessions: [],
    lastCompleted: {},
    inProgress: {},
    loading: false,
    error: null,
    events: [],
  }
}

function computeSummary({ sessions, events }) {
  const lastCompleted = {}
  const inProgress = {}

  if (Array.isArray(events)) {
    events.forEach((event) => {
      const lessonId = event?.lesson_id
      if (!lessonId || !event?.event_type) return
      if (event.event_type === 'completed') {
        const existing = lastCompleted[lessonId]
        if (!existing || new Date(event.occurred_at) > new Date(existing)) {
          lastCompleted[lessonId] = event.occurred_at
        }
      }
    })
  }

  if (Array.isArray(sessions)) {
    sessions.forEach((session) => {
      if (!session?.lesson_id) return
      if (!session?.ended_at) {
        const existing = inProgress[session.lesson_id]
        if (!existing || new Date(session.started_at) > new Date(existing)) {
          inProgress[session.lesson_id] = session.started_at
        }
      }
    })
  }

  return { lastCompleted, inProgress }
}

export function useLessonHistory(learnerId, options = {}) {
  const { limit = 100, refreshKey } = options
  const [state, setState] = useState(() => createInitialState())
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    if (!learnerId || learnerId === 'none') {
      setState(createInitialState())
      return () => { cancelled = true }
    }

    setState(prev => ({ ...prev, loading: true, error: null }))

    ;(async () => {
      try {
        const params = new URLSearchParams({ learner_id: learnerId })
        if (Number.isFinite(limit)) {
          params.set('limit', String(limit))
        }

        const res = await fetch(`/api/learner/lesson-history?${params.toString()}`, {
          cache: 'no-store'
        })

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({}))
          const message = errorBody?.error || `Failed to load lesson history (${res.status})`
          throw new Error(message)
        }

        if (cancelled) return

        const data = await res.json()
        const sessions = Array.isArray(data?.sessions) ? data.sessions : []
        const events = Array.isArray(data?.events) ? data.events : []
        const summary = computeSummary({ sessions, events })

        setState({
          sessions,
          events,
          lastCompleted: summary.lastCompleted,
          inProgress: summary.inProgress,
          loading: false,
          error: null,
        })
      } catch (error) {
        if (cancelled) return
        setState({
          sessions: [],
          events: [],
          lastCompleted: {},
          inProgress: {},
          loading: false,
          error: error?.message || 'Failed to load lesson history'
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [learnerId, limit, refreshKey, reloadToken])

  const refresh = useCallback(() => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    setReloadToken(prev => prev + 1)
  }, [])

  const value = useMemo(() => ({
    ...state,
    refresh,
  }), [state, refresh])

  return value
}
