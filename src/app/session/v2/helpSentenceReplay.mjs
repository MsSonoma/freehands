// Keep Ask and Study replay targets tied to the exact teacher text, not learner input.
export function splitHelpSentences(value) {
  const text = String(value || '').trim();
  if (!text) return [];
  return text.split(/(?<=[.!?])\s+(?=["'\u201c\u2018A-Z0-9])/u).map(s => s.trim()).filter(Boolean);
}

export function replayableHelpHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.flatMap((turn, index) => {
    if (turn?.role !== 'assistant') return [];
    return splitHelpSentences(turn.content || turn.text).map((text, sentenceIndex) => ({
      text, id: `${index}-${sentenceIndex}`,
    }));
  });
}
