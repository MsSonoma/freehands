import { createHash } from 'node:crypto'
import { resolveCalendarContext } from '../calendarDate.mjs'
import { setLessonAssociationInferenceSuppressed } from './lessonAssociations.server.mjs'
import { adoptLearningForecastLineage, bindMaterializedForecast, carryForwardLearningForecastProposal, getActiveSyllabus } from './revisions.server.mjs'
import { SyllabusError } from './schema.mjs'

function clean(value) { return String(value || '').trim() }
async function clearMaterializedLessonInferenceSuppression({
  admin,
  facilitatorId,
  learnerId,
  lessonKey,
  setInferenceSuppressed,
}) {
  try {
    await setInferenceSuppressed({
      admin,
      facilitatorId,
      learnerId,
      lessonKey,
      suppressed: false,
      verifyLearner: false,
    })
  } catch (error) {
    if (error?.code === 'LESSON_ASSOCIATION_NOT_FOUND') {
      return { cleared: false, association_missing: true }
    }
    throw error
  }
  return { cleared: true, association_missing: false }
}

function generationHash({ learnerId, activeRevision, item, learner }) {
  return createHash('sha256').update(JSON.stringify({
    learner_id: learnerId,
    learner_grade: learner?.grade || null,
    revision_id: activeRevision.id,
    lineage_id: item.lineage_id,
    title: item.title,
    description: item.description || null,
    subject: item.subject,
    teaching_guidance: activeRevision.teaching_guidance,
    planning_policy: activeRevision.planning_policy,
  })).digest('hex')
}

export async function reconstructForecastCarryForward({
  repository,
  admin,
  facilitatorId,
  learnerId,
  sourceProposalRevisionId,
  expectedActiveRevisionId,
  now = new Date(),
  fallbackTimeZone,
}) {
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  const activeRevision = syllabus?.active_revision_id === expectedActiveRevisionId
    ? await repository.findRevision(expectedActiveRevisionId, syllabus.id)
    : null
  const adoption = activeRevision?.legacy_provenance?.learning_forecast_adoption
  if (!activeRevision || adoption?.source_proposal_revision_id !== sourceProposalRevisionId || !clean(adoption?.accepted_lineage_id)) {
    throw new SyllabusError('This sibling-proposal reconstruction is no longer valid for the active Syllabus.', 409, 'FORECAST_CARRY_FORWARD_RECOVERY_INVALID')
  }
  const profileTimeZone = typeof repository.findFacilitatorTimeZone === 'function' ? await repository.findFacilitatorTimeZone(facilitatorId) : null
  const calendar = resolveCalendarContext({ now, profileTimeZone, fallbackTimeZone })
  const carryForward = await carryForwardLearningForecastProposal({
    repository,
    facilitatorId,
    learnerId,
    sourceProposalRevisionId,
    acceptedLineageIds: [adoption.accepted_lineage_id],
    expectedActiveRevisionId,
    today: calendar.today,
  })
  return {
    kind: 'carry_forward_reconstructed',
    carry_forward: carryForward,
    syllabus: await getActiveSyllabus({ repository, admin, facilitatorId, learnerId, now, fallbackTimeZone }),
  }
}

export async function materializeForecastOccurrence({
  repository,
  admin,
  facilitatorId,
  learnerId,
  lineageId,
  expectedActiveRevisionId,
  proposalRevisionId = null,
  generateLesson,
  setInferenceSuppressed = setLessonAssociationInferenceSuppressed,
  now = new Date(),
  fallbackTimeZone,
}) {
  const learner = await repository.findOwnedLearner(learnerId, facilitatorId)
  if (!learner) throw new SyllabusError('Learner not found or unauthorized', 404, 'FORECAST_OCCURRENCE_NOT_FOUND')
  const learnerGrade = clean(learner.grade)
  if (!learnerGrade) {
    throw new SyllabusError('Set an authoritative grade for this learner before generating the lesson.', 422, 'MATERIALIZATION_GRADE_REQUIRED')
  }
  let syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus?.active_revision_id || syllabus.active_revision_id !== expectedActiveRevisionId) {
    throw new SyllabusError('The active Syllabus changed before materialization.', 409, 'MATERIALIZATION_CONFLICT')
  }
  const profileTimeZone = typeof repository.findFacilitatorTimeZone === 'function' ? await repository.findFacilitatorTimeZone(facilitatorId) : null
  const calendar = resolveCalendarContext({ now, profileTimeZone, fallbackTimeZone })
  let carrySourceProposalId = null
  let acceptedLineageIds = []
  let adoptedRevisionId = null

  if (proposalRevisionId) {
    const proposal = await repository.findRevision(proposalRevisionId, syllabus.id)
    const proposalItems = proposal ? await repository.listForecastItems(proposal.id) : []
    const proposalMatches = proposalItems.filter((item) => clean(item?.lineage_id) === clean(lineageId))
    if (
      !proposal
      || proposal.proposal_kind !== 'learning_forecast'
      || proposal.activated_at
      || proposal.base_revision_id !== expectedActiveRevisionId
      || proposalMatches.length !== 1
      || proposalMatches[0].origin !== 'learning_forecast'
      || (proposalMatches[0].item_type || 'lesson') !== 'lesson'
    ) {
      throw new SyllabusError('Instructional forecast occurrence not found or no longer current', 409, 'FORECAST_PROPOSAL_STALE')
    }
    const adopted = await adoptLearningForecastLineage({
      repository,
      facilitatorId,
      learnerId,
      proposalRevisionId,
      lineageId,
      expectedActiveRevisionId,
      now,
      today: calendar.today,
      carryForward: false,
    })
    carrySourceProposalId = proposal.id
    acceptedLineageIds = [lineageId]
    adoptedRevisionId = adopted.active_revision.id
    syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  } else if (typeof repository.findLatestLearningForecastProposal === 'function') {
    const currentProposal = await repository.findLatestLearningForecastProposal(syllabus.id, syllabus.active_revision_id)
    carrySourceProposalId = currentProposal?.id || null
  }

  const performCarryForward = async (activeRevisionId) => {
    if (!carrySourceProposalId) return { status: 'not_applicable' }
    return carryForwardLearningForecastProposal({
      repository,
      facilitatorId,
      learnerId,
      sourceProposalRevisionId: carrySourceProposalId,
      acceptedLineageIds,
      expectedActiveRevisionId: activeRevisionId,
      today: calendar.today,
    })
  }
  const attemptCarryForward = async (activeRevisionId) => {
    try {
      return await performCarryForward(activeRevisionId)
    } catch (error) {
      return {
        status: 'failed',
        source_proposal_revision_id: carrySourceProposalId,
        code: error?.code || 'FORECAST_CARRY_FORWARD_FAILED',
      }
    }
  }
  if (adoptedRevisionId) {
    let initialCarry
    try {
      initialCarry = await performCarryForward(adoptedRevisionId)
    } catch (error) {
      const failure = new SyllabusError('The forecast concept was adopted, but its remaining sibling proposals could not be carried forward. Retry the deterministic carry-forward before generating the lesson.', 500, 'FORECAST_CARRY_FORWARD_FAILED')
      failure.sourceProposalRevisionId = carrySourceProposalId
      failure.expectedActiveRevisionId = adoptedRevisionId
      failure.acceptedLineageIds = [...acceptedLineageIds]
      throw failure
    }
    carrySourceProposalId = initialCarry.proposal_revision?.id || null
    acceptedLineageIds = []
  }

  const bindingRevisionId = syllabus.active_revision_id
  const activeRevision = await repository.findRevision(bindingRevisionId, syllabus.id)
  const items = await repository.listForecastItems(bindingRevisionId)
  const matches = items.filter((item) => clean(item?.lineage_id) === clean(lineageId))
  if (matches.length !== 1 || matches[0].item_type !== 'lesson' || !['learning_forecast', 'facilitator'].includes(matches[0].origin)) {
    throw new SyllabusError('Forecast occurrence not found', 404, 'FORECAST_OCCURRENCE_NOT_FOUND')
  }
  const item = matches[0]
  if (item.lesson_key) {
    await clearMaterializedLessonInferenceSuppression({
      admin, facilitatorId, learnerId, lessonKey: item.lesson_key, setInferenceSuppressed,
    })
    return {
      kind: 'materialized', reused: true, lesson_key: item.lesson_key, lineage_id: item.lineage_id,
      syllabus: await getActiveSyllabus({ repository, admin, facilitatorId, learnerId, now, fallbackTimeZone }),
    }
  }
  const inputHash = generationHash({ learnerId, activeRevision, item, learner })
  const claim = await repository.claimForecastMaterialization({ syllabusId: syllabus.id, lineageId: item.lineage_id, generationInputHash: inputHash })
  const receipt = claim?.receipt
  if (!receipt?.id) throw new SyllabusError('Materialization could not be reserved', 500, 'MATERIALIZATION_CLAIM_FAILED')
  if (receipt.generation_input_hash !== inputHash) {
    throw new SyllabusError('This forecast intent changed after a lesson artifact was generated. Review the current concept before binding.', 409, 'MATERIALIZATION_INPUT_CHANGED')
  }
  let lessonKey = clean(receipt.lesson_key)

  if (!lessonKey) {
    let result
    try {
      result = await generateLesson({
        learnerId,
        title: item.title,
        subject: item.subject,
        description: item.description || `A complete lesson for ${item.title}.`,
        grade: learnerGrade,
        difficulty: clean(activeRevision.planning_policy?.difficulty) || 'intermediate',
        notes: JSON.stringify(activeRevision.teaching_guidance || {}).slice(0, 3000),
        materializationOperation: {
          id: receipt.id,
          syllabusId: syllabus.id,
          lineageId: item.lineage_id,
          generationInputHash: inputHash,
          recoverOnly: claim.claimed !== true,
        },
      })
      lessonKey = clean(result?.lessonKey)
      if (!lessonKey) throw new Error('The generator returned no canonical lesson identity')
    } catch (error) {
      if (error?.code === 'MATERIALIZATION_RECOVERY_REQUIRED') {
        await repository.updateForecastMaterialization(receipt.id, {
          status: 'recovery_required',
          last_error: clean(error?.message).slice(0, 500) || 'Materialization generation recovery is required',
        }).catch(() => {})
        const failure = new SyllabusError('Generation completion is ambiguous and no exact canonical artifact can be proven. Blind regeneration is disabled.', 409, 'MATERIALIZATION_RECOVERY_REQUIRED')
        failure.operation = error.operation || { id: receipt.id, lineageId: item.lineage_id }
        throw failure
      }
      await repository.updateForecastMaterialization(receipt.id, { status: 'generation_failed', last_error: clean(error?.message).slice(0, 500) || 'Lesson generation failed' }).catch(() => {})
      throw new SyllabusError('The planned concept was preserved, but the full lesson could not be generated.', 502, 'MATERIALIZATION_GENERATION_FAILED')
    }
    try {
      await repository.updateForecastMaterialization(receipt.id, { lesson_key: lessonKey, status: 'generated', last_error: null })
    } catch (error) {
      await repository.updateForecastMaterialization(receipt.id, { lesson_key: lessonKey, status: 'binding_failed', last_error: clean(error?.message).slice(0, 500) || 'Generated lesson receipt failed' }).catch(() => {})
      throw new SyllabusError('The lesson was generated, but its repair receipt could not be confirmed. Retry after the receipt is repaired.', 500, 'MATERIALIZATION_RECEIPT_FAILED')
    }
  }

  let bound
  try {
    bound = await bindMaterializedForecast({
      repository,
      facilitatorId,
      learnerId,
      lineageId: item.lineage_id,
      lessonKey,
      expectedActiveRevisionId: bindingRevisionId,
      now,
      today: calendar.today,
    })
    await repository.updateForecastMaterialization(receipt.id, { lesson_key: lessonKey, status: 'bound', last_error: null })
  } catch (error) {
    await repository.updateForecastMaterialization(receipt.id, { lesson_key: lessonKey, status: 'binding_failed', last_error: clean(error?.message).slice(0, 500) }).catch(() => {})
    if (error instanceof SyllabusError) throw error
    throw new SyllabusError('The lesson was generated but could not be bound to its Syllabus lineage. Retry will reuse the generated lesson.', 409, 'MATERIALIZATION_BINDING_FAILED')
  }
  await clearMaterializedLessonInferenceSuppression({
    admin, facilitatorId, learnerId, lessonKey, setInferenceSuppressed,
  })
  const carryForward = await attemptCarryForward(bound.active_revision.id)

  return {
    kind: 'materialized', reused: Boolean(receipt.lesson_key), lesson_key: lessonKey, lineage_id: item.lineage_id,
    carry_forward: carryForward,
    syllabus: await getActiveSyllabus({ repository, admin, facilitatorId, learnerId, now, fallbackTimeZone }),
  }
}
