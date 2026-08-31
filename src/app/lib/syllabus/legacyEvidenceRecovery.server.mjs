import { createHash } from 'node:crypto'

import { calendarDateInTimeZone, validTimeZone } from '../calendarDate.mjs'
import { resolveLessonSessionLifecycle } from '../lessonSessionLifecycle.mjs'
import { normalizeLessonKey } from '../lessonKeyNormalization.js'
import { SyllabusError } from './schema.mjs'

export const SERVER_VERIFIED_LEGACY_PROVENANCE = 'server_verified_legacy_transcript_v1'
export const SERVER_VERIFIED_LEGACY_EVIDENCE_VERSION = 'pre_occurrence_transcript_ledger_v1'
export const SERVER_VERIFIED_LEGACY_OCCURRENCE_PREFIX = 'legacy-evidence:'

const TRANSCRIPT_BUCKET = 'transcripts'
const LEGACY_EVIDENCE_CUTOFF = Date.parse('2026-08-29T00:00:00.000Z')
const MAX_LEDGER_BYTES = 2 * 1024 * 1024
const MAX_SEGMENTS = 100
const MAX_LINES_PER_SEGMENT = 5000
const WEBB_COMPLETION_FAREWELL = /fantastic work!.*you(?:'|’|\u2019)ve completed .*your essay is something to be really proud of.*i(?:'|’|\u2019)ll see you next time!/i

function clean(value) {
  return String(value || '').trim()
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function lessonStorageSegment(lessonKey) {
  const segment = clean(lessonKey).split('/').at(-1)?.replace(/\.json$/i, '')
  if (!segment || segment === '.' || segment === '..' || /[\\/\u0000-\u001f]/.test(segment)) {
    throw new SyllabusError('A valid historical lesson key is required', 400, 'INVALID_LESSON_KEY')
  }
  return segment
}

function transcriptEvidenceReference({ facilitatorId, learnerId, teacher, lessonKey }) {
  return `v1/${facilitatorId}/${learnerId}/${teacher}/${lessonStorageSegment(lessonKey)}/ledger.json`
}

function validHistoricalTimestamp(value) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) && timestamp < LEGACY_EVIDENCE_CUTOFF
}

function verifiedSegments(ledger, teacher) {
  if (!Array.isArray(ledger) || ledger.length === 0 || ledger.length > MAX_SEGMENTS) return []
  return ledger.filter((segment) => {
    if (!segment || !validHistoricalTimestamp(segment.startedAt) || !validHistoricalTimestamp(segment.completedAt)) return false
    if (Date.parse(segment.completedAt) < Date.parse(segment.startedAt)) return false
    if (!Array.isArray(segment.lines) || segment.lines.length === 0 || segment.lines.length > MAX_LINES_PER_SEGMENT) return false
    const assistantTexts = segment.lines
      .filter((line) => clean(line?.role).toLowerCase() === 'assistant')
      .map((line) => clean(line?.text))
      .filter(Boolean)
    if (teacher === 'webb') return assistantTexts.some((text) => WEBB_COMPLETION_FAREWELL.test(text))
    return assistantTexts.some((text) => /^Q\d+:/i.test(text))
  })
}

export function verifyLegacyTranscriptLedger({ ledger, teacher, instructionalDateAnchor = null, timeZone = 'UTC' }) {
  if (teacher !== 'webb' && teacher !== 'slate') {
    throw new SyllabusError('Verified recovery supports only Mrs. Webb instruction or Mr. Slate drill history', 400, 'INVALID_LEGACY_EVIDENCE_TEACHER')
  }
  const matches = verifiedSegments(ledger, teacher)
  if (matches.length === 0) {
    throw new SyllabusError('The surviving ledger does not contain the required historical completion signal', 422, 'UNVERIFIED_LEGACY_EVIDENCE')
  }
  if (matches.length === 1) {
    const segment = matches[0]
    return {
      segment,
      occurredAt: new Date(segment.completedAt).toISOString(),
      evidenceDigest: sha256(stableJson(segment)),
    }
  }
  if (teacher === 'slate' && instructionalDateAnchor) {
    const anchored = matches.filter((segment) => (
      calendarDateInTimeZone(new Date(segment.completedAt), timeZone) === instructionalDateAnchor
    ))
    if (anchored.length === 0) {
      throw new SyllabusError('No completed Slate segment matches the verified instructional date', 422, 'LEGACY_EVIDENCE_ANCHOR_MISMATCH')
    }
    if (anchored.length === 1) {
      const segment = anchored[0]
      return {
        segment,
        occurredAt: new Date(segment.completedAt).toISOString(),
        evidenceDigest: sha256(stableJson(segment)),
      }
    }
    throw new SyllabusError('Multiple completed Slate segments match the verified instructional date', 409, 'AMBIGUOUS_LEGACY_EVIDENCE')
  }
  if (matches.length !== 1) {
    throw new SyllabusError('The surviving ledger contains multiple completed occurrences and cannot be recovered unambiguously', 409, 'AMBIGUOUS_LEGACY_EVIDENCE')
  }
}

async function loadTranscriptLedger(admin, evidenceReference) {
  const { data, error } = await admin.storage.from(TRANSCRIPT_BUCKET).download(evidenceReference)
  if (error || !data) {
    throw new SyllabusError('No surviving historical ledger was found for this activity', 404, 'LEGACY_EVIDENCE_NOT_FOUND')
  }
  if (Number(data.size || 0) > MAX_LEDGER_BYTES) {
    throw new SyllabusError('The surviving historical ledger is too large to verify safely', 422, 'INVALID_LEGACY_EVIDENCE')
  }
  try {
    return JSON.parse(await data.text())
  } catch {
    throw new SyllabusError('The surviving historical ledger is not valid JSON', 422, 'INVALID_LEGACY_EVIDENCE')
  }
}

function sessionIds(session) {
  return [session?.id, session?.session_id].map(clean).filter(Boolean)
}

function canonicalCompletionCandidates({ sessions, events, lessonKey, timeZone }) {
  const candidates = []
  for (const session of sessions || []) {
    if (normalizeLessonKey(session?.lesson_id || session?.lesson_key) !== lessonKey) continue
    const ids = new Set(sessionIds(session))
    if (ids.size === 0) continue
    const sessionEvents = (events || []).filter((event) => (
      ids.has(clean(event?.session_id))
        && normalizeLessonKey(event?.lesson_id || event?.lesson_key || session?.lesson_id || session?.lesson_key) === lessonKey
    ))
    const lifecycle = resolveLessonSessionLifecycle(session, sessionEvents)
    if (lifecycle.status !== 'completed' || clean(lifecycle.event?.event_type) !== 'completed') continue
    if (!Number.isFinite(Date.parse(lifecycle.event?.occurred_at))) continue
    candidates.push({
      session,
      date: calendarDateInTimeZone(new Date(lifecycle.event.occurred_at), timeZone),
    })
  }
  return candidates
}

function intersectCanonicalAndSlateDates({ canonicalCandidates, slateLedger, timeZone }) {
  const slateCandidates = verifiedSegments(slateLedger, 'slate').map((segment) => ({
    segment,
    date: calendarDateInTimeZone(new Date(segment.completedAt), timeZone),
  }))
  if (slateCandidates.length < 2) return null

  const canonicalCounts = new Map()
  const slateCounts = new Map()
  for (const candidate of canonicalCandidates) {
    canonicalCounts.set(candidate.date, (canonicalCounts.get(candidate.date) || 0) + 1)
  }
  for (const candidate of slateCandidates) {
    slateCounts.set(candidate.date, (slateCounts.get(candidate.date) || 0) + 1)
  }
  const sharedDates = [...canonicalCounts.keys()].filter((date) => slateCounts.has(date))
  if (
    sharedDates.length !== 1
      || canonicalCounts.get(sharedDates[0]) !== 1
      || slateCounts.get(sharedDates[0]) !== 1
  ) return null
  return sharedDates[0]
}

export async function resolveSlateInstructionalDateAnchor({
  admin,
  repository,
  facilitatorId,
  learnerId,
  lessonKey,
  slateLedger = null,
  loadLedger = loadTranscriptLedger,
}) {
  const profileTimeZone = typeof repository.findFacilitatorTimeZone === 'function'
    ? await repository.findFacilitatorTimeZone(facilitatorId)
    : null
  const timeZone = validTimeZone(profileTimeZone) || 'UTC'
  const [sessions, events] = await Promise.all([
    typeof repository.listAllTrackedSessions === 'function' ? repository.listAllTrackedSessions(learnerId) : [],
    typeof repository.listAllLessonSessionEvents === 'function' ? repository.listAllLessonSessionEvents(learnerId) : [],
  ])
  const canonicalCandidates = canonicalCompletionCandidates({ sessions, events, lessonKey, timeZone })
  const candidates = []
  let webbCandidate = null

  const webbReference = transcriptEvidenceReference({ facilitatorId, learnerId, teacher: 'webb', lessonKey })
  try {
    const webbLedger = await loadLedger(admin, webbReference)
    const verifiedWebb = verifyLegacyTranscriptLedger({ ledger: webbLedger, teacher: 'webb', timeZone })
    webbCandidate = {
      date: calendarDateInTimeZone(new Date(verifiedWebb.occurredAt), timeZone),
      source: 'verified_webb_instructional_completion',
    }
  } catch (error) {
    if (!(error instanceof SyllabusError)) throw error
    if (error.code === 'AMBIGUOUS_LEGACY_EVIDENCE') {
      throw new SyllabusError(
        'Multiple verified Webb instructional completions make the historical date anchor ambiguous',
        409,
        'AMBIGUOUS_LEGACY_EVIDENCE_ANCHOR',
      )
    }
  }

  if (canonicalCandidates.length === 1) {
    candidates.push({ date: canonicalCandidates[0].date, source: 'canonical_instructional_completion' })
  } else if (canonicalCandidates.length > 1) {
    const intersectedDate = intersectCanonicalAndSlateDates({ canonicalCandidates, slateLedger, timeZone })
    if (!intersectedDate) {
      throw new SyllabusError('Multiple canonical instructional completions make the historical date anchor ambiguous', 409, 'AMBIGUOUS_LEGACY_EVIDENCE_ANCHOR')
    }
    candidates.push({ date: intersectedDate, source: 'canonical_slate_date_intersection' })
  }
  if (webbCandidate) candidates.push(webbCandidate)

  const dates = [...new Set(candidates.map((candidate) => candidate.date))]
  if (dates.length > 1) {
    throw new SyllabusError('Canonical and verified Webb history disagree on the instructional date anchor', 409, 'AMBIGUOUS_LEGACY_EVIDENCE_ANCHOR')
  }
  if (dates.length === 0) return null
  return {
    date: dates[0],
    sources: candidates.map((candidate) => candidate.source),
    timeZone,
  }
}

export async function recoverVerifiedLegacyEvidence({
  admin,
  repository,
  facilitatorId,
  learnerId,
  lessonKey: rawLessonKey,
  teacher,
  loadLedger = loadTranscriptLedger,
}) {
  const learner = await repository.findOwnedLearner(learnerId, facilitatorId)
  if (!learner) throw new SyllabusError('Learner not found', 404, 'LEARNER_NOT_FOUND')

  const lessonKey = normalizeLessonKey(clean(rawLessonKey))
  if (!lessonKey || !lessonKey.includes('/')) {
    throw new SyllabusError('A valid historical lesson key is required', 400, 'INVALID_LESSON_KEY')
  }
  if (teacher !== 'webb' && teacher !== 'slate') {
    throw new SyllabusError('Verified recovery supports only Mrs. Webb instruction or Mr. Slate drill history', 400, 'INVALID_LEGACY_EVIDENCE_TEACHER')
  }

  const evidenceReference = transcriptEvidenceReference({ facilitatorId, learnerId, teacher, lessonKey })
  const ledger = await loadLedger(admin, evidenceReference)
  let verified
  try {
    verified = verifyLegacyTranscriptLedger({ ledger, teacher })
  } catch (error) {
    if (teacher !== 'slate' || error?.code !== 'AMBIGUOUS_LEGACY_EVIDENCE') throw error
    const anchor = await resolveSlateInstructionalDateAnchor({
      admin,
      repository,
      facilitatorId,
      learnerId,
      lessonKey,
      slateLedger: ledger,
      loadLedger,
    })
    if (!anchor) throw error
    verified = verifyLegacyTranscriptLedger({
      ledger,
      teacher,
      instructionalDateAnchor: anchor.date,
      timeZone: anchor.timeZone,
    })
  }
  if (teacher === 'webb') {
    const [sessions, events] = await Promise.all([
      typeof repository.listAllTrackedSessions === 'function' ? repository.listAllTrackedSessions(learnerId) : [],
      typeof repository.listAllLessonSessionEvents === 'function' ? repository.listAllLessonSessionEvents(learnerId) : [],
    ])
    const canonical = canonicalCompletionCandidates({ sessions, events, lessonKey, timeZone: 'UTC' })
    if (canonical.length > 0) {
      throw new SyllabusError(
        canonical.length > 1
          ? 'Multiple canonical instructional completions prevent historical Webb recovery'
          : 'Canonical instructional completion already represents this lesson',
        409,
        canonical.length > 1 ? 'AMBIGUOUS_CANONICAL_INSTRUCTION_HISTORY' : 'CANONICAL_INSTRUCTION_ALREADY_COMPLETED',
      )
    }
  }
  const activityType = teacher === 'webb' ? 'instructional_completion' : 'slate_drill_completion'
  const identityMaterial = [
    learnerId,
    lessonKey,
    teacher,
    activityType,
    SERVER_VERIFIED_LEGACY_EVIDENCE_VERSION,
    verified.evidenceDigest,
  ].join('|')
  const sourceIdentity = sha256(`source|${identityMaterial}`)
  const occurrenceId = `${SERVER_VERIFIED_LEGACY_OCCURRENCE_PREFIX}${sha256(`occurrence|${identityMaterial}`)}`

  return repository.insertLegacyActivityRecord({
    facilitator_id: facilitatorId,
    learner_id: learnerId,
    lesson_key: lessonKey,
    syllabus_occurrence_id: occurrenceId,
    activity_type: activityType,
    instructional_teacher: teacher === 'webb' ? 'webb' : null,
    occurred_at: verified.occurredAt,
    provenance: SERVER_VERIFIED_LEGACY_PROVENANCE,
    source_identity: sourceIdentity,
    recorded_by: facilitatorId,
    evidence_reference: evidenceReference,
    evidence_version: SERVER_VERIFIED_LEGACY_EVIDENCE_VERSION,
    evidence_digest: verified.evidenceDigest,
  })
}
