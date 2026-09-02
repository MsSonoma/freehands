import { createHash } from 'node:crypto'
import { SyllabusError, validateSnapshot } from './schema.mjs'
import { buildLegacySeed } from './legacySeed.server.mjs'
import { applyTeachingGuidanceOverride } from './teachingGuidance.mjs'
import { composeSyllabusLessonTimeline } from './lessonTimeline.mjs'
import { loadSyllabusTimelineInputs } from './lessonTimelineInputs.server.mjs'
import { resolveCalendarContext } from '../calendarDate.mjs'
import { findSnapshotCapacityConflict } from './capacity.mjs'

async function requireOwnedLearner(repository, learnerId, facilitatorId) {
  const learner = await repository.findOwnedLearner(learnerId, facilitatorId)
  if (!learner) throw new SyllabusError('Learner not found or unauthorized', 403, 'FORBIDDEN')
  return learner
}

async function enforceActivationCapacity({ repository, facilitatorId, learnerId, snapshot, allowCapacityException }) {
  if (allowCapacityException) return
  const optionalList = async (name, ...args) => typeof repository[name] === 'function' ? repository[name](...args) : []
  const [schedules, associations] = await Promise.all([
    optionalList('listLessonSchedule', facilitatorId, learnerId, snapshot.effective_from),
    optionalList('listLessonAssociations', facilitatorId, learnerId),
  ])
  const conflict = findSnapshotCapacityConflict(snapshot, { schedules, associations })
  if (conflict) {
    const error = new SyllabusError(conflict.message, 409, 'SYLLABUS_CAPACITY_PIN_REQUIRED')
    error.conflict = conflict.conflict
    throw error
  }
}

function forecastSlotKey(item) {
  return `${String(item?.planned_date || '').slice(0, 10)}:${Number(item?.sort_order) || 0}`
}

function mergeLearningProposalWithActive({ activeItems, proposalItems, today }) {
  const merged = new Map()
  for (const item of activeItems) {
    if (String(item.planned_date).slice(0, 10) >= today) merged.set(String(item.lineage_id), item)
  }
  for (const item of proposalItems) {
    if (String(item.planned_date).slice(0, 10) < today) continue
    const slot = forecastSlotKey(item)
    for (const [lineageId, current] of merged) {
      if (lineageId !== String(item.lineage_id) && forecastSlotKey(current) === slot) merged.delete(lineageId)
    }
    merged.set(String(item.lineage_id), item)
  }
  return [...merged.values()]
}

function carryForwardProposalKey({ sourceProposal, activeRevisionId, items }) {
  const identity = {
    version: 1,
    source_proposal_revision_id: sourceProposal.id,
    source_proposal_key: sourceProposal.proposal_key,
    active_revision_id: activeRevisionId,
    remaining_lineages: items.map((item) => String(item.lineage_id)).sort(),
  }
  return `learning-forecast-rebase-v1:${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`
}

export async function getActiveSyllabus({ repository, admin, facilitatorId, learnerId, now = new Date(), fallbackTimeZone, verifyLessonAccess }) {
  const learner = await requireOwnedLearner(repository, learnerId, facilitatorId)
  const profileTimeZone = typeof repository.findFacilitatorTimeZone === 'function' ? await repository.findFacilitatorTimeZone(facilitatorId) : null
  const calendar = resolveCalendarContext({ now, profileTimeZone, fallbackTimeZone })
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus?.active_revision_id) {
    return { has_active_syllabus: false, syllabus: syllabus || null, active_revision: null, forecast_items: [], resolved_today: calendar.today, resolved_timezone: calendar.timeZone }
  }
  const activeRevision = await repository.findRevision(syllabus.active_revision_id, syllabus.id)
  if (!activeRevision) throw new SyllabusError('The active Syllabus revision could not be found', 500, 'ACTIVE_REVISION_MISSING')
  const { forecastItems, associations, slateAssignments, schedules, sessions, sessionEvents, legacyActivities, lessonMetadata, slateEvidenceReports, slateReviewReports } = await loadSyllabusTimelineInputs({
    repository, admin, facilitatorId, learner, activeRevision, verifyLessonAccess, includeSlateEvidence: true,
  })
  const timelineItems = composeSyllabusLessonTimeline({
    activeRevision,
    forecastItems,
    associations,
    slateAssignments,
    approvedLessons: learner.approved_lessons || {},
    schedules,
    sessions,
    sessionEvents,
    legacyActivities,
    lessonMetadata,
    slateEvidenceReports,
    slateReviewReports,
    today: calendar.today,
    timeZone: calendar.timeZone,
  })
  const proposedRevision = typeof repository.findLatestMasteryProposal === 'function'
    ? await repository.findLatestMasteryProposal(syllabus.id, activeRevision.id)
    : null
  const proposedForecast = proposedRevision ? await repository.listForecastItems(proposedRevision.id) : []
  const learningForecastRevision = typeof repository.findLatestLearningForecastProposal === 'function'
    ? await repository.findLatestLearningForecastProposal(syllabus.id, activeRevision.id)
    : null
  const learningForecastItems = learningForecastRevision ? await repository.listForecastItems(learningForecastRevision.id) : []
  return {
    has_active_syllabus: true,
    syllabus,
    active_revision: activeRevision,
    forecast_items: forecastItems,
    timeline_items: timelineItems,
    proposed_reforecast: proposedRevision ? {
      revision: proposedRevision,
      forecast_items: proposedForecast,
    } : null,
    proposed_learning_forecast: learningForecastRevision ? {
      revision: learningForecastRevision,
      forecast_items: learningForecastItems,
    } : null,
    resolved_today: calendar.today,
    resolved_timezone: calendar.timeZone,
  }
}

export async function activateProposedSyllabus({
  repository,
  facilitatorId,
  learnerId,
  proposalRevisionId,
  expectedActiveRevisionId,
  now = new Date(),
  today = now.toISOString().slice(0, 10),
  allowCapacityException = false,
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
  if (proposal.proposal_kind || proposal.change_reason?.startsWith('Mastery evidence proposal:')) {
    const canonical = proposal.proposal_kind === 'learning_forecast'
      ? await repository.findLatestLearningForecastProposal(syllabus.id, expectedActiveRevisionId)
      : await repository.findLatestMasteryProposal(syllabus.id, expectedActiveRevisionId)
    if (!canonical || canonical.id !== proposal.id) {
      throw new SyllabusError('This Syllabus proposal has been superseded. Review the current proposal instead.', 409, 'PROPOSAL_SUPERSEDED')
    }
  }
  const proposalForecast = await repository.listForecastItems(proposal.id)
  if (proposal.proposal_kind === 'learning_forecast') {
    const activeForecast = await repository.listForecastItems(expectedActiveRevisionId)
    return persistSyllabusActivation({
      repository,
      facilitatorId,
      learnerId,
      snapshot: {
        effective_from: today,
        goals: proposal.goals,
        subjects: proposal.subjects,
        weekly_pattern: proposal.weekly_pattern,
        teaching_guidance: proposal.teaching_guidance,
        planning_policy: proposal.planning_policy,
        legacy_provenance: proposal.legacy_provenance,
        forecast_items: mergeLearningProposalWithActive({ activeItems: activeForecast, proposalItems: proposalForecast, today }),
        change_reason: `Facilitator adopted instructional forecast proposal ${proposal.id}`,
      },
      now,
      today,
      allowCapacityException,
      expectedActiveRevisionId,
    })
  }
  if (String(proposal.effective_from).slice(0, 10) !== today) {
    throw new SyllabusError('This Syllabus proposal was prepared on an earlier date. Create a current proposal before activation.', 409, 'PROPOSAL_STALE')
  }
  await enforceActivationCapacity({
    repository,
    facilitatorId,
    learnerId,
    snapshot: { ...proposal, forecast_items: proposalForecast },
    allowCapacityException,
  })
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

async function persistSyllabusActivation({ repository, facilitatorId, learnerId, snapshot, now, today = now.toISOString().slice(0, 10), requireNoActiveRevision = false, allowCapacityException = false, expectedActiveRevisionId = undefined }) {
  await requireOwnedLearner(repository, learnerId, facilitatorId)
  const planning = validateSnapshot(snapshot, { today })
  await enforceActivationCapacity({ repository, facilitatorId, learnerId, snapshot: planning, allowCapacityException })
  let syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus) syllabus = await repository.createOrFindSyllabus(facilitatorId, learnerId)
  if (expectedActiveRevisionId !== undefined && syllabus.active_revision_id !== expectedActiveRevisionId) {
    throw new SyllabusError('The active Syllabus changed. Reload before saving this revision.', 409, 'ACTIVATION_CONFLICT')
  }
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
        if (expectedActiveRevisionId !== undefined && syllabus?.active_revision_id !== expectedActiveRevisionId) {
          throw new SyllabusError('The active Syllabus changed. Reload before saving this revision.', 409, 'ACTIVATION_CONFLICT')
        }
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

export async function activateSyllabus({ repository, facilitatorId, learnerId, snapshot, now = new Date(), today = now.toISOString().slice(0, 10), allowFutureIntentChanges = true, allowCapacityException = false, expectedActiveRevisionId = undefined }) {
  if (!allowFutureIntentChanges) {
    throw new SyllabusError('Future Syllabus planning requires the current Lesson Planner entitlement', 403, 'SYLLABUS_PLANNING_REQUIRED')
  }
  return persistSyllabusActivation({ repository, facilitatorId, learnerId, snapshot, now, today, allowCapacityException, expectedActiveRevisionId })
}

export async function carryForwardLearningForecastProposal({
  repository,
  facilitatorId,
  learnerId,
  sourceProposalRevisionId,
  acceptedLineageIds = [],
  expectedActiveRevisionId,
  today,
}) {
  await requireOwnedLearner(repository, learnerId, facilitatorId)
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus || syllabus.active_revision_id !== expectedActiveRevisionId) {
    throw new SyllabusError('The active Syllabus changed before the remaining forecast concepts could be carried forward.', 409, 'FORECAST_CARRY_FORWARD_CONFLICT')
  }
  const [activeRevision, sourceProposal] = await Promise.all([
    repository.findRevision(expectedActiveRevisionId, syllabus.id),
    repository.findRevision(sourceProposalRevisionId, syllabus.id),
  ])
  if (!activeRevision) throw new SyllabusError('The active Syllabus revision could not be found', 500, 'ACTIVE_REVISION_MISSING')
  if (!sourceProposal || sourceProposal.activated_at || sourceProposal.proposal_kind !== 'learning_forecast') {
    throw new SyllabusError('The source instructional forecast is unavailable for deterministic carry-forward.', 409, 'FORECAST_CARRY_FORWARD_SOURCE_INVALID')
  }
  const [activeItems, sourceItems] = await Promise.all([
    repository.listForecastItems(activeRevision.id),
    repository.listForecastItems(sourceProposal.id),
  ])
  const accepted = new Set(acceptedLineageIds.map(String))
  const activeLineages = new Set(activeItems.map((item) => String(item.lineage_id)))
  const activeSlots = new Set(activeItems.map(forecastSlotKey))
  const remaining = sourceItems.filter((item) => (
    item.origin === 'learning_forecast'
    && (item.item_type || 'lesson') === 'lesson'
    && !item.lesson_key
    && String(item.planned_date).slice(0, 10) >= today
    && !accepted.has(String(item.lineage_id))
    && !activeLineages.has(String(item.lineage_id))
    && !activeSlots.has(forecastSlotKey(item))
  ))
  if (!remaining.length) {
    return { status: 'exhausted', source_proposal_revision_id: sourceProposal.id, proposal_revision: null, forecast_items: [] }
  }
  const priorRebase = sourceProposal.legacy_provenance?.learning_forecast_rebase
  const provenance = {
    ...(activeRevision.legacy_provenance || {}),
    learning_forecast_rebase: {
      version: 1,
      root_source_proposal_revision_id: priorRebase?.root_source_proposal_revision_id || priorRebase?.source_proposal_revision_id || sourceProposal.id,
      root_source_proposal_key: priorRebase?.root_source_proposal_key || priorRebase?.source_proposal_key || sourceProposal.proposal_key,
      source_proposal_revision_id: sourceProposal.id,
      source_proposal_key: sourceProposal.proposal_key,
      source_base_revision_id: sourceProposal.base_revision_id,
      rebased_onto_revision_id: activeRevision.id,
      accepted_lineage_ids: [...accepted].sort(),
    },
  }
  const planning = validateSnapshot({
    effective_from: today,
    goals: activeRevision.goals,
    subjects: activeRevision.subjects,
    weekly_pattern: activeRevision.weekly_pattern,
    teaching_guidance: activeRevision.teaching_guidance,
    planning_policy: activeRevision.planning_policy,
    legacy_provenance: provenance,
    forecast_items: remaining,
    change_reason: `Carried forward unaccepted concepts from learning forecast proposal ${sourceProposal.id}`,
  }, { today })
  let result
  try {
    const persistCarryForward = repository.createLearningForecastCarryForwardProposal
      || repository.replaceLearningForecastProposal
    result = await persistCarryForward.call(repository, {
      syllabusId: syllabus.id,
      expectedActiveRevisionId: activeRevision.id,
      planning,
      proposalKey: carryForwardProposalKey({ sourceProposal, activeRevisionId: activeRevision.id, items: planning.forecast_items }),
    })
  } catch (error) {
    if (error.code === '40001') {
      throw new SyllabusError('The active Syllabus changed before the remaining forecast concepts could be carried forward.', 409, 'FORECAST_CARRY_FORWARD_CONFLICT')
    }
    throw error
  }
  const current = await repository.findSyllabus(facilitatorId, learnerId)
  if (current?.active_revision_id !== activeRevision.id) {
    throw new SyllabusError('The active Syllabus changed before the remaining forecast concepts could be carried forward.', 409, 'FORECAST_CARRY_FORWARD_CONFLICT')
  }
  return {
    status: result?.reused === true ? 'reused' : 'created',
    source_proposal_revision_id: sourceProposal.id,
    proposal_revision: result?.revision || null,
    forecast_items: result?.revision?.id ? await repository.listForecastItems(result.revision.id) : [],
  }
}

export async function adoptLearningForecastLineage({
  repository,
  facilitatorId,
  learnerId,
  proposalRevisionId,
  lineageId,
  expectedActiveRevisionId,
  now = new Date(),
  today = now.toISOString().slice(0, 10),
  allowCapacityException = false,
  carryForward = true,
}) {
  await requireOwnedLearner(repository, learnerId, facilitatorId)
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus || syllabus.active_revision_id !== expectedActiveRevisionId) {
    throw new SyllabusError('The active Syllabus changed before this forecast concept could be adopted.', 409, 'ACTIVATION_CONFLICT')
  }
  const [activeRevision, proposal] = await Promise.all([
    repository.findRevision(expectedActiveRevisionId, syllabus.id),
    repository.findRevision(proposalRevisionId, syllabus.id),
  ])
  if (!activeRevision) throw new SyllabusError('The active Syllabus revision could not be found', 500, 'ACTIVE_REVISION_MISSING')
  if (!proposal || proposal.activated_at || proposal.proposal_kind !== 'learning_forecast' || proposal.base_revision_id !== expectedActiveRevisionId) {
    throw new SyllabusError('This instructional forecast proposal is no longer current.', 409, 'FORECAST_PROPOSAL_STALE')
  }
  const canonical = await repository.findLatestLearningForecastProposal(syllabus.id, expectedActiveRevisionId)
  if (!canonical || canonical.id !== proposal.id) {
    throw new SyllabusError('This instructional forecast proposal has been superseded.', 409, 'PROPOSAL_SUPERSEDED')
  }
  const [activeItems, proposalItems] = await Promise.all([
    repository.listForecastItems(activeRevision.id),
    repository.listForecastItems(proposal.id),
  ])
  const matches = proposalItems.filter((item) => String(item?.lineage_id || '') === String(lineageId || ''))
  if (matches.length !== 1 || matches[0].origin !== 'learning_forecast' || (matches[0].item_type || 'lesson') !== 'lesson' || matches[0].lesson_key) {
    throw new SyllabusError('Instructional forecast occurrence not found or ineligible.', 409, 'FORECAST_PROPOSAL_STALE')
  }
  const selected = matches[0]
  if (String(selected.planned_date).slice(0, 10) < today) {
    throw new SyllabusError('This forecast concept is now in the past. Create a current forecast before adopting it.', 409, 'FORECAST_PROPOSAL_STALE')
  }
  const nextItems = activeItems
    .filter((item) => String(item.planned_date).slice(0, 10) >= today && String(item.lineage_id) !== String(lineageId))
  nextItems.push(selected)
  const adopted = await persistSyllabusActivation({
    repository,
    facilitatorId,
    learnerId,
    snapshot: {
      effective_from: today,
      goals: activeRevision.goals,
      subjects: activeRevision.subjects,
      weekly_pattern: activeRevision.weekly_pattern,
      teaching_guidance: activeRevision.teaching_guidance,
      planning_policy: activeRevision.planning_policy,
      legacy_provenance: {
        ...(activeRevision.legacy_provenance || {}),
        learning_forecast_adoption: {
          version: 1,
          source_proposal_revision_id: proposal.id,
          source_proposal_key: proposal.proposal_key,
          accepted_lineage_id: String(lineageId),
        },
      },
      forecast_items: nextItems,
      change_reason: `Facilitator adopted learning forecast lineage ${lineageId}`,
    },
    now,
    today,
    allowCapacityException,
    expectedActiveRevisionId,
  })
  if (!carryForward) return { ...adopted, carry_forward: { status: 'deferred', source_proposal_revision_id: proposal.id } }
  try {
    const carry = await carryForwardLearningForecastProposal({
      repository,
      facilitatorId,
      learnerId,
      sourceProposalRevisionId: proposal.id,
      acceptedLineageIds: [lineageId],
      expectedActiveRevisionId: adopted.active_revision.id,
      today,
    })
    return { ...adopted, carry_forward: carry }
  } catch (error) {
    return {
      ...adopted,
      carry_forward: {
        status: 'failed',
        source_proposal_revision_id: proposal.id,
        code: error?.code || 'FORECAST_CARRY_FORWARD_FAILED',
      },
    }
  }
}

export async function bindMaterializedForecast({
  repository,
  facilitatorId,
  learnerId,
  lineageId,
  lessonKey,
  expectedActiveRevisionId,
  now = new Date(),
  today = now.toISOString().slice(0, 10),
}) {
  await requireOwnedLearner(repository, learnerId, facilitatorId)
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus || syllabus.active_revision_id !== expectedActiveRevisionId) {
    throw new SyllabusError('The active Syllabus changed before the generated lesson could be bound.', 409, 'MATERIALIZATION_BINDING_CONFLICT')
  }
  const activeRevision = await repository.findRevision(expectedActiveRevisionId, syllabus.id)
  if (!activeRevision) throw new SyllabusError('The active Syllabus revision could not be found', 500, 'ACTIVE_REVISION_MISSING')
  const forecastItems = await repository.listForecastItems(activeRevision.id)
  const matches = forecastItems.filter((item) => String(item?.lineage_id || '') === String(lineageId || ''))
  if (matches.length !== 1 || !['learning_forecast', 'facilitator'].includes(matches[0].origin) || (matches[0].item_type || 'lesson') !== 'lesson') {
    throw new SyllabusError('Forecast occurrence not found or ambiguous', 404, 'FORECAST_OCCURRENCE_NOT_FOUND')
  }
  if (matches[0].lesson_key && matches[0].lesson_key !== lessonKey) {
    throw new SyllabusError('This forecast occurrence is already materialized as another lesson.', 409, 'FORECAST_ALREADY_MATERIALIZED')
  }
  if (matches[0].lesson_key === lessonKey) {
    return { syllabus, active_revision: activeRevision, forecast_items: forecastItems, reused: true }
  }
  const nextItems = forecastItems.map((item) => String(item.lineage_id) === String(lineageId)
    ? { ...item, lesson_key: lessonKey }
    : item)
  return persistSyllabusActivation({
    repository,
    facilitatorId,
    learnerId,
    snapshot: {
      effective_from: today,
      goals: activeRevision.goals,
      subjects: activeRevision.subjects,
      weekly_pattern: activeRevision.weekly_pattern,
      teaching_guidance: activeRevision.teaching_guidance,
      planning_policy: activeRevision.planning_policy,
      legacy_provenance: activeRevision.legacy_provenance,
      forecast_items: nextItems.filter((item) => String(item.planned_date).slice(0, 10) >= today),
      change_reason: `Materialized forecast lineage ${lineageId}`,
    },
    now,
    today,
    expectedActiveRevisionId,
  })
}

export async function establishSyllabusFromLegacyPlan({ repository, facilitatorId, learnerId, teachingGuidanceOverride, now = new Date(), today = now.toISOString().slice(0, 10), allowCapacityException = false }) {
  await requireOwnedLearner(repository, learnerId, facilitatorId)
  const existing = await repository.findSyllabus(facilitatorId, learnerId)
  if (existing?.active_revision_id) {
    throw new SyllabusError('This learner already has an active Syllabus', 403, 'SYLLABUS_PLANNING_REQUIRED')
  }
  let seed
  try {
    seed = await buildLegacySeed({ repository, facilitatorId, learnerId, now, today })
  } catch {
    throw new SyllabusError("The learner's current plan could not be read safely for Syllabus establishment", 500, 'LEGACY_SEED_UNAVAILABLE')
  }
  if (!seed) throw new SyllabusError("The learner's current plan could not be safely established as a Syllabus", 500, 'LEGACY_SEED_UNAVAILABLE')
  if (teachingGuidanceOverride !== undefined) {
    seed.teaching_guidance = applyTeachingGuidanceOverride(seed.teaching_guidance, teachingGuidanceOverride)
  }
  return persistSyllabusActivation({
    repository,
    facilitatorId,
    learnerId,
    snapshot: seed,
    now,
    today,
    requireNoActiveRevision: true,
    allowCapacityException,
  })
}
