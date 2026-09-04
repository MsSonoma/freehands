const HUMOR_LEVELS = new Set(['calm', 'funny', 'hilarious'])
const TARGET_KEYS = ['comprehension', 'exercise', 'worksheet', 'test']

export function normalizeHumorLevel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return HUMOR_LEVELS.has(normalized) ? normalized : 'calm'
}

export function clearLearnerTargetOverrides(storage, currentId, selectedId) {
  for (const target of TARGET_KEYS) storage?.removeItem?.(`target_${target}`)
  if (currentId && currentId !== selectedId) {
    for (const target of TARGET_KEYS) storage?.removeItem?.(`target_${target}_${currentId}`)
  }
}

export function persistLearnerSelection(storage, learner) {
  const currentId = storage?.getItem?.('learner_id')
  const selected = {
    ...learner,
    id: String(learner?.id || ''),
    name: String(learner?.name || ''),
    humor_level: normalizeHumorLevel(learner?.humor_level),
  }

  storage?.setItem?.('learner_id', selected.id)
  storage?.setItem?.('learner_name', selected.name)
  storage?.setItem?.('learner_grade', selected.grade == null ? '' : String(selected.grade))
  storage?.setItem?.('learner_humor_level', selected.humor_level)
  storage?.setItem?.(`learner_humor_level_${selected.id}`, selected.humor_level)

  clearLearnerTargetOverrides(storage, currentId, selected.id)

  return selected
}
