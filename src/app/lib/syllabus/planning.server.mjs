import { createHash, randomUUID } from 'node:crypto'
import { loadRecentMasteryReports } from './masteryReports.server.mjs'
import { subjectBalancedInstructionalEvidenceContext } from './evidenceProjection.mjs'
import { buildSubjectBreadthContext, forecastPlanningMetadata } from './learningBreadth.mjs'
import { canonicalSlotFor, canonicalSlotsForDate, syllabusSlotKey } from './planning.mjs'
import { noSchoolDateSet } from './noSchoolDates.mjs'
import { activateSyllabus, carryForwardLearningForecastProposal } from './revisions.server.mjs'
import { isCalendarDate, SyllabusError, validateSnapshot } from './schema.mjs'

function clean(value, max) { return String(value || '').trim().slice(0, max) }
function clone(value) { return structuredClone(value) }
function futureItems(items, today) { return items.filter((item) => String(item.planned_date).slice(0, 10) >= today) }

async function currentPlanning({ repository, facilitatorId, learnerId, expectedActiveRevisionId }) {
  const learner = await repository.findOwnedLearner(learnerId, facilitatorId)
  if (!learner) throw new SyllabusError('Learner not found or unauthorized', 403, 'FORBIDDEN')
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus || syllabus.active_revision_id !== expectedActiveRevisionId) {
    throw new SyllabusError('The active Syllabus changed. Reload before changing future intent.', 409, 'ACTIVATION_CONFLICT')
  }
  const revision = await repository.findRevision(expectedActiveRevisionId, syllabus.id)
  if (!revision) throw new SyllabusError('The active Syllabus revision could not be found', 500, 'ACTIVE_REVISION_MISSING')
  return { learner, syllabus, revision, items: await repository.listForecastItems(revision.id) }
}

function snapshot(revision, items, today, reason, provenance = {}) {
  return {
    effective_from: today,
    goals: clone(revision.goals), subjects: clone(revision.subjects), weekly_pattern: clone(revision.weekly_pattern),
    teaching_guidance: clone(revision.teaching_guidance), planning_policy: clone(revision.planning_policy),
    legacy_provenance: { ...clone(revision.legacy_provenance), ...provenance },
    forecast_items: futureItems(items, today), change_reason: reason,
  }
}

async function assertInstructionalDateOpen(repository, facilitatorId, learnerId, date) {
  if (typeof repository.listNoSchoolDates !== 'function') return
  const blocked = noSchoolDateSet(await repository.listNoSchoolDates(facilitatorId, learnerId, date, date))
  if (blocked.has(date)) throw new SyllabusError('Remove the day-off or holiday mark before adding instructional work to this date.', 409, 'NO_SCHOOL_DATE')
}

function conceptFields(input) {
  const title = clean(input?.title, 300)
  const description = clean(input?.description, 2000)
  if (!title || !description) throw new SyllabusError('A title and brief description are required.', 400, 'INVALID_CONCEPT')
  return { title, description }
}

function facilitatorGenerationSpec(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {}
  const out = {}
  const difficulty = clean(input.difficulty, 80).toLowerCase()
  const notes = clean(input.notes, 2000)
  const vocab = clean(input.vocab, 1000)
  if (difficulty) out.difficulty = difficulty
  if (notes) out.notes = notes
  if (vocab) out.vocab = vocab
  return out
}
function planningGenerationContext({ current, slots, reports, forecastItems, syllabusExtra = {}, today = null }) {
  const subjects = slots.map((slot) => slot.subject)
  return {
    learner: { grade: current.learner.grade || null },
    syllabus: {
      goals: current.revision.goals,
      subjects: current.revision.subjects,
      teaching_guidance: current.revision.teaching_guidance,
      planning_policy: current.revision.planning_policy,
      ...syllabusExtra,
    },
    evidence_summaries: subjectBalancedInstructionalEvidenceContext(reports, subjects, { perSubjectLimit: 8 }),
    subject_breadth: buildSubjectBreadthContext({
      learnerGrade: current.learner.grade || null,
      slots,
      reports,
      forecastItems,
      today,
      perSubjectEvidenceLimit: 8,
    }),
  }
}

export async function createFacilitatorConcept({ repository, facilitatorId, learnerId, expectedActiveRevisionId, plannedDate, sortOrder, title, description, now = new Date(), today = now.toISOString().slice(0, 10) }) {
  const current = await currentPlanning({ repository, facilitatorId, learnerId, expectedActiveRevisionId })
  const slot = canonicalSlotFor({ weeklyPattern: current.revision.weekly_pattern, plannedDate, sortOrder })
  if (slot) await assertInstructionalDateOpen(repository, facilitatorId, learnerId, slot.planned_date)
  if (!slot || slot.planned_date < today) throw new SyllabusError('This is not an available future weekly-pattern slot.', 409, 'PLANNING_SLOT_INVALID')
  if (current.items.some((item) => syllabusSlotKey(item) === syllabusSlotKey(slot))) throw new SyllabusError('This Syllabus slot already contains educational intent.', 409, 'PLANNING_SLOT_OCCUPIED')
  const fields = conceptFields({ title, description })
  const lineageId = randomUUID()
  const item = { ...slot, ...fields, lineage_id: lineageId, lesson_key: null, item_type: 'lesson', origin: 'facilitator', metadata: { facilitator_planning: { version: 1, action: 'created', active_revision_id: current.revision.id } } }
  return activateSyllabus({ repository, facilitatorId, learnerId, expectedActiveRevisionId, now, today, snapshot: snapshot(current.revision, [...current.items, item], today, `Facilitator created concept ${lineageId}`) })
}

export async function createFacilitatorDayConcept({ repository, facilitatorId, learnerId, expectedActiveRevisionId, plannedDate, subject, title, description, generationSpec = null, allowCapacityException = false, now = new Date(), today = now.toISOString().slice(0, 10) }) {
  const current = await currentPlanning({ repository, facilitatorId, learnerId, expectedActiveRevisionId })
  const date = clean(plannedDate, 10)
  const requestedSubject = clean(subject, 200)
  if (!isCalendarDate(date) || date < today) throw new SyllabusError('Choose a current or future calendar date.', 400, 'PLANNING_DATE_INVALID')
  const declared = (current.revision.subjects || []).map((entry) => clean(typeof entry === 'string' ? entry : entry?.name, 200)).filter(Boolean)
  const canonicalSubject = declared.find((name) => name.toLocaleLowerCase() === requestedSubject.toLocaleLowerCase())
  if (!canonicalSubject) throw new SyllabusError('Choose a subject already declared in this Syllabus.', 400, 'PLANNING_SUBJECT_INVALID')
  await assertInstructionalDateOpen(repository, facilitatorId, learnerId, date)

  const occupied = new Set(current.items.filter((item) => String(item?.planned_date || '').slice(0, 10) === date).map((item) => Number(item?.sort_order || 0)))
  const normalSlots = canonicalSlotsForDate(current.revision.weekly_pattern, date)
  const openMatching = normalSlots.find((slot) => slot.subject.toLocaleLowerCase() === canonicalSubject.toLocaleLowerCase() && !occupied.has(slot.sort_order))
  let slot = openMatching
  if (!slot) {
    if (!allowCapacityException) {
      const error = new SyllabusError(canonicalSubject + ' has no open normal Syllabus slot on ' + date + '. Enter the Facilitator PIN to add it as an exception.', 409, 'SYLLABUS_CAPACITY_PIN_REQUIRED')
      error.conflict = normalSlots.length ? 'subject_capacity' : 'no_capacity'
      throw error
    }
    const used = [...normalSlots.map((entry) => Number(entry.sort_order || 0)), ...occupied]
    const sortOrder = used.length ? Math.max(...used) + 1 : 0
    slot = { planned_date: date, subject: canonicalSubject, sort_order: sortOrder }
  }
  const fields = conceptFields({ title, description })
  const lineageId = randomUUID()
  const item = { ...slot, ...fields, lineage_id: lineageId, lesson_key: null, item_type: 'lesson', origin: 'facilitator', metadata: { facilitator_planning: { version: 1, action: 'created_day', active_revision_id: current.revision.id, generation_spec: facilitatorGenerationSpec(generationSpec) } } }
  const activated = await activateSyllabus({ repository, facilitatorId, learnerId, expectedActiveRevisionId, now, today, allowCapacityException, snapshot: snapshot(current.revision, [...current.items, item], today, 'Facilitator created day lesson concept ' + lineageId) })
  return { ...activated, created_lineage_id: lineageId }
}

export async function editFacilitatorConcept({ repository, facilitatorId, learnerId, expectedActiveRevisionId, lineageId, title, description, now = new Date(), today = now.toISOString().slice(0, 10) }) {
  const current = await currentPlanning({ repository, facilitatorId, learnerId, expectedActiveRevisionId })
  const matches = current.items.filter((item) => String(item.lineage_id) === String(lineageId))
  if (matches.length !== 1 || matches[0].lesson_key || String(matches[0].planned_date).slice(0, 10) < today) throw new SyllabusError('This concept is unavailable for editing.', 409, 'CONCEPT_NOT_EDITABLE')
  const fields = conceptFields({ title, description })
  const original = matches[0]
  const edited = { ...original, ...fields, origin: 'facilitator', metadata: { ...(original.metadata || {}), facilitator_planning: { version: 1, action: 'edited', prior_origin: original.origin, active_revision_id: current.revision.id } } }
  return activateSyllabus({ repository, facilitatorId, learnerId, expectedActiveRevisionId, now, today, snapshot: snapshot(current.revision, current.items.map((item) => String(item.lineage_id) === String(lineageId) ? edited : item), today, `Facilitator edited concept ${lineageId}`) })
}

export async function removeFacilitatorConcept({ repository, facilitatorId, learnerId, expectedActiveRevisionId, lineageId, now = new Date(), today = now.toISOString().slice(0, 10) }) {
  const current = await currentPlanning({ repository, facilitatorId, learnerId, expectedActiveRevisionId })
  const matches = current.items.filter((item) => String(item.lineage_id) === String(lineageId))
  if (matches.length !== 1 || matches[0].lesson_key || String(matches[0].planned_date).slice(0, 10) < today) throw new SyllabusError('Materialized or historical intent cannot be removed here.', 409, 'CONCEPT_NOT_REMOVABLE')
  return activateSyllabus({ repository, facilitatorId, learnerId, expectedActiveRevisionId, now, today, snapshot: snapshot(current.revision, current.items.filter((item) => String(item.lineage_id) !== String(lineageId)), today, `Facilitator removed concept ${lineageId}`) })
}

export async function editLearningForecastConcept({ repository, facilitatorId, learnerId, expectedActiveRevisionId, proposalRevisionId, lineageId, title, description, now = new Date(), today = now.toISOString().slice(0, 10) }) {
  const current = await currentPlanning({ repository, facilitatorId, learnerId, expectedActiveRevisionId })
  const proposal = await repository.findRevision(proposalRevisionId, current.syllabus.id)
  const canonical = await repository.findLatestLearningForecastProposal(current.syllabus.id, current.revision.id)
  if (!proposal || proposal.id !== canonical?.id || proposal.base_revision_id !== current.revision.id || proposal.activated_at) throw new SyllabusError('This instructional forecast is no longer current.', 409, 'FORECAST_PROPOSAL_STALE')
  const proposalItems = await repository.listForecastItems(proposal.id)
  const matches = proposalItems.filter((item) => String(item.lineage_id) === String(lineageId) && item.origin === 'learning_forecast' && !item.lesson_key)
  if (matches.length !== 1) throw new SyllabusError('This forecast concept is unavailable for editing.', 409, 'FORECAST_PROPOSAL_STALE')
  const fields = conceptFields({ title, description })
  const original = matches[0]
  const edited = { ...original, ...fields, origin: 'facilitator', metadata: { ...(original.metadata || {}), facilitator_planning: { version: 1, action: 'edited_forecast', source_proposal_revision_id: proposal.id } } }
  const activated = await activateSyllabus({
    repository, facilitatorId, learnerId, expectedActiveRevisionId, now, today,
    snapshot: snapshot(current.revision, [...current.items.filter((item) => syllabusSlotKey(item) !== syllabusSlotKey(original)), edited], today, `Facilitator edited forecast concept ${lineageId}`, {
      learning_forecast_adoption: { version: 1, source_proposal_revision_id: proposal.id, source_proposal_key: proposal.proposal_key, accepted_lineage_id: String(lineageId), educator_modified: true },
    }),
  })
  try {
    const carry = await carryForwardLearningForecastProposal({ repository, facilitatorId, learnerId, sourceProposalRevisionId: proposal.id, acceptedLineageIds: [lineageId], expectedActiveRevisionId: activated.active_revision.id, today })
    return { ...activated, carry_forward: carry }
  } catch (error) {
    return { ...activated, carry_forward: { status: 'failed', source_proposal_revision_id: proposal.id, code: error?.code || 'FORECAST_CARRY_FORWARD_FAILED' } }
  }
}

export async function replaceLearningForecastConcept({ repository, facilitatorId, learnerId, expectedActiveRevisionId, proposalRevisionId, lineageId, changeRequest = '', generateItems, reports, loadReports = loadRecentMasteryReports, resolveLesson, now = new Date(), today = now.toISOString().slice(0, 10) }) {
  const current = await currentPlanning({ repository, facilitatorId, learnerId, expectedActiveRevisionId })
  const proposal = await repository.findRevision(proposalRevisionId, current.syllabus.id)
  const canonical = await repository.findLatestLearningForecastProposal(current.syllabus.id, current.revision.id)
  if (!proposal || proposal.id !== canonical?.id || proposal.activated_at) throw new SyllabusError('This instructional forecast is no longer current.', 409, 'FORECAST_PROPOSAL_STALE')
  const proposalItems = await repository.listForecastItems(proposal.id)
  const matches = proposalItems.filter((item) => String(item.lineage_id) === String(lineageId) && item.origin === 'learning_forecast' && !item.lesson_key)
  if (matches.length !== 1) throw new SyllabusError('Only an exact provisional forecast concept can be replaced.', 409, 'FORECAST_PROPOSAL_STALE')
  const selected = matches[0]
  const requestedChange = clean(changeRequest, 2000)
  const authorizedReports = reports || await loadReports({ repository, facilitatorId, learnerId, resolveLesson })
  const replacementSlots = [{ planned_date: selected.planned_date, subject: selected.subject, sort_order: selected.sort_order }]
  let generated
  try {
    generated = (await generateItems({
      slots: replacementSlots,
      context: planningGenerationContext({
        current,
        slots: replacementSlots,
        reports: authorizedReports,
        forecastItems: proposalItems,
        today,
        syllabusExtra: {
          already_planned_concepts: proposalItems.map(({ planned_date, subject, title, metadata }) => ({ planned_date, subject, title, ...(metadata?.learning_forecast?.strand ? { strand: metadata.learning_forecast.strand } : {}) })),
          current_forecast: { title: selected.title, description: selected.description || '', ...(selected.metadata?.learning_forecast?.strand ? { strand: selected.metadata.learning_forecast.strand } : {}) },
          facilitator_change_request: requestedChange || null,
          replacement_mode: requestedChange ? 'facilitator_directed' : 'fresh_alternative',
        },
      }),
    }))[0]
  } catch { throw new SyllabusError('A replacement idea could not be generated. The current forecast was preserved.', 502, 'FORECAST_REPLACEMENT_FAILED') }
  const fields = conceptFields(generated)
  const planningMetadata = forecastPlanningMetadata(generated)
  const replacement = {
    ...selected,
    ...fields,
    metadata: {
      ...(selected.metadata || {}),
      learning_forecast: { ...(selected.metadata?.learning_forecast || {}), ...planningMetadata },
      learning_forecast_replacement: { version: 1, source_proposal_revision_id: proposal.id, facilitator_change_request: requestedChange || null },
    },
  }
  const planning = validateSnapshot(snapshot(current.revision, proposalItems.map((item) => String(item.lineage_id) === String(lineageId) ? replacement : item), today, `Replaced instructional forecast concept ${lineageId}`), { today, allowLegacyOrigins: true })
  const proposalKey = `learning-forecast-replace-v2:${createHash('sha256').update(JSON.stringify({ source: proposal.id, lineageId, title: fields.title, description: fields.description, planning: planningMetadata, facilitator_change_request: requestedChange || null })).digest('hex')}`
  const result = await repository.replaceLearningForecastProposal({ syllabusId: current.syllabus.id, expectedActiveRevisionId, planning, proposalKey })
  return { kind: 'proposal', reused: result.reused === true, active_revision_id: expectedActiveRevisionId, proposal_revision: result.revision, forecast_items: await repository.listForecastItems(result.revision.id) }
}

export async function suggestPlanAheadConcepts({ repository, facilitatorId, learnerId, expectedActiveRevisionId, slots, generateItems, reports, loadReports = loadRecentMasteryReports, resolveLesson }) {
  const current = await currentPlanning({ repository, facilitatorId, learnerId, expectedActiveRevisionId })
  const requested = (Array.isArray(slots) ? slots : []).slice(0, 28).map((slot) => canonicalSlotFor({ weeklyPattern: current.revision.weekly_pattern, plannedDate: slot.planned_date, sortOrder: slot.sort_order })).filter(Boolean)
  if (!requested.length) throw new SyllabusError('Select at least one valid Plan Ahead slot.', 400, 'PLANNING_SLOT_INVALID')
  if (typeof repository.listNoSchoolDates === 'function') {
    const dates = requested.map((slot) => slot.planned_date).sort()
    const blocked = noSchoolDateSet(await repository.listNoSchoolDates(facilitatorId, learnerId, dates[0], dates.at(-1)))
    if (requested.some((slot) => blocked.has(slot.planned_date))) throw new SyllabusError('A selected Plan Ahead date is marked as a day off or holiday.', 409, 'NO_SCHOOL_DATE')
  }
  const authorizedReports = reports || await loadReports({ repository, facilitatorId, learnerId, resolveLesson })
  const generated = await generateItems({
    slots: requested,
    context: planningGenerationContext({
      current,
      slots: requested,
      reports: authorizedReports,
      forecastItems: current.items,
      syllabusExtra: {
        weekly_pattern: current.revision.weekly_pattern,
        already_planned_concepts: current.items.map(({ planned_date, subject, title, metadata }) => ({ planned_date, subject, title, ...(metadata?.learning_forecast?.strand ? { strand: metadata.learning_forecast.strand } : {}) })),
        planning_boundary: 'Intended instructional progression only; do not assume future completion or future mastery.',
      },
    }),
  })
  return {
    suggestions: requested.map((slot, index) => ({
      ...slot,
      ...conceptFields(generated[index]),
      planning: forecastPlanningMetadata(generated[index]),
      provisional: true,
    })),
  }
}
