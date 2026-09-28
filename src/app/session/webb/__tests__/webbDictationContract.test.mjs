import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync(new URL('../page.jsx', import.meta.url), 'utf8')
const studio = fs.readFileSync(new URL('../WebbWritingStudio.jsx', import.meta.url), 'utf8')
const dictation = fs.readFileSync(new URL('../WebbDictationButton.jsx', import.meta.url), 'utf8')
const stt = fs.readFileSync(new URL('../../../api/stt/route.js', import.meta.url), 'utf8')

test('Mrs. Webb exposes keyboard-free dictation in research and writing inputs', () => {
  assert.match(page, /import WebbDictationButton/)
  assert.match(page, /<WebbDictationButton[\s\S]{0,400}onBeforeRecord=\{\(\) => ref\.current\?\.blur\(\)\}/)
  assert.match(page, /setValue\(current => \[current\.trim\(\), text\]/)
  assert.match(studio, /import WebbDictationButton/)
  assert.match(studio, /<WebbDictationButton[\s\S]{0,400}onBeforeRecord=\{\(\) => inputRef\.current\?\.blur\(\)\}/)
  assert.match(studio, /onDraftChange\?\.\(next\)/)
})

test('Mrs. Webb dictation records a supported Opus container and uses the existing STT service', () => {
  assert.match(dictation, /audio\/webm;codecs=opus/)
  assert.match(dictation, /audio\/ogg;codecs=opus/)
  assert.match(dictation, /MediaRecorderCtor\.isTypeSupported/)
  assert.match(dictation, /navigator\.mediaDevices\.getUserMedia/)
  assert.match(dictation, /fetch\('\/api\/stt'/)
  assert.match(dictation, /onTranscript\?\.\(transcript\)/)
  assert.match(dictation, /Tap to talk without opening the keyboard/)
})

test('STT accepts both WebM Opus and Ogg Opus recordings', () => {
  assert.match(stt, /mediaType\.includes\('webm'\).*WEBM_OPUS/s)
  assert.match(stt, /mediaType\.includes\('ogg'\).*OGG_OPUS/s)
})
