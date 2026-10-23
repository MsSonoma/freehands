/**
 * Insert a completed dictation result at a text field's saved selection.
 * This changes only the text being edited; it never submits the field.
 */
export function insertDictationAtSelection(value, selectionStart, selectionEnd, transcript) {
  const original = String(value ?? '');
  const spoken = String(transcript ?? '').trim();
  const start = Math.max(0, Math.min(original.length, Number.isFinite(selectionStart) ? selectionStart : original.length));
  const end = Math.max(start, Math.min(original.length, Number.isFinite(selectionEnd) ? selectionEnd : start));
  if (!spoken) return { value: original, caret: start, changed: false };

  const before = original.slice(0, start);
  const after = original.slice(end);
  const beforeSpace = before && !/[\s([{“"]$/.test(before) && !/^[.,!?;:]/.test(spoken) ? ' ' : '';
  const afterSpace = after && !/^[\s.,!?;:)\]}”]/.test(after) && !/[\s([{“"]$/.test(spoken) ? ' ' : '';
  const insertion = beforeSpace + spoken + afterSpace;
  return {
    value: before + insertion + after,
    caret: start + insertion.length - afterSpace.length,
    changed: true,
  };
}
