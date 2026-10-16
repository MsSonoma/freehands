// Stateless Liftoff line help: each request uses the learner's existing transcript
// rather than a separate model memory or any change to mastery/progression state.
const MAX_PRIOR_CONTEXT = 16;

function text(value, limit = 2400) {
  return String(value || '').trim().slice(0, limit);
}

export function resolveSlateLineHelpTarget(transcript = [], selectedLine = {}, selectedIndex = null) {
  const selectedText = text(selectedLine?.text);
  const lines = Array.isArray(transcript) ? transcript : [];
  const validIndex = Number.isInteger(selectedIndex) && selectedIndex >= 0 &&
    selectedIndex < lines.length && text(lines[selectedIndex]?.text) === selectedText;
  const parent = validIndex && selectedLine?.kind === 'line_help' &&
    Number.isInteger(selectedLine?.sourceMessageIndex) ? selectedLine.sourceMessageIndex : null;
  if (parent != null && parent >= 0 && parent < lines.length &&
      lines[parent]?.role === 'assistant' && text(lines[parent]?.text)) {
    return { text: text(lines[parent].text), sourceIndex: parent };
  }
  return { text: selectedText, sourceIndex: validIndex ? selectedIndex : null };
}

export function slateLineHelpHistory(transcript = [], sourceIndex = null, { activityId = null } = {}) {
  const lines = Array.isArray(transcript) ? transcript : [];
  const hasSource = Number.isInteger(sourceIndex) && sourceIndex >= 0 && sourceIndex < lines.length;
  const activity = text(activityId, 120);
  const prior = lines.filter((line) => {
    if (line?.role !== 'assistant' || line?.kind !== 'line_help' || !text(line?.text)) return false;
    if (hasSource) return line.sourceMessageIndex === sourceIndex;
    return Boolean(activity && line.activityId === activity);
  }).map((line) => text(line.text));
  return {
    previousExplanations: prior.slice(-MAX_PRIOR_CONTEXT),
    rephraseCount: prior.length,
  };
}

function comparable(value) {
  return text(value).toLowerCase().normalize('NFKC')
    .replace(/[\u2018\u2019']/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim().replace(/\s+/g, ' ');
}

function ngrams(value, size) {
  const result = new Map();
  for (let i = 0; i <= value.length - size; i++) {
    const gram = value.slice(i, i + size);
    result.set(gram, (result.get(gram) || 0) + 1);
  }
  return result;
}

function diceSimilarity(left, right) {
  if (left.length < 3 || right.length < 3) return 0;
  const first = ngrams(left, 3);
  const second = ngrams(right, 3);
  let common = 0;
  for (const [gram, quantity] of first) common += Math.min(quantity, second.get(gram) || 0);
  return (2 * common) / (left.length + right.length - 4);
}

export function isSlateLineHelpDuplicate(candidate, earlier = []) {
  const current = comparable(candidate);
  if (!current) return true;
  const prior = Array.isArray(earlier) ? earlier : [];
  return prior.some((value) => {
    const previous = comparable(value);
    if (!previous) return false;
    if (current === previous) return true;
    const ratio = Math.min(current.length, previous.length) / Math.max(current.length, previous.length);
    if (ratio < 0.72) return false;
    const wordsA = current.split(' ');
    const wordsB = previous.split(' ');
    const uniqueA = new Set(wordsA);
    const uniqueB = new Set(wordsB);
    const shared = [...uniqueA].filter((word) => uniqueB.has(word)).length;
    const wordOverlap = (2 * shared) / (uniqueA.size + uniqueB.size);
    return wordOverlap >= 0.91 || diceSimilarity(current, previous) >= 0.84;
  });
}

export function safeSlateLineHelpHistory(value) {
  return (Array.isArray(value) ? value : []).filter((v) => typeof v === 'string')
    .map((v) => text(v, 1100)).filter(Boolean).slice(-MAX_PRIOR_CONTEXT);
}
