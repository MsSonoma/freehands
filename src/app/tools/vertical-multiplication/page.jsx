'use client'

import { useState } from 'react'
import VerticalMathWorkspace from '@/components/math/VerticalMathWorkspace'
import {
  buildVerticalMultiplicationProblem,
  createVerticalMultiplicationView,
  applyVerticalMultiplicationCommand,
} from '@/lib/math/verticalMultiplication.mjs'
import { verticalMathAddressCatalog } from '@/lib/math/verticalMath.mjs'
import styles from '../vertical-addition/page.module.css'

const EXAMPLES = {
  ordinary: ['47', '26'],
  carry: ['123', '405'],
  zero: ['0', '90'],
  unequalScale: ['12.3', '4.56'],
  tenths: ['0.1', '0.2'],
  trailingZeroes: ['2.50', '4.0'],
  tinySquared: ['0.000001', '0.000001'],
  max: ['9999999', '9999999'],
}
const INITIAL = EXAMPLES.ordinary

export default function VerticalMultiplicationToolPage() {
  const [factors, setFactors] = useState(INITIAL)
  const [problem, setProblem] = useState(() => buildVerticalMultiplicationProblem(INITIAL))
  const [view, setView] = useState(() => createVerticalMultiplicationView(buildVerticalMultiplicationProblem(INITIAL)))
  const [selected, setSelected] = useState('result.ones')
  const [error, setError] = useState('')
  const [commandStatus, setCommandStatus] = useState('')

  function build(nextFactors) {
    try {
      const nextProblem = buildVerticalMultiplicationProblem(nextFactors)
      setFactors(nextFactors)
      setProblem(nextProblem)
      setView(createVerticalMultiplicationView(nextProblem))
      setSelected('result.ones')
      setError('')
      setCommandStatus('')
    } catch (cause) {
      setError(cause?.message || 'Could not construct the multiplication grid.')
    }
  }

  const catalog = verticalMathAddressCatalog(problem)
  const operatorMasked = view.hidden.includes('operator')

  function runAction(action, editable) {
    const command = action === 'clear_highlight'
      ? { action }
      : { action, locations: [selected], ...(action === 'hide' ? { editable } : {}) }
    const result = applyVerticalMultiplicationCommand(problem, view, command, { requireUnique: true })
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
        {!operatorMasked && <p className={styles.eyebrow}>Shared math instrument · Multiplication</p>}
        <h1>{operatorMasked ? 'Vertical Arithmetic' : 'Vertical Multiplication'}</h1>
        {!operatorMasked && <p>Multiply two nonnegative decimal factors with up to seven whole-number digits and six fractional digits each.
          Partial products and their carry rows use named places and the shared workspace.
        </p>}
      </header>

      {!operatorMasked && <section className={styles.panel} aria-labelledby="multiplication-editor-title">
        <h2 id="multiplication-editor-title">Factors to multiply</h2>
        <div className={styles.inputs}>
          {factors.map((factor, index) => <div className={styles.numberRow} key={index}>
            <label htmlFor={'multiply-factor-' + index}>{'Factor ' + (index + 1)}</label>
            <input
              id={'multiply-factor-' + index}
              type="text"
              inputMode="decimal"
              value={factor}
              onChange={(event) => {
                setFactors((old) => old.map((value, i) => index === i ? event.target.value : value))
                setError('')
              }}
            />
          </div>)}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => build(factors)}>Build / update grid</button>
        </div>
        <div className={styles.examples}>
          <span>Examples:</span>
          <button type="button" onClick={() => build(EXAMPLES.ordinary)}>47 × 26</button>
          <button type="button" onClick={() => build(EXAMPLES.carry)}>123 × 405</button>
          <button type="button" onClick={() => build(EXAMPLES.zero)}>0 × 90</button>
          <button type="button" onClick={() => build(EXAMPLES.unequalScale)}>12.3 × 4.56</button>
          <button type="button" onClick={() => build(EXAMPLES.tenths)}>0.1 × 0.2</button>
          <button type="button" onClick={() => build(EXAMPLES.trailingZeroes)}>2.50 × 4.0</button>
          <button type="button" onClick={() => build(EXAMPLES.tinySquared)}>0.000001 squared</button>
          <button type="button" onClick={() => build(EXAMPLES.max)}>Maximum factors</button>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
      </section>}

      <section className={styles.display} aria-labelledby="multiplication-grid-title">
        <h2 id="multiplication-grid-title">Math workspace</h2>
        {!operatorMasked && problem.fractionDigits > 0 && <p className={styles.description}>
          Work rows multiply whole-number coefficients. The final product uses the factors&apos; combined fractional precision.
        </p>}
        <VerticalMathWorkspace
          problem={problem}
          view={view}
          onViewChange={setView}
          selectedLocation={selected}
          onCellSelect={setSelected}
        />
      </section>

      <section className={styles.panel} aria-labelledby="multiplication-command-title">
        <h2 id="multiplication-command-title">Named-location controls</h2>
        <p className={styles.description}>
          Choose a factor, carry, partial-product, sum-carry or result location.
          Whole rows use the same hide, show and highlight commands.
        </p>
        <label htmlFor="multiplication-location">Location</label>
        <select id="multiplication-location" value={selected}
          onChange={(event) => setSelected(event.target.value)}>
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
            setView(createVerticalMultiplicationView(problem))
            setCommandStatus('Grid reset. All result digits editable.')
          }}>Reset exercise</button>
        </div>
        {commandStatus && <p className={styles.status} role="status">{commandStatus}</p>}
      </section>

      <p className={styles.footnote}>
        This standalone multiplication surface is not connected to a teacher session.
      </p>
    </div>
  </main>
}
