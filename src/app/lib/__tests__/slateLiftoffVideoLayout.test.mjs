import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const slate = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.jsx'), 'utf8')
const layout = fs.readFileSync(path.resolve('src/app/session/slate/SlateLiftoffExperience.module.css'), 'utf8')

test('Slate Liftoff places video left and transcript right at landscape widths', () => {
  assert.match(slate, /import styles from '\.\/SlateLiftoffExperience\.module\.css'/)
  const rowStart = slate.indexOf('className={styles.videoTranscriptLayout}')
  const videoIndex = slate.indexOf('<ReviewTeacherVideoStage teacher="slate" ref={videoRef} />', rowStart)
  const transcriptIndex = slate.indexOf('<CaptionPanel', rowStart)
  assert.ok(rowStart >= 0)
  assert.ok(videoIndex > rowStart)
  assert.ok(transcriptIndex > videoIndex)
  assert.match(slate, /className=\{styles\.videoColumn\}/)
  assert.match(slate, /className=\{styles\.transcriptColumn\}/)
  assert.match(layout, /grid-template-columns:\s*clamp\(250px, 27vw, 330px\) minmax\(0, 1fr\)/)
})

test('Slate Liftoff stacks on narrow portrait screens and bounds the wider transcript', () => {
  assert.match(layout, /\.videoTranscriptLayout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/)
  assert.match(layout, /@media \(min-width: 900px\), \(min-width: 700px\) and \(orientation: landscape\)/)
  assert.match(layout, /\.transcriptColumn[\s\S]*min-width:\s*0/)
  assert.match(layout, /\.transcriptColumn \[data-ms-caption-panel-container\][\s\S]*height:\s*54vh !important;[\s\S]*max-height:\s*54vh !important/)
  assert.match(slate, /stackedHeight=\{activeMathSpec \? 'clamp\(260px, 42vh, 460px\)' : null\}/)
})

test('layout wrapper preserves transcript math tail and original answer forms', () => {
  assert.match(slate, /tailContent=\{activeMathTranscriptContent\}/)
  assert.match(slate, /data-slate-active-math-transcript-tail[\s\S]*<VerticalMathWorkspace/)
  assert.match(slate, /data-slate-primary-answer-form/)
  assert.match(slate, /placeholder="Show your thinking or answer Mr\. Slate\."/)
  assert.match(slate, /<form data-slate-primary-answer-form onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void submitLiftoffAnswer\(\) \}\}/)
  assert.match(slate, /<form onSubmit=\{\(event\) => \{ event\.preventDefault\(\); void submitAssessmentAnswer\(\) \}\}/)
  assert.match(slate, /notes=\{assessmentMathWorkingNotes\?\.activityId === assessmentMathSession\.activityId/)
})
