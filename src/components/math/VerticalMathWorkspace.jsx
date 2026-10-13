'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import {
  enterVerticalMathCell,
  enterVerticalMathFullAnswer,
  enterVerticalMathRowAnswer,
  evaluateVerticalMath,
  validateVerticalMathExercise,
} from '@/lib/math/verticalMath.mjs'
import {
  listVerticalMathWorkingNoteSlots,
  sanitizeVerticalMathWorkingNotes,
  updateVerticalMathWorkingNote,
} from '@/lib/math/verticalMathNotes.mjs'
import styles from './VerticalMathWorkspace.module.css'

const MULTIPLICATION = '\u00d7'
const SCRATCH_SYMBOLS = { addition: '+', subtraction: '\u2212', multiplication: MULTIPLICATION, division: '\u00f7' }

/** One teacher-neutral renderer for every supported operation engine. */
export default function VerticalMathWorkspace({
  problem, view, onViewChange, onCellSelect, selectedLocation = null, phase = 'teaching', onCheck,
  showCheck = true, showFullAnswerInputs = true, notes, onNotesChange,
  embeddedScratch = false, footer = null, onOperationChange = null, operationChoices = [],
}) {
  const inputId = useId()
  const [fullAnswer, setFullAnswer] = useState('')
  const [divisionAnswer, setDivisionAnswer] = useState({ quotient: '', remainder: '' })
  const [entryMessage, setEntryMessage] = useState('')
  const [lastCheck, setLastCheck] = useState(null)
  const [localNotes, setLocalNotes] = useState({})

  useEffect(() => {
    setFullAnswer('')
    setDivisionAnswer({ quotient: '', remainder: '' })
    setEntryMessage('')
    setLastCheck(null)
    setLocalNotes({})
  }, [problem])

  useEffect(() => {
    setEntryMessage('')
    setLastCheck(null)
  }, [problem, phase, view.hidden, view.editable])

  const isTest = phase === 'test'
  const isDivision = problem.operation === 'division' && problem.layout?.type === 'long_division'
  const hidden = new Set(view.hidden)
  const editable = new Set(view.editable)
  const highlighted = new Set(view.highlighted)
  const operatorHidden = hidden.has('operator')
  const numberRows = [...problem.rows, problem.resultRow]
  const anyDecimalHidden = numberRows.some((row) => hidden.has(row.id + '.decimal'))
  const validation = useMemo(
    () => validateVerticalMathExercise(problem, view),
    [problem, view.hidden, view.editable],
  )
  const workRows = problem.workRows || (problem.carryRow ? [problem.carryRow] : [])
  const noteSlots = useMemo(
    () => listVerticalMathWorkingNoteSlots(problem, view),
    [problem, view.hidden, view.editable],
  )
  const validNoteKeys = useMemo(() => noteSlots.map((slot) => slot.key), [noteSlots])
  const workingNotes = sanitizeVerticalMathWorkingNotes(
    notes === undefined ? localNotes : notes,
    { validKeys: validNoteKeys },
  )
  const noteSlotByCell = new Map(noteSlots.map((slot) => [slot.cellId, slot]))
  const entireResultEditable = problem.resultRow.cells.every((cell) => editable.has(cell.id))
  const divisionAnswersEditable = isDivision && problem.answerRows?.every((row) =>
    row.cells.every((cell) => editable.has(cell.id)))
  const replacementPlaces = new Set(
    problem.operation === 'subtraction'
      ? workRows.filter((row) => row.id === 'regroup').flatMap((row) =>
        row.cells.filter((cell) => cell.value !== null && !hidden.has(cell.id)).map((cell) => cell.place))
      : [],
  )

  function updateView(next) {
    onViewChange(next)
    setLastCheck(null)
    setEntryMessage('')
  }

  function enterSymbol(location, value) {
    const result = enterVerticalMathCell(problem, view, location, value)
    if (result.ok) updateView(result.view)
    else setEntryMessage(result.error)
  }

  function changeWorkingNote(slot, value) {
    const next = updateVerticalMathWorkingNote(workingNotes, slot.key, value, {
      validKeys: validNoteKeys,
    })
    if (notes === undefined) setLocalNotes(next)
    onNotesChange?.(next)
  }

  function workingNoteNode(cell) {
    const slot = noteSlotByCell.get(cell.id)
    if (!slot) return null
    return <input
      className={problem.operation === 'subtraction' ? styles.replacementNote : styles.workingNote}
      type="text" inputMode="numeric" pattern="[0-9]*" maxLength={2}
      value={workingNotes[slot.key] ?? ''} aria-label={slot.label} autoComplete="off"
      data-working-note={slot.key}
      onChange={(event) => changeWorkingNote(slot, event.target.value)}
    />
  }

  function cellNode(cell, decimalConcealed) {
    const isHidden = hidden.has(cell.id)
    const isEditable = editable.has(cell.id) && isHidden
    const publicCellName = decimalConcealed ? cell.row + '.slot.' + cell.slot : cell.id
    const publicCellLabel = decimalConcealed
      ? 'physical slot ' + cell.slot + ' in ' + cell.row
      : cell.id
    const classes = [
      styles.cell,
      isEditable ? styles.editable : '',
      highlighted.has(cell.id) ? styles.highlighted : '',
      selectedLocation === cell.id ? styles.selected : '',
      cell.row === 'operand.1' && replacementPlaces.has(cell.place) ? styles.replaced : '',
      cell.row === 'operand.1' && workingNotes[noteSlotByCell.get(cell.id)?.key] ? styles.noteReplaced : '',
      cell.value === null && !isEditable ? styles.padding : '',
    ].filter(Boolean).join(' ')
    const maxLength = Number.isInteger(cell.inputCapacity) && cell.inputCapacity > 0
      ? cell.inputCapacity
      : (cell.kind === 'work' ? 2 : 1)

    if (isEditable) {
      return <input
        className={classes} type="text" inputMode="numeric" pattern="[0-9]*"
        maxLength={maxLength} value={view.entries[cell.id] ?? ''}
        aria-label={'Enter ' + publicCellLabel} title={publicCellLabel} autoComplete="off"
        data-cell-id={publicCellName}
        onFocus={() => onCellSelect?.(cell.id)}
        onChange={(event) => {
          const result = enterVerticalMathCell(problem, view, cell.id, event.target.value)
          if (result.ok) updateView(result.view)
          else setEntryMessage(result.error)
        }}
      />
    }
    if (!isHidden && cell.value !== null) {
      return <button
        type="button" className={classes + ' ' + styles.given}
        title={publicCellLabel} aria-label={'Select ' + publicCellLabel}
        data-cell-id={publicCellName}
        disabled={!onCellSelect} onClick={() => onCellSelect?.(cell.id)}
      >{cell.value}</button>
    }
    return <span className={classes} aria-hidden="true" data-cell-id={publicCellName} />
  }

  function scratchOperationSelect(extraClass = '') {
    return <select
      className={[styles.scratchOperationSelect, extraClass].filter(Boolean).join(' ')}
      aria-label="Change arithmetic operation" title="Change arithmetic operation"
      value={problem.operation} data-scratch-operation
      onChange={(event) => onOperationChange?.(event.target.value)}
    >
      {operationChoices.map((operation) => <option key={operation} value={operation}>{SCRATCH_SYMBOLS[operation]}</option>)}
    </select>
  }

  function operatorNode(symbol, isDesignatedOperatorRow) {
    if (!isDesignatedOperatorRow) {
      return !operatorHidden && symbol
        ? <span className={styles.operator} aria-hidden="true">{symbol}</span>
        : <span className={styles.operator} aria-hidden="true" />
    }
    const requested = editable.has('operator')
    const classes = [
      styles.operator,
      operatorHidden ? styles.operatorTarget : '',
      operatorHidden && requested ? styles.editable : '',
      highlighted.has('operator') ? styles.highlighted : '',
      selectedLocation === 'operator' ? styles.selected : '',
    ].filter(Boolean).join(' ')
    if (!operatorHidden && onOperationChange) return scratchOperationSelect()
    if (!operatorHidden) return <button
      type="button" className={classes + ' ' + styles.given}
      aria-label="Select arithmetic symbol" title="Arithmetic symbol"
      data-symbol-id="operator" disabled={!onCellSelect}
      onClick={() => onCellSelect?.('operator')}
    >{symbol}</button>
    if (!requested) return <span className={classes} data-symbol-id="operator" aria-hidden="true" />
    return <select
      className={classes} value={view.entries.operator ?? ''}
      aria-label="Choose arithmetic symbol" title="Arithmetic symbol"
      data-symbol-id="operator"
      onFocus={() => onCellSelect?.('operator')}
      onChange={(event) => enterSymbol('operator', event.target.value)}
    >
      <option value="">&nbsp;</option>
      <option value="+">+</option>
      <option value="-">-</option>
      <option value={MULTIPLICATION}>{MULTIPLICATION}</option>
    </select>
  }

  function decimalDot(row, cell) {
    if (row.kind === 'work') return null
    const location = row.id + '.decimal'
    const concealed = hidden.has(location)
    const boundary = concealed
      ? (editable.has(location) ? view.entries[location] : undefined)
      : String(row.cells.find((item) => item.place === 0)?.slot ?? 0)
    if (boundary === undefined || boundary === '0' || String(cell.slot) !== boundary) return null
    return <span className={styles.overlayDecimal} aria-hidden="true">.</span>
  }

  function decimalChoices(row, showMultiplicationLabel) {
    const location = row.id + '.decimal'
    if (!hidden.has(location) || !editable.has(location)) return null
    const selected = view.entries[location]
    return <div className={styles.decimalChoiceRow} data-decimal-target={location}>
      {showMultiplicationLabel && <span className={styles.rowLabel} aria-hidden="true" />}
      <span className={styles.operator} aria-hidden="true" />
      <div className={styles.decimalChoices} role="group" aria-label={'Choose decimal placement for ' + row.id}>
        {row.cells.map((cell) => {
          const value = String(cell.slot)
          const label = cell.slot === 0 ? 'No decimal' : 'Place decimal with ' + cell.slot + ' digits to the right'
          return <button type="button" key={value}
            className={[
              styles.decimalChoice,
              selected === value ? styles.decimalChoiceSelected : '',
              highlighted.has(location) ? styles.highlighted : '',
              selectedLocation === location ? styles.selected : '',
            ].filter(Boolean).join(' ')}
            aria-label={label} title={label} aria-pressed={selected === value}
            data-decimal-slot={value}
            onFocus={() => onCellSelect?.(location)}
            onClick={() => enterSymbol(location, value)}
          >{cell.slot === 0 ? 'None' : cell.slot}</button>
        })}
      </div>
    </div>
  }

  function rowNode(row) {
    const isDesignatedOperatorRow = row.id === problem.rows.at(-1)?.id
    const symbol = row.operator ?? (isDesignatedOperatorRow ? problem.operator : '')
    const isMultiplication = problem.operation === 'multiplication'
    const isCoefficientWorkRow = isMultiplication && [
      'multiplication_carry', 'partial_product', 'sum_carry',
    ].includes(row.role)
    const decimalConcealed = hidden.has(row.id + '.decimal')
    const multiplicationLabel = isMultiplication && !operatorHidden
      ? row.role === 'multiplication_carry'
        ? 'Carry ' + row.rowIndex
        : row.role === 'partial_product'
          ? 'Partial ' + row.rowIndex
          : row.role === 'sum_carry'
            ? 'Sum carry'
            : ''
      : null
    return <>
      <div className={[
        styles.mathRow,
        problem.operation === 'subtraction' && row.id === 'operand.1' && noteSlots.length
          ? styles.replacementTargetRow
          : '',
      ].filter(Boolean).join(' ')} role="row" aria-label={operatorHidden ? 'Number row' : (row.label || row.id)}
        data-row-id={row.id} data-row-role={operatorHidden ? undefined : (row.role || row.kind)}
        data-decimal-mode={anyDecimalHidden && row.kind !== 'work' ? 'overlay' : undefined}
        data-decimal-row={anyDecimalHidden && row.kind !== 'work' ? row.id : undefined}>
        {multiplicationLabel !== null && <span className={styles.rowLabel} aria-hidden="true">{multiplicationLabel}</span>}
        {operatorNode(symbol, isDesignatedOperatorRow)}
        {row.cells.map((cell) => <span className={styles.cellWrapper} role="cell" key={cell.id}
          data-slot={cell.slot}>
          {cellNode(cell, decimalConcealed)}
          {workingNoteNode(cell)}
          {anyDecimalHidden
            ? decimalDot(row, cell)
            : isMultiplication
              ? !isCoefficientWorkRow && row.decimalPlaces > 0 && cell.place === 0 && <span className={styles.multiplicationDecimal} aria-hidden="true">.</span>
              : cell.place === 0 && problem.fractionDigits > 0 && <span className={row.kind === 'work' ? styles.decimalGhost : styles.decimal} aria-hidden="true">.</span>}
        </span>)}
      </div>
      {decimalChoices(row, isMultiplication && !operatorHidden)}
    </>
  }

  function divisionRowNode(row, label, {
    productRule = false, bringDown = false, showLabel = true,
  } = {}) {
    return <div className={[
      styles.divisionLine,
      productRule ? styles.divisionProductLine : '',
      bringDown ? styles.divisionBringDownLine : '',
    ].filter(Boolean).join(' ')} role="row" aria-label={label}
    data-row-id={row.id} data-row-role={row.divisionRole || row.role || row.kind}>
      {showLabel && <span className={styles.divisionRowLabel} aria-hidden="true">
        {bringDown && <span className={styles.divisionArrow}>{'\u2193'}</span>}{label}
      </span>}
      {row.cells.map((cell) => <span className={styles.cellWrapper} role="cell" key={cell.id}
        data-slot={cell.slot}>{cellNode(cell, false)}</span>)}
    </div>
  }

  function divisionLayoutNode() {
    const dividend = problem.rows.find((row) => row.id === problem.layout.bracket.dividendRow)
    const divisor = problem.rows.find((row) => row.id === problem.layout.bracket.divisorRow)
    const quotient = problem.answerRows.find((row) => row.id === problem.layout.bracket.quotientRow)
    return <div className={styles.divisionAssembly} role="table" aria-label="Long division">
      <div className={styles.divisionDivisor}>
        <div className={styles.divisionDivisorSpacer}>
          {onOperationChange ? scratchOperationSelect(styles.scratchDivisionOperationSelect) : null}
        </div>
        <div className={styles.divisionDivisorRow} role="row" aria-label="Divisor" data-row-id={divisor.id}>
          {divisor.cells.filter((cell) => cell.value !== null).map((cell) =>
            <span className={styles.cellWrapper} role="cell" key={cell.id} data-slot={cell.slot}>
              {cellNode(cell, false)}
            </span>)}
        </div>
      </div>
      <div className={styles.divisionMain}>
        {divisionRowNode(quotient, 'Quotient')}
        <div className={styles.divisionBracket} data-division-bracket="long-division">
          {divisionRowNode(dividend, 'Dividend', { showLabel: false })}
          {problem.steps.map((step) => <div className={styles.divisionStep} key={step.index}
            data-division-step={step.index}>
            {step.rows.bringDown && divisionRowNode(rowsById.get(step.rows.bringDown),
              'Step ' + step.index + ' bring down', { bringDown: true })}
            {divisionRowNode(rowsById.get(step.rows.partial), 'Step ' + step.index + ' partial dividend')}
            {divisionRowNode(rowsById.get(step.rows.product), 'Step ' + step.index + ' product', { productRule: true })}
            {divisionRowNode(rowsById.get(step.rows.remainder), 'Step ' + step.index + ' remainder')}
          </div>)}
          {divisionRowNode(problem.remainderRow, 'Final remainder')}
        </div>
      </div>
    </div>
  }

  const rowsById = new Map([...problem.rows, ...workRows, problem.resultRow].map((row) => [row.id, row]))
  const normalLayout = problem.layout || [
    ...workRows.map((row) => ({ type: 'row', rowId: row.id })),
    ...problem.rows.map((row) => ({ type: 'row', rowId: row.id })),
    { type: 'rule', id: 'result-rule' },
    { type: 'row', rowId: problem.resultRow.id },
  ]
  const layout = operatorHidden
    ? [...problem.rows.map((row) => ({ type: 'row', rowId: row.id })), { type: 'rule', id: 'result-rule' }, { type: 'row', rowId: problem.resultRow.id }]
    : normalLayout

  function layoutNode(item, index) {
    if (item.type === 'rule') return <div className={styles.mathRule} aria-hidden="true" key={item.id || 'rule-' + index} />
    const row = rowsById.get(item.rowId)
    if (!row) return null
    if (problem.operation === 'subtraction' && row.id === 'regroup' &&
      !row.cells.some((cell) => (!hidden.has(cell.id) && cell.value !== null) || editable.has(cell.id))) return null
    const className = row.id === problem.resultRow.id
      ? styles.answerRow
      : (row.kind === 'work' && row.role !== 'partial_product' ? styles.workRow : '')
    return <div className={className} key={row.id}>{rowNode(row)}</div>
  }

  if (!validation.ok) {
    return <section className={styles.workspace} aria-label="Math activity adjustment needed">
      <div className={styles.adjustmentNotice} role="status">
        This activity needs a facilitator adjustment before it can be presented.
      </div>
    </section>
  }

  const neutralAria = operatorHidden ? 'Vertical math workspace' : 'Vertical ' + problem.operation + ' workspace'
  return <section className={styles.workspace} aria-label={neutralAria}>
    <div className={styles.scrollArea} tabIndex={0} aria-label="Scrollable vertical math grid">
      <div className={[
        styles.grid,
        embeddedScratch ? styles.scratchGrid : '',
        problem.operation === 'multiplication' && !operatorHidden ? styles.multiplicationGrid : '',
        isDivision ? styles.divisionGrid : '',
        anyDecimalHidden ? styles.overlayGrid : '',
      ].filter(Boolean).join(' ')} role="table"
      aria-label={operatorHidden ? 'Vertical math with ' + problem.rows.length + ' numbers' : problem.operation + ' with ' + problem.rows.length + ' numbers'}>
        {isDivision ? divisionLayoutNode() : layout.map(layoutNode)}
      </div>
    </div>
    <div className={[styles.bottomArea, embeddedScratch ? styles.scratchBottomArea : ''].filter(Boolean).join(' ')}>
      {showFullAnswerInputs && divisionAnswersEditable && <form className={styles.fullAnswerForm} onSubmit={(event) => {
        event.preventDefault()
        const quotientResult = enterVerticalMathRowAnswer(problem, view, problem.resultRow.id, divisionAnswer.quotient)
        if (!quotientResult.ok) return setEntryMessage(quotientResult.error)
        const remainderResult = enterVerticalMathRowAnswer(problem, quotientResult.view, problem.remainderRow.id, divisionAnswer.remainder)
        if (!remainderResult.ok) return setEntryMessage(remainderResult.error)
        updateView(remainderResult.view)
        setEntryMessage('Answer placed in the grid.')
      }}>
        <label htmlFor={inputId + '-quotient'}>Quotient and remainder</label>
        <div className={styles.fullAnswerControls}>
          <input id={inputId + '-quotient'} inputMode="numeric" autoComplete="off"
            value={divisionAnswer.quotient}
            onChange={(event) => setDivisionAnswer((answer) => ({ ...answer, quotient: event.target.value }))}
            placeholder="Quotient" aria-label="Quotient" />
          <input id={inputId + '-remainder'} inputMode="numeric" autoComplete="off"
            value={divisionAnswer.remainder}
            onChange={(event) => setDivisionAnswer((answer) => ({ ...answer, remainder: event.target.value }))}
            placeholder="Remainder" aria-label="Remainder" />
          <button type="submit">Apply</button>
        </div>
      </form>}
      {showFullAnswerInputs && !isDivision && entireResultEditable && !anyDecimalHidden && !operatorHidden && <form className={styles.fullAnswerForm} onSubmit={(event) => {
        event.preventDefault()
        const result = enterVerticalMathFullAnswer(problem, view, fullAnswer)
        if (!result.ok) return setEntryMessage(result.error)
        updateView(result.view)
        setEntryMessage('Answer placed in the grid.')
      }}>
        <label htmlFor={inputId}>Or type the entire answer</label>
        <div className={styles.fullAnswerControls}>
          <input id={inputId} inputMode="decimal" autoComplete="off"
            value={fullAnswer} onChange={(event) => setFullAnswer(event.target.value)}
            placeholder="Your answer" aria-label="Entire answer" />
          <button type="submit">Apply</button>
        </div>
      </form>}
      {(isTest || showCheck) && <div className={styles.bottomButtons}>
        {isTest
          ? <span className={styles.guidance}>Answer feedback is unavailable during a test.</span>
          : showCheck ? <>
            <button type="button" className={styles.checkButton} onClick={() => {
              const result = evaluateVerticalMath(problem, view)
              setLastCheck({ result, problem, view, phase })
              onCheck?.(result)
            }}>Check entries</button>
            <span className={styles.guidance}>Complete the requested spaces, then check your entries.</span>
          </> : null}
      </div>}
      {footer && <div className={styles.workspaceFooter}>{footer}</div>}
      {entryMessage && <p className={styles.message} role="status">{entryMessage}</p>}
      {!isTest && showCheck && lastCheck && lastCheck.problem === problem && lastCheck.view === view && lastCheck.phase === phase && <p className={styles.message} role="status">
        {!lastCheck.result.responseRequired
          ? 'No response is required for this demonstration.'
          : !lastCheck.result.complete
            ? lastCheck.result.missingLocations.length + ' required value(s) are blank.'
            : lastCheck.result.correct
              ? 'All entered values are correct.'
              : lastCheck.result.incorrectLocations.length + ' value(s) need another look.'}
      </p>}
    </div>
  </section>
}
