import { SyllabusError, validateSnapshot } from './schema.mjs'
import { buildLegacySeed } from './legacySeed.server.mjs'

async function requireOwnedLearner(repository, learnerId, facilitatorId) {
  const learner = await repository.findOwnedLearner(learnerId, facilitatorId)
  if (!learner) throw new SyllabusError('Learner not found or unauthorized', 403, 'FORBIDDEN')
  return learner
}

export async function getActiveSyllabus({ repository, facilitatorId, learnerId }) {
  await requireOwnedLearner(repository, learnerId, facilitatorId)
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus?.active_revision_id) {
    return { has_active_syllabus: false, syllabus: syllabus || null, active_revision: null, forecast_items: [] }
  }
  const activeRevision = await repository.findRevision(syllabus.active_revision_id, syllabus.id)
  if (!activeRevision) throw new SyllabusError('The active Syllabus revision could not be found', 500, 'ACTIVE_REVISION_MISSING')
  const forecastItems = await repository.listForecastItems(activeRevision.id)
  const proposedRevision = typeof repository.findLatestMasteryProposal === 'function'
    ? await repository.findLatestMasteryProposal(syllabus.id, activeRevision.id)
    : null
  const proposedForecast = proposedRevision ? await repository.listForecastItems(proposedRevision.id) : []
  return {
    has_active_syllabus: true,
    syllabus,
    active_revision: activeRevision,
    forecast_items: forecastItems,
    proposed_reforecast: proposedRevision ? {
      revision: proposedRevision,
      forecast_items: proposedForecast,
    } : null,
  }
}

export async function activateProposedSyllabus({
  repository,
  facilitatorId,
  learnerId,
  proposalRevisionId,
  expectedActiveRevisionId,
  now = new Date(),
}) {
  await requireOwnedLearner(repository, learnerId, facilitatorId)
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus || syllabus.active_revision_id !== expectedActiveRevisionId) {
    throw new SyllabusError('The active Syllabus changed. Reload before activating this proposal.', 409, 'ACTIVATION_CONFLICT')
  }
  const proposal = await repository.findRevision(proposalRevisionId, syllabus.id)
  if (!proposal || proposal.activated_at || proposal.base_revision_id !== expectedActiveRevisionId) {
    throw new SyllabusError('This proposed reforecast is no longer available for activation.', 409, 'PROPOSAL_STALE')
  }
  if (proposal.proposal_kind === 'mastery_reforecast' || proposal.change_reason?.startsWith('Mastery evidence proposal:')) {
    const canonical = await repository.findLatestMasteryProposal(syllabus.id, expectedActiveRevisionId)
    if (!canonical || canonical.id !== proposal.id) {
      throw new SyllabusError('This mastery reforecast has been superseded. Review the current proposal instead.', 409, 'PROPOSAL_SUPERSEDED')
    }
  }
  if (String(proposal.effective_from).slice(0, 10) !== now.toISOString().slice(0, 10)) {
    throw new SyllabusError('This proposed reforecast was prepared on an earlier date. Check mastery evidence again before activation.', 409, 'PROPOSAL_STALE')
  }
  try {
    const revision = await repository.commitRevisionActivation({
      syllabusId: syllabus.id,
      revisionId: proposal.id,
      expectedActiveRevisionId,
    })
    return {
      syllabus: await repository.findSyllabus(facilitatorId, learnerId),
      active_revision: revision,
      forecast_items: await repository.listForecastItems(revision.id),
    }
  } catch (error) {
    if (error.code === '40001') {
      throw new SyllabusError('The active Syllabus changed while this proposal was being activated. Review and try again.', 409, 'ACTIVATION_CONFLICT')
    }
    throw error
  }
}

async function persistSyllabusActivation({ repository, facilitatorId, learnerId, snapshot, now, requireNoActiveRevision = false }) {
  await requireOwnedLearner(repository, learnerId, facilitatorId)
  const activationDate = now.toISOString().slice(0, 10)
  const planning = validateSnapshot(snapshot, { today: activationDate })
  let syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus) syllabus = await repository.createOrFindSyllabus(facilitatorId, learnerId)
  if (requireNoActiveRevision && syllabus.active_revision_id) {
    throw new SyllabusError('This learner already has an active Syllabus', 403, 'SYLLABUS_PLANNING_REQUIRED')
  }

  let baseRevision = syllabus.active_revision_id
    ? await repository.findRevision(syllabus.active_revision_id, syllabus.id)
    : null
  let revision = null
  try {
    for (let attempt = 0; attempt < 3 && !revision; attempt++) {
      try {
        revision = await repository.insertRevision({
          syllabus_id: syllabus.id,
          revision_number: await repository.nextRevisionNumber(syllabus.id),
          base_revision_id: baseRevision?.id || null,
          effective_from: planning.effective_from,
          schema_version: planning.schema_version,
          goals: planning.goals,
          subjects: planning.subjects,
          weekly_pattern: planning.weekly_pattern,
          teaching_guidance: planning.teaching_guidance,
          planning_policy: planning.planning_policy,
          legacy_provenance: planning.legacy_provenance,
          change_reason: planning.change_reason,
        })
      } catch (error) {
        if (error.code !== '23505' || attempt === 2) throw error
        syllabus = await repository.findSyllabus(facilitatorId, learnerId)
        if (requireNoActiveRevision && syllabus?.active_revision_id) {
          throw new SyllabusError('This learner already has an active Syllabus', 403, 'SYLLABUS_PLANNING_REQUIRED')
        }
        baseRevision = syllabus.active_revision_id
          ? await repository.findRevision(syllabus.active_revision_id, syllabus.id)
          : null
      }
    }
    await repository.insertForecastItems(revision.id, planning.forecast_items)
    revision = await repository.commitRevisionActivation({
      syllabusId: syllabus.id,
      revisionId: revision.id,
      expectedActiveRevisionId: baseRevision?.id || null,
    })
    syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  } catch (error) {
    if (revision && !revision.activated_at) await repository.deleteInactiveRevision(revision.id).catch(() => {})
    if (error.code === '40001') {
      throw new SyllabusError('The active Syllabus changed while this proposal was being activated. Review and try again.', 409, 'ACTIVATION_CONFLICT')
    }
    throw error
  }
  return { syllabus, active_revision: revision, forecast_items: await repository.listForecastItems(revision.id) }
}

export async function activateSyllabus({ repository, facilitatorId, learnerId, snapshot, now = new Date(), allowFutureIntentChanges = true }) {
  if (!allowFutureIntentChanges) {
    throw new SyllabusError('Future Syllabus planning requires the current Lesson Planner entitlement', 403, 'SYLLABUS_PLANNING_REQUIRED')
  }
  return persistSyllabusActivation({ repository, facilitatorId, learnerId, snapshot, now })
}

export async function establishSyllabusFromLegacyPlan({ repository, facilitatorId, learnerId, now = new Date() }) {
  await requireOwnedLearner(repository, learnerId, facilitatorId)
  const existing = await repository.findSyllabus(facilitatorId, learnerId)
  if (existing?.active_revision_id) {
    throw new SyllabusError('This learner already has an active Syllabus', 403, 'SYLLABUS_PLANNING_REQUIRED')
  }
  let seed
  try {
    seed = await buildLegacySeed({ repository, facilitatorId, learnerId, now })
  } catch {
    throw new SyllabusError("The learner's current plan could not be read safely for Syllabus establishment", 500, 'LEGACY_SEED_UNAVAILABLE')
  }
  if (!seed) throw new SyllabusError("The learner's current plan could not be safely established as a Syllabus", 500, 'LEGACY_SEED_UNAVAILABLE')
  return persistSyllabusActivation({
    repository,
    facilitatorId,
    learnerId,
    snapshot: seed,
    now,
    requireNoActiveRevision: true,
  })
}
