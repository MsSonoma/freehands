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
    async findLatestMasteryProposal(syllabusId, baseRevisionId) {
      const { data, error } = await admin.from('syllabus_revisions').select('*')
        .eq('syllabus_id', syllabusId)
        .eq('base_revision_id', baseRevisionId)
        .is('activated_at', null)
        .eq('proposal_kind', 'mastery_reforecast')
        .order('revision_number', { ascending: false })
        .limit(1)
        .maybeSingle()
      throwOn(error, 'Failed to load proposed Syllabus reforecast')
      return data
    },
    async replaceMasteryProposal({ syllabusId, expectedActiveRevisionId, planning, proposalKey }) {
      const { data, error } = await admin.rpc('replace_syllabus_mastery_proposal', {
        p_syllabus_id: syllabusId,
        p_expected_active_revision_id: expectedActiveRevisionId,
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
      throwOn(error, 'Failed to replace mastery reforecast proposal')
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
    async listLessonAssociations(facilitatorId, learnerId) {
      const { data, error } = await admin.from('syllabus_lesson_associations').select('*')
        .eq('facilitator_id', facilitatorId)
        .eq('learner_id', learnerId)
        .order('created_at')
      throwOn(error, 'Failed to load learner lesson associations')
      return data || []
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
