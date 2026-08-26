import { normalizeLessonKey } from '../lessonKeyNormalization.js'
import { SyllabusError } from './schema.mjs'

const READINESS = new Set(['draft', 'approved', 'available', 'saved'])
const SOURCES = new Set(['generator', 'prepare', 'availability', 'schedule'])
const READINESS_RANK = Object.freeze({ saved: 0, draft: 1, approved: 2, available: 3 })

function clean(value, max = 240) {
  return String(value || '').trim().slice(0, max)
}

export function preserveReadinessState(existingState, requestedState) {
  const existing = READINESS.has(existingState) ? existingState : 'saved'
  const requested = READINESS.has(requestedState) ? requestedState : 'saved'
  return READINESS_RANK[existing] >= READINESS_RANK[requested] ? existing : requested
}

export async function requireAssociationLearner(admin, facilitatorId, learnerId) {
  const { data, error } = await admin.from('learners').select('id')
    .eq('id', learnerId)
    .or(`facilitator_id.eq.${facilitatorId},owner_id.eq.${facilitatorId},user_id.eq.${facilitatorId}`)
    .maybeSingle()
  if (error || !data) throw new SyllabusError('Learner not found or unauthorized', 403, 'FORBIDDEN')
  return data
}

export async function upsertLessonAssociation({
  admin,
  facilitatorId,
  learnerId,
  lessonKey,
  subject,
  title,
  readinessState = 'saved',
  associationSource = 'prepare',
  verifyLearner = true,
}) {
  const canonicalKey = normalizeLessonKey(lessonKey)
  const normalizedSubject = clean(subject, 120).toLocaleLowerCase()
  const normalizedTitle = clean(title, 300)
  if (!canonicalKey || !canonicalKey.includes('/') || !normalizedSubject || !normalizedTitle) {
    throw new SyllabusError('A canonical lesson identity, subject, and title are required', 400, 'INVALID_LESSON_ASSOCIATION')
  }
  if (!READINESS.has(readinessState) || !SOURCES.has(associationSource)) {
    throw new SyllabusError('Invalid lesson association state', 400, 'INVALID_LESSON_ASSOCIATION')
  }
  if (verifyLearner) await requireAssociationLearner(admin, facilitatorId, learnerId)
  const existingResult = await admin.from('syllabus_lesson_associations').select('readiness_state')
    .eq('facilitator_id', facilitatorId)
    .eq('learner_id', learnerId)
    .eq('lesson_key', canonicalKey)
    .maybeSingle()
  if (existingResult.error) {
    throw new SyllabusError(existingResult.error.message || 'Could not read learner lesson association', 500, 'LESSON_ASSOCIATION_FAILED')
  }
  const preservedReadiness = preserveReadinessState(existingResult.data?.readiness_state, readinessState)
  const { data, error } = await admin.from('syllabus_lesson_associations').upsert({
    facilitator_id: facilitatorId,
    learner_id: learnerId,
    lesson_key: canonicalKey,
    subject: normalizedSubject,
    title: normalizedTitle,
    readiness_state: preservedReadiness,
    association_source: associationSource,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'facilitator_id,learner_id,lesson_key' }).select('*').single()
  if (error) throw new SyllabusError(error.message || 'Could not preserve learner lesson association', 500, 'LESSON_ASSOCIATION_FAILED')
  return data
}
