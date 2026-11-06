import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

const header = read('HeaderBar.js')
const keyboard = read('components/SonomaKeyboard.jsx')
const webb = read('session/webb/page.jsx')
const studio = read('session/webb/WebbWritingStudio.jsx')
const music = read('session/webb/WebbBackgroundMusicControl.jsx')

test('Ms. Sonoma exposes an accessible, branded header keyboard toggle', () => {
  assert.match(header, /data-ms-sonoma-keyboard-toggle/)
  assert.match(header, /pathname === '\/session' && \(/)
  assert.match(header, /sonomaKeyboard\.toggleKeyboard\(\{ label: 'Ms\. Sonoma Keyboard'/)
  assert.match(header, /aria-pressed=\{Boolean\(sonomaKeyboard\.active\)\}/)
})

test('Mrs. Webb keeps one working keyboard, timer, music, and exit toolbar above writing', () => {
  assert.match(webb, /data-ms-webb-session-header/)
  assert.match(webb, /zIndex: \(writingMode \|\| essayMode\) \? 1500/)
  assert.match(webb, /data-ms-webb-keyboard-toggle/)
  assert.match(webb, /sonomaKeyboard\.toggleKeyboard\(\{ label: 'Mrs\. Webb Keyboard'/)
  assert.match(webb, /document\.getElementById\('webb-writing-attempt'\)/)
  assert.match(webb, /aria-label=\{sonomaKeyboard\.active \? 'Hide keyboard' : 'Show keyboard'\}/)
  assert.match(webb, /<WebbBackgroundMusicControl compact=\{keyboardCompact\}/)
  assert.match(webb, /<WebbResponseTimer/)
  assert.match(webb, /onClick=\{handleBack\}/)
  assert.match(studio, /querySelector\('\[data-ms-webb-session-header\]'\)/)
  assert.match(studio, /top: headerBottom, left: 0, right: 0, bottom: 0/)
  assert.doesNotMatch(studio, /data-ms-webb-writing-keyboard-toggle/)
  assert.match(studio, /data-sonoma-input/)
  assert.match(studio, /onPointerDown=\{\(event\) => sonomaKeyboard\.open\(/)
  assert.match(keyboard, /const preferredUsable = preferredField\?\.isConnected/)
})
test('Mrs. Webb keeps original video audio buttons and adds writing-only header controls', () => {
  // The established music and speech buttons remain on the video overlay.
  assert.match(webb, /<WebbBackgroundMusicControl compact=\{keyboardCompact\} playTimerActive=/)
  assert.match(webb, /writingToolbarTarget=\{isChatting && \(writingMode \|\| essayMode\) \? writingAudioTarget : null\}/)
  assert.match(webb, /onClick=\{toggleMute\} aria-label=\{isMuted \? 'Unmute' : 'Mute'\}/)
  assert.doesNotMatch(webb, /\{isChatting && <WebbBackgroundMusicControl/)

  // Only the writing/finished-essay phase mounts a second set of controls in the header.
  assert.match(webb, /\{isChatting && \(writingMode \|\| essayMode\) && \(\s*<div ref=\{setWritingAudioTarget\} data-ms-webb-writing-audio-slot/)
  assert.match(webb, /\{isChatting && \(writingMode \|\| essayMode\) && \(\s*<button type="button" data-ms-webb-writing-voice-toggle/)
  assert.match(music, /writingToolbarTarget && createPortal\(/)
  assert.match(music, /data-ms-webb-writing-music-toggle/)
  assert.match(music, /writingShowVolume && \(/)
  assert.match(music, /onChange=\{handleVolumeChange\} aria-label="Writing background music volume"/)

  // Both buttons operate the same music player; they must never create overlapping Audio instances.
  assert.equal((webb.match(/<WebbBackgroundMusicControl /g) || []).length, 1)
  assert.equal((music.match(/new Audio\(/g) || []).length, 1)
  assert.match(music, /const nextMuted = !mutedRef\.current/)
  assert.match(music, /onClick=\{toggleMusic\}/)
})
test('explicit toggle opens without a desktop math dock and keeps a manual no-input state', () => {
  assert.doesNotMatch(keyboard, /if \(!isTouchScreen\(\) && !workspaceDock\) return/)
  assert.match(keyboard, /if \(!isTouchScreen\(\) && !activeRef\.current && !\(workspaceDock && config\?\.layout === "math"\)\) return/)
  assert.match(keyboard, /if \(!workspaceDock && active\?\.ref\?\.current && !active\.ref\.current\.isConnected\) close\(\)/)
  assert.match(keyboard, /config\?\.theme \|\| activeRef\.current\?\.theme/)
  assert.match(keyboard, /lastPathnameRef\.current = pathname/)
})
