import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../../HeaderBar.js', import.meta.url), 'utf8')

test('facilitator header menu reflects the Syllabus-first information architecture', () => {
  const start = source.indexOf('const FACILITATOR_MENU_ITEMS = Object.freeze([')
  const end = source.indexOf(']);', start)
  assert.ok(start >= 0 && end > start)
  const menu = source.slice(start, end)

  const expected = [
    ['Syllabus', '/facilitator/syllabus'],
    ['Month View', '/facilitator/calendar'],
    ['Learners', '/facilitator/learners'],
    ['Lesson Library', '/facilitator/lessons'],
    ['Mr. Mentor', '/facilitator/mr-mentor'],
    ['Notifications', '/facilitator/notifications'],
    ['Account', '/facilitator/account'],
  ]

  let cursor = 0
  for (const [label, href] of expected) {
    const next = menu.indexOf(`label: '${label}', href: '${href}'`, cursor)
    assert.ok(next >= cursor, `${label} should appear in canonical order`)
    cursor = next + 1
  }

  assert.match(menu, /label: 'Syllabus'.*primary: true/)
  assert.match(menu, /label: 'Notifications'.*dividerBefore: true/)
  assert.doesNotMatch(menu, /label: 'Lessons'/)
  assert.doesNotMatch(menu, /label: 'Calendar'/)
})

test('desktop and mobile render the same canonical facilitator menu without icon mojibake', () => {
  assert.equal((source.match(/FACILITATOR_MENU_ITEMS\.map\(/g) || []).length, 2)
  assert.match(source, /handleFacilitatorMenuItemClick = useCallback/)
  assert.equal((source.match(/handleFacilitatorMenuItemClick\(event/g) || []).length, 2)
  assert.doesNotMatch(source, /<span aria-hidden="true">/)
  assert.doesNotMatch(source, />Lessons<\/Link>/)
  assert.doesNotMatch(source, />Calendar<\/Link>/)
})