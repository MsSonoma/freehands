import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseVideoDuration, mediaDurationLabel, videoEmbedUrl, articleDetailsFromId,
  normalizeMediaResource, approvedWebbMedia, workVideoChoices, articleHtmlFromExtract,
} from '../webbMedia.mjs'

const video = normalizeMediaResource({
  kind: 'video', id: 'AbCdEfGhI12', title: 'Math fractions',
  durationSeconds: 372, fitScore: 8, source: 'Example',
})
const article = normalizeMediaResource({
  kind: 'article', id: 'simple:Photosynthesis', title: 'Photosynthesis',
  wordCount: 420, fitScore: 9,
})

test('video duration is extracted from ISO 8601 metadata', () => {
  assert.equal(parseVideoDuration('PT6M12S'), 372)
  assert.equal(parseVideoDuration('PT1H2M3S'), 3723)
  assert.equal(parseVideoDuration('not-duration'), 0)
  assert.equal(mediaDurationLabel(video), '6:12')
  assert.equal(mediaDurationLabel(article), '3 min read')
})

test('media identifiers are validated before constructing content URL', () => {
  assert.match(videoEmbedUrl('AbCdEfGhI12'), /^https:\/\/www\.youtube-nocookie\.com\/embed\/AbCdEfGhI12/)
  assert.equal(videoEmbedUrl('https://evil.example'), '')
  assert.equal(normalizeMediaResource({ kind: 'video', id: 'invalid', title: 'x' }), null)
  assert.equal(normalizeMediaResource({ kind: 'article', id: 'https://invalid', title: 'x' }), null)
  assert.equal(articleDetailsFromId('simple:Photosynthesis').source, 'Simple Wikipedia')
})

test('work video availability requires explicit approval and is limited by usage', () => {
  const rows = [
    { status: 'pending', kind: 'video', resource: video, work_allowed: true },
    { status: 'approved', kind: 'video', resource: video, work_allowed: false },
    { status: 'approved', kind: 'article', resource: article, work_allowed: false },
  ]
  assert.equal(workVideoChoices(rows, false).length, 0)
  rows[1].work_allowed = true
  assert.equal(workVideoChoices(rows, false).length, 1)
  assert.equal(workVideoChoices(rows, true).length, 0)
  assert.equal(approvedWebbMedia(rows, 'article').length, 1)
})

test('article content is escaped rather than executing fetched markup', () => {
  const html = articleHtmlFromExtract('Science', 'A <script>bad()</script> & text')
  assert.ok(html.includes('&lt;script&gt;'))
  assert.ok(!html.includes('<script>bad()'))
})
