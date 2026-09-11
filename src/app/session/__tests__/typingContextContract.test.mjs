import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const sonoma = fs.readFileSync(new URL('../v2/SessionPageV2.jsx', import.meta.url), 'utf8')
const webb = fs.readFileSync(new URL('../webb/page.jsx', import.meta.url), 'utf8')
const studio = fs.readFileSync(new URL('../webb/WebbWritingStudio.jsx', import.meta.url), 'utf8')
const context = fs.readFileSync(new URL('../components/TypingConversationContext.js', import.meta.url), 'utf8')
const typingViewport = fs.readFileSync(new URL('../hooks/useTypingViewport.js', import.meta.url), 'utf8')

test('Ms. Sonoma keeps six recent transcript entries with the input while touch typing', () => {
  assert.match(sonoma, /entries=\{transcriptLines\}/)
  assert.match(sonoma, /visible=\{typingViewport\.keyboardVisible\}/)
  assert.match(sonoma, /maxItems=\{6\}/)
  assert.match(sonoma, /teacherLabel="Ms\. Sonoma"/)
  assert.match(sonoma, /bottom: typingViewport\.keyboardVisible \? `\$\{typingViewport\.keyboardInset\}px` : 0/)
  assert.match(sonoma, /window\.visualViewport \|\| null/)
  assert.match(sonoma, /const layoutW = window\.innerWidth/)
  assert.match(sonoma, /const layoutH = window\.innerHeight/)
  assert.match(sonoma, /const isLandscape = layoutW > layoutH/)
})

test('Mrs. Webb keeps six recent conversation entries with the input while touch typing', () => {
  assert.match(webb, /entries=\{transcript\}/)
  assert.match(webb, /visible=\{typingViewport\.keyboardVisible\}/)
  assert.match(webb, /maxItems=\{6\}/)
  assert.match(webb, /teacherLabel="Mrs\. Webb"/)
  assert.match(webb, /height: typingViewport\.keyboardVisible && typingViewport\.visualHeight/)
})

test('touch sessions do not summon the software keyboard automatically', () => {
  assert.match(sonoma, /if \(!shouldAutoFocusTextInput\(\)\) return;/)
  assert.doesNotMatch(sonoma, /\bautoFocus\b/)
  assert.match(webb, /if \(!loading && shouldAutoFocusTextInput\(\)\)/)
  assert.match(studio, /if \(!shouldAutoFocusTextInput\(\)\) return undefined/)
})

test('shared typing context is bounded to the most recent conversation instead of duplicating the full transcript', () => {
  assert.match(context, /slice\(-Math\.max\(1, maxItems\)\)/)
  assert.match(context, /data-ms-typing-context/)
  assert.match(context, /Recent conversation/)
  assert.match(context, /maxHeight: 'min\(24dvh, 132px\)'/)
})

test('Webb writing studio follows the visible viewport and keeps recent context while the learner types', () => {
  assert.match(studio, /top: typingViewport\.offsetTop/)
  assert.match(studio, /width: typingViewport\.visualWidth/)
  assert.match(studio, /height: typingViewport\.visualHeight/)
  assert.match(studio, /entries=\{recentEntries\}/)
  assert.match(studio, /maxItems=\{6\}/)
  assert.match(studio, /position: typingViewport\.keyboardVisible \? 'sticky' : 'static'/)
  assert.match(webb, /recentEntries=\{transcript\}/)
})

test('lesson surfaces do not use text focus alone to keep keyboard context visible', () => {
  assert.doesNotMatch(sonoma, /typingViewport\.typing/)
  assert.doesNotMatch(webb, /typingViewport\.typing/)
  assert.doesNotMatch(studio, /typingViewport\.typing/)
})

test('touching a stale focused field releases focus before the native tap refocuses it', () => {
  assert.match(typingViewport, /releaseStaleTouchFocus/)
  assert.match(typingViewport, /doc\.activeElement !== target/)
  assert.match(typingViewport, /if \(measured\.keyboardVisible\) return false/)
  assert.match(typingViewport, /target\.blur\(\)/)
  assert.match(typingViewport, /typeof window\.PointerEvent === 'function' \? 'pointerdown' : 'touchstart'/)
  assert.match(typingViewport, /document\.addEventListener\(touchIntentEvent, handleTouchIntent, true\)/)
  assert.match(typingViewport, /document\.removeEventListener\(touchIntentEvent, handleTouchIntent, true\)/)
  assert.doesNotMatch(typingViewport, /handleTouchIntent[\s\S]{0,500}preventDefault/)
})

test('iPad text fields use at least 16px type to avoid Safari focus zoom', () => {
  assert.match(webb, /padding: '8px 12px', fontSize: 16/)
  assert.equal((sonoma.match(/fontSize: 'max\(16px, clamp\(0\.95rem, 1\.6vw, 1\.05rem\)\)'/g) || []).length, 3)
})
