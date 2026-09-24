import { NextResponse } from 'next/server.js'
import { getSyllabusRequestContext } from '../../../lib/syllabus/request.server.mjs'
import { createSyllabusRepository } from '../../../lib/syllabus/supabaseRepository.server.mjs'
import { validateLearnerId, SyllabusError } from '../../../lib/syllabus/schema.mjs'
import { resolveCalendarContext } from '../../../lib/calendarDate.mjs'
import {
  validateCurriculumGuidanceInput,
} from '../../../lib/syllabus/curriculumGuidance.mjs'
import {
  loadCurriculumGuidanceBundle,
} from '../../../lib/syllabus/curriculumGuidance.server.mjs'
import { updateSyllabusPlanDetails } from '../../../lib/syllabus/revisions.server.mjs'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function subjectName(value) {
  return String(typeof value === 'string' ? value : value?.name || '').trim()
}

function optionalUuid(value) {
  const text = String(value || '').trim()
  if (!text) return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
    throw new SyllabusError('Curriculum period id is invalid', 400, 'CURRICULUM_PERIOD_INVALID')
  }
  return text
}

function legacyPreferenceSnapshot(value) {
  if (!value || typeof value !== 'object') return null
  const keep = [
    'focus_topics',
    'focus_concepts',
    'focus_keywords',
    'banned_topics',
    'banned_concepts',
    'banned_words',
    'subject_preferences',
  ]
  const snapshot = {}
  for (const key of keep) {
    if (value[key] !== undefined) snapshot[key] = value[key]
  }
  return Object.keys(snapshot).length ? snapshot : null
}

async function canonicalizeFrameworkRequirements(repository, facilitatorId, requirements = []) {
  const frameworkIds = [...new Set(
    requirements.map((item) => String(item?.framework_item_id || '').trim()).filter(Boolean),
  )]
  if (!frameworkIds.length) return requirements
  if (typeof repository.listCurriculumFrameworkItems !== 'function') {
    throw new SyllabusError('Curriculum framework validation is unavailable.', 503, 'CURRICULUM_FRAMEWORK_UNAVAILABLE')
  }

  const available = await repository.listCurriculumFrameworkItems({ facilitatorId, subjects: [], grade: null })
  const byId = new Map((available || []).map((item) => [String(item.id), item]))

  return requirements.map((requirement) => {
    const frameworkItemId = String(requirement.framework_item_id || '').trim()
    if (!frameworkItemId) return requirement
    const source = byId.get(frameworkItemId)
    if (!source) {
      throw new SyllabusError(
        'A selected curriculum requirement is no longer available from its source.',
        403,
        'CURRICULUM_FRAMEWORK_ITEM_FORBIDDEN',
      )
    }
    const framework = source.framework || {}
    const requirementKey = `framework:${source.id}`
    return {
      ...requirement,
      requirement_key: requirementKey,
      framework_item_id: source.id,
      subject: source.subject,
      statement: source.statement,
      planning_group_key: source.planning_group_key || requirementKey,
      source_kind: 'framework',
      metadata: {
        framework_id: source.framework_id,
        framework_name: framework.name || null,
        source_code: source.code || source.external_id || null,
        source_uri: framework.source_uri || null,
        source_version: framework.version_label || null,
      },
    }
  })
}

async function requestCalendar(context, repository, deps = {}) {
  const now = deps.now || new Date()
  const profileTimeZone = typeof repository.findFacilitatorTimeZone === 'function'
    ? await repository.findFacilitatorTimeZone(context.user.id)
    : null
  return {
    now,
    ...resolveCalendarContext({
      now,
      profileTimeZone,
      fallbackTimeZone: context.user?.user_metadata?.timezone,
    }),
  }
}

async function activeSubjects(repository, facilitatorId, learnerId) {
  const syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus?.active_revision_id) return { syllabus, revision: null, subjects: [] }
  const revision = await repository.findRevision(syllabus.active_revision_id, syllabus.id)
  return {
    syllabus,
    revision,
    subjects: (revision?.subjects || []).map(subjectName).filter(Boolean),
  }
}

async function alignSyllabusContract({
  repository,
  facilitatorId,
  learnerId,
  contractVersionId,
  now,
  today,
}) {
  let syllabus = await repository.findSyllabus(facilitatorId, learnerId)
  if (!syllabus?.active_revision_id) return null

  const perform = (expectedActiveRevisionId) => updateSyllabusPlanDetails({
    repository,
    facilitatorId,
    learnerId,
    expectedActiveRevisionId,
    planDetails: {
      curriculum_contract_version_id: contractVersionId,
      change_reason: 'Facilitator updated Curriculum Guidance',
    },
    now,
    today,
  })

  try {
    return await perform(syllabus.active_revision_id)
  } catch (error) {
    if (error?.code !== 'ACTIVATION_CONFLICT') throw error
    syllabus = await repository.findSyllabus(facilitatorId, learnerId)
    if (!syllabus?.active_revision_id) return null
    return perform(syllabus.active_revision_id)
  }
}

export async function GET(request, deps = {}) {
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })

    const { searchParams } = new URL(request.url)
    const learnerId = validateLearnerId(searchParams.get('learnerId'))
    const periodId = optionalUuid(searchParams.get('periodId'))
    const repository = deps.repository || createSyllabusRepository(context.admin)
    const learner = await repository.findOwnedLearner(learnerId, context.user.id)
    if (!learner) return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    if (periodId) {
      const selectedPeriod = await repository.findCurriculumPeriod(periodId, context.user.id, learnerId)
      if (!selectedPeriod) return NextResponse.json({ error: 'Curriculum period not found' }, { status: 404 })
    }

    const calendar = await requestCalendar(context, repository, deps)
    const planning = await activeSubjects(repository, context.user.id, learnerId)
    const bundle = await loadCurriculumGuidanceBundle({
      repository,
      facilitatorId: context.user.id,
      learnerId,
      learnerGrade: learner.grade || null,
      subjects: planning.subjects,
      today: calendar.today,
      periodId,
      includeRecommendations: true,
    })

    return NextResponse.json({
      ok: true,
      learner: { id: learner.id, name: learner.name || 'Learner', grade: learner.grade || null },
      resolved_today: calendar.today,
      active_syllabus_revision_id: planning.revision?.id || null,
      syllabus_contract_version_id: planning.revision?.curriculum_contract_version_id
        || planning.revision?.planning_policy?.curriculum_contract_version_id
        || null,
      ...bundle,
    })
  } catch (error) {
    const status = error instanceof SyllabusError ? error.status : 500
    return NextResponse.json({ error: error.message || 'Could not load Curriculum Guidance', code: error.code }, { status })
  }
}

export async function POST(request, deps = {}) {
  let createdPeriod = null
  let repository = null
  try {
    const context = await getSyllabusRequestContext(request, deps)
    if (context.error) return NextResponse.json({ error: context.error }, { status: context.status })

    const body = await request.json().catch(() => null)
    const learnerId = validateLearnerId(body?.learnerId)
    const input = validateCurriculumGuidanceInput(body?.guidance || body)
    repository = deps.repository || createSyllabusRepository(context.admin)
    const learner = await repository.findOwnedLearner(learnerId, context.user.id)
    if (!learner) return NextResponse.json({ error: 'Learner not found or unauthorized' }, { status: 403 })
    const requirements = await canonicalizeFrameworkRequirements(repository, context.user.id, input.requirements)
    const calendar = await requestCalendar(context, repository, deps)

    let period
    if (input.period.id) {
      period = await repository.findCurriculumPeriod(input.period.id, context.user.id, learnerId)
      if (!period) return NextResponse.json({ error: 'Curriculum period not found' }, { status: 404 })
      if ((period.active_contract_version_id || null) !== (input.expected_active_version_id || null)) {
        return NextResponse.json({
          error: 'Curriculum Guidance changed. Reload before saving.',
          code: 'CURRICULUM_CONTRACT_CONFLICT',
        }, { status: 409 })
      }
    } else {
      period = await repository.createCurriculumPeriod({
        facilitator_id: context.user.id,
        learner_id: learnerId,
        label: input.period.label,
        period_type: input.period.period_type,
        starts_on: input.period.starts_on,
        ends_on: input.period.ends_on,
        status: 'draft',
      })
      createdPeriod = period
    }

    let migrationProvenance = {}
    if (!period.active_contract_version_id && typeof repository.readLegacyPlanning === 'function') {
      const legacy = await repository.readLegacyPlanning({
        facilitatorId: context.user.id,
        learnerId,
        today: calendar.today,
      })
      const preferences = legacyPreferenceSnapshot(legacy?.curriculumPreferences)
      if (preferences) {
        migrationProvenance = {
          version: 1,
          legacy_curriculum_preferences: preferences,
          note: 'Preserved for audit only. Legacy focus/avoid fields were not silently reinterpreted as requirements.',
        }
      }
    }

    const committed = await repository.commitCurriculumContractSnapshot({
      periodId: period.id,
      facilitatorId: context.user.id,
      learnerId,
      expectedActiveVersionId: period.active_contract_version_id || null,
      label: input.period.label,
      periodType: input.period.period_type,
      startsOn: input.period.starts_on,
      endsOn: input.period.ends_on,
      changeReason: input.change_reason || 'Facilitator updated Curriculum Guidance',
      migrationProvenance,
      items: requirements,
      goals: input.goals,
    })

    const version = committed?.version
    if (!version?.id) throw new Error('Curriculum Guidance persistence returned no active contract version')

    const contractIsCurrent = input.period.starts_on <= calendar.today && calendar.today <= input.period.ends_on
    const syllabusResult = contractIsCurrent
      ? await alignSyllabusContract({
          repository,
          facilitatorId: context.user.id,
          learnerId,
          contractVersionId: version.id,
          now: calendar.now,
          today: calendar.today,
        })
      : null

    const planning = await activeSubjects(repository, context.user.id, learnerId)
    const bundle = await loadCurriculumGuidanceBundle({
      repository,
      facilitatorId: context.user.id,
      learnerId,
      learnerGrade: learner.grade || null,
      subjects: planning.subjects,
      today: calendar.today,
      periodId: period.id,
      includeRecommendations: true,
    })

    return NextResponse.json({
      ok: true,
      curriculum_contract_version_id: version.id,
      active_syllabus_revision_id: syllabusResult?.active_revision?.id || planning.revision?.id || null,
      ...bundle,
    }, { status: 201 })
  } catch (error) {
    if (createdPeriod && repository?.deleteEmptyCurriculumPeriod) {
      await repository.deleteEmptyCurriculumPeriod(createdPeriod.id, createdPeriod.facilitator_id, createdPeriod.learner_id).catch(() => {})
    }
    const status = error?.code === '40001'
      ? 409
      : error instanceof SyllabusError
        ? error.status
        : 500
    return NextResponse.json({
      error: error?.code === '40001'
        ? 'Curriculum Guidance changed. Reload before saving.'
        : (error.message || 'Could not save Curriculum Guidance'),
      code: error?.code === '40001' ? 'CURRICULUM_CONTRACT_CONFLICT' : error.code,
    }, { status })
  }
}
