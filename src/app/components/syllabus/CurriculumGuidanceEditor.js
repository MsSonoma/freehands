'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { acquirePageScrollLock } from '@/app/lib/scrollLock.mjs'
import styles from './CurriculumGuidanceEditor.module.css'

function clean(value) {
  return String(value ?? '').trim()
}

function dateOnly(value) {
  return clean(value).slice(0, 10)
}

function addDays(value, amount) {
  const date = new Date(`${dateOnly(value)}T12:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return ''
  date.setUTCDate(date.getUTCDate() + Number(amount || 0))
  return date.toISOString().slice(0, 10)
}

function subjectName(value) {
  return clean(typeof value === 'string' ? value : value?.name)
}

function newKey(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}:${globalThis.crypto.randomUUID()}`
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`
}

function requirementFromRecommendation(item, index = 0) {
  return {
    requirement_key: `framework:${item.id}`,
    framework_item_id: item.id,
    subject: item.subject,
    statement: item.statement,
    must_learn: true,
    attention: 'normal',
    target_date: null,
    planning_group_key: item.planning_group_key || `framework:${item.id}`,
    source_kind: 'framework',
    sort_order: index,
    metadata: {
      framework_id: item.framework_id,
      framework_name: item.framework?.name || null,
      source_code: item.code || item.external_id || null,
      source_uri: item.framework?.source_uri || null,
      source_version: item.framework?.version_label || null,
    },
  }
}

function draftFromBundle(bundle, today) {
  const period = bundle?.period
  return {
    period: period ? {
      id: period.id,
      label: period.label || '',
      period_type: period.period_type || 'custom',
      starts_on: dateOnly(period.starts_on),
      ends_on: dateOnly(period.ends_on),
    } : {
      id: null,
      label: '',
      period_type: 'semester',
      starts_on: dateOnly(today),
      ends_on: '',
    },
    expected_active_version_id: bundle?.contract_version?.id || null,
    requirements: (bundle?.requirements || []).map((item, index) => ({
      requirement_key: item.requirement_key,
      framework_item_id: item.framework_item_id || null,
      subject: item.subject,
      statement: item.statement,
      must_learn: item.must_learn !== false,
      attention: item.attention || 'normal',
      target_date: dateOnly(item.target_date) || null,
      planning_group_key: item.planning_group_key || item.requirement_key,
      source_kind: item.source_kind || 'facilitator',
      sort_order: Number.isInteger(item.sort_order) ? item.sort_order : index,
      metadata: item.metadata || {},
    })),
    goals: (bundle?.goals || []).map((goal, index) => ({
      goal_key: goal.goal_key,
      title: goal.title,
      subject: goal.subject || '',
      priority: goal.priority || 'normal',
      linked_requirement_keys: Array.isArray(goal.linked_requirement_keys) ? goal.linked_requirement_keys : [],
      notes: goal.notes || '',
      sort_order: Number.isInteger(goal.sort_order) ? goal.sort_order : index,
    })),
    change_reason: '',
  }
}

function stateLabel(row) {
  if (!row) return 'Not started'
  if (row.mastery_state === 'demonstrated' && row.retention_state === 'retained') return 'Retained'
  if (row.mastery_state === 'demonstrated') return 'Demonstrated'
  if (row.mastery_state === 'unresolved') return 'Needs more work'
  if (row.coverage_state === 'developing') return 'Developing'
  if (row.coverage_state === 'covered') return 'Covered'
  return 'Not started'
}

function decisionTitle(decision) {
  const snapshot = decision?.decision_snapshot || {}
  return snapshot.requirement_statement || decision?.requirement_key || 'Curriculum decision'
}

export default function CurriculumGuidanceEditor({
  revision,
  learnerId,
  accessToken,
  today = '',
  onClose,
  onSaved,
}) {
  const [bundle, setBundle] = useState(null)
  const [draft, setDraft] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [showReasoning, setShowReasoning] = useState(false)

  useEffect(() => acquirePageScrollLock(), [])

  const loadPeriod = useCallback(async (periodId = '', signal = null) => {
    if (!learnerId || !accessToken) return
    setLoading(true)
    setError('')
    try {
      const periodQuery = periodId ? `&periodId=${encodeURIComponent(periodId)}` : ''
      const response = await fetch(`/api/syllabus/curriculum?learnerId=${encodeURIComponent(learnerId)}${periodQuery}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: 'no-store',
        ...(signal ? { signal } : {}),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not load Curriculum Guidance')
      if (signal?.aborted) return
      setBundle(json)
      setDraft(draftFromBundle(json, json.resolved_today || today))
    } catch (cause) {
      if (cause?.name !== 'AbortError' && !signal?.aborted) {
        setError(cause.message || 'Could not load Curriculum Guidance')
      }
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [learnerId, accessToken, today])

  useEffect(() => {
    const controller = new AbortController()
    void loadPeriod('', controller.signal)
    return () => controller.abort()
  }, [loadPeriod])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !working) onClose?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, working])

  const stateByKey = useMemo(() => new Map((bundle?.state || []).map((row) => [row.requirement_key, row])), [bundle?.state])
  const subjectOptions = useMemo(() => {
    const values = new Map()
    for (const item of revision?.subjects || []) {
      const name = subjectName(item)
      if (name) values.set(name.toLocaleLowerCase(), name)
    }
    for (const item of draft?.requirements || []) {
      if (clean(item.subject)) values.set(clean(item.subject).toLocaleLowerCase(), clean(item.subject))
    }
    for (const item of bundle?.recommendations || []) {
      if (clean(item.subject)) values.set(clean(item.subject).toLocaleLowerCase(), clean(item.subject))
    }
    return [...values.values()]
  }, [revision?.subjects, draft?.requirements, bundle?.recommendations])

  const selectedRequirementKeys = useMemo(
    () => new Set((draft?.requirements || []).map((item) => item.requirement_key)),
    [draft?.requirements],
  )
  const availableRecommendations = useMemo(
    () => (bundle?.recommendations || []).filter((item) => !selectedRequirementKeys.has(`framework:${item.id}`)),
    [bundle?.recommendations, selectedRequirementKeys],
  )

  function updatePeriod(key, value) {
    setDraft((current) => ({ ...current, period: { ...current.period, [key]: value } }))
  }

  function updateRequirement(index, patch) {
    setDraft((current) => {
      const currentItem = current.requirements[index]
      if (!currentItem) return current

      const changesFrameworkIdentity = Boolean(
        currentItem.framework_item_id
        && (
          (Object.prototype.hasOwnProperty.call(patch, 'statement') && patch.statement !== currentItem.statement)
          || (Object.prototype.hasOwnProperty.call(patch, 'subject') && patch.subject !== currentItem.subject)
        )
      )

      let nextItem = { ...currentItem, ...patch }
      let replacedRequirementKey = null
      if (changesFrameworkIdentity) {
        replacedRequirementKey = newKey('facilitator')
        nextItem = {
          ...nextItem,
          requirement_key: replacedRequirementKey,
          framework_item_id: null,
          planning_group_key: replacedRequirementKey,
          source_kind: 'facilitator',
          metadata: {
            derived_from_framework_item_id: currentItem.framework_item_id,
            derived_from_framework_name: currentItem.metadata?.framework_name || null,
          },
        }
      }

      return {
        ...current,
        requirements: current.requirements.map((item, itemIndex) => itemIndex === index ? nextItem : item),
        goals: replacedRequirementKey
          ? current.goals.map((goal) => ({
              ...goal,
              linked_requirement_keys: (goal.linked_requirement_keys || []).map((key) => (
                key === currentItem.requirement_key ? replacedRequirementKey : key
              )),
            }))
          : current.goals,
      }
    })
  }

  function addRequirement() {
    const subject = subjectOptions[0] || ''
    const requirementKey = newKey('facilitator')
    setDraft((current) => ({
      ...current,
      requirements: [
        ...current.requirements,
        {
          requirement_key: requirementKey,
          framework_item_id: null,
          subject,
          statement: '',
          must_learn: true,
          attention: 'normal',
          target_date: null,
          planning_group_key: requirementKey,
          source_kind: 'facilitator',
          sort_order: current.requirements.length,
          metadata: {},
        },
      ],
    }))
  }

  function addRecommendation(item) {
    setDraft((current) => ({
      ...current,
      requirements: [
        ...current.requirements,
        requirementFromRecommendation(item, current.requirements.length),
      ],
    }))
  }

  function removeRequirement(index) {
    setDraft((current) => ({
      ...current,
      requirements: current.requirements.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function updateGoal(index, patch) {
    setDraft((current) => ({
      ...current,
      goals: current.goals.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }))
  }

  function addGoal() {
    setDraft((current) => ({
      ...current,
      goals: [
        ...current.goals,
        {
          goal_key: newKey('goal'),
          title: '',
          subject: '',
          priority: 'normal',
          linked_requirement_keys: [],
          notes: '',
          sort_order: current.goals.length,
        },
      ],
    }))
  }

  function startNextPeriod() {
    if (!draft?.period?.ends_on) return
    const unmet = (draft.requirements || []).filter((item) => stateByKey.get(item.requirement_key)?.mastery_state !== 'demonstrated')
    setDraft((current) => ({
      ...current,
      period: {
        id: null,
        label: '',
        period_type: current.period.period_type,
        starts_on: addDays(current.period.ends_on, 1),
        ends_on: '',
      },
      expected_active_version_id: null,
      requirements: unmet.map((item, index) => ({ ...item, target_date: null, sort_order: index })),
      goals: current.goals.map((goal, index) => ({ ...goal, sort_order: index })),
      change_reason: 'Prepared the next curriculum planning period',
    }))
    setBundle((current) => current ? { ...current, state: [] } : current)
  }

  async function save() {
    if (!draft || !learnerId || !accessToken) return
    setWorking(true)
    setError('')
    try {
      const response = await fetch('/api/syllabus/curriculum', {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnerId,
          guidance: {
            ...draft,
            requirements: draft.requirements.map((item, index) => ({ ...item, sort_order: index })),
            goals: draft.goals.map((item, index) => ({ ...item, sort_order: index })),
          },
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Could not save Curriculum Guidance')
      setBundle(json)
      setDraft(draftFromBundle(json, json.resolved_today || today))
      await onSaved?.(json)
      onClose?.()
    } catch (cause) {
      setError(cause.message || 'Could not save Curriculum Guidance')
    } finally {
      setWorking(false)
    }
  }

  if (loading || !draft) {
    return <div className={styles.backdrop}>
      <section className={styles.editor} role="dialog" aria-modal="true" aria-label="Curriculum Guidance">
        <header className={styles.header}><div><p>Syllabus</p><h2>Curriculum Guidance</h2></div><button type="button" className={styles.secondary} onClick={onClose}>Close</button></header>
        <div className={styles.body}><div className={styles.empty}>Loading curriculum guidance...</div></div>
      </section>
    </div>
  }

  const periodExpired = draft.period.ends_on && dateOnly(bundle?.resolved_today || today) > draft.period.ends_on
  const selectedPeriodId = clean(draft.period.id)
  const currentPeriodId = clean(bundle?.current_period?.id)
  const upcomingPeriodId = clean(bundle?.upcoming_period?.id)

  return <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !working) onClose?.() }}>
    <section className={styles.editor} role="dialog" aria-modal="true" aria-label="Curriculum Guidance">
      <header className={styles.header}>
        <div><p>Syllabus</p><h2>Curriculum Guidance</h2></div>
        <button type="button" className={styles.secondary} onClick={onClose} disabled={working}>Close</button>
      </header>

      {error && <div className={styles.error} role="alert">{error}</div>}

      <div className={styles.body}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div><h3>Planning period</h3><span>Requirements and goals are reviewed at the end of this period.</span></div>
            <div className={styles.actions}>
              {currentPeriodId && selectedPeriodId !== currentPeriodId && <button type="button" className={styles.secondary} onClick={() => loadPeriod(currentPeriodId)}>Current period</button>}
              {upcomingPeriodId && selectedPeriodId !== upcomingPeriodId && <button type="button" className={styles.secondary} onClick={() => loadPeriod(upcomingPeriodId)}>Open next period</button>}
              {selectedPeriodId && !upcomingPeriodId && <button type="button" className={styles.secondary} onClick={startNextPeriod}>{periodExpired ? 'Start next period' : 'Prepare next period'}</button>}
            </div>
          </div>
          <div className={styles.grid}>
            <label className={styles.field}>Name<input value={draft.period.label} onChange={(event) => updatePeriod('label', event.target.value)} placeholder="Fall 2026" /></label>
            <label className={styles.field}>Period type<select value={draft.period.period_type} onChange={(event) => updatePeriod('period_type', event.target.value)}>
              <option value="semester">Semester</option>
              <option value="quarter">Quarter</option>
              <option value="school_year">School year</option>
              <option value="custom">Custom</option>
            </select></label>
            <label className={styles.field}>Starts<input type="date" value={draft.period.starts_on} onChange={(event) => updatePeriod('starts_on', event.target.value)} /></label>
            <label className={styles.field}>Ends<input type="date" value={draft.period.ends_on} onChange={(event) => updatePeriod('ends_on', event.target.value)} /></label>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div><h3>Requirements</h3><span>What this learner needs to learn during the planning period.</span></div>
            <button type="button" className={styles.secondary} onClick={addRequirement}>Add requirement</button>
          </div>

          {(draft.requirements || []).length === 0
            ? <div className={styles.empty}>No requirements yet. Add your own or choose from recommendations when a curriculum framework is available.</div>
            : <div className={styles.list}>{draft.requirements.map((item, index) => {
              const state = stateByKey.get(item.requirement_key)
              const frameworkBacked = item.source_kind === 'framework' && Boolean(item.framework_item_id)
              return <div className={styles.requirement} key={item.requirement_key}>
                <div className={styles.requirementTop}>
                  <input
                    aria-label={`Requirement ${index + 1}`}
                    value={item.statement}
                    onChange={(event) => updateRequirement(index, { statement: event.target.value })}
                    placeholder="What should the learner be able to do?"
                    readOnly={frameworkBacked}
                    title={frameworkBacked ? 'This wording comes from the selected curriculum source. Remove it and add a custom requirement to change the wording.' : undefined}
                  />
                  <select
                    className={styles.compact}
                    value={item.subject}
                    onChange={(event) => updateRequirement(index, { subject: event.target.value })}
                    disabled={frameworkBacked}
                    title={frameworkBacked ? 'The subject comes from the selected curriculum source.' : undefined}
                  >
                    <option value="">Choose subject</option>
                    {subjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                  </select>
                  <button type="button" className={styles.danger} onClick={() => removeRequirement(index)}>Remove</button>
                </div>
                <div className={styles.row}>
                  <label className={styles.checkbox}><input type="checkbox" checked={item.must_learn !== false} onChange={(event) => updateRequirement(index, { must_learn: event.target.checked })} />Must learn</label>
                  <label className={styles.field}>Attention<select className={styles.compact} value={item.attention || 'normal'} onChange={(event) => updateRequirement(index, { attention: event.target.value })}>
                    <option value="more">More</option>
                    <option value="normal">Normal</option>
                    <option value="minimum">Minimum</option>
                  </select></label>
                  <label className={styles.field}>Target date<input className={styles.compact} type="date" value={dateOnly(item.target_date)} onChange={(event) => updateRequirement(index, { target_date: event.target.value || null })} /></label>
                  <span className={styles.pill}>{stateLabel(state)}</span>
                  {item.source_kind === 'framework' && <span className={styles.source}>{item.metadata?.framework_name || 'Curriculum source'}{item.metadata?.source_code ? ` - ${item.metadata.source_code}` : ''}</span>}
                </div>
              </div>
            })}</div>}

          {availableRecommendations.length > 0 && <div className={styles.recommendations}>
            <strong>Recommended requirements</strong>
            <span className={styles.muted}>These come from the curriculum frameworks available to this learner. Adding one makes it part of the facilitator-authored contract.</span>
            {availableRecommendations.slice(0, 80).map((item) => <div className={styles.recommendation} key={item.id}>
              <div><strong>{item.subject}</strong> <span className={styles.source}>{item.framework?.name || ''}{item.code ? ` - ${item.code}` : ''}</span></div>
              <span>{item.statement}</span>
              <div className={styles.actions}><button type="button" className={styles.secondary} onClick={() => addRecommendation(item)}>Add requirement</button></div>
            </div>)}
          </div>}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div><h3>Personal goals</h3><span>What the facilitator especially wants for this learner beyond the required floor.</span></div>
            <button type="button" className={styles.secondary} onClick={addGoal}>Add goal</button>
          </div>
          {(draft.goals || []).length === 0
            ? <div className={styles.empty}>No personal goals yet.</div>
            : <div className={styles.list}>{draft.goals.map((goal, index) => <div className={styles.goal} key={goal.goal_key}>
              <div className={styles.goalTop}>
                <input value={goal.title} onChange={(event) => updateGoal(index, { title: event.target.value })} placeholder="Example: Build confidence with division" />
                <select className={styles.compact} value={goal.subject || ''} onChange={(event) => updateGoal(index, { subject: event.target.value })}>
                  <option value="">All subjects</option>
                  {subjectOptions.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
                </select>
                <select className={styles.compact} value={goal.priority || 'normal'} onChange={(event) => updateGoal(index, { priority: event.target.value })}>
                  <option value="high">High priority</option>
                  <option value="normal">Normal priority</option>
                  <option value="low">Low priority</option>
                </select>
                <button type="button" className={styles.danger} onClick={() => setDraft((current) => ({ ...current, goals: current.goals.filter((_, itemIndex) => itemIndex !== index) }))}>Remove</button>
              </div>
              <textarea rows={2} value={goal.notes || ''} onChange={(event) => updateGoal(index, { notes: event.target.value })} placeholder="Optional guidance" />
            </div>)}</div>}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div><h3>Current guidance</h3><span>Derived learner state and the curriculum decisions Ms. Sonoma has made from it.</span></div>
            <button type="button" className={styles.secondary} onClick={() => setShowReasoning((value) => !value)}>{showReasoning ? 'Hide reasoning' : 'Inspect reasoning'}</button>
          </div>
          <div className={styles.pills}>
            <span className={styles.pill}>{bundle?.counts?.required || 0} required</span>
            <span className={styles.pill}>{bundle?.counts?.demonstrated || 0} demonstrated</span>
            <span className={styles.pill}>{bundle?.counts?.unresolved || 0} unresolved</span>
            <span className={styles.pill}>{bundle?.counts?.not_started || 0} not started</span>
          </div>

          {showReasoning && <div className={styles.reasoning}>
            {(bundle?.decisions || []).length === 0
              ? <div className={styles.empty}>No curriculum planning decisions have been recorded yet. They appear here as Forecast uses the active contract.</div>
              : (bundle.decisions || []).slice(0, 30).map((decision) => {
                const snapshot = decision.decision_snapshot || {}
                return <div className={styles.decision} key={decision.id}>
                  <strong>{decisionTitle(decision)}</strong>
                  <div className={styles.pills}>
                    <span className={styles.pill}>{String(decision.decision_kind || '').replaceAll('_', ' ')}</span>
                    {snapshot.exposure_number && <span className={styles.pill}>Exposure {snapshot.exposure_number} of 3 max</span>}
                    {snapshot.mastery_state_before && <span className={styles.pill}>Before: {String(snapshot.mastery_state_before).replaceAll('_', ' ')}</span>}
                  </div>
                  {(snapshot.reasons || []).length > 0 && <ul>{snapshot.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>}
                  {snapshot.next_policy && <span className={styles.muted}>Next: {snapshot.next_policy}</span>}
                  {(snapshot.alternatives || []).length > 0 && <details><summary>Other eligible directions considered</summary><ul>{snapshot.alternatives.map((alternative) => <li key={alternative.requirement_key}>{alternative.statement}</li>)}</ul></details>}
                </div>
              })}
          </div>}
        </section>

        <label className={styles.field}>Change note<input value={draft.change_reason || ''} onChange={(event) => setDraft((current) => ({ ...current, change_reason: event.target.value }))} placeholder="Optional note about this curriculum update" /></label>
      </div>

      <footer className={styles.footer}>
        <button type="button" className={styles.secondary} onClick={onClose} disabled={working}>Cancel</button>
        <button type="button" className={styles.primary} onClick={save} disabled={working || !draft.period.label || !draft.period.starts_on || !draft.period.ends_on}>{working ? 'Saving...' : 'Save Curriculum Guidance'}</button>
      </footer>
    </section>
  </div>
}
