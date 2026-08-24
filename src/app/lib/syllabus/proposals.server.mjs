import { buildMasteryReforecast, describeMasteryProposal } from './reforecast.mjs'
import { SyllabusError, validateSnapshot } from './schema.mjs'

async function requireOwnedLearner(repository, learnerId, facilitatorId) {
  const learner = await repository.findOwnedLearner(learnerId, facilitatorId)
  if (!learner) throw new SyllabusError('Learner not found or unauthorized', 403, 'FORBIDDEN')
  return learner
}

async function activeState(repository, facilitatorId, learnerId) {
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus?.active_revision_id) {
    throw new SyllabusError('An active Syllabus is required before checking mastery evidence', 409, 'ACTIVE_SYLLABUS_REQUIRED')
  }
  const revision = await repository.findRevision(syllabus.active_revision_id, syllabus.id)
  if (!revision) throw new SyllabusError('The active Syllabus revision could not be found', 500, 'ACTIVE_REVISION_MISSING')
  return { syllabus, revision, forecastItems: await repository.listForecastItems(revision.id) }
}

function conflict() {
  return new SyllabusError(
    'The active Syllabus changed while mastery evidence was being reviewed. Reload and check again.',
    409,
    'REFORECAST_CONFLICT',
  )
}

export async function createMasteryReforecastProposal({
  repository,
  facilitatorId,
  learnerId,
  expectedActiveRevisionId,
  reports,
  now = new Date(),
}) {
  await requireOwnedLearner(repository, learnerId, facilitatorId)
  const { syllabus, revision: activeRevision, forecastItems } = await activeState(repository, facilitatorId, learnerId)
  if (!expectedActiveRevisionId || syllabus.active_revision_id !== expectedActiveRevisionId) throw conflict()

  const today = now.toISOString().slice(0, 10)
  const reforecast = buildMasteryReforecast({ activeRevision, forecastItems, reports, today })
  if (!reforecast || reforecast.kind === 'no_action') {
    return {
      kind: 'no_action',
      active_revision_id: activeRevision.id,
      message: reforecast?.reason || 'Current mastery reporting does not support a meaningful Syllabus change.',
    }
  }
  const planning = validateSnapshot(reforecast.snapshot, { today })
  let result = null
  try {
    result = await repository.replaceMasteryProposal({
      syllabusId: syllabus.id,
      expectedActiveRevisionId: activeRevision.id,
      planning,
      proposalKey: reforecast.proposal_key,
    })
    const current = await repository.findSyllabus(facilitatorId, learnerId)
    if (current?.active_revision_id !== activeRevision.id) throw conflict()
  } catch (error) {
    if (error.code === '40001') throw conflict()
    throw error
  }

  const proposal = result?.revision
  if (!proposal?.id) throw new SyllabusError('Mastery reforecast proposal persistence returned no revision', 500, 'PROPOSAL_WRITE_FAILED')
  const savedItems = await repository.listForecastItems(proposal.id)

  return {
    kind: 'proposal',
    reused: result.reused === true,
    active_revision_id: activeRevision.id,
    proposal_revision: proposal,
    forecast_items: savedItems,
    changes: describeMasteryProposal(savedItems),
  }
}
