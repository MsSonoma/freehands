const OPERATION_PREFIX = 'syllabus-materialization-'

export class MaterializationGenerationError extends Error {
  constructor(message, code, status = 500) {
    super(message)
    this.name = 'MaterializationGenerationError'
    this.code = code
    this.status = status
  }
}

function clean(value) { return String(value || '').trim() }

export function materializationArtifactIdentity(operation = {}) {
  const operationId = clean(operation.id)
  const facilitatorId = clean(operation.facilitatorId)
  if (!operationId || !facilitatorId) return null
  const file = `${OPERATION_PREFIX}${operationId}.json`
  return {
    file,
    lessonKey: `generated/${file}`,
    storagePath: `facilitator-lessons/${facilitatorId}/${file}`,
    ownerId: facilitatorId,
  }
}

export function materializationArtifactMetadata(operation = {}) {
  return {
    version: 1,
    operation_id: clean(operation.id),
    syllabus_id: clean(operation.syllabusId),
    lineage_id: clean(operation.lineageId),
    generation_input_hash: clean(operation.generationInputHash),
    facilitator_id: clean(operation.facilitatorId),
    learner_id: clean(operation.learnerId),
  }
}

export function isExactMaterializationArtifact(lesson, operation = {}) {
  const actual = lesson?.materialization_operation
  const expected = materializationArtifactMetadata(operation)
  return Boolean(actual)
    && Object.entries(expected).every(([key, value]) => clean(value) && clean(actual[key]) === clean(value))
}

export async function recoverOrGenerateMaterializationArtifact({
  operation,
  recoverOnly = false,
  loadArtifact,
  generateArtifact,
  createArtifact,
  associateArtifact,
  finalizeOperation,
  afterArtifactCreated = null,
}) {
  const identity = materializationArtifactIdentity(operation)
  if (!identity) throw new MaterializationGenerationError('Invalid materialization operation identity', 'MATERIALIZATION_OPERATION_INVALID', 400)

  let lesson = await loadArtifact(identity)
  let recovered = Boolean(lesson)
  if (lesson && !isExactMaterializationArtifact(lesson, operation)) {
    throw new MaterializationGenerationError('The deterministic artifact identity does not match this materialization operation.', 'MATERIALIZATION_ARTIFACT_MISMATCH', 409)
  }

  if (!lesson) {
    if (recoverOnly) {
      throw new MaterializationGenerationError('Generation completion is ambiguous and no exact canonical artifact can be proven. Blind regeneration is disabled.', 'MATERIALIZATION_RECOVERY_REQUIRED', 409)
    }
    lesson = await generateArtifact()
    lesson = { ...lesson, materialization_operation: materializationArtifactMetadata(operation) }
    const created = await createArtifact(identity, lesson)
    if (!created) {
      lesson = await loadArtifact(identity)
      recovered = true
      if (!lesson || !isExactMaterializationArtifact(lesson, operation)) {
        throw new MaterializationGenerationError('A conflicting deterministic artifact could not be verified.', 'MATERIALIZATION_ARTIFACT_MISMATCH', 409)
      }
    }
    if (created && typeof afterArtifactCreated === 'function') await afterArtifactCreated({ identity, lesson })
  }

  await associateArtifact({ identity, lesson })
  const receipt = await finalizeOperation({ identity, lesson })
  return { identity, lesson, receipt, recovered }
}
