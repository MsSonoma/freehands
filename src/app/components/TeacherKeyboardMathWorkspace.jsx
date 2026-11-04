'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSonomaKeyboard } from './SonomaKeyboard'
import SlateManualScratch from '../session/slate/SlateManualScratch'
import { initialSlateManualScratch } from '../lib/slateManualScratch.mjs'
import {
  restoreTeacherKeyboardMath, teacherKeyboardMathActivityId, teacherKeyboardMathKey,
} from '../lib/teacherKeyboardMath.mjs'

const TEACHER_THEMES = Object.freeze({
  sonoma: { label: 'Ms. Sonoma Keyboard', background: '#f8e9e5', color: '#722b21', accent: '#c7442e' },
  webb: { label: 'Mrs. Webb Keyboard', background: '#e4f2f0', color: '#134e4a', accent: '#0d9488' },
})

export default function TeacherKeyboardMathWorkspace({
  teacher, learnerId, lessonKey, occurrenceId = '', phase = 'teaching',
  enabled = false, disabled = false, onLearnerActivity,
}) {
  const keyboard = useSonomaKeyboard()
  const theme = TEACHER_THEMES[teacher]
  const storageKey = useMemo(() => teacherKeyboardMathKey({
    teacher, learnerId, lessonKey, occurrenceId, phase,
  }), [teacher, learnerId, lessonKey, occurrenceId, phase])
  const activityId = useMemo(() => teacherKeyboardMathActivityId(storageKey), [storageKey])
  const [record, setRecord] = useState(() => ({ key: null, draft: initialSlateManualScratch() }))
  const [storageError, setStorageError] = useState('')

  // Only restore the current occurrence's work. A previous lesson's draft must
  // never be rendered, even for one frame, while the key is changing.
  useEffect(() => {
    if (!enabled || !storageKey) {
      setRecord({ key: null, draft: initialSlateManualScratch() })
      return
    }
    let raw = null
    try {
      raw = JSON.parse(localStorage.getItem(storageKey) || 'null')
      setStorageError('')
    } catch {
      setStorageError('Saved scratch work could not be read.')
    }
    setRecord({ key: storageKey, draft: restoreTeacherKeyboardMath(raw, storageKey, phase) })
  }, [enabled, storageKey, phase])

  // The existing keyboard owns the dock's height and layout. This does not
  // add any second panel above the transcript or change Mr. Slate's dock.
  useEffect(() => {
    if (!enabled || !storageKey || record.key !== storageKey || !theme) return undefined
    keyboard.setWorkspaceDock({ label: theme.label })
    return () => keyboard.setWorkspaceDock(null)
  }, [enabled, storageKey, record.key, theme, keyboard.setWorkspaceDock])

  const updateDraft = useCallback((next) => {
    if (!enabled || !storageKey || record.key !== storageKey) return
    setRecord({ key: storageKey, draft: next })
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      setStorageError('')
    } catch {
      setStorageError('Scratch work could not be saved on this device.')
    }
    onLearnerActivity?.()
  }, [enabled, storageKey, record.key, onLearnerActivity])

  if (!enabled || !storageKey || record.key !== storageKey || !theme ||
      keyboard.active?.layout !== 'math' || !keyboard.workspacePortal) return null

  return createPortal(
    <div data-teacher-keyboard-math-workspace={teacher}>
      {!keyboard.canUseMathResult && (
        <div role="status" style={{ fontSize: 11, marginBottom: 5, color: '#475569' }}>
          Tap your answer box to use a result.
        </div>
      )}
      {storageError && <div role="status" style={{ fontSize: 11, color: '#9a3412' }}>{storageError}</div>}
      <SlateManualScratch
        draft={record.draft}
        activityId={activityId}
        phase={phase === 'test' ? 'test' : 'teaching'}
        onChange={updateDraft}
        onUseResult={keyboard.insertMathResult}
        keyboardTheme={theme}
        disabled={disabled}
        transferEnabled={keyboard.canUseMathResult}
      />
    </div>,
    keyboard.workspacePortal,
  )
}
