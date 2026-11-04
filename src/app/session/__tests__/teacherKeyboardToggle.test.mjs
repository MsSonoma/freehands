import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const root = new URL('../../', import.meta.url)
const read = (path) => readFileSync(new URL(path, root), 'utf8')

const header = read('HeaderBar.js')
const keyboard = read('components/SonomaKeyboard.jsx')
const webb = read('session/webb/page.jsx')
const studio = read('session/webb/WebbWritingStudio.jsx')

test('Ms. Sonoma exposes an accessible, branded header keyboard toggle', () => {
  assert.match(header, /data-ms-sonoma-keyboard-toggle/)
  assert.match(header, /pathname === '\/session' && \(/)
  assert.match(header, /sonomaKeyboard\.toggleKeyboard\(\{ label: 'Ms\. Sonoma Keyboard'/)
  assert.match(header, /aria-pressed=\{Boolean\(sonomaKeyboard\.active\)\}/)
})

test('Mrs. Webb exposes the same toggle in both chat and writing', () => {
  for (const source of [webb, studio]) {
    assert.match(source, /sonomaKeyboard\.toggleKeyboard\(\{ label: 'Mrs\. Webb Keyboard'/)
    assert.match(source, /data-sonoma-keyboard-toggle/)
    assert.match(source, /aria-label=\{sonomaKeyboard\.active \? 'Hide keyboard' : 'Show keyboard'\}/)
  }
  assert.match(studio, /data-ms-webb-writing-keyboard-toggle/)
  assert.match(studio, /data-sonoma-input/)
  assert.match(studio, /onPointerDown=\{\(event\) => sonomaKeyboard\.open\(/)
  assert.match(studio, /onDraftChange\?\.\(next\)/)
  assert.match(studio, /\}, \{ ref: inputRef, layout: 'text'/)
  assert.match(keyboard, /const preferredUsable = preferredField\?\.isConnected/)
})

test('explicit toggle opens without a desktop math dock and keeps a manual no-input state', () => {
  assert.doesNotMatch(keyboard, /if \(!isTouchScreen\(\) && !workspaceDock\) return/)
  assert.match(keyboard, /if \(!isTouchScreen\(\) && !activeRef\.current && !\(workspaceDock && config\?\.layout === "math"\)\) return/)
  assert.match(keyboard, /if \(!workspaceDock && active\?\.ref\?\.current && !active\.ref\.current\.isConnected\) close\(\)/)
  assert.match(keyboard, /config\?\.theme \|\| activeRef\.current\?\.theme/)
  assert.match(keyboard, /lastPathnameRef\.current = pathname/)
})
