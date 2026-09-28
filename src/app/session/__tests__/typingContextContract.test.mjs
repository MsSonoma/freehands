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
  assert.match(webb, /visible=\{typingViewport\.typing\}/)
  assert.match(webb, /maxItems=\{keyboardCompact \? 3 : 6\}/)
  assert.match(webb, /teacherLabel="Mrs\. Webb"/)
  assert.match(webb, /height: typingViewport\.typing && typingViewport\.visualHeight/)
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
  assert.match(context, /maxHeight: compact \? '40px' : 'min\(24dvh, 132px\)'/)
})

test('Webb writing studio follows the visible viewport and keeps recent context while the learner types', () => {
  assert.match(studio, /top: typingViewport\.offsetTop/)
  assert.match(studio, /width: typingViewport\.visualWidth/)
  assert.match(studio, /height: typingViewport\.visualHeight/)
  assert.match(studio, /entries=\{recentEntries\}/)
  assert.match(studio, /maxItems=\{keyboardCompact \? 2 : 6\}/)
  assert.match(studio, /position: keyboardCompact \? 'relative' : 'static'/)
  assert.match(webb, /recentEntries=\{transcript\}/)
})

test('Mrs. Webb switches both discussion and essay writing into a compact keyboard-visible layout', () => {
  assert.match(webb, /const keyboardCompact = typingViewport\.typing/)
  assert.match(webb, /flex: '0 0 22%'/)
  assert.match(webb, /padding: keyboardCompact \? '4px 7px 3px'/)
  assert.match(webb, /rows=\{compact \? 1 : 2\}/)
  assert.match(webb, /compact=\{keyboardCompact\}/)
  assert.match(studio, /const keyboardCompact = typingViewport\.typing/)
  assert.match(studio, /fontSize: keyboardCompact \? 12 : 17/)
  assert.match(studio, /fontSize: keyboardCompact \? 13 : 'clamp\(19px, 3\.4vw, 30px\)'/)
  assert.match(studio, /rows=\{keyboardCompact \? 2 : 4\}/)
  assert.match(studio, /minHeight: keyboardCompact \? 52 : 132/)
  assert.match(studio, /overflowY: keyboardCompact \? 'hidden' : 'auto'/)
  assert.ok((studio.match(/maxHeight: 44, overflowY: 'auto', flexShrink: 0/g) || []).length >= 1)
  assert.match(studio, /data-ms-webb-writing-compact/)
  assert.match(webb, /data-ms-webb-chat-compact/)
  assert.match(studio, />\s*Previous attempt\s*</)
  assert.match(studio, /compact=\{keyboardCompact\}/)
})

test('Mrs. Webb uses touch focus as a compact-layout fallback while Ms. Sonoma keeps geometry-only behavior', () => {
  assert.doesNotMatch(sonoma, /const keyboardCompact = typingViewport\.typing/)
  assert.match(webb, /const keyboardCompact = typingViewport\.typing/)
  assert.match(studio, /const keyboardCompact = typingViewport\.typing/)
  assert.match(webb, /useTypingViewport\(\{ preserveTouchFocus: true, blurDelayMs: 350 \}\)/)
  assert.match(studio, /useTypingViewport\(\{ preserveTouchFocus: true, blurDelayMs: 350 \}\)/)
})

test('Mrs. Webb can opt out of stale-touch blur recovery so a second tap can select or paste text', () => {
  assert.match(typingViewport, /preserveTouchFocus = false/)
  assert.match(typingViewport, /if \(!preserveTouchFocus\) document\.addEventListener\(touchIntentEvent, handleTouchIntent, true\)/)
  assert.match(typingViewport, /if \(!preserveTouchFocus\) document\.removeEventListener\(touchIntentEvent, handleTouchIntent, true\)/)
  assert.match(webb, /preserveTouchFocus: true/)
  assert.match(studio, /preserveTouchFocus: true/)
})

test('iPad text fields use at least 16px type to avoid Safari focus zoom', () => {
  assert.match(webb, /padding: compact \? '5px 8px' : '8px 12px', fontSize: 16/)
  assert.equal((sonoma.match(/fontSize: 'max\(16px, clamp\(0\.95rem, 1\.6vw, 1\.05rem\)\)'/g) || []).length, 3)
})
