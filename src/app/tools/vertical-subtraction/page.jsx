'use client'

import { useState } from 'react'
import VerticalMathWorkspace from '@/components/math/VerticalMathWorkspace'
import {
  buildVerticalSubtractionProblem,
  createVerticalSubtractionView,
  applyVerticalSubtractionCommand,
} from '@/lib/math/verticalSubtraction.mjs'
import { verticalMathAddressCatalog } from '@/lib/math/verticalMath.mjs'
import styles from '../vertical-addition/page.module.css'

const EXAMPLES = {
  simple: ['875', '342'],
  zeros: ['1002', '879'],
  decimals: ['1.2', '0.35'],
  millions: ['9,999,999', '7,654,321'],
}
const INITIAL = EXAMPLES.zeros

export default function VerticalSubtractionToolPage() {
  const [numbers, setNumbers] = useState(INITIAL)
  const [problem, setProblem] = useState(() => buildVerticalSubtractionProblem(INITIAL))
  const [view, setView] = useState(() => createVerticalSubtractionView(buildVerticalSubtractionProblem(INITIAL)))
  const [selected, setSelected] = useState('result.ones')
  const [error, setError] = useState('')
  const [commandStatus, setCommandStatus] = useState('')

  function build(nextNumbers) {
    try {
      const nextProblem = buildVerticalSubtractionProblem(nextNumbers)
      setNumbers(nextNumbers)
      setProblem(nextProblem)
      setView(createVerticalSubtractionView(nextProblem))
      setSelected('result.ones')
      setError('')
      setCommandStatus('')
    } catch (cause) {
      setError(cause?.message || 'Could not construct the subtraction grid.')
    }
  }

  const catalog = verticalMathAddressCatalog(problem)
  const operatorMasked = view.hidden.includes('operator')

  function runAction(action, editable) {
    const command = action === 'clear_highlight'
      ? { action }
      : { action, locations: [selected], ...(action === 'hide' ? { editable } : {}) }
    const result = applyVerticalSubtractionCommand(problem, view, command, { requireUnique: true })
    if (!result.ok) {
      setCommandStatus(result.error)
      return
    }
    setView(result.view)
    setCommandStatus(action + ' applied to ' + (result.locations.length ? result.locations.join(', ') : 'highlights') + '.')
  }

  return <main className={styles.page}>
    <div className={styles.content}>
      <header className={styles.header}>
        {!operatorMasked && <p className={styles.eyebrow}>Shared math instrument · Subtraction</p>}
        <h1>{operatorMasked ? 'Vertical Arithmetic' : 'Vertical Subtraction'}</h1>
        {!operatorMasked && <p>Subtract two nonnegative numbers through the millions place. Borrowing
          is computed by the application, including regrouping across zeros and decimal places.
          Named digit positions can be hidden, revealed or highlighted independently.
        </p>}
      </header>
      {!operatorMasked && <section className={styles.panel} aria-labelledby="subtraction-editor-title">
        <h2 id="subtraction-editor-title">Numbers to subtract</h2>
        <div className={styles.inputs}>
          {numbers.map((number, index) => <div className={styles.numberRow} key={index}>
            <label htmlFor={'subtract-number-' + index}>{index === 0 ? 'From' : 'Subtract'}</label>
            <input
              id={'subtract-number-' + index} value={number} inputMode="decimal"
              onChange={(event) => {
                setNumbers((old) => old.map((value, i) => index === i ? event.target.value : value))
                setError('')
              }}
            />
          </div>)}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => build(numbers)}>Build / update grid</button>
        </div>
        <div className={styles.examples}>
          <span>Examples:</span>
          <button type="button" onClick={() => build(EXAMPLES.simple)}>No borrowing</button>
          <button type="button" onClick={() => build(EXAMPLES.zeros)}>Borrow across zeros</button>
          <button type="button" onClick={() => build(EXAMPLES.decimals)}>Decimals</button>
          <button type="button" onClick={() => build(EXAMPLES.millions)}>Millions</button>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>}
      <section className={styles.display} aria-labelledby="subtraction-grid-title">
        <h2 id="subtraction-grid-title">Math workspace</h2>
        <VerticalMathWorkspace
          problem={problem} view={view} onViewChange={setView}
          selectedLocation={selected} onCellSelect={setSelected}
        />
      </section>
      <section className={styles.panel} aria-labelledby="subtraction-command-title">
        <h2 id="subtraction-command-title">Named-location controls</h2>
        <p className={styles.description}>
          Choose a mathematical location or a whole row. Regrouping marks use the
          same hide, show and highlight commands as operand and result digits.
        </p>
        <label htmlFor="subtraction-location">Location</label>
        <select id="subtraction-location" value={selected}
          onChange={(event) => setSelected(event.target.value)}>
          <optgroup label="Entire rows">
            {catalog.groups.map((group) => <option key={group} value={group}>{group}</option>)}
          </optgroup>
          <optgroup label="Named digits and regrouping positions">
            {catalog.locations.map((id) => <option key={id} value={id}>{id}</option>)}
          </optgroup>
        </select>
        <div className={styles.actions}>
          <button type="button" onClick={() => runAction('hide', false)}>Conceal</button>
          <button type="button" onClick={() => runAction('hide', true)}>Ask learner</button>
          <button type="button" onClick={() => runAction('show')}>Reveal / lock</button>
          <button type="button" onClick={() => runAction('highlight')}>Highlight</button>
          <button type="button" onClick={() => runAction('clear_highlight')}>Clear highlight</button>
          <button type="button" onClick={() => {
            setView(createVerticalSubtractionView(problem))
            setCommandStatus('Grid reset. All result digits editable.')
          }}>Reset exercise</button>
        </div>
        {commandStatus && <p className={styles.status} role="status">{commandStatus}</p>}
      </section>
      <p className={styles.footnote}>
        This shared arithmetic instrument is a standalone testing surface;
        it is not yet connected to any teacher session.
      </p>
    </div>
  </main>
}
