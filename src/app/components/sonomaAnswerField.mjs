// A text answer grows with its content; only the outer session may scroll.
export function resizeSonomaAnswerField(field) {
  if (!field) return 0;
  field.style.height = 'auto';
  field.style.overflowY = 'hidden';
  field.style.resize = 'none';
  const border = Math.max(0, Number(field.offsetHeight || 0) - Number(field.clientHeight || 0));
  const height = Math.ceil(Number(field.scrollHeight || 0) + border);
  if (height > 0) field.style.height = `${height}px`;
  return height;
}

export function isSonomaSubmitTarget(target) {
  return Boolean(target?.closest?.('[data-sonoma-submit], form button[type=submit], form button:not([type])'));
}
