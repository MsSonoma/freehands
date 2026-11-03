const TYPES = new Set(['shortanswer', 'short', 'fib', 'fill', 'fillintheblank', 'multiplechoice', 'mc', 'truefalse', 'tf']);
export function normalizeFacilitatorQuestionCandidate(original, candidate) {
  if (!original || !candidate || typeof candidate !== 'object') return null;
  const type = String(original.type || original.sourceType || 'shortanswer').toLowerCase();
  if (!TYPES.has(type)) return null;
  const question = String(candidate.question || '').trim();
  if (question.length < 12 || question.length > 1200 || question === String(original.question || '').trim()) return null;
  const replaced = { ...original, question, type: original.type || type,
    id: `replacement-${String(original.id || 'question').slice(0,80)}-${String(candidate.replacementId || '').slice(0,36) || 'new'}`,
    replacesQuestionId: original.id || null,
    sourceRevision: original.sourceRevision || null,
    objectiveId: original.objectiveId || original.objective_id || null,
    facilitatorReplaced: true,
  };
  if (['mc','multiplechoice'].includes(type)) {
    const choices = Array.isArray(candidate.choices) ? candidate.choices : candidate.options;
    if (!Array.isArray(choices) || choices.length !== 4 || new Set(choices.map(x => String(x).trim().toLowerCase())).size !== 4) return null;
    if (!Number.isInteger(candidate.correct) || candidate.correct < 0 || candidate.correct > 3) return null;
    replaced.choices = choices;
    replaced.options = choices;
    replaced.correct = candidate.correct;
    replaced.answer = choices[candidate.correct];
  } else if (['truefalse','tf'].includes(type)) {
    if (typeof candidate.answer !== 'boolean') return null;
    replaced.answer = candidate.answer;
  } else {
    if (['fib','fill','fillintheblank'].includes(type) && !question.includes('_____')) return null;
    const expectedAny = (Array.isArray(candidate.expectedAny) ? candidate.expectedAny : []).map(x => String(x || '').trim()).filter(Boolean);
    if (!expectedAny.length) return null;
    replaced.expectedAny = expectedAny;
    replaced.answer = expectedAny[0];
  }
  return replaced;
}
