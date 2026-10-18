import { normalizeLessonKey } from '../lessonKeyNormalization.js'

const TRANSCRIPT_BUCKET = 'transcripts'
const ARTIFACT_FILES = ['ledger.json', 'transcript.txt', 'transcript.pdf', 'transcript.rtf']
const clean = (value) => String(value || '').trim()

function teacherFor(session) {
  const value = clean(session?.instructional_teacher).toLowerCase()
  return ['webb', 'slate'].includes(value) ? value : 'sonoma'
}

function lessonBase({ facilitatorId, learnerId, lessonKey, teacher }) {
  const segment = clean(lessonKey).split('/').at(-1)?.replace(/\.json$/i, '')
  if (!segment || /[\\/\u0000-\u001f]/.test(segment) || segment === '.' || segment === '..') {
    throw new Error('Transcript path could not be verified')
  }
  const prefix = `v1/${facilitatorId}/${learnerId}`
  return teacher === 'sonoma' ? `${prefix}/${segment}` : `${prefix}/${teacher}/${segment}`
}

function timestamp(value) {
  const time = Date.parse(value || '')
  return Number.isFinite(time) ? time : null
}

function closeInTime(left, right) {
  const a = timestamp(left)
  const b = timestamp(right)
  return a !== null && b !== null && Math.abs(a - b) < 5 * 60 * 1000
}

async function loadLedger(store, path) {
  const { data, error } = await store.download(path)
  if (error) {
    if (error.statusCode === 404 || error.statusCode === '404' || error.status === 404
      || /not found/i.test(String(error.message || ''))) return null
    throw error
  }
  try {
    const ledger = JSON.parse(await data.text())
    if (!Array.isArray(ledger)) throw new Error('Transcript ledger is not an array')
    return ledger
  } catch {
    throw new Error('Transcript ledger could not be read safely')
  }
}

function matchesSelectedSegment({ segment, selection, knownSessions }) {
  const candidates = knownSessions.filter((session) => (
    normalizeLessonKey(session?.lesson_id) === normalizeLessonKey(selection?.lesson_id)
    && teacherFor(session) === teacherFor(selection)
    && closeInTime(segment?.startedAt, session?.started_at)
  ))
  // Never infer ownership from a date when it might belong to a sibling attempt.
  return candidates.length === 1 && clean(candidates[0].id) === clean(selection.id)
}

export async function removeLessonTranscriptEvidence({
  admin, facilitatorId, learnerId, lessonKey, lessonTitle, learnerName,
  selectedSessions = [], allSessions = [], writeArtifacts = null,
} = {}) {
  if (!selectedSessions.length) return { status: 'complete', selectedSessions: 0 }
  if (!admin?.storage?.from) return { status: 'incomplete', selectedSessions: selectedSessions.length }
  const store = admin.storage.from(TRANSCRIPT_BUCKET)
  const groups = new Map()
  for (const session of selectedSessions) {
    const base = lessonBase({ facilitatorId, learnerId, lessonKey, teacher: teacherFor(session) })
    if (!groups.has(base)) groups.set(base, [])
    groups.get(base).push(session)
  }

  let cleaned = 0
  let unresolved = 0
  for (const [base, sessions] of groups) {
    try {
      const consolidated = await loadLedger(store, `${base}/ledger.json`)
      const selectedIndexes = new Set()
      const sessionPaths = []
      for (const session of sessions) {
        const browserId = clean(session.session_id)
        if (browserId && !/^[a-zA-Z0-9-]+$/.test(browserId)) throw new Error('Unsafe session transcript identifier')
        const sessionBase = browserId ? `${base}/sessions/${browserId}` : null
        const perSession = sessionBase ? await loadLedger(store, `${sessionBase}/ledger.json`) : null
        if (sessionBase) sessionPaths.push(...ARTIFACT_FILES.map((file) => `${sessionBase}/${file}`))
        if (!consolidated) continue

        const starts = (perSession || []).map((row) => clean(row?.startedAt)).filter(Boolean)
        const matched = starts.length
          ? consolidated.map((row, index) => ({ row, index })).filter(({ row }) => starts.includes(clean(row?.startedAt)))
          : consolidated.map((row, index) => ({ row, index }))
            .filter(({ row }) => matchesSelectedSegment({ segment: row, selection: session, knownSessions: allSessions }))
        if (!matched.length && !perSession?.length
          && consolidated.some((row) => closeInTime(row?.startedAt, session?.started_at))) {
          // If a segment exists around this attempt, but attribution is
          // ambiguous, preserve sibling history rather than guessing.
          throw new Error('Cannot attribute consolidated transcript to one session')
        }
        for (const { row, index } of matched) {
          if (starts.length && consolidated.filter((segment) => clean(segment?.startedAt) === clean(row?.startedAt)).length !== 1) {
            throw new Error('Ambiguous transcript segment; preserving shared transcript')
          }
          selectedIndexes.add(index)
        }
      }

      if (consolidated && selectedIndexes.size) {
        const remaining = consolidated.filter((_, index) => !selectedIndexes.has(index))
        const saveArtifacts = writeArtifacts || (await import('../transcriptsClient.js')).writeLedgerAndArtifacts
        const teacher = teacherFor(sessions[0])
        await saveArtifacts(store, {
          basePath: base, lessonTitle: lessonTitle || 'Lesson', learnerName: learnerName || 'Learner',
          learnerId, lessonId: lessonKey, ledger: remaining,
          teacherDisplayName: teacher === 'webb' ? 'Mrs. Webb' : teacher === 'slate' ? 'Mr. Slate' : 'Ms. Sonoma',
        })
      }

      if (sessionPaths.length) {
        const { error } = await store.remove([...new Set(sessionPaths)])
        if (error) throw error
      }
      cleaned += sessions.length
    } catch {
      unresolved += sessions.length
    }
  }
  return {
    status: unresolved ? 'incomplete' : 'complete',
    selectedSessions: selectedSessions.length,
    cleanedSessions: cleaned,
    unresolvedSessions: unresolved,
  }
}
