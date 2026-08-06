import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')

test('generated lesson approval and edit operations derive storage owner from authenticated user', () => {
  const routes = [
    'src/app/api/facilitator/lessons/approve/route.js',
    'src/app/api/facilitator/lessons/request-changes/route.js',
    'src/app/api/facilitator/lessons/delete/route.js',
  ]

  for (const route of routes) {
    const source = read(route)
    assert.match(source, /facilitator-lessons\/\$\{user\.id\}\/\$\{file\}/, route)
    assert.doesNotMatch(source, /body\?\.userId|requestUserId|targetUserId\s*=\s*userId/, route)
  }
})

test('proposal and availability routes verify learner ownership before acting', () => {
  const proposalRoute = read('src/app/api/facilitator/lessons/propose/route.js')
  const availabilityRoute = read('src/app/api/facilitator/learners/lesson-availability/route.js')

  for (const source of [proposalRoute, availabilityRoute]) {
    assert.match(source, /\.from\('learners'\)/)
    assert.match(source, /facilitator_id\.eq\.\$\{user\.id\}/)
    assert.match(source, /owner_id\.eq\.\$\{user\.id\}/)
    assert.match(source, /user_id\.eq\.\$\{user\.id\}/)
  }
})

test('availability route verifies lesson access when making a lesson available', () => {
  const source = read('src/app/api/facilitator/learners/lesson-availability/route.js')
  assert.match(source, /verifyLessonAccess/)
  assert.match(source, /Lesson not found or unauthorized/)
  assert.match(source, /Approve the lesson content before making it available/)
  assert.match(source, /applyLessonAvailability/)
})

test('Facilitator Home visibly contains the reconstructed primary decision experience', () => {
  const source = read('src/app/facilitator/page.js')
  assert.match(source, /resolveFacilitatorHomeDecision/)
  assert.match(source, /readPreparationSnapshot/)
  assert.match(source, /Primary decision/)
  assert.match(source, /Advanced Tools/)
  assert.match(source, /\/facilitator\/prepare/)
  assert.doesNotMatch(source, /Choose a section to manage your homeschool or classroom/)
})

test('Advanced Tools links resolve to existing facilitator pages', () => {
  const source = read('src/app/facilitator/page.js')
  const expected = [
    '/facilitator/learners',
    '/facilitator/generator?advanced=1',
    '/facilitator/lessons',
    '/facilitator/calendar',
    '/facilitator/calendar?tab=planner',
    '/facilitator/calendar?tab=subjects',
    '/facilitator/calendar?portfolio=1',
    '/facilitator/account',
    '/facilitator/mr-mentor',
  ]

  for (const href of expected) {
    assert.match(source, new RegExp(href.replace(/[/?]/g, '\\$&')))
    const routePath = href.split('?')[0]
    assert.equal(fs.existsSync(path.join(root, 'src/app', routePath, 'page.js')), true, href)
  }
  assert.match(source, /Detailed lesson builder/)
  assert.doesNotMatch(source, /\/facilitator\/planner/)
  assert.doesNotMatch(source, /\/facilitator\/subjects/)
  assert.doesNotMatch(source, /\/facilitator\/portfolio/)
})

test('calendar query params land on existing planner, subjects, and portfolio controls', () => {
  const source = read('src/app/facilitator/calendar/page.js')
  assert.match(source, /resolveCalendarLandingParams/)
  assert.match(source, /setActiveTab\(landing\.activeTab\)/)
  assert.match(source, /if \(landing\.openPortfolio\) setShowGeneratePortfolio\(true\)/)
  assert.match(source, /<LessonPlanner/)
  assert.match(source, /Custom Subjects/)
  assert.match(source, /<GeneratePortfolioModal/)
})

test('generation route returns canonical identity and keeps new lessons as drafts', () => {
  const source = read('src/app/api/facilitator/lessons/generate/route.js')
  assert.match(source, /normalizeGenerationRequest/)
  assert.match(source, /buildCanonicalLessonIdentity/)
  assert.match(source, /lesson\.approved\s*=\s*false/)
  assert.match(source, /proposalMode && storageError/)
  assert.match(source, /const identity = storageError \? null : buildCanonicalLessonIdentity/)
})

test('advanced generator does not create actionable lesson keys after storage fallback', () => {
  const source = read('src/app/facilitator/generator/page.js')
  assert.match(source, /const storedLessonKey = js\?\.storageError \? null :/)
  assert.match(source, /params\.get\('advanced'\) !== '1'/)
  assert.match(source, /router\.replace\('\/facilitator\/prepare'\)/)
  assert.match(source, /writePreparationSnapshot/)
  assert.match(source, /stage: FACILITATOR_PREPARATION_STAGES\.DRAFT/)
  assert.doesNotMatch(source, /setLearnerLessonAvailability/)
  assert.doesNotMatch(source, /Make Active for/)
  assert.doesNotMatch(source, /All learners/)
  assert.doesNotMatch(source, /onboarding=1/)
})

test('old onboarding no longer bypasses reconstructed preparation flow', () => {
  const addLearnerPage = read('src/app/facilitator/learners/add/page.js')
  const signupPage = read('src/app/auth/signup/page.js')
  const layoutPage = read('src/app/facilitator/layout.js')
  const lessonsPage = read('src/app/facilitator/lessons/page.js')
  const calendarPage = read('src/app/facilitator/calendar/page.js')

  assert.match(addLearnerPage, /router\.push\('\/facilitator'\)/)
  assert.doesNotMatch(addLearnerPage, /router\.push\(`\/facilitator\/generator/)
  assert.doesNotMatch(addLearnerPage, /onboarding=1|OnboardingBanner|useOnboarding|GENERATE_LESSON/)
  assert.doesNotMatch(signupPage, /onboarding=1|flagOnboardingStart|ms_sonoma_onboarding_v1/)
  assert.doesNotMatch(layoutPage, /OnboardingChecklist/)
  assert.doesNotMatch(lessonsPage, /OnboardingBanner|useOnboarding|ACTIVATE_LESSON|CALENDAR_TOUR|onboarding=1/)
  assert.doesNotMatch(calendarPage, /CalendarTutorialOverlay|useOnboarding|CALENDAR_TOUR|onboarding=1/)
})

test('preparation and schedule API use centralized scheduling entitlements', () => {
  const preparePage = read('src/app/facilitator/prepare/page.js')
  const scheduleRoute = read('src/app/api/lesson-schedule/route.js')

  assert.match(preparePage, /featuresForTier, resolveEffectiveTier/)
  assert.match(preparePage, /canScheduleLesson = featuresForTier\(effectiveTier\)\.lessonScheduling === true/)
  assert.match(preparePage, /Scheduling is available on Standard\. You can start this lesson now, make it available, or save it for later\./)
  assert.match(preparePage, /href="\/facilitator\/account\/plan"/)
  assert.match(scheduleRoute, /featuresForTier, resolveEffectiveTier/)
  assert.match(scheduleRoute, /featuresForTier\(effectiveTier\)\.lessonScheduling/)
  assert.match(scheduleRoute, /Scheduling requires a Standard plan or higher/)
})

test('lesson library auto-loads and keeps multi-learner choice explicit', () => {
  const source = read('src/app/facilitator/lessons/page.js')

  assert.match(source, /learnersData\.length === 1/)
  assert.match(source, /setSelectedLearnerId\(onlyLearner\.id\)/)
  assert.doesNotMatch(source, /localStorage\.getItem\('learner_id'\)/)
  assert.doesNotMatch(source, /showLessons|setShowLessons|Load Lessons|Ready to load|Click <strong>Load Lessons/)
  assert.match(source, /Advanced library tools/)
  assert.match(source, /Advanced filters/)
  assert.match(source, /\/facilitator\/generator\?advanced=1/)
})

test('calendar keeps Scheduler default and gates advanced route-state surfaces', () => {
  const source = read('src/app/facilitator/calendar/page.js')

  assert.match(source, /const \[activeTab, setActiveTab\] = useState\('scheduler'\)/)
  assert.match(source, /advancedCalendarRequested = activeTab !== 'scheduler' \|\| showGeneratePortfolio/)
  assert.match(source, /advancedCalendarLocked = advancedCalendarRequested && !canPlan/)
  assert.match(source, /Scheduler is the default calendar view/)
  assert.match(source, /\/facilitator\/calendar\?tab=planner/)
  assert.match(source, /\/facilitator\/calendar\?tab=subjects/)
  assert.match(source, /\/facilitator\/calendar\?portfolio=1/)
  assert.match(source, /open=\{showGeneratePortfolio && canPlan\}/)
  assert.doesNotMatch(source, /setShowTutorial|\? Tour|Show page tour/)
})

test('preparation Save actions preserve the expected snapshots and exit home', () => {
  const preparePage = read('src/app/facilitator/prepare/page.js')
  assert.match(preparePage, /Learner: \{selectedLearner\.name\}/)
  assert.match(preparePage, /function saveDraftAndLeave\(\) \{[\s\S]*persist\(STAGES\.DRAFT, \{ lessonIdentity \}\)[\s\S]*router\.push\('\/facilitator'\)/)
  assert.match(preparePage, /onClick=\{saveDraftAndLeave\}[\s\S]*>Save and leave<\/button>/)
  assert.match(preparePage, /function saveForLater\(\) \{[\s\S]*persist\(STAGES\.DELIVERY, \{ lessonIdentity \}\)[\s\S]*router\.push\('\/facilitator'\)/)
  assert.doesNotMatch(preparePage, /function saveForLater\(\) \{[^}]*finishFlow\(\)/)
  assert.match(preparePage, /onClick=\{abandonFlow\}[\s\S]*>Discard draft setup<\/button>/)
})

test('missing learner recovery renders selector and blocks lesson actions until reassignment', () => {
  const preparePage = read('src/app/facilitator/prepare/page.js')
  assert.match(preparePage, /resolvePreparationLearnerRecovery/)
  assert.match(preparePage, /setLearnerId\(recovery \? '' :/)
  assert.match(preparePage, /const hasLearnerRecovery = !!recoveryStage && !!missingLearnerId/)
  assert.match(preparePage, /The previously selected learner is no longer available/)
  assert.match(preparePage, /This lesson has not been reassigned/)
  assert.match(preparePage, /<option value="">Choose a learner<\/option>/)
  assert.match(preparePage, /onSubmit=\{assignReplacementLearner\}/)
  assert.match(preparePage, /writePreparationSnapshot\(reassigned\)/)
  assert.match(preparePage, /setStage\(reassigned\.stage\)/)
  assert.match(preparePage, /stage === STAGES\.DRAFT && lessonIdentity && !hasLearnerRecovery/)
  assert.match(preparePage, /stage === STAGES\.DELIVERY && lessonIdentity && !hasLearnerRecovery/)
  assert.match(preparePage, /if \(!selectedLearner\) \{[\s\S]*Choose a learner before approving this lesson/)
  assert.match(preparePage, /if \(!selectedLearner\) throw new Error\('Choose a learner before choosing delivery\.'\)/)
  assert.match(preparePage, /onClick=\{startNow\} disabled=\{busy \|\| !selectedLearner\}/)
  assert.match(preparePage, /onClick=\{makeAvailable\} disabled=\{busy \|\| !selectedLearner\}/)
  assert.match(preparePage, /onClick=\{scheduleLesson\} disabled=\{busy \|\| !scheduleDate \|\| !selectedLearner\}/)
})