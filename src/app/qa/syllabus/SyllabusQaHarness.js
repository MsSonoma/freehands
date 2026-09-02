'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import LessonHistoryOverlay from '@/app/components/syllabus/LessonHistoryOverlay'
import SyllabusDocument from '@/app/components/syllabus/SyllabusDocument'
import SyllabusPlanningWorkspace from '@/app/components/syllabus/SyllabusPlanningWorkspace'
import { addWeeklyPatternSlot, classifySyllabusWeek, removeWeeklyPatternSlot } from '@/app/lib/syllabus/timeline.mjs'
import { createSyllabusQaFixture } from '@/app/lib/syllabus/qaFixtures.mjs'
import { buildForecastViewIdentity, isCurrentForecastResponse } from '@/app/lib/syllabus/forecastRequestIdentity.mjs'
import styles from './SyllabusQaHarness.module.css'

const SCENARIOS = {
  full: { label: 'Full access', tier: 'pro', generation: true },
  no_generation: { label: 'Planning, no generation', tier: 'pro', generation: false },
  read_only: { label: 'Read-only planning', tier: 'free', generation: false },
  forecast_failure: { label: 'Forecast failure', tier: 'pro', generation: true },
  materialization_failure: { label: 'Generation failure', tier: 'pro', generation: true },
  recovered_materialization: { label: 'Crash then exact recovery', tier: 'pro', generation: true },
  recovery_required: { label: 'Ambiguous recovery required', tier: 'pro', generation: true },
  stale_revision: { label: 'Stale revision conflict', tier: 'pro', generation: true },
  history_failure: { label: 'Review History failure', tier: 'pro', generation: true },
}

const LATENCIES = { none: 0, modest: 250, slow: 1200 }

function waitForFixture(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    const abort = () => { clearTimeout(timer); reject(Object.assign(new Error('Fixture request aborted'), { name: 'AbortError' })) }
    if (signal?.aborted) abort()
    else signal?.addEventListener('abort', abort, { once: true })
  })
}

function nextRevision(revision, changes) {
  const revisionNumber = Number(revision.revision_number || 0) + 1
  return { ...revision, ...changes, id: `qa-revision-${revisionNumber}`, revision_number: revisionNumber }
}

function SectionEditor({ section, revision, busy, error, onCancel, onSave }) {
  const [draft, setDraft] = useState(() => structuredClone(revision))
  const [subjectName, setSubjectName] = useState('')
  const subjects = (draft.subjects || []).map((item) => item.name)
  const save = () => onSave(section, draft)
  return <div className={styles.backdrop}>
    <section className={styles.editor} role="dialog" aria-modal="true" aria-label={`QA ${section} editor`}>
      <header><h2>{section === 'weekly_pattern' ? 'Weekly Pattern' : section === 'teaching_guidance' ? 'Teaching Guidance' : section[0].toUpperCase() + section.slice(1)}</h2><button type="button" onClick={onCancel}>Close</button></header>
      {error && <p className={styles.error} role="alert">{error}</p>}
      {section === 'goals' && <label>Goals<textarea rows={7} value={draft.goals?.legacy_notes || ''} onChange={(event) => setDraft({ ...draft, goals: { ...draft.goals, legacy_notes: event.target.value } })} /></label>}
      {section === 'subjects' && <>
        <ul className={styles.subjects}>{subjects.map((subject) => <li key={subject}><span>{subject}</span><button type="button" onClick={() => setDraft({ ...draft, subjects: draft.subjects.filter((item) => item.name !== subject) })}>Remove</button></li>)}</ul>
        <label>Add subject<div className={styles.inline}><input value={subjectName} onChange={(event) => setSubjectName(event.target.value)} /><button type="button" onClick={() => { const value = subjectName.trim(); if (value && !subjects.includes(value)) setDraft({ ...draft, subjects: [...draft.subjects, { name: value }] }); setSubjectName('') }}>Add</button></div></label>
      </>}
      {section === 'weekly_pattern' && <div className={styles.patternEditor}>{Object.entries(draft.weekly_pattern || {}).map(([day, entries]) => <section key={day}><strong>{day}</strong>{entries.map((entry, index) => <div key={`${day}-${index}`}><span>{entry.subject}</span><button type="button" onClick={() => setDraft({ ...draft, weekly_pattern: removeWeeklyPatternSlot(draft.weekly_pattern, day, index) })}>Remove</button></div>)}<button type="button" onClick={() => setDraft({ ...draft, weekly_pattern: addWeeklyPatternSlot(draft.weekly_pattern, day, subjects[0]) })}>Add {subjects[0]} slot</button></section>)}</div>}
      {section === 'teaching_guidance' && <label>Global instructional preferences<textarea rows={7} value={(draft.teaching_guidance?.curriculum_preferences?.instructional_preferences || []).join('\n')} onChange={(event) => setDraft({ ...draft, teaching_guidance: { ...draft.teaching_guidance, curriculum_preferences: { ...draft.teaching_guidance.curriculum_preferences, instructional_preferences: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) } } })} /></label>}
      <footer><button type="button" onClick={onCancel}>Cancel</button><button type="button" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save fixture revision'}</button></footer>
    </section>
  </div>
}

function ConceptEditor({ item, busy, error, onCancel, onSave }) {
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description || '')
  return <div className={styles.backdrop}><section className={styles.editor} role="dialog" aria-modal="true" aria-label="QA concept editor">
    <header><h2>Edit forecast concept</h2><button type="button" onClick={onCancel}>Close</button></header>
    {error && <p className={styles.error} role="alert">{error}</p>}
    <label>Title<input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label>
    <label>Description<textarea rows={5} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
    <footer><button type="button" onClick={onCancel}>Cancel</button><button type="button" disabled={busy || !title.trim() || !description.trim()} onClick={() => onSave({ title, description })}>{busy ? 'Saving…' : 'Save as educator intent'}</button></footer>
  </section></div>
}

export default function SyllabusQaHarness() {
  const baseline = useMemo(() => createSyllabusQaFixture(), [])
  const [fixture, setFixture] = useState(baseline)
  const [role, setRole] = useState('facilitator')
  const [scenarioId, setScenarioId] = useState('full')
  const [latencyId, setLatencyId] = useState('modest')
  const [sectionEditor, setSectionEditor] = useState('')
  const [conceptEditor, setConceptEditor] = useState(null)
  const [planAheadOpen, setPlanAheadOpen] = useState(false)
  const [historyOccurrenceId, setHistoryOccurrenceId] = useState('')
  const [selectedWeek, setSelectedWeek] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [forecastStatus, setForecastStatus] = useState('ready')
  const [forecastRequests, setForecastRequests] = useState(0)
  const [repairLineage, setRepairLineage] = useState('')
  const [materializationGenerations, setMaterializationGenerations] = useState(0)
  const forecastIdentity = useRef('')
  const forecastViewIdentity = useRef('')
  const forecastSequence = useRef(0)
  const historyRace = useRef(false)
  const operationBusy = useRef('')
  const scenario = SCENARIOS[scenarioId]
  const latency = LATENCIES[latencyId]
  const proposalItems = fixture.forecastProposal?.forecast_items || []

  const reset = () => {
    setFixture(createSyllabusQaFixture())
    setSectionEditor(''); setConceptEditor(null); setPlanAheadOpen(false); setHistoryOccurrenceId('')
    setSelectedWeek(''); setBusy(''); setError(''); setForecastStatus('ready'); setForecastRequests(0); setRepairLineage(''); setMaterializationGenerations(0)
    forecastIdentity.current = ''; forecastViewIdentity.current = ''; forecastSequence.current = 0; operationBusy.current = ''
  }

  const openSection = (section) => { setError(''); setSectionEditor(section); setConceptEditor(null); setPlanAheadOpen(false); setHistoryOccurrenceId('') }
  const saveSection = async (section, draft) => {
    setBusy(`section:${section}`); setError('')
    await waitForFixture(latency)
    if (scenarioId === 'stale_revision') { setError('This Syllabus changed in another request. Close and reopen the editor before saving.'); setBusy(''); return false }
    setFixture((current) => ({ ...current, activeRevision: nextRevision(current.activeRevision, { [section]: structuredClone(draft[section]) }) }))
    setBusy(''); setSectionEditor(''); return true
  }

  const onWeekChange = (weekStart) => {
    setSelectedWeek(weekStart)
    forecastViewIdentity.current = buildForecastViewIdentity({ learnerId: fixture.learner.id, activeRevisionId: fixture.activeRevision.id, targetWeek: weekStart, selectedWeekStart: weekStart })
    if (role !== 'facilitator' || classifySyllabusWeek(weekStart, fixture.resolvedToday) !== 'future') return
    const identity = forecastViewIdentity.current
    if (forecastIdentity.current === identity) return
    forecastIdentity.current = identity
    const requestSequence = ++forecastSequence.current
    setForecastRequests((value) => value + 1); setForecastStatus('loading'); setError('')
    waitForFixture(latency).then(() => {
      if (!isCurrentForecastResponse({ requestIdentity: identity, currentIdentity: forecastViewIdentity.current, requestSequence, currentSequence: forecastSequence.current })) return
      if (scenarioId === 'forecast_failure') { setForecastStatus('error'); setError('The instructional forecast could not be prepared. The active Syllabus is unchanged.'); return }
      setForecastStatus('ready')
    })
  }

  const retryForecast = () => { forecastIdentity.current = ''; onWeekChange(selectedWeek) }

  const saveConcept = async (values) => {
    setBusy(`edit:${conceptEditor.lineage_id}`); setError(''); await waitForFixture(latency)
    if (scenarioId === 'stale_revision') { setError('This proposal is stale because the active revision changed. Refresh the fixture before retrying.'); setBusy(''); return false }
    setFixture((current) => ({ ...current, forecastProposal: { ...current.forecastProposal, forecast_items: current.forecastProposal.forecast_items.map((item) => item.lineage_id === conceptEditor.lineage_id ? { ...item, ...values, origin: 'facilitator' } : item) } }))
    setBusy(''); setConceptEditor(null); return true
  }

  const replaceConcept = async (item) => {
    if (operationBusy.current) return
    operationBusy.current = `replace:${item.lineage_id}`
    setBusy(`replace:${item.lineage_id}`); setError(''); await waitForFixture(latency)
    setFixture((current) => ({ ...current, forecastProposal: { ...current.forecastProposal, forecast_items: current.forecastProposal.forecast_items.map((candidate) => candidate.lineage_id === item.lineage_id ? { ...candidate, title: `${candidate.title} — Alternate`, description: 'A deterministic alternate suggestion that preserves the exact slot and lineage.' } : candidate) } }))
    operationBusy.current = ''; setBusy('')
  }

  const materialize = async (item) => {
    if (operationBusy.current || !scenario.generation || repairLineage === item.lineage_id) return false
    operationBusy.current = `generate:${item.lineage_id}`
    setBusy(`generate:${item.lineage_id}`); setError(''); await waitForFixture(latency)
    setMaterializationGenerations((value) => value + 1)
    if (scenarioId === 'materialization_failure') { setError('Lesson generation failed safely. The planned concept remains available with no lesson key.'); operationBusy.current = ''; setBusy(''); return false }
    if (scenarioId === 'recovered_materialization') { setRepairLineage(item.lineage_id); setError('The canonical artifact was created before an interrupted receipt/binding step. Retry recovers that exact artifact without generation.'); operationBusy.current = ''; setBusy(''); return false }
    if (scenarioId === 'recovery_required') { setRepairLineage(item.lineage_id); setError('Completion is ambiguous and no exact artifact can be proven. Recovery is required; blind generation is disabled.'); operationBusy.current = ''; setBusy(''); return false }
    setFixture((current) => ({ ...current, timelineItems: current.timelineItems.map((candidate) => candidate.lineage_id === item.lineage_id ? { ...candidate, lesson_key: `fixture/generated/${candidate.lineage_id}.json`, readiness_state: 'draft' } : candidate) }))
    operationBusy.current = ''; setBusy(''); return true
  }

  const retryBinding = async () => {
    const lineageId = repairLineage
    if (!lineageId || busy || scenarioId === 'recovery_required') return
    setBusy(`binding:${lineageId}`); setError(''); await waitForFixture(latency)
    setFixture((current) => ({ ...current, timelineItems: current.timelineItems.map((item) => item.lineage_id === lineageId ? { ...item, lesson_key: `fixture/generated/${lineageId}.json`, readiness_state: 'draft' } : item) }))
    setRepairLineage(''); setBusy('')
  }

  const handleLessonAction = (item, action) => {
    if (action?.id === 'materialize') materialize(item)
    else setError(`QA intercepted “${action?.label || 'lesson action'}”; no production navigation or mutation is permitted.`)
  }

  const createConcept = async (slot, values) => {
    if (busy) return null
    setBusy('planning:create'); setError(''); await waitForFixture(latency)
    if (scenarioId === 'stale_revision') { setError('The expected active revision is stale. The concept was not saved.'); setBusy(''); return null }
    const item = { id: `qa-created-${slot.slot_key}`, occurrence_id: `syllabus:qa-created-${slot.slot_key}`, lineage_id: `qa-lineage-${slot.slot_key}`, lesson_key: null, title: values.title, description: values.description, subject: slot.subject, planned_date: slot.planned_date, sort_order: slot.sort_order, origin: 'facilitator', placement_kind: 'syllabus', readiness_state: 'saved' }
    setFixture((current) => ({ ...current, timelineItems: [...current.timelineItems, item], activeRevision: nextRevision(current.activeRevision, {}) }))
    setBusy(''); return item
  }

  const editPlanItem = async (item, values) => {
    setBusy(`planning:edit:${item.lineage_id}`); await waitForFixture(latency)
    setFixture((current) => ({ ...current, timelineItems: current.timelineItems.map((candidate) => candidate.lineage_id === item.lineage_id ? { ...candidate, title: values.title, description: values.description } : candidate), forecastProposal: { ...current.forecastProposal, forecast_items: current.forecastProposal.forecast_items.map((candidate) => candidate.lineage_id === item.lineage_id ? { ...candidate, title: values.title, description: values.description } : candidate) } }))
    setBusy(''); return true
  }

  const removePlanItem = async (item) => { setFixture((current) => ({ ...current, timelineItems: current.timelineItems.filter((candidate) => candidate.lineage_id !== item.lineage_id), activeRevision: nextRevision(current.activeRevision, {}) })); return true }
  const suggest = async (slot) => { await waitForFixture(latency); return { title: `Explore ${slot.subject}`, description: `A deterministic farther-out ${slot.subject} planning suggestion without assumed future mastery.` } }

  const loadHistory = useCallback(async ({ occurrenceId, signal }) => {
    const raceDelay = historyRace.current ? (occurrenceId.endsWith('a') ? 900 : 80) : latency
    await waitForFixture(raceDelay, signal)
    if (scenarioId === 'history_failure') throw new Error('Review History is temporarily unavailable. Try again without leaving the Syllabus.')
    const detail = fixture.historyByOccurrence[occurrenceId]
    if (!detail) throw new Error('Lesson history not found')
    return structuredClone(detail)
  }, [fixture.historyByOccurrence, latency, scenarioId])

  const loadTranscript = useCallback(async ({ record, signal }) => {
    await waitForFixture(latency, signal)
    const text = fixture.transcriptText[record.transcript.url]
    if (!text) throw new Error('The transcript could not be loaded.')
    return text
  }, [fixture.transcriptText, latency])

  const runHistoryRace = () => {
    historyRace.current = true
    setHistoryOccurrenceId('actual:qa-session-fractions-a')
    setTimeout(() => setHistoryOccurrenceId('actual:qa-session-fractions-b'), 40)
    setTimeout(() => { historyRace.current = false }, 1200)
  }

  const planItems = [...fixture.timelineItems, ...proposalItems]
  const planningAllowed = scenario.tier === 'pro' && role === 'facilitator'
  return <main className={styles.page} data-qa-syllabus-harness data-scenario={scenarioId}>
    <aside className={styles.qaBar} aria-label="Syllabus QA fixture controls">
      <div><strong>Local Syllabus QA</strong><span>Ephemeral fixture · network-disabled adapter</span></div>
      <label>View<select value={role} onChange={(event) => { forecastIdentity.current = ''; forecastViewIdentity.current = ''; forecastSequence.current++; setForecastStatus('ready'); setError(''); setRole(event.target.value); setSectionEditor(''); setConceptEditor(null); setPlanAheadOpen(false); setHistoryOccurrenceId('') }}><option value="facilitator">Facilitator</option><option value="learner">Learner</option></select></label>
      <label>Scenario<select value={scenarioId} onChange={(event) => { setScenarioId(event.target.value); setSectionEditor(''); setConceptEditor(null); setPlanAheadOpen(false); setHistoryOccurrenceId(''); setError(''); setRepairLineage(''); setMaterializationGenerations(0); forecastIdentity.current = ''; forecastViewIdentity.current = ''; forecastSequence.current++ }}>{Object.entries(SCENARIOS).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}</select></label>
      <label>Latency<select value={latencyId} onChange={(event) => setLatencyId(event.target.value)}>{Object.keys(LATENCIES).map((id) => <option key={id} value={id}>{id}</option>)}</select></label>
      <button type="button" onClick={reset}>Reset fixture</button>
    </aside>

    <header className={styles.header}><div><p>DEVELOPMENT-ONLY VERIFICATION</p><h1>{role === 'facilitator' ? 'Unified Syllabus' : 'Learner Syllabus'}</h1><span>{scenario.label} · revision {fixture.activeRevision.revision_number} · selected {selectedWeek || 'current week'}</span></div>{role === 'facilitator' && <div className={styles.quickActions}><button type="button" disabled={!planningAllowed} onClick={() => setPlanAheadOpen(true)}>Plan Ahead</button><button type="button" onClick={() => setHistoryOccurrenceId('actual:qa-session-fractions-a')}>History A</button><button type="button" onClick={runHistoryRace}>Race A→B</button></div>}</header>

    {role === 'facilitator' && <section className={styles.telemetry} aria-label="QA request state">
      <span>Forecast: <strong>{forecastStatus}</strong></span><span>Requests: <strong data-qa-forecast-count>{forecastRequests}</strong></span><span>Busy: <strong>{busy || 'no'}</strong></span>
      <span>Canonical generations: <strong data-qa-materialization-generations>{materializationGenerations}</strong></span>
      {forecastStatus === 'error' && <button type="button" onClick={retryForecast}>Retry forecast</button>}
      {repairLineage && scenarioId !== 'recovery_required' && <button type="button" disabled={Boolean(busy)} onClick={retryBinding}>Retry binding with preserved artifact</button>}
    </section>}
    {role === 'facilitator' && fixture.productionForecastEvidence?.[0] && <section className={styles.telemetry} aria-label="Production evidence forecast projection">
      <span>Production projection: <strong>{fixture.productionForecastEvidence[0].learning_summary?.headline || 'No summary'}</strong></span>
      <span>Raw events/transcript: <strong>{JSON.stringify(fixture.productionForecastEvidence).includes('events') || JSON.stringify(fixture.productionForecastEvidence).includes('transcript') ? 'ERROR' : 'excluded'}</strong></span>
    </section>}
    {error && <p className={styles.error} role="alert">{error}</p>}

    {role === 'facilitator' && proposalItems.length > 0 && <section className={styles.proposal} aria-label="Automatic one-week forecast">
      <header><div><p>AUTOMATIC ONE-WEEK FORECAST</p><h2>Proposed instructional concepts</h2></div><span>Inactive · exact lineages</span></header>
      <div>{proposalItems.map((item) => <article key={item.lineage_id}><strong>{item.subject}: {item.title}</strong><p>{item.description}</p><small>{item.planned_date} · {item.lineage_id}</small><div><button type="button" disabled={!planningAllowed || Boolean(busy)} onClick={() => setConceptEditor(item)}>Edit</button><button type="button" disabled={!planningAllowed || Boolean(busy)} onClick={() => replaceConcept(item)}>{busy === `replace:${item.lineage_id}` ? 'Replacing…' : 'Replace'}</button></div></article>)}</div>
    </section>}

    <SyllabusDocument
      revision={fixture.activeRevision}
      forecastItems={fixture.timelineItems}
      timelineItems={fixture.timelineItems}
      role={role}
      learnerId={fixture.learner.id}
      planTier={scenario.tier}
      learnerName={fixture.learner.name}
      onEditSection={planningAllowed ? openSection : null}
      onOpenPlanning={planningAllowed ? () => setPlanAheadOpen(true) : null}
      onWeekChange={onWeekChange}
      onLessonAction={handleLessonAction}
      onReviewHistory={role === 'facilitator' ? (item) => setHistoryOccurrenceId(item.occurrence_id) : null}
      actionCapabilities={role === 'facilitator'
        ? { reviewHistory: true, lessonActions: true }
        : { openLesson: true }}
      resolveActionHref={() => null}
      isActionDisabled={(item, actionId) => actionId === 'materialize' && (!scenario.generation || Boolean(busy) || repairLineage === item.lineage_id)}
      today={fixture.resolvedToday}
    />

    {sectionEditor && <SectionEditor section={sectionEditor} revision={fixture.activeRevision} busy={Boolean(busy)} error={error} onCancel={() => { setSectionEditor(''); setError('') }} onSave={saveSection} />}
    {conceptEditor && <ConceptEditor item={conceptEditor} busy={Boolean(busy)} error={error} onCancel={() => { setConceptEditor(null); setError('') }} onSave={saveConcept} />}
    {planAheadOpen && <SyllabusPlanningWorkspace revision={fixture.activeRevision} items={planItems} today={fixture.resolvedToday} busy={Boolean(busy)} error={error} canPlan={planningAllowed} canGenerate={scenario.generation} canSuggest={scenario.generation} onClose={() => setPlanAheadOpen(false)} onCreate={createConcept} onEdit={editPlanItem} onRemove={removePlanItem} onGenerate={materialize} onSuggest={suggest} />}
    {historyOccurrenceId && <LessonHistoryOverlay learnerId={fixture.learner.id} occurrenceId={historyOccurrenceId} pageIdentity={`${fixture.learner.id}:${fixture.activeRevision.id}`} onClose={() => setHistoryOccurrenceId('')} loadHistory={loadHistory} loadTranscript={loadTranscript} />}
  </main>
}
