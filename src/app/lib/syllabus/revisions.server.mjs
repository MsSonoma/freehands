import { SyllabusError, validateSnapshot } from './schema.mjs'

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
  return { has_active_syllabus: true, syllabus, active_revision: activeRevision, forecast_items: forecastItems }
}

export async function activateSyllabus({ repository, facilitatorId, learnerId, snapshot, now = new Date() }) {
  await requireOwnedLearner(repository, learnerId, facilitatorId)
  const activationDate = now.toISOString().slice(0, 10)
  const planning = validateSnapshot(snapshot, { today: activationDate })
  let syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus) syllabus = await repository.createOrFindSyllabus(facilitatorId, learnerId)

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
