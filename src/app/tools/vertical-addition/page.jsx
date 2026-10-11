'use client'

import { useState } from 'react'
import VerticalAdditionWorkspace from '@/components/math/VerticalAdditionWorkspace'
import {
  ADDITION_MAX_OPERANDS,
  ADDITION_MAX_WHOLE_DIGITS,
  applyVerticalAdditionCommand,
  buildVerticalAdditionProblem,
  createVerticalAdditionView,
} from '@/lib/math/verticalAddition.mjs'
import { verticalMathAddressCatalog } from '@/lib/math/verticalMath.mjs'
import styles from './page.module.css'

const INITIAL_NUMBERS = ['47', '26', '19']

export default function VerticalAdditionToolPage() {
  const [numbers, setNumbers] = useState(INITIAL_NUMBERS)
  const [problem, setProblem] = useState(() => buildVerticalAdditionProblem(INITIAL_NUMBERS))
  const [view, setView] = useState(() => createVerticalAdditionView(buildVerticalAdditionProblem(INITIAL_NUMBERS)))
  const [selected, setSelected] = useState('result.ones')
  const [error, setError] = useState('')
  const [commandStatus, setCommandStatus] = useState('')

  function setUp(nextNumbers) {
    try {
      const nextProblem = buildVerticalAdditionProblem(nextNumbers)
      setNumbers(nextNumbers)
      setProblem(nextProblem)
      setView(createVerticalAdditionView(nextProblem))
      setSelected('result.ones')
      setError('')
      setCommandStatus('')
    } catch (cause) {
      setError(cause?.message || 'Could not create the addition grid.')
    }
  }

  const catalog = verticalMathAddressCatalog(problem)
  const operatorMasked = view.hidden.includes('operator')

  function runAction(action, editable) {
    const command = action === 'clear_highlight'
      ? { action }
      : { action, locations: [selected], ...(action === 'hide' ? { editable } : {}) }
    const result = applyVerticalAdditionCommand(problem, view, command, { requireUnique: true })
    if (!result.ok) {
      setCommandStatus(result.error)
      return
    }
    setView(result.view)
    setCommandStatus(action + ' applied to ' + (result.locations.length ? result.locations.join(', ') : 'highlights') + '.')
  }

  function changeNumber(index, value) {
    setNumbers((old) => old.map((number, i) => index === i ? value : number))
    setError('')
  }

  function loadExample(type) {
    if (type === 'ten') {
      setUp(Array(10).fill('9,999,999'))
    } else if (type === 'decimals') {
      setUp(['103.75', '58.25', '6.50'])
    } else {
      setUp(INITIAL_NUMBERS)
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <header className={styles.header}>
          {!operatorMasked && <p className={styles.eyebrow}>Shared math instrument · Addition</p>}
          <h1>{operatorMasked ? 'Vertical Arithmetic' : 'Vertical Addition'}</h1>
          {!operatorMasked && <p>
            Create an addition problem with 2–10 stacked numbers. Each number can
            reach the millions place ({ADDITION_MAX_WHOLE_DIGITS} whole-number digits).
            Results automatically gain extra columns when required.
          </p>}
        </header>

        {!operatorMasked && <section className={styles.panel} aria-labelledby="addition-editor-title">
          <h2 id="addition-editor-title">Numbers to add</h2>
          <div className={styles.inputs}>
            {numbers.map((number, index) => (
              <div className={styles.numberRow} key={index}>
                <label htmlFor={'addition-number-' + index}>{'Number ' + (index + 1)}</label>
                <input
                  id={'addition-number-' + index}
                  value={number}
                  inputMode="decimal"
                  type="text"
                  onChange={(event) => changeNumber(index, event.target.value)}
                  aria-label={'Number ' + (index + 1)}
                />
                <button
                  type="button"
                  disabled={numbers.length <= 2}
                  onClick={() => setNumbers((old) => old.filter((_, i) => i !== index))}
                  aria-label={'Remove number ' + (index + 1)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              disabled={numbers.length >= ADDITION_MAX_OPERANDS}
              onClick={() => setNumbers((old) => [...old, '0'])}
            >
              + Add number
            </button>
            <button type="button" className={styles.primary} onClick={() => setUp(numbers)}>
              Build / update grid
            </button>
          </div>
          <div className={styles.examples}>
            <span>Examples:</span>
            <button type="button" onClick={() => loadExample('simple')}>3 numbers</button>
            <button type="button" onClick={() => loadExample('decimals')}>Decimals</button>
            <button type="button" onClick={() => loadExample('ten')}>10 numbers · millions</button>
          </div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </section>}

        <section className={styles.display} aria-labelledby="addition-grid-title">
          <h2 id="addition-grid-title">Math workspace</h2>
          <VerticalAdditionWorkspace
            problem={problem}
            view={view}
            onViewChange={setView}
            selectedLocation={selected}
            onCellSelect={setSelected}
          />
        </section>

        <section className={styles.panel} aria-labelledby="addition-command-title">
          <h2 id="addition-command-title">Named-location controls</h2>
          <p className={styles.description}>
            Select any digit or group by its mathematical address. These are the
            same validated commands a teacher session can use later.
            You can also tap a visible digit in the workspace to select it.
          </p>
          <label htmlFor="addition-location">Location</label>
          <select
            id="addition-location"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <optgroup label="Entire rows">
              {catalog.groups.map((group) => (
                <option key={group} value={group}>{group}</option>
              ))}
            </optgroup>
            <optgroup label="Named digits and carrying positions">
              {catalog.locations.map((location) => (
                <option key={location} value={location}>{location}</option>
              ))}
            </optgroup>
          </select>
          <div className={styles.actions}>
            <button type="button" onClick={() => runAction('hide', false)}>Conceal</button>
            <button type="button" onClick={() => runAction('hide', true)}>Ask learner</button>
            <button type="button" onClick={() => runAction('show')}>Reveal / lock</button>
            <button type="button" onClick={() => runAction('highlight')}>Highlight</button>
            <button type="button" onClick={() => runAction('clear_highlight')}>Clear highlight</button>
            <button type="button" onClick={() => {
              setView(createVerticalAdditionView(problem))
              setCommandStatus('Grid reset. All result digits editable.')
            }}>Reset exercise</button>
          </div>
          {commandStatus && <p className={styles.status} role="status">{commandStatus}</p>}
        </section>
        <p className={styles.footnote}>
          This is the standalone shared component and testing surface.
          It is not yet connected to Ms. Sonoma, Mr. Slate, or Mrs. Webb.
        </p>
      </div>
    </main>
  )
}
