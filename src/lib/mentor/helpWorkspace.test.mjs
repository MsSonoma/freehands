import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const client = fs.readFileSync(new URL('../../app/facilitator/generator/counselor/CounselorClient.jsx', import.meta.url), 'utf8')
const frame = fs.readFileSync(new URL('../../app/facilitator/generator/counselor/HelpWorkspaceFrame.jsx', import.meta.url), 'utf8')
const bottomNav = fs.readFileSync(new URL('../../app/facilitator/generator/counselor/HelpBottomNav.jsx', import.meta.url), 'utf8')
const syllabus = fs.readFileSync(new URL('../../app/facilitator/page.js', import.meta.url), 'utf8')
const counselorRoute = fs.readFileSync(new URL('../../app/api/counselor/route.js', import.meta.url), 'utf8')

test('Help uses the real Syllabus and Lesson Library as shared workspaces', () => {
  assert.match(frame, /import FacilitatorPage from '..\/..\/page'/)
  assert.match(frame, /import LessonLibraryPage from '..\/..\/lessons\/page'/)
  assert.match(client, /const \[activeScreen, setActiveScreen\] = useState\('mentor'\)/)
  assert.match(client, /<HelpWorkspaceFrame/)
  assert.match(client, /<HelpBottomNav/)
  assert.doesNotMatch(frame, /Help workspace/)
  assert.doesNotMatch(frame, /Conversation/)
  assert.doesNotMatch(client, /LessonsOverlay/)
  assert.doesNotMatch(client, /LessonMakerOverlay/)
  assert.match(bottomNav, /label="Home"/)
  assert.match(bottomNav, /label="Lessons"/)
  assert.match(bottomNav, /label="Syllabus"/)
  assert.match(bottomNav, /label="Guidance"/)
})

test('Help resolves the shared active learner before Syllabus is opened', () => {
  assert.match(client, /import \{ persistLearnerSelection \} from '@\/app\/learn\/learnerSelection\.mjs'/)
  assert.match(client, /learnerSelectionResolvedRef/)
  assert.match(client, /getItem\?\.\('learner_id'\)/)
  assert.match(client, /persistLearnerSelection\(window\.localStorage, selectedLearner\)/)
  assert.match(client, /removeItem\?\.\(LEGACY_SELECTED_LEARNER_KEY\)/)
})

test('Guidance opens from bottom navigation without switching to Syllabus', () => {
  assert.match(client, /import CurriculumGuidanceEditor/)
  assert.match(client, /onGuidance=\{\(\) => setGuidanceOverlayOpen\(true\)\}/)
  assert.match(bottomNav, /label="Guidance"/)
  assert.match(client, /guidanceOverlayOpen && selectedLearnerId !== 'none' && accessToken && <CurriculumGuidanceEditor/)
  assert.doesNotMatch(client, /aria-label="Guidance"/)
})

test('Help fullscreen expands the whole Help shell without hiding conversation', () => {
  assert.match(client, /const workspaceFocus = workspaceExpanded/)
  assert.match(client, /setWorkspaceExpanded\(\(current\) => !current\)/)
  assert.doesNotMatch(client, /conversationDockOpen/)
  assert.match(client, /workspaceSideBySide/)
  assert.match(client, /zIndex: workspaceFocus \? 1500 : 0/)
  assert.match(client, /left: 0,[\s\S]*right: 0,/)
  assert.match(bottomNav, /expanded\?'Restore':'Expand'/)
  assert.doesNotMatch(frame, /Conversation/)
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
