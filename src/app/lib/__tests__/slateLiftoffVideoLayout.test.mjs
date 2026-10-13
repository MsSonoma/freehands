import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const slate = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')
const layout = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.module.css'), 'utf8')

test('Mr. Slate video is in the right column above the existing Your Progress panel', () => {
  assert.match(slate, /import styles from '\.\/SlateLiftoffExperience\.module\.css'/)
  const main = slate.indexOf('<main style=')
  const section = slate.indexOf('<section style=', main)
  const transcript = slate.indexOf('className={styles.transcriptColumn}', section)
  const sidebar = slate.indexOf('className={styles.sidebarColumn}', transcript)
  const video = slate.indexOf('<ReviewTeacherVideoStage teacher="slate" ref={videoRef}', sidebar)
  const progressPanel = slate.indexOf('<aside aria-label="Lesson progress"', sidebar)
  const heading = slate.indexOf('YOUR PROGRESS', progressPanel)

  assert.ok(main >= 0 && section > main)
  assert.ok(transcript > section && sidebar > transcript)
  assert.ok(video > sidebar && progressPanel > video && heading > progressPanel)
  // The completed-results screen retains its own separate video stage.
  assert.ok(slate.indexOf('<ReviewTeacherVideoStage teacher="slate"') < main)
  assert.equal((slate.slice(main).match(/<ReviewTeacherVideoStage teacher="slate"/g) || []).length, 1)
  assert.doesNotMatch(slate.slice(section, sidebar), /ReviewTeacherVideoStage/)
  assert.match(slate, /<ReviewTeacherVideoStage teacher="slate" ref=\{videoRef\} style=\{\{ width: '100%', margin: 0 \}\} \/>/)
})

test('right sidebar stacks video above progress and preserves the responsive two-column layout', () => {
  assert.match(layout, /\.sidebarColumn\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/)
  assert.match(layout, /\.sidebarColumn\s*\{[\s\S]*?gap:\s*14px;/)
  assert.match(layout, /\.transcriptColumn\s*\{[\s\S]*?min-width:\s*0;/)
  assert.doesNotMatch(layout, /videoTranscriptLayout|videoColumn/)
  assert.match(slate, /className=\{styles\.sidebarColumn\} style=\{\{ flex: '0 1 320px', minWidth: 'min\(260px, 100%\)', maxWidth: '100%' \}\}/)
  assert.match(slate, /<aside aria-label="Lesson progress" style=\{\{ background: C\.surface/)
})

test('transcript remains a tall scrollable area on wide screens and bounded on narrow screens', () => {
  assert.match(layout, /@media \(min-width: 900px\), \(min-width: 700px\) and \(orientation: landscape\)/)
  assert.match(layout, /\.transcriptColumn \[data-ms-caption-panel-container\][\s\S]*height:\s*54vh !important;[\s\S]*max-height:\s*54vh !important;/)
  assert.match(slate, /stackedHeight=\{activeMathSpec \? 'clamp\(260px, 42vh, 460px\)' : null\}/)
})

test('move preserves the embedded math grid, original answer bar, independent test and video ref', () => {
  assert.match(slate, /tailContent=\{activeMathTranscriptContent\}/)
  assert.match(slate, /data-slate-active-math-transcript-tail[\s\S]*<VerticalMathWorkspace/)
  assert.match(slate, /data-slate-primary-answer-form/)
  assert.match(slate, /placeholder="Show your thinking or answer Mr\. Slate\."/)
  assert.match(slate, /<form data-slate-primary-answer-form onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void submitLiftoffAnswer\(\) \}\}/)
  assert.match(slate, /<form onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void submitAssessmentAnswer\(\) \}\}/)
  assert.match(slate, /notes=\{assessmentMathWorkingNotes\?\.activityId === assessmentMathSession\.activityId/)
  assert.equal((slate.match(/ref=\{videoRef\}/g) || []).length, 2) // Results screen and active lesson retain their refs.
})
