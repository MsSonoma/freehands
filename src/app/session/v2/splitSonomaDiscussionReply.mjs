// Split feedback from a following learner-facing question without changing either phrase.
// A reply that is only a question or only feedback remains a single speech segment.
export function splitSonomaDiscussionReply(value) {
  const text = String(value || '').trim();
  if (!text.includes('?')) return null;
  const boundaries = [...text.matchAll(/[.!?]["'\u201d]?\s+/g)];
  for (const boundary of boundaries) {
    const cut = boundary.index + boundary[0].length;
    const feedback = text.slice(0, cut).trim();
    const question = text.slice(cut).trim();
    const firstSentence = question.split(/(?<=[.!?])\s+/)[0] || '';
    if (feedback.length >= 8 && firstSentence.includes('?') && question.length >= 5) {
      return { feedback, question };
    }
  }
  // Some responses join the feedback and question with a transitional phrase.
  const transition = /(?:[,;:]\s*|\s+)(?:now|next|so)\s*,?\s+(?=(?:what|why|how|which|where|when|who|can|could|would|do|does|is|are)\b)/gi;
  for (const match of text.matchAll(transition)) {
    const at = match.index + match[0].search(/(?:now|next|so)/i);
    const feedback = text.slice(0, at).trim().replace(/[,;:]$/, '').trim();
    const question = text.slice(at).trim();
    if (feedback.length >= 8 && question.includes('?')) return { feedback, question };
  }
  // Also handle compact replies such as "You are correct, what changes next?".
  const directQuestion = /[,;:]\s+(?=(?:what|why|how|which|where|when|who|can|could|would|do|does|is|are)\b)/gi;
  for (const match of text.matchAll(directQuestion)) {
    const cut = match.index;
    const feedback = text.slice(0, cut).trim();
    const question = text.slice(cut + match[0].length).trim();
    if (feedback.length >= 8 && question.includes('?')) return { feedback, question };
  }  return null;
}
