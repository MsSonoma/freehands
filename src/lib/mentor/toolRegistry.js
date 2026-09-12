const objectSchema = (properties = {}, required = []) => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
})

const learnerSelector = {
  learnerId: { type: 'string', description: 'Optional learner ID. Omit to use the learner currently selected in Mr. Mentor.' },
  learnerName: { type: 'string', description: 'Optional learner name. Omit to use the learner currently selected in Mr. Mentor.' },
}

export const MENTOR_TOOL_REGISTRY = Object.freeze([
  {
    name: 'get_capabilities',
    authority: 'read',
    purpose: 'Inspect Mr. Mentor capabilities from the same registry that defines his live tools.',
    whenToUse: 'When you need to check what action is available or what authority/confirmation rules apply.',
    verification: 'registry',
    description: 'Get current Mr. Mentor capabilities and tool requirements. This is generated from the live tool registry, so it does not drift from the tools actually available.',
    parameters: objectSchema({ action: { type: 'string', description: 'Optional tool name to inspect. Omit or use "all" for the full registry.' } }),
  },
  {
    name: 'search_lessons',
    authority: 'read',
    purpose: 'Search installed and facilitator-created lessons.',
    whenToUse: 'When the facilitator asks what lessons exist, requests recommendations, or needs a lesson key for another action.',
    verification: 'source read',
    description: 'Search available lessons across installed subjects and facilitator-created lessons. Prefer searching before generating a new lesson.',
    parameters: objectSchema({
      subject: { type: 'string', description: 'Optional subject filter. Use facilitator for facilitator-created lessons.' },
      grade: { type: 'string', description: 'Optional grade filter such as "4th".' },
      searchTerm: { type: 'string', description: 'Optional title/topic search text.' },
    }),
  },
  {
    name: 'get_lesson_details',
    authority: 'read',
    purpose: 'Inspect a lesson before recommending, editing, assigning, or scheduling it.',
    whenToUse: 'When the exact content or identity of a lesson matters.',
    verification: 'source read',
    description: 'Get the current details of a specific lesson.',
    parameters: objectSchema({ lessonKey: { type: 'string', description: 'Canonical lesson key such as science/Photosynthesis.json.' } }, ['lessonKey']),
  },
  {
    name: 'get_syllabus',
    authority: 'read',
    purpose: 'Read the learner’s authoritative active Syllabus, future instructional plan, teacher assignments, Slate assignments, forecast proposal, and days off.',
    whenToUse: 'Before making recommendations about what should happen next or before changing learner planning.',
    verification: 'authoritative Syllabus read',
    requiresLearner: true,
    description: 'Read the selected learner’s current authoritative Syllabus. Use this instead of legacy schedule templates or curriculum-preference records.',
    parameters: objectSchema({ ...learnerSelector, view: { type: 'string', enum: ['summary', 'full'], description: 'summary is preferred unless full detail is required.' } }),
  },
  {
    name: 'get_learning_evidence',
    authority: 'read',
    purpose: 'Read canonical mastery, comprehension, assistance, retention, and review evidence for a learner.',
    whenToUse: 'Before inferring what the learner understands, where recovery is needed, or what should be practiced next.',
    verification: 'canonical evidence read',
    requiresLearner: true,
    description: 'Read canonical learning evidence. Separate direct observations in the evidence from your own inferences and recommendations.',
    parameters: objectSchema({
      ...learnerSelector,
      lessonKey: { type: 'string', description: 'Optional lesson key to narrow the evidence.' },
      limit: { type: 'integer', minimum: 1, maximum: 10, description: 'Number of recent evidence reports, default 5.' },
    }),
  },
  {
    name: 'get_schedule',
    authority: 'read',
    purpose: 'Read actual dated lesson schedule entries for a learner.',
    whenToUse: 'When the facilitator asks what is scheduled on particular dates or in the near future.',
    verification: 'schedule read',
    requiresLearner: true,
    description: 'Read dated lesson schedule entries. For broader instructional intent and forecast context, use get_syllabus.',
    parameters: objectSchema({
      ...learnerSelector,
      startDate: { type: 'string', description: 'Optional YYYY-MM-DD. Defaults to the learner’s resolved Syllabus today.' },
      endDate: { type: 'string', description: 'Optional YYYY-MM-DD. Defaults to 14 days after startDate.' },
    }),
  },
  {
    name: 'propose_syllabus_plan',
    authority: 'propose',
    entitlement: 'lessonPlanner',
    purpose: 'Use current Syllabus intent and evidence to generate instructional forecast or planning suggestions without silently changing active educational intent.',
    whenToUse: 'When the facilitator asks what should come next, wants a forecast, wants suggestions for open slots, or wants a different forecast idea.',
    verification: 'proposal readback',
    requiresLearner: true,
    directResult: true,
    description: 'Create a Syllabus forecast/suggestion proposal. This does not silently activate a new educational plan. Use update_syllabus_plan only when the facilitator explicitly instructs you to change active intent.',
    parameters: objectSchema({
      ...learnerSelector,
      action: { type: 'string', enum: ['forecast', 'suggest', 'edit_forecast', 'replace_forecast'], description: 'forecast creates a learning forecast proposal; suggest returns provisional concepts for exact slots; edit_forecast edits a proposal concept; replace_forecast asks the forecast generator for a different concept.' },
      slots: { type: 'array', description: 'For suggest: exact Syllabus slots.', items: objectSchema({ planned_date: { type: 'string' }, sort_order: { type: 'integer' } }, ['planned_date', 'sort_order']) },
      proposalRevisionId: { type: 'string', description: 'For edit_forecast or replace_forecast: current proposal revision ID.' },
      lineageId: { type: 'string', description: 'For edit_forecast or replace_forecast: exact forecast lineage ID.' },
      title: { type: 'string', description: 'For edit_forecast: revised proposal title.' },
      description: { type: 'string', description: 'For edit_forecast: revised proposal description.' },
      changeRequest: { type: 'string', description: 'Optional facilitator direction for a replacement forecast concept.' },
    }, ['action']),
  },
  {
    name: 'generate_lesson',
    authority: 'commit',
    entitlement: 'lessonGenerator',
    purpose: 'Generate and save a new facilitator lesson.',
    whenToUse: 'Only after the facilitator explicitly asks to create/generate a lesson and existing lessons are not the desired answer.',
    verification: 'saved lesson response plus validation workflow',
    confirmation: 'explicit',
    confirmationPrompt: 'Would you like me to generate and save that custom lesson?',
    directResult: true,
    description: 'Generate a custom lesson. Search first when the facilitator is asking for recommendations rather than creation.',
    parameters: objectSchema({
      title: { type: 'string' }, subject: { type: 'string' }, grade: { type: 'string' },
      difficulty: { type: 'string', enum: ['Beginner', 'Intermediate', 'Advanced'] },
      description: { type: 'string' }, vocab: { type: 'string' }, notes: { type: 'string' },
    }, ['title', 'subject', 'grade', 'difficulty', 'description']),
  },
  {
    name: 'schedule_lesson',
    authority: 'commit',
    entitlement: 'lessonScheduling',
    uiAction: 'lesson_scheduled_event',
    purpose: 'Schedule an approved lesson for a learner on a specific date.',
    whenToUse: 'When the facilitator explicitly asks to put a lesson on a date/calendar.',
    verification: 'schedule write plus readback',
    requiresLearner: true,
    description: 'Schedule a lesson for the selected or named learner on a YYYY-MM-DD date. Never claim it was scheduled unless the write and verification succeed.',
    parameters: objectSchema({ ...learnerSelector, lessonKey: { type: 'string' }, scheduledDate: { type: 'string', description: 'YYYY-MM-DD using the actual current date context.' } }, ['lessonKey', 'scheduledDate']),
  },
  {
    name: 'assign_lesson',
    authority: 'commit',
    purpose: 'Make a lesson available to a learner without selecting a calendar date.',
    whenToUse: 'When the facilitator explicitly asks to assign or make a lesson available.',
    verification: 'assignment write response',
    requiresLearner: true,
    description: 'Assign a lesson to the selected or named learner without scheduling it to a date.',
    parameters: objectSchema({ ...learnerSelector, lessonKey: { type: 'string' }, lessonTitle: { type: 'string' } }, ['lessonKey']),
  },
  {
    name: 'edit_lesson',
    authority: 'commit',
    purpose: 'Edit an existing lesson artifact.',
    whenToUse: 'When the facilitator explicitly asks to correct or change a lesson.',
    verification: 'lesson write response',
    description: 'Edit an existing lesson. Inspect it first when needed so only intended fields are changed.',
    parameters: objectSchema({ lessonKey: { type: 'string' }, updates: { type: 'object', additionalProperties: true } }, ['lessonKey', 'updates']),
  },
  {
    name: 'update_syllabus_plan',
    authority: 'commit',
    entitlement: 'lessonPlanner',
    purpose: 'Change active educator-authored Syllabus intent using current revision checks.',
    whenToUse: 'Only when the facilitator explicitly instructs you to change the active Syllabus, weekly pattern, teaching guidance, goals/subjects, or future concept placement.',
    verification: 'authoritative Syllabus revision readback',
    requiresLearner: true,
    confirmation: 'explicit',
    confirmationPrompt: 'This will change the learner’s active Syllabus. Do you want me to apply that change?',
    description: 'Change active Syllabus intent. This is an educator-authority action and requires explicit confirmation. Do not use legacy schedule templates or curriculum-preference writes.',
    parameters: objectSchema({
      ...learnerSelector,
      action: { type: 'string', enum: ['set_plan_details', 'create_day', 'edit_concept', 'remove_concept', 'activate_forecast'] },
      planDetailsPatch: { type: 'object', description: 'For set_plan_details. Supported keys: goals, subjects, weekly_pattern, teaching_guidance. Omitted keys remain unchanged.', additionalProperties: true },
      plannedDate: { type: 'string' }, subject: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' },
      generationSpec: { type: 'object', additionalProperties: true }, lineageId: { type: 'string' }, proposalRevisionId: { type: 'string', description: 'For activate_forecast: the proposal revision the facilitator approved.' },
    }, ['action']),
  },
  {
    name: 'materialize_syllabus_lesson',
    authority: 'commit',
    entitlement: 'lessonPlanner',
    purpose: 'Bind an existing lesson or generate a lesson for a specific Syllabus forecast occurrence.',
    whenToUse: 'When the facilitator explicitly asks to turn a Syllabus concept into the actual lesson artifact.',
    verification: 'Syllabus materialization response plus readback',
    requiresLearner: true,
    confirmation: 'explicit',
    confirmationPrompt: 'Do you want me to materialize that Syllabus concept into its lesson now?',
    directResult: true,
    description: 'Materialize one exact Syllabus forecast occurrence into a lesson artifact using the current active revision.',
    parameters: objectSchema({
      ...learnerSelector,
      lineageId: { type: 'string' }, proposalRevisionId: { type: 'string' }, existingLessonKey: { type: 'string', description: 'Optional approved existing lesson to bind instead of generating.' },
    }, ['lineageId']),
  },
  {
    name: 'set_instructional_teacher',
    authority: 'commit',
    purpose: 'Assign Ms. Sonoma or Mrs. Webb to one exact Syllabus lesson occurrence.',
    whenToUse: 'When the facilitator asks who should teach a specific occurrence or explicitly assigns the teacher.',
    verification: 'association write response',
    requiresLearner: true,
    description: 'Set the instructional teacher for one exact active Syllabus occurrence.',
    parameters: objectSchema({ ...learnerSelector, lessonKey: { type: 'string' }, occurrenceId: { type: 'string' }, instructionalTeacher: { type: 'string', enum: ['sonoma', 'webb'], description: 'sonoma = Ms. Sonoma; webb = Mrs. Webb.' } }, ['lessonKey', 'occurrenceId', 'instructionalTeacher']),
  },
  {
    name: 'manage_slate_practice',
    authority: 'commit',
    purpose: 'Schedule or remove Mr. Slate practice/mastery/retention work tied to an exact Syllabus occurrence.',
    whenToUse: 'When the facilitator explicitly asks to schedule or remove Mr. Slate work.',
    verification: 'Slate assignment write response',
    requiresLearner: true,
    description: 'Schedule or remove a Mr. Slate assignment tied to a Syllabus occurrence.',
    parameters: objectSchema({
      ...learnerSelector,
      action: { type: 'string', enum: ['schedule', 'remove'] }, lessonKey: { type: 'string' }, occurrenceId: { type: 'string' }, scheduledDate: { type: 'string' },
      runPurpose: { type: 'string', enum: ['practice', 'independent_mastery', 'recovery', 'daily_followup', 'weekly_review', 'retention'] }, assignmentId: { type: 'string' },
    }, ['action']),
  },
  {
    name: 'manage_no_school_date',
    authority: 'commit',
    purpose: 'List, add, or remove learner days off used by authoritative planning.',
    whenToUse: 'When the facilitator asks about holidays/days off or explicitly asks to mark/unmark a date.',
    verification: 'no-school-date readback',
    requiresLearner: true,
    description: 'List, add, or remove a no-school date for the selected learner.',
    parameters: objectSchema({ ...learnerSelector, action: { type: 'string', enum: ['list', 'add', 'remove'] }, date: { type: 'string' }, reason: { type: 'string' } }, ['action']),
  },
  {
    name: 'open_surface',
    authority: 'navigate',
    uiAction: 'navigate',
    purpose: 'Open a known Ms. Sonoma facilitator surface for the user.',
    whenToUse: 'When the facilitator asks to open or go to a feature rather than merely discuss it.',
    verification: 'server-approved navigation target',
    directResult: true,
    description: 'Navigate to a known facilitator surface. This does not change educational state.',
    parameters: objectSchema({ surface: { type: 'string', enum: ['syllabus', 'calendar', 'lessons', 'generated_lessons', 'lesson_maker', 'learners', 'prepare', 'account', 'notifications', 'mr_mentor'] }, learnerId: { type: 'string', description: 'Optional learner ID when the destination supports learner context.' } }, ['surface']),
  },
  {
    name: 'get_conversation_memory',
    authority: 'read',
    purpose: 'Retrieve prior Mr. Mentor conversation memory.',
    whenToUse: 'When the facilitator refers to earlier conversations or continuity is materially useful.',
    verification: 'conversation memory read',
    description: 'Retrieve conversation memory. Uses the selected learner automatically when appropriate.',
    parameters: objectSchema({ learner_id: { type: 'string' } }),
  },
  {
    name: 'search_conversation_history',
    authority: 'read',
    purpose: 'Search prior Mr. Mentor conversations.',
    whenToUse: 'When the facilitator asks what was previously discussed about a subject.',
    verification: 'conversation history read',
    description: 'Search prior conversation summaries using keywords.',
    parameters: objectSchema({ search: { type: 'string' }, include_archive: { type: 'boolean' } }, ['search']),
  },
])

const TOOL_BY_NAME = new Map(MENTOR_TOOL_REGISTRY.map((tool) => [tool.name, tool]))

export function getMentorTool(name) {
  return TOOL_BY_NAME.get(String(name || '').trim()) || null
}

export function getMentorOpenAiTools() {
  return MENTOR_TOOL_REGISTRY.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

export function mentorToolNeedsConfirmation(name) {
  return getMentorTool(name)?.confirmation === 'explicit'
}

export function mentorToolConfirmationPrompt(name) {
  return getMentorTool(name)?.confirmationPrompt || 'Do you want me to carry out that change?'
}

export function mentorToolUsesDirectResult(name) {
  return getMentorTool(name)?.directResult === true
}

export function getMentorCapabilities(action = 'all') {
  const requested = String(action || 'all').trim()
  const serialize = (tool) => ({
    name: tool.name,
    authority: tool.authority,
    purpose: tool.purpose,
    when_to_use: tool.whenToUse,
    requires_learner: tool.requiresLearner === true,
    entitlement: tool.entitlement || null,
    confirmation: tool.confirmation || 'none',
    ui_action: tool.uiAction || null,
    verification: tool.verification,
    parameters: tool.parameters,
  })
  if (requested !== 'all') {
    const tool = getMentorTool(requested)
    return tool ? { success: true, action: requested, details: serialize(tool) } : { success: false, error: `Unknown capability: ${requested}` }
  }
  return {
    success: true,
    capabilities: Object.fromEntries(MENTOR_TOOL_REGISTRY.map((tool) => [tool.name, serialize(tool)])),
    authority_model: {
      read: 'Inspect current product state without changing it.',
      propose: 'Generate a recommendation/proposal without silently changing active educational intent.',
      commit: 'Perform a facilitator-directed mutation through the authoritative current API.',
      navigate: 'Open a known product surface without changing educational state.',
    },
  }
}

export function buildMentorToolPrompt() {
  const lines = MENTOR_TOOL_REGISTRY.map((tool) => {
    const qualifiers = [tool.authority, tool.requiresLearner ? 'learner' : null, tool.entitlement ? `entitlement: ${tool.entitlement}` : null, tool.confirmation === 'explicit' ? 'confirmation required' : null].filter(Boolean).join(', ')
    return `- ${tool.name} [${qualifiers}]: ${tool.purpose}`
  })
  return `LIVE TOOL REGISTRY (${MENTOR_TOOL_REGISTRY.length} tools):\n${lines.join('\n')}\n\nTool authority rules:\n- READ tools can inspect current state.\n- PROPOSE tools may generate options or forecast proposals but must not be described as active educational intent.\n- COMMIT tools change current state. Execute them only for facilitator-directed actions and never claim success unless the tool result confirms it.\n- Tools marked confirmation required must be confirmed before execution.\n- NAVIGATE tools may open a known app surface but do not change educational state.\n- The active Syllabus and canonical learning evidence outrank legacy planner/preferences data.`
}
