'use client'

import { useMemo, useCallback, useState } from 'react'

const EVENT_LABELS = {
  started: 'Started',
  restarted: 'Restarted',
  completed: 'Completed',
  exited: 'Exited early',
  incomplete: 'Marked incomplete',
  medal: 'Medal earned',
}

const EVENT_ACCENTS = {
  started: '#2563eb',
  restarted: '#6366f1',
  completed: '#059669',
  exited: '#d97706',
  incomplete: '#dc2626',
  medal: '#f59e0b',
}

const MEDAL_EMOJI = {
  gold: '🥇',
  silver: '🥈',
  bronze: '🥉',
}

function formatDateTime(isoString, withTime = true) {
  if (!isoString) return 'Unknown'
  try {
    const date = new Date(isoString)
    const options = withTime
      ? { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
      : { month: 'short', day: 'numeric', year: 'numeric' }
    return date.toLocaleString(undefined, options)
  } catch {
    return isoString
  }
}

function fallbackTitle(lessonId) {
  if (!lessonId) return 'Unknown Lesson'
  const [subject, ...rest] = String(lessonId).split('/')
  const subjectLabel = subject ? subject.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Lesson'
  const restLabel = rest.join(' ').replace(/[-_]/g, ' ')
  return restLabel ? `${restLabel} (${subjectLabel})` : subjectLabel
}

function describeEventDetails(event) {
  const details = []
  const metadata = event?.metadata || {}

  if (metadata.minutes_active != null) {
    details.push(`Active for ${metadata.minutes_active} min`)
  }

  if (metadata.minutes_since_activity != null) {
    details.push(`${metadata.minutes_since_activity} min since activity`)
  }

  if (metadata.resumed_with_lesson_id) {
    details.push(`Restarted to ${metadata.resumed_with_lesson_id}`)
  }

  if (event.event_type === 'medal') {
    if (metadata.medalTier) {
      const label = metadata.medalTier.charAt(0).toUpperCase() + metadata.medalTier.slice(1)
      details.push(`${label} medal`)
    }
    if (metadata.bestPercent != null) {
      details.push(`${metadata.bestPercent}%`)
    }
  } else if (metadata.reason) {
    details.push(String(metadata.reason).replace(/[_-]/g, ' '))
  }

  return details.join(' • ')
}

function buildLessonEntries({ sessions, events, medals, titleLookup }) {
  const entryMap = new Map()
  const sessionLesson = new Map()

  const getTitle = (lessonId) => {
    if (!lessonId) return fallbackTitle(lessonId)
    if (typeof titleLookup === 'function') {
      const looked = titleLookup(lessonId)
      if (looked) return looked
    }
    return fallbackTitle(lessonId)
  }

  const ensureEntry = (lessonIdRaw) => {
    const lessonId = lessonIdRaw || 'unknown'
    if (!entryMap.has(lessonId)) {
      entryMap.set(lessonId, {
        lessonId,
        title: getTitle(lessonId),
        events: [],
        eventIds: new Set(),
        activeSessions: [],
        medal: null,
      })
    }
    const entry = entryMap.get(lessonId)
    if (!entry.title || entry.title === 'Unknown Lesson') {
      entry.title = getTitle(lessonId)
    }
    return entry
  }

  ;(Array.isArray(sessions) ? sessions : []).forEach((session) => {
    if (!session) return
    const lessonId = session.lesson_id || 'unknown'
    const entry = ensureEntry(lessonId)
    sessionLesson.set(session.id, lessonId)

    if (!session.ended_at) {
      entry.activeSessions.push(session)
    }

    ;(Array.isArray(session.events) ? session.events : []).forEach((event) => {
      if (!event) return
      const eventId = event.id || `${event.session_id || session.id}-${event.event_type}-${event.occurred_at}`
      if (entry.eventIds.has(eventId)) return
      entry.eventIds.add(eventId)
      entry.events.push({ ...event, session_id: event.session_id || session.id })
    })

  })

  ;(Array.isArray(events) ? events : []).forEach((event) => {
    if (!event) return
    const lessonId = event.lesson_id || sessionLesson.get(event.session_id) || 'unknown'
    const entry = ensureEntry(lessonId)
    const eventId = event.id || `${event.session_id || 'orphan'}-${event.event_type}-${event.occurred_at}`
    if (entry.eventIds.has(eventId)) return
    entry.eventIds.add(eventId)
    entry.events.push({ ...event })
  })

  const medalTimeline = []
  if (medals && typeof medals === 'object') {
    Object.entries(medals).forEach(([lessonId, medalRaw]) => {
      if (!lessonId || !medalRaw) return
      const medal = { ...medalRaw }
      const entry = ensureEntry(lessonId)
      entry.medal = medal
      if (medal.earnedAt) {
        const eventId = `medal-${lessonId}-${medal.earnedAt}`
        if (!entry.eventIds.has(eventId)) {
          entry.eventIds.add(eventId)
          entry.events.push({
            id: eventId,
            session_id: null,
            lesson_id: lessonId,
            event_type: 'medal',
            occurred_at: medal.earnedAt,
            metadata: {
              medalTier: medal.medalTier,
              bestPercent: medal.bestPercent,
            },
            synthetic: true,
          })
        }
      }
      medalTimeline.push({
        lessonId,
        title: entry.title,
        medalTier: medal.medalTier,
        bestPercent: medal.bestPercent,
        earnedAt: medal.earnedAt || null,
      })
    })
  }

  const lessons = Array.from(entryMap.values()).map((entry) => {
    entry.events = entry.events
      .filter((event) => event?.event_type && event?.occurred_at)
      .sort((a, b) => new Date(b.occurred_at) - new Date(a.occurred_at))

    const latestEvent = entry.events[0] || null

    let latestTimestamp = latestEvent?.occurred_at ? Date.parse(latestEvent.occurred_at) : 0
    if (!Number.isFinite(latestTimestamp)) latestTimestamp = 0

    if (latestTimestamp === 0) {
      entry.events.forEach((event) => {
        const ts = event?.occurred_at ? Date.parse(event.occurred_at) : NaN
        if (Number.isFinite(ts) && ts > latestTimestamp) {
          latestTimestamp = ts
        }
      })
    }

    const activeSinceValue = entry.activeSessions.reduce((earliest, session) => {
      const start = session?.started_at ? Date.parse(session.started_at) : NaN
      if (!Number.isFinite(start)) return earliest
      if (earliest == null || start < earliest) return start
      return earliest
    }, null)
    const activeSinceIso = activeSinceValue != null ? new Date(activeSinceValue).toISOString() : null

    const completedCount = entry.events.filter((event) => event.event_type === 'completed').length
    const restartedCount = entry.events.filter((event) => event.event_type === 'restarted').length
    const incompleteCount = entry.events.filter((event) => event.event_type === 'incomplete').length

    let statusType = latestEvent?.event_type || null
    if (!statusType) {
      statusType = entry.activeSessions.length > 0 ? 'started' : (completedCount > 0 ? 'completed' : 'started')
    }

    const status = {
      type: statusType,
      label: EVENT_LABELS[statusType] || statusType,
      color: EVENT_ACCENTS[statusType] || '#6b7280',
    }

    const timeline = entry.events.slice(0, 15).map((event) => ({
      ...event,
      label: EVENT_LABELS[event.event_type] || event.event_type,
      accent: EVENT_ACCENTS[event.event_type] || '#9ca3af',
    }))

    const latestIso = Number.isFinite(latestTimestamp) && latestTimestamp > 0 ? new Date(latestTimestamp).toISOString() : null

    return {
      lessonId: entry.lessonId,
      title: entry.title,
      status,
      timeline,
      completedCount,
      restartedCount,
      incompleteCount,
      activeSessions: entry.activeSessions.length,
      activeSince: activeSinceIso,
      latestTimestamp,
      latestIso,
      medal: entry.medal,
    }
  }).sort((a, b) => (b.latestTimestamp || 0) - (a.latestTimestamp || 0))

  medalTimeline.sort((a, b) => {
    const aTs = a.earnedAt ? Date.parse(a.earnedAt) : 0
    const bTs = b.earnedAt ? Date.parse(b.earnedAt) : 0
    return bTs - aTs
  })

  return { lessons, medalTimeline }
}

function buildPlainTextReport({ lessons, medalTimeline }) {
  const lines = []
  const nowIso = new Date().toISOString()
  lines.push('Lesson History Timeline')
  lines.push(`Generated: ${formatDateTime(nowIso)}`)
  lines.push('')

  if (Array.isArray(medalTimeline) && medalTimeline.length > 0) {
    lines.push('Medals earned (newest first):')
    medalTimeline.forEach((item, index) => {
      const title = item?.title || item?.lessonId || `Medal ${index + 1}`
      const tierLabel = item?.medalTier ? `${item.medalTier.charAt(0).toUpperCase()}${item.medalTier.slice(1)} medal` : 'Medal earned'
      const percentLabel = item?.bestPercent != null ? ` • ${item.bestPercent}%` : ''
      const when = item?.earnedAt ? formatDateTime(item.earnedAt) : 'Date unknown'
      lines.push(`- ${title}: ${tierLabel}${percentLabel} (${when})`)
    })
    lines.push('')
  }

  if (!Array.isArray(lessons) || lessons.length === 0) {
    lines.push('No lesson activity recorded.')
    return lines.join('\n')
  }

  lessons.forEach((lesson, idx) => {
    const countLabel = `${idx + 1}. ${lesson.title || lesson.lessonId || 'Lesson'}`
    lines.push(countLabel)
    lines.push(`  Lesson key: ${lesson.lessonId || 'Unknown'}`)

    if (lesson.status?.label) {
      lines.push(`  Status: ${lesson.status.label}`)
    }

    if (lesson.latestIso) {
      lines.push(`  Last activity: ${formatDateTime(lesson.latestIso)}`)
    }

    if (lesson.activeSince) {
      lines.push(`  Active since: ${formatDateTime(lesson.activeSince)}`)
    }

    const summaryParts = []
    if (lesson.completedCount > 0) summaryParts.push(`Completed ${lesson.completedCount}`)
    if (lesson.restartedCount > 0) summaryParts.push(`Restarted ${lesson.restartedCount}`)
    if (lesson.incompleteCount > 0) summaryParts.push(`Marked incomplete ${lesson.incompleteCount}`)
    if (summaryParts.length > 0) {
      lines.push(`  Summary: ${summaryParts.join(' • ')}`)
    }

    if (lesson.medal) {
      const tierLabel = lesson.medal.medalTier
        ? `${lesson.medal.medalTier.charAt(0).toUpperCase()}${lesson.medal.medalTier.slice(1)} medal`
        : 'Medal earned'
      const percentLabel = lesson.medal.bestPercent != null ? ` • ${lesson.medal.bestPercent}%` : ''
      const when = lesson.medal.earnedAt ? formatDateTime(lesson.medal.earnedAt) : 'Date unknown'
      lines.push(`  Medal: ${tierLabel}${percentLabel} (${when})`)
    }

    if (Array.isArray(lesson.timeline) && lesson.timeline.length > 0) {
      lines.push('  Events:')
      lesson.timeline.forEach((event) => {
        const when = formatDateTime(event.occurred_at)
        const details = describeEventDetails(event)
        const detailSuffix = details ? ` — ${details}` : ''
        lines.push(`    - ${when}: ${event.label}${detailSuffix}`)
      })
    }

    lines.push('')
  })

  return lines.join('\n')
}

async function shareOrPreviewPlainText(text, fileName) {
  const blob = new Blob([text], { type: 'text/plain' })

  try {
    const fileSupport = typeof File !== 'undefined'
    const nav = typeof navigator !== 'undefined' ? navigator : null
    if (fileSupport && nav?.canShare) {
      const file = new File([blob], fileName, { type: 'text/plain' })
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: fileName })
        return
      }
    }
  } catch {
    // fall through to preview/download
  }

  try {
    const url = URL.createObjectURL(blob)
    const win = typeof window !== 'undefined' ? window.open(url, '_blank', 'noopener') : null
    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('beforeunload', () => {
        try { URL.revokeObjectURL(url) } catch {}
      })
    } else if (typeof window !== 'undefined') {
      window.location.href = url
      setTimeout(() => { try { URL.revokeObjectURL(url) } catch {} }, 10000)
    }
    return
  } catch {
    // fall through to forced download
  }

  try {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    setTimeout(() => {
      try { URL.revokeObjectURL(url) } catch {}
      document.body.removeChild(link)
    }, 10000)
  } catch {
    // noop
  }
}

export default function LessonHistoryModal({
  open,
  onClose,
  sessions = [],
  events = [],
  medals = {},
  loading = false,
  error = null,
  titleLookup,
  onRefresh,
}) {
  const { lessons, medalTimeline } = useMemo(() => buildLessonEntries({ sessions, events, medals, titleLookup }), [sessions, events, medals, titleLookup])
  const [exporting, setExporting] = useState(false)

  const handleExportPlainText = useCallback(async () => {
    if (exporting) return
    try {
      setExporting(true)
      const text = buildPlainTextReport({ lessons, medalTimeline })
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const fileName = `lesson-history-${timestamp}.txt`
      await shareOrPreviewPlainText(text, fileName)
    } finally {
      setExporting(false)
    }
  }, [exporting, lessons, medalTimeline])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(17, 24, 39, 0.55)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          width: '100%',
          maxWidth: 560,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.25)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Lesson Timeline</h2>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>
              Track completions, restarts, and medals at a glance.
            </div>
          </div>
          <button
            onClick={handleExportPlainText}
            disabled={exporting}
            style={{
              marginRight: 12,
              padding: '6px 12px',
              borderRadius: 6,
              border: '1px solid #d1d5db',
              background: exporting ? '#f3f4f6' : '#fff',
              cursor: exporting ? 'wait' : 'pointer',
              fontSize: 13,
            }}
            title="Print or download plain-text history"
          >
            Print/Download
          </button>
          {typeof onRefresh === 'function' && (
            <button
              onClick={onRefresh}
              disabled={loading}
              style={{
                marginRight: 12,
                padding: '6px 12px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#fff',
                cursor: loading ? 'wait' : 'pointer',
                fontSize: 13,
              }}
              title="Refresh history"
            >
              ↻ Refresh
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
              color: '#4b5563'
            }}
            aria-label="Close lesson history"
          >
            ×
          </button>
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid #e5e7eb', fontSize: 13, color: '#6b7280' }}>
          {loading ? 'Loading history…' : `${lessons.length} lesson${lessons.length === 1 ? '' : 's'} tracked`}
        </div>

        {error && (
          <div style={{ padding: '12px 20px', background: '#fef2f2', color: '#b91c1c', fontSize: 13 }}>
            {error}
          </div>
        )}

        <div style={{ overflowY: 'auto', padding: '12px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {medalTimeline.length > 0 && (
            <div style={{ border: '1px solid #fcd34d', background: '#fffbeb', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontWeight: 600, color: '#92400e', marginBottom: 6 }}>Medals earned</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {medalTimeline.map((item) => {
                  const emoji = MEDAL_EMOJI[item.medalTier] || '🏅'
                  return (
                    <div key={`${item.lessonId}-${item.earnedAt || 'medal'}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#78350f' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <span>{emoji}</span>
                        <span>{item.title}</span>
                      </div>
                      <div>
                        {item.earnedAt ? formatDateTime(item.earnedAt) : 'Date unknown'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {loading && lessons.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: '32px 12px', fontSize: 14 }}>
              Loading lesson history…
            </div>
          ) : lessons.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6b7280', padding: '32px 12px', fontSize: 14 }}>
              No lesson activity to show yet.
            </div>
          ) : (
            lessons.map((lesson) => {
              const summaryParts = []
              if (lesson.completedCount > 0) {
                summaryParts.push(`Completed ${lesson.completedCount} time${lesson.completedCount === 1 ? '' : 's'}`)
              }
              if (lesson.restartedCount > 0) {
                summaryParts.push(`Restarted ${lesson.restartedCount}`)
              }
              if (lesson.incompleteCount > 0) {
                summaryParts.push(`Marked incomplete ${lesson.incompleteCount}`)
              }

              return (
                <div
                  key={lesson.lessonId}
                  style={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 10,
                    padding: '12px 14px',
                    background: '#f9fafb',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontWeight: 600, color: '#1f2937', flex: 1 }}>{lesson.title}</div>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: lesson.status.color,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <span style={{ display: 'inline-flex', width: 8, height: 8, borderRadius: '50%', background: lesson.status.color }} />
                      <span>{lesson.status.label}</span>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: '#4b5563', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                    <div>Lesson key: <span style={{ color: '#111827' }}>{lesson.lessonId}</span></div>
                    {lesson.latestIso && (
                      <div>Last activity: <span style={{ color: '#111827' }}>{formatDateTime(lesson.latestIso)}</span></div>
                    )}
                    {lesson.activeSince && (
                      <div>Active since: <span style={{ color: '#111827' }}>{formatDateTime(lesson.activeSince)}</span></div>
                    )}
                    {lesson.medal && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>{MEDAL_EMOJI[lesson.medal.medalTier] || '🏅'}</span>
                        <span style={{ color: '#111827' }}>
                          {lesson.medal.medalTier ? `${lesson.medal.medalTier.charAt(0).toUpperCase()}${lesson.medal.medalTier.slice(1)} medal` : 'Medal earned'}
                          {lesson.medal.bestPercent != null ? ` • ${lesson.medal.bestPercent}%` : ''}
                        </span>
                      </div>
                    )}
                  </div>

                  {summaryParts.length > 0 && (
                    <div style={{ fontSize: 12, color: '#374151' }}>
                      {summaryParts.join(' • ')}
                    </div>
                  )}

                  {lesson.timeline.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {lesson.timeline.map((event) => {
                        const key = `${lesson.lessonId}-${event.event_type}-${event.occurred_at}-${event.id || 'evt'}`
                        const detail = describeEventDetails(event)
                        return (
                          <div
                            key={key}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: '#fff',
                              border: '1px solid #e0e7ff',
                              borderRadius: 8,
                              padding: '6px 10px'
                            }}
                          >
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: event.accent }}>{event.label}</span>
                              {detail && (
                                <span style={{ fontSize: 11, color: '#6b7280' }}>{detail}</span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: '#374151', textAlign: 'right' }}>
                              {formatDateTime(event.occurred_at)}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
