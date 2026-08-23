function throwOn(error, fallback) {
  if (error) {
    const wrapped = new Error(error.message || fallback)
    wrapped.code = error.code
    throw wrapped
  }
}

export function createSyllabusRepository(admin) {
  return {
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
