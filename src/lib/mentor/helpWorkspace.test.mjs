import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const client = fs.readFileSync(new URL('../../app/facilitator/generator/counselor/CounselorClient.jsx', import.meta.url), 'utf8')
const frame = fs.readFileSync(new URL('../../app/facilitator/generator/counselor/HelpWorkspaceFrame.jsx', import.meta.url), 'utf8')
const syllabus = fs.readFileSync(new URL('../../app/facilitator/page.js', import.meta.url), 'utf8')
const counselorRoute = fs.readFileSync(new URL('../../app/api/counselor/route.js', import.meta.url), 'utf8')

test('Help uses the real Syllabus and Lesson Library as shared workspaces', () => {
  assert.match(frame, /import FacilitatorPage from '..\/..\/page'/)
  assert.match(frame, /import LessonLibraryPage from '..\/..\/lessons\/page'/)
  assert.match(frame, /id: 'syllabus', label: 'Syllabus'/)
  assert.match(frame, /id: 'lessons', label: 'Lesson Library'/)
  assert.doesNotMatch(frame, /id: 'learners'/)
  assert.match(client, /const \[activeScreen, setActiveScreen\] = useState\('syllabus'\)/)
  assert.match(client, /Syllabus is the primary facilitator workspace/)
  assert.match(client, /<HelpWorkspaceFrame/)
  assert.doesNotMatch(client, /LessonsOverlay/)
  assert.doesNotMatch(client, /LessonMakerOverlay/)
})

test('Guidance shortcut opens Curriculum Guidance directly inside the embedded Syllabus', () => {
  assert.match(client, /openSyllabusWorkspace\('week', 'curriculum_guidance'\)/)
  assert.doesNotMatch(client, /enterWorkspaceExpanded\(\)[\s\S]{0,120}openSyllabusWorkspace\('week', 'curriculum_guidance'\)/)
  assert.match(client, /params\.set\('overlay', 'curriculum-guidance'\)/)
  assert.match(client, /facilitator:open-curriculum-guidance/)
  assert.match(syllabus, /params\.get\('overlay'\) === 'curriculum-guidance' \? 'teaching_guidance' : ''/)
  assert.match(syllabus, /facilitator:open-curriculum-guidance/)
})

test('Help full workspace hides conversation by default but keeps it available on demand', () => {
  assert.match(client, /workspaceExpanded/)
  assert.match(client, /conversationDockOpen/)
  assert.match(client, /const toggleWorkspaceExpanded = useCallback/)
  assert.match(client, /const next = !current[\s\S]*setConversationDockOpen\(!next\)/)

  assert.match(client, /workspaceSideBySide/)
  assert.match(client, /zIndex: workspaceFocus \? 1500 : 0/)
  assert.match(frame, /Conversation\s*<\/button>/)
  assert.match(frame, /aria-label=\{expanded \? 'Exit full workspace' : 'Expand workspace'\}/)
})

test('Help and Syllabus exchange learner, view, and embedded overlay context', () => {
  assert.match(client, /ms:syllabus:learner-selected/)
  assert.match(client, /facilitator:set-syllabus-view/)
  assert.match(client, /facilitator:open-learners/)
  assert.match(client, /facilitator:open-plan-details/)
  assert.match(syllabus, /ms:syllabus:learner-selected/)
  assert.match(syllabus, /facilitator:set-syllabus-view/)
  assert.match(syllabus, /facilitator:open-learners/)
  assert.match(syllabus, /facilitator:open-plan-details/)
  assert.match(client, /workspace_context: \{ surface: activeScreen, syllabus_view: syllabusView, expanded: workspaceExpanded \}/)
  assert.match(counselorRoute, /HELP WORKSPACE CONTEXT/)
})

test('Curriculum Guidance replaces the old Help clipboard persistence model', () => {
  assert.match(client, /\/api\/syllabus\/curriculum\?learnerId=/)
  assert.match(client, /curriculum_guidance: curriculumGuidanceContext/)
  assert.doesNotMatch(client, /ClipboardOverlay/)
  assert.doesNotMatch(client, /GoalsClipboardOverlay/)
  assert.doesNotMatch(client, /\/api\/conversation-drafts/)
  assert.doesNotMatch(client, /\/api\/goals-notes/)
  assert.match(counselorRoute, /executeGetCurriculumGuidance/)
  assert.match(counselorRoute, /executeUpdateCurriculumGuidance/)
  assert.match(counselorRoute, /CURRENT CURRICULUM GUIDANCE/)
})
