// Resolve only exact file-authored questions, never infer a source from a paraphrase.
const QUESTION_FIELDS = ['truefalse','multiplechoice','shortanswer','fillintheblank','worksheet','test','comprehension','exercise','sample'];
export function resolveFacilitatorQuestionSource(lesson = {}, question = {}) {
  const originalText = String(question?.question || '').trim();
  if (!originalText || !lesson || typeof lesson !== 'object') return null;
  for (const field of QUESTION_FIELDS) {
    const rows = Array.isArray(lesson[field]) ? lesson[field] : [];
    const matches = rows.flatMap((item, index) => {
      if (!item || typeof item !== 'object') return [];
      const text = String(item.question || item.Q || item.q || item.prompt || item.text || '').trim();
      if (text !== originalText) return [];
      if (item.id && question.id && String(item.id) !== String(question.id)) return [];
      return [{ field, index, original: item }];
    });
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) return null;
  }
  return null;
}
export function canCreateFacilitatorSourceRevision(lessonKey, source) {
  return /^generated\/[a-zA-Z0-9._-]+\.json$/.test(String(lessonKey || '')) && Boolean(source && Number.isInteger(source.index) && source.index >= 0);
}
