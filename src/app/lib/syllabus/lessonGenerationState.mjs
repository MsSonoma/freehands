// Presentation/routing only. Ownership and revision checks remain server-owned.
const RECEIPT_STATES = new Set(['generating', 'generation_failed', 'generated', 'binding_failed', 'recovery_required', 'bound'])
export function forecastCarryLessonKey(item) {
  const value = String(item?.metadata?.learning_forecast?.carry_existing_lesson_key || '').trim()
  return value.includes('/') ? value : ''
}
export function isUngeneratedSyllabusLesson(item) {
  return Boolean(item?.lineage_id) && !item.lesson_key && (item.item_type || 'lesson') === 'lesson'
    && ['learning_forecast', 'facilitator'].includes(item.origin)
    && !item.historical_record && item.placement_kind !== 'actual'
}
export function lessonGenerationPresentation(item, { busy = false, recoveryRequired = false } = {}) {
  const state = recoveryRequired ? 'recovery_required' : busy ? 'generating' : item?.generation_status || ''
  if (state === 'recovery_required') return { label: 'Generation needs recovery', action: 'Recovery required', canEdit: false, blocked: true }
  if (state === 'generation_failed') return { label: 'Generation failed - retry', action: 'Retry generation', canEdit: true, blocked: false }
  if (['generating', 'generated', 'binding_failed'].includes(state)) return { label: busy ? 'Generating lesson...' : 'Generation needs to finish', action: busy ? 'Generating...' : 'Resume generation', canEdit: false, blocked: busy }
  if (forecastCarryLessonKey(item)) return { label: 'Forecast suggestion - unfinished lesson', action: 'Carry lesson forward', canEdit: true, blocked: false }
  return { label: item?.origin === 'learning_forecast' ? 'AI forecast suggestion' : 'Ready to generate', action: 'Generate lesson', canEdit: true, blocked: false }
}
export function withLessonGenerationStates(items = [], receipts = []) {
  const states = new Map(receipts.filter(row => RECEIPT_STATES.has(row.status)).map(row => [String(row.lineage_id), row.status]))
  return items.map(item => isUngeneratedSyllabusLesson(item) && states.has(String(item.lineage_id))
    ? { ...item, generation_status: states.get(String(item.lineage_id)) } : item)
}
export function proposalForLesson(item, proposal, activeItems = [], activeRevisionId = '') {
  const id = String(item?.lineage_id || '')
  // Origin is provenance, not proof that this entry is still an inactive proposal.
  if (!id || activeItems.some(row => String(row.lineage_id) === id)) return null
  const revision = proposal?.proposal_revision
  if (!revision?.id || revision.activated_at || (activeRevisionId && revision.base_revision_id && revision.base_revision_id !== activeRevisionId)) return null
  const matches = (proposal.forecast_items || []).filter(row => String(row.lineage_id) === id && isUngeneratedSyllabusLesson(row))
  return matches.length === 1 ? proposal : null
}
