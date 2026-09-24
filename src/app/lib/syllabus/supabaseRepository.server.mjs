function normalizeFrameworkGrade(value) {
  const raw = String(value || '').trim().toUpperCase().replace(/^GRADE\s*/i, '').replace(/(?:ST|ND|RD|TH)$/i, '')
  if (!raw) return ''
  if (['K', 'KG', 'KINDERGARTEN'].includes(raw)) return 'K'
  const number = Number.parseInt(raw, 10)
  return Number.isInteger(number) && number >= 1 && number <= 12 ? String(number) : raw.toLocaleLowerCase()
}

function frameworkGradeMatches(itemGrade, learnerGrade) {
  const learner = normalizeFrameworkGrade(learnerGrade)
  if (!learner) return true
  const raw = String(itemGrade || '').trim()
  if (!raw) return true
  const normalized = normalizeFrameworkGrade(raw)
  if (normalized === learner) return true
  const band = raw.toLocaleLowerCase().replace(/[–—]/g, '-').replace(/\s/g, '')
  const range = /^(k|\d+)-(\d+)$/.exec(band)
  if (!range) return false
  const learnerNumber = learner === 'K' ? 0 : Number(learner)
  const start = range[1] === 'k' ? 0 : Number(range[1])
  const end = Number(range[2])
  return Number.isFinite(learnerNumber) && learnerNumber >= start && learnerNumber <= end
}
function throwOn(error, fallback) {
  if (error) {
    const wrapped = new Error(error.message || fallback)
    wrapped.code = error.code
    throw wrapped
  }
}

export async function readAllSupabaseRows(queryFactory, { pageSize = 500 } = {}) {
  const rows = []
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await queryFactory().range(offset, offset + pageSize - 1)
    if (error) throw error
    const page = Array.isArray(data) ? data : []
    rows.push(...page)
    if (page.length < pageSize) return rows
  }
}

export function createSyllabusRepository(admin) {
  return {
    async findFacilitatorTimeZone(facilitatorId) {
      const { data, error } = await admin.from('profiles').select('timezone').eq('id', facilitatorId).maybeSingle()
      throwOn(error, 'Failed to resolve facilitator timezone')
      return data?.timezone || null
    },
    async findOwnedLearner(learnerId, facilitatorId) {
      const { data, error } = await admin.from('learners').select('*').eq('id', learnerId).maybeSingle()
      throwOn(error, 'Failed to load learner')
      if (!data) return null
      const owners = [data.facilitator_id, data.owner_id, data.user_id].filter(Boolean)
      return owners.includes(facilitatorId) ? data : null
    },
    async findSyllabus(facilitatorId, learnerId) {
      const { data, error } = await admin.from('syllabi').select('*').eq('facilitator_id', facilitatorId).eq('learner_id', learnerId).maybeSingle()
      throwOn(error, 'Failed to load Syllabus')
      return data
    },
    async createOrFindSyllabus(facilitatorId, learnerId) {
      const result = await admin.from('syllabi').insert({ facilitator_id: facilitatorId, learner_id: learnerId }).select('*').single()
      if (!result.error) return result.data
      if (result.error.code !== '23505') throwOn(result.error, 'Failed to create Syllabus')
      return this.findSyllabus(facilitatorId, learnerId)
    },
    async findRevision(revisionId, syllabusId) {
      const { data, error } = await admin.from('syllabus_revisions').select('*').eq('id', revisionId).eq('syllabus_id', syllabusId).maybeSingle()
      throwOn(error, 'Failed to load Syllabus revision')
      return data
    },
    async findLatestLearningForecastProposal(syllabusId, baseRevisionId) {
      const { data, error } = await admin.from('syllabus_revisions').select('*')
        .eq('syllabus_id', syllabusId)
        .eq('base_revision_id', baseRevisionId)
        .is('activated_at', null)
        .eq('proposal_kind', 'learning_forecast')
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      throwOn(error, 'Failed to load proposed instructional forecast')
      return data
    },
    async replaceLearningForecastProposal({ syllabusId, expectedActiveRevisionId, planning, proposalKey }) {
      const { data, error } = await admin.rpc('replace_syllabus_proposal', {
        p_syllabus_id: syllabusId,
        p_expected_active_revision_id: expectedActiveRevisionId,
        p_proposal_kind: 'learning_forecast',
        p_effective_from: planning.effective_from,
        p_schema_version: planning.schema_version,
        p_goals: planning.goals,
        p_subjects: planning.subjects,
        p_weekly_pattern: planning.weekly_pattern,
        p_teaching_guidance: planning.teaching_guidance,
        p_planning_policy: planning.planning_policy,
        p_legacy_provenance: planning.legacy_provenance,
        p_change_reason: planning.change_reason,
        p_proposal_key: proposalKey,
        p_forecast_items: planning.forecast_items,
      })
      throwOn(error, 'Failed to replace instructional forecast proposal')
      return data
    },
    async createLearningForecastCarryForwardProposal({ syllabusId, expectedActiveRevisionId, planning, proposalKey }) {
      const { data, error } = await admin.rpc('replace_syllabus_proposal', {
        p_syllabus_id: syllabusId,
        p_expected_active_revision_id: expectedActiveRevisionId,
        p_proposal_kind: 'learning_forecast',
        p_effective_from: planning.effective_from,
        p_schema_version: planning.schema_version,
        p_goals: planning.goals,
        p_subjects: planning.subjects,
        p_weekly_pattern: planning.weekly_pattern,
        p_teaching_guidance: planning.teaching_guidance,
        p_planning_policy: planning.planning_policy,
        p_legacy_provenance: planning.legacy_provenance,
        p_change_reason: planning.change_reason,
        p_proposal_key: proposalKey,
        p_forecast_items: planning.forecast_items,
        p_replace_existing: false,
      })
      throwOn(error, 'Failed to carry forward instructional forecast proposal')
      return data
    },
    async claimForecastMaterialization({ syllabusId, lineageId, generationInputHash }) {
      const { data, error } = await admin.rpc('claim_syllabus_forecast_materialization', {
        p_syllabus_id: syllabusId,
        p_lineage_id: lineageId,
        p_generation_input_hash: generationInputHash,
      })
      throwOn(error, 'Failed to claim forecast materialization')
      return data
    },
    async listForecastMaterializationStates(syllabusId) {
      const { data, error } = await admin.from('syllabus_forecast_materializations')
        .select('lineage_id,status').eq('syllabus_id', syllabusId)
      throwOn(error, 'Failed to read lesson generation states')
      return data || []
    },
    async findForecastMaterialization(syllabusId, lineageId) {
      const { data, error } = await admin.from('syllabus_forecast_materializations')
        .select('*')
        .eq('syllabus_id', syllabusId)
        .eq('lineage_id', lineageId)
        .maybeSingle()
      throwOn(error, 'Failed to inspect forecast materialization recovery')
      return data
    },
    async updateForecastMaterialization(receiptId, values) {
      const { data, error } = await admin.from('syllabus_forecast_materializations')
        .update({ ...values, updated_at: new Date().toISOString() })
        .eq('id', receiptId)
        .select('*')
        .single()
      throwOn(error, 'Failed to update forecast materialization')
      return data
    },
    async nextRevisionNumber(syllabusId) {
      const { data, error } = await admin.from('syllabus_revisions').select('revision_number').eq('syllabus_id', syllabusId).order('revision_number', { ascending: false }).limit(1)
      throwOn(error, 'Failed to determine revision number')
      return (data?.[0]?.revision_number || 0) + 1
    },
    async insertRevision(row) {
      const { data, error } = await admin.from('syllabus_revisions').insert(row).select('*').single()
      throwOn(error, 'Failed to create Syllabus revision')
      return data
    },
    async insertForecastItems(revisionId, items) {
      if (!items.length) return []
      const { data, error } = await admin.from('syllabus_forecast_items').insert(items.map((item) => ({ revision_id: revisionId, ...item }))).select('*')
      throwOn(error, 'Failed to create Syllabus forecast')
      return data
    },
    async commitRevisionActivation({ syllabusId, revisionId, expectedActiveRevisionId }) {
      const { data, error } = await admin.rpc('commit_syllabus_revision_activation', {
        p_syllabus_id: syllabusId,
        p_revision_id: revisionId,
        p_expected_active_revision_id: expectedActiveRevisionId,
      }).single()
      throwOn(error, 'Failed to commit Syllabus revision activation')
      return data
    },
    async deleteInactiveRevision(revisionId) {
      const { error } = await admin.from('syllabus_revisions').delete().eq('id', revisionId).is('activated_at', null)
      throwOn(error, 'Failed to clean up inactive Syllabus revision')
    },
    async listForecastItems(revisionId) {
      const { data, error } = await admin.from('syllabus_forecast_items').select('*').eq('revision_id', revisionId).order('planned_date').order('sort_order').order('created_at')
      throwOn(error, 'Failed to load Syllabus forecast')
      return data || []
    },
    async listNoSchoolDates(facilitatorId, learnerId, fromDate = null, toDate = null) {
      let query = admin.from('no_school_dates').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .order('date')
      if (fromDate) query = query.gte('date', String(fromDate).slice(0, 10))
      if (toDate) query = query.lte('date', String(toDate).slice(0, 10))
      const { data, error } = await query
      throwOn(error, 'Failed to load no-school dates')
      return data || []
    },
    async upsertNoSchoolDate(row) {
      const { data, error } = await admin.from('no_school_dates').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'facilitator_id,learner_id,date' }).select('*').single()
      throwOn(error, 'Failed to save no-school date')
      return data
    },
    async deleteNoSchoolDate(facilitatorId, learnerId, date) {
      const { data, error } = await admin.from('no_school_dates').delete()
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .eq('date', String(date).slice(0, 10))
        .select('id')
        .maybeSingle()
      throwOn(error, 'Failed to remove no-school date')
      return data
    },
    async listLessonAssociations(facilitatorId, learnerId) {
      const { data, error } = await admin.from('syllabus_lesson_associations').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .order('created_at')
      throwOn(error, 'Failed to load learner lesson associations')
      return data || []
    },
    async listSlateAssignments(facilitatorId, learnerId) {
      const { data, error } = await admin.from('syllabus_slate_assignments').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .order('assigned_at')
        .order('id')
      if (error?.code === '42P01') return []
      throwOn(error, 'Failed to load scheduled Mr. Slate sessions')
      return data || []
    },
    async createSlateAssignment(row) {
      const result = await admin.from('syllabus_slate_assignments').insert(row).select('*').single()
      if (!result.error) return result.data
      if (result.error.code !== '23505') throwOn(result.error, 'Failed to schedule Mr. Slate')
      const { data, error } = await admin.from('syllabus_slate_assignments').select('*')
        .eq('facilitator_id', row.facilitator_id)
        .eq('learner_id', row.learner_id)
        .eq('syllabus_occurrence_id', row.syllabus_occurrence_id)
        .eq('scheduled_date', row.scheduled_date)
        .eq('run_purpose', row.run_purpose)
        .maybeSingle()
      throwOn(error, 'Failed to read scheduled Mr. Slate session')
      if (!data) throwOn(result.error, 'Failed to resolve the conflicting scheduled Mr. Slate session')
      return data
    },
    async deleteSlateAssignment(facilitatorId, learnerId, assignmentId) {
      const { data, error } = await admin.from('syllabus_slate_assignments').delete()
        .eq('id', assignmentId)
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .select('id')
        .maybeSingle()
      throwOn(error, 'Failed to remove scheduled Mr. Slate session')
      return data
    },
    async listLegacyActivityRecords(facilitatorId, learnerId) {
      const { data, error } = await admin.from('syllabus_legacy_activity_records').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .order('occurred_at', { ascending: true })
        .order('id', { ascending: true })
      if (error?.code === '42P01') return []
      throwOn(error, 'Failed to load historical Syllabus activity records')
      return data || []
    },
    async insertLegacyActivityRecord(row) {
      const result = await admin.from('syllabus_legacy_activity_records').insert(row).select('*').single()
      if (!result.error) return result.data
      if (result.error.code !== '23505') throwOn(result.error, 'Failed to record historical Syllabus activity')
      const { data, error } = await admin.from('syllabus_legacy_activity_records').select('*')
        .eq('facilitator_id', row.facilitator_id)
        .eq('learner_id', row.learner_id)
        .eq('source_identity', row.source_identity)
        .maybeSingle()
      throwOn(error, 'Failed to read historical Syllabus activity')
      if (data && data.syllabus_occurrence_id !== row.syllabus_occurrence_id) {
        const collision = new Error('This legacy activity was already recorded against a different Syllabus occurrence')
        collision.code = 'HISTORICAL_ACTIVITY_OCCURRENCE_CONFLICT'
        collision.status = 409
        throw collision
      }
      return data
    },
    async findLessonAssociation(facilitatorId, learnerId, lessonKey) {
      const { data, error } = await admin.from('syllabus_lesson_associations').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .eq('lesson_key', lessonKey)
        .maybeSingle()
      throwOn(error, 'Failed to load learner lesson association')
      return data || null
    },
    async listLessonSchedule(facilitatorId, learnerId, effectiveFrom) {
      const { data, error } = await admin.from('lesson_schedule').select('*')
        .eq('learner_id', learnerId)
        .or(`facilitator_id.eq.${facilitatorId},facilitator_id.is.null`)
        .gte('scheduled_date', String(effectiveFrom || '').slice(0, 10))
        .order('scheduled_date')
      throwOn(error, 'Failed to load learner lesson schedule')
      return data || []
    },
    async listAllLessonSessionEvents(learnerId) {
      try {
        return await readAllSupabaseRows(() => admin.from('lesson_session_events')
          .select('id,session_id,lesson_id,event_type,occurred_at,metadata')
          .eq('learner_id', learnerId)
          .order('occurred_at', { ascending: true })
          .order('id', { ascending: true }))
      } catch (error) {
        if (error?.code === '42P01') return []
        throwOn(error, 'Failed to load lesson session events')
      }
    },
    async listAllTrackedSessions(learnerId) {
      try {
        return await readAllSupabaseRows(() => admin.from('lesson_sessions')
          .select('id,session_id,lesson_id,instructional_teacher,started_at,ended_at')
          .eq('learner_id', learnerId)
          .order('started_at', { ascending: true })
          .order('id', { ascending: true }))
      } catch (error) {
        throwOn(error, 'Failed to load learner lesson sessions')
      }
    },
    async listRecentTrackedSessions(learnerId, limit = 25) {
      const { data, error } = await admin.from('lesson_sessions')
        .select('id,session_id,learner_id,lesson_id,instructional_teacher,started_at,ended_at')
        .eq('learner_id', learnerId)
        .order('started_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit)
      throwOn(error, 'Failed to load recent lesson sessions')
      return data || []
    },
    async findWebbCompositionForSession(facilitatorId, learnerId, executionSessionId) {
      if (!executionSessionId) return null
      const { data, error } = await admin.from('webb_compositions').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .eq('execution_session_id', executionSessionId)
        .maybeSingle()
      if (error?.code === '42P01') return null
      throwOn(error, 'Failed to load Mrs. Webb composition')
      return data || null
    },
    async listEvidenceSessions(facilitatorId, learnerId, sessionIds) {
      if (!sessionIds.length) return []
      const { data, error } = await admin.from('learning_evidence_sessions').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .in('session_id', sessionIds)
      throwOn(error, 'Failed to load mastery evidence sessions')
      return data || []
    },
    async listEvidenceEvents(facilitatorId, learnerId, evidenceSessionIds) {
      if (!evidenceSessionIds.length) return []
      const { data, error } = await admin.from('learning_evidence_events').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .in('evidence_session_id', evidenceSessionIds)
        .order('occurred_at', { ascending: true })
        .order('event_sequence', { ascending: true, nullsFirst: false })
      throwOn(error, 'Failed to load mastery evidence events')
      return data || []
    },
    async listAllSlateEvidenceSessions(facilitatorId, learnerId) {
      return readAllSupabaseRows(() => admin.from('learning_evidence_sessions').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .like('session_id', 'slate:%')
        .order('started_at', { ascending: true })
        .order('id', { ascending: true }))
    },
    async listAllLearningReviewRuns(facilitatorId, learnerId) {
      try {
        return await readAllSupabaseRows(() => admin.from('learning_review_runs').select('*')
          .eq('facilitator_id', facilitatorId)
          .eq('learner_id', learnerId)
          .order('started_at', { ascending: true })
          .order('id', { ascending: true }))
      } catch (error) {
        if (error?.code === '42P01') return []
        throwOn(error, 'Failed to load learner review runs')
      }
    },
    async listLearningReviewItems(facilitatorId, learnerId, runIds) {
      if (!runIds.length) return []
      const { data, error } = await admin.from('learning_review_items').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .in('run_id', runIds)
        .order('ordinal', { ascending: true })
      throwOn(error, 'Failed to load learner review items')
      return data || []
    },
    async listLearningReviewEvents(facilitatorId, learnerId, runIds) {
      if (!runIds.length) return []
      const { data, error } = await admin.from('learning_review_events').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .in('run_id', runIds)
        .order('occurred_at', { ascending: true })
        .order('event_id', { ascending: true })
      throwOn(error, 'Failed to load learner review events')
      return data || []
    },
    async findActiveCurriculumPeriod(facilitatorId, learnerId, today) {
      const date = String(today || '').slice(0, 10)
      const { data, error } = await admin.from('curriculum_periods').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .lte('starts_on', date)
        .gte('ends_on', date)
        .eq('status', 'active')
        .order('starts_on', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error?.code === '42P01') return null
      throwOn(error, 'Failed to load active curriculum period')
      return data || null
    },
    async findLatestCurriculumPeriod(facilitatorId, learnerId) {
      const { data, error } = await admin.from('curriculum_periods').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .order('ends_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error?.code === '42P01') return null
      throwOn(error, 'Failed to load curriculum period')
      return data || null
    },
    async findNextCurriculumPeriod(facilitatorId, learnerId, afterDate) {
      const date = String(afterDate || '').slice(0, 10)
      const { data, error } = await admin.from('curriculum_periods').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .gt('starts_on', date)
        .in('status', ['active', 'draft'])
        .order('starts_on', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error?.code === '42P01') return null
      throwOn(error, 'Failed to load upcoming curriculum period')
      return data || null
    },
    async findCurriculumPeriod(periodId, facilitatorId, learnerId) {
      const { data, error } = await admin.from('curriculum_periods').select('*')
        .eq('id', periodId)
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .maybeSingle()
      throwOn(error, 'Failed to load curriculum period')
      return data || null
    },
    async createCurriculumPeriod(row) {
      const { data, error } = await admin.from('curriculum_periods').insert(row).select('*').single()
      throwOn(error, 'Failed to create curriculum period')
      return data
    },
    async deleteEmptyCurriculumPeriod(periodId, facilitatorId, learnerId) {
      const { data: versions, error: versionError } = await admin.from('curriculum_contract_versions')
        .select('id').eq('period_id', periodId).limit(1)
      if (versionError?.code !== '42P01') throwOn(versionError, 'Failed to inspect curriculum period cleanup')
      if (versions?.length) return false
      const { error } = await admin.from('curriculum_periods').delete()
        .eq('id', periodId).eq('facilitator_id', facilitatorId).eq('learner_id', learnerId)
      throwOn(error, 'Failed to clean up curriculum period')
      return true
    },
    async findCurriculumContractVersion(versionId, periodId = null) {
      let query = admin.from('curriculum_contract_versions').select('*').eq('id', versionId)
      if (periodId) query = query.eq('period_id', periodId)
      const { data, error } = await query.maybeSingle()
      throwOn(error, 'Failed to load curriculum contract version')
      return data || null
    },
    async listCurriculumContractItems(versionId) {
      const { data, error } = await admin.from('curriculum_contract_items').select('*')
        .eq('contract_version_id', versionId).order('sort_order').order('created_at')
      throwOn(error, 'Failed to load curriculum requirements')
      return data || []
    },
    async listCurriculumContractGoals(versionId) {
      const { data, error } = await admin.from('curriculum_contract_goals').select('*')
        .eq('contract_version_id', versionId).order('sort_order').order('created_at')
      throwOn(error, 'Failed to load curriculum goals')
      return data || []
    },
    async commitCurriculumContractSnapshot({
      periodId,
      facilitatorId,
      learnerId,
      expectedActiveVersionId,
      label,
      periodType,
      startsOn,
      endsOn,
      changeReason,
      migrationProvenance = {},
      items = [],
      goals = [],
    }) {
      const { data, error } = await admin.rpc('commit_curriculum_contract_snapshot', {
        p_period_id: periodId,
        p_facilitator_id: facilitatorId,
        p_learner_id: learnerId,
        p_expected_active_version_id: expectedActiveVersionId || null,
        p_label: label,
        p_period_type: periodType,
        p_starts_on: startsOn,
        p_ends_on: endsOn,
        p_change_reason: changeReason || null,
        p_migration_provenance: migrationProvenance || {},
        p_items: items || [],
        p_goals: goals || [],
      })
      throwOn(error, 'Failed to save curriculum guidance')
      return data
    },
    async listCurriculumFrameworkItems({ facilitatorId, subjects = [], grade = null } = {}) {
      const { data: frameworks, error: frameworkError } = await admin.from('curriculum_frameworks').select('*')
        .or(`facilitator_id.is.null,facilitator_id.eq.${facilitatorId}`)
        .order('name')
      if (frameworkError?.code === '42P01') return []
      throwOn(frameworkError, 'Failed to load curriculum frameworks')
      const frameworkIds = (frameworks || []).map((row) => row.id)
      if (!frameworkIds.length) return []
      const { data, error } = await admin.from('curriculum_framework_items').select('*')
        .in('framework_id', frameworkIds)
        .order('sort_order')
        .order('created_at')
      throwOn(error, 'Failed to load curriculum framework items')
      const subjectKeys = new Set((subjects || []).map((value) => String(value || '').trim().toLocaleLowerCase()).filter(Boolean))
      return (data || []).filter((item) => {
        const subjectMatches = !subjectKeys.size || subjectKeys.has(String(item.subject || '').trim().toLocaleLowerCase())
        const gradeMatches = frameworkGradeMatches(item.grade_band, grade)
        return subjectMatches && gradeMatches
      }).map((item) => ({
        ...item,
        framework: (frameworks || []).find((framework) => framework.id === item.framework_id) || null,
      }))
    },
    async listCurriculumFrameworkAssociations(frameworkIds = []) {
      if (!frameworkIds.length) return []
      const { data, error } = await admin.from('curriculum_framework_associations').select('*')
        .in('framework_id', frameworkIds)
        .order('created_at')
      throwOn(error, 'Failed to load curriculum framework associations')
      return data || []
    },
    async listLearnerCurriculumState(periodId) {
      const { data, error } = await admin.from('learner_curriculum_state').select('*')
        .eq('period_id', periodId)
      if (error?.code === '42P01') return []
      throwOn(error, 'Failed to load learner curriculum state')
      return data || []
    },
    async upsertLearnerCurriculumState(rows = []) {
      if (!rows.length) return []
      const { data, error } = await admin.from('learner_curriculum_state')
        .upsert(rows, { onConflict: 'period_id,requirement_key' })
        .select('*')
      throwOn(error, 'Failed to update learner curriculum state')
      return data || []
    },
    async listLessonCurriculumTargets(facilitatorId, learnerId, lessonKeys = []) {
      let query = admin.from('lesson_curriculum_targets').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
      if (lessonKeys.length) query = query.in('lesson_key', [...new Set(lessonKeys.filter(Boolean))])
      const { data, error } = await query.order('created_at')
      if (error?.code === '42P01') return []
      throwOn(error, 'Failed to load lesson curriculum targets')
      return data || []
    },
    async listCurriculumPlanningDecisions(facilitatorId, learnerId, limit = 100) {
      const { data, error } = await admin.from('curriculum_planning_decisions').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error?.code === '42P01') return []
      throwOn(error, 'Failed to load curriculum planning decisions')
      return data || []
    },
    async ensureCurriculumReviewNotification({ facilitatorId, learnerId, periodId, title, body, metadata = {} }) {
      const { data: existing, error: readError } = await admin.from('facilitator_notifications').select('id')
        .eq('facilitator_id', facilitatorId)
        .eq('category', 'curriculum-guidance')
        .eq('type', 'curriculum_period_review_due')
        .contains('metadata', { period_id: periodId, learner_id: learnerId })
        .limit(1)
        .maybeSingle()
      if (readError?.code === '42P01') return null
      throwOn(readError, 'Failed to inspect curriculum review notification')
      if (existing?.id) return existing
      const { data, error } = await admin.from('facilitator_notifications').insert({
        facilitator_id: facilitatorId,
        category: 'curriculum-guidance',
        type: 'curriculum_period_review_due',
        title,
        body,
        metadata: { ...metadata, period_id: periodId, learner_id: learnerId },
      }).select('*').single()
      throwOn(error, 'Failed to create curriculum review notification')
      return data
    },
    async readLegacyPlanning({ facilitatorId, learnerId, today }) {
      const [templates, preferences, lessons, subjects] = await Promise.all([
        admin.from('schedule_templates').select('*').eq('facilitator_id', facilitatorId).eq('learner_id', learnerId).order('active', { ascending: false }).order('updated_at', { ascending: false }),
        admin.from('curriculum_preferences').select('*').eq('facilitator_id', facilitatorId).eq('learner_id', learnerId).maybeSingle(),
        admin.from('planned_lessons').select('*').eq('facilitator_id', facilitatorId).eq('learner_id', learnerId).gte('scheduled_date', today).order('scheduled_date'),
        admin.from('custom_subjects').select('id, name, display_order').eq('facilitator_id', facilitatorId).order('display_order').order('name'),
      ])
      for (const result of [templates, preferences, lessons, subjects]) throwOn(result.error, 'Failed to read legacy planning data')
      return { scheduleTemplates: templates.data || [], curriculumPreferences: preferences.data || null, plannedLessons: lessons.data || [], customSubjects: subjects.data || [] }
    },
  }
}
