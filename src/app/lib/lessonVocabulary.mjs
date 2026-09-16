function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clean(value) {
  return value == null ? '' : String(value).trim();
}

export function normalizeLessonVocabulary(lessonData = {}) {
  const raw = asArray(lessonData?.vocabulary || lessonData?.vocab || lessonData?.vocab_terms);
  const deduped = new Map();
  for (const entry of raw) {
    const term = typeof entry === 'string'
      ? clean(entry)
      : clean(entry?.term || entry?.word || entry?.title || entry?.key || entry?.name);
    if (!term) continue;
    const definition = typeof entry === 'string'
      ? ''
      : clean(entry?.definition || entry?.meaning || entry?.explainer || entry?.description);
    const key = term.toLowerCase();
    if (!deduped.has(key)) {
      deduped.set(key, { term, definition });
    } else if (!deduped.get(key).definition && definition) {
      deduped.set(key, { term: deduped.get(key).term, definition });
    }
  }
  return Array.from(deduped.values());
}

export function getVocabularyTerms(lessonData = {}, { fallbackTitle = '' } = {}) {
  const explicit = normalizeLessonVocabulary(lessonData).map((entry) => entry.term);
  if (explicit.length) return explicit.sort((a, b) => b.length - a.length);

  const rawTitle = clean(fallbackTitle || lessonData?.title);
  if (!rawTitle) return [];
  const stop = new Set(['with', 'and', 'the', 'of', 'a', 'an', 'to', 'in', 'on', 'for', 'by', 'vs', 'versus', 'about', 'into', 'from']);
  const deduped = new Map();
  for (const word of rawTitle.split(/[^A-Za-z]+/).map((part) => part.trim()).filter(Boolean)) {
    const key = word.toLowerCase();
    if (stop.has(key) || deduped.has(key)) continue;
    deduped.set(key, word);
    if (deduped.size >= 5) break;
  }
  return Array.from(deduped.values()).sort((a, b) => b.length - a.length);
}

export function buildVocabularyPromptChunk(lessonData = {}, { limit = 6 } = {}) {
  const entries = normalizeLessonVocabulary(lessonData).slice(0, Math.max(0, limit));
  if (!entries.length) return '';
  const hasDefinitions = entries.some((entry) => entry.definition);
  if (hasDefinitions) {
    return `Relevant lesson vocabulary (preserve these meanings): ${entries.map((entry) => `${entry.term}: ${entry.definition || 'definition not provided'}`).join('; ')}.`;
  }
  return `Relevant lesson vocabulary: ${entries.map((entry) => entry.term).join(', ')}.`;
}
