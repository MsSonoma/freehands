export const FACILITATOR_PREPARATION_VERSION = 1

export const FACILITATOR_PREPARATION_STAGES = Object.freeze({
  NEED: 'NEED',
  PROPOSAL: 'PROPOSAL',
  GENERATING: 'GENERATING',
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  DELIVERY: 'DELIVERY',
  COMPLETE: 'COMPLETE',
})

const STAGE_ORDER = [
  FACILITATOR_PREPARATION_STAGES.NEED,
  FACILITATOR_PREPARATION_STAGES.PROPOSAL,
  FACILITATOR_PREPARATION_STAGES.GENERATING,
  FACILITATOR_PREPARATION_STAGES.DRAFT,
  FACILITATOR_PREPARATION_STAGES.APPROVED,
  FACILITATOR_PREPARATION_STAGES.DELIVERY,
  FACILITATOR_PREPARATION_STAGES.COMPLETE,
]

const SUBJECT_HINTS = [
  { subject: 'math', words: ['math', 'fraction', 'decimal', 'multiply', 'division', 'algebra', 'geometry', 'number', 'equation'] },
  { subject: 'science', words: ['science', 'plant', 'animal', 'space', 'earth', 'energy', 'force', 'matter', 'weather'] },
  { subject: 'language arts', words: ['read', 'reading', 'write', 'writing', 'grammar', 'sentence', 'paragraph', 'vocabulary', 'spelling'] },
  { subject: 'social studies', words: ['history', 'geography', 'government', 'civics', 'community', 'map', 'culture', 'state', 'country'] },
]

function cleanString(value, max = 2000) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, ' ').slice(0, max)
}

function optionalString(value, max = 1200) {
  const cleaned = cleanString(value, max)
  return cleaned || undefined
}

function sanitizeBoolean(value) {
  return typeof value === 'boolean' ? value : undefined
}

function sanitizeSourceReferences(value) {
  if (!Array.isArray(value)) return undefined
  const refs = value
    .map((item) => cleanString(item, 240))
    .filter(Boolean)
    .slice(0, 8)
  return refs.length ? refs : undefined
}

export function validateLessonIntent(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'Lesson intent must be an object' }
  }

  const version = Number(input.version)
  if (version !== FACILITATOR_PREPARATION_VERSION) {
    return { ok: false, error: `Unsupported lesson intent version: ${input.version ?? 'missing'}` }
  }

  const learnerId = cleanString(input.learnerId, 120)
  if (!learnerId) return { ok: false, error: 'Choose a learner before preparing a lesson' }

  const need = cleanString(input.need, 2000)
  if (need.length < 8) return { ok: false, error: 'Describe what the learner needs in a little more detail' }

  const rawBoundaries = input.boundaries && typeof input.boundaries === 'object' && !Array.isArray(input.boundaries)
    ? input.boundaries
    : {}

  const boundaries = {}
  const pace = optionalString(rawBoundaries.pace, 120)
  if (pace) boundaries.pace = pace
  const parentNotes = optionalString(rawBoundaries.parentNotes, 1200)
  if (parentNotes) boundaries.parentNotes = parentNotes

  ;['additionalPractice', 'includeWorksheet', 'includeTest', 'avoidTimedWork'].forEach((key) => {
    const value = sanitizeBoolean(rawBoundaries[key])
    if (typeof value === 'boolean') boundaries[key] = value
  })

  const intent = {
    version: FACILITATOR_PREPARATION_VERSION,
    learnerId,
    need,
    boundaries,
  }

  const sourceReferences = sanitizeSourceReferences(input.sourceReferences)
  if (sourceReferences) intent.sourceReferences = sourceReferences

  return { ok: true, intent }
}

export function inferSubjectFromNeed(need = '') {
  const lower = String(need || '').toLowerCase()
  for (const hint of SUBJECT_HINTS) {
    if (hint.words.some((word) => lower.includes(word))) return hint.subject
  }
  return 'math'
}

export function normalizeGrade(rawGrade) {
  const grade = cleanString(String(rawGrade ?? ''), 40)
  return grade || 'K'
}

export function buildLessonProposal({ intent, learner = {}, savedDefaults = {} } = {}) {
  const validation = validateLessonIntent(intent)
  if (!validation.ok) return validation

  const validIntent = validation.intent
  const learnerName = cleanString(learner.name, 120) || 'your learner'
  const grade = normalizeGrade(learner.grade ?? savedDefaults.grade)
  const subject = cleanString(savedDefaults.subject, 80) || inferSubjectFromNeed(validIntent.need)
  const difficulty = cleanString(savedDefaults.difficulty, 80) || 'intermediate'
  const title = cleanString(savedDefaults.title, 100) || `${learnerName}: ${validIntent.need}`.slice(0, 92)

  const boundaryLines = []
  const b = validIntent.boundaries || {}
  if (b.pace) boundaryLines.push(`Pace: ${b.pace}.`)
  if (b.additionalPractice === true) boundaryLines.push('Include extra practice opportunities.')
  if (b.includeWorksheet === false) boundaryLines.push('Do not emphasize worksheet work.')
  if (b.includeTest === false) boundaryLines.push('Do not emphasize test-style review.')
  if (b.avoidTimedWork === true) boundaryLines.push('Avoid timed-work pressure.')
  if (b.parentNotes) boundaryLines.push(`Parent notes: ${b.parentNotes}`)

  const generationSpec = {
    title,
    subject,
    difficulty,
    grade,
    description: validIntent.need,
    notes: [
      `Prepare a calm guided learning session for ${learnerName}.`,
      ...boundaryLines,
      ...(validIntent.sourceReferences ? [`Use these source references where relevant: ${validIntent.sourceReferences.join('; ')}`] : []),
    ].filter(Boolean).join(' '),
    vocab: cleanString(savedDefaults.vocab, 600),
  }

  const assumptions = [
    `Grade ${grade} is the working grade level.`,
    `Subject area was resolved as ${subject}.`,
    `Difficulty starts at ${difficulty}.`,
  ]

  if (!Object.keys(b).length) {
    assumptions.push('No additional boundaries were set.')
  }

  return {
    ok: true,
    proposal: {
      version: FACILITATOR_PREPARATION_VERSION,
      learnerId: validIntent.learnerId,
      summary: `Ms. Sonoma will prepare a ${subject} guided learning session for ${learnerName} focused on: ${validIntent.need}`,
      generationSpec,
      assumptions,
      appliedBoundaries: b,
    },
  }
}

export function normalizeGenerationRequest(body = {}) {
  const mode = body?.mode || 'structured'

  if (mode === 'proposal') {
    const proposal = body?.proposal
    const spec = proposal?.generationSpec
    if (!proposal || proposal.version !== FACILITATOR_PREPARATION_VERSION || !spec || typeof spec !== 'object') {
      return { ok: false, error: 'A valid lesson proposal is required' }
    }
    return normalizeGenerationRequest({ mode: 'structured', ...spec })
  }

  if (mode !== 'structured') {
    return { ok: false, error: `Unsupported generation mode: ${mode}` }
  }

  const title = cleanString(body.title, 120)
  const subject = cleanString(body.subject, 80).toLowerCase()
  const difficulty = cleanString(body.difficulty, 80).toLowerCase()
  const grade = normalizeGrade(body.grade)
  const description = cleanString(body.description, 2000)
  const notes = cleanString(body.notes, 2000)
  const vocab = cleanString(body.vocab, 1000)

  if (!title || !subject || !difficulty || !grade) {
    return { ok: false, error: 'Missing fields' }
  }

  return {
    ok: true,
    request: { title, subject, difficulty, grade, description, notes, vocab },
  }
}

export function buildCanonicalLessonIdentity({ file, ownerId, storagePath } = {}) {
  const safeFile = cleanString(file, 240)
  const safeOwnerId = cleanString(ownerId, 120)
  if (!safeFile || !safeOwnerId) return null
  return {
    file: safeFile,
    storagePath: storagePath || `facilitator-lessons/${safeOwnerId}/${safeFile}`,
    lessonKey: `generated/${safeFile}`,
    ownerId: safeOwnerId,
  }
}

export function canTransitionPreparationStage(fromStage, toStage) {
  if (
    fromStage === FACILITATOR_PREPARATION_STAGES.DRAFT
    && toStage === FACILITATOR_PREPARATION_STAGES.DELIVERY
  ) {
    return true
  }
  const fromIndex = STAGE_ORDER.indexOf(fromStage)
  const toIndex = STAGE_ORDER.indexOf(toStage)
  if (fromIndex === -1 || toIndex === -1) return false
  if (fromStage === FACILITATOR_PREPARATION_STAGES.COMPLETE) return false
  return toIndex === fromIndex || toIndex === fromIndex + 1 || toStage === FACILITATOR_PREPARATION_STAGES.NEED
}

export function snapshotLearnerId(snapshot = {}) {
  return cleanString(snapshot?.learnerId || snapshot?.intent?.learnerId || snapshot?.proposal?.learnerId, 120)
}

export function resolvePreparationLearnerRecovery(snapshot = {}, learners = []) {
  const normalized = normalizePreparationSnapshot(snapshot)
  if (!normalized || normalized.stage === FACILITATOR_PREPARATION_STAGES.COMPLETE) return null
  const missingLearnerId = snapshotLearnerId(normalized)
  if (!missingLearnerId || !Array.isArray(learners) || learners.length === 0) return null
  if (learners.some((learner) => learner?.id === missingLearnerId)) return null
  return { missingLearnerId, stage: normalized.stage }
}

export function reassignPreparationSnapshotLearner(snapshot = {}, learnerId = '') {
  const normalized = normalizePreparationSnapshot(snapshot)
  const nextLearnerId = cleanString(learnerId, 120)
  if (!normalized || !nextLearnerId) return null
  return {
    ...normalized,
    learnerId: nextLearnerId,
    intent: normalized.intent ? { ...normalized.intent, learnerId: nextLearnerId } : null,
    proposal: normalized.proposal ? { ...normalized.proposal, learnerId: nextLearnerId } : null,
  }
}

export function normalizePreparationSnapshot(snapshot = {}) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null
  if (Number(snapshot.version) !== FACILITATOR_PREPARATION_VERSION) return null
  const stage = STAGE_ORDER.includes(snapshot.stage) ? snapshot.stage : FACILITATOR_PREPARATION_STAGES.NEED
  return {
    version: FACILITATOR_PREPARATION_VERSION,
    stage,
    learnerId: cleanString(snapshot.learnerId, 120) || '',
    intent: snapshot.intent && typeof snapshot.intent === 'object' ? snapshot.intent : null,
    proposal: snapshot.proposal && typeof snapshot.proposal === 'object' ? snapshot.proposal : null,
    lessonIdentity: snapshot.lessonIdentity && typeof snapshot.lessonIdentity === 'object' ? snapshot.lessonIdentity : null,
    updatedAt: cleanString(snapshot.updatedAt, 80) || new Date().toISOString(),
  }
}
