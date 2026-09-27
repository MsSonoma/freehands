import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const client = fs.readFileSync(new URL('../../app/facilitator/generator/counselor/CounselorClient.jsx', import.meta.url), 'utf8')
const frame = fs.readFileSync(new URL('../../app/facilitator/generator/counselor/HelpWorkspaceFrame.jsx', import.meta.url), 'utf8')
const bottomNav = fs.readFileSync(new URL('../../app/facilitator/generator/counselor/HelpBottomNav.jsx', import.meta.url), 'utf8')
const syllabus = fs.readFileSync(new URL('../../app/facilitator/page.js', import.meta.url), 'utf8')
const counselorRoute = fs.readFileSync(new URL('../../app/api/counselor/route.js', import.meta.url), 'utf8')

test('Help uses real workspaces without a redundant workspace toolbar', () => {
  assert.match(frame, /import FacilitatorPage from '..\/..\/page'/)
  assert.match(frame, /import LessonLibraryPage from '..\/..\/lessons\/page'/)
  assert.match(client, /const \[activeScreen, setActiveScreen\] = useState\('mentor'\)/)
  assert.match(client, /<HelpWorkspaceFrame/)
  assert.doesNotMatch(frame, /Help workspace/)
  assert.doesNotMatch(frame, /Conversation/)
})

test('Help resolves the shared active learner before Syllabus is opened', () => {
  assert.match(client, /import \{ persistLearnerSelection \} from '@\/app\/learn\/learnerSelection\.mjs'/)
  assert.match(client, /learnerSelectionResolvedRef/)
  assert.match(client, /getItem\?\.\('learner_id'\)/)
  assert.match(client, /persistLearnerSelection\(window\.localStorage, selectedLearner\)/)
})

test('Compact footer has five modestly larger controls including Guidance', () => {
  assert.match(client, /<HelpBottomNav/)
  assert.match(bottomNav, /width: 46/)
  assert.match(bottomNav, /height: 46/)
  assert.match(bottomNav, /title="Help Home"/)
  assert.match(bottomNav, /title="Lessons"/)
  assert.match(bottomNav, /title="Syllabus"/)
  assert.match(bottomNav, /title="Curriculum Guidance"/)
  assert.match(bottomNav, /Expand Help/)
  assert.match(client, /onGuidance=\{\(\) => setGuidanceOverlayOpen\(true\)\}/)
  assert.doesNotMatch(client, /aria-label="Guidance"/)
})

test('Expand hides header and conversation but keeps the compact footer', () => {
  assert.match(client, /const workspaceFocus = workspaceExpanded/)
  assert.match(client, /setConversationDockOpen\(!next\)/)
  assert.match(client, /display: workspaceExpanded && !conversationDockOpen \? 'none' : 'flex'/)
  assert.match(client, /paddingTop: workspaceFocus \? 0/)
  assert.match(client, /zIndex: workspaceFocus \? 1500 : 0/)
  assert.match(client, /<HelpBottomNav/)
  assert.match(client, /position: 'fixed',[\s\S]*bottom: 0/)
})

test('Help shell uses encoding-safe symbols', () => {
  assert.doesNotMatch(client, /[^\x00-\x7F]/)
  assert.doesNotMatch(bottomNav, /[^\x00-\x7F]/)
  assert.match(client, /aria-label="New Conversation"[\s\S]*<svg aria-hidden="true" width="26"/)
  assert.match(bottomNav, /&#128218;/)
  assert.match(bottomNav, /&#128203;/)
  assert.match(bottomNav, /&#129517;/)
})

test('Help and Syllabus exchange learner, view, and embedded overlay context', () => {
  assert.match(client, /ms:syllabus:learner-selected/)
  assert.match(client, /facilitator:set-syllabus-view/)
  assert.match(client, /facilitator:open-learners/)
  assert.match(client, /facilitator:open-plan-details/)
  assert.match(syllabus, /ms:syllabus:learner-selected/)
  assert.match(syllabus, /facilitator:set-syllabus-view/)
  assert.match(client, /workspace_context: \{ surface: activeScreen, syllabus_view: syllabusView, expanded: workspaceExpanded \}/)
  assert.match(counselorRoute, /HELP WORKSPACE CONTEXT/)
})

test('Curriculum Guidance remains the authoritative Help guidance model', () => {
  assert.match(client, /\/api\/syllabus\/curriculum\?learnerId=/)
  assert.match(client, /curriculum_guidance: curriculumGuidanceContext/)
  assert.doesNotMatch(client, /ClipboardOverlay/)
  assert.doesNotMatch(client, /GoalsClipboardOverlay/)
  assert.match(counselorRoute, /executeGetCurriculumGuidance/)
  assert.match(counselorRoute, /executeUpdateCurriculumGuidance/)
  assert.match(counselorRoute, /CURRENT CURRICULUM GUIDANCE/)
})