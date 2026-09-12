import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  MENTOR_TOOL_REGISTRY,
  buildMentorToolPrompt,
  getMentorCapabilities,
  getMentorOpenAiTools,
  getMentorTool,
  mentorToolNeedsConfirmation,
} from './toolRegistry.js'

test('Mr. Mentor registry is unique and drives OpenAI tool definitions', () => {
  const names = MENTOR_TOOL_REGISTRY.map((tool) => tool.name)
  assert.equal(new Set(names).size, names.length)
  assert.deepEqual(getMentorOpenAiTools().map((tool) => tool.function.name), names)
})

test('Mr. Mentor exposes current Syllabus and mastery capabilities', () => {
  const required = [
    'get_syllabus',
    'get_learning_evidence',
    'get_schedule',
    'propose_syllabus_plan',
    'update_syllabus_plan',
    'materialize_syllabus_lesson',
    'set_instructional_teacher',
    'manage_slate_practice',
    'manage_no_school_date',
    'open_surface',
  ]
  for (const name of required) assert.ok(getMentorTool(name), `missing ${name}`)
})

test('educational authority boundaries are explicit', () => {
  assert.equal(getMentorTool('get_learning_evidence').authority, 'read')
  assert.equal(getMentorTool('propose_syllabus_plan').authority, 'propose')
  assert.equal(getMentorTool('update_syllabus_plan').authority, 'commit')
  assert.equal(getMentorTool('open_surface').authority, 'navigate')
  assert.equal(mentorToolNeedsConfirmation('update_syllabus_plan'), true)
  assert.equal(mentorToolNeedsConfirmation('materialize_syllabus_lesson'), true)
  assert.equal(mentorToolNeedsConfirmation('propose_syllabus_plan'), false)
})

test('capabilities expose policy metadata from the registry', () => {
  const capability = getMentorCapabilities('update_syllabus_plan')
  assert.equal(capability.success, true)
  assert.equal(capability.details.entitlement, 'lessonPlanner')
  assert.equal(capability.details.confirmation, 'explicit')
  assert.equal(capability.details.verification, 'authoritative Syllabus revision readback')

  const navigation = getMentorCapabilities('open_surface')
  assert.equal(navigation.details.ui_action, 'navigate')
})

test('tool prompt is current and authority-aware', () => {
  const prompt = buildMentorToolPrompt()
  assert.match(prompt, /active Syllabus/i)
  assert.match(prompt, /canonical learning evidence/i)
  assert.match(prompt, /PROPOSE tools/i)
  assert.doesNotMatch(prompt, /current year is 2025/i)
  assert.doesNotMatch(prompt, /You have 8 function/i)
})

test('counselor route derives schemas from registry and covers every executor', () => {
  const source = fs.readFileSync(new URL('../../app/api/counselor/route.js', import.meta.url), 'utf8')
  assert.match(source, /getMentorOpenAiTools\(\)/)
  assert.match(source, /MISSING_MENTOR_EXECUTORS/)
  assert.match(source, /EXTRA_MENTOR_EXECUTORS/)
  assert.doesNotMatch(source, /current year is 2025/i)
  assert.doesNotMatch(source, /You have 8 function/i)
  assert.doesNotMatch(source, /\/api\/facilitator\/lessons\/schedule/)
  assert.doesNotMatch(source, /\/api\/schedule-templates/)
})

test('CounselorClient no longer contains the legacy mutation engine', () => {
  const source = fs.readFileSync(new URL('../../app/facilitator/generator/counselor/CounselorClient.jsx', import.meta.url), 'utf8')
  assert.match(source, /confirmed_tools/)
  assert.match(source, /selected_learner_id/)
  assert.match(source, /toolResult\?\.uiAction\?\.type === 'navigate'/)
  assert.doesNotMatch(source, /\/api\/facilitator\/lessons\/schedule/)
  assert.doesNotMatch(source, /\/api\/schedule-templates/)
  assert.doesNotMatch(source, /save_weekly_pattern/)
  assert.doesNotMatch(source, /save_curriculum_preferences/)
})

test('MentorInterceptor forwards operational work instead of mutating state', () => {
  const source = fs.readFileSync(new URL('../../app/facilitator/generator/counselor/MentorInterceptor.js', import.meta.url), 'utf8')
  const start = source.indexOf('async process(userMessage, context = {})')
  assert.ok(start >= 0)
  const processSource = source.slice(start)
  assert.match(processSource, /handled: false/)
  assert.doesNotMatch(processSource, /executeAction/)
  assert.doesNotMatch(processSource, /save_weekly_pattern/)
})
