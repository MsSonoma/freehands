import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const slate = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')
const layout = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.module.css'), 'utf8')

test('Mr. Slate video is to the right above Your Progress, without moving the transcript', () => {
  assert.match(slate, /import styles from '\.\/SlateLiftoffExperience\.module\.css'/)
  const main = slate.indexOf('<main className={styles.sessionMain}')
  const section = slate.indexOf('<section className={styles.contentColumn}', main)
  const transcript = slate.indexOf('className={styles.transcriptColumn}', section)
  const sidebar = slate.indexOf('className={styles.sidebarColumn}', transcript)
  const video = slate.indexOf('<ReviewTeacherVideoStage teacher="slate" ref={videoRef}', sidebar)
  const progress = slate.indexOf('<aside className={styles.progressPanel} aria-label="Lesson progress"', sidebar)
  const heading = slate.indexOf('YOUR PROGRESS', progress)
  assert.ok(main >= 0 && section > main && transcript > section)
  assert.ok(sidebar > transcript && video > sidebar && progress > video && heading > progress)
  assert.doesNotMatch(slate.slice(section, sidebar), /ReviewTeacherVideoStage/)
  assert.match(slate, /<ReviewTeacherVideoStage teacher="slate" ref=\{videoRef\} style=\{\{ width: '100%', margin: 0 \}\} \/>/)
})

test('desktop viewport is a fixed-height two-column shell below its header', () => {
  assert.match(slate, /className=\{styles\.sessionShell\}/)
  assert.match(slate, /className=\{styles\.sessionMain\}/)
  assert.match(layout, /\.sessionMain\s*\{[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?align-items:\s*flex-start;/)
  assert.match(layout, /@media \(min-width: 900px\), \(min-width: 700px\) and \(orientation: landscape\)/)
  assert.match(layout, /\.sessionShell\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?height:\s*calc\(100dvh - clamp\(56px, 9svh, 72px\)\);[\s\S]*?overflow:\s*hidden;/)
  assert.match(layout, /@media \(min-width: 700px\) and \(orientation: landscape\) and \(max-height: 820px\)[\s\S]*?height:\s*calc\(100dvh - clamp\(48px, 8svh, 60px\)\);/)
  assert.match(layout, /\.sessionMain\s*\{[\s\S]*?flex-wrap:\s*nowrap;[\s\S]*?align-items:\s*stretch;[\s\S]*?overflow:\s*hidden;/)
  assert.match(layout, /\.contentColumn\s*\{[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/)
})

test('transcript grows above the Liftoff and test bottom answer forms', () => {
  assert.match(slate, /className=\{styles\.contentColumn\}/)
  assert.match(slate, /className=\{styles\.transcriptColumn\}/)
  assert.match(layout, /\.transcriptColumn\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/)
  assert.match(layout, /\.transcriptColumn \[data-ms-caption-panel-container\]\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?height:\s*auto !important;[\s\S]*?max-height:\s*none !important;/)
  assert.match(layout, /\.contentColumn > \[data-slate-primary-answer-form\],\s*\.contentColumn > \[data-slate-test-answer-form\]\s*\{[\s\S]*?flex-shrink:\s*0;/)
  assert.ok(slate.includes("stackedHeight={isAssessment ? (assessmentWrittenAnswerMode ? 'min(52dvh, 480px)' : 'min(72dvh, 720px)')"))
})

test('right progress panel fills remaining height under the video and scrolls inside its own area', () => {
  assert.match(layout, /\.sidebarColumn\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/)
  assert.match(layout, /\.sidebarColumn\s*\{[\s\S]*?align-self:\s*stretch;[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?overflow:\s*hidden;/)
  assert.match(layout, /\.progressPanel\s*\{[\s\S]*?flex:\s*1 1 auto;[\s\S]*?min-height:\s*0;[\s\S]*?overflow-y:\s*auto;/)
})

test('mobile remains a naturally scrollable stack; independent test and line help remain accessible', () => {
  assert.match(slate, /data-slate-scroll-mode=\{isAssessment \? 'test' : \(lineHelpTarget \? 'help' : 'active'\)\}/)
  assert.match(layout, /\.contentColumn\[data-slate-scroll-mode='test'\]\s*\{\s*overflow:\s*hidden;/)
  assert.match(layout, /\.contentColumn\[data-slate-scroll-mode='test'\] \.transcriptColumn\s*\{\s*flex:\s*1 1 auto;[\s\S]*?overflow:\s*hidden;/)
  assert.doesNotMatch(layout, /\.contentColumn\[data-slate-scroll-mode='test'\] \.transcriptColumn \[data-ms-caption-panel-container\][\s\S]*?height:\s*clamp\(150px, 25vh, 260px\) !important;/)
  assert.doesNotMatch(layout.split('@media')[0], /height:\s*100dvh|overflow:\s*hidden;/)
})

test('test question math remains in captions while written answer shares Liftoff bottom layout', () => {
  assert.match(slate, /tailContent=\{isAssessment \? assessmentTranscriptContent : activeMathTranscriptContent\}/)
  assert.match(slate, /data-slate-active-math-transcript-tail[\s\S]*<VerticalMathWorkspace/)
  assert.match(slate, /data-slate-primary-answer-form/)
  assert.match(slate, /placeholder="Show your thinking or answer Mr\. Slate\."/)
  assert.match(slate, /<form data-slate-primary-answer-form onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void submitLiftoffAnswer\(\) \}\}/)
  assert.match(slate, /<form\s+data-slate-test-answer-form\s+onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void submitAssessmentAnswer\(\) \}\}/)
  assert.match(slate, /notes=\{assessmentScratchNotes\}/)
  assert.equal((slate.match(/ref=\{videoRef\}/g) || []).length, 2)
})


test('white screen gutters and root wrapper gap are removed only for Mr. Slate Liftoff', () => {
  assert.match(layout, /:global\(html\):has\(\.sessionShell\),\s*:global\(body\):has\(\.sessionShell\)\s*\{[\s\S]*?scrollbar-gutter:\s*auto !important;[\s\S]*?background-color:\s*#0d1117;/)
  assert.match(layout, /:global\(body\) > div:has\(> \.sessionShell\)\s*\{[\s\S]*?padding-top:\s*0 !important;/)
  assert.doesNotMatch(layout, /:global\(html\)\s*\{[\s\S]*?scrollbar-gutter/)
  assert.match(layout, /height:\s*calc\(100dvh - clamp\(56px, 9svh, 72px\)\);/)
  assert.match(layout, /height:\s*calc\(100dvh - clamp\(48px, 8svh, 60px\)\);/)
})
