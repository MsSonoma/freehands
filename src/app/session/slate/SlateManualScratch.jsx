'use client'

import { useMemo } from 'react'
import { useSonomaKeyboard } from '@/app/components/SonomaKeyboard'
import VerticalMathWorkspace from '@/components/math/VerticalMathWorkspace'
import { updateMathSessionView } from '@/lib/math/mathSession.mjs'
import { sanitizeVerticalMathWorkingNotes } from '@/lib/math/verticalMathNotes.mjs'
import { buildSlateManualScratch, slateManualOperationChoices } from '@/app/lib/slateManualScratch.mjs'
import { SLATE_SCRATCH_OPERATIONS } from '@/app/lib/slateMathScratch.mjs'
import { slateMathWorkspaceResult } from '@/app/lib/slateMathDraft.mjs'
import { sanitizeMultiplicationScratchEntries } from '@/lib/math/multiplicationScratch.mjs'

const SIGNS = { addition: '+', subtraction: '\u2212', multiplication: '\u00d7', division: '\u00f7' }

export default function SlateManualScratch({
  draft, activityId, phase, onChange, onUseResult, disabled = false, allowTransfer = true,
}) {
  const sonomaKeyboard = useSonomaKeyboard()
  const openScratchNumberPad = (event, onChange) => sonomaKeyboard.open({
    ref: { current: event.currentTarget }, onChange, layout: 'number',
    theme: { label: 'Mr. Slate Keyboard', background: '#1e293b', color: '#e2e8f0', accent: '#d97706' },
  })
  const model = useMemo(() => buildSlateManualScratch(draft, activityId, phase), [draft, activityId, phase])
  const options = useMemo(() => slateManualOperationChoices(draft.operands), [draft.operands])
  const negativeSubtraction = draft.operation === 'subtraction' &&
    draft.operands.every((number) => /^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(number)) &&
    Number(draft.operands[0].replaceAll(',', '')) < Number(draft.operands[1].replaceAll(',', ''))
  const result = model ? slateMathWorkspaceResult(model.problem, model.session.view) : null

  function setOperand(index, value) {
    if (value.length > 26 || !/^[0-9.,]*$/.test(value)) return
    const operands = [...draft.operands]
    operands[index] = value
    onChange({ ...draft, operands, session: null, notes: {}, partialEntries: {} })
  }
  function setOperation(operation) {
    if (!SLATE_SCRATCH_OPERATIONS.includes(operation) || (model && !options.includes(operation))) return
    onChange({ ...draft, operation, session: null, notes: {}, partialEntries: {} })
  }
  function setView(view) {
    if (!model) return
    const updated = updateMathSessionView(model.session, view, {
      activityId: model.session.activityId, expectedRevision: model.session.revision,
      requestId: 'manual-input:' + (globalThis.crypto?.randomUUID?.() || String(Date.now()) + '-' + Math.random()),
    })
    if (updated.ok) onChange({ ...draft, session: updated.state })
  }

  return <fieldset disabled={disabled} style={{ border: 0, padding: 0, margin: '10px 0 0', minWidth: 0 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
      <input aria-label="First scratch number" placeholder="Number 1" data-sonoma-input inputMode="none" onPointerDown={(event) => openScratchNumberPad(event, (next) => setOperand(0, next))}
        value={draft.operands[0]} onChange={(event) => setOperand(0, event.target.value)}
        style={{ flex: '1 1 110px', minWidth: 0, maxWidth: 170, padding: 8 }} />
      {!model && <select aria-label="Change arithmetic operation" data-scratch-operation
        value={draft.operation} onChange={(event) => setOperation(event.target.value)}
        style={{ padding: 8, fontSize: 19 }}>
        {SLATE_SCRATCH_OPERATIONS.map((operation) =>
          <option key={operation} value={operation}>{SIGNS[operation]}</option>)}
      </select>}
      <input aria-label="Second scratch number" placeholder="Number 2" data-sonoma-input inputMode="none" onPointerDown={(event) => openScratchNumberPad(event, (next) => setOperand(1, next))}
        value={draft.operands[1]} onChange={(event) => setOperand(1, event.target.value)}
        style={{ flex: '1 1 110px', minWidth: 0, maxWidth: 170, padding: 8 }} />
    </div>
    {negativeSubtraction && <div role="status" style={{ marginBottom: 10 }}>
      This vertical subtraction grid does not support negative answers.
    </div>}
    {model && <VerticalMathWorkspace
      problem={model.problem} view={model.session.view} onViewChange={setView}
      notes={draft.notes} onNotesChange={(notes) =>
        onChange({ ...draft, notes: sanitizeVerticalMathWorkingNotes(notes) })}
      phase={phase} embeddedScratch showCheck={false} showFullAnswerInputs={false}
      onOpenNumberPad={openScratchNumberPad}
      operationChoices={options} onOperationChange={setOperation}
      scratchPartialEntries={draft.partialEntries || {}}
      onScratchPartialEntriesChange={(entries) => onChange({
        ...draft, partialEntries: sanitizeMultiplicationScratchEntries(model.problem, entries),
      })}
      footer={allowTransfer && <button type="button" disabled={!result}
        onClick={() => onUseResult?.(result)}>USE THIS RESULT IN ANSWER</button>}
    />}
  </fieldset>
}
