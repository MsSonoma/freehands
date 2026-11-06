/** Resolve saved Discussion objectives without reassigning historical credit to new goals. */
export function restoreDiscussionObjectivePlan(phaseData = {}) {
  const source = phaseData && typeof phaseData === 'object' ? phaseData : {};
  const objectives = Array.isArray(source.objectives) && source.objectives.length > 0 &&
    source.objectives.length <= 40 && source.objectives.every(value => typeof value === 'string' && value.trim().length > 0 && value.length <= 1200)
    ? [...source.objectives] : [];
  const indices = Array.isArray(source.completedObjectiveIndices)
    ? [...new Set(source.completedObjectiveIndices.filter(Number.isInteger))] : [];
  const validIndices = objectives.length > 0 && indices.every(index => index >= 0 && index < objectives.length);
  const priorUnmapped = Array.isArray(source.legacyUnmappedCompletedObjectiveIndices)
    ? source.legacyUnmappedCompletedObjectiveIndices.filter(Number.isInteger) : [];
  const objectiveClues = objectives.length && Array.isArray(source.objectiveClues) &&
    source.objectiveClues.length === objectives.length &&
    source.objectiveClues.every(value => typeof value === 'string' && value.trim().length > 0)
    ? [...source.objectiveClues] : objectives.map((_, i) => `Goal ${i + 1}`);
  return {
    objectives,
    objectiveClues,
    completedObjectiveIndices: validIndices ? indices : [],
    legacyUnmappedCompletedObjectiveIndices: [...new Set([
      ...priorUnmapped, ...(!validIndices ? indices : []),
    ])],
  };
}
