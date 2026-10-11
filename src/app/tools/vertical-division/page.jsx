'use client'

import { useState } from 'react'
import VerticalMathWorkspace from '@/components/math/VerticalMathWorkspace'
import {
  applyVerticalDivisionCommand,
  buildVerticalDivisionProblem,
  createVerticalDivisionView,
} from '@/lib/math/verticalDivision.mjs'
import { verticalMathAddressCatalog } from '@/lib/math/verticalMath.mjs'
import styles from '../vertical-addition/page.module.css'

const DIVISION = '\u00f7'
const EXAMPLES = [
  ['84', '7'],
  ['1005', '5'],
  ['1005', '10'],
  ['7', '12'],
  ['0', '9'],
  ['9999999', '97'],
]
const INITIAL = EXAMPLES[0]

export default function VerticalDivisionToolPage() {
  const [operands, setOperands] = useState(INITIAL)
  const [problem, setProblem] = useState(() => buildVerticalDivisionProblem(INITIAL))
  const [view, setView] = useState(() => createVerticalDivisionView(buildVerticalDivisionProblem(INITIAL)))
  const [selected, setSelected] = useState('result.ones')
  const [error, setError] = useState('')
  const [commandStatus, setCommandStatus] = useState('')

  function build(nextOperands) {
    try {
      const nextProblem = buildVerticalDivisionProblem(nextOperands)
      setOperands(nextOperands)
      setProblem(nextProblem)
      setView(createVerticalDivisionView(nextProblem))
      setSelected('result.ones')
      setError('')
      setCommandStatus('')
    } catch (cause) {
      setError(cause?.message || 'Could not construct the division grid.')
    }
  }

  const catalog = verticalMathAddressCatalog(problem)

  function runAction(action, editable) {
    const command = action === 'clear_highlight'
      ? { action }
      : { action, locations: [selected], ...(action === 'hide' ? { editable } : {}) }
    const result = applyVerticalDivisionCommand(problem, view, command, { requireUnique: true })
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
        <p className={styles.eyebrow}>Shared math instrument {'\u00b7'} Division</p>
        <h1>Vertical Division</h1>
        <p>Practice whole-number long division through the millions place, including quotients with internal zeroes and final remainders. Decimal division is not included.</p>
      </header>

      <section className={styles.panel} aria-labelledby="division-editor-title">
        <h2 id="division-editor-title">Numbers to divide</h2>
        <div className={styles.inputs}>
          {operands.map((operand, index) => <div className={styles.numberRow} key={index}>
            <label htmlFor={'division-operand-' + index}>{index === 0 ? 'Dividend' : 'Divisor'}</label>
            <input id={'division-operand-' + index} type="text" inputMode="numeric" value={operand}
              aria-label={index === 0 ? 'Dividend' : 'Divisor'}
              onChange={(event) => {
                setOperands((old) => old.map((value, i) => index === i ? event.target.value : value))
                setError('')
              }} />
          </div>)}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => build(operands)}>Build / update grid</button>
        </div>
        <div className={styles.examples}>
          <span>Examples:</span>
          {EXAMPLES.map((example) => <button type="button" key={example.join('-')} onClick={() => build(example)}>
            {example[0] + ' ' + DIVISION + ' ' + example[1]}
          </button>)}
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>

      <section className={styles.display} aria-labelledby="division-grid-title">
        <h2 id="division-grid-title">Math workspace</h2>
        <VerticalMathWorkspace problem={problem} view={view} onViewChange={setView}
          selectedLocation={selected} onCellSelect={setSelected} />
      </section>

      <section className={styles.panel} aria-labelledby="division-command-title">
        <h2 id="division-command-title">Named-location controls</h2>
        <p className={styles.description}>Choose a dividend, divisor, quotient, remainder, or work location. Source-number concealment is rejected when the exercise can no longer be verified uniquely.</p>
        <label htmlFor="division-location">Location</label>
        <select id="division-location" value={selected} onChange={(event) => setSelected(event.target.value)}>
          <optgroup label="Entire rows">
            {catalog.groups.map((group) => <option key={group} value={group}>{group}</option>)}
          </optgroup>
          <optgroup label="Named digits and work positions">
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
            setView(createVerticalDivisionView(problem))
            setCommandStatus('Grid reset. Quotient, remainder, and work are ready for learner entries.')
          }}>Reset exercise</button>
        </div>
        {commandStatus && <p className={styles.status} role="status">{commandStatus}</p>}
      </section>

      <p className={styles.footnote}>This standalone tool has no AI integration or saved learner data.</p>
    </div>
  </main>
}
